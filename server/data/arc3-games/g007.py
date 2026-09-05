# ARC-AGI-3 candidate task g007.

import numpy as np

from sprite_book import block, core, hatch, ring, rounded, studs, weave

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

VOID = 4
FLOOR = 0
GRAIN = 2
LATCH = 10
GOAL = 14
BLOCK = 8
BLOCK_CAP = FLOOR
PIP_ON = GOAL
PIP_OFF = GRAIN

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


def _slab(mark: list = None) -> list:
    px = block(FLOOR)
    px[0][0] = GRAIN
    if mark is not None:
        for y in range(CELL):
            for x in range(CELL):
                if mark[y][x] != -1:
                    px[y][x] = mark[y][x]
    return px


def _cracked() -> list:
    return weave(FLOOR)


def _bar(vertical: bool) -> list:
    px = [[-1] * CELL for _ in range(CELL)]
    for i in range(CELL):
        if vertical:
            px[i][1] = px[i][2] = LATCH
        else:
            px[1][i] = px[2][i] = LATCH
    return px


def _span(present: bool) -> list:
    px = block(LATCH) if present else [[-1] * CELL for _ in range(CELL)]
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        px[y][x] = LATCH
    return px


def _span_shifting() -> list:
    px = weave(LATCH)
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        px[y][x] = LATCH
    return px


def _pit() -> list:
    return ring(GOAL)


def _block(orientation: str, half: int = 0) -> list:
    px = rounded(BLOCK)
    far = CELL - 1
    if orientation == "U":
        px[far][0] = px[far][far] = BLOCK
        px[1][1] = px[1][2] = BLOCK_CAP
        return px
    if orientation == "H":
        joins = ((0, far), (far, far)) if half == 0 else ((0, 0), (far, 0))
    else:
        joins = ((far, 0), (far, far)) if half == 0 else ((0, 0), (0, far))
    for (y, x) in joins:
        px[y][x] = BLOCK
    return px


def _wreck(stage: int) -> list:
    if stage < 2:
        return rounded(BLOCK)
    if stage < 4:
        return weave(BLOCK)
    return hatch(BLOCK)


def _sunk(stage: int) -> list:
    if stage == 0:
        return _block("U")
    if stage == 1:
        return rounded(BLOCK)
    return core(BLOCK)


def _tile(char: str) -> list:
    if char == "f":
        return _cracked()
    if char == "h":
        return _slab(_bar(False))
    if char == "p":
        return _slab(_bar(True))
    if char == "G":
        return _pit()
    return _slab()


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
                    art = _tile(char)
                    tags = ["tile"]
                sprites.append(Sprite(
                    pixels=art, name=f"t_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=-1, tags=tags,
                ).set_position(x * CELL, y * CELL))
        sx, sy, _ = start_state(rows)
        for half in ("a", "b"):
            sprites.append(Sprite(
                pixels=_block("U"), name=f"block_{half}",
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
        return studs(frame, count=len(LEVELS_SPEC), filled=self._game.level_index + 1,
                     on=PIP_ON, off=PIP_OFF, side="west", start=6, gap=7)


class G007(ARCBaseGame):

    FALL_FRAMES = 6
    SINK_FRAMES = 3
    LATCH_FRAMES = 3

    def __init__(self) -> None:
        self.state = start_state(LEVELS_SPEC[0])
        self.plates = 0
        self._falling = 0
        self._sinking = 0
        self._latching = 0
        self._wreck_cells = [(0, 0)]
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=VOID, letter_box=VOID,
                        interfaces=[G007A(self)])
        super().__init__(game_id="g007", levels=build_levels(), camera=camera)
        self._repaint()

    def on_set_level(self, level: Level) -> None:
        self.state = start_state(LEVELS_SPEC[self.level_index])
        self.plates = 0
        self._falling = 0
        self._sinking = 0
        self._latching = 0

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
        pairs = cells if len(cells) == 2 else cells * 2
        for half, (x, y) in enumerate(pairs):
            art = np.array(_block(self.state[2], half))
            for sprite in self.current_level.get_sprites_by_name(f"block_{'ab'[half]}"):
                sprite.pixels = art
                sprite.set_position(x * CELL, y * CELL)

    def _paint(self, art: list, cells: list) -> None:
        pixels = np.array(art)
        for half, (x, y) in zip(("a", "b"), cells if len(cells) == 2 else cells * 2):
            for sprite in self.current_level.get_sprites_by_name(f"block_{half}"):
                sprite.pixels = pixels
                sprite.set_position(x * CELL, y * CELL)

    def _begin_fall(self, action: int) -> None:
        nxt = tip(self.state).get(action)
        cells = occupied(nxt) if nxt else []
        if not cells or any(not (0 <= x < N and 0 <= y < N) for (x, y) in cells):
            cells = occupied(self.state)
        self._wreck_cells = cells
        self._falling = self.FALL_FRAMES
        self._paint(_wreck(0), cells)

    def _paint_wreck(self) -> None:
        self._paint(_wreck(self.FALL_FRAMES - self._falling), self._wreck_cells)

    def _paint_sink(self) -> None:
        self._paint(_sunk(self.SINK_FRAMES - self._sinking), [self.state[:2]])

    def _paint_latch(self) -> None:
        art = np.array(_span_shifting())
        for sprite in self.current_level.get_sprites_by_tag("span"):
            sprite.pixels = art

    ACTIONS = {GameAction.ACTION1: 1, GameAction.ACTION2: 2,
               GameAction.ACTION3: 3, GameAction.ACTION4: 4}

    def step(self) -> None:
        if self._falling:
            self._falling -= 1
            if self._falling == 0:
                self.level_reset()
                self.complete_action()
                return
            self._paint_wreck()
            return
        if self._sinking:
            self._sinking -= 1
            if self._sinking == 0:
                self.next_level()
                self.complete_action()
                return
            self._paint_sink()
            return
        if self._latching:
            self._latching -= 1
            if self._latching == 0:
                self._repaint()
                self.complete_action()
                return
            self._paint_latch()
            return

        action = self.ACTIONS.get(self.action.id)
        if action is None:
            self.complete_action()
            return
        result = resolve(self.rows, self.state, self.plates, action)
        if result == "FALL":
            self._begin_fall(action)
            return
        was = self.plates
        self.state, self.plates = result
        self._repaint()
        if is_won(self.rows, self.state):
            self._sinking = self.SINK_FRAMES
            self._paint_sink()
            return
        if self.plates != was:
            self._latching = self.LATCH_FRAMES
            self._paint_latch()
            return
        self.complete_action()
