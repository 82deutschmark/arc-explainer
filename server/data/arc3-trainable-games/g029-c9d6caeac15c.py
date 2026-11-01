# Author: Claude Opus 5 (game, 30-August-2026); art pass and new levels by Claude Opus 5.5 High
# Date: 20-October-2026
# PURPOSE: ARC-AGI-3 game g029 in one file (numpy + arcengine): level data, the move rules, and the
#   scene drawn as named, layered engine sprites (grass, brick walls, two creatures with faces, their
#   homes, standing stones, two wall plaques, flowers).
# SRP/DRY check: Pass -- one game file; the art helpers below only make pixel grids, the rules only
#   move cells, and neither reaches into the other.
# CHANGELOG: 20-Oct-2026 (Claude Opus 5.5 High) -- new levels one to seven. Level one keeps its open
#   room with the homes moved further away. Levels two to seven are new layouts (a maze, then rooms
#   crossed by brick bars), each one longer than the last. Level eight, the move rules, the art and
#   the inputs are unchanged.
# CHANGELOG: 20-Oct-2026 (Claude Opus 5.5 High) -- art pass. Green grass floor, orange brick walls
#   outlined in black, two twin creatures (blue, yellow) with eyes that look the way they last
#   stepped, round homes in their colours, standing stones with a white glyph on a black plate that
#   goes dark when spent, the two wall marks now plaque sprites in the same two cells, and flowers in
#   place of the old specks. Rules, levels, inputs and frame counts are unchanged.

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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for x in range(1, last):
        px[0][x] = px[last][x] = rim
    for y in range(1, last):
        px[y][0] = px[y][last] = rim
    for y in range(1, last):
        for x in range(1, last):
            px[y][x] = centre
    return px


# ARC palette indices used here; each one has a single job on the board.
FLOOR = 14        # green grass, one flat field
BRICK = 12        # orange walls
SEAM = 13         # maroon mortar pixel, inert
EDGE = 5          # black: wall border, eyes, home holes, glyph plates
BODY_A = 9        # blue creature and its home
BODY_B = 11       # yellow creature and its home
LIVE = 0          # white glyph
SPENT = 3         # dark grey glyph
FLOWER_HUES = (15, 10)

WALL = EDGE       # the plate behind a glyph

MIRROR_V, MIRROR_H, MIRROR_D = 0, 1, 2
PYLON_CHARS = "VHD"


def mirror_vector(mirror: int, dx: int, dy: int) -> tuple[int, int]:
    if mirror == MIRROR_V:
        return (-dx, dy)
    if mirror == MIRROR_H:
        return (dx, -dy)
    return (dy, dx)


LEVELS_SPEC = [
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#.....x..y.....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.a..........b.#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#######..#######",
        "#..a........b..#",
        "#.#####..#####.#",
        "#...#.#..#.#...#",
        "###.#.#..#.#.###",
        "#x#.#.#..#.#.#y#",
        "#.#.#.#..#.#.#.#",
        "#.#.#.#..#.#.#.#",
        "#.###.#..#.###.#",
        "#...#......#...#",
        "#.###.####.###.#",
        "#..............#",
        "################",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#........#######",
        "#..............#",
        "#..........###.#",
        "#.......#......#",
        "#.......#.######",
        "#......y#...#..#",
        "#.......#...#..#",
        "#...H...#...#..#",
        "#.....#.#..##..#",
        "#.....#...a#...#",
        "#.xb.......#...#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..#...........#",
        "#..#######.....#",
        "#..#...........#",
        "#..#...........#",
        "#..##..........#",
        "#######...x....#",
        "#...##..####...#",
        "#...##.D#......#",
        "#...##..#......#",
        "#...##..#....a.#",
        "#...##.........#",
        "#..###......####",
        "#...#..b..###..#",
        "#...#......y...#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#....#.........#",
        "#....#xD.......#",
        "#....#.........#",
        "#....#.#####b.y#",
        "#....#....V....#",
        "#...##..##.....#",
        "#..#...........#",
        "#..#a...######.#",
        "#..#...........#",
        "#..#...........#",
        "#..#######.....#",
        "#.##.....V.....#",
        "###......H.....#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..........x...#",
        "#...###........#",
        "#.........######",
        "#...H..........#",
        "#....####......#",
        "#.......####..y#",
        "#..........D...#",
        "#####..........#",
        "#...b..........#",
        "#..............#",
        "#..............#",
        "#..#######.a...#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#......#.......#",
        "#....#.#.......#",
        "#....#.#.....a.#",
        "####.#.#.......#",
        "#....#.#.......#",
        "#y...#....D....#",
        "#....#....b#...#",
        "#..........##..#",
        "#..........##..#",
        "#..........#...#",
        "#x.........#...#",
        "#..........#H#.#",
        "#............#.#",
        "#............#.#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#y........x....#",
        "#.##.#####.##..#",
        "#.#D.......#D#.#",
        "#.#..#####.#...#",
        "#....#...#.....#",
        "#.##.#...#.###.#",
        "#..........#...#",
        "#.####.###.#.#.#",
        "#......#.....#.#",
        "#.####.#.####..#",
        "#.#..........#.#",
        "#.#.######.#.#.#",
        "#..a..H.....b..#",
        "#..............#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


_BEAMS = (
    ("1111",
     "0110",
     "0110",
     "1111"),
    ("1001",
     "1111",
     "1111",
     "1001"),
    ("1100",
     "1110",
     "0111",
     "0011"),
)


def beam(mirror: int, colour: int, gap: int = -1) -> list[list[int]]:
    return [[colour if ch == "1" else gap for ch in row] for row in _BEAMS[mirror]]


def pylon_pixels(mirror: int, spent: bool = False) -> list[list[int]]:
    # A standing stone: the glyph cut into a black plate, white while live, dark once spent.
    return beam(mirror, SPENT if spent else LIVE, WALL)


# The creature: round head, body, two feet. "." is see-through, "B" body, "k" eye.
_CREATURE = {
    "front": (".BB.", "BkkB", "BBBB", "B..B"),
    "up":    (".kk.", "BBBB", "BBBB", "B..B"),
    "left":  (".BB.", "kBBB", "BBBB", "B..B"),
    "right": (".BB.", "BBBk", "BBBB", "B..B"),
}

FACING = {(0, -1): "up", (0, 1): "front", (-1, 0): "left", (1, 0): "right"}


def body_pixels(colour: int, face: str = "front") -> list[list[int]]:
    key = {".": -1, "B": colour, "k": EDGE}
    return [[key[ch] for ch in row] for row in _CREATURE[face]]


def home_pixels(colour: int) -> list[list[int]]:
    # A round burrow: rim in its creature's colour, a black hole in the middle.
    return [[-1, colour, colour, -1],
            [colour, EDGE, EDGE, colour],
            [colour, EDGE, EDGE, colour],
            [-1, colour, colour, -1]]


def wall_pixels(rows: list[str], x: int, y: int) -> list[list[int]]:
    """One brick cell. Any pixel touching grass (including diagonally) is black, so a run of wall
    gets one continuous outline; off the board counts as wall, so the screen edge has none."""
    def solid(cx: int, cy: int) -> bool:
        return not (0 <= cx < N and 0 <= cy < N) or rows[cy][cx] == "#"

    px = block(BRICK)
    for py in range(CELL):
        for pxx in range(CELL):
            for oy in (-1, 0, 1):
                for ox in (-1, 0, 1):
                    gx, gy = x * CELL + pxx + ox, y * CELL + py + oy
                    if not solid(gx // CELL if gx >= 0 else -1, gy // CELL if gy >= 0 else -1):
                        px[py][pxx] = EDGE
    seam = (1 + (x + y) % 2, 1 + (x + y) % 2)
    if px[seam[1]][seam[0]] == BRICK:
        px[seam[1]][seam[0]] = SEAM
    return px


def flower(phase: int, seed: int = 0) -> list[list[int]]:
    # Two petals that sway one pixel and swap colour as frames go by; they do nothing.
    px = [[-1] * CELL for _ in range(CELL)]
    sway = (phase + seed) % 2
    hue = FLOWER_HUES[((phase + seed) // 2) % len(FLOWER_HUES)]
    px[1][1 + sway] = px[2][1 + sway] = hue
    px[1][2 - sway] = hue
    return px


def decor_cells(rows: list[str], seed: int) -> list[tuple[int, int]]:
    live = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row)
            if ch in "abxy" + PYLON_CHARS}
    free = [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row)
            if ch == "."
            and all(max(abs(x - lx), abs(y - ly)) >= 2 for lx, ly in live)]
    if len(free) < 3:
        return free
    stride = len(free) // 3
    return [free[(seed * 11 + k * stride) % len(free)] for k in range(3)]


# The two wall plaques sit in the same two cells the old painted mark used.
SIGN_CELLS = (("sign_w", 0, N // 2 - 1), ("sign_e", N - 1, N // 2))


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for index, spec in enumerate(LEVELS_SPEC):
        sprites: list[Sprite] = []

        def add(pixels, name, layer, tags=()):
            sprites.append(Sprite(
                pixels=pixels, name=name,
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE,
                layer=layer, tags=list(tags),
            ))

        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                if char == "#":
                    add(wall_pixels(spec["rows"], x, y), f"wall_{x}_{y}", -2, ["wall"])
                elif char in PYLON_CHARS:
                    add(pylon_pixels(PYLON_CHARS.index(char)), f"pylon_{x}_{y}", -1,
                        ["pylon"])
                elif char == "x":
                    add(home_pixels(BODY_A), "goal_a", 0, ["home"])
                elif char == "y":
                    add(home_pixels(BODY_B), "goal_b", 0, ["home"])
                elif char == "a":
                    add(body_pixels(BODY_A), "body_a", 1, ["creature"])
                elif char == "b":
                    add(body_pixels(BODY_B), "body_b", 1, ["creature"])
                else:
                    continue
                sprites[-1].set_position(x * CELL, y * CELL)
        for name, x, y in SIGN_CELLS:
            add(beam(spec["mirror"], LIVE, WALL), name, 2, ["plaque"])
            sprites[-1].set_position(x * CELL, y * CELL)
        for x, y in decor_cells(spec["rows"], index):
            add(flower(0, x + y), f"decor_{x}_{y}", -1, ["decor"])
            sprites[-1].set_position(x * CELL, y * CELL)
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G029(ARCBaseGame):

    REFUSE_FRAMES = 4
    SPARK_FRAMES = 4
    CLEAR_FRAMES = 6

    def __init__(self) -> None:
        self.mirror = LEVELS_SPEC[0]["mirror"]
        self.grid: list[list[str]] = []
        self.a = (0, 0)
        self.b = (0, 0)
        self.goal_a = (0, 0)
        self.goal_b = (0, 0)
        self.face_a = "front"
        self.face_b = "front"
        self._fx = 0
        self._fx_kind = ""
        self._blocked: list[tuple[tuple[int, int], int]] = []
        self._fired: list[tuple[int, int, int]] = []
        self._beat = 0
        self.readout_hue = LIVE
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=EDGE,
        )
        super().__init__(game_id="g029", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.mirror = spec["mirror"]
        self.grid = [list(row) for row in spec["rows"]]
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                if char == "a":
                    self.a = (x, y)
                elif char == "b":
                    self.b = (x, y)
                elif char == "x":
                    self.goal_a = (x, y)
                elif char == "y":
                    self.goal_b = (x, y)
        self._fx = 0
        self._fx_kind = ""
        self._blocked = []
        self._fired = []
        self.readout_hue = LIVE
        self.face_a = self.face_b = "front"
        self._place("body_a", self.a)
        self._place("body_b", self.b)
        self._paint_bodies()
        self._paint_decor()
        self._paint_signs()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _place(self, name: str, cell: tuple[int, int]) -> None:
        found = self.current_level.get_sprites_by_name(name)
        if found:
            found[0].set_position(cell[0] * CELL, cell[1] * CELL)

    def _face(self, name: str, pixels: list[list[int]]) -> None:
        for sprite in self.current_level.get_sprites_by_name(name):
            sprite.pixels[:] = np.array(pixels, dtype=sprite.pixels.dtype)

    def _paint_bodies(self, face_a=None, face_b=None) -> None:
        self._face("body_a", face_a if face_a else body_pixels(BODY_A, self.face_a))
        self._face("body_b", face_b if face_b else body_pixels(BODY_B, self.face_b))

    def _paint_pylon(self, x: int, y: int, mirror: int, spent: bool) -> None:
        self._face(f"pylon_{x}_{y}", pylon_pixels(mirror, spent=spent))

    def _paint_wall(self, x: int, y: int, blush: int | None = None) -> None:
        face = wall_pixels(LEVELS_SPEC[self.level_index]["rows"], x, y)
        if blush is not None:
            face = [[blush if (v >= 0 and (cx + cy) % 2 == 0) else v
                     for cx, v in enumerate(row)] for cy, row in enumerate(face)]
        self._face(f"wall_{x}_{y}", face)

    def _paint_decor(self) -> None:
        for sprite in self.current_level.get_sprites_by_tag("decor"):
            seed = (sprite.x + sprite.y) // CELL
            sprite.pixels[:] = np.array(flower(self._beat, seed), dtype=sprite.pixels.dtype)

    def _paint_signs(self) -> None:
        # The plaques show the glyph of whichever stone was last spent (the level's own at the start).
        for name, _x, _y in SIGN_CELLS:
            self._face(name, beam(self.mirror, self.readout_hue, WALL))

    def _open(self, x: int, y: int) -> bool:
        return 0 <= x < N and 0 <= y < N and self.grid[y][x] != "#"

    def _spend_pylon(self, x: int, y: int) -> int | None:
        char = self.grid[y][x]
        if char not in PYLON_CHARS:
            return None
        which = PYLON_CHARS.index(char)
        self.mirror = which
        self.grid[y][x] = "."
        return which

    def _start_fx(self, kind: str, frames: int) -> None:
        self._fx_kind = kind
        self._fx = frames
        self._paint_fx()

    def _paint_fx(self) -> None:
        lit = self._fx % 2 == 0
        if self._fx_kind == "refuse":
            self._paint_bodies(weave(BODY_A) if lit else None,
                               weave(BODY_B) if lit else None)
            for (x, y), hue in self._blocked:
                self._paint_wall(x, y, hue if lit else None)
        elif self._fx_kind == "spark":
            self.readout_hue = LIVE if lit else SPENT
            for x, y, which in self._fired:
                self._paint_pylon(x, y, which, spent=not lit)
        elif self._fx_kind == "clear":
            self._paint_bodies(medallion(LIVE, BODY_A) if lit else None,
                               medallion(LIVE, BODY_B) if lit else None)

    def _settle(self) -> None:
        kind, self._fx_kind = self._fx_kind, ""
        self.readout_hue = LIVE
        self._paint_bodies()
        for (x, y), _hue in self._blocked:
            self._paint_wall(x, y)
        self._blocked = []
        for x, y, which in self._fired:
            self._paint_pylon(x, y, which, spent=True)
        self._fired = []
        if kind == "clear":
            self.next_level()
        self.complete_action()

    def step(self) -> None:
        # The plaques used to be painted over the finished frame; as sprites they are
        # refreshed after every step instead, from the same mirror and hue.
        self._advance()
        self._paint_signs()

    def _advance(self) -> None:
        self._beat += 1
        self._paint_decor()

        if self._fx:
            self._fx -= 1
            if self._fx:
                self._paint_fx()
            else:
                self._settle()
            return

        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1
        else:
            self.complete_action()
            return

        tdx, tdy = mirror_vector(self.mirror, dx, dy)
        na = (self.a[0] + dx, self.a[1] + dy)
        nb = (self.b[0] + tdx, self.b[1] + tdy)
        if not (self._open(*na) and self._open(*nb)):
            self._blocked = [(cell, hue) for cell, hue in ((na, BODY_A), (nb, BODY_B))
                             if not self._open(*cell)
                             and self.current_level.get_sprites_by_name(
                                 f"wall_{cell[0]}_{cell[1]}")]
            self._start_fx("refuse", self.REFUSE_FRAMES)
            return

        self.a, self.b = na, nb
        # Each creature looks the way it just stepped; a refused step (above) leaves the look alone.
        self.face_a, self.face_b = FACING[(dx, dy)], FACING[(tdx, tdy)]
        self._paint_bodies()
        self._place("body_a", na)
        self._place("body_b", nb)
        for cell in (na, nb):
            which = self._spend_pylon(*cell)
            if which is not None:
                self._fired.append((cell[0], cell[1], which))
        if self.a == self.goal_a and self.b == self.goal_b:
            self._start_fx("clear", self.CLEAR_FRAMES)
            return
        if self._fired:
            self._start_fx("spark", self.SPARK_FRAMES)
            return
        self.complete_action()
