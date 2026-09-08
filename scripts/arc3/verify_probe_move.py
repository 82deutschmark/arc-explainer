"""
Author: Claude Opus 5
Date: 07-September-2026
PURPOSE: Verify the click-to-move probe under the contract the BROWSER actually runs it
         under, not under a friendlier one. The Pyodide worker gets ONE exec'd Python
         string, no filesystem and no import machinery, so a check that imports the game
         module off disk can pass while the site is broken -- that has happened twice.

         This harness therefore:
           1. EXTRACTS the probe body verbatim from client/public/pyodide-game-worker.js
              between the PROBE_PY markers. There is exactly one copy of the algorithm and
              this file does not re-implement it.
           2. REBUILDS the served string the way server/services/arc3Mirror/
              Arc3MirrorCatalog.ts bundleSupportModules() does -- support modules inlined
              as base64 into sys.modules, game body byte-identical below -- and execs it in
              a namespace with the games directory kept OFF sys.path, so a missing inline
              fails here rather than in a player's browser.
           3. ROUND-TRIPS every direction each game can actually move: apply the candidate
              to a clone, take a pixel that only that candidate changes, click it, and
              require the probe to name that candidate back.
           4. Proves NON-MUTATION differentially: a control run of a fixed action sequence
              is compared against the same sequence with a probe fired before every step.
              Identical final board, score, state and action counter, or the probe leaked.
           5. Times the probe, because six deepcopies plus six perform_action calls per
              click run in WASM on the player's machine.

         Run: python3 scripts/arc3/verify_probe_move.py [gameId ...]
         --all-candidates probes with all six directions regardless of what the game reads,
         which is what the client sends before /control-map resolves.
         Emit the cross-check fixture for the real-Pyodide run:
              python3 scripts/arc3/verify_probe_move.py --fixture <dir> [gameId ...]
         then: node scripts/arc3/verify_probe_pyodide.mjs <dir>, which boots actual
         Pyodide 0.27.4, execs the REAL worker file and replays the fixture. CPython here
         and WASM there must give the same answers, or one of them is not the shipped
         algorithm.
         Needs Python >= 3.12 and `pip install arcengine` (the PUBLISHED wheel -- the
         vendored external/ARCEngine differs in GameAction, which is the difference that
         made the board render with dead controls in September).

SRP/DRY check: Pass -- verification only. The algorithm lives in the worker; this file
         reads it. Nothing here is imported by application code.
"""

from __future__ import annotations

import base64
import copy
import json
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WORKER = REPO / "client" / "public" / "pyodide-game-worker.js"
GAMES_DIR = REPO / "server" / "data" / "arc3-games"
MECHANICS = GAMES_DIR / "mechanics.json"

# The exotic ten, as an explicit list. Deliberately NOT sniffed from source: "the game
# mentions ACTION7" is true of games where ACTION7 is a wait, and false of triangular
# games that use only 1/3/4. See EXOTIC_GAME_IDS in shared/arc3Topology.ts, which is the
# copy the client uses; this list must match it.
EXOTIC = ["g009", "g013", "g015", "g017", "g019", "g020", "g022", "g027", "g043", "g046"]

IMPORT_RE = re.compile(
    r"^[ \t]*(?:from[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]+import|import[ \t]+([A-Za-z_][A-Za-z0-9_]*))",
    re.M,
)


def probe_source() -> str:
    """The shipped probe body, verbatim. One copy, extracted -- never re-typed."""
    js = WORKER.read_text()
    begin = js.index("# --- PROBE_PY_BEGIN ---")
    end = js.index("# --- PROBE_PY_END ---") + len("# --- PROBE_PY_END ---")
    return js[begin:end]


def bundle(game_id: str) -> str:
    """Mirror of bundleSupportModules(): the exact string the worker execs."""
    game_files = {p.name for p in GAMES_DIR.glob("g*.py")}
    body = (GAMES_DIR / f"{game_id}.py").read_text()
    emitted: dict[str, str] = {}

    def visit(src: str, chain: list[str]) -> None:
        for m in IMPORT_RE.finditer(src):
            name = m.group(1) or m.group(2)
            if name in emitted or name in chain:
                continue
            rel = f"{name}.py"
            if rel in game_files:
                continue
            path = GAMES_DIR / rel
            if not path.exists():
                continue
            mod = path.read_text()
            visit(mod, chain + [name])
            emitted[name] = mod

    visit(body, [])
    if not emitted:
        return body

    blocks = []
    for name, mod in emitted.items():
        b64 = base64.b64encode(mod.encode()).decode()
        file = json.dumps(f"{name}.py")
        blocks.append(
            f"_arc3_mod = _arc3_types.ModuleType({json.dumps(name)})\n"
            f"_arc3_mod.__file__ = {file}\n"
            f'exec(compile(_arc3_b64.b64decode("{b64}").decode("utf-8"), {file}, "exec"), _arc3_mod.__dict__)\n'
            f"_arc3_sys.modules[{json.dumps(name)}] = _arc3_mod"
        )
    preamble = "\n".join(
        [
            "import sys as _arc3_sys, types as _arc3_types, base64 as _arc3_b64",
            *blocks,
            "del _arc3_sys, _arc3_types, _arc3_b64, _arc3_mod",
            "",
        ]
    )
    return preamble + body


def class_name(game_id: str) -> str:
    entry = next(e for e in json.loads(MECHANICS.read_text()) if e["gameId"] == game_id)
    return entry["className"]


ALL_CANDIDATES = False


def candidates_for(game_id: str) -> list[int]:
    """What the client sends: the actions the game READS, minus ACTION6.

    --all-candidates covers the other branch the client can take: until /control-map
    resolves the read set is unknown and all six go over, so the probe has to give the same
    answers when handed directions the game never looks at.
    """
    if ALL_CANDIDATES:
        return [1, 2, 3, 4, 5, 7]
    entry = next(e for e in json.loads(MECHANICS.read_text()) if e["gameId"] == game_id)
    return [a for a in entry["actionsReferenced"] if a != 6]


def boot(game_id: str) -> dict:
    """Load a game exactly as pyodide-game-worker.js handleLoadGame does."""
    from arcengine import ActionInput, GameAction  # noqa: F401

    g: dict = {"__name__": "__main__", "__file__": "/virtual/game.py"}
    exec(bundle(game_id), g)
    g["copy"] = copy
    g["_game_instance"] = g[class_name(game_id)]()
    g["_action_counter"] = 0
    g["_last_action"] = "INIT"
    g["_undo_stack"] = []
    g["_frame_data"] = g["_game_instance"].perform_action(
        ActionInput(id=GameAction.RESET)
    )
    return g


def grid(fd) -> list[list[int]]:
    f = fd.frame[-1]
    return f.tolist() if hasattr(f, "tolist") else [list(r) for r in f]


def step(g: dict, action_id: int) -> None:
    """The worker's step path, undo stack and counter included."""
    from arcengine import ActionInput, GameAction

    g["_undo_stack"].append(
        (copy.deepcopy(g["_game_instance"]), copy.deepcopy(g["_frame_data"]),
         g["_action_counter"], g["_last_action"])
    )
    g["_frame_data"] = g["_game_instance"].perform_action(
        ActionInput(id=GameAction.from_id(action_id), data={})
    )
    g["_action_counter"] = 0 if action_id == 0 else g["_action_counter"] + 1
    g["_last_action"] = f"ACTION{action_id}"


PROBE = probe_source()


def probe(g: dict, x: int, y: int, cands: list[int]) -> dict:
    g["_probe_click_x"] = x
    g["_probe_click_y"] = y
    g["_probe_candidate_ids"] = list(cands)
    exec(PROBE, g)
    return json.loads(g["_probe_result"])


def signature(g: dict) -> str:
    fd = g["_frame_data"]
    state = fd.state.value if hasattr(fd.state, "value") else str(fd.state)
    return json.dumps(
        [grid(fd), int(fd.levels_completed), state, g["_action_counter"],
         len(g["_undo_stack"]), g["_last_action"]]
    )


def _changed_sets(g: dict, cands: list[int]) -> dict[int, set]:
    """What each candidate repaints, from an independent walk of the candidates.

    Ground truth for the round-trip: computed here rather than read back out of the probe,
    so a probe that agrees with itself cannot pass.
    """
    from arcengine import ActionInput, GameAction

    base = grid(g["_frame_data"])
    changed: dict[int, set] = {}
    for aid in cands:
        try:
            clone = copy.deepcopy(g["_game_instance"])
            fd = clone.perform_action(ActionInput(id=GameAction.from_id(aid), data={}))
            other = grid(fd)
        except Exception:
            continue
        if len(other) != len(base) or any(len(a) != len(b) for a, b in zip(other, base)):
            continue
        cells = {
            (x, y)
            for y, row in enumerate(base)
            for x, v in enumerate(row)
            if other[y][x] != v
        }
        if cells:
            changed[aid] = cells
    return changed


def distinct_residuals(g: dict, cands: list[int]) -> dict[int, set]:
    """Directions a click could name in THIS state: non-empty residual, no twin.

    Same admission rule the shipped probe applies, so states where every direction
    repaints identically -- g013 at level start, where all six are walled in -- are
    correctly reported as having nothing to click rather than counted as failures.
    """
    changed = _changed_sets(g, cands)
    if not changed:
        return {}
    ids = sorted(changed)
    common = set.intersection(*changed.values()) if len(ids) >= 2 else set()
    residual = {a: changed[a] - common for a in ids}
    out = {}
    for a, r in residual.items():
        if not r:
            continue
        if any(b != a and residual[b] == r for b in residual):
            continue
        out[a] = r
    return out


def explore(g: dict, cands: list[int], xy_click: bool, log: list, budget: int = 60):
    """Walk the game looking for states where a click can mean something.

    A single probe at RESET verifies almost nothing: several of these tasks open on a
    position where no direction is legal. This takes real steps -- including ACTION6
    coordinate clicks on the tasks that read them, since on g013 planting is what opens
    the board up -- and yields each state that has at least one nameable direction.
    """
    from arcengine import ActionInput, GameAction

    seen = 0
    for _ in range(budget):
        d = distinct_residuals(g, cands)
        if d:
            yield d
            seen += 1
            if seen >= 5:
                return
        moved = False
        changed = _changed_sets(g, cands)
        # A direction step only when one of them is actually distinguishable. On g013 the
        # rider opens walled in and all six directions produce one identical blink, so
        # stepping a direction burns the action budget without ever reaching a state worth
        # probing -- the coordinate click is what opens that board up, and it has to be
        # tried FIRST rather than only as a last resort.
        if d:
            for aid in sorted(changed, key=lambda a: -len(changed[a])):
                step(g, aid)
                log.append(("dir", aid))
                moved = True
                break
        if not moved and xy_click:
            # Deterministic coarse sweep, not a random one: the run has to be reproducible
            # for a per-game table to mean anything.
            base = grid(g["_frame_data"])
            h, w = len(base), len(base[0])
            scored = []
            for cy in range(0, h, 2):
                for cx in range(0, w, 2):
                    clone = copy.deepcopy(g["_game_instance"])
                    try:
                        fd = clone.perform_action(
                            ActionInput(id=GameAction.ACTION6, data={"x": cx, "y": cy})
                        )
                    except Exception:
                        continue
                    other = grid(fd)
                    if len(other) != h:
                        continue
                    n = sum(
                        1
                        for y in range(h)
                        for x in range(w)
                        if other[y][x] != base[y][x]
                    )
                    scored.append((n, cx, cy))
            # The LARGEST diff, not the first non-zero one. On g013 every click repaints a
            # four-pixel clock whether or not it landed on the board, so "something
            # changed" is true of all 1024 of them and picking the first one walks the
            # game nowhere. The click that plants repaints 49.
            if scored:
                scored.sort(reverse=True)
                n, cx, cy = scored[0]
                if n > scored[-1][0]:
                    g["_undo_stack"].append(
                        (copy.deepcopy(g["_game_instance"]),
                         copy.deepcopy(g["_frame_data"]),
                         g["_action_counter"], g["_last_action"])
                    )
                    g["_frame_data"] = g["_game_instance"].perform_action(
                        ActionInput(id=GameAction.ACTION6, data={"x": cx, "y": cy})
                    )
                    g["_action_counter"] += 1
                    g["_last_action"] = "ACTION6"
                    log.append(("xy", cx, cy))
                    moved = True
        if not moved and changed:
            for aid in sorted(changed, key=lambda a: -len(changed[a])):
                step(g, aid)
                log.append(("dir", aid))
                moved = True
                break
        if not moved:
            return
        state = g["_frame_data"].state
        if str(getattr(state, "value", state)).upper() != "NOT_FINISHED":
            return


def run_game(game_id: str) -> dict:
    entry = next(e for e in json.loads(MECHANICS.read_text()) if e["gameId"] == game_id)
    cands = candidates_for(game_id)
    row: dict = {
        "game": game_id,
        "candidates": cands,
        "statesWithAClickableDirection": 0,
        "roundTrip": "0/0",
        "noExclusiveCell": 0,
        "fixture": [],
        "misses": [],
        "rejectsFarClick": None,
        "clean": None,
        "nonMutating": None,
        "msPerProbe": None,
        "error": None,
    }
    try:
        g = boot(game_id)
    except Exception as exc:
        row["error"] = f"boot: {type(exc).__name__}: {exc}"
        return row

    hits = total = states = 0
    times: list[float] = []
    clean = True
    walked: list = []
    try:
        for truth in explore(g, cands, entry.get("action6") == "xy-click", walked):
            states += 1
            for aid, cells in truth.items():
                # Click a cell ONLY this direction repaints. That is the case the feature
                # exists for -- a player pointing at the tile they want to move onto -- and
                # it is the only case with a single right answer. Where two directions both
                # repaint the clicked cell (the player sprite's own footprint, a shared HUD)
                # any of them is a defensible reading, so counting those as failures would
                # measure the harness's tie-break rather than the probe's.
                exclusive = [
                    c for c in cells
                    if not any(b != aid and c in r for b, r in truth.items())
                ]
                if not exclusive:
                    row["noExclusiveCell"] += 1
                    continue
                cx = sum(c[0] for c in exclusive) / len(exclusive)
                cy = sum(c[1] for c in exclusive) / len(exclusive)
                x, y = min(exclusive, key=lambda c: (c[0] - cx) ** 2 + (c[1] - cy) ** 2)
                row["fixture"].append(
                    {"afterSteps": list(walked), "x": x, "y": y, "expect": aid}
                )
                t0 = time.perf_counter()
                res = probe(g, x, y, cands)
                times.append((time.perf_counter() - t0) * 1000)
                total += 1
                if res.get("action") == aid:
                    hits += 1
                elif len(row["misses"]) < 8:
                    row["misses"].append(
                        {"want": aid, "got": res.get("action"), "at": [x, y],
                         "why": res.get("reason")}
                    )
                clean = clean and bool(res.get("clean"))
    except Exception as exc:
        row["error"] = f"explore: {type(exc).__name__}: {exc}"

    row["statesWithAClickableDirection"] = states
    row["roundTrip"] = f"{hits}/{total}"
    row["clean"] = clean
    row["msPerProbe"] = round(sum(times) / len(times), 1) if times else None

    # A click on a cell nothing moves must do NOTHING. -9999 is off every board.
    row["rejectsFarClick"] = probe(g, -9999, -9999, cands).get("action") is None

    # Differential non-mutation: REPLAY the exact walk the probe just ran against, once
    # clean and once with two probes fired before every step. The walk is replayed rather
    # than re-derived so this covers the same states the round-trip covered -- including
    # the coordinate clicks, which is the only way the g009 and g013 boards move at all.
    # Anything the probe leaks shows up as a divergence in the board, the score, the state,
    # the action counter, the undo depth or the last action.
    try:
        from arcengine import ActionInput, GameAction

        def replay(inst_g: dict, with_probes: bool) -> None:
            for entry_ in walked:
                if with_probes:
                    probe(inst_g, 0, 0, cands)
                    probe(inst_g, 12, 12, cands)
                if entry_[0] == "dir":
                    step(inst_g, entry_[1])
                else:
                    inst_g["_undo_stack"].append(
                        (copy.deepcopy(inst_g["_game_instance"]),
                         copy.deepcopy(inst_g["_frame_data"]),
                         inst_g["_action_counter"], inst_g["_last_action"])
                    )
                    inst_g["_frame_data"] = inst_g["_game_instance"].perform_action(
                        ActionInput(id=GameAction.ACTION6,
                                    data={"x": entry_[1], "y": entry_[2]})
                    )
                    inst_g["_action_counter"] += 1
                    inst_g["_last_action"] = "ACTION6"

        if walked:
            ctrl = boot(game_id)
            replay(ctrl, False)
            test = boot(game_id)
            replay(test, True)
            row["nonMutating"] = signature(ctrl) == signature(test)
        else:
            row["nonMutating"] = "no-moves"
        row["replayedSteps"] = len(walked)
    except Exception as exc:
        row["nonMutating"] = f"error: {type(exc).__name__}: {exc}"

    return row


def main() -> int:
    global ALL_CANDIDATES
    argv = sys.argv[1:]
    if "--all-candidates" in argv:
        ALL_CANDIDATES = True
        argv = [a for a in argv if a != "--all-candidates"]
    fixture_dir = None
    if argv and argv[0] == "--fixture":
        fixture_dir = Path(argv[1])
        argv = argv[2:]
    ids = argv or EXOTIC
    rows = [run_game(i) for i in ids]
    if fixture_dir is not None:
        fixture_dir.mkdir(parents=True, exist_ok=True)
        for r in rows:
            (fixture_dir / f"{r['game']}.py").write_text(bundle(r["game"]))
        (fixture_dir / "fixture.json").write_text(
            json.dumps(
                [
                    {
                        "game": r["game"],
                        "className": class_name(r["game"]),
                        "candidates": r["candidates"],
                        "probes": r["fixture"],
                    }
                    for r in rows
                ],
                indent=1,
            )
        )
        print(f"fixture written to {fixture_dir}")
    print(json.dumps([{k: v for k, v in r.items() if k != "fixture"} for r in rows], indent=1))
    print()
    hdr = (f"{'game':6} {'candidates':22} {'states':7} {'round-trip':11} {'no-excl':9} {'no-op click':11} "
           f"{'clean':6} {'non-mutating':13} {'ms/probe':9}")
    print(hdr)
    print("-" * len(hdr))
    for r in rows:
        print(
            f"{r['game']:6} {str(r['candidates']):22} "
            f"{r['statesWithAClickableDirection']:<7} {r['roundTrip']:11} "
            f"{r['noExclusiveCell']:<9} "
            f"{str(r['rejectsFarClick']):11} {str(r['clean']):6} "
            f"{str(r['nonMutating']):13} {str(r['msPerProbe']):9}"
            + (f"  ERROR {r['error']}" if r["error"] else "")
        )
    bad = [
        r for r in rows
        if r["error"] or not r["clean"] or r["rejectsFarClick"] is not True
        or r["nonMutating"] not in (True, "no-moves")
        or r["roundTrip"].split("/")[0] != r["roundTrip"].split("/")[1]
    ]
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
