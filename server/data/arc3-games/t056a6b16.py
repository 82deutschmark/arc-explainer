# ARC-AGI-3 candidate task t056a6b16.

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

FLOOR = 4
WALL = 1
PLAYER = 12
PIP = 11
EXIT_LOCKED = 13
EXIT_LIVE = 14
SEALED = 5
APERTURE_MARK = 0
GIRTH_ON = 12
GIRTH_OFF = 3

PAIRS = "abc"
PAIR_COLOUR = {"a": 9, "b": 15, "c": 10}

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


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _inner(colour):
    return [[FLOOR, FLOOR, FLOOR, FLOOR],
            [FLOOR, colour, colour, FLOOR],
            [FLOOR, colour, colour, FLOOR],
            [FLOOR, FLOOR, FLOOR, FLOOR]]


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    pix, name, tags, layer = _block(WALL), f"wall_{x}_{y}", ["wall"], -1
                elif ch == "*":
                    pix, name, tags, layer = _inner(PIP), f"pip_{x}_{y}", ["pip"], 0
                elif ch == "X":
                    pix, name, tags, layer = _block(EXIT_LOCKED), "exit", ["exit"], 0
                elif ch in PAIRS:
                    pix = _block(PAIR_COLOUR[ch])
                    name = f"mouth_{ch}_{x}_{y}"
                    tags, layer = ["mouth", f"pair_{ch}"], 0
                elif ch == "P":
                    pix, name, tags, layer = _block(PLAYER), "player", ["player"], 1
                else:
                    continue
                sprites.append(Sprite(
                    pixels=pix, name=name, blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=layer, tags=tags,
                ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G522aad5f(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def _paint_mouth(self, frame, cell, letter, room):
        px, py = cell[0] * CELL, cell[1] * CELL
        if room <= 0:
            frame[py:py + CELL, px:px + CELL] = SEALED
            return
        frame[py:py + CELL, px:px + CELL] = PAIR_COLOUR[letter]
        for i in range(min(room, 9)):
            frame[py + 1 + i // 3, px + 1 + i % 3] = APERTURE_MARK

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        player = self._game.player_cell
        for letter, cells in self._game.mouths.items():
            room = self._game.apertures[PAIRS.index(letter)]
            for cell in cells:
                if cell == player:
                    continue
                self._paint_mouth(frame, cell, letter, room)

        if not self._game.current_level.get_sprites_by_tag("pip"):
            ex, ey = self._game.exit_cell
            frame[ey * CELL:ey * CELL + CELL, ex * CELL:ex * CELL + CELL] = EXIT_LIVE

        total = self._game.level_girth_max
        now = girth_of(self._game.pipmask)
        for i in range(total):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = GIRTH_ON if i < now else GIRTH_OFF
        return frame


class G25ca621b(ARCBaseGame):

    def __init__(self) -> None:
        self._load(0)
        camera = Camera(
            width=N * CELL, height=N * CELL, background=FLOOR, letter_box=5,
            interfaces=[G522aad5f(self)],
        )
        super().__init__(game_id="t056a6b16", levels=build_levels(), camera=camera)

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

        outcome = move(self.player_cell, delta, self.rows, self.mouths,
                       self.apertures, girth_of(self.pipmask))
        if outcome is None:
            self.complete_action()
            return

        dest, self.apertures = outcome
        self.player_cell = dest
        player.set_position(dest[0] * CELL, dest[1] * CELL)

        if dest in self.pips:
            bit = 1 << self.pips.index(dest)
            if not self.pipmask & bit:
                self.pipmask |= bit
                taken = self.current_level.get_sprite_at(
                    dest[0] * CELL, dest[1] * CELL, tag="pip")
                if taken is not None:
                    self.current_level.remove_sprite(taken)

        if dest == self.exit_cell and self.pipmask == (1 << len(self.pips)) - 1:
            self.next_level()

        self.complete_action()
