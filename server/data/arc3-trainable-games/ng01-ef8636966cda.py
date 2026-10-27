# Author: Claude Sonnet 5.5
# Date: 2026-10-13
# PURPOSE: ng01 -- an ARC-AGI-3 environment, eight levels. The world is a long strip seen through
#   a 16-cell window locked to the walker, so the cave slides past a stationary token. LEFT and
#   RIGHT step one cell (and climb one cell against the pull). ACTION1 / ACTION2 aim the PULL:
#   the walker falls to the roof or back to the floor. ACTION5 swaps the crystal: every crystal
#   block that is solid turns to a ghost and every ghost turns solid. A press that leaves the
#   level unwinnable is a visible death and the level restarts as entered; there is no GAME_OVER.
#   2026-10-13 polish pass on the published version: the pink / maroon / purple-outline look is
#   replaced by a black cave with flat blue rock; the random scatter of decoration that flipped with
#   Space is gone -- only the crystal flips (plus one sealed pair in level 1 that shows the swap with
#   nothing at stake), so Space is tied to exactly the surfaces it changes; every pull and every swap
#   is animated (a fall, a sweep of the green faces, a wave out from the walker); the goal peeks in at
#   the screen edge while it is off screen; the levels went from six to eight, the first now taking
#   eight actions; and a dead end is a visible death with the level restarting as entered, where it
#   used to be GAME_OVER.
# SRP/DRY check: Pass -- self-contained environment. The rule functions (solid, settle, step_target,
#   apply_action, the reverse-search safe set) are the published ones, unchanged.
"""Fall to the roof, fall to the floor, swap the crystal.

ACTION3 / ACTION4 step one cell left / right.  A step onto a ledge one cell higher (higher meaning
against the current pull) is taken automatically; a wall two cells tall refuses.
ACTION1 pulls UP: the walker lets go of the floor, falls to the first solid cell above and hangs
from it.  ACTION2 pulls DOWN again.  The pull is drawn on the cave, not in a HUD: every face the
walker could be held against right now wears a green hairline, so a press sweeps every line in the
frame from the tops of the blocks to their undersides while the walker falls the same way.
ACTION5 swaps the crystal.  Crystal that is there is a white block; crystal that is not is a ghost
of dither.  A press turns every block to a ghost and every ghost to a block, in a wave out from the
walker.  It is refused when the walker's own cell would turn solid (the walker is standing inside a
ghost), and that cell wears purple corner brackets.  Rock never changes.
Any refused press lights the cell that refused it purple for a few frames and bumps the walker into
it.  The goal is a yellow ring; while it is off screen a thin outline of it peeks in at the edge of the
screen on the side it is on.

If the walker ever stands where the goal can no longer be reached (a pit in the middle of a span of
crystal that has just been swapped away, for instance) it dies on the spot: it turns red, melts, and
the level comes back exactly as it was entered.  Red appears nowhere else.  Black is the cave.

8 levels.  No RNG, no timer, no score and no counter of any kind.
"""

from collections import deque

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ---------------------------------------------------------------------------
# Colours (ARC-3 palette indices).  A few saturated colours in big flat fields.
# ---------------------------------------------------------------------------

C_WHITE, C_LGRAY, C_GRAY, C_DGRAY, C_VDGRAY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_LMAGENTA, C_RED, C_BLUE, C_LBLUE = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_MAROON, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

C_AIR = C_BLACK          # the cave: the hard border of everything
C_ROCK = C_BLUE          # solid, and never changes
C_CRYSTAL = C_WHITE      # the only thing Space changes: a block when it is there, a ghost when it is not
C_PULL = C_GREEN         # a hairline on every face the pull could hold the walker against
C_WALKER = C_ORANGE
C_EYE = C_BLACK
C_GOAL = C_YELLOW
C_HURT = C_RED           # pink / red means "this sends you back": only the death uses it
C_DIM = C_DGRAY          # the goal once it can no longer be reached
C_CUE = C_PURPLE         # "no": the cell that refused a press lights up, and the brackets of a locked cell

# ---------------------------------------------------------------------------
# World geometry.  Cells are 4x4 px, so the 64x64 frame shows 16x16 cells out of a strip that is 128
# cells wide.  Rows 0-1 are bedrock roof, the floor mass starts at row 11, so a walker pulled down
# stands on row 10 and a walker pulled up hangs from row 2.
# ---------------------------------------------------------------------------

CELL = 4
WORLD_W, WORLD_H = 128, 16
CEIL = 2
FLOOR = 11

VOID, MAT_A, MAT_B, FIXED = 0, 1, 2, 3
_CHARS = {".": VOID, "#": MAT_A, "o": MAT_B, "=": FIXED, "S": VOID, "G": VOID}

# Polarity 0: MAT_A is solid, MAT_B is absent.  Polarity 1: the two swap.  FIXED is solid in both and
# is the one thing the player can rely on; VOID is open air in both.

# ---------------------------------------------------------------------------
# Level vocabulary.  A level is a cave cut into solid rock, plus a handful of features.  There is no
# random scatter: every block on the screen is either a feature the level means or plain rock.
# ---------------------------------------------------------------------------


def _rect(g, x0, x1, y0, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch


def _cave(x0, x1):
    """Solid rock everywhere, with the open band (rows 2-10) cut between x0 and x1."""
    g = [["="] * WORLD_W for _ in range(WORLD_H)]
    _rect(g, x0, x1, CEIL, FLOOR - 1, ".")
    return g


def _pillar(g, x, w=2, h=2, base=FLOOR):
    """Rock standing on a floor that ends at row base - 1: too tall for the one-cell step, so the
    floor walk stops here and the roof walk passes over."""
    _rect(g, x, x + w - 1, base - h, base - 1, "=")


def _curtain(g, x, w=2, bottom=FLOOR - 2, top=CEIL):
    """Rock hanging from the roof down to row `bottom`: it stops the roof walk and the floor walk
    passes under it."""
    _rect(g, x, x + w - 1, top, bottom, "=")


def _gate(g, x, w, ch):
    """A full-height block of crystal: both walks stop here until the world is swapped."""
    _rect(g, x, x + w - 1, CEIL, FLOOR - 1, ch)


def _slab(g, x0, x1, holes=(), crystals=()):
    """A two-row floor of rock across the middle of the cave (rows 5-6): two storeys, joined only at
    the holes.  A window of crystal in it is a hole when the crystal is absent and floor when it is
    there."""
    _rect(g, x0, x1, 5, 6, "=")
    for h0, h1 in holes:
        _rect(g, h0, h1, 5, 6, ".")
    for c0, c1, ch in crystals:
        _rect(g, c0, c1, 5, 6, ch)


def _lowgate(g, x, w, ch):
    """A block of crystal filling the lower storey."""
    _rect(g, x, x + w - 1, 7, 10, ch)


def _upgate(g, x, w, ch):
    """A block of crystal filling the upper storey."""
    _rect(g, x, x + w - 1, CEIL, 4, ch)


def _lowwall(g, x, w=2):
    """Rock filling the lower storey (rows 7-10) from the slab to the floor."""
    _rect(g, x, x + w - 1, 7, 10, "=")


def _bridge(g, stones, chars):
    """A tunnel two cells high (rows 9-10) with a band of crystal two rows thick above it and below
    it.  `stones` are the x of the rock doorways, which never change; between each pair is a span
    of crystal, `chars[i]` being '#' (solid as the world stands) or 'o' (absent until the world is
    swapped).  Stand in a doorway and the swap is safe; stand inside a span and the swap opens a
    pit above and below you."""
    for x in stones:
        _rect(g, x, x, CEIL, 8, "=")
        _rect(g, x, x, 9, 10, ".")
        _rect(g, x, x, 11, WORLD_H - 1, "=")
    for i, ch in enumerate(chars):
        for x in range(stones[i] + 1, stones[i + 1]):
            _rect(g, x, x, CEIL, 6, "=")
            _rect(g, x, x, 7, 8, ch)
            _rect(g, x, x, 9, 10, ".")
            _rect(g, x, x, 11, 12, ch)
            _rect(g, x, x, 13, WORLD_H - 1, "=")


def _inset(g, x, y, w, h, ch):
    """A block of crystal sunk in solid rock, every side of it rock: it can be seen to swap and can
    never be reached, so it cannot matter."""
    _rect(g, x, x + w - 1, y, y + h - 1, ch)


def _level(g, start, goal, pol=0, grav=1, face=1):
    g[start[1]][start[0]] = "S"
    g[goal[1]][goal[0]] = "G"
    return {"rows": ["".join(r) for r in g], "pol": pol, "grav": grav, "face": face}


# Roles, in order (declared in metadata.json): 1 teach the pull; 2 introduce the crystal; 3 combine the
# pull with the crystal; 4 introduce the two-storey cave; 5 combine the storeys with the crystal; 6 turn
# (the world begins swapped, upside down, with the goal behind you); 7 and 8 compose everything.


# L1 -- the pull, and nothing else.  Everything is on the first screen: a rock pillar two cells
# tall across the floor, the goal beyond it.  Walk, meet the pillar, aim the pull up and the walker
# falls to the roof; walk over, aim the pull down, walk to the ring.  Nothing in it can hurt.
def _l1():
    s = 40
    g = _cave(s - 5, s + 9)
    _pillar(g, s + 3)
    _inset(g, s - 4, 12, 2, 2, "#")           # Space: a block and a ghost in the floor trade places
    _inset(g, s - 1, 12, 2, 2, "o")
    return _level(g, (s, 10), (s + 6, 10))


# L2 -- the crystal.  A full-height gate of crystal blocks the cave, and nothing but Space moves it:
# the gate turns to a ghost and the ghost spans of the tunnel beyond turn solid.  The tunnel is the
# first place the swap can hurt: its floor and roof are crystal, so a swap pressed inside a span, or
# a step into a ghost span, drops the walker into a pit.  The doorway stones between spans are rock.
def _l2():
    s = 30
    g = _cave(s - 5, s + 30)
    _gate(g, s + 4, 2, "#")
    _bridge(g, [s + 9, s + 14, s + 19], ["o", "#"])
    return _level(g, (s, 10), (s + 25, 10))


# L3 -- the pull and the crystal in one problem.  A pillar to cross on the roof, a curtain to pass on
# the floor, then a tunnel of three spans: walk the solid one, swap on the doorway stone, walk the one
# that has just come back, swap again.  A pillar after the tunnel puts the walker on the roof once more.
def _l3():
    s = 26
    g = _cave(s - 5, s + 34)
    _pillar(g, s + 3)
    _curtain(g, s + 8)
    _bridge(g, [s + 12, s + 16, s + 20, s + 24], ["#", "o", "#"])
    _pillar(g, s + 27)
    return _level(g, (s, 10), (s + 31, 10))


# L4 -- two storeys.  A slab of rock halves the cave, so the pull no longer reaches the roof from the
# floor: it passes only through the holes in the slab.  The lower cave is a dead end except for the
# hole at its end.  Upstairs there is a pillar to cross on the roof and a curtain to pass on the
# floor; the next hole is a decoy over a sealed pocket, to be crossed on the roof; the last hole is
# the way down to the goal.
def _l4():
    s = 30
    g = _cave(s - 5, s + 46)
    _slab(g, s - 5, s + 46, holes=[(s + 6, s + 7), (s + 20, s + 21), (s + 36, s + 37)])
    _lowwall(g, s + 8, 2)
    _pillar(g, s + 11, 2, 2, base=5)
    _curtain(g, s + 15, 2, bottom=3)
    _lowwall(g, s + 18, 2)
    _lowwall(g, s + 22, 2)
    _pillar(g, s + 25, 2, 2, base=5)
    _curtain(g, s + 29, 2, bottom=3)
    _pillar(g, s + 32, 1, 2, base=5)
    _lowwall(g, s + 34, 2)
    _lowwall(g, s + 39, 2)
    return _level(g, (s, 10), (s + 37, 10))


# L5 -- the storeys and the crystal.  The slab has windows of crystal.  The first is shut as the world
# stands: swap the world, rise through it, and swap back upstairs, where the second window is solid
# only in the swapped world and so is a trapdoor the moment the world is swapped again.  Below is a
# tunnel of crystal spans, and the goal beyond it.
def _l5():
    s = 24
    g = _cave(s - 5, s + 52)
    _slab(g, s - 5, s + 52, crystals=[(s + 5, s + 6, "#"), (s + 22, s + 23, "o")])
    _lowwall(g, s + 8, 2)
    _pillar(g, s + 10, 2, 2, base=5)
    _curtain(g, s + 14, 2, bottom=3)
    _bridge(g, [s + 28, s + 33, s + 38], ["#", "o"])
    _rect(g, s + 39, s + 52, CEIL, 4, "=")
    return _level(g, (s, 10), (s + 46, 10))


# L6 -- the turn.  The world begins swapped and the walker begins hanging from the roof, so the first
# span of the tunnel is a pit and walking in as before is fatal.  The goal is behind the walker, and it
# hangs from the roof beyond a curtain: the way to it runs under the curtain and back up.
def _l6():
    s = 70
    g = _cave(s - 58, s + 6)
    _curtain(g, s - 4)
    _pillar(g, s - 9)
    _curtain(g, s - 14)
    _bridge(g, [s - 40, s - 35, s - 30, s - 25], ["#", "o", "#"])
    _gate(g, s - 44, 2, "#")
    _curtain(g, s - 49)
    return _level(g, (s, 2), (s - 54, 2), pol=1, grav=-1, face=-1)


# L7 -- everything at full size, on one floor.  Two tunnels and two gates between pillars and curtains.
# The swap has to be read ahead: which kind of crystal is solid decides where the next press must be,
# and the second tunnel begins in the world the first gate left behind.
def _l7():
    s = 16
    g = _cave(s - 5, s + 60)
    _pillar(g, s + 3)
    _curtain(g, s + 8)
    _bridge(g, [s + 12, s + 16, s + 20, s + 24], ["#", "o", "#"])
    _gate(g, s + 28, 2, "#")
    _pillar(g, s + 33)
    _curtain(g, s + 37)
    _bridge(g, [s + 41, s + 45, s + 49], ["o", "#"])
    _gate(g, s + 53, 2, "#")
    return _level(g, (s, 10), (s + 58, 2))


# L8 -- the finale.  Up through a window of crystal, across the upper cave past a pillar, a curtain and a
# gate, down through the second window into the tunnel, through a gate of crystal, and up through the
# third window, past one more pillar and curtain, to the ring hanging from the roof.
def _l8():
    s = 12
    g = _cave(s - 5, s + 84)
    _slab(g, s - 5, s + 84, crystals=[(s + 5, s + 6, "#"), (s + 24, s + 25, "o"), (s + 55, s + 56, "#")])
    _lowwall(g, s + 8, 2)
    _pillar(g, s + 10, 2, 2, base=5)
    _curtain(g, s + 14, 2, bottom=3)
    _upgate(g, s + 19, 2, "o")
    _bridge(g, [s + 30, s + 35, s + 40, s + 45], ["#", "o", "#"])
    _lowgate(g, s + 49, 2, "#")
    _pillar(g, s + 60, 2, 2, base=5)
    _curtain(g, s + 64, 2, bottom=3)
    return _level(g, (s, 10), (s + 70, CEIL))


LEVELS = [_l1(), _l2(), _l3(), _l4(), _l5(), _l6(), _l7(), _l8()]

# ---------------------------------------------------------------------------
# Parsed level tables
# ---------------------------------------------------------------------------


def _parse(ldef):
    rows = ldef["rows"]
    grid = [[_CHARS[ch] for ch in row] for row in rows]
    start = goal = None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "S":
                start = (x, y)
            elif ch == "G":
                goal = (x, y)
    return grid, start, goal, ldef["pol"], ldef["grav"], ldef["face"]


_TABLES = [_parse(ldef) for ldef in LEVELS]

# ---------------------------------------------------------------------------
# World rules.  Pure functions of (grid, polarity), so the game, the solver and the dead-end check
# all run on exactly one implementation.
# ---------------------------------------------------------------------------

GRAV_DOWN, GRAV_UP = 1, -1


def solid(grid, x, y, pol):
    """Is cell (x, y) solid at this polarity?  Outside the strip is solid bedrock."""
    if y >= WORLD_H or y < 0 or x < 0 or x >= WORLD_W:
        return True
    c = grid[y][x]
    return c == FIXED or (c == MAT_A and pol == 0) or (c == MAT_B and pol == 1)


def settle(grid, x, y, pol, grav):
    """Discrete gravity: fall along the pull until the next cell that way is solid."""
    while not solid(grid, x, y + grav, pol):
        y += grav
    return y


def step_target(grid, x, y, pol, grav, f):
    """Where a sideways press lands the walker, or None if a wall refuses it.  A clear cell ahead is a
    plain step, then a fall.  A cell ahead that is solid but only one cell tall (measured against the
    pull) is taken automatically, provided the walker's own cell above it is clear.  Anything taller
    refuses."""
    if not solid(grid, x + f, y, pol):
        return (x + f, settle(grid, x + f, y, pol, grav))
    ny = y - grav
    if (0 <= ny < WORLD_H and not solid(grid, x + f, ny, pol)
            and not solid(grid, x, ny, pol)):
        return (x + f, settle(grid, x + f, ny, pol, grav))
    return None


def _clip(y):
    return max(0, min(WORLD_H - 1, y))


def blocker(grid, state, aid):
    """The cell that refused this press, so the answer to "why not" is drawn where the obstacle is."""
    x, y, pol, grav = state
    if aid in (1, 2):
        return (x, _clip(y + grav))                   # the face the walker is already held against
    if aid in (3, 4):
        d = -1 if aid == 3 else 1
        if solid(grid, x + d, y, pol):
            return (x + d, y)                          # a wall two cells tall
        return (x, _clip(y - grav))                   # no room above the walker to swing up
    return (x, y)                                      # ACTION5: its own cell would close on it


def apply_action(grid, state, aid):
    """(x, y, pol, gravity) + action id -> new state.  Refused moves return the state unchanged."""
    x, y, pol, grav = state
    if aid == 1 or aid == 2:
        want = GRAV_UP if aid == 1 else GRAV_DOWN
        if grav != want:
            grav = want
            y = settle(grid, x, y, pol, grav)
    elif aid == 3 or aid == 4:
        t = step_target(grid, x, y, pol, grav, -1 if aid == 3 else 1)
        if t is not None:
            x, y = t
    elif aid == 5:
        if not solid(grid, x, y, 1 - pol):
            pol = 1 - pol
            y = settle(grid, x, y, pol, grav)
    return (x, y, pol, grav)


ACTION_IDS = (1, 2, 3, 4, 5)


def _safe_states(grid, goal):
    """Every (x, y, pol, gravity) from which the goal is still reachable: a reverse breadth-first
    search over the whole transition graph, built once per level.  A state outside this set is a dead
    end -- no sequence of walks, pulls and swaps reaches the goal."""
    nodes = [(x, y, p, g)
             for x in range(WORLD_W) for y in range(WORLD_H)
             for p in (0, 1) for g in (GRAV_UP, GRAV_DOWN)]
    back = {n: [] for n in nodes}
    for n in nodes:
        for aid in ACTION_IDS:
            m = apply_action(grid, n, aid)
            if m != n:
                back[m].append(n)
    safe = {n for n in nodes if (n[0], n[1]) == goal}
    queue = deque(safe)
    while queue:
        n = queue.popleft()
        for p in back.get(n, ()):
            if p not in safe:
                safe.add(p)
                queue.append(p)
    return safe


_SAFE_CACHE = {}


def safe_states(index):
    if index not in _SAFE_CACHE:
        grid, _start, goal = _TABLES[index][:3]
        _SAFE_CACHE[index] = frozenset(_safe_states(grid, goal))
    return _SAFE_CACHE[index]


# ---------------------------------------------------------------------------
# Pictures.  The strip is baked once per (level, polarity, pull) and a frame is a slice of it.
# ---------------------------------------------------------------------------

_IMG = {}


def world_image(index, pol, grav):
    """The whole 512x64-pixel strip for one polarity and one pull direction: black cave, blue rock,
    white crystal where the crystal is, a dither ghost where it is not, and a one-pixel green
    hairline on every face the pull could hold the walker against."""
    key = (index, pol, grav)
    img = _IMG.get(key)
    if img is not None:
        return img
    cells = np.array(_TABLES[index][0], dtype=np.int16)
    h = cells.shape[0]
    sol = (cells == FIXED) | ((cells == MAT_A) & (pol == 0)) | ((cells == MAT_B) & (pol == 1))
    mat = (cells == MAT_A) | (cells == MAT_B)

    def big(m):
        return np.repeat(np.repeat(m, CELL, axis=0), CELL, axis=1)

    img = np.full((h * CELL, WORLD_W * CELL), C_AIR, dtype=np.int16)
    img[big(cells == FIXED)] = C_ROCK
    img[big(mat & sol)] = C_CRYSTAL
    yy, xx = np.indices(img.shape)
    img[big(mat & ~sol) & ((xx + yy) % 2 == 0)] = C_CRYSTAL
    # Edges step: where a block sticks out into the open the corner pixel is shaved, so a pillar is a
    # rounded shape and not a grid cell.
    hh, ww = sol.shape
    for y, x in np.argwhere(sol):
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            nx_, ny_ = x + dx, y + dy
            if not (0 <= nx_ < ww and 0 <= ny_ < hh):
                continue
            if sol[y, nx_] or sol[ny_, x] or sol[ny_, nx_]:
                continue
            img[y * CELL + (0 if dy < 0 else CELL - 1), x * CELL + (0 if dx < 0 else CELL - 1)] = C_AIR
    # The pull, drawn on the world and nowhere else: a solid cell whose anti-pull neighbour is open is
    # a face the walker could be held against right now.  The hairline goes in the last pixel of the
    # OPEN cell, so it never covers a pixel of rock.
    for y, x in np.argwhere(sol):
        oy = y - grav
        if 0 <= oy < h and not sol[oy, x]:
            row = y * CELL - 1 if grav > 0 else y * CELL + CELL
            x0, x1 = x * CELL, x * CELL + CELL
            if x > 0 and not sol[y, x - 1] and not sol[oy, x - 1]:      # a shaved corner shortens the
                x0 += 1                                                  # line that runs over it
            if x < ww - 1 and not sol[y, x + 1] and not sol[oy, x + 1]:
                x1 -= 1
            img[row, x0:x1] = C_PULL
    _IMG[key] = img
    return img


def ring_top(index):
    """Which of the goal cell's two rows the 8x8 ring hangs from: a floor goal takes the cell above,
    a roof goal takes the cell below."""
    grid, _start, (gx, gy) = _TABLES[index][:3]
    above_free = not (solid(grid, gx, gy - 1, 0) or solid(grid, gx, gy - 1, 1))
    return gy - 1 if above_free else gy


# The walker is a 4x8 figure: the physics cell is the body, and the head is the cell on the side away
# from the pull, so the token says which way it is pulled by being the right way up.  The last row
# next to the surface is left clear: that is where the green hairline of the face it stands on shows.
_STAND = (".OO.",
          "OOOO",
          "OOKO",
          ".OO.",
          "OOOO",
          ".OO.",
          "O..O",
          "....")
_WALK = {}
for _f in (-1, 1):
    _rows = tuple(r if _f > 0 else r.replace("OOKO", "OKOO") for r in _STAND)
    _WALK[(_f, GRAV_DOWN)] = _rows
    _WALK[(_f, GRAV_UP)] = tuple(reversed(_rows))
# Mid-turn the walker is on its side: the figure turned a quarter.
_TURN = {}
for _f in (-1, 1):
    _src = _WALK[(_f, GRAV_DOWN)]
    _TURN[_f] = tuple("".join(_src[7 - r][c] for r in range(8)) for c in range(4))

# The goal is an 8x8 ring, round where the walker is square, and the only yellow in the game.
_RING = (("..YYYY.."),
         (".YYYYYY."),
         ("YYY..YYY"),
         ("YY....YY"),
         ("YY....YY"),
         ("YYY..YYY"),
         (".YYYYYY."),
         ("..YYYY.."))

# The same ring as a one-pixel outline: what peeks in at the edge of the screen while the goal is off it.
_RING_EDGE = (("..YYYY.."),
              (".Y....Y."),
              ("Y......Y"),
              ("Y......Y"),
              ("Y......Y"),
              ("Y......Y"),
              (".Y....Y."),
              ("..YYYY.."))
POINTER_SHOW = 6             # how many of the ring's eight columns peek in at the edge of the screen

_MELT = (0, 0, 0, 2, 4, 6, 8, 8, 8, 8, 8, 8)


def _cam(px):
    """Camera x in world pixels: the walker dead centre, clamped at the two ends of the strip."""
    return max(0, min(WORLD_W * CELL - 64, px - 32))


def _fall_offsets(k):
    """Cumulative pixel offsets, one per frame, of a fall of k cells: slow at first and then faster,
    which is what a fall looks like and what a jump does not."""
    if k <= 0:
        return []
    n = 2 if k <= 2 else 3 if k <= 4 else 4 if k <= 8 else 5
    total = k * CELL
    out, prev = [], 0
    for i in range(1, n + 1):
        v = total if i == n else min(total - 1, max(prev + 1, int(round(total * (i / n) ** 2))))
        out.append(v)
        prev = v
    return out


def make_view(by, px, g, face, pol, grav_img=None, **kw):
    """One frame, described: the walker's body-cell top (world px), its box left, its orientation, and
    whatever is happening to it."""
    v = {"px": px, "by": by, "g": g, "face": face, "img": (pol, g if grav_img is None else grav_img),
         "img2": None, "mask": None, "ox": 0, "oy": 0, "outline": None, "lock": False,
         "head": True, "hurt": False, "melt": 0, "fill": 0, "dim": False, "hide": False,
         "turn": False, "burst": 0}
    v.update(kw)
    return v


def rest_view(index, state, face):
    """The settled picture of a state."""
    grid = _TABLES[index][0]
    x, y, pol, grav = state
    return make_view(y * CELL, x * CELL, grav, face, pol,
                     lock=solid(grid, x, y, 1 - pol),
                     head=not solid(grid, x, y - grav, pol))


# ---------------------------------------------------------------------------
# Animation planning.  The outcome of a press is decided once, by the rules above; these only show it.
# Every plan ends on the settled picture of the new state.  Budget: a step is 2 frames, a step and a
# fall up to 6, a pull or a swap 5-6, a refusal 4.
# ---------------------------------------------------------------------------


def plan_refusal(index, state, face, aid):
    grid = _TABLES[index][0]
    cell = blocker(grid, state, aid)
    x, y, pol, g = state
    if aid in (3, 4):
        dx, dy = (-1 if aid == 3 else 1), 0
    else:
        dx, dy = 0, g
    base = rest_view(index, state, face)
    frames = []
    for amount in (1, 2, 2):
        frames.append(dict(base, ox=dx * amount, oy=dy * amount, outline=cell))
    frames.append(base)
    return frames


def plan_step(index, old, new, face, aid):
    grid = _TABLES[index][0]
    x, y, pol, g = old
    nx, ny = new[0], new[1]
    f = nx - x
    out = []
    if solid(grid, x + f, y, pol):                     # the one-cell climb: up and over in two frames
        out.append(make_view(y * CELL - g * 2, x * CELL + f * 2, g, face, pol))
    else:
        out.append(make_view(y * CELL, x * CELL + f * 2, g, face, pol))
        offs = _fall_offsets(abs(ny - y))
        if offs:
            out.append(make_view(y * CELL, nx * CELL, g, face, pol))
            for off in offs[:-1]:
                out.append(make_view(y * CELL + g * off, nx * CELL, g, face, pol))
    out.append(rest_view(index, new, face))
    return out


def plan_pull(index, old, new, face):
    """The pull changes: the walker turns, then falls toward its new surface while a sweep carries
    every green hairline in the frame from one face of the rock to the other."""
    x, y, pol, g = old
    g2, ny = new[3], new[1]
    offs = _fall_offsets(abs(ny - y))
    total = max(5, len(offs) + 2)
    out = []
    for t in range(total - 1):
        front = int(round(64 * (t + 1) / total))
        mask = ("sweep", front, g2)
        if t == 0:
            out.append(make_view(y * CELL, x * CELL, g2, face, pol, grav_img=g2, img2=(pol, g),
                                 mask=mask, turn=True))
            continue
        off = offs[min(t, len(offs)) - 1] if offs else 0
        out.append(make_view(y * CELL + g2 * off, x * CELL, g2, face, pol, grav_img=g2, img2=(pol, g),
                             mask=mask))
    out.append(rest_view(index, new, face))
    return out


def plan_swap(index, old, new, face):
    """The crystal swaps: a wave runs out from the walker, and whatever it has passed is in its new
    state.  If the footing went with it the walker falls while the wave runs."""
    x, y, pol, g = old
    pol2, ny = new[2], new[1]
    offs = _fall_offsets(abs(ny - y))
    total = max(5, len(offs) + 2)
    out = []
    for t in range(total - 1):
        off = (offs[min(t, len(offs)) - 1] if t >= 1 else 0) if offs else 0
        out.append(make_view(y * CELL + g * off, x * CELL, g, face, pol2, img2=(pol, g),
                             mask=("wave", 16 * (t + 1), y * CELL + 2)))
    out.append(rest_view(index, new, face))
    return out


def plan_capture(index, state, face):
    """The walker steps into the ring and the ring fills.  The last level pays off: a ring of light runs
    out from the goal across the whole picture."""
    base = rest_view(index, state, face)
    out = [dict(base, fill=1), dict(base, fill=2)]
    if index == len(LEVELS) - 1:
        out += [dict(base, fill=2, hide=True, burst=r) for r in (10, 22, 34, 46, 58)]
    out.append(dict(base, fill=2, hide=True))
    return out


def plan_death(index, state, face, count):
    base = rest_view(index, state, face)
    return [dict(base, hurt=True, dim=True, melt=_MELT[min(i, len(_MELT) - 1)]) for i in range(count)]


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------


def _blit(frame, x, y, rows, colour_of, lo=0, hi=None):
    hi = len(rows) if hi is None else hi
    for r in range(lo, hi):
        row = rows[r]
        for c, ch in enumerate(row):
            if ch == ".":
                continue
            xx, yy = x + c, y + r
            if 0 <= xx < 64 and 0 <= yy < 64:
                frame[yy, xx] = colour_of[ch]


def draw_view(frame, index, v):
    grid, _start, goal = _TABLES[index][:3]
    cx = _cam(v["px"])
    new = world_image(index, *v["img"])[:, cx:cx + 64]
    mask = v["mask"]
    ring_extra = None
    if mask is None:
        frame[:, :] = new
    else:
        old = world_image(index, *v["img2"])[:, cx:cx + 64]
        if mask[0] == "sweep":
            _kind, front, g2 = mask
            frame[:, :] = old
            if g2 > 0:
                frame[:front, :] = new[:front, :]
            else:
                frame[64 - front:, :] = new[64 - front:, :]
        else:
            _kind, r, cy = mask
            yy, xx = np.indices((64, 64))
            d2 = (xx - (v["px"] - cx + 2)) ** 2 + (yy - cy) ** 2
            inside = d2 <= r * r
            frame[:, :] = np.where(inside, new, old)
            ring_extra = inside & (d2 > (r - 2) ** 2)

    # The goal: a ring.  While it is off screen it peeks in at the edge as a thin outline, so the player
    # knows which way to go; once it is on screen it is the solid ring.
    gx0 = goal[0] * CELL - 2 - cx
    gy0 = ring_top(index) * CELL
    far = False
    if gx0 > 64 - POINTER_SHOW:
        gx0, far = 64 - POINTER_SHOW, True
    elif gx0 < POINTER_SHOW - 8:
        gx0, far = POINTER_SHOW - 8, True
    colour = C_DIM if v["dim"] else C_GOAL
    ring = _RING_EDGE if far else _RING
    for r, row in enumerate(ring):
        for c, ch in enumerate(row):
            if ch == ".":
                if v["fill"] and 2 <= c <= 5 and 2 <= r <= 5 and (v["fill"] == 2 or (c + r) % 2 == 0):
                    pass
                else:
                    continue
            xx, yy = gx0 + c, gy0 + r
            if 0 <= xx < 64 and 0 <= yy < 64:
                frame[yy, xx] = colour

    if v["outline"] is not None:
        # the cell that refused the press lights up in the "no" colour, under the walker
        ox_, oy_ = v["outline"][0] * CELL - cx, v["outline"][1] * CELL
        for yy in range(oy_, oy_ + CELL):
            for xx in range(ox_, ox_ + CELL):
                if 0 <= xx < 64 and 0 <= yy < 64:
                    frame[yy, xx] = C_CUE

    bx, by = v["px"] - cx, v["by"]
    if v["lock"]:
        for dx, dy in ((-1, -1), (0, -1), (-1, 0), (4, -1), (3, -1), (4, 0),
                       (-1, 4), (0, 4), (-1, 3), (4, 4), (3, 4), (4, 3)):
            xx, yy = bx + dx, by + dy
            if 0 <= xx < 64 and 0 <= yy < 64:
                frame[yy, xx] = C_CUE

    if not v["hide"]:
        body = C_HURT if v["hurt"] else C_WALKER
        pal = {"O": body, "K": C_EYE}
        if v["turn"]:
            _blit(frame, bx - 2 + v["ox"], by + v["oy"], _TURN[v["face"]], pal)
        else:
            rows = _WALK[(v["face"], v["g"])]
            top = by - CELL if v["g"] > 0 else by
            lo, hi = 0, 8
            if not v["head"]:
                lo, hi = (4, 8) if v["g"] > 0 else (0, 4)
            if v["melt"]:
                if v["g"] > 0:
                    lo = max(lo, v["melt"])
                else:
                    hi = min(hi, 8 - v["melt"])
            _blit(frame, bx + v["ox"], top + v["oy"], rows, pal, lo, hi)

    if ring_extra is not None:
        frame[ring_extra] = C_CRYSTAL
    if v["burst"]:
        yy, xx = np.indices((64, 64))
        d2 = (xx - (goal[0] * CELL + 2 - cx)) ** 2 + (yy - (gy0 + 4)) ** 2
        frame[(d2 <= v["burst"] ** 2) & (d2 > (v["burst"] - 3) ** 2)] = C_GOAL
    return frame


class Ng01Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        view = g.view
        if view is None:
            view = rest_view(g.level_index, (g.wx, g.wy, g.pol, g.grav), g.facing)
        return draw_view(frame, g.level_index, view)


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

DEATH_BUDGET = 14            # frames in the longest action, death included (the site plays about 30 a second)


class Ng01(ARCBaseGame):
    def __init__(self):
        self.display = Ng01Display(self)

        # on_set_level() runs inside super().__init__(), so every attribute it and the display touch has
        # to exist before the call.
        self.wx = self.wy = 0
        self.pol = 0
        self.grav = GRAV_DOWN
        self.facing = 1
        self.view = None
        self.queue = []
        self.after = ""

        levels = [Level(sprites=[], grid_size=(64, 64), data={"n": i + 1}, name=str(i + 1))
                  for i in range(len(LEVELS))]

        super().__init__(
            "ng01",
            levels,
            Camera(0, 0, 64, 64, C_AIR, C_AIR, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5],     # 1/2 = pull up/down, 3/4 = step left/right, 5 = swap the crystal
        )

    # -- level setup --------------------------------------------------------

    def _enter(self):
        """Put every field in the state the level is entered in.  The one place that does it: a new
        level, RESET, and a death all come through here, so they cannot disagree."""
        grid, start, _goal, pol0, grav0, face0 = _TABLES[self.level_index]
        self.wx, self.wy = start
        self.pol, self.grav = pol0, grav0
        self.wy = settle(grid, self.wx, self.wy, self.pol, self.grav)
        self.facing = face0
        self.view = None
        self.queue = []
        self.after = ""
        safe_states(self.level_index)                  # built once per level, here, not on the first press

    def on_set_level(self, level: Level) -> None:
        self._enter()

    # -- engine entry point -------------------------------------------------

    def _begin(self, aid):
        """Decide what this press does, update the state, and queue the frames that show it."""
        idx = self.level_index
        grid = _TABLES[idx][0]
        old = (self.wx, self.wy, self.pol, self.grav)
        if aid in (3, 4):
            self.facing = -1 if aid == 3 else 1          # decoration, and free even when refused
        new = apply_action(grid, old, aid)
        face = self.facing
        if new == old:
            self.queue = plan_refusal(idx, old, face, aid)
            return
        if aid in (3, 4):
            frames = plan_step(idx, old, new, face, aid)
        elif aid in (1, 2):
            frames = plan_pull(idx, old, new, face)
        else:
            frames = plan_swap(idx, old, new, face)
        self.wx, self.wy, self.pol, self.grav = new
        if (new[0], new[1]) == _TABLES[idx][2]:
            self.queue = frames + plan_capture(idx, new, face)
            self.after = "win"
        elif new not in safe_states(idx):
            hold = max(7, DEATH_BUDGET - 1 - len(frames))
            self.queue = frames + plan_death(idx, new, face, hold) + ["restart"]
            self.after = "dead"
        else:
            self.queue = frames

    def step(self) -> None:
        aid = self.action.id.value
        if aid not in ACTION_IDS:
            # RESET and anything unmapped: no state change.  The level was already put back by the engine.
            self.complete_action()
            return
        if not self.queue:
            self._begin(aid)
        item = self.queue.pop(0)
        if item == "restart":
            self._enter()                                  # the level exactly as it was entered
        else:
            self.view = item
        if not self.queue:
            after = self.after
            self.after = ""
            if after == "win":
                self.next_level()                          # the engine shows the next level on the next frame
            elif after != "dead":
                self.view = None                           # settled: the picture is the state
            self.complete_action()
