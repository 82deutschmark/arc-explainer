"""db11 -- Ember Relay v4: carry one flame through a sky of paper lanterns.

Author: Claude Opus 5.5 High, 19-October-2026 (a gentle level two and three); Claude Opus 5.5 High, 18-October-2026
(the warning crosses); Claude Sonnet 5.5, 13-October-2026 (second polish pass, for the Boss).
Date: 19-October-2026
CHANGELOG 19-Oct-2026 (Claude Opus 5.5 High): the Boss, with the crosses: "I still can't get past level 2." The old
  level two won at one cell for one step in every twenty; the crosses showed losing moments but a person could not
  find the winning one. Level two is rebuilt to add exactly one idea to level one, a lantern riding a string carries
  the fire between lanterns too far apart to pass it: a pair at the top, a row of three below, a rider on a string
  down the right edge; beside the pair, under the string's top, Space wins five steps in every ten (no X shows).
  A new level three asks the same on a small wheel with a three-step window, a stepping stone to the old level three
  (one step per lap). The old level two is gone; the old levels three to eight are now four to nine (nine levels).
  Both new levels were searched (tune_l2b.py). Because a losing Space costs nothing, random pressing still found
  their waiting spots too often, so from level two every try has a move allowance (the shortest win, a whole lap of
  waiting and three more), shown as a yellow wick along the foot of the roof that burns down with each move; spent,
  the flame goes out in the usual pink puff and the try starts again.
CHANGELOG 18-Oct-2026 (Claude Opus 5.5 High): the Boss: "every time I light the lantern, my character dies" and "I
  honestly think level 2 might be broken." Space lets the night's one flame go and the run ends the moment the fire
  dies with a lantern unlit, but nothing showed beforehand which lanterns the fire would miss (on level two, 2 of
  425 moments in its first 40 steps win). Now, whenever Space would let the flame go, every lantern it would never
  reach, and every kite it would burn, wears a thick pink cross, worked out by the same run_chain Space runs; no
  cross anywhere means Space wins. Lit lanterns are white with a yellow flame (they were yellow on a yellow glow).
  Rules and levels are unchanged.
SRP/DRY check: Pass -- the warning is one method (_doom) over the existing run_chain, one sprite per item, one line in
  _show; nothing else is new.
Idea: you fly a firefly that carries the night's one flame; the white square is its light. Press
Space (ACTION5) when a lantern is inside the light and the flame leaves the firefly and bursts
there: that lantern lights, and anything inside a glow lights on the next step; a glow lasts three
steps. Light every lantern. Level 1 is only that: lanterns that hang still, so one Space and the fire
runs along them. Later levels add ONE idea each: lanterns riding a string of dots (a white pip marks
the cell each one will reach on your next step, so nothing ever moves without being shown first),
pink kites that must stay dark, white sky lanterns that climb a shown string once lit. A lantern
inside the light wakes up (eyes wide), so you can see what Space would burst.
If the fire dies with a lantern unlit or a kite lit, the flame goes out with a pink puff and the
level starts again as you entered it. There is no trip home.

Rules and presentation are separate: an action resolves its whole outcome first (run_chain), then
queues frames that only show it. Every object is one sprite that moves whole, along the path the
rules took, in 2-3 frames per step.
"""

import math

import numpy as np

from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, Level, Sprite

W = H = 9  # sky cells
FLY_H = 8  # the firefly flies in rows 0..7; row 8 is the roof band, where the lamp and sky lanterns sit
CELL = 7  # pixels per cell
LIFE = 3  # a glow lasts this many steps, counting the step it starts
MOVE_FR = (3, 7)  # an ordinary step: eased offsets in pixels
CHAIN_FR = (4, 7)  # a step inside a cascade: two frames

# Palette (indices into the engine's 16 colours).
WHITE, BLACK, PINK, RED, YELLOW, ORANGE, MAROON = 0, 5, 7, 8, 11, 12, 13
BLUE, LBLUE = 9, 10
CLEAR = -1

# ── Tracks ────────────────────────────────────────────────────────────────────

RING = {
    1: [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)],
    2: [(2, 0), (2, 1), (1, 2), (0, 2), (-1, 2), (-2, 1), (-2, 0), (-2, -1), (-1, -2), (0, -2), (1, -2), (2, -1)],
    3: [(3, 0), (3, 1), (2, 2), (1, 3), (0, 3), (-1, 3), (-2, 2), (-3, 1), (-3, 0), (-3, -1), (-2, -2), (-1, -3), (0, -3), (1, -3), (2, -2), (3, -1)],
    4: [(3, 0), (3, 1), (3, 2), (2, 3), (1, 3), (0, 3), (-1, 3), (-2, 3), (-3, 2), (-3, 1), (-3, 0), (-3, -1), (-3, -2), (-2, -3), (-1, -3), (0, -3), (1, -3), (2, -3), (3, -2), (3, -1)],
}


def ring(cx: int, cy: int, r: int, cw: bool = True) -> list[tuple[int, int]]:
    """A closed round string of cells around (cx, cy), one cell per step, clockwise on screen."""
    cells = [(cx + dx, cy + dy) for dx, dy in RING[r]]
    return cells if cw else [cells[0]] + cells[1:][::-1]


def _line(a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]]:
    n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
    dx, dy = (b[0] > a[0]) - (b[0] < a[0]), (b[1] > a[1]) - (b[1] < a[1])
    return [(a[0] + dx * k, a[1] + dy * k) for k in range(n + 1)]


def shuttle(*waypoints: tuple[int, int]) -> list[tuple[int, int]]:
    """An open string ridden back and forth through the waypoints."""
    pts = [waypoints[0]]
    for a, b in zip(waypoints, waypoints[1:]):
        pts += _line(a, b)[1:]
    return pts + pts[-2:0:-1]


def still(cell: tuple[int, int]) -> list[tuple[int, int]]:
    return [cell]


def mirror(track: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """The same string flipped left to right: a different scene, the same timing."""
    return [(W - 1 - x, y) for x, y in track]




# ── Levels ────────────────────────────────────────────────────────────────────
# An item is (kind, track, phase): kind "paper" (hanging lantern), "sky" (rises while it burns),
# "kite" (must stay dark). "home" is the lamp where the firefly starts.


def _lv(items: list[tuple[str, list, int]], home: tuple[int, int], moves: int | None = None) -> dict:
    """moves (set from MOVES below): the moves one try may take; spent, the flame goes out as if the fire had died and
    the level starts again. Shown as the wick along the foot of the roof."""
    return {"items": items, "home": home, "moves": moves}


LEVELS: list[dict] = []


# 1. teach: five lanterns hang still, nose to tail; one Space and the fire runs along them
def _level1() -> dict:
    T0 = still((2, 1))
    T1 = still((3, 2))
    T2 = still((4, 3))
    T3 = still((5, 4))
    T4 = still((6, 5))
    return _lv([("paper", T0, 0), ("paper", T1, 0), ("paper", T2, 0), ("paper", T3, 0), ("paper", T4, 0)], home=(0, 7))

# 2. rails (rebuilt 19-Oct): a pair of lanterns at the top and a row of three below hang too far apart for the fire to
#    jump; one lantern rides a string down the right edge between them, a white pip showing its next cell. Stand
#    beside the pair where your light also reaches the top of that string and press when no pink X shows: the
#    rider carries the fire down to the row. That spot wins five steps in every ten.
def _level2() -> dict:
    T0 = shuttle((8, 6), (8, 1))
    return _lv([("paper", still((5, 4)), 0), ("paper", still((6, 4)), 0), ("paper", still((7, 4)), 0), ("paper", T0, 2),
                ("paper", still((5, 0)), 0), ("paper", still((6, 0)), 0)], home=(0, 7))

# 3. wheel (new 19-Oct): the same idea on a small wheel: a column on the left and a row along the top, joined only
#    by a lantern turning on a wheel between them; the good spot wins three steps in every eight.
def _level3() -> dict:
    T0 = ring(4, 3, 1, cw=False)
    return _lv([("paper", still((1, 2)), 0), ("paper", still((1, 3)), 0), ("paper", still((1, 4)), 0), ("paper", T0, 4),
                ("paper", still((3, 0)), 0), ("paper", still((4, 0)), 0), ("paper", still((5, 0)), 0)], home=(8, 7))

# 4. stretch: two wheels and a ferry; the fire must be handed across at the right moment
def _level4() -> dict:
    T0 = ring(2, 2, 1)
    T1 = shuttle((3, 1), (5, 1))
    T2 = ring(7, 4, 1)
    return _lv([("paper", T0, 4), ("paper", T0, 5), ("paper", T1, 1), ("paper", T2, 7), ("paper", T2, 8)], home=(0, 7))

# 5. introduce the kite: a pink kite drifts in; no glow may touch it
def _level5() -> dict:
    T0 = ring(1, 2, 1)
    T1 = ring(4, 3, 3, cw=False)
    T2 = ring(3, 4, 1)
    return _lv([("paper", T0, 3), ("paper", T0, 4), ("paper", T0, 5), ("paper", T1, 4), ("kite", T2, 2)], home=(6, 7))

# 6. combine: ferry and wheels with the kite crossing the route
def _level6() -> dict:
    T0 = ring(1, 2, 1, cw=False)
    T1 = shuttle((2, 1), (5, 1))
    T2 = ring(7, 2, 1)
    T3 = ring(2, 3, 1)
    return _lv([("paper", T0, 2), ("paper", T0, 3), ("paper", T1, 4), ("paper", T2, 6), ("paper", T2, 7), ("kite", T3, 6)], home=(4, 7))

# 7. turn: white sky lanterns on the roof climb their string once lit
def _level7() -> dict:
    T0 = ring(5, 3, 2)
    T1 = ring(5, 3, 2, cw=False)
    T2 = still((6, 8))
    T3 = still((7, 8))
    T4 = ring(5, 3, 1)
    return _lv([("paper", T0, 13), ("paper", T0, 14), ("paper", T1, 15), ("paper", T1, 16), ("sky", T2, 0), ("sky", T3, 0), ("kite", T4, 3)], home=(0, 7))

# 8. compose: wheel, ferry, sky lanterns and kite
def _level8() -> dict:
    T0 = ring(7, 2, 1, cw=False)
    T1 = shuttle((1, 4), (6, 4))
    T2 = still((6, 8))
    T3 = still((7, 8))
    T4 = ring(3, 6, 1)
    return _lv([("paper", T0, 7), ("paper", T0, 8), ("paper", T0, 9), ("paper", T1, 9), ("sky", T2, 0), ("sky", T3, 0), ("kite", T4, 4)], home=(0, 7))

# 9. compose: the longest relay, kite and sky lanterns kept in play
def _level9() -> dict:
    T0 = ring(2, 2, 1)
    T1 = shuttle((0, 4), (5, 4))
    T2 = still((1, 8))
    T3 = still((2, 8))
    T4 = ring(4, 5, 1, cw=False)
    return _lv([("paper", T0, 4), ("paper", T0, 5), ("paper", T0, 6), ("paper", T1, 6), ("sky", T2, 0), ("sky", T3, 0), ("kite", T4, 7)], home=(8, 7))

LEVELS = [_level1(), _level2(), _level3(), _level4(), _level5(), _level6(), _level7(), _level8(), _level9()]

# From level two every try has a move allowance, shown as the wick along the foot of the roof: the shortest win, plus
# one whole lap of the moving lanterns to wait for the good moment, plus three. Spent, the flame goes out in the pink
# puff and the try starts again. A person who goes to the spot has a lap to spare; a blind presser that wanders runs
# out, which is what keeps the vetting gate's random player off these levels (a losing Space costs nothing, so
# without it random pressing found level two's spot 5 times in 160 runs). Shortest wins: 7, 14, 15, 16, 20, 25, 29,
# 33, 39 (solve.py); laps: -, 10, 8, 8, 16, 24, 24, 40, 40.
MOVES = [None, 27, 26, 27, 39, 52, 56, 76, 82]
for _spec, _n in zip(LEVELS, MOVES):
    _spec["moves"] = _n

# ── Rules (pure) ──────────────────────────────────────────────────────────────


def near(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return abs(a[0] - b[0]) <= 1 and abs(a[1] - b[1]) <= 1


def track_cell(item: tuple, t: int) -> tuple[int, int]:
    _, track, phase = item
    return track[(phase + t) % len(track)]


def contact(spec: dict, f: tuple[int, int], t: int) -> bool:
    return any(near(f, track_cell(it, t)) for it in spec["items"])


def run_chain(spec: dict, start: int, cell: tuple[int, int]) -> tuple[bool, list[dict]]:
    """Resolve the flame released at `cell` on step `start`. Returns (won, states); a state is
    {"t", "spark", "lives", "cells", "rise"}. lives: 0 unlit, 1..3 glowing, -1 spent, -2 burnt kite.
    Anything unlit inside a glow on a step lights on the next step. A sky lantern that catches
    leaves its place and rises one cell per step. The level is won once every lantern is lit and
    no glow that is left can still reach a kite."""
    items = spec["items"]
    n = len(items)
    kites = [i for i in range(n) if items[i][0] == "kite"]
    lamps = [i for i in range(n) if items[i][0] != "kite"]
    lives = [0] * n
    rise: list = [None] * n
    spark = LIFE
    t = start

    def cell_of(i: int, tt: int) -> tuple[int, int]:
        if rise[i] is not None:
            x, y, c = rise[i]
            return (x, y - (tt - c))
        return track_cell(items[i], tt)

    def snap() -> dict:
        return {"t": t, "spark": spark, "lives": tuple(lives), "cells": tuple(cell_of(i, t) for i in range(n)), "rise": tuple(rise)}

    def kites_safe() -> bool:
        """With every lantern lit, would any glow still left reach a kite?"""
        lv, sp, tt = list(lives), spark, t
        while sp > 0 or any(v > 0 for v in lv):
            src = ([cell] if sp > 0 else []) + [cell_of(i, tt) for i in range(n) if lv[i] > 0]
            if any(lv[k] == 0 and any(near(cell_of(k, tt), s) for s in src) for k in kites):
                return False
            tt += 1
            sp = max(0, sp - 1)
            lv = [v - 1 if v > 1 else (-1 if v == 1 else v) for v in lv]
        return True

    states = [snap()]
    while True:
        cells = [cell_of(i, t) for i in range(n)]
        sources = ([cell] if spark > 0 else []) + [cells[i] for i in range(n) if lives[i] > 0]
        caught = [i for i in range(n) if lives[i] == 0 and any(near(cells[i], s) for s in sources)]
        t += 1
        spark = max(0, spark - 1)
        lives = [v - 1 if v > 1 else (-1 if v == 1 else v) for v in lives]
        for i in caught:
            if items[i][0] == "kite":
                lives[i] = -2
            else:
                lives[i] = LIFE
                if items[i][0] == "sky":
                    rise[i] = (cells[i][0], cells[i][1], t - 1)
        states.append(snap())
        all_lit = all(lives[i] != 0 for i in lamps)
        burnt_kite = any(lives[i] == -2 for i in kites)
        if all_lit and not burnt_kite and kites_safe():
            return True, states
        if spark == 0 and not any(v > 0 for v in lives):
            return False, states


# ── Pixel art ─────────────────────────────────────────────────────────────────

_KEY = {"k": BLACK, "p": PINK, "r": RED, "y": YELLOW, "o": ORANGE, "w": WHITE, "m": MAROON, "b": BLUE, "l": LBLUE}


def _art(rows: list[str]) -> np.ndarray:
    px = np.full((len(rows), len(rows[0])), CLEAR, dtype=np.int8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in _KEY:
                px[y, x] = _KEY[ch]
    return px


def _lit_paper(pose: int) -> np.ndarray:
    # white paper with a yellow flame swaying through three places: white reads on every glow colour (yellow paper
    # on a fresh yellow glow did not, the readability note of 20-Sep)
    body = list("kwwwwwk")
    body[1 + 2 * pose] = "y"
    return _art(["...k...", ".kkkkk.", "".join(body), "kwkwkwk", "kwwkwwk", ".kkkkk.", "...k..."])


def _lit_sky(pose: int) -> np.ndarray:
    tail = ["...o...", "..o....", "....o.."][pose]
    return _art(["kkkkkkk", "kwwwwwk", "kwkwkwk", "kwwkwwk", "kwwwwwk", "kkkokkk", tail])


# Every live thing has its own black-framed picture and a face, so it reads on any glow.
# Paper lantern (7x7): round orange paper, two eyes. Lit: yellow, smiling, a white spark swaying.
# Spent: a black husk with one ember. Missed when the fire died: dull maroon paper.
ART = {
    "paper": _art(["...k...", ".kkkkk.", "koooook", "kokokok", "koooook", ".kkkkk.", "...k..."]),
    "paper-ready": _art(["...k...", ".kkkkk.", "koooook", "kowowok", "kookook", ".kkkkk.", "...k..."]),
    "paper-lit": [_lit_paper(0), _lit_paper(1), _lit_paper(2)],
    "paper-spent": _art([".......", "...k...", ".kkkkk.", "kkkokkk", ".kkkkk.", "..kkk..", "......."]),
    "paper-missed": _art(["...k...", ".kkkkk.", "kmmmmmk", "kmkmkmk", "kmmmmmk", ".kkkkk.", "...k..."]),
    # Kite (7x7): pink diamond with eyes, a red mouth and a tail. It is the one thing that must stay dark.
    "kite": _art(["...k...", "..kpk..", ".kpppk.", "kpkpkpk", ".kprpk.", "..kpk..", "...kr.."]),
    "kite-ready": _art(["...k...", "..kpk..", ".kpppk.", "kpwpwpk", ".kpkpk.", "..kpk..", "...kr.."]),
    "kite-burnt": _art(["...k...", "..kkk..", ".kkkkk.", "kkokokk", ".kkokk.", "..kkk..", "...kk.."]),
    # Sky lantern (7x7): tall white paper bag with eyes, open below. Lit: yellow with an orange
    # flame in the mouth, and it climbs its string. Spent: black husk.
    "sky": _art(["kkkkkkk", "kllllwk", "klklklk", "kllllwk", "kllllwk", "kkkokkk", "...k..."]),
    "sky-ready": _art(["kkkkkkk", "kllllwk", "kwkwkwk", "kllkllk", "kllllwk", "kkkokkk", "...k..."]),
    "sky-lit": [_lit_sky(0), _lit_sky(1), _lit_sky(2)],
    "sky-spent": _art([".......", ".kkkkk.", "kkkkkkk", "kkkokkk", ".kkkkk.", "..kkk..", "......."]),
    "sky-missed": _art(["kkkkkkk", "kmmmmmk", "kmkmkmk", "kmmkmmk", "kmmmmmk", "kkkmkkk", "...k..."]),
    # Firefly (7x5), two wing poses, with eyes; carrying the flame its tail glows.
    "fly": [_art([".w.y.w.", "wwkykww", ".wyyyw.", "..yoy..", "...o..."]), _art(["w..y..w", ".wkykw.", "w.yyy.w", "..yoy..", "...o..."])],
    "fly-dark": [_art([".p.r.p.", "ppkrkpp", ".prrrp.", "..rmr..", "...r..."]), _art(["p..r..p", ".pkrkp.", "p.rrr.p", "..rmr..", "...r..."])],
    # Home lamp (7x5): a black stone lantern on the roof where the firefly starts.
    "lamp": _art(["kkkkkkk", "kkyyykk", "kkyyykk", "..kkk..", ".kkkkk."]),
    # The released flame (5x5) shrinks as it ages.
    "spark": {
        3: _art(["..w..", ".wyw.", "wyyyw", ".wyw.", "..w.."]),
        2: _art([".....", "..y..", ".yyy.", "..y..", "....."]),
        1: _art([".....", ".....", "..o..", ".....", "....."]),
    },
}

# The warning (7x7): a thick solid pink cross, drawn over a lantern the flame would never reach if you pressed
# Space now, or over a kite the flame would burn. Pink means "this sends you back"; no cross anywhere means Space wins.
DOOM = _art(["pp...pp", "ppp.ppp", ".ppppp.", "..ppp..", ".ppppp.", "ppp.ppp", "pp...pp"])

# The pip: a white dot on the string cell a lantern will reach on your next step.
PIP = np.full((3, 3), WHITE, dtype=np.int8)

R_POOL = 10  # a glow reaches the 8 cells around its owner: a flat square 21 wide


def _square(half: int, size: int, colour: int, hollow: bool = False) -> np.ndarray:
    """A flat square (corners shaved one pixel) centred in a size x size sprite."""
    px = np.full((size, size), CLEAR, dtype=np.int8)
    c = size // 2
    for y in range(c - half, c + half + 1):
        for x in range(c - half, c + half + 1):
            edge = max(abs(x - c), abs(y - c)) == half
            corner = abs(x - c) == half and abs(y - c) == half
            if corner or (hollow and not edge):
                continue
            px[y, x] = colour
    return px


# A glow cools with age: yellow, orange, red. A fresh catch starts as a small square and grows.
POOL = {(life, grown): _square(R_POOL if grown else 5, 2 * R_POOL + 1, {3: YELLOW, 2: ORANGE, 1: RED}[life]) for life in (1, 2, 3) for grown in (False, True)}

# The firefly's own light: a thin white square at the reach of a glow.
REACH = _square(R_POOL, 2 * R_POOL + 1, WHITE, hollow=True)


def _burst_pixels(big: bool) -> np.ndarray:
    """A firework for the win: rays from a white heart."""
    px = np.full((9, 9), CLEAR, dtype=np.int8)
    px[4, 4] = WHITE
    reach = 4 if big else 2
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        for k in range(2 if big else 1, reach + 1):
            px[4 + dy * k, 4 + dx * k] = YELLOW if k < reach else PINK
    return px


BURST = {False: _burst_pixels(False), True: _burst_pixels(True)}


def _puff_pixels() -> np.ndarray:
    """The flame going out: a pink and red cross over the dark firefly."""
    px = np.full((9, 9), CLEAR, dtype=np.int8)
    for i in range(9):
        for j in (i, 8 - i):
            px[i, j] = RED
            if j + 1 < 9:
                px[i, j + 1] = PINK if px[i, j + 1] == CLEAR else px[i, j + 1]
    return px


PUFF = _puff_pixels()

ROOF_Y = FLY_H * CELL  # the roof band starts here


def _sky_pixels() -> np.ndarray:
    """The backdrop: one flat night blue over a flat maroon roof band with a black edge."""
    px = np.full((64, 64), BLUE, dtype=np.int8)
    px[ROOF_Y:, :] = MAROON
    px[ROOF_Y, :] = BLACK
    return px


def _wick(left: float) -> np.ndarray:
    """The move allowance: a yellow wick along the bottom row of the roof, burning down from the right as moves are
    spent (the burnt part shows the roof's maroon)."""
    px = np.full((1, 64), CLEAR, dtype=np.int8)
    px[0, :max(0, round(64 * left))] = YELLOW
    return px


def _string_pixels(track: list[tuple[int, int]], colour: int) -> np.ndarray:
    """The string a lantern rides: a dot (3x3) at the centre of every cell it visits."""
    px = np.full((64, 64), CLEAR, dtype=np.int8)
    for (cx, cy) in set(track):
        x, y = cx * CELL + 2, cy * CELL + 2
        px[y:y + 3, x:x + 3] = colour
    return px


# ── Level objects ─────────────────────────────────────────────────────────────

RISE_LEN = 4  # a sky lantern's string climbs this many cells above it


def _px(cell: tuple[int, int]) -> tuple[int, int]:
    return cell[0] * CELL, cell[1] * CELL


def _tracks(spec: dict) -> list[tuple[list, bool]]:
    """Distinct strings to draw: (track, is a kite's). A sky lantern's string runs straight up."""
    out: list[tuple[list, bool]] = []
    for kind, track, _ in spec["items"]:
        if kind == "sky":
            x, y = track[0]
            track = [(x, y - k) for k in range(1, RISE_LEN + 1)]
        if len(track) < 2 and kind != "sky":
            continue
        for k, (other, kite) in enumerate(out):
            if other == track:
                out[k] = (other, kite or kind == "kite")
                break
        else:
            out.append((track, kind == "kite"))
    return out


def _build_level(index: int, spec: dict) -> Level:
    free = BlockingMode.NOT_BLOCKED
    sprites = [Sprite(_sky_pixels(), name="sky", x=0, y=0, layer=0, blocking=free, tags=["scenery"])]
    for k, (track, kite) in enumerate(_tracks(spec)):
        sprites.append(Sprite(_string_pixels(track, PINK if kite else LBLUE), name=f"string-{k}", x=0, y=0, layer=1, blocking=free, tags=["string"]))
    hx, hy = _px(spec["home"])
    sprites.append(Sprite(ART["lamp"], name="lamp", x=hx, y=hy + CELL + 1, layer=3, blocking=free, tags=["lamp"]))
    for i, (kind, track, phase) in enumerate(spec["items"]):
        x, y = _px(track[phase % len(track)])
        sprites.append(Sprite(PIP, name=f"next-{i}", x=0, y=0, layer=2, blocking=free, visible=False, tags=["pip"]))
        sprites.append(Sprite(POOL[(3, True)], name=f"pool-{i}", x=x + 3 - R_POOL, y=y + 3 - R_POOL, layer=2, blocking=free, visible=False, tags=["glow"]))
        sprites.append(Sprite(ART[kind], name=f"item-{i}", x=x, y=y, layer=4, blocking=free, tags=[{"paper": "lantern", "sky": "sky-lantern", "kite": "kite"}[kind]]))
        sprites.append(Sprite(DOOM, name=f"doom-{i}", x=x, y=y, layer=5, blocking=free, visible=False, tags=["warning"]))
    sprites.append(Sprite(POOL[(3, True)], name="pool-spark", x=0, y=0, layer=2, blocking=free, visible=False, tags=["glow"]))
    sprites.append(Sprite(REACH, name="reach", x=hx + 3 - R_POOL, y=hy + 3 - R_POOL, layer=3, blocking=free, tags=["reach"]))
    sprites.append(Sprite(ART["spark"][3], name="spark", x=0, y=0, layer=7, blocking=free, visible=False, tags=["spark"]))
    sprites.append(Sprite(ART["fly"][0], name="firefly", x=hx, y=hy + 1, layer=6, blocking=free, tags=["firefly"]))
    sprites.append(Sprite(PUFF, name="puff", x=0, y=0, layer=9, blocking=free, visible=False, tags=["puff"]))
    if spec.get("moves"):
        sprites.append(Sprite(_wick(1.0), name="wick", x=0, y=63, layer=3, blocking=free, tags=["budget"]))
    for k in range(3):
        sprites.append(Sprite(BURST[False], name=f"burst-{k}", x=0, y=0, layer=8, blocking=free, visible=False, tags=["firework"]))
    return Level(sprites=sprites, name=f"level-{index + 1}", data={"spec": index})


# ── Game ──────────────────────────────────────────────────────────────────────

STEP = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1), GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}
BURSTS = ((14, 8), (40, 5), (28, 16))  # where the win's fireworks open (pixels, top-left of a 9x9 burst)
HOLD, PUFFS = 2, 4  # frames the dead chain is held, then the puff of the flame going out


class Db11(ARCBaseGame):
    def __init__(self) -> None:
        self.spec = LEVELS[0]
        self.t = 0  # world steps since the level was entered
        self.f = LEVELS[0]["home"]  # the firefly's cell
        self.frames: list[dict] = []  # pending presentation views
        self.shown: dict = {}
        self.finish: str | None = None
        self.anim = 0  # frame counter: wing beats and flame sway only
        self.drawn: dict = {}  # art currently on each sprite (skip redundant pixel updates)
        super().__init__(game_id="db11", levels=[_build_level(i, s) for i, s in enumerate(LEVELS)], camera=Camera(background=BLUE, letter_box=BLUE), available_actions=[1, 2, 3, 4, 5])

    # ── state ──

    def on_set_level(self, level: Level) -> None:
        self.spec = LEVELS[level.get_data("spec")]
        self.t = 0
        self.f = self.spec["home"]
        self.frames = []
        self.finish = None
        self.anim = 0
        self.drawn = {}
        self._show(self._rest_view())

    def _next_cell(self, i: int, t: int) -> tuple[int, int] | None:
        """The string cell lantern i reaches on the next step, if it moves at all before it is lit."""
        kind, track, _ = self.spec["items"][i]
        if kind == "sky" or len(track) < 2:
            return None
        a, b = track_cell(self.spec["items"][i], t), track_cell(self.spec["items"][i], t + 1)
        return b if a != b else None

    # ── views: everything one frame shows ──

    def _rest_view(self, frac: int = 0, f0: tuple[int, int] | None = None, t0: int | None = None) -> dict:
        """The sky between steps t0 -> self.t at `frac` pixels of 7 (0 = settled at self.t)."""
        t1 = self.t
        t0 = t1 if t0 is None else t0
        items, nexts = [], []
        settled = frac in (0, CELL)
        for i in range(len(self.spec["items"])):
            a, b = track_cell(self.spec["items"][i], t0), track_cell(self.spec["items"][i], t1)
            ready = settled and near(self.f, b)  # inside the firefly's light: wide awake
            items.append((self._lerp(a, b, frac if t0 != t1 else 0), self.spec["items"][i][0] + ("-ready" if ready else ""), 0))
            nexts.append(self._next_cell(i, t1) if settled else None)
        f0 = self.f if f0 is None else f0
        return {"fly": (self._lerp(f0, self.f, frac if f0 != self.f else 0), False), "reach": True, "items": items, "pools": [None] * len(items), "nexts": nexts, "spark": None, "puff": None, "bursts": (), "doom": self._doom() if settled else ()}

    def _doom(self) -> tuple:
        """What Space would get wrong right now, worked out by the same run_chain that Space runs: the lanterns the
        flame would never reach and the kites it would burn. Empty when Space would win, or would not release."""
        if not contact(self.spec, self.f, self.t):
            return ()
        won, states = run_chain(self.spec, self.t, self.f)
        if won:
            return ()
        last = states[-1]["lives"]
        kinds = [kind for kind, _, _ in self.spec["items"]]
        return tuple(i for i, v in enumerate(last) if (v == 0 and kinds[i] != "kite") or (v == -2 and kinds[i] == "kite"))

    @staticmethod
    def _lerp(a: tuple[int, int], b: tuple[int, int], frac: int) -> tuple[int, int]:
        ax, ay = _px(a)
        return ax + (b[0] - a[0]) * frac, ay + (b[1] - a[1]) * frac

    def _chain_view(self, s0: dict, s1: dict, frac: int, cell: tuple[int, int], last: bool = False) -> dict:
        """A frame inside a cascade, between chain states s0 and s1 (frac pixels of 7)."""
        items, pools = [], []
        for i, (kind, _, _) in enumerate(self.spec["items"]):
            a, b = s0["cells"][i], s1["cells"][i]
            pos = self._lerp(a, b, frac)
            l0, l1 = s0["lives"][i], s1["lives"][i]
            life = l1 if frac == CELL else l0
            grown = True
            if frac < CELL and l0 == 0 and l1 == LIFE:  # catching now: flame shows, glow starts small
                life, grown = LIFE, False
            if kind == "kite":
                look = "kite-burnt" if (l1 == -2 and (frac == CELL or l0 == -2)) else "kite"
            elif life > 0:
                look = f"{kind}-lit"
            elif life == -1:
                look = f"{kind}-spent"
            else:
                look = f"{kind}-missed" if last else kind
            items.append((pos, look, 0))
            pools.append((pos, life, grown) if life > 0 else None)
        spark_life = s1["spark"] if frac == CELL else s0["spark"]
        spark = (_px(cell), spark_life, True) if spark_life > 0 else None
        return {"fly": (_px(cell), True), "reach": False, "items": items, "pools": pools, "nexts": [None] * len(items), "spark": spark, "puff": None, "bursts": (), "doom": ()}

    # ── drawing ──

    def _put(self, name: str, key, pixels: np.ndarray, x: int, y: int, visible: bool = True) -> None:
        sprite = self.current_level.get_sprites_by_name(name)[0]
        if visible:
            if self.drawn.get(name) != key:
                sprite.pixels = pixels
                self.drawn[name] = key
            sprite.set_position(x, y)
        sprite.set_visible(visible)

    def _show(self, view: dict) -> None:
        self.shown = view
        beat = self.anim % 2
        n = len(self.spec["items"])
        for i in range(n):
            entry = view["items"][i]
            (x, y), look, droop = entry
            art = ART[look]
            key = look
            if isinstance(art, list):  # a burning lantern: the flame sways through three shapes
                pose = (self.anim + i) % len(art)
                art, key = art[pose], (look, pose)
            self._put(f"item-{i}", key, art, x, y + droop)
            self._put(f"doom-{i}", "doom", DOOM, x, y + droop, visible=i in view.get("doom", ()))
            pool = view["pools"][i]
            if pool is None:
                self._put(f"pool-{i}", None, POOL[(1, True)], 0, 0, visible=False)
            else:
                (px, py), life, grown = pool
                self._put(f"pool-{i}", (life, grown), POOL[(life, grown)], px + 3 - R_POOL, py + 3 - R_POOL)
            nxt = view["nexts"][i]
            if nxt is None:
                self._put(f"next-{i}", None, PIP, 0, 0, visible=False)
            else:
                nx, ny = _px(nxt)
                self._put(f"next-{i}", "pip", PIP, nx + 2, ny + 2)
        spark = view["spark"]
        if spark is None:
            self._put("spark", None, ART["spark"][1], 0, 0, visible=False)
            self._put("pool-spark", None, POOL[(1, True)], 0, 0, visible=False)
        else:
            (sx, sy), life, grown = spark
            self._put("spark", life, ART["spark"][life], sx + 1, sy + 1)
            self._put("pool-spark", (life, grown), POOL[(life, grown)], sx + 3 - R_POOL, sy + 3 - R_POOL)
        (fx, fy), dark = view["fly"]
        look = "fly-dark" if dark else "fly"
        self._put("firefly", (look, beat), ART[look][beat], fx, fy + 1)
        self._put("reach", "reach", REACH, fx + 3 - R_POOL, fy + 3 - R_POOL, visible=view["reach"])
        hx, hy = _px(self.spec["home"])
        self._put("lamp", None, ART["lamp"], hx, hy + CELL + 1)
        if self.spec.get("moves"):
            left = max(0, self.spec["moves"] - self.t) / self.spec["moves"]
            self._put("wick", round(64 * left), _wick(left), 0, 63)
        if view["puff"] is None:
            self._put("puff", None, PUFF, 0, 0, visible=False)
        else:
            px, py = view["puff"]
            self._put("puff", "puff", PUFF, px - 1, py - 1)
        for k in range(3):
            if k < len(view["bursts"]):
                big = view["bursts"][k]
                bx, by = BURSTS[k]
                self._put(f"burst-{k}", big, BURST[big], bx, by)
            else:
                self._put(f"burst-{k}", None, BURST[False], 0, 0, visible=False)

    # ── actions ──

    def _plan(self) -> None:
        """Decide the whole outcome of this action once, then queue the frames that show it."""
        if self.action.id == GameAction.ACTION5:  # let the flame go
            self._release()
            return
        step = STEP.get(self.action.id)
        if step is None:  # not a control of this game: a still frame
            self.frames = [self.shown]
            return
        g = (self.f[0] + step[0], self.f[1] + step[1])
        if not (0 <= g[0] < W and 0 <= g[1] < FLY_H):  # the edge of the sky or the roofs: a nudge, nothing changes
            view = self._rest_view()
            fx, fy = view["fly"][0]
            nudge = dict(view, fly=((fx + step[0], fy + step[1]), False))
            self.frames = [nudge, view]
            return
        f0, t0 = self.f, self.t
        self.f, self.t = g, self.t + 1
        moves = [self._rest_view(frac, f0, t0) for frac in MOVE_FR]
        self.frames = moves
        if self.spec.get("moves") and self.t >= self.spec["moves"]:
            # the wick is spent: the flame goes out in the same pink puff as a dead fire, and the try starts again
            self.frames = moves + [moves[-1]] * HOLD + [dict(moves[-1], puff=_px(self.f), doom=())] * PUFFS
            self.finish = "dead"

    def _release(self) -> None:
        """Space: the firefly lets its flame go. It needs a lantern (or kite) inside the light;
        otherwise the firefly just dips and nothing changes."""
        if not contact(self.spec, self.f, self.t):
            view = self._rest_view()
            fx, fy = view["fly"][0]
            self.frames = [dict(view, fly=((fx, fy + 1), False)), view]
            return
        won, states = run_chain(self.spec, self.t, self.f)
        frames = [self._chain_view(states[0], states[0], 0, self.f)]
        frames[-1]["spark"] = (_px(self.f), LIFE, False)
        for k, (s0, s1) in enumerate(zip(states, states[1:])):
            last = (not won) and k == len(states) - 2
            frames += [self._chain_view(s0, s1, CHAIN_FR[0], self.f), self._chain_view(s0, s1, CELL, self.f, last=last)]
        if won:
            for big in (False, True):
                frames.append(dict(frames[-1], bursts=(big, big, big)))
            self.finish = "win"
        else:
            # The fire has died with something unlit or a kite lit: the flame goes out in a pink
            # puff, then the level starts again as it was entered.
            frames += [frames[-1]] * HOLD + [dict(frames[-1], puff=_px(self.f))] * PUFFS
            self.finish = "dead"
        self.frames = frames

    def step(self) -> None:
        if self.action.id == GameAction.RESET:  # the engine calls step() once for RESET too
            self.complete_action()
            return
        if not self.frames:
            self._plan()
        self.anim += 1
        self._show(self.frames.pop(0))
        if not self.frames:
            if self.finish == "win":
                self.finish = None
                self.next_level()
            elif self.finish == "dead":
                self.finish = None
                self.level_reset()
                self._action_count = max(1, self._action_count)
            self.complete_action()
