# ARC-AGI-3 candidate task g012.

import numpy as np


from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    RenderableUserDisplay,
    Sprite,
)


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def facing(body: int, visor: int, heading: tuple, cell: int = 4) -> list[list[int]]:
    px = rounded(body, cell)
    dx, dy = heading
    last = cell - 1
    if dy < 0:
        px[0][1] = px[0][cell - 2] = visor
    elif dy > 0:
        px[last][1] = px[last][cell - 2] = visor
    elif dx < 0:
        px[1][0] = px[cell - 2][0] = visor
    elif dx > 0:
        px[1][last] = px[cell - 2][last] = visor
    else:
        px[1][1] = visor
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

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 15
WALL = 5
PLAYER = 7
PLAYER_CORE = 5
GUARD = 8
GUARD_VISOR = 0
TRAIL = 2
COIN = 11
COIN_CORE = 12
EXIT_SHUT = 2
EXIT_OPEN = 9
PIP_ON = COIN
PIP_OFF = 2
DECOR_A = 6
DECOR_B = 10

N = 16
CELL = 4
PERIOD = 8
TRAIL_LEN = 3

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0), ".": (0, 0)}

LEVELS_SPEC = [
    {
        "rows": [
            "################",
            "#..............#",
            "#..P...........#",
            "#..............#",
            "#....########..#",
            "#..............#",
            "#....C.........#",
            "#..............#",
            "#..........C...#",
            "#..............#",
            "#..####........#",
            "#..............#",
            "#.........X....#",
            "#..............#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (7, 7), "offset": 5,
             "routes": ["RRRRLLLL", "DDDDUUUU"]},
        ],
    },
    {
        "rows": [
            "################",
            "#..............#",
            "#..P...........#",
            "#..............#",
            "#...C......C...#",
            "#..............#",
            "#....######....#",
            "#..............#",
            "#..............#",
            "#....C.........#",
            "#..............#",
            "#......###.....#",
            "#..............#",
            "#...........X..#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (3, 8), "offset": 0,
             "routes": ["RRRRLLLL", "DDDDUUUU", "RRDDLLUU"]},
        ],
    },
    {
        "rows": [
            "################",
            "#..............#",
            "#.P............#",
            "#..............#",
            "#...C.....C....#",
            "#..............#",
            "#..####...####.#",
            "#..............#",
            "#..............#",
            "#......C.......#",
            "#..............#",
            "#..............#",
            "#..#####.......#",
            "#............X.#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (4, 8), "offset": 0,
             "routes": ["RRRRLLLL", "RRDDLLUU"]},
            {"anchor": (9, 8), "offset": 4,
             "routes": ["UUUUDDDD", "LLLLRRRR", "UULLDDRR"]},
        ],
    },
    {
        "rows": [
            "################",
            "#..............#",
            "#..P...........#",
            "#..............#",
            "#..C.......C...#",
            "#..............#",
            "#...#####......#",
            "#..............#",
            "#..............#",
            "#..C.......C...#",
            "#..............#",
            "#......####....#",
            "#..............#",
            "#.......X......#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (2, 8), "offset": 1,
             "routes": ["RRRRLLLL", "UUUUDDDD", "RRDDLLUU"]},
            {"anchor": (12, 7), "offset": 0,
             "routes": ["LLLLRRRR", "DDDDUUUU", "LLDDRRUU", "RLRLRLRL"]},
        ],
    },
    {
        "rows": [
            "################",
            "#..............#",
            "#.P............#",
            "#..............#",
            "##########.#####",
            "#..............#",
            "#..C........C..#",
            "#..............#",
            "#####.##########",
            "#..............#",
            "#..C........C..#",
            "#..............#",
            "##########.#####",
            "#.....X........#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (10, 4), "offset": 0,
             "routes": ["DDDUUU..", "UUUDDD..", "........", "DDUUDDUU"]},
            {"anchor": (5, 8), "offset": 0,
             "routes": ["UUUDDD..", "........", "DDDUUU.."]},
        ],
    },
    {
        "rows": [
            "################",
            "#..............#",
            "#..P...........#",
            "#..............#",
            "#..C........C..#",
            "#..............#",
            "#....######....#",
            "#..............#",
            "#..............#",
            "#..C........C..#",
            "#..............#",
            "#....#####.....#",
            "#..............#",
            "#......X.......#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (5, 8), "offset": 0,
             "routes": ["RRRRLLLL", "RRDDLLUU"]},
            {"anchor": (12, 9), "offset": 3,
             "routes": ["UUUUDDDD", "LLLLRRRR", "LLUURRDD"]},
            {"anchor": (7, 12), "offset": 5,
             "routes": ["LLLLRRRR", "RRRRLLLL", "RLRLRLRL", "LLRRLLRR"]},
        ],
    },
    {
        "rows": [
            "################",
            "#..............#",
            "#.P............#",
            "#..............#",
            "#..C.......C...#",
            "#..............#",
            "#..####...####.#",
            "#..............#",
            "#......C.......#",
            "#..............#",
            "#..####...####.#",
            "#..............#",
            "#..C.......C...#",
            "#..........X...#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (5, 8), "offset": 0,
             "routes": ["RRRRLLLL", "RLRLRLRL"]},
            {"anchor": (8, 8), "offset": 0,
             "routes": ["UUUUDDDD", "LLLLRRRR", "RRRRLLLL"]},
            {"anchor": (7, 13), "offset": 0,
             "routes": ["LLLLRRRR", "RRRRLLLL", "LLRRLLRR", "RLRLRLRL"]},
        ],
    },
    {
        "rows": [
            "################",
            "#...........#C.#",
            "#.P.........#..#",
            "#...........#..#",
            "###.#####.####.#",
            "#..............#",
            "#..C.......C...#",
            "#..............#",
            "#.####.###.###.#",
            "#..............#",
            "#....C.....C...#",
            "#..............#",
            "#.###.####.###.#",
            "#....X.........#",
            "#..............#",
            "################",
        ],
        "guards": [
            {"anchor": (6, 5), "offset": 0,
             "routes": ["RRRRLLLL", "LLLLRRRR"]},
            {"anchor": (9, 9), "offset": 3,
             "routes": ["LLLLRRRR", "RRRRLLLL", "RLRLRLRL"]},
            {"anchor": (7, 7), "offset": 5,
             "routes": ["RRRRLLLL", "LLLLRRRR", "RLRLRLRL", "LRLRLRLR"]},
            {"anchor": (14, 4), "offset": 0,
             "routes": ["DDDDUUUU", "........", "DDUUDDUU"]},
        ],
    },
]


def walls(spec) -> set:
    return {(x, y) for y, r in enumerate(spec["rows"])
            for x, c in enumerate(r) if c == "#"}


def find(spec, ch) -> list:
    return [(x, y) for y, r in enumerate(spec["rows"])
            for x, c in enumerate(r) if c == ch]


def route_cells(spec, guard, route: str) -> list:
    if len(route) != PERIOD:
        raise ValueError(f"route {route!r} is not {PERIOD} steps")
    blocked = walls(spec)
    x, y = guard["anchor"]
    cells = []
    for ch in route:
        cells.append((x, y))
        dx, dy = DIRS[ch]
        x, y = x + dx, y + dy
        if (x, y) in blocked or not (0 <= x < N and 0 <= y < N):
            raise ValueError(f"route {route!r} from {guard['anchor']} enters a wall at {(x, y)}")
    if (x, y) != tuple(guard["anchor"]):
        raise ValueError(f"route {route!r} from {guard['anchor']} does not close")
    return cells


ROUTES = [[[route_cells(s, g, r) for r in g["routes"]] for g in s["guards"]]
          for s in LEVELS_SPEC]


def guard_cells(level: int, phase: int, tick: int) -> tuple:
    out = []
    for gi, guard in enumerate(LEVELS_SPEC[level]["guards"]):
        fam = ROUTES[level][gi]
        cells = fam[phase % len(fam)]
        out.append(cells[(tick + guard["offset"]) % PERIOD])
    return tuple(out)


def resolve(level: int, pos, coins: frozenset, tick: int, move):
    spec = LEVELS_SPEC[level]
    blocked = walls(spec)
    dx, dy = move
    nx, ny = pos[0] + dx, pos[1] + dy
    if not (0 <= nx < N and 0 <= ny < N) or (nx, ny) in blocked:
        nx, ny = pos
    new_pos = (nx, ny)
    new_coins = coins - {new_pos} if new_pos in coins else coins
    phase = len(spec["coins_all"]) - len(new_coins)
    ntick = tick + 1
    before = guard_cells(level, phase, tick)
    after = guard_cells(level, phase, ntick)
    dead = new_pos in after
    if not dead:
        for b, a in zip(before, after):
            if b == new_pos and a == pos:
                dead = True
                break
    return new_pos, new_coins, ntick, dead


for _spec in LEVELS_SPEC:
    _spec["coins_all"] = frozenset(find(_spec, "C"))
    _spec["start"] = find(_spec, "P")[0]
    _spec["exit"] = find(_spec, "X")[0]


def _block(colour: int) -> list:
    return [[colour] * CELL for _ in range(CELL)]


def _dot(colour: int) -> list:
    px = [[-1] * CELL for _ in range(CELL)]
    px[1][1] = px[1][2] = px[2][1] = px[2][2] = colour
    return px


def _coin(colour: int) -> list:
    return medallion(colour, COIN_CORE, CELL)


def _guard(heading: tuple) -> list:
    return facing(GUARD, GUARD_VISOR, heading, CELL)


def _intruder(lit: bool = False) -> list:
    body = GUARD if lit else PLAYER
    return [[-1, -1, body, -1],
            [-1, body, body, body],
            [body, body, PLAYER_CORE, body],
            [-1, body, -1, body]]


def _fixture(phase: int, seed: int) -> list:
    return fixture((DECOR_A, DECOR_B, WALL), phase, seed, CELL)


def build_levels() -> list:
    levels = []
    for li, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_block(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                    if (x * 7 + y * 3) % 5 == 0:
                        sprites.append(Sprite(
                            pixels=_fixture(0, (x + y) % 3), name=f"fix_{x}_{y}",
                            blocking=BlockingMode.NOT_BLOCKED,
                            interaction=InteractionMode.INTANGIBLE, layer=0,
                            tags=["decor"],
                        ).set_position(px, py))
                elif char == "C":
                    sprites.append(Sprite(
                        pixels=_coin(COIN), name=f"coin_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0, tags=["coin"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_block(EXIT_OPEN), name="exit_open",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                    sprites.append(Sprite(
                        pixels=_block(EXIT_SHUT), name="exit_shut",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
        sx, sy = spec["start"]
        sprites.append(Sprite(
            pixels=_intruder(), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        for gi in range(len(spec["guards"])):
            for k in range(TRAIL_LEN):
                cx, cy = guard_cells(li, 0, -1 - k)[gi]
                sprites.append(Sprite(
                    pixels=_dot(TRAIL), name=f"trail_{gi}_{k}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0,
                ).set_position(cx * CELL, cy * CELL))
            gx, gy = guard_cells(li, 0, 0)[gi]
            sprites.append(Sprite(
                pixels=_guard((0, 0)), name=f"guard_{gi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(gx * CELL, gy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G012A(RenderableUserDisplay):

    def __init__(self, game: "G012") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        total = len(LEVELS_SPEC[self._game.level_index]["coins_all"])
        got = total - len(self._game.coins)
        for i in range(total):
            top = 6 + i * 6
            if top + 2 > frame.shape[0]:
                break
            frame[top:top + 2, 0:1 + i] = PIP_ON if i < got else PIP_OFF
        return frame


class G012(ARCBaseGame):

    CAUGHT_FRAMES = 6

    def __init__(self) -> None:
        self._caught = 0
        self.pos = LEVELS_SPEC[0]["start"]
        self.coins = LEVELS_SPEC[0]["coins_all"]
        self.tick = 0
        self.deaths = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G012A(self)],
        )
        super().__init__(game_id="g012", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.pos = spec["start"]
        self.coins = spec["coins_all"]
        self.tick = 0
        self._caught = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self) -> None:
        super().full_reset()
        self.deaths = 0
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self) -> None:
        level = self.current_level
        phase = len(LEVELS_SPEC[self.level_index]["coins_all"]) - len(self.coins)
        here = guard_cells(self.level_index, phase, self.tick)
        nxt = guard_cells(self.level_index, phase, self.tick + 1)
        for gi, (gx, gy) in enumerate(here):
            ax, ay = nxt[gi]
            heading = (ax - gx, ay - gy)
            for s in level.get_sprites_by_name(f"guard_{gi}"):
                s.pixels = np.array(_guard(heading))
                s.set_position(gx * CELL, gy * CELL)
            for k in range(TRAIL_LEN):
                tx, ty = guard_cells(self.level_index, phase, self.tick - 1 - k)[gi]
                for s in level.get_sprites_by_name(f"trail_{gi}_{k}"):
                    s.set_position(tx * CELL, ty * CELL)
        for s in level.get_sprites_by_name("player"):
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        for s in level.get_sprites_by_tag("decor"):
            gx, gy = s.x // CELL, s.y // CELL
            s.pixels = np.array(_fixture(self.tick, (gx + gy) % 3))
        if not self.coins:
            for s in level.get_sprites_by_name("exit_shut"):
                level.remove_sprite(s)

    def step(self) -> None:
        if self._caught:
            self._caught -= 1
            for sp in self.current_level.get_sprites_by_name("player"):
                sp.pixels = np.array(_intruder(lit=self._caught % 2 == 0))
            if self._caught == 0:
                self.level_reset()
                self.complete_action()
            return

        move = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
            GameAction.ACTION5: (0, 0),
        }.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        spec = LEVELS_SPEC[self.level_index]
        before_coins = self.coins
        self.pos, self.coins, self.tick, dead = resolve(
            self.level_index, self.pos, self.coins, self.tick, move)
        taken = before_coins - self.coins

        for cx, cy in taken:
            for s in self.current_level.get_sprites_by_name(f"coin_{cx}_{cy}"):
                self.current_level.remove_sprite(s)

        if dead:
            self.deaths += 1
            self._redraw()
            self._caught = self.CAUGHT_FRAMES
            return

        self._redraw()
        if not self.coins and self.pos == spec["exit"]:
            self.next_level()
        self.complete_action()
