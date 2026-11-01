# Author: Claude Sonnet 5.5 (for the Boss), 13-October-2026
# Single-file ARC-AGI-3 game, id g001. Rules are plain functions at the top (the solver and the
# engine class both use them); the class at the bottom only turns their answers into frames.

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

CELL = 4
COLS = 16
ROWS = 15
HUD_H = CELL

# palette indices
FLOOR = 14
WALL = 5
BAR = 13
SLOT_OFF = 5
PIP = 11
GATE = 15
VAULT = 12
RUNNER = 0
HAND = 12
COIN_RIM = 11
COIN_CORE = 12
YES = 0
NO = 7
NO2 = 8

DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}

# '#' wall  '.' floor  'P' start  'O' vault (a 2x2 block)  '1'-'4' gate with that price  'c' coin
LEVELS = [
    {"purse": 3, "cap": 3, "base": 2, "sur": 0, "face": 4, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "##########OO####",
        "###P..1...OO####",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"purse": 5, "cap": 5, "base": 2, "sur": 0, "face": 1, "rows": [
        "################",
        "################",
        "################",
        "####.#..#..#####",
        "####.#..#..#####",
        "##...1..1....###",
        "##.#.#..#..#.###",
        "##.#.#..#..#.###",
        "##.#########.###",
        "##.#########1###",
        "##.#########OO##",
        "##P........4OO##",
        "################",
        "################",
        "################",
    ]},
    {"purse": 2, "cap": 5, "base": 3, "sur": 0, "face": 4, "rows": [
        "################",
        "################",
        "################",
        "######c#########",
        "######c#########",
        "######c###c#####",
        "######1###2##OO#",
        "#P..........2OO#",
        "######1#1#######",
        "######.#c#######",
        "########c#######",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"purse": 2, "cap": 8, "base": 2, "sur": 0, "face": 4, "rows": [
        "################",
        "######c#########",
        "####c#c#########",
        "####c#c#########",
        "####1#1#########",
        "##P...........##",
        "#####1##.##2#.##",
        "#####c##.##c#.##",
        "#####c##3##.#1##",
        "#####c##.##.#.##",
        "########.##1#.##",
        "##OO1.....1...##",
        "##OO############",
        "################",
        "################",
    ]},
    {"purse": 4, "cap": 9, "base": 2, "sur": 1, "face": 4, "rows": [
        "################",
        "################",
        "################",
        "################",
        "###...1......###",
        "###1####2###.###",
        "###.#c##.#c#.###",
        "###.#c##c#c#1###",
        "###.#c####c#.###",
        "###.#1####1#.OO#",
        "##P.....4..1.OO#",
        "####.#1##.######",
        "####c#.##.######",
        "####c####c######",
        "################",
    ]},
    {"purse": 3, "cap": 5, "base": 1, "sur": 1, "face": 2, "rows": [
        "################",
        "################",
        "###P############",
        "###.#c####c#####",
        "###.#c####c#####",
        "###.#c####c#####",
        "###.#c####c#####",
        "###.#1####1##OO#",
        "###....3....1OO#",
        "###.#####2###1##",
        "###12.c##c###.##",
        "###.#########.##",
        "###.....1.....##",
        "################",
        "################",
    ]},
    {"purse": 6, "cap": 10, "base": 3, "sur": 1, "face": 4, "rows": [
        "################",
        "##P...........##",
        "####1##.##.##.##",
        "####c##.##.##.##",
        "####c##3##c##.##",
        "####c##.##c##.##",
        "#######.#####.##",
        "##...1........##",
        "##.#1###.##1####",
        "##.#c###.##c####",
        "##1#c###3##c####",
        "##.#c###.##c####",
        "##.#####.###OO##",
        "##.........2OO##",
        "################",
    ]},
    {"purse": 2, "cap": 10, "base": 2, "sur": 1, "face": 2, "rows": [
        "################",
        "#P#####...1...##",
        "#.#####.#####.##",
        "#.1ccc#...cc#.##",
        "#.#####.#####.##",
        "#.2..c#.1ccc#.##",
        "#.#####.#####.##",
        "#...4.....4...##",
        "#.#####.#####.##",
        "#.1ccc#.1...#.##",
        "#.#####.#####.##",
        "#.1ccc#.1ccc#1##",
        "#.#####.####OO##",
        "#...1...####OO##",
        "################",
    ]},
]


# ---------------------------------------------------------------------------------------------
# rules
# ---------------------------------------------------------------------------------------------

def _bits(n):
    return bin(n).count("1")


class Model:
    """Static facts about one level, built once from its picture."""

    def __init__(self, index, spec):
        self.index = index
        self.purse = spec["purse"]
        self.cap = spec["cap"]
        self.base = spec["base"]
        self.sur = spec.get("sur", 0)
        self.face = spec.get("face", 4)
        self.walls = set()
        self.gates = []
        self.coins = []
        vault = []
        self.start = (1, 1)
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                if ch == "#":
                    self.walls.add((x, y))
                elif ch.isdigit():
                    self.gates.append(((x, y), int(ch)))
                elif ch == "c":
                    self.coins.append((x, y))
                elif ch == "O":
                    vault.append((x, y))
                elif ch == "P":
                    self.start = (x, y)
        self.vault = frozenset(vault)
        self.vault_tl = (min(c[0] for c in vault), min(c[1] for c in vault))
        self.gate_at = {cell: i for i, (cell, _) in enumerate(self.gates)}
        self.coin_at = {cell: i for i, cell in enumerate(self.coins)}
        near = set()
        for (x, y) in vault:
            for dx, dy in DIRS.values():
                near.add((x + dx, y + dy))
        self.vault_near = frozenset(near - self.vault)
        self.regions = {}
        self.verdicts = {}
        self.purses = {}


def start_state(m):
    return (m.start[0], m.start[1], m.face, m.purse, 0, 0)


def vault_price(m, om):
    return m.base + m.sur * _bits(om)


def region(m, om):
    """Every cell the runner can walk to once the gates in `om` are open."""
    hit = m.regions.get(om)
    if hit is not None:
        return hit
    seen = {m.start}
    todo = [m.start]
    while todo:
        x, y = todo.pop()
        for dx, dy in DIRS.values():
            c = (x + dx, y + dy)
            if c in seen or c in m.walls or c in m.vault:
                continue
            gi = m.gate_at.get(c)
            if gi is not None and not (om >> gi) & 1:
                continue
            seen.add(c)
            todo.append(c)
    out = frozenset(seen)
    m.regions[om] = out
    return out


def charges_at(m, om):
    """The purse once the runner has taken every coin it can reach, cap respected. Taking a coin
    never hurts (a coin left behind can be taken later), so this is the best the purse can be."""
    hit = m.purses.get(om)
    if hit is not None:
        return hit
    reach = region(m, om)
    spent = 0
    for gi, (_, price) in enumerate(m.gates):
        if (om >> gi) & 1:
            spent += price
    got = sum(1 for c in m.coins if c in reach)
    out = m.purse + min(got, m.cap - m.purse + spent) - spent
    m.purses[om] = out
    return out


def alive(m, om):
    """Can this level still be won with the gates in `om` open? Walking is free and undoable,
    and coins are interchangeable, so only which gates are open matters."""
    hit = m.verdicts.get(om)
    if hit is not None:
        return hit
    reach = region(m, om)
    ch = charges_at(m, om)
    verdict = ch >= vault_price(m, om) and any(c in reach for c in m.vault_near)
    if not verdict:
        for gi, (cell, price) in enumerate(m.gates):
            if (om >> gi) & 1 or price > ch:
                continue
            x, y = cell
            if any((x + dx, y + dy) in reach for dx, dy in DIRS.values()):
                if alive(m, om | (1 << gi)):
                    verdict = True
                    break
    m.verdicts[om] = verdict
    return verdict


def act(m, st, a):
    """One key press. Returns the new state and what happened."""
    x, y, f, ch, om, cm = st
    if a in DIRS:
        dx, dy = DIRS[a]
        c = (x + dx, y + dy)
        gi = m.gate_at.get(c)
        if c in m.walls or c in m.vault or (gi is not None and not (om >> gi) & 1):
            return (x, y, a, ch, om, cm), ("bump", c)
        ci = m.coin_at.get(c)
        if ci is not None and not (cm >> ci) & 1:
            if ch < m.cap:
                return (c[0], c[1], a, ch + 1, om, cm | (1 << ci)), ("move", c, ci, 1)
            return (c[0], c[1], a, ch, om, cm), ("move", c, ci, 0)
        return (c[0], c[1], a, ch, om, cm), ("move", c, -1, 0)
    if a == 5:
        dx, dy = DIRS[f]
        c = (x + dx, y + dy)
        gi = m.gate_at.get(c)
        if gi is not None and not (om >> gi) & 1:
            price = m.gates[gi][1]
            if ch >= price:
                om2 = om | (1 << gi)
                dead = not alive(m, om2)
                return (x, y, f, ch - price, om2, cm), ("pay", gi, price, dead)
            return st, ("refuse", "g", gi)
        if c in m.vault:
            vp = vault_price(m, om)
            if ch >= vp:
                return (x, y, f, ch - vp, om, cm), ("win", vp)
            return st, ("refuse", "v", -1)
        return st, ("reach", c)
    return st, ("none",)


def target_of(m, st):
    """What the runner is facing that can be paid: ('g', index), ('v', -1) or None."""
    x, y, f, ch, om, cm = st
    dx, dy = DIRS[f]
    c = (x + dx, y + dy)
    gi = m.gate_at.get(c)
    if gi is not None and not (om >> gi) & 1:
        return ("g", gi)
    if c in m.vault:
        return ("v", -1)
    return None


MODELS = [Model(i, spec) for i, spec in enumerate(LEVELS)]


# ---------------------------------------------------------------------------------------------
# pictures
# ---------------------------------------------------------------------------------------------

def _art(rows, colours):
    return [[-1 if ch == "." else colours[ch] for ch in row] for row in rows]


_WALK = (".bb.", "bbbb", ".bb.", "b..b")
_HAND = {4: ((1, 3),), 3: ((1, 0),), 1: ((0, 1), (0, 2)), 2: ((3, 0), (3, 3))}
_MELT = ((0, 1), (3, 3), (1, 0), (2, 1), (0, 2), (3, 0), (1, 3), (2, 2), (1, 1), (1, 2))


def runner_pixels(face, hand=HAND, body=RUNNER, melt=0):
    px = _art(_WALK, {"b": body})
    for r, c in _HAND[face]:
        px[r][c] = hand
    for r, c in _MELT[:melt]:
        px[r][c] = -1
    return px


_SLOTS = ((1, 1), (1, 2), (2, 1), (2, 2))


def gate_pixels(price, hot=-1, flash=-1, shrink=0):
    body = flash if flash >= 0 else GATE
    px = _art((".bb.", "bwwb", "bwwb", "bbbb"), {"b": body, "w": WALL})
    for i in range(min(price, 4)):
        r, c = _SLOTS[i]
        px[r][c] = PIP if flash < 0 else flash
    if hot >= 0:
        for r, c in ((0, 0), (0, 3), (3, 0), (3, 3)):
            px[r][c] = hot
    if shrink >= 1:
        for r, c in ((0, 1), (0, 2), (3, 0), (3, 3), (1, 0), (1, 3), (2, 0), (2, 3)):
            px[r][c] = -1
    if shrink >= 2:
        for r in range(4):
            for c in range(4):
                if (r, c) not in ((1, 1), (1, 2), (2, 1), (2, 2)):
                    px[r][c] = -1
    return px


_VAULT = ("kkbbbbkk", "kbbbbbbk", "bbbbbbbb", "bwwwwwwb", "bwwwwwwb", "bbbbbbbb", "kbbbbbbk", "kkbbbbkk")


def vault_pixels(price, hot=-1, flash=-1, pop=-1):
    body = flash if flash >= 0 else VAULT
    px = _art(_VAULT, {"b": body, "w": WALL, "k": WALL})
    for i in range(min(price, 12)):
        px[3 + i // 6][1 + i % 6] = PIP if flash < 0 else YES
    if 0 <= pop < 12:
        px[3 + pop // 6][1 + pop % 6] = YES
    if hot >= 0:
        for r, c in ((0, 0), (0, 7), (7, 0), (7, 7)):
            px[r][c] = hot
    return px


def coin_pixels(flash=-1):
    rim = flash if flash >= 0 else COIN_RIM
    return _art((".cc.", "cddc", "cddc", ".cc."), {"c": rim, "d": COIN_CORE})


def purse_pixels(cap, lit, flash=None):
    px = [[BAR] * 64 for _ in range(HUD_H)]
    for i in range(cap):
        colour = PIP if i < lit else SLOT_OFF
        if flash is not None and flash[0] <= i < flash[1]:
            colour = flash[2]
        for r in (1, 2):
            for c in range(3):
                px[r][2 + 4 * i + c] = colour
    return px


def build_levels():
    levels = []
    for m in MODELS:
        sprites = []
        rows = LEVELS[m.index]["rows"]
        for y in range(ROWS):
            x = 0
            while x < COLS:
                if (x, y) in m.walls:
                    x2 = x
                    while x2 + 1 < COLS and (x2 + 1, y) in m.walls:
                        x2 += 1
                    w = (x2 - x + 1) * CELL
                    sprites.append(Sprite(
                        pixels=[[WALL] * w for _ in range(CELL)], name=f"wall_{x}_{y}",
                        x=x * CELL, y=HUD_H + y * CELL, layer=-2,
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, tags=["wall"]))
                    x = x2 + 1
                else:
                    x += 1
        sprites.append(Sprite(
            pixels=purse_pixels(m.cap, m.purse), name="purse", x=0, y=0, layer=3,
            blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE, tags=["purse"]))
        for i, ((cx, cy), price) in enumerate(m.gates):
            sprites.append(Sprite(
                pixels=gate_pixels(price), name=f"gate_{i}", x=cx * CELL, y=HUD_H + cy * CELL, layer=0,
                blocking=BlockingMode.BOUNDING_BOX, interaction=InteractionMode.TANGIBLE,
                tags=["gate", f"price_{price}"]))
        for i, (cx, cy) in enumerate(m.coins):
            sprites.append(Sprite(
                pixels=coin_pixels(), name=f"coin_{i}", x=cx * CELL, y=HUD_H + cy * CELL, layer=0,
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE, tags=["coin"]))
        vx, vy = m.vault_tl
        sprites.append(Sprite(
            pixels=vault_pixels(m.base), name="vault", x=vx * CELL, y=HUD_H + vy * CELL, layer=0,
            blocking=BlockingMode.BOUNDING_BOX, interaction=InteractionMode.TANGIBLE, tags=["vault"]))
        sx, sy = m.start
        sprites.append(Sprite(
            pixels=runner_pixels(m.face), name="runner", x=sx * CELL, y=HUD_H + sy * CELL, layer=2,
            blocking=BlockingMode.BOUNDING_BOX, interaction=InteractionMode.TANGIBLE, tags=["runner"]))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


# ---------------------------------------------------------------------------------------------
# what each key press looks like (pictures only; the outcome is already decided)
# ---------------------------------------------------------------------------------------------

def plan(m, st, st2, ev):
    """Frames for one press, as small dicts the painter understands. The last frame is the settled one."""
    x, y, f, ch, om, cm = st
    kind = ev[0]
    frames = []
    after = None
    if kind == "move":
        x1, y1 = st2[0], st2[1]
        mid = ((x * CELL + x1 * CELL) // 2, HUD_H + (y * CELL + y1 * CELL) // 2)
        ci, took = ev[2], ev[3]
        frames.append({"rx": mid[0], "ry": mid[1], "nobrk": 1, "hud": ch, "coin": ci if took else -1})
        if took:
            frames.append({"nobrk": 1, "hud": ch, "coin": ci, "cflash": (ci, YES)})
            frames.append({"hud": ch + 1, "hflash": (ch, ch + 1, YES)})
        elif ci >= 0:
            frames.append({"nobrk": 1, "cflash": (ci, NO), "hflash": (0, ch, NO)})
        frames.append({})
    elif kind == "bump":
        dx, dy = DIRS[{(0, -1): 1, (0, 1): 2, (-1, 0): 3, (1, 0): 4}[(ev[1][0] - x, ev[1][1] - y)]]
        frames.append({"rx": x * CELL + dx, "ry": HUD_H + y * CELL + dy, "nobrk": 1})
        frames.append({})
    elif kind == "reach":
        dx, dy = DIRS[f]
        frames.append({"hand": YES, "rx": x * CELL + dx, "ry": HUD_H + y * CELL + dy, "nobrk": 1})
        frames.append({})
    elif kind == "refuse":
        t = (ev[1], ev[2])
        frames.append({"shake": (t, 1), "tflash": (t, NO), "hflash": (0, ch, NO)})
        frames.append({"shake": (t, -1), "tflash": (t, NO), "hflash": (0, ch, NO)})
        frames.append({"shake": (t, 1)})
        frames.append({})
    elif kind == "pay":
        gi, price, dead = ev[1], ev[2], ev[3]
        was = vault_price(m, om)
        now = vault_price(m, st2[4])
        frames.append({"hud": ch, "hflash": (ch - price, ch, YES), "gopen": (gi, 0), "vp": was})
        frames.append({"hud": ch - price, "gopen": (gi, 1), "vp": was})
        frames.append({"gopen": (gi, 2), "vp": was})
        if dead:
            for k in range(6):
                hot = NO if k % 2 == 0 else NO2
                frames.append({"body": hot, "hflash": (0, ch - price, hot), "vflash": hot if k % 2 == 0 else -1, "nobrk": 1})
            for k in range(1, 5):
                frames.append({"body": NO2, "melt": k * 2, "hflash": (0, ch - price, NO2), "nobrk": 1})
            frames.append({"melt": 10, "nobrk": 1})
            after = "dead"
        elif now != was:
            frames.append({"vpop": now - 1})
            frames.append({})
        else:
            frames.append({})
    elif kind == "win":
        vp = ev[1]
        frames.append({"hud": ch, "hflash": (ch - vp, ch, YES), "vflash": YES, "nobrk": 1})
        frames.append({"hud": ch - vp, "vflash": PIP, "nobrk": 1})
        frames.append({"vflash": YES, "nobrk": 1})
        frames.append({"vflash": PIP, "nobrk": 1})
        frames.append({"vflash": YES, "nobrk": 1})
        after = "win"
    else:
        frames.append({})
    return frames, after


class G001(ARCBaseGame):

    def __init__(self) -> None:
        self._st = (0, 0, 4, 0, 0, 0)
        self._fx = {}
        self._script = []
        self._after = None
        self._sp = {}
        camera = Camera(width=64, height=64, background=FLOOR, letter_box=WALL)
        super().__init__(game_id="g001", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level: Level) -> None:
        m = MODELS[self.level_index]
        self._st = start_state(m)
        self._fx = {}
        self._script = []
        self._after = None
        self._sp = {s.name: s for s in level.get_sprites()}
        self._sync()

    # -- painting: every picture is derived from the state plus the frame's overrides -------------
    def _sync(self) -> None:
        m = MODELS[self.level_index]
        x, y, f, ch, om, cm = self._st
        fx = self._fx
        sp = self._sp
        tgt = None if fx.get("nobrk") else target_of(m, self._st)
        shake = fx.get("shake")
        tflash = fx.get("tflash")
        run = sp["runner"]
        run.set_position(fx.get("rx", x * CELL), fx.get("ry", HUD_H + y * CELL))
        run.pixels[:, :] = np.array(runner_pixels(f, fx.get("hand", HAND), fx.get("body", RUNNER), fx.get("melt", 0)), dtype=np.int8)
        lit = fx.get("hud", ch)
        sp["purse"].pixels[:, :] = np.array(purse_pixels(m.cap, lit, fx.get("hflash")), dtype=np.int8)
        for gi, ((cx, cy), price) in enumerate(m.gates):
            s = sp[f"gate_{gi}"]
            opened = (om >> gi) & 1
            show = not opened
            stage = -1
            if fx.get("gopen") and fx["gopen"][0] == gi:
                show = fx["gopen"][1] < 3
                stage = fx["gopen"][1]
            hot = -1
            if tgt == ("g", gi):
                hot = YES if ch >= price else NO
            flash = -1
            if tflash and tflash[0] == ("g", gi):
                flash = tflash[1]
            if stage == 1:
                flash = YES
            dx = shake[1] if shake and shake[0] == ("g", gi) else 0
            s.pixels[:, :] = np.array(gate_pixels(price, hot, flash, 1 if stage == 2 else 0), dtype=np.int8)
            s.set_position(cx * CELL + dx, HUD_H + cy * CELL)
            s.set_interaction(InteractionMode.TANGIBLE if show else InteractionMode.REMOVED)
        for ci, (cx, cy) in enumerate(m.coins):
            s = sp[f"coin_{ci}"]
            taken = (cm >> ci) & 1
            show = (not taken) or fx.get("coin", -1) == ci
            cf = fx.get("cflash")
            s.pixels[:, :] = np.array(coin_pixels(cf[1] if cf and cf[0] == ci else -1), dtype=np.int8)
            s.set_interaction(InteractionMode.INTANGIBLE if show else InteractionMode.REMOVED)
        v = sp["vault"]
        vx, vy = m.vault_tl
        hot = -1
        if tgt == ("v", -1):
            hot = YES if ch >= vault_price(m, om) else NO
        flash = fx.get("vflash", -1)
        if tflash and tflash[0] == ("v", -1):
            flash = tflash[1]
        v.pixels[:, :] = np.array(vault_pixels(fx.get("vp", vault_price(m, om)), hot, flash, fx.get("vpop", -1)), dtype=np.int8)
        dx = shake[1] if shake and shake[0] == ("v", -1) else 0
        v.set_position(vx * CELL + dx, HUD_H + vy * CELL)

    # -- the engine loop ----------------------------------------------------------------------
    def step(self) -> None:
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if not self._script:
            a = self.action.id.value
            m = MODELS[self.level_index]
            st2, ev = act(m, self._st, a)
            old = self._st
            self._st = st2
            self._script, self._after = plan(m, old, st2, ev)
        self._fx = self._script.pop(0)
        self._sync()
        if self._script:
            return
        after = self._after
        self._after = None
        if after == "win":
            self.next_level()
        elif after == "dead":
            self.level_reset()
            if self._action_count < 1:
                self._action_count = 1
        self.complete_action()
