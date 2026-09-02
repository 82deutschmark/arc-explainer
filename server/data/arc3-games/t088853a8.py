# ARC-AGI-3 candidate task t088853a8.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

FLOOR = 0
WALL = 2
GOAL = 15
AVATAR = 13
SEAL_MARK = 3
VOICE_INK = (9, 10, 6, 8)

N = 14
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (0, 0),
}


def sustain(cells, hold=0, phase=0):
    cells = [tuple(c) for c in cells]
    if len(cells) == 1:
        return cells
    loop = cells + [cells[-1]] * hold + list(reversed(cells[1:-1]))
    cut = phase % len(loop)
    return loop[cut:] + loop[:cut]


def held(cell):
    return sustain([cell])


LEVELS_SPEC = [
    {"rows": [
        "##############",
        "#............#",
        "#............#",
        "#............#",
        "#....#####...#",
        "#....#...#...#",
        "#....#.*.#...#",
        "#....#...#...#",
        "#....##.##...#",
        "#............#",
        "#............#",
        "#..o.........#",
        "#............#",
        "##############",
     ], "voices": [
        held((7, 8)),
        sustain([(2, 2), (3, 2)]),
        sustain([(11, 10), (11, 9)], hold=1),
        sustain([(2, 5), (2, 6), (2, 7)], hold=1),
     ]},

    {"rows": [
        "##############",
        "#.....#......#",
        "#.....#...*..#",
        "#............#",
        "#.....#......#",
        "#.....#......#",
        "#.....#......#",
        "#.....#......#",
        "###.##########",
        "#............#",
        "#............#",
        "#..o.........#",
        "#............#",
        "##############",
     ], "voices": [
        held((3, 8)),
        sustain([(5, 3), (6, 3)]),
        sustain([(6, 3), (7, 3)], hold=1, phase=1),
        sustain([(3, 10), (4, 10), (5, 10)], hold=1),
     ]},

    {"rows": [
        "##############",
        "#............#",
        "#.##########.#",
        "#.#........#.#",
        "#.#.######.#.#",
        "#.#.#....#.#.#",
        "#.#.#.*..#.#.#",
        "#.#.#....#.#.#",
        "#.#.#....#.#.#",
        "#.#.###.##.#.#",
        "#.#........#.#",
        "#.##.#######.#",
        "#..o.........#",
        "##############",
     ], "voices": [
        sustain([(7, 7), (7, 8)]),
        sustain([(7, 10), (7, 9)], hold=1),
        sustain([(7, 7), (7, 8), (7, 9)], hold=1),
     ]},

    {"rows": [
        "##############",
        "#............#",
        "#..o.........#",
        "#............#",
        "#......#.....#",
        "######..######",
        "######..######",
        "#######......#",
        "#............#",
        "#............#",
        "#......*.....#",
        "#............#",
        "#............#",
        "##############",
     ], "voices": [
        sustain([(6, 5), (7, 5)]),
        sustain([(7, 5), (7, 6)], hold=1, phase=1),
        sustain([(6, 5), (6, 6), (7, 6)], hold=1, phase=4),
     ]},

    {"rows": [
        "##############",
        "#.o..........#",
        "#............#",
        "#####=########",
        "#............#",
        "#......#.....#",
        "######..######",
        "#######.######",
        "#............#",
        "#............#",
        "#.....*......#",
        "#............#",
        "#............#",
        "##############",
     ], "voices": [
        sustain([(6, 6), (7, 6)]),
        sustain([(7, 6), (7, 7)], hold=1, phase=2),
        sustain([(6, 6), (7, 6), (7, 7)], hold=1, phase=1),
     ]},

    {"rows": [
        "##############",
        "#o...........#",
        "#............#",
        "##########=###",
        "#............#",
        "#............#",
        "###=##########",
        "#............#",
        "#............#",
        "######.#######",
        "#............#",
        "#............#",
        "#.....*......#",
        "##############",
     ], "voices": [
        sustain([(6, 8), (6, 9)]),
        sustain([(6, 10), (6, 9)], hold=1),
        sustain([(6, 7), (6, 8), (6, 9)], hold=1),
     ]},
]


def _find(index, mark):
    rows = LEVELS_SPEC[index]["rows"]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == mark:
                return (x, y)
    raise AssertionError(f"level {index} has no {mark!r}")


def start_of(index):
    return _find(index, "o")


def goal_of(index):
    return _find(index, "*")


def seals_of(index):
    rows = LEVELS_SPEC[index]["rows"]
    return [(x, y) for y, row in enumerate(rows)
            for x, ch in enumerate(row) if ch == "="]


def board_period(index):
    from math import gcd
    p = 1
    for loop in LEVELS_SPEC[index]["voices"]:
        p = p * len(loop) // gcd(p, len(loop))
    return p


def voice_cells(index, tick):
    return [loop[tick % len(loop)] for loop in LEVELS_SPEC[index]["voices"]]


def doubled(index, cell, tick):
    return voice_cells(index, tick).count(cell) >= 2


def advance(index, pos, tick, shut, move):
    rows = LEVELS_SPEC[index]["rows"]
    seals = set(seals_of(index))
    nx, ny = pos[0] + move[0], pos[1] + move[1]
    nxt = pos
    if 0 <= nx < N and 0 <= ny < N and rows[ny][nx] != "#" and (nx, ny) not in shut:
        nxt = (nx, ny)
    if nxt != pos and pos in seals:
        shut = shut | frozenset({pos})
    tick += 1
    return nxt, tick, shut, doubled(index, nxt, tick)


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _berth(colour):
    block = [[colour] * CELL for _ in range(CELL)]
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        block[y][x] = -1
    return block


def _rim(colour):
    block = [[colour] * CELL for _ in range(CELL)]
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            block[y][x] = -1
    return block


def _pip(colour):
    block = [[-1] * CELL for _ in range(CELL)]
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            block[y][x] = colour
    return block


_STAVE_CORNER = ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1))


def _stave(colour, voice_index):
    block = [[-1] * CELL for _ in range(CELL)]
    ty, tx = _STAVE_CORNER[voice_index % len(_STAVE_CORNER)]
    block[ty][tx] = colour
    return block


def _hatch(colour):
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(CELL)]
            for y in range(CELL)]


def build_levels():
    levels = []
    for index, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_block(WALL), name=f"bar_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-3,
                    ).set_position(px, py))
                elif ch == "*":
                    sprites.append(Sprite(
                        pixels=_berth(GOAL), name="berth",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif ch == "=":
                    sprites.append(Sprite(
                        pixels=_block(WALL), name=f"shut_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                    sprites.append(Sprite(
                        pixels=_hatch(SEAL_MARK), name=f"seal_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))

        for vi, loop in enumerate(spec["voices"]):
            ink = VOICE_INK[vi % len(VOICE_INK)]
            for (cx, cy) in sorted(set(loop)):
                sprites.append(Sprite(
                    pixels=_stave(ink, vi), name=f"stave_{vi}_{cx}_{cy}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(cx * CELL, cy * CELL))
            vx, vy = loop[0]
            sprites.append(Sprite(
                pixels=_rim(ink), name=f"voice_{vi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(vx * CELL, vy * CELL))

        sx, sy = start_of(index)
        sprites.append(Sprite(
            pixels=_pip(AVATAR), name="mote",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))

        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G5b009c25(ARCBaseGame):

    def __init__(self):
        self.pos = start_of(0)
        self.tick = 0
        self.shut = frozenset()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=WALL,
        )
        super().__init__(game_id="t088853a8", levels=build_levels(), camera=camera)

    def on_set_level(self, level):
        self.pos = start_of(self.level_index)
        self.tick = 0
        self.shut = frozenset()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self):
        level = self.current_level
        for vi, (cx, cy) in enumerate(voice_cells(self.level_index, self.tick)):
            for s in level.get_sprites_by_name(f"voice_{vi}"):
                s.set_position(cx * CELL, cy * CELL)
        for s in level.get_sprites_by_name("mote"):
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        for (sx, sy) in self.shut:
            for s in level.get_sprites_by_name(f"seal_{sx}_{sy}"):
                level.remove_sprite(s)

    def step(self):
        move = DIRS.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        self.pos, self.tick, self.shut, dead = advance(
            self.level_index, self.pos, self.tick, self.shut, move)

        if dead:
            self.level_reset()
            self.complete_action()
            return

        self._redraw()
        if self.pos == goal_of(self.level_index):
            self.next_level()
        self.complete_action()
