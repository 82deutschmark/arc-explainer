# ARC-AGI-3 candidate task g008.

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

WALL = 5
NEUTRAL = 4
RED = 8
BLUE = 9
EXIT_CORE = 14
AVATAR_EDGE = 0
PIP_ON = 11
PIP_OFF = 3

SKIN_COLOUR = {"r": RED, "b": BLUE}
SWAP_COOLDOWN = 4

LEVELS_SPEC = [
    {"skin": "r", "swaps": 0, "rows": [
        "################",
        "#bbbbbbbbbbbbbb#",
        "#PrrrrrrrrrrrrR#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "################",
    ]},
    {"skin": "r", "swaps": 1, "rows": [
        "################",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rPrrrr.bbbbbbB#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "#rrrrrr.bbbbbbb#",
        "################",
    ]},
    {"skin": "r", "swaps": 2, "rows": [
        "################",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rPrr.bbbb.rrrR#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "#rrrr.bbbb.rrrr#",
        "################",
    ]},
    {"skin": "b", "swaps": 2, "rows": [
        "################",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbb.r.bbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bPbbbbbrbbbbbB#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "#bbbbbbbrbbbbbb#",
        "################",
    ]},
    {"skin": "r", "swaps": 3, "rows": [
        "################",
        "#rrrrbbbrrrrbbb#",
        "#rrr.bbb.rrr.bb#",
        "#rrr.bbb.rrr.bb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rPrrbbbrrrrbbB#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "#rrrrbbbrrrrbbb#",
        "################",
    ]},
    {"skin": "b", "swaps": 2, "rows": [
        "################",
        "#bbbbbbbbbbbbbb#",
        "#bPbbbbbbbbbbbb#",
        "#bbbbbbbbbbb.bb#",
        "#rrrrrrrrrrr.rr#",
        "#rrrrrrrrrrrrrr#",
        "#rrrrrrrrrrrrrr#",
        "#rrrrrrrrrrrrrr#",
        "#rrrrrrrrrrrrrr#",
        "#rrrrrrrrrrrrrr#",
        "#r.rrrrrrrrrrrr#",
        "#b.bbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbbbb#",
        "#bbbbbbbbbbbBbb#",
        "################",
    ]},
    {"skin": "r", "swaps": 4, "rows": [
        "################",
        "#rr.bb.rr.bb.rr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#Prrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbrr#",
        "#rrrbbbrrrbbbRr#",
        "################",
    ]},
]

N = 16
CELL = 4

OPEN_TO_BOTH = ".P"


def passable(ch: str, skin: str) -> bool:
    if ch == "#":
        return False
    if ch in OPEN_TO_BOTH:
        return True
    if ch in ("r", "R"):
        return skin == "r"
    if ch in ("b", "B"):
        return skin == "b"
    return False


def swap_legal(ch: str, cooldown: int) -> bool:
    return cooldown == 0 and ch in OPEN_TO_BOTH


def find_start(rows) -> tuple[int, int]:
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                return x, y
    raise AssertionError("board has no start cell")


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _exit_block(colour: int) -> list[list[int]]:
    block = _solid(colour)
    for dy in (1, 2):
        for dx in (1, 2):
            block[dy][dx] = EXIT_CORE
    return block


def _avatar_block(skin: str) -> list[list[int]]:
    block = _solid(AVATAR_EDGE)
    for dy in (1, 2):
        for dx in (1, 2):
            block[dy][dx] = SKIN_COLOUR[skin]
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                pixels = None
                if ch == "#":
                    pixels = _solid(WALL)
                elif ch == "r":
                    pixels = _solid(RED)
                elif ch == "b":
                    pixels = _solid(BLUE)
                elif ch == "R":
                    pixels = _exit_block(RED)
                elif ch == "B":
                    pixels = _exit_block(BLUE)
                if pixels is not None:
                    sprites.append(Sprite(
                        pixels=pixels, name=f"cell_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                    ).set_position(px, py))
        sx, sy = find_start(spec["rows"])
        sprites.append(Sprite(
            pixels=_avatar_block(spec["skin"]), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G008A(RenderableUserDisplay):

    def __init__(self, game: "G008") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        frame[1:3, 1:3] = SKIN_COLOUR[self._game.skin]
        for i in range(SWAP_COOLDOWN):
            x = 6 + i * 3
            frame[1:3, x:x + 2] = PIP_ON if i < self._game.cooldown else PIP_OFF
        return frame


class G008(ARCBaseGame):

    def __init__(self) -> None:
        self.skin = LEVELS_SPEC[0]["skin"]
        self.cooldown = 0
        self.px, self.py = find_start(LEVELS_SPEC[0]["rows"])
        self.grid = [list(r) for r in LEVELS_SPEC[0]["rows"]]
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=NEUTRAL, letter_box=WALL,
            interfaces=[G008A(self)],
        )
        super().__init__(game_id="g008", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.grid = [list(r) for r in spec["rows"]]
        self.px, self.py = find_start(spec["rows"])
        self.skin = spec["skin"]
        self.cooldown = 0
        self._repaint()

    def _player(self) -> Sprite | None:
        found = self.current_level.get_sprites_by_name("player")
        return found[0] if found else None

    def _repaint(self) -> None:
        sprite = self._player()
        if sprite is None:
            return
        sprite.pixels[:, :] = np.array(_avatar_block(self.skin), dtype=sprite.pixels.dtype)
        sprite.set_position(self.px * CELL, self.py * CELL)

    def _swap(self) -> None:
        if not swap_legal(self.grid[self.py][self.px], self.cooldown):
            return
        self.skin = "b" if self.skin == "r" else "r"
        self.cooldown = SWAP_COOLDOWN
        self._repaint()

    def _walk(self, dx: int, dy: int) -> None:
        nx, ny = self.px + dx, self.py + dy
        if not (0 <= nx < N and 0 <= ny < N):
            return
        ch = self.grid[ny][nx]
        if not passable(ch, self.skin):
            return
        self.px, self.py = nx, ny
        self._repaint()
        if self.cooldown:
            self.cooldown -= 1
        if ch in ("R", "B"):
            if self.is_last_level():
                self.next_level()
            else:
                self.next_level()

    def step(self) -> None:
        action = self.action.id
        if action == GameAction.ACTION1:
            self._walk(0, -1)
        elif action == GameAction.ACTION2:
            self._walk(0, 1)
        elif action == GameAction.ACTION3:
            self._walk(-1, 0)
        elif action == GameAction.ACTION4:
            self._walk(1, 0)
        elif action == GameAction.ACTION5:
            self._swap()
        self.complete_action()
