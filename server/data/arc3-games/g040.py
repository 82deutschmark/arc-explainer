# ARC-AGI-3 candidate task g040.

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
from sprite_book import (
    blink, block, door, figure, fixture, hairline, medallion, outline, speckle,
)

FLOOR = 7
WALL = 4
MORTAR = 2
PLAYER = 12
PLAYER_MARK = 13
PIP_RIM = 13
PIP_CORE = 12
EXIT_FRAME = 12
EXIT_BAR = WALL
APERTURE = FLOOR
GIRTH_ON = 12
GIRTH_OFF = FLOOR

PAIRS = "abc"
PAIR_COLOUR = {"a": 9, "b": 13, "c": 2}

APERTURE_SLOTS = ((1, 1), (2, 2), (1, 2), (2, 1), (1, 0))

EXIT_FRAMES = 3

N = 16
CELL = 4


def move(cell, delta, rows, mouths, apertures, girth):
    x, y = cell
    nx, ny = x + delta[0], y + delta[1]
    if not (0 <= nx < N and 0 <= ny < N):
        return None
    ch = rows[ny][nx]
    if ch == "#":
        return None
    if ch in PAIRS:
        i = PAIRS.index(ch)
        room = apertures[i]
        if room <= 0 or girth > room:
            return None
        far, near = mouths[ch]
        dest = near if far == (nx, ny) else far
        widened = list(apertures)
        widened[i] = room - 1
        return dest, tuple(widened)
    return (nx, ny), apertures


LEVELS_SPEC = [
    {"aperture": (3, 0, 0), "rows": [
        "################",
        "#..............#",
        "#....P.........#",
        "#..............#",
        "#........a.....#",
        "#..............#",
        "#..........X...#",
        "################",
        "#..............#",
        "#..............#",
        "#.....a........#",
        "#..............#",
        "#........*.....#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"aperture": (3, 0, 0), "rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#..........*...#",
        "#......a.......#",
        "#..............#",
        "#.........X....#",
        "################",
        "#..............#",
        "#......a.......#",
        "#..............#",
        "#....*.........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"aperture": (4, 4, 0), "rows": [
        "################",
        "#....#....#....#",
        "#.P..#....#....#",
        "#....#..*.#....#",
        "#..a.#.a..#....#",
        "#....#....#..*.#",
        "#..*.#....#....#",
        "#....#....#....#",
        "#....#..b.#.b..#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#.X..#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "################",
    ]},
    {"aperture": (2, 3, 0), "rows": [
        "################",
        "#..............#",
        "#..P.......*...#",
        "#..............#",
        "#..a......b....#",
        "#..............#",
        "#.....X........#",
        "################",
        "#..............#",
        "#..a......b....#",
        "#..............#",
        "#....*.........#",
        "#..............#",
        "#.........*....#",
        "#..............#",
        "################",
    ]},
    {"aperture": (4, 0, 0), "rows": [
        "################",
        "#..............#",
        "#..P......*....#",
        "#..............#",
        "#.......a......#",
        "#..............#",
        "#..X...........#",
        "################",
        "#..............#",
        "#.......a......#",
        "#..............#",
        "#...*..........#",
        "#..............#",
        "#..........*...#",
        "#..............#",
        "################",
    ]},
    {"aperture": (3, 4, 5), "rows": [
        "################",
        "#....#....#....#",
        "#..*.#..*.#..*.#",
        "#....#....#....#",
        "#..a.#..b.#..c.#",
        "#....#....#....#",
        "################",
        "#..............#",
        "#..a....b....c.#",
        "#..............#",
        "#..P.......X...#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"aperture": (2, 4, 3), "rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#.........*....#",
        "#....a.........#",
        "#..............#",
        "#...........c..#",
        "################",
        "#..............#",
        "#....a.........#",
        "#.........*....#",
        "#......b.......#",
        "################",
        "#......b....c..#",
        "#..*.....X.....#",
        "################",
    ]},
    {"aperture": (3, 3, 4), "rows": [
        "################",
        "#....#.........#",
        "#..P.#....*....#",
        "#....#.........#",
        "#..a.#....b....#",
        "#....#.........#",
        "#..*.#.........#",
        "#....###########",
        "#..a.......c...#",
        "#..............#",
        "#....*.....*...#",
        "###########.####",
        "#....b.........#",
        "#..........c...#",
        "#..*.....X.....#",
        "################",
    ]},
]


def cells_of(rows, ch):
    return [(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c == ch]


def mouths_of(rows):
    found = {}
    for letter in PAIRS:
        spots = cells_of(rows, letter)
        if spots:
            if len(spots) != 2:
                raise AssertionError(f"pair {letter} has {len(spots)} mouths, needs 2")
            found[letter] = (spots[0], spots[1])
    return found


def pips_of(rows):
    return tuple(sorted(cells_of(rows, "*")))


def start_of(rows):
    spots = cells_of(rows, "P")
    if len(spots) != 1:
        raise AssertionError("level needs exactly one start")
    return spots[0]


def exit_of(rows):
    spots = cells_of(rows, "X")
    if len(spots) != 1:
        raise AssertionError("level needs exactly one exit")
    return spots[0]


def girth_of(pipmask):
    return 1 + bin(pipmask).count("1")


def _stone(x, y):
    face = block(WALL)
    for j, row in enumerate(speckle(MORTAR, (x * 3 + y * 5) % 7)):
        for i, value in enumerate(row):
            if value >= 0 and (i + j) % 2 == 0:
                face[j][i] = value
    return face


def _mouth_face(colour, room, x=0, y=0, worn=False):
    if room <= 0:
        return _stone(x, y)
    face = block(colour)
    for corner in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        face[corner[0]][corner[1]] = colour if worn else WALL
    for j, i in APERTURE_SLOTS[:room]:
        face[j][i] = APERTURE
    return face


def _avatar():
    return figure(PLAYER, PLAYER_MARK)


def _exit_face(live):
    face = door(EXIT_FRAME, None if live else EXIT_BAR)
    if live:
        face = [[FLOOR if v < 0 else v for v in row] for row in face]
    return face


def _stamp(frame, cell, face):
    px, py = cell[0] * CELL, cell[1] * CELL
    for j, row in enumerate(face):
        for i, value in enumerate(row):
            if value >= 0:
                frame[py + j, px + i] = value
    return frame


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    pix, name, tags, layer = _stone(x, y), f"wall_{x}_{y}", ["wall"], -1
                elif ch == "*":
                    pix = medallion(PIP_RIM, PIP_CORE)
                    name, tags, layer = f"pip_{x}_{y}", ["pip"], 0
                elif ch == "X":
                    pix, name, tags, layer = _exit_face(False), "exit", ["exit"], 0
                elif ch in PAIRS:
                    pix = _mouth_face(PAIR_COLOUR[ch],
                                      spec["aperture"][PAIRS.index(ch)], x, y)
                    name = f"mouth_{ch}_{x}_{y}"
                    tags, layer = ["mouth", f"pair_{ch}"], 0
                elif ch == "P":
                    pix, name, tags, layer = _avatar(), "player", ["player"], 1
                else:
                    continue
                sprites.append(Sprite(
                    pixels=pix, name=name, blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=layer, tags=tags,
                ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def glint_cells(rows):
    return [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row)
            if ch == "#" and x != N - 1 and (x * 5 + y * 3) % 17 == 0]


class G040A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def _paint_wedge(self, frame, total, now):
        height, width = frame.shape
        top = 6
        for i in range(total):
            deep = 2 * (i + 1)
            if top + deep > height:
                break
            frame[top:top + deep, width - 3:width - 1] = (
                GIRTH_ON if i < now else GIRTH_OFF)
            top += deep + 2
        return frame

    def _paint_effect(self, frame, kind, left, data):
        if kind == "transit":
            near, far, letter = data
            half = CELL // 2
            hairline(frame,
                     (near[0] * CELL + half, near[1] * CELL + half),
                     (far[0] * CELL + half, far[1] * CELL + half),
                     PAIR_COLOUR[letter], only_over={FLOOR})
            if blink(left, 1):
                for cell in (near, far):
                    outline(frame, (cell[0] * CELL - 1, cell[1] * CELL - 1,
                                    cell[0] * CELL + CELL + 1, cell[1] * CELL + CELL + 1),
                            PLAYER)
        elif kind == "take":
            cell = data
            ring_out = 2 - left
            outline(frame, (cell[0] * CELL - ring_out, cell[1] * CELL - ring_out,
                            cell[0] * CELL + CELL + ring_out,
                            cell[1] * CELL + CELL + ring_out), PIP_RIM)
        elif kind == "exit":
            cell = self._game.exit_cell
            ring_out = EXIT_FRAMES - left
            outline(frame, (cell[0] * CELL - ring_out, cell[1] * CELL - ring_out,
                            cell[0] * CELL + CELL + ring_out,
                            cell[1] * CELL + CELL + ring_out), EXIT_FRAME)
        return frame

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        player = game.player_cell

        for cell in glint_cells(game.rows):
            _stamp(frame, cell, fixture((MORTAR, PLAYER_MARK), game.tick // 5,
                                        (cell[0] + cell[1]) % 2))

        for letter, cells in game.mouths.items():
            room = game.apertures[PAIRS.index(letter)]
            for cell in cells:
                worn = cell == player
                _stamp(frame, cell,
                       _mouth_face(PAIR_COLOUR[letter], room, cell[0], cell[1], worn))
                if worn:
                    _stamp(frame, cell, _avatar())

        if not game.current_level.get_sprites_by_tag("pip"):
            exit_cell = game.exit_cell
            _stamp(frame, exit_cell, _exit_face(True))
            if exit_cell == player:
                _stamp(frame, exit_cell, _avatar())

        self._paint_wedge(frame, game.level_girth_max, girth_of(game.pipmask))

        kind, left, data = game.effect
        if left:
            self._paint_effect(frame, kind, left, data)
        return frame


class G040(ARCBaseGame):

    TRANSIT_FRAMES = 3
    TAKE_FRAMES = 2

    def __init__(self) -> None:
        self._load(0)
        camera = Camera(
            width=N * CELL, height=N * CELL, background=FLOOR, letter_box=5,
            interfaces=[G040A(self)],
        )
        super().__init__(game_id="g040", levels=build_levels(), camera=camera)

    def _load(self, index: int) -> None:
        spec = LEVELS_SPEC[index]
        rows = spec["rows"]
        self.rows = rows
        self.mouths = mouths_of(rows)
        self.apertures = tuple(spec["aperture"])
        self.pips = pips_of(rows)
        self.pipmask = 0
        self.exit_cell = exit_of(rows)
        self.player_cell = start_of(rows)
        self.level_girth_max = 1 + len(self.pips)
        self.effect = (None, 0, None)
        self.tick = 0

    def on_set_level(self, level: Level) -> None:
        self._load(self.level_index)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _player(self):
        found = self.current_level.get_sprites_by_name("player")
        return found[0] if found else None

    def step(self) -> None:
        self.tick += 1

        kind, left, data = self.effect
        if left:
            left -= 1
            self.effect = (kind, left, data)
            if left == 0:
                self.effect = (None, 0, None)
                if kind == "exit":
                    self.next_level()
                self.complete_action()
            return

        deltas = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }
        delta = deltas.get(self.action.id)
        player = self._player()
        if delta is None or player is None:
            self.complete_action()
            return

        here = self.player_cell
        outcome = move(here, delta, self.rows, self.mouths,
                       self.apertures, girth_of(self.pipmask))
        if outcome is None:
            self.complete_action()
            return

        dest, self.apertures = outcome
        self.player_cell = dest
        player.set_position(dest[0] * CELL, dest[1] * CELL)

        landed = self.rows[dest[1]][dest[0]]
        if landed in PAIRS:
            near = (here[0] + delta[0], here[1] + delta[1])
            self.effect = ("transit", self.TRANSIT_FRAMES, (near, dest, landed))
            return

        if dest in self.pips:
            bit = 1 << self.pips.index(dest)
            if not self.pipmask & bit:
                self.pipmask |= bit
                taken = self.current_level.get_sprite_at(
                    dest[0] * CELL, dest[1] * CELL, tag="pip")
                if taken is not None:
                    self.current_level.remove_sprite(taken)
                self.effect = ("take", self.TAKE_FRAMES, dest)
                return

        if dest == self.exit_cell and self.pipmask == (1 << len(self.pips)) - 1:
            self.effect = ("exit", EXIT_FRAMES, None)
            return

        self.complete_action()
