# ARC-AGI-3 candidate task g026.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

TIDE_FILL = 9
BANK_WALL = 1
LANTERN_GOAL = 11
WADER_PIP = 6
WRACK_MARK = 5
SILT_MARK = 10
EDDY_INK = (0, 8, 15, 13)

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
        "#o...........#",
        "#.##.##.##.#.#",
        "#.##.##.##.#.#",
        "#......#.....#",
        "######..######",
        "######..######",
        "#######......#",
        "#.....##.....#",
        "#.###....###.#",
        "#.#...*...##.#",
        "#.#........#.#",
        "#..........#.#",
        "##############",
     ], "voices": [
        sustain([(6, 5), (7, 5)], phase=1),
        sustain([(7, 5), (7, 6)], hold=1, phase=2),
        sustain([(6, 5), (6, 6), (7, 6)], hold=1, phase=1),
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
        "#...........##",
        "##=.........##",
        "###.........##",
        "####........##",
        "#####.......##",
        "######......##",
        "######.....###",
        "######.#######",
        "#............#",
        "#....=.......#",
        "#.....*......#",
        "##############",
     ], "voices": [
        sustain([(6, 8), (6, 9)]),
        sustain([(6, 10), (6, 9)], hold=1, phase=2),
        sustain([(6, 7), (6, 8), (6, 9)], hold=1, phase=4),
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


CORNERS = ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1))


def _slab(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _bank(x, y):
    px = _slab(BANK_WALL)
    px[CELL - 1] = [WRACK_MARK] * CELL
    px[0][(x + y) % CELL] = WRACK_MARK
    return px


def _lamp():
    px = _slab(LANTERN_GOAL)
    for (y, x) in CORNERS:
        px[y][x] = -1
    px[1][1] = WRACK_MARK
    px[2][2] = WRACK_MARK
    return px


def _ring(colour):
    px = [[-1] * CELL for _ in range(CELL)]
    for i in range(CELL):
        px[0][i] = px[CELL - 1][i] = colour
        px[i][0] = px[i][CELL - 1] = colour
    for (y, x) in CORNERS:
        px[y][x] = -1
    return px


SWIRL_CORNER = CORNERS


def _swirl(colour, eddy_index):
    px = [[-1] * CELL for _ in range(CELL)]
    ty, tx = SWIRL_CORNER[eddy_index % len(SWIRL_CORNER)]
    px[ty][tx] = colour
    return px


def _silt(colour):
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(CELL)]
            for y in range(CELL)]


def _wader(under):
    px = [row[:] for row in under]
    for j in (1, 2):
        for i in (1, 2):
            px[j][i] = WADER_PIP
    px[0][1] = px[CELL - 1][2] = WRACK_MARK
    return px


def _open_water():
    return [[-1] * CELL for _ in range(CELL)]


def under_face(index, pos, shut):
    if pos in seals_of(index) and pos not in shut:
        return _silt(SILT_MARK)
    return _open_water()


def ripple_lanes(index, count=6):
    rows = LEVELS_SPEC[index]["rows"]
    lanes = [y for y, row in enumerate(rows) if row.count(".") >= 9] or [y for y in range(1, N)]
    return [lanes[i % len(lanes)] for i in range(count)]


def shell_spots(index, count=6):
    rows = LEVELS_SPEC[index]["rows"]
    water = [(x, y) for y, row in enumerate(rows)
             for x, ch in enumerate(row) if ch == "."]
    loops = {c for loop in LEVELS_SPEC[index]["voices"] for c in loop}
    water = [c for c in water if c not in loops and c != start_of(index)]
    stride = max(1, len(water) // count)
    return water[::stride][:count]


def wrack_spots(index, count=5):
    rows = LEVELS_SPEC[index]["rows"]
    out = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." or len(out) == count:
                continue
            near = ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if any(0 <= b < N and 0 <= a < N and rows[b][a] == "#" for a, b in near) \
                    and (x * 3 + y) % 7 == 0:
                out.append((x, y))
    return out


def build_levels():
    levels = []
    for index, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_bank(x, y), name=f"bank_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-3,
                    ).set_position(px, py))
                elif ch == "*":
                    sprites.append(Sprite(
                        pixels=_lamp(), name="lantern",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif ch == "=":
                    sprites.append(Sprite(
                        pixels=_slab(BANK_WALL), name=f"silted_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                    sprites.append(Sprite(
                        pixels=_silt(SILT_MARK), name=f"ford_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))

        for li, lane in enumerate(ripple_lanes(index)):
            sprites.append(Sprite(
                pixels=[[SILT_MARK, -1, SILT_MARK, -1]], name=f"ripple_{li}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-4,
            ).set_position((li * 5) % N * CELL, lane * CELL + 2))
        for si, (sx, sy) in enumerate(shell_spots(index)):
            sprites.append(Sprite(
                pixels=[[EDDY_INK[0]]], name=f"shell_{si}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-4,
            ).set_position(sx * CELL + 2, sy * CELL + 1))
        for wi, (wx, wy) in enumerate(wrack_spots(index)):
            sprites.append(Sprite(
                pixels=[[WRACK_MARK, WRACK_MARK]], name=f"wrack_{wi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-4,
            ).set_position(wx * CELL + 1, wy * CELL + 2))

        for vi, loop in enumerate(spec["voices"]):
            ink = EDDY_INK[vi % len(EDDY_INK)]
            for (cx, cy) in sorted(set(loop)):
                sprites.append(Sprite(
                    pixels=_swirl(ink, vi), name=f"swirl_{vi}_{cx}_{cy}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(cx * CELL, cy * CELL))
            vx, vy = loop[0]
            sprites.append(Sprite(
                pixels=_ring(ink), name=f"eddy_{vi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(vx * CELL, vy * CELL))

        sx, sy = start_of(index)
        sprites.append(Sprite(
            pixels=_wader(under_face(index, (sx, sy), frozenset())), name="wader",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))

        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G026(ARCBaseGame):

    def __init__(self):
        self.pos = start_of(0)
        self.tick = 0
        self.shut = frozenset()
        self.wash = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=TIDE_FILL, letter_box=WRACK_MARK,
        )
        super().__init__(game_id="g026", levels=build_levels(), camera=camera)

    def on_set_level(self, level):
        self.pos = start_of(self.level_index)
        self.tick = 0
        self.shut = frozenset()
        self.wash = 0

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
            for s in level.get_sprites_by_name(f"eddy_{vi}"):
                s.set_position(cx * CELL, cy * CELL)
        for s in level.get_sprites_by_name("wader"):
            s.pixels[:, :] = _wader(under_face(self.level_index, self.pos, self.shut))
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        for (sx, sy) in self.shut:
            for s in level.get_sprites_by_name(f"ford_{sx}_{sy}"):
                level.remove_sprite(s)

    def _dress(self):
        level = self.current_level
        for li, lane in enumerate(ripple_lanes(self.level_index)):
            for s in level.get_sprites_by_name(f"ripple_{li}"):
                s.set_position(((li * 5 + self.wash) % N) * CELL, lane * CELL + 2)
        for wi in range(len(wrack_spots(self.level_index))):
            lit = WRACK_MARK if (self.wash + wi) % 3 else -1
            for s in level.get_sprites_by_name(f"wrack_{wi}"):
                s.pixels[:, :] = [[lit, lit]]

    def step(self):
        move = DIRS.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        self.wash += 1
        self.pos, self.tick, self.shut, dead = advance(
            self.level_index, self.pos, self.tick, self.shut, move)

        if dead:
            self.level_reset()
            self.complete_action()
            return

        self._redraw()
        self._dress()
        if self.pos == goal_of(self.level_index):
            self.next_level()
        self.complete_action()
