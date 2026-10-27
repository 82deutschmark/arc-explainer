# Author: Claude Opus 5.5 High (the build); Mark Barney (the design, 18-Oct-2026); hero, hearts, guard faces,
#   progress bar and finish animation adapted from fn01 (Claude Opus 5.5 High, Claude Fable 5.1 Low, Claude Opus 5)
# Date: 18-October-2026 (energy cells, 22-October-2026)
# CHANGELOG: 22-Oct-2026 (Claude Opus 5.5 Medium) -- energy cells and a looser bar, the Boss's ask: the old budget was
#   the cheapest line plus two clicks, so one wrong dig lost the level. Budgets now leave about a third spare, and
#   each level has energy cells (a blue battery in the sand) that refill the bar by ENERGY_FILL clicks, capped at
#   full. They fall like hearts. can_go_on now digs too once a refill on foot has put clicks back.
# 18-Oct-2026 (Claude Opus 5.5 High) -- first version. fn01's climb turned upside down into a dig
#   through a desert underworld, to the Boss's design (fn01-rethink/design.md). Arrows move (one cell of climb
#   against sand or earth), a click digs a neighbouring cell (sand one click, packed earth two, rock three,
#   bedrock never) out of a click budget drawn as the side bar's draining background, space lights a carried
#   star for eight free moves. Sand, hearts, stars and red-eyed droppers fall into any pocket opened under them.
#   Creatures wear their strength as stripes; a fight trades punches until the last stripe goes, and a dropper
#   that lands on the hero's head starts one by itself (it "drops in on you while you dig"). Eight levels,
#   written by gen_dig.py between the LEVELS markers.
# PURPOSE: dz01 -- dig down a shaft of sand, packed earth and rock to the checkered finish at the bottom.
#   The rules live in pure functions on a small DigState (act, settle, can_go_on), shared by the game (which
#   animates the frames act() records), by gen_dig.py (whose search plays the same act() to find each level's
#   cheapest line) and by the checks in this folder. Reads nothing; the levels are the LEVELS list below.
#   Plugs into arcengine 0.9.3 as an ARCBaseGame with actions 1-6 (6 is a click with x, y).
# SRP/DRY check: Pass -- the hero art, heart and star shapes, the guard-style faces, the death poof and the
#   restart-without-losing-progress fix come from fn01 (../fn01-next5/fn01.py); the world, the actions and the
#   creatures are new. Nothing here duplicates a helper elsewhere in the repo (games must be one file).
"""Dz01 -- dig down to the checkered floor.

Click a cell next to the hero to dig it: sand goes in one click, packed earth in two, rock in three; bedrock
never. Each click comes out of the bar at the side. The hero falls into whatever he opens, and loose sand,
hearts, stars and red-eyed creatures fall into pockets opened under them. Walk into a creature to fight it:
you punch out a stripe, it punches out a heart, until its last stripe goes. Space lights a star you carry.
"""

import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay

# ---------------------------------------------------------------------------
# Palette (ARC-3 indices). No greys anywhere: the early-console look the Boss asked for.
# ---------------------------------------------------------------------------
C_WHITE, C_BLACK = 0, 5
C_RED, C_BLUE, C_LBLUE = 8, 9, 10
C_YELLOW, C_ORANGE, C_MAROON, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

# ---------------------------------------------------------------------------
# Geometry: a shaft eight cells wide, cells seven pixels square, nine rows on screen; the panel on the right
# holds the hearts, the star slot and the bar (budget as its draining background, the hero's depth as a dot,
# the checkered finish at its foot).
# ---------------------------------------------------------------------------
W = 8
CELL = 7
VIEW = 9
PANEL_X = W * CELL          # 56
HERO_ROW_ON_SCREEN = 3      # the view keeps the hero on the fourth row while it can
ENERGY_FILL = 8             # clicks an energy cell puts back in the bar (never past full)
STAR_LEN = 8                # a lit star lasts eight moves: one spark of the ring per move
MAX_HEARTS = 3

# ---------------------------------------------------------------------------
# Cells. Creatures are CRE + stripes (1 crab, 2 mole, 3 worm), plus DROP for a red-eyed dropper.
# ---------------------------------------------------------------------------
AIR, SAND, EARTH, EARTH1, ROCK, ROCK1, ROCK2, BED, HEART, STAR, ENERGY = range(11)
CRE, DROP = 16, 4
ITEMS = (HEART, STAR, ENERGY)
PASS = (AIR, HEART, STAR, ENERGY)                 # what the hero can step or fall into
CLIMB = (SAND, EARTH, EARTH1)            # what the hero can climb one cell against
DIG_NEXT = {SAND: AIR, EARTH: EARTH1, EARTH1: AIR, ROCK: ROCK1, ROCK1: ROCK2, ROCK2: AIR}
CHARS = {".": AIR, "s": SAND, "e": EARTH, "r": ROCK, "#": BED, "h": HEART, "*": STAR, "+": ENERGY,
         "c": CRE + 1, "m": CRE + 2, "w": CRE + 3, "C": CRE + 1 + DROP, "M": CRE + 2 + DROP, "W": CRE + 3 + DROP}
NEIGH = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}


def is_cre(v):
    return v >= CRE


def cre_stripes(v):
    return (v - CRE) & 3


def falls(v):
    """Loose things fall into air under them: sand, hearts, stars, energy cells and droppers. Earth, rock, bedrock and
    ordinary creatures (they cling to their pocket) never do."""
    return v == SAND or v == HEART or v == STAR or v == ENERGY or (v >= CRE and (v - CRE) & DROP)


# ---------------------------------------------------------------------------
# The rules: pure functions on a DigState, shared by the game, the generator and the checks
# ---------------------------------------------------------------------------

class DigState:
    """Everything that decides the future of a level: the ground (one byte a cell, row-major, W wide), the
    hero's cell, hearts, clicks left (never more than full), a carried star, a lit star's moves left, and whether the hero is perched
    (he climbed one cell and holds on until he moves)."""
    __slots__ = ("g", "h", "r", "c", "hearts", "clicks", "full", "star", "lit", "perched")

    def copy(self):
        s = DigState.__new__(DigState)
        s.g = bytearray(self.g)
        s.h, s.r, s.c = self.h, self.r, self.c
        s.hearts, s.clicks, s.full = self.hearts, self.clicks, self.full
        s.star, s.lit, s.perched = self.star, self.lit, self.perched
        return s

    def key(self):
        return (bytes(self.g), self.r, self.c, self.hearts, self.clicks, self.star, self.lit, self.perched)

    def at(self, r, c):
        if c < 0 or c >= W or r < 0:
            return BED                     # the shaft walls and the sky above the surface are not ground
        if r >= self.h:
            return BED                     # the finish floor
        return self.g[r * W + c]


def parse_level(spec):
    """A level spec (rows of characters, hero cell, hearts, click budget) -> a settled DigState."""
    s = DigState.__new__(DigState)
    rows = spec["rows"]
    s.h = len(rows)
    s.g = bytearray(CHARS[ch] for row in rows for ch in row)
    s.r, s.c = spec["hero"]
    s.hearts = spec["hearts"]
    s.clicks = s.full = spec["budget"]
    s.star, s.lit, s.perched = 0, 0, False
    s.g[s.r * W + s.c] = AIR
    settle(s)
    return s


def cam_top(r, h):
    """Top row on screen: the view follows the hero down the shaft and stops with the finish on the bottom row."""
    return max(0, min(r - HERO_ROW_ON_SCREEN, h + 1 - VIEW))


def cell_xy(r, c, hero_r, h):
    """Screen point of a cell's centre, the click that digs it (used by the generator's lines)."""
    return c * CELL + CELL // 2, (r - cam_top(hero_r, h)) * CELL + CELL // 2


def _pickup(s):
    """The hero has just entered his cell: a heart, a star or an energy cell there is his."""
    i = s.r * W + s.c
    v = s.g[i]
    if v == HEART:
        s.hearts = min(MAX_HEARTS, s.hearts + 1)
        s.g[i] = AIR
        return "heart"
    if v == STAR:
        s.star = 1
        s.g[i] = AIR
        return "star"
    if v == ENERGY:
        s.clicks = min(s.full, s.clicks + ENERGY_FILL)
        s.g[i] = AIR
        return "energy"
    return None


def settle(s, rec=None):
    """Gravity, one cell a tick, until nothing moves. Each tick scans bottom-up so a column falls together as a
    block. The hero falls unless perched; things fall onto him and rest there (he holds them up). rec(s, fx), when
    given, records a frame per tick. Returns the pickups made while falling."""
    got = []
    g = s.g
    for _ in range(2 * s.h + 4):
        moved = False
        for row in range(s.h - 2, -1, -1):
            base = row * W
            for col in range(W):
                if s.r == row and s.c == col:
                    if not s.perched and g[base + W + col] in PASS:
                        s.r += 1
                        moved = True
                        p = _pickup(s)
                        if p:
                            got.append(p)
                    continue
                v = g[base + col]
                if v and falls(v) and g[base + W + col] == AIR and not (s.r == row + 1 and s.c == col):
                    g[base + W + col] = v
                    g[base + col] = AIR
                    moved = True
        if not moved:
            break
        if rec:
            rec(s, {"fall": True})
    return got


class Result:
    """What act() did: the outcome ('win', 'die' or None), whether anything happened, the clicks spent, the
    hearts lost in fights, whether a rock cell was dug (the generator's keep rules read those two), and whether a
    dropper landed on the hero and was fought."""
    __slots__ = ("outcome", "acted", "spent", "hurt", "rock", "lit_used", "why", "dropped_on")

    def __init__(self):
        self.outcome, self.acted, self.spent, self.hurt, self.rock, self.lit_used, self.why = None, False, 0, 0, False, False, None
        self.dropped_on = False                 # a dropper landed on the hero this move and was fought


def act(s, a, cell=None, rec=None, check=True):
    """Play one action on a copy of s. a is 1-4 (up, down, left, right), 5 (space) or 6 (dig `cell`, a (row,
    col)). rec(state, fx) records animation frames; the game passes one, the search does not. With check, a
    level that can no longer be finished (no clicks left and the finish out of reach on foot) is a death.
    Returns (new state, Result)."""
    s = s.copy()
    res = Result()
    snap = rec or (lambda st, fx: None)

    if a == 5:
        if s.star and not s.lit:
            s.star, s.lit = 0, STAR_LEN
            res.acted = True
            snap(s, {"light": 2})
            snap(s, {"light": 1})
        else:
            snap(s, {"slot_flash": True})       # an answer, no cost: the empty slot flashes
        return s, res

    lit_now = s.lit > 0
    if a in NEIGH:
        dr, dc = NEIGH[a]
        tr, tc = s.r + dr, s.c + dc
        v = s.at(tr, tc)
        if is_cre(v):
            _fight(s, tr, tc, v, res, snap)
        elif a == 1:
            side = (s.at(s.r, s.c - 1) in CLIMB) or (s.at(s.r, s.c + 1) in CLIMB)
            if not s.perched and v in PASS and side:
                s.r = tr
                s.perched = True
                res.acted = True
                p = _pickup(s)
                snap(s, {"pick": p} if p else {})
            else:
                _nudge(s, dr, dc, snap)
        elif v in PASS and tr < s.h:
            s.r, s.c = tr, tc
            s.perched = False
            res.acted = True
            p = _pickup(s)
            snap(s, {"step": (dr, dc)} if not p else {"pick": p})
        else:
            _nudge(s, dr, dc, snap)
    elif a == 6:
        _dig(s, cell, res, snap)

    if res.outcome == "die":
        return s, res
    if res.acted:
        held = {i for i, v in enumerate(s.g) if v >= CRE and (v - CRE) & DROP}
        for p in settle(s, rec):
            snap(s, {"pick": p})
        # a dropper that came down this move and landed on the hero's head drops in on him: the fight starts at
        # once, the same punch trade as walking into it (a lit hero flattens it); then the sand behind it settles
        top = (s.r - 1) * W + s.c
        if s.r >= 1 and s.g[top] >= CRE and (s.g[top] - CRE) & DROP and top not in held:
            _fight(s, s.r - 1, s.c, s.g[top], res, snap)
            if res.outcome == "die":
                return s, res
            res.dropped_on = True
            for p in settle(s, rec):
                snap(s, {"pick": p})
        if lit_now and s.lit > 0:
            s.lit -= 1                          # one spark of the ring goes out per move
            res.lit_used = True
            snap(s, {})
    if s.r >= s.h - 1:
        res.outcome = "win"
    elif check and res.acted and not can_go_on(s):
        res.outcome = "die"
        res.why = "budget"
    return s, res


def _nudge(s, dr, dc, snap):
    """Solid ground (or the shaft wall): the hero leans into it and back, nothing spent."""
    snap(s, {"lean": (dr, dc)})
    snap(s, {})


def _fight(s, tr, tc, v, res, snap):
    """Walk into a creature: the hero punches a stripe out, it punches a heart out, until its last stripe goes;
    a creature whose last stripe falls never lands its hit. A lit hero flattens it at no cost. The hero keeps
    his cell; the pocket opens and whatever was above it falls in (settled by act)."""
    n = cre_stripes(v)
    res.acted = True
    i = tr * W + tc
    if s.lit:
        snap(s, {"punch": (tr, tc), "stripes_out": n, "flat": True})
        s.g[i] = AIR
        return
    for k in range(1, n + 1):
        # the hero's punch: a spark where they meet and stripe k goes out; then a beat to see it
        snap(s, {"punch": (tr, tc), "stripes_out": k, "spark": (tr, tc)})
        snap(s, {"show": (tr, tc), "stripes_out": k})
        if k < n:
            s.hearts -= 1
            res.hurt += 1
            if s.hearts <= 0:
                # the last heart is gone: the creature that took it turns red and the hero breaks
                for b in range(1, 6):
                    snap(s, {"hit_back": (tr, tc), "stripes_out": k, "red": (tr, tc), "poof": b})
                res.outcome = "die"
                res.why = "fight"
                return
            # its punch back: it lunges, the hero flashes red and a heart goes dark; then a beat
            snap(s, {"hit_back": (tr, tc), "stripes_out": k, "spark": (tr, tc), "hurt": True})
            snap(s, {"show": (tr, tc), "stripes_out": k})
    snap(s, {"crumple": (tr, tc), "stripes_out": n})
    s.g[i] = AIR


def _dig(s, cell, res, snap):
    """Dig a neighbouring cell. Sand clears; earth and rock crack toward clearing. A lit hero digs sand for
    free, and the sand above it puffs away with it instead of pouring in. Anything else is a cursor nudge."""
    if cell is None:
        snap(s, {"mark": None})
        return
    tr, tc = cell
    v = s.at(tr, tc) if (0 <= tc < W and 0 <= tr < s.h) else BED
    near = abs(tr - s.r) + abs(tc - s.c) == 1
    if not near or v not in DIG_NEXT:
        snap(s, {"mark": cell})
        snap(s, {})
        return
    free = s.lit > 0 and v == SAND
    if not free and s.clicks <= 0:
        snap(s, {"mark": cell, "bar_flash": True})
        snap(s, {})
        return
    res.acted = True
    if not free:
        s.clicks -= 1
        res.spent = 1
    if v in (ROCK, ROCK1, ROCK2):
        res.rock = True
    snap(s, {"cursor": cell})
    nv = DIG_NEXT[v]
    s.g[tr * W + tc] = nv
    puffs = [cell]
    if free:
        rr = tr - 1
        while rr >= 0 and s.g[rr * W + tc] == SAND:
            s.g[rr * W + tc] = AIR
            puffs.append((rr, tc))
            rr -= 1
    if nv == AIR:
        snap(s, {"puff": puffs})
    else:
        snap(s, {"crack": cell})


def can_go_on(s):
    """Can the level still be finished? While clicks are left (or a lit star can dig sand), yes, as far as this
    test goes: the brief restarts the level only when the budget is out and the finish is out of reach. With no
    clicks, search the moves on foot (and a lit hero's free sand digs) for the finish; a long search says yes. An energy
    cell reached on foot puts clicks back, and from there the level can go on."""
    if s.clicks > 0:
        return True
    seen = {s.key()}
    todo = [s]
    while todo:
        cur = todo.pop()
        moves = [(a, None) for a in (1, 2, 3, 4)]
        if cur.lit:
            moves += [(6, (cur.r + dr, cur.c + dc)) for dr, dc in NEIGH.values()]
        for a, cell in moves:
            nxt, res = act(cur, a, cell, check=False)
            if not res.acted or res.outcome == "die":
                continue
            if res.outcome == "win" or nxt.clicks > 0:
                return True
            k = nxt.key()
            if k not in seen:
                seen.add(k)
                if len(seen) > 4000:
                    return True
                todo.append(nxt)
    return False


# ---------------------------------------------------------------------------
# Levels (written by gen_dig.py between the markers; do not hand-edit)
# ---------------------------------------------------------------------------
# BEGIN LEVELS
LEVELS = [
    {"name": "dz01-1", "hero": [0, 5], "hearts": 3, "budget": 30,
     "rows": ["........",
              "ssssssss",
              "ssssscss",
              "ssssssss",
              "ssssssss",
              "ssssssss",
              "ssssssss",
              "ssssssss",
              "sssccsss",
              "ssssss+s",
              "ssssssss",
              "csssssss",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-2", "hero": [0, 5], "hearts": 1, "budget": 18,
     "rows": ["........",
              "ssssssss",
              "ssssssss",
              "meeeemee",
              "ssssscss",
              "ssssssss",
              "ssssssss",
              "eemeeeee",
              "sssshsss",
              "sssss+ss",
              "sssscsss",
              "eememeee",
              "sshsssss",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-3", "hero": [0, 3], "hearts": 1, "budget": 22,
     "rows": ["........",
              "ssssssss",
              "ssssssss",
              "#rwrrr#r",
              "ssssss.s",
              "s###hsss",
              "sseeeess",
              "sssssscs",
              "##shssss",
              "##sseees",
              "sssshsss",
              "ssssscss",
              "ssss+sss",
              "eeeemmee",
              "ssssshss",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-4", "hero": [0, 2], "hearts": 2, "budget": 23,
     "rows": ["........",
              "ssssssss",
              "ssssssss",
              "ssseeess",
              "sssM*sss",
              "ssssssss",
              "###sssss",
              "ssssssss",
              "eeeeeemm",
              "ssssssss",
              "sssss+sM",
              "ssssssch",
              "ssss###r",
              "ssssssss",
              "ssssssss",
              "seeessss",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-5", "hero": [0, 5], "hearts": 2, "budget": 30,
     "rows": ["........",
              "ssssssss",
              "ssssssss",
              "rrrrwr#r",
              "sssss*ss",
              "sssss##s",
              "rrrrr##s",
              "sssCssss",
              "ssssssss",
              "eeeeeeem",
              "sss##css",
              "scssss+s",
              "ssssrrrr",
              "sssss.ss",
              "hsCsssss",
              "csssss+s",
              "seeeeees",
              "ss.ssshs",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-6", "hero": [0, 3], "hearts": 2, "budget": 32,
     "rows": ["........",
              "ssssssss",
              "ssssssss",
              "ssrrrsss",
              "ss##*sss",
              "ssssssss",
              "ssssssss",
              "srrrssss",
              "ssshssss",
              "sMssssss",
              "sssc+sss",
              "eememeee",
              "Msssssss",
              "sscsssss",
              "r####rrw",
              "s+###sws",
              "ssssssss",
              "meee##ee",
              "swssssss",
              "shssssss",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-7", "hero": [0, 3], "hearts": 2, "budget": 40,
     "rows": ["........",
              "ssssssss",
              "*sssssss",
              "rw#rrr#r",
              "rrw###rr",
              "ssssssss",
              "ssss##ss",
              "sshr##rr",
              "s+sswsss",
              "MsCsssss",
              "ssssssss",
              "r#rrrwrr",
              "rwr##r#r",
              "css##sss",
              "ssssssss",
              "rrrrrrss",
              "ssssssss",
              "+sshcsss",
              "ssssssss",
              "meeemeee",
              "ssssssss",
              "ssssssss"]},
    {"name": "dz01-8", "hero": [0, 2], "hearts": 1, "budget": 35,
     "rows": ["........",
              "ssssssss",
              "ss*sssss",
              "ssssssss",
              "rrw#rrr#",
              "rrwrrr#r",
              "r#wrr###",
              "#rwrr#rr",
              "##wrr#r#",
              "rrw#r#r#",
              "#rw#rrr#",
              "........",
              "...+....",
              "eeee....",
              "........",
              "....c...",
              ".eeeee..",
              "....c...",
              "...eeee.",
              ".....c..",
              ".eeeee..",
              "........",
              "ssssssss",
              "ssssssss"]},
]
# END LEVELS


# ---------------------------------------------------------------------------
# Pictures: the sprite book. Every picture is drawn here by hand, one character a pixel.
# ---------------------------------------------------------------------------
_COL = {"Y": C_YELLOW, "O": C_ORANGE, "M": C_MAROON, "K": C_BLACK, "R": C_RED, "W": C_WHITE, "B": C_BLUE,
        "L": C_LBLUE, "G": C_GREEN, "P": C_PURPLE}


def _art(rows, extra=None):
    cmap = dict(_COL)
    if extra:
        cmap.update(extra)
    return [[cmap.get(ch, -1) for ch in row] for row in rows]


SAND_ART = (_art(["YYYYYYY", "YYYYOYY", "YOYYYYY", "YYYYYYY", "YYYYYOY", "YYOYYYY", "YYYYYYY"]),
            _art(["YYYYYYY", "YOYYYYY", "YYYYYOY", "YYYYYYY", "YYOYYYY", "YYYYYYY", "YYYYOYY"]))
EARTH_ART = _art(["OOOOOOO", "OMMMOOO", "OOOOOOO", "OOOOMMM", "OOOOOOO", "MMOOOOO", "OOOOOOO"])
CRACK_A = ["...K...", "..K....", "...K...", "....K..", "...K...", "..K....", "...K..."]
CRACK_B = [".......", "K......", ".K...K.", "..K.K..", "...K...", "....K..", "......."]
ROCK_ART = _art(["RRRRRRK", "RMMMMMK", "RMMMMMK", "RMMMMMK", "RMMMMMK", "RMMMMMK", "KKKKKKK"])
BED_ART = _art(["BBBBBBB", "BKKKKKK", "BKKKKKK", "BKKKKKK", "BKKKKKK", "BKKKKKK", "BKKKKKK"])
HEART5 = ["RR.RR", "RRRRR", ".RRR.", "..R.."]
HEART3 = ["R.R", "RRR", ".R."]
STAR5 = ["..Y..", ".YYY.", "YYYYY", ".YYY.", ".Y.Y."]
STAR3 = [".Y.", "YYY", ".Y."]
# The energy cell: a little battery, blue with a yellow charge, the bar's own yellow inside it
ENERGY_ART = _art(["..BBB..", ".BBBBB.", ".BYYYB.", ".BYYYB.", ".BYYYB.", ".BBBBB.", "......."])

_HERO_ROWS = ["..KKK..",
              ".KGGGK.",
              "KGWGWGK",
              "KGGGGGK",
              ".KGGGK.",
              "..K.K.."]
HERO = _art(_HERO_ROWS)
HERO_LIT = _art(_HERO_ROWS, {"K": C_YELLOW})
HERO_HURT = _art(_HERO_ROWS, {"K": C_RED})        # the beat he takes a punch
_POOF = [".R...R.", "..R.R..", "...R...", "..R.R..", ".R...R.", "R.....R"]
POOF_RED = _art(_POOF)
POOF_WHITE = _art(_POOF, {"R": C_WHITE})
PUFF = _art(["W.....W", "..W.W..", ".W...W.", "...W...", ".W...W.", "..W.W..", "W.....W"])

# Creatures, faces after fn01's guards: E eye, Q pupil (black; red on a dropper), X body, 1-3 the stripes
# (white while they last, dark once punched out). Crab: wide, claws up. Mole: round, a nose. Worm: segments.
CRE_ROWS = {
    1: ["X.....X",
        "XKKKKKX",
        "KEEXEEK",
        "KEQXQEK",
        "KXKKKXK",
        "K11111K",
        ".K.K.K."],
    2: [".KKKKK.",
        "KEEXEEK",
        "KEQXQEK",
        "KXXKXXK",
        "K11111K",
        "KXXXXXK",
        "K22222K"],
    3: [".KKKKK.",
        "KEQXQEK",
        "K11111K",
        "KXXXXXK",
        "K22222K",
        "KXXXXXK",
        "K33333K"],
}
CRE_BODY = {1: C_PURPLE, 2: C_BLUE, 3: C_ORANGE}


def creature_art(v, out=0, red=False):
    """The picture of creature v with `out` stripes punched out (red body: the one that took the last heart)."""
    n = cre_stripes(v)
    drop = bool((v - CRE) & DROP)
    body = C_RED if red else CRE_BODY[n]
    cmap = {"X": body, "E": C_WHITE, "Q": C_RED if drop else C_BLACK}
    for k in range(1, 4):
        cmap[str(k)] = C_BLACK if k <= out else C_WHITE
    return _art(CRE_ROWS[n], cmap)


def _put(frame, art, x, y, x1=PANEL_X - 1, y1=63):
    """Draw art at (x, y), clipped to the shaft (the panel is never drawn over by the play area)."""
    for dy, row in enumerate(art):
        yy = y + dy
        if yy < 0 or yy > y1:
            continue
        for dx, v in enumerate(row):
            xx = x + dx
            if v >= 0 and 0 <= xx <= x1:
                frame[yy, xx] = v


def _shape(frame, rows, x, y, colour, ch):
    for dy, row in enumerate(rows):
        for dx, c in enumerate(row):
            if c == ch and 0 <= y + dy <= 63 and 0 <= x + dx <= 63:
                frame[y + dy, x + dx] = colour


def _rect(frame, x0, y0, x1, y1, colour):
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(63, x1), min(63, y1)
    if x0 <= x1 and y0 <= y1:
        frame[y0:y1 + 1, x0:x1 + 1] = colour


# Where the eight sparks of a lit star sit around the hero's cell, in the order they go out
SPARKS = [(-1, -1), (3, -2), (7, -1), (8, 3), (7, 7), (3, 8), (-1, 7), (-2, 3)]


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

class Dz01Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def _cell(self, f, v, r, c, x, y, fx):
        _rect(f, x, y, x + CELL - 1, y + CELL - 1, C_LBLUE)
        if v == SAND:
            _put(f, SAND_ART[(r * 3 + c) % 2], x, y)
        elif v in (EARTH, EARTH1):
            _put(f, EARTH_ART, x, y)
            if v == EARTH1:
                _shape(f, CRACK_A, x, y, C_BLACK, "K")
        elif v in (ROCK, ROCK1, ROCK2):
            _put(f, ROCK_ART, x, y)
            if v >= ROCK1:
                _shape(f, CRACK_A, x, y, C_YELLOW, "K")
            if v == ROCK2:
                _shape(f, CRACK_B, x, y, C_YELLOW, "K")
        elif v == BED:
            _put(f, BED_ART, x, y)
        elif v == HEART:
            _shape(f, HEART5, x + 1, y + 2, C_RED, "R")
        elif v == STAR:
            _shape(f, STAR5, x + 1, y + 1, C_YELLOW, "Y")
        elif v == ENERGY:
            _put(f, ENERGY_ART, x, y)
        elif is_cre(v):
            out, red, dx, dy = 0, False, 0, 0
            for key in ("punch", "hit_back", "crumple", "show"):
                if fx.get(key) == (r, c):
                    out = fx.get("stripes_out", 0)
            if fx.get("red") == (r, c):
                red = True
            if fx.get("hit_back") == (r, c):
                # the creature lunges at the hero
                dy, dx = self._toward(r, c)
            if fx.get("crumple") == (r, c) or (fx.get("flat") and fx.get("punch") == (r, c)):
                art = creature_art(v, out, red)
                _put(f, art[4:], x, y + 4)
                return
            _put(f, creature_art(v, out, red), x + dx, y + dy)

    def _toward(self, r, c):
        st = self.game.view_state()
        return (2 * (st.r > r) - 2 * (st.r < r), 2 * (st.c > c) - 2 * (st.c < c))

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        st = g.view_state()
        fx = g.view_fx()
        f = frame
        f[:, :] = C_BLACK
        top = cam_top(st.r, st.h)
        for vr in range(VIEW):
            row = top + vr
            y = vr * CELL
            if row < st.h:
                for col in range(W):
                    self._cell(f, st.g[row * W + col], row, col, col * CELL, y, fx)
            elif row == st.h:
                flash = fx.get("finish", 0) % 2 == 1
                for xx in range(0, PANEL_X, 2):
                    for yy in range(0, CELL, 2):
                        col = C_YELLOW if (xx // 2 + yy // 2) % 2 == 0 else C_BLACK
                        if flash:
                            col = C_WHITE if col == C_YELLOW else C_GREEN
                        _rect(f, xx, y + yy, xx + 1, min(y + yy + 1, y + CELL - 1), col)
        # dig overlays
        for (pr, pc) in fx.get("puff", ()):
            _put(f, PUFF, pc * CELL, (pr - top) * CELL)
        if fx.get("cursor"):
            cr, cc = fx["cursor"]
            x, y = cc * CELL, (cr - top) * CELL
            for (ax, ay) in ((0, 0), (1, 0), (0, 1), (5, 0), (6, 0), (6, 1), (0, 5), (0, 6), (1, 6), (6, 5), (5, 6), (6, 6)):
                _rect(f, x + ax, y + ay, x + ax, y + ay, C_WHITE)
        if fx.get("mark"):
            mr, mc = fx["mark"]
            if 0 <= mc < W and top <= mr < top + VIEW:
                x, y = mc * CELL + 3, (mr - top) * CELL + 3
                for (ax, ay) in ((0, 0), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                    _rect(f, x + ax, y + ay, x + ax, y + ay, C_WHITE)
        # the hero (or the poof when he breaks)
        hx, hy = st.c * CELL, (st.r - top) * CELL + 1
        if fx.get("lean"):
            dr, dc = fx["lean"]
            hx, hy = hx + dc, hy + dr
        if fx.get("punch") and not fx.get("poof"):
            pr, pc = fx["punch"]
            hx, hy = hx + 2 * (pc - st.c), hy + 2 * (pr - st.r)
        if fx.get("sink"):
            hy += fx["sink"]
        if fx.get("poof"):
            _put(f, POOF_RED if fx["poof"] % 2 == 1 else POOF_WHITE, hx, hy)
        else:
            art = HERO_HURT if fx.get("hurt") else (HERO_LIT if st.lit else HERO)
            _put(f, art, hx, hy, y1=(VIEW * CELL) if fx.get("sink") else 63)
            if st.star and not st.lit:
                _rect(f, hx + 3, hy - 1, hx + 3, hy - 1, C_YELLOW)     # the carried star, a yellow spark on his head
        # the impact: a white spark on the edge between the hero and the creature he is fighting
        if fx.get("spark") and not fx.get("poof"):
            pr, pc = fx["spark"]
            sx = (st.c + pc) * CELL // 2 + CELL // 2
            sy = (st.r + pr - 2 * top) * CELL // 2 + CELL // 2
            for (ax, ay) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                _rect(f, sx + ax, sy + ay, sx + ax, sy + ay, C_WHITE)
        if st.lit:
            light = fx.get("light", 0)
            for k in range(st.lit):
                sx, sy = SPARKS[k]
                if light:
                    sx, sy = sx + (sx > 3) * light - (sx < 3) * light, sy + (sy > 3) * light - (sy < 3) * light
                _rect(f, hx + sx, hy - 1 + sy, hx + sx, hy - 1 + sy, C_WHITE if light else C_YELLOW)
        if fx.get("fade"):
            _rect(f, 0, 0, PANEL_X - 1, min(VIEW * CELL - 1, 16 * fx["fade"] - 1), C_LBLUE)
        _rect(f, 0, VIEW * CELL, PANEL_X - 1, 63, C_BLACK)
        self._panel(f, st, fx)
        if fx.get("point"):
            px, py = fx["point"]
            for (ax, ay) in ((0, 0), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                _rect(f, px + ax, py + ay, px + ax, py + ay, C_WHITE)
        return frame

    def _panel(self, f, st, fx):
        g = self.game
        _rect(f, PANEL_X, 0, 63, 63, C_BLACK)
        for k in range(MAX_HEARTS):
            _shape(f, HEART3, 58, 1 + 4 * k, C_RED if k < st.hearts else C_MAROON, "R")
        slot = C_YELLOW if (st.star or st.lit) else C_MAROON
        if fx.get("slot_flash"):
            slot = C_WHITE
        _shape(f, STAR3, 58, 14, slot, "Y")
        # the bar: its background is the click budget, draining from the top as clicks are spent
        y0, y1 = 19, 56
        span = y1 - y0 + 1
        _rect(f, 58, y0, 61, y1, C_RED if fx.get("bar_flash") else C_MAROON)
        left = 0 if not g.budget else int(round(span * min(g.budget, max(0, st.clicks)) / g.budget))
        if left:
            _rect(f, 58, y1 - left + 1, 61, y1, C_YELLOW)
        # the hero's green dot moves down the bar as he descends
        dot = y0 + int(round((span - 2) * min(st.r, st.h - 1) / max(1, st.h - 1)))
        _rect(f, 57, dot, 62, dot + 1, C_GREEN)
        for xx in range(57, 64):
            for yy in range(58, 64):
                f[yy, xx] = C_YELLOW if (xx + yy) % 2 == 0 else C_BLACK


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Dz01(ARCBaseGame):
    def __init__(self):
        self.display = Dz01Display(self)
        self.st = None
        self.budget = 0
        self.v = None                  # the frame being shown: (DigState, fx) or None for the resting picture
        self._script = []
        self._end = None
        self._busy = False
        levels = [Level(sprites=[], grid_size=(64, 64), data=ldef, name=ldef["name"]) for ldef in LEVELS]
        super().__init__("dz01", levels, Camera(0, 0, 64, 64, C_BLACK, C_BLACK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, level: Level) -> None:
        ldef = LEVELS[self.level_index]
        self.st = parse_level(ldef)
        self.budget = ldef["budget"]
        self.v = None
        self._script = []
        self._end = None
        self._busy = False

    def view_state(self):
        return self.v[0] if self.v is not None else self.st

    def view_fx(self):
        return self.v[1] if self.v is not None else {}

    # -- building the animation (the rules decide once, in act; the frames replay what it recorded) ---------

    def _begin(self):
        aid = self.action.id
        a = {GameAction.ACTION1: 1, GameAction.ACTION2: 2, GameAction.ACTION3: 3, GameAction.ACTION4: 4,
             GameAction.ACTION5: 5, GameAction.ACTION6: 6}.get(aid)
        cell = None
        if a == 6:
            data = self.action.data or {}
            x, y = int(data.get("x", 0)), int(data.get("y", 0))
            if 0 <= x < PANEL_X and 0 <= y < VIEW * CELL:
                cell = (cam_top(self.st.r, self.st.h) + y // CELL, x // CELL)
        frames = []
        if a == 6 and cell is None:
            # a click off the shaft (on the panel or the bottom edge): the cursor mark flashes where it landed,
            # nothing else happens
            self._script = [(self.st.copy(), {"point": (x, y)}), (self.st.copy(), {})]
            self._end = None
            return
        new, res = act(self.st, a, cell, rec=lambda s, fx: frames.append((s.copy(), dict(fx))))
        if res.outcome == "win":
            for k in range(1, 5):
                frames.append((new.copy(), {"finish": k}))
            for k in range(1, 4):
                frames.append((new.copy(), {"finish": 4, "sink": 2 * k}))
            for k in range(1, 5):
                frames.append((new.copy(), {"sink": 7, "fade": k}))
            self._end = "next"
        elif res.outcome == "die":
            if res.why == "budget":
                # the bar is empty and the finish is out of reach: it flashes and the hero breaks
                for k in range(1, 6):
                    frames.append((new.copy(), {"bar_flash": k % 2 == 1, "poof": k}))
            self._end = "die"
        else:
            self._end = None
            if frames and frames[-1][1]:
                # the step loop swallows the last frame (it settles on the resting picture), so every effect
                # recorded, the last puff included, gets shown before the rest
                frames.append((new.copy(), {}))
        self.st = new
        self._script = frames

    # -- engine entry point ---------------------------------------------------------------------------------

    def step(self) -> None:
        if self.action.id == GameAction.RESET:
            self._script = []
            self._end = None
            self._busy = False
            self.v = None
            self.complete_action()
            return

        if not self._busy:
            self._busy = True
            self._begin()
            if not self._script and self._end is None:
                self._busy = False
                self.v = None
                self.complete_action()
                return

        if self._script:
            self.v = self._script.pop(0)
            if self._script or self._end is not None:
                return
            # settled: the last recorded frame is the resting picture
            self._busy = False
            self.v = None
            self.complete_action()
            return

        # the frame after the last scripted one: apply what the animation was showing
        end, self._end = self._end, None
        self._busy = False
        self.v = None
        if end == "next":
            self.next_level()
        elif end == "die":
            self.level_reset()
            # level_reset() zeroes the action count, and RESET on a zero count restarts the whole game; keep it
            # above zero so a RESET right after a restart keeps the levels already cleared (from fn01)
            self._action_count = max(1, self._action_count)
        self.complete_action()
