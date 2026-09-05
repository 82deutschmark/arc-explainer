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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 0
SOCKET = 4
COUNTS = 14
REFUSED = 8
MARK_CONTIG = 12
MARK_SEP = 15
PIP_OPEN = 0
PIP_MET = 14

GRID = 16
CELL = 4

BOARD = 8
OX = 4
OY = 4
COL_CLUE_ROW = OY - 1
ROW_CLUE_COL = OX - 1

FITTINGS = [(13, 13), (14, 13), (13, 14), (14, 14), (1, 1)]
FITTING_COLOURS = (COUNTS, MARK_CONTIG, MARK_SEP)

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


def _overlay(base: list[list[int]], top: list[list[int]]) -> list[list[int]]:
    for y in range(CELL):
        for x in range(CELL):
            if top[y][x] >= 0:
                base[y][x] = top[y][x]
    return base


def _blank() -> list[list[int]]:
    return [[-1] * CELL for _ in range(CELL)]


def _slot(colour: int) -> list[list[int]]:
    return core(colour, CELL)


def _stone(solid: bool = False) -> list[list[int]]:
    px = rounded(COUNTS, CELL)
    if not solid:
        for y in range(1, CELL - 1):
            for x in range(1, CELL - 1):
                px[y][x] = -1
    return px


def _barred() -> list[list[int]]:
    return weave(REFUSED, CELL)


def _clue_tile(count: int, bracket: int, satisfied: bool,
               blanked: bool = False) -> list[list[int]]:
    block = [[SOCKET] * CELL for _ in range(CELL)]
    for i in range(CELL):
        block[0][i] = bracket
        block[i][0] = bracket
    if blanked:
        return block
    pip = PIP_MET if satisfied else PIP_OPEN
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
                    pixels=_slot(SOCKET), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=0,
                ).set_position((OX + x) * CELL, (OY + y) * CELL))
            sprites.append(Sprite(
                pixels=_clue_tile(0, SOCKET, False), name=f"rowclue_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(ROW_CLUE_COL * CELL, (OY + y) * CELL))
        for x in range(BOARD):
            sprites.append(Sprite(
                pixels=_clue_tile(0, SOCKET, False), name=f"colclue_{x}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position((OX + x) * CELL, COL_CLUE_ROW * CELL))
        for i, (gx, gy) in enumerate(FITTINGS):
            sprites.append(Sprite(
                pixels=fixture(FITTING_COLOURS, 0, i, CELL), name=f"fitting_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(gx * CELL, gy * CELL))
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

    COMMIT_FRAMES = 6
    REJECT_FRAMES = 6
    CLEAR_FRAMES = 5

    def __init__(self) -> None:
        self.filled: set = set()
        self._fx = 0
        self._fx_kind = ""
        self._tick = 0
        camera = Camera(
            width=GRID * CELL, height=GRID * CELL,
            background=FLOOR, letter_box=FLOOR,
        )
        super().__init__(game_id="g038", levels=build_levels(), camera=camera,
                         available_actions=[5, 6, 7])

    def on_set_level(self, level: Level) -> None:
        self.filled = set()
        self._fx = 0
        self._fx_kind = ""
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
        beat = self._fx % 2 == 1
        pulse = self._fx_kind == "commit" and beat
        lifting = self._fx_kind == "clear"
        for y in range(BOARD):
            for x in range(BOARD):
                kind = spec["cells"][y][x]
                if kind == "#":
                    face = _barred()
                elif kind == "A":
                    face = _slot(COUNTS) if pulse else _stone(solid=True)
                elif (x, y) in self.filled:
                    if lifting:
                        face = _slot(COUNTS) if beat else _blank()
                    else:
                        face = _slot(COUNTS) if pulse else _stone()
                else:
                    face = _slot(SOCKET)
                found = level.get_sprites_by_name(f"cell_{x}_{y}")
                if found:
                    found[0].pixels = np.array(face, dtype=np.int8)
            found = level.get_sprites_by_name(f"rowclue_{y}")
            if found:
                met = row_ok(spec, occ, y)
                bracket = MARK_CONTIG if spec["row_contig"][y] else SOCKET
                found[0].pixels = np.array(
                    _clue_tile(spec["rowclue"][y], bracket, met,
                               blanked=self._fx_kind == "reject" and beat and not met),
                    dtype=np.int8)
        for x in range(BOARD):
            found = level.get_sprites_by_name(f"colclue_{x}")
            if found:
                met = col_ok(spec, occ, x)
                bracket = MARK_SEP if spec["col_sep"][x] else SOCKET
                found[0].pixels = np.array(
                    _clue_tile(spec["colclue"][x], bracket, met,
                               blanked=self._fx_kind == "reject" and beat and not met),
                    dtype=np.int8)
        for i in range(len(FITTINGS)):
            found = level.get_sprites_by_name(f"fitting_{i}")
            if found:
                found[0].pixels = np.array(
                    fixture(FITTING_COLOURS, self._tick // 3, i, CELL), dtype=np.int8)

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
        self._tick += 1
        if self._fx:
            self._fx -= 1
            if self._fx:
                self._repaint()
                return
            kind, self._fx_kind = self._fx_kind, ""
            if kind == "clear":
                self.filled = set()
            self._repaint()
            if kind == "commit" and solved(self.spec, frozenset(self.filled)):
                self.next_level()
            self.complete_action()
            return

        action = self.action.id
        if action == GameAction.ACTION6:
            self._toggle(int(self.action.data.get("x", -1)),
                         int(self.action.data.get("y", -1)))
            self._repaint()
        elif action == GameAction.ACTION7:
            if self.filled:
                self._fx, self._fx_kind = self.CLEAR_FRAMES, "clear"
                self._repaint()
                return
            self._repaint()
        elif action == GameAction.ACTION5:
            if solved(self.spec, frozenset(self.filled)):
                self._fx, self._fx_kind = self.COMMIT_FRAMES, "commit"
            else:
                self._fx, self._fx_kind = self.REJECT_FRAMES, "reject"
            self._repaint()
            return
        self.complete_action()
