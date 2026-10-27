# Author: GPT 6.1 Sol
# Date: 25-October-2026
# PURPOSE: Standalone g011 feedback revision of reviewed source 264fe3439d26.
# Fixed solid stopping shelves support sliding, one-cell rock pushes, pit plugs and
# switch parity. Visible falls retry the pre-slide state without deleting Undo;
# RESET retries the current board and keeps completed levels. No runtime route oracle.
# Integration: arcengine 0.9.3; numpy; imported transition functions power the verifier.
# SRP/DRY check: Pass - preserves the reviewed movement rules and inlined shared art.

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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def ring(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = -1
    return px

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
    return px

def figure(body: int, mark: int | None = None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    mid = cell // 2
    for x in range(1, cell - 1):
        px[0][x] = body
    for y in range(1, cell - 1):
        for x in range(cell):
            px[y][x] = body
    px[cell - 1][0] = px[cell - 1][mid] = -1
    for x in range(cell):
        if px[cell - 1][x] != -1:
            px[cell - 1][x] = body
    px[cell - 1][1] = body
    px[cell - 1][cell - 1] = body
    if mark is not None and cell >= 4:
        px[mid][mid] = mark
    return px

def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for x in range(1, last):
        px[0][x] = px[last][x] = rim
    for y in range(1, last):
        px[y][0] = px[y][last] = rim
    for y in range(1, last):
        for x in range(1, last):
            px[y][x] = centre
    return px

def door(frame_colour: int, bar: int | None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for y in range(cell):
        px[y][0] = px[y][last] = frame_colour
    for x in range(cell):
        px[0][x] = frame_colour
    if bar is not None:
        for y in range(1, cell):
            for x in range(1, last):
                px[y][x] = bar
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 0
WALL = 9
STONE = 12
PIT = 13
PLUG = 12
SWITCH = 15
GATE = 15
GATE_FILL = 9
GOAL = 14
PLAYER = 8
GRIT = 3

LEVELS_SPEC = [['################',
  '#.#..#.#.......#',
  '#..............#',
  '#..P#...#..#...#',
  '#..##.#..#.....#',
  '#.......#..##..#',
  '#..........##..#',
  '##....#X#.#....#',
  '#......#.##....#',
  '##...........###',
  '#...#........###',
  '#............#.#',
  '#............###',
  '#.......#.##...#',
  '###..........#.#',
  '################'],
 ['################',
  '#^.#....###...##',
  '#.P......##....#',
  '#...#...#.^.^.##',
  '##.......#...#.#',
  '#^.#.#.....#..##',
  '#..#.#.#......##',
  '#.........#....#',
  '#..#...........#',
  '#.#...#....#..##',
  '#....#.#.......#',
  '##.....##.#..#.#',
  '#...#^..#..X#..#',
  '#..#....#..#..##',
  '#..............#',
  '################'],
 ['################',
  '#.#......#.....#',
  '#......#...#...#',
  '#...##.........#',
  '#..#...#.......#',
  '#.P#.....O..#..#',
  '#............#.#',
  '#..#.....#..#..#',
  '##.#........#..#',
  '#.......#.....##',
  '#...##.#.#.....#',
  '#..#...........#',
  '##..##...X..#.##',
  '#....#...#.....#',
  '#.#..#...#.....#',
  '################'],
 ['################',
  '#..............#',
  '#.P..#.#.......#',
  '#....#....#....#',
  '#..##......##..#',
  '#.....O....#...#',
  '#........#.....#',
  '#.#..........#.#',
  '#.#..#.#..#..#.#',
  '#.....^........#',
  '#..#.........#.#',
  '#.......##.....#',
  '#.....#X##.....#',
  '#......#....#..#',
  '#..............#',
  '################'],
 ['################',
  '#..............#',
  '#.P#.......s...#',
  '#......##......#',
  '#...##....#....#',
  '#...#...#......#',
  '#..............#',
  '#.##.#......#..#',
  '#....a..X#.....#',
  '##...........#.#',
  '#......#....#..#',
  '#.......#....#.#',
  '#.#..........#.#',
  '#...#...#......#',
  '#..............#',
  '################'],
 ['################',
  '#..............#',
  '#.P...s....s.#.#',
  '#..#...........#',
  '#.........#....#',
  '#.....#........#',
  '#.....##..#....#',
  '#...#.s........#',
  '#....#.........#',
  '#..........#...#',
  '#....#...#aX#..#',
  '##...##...##...#',
  '#.#............#',
  '#.##...........#',
  '#......#.......#',
  '################'],
 ['################',
  '#.#..s.......P.#',
  '#.##....#.#.#..#',
  '#...........#..#',
  '#..............#',
  '#....#.........#',
  '#..........#...#',
  '#.......#....#.#',
  '#.ss.....Xb....#',
  '##.#........#..#',
  '#.....#..#.....#',
  '#.......#..#.#.#',
  '#..##...#.#....#',
  '#.....#........#',
  '#..............#',
  '################'],
 ['################################################################',
  '################################################################',
  '################################################################',
  '###..........................................................###',
  '###..........................................................###',
  '###..........................................................###',
  '###..........................................................###',
  '###....P...........................##........................###',
  '###................................##........................###',
  '###................................##........................###',
  '###................................##........................###',
  '###............##..................##........................###',
  '###.....######.##...#####..........##........................###',
  '###X...........##...#####........##..........................###',
  '###............##...#####........##..........................###',
  '###........##...############................#######..........###',
  '###........##...............................#######..........###',
  '###........##.............................####...............###',
  '###........##.............................####...............###',
  '###........##...............##............####.........#########',
  '###..........#..............##...............................###',
  '###..........#..............##...............................###',
  '###..........#..............##...................####........###',
  '###..........#..............##...............................###',
  '###..........#..............##...............................###',
  '###..........#..............##...............................###',
  '###..........#...............................................###',
  '###..........................................................###',
  '###.............................###...............##.........###',
  '###...############..............###........#######...........###',
  '###..........................................................###',
  '###..........................................................###',
  '###..........................................................###',
  '###........#.................................................###',
  '###........##................................................###',
  '###........##....................###.........................###',
  '###...#######....................###.........................###',
  '###...#######................................................###',
  '###....#####.................##########............#####.....###',
  '###........#....######.......##########......................###',
  '###........#....######.......................................###',
  '###........#....######.......................................###',
  '###........#.................................................###',
  '###........#..........................................##.....###',
  '###...................................................##.....###',
  '###...................................................####...###',
  '###...................................................####...###',
  '###........................###....................###...##...###',
  '###.............###.........#.....................###...##...###',
  '###.........................#................................###',
  '###.........................#...##...........................###',
  '###.........................#...##...........................###',
  '###.........................#...##...........................###',
  '###...##....................#...##...........................###',
  '###...##..........#######...#...##.......#########...........###',
  '###...##....#########.......#...##....############...........###',
  '###...##....#########...........##....####...................###',
  '###...##........................##...........................###',
  '###...##.....................................................###',
  '###...##.....................................................###',
  '###...##.....................................................###',
  '################################################################',
  '################################################################',
  '################################################################'],
 ['################################################################',
  '################################################################',
  '################################################################',
  '###......................................#######.............###',
  '#####....................................#######.............###',
  '#####...................##...................................###',
  '###.....................##...................................###',
  '###....P................#####................................###',
  '###.....................#####................................###',
  '###..............############...............##...............###',
  '###..............##########.................##....##.........###',
  '###.........................................##....##.........###',
  '###...............####......................##....##.........###',
  '###...............####.......###########....##....##.........###',
  '###...............####....................#.##....##.........###',
  '###...............####....................#.##....##.........###',
  '###.......................................#.##....##.........###',
  '###.......................................#.##...............###',
  '###.........................................##...............###',
  '###.........................................##...............###',
  '###..............................####.......##...............###',
  '###..............................####........................###',
  '###..............................####........................###',
  '###..........................................................###',
  '###..........................................................###',
  '###..........................................................###',
  '###..........................................................###',
  '###.........................................#####............###',
  '###..................................##################......###',
  '###..................................##################......###',
  '###X....................................######..#######......###',
  '###...................#######.............#.....#######......###',
  '###...................#######..................#.............###',
  '###..........########.#######......#...........#.............###',
  '###..........########.#######......#...........#...#######...###',
  '###................................#...........#...#######...###',
  '###................................#...........#...########..###',
  '###................................#...........#.........##..###',
  '###................................#........###########..##..###',
  '###................................#.........................###',
  '###................................#......#######............###',
  '###.......................................########...........###',
  '###...........................................####...........###',
  '###.......................................#...........##########',
  '###.......................................#..................###',
  '###......########.........................#..................###',
  '###......########.........................#..................###',
  '###......##...............................#......#########...###',
  '###......##..................................................###',
  '###......##............#########.............................###',
  '###......#####...............................................###',
  '###.............................................###..........###',
  '###.............................................###..........###',
  '###.............................................###......#######',
  '###.............................................###......#######',
  '###......................#...............................#######',
  '###............###########............................#......###',
  '###............###########............................#......###',
  '###......................#............................#......###',
  '###......................#...................................###',
  '###......................#...................................###',
  '################################################################',
  '################################################################',
  '################################################################']]

N = 16
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}


def start_state(rows):
    player = None
    rocks = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                player = (x, y)
            elif ch == "O":
                rocks.add((x, y))
    if player is None:
        raise AssertionError("level has no start")
    return player, frozenset(rocks), frozenset(), 0


def _terrain(rows, x, y):
    ch = rows[y][x]
    return "." if ch in "PO" else ch


def _open_to_player(rows, pos, rocks, filled, parity):
    x, y = pos
    if not (0 <= y < len(rows) and 0 <= x < len(rows[y])):
        return False
    if pos in rocks:
        return False
    t = _terrain(rows, x, y)
    if t == "#":
        return False
    if t == "a":
        return parity % 2 == 1
    if t == "b":
        return parity % 2 == 0
    return True


def _open_to_rock(rows, pos, rocks, filled, parity):
    x, y = pos
    if not (0 <= y < len(rows) and 0 <= x < len(rows[y])):
        return False
    if pos in rocks:
        return False
    t = _terrain(rows, x, y)
    if t in ("#", "X"):
        return False
    if t == "a":
        return parity % 2 == 1
    if t == "b":
        return parity % 2 == 0
    return True


def resolve_slide(rows, player, rocks, filled, parity, d):
    dx, dy = d
    rocks = set(rocks)
    filled = set(filled)
    x, y = player
    while True:
        nxt = (x + dx, y + dy)
        if nxt in rocks:
            beyond = (nxt[0] + dx, nxt[1] + dy)
            if _open_to_rock(rows, beyond, rocks, filled, parity):
                rocks.discard(nxt)
                if _terrain(rows, beyond[0], beyond[1]) == "^" and beyond not in filled:
                    filled.add(beyond)
                else:
                    rocks.add(beyond)
                x, y = nxt
                if _terrain(rows, x, y) == "s":
                    parity += 1
            break
        if not _open_to_player(rows, nxt, rocks, filled, parity):
            break
        x, y = nxt
        t = _terrain(rows, x, y)
        if t == "^" and (x, y) not in filled:
            return (x, y), frozenset(rocks), frozenset(filled), parity, True
        if t == "s":
            parity += 1
    return (x, y), frozenset(rocks), frozenset(filled), parity, False


def slide_path(rows, player, rocks, filled, parity, d):
    dx, dy = d
    rocks = set(rocks)
    filled = set(filled)
    x, y = player
    path = []
    while True:
        nxt = (x + dx, y + dy)
        if nxt in rocks:
            beyond = (nxt[0] + dx, nxt[1] + dy)
            if _open_to_rock(rows, beyond, rocks, filled, parity):
                rocks.discard(nxt)
                if _terrain(rows, beyond[0], beyond[1]) == "^" and beyond not in filled:
                    filled.add(beyond)
                else:
                    rocks.add(beyond)
                x, y = nxt
                path.append((x, y))
                if _terrain(rows, x, y) == "s":
                    parity += 1
            break
        if not _open_to_player(rows, nxt, rocks, filled, parity):
            break
        x, y = nxt
        path.append((x, y))
        t = _terrain(rows, x, y)
        if t == "^" and (x, y) not in filled:
            break
        if t == "s":
            parity += 1
    return path


def goal_of(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                return (x, y)
    raise AssertionError("level has no goal")


def _over(base, top):
    for y, row in enumerate(top):
        for x, v in enumerate(row):
            if v >= 0:
                base[y][x] = v
    return base


def _wall_px():
    # Blue ice shelves are visibly solid; the pale seam joins adjacent blocks.
    return [[10, WALL, WALL, WALL], [WALL, WALL, WALL, WALL],
            [WALL, WALL, WALL, WALL], [WALL, WALL, WALL, 5]]


def _pit_px():
    # A ragged dark opening with a pink lip, distinct from every solid object.
    return [[-1, 6, -1, 6], [6, PIT, PIT, -1],
            [-1, PIT, PIT, 6], [6, -1, 6, -1]]


def _plug_px():
    return [[-1, PIT, PIT, -1], [PIT, PLUG, 11, PIT],
            [PIT, PLUG, PLUG, PIT], [-1, PIT, PIT, -1]]


def _rock_px():
    # Preserve the rounded moving stone, with a bright split in its face.
    return [[-1, STONE, STONE, -1], [STONE, 11, STONE, STONE],
            [STONE, STONE, 11, STONE], [-1, STONE, STONE, -1]]


def _switch_px(parity=0):
    contact = 11 if parity % 2 else SWITCH
    return [[-1, contact, contact, -1], [-1, SWITCH, SWITCH, -1],
            [SWITCH, SWITCH, SWITCH, SWITCH], [-1, 5, 5, -1]]


def _gate_px(shut):
    return [[GATE, GATE, GATE, GATE], [GATE, GATE_FILL if shut else -1, -1, GATE],
            [GATE, -1, GATE_FILL if shut else -1, GATE], [GATE, -1, -1, GATE]]


def _socket_px():
    # An open, scalloped docking cup rather than another hollow square glyph.
    return [[-1, -1, -1, -1], [GOAL, -1, -1, GOAL],
            [GOAL, 10, 10, GOAL], [-1, GOAL, GOAL, -1]]


def _body_px(mode):
    if mode == "gone":
        return [[-1] * CELL for _ in range(CELL)]
    if mode == "sunk":
        return [[-1, -1, -1, -1], [-1, 6, 6, -1],
                [6, 8, 8, 6], [-1, 6, 6, -1]]
    if mode == "braced":
        return [[-1, PLAYER, PLAYER, -1], [PLAYER, 11, PLAYER, PLAYER],
                [PLAYER, PLAYER, 11, PLAYER], [PLAYER, -1, -1, PLAYER]]
    if mode == "seated":
        return [[-1, 11, 11, -1], [PLAYER, PLAYER, PLAYER, PLAYER],
                [-1, PLAYER, PLAYER, -1], [-1, PLAYER, PLAYER, -1]]
    return figure(PLAYER, 11, CELL)


def _grit_px(x, y, phase):
    return fixture((GRIT, FLOOR, FLOOR), phase, (x * 3 + y) % 3, CELL)


def _grit_cells(rows):
    return [(x, y) for y in range(N) for x in range(N)
            if _terrain(rows, x, y) == "." and (x * 7 + y * 5) % 17 == 0]


def _tile(pixels, name, layer):
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE, layer=layer,
    )


class G011(ARCBaseGame):

    SINK_FRAMES = 6
    DOCK_FRAMES = 2

    def __init__(self):
        self.rows = LEVELS_SPEC[0]
        self.cell = CELL
        self._moving_rock = None
        self.player, self.rocks, self.filled, self.parity = start_state(self.rows)
        self._undo = []
        self._anim = None
        self._outcome = None
        self._tick = 0
        self._grit = []
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=5)
        super().__init__(game_id="g011", levels=self._blank_levels(),
                         camera=camera, available_actions=[1, 2, 3, 4, 7])

    @staticmethod
    def _blank_levels():
        return [Level(sprites=[], grid_size=(N * CELL, N * CELL))
                for _ in LEVELS_SPEC]

    def on_set_level(self, level):
        self.rows = LEVELS_SPEC[self.level_index]
        self.cell = 64 // len(self.rows)
        self._moving_rock = None
        self.player, self.rocks, self.filled, self.parity = start_state(self.rows)
        self._undo = []
        self._anim = None
        self._outcome = None
        self._redraw()

    def handle_reset(self):
        # The engine normally interprets a second RESET at zero action count as a
        # whole-game reset. Here R always retries the current unfinished board.
        if self._score >= self.win_score:
            self.full_reset()
        else:
            self.level_reset()

    def _redraw(self):
        self._paint(self.player, self.rocks, self.filled, self.parity)

    def _paint(self, player, rocks, filled, parity, mode="run"):
        level = self.current_level
        level.remove_all_sprites()
        size = self.cell
        names = {"#": "solid", "^": "pit", "s": "switch", "X": "dock",
                 "a": "gate", "b": "gate"}
        for y, row in enumerate(self.rows):
            for x in range(len(row)):
                terrain = _terrain(self.rows, x, y)
                pixels = None
                shut = parity % 2 == 0 if terrain == "a" else parity % 2 == 1
                if terrain == "#":
                    pixels = _wall_px() if size == CELL else [[WALL]]
                elif terrain == "^":
                    plugged = (x, y) in filled
                    pixels = (_plug_px() if plugged else _pit_px()) if size == CELL else [[PLUG if plugged else PIT]]
                elif terrain == "s":
                    pixels = _switch_px(parity) if size == CELL else [[SWITCH]]
                elif terrain == "X":
                    pixels = _socket_px() if size == CELL else [[GOAL]]
                elif terrain in ("a", "b"):
                    pixels = _gate_px(shut) if size == CELL else [[GATE if shut else FLOOR]]
                if pixels is not None:
                    sprite = _tile(pixels, f"{names[terrain]}_{x}_{y}", -1)
                    level.add_sprite(sprite.set_position(x * size, y * size))
        for index, (x, y) in enumerate(sorted(rocks)):
            pixels = _rock_px() if size == CELL else [[STONE]]
            level.add_sprite(_tile(pixels, f"rock_{index}", 1).set_position(x * size, y * size))
        pixels = _body_px(mode) if size == CELL else [[-1, PLAYER, -1], [PLAYER, 0, PLAYER], [-1, PLAYER, -1]]
        if mode == "gone":
            pixels = [[-1] * len(pixels) for _ in pixels]
        offset = 0 if size == CELL else -1
        level.add_sprite(_tile(pixels, "player", 2).set_position(player[0] * size + offset, player[1] * size + offset))
        if size == 1:
            gx, gy = goal_of(self.rows)
            pixels = [[GOAL, -1, GOAL], [-1, -1, -1], [GOAL, -1, GOAL]]
            level.add_sprite(_tile(pixels, "goal_beacon", 0).set_position(gx - 1, gy - 1))

    def _move_body(self, pixel, mode):
        offset=0 if self.cell==CELL else -1
        for sp in self.current_level.get_sprites_by_name('player'):
            art=_body_px(mode) if self.cell==CELL else [[-1,PLAYER,-1],[PLAYER,0,PLAYER],[-1,PLAYER,-1]]
            if mode=='gone':art=[[-1]*len(art) for _ in art]
            sp.pixels=np.array(art,dtype=np.int8)
            sp.set_position(pixel[0]+offset,pixel[1]+offset)
        if self._moving_rock is not None:
            name,start,d=self._moving_rock
            behind=((start[0]-d[0])*self.cell,(start[1]-d[1])*self.cell)
            progress=max(0,min(self.cell,(pixel[0]-behind[0])*d[0]+(pixel[1]-behind[1])*d[1]))
            for sp in self.current_level.get_sprites_by_name(name):
                sp.set_position(start[0]*self.cell+d[0]*progress,start[1]*self.cell+d[1]*progress)

    def _state_now(self):
        return self.player, self.rocks, self.filled, self.parity

    def _feedback(self, mode):
        pixel = self.player[0] * self.cell, self.player[1] * self.cell
        self._outcome = self._state_now()
        self._anim = [(pixel, mode), (pixel, "run")]
        self._move_body(*self._anim.pop(0))

    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if self._anim is not None:
            if self._anim:
                self._move_body(*self._anim.pop(0))
                return
            outcome, self._anim, self._outcome = self._outcome, None, None
            self.player, self.rocks, self.filled, self.parity = outcome
            seated = self.player == goal_of(self.rows)
            self._paint(self.player, self.rocks, self.filled, self.parity,
                        "seated" if seated else "run")
            self._moving_rock = None
            if seated:
                self.next_level()
            self.complete_action()
            return

        act = self.action.id
        if act == GameAction.ACTION7:
            if self._undo:
                self.player, self.rocks, self.filled, self.parity = self._undo.pop()
                self._redraw()
                self.complete_action()
            else:
                self._feedback("braced")
            return
        d = DIRS.get(act)
        if d is None:
            self.complete_action()
            return

        before = self._state_now()
        player, rocks, filled, parity, dead = resolve_slide(self.rows, *before, d)
        after = player, rocks, filled, parity
        if not dead and after == before:
            self._feedback("braced")
            return

        trail = slide_path(self.rows, *before, d)
        pixels = []
        px, py = self.player[0] * self.cell, self.player[1] * self.cell
        for cx, cy in trail:
            tx, ty = cx * self.cell, cy * self.cell
            while (px, py) != (tx, ty):
                px += (tx > px) - (tx < px)
                py += (ty > py) - (ty < py)
                pixels.append((px, py))
        # Long slides remain whole-object motion along their real straight path.
        # A tile moves in two frames; long glides take at most ten travel frames.
        stride = max(2, (len(pixels) + 9) // 10)
        shown = pixels[stride - 1::stride]
        if pixels and (not shown or shown[-1] != pixels[-1]):
            shown.append(pixels[-1])
        frames = [(pixel, "run") for pixel in shown]
        self._moving_rock = None
        if player in self.rocks and (player not in rocks or filled != self.filled):
            index = sorted(self.rocks).index(player)
            self._moving_rock = (f"rock_{index}", player, d)
        if dead:
            # The hole visibly swallows the figure, then recalls the whole action.
            # A failed slide never erases the accepted moves ACTION7 can unwind.
            frames.extend(((player[0] * self.cell, player[1] * self.cell), mode)
                          for mode in ("sunk", "gone", "sunk", "gone"))
            self._outcome = before
        else:
            self._undo.append(before)
            if player == goal_of(self.rows):
                frames.extend(((player[0] * self.cell, player[1] * self.cell), "seated")
                              for _ in range(self.DOCK_FRAMES))
            self._outcome = after
        self._anim = frames
        if self._anim:
            self._move_body(*self._anim.pop(0))
