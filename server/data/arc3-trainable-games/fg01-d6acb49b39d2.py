# Fog - the ground is hidden and the sensor lies.
#
# Every cell is either treasure or a mine. Move the cursor with the d-pad;
# ACTION5 PROBES the cell under it, cheaply and unreliably; ACTION6 DIGS it,
# which is final. Bank the level's quota of treasure before you run out of
# lives (or budget) and you clear it.
#
# The other three games in this set randomise the WORLD. This one randomises
# the OBSERVATION: the board holds still while you look at it, and what you are
# told about it is simply wrong some of the time. The only defence is to probe
# the same cell more than once and let the tally settle -- so every cell carries
# its own history, drawn as a little block of readings, green for "treasure" and
# red for "mine". Reading those tallies IS the game.
#
# Which makes the real question an economic one rather than a perceptual one:
# every extra confirmation costs an action, and the level is scored on actions.
# How sure is it worth being?
#
# The ladder walks through the ways a sensor can betray you:
#
#   truthful -> noisy -> noisier, on thinner ground -> expensive to re-check
#   -> biased, so that its false alarms mean much less than its green lights
#   -> reliable on one half of the map and near-useless on the other
#   -> mines that CLUSTER, so a confirmed mine is evidence about its neighbours
#   -> mines that MOVE, which puts a shelf life on everything you knew.

import os
import random

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# --- Colors (ARC-3 palette indices) ---
C_WHITE   = 0
C_LGRAY   = 1
C_GRAY    = 2
C_DGRAY   = 3
C_VDARK   = 4
C_BLACK   = 5
C_RED     = 8
C_LBLUE   = 10
C_YELLOW  = 11
C_MAROON  = 13
C_GREEN   = 14

# --- Layout ---
STRIP_H = 12        # lives / quota / budget
CELL = 6            # pixels per grid cell (4x4 usable interior)
GRID_TOP = STRIP_H
GRID_H = 64 - GRID_TOP
MAX_READS = 16      # readings a cell can display, one per interior pixel

# --- Cell classes ---
K_PRIZE, K_MINE = 0, 1
READ_COLOR = {K_PRIZE: C_GREEN, K_MINE: C_RED}

DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}

# ============================================================================
# Levels
# ============================================================================
# Each spec:
#   w, h        grid size in cells
#   density     fraction of cells holding treasure (the rest are mines)
#   quota       treasure needed to clear the level
#   acc         chance a probe reports the truth
#   acc_right   None | a different accuracy for the right half of the board
#   fp          0..1 skews the sensor's errors toward crying "mine"
#   lives       mines you can dig and survive
#   budget      None | total actions before the level is lost
#   probe_cost  actions burned by one probe
#   cluster     True if mines are generated in contiguous blobs
#   move_p      chance per turn that a mine shifts to a neighbouring cell
#
# Every level adds exactly one new idea to the one before it.

LEVELS = [
    # 1 -- a truthful sensor on a small board. Probe, read, dig. Nothing else.
    dict(name="Clear Eyes", w=6, h=5, density=0.60, quota=6, acc=1.0, acc_right=None,
         fp=0.0, lives=3, budget=None, probe_cost=1, cluster=False, move_p=0.0),

    # 2 -- NEW: a bigger board and a bigger quota, same honest sensor. The only
    #      new pressure is that walking the cursor around is not free.
    dict(name="More Ground", w=8, h=6, density=0.55, quota=9, acc=1.0, acc_right=None,
         fp=0.0, lives=3, budget=None, probe_cost=1, cluster=False, move_p=0.0),

    # 3 -- NEW: the sensor lies about one reading in five. A single probe is now
    #      a rumour, and the tally inside the cell is the evidence.
    dict(name="The Sensor Lies", w=8, h=6, density=0.55, quota=9, acc=0.80, acc_right=None,
         fp=0.0, lives=3, budget=None, probe_cost=1, cluster=False, move_p=0.0),

    # 4 -- NEW: it lies more, and the ground is thinner -- fewer cells are worth
    #      digging, so a green light on its own is worth much less than it was.
    dict(name="Worse Odds", w=8, h=6, density=0.45, quota=10, acc=0.70, acc_right=None,
         fp=0.0, lives=3, budget=None, probe_cost=1, cluster=False, move_p=0.0),

    # 5 -- NEW: two lives instead of three, on the same bad odds. Being wrong
    #      stops being an inconvenience and starts being the thing that ends runs.
    dict(name="Thin Margin", w=8, h=6, density=0.45, quota=10, acc=0.72, acc_right=None,
         fp=0.0, lives=2, budget=None, probe_cost=1, cluster=False, move_p=0.0),

    # 6 -- NEW: an action budget. Probing until certain is no longer affordable,
    #      so the level asks exactly how much confidence is worth paying for.
    dict(name="Certainty Costs", w=8, h=6, density=0.50, quota=11, acc=0.72, acc_right=None,
         fp=0.0, lives=2, budget=150, probe_cost=1, cluster=False, move_p=0.0),

    # 7 -- NEW: probes cost double. Same question, priced higher: the right
    #      number of confirmations drops, and the right threshold with it.
    dict(name="Expensive Looks", w=8, h=6, density=0.50, quota=11, acc=0.75, acc_right=None,
         fp=0.0, lives=2, budget=190, probe_cost=2, cluster=False, move_p=0.0),

    # 8 -- NEW: a biased sensor. Its mistakes overwhelmingly cry "mine", so a
    #      red reading means far less than a green one does. Trusting the two
    #      equally throws away most of the board.
    dict(name="Crying Wolf", w=8, h=6, density=0.50, quota=11, acc=0.72, acc_right=None,
         fp=0.85, lives=2, budget=170, probe_cost=1, cluster=False, move_p=0.0),

    # 9 -- NEW: the sensor is reliable on the left of the board and nearly
    #      useless on the right. Same probe, very different worth -- and the
    #      boundary is visible in the colour of the fog.
    dict(name="Half Blind", w=8, h=6, density=0.50, quota=11, acc=0.93, acc_right=0.60,
         fp=0.3, lives=2, budget=180, probe_cost=1, cluster=False, move_p=0.0),

    # 10 -- NEW: mines come in clumps. A confirmed mine is now evidence about
    #       its neighbours, so the cheapest probe is often the one not taken.
    dict(name="They Cluster", w=8, h=6, density=0.48, quota=11, acc=0.75, acc_right=None,
         fp=0.3, lives=2, budget=180, probe_cost=1, cluster=True, move_p=0.0),

    # 11 -- NEW: mines MOVE. Evidence now has a shelf life, and a cell you
    #       cleared twenty turns ago is one you no longer know anything about.
    dict(name="They Move", w=8, h=6, density=0.50, quota=11, acc=0.78, acc_right=None,
         fp=0.2, lives=2, budget=200, probe_cost=1, cluster=False, move_p=0.18),

    # 12 -- all of it: clustered mines that wander, a sensor that is biased and
    #       only trustworthy on one side, two lives, and a budget.
    dict(name="Total Fog", w=8, h=6, density=0.48, quota=12, acc=0.90, acc_right=0.62,
         fp=0.5, lives=2, budget=210, probe_cost=1, cluster=True, move_p=0.12),
]


def generate(spec, rng):
    """Lay out one board. New treasure and mine positions on every entry."""
    w, h = spec["w"], spec["h"]
    total = w * h
    n_mines = max(1, min(total - spec["quota"], round(total * (1.0 - spec["density"]))))
    cells = [[K_PRIZE] * w for _ in range(h)]
    free = [(x, y) for y in range(h) for x in range(w)]
    rng.shuffle(free)

    mines = []
    if spec["cluster"]:
        # Grow mines in short contiguous runs, so finding one is real evidence
        # about the cells beside it.
        while len(mines) < n_mines and free:
            seed = free.pop()
            blob, frontier = [seed], [seed]
            while frontier and len(blob) < rng.randint(2, 3) and len(mines) + len(blob) <= n_mines:
                cx, cy = frontier.pop()
                for dx, dy in DIRS.values():
                    nb = (cx + dx, cy + dy)
                    if nb in free and len(mines) + len(blob) < n_mines:
                        free.remove(nb)
                        blob.append(nb)
                        frontier.append(nb)
            mines.extend(blob[:max(0, n_mines - len(mines))])
    else:
        mines = [free.pop() for _ in range(min(n_mines, len(free)))]

    for (x, y) in mines:
        cells[y][x] = K_MINE
    return cells, set(mines)


# ============================================================================
# Display
# ============================================================================

class Fg01Display(RenderableUserDisplay):
    def __init__(self, game: "Fg01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        frame[:, :] = C_BLACK

        # lives (left)
        for i in range(g.lives_max):
            x = 1 + i * 5
            if x + 4 > 18:
                break
            frame[2:6, x:x + 4] = C_RED if i < g.lives else C_VDARK
        # quota still to fill (middle)
        for i in range(g.quota):
            x = 20 + i * 3
            if x + 2 > 44:
                break
            frame[2:6, x:x + 2] = C_GREEN if i < g.collected else C_VDARK
        # budget (right)
        if g.budget_max:
            x0, x1 = 46, 63
            width = x1 - x0
            frame[2:6, x0:x1] = C_VDARK
            left = max(0, min(width, round(width * g.budget_left / g.budget_max)))
            if left:
                low = g.budget_left <= max(5, g.budget_max // 5)
                frame[2:6, x0:x0 + left] = C_RED if low else C_LBLUE

        ox, oy = g.off_x, g.off_y
        for cy in range(g.h):
            for cx in range(g.w):
                px, py = ox + cx * CELL, oy + cy * CELL

                # A visibly different fog on the half where the sensor is weak,
                # so the accuracy split is discoverable rather than invisible.
                weak = g.acc_right is not None and cx >= g.w // 2
                frame[py:py + CELL, px:px + CELL] = C_VDARK if weak else C_BLACK

                if (cx, cy) in g.dug:
                    fill = C_YELLOW if g.cells[cy][cx] == K_PRIZE else C_MAROON
                    frame[py + 1:py + CELL - 1, px + 1:px + CELL - 1] = fill
                    if fill == C_MAROON:
                        frame[py + 2:py + CELL - 2, px + 2:px + CELL - 2] = C_RED
                    continue

                reads = g.reads.get((cx, cy), [])
                frame[py + 1:py + CELL - 1, px + 1:px + CELL - 1] = (
                    C_GRAY if not reads else C_BLACK)
                for j, r in enumerate(reads[:MAX_READS]):
                    frame[py + 1 + (j // 4), px + 1 + (j % 4)] = READ_COLOR[r]

        cx, cy = g.cursor
        px, py = ox + cx * CELL, oy + cy * CELL
        frame[py, px:px + CELL] = C_WHITE
        frame[py + CELL - 1, px:px + CELL] = C_WHITE
        frame[py:py + CELL, px] = C_WHITE
        frame[py:py + CELL, px + CELL - 1] = C_WHITE

        return frame


# ============================================================================
# Game
# ============================================================================

class Fg01(ARCBaseGame):
    def __init__(self):
        # Fixed master seed, re-drawn on every level entry, so the board and the
        # sensor's lies are new each time (nothing to memorise) while two
        # harness runs still meet the identical sequence of luck.
        # FG01_SEED re-seeds it, for calibration sweeps only.
        self._master_rng = random.Random(int(os.getenv("FG01_SEED", 0xF0661)))
        self._rng = random.Random(0)

        self.display = Fg01Display(self)

        self.cells = []
        self.w = self.h = 0
        self.mines = set()
        self.dug = set()
        self.reads = {}
        self.cursor = (0, 0)
        self.quota = self.collected = 0
        self.lives = self.lives_max = 0
        self.budget_left = self.budget_max = 0
        self.probe_cost = 1
        self.acc = 1.0
        self.acc_right = None
        self.fp = 0.0
        self.move_p = 0.0
        self.off_x = self.off_y = 0

        levels = [
            Level(sprites=[], grid_size=(64, 64), data=spec, name=spec["name"])
            for spec in LEVELS
        ]

        super().__init__(
            "fg",
            levels,
            Camera(0, 0, 64, 64, C_BLACK, C_BLACK, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5, 6],  # move x4, probe, dig
        )

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS[self.level_index]
        self._rng = random.Random(self._master_rng.getrandbits(48))

        self.w, self.h = spec["w"], spec["h"]
        self.cells, self.mines = generate(spec, self._rng)
        self.dug = set()
        self.reads = {}
        self.cursor = (0, 0)
        self.quota = spec["quota"]
        self.collected = 0
        self.lives = self.lives_max = spec["lives"]
        self.budget_max = spec["budget"] or 0
        self.budget_left = self.budget_max
        self.probe_cost = spec["probe_cost"]
        self.acc = spec["acc"]
        self.acc_right = spec["acc_right"]
        self.fp = spec["fp"]
        self.move_p = spec["move_p"]

        self.off_x = (64 - self.w * CELL) // 2
        self.off_y = GRID_TOP + (GRID_H - self.h * CELL) // 2

    # -- sensor ------------------------------------------------------------

    def accuracy_at(self, x):
        """The sensor is not equally trustworthy everywhere."""
        if self.acc_right is not None and x >= self.w // 2:
            return self.acc_right
        return self.acc

    def error_rates(self, x):
        """(P say MINE | is PRIZE, P say PRIZE | is MINE).

        `fp` tilts the same total error rate toward false alarms, which is what
        makes a red reading cheap and a green reading expensive on some levels.
        """
        err = 1.0 - self.accuracy_at(x)
        false_alarm = min(0.95, err * (1.0 + self.fp))
        false_clear = max(0.0, err * (1.0 - self.fp))
        return false_alarm, false_clear

    def _observe(self, cx, cy):
        truth = self.cells[cy][cx]
        false_alarm, false_clear = self.error_rates(cx)
        if truth == K_PRIZE:
            return K_MINE if self._rng.random() < false_alarm else K_PRIZE
        return K_PRIZE if self._rng.random() < false_clear else K_MINE

    def _drift_mines(self):
        """Mines wander, which quietly invalidates old readings."""
        if not self.move_p or self._rng.random() >= self.move_p:
            return
        movable = [m for m in self.mines if m not in self.dug]
        if not movable:
            return
        mx, my = self._rng.choice(movable)
        options = [(mx + dx, my + dy) for dx, dy in DIRS.values()]
        options = [(x, y) for (x, y) in options
                   if 0 <= x < self.w and 0 <= y < self.h
                   and (x, y) not in self.dug and self.cells[y][x] == K_PRIZE]
        if not options:
            return
        nx, ny = self._rng.choice(options)
        self.cells[my][mx] = K_PRIZE
        self.cells[ny][nx] = K_MINE
        self.mines.discard((mx, my))
        self.mines.add((nx, ny))

    def _spend(self, amount):
        if self.budget_max:
            self.budget_left = max(0, self.budget_left - amount)

    # -- main loop ---------------------------------------------------------

    def step(self) -> None:
        aid = self.action.id.value
        cx, cy = self.cursor

        if aid in DIRS:
            dx, dy = DIRS[aid]
            self.cursor = (max(0, min(self.w - 1, cx + dx)),
                           max(0, min(self.h - 1, cy + dy)))
            self._spend(1)

        elif aid == 5:
            if (cx, cy) not in self.dug:
                self.reads.setdefault((cx, cy), []).append(self._observe(cx, cy))
            self._spend(self.probe_cost)

        elif aid == 6:
            self._spend(1)
            if (cx, cy) not in self.dug:
                self.dug.add((cx, cy))
                if self.cells[cy][cx] == K_PRIZE:
                    self.collected += 1
                else:
                    self.lives -= 1
                    self.mines.discard((cx, cy))

        else:
            self.complete_action()
            return

        self._drift_mines()

        if self.collected >= self.quota:
            self.next_level()
            self.complete_action()
            return

        if self.lives <= 0 or (self.budget_max and self.budget_left <= 0):
            self.lose()

        self.complete_action()
