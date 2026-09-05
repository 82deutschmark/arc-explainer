# ARC-AGI-3 candidate task g036.

import numpy as np

from sprite_book import fixture, ring, rounded, studs

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

VOID = 13
TRACK = 2
JUNCTION = 2
WANT_H = 9
WANT_V = 11
CORD = 7
UNDER = VOID
PLAYER = 14
END = 14
START = VOID
PIP_ON = CORD
PIP_OFF = TRACK

N = 16
CELL = 4
LO, HI = 1, N - 2

UP, DOWN, LEFT, RIGHT = (0, -1), (0, 1), (-1, 0), (1, 0)
DIRS = (UP, DOWN, LEFT, RIGHT)

LEVELS_SPEC = [
    {"cols": [8], "rows": [8], "cuts": [], "start": (1, 1), "end": (14, 14),
     "marks": {(8, 8): "v"}, "undos": 4},
    {"cols": [8], "rows": [8], "cuts": [], "start": (1, 1), "end": (14, 14),
     "marks": {(8, 8): "h"}, "undos": 4},
    {"cols": [8], "rows": [4, 12], "cuts": [], "start": (1, 12), "end": (14, 4),
     "marks": {(8, 4): "h", (8, 12): "v"}, "undos": 4},
    {"cols": [4, 12], "rows": [8], "cuts": [], "start": (1, 1), "end": (1, 8),
     "marks": {(4, 8): "h", (12, 8): "h"}, "undos": 4},
    {"cols": [4, 12], "rows": [4, 12], "cuts": [], "start": (1, 1), "end": (1, 4),
     "marks": {(4, 4): "h", (4, 12): "h", (12, 4): "h", (12, 12): "v"}, "undos": 3},
    {"cols": [4, 12], "rows": [4, 12], "cuts": [], "start": (14, 14), "end": (12, 14),
     "marks": {(4, 4): "h", (4, 12): "v", (12, 4): "v", (12, 12): "v"}, "undos": 3},
    {"cols": [4, 8, 12], "rows": [4, 12], "cuts": [], "start": (14, 12), "end": (1, 4),
     "marks": {(4, 4): "h", (8, 4): "h", (12, 4): "h",
               (4, 12): "v", (8, 12): "v", (12, 12): "v"}, "undos": 3},
    {"cols": [4, 8, 12], "rows": [4, 8, 12], "cuts": [], "start": (14, 12), "end": (14, 8),
     "marks": {(4, 4): "h", (8, 4): "h", (12, 4): "h",
               (4, 8): "h", (8, 8): "h", (12, 8): "h",
               (4, 12): "v", (8, 12): "v", (12, 12): "v"}, "undos": 2},
]

DECOR_CELLS = ((0, 0), (N - 1, 0), (0, N - 1), (N - 1, N - 1),
               (3, 3), (N - 5, 3), (3, N - 5), (N - 5, N - 5))


def build_board(spec: dict) -> tuple[dict, dict]:
    track: dict[tuple[int, int], bool] = {}
    for i in range(LO, HI + 1):
        for cell in ((i, LO), (i, HI), (LO, i), (HI, i)):
            track[cell] = True
    for x in spec["cols"]:
        for y in range(LO, HI + 1):
            track[(x, y)] = True
    for y in spec["rows"]:
        for x in range(LO, HI + 1):
            track[(x, y)] = True
    for cell in spec["cuts"]:
        track.pop(tuple(cell), None)

    junctions: dict[tuple[int, int], str | None] = {}
    for x in spec["cols"]:
        for y in spec["rows"]:
            if (x, y) in track:
                junctions[(x, y)] = spec["marks"].get((x, y))
    return track, junctions


def axis_of(direction: tuple[int, int]) -> str:
    return "H" if direction[1] == 0 else "V"


def initial_state(spec: dict) -> dict:
    start = tuple(spec["start"])
    return {"pos": start, "spent": {start}, "cross": {}, "arms": {start: set()}}


def clone_state(state: dict) -> dict:
    return {
        "pos": state["pos"],
        "spent": set(state["spent"]),
        "cross": dict(state["cross"]),
        "arms": {k: set(v) for k, v in state["arms"].items()},
    }


def try_step(state: dict, direction: tuple[int, int], track: dict, junctions: dict):
    dx, dy = direction
    axis = axis_of(direction)
    passed: list[tuple[int, int]] = []
    cur = (state["pos"][0] + dx, state["pos"][1] + dy)
    while True:
        if cur not in track:
            return None
        if cur not in junctions:
            break
        if axis in state["cross"].get(cur, ()) or cur in passed:
            return None
        passed.append(cur)
        cur = (cur[0] + dx, cur[1] + dy)
    if cur in state["spent"]:
        return None

    out = clone_state(state)
    back = (-dx, -dy)
    out["arms"].setdefault(state["pos"], set()).add(direction)
    for cell in passed:
        arms = out["arms"].setdefault(cell, set())
        arms.add(back)
        arms.add(direction)
        out["cross"][cell] = out["cross"].get(cell, ()) + (axis,)
    out["arms"].setdefault(cur, set()).add(back)
    out["spent"].add(cur)
    out["pos"] = cur
    return out


def failed_marks(state: dict, junctions: dict) -> list:
    bad = []
    for cell, mark in junctions.items():
        if mark is None:
            continue
        order = state["cross"].get(cell, ())
        if len(order) < 2 or order[1] != ("H" if mark == "h" else "V"):
            bad.append(cell)
    return bad


def knot_holds(state: dict, junctions: dict) -> bool:
    return not failed_marks(state, junctions)


def state_key(state: dict) -> tuple:
    return (state["pos"], frozenset(state["spent"]),
            tuple(sorted(state["cross"].items())))


def _paving() -> list[list[int]]:
    return rounded(TRACK, CELL)


def _crossing(mark: str | None) -> list[list[int]]:
    colour = JUNCTION if mark is None else (WANT_H if mark == "h" else WANT_V)
    px = [[-1] * CELL for _ in range(CELL)]
    for i in range(CELL):
        px[i][i] = colour
        px[i][CELL - 1 - i] = colour
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        track, junctions = build_board(spec)
        start, end = tuple(spec["start"]), tuple(spec["end"])
        sprites: list[Sprite] = []

        def place(pixels, name, cell, layer):
            sprites.append(Sprite(
                pixels=pixels, name=name,
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=layer,
            ).set_position(cell[0] * CELL, cell[1] * CELL))

        for cell in sorted(track):
            place(_paving(), f"t_{cell[0]}_{cell[1]}", cell, -1)
        for cell in sorted(junctions):
            place(_crossing(junctions[cell]), f"x_{cell[0]}_{cell[1]}", cell, 0)
        place(ring(END, CELL), "anchor", end, 0)
        if start != end:
            place(ring(START, CELL), "eyelet", start, 0)
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def _paint_arm(frame: np.ndarray, cell: tuple[int, int], direction: tuple[int, int],
               colour: int) -> None:
    px, py = cell[0] * CELL, cell[1] * CELL
    if direction == UP:
        frame[py:py + 2, px + 1:px + 3] = colour
    elif direction == DOWN:
        frame[py + 2:py + 4, px + 1:px + 3] = colour
    elif direction == LEFT:
        frame[py + 1:py + 3, px:px + 2] = colour
    else:
        frame[py + 1:py + 3, px + 2:px + 4] = colour


def _stamp(frame: np.ndarray, cell: tuple[int, int], pixels) -> None:
    px, py = cell[0] * CELL, cell[1] * CELL
    for y, row in enumerate(pixels):
        for x, value in enumerate(row):
            if value >= 0:
                frame[py + y, px + x] = value


class G036A(RenderableUserDisplay):

    def __init__(self, game: "G036") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        state = game.state
        junctions = game.junctions
        for cell, arms in state["arms"].items():
            order = state["cross"].get(cell, ())
            if len(order) == 2:
                under_axis = order[0]
                for axis in (under_axis, order[1]):
                    colour = UNDER if axis == under_axis else CORD
                    for direction in arms:
                        if axis_of(direction) == axis:
                            _paint_arm(frame, cell, direction, colour)
            else:
                for direction in arms:
                    _paint_arm(frame, cell, direction, CORD)

        px, py = state["pos"][0] * CELL, state["pos"][1] * CELL
        face = frame[py:py + CELL, px:px + CELL]
        cut_a, cut_b = int(face[0, 0]), int(face[CELL - 1, CELL - 1])
        face[:, :] = PLAYER
        face[1:CELL - 1, 1:CELL - 1] = CORD
        face[0, 0] = cut_a
        face[CELL - 1, CELL - 1] = cut_b

        if game.cinch and game.cinch % 2 == 0:
            bad = failed_marks(state, junctions)
            if bad:
                for cell in bad:
                    bx, by = cell[0] * CELL, cell[1] * CELL
                    frame[by:by + CELL, bx:bx + CELL] = (
                        WANT_H if junctions[cell] == "h" else WANT_V)
            else:
                frame[frame == CORD] = END

        for cell in DECOR_CELLS:
            if cell in game.track:
                continue
            _stamp(frame, cell, fixture((WANT_H, WANT_V, TRACK),
                                        game.tick // 2, (cell[0] + cell[1]) % 3, CELL))

        studs(frame, game.level_undos, game.undos, PIP_ON, PIP_OFF,
              side="east", start=8, gap=6)
        return frame


class G036(ARCBaseGame):

    CINCH_FRAMES = 6

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.track, self.junctions = build_board(spec)
        self.state = initial_state(spec)
        self.history: list[dict] = []
        self.undos = spec["undos"]
        self.level_undos = spec["undos"]
        self.cinch = 0
        self.tick = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=VOID, letter_box=VOID,
            interfaces=[G036A(self)],
        )
        super().__init__(game_id="g036", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5, 7])

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.track, self.junctions = build_board(spec)
        self.state = initial_state(spec)
        self.history = []
        self.undos = spec["undos"]
        self.level_undos = spec["undos"]
        self.cinch = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def lay(self, direction: tuple[int, int]) -> bool:
        nxt = try_step(self.state, direction, self.track, self.junctions)
        if nxt is None:
            return False
        self.history.append(self.state)
        self.state = nxt
        return True

    def retract(self) -> bool:
        if self.undos <= 0 or not self.history:
            return False
        self.state = self.history.pop()
        self.undos -= 1
        return True

    def pull(self) -> bool:
        if self.state["pos"] != tuple(LEVELS_SPEC[self.level_index]["end"]):
            return False
        self.cinch = self.CINCH_FRAMES
        return True

    def _settle(self) -> None:
        if knot_holds(self.state, self.junctions):
            self.next_level()
        else:
            self.level_reset()

    def step(self) -> None:
        if self.cinch:
            self.cinch -= 1
            if self.cinch == 0:
                self._settle()
                self.complete_action()
            return

        self.tick += 1
        action = self.action.id
        if action == GameAction.ACTION1:
            self.lay(UP)
        elif action == GameAction.ACTION2:
            self.lay(DOWN)
        elif action == GameAction.ACTION3:
            self.lay(LEFT)
        elif action == GameAction.ACTION4:
            self.lay(RIGHT)
        elif action == GameAction.ACTION5:
            if self.pull():
                return
        elif action == GameAction.ACTION7:
            self.retract()
        self.complete_action()
