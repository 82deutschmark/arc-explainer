# ARC-AGI-3 candidate task g042.

from collections import deque

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

WALL_BLOCK = 5
WALL_COURSE = 13
WATER = 9
WATER_GLINT = 10
GATE_C = 11
GATE_PIP = 5
GOAL_FILL = 6
GOAL_EYE = 0
HULL_C = 0
HULL_LIT = 12
HULL_DIM = 5
GUARD = 8
GUARD_EYE = 7

N_COLS, N_ROWS = 17, 15
CELL = 3
FRAME = 64
OX = 6
OY = 10

KING_STEPS = (
    (-1, -1), (0, -1), (1, -1),
    (-1, 0), (1, 0),
    (-1, 1), (0, 1), (1, 1),
)

MASONRY = "#"
BASIN_CH = "="
TUG_CHARS = "12"
WARDEN_CH = "W"
GATE_IDS = "abcd"

CHARTS = [
    [
        "#################",
        "#################",
        "#################",
        "####1...2########",
        "####.....########",
        "####A...B########",
        "#################",
        "#################",
        "#########.....###",
        "#########a...b###",
        "#########.....###",
        "#########..=..###",
        "#################",
        "#################",
        "#################",
    ],
    [
        "#################",
        "#################",
        "####1...2########",
        "####..C..########",
        "####A...B########",
        "#################",
        "#######a...b#####",
        "#######.....#####",
        "#######..=..#####",
        "#######.W...#####",
        "#################",
        "##c##############",
        "#################",
        "#################",
        "#################",
    ],
    [
        "#################",
        "#################",
        "###1...2#########",
        "###.....#########",
        "###A.D.B#########",
        "#################",
        "######a.b########",
        "######.C.########",
        "#################",
        "#################",
        "#######d....c####",
        "#######.....W####",
        "#######..=...####",
        "#################",
        "#################",
    ],
    [
        "#################",
        "#################",
        "####1...2########",
        "####A...B########",
        "#################",
        "####a.....b######",
        "####...W...######",
        "####C.....D######",
        "#################",
        "########c.d######",
        "########...######",
        "########.=.######",
        "#################",
        "#################",
        "#################",
    ],
    [
        "#################",
        "#################",
        "####1...2########",
        "####A.C.B########",
        "#################",
        "###a.....b#######",
        "###...W...#######",
        "###...=...#######",
        "#################",
        "#c...........####",
        "#............####",
        "#............####",
        "#################",
        "#################",
        "#################",
    ],
    [
        "#################",
        "#################",
        "#################",
        "#####1...2#######",
        "#####A...B#######",
        "#################",
        "###C..a.b..D#####",
        "###....W....#####",
        "#################",
        "#########c..#####",
        "#########.=.#####",
        "#########..d#####",
        "#################",
        "#################",
        "#################",
    ],
]


def cells(rows, mark):
    return [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == mark]


def gate_ids(rows):
    return sorted({ch.lower() for row in rows for ch in row if ch.lower() in GATE_IDS})


def neighbours(x, y):
    return [(x + dx, y + dy) for dx, dy in KING_STEPS]


def on_board(x, y):
    return 0 <= x < N_COLS and 0 <= y < N_ROWS


def read(rows, x, y, jammed):
    ch = rows[y][x]
    if ch in TUG_CHARS or ch == WARDEN_CH:
        return "."
    if ch.lower() in GATE_IDS:
        return MASONRY if ch.lower() in jammed else ch
    return ch


def swimmable(rows, x, y, jammed):
    return on_board(x, y) and read(rows, x, y, jammed) == "."


def berthed(pos):
    return pos == (-1, -1)


def warden_step(rows, jammed, warden, tugs):
    live = [t for t in tugs if not berthed(t)]
    if not live:
        return warden
    dist = {t: 0 for t in live}
    queue = deque(live)
    while queue:
        cx, cy = queue.popleft()
        for nx, ny in neighbours(cx, cy):
            if (nx, ny) in dist or not swimmable(rows, nx, ny, jammed):
                continue
            dist[(nx, ny)] = dist[(cx, cy)] + 1
            queue.append((nx, ny))
    best, mark = warden, dist.get(warden)
    for step in neighbours(*warden):
        if not swimmable(rows, step[0], step[1], jammed) or step not in dist:
            continue
        if mark is None or dist[step] < mark:
            best, mark = step, dist[step]
    return best


def order(rows, state, unit, target):
    tugs, sel, jammed, wardens = list(state[0]), state[1], state[2], state[3]
    if unit is not None:
        sel = unit
    if target is not None and not berthed(tugs[sel]):
        here = tugs[sel]
        if target in neighbours(*here) and on_board(*target):
            ch = read(rows, target[0], target[1], jammed)
            if ch == BASIN_CH:
                tugs[sel] = (-1, -1)
            elif ch.isupper() and ch.lower() in GATE_IDS:
                tugs[sel] = cells(rows, ch.lower())[0]
                jammed = jammed | {ch.lower()}
            elif ch != MASONRY:
                tugs[sel] = target

    moved = []
    for warden in wardens:
        nxt = warden_step(rows, jammed, warden, tugs)
        if any(not berthed(t) and (t == nxt or (t == warden and nxt in tugs))
               for t in tugs):
            return (tuple(tugs), sel, jammed, tuple(wardens)), "caught"
        moved.append(nxt)
    if any(not berthed(t) and t in moved for t in tugs):
        return (tuple(tugs), sel, jammed, tuple(moved)), "caught"

    nxt_state = (tuple(tugs), sel, jammed, tuple(moved))
    if all(berthed(t) for t in tugs):
        return nxt_state, "won"
    return nxt_state, "ok"


def opening(rows):
    return (
        (cells(rows, "1")[0], cells(rows, "2")[0]),
        0,
        frozenset(),
        tuple(cells(rows, WARDEN_CH)),
    )


PIP_AT = ((0, 0), (2, 0), (0, 2), (2, 2))
HEART_AT = (1, 1)
RING_AT = ((0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2))
CUT_AT = ((2, 0), (0, 2))


def solid(colour):
    return np.full((CELL, CELL), colour, dtype=np.int8)


def mason_face(x, y, pulse):
    face = solid(WALL_BLOCK)
    face[(x + y) % CELL, (x * 2 + y) % CELL] = WALL_COURSE
    if (x * 5 + y * 3 + pulse) % 11 == 0:
        face[1, 1] = GATE_C
    return face


def surround_face():
    return solid(WALL_BLOCK)


def water_face(x, y, pulse):
    face = solid(WATER)
    if (x * 4 + y * 5 + pulse) % 3 == 0:
        face[(pulse + y) % CELL, (pulse + x * 2) % CELL] = WATER_GLINT
    return face


def silt(x, y, pulse):
    return (x * 3 + y * 7 + pulse * 2) % 11 == 0


def gate_face(x, y, letter, order_index, pulse):
    face = solid(GATE_C)
    if letter.islower():
        face[HEART_AT[1], HEART_AT[0]] = WATER
    c, r = PIP_AT[order_index]
    face[r, c] = GATE_PIP
    return face


def basin_face(x, y, pulse):
    face = solid(GOAL_FILL)
    face[HEART_AT[1], HEART_AT[0]] = GOAL_EYE
    return face


def face_of(rows, x, y, jammed, pulse, ids):
    ch = read(rows, x, y, jammed)
    if ch == MASONRY:
        return mason_face(x, y, pulse)
    if ch == BASIN_CH:
        return basin_face(x, y, pulse)
    if ch.lower() in GATE_IDS:
        return gate_face(x, y, ch, ids.index(ch.lower()), pulse)
    face = water_face(x, y, pulse)
    if silt(x, y, pulse):
        face[2, 0] = GUARD
    return face


def tug_face(under, index, live):
    face = under.copy()
    face[:, :] = HULL_C
    if index:
        for c, r in CUT_AT:
            face[r, c] = under[r, c]
    face[HEART_AT[1], HEART_AT[0]] = HULL_LIT if live else HULL_DIM
    return face


def warden_face(under):
    face = solid(GUARD)
    face[HEART_AT[1], HEART_AT[0]] = GUARD_EYE
    return face


def paint(rows, jammed, pulse, ids):
    board = np.full((FRAME, FRAME), WALL_BLOCK, dtype=np.int8)
    for y in range(FRAME // CELL + 1):
        for x in range(FRAME // CELL + 1):
            top, left = y * CELL, x * CELL
            patch = surround_face()
            board[top:top + CELL, left:left + CELL] = patch[
                :FRAME - top, :FRAME - left]
    for y in range(N_ROWS):
        for x in range(N_COLS):
            board[OY + y * CELL:OY + (y + 1) * CELL,
                  OX + x * CELL:OX + (x + 1) * CELL] = face_of(
                      rows, x, y, jammed, pulse, ids)
    return board


def build_levels():
    made = []
    for rows in CHARTS:
        ids = gate_ids(rows)
        works = Sprite(
            pixels=paint(rows, frozenset(), 0, ids), name="works",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-1,
        ).set_position(0, 0)
        sprites = [works]
        for i, start in enumerate((cells(rows, "1")[0], cells(rows, "2")[0])):
            sprites.append(Sprite(
                pixels=tug_face(face_of(rows, start[0], start[1], frozenset(), 0, ids),
                                i, i == 0),
                name=f"tug{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=2,
            ).set_position(OX + start[0] * CELL, OY + start[1] * CELL))
        for i, spot in enumerate(cells(rows, WARDEN_CH)):
            sprites.append(Sprite(
                pixels=warden_face(face_of(rows, spot[0], spot[1], frozenset(), 0, ids)),
                name=f"warden{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=1,
            ).set_position(OX + spot[0] * CELL, OY + spot[1] * CELL))
        made.append(Level(sprites=sprites, grid_size=(FRAME, FRAME)))
    return made


class G042(ARCBaseGame):

    def __init__(self) -> None:
        self.state = opening(CHARTS[0])
        self.pulse = 0
        super().__init__(
            game_id="g042", levels=build_levels(),
            camera=Camera(width=FRAME, height=FRAME,
                          background=WALL_BLOCK, letter_box=WALL_BLOCK),
            available_actions=[1, 2, 6],
        )

    @property
    def chart(self):
        return CHARTS[self.level_index]

    @property
    def ids(self):
        return gate_ids(self.chart)

    def on_set_level(self, level) -> None:
        self.state = opening(self.chart)
        self.pulse = 0
        self.repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def repaint(self) -> None:
        rows, ids = self.chart, self.ids
        tugs, sel, jammed, wardens = self.state
        works = self.current_level.get_sprites_by_name("works")
        if works:
            works[0].pixels[:, :] = paint(rows, jammed, self.pulse, ids)
        for i, pos in enumerate(tugs):
            found = self.current_level.get_sprites_by_name(f"tug{i}")
            if not found:
                continue
            if berthed(pos):
                found[0].pixels[:, :] = -1
                continue
            under = face_of(rows, pos[0], pos[1], jammed, self.pulse, ids)
            found[0].pixels[:, :] = tug_face(under, i, i == sel)
            found[0].set_position(OX + pos[0] * CELL, OY + pos[1] * CELL)
        for i, pos in enumerate(wardens):
            found = self.current_level.get_sprites_by_name(f"warden{i}")
            if not found:
                continue
            under = face_of(rows, pos[0], pos[1], jammed, self.pulse, ids)
            found[0].pixels[:, :] = warden_face(under)
            found[0].set_position(OX + pos[0] * CELL, OY + pos[1] * CELL)

    def read_order(self):
        pick = {GameAction.ACTION1: 0, GameAction.ACTION2: 1}.get(self.action.id)
        if pick is not None:
            return pick, None
        if self.action.id != GameAction.ACTION6:
            return None, None
        hit = self.camera.display_to_grid(int(self.action.data.get("x", -1)),
                                          int(self.action.data.get("y", -1)))
        if hit is None:
            return None, None
        target = ((hit[0] - OX) // CELL, (hit[1] - OY) // CELL)
        if not on_board(*target):
            return None, None
        for i, pos in enumerate(self.state[0]):
            if pos == target and not berthed(pos):
                return i, None
        return None, target

    def step(self) -> None:
        unit, target = self.read_order()
        if unit is None and target is None and self.action.id != GameAction.ACTION6:
            self.complete_action()
            return

        self.state, outcome = order(self.chart, self.state, unit, target)
        self.pulse += 1
        self.repaint()

        if outcome == "caught":
            self.level_reset()
        elif outcome == "won":
            self.next_level()

        self.complete_action()
