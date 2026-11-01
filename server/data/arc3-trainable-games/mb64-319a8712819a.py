"""Deep Drift (mb64 v2): a cave of look-alike jellies, and exactly one of them hears you.

Author: Claude Opus 5, 19-September-2026 (glow-up author, game-evolution loop step 3)
Grown from the seed "Bell Bubbles" (mb64 v1) by the same loop: the causal idea is kept, the
cave, the pieces, the light and the levels are new.

Every jelly in the cave drifts one cell per turn on the same current. The arrows reach exactly
one of them, and only while it is in lit water: press, and your jelly leans, glows and slides
one cell, then the whole swarm pulses up together. Steer it into the anemone's mouth, which
only takes a jelly rising into it from below.

One turn, decided once by rule_turn() and then only presented:
  1. Call. If your jelly stands in lit water it slides one cell, unless rock, another jelly or
     the anemone blocks it (then it bumps and stays). In dark water the call is not heard and a
     ripple runs out to the edge of the light instead. Space skips the call; Down is a hold (it
     dips and the drift lifts it back), which is the only way to wait without losing height.
  2. Drift. Every jelly rises one cell, blocked by rock, by the anemone and by jellies that did
     not move. A jelly that leaves the top of the cave dissolves and buds again from its polyp.
  3. Docking. Your jelly entering the mouth closes the anemone: the level is won.
Light: coral beds and a crawling lantern slug glow through the water and stop at rock, so the
lit water is a room, a pool, or a patch that walks. Nothing can be lost; a miss comes round.
"""

from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, Level, Sprite

CELL = 6  # screen pixels per cave cell

# arcengine palette indices, used as a fixed six-colour set plus two accents
VOID = 5  # black: the deep outside the cave, and unlit water
DARK = 5
GLOW = 9  # blue: water a light reaches, where your jelly hears you
SILT = 4  # charcoal: drifting specks in dark water
SPARK = 0  # white: glints in lit water, and the lantern's core
ROCK = 4  # charcoal rock body
ROCK_CRUST = 3  # dark grey: the lit crust on a rock's top edge
ROCK_DEEP = 5  # black: cracks and the shadowed underside
BODY = 1  # light grey: a jelly's bell
TENT = 2  # grey: a jelly's tentacles
HEARD = 6  # magenta: the answer of the jelly that hears you
HOME = 6  # magenta: the anemone
HOME_DEEP = 3  # dark grey: the anemone's banding and stalk
CORAL = 1  # light grey: coral branches
SLUG = 1  # light grey: the lantern slug's body

UP, DOWN, LEFT, RIGHT, WAIT = 1, 2, 3, 4, 5
NUDGE = {UP: (0, -1), DOWN: (0, 1), LEFT: (-1, 0), RIGHT: (1, 0)}
RISE = (0, -1)

# Cave maps. '.' water, '#' rock, 'A' the anemone's body, 'O' its mouth.
# jellies: (column, row) starts, row == height means "budding in its polyp"; steer: which one hears.
# glow: (x, y, reach) coral beds; lantern: a slug pacing a lane of cells, its glow reaching `reach`.
LEVELS = [
    {  # 1 teach: three look-alikes, one answer, one anemone that only takes a jelly from below.
        "rows": [
            "....#..",
            "....A..",
            "....O..",
            ".......",
            ".......",
            ".......",
        ],
        "jellies": [(2, 5), (0, 2), (1, 4)], "steer": 0, "lit_all": True,
    },
    {  # 2 introduce the school: look-alikes block the way, and Down holds without spending height.
        "rows": [
            "......O...",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
        ],
        "jellies": [
            (0, 6),
            (1, 7), (1, 8), (1, 0),
            (3, 3), (3, 4), (3, 5), (3, 6), (3, 7),
            (5, 1), (5, 2), (5, 3), (5, 4), (5, 5),
            (8, 2), (8, 6), (9, 4),
        ], "steer": 0, "lit_all": True,
    },
    {  # 3 combine: a school three strings deep, whose gaps only line up for a moment.
        "rows": [
            "...O......",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
        ],
        "jellies": [
            (9, 6), (0, 2), (0, 6), (1, 4),
            (4, 8), (4, 0), (4, 1), (4, 2),
            (5, 5), (5, 6), (5, 7), (5, 8),
            (6, 1), (6, 2), (6, 3), (6, 4),
        ], "steer": 0, "lit_all": True,
    },
    {  # 4 introduce the overhang: rock stops the drift, so sliding under it costs no height.
        "rows": [
            "......O...",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            "..########",
            "..........",
        ],
        "jellies": [(9, 7), (0, 3), (0, 7), (1, 8), (1, 0), (1, 1), (1, 2), (1, 3)],
        "steer": 0, "lit_all": True,
    },
    {  # 5 combine: the overhang picks your moment, the school picks your line.
        "rows": [
            ".........A",
            ".........O",
            "..........",
            "..........",
            "..........",
            "..........",
            "####......",
            "..........",
        ],
        "jellies": [
            (0, 7),
            (4, 5), (4, 6), (4, 7), (4, 8), (4, 0),
            (6, 0), (6, 1), (6, 2), (6, 3), (6, 4),
            (8, 3), (8, 4), (8, 5), (8, 6), (8, 7),
        ], "steer": 0, "lit_all": True,
    },
    {  # 6 turn: the water goes dark. Only coral-lit water hears you, and one light walks.
        "rows": [
            ".......O..",
            "..........",
            "....###...",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
        ],
        "glow": [(1, 8, 4), (4, 8, 4), (7, 8, 4)],
        "lantern": {"lane": [(4, 2), (5, 2), (6, 2)], "reach": 2, "start": 1},
        "jellies": [
            (0, 7),
            (1, 3), (1, 4), (1, 5), (1, 6),
            (2, 6), (2, 7), (2, 8), (2, 0), (2, 1),
            (3, 8), (3, 0), (3, 1), (3, 2), (3, 3),
            (9, 2), (9, 6), (8, 4),
        ], "steer": 0,
    },
    {  # 7 compose: cross the school, wait under the shelf, then ride the slug's glow left.
        "rows": [
            "..O.......",
            "..........",
            "..####....",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
        ],
        "glow": [(8, 8, 4), (5, 8, 4), (2, 8, 4), (1, 1, 1)],
        "lantern": {"lane": [(2, 2), (3, 2), (4, 2), (5, 2)], "reach": 2, "start": 0},
        "jellies": [
            (9, 7),
            (8, 3), (8, 4), (8, 5), (8, 6),
            (7, 6), (7, 7), (7, 8), (7, 0),
        ], "steer": 0,
    },
    {  # 8 compose: two pools with dark between them, a shelf to wait under, no walking light.
        "rows": [
            "........O.",
            "..........",
            "..........",
            "....###...",
            "..........",
            "..........",
            "..........",
            "..........",
        ],
        "glow": [(1, 8, 4), (4, 8, 4), (7, 8, 3), (5, 4, 2), (7, 1, 1)],
        "jellies": [
            (0, 7),
            (1, 7), (1, 8), (1, 0), (1, 1), (1, 2),
            (2, 1), (2, 2), (2, 3), (2, 4), (2, 5),
            (3, 4), (3, 5), (3, 6), (3, 7),
        ], "steer": 0,
    },
    {  # 9 finale: the whole cave at once, and the last turn only the slug's glow can light.
        "rows": [
            ".......O..",
            "..........",
            "....####..",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
        ],
        "glow": [(1, 8, 4), (4, 8, 4), (7, 8, 4), (8, 1, 1)],
        "lantern": {"lane": [(4, 2), (5, 2), (6, 2), (7, 2)], "reach": 2, "start": 1},
        "jellies": [
            (0, 7),
            (1, 0), (1, 1), (1, 2), (1, 3), (1, 4),
            (2, 4), (2, 5), (2, 6), (2, 7),
            (3, 4), (3, 5), (3, 6), (3, 7), (3, 8),
        ], "steer": 0,
    },
]


# ── Rules: pure functions of the cave and the jelly positions ────────────────────────────────


def _around(cell: tuple) -> list:
    x, y = cell
    return [(x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)]


def make_board(spec: dict) -> dict:
    """Parse one cave map into the rule data the game, the solver and the checker all use."""
    rows = spec["rows"]
    h, w = len(rows), len(rows[0])
    water, rock, body = set(), set(), set()
    mouth = None
    for y, row in enumerate(rows):
        if len(row) != w:
            raise ValueError(f"row {y} has width {len(row)}, expected {w}")
        for x, ch in enumerate(row):
            if ch == ".":
                water.add((x, y))
            elif ch == "#":
                rock.add((x, y))
            elif ch == "A":
                body.add((x, y))
            elif ch == "O":
                if mouth is not None:
                    raise ValueError("one anemone per cave")
                mouth = (x, y)
            else:
                raise ValueError(f"unknown map character {ch!r}")
    if mouth is None or (mouth[0], mouth[1] + 1) not in water:
        raise ValueError("the mouth needs water right below it")
    if mouth[1] > 0 and (mouth[0], mouth[1] - 1) not in body | rock:
        raise ValueError("the anemone's body sits right above its mouth")

    def spread(source: tuple, reach: int) -> set:
        """Glow swims through water and stops at rock: cells within `reach` steps of a source."""
        edge = [c for c in _around(source) if c in water]
        seen: set = set()
        for step in range(reach):
            nxt = []
            for cell in edge:
                if cell in seen:
                    continue
                seen.add(cell)
                if step + 1 < reach:
                    nxt += [c for c in _around(cell) if c in water and c not in seen]
            edge = nxt
        return seen

    lit = set(water) if spec.get("lit_all") else set()
    for gx, gy, reach in spec.get("glow", []):
        lit |= spread((gx, gy), reach)
    lantern = None
    if "lantern" in spec:
        lane = [tuple(c) for c in spec["lantern"]["lane"]]
        if len(lane) < 2:
            raise ValueError("a lantern slug needs a lane of two or more cells")
        reach = int(spec["lantern"]["reach"])
        lantern = {
            "lane": lane,
            "glows": [frozenset(spread(cell, reach)) for cell in lane],
            "period": 2 * (len(lane) - 1),
            "start": int(spec["lantern"].get("start", 0)),
            "reach": reach,
        }
    # Name jellies left to right, top to bottom, so no sprite name says which one is yours.
    order = sorted(range(len(spec["jellies"])), key=lambda i: tuple(spec["jellies"][i]))
    start = tuple(tuple(spec["jellies"][i]) for i in order)
    steer = order.index(spec["steer"])
    vents = [x for x, _ in start]
    if len(set(start)) != len(start):
        raise ValueError("two jellies start in one cell")
    if vents.count(vents[steer]) != 1:
        raise ValueError("your jelly's polyp must be its own")
    for i, (x, y) in enumerate(start):
        if (x, h - 1) not in water:
            raise ValueError(f"polyp {x} opens into rock")
        if y != h and (x, y) not in water:
            raise ValueError(f"jelly {i} starts inside something")
    return {
        "w": w, "h": h, "water": water, "rock": rock, "body": body, "mouth": mouth,
        "lit": frozenset(lit), "lantern": lantern, "vents": vents, "steer": steer, "start": start,
        "period": lantern["period"] if lantern else 1,
    }


def lantern_at(board: dict, turn: int) -> int:
    """Where the slug stands on turn `turn`: it paces to the end of its lane and back."""
    lan = board["lantern"]
    k = (lan["start"] + turn) % lan["period"]
    return k if k < len(lan["lane"]) else lan["period"] - k


def lit_now(board: dict, turn: int) -> frozenset:
    if board["lantern"] is None:
        return board["lit"]
    return board["lit"] | board["lantern"]["glows"][lantern_at(board, turn)]


def heard(board: dict, cell: tuple, turn: int) -> bool:
    """Your jelly hears the arrows in lit water only, and never while it buds in its polyp."""
    return cell[1] < board["h"] and cell in lit_now(board, turn)


def enterable(board: dict, cell: tuple, mine: bool, step: tuple) -> bool:
    if cell == board["mouth"]:
        return mine and step == RISE  # the anemone takes your jelly, and only from below
    return cell in board["water"]


def rule_turn(board: dict, pos: tuple, turn: int, act: int) -> tuple:
    """One whole turn: the call, then the drift. Returns (new positions, report)."""
    steer, h = board["steer"], board["h"]
    cur = list(pos)
    call, dock = None, 0
    if act in NUDGE:
        sx, sy = cur[steer]
        if not heard(board, (sx, sy), turn):
            call = "unheard"
        else:
            dx, dy = NUDGE[act]
            target = (sx + dx, sy + dy)
            if sy == 0 and dy == -1:
                call, cur[steer] = "leave", None  # pushed out of the top of the cave
            elif enterable(board, target, True, (dx, dy)) and target not in cur:
                call, cur[steer] = "slide", target
                dock = 1 if target == board["mouth"] else 0
            else:
                call = "bump"
    mid = tuple(cur)
    moves, gone = {}, []
    if not dock:
        want = {}
        for i, cell in enumerate(cur):
            if cell is None:
                continue
            x, y = cell
            target = (x, y - 1)
            if target[1] < 0:
                want[i] = None
            elif enterable(board, target, i == steer, RISE):
                want[i] = target
        movers = set(want)
        while True:  # a jelly may follow one that moves, but not one that stays
            staying = {cur[i] for i in range(len(cur)) if cur[i] is not None and i not in movers}
            claimed, drop = set(), set()
            for i in sorted(movers, key=lambda i: (cur[i][1], cur[i][0])):
                target = want[i]
                if target is None:
                    continue
                if target in staying or target in claimed:
                    drop.add(i)
                else:
                    claimed.add(target)
            if not drop:
                break
            movers -= drop
        for i in sorted(movers):
            if want[i] is None:
                gone.append(i)
                cur[i] = None
            else:
                moves[i] = (cur[i], want[i])
                cur[i] = want[i]
                if i == steer and want[i] == board["mouth"]:
                    dock = 2
    budded = [i for i in range(len(cur)) if cur[i] is None]
    for i in budded:
        cur[i] = (board["vents"][i], h)
    return tuple(cur), {"call": call, "mid": mid, "moves": moves, "gone": gone, "budded": budded, "dock": dock}


# ── Sprite art ───────────────────────────────────────────────────────────────────────────────


def _speck(x: int, y: int, salt: int) -> int:
    """A cheap deterministic hash, for silt and rock grain that never changes between runs."""
    v = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 0xFFFF


def _cells_to_pixels(cells: set, colour, w: int, h: int) -> list:
    px = [[-1] * (w * CELL) for _ in range(h * CELL)]
    for (x, y) in cells:
        for dy in range(CELL):
            for dx in range(CELL):
                value = colour(x, y, dx, dy)
                if value >= 0:
                    px[y * CELL + dy][x * CELL + dx] = value
    return px


# A jelly: a filled bell with a bright crown pixel and two trailing tentacles. The poses are the
# same body in four moments, so it bends and trails while staying one sprite of one size.
_POSE_ART = {
    "rest": [
        ".BBB.",
        "BiiiB",
        "BSiiB",
        "rrrrr",
        ".t.t.",
        "t...t",
    ],
    "squash": [
        ".....",
        ".BBB.",
        "BSiiB",
        "rrrrr",
        ".ttt.",
        ".t.t.",
    ],
    "stretch": [
        ".BBB.",
        "BiiiB",
        "BSiiB",
        ".rrr.",
        ".t.t.",
        "t.t.t",
    ],
    "lean-r": [
        "..BBB",
        ".BiiB",
        ".BSiB",
        ".rrrr",
        "tt.t.",
        "t....",
    ],
    "lean-l": [
        "BBB..",
        "BiiB.",
        "BiSB.",
        "rrrr.",
        ".t.tt",
        "....t",
    ],
    "lean-u": [
        ".BBB.",
        "BiiiB",
        "BSiiB",
        "rrrrr",
        ".ttt.",
        "..t..",
    ],
    "lean-d": [
        ".....",
        ".BBB.",
        "BiiiB",
        "BSiiB",
        "rrrrr",
        "t.t.t",
    ],
    "bud": [
        ".....",
        ".....",
        ".....",
        "..B..",
        ".BiB.",
        ".t.t.",
    ],
    "half": [
        ".....",
        ".....",
        "..B..",
        ".BiB.",
        "BSiiB",
        ".t.t.",
    ],
}


def _pose(name: str, glowing: bool) -> list:
    """One jelly, four moments. 'i' is the bell's inside, which is what lights up when it hears."""
    art = _POSE_ART[name]
    out = []
    for row in art:
        line = []
        for ch in row:
            if ch == "B":
                line.append(BODY)
            elif ch == "i":
                line.append(HEARD if glowing else BODY)
            elif ch == "S":
                line.append(HEARD if glowing else SPARK)
            elif ch == "r":
                line.append(HEARD if glowing else TENT)
            elif ch == "t":
                line.append(TENT)
            else:
                line.append(-1)
        out.append(line)
    return out


POSES = {(name, glow): _pose(name, glow) for name in _POSE_ART for glow in (False, True)}

_CORAL_ART = [
    "c...c",
    ".c.c.",
    "c.c.c",
    ".ccc.",
    "..c..",
    "..c..",
]

_SLUG_ART = [
    "..ss..",
    ".sSSs.",
    "ssSSss",
    ".s..s.",
]


def _anemone_art(shut: bool) -> list:
    """The anemone: a stalked bell of tentacles with a mouth that fits one jelly, closing on it."""
    open_art = [
        "...dd...",
        "..AAAA..",
        ".AAAAAA.",
        "AAdAAdAA",
        "AAAAAAAA",
        ".AAAAAA.",
        "A.AAAA.A",
        "A......A",
        ".A....A.",
        "A......A",
        ".A....A.",
        "A......A",
    ]
    shut_art = [
        "...dd...",
        "..AAAA..",
        ".AAAAAA.",
        "AAdAAdAA",
        "AAAAAAAA",
        ".AAAAAA.",
        "A.AAAA.A",
        ".A....A.",
        ".AA..AA.",
        "..AAAA..",
        "...AA...",
        "........",
    ]
    art = shut_art if shut else open_art
    return [[HOME if ch == "A" else HOME_DEEP if ch == "d" else -1 for ch in row] for row in art]


def _sprite(pixels, name, x, y, layer, tags, visible=True) -> Sprite:
    return Sprite(pixels, name=name, x=x, y=y, layer=layer, blocking=BlockingMode.NOT_BLOCKED,
                  visible=visible, collidable=False, tags=list(tags))


def _rock_pixels(board: dict) -> list:
    """Rock with a lit crust on top, a dark underside, grain, and corners knocked off."""
    w, h = board["w"], board["h"]
    solid = board["rock"] | board["body"]

    def colour(x, y, dx, dy):
        up = (x, y - 1) in solid or y == 0 and False
        down = (x, y + 1) in solid
        left = (x - 1, y) in solid
        right = (x + 1, y) in solid
        if dy == 0 and not up:
            if (dx == 0 and not left) or (dx == CELL - 1 and not right):
                return -1  # rounded corner
            return ROCK_CRUST
        if dy == CELL - 1 and not down:
            if (dx == 0 and not left) or (dx == CELL - 1 and not right):
                return -1
            return ROCK_DEEP
        if dx == 0 and not left and dy > CELL - 3:
            return ROCK_DEEP
        grain = _speck(x * CELL + dx, y * CELL + dy, 11) % 9
        return ROCK_CRUST if grain == 0 else ROCK_DEEP if grain == 1 else ROCK
    return _cells_to_pixels(board["rock"], colour, w, h)


def _water_pixels(board: dict) -> list:
    """Dark water: black, with a slow fall of silt."""
    w, h = board["w"], board["h"]

    def colour(x, y, dx, dy):
        return SILT if _speck(x * CELL + dx, y * CELL + dy, 5) % 29 == 0 else DARK
    return _cells_to_pixels(board["water"], colour, w, h)


def _glow_pixels(cells, board: dict) -> list:
    """Lit water: blue under a ripple of caustics, fading into the dark with a dithered rim."""
    w, h = board["w"], board["h"]
    lit = set(cells)
    dark_water = board["water"] - lit

    def colour(x, y, dx, dy):
        fade = ((dy == 0 and (x, y - 1) in dark_water) or (dy == CELL - 1 and (x, y + 1) in dark_water)
                or (dx == 0 and (x - 1, y) in dark_water) or (dx == CELL - 1 and (x + 1, y) in dark_water))
        if fade and (dx + dy) % 2:
            return -1
        px, py = x * CELL + dx, y * CELL + dy
        if (px * 3 + py * 2) % 17 == 0:
            return SILT  # a caustic ripple, the light broken up by the water
        return GLOW
    return _cells_to_pixels(lit, colour, w, h)


def _ripple_pixels(cells, board: dict) -> list:
    """The answer to a call nobody heard: the rim of every lit patch flares for a moment."""
    w, h = board["w"], board["h"]
    lit = set(cells)

    def colour(x, y, dx, dy):
        out = [(x, y - 1) not in lit, (x, y + 1) not in lit, (x - 1, y) not in lit, (x + 1, y) not in lit]
        if not any(out):
            return -1
        on_edge = ((dy == 0 and out[0]) or (dy == CELL - 1 and out[1])
                   or (dx == 0 and out[2]) or (dx == CELL - 1 and out[3]))
        return SPARK if on_edge and (dx + dy) % 2 == 0 else -1
    return _cells_to_pixels(lit, colour, w, h)


def build_level(spec: dict, index: int) -> Level:
    board = make_board(spec)
    w, h = board["w"], board["h"]
    ox = (64 - w * CELL) // 2
    oy = (64 - (h + 1) * CELL) // 2 + 1
    sprites = [
        _sprite(_water_pixels(board), "water", ox, oy, 0, ["water"]),
        _sprite(_rock_pixels(board), "rock", ox, oy, 2, ["rock"]),
    ]
    floor = [[ROCK if dy > 1 else ROCK_CRUST for _ in range(w * CELL)] for dy in range(CELL)]
    for dx in range(w * CELL):
        for dy in range(CELL):
            if _speck(dx, dy, 17) % 7 == 0:
                floor[dy][dx] = ROCK_DEEP
    sprites.append(_sprite(floor, "floor", ox, oy + h * CELL, 2, ["floor"]))
    sprites.append(_sprite(_glow_pixels(board["lit"], board), "glow", ox, oy, 1, ["glow"]))
    sprites.append(_sprite(_ripple_pixels(board["lit"], board), "ripple", ox, oy, 5, ["ripple"], visible=False))
    if board["lantern"] is not None:
        for k, cells in enumerate(board["lantern"]["glows"]):
            sprites.append(_sprite(_glow_pixels(cells, board), f"lantern-glow-{k}", ox, oy, 1, ["glow"], visible=False))
            sprites.append(_sprite(_ripple_pixels(cells, board), f"lantern-ripple-{k}", ox, oy, 5, ["ripple"], visible=False))
        lane = board["lantern"]["lane"]
        sx, sy = lane[lantern_at(board, 0)]
        slug = [[SLUG if ch == "s" else SPARK if ch == "S" else -1 for ch in row] for row in _SLUG_ART]
        sprites.append(_sprite(slug, "slug", ox + sx * CELL, oy + sy * CELL + 2, 4, ["lantern"]))
    for k, (gx, gy, _r) in enumerate(spec.get("glow", [])):
        art = [[CORAL if ch == "c" else -1 for ch in row] for row in _CORAL_ART]
        px = ox + gx * CELL
        py = oy + gy * CELL + (1 if gy < h else 0)
        sprites.append(_sprite(art, f"coral-{k + 1}", px, min(py, oy + (h + 1) * CELL - len(art)), 3, ["coral"]))
    mx, my = board["mouth"]
    for name, shut in (("anemone", False), ("anemone-shut", True)):
        sprites.append(_sprite(_anemone_art(shut), name, ox + mx * CELL - 1, oy + (my - 1) * CELL, 3, ["anemone"], visible=not shut))
    cup = [
        [CORAL, -1, -1, -1, -1, CORAL],
        [CORAL, ROCK_DEEP, ROCK_DEEP, ROCK_DEEP, ROCK_DEEP, CORAL],
        [-1, CORAL, ROCK_DEEP, ROCK_DEEP, CORAL, -1],
        [-1, -1, CORAL, CORAL, -1, -1],
    ]
    for k, vx in enumerate(sorted(set(board["vents"]))):
        sprites.append(_sprite([row[:] for row in cup], f"polyp-{k + 1}", ox + vx * CELL, oy + h * CELL, 3, ["polyp"]))
    for i, (x, y) in enumerate(board["start"]):
        pose = POSES[("bud" if y == h else "rest", False)]
        sprites.append(_sprite([row[:] for row in pose], f"jelly-{i + 1}", ox + x * CELL, oy + y * CELL, 6, ["jelly"]))
    return Level(sprites=sprites, name=f"level-{index + 1}", data={"board": board, "origin": (ox, oy)})


# ── The game ─────────────────────────────────────────────────────────────────────────────────


class Mb64(ARCBaseGame):
    def __init__(self) -> None:
        self.board: dict = {}
        self.origin = (0, 0)
        self.pos: tuple = ()
        self.turn = 0
        self.marked = False  # your jelly keeps its glow while it stays in the light
        self.frames: list = []
        self.dock_pending = False
        levels = [build_level(spec, i) for i, spec in enumerate(LEVELS)]
        super().__init__(game_id="mb64", levels=levels, camera=Camera(background=VOID, letter_box=VOID),
                         available_actions=[1, 2, 3, 4, 5])

    # Start, level change and RESET all rebuild the rule state from the clean level.
    def on_set_level(self, level: Level) -> None:
        self.board = level.get_data("board")
        self.origin = level.get_data("origin")
        self.pos = self.board["start"]
        self.turn = 0
        self.marked = False
        self.frames = []
        self.dock_pending = False

    def step(self) -> None:
        if self.action.id == GameAction.RESET:  # the engine calls step() once for RESET too
            self.complete_action()
            return
        if not self.frames:
            self.plan(self.action.id.value)
        self.show(self.frames.pop(0))
        if not self.frames:
            if self.dock_pending:
                self.dock_pending = False
                self.next_level()
            self.complete_action()

    def spot(self, cell: tuple) -> tuple:
        return self.origin[0] + cell[0] * CELL, self.origin[1] + cell[1] * CELL

    def frame(self, cells, poses, glow=None, ripple=False, shut=False, lantern=None, slug_at=None):
        return {"cells": cells, "poses": poses, "glow": glow, "ripple": ripple, "shut": shut,
                "lantern": lantern, "slug": slug_at}

    def plan(self, act: int) -> None:
        """Decide the whole turn once, then queue frames that only present it."""
        board = self.board
        steer = board["steer"]
        turn = self.turn
        if act not in NUDGE and act != WAIT:
            self.frames = [self.frame([self.spot(c) for c in self.pos], self.rest_poses(), lantern=lantern_index(board, turn))]
            return
        before = self.pos
        after, rep = rule_turn(board, before, turn, act)
        self.pos = after
        self.turn = turn + 1
        lan_now = lantern_index(board, turn)
        lan_next = lantern_index(board, turn + 1)
        slug_now = self.slug_spot(turn)
        slug_next = self.slug_spot(turn + 1)
        base = [self.spot(c) for c in before]
        rest = self.rest_poses(before)
        frames = []
        glowing = self.marked
        if rep["call"] in ("slide", "leave"):
            glowing = True
            dx, dy = NUDGE[act]
            lean = {(0, -1): "lean-u", (0, 1): "lean-d", (-1, 0): "lean-l", (1, 0): "lean-r"}[(dx, dy)]
            for k in (1, 2):
                cells = list(base)
                cells[steer] = (base[steer][0] + 3 * k * dx, base[steer][1] + 3 * k * dy)
                poses = list(rest)
                poses[steer] = (lean, True)
                frames.append(self.frame(cells, poses, lantern=lan_now, slug_at=slug_now))
        elif rep["call"] == "bump":  # heard, but something is in the way: a nudge and a settle
            glowing = True
            dx, dy = NUDGE[act]
            cells = list(base)
            cells[steer] = (base[steer][0] + dx, base[steer][1] + dy)
            poses = list(rest)
            poses[steer] = ("squash", True)
            frames.append(self.frame(cells, poses, lantern=lan_now, slug_at=slug_now))
            poses2 = list(rest)
            poses2[steer] = ("rest", True)
            frames.append(self.frame(list(base), poses2, lantern=lan_now, slug_at=slug_now))
        elif rep["call"] == "unheard":  # the call runs out to the rim of the light and stops
            glowing = False
            for _ in range(2):
                frames.append(self.frame(list(base), list(rest), ripple=True, lantern=lan_now, slug_at=slug_now))
        if rep["dock"] != 1:
            mid = rep["mid"]
            for k in (1, 2, 3):
                cells, poses = [], []
                for i, cell in enumerate(mid):
                    if cell is None:  # pushed out of the top: away, then budding in its polyp
                        cells.append(self.spot(after[i]) if k == 3 else None)
                        poses.append(("bud", False))
                    elif i in rep["gone"]:
                        x, y = self.spot(cell)
                        cells.append(self.spot(after[i]) if k == 3 else (x, y - 2 * k))
                        poses.append(("bud", False) if k == 3 else ("stretch", i == steer and glowing))
                    elif i in rep["moves"]:
                        x, y = self.spot(cell)
                        cells.append((x, y - 2 * k))
                        budding = mid[i][1] == self.board["h"]
                        shape = ("bud", "half", "rest")[k - 1] if budding else ("squash", "stretch", "rest")[k - 1]
                        poses.append((shape, i == steer and glowing))
                    else:
                        cells.append(self.spot(cell))
                        poses.append(("bud" if cell[1] == self.board["h"] else "rest", i == steer and glowing))
                slug = self.slug_spot(turn, k) if board["lantern"] else None
                frames.append(self.frame(cells, poses, lantern=lan_now if k < 3 else lan_next, slug_at=slug))
        if rep["dock"]:
            final = [self.spot(c) for c in after]
            poses = [("rest", False)] * len(after)
            poses[steer] = ("rest", True)
            frames.append(self.frame(final, list(poses), shut=False, lantern=lan_next, slug_at=slug_next))
            frames.append(self.frame(final, list(poses), shut=True, lantern=lan_next, slug_at=slug_next))
            frames.append(self.frame(final, list(poses), shut=True, lantern=lan_next, slug_at=slug_next))
            self.dock_pending = True
        else:
            self.marked = glowing and heard(board, after[steer], self.turn)
        self.frames = frames

    def rest_poses(self, cells=None):
        cells = cells if cells is not None else self.pos
        steer = self.board["steer"]
        return [("bud" if c[1] == self.board["h"] else "rest", i == steer and self.marked) for i, c in enumerate(cells)]

    def slug_spot(self, turn: int, part: int = 0) -> tuple:
        """Where the slug's sprite sits: it slides between lane cells over the drift's frames."""
        board = self.board
        if board["lantern"] is None:
            return None
        lane = board["lantern"]["lane"]
        here = lane[lantern_at(board, turn)]
        there = lane[lantern_at(board, turn + 1)]
        ax, ay = self.spot(here)
        bx, by = self.spot(there)
        return (ax + (bx - ax) * part // 3, ay + (by - ay) * part // 3 + 2)

    def show(self, frame: dict) -> None:
        level = self.current_level
        for i, spot in enumerate(frame["cells"]):
            jelly = level.get_sprites_by_name(f"jelly-{i + 1}")[0]
            jelly.set_visible(spot is not None)
            if spot is not None:
                jelly.set_position(*spot)
                name, glowing = frame["poses"][i]
                jelly.pixels = _numpy_pose(name, glowing)
        for sprite in level.get_sprites_by_tag("ripple"):
            sprite.set_visible(False)
        if self.board["lantern"] is not None:
            index = frame["lantern"]
            for k in range(len(self.board["lantern"]["lane"])):
                level.get_sprites_by_name(f"lantern-glow-{k}")[0].set_visible(k == index)
                level.get_sprites_by_name(f"lantern-ripple-{k}")[0].set_visible(frame["ripple"] and k == index)
            if frame["slug"] is not None:
                level.get_sprites_by_name("slug")[0].set_position(*frame["slug"])
        if frame["ripple"]:
            level.get_sprites_by_name("ripple")[0].set_visible(True)
        level.get_sprites_by_name("anemone")[0].set_visible(not frame["shut"])
        level.get_sprites_by_name("anemone-shut")[0].set_visible(frame["shut"])


def lantern_index(board: dict, turn: int):
    return lantern_at(board, turn) if board["lantern"] is not None else None


def _numpy_pose(name: str, glowing: bool):
    import numpy as np

    return np.array(POSES[(name, glowing)], dtype=np.int8)
