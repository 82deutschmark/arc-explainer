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
         All messages may respond with {type:'error', id, message} on failure.

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
    } else {
      self.postMessage({ type: 'error', id, message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};

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
  await pyodide.runPythonAsync(`
import json, zipfile, io, importlib, site
from pyodide.http import pyfetch

resp = await pyfetch("https://pypi.org/pypi/arcengine/json")
meta = json.loads(await resp.string())
whl_url = next(u["url"] for u in meta["urls"] if u["filename"].endswith("py3-none-any.whl"))

whl_resp = await pyfetch(whl_url)
whl_bytes = bytes(await whl_resp.bytes())

sp = site.getsitepackages()[0]
with zipfile.ZipFile(io.BytesIO(whl_bytes)) as zf:
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

// ─── Guard ────────────────────────────────────────────────────────────────────
function ensureReady() {
  if (initStage !== 'ready') {
    throw new Error('Pyodide not ready — call init first');
  }
}
