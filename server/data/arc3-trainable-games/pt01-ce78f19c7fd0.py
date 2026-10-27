"""pt01 (game source).

Author: Claude Sonnet 5.5, for the Boss (Mark Barney), 13-October-2026.
Purpose: grow the three-level ship game to eight levels. Turn based, whole numbers only. Enemy fire is a
fixed script per level (the same on every retry) and every volley is drawn one action before it lands.
Rules live in `advance`, one pure function used by the game and by the level solver; the rest is picture.
"""

import math
from math import gcd

import numpy as np
from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, InteractionMode, Level, RenderableUserDisplay, Sprite

# ── geometry ──────────────────────────────────────────────────────────────────
CELL = 7                 # screen pixels per sea cell
GW, GH = 9, 8            # sea is 9 columns by 8 rows: 63 by 56 pixels
HUD_Y = GH * CELL        # the black strip below the sea starts here

N, E, S, W = 0, 1, 2, 3  # headings, clockwise
DX = (0, 1, 0, -1)
DY = (-1, 0, 1, 0)
DIR_OF_ACTION = {1: N, 2: S, 3: W, 4: E}
FACING_CHAR = {"N": N, "E": E, "S": S, "W": W}

HEARTS = 3

# ── ship kinds: which guns each carries (relative to its heading: 0 bow, 1 starboard, 3 port) ──
KIND_GUNS = {
    "m": (),             # merchant: no guns
    "c": (0,),           # corvette: bow gun
    "f": (1, 3),         # frigate: broadside, both flanks
    "g": (0, 1, 3),      # galleon: bow and both flanks
}


# ── colours (the site's palette indices) ─────────────────────────────────────
WHITE, BLACK, MAGENTA, PINK, RED, BLUE, SKY, YELLOW, ORANGE, MAROON, GREEN, PURPLE = 0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
SEA, CREST = BLUE, SKY
SAND, PALM = YELLOW, GREEN
HULL = {"m": ORANGE, "c": MAROON, "f": PURPLE, "g": MAGENTA}

# ── ship pictures: seen from above, bow at the top, stern at the bottom ───────
# h hull   w sail yard   k black   S stern board (lamps sit on it)   G gun (muzzle or barrel)   M your muzzle
SHIP_ART = {
    "m": ("..hhh..",
          ".hhhhh.",
          ".hhhhh.",
          "wwwwwww",
          ".hhhhh.",
          ".hhhhh.",
          ".SSSSS."),
    "c": ("...G...",
          "..hhh..",
          "..hhh..",
          ".wwwww.",
          "..hhh..",
          "..hhh..",
          "..SSS.."),
    "f": ("...h...",
          "..hhh..",
          "GhhhhhG",
          ".wwwww.",
          "GhhhhhG",
          ".hhhhh.",
          ".SSSSS."),
    "g": ("...G...",
          "..hhh..",
          "GhhhhhG",
          "wwwwwww",
          "hhhhhhh",
          "GhhhhhG",
          ".SSSSS."),
}
PLAYER_ART = ("...M...",
              "..kkk..",
              ".kkkkk.",
              "wwwwwww",
              ".kkkkk.",
              ".kkkkk.",
              "..kkk..")
LAMP_SLOTS = {1: (3,), 2: (2, 4), 3: (1, 3, 5)}   # where the stern lamps sit on the stern board
MUZZLE_COLOUR = (BLACK, ORANGE, RED)               # at rest, charging, about to fire


def _paint(rows, table):
    a = np.full((CELL, CELL), -1, dtype=np.int8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                a[y, x] = table[ch]
    return a


def _sink_mask(a, stage):
    """Pixels fall away as a ship goes down: stage 0 whole, stage 4 gone."""
    if stage <= 0:
        return a
    out = a.copy()
    for y in range(CELL):
        for x in range(CELL):
            if out[y, x] >= 0 and (x * 3 + y * 5 + x * y) % 5 < stage:
                out[y, x] = -1
    if stage >= 4:
        out[:, :] = -1
    return out


def ship_pixels(kind, heading, hp, maxhp, charge=0, flash=False, sink=0, turning=False):
    table = {"h": HULL[kind], "w": WHITE, "k": BLACK, "S": BLACK, "G": MUZZLE_COLOUR[charge]}
    a = _paint(SHIP_ART[kind], table)
    if turning:                       # about to turn a quarter: the bow tip shows white
        a[0, CELL // 2] = WHITE
    for i, sx in enumerate(LAMP_SLOTS[maxhp]):
        a[CELL - 1, sx] = YELLOW if i < hp else BLACK
    if flash:
        a[(a >= 0) & (a != YELLOW)] = WHITE
    a = np.rot90(a, -heading).copy()
    return _sink_mask(a, sink)


def player_pixels(heading, flash=False, sink=0, muzzle=WHITE):
    a = _paint(PLAYER_ART, {"k": BLACK, "w": WHITE, "M": muzzle})
    if flash:
        a[(a >= 0) & (a != WHITE)] = RED
    a = np.rot90(a, -heading).copy()
    return _sink_mask(a, sink)


# ── levels ────────────────────────────────────────────────────────────────────
# rows: '.' sea, '#' land, 'P' where you start, a..h an enemy ship (listed in `ships`).
# ships: letter -> (kind, heading, hit points, script). Script letters, one per action:
#   '.' rest   'F' fire the guns   'R' turn a quarter clockwise   'L' turn a quarter anticlockwise
LEVEL_DEFS = [
    dict(  # 1  a merchant docked in a cove
        rows=(".........",
              "....###..",
              ".....a##.",
              "....###..",
              ".........",
              ".........",
              ".P.......",
              "#........"),
        face="N", hearts=False,
        ships={"a": ("m", "E", 1, ".")},
    ),
    dict(  # 2  three merchantmen, two of them back to back
        rows=("....P....",
              ".........",
              "#........",
              "...a.....",
              "....b....",
              ".......##",
              "....c...#",
              "........."),
        face="S",
        ships={"a": ("m", "N", 3, "."), "b": ("m", "N", 3, "."), "c": ("m", "S", 3, ".")},
    ),
    dict(  # 3  four merchantmen among the islands
        rows=("........P",
              "..###....",
              "..##.....",
              "....#c...",
              "....#....",
              ".........",
              "....a..d.",
              "b........"),
        face="W",
        ships={"a": ("m", "S", 2, "."), "b": ("m", "W", 1, "."), "c": ("m", "W", 3, "."), "d": ("m", "N", 2, ".")},
    ),
    dict(  # 4  the strait: a corvette covers the only way through
        rows=("....#....",
              "....#.b..",
              "....#....",
              "..a.#....",
              ".P..#....",
              "....#....",
              "......c..",
              "....#...."),
        face="N",
        ships={"a": ("m", "N", 2, "."), "b": ("m", "W", 3, "."), "c": ("c", "W", 2, "...F")},
    ),
    dict(  # 5  two corvettes on different beats guard the way round the islands
        rows=(".....a...",
              "..b...d..",
              "....###..",
              ".....#...",
              "...##..c.",
              "...#.....",
              "...##...P",
              "........."),
        face="E",
        ships={"a": ("c", "N", 2, "....F."), "b": ("c", "E", 2, "..F..."), "c": ("m", "E", 2, "."), "d": ("m", "W", 2, ".")},
    ),
    dict(  # 6  ships that turn: a corvette and a merchant swing round, a frigate fires from both flanks
        rows=("...#a....",
              "..P#.....",
              ".........",
              "......#..",
              ".#######.",
              "...d.....",
              ".b.......",
              "..c......"),
        face="S",
        ships={"a": ("c", "N", 2, "..FR"), "b": ("f", "E", 2, "..F."), "c": ("m", "E", 3, "..R."), "d": ("m", "W", 3, ".")},
    ),
    dict(  # 7  everything at once: a column of turning merchantmen, a frigate, a corvette
        rows=(".........",
              ".c...#...",
              ".e...#...",
              ".d...##..",
              ".P...#...",
              "...##..b.",
              "...#.....",
              "....a...."),
        face="E",
        ships={"a": ("c", "S", 2, "..F."), "b": ("f", "N", 2, "..F."), "c": ("m", "W", 2, "..R."),
               "d": ("m", "S", 3, "."), "e": ("m", "E", 3, "..R.")},
    ),
    dict(  # 8  the same sea with a galleon added beside the frigate: bow gun and both flanks, three lamps
        rows=(".........",
              ".c...#...",
              ".e...#...",
              ".d...##..",
              ".P...#.f.",
              "...##..b.",
              "...#.....",
              "....a...."),
        face="E",
        ships={"a": ("c", "S", 2, "..F."),
               "b": ("f", "N", 2, "..F."),
               "c": ("m", "W", 2, "..R."),
               "d": ("m", "S", 3, "."),
               "e": ("m", "E", 3, "..R."),
               "f": ("g", "E", 3, "..F.....")},
    ),
]


class Spec:
    """One level's fixed facts, parsed once."""

    def __init__(self, d):
        rows = d["rows"]
        assert len(rows) == GH and all(len(r) == GW for r in rows), "level rows must be 9 by 8"
        self.land = set()
        self.start = None
        pos = {}
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "#":
                    self.land.add((x, y))
                elif ch == "P":
                    self.start = (x, y)
                elif ch != ".":
                    pos[ch] = (x, y)
        assert self.start is not None, "no start"
        self.pface = FACING_CHAR[d["face"]]
        self.hud_hearts = d.get("hearts", True)
        order = sorted(pos)
        self.n = len(order)
        self.kind, self.cell, self.hp0, self.script, self.head0 = [], [], [], [], []
        for ch in order:
            kind, head, hp, script = d["ships"][ch]
            self.kind.append(kind)
            self.cell.append(pos[ch])
            self.hp0.append(hp)
            self.script.append(script)
            self.head0.append(FACING_CHAR[head])
        self.ship_at = {c: i for i, c in enumerate(self.cell)}
        self.guns = [KIND_GUNS[k] for k in self.kind]
        # the repeating timeline of every ship, over one common cycle
        cyc = 1
        for sc in self.script:
            net = (sc.count("R") - sc.count("L")) % 4
            orbit = 4 // gcd(4, net) if net else 1
            per = len(sc) * orbit
            cyc = cyc * per // gcd(cyc, per)
        self.cycle = cyc
        self.head, self.armed = [], []
        for i in range(self.n):
            sc = self.script[i]
            h = self.head0[i]
            heads, arms = [], []
            for t in range(cyc):
                tok = sc[t % len(sc)]
                heads.append(h)
                arms.append(tok == "F" and bool(self.guns[i]))
                if tok == "R":
                    h = (h + 1) % 4
                elif tok == "L":
                    h = (h - 1) % 4
            self.head.append(heads)
            self.armed.append(arms)
        self.sea = {(x, y) for x in range(GW) for y in range(GH)} - self.land

    def initial(self):
        return (self.start[0], self.start[1], self.pface, HEARTS, 0, tuple(self.hp0))


SPECS = [Spec(d) for d in LEVEL_DEFS]


# ── the rules: one pure function, used by the game and by the solver ──────────

def _lane(spec, i, d, px, py, hps):
    """Cells a volley from ship i travels along heading d, and whether it reaches you."""
    cx, cy = spec.cell[i]
    cells = []
    while True:
        cx += DX[d]
        cy += DY[d]
        if (cx, cy) not in spec.sea:
            return cells, False
        if cx == px and cy == py:
            cells.append((cx, cy))
            return cells, True
        j = spec.ship_at.get((cx, cy))
        if j is not None and hps[j] > 0:
            return cells, False
        cells.append((cx, cy))


def trace_shot(spec, px, py, pf, hps, phi):
    """Where a ball fired from (px, py) along heading pf ends: (cells travelled, result, ship hit or -1).
    result: 'hit' (the stern), 'bounce' (bow or flank), 'wall' (land or the edge)."""
    cx, cy = px, py
    cells = []
    while True:
        cx += DX[pf]
        cy += DY[pf]
        if (cx, cy) not in spec.sea:
            return cells, "wall", -1
        j = spec.ship_at.get((cx, cy))
        cells.append((cx, cy))
        if j is not None and hps[j] > 0:
            return cells, ("hit" if spec.head[j][phi] == pf else "bounce"), j


def advance(spec, st, a, ev=None):
    """Apply one action. Returns (new state, status): 0 afloat, 1 level won, 2 your ship sinks.
    If `ev` is a list it is filled with what happened, for the picture."""
    px, py, pf, hearts, phi, hp = st
    hps = list(hp)
    if a in DIR_OF_ACTION:
        d = DIR_OF_ACTION[a]
        nx, ny = px + DX[d], py + DY[d]
        occupied = False
        j = spec.ship_at.get((nx, ny))
        if j is not None and hps[j] > 0:
            occupied = True
        if (nx, ny) in spec.sea and not occupied:
            if ev is not None:
                ev.append(("move", px, py, nx, ny, d))
            px, py = nx, ny
        else:
            if ev is not None:
                ev.append(("bump", px, py, d))
        pf = d
    elif a == 5:
        cells, result, tgt = trace_shot(spec, px, py, pf, hps, phi)
        if result == "hit":
            hps[tgt] -= 1
        if ev is not None:
            ev.append(("shot", px, py, pf, cells, result, tgt))
            if result == "hit" and hps[tgt] == 0:
                ev.append(("sink", tgt))
        if result == "bounce":
            # the armoured bow or flank throws the ball straight back at you
            hearts -= 1
            if ev is not None:
                ev.append(("ricochet", px, py))
            if hearts <= 0:
                return (px, py, pf, hearts, phi, tuple(hps)), 2
        if not any(hps):
            return (px, py, pf, hearts, phi, tuple(hps)), 1
    dmg = 0
    for i in range(spec.n):
        if hps[i] <= 0:
            continue
        if spec.armed[i][phi]:
            h = spec.head[i][phi]
            for g in spec.guns[i]:
                d = (h + g) % 4
                cells, hit = _lane(spec, i, d, px, py, hps)
                if hit:
                    dmg += 1
                if ev is not None:
                    ev.append(("volley", i, d, cells, hit))
        if ev is not None:
            h0 = spec.head[i][phi]
            h1 = spec.head[i][(phi + 1) % spec.cycle]
            if h0 != h1:
                ev.append(("turn", i, h0, h1))
    hearts -= dmg
    nxt = (phi + 1) % spec.cycle
    st2 = (px, py, pf, hearts, nxt, tuple(hps))
    if hearts <= 0:
        return st2, 2
    return st2, 0


# ── what the player sees besides ships ────────────────────────────────────────

def seg_pixels(cx, cy, d, ncells):
    """Pixels along a cell's centre line, from just outside cell (cx, cy) through ncells cells beyond it."""
    mx, my = cx * CELL + CELL // 2, cy * CELL + CELL // 2
    return [(mx + DX[d] * k, my + DY[d] * k) for k in range(CELL // 2 + 1, CELL // 2 + CELL * ncells + 1)]


_LAND_CACHE = {}


def land_pixels(spec):
    """Sand with a black shore and a few palms: one picture for all the land of a level."""
    key = tuple(sorted(spec.land))
    if key not in _LAND_CACHE:
        _LAND_CACHE[key] = _land_pixels(spec)
    return _LAND_CACHE[key].copy()


def _land_pixels(spec):
    h, w = GH * CELL, GW * CELL
    mask = np.zeros((h, w), dtype=bool)
    for (cx, cy) in spec.land:
        mask[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = True

    def sea_at(y, x):
        return 0 <= y < h and 0 <= x < w and not mask[y, x]

    keep = mask.copy()
    for y in range(h):
        for x in range(w):
            if mask[y, x]:
                up, dn, lf, rt = sea_at(y - 1, x), sea_at(y + 1, x), sea_at(y, x - 1), sea_at(y, x + 1)
                if (up or dn) and (lf or rt):          # a convex corner: shave it one pixel
                    keep[y, x] = False
    out = np.full((h, w), -1, dtype=np.int8)
    for y in range(h):
        for x in range(w):
            if keep[y, x]:
                edge = any(0 <= y + dy < h and 0 <= x + dx < w and not keep[y + dy, x + dx]
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                out[y, x] = BLACK if edge else SAND
    for (cx, cy) in sorted(spec.land):
        k = (cx * 7 + cy * 13 + cx * cy) % 6
        nb = sum((cx + a, cy + b) in spec.land for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if k in (0, 3) or (k == 1 and nb >= 2):
            art = (".GG.", "GGGG", ".GG.") if k != 1 else ("GG", "GG")
            x0 = cx * CELL + (2 if k != 1 else 3)
            y0 = cy * CELL + (2 if k != 1 else 3)
            for dy, row in enumerate(art):
                for dx, ch in enumerate(row):
                    if ch == "G" and out[y0 + dy, x0 + dx] == SAND:
                        out[y0 + dy, x0 + dx] = PALM
    return out


_SEA_CACHE = []


def sea_pixels():
    if not _SEA_CACHE:
        _SEA_CACHE.append(_sea_pixels())
    return _SEA_CACHE[0].copy()


def _sea_pixels():
    """A few wave crests so the sea is not one dead field."""
    out = np.full((GH * CELL, GW * CELL), -1, dtype=np.int8)
    for cy in range(GH):
        for cx in range(GW):
            k = (cx * 5 + cy * 3 + cx * cy) % 7
            if k == 0:
                out[cy * CELL + 5, cx * CELL + 1:cx * CELL + 3] = CREST
            elif k == 3:
                out[cy * CELL + 1, cx * CELL + 4:cx * CELL + 6] = CREST
    return out


HEART = ((0, 1, 0, 1, 0),
         (1, 1, 1, 1, 1),
         (1, 1, 1, 1, 1),
         (0, 1, 1, 1, 0),
         (0, 0, 1, 0, 0))
FOE_ICON = ((0, 1, 0),
            (1, 1, 1),
            (1, 1, 1),
            (1, 1, 1),
            (0, 1, 0))


def disc(size, colour, core=None):
    """A small round burst; with `core` its middle is a second colour."""
    a = np.full((size, size), -1, dtype=np.int8)
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - c, y - c)
            if r <= size / 2:
                a[y, x] = colour
                if core is not None and r <= size / 4 + 0.2:
                    a[y, x] = core
    return a


def ring_pixels(r, colour=SKY):
    """An expanding ripple where a ship went down."""
    size = 2 * r + 1
    a = np.full((size, size), -1, dtype=np.int8)
    for y in range(size):
        for x in range(size):
            if abs(math.hypot(x - r, y - r) - r) < 0.6:
                a[y, x] = colour
    return a


def ball(colour):
    return np.full((2, 2), colour, dtype=np.int8)


class PtDisplay(RenderableUserDisplay):
    """The lines you read (aim, armed lanes) and the strip along the bottom."""

    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        fx = self.game.fx
        water = (SEA, CREST)
        for pix in fx["lanes"]:
            for i, (x, y) in enumerate(pix):
                if i % 3 != 2 and 0 <= x < 63 and 0 <= y < HUD_Y and int(frame[y, x]) in water:
                    frame[y, x] = RED
        if fx["aim"] is not None:
            pix, colour = fx["aim"]
            for i, (x, y) in enumerate(pix):
                if i % 2 == 0 and 0 <= x < 63 and 0 <= y < HUD_Y and int(frame[y, x]) in water:
                    frame[y, x] = colour
        frame[HUD_Y:, :] = BLACK
        frame[:, 63] = BLACK
        if fx["hearts"] is not None:
            for i in range(HEARTS):
                colour = RED if i < fx["hearts"] else MAROON
                for dy, row in enumerate(HEART):
                    for dx, v in enumerate(row):
                        if v:
                            frame[HUD_Y + 2 + dy, 2 + i * 7 + dx] = colour
        for k, kind in enumerate(fx["foes"]):
            x0 = 62 - (k + 1) * 4
            for dy, row in enumerate(FOE_ICON):
                for dx, v in enumerate(row):
                    if v:
                        frame[HUD_Y + 2 + dy, x0 + dx] = HULL[kind]
        return frame


# ── the game ──────────────────────────────────────────────────────────────────

FLY = 2          # frames a ball takes over a long line
SINK = 4         # frames an enemy ship takes to go down
DEATH_FRAMES = 15  # your own sinking is held for about half a second at the site's thirty frames a second


def _clone(sc):
    return {"p": list(sc["p"]), "s": [list(x) for x in sc["s"]], "b": list(sc["b"]), "x": list(sc["x"]),
            "aim": sc["aim"], "lanes": sc["lanes"], "hearts": sc["hearts"], "foes": sc["foes"], "mz": sc["mz"]}


class Pt01(ARCBaseGame):
    def __init__(self) -> None:
        self.display = PtDisplay(self)
        self.fx = {"lanes": [], "aim": None, "hearts": None, "foes": []}
        self.st = None
        self.frames = []
        self.fi = 0
        self.after = None
        self.s_player = None
        self.s_ships = []
        self.s_fx = []
        levels = [Level(sprites=[], name=f"pt01-{i + 1}", data={"index": i}) for i in range(len(SPECS))]
        super().__init__("pt01", levels, Camera(0, 0, 64, 64, SEA, BLACK, [self.display]), False, len(levels), [1, 2, 3, 4, 5])

    @property
    def spec(self):
        return SPECS[self.level_index]

    # ── entering a level: the one place that builds it, used for start, next level, RESET and a sinking ──

    def on_set_level(self, level: Level) -> None:
        self._enter(level)

    def _enter(self, level) -> None:
        spec = self.spec
        self.st = spec.initial()
        self.frames = []
        self.fi = 0
        self.after = None
        self.s_fx = []
        level.remove_all_sprites()
        level.add_sprite(Sprite(sea_pixels(), name="sea", x=0, y=0, layer=0, blocking=BlockingMode.NOT_BLOCKED))
        level.add_sprite(Sprite(land_pixels(spec), name="land", x=0, y=0, layer=1, blocking=BlockingMode.NOT_BLOCKED))
        self.s_ships = []
        for i in range(spec.n):
            sp = Sprite(ship_pixels(spec.kind[i], spec.head0[i], spec.hp0[i], spec.hp0[i]), name=f"ship{i}",
                        x=spec.cell[i][0] * CELL, y=spec.cell[i][1] * CELL, layer=3, blocking=BlockingMode.NOT_BLOCKED)
            level.add_sprite(sp)
            self.s_ships.append(sp)
        self.s_player = Sprite(player_pixels(spec.pface), name="player", x=spec.start[0] * CELL, y=spec.start[1] * CELL,
                               layer=4, blocking=BlockingMode.NOT_BLOCKED)
        level.add_sprite(self.s_player)
        self._show(self._settled(self.st))

    # ── pictures ──────────────────────────────────────────────────────────────

    def _settled(self, st, marks=True):
        spec = self.spec
        px, py, pf, hearts, phi, hps = st
        nxt = (phi + 1) % spec.cycle
        ships = []
        for i in range(spec.n):
            charge = 2 if spec.armed[i][phi] else (1 if spec.armed[i][nxt] else 0)
            sc_ = spec.script[i]
            turning = sc_[phi % len(sc_)] in "RL"
            ships.append([spec.head[i][phi], hps[i], charge, 0, 0, hps[i] > 0, turning])
        aim, lanes, mz = None, [], WHITE
        if marks:
            cells, result, tgt = trace_shot(spec, px, py, pf, hps, phi)
            n = len(cells) - (1 if result in ("hit", "bounce") else 0)
            mz = PINK if result == "bounce" else WHITE
            aim = (seg_pixels(px, py, pf, n), mz)
            for i in range(spec.n):
                if hps[i] > 0 and spec.armed[i][phi]:
                    h = spec.head[i][phi]
                    for g in spec.guns[i]:
                        d = (h + g) % 4
                        cl, hit = _lane(spec, i, d, px, py, hps)
                        lanes.append((i, seg_pixels(spec.cell[i][0], spec.cell[i][1], d, len(cl) - (1 if hit else 0))))
        return {"p": [px * CELL, py * CELL, pf, 0, 0], "s": ships, "b": [], "x": [], "aim": aim, "lanes": lanes,
                "hearts": hearts if spec.hud_hearts else None,
                "foes": [spec.kind[i] for i in range(spec.n) if hps[i] > 0], "mz": mz}

    def _show(self, sc):
        spec = self.spec
        p = sc["p"]
        self.s_player.set_position(p[0], p[1])
        self.s_player.pixels = player_pixels(p[2], flash=bool(p[3]), sink=p[4], muzzle=sc["mz"])
        for i, sp in enumerate(self.s_ships):
            h, hp, charge, flash, sink, visible, turning = sc["s"][i]
            if visible and sink < 4:
                sp.set_interaction(InteractionMode.TANGIBLE)
                sp.pixels = ship_pixels(spec.kind[i], h, hp, spec.hp0[i], charge, bool(flash), sink, turning)
            else:
                sp.set_interaction(InteractionMode.REMOVED)
        level = self.current_level
        for sp in self.s_fx:
            level.remove_sprite(sp)
        self.s_fx = []
        for k, (x, y, colour) in enumerate(sc["b"]):
            sp = Sprite(ball(colour), name=f"ball{k}", x=x, y=y, layer=6, blocking=BlockingMode.NOT_BLOCKED)
            level.add_sprite(sp)
            self.s_fx.append(sp)
        for k, (x, y, kind) in enumerate(sc["x"]):
            if kind.startswith("ring"):
                pix = ring_pixels(int(kind[4:]))
            else:
                pix = {"burst": disc(5, ORANGE, YELLOW), "ping": disc(3, WHITE), "puff": disc(3, SKY)}[kind]
            off = pix.shape[0] // 2
            sp = Sprite(pix, name=f"spark{k}", x=x - off, y=y - off, layer=7, blocking=BlockingMode.NOT_BLOCKED)
            level.add_sprite(sp)
            self.s_fx.append(sp)
        self.fx = {"lanes": [pix for (_, pix) in sc["lanes"]], "aim": sc["aim"], "hearts": sc["hearts"], "foes": sc["foes"]}

    # ── one action ────────────────────────────────────────────────────────────

    def step(self) -> None:
        if self.action.id == GameAction.RESET:      # the engine calls step() once for RESET too
            self.complete_action()
            return
        if self.action.id.value not in (1, 2, 3, 4, 5):
            self.complete_action()
            return
        if not self.frames:
            self._begin()
        sc = self.frames[self.fi]
        self.fi += 1
        if sc is None:                              # the death is over: the level starts again as it was entered
            self._enter(self.current_level)
        else:
            self._show(sc)
        if self.fi >= len(self.frames):
            after = self.after
            self.frames = []
            self.fi = 0
            self.after = None
            if after == "win":
                self.next_level()
            self.complete_action()

    def _begin(self) -> None:
        """Decide the whole outcome once, then lay out the pictures that show it."""
        spec = self.spec
        st0 = self.st
        ev = []
        st1, status = advance(spec, st0, self.action.id.value, ev)
        frames = self._film(st0, st1, status, ev)
        self.st = st1
        self.frames = frames
        self.fi = 0
        self.after = "win" if status == 1 else None

    def _film(self, st0, st1, status, ev):
        spec = self.spec
        cur = self._settled(st0, marks=True)
        cur["aim"] = None
        cur["mz"] = WHITE
        frames = []
        sinks = {}

        def push():
            frames.append(_clone(cur))

        def centre(cell):
            return cell[0] * CELL + CELL // 2, cell[1] * CELL + CELL // 2

        def fly(a, b, colour, n):
            for k in range(1, n + 1):
                x = a[0] + (b[0] - a[0]) * k // n
                y = a[1] + (b[1] - a[1]) * k // n
                cur["b"] = [(x - 1, y - 1, colour)]
                push()
            cur["b"] = []

        for e in ev:
            kind = e[0]
            if kind == "move":
                _, ox, oy, nx, ny, d = e
                cur["p"][2] = d
                for k in (1, 2):
                    cur["p"][0] = ox * CELL + (nx - ox) * (CELL * k // 3)
                    cur["p"][1] = oy * CELL + (ny - oy) * (CELL * k // 3)
                    push()
                cur["p"][0], cur["p"][1] = nx * CELL, ny * CELL       # the move is finished before anything fires
            elif kind == "bump":
                _, ox, oy, d = e
                cur["p"][2] = d
                cur["p"][0], cur["p"][1] = ox * CELL + DX[d], oy * CELL + DY[d]
                push()
                cur["p"][0], cur["p"][1] = ox * CELL, oy * CELL
            elif kind == "shot":
                _, ox, oy, d, cells, result, tgt = e
                a = centre((ox, oy))
                a = (a[0] + DX[d] * 3, a[1] + DY[d] * 3)
                if result in ("hit", "bounce"):
                    tc = centre(cells[-1])
                    b = (tc[0] - DX[d] * 3, tc[1] - DY[d] * 3)
                else:
                    last = cells[-1] if cells else (ox, oy)
                    lc = centre(last)
                    b = (lc[0] + DX[d] * 3, lc[1] + DY[d] * 3)
                n = 1 if (len(cells) <= 2 or status == 2) else FLY
                fly(a, b, WHITE, n)
                if result == "hit":
                    cur["x"] = [(b[0], b[1], "burst")]
                    cur["s"][tgt][3] = 1
                    cur["s"][tgt][1] = st1[5][tgt]
                    push()
                    cur["x"] = []
                    cur["s"][tgt][3] = 0
                    if st1[5][tgt] == 0:
                        sinks[tgt] = len(frames)
                        cur["lanes"] = [ln for ln in cur["lanes"] if ln[0] != tgt]
                elif result == "bounce":
                    cur["x"] = [(b[0], b[1], "ping")]
                    push()
                    cur["x"] = []
                    fly(b, a, RED, n)
                else:
                    cur["x"] = [(b[0], b[1], "puff")]
                    push()
                    cur["x"] = []
            elif kind == "ricochet":
                cur["x"] = [(cur["p"][0] + CELL // 2, cur["p"][1] + CELL // 2, "burst")]
                cur["p"][3] = 1
                if cur["hearts"] is not None:
                    cur["hearts"] = max(0, cur["hearts"] - 1)
                push()
                cur["x"] = []
                cur["p"][3] = 0
        volleys = [e for e in ev if e[0] == "volley"]
        if volleys and not (status == 1):
            cur["lanes"] = []
            starts, ends = [], []
            for (_, i, d, cells, hit) in volleys:
                sc_ = centre(spec.cell[i])
                a = (sc_[0] + DX[d] * 3, sc_[1] + DY[d] * 3)
                if hit:
                    pc = (cur["p"][0] + CELL // 2, cur["p"][1] + CELL // 2)
                    b = (pc[0] - DX[d] * 3, pc[1] - DY[d] * 3)
                elif cells:
                    lc = centre(cells[-1])
                    b = (lc[0] + DX[d] * 3, lc[1] + DY[d] * 3)
                else:
                    b = a
                starts.append(a)
                ends.append(b)
            nf = 1 if status == 2 else FLY
            for k in range(1, nf + 1):
                cur["b"] = [(a[0] + (b[0] - a[0]) * k // nf - 1, a[1] + (b[1] - a[1]) * k // nf - 1, RED)
                            for a, b in zip(starts, ends)]
                push()
            cur["b"] = []
            marks = []
            damaged = 0
            for (_, i, d, cells, hit), b in zip(volleys, ends):
                marks.append((b[0], b[1], "burst" if hit else "puff"))
                damaged += 1 if hit else 0
            cur["x"] = marks
            if damaged:
                cur["p"][3] = 1
                if cur["hearts"] is not None:
                    cur["hearts"] = max(0, cur["hearts"] - damaged)
            push()
            cur["x"] = []
            cur["p"][3] = 0
        if status == 2:
            d = DEATH_FRAMES
            cur["b"] = []
            cur["x"] = []
            for k in range(d):
                cur["p"][4] = 1 + (k * 4) // d
                cur["x"] = [(cur["p"][0] + CELL // 2, cur["p"][1] + CELL // 2, f"ring{2 + (k * 5) // d}")]
                push()
            frames.append(None)
        else:
            final = self._settled(st1, marks=(status == 0))
            frames.append(final)
        # ships that went down fade over the frames that follow their hit
        for tgt, start in sinks.items():
            while len(frames) < start + SINK:
                frames.insert(len(frames) - 1, _clone(frames[-2] if len(frames) > 1 else cur))
            for t in range(start, len(frames)):
                sc = frames[t]
                if sc is None:
                    continue
                sc["s"][tgt][4] = min(SINK, t - start + 1)
                if t < len(frames) - 1 and t - start + 1 < SINK + 1:
                    cx_, cy_ = centre(spec.cell[tgt])
                    sc["x"] = list(sc["x"]) + [(cx_, cy_, f"ring{1 + min(SINK, t - start + 1)}")]
        return frames
