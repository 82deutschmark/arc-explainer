# ARC-AGI-3 candidate task t715ea045.

from collections import deque

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

SMOKE = 2
TILE = 5
BLOCK = 0
FIRE = 8
GATE = 10
AVATAR = 6
BORDER = 13
BAR = 15
BAR_SPENT = 5

FRAME = 64
N = 20
CELL = 3
OX = 1
OY = 2
GUTTER = OX + N * CELL
FLASH_REACH = 5

OPEN_CHARS = ".PX"
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))


def pulse_reveal(rows, sx, sy, reach=FLASH_REACH):
    learned = {(sx, sy)}
    seen = {(sx, sy)}
    queue = deque([(sx, sy, 0)])
    while queue:
        x, y, dist = queue.popleft()
        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < len(rows[0]) and 0 <= ny < len(rows)):
                continue
            if rows[ny][nx] in OPEN_CHARS:
                if dist + 1 <= reach and (nx, ny) not in seen:
                    seen.add((nx, ny))
                    learned.add((nx, ny))
                    queue.append((nx, ny, dist + 1))
            else:
                learned.add((nx, ny))
    return learned


def walkable_from(rows, known, start):
    if start not in known:
        return set()
    reached = {start}
    queue = deque([start])
    while queue:
        x, y = queue.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if n in reached or n not in known:
                continue
            if not (0 <= n[0] < len(rows[0]) and 0 <= n[1] < len(rows)):
                continue
            if rows[n[1]][n[0]] not in OPEN_CHARS:
                continue
            reached.add(n)
            queue.append(n)
    return reached


LEVELS_SPEC = [
    {"charges": 2, "rows": [
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "#######......#######",
        "#######......#######",
        "#######..P...#######",
        "#######......#######",
        "#######.....X#######",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ]},
    {"charges": 3, "rows": [
        "####################",
        "####################",
        "##.....#.........###",
        "##.....#.........###",
        "##..P............###",
        "##.....#.........###",
        "##.....#....X....###",
        "########.........###",
        "########.........###",
        "########.........###",
        "########.........###",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ]},
    {"charges": 4, "rows": [
        "####################",
        "####################",
        "##.......#........##",
        "##.P.....#........##",
        "##.......#........##",
        "##.......#....f...##",
        "##.......f........##",
        "##................##",
        "##.......f........##",
        "##.......#..X.....##",
        "##.......#.f......##",
        "##.......#........##",
        "##.......#........##",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ]},
    {"charges": 3, "rows": [
        "####################",
        "####################",
        "##P#################",
        "##.#################",
        "##.#################",
        "##.#################",
        "##.#################",
        "##.f..............##",
        "##...........f....##",
        "##...f....X.......##",
        "##................##",
        "##......f.........##",
        "##................##",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ]},
    {"charges": 4, "rows": [
        "####################",
        "####################",
        "##.......#........##",
        "##.......#........##",
        "##..P.............##",
        "##.......#........##",
        "##.......#........##",
        "###f.f####........##",
        "##.......#........##",
        "##.......###########",
        "##.......#........##",
        "##................##",
        "##.......#..f.....##",
        "##.......#........##",
        "##########....X...##",
        "##########........##",
        "##########.....f..##",
        "##########........##",
        "####################",
        "####################",
    ]},
    {"charges": 5, "rows": [
        "####################",
        "####################",
        "##.....#.....#....##",
        "##.P..f#.....#....##",
        "##................##",
        "##.....#f....#....##",
        "##.....#...f.#....##",
        "####.#####.#########",
        "##.....#...f.#....##",
        "##.....#.....#....##",
        "##..f..#..........##",
        "##.....#....f#....##",
        "##.....#.....#..f.##",
        "####.##########.####",
        "##.....#.....#....##",
        "##.....#......X...##",
        "##........f..#....##",
        "##.....#.....#....##",
        "####################",
        "####################",
    ]},
]


def _cell_block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = OX + x * CELL, OY + y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_cell_block(BLOCK), name=f"masonry_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif char == "f":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIRE), name=f"fire_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["fire"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_cell_block(GATE), name="gate",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["gate"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_cell_block(AVATAR), name="avatar",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(FRAME, FRAME)))
    return levels


class G87b4c1e0(RenderableUserDisplay):

    def __init__(self, game: "Ge05b1417") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        out = np.full_like(frame, BORDER)
        out[OY:OY + N * CELL, OX:OX + N * CELL] = SMOKE
        for x, y in self._game.known:
            if 0 <= x < N and 0 <= y < N:
                out[OY + y * CELL:OY + (y + 1) * CELL,
                    OX + x * CELL:OX + (x + 1) * CELL] = \
                    frame[OY + y * CELL:OY + (y + 1) * CELL,
                          OX + x * CELL:OX + (x + 1) * CELL]
        px, py = self._game.avatar_cell()
        out[OY + py * CELL:OY + (py + 1) * CELL,
            OX + px * CELL:OX + (px + 1) * CELL] = AVATAR
        return out


class Gd5b9d306(RenderableUserDisplay):

    def __init__(self, game: "Ge05b1417") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        total = self._game.level_charges
        left = self._game.charges
        for i in range(total):
            top = OY + i * (CELL + 1)
            if top + CELL > FRAME or GUTTER + CELL > FRAME:
                break
            frame[top:top + CELL, GUTTER:GUTTER + CELL] = BAR if i < left else BAR_SPENT
        return frame


class Ge05b1417(ARCBaseGame):

    def __init__(self) -> None:
        self.charges = LEVELS_SPEC[0]["charges"]
        self.level_charges = LEVELS_SPEC[0]["charges"]
        self.known: set[tuple[int, int]] = set()
        camera = Camera(
            width=FRAME, height=FRAME,
            background=TILE, letter_box=BORDER,
            interfaces=[G87b4c1e0(self), Gd5b9d306(self)],
        )
        super().__init__(game_id="t715ea045", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def avatar_cell(self) -> tuple[int, int]:
        avatar = self.current_level.get_sprites_by_name("avatar")
        if not avatar:
            return 0, 0
        return (avatar[0].x - OX) // CELL, (avatar[0].y - OY) // CELL

    def gate_cell(self) -> tuple[int, int]:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        for y, row in enumerate(rows):
            x = row.find("X")
            if x >= 0:
                return x, y
        raise AssertionError("board has no gate")

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.charges = spec["charges"]
        self.level_charges = spec["charges"]
        self.known = set()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _flash(self) -> None:
        if self.charges <= 0:
            return
        self.charges -= 1
        rows = LEVELS_SPEC[self.level_index]["rows"]
        self.known |= pulse_reveal(rows, *self.avatar_cell())
        if self.charges == 0 and not self._gate_still_winnable():
            self.level_reset()

    def _gate_still_winnable(self) -> bool:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        gate = self.gate_cell()
        if gate not in self.known:
            return False
        return gate in walkable_from(rows, self.known, self.avatar_cell())

    def step(self) -> None:
        if self.action.id == GameAction.ACTION5:
            self._flash()
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

        hits = self.try_move("avatar", dx * CELL, dy * CELL)
        if any("fire" in s.tags for s in hits):
            self.level_reset()
        elif any("gate" in s.tags for s in hits):
            self.next_level()
        self.complete_action()
