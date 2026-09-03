# ARC-AGI-3 candidate task g024.

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

FLOOR = 1
WALL = 13
PAD = 14
EXIT = 15
EXIT_PIP = 5
PLAYER = 8
MARK = 0

TOKEN_COLOUR = {"D": 9, "T": 11, "F": 8, "L": 15}
TOKEN_MARKS = {
    "D": ((1, 1), (2, 1), (1, 2), (2, 2)),
    "T": ((1, 1), (1, 2), (2, 2)),
    "F": ((1, 1), (2, 1)),
    "L": ((1, 1), (2, 2)),
}

N = 16
CELL = 4
MAX_CARRY = 4
SLIDE_BUDGET = 96

UP, DOWN, LEFT, RIGHT = (0, -1), (0, 1), (-1, 0), (1, 0)


def _cw(d):
    return (-d[1], d[0])


LEVELS_SPEC = [
    {"need": 1, "rows": [
        "################",
        "#S.D..........##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#..........X..##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"need": 1, "rows": [
        "################",
        "#..D.........S##",
        "#.##############",
        "#.##############",
        "#.##############",
        "#.............X#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"need": 1, "rows": [
        "################",
        "#S..L.........##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#X............##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"need": 1, "rows": [
        "################",
        "#S..T.........##",
        "#############.##",
        "#.###########.##",
        "#.###########.##",
        "#.###########.##",
        "#.............##",
        "#.##############",
        "#X##############",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"need": 1, "rows": [
        "################",
        "#S...D.........#",
        "##############.#",
        "##############.#",
        "#...........o..#",
        "#.##############",
        "#.##############",
        "#.....F........#",
        "##############.#",
        "##############.#",
        "#..............#",
        "#####X##########",
        "#####.##########",
        "################",
        "################",
        "################",
    ]},
    {"need": 2, "rows": [
        "################",
        "#S..D...T......#",
        "##############.#",
        "##############.#",
        "#..............#",
        "#.##############",
        "#.##############",
        "#o.o.###########",
        "####..##########",
        "#####..#########",
        "######..########",
        "#######X########",
        "#######.########",
        "################",
        "################",
        "################",
    ]},
    {"need": 2, "rows": [
        "################",
        "#S..D...T...D..#",
        "##############.#",
        "##############.#",
        "#...o.o........#",
        "#.##############",
        "#.##############",
        "#o.o.###########",
        "####..##########",
        "#####..#########",
        "######..########",
        "#######X########",
        "#######.########",
        "################",
        "################",
        "################",
    ]},
    {"need": 3, "rows": [
        "################",
        "#S..D...F...T..#",
        "##############.#",
        "##############.#",
        "#...o.o.o......#",
        "#.##############",
        "#.##############",
        "#o.o.o##########",
        "####..##########",
        "#####..#########",
        "######..########",
        "#######X########",
        "#######.########",
        "################",
        "################",
        "################",
    ]},
]


def parse_level(rows):
    geom, tokens, spawn, exit_cell, pads = [], {}, None, None, set()
    for y, row in enumerate(rows):
        line = []
        for x, ch in enumerate(row):
            if ch in TOKEN_COLOUR:
                tokens[(x, y)] = ch
                line.append(".")
            elif ch == "S":
                spawn = (x, y)
                line.append(".")
            elif ch == "o":
                pads.add((x, y))
                line.append("o")
            else:
                if ch == "X":
                    exit_cell = (x, y)
                line.append(ch)
        geom.append("".join(line))
    return geom, tokens, spawn, exit_cell, pads


def resolve_move(geom, tokens, pos, stack, direction, carry_room):
    state = {
        "pos": pos,
        "picked": [],
        "turns": 0,
        "budget": SLIDE_BUDGET,
        "overflow": False,
    }
    taken = set()

    def primitive(d):
        if state["budget"] <= 0:
            state["overflow"] = True
            return
        state["budget"] -= 1
        x, y = state["pos"]
        nx, ny = x + d[0], y + d[1]
        if not (0 <= nx < N and 0 <= ny < N) or geom[ny][nx] == "#":
            return
        state["pos"] = (nx, ny)
        cell = (nx, ny)
        if cell in tokens and cell not in taken and len(state["picked"]) < carry_room:
            taken.add(cell)
            state["picked"].append(cell)

    def evaluate(i, d):
        if state["overflow"]:
            return
        if i < 0:
            primitive(d)
            return
        kind = stack[i]
        if kind == "D":
            evaluate(i - 1, d)
            evaluate(i - 1, d)
        elif kind == "F":
            evaluate(i - 1, (-d[0], -d[1]))
        elif kind == "T":
            state["turns"] += 1
            nd = d
            for _ in range(state["turns"] % 4):
                nd = _cw(nd)
            evaluate(i - 1, nd)
        elif kind == "L":
            seen = {state["pos"]}
            while not state["overflow"]:
                before = state["pos"]
                evaluate(i - 1, d)
                if state["pos"] == before or state["pos"] in seen:
                    break
                seen.add(state["pos"])

    evaluate(len(stack) - 1, direction)
    return state["pos"], state["picked"], state["overflow"]


def _rounded(colour: int) -> list[list[int]]:
    block = [[colour] * CELL for _ in range(CELL)]
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        block[y][x] = -1
    return block


def _flat(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _pad_pixels():
    block = _flat(PAD)
    for yy in (1, 2):
        for xx in (1, 2):
            block[yy][xx] = FLOOR
    return block


def _exit_pixels(need):
    block = _flat(EXIT)
    for i, (xx, yy) in enumerate(((1, 1), (2, 1), (1, 2))):
        if i < need:
            block[yy][xx] = EXIT_PIP
    return block


def _token_pixels(kind):
    block = _flat(TOKEN_COLOUR[kind])
    for xx, yy in TOKEN_MARKS[kind]:
        block[yy][xx] = MARK
    return block


def _player_pixels():
    block = _flat(PLAYER)
    block[1][1] = MARK
    block[2][2] = MARK
    return block


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        geom, _, _, _, _ = parse_level(spec["rows"])
        sprites = []
        for y, row in enumerate(geom):
            for x, ch in enumerate(row):
                if ch == ".":
                    continue
                px, py = x * CELL, y * CELL
                if ch == "#":
                    pixels, name, layer = _flat(WALL), f"wall_{x}_{y}", -1
                elif ch == "o":
                    pixels, name, layer = _pad_pixels(), f"pad_{x}_{y}", 0
                else:
                    pixels, name, layer = _exit_pixels(spec["need"]), "exit", 0
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=layer,
                ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G024A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    ROW = (8, 20, 32, 44)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        for i, kind in enumerate(self._game.stack[:MAX_CARRY]):
            top = self.ROW[i]
            frame[top:top + 3, 61:64] = TOKEN_COLOUR[kind]
            for xx, yy in TOKEN_MARKS[kind]:
                frame[top + yy - 1, 61 + xx - 1] = MARK
        return frame


class G024(ARCBaseGame):

    def __init__(self) -> None:
        self.stack = []
        self.tokens = {}
        self.pos = (0, 0)
        self.geom = []
        self.pads = set()
        self.exit_cell = None
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G024A(self)],
        )
        super().__init__(game_id="g024", levels=build_levels(), camera=camera)
        self._load(0)

    def _load(self, index: int) -> None:
        spec = LEVELS_SPEC[index]
        geom, tokens, spawn, exit_cell, pads = parse_level(spec["rows"])
        self.geom, self.tokens, self.pos = geom, dict(tokens), spawn
        self.exit_cell, self.pads = exit_cell, set(pads)
        self.stack = []
        self._sync()

    def on_set_level(self, level: Level) -> None:
        self._load(self.level_index)

    def level_reset(self) -> None:
        super().level_reset()
        self._load(self.level_index)

    def full_reset(self) -> None:
        super().full_reset()
        self._load(self.level_index)

    def _sync(self) -> None:
        level = self.current_level
        for sprite in list(level.get_sprites_by_tag("dyn")):
            level.remove_sprite(sprite)
        for (x, y), kind in self.tokens.items():
            level.add_sprite(Sprite(
                pixels=_token_pixels(kind), name=f"tok_{x}_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1, tags=["dyn"],
            ).set_position(x * CELL, y * CELL))
        level.add_sprite(Sprite(
            pixels=_player_pixels(), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2, tags=["dyn"],
        ).set_position(self.pos[0] * CELL, self.pos[1] * CELL))

    def step(self) -> None:
        direction = {
            GameAction.ACTION1: UP,
            GameAction.ACTION2: DOWN,
            GameAction.ACTION3: LEFT,
            GameAction.ACTION4: RIGHT,
        }.get(self.action.id)

        if direction is not None:
            room = MAX_CARRY - len(self.stack)
            pos, picked, _ = resolve_move(
                self.geom, self.tokens, self.pos, tuple(self.stack), direction, room)
            self.pos = pos
            for cell in picked:
                self.stack.append(self.tokens.pop(cell))
            self._sync()
            if self.pos == self.exit_cell and len(self.stack) >= LEVELS_SPEC[self.level_index]["need"]:
                self.next_level()

        elif self.action.id == GameAction.ACTION5:
            if self.stack and self.pos in self.pads and self.pos not in self.tokens:
                self.tokens[self.pos] = self.stack.pop()
                self._sync()

        self.complete_action()
