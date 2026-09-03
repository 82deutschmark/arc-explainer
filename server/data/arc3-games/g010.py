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


FLOOR = 5
WALL = 1
DARK = 5
PLAYER = 12
SINK_SHUT = 9
SINK_OPEN = 14
TOKEN = 6
TOKEN_COLOURS = {"A": TOKEN, "B": TOKEN, "C": TOKEN}
MOTE = WALL
METER_TRACK = WALL
METER_FILL = PLAYER

LEVELS_SPEC = [
    {"budget": 254, "rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "#########.......#.....##########",
        "###############.#.#..###########",
        "#########..B....#.#...##########",
        "#########..#.##.#P#...##########",
        "#########.........#.#.##########",
        "#########.###..##.#.#C##########",
        "#########.......#.....##########",
        "##########..##..##.##.##########",
        "#########...........#.##########",
        "#########..#....#.....##########",
        "#########.....#.#...#.##########",
        "#########G...####...#.##########",
        "#########.#...A...#...##########",
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
    {"budget": 612, "rows": [
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "#####.#.....#.....#...#...######",
        "#####.###B#.###.#.#...#.#.######",
        "#####.#...#.......#.#.....######",
        "#####.#..##.##.##.###.#.#.######",
        "#####.......#...#P......#.######",
        "#####.#.#.#...#.#.#.##.##.######",
        "#####.......#.#...........######",
        "#########.#.#.###.#...#...######",
        "#####.......#...........#.######",
        "#####...#.#.#####.#.#.#.#.######",
        "#####.#...........#.......######",
        "#####.##....#.#.#...##.##.######",
        "#####.....#.....#.........######",
        "#######.#.#.#.####.####.#.######",
        "#####...#.................######",
        "#####...##....###.###..##.######",
        "#####.#.#.................######",
        "#####.#A#.#.#####..##...#.######",
        "#####...#.#.#.............######",
        "#######G..#.#.##.###############",
        "#####...#...............C.######",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
    {"budget": 770, "rows": [
        "################################",
        "################################",
        "################################",
        "###C#.................#.....####",
        "###...######.######.....##..####",
        "###.#.............#P#.#.#...####",
        "###.###.#.######..#.###.#.#.####",
        "###...#...#.......#.......#.####",
        "#####.#####.#..##.#.###.#...####",
        "###.#.......#...#.....#.....####",
        "###.######..###...##..#.###.####",
        "###.........#...#.....#.....####",
        "###.#####...#.#.#.#####.###.####",
        "###.#.#...#...#...#.....#.#.####",
        "###...#.#.###.#.###.#.#.#.#.####",
        "###...#.#.#.....#...#...#...####",
        "###.#.#...#.##..#.###.###.######",
        "###...#.#.#..B..............####",
        "#####.#.#...##..#####.#.#.#.####",
        "###...#...#.........#.#.....####",
        "###.###.###.#######.###.#.#.####",
        "###.#.#.......#.........#...####",
        "###...#.#.#.#.#.##.#..#####.####",
        "###...........#.#.......#...####",
        "###.....#.###...#.#.###...######",
        "###...........#...#.#.....#.####",
        "###.###.#.#.#...###.#.###.#.####",
        "###G......#.#.A.....#.......####",
        "################################",
        "################################",
        "################################",
        "################################",
    ]},
    {"budget": 944, "rows": [
        "################################",
        "#...#...#.........#.......#...##",
        "###.#.#.###.###.#.#.#.###.#.#.##",
        "#.#...#.#....P..#.#...#.......##",
        "#.....#.#..##.#.#.###.#.#####.##",
        "#.....#.#...........#.#.....#.##",
        "#.###...###.#######...#.###.#.##",
        "#...........#...........#.....##",
        "#.#.###.###...###.#.###.#.#.#.##",
        "#.#.......#.#...#...#...#.#.#.##",
        "#.#.###.#.###.#.##.##.#.#.###.##",
        "#.#.......#...#.....#.#...#...##",
        "#.##.#..###.###.#.#.#.#...#.####",
        "#.#.....#...#...#.#...#...#...##",
        "#.#.#.###.###.#.#.##..#######.##",
        "#...#.#...#.......#...#.......##",
        "#.#.###.#.#.#.....#.#.#.#####.##",
        "#.#.......#.#.#.#...#.#.#.#...##",
        "#.####.##...#.#.###...#.#.#.####",
        "#.......#...#.......#.#.#...#.##",
        "######..###.#.#######.#.#.###A##",
        "#.........#.........#.#.#.....##",
        "#.#.###...#..##.#####.#.########",
        "#.#.#...B.....#.......#...#...##",
        "#.#.#...###.#.#.#.#.#####...#.##",
        "#...#.#...#...#.........#...#.##",
        "#.#.#.#.#.#.#####..########.#.##",
        "#.....#.#...#..........C..#...##",
        "#.#####.#.#.#...#####.##..#.#.##",
        "#.....#.........#...........G.##",
        "################################",
        "################################",
    ]},
    {"budget": 902, "rows": [
        "################################",
        "#.#.................#.........##",
        "#.###.##.########.#.###.#####.##",
        "#.#...#.....#.....#.....#.....##",
        "#...###...#.##..#.###.#.#.######",
        "#.#.....#..C#.....#.#.#.#.....##",
        "#.#.#.#.###.#.###...#.#.#####.##",
        "#...#.#...#...#...#.#.#.#...#.##",
        "###.#.#.#.###.#.###.#.###.#.#.##",
        "#.....#.#.....#.....#.B...#.#.##",
        "#.##..#.#####.#.#...#######.#.##",
        "#.#.....#.........#.#.......#.##",
        "#.#.#####.######.##.#.#.#.#.#.##",
        "#...#.#...#.#.......#.#.......##",
        "#.###.#.###.#.###.###...#####.##",
        "#...#.#...#...#.#...#.#.......##",
        "###...###.###.#.#.#.#.#.#.#.####",
        "#A..#...#...#.#.#.....#.#.....##",
        "#.#.#.#####.#...#.#.#######...##",
        "#.#.#.#.........#...........#.##",
        "#.#...#.###...###.#.###.###.#.##",
        "#...#.#...#...#...#...#.#...#.##",
        "#.###.###.#####.#####.#.#.###.##",
        "#.......#...#...#.....#...#...##",
        "#.#####.###.#.###.#####.###.#.##",
        "#.......#.#.#...#.#...#.#...#.##",
        "#####.#.#.#.###.....#.#.#####.##",
        "#.....#G#.#...#.#.#.#.......#.##",
        "#.#.###.#.#..##..P#.#..####.#.##",
        "#.#.......#.......#.#.........##",
        "################################",
        "################################",
    ]},
    {"budget": 839, "rows": [
        "################################",
        "#.#...........C.#.....#.......##",
        "#.#.####.##.#####.###.#.#.#.#.##",
        "#...........#.....#.......#.#.##",
        "###.#.#######.#####.#######.#.##",
        "#.#.#.#.......#.........#...#.##",
        "#.#.#.#.#######.###.##..#.###.##",
        "#...#...........#...#...#...#.##",
        "#.###.###.#.#.#######.#.###.#.##",
        "#...#.#...#.#.#.......#.......##",
        "###.###.#.....#.#.###.#.########",
        "#.#B..#...#...#.#.#...#.#.....##",
        "#.###.#.#.#####.###.#.###.##..##",
        "#...#.#.......#.....#.........##",
        "#.#.#.#.#####.#.##.########.#.##",
        "#.....#...#...#.........#.....##",
        "#...#####.#.###.#######.#.#.#.##",
        "#.....#...#.A.#.#..G......#.#.##",
        "#####...#.###.#.#.###.#.###.#.##",
        "#...#...#...#.#.#...P.#.......##",
        "###.#####.###.#.#.#.#.#.###.####",
        "#...#...#.....#.#.#.#.#.#...#.##",
        "#.###.#.#.#####.#.###.#.#...#.##",
        "#.#...#...#...#.....#.#...#.#.##",
        "#.#.#######.#.#.#.#.#.#..##.#.##",
        "#.#.#...........#.#.#.....#...##",
        "#.#.#.#######.#.###.#####.###.##",
        "#.#...#.#...........#.....#...##",
        "#.#####.#.#######.###..####.####",
        "#.................#...........##",
        "################################",
        "################################",
    ]},
    {"budget": 812, "rows": [
        "################################",
        "#.....#.........#.....#...#...##",
        "##.##.#.#.#######.#.#.#...###.##",
        "#...#.#.#.........#.#...#...B.##",
        "#.#.#.#.###########.#.#######.##",
        "#.#.#.#...........#.#.......#.##",
        "###...#.#####.#####.#.##.####.##",
        "#...#.#.#...#.#...#.#.........##",
        "#.###.#.#.#.#.#.#.#.#.##########",
        "#.#...#.#.#...#.#...#.#.......##",
        "#...###.#.###.#.#####.###.#...##",
        "#.#...#.#...#...#...#...#.#.#.##",
        "#.###.#.###.#####.###.#.###.#.##",
        "#...#.#...#...#.#.....#.....#.##",
        "#.#.#.#######.#.#.###.#######.##",
        "#...#.........#.#.#.#...#.....##",
        "#.#############.#.#.###.#.######",
        "#.....#...#...#...#...#.#.#...##",
        "###...#...#.#.#.#####.#.#.#.#.##",
        "#...#.#.#.#.#.#.......#...#.#.##",
        "#.###.###.#...#.#.#.#######.#.##",
        "#.#.......#.#.#.#.#.........#.##",
        "#.###.#.###.#.#.#####.#.########",
        "#.............#.....#.#.#.....##",
        "#.######.####.#.#.#.#.#.#.###.##",
        "#.....#.P.#.#...#.#.......#.C.##",
        "#####.#.#...#####.###.#####.####",
        "#.....#.#.#...#...#A#.....#...##",
        "#.##.##G#.#.#.#.###.#####.###.##",
        "#.......#...#...#.............##",
        "################################",
        "################################",
    ]},
    {"budget": 752, "rows": [
        "################################",
        "#...#.#.......................##",
        "###.#.#.#####################.##",
        "#...#...#...#...............#.##",
        "#.###.###.#.#######.#.#.###...##",
        "#...#.#...#...#...#.#.#.#...#.##",
        "#.#.#.###.###.#.#.#C#.#.#.#.#.##",
        "#.#.....#...#...#.#.#.#.#.#...##",
        "#.###.#.#.#.###.#.#.#.###.###.##",
        "#.....#.....#.#...#.#...#.B.#.##",
        "#####.##..#.#.#.###.###.###.#.##",
        "#...#.#.....#.#.#.....#...#.#.##",
        "#.###.#######.#.#######.#.#.####",
        "#...#.#...#.....#.......#.#...##",
        "###.#.#.#.#####.#.###.######..##",
        "#...#.#.#.....#...#...#.......##",
        "#..##.#.#####.#####.#.#.####.###",
        "#...#...#...#.#.......#.......##",
        "#P#.###.#...#.#.#############.##",
        "#.#...#...#...#.....#......A..##",
        "#.###.#.###########.#.#######.##",
        "#...#.#.#...G.......#...#...#.##",
        "###.#.#.#.#########.###.#.#.#.##",
        "#.#.#.#.#...#.....#...#.#.#.#.##",
        "#.#.#.#.###.#.###.#####.#.#.#.##",
        "#...#...#...#...#.......#.#...##",
        "#.#.###########.#########.######",
        "#...#.....#...#.........#.....##",
        "#.###.###.#.#.#########.#####.##",
        "#.....#.....#...........#.....##",
        "################################",
        "################################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 2
LIGHT_R = 2
LIT_OFFSETS = [(dx, dy)
               for dy in range(-LIGHT_R, LIGHT_R + 1)
               for dx in range(-LIGHT_R, LIGHT_R + 1)
               if dx * dx + dy * dy <= LIGHT_R * LIGHT_R]


def _find(rows, char):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == char:
                return x, y
    return None


def _wall_runs(rows):
    runs = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x] == "#":
                x0 = x
                while x < len(row) and row[x] == "#":
                    x += 1
                runs.append((x0, y, x - x0))
            else:
                x += 1
    return runs


def _wall_px(length):
    return [[WALL] * (length * CELL) for _ in range(CELL)]


def _token_px():
    return weave(TOKEN, CELL)


def _sink_px(is_open):
    return weave(SINK_OPEN, CELL) if is_open else block(SINK_SHUT, CELL)


def _player_px():
    return block(PLAYER, CELL)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for x0, y, length in _wall_runs(rows):
            sprites.append(Sprite(
                pixels=_wall_px(length), name=f"wall_{x0}_{y}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=-1,
            ).set_position(x0 * CELL, y * CELL))
        for char in TOKEN_COLOURS:
            pos = _find(rows, char)
            if pos is None:
                continue
            sprites.append(Sprite(
                pixels=_token_px(), name=f"token_{char}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["token", f"token_{char}"], collidable=False,
            ).set_position(pos[0] * CELL, pos[1] * CELL))
        gx, gy = _find(rows, "G")
        sprites.append(Sprite(
            pixels=_sink_px(False), name="sink",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0, tags=["sink"],
        ).set_position(gx * CELL, gy * CELL))
        px, py = _find(rows, "P")
        sprites.append(Sprite(
            pixels=_player_px(), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G010A(RenderableUserDisplay):

    def __init__(self, game: "G010") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        cx, cy = self._game.player_cell()
        out = np.full_like(frame, DARK)
        for dx, dy in self._game.lit_offsets():
            x, y = cx + dx, cy + dy
            if 0 <= x < N and 0 <= y < N:
                cell = frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
                out[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = cell
                if np.all(cell == FLOOR):
                    out[(y + 1) * CELL - 1, (x + 1) * CELL - 1] = MOTE
        return out


class G010B(RenderableUserDisplay):

    TOKEN_MARKS = ((1, 0), (1, 1), (0, 1))
    MARGIN = 8

    def __init__(self, game: "G010") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape
        total = max(1, self._game.level_budget)
        left = min(max(0, self._game.budget), total)
        half = int(round((w // 2 - self.MARGIN) * left / total))
        if left and not half:
            half = 1
        frame[h - CELL:, :] = METER_TRACK
        if half:
            frame[h - CELL:, w // 2 - half:w // 2 + half] = METER_FILL
            if left * 8 <= total:
                dither(frame, (w // 2 - half, h - CELL, w // 2 + half, h), METER_TRACK)

        cx, cy = self._game.player_cell()
        x0, y0 = cx * CELL, cy * CELL
        if self._game.taking and blink(self._game.taking, 1):
            frame[y0:y0 + CELL, x0:x0 + CELL] = TOKEN
        else:
            for i in range(len(self._game.held)):
                dy, dx = self.TOKEN_MARKS[i]
                frame[y0 + dy, x0 + dx] = TOKEN
        return frame


class G010(ARCBaseGame):

    GUTTER_FRAMES = 4
    BLOOM_FRAMES = 4
    TAKE_FRAMES = 4

    def __init__(self) -> None:
        self.budget = LEVELS_SPEC[0]["budget"]
        self.level_budget = LEVELS_SPEC[0]["budget"]
        self.held: set[str] = set()
        self.gutter = 0
        self.bloom = 0
        self.taking = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=DARK,
            interfaces=[G010A(self), G010B(self)],
        )
        super().__init__(game_id="g010", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])

    def player_cell(self) -> tuple[int, int]:
        player = self.current_level.get_sprites_by_name("player")
        if not player:
            return 0, 0
        return player[0].x // CELL, player[0].y // CELL

    def light_radius(self) -> int:
        if self.gutter:
            return min(LIGHT_R, self.gutter - 1)
        if self.bloom:
            return LIGHT_R + (self.BLOOM_FRAMES - self.bloom)
        return LIGHT_R

    def lit_offsets(self) -> list[tuple[int, int]]:
        r = self.light_radius()
        if r == LIGHT_R:
            return LIT_OFFSETS
        return [(dx, dy)
                for dy in range(-r, r + 1)
                for dx in range(-r, r + 1)
                if dx * dx + dy * dy <= r * r]

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.budget = spec["budget"]
        self.level_budget = spec["budget"]
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

    def _take_tokens(self) -> bool:
        cx, cy = self.player_cell()
        took = False
        for char in "ABC":
            if char in self.held:
                continue
            found = self.current_level.get_sprites_by_name(f"token_{char}")
            if found and (found[0].x // CELL, found[0].y // CELL) == (cx, cy):
                self.held.add(char)
                self.current_level.remove_sprite(found[0])
                took = True
                if len(self.held) == 3:
                    sink = self.current_level.get_sprites_by_name("sink")
                    if sink:
                        sink[0].pixels[:] = np.array(_sink_px(True), dtype=np.int8)
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

        self.budget -= 1
        hits = self.try_move("player", dx * CELL, dy * CELL)
        if any("sink" in s.tags for s in hits) and len(self.held) == 3:
            self.bloom = self.BLOOM_FRAMES
            return
        took = self._take_tokens()
        if self.budget <= 0:
            self.gutter = self.GUTTER_FRAMES
            return
        if took:
            self.taking = self.TAKE_FRAMES
            return
        self.complete_action()
