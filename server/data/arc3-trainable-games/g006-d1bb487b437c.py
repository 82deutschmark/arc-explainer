# ARC-AGI-3 candidate task g006.
#
# Author: Claude Sonnet 5.5 (second rebuild of g006 for the Boss, 13-October-2026)
# PURPOSE: A toy room. Little dominoes with faces stand in lines; you walk, face a piece and
# press Space to tip the green starter. A fallen piece knocks over every standing piece next
# to it, one ring at a time, and the line is meant to reach the bells. Gaps in a line are
# pits you fill from your pocket; rolling carts bridge other gaps only while they sit in them.
# Every bell must ring. A chain that can no longer reach the bells ends the level with a
# short pink death and the level starts over.
#
# Everything the rules read is drawn: pieces have faces, pits are black holes, the pieces a
# tip would knock over are marked before you press, rails show where a cart rolls. No text.

import math

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

# ---- palette indices ---------------------------------------------------------------------
WHITE = 0
BLACK = 5      # the hard border, the player, pits
PINK = 7       # pink and red only ever mean "this sends you back"
RED = 8
FLOOR = 9      # blue play mat
TRIM = 10      # light blue
YELLOW = 11    # rung bells, rails, the "this will fall" corner marks
ORANGE = 12    # bells that are still waiting
WALL = 13      # maroon toy blocks
GREEN = 14     # the starter piece: the one you tip
PURPLE = 15    # carts

CELL = 5
GRID = 12
OFF = 2
HOLD = 13      # frames a death is held on screen (about half a second)

UP, DOWN, LEFT, RIGHT = 0, 1, 2, 3
DIRS = [(0, -1), (0, 1), (-1, 0), (1, 0)]


def _px(rows):
    return [[(-1 if c == "." else int(c, 16)) for c in row] for row in rows]


# ---- pictures (hex digit = palette index, '.' = see-through) ------------------------------
DOMINO = _px([".000.", "05050", "00000", "00500", ".000."])
DOMINO_TILT = _px([".....", "..00.", ".0500", "00050", ".000."])
DOMINO_DOWN = _px([".....", ".....", "00000", "05050", ".000."])
DOMINO_HOT = _px([".....", ".....", "77777", "75057", ".777."])      # fallen in a failure: pink
STARTER = _px([".EEE.", "E0E0E", "EEEEE", "E000E", ".EEE."])
STARTER_TILT = _px([".....", "..EE.", ".E0EE", "EEE0E", ".EEE."])
STARTER_DOWN = _px([".....", ".....", "EEEEE", "E0E0E", ".EEE."])
SLEEPER = _px(["8.8.8", "77777", "75057", "77777", ".777."])
SLEEPER_DOWN = _px([".....", ".....", "88888", "75057", ".777."])
CART = _px([".FFF.", "F0F0F", "FFFFF", "F555F", ".5.5."])
CART_DOWN = _px([".....", ".....", "FFFFF", "F0F0F", ".5.5."])
BELL_DULL = _px([
    "....CC....", "...CCCC...", "..CCCCCC..", "..C5CC5C..", "..CCCCCC..",
    "..CCCCCC..", ".CCCCCCCC.", "CCCCCCCCCC", "CCCCCCCCCC", "....55....",
])
BELL_RUNG = _px([
    "....BB....", "...BBBB...", "..BBBBBB..", "..B0BB0B..", "..B5BB5B..",
    "..B5BB5B..", ".B.5555.B.", "BBBBBBBBBB", "BBBBBBBBBB", "....55....",
])
PIT = _px(["05550", "55555", "55555", "55555", "05550"])
WALL_PX = _px(["DDDDD", "D5DDD", "DDDDD", "DDD5D", "55555"])
RAIL_H = _px(["....." , "55555", "AAAAA", "55555", "....."])
RAIL_V = _px([".5A5.", ".5A5.", ".5A5.", ".5A5.", ".5A5."])
RAIL_END = _px(["55555", "5AAA5", "5AAA5", "5AAA5", "55555"])
BURST = _px(["..B..", ".B0B.", "B000B", ".B0B.", "..B.."])
PUFF = _px([".0.", "000", ".0."])
PUFF1 = _px(["0"])


def avatar_px(face, wave=0):
    """The player: a black silhouette whose white eyes look the way he faces."""
    if face == UP:
        rows = [".555.", "55555", "55555", ".555.", ".5.5."]
    elif face == DOWN:
        rows = [".555.", "50505", "55555", ".555.", ".5.5."]
    elif face == LEFT:
        rows = [".555.", "05055", "55555", ".555.", ".5.5."]
    else:
        rows = [".555.", "55050", "55555", ".555.", ".5.5."]
    if wave:
        rows[4] = "5...5" if wave == 1 else ".5.5."
    return _px(rows)


# ---- levels ----------------------------------------------------------------------------------
# rows: '#' block, '.' floor, 'P' where you start, 'D' domino, 'S' green starter, 'X' pink sleeper,
# 'B' bell, 'o' pit.  rails: a straight rail from a to b with a cart on it.
# <<<GENERATED levels (assemble.py writes this block from levels.py; do not edit by hand)
LEVELS = [
    {
        "rows": [
            "............",
            "............",
            "............",
            "............",
            "..SDDDDBB...",
            ".......BB...",
            "............",
            "............",
            ".....P......",
            "............",
            "............",
            "............",
        ],
        "face": UP, "bag": 0, "rails": [],
    },
    {
        "rows": [
            "............",
            ".#########..",
            ".#SDoDDBB#..",
            ".#.#.##BB#..",
            ".#.#.#......",
            "............",
            "............",
            "............",
            "............",
            ".......P....",
            "............",
            "............",
        ],
        "face": UP, "bag": 1, "rails": [],
    },
    {
        "rows": [
            "............",
            "#.#.........",
            "#.#.........",
            "#.#.........",
            "#.#.........",
            "#.#.........",
            "#.#.........",
            "#.#.........",
            "#SDD.DDBB...",
            ".......BB...",
            "..........P.",
            "............",
        ],
        "face": UP, "bag": 0, "rails": [{'a': (4, 8), 'b': (4, 11), 'phase': 0}],
    },
    {
        "rows": [
            "............",
            "............",
            "....#S#.....",
            ".....D......",
            ".....D......",
            ".....D......",
            ".....D......",
            "BBDoDDD.DBB.",
            "BB..........",
            "............",
            "............",
            ".....P......",
        ],
        "face": UP, "bag": 1, "rails": [{'a': (7, 4), 'b': (7, 8), 'phase': 1}],
    },
    {
        "rows": [
            "............",
            "............",
            "............",
            "............",
            "......X.....",
            "##SDDoDDBB..",
            "..#.D...BB..",
            "....o...D...",
            "....DD.DD...",
            "............",
            "............",
            "..........P.",
        ],
        "face": UP, "bag": 1, "rails": [{'a': (6, 6), 'b': (6, 10), 'phase': 3}],
    },
    {
        "rows": [
            "............",
            "............",
            "............",
            "............",
            "............",
            "...#........",
            "#SDoD..DDBB.",
            ".#.......BB.",
            "............",
            "............",
            "............",
            "..........P.",
        ],
        "face": UP, "bag": 1, "rails": [{'a': (5, 3), 'b': (5, 7), 'phase': 2}, {'a': (6, 5), 'b': (6, 8), 'phase': 2}],
    },
    {
        "rows": [
            "............",
            "............",
            ".SDD.DDBB...",
            ".......BB...",
            "............",
            "##########.#",
            "..........P.",
            ".#####.#####",
            "............",
            "...BBD.oDDS.",
            "...BB.......",
            "............",
        ],
        "face": UP, "bag": 1, "rails": [{'a': (4, 0), 'b': (4, 3), 'phase': 0}, {'a': (6, 7), 'b': (6, 10), 'phase': 0, 'slow': 1}],
    },
    {
        "rows": [
            "............",
            "............",
            ".SDDD..DoDBB",
            "..........BB",
            ".###########",
            "...........P",
            "###########.",
            "............",
            ".###########",
            "....oDDD....",
            ".SDDDoDBB...",
            ".....X.BB...",
        ],
        "face": UP, "bag": 2, "rails": [{'a': (5, 0), 'b': (5, 2), 'phase': 0}, {'a': (6, 0), 'b': (6, 2), 'phase': 3, 'slow': 1}],
    },
]
# GENERATED>>>


# ---- the rules, as plain functions (the solver and the checks use these same ones) -------------
def _lcm(a, b):
    return a * b // math.gcd(a, b)


def bell_area(b):
    return [(b[0], b[1]), (b[0] + 1, b[1]), (b[0], b[1] + 1), (b[0] + 1, b[1] + 1)]


class Lvl:
    """Everything about a level that never changes."""

    def __init__(self, spec):
        self.spec = spec
        rows = spec["rows"]
        self.walls = set()
        self.pits = []
        self.fixed = {}        # cell -> 'D' | 'S' | 'X'
        self.bells = []          # top-left cell of each 2x2 bell
        bell_seen = set()
        self.start = (0, 0)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                c = (x, y)
                if ch == "#":
                    self.walls.add(c)
                elif ch == "o":
                    self.pits.append(c)
                elif ch in "DSX":
                    self.fixed[c] = ch
                elif ch == "B":
                    if (x - 1, y) not in bell_seen and (x, y - 1) not in bell_seen:
                        self.bells.append(c)
                    bell_seen.add(c)
                elif ch == "P":
                    self.start = c
        self.face = spec["face"]
        self.bag = spec["bag"]
        self.rails = []
        self.rail_cells = set()
        for r in spec["rails"]:
            (ax, ay), (bx, by) = r["a"], r["b"]
            cells = []
            n = max(abs(bx - ax), abs(by - ay))
            for k in range(n + 1):
                cells.append((ax + (bx > ax) * k - (bx < ax) * k, ay + (by > ay) * k - (by < ay) * k))
            self.rails.append({"cells": cells, "phase": r.get("phase", 0), "slow": r.get("slow", 0)})
            self.rail_cells.update(cells)
        period = 1
        for r in self.rails:
            m = len(r["cells"])
            p = 2 * (m - 1) if m > 1 else 1
            if r["slow"]:
                p *= 2
            period = _lcm(period, p)
        self.period = period
        self.bell_cells = {c for b in self.bells for c in bell_area(b)}
        self.blocked = self.walls | self.rail_cells | set(self.pits) | self.bell_cells


def cart_index(lvl, r, t):
    rail = lvl.rails[r]
    m = len(rail["cells"])
    if m <= 1:
        return 0
    period = 2 * (m - 1)
    step = t // 2 if rail["slow"] else t
    u = (rail["phase"] + step) % period
    return u if u <= m - 1 else period - u


def cart_cell(lvl, r, t, down):
    if down[r] >= 0:
        return lvl.rails[r]["cells"][down[r]]
    return lvl.rails[r]["cells"][cart_index(lvl, r, t)]


def initial(lvl):
    """(x, y, face, t, placed, dead_pits, fallen, cart_down, rung)"""
    return (lvl.start[0], lvl.start[1], lvl.face, 0, frozenset(), frozenset(), frozenset(),
            tuple(-1 for _ in lvl.rails), frozenset())


def bag_of(lvl, s):
    return lvl.bag - len(s[4]) - len(s[5])


def standing(lvl, s):
    """cell -> kind of every piece that is still on its feet at time s.t."""
    x, y, face, t, placed, dead, fallen, down, rung = s
    st = {}
    for c, k in lvl.fixed.items():
        if c not in fallen:
            st[c] = k
    for c in placed:
        st[c] = "D"
    for r in range(len(lvl.rails)):
        if down[r] < 0:
            st[cart_cell(lvl, r, t, down)] = "C"
    return st


def walkable(lvl, s, c):
    if not (0 <= c[0] < GRID and 0 <= c[1] < GRID):
        return False
    if c in lvl.walls or c in lvl.rail_cells or c in lvl.bell_cells:
        return False
    if c in lvl.pits:
        return c in s[5]
    if c in lvl.fixed:
        return c in s[6]
    return True


def cascade(lvl, s, first):
    """What happens if the piece at `first` goes over now. Returns (layers, rings, hit_sleeper):
    layers is a list of lists of cells (the pieces falling in each ring), rings maps bell -> ring."""
    st = standing(lvl, s)
    seen = {first}
    layers = [[first]]
    while True:
        nxt = []
        for c in layers[-1]:
            for dx, dy in DIRS:
                n = (c[0] + dx, c[1] + dy)
                if n in st and n not in seen:
                    seen.add(n)
                    nxt.append(n)
        if not nxt:
            break
        layers.append(sorted(nxt))
    rings = {}
    owner = {c: b for b in lvl.bells for c in bell_area(b)}
    for k, layer in enumerate(layers):
        for c in layer:
            for dx, dy in DIRS:
                b = owner.get((c[0] + dx, c[1] + dy))
                if b is not None and b not in s[8] and b not in rings:
                    rings[b] = k
    hit = any(st[c] == "X" for layer in layers for c in layer)
    return layers, rings, hit


def can_still_win(lvl, s):
    """Optimistic: could the starters still standing, with carts anywhere on their rails and the
    pits fillable, reach every bell that has not rung? False means the level can never be won."""
    left = [b for b in lvl.bells if b not in s[8]]
    if not left:
        return True
    x, y, face, t, placed, dead, fallen, down, rung = s
    nodes = {}
    for c, k in lvl.fixed.items():
        if c not in fallen:
            nodes[c] = k
    for c in placed:
        nodes[c] = "D"
    for r, rail in enumerate(lvl.rails):
        if down[r] < 0:
            for c in rail["cells"]:
                nodes[c] = "C"
    if bag_of(lvl, s) + len(placed) > 0:
        for c in lvl.pits:
            if c not in dead:
                nodes[c] = "D"
    seen = {c for c, k in nodes.items() if k == "S"}
    stack = list(seen)
    while stack:
        c = stack.pop()
        for dx, dy in DIRS:
            n = (c[0] + dx, c[1] + dy)
            if n in nodes and n not in seen:
                seen.add(n)
                stack.append(n)
    for b in left:
        if not any((c[0] + dx, c[1] + dy) in seen for c in bell_area(b) for dx, dy in DIRS):
            return False
    return True


def act(lvl, s, a):
    """One key press. a is 0..3 for up/down/left/right, 4 for Space. Every press is one beat: the
    carts roll one step. Returns (new state, info)."""
    x, y, face, t, placed, dead, fallen, down, rung = s
    info = {"kind": "refuse", "from": (x, y), "result": None}
    if a < 4:
        dx, dy = DIRS[a]
        target = (x + dx, y + dy)
        if walkable(lvl, s, target) and target not in standing(lvl, s):
            info["kind"] = "move"
            info["to"] = target
            return (target[0], target[1], a, t + 1, placed, dead, fallen, down, rung), info
        info["kind"] = "bump"
        info["dir"] = a
        return (x, y, a, t + 1, placed, dead, fallen, down, rung), info
    dx, dy = DIRS[face]
    front = (x + dx, y + dy)
    info["front"] = front
    st = standing(lvl, s)
    if front in lvl.pits and front not in dead:
        if front in placed:
            info["kind"] = "take"
            return (x, y, face, t + 1, placed - {front}, dead, fallen, down, rung), info
        if bag_of(lvl, s) > 0:
            info["kind"] = "place"
            return (x, y, face, t + 1, placed | {front}, dead, fallen, down, rung), info
        return (x, y, face, t + 1, placed, dead, fallen, down, rung), info
    if st.get(front) == "S":
        layers, rings, hit = cascade(lvl, s, front)
        new_fallen, new_placed, new_dead = set(fallen), set(placed), set(dead)
        new_down = list(down)
        for layer in layers:
            for c in layer:
                if c in lvl.fixed:
                    new_fallen.add(c)
                elif c in placed:
                    new_placed.discard(c)
                    new_dead.add(c)
                else:
                    for r in range(len(lvl.rails)):
                        if down[r] < 0 and cart_cell(lvl, r, t, down) == c:
                            new_down[r] = lvl.rails[r]["cells"].index(c)
        new_rung = frozenset(set(rung) | set(rings))
        ns = (x, y, face, t + 1, frozenset(new_placed), frozenset(new_dead), frozenset(new_fallen),
              tuple(new_down), new_rung)
        info.update({"kind": "tip", "layers": layers, "rings": rings, "hit": hit, "first": front})
        if hit:
            info["result"] = "dead"
        elif all(b in new_rung for b in lvl.bells):
            info["result"] = "win"
        elif not can_still_win(lvl, ns):
            info["result"] = "dead"
        return ns, info
    return (x, y, face, t + 1, placed, dead, fallen, down, rung), info


# ---- drawing --------------------------------------------------------------------------------
def cpx(c):
    return (OFF + CELL * c[0], OFF + CELL * c[1])


def recolour(art, table):
    return [[table.get(v, v) if v >= 0 else v for v in row] for row in art]


PRIMED = {0: YELLOW}
PRIMED_CART = {PURPLE: YELLOW}


def rect_px(w, h, colour):
    return [[colour] * w for _ in range(h)]


def frame_px():
    px = [[-1] * 64 for _ in range(64)]
    for k in range(64):
        for e in (0, 1, 62, 63):
            px[e][k] = BLACK
            px[k][e] = BLACK
    return px


def make_sprite(pixels, name, x, y, layer):
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.INTANGIBLE, layer=layer,
    ).set_position(x, y)


BLANK = [[-1] * CELL for _ in range(CELL)]


def rail_art(lvl, cell):
    for rail in lvl.rails:
        cells = rail["cells"]
        if cell in cells:
            i = cells.index(cell)
            if i in (0, len(cells) - 1):
                return RAIL_END
            return RAIL_H if cells[0][1] == cells[-1][1] else RAIL_V
    return BLANK


def build_levels():
    levels = []
    for spec in LEVELS:
        lvl = Lvl(spec)
        sprites = [make_sprite(frame_px(), "frame", 0, 0, 20)]
        for i, c in enumerate(sorted(lvl.walls)):
            x, y = cpx(c)
            sprites.append(make_sprite(WALL_PX, f"block_{i}", x, y, 1))
        for c in sorted(lvl.rail_cells):
            x, y = cpx(c)
            sprites.append(make_sprite(rail_art(lvl, c), f"rail_{c[0]}_{c[1]}", x, y, 1))
        for c in lvl.pits:
            x, y = cpx(c)
            sprites.append(make_sprite(PIT, f"pit_{c[0]}_{c[1]}", x, y, 2))
        for c in sorted(lvl.fixed):
            x, y = cpx(c)
            sprites.append(make_sprite(DOMINO, f"piece_{c[0]}_{c[1]}", x, y, 4))
        for c in lvl.bells:
            x, y = cpx(c)
            sprites.append(make_sprite(BELL_DULL, f"bell_{c[0]}_{c[1]}", x, y, 4))
        for r in range(len(lvl.rails)):
            sprites.append(make_sprite(CART, f"cart_{r}", 0, 0, 6))
        sprites.append(make_sprite(avatar_px(lvl.face), "walker", 0, 0, 8))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


def fixed_art(kind, state, primed):
    if kind == "S":
        return {"up": STARTER, "tilt": STARTER_TILT, "down": STARTER_DOWN, "hot": DOMINO_HOT}[state]
    if kind == "X":
        return {"up": SLEEPER, "tilt": SLEEPER, "down": SLEEPER_DOWN, "hot": SLEEPER_DOWN}[state]
    art = {"up": DOMINO, "tilt": DOMINO_TILT, "down": DOMINO_DOWN, "hot": DOMINO_HOT}[state]
    return recolour(art, PRIMED) if primed and state == "up" else art


class G006A(RenderableUserDisplay):
    """Draws what sprites cannot: corner marks, bursts, the pieces in your pocket."""

    def __init__(self, game: "G006") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        scene = self._game._scene
        if scene is None:
            return frame

        def put(art, x, y):
            for dy, row in enumerate(art):
                for dx, c in enumerate(row):
                    if c >= 0 and 0 <= y + dy < 64 and 0 <= x + dx < 64:
                        frame[y + dy, x + dx] = c

        for kind, a, b, colour in scene["fx"]:
            if kind == "corners":
                x, y = cpx(a)
                n = (b or 5) - 1
                for cx, cy in ((x, y), (x + n, y), (x, y + n), (x + n, y + n)):
                    frame[cy, cx] = colour
            elif kind == "bracket":
                x, y = cpx(a)
                n = (b or 5) - 1
                for cx, cy, sx, sy in ((x, y, 1, 1), (x + n, y, -1, 1), (x, y + n, 1, -1), (x + n, y + n, -1, -1)):
                    frame[cy, cx] = colour
                    frame[cy, cx + sx] = colour
                    frame[cy + sy, cx] = colour
            elif kind == "art":
                put(a, b[0], b[1])
        ax, ay = scene["av"]
        for k in range(scene["bag"]):
            x0 = ax + 5 * k // 2 * 0 + (0 if scene["bag"] == 2 and k == 0 else (3 if scene["bag"] == 2 else 1))
            frame[ay - 3:ay - 1, x0:x0 + 2] = WHITE
        return frame


class G006(ARCBaseGame):

    def __init__(self) -> None:
        self.lvl = Lvl(LEVELS[0])
        self.s = initial(self.lvl)
        self._anim = []
        self._after = None
        self._scene = None
        camera = Camera(width=64, height=64, background=FLOOR, letter_box=BLACK,
                        interfaces=[G006A(self)])
        super().__init__(game_id="g006", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    # ---- level state ----------------------------------------------------------------------
    def on_set_level(self, level: Level) -> None:
        self.lvl = Lvl(LEVELS[self.level_index])
        self.s = initial(self.lvl)
        self._anim = []
        self._after = None
        self._apply(self._scene_of(self.s))

    # ---- what is on screen ----------------------------------------------------------------
    def _preview(self, s):
        """The pieces a press of Space would knock over right now, when you face a starter."""
        lvl = self.lvl
        dx, dy = DIRS[s[2]]
        front = (s[0] + dx, s[1] + dy)
        st = standing(lvl, s)
        if st.get(front) != "S":
            return None
        return cascade(lvl, s, front)

    def _scene_of(self, s, cart_from=None, av_shift=(0, 0), av_from=None, mix=1.0, wave=0, preview=True):
        """The picture for state s. cart_from/av_from: where things were, blended by mix (0..1)."""
        lvl = self.lvl
        x, y, face, t, placed, dead, fallen, down, rung = s
        ax, ay = cpx((x, y))
        if av_from is not None:
            fx_, fy_ = cpx(av_from)
            ax = round(fx_ + (ax - fx_) * mix)
            ay = round(fy_ + (ay - fy_) * mix)
        ax += av_shift[0]
        ay += av_shift[1]
        carts = []
        for r in range(len(lvl.rails)):
            nx, ny = cpx(cart_cell(lvl, r, t, down))
            if cart_from is not None and down[r] < 0:
                ox, oy = cpx(cart_cell(lvl, r, cart_from, down))
                nx = round(ox + (nx - ox) * mix)
                ny = round(oy + (ny - oy) * mix)
            carts.append((nx, ny, "down" if down[r] >= 0 else "up"))
        fixed = {c: ("down" if c in fallen else "up") for c in lvl.fixed}
        pits = {c: ("down" if c in dead else ("up" if c in placed else "empty")) for c in lvl.pits}
        bells = {c: ("rung" if c in rung else "dull") for c in lvl.bells}
        fx = []
        primed = set()
        if preview:
            pv = self._preview(s)
            if pv is not None:
                layers, rings, hit = pv
                for layer in layers:
                    for c in layer:
                        if lvl.fixed.get(c) == "X":
                            fx.append(("corners", c, None, RED))
                        elif lvl.fixed.get(c) != "S":
                            primed.add(c)
                for b in rings:
                    fx.append(("corners", b, 10, YELLOW))
        return {"av": (ax, ay), "face": face, "wave": wave, "carts": carts, "fixed": fixed, "pits": pits,
                "bells": bells, "fx": fx, "bag": bag_of(lvl, s), "primed": primed, "bell_fx": {}}

    def _apply(self, scene):
        self._scene = scene
        level = self.current_level
        lvl = self.lvl
        primed = scene["primed"]
        walker = level.get_sprites_by_name("walker")[0]
        walker.set_position(*scene["av"])
        walker.pixels = np.array(avatar_px(scene["face"], scene["wave"]), dtype=np.int8)
        for c, state in scene["fixed"].items():
            sprite = level.get_sprites_by_name(f"piece_{c[0]}_{c[1]}")[0]
            sprite.pixels = np.array(fixed_art(lvl.fixed[c], state, c in primed), dtype=np.int8)
        for c, state in scene["pits"].items():
            sprite = level.get_sprites_by_name(f"pit_{c[0]}_{c[1]}")[0]
            if state == "empty":
                art = PIT
            elif state == "up":
                art = recolour(DOMINO, PRIMED) if c in primed else DOMINO
            elif state == "tilt":
                art = DOMINO_TILT
            elif state == "hot":
                art = DOMINO_HOT
            else:
                art = DOMINO_DOWN
            sprite.pixels = np.array(art, dtype=np.int8)
        for c, state in scene["bells"].items():
            sprite = level.get_sprites_by_name(f"bell_{c[0]}_{c[1]}")[0]
            sprite.pixels = np.array(BELL_RUNG if state == "rung" else BELL_DULL, dtype=np.int8)
        for r, (px, py, state) in enumerate(scene["carts"]):
            sprite = level.get_sprites_by_name(f"cart_{r}")[0]
            sprite.set_position(px, py)
            art = CART_DOWN if state == "down" else (recolour(CART, PRIMED_CART) if self._cart_primed(r) else CART)
            sprite.pixels = np.array(art, dtype=np.int8)

    def _cart_primed(self, r):
        pv = self._preview(self.s)
        if pv is None:
            return False
        lvl = self.lvl
        c = cart_cell(lvl, r, self.s[3], self.s[7])
        return any(c in layer for layer in pv[0])

    # ---- actions --------------------------------------------------------------------------
    def step(self) -> None:
        if not self._anim:
            if self.action.id == GameAction.RESET:
                self.complete_action()
                return
            self._begin()
        scene = self._anim.pop(0)
        self._apply(scene)
        if not self._anim:
            after, self._after = self._after, None
            if after == "next":
                self.next_level()
            elif after == "restart":
                self.level_reset()
                self._action_count = max(1, self._action_count)  # the engine zeroes it; a later Reset must stay a level reset
            self.complete_action()

    def _begin(self) -> None:
        aid = self.action.id
        keys = {GameAction.ACTION1: 0, GameAction.ACTION2: 1, GameAction.ACTION3: 2, GameAction.ACTION4: 3,
                GameAction.ACTION5: 4}
        if aid not in keys:
            self._anim = [self._scene_of(self.s)]
            return
        a = keys[aid]
        old = self.s
        new, info = act(self.lvl, old, a)
        self.s = new
        kind = info["kind"]
        if kind == "move":
            mid = self._scene_of(new, cart_from=old[3], av_from=(old[0], old[1]), mix=0.5, wave=1, preview=False)
            end = self._scene_of(new, cart_from=old[3], av_from=(old[0], old[1]), mix=1.0, wave=0)
            self._anim = [mid, end]
        elif kind == "bump":
            dx, dy = DIRS[info["dir"]]
            a1 = self._scene_of(new, cart_from=old[3], mix=0.5, av_shift=(dx, dy), preview=False)
            a2 = self._scene_of(new, cart_from=old[3], mix=1.0, av_shift=(dx, dy))
            a3 = self._scene_of(new)
            self._anim = [a1, a2, a3]
        elif kind in ("place", "take"):
            front = info["front"]
            a1 = self._scene_of(new, cart_from=old[3], mix=0.5, preview=False)
            a1["fx"].append(("art", PUFF, (cpx(front)[0] + 1, cpx(front)[1] + 1), None))
            a2 = self._scene_of(new)
            self._anim = [a1, a2]
        elif kind == "tip":
            self._begin_tip(old, new, info)
        else:
            ax, ay = cpx((new[0], new[1]))
            a1 = self._scene_of(new, cart_from=old[3], mix=0.5, preview=False)
            a1["fx"].append(("art", PUFF, (ax + 1, ay - 5), None))
            a2 = self._scene_of(new)
            a2["fx"].append(("art", PUFF1, (ax + 2, ay - 4), None))
            a3 = self._scene_of(new)
            self._anim = [a1, a2, a3]

    def _begin_tip(self, old, new, info) -> None:
        lvl = self.lvl
        layers, rings = info["layers"], info["rings"]
        frames = []
        down_cells = set()
        rung = set(old[8])
        for k in range(len(layers) + 1):
            scene = self._scene_of(old, preview=False)
            if k < len(layers):
                for c in layers[k]:
                    self._set_cell(scene, c, "tilt")
            for c in down_cells:
                self._set_cell(scene, c, "down")
            for b, ring in rings.items():
                if ring < k:
                    scene["bells"][b] = "rung"
                    scene["fx"].append(("corners", b, 10, WHITE))
            frames.append(scene)
            if k < len(layers):
                down_cells.update(layers[k])
        # the carts that are still standing roll on
        end = self._scene_of(new, preview=False)
        for b in rings:
            end["fx"].append(("corners", b, 10, WHITE))
        if lvl.rails and any(c < 0 for c in new[7]):
            mid = self._scene_of(new, cart_from=old[3], mix=0.5, preview=False)
            for b in rings:
                mid["fx"].append(("corners", b, 10, WHITE))
            frames.append(mid)
        result = info["result"]
        if result == "dead":
            hot = self._scene_of(new, preview=False)
            for layer in layers:
                for c in layer:
                    self._set_cell(hot, c, "hot")
            for b in lvl.bells:
                if b not in new[8]:
                    hot["fx"].append(("bracket", b, 10, RED))
            for layer in layers:
                for c in layer:
                    if lvl.fixed.get(c) == "X":
                        hot["fx"].append(("bracket", c, None, RED))
            frames += [hot] * 5
            self._after = "restart"
        elif result == "win":
            frames += [end, end]
            self._after = "next"
        else:
            frames += [end]
        self._anim = frames

    def _set_cell(self, scene, c, state):
        if c in scene["fixed"]:
            scene["fixed"][c] = state
        elif c in scene["pits"]:
            scene["pits"][c] = state
        else:
            for r, (px, py, st) in enumerate(scene["carts"]):
                if (px, py) == cpx(c):
                    scene["carts"][r] = (px, py, "down" if state in ("down", "hot") else "up")
