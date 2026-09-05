# ARC-AGI-3 candidate task g023.

import numpy as np

from sprite_book import blink, block, door, medallion

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

FLOOR = 9
WALL = 4
STRIP = 4
PLAYER = 11
PLAYER_FACE = 4
MARK_FRAME = 1
ROD_LINE = 14
ROD_PIP = 14
PLATE_PIP = 7
FLAG_RIM = 1
FLAG_CORE = 4
EXIT_FRAME = 14
EXIT_BAR = 1

ROD_BAR, PLATE_BAR, DEBT_BAR = 7, 11, 51
BAR_TOP = 12
BAR_GAP = 8
DEBT_PIP = MARK_FRAME

N = 16
CELL = 4
IX0, IX1 = 1, 14
IY0, IY1 = 2, 14

CORNERS = ((0, 0), (0, 3), (3, 0), (3, 3))
EDGE_SLOTS = ((0, 1), (0, 2), (1, 0), (1, 3), (2, 0), (2, 3), (3, 1), (3, 2))

LEVELS_SPEC = [
    {"rod": 3, "plate": 2, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#####....X######",
        "#####.....######",
        "#####.....######",
        "#####.P...######",
        "#####*....######",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rod": 4, "plate": 3, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#####....X.#####",
        "#####......#####",
        "#####.*....#####",
        "#####......#####",
        "#####.P*...#####",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rod": 4, "plate": 3, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "################",
        "#####....P.#####",
        "#####*.....#####",
        "#####......#####",
        "#####X.....#####",
        "#####..*...#####",
        "#####......#####",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rod": 5, "plate": 4, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "################",
        "####.*.....#####",
        "####...#...#####",
        "####P..#*..#####",
        "####*..#...#####",
        "####...#...#####",
        "####.....X.#####",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rod": 5, "plate": 4, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "################",
        "####P......#####",
        "####...*.X.#####",
        "####*......#####",
        "####.......#####",
        "####.......#####",
        "####......*#####",
        "####.......#####",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rod": 6, "plate": 5, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "################",
        "####.*X...######",
        "####*.......####",
        "####.....*..####",
        "#######..*.P####",
        "####........####",
        "####........####",
        "####........####",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rod": 6, "plate": 5, "rows": [
        "HHHHHHHHHHHHHHHH",
        "################",
        "################",
        "################",
        "####........####",
        "####........####",
        "####.....X**####",
        "####........####",
        "####..*....*####",
        "####P....*..####",
        "####........####",
        "####........####",
        "################",
        "################",
        "################",
        "################",
    ]},
]


def interior(rows):
    return {(x, y) for y in range(IY0, IY1 + 1) for x in range(IX0, IX1 + 1)
            if rows[y][x] != "#"}


def find(rows, ch):
    for y in range(N):
        for x in range(N):
            if rows[y][x] == ch:
                return x, y
    raise AssertionError(f"level has no {ch}")


def hazards(rows):
    return {(x, y) for y in range(N) for x in range(N) if rows[y][x] == "*"}


def rod_line(rows, cell, facing):
    dx, dy = facing
    x, y = cell
    seen = []
    while True:
        x, y = x + dx, y + dy
        if not (IX0 <= x <= IX1 and IY0 <= y <= IY1):
            return seen, (x, y)
        if rows[y][x] != "#":
            seen.append((x, y))


def rod_trail(cell, facing, end):
    dx, dy = facing
    x, y = cell
    out = []
    while (x, y) != end:
        x, y = x + dx, y + dy
        if (x, y) != end:
            out.append((x, y))
    return out


def plate_ring(rows, cell):
    cx, cy = cell
    out = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            x, y = cx + dx, cy + dy
            if IX0 <= x <= IX1 and IY0 <= y <= IY1 and rows[y][x] != "#":
                out.append((x, y))
    return out


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = [
            Sprite(pixels=[[STRIP] * (N * CELL) for _ in range(CELL)], name="strip",
                   blocking=BlockingMode.BOUNDING_BOX,
                   interaction=InteractionMode.TANGIBLE, layer=-1).set_position(0, 0),
            Sprite(pixels=[[FLOOR] * ((IX1 - IX0 + 1) * CELL)
                           for _ in range((IY1 - IY0 + 1) * CELL)], name="pad",
                   blocking=BlockingMode.NOT_BLOCKED,
                   interaction=InteractionMode.INTANGIBLE, layer=-2,
                   tags=["sys_click", "sys_every_pixel"]).set_position(IX0 * CELL, IY0 * CELL),
        ]
        for y in range(N):
            for x in range(N):
                if y > 0 and rows[y][x] == "#":
                    sprites.append(Sprite(
                        pixels=block(WALL, CELL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                    ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G023A(RenderableUserDisplay):

    def __init__(self, game: "G023") -> None:
        super().__init__()
        self._game = game

    @staticmethod
    def _fill(frame, cell, colour):
        bx, by = cell[0] * CELL, cell[1] * CELL
        frame[by:by + CELL, bx:bx + CELL] = colour

    @staticmethod
    def _stamp(frame, cell, pixels):
        bx, by = cell[0] * CELL, cell[1] * CELL
        for ry in range(CELL):
            for rx in range(CELL):
                v = pixels[ry][rx]
                if v >= 0:
                    frame[by + ry, bx + rx] = v

    @staticmethod
    def _slots(frame, cell, count, marker, pip):
        bx, by = cell[0] * CELL, cell[1] * CELL
        for ry, rx in CORNERS:
            frame[by + ry, bx + rx] = marker
        for i in range(min(count, len(EDGE_SLOTS))):
            ry, rx = EDGE_SLOTS[i]
            frame[by + ry, bx + rx] = pip

    @staticmethod
    def _bar(frame, x0, value, colour):
        frame[BAR_TOP, x0:x0 + 2] = colour
        top = BAR_TOP + BAR_GAP
        for i in range(value):
            height = i + 2
            if top + height > (IY1 + 1) * CELL:
                break
            frame[top:top + height, x0:x0 + 2] = colour
            top += height + 2

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game

        self._stamp(frame, g.exit_cell,
                    door(EXIT_FRAME, None if g.armed() else EXIT_BAR, CELL))

        for line, end, count, (dx, _dy) in g.rod_marks:
            for cx, cy in line:
                bx, by = cx * CELL, cy * CELL
                if dx:
                    frame[by + 2, bx + 1:bx + 3] = ROD_LINE
                else:
                    frame[by + 1:by + 3, bx + 2] = ROD_LINE
        for _line, end, count, _d in g.rod_marks:
            self._slots(frame, end, count, MARK_FRAME, ROD_PIP)
        for cell, count in g.plate_marks:
            self._slots(frame, cell, count, MARK_FRAME, PLATE_PIP)

        for cell in g.flags:
            self._fill(frame, cell, FLOOR)
            self._stamp(frame, cell, medallion(FLAG_RIM, FLAG_CORE, CELL))

        lit = blink(g.FLASH_FRAMES - g.flash, 2)
        dying = g.flash and g.flash_cell == (g.px, g.py)
        if g.flash and not dying:
            self._fill(frame, g.flash_cell, FLOOR)
            if lit:
                self._stamp(frame, g.flash_cell, medallion(FLAG_RIM, FLAG_CORE, CELL))

        px, py = g.px * CELL, g.py * CELL
        if dying and not lit:
            frame[py + 1:py + 3, px + 1:px + 3] = PLAYER_FACE
        else:
            frame[py + 1:py + 3, px + 1:px + 3] = PLAYER
            dx, dy = g.facing
            if dx == 1:
                frame[py + 1:py + 3, px + 2] = PLAYER_FACE
            elif dx == -1:
                frame[py + 1:py + 3, px + 1] = PLAYER_FACE
            elif dy == -1:
                frame[py + 1, px + 1:px + 3] = PLAYER_FACE
            else:
                frame[py + 2, px + 1:px + 3] = PLAYER_FACE

        self._bar(frame, ROD_BAR, g.rod_left, ROD_PIP)
        self._bar(frame, PLATE_BAR, g.plate_left, PLATE_PIP)
        self._bar(frame, DEBT_BAR, len(g.hazards) - g.correct, DEBT_PIP)
        return frame


class G023(ARCBaseGame):

    FLASH_FRAMES = 6

    def __init__(self) -> None:
        self._init_state(0)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=STRIP,
            interfaces=[G023A(self)],
        )
        super().__init__(game_id="g023", levels=build_levels(), camera=camera)

    def _init_state(self, index: int) -> None:
        spec = LEVELS_SPEC[index]
        rows = spec["rows"]
        self.rows = rows
        self.hazards = hazards(rows)
        self.exit_cell = find(rows, "X")
        self.px, self.py = find(rows, "P")
        self.facing = (1, 0)
        self.rod_left = spec["rod"]
        self.plate_left = spec["plate"]
        self.correct = 0
        self.flags: dict[tuple[int, int], bool] = {}
        self.rod_marks: list[tuple[list, tuple[int, int], int, tuple[int, int]]] = []
        self.plate_marks: list[tuple[tuple[int, int], int]] = []
        self.rod_slots: set[tuple[int, int]] = set()
        self.plate_slots: set[tuple[int, int]] = set()
        self.flash = 0
        self.flash_cell = (0, 0)

    def on_set_level(self, level: Level) -> None:
        self._init_state(self.level_index)

    def level_reset(self) -> None:
        super().level_reset()
        self._init_state(self.level_index)

    def full_reset(self) -> None:
        super().full_reset()
        self._init_state(self.level_index)

    def armed(self) -> bool:
        return self.correct == len(self.hazards)

    def _fire_rod(self) -> None:
        if self.rod_left <= 0:
            return
        line, end = rod_line(self.rows, (self.px, self.py), self.facing)
        if end in self.rod_slots:
            return
        self.rod_slots.add(end)
        self.rod_left -= 1
        count = sum(1 for c in line if c in self.hazards)
        self.rod_marks.append((rod_trail((self.px, self.py), self.facing, end),
                               end, count, self.facing))

    def _fire_plate(self) -> None:
        if self.plate_left <= 0 or (self.px, self.py) in self.plate_slots:
            return
        self.plate_slots.add((self.px, self.py))
        self.plate_left -= 1
        ring = plate_ring(self.rows, (self.px, self.py))
        self.plate_marks.append(((self.px, self.py),
                                 sum(1 for c in ring if c in self.hazards)))

    def _mark(self, cell) -> None:
        if cell in self.flags or cell == (self.px, self.py):
            return
        if not (IX0 <= cell[0] <= IX1 and IY0 <= cell[1] <= IY1):
            return
        if self.rows[cell[1]][cell[0]] == "#" or cell == self.exit_cell:
            return
        if len(self.flags) >= len(self.hazards):
            return
        hit = cell in self.hazards
        self.flags[cell] = hit
        if hit:
            self.correct += 1
        else:
            self._start_flash(cell)

    def _start_flash(self, cell) -> None:
        self.flash = self.FLASH_FRAMES
        self.flash_cell = cell

    def _walk(self, d) -> None:
        if self.facing != d:
            self.facing = d
            return
        nx, ny = self.px + d[0], self.py + d[1]
        if not (IX0 <= nx <= IX1 and IY0 <= ny <= IY1):
            return
        if self.rows[ny][nx] == "#" or (nx, ny) in self.flags:
            return
        if (nx, ny) == self.exit_cell:
            if self.armed():
                self.px, self.py = nx, ny
                self.next_level()
            return
        self.px, self.py = nx, ny
        if (nx, ny) in self.hazards:
            self._start_flash((nx, ny))

    def step(self) -> None:
        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.level_reset()
                self.complete_action()
            return

        a = self.action.id
        if a == GameAction.ACTION1:
            self._walk((0, -1))
        elif a == GameAction.ACTION2:
            self._walk((0, 1))
        elif a == GameAction.ACTION3:
            self._walk((-1, 0))
        elif a == GameAction.ACTION4:
            self._walk((1, 0))
        elif a == GameAction.ACTION5:
            self._fire_rod()
        elif a == GameAction.ACTION6:
            cell = (self.action.data.get("x", 0) // CELL,
                    self.action.data.get("y", 0) // CELL)
            if cell == (self.px, self.py):
                self._fire_plate()
            else:
                self._mark(cell)
        if self.flash:
            return
        self.complete_action()
