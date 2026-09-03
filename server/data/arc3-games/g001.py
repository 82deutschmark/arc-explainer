# ARC-AGI-3 candidate task g001.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

FLOOR = 9
WALL = 2
PLAYER = 0
GATE_BODY = 13
GATE_PIP = 11
GOAL_CORE = 6
TALLY_PIP = 11

N = 15
CELL = 4

TALLY_COL = 2
TALLY_TOP = 3

LEVELS_SPEC = [
    {"charges": 6, "core_cost": 4, "min_spend": 5, "rows": [
        "###############",
        "#.............#",
        "#.#####.#####.#",
        "#.#.........#.#",
        "#.#.........#.#",
        "#.#.........#.#",
        "#.#...#1#...#.#",
        "#.#...#O#...#.#",
        "#.#...#3#...#.#",
        "#.#.........#.#",
        "#.#.........#.#",
        "#.#.........#.#",
        "#.#####.#####.#",
        "#......P......#",
        "###############",
    ]},
    {"charges": 7, "core_cost": 4, "min_spend": 7, "rows": [
        "###############",
        "#......P......#",
        "#.#####.#####.#",
        "#.#.........#.#",
        "#.#.###2###.#.#",
        "#.#.#.....#.#.#",
        "#.#.#.#2#.#.#.#",
        "#.#.1.#O3.#.#.#",
        "#.#.#.###.#.#.#",
        "#.#.#.....#.#.#",
        "#.#.#######.#.#",
        "#.#.........#.#",
        "#.#####.#####.#",
        "#.............#",
        "###############",
    ]},
    {"charges": 9, "core_cost": 4, "min_spend": 9, "rows": [
        "###############",
        "#......P......#",
        "#.#####1#####.#",
        "#.##.......##.#",
        "#.#.#######.#.#",
        "#.#.#.....#.#.#",
        "#.#.#.###.#.#.#",
        "#.#.#.#O#.#.#.#",
        "#.#.#.#3#.#.#.#",
        "#.#.#.....#.#.#",
        "#.#.###2###.#.#",
        "#.#.........#.#",
        "#.#####.#####.#",
        "#.............#",
        "###############",
    ]},
    {"charges": 9, "core_cost": 5, "min_spend": 9, "rows": [
        "###############",
        "#......P......#",
        "#.#####1#####.#",
        "#.##........#.#",
        "#.#.###4###.#.#",
        "#.#.#.....#.#.#",
        "#.#.#.#1#.#.#.#",
        "#.#.1.#O#.#.#.#",
        "#.#.#.###.#.#.#",
        "#.#.#.....#.#.#",
        "#.#.#######.#.#",
        "#.#........##.#",
        "#.#####2#####.#",
        "#.............#",
        "###############",
    ]},
    {"charges": 8, "core_cost": 4, "min_spend": 8, "rows": [
        "###############",
        "#......P......#",
        "#.#####1#####.#",
        "#.##.......##.#",
        "#.#.###3###.#.#",
        "#.#.#....##.#.#",
        "#.#.#.#2#.#.#.#",
        "#.#.#.#O#.#.1.#",
        "#.#.#.#1#.#.#.#",
        "#.#.##....#.#.#",
        "#.#.###1###.#.#",
        "#.#........##.#",
        "#.#####2#####.#",
        "#.............#",
        "###############",
    ]},
    {"charges": 9, "core_cost": 5, "min_spend": 9, "rows": [
        "###############",
        "#...P.........#",
        "#.##1##1#####.#",
        "#.##.#.....##.#",
        "#.#.###1###.#.#",
        "#.#.#....##.#.#",
        "#.#.#.#2#.#.#.#",
        "#.#.#.#O3.1.1.#",
        "#.#.#.###.#.#.#",
        "#.#.##....#.#.#",
        "#.#.###2###.#.#",
        "#.#........##.#",
        "#.#####2#####.#",
        "#.............#",
        "###############",
    ]},
]


def _priced_block(body: int, price: int) -> list[list[int]]:
    block = [[body] * CELL for _ in range(CELL)]
    for i in range(min(price, 9)):
        block[1 + i // 3][1 + i % 3] = GATE_PIP
    return block


def _core_block(price: int) -> list[list[int]]:
    block = _priced_block(GOAL_CORE, price)
    block[0][0] = block[0][CELL - 1] = -1
    block[CELL - 1][0] = block[CELL - 1][CELL - 1] = -1
    return block


def _runner_block() -> list[list[int]]:
    block = [[PLAYER] * CELL for _ in range(CELL)]
    block[0][0] = block[0][CELL - 1] = -1
    return block


def _tally_block() -> list[list[int]]:
    block = [[-1] * CELL for _ in range(CELL)]
    block[1][1] = block[1][2] = block[2][1] = block[2][2] = TALLY_PIP
    return block


def _stone_block() -> list[list[int]]:
    return [[WALL] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_stone_block(), name=f"stone_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif char.isdigit():
                    sprites.append(Sprite(
                        pixels=_priced_block(GATE_BODY, int(char)), name=f"gate_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                        tags=["gate", f"price_{char}"],
                    ).set_position(px, py))
                elif char == "O":
                    sprites.append(Sprite(
                        pixels=_core_block(spec["core_cost"]), name="core",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["core"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_runner_block(), name="runner",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=2,
                    ).set_position(px, py))
        for i in range(spec["charges"]):
            sprites.append(Sprite(
                pixels=_tally_block(), name=f"tally_{i}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.INTANGIBLE, layer=1, tags=["tally"],
            ).set_position(TALLY_COL * CELL, (TALLY_TOP + i) * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G001(ARCBaseGame):

    def __init__(self) -> None:
        self.charges = LEVELS_SPEC[0]["charges"]
        self._facing = (0, -1)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=WALL,
        )
        super().__init__(game_id="g001", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.charges = LEVELS_SPEC[self.level_index]["charges"]
        self._facing = (0, -1)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _burn(self, amount: int) -> None:
        self.charges -= amount
        studs = sorted(self.current_level.get_sprites_by_tag("tally"), key=lambda s: s.y)
        for stud in studs[self.charges:]:
            self.current_level.remove_sprite(stud)

    @staticmethod
    def _price_of(sprite: Sprite) -> int | None:
        for tag in sprite.tags:
            if tag.startswith("price_"):
                return int(tag.split("_")[1])
        return None

    def _faced(self) -> Sprite | None:
        runner = self.current_level.get_sprites_by_name("runner")
        if not runner:
            return None
        dx, dy = self._facing
        return self.current_level.get_sprite_at(
            runner[0].x + dx * CELL, runner[0].y + dy * CELL)

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
        heading = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }.get(self.action.id)

        if heading is not None:
            self._facing = heading
            self.try_move("runner", heading[0] * CELL, heading[1] * CELL)
        elif self.action.id == GameAction.ACTION5:
            self._pay()

        self.complete_action()
