# ARC-AGI-3 candidate task g012.

import numpy as np

from sprite_book import core, door, facing, figure, medallion, ring, speckle

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

TURF_TILE = 14
PALE_BLOCK = 0
POACHER_FILL = 4
POACHER_MARK = 0
KEEPER_FILL = 12
KEEPER_MARK = 4
SCENT_TRAIL = 12
STONE_FILL = 1
STONE_MARK = 13
GATE_FRAME = 13
GATE_BAR = 0
CAIRN_SOCKET_MARK = 13
CAIRN_MARK = 1
THISTLE_MARK = 1

W = 15
H = 11
CELL = 4
PERIOD = 8
SCENT_LEN = 3
DECOY_PERIOD = 3

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0), ".": (0, 0)}

LEVELS_SPEC = [
    {
        "rows": [
            "###############",
            "#..P..........#",
            "#.............#",
            "#.C.........C.#",
            "#.............#",
            "####.....######",
            "#.............#",
            "#.............#",
            "#.............#",
            "#.........X...#",
            "###############",
        ],
        "keepers": [
            {"anchor": (6, 6), "offset": 2, "rounds": ["RRRRLLLL", "UUUUDDDD"]},
        ],
        "cairn": [(4, 7), (3, 7)],
    },
    {
        "rows": [
            "###############",
            "#.............#",
            "#..P.......C..#",
            "#.............#",
            "#####...#######",
            "#.............#",
            "#..C.......C..#",
            "#.............#",
            "#######...#####",
            "#.......X.....#",
            "###############",
        ],
        "keepers": [
            {"anchor": (6, 5), "offset": 0,
             "rounds": ["RRRRLLLL", "DDUUDDUU", "RRDDLLUU"]},
        ],
        "cairn": [(10, 7), (9, 6), (10, 6)],
    },
    {
        "rows": [
            "###############",
            "#.............#",
            "#.P...........#",
            "#....##..##...#",
            "#..C.......C..#",
            "#.............#",
            "#.....###.....#",
            "#..C.......C..#",
            "#.........X...#",
            "#.............#",
            "###############",
        ],
        "keepers": [
            {"anchor": (2, 5), "offset": 0, "rounds": ["DDDDUUUU", "RRDDLLUU"]},
            {"anchor": (9, 5), "offset": 4,
             "rounds": ["RRRRLLLL", "DDDDUUUU", "RLRLRLRL"]},
        ],
        "cairn": [(8, 5), (7, 4), (8, 4), (7, 5)],
    },
    {
        "rows": [
            "###############",
            "#.P.......#####",
            "#.........#...#",
            "#.........#.C.#",
            "#.........#...#",
            "#.............#",
            "#.........#...#",
            "#.........#.C.#",
            "#.....C...#...#",
            "#...X.....#####",
            "###############",
        ],
        "keepers": [
            {"anchor": (5, 5), "offset": 2, "rounds": ["RRRRLLLL", "DDDDUUUU"]},
            {"anchor": (10, 5), "offset": 0, "rounds": ["LLLLRRRR", "........"]},
        ],
        "cairn": [(8, 3), (7, 2), (8, 2)],
    },
    {
        "rows": [
            "###############",
            "#.C.........C.#",
            "#.............#",
            "#....#####....#",
            "#.P...........#",
            "#.............#",
            "#..####.####..#",
            "#.........C...#",
            "#####.#########",
            "#..X.......C..#",
            "###############",
        ],
        "keepers": [
            {"anchor": (5, 9), "offset": 4,
             "rounds": ["LLLLRRRR", "........", "RLRLRLRL", "LLRRLLRR"]},
            {"anchor": (2, 4), "offset": 7,
             "rounds": ["DDDUUU..", "RRRRLLLL", "DDUUDDUU"]},
        ],
        "cairn": [(9, 5), (8, 4), (9, 4), (8, 5)],
    },
    {
        "rows": [
            "###############",
            "#.C.......#.C.#",
            "#.........#...#",
            "#..P......#...#",
            "#....###..#...#",
            "#.C.......#...#",
            "#.........###.#",
            "#....###......#",
            "#.C.......C...#",
            "#..X..........#",
            "###############",
        ],
        "keepers": [
            {"anchor": (5, 5), "offset": 0, "rounds": ["RRRRLLLL", "RLRLRLRL"]},
            {"anchor": (2, 6), "offset": 3,
             "rounds": ["DDDUUU..", "RRDDLLUU", "UUUDDD.."]},
            {"anchor": (13, 6), "offset": 5,
             "rounds": ["UUUUDDDD", "........", "DDDUUU..", "DDUUDDUU"]},
        ],
        "cairn": [(7, 2), (6, 1), (8, 1), (6, 2), (7, 1)],
    },
]


def walls(spec) -> set:
    return {(x, y) for y, r in enumerate(spec["rows"])
            for x, c in enumerate(r) if c == "#"}


def find(spec, ch) -> list:
    return [(x, y) for y, r in enumerate(spec["rows"])
            for x, c in enumerate(r) if c == ch]


def round_cells(spec, keeper, path: str) -> list:
    if len(path) != PERIOD:
        raise ValueError(f"round {path!r} is not {PERIOD} steps")
    blocked = walls(spec)
    x, y = keeper["anchor"]
    cells = []
    for ch in path:
        cells.append((x, y))
        dx, dy = DIRS[ch]
        x, y = x + dx, y + dy
        if (x, y) in blocked or not (0 <= x < W and 0 <= y < H):
            raise ValueError(f"round {path!r} from {keeper['anchor']} hits stone at {(x, y)}")
    if (x, y) != tuple(keeper["anchor"]):
        raise ValueError(f"round {path!r} from {keeper['anchor']} does not close")
    return cells


ROUNDS = [[[round_cells(s, k, r) for r in k["rounds"]] for k in s["keepers"]]
          for s in LEVELS_SPEC]


def keeper_cells(level: int, phase: int, tick: int) -> tuple:
    out = []
    for ki, keeper in enumerate(LEVELS_SPEC[level]["keepers"]):
        fam = ROUNDS[level][ki]
        cells = fam[phase % len(fam)]
        out.append(cells[(tick + keeper["offset"]) % PERIOD])
    return tuple(out)


def advance(level: int, pos, stones: frozenset, tick: int, move):
    spec = LEVELS_SPEC[level]
    blocked = walls(spec)
    dx, dy = move
    nx, ny = pos[0] + dx, pos[1] + dy
    if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in blocked:
        nx, ny = pos
    new_pos = (nx, ny)
    new_stones = stones - {new_pos} if new_pos in stones else stones
    phase = len(spec["stones_all"]) - len(new_stones)
    ntick = tick + 1
    before = keeper_cells(level, phase, tick)
    after = keeper_cells(level, phase, ntick)
    dead = new_pos in after
    if not dead:
        for b, a in zip(before, after):
            if b == new_pos and a == pos:
                dead = True
                break
    return new_pos, new_stones, ntick, dead


for _spec in LEVELS_SPEC:
    _spec["stones_all"] = frozenset(find(_spec, "C"))
    _spec["start"] = find(_spec, "P")[0]
    _spec["gate"] = find(_spec, "X")[0]
    _spec.setdefault("cairn", [])


def thistles(spec) -> list:
    taken = set(spec["stones_all"]) | {spec["start"], spec["gate"]} | set(spec["cairn"])
    blocked = walls(spec)
    return [(x, y) for y in range(H) for x in range(W)
            if (x * 5 + y * 3) % 11 == 0 and (x, y) not in blocked and (x, y) not in taken]


def _stonework() -> list:
    return [[PALE_BLOCK] * CELL for _ in range(CELL)]


def _scent(age: int) -> list:
    px = [[-1] * CELL for _ in range(CELL)]
    px[1][1] = SCENT_TRAIL
    if age < 2:
        px[2][2] = SCENT_TRAIL
    if age < 1:
        px[1][2] = px[2][1] = SCENT_TRAIL
    return px


def _stone() -> list:
    return medallion(STONE_FILL, STONE_MARK, CELL)


def _keeper(heading: tuple) -> list:
    return facing(KEEPER_FILL, KEEPER_MARK, heading, CELL)


def _poacher(lit: bool = False) -> list:
    return figure(KEEPER_FILL if lit else POACHER_FILL, POACHER_MARK, CELL)


def _gate(shut: bool) -> list:
    return door(GATE_FRAME, GATE_BAR if shut else None, CELL)


def _socket() -> list:
    return ring(CAIRN_SOCKET_MARK, CELL)


def _banked(filled: bool) -> list:
    return core(CAIRN_MARK, CELL) if filled else [[-1] * CELL for _ in range(CELL)]


def _thistle(seed: int) -> list:
    return speckle(THISTLE_MARK, seed, CELL)


def _fitting(phase: int, seed: int) -> list:
    px = [[-1] * CELL for _ in range(CELL)]
    tone = (GATE_FRAME, TURF_TILE, POACHER_FILL)[(phase + seed) % DECOY_PERIOD]
    px[1][1] = px[CELL - 2][CELL - 2] = tone
    return px


def build_levels() -> list:
    levels = []
    for li, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_stonework(), name=f"stonework_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                    if (x * 7 + y * 3) % 5 == 0:
                        sprites.append(Sprite(
                            pixels=_fitting(0, (x + y) % DECOY_PERIOD),
                            name=f"fitting_{x}_{y}",
                            blocking=BlockingMode.NOT_BLOCKED,
                            interaction=InteractionMode.INTANGIBLE, layer=0,
                            tags=["decor"],
                        ).set_position(px, py))
                elif char == "C":
                    sprites.append(Sprite(
                        pixels=_stone(), name=f"stone_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0, tags=["stone"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_gate(True), name="gate",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
        for tx, ty in thistles(spec):
            sprites.append(Sprite(
                pixels=_thistle((tx * 3 + ty) % 5), name=f"thistle_{tx}_{ty}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-1, tags=["decor"],
            ).set_position(tx * CELL, ty * CELL))
        for ci, (cx, cy) in enumerate(spec["cairn"]):
            sprites.append(Sprite(
                pixels=_socket(), name=f"socket_{ci}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
            ).set_position(cx * CELL, cy * CELL))
            sprites.append(Sprite(
                pixels=_banked(False), name=f"banked_{ci}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(cx * CELL, cy * CELL))
        sx, sy = spec["start"]
        sprites.append(Sprite(
            pixels=_poacher(), name="poacher",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=3,
        ).set_position(sx * CELL, sy * CELL))
        for ki in range(len(spec["keepers"])):
            for k in range(SCENT_LEN):
                cx, cy = keeper_cells(li, 0, -1 - k)[ki]
                sprites.append(Sprite(
                    pixels=_scent(k), name=f"scent_{ki}_{k}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0,
                ).set_position(cx * CELL, cy * CELL))
            gx, gy = keeper_cells(li, 0, 0)[ki]
            sprites.append(Sprite(
                pixels=_keeper((0, 0)), name=f"keeper_{ki}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=2,
            ).set_position(gx * CELL, gy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(W * CELL, H * CELL)))
    return levels


class G012(ARCBaseGame):

    CAUGHT_FRAMES = 6

    def __init__(self) -> None:
        self._caught = 0
        self.pos = LEVELS_SPEC[0]["start"]
        self.stones = LEVELS_SPEC[0]["stones_all"]
        self.tick = 0
        self.deaths = 0
        camera = Camera(
            width=W * CELL, height=H * CELL,
            background=TURF_TILE, letter_box=PALE_BLOCK,
        )
        super().__init__(game_id="g012", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.pos = spec["start"]
        self.stones = spec["stones_all"]
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
        spec = LEVELS_SPEC[self.level_index]
        phase = len(spec["stones_all"]) - len(self.stones)
        here = keeper_cells(self.level_index, phase, self.tick)
        nxt = keeper_cells(self.level_index, phase, self.tick + 1)
        for ki, (gx, gy) in enumerate(here):
            ax, ay = nxt[ki]
            for s in level.get_sprites_by_name(f"keeper_{ki}"):
                s.pixels = np.array(_keeper((ax - gx, ay - gy)))
                s.set_position(gx * CELL, gy * CELL)
            for k in range(SCENT_LEN):
                tx, ty = keeper_cells(self.level_index, phase, self.tick - 1 - k)[ki]
                for s in level.get_sprites_by_name(f"scent_{ki}_{k}"):
                    s.set_position(tx * CELL, ty * CELL)
        for s in level.get_sprites_by_name("poacher"):
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        for ci in range(len(spec["cairn"])):
            for s in level.get_sprites_by_name(f"banked_{ci}"):
                s.pixels = np.array(_banked(ci < phase))
        for s in level.get_sprites_by_tag("decor"):
            gx, gy = s.x // CELL, s.y // CELL
            if (gx, gy) in walls(spec):
                s.pixels = np.array(_fitting(self.tick, (gx + gy) % DECOY_PERIOD))
        for s in level.get_sprites_by_name("gate"):
            s.pixels = np.array(_gate(bool(self.stones)))

    def step(self) -> None:
        if self._caught:
            self._caught -= 1
            for sp in self.current_level.get_sprites_by_name("poacher"):
                sp.pixels = np.array(_poacher(lit=self._caught % 2 == 0))
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
        before = self.stones
        self.pos, self.stones, self.tick, dead = advance(
            self.level_index, self.pos, self.stones, self.tick, move)

        for cx, cy in before - self.stones:
            for s in self.current_level.get_sprites_by_name(f"stone_{cx}_{cy}"):
                self.current_level.remove_sprite(s)

        if dead:
            self.deaths += 1
            self._redraw()
            self._caught = self.CAUGHT_FRAMES
            return

        self._redraw()
        if not self.stones and self.pos == spec["gate"]:
            self.next_level()
        self.complete_action()
