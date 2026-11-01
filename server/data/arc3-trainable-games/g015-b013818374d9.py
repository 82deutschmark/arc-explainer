# ARC-AGI-3 candidate task g015.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    Level,
    RenderableUserDisplay,
    Sprite,
)

# ============================================================================
# The rules. Pure functions over an immutable state tuple.
#   state = (x, y, face, hands, drums, blocks, opened, used)
# ============================================================================

NX, NY = 10, 5
FLOOR_CHARS = ".Xv"
FACE_L, FACE_R = 0, 1
KINDS = "RWSM"
TOOL_OF = {("R", "W"): "crank", ("S", "W"): "chock", ("M", "R"): "auger"}

LEVELS_SPEC = [
    ["##########",
     "##########",
     "#P.RW.D.X#",
     "##########",
     "##########"],
    ["##########",
     "#S.....W.#",
     "#P.D..X.R#",
     "#.R.W....#",
     "##########"],
    ["##########",
     "#.W.W..SR#",
     "#P.D.DXX.#",
     "#.WR#....#",
     "##########"],
    ["##########",
     "#.SD.v...#",
     "#PWD..XX.#",
     "#R.W...RW#",
     "##########"],
    ["##########",
     "#..DSvR.R#",
     "#P...DXX.#",
     "#.W.W.R.W#",
     "##########"],
    ["##########",
     "#...WMR..#",
     "#PWDD%XX.#",
     "#....WRSR#",
     "##########"],
    ["##########",
     "#.WDWvWR.#",
     "#PMD.%XX.#",
     "#..S...RR#",
     "##########"],
    ["##########",
     "#SRDWv.W.#",
     "#P.DD%XXX.",
     "#RMRW.W..R",
     "##########"],
]


def parse(rows):
    base = [list(r) for r in rows]
    parts, drums, start = [], [], None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in KINDS:
                parts.append((x, y, ch))
                base[y][x] = "."
            elif ch == "D":
                drums.append((x, y))
                base[y][x] = "."
            elif ch == "P":
                start = (x, y)
                base[y][x] = "."
    cradles = tuple((x, y) for y, row in enumerate(base) for x, ch in enumerate(row) if ch == "X")
    assert start is not None and len(drums) >= len(cradles) >= 1
    for y, row in enumerate(base):
        for x, ch in enumerate(row):
            assert ch != "v" or (x + y) % 2 == 0
    return {"base": ["".join(r) for r in base], "parts": tuple(parts),
            "drums": tuple(drums), "start": start, "cradles": cradles,
            "homes": tuple((x, y) for x, y, _k in parts)}


LEVELS = [parse(r) for r in LEVELS_SPEC]


def terr(lv, opened, x, y):
    if not (0 <= x < NX and 0 <= y < NY):
        return "#"
    ch = lv["base"][y][x]
    if ch == "%" and (x, y) in opened:
        return "."
    return ch


def rung_end(x, y):
    """The other end of this node's ladder: ladders sit in every other column, staggered."""
    return (x, y + 1) if (x + y) % 2 == 0 else (x, y - 1)


def initial_state(i):
    lv = LEVELS[i]
    return (lv["start"][0], lv["start"][1], FACE_R, (), lv["drums"], (), (), ())


def world_of(s):
    return (tuple(sorted(s[4])), s[5], s[6], s[7])


def solid_at(drums, blocks, x, y):
    return (x, y) in drums or (x, y) in blocks


def walkable(lv, opened, drums, blocks, x, y):
    return terr(lv, opened, x, y) in FLOOR_CHARS and not solid_at(drums, blocks, x, y)


def roll(lv, opened, drums, blocks, player, i, h):
    """Kick drum i toward h and let everything run to rest.
    Returns (drums, path); path = [(drum, x, y, kind)] with kind roll, fall or hit."""
    drums = list(drums)
    path = []
    cur, steps = i, 0
    x, y = drums[cur]
    while steps < 60:
        nx = x + h
        t = terr(lv, opened, nx, y)
        if t not in FLOOR_CHARS or (nx, y) == player or (nx, y) in blocks:
            break
        j = next((k for k, d in enumerate(drums) if d == (nx, y)), None)
        if j is not None:
            cur = j
            x = nx
            steps += 1
            path.append((cur, x, y, "hit"))
            continue
        x = nx
        steps += 1
        drums[cur] = (x, y)
        path.append((cur, x, y, "roll"))
        if t == "v":
            by = y + 1
            if (terr(lv, opened, x, by) in FLOOR_CHARS and (x, by) != player and (x, by) not in blocks
                    and all(d != (x, by) for k, d in enumerate(drums) if k != cur)):
                y = by
                steps += 1
                drums[cur] = (x, y)
                path.append((cur, x, y, "fall"))
    return tuple(drums), path


def tool_of(lv, hands):
    if len(hands) != 2:
        return None
    return TOOL_OF.get(tuple(sorted(lv["parts"][k][2] for k in hands)))


def part_here(lv, s):
    for k, h in enumerate(lv["homes"]):
        if h == (s[0], s[1]) and k not in s[3] and k not in s[7]:
            return k
    return None


def take(lv, s, k):
    """Take part k. With both hands full, the one held longest goes back where it lay."""
    px, py, face, hands, drums, blocks, opened, used = s
    returned = None
    if len(hands) == 2:
        ox, oy = lv["homes"][hands[0]]
        if solid_at(drums, blocks, ox, oy):
            return None
        returned = hands[0]
        hands = hands[1:]
    return (px, py, face, hands + (k,), drums, blocks, opened, used), returned


def step_state(i, s, a):
    """One key press: 1 up, 2 down, 3 left, 4 right, 5 Space.
    Returns (new state, (kind, extra)). Kinds:
      move climb          walked one step (extra None)
      turn bump           a blocked step sideways: turned round / pushed against it
      nolink blocked      up or down with no ladder / the ladder's far end is occupied
      take                Space on a part: extra = (part, part sent home or None)
      use                 Space with a tool that did something: extra = (tool, path or node)
      refuse              Space did nothing: extra = 'notool' or 'notarget'"""
    lv = LEVELS[i]
    px, py, face, hands, drums, blocks, opened, used = s
    if a in (3, 4):
        dx = -1 if a == 3 else 1
        nface = FACE_L if a == 3 else FACE_R
        if walkable(lv, opened, drums, blocks, px + dx, py):
            return (px + dx, py, nface, hands, drums, blocks, opened, used), ("move", None)
        return (px, py, nface, hands, drums, blocks, opened, used), ("turn" if nface != face else "bump", None)
    if a in (1, 2):
        if (a == 2) != ((px + py) % 2 == 0):
            return s, ("nolink", None)
        tx, ty = rung_end(px, py)
        if terr(lv, opened, tx, ty) not in FLOOR_CHARS:
            return s, ("nolink", None)
        if solid_at(drums, blocks, tx, ty):
            return s, ("blocked", None)
        return (tx, ty, face, hands, drums, blocks, opened, used), ("climb", None)
    if a == 5:
        tool = tool_of(lv, hands)
        dx = -1 if face == FACE_L else 1
        tx, ty = px + dx, py
        spent = tuple(sorted(used + hands))
        if tool == "crank":
            d = next((k for k, q in enumerate(drums) if q == (tx, ty)), None)
            if d is not None:
                nd, path = roll(lv, opened, drums, blocks, (px, py), d, dx)
                if nd != drums:
                    return (px, py, face, (), nd, blocks, opened, spent), ("use", (tool, path))
        elif tool == "chock":
            if (terr(lv, opened, tx, ty) == "." and not solid_at(drums, blocks, tx, ty)
                    and (tx, ty) not in lv["homes"]):
                nb = tuple(sorted(blocks + ((tx, ty),)))
                return (px, py, face, (), drums, nb, opened, spent), ("use", (tool, (tx, ty)))
        elif tool == "auger":
            if 0 <= tx < NX and lv["base"][ty][tx] == "%" and (tx, ty) not in opened:
                no = tuple(sorted(opened + ((tx, ty),)))
                return (px, py, face, (), drums, blocks, no, spent), ("use", (tool, (tx, ty)))
        k = part_here(lv, s)
        if k is not None:
            got = take(lv, s, k)
            if got is not None:
                return got[0], ("take", (k, got[1]))
        return s, ("refuse", "notarget" if tool else "notool")
    return s, ("none", None)


def is_won(i, s):
    return all(c in s[4] for c in LEVELS[i]["cradles"])


# ---- the dead-end check ------------------------------------------------------------
# Walking and taking parts never change the level, so whether a level can still be won
# depends only on its world (drums, blocks, cleared rubble, spent parts) and on where the
# player can still get to. This asks it directly instead of searching every state.

def reach(lv, world, start):
    """Every (x, y, face) the player can stand in from `start` without changing the world."""
    drums, blocks, opened, _used = world
    seen = {start}
    stack = [start]
    while stack:
        x, y, f = stack.pop()
        nxt = []
        for dx in (-1, 1):
            nf = FACE_L if dx < 0 else FACE_R
            if walkable(lv, opened, drums, blocks, x + dx, y):
                nxt.append((x + dx, y, nf))
            else:
                nxt.append((x, y, nf))
        tx, ty = rung_end(x, y)
        if walkable(lv, opened, drums, blocks, tx, ty):
            nxt.append((tx, ty, f))
        for st in nxt:
            if st not in seen:
                seen.add(st)
                stack.append(st)
    return seen


def next_worlds(i, world, region):
    """Every world one more tool use can bring about, with where the player then stands."""
    lv = LEVELS[i]
    drums, blocks, opened, used = world
    nodes = {(x, y) for x, y, _f in region}
    got = [k for k, h in enumerate(lv["homes"])
           if k not in used and h in nodes and not solid_at(drums, blocks, *h)]
    pairs = {}
    for a in got:
        for b in got:
            if a < b:
                tool = TOOL_OF.get(tuple(sorted((lv["parts"][a][2], lv["parts"][b][2]))))
                if tool is not None:
                    pairs.setdefault(tool, []).append((a, b))
    out = []
    for tool, plist in pairs.items():
        sites = []
        for (x, y, f) in region:
            dx = -1 if f == FACE_L else 1
            tx, ty = x + dx, y
            if tool == "crank":
                d = next((k for k, q in enumerate(drums) if q == (tx, ty)), None)
                if d is not None:
                    nd, _p = roll(lv, opened, drums, blocks, (x, y), d, dx)
                    if nd != drums:
                        sites.append(((tuple(sorted(nd)), blocks, opened), (x, y, f)))
            elif tool == "chock":
                if (terr(lv, opened, tx, ty) == "." and not solid_at(drums, blocks, tx, ty)
                        and (tx, ty) not in lv["homes"]):
                    sites.append(((drums, tuple(sorted(blocks + ((tx, ty),))), opened), (x, y, f)))
            elif 0 <= tx < NX and lv["base"][ty][tx] == "%" and (tx, ty) not in opened:
                sites.append(((drums, blocks, tuple(sorted(opened + ((tx, ty),)))), (x, y, f)))
        for a, b in plist:
            spent = tuple(sorted(used + (a, b)))
            for (d2, b2, o2), spot in sites:
                out.append(((d2, b2, o2, spent), spot))
    return out


_ALIVE = {}


def can_still_win(i, world, spot):
    """True while some run of tools can still put drums on every pad."""
    lv = LEVELS[i]
    region = reach(lv, world, spot)
    key = (i, world, min(region))
    if key in _ALIVE:
        return _ALIVE[key]
    _ALIVE[key] = False
    ok = all(c in world[0] for c in lv["cradles"])
    if not ok:
        for w2, spot2 in next_worlds(i, world, region):
            if can_still_win(i, w2, spot2):
                ok = True
                break
    _ALIVE[key] = ok
    return ok


# ============================================================================
# The look: green field, yellow track, black for the hard edges and the player.
# ============================================================================

FIELD, TRACK, BLACK, WHITE = 14, 11, 5, 0
BLUE, SKY, PURPLE, ORANGE, MAROON, RED, PINK, MAGENTA, METAL, GHOST, DIM = 9, 10, 15, 12, 13, 8, 7, 6, 2, 1, 3

TILE, GAP = 6, 3
STRIDE_X, STRIDE_Y = TILE, TILE + GAP
X0, Y0 = 2, 4


def node_xy(x, y):
    return X0 + STRIDE_X * x, Y0 + STRIDE_Y * y


def pixel_art(rows, colours):
    return np.array([[-1 if ch == "." else colours[ch] for ch in row] for row in rows], dtype=np.int8)


def fill(grid, x0, y0, x1, y1, c):
    grid[max(0, y0):min(64, y1), max(0, x0):min(64, x1)] = c


def stamp(grid, px, py, art):
    h, w = art.shape
    for dy in range(h):
        for dx in range(w):
            v = art[dy, dx]
            if v >= 0 and 0 <= py + dy < 64 and 0 <= px + dx < 64:
                grid[py + dy, px + dx] = v


def recolour(art, c):
    return np.where(art >= 0, c, -1).astype(np.int8)


DRUM = pixel_art((".bbbb.", "llllll", "bbbbbb", "bbbbbb", "llllll", ".bbbb."), {"b": BLUE, "l": SKY})
PLAYER_R = pixel_art((".ooo..", ".kkwk.", ".kkk..", ".kkkkk", ".kkk..", ".k.k.."),
                     {"k": BLACK, "w": WHITE, "o": ORANGE})
PLAYER_L = PLAYER_R[:, ::-1].copy()
_RED_FIGURE = np.where(PLAYER_R == BLACK, RED, np.where(PLAYER_R == ORANGE, PINK, PLAYER_R)).astype(np.int8)
PLAYER_DEAD_R = np.rot90(_RED_FIGURE, -1).copy()
PLAYER_DEAD_L = np.rot90(_RED_FIGURE[:, ::-1], 1).copy()
PAD = pixel_art(("pp..pp", "pp..pp", "p....p", "p....p", "pp..pp", "pp..pp"), {"p": PURPLE})
GLOW = recolour(PAD, WHITE)
CHUTE = pixel_art(("ssssss", "kkkkkk", "skkkks", "sskkss", "ssssss", "ssssss"), {"s": SKY, "k": BLACK})
RUBBLE = pixel_art(("mm.mm.", "mmmmmm", "mommmm", "mmmmom", "mmmmmm", ".mmmm."), {"m": MAROON, "o": ORANGE})
WEDGE = pixel_art((".....o", "....oo", "...ooo", "..oook", ".ooook", "kkkkkk"), {"o": ORANGE, "k": BLACK})
PART_ROD = pixel_art(("....mm", "...mmm", "..mm..", ".mm...", "mm....", "m....."), {"m": MAGENTA})
PART_WHEEL = pixel_art((".wwww.", "wwwwww", "wwkkww", "wwkkww", "wwwwww", ".wwww."), {"w": WHITE, "k": BLACK})
PART_WEDGE = pixel_art(("......", "....oo", "..oooo", ".ooooo", "oooooo", "oooooo"), {"o": ORANGE})
PART_BIT = pixel_art(("......", ".gg...", ".gggg.", ".gggkk", ".gggg.", ".gg..."), {"g": METAL, "k": BLACK})
PART_ART = {"R": PART_ROD, "W": PART_WHEEL, "S": PART_WEDGE, "M": PART_BIT}
SPARK = pixel_art(("..ww..", "w.ww.w", "wwwwww", "wwwwww", "w.ww.w", "..ww.."), {"w": WHITE})
PUFF = pixel_art(("..ss..", ".ssss.", "ssssss", "ssssss", ".ssss.", "..ss.."), {"s": SKY})

TOOL_ART = {
    "crank": pixel_art(("........", ".....m..", ".....mm.", "mmmmmmmm", "mmmmmmmm", ".....mm.", ".....m..", "........"),
                       {"m": MAGENTA}),
    "chock": pixel_art(("........", ".....oo.", "....ooo.", "...oooo.", "..ooook.", ".oooook.", "oooooook", "kkkkkkkk"),
                       {"o": ORANGE, "k": BLACK}),
    "auger": pixel_art(("........", "...g....", "...ggg..", "mmmggggk", "mmmggggk", "...ggg..", "...g....", "........"),
                       {"g": METAL, "m": MAGENTA, "k": BLACK}),
}

RACK_TOP, SOCK_Y, SOCK = 50, 52, 8
SOCK_X = (15, 41)
TOOL_X, TOOL_Y, TOOL_BOX = 27, 51, 10


def ring(n, c):
    a = np.full((n, n), -1, dtype=np.int8)
    a[0, :] = a[-1, :] = a[:, 0] = a[:, -1] = c
    return a


def terrain_pixels(i, opened):
    lv = LEVELS[i]
    g = np.full((64, 64), BLACK, dtype=np.int8)
    fill(g, 2, 2, 62, 48, FIELD)
    for y in range(NY):
        for x in range(NX):
            t = terr(lv, opened, x, y)
            ox, oy = node_xy(x, y)
            raw = lv["base"][y][x]
            if t in FLOOR_CHARS or raw == "%":
                fill(g, ox, oy, ox + TILE, oy + TILE, TRACK)
            if t == "v":
                stamp(g, ox, oy, CHUTE)
            elif raw == "%" and (x, y) not in opened:
                stamp(g, ox, oy, RUBBLE)
            if t in FLOOR_CHARS:
                if (x + y) % 2 == 0 and terr(lv, opened, x, y + 1) in FLOOR_CHARS:
                    fill(g, ox + 1, oy + TILE, ox + 5, oy + STRIDE_Y, TRACK)
                if terr(lv, opened, x - 1, y) not in FLOOR_CHARS:
                    fill(g, ox - 1, oy, ox, oy + TILE, BLACK)
                if terr(lv, opened, x + 1, y) not in FLOOR_CHARS:
                    fill(g, ox + TILE, oy, ox + TILE + 1, oy + TILE, BLACK)
    for (cx, cy) in lv["cradles"]:
        ox, oy = node_xy(cx, cy)
        stamp(g, ox, oy, PAD)
    return g


_TERRAIN = {}


def terrain_for(i, opened):
    key = (i, opened)
    if key not in _TERRAIN:
        _TERRAIN[key] = terrain_pixels(i, opened)
    return _TERRAIN[key]


class Rack(RenderableUserDisplay):
    """The two hand sockets with, between them, the tool the held pair makes."""

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        kinds, tool, ghost, swap, flash = self._game._scene["rack"]
        fill(frame, 0, RACK_TOP, 64, 64, BLACK)
        for slot, x0 in enumerate(SOCK_X):
            edge = TRACK
            if flash == "sockets" or flash == ("slot", slot) or (swap and slot == 0):
                edge = WHITE
            fill(frame, x0, SOCK_Y, x0 + SOCK, SOCK_Y + SOCK, edge)
            fill(frame, x0 + 1, SOCK_Y + 1, x0 + SOCK - 1, SOCK_Y + SOCK - 1, BLACK)
            if slot < len(kinds):
                stamp(frame, x0 + 1, SOCK_Y + 1, PART_ART[kinds[slot]])
            elif ghost is not None and slot == len(kinds):
                stamp(frame, x0 + 1, SOCK_Y + 1, np.where(PART_ART[ghost] == BLACK, BLACK, recolour(PART_ART[ghost], GHOST)).astype(np.int8))
        link = TRACK if tool else DIM
        if len(kinds) == 2:
            fill(frame, SOCK_X[0] + SOCK, SOCK_Y + 3, TOOL_X, SOCK_Y + 5, link)
            fill(frame, TOOL_X + TOOL_BOX, SOCK_Y + 3, SOCK_X[1], SOCK_Y + 5, link)
        edge = WHITE if flash == "tool" else (SKY if tool else DIM)
        fill(frame, TOOL_X, TOOL_Y, TOOL_X + TOOL_BOX, TOOL_Y + TOOL_BOX, edge)
        fill(frame, TOOL_X + 1, TOOL_Y + 1, TOOL_X + TOOL_BOX - 1, TOOL_Y + TOOL_BOX - 1, BLACK)
        if tool:
            stamp(frame, TOOL_X + 1, TOOL_Y + 1, TOOL_ART[tool])
        return frame


# ============================================================================
# A scene is everything a single picture needs. Rules decide first, then a list of scenes
# is played back one per frame; the last scene is always the settled state.
# ============================================================================

def scene(i, s, flash=None, nudge=(0, 0), dead=False, fx=()):
    lv = LEVELS[i]
    px, py, face, hands, drums, blocks, opened, used = s
    here = part_here(lv, s)
    ghost = lv["parts"][here][2] if (here is not None and len(hands) < 2) else None
    swap = here is not None and len(hands) == 2 and take(lv, s, here) is not None
    x, y = node_xy(px, py)
    return {
        "player": (x + nudge[0], y + nudge[1]), "face": face, "dead": dead,
        "drums": [node_xy(a, b) for (a, b) in drums],
        "parts": {k: node_xy(*h) for k, h in enumerate(lv["homes"]) if k not in hands and k not in used},
        "blocks": [node_xy(a, b) for (a, b) in blocks],
        "opened": opened,
        "rack": (tuple(lv["parts"][k][2] for k in hands), tool_of(lv, hands), ghost, swap, flash),
        "fx": tuple(fx),
    }


def lerp_pt(a, b, t, n):
    return (a[0] + (b[0] - a[0]) * t // n, a[1] + (b[1] - a[1]) * t // n)


def plan_frames(i, s, s2, info, alive, a):
    """The pictures for one key press. `alive` is False when the result is a dead end.
    Returns (frames, died)."""
    lv = LEVELS[i]
    kind, extra = info
    final = scene(i, s2)
    frames = []
    face_dx = -1 if s[2] == FACE_L else 1
    if kind in ("move", "climb"):
        p0, p1 = node_xy(s[0], s[1]), node_xy(s2[0], s2[1])
        for t in (1, 2):
            sc = scene(i, s2)
            sc["player"] = lerp_pt(p0, p1, t, 3)
            frames.append(sc)
    elif kind in ("turn", "bump"):
        dx = -1 if s2[2] == FACE_L else 1
        bx, by = node_xy(s2[0], s2[1])
        hit = (("spark", bx + 5 * dx, by),)
        frames = [scene(i, s2, nudge=(2 * dx, 0), fx=hit), scene(i, s2, nudge=(dx, 0), fx=hit)]
    elif kind in ("nolink", "blocked"):
        dy = -1 if a == 1 else 1
        bx, by = node_xy(s[0], s[1])
        hit = (("spark", bx, by + 5 * dy),)
        frames = [scene(i, s, nudge=(0, 2 * dy), fx=hit), scene(i, s, nudge=(0, dy), fx=hit)]
    elif kind == "take":
        k, returned = extra
        slot = ("slot", len(s2[3]) - 1)
        lifted = scene(i, s2, flash=slot)
        hx, hy = node_xy(*lv["homes"][k])
        lifted["parts"][k] = (hx, hy - 2)
        after = scene(i, s2, flash=slot)
        if returned is not None:
            after["fx"] = (("puff",) + node_xy(*lv["homes"][returned]),)
        frames = [lifted, after]
    elif kind == "refuse":
        flash = "tool" if extra == "notarget" else "sockets"
        frames = [scene(i, s, flash=flash, nudge=(2 * face_dx, 0)), scene(i, s, flash=flash, nudge=(face_dx, 0))]
    elif kind == "use":
        tool, what = extra
        tx, ty = s[0] + face_dx, s[1]
        if tool == "crank":
            kick = scene(i, s, flash="tool", nudge=(face_dx, 0))
            kick["fx"] = (("spark",) + node_xy(tx, ty),)
            frames.append(kick)
            cur = [node_xy(p, q) for (p, q) in s[4]]
            for (d, x, y, k) in what:
                sc = scene(i, s2)
                if k == "hit":
                    sc["fx"] = (("spark",) + node_xy(x, y),)
                else:
                    cur[d] = node_xy(x, y)
                sc["drums"] = list(cur)
                frames.append(sc)
        elif tool == "chock":
            kick = scene(i, s, flash="tool", nudge=(face_dx, 0))
            kick["fx"] = (("puff",) + node_xy(*what),)
            frames.append(kick)
            sc = scene(i, s2)
            sc["fx"] = (("puff",) + node_xy(*what),)
            frames.append(sc)
        elif tool == "auger":
            for n in range(3):
                sc = scene(i, s, flash="tool", nudge=(face_dx if n % 2 == 0 else 0, 0))
                sc["fx"] = (("spark",) + node_xy(*what),)
                frames.append(sc)
            sc = scene(i, s2)
            sc["fx"] = (("puff",) + node_xy(*what),)
            frames.append(sc)
        if is_won(i, s2):
            glow = tuple(("glow",) + node_xy(*c) for c in lv["cradles"])
            for _ in range(3):
                sc = scene(i, s2)
                sc["fx"] = glow
                frames.append(sc)
            return frames, False
        if not alive:
            for n in range(15):
                sc = scene(i, s2, dead=True)
                size = 8 + 4 * min(n, 3)
                qx, qy = node_xy(s2[0], s2[1])
                sc["fx"] = (("ring", qx + 3 - size // 2, qy + 3 - size // 2, size),)
                frames.append(sc)
            return frames, True
    frames.append(final)
    return frames, False


# ============================================================================
# The game
# ============================================================================

def build_levels():
    return [Level(sprites=[Sprite(pixels=terrain_for(i, ()), name="terrain", x=0, y=0,
                                  blocking=BlockingMode.NOT_BLOCKED, layer=0, tags=["terrain"])])
            for i in range(len(LEVELS))]


class G015(ARCBaseGame):

    def __init__(self):
        self.st = initial_state(0)
        self._scene = scene(0, self.st)
        self._queue = None
        self._respawn = False
        camera = Camera(width=64, height=64, background=BLACK, letter_box=BLACK, interfaces=[Rack(self)])
        super().__init__(game_id="g015", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    # ---- sprites -----------------------------------------------------------------
    def _sprite(self, name, pixels, layer, tags):
        sp = Sprite(pixels=pixels, name=name, x=0, y=0, blocking=BlockingMode.NOT_BLOCKED,
                    layer=layer, tags=list(tags))
        self.current_level.add_sprite(sp)
        return sp

    def _load(self):
        """Put the current level on the table as it was entered."""
        i = self.level_index
        lv = LEVELS[i]
        level = self.current_level
        level.remove_all_sprites()
        self._queue = None
        self._respawn = False
        self.st = initial_state(i)
        self._sprite("terrain", terrain_for(i, ()), 0, ["terrain"])
        for k, (_x, _y, kind) in enumerate(lv["parts"]):
            self._sprite("part%d" % k, PART_ART[kind], 2, ["part"])
        for k in range(len(lv["parts"]) // 2 + 1):
            self._sprite("block%d" % k, WEDGE, 2, ["block"])
        for k in range(len(lv["drums"])):
            self._sprite("drum%d" % k, DRUM, 3, ["drum"])
        self._sprite("player", PLAYER_R, 4, ["player"])
        for k in range(3):
            self._sprite("fx%d" % k, SPARK, 5, ["fx"])
        self._show(scene(i, self.st))

    def _show(self, sc):
        self._scene = sc
        i = self.level_index
        lv = LEVELS[i]
        level = self.current_level
        by = {s.name: s for s in level.get_sprites()}
        t = by["terrain"]
        t.pixels = terrain_for(i, sc["opened"])
        for k in range(len(lv["parts"])):
            sp = by["part%d" % k]
            if k in sc["parts"]:
                sp.set_position(*sc["parts"][k]).set_visible(True)
            else:
                sp.set_visible(False)
        for k in range(len(lv["parts"]) // 2 + 1):
            sp = by["block%d" % k]
            if k < len(sc["blocks"]):
                sp.set_position(*sc["blocks"][k]).set_visible(True)
            else:
                sp.set_visible(False)
        for k, pos in enumerate(sc["drums"]):
            by["drum%d" % k].set_position(*pos)
        pl = by["player"]
        left = sc["face"] == FACE_L
        pl.pixels = (PLAYER_DEAD_L if left else PLAYER_DEAD_R) if sc["dead"] else (PLAYER_L if left else PLAYER_R)
        pl.set_position(*sc["player"])
        for k in range(3):
            sp = by["fx%d" % k]
            if k < len(sc["fx"]):
                f = sc["fx"][k]
                art = {"spark": SPARK, "puff": PUFF, "glow": GLOW}.get(f[0])
                if f[0] == "ring":
                    art = ring(f[3], PINK)
                sp.pixels = art
                sp.set_position(f[1], f[2]).set_visible(True)
            else:
                sp.set_visible(False)

    def on_set_level(self, level):
        self._load()

    # ---- one key press ---------------------------------------------------------------
    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if self._queue is None:
            a = self.action.id.value
            s = self.st
            if a not in (1, 2, 3, 4, 5):
                self._queue, self._respawn = [scene(self.level_index, s)], False
            else:
                s2, info = step_state(self.level_index, s, a)
                alive = True
                if info[0] == "use" and not is_won(self.level_index, s2):
                    alive = can_still_win(self.level_index, world_of(s2), (s2[0], s2[1], s2[2]))
                self._queue, self._respawn = plan_frames(self.level_index, s, s2, info, alive, a)
                self.st = s2
        self._show(self._queue.pop(0))
        if self._queue:
            return
        self._queue = None
        if self._respawn:
            self._load()
        elif is_won(self.level_index, self.st):
            self.next_level()
        self.complete_action()
