# Author: Claude Sonnet 5.5
# Date: 2026-10-13
# PURPOSE: eh01 "Echo", second version. A walker in a dark corridor. The corridor's shape is lit
#   but what lies IN each cell is dark: a purple field under a black stipple. Walking never
#   shows you anything. SPACE is the lantern: it steps you back the way you just came and lights
#   the cell you stood on, and whatever it held shows up (a key flies into the slots along the
#   top, a ring opens, a pit shows its rim). The cell you land on burns one of its two orange
#   marks for it. At no marks a cell
#   scars and may never be entered again. Walking on through a dark pit drops you back to the
#   entrance; looking at it from the next cell is safe. Light every key, light the ring, walk in.
#   If the way is cut so the level can no longer be won, the walker dies on the spot (a short
#   visible fade) and the level starts again as entered.
#   Changes from the first version: the retreat moved from ACTION7 (Undo on the site) to
#   ACTION5; walking forward no longer lights anything, so the lantern is the only way to see;
#   every effect is animated (the walker slides back, the cell flares, the mark burns, the key
#   flies to the top row); known ground is green and dark ground purple (pink now only means
#   a pit rim or a shut ring); the walker is a small creature, not a diamond.
# SRP/DRY check: Pass -- self-contained. Rule state lives in Core, which the solver imports.
"""Echo -- the lantern is how you see.

ACTION1-4 walk up/down/left/right. ACTION5 (Space) steps back the way you just came and lights
the cell you left. No text, no counters: the slots along the top are the keys, the ring at the
right of them is the way out. RESET restarts the level.
"""

import copy
from collections import deque

import numpy as np
from arcengine import ARCBaseGame, Camera, GameState, Level, RenderableUserDisplay

# ---------------------------------------------------------------------------
# Palette (ARC-3 indices)
# ---------------------------------------------------------------------------

C_WHITE, C_LGRAY, C_GRAY, C_DGRAY, C_VDGRAY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_LMAGENTA, C_RED, C_BLUE, C_LBLUE = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_MAROON, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

C_ROCK = C_MAROON      # the stone the corridor is cut through
C_DARK = C_PURPLE      # a cell whose contents are unknown
C_NOISE = C_BLACK      # the stipple over it
C_LIT = C_GREEN        # ground you have lit
C_MARK = C_ORANGE      # a remaining retreat
C_SCAR = C_ORANGE      # a spent cell (filled, crossed)
C_KEY = C_YELLOW
C_SHUT = C_MAGENTA     # the ring while a key is still out
C_OPEN = C_LBLUE       # the ring once every key is in
C_PIT = C_BLACK
C_RIM = C_MAGENTA      # pink: sends you back
C_YOU = C_BLUE
C_NO = C_RED
C_FLARE = C_WHITE

# ---------------------------------------------------------------------------
# Geometry: 7 x 6 cells of 9 px under a 10 px top band (the key slots and the ring).
# ---------------------------------------------------------------------------

GW, GH = 7, 6
CELL = 9
HUD_H = 10
OFFX = (64 - GW * CELL) // 2
OFFY = 64 - GH * CELL
LOOKS = 2

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}
ACTION_DIR = {1: "U", 2: "D", 3: "L", 4: "R"}
LOOK = 5
ACTIONS = [1, 2, 3, 4, 5]

WALL, FLOOR, START, TRAP, KEY, EXIT, THIN = "#", ".", "S", "T", "K", "E", "o"


def neighbours(cell):
    return [(cell[0] + dx, cell[1] + dy) for dx, dy in DIRS.values()]


def origin(cell):
    return OFFX + cell[0] * CELL, OFFY + cell[1] * CELL


# ---------------------------------------------------------------------------
# Levels. Walls are visible from the first frame; contents are not. 'o' is thin ground (one
# mark), 'K' a key, 'T' a pit, 'E' the ring, 'S' where you start (and where a pit sends you).
# ---------------------------------------------------------------------------

LEVELS = [
    {"name": "l1", "free": True,
     "map": ("#######",
             "#S..###",
             "###.###",
             "###.E##",
             "#######",
             "#######")},
    {"name": "l2",
     "map": ("#K#.#.#",
             "#.#.#.#",
             "S.....E",
             "#.#K#K#",
             "#######",
             "#######")},
    {"name": "l3",
     "map": ("##K#K##",
             "##.#.##",
             "#S.....",
             "##.#.#E",
             "##K#K##",
             "#######")},
    {"name": "l4",
     "map": ("##K#K#K",
             "##.#.#.",
             "#S.....",
             "##.#.#E",
             "##K#T##",
             "#######")},
    {"name": "l5",
     "map": ("#K#K#.#",
             "#.#.#T#",
             "S.....E",
             "#.#.#.#",
             "#K#K#.#",
             "#######")},
    {"name": "l6",
     "map": ("##K#K##",
             "#S....#",
             "#.#E#.#",
             "#K###K#",
             "#.o.o.#",
             "##K#T##")},
    {"name": "l7",
     "map": ("S..K...",
             "######.",
             "K.K.K..",
             ".######",
             "......E",
             "#K#T#K#")},
    {"name": "l8",
     "map": ("#K#.#K#",
             "#.#.#.#",
             "S.o.o.E",
             "#.#K#.#",
             "#K#.#K#",
             "#T#K#.#")},
]


# ---------------------------------------------------------------------------
# Rules, as one small object: the game, the solver and the checks all drive this.
# ---------------------------------------------------------------------------

def parse(rows):
    cells, content, keys, exits, thin = set(), {}, set(), set(), set()
    start = None
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == WALL:
                continue
            cells.add((c, r))
            content[(c, r)] = FLOOR if ch in (START, THIN) else ch
            if ch == START:
                start = (c, r)
            elif ch == EXIT:
                exits.add((c, r))
            elif ch == KEY:
                keys.add((c, r))
            elif ch == THIN:
                thin.add((c, r))
    return frozenset(cells), start, frozenset(exits), frozenset(keys), content, frozenset(thin)


def component(src, passable):
    seen = {src}
    q = deque([src])
    while q:
        p = q.popleft()
        for n in neighbours(p):
            if n in passable and n not in seen:
                seen.add(n)
                q.append(n)
    return seen


class Core:
    """All of the rules and none of the pictures."""

    def __init__(self, ldef):
        rows = ldef["map"]
        self.free = bool(ldef.get("free"))
        (self.cells, self.start, self.exits, self.keys, self.content, self.thin) = parse(rows)
        self.pos = self.start
        self.trail = None
        self.revealed = {self.start}
        self.looks = {}
        for c in self.cells:
            self.looks[c] = 99 if (self.free or c == self.start) else (1 if c in self.thin else LOOKS)
        self.taken = set()

    # -- state helpers ------------------------------------------------------

    def copy(self):
        n = copy.copy(self)
        n.revealed = set(self.revealed)
        n.looks = dict(self.looks)
        n.taken = set(self.taken)
        return n

    def key(self):
        return (self.pos, self.trail, frozenset(self.revealed),
                tuple(sorted(self.looks.items())), frozenset(self.taken))

    def passable(self):
        return {c for c in self.cells
                if self.looks[c] > 0 and not (c in self.revealed and self.content[c] == TRAP)}

    def ring_open(self):
        return self.keys <= self.taken

    def won(self):
        return self.pos in self.exits and self.pos in self.revealed and self.ring_open()

    # -- the two verbs ------------------------------------------------------

    def walk(self, d):
        dx, dy = DIRS[d]
        nxt = (self.pos[0] + dx, self.pos[1] + dy)
        if nxt not in self.passable():
            return [("block", nxt, d)]
        here = self.pos
        if here not in self.revealed and self.content[here] == TRAP:
            self.revealed.add(here)                 # the floor gives way
            self.pos = self.start
            self.trail = None
            return [("fall", here)]
        self.trail = here
        self.pos = nxt
        return [("move", here, nxt)]

    def look(self):
        back = self.trail
        if back is None or self.pos in self.revealed:
            return [("empty",)]                     # nothing here to light
        d = next((k for k, (dx, dy) in DIRS.items()
                  if (self.pos[0] + dx, self.pos[1] + dy) == back), None)
        if self.looks[back] <= 0:
            return [("scar", back, d)]
        x = self.pos
        cost = 1
        took = False
        self.revealed.add(x)
        if self.content[x] == KEY and x not in self.taken:
            self.taken.add(x)
            took = True
        before = self.looks[back]
        home = self.free or back == self.start      # the entrance never wears out
        if not home:
            self.looks[back] = max(0, before - cost)
        self.pos = back
        self.trail = None
        return [("look", x, back, 0 if home else cost, took, before)]

    def act(self, aid):
        if aid in ACTION_DIR:
            return self.walk(ACTION_DIR[aid])
        if aid == LOOK:
            return self.look()
        return []

    # -- the one ending that is not a win -----------------------------------

    def _sink(self, c):
        return c in self.cells and c not in self.revealed and self.content[c] == TRAP

    def _reach(self, pos, p):
        """Cells you can come to stand on, and the unlit pits among them. A pit can be stood on
        but not walked through: leaving it forward drops you at the entrance."""
        seen = {pos}
        sinks = set()
        q = deque([pos])
        while q:
            a = q.popleft()
            if a != pos and self._sink(a):
                sinks.add(a)
                continue
            for n in neighbours(a):
                if n in p and n not in seen:
                    seen.add(n)
                    q.append(n)
        return seen, sinks

    def _fall_state(self, cell):
        c = self.copy()
        c.revealed.add(cell)
        c.pos = self.start
        c.trail = None
        return c

    def lost(self):
        """True when the level can no longer be won. Every test here is a necessary condition for
        winning, so a True is a true dead end; solve2.py audits that no dead state escapes."""
        if self.free:
            return False
        p = self.passable()
        if self._sink(self.pos):
            # standing on an unlit pit: step back with a look, or fall to the entrance
            opts = []
            if self.trail is not None and self.looks[self.trail] > 0:
                c2 = self.copy()
                c2.look()
                opts.append(c2)
            if any(n in p for n in neighbours(self.pos)):
                opts.append(self._fall_state(self.pos))
            return all(o.lost() for o in opts)
        if self.looks[self.pos] > 0:
            sides = [(self.pos, self.trail, p)]
        else:
            # standing on a scar: you may step off it, never back on, so you commit to one side
            q = p - {self.pos}
            sides = [(n, None, q) for n in neighbours(self.pos) if n in q]
            if not sides:
                return True
        sinks = set()
        for pos, trail, pp in sides:
            reach, sk = self._reach(pos, pp | {pos})
            if not self._dead(reach, pos, trail, pp):
                return False
            sinks |= sk
        # no way to win by walking: a fall is the one thing left that moves you somewhere new
        return all(self._fall_state(s).lost() for s in sinks)

    def _dead(self, reach, pos, trail, p):
        if not (self.exits & reach):
            return True
        needs = []
        for k in self.keys - self.taken:
            if k not in reach:
                return True
            needs.append(k)
        for e in self.exits:
            if e in reach and e not in self.revealed:
                needs.append(e)
        for n in needs:
            # a cell can only be lit from a stand on it: you must be able to step ONTO it, unless
            # you are on it now with a way back to look through
            if n == pos and trail is not None and self.looks[trail] > 0:
                continue
            if self.looks[n] <= 0:
                return True
        if not needs:
            return False
        # each look costs at least one mark on a neighbour you can stand on: a matching problem
        cap = {c: self.looks[c] for c in reach if self.looks[c] > 0 and c in p | {pos}}
        match = {}

        def place(n, seen):
            for v in neighbours(n):
                if v in cap and v not in seen:
                    seen.add(v)
                    used = match.setdefault(v, [])
                    if len(used) < cap[v]:
                        used.append(n)
                        return True
                    for i, other in enumerate(used):
                        if place(other, seen):
                            used[i] = n
                            return True
            return False

        for n in needs:
            if not place(n, set()):
                return True
        return False


# ---------------------------------------------------------------------------
# Pictures
# ---------------------------------------------------------------------------

KEY_PIC = ("..XX....",
           ".X..XXXX",
           ".X..X.X.",
           "..XX....")

WALKER_PIC = (".KKKKK.",
              "KBBBBBK",
              "KBWBWBK",
              "KBBBBBK",
              "KBBBBBK",
              "KBBBBBK",
              ".K.K.K.")
WALKER_SMALL = (".KKK.",
                "KBBBK",
                "KBWBK",
                "KBBBK",
                ".K.K.")
WALKER_TINY = ("KKK",
               "KBK",
               "KKK")
PIC_COL = {"K": C_BLACK, "B": C_YOU, "W": C_WHITE, "X": C_KEY}


def blit(frame, x0, y0, pic, colors=None, color=None):
    for r, row in enumerate(pic):
        for c, ch in enumerate(row):
            if ch == ".":
                continue
            col = color if color is not None else (colors or PIC_COL)[ch]
            y, x = y0 + r, x0 + c
            if 0 <= y < 64 and 0 <= x < 64:
                frame[y, x] = col


class Eh01Display(RenderableUserDisplay):
    """The board is the state. Per-frame overrides in game.vis only ever dress a settled state."""

    def __init__(self, game):
        self.game = game

    # -- primitives ---------------------------------------------------------

    @staticmethod
    def _fill(frame, px, py, color):
        frame[py:py + CELL, px:px + CELL] = color

    @staticmethod
    def _box(frame, px, py, r0, r1, c0, c1, color):
        frame[py + r0:py + r1 + 1, px + c0:px + c1 + 1] = color

    @staticmethod
    def _ring(frame, px, py, r0, r1, c0, c1, color):
        frame[py + r0, px + c0:px + c1 + 1] = color
        frame[py + r1, px + c0:px + c1 + 1] = color
        frame[py + r0:py + r1 + 1, px + c0] = color
        frame[py + r0:py + r1 + 1, px + c1] = color

    @staticmethod
    def _diamond(frame, px, py, reach, color):
        mid = (CELL - 1) / 2.0
        for r in range(CELL):
            for c in range(CELL):
                if abs(r - mid) + abs(c - mid) <= reach:
                    frame[py + r, px + c] = color

    @staticmethod
    def _stipple(frame, px, py):
        for r in range(2, CELL - 1):
            for c in range(1, CELL - 1):
                if (r + c) % 3 == 0 and (r % 2 == 0):
                    frame[py + r, px + c] = C_NOISE

    def _ringpic(self, frame, px, py, col, opened, base):
        self._ring(frame, px, py, 1, CELL - 2, 1, CELL - 2, col)
        self._ring(frame, px, py, 3, CELL - 4, 3, CELL - 4, col)
        if opened:
            self._box(frame, px, py, 4, 4, 4, 4, col)
            self._box(frame, px, py, CELL - 2, CELL - 2, 3, CELL - 4, base)   # the gap
            self._box(frame, px, py, CELL - 4, CELL - 3, 4, CELL - 5, base)
        else:
            self._box(frame, px, py, 4, 4, 4, 4, C_BLACK)

    def _pips(self, frame, px, py, n, hot=0):
        """Orange marks in the two top corners. `hot` of them are burning (red)."""
        if n >= 1:
            self._box(frame, px, py, 0, 1, 0, 1, C_RED if hot >= n else C_MARK)
        if n >= 2:
            self._box(frame, px, py, 0, 1, CELL - 2, CELL - 1, C_RED if hot >= 1 else C_MARK)

    # -- one cell -----------------------------------------------------------

    def _draw_cell(self, frame, g, cell, reach):
        core = g.core
        v = g.vis
        px, py = origin(cell)
        lit = cell in core.revealed and cell not in v.get("hide", ())
        what = core.content[cell]
        n = v.get("pips", {}).get(cell, core.looks[cell])
        dying = v.get("dying", 0)

        if lit and what == TRAP:
            self._fill(frame, px, py, C_ROCK)
            self._diamond(frame, px, py, 4.0, C_RIM)
            self._diamond(frame, px, py, 2.0, C_PIT)
            return
        if n <= 0 and not core.free:
            self._fill(frame, px, py, C_SCAR)
            for i in range(CELL):
                frame[py + i, px + i] = C_ROCK
                frame[py + i, px + CELL - 1 - i] = C_ROCK
            return
        cut = cell not in reach or dying >= 3
        if cut:
            self._fill(frame, px, py, C_ROCK)
            self._ring(frame, px, py, 1, CELL - 2, 1, CELL - 2, C_BLACK)
            return
        self._fill(frame, px, py, C_LIT if lit else C_DARK)
        if not lit:
            self._stipple(frame, px, py)
        if not core.free and cell != core.start:
            self._pips(frame, px, py, n, v.get("hot", {}).get(cell, 0))
        if lit:
            if what == KEY:
                self._box(frame, px, py, 4, 5, 4, 5, C_BLACK)        # the seat it left
            elif what == EXIT:
                shown_open = core.ring_open() if v.get("ring") is None else v["ring"]
                self._ringpic(frame, px, py, C_OPEN if shown_open else C_SHUT, shown_open, C_LIT)

    # -- band across the top ------------------------------------------------

    def _draw_hud(self, frame, g):
        core = g.core
        n = len(core.keys)
        taken = len(core.taken) if g.vis.get("taken") is None else g.vis["taken"]
        frame[0:HUD_H, :] = C_BLACK
        for i in range(n):
            x, y = g.slot_xy(i)
            frame[y - 1:y + 6, x - 1:x + 9] = C_BLACK
            frame[y:y + 5, x:x + 8] = C_DARK
            blit(frame, x, y, KEY_PIC, color=(C_KEY if i < taken else C_MAROON))
        ex, ey = g.ring_xy()
        opened = core.ring_open() if g.vis.get("taken") is None else (g.vis["taken"] >= n)
        frame[ey - 1:ey + 9, ex - 1:ex + 10] = C_BLACK
        self._ringpic(frame, ex, ey - 1 + 0, C_OPEN if opened else C_SHUT, opened, C_BLACK)

    # -- the walker ----------------------------------------------------------

    def _draw_walker(self, frame, g):
        v = g.vis
        wp = v.get("wp") or origin(v.get("wcell") or g.core.pos)
        scale = v.get("wscale", 2)
        col = v.get("wcolor")
        if scale <= 0:
            return
        pic = {2: WALKER_PIC, 1: WALKER_SMALL, 0.5: WALKER_TINY}[scale]
        ox = (CELL - len(pic[0])) // 2
        oy = (CELL - len(pic)) // 2
        if col is None:
            blit(frame, wp[0] + ox, wp[1] + oy, pic)
        else:
            blit(frame, wp[0] + ox, wp[1] + oy, pic, colors={"K": C_BLACK, "B": col, "W": C_WHITE})

    def _draw_overlays(self, frame, g):
        v = g.vis
        if v.get("flare"):
            bx, by = origin(v["flare"])
            self._fill(frame, bx, by, C_FLARE)
        if v.get("edge"):
            bx, by = origin(v["edge"][0])
            self._ring(frame, bx, by, 0, CELL - 1, 0, CELL - 1, v["edge"][1])
            self._ring(frame, bx, by, 1, CELL - 2, 1, CELL - 2, v["edge"][1])
        if v.get("redcell"):
            cell, big = v["redcell"]
            bx, by = origin(cell)
            if big:
                self._fill(frame, bx, by, C_NO)
            else:
                self._box(frame, bx, by, 2, CELL - 3, 2, CELL - 3, C_NO)
        if v.get("key"):
            kx, ky = v["key"]
            blit(frame, kx, ky, KEY_PIC, color=C_KEY)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        core = g.core
        frame[:, :] = C_ROCK
        reach = component(core.pos, core.passable())
        for cell in core.cells:
            self._draw_cell(frame, g, cell, reach)
        self._draw_hud(frame, g)
        self._draw_walker(frame, g)
        self._draw_overlays(frame, g)
        return frame


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Eh01(ARCBaseGame):
    def __init__(self):
        self.display = Eh01Display(self)
        self.core = Core(LEVELS[0])
        self.vis = {}
        self.anim = None

        levels = [Level(sprites=[], grid_size=(64, 64), data=ldef, name=ldef["name"])
                  for ldef in LEVELS]
        super().__init__(
            "eh01",
            levels,
            Camera(0, 0, 64, 64, C_ROCK, C_ROCK, [self.display]),
            False,
            len(levels),
            list(ACTIONS),
        )

    def on_set_level(self, level: Level) -> None:
        self.core = Core(LEVELS[self.level_index])
        self.vis = {}
        self.anim = None

    def handle_reset(self) -> None:
        """Full restart only from a fresh or finished game; otherwise the level starts over."""
        if self._state in (GameState.NOT_PLAYED, GameState.WIN):
            self.full_reset()
        else:
            self.level_reset()
            self._action_count = max(1, self._action_count)

    # -- layout of the top band ---------------------------------------------

    def slot_xy(self, i):
        n = len(self.core.keys)
        x0 = self._hud_x0(n)
        return x0 + i * 9, 2

    def ring_xy(self):
        n = len(self.core.keys)
        x0 = self._hud_x0(n)
        return x0 + n * 9 + (3 if n <= 5 else 1), 1

    @staticmethod
    def _hud_x0(n):
        total = n * 9 + (13 if n <= 5 else 11)   # slots, then the ring
        return (64 - total) // 2 + 1

    # -- presentation: decide once (the core already moved), then show -------

    def _cell_center_px(self, cell):
        x, y = origin(cell)
        return x, y

    def _build(self, aid, ev, before):
        core = self.core
        frames = []
        e = ev[0]
        kind = e[0]
        if kind == "move":
            a, b = e[1], e[2]
            ax, ay = origin(a)
            dx, dy = b[0] - a[0], b[1] - a[1]
            for k in (1, 2, 3):
                frames.append({"wp": (ax + dx * 3 * k, ay + dy * 3 * k), "wcell": a})
            if core.won():
                frames[-1]["win"] = True
        elif kind == "fall":
            cell = e[1]
            frames.append({"wcell": cell, "wscale": 2, "wcolor": C_RED})
            frames.append({"wcell": cell, "wscale": 1})
            frames.append({"wcell": cell, "wscale": 0.5})
            frames.append({"wcell": cell, "wscale": 0})
            frames.append({"edge": (core.start, C_WHITE)})
            frames.append({})
        elif kind == "block":
            cell, d = e[1], e[2]
            inside = cell[0] in range(GW) and cell[1] in range(GH)
            for big in (True, False):
                if inside:
                    frames.append({"redcell": (cell, big)})
                else:
                    frames.append({"edge": (core.pos, C_RED)})
            frames.append({})
        elif kind == "empty":
            frames.append({"edge": (core.pos, C_WHITE)})
            frames.append({"edge": (core.pos, C_WHITE)})
            frames.append({})
        elif kind == "scar":
            frames.append({"flare": e[1]})
            frames.append({"edge": (e[1], C_WHITE)})
            frames.append({})
        elif kind == "look":
            _, x, back, cost, took, pips_before = e
            xx, xy = origin(x)
            bx, by = origin(back)
            dx, dy = back[0] - x[0], back[1] - x[1]
            hide = {x}
            n_after = core.looks[back]
            pips_old = {back: pips_before}
            hud_old = len(core.taken) - (1 if took else 0)
            for k in (1, 2, 3):
                frames.append({"wp": (xx + dx * 3 * k, xy + dy * 3 * k), "wcell": x,
                               "hide": hide, "pips": pips_old, "taken": hud_old,
                               "ring": (hud_old >= len(core.keys))})
            frames[-1]["wp"] = None
            frames[-1].pop("wcell")
            frames.append({"hide": hide, "flare": x, "pips": pips_old, "taken": hud_old,
                           "ring": (hud_old >= len(core.keys))})
            hot = {back: min(cost, pips_before)} if cost else {}
            f5 = {"pips": pips_old, "hot": hot, "taken": hud_old, "edge": (x, C_WHITE),
                  "ring": (hud_old >= len(core.keys))}
            if took:
                f5["key"] = (xx, xy + 2)
            frames.append(f5)
            if took:
                f6 = {"taken": hud_old, "key": (xx, xy + 2), "ring": (hud_old >= len(core.keys)),
                      "hot": hot}
                sx, sy = self.slot_xy(hud_old)
                frames.append({"taken": hud_old, "pips": {back: n_after},
                               "key": ((xx * 2 + sx) // 3, (xy + 2) * 2 // 3 + sy // 3),
                               "ring": (hud_old >= len(core.keys))})
                frames.append({"taken": hud_old, "pips": {back: n_after},
                               "key": ((xx + sx * 2) // 3, (xy + 2) // 3 + sy * 2 // 3),
                               "ring": (hud_old >= len(core.keys))})
                frames.append({})
            else:
                frames.append({"pips": {back: n_after}})
                frames.append({})
        return frames

    def _death(self):
        fr = []
        for t in range(15):
            fr.append({"dying": t, "wcolor": C_RED if t < 8 else None,
                       "wscale": 2 if t < 5 else (1 if t < 8 else (0.5 if t < 11 else 0))})
        fr[-1]["reset"] = True
        return fr

    # -- engine entry point -------------------------------------------------

    def step(self) -> None:
        aid = self.action.id.value
        if aid == 0:
            self.vis = {}
            self.anim = None
            self.complete_action()
            return
        if self.anim is None:
            before = None
            ev = self.core.act(aid)
            frames = self._build(aid, ev, before) if ev else [{}]
            if self.core.lost():
                frames += self._death()
            self.anim = frames
        frame = self.anim.pop(0)
        self.vis = frame
        done = not self.anim
        if frame.get("win"):
            self.next_level()
        if frame.get("reset"):
            self.level_reset()
            self._action_count = max(1, self._action_count)
            done = True
        if done:
            self.anim = None
            self.vis = {} if frame.get("reset") else self.vis
            self.complete_action()
