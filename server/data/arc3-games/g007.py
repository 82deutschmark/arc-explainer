# ARC-AGI-3 candidate task g007.

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

VOID = 5
FLOOR = 4
CRACK_BASE = 1
CRACK_LINE = 5
BROAD = 9
POINT = 8
SPAN_ON = 2
SPAN_OFF = 3
GOAL_RIM = 14
GOAL_PIT = 5
BLOCK = 12
BLOCK_TOP = 11

N = 16
CELL = 4

LEVELS_SPEC = [
    ["                ",
     "                ",
     "                ",
     "                ",
     "                ",
     "    .........   ",
     "    .........   ",
     "    S.......G   ",
     "    .........   ",
     "                ",
     "                ",
     "                ",
     "                ",
     "                ",
     "                ",
     "                "],
    ["                ",
     "                ",
     "                ",
     "                ",
     "                ",
     "  ...       ... ",
     "  ...fffffff... ",
     "  S..fffffff..G ",
     "  ...       ... ",
     "                ",
     "                ",
     "                ",
     "                ",
     "                ",
     "                ",
     "                "],
    ["                ",
     "                ",
     "                ",
     "     ....       ",
     "     ....       ",
     "     .hh.       ",
     "     ....       ",
     "  S.....        ",
     "  ...           ",
     "  ...bbbb...    ",
     "        ...G.   ",
     "        .....   ",
     "                ",
     "                ",
     "                ",
     "                "],
    ["                ",
     "                ",
     "   .....        ",
     "   .....        ",
     "   S..fffff..   ",
     "   ...fffff..   ",
     "   .....  .hh.  ",
     "          ....  ",
     "          ....  ",
     "     bbbbb..    ",
     "   .....        ",
     "   ..G..        ",
     "   .....        ",
     "   .....        ",
     "                ",
     "                "],
    ["                ",
     "                ",
     "    .....       ",
     "    .....       ",
     "    S....       ",
     "    .....       ",
     "      ..        ",
     "      .p        ",
     "      ..        ",
     "    bbbb....    ",
     "        ....    ",
     "        .G..    ",
     "        ....    ",
     "                ",
     "                ",
     "                "],
    ["                ",
     "                ",
     "  ....          ",
     "  ....          ",
     "  S...          ",
     "  ....BBBB....  ",
     "  ....    ....  ",
     "          .hh.  ",
     "          ....  ",
     "          b     ",
     "          b     ",
     "          b     ",
     "        ....    ",
     "        .G..    ",
     "        ....    ",
     "                "],
    ["                ",
     "   ....         ",
     "   ....         ",
     "   S...         ",
     "   ....         ",
     "   ..           ",
     "   .p           ",
     "   ..           ",
     "  bbbb          ",
     "  ....hh...     ",
     "  ....  ...     ",
     "  ....  BBBB    ",
     "          ....  ",
     "          ffff  ",
     "          ffff  ",
     "          .G..  "],
    ["                ",
     "  ....          ",
     "  S...          ",
     "  ....fff...    ",
     "  ....fff...    ",
     "        .hh.    ",
     "        ....    ",
     "     bbbb..     ",
     "   ....         ",
     "   ....         ",
     "   .p           ",
     "   ..           ",
     "   ..           ",
     "  BBBB....      ",
     "      .G..      ",
     "      ....      "],
]


def is_solid(char: str, plates: int) -> bool:
    if char == " ":
        return False
    if char == "b":
        return plates == 1
    if char == "B":
        return plates == 0
    return True


def occupied(state: tuple) -> list:
    x, y, o = state
    if o == "U":
        return [(x, y)]
    if o == "H":
        return [(x, y), (x + 1, y)]
    return [(x, y), (x, y + 1)]


def tip(state: tuple) -> dict:
    x, y, o = state
    if o == "U":
        return {1: (x, y - 2, "V"), 2: (x, y + 1, "V"),
                3: (x - 2, y, "H"), 4: (x + 1, y, "H")}
    if o == "H":
        return {1: (x, y - 1, "H"), 2: (x, y + 1, "H"),
                3: (x - 1, y, "U"), 4: (x + 2, y, "U")}
    return {1: (x, y - 1, "U"), 2: (x, y + 2, "U"),
            3: (x - 1, y, "V"), 4: (x + 1, y, "V")}


def resolve(rows: list, state: tuple, plates: int, action: int):
    nxt = tip(state).get(action)
    if nxt is None:
        return "FALL"
    cells = occupied(nxt)
    for (x, y) in cells:
        if not (0 <= x < N and 0 <= y < N):
            return "FALL"
        if not is_solid(rows[y][x], plates):
            return "FALL"
    standing = nxt[2] == "U"
    if standing and rows[cells[0][1]][cells[0][0]] == "f":
        return "FALL"
    latched = plates
    if standing and rows[cells[0][1]][cells[0][0]] == "p":
        latched ^= 1
    elif not standing and any(rows[y][x] == "h" for (x, y) in cells):
        latched ^= 1
    if latched != plates:
        for (x, y) in cells:
            if not is_solid(rows[y][x], latched):
                return "FALL"
    return (nxt, latched)


def start_state(rows: list) -> tuple:
    for y in range(N):
        for x in range(N):
            if rows[y][x] == "S":
                return (x, y, "U")
    raise ValueError("level has no start")


def is_won(rows: list, state: tuple) -> bool:
    return state[2] == "U" and rows[state[1]][state[0]] == "G"


def _flat(colour: int) -> list:
    return [[colour] * CELL for _ in range(CELL)]


def _cracked() -> list:
    px = _flat(CRACK_BASE)
    for i in range(CELL):
        px[i][i] = CRACK_LINE
    return px


def _broad_plate() -> list:
    px = _flat(FLOOR)
    for x in range(CELL):
        px[1][x] = BROAD
        px[2][x] = BROAD
    return px


def _point_plate() -> list:
    px = _flat(FLOOR)
    px[1][1] = px[1][2] = px[2][1] = px[2][2] = POINT
    return px


def _span(present: bool) -> list:
    if present:
        return _flat(SPAN_ON)
    px = _flat(VOID)
    px[0][0] = px[0][CELL - 1] = SPAN_OFF
    px[CELL - 1][0] = px[CELL - 1][CELL - 1] = SPAN_OFF
    return px


def _pit() -> list:
    px = _flat(GOAL_RIM)
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            px[y][x] = GOAL_PIT
    return px


def _block(standing: bool) -> list:
    px = _flat(BLOCK)
    if standing:
        px[1][1] = px[1][2] = px[2][1] = px[2][2] = BLOCK_TOP
    return px


TILE_ART = {".": _flat(FLOOR), "S": _flat(FLOOR), "f": _cracked(),
            "h": _broad_plate(), "p": _point_plate(), "G": _pit()}


def build_levels() -> list:
    levels = []
    for rows in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char == " ":
                    continue
                if char in ("b", "B"):
                    art = _span(char == "B")
                    tags = ["span", f"kind_{char}"]
                else:
                    art = TILE_ART[char]
                    tags = ["tile"]
                sprites.append(Sprite(
                    pixels=art, name=f"t_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=-1, tags=tags,
                ).set_position(x * CELL, y * CELL))
        sx, sy, _ = start_state(rows)
        for half in ("a", "b"):
            sprites.append(Sprite(
                pixels=_block(True), name=f"block_{half}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=1,
            ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G007A(RenderableUserDisplay):

    def __init__(self, game: "G007") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        for i in range(len(LEVELS_SPEC)):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[0:2, x:x + 2] = BLOCK_TOP if i <= self._game.level_index else SPAN_OFF
        return frame


class G007(ARCBaseGame):

    def __init__(self) -> None:
        self.state = start_state(LEVELS_SPEC[0])
        self.plates = 0
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=VOID, letter_box=VOID,
                        interfaces=[G007A(self)])
        super().__init__(game_id="g007", levels=build_levels(), camera=camera)
        self._repaint()

    def on_set_level(self, level: Level) -> None:
        self.state = start_state(LEVELS_SPEC[self.level_index])
        self.plates = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)
        self._repaint()

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)
        self._repaint()

    @property
    def rows(self) -> list:
        return LEVELS_SPEC[self.level_index]

    def _repaint(self) -> None:
        rows = self.rows
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char not in ("b", "B"):
                    continue
                for sprite in self.current_level.get_sprites_by_name(f"t_{x}_{y}"):
                    sprite.pixels = np.array(_span(is_solid(char, self.plates)))
        cells = occupied(self.state)
        art = np.array(_block(self.state[2] == "U"))
        for half, (x, y) in zip(("a", "b"), cells if len(cells) == 2 else cells * 2):
            for sprite in self.current_level.get_sprites_by_name(f"block_{half}"):
                sprite.pixels = art
                sprite.set_position(x * CELL, y * CELL)

    ACTIONS = {GameAction.ACTION1: 1, GameAction.ACTION2: 2,
               GameAction.ACTION3: 3, GameAction.ACTION4: 4}

    def step(self) -> None:
        action = self.ACTIONS.get(self.action.id)
        if action is None:
            self.complete_action()
            return
        result = resolve(self.rows, self.state, self.plates, action)
        if result == "FALL":
            self.level_reset()
            self.complete_action()
            return
        self.state, self.plates = result
        if is_won(self.rows, self.state):
            if self.is_last_level():
                self._repaint()
                self.next_level()
            else:
                self.next_level()
                self.on_set_level(self.current_level)
                self._repaint()
            self.complete_action()
            return
        self._repaint()
        self.complete_action()
