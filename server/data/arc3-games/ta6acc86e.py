# ARC-AGI-3 candidate task ta6acc86e.

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

VOID = 3
FLOOR = 9
WALL = 0
KEY = 12
EXIT = 6
PLAYER = 11
SHUTTER = 8
PIP_ON = KEY
PIP_OFF = 4
MOUTH = {"A": 9, "B": 10, "C": 15, "D": 6}

N = 16
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}

BASE_CYCLE = (("A", "B"), ("B", "C"), ("C", "A"))
ODD_ONE_OUT = ("C", "A", "B")


def links(present: frozenset, tick: int) -> dict:
    out: dict = {}
    a, b = BASE_CYCLE[tick % 3]
    if a in present and b in present:
        out[a] = b
        out[b] = a
    if "D" in present and tick % 4 == 0:
        odd = ODD_ONE_OUT[tick % 3]
        if odd in present:
            out["D"] = odd
            out[odd] = "D"
    return out


def shutter_open(spec: dict, tick: int) -> bool:
    beat = spec.get("shutter_beat")
    return beat is not None and tick % 3 == beat


def mouths_present(rows) -> frozenset:
    return frozenset(c for row in rows for c in row if c in MOUTH)


def mouth_positions(rows) -> dict:
    return {c: (x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c in MOUTH}


def find_char(rows, target) -> tuple:
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == target:
                return x, y
    raise AssertionError(f"level has no {target}")


def find_all(rows, target) -> set:
    return {(x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c == target}


def cell_walkable(spec: dict, x: int, y: int, tick: int) -> bool:
    rows = spec["rows"]
    if not (0 <= x < N and 0 <= y < N):
        return False
    ch = rows[y][x]
    if ch in "# ":
        return False
    if ch == "s":
        return shutter_open(spec, tick)
    return ch != "X"


LEVELS_SPEC = [
    {"budget": 32, "shutter_beat": None, "rows": [
        "                ",
        ".P..............",
        "................",
        "................",
        "......A.........",
        "................",
        "................",
        "................",
        "                ",
        "................",
        "......B.........",
        "................",
        ".......k........",
        "................",
        "..X.............",
        "                ",
    ]},
    {"budget": 38, "shutter_beat": None, "rows": [
        "                ",
        "..P.............",
        "................",
        "......####......",
        "...A............",
        "......####......",
        "........k.......",
        "................",
        "                ",
        "................",
        ".........k.B....",
        "................",
        "...####.........",
        ".......X........",
        "................",
        "                ",
    ]},
    {"budget": 38, "shutter_beat": None, "rows": [
        "                ",
        "..A.............",
        "................",
        "................",
        "....k...........",
        "                ",
        "..B.............",
        "................",
        "................",
        "..........X.....",
        "                ",
        "................",
        "..P.C...........",
        "................",
        "................",
        "                ",
    ]},
    {"budget": 55, "shutter_beat": None, "rows": [
        "                ",
        "..A.............",
        "................",
        "....##....##....",
        ".......X........",
        "                ",
        "..k.......B.....",
        "................",
        "................",
        "...#####........",
        "                ",
        "................",
        "......C.........",
        "................",
        "..P.........k...",
        "                ",
    ]},
    {"budget": 51, "shutter_beat": 1, "rows": [
        "                ",
        "..A.............",
        "................",
        "#########s######",
        "..........k.....",
        "                ",
        "......B.........",
        "................",
        "....X...........",
        "................",
        "                ",
        "................",
        "..P.......C.....",
        "................",
        "................",
        "                ",
    ]},
    {"budget": 34, "shutter_beat": None, "rows": [
        "                ",
        "..A..... .......",
        "........ .......",
        "........ ...k...",
        "........ .......",
        "........ ....D..",
        "........ .......",
        "                ",
        "...B.... .......",
        "........ .......",
        "........ .......",
        "..P..... ..C....",
        "........ .......",
        "........ ...X...",
        "........ .......",
        "                ",
    ]},
    {"budget": 46, "shutter_beat": 0, "rows": [
        "                ",
        "..A..... .......",
        "........ ..#####",
        "..k..... ..s.k..",
        "........ ..#####",
        "........ ....D..",
        "........ .......",
        "                ",
        "...B.... .......",
        "........ .......",
        "........ .......",
        "..P..... ..C....",
        "........ .......",
        "........ ...X...",
        "........ ...k...",
        "                ",
    ]},
    {"budget": 54, "shutter_beat": 0, "rows": [
        "                ",
        "..A..k.. ...D...",
        "........ .......",
        "....#### ###....",
        "........ k.s....",
        "........ ###....",
        "........ .......",
        "                ",
        "...B.... ...C...",
        "...####. .......",
        "......k. .......",
        "..P..... .......",
        "........ ...X...",
        "........ .......",
        "........ ....k..",
        "                ",
    ]},
]


def _block(colour: int) -> list:
    return [[colour] * CELL for _ in range(CELL)]


def _rounded(colour: int) -> list[list[int]]:
    block = [[colour] * CELL for _ in range(CELL)]
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        block[y][x] = -1
    return block


def _ring(colour: int) -> list:
    px = _block(colour)
    for r in range(1, CELL - 1):
        for c in range(1, CELL - 1):
            px[r][c] = FLOOR
    return px


def _board_pixels(rows) -> list:
    px = [[VOID] * (N * CELL) for _ in range(N * CELL)]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            colour = WALL if ch == "#" else FLOOR
            for r in range(CELL):
                for c in range(CELL):
                    px[y * CELL + r][x * CELL + c] = colour
    return px


def build_levels() -> list:
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites = [Sprite(
            pixels=_board_pixels(rows), name="board",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-2,
        ).set_position(0, 0)]
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in " .#P":
                    continue
                if ch == "k":
                    pixels, name, layer = _rounded(KEY), f"k_{x}_{y}", 0
                elif ch == "X":
                    pixels, name, layer = _ring(EXIT), "exit", 0
                elif ch == "s":
                    pixels, name, layer = _block(SHUTTER), f"s_{x}_{y}", 0
                else:
                    pixels, name, layer = _block(MOUTH[ch]), f"m_{ch}", 0
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=layer,
                ).set_position(x * CELL, y * CELL))
        sprites.append(Sprite(
            pixels=_rounded(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(0, 0))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Ge3e8d9dc(RenderableUserDisplay):

    def __init__(self, game: "Gde529f75") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        tick = self._game.tick
        found = self._game.current_level.get_sprites_by_name("player")
        if found:
            px, py = found[0].x, found[0].y
            for i in range(3):
                x = px + i
                if 0 <= x < 64 and py - 1 >= 0:
                    frame[py - 1, x] = PIP_ON if i == tick % 3 else PIP_OFF
            if "D" in self._game.present:
                for i in range(4):
                    x = px + i
                    if 0 <= x < 64 and py + CELL < 64:
                        frame[py + CELL, x] = PIP_ON if i == tick % 4 else PIP_OFF
        left = max(0, min(self._game.moves_left, frame.shape[1] - 2))
        if left:
            frame[60:63, 1:1 + left] = PIP_ON
        return frame


class Gde529f75(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.tick = 0
        self.moves_left = spec["budget"]
        self.px, self.py = 0, 0
        self.keys_left: set = set()
        self.present = mouths_present(spec["rows"])
        self.mouths: dict = {}
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=VOID, letter_box=5,
            interfaces=[Ge3e8d9dc(self)],
        )
        super().__init__(game_id="ta6acc86e", levels=build_levels(), camera=camera)

    @property
    def spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def on_set_level(self, level: Level) -> None:
        spec = self.spec
        rows = spec["rows"]
        self.tick = 0
        self.moves_left = spec["budget"]
        self.px, self.py = find_char(rows, "P")
        self.keys_left = find_all(rows, "k")
        self.present = mouths_present(rows)
        self.mouths = mouth_positions(rows)
        self._sync()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        player = level.get_sprites_by_name("player")
        if player:
            player[0].set_position(self.px * CELL, self.py * CELL)
        exits = level.get_sprites_by_name("exit")
        if exits:
            exits[0].pixels[1:CELL - 1, 1:CELL - 1] = FLOOR if self.keys_left else EXIT
        if self.spec.get("shutter_beat") is not None:
            fill = FLOOR if shutter_open(self.spec, self.tick) else SHUTTER
            for x, y in find_all(self.spec["rows"], "s"):
                for sprite in level.get_sprites_by_name(f"s_{x}_{y}"):
                    sprite.pixels[1:CELL - 1, 1:CELL - 1] = fill

    def step(self) -> None:
        d = DIRS.get(self.action.id)
        if d is None:
            self.complete_action()
            return

        spec = self.spec
        rows = spec["rows"]
        tick = self.tick
        nx, ny = self.px + d[0], self.py + d[1]
        ch = rows[ny][nx] if 0 <= nx < N and 0 <= ny < N else " "

        if ch == "X" and not self.keys_left:
            self.next_level()
            self.complete_action()
            return

        if cell_walkable(spec, nx, ny, tick):
            self.px, self.py = nx, ny
            if ch in MOUTH:
                partner = links(self.present, tick).get(ch)
                if partner is not None:
                    self.px, self.py = self.mouths[partner]
            self.keys_left.discard((self.px, self.py))
            for sprite in self.current_level.get_sprites_by_name(f"k_{self.px}_{self.py}"):
                self.current_level.remove_sprite(sprite)

        self.tick += 1
        self.moves_left -= 1
        if self.moves_left <= 0:
            self.level_reset()
            self.complete_action()
            return

        self._sync()
        self.complete_action()
