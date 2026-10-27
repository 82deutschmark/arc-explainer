# Original author: Claude Fable 5.1 (2026-09-02); glow-up: GPT-5 (2026-09-22)
# PURPOSE: tl01 "Toll" -- an ARC-AGI-3 environment in which every gate is paid for with one
#   of the player's own four actions, permanently for the level. The walker is drawn with four
#   limbs, one per direction. Standing on a booth, the next direction pressed does not move
#   the walker: that limb detaches, lodges in the booth, the booth opens, and the direction is
#   gone until the level ends. Later booths and the corridor itself need directions too, so
#   the puzzle is choosing which limb you can live without. Shaped booths only open for one
#   limb. There is no budget, no lives and no counter anywhere on screen -- the body is the
#   whole display of state. If the exit stops being reachable, the body and unreachable floor
#   grey visibly and RESET restores the same level. Core-knowledge priors only: objectness,
#   topology, agentness.
# SRP/DRY check: Pass -- self-contained environment. No game in the catalogue removes actions
#   from the action set as a cost, so there is no prior art to reuse.
"""tl01 -- pass gates by giving up your own actions.

ACTION1/2/3/4 move up/down/left/right. On an unpaid booth the next press does not move you:
the limb for that direction detaches and lodges in the booth, which opens, and that direction
does nothing for the rest of the level. A shaped booth only opens for the limb its socket is
cut for; any other offering is lost and the booth stays shut. Reach the exit. When the exit
can no longer be reached with the limbs you still own, the body and unreachable floor grey.
RESET retries the level with a whole body; exploration never causes a terminal loss.

9 levels. No RNG. No budget, no lives, no counters, no terminal loss.
"""

from collections import deque
from itertools import combinations

import numpy as np
from arcengine import ARCBaseGame, Camera, GameState, Level, RenderableUserDisplay, Sprite

# ---------------------------------------------------------------------------
# Palette (ARC-3 indices)
# ---------------------------------------------------------------------------

C_WHITE, C_LGRAY, C_GRAY, C_DGRAY, C_VDGRAY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_LMAGENTA, C_RED, C_BLUE, C_LBLUE = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_MAROON, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

C_FIELD = C_MAROON       # walls and the ground around the maze (maroon: 0.0% of official pixels)
C_FLOOR = C_PURPLE       # a tile you can stand on
C_CLIFF = C_VDGRAY       # a tile you could step onto but never leave, with the limbs you have
C_EXIT = C_LMAGENTA
C_FRAME = C_LGRAY        # booth frame: shut = full ring, open = corner ticks
C_HOLE = C_BLACK         # the socket a limb lodges in
C_CORE = C_WHITE
C_DEAD_CORE = C_LGRAY    # the body once no limb can do anything useful
C_DEAD_LIMB = C_DGRAY

# One colour per limb, but every limb is ALSO identified by where it sits on the body and by
# the direction its socket points, so the distinction never rests on hue alone.
LIMB_COLOR = {"U": C_YELLOW, "D": C_ORANGE, "L": C_LBLUE, "R": C_GREEN}

# ---------------------------------------------------------------------------
# Board geometry -- 9x9 tiles of 7px fill 63x63 of the 64x64 frame. No HUD.
# ---------------------------------------------------------------------------

GRID = 9
CELL = 7
OX, OY = 0, 0

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}
ACTION_DIR = {1: "U", 2: "D", 3: "L", 4: "R"}      # ACTION1..4
ALL_LIMBS = frozenset("UDLR")

# Map alphabet. A booth is a tile: step onto it like any other, but you cannot step off it
# until you have paid. 'G' takes any limb; the four shaped booths take exactly one.
WALL, FLOOR, START, EXIT = "#", ".", "S", "E"
SHAPE = {"G": None, "^": "U", "v": "D", "<": "L", ">": "R"}

# ---------------------------------------------------------------------------
# Levels. Each map is GRID rows of GRID characters. Escalation is by adding a rule; every
# earlier rule stays in force.
#
# The terrain idiom from level 2 on: after a payment the walker is missing one direction, so
# any alcove it can step into but not back out of is a trap. Alcoves sit beside every long
# corridor in exactly those directions. A player who knows which limb they lost simply never
# turns that way; a player pressing at random turns that way within a few presses.
# ---------------------------------------------------------------------------

LEVELS = [
    {
        # NEW: a press on a booth costs the limb for that direction, and that direction then
        # does nothing. Three exits, one per remaining direction, so nothing you give up can
        # strand you -- the only lesson is what a booth does.
        "name": "Toll",
        "map": ("####E####",
                "####.####",
                "####.####",
                "####.####",
                "E...G...E",
                "####.####",
                "####.####",
                "####.####",
                "####S####"),
    },
    {
        # NEW: the corridor beyond the booth needs three directions (up, right, down), so the
        # only limb you can afford is LEFT -- and the limb you arrive on, UP, is the one the
        # naive press spends. Spend it and the route visibly becomes stranded.
        "name": "Corridor",
        "map": (".....#..E",
                ".##.##.##",
                "..#..#..#",
                "..#..#..#",
                "..#.##.##",
                "..#.....#",
                "G.#######",
                ".########",
                "S########"),
    },
    {
        # NEW: two booths. The first corridor needs up+right, the last needs down+right, so
        # the first booth must take LEFT and the second UP. DOWN looks free at the first booth
        # -- nothing before the second booth needs it -- and spending it there strands the route.
        "name": "Two Tolls",
        "all_booths": True,
        "map": ("#########",
                "....G.###",
                ".###..###",
                "..##.####",
                "..##.....",
                "..##..#..",
                "..#####..",
                "G.#####..",
                "S######E#"),
    },
    {
        # NEW: a shaped booth. Its socket is cut for one limb (here DOWN) and drawn in that
        # limb's colour; any other offering is lost and the booth stays shut. So DOWN has to
        # survive the plain booth even though the walk there needs up, left and down already:
        # RIGHT is the only thing you can give.
        "name": "Socket",
        "map": ("E..######",
                "##v######",
                "#..#.....",
                "#..#..##.",
                "#..#..#..",
                "#..#..#..",
                "#..##.#..",
                "#.....#.G",
                "########S"),
    },
    {
        # NEW: an exit that needs a limb (UP) you must carry through three booths. The row
        # needs RIGHT, the socket at the end wants LEFT, so the first booth can only take
        # DOWN and the second only RIGHT. One order works out of twenty-four.
        "name": "Keep",
        "map": ("####E#...",
                "####<....",
                "########.",
                ".......#.",
                "G.......G",
                ".########",
                ".########",
                ".########",
                "S########"),
    },
    {
        # NEW: a booth you must not use. The UP socket beside the start opens onto a pocket
        # you can only leave upward -- with the limb it just took. The real road is the
        # corridor with a DOWN socket at the top, which the zigzag can afford.
        "name": "Fork",
        "map": (".....#..E",
                ".##.##v##",
                "..#..#..#",
                "..#..#..#",
                "..#.##.##",
                "..#.....#",
                "G.#######",
                ".^#######",
                "S########"),
    },
    {
        # Everything at once: two plain booths, a RIGHT socket, an exit that needs UP, and two
        # decoys -- a LEFT socket beside the start that takes exactly the limb you can spare
        # and leads nowhere, and a plain booth in an alcove above the corridor.
        "name": "Gauntlet",
        "map": ("########E",
                "########.",
                "###G##.#.",
                ".....#G.>",
                ".##..#.##",
                "..#..#..#",
                "..#.##..#",
                "G##.....#",
                "S<#######"),
    },
    {
        # COMPOSE: three payments must all be made.  The route deliberately stops using LEFT,
        # then DOWN, then RIGHT, so the player reads the remaining corridor before paying.
        "name": "Three Turns",
        "all_booths": True,
        "map": ("########E",
                "########.",
                "########>",
                "########.",
                "........v",
                ".########",
                "G........",
                "########.",
                "S........"),
    },
    {
        # FINALE: every booth is required, two sockets are shaped, and adjacent side pockets
        # tempt presses that spend a direction before its last real use.
        "name": "Last Limbs",
        "all_booths": True,
        "map": ("S........",
                "########.",
                ".........",
                ".########",
                "........^",
                "########.",
                "G........",
                ".########",
                "......v.E"),
    },
]


# ---------------------------------------------------------------------------
# Rules as pure functions -- shared by the game, its smoke test and its gate
# ---------------------------------------------------------------------------

def parse(rows):
    """-> (cells, start, exits, booths). booths maps tile -> required limb or None."""
    cells, exits, booths, start = set(), set(), {}, None
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == WALL:
                continue
            cells.add((c, r))
            if ch == START:
                start = (c, r)
            elif ch == EXIT:
                exits.add((c, r))
            elif ch in SHAPE:
                booths[(c, r)] = SHAPE[ch]
    return frozenset(cells), start, frozenset(exits), booths


def winning_states(cells, exits, booths, require_all=False):
    """Every (pos, limbs, paid) from which the exit can still be reached.

    Payments only ever remove limbs, so the layers (limbs, paid) form a DAG and can be
    filled in from fewest limbs upward. Inside one layer the walker moves freely except that
    it cannot step OFF an unpaid booth; an unpaid booth is a winning position only if some
    owned limb its socket accepts leads to a winning lower layer. A wrong offering at a
    shaped booth loses a limb and opens nothing, so it never helps and is not searched.
    """
    good = set()
    order = sorted(booths)
    for k in range(5):
        for combo in combinations("UDLR", k):
            limbs = frozenset(combo)
            for bits in range(1 << len(order)):
                paid = frozenset(b for i, b in enumerate(order) if bits >> i & 1)
                unpaid = set(order) - paid
                layer = set(exits) if (not require_all or set(order).issubset(paid)) else set()
                for b in unpaid:
                    if any(booths[b] in (None, x) and (b, limbs - {x}, paid | {b}) in good
                           for x in limbs):
                        layer.add(b)
                q = deque(layer)
                while q:
                    p = q.popleft()
                    for d in limbs:
                        dx, dy = DIRS[d]
                        src = (p[0] - dx, p[1] - dy)          # src --d--> p
                        if src in cells and src not in layer and src not in unpaid:
                            layer.add(src)
                            q.append(src)
                for p in layer:
                    good.add((p, limbs, paid))
    return frozenset(good)


_TABLES = {}


def table(level_index):
    if level_index not in _TABLES:
        cells, _, exits, booths = parse(LEVELS[level_index]["map"])
        _TABLES[level_index] = winning_states(
            cells, exits, booths, bool(LEVELS[level_index].get("all_booths"))
        )
    return _TABLES[level_index]


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

class Tl01Display(RenderableUserDisplay):
    """Everything is repainted from current state every frame. The body IS the HUD: a limb
    you own is a coloured bar on the side it moves you; a limb you have spent is a black
    notch in the core on that side, and the same coloured bar lying in the booth that took
    it. Floor you could walk onto but never leave is dark. A body that can do nothing useful
    is grey."""

    def __init__(self, game):
        self.game = game

    # -- primitives ---------------------------------------------------------

    @staticmethod
    def _ring(frame, px, py, color):
        frame[py, px:px + CELL] = color
        frame[py + CELL - 1, px:px + CELL] = color
        frame[py:py + CELL, px] = color
        frame[py:py + CELL, px + CELL - 1] = color

    @staticmethod
    def _corners(frame, px, py, color):
        for dy in (0, CELL - 1):
            for dx in (0, CELL - 1):
                frame[py + dy, px + dx] = color

    @staticmethod
    def _bar(frame, px, py, d, length, color, start=0):
        """`length` pixels along direction d, starting `start` pixels from the tile centre."""
        cx, cy = px + 3, py + 3
        dx, dy = DIRS[d]
        for i in range(start, start + length):
            frame[cy + dy * i, cx + dx * i] = color

    # -- one tile -----------------------------------------------------------

    def _draw_cell(self, frame, g, cell):
        px, py = OX + cell[0] * CELL, OY + cell[1] * CELL
        unpaid = cell in g.booths and cell not in g.paid
        cliff = (not unpaid and cell not in g.exits
                 and (cell, g.limbs, g.paid) not in g.good)
        frame[py:py + CELL, px:px + CELL] = C_CLIFF if cliff else C_FLOOR

        if cell in g.exits:
            self._ring(frame, px, py, C_EXIT)
            frame[py + 3, px + 3] = C_EXIT
            return
        if cell not in g.booths:
            return

        shape = g.booths[cell]
        if unpaid:
            self._ring(frame, px, py, C_FRAME)
            if shape is None:
                frame[py + 2:py + 5, px + 2:px + 5] = C_HOLE          # takes anything
            else:
                self._bar(frame, px, py, shape, 3, C_HOLE)             # a slot, cut for one limb
                dx, dy = DIRS[shape]
                for k in (-1, 0, 1):                                    # ...in that limb's colour
                    frame[py + 3 + dy * 3 + dx * k, px + 3 + dx * 3 + dy * k] = LIMB_COLOR[shape]
            for d in g.rejected.get(cell, ()):
                self._bar(frame, px, py, d, 2, LIMB_COLOR[d], start=2)  # a lost offering
        else:
            self._corners(frame, px, py, C_FRAME)
            for d in g.rejected.get(cell, ()):
                self._bar(frame, px, py, d, 2, LIMB_COLOR[d], start=2)
            lodged = g.lodged.get(cell)
            if lodged:
                self._bar(frame, px, py, lodged, 4, LIMB_COLOR[lodged])  # the limb that opened it

    # -- frame --------------------------------------------------------------

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        frame[:, :] = C_FIELD
        for cell in g.cells:
            self._draw_cell(frame, g, cell)

        px, py = OX + g.pos[0] * CELL, OY + g.pos[1] * CELL
        # The first presentation frame puts the whole body halfway along a real move.  A
        # refused move nudges it one pixel toward the obstruction and then settles back.
        if g.presenting and g.anim_from is not None:
            ax, ay = g.anim_from
            bx, by = g.pos
            if (ax, ay) != (bx, by):
                px = OX + ax * CELL + (bx - ax) * 3
                py = OY + ay * CELL + (by - ay) * 3
            elif g.feedback_dir:
                dx, dy = DIRS[g.feedback_dir]
                px += dx
                py += dy
        dead = g.stranded
        frame[py + 2:py + 5, px + 2:px + 5] = C_DEAD_CORE if dead else C_CORE
        for d in "UDLR":
            if d in g.limbs:
                self._bar(frame, px, py, d, 2, C_DEAD_LIMB if dead else LIMB_COLOR[d], start=2)
            else:
                self._bar(frame, px, py, d, 1, C_HOLE, start=1)         # the notch it left
        return frame


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Tl01(ARCBaseGame):
    def __init__(self):
        self.display = Tl01Display(self)

        # on_set_level() runs inside super().__init__(), so everything it touches -- and
        # everything the display reads -- has to exist first.
        self.cells = frozenset()
        self.exits = frozenset()
        self.booths = {}
        self.good = frozenset()
        self.start = (0, 0)
        self.pos = (0, 0)
        self.limbs = ALL_LIMBS
        self.paid = frozenset()
        self.lodged = {}
        self.rejected = {}
        self.stranded = False
        self.presenting = False
        self.anim_from = None
        self.feedback_dir = None

        levels = [self._make_level(ldef, i) for i, ldef in enumerate(LEVELS)]

        super().__init__(
            "tl01",
            levels,
            Camera(0, 0, 64, 64, C_FIELD, C_FIELD, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4],            # d-pad only. The sacrifice IS a direction press.
        )

    @staticmethod
    def _make_level(ldef, index):
        """Declare the board as real, named engine sprites as well as drawing its rich UI."""
        cells, start, exits, booths = parse(ldef["map"])
        sprites = []
        for x, y in sorted(cells):
            if (x, y) in exits:
                color, kind = C_EXIT, "exit"
            elif (x, y) in booths:
                color, kind = C_FRAME, "booth"
            elif (x, y) == start:
                color, kind = C_CORE, "start"
            else:
                color, kind = C_FLOOR, "floor"
            sprites.append(Sprite([[color]], name=f"{kind}_{index}_{x}_{y}", x=x * CELL,
                                  y=y * CELL, scale=CELL, layer=0))
        return Level(sprites=sprites, grid_size=(64, 64), data=ldef, name=ldef["name"])

    # -- level setup --------------------------------------------------------

    def on_set_level(self, level: Level) -> None:
        """Rebuild the level from its constants: whole body, every booth shut. Runs on a new
        level and on every RESET, so a lost level is retried with all four limbs."""
        i = self.level_index
        self.cells, self.start, self.exits, self.booths = parse(LEVELS[i]["map"])
        self.good = table(i)
        self.pos = self.start
        self.limbs = ALL_LIMBS
        self.paid = frozenset()
        self.lodged = {}
        self.rejected = {}
        self.stranded = False
        self.presenting = False
        self.anim_from = None
        self.feedback_dir = None

    def handle_reset(self) -> None:
        """The base class promotes a RESET to a full restart whenever `_action_count == 0`,
        and `_action_count` is zeroed by every level load -- so a RESET as the first action
        on a level would throw the player back to level 1. Full restart only from NOT_PLAYED
        and WIN; a level retry otherwise."""
        if self._state in (GameState.NOT_PLAYED, GameState.WIN):
            self.full_reset()
        else:
            self.level_reset()

    # -- rules --------------------------------------------------------------

    def _press(self, d):
        if d not in self.limbs:
            return False                                  # visible nudge; rules do not change
        if self.pos in self.booths and self.pos not in self.paid:
            self.limbs = self.limbs - {d}                 # the toll: the limb detaches
            if self.booths[self.pos] in (None, d):
                self.paid = self.paid | {self.pos}
                self.lodged[self.pos] = d
            else:
                self.rejected[self.pos] = self.rejected.get(self.pos, ()) + (d,)
            return False
        dx, dy = DIRS[d]
        nxt = (self.pos[0] + dx, self.pos[1] + dy)
        if nxt in self.cells:
            self.pos = nxt                                # walls cost nothing
            return True
        return False

    # -- engine entry point -------------------------------------------------

    def step(self) -> None:
        aid = self.action.id.value
        if aid == 0:
            self.complete_action()
            return

        # Rule state changes only on the first step.  The second step is presentation-only:
        # it settles the body and then finishes (or advances) the action.
        if self.presenting:
            self.presenting = False
            self.anim_from = None
            self.feedback_dir = None
            all_paid = set(self.booths).issubset(self.paid)
            if self.pos in self.exits and (not LEVELS[self.level_index].get("all_booths") or all_paid):
                self.next_level()
            self.complete_action()
            return

        if aid in ACTION_DIR:
            d = ACTION_DIR[aid]
            self.anim_from = self.pos
            moved = self._press(d)
            self.feedback_dir = None if moved else d
        self.presenting = True

        # Wrong offerings can make the exit unreachable, but never kill the run.  The dark
        # floor and grey body make the dead end visible; RESET restores the current level.
        on_unpaid_booth = self.pos in self.booths and self.pos not in self.paid
        self.stranded = (not on_unpaid_booth
                         and (self.pos, self.limbs, self.paid) not in self.good)
