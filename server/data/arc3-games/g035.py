# ARC-AGI-3 candidate task g035.

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
WALL = 1
PLAYER = 14
EXIT = 0

HAZARD_AMBER = 12
HAZARD_CYAN = 10
HAZARD_GOLD = 11
HAZARD_COLOUR = {"A": HAZARD_AMBER, "C": HAZARD_CYAN, "G": HAZARD_GOLD}

W = 19
H = 19
CELL = 3
SLOTS = 4


LEVELS_SPEC = [
    {
        "gear": {"a": (0, "A")},
        "rows": [
            "###################",
            "#.....#.....#.....#",
            "#.P...#.....#.....#",
            "#.....A..X..A.....#",
            "#...a.#.....#.....#",
            "#.....#.....#.....#",
            "###A#####A#####A###",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....A.....A.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###A#####A#####A###",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....A.....A.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
        ]},
    {
        "gear": {"a": (0, "A"), "b": (2, "A"), "c": (1, "C")},
        "rows": [
            "###################",
            "#....b#.....#.....#",
            "#.P...#.....#.....#",
            "#.....A.....C..X..#",
            "#.a...#..c..#.....#",
            "#.....#.....#.....#",
            "###A#####A#########",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
        ]},
    {
        "gear": {"a": (0, "A"), "c": (1, "C"), "d": (0, "C"), "g": (0, "G")},
        "rows": [
            "###################",
            "#P....#.....#.....#",
            "#.....#.....#.....#",
            "#.....A....cA.....#",
            "#...a.#.....#.....#",
            "#.g...#.....#.....#",
            "###G#####C#########",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#..d..C..X..#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
        ]},
    {
        "gear": {"a": (0, "A"), "b": (0, "C"), "c": (1, "C"), "e": (3, "C")},
        "rows": [
            "###################",
            "#.....#.....#.....#",
            "#.P..b#.....#.....#",
            "#.....A..e..A.....#",
            "#.a...#.....#.....#",
            "#.....#.....#....c#",
            "###A#####A#####C###",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#..X..#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
        ]},
    {
        "gear": {"a": (0, "A"), "c": (1, "C"), "d": (3, "A"), "e": (2, "A"), "f": (3, "A"), "g": (3, "G")},
        "rows": [
            "###################",
            "#.....#.....#.....#",
            "#.P...#.....#.....#",
            "#.....A..c..A.....#",
            "#.a...#.....#.....#",
            "#.....#....d#.....#",
            "#########C#########",
            "#.....#.....#.....#",
            "#.....#....f#.....#",
            "#.....#..e..#.....#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#########A#########",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#..g..G..X..#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
        ]},
    {
        "gear": {"a": (0, "A"), "b": (2, "A"), "c": (1, "C"), "d": (3, "C"), "e": (2, "A"), "f": (3, "C"), "h": (3, "A")},
        "rows": [
            "###################",
            "#P...b#.....#e....#",
            "#.....#.....#.....#",
            "#.....A..c..C.....#",
            "#.....#.....#.....#",
            "#a....#....d#....h#",
            "###############A###",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#..f..#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###############C###",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "#.....#.....#..X..#",
            "#.....#.....#.....#",
            "#.....#.....#.....#",
            "###################",
        ]},
    {
        "gear": {"a": (0, "A"), "b": (0, "C"), "c": (1, "C"), "d": (2, "C"), "e": (2, "G"), "f": (3, "G"), "g": (3, "A"), "h": (3, "C")},
        "rows": [
            "###################",
            "#P...b#.....#.....#",
            "#.....#.....#.....#",
            "#.....A.....#.....#",
            "#.....#.....#.....#",
            "#....a#.....#.....#",
            "###A###############",
            "#....d#....e#.....#",
            "#.....#.....#.....#",
            "#.....C.....#.....#",
            "#.....#.....#.....#",
            "#c....#f....#.....#",
            "#########G#########",
            "#.....#....h#.....#",
            "#.....#.....#.....#",
            "#.....#.....A..X..#",
            "#.....#.....#.....#",
            "#.....#g....#.....#",
            "###################",
        ]},
]


def door_at(rows, x: int, y: int):
    ch = rows[y][x]
    return ch if ch in HAZARD_COLOUR else None


def is_plaster(rows, x: int, y: int) -> bool:
    return not (0 <= x < W and 0 <= y < H) or rows[y][x] == "#"


def gear_at(spec, x: int, y: int):
    ch = spec["rows"][y][x]
    return ch if ch in spec["gear"] else None


def worn_stack(spec, worn) -> list:
    return sorted((spec["gear"][k] for k in worn), key=lambda g: g[0])


def can_pull_on(spec, worn, key: str) -> bool:
    if key in worn:
        return False
    slot = spec["gear"][key][0]
    filled = {s for s, _ in worn_stack(spec, worn)}
    return all(s not in filled for s in range(slot, SLOTS))


def shielded(stack) -> frozenset:
    return frozenset(
        c for i, (_, c) in enumerate(stack)
        if all(outer == c for _, outer in stack[i + 1:])
    )


def entry_cell(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                return x, y
    raise AssertionError("level has no start")


def way_out_cell(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                return x, y
    raise AssertionError("level has no way out")


def passable(spec, worn, x: int, y: int) -> bool:
    door = door_at(spec["rows"], x, y)
    return door is None or door in shielded(worn_stack(spec, worn))


GEAR_COVER = (
    ((0, 0), (0, 2), (2, 0), (2, 2)),
    ((0, 0), (0, 2), (2, 0), (2, 2), (1, 1)),
    ((0, 0), (0, 2), (2, 0), (2, 2), (1, 1), (1, 0), (1, 2)),
    ((0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2)),
)

FIGURE_CORE = ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1))
FIGURE_SHOULDERS = ((0, 0), (0, 2), (2, 0), (2, 2))


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _blank() -> list[list[int]]:
    return [[-1] * CELL for _ in range(CELL)]


def _doorway(colour: int, across: bool) -> list[list[int]]:
    block = _solid(WALL)
    for i in range(CELL):
        if across:
            block[CELL // 2][i] = colour
        else:
            block[i][CELL // 2] = colour
    return block


def _gear_pixels(slot: int, door: str) -> list[list[int]]:
    block = _blank()
    for (y, x) in GEAR_COVER[slot]:
        block[y][x] = HAZARD_COLOUR[door]
    return block


def _figure(body: int, coat: int | None) -> list[list[int]]:
    block = _blank()
    for (y, x) in FIGURE_CORE:
        block[y][x] = body
    if coat is not None:
        for (y, x) in FIGURE_SHOULDERS:
            block[y][x] = coat
    return block


def _walks_across(rows, x: int, y: int) -> bool:
    return is_plaster(rows, x, y - 1) and is_plaster(rows, x, y + 1)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_solid(WALL), name=f"plaster_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif ch in HAZARD_COLOUR:
                    sprites.append(Sprite(
                        pixels=_doorway(HAZARD_COLOUR[ch],
                                        _walks_across(spec["rows"], x, y)),
                        name=f"doorway_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif ch == "X":
                    sprites.append(Sprite(
                        pixels=_solid(EXIT), name="way_out",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
                elif ch in spec["gear"]:
                    slot, door = spec["gear"][ch]
                    sprites.append(Sprite(
                        pixels=_gear_pixels(slot, door), name=f"gear_{ch}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
                elif ch == "P":
                    sprites.append(Sprite(
                        pixels=_figure(PLAYER, None), name="figure",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(W * CELL, H * CELL)))
    return levels


class G035A(RenderableUserDisplay):

    LEFT = 21
    TOP = 61
    THICK = 3

    def __init__(self, game: "G035") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        filled = dict(worn_stack(LEVELS_SPEC[self._game.level_index], self._game.worn))
        x = self.LEFT
        for slot in range(SLOTS):
            width = slot + 3
            colour = HAZARD_COLOUR[filled[slot]] if slot in filled else WALL
            frame[self.TOP:self.TOP + self.THICK, x:x + width] = colour
            x += width + 1
        return frame


class G035(ARCBaseGame):

    FLASH_FRAMES = 4

    def __init__(self) -> None:
        self._flash = 0
        self.worn: tuple = ()
        self.px, self.py = entry_cell(LEVELS_SPEC[0]["rows"])
        camera = Camera(
            width=W * CELL, height=H * CELL,
            background=FLOOR, letter_box=FLOOR,
            interfaces=[G035A(self)],
        )
        super().__init__(game_id="g035", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self._flash = 0
        self.worn = ()
        self.px, self.py = entry_cell(LEVELS_SPEC[self.level_index]["rows"])

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def _outermost(self) -> int | None:
        stack = worn_stack(self._spec(), self.worn)
        return HAZARD_COLOUR[stack[-1][1]] if stack else None

    def _place_figure(self) -> None:
        found = self.current_level.get_sprites_by_name("figure")
        if found:
            found[0].pixels = np.array(_figure(PLAYER, self._outermost()))
            found[0].set_position(self.px * CELL, self.py * CELL)

    def _pull_on_here(self) -> None:
        spec = self._spec()
        key = gear_at(spec, self.px, self.py)
        if key is None or not can_pull_on(spec, self.worn, key):
            return
        self.worn = tuple(sorted(self.worn + (key,)))
        for sprite in self.current_level.get_sprites_by_name(f"gear_{key}"):
            self.current_level.remove_sprite(sprite)
        self._place_figure()

    def step(self) -> None:
        if self._flash:
            self._flash -= 1
            found = self.current_level.get_sprites_by_name("figure")
            if found:
                lit = self._flash % 2 == 0
                found[0].pixels = np.array(
                    _figure(PLAYER if lit else WALL, self._outermost() if lit else None))
            if self._flash == 0:
                self.level_reset()
                self.complete_action()
            return

        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1
        elif self.action.id == GameAction.ACTION5:
            self._pull_on_here()
            self.complete_action()
            return

        if dx or dy:
            spec = self._spec()
            nx, ny = self.px + dx, self.py + dy
            if not is_plaster(spec["rows"], nx, ny):
                self.px, self.py = nx, ny
                self._place_figure()
                if (nx, ny) == way_out_cell(spec["rows"]):
                    self.next_level()
                    self.complete_action()
                    return
                if not passable(spec, self.worn, nx, ny):
                    self._flash = self.FLASH_FRAMES
                    return

        self.complete_action()
