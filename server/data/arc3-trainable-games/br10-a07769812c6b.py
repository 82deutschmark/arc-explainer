"""br10 -- warm air takes one floor per turn, so you shovel before anyone is cold.

Author: Claude Opus 5, 20-September-2026 (glow-up of the "Thermostat Tiles" seed, topic anthropic:a057).
Revised: Claude Sonnet 5.5, 13-October-2026 (readable gauge and progress column, eight levels
that climb, Space rakes a stove out, Down rests a turn). Revised again 13-October-2026 after the
Boss mashed through levels 1 and 2 without ever losing: a worry bar over every bed that can kill,
a bigger house with faces and a thermometer, and a short death that restarts the night.
Author of this revision: Claude Opus 5.5 High. Date: 19-October-2026.
PURPOSE: the whole game in one file (numpy + arcengine): rules (rule_turn, no pictures, so solvers can copy the
state cheaply), level specs (LEVELS), the cut-away house drawn as sprites, and the turn's frames. Published to the
arc-3 Games page by arc-3/scripts/publish_game_versions.py from arc3games/polish/br10-next3/.
SRP/DRY check: Pass -- one game file; the level lab (lab.py beside it) measures levels and is not imported here.
CHANGELOG: 19-Oct-2026 (Claude Opus 5.5 High) -- the Boss: "I just still don't get this one. All the levels seem
very repetitive." Level one's first picture now shows the goal beside the cold house: the same house already won (lit
stove, warm air in every room, a smiling sleeper whose bar sits in its band, a full night column), drawn by
_goal_sprites and never part of the rules. Levels three to nine are new, from gen_br10.py (seed 1), each asking a
different thing with a different row of houses: three houses at once; one stove for two beds; a fire left burning; a
sleeper already too hot; a broken skylight; a too-hot sleeper sharing a stove with a cold one; everything at once.
Levels one and two are unchanged.
CHANGELOG: 18-Oct-2026 (Claude Opus 5.5 High) -- the Boss: "still too difficult at level 2. Not really sure what
I'm supposed to do." Level two added three things at once (walking to other stoves, three houses of different
heights to warm together, a worry bar that can kill). A new level two adds one: a second, taller house beside
level one's kind of house, whose coal must go in first. The old level two is now level three and the rest move
along: nine levels.

You are the stoker in the cellar of a lodging house on a winter night. Walk left and right
along the cellar; press Up beside a stove to shovel in coal. A shovel is two lumps, a stove burns
one lump a turn, and each burning lump sends one puff of warm air up its flue. The puff climbs
one floor a turn and warms every sleeper it passes, so a sleeper four floors up feels a stove
four turns after it burns. A room with no warm air cools one step. Each bed has a thermometer on
the wall: the bar rises with the room's warmth, and a green band beside it shows where the bar
should stand. Keep every bar inside its band for as many turns in a row as the column at the
edge of the screen has boxes, and the night is won. Too much heat and a sleeper throws off the
blanket, sits up, and will not settle again until the room has cooled below the band.
Every bed also has a worry bar above it. It fills blue for every turn the sleeper is too cold, twice
as fast in red for every turn they sit up too hot, and drains while they are comfortable. When it is
full the sleeper dies, you see how, and the night starts over as it was. Level 1 shows the bar but
it cannot fill all the way. Space rakes the coal out of a stove (the heat already climbing
stays), Down rests a turn.
"""

from __future__ import annotations

import numpy as np
from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, Level, Sprite

# ── palette (arcengine indices): a blue winter night, a warm brick house, a green stoker ──
WHITE, LIGHT, GRAY, DIM, DARK, BLACK = 0, 1, 2, 3, 4, 5
RED, BLUE, SKY, YELLOW, ORANGE, MAROON, GREEN, PURPLE = 8, 9, 10, 11, 12, 13, 14, 15
CLEAR = -1
RAMP = [SKY, MAROON, RED, ORANGE, YELLOW, WHITE]  # warmth 0..5 on one warm ramp

# ── board geometry ────────────────────────────────────────────────────────────
CELL = 11           # a cellar cell, and the width of the flue above it
STOREY = 10         # floor to floor
CEIL = 55           # y of the slab the cellar ceiling sits on
ROOM_W, ROOM_H = 10, 9
TMAX = 5            # hottest a room gets
LOAD = 2            # lumps per shovel
PILE_MAX = 6        # lumps a firebox holds
HOT_W = 2           # a sat-up sleeper worries twice as fast as a cold one
FALL = 2            # floors a gust drops through before it mixes away
DEATH_FRAMES = 7    # how long the dead sleeper is shown before the night starts over
MOVE_FRAMES = 3     # a one-cell or one-floor move plays as 3 frames

# Each level: how many turns in a row the house must sleep ("hold"), the cellar width, where the
# keeper starts, and its flues. A flue is (cell, height, [(floor, band low, band high, starting
# warmth)], pile, gust) where pile is coal already burning and gust is (period, phase) for a
# broken skylight. "limit" is how much worry a sleeper can take before they die (level 1 shows the
# bar but cannot be lost: "safe").
LEVELS = [
    {  # 1 teach: one stove, one sleeper three floors up. Two shovels, then rest and watch.
        "hold": 3, "cellar": 3, "keeper": 1, "limit": 12, "safe": True, "goal": True,
        "flues": [(1, 3, [(3, 3, 4, 0)], 0, None)],
    },
    {  # 2 one new thing (18-Oct): level one's routine at a one-floor house, and two steps to the right a house
        #   five floors tall. The stoker starts at the short one, so the obvious first move (shovel here, as on
        #   level one) warms the short bed long before the tall one: the tall house needs its coal first. The
        #   worry limit lets a person try the wrong order twice and still win; random play almost never does.
        "hold": 3, "cellar": 5, "keeper": 1, "limit": 20,
        "flues": [(1, 1, [(1, 3, 4, 0)], 0, None),
                  (3, 5, [(5, 3, 4, 0)], 0, None)],
    },
    {  # 3 three houses warm at once (gen_br10.py, seed 1)
        "hold": 3, "cellar": 5, "keeper": 4, "limit": 19,
        "flues": [(2, 5, [(5, 1, 2, 0)], 0, None),
                  (3, 3, [(3, 1, 2, 0)], 0, None),
                  (4, 5, [(1, 1, 2, 0)], 0, None)],
    },
    {  # 4 one stove for two beds (gen_br10.py, seed 1)
        "hold": 3, "cellar": 5, "keeper": 3, "limit": 21,
        "flues": [(0, 4, [(3, 2, 4, 0), (4, 3, 4, 0)], 0, None),
                  (3, 2, [(1, 1, 2, 0)], 0, None)],
    },
    {  # 5 a fire left burning (gen_br10.py, seed 1)
        "hold": 3, "cellar": 4, "keeper": 0, "limit": 20,
        "flues": [(1, 3, [(1, 1, 2, 0)], 0, None),
                  (2, 5, [(3, 4, 5, 0)], 4, None),
                  (3, 5, [(5, 1, 2, 0)], 0, None)],
    },
    {  # 6 a sleeper already too hot (gen_br10.py, seed 1)
        "hold": 3, "cellar": 5, "keeper": 3, "limit": 24,
        "flues": [(0, 5, [(5, 3, 4, 5)], 0, None),
                  (4, 2, [(1, 1, 2, 0)], 0, None)],
    },
    {  # 7 a broken skylight (gen_br10.py, seed 1)
        "hold": 3, "cellar": 5, "keeper": 4, "limit": 20,
        "flues": [(1, 5, [(5, 1, 2, 0)], 0, None),
                  (2, 3, [(3, 1, 2, 0)], 0, None),
                  (3, 2, [(1, 1, 2, 0)], 0, (7, 4))],
    },
    {  # 8 a too-hot sleeper sharing a stove with a cold one (gen_br10.py, seed 1)
        "hold": 3, "cellar": 5, "keeper": 0, "limit": 23,
        "flues": [(0, 5, [(1, 3, 4, 5), (3, 1, 3, 0)], 0, None),
                  (2, 5, [(5, 3, 4, 0)], 0, None)],
    },
    {  # 9 everything at once (gen_br10.py, seed 1)
        "hold": 3, "cellar": 4, "keeper": 3, "limit": 20,
        "flues": [(0, 5, [(5, 1, 2, 0)], 0, None),
                  (1, 5, [(3, 1, 2, 0)], 0, None),
                  (2, 4, [(1, 2, 3, 0)], 4, (7, 2))],
    },
]


# ── pixel helpers ─────────────────────────────────────────────────────────────


def _grid(w: int, h: int, colour: int) -> list[list[int]]:
    return [[colour] * w for _ in range(h)]


def _array(pixels: list[list[int]]) -> np.ndarray:
    return np.array(pixels, dtype=np.int8)


def _sprite(pixels, name: str, x: int, y: int, layer: int, tags: list[str]) -> Sprite:
    return Sprite(pixels, name=name, x=x, y=y, layer=layer, blocking=BlockingMode.NOT_BLOCKED, tags=list(tags))


def origin(cells: int) -> int:
    """Screen x of cell 0: the cellar is centred."""
    return (64 - cells * CELL) // 2


def cell_x(cell: int, cells: int) -> int:
    return origin(cells) + cell * CELL


def room_y(floor: int) -> int:
    """Screen y of the top row of a floor's room (index 0 is the flue collar in the cellar)."""
    return CEIL - STOREY * floor + 1


# ── scenery: the cut-away house ───────────────────────────────────────────────


def _house_pixels(spec: dict, layer: str) -> list[list[int]]:
    """The cut-away house in two passes.

    "back" is what sits behind the air in the rooms: pale rooms.
    "front" is the brick the air passes behind: party walls, floor slabs and snowy roofs.
    """
    cells = spec["cellar"]
    width = cells * CELL
    g = _grid(width, 64, CLEAR)
    heights = {cell: h for cell, h, _s, _p, _d in spec["flues"]}
    if layer == "back":
        for cell in range(cells):
            left = cell * CELL
            for floor in range(1, heights.get(cell, 0) + 1):
                top = room_y(floor)
                for y in range(top, top + ROOM_H):                # a pale room
                    for x in range(left + 1, left + CELL):
                        g[y][x] = SKY
        return g
    for x in range(width):                                        # the slab the house stands on
        g[CEIL][x] = BLACK
    for cell in range(cells):
        h = heights.get(cell, 0)
        left = cell * CELL
        for floor in range(1, h + 1):
            top = room_y(floor)
            for x in range(left, left + CELL):                    # slab over the room
                g[top - 1][x] = BLACK
            for y in range(top, top + ROOM_H):                    # party wall
                g[y][left] = MAROON
            if heights.get(cell + 1, 0) < floor:                  # outer wall on the right
                for y in range(top, top + ROOM_H):
                    g[y][left + CELL - 1] = MAROON
        if h:
            roof = room_y(h) - 1
            for x in range(left, left + CELL):
                g[roof][x] = WHITE                                # snow along the roof slab
            if roof - 1 >= 0:
                for x in range(left + 1, left + CELL - 1):
                    g[roof - 1][x] = WHITE
            if roof - 2 >= 0:
                g[roof - 2][left + 2] = WHITE
                g[roof - 2][left + CELL - 3] = WHITE              # a stepped snow ridge
    return g


def _ground_pixels() -> list[list[int]]:
    """The cellar floor and passage, the full width of the screen, with a black edge."""
    rows = 63 - CEIL
    g = _grid(64, rows, MAROON)
    g[rows - 1] = [BLACK] * 64
    g[0] = [BLACK] * 64
    return g


def _stove_pixels(pile: int, lit: bool) -> list[list[int]]:
    """A cast-iron stove with a flue collar: one lump of coal for every turn it can still burn."""
    g = _grid(5, 8, CLEAR)
    g[0][1] = g[0][2] = g[0][3] = BLACK                # flue collar into the ceiling
    for y in range(1, 8):
        for x in range(5):
            g[y][x] = PURPLE                           # iron body
    for y in range(2, 5):                              # firebox window: three lumps to a row
        for x in range(1, 4):
            g[y][x] = MAROON if lit else BLACK
    for i in range(min(pile, PILE_MAX)):
        row, col = divmod(i, 3)
        g[4 - row][1 + col] = ORANGE if lit else BLACK
    if lit:
        g[5][1] = g[5][2] = g[5][3] = RED              # the door glows
        g[6][2] = ORANGE
    g[7][0] = g[7][4] = BLACK                          # legs
    return g


_KEY = {".": CLEAR, "W": WHITE, "K": BLACK, "B": BLUE, "O": ORANGE, "R": RED, "Y": YELLOW, "M": MAROON,
        "D": DARK, "L": LIGHT, "S": SKY, "G": GREEN}


def _art(rows: list[str], sub: dict | None = None) -> list[list[int]]:
    sub = sub or {}
    return [[_KEY[sub.get(ch, ch)] for ch in row] for row in rows]


def _keeper_pixels(step: int, bob: bool = False) -> list[list[int]]:
    """The stoker: a squat figure in a green coat and black cap, with eyes, and a shovel."""
    art = [
        ".KKK.",
        ".WKW." if False else ".KWK.",
        ".OOO.",
        "YGGGG",
        "YGGGG",
        "WGGGG",
        ".K.K." if not step else ".KK..",
    ]
    return _art(art)


_COLD = [  # shivering: blue cap and blanket, wide scared eyes, chattering mouth, blue cheeks
    ".BBBBB.",
    ".WKWKW.",
    ".BWKWB.",
    "BBBBBBB",
    "KBBBBBK",
    "KKKKKKK",
]
_WARM = [  # settled: warm cap and blanket, eyes shut, a small smile
    ".OOOOO.",
    ".WDWDW.",
    ".OWKWO.",
    "OOOOOOO",
    "KOOOOOK",
    "KKKKKKK",
]
_HOT = [   # sat bolt upright, red in the face, eyes wide open, blanket kicked to the foot
    ".RRRRR.",
    ".RWRWR.",
    ".RKKKR.",
    ".MMMMM.",
    "KRRRRRK",
    "KKKKKKK",
]
_BURNT = [  # cooked: a black shape in a red blaze
    "R.Y.Y.R",
    "RRRYRRR",
    "RKWKWKR",
    "RKKKKKR",
    "KRRRRRK",
    "KKKKKKK",
]
_ICED = [   # frozen: the whole bed is a block of ice
    "WWWWWWW",
    "WBKBKBW",
    "WBBKBBW",
    "WBBBBBW",
    "WLLLLLW",
    "KKKKKKK",
]


def _sleeper_pixels(state: str) -> list[list[int]]:
    """Bed and sleeper in three readable states (cold, settled, too hot), and the two ways to die."""
    art = {"cold": _COLD, "warm": _WARM, "hot": _HOT, "burnt": _BURNT, "iced": _ICED}[state]
    return _art(art)


def _gauge_pixels(warmth: int, low: int, high: int, awake: bool) -> list[list[int]]:
    """A thermometer on the wall: a black trough that the bar fills from the bottom, and beside it a green
    band that marks where the bar should end (red while the sleeper is sat up and has to cool first).

    The bar is two columns wide and two rows to a step, in the colour of the sleeper's state: blue cold,
    orange settled, red too hot.
    """
    g = _grid(3, ROOM_H, CLEAR)
    colour = RED if (awake or warmth > high) else (BLUE if warmth < low else ORANGE)
    for r in range(ROOM_H):
        g[r][0] = g[r][1] = BLACK
    for step in range(1, TMAX + 1):
        rows = [ROOM_H - 2 * step, ROOM_H - 2 * step + 1] if step < TMAX else [0]
        rows = [r for r in rows if 0 <= r < ROOM_H]
        for r in rows:
            if step <= warmth:
                g[r][0] = g[r][1] = colour
            if low <= step <= high:
                g[r][2] = RED if awake else GREEN
    return g


def _worry_pixels(stress: int, limit: int, mood: int) -> list[list[int]]:
    """The worry bar over a bed: an empty black trough when calm. It fills from the left, blue while the
    sleeper is cold and red while too hot, and when it is full they die."""
    g = _grid(7, 2, BLACK)
    if stress <= 0:
        return g
    slots = min(7, max(1, -(-7 * stress // limit)))
    colour = RED if mood == 2 else BLUE
    for i in range(slots):
        g[0][i] = g[1][i] = colour
    return g


def _gust_pixels() -> list[list[int]]:
    """A cold gust: hard white flakes slanting down through the top of the room."""
    g = _grid(ROOM_W, ROOM_H, CLEAR)
    for row, xs in ((0, (0, 4, 8)), (1, (2, 6)), (2, (1, 5, 9)), (3, (0, 3, 7))):
        for x in xs:
            g[row][x] = WHITE
            if x + 1 < ROOM_W:
                g[row][x + 1] = BLUE
    return g


def _puff_pixels() -> list[list[int]]:
    """Warm air gathering under the room's ceiling, so the bed below it stays easy to read."""
    g = _grid(ROOM_W, ROOM_H, CLEAR)
    for row, xs in ((0, (1, 5)), (2, (3, 7)), (3, (0, 5))):
        for x in xs:
            g[row][x] = ORANGE
            if x + 1 < ROOM_W:
                g[row][x + 1] = YELLOW
    return g


def _skylight_pixels(frost: int, period: int) -> list[list[int]]:
    """A broken pane in the roof. Frost creeps across it; when it is full, the gust drops."""
    g = _grid(8, 4, CLEAR)
    for x in range(8):
        g[0][x] = BLACK
        g[3][x] = BLACK
    for x in range(8):
        g[1][x] = g[2][x] = BLUE
    filled = int(round(8 * frost / max(1, period - 1))) if period > 1 else 8
    for x in range(min(filled, 8)):
        g[1][x] = WHITE
        g[2][x] = WHITE
    return g


def _seg_height(hold: int) -> int:
    return 5 if hold <= 4 else (3 if hold <= 7 else 2)


def _progress_pixels(held: int, hold: int) -> list[list[int]]:
    """The night's column: one box for every turn the house must sleep; boxes light from the bottom."""
    seg = _seg_height(hold)
    h = hold * (seg + 1) - 1
    g = _grid(3, h, CLEAR)
    for i in range(hold):                                # box 0 is the lowest
        top = h - (i + 1) * (seg + 1) + 1
        lit = i < held
        for y in range(top, top + seg):
            for x in range(3):
                edge = y in (top, top + seg - 1) or x in (0, 2)
                g[y][x] = (YELLOW if not edge else ORANGE) if lit else (BLACK if edge else DARK)
    return g


def _sky_pixels(cells: int, dawn: int) -> list[list[int]]:
    """Night sky with a little snow; at dawn a warm band grows along the bottom of it."""
    width = cells * CELL
    g = _grid(width, 6, BLUE)
    for x in range(0, width, 7):
        g[(x // 7) % 5][x % width] = WHITE
        g[((x // 7) * 2 + 3) % 5][(x + 3) % width] = WHITE
    for row in range(dawn):
        colour = (MAROON, ORANGE, YELLOW)[min(row, 2)]
        for x in range(width):
            g[5 - row][x] = colour
    return g


# ── level construction ────────────────────────────────────────────────────────


def _build(index: int, spec: dict) -> Level:
    cells = spec["cellar"]
    sprites: list[Sprite] = []
    ox = origin(cells)
    sprites.append(_sprite(_sky_pixels(cells, 0), "sky", ox, 0, 0, ["sky"]))
    sprites.append(_sprite(_ground_pixels(), "ground", 0, CEIL + 1, 1, ["house"]))
    sprites.append(_sprite(_house_pixels(spec, "back"), "rooms", ox, 0, 1, ["house"]))
    sprites.append(_sprite(_house_pixels(spec, "front"), "house", ox, 0, 3, ["house"]))
    hold = spec["hold"]
    pix = _progress_pixels(0, hold)
    sprites.append(_sprite(pix, "progress", max(0, ox - 4), 62 - len(pix) + 1 - 1, 5, ["progress"]))
    for i, (cell, height, sleepers, pile, gust) in enumerate(spec["flues"]):
        sprites.append(_sprite(_stove_pixels(pile, pile > 0), f"stove{i}", cell_x(cell, cells) + 6, 56, 4, ["stove"]))
        if gust:
            sprites.append(_sprite(_skylight_pixels(0, gust[0]), f"skylight{i}",
                                   cell_x(cell, cells) + 2, max(0, room_y(height) - 5), 6, ["skylight"]))
    k = 0
    for i, (cell, height, sleepers, _pile, _gust) in enumerate(spec["flues"]):
        for floor, low, high, start in sleepers:
            x, y = cell_x(cell, cells) + 1, room_y(floor)
            state = "hot" if start > high else ("cold" if start < low else "warm")
            sprites.append(_sprite(_sleeper_pixels(state), f"sleeper{k}", x + 3, y + 3, 5, ["sleeper"]))
            sprites.append(_sprite(_gauge_pixels(start, low, high, start > high), f"gauge{k}", x, y, 5, ["gauge"]))
            if spec.get("limit"):
                sprites.append(_sprite(_worry_pixels(0, spec["limit"], 0), f"worry{k}", x + 3, y + 1, 5, ["worry"]))
            sprites.append(_sprite(_grid(ROOM_W, ROOM_H, CLEAR), f"mark{k}", x, y, 7, ["mark"]))
            k += 1
    sprites.append(_sprite(_keeper_pixels(0), "keeper", cell_x(spec["keeper"], cells), 57, 6, ["keeper"]))
    if spec.get("goal"):
        sprites += _goal_sprites(spec)
    return Level(sprites=sprites, name=f"level-{index + 1}", data={"spec": spec})


def _goal_sprites(spec: dict) -> list[Sprite]:
    """Level one's goal, drawn (19-Oct; the Boss could not tell what the game is about): beside the cold house, the
    same house already won. Its stove is lit, warm air sits in every room, the sleeper is settled and smiling, the bar
    stands inside the green band and its night column is full. It is a picture only: it is not in the flues, so the
    rules never see it, and it sits past the end of the cellar where the stoker cannot walk."""
    cell, height, sleepers, _p, _g = spec["flues"][0]
    x = cell_x(spec["cellar"], spec["cellar"]) + 2          # two pixels past the cellar's right end
    gspec = {"cellar": 1, "flues": [(0, height, [], 0, None)]}
    out = [_sprite(_house_pixels(gspec, "back"), "goal-rooms", x, 0, 1, ["goal"]),
           _sprite(_house_pixels(gspec, "front"), "goal-house", x, 0, 3, ["goal"])]
    for floor in range(1, height + 1):
        out.append(_sprite(_puff_pixels(), f"goal-air{floor}", x + 1, room_y(floor), 2, ["goal"]))
    floor, low, high, _start = sleepers[0]
    y = room_y(floor)
    out.append(_sprite(_sleeper_pixels("warm"), "goal-sleeper", x + 4, y + 3, 5, ["goal"]))
    out.append(_sprite(_gauge_pixels(high, low, high, False), "goal-gauge", x + 1, y, 5, ["goal"]))
    out.append(_sprite(_stove_pixels(2, True), "goal-stove", x + 6, 56, 4, ["goal"]))
    pix = _progress_pixels(spec["hold"], spec["hold"])
    out.append(_sprite(pix, "goal-night", x + CELL, 62 - len(pix), 5, ["goal"]))
    return out


class Br10(ARCBaseGame):
    def __init__(self) -> None:
        super().__init__(
            game_id="br10",
            levels=[_build(i, spec) for i, spec in enumerate(LEVELS)],
            camera=Camera(background=BLUE, letter_box=BLACK),
            available_actions=[1, 2, 3, 4, 5],
        )

    # ── rule state (plain numbers and lists: no sprites, so a solver can copy it cheaply) ──

    def on_set_level(self, level: Level) -> None:
        # Runs on start, level change and RESET: rule state is rebuilt from the clean spec.
        spec = level.get_data("spec")
        self.spec = spec
        self.flues = spec["flues"]
        self.hold = spec["hold"]
        self.kx = spec["keeper"]
        self.pile = [pile for _c, _h, _s, pile, _d in self.flues]
        self.warm = [[False] * (h + 2) for _c, h, _s, _p, _d in self.flues]   # warm air at each index
        self.cold = [[False] * (h + 2) for _c, h, _s, _p, _d in self.flues]   # gust at each index
        self.sleepers = []            # (flue, floor, low, high)
        self.temp: list[int] = []
        self.awake: list[bool] = []
        for i, (_cell, _h, sleepers, _p, _d) in enumerate(self.flues):
            for floor, low, high, start in sleepers:
                self.sleepers.append((i, floor, low, high))
                self.temp.append(start)
                self.awake.append(start > high)
        self.limit = spec.get("limit")                # worry a sleeper can take before they die
        self.safe = bool(spec.get("safe"))
        self.stress = [0] * len(self.sleepers)
        self.mood = [0] * len(self.sleepers)          # 0 settled, 1 cold, 2 hot: which way the worry is climbing
        self.dead = None                              # (kind, sleeper) once somebody has died
        self.turn = 0
        self.held = 0
        self.serial = 0
        self.cleared = False
        self.frames: list[str] = []
        self.moves: list[tuple] = []
        self.gone: list[tuple] = []
        self.spawns: list[tuple] = []
        self.air: dict = {}            # (kind, flue, index) -> sprite
        self.step_pose = 0
        self.bob = False
        self.nudge = None
        self.keeper = level.get_sprites_by_name("keeper")[0]
        self.stoves = [level.get_sprites_by_name(f"stove{i}")[0] for i in range(len(self.flues))]
        self.skylights = {i: level.get_sprites_by_name(f"skylight{i}")[0]
                          for i, (_c, _h, _s, _p, gust) in enumerate(self.flues) if gust}
        self.gauges = [level.get_sprites_by_name(f"gauge{k}")[0] for k in range(len(self.sleepers))]
        self.figures = [level.get_sprites_by_name(f"sleeper{k}")[0] for k in range(len(self.sleepers))]
        self.worries = [level.get_sprites_by_name(f"worry{k}")[0] if self.limit else None
                        for k in range(len(self.sleepers))]
        self.marks = [level.get_sprites_by_name(f"mark{k}")[0] for k in range(len(self.sleepers))]
        self.progress = level.get_sprites_by_name("progress")[0]
        self.sky = level.get_sprites_by_name("sky")[0]

    def _stove_at(self, cell: int):
        for i, (c, _h, _s, _p, _d) in enumerate(self.flues):
            if c == cell:
                return i
        return None

    # ── one turn of the house: the rules, with no pictures ────────────────────

    def can_act(self, action: int) -> bool:
        """Would this action be taken (true) or refused with a nudge (false)?"""
        if action in (3, 4):
            return 0 <= self.kx + (-1 if action == 3 else 1) < self.spec["cellar"]
        if action == 1:
            return self._stove_at(self.kx) is not None
        if action == 5:
            stove = self._stove_at(self.kx)
            return stove is not None and self.pile[stove] > 0
        return action == 2

    def rule_turn(self, action: int) -> None:
        """Work out the whole turn once. Presentation only replays self.moves, gone and spawns."""
        self.moves, self.gone, self.spawns = [], [], []
        if action in (3, 4):
            self.kx += -1 if action == 3 else 1
        elif action == 1:
            stove = self._stove_at(self.kx)
            self.pile[stove] = min(PILE_MAX, self.pile[stove] + LOAD)
        elif action == 5:
            self.pile[self._stove_at(self.kx)] = 0
        self.turn += 1
        for i, (_cell, height, _s, _p, gust) in enumerate(self.flues):
            warm, cold = self.warm[i], self.cold[i]
            if warm[height + 1]:                       # the puff leaving the roof is gone
                self.gone.append(("w", i, height + 1))
            new_warm = [False] + warm[:-1]             # warm air rises a floor
            for index in range(1, height + 2):
                if new_warm[index]:
                    self.moves.append(("w", i, index - 1, index))
            new_cold = [False] * (height + 2)          # gusts sink a floor, then mix away below the floors they reach
            for index in range(1, height + 2):
                if not cold[index]:
                    continue
                if index - 1 >= max(1, height + 1 - FALL):
                    new_cold[index - 1] = True
                    self.moves.append(("c", i, index, index - 1))
                else:
                    self.gone.append(("c", i, index))
            if self.pile[i] > 0:                       # a lump burns and sends up a puff
                self.pile[i] -= 1
                new_warm[0] = True
                self.spawns.append(("w", i, 0))
            if gust and (self.turn - gust[1]) % gust[0] == 0:
                new_cold[height + 1] = True
                self.spawns.append(("c", i, height + 1))
            self.warm[i], self.cold[i] = new_warm, new_cold
        for k, (flue, floor, low, high) in enumerate(self.sleepers):
            warm = self.warm[flue][floor]
            cold = self.cold[flue][floor]
            if warm and cold:
                change = -1          # the gust eats the warm air: an ordinary step of cooling
            elif warm:
                change = 1
            elif cold:
                change = -2          # a gust chills two steps
            else:
                change = -1
            t = max(0, min(TMAX, self.temp[k] + change))
            self.temp[k] = t
            if t > high:
                self.awake[k] = True     # too hot: the blanket comes off and they sit up
            elif t < low:
                self.awake[k] = False    # the room has cooled right down: they settle again
            if self.limit:
                if self.awake[k] or t > high:
                    self.stress[k] += HOT_W              # sat up, too hot: the worry climbs twice as fast
                    self.mood[k] = 2
                elif t < low:
                    self.stress[k] += 1                  # shivering
                    self.mood[k] = 1
                else:
                    self.stress[k] = max(0, self.stress[k] - 1)
                    self.mood[k] = 0
                if self.safe:
                    self.stress[k] = min(self.stress[k], self.limit * 3 // 5)   # the practice night cannot be lost
                if self.stress[k] >= self.limit and self.dead is None:
                    self.dead = ("heat" if self.mood[k] == 2 else "frost", k)
        if self.dead is not None:
            self.held = 0
            self.cleared = False
            return
        settled = all(low <= self.temp[k] <= high and not self.awake[k]
                      for k, (_f, _p, low, high) in enumerate(self.sleepers))
        self.held = self.held + 1 if settled else 0
        self.cleared = self.held >= self.hold

    def snapshot(self):
        return (self.kx, tuple(self.pile), tuple(map(tuple, self.warm)), tuple(map(tuple, self.cold)),
                tuple(self.temp), tuple(self.awake), self.held, self.turn, tuple(self.stress), tuple(self.mood), self.dead)

    def restore(self, snap) -> None:
        kx, pile, warm, cold, temp, awake, held, turn, stress, mood, dead = snap
        self.stress, self.mood, self.dead = list(stress), list(mood), dead
        self.kx, self.pile = kx, list(pile)
        self.warm, self.cold = [list(w) for w in warm], [list(c) for c in cold]
        self.temp, self.awake, self.held, self.turn = list(temp), list(awake), held, turn
        self.cleared = False

    def state_key(self):
        """What the future depends on (the turn only through the gust beat)."""
        beat = 1
        for _c, _h, _s, _p, gust in self.flues:
            if gust:
                beat = beat * gust[0] // _gcd(beat, gust[0])
        return (self.kx, tuple(self.pile), tuple(map(tuple, self.warm)), tuple(map(tuple, self.cold)),
                tuple(self.temp), tuple(self.awake), self.held, self.turn % beat, tuple(self.stress))

    # ── presentation ──────────────────────────────────────────────────────────

    def _keeper_x(self) -> int:
        return cell_x(self.kx, self.spec["cellar"])

    def _air_xy(self, cell: int, index: int) -> tuple[int, int]:
        return cell_x(cell, self.spec["cellar"]) + 1, room_y(index)

    def step(self) -> None:
        if self.action.id == GameAction.RESET:   # the engine calls step() once for RESET too
            self.complete_action()
            return
        if not self.frames:
            self._decide()
            self.frame_no = 0
        kind = self.frames.pop(0)
        self.frame_no += 1
        self._present(kind)
        if not self.frames:
            self.moves, self.gone, self.spawns = [], [], []
            self.nudge = None
            if self.cleared:
                self.next_level()
            self.complete_action()

    def _decide(self) -> None:
        action = self.action.id.value if hasattr(self.action.id, "value") else int(self.action.id)
        self.bob = False
        if action not in (1, 2, 3, 4, 5) or not self.can_act(action):
            self._refuse(0, -1 if action in (1, 5) else 0)
            if action in (3, 4):
                self.nudge = (-1 if action == 3 else 1, 0)
            return
        if action in (3, 4):
            self.step_pose ^= 1
        else:
            self.bob = True
        before = self.kx
        self.rule_turn(action)
        flues = self.flues
        # sprites for the air this turn made; the ones already in the house slide
        self.doomed = [self.air.pop(key) for key in self.gone if key in self.air]
        moving = []
        lifted = [(kind, i, frm, to, self.air.pop((kind, i, frm))) for kind, i, frm, to in self.moves]
        for kind, i, frm, to, sprite in lifted:
            self.air[(kind, i, to)] = sprite
            x, y0 = self._air_xy(flues[i][0], frm)
            _x, y1 = self._air_xy(flues[i][0], to)
            moving.append((sprite, x, y0, x, y1))
        for kind, i, index in self.spawns:
            self.serial += 1
            x, y = self._air_xy(flues[i][0], index)
            pixels = _puff_pixels() if kind == "w" else _gust_pixels()
            sprite = _sprite(pixels, f"{'puff' if kind == 'w' else 'gust'}{self.serial}", x, y, 2,
                             ["warm" if kind == "w" else "cold"])
            self.current_level.add_sprite(sprite)
            self.air[(kind, i, index)] = sprite
        if action in (3, 4):
            moving.append((self.keeper, cell_x(before, self.spec["cellar"]), self.keeper.y, self._keeper_x(), self.keeper.y))
        self.moves_px = moving
        self.frames = ["move"] * (MOVE_FRAMES - 1) + ["settle"]
        if self.cleared:
            self.frames += ["dawn"] * 3
        if self.dead is not None:
            self.frames += ["die"] * DEATH_FRAMES + ["restart"]

    def _refuse(self, dx: int, dy: int) -> None:
        """A refused move: the stoker leans that way and settles back. Nothing in the rules moves."""
        self.cleared = False
        self.moves_px = []
        self.doomed = []
        self.nudge = (dx, dy)
        self.frames = ["nudge", "settle"]

    def _present_death(self) -> None:
        """The sleeper who died is shown in a picture of how, and the room flashes its colour."""
        kind, k = self.dead
        n = self.frame_no - MOVE_FRAMES                      # 1 .. DEATH_FRAMES
        self.figures[k].pixels = _array(_sleeper_pixels("burnt" if kind == "heat" else "iced"))
        colour = RED if kind == "heat" else WHITE
        pix = _grid(ROOM_W, ROOM_H, CLEAR)
        if n % 2 == 1 or n >= DEATH_FRAMES - 1:
            for i in range(ROOM_W):
                pix[0][i] = pix[ROOM_H - 1][i] = colour
            for j in range(ROOM_H):
                pix[j][0] = pix[j][ROOM_W - 1] = colour
        self.marks[k].pixels = _array(pix)

    def _present(self, kind: str) -> None:
        if kind == "nudge":
            dx, dy = self.nudge
            self.keeper.set_position(self.keeper.x + dx, self.keeper.y + dy)
            return
        if kind == "die":
            self._present_death()
            return
        if kind == "restart":
            self.level_reset()                        # the night starts over exactly as it was entered
            self._action_count = max(1, self._action_count)
            return
        if kind == "dawn":
            self.sky.pixels = _array(_sky_pixels(self.spec["cellar"], self.frame_no - MOVE_FRAMES))
            return
        step = self.frame_no if kind == "move" else MOVE_FRAMES
        for sprite, x0, y0, x1, y1 in self.moves_px:  # every object moves whole, along its own path
            sprite.set_position(x0 + (x1 - x0) * step // MOVE_FRAMES, y0 + (y1 - y0) * step // MOVE_FRAMES)
        if self.bob and kind == "move":               # shovelling or resting: the stoker shifts his weight
            self.keeper.set_position(self.keeper.x, 58)
        if kind != "settle":
            return
        if self.nudge is not None:
            self.keeper.set_position(self._keeper_x(), 57)
            return
        for sprite in self.doomed:                     # air that has left the house
            self.current_level.remove_sprite(sprite)
        self.doomed = []
        self.keeper.set_position(self._keeper_x(), 57)
        self.keeper.pixels = _array(_keeper_pixels(self.step_pose if not self.bob else 0))
        for i, sprite in enumerate(self.stoves):
            sprite.pixels = _array(_stove_pixels(self.pile[i], self.pile[i] > 0))
        for k, (_flue, _floor, low, high) in enumerate(self.sleepers):
            t = self.temp[k]
            state = "hot" if self.awake[k] else ("cold" if t < low else "warm")
            self.figures[k].pixels = _array(_sleeper_pixels(state))
            self.gauges[k].pixels = _array(_gauge_pixels(t, low, high, self.awake[k]))
            if self.limit:
                self.worries[k].pixels = _array(_worry_pixels(self.stress[k], self.limit, self.mood[k]))
        for i, sprite in self.skylights.items():
            period, phase = self.flues[i][4]
            until = (phase - self.turn - 1) % period + 1     # turns until the next gust drops
            sprite.pixels = _array(_skylight_pixels(period - until, period))
        self.progress.pixels = _array(_progress_pixels(self.held, self.hold))


def _gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a
