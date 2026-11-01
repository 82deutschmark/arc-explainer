# Hop as far as the die shows. Only the tile you land on counts.
#
# Author: Claude Sonnet 5.5, 12-October-2026
# Parent: dw01@4c0dc1ff5264 (a revision of that game, same id)
#
# A die in the top strip shows how far the next press moves you. A direction
# press hops exactly that many tiles (a wall stops the hop short). Passing over
# a tile does nothing; only the tile you LAND on is looked at. A pit sends you
# back to the start. A die lying on the floor (a stone) is a hop the strip die
# never rolls: land on it and your next hop is that long. From the turn level a
# chaser follows you one step per turn and cannot cross a pit.
#
# ACTION5 tosses the die again (it costs a turn, so the chaser takes a step).
#
# Every level is a hand-made board. The die faces come from a fixed tape built
# for each level when it is entered, so there is no randomness while playing:
# a retry (RESET) sees the same faces in the same order, and the winning moves
# can be searched for instead of gambled on.

import random
from collections import namedtuple

import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay

# --- Layout (pixels) ---
CELL = 5                 # a tile is CELL x CELL pixels
MAP_X, MAP_Y = 2, 12     # top-left pixel of the board
BAND_H = 11              # rows 0..10: the blue strip with the die
DIE_X, DIE_Y, DIE = 27, 1, 10

# --- Colours (palette indices) ---
C_WHITE = 0       # dice
C_BLACK = 5       # the hard border, pips, eyes
C_PINK = 7        # the chaser and the send-back flash
C_RED = 8         # a pit's rim
C_BLUE = 9        # walls and the top strip
C_YELLOW = 11     # the goal
C_MAROON = 13     # a pit's hole
C_GREEN = 14      # floor
C_PURPLE = 15     # the player

# --- Tiles ---
T_WALL, T_FLOOR, T_PIT, T_GOAL = 1, 2, 3, 4

DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
TAPE_LEN = 256
TAPE_SEED = 0xD0FF0DE5

# Legend (build-time data, never drawn as text): # wall, . floor, x pit,
# S start, G goal, 4 5 6 a stone with that face, C where the chaser waits.
LEVELS = [
    dict(name="L1", rows=(
        "############",
        "#..........#",
        "#....S.....#",
        "#..........#",
        "#xxxxxxxxxx#",
        "#..........#",
        "#xxxxxxxxxx#",
        "#..........#",
        "#....G.....#",
        "############",
    )),
    dict(name="L2", rows=(
        "############",
        "#S..xxxxxxx#",
        "#...xx.xxxx#",
        "#...xxxxxxx#",
        "#xxxxxxxxxx#",
        "#xxxxx.x.xx#",
        "#xxxxxxxxxx#",
        "#xxxxGxx.xx#",
        "#xxxxxxxxxx#",
        "############",
    )),
    dict(name="L3", rows=(
        "############",
        "#Sx.xxxxx#x#",
        "#xxxxxGxx.x#",
        "#xxxxxxxxxx#",
        "#xx.x.#.x.##",
        "#xxxxxxxxxx#",
        "#xxxxxxxxxx#",
        "#xxxx.x.#xx#",
        "#xxxxxxxxxx#",
        "############",
    )),
    dict(name="L4", rows=(
        "############",
        "#.xx.xxxx###",
        "#x.xx.xxx###",
        "#.xxxxxxx###",
        "#x.x.xxxx###",
        "#.xxx.xxx###",
        "#xxxxxxxx###",
        "#xxxx4xxxG##",
        "#.Sxxxxxx###",
        "############",
    )),
    dict(name="L5", rows=(
        "############",
        "#xxxxxxxxxx#",
        "#x4xxx5xxxx#",
        "#xxx.xx.xx.#",
        "#xxxxxx6xxx#",
        "#x.x.xxxxxx#",
        "#xxxx#G#xx.#",
        "#xxSxx#xxxx#",
        "#xx.x.xx.x.#",
        "############",
    )),
    dict(name="L6", rows=(
        "############",
        "#xxx.x....C#",
        "#..xxx.xxx##",
        "#xxxxx.xxx##",
        "#.xx.x4xxxG#",
        "#x.xxx.xxx##",
        "#xxxxx.xxx##",
        "#xxxxx.....#",
        "#xSxxx.....#",
        "############",
    )),
    dict(name="L7", rows=(
        "############",
        "#xx..x..4..#",
        "#xSxxx.xxx.#",
        "#.x.xx.xxx.#",
        "#.xxxx.xxx.#",
        "#x.xxx.#G#.#",
        "#xxxxx.###.#",
        "#..xxx.....#",
        "#xxxxx....C#",
        "############",
    )),
    dict(name="L8", rows=(
        "############",
        "#xxx4x.xxxx#",
        "#xxxxx.xx.x#",
        "#xSxx.xx..x#",
        "#xxxxxxxx#x#",
        "#.#.5xxxxG##",
        "#...C#.x.###",
        "#.....x#x.##",
        "#....#..x.x#",
        "############",
    )),
]

# ============================================================================
# Boards, the tape, and the one rule function
# ============================================================================

# A parsed board: w, h in tiles; grid is a tuple of rows of tile codes; stones is
# {(x, y): face}; post is where the chaser waits, or None on levels without one.
Board = namedtuple("Board", "w h grid start goal stones post")
# What resolve_turn needs: a board plus that level's tape of die faces.
Rules = namedtuple("Rules", Board._fields + ("tape",))


def parse_map(rows):
    """Turn a board drawn in characters into an immutable description."""
    h, w = len(rows), len(rows[0])
    grid, stones = [], {}
    start = goal = post = None
    for y, row in enumerate(rows):
        if len(row) != w:
            raise ValueError("ragged board")
        line = []
        for x, ch in enumerate(row):
            tile = T_FLOOR
            if ch == "#":
                tile = T_WALL
            elif ch == "x":
                tile = T_PIT
            elif ch == "G":
                tile, goal = T_GOAL, (x, y)
            elif ch == "S":
                start = (x, y)
            elif ch == "C":
                post = (x, y)
            elif ch in "456":
                stones[(x, y)] = int(ch)
            elif ch != ".":
                raise ValueError("unknown board character")
            line.append(tile)
        grid.append(tuple(line))
    return Board(w, h, tuple(grid), start, goal, stones, post)


def make_tape(level_index):
    """The die faces for one level, in order. Built once, at level entry."""
    r = random.Random(TAPE_SEED + 7919 * level_index)
    return tuple(r.randint(1, 3) for _ in range(TAPE_LEN))


def build_rules(level_index, rows=None):
    board = parse_map(rows or LEVELS[level_index]["rows"])
    return Rules(*board, make_tape(level_index))


def start_state(lvl):
    """(position, forced face or None, chaser or None, turns spent)."""
    return (lvl.start, None, lvl.post, 0)


def chaser_step(lvl, chaser, pos):
    """The chaser takes one step toward the player, or stays where it is."""
    if chaser is None:
        return None
    best = chaser
    bd = abs(chaser[0] - pos[0]) + abs(chaser[1] - pos[1])
    for a in (1, 2, 3, 4):
        nx, ny = chaser[0] + DIRS[a][0], chaser[1] + DIRS[a][1]
        if not (0 <= nx < lvl.w and 0 <= ny < lvl.h) or lvl.grid[ny][nx] != T_FLOOR:
            continue
        d = abs(nx - pos[0]) + abs(ny - pos[1])
        if d < bd:
            bd, best = d, (nx, ny)
    return best


def resolve_turn(lvl, state, action):
    """Decide one whole press. Returns (new_state, event, path).

    state is (pos, forced, chaser, turn). event is one of: "bump" (nothing
    happens), "toss", "move", "stone" (landed on a stone), "back" (sent to the
    start by a pit or the chaser) and "win". path lists the tiles hopped over
    and landed on, in order. This is the only place the rules live: step(), the
    solver and the checks all call it.
    """
    pos, forced, chaser, turn = state
    if action == 5:
        turn += 1
        moved = chaser_step(lvl, chaser, pos)
        if moved == pos:
            return (lvl.start, None, lvl.post, turn), "back", ()
        return (pos, None, moved, turn), "toss", ()
    if action not in DIRS:
        return state, "bump", ()
    n = forced or lvl.tape[turn % TAPE_LEN]
    dx, dy = DIRS[action]
    x, y = pos
    path = []
    for _ in range(n):
        nx, ny = x + dx, y + dy
        if not (0 <= nx < lvl.w and 0 <= ny < lvl.h) or lvl.grid[ny][nx] == T_WALL:
            break
        x, y = nx, ny
        path.append((x, y))
    if not path:
        return state, "bump", ()
    turn += 1
    land = (x, y)
    tile = lvl.grid[y][x]
    if tile == T_PIT or land == chaser:
        return (lvl.start, None, lvl.post, turn), "back", tuple(path)
    if tile == T_GOAL:
        return (land, None, chaser, turn), "win", tuple(path)
    face = lvl.stones.get(land)
    moved = chaser_step(lvl, chaser, land)
    if moved == land:
        return (lvl.start, None, lvl.post, turn), "back", tuple(path)
    return (land, face, moved, turn), ("stone" if face else "move"), tuple(path)


# ============================================================================
# Drawing
# ============================================================================

# Pips on a 3x3 slot grid, as (column, row). Faces 1-6 are standard dice; 9 is
# the "tumbling" face shown for one frame when the die is tossed.
PIP_GRID = {
    0: (),
    1: ((1, 1),),
    2: ((0, 0), (2, 2)),
    3: ((0, 0), (1, 1), (2, 2)),
    4: ((0, 0), (2, 0), (0, 2), (2, 2)),
    5: ((0, 0), (2, 0), (1, 1), (0, 2), (2, 2)),
    6: ((0, 0), (0, 1), (0, 2), (2, 0), (2, 1), (2, 2)),
    9: tuple((c, r) for r in range(3) for c in range(3)),
}

# Fx describes one frame: the player's and the chaser's top-left pixels (cx is
# None when there is no chaser), the face the strip die shows, whether the strip
# die is drawn inverted, how the player is drawn (0 normal, 1 pink flash, 2
# yellow, 3 an inverted stone face in place of the player) and that stone face.
Fx = namedtuple("Fx", "px py cx cy die hud_inv pmode pface")


def tile_px(pos):
    return (MAP_X + CELL * pos[0], MAP_Y + CELL * pos[1])


def face_of(lvl, state):
    """The face the next direction press will use."""
    return state[1] or lvl.tape[state[3] % TAPE_LEN]


def rest_fx(lvl, state):
    px, py = tile_px(state[0])
    cx = cy = None
    if state[2] is not None:
        cx, cy = tile_px(state[2])
    return Fx(px, py, cx, cy, face_of(lvl, state), False, 0, 0)


def draw_board(lvl):
    """The unchanging picture of a level: the strip, the border and every tile."""
    bg = np.full((64, 64), C_BLACK, dtype=np.int8)
    bg[0:BAND_H, :] = C_BLUE
    for y in range(lvl.h):
        for x in range(lvl.w):
            px, py = tile_px((x, y))
            tile = lvl.grid[y][x]
            if tile == T_WALL:
                bg[py:py + CELL, px:px + CELL] = C_BLUE
            elif tile == T_PIT:
                bg[py:py + CELL, px:px + CELL] = C_RED
                bg[py + 1:py + 4, px + 1:px + 4] = C_MAROON
            elif tile == T_GOAL:
                bg[py:py + CELL, px:px + CELL] = C_YELLOW
                for cx, cy in ((0, 0), (4, 0), (0, 4), (4, 4)):
                    bg[py + cy, px + cx] = C_GREEN
            else:
                bg[py:py + CELL, px:px + CELL] = C_GREEN
    for (x, y), face in lvl.stones.items():
        px, py = tile_px((x, y))
        bg[py:py + CELL, px:px + CELL] = C_WHITE
        for c, r in PIP_GRID[face]:
            bg[py + 1 + r, px + 1 + c] = C_BLACK
    return bg


def draw_die(frame, face, inverted):
    body, pip = (C_BLACK, C_WHITE) if inverted else (C_WHITE, C_BLACK)
    frame[DIE_Y:DIE_Y + DIE, DIE_X:DIE_X + DIE] = body
    for c, r in PIP_GRID[face]:
        x, y = DIE_X + 1 + 3 * c, DIE_Y + 1 + 3 * r
        frame[y:y + 2, x:x + 2] = pip


def draw_chaser(frame, x, y):
    frame[y:y + CELL, x:x + CELL] = C_PINK
    for cx, cy in ((0, 0), (4, 0), (0, 4), (4, 4)):
        frame[y + cy, x + cx] = C_GREEN
    frame[y + 1, x + 1] = C_BLACK
    frame[y + 1, x + 3] = C_BLACK


def draw_player(frame, fx):
    x, y = fx.px, fx.py
    if fx.pmode == 3:
        frame[y:y + CELL, x:x + CELL] = C_BLACK
        for c, r in PIP_GRID[fx.pface]:
            frame[y + 1 + r, x + 1 + c] = C_WHITE
        return
    body = {0: C_PURPLE, 1: C_PINK, 2: C_YELLOW}[fx.pmode]
    frame[y:y + CELL, x:x + CELL] = body
    frame[y + 1, x + 1] = C_BLACK
    frame[y + 1, x + 3] = C_BLACK


class Dw01Display(RenderableUserDisplay):
    """Draws the whole 64x64 frame from the game's state (no sprites are used)."""

    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        g = self.game
        frame[:, :] = g._bg
        fx = g._fx if g._fx is not None else rest_fx(g.rules, g.tstate)
        draw_die(frame, fx.die, fx.hud_inv)
        if fx.cx is not None:
            draw_chaser(frame, fx.cx, fx.cy)
        draw_player(frame, fx)
        return frame


# ============================================================================
# Showing a decided turn (presentation only: nothing here changes the rules)
# ============================================================================


def _lerp(a, b, k, n):
    d = b - a
    step = abs(d) * k // n
    return a + (step if d >= 0 else -step)


def _chaser_halfway(c0, c1):
    return (_lerp(c0[0], c1[0], 1, 2), _lerp(c0[1], c1[1], 1, 2))


def build_frames(lvl, old, new, event, path, action):
    """Frames to show for one decided press: (frames before the last one, last).

    The last frame is None (draw the settled new state) except on a win, where it
    holds the player on the goal until the level changes."""
    pos0, _f0, ch0, _t0 = old
    die0 = face_of(lvl, old)
    die1 = face_of(lvl, new)
    p0 = tile_px(pos0)
    c0 = tile_px(ch0) if ch0 is not None else None

    def fx(p, c=c0, die=die0, inv=False, mode=0, pface=0):
        cx, cy = (c if c is not None else (None, None))
        return Fx(p[0], p[1], cx, cy, die, inv, mode, pface)

    if event == "bump":
        dx, dy = DIRS[action]
        return [fx((p0[0] + dx, p0[1] + dy))], None

    if action == 5:
        frames = [fx(p0, die=0), fx(p0, die=9)]
        if event == "toss":
            att = chaser_step(lvl, ch0, pos0)
            if att != ch0:
                frames.append(fx(p0, die=die1))
                frames.append(fx(p0, c=_chaser_halfway(c0, tile_px(att)), die=die1))
            return frames, None
        # a toss that let the chaser step onto the player
        att = chaser_step(lvl, ch0, pos0)
        frames.append(fx(p0, die=die1))
        frames.append(fx(p0, c=_chaser_halfway(c0, tile_px(att)), die=die1))
        frames.append(fx(p0, c=tile_px(att), die=die1, mode=1))
        return frames, None

    end = tile_px(path[-1])
    land = path[-1]
    stride = min(2 * len(path), 8)

    def stride_frames(count):
        return [fx((_lerp(p0[0], end[0], k, count), _lerp(p0[1], end[1], k, count))) for k in range(1, count + 1)]

    if event == "win":
        frames = stride_frames(stride)
        frames.append(fx(end, mode=2))
        return frames, fx(end, mode=2)

    if event == "back":
        pit = lvl.grid[land[1]][land[0]] == T_PIT
        if pit or land == ch0:
            # flash pink where you landed, then be back at the start
            return stride_frames(stride) + [fx(end, mode=1)], None
        # you landed on plain floor and the chaser then stepped onto you
        att = chaser_step(lvl, ch0, land)
        frames = stride_frames(stride)
        frames.append(fx(end, c=_chaser_halfway(c0, tile_px(att))))
        frames.append(fx(end, c=tile_px(att), mode=1))
        return frames, None

    # "move" or "stone": you stand on the tile you landed on
    att = chaser_step(lvl, ch0, land)
    steps = att != ch0
    extras = []
    if event == "stone":
        extras.append(fx(end, die=die1, inv=True, mode=3, pface=die1))
    if steps:
        extras.append(fx(end, c=_chaser_halfway(c0, tile_px(att)), die=die1))
    frames = stride_frames(stride) + extras
    if not extras:
        frames = frames[:-1]      # the settled frame is the arrival
    return frames, None


# ============================================================================
# Game
# ============================================================================


class Dw01(ARCBaseGame):
    def __init__(self):
        self.display = Dw01Display(self)
        self.rules = None
        self.tstate = None
        self._bg = None
        self._fx = None
        self._pre = []
        self._final = None
        self._pending = None

        levels = [
            Level(sprites=[], grid_size=(64, 64), data=spec, name=spec["name"])
            for spec in LEVELS
        ]
        super().__init__(
            "dw01",
            levels,
            Camera(0, 0, 64, 64, C_BLACK, C_BLACK, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5],
        )

    def on_set_level(self, level):
        """Start (or restart) a level: the same board, the same tape, turn zero."""
        self.rules = build_rules(self.level_index)
        self.tstate = start_state(self.rules)
        self._bg = draw_board(self.rules)
        self._fx = None
        self._pre = []
        self._final = None
        self._pending = None

    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if self._pending is None:
            aid = self.action.id.value
            if aid not in (1, 2, 3, 4, 5):
                self.complete_action()
                return
            new, event, path = resolve_turn(self.rules, self.tstate, aid)
            self._pre, self._final = build_frames(self.rules, self.tstate, new, event, path, aid)
            self._pending = (new, event)
        if self._pre:
            self._fx = self._pre.pop(0)
            return
        new, event = self._pending
        self.tstate = new
        self._pending = None
        self._fx = self._final
        self._final = None
        if event == "win":
            self.next_level()
        self.complete_action()
