# ARC-AGI-3 candidate task g038.

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

BACKDROP = 5
EMPTY = 4
BLOCK = 11
ANCHOR = 12
FORBID = 13
FORBID_CORE = 5
CLUE_PLAIN = 2
CLUE_CONTIG = 9
CLUE_SEP = 15
PIP_BRIGHT = 0
PIP_DIM = 3

GRID = 16
CELL = 4

BOARD = 8
OX = 4
OY = 4
COL_CLUE_ROW = OY - 1
ROW_CLUE_COL = OX - 1

LEVELS_SPEC = [
    {
        "cells": [
            ".##.#.#.",
            "##.....#",
            ".#.#####",
            "#.#...#.",
            "##.#....",
            "..#.#...",
            ".#..#..#",
            "##.#..#.",
        ],
        "rowclue": [4, 2, 2, 4, 3, 6, 5, 4],
        "colclue": [4, 2, 4, 5, 3, 7, 2, 3],
        "row_contig": [False, False, False, False, False, False, False, False],
        "col_sep": [False, False, False, False, False, False, False, False],
    },
    {
        "cells": [
            ".......#",
            "##.##..#",
            "....##.#",
            ".A..####",
            "###.##.A",
            "A.A#..A#",
            ".#...A..",
            ".#......",
        ],
        "rowclue": [5, 3, 4, 4, 2, 6, 7, 6],
        "colclue": [6, 4, 6, 6, 3, 3, 6, 3],
        "row_contig": [False, False, False, False, False, False, False, False],
        "col_sep": [False, False, False, False, False, False, False, False],
    },
    {
        "cells": [
            "#....A..",
            ".....##.",
            "#A...#..",
            "..A.....",
            "##....A.",
            "...#....",
            ".#...#..",
            "########",
        ],
        "rowclue": [5, 2, 6, 8, 6, 5, 4, 0],
        "colclue": [2, 4, 5, 6, 6, 3, 3, 7],
        "row_contig": [False, False, False, False, False, False, False, False],
        "col_sep": [False, False, False, False, False, False, False, False],
    },
    {
        "cells": [
            "..###...",
            ".A...#..",
            "........",
            ".....#A.",
            "...A.##.",
            ".##..#..",
            "...#..#.",
            "...##...",
        ],
        "rowclue": [3, 6, 6, 4, 3, 4, 6, 2],
        "colclue": [8, 5, 1, 2, 6, 4, 4, 4],
        "row_contig": [False, False, False, False, False, False, False, False],
        "col_sep": [False, False, False, False, False, False, False, False],
    },
    {
        "cells": [
            "##.###..",
            ".....A..",
            "##..#...",
            "......#.",
            ".......#",
            ".#......",
            "#..A....",
            "#......#",
        ],
        "rowclue": [1, 8, 3, 7, 1, 5, 3, 2],
        "colclue": [2, 3, 2, 4, 3, 7, 4, 5],
        "row_contig": [False, True, True, False, False, True, False, True],
        "col_sep": [False, False, False, False, False, False, False, False],
    },
    {
        "cells": [
            "...A...#",
            "##..#...",
            "..##....",
            "##....#A",
            "........",
            "...#.#..",
            "#....#..",
            "...#....",
        ],
        "rowclue": [4, 5, 2, 4, 8, 2, 2, 0],
        "colclue": [2, 4, 3, 4, 3, 4, 3, 4],
        "row_contig": [False, False, False, False, False, False, False, False],
        "col_sep": [False, True, False, False, True, False, True, False],
    },
    {
        "cells": [
            "....A...",
            "#....#.#",
            "........",
            ".......#",
            "..A....#",
            ".#...#..",
            "...#...#",
            "...#....",
        ],
        "rowclue": [3, 4, 2, 2, 1, 3, 2, 4],
        "colclue": [1, 1, 7, 3, 2, 4, 3, 0],
        "row_contig": [False, False, True, True, False, False, False, False],
        "col_sep": [False, False, False, True, True, False, True, False],
    },
    {
        "cells": [
            "..#.....",
            "#......#",
            "#....A..",
            "........",
            ".#.....#",
            "........",
            "..#.#...",
            "........",
        ],
        "rowclue": [1, 2, 2, 2, 3, 2, 1, 4],
        "colclue": [0, 1, 3, 2, 6, 1, 2, 2],
        "row_contig": [False, True, True, False, False, False, False, True],
        "col_sep": [False, False, True, True, False, False, True, True],
    },]


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _forbidden_tile() -> list[list[int]]:
    block = _solid(FORBID)
    for y in (1, 2):
        for x in (1, 2):
            block[y][x] = FORBID_CORE
    return block


def _clue_tile(count: int, frame: int, satisfied: bool) -> list[list[int]]:
    block = _solid(frame)
    pip = PIP_DIM if satisfied else PIP_BRIGHT
    for i in range(min(count, 9)):
        block[1 + i // 3][1 + i % 3] = pip
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y in range(BOARD):
            for x in range(BOARD):
                sprites.append(Sprite(
                    pixels=_solid(EMPTY), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=0,
                ).set_position((OX + x) * CELL, (OY + y) * CELL))
            sprites.append(Sprite(
                pixels=_solid(CLUE_PLAIN), name=f"rowclue_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(ROW_CLUE_COL * CELL, (OY + y) * CELL))
        for x in range(BOARD):
            sprites.append(Sprite(
                pixels=_solid(CLUE_PLAIN), name=f"colclue_{x}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position((OX + x) * CELL, COL_CLUE_ROW * CELL))
        levels.append(Level(sprites=sprites, grid_size=(GRID * CELL, GRID * CELL)))
    return levels


def occupied(spec: dict, filled: frozenset) -> set:
    anchors = {(x, y) for y in range(BOARD) for x in range(BOARD)
               if spec["cells"][y][x] == "A"}
    return anchors | set(filled)


def row_ok(spec: dict, occ: set, y: int) -> bool:
    xs = sorted(x for x in range(BOARD) if (x, y) in occ)
    if len(xs) != spec["rowclue"][y]:
        return False
    if spec["row_contig"][y] and len(xs) > 1 and xs[-1] - xs[0] != len(xs) - 1:
        return False
    return True


def col_ok(spec: dict, occ: set, x: int) -> bool:
    ys = sorted(y for y in range(BOARD) if (x, y) in occ)
    if len(ys) != spec["colclue"][x]:
        return False
    if spec["col_sep"][x] and any(ys[i + 1] - ys[i] == 1 for i in range(len(ys) - 1)):
        return False
    return True


def solved(spec: dict, filled: frozenset) -> bool:
    occ = occupied(spec, filled)
    return (all(row_ok(spec, occ, y) for y in range(BOARD))
            and all(col_ok(spec, occ, x) for x in range(BOARD)))


class G038(ARCBaseGame):

    def __init__(self) -> None:
        self.filled: set = set()
        camera = Camera(
            width=GRID * CELL, height=GRID * CELL,
            background=BACKDROP, letter_box=BACKDROP,
        )
        super().__init__(game_id="g038", levels=build_levels(), camera=camera,
                         available_actions=[5, 6, 7])

    def on_set_level(self, level: Level) -> None:
        self.filled = set()
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    @property
    def spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def _repaint(self) -> None:
        spec = self.spec
        level = self.current_level
        occ = occupied(spec, frozenset(self.filled))
        for y in range(BOARD):
            for x in range(BOARD):
                kind = spec["cells"][y][x]
                if kind == "#":
                    block = _forbidden_tile()
                elif kind == "A":
                    block = _solid(ANCHOR)
                elif (x, y) in self.filled:
                    block = _solid(BLOCK)
                else:
                    block = _solid(EMPTY)
                found = level.get_sprites_by_name(f"cell_{x}_{y}")
                if found:
                    found[0].pixels = np.array(block, dtype=np.int8)
            found = level.get_sprites_by_name(f"rowclue_{y}")
            if found:
                frame = CLUE_CONTIG if spec["row_contig"][y] else CLUE_PLAIN
                found[0].pixels = np.array(
                    _clue_tile(spec["rowclue"][y], frame, row_ok(spec, occ, y)),
                    dtype=np.int8)
        for x in range(BOARD):
            found = level.get_sprites_by_name(f"colclue_{x}")
            if found:
                frame = CLUE_SEP if spec["col_sep"][x] else CLUE_PLAIN
                found[0].pixels = np.array(
                    _clue_tile(spec["colclue"][x], frame, col_ok(spec, occ, x)),
                    dtype=np.int8)

    def _toggle(self, px: int, py: int) -> None:
        gx, gy = px // CELL, py // CELL
        x, y = gx - OX, gy - OY
        if not (0 <= x < BOARD and 0 <= y < BOARD):
            return
        if self.spec["cells"][y][x] != ".":
            return
        if (x, y) in self.filled:
            self.filled.discard((x, y))
        else:
            self.filled.add((x, y))

    def step(self) -> None:
        action = self.action.id
        if action == GameAction.ACTION6:
            self._toggle(int(self.action.data.get("x", -1)),
                         int(self.action.data.get("y", -1)))
            self._repaint()
        elif action == GameAction.ACTION7:
            self.filled = set()
            self._repaint()
        elif action == GameAction.ACTION5:
            self._repaint()
            if solved(self.spec, frozenset(self.filled)):
                self.next_level()
        self.complete_action()
