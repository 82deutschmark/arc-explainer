# ARC-AGI-3 candidate task t77f54ade.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    RenderableUserDisplay,
    Sprite,
)

FLOOR = 2
WALL = 5
PLAYER = 8
KEY = 11
EXIT_LOCKED = 9
EXIT_LIVE = 6
TERMINAL = 7
CORD_A = 10
CORD_B = 15
UNGLUED = WALL
PIP_ON = KEY
PIP_OFF = 3

N = 16
CELL = 4

SOCKETS = ("N", "E", "S", "W")
SIDX = {s: i for i, s in enumerate(SOCKETS)}

CYCLE = {
    "N": ("S", "E", "W", None),
    "E": ("W", "N", "S", None),
    "S": ("N", "E", "W", None),
    "W": ("E", "N", "S", None),
}

NO_PLUGS = (None, None, None, None)

FIXED_WALLS = ((0, 0), (1, 0), (0, 1), (1, 1), (14, 0), (15, 0), (0, 14), (0, 15))


def press(config, socket, cords):
    i = SIDX[socket]
    cur = config[i]
    opts = CYCLE[socket]
    start = opts.index(cur)
    for k in range(1, len(opts) + 1):
        tgt = opts[(start + k) % len(opts)]
        if tgt == cur:
            continue
        cost = 1 if cur is not None else 0
        if tgt is not None and config[SIDX[tgt]] is not None:
            cost += 1
        if cost > cords:
            continue
        new = list(config)
        if cur is not None:
            new[SIDX[cur]] = None
            new[i] = None
        if tgt is not None and new[SIDX[tgt]] is not None:
            other = new[SIDX[tgt]]
            new[SIDX[other]] = None
            new[SIDX[tgt]] = None
        if tgt is not None:
            new[i] = tgt
            new[SIDX[tgt]] = socket
        return tuple(new), cords - cost
    return config, cords


def cross(x, y, dx, dy, config, walls):
    nx, ny = x + dx, y + dy
    if 0 <= nx < N and 0 <= ny < N:
        return None if (nx, ny) in walls else (nx, ny)
    if ny < 0:
        src, off = "N", x
    elif ny >= N:
        src, off = "S", x
    elif nx < 0:
        src, off = "W", y
    else:
        src, off = "E", y
    partner = config[SIDX[src]]
    if partner is None:
        return None
    d = N - 1 - off
    if partner == "N":
        cell = (d, 0)
    elif partner == "S":
        cell = (d, N - 1)
    elif partner == "W":
        cell = (0, d)
    else:
        cell = (N - 1, d)
    return None if cell in walls else cell


LEVELS_SPEC = [
    {"cords": 3, "rows": [
        "##............##",
        "##..............",
        "........n.......",
        "................",
        "....P...........",
        "................",
        "............X...",
        "................",
        "################",
        "................",
        "................",
        "................",
        "......k.........",
        "................",
        "#...............",
        "#...............",
    ]},
    {"cords": 2, "rows": [
        "##............##",
        "##..............",
        "......n.........",
        "................",
        "..P.............",
        "................",
        ".........X......",
        "................",
        "################",
        "##...###########",
        "##...###########",
        "##...###########",
        "##.k.###########",
        "##...###########",
        "#....###########",
        "#....###########",
    ]},
    {"cords": 3, "rows": [
        "##..........####",
        "##..........#...",
        "......n.....#...",
        "............#...",
        "..P.........#...",
        "............#...",
        "............#...",
        "............#...",
        "............#...",
        "......X.....#...",
        "............#...",
        "............#..k",
        "............#...",
        "............#...",
        "#...........#...",
        "#...........####",
    ]},
    {"cords": 2, "rows": [
        "##.........#####",
        "##.........#....",
        "....n......#....",
        "...........#....",
        "..P........#....",
        ".....e.....#....",
        "...........#....",
        "......X....#...k",
        "############....",
        "...........#....",
        "...........#....",
        "....k......#....",
        "...........#....",
        "...........#....",
        "#..........#....",
        "#..........#####",
    ]},
    {"cords": 1, "rows": [
        "##.........#####",
        "##.........#....",
        "....n......#....",
        "...........#....",
        "..P........#....",
        "...........#....",
        "...........#....",
        "......X....#...k",
        "############....",
        "...........#....",
        "...........#....",
        "....k......#....",
        "...........#....",
        "...........#....",
        "#..........#....",
        "#..........#####",
    ]},
    {"cords": 1, "plugs": ("S", None, "N", None), "rows": [
        "##.........#####",
        "##.........#....",
        "...........#....",
        "....n......#....",
        "..P........#....",
        "...........#....",
        "......X....#....",
        "...........#...k",
        "############....",
        "..........k#....",
        "...........#....",
        "...........#....",
        "...........#....",
        "...........#....",
        "#..........#....",
        "#..........#####",
    ]},
    {"cords": 2, "rows": [
        "##....#....#.###",
        "##....#....#....",
        "......#....#....",
        "w.....#....#....",
        "..P...#....#....",
        "......#....#...k",
        "......#....#....",
        "..X...#....#....",
        "......#....#....",
        "......#...k#....",
        "......#....#....",
        "......#....#....",
        "......#....#....",
        "......#....#....",
        "#.....#....#....",
        "#.....#....#.###",
    ]},
    {"cords": 1, "rows": [
        "##....#....#####",
        "##....#....#....",
        "..n...#....#....",
        "......#..k.#....",
        "..P...#....#....",
        "......#....#....",
        "......#....#..k.",
        "..X...#....#....",
        "......######....",
        "......#....#....",
        "......#....#....",
        "......#.k..#....",
        "......#....#....",
        "......#....#....",
        "#.....#....#....",
        "#.....#....#####",
    ]},
]


def _cells(rows, chars):
    return [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c in chars]


def walls_of(spec):
    return frozenset(_cells(spec["rows"], "#"))


def start_of(spec):
    return _cells(spec["rows"], "P")[0]


def exit_of(spec):
    return _cells(spec["rows"], "X")[0]


def keys_of(spec):
    return tuple(sorted(_cells(spec["rows"], "k")))


def terminals_of(spec):
    out = {}
    for y, row in enumerate(spec["rows"]):
        for x, ch in enumerate(row):
            if ch in "nesw":
                out[ch.upper()] = (x, y)
    return out


def plugs_of(spec):
    return tuple(spec.get("plugs", NO_PLUGS))


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _rounded(colour):
    block = _block(colour)
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        block[y][x] = -1
    return block


def _walker(cords):
    block = _rounded(PLAYER)
    for i in range(CELL):
        block[CELL - 1 - i][0] = PIP_ON if i < cords else PIP_OFF
    return block


def _inner(colour):
    return [[-1, -1, -1, -1],
            [-1, colour, colour, -1],
            [-1, colour, colour, -1],
            [-1, -1, -1, -1]]


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    pix, name, tags, layer = _block(WALL), f"wall_{x}_{y}", ["wall"], -1
                elif ch == "k":
                    pix, name, tags, layer = _inner(KEY), f"key_{x}_{y}", ["key"], 0
                elif ch == "X":
                    pix, name, tags, layer = _rounded(EXIT_LOCKED), "exit", ["exit"], 0
                elif ch in "nesw":
                    pix = _rounded(TERMINAL)
                    name, tags, layer = f"term_{ch}", ["terminal", f"socket_{ch.upper()}"], 0
                elif ch == "P":
                    pix, name, tags, layer = _walker(spec["cords"]), "player", ["player"], 1
                else:
                    continue
                sprites.append(Sprite(
                    pixels=pix, name=name, blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=layer, tags=tags,
                ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G2edc6aa9(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def _edge_colours(self):
        config = self._game.plugs
        colours = {s: UNGLUED for s in SOCKETS}
        pool = [CORD_A, CORD_B]
        for s in SOCKETS:
            p = config[SIDX[s]]
            if p is None or colours[s] != UNGLUED:
                continue
            c = pool.pop(0)
            colours[s] = c
            colours[p] = c
        return colours

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        colours = self._edge_colours()
        frame[0, :] = colours["N"]
        frame[63, :] = colours["S"]
        frame[:, 0] = colours["W"]
        frame[:, 63] = colours["E"]

        for socket, (x, y) in self._game.terminal_cells.items():
            px, py = x * CELL, y * CELL
            frame[py + 1:py + 3, px + 1:px + 3] = colours[socket]

        if not self._game.current_level.get_sprites_by_tag("key"):
            ex, ey = self._game.exit_cell
            frame[ey * CELL:ey * CELL + CELL, ex * CELL:ex * CELL + CELL] = EXIT_LIVE

        return frame


class G58a69beb(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.plugs = plugs_of(spec)
        self.cords = spec["cords"]
        self.walls = walls_of(spec)
        self.terminal_cells = terminals_of(spec)
        self.exit_cell = exit_of(spec)
        camera = Camera(
            width=N * CELL, height=N * CELL, background=FLOOR, letter_box=5,
            interfaces=[G2edc6aa9(self)],
        )
        super().__init__(game_id="t77f54ade", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.plugs = plugs_of(spec)
        self.cords = spec["cords"]
        self.walls = walls_of(spec)
        self.terminal_cells = terminals_of(spec)
        self.exit_cell = exit_of(spec)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw_walker()

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _player(self):
        found = self.current_level.get_sprites_by_name("player")
        return found[0] if found else None

    def _redraw_walker(self) -> None:
        player = self._player()
        if player is not None:
            player.pixels = np.array(_walker(self.cords))

    def _socket_under(self, cell):
        for socket, pos in self.terminal_cells.items():
            if pos == cell:
                return socket
        return None

    def step(self) -> None:
        player = self._player()
        if player is None:
            self.complete_action()
            return
        cell = (player.x // CELL, player.y // CELL)

        if self.action.id == GameAction.ACTION5:
            socket = self._socket_under(cell)
            if socket is not None:
                self.plugs, self.cords = press(self.plugs, socket, self.cords)
                self._redraw_walker()
            self.complete_action()
            return

        deltas = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }
        delta = deltas.get(self.action.id)
        if delta is None:
            self.complete_action()
            return

        dest = cross(cell[0], cell[1], delta[0], delta[1], self.plugs, self.walls)
        if dest is None:
            self.complete_action()
            return

        player.set_position(dest[0] * CELL, dest[1] * CELL)

        picked = self.current_level.get_sprite_at(
            dest[0] * CELL, dest[1] * CELL, tag="key")
        if picked is not None:
            self.current_level.remove_sprite(picked)

        if dest == self.exit_cell and not self.current_level.get_sprites_by_tag("key"):
            self.next_level()

        self.complete_action()
