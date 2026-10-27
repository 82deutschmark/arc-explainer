"""fq27

Author: Claude Opus 5, 19-September-2026; colour pass by Claude Opus 5.5 High, 20-October-2026.
Date: 20-October-2026
PURPOSE: an evolution-loop glow-up. You pilot a river skiff at dusk by calling helm orders that the
helmsman carries out a fixed number of turns later. Every key press is one turn: the new call is hung
on the signal mast, every call drops one peg, and the call that reaches the ship's wheel is carried
out. An arrow sets the course (the skiff turns and keeps sailing that way); Space keeps the course.
A sailing hull moves one cell a turn until a bank, rock, shut bridge or boom stops it. Flowing water
then carries the skiff one cell. Calls run late, so every turn must be called early.

Nine levels: 1 a winding still channel (the lag alone), 2 a shallow ford across a moving river (call turns early),
3 flowing gaps in the shallows (a crossing drops you a row per lane), 4 ford and glide together,
5 a swing bridge open one turn in four, 6 two spans on two counts, 7 a barge that hears the same calls
but is too heavy for the current, and a passenger whose boarding lifts the harbour boom, 8 a long reach
of river with all of it, 9 the harbour, both hulls, at a three-turn lag.
The camera follows the hulls along the river; the queue hangs on the signal mast at the right edge.
SRP/DRY check: Pass -- one self-contained game; the rules functions are shared by the game, Son's generator and its
  solver, and the pictures only show what advance() decided.

CHANGELOG
- 20-Oct-2026 (later), Claude Opus 5.5 High: level one is a winding still channel with four bends instead of an open
  cove. The cove was won in seven presses, under the vet gate's level-one length; the shortest win is now sixteen.
  The Boss lifted the no-gameplay-change rule for this batch. Levels two to nine and every rule are untouched.
- 20-Oct-2026, Claude Opus 5.5 High: colour pass for the Boss ("too much pink ... we really need a variety of
  colors"). Banks are green, flowing water blue, still shallows pale blue, current streaks and wake white foam, the
  skiff an orange hull whose cabin window lights yellow when the passenger is aboard, the barge purple, the berth
  lantern a lit yellow lamp, planks and crane orange and black, the mast black with yellow call flags and an orange
  wheel. Pink, red and maroon are kept only for what stops a hull: rocks, the shut span, the shut boom and a shut
  bridge's lamps. Colours only: every shape, sprite, layer, animation, level, rule and input was untouched.
"""

import numpy as np

from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, Level, Sprite

# ── Palette (dusk river: green banks, blue water, a warm hull, lit lamps; pink, red and maroon only on what
# stops a hull: rocks, the shut span, the shut boom, a shut bridge's lamps) ─────────────────────────────
MAROON, PURPLE, MAGENTA, PINK, RED = 13, 15, 6, 7, 8
WHITE, LIGHT_GREY, BLACK, BLUE, PALE_BLUE, YELLOW, ORANGE, GREEN = 0, 1, 5, 9, 10, 11, 12, 14
CLEAR = -1

CELL = 5  # world pixels per river cell
VIEW_W = 55  # the river view is screen x 0..54; the signal mast panel covers x 55..63
PANEL_X = 55

DIRS = {"N": (0, -1), "S": (0, 1), "W": (-1, 0), "E": (1, 0)}
FLOW = {"^": "N", "v": "S", "<": "W", ">": "E"}
KEY_ORDER = {1: "N", 2: "S", 3: "W", 4: "E", 5: "K"}  # arrows set the course, Space keeps it
TURN_CW = {"N": "E", "E": "S", "S": "W", "W": "N"}

# ── Levels ──────────────────────────────────────────────────────────────────────────────────────────
# '#' bank, '%' rock, '.' still water (shallows), '^ v < >' flowing water, 'B' skiff start, 'T' barge start,
# 'D' the skiff's jetty berth, 'Q' the barge's quay, 'P' the passenger's pier, '1'-'3' swing-bridge spans.
# "flow" gives flowing water under a start, pier or span cell; "cycles" gives each bridge
# (period, turns open, phase); "heads" gives starting headings.

LEVELS = [
    # mooring: a winding still channel (20-Oct-2026: the old open cove was won in seven presses, under the gate's
    # level-one length; four bends now each need the call made early)
    {"name": "mooring", "delay": 2, "heads": {"B": "E"}, "rows": [
        "##########",
        "#B...#####",
        "####.#####",
        "#....#####",
        "#.########",
        "#....D####",
        "##########",
    ]},
    {"name": "ford", "delay": 2, "heads": {"B": "E"}, "rows": [
        "###########",
        "#vvvvvvvv##",
        "#vvvvvv..D#",
        "#vvvvvv.vv#",
        "#vvv....vv#",
        "#vvv.vvvvv#",
        "#vvv.vvvvv#",
        "#.B..vvvvv#",
        "#^vvvvvvvv#",
        "#^vvvvvvvv#",
        "#^<<<<<<<<#",
        "###########",
    ]},
    {"name": "ferry", "delay": 2, "heads": {"B": "N"}, "rows": [
        "###########",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#v.vvvvvvv#",
        "#v.vvvvvvv#",
        "#v.vvvvv.D#",
        "#v.vvvvv.v#",
        "#v.vv.vv.v#",
        "#v.vv.vv.v#",
        "#v.vvvvv.v#",
        "#.Bvvvvvvv#",
        "#^vvvvvvvv#",
        "#^<<<<<<<<#",
        "###########",
    ]},
    # shoals
    {"name": "shoals", "delay": 2, "heads": {'B': 'E'}, "rows": [
        "###########",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvv.D#",
        "#vvvvv...v#",
        "#vvvvv.vvv#",
        "#v.vvv.vvv#",
        "#v.vvv.vvv#",
        "#v.vvv.vvv#",
        "#v..vv.vvv#",
        "#vv.vvvvvv#",
        "#.B.vvvvvv#",
        "#^<<<<<<<<#",
        "###########",
    ]},
    # swing bridge
    {"name": "swing bridge", "delay": 2, "heads": {'B': 'E'}, "cycles": {1: (4, 1, 0)}, "rows": [
        "###########",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvD#",
        "#vvvvvvvv.#",
        "#vvvvvvvv.#",
        "#vvv.vvv..#",
        "#vvv.vv%.v#",
        "#vvv.vv1.v#",
        "#vvv.vv%vv#",
        "#vvv.vvvvv#",
        "#vvv.vvvvv#",
        "#vv..vvvvv#",
        "#vv.vvvvvv#",
        "#.B.vvvvvv#",
        "#^<<<<<<<<#",
        "###########",
    ]},
    # two bridges
    {"name": "two bridges", "delay": 2, "heads": {'B': 'E'}, "cycles": {1: (4, 1, 2), 2: (3, 1, 2)}, "flow": {(5, 10): 'E', (8, 11): 'E'}, "rows": [
        "############",
        "#vvvvvvvvvv#",
        "#vvvvvvvvvv#",
        "#vvvvvvvvvv#",
        "#vvvvvvvvvv#",
        "#vvvvvvvvvv#",
        "#vvvv%vvvvv#",
        "#vvvv%vv%vD#",
        "#v.vv%vv%v.#",
        "#v.vv%vv%v.#",
        "#v.vv1vv%..#",
        "#v.vv%vv2.v#",
        "#v.vv%vv%vv#",
        "#v.vv%vv%vv#",
        "#v.vvvvv%vv#",
        "#v..vvvvvvv#",
        "#vv.vvvvvvv#",
        "#.B.vvvvvvv#",
        "#^<<<<<<<<<#",
        "############",
    ]},
    # barge and passenger
    {"name": "barge and passenger", "delay": 2, "heads": {'B': 'E', 'T': 'E'}, "rows": [
        "############",
        "#vvvvvvvQ#v#",
        "#v#vvvvv.vv#",
        "#v.vvvvv.#v#",
        "#v.vvvvv.P##",
        "#vTvvvvv.#v#",
        "#v.vvvvv.vv#",
        "#v.vvvvv.vv#",
        "#vBvvvvv.vv#",
        "#v.vvvvv.vv#",
        "#v.vvvvv.vv#",
        "#^.vvvvvvvv#",
        "#^..vvvvvvv#",
        "#^v..vvvvvv#",
        "#^vv.D#vvvv#",
        "#^<<<<<<<<<#",
        "############",
    ]},
    # night river
    {"name": "night river", "delay": 3, "heads": {'B': 'E'}, "cycles": {1: (4, 1, 0)}, "rows": [
        "###########",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "#vvvvvvvvv#",
        "##vvvvvvvv#",
        "##vvvvv.vv#",
        "##vvvvv.vv#",
        "#Dvvvvv.vv#",
        "#.vvvvv.vv#",
        "#.vvvvv.vv#",
        "#1vvvvv.vv#",
        "#%vvvvv.vv#",
        "#vvvvvv.P##",
        "#vvvvvv.vv#",
        "#vvvvvv.vv#",
        "#vvvvvv.vv#",
        "#vvvvvv.vv#",
        "#vvvvv..vv#",
        "#vvv...vvv#",
        "#vvv.vvvvv#",
        "#.B..vvvvv#",
        "#^vvvvvvvv#",
        "#^<<<<<<<<#",
        "###########",
    ]},
    # harbour
    {"name": "harbour", "delay": 3, "heads": {'B': 'E', 'T': 'E'}, "cycles": {1: (4, 1, 2)}, "rows": [
        "############",
        "#vvvvvvvQ#v#",
        "#v#vvvvv.###",
        "#v.vvvvv.P##",
        "#v.vvvvv.###",
        "#vTvvvvv.vv#",
        "#v.vvvvv.vv#",
        "#v.vvvvv.vv#",
        "#vBvvvvv.vv#",
        "#v.vvvvv.vv#",
        "#v%vvvvv.vv#",
        "#^v.%vvvvvv#",
        "#^v..%%vvvv#",
        "#^vv.1.%vvv#",
        "#^vvv%..%vv#",
        "#^vvvvv.D#v#",
        "#^vvvvvv##v#",
        "#^<<<<<<<<<#",
        "############",
    ]},
]

# ── Rules (pure: the game, the solver and the tests share them) ────────────────────────────────────


def chart(spec: dict) -> dict:
    """Static facts about a level."""
    rows = spec["rows"]
    ch = {"rows": rows, "w": len(rows[0]), "h": len(rows), "delay": spec["delay"], "hulls": [], "berths": set(),
          "quays": set(), "pickups": set(), "bridges": {}, "flow": {}, "water": set(), "rocks": set()}
    heads = spec.get("heads", {})
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            cell = (x, y)
            if c in FLOW:
                ch["flow"][cell] = FLOW[c]
            if c in "^v<>.BTDQP123":
                ch["water"].add(cell)
            if c == "%":
                ch["rocks"].add(cell)
            elif c in "BT":
                ch["hulls"].append(("skiff" if c == "B" else "barge", x, y, heads.get(c, "E")))
            elif c == "D":
                ch["berths"].add(cell)
            elif c == "Q":
                ch["quays"].add(cell)
            elif c == "P":
                ch["pickups"].add(cell)
            elif c in "123":
                ch["bridges"][cell] = int(c)
    for (x, y), f in spec.get("flow", {}).items():
        ch["flow"][(x, y)] = f
    ch["cycles"] = {int(k): v for k, v in spec.get("cycles", {}).items()}
    ch["need_pickup"] = bool(ch["pickups"])
    ch["hulls"].sort(key=lambda h: h[0] != "skiff")  # the skiff always resolves first
    return ch


def start_state(ch: dict) -> tuple:
    """(hulls, queued calls oldest first, turn count, passenger aboard). A hull is (x, y, heading, sailing, moored)."""
    hulls = tuple((x, y, h, False, False) for (_, x, y, h) in ch["hulls"])
    return (hulls, (None,) * ch["delay"], 0, False)


def bridge_open(ch: dict, bridge: int, t: int) -> bool:
    period, open_len, phase = ch["cycles"][bridge]
    return (t + phase) % period < open_len


def passable(ch: dict, cell: tuple, t: int, occupied: set, picked: bool) -> bool:
    if cell not in ch["water"] or cell in occupied:
        return False
    if cell in ch["berths"] and ch["need_pickup"] and not picked:
        return False  # the boom across the berth stays shut until the passenger is aboard
    b = ch["bridges"].get(cell)
    return b is None or bridge_open(ch, b, t)


def advance(ch: dict, state: tuple, order: str) -> tuple:
    """One turn. The new call joins the back of the queue and the oldest call is carried out: an arrow turns
    every free hull to that heading and sets it sailing, Space changes nothing. Each sailing hull moves one cell
    (a bank, rock, shut bridge, shut boom or the other hull stops it). Then flowing water carries the skiff one
    cell. Returns (new state, what happened)."""
    hulls, queue, t, picked = state
    due, queue = queue[0], queue[1:] + (order,)
    kinds = [k for (k, *_r) in ch["hulls"]]
    new = list(hulls)
    info = {"due": due, "t": t, "hulls": [], "picked_now": False, "won": False}
    for i, (x, y, h, sailing, moored) in enumerate(hulls):
        ev = {"kind": kinds[i], "from": (x, y), "h0": h, "h1": h, "sail": None, "drift": None, "moored": moored,
              "moored_now": False}
        if moored:
            info["hulls"].append(ev)
            continue
        if due in DIRS:
            h, sailing = due, True
        ev["h1"] = h
        occupied = {(hx, hy) for j, (hx, hy, *_r) in enumerate(new) if j != i}
        if sailing:
            dx, dy = DIRS[h]
            target = (x + dx, y + dy)
            if passable(ch, target, t, occupied, picked):
                ev["sail"] = ("move", (x, y), target)
                x, y = target
            else:
                ev["sail"] = ("bump", (x, y), target)
                sailing = False
        if kinds[i] == "skiff" and (x, y) not in ch["berths"]:
            f = ch["flow"].get((x, y))
            if f:
                dx, dy = DIRS[f]
                target = (x + dx, y + dy)
                if passable(ch, target, t, occupied, picked):
                    ev["drift"] = ((x, y), target)
                    x, y = target
        if kinds[i] == "skiff" and (x, y) in ch["pickups"] and not picked:
            picked = True
            info["picked_now"] = True
        if (kinds[i] == "skiff" and (x, y) in ch["berths"]) or (kinds[i] == "barge" and (x, y) in ch["quays"]):
            moored, sailing = True, False
            ev["moored"] = ev["moored_now"] = True
        new[i] = (x, y, h, sailing, moored)
        info["hulls"].append(ev)
    info["won"] = all(m for (*_r, m) in new)
    return (tuple(new), queue, t + 1, picked), info


# ── Pictures ────────────────────────────────────────────────────────────────────────────────────────

_INK = {".": CLEAR, "M": MAROON, "U": PURPLE, "G": MAGENTA, "P": PINK, "R": RED, "W": WHITE, "L": LIGHT_GREY,
        "K": BLACK, "B": BLUE, "C": PALE_BLUE, "Y": YELLOW, "O": ORANGE, "N": GREEN}


def ink(rows) -> np.ndarray:
    return np.array([[_INK[c] for c in row] for row in rows], dtype=np.int8)


def _turned(pic: np.ndarray, heading: str) -> np.ndarray:
    """Art is drawn facing east; rotate it to face the heading."""
    k = {"E": 0, "N": 1, "W": 2, "S": 3}[heading]
    return np.ascontiguousarray(np.rot90(pic, k))


SKIFF_E = ink([".....", "OOOO.", "OWKWO", "OOOO.", "....."])
SKIFF_NE = ink(["...OO", "..OWO", ".OKO.", "OWO..", "OO..."])  # the bow swinging between two headings
SKIFF_AB = ink([".....", "OOOO.", "OWYWO", "OOOO.", "....."])  # the passenger aboard lights the cabin
BARGE_E = ink([".UUU.", "UKKWU", "UKKWW", "UKKWU", ".UUU."])  # heavy hull, cargo hold, white bow light
BARGE_NE = ink(["..UWW", ".UKWW", "UKKWU", "UKKU.", ".UU.."])
ARROW_E = ink(["Y....", "YYY..", "YYYYY", "YYY..", "Y...."])
KEEP = ink([".....", ".YYY.", ".Y.Y.", ".YYY.", "....."])
WHEEL = [ink([".O.O.O.", "O..O..O", "..YYY..", "OOYKYOO", "..YYY..", "O..O..O", ".O.O.O."]),
         ink(["O..O..O", ".O.O.O.", "..YYY..", "OOYKYOO", "..YYY..", ".O.O.O.", "O..O..O"])]
ROCK = ink([".MMM.", "MRMMM", "MMMMM", "MMMMM", ".MMM."])


def hull_pixels(kind: str, heading: str, aboard: bool = False) -> np.ndarray:
    return _turned((SKIFF_AB if aboard else SKIFF_E) if kind == "skiff" else BARGE_E, heading)


def hull_swing(kind: str, h0: str, h1: str) -> np.ndarray:
    """The diagonal pose a hull passes through when its heading changes by a quarter turn."""
    base = SKIFF_NE if kind == "skiff" else BARGE_NE
    # the diagonal between h0 and h1: NE is between N and E, and so on.
    pair = {frozenset("NE"): 0, frozenset("NW"): 1, frozenset("SW"): 2, frozenset("SE"): 3}.get(frozenset((h0, h1)))
    if pair is None:  # a half turn: show the side-on pose halfway round
        return _turned(SKIFF_E if kind == "skiff" else BARGE_E, TURN_CW[h0])
    return np.ascontiguousarray(np.rot90(base, pair))


def mark_pixels(order: str) -> np.ndarray:
    return KEEP if order == "K" else _turned(ARROW_E, order)


WAKE = [ink(["W....", ".W...", "..W..", ".W...", "W...."]), ink(["C....", ".C...", "..C..", ".C...", "C...."])]
SPRAY = ink(["W.W", ".W.", "W.W"])
PASSENGER = ink([".W.", "KKK", ".K.", "K.K"])  # waiting on the pier with the berth's key lantern
LANTERN = ink([".YYY.", "YYOYY", ".YYY.", "..K..", ".KKK."])  # the berth's lantern on the bank (upright)
CRANE = ink(["WOOO.", "W..O.", "...O.", "...O.", "..OOO"])  # orange, not black: black on green read as a digit  # the barge's quay crane (upright)
PLANKS = ink(["....O", "....K", "....O", "....K", "....O"])  # jetty edge on the berth's bank side
KERB = ink(["....L", "....L", "....L", "....L", "....L"])  # stone quay edge
BOOM_SHUT = ink(["M....", "R....", "M....", "R....", "M...."])  # floating logs across the berth mouth
DECK_SHUT = ink([".....", "PPPPP", "RMRMR", "PPPPP", "....."])  # the span lies across the channel (pivot east)
DECK_SWING = ink(["....P", "...PR", "..PR.", ".PR..", "P...."])  # halfway round its pivot
PIVOT = ink([".....", ".KKK.", "KOWOK", ".KKK.", "....."])  # the turntable on the pier
NOTHING = np.full((1, 1), CLEAR, dtype=np.int8)

# Where things sit on the screen's signal mast (screen coordinates)
WHEEL_Y = 53
SLOT_Y0 = 43  # slot 0 holds the next call to be carried out; each later slot is SLOT_GAP higher
SLOT_GAP = 10
MARK_X = 57


def slot_y(k: int) -> int:
    return SLOT_Y0 - SLOT_GAP * k


def _hash(x: int, y: int, salt: int = 0) -> int:
    v = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    return (v ^ (v >> 13)) & 0xFFFF


def _sides(cell: tuple) -> dict:
    x, y = cell
    return {d: (x + dx, y + dy) for d, (dx, dy) in DIRS.items()}


def _is_water(ch: dict, cell: tuple) -> bool:
    return cell in ch["water"] or cell in ch["rocks"]


def ripple(direction: str, ncells: int, offset: int, phase: int) -> np.ndarray:
    """Flowing-water streaks for a strip of cells running along the flow. Phases 0..4 carry them one cell."""
    length = ncells * CELL
    along = np.arange(length)
    shift = phase if direction in "SE" else -phase
    pic = np.full((CELL, length), CLEAR, dtype=np.int8)  # drawn as if flowing east, then turned
    a = (along - shift + offset) % CELL
    pic[1, a <= 1] = WHITE
    pic[3, (a >= 2) & (a <= 3)] = WHITE
    if direction in "EW":
        return pic
    return np.ascontiguousarray(pic.T)


def strips_of(ch: dict) -> list:
    """Maximal runs of flowing cells that share a direction, laid along the flow."""
    seen, out = set(), []
    skip = set(ch["bridges"]) | ch["pickups"]
    for cell, f in sorted(ch["flow"].items(), key=lambda kv: (kv[0][1], kv[0][0])):
        if cell in seen or cell in skip:
            continue
        dx, dy = DIRS[f]
        head = cell
        while True:  # walk upstream to the start of the run
            prev = (head[0] - dx, head[1] - dy)
            if ch["flow"].get(prev) == f and prev not in seen and prev not in skip:
                head = prev
            else:
                break
        run, cur = [], head
        while ch["flow"].get(cur) == f and cur not in seen and cur not in skip:
            run.append(cur)
            seen.add(cur)
            cur = (cur[0] + dx, cur[1] + dy)
        out.append((f, run))
    return out


def still(ch: dict, cell: tuple) -> bool:
    return cell in ch["water"] and cell not in ch["flow"]


def terrain(ch: dict) -> tuple:
    """(water base, bank texture): still pictures of the river bed. Flowing water is blue; still shallows are
    pale blue; banks are green (the camera background) with purple reeds at the water's edge."""
    w, h = ch["w"] * CELL, ch["h"] * CELL
    water = np.full((h, w), CLEAR, dtype=np.int8)
    texture = np.full((h, w), CLEAR, dtype=np.int8)
    for y in range(ch["h"]):
        for x in range(ch["w"]):
            px, py = x * CELL, y * CELL
            if _is_water(ch, (x, y)):
                water[py:py + CELL, px:px + CELL] = PALE_BLUE if still(ch, (x, y)) else BLUE
                continue
            nb = _sides((x, y))
            wet = {d: _is_water(ch, c) for d, c in nb.items()}
            for a, b, cx, cy in (("N", "E", CELL - 1, 0), ("N", "W", 0, 0), ("S", "E", CELL - 1, CELL - 1), ("S", "W", 0, CELL - 1)):
                diag = (x + (1 if "E" in (a, b) else -1), y + (-1 if "N" in (a, b) else 1))
                if wet[a] and wet[b] and _is_water(ch, diag):  # round off a bank's outer corner
                    water[py + cy, px + cx] = PALE_BLUE if still(ch, diag) else BLUE
            for d, is_wet in wet.items():
                if not is_wet:
                    continue
                v = _hash(x, y, ord(d))
                if v % 3 == 0:
                    continue  # leave gaps so the reed line looks grown, not built
                k = 1 + (v >> 2) % 3
                tall = 1 + (v >> 5) % 2
                if d in "NS":
                    ry = py if d == "N" else py + CELL - tall
                    texture[ry:ry + tall, px + k] = PURPLE
                    if (v >> 7) % 4 == 0:
                        texture[ry, px + (k + 2) % CELL] = WHITE  # a flower among the reeds
                else:
                    rx = px if d == "W" else px + CELL - 1
                    texture[py + k:py + k + tall, rx] = PURPLE
            if not any(wet.values()) and _hash(x, y, 9) % 5 == 0:
                v = _hash(x, y, 5)
                texture[py + 1 + v % 3, px + 1 + (v >> 4) % 3] = PURPLE
    return water, texture


def _back_side(ch: dict, cell: tuple) -> str:
    """The side of a berth, pier or span that faces the bank (where planks or the pivot go)."""
    nb = _sides(cell)
    opposite = {"N": "S", "S": "N", "E": "W", "W": "E"}
    for d in "ENWS":
        if nb[d] not in ch["water"] and nb[opposite[d]] in ch["water"]:
            return d
    for d in "ENWS":
        if nb[d] not in ch["water"]:
            return d
    return "E"


OPPOSITE = {"N": "S", "S": "N", "E": "W", "W": "E"}


def build_level(index: int) -> Level:
    spec = LEVELS[index]
    ch = chart(spec)
    sprites = []

    def add(pic, name, x, y, layer, tags):
        sprites.append(Sprite(np.array(pic, dtype=np.int8), name=name, x=x, y=y, layer=layer,
                              blocking=BlockingMode.NOT_BLOCKED, tags=tags))

    water, texture = terrain(ch)
    add(water, "river", 0, 0, 0, ["water"])
    add(texture, "banks", 0, 0, 1, ["bank", "shallows"])
    strips = []
    for k, (f, run) in enumerate(strips_of(ch)):
        x0 = min(c[0] for c in run) * CELL
        y0 = min(c[1] for c in run) * CELL
        offset = _hash(run[0][0], run[0][1], 3) % CELL
        name = f"current{k}"
        add(ripple(f, len(run), offset, 0), name, x0, y0, 1, ["current", "flow-" + f])
        strips.append((name, f, len(run), offset))
    for (x, y) in sorted(ch["rocks"]):
        add(ROCK, "rock", x * CELL, y * CELL, 3, ["rock", "wall"])
    for cell in sorted(ch["berths"]):
        side = _back_side(ch, cell)
        bx, by = cell[0] + DIRS[side][0], cell[1] + DIRS[side][1]
        add(LANTERN, "lantern", bx * CELL, by * CELL, 3, ["jetty", "goal"])
        add(_turned(PLANKS, side), "berth", cell[0] * CELL, cell[1] * CELL, 3, ["berth", "goal"])
        if ch["need_pickup"]:
            add(_turned(BOOM_SHUT, side), "boom", cell[0] * CELL, cell[1] * CELL, 4, ["boom", "wall"])
    for cell in sorted(ch["quays"]):
        side = _back_side(ch, cell)
        bx, by = cell[0] + DIRS[side][0], cell[1] + DIRS[side][1]
        add(CRANE, "crane", bx * CELL, by * CELL, 3, ["quay", "goal"])
        add(_turned(KERB, side), "quay", cell[0] * CELL, cell[1] * CELL, 3, ["quay", "goal"])
    for cell in sorted(ch["pickups"]):
        side = _back_side(ch, cell)
        bx, by = cell[0] + DIRS[side][0], cell[1] + DIRS[side][1]
        add(_turned(PLANKS, side), "pier", cell[0] * CELL, cell[1] * CELL, 3, ["pier"])
        add(PASSENGER, "passenger", bx * CELL + 1, by * CELL + 1, 7, ["passenger"])
    for cell, b in sorted(ch["bridges"].items()):
        side = _back_side(ch, cell)
        px, py = cell[0] + DIRS[side][0], cell[1] + DIRS[side][1]
        add(PIVOT, f"pivot{b}", px * CELL, py * CELL, 3, ["bridge", "pivot"])
        add(NOTHING if bridge_open(ch, b, 0) else _turned(DECK_SHUT, side), f"deck{b}", cell[0] * CELL, cell[1] * CELL, 4, ["bridge", "deck"])
        add(NOTHING, f"lamps{b}", px * CELL - 1, py * CELL, 5, ["bridge", "lamps"])
    for i, (kind, x, y, h) in enumerate(ch["hulls"]):
        add(hull_pixels(kind, h), kind, x * CELL, y * CELL, 6, [kind, "hull"])
    # The signal mast is screen-fixed: the game moves it with the camera every frame.
    panel = np.full((64, 64 - PANEL_X), BLACK, dtype=np.int8)
    panel[:, 0] = ORANGE
    panel[8:WHEEL_Y, 4] = ORANGE  # the halyard the calls hang from
    add(panel, "mast", 0, 0, 10, ["hud", "mast"])
    for k in range(ch["delay"]):
        add(ink(["WWWWW"]), f"peg{k}", 0, 0, 11, ["hud", "slot"])
    add(WHEEL[0], "wheel", 0, 0, 12, ["hud", "helm"])
    dots = np.full((5, 7), CLEAR, dtype=np.int8)
    for k in range(len(LEVELS)):
        dots[2 * (k // 4), 2 * (k % 4)] = ORANGE if k < index else (WHITE if k == index else PURPLE)
    add(dots, "progress", 0, 0, 11, ["hud", "progress"])
    return Level(sprites=sprites, name=f"level-{index + 1}", data={"index": index, "strips": strips})


def lamp_pixels(ch: dict, bridge: int, t: int) -> np.ndarray:
    """Lamps on the pivot post: how many more turns the span keeps its present state (red shut, white open)."""
    now = bridge_open(ch, bridge, t)
    n = 1
    while n < 4 and bridge_open(ch, bridge, t + n) == now:
        n += 1
    pic = np.full((1, 7), CLEAR, dtype=np.int8)
    for k in range(n):
        pic[0, 2 * k] = WHITE if now else RED
    return pic


SAIL = (2, 4, 5)  # pixel offsets of a one-cell move over three frames: a push, then a glide
NUDGE = (1, 0, 0)  # a refused move: one pixel toward the obstacle, then back


class Fq27(ARCBaseGame):
    def __init__(self) -> None:
        self.ch = chart(LEVELS[0])
        self.state = start_state(self.ch)
        self.marks: list = []  # serial of the call hanging in each slot, oldest first (None = empty peg)
        self.serial = 0
        self.frames: list = []  # pending presentation frames, each a list of operations
        self.won = False
        self.hud: dict = {}  # screen position of every mast sprite
        self.wakes: list = []  # [name, age]
        self.notch = 0  # which of its two poses the wheel shows
        super().__init__(game_id="fq27", levels=[build_level(i) for i in range(len(LEVELS))],
                         camera=Camera(background=GREEN, letter_box=GREEN), available_actions=[1, 2, 3, 4, 5])

    # ── level start, change and RESET: rule state is rebuilt from the level definition ──
    def on_set_level(self, level: Level) -> None:
        index = level.get_data("index")
        self.ch = chart(LEVELS[index])
        self.state = start_state(self.ch)
        self.strips = level.get_data("strips")
        # every phase of every flowing strip, drawn once per level rather than once per frame
        self.ripples = {name: [ripple(d, n, o, p) for p in range(CELL)] for (name, d, n, o) in self.strips}
        self.marks = [None] * self.ch["delay"]
        self.serial = 0
        self.frames = []
        self.won = False
        self.wakes = []
        self.notch = 0
        self.hud = {"mast": (PANEL_X, 0), "wheel": (56, WHEEL_Y), "progress": (57, 1)}
        for k in range(self.ch["delay"]):
            self.hud[f"peg{k}"] = (MARK_X, slot_y(k) + 5)
        for cell, b in self.ch["bridges"].items():
            for sprite in level.get_sprites_by_name(f"lamps{b}"):
                sprite.pixels = lamp_pixels(self.ch, b, 0)
        cx, cy = self._camera_for(self._focus(self.state[0]))
        self._set_camera(level, cx, cy)

    # ── camera ──
    def _focus(self, hulls, offsets=None) -> tuple:
        """Centre (world pixels) of the hulls still under way, or of all hulls once every one is moored."""
        live = [i for i, h in enumerate(hulls) if not h[4]] or list(range(len(hulls)))
        xs, ys = [], []
        for i in live:
            ox, oy = offsets[i] if offsets else (0, 0)
            xs.append(hulls[i][0] * CELL + ox + CELL // 2)
            ys.append(hulls[i][1] * CELL + oy + CELL // 2)
        return sum(xs) // len(xs), sum(ys) // len(ys)

    def _camera_for(self, focus) -> tuple:
        mw, mh = self.ch["w"] * CELL, self.ch["h"] * CELL
        fx, fy = focus
        cx = -((VIEW_W - mw) // 2) if mw <= VIEW_W else max(0, min(mw - VIEW_W, fx - VIEW_W // 2))
        cy = -((64 - mh) // 2) if mh <= 64 else max(0, min(mh - 64, fy - 32))
        return cx, cy

    def _set_camera(self, level, cx, cy) -> None:
        self.camera.x, self.camera.y = cx, cy
        for name, (sx, sy) in self.hud.items():
            for sprite in level.get_sprites_by_name(name):
                sprite.set_position(cx + sx, cy + sy)

    # ── the turn ──
    def step(self) -> None:
        if self.action.id == GameAction.RESET:  # the engine steps once after a reset: nothing ticks
            self.complete_action()
            return
        if not self.frames:
            order = KEY_ORDER.get(self.action.id.value)
            if order is None:
                self.complete_action()
                return
            self._plan(order)
        self._apply(self.frames.pop(0))
        if not self.frames:
            self.complete_action()
            if self.won:
                self.next_level()

    def _apply(self, ops) -> None:
        level = self.current_level
        cam = None
        for op in ops:
            kind = op[0]
            if kind == "pos":
                for sprite in level.get_sprites_by_name(op[1]):
                    sprite.set_position(op[2], op[3])
            elif kind == "pix":
                for sprite in level.get_sprites_by_name(op[1]):
                    sprite.pixels = op[2]
            elif kind == "hud":
                self.hud[op[1]] = (op[2], op[3])
            elif kind == "add":
                level.add_sprite(op[1])
            elif kind == "del":
                for sprite in level.get_sprites_by_name(op[1]):
                    level.remove_sprite(sprite)
                self.hud.pop(op[1], None)
            elif kind == "cam":
                cam = (op[1], op[2])
        cx, cy = cam if cam else (self.camera.x, self.camera.y)
        self._set_camera(level, cx, cy)

    def _plan(self, order: str) -> None:
        """Decide the whole turn once, then lay out frames that only show it."""
        ch = self.ch
        old = self.state
        self.state, info = advance(ch, old, order)
        new = self.state
        self.won = info["won"]
        drifting = any(ev["drift"] for ev in info["hulls"])
        n = 3 + (3 if drifting else 0) + (2 if info["picked_now"] else 0)
        frames = [[] for _ in range(n)]

        # The water flows one cell during every turn.
        for f in range(n):
            phase = (CELL * (f + 1) // n) % CELL
            for name, poses in self.ripples.items():
                frames[f].append(("pix", name, poses[phase]))

        # The mast: the new call is hung at the top, every call drops one peg, the due call reaches the wheel.
        delay = ch["delay"]
        self.serial += 1
        fresh = f"call{self.serial}"
        frames[0].append(("add", Sprite(mark_pixels(order), name=fresh, x=0, y=0, layer=12,
                                        blocking=BlockingMode.NOT_BLOCKED, tags=["hud", "call", "call-" + order])))
        hanging = [(serial, k) for k, serial in enumerate(self.marks) if serial is not None] + [(self.serial, delay)]
        drop = (4, 8, SLOT_GAP)
        for f in range(3):
            for serial, k in hanging:
                frames[f].append(("hud", f"call{serial}", MARK_X, slot_y(k) + drop[f]))
        if self.marks[0] is not None:  # the due call goes into the wheel, which turns one notch
            self.notch = 1 - self.notch
            frames[2].append(("del", f"call{self.marks[0]}"))
            frames[2].append(("pix", "wheel", WHEEL[self.notch]))
        self.marks = self.marks[1:] + [self.serial]

        # The hulls: turn, then sail one cell or bump, then (the skiff) drift one cell.
        offsets = [[(0, 0)] * n for _ in info["hulls"]]  # pixel offset from each hull's start cell, per frame
        for i, ev in enumerate(info["hulls"]):
            kind = ev["kind"]
            x0, y0 = ev["from"]
            if ev["h1"] != ev["h0"]:
                frames[0].append(("pix", kind, hull_swing(kind, ev["h0"], ev["h1"])))
                frames[1].append(("pix", kind, hull_pixels(kind, ev["h1"], kind == "skiff" and old[3])))
            ox = oy = 0
            if ev["sail"]:
                what, (sx, sy), (tx, ty) = ev["sail"]
                dx, dy = tx - sx, ty - sy
                for f in range(3):
                    step = SAIL[f] if what == "move" else NUDGE[f]
                    offsets[i][f] = (dx * step, dy * step)
                if what == "move":
                    ox, oy = dx * CELL, dy * CELL
                else:
                    self._spray(frames, (sx, sy), (dx, dy))
            for f in range(3, n):
                offsets[i][f] = (ox, oy)
            if ev["drift"]:
                (sx, sy), (tx, ty) = ev["drift"]
                dx, dy = tx - sx, ty - sy
                for f in range(3):
                    offsets[i][3 + f] = (ox + dx * SAIL[f], oy + dy * SAIL[f])
                for f in range(6, n):
                    offsets[i][f] = (ox + dx * CELL, oy + dy * CELL)
            for f in range(n):
                px, py = x0 * CELL + offsets[i][f][0], y0 * CELL + offsets[i][f][1]
                frames[f].append(("pos", kind, px, py))
        # The camera follows the hulls, moving the whole scene rigidly (eased in if its target jumped).
        cx0, cy0 = self.camera.x, self.camera.y
        for f in range(n):
            tx, ty = self._camera_for(self._focus(old[0], offsets=[o[f] for o in offsets]))
            if f == n - 1:
                tx, ty = self._camera_for(self._focus(new[0]))
            w = (f + 1) / n
            frames[f].append(("cam", round(cx0 + (tx - cx0) * w), round(cy0 + (ty - cy0) * w)))

        # The passenger steps aboard and the harbour boom swings open.
        if info["picked_now"]:
            skiff = new[0][0]
            sx, sy = skiff[0] * CELL, skiff[1] * CELL
            for sprite in self.current_level.get_sprites_by_name("passenger"):
                frames[n - 2].append(("pos", "passenger", (sprite.x + sx) // 2, (sprite.y + sy) // 2 - 1))
            frames[n - 1].append(("del", "passenger"))
            frames[n - 1].append(("pix", "skiff", hull_pixels("skiff", skiff[2], True)))
            berth = sorted(ch["berths"])[0]
            frames[n - 2].append(("pix", "boom", _turned(DECK_SWING, _back_side(ch, berth))))
            frames[n - 1].append(("del", "boom"))

        # Swing bridges turn on their pivots when their cycle says so; the lamps count the turns left.
        for cell, b in ch["bridges"].items():
            was, now = bridge_open(ch, b, old[2]), bridge_open(ch, b, new[2])
            if was != now:
                side = _back_side(ch, cell)
                frames[max(0, n - 2)].append(("pix", f"deck{b}", _turned(DECK_SWING, side)))
                frames[n - 1].append(("pix", f"deck{b}", NOTHING if now else _turned(DECK_SHUT, side)))
            frames[n - 1].append(("pix", f"lamps{b}", lamp_pixels(ch, b, new[2])))

        # Wakes: the cells a hull just left show a fading wake.
        for w in self.wakes:
            w[1] += 1
            frames[n - 1].append(("del", w[0]) if w[1] >= 2 else ("pix", w[0], WAKE[1]))
        self.wakes = [w for w in self.wakes if w[1] < 2]
        for ev in info["hulls"]:
            legs = []
            if ev["sail"] and ev["sail"][0] == "move":
                legs.append((ev["sail"][1], ev["sail"][2]))
            if ev["drift"]:
                legs.append(ev["drift"])
            for (sx, sy), (tx, ty) in legs:
                heading = {(1, 0): "E", (-1, 0): "W", (0, 1): "S", (0, -1): "N"}[(tx - sx, ty - sy)]
                self.serial += 1
                name = f"wake{self.serial}"
                frames[n - 1].append(("add", Sprite(_turned(WAKE[0], heading), name=name, x=sx * CELL, y=sy * CELL, layer=2,
                                                    blocking=BlockingMode.NOT_BLOCKED, tags=["wake"])))
                self.wakes.append([name, 0])
        self.frames = frames

    def _spray(self, frames, cell, direction) -> None:
        """Spray thrown back from the point where a hull met a bank, rock, shut span or boom."""
        (x, y), (dx, dy) = cell, direction
        self.serial += 1
        name = f"spray{self.serial}"
        cx = x * CELL + 1 + dx * 3
        cy = y * CELL + 1 + dy * 3
        frames[0].append(("add", Sprite(SPRAY, name=name, x=cx, y=cy, layer=7, blocking=BlockingMode.NOT_BLOCKED, tags=["spray"])))
        frames[1].append(("pos", name, cx - dx, cy - dy))
        frames[2].append(("del", name))
