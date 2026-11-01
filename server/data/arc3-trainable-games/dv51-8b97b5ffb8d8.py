"""dv51"""
import copy

import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, Sprite

# ---------------------------------------------------------------- palette
FIELD = 15     # purple: the flat field behind everything
INK = 5        # black: tanks and every hard border
WATER = 9      # blue: the cargo
SHEEN = 10     # light blue: the surface of the top block, the second circuit's pipes
MARK = 0       # white: the target dashes, the travelling pulse
WHEEL = 11     # yellow: a button you can press
COPPER = 12    # orange: pipe
DONE = 14      # green: matched, delivered
IDLE = 13      # maroon: not yet
REFUSE = 8     # red: refused (the only thing red means here)

UNIT = 3       # rows per unit of water: two of water, one of gap


# ---------------------------------------------------------------- rules (pure)
# A level is a dict: caps, start, valves=[(a, b, load, circuit)], orders=[levels, ...].
# State: v (units in each tank) and f (one reverse bit per circuit).

def circuits(spec):
    return 1 + max(valve[3] for valve in spec["valves"])


def lanes(spec, f, j):
    """(source, destination) of valve j under the lever settings f."""
    a, b, load, circuit = spec["valves"][j]
    return (b, a) if f[circuit] else (a, b)


def refusal(spec, v, f, j):
    """None when valve j can pour now, else the tank that stops it (empty source / full target)."""
    load = spec["valves"][j][2]
    src, dst = lanes(spec, f, j)
    if v[src] < load:
        return src
    if v[dst] + load > spec["caps"][dst]:
        return dst
    return None


def pour(spec, v, f, j):
    """New levels after pressing valve j (the caller has checked it is allowed)."""
    load = spec["valves"][j][2]
    src, dst = lanes(spec, f, j)
    w = list(v)
    w[src] -= load
    w[dst] += load
    return tuple(w)


# ---------------------------------------------------------------- levels
LEVELS = [
    # 1: one pipe, two tanks
    dict(caps=(4, 4), start=(3, 0), valves=[(0, 1, 1, 0)], orders=[(1, 2)]),
    # 2: a chain with narrow middle tanks, two deliveries, forward only
    dict(caps=(6, 2, 2, 6), start=(6, 0, 0, 0),
         valves=[(0, 1, 1, 0), (1, 2, 1, 0), (2, 3, 1, 0)],
         orders=[(3, 1, 1, 1), (1, 1, 1, 3)]),
    # 3: water has to go against the arrows: the flow lever
    dict(caps=(3, 3, 5, 3), start=(1, 3, 2, 2),
         valves=[(0, 1, 1, 0), (1, 2, 1, 0), (2, 3, 1, 0)],
         orders=[(0, 2, 5, 1), (3, 1, 2, 2), (0, 2, 3, 3)]),
    # 4: a ring with two double pipes
    dict(caps=(6, 3, 6, 4), start=(0, 3, 3, 4),
         valves=[(0, 1, 1, 0), (1, 2, 1, 0), (2, 3, 2, 0), (3, 0, 2, 0)],
         orders=[(6, 0, 0, 4), (0, 3, 5, 2), (5, 1, 0, 4)]),
    # 5: the white pipes get their own lever
    dict(caps=(4, 5, 4, 5), start=(4, 2, 3, 3),
         valves=[(0, 1, 1, 0), (1, 2, 1, 1), (2, 3, 1, 0)],
         orders=[(2, 5, 0, 5), (4, 5, 2, 1), (0, 4, 3, 5)]),
    # 6: five tanks in a ring, two circuits, double pipes
    dict(caps=(5, 4, 6, 6, 5), start=(4, 3, 3, 1, 1),
         valves=[(0, 1, 2, 0), (1, 2, 1, 1), (2, 3, 2, 0), (3, 4, 1, 1), (4, 0, 1, 0)],
         orders=[(0, 2, 4, 6, 0), (5, 3, 1, 2, 1), (0, 1, 5, 6, 0)]),
    # 7: five tanks in a row, nearly full
    dict(caps=(6, 4, 3, 6, 6), start=(4, 3, 3, 4, 4),
         valves=[(0, 1, 2, 0), (1, 2, 1, 1), (2, 3, 1, 0), (3, 4, 2, 1)],
         orders=[(0, 4, 2, 6, 6), (6, 4, 3, 5, 0), (0, 3, 3, 6, 6)]),
    # 8: the whole bank, four deliveries
    dict(caps=(6, 5, 4, 3, 6), start=(4, 4, 2, 2, 4),
         valves=[(0, 1, 2, 0), (1, 2, 1, 0), (2, 3, 1, 1), (3, 4, 2, 1)],
         orders=[(2, 1, 4, 3, 6), (6, 4, 2, 2, 2), (0, 3, 4, 3, 6), (6, 5, 3, 2, 0)]),
]


# ---------------------------------------------------------------- layout
# One row of tanks standing on a shelf.  Pipes arch over the top: neighbours on the first tier,
# the pipe that closes a ring (first tank to last) on the second.  Each pipe carries a 9x9 wheel at
# the top of its arch.  The lever(s) sit under the shelf; the delivery rail runs along the top.

def tank_geometry(n):
    """Interior width, gap between tanks, pipe thickness for n tanks in a row."""
    if n <= 2:
        return 9, 14, 3
    if n == 3:
        return 8, 9, 3
    if n == 4:
        return 7, 6, 3
    if n == 5:
        return 6, 4, 2
    return 5, 3, 2


def walk_of(points):
    """The pixels of an axis-aligned polyline, in order, end included."""
    walk = []
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        dx = (x2 > x1) - (x2 < x1)
        dy = (y2 > y1) - (y2 < y1)
        x, y = x1, y1
        while (x, y) != (x2, y2):
            walk.append((x, y))
            x += dx
            y += dy
    walk.append(points[-1])
    return walk


def layout(spec):
    n = len(spec["caps"])
    w, gap, pt = tank_geometry(n)
    outer = w + 2
    total = n * outer + (n - 1) * gap
    x0 = (64 - total) // 2
    ring = any(max(a, b) - min(a, b) > 1 for a, b, _, _ in spec["valves"])
    maxcap = max(spec["caps"])
    # centre the whole machine between the rail (row 9) and the lever strip (row 55)
    content = UNIT * maxcap + 16 + (11 if ring else 0)
    top_edge = 9 + (46 - content) // 2
    floor = top_edge + content - 4
    tanks = []
    for i, cap in enumerate(spec["caps"]):
        left = x0 + i * (outer + gap)
        tanks.append(dict(x=left, top=floor - UNIT * cap, w=w, cap=cap, ix=left + 1, cx=left + outer // 2))
    tallest = min(t["top"] for t in tanks)
    tier = {1: tallest - 8, 2: tallest - 19}

    def port(i, side):
        t = tanks[i]
        if side == "L":
            return t["ix"] + (pt - 1) // 2
        return t["ix"] + t["w"] - 1 - pt // 2

    lo, hi = (pt - 1) // 2, pt // 2
    valves = []
    for j, (a, b, load, circuit) in enumerate(spec["valves"]):
        p, q = min(a, b), max(a, b)
        if q == p + 1:
            xp, xq, ty = port(p, "R"), port(q, "L"), tier[1]
        else:
            xp, xq, ty = port(p, "L"), port(q, "R"), tier[2]
        walk = walk_of([(xp, tanks[p]["top"] - 1), (xp, ty), (xq, ty), (xq, tanks[q]["top"] - 1)])
        xs = [x for x, _ in walk]
        ys = [y for _, y in walk]
        bx, by = min(xs) - lo, min(ys) - lo
        pos = np.full((max(ys) + hi - by + 1, max(xs) + hi - bx + 1), -1, dtype=np.int16)
        for s, (x, y) in enumerate(walk):
            pos[y - lo - by:y + hi - by + 1, x - lo - bx:x + hi - bx + 1] = s
        valves.append(dict(a=a, b=b, p=p, q=q, load=load, circuit=circuit, walk=walk,
                           box=(bx, by), pos=pos, wheel=((xp + xq) // 2, ty)))
    levers = [(32, 59)] if circuits(spec) == 1 else [(17, 59), (47, 59)]
    return dict(n=n, w=w, pt=pt, floor=floor, tanks=tanks, valves=valves, levers=levers)


# ---------------------------------------------------------------- art
CIRCUIT_LOOK = (
    dict(pipe=COPPER, line=WHEEL, wheel=WHEEL, press=COPPER, lit=WHEEL),
    dict(pipe=SHEEN, line=MARK, wheel=MARK, press=SHEEN, lit=WATER),
)

# chevron pixels inside the 7x7 body, pointing right (row, col)
CHEV_ONE = ((1, 2), (1, 3), (2, 3), (2, 4), (3, 4), (3, 5), (4, 3), (4, 4), (5, 2), (5, 3))
CHEV_TWO = ((1, 1), (2, 2), (3, 3), (4, 2), (5, 1), (1, 4), (2, 5), (3, 6), (4, 5), (5, 4))
DOT = ((3, 3), (3, 2), (3, 4), (2, 3), (4, 3))


def wheel_pixels(heads_right, load, look, state):
    """9x9 wheel: black rim, body, chevron(s) showing which way water goes (None = spinning)."""
    px = np.full((9, 9), INK, dtype=np.int8)
    for r, c in ((0, 0), (0, 8), (8, 0), (8, 8)):
        px[r, c] = -1
    body = {"idle": look["wheel"], "pressed": look["press"], "slam": look["press"], "refused": REFUSE,
            "hint": look["wheel"]}[state]
    px[1:8, 1:8] = body
    if state in ("idle", "hint"):
        px[7, 1:8] = look["press"]          # a shaded lower edge: a button that stands proud
    if state in ("hint", "slam"):
        px[0, 1:8] = MARK
        px[8, 1:8] = MARK
        px[1:8, 0] = MARK
        px[1:8, 8] = MARK
    cells = DOT if heads_right is None else (CHEV_ONE if load == 1 else CHEV_TWO)
    for r, c in cells:
        if heads_right is False:
            c = 6 - c
        px[1 + r, 1 + c] = INK
    return px


def lever_pixels(look, knob, hint):
    """17x7 switch: black track, a knob at the left, middle or right (the flow lever)."""
    px = np.full((7, 17), INK, dtype=np.int8)
    for r, c in ((0, 0), (0, 16), (6, 0), (6, 16)):
        px[r, c] = -1
    px[3, 2:15] = look["pipe"]
    for r, c in ((2, 2), (3, 3), (4, 2)):          # ">" at the left end
        px[r, c] = look["pipe"]
    for r, c in ((2, 14), (3, 13), (4, 14)):        # "<" at the right end
        px[r, c] = look["pipe"]
    if hint:
        px[0, 1:16] = MARK
        px[6, 1:16] = MARK
    x = (1, 6, 11)[knob]
    px[1:6, x:x + 5] = look["wheel"]
    px[3, x + 2] = INK
    if knob == 1:
        px[2, x + 2] = INK
        px[4, x + 2] = INK
        px[3, x + 1] = INK
        px[3, x + 3] = INK
    return px


def tank_pixels(w, cap, matched, refused):
    """Black body, open at the top, with a lamp strip underneath.  A refusing tank gets a red rim:
    along the floor when it has nothing to give, along the brim when it has no room."""
    rows = UNIT * cap + 4
    px = np.full((rows, w + 2), INK, dtype=np.int8)
    px[rows - 2:rows, 1:w + 1] = DONE if matched else IDLE
    if refused:
        px[:, 0:2] = REFUSE
        px[:, w:w + 2] = REFUSE
        if refused == "full":
            px[0:2, :] = REFUSE
        else:
            px[rows - 5:rows - 3, :] = REFUSE
    return px


def water_pixels(w, cap, count, flash):
    """The stack of units: two rows of blue, one row of gap; a sheen on the top row."""
    rows = UNIT * cap
    px = np.full((rows, w), -1, dtype=np.int8)
    for k in range(count):
        bottom = rows - 1 - UNIT * k
        colour = MARK if k >= count - flash else WATER
        px[bottom - 1:bottom + 1, :] = colour
        if k == count - 1 and colour == WATER:
            px[bottom - 1, :] = SHEEN
    return px


def marks_pixels(w, colour):
    px = np.full((1, w), -1, dtype=np.int8)
    for c in range(w):
        if c % 3 != 2:
            px[0, c] = colour
    return px


def pipe_pixels(valve, look, window, lit=False):
    """The pipe, its centre stripe if it carries two, and the pulse (window of walk indices)."""
    pos = valve["pos"]
    px = np.full(pos.shape, -1, dtype=np.int8)
    px[pos >= 0] = look["lit"] if lit else look["pipe"]
    if valve["load"] == 2:
        bx, by = valve["box"]
        for x, y in valve["walk"]:
            px[y - by, x - bx] = look["pipe"] if lit else look["line"]
    if window is not None:
        lo, hi = window
        px[(pos >= lo) & (pos < hi)] = MARK
    return px


def pip_pixels(state):
    px = np.full((5, 5), -1, dtype=np.int8)
    px[:, :] = {"done": DONE, "now": WHEEL, "later": IDLE}[state]
    for r, c in ((0, 0), (0, 4), (4, 0), (4, 4)):
        px[r, c] = -1
    if state == "now":
        px[1:4, 1:4] = INK
    return px


# ---------------------------------------------------------------- the game
class Dv51(ARCBaseGame):
    def __init__(self, seed=0):
        levels = [Level(sprites=[], grid_size=(64, 64), name=f"bank_{k}", data={}) for k in range(len(LEVELS))]
        super().__init__(
            game_id="dv51", levels=levels,
            camera=Camera(width=64, height=64, background=FIELD, letter_box=FIELD),
            available_actions=[5, 6], seed=seed,
        )

    # ---- level setup
    def on_set_level(self, level):
        level.remove_all_sprites()
        self.spec = LEVELS[self.level_index]
        self.geo = layout(self.spec)
        self.v = tuple(self.spec["start"])
        self.f = [0] * circuits(self.spec)
        self.order = 0
        self.queue = []
        self.finish = False
        self.sprites = {}
        geo = self.geo

        def add(name, px, x, y, layer):
            s = Sprite(px, name=name, x=x, y=y, layer=layer, tags=[])
            level.add_sprite(s)
            self.sprites[name] = s

        blank = np.full((1, 1), -1, dtype=np.int8)
        for i, t in enumerate(geo["tanks"]):
            add(f"tank_{i}", tank_pixels(t["w"], t["cap"], False, False), t["x"], t["top"], 1)
            add(f"water_{i}", blank, t["ix"], t["top"] + 1, 2)
            add(f"mark_{i}", blank, t["ix"], t["top"], 3)
        for j, vv in enumerate(geo["valves"]):
            bx, by = vv["box"]
            add(f"pipe_{j}", blank, bx, by, 4)
            add(f"wheel_{j}", blank, vv["wheel"][0] - 4, vv["wheel"][1] - 4, 5)
        for c, (lx, ly) in enumerate(geo["levers"]):
            add(f"lever_{c}", blank, lx - 8, ly - 3, 5)
        total = len(self.spec["orders"])
        for k in range(total):
            add(f"pip_{k}", blank, 32 - (total * 8 - 3) // 2 + 8 * k, 2, 5)
        self.paint({})

    # ---- drawing
    def heads_right(self, j, f=None):
        f = self.f if f is None else f
        src, dst = lanes(self.spec, f, j)
        return dst > src

    def paint(self, fx):
        spec, geo, sp = self.spec, self.geo, self.sprites
        v = fx.get("v", self.v)
        order = fx.get("order", self.order)
        goals = spec["orders"]
        target = goals[order] if order < len(goals) else None
        marks = fx.get("marks", "show")
        flash = fx.get("flash", {})
        red = fx.get("red", {})
        for i, t in enumerate(geo["tanks"]):
            matched = target is not None and v[i] == target[i]
            sp[f"tank_{i}"].pixels = tank_pixels(t["w"], t["cap"], matched, red.get(i))
            sp[f"water_{i}"].pixels = water_pixels(t["w"], t["cap"], v[i], flash.get(i, 0))
            if target is None or marks == "hide":
                sp[f"mark_{i}"].pixels = np.full((1, 1), -1, dtype=np.int8)
            else:
                y = geo["floor"] - UNIT * target[i] + 1
                colour = MARK if marks == "flash" else (DONE if matched else MARK)
                sp[f"mark_{i}"].pixels = marks_pixels(t["w"], colour)
                sp[f"mark_{i}"].set_position(t["ix"], y)
        flips = fx.get("flips", self.f)
        spin = fx.get("spin", ())
        pulse = fx.get("pulse", {})
        states = fx.get("wheel", {})
        nudge = fx.get("nudge", {})
        for j, vv in enumerate(geo["valves"]):
            look = CIRCUIT_LOOK[vv["circuit"]]
            sp[f"pipe_{j}"].pixels = pipe_pixels(vv, look, pulse.get(j), j in fx.get("lit", ()))
            state = states.get(j, "idle")
            heads = None if vv["circuit"] in spin else self.heads_right(j, flips)
            sp[f"wheel_{j}"].pixels = wheel_pixels(heads, vv["load"], look, state)
            wx, wy = vv["wheel"]
            sp[f"wheel_{j}"].set_position(wx - 4 + nudge.get(j, 0), wy - 4 + (1 if state == "pressed" else 0))
        knobs = fx.get("knob", {})
        hints = fx.get("lever_hint", ())
        for c, (lx, ly) in enumerate(geo["levers"]):
            look = CIRCUIT_LOOK[c]
            knob = knobs.get(c, 2 if flips[c] else 0)
            sp[f"lever_{c}"].pixels = lever_pixels(look, knob, c in hints)
        pips = fx.get("pips")
        for k in range(len(goals)):
            state = "done" if k < order else ("now" if k == order else "later")
            if pips is not None:
                state = pips[k]
            sp[f"pip_{k}"].pixels = pip_pixels(state)

    # ---- turns
    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if not self.queue:
            self.take(self.action)
        if self.queue:
            self.paint(self.queue.pop(0))
        if not self.queue:
            if self.finish:
                self.finish = False
                self.next_level()
            self.complete_action()

    def take(self, action):
        if action.id == GameAction.ACTION5:
            self.queue = self.flip(0)
        elif action.id == GameAction.ACTION6:
            data = action.data or {}
            x, y = int(data.get("x", -1)), int(data.get("y", -1))
            self.queue = self.click(x, y)
        else:
            self.queue = [{}]

    def click(self, x, y):
        geo = self.geo
        for c, (lx, ly) in enumerate(geo["levers"]):
            if abs(x - lx) <= 8 and abs(y - ly) <= 3:
                return self.flip(c)
        for j, vv in enumerate(geo["valves"]):
            wx, wy = vv["wheel"]
            if abs(x - wx) <= 4 and abs(y - wy) <= 4:
                return self.press(j)
        for i, t in enumerate(geo["tanks"]):
            if t["x"] <= x <= t["x"] + t["w"] + 1 and t["top"] <= y <= geo["floor"] + 3:
                wheels = {j: "hint" for j, vv in enumerate(geo["valves"]) if i in (vv["a"], vv["b"])}
                return [{"wheel": wheels}, {}, {"wheel": wheels}, {}]
        wheels = {j: "hint" for j in range(len(geo["valves"]))}
        levers = tuple(range(len(geo["levers"])))
        return [{"wheel": wheels, "lever_hint": levers}, {}, {"wheel": wheels, "lever_hint": levers}, {}]

    def flip(self, c):
        before = list(self.f)
        self.f[c] ^= 1
        mid = {"flips": before, "knob": {c: 1}, "spin": (c,)}
        end = {"flips": self.f, "knob": {c: 2 if self.f[c] else 0}}
        popped = {j: "pressed" for j, vv in enumerate(self.geo["valves"]) if vv["circuit"] == c}
        return [mid, dict(end, wheel=popped), {}]

    def press(self, j):
        spec, geo = self.spec, self.geo
        vv = geo["valves"][j]
        blocked = refusal(spec, self.v, self.f, j)
        if blocked is not None:
            src = lanes(spec, self.f, j)[0]
            ok = {"wheel": {j: "refused"}, "red": {blocked: "empty" if blocked == src else "full"}}
            return [dict(ok, nudge={j: 1}), dict(ok, nudge={j: -1}), dict(ok, nudge={j: 1}), {}]
        src, dst = lanes(spec, self.f, j)
        load = vv["load"]
        before = self.v
        shown = self.order
        self.v = pour(spec, self.v, self.f, j)
        walk = vv["walk"]
        n = len(walk)
        length = 5 * load
        reach = n + length
        frames_travel = max(4, min(8, -(-reach // 6)))
        speed = -(-reach // frames_travel)
        leaving = tuple(b - (load if i == src else 0) for i, b in enumerate(before))
        base = {"order": shown}
        queue = [dict(base, v=leaving, wheel={j: "slam"}, lit={j})]
        for t in range(1, frames_travel + 1):
            head = speed * t
            lo, hi = max(0, head - length), min(n, head)
            if src != vv["p"]:
                lo, hi = n - hi, n - lo
            fx = dict(base, v=leaving, pulse={j: (lo, hi)}, lit={j})
            if t == 1:
                fx["wheel"] = {j: "pressed"}
            queue.append(fx)
        queue.append(dict(base, flash={dst: load}))
        goals = spec["orders"]
        if self.v != goals[self.order]:
            queue.append(dict(base))
            return queue
        self.order += 1
        done = ["done"] * self.order + ["later"] * (len(goals) - self.order)
        if self.order == len(goals):
            self.finish = True
            everything = {i: 99 for i in range(len(self.v))}
            for k in range(2):
                queue.append(dict(base, marks="flash", flash=everything, pips=done))
                queue.append(dict(base, pips=done))
        else:
            queue.append(dict(base, marks="flash", pips=done))
            queue.append({"marks": "hide"})
            queue.append({"marks": "flash"})
            queue.append({})
        return queue
