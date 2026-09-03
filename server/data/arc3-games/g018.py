# ARC-AGI-3 candidate task g018.

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

N = 16
CELL = 4
WALL_H = -1

HEIGHT_COLOUR = {0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 0}
WALL = 13
FLOOD = 9
DAMP_DRY = 10
DAMP_WET = 11
DAMP_SPENT = 6
FLAG_OPEN = 14
FLAG_DONE = 8
SUMMIT = 15
SUMMIT_READY = 14
PLAYER = 12

DROWNED = object()


B = [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1]

LEVELS_SPEC = [
    {"bands": [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
     "hills": [(8, 7, 5)], "walls": [],
     "damp": [(4, 1), (11, 14)],
     "flags": [(3, 3), (12, 12)], "summit": (8, 7), "start": (1, 7)},

    {"bands": [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
     "hills": [(8, 7, 5)], "walls": [],
     "damp": [(5, 2), (10, 2), (5, 13), (10, 13)],
     "flags": [(2, 1), (13, 14), (7, 4)], "summit": (8, 7), "start": (1, 7)},

    {"bands": [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
     "hills": [(8, 7, 5)], "walls": [(2, 3), (3, 3), (4, 3), (5, 3), (7, 3), (8, 3),
                                     (9, 3), (10, 3), (11, 3), (12, 3),
                                     (3, 11), (4, 11), (5, 11), (6, 11), (7, 11),
                                     (9, 11), (10, 11), (11, 11), (12, 11), (13, 11)],
     "damp": [(6, 3), (8, 11), (5, 1), (11, 14)],
     "flags": [(2, 1), (13, 14)], "summit": (8, 7), "start": (1, 7)},

    {"bands": B, "hills": [(11, 7, 5)],
     "walls": [(x, 4) for x in range(1, 15) if x not in (7, 14)]
              + [(x, 10) for x in range(1, 15) if x not in (8, 1)],
     "damp": [(7, 4), (8, 10), (4, 1), (11, 14)],
     "flags": [(2, 1), (13, 14), (4, 7)], "summit": (11, 7), "start": (7, 7)},

    {"bands": B, "hills": [(14, 7, 5)],
     "walls": [(x, 4) for x in range(1, 15) if x not in (6, 13)]
              + [(x, 10) for x in range(1, 15) if x not in (9, 13)],
     "damp": [(6, 4), (9, 10), (2, 2), (13, 13), (2, 13)],
     "flags": [(2, 1), (2, 14), (11, 7)], "summit": (14, 7), "start": (7, 7)},

    {"bands": [0, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 0], "hills": [(8, 7, 5)],
     "walls": [(x, 4) for x in range(1, 15) if x not in (6, 14)]
              + [(x, 10) for x in range(1, 15) if x not in (9, 2)],
     "damp": [(6, 4), (9, 10), (4, 2), (12, 12), (1, 7)],
     "flags": [(3, 1), (12, 11), (13, 7)], "summit": (8, 7), "start": (7, 7)},

    {"bands": [1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1], "hills": [(8, 7, 4)],
     "walls": [(x, 4) for x in range(1, 15) if x not in (4, 14)]
              + [(x, 10) for x in range(1, 15) if x not in (10, 2)],
     "damp": [(4, 4), (10, 10), (2, 2), (13, 13), (12, 1)],
     "flags": [(1, 1), (14, 14), (7, 3)], "summit": (8, 7), "start": (8, 6)},

    {"bands": B, "hills": [(8, 7, 5)],
     "walls": [(x, 4) for x in range(1, 15) if x not in (6,)]
              + [(x, 10) for x in range(1, 15) if x not in (9, 1)],
     "damp": [(6, 4), (9, 10), (3, 1), (12, 14), (1, 7), (14, 7)],
     "flags": [(2, 1), (12, 11), (13, 7)], "summit": (8, 7), "start": (8, 12)},
]


def build_model(spec: dict) -> dict:
    heights = [[WALL_H] * N for _ in range(N)]
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            heights[y][x] = spec["bands"][y - 1]
    for x, y, h in spec["hills"]:
        heights[y][x] = h
    for x, y in spec["walls"]:
        heights[y][x] = WALL_H
    damp = list(spec["damp"])
    flags = list(spec["flags"])
    assert len(damp) <= 8, "damp count blows up the exhaustive search"
    assert len(flags) <= 4, "flag count blows up the exhaustive search"
    for pos in damp + flags + [spec["summit"], spec["start"]]:
        assert heights[pos[1]][pos[0]] >= 0, f"marked cell {pos} is rock"
    assert not (set(damp) & set(flags)), "a tile cannot be both damp and a flag"
    assert spec["summit"] not in flags and spec["summit"] not in damp
    return {
        "heights": heights,
        "damp": damp,
        "damp_index": {p: i for i, p in enumerate(damp)},
        "flags": flags,
        "flag_index": {p: i for i, p in enumerate(flags)},
        "all_flags": (1 << len(flags)) - 1,
        "summit": spec["summit"],
        "start": spec["start"],
    }


MODELS = [build_model(s) for s in LEVELS_SPEC]


def start_state(model: dict) -> tuple:
    sx, sy = model["start"]
    return (sx, sy, 0, 0, 0)


def tally_of(state: tuple) -> int:
    return bin(state[2]).count("1") - state[4]


def is_flooded(model: dict, x: int, y: int, water: int) -> bool:
    h = model["heights"][y][x]
    return h >= 0 and h < water


def apply_move(model: dict, state: tuple, dx: int, dy: int):
    x, y, wet, taken, water = state
    nx, ny = x + dx, y + dy
    if not (0 <= nx < N and 0 <= ny < N):
        return state
    h = model["heights"][ny][nx]
    if h < 0 or h < water:
        return state
    if (nx, ny) in model["damp_index"]:
        wet |= 1 << model["damp_index"][(nx, ny)]
    fi = model["flag_index"].get((nx, ny))
    if fi is not None and not (taken & (1 << fi)):
        taken |= 1 << fi
        water += bin(wet).count("1") - water
        if h < water:
            return DROWNED
    return (nx, ny, wet, taken, water)


def is_win(model: dict, state: tuple) -> bool:
    return (state[0], state[1]) == model["summit"] and state[3] == model["all_flags"]


def _ring(colour: int, core: int) -> list[list[int]]:
    block = [[colour] * CELL for _ in range(CELL)]
    for j in (1, 2):
        for i in (1, 2):
            block[j][i] = core
    return block


def _player_pixels() -> list[list[int]]:
    return _ring(PLAYER, -1)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for model in MODELS:
        board = Sprite(
            pixels=[[WALL] * (N * CELL) for _ in range(N * CELL)], name="board",
            blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
            layer=-1, collidable=False,
        ).set_position(0, 0)
        sx, sy = model["start"]
        player = Sprite(
            pixels=_player_pixels(), name="player",
            blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
            layer=1, collidable=False,
        ).set_position(sx * CELL, sy * CELL)
        levels.append(Level(sprites=[board, player], grid_size=(N * CELL, N * CELL)))
    return levels


class G018(ARCBaseGame):

    def __init__(self) -> None:
        self.state = start_state(MODELS[0])
        self.cashed = 0
        super().__init__(game_id="g018", levels=build_levels(),
                         camera=Camera(width=N * CELL, height=N * CELL,
                                       background=WALL, letter_box=WALL),
                         available_actions=[1, 2, 3, 4])

    @property
    def model(self) -> dict:
        return MODELS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        self.state = start_state(MODELS[self.level_index])
        self.cashed = 0
        self._repaint(level)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self, level: Level) -> None:
        model = MODELS[self.level_index]
        found = level.get_sprites_by_name("board")
        if not found:
            return
        board = found[0]
        x, y, wet, taken, water = self.state
        pix = board.pixels
        for cy in range(N):
            for cx in range(N):
                h = model["heights"][cy][cx]
                if h < 0:
                    colour = WALL
                elif h < water:
                    colour = FLOOD
                else:
                    colour = HEIGHT_COLOUR[h]
                block = [[colour] * CELL for _ in range(CELL)]
                if colour != FLOOD and colour != WALL:
                    di = model["damp_index"].get((cx, cy))
                    if di is not None:
                        if not (wet >> di) & 1:
                            dot = DAMP_DRY
                        elif (self.cashed >> di) & 1:
                            dot = DAMP_SPENT
                        else:
                            dot = DAMP_WET
                        for j in (1, 2):
                            for i in (1, 2):
                                block[j][i] = dot
                    fi = model["flag_index"].get((cx, cy))
                    if fi is not None:
                        block = _ring(FLAG_DONE if (taken >> fi) & 1 else FLAG_OPEN,
                                      colour)
                    if (cx, cy) == model["summit"]:
                        block = _ring(SUMMIT,
                                      SUMMIT_READY if taken == model["all_flags"]
                                      else colour)
                pix[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = \
                    np.array(block, dtype=np.int8)

        players = level.get_sprites_by_name("player")
        if players:
            players[0].set_position(x * CELL, y * CELL)

    def step(self) -> None:
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

        result = apply_move(self.model, self.state, dx, dy)
        if result is DROWNED:
            self.level_reset()
            self.complete_action()
            return

        if result[4] > self.state[4]:
            self.cashed = result[2]
        self.state = result
        if is_win(self.model, self.state):
            self.next_level()
            self.complete_action()
            return

        self._repaint(self.current_level)
        self.complete_action()
