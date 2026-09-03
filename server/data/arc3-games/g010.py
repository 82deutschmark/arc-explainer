# ARC-AGI-3 candidate task g010.

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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def dither(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            if (x + y) % 2:
                frame[y, x] = colour
    return frame

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


SNOW_FILL = 0
FLOOR = 3
WALL = 13
PLAYER = 11
OIL_TILE = 10
SEAL_MARK = 6
GATE_SHUT = 15
GATE_OPEN = 14
BORDER_FILL = 4

WALL_C = "#"
SEAL_C = "ABC"
CAN_C = "o"

W, H = 32, 26
CELL = 2
YOFF = (64 - H * CELL) // 2

CAP = 48
BRIGHT_AT = 17
DIM_AT = 7
LIGHT_R = 2

LIT_OFFSETS = [(dx, dy)
               for dy in range(-LIGHT_R, LIGHT_R + 1)
               for dx in range(-LIGHT_R, LIGHT_R + 1)
               if dx * dx + dy * dy <= LIGHT_R * LIGHT_R]


def radius_for(oil: int) -> int:
    if oil >= BRIGHT_AT:
        return 2
    if oil >= DIM_AT:
        return 1
    return 0


def disc(r: int) -> list[tuple[int, int]]:
    if r == LIGHT_R:
        return LIT_OFFSETS
    return [(dx, dy)
            for dy in range(-r, r + 1)
            for dx in range(-r, r + 1)
            if dx * dx + dy * dy <= r * r]


LEVELS_SPEC = [
    {"rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "#####.o.A#####....#####...C#####",
        "#####...........o.#####....#####",
        "#####P...#####.............#####",
        "#####....#####.B..#####G...#####",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
    {"rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "####....G##############.....####",
        "####.P.........o............####",
        "####.....##############....A####",
        "####.....##############.....####",
        "####.....##############.....####",
        "######.##################.######",
        "######.##################.######",
        "######.##################.######",
        "######o##################o######",
        "######.##################.######",
        "######.##################.######",
        "######.##################.######",
        "######.##################.######",
        "####.....##############.....####",
        "####...........o............####",
        "####C....##############....B####",
        "####.o...##############.....####",
        "####.....##############.....####",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
    {"rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "####......###......###.....A####",
        "####..o...###...o..###......####",
        "####......###......###......####",
        "####......###......###......####",
        "####G.....###......###......####",
        "######.########.########.#######",
        "######.########.########.#######",
        "###P.......o.....o.......o...###",
        "##########.#########.###########",
        "##########.#########.###########",
        "##########.#########.###########",
        "########......####......########",
        "########......####..o...########",
        "########......####......########",
        "########......####......########",
        "########B.....####.....C########",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
    {"rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "###.#.......G###################",
        "###.......#..###################",
        "###A.........###################",
        "###...#....o.....###############",
        "###..........###.###############",
        "###..........###.###############",
        "###P....o...####.###############",
        "################.###############",
        "################o###############",
        "################.###############",
        "################.##o#.......C###",
        "################.##.......#..###",
        "################.##..........###",
        "################...........o.###",
        "###################..........###",
        "###################..........###",
        "###################B.o......####",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
    {"rows": [
        "################################",
        "################################",
        "################################",
        "##P.......G##########........A##",
        "##..#.....o##########..#......##",
        "##.........##########.........##",
        "##.............o.....o........##",
        "##.........##########.........##",
        "##.........##########.........##",
        "##.........##########.........##",
        "######.##################.######",
        "######.##################.######",
        "######o##################o######",
        "######.##################.######",
        "######.##################.######",
        "######.##################.######",
        "##.........##########........o##",
        "##.........##########.......#.##",
        "##.........##########.........##",
        "##.............o..............##",
        "##.o.......##########.........##",
        "##.......#.##########.........##",
        "##C........##########........B##",
        "################################",
        "################################",
        "################################",
    ]},
    {"rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "####A.....o#......o....o...B####",
        "####.......#................####",
        "####..#....#.............#..####",
        "####.......#................####",
        "####.......#................####",
        "####.......#................####",
        "####.......#.........#......####",
        "####o......#.o.P.....#.....o####",
        "####.......#.........#...#..####",
        "####...#...#.........#......####",
        "####.......#.........#......####",
        "####o................#.....o####",
        "####.................#......####",
        "####.................#......####",
        "####.................#......####",
        "####C.......o..o....o#.....G####",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
]


def _find(rows, char):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == char:
                return x, y
    return None


def _find_all(rows, char):
    return [(x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c == char]


def _rock_runs(rows):
    runs = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x] == WALL_C:
                x0 = x
                while x < len(row) and row[x] == WALL_C:
                    x += 1
                runs.append((x0, y, x - x0))
            else:
                x += 1
    return runs


def _rock_px(length):
    return [[WALL] * (length * CELL) for _ in range(CELL)]


def _lamp_px():
    return block(PLAYER, CELL)


def _seal_px():
    return weave(SEAL_MARK, CELL)


def _can_px():
    return [[OIL_TILE, -1] for _ in range(CELL)]


def _gate_px(is_open):
    if not is_open:
        return block(GATE_SHUT, CELL)
    return [[GATE_OPEN if (x + y) % 2 else -1 for x in range(CELL)] for y in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for x0, y, length in _rock_runs(rows):
            sprites.append(Sprite(
                pixels=_rock_px(length), name=f"rock_{x0}_{y}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=-1,
            ).set_position(x0 * CELL, y * CELL))
        for char in SEAL_C:
            pos = _find(rows, char)
            if pos is None:
                continue
            sprites.append(Sprite(
                pixels=_seal_px(), name=f"seal_{char}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["seal", f"seal_{char}"], collidable=False,
            ).set_position(pos[0] * CELL, pos[1] * CELL))
        for i, (x, y) in enumerate(_find_all(rows, CAN_C)):
            sprites.append(Sprite(
                pixels=_can_px(), name=f"can_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["can"], collidable=False,
            ).set_position(x * CELL, y * CELL))
        gx, gy = _find(rows, "G")
        sprites.append(Sprite(
            pixels=_gate_px(False), name="gate",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0, tags=["gate"],
        ).set_position(gx * CELL, gy * CELL))
        px, py = _find(rows, "P")
        sprites.append(Sprite(
            pixels=_lamp_px(), name="lamp",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(W * CELL, H * CELL)))
    return levels


class G010A(RenderableUserDisplay):

    def __init__(self, game: "G010") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        out = frame.copy()
        out[YOFF:YOFF + H * CELL, :] = SNOW_FILL
        cx, cy = self._game.player_cell()
        for dx, dy in self._game.lit_offsets():
            x, y = cx + dx, cy + dy
            if 0 <= x < W and 0 <= y < H:
                y0, x0 = YOFF + y * CELL, x * CELL
                out[y0:y0 + CELL, x0:x0 + CELL] = frame[y0:y0 + CELL, x0:x0 + CELL]
        return out


class G010B(RenderableUserDisplay):

    PAD = 2
    PIP = 4
    PIP_GAP = 6

    def __init__(self, game: "G010") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape
        top, bottom = YOFF, YOFF + H * CELL
        frame[:top, :] = BORDER_FILL
        frame[bottom:, :] = BORDER_FILL

        oil = min(max(0, self._game.oil), CAP)
        span = w - 2 * self.PAD
        fill = int(round(span * oil / CAP))
        if oil and not fill:
            fill = 1
        r = radius_for(oil)
        if fill and (r or blink(oil, 1)):
            box = (self.PAD, 1, self.PAD + fill, top - 1)
            frame[1:top - 1, self.PAD:self.PAD + fill] = PLAYER
            if r < LIGHT_R:
                dither(frame, box, BORDER_FILL)

        y0 = bottom + (h - bottom - self.PIP) // 2
        for i in range(len(self._game.held)):
            x0 = self.PAD + i * self.PIP_GAP
            frame[y0:y0 + self.PIP, x0:x0 + self.PIP] = SEAL_MARK
        return frame


class G010(ARCBaseGame):

    GUTTER_FRAMES = 4
    BLOOM_FRAMES = 4
    TAKE_FRAMES = 4

    def __init__(self) -> None:
        self.oil = CAP
        self.held: set[str] = set()
        self.gutter = 0
        self.bloom = 0
        self.taking = 0
        camera = Camera(
            width=W * CELL, height=H * CELL,
            background=FLOOR, letter_box=BORDER_FILL,
            interfaces=[G010A(self), G010B(self)],
        )
        super().__init__(game_id="g010", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])

    def player_cell(self) -> tuple[int, int]:
        lamp = self.current_level.get_sprites_by_name("lamp")
        if not lamp:
            return 0, 0
        return lamp[0].x // CELL, lamp[0].y // CELL

    def light_radius(self) -> int:
        if self.gutter:
            return min(radius_for(self.oil), self.gutter - 1)
        if self.bloom:
            return LIGHT_R + (self.BLOOM_FRAMES - self.bloom)
        return radius_for(self.oil)

    def lit_offsets(self) -> list[tuple[int, int]]:
        return disc(self.light_radius())

    def on_set_level(self, level: Level) -> None:
        self.oil = CAP
        self.held = set()
        self.gutter = 0
        self.bloom = 0
        self.taking = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _take(self) -> bool:
        cx, cy = self.player_cell()
        took = False
        for char in SEAL_C:
            if char in self.held:
                continue
            found = self.current_level.get_sprites_by_name(f"seal_{char}")
            if found and (found[0].x // CELL, found[0].y // CELL) == (cx, cy):
                self.held.add(char)
                self.current_level.remove_sprite(found[0])
                took = True
                if len(self.held) == len(SEAL_C):
                    gate = self.current_level.get_sprites_by_name("gate")
                    if gate:
                        gate[0].pixels[:] = np.array(_gate_px(True), dtype=np.int8)
        for can in list(self.current_level.get_sprites_by_tag("can")):
            if (can.x // CELL, can.y // CELL) == (cx, cy):
                self.oil = CAP
                self.current_level.remove_sprite(can)
                took = True
        return took

    def step(self) -> None:
        if self.gutter:
            self.gutter -= 1
            if self.gutter == 0:
                self.level_reset()
                self.complete_action()
            return
        if self.bloom:
            self.bloom -= 1
            if self.bloom == 0:
                self.next_level()
                self.complete_action()
            return
        if self.taking:
            self.taking -= 1
            if self.taking == 0:
                self.complete_action()
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

        self.oil -= 1
        hits = self.try_move("lamp", dx * CELL, dy * CELL)
        if any("gate" in s.tags for s in hits) and len(self.held) == len(SEAL_C):
            self.bloom = self.BLOOM_FRAMES
            return
        took = self._take()
        if self.oil <= 0:
            self.gutter = self.GUTTER_FRAMES
            return
        if took:
            self.taking = self.TAKE_FRAMES
            return
        self.complete_action()
