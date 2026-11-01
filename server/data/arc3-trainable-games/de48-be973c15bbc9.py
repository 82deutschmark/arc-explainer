"""Twin turntable puzzle for ARCEngine 0.9.3.

Designer notes (nothing here is drawn on the screen).

What you do. Two twins, one orange and round, one blue and diamond-shaped, each have a matching
dock. Arrow keys move the twin inside the yellow frame; Space hands the frame to the other twin
(a world action: it changes who answers the arrows). Both twins must stand on their own docks,
and every numbered die must have been touched in order, to clear a level. ACTION7 is never used
(on the real platform it is Undo) and there is no click.

The turntable. Purple blocks ride square rails around a hub pad at the centre of the board.
Whenever a twin steps onto the hub, every block swings one quarter turn clockwise along its
rail. Blocks are solid, so a block parked in a doorway or on a dock shuts it. A swing is refused
("jam") while a twin stands on a rail cell the blocks would sweep over; the blocks slide until
they meet that twin, bounce back, and the twin in the way is framed in pink.

Gates. A maroon gate stays open only while a twin stands on its maroon plate. No move may leave a
twin standing in a gate whose plate is empty, so such a move (the holder stepping off while the
other twin is in the gateway) is refused.

Dice. Numbered dice (one to four pips) must be touched in order; a later die refuses to be
entered until the earlier ones are gone. The die to touch next is drawn yellow.

Why no dead ends. Every key is either a visible success or a visible refusal, and every action
can be walked back, so there is no losing and no GAME_OVER. The designer's solver searched all
reachable positions of all eight boards with the same rule function this file uses, and found
none from which the level could no longer be won.

Rule state is the tuple (twin A cell, twin B cell, framed twin, quarter turns, dice touched);
everything on screen is redrawn from it by _settle, and animation frames only show what the
rule function already decided.
"""

import numpy as np
from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, Level, Sprite

# ---------------------------------------------------------------- geometry
CELLS = 9
TILE = 7
CENTER = 4
MOVE_FRAMES = 3
TURN_FRAMES = 4

# ARC palette indices.
T = -1
WHITE, PALE, GRID, STONE, DARK, BLACK, PINK, ROSE, RED, BLUE, CYAN, YELLOW, ORANGE, MAROON, GREEN, PURPLE = range(16)

DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}


def _ring_cells(r):
    """The 8r cells at Chebyshev distance r from the hub, clockwise from the top middle."""
    c = CENTER
    cells = [(x, c - r) for x in range(c, c + r + 1)]
    cells += [(c + r, y) for y in range(c - r + 1, c + r + 1)]
    cells += [(x, c + r) for x in range(c + r - 1, c - r - 1, -1)]
    cells += [(c - r, y) for y in range(c + r - 1, c - r - 1, -1)]
    cells += [(x, c - r) for x in range(c - r + 1, c)]
    return cells


def _idx(x, y):
    return y * CELLS + x


def _xy(i):
    return i % CELLS, i // CELLS


# ---------------------------------------------------------------- levels
DOORS = {"N": (4, 1), "E": (7, 4), "S": (4, 7), "W": (1, 4)}
DOOR_IN = {"N": (4, 2), "E": (6, 4), "S": (4, 6), "W": (2, 4)}


def _fort(doors, corners=True):
    """Black wall ring around the plaza with the named doorways left open."""
    open_cells = [DOORS[d] for d in doors]
    walls = [c for c in _ring_cells(3) if c not in open_cells]
    if corners:
        walls += [(0, 0), (8, 0), (0, 8), (8, 8)]
    return tuple(walls)


def _rooms(doors):
    """The fort with only the named doorways open; the arcs of the closed ones are filled in."""
    walls = list(_fort(doors))
    for d, arc in (("N", [(x, 0) for x in range(1, 8)]), ("S", [(x, 8) for x in range(1, 8)]),
                   ("W", [(0, y) for y in range(1, 8)]), ("E", [(8, y) for y in range(1, 8)])):
        if d not in doors:
            walls += arc
    return tuple(walls)


VAULT = ((2, 0), (3, 1), (5, 1), (6, 0))

LEVELS = [
    # 1 walk: both twins to their docks; the hub and its block are only there to be found.
    dict(starts=((1, 6), (7, 6)), docks=((4, 6), (5, 6)), hub=(4, 4), blocks=((1, (4, 3)),)),
    # 2 first level that needs the hub: it sits in a nook, and a block plugs the mouth of the orange corridor.
    dict(walls=((3, 0), (3, 1), (5, 0), (5, 1), (3, 3), (4, 3), (5, 3), (5, 4), (3, 5), (4, 5), (5, 5)),
         starts=((1, 4), (7, 4)), docks=((4, 0), (7, 1)), hub=(4, 4), blocks=((2, (4, 2)),)),
    # 3 two rooms: one twin must be inside its room before the other turns the hub.
    dict(walls=_rooms(("N", "S")), starts=((3, 5), (5, 3)), docks=((1, 0), (7, 8)), hub=(4, 4),
         blocks=((2, (4, 6)), (2, (2, 4)))),
    # 4 a gate: one twin holds the plate while the other goes through.
    dict(walls=VAULT, starts=((2, 7), (6, 7)), docks=((7, 5), (4, 0)), plates=(((2, 3), (4, 1)),)),
    # 5 two rooms and a gate.
    dict(walls=_rooms(("N", "S")), starts=((4, 3), (3, 3)), docks=((3, 0), (2, 8)), hub=(4, 4),
         blocks=((2, (4, 2)), (2, (2, 4))), plates=(((6, 6), (4, 1)),)),
    # 6 the fort and three dice in order.
    dict(walls=_fort(("N", "E", "S", "W")), starts=((5, 3), (3, 5)), docks=((3, 3), (5, 5)), hub=(4, 4),
         blocks=((2, (4, 2)), (2, (6, 4)), (2, (4, 6))), beacons=((4, 0), (0, 4), (4, 8))),
    # 7 the fort, a gate on the east doorway and three dice.
    dict(walls=_fort(("N", "E", "S", "W")), starts=((5, 3), (5, 4)), docks=((6, 6), (4, 8)), hub=(4, 4),
         blocks=((2, (4, 2)), (2, (2, 4)), (1, (4, 3))), beacons=((8, 2), (6, 8), (6, 0)), plates=(((4, 0), (7, 4)),)),
    # 8 the fort with four dice, a gate and the hub guard.
    dict(walls=_fort(("N", "E", "S", "W")), starts=((3, 3), (5, 5)), docks=((7, 0), (5, 0)), hub=(4, 4),
         blocks=((2, (4, 2)), (2, (2, 4)), (2, (4, 6)), (1, (4, 3))),
         beacons=((1, 0), (0, 6), (2, 8), (8, 1)), plates=(((6, 3), (7, 4)),)),
]


# ---------------------------------------------------------------- pure rules
class Model:
    """Everything the rules need about one board, built once and never changed.

    A state is (a, b, active, phase, found): the two twins' cells, which twin has the frame,
    how many quarter turns the blocks have made (0-3), and how many dice have been touched.
    """

    def __init__(self, cfg):
        n = CELLS * CELLS
        self.cfg = cfg
        self.walls = frozenset(_idx(*c) for c in cfg.get("walls", ()))
        self.start = (_idx(*cfg["starts"][0]), _idx(*cfg["starts"][1]))
        self.docks = (_idx(*cfg["docks"][0]), _idx(*cfg["docks"][1]))
        self.hub = _idx(*cfg["hub"]) if cfg.get("hub") else -1
        self.nbr = [[-1] * 5 for _ in range(n)]
        for i in range(n):
            x, y = _xy(i)
            for d, (dx, dy) in DIRS.items():
                nx, ny = x + dx, y + dy
                if 0 <= nx < CELLS and 0 <= ny < CELLS:
                    self.nbr[i][d] = _idx(nx, ny)
        self.rings = []          # (r, start index, ring cell list)
        self.occ = [set() for _ in range(4)]
        self.sweep = [set() for _ in range(4)]
        self.rail = set()
        for r, cell in cfg.get("blocks", ()):
            ring = _ring_cells(r)
            i0 = ring.index(cell)
            length = 8 * r
            self.rings.append((r, i0, ring))
            self.rail.update(_idx(*c) for c in ring)
            for p in range(4):
                a = (i0 + 2 * r * p) % length
                self.occ[p].add(_idx(*ring[a]))
                for k in range(1, 2 * r + 1):
                    self.sweep[p].add(_idx(*ring[(a + k) % length]))
        self.plates = [(_idx(*p), _idx(*g)) for p, g in cfg.get("plates", ())]
        self.beacons = [_idx(*c) for c in cfg.get("beacons", ())]
        self.beacon_at = {c: k for k, c in enumerate(self.beacons)}
        assert not (self.walls & self.rail), "a wall sits on a rail"
        assert self.hub not in self.rail, "the hub sits on a rail"
        assert not (set(self.beacons) & self.rail), "a die sits on a rail"
        assert not ({g for _, g in self.plates} & self.rail), "a gate sits on a rail"
        assert not (self.walls & ({self.start[0], self.start[1]} | set(self.docks) | set(self.beacons))), "something sits in a wall"
        assert self.gates_ok(self.start[0], self.start[1]), "a twin starts inside a shut gate"

    def initial(self):
        return (self.start[0], self.start[1], 0, 0, 0)

    def is_win(self, s):
        return s[0] == self.docks[0] and s[1] == self.docks[1] and s[4] == len(self.beacons)

    def gates_ok(self, a, b):
        """No twin may stand in a gate whose plate has no twin on it."""
        for plate, gate in self.plates:
            if (a == gate or b == gate) and plate != a and plate != b:
                return False
        return True

    def gate_open(self, k, s):
        plate, _ = self.plates[k]
        return plate == s[0] or plate == s[1]

    def act(self, s, action):
        """(new state, kind) for one key, or (None, why) when the key is refused."""
        a, b, act, ph, found = s
        if action == 5:
            return (a, b, 1 - act, ph, found), "swap"
        me, other = (b, a) if act else (a, b)
        t = self.nbr[me][action]
        if t < 0 or t in self.walls:
            return None, "wall"
        if t == other:
            return None, "twin"
        if t in self.occ[ph]:
            return None, "block"
        kind = "move"
        found2 = found
        k = self.beacon_at.get(t)
        if k is not None:
            if k > found:
                return None, "order"
            if k == found:
                found2 = found + 1
                kind = "pickup"
        ph2 = ph
        if t == self.hub:
            if other in self.sweep[ph]:
                return None, "jam"
            ph2 = (ph + 1) & 3
            kind = "pickup+turn" if kind == "pickup" else "turn"
        na, nb = (other, t) if act else (t, other)
        if not self.gates_ok(na, nb):
            return None, "gate"
        return (na, nb, act, ph2, found2), kind


_MODELS = {}


def _model(i):
    m = _MODELS.get(i)
    if m is None:
        m = _MODELS[i] = Model(LEVELS[i])
    return m


# ---------------------------------------------------------------- pictures
def _pic(rows, key):
    return [[key.get(ch, T) for ch in row] for row in rows]


def _arr(rows):
    return np.array(rows, dtype=np.int8)


def _filled(colour, w=TILE, h=TILE):
    return [[colour] * w for _ in range(h)]


def _ring(colour):
    """A one-pixel frame just outside a cell (9x9): it frames a twin without hiding its shape."""
    size = TILE + 2
    px = _filled(T, size, size)
    for i in range(size):
        px[0][i] = px[size - 1][i] = px[i][0] = px[i][size - 1] = colour
    return px


TWIN_A = _pic(["..OOO..", ".OOOOO.", "OOWOWOO", "OOOOOOO", "OOOOOOO", ".OOOOO.", "..OOO.."], {"O": ORANGE, "W": WHITE})
TWIN_B = _pic(["...B...", "..BBB..", ".BBBBB.", "BBBWBBB", ".BBBBB.", "..BBB..", "...B..."], {"B": BLUE, "W": WHITE})
DOCK_A = _pic(["..OOO..", ".O...O.", "O.....O", "O..W..O", "O.....O", ".O...O.", "..OOO.."], {"O": ORANGE, "W": WHITE})
DOCK_B = _pic(["...B...", "..B.B..", ".B...B.", "B..W..B", ".B...B.", "..B.B..", "...B..."], {"B": BLUE, "W": WHITE})
SEAL_A = _pic(["..OOO..", ".O...O.", "O.....O", "O.....O", "O.....O", ".O...O.", "..OOO.."], {"O": WHITE})
SEAL_B = _pic(["...B...", "..B.B..", ".B...B.", "B.....B", ".B...B.", "..B.B..", "...B..."], {"B": WHITE})
BLOCK = _pic([".PPPPP.", "PRPPPRP", "PPPPPPP", "PPPWPPP", "PPPPPPP", "PRPPPRP", ".PPPPP."], {"P": PURPLE, "R": ROSE, "W": WHITE})
HUB = _pic([".PPPPP.", "P.....P", "P..P..P", "P.PWP.P", "P..P..P", "P.....P", ".PPPPP."], {"P": PURPLE, "W": WHITE})
PLATE = _pic([".......", ".MMMMM.", ".M...M.", ".M.M.M.", ".M...M.", ".MMMMM.", "......."], {"M": MAROON})
GATE_SHUT = _pic(["M.M.M.M", "MMMMMMM", "M.M.M.M", "M.M.M.M", "M.M.M.M", "MMMMMMM", "M.M.M.M"], {"M": MAROON})
GATE_OPEN = _pic(["M.....M", "M.....M", ".......", ".......", ".......", "M.....M", "M.....M"], {"M": MAROON})
WALL = _filled(BLACK)
SPARK = _pic(["...W...", ".W.W.W.", "..WWW..", "WWWWWWW", "..WWW..", ".W.W.W.", "...W..."], {"W": WHITE})


def _die(pips, colour):
    rows = ["......." , ".DDDDD.", ".DDDDD.", ".DDDDD.", ".DDDDD.", ".DDDDD.", "......."]
    px = _pic(rows, {"D": colour})
    spots = {1: [(3, 3)], 2: [(2, 2), (4, 4)], 3: [(2, 2), (3, 3), (4, 4)], 4: [(2, 2), (4, 2), (2, 4), (4, 4)]}[min(pips, 4)]
    for x, y in spots:
        px[y][x] = BLACK
    return px


def _floor(model):
    px = _filled(GREEN, CELLS * TILE, CELLS * TILE)
    for r, _, ring in model.rings:
        L = len(ring)
        for i, (x, y) in enumerate(ring):
            px0, py0 = x * TILE, y * TILE
            for j in (i - 1, i + 1):
                nx, ny = ring[j % L]
                dx, dy = nx - x, ny - y
                if dx:   # horizontal stub from the centre
                    xs = range(3, TILE) if dx > 0 else range(0, 4)
                    for xx in xs:
                        px[py0 + 3][px0 + xx] = PURPLE
                else:
                    ys = range(3, TILE) if dy > 0 else range(0, 4)
                    for yy in ys:
                        px[py0 + yy][px0 + 3] = PURPLE
            px[py0 + 3][px0 + 3] = PURPLE
    return px


def _ring_xy(ring, u):
    """Pixel position (top-left of a tile) at fractional ring index u."""
    L = len(ring)
    i = int(u // 1)
    f = u - i
    x0, y0 = ring[i % L]
    x1, y1 = ring[(i + 1) % L]
    return round((x0 + (x1 - x0) * f) * TILE), round((y0 + (y1 - y0) * f) * TILE)


def _build_level(cfg, index):
    m = _model(index)
    sprites = [Sprite(_floor(m), name="floor", x=0, y=0, layer=0, blocking=BlockingMode.NOT_BLOCKED, tags=["floor"])]
    for i, c in enumerate(cfg.get("walls", ())):
        sprites.append(Sprite(WALL, name=f"wall-{i}", x=c[0] * TILE, y=c[1] * TILE, layer=2, blocking=BlockingMode.NOT_BLOCKED, tags=["wall"]))
    if cfg.get("hub"):
        c = cfg["hub"]
        sprites.append(Sprite(HUB, name="hub", x=c[0] * TILE, y=c[1] * TILE, layer=1, blocking=BlockingMode.NOT_BLOCKED, tags=["hub"]))
    for i, c in enumerate(cfg["docks"]):
        sprites.append(Sprite(DOCK_A if i == 0 else DOCK_B, name=f"dock-{i}", x=c[0] * TILE, y=c[1] * TILE, layer=1, blocking=BlockingMode.NOT_BLOCKED, tags=["dock"]))
    for i, (p, g) in enumerate(cfg.get("plates", ())):
        sprites.append(Sprite(PLATE, name=f"plate-{i}", x=p[0] * TILE, y=p[1] * TILE, layer=5, blocking=BlockingMode.NOT_BLOCKED, tags=["plate"]))
        sprites.append(Sprite(GATE_SHUT, name=f"gate-{i}", x=g[0] * TILE, y=g[1] * TILE, layer=2, blocking=BlockingMode.NOT_BLOCKED, tags=["gate"]))
    for i, c in enumerate(cfg.get("beacons", ())):
        sprites.append(Sprite(_die(i + 1, WHITE), name=f"die-{i}", x=c[0] * TILE, y=c[1] * TILE, layer=2, blocking=BlockingMode.NOT_BLOCKED, tags=["die"]))
    if cfg.get("beacons"):
        sprites.append(Sprite(SPARK, name="spark", x=0, y=0, layer=6, blocking=BlockingMode.NOT_BLOCKED, visible=False, tags=["spark"]))
    for j, (r, i0, ring) in enumerate(m.rings):
        x, y = _ring_xy(ring, i0)
        sprites.append(Sprite(BLOCK, name=f"block-{j}", x=x, y=y, layer=3, blocking=BlockingMode.NOT_BLOCKED, tags=["block"]))
    for i, c in enumerate(cfg["starts"]):
        sprites.append(Sprite(TWIN_A if i == 0 else TWIN_B, name=f"twin-{i}", x=c[0] * TILE, y=c[1] * TILE, layer=4, blocking=BlockingMode.NOT_BLOCKED, tags=["twin"]))
        sprites.append(Sprite(SEAL_A if i == 0 else SEAL_B, name=f"seal-{i}", x=cfg["docks"][i][0] * TILE, y=cfg["docks"][i][1] * TILE, layer=5, blocking=BlockingMode.NOT_BLOCKED, tags=["seal"]))
        sprites.append(Sprite(_ring(YELLOW if i == 0 else T), name=f"halo-{i}", x=c[0] * TILE - 1, y=c[1] * TILE - 1, layer=5, blocking=BlockingMode.NOT_BLOCKED, tags=["halo"]))
    return Level(sprites=sprites, name=f"level-{index + 1}", data={"config": cfg})


# ---------------------------------------------------------------- the game
RING_YELLOW = _arr(_ring(YELLOW))
RING_NONE = _arr(_ring(T))
RING_WHITE = _arr(_ring(WHITE))
RING_PINK = _arr(_ring(PINK))


class De48(ARCBaseGame):
    def __init__(self) -> None:
        self.state = (0, 0, 0, 0, 0)
        self.anim = []
        self.won = False
        super().__init__(
            game_id="de48",
            levels=[_build_level(cfg, i) for i, cfg in enumerate(LEVELS)],
            camera=Camera(background=BLACK, letter_box=BLACK),
            available_actions=[1, 2, 3, 4, 5],
        )

    # -- level entry
    def on_set_level(self, level: Level) -> None:
        self.state = self._m().initial()
        self.anim = []
        self.won = False
        if self._current_level_index > 0:
            # Entering a level (or resetting it) zeroes the engine's action count, and a Reset at zero
            # restarts the whole game. Keep it at one so Reset on a fresh level only retries that level.
            self._action_count = max(1, self._action_count)
        self._settle()

    def _m(self) -> Model:
        return _model(self._current_level_index)

    def _sprite(self, name: str) -> Sprite:
        return self.current_level.get_sprites_by_name(name)[0]

    # -- drawing from the state
    def _settle(self) -> None:
        m = self._m()
        s = self.state
        for t in (0, 1):
            x, y = _xy(s[t])
            self._sprite(f"twin-{t}").set_position(x * TILE, y * TILE)
            halo = self._sprite(f"halo-{t}")
            halo.set_position(x * TILE - 1, y * TILE - 1)
            halo.pixels = RING_YELLOW if s[2] == t else RING_NONE
            self._sprite(f"seal-{t}").set_visible(s[t] == m.docks[t])
        for j, (r, i0, ring) in enumerate(m.rings):
            x, y = _ring_xy(ring, i0 + 2 * r * s[3])
            self._sprite(f"block-{j}").set_position(x, y)
        for k in range(len(m.plates)):
            self._sprite(f"gate-{k}").pixels = _arr(GATE_OPEN if m.gate_open(k, s) else GATE_SHUT)
        if m.beacons:
            self._sprite("spark").set_visible(False)
        for k in range(len(m.beacons)):
            die = self._sprite(f"die-{k}")
            if k < s[4]:
                die.set_visible(False)
            else:
                die.set_visible(True)
                die.pixels = _arr(_die(k + 1, YELLOW if k == s[4] else WHITE))

    # -- one action
    def step(self) -> None:
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if not self.anim:
            self._decide()
        frame = self.anim.pop(0)
        self._apply(frame)
        if not self.anim:
            self._settle()
            if self.won:
                self.next_level()
            self.complete_action()

    def _decide(self) -> None:
        m = self._m()
        key = self.action.id.value
        old = self.state
        if key not in (1, 2, 3, 4, 5):
            self.anim = [{"pos": {}}]
            return
        new, kind = m.act(old, key)
        if new is None:
            self.anim = self._frames_refuse(old, key, kind)
            return
        self.state = new
        self.won = m.is_win(new)
        frames = []
        if kind == "swap":
            frames = [
                {"pix": {f"halo-{new[2]}": RING_WHITE}},
                {"pix": {f"halo-{new[2]}": RING_YELLOW, f"halo-{1 - new[2]}": RING_NONE}},
            ]
        else:
            frames = self._frames_move(old, new)
            if "turn" in kind:
                frames += self._frames_turn(old[3])
            if "pickup" in kind:
                dx, dy = _xy(m.beacons[new[4] - 1])
                frames += [{"pos": {"spark": (dx * TILE, dy * TILE)}, "vis": {"spark": True}}, {"pos": {}},
                           {"vis": {"spark": False, f"die-{new[4] - 1}": False}}]
        self.anim = frames

    def _frames_move(self, old, new):
        t = old[2]
        x0, y0 = _xy(old[t])
        x1, y1 = _xy(new[t])
        frames = []
        for k in range(1, MOVE_FRAMES + 1):
            x = x0 * TILE + (x1 - x0) * TILE * k // MOVE_FRAMES
            y = y0 * TILE + (y1 - y0) * TILE * k // MOVE_FRAMES
            frames.append({"pos": {f"twin-{t}": (x, y), f"halo-{t}": (x - 1, y - 1)}, "vis": {f"seal-{t}": False}})
        return frames

    def _frames_turn(self, phase):
        m = self._m()
        frames = []
        for k in range(1, TURN_FRAMES + 1):
            pos = {}
            for j, (r, i0, ring) in enumerate(m.rings):
                pos[f"block-{j}"] = _ring_xy(ring, i0 + 2 * r * phase + 2 * r * k / TURN_FRAMES)
            frames.append({"pos": pos})
        return frames

    def _frames_refuse(self, old, key, why):
        t = old[2]
        x, y = _xy(old[t])
        dx, dy = DIRS.get(key, (0, 0))
        if key == 5:
            return [{"pos": {}}]
        x, y = x * TILE, y * TILE
        push = {"pos": {f"twin-{t}": (x + dx, y + dy), f"halo-{t}": (x + dx - 1, y + dy - 1)}}
        back = {"pos": {f"twin-{t}": (x, y), f"halo-{t}": (x - 1, y - 1)}}
        if why != "jam":
            return [push, push, push, back]
        m = self._m()
        other = 1 - t
        blocked = {f"halo-{other}": RING_PINK}
        # How far the blocks get before they meet the twin standing in their way.
        reach = 1.0
        for r, i0, ring in m.rings:
            a = i0 + 2 * r * old[3]
            for k in range(1, 2 * r + 1):
                if _idx(*ring[(a + k) % len(ring)]) == old[other]:
                    reach = min(reach, (k - 1) / (2 * r))
                    break
        frames = []
        steps = [0.0, 1 / 3, 2 / 3, 1.0, 2 / 3, 1 / 3, 0.0]
        for n, q in enumerate(steps):
            pos = {}
            for j, (r, i0, ring) in enumerate(m.rings):
                a = i0 + 2 * r * old[3]
                if reach > 0:
                    pos[f"block-{j}"] = _ring_xy(ring, a + reach * 2 * r * q)
                else:
                    bx, by = _ring_xy(ring, a)
                    nx, ny = _ring_xy(ring, a + 1)
                    sx, sy = (nx > bx) - (nx < bx), (ny > by) - (ny < by)
                    pos[f"block-{j}"] = (bx + sx * (1 if 0 < q < 1 else 0), by + sy * (1 if 0 < q < 1 else 0))
            twin = push if n < 3 else back
            f = {"pos": {**twin["pos"], **pos}}
            if n < len(steps) - 1:
                f["pix"] = dict(blocked)
            else:
                f["pix"] = {f"halo-{other}": RING_YELLOW if old[2] == other else RING_NONE}
            frames.append(f)
        return frames

    def _apply(self, frame) -> None:
        for name, (x, y) in frame.get("pos", {}).items():
            self._sprite(name).set_position(x, y)
        for name, arr in frame.get("pix", {}).items():
            self._sprite(name).pixels = arr
        for name, vis in frame.get("vis", {}).items():
            self._sprite(name).set_visible(vis)
