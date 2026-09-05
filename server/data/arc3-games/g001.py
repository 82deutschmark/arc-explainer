# ARC-AGI-3 candidate task g001.

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

FLOOR = 13
WALL = 0
WALL_EDGE = 2
PLAYER = 6
GATE_BODY = 9
GATE_PIP = 11
GOAL_CORE = 8
PURSE_PIP = 11

N = 13
CELL = 4
FRAME = 64
OX = 6
OY = 6

PURSE_ORDER = ((0, 1), (2, 3), (3, 2), (1, 0), (0, 2), (2, 0), (3, 1), (1, 3))
MAX_CHARGES = len(PURSE_ORDER)

LEVELS_SPEC = [
    {"charges": 5, "core_cost": 3, "min_spend": 4, "rows": [
        "#############",
        "#...........#",
        "#.#####1###.#",
        "#.#.......#.#",
        "#.#...e...#.#",
        "#.#.......#.#",
        "#.#...O...#.#",
        "#.#.......#.#",
        "#.#..e....#.#",
        "#.#.......#.#",
        "#.#########.#",
        "#.....P.....#",
        "#############",
    ]},
    {"charges": 5, "core_cost": 4, "min_spend": 5, "rows": [
        "#############",
        "#...........#",
        "#.#####1###.#",
        "#.#.......#.#",
        "#.#..e....#.#",
        "#.#.......#.#",
        "#.#...O...#.#",
        "#.#.......#.#",
        "#.#....e..#.#",
        "#.#.......#.#",
        "#.#####3###.#",
        "#.....P.....#",
        "#############",
    ]},
    {"charges": 6, "core_cost": 3, "min_spend": 6, "rows": [
        "#############",
        "#....e......#",
        "#.#####1###.#",
        "#.#.......#.#",
        "#.#.#2###.#.#",
        "#.#.#...#.#.#",
        "#.#.#.O.#.#.#",
        "#.#.#...#.#.#",
        "#.#.#####.#.#",
        "#.#...e...#.#",
        "#.#####2###.#",
        "#.....P.....#",
        "#############",
    ]},
    {"charges": 7, "core_cost": 3, "min_spend": 7, "rows": [
        "#############",
        "#...........#",
        "#.####2####.#",
        "#.#...e...#.#",
        "#.#.#2###.#.#",
        "#.#.#...#.#.#",
        "#.###.O.###.#",
        "#.#.#...#.#.#",
        "#.#.#####.#.#",
        "#.#...e...#.#",
        "#.####1####.#",
        "#.....P.....#",
        "#############",
    ]},
    {"charges": 7, "core_cost": 4, "min_spend": 7, "rows": [
        "#############",
        "#...........#",
        "#.##1###2##.#",
        "#.#..#....#.#",
        "#.#.###1#.#.#",
        "#.#.#...#.#.#",
        "#.#.#.O.#.#.#",
        "#.#.#..e#.#.#",
        "#.#.#####.#.#",
        "#.#e.#....#.#",
        "#.#########.#",
        "#.....P.....#",
        "#############",
    ]},
    {"charges": 8, "core_cost": 4, "min_spend": 8, "rows": [
        "#############",
        "#.....e.....#",
        "#.##1###2##.#",
        "#.#...#...#.#",
        "#.#.###2#.#.#",
        "#.#.#...#.#.#",
        "#.#.#.O.#.#.#",
        "#.#.#..e#.#.#",
        "#.#.#####.#.#",
        "#.##.##...#.#",
        "#.##1######.#",
        "#.....P.....#",
        "#############",
    ]},
    {"charges": 8, "core_cost": 4, "min_spend": 8, "rows": [
        "#############",
        "#....e.e....#",
        "#.##2###2##.#",
        "#.#...#...#.#",
        "#.#.#####.#.#",
        "#.#.#...#.#.#",
        "#.###.O.###.#",
        "#.#.#...#.#.#",
        "#.#.##2##.#.#",
        "#.#...e...#.#",
        "#.#####2###.#",
        "#.....P.....#",
        "#############",
    ]},
]


def _stone_face(x: int, y: int) -> list[list[int]]:
    face = [[WALL] * CELL for _ in range(CELL)]
    face[0][(x + 2 * y) % CELL] = WALL_EDGE
    face[2][(3 * x + y) % CELL] = WALL_EDGE
    return face


def _floor_face(ember: bool) -> list[list[int]]:
    face = [[FLOOR] * CELL for _ in range(CELL)]
    face[3][1] = WALL_EDGE
    if ember:
        face[1][2] = GATE_PIP
    return face


def _priced_face(body: int, price: int) -> list[list[int]]:
    face = [[body] * CELL for _ in range(CELL)]
    for i in range(min(price, 9)):
        face[1 + i // 3][1 + i % 3] = GATE_PIP
    return face


def _gate_face(price: int) -> list[list[int]]:
    face = _priced_face(GATE_BODY, price)
    face[0][0] = face[0][CELL - 1] = -1
    return face


def _core_face(price: int) -> list[list[int]]:
    face = _priced_face(GOAL_CORE, price)
    face[0][0] = face[0][CELL - 1] = -1
    face[CELL - 1][0] = face[CELL - 1][CELL - 1] = -1
    return face


def _runner_face(charges: int, under: int = -1) -> list[list[int]]:
    face = [[-1] * CELL for _ in range(CELL)]
    for y in (1, 2):
        for x in (1, 2):
            face[y][x] = PLAYER
    if under >= 0:
        face[2][2] = under
    for i, (y, x) in enumerate(PURSE_ORDER):
        face[y][x] = PURSE_PIP if i < charges else WALL
    return face


EMBER_XY = ((2, 20), (58, 14), (26, 59), (52, 56))
EMBER_SHADES = (GATE_PIP, GOAL_CORE, WALL_EDGE)

_YY, _XX = np.mgrid[0:FRAME, 0:FRAME]
MARGIN = ~((_XX >= OX) & (_XX < OX + N * CELL)
           & (_YY >= OY) & (_YY < OY + N * CELL))
STUDS = (_XX % 5 == 2) & (_YY % 5 == 2)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = OX + x * CELL, OY + y * CELL
                sprites.append(Sprite(
                    pixels=_floor_face(char == "e"), name=f"ground_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-3,
                ).set_position(px, py))
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_stone_face(x, y), name=f"stone_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif char.isdigit():
                    sprites.append(Sprite(
                        pixels=_gate_face(int(char)), name=f"gate_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                        tags=["gate", f"price_{char}"],
                    ).set_position(px, py))
                elif char == "O":
                    sprites.append(Sprite(
                        pixels=_core_face(spec["core_cost"]), name="core",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["core"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_runner_face(spec["charges"]), name="runner",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=2,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(FRAME, FRAME)))
    return levels


class G001A(RenderableUserDisplay):

    def __init__(self, game: "G001") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        frame[MARGIN] = WALL
        frame[MARGIN & STUDS] = WALL_EDGE
        phase = self._game.tick // 3
        for i, (ex, ey) in enumerate(EMBER_XY):
            shade = EMBER_SHADES[(i + phase) % len(EMBER_SHADES)]
            for dy, dx in ((0, 0), (0, 1), (1, 0)):
                if 0 <= ey + dy < FRAME and 0 <= ex + dx < FRAME:
                    frame[ey + dy, ex + dx] = shade
        return frame


class G001(ARCBaseGame):

    def __init__(self) -> None:
        self.charges = LEVELS_SPEC[0]["charges"]
        self._facing = (0, -1)
        self.tick = 0
        camera = Camera(
            width=FRAME, height=FRAME,
            background=FLOOR, letter_box=WALL,
            interfaces=[G001A(self)],
        )
        super().__init__(game_id="g001", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.charges = LEVELS_SPEC[self.level_index]["charges"]
        self._facing = (0, -1)
        self._redraw_runner()

    def _runner(self) -> Sprite | None:
        found = self.current_level.get_sprites_by_name("runner")
        return found[0] if found else None

    def _ember_under(self) -> int:
        runner = self._runner()
        if runner is None:
            return -1
        x, y = (runner.x - OX) // CELL, (runner.y - OY) // CELL
        rows = LEVELS_SPEC[self.level_index]["rows"]
        if 0 <= y < N and 0 <= x < N and rows[y][x] == "e":
            return GATE_PIP
        return -1

    def _redraw_runner(self) -> None:
        runner = self._runner()
        if runner is None:
            return
        runner.pixels[:, :] = np.array(
            _runner_face(self.charges, self._ember_under()), dtype=runner.pixels.dtype)

    def _burn(self, amount: int) -> None:
        self.charges -= amount
        self._redraw_runner()

    @staticmethod
    def _price_of(sprite: Sprite) -> int | None:
        for tag in sprite.tags:
            if tag.startswith("price_"):
                return int(tag.split("_")[1])
        return None

    def _faced(self) -> Sprite | None:
        runner = self._runner()
        if runner is None:
            return None
        dx, dy = self._facing
        return self.current_level.get_sprite_at(
            runner.x + dx * CELL, runner.y + dy * CELL)

    def _pay(self) -> None:
        target = self._faced()
        if target is None:
            return
        if "core" in target.tags:
            cost = LEVELS_SPEC[self.level_index]["core_cost"]
            if self.charges >= cost:
                self._burn(cost)
                self.next_level()
            return
        if "gate" in target.tags:
            price = self._price_of(target)
            if price is not None and self.charges >= price:
                self._burn(price)
                self.current_level.remove_sprite(target)

    def step(self) -> None:
        self.tick += 1
        heading = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }.get(self.action.id)

        if heading is not None:
            self._facing = heading
            self.try_move("runner", heading[0] * CELL, heading[1] * CELL)
            self._redraw_runner()
        elif self.action.id == GameAction.ACTION5:
            self._pay()

        self.complete_action()
