# Author: Claude Sonnet 5.5
# Date: 13-October-2026
# PURPOSE: A route over an abyss. Step off a stone and it cracks; step off a cracked stone and it
#   falls. Collect the orange gems, then walk into the yellow door (it turns from red to green when
#   every gem is in). Stones that never crack, stones that are already cracked, and warp pads that
#   carry you across a gap once are the other parts. If a move leaves the level unwinnable, you
#   fall on the spot (a short, visible death) and the level starts again as you entered it.
# SRP/DRY check: Pass. Pure rules (parse/apply/alive) at the top, drawing in the middle, the game class
#   at the bottom. Nothing in the picture is read by a rule.

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay, Sprite
from arcengine import BlockingMode, InteractionMode

# --- palette (ARC-AGI-3 indices) ---------------------------------------------
BLACK, WHITE, BLUE, AZURE, YELLOW, ORANGE = 5, 0, 9, 10, 11, 12
RED, GREEN, MAROON, PURPLE, MAGENTA, PINK = 8, 14, 13, 15, 6, 7
CLEAR = -1

ABYSS, FLOOR, CRACKED, STURDY, PAD = 0, 1, 2, 3, 4
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}

# ============================================================================
# Maps. . stone   , cracked stone   O sturdy stone   S start on stone   s start on sturdy
# k gem on stone   K gem on sturdy   x gem on cracked   E door   1 2 warp pads (pairs)
# ============================================================================
MAPS = [
    # 1 teach: the cross. Stones crack behind you; the sturdy middle never does.
    ["#k#",
     "SOE",
     "#.#"],
    # 2 stretch: three crumbling bridges to three gems; the door is the courtyard in the middle. Each bridge stone holds two steps: out, and back.
    ["####k###",
     "###...##",
     "####.#.#",
     "sOOOE..k",
     "####.#.#",
     "###...##",
     "####k###"],
    # 3 stretch: the right bridge ends in a second courtyard with two more gems
    ["####k####",
     "###...###",
     "####.#.k#",
     "sOOOE..Ok",
     "####.#.k#",
     "###...###",
     "####k####"],
    # 4 introduce: stones that start cracked (one step, then gone). The door sits beyond a one-way cracked bridge.
    ["####k###",
     "###...##",
     "####.###",
     "sOOOO.xE",
     "##.#.###",
     "##k#.###",
     "####k###"],
    # 5 combine: cracked stones, sturdy stones, two-pass stones, six gems
    ["k.#S#.k",
     ".O.O.O.",
     "x,.#.,x",
     "..O.O..",
     "k.#E#.k"],
    # 6 turn: warp pads carry you across once, then both are gone; cracked stones wait on the far side
    ["s..k#1,,k",
     ".##O#.##.",
     ".##O#k..,",
     "kO..#.##k",
     ".##.#O##,",
     "O.,1#...E"],
    # 7 compose: four rooms in a ring of warps
    ["sO.k#1..k",
     ".##O#.#..",
     "k#..#k#.#",
     "..O1#...2",
     "#########",
     "3..k#2..k",
     ".##.#.#.#",
     "k#..#k#k#",
     "...E#...3"],
    # 8 compose: four larger rooms in a ring of warps, everything at once
    ["sO.#k#1.k.#",
     "..#..##.#.k",
     "k.k.k#.k.#.",
     ".#..##k.#..",
     "k...1##...2",
     "###########",
     "3...k#2.,.k",
     ".#.#.#.#.#.",
     "k#k#.#k.O..",
     "...#.#.#.#.",
     ".#..E#x.,.3"],
]
PITCH = [12, 8, 7, 8, 8, 7, 6, 5]


def parse(rows):
    h = len(rows)
    w = max(len(r) for r in rows)
    tiles = bytearray(w * h)
    keys, pads, start, exit_ = [], {}, None, None
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            i = y * w + x
            t = ABYSS
            if ch == ".":
                t = FLOOR
            elif ch == ",":
                t = CRACKED
            elif ch == "O":
                t = STURDY
            elif ch == "S":
                t, start = FLOOR, i
            elif ch == "s":
                t, start = STURDY, i
            elif ch == "k":
                t = FLOOR; keys.append(i)
            elif ch == "K":
                t = STURDY; keys.append(i)
            elif ch == "x":
                t = CRACKED; keys.append(i)
            elif ch == "E":
                t, exit_ = STURDY, i
            elif ch in "123":
                t = PAD; pads.setdefault(ch, []).append(i)
            tiles[i] = t
    pm, pairs = {}, {}
    for ch, ab in pads.items():
        pm[ab[0]] = ab[1]
        pm[ab[1]] = ab[0]
        pairs[ab[0]] = pairs[ab[1]] = int(ch)
    return dict(w=w, h=h, tiles=bytes(tiles), keys=keys, pads=pm, pairs=pairs, start=start, exit=exit_)


def apply(L, state, d):
    """One move. Returns (new_state, info) or None when the move is refused (abyss or edge)."""
    pos, tiles, kmask = state
    w, h = L["w"], L["h"]
    dx, dy = DIRS[d]
    nx, ny = pos % w + dx, pos // w + dy
    if not (0 <= nx < w and 0 <= ny < h):
        return None
    npos = ny * w + nx
    if tiles[npos] == ABYSS:
        return None
    t = bytearray(tiles)
    left = t[pos]
    fate, gone_pair = None, None
    if left == FLOOR:
        t[pos] = CRACKED
        fate = "crack"
    elif left == CRACKED:
        t[pos] = ABYSS
        fate = "fall"
    elif left == PAD:
        t[pos] = ABYSS
        fate = "fall"
        other = L["pads"].get(pos)
        if other is not None:
            t[other] = ABYSS
            gone_pair = other
    p, warp = npos, None
    if npos in L["keys"]:
        kmask |= 1 << L["keys"].index(npos)
    if t[npos] == PAD and npos in L["pads"] and t[L["pads"][npos]] == PAD:
        p = L["pads"][npos]
        warp = (npos, p)
    return (p, bytes(t), kmask), dict(fate=fate, left=pos, arrive=npos, warp=warp, gone_pair=gone_pair)


def is_win(L, state):
    return state[0] == L["exit"] and state[2] == (1 << len(L["keys"])) - 1


def initial(L):
    return (L["start"], L["tiles"], 0)


_MEMO = {}  # level index -> {state: bool}; module level so a deep copy of the game stays small
SEARCH_CAP = 400000


_CAP = {FLOOR: 2, CRACKED: 1, STURDY: 99, PAD: 1}


def _flow_ok(L, state, seen):
    """Cheap necessary test, gem by gem: two walkers leave the gem, one to the player and one to the door, and every stone can
    be left only as often as it has steps in it (floor twice, cracked once, sturdy always). Exact maximum flow on the stones
    still standing; fewer than two units means that gem can never be fetched and delivered, so the position is lost."""
    pos, tiles, km = state
    w, h = L["w"], L["h"]
    ex = L["exit"]
    for j, g in enumerate(L["keys"]):
        if (km >> j) & 1 or g == pos:
            continue
        cap = {}
        adj = {}

        def add(u, v, c):
            cap[(u, v)] = cap.get((u, v), 0) + c
            cap.setdefault((v, u), 0)
            adj.setdefault(u, []).append(v)
            adj.setdefault(v, []).append(u)

        for c in seen:
            x, y = c % w, c // w
            if c != g:
                add(("i", c), ("o", c), _CAP[tiles[c]])
            for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    n = ny * w + nx
                    if n in seen:
                        add(("o", c), ("i", n), 2)
        add("S", ("o", g), 2)
        add(("o", pos), "T", 1)
        add(("i", ex), "T", 1)
        flow = 0
        while flow < 2:
            prev = {"S": None}
            queue = ["S"]
            qi = 0
            while qi < len(queue) and "T" not in prev:
                u = queue[qi]
                qi += 1
                for v in adj[u]:
                    if v not in prev and cap[(u, v)] > 0:
                        prev[v] = u
                        queue.append(v)
            if "T" not in prev:
                return False
            v = "T"
            while prev[v] is not None:
                u = prev[v]
                cap[(u, v)] -= 1
                cap[(v, u)] += 1
                v = u
            flow += 1
    return True


def canon(L, state):
    """(ok, state with every stone the player can no longer reach wiped). ok is False when a gem still out there,
    or the door, can no longer be reached by stone: then the level is lost already."""
    pos, tiles, km = state
    w, h = L["w"], L["h"]
    pads = L["pads"]
    seen = {pos}
    stack = [pos]
    while stack:
        c = stack.pop()
        x, y = c % w, c // w
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                n = ny * w + nx
                if n not in seen and tiles[n] != ABYSS:
                    seen.add(n)
                    stack.append(n)
                    if tiles[n] == PAD and pads.get(n) is not None and tiles[pads[n]] == PAD and pads[n] not in seen:
                        seen.add(pads[n])
                        stack.append(pads[n])
    if L["exit"] not in seen:
        return False, state
    for j, k in enumerate(L["keys"]):
        if not (km >> j) & 1 and k not in seen:
            return False, state
    if not L["pads"] and not _flow_ok(L, state, seen):
        return False, state
    if len(seen) == sum(1 for v in tiles if v != ABYSS):
        return True, state
    t = bytearray(len(tiles))
    for c in seen:
        t[c] = tiles[c]
    return True, (pos, bytes(t), km)


_MEMO = {}  # level index -> {state: bool}; module level so a deep copy of the game stays small
SEARCH_CAP = 300000


def is_alive(li, L, state):
    """Can this state still reach a win? Exhaustive search with memory; unknown (cap hit) counts as alive."""
    memo = _MEMO.setdefault(li, {})
    ok, state = canon(L, state)
    if not ok:
        return False
    got = memo.get(state)
    if got is not None:
        return got
    w = L["w"]
    keys = L["keys"]
    ex, ey = L["exit"] % w, L["exit"] // w

    h = L["h"]

    def order(s):
        """Try first the move that gets closest, by walking distance over the stones still standing, to the nearest gem
        (or to the door when every gem is in)."""
        pos, tiles, km = s
        goals = [k for j, k in enumerate(keys) if not (km >> j) & 1] or [L["exit"]]
        dist = {g: 0 for g in goals}
        frontier = list(goals)
        while frontier:
            nxt = []
            for c in frontier:
                x, y = c % w, c // w
                for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        n = ny * w + nx
                        if n not in dist and tiles[n] != ABYSS:
                            dist[n] = dist[c] + 1
                            nxt.append(n)
            frontier = nxt
        x, y = pos % w, pos // w

        def key(d):
            nx, ny = x + DIRS[d][0], y + DIRS[d][1]
            if 0 <= nx < w and 0 <= ny < h:
                return dist.get(ny * w + nx, 9999)
            return 10000

        return sorted((1, 2, 3, 4), key=key)

    if is_win(L, state):
        memo[state] = True
        return True
    visited = {state}
    path = [(state, iter(order(state)))]
    nodes = 0
    found = False
    while path:
        s, it = path[-1]
        step = next(it, None)
        if step is None:
            path.pop()
            continue
        r = apply(L, s, step)
        if r is None:
            continue
        if is_win(L, r[0]):
            found = True
            break
        ok, ns = canon(L, r[0])
        if not ok:
            continue
        if ns in visited:
            continue
        m = memo.get(ns)
        if m is True:
            found = True
            break
        if m is False:
            continue
        visited.add(ns)
        nodes += 1
        if nodes > SEARCH_CAP:
            return True
        path.append((ns, iter(order(ns))))
    if found:
        for s, _ in path:
            memo[s] = True
        return True
    for s in visited:
        memo[s] = False
    return False


# ============================================================================
# Drawing. Everything is cut from flat colour; black is the border between stones.
# ============================================================================
def _grid(t, fill=CLEAR):
    return np.full((t, t), fill, dtype=np.int16)


def _shave(a):
    t = a.shape[0]
    for (y, x) in ((0, 0), (0, t - 1), (t - 1, 0), (t - 1, t - 1)):
        a[y, x] = CLEAR
    return a


def _tile_art(kind, t):
    a = _grid(t)
    if kind == FLOOR:
        a[:, :] = BLUE
        a[0, 1:t - 1] = AZURE
        _shave(a)
    elif kind == CRACKED:
        a[:, :] = MAROON
        for i in range(1, t - 1):
            a[i, t // 2 + (1 if i % 2 else 0)] = BLACK
        _shave(a)
    elif kind == STURDY:
        a[:, :] = PURPLE
        if t >= 7:
            for (y, x) in ((1, 1), (1, t - 2), (t - 2, 1), (t - 2, t - 2)):
                a[y, x] = WHITE
        else:
            a[t // 2, t // 2] = WHITE
        _shave(a)
    elif kind == "dust":  # a stone in the middle of falling
        a[2:t - 2, 2:t - 2] = MAROON
        for i in range(2, t - 2):
            a[i, t // 2 + (1 if i % 2 else 0)] = BLACK
    return a


def _pad_art(t, pair):
    a = _grid(t)
    c = t // 2
    for y in range(t):
        for x in range(t):
            d = abs(x - c) + abs(y - c)
            if d <= c:
                a[y, x] = MAGENTA
            if d <= max(1, c // 2):
                a[y, x] = (AZURE, WHITE, YELLOW)[pair - 1]
    return a


def _key_art(t):
    a = _grid(t)
    c = t // 2
    r = 2 if t >= 9 else 1
    for y in range(t):
        for x in range(t):
            if abs(x - c) + abs(y - c) <= r:
                a[y, x] = ORANGE
    if r == 2:
        a[c, c] = YELLOW
    return a


def _exit_art(t, open_):
    a = _grid(t)
    a[:, :] = YELLOW
    _shave(a)
    inner = GREEN if open_ else RED
    if t >= 7:
        x0, x1 = 2, t - 3
        for y in range(2, t - 1):
            for x in range(x0, x1 + 1):
                a[y, x] = inner
        a[2, x0] = YELLOW
        a[2, x1] = YELLOW
        if not open_:
            a[2:t - 1, t // 2] = BLACK
    elif t >= 5:
        a[1:t - 1, 2:t - 2] = inner
        if not open_:
            a[t // 2, 2:t - 2] = BLACK
    else:
        a[1:t - 1, 1:t - 1] = inner
        if not open_:
            a[1, 1] = BLACK
            a[2, 2] = BLACK
    return a


FIGURES = {
    11: ["...WWW...", "...WWW...", "..WWWWW..", ".WWWWWWW.", ".WWWWWWW.", "..WWWWW..", "..WW.WW..", "..WW.WW.."],
    9: ["..WWW..", "..WWW..", ".WWWWW.", ".WWWWW.", "..WWW..", "..W.W..", "..W.W.."],
    7: [".WWW.", ".WWW.", "WWWWW", ".WWW.", ".W.W."],
    5: [".W.", "WWW", ".W.", "W.W"],
    3: [".W.", "WWW", "W.W"],
}


def _figure_art(t, colour):
    rows = FIGURES[max(k for k in FIGURES if k <= t)]
    a = _grid(t)
    fh, fw = len(rows), len(rows[0])
    oy, ox = (t - fh) // 2, (t - fw) // 2
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == "W":
                a[oy + y, ox + x] = colour
    return a


class Cr01Display(RenderableUserDisplay):
    """The gem counter along the top: one small diamond per gem, orange waiting, green taken."""

    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        g = self.game
        if g.L is None:
            return frame
        n = len(g.L["keys"])
        got = bin(g.state[2]).count("1")
        if n <= 10:
            total = n * 6 - 2
            x0 = (64 - total) // 2
            for i in range(n):
                col = GREEN if i < got else ORANGE
                x = x0 + i * 6
                frame[2, x + 2] = col
                frame[3, x + 1:x + 4] = col
                frame[4, x + 2] = col
        else:
            total = n * 4 - 2
            x0 = (64 - total) // 2
            for i in range(n):
                col = GREEN if i < got else ORANGE
                x = x0 + i * 4
                frame[2:4, x:x + 2] = col
        return frame


def _origin(L, p):
    ox = (64 - L["w"] * p) // 2
    oy = 6 + (58 - L["h"] * p) // 2
    return ox, oy


def _build_level(li):
    L = parse(MAPS[li])
    p = PITCH[li]
    t = p - 1
    ox, oy = _origin(L, p)
    w = L["w"]
    sprites = []
    for i, kind in enumerate(L["tiles"]):
        if kind == ABYSS:
            continue
        x, y = ox + (i % w) * p, oy + (i // w) * p
        if i == L["exit"]:
            sprites.append(Sprite(_exit_art(t, False), name="exit", x=x, y=y, layer=1, tags=["exit"]))
        elif kind == PAD:
            sprites.append(Sprite(_pad_art(t, L["pairs"][i]), name="tile_%d" % i, x=x, y=y, layer=0, tags=["tile", "pad"]))
        else:
            sprites.append(Sprite(_tile_art(kind, t), name="tile_%d" % i, x=x, y=y, layer=0, tags=["tile"]))
    for j, k in enumerate(L["keys"]):
        x, y = ox + (k % w) * p, oy + (k // w) * p
        sprites.append(Sprite(_key_art(t), name="key_%d" % j, x=x, y=y, layer=2, tags=["key"]))
    s = L["start"]
    sprites.append(Sprite(_figure_art(t, WHITE), name="player", x=ox + (s % w) * p, y=oy + (s // w) * p,
                          layer=5, tags=["player"]))
    return Level(sprites=sprites, grid_size=(64, 64), data={"map": li}, name="level %d" % (li + 1))


# ============================================================================
# The game
# ============================================================================
class Cr01(ARCBaseGame):
    def __init__(self):
        self.display = Cr01Display(self)
        self.L = None
        self.li = 0
        self.state = (0, b"", 0)
        self._q = None
        self._advance = False
        self._ox = self._oy = 0
        levels = [_build_level(i) for i in range(len(MAPS))]
        super().__init__("cr01", levels, Camera(0, 0, 64, 64, BLACK, BLACK, [self.display]), False, len(levels), [1, 2, 3, 4])

    # -- helpers -------------------------------------------------------------
    def _sp(self, name):
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def _cell_xy(self, i):
        p = PITCH[self.li]
        return self._ox + (i % self.L["w"]) * p, self._oy + (i // self.L["w"]) * p

    def on_set_level(self, level):
        self.li = self.level_index
        self.L = parse(MAPS[self.li])
        self.state = initial(self.L)
        self._q = None
        self._ox, self._oy = _origin(self.L, PITCH[self.li])

    # -- one action ------------------------------------------------------------
    def step(self):
        aid = self.action.id.value
        if aid == 0:  # RESET: the engine has already restored the level
            self._q = None
            self._advance = False
            self.complete_action()
            return
        if self._advance:
            self._advance = False
            self.complete_action()
            return
        if self._q is None:
            self._q = self._plan(aid)
        frame = self._q.pop(0)
        self._finished = False
        for op in frame:
            self._do(op)
        if self._q is not None and not self._q:
            self._q = None
            if not self._finished and not self._advance:
                self.complete_action()

    _finished = False

    def _plan(self, aid):
        """Decide the whole outcome once, then lay it out as frames of tiny operations."""
        L, p = self.L, PITCH[self.li]
        self._finished = False
        px, py = self._cell_xy(self.state[0])
        r = apply(L, self.state, aid)
        if r is None:  # refused: a small nudge toward the gap and back
            dx, dy = DIRS[aid]
            return [[("pos", px + dx * 2, py + dy * 2)], [("pos", px + dx, py + dy)], [("pos", px, py)]]
        ns, info = r
        frames = []
        dx, dy = DIRS[aid]
        a1 = info["arrive"]
        ax, ay = self._cell_xy(a1)
        steps = [p // 3, (2 * p) // 3, p]
        for n, s in enumerate(steps):
            f = [("pos", px + dx * s, py + dy * s)]
            if n == 0 and info["fate"] == "crack":
                f.append(("tile", info["left"], CRACKED))
            if n == 0 and info["fate"] == "fall":
                f.append(("tile", info["left"], "dust"))
            if n == 1 and info["fate"] == "fall":
                f.append(("tile", info["left"], None))
                if info["gone_pair"] is not None:
                    f.append(("tile", info["gone_pair"], None))
            frames.append(f)
        # gem taken on arrival
        j = None
        if a1 in L["keys"]:
            j = L["keys"].index(a1)
            if (self.state[2] >> j) & 1:
                j = None
        if j is not None:
            frames[-1].append(("key", j))
            if ns[2] == (1 << len(L["keys"])) - 1:
                frames[-1].append(("door", True))
        if info["warp"] is not None:
            bx, by = self._cell_xy(info["warp"][1])
            frames.append([("hide",)])
            frames.append([("pos", bx, by), ("show",)])
        self.state = ns
        if is_win(L, ns):
            frames.append([("win",)])
        elif not is_alive(self.li, L, ns):
            cx, cy = (bx, by) if info["warp"] is not None else (ax, ay)
            frames.append([("pos", cx, cy), ("die",)])
            for _ in range(10):
                frames.append([])
            frames.append([("restart",)])
        return frames

    def _do(self, op):
        k = op[0]
        if k == "pos":
            pl = self._sp("player")
            if pl is not None:
                pl.set_position(op[1], op[2])
        elif k == "tile":
            sp = self._sp("tile_%d" % op[1])
            if sp is None:
                return
            if op[2] is None:
                sp.set_visible(False)
            else:
                sp.pixels = _tile_art(op[2], PITCH[self.li] - 1)
        elif k == "key":
            sp = self._sp("key_%d" % op[1])
            if sp is not None:
                sp.set_visible(False)
        elif k == "door":
            sp = self._sp("exit")
            if sp is not None:
                sp.pixels = _exit_art(PITCH[self.li] - 1, True)
        elif k == "hide":
            pl = self._sp("player")
            if pl is not None:
                pl.set_visible(False)
        elif k == "show":
            pl = self._sp("player")
            if pl is not None:
                pl.set_visible(True)
        elif k == "die":
            pl = self._sp("player")
            if pl is not None:
                pl.pixels = _figure_art(PITCH[self.li] - 1, PINK)
        elif k == "restart":
            self._q = None
            self.level_reset()
            if self._action_count < 1:
                self._action_count = 1
            self._finished = True
            self.complete_action()
        elif k == "win":
            self._finished = True
            self.next_level()
            if self._next_level:
                self._advance = True
            else:
                self.complete_action()
