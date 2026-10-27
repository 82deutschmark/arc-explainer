# Author: Claude Opus 5
# Date: 2026-08-27 09:40 (revised 2026-09-02 -- the action budget is gone; the beam
#   snapping is the loss; every counter is now a physical object on the board)
# PURPOSE: bq01 "Balance" -- an ARC-AGI-3 environment. Blocks are carried from a supply
#   yard onto the pans of a balance scale; a level clears when the beam is released and
#   hangs level with the supply used up. A block's weight is its AREA in cells (never a
#   printed number -- ARC bans glyphs), so early levels are read directly off the geometry.
#   From the middle of the game a DENSE block appears whose weight is not its size, and the
#   only way to learn its true value is to weigh it against blocks of known weight and chain
#   the results. That transitive, comparison-driven inference is the cognitive demand;
#   nothing in the ~300-game corpus tests it. Implements the arcengine ARCBaseGame
#   contract; consumed by the Pyodide browser player, the CLI agent and the duck-harness
#   bundle.
#   Revision: the ARC-3 team found all our games lose by a budget counter and show pressure
#   as bars and pips. This one now has no budget, no bar and no pip row. Each beam arm
#   carries a scribed tolerance mark; a release that overloads a pan SNAPS the arm at the
#   mark and the level is lost. The supply that must go aboard is shown by the yard itself
#   (it has to be emptied) plus, on levels where one block stays behind, a holding bay that
#   has to be filled. Rationed weighings are a rack of counterweights on the stand that is
#   used up one per release; when the last is gone and the beam is still not level, the
#   pivot gives and the beam falls -- the same loss, the same picture.
# SRP/DRY check: Pass -- self-contained environment. The three catalogued "weight" games
#   (wp01, pw01, vt01) are sokoban pressure-plate puzzles with a threshold, not balances:
#   no relative magnitude, no comparison of two sides, nothing to reuse.
"""Balance -- load the pans until the beam hangs level.

Click a block to pick it up, click a pan to drop it in, click a block already on a pan to
take it back. The beam is LATCHED while you rearrange: press ACTION5 to release it and
see which way it goes. A level clears when the beam is released, every pan carries at
least one block, the two sides of every beam weigh the same, the yard is empty, and --
where the yard has a holding bay -- the bay holds its one block.

A block's weight is the number of cells it is built from -- count the bright pips. Orange
riveted blocks are the exception: their weight is NOT their size. Usually they are heavier
than they look; by the last level one of them is lighter. The only way to find out is to put
one on a pan and weigh it against blocks you already know.

Each arm of the beam is scribed with a white tolerance mark. The stretch of arm between
the pivot and the mark turns orange as a pan's visible load nears what the arm can bear
and red when it is past it; release with a pan over the limit and the arm snaps at the
mark, the pan falls, and the level is lost. That is the only way to lose -- and on the
levels where weighings are rationed, the ration is a rack of counterweights on the stand,
one spent per release; when the rack is empty and the beam still is not level, the pivot
gives and the beam falls, which is the same loss.

8 levels, each adding exactly one rule. Fully deterministic -- no RNG anywhere.
"""

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ---------------------------------------------------------------------------
# Palette. The catalogued corpus is 60% greyscale and maroon is 0.0% of official
# pixels, so this game is built on the unused end: a maroon field, magenta and orange
# objects, purple apparatus. Greys and black appear only as structure -- the rule line
# under the yard, the 1px gutter that keeps adjacent blocks countable, dead sockets, and
# a beam that has broken. Every distinction below is also carried by shape or position.
# ---------------------------------------------------------------------------

C_WHITE, C_LGRAY, C_GRAY, C_DGRAY, C_VDGRAY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_LMAGENTA, C_RED, C_BLUE, C_LBLUE = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_MAROON, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

FIELD = C_MAROON            # the board itself
RULE = C_BLACK              # gutters, gridlines, the yard divider, a splintered break
APPARATUS = C_PURPLE        # beam, pivot, hangers, counterweights
SOCKET = C_VDGRAY           # outline of a block that has left the yard
DEAD = C_VDGRAY             # a beam that has snapped

BODY = (C_MAGENTA, C_ORANGE)      # honest, dense
PIP = (C_LMAGENTA, C_YELLOW)      # one pip per cell -> the weight is countable
SELECT_RING = C_YELLOW
LATCH = C_YELLOW

PAN_LATCHED, PAN_HEAVY, PAN_LIGHT, PAN_LEVEL = C_PURPLE, C_RED, C_LBLUE, C_GREEN
NOTCH = C_WHITE                   # the tolerance mark scribed on each arm
ARM_NEAR, ARM_OVER = C_ORANGE, C_RED   # the arm between pivot and mark, by visible load
BAY_EMPTY, BAY_FULL = C_YELLOW, C_GREEN

# ---------------------------------------------------------------------------
# Geometry. Two layouts: one beam (levels 1-5) and two stacked beams (6-8).
# ---------------------------------------------------------------------------

CELL = 3                    # pixels per weight-cell
YARD_W = 21                 # yard width in cells (== 63px)
PAN_CX = (15, 48)           # x of the two hang points; the stand sits midway
PIVOT_X = (PAN_CX[0] + PAN_CX[1]) // 2
COL_W = 3                   # width of the central stand
BEAM_X0, BEAM_X1 = 8, 55    # the beam is drawn past its hang points
TOL_SCALE = 2               # weight units per pixel of arm, pivot to tolerance mark

# One beam (levels 1-5) or two stacked beams sharing one stand (6-8). Every value is
# chosen so the lowest dish at full tilt still clears the yard divider, and so the upper
# beam's dish never reaches the lower beam's stroke. "beams" entries are (y, tilt
# amplitude, extra fall of a snapped pan below full tilt). "bay" is the holding bay's
# size in cells; "rack" is where the counterweights sit (x0, y0 of the bottom row, plate).
GEO = {
    1: {"beams": [(16, 5, 1)], "drop": 4, "tray_h": 4, "tray_w": 8,
        "yard_y": 41, "yard_rows": 7, "bay": (5, 3), "rack": (22, 9, True)},
    2: {"beams": [(9, 3, 0), (29, 3, 1)], "drop": 2, "tray_h": 3, "tray_w": 9,
        "yard_y": 47, "yard_rows": 5, "bay": (5, 2), "rack": (22, 3, False)},
}

RACK_COLS = 6
SWING_FRAMES = 3            # the beam visibly swings into its answer
SNAP_FRAMES = 4             # a snapped arm visibly falls

# ---------------------------------------------------------------------------
# Block shapes. A block of weight w is built from w cells, so its AREA is its weight and
# a human reads it by counting. Shapes stay <= 6 cells wide; only weights above 12 are
# three cells tall, and those never appear on the two-beam layout.
# ---------------------------------------------------------------------------

SHAPES = {
    1: ("#",),
    2: ("##",),
    3: ("###",),
    4: ("##", "##"),
    5: ("###", "##."),
    6: ("###", "###"),
    7: ("####", "###."),
    8: ("####", "####"),
    9: ("#####", "####."),
    10: ("#####", "#####"),
    11: ("######", "#####."),
    12: ("######", "######"),
    13: ("#####", "#####", "###.."),
    14: ("#####", "#####", "####."),
    15: ("#####", "#####", "#####"),
    16: ("######", "######", "####.."),
    17: ("######", "######", "#####."),
    18: ("######", "######", "######"),
}


def shape_of(size):
    rows = SHAPES[size]
    cells = frozenset((x, y) for y, row in enumerate(rows)
                      for x, ch in enumerate(row) if ch == "#")
    return max(len(r) for r in rows), len(rows), cells


# ---------------------------------------------------------------------------
# Levels. Each block is (visible_size, true_weight); they differ only for DENSE blocks.
# "quota" is how many blocks must be aboard; the rest (0 or 1) must sit in the holding
#   bay, and the bay is drawn only when there is something to leave behind.
# "weighs" caps the number of releases (0 = unlimited) -- the counterweight rack.
# "limit" is what each arm bears, in weight units. Tuned from an exact census of every
#   configuration (see the plan doc): every winning configuration sits 3-4 units under
#   it, so no intended solution can snap the beam, while piling the supply onto one pan
#   always does. Even, because the mark is drawn at TOL_SCALE units per pixel.
#
# Each level adds exactly one rule and keeps every earlier one:
#   1 place a block, release the beam, read the tip
#   2 no single pair balances -- sums must be combined
#   3 one block must stay behind, in the bay, and WHICH one is the puzzle
#   4 a DENSE block: weight is not size, and must be discovered by weighing
#   5 weighings are rationed: the counterweight rack
#   6 a second beam sharing the same supply: balancing one unbalances the other
#   7 two dense blocks at once
#   8 everything, at full size
# ---------------------------------------------------------------------------

LEVELS = [
    {
        # Two identical blocks and two pans. Impossible to get wrong for more than a few
        # actions, and the first release teaches the whole verb set. The limit equals the
        # whole supply, so nothing on this level can snap.
        "name": "First Tip", "scales": 1, "quota": 2, "limit": 12, "weighs": 0,
        "blocks": [(6, 6), (6, 6)],
    },
    {
        # NEW: seven distinct sizes and exactly one split that balances, so a single
        # matching pair is never the answer -- the sides have to be added up. 21 a side;
        # the arm bears 24, and 30% of all configurations are over it.
        "name": "Two Piles", "scales": 1, "quota": 7, "limit": 24, "weighs": 0,
        "blocks": [(13, 13), (10, 10), (9, 9), (4, 4), (3, 3), (2, 2), (1, 1)],
    },
    {
        # NEW: the holding bay appears -- one of the eight blocks has to be left in it,
        # and WHICH one is the puzzle.
        "name": "Leave One", "scales": 1, "quota": 7, "limit": 24, "weighs": 0,
        "blocks": [(13, 13), (9, 9), (7, 7), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1)],
    },
    {
        # NEW: the orange riveted block is DENSE -- two cells but thirteen units. Sizes are
        # now a lie: several splits that look level by area are not, so the value has to be
        # weighed out against blocks of known weight before the level can be solved.
        "name": "Dead Weight", "scales": 1, "quota": 8, "limit": 28, "weighs": 0,
        "blocks": [(9, 9), (7, 7), (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1),
                   (2, 13)],
    },
    {
        # NEW: weighings are rationed -- the rack of eight counterweights on the stand.
        # Scanning candidate values one at a time runs out; halving the interval does not.
        "name": "Few Tries", "scales": 1, "quota": 8, "limit": 30, "weighs": 8,
        "blocks": [(10, 10), (8, 8), (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1),
                   (3, 14)],
    },
    {
        # NEW: a second beam, fed from the same yard. Every block spent settling one beam
        # is a block the other beam no longer has -- balancing becomes a joint constraint
        # rather than one sum.
        "name": "Two Beams", "scales": 2, "quota": 8, "limit": 20, "weighs": 9,
        "blocks": [(9, 9), (7, 7), (6, 6), (4, 4), (3, 3), (2, 2), (1, 1), (2, 16)],
    },
    {
        # NEW: two dense blocks at once, so two unknowns must be pinned down before either
        # beam can be settled -- and one of the nine blocks still has to go in the bay.
        "name": "Both Lie", "scales": 2, "quota": 8, "limit": 26, "weighs": 12,
        "blocks": [(9, 9), (8, 8), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1),
                   (2, 17), (3, 9)],
    },
    {
        # NEW: a dense block can also be LIGHTER than it looks. The wide riveted block
        # weighs three, less than the smallest honest block on the board, which retires
        # the one heuristic that has worked so far ("riveted means heavy") and leaves
        # weighing as the only way to know anything.
        "name": "Full Weight", "scales": 2, "quota": 8, "limit": 22, "weighs": 12,
        "blocks": [(7, 7), (6, 6), (5, 5), (4, 4), (3, 3), (2, 2), (1, 1),
                   (2, 17), (8, 3)],
    },
]


# ---------------------------------------------------------------------------
# Packing. Blocks pile into a tray under gravity and sit in fixed sockets in the yard.
# ---------------------------------------------------------------------------

def pack_tray(items, width, height):
    """Lowest-then-leftmost placement, so a pan reads as a pile. None if it will not fit."""
    occ = [[False] * width for _ in range(height)]
    out = []
    for (w, h, cells) in items:
        spot = None
        for oy in range(height - h, -1, -1):
            for ox in range(0, width - w + 1):
                if all(not occ[oy + cy][ox + cx] for (cx, cy) in cells):
                    spot = (ox, oy)
                    break
            if spot:
                break
        if spot is None:
            return None
        ox, oy = spot
        for (cx, cy) in cells:
            occ[oy + cy][ox + cx] = True
        out.append(spot)
    return out


def pack_yard(items, width, height, gx=1, gy=1):
    """Reading order with a gutter, so every block in the supply is a separate object."""
    occ = [[False] * width for _ in range(height)]
    out = []
    for (w, h, _cells) in items:
        spot = None
        for oy in range(0, height - h + 1):
            for ox in range(0, width - w + 1):
                if all(not occ[y][x]
                       for y in range(oy, min(height, oy + h + gy))
                       for x in range(ox, min(width, ox + w + gx))):
                    spot = (ox, oy)
                    break
            if spot:
                break
        if spot is None:
            return None
        ox, oy = spot
        for y in range(oy, min(height, oy + h + gy)):
            for x in range(ox, min(width, ox + w + gx)):
                occ[y][x] = True
        out.append(spot)
    return out


def spread_yard(items, width, height):
    """Use the whole supply band: widen the gutters until the blocks stop fitting, then
    centre what slack is left. Keeps the board full instead of a tidy heap in one corner.
    A zero gutter is allowed as a last resort: every block still carries its own 1px black
    edge, so adjacent blocks stay separate objects."""
    best = None
    for gy in range(3, -1, -1):
        for gx in range(3, -1, -1):
            slots = pack_yard(items, width, height, gx, gy)
            if slots is not None:
                best = slots
                break
        if best:
            break
    if best is None:
        return None
    used = max(oy + h for (_w, h, _c), (_ox, oy) in zip(items, best))
    off = (height - used) // 2
    return [(ox, oy + off) for (ox, oy) in best]


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

class Bq01Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    # -- primitives ---------------------------------------------------------

    @staticmethod
    def _rect(frame, x, y, w, h, color):
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(64, x + w), min(64, y + h)
        if x1 > x0 and y1 > y0:
            frame[y0:y1, x0:x1] = color

    def _block(self, frame, px, py, cells, dense, ring=False):
        body, pip = BODY[dense], PIP[dense]
        for (cx, cy) in cells:
            x0, y0 = px + cx * CELL, py + cy * CELL
            self._rect(frame, x0, y0, CELL, CELL, body)
            if 0 <= y0 + 1 < 64 and 0 <= x0 + 1 < 64:
                frame[y0 + 1, x0 + 1] = pip
        # A 1px black gutter on the right and bottom of every silhouette edge. Adjacent
        # blocks in a pan therefore always have one dark line between them and stay
        # countable; a dense block rules EVERY cell, which is its second, non-colour tell.
        for (cx, cy) in cells:
            x0, y0 = px + cx * CELL, py + cy * CELL
            if dense or (cx + 1, cy) not in cells:
                self._rect(frame, x0 + CELL - 1, y0, 1, CELL, RULE)
            if dense or (cx, cy + 1) not in cells:
                self._rect(frame, x0, y0 + CELL - 1, CELL, 1, RULE)
        if ring:
            xs = [px + cx * CELL for (cx, _cy) in cells]
            ys = [py + cy * CELL for (_cx, cy) in cells]
            x0, y0 = min(xs) - 1, min(ys) - 1
            w = max(xs) + CELL - x0 + 1
            h = max(ys) + CELL - y0 + 1
            self._rect(frame, x0, y0, w, 1, SELECT_RING)
            self._rect(frame, x0, y0 + h - 1, w, 1, SELECT_RING)
            self._rect(frame, x0, y0, 1, h, SELECT_RING)
            self._rect(frame, x0 + w - 1, y0, 1, h, SELECT_RING)

    # -- panels -------------------------------------------------------------

    def _stand(self, frame):
        """One central column carries every beam -- and gives the two-beam levels a single
        object rather than two floating ones. On rationed levels a rack of counterweights
        sits above the pivot; one is spent per release. When the pivot has given, the
        column's top is drawn broken."""
        g = self.game
        top = g.geo["beams"][0][0] - 2
        bottom = g.geo["yard_y"] - 4
        if g.pivot_failed:
            top += 3
        self._rect(frame, PIVOT_X - COL_W // 2, top, COL_W, bottom - top, APPARATUS)
        self._rect(frame, PIVOT_X - 4, bottom, 9, 2, APPARATUS)
        if g.weigh_max and not g.pivot_failed:
            rx, ry, plate = g.geo["rack"]
            if plate:
                self._rect(frame, rx - 1, ry + CELL, RACK_COLS * CELL + 1, 2, APPARATUS)
            for i in range(g.weigh_left):
                col, row = i % RACK_COLS, i // RACK_COLS
                x, y = rx + col * CELL, ry - row * CELL
                self._rect(frame, x, y, CELL, CELL, APPARATUS)
                self._rect(frame, x + CELL - 1, y, 1, CELL, RULE)
                self._rect(frame, x, y + CELL - 1, CELL, 1, RULE)

    def _arm_color(self, pan):
        """The stretch of arm between pivot and mark, by the pan's VISIBLE load: purple,
        orange from three quarters of the limit, red past it. Never the true load -- the
        beam is the only thing that ever tells the truth about a dense block."""
        g = self.game
        v = g.visible_load(pan)
        if v > g.limit:
            return ARM_OVER
        if v * 4 >= g.limit * 3:
            return ARM_NEAR
        return APPARATUS

    def _scale(self, frame, s):
        g = self.game
        beam_y, amp, _fall = g.geo["beams"][s]
        tray_w = g.geo["tray_w"]
        lift = amp * g.tilt[s] * g.frac
        yl, yr = beam_y + lift, beam_y - lift
        sums = g.scale_sums(s)
        notch = g.limit // TOL_SCALE
        broken = g.broken[s]

        def beam_line(x):
            t = (x - PAN_CX[0]) / (PAN_CX[1] - PAN_CX[0])
            return yl + (yr - yl) * t

        for side in (0, 1):
            pan = 2 * s + side
            x0, top = g.tray_origin(pan)
            rim = top + g.geo["tray_h"] * CELL
            hang_x = PAN_CX[side]
            if g.snapped[pan]:
                hang_y = g.piece_y(pan, hang_x)
                color = PAN_HEAVY
            else:
                hang_y = int(round(yl if side == 0 else yr))
                if g.arrested:
                    color = PAN_LATCHED
                elif sums[0] == sums[1]:
                    color = PAN_LEVEL
                else:
                    color = PAN_HEAVY if (sums[0] > sums[1]) == (side == 0) else PAN_LIGHT

            # cord down to the dish, then the dish itself: two full-height walls and the
            # rim the blocks rest on. The rim colour is the reading; its HEIGHT is the
            # same reading again, so the tip survives any colour confusion.
            self._rect(frame, hang_x, hang_y, 1, max(1, top - hang_y),
                       DEAD if g.snapped[pan] else APPARATUS)
            self._rect(frame, x0 - 2, rim, tray_w * CELL + 4, 2, color)
            self._rect(frame, x0 - 2, rim - 5, 2, 5, color)
            self._rect(frame, x0 + tray_w * CELL, rim - 5, 2, 5, color)
            if g.arrested and not broken:
                # A latched pan hangs level and so does a balanced one; that is the one
                # pair of states colour alone could confuse. Break the rim into dashes so
                # "no reading yet" is a different SHAPE, not just a different hue.
                for x in range(x0 - 2, x0 + tray_w * CELL + 2, 2):
                    self._rect(frame, x, rim, 1, 2, FIELD)

            for i in g.pans[pan]:
                b = g.blocks[i]
                ox, oy = g.pan_pos[pan][i]
                self._block(frame, x0 + ox * CELL, top + oy * CELL, b["cells"],
                            b["dense"], ring=(g.selected == i))

        # the beam last, so it reads as one continuous bar in front of the stand. Each
        # arm carries the tolerance mark; a snapped arm is a stub, a splinter and a fallen
        # piece, all dead grey, with the rest of the beam tipped toward the side that
        # still holds.
        for x in range(BEAM_X0, BEAM_X1 + 1):
            side = 0 if x < PIVOT_X else 1
            pan = 2 * s + side
            d = abs(x - PIVOT_X)
            if g.pivot_failed:
                if d <= 1:
                    continue
                self._rect(frame, x, int(round(g.piece_y(pan, x))) - 1, 1, 3, DEAD)
            elif g.snapped[pan]:
                if d < notch:
                    self._rect(frame, x, int(round(beam_line(x))) - 1, 1, 3, DEAD)
                elif d == notch:
                    self._rect(frame, x, int(round(beam_line(x))) - 1, 1, 3, RULE)
                else:
                    self._rect(frame, x, int(round(g.piece_y(pan, x))) - 1, 1, 3, DEAD)
            else:
                if d == notch:
                    color = NOTCH
                elif 1 <= d < notch:
                    color = DEAD if broken else self._arm_color(pan)
                else:
                    color = DEAD if broken else APPARATUS
                self._rect(frame, x, int(round(beam_line(x))) - 1, 1, 3, color)
        # latch: a clamp across the stand, present only while the beam is held
        if g.arrested and not broken:
            self._rect(frame, PIVOT_X - 3, beam_y + 2, 7, 1, LATCH)
            self._rect(frame, PIVOT_X - 3, beam_y - 3, 7, 1, LATCH)

    def _yard(self, frame):
        g = self.game
        y0 = g.geo["yard_y"]
        self._rect(frame, 0, y0 - 2, 64, 1, RULE)
        for i, b in enumerate(g.blocks):
            ox, oy = b["slot"]
            px, py = ox * CELL, y0 + oy * CELL
            if b["at"] >= 0:                       # dead socket: where it came from
                for (cx, cy) in b["cells"]:
                    self._rect(frame, px + cx * CELL, py + cy * CELL, CELL, CELL, SOCKET)
                    self._rect(frame, px + cx * CELL + 1, py + cy * CELL + 1,
                               CELL - 2, CELL - 2, FIELD)
                continue
            sel = g.selected == i
            self._block(frame, px, py - (2 if sel else 0), b["cells"], b["dense"], ring=sel)

        # the holding bay: an outlined plate at the yard's right end that must hold the
        # block left behind. Yellow while it waits, green once it is filled.
        if g.bay_cap:
            bx, by, bw, bh = g.bay_rect()
            color = BAY_FULL if len(g.bay) >= g.bay_cap else BAY_EMPTY
            self._rect(frame, bx - 1, by - 1, bw + 2, 1, color)
            self._rect(frame, bx - 1, by + bh, bw + 2, 1, color)
            self._rect(frame, bx - 1, by - 1, 1, bh + 2, color)
            self._rect(frame, bx + bw, by - 1, 1, bh + 2, color)
            for i in g.bay:
                b = g.blocks[i]
                ox, oy = g.pan_pos[g.n_pans][i]
                self._block(frame, bx + ox * CELL, by + oy * CELL, b["cells"], b["dense"],
                            ring=(g.selected == i))

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        frame[:, :] = FIELD
        self._stand(frame)
        for s in range(g.n_scales):
            self._scale(frame, s)
        self._yard(frame)
        return frame


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Bq01(ARCBaseGame):
    def __init__(self):
        self.display = Bq01Display(self)

        # on_set_level() runs inside super().__init__(), so every attribute it or the
        # renderer touches has to exist first.
        self.blocks = []
        self.pans = []
        self.pan_pos = []
        self.bay = []
        self.bay_cap = 0
        self.n_scales = 1
        self.n_pans = 2
        self.geo = GEO[1]
        self.quota = 0
        self.limit = 0
        self.selected = None
        self.arrested = True
        self.tilt = [0]
        self.frac = 0.0
        self.weigh_max = self.weigh_left = 0
        self.snapped = [False, False]
        self.broken = [False]
        self.pivot_failed = False
        self.snap_frac = 0.0
        self._swing = 0
        self._snap = 0
        self._pending_win = False

        levels = [Level(sprites=[], grid_size=(64, 64), data=ldef, name=ldef["name"])
                  for ldef in LEVELS]

        super().__init__(
            "bq",
            levels,
            Camera(0, 0, 64, 64, C_BLACK, C_BLACK, [self.display]),
            False,
            len(levels),
            [5, 6],              # 5 = release the beam, 6 = click a block, a pan or the bay
        )

    # -- level setup --------------------------------------------------------

    def on_set_level(self, level: Level) -> None:
        ldef = LEVELS[self.level_index]
        self.n_scales = ldef["scales"]
        self.n_pans = 2 * self.n_scales
        self.geo = GEO[self.n_scales]
        self.quota = ldef["quota"]
        self.limit = ldef["limit"]
        self.weigh_max = self.weigh_left = ldef["weighs"]
        self.bay_cap = len(ldef["blocks"]) - ldef["quota"]

        self.blocks = []
        for size, weight in ldef["blocks"]:
            w, h, cells = shape_of(size)
            self.blocks.append({"size": size, "weight": weight, "dense": weight != size,
                                "w": w, "h": h, "cells": cells, "slot": (0, 0), "at": -1})
        width = YARD_W - (self.geo["bay"][0] + 1 if self.bay_cap else 0)
        slots = spread_yard([(b["w"], b["h"], b["cells"]) for b in self.blocks],
                            width, self.geo["yard_rows"])
        if slots is None:
            raise ValueError(f"level {self.level_index}: supply does not fit the yard")
        for b, slot in zip(self.blocks, slots):
            b["slot"] = slot

        self.pans = [[] for _ in range(self.n_pans + 1)]      # the last one is the bay
        self.pan_pos = [{} for _ in range(self.n_pans + 1)]
        self.bay = self.pans[self.n_pans]
        self.tilt = [0] * self.n_scales
        self.arrested = True
        self.frac = 0.0
        self.snapped = [False] * self.n_pans
        self.broken = [False] * self.n_scales
        self.pivot_failed = False
        self.snap_frac = 0.0
        self._swing = 0
        self._snap = 0
        self._pending_win = False
        # One block starts in hand, so the very first click on a pan does something
        # visible rather than being spent discovering that a block must be picked first.
        self.selected = 0 if self.blocks else None

    # -- queries ------------------------------------------------------------

    def placed_count(self):
        return sum(1 for b in self.blocks if 0 <= b["at"] < self.n_pans)

    def scale_sums(self, s):
        return (sum(self.blocks[i]["weight"] for i in self.pans[2 * s]),
                sum(self.blocks[i]["weight"] for i in self.pans[2 * s + 1]))

    def true_load(self, pan):
        return sum(self.blocks[i]["weight"] for i in self.pans[pan])

    def visible_load(self, pan):
        return sum(self.blocks[i]["size"] for i in self.pans[pan])

    def bay_rect(self):
        bw, bh = self.geo["bay"]
        return (YARD_W - bw) * CELL, self.geo["yard_y"], bw * CELL, bh * CELL

    def fallen_hang(self, pan):
        beam_y, amp, fall = self.geo["beams"][pan // 2]
        return beam_y + amp + fall

    def piece_y(self, pan, x):
        """Height of a snapped arm's fallen piece at column x: a straight bar that leaves
        the break a little above the hang point and dips below it toward the beam's end,
        falling from the level beam to the floor over the snap animation."""
        s, side = pan // 2, pan % 2
        beam_y = self.geo["beams"][s][0]
        hang_x = PAN_CX[side]
        end_x = BEAM_X0 if side == 0 else BEAM_X1
        start_x = PIVOT_X - (self.limit // TOL_SCALE) * (1 if side == 0 else -1)
        if self.pivot_failed:
            start_x = PIVOT_X - 2 if side == 0 else PIVOT_X + 2
        hang = beam_y + (self.fallen_hang(pan) - beam_y) * self.snap_frac
        # straight line through (start_x, hang - 2) and (end_x, hang + 2)
        t = (x - start_x) / (end_x - start_x) if end_x != start_x else 0.0
        y = (hang - 2) + 4 * t
        if x == hang_x:
            return int(round(y))
        return y

    def tray_origin(self, pan):
        """Top-left of a pan's cell grid, following the beam wherever it currently hangs
        -- or the fallen piece of a snapped arm. The bay is a fixed plate in the yard."""
        if pan == self.n_pans:
            bx, by, _bw, _bh = self.bay_rect()
            return bx, by
        s, side = pan // 2, pan % 2
        beam_y, amp, _fall = self.geo["beams"][s]
        x0 = PAN_CX[side] - self.geo["tray_w"] * CELL // 2
        if self.snapped[pan]:
            hang_y = self.piece_y(pan, PAN_CX[side])
        else:
            lift = amp * self.tilt[s] * self.frac
            hang_y = int(round(beam_y + (lift if side == 0 else -lift)))
        return x0, hang_y + self.geo["drop"]

    def block_origin(self, i):
        b = self.blocks[i]
        if b["at"] < 0:
            ox, oy = b["slot"]
            return ox * CELL, self.geo["yard_y"] + oy * CELL - (2 if self.selected == i else 0)
        x0, top = self.tray_origin(b["at"])
        ox, oy = self.pan_pos[b["at"]][i]
        return x0 + ox * CELL, top + oy * CELL

    def _block_at(self, x, y):
        for i, b in enumerate(self.blocks):
            px, py = self.block_origin(i)
            for (cx, cy) in b["cells"]:
                if (px + cx * CELL <= x < px + (cx + 1) * CELL
                        and py + cy * CELL <= y < py + (cy + 1) * CELL):
                    return i
        return None

    def _tray_at(self, x, y):
        for pan in range(self.n_pans):
            x0, top = self.tray_origin(pan)
            rim = top + self.geo["tray_h"] * CELL
            if (x0 - 2 <= x < x0 + self.geo["tray_w"] * CELL + 2
                    and top - 2 <= y <= rim + 1):
                return pan
        if self.bay_cap:
            bx, by, bw, bh = self.bay_rect()
            if bx - 1 <= x <= bx + bw and by - 1 <= y <= by + bh:
                return self.n_pans
        return None

    def settled(self):
        """Every beam carries something on both sides and weighs the same either side."""
        for s in range(self.n_scales):
            left, right = self.scale_sums(s)
            if not self.pans[2 * s] or not self.pans[2 * s + 1] or left != right:
                return False
        return True

    # -- mutation -----------------------------------------------------------

    def _repack(self, pan):
        items = [(self.blocks[i]["w"], self.blocks[i]["h"], self.blocks[i]["cells"])
                 for i in self.pans[pan]]
        if pan == self.n_pans:
            w, h = self.geo["bay"]
        else:
            w, h = self.geo["tray_w"], self.geo["tray_h"]
        spots = pack_tray(items, w, h)
        if spots is None:
            return False
        self.pan_pos[pan] = {i: spots[k] for k, i in enumerate(self.pans[pan])}
        return True

    def _arrest(self):
        """Any change to the load re-latches the beam: the last reading is now stale."""
        self.arrested = True
        self.frac = 0.0

    def place(self, i, pan):
        if self.blocks[i]["at"] >= 0:
            return False
        if pan == self.n_pans and len(self.bay) >= self.bay_cap:
            return False                            # the bay holds exactly its share
        self.pans[pan].append(i)
        if not self._repack(pan):                  # the pan is physically full
            self.pans[pan].pop()
            self._repack(pan)
            return False
        self.blocks[i]["at"] = pan
        self.selected = None
        self._arrest()
        return True

    def take_back(self, i):
        pan = self.blocks[i]["at"]
        if pan < 0:
            return False
        self.pans[pan].remove(i)
        self.blocks[i]["at"] = -1
        self._repack(pan)
        self.selected = i
        self._arrest()
        return True

    def _handle_click(self, x, y):
        hit = self._block_at(x, y)
        if hit is not None:
            if self.blocks[hit]["at"] >= 0:
                self.take_back(hit)
            else:
                self.selected = None if self.selected == hit else hit
            return
        pan = self._tray_at(x, y)
        if pan is not None and self.selected is not None:
            self.place(self.selected, pan)

    def _snap_arms(self, over):
        """Break every arm in `over` (a per-pan list). The rest of each broken beam tips
        toward whichever side still holds; the fallen pieces animate down over SNAP_FRAMES
        and then the level is lost."""
        self.snapped = list(over)
        for s in range(self.n_scales):
            a, b = over[2 * s], over[2 * s + 1]
            if a or b:
                self.broken[s] = True
                self.tilt[s] = 0 if a == b else (-1 if a else 1)
        self.arrested = False
        self.frac = 1.0
        self.snap_frac = 0.0
        self._snap = SNAP_FRAMES
        self._pending_win = False

    def _release(self):
        """Unlatch: the beam swings to the true reading and the level is judged -- unless
        a pan is over what its arm bears, in which case the arm snaps instead."""
        over = [self.true_load(p) > self.limit for p in range(self.n_pans)]
        if any(over):
            self._snap_arms(over)
            return
        self.arrested = False
        self.frac = 0.0
        for s in range(self.n_scales):
            left, right = self.scale_sums(s)
            self.tilt[s] = 1 if left > right else (-1 if left < right else 0)
        if self.weigh_max:
            self.weigh_left -= 1
        self._pending_win = (self.settled() and self.placed_count() == self.quota
                             and len(self.bay) == self.bay_cap)
        self._swing = SWING_FRAMES

    # -- engine entry point -------------------------------------------------

    def _resolve(self):
        if self._pending_win:
            self.next_level()
            self.complete_action()
            return
        if self.weigh_max and self.weigh_left <= 0:
            # the rack is empty and the beam still is not level: the pivot gives and the
            # whole beam falls -- the same loss as a snapped arm, drawn the same way
            self.weigh_left = 0
            self.pivot_failed = True
            self._snap_arms([True] * self.n_pans)
            for s in range(self.n_scales):
                self.tilt[s] = 0
            return                                 # animate; the snap branch finishes it
        self.complete_action()

    def step(self) -> None:
        # A release animates: the beam swings over a few frames so the direction it goes
        # is read from motion as well as from colour; a snapped arm falls over a few more.
        # Both bounded, so the browser never hangs.
        if self._snap > 0:
            self._snap -= 1
            self.snap_frac = 1.0 - self._snap / SNAP_FRAMES
            if self._snap == 0:
                self.lose()
                self.complete_action()
            return
        if self._swing > 0:
            self._swing -= 1
            self.frac = 1.0 - self._swing / SWING_FRAMES
            if self._swing == 0:
                self._resolve()
            return

        aid = self.action.id.value
        if aid == 6:
            self._handle_click(int(self.action.data.get("x", 0)),
                               int(self.action.data.get("y", 0)))
        elif aid == 5:
            self._release()
            return                                 # animate; _resolve() finishes it

        self.complete_action()
