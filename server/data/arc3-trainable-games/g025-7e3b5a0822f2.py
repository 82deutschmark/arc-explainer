# ARC-AGI-3 candidate task g025.
#
# Author: Claude Opus 5.5 High (art pass, 20-October-2026; level three fix, 21-October-2026); rules and levels by Claude Opus 5 (Bubba), 30-August-2026.
# Date: 21-October-2026
# PURPOSE: A crew member walks a set of rooms. This file draws them the house way: every thing on screen is a named,
#   layered engine sprite (a wood floor, maroon brick walls with black edges, a black crew member with eyes that look
#   where it faces, tools hanging on black peg racks, a purple crate, open water, a green bramble, a white ice block,
#   a grey portcullis, a doorway lit yellow, a tool board on the left wall and three little bells on the right).
#   The rule functions (initial_state, step_state, is_won and their helpers) are the parent's, byte for byte, and
#   the step loop keeps the parent's frame timing. Level three's layout changed on 21-Oct (see CHANGELOG).
# SRP/DRY check: Pass -- the rule functions are copied unchanged from g025@63f56147c84c so its verifier imports and runs
#   as before; the drawing is one method (_sync) that reads the state and places each sprite; no rule is restated.
#
# CHANGELOG
# 21-Oct-2026 (Claude Opus 5.5 High): the Boss got stuck on level three ("I'm not really sure what it's looking for").
#   Its second tool for the lower door hung in the top room, far from the block it opens, so nothing on screen tied
#   them together. Level three now hangs that tool in the middle room beside the block, and a decoy rod takes its old
#   rack in the top room, so the put-down and the pairing are still the player's to work out (verifier: same two pairs
#   necessary; the shortest win is shorter but the reachable space is larger). The two hand slots on the left wall are
#   now black-framed niches that read as empty or full. Other levels, rules, inputs and frame timing are untouched.
#   Same day, the Boss's second look ("I still don't like the sprites"; the bramble "kind of looks like a swastika"):
#   the bramble is now a round green bush with no pinwheel of thorns; the magnet, torch (a lit brazier), hook and bell
#   are bolder; the doorway is an arch; water carries drifting white ripples; the unlit bells on the right wall show
#   as outlines instead of black blobs.
# 20-Oct-2026 (Claude Opus 5.5 High): art pass for the Boss ("It just needs a slight glow-up graphics pass").
#   The paint routine that stamped specks onto the frame is gone; the scene is built from named sprites in
#   build_levels and moved by _sync after every frame. New palette: orange floor, maroon walls, black crew member,
#   one distinct colour per kind of thing. Rules, levels, inputs, frame counts, class name and id are untouched.

import numpy as np


from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)


# ── Palette (indices into the engine's sixteen colours) ─────────────────────
# Each kind of thing the rules tell apart has a colour no other live thing wears.
WHITE, LGREY, GREY, BLACK = 0, 1, 2, 5
MAGENTA, PINK, RED, BLUE, LBLUE = 6, 7, 8, 9, 10
YELLOW, ORANGE, MAROON, GREEN, PURPLE = 11, 12, 13, 14, 15
_ = -1  # transparent

FLOOR = ORANGE    # warm wood floor, one flat field
WALL = MAROON     # brick walls; BLACK is the hard edge where a wall meets the floor
CREW = BLACK      # the crew member's silhouette, with WHITE eyes
EYE = WHITE


def art(rows) -> np.ndarray:
    return np.array(rows, dtype=np.int8)


def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0



MAGNET, ROD, LENS, TORCH, HOOK, BELL = range(6)
TOOL_CHARS = {"M": MAGNET, "R": ROD, "L": LENS, "T": TORCH, "K": HOOK, "B": BELL}

PAIRS = {
    tuple(sorted((MAGNET, ROD))): "drag",
    tuple(sorted((LENS, TORCH))): "burn",
    tuple(sorted((HOOK, ROD))): "grapple",
    tuple(sorted((BELL, MAGNET))): "ring",
    tuple(sorted((TORCH, HOOK))): "melt",
}

RING_TURNS = 3
BURN_REACH = 3
GRAPPLE_SPAN = 2

N = 16
CELL = 4

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}
ACTIONS = ("U", "D", "L", "R", "F", "Z")

LEVELS_SPEC = [
    ["################",
     "################",
     "################",
     "####.......#####",
     "####.L...T.#####",
     "####.......#####",
     "####.P.....#####",
     "#######V########",
     "####.......#####",
     "####...X...#####",
     "####.......#####",
     "####.......#####",
     "################",
     "################",
     "################",
     "################"],
    ["################",
     "#..............#",
     "#.K..........R.#",
     "#..............#",
     "#....######....#",
     "#....######....#",
     "#.P..######....#",
     "#....######....#",
     "#..............#",
     "#______________#",
     "#______________#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#P.............#",
     "#.L..........R.#",
     "#..............#",
     "#..............#",
     "#......T.......#",
     "#####V##########",
     "#..............#",
     "#...........K..#",
     "##########I#####",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#......P.......#",
     "#.M..........R.#",
     "#..............#",
     "#....K.........#",
     "#______________#",
     "#______________#",
     "#______________#",
     "#......C.......#",
     "#..............#",
     "#..............#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.B..........R.#",
     "#P.............#",
     "#......M.......#",
     "#..............#",
     "#______________#",
     "#......C.......#",
     "#..............#",
     "#..............#",
     "######H#########",
     "#..............#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.T..........R.#",
     "#..............#",
     "#......K.......#",
     "#P.............#",
     "#####I##########",
     "#..............#",
     "#..............#",
     "#..............#",
     "#______________#",
     "#______________#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.B..........L.#",
     "#..............#",
     "#P.............#",
     "#......M.......#",
     "#..........T...#",
     "#..............#",
     "####V###########",
     "#..............#",
     "#..............#",
     "##########H#####",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.L..........B.#",
     "#..............#",
     "#P.....M.......#",
     "#..............#",
     "#...........R..#",
     "#______________#",
     "#......C.......#",
     "#..............#",
     "###V######H#####",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "#..............#",
     "################"],
]


def _parse(rows: list[str]) -> dict:
    base: list[list[str]] = []
    tools: dict[tuple[int, int], int] = {}
    crates: list[tuple[int, int]] = []
    start = exit_cell = None
    for y, row in enumerate(rows):
        line: list[str] = []
        for x, ch in enumerate(row):
            if ch in TOOL_CHARS:
                tools[(x, y)] = TOOL_CHARS[ch]
                line.append(".")
            elif ch == "C":
                crates.append((x, y))
                line.append(".")
            elif ch == "P":
                start = (x, y)
                line.append(".")
            else:
                if ch == "X":
                    exit_cell = (x, y)
                line.append(ch)
        base.append(line)
    assert start is not None and exit_cell is not None
    return {
        "rows": rows,
        "base": base,
        "start": start,
        "exit": exit_cell,
        "tools": tools,
        "racks": tuple(sorted(tools)),
        "crates": tuple(sorted(crates)),
        "vines": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "V"),
        "ice": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "I"),
        "gaps": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "_"),
        "shutters": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "H"),
    }


LEVELS = [_parse(rows) for rows in LEVELS_SPEC]
for _lv in LEVELS:
    assert len(_lv["rows"]) == N and all(len(r) == N for r in _lv["rows"])


def initial_state(index: int) -> tuple:
    lv = LEVELS[index]
    sx, sy = lv["start"]
    floor = tuple(sorted((tid, x, y) for (x, y), tid in lv["tools"].items()))
    return (sx, sy, 0, 1, (), floor, lv["crates"], (), (), (), 0, False)


def is_won(state: tuple) -> bool:
    return state[11]


def _in_bounds(x: int, y: int) -> bool:
    return 0 <= x < N and 0 <= y < N


def _blocker(lv, crates, burned, melted, filled, timer, x, y) -> str | None:
    if not _in_bounds(x, y):
        return "#"
    ch = lv["base"][y][x]
    if ch == "#":
        return "#"
    if (x, y) in crates:
        return "C"
    if ch == "V" and (x, y) not in burned:
        return "V"
    if ch == "I" and (x, y) not in melted:
        return "I"
    if ch == "H" and timer <= 0:
        return "H"
    if ch == "_" and (x, y) not in filled:
        return "_"
    return None


def _standable(lv, crates, burned, melted, filled, timer, x, y) -> bool:
    return _blocker(lv, crates, burned, melted, filled, timer, x, y) is None


def _enter(lv, hands, floor, done, x, y):
    taken = None
    if len(hands) < 2:
        for tid, tx, ty in floor:
            if (tx, ty) == (x, y):
                taken = (tid, tx, ty)
                break
    if taken is not None:
        hands = hands + (taken[0],)
        floor = tuple(t for t in floor if t != taken)
    if (x, y) == lv["exit"]:
        done = True
    return x, y, hands, floor, done


def held_pair(hands: tuple) -> str | None:
    if len(hands) != 2:
        return None
    return PAIRS.get(tuple(sorted(hands)))


def _fire(lv, state):
    px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, done = state
    effect = held_pair(hands)
    if effect is None:
        return state

    if effect == "drag":
        k = 1
        while True:
            cx, cy = px + fx * k, py + fy * k
            if not _in_bounds(cx, cy):
                return state
            b = _blocker(lv, crates, burned, melted, filled, timer, cx, cy)
            if b == "C":
                break
            if b is not None and b != "_":
                return state
            k += 1
        if k < 2:
            return state
        tx, ty = px + fx * (k - 1), py + fy * (k - 1)
        rest = tuple(c for c in crates if c != (cx, cy))
        if lv["base"][ty][tx] == "_" and (tx, ty) not in filled:
            return (px, py, fx, fy, hands, floor, tuple(sorted(rest)), burned, melted,
                    tuple(sorted(filled + ((tx, ty),))), timer, done)
        if (_standable(lv, rest, burned, melted, filled, timer, tx, ty)
                and (tx, ty) != lv["exit"]
                and not any((ox, oy) == (tx, ty) for _t, ox, oy in floor)):
            return (px, py, fx, fy, hands, floor, tuple(sorted(rest + ((tx, ty),))),
                    burned, melted, filled, timer, done)
        return state

    if effect == "burn":
        cleared = []
        for k in range(1, BURN_REACH + 1):
            cx, cy = px + fx * k, py + fy * k
            if not _in_bounds(cx, cy):
                break
            b = _blocker(lv, crates, burned, melted, filled, timer, cx, cy)
            if b == "V":
                cleared.append((cx, cy))
            elif b is not None and b != "_":
                break
        if not cleared:
            return state
        return (px, py, fx, fy, hands, floor, crates,
                tuple(sorted(burned + tuple(cleared))), melted, filled, timer, done)

    if effect == "grapple":
        span = 0
        while span < GRAPPLE_SPAN:
            cx, cy = px + fx * (span + 1), py + fy * (span + 1)
            if _blocker(lv, crates, burned, melted, filled, timer, cx, cy) != "_":
                break
            span += 1
        if span == 0:
            return state
        lx, ly = px + fx * (span + 1), py + fy * (span + 1)
        if not _standable(lv, crates, burned, melted, filled, timer, lx, ly):
            return state
        nx, ny, nh, nf, nd = _enter(lv, hands, floor, done, lx, ly)
        return (nx, ny, fx, fy, nh, nf, crates, burned, melted, filled, timer, nd)

    if effect == "melt":
        cx, cy = px + fx, py + fy
        if _blocker(lv, crates, burned, melted, filled, timer, cx, cy) != "I":
            return state
        return (px, py, fx, fy, hands, floor, crates, burned,
                tuple(sorted(melted + ((cx, cy),))), filled, timer, done)

    if effect == "ring":
        return (px, py, fx, fy, hands, floor, crates, burned, melted, filled,
                RING_TURNS, done)

    return state


def step_state(index: int, state: tuple, action: str) -> tuple:
    if is_won(state):
        return state
    lv = LEVELS[index]
    px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, done = state
    rang = False

    if action in DIRS:
        dx, dy = DIRS[action]
        fx, fy = dx, dy
        nx, ny = px + dx, py + dy
        if _standable(lv, crates, burned, melted, filled, timer, nx, ny):
            px, py, hands, floor, done = _enter(lv, hands, floor, done, nx, ny)
        new = (px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, done)

    elif action == "F":
        new = _fire(lv, state)
        rang = held_pair(hands) == "ring"

    elif action == "Z":
        if (hands and (px, py) != lv["exit"]
                and not any((ox, oy) == (px, py) for _t, ox, oy in floor)):
            tid = hands[-1]
            new = (px, py, fx, fy, hands[:-1],
                   tuple(sorted(floor + ((tid, px, py),))),
                   crates, burned, melted, filled, timer, done)
        else:
            new = state
    else:
        new = state

    if not rang and new[10] > 0:
        new = new[:10] + (new[10] - 1,) + new[11:]
    return new

def _changed_cells(lv, before: tuple, after: tuple) -> tuple:
    if before == after:
        return ()
    cells = set(before[6]) ^ set(after[6])
    cells |= set(after[7]) - set(before[7])
    cells |= set(after[8]) - set(before[8])
    cells |= set(after[9]) - set(before[9])
    if (before[10] > 0) != (after[10] > 0):
        cells |= set(lv["shutters"])
    if (before[0], before[1]) != (after[0], after[1]):
        cells.add((before[0], before[1]))
        cells.add((after[0], after[1]))
    return tuple(sorted(cells))



# ── Art ──────────────────────────────────────────────────────────────────────
# Every picture is a 4x4 cell. Tools are three rows tall and hang under a rack's peg bar (row 0), so the same art
# reads on a rack, on the bare floor after a drop, and on the tool board in the wall.

TOOL_ART = {
    MAGNET: art([[_, _, _, _],
                 [MAGENTA, MAGENTA, MAGENTA, MAGENTA],
                 [MAGENTA, _, _, MAGENTA],
                 [WHITE, _, _, WHITE]]),
    ROD: art([[_, _, _, _],
              [_, _, _, WHITE],
              [_, _, WHITE, _],
              [_, WHITE, _, _]]),
    LENS: art([[_, _, _, _],
               [_, LBLUE, LBLUE, _],
               [LBLUE, WHITE, LBLUE, LBLUE],
               [_, LBLUE, LBLUE, BLACK]]),
    TORCH: art([[_, _, _, _],
                [_, RED, RED, _],
                [RED, YELLOW, YELLOW, RED],
                [_, BLACK, BLACK, _]]),
    HOOK: art([[_, _, _, _],
               [_, _, GREY, _],
               [GREY, _, GREY, _],
               [GREY, GREY, GREY, _]]),
    BELL: art([[_, _, _, _],
               [_, PINK, PINK, _],
               [PINK, PINK, PINK, PINK],
               [PINK, PINK, PINK, PINK]]),
}
# The colour a held tool shows in the crew member's hand.
HAND_COLOUR = {MAGNET: MAGENTA, ROD: WHITE, LENS: LBLUE, TORCH: RED, HOOK: GREY, BELL: PINK}

RACK = art([[BLACK, BLACK, BLACK, BLACK],
            [_, _, _, _],
            [_, _, _, _],
            [_, _, _, _]])
# A hand slot on the tool board: a black-framed niche cut into the left wall, open (floor showing) while empty, so the
# two slots read as two hands whether or not they hold anything.
SLOT = art([[BLACK, BLACK, BLACK, BLACK],
            [BLACK, FLOOR, FLOOR, BLACK],
            [BLACK, FLOOR, FLOOR, BLACK],
            [BLACK, BLACK, BLACK, BLACK]])
CRATE_ART = art([[BLACK, BLACK, BLACK, BLACK],
                 [BLACK, PURPLE, PURPLE, BLACK],
                 [BLACK, PURPLE, PURPLE, BLACK],
                 [BLACK, BLACK, BLACK, BLACK]])
WATER = art([[BLUE] * 4 for _r in range(4)])
# The same water with a short white ripple; _sync drifts ripples along the water, inert.
RIPPLE = art([[BLUE, BLUE, BLUE, BLUE],
              [BLUE, WHITE, WHITE, BLUE],
              [BLUE, BLUE, BLUE, BLUE],
              [BLUE, BLUE, BLUE, BLUE]])
SUNK = art([[BLUE, BLUE, BLUE, BLUE],
            [BLUE, PURPLE, PURPLE, BLUE],
            [BLUE, PURPLE, PURPLE, BLUE],
            [BLUE, BLUE, BLUE, BLUE]])
# A round green bush plugging the gap, mirror-symmetric on purpose: the 20-Oct version's thorns sat in a
# four-way pinwheel and read as a swastika (the Boss, 21-Oct). No black inside it, so it never reads as a face.
BRAMBLE = art([[_, GREEN, GREEN, _],
               [GREEN, GREEN, GREEN, GREEN],
               [GREEN, GREEN, GREEN, GREEN],
               [GREEN, GREEN, GREEN, GREEN]])
ICE_ART = art([[WHITE, WHITE, WHITE, WHITE],
               [WHITE, LBLUE, WHITE, WHITE],
               [WHITE, WHITE, LBLUE, WHITE],
               [WHITE, WHITE, WHITE, WHITE]])
GATE_SHUT = art([[LGREY, LGREY, LGREY, LGREY],
                 [LGREY, BLACK, BLACK, LGREY],
                 [LGREY, LGREY, LGREY, LGREY],
                 [LGREY, BLACK, BLACK, LGREY]])
GATE_UP = art([[LGREY, LGREY, LGREY, LGREY],
               [_, _, _, _],
               [_, _, _, _],
               [_, _, _, _]])
DOORWAY = art([[_, BLACK, BLACK, _],
               [BLACK, YELLOW, YELLOW, BLACK],
               [BLACK, YELLOW, YELLOW, BLACK],
               [BLACK, YELLOW, YELLOW, BLACK]])
SPARK = art([[WHITE, _, _, YELLOW],
             [_, WHITE, YELLOW, _],
             [_, YELLOW, WHITE, _],
             [YELLOW, _, _, WHITE]])
ECHO_ON = art([[_, PINK, _],
               [PINK, WHITE, PINK],
               [PINK, PINK, PINK]])
ECHO_OFF = art([[_, BLACK, _],
                [BLACK, MAROON, BLACK],
                [BLACK, BLACK, BLACK]])
STAR = art([[WHITE]])


def crew_art(heading: tuple, hands: tuple, pose: int) -> np.ndarray:
    """The crew member: a black head and body, white eyes on the side it faces (none from behind), a hand pixel in
    the colour of each tool it holds, and feet that swap between two poses as it walks."""
    dx, dy = heading
    if dy > 0 or (dx, dy) == (0, 0):
        face = [CREW, EYE, EYE, CREW]
    elif dy < 0:
        face = [CREW, CREW, CREW, CREW]
    elif dx < 0:
        face = [CREW, EYE, CREW, CREW]
    else:
        face = [CREW, CREW, EYE, CREW]
    left = HAND_COLOUR[hands[0]] if len(hands) > 0 else CREW
    right = HAND_COLOUR[hands[1]] if len(hands) > 1 else CREW
    feet = [CREW, _, _, CREW] if pose == 0 else [_, CREW, CREW, _]
    return art([[_, CREW, CREW, _], face, [left, CREW, CREW, right], feet])


def halo_art(k: int) -> np.ndarray:
    """A white ring k pixels outside the doorway's cell: the glow opening out as the crew member arrives."""
    size = CELL + 2 * k
    px = np.full((size, size), _, dtype=np.int8)
    px[0, :] = px[-1, :] = px[:, 0] = px[:, -1] = WHITE
    return px


# ── Where the fixed fittings sit ─────────────────────────────────────────────

HAND_ROWS = (5, 7)          # the tool board's two pegs: cells (0, 5) and (0, 7), in the left wall
ECHO_TOPS = (34, 41, 48)    # the three bells on the right wall, pixel rows
ECHO_X = N * CELL - 3
WINDOW_COLUMNS = (3, 8, 12)
SPARKS = 12                 # sparkle sprites kept per level; no firing changes more cells than this


def _walls_art(lv) -> np.ndarray:
    """One sprite for every wall in the level: flat maroon, a black edge on each side that faces a non-wall cell,
    and small dark windows in the top and bottom outer walls."""
    px = np.full((N * CELL, N * CELL), _, dtype=np.int8)
    base = lv["base"]

    def wall(x, y):
        return not _in_bounds(x, y) or base[y][x] == "#"

    for y in range(N):
        for x in range(N):
            if base[y][x] != "#":
                continue
            ox, oy = x * CELL, y * CELL
            px[oy:oy + CELL, ox:ox + CELL] = WALL
            if not wall(x, y - 1):
                px[oy, ox:ox + CELL] = BLACK
            if not wall(x, y + 1):
                px[oy + CELL - 1, ox:ox + CELL] = BLACK
            if not wall(x - 1, y):
                px[oy:oy + CELL, ox] = BLACK
            if not wall(x + 1, y):
                px[oy:oy + CELL, ox + CELL - 1] = BLACK
    for x, y, wy in _windows(lv):
        px[wy:wy + 2, x * CELL + 1:x * CELL + 3] = BLACK
    return px


def _windows(lv) -> list:
    """(cell x, cell y, top pixel row) of each window: outer top and bottom walls, on the side away from the room."""
    out = []
    for x in WINDOW_COLUMNS:
        if lv["base"][0][x] == "#":
            out.append((x, 0, 0))
        if lv["base"][N - 1][x] == "#":
            out.append((x, N - 1, (N - 1) * CELL + 2))
    return out


def _sprite(pixels, name, x, y, layer, tags, visible=True) -> Sprite:
    return Sprite(pixels=pixels, name=name, x=x, y=y, layer=layer,
                  blocking=BlockingMode.NOT_BLOCKED,
                  interaction=InteractionMode.INTANGIBLE if visible else InteractionMode.REMOVED,
                  tags=tags)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for lv in LEVELS:
        sprites: list[Sprite] = [
            # The full-screen click pad (unchanged in size and tags): it is also the wood floor.
            Sprite(pixels=[[FLOOR] * (N * CELL) for _r in range(N * CELL)], name="pad",
                   blocking=BlockingMode.NOT_BLOCKED,
                   interaction=InteractionMode.INTANGIBLE, layer=-2,
                   tags=["sys_click", "sys_every_pixel"]).set_position(0, 0),
            _sprite(_walls_art(lv), "walls", 0, 0, -1, ["wall"]),
        ]
        for k, (x, y, wy) in enumerate(_windows(lv)):
            sprites.append(_sprite(STAR, f"star-{k}", x * CELL + 1 + (k % 2), wy + (k + 1) % 2, 4, ["star"]))
        for x, y in sorted(lv["gaps"]):
            sprites.append(_sprite(WATER, f"water-{x}-{y}", x * CELL, y * CELL, 0, ["water"]))
        for x, y in sorted(lv["vines"]):
            sprites.append(_sprite(BRAMBLE, f"bramble-{x}-{y}", x * CELL, y * CELL, 0, ["bramble"]))
        for x, y in sorted(lv["ice"]):
            sprites.append(_sprite(ICE_ART, f"ice-{x}-{y}", x * CELL, y * CELL, 0, ["ice"]))
        for x, y in sorted(lv["shutters"]):
            sprites.append(_sprite(GATE_SHUT, f"gate-{x}-{y}", x * CELL, y * CELL, 0, ["gate"]))
        ex, ey = lv["exit"]
        sprites.append(_sprite(DOORWAY, "doorway", ex * CELL, ey * CELL, 0, ["exit"]))
        for k, (x, y) in enumerate(lv["racks"]):
            sprites.append(_sprite(RACK, f"rack-{k}", x * CELL, y * CELL, 0, ["rack"]))
            sprites.append(_sprite(TOOL_ART[lv["tools"][(x, y)]], f"tool-{k}", x * CELL, y * CELL, 2, ["tool"]))
        for k, (x, y) in enumerate(lv["crates"]):
            sprites.append(_sprite(CRATE_ART, f"crate-{k}", x * CELL, y * CELL, 1, ["crate"]))
        sx, sy = lv["start"]
        sprites.append(_sprite(crew_art((0, 1), (), 0), "crew", sx * CELL, sy * CELL, 3, ["crew"]))
        for slot, row in enumerate(HAND_ROWS):
            sprites.append(_sprite(SLOT, f"board-{slot}", 0, row * CELL, 4, ["board"]))
            sprites.append(_sprite(TOOL_ART[MAGNET], f"held-{slot}", 0, row * CELL, 5, ["held"], visible=False))
        for k, top in enumerate(ECHO_TOPS):
            sprites.append(_sprite(ECHO_OFF, f"echo-{k}", ECHO_X, top, 4, ["echo"]))
        for k in range(SPARKS):
            sprites.append(_sprite(SPARK, f"spark-{k}", 0, 0, 6, ["spark"], visible=False))
        sprites.append(_sprite(halo_art(0), "halo", ex * CELL, ey * CELL, 7, ["halo"], visible=False))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G025(ARCBaseGame):

    FLASH_FRAMES = 4
    ARRIVE_FRAMES = 4

    def __init__(self) -> None:
        self.state = initial_state(0)
        self.tick = 0
        self.flash = 0
        self.arrive = 0
        self.marks: tuple = ()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
        )
        super().__init__(game_id="g025", levels=build_levels(), camera=camera)

    # ── drawing: place every sprite from the state; nothing is painted on the frame ──

    def _sync(self) -> None:
        """Put each named sprite where the state says, with the art the state calls for. Sprites are looked up by
        name every time (never cached on the game), so a level reset's fresh sprites and a deep copy both work."""
        lv = LEVELS[self.level_index]
        px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, _d = self.state
        sprites = {s.name: s for s in self.current_level.get_sprites()}

        def put(name, pixels=None, x=None, y=None, visible=True):
            s = sprites[name]
            if pixels is not None:
                s.pixels = pixels
            if x is not None:
                s.set_position(x, y)
            s.set_visible(visible)

        for k, (x, y, _wy) in enumerate(_windows(lv)):
            put(f"star-{k}", visible=(self.tick + x) % 3 == 0)
        for x, y in lv["gaps"]:
            ripple = (x * 5 + y * 3 + self.tick) % 7 == 0
            put(f"water-{x}-{y}", SUNK if (x, y) in filled else RIPPLE if ripple else WATER)
        for x, y in lv["vines"]:
            put(f"bramble-{x}-{y}", visible=(x, y) not in burned)
        for x, y in lv["ice"]:
            put(f"ice-{x}-{y}", visible=(x, y) not in melted)
        for x, y in lv["shutters"]:
            put(f"gate-{x}-{y}", GATE_UP if timer > 0 else GATE_SHUT)
        for k in range(len(lv["racks"])):
            if k < len(floor):
                tid, tx, ty = floor[k]
                put(f"tool-{k}", TOOL_ART[tid], tx * CELL, ty * CELL)
            else:
                put(f"tool-{k}", visible=False)
        for k in range(len(lv["crates"])):
            if k < len(crates):
                cx, cy = crates[k]
                put(f"crate-{k}", None, cx * CELL, cy * CELL)
            else:
                put(f"crate-{k}", visible=False)
        put("crew", crew_art((fx, fy), hands, self.tick % 2), px * CELL, py * CELL)
        for slot in range(2):
            if slot < len(hands):
                put(f"held-{slot}", TOOL_ART[hands[slot]])
            else:
                put(f"held-{slot}", visible=False)
        for k in range(len(ECHO_TOPS)):
            put(f"echo-{k}", ECHO_ON if k < timer else ECHO_OFF)
        # A tool at work: sparkles over the cells about to change, on every other frame (the parent's blink).
        lit = self.flash and blink(self.flash, 1)
        for k in range(SPARKS):
            if lit and k < len(self.marks):
                cx, cy = self.marks[k]
                put(f"spark-{k}", None, cx * CELL, cy * CELL)
            else:
                put(f"spark-{k}", visible=False)
        if self.arrive:
            ex, ey = lv["exit"]
            k = self.ARRIVE_FRAMES - self.arrive
            put("halo", halo_art(k), ex * CELL - k, ey * CELL - k)
        else:
            put("halo", visible=False)

    # ── the parent's game loop, unchanged except that each frame ends in _sync ──

    def _rearm(self) -> None:
        self.state = initial_state(self.level_index)
        self.flash = 0
        self.arrive = 0
        self.marks = ()
        self._sync()

    def on_set_level(self, level: Level) -> None:
        self._rearm()

    def level_reset(self) -> None:
        super().level_reset()
        self._rearm()

    def full_reset(self) -> None:
        super().full_reset()
        self.tick = 0
        self._rearm()

    def _settle(self, action: str) -> None:
        self.state = step_state(self.level_index, self.state, action)
        self.tick += 1
        if is_won(self.state):
            self.arrive = self.ARRIVE_FRAMES
            return
        self.complete_action()

    def step(self) -> None:
        self._advance()
        self._sync()

    def _advance(self) -> None:
        if self.arrive:
            self.arrive -= 1
            if self.arrive == 0:
                self.next_level()
                self.complete_action()
            return

        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.marks = ()
                self._settle("F")
            return

        action = {
            GameAction.ACTION1: "U",
            GameAction.ACTION2: "D",
            GameAction.ACTION3: "L",
            GameAction.ACTION4: "R",
            GameAction.ACTION5: "F",
            GameAction.ACTION6: "Z",
        }.get(self.action.id)
        if action is None:
            self.complete_action()
            return

        if action == "F":
            bitten = _fire(LEVELS[self.level_index], self.state)
            marks = _changed_cells(LEVELS[self.level_index], self.state, bitten)
            if marks:
                self.marks = marks
                self.flash = self.FLASH_FRAMES
                return

        self._settle(action)
