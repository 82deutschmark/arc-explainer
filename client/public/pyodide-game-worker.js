/*
Author: Claude Sonnet 4.6
Date: 2026-03-12
PURPOSE: Web Worker for running ARCEngine community games client-side via Pyodide 0.27.4.
         Eliminates server-side Python subprocesses and per-action network round-trips.
         Loads numpy + pydantic via Pyodide's pre-compiled package system, then installs
         arcengine by fetching its wheel from PyPI and extracting it into site-packages.

         30-Aug-2026: reverted to the wheel-fetch. On 29-Aug it was replaced with
         `micropip.install("arcengine")` on the argument that pydantic-core is already in
         the Pyodide 0.27.4 lockfile so micropip would never build anything. Pyodide then
         stopped working -- a board that rendered with controls that did nothing, and no
         error -- and rather than reverting, the play page was switched to a server-side
         session path. That server path has since been removed along with the DB-backed
         catalog, and this is now the only way a game runs.

         The wheel-fetch is not a workaround for a problem that does not exist: it is the
         recipe running in production at arc3.sonpham.net (static/js/games-engine.js),
         which serves all 300 games this site mirrors. Matching the source of truth beats
         re-deriving what micropip ought to be able to do. Do not swap it back without a
         game actually loading in a browser first.
         Architecture ref: docs/sonpham-arc3-pyodide-architecture.md

         Message protocol (main thread → worker):
           {type:'init', id}                           → {type:'ready', id}
           {type:'load_game', id, source, className}   → {type:'frame', id, frame}
           {type:'step', id, action, data}              → {type:'frame', id, frame}
           {type:'reset', id}                           → {type:'frame', id, frame}
           {type:'probe_move', id, x, y, candidates}    → {type:'probe', id, action, ...}
         All messages may respond with {type:'error', id, message} on failure.

         07-Sep-2026: probe_move. On the hex and triangular tasks a neighbour is reached by
         ACTION1,2,3,4,5,7 in an order a blind player cannot learn -- there is no key that
         means "the cell up and to the right". probe_move takes a clicked frame cell,
         speculatively applies each candidate action to a DEEP COPY of the live instance,
         and reports which one moves the clicked pixel. It never touches the real instance,
         the undo stack or the action counter; the page then fires the winner through the
         normal step path so telemetry and undo stay correct. The probe body lives between
         the PROBE_PY markers below and is extracted verbatim by
         scripts/arc3/verify_probe_move.py, so the browser and the verification harness run
         one copy of it rather than two that can drift.

SRP/DRY check: Pass — single responsibility: Pyodide lifecycle + game execution loop.
*/

/* global importScripts, loadPyodide */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js');

let pyodide = null;
let initStage = 'idle'; // 'idle' | 'pyodide' | 'packages' | 'arcengine' | 'ready'

// ─── Action string → GameAction int mapping ───────────────────────────────────
const ACTION_IDS = {
  RESET: 0,
  ACTION1: 1,
  ACTION2: 2,
  ACTION3: 3,
  ACTION4: 4,
  ACTION5: 5,
  ACTION6: 6,
  ACTION7: 7,
};

// ─── Message handler ──────────────────────────────────────────────────────────
self.onmessage = async (e) => {
  const msg = e.data;
  const { type, id } = msg;

  try {
    if (type === 'init') {
      await handleInit(id);
    } else if (type === 'load_game') {
      const frame = await handleLoadGame(id, msg.source, msg.className);
      self.postMessage({ type: 'frame', id, frame });
    } else if (type === 'step') {
      const frame = await handleStep(id, msg.action, msg.data || null);
      self.postMessage({ type: 'frame', id, frame });
    } else if (type === 'reset') {
      const frame = await handleReset(id);
      self.postMessage({ type: 'frame', id, frame });
    } else if (type === 'undo') {
      const frame = await handleUndo(id);
      self.postMessage({ type: 'frame', id, frame });
    } else if (type === 'probe_move') {
      const probe = await handleProbeMove(id, msg.x, msg.y, msg.candidates);
      self.postMessage({ type: 'probe', id, ...probe });
    } else {
      self.postMessage({ type: 'error', id, message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};

/** One fetch with a hard deadline. A hang is the failure mode we are guarding against,
 *  and fetch has no timeout of its own. */
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/** Same-origin first, PyPI second, and a real error if both fail — never a hang. */
async function fetchArcengineWheel() {
  try {
    return await fetchWithTimeout('/api/arc3-mirror/arcengine-wheel', 30_000);
  } catch (localErr) {
    try {
      const metaRes = await fetch('https://pypi.org/pypi/arcengine/json');
      if (!metaRes.ok) throw new Error(`PyPI metadata ${metaRes.status}`);
      const meta = await metaRes.json();
      const entry = meta.urls.find((u) => u.filename.endsWith('py3-none-any.whl'));
      if (!entry) throw new Error('no py3-none-any wheel on PyPI');
      return await fetchWithTimeout(entry.url, 30_000);
    } catch (pypiErr) {
      throw new Error(
        `Could not download the game engine. Same-origin: ${localErr.message}. PyPI: ${pypiErr.message}`,
      );
    }
  }
}

// ─── Init: load Pyodide + numpy + pydantic + arcengine ───────────────────────
async function handleInit(id) {
  if (initStage === 'ready') {
    self.postMessage({ type: 'ready', id });
    return;
  }
  if (initStage !== 'idle') {
    throw new Error('Already initialising — duplicate init message');
  }

  // Stage 1: Pyodide runtime
  initStage = 'pyodide';
  self.postMessage({ type: 'progress', id, stage: 'pyodide', message: 'Loading Python runtime...' });
  pyodide = await loadPyodide();

  // Stage 2: numpy + pydantic (pre-compiled Pyodide wheels — fast)
  initStage = 'packages';
  self.postMessage({ type: 'progress', id, stage: 'packages', message: 'Loading packages...' });
  await pyodide.loadPackage(['numpy', 'pydantic']);

  // Stage 3: arcengine, fetched as a wheel from PyPI and extracted into site-packages.
  // This mirrors arc3.sonpham.net's games-engine.js exactly. micropip is deliberately
  // not used here -- see the header note.
  initStage = 'arcengine';
  self.postMessage({ type: 'progress', id, stage: 'arcengine', message: 'Installing game engine...' });
  // Fetch the wheel from OUR origin. It used to be pulled straight from pypi.org +
  // files.pythonhosted.org, two cross-origin requests from inside a Worker on every cold
  // start -- the kind of traffic a corporate proxy, TLS-inspecting antivirus or DNS
  // filter silently drops. When that happens pyfetch hangs rather than raising, so the
  // console sits on a loading state forever with dead controls, which is the reported
  // Windows symptom. Same-origin removes the whole class. PyPI stays as a fallback for
  // anyone running this without the server.
  const wheelBytes = await fetchArcengineWheel();
  pyodide.globals.set('_whl_bytes', wheelBytes);

  await pyodide.runPythonAsync(`
import zipfile, io, importlib, site

sp = site.getsitepackages()[0]
with zipfile.ZipFile(io.BytesIO(bytes(_whl_bytes.to_py()))) as zf:
    zf.extractall(sp)
importlib.invalidate_caches()

# Fail loudly here rather than leaving a half-initialised runtime: the caller turns
# this into an 'error' message, which the play page surfaces to the player.
from arcengine import ARCBaseGame, ActionInput, GameAction, GameState
`);

  initStage = 'ready';
  self.postMessage({ type: 'ready', id });
}

// ─── Load game: exec source, instantiate, RESET ──────────────────────────────
async function handleLoadGame(id, source, className) {
  ensureReady();

  // Inject source into Python globals, then exec and instantiate
  pyodide.globals.set('_game_source', source);
  pyodide.globals.set('_game_class_name', className);

  await pyodide.runPythonAsync(`
import copy, numpy as np
from arcengine import ARCBaseGame, ActionInput, GameAction, GameState

# Provide a virtual __file__ so games that inspect it don't crash
__file__ = '/virtual/game.py'

# Execute the game source in the current namespace
exec(_game_source, globals())

# Instantiate the game class
_game_instance = eval(_game_class_name + "()")
_action_counter = 0
_last_action = "INIT"

# Undo stack. A blind player's first move is a guess by construction, so being able to
# take it back is the difference between exploring and restarting -- arc3.sonpham.net's
# engine keeps one for the same reason. Deep copies of the game object AND its frame,
# because perform_action mutates the instance in place.
_undo_stack = []

# Get initial frame via RESET
_reset_input = ActionInput(id=GameAction.RESET)
_frame_data = _game_instance.perform_action(_reset_input)
`);

  return extractFrameJson();
}

// ─── Step: perform one action ─────────────────────────────────────────────────
async function handleStep(id, actionStr, actionData) {
  ensureReady();

  const actionId = ACTION_IDS[actionStr.toUpperCase()];
  if (actionId === undefined) throw new Error(`Unknown action: ${actionStr}`);

  pyodide.globals.set('_step_action_id', actionId);
  pyodide.globals.set('_step_action_data', actionData ? pyodide.toPy(actionData) : null);
  pyodide.globals.set('_step_action_name', actionStr.toUpperCase());

  await pyodide.runPythonAsync(`
from arcengine import ActionInput, GameAction

# Snapshot BEFORE mutating. Capped so a long session cannot grow WASM memory without
# bound; 50 steps back is far more than a player reaches for.
_undo_stack.append((copy.deepcopy(_game_instance), copy.deepcopy(_frame_data), _action_counter, _last_action))
if len(_undo_stack) > 50:
    _undo_stack.pop(0)

# GameAction.from_id(), NOT GameAction(int). In the published arcengine wheel each member
# is declared as a tuple -- ACTION2 = (2, SimpleAction) -- so the enum's by-value lookup
# does not accept a bare action id and GameAction(2) raises "2 is not a valid GameAction".
# The vendored external/ARCEngine sets _value_ = action_id in __init__, so the constructor
# works there and the bug is invisible outside the browser. This is what made the board
# render with dead controls: load_game and RESET never hit this path, so only stepping
# failed, and it failed inside the worker where nothing surfaced it.
# arc3.sonpham.net's games-engine.js uses from_id for the same reason.
_action_enum = GameAction.from_id(int(_step_action_id))
_data = dict(_step_action_data) if _step_action_data is not None else {}
_action_input = ActionInput(id=_action_enum, data=_data)
_frame_data = _game_instance.perform_action(_action_input)

if _step_action_id == 0:  # RESET
    _action_counter = 0
else:
    _action_counter += 1

_last_action = _step_action_name
`);

  return extractFrameJson();
}

// ─── Reset: shorthand step with RESET action ──────────────────────────────────
async function handleReset(id) {
  return handleStep(id, 'RESET', null);
}

// ─── Extract serialisable frame from Python state ─────────────────────────────
function extractFrameJson() {
  const result = pyodide.runPython(`
import json

# Thin frame sequence to ≤120 animation frames to keep postMessage payload small
# Frames may be numpy arrays (.tolist()) or already plain lists — handle both
_all_frames = [f.tolist() if hasattr(f, 'tolist') else f for f in _frame_data.frame]
_step_size = max(1, len(_all_frames) // 120)
_frames_out = _all_frames[::_step_size]

# Always include the final frame
if _all_frames and (not _frames_out or _frames_out[-1] != _all_frames[-1]):
    _frames_out.append(_all_frames[-1])

_state_str = _frame_data.state.value if hasattr(_frame_data.state, 'value') else str(_frame_data.state)

json.dumps({
    "frame": _frames_out,
    "score": _frame_data.levels_completed,
    "levels_completed": _frame_data.levels_completed,
    "win_score": _frame_data.win_levels,
    "win_levels": _frame_data.win_levels,
    "state": _state_str,
    "action_counter": _action_counter,
    "max_actions": getattr(_game_instance, 'max_actions', 100),
    "available_actions": list(_frame_data.available_actions),
    "last_action": _last_action,
    "undo_depth": len(_undo_stack),
})
`);

  return JSON.parse(result);
}

// ─── Undo: rewind one step ────────────────────────────────────────────────────
async function handleUndo(id) {
  ensureReady();

  const depth = pyodide.runPython('len(_undo_stack)');
  if (!depth) return extractFrameJson();

  await pyodide.runPythonAsync(`
_game_instance, _frame_data, _action_counter, _last_action = _undo_stack.pop()
`);

  return extractFrameJson();
}

// ─── Probe move: which direction key does the player mean by this click? ──────
/**
 * WHY THIS EXISTS. On the hex tasks six neighbours are reached by ACTION1,2,3,4,5,7 in an
 * axial order that is arbitrary from the player's side -- there is no key labelled "up and
 * to the right", and no amount of staring at the board reveals which of six keys is which
 * of six directions. On the triangular tasks the neighbour count is three and ACTION4 is a
 * dead key. Either way a blind player brute-forces the keyboard, which is exactly the
 * "sometimes the agent is stuck" report.
 *
 * The answer is not per-game metadata -- that is an answer key by another name, it goes
 * stale on every regeneration, and it would tell the page what the directions MEAN. This
 * asks the game instead: apply each candidate to a throwaway copy and look at which one
 * moves the pixel the player pointed at. The page learns one action id and nothing else.
 *
 * HONEST ABOUT WHAT IT IS NOT: it does not widen the action space. An API agent has the
 * same seven actions it always had. This is a mouse affordance for a human.
 */
async function handleProbeMove(id, clickX, clickY, candidates) {
  ensureReady();

  const ids = (Array.isArray(candidates) ? candidates : [1, 2, 3, 4, 5, 7])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7 && n !== 6);
  if (!ids.length) return { action: null, reason: 'no-candidates' };

  pyodide.globals.set('_probe_click_x', Math.round(clickX));
  pyodide.globals.set('_probe_click_y', Math.round(clickY));
  pyodide.globals.set('_probe_candidate_ids', pyodide.toPy(ids));

  await pyodide.runPythonAsync(PROBE_PY);
  return JSON.parse(pyodide.runPython('_probe_result'));
}

/**
 * The probe body, in Python, as one string.
 *
 * Extracted verbatim between the markers by scripts/arc3/verify_probe_move.py. The browser
 * gets ONE exec'd string and no filesystem, so a harness that re-implements this logic in
 * its own file verifies a second program that merely resembles the shipped one. Keep the
 * markers, and keep template interpolation out of the body.
 */
const PROBE_PY = `
# --- PROBE_PY_BEGIN ---
import copy, json
from arcengine import ActionInput, GameAction


def _probe_grid(fd):
    """The SETTLED board -- the last animation frame, not the first.

    perform_action returns a sequence, and on the hex tasks a single press plays an
    expanding ring over many frames. Diffing frame[0] against frame[0] compares two
    pictures of the moment before anything happened.
    """
    frames = getattr(fd, "frame", None)
    if not frames:
        return None
    grid = frames[-1]
    if hasattr(grid, "tolist"):
        return grid.tolist()
    return [list(row) for row in grid]


def _probe_changed(base, other):
    """Cells whose colour differs. None when the two boards are not comparable."""
    if base is None or other is None:
        return None
    if len(other) != len(base):
        return None
    out = set()
    for y in range(len(base)):
        brow = base[y]
        orow = other[y]
        if len(orow) != len(brow):
            return None
        for x in range(len(brow)):
            if brow[x] != orow[x]:
                out.add((x, y))
    return out


def _probe_run():
    base = _probe_grid(_frame_data)
    if base is None:
        return {"action": None, "reason": "no-frame"}

    before_counter = _action_counter
    before_undo = len(_undo_stack)
    before_last = _last_action

    changed = {}
    failed = []
    for raw in _probe_candidate_ids:
        aid = int(raw)
        try:
            # The undo stack already deep-copies these instances fifty at a time, so this
            # is a proven-safe operation on this game set rather than a hopeful one.
            clone = copy.deepcopy(_game_instance)
            probe_frame = clone.perform_action(
                ActionInput(id=GameAction.from_id(aid), data={})
            )
            cells = _probe_changed(base, _probe_grid(probe_frame))
        except Exception as exc:  # a rejected action is a legitimate answer: it moves nothing
            failed.append([aid, str(exc)[:120]])
            cells = None
        if cells:
            changed[aid] = cells

    result = {
        "action": None,
        "reason": "no-candidate-moves-that-cell",
        "candidatesTried": [int(a) for a in _probe_candidate_ids],
        "candidatesThatChanged": sorted(changed.keys()),
        "failed": failed,
    }

    if changed:
        ids = sorted(changed.keys())
        # SUBTRACT WHAT HAPPENS WHICHEVER WAY YOU GO. On g013 one press turns over a ring of
        # twenty-plus cells: the ambient spread, the clock, the animated bloom all repaint
        # the same cells for every candidate, so a raw changed-set test matches most of the
        # keyboard and the centroid tie-break then measures the spread rather than the move.
        # The discriminating residual is what actually distinguishes one direction from
        # another.
        common = set.intersection(*[changed[i] for i in ids]) if len(ids) >= 2 else set()
        click = (int(_probe_click_x), int(_probe_click_y))
        ranked = []
        for aid in ids:
            residual = changed[aid] - common
            # An EMPTY residual means this action repaints exactly what every other one
            # repaints, so nothing on the board can tell them apart and a click cannot mean
            # this one rather than that one. Dropped, not kept as a weak match: on g013 at
            # level start all six directions are blocked and produce one identical
            # four-pixel blink, and answering that with an arbitrary direction is the
            # crosshair-that-lies failure this page has already shipped twice.
            if not residual or click not in residual:
                continue
            cx = sum(p[0] for p in residual) / float(len(residual))
            cy = sum(p[1] for p in residual) / float(len(residual))
            dist = ((click[0] - cx) ** 2 + (click[1] - cy) ** 2) ** 0.5
            ranked.append((round(dist, 6), len(residual), aid, residual))
        ranked.sort(key=lambda t: t[:3])
        if ranked:
            if len(ranked) >= 2 and ranked[0][3] == ranked[1][3]:
                # Two actions that change exactly the same cells. Whichever we picked would
                # be a coin toss spending one of the player's moves.
                result["reason"] = "ambiguous"
                result["ambiguous"] = [ranked[0][2], ranked[1][2]]
            else:
                result["action"] = ranked[0][2]
                result["reason"] = "ok"
                result["scores"] = [
                    {"action": r[2], "distance": r[0], "residual": r[1]} for r in ranked
                ]

    # NO-MUTATION ASSERTION. The clones are what got acted on; if any of this moved, the
    # probe leaked into the real run and the answer must be thrown away rather than used.
    after = _probe_grid(_frame_data)
    result["clean"] = (
        after == base
        and _action_counter == before_counter
        and len(_undo_stack) == before_undo
        and _last_action == before_last
    )
    if not result["clean"]:
        result["action"] = None
        result["reason"] = "probe-mutated-live-state"
    return result


_probe_result = json.dumps(_probe_run())
# --- PROBE_PY_END ---
`;

// ─── Guard ────────────────────────────────────────────────────────────────────
function ensureReady() {
  if (initStage !== 'ready') {
    throw new Error('Pyodide not ready — call init first');
  }
}
