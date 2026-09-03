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

FLOOR = 5
WALL = 2
PLAYER = 11
EXIT = 6
MARK = 0
EMPTY_PIP = 3

HAZARD_COLOUR = {"F": 8, "C": 10, "W": 9, "S": 15}

N = 16
CELL = 4
SLOTS = 4


LEVELS_SPEC = [
    {
        "garments": {"a": (0, "F"), "b": (0, "C")},
        "rows": [
            "################",
            "#..............#",
            "#..P...........#",
            "#..............#",
            "#....a....b....#",
            "#..............#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#......X.......#",
            "#..............#",
            "#..............#",
            "#..............#",
            "################",
        ]},
    {
        "garments": {"a": (0, "F"), "c": (2, "F"), "d": (1, "W")},
        "rows": [
            "################",
            "#..............#",
            "#..P...........#",
            "#....a....c....#",
            "#..............#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#......d.......#",
            "#..............#",
            "#WWWWWWWWWWWWWW#",
            "#WWWWWWWWWWWWWW#",
            "#..............#",
            "#......X.......#",
            "#..............#",
            "################",
        ]},
    {
        "garments": {"a": (0, "F"), "b": (1, "F"), "c": (1, "C"),
                     "d": (3, "C"), "e": (2, "F"), "f": (2, "W")},
        "rows": [
            "################",
            "#..P...........#",
            "#....a....b....#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#....c....d....#",
            "#CCCCCCCCCCCCCC#",
            "#CCCCCCCCCCCCCC#",
            "#..............#",
            "#....e....f....#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#......X.......#",
            "################",
        ]},
    {
        "garments": {"a": (0, "F"), "b": (2, "F"), "c": (1, "W"),
                     "d": (3, "W"), "e": (2, "S")},
        "rows": [
            "################",
            "#..P...........#",
            "#...a....b.....#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#...c....d.....#",
            "#WWWWWWWWWWWWWW#",
            "#WWWWWWWWWWWWWW#",
            "#..............#",
            "#.....e........#",
            "#SSSSSSSSSSSSSS#",
            "#SSSSSSSSSSSSSS#",
            "#..............#",
            "#......X.......#",
            "################",
        ]},
    {
        "garments": {"a": (0, "C"), "b": (1, "C"), "c": (1, "F"),
                     "d": (3, "F"), "e": (2, "C"), "f": (3, "S")},
        "rows": [
            "################",
            "#..P...........#",
            "#...a....b.....#",
            "#CCCCCCCCCCCCCC#",
            "#CCCCCCCCCCCCCC#",
            "#..............#",
            "#...c....d.....#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#...e....f.....#",
            "#CCCCCCCCCCCCCC#",
            "#CCCCCCCCCCCCCC#",
            "#..............#",
            "#......X.......#",
            "################",
        ]},
    {
        "garments": {"a": (0, "S"), "b": (2, "S"), "c": (1, "F"),
                     "d": (1, "S"), "e": (2, "S"), "f": (3, "W")},
        "rows": [
            "################",
            "#..P...........#",
            "#...a....b.....#",
            "#SSSSSSSSSSSSSS#",
            "#SSSSSSSSSSSSSS#",
            "#..............#",
            "#...c....d.....#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#...e....f.....#",
            "#SSSSSSSSSSSSSS#",
            "#SSSSSSSSSSSSSS#",
            "#..............#",
            "#......X.......#",
            "################",
        ]},
    {
        "garments": {"a": (0, "F"), "b": (1, "F"), "c": (1, "C"),
                     "d": (2, "C"), "e": (2, "W"), "h": (3, "S")},
        "rows": [
            "################",
            "#..P.a....b....#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#....c....d....#",
            "#CCCCCCCCCCCCCC#",
            "#CCCCCCCCCCCCCC#",
            "#....e.........#",
            "#WWWWWWWWWWWWWW#",
            "#WWWWWWWWWWWWWW#",
            "#....h.........#",
            "#SSSSSSSSSSSSSS#",
            "#SSSSSSSSSSSSSS#",
            "#..............#",
            "#......X.......#",
            "################",
        ]},
    {
        "garments": {"a": (0, "W"), "b": (1, "W"), "c": (1, "S"),
                     "d": (2, "S"), "e": (2, "C"), "f": (3, "C"), "g": (3, "F")},
        "rows": [
            "################",
            "#..P.a...b.....#",
            "#WWWWWWWWWWWWWW#",
            "#WWWWWWWWWWWWWW#",
            "#....c....d....#",
            "#SSSSSSSSSSSSSS#",
            "#SSSSSSSSSSSSSS#",
            "#....e....f....#",
            "#CCCCCCCCCCCCCC#",
            "#CCCCCCCCCCCCCC#",
            "#....g.........#",
            "#FFFFFFFFFFFFFF#",
            "#FFFFFFFFFFFFFF#",
            "#..............#",
            "#......X.......#",
            "################",
        ]},
]


def hazard_at(rows, x: int, y: int):
    ch = rows[y][x]
    return ch if ch in HAZARD_COLOUR else None


def is_wall(rows, x: int, y: int) -> bool:
    return not (0 <= x < N and 0 <= y < N) or rows[y][x] == "#"


def garment_at(spec, x: int, y: int):
    ch = spec["rows"][y][x]
    return ch if ch in spec["garments"] else None


def worn_list(spec, donned) -> list:
    return sorted((spec["garments"][k] for k in donned), key=lambda g: g[0])


def don_legal(spec, donned, key: str) -> bool:
    if key in donned:
        return False
    slot = spec["garments"][key][0]
    filled = {s for s, _ in worn_list(spec, donned)}
    return all(s not in filled for s in range(slot, SLOTS))


def active_hazards(worn) -> frozenset:
    return frozenset(
        h for i, (_, h) in enumerate(worn)
        if all(outer_h == h for _, outer_h in worn[i + 1:])
    )


def start_cell(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                return x, y
    raise AssertionError("level has no start")


def exit_cell(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                return x, y
    raise AssertionError("level has no exit")


def survives(spec, donned, x: int, y: int) -> bool:
    hz = hazard_at(spec["rows"], x, y)
    return hz is None or hz in active_hazards(worn_list(spec, donned))


def _cell_block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _rounded(colour: int) -> list[list[int]]:
    block = _cell_block(colour)
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        block[y][x] = -1
    return block


def _weave(colour: int) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(CELL)]
            for y in range(CELL)]


def _figure(body: int, coat: int | None) -> list[list[int]]:
    block = _rounded(body)
    if coat is not None:
        for i in range(CELL):
            block[0][i] = block[CELL - 1][i] = coat
            block[i][0] = block[i][CELL - 1] = coat
        for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
            block[y][x] = -1
    return block


_MARK_SPOTS = ((0, 0), (1, 0), (0, 1), (1, 1))


def _garment_pixels(slot: int, hazard: str) -> list[list[int]]:
    block = _rounded(HAZARD_COLOUR[hazard])
    for i in range(slot + 1):
        mx, my = _MARK_SPOTS[i]
        block[my][mx] = MARK
    return block


def _exit_pixels() -> list[list[int]]:
    block = _cell_block(EXIT)
    block[1][1] = block[1][2] = block[2][1] = block[2][2] = -1
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_cell_block(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif ch in HAZARD_COLOUR:
                    sprites.append(Sprite(
                        pixels=_weave(HAZARD_COLOUR[ch]), name=f"band_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif ch == "X":
                    sprites.append(Sprite(
                        pixels=_exit_pixels(), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
                elif ch in spec["garments"]:
                    slot, hazard = spec["garments"][ch]
                    sprites.append(Sprite(
                        pixels=_garment_pixels(slot, hazard), name=f"garment_{ch}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
                elif ch == "P":
                    sprites.append(Sprite(
                        pixels=_figure(PLAYER, None), name="player",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G035A(RenderableUserDisplay):

    ROW = (10, 22, 34, 46)

    def __init__(self, game: "G035") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        filled = dict(worn_list(LEVELS_SPEC[self._game.level_index], self._game.donned))
        for slot in range(SLOTS):
            colour = HAZARD_COLOUR[filled[slot]] if slot in filled else EMPTY_PIP
            top = self.ROW[slot]
            frame[top:top + 2, 63 - slot:64] = colour
        return frame


class G035(ARCBaseGame):

    FLASH_FRAMES = 4

    def __init__(self) -> None:
        self._flash = 0
        self.donned: tuple = ()
        self.px, self.py = start_cell(LEVELS_SPEC[0]["rows"])
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G035A(self)],
        )
        super().__init__(game_id="g035", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self._flash = 0
        self.donned = ()
        self.px, self.py = start_cell(LEVELS_SPEC[self.level_index]["rows"])

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def _outermost(self) -> int | None:
        worn = worn_list(self._spec(), self.donned)
        return HAZARD_COLOUR[worn[-1][1]] if worn else None

    def _place_player(self) -> None:
        found = self.current_level.get_sprites_by_name("player")
        if found:
            found[0].pixels = np.array(_figure(PLAYER, self._outermost()))
            found[0].set_position(self.px * CELL, self.py * CELL)

    def _don_here(self) -> None:
        spec = self._spec()
        key = garment_at(spec, self.px, self.py)
        if key is None or not don_legal(spec, self.donned, key):
            return
        self.donned = tuple(sorted(self.donned + (key,)))
        for sprite in self.current_level.get_sprites_by_name(f"garment_{key}"):
            self.current_level.remove_sprite(sprite)
        self._place_player()

    def step(self) -> None:
        if self._flash:
            self._flash -= 1
            found = self.current_level.get_sprites_by_name("player")
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
            self._don_here()
            self.complete_action()
            return

        if dx or dy:
            spec = self._spec()
            nx, ny = self.px + dx, self.py + dy
            if not is_wall(spec["rows"], nx, ny):
                self.px, self.py = nx, ny
                self._place_player()
                if (nx, ny) == exit_cell(spec["rows"]):
                    self.next_level()
                    self.complete_action()
                    return
                if not survives(spec, self.donned, nx, ny):
                    self._flash = self.FLASH_FRAMES
                    return

        self.complete_action()
