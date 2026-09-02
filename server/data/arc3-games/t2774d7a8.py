# ARC-AGI-3 candidate task t2774d7a8.

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

HEARTH_FILL = 3
KILN_EDGE = 12
FLUE_MARK = 14

SHADES = (15, 9, 2, 0, 7, 8, 13)
SPAN = 3

STEPS = {
    ".": 0, "S": 0, "M": 0,
    "p": 1, "q": 2, "m": -1, "n": -2,
}
VENTS = "pqmn"

LEVELS_SPEC = [
    {"wants": 2, "rows": [
        "############",
        "#SM........#",
        "#..........#",
        "#..######..#",
        "#..######..#",
        "#..q#####..#",
        "#..######..#",
        "#..######..#",
        "#..######..#",
        "#..........#",
        "#..........#",
        "############",
    ]},
    {"wants": 3, "rows": [
        "############",
        "#S.........#",
        "#..........#",
        "#...####...#",
        "#...#..#...#",
        "#...#p.#...#",
        "#...#..#...#",
        "#...##.#...#",
        "#..........#",
        "#..........#",
        "#.........M#",
        "############",
    ]},
    {"wants": 0, "rows": [
        "############",
        "#S.........#",
        "#..........#",
        "#....q.....#",
        "#..........#",
        "#..#####...#",
        "#..#...#...#",
        "#..#.M.#...#",
        "#..#...#...#",
        "#..#p###...#",
        "#.......m..#",
        "############",
    ]},
    {"wants": 3, "rows": [
        "############",
        "#S.........#",
        "#..##..##..#",
        "#..#q..q#..#",
        "#..##..##..#",
        "#..........#",
        "#.####.....#",
        "#.#m.......#",
        "#.####.....#",
        "#..........#",
        "#........M.#",
        "############",
    ]},
    {"wants": -1, "rows": [
        "############",
        "#S...#...#q#",
        "#....#...#.#",
        "#.n..#.m.#.#",
        "#....#...#.#",
        "#....#...#.#",
        "#..........#",
        "#########.##",
        "#########.##",
        "#########.##",
        "#Mpp.......#",
        "############",
    ]},
    {"wants": 2, "rows": [
        "############",
        "#S....#....#",
        "#.....#..n.#",
        "#..p..#....#",
        "#.....#....#",
        "#.....#....#",
        "#..........#",
        "#.##########",
        "#.##########",
        "#.##########",
        "#.....mmpM##",
        "############",
    ]},
]

SIDE = len(LEVELS_SPEC[0]["rows"])
CELL = 5
INSET = (64 - SIDE * CELL) // 2


def shade_for(value: int) -> int:
    return SHADES[value + SPAN]


def slab(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def grating(colour: int) -> list[list[int]]:
    block = slab(HEARTH_FILL)
    for row in range(1, CELL - 1):
        for col in range(1, CELL - 1):
            block[row][col] = colour
    block[CELL // 2][CELL // 2] = HEARTH_FILL
    return block


def quartered(colour: int) -> list[list[int]]:
    block = slab(colour)
    for i in range(CELL):
        block[CELL // 2][i] = HEARTH_FILL
        block[i][CELL // 2] = HEARTH_FILL
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        pieces: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, glyph in enumerate(row):
                px, py = INSET + x * CELL, INSET + y * CELL
                if glyph == "#":
                    pieces.append(Sprite(
                        pixels=slab(KILN_EDGE), name=f"brick_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif glyph in VENTS:
                    pieces.append(Sprite(
                        pixels=grating(FLUE_MARK), name=f"vent_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
                elif glyph == "M":
                    pieces.append(Sprite(
                        pixels=quartered(shade_for(spec["wants"])), name="mould",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1, tags=["mould"],
                    ).set_position(px, py))
                elif glyph == "S":
                    pieces.append(Sprite(
                        pixels=slab(shade_for(0)), name="billet",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=2,
                    ).set_position(px, py))
        levels.append(Level(sprites=pieces, grid_size=(64, 64)))
    return levels


class G52163734(ARCBaseGame):

    def __init__(self) -> None:
        self.charge = 0
        camera = Camera(
            width=64, height=64,
            background=HEARTH_FILL, letter_box=KILN_EDGE,
        )
        super().__init__(game_id="t2774d7a8", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.charge = 0
        self._recolour()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _recolour(self) -> None:
        found = self.current_level.get_sprites_by_name("billet")
        if found:
            found[0].pixels[:, :] = shade_for(self.charge)

    def step(self) -> None:
        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1

        if dx or dy:
            found = self.current_level.get_sprites_by_name("billet")
            if found:
                self._advance(found[0], dx, dy)

        self.complete_action()

    def _advance(self, billet: Sprite, dx: int, dy: int) -> None:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        wants = LEVELS_SPEC[self.level_index]["wants"]
        cx = (billet.x - INSET) // CELL + dx
        cy = (billet.y - INSET) // CELL + dy
        if not (0 <= cx < SIDE and 0 <= cy < SIDE):
            return
        glyph = rows[cy][cx]

        if glyph == "#":
            return
        if glyph == "M":
            if self.charge == wants:
                self.next_level()
            return

        nxt = self.charge + STEPS[glyph]
        billet.set_position(INSET + cx * CELL, INSET + cy * CELL)
        if abs(nxt) > SPAN:
            self.level_reset()
        else:
            self.charge = nxt
            self._recolour()
