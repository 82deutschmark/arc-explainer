# ARC-AGI-3 candidate task g018.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

N = 16
CELL = 4
SEA_H = -2
ROCK_H = -1
PEAK_H = 9
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

# palette (indices into the 16-colour board)
WHITE = 0
BLACK = 5
PINK = 7
RED = 8
SEA = 9
FOAM = 10
SAND = 11
HILL = 12
GRASS = 14
FLAGC = 15
GROUND = (SAND, GRASS, HILL)


def art(rows, key):
    return [[-1 if ch == "." else key[ch] for ch in row] for row in rows]


FLAG_ROWS = ("KFF.", "KF..", "K...", "KK..")
# summit pole: eight rows, the lower four stand on the summit cell itself
POLE_TALL = ("KCC.", "KCC.", "K...", "K...", "K...", "K...", "K...", "KK..")
POND_ROWS = ("LLLL", "LSLL", "LLSL", "LLLL")
DRIED_ROWS = ("....", ".L..", "..L.", "....")
SPLASH_ROWS = ("WLLW", "LLLL", "LLLL", "WLLW")
DRAIN_ROWS = (".KK.", "KLLK", "KLLK", ".KK.")
DRAIN_USED_ROWS = (".KK.", "KKKK", "KKKK", ".KK.")
DRAIN_FLASH_ROWS = (".WW.", "WLLW", "WLLW", ".WW.")
FIGURE_ROWS = (".HH.", "KKKK", ".KK.", "K..K")

KEY_ALL = {"K": BLACK, "F": FLAGC, "S": SEA, "L": FOAM, "W": WHITE}
KEY_LOST = {"K": BLACK, "F": RED, "S": SEA, "L": FOAM, "W": WHITE}
FIGURE_KEYS = (
    {"H": WHITE, "K": BLACK},
    {"H": RED, "K": RED},
    {"H": PINK, "K": PINK},
)

def summit_pixels(filled, flash, lost=False):
    """A flagpole: a black blank pennant until its flag is planted, then the flag's purple."""
    cloth = WHITE if (filled and flash) else (FLAGC if filled else (RED if lost else BLACK))
    out = []
    for r, row in enumerate(POLE_TALL):
        line = []
        for ch in row:
            if ch == "K":
                line.append(BLACK)
            elif ch == "C":
                line.append(cloth)
            else:
                line.append(FOAM if (flash and r >= 4) else -1)
        out.append(line)
    return out


# ---------------------------------------------------------------------------
# Levels. '~' sea, '#' rock, '0' sand, '1' meadow, '2' hill, 'T' a summit pole cell (one per flag).
# Things: S start, F flag, P puddle, D drain.
# ---------------------------------------------------------------------------

# <<<LEVELS
LEVEL_SPECS = [
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~TT~~~~~",
            "~~~~~~~~02200~~~",
            "~~~~~~~0222220~~",
            "~~~~~~~0112220~~",
            "~~~~~~01111110~~",
            "~~~0001111110~~~",
            "~~01111111000~~~",
            "~~01111110~~~~~~",
            "~~01111110~~~~~~",
            "~~0111110~~~~~~~",
            "~~~00000~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
        ),
        "things": (
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            ".........F......",
            "................",
            "........F.......",
            "................",
            ".......S........",
            "................",
            "................",
            "................",
            "................",
            "................",
        ),
    },
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~TT~~~~~~~",
            "~~~~~~~22~~~~~~~",
            "~~000002200000~~",
            "~~0111111111111~",
            "~~~0011111100~~~",
            "~~~~~001000~~~~~",
            "~~~~~~~1~~~~~~~~",
            "~~~0000100000~~~",
            "~~011111111110~~",
            "~1111111111110~~",
            "~~011111111110~~",
            "~~~0111111110~~~",
            "~~~~00000000~~~~",
            "~~~~~~~~~~~~~~~~",
        ),
        "things": (
            "................",
            "................",
            "................",
            "................",
            "................",
            "..............F.",
            "................",
            "................",
            ".......P........",
            "................",
            "................",
            ".F..............",
            "................",
            "................",
            ".......S........",
            "................",
        ),
    },
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~010~~~~~~~~~~",
            "~~~010~~~~~TT~~~",
            "~~~~0~~~~~~22~~~",
            "~~~~0~~~~~~22~~~",
            "~~~~0~~~~02222~~",
            "~~00100~~011110~",
            "~~011110~011110~",
            "~0111110~011110~",
            "~01111111111111~",
            "~0111110~011110~",
            "~0111110~011110~",
            "~~011110~01110~~",
            "~~~0000~~~0000~~",
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
        ),
        "things": (
            "................",
            "....F...........",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "........P.....F.",
            "................",
            "................",
            ".....S..........",
            "................",
            "................",
            "................",
        ),
    },
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
            "~~0000~~~~TTT~~~",
            "~011110~~~2220~~",
            "~011110~~022220~",
            "~011110~~022220~",
            "~011110~~022220~",
            "~~0100~~~022220~",
            "~~~1~~~~~022220~",
            "~~01000~~022220~",
            "~0111110~022220~",
            "~0111110~022220~",
            "~0011111222220~~",
            "~0111110~~0000~~",
            "~~00000~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
        ),
        "things": (
            "................",
            "................",
            "................",
            "................",
            "..F.............",
            "................",
            ".............F..",
            "................",
            "...P............",
            "................",
            "................",
            "................",
            ".F......P.......",
            "....S...........",
            "................",
            "................",
        ),
    },
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
            "~~~~000~~~~TTT~~",
            "~~1011100~~2220~",
            "~~0111110~~2220~",
            "~~0111110002220~",
            "~~0011100~~0220~",
            "~~~~100~~~~0110~",
            "~~~~1~~~~~~0000~",
            "~~~01000~~~~~~~~",
            "~~0111110~~~~~~~",
            "~0111111000~~~~~",
            "~11111110~~~~~~~",
            "~~011110~~~~~~~~",
            "~~~0000~~~~~~~~~",
            "~~~~~~~~~~~~~~~~",
        ),
        "things": (
            "................",
            "................",
            "................",
            "..F.............",
            "......F.........",
            ".......D........",
            "................",
            "................",
            "....P...........",
            "................",
            "................",
            "..........F.....",
            "................",
            "...S............",
            "................",
            "................",
        ),
    },
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~~~000000~~~~~",
            "~~~~~0TTT20~~~~~",
            "~~~~~~~~~1~~~~~~",
            "~~~~~~~~~1~~~~~~",
            "~~0000~~~22200~~",
            "~011110~~222220~",
            "~011110~~022220~",
            "~011110~~022220~",
            "~~0100~~~~0200~~",
            "~~~1~~~~~~~2~~~~",
            "~~~1000000010~~~",
            "~~0111111111100~",
            "~~011111111110~~",
            "~~~0001111000~~~",
            "~~~~~~0000~~~~~~",
        ),
        "things": (
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            ".............F..",
            "...F............",
            "...........D....",
            "................",
            "...P.......P....",
            "................",
            ".........S......",
            "................",
            "............F...",
            "................",
        ),
    },
    {
        "terrain": (
            "~~~~~~~~~~~~~~~~",
            "~~~~~~0000~~~~~~",
            "~~~~02222220~~~~",
            "~~~2222222222~~~",
            "~~~1~~2222~~1~~~",
            "~~0110~~~~0110~~",
            "~0110~~~~~~0110~",
            "~0110~TTT000110~",
            "~0110~~22~~0110~",
            "~0110~~~~~~0110~",
            "~~~1~~~~~~~~~~~~",
            "~~010000000000~~",
            "~~~0111111110~~~",
            "~~~~01111110~~~~",
            "~~~~~~0000~~~~~~",
            "~~~~~~~~~~~~~~~~",
        ),
        "things": (
            "................",
            "................",
            ".........D......",
            "........F.......",
            "...P............",
            "................",
            "..F.............",
            "................",
            "................",
            ".............D..",
            "...P............",
            ".............F..",
            "................",
            ".....S..........",
            "................",
            "................",
        ),
    },
]
# LEVELS>>>


def build_model(spec):
    terrain, things = spec["terrain"], spec["things"]
    assert len(terrain) == N and len(things) == N
    h = [[SEA_H] * N for _ in range(N)]
    podium = []
    flags, puddles, drains = [], [], []
    start = None
    for y in range(N):
        assert len(terrain[y]) == N and len(things[y]) == N, f"row {y} wrong length"
        for x in range(N):
            c = terrain[y][x]
            if c == "~":
                h[y][x] = SEA_H
            elif c == "#":
                h[y][x] = ROCK_H
            elif c == "T":
                h[y][x] = PEAK_H
                podium.append((x, y))
            else:
                h[y][x] = int(c)
            t = things[y][x]
            if t == "F":
                flags.append((x, y))
            elif t == "P":
                puddles.append((x, y))
            elif t == "D":
                drains.append((x, y))
            elif t == "S":
                start = (x, y)
    assert len(podium) == len(flags), "one summit pole cell per flag"
    assert start is not None and h[start[1]][start[0]] >= 0
    for cell in flags + puddles + drains:
        assert 0 <= h[cell[1]][cell[0]] <= 2, f"thing {cell} is not on ordinary ground"
    assert len(set(flags + puddles + drains + [start])) == len(flags + puddles + drains) + 1
    assert 1 <= len(flags) <= 3 and len(puddles) <= 5 and len(drains) <= 2
    return {
        "h": h,
        "flags": flags,
        "puddles": puddles,
        "drains": drains,
        "start": start,
        "podium": podium,
        "podset": frozenset(podium),
        "fidx": {c: i for i, c in enumerate(flags)},
        "pidx": {c: i for i, c in enumerate(puddles)},
        "didx": {c: i for i, c in enumerate(drains)},
        "allmask": (1 << len(flags)) - 1,
        "cache": {},
    }


MODELS = [build_model(s) for s in LEVEL_SPECS]


# ---------------------------------------------------------------------------
# Rules. State = (x, y, water, pending, wet, taken, used).
# ---------------------------------------------------------------------------


def start_state(m):
    return (m["start"][0], m["start"][1], 0, 0, 0, 0, 0)


def passable(m, x, y, water):
    h = m["h"][y][x]
    return h >= 0 and h >= water


def event_at(m, s, x, y):
    c = (x, y)
    i = m["fidx"].get(c)
    if i is not None and not (s[5] >> i) & 1:
        return ("F", i)
    i = m["pidx"].get(c)
    if i is not None and not (s[4] >> i) & 1:
        return ("P", i)
    i = m["didx"].get(c)
    if i is not None and s[2] > 0 and not (s[6] >> i) & 1:
        return ("D", i)
    return None


def enter(m, s, x, y):
    """The player steps onto (x, y). Returns (new state, kind); kind is None, F, P, D or drown."""
    _, _, water, pending, wet, taken, used = s
    ev = event_at(m, s, x, y)
    if ev is None:
        return (x, y, water, pending, wet, taken, used), None
    kind, i = ev
    if kind == "P":
        return (x, y, water, pending + 1, wet | (1 << i), taken, used), "P"
    if kind == "F":
        water2 = water + pending
        ns = (x, y, water2, 0, wet, taken | (1 << i), used)
        if m["h"][y][x] < water2:
            return ns, "drown"
        return ns, "F"
    return (x, y, water - 1, pending, wet, taken, used | (1 << i)), "D"


def move(m, s, dx, dy):
    x, y = s[0] + dx, s[1] + dy
    if not (0 <= x < N and 0 <= y < N) or not passable(m, x, y, s[2]):
        return s, "blocked"
    return enter(m, s, x, y)


def is_win(m, s):
    return (s[0], s[1]) in m["podset"] and s[5] == m["allmask"]


def region(m, s):
    """Cells the player can reach from s without triggering anything, and the events touching them."""
    water = s[2]
    h = m["h"]
    seen = {(s[0], s[1])}
    stack = [(s[0], s[1])]
    events = {}
    while stack:
        x, y = stack.pop()
        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen or not (0 <= nx < N and 0 <= ny < N):
                continue
            hh = h[ny][nx]
            if hh < 0 or hh < water:
                continue
            ev = event_at(m, s, nx, ny)
            if ev is not None:
                events[(nx, ny)] = ev
            else:
                seen.add((nx, ny))
                stack.append((nx, ny))
    return seen, events


def winnable(m, s):
    """Can the level still be won from s? Walking between events is reversible, so only events matter."""
    cache = m["cache"]
    got = cache.get(s)
    if got is not None:
        return got
    cache[s] = False
    ok = False
    if is_win(m, s):
        ok = True
    else:
        seen, events = region(m, s)
        if s[5] == m["allmask"] and any(c in m["podset"] for c in seen):
            ok = True
        else:
            for (cx, cy) in sorted(events):
                ns, kind = enter(m, s, cx, cy)
                if kind != "drown" and winnable(m, ns):
                    ok = True
                    break
    cache[s] = ok
    return ok


def lost_items(m, s, water):
    """Untaken flags, and the summit, that can no longer be reached at this water level
    (even treating every tile with something on it as walkable). Used only to explain a death."""
    h = m["h"]
    seen = {(s[0], s[1])}
    stack = [(s[0], s[1])]
    while stack:
        x, y = stack.pop()
        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen or not (0 <= nx < N and 0 <= ny < N):
                continue
            if h[ny][nx] < 0 or h[ny][nx] < water:
                continue
            seen.add((nx, ny))
            stack.append((nx, ny))
    flags = frozenset(i for i, c in enumerate(m["flags"])
                      if not (s[5] >> i) & 1 and c not in seen)
    return flags, not any(c in seen for c in m["podium"])


def doomed_items(m, s):
    """Untaken flags that can never again be planted without drowning, and whether the summit can
    never again be reached, whatever the player does from state s. Used only to explain a death."""
    seen = {s}
    stack = [s]
    plantable = set()
    summit = False
    while stack:
        t = stack.pop()
        reach, events = region(m, t)
        if any(c in m["podset"] for c in reach):
            summit = True
        for (cx, cy) in sorted(events):
            ns, kind = enter(m, t, cx, cy)
            if kind == "F":
                plantable.add(m["fidx"][(cx, cy)])
            if kind == "drown":
                continue
            if ns not in seen:
                seen.add(ns)
                stack.append(ns)
    flags = frozenset(i for i in range(len(m["flags"]))
                      if not (s[5] >> i) & 1 and i not in plantable)
    return flags, not summit


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------


def rest_view(s, **over):
    v = {
        "px": s[0] * CELL, "py": s[1] * CELL, "w": s[2], "p": s[3], "wet": s[4],
        "taken": s[5], "used": s[6], "foam": frozenset(), "drowned": frozenset(),
        "style": 0, "blink": False, "splash": -1, "sock": -1, "dflash": -1,
        "lost": frozenset(), "lost_summit": False, "pv": False,
    }
    v.update(over)
    return v


def paint_terrain(m, v):
    h = m["h"]
    water = v["w"]
    foam, drowned = v["foam"], v["drowned"]
    target = water + v["p"] if (v["p"] > 0 and (v["pv"] or v["taken"] != m["allmask"])) else None
    grid = np.empty((N, N), dtype=np.int8)
    for cy in range(N):
        for cx in range(N):
            hh = h[cy][cx]
            if hh == SEA_H:
                c = SEA
            elif hh == ROCK_H:
                c = BLACK
            elif (cx, cy) in drowned:
                c = SEA
            elif hh < water:
                c = SEA
            else:
                c = GROUND[min(hh, 2)]
            if (cx, cy) in foam:
                c = FOAM
            grid[cy, cx] = c
    out = np.repeat(np.repeat(grid, CELL, axis=0), CELL, axis=1)
    if target is not None:
        for cy in range(N):
            for cx in range(N):
                hh = h[cy][cx]
                if 0 <= hh < PEAK_H and water <= hh < target and (cx, cy) not in drowned:
                    for iy in range(CELL):
                        for ix in range(CELL):
                            if (ix + iy) % 2 == 0:
                                out[cy * CELL + iy, cx * CELL + ix] = FOAM
    out[0, :] = BLACK
    out[-1, :] = BLACK
    out[:, 0] = BLACK
    out[:, -1] = BLACK
    return out


def build_levels():
    levels = []
    for m in MODELS:
        sprites = [
            Sprite(pixels=np.full((64, 64), SEA, dtype=np.int8), name="terrain",
                   blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                   layer=0).set_position(0, 0)
        ]
        for (cx, cy) in m["podium"]:
            sprites.append(Sprite(pixels=np.array(summit_pixels(False, False), dtype=np.int8),
                                  name="summit", blocking=BlockingMode.NOT_BLOCKED,
                                  interaction=InteractionMode.INTANGIBLE,
                                  layer=1).set_position(cx * CELL, (cy - 1) * CELL))
        for name, cells, rows, key in (
            ("puddle", m["puddles"], POND_ROWS, KEY_ALL),
            ("drain", m["drains"], DRAIN_ROWS, KEY_ALL),
            ("flag", m["flags"], FLAG_ROWS, KEY_ALL),
        ):
            for (cx, cy) in cells:
                sprites.append(Sprite(pixels=np.array(art(rows, key), dtype=np.int8), name=name,
                                      blocking=BlockingMode.NOT_BLOCKED,
                                      interaction=InteractionMode.INTANGIBLE,
                                      layer=2).set_position(cx * CELL, cy * CELL))
        sx, sy = m["start"]
        sprites.append(Sprite(pixels=np.array(art(FIGURE_ROWS, FIGURE_KEYS[0]), dtype=np.int8),
                              name="player", blocking=BlockingMode.NOT_BLOCKED,
                              interaction=InteractionMode.INTANGIBLE,
                              layer=4).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G018(ARCBaseGame):

    def __init__(self) -> None:
        self.state = start_state(MODELS[0])
        self._queue = []
        self._after = None
        super().__init__(game_id="g018", levels=build_levels(),
                         camera=Camera(width=N * CELL, height=N * CELL,
                                       background=BLACK, letter_box=BLACK),
                         available_actions=[1, 2, 3, 4])

    @property
    def model(self):
        return MODELS[self.level_index]

    def on_set_level(self, level):
        self.state = start_state(MODELS[self.level_index])
        self._queue = []
        self._after = None
        self._draw(rest_view(self.state))

    # -- drawing -----------------------------------------------------------

    def _hidden(self, m, v, cx, cy):
        return ((cx, cy) in v["drowned"] or (cx, cy) in v["foam"]
                or 0 <= m["h"][cy][cx] < v["w"])

    def _draw(self, v):
        level = self.current_level
        m = self.model
        level.get_sprites_by_name("terrain")[0].pixels = paint_terrain(m, v)
        filled = bin(v["taken"]).count("1")
        for k, sp in enumerate(level.get_sprites_by_name("summit")):
            sp.pixels = np.array(summit_pixels(k < filled, v["blink"] or k == v["sock"],
                                               v["lost_summit"]), dtype=np.int8)
        for i, sp in enumerate(level.get_sprites_by_name("puddle")):
            cx, cy = m["puddles"][i]
            rows = SPLASH_ROWS if v["splash"] == i else (
                DRIED_ROWS if (v["wet"] >> i) & 1 else POND_ROWS)
            sp.pixels = np.array(art(rows, KEY_ALL), dtype=np.int8)
            sp.set_visible(not self._hidden(m, v, cx, cy))
        for i, sp in enumerate(level.get_sprites_by_name("drain")):
            cx, cy = m["drains"][i]
            rows = DRAIN_FLASH_ROWS if v["dflash"] == i else (
                DRAIN_USED_ROWS if (v["used"] >> i) & 1 else DRAIN_ROWS)
            sp.pixels = np.array(art(rows, KEY_ALL), dtype=np.int8)
            sp.set_visible(not self._hidden(m, v, cx, cy))
        for i, sp in enumerate(level.get_sprites_by_name("flag")):
            cx, cy = m["flags"][i]
            sp.pixels = np.array(art(FLAG_ROWS, KEY_LOST if i in v["lost"] else KEY_ALL),
                                 dtype=np.int8)
            sp.set_visible(not (v["taken"] >> i) & 1 and not self._hidden(m, v, cx, cy))
        pl = level.get_sprites_by_name("player")[0]
        pl.pixels = np.array(art(FIGURE_ROWS, FIGURE_KEYS[min(v["style"], 2)]), dtype=np.int8)
        pl.set_position(v["px"], v["py"])
        pl.set_visible(v["style"] != 3)

    # -- one action ----------------------------------------------------------

    def step(self):
        act = self.action.id
        if act == GameAction.RESET:
            self._queue = []
            self._after = None
            self.complete_action()
            return
        if not self._queue:
            d = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                 GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(act)
            if d is None:
                self.complete_action()
                return
            self._queue, self._after = self._plan(*d)
        self._draw(self._queue.pop(0))
        if not self._queue:
            after, self._after = self._after, None
            if after == "restart":
                self._death_restart()
            elif after == "win":
                self.next_level()
            self.complete_action()

    def _death_restart(self):
        ARCBaseGame.level_reset(self)
        self._action_count = max(1, self._action_count)

    def _plan(self, dx, dy):
        m = self.model
        s = self.state
        ns, kind = move(m, s, dx, dy)
        here = rest_view(s)
        if kind == "blocked":
            tx, ty = s[0] + dx, s[1] + dy
            nudge = rest_view(s, px=s[0] * CELL + dx, py=s[1] * CELL + dy)
            if 0 <= tx < N and 0 <= ty < N and m["h"][ty][tx] != ROCK_H:
                nudge["foam"] = frozenset([(tx, ty)])
            return [nudge, here], None
        frames = [rest_view(s, px=s[0] * CELL + dx * i, py=s[1] * CELL + dy * i)
                  for i in (1, 2, 3, 4)]
        if kind is None:
            self.state = ns
            if is_win(m, ns):
                frames += [rest_view(ns, blink=True), rest_view(ns, blink=True), rest_view(ns)]
                return frames, "win"
            frames[-1] = rest_view(ns)
            di = m["didx"].get((ns[0], ns[1]))
            if di is not None and not (ns[6] >> di) & 1 and ns[2] == 0:
                frames += [rest_view(ns, dflash=di), rest_view(ns, dflash=di), rest_view(ns)]
            return frames, None
        if kind == "drown" or not winnable(m, ns):
            return frames + self._death_frames(s, ns, kind), "restart"
        self.state = ns
        if kind == "P":
            i = m["pidx"][(ns[0], ns[1])]
            frames += [rest_view(ns, splash=i), rest_view(ns)]
            return frames, None
        if kind == "F":
            k = bin(s[5]).count("1")
            frames += [rest_view(s, taken=ns[5], sock=k, pv=True),
                       rest_view(s, taken=ns[5], pv=True)]
            for lvl in range(s[2], ns[2]):
                cells = frozenset((x, y) for y in range(N) for x in range(N)
                                  if m["h"][y][x] == lvl)
                frames.append(rest_view(ns, w=lvl, p=ns[2] - lvl, foam=cells, pv=True))
                frames.append(rest_view(ns, w=lvl + 1, p=ns[2] - lvl - 1, pv=True))
            frames[-1] = rest_view(ns)
            return frames, None
        # drain
        i = m["didx"][(ns[0], ns[1])]
        frames += [rest_view(ns, w=s[2], dflash=i)]
        cells = frozenset((x, y) for y in range(N) for x in range(N) if m["h"][y][x] == ns[2])
        frames += [rest_view(ns, w=s[2], foam=cells), rest_view(ns)]
        return frames, None

    def _death_frames(self, s, ns, kind):
        """What the player sees when the level can no longer be won: the tide that does it,
        the goals it takes away shown in red, the figure flashing, then the level as entered."""
        m = self.model
        base = {"px": ns[0] * CELL, "py": ns[1] * CELL}
        w0 = s[2]
        if kind == "P":
            target = s[2] + ns[3]
        else:
            target = ns[2]
        cells = frozenset((x, y) for y in range(N) for x in range(N)
                          if 0 <= m["h"][y][x] < PEAK_H and w0 <= m["h"][y][x] < target)
        if kind == "P":
            first = rest_view(ns, splash=m["pidx"][(ns[0], ns[1])], **base)
        elif kind in ("F", "drown"):
            first = rest_view(s, taken=ns[5], sock=bin(s[5]).count("1"), pv=True, **base)
        else:
            first = rest_view(ns, w=s[2], dflash=m["didx"][(ns[0], ns[1])], **base)
        if kind == "drown":
            lost, lost_summit = frozenset(), False
        else:
            lost, lost_summit = lost_items(m, ns, target)
            dflags, dsummit = doomed_items(m, ns)
            lost, lost_summit = lost | dflags, lost_summit or dsummit
        frames = [first,
                  rest_view(ns, w=w0, p=max(0, target - w0), foam=cells, pv=True, **base),
                  rest_view(ns, w=target, p=0, style=1, lost=lost, lost_summit=lost_summit, **base)]
        for i in range(7):
            frames.append(rest_view(ns, w=target, p=0, style=1 if (i // 3) % 2 == 0 else 2,
                                    lost=lost, lost_summit=lost_summit, **base))
        frames.append(rest_view(ns, **base))
        return frames
