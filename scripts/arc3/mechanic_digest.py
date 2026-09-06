"""
Author: Claude Opus 5 / Codex
Date: 05-September-2026
PURPOSE: Derive a per-game mechanic digest for every published ARC-AGI-3 task in
server/data/arc3-games/, so a reviewer can audit what a task IS without playing it blind
or asking its author. Recognizes both enum-based authored games and numeric-dispatch
contributed games. Emits the structural facts that are decidable from source --
available actions, whether ACTION6 is a spatial click or a plain button, the action->
meaning table where the source states one, board geometry, level count -- into
server/data/arc3-games/mechanics.json, which the unlisted guide page and the play page's
post-feedback reveal both read.

WHY DERIVED AND NOT WRITTEN DOWN. The list this replaces was a Discord message. A message
is right on the day it is sent and silently wrong after the next generation batch; these
facts live in the source and can be re-derived on demand. The one field a machine cannot
produce -- a sentence saying what the task is FOR -- is carried separately in
mechanics-notes.json and merged in, so re-running this never overwrites human prose.

THE FACT THIS EXISTS FOR. ACTION6 means two unrelated things across the set: a click at a
coordinate, and a button meaning "I am finished". Which one a task uses decides whether it
is playable with a mouse, and it is not visible from outside the game -- available_actions
reports 6 either way. The rule here is that a task is an xy-click task when a function
that tests self.action.id against GameAction.ACTION6 ALSO reads data["x"]/data["y"]. It
is checked against an independent classification: see EXPECTED_ACTION6 and --selftest.

NOT A SECOND LEGIBILITY GATE. scripts/arc3/legibility_gate.py owns the win/lose verdict
and is byte-identical by contract with the authoring repo's copy -- README-legibility.md
records the expected shasum. This file must never be folded into it or vice versa. Where a
verdict is wanted it is JOINED from server/services/arc3Mirror/arc3Triage.json, which is
where the gate's output already lives, rather than recomputed here.

SRP/DRY check: Pass -- extraction only. Writes one JSON file, renders nothing, and knows
about no individual game beyond the self-test's expectations.
"""

from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GAMES_DIR = REPO / "server" / "data" / "arc3-games"
TRIAGE = REPO / "server" / "services" / "arc3Mirror" / "arc3Triage.json"
OUT = GAMES_DIR / "mechanics.json"
NOTES = GAMES_DIR / "mechanics-notes.json"
CONTRIBUTED_NOTES = GAMES_DIR / "mechanics-contributed-notes.json"
CATEGORIES = GAMES_DIR / "categories.json"

# The independent classification this extractor has to reproduce before its output can be
# trusted: the nine xy-click tasks and the three that take ACTION6 as a plain button,
# identified by hand from the authoring side. If a rule change breaks this, the rule is
# wrong -- every prose note downstream is written against these facts.
EXPECTED_ACTION6 = {
    "xy-click": {
        "g038", "g034", "g009", "g005",
        "g023", "g013", "g006", "g020", "g042",
    },
    "button": {"g015", "g019", "g025"},
}

# Module-level names worth reporting as board geometry, in the spellings the set uses.
GEOMETRY_NAMES = ("FRAME", "CELL", "N", "ROWS", "COLS", "BOARD", "OX", "OY", "SIZE")

# arcengine/base_game.py:54 -- what a game advertises when it declares nothing. Only 18 of
# the 50 declare, so the other 32 advertise ACTION6 whether or not they read it, and a
# player is offered a click that the game will accept and ignore. That is the engine's
# behaviour and not ours to override on the play surface, but it is exactly the kind of
# thing a reviewer needs told: see `action6Advertised` below, which names it per game.
ENGINE_DEFAULT_ACTIONS = [1, 2, 3, 4, 5, 6]


def action_ids(node: ast.AST) -> set[int]:
    """Every GameAction.ACTIONn referenced anywhere under `node`."""
    found: set[int] = set()
    for sub in ast.walk(node):
        if (
            isinstance(sub, ast.Attribute)
            and isinstance(sub.value, ast.Name)
            and sub.value.id == "GameAction"
            and sub.attr.startswith("ACTION")
            and sub.attr[6:].isdigit()
        ):
            found.add(int(sub.attr[6:]))
    return found


def attribute_chain(node: ast.AST) -> tuple[str, ...]:
    """Return a dotted name as parts, or an empty tuple for any other expression."""
    if isinstance(node, ast.Name):
        return (node.id,)
    if isinstance(node, ast.Attribute):
        parent = attribute_chain(node.value)
        return (*parent, node.attr) if parent else ()
    return ()


def reads_action_id(node: ast.AST) -> bool:
    """True when code reads `self.action.id` (with or without its `.value`)."""
    return any(
        attribute_chain(sub)[:3] == ("self", "action", "id")
        for sub in ast.walk(node)
        if isinstance(sub, ast.Attribute)
    )


def reads_coordinates(node: ast.AST) -> bool:
    """True when `node` reads an "x" or "y" key off an action's data payload.

    Both spellings the set uses are accepted -- data.get("x", -1) and data["x"] -- and the
    subscript/call target is not required to be literally `self.action.data`, because some
    games bind it first (`d = self.action.data`). The key name plus a `data` somewhere in
    the attribute chain is specific enough: no game in the set reads an "x" key off
    anything else.
    """
    for sub in ast.walk(node):
        key = None
        target = None
        if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Attribute) and sub.func.attr == "get":
            if sub.args and isinstance(sub.args[0], ast.Constant):
                key, target = sub.args[0].value, sub.func.value
        elif isinstance(sub, ast.Subscript) and isinstance(sub.slice, ast.Constant):
            key, target = sub.slice.value, sub.value
        if key not in ("x", "y"):
            continue
        chain = ast.dump(target) if target is not None else ""
        if "data" in chain or "action" in chain:
            return True
    return False


def classify_action6(tree: ast.AST, referenced: set[int] | None = None) -> str | None:
    """'xy-click', 'button', or None when the game never mentions ACTION6.

    Function-scoped rather than module-wide: a game that reads coordinates in an unrelated
    helper must not be counted as a click game because ACTION6 appears elsewhere in the
    file. The two have to meet in one function body.
    """
    known = referenced or action_ids(tree)
    mentions = False
    for fn in ast.walk(tree):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if 6 not in action_ids(fn) and not (6 in known and reads_action_id(fn)):
            continue
        mentions = True
        if reads_coordinates(fn):
            return "xy-click"
    if 6 in known:
        # Referenced outside any function (a module-level dispatch table). Fall back to a
        # module-wide coordinate read rather than reporting nothing.
        mentions = True
        if reads_coordinates(tree):
            return "xy-click"
    return "button" if mentions else None


def const_env(tree: ast.Module) -> dict[str, int]:
    """Module-level integer constants, resolved in source order.

    A tiny evaluator rather than literal_eval because the geometry is written as
    arithmetic over earlier constants -- OX = (FRAME - COLS * CELL) // 2 -- and the
    resolved number is the useful one.
    """
    env: dict[str, int] = {}

    def value(node: ast.AST) -> int | None:
        if isinstance(node, ast.Constant) and isinstance(node.value, int) and not isinstance(node.value, bool):
            return node.value
        if isinstance(node, ast.Name):
            return env.get(node.id)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            inner = value(node.operand)
            return None if inner is None else -inner
        if isinstance(node, ast.BinOp):
            a, b = value(node.left), value(node.right)
            if a is None or b is None:
                return None
            try:
                if isinstance(node.op, ast.Add): return a + b
                if isinstance(node.op, ast.Sub): return a - b
                if isinstance(node.op, ast.Mult): return a * b
                if isinstance(node.op, ast.FloorDiv): return a // b
            except ZeroDivisionError:
                return None
        return None

    for stmt in tree.body:
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
            got = value(stmt.value)
            if got is not None:
                env[stmt.targets[0].id] = got
    return env


def kwarg_literal(tree: ast.AST, name: str):
    """The first literal value passed as `name=` anywhere in the module."""
    for sub in ast.walk(tree):
        if not isinstance(sub, ast.Call):
            continue
        for kw in sub.keywords:
            if kw.arg == name:
                try:
                    return ast.literal_eval(kw.value)
                except (ValueError, TypeError, SyntaxError):
                    return None
    return None


def assignment_nodes(tree: ast.Module) -> dict[str, ast.AST]:
    """Module-level values available to the small static evaluator below."""
    values: dict[str, ast.AST] = {}
    for stmt in tree.body:
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
            values[stmt.targets[0].id] = stmt.value
    return values


def static_literal(node: ast.AST, env: dict[str, ast.AST], seen: set[str] | None = None):
    """Evaluate container literals and simple `list(NAME)` wrappers without executing code."""
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError, SyntaxError):
        pass
    if isinstance(node, ast.Name):
        visited = seen or set()
        if node.id in visited or node.id not in env:
            return None
        return static_literal(env[node.id], env, visited | {node.id})
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in {"list", "tuple", "set"}
        and len(node.args) == 1
        and not node.keywords
    ):
        value = static_literal(node.args[0], env, seen)
        if value is None:
            return None
        return {"list": list, "tuple": tuple, "set": set}[node.func.id](value)
    return None


def declared_actions(tree: ast.Module) -> list[int] | None:
    """Resolve available actions from keyword or ARCBaseGame's sixth positional argument."""
    env = assignment_nodes(tree)
    for sub in ast.walk(tree):
        if not isinstance(sub, ast.Call):
            continue
        candidates = [kw.value for kw in sub.keywords if kw.arg == "available_actions"]
        # ARCBaseGame.__init__(game_id, levels, camera, ..., win_levels, available_actions)
        if (
            isinstance(sub.func, ast.Attribute)
            and sub.func.attr == "__init__"
            and isinstance(sub.func.value, ast.Call)
            and isinstance(sub.func.value.func, ast.Name)
            and sub.func.value.func.id == "super"
            and len(sub.args) >= 6
        ):
            candidates.append(sub.args[5])
        for candidate in candidates:
            value = static_literal(candidate, env)
            if isinstance(value, (list, tuple, set)) and all(
                isinstance(item, int) and not isinstance(item, bool) for item in value
            ):
                return sorted(set(value))
    return None


def action_labels(tree: ast.AST) -> dict[str, str]:
    """Action -> meaning, where the source states one as a dict literal.

    Several games map GameAction.ACTIONn to a direction string ({ACTION1: "U", ...}). That
    mapping is the author's own description of the control and is worth surfacing verbatim;
    games that dispatch with if/elif state nothing here and get an empty table.
    """
    labels: dict[str, str] = {}
    for sub in ast.walk(tree):
        if not isinstance(sub, ast.Dict):
            continue
        for key, val in zip(sub.keys, sub.values):
            if not (isinstance(key, ast.Attribute) and isinstance(key.value, ast.Name)
                    and key.value.id == "GameAction" and key.attr.startswith("ACTION")):
                continue
            if isinstance(val, ast.Constant) and isinstance(val.value, (str, int)):
                labels[key.attr] = str(val.value)
    return labels


def sequence_length(node: ast.AST, env: dict[str, ast.AST], seen: set[str] | None = None) -> int | None:
    """Resolve only a static sequence's length; its elements need not be literals."""
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return len(node.elts)
    if isinstance(node, ast.Name):
        visited = seen or set()
        if node.id in visited or node.id not in env:
            return None
        return sequence_length(env[node.id], env, visited | {node.id})
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in {"enumerate", "list", "tuple", "set"}
        and node.args
    ):
        return sequence_length(node.args[0], env, seen)
    return None


def appends_to(node: ast.AST, name: str) -> bool:
    """True when a block appends one item to a named list."""
    return any(
        isinstance(sub, ast.Call)
        and isinstance(sub.func, ast.Attribute)
        and sub.func.attr == "append"
        and isinstance(sub.func.value, ast.Name)
        and sub.func.value.id == name
        for sub in ast.walk(node)
    )


def level_count(tree: ast.Module) -> int | None:
    env = assignment_nodes(tree)
    functions = {
        stmt.name: stmt for stmt in tree.body
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    for stmt in tree.body:
        if (isinstance(stmt, ast.Assign) and len(stmt.targets) == 1
                and isinstance(stmt.targets[0], ast.Name)
                and stmt.targets[0].id in {"LEVELS", "LEVELS_SPEC"}
        ):
            direct = sequence_length(stmt.value, env)
            if direct:
                return direct
            if isinstance(stmt.value, ast.Call) and isinstance(stmt.value.func, ast.Name):
                builder = functions.get(stmt.value.func.id)
                if builder is not None:
                    for loop in builder.body:
                        if isinstance(loop, (ast.For, ast.AsyncFor)) and appends_to(loop, "levels"):
                            inferred = sequence_length(loop.iter, env)
                            if inferred is not None:
                                return inferred
            # Some modules build `LEVELS = []` in one top-level pass over RAW_LEVELS.
            for loop in tree.body:
                if isinstance(loop, (ast.For, ast.AsyncFor)) and appends_to(loop, "LEVELS"):
                    inferred = sequence_length(loop.iter, env)
                    if inferred is not None:
                        return inferred
    return None


def digest(path: Path, manifest_row: dict) -> dict:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    env = const_env(tree)
    declared = declared_actions(tree)
    effective = declared if declared is not None else list(ENGINE_DEFAULT_ACTIONS)
    referenced = action_ids(tree)
    # Contributed games intentionally keep engine enums out of their pure transition
    # functions. Their step method reads one numeric action id and routes it through a
    # declared domain. That is a real read of the whole declared domain, not an empty game.
    if (
        manifest_row.get("category") == "contributed-glowup"
        and declared is not None
        and reads_action_id(tree)
    ):
        referenced.update(declared)
    action6 = classify_action6(tree, referenced)
    return {
        "gameId": path.stem,
        "className": manifest_row.get("class_name"),
        "availableActions": effective,
        "availableActionsSource": "declared" if declared is not None else "engine-default",
        "actionsReferenced": sorted(referenced),
        "action6": action6,
        # The player is OFFERED a click but the game reads nothing. Not a bug in the game
        # -- it simply never narrowed the default -- but it is the difference between "this
        # task ignores your click" and "you clicked the wrong cell", which is otherwise
        # indistinguishable from the player's chair.
        "action6Advertised": 6 in effective,
        "action6Inert": 6 in effective and action6 is None,
        "actionLabels": action_labels(tree),
        "geometry": {k: env[k] for k in GEOMETRY_NAMES if k in env},
        "levels": level_count(tree),
        "winLevels": kwarg_literal(tree, "win_levels"),
        "callsLose": any(
            isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "lose"
            for n in ast.walk(tree)
        ),
        "sourceLines": len(path.read_text(encoding="utf-8").splitlines()),
    }


def triage_index() -> dict[str, dict]:
    if not TRIAGE.exists():
        return {}
    rows = json.loads(TRIAGE.read_text(encoding="utf-8")).get("games", [])
    return {r["gameId"]: r for r in rows if isinstance(r, dict) and "gameId" in r}


def build() -> list[dict]:
    manifest = json.loads((GAMES_DIR / "manifest.json").read_text(encoding="utf-8"))
    triage = triage_index()
    notes = json.loads(NOTES.read_text(encoding="utf-8")) if NOTES.exists() else {}
    if CONTRIBUTED_NOTES.exists():
        notes.update(json.loads(CONTRIBUTED_NOTES.read_text(encoding="utf-8")))
    # The kind of game -- "Timing / Cycles", "Environmental Manipulation". Human-edited,
    # like the prose, because nothing here can tell one from the other by reading source.
    # It was written for docs/arc3-games-registry.md and reached nothing else; merging it
    # in means the API serves it too, rather than every consumer re-reading the file.
    categories = json.loads(CATEGORIES.read_text(encoding="utf-8")) if CATEGORIES.exists() else {}
    out = []
    for row in manifest:
        path = GAMES_DIR / row["src_file"]
        if not path.exists():
            print(f"  ! missing source for {row['id']}: {row['src_file']}", file=sys.stderr)
            continue
        entry = digest(path, row)
        t = triage.get(entry["gameId"], {})
        entry["triage"] = {"status": t.get("status"), "rank": t.get("rank")} if t else None
        note = notes.get(entry["gameId"]) or {}
        entry["mechanic"] = note.get("mechanic")
        entry["controls"] = note.get("controls")
        entry["goal"] = note.get("goal")
        entry["category"] = categories.get(entry["gameId"]) or row.get("category")
        out.append(entry)
    return out


# Which action id each phrase in the prose is claiming the game uses. The prose is the
# only unverified half of this file's output and "Controls" is the half a reviewer ACTS on
# -- a note that says d-pad only, on a game that also reads ACTION5, sends them down a
# blind alley and they have no reason to doubt it. These are checked against
# actionsReferenced, which is derived, so the prose cannot drift from the source.
CONTROL_CLAIMS = {
    "action5": 5,
    "action6": 6,
    "action7": 7,
}


def check_prose(entries: list[dict]) -> list[str]:
    """Cross-validate each note's control claims against the actions the source reads."""
    problems: list[str] = []
    for e in entries:
        controls = (e.get("controls") or "").lower()
        if not controls:
            continue
        used = set(e["actionsReferenced"])

        # "D-pad only" / "Nothing else is used" is a claim that NOTHING beyond 1-4 is read.
        if "d-pad only" in controls or "nothing else is used" in controls:
            extra = sorted(used - {1, 2, 3, 4})
            if extra:
                problems.append(
                    f'{e["gameId"]}: controls say d-pad only, but the source also reads {extra}'
                )

        # An action the prose names by number must actually be read by the game.
        for phrase, action in CONTROL_CLAIMS.items():
            if phrase in controls and action not in used:
                problems.append(
                    f'{e["gameId"]}: controls mention ACTION{action}, which the source never reads'
                )

        # A note that tells the player to click must be on a game whose click carries
        # coordinates -- otherwise it is telling them to do the one thing that does nothing.
        if "click a cell" in controls or "click a gate" in controls or "click your own" in controls:
            if e["action6"] != "xy-click":
                problems.append(
                    f'{e["gameId"]}: controls tell the player to click a cell, but action6 is {e["action6"]}'
                )
    return problems


def selftest(entries: list[dict]) -> int:
    got_xy = {e["gameId"] for e in entries if e["action6"] == "xy-click"}
    got_btn = {e["gameId"] for e in entries if e["action6"] == "button"}
    ok = True
    legacy_ids = {f"g{i:03d}" for i in range(50)}
    for label, expected, got in (
        ("xy-click", EXPECTED_ACTION6["xy-click"], got_xy & legacy_ids),
        ("button", EXPECTED_ACTION6["button"], got_btn & legacy_ids),
    ):
        if expected != got:
            ok = False
            print(f"FAIL {label}: missing {sorted(expected - got)}, unexpected {sorted(got - expected)}")
        else:
            print(f"ok   {label}: {len(got)} games, exactly as expected")
    missing_actions = [e["gameId"] for e in entries if not e["availableActions"]]
    if missing_actions:
        ok = False
        print(f"FAIL no action list resolved for: {missing_actions}")
    else:
        declared = sum(1 for e in entries if e["availableActionsSource"] == "declared")
        print(f"ok   action list resolved for all {len(entries)} games "
              f"({declared} declared, {len(entries) - declared} on the engine default)")

    # An xy-click game that does not advertise 6 would be unreachable by any player: the
    # console refuses an action the frame does not list, so the click never leaves the UI.
    unreachable = [e["gameId"] for e in entries if e["action6"] == "xy-click" and not e["action6Advertised"]]
    if unreachable:
        ok = False
        print(f"FAIL xy-click games that never advertise ACTION6: {unreachable}")
    else:
        print("ok   every xy-click game advertises ACTION6")

    missing_prose = [e["gameId"] for e in entries if not e["mechanic"]]
    if missing_prose:
        ok = False
        print(f"FAIL no prose for: {missing_prose}")
    else:
        print(f"ok   prose present for all {len(entries)} games")

    problems = check_prose(entries)
    if problems:
        ok = False
        print(f"FAIL prose contradicts the source in {len(problems)} place(s):")
        for line in problems:
            print(f"       {line}")
    else:
        print("ok   every note's control claims agree with the actions its source reads")

    contributed = [e for e in entries if e.get("category") == "contributed-glowup"]
    contributed_failures = [
        e["gameId"] for e in contributed
        if not e["actionsReferenced"]
        or e["availableActionsSource"] != "declared"
        or any(not e.get(field) for field in ("mechanic", "controls", "goal"))
        or (6 in e["actionsReferenced"] and e["action6"] not in {"button", "xy-click"})
        or not isinstance(e["levels"], int)
        or not 7 <= e["levels"] <= 12
    ]
    if contributed_failures:
        ok = False
        print("FAIL contributed games without usable controls and explanation: "
              f"{contributed_failures}")
    else:
        print(f"ok   all {len(contributed)} contributed games expose controls and explanation")

    inert = [e["gameId"] for e in entries if e["action6Inert"]]
    print(f"note {len(inert)} games advertise ACTION6 and read nothing from it")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true", help=f"write {OUT.relative_to(REPO)}")
    ap.add_argument("--selftest", action="store_true", help="check against EXPECTED_ACTION6 and exit")
    args = ap.parse_args()

    entries = build()
    if args.selftest:
        return selftest(entries)
    if args.write:
        OUT.write_text(json.dumps(entries, indent=1) + "\n", encoding="utf-8")
        described = sum(1 for e in entries if e["mechanic"])
        print(f"wrote {OUT.relative_to(REPO)}: {len(entries)} games, {described} with prose")
        return 0
    print(json.dumps(entries, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
