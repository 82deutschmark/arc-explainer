# ARC-AGI-3 candidate task g037.

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

SKY = 0
BEDROCK = 3
SEALED = 2
SEALED_EDGE = 5
HEAVY = 13
LIGHT_A = 11
LIGHT_B = 13
MARKER = 14
AVATAR = 12
PIP_TAKEN = 3
PIP_LEFT = 14
PIP_LOST = 8

N = 16
CELL = 4

STATIC = "#S"
MOBILE = "LHM"


def parse(rows):
    static, blocks, avatar = set(), {}, None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in STATIC:
                static.add((x, y))
            elif ch in MOBILE:
                blocks[(x, y)] = ch
            elif ch == "P":
                avatar = (x, y)
    if avatar is None:
        raise AssertionError("board has no avatar")
    return frozenset(static), blocks, avatar


def _drop(static, blocks, avatar, fallen):
    crushed = False
    while True:
        moved = False
        occ = set(static) | set(blocks) | {avatar}
        order = sorted(list(blocks.keys()) + [avatar], key=lambda p: -p[1])
        for p in order:
            x, y = p
            below = (x, y + 1)
            if below[1] >= N:
                continue
            if below in occ:
                if p != avatar and below == avatar and fallen.get(p, 0) >= 1:
                    crushed = True
                continue
            occ.discard(p)
            occ.add(below)
            if p == avatar:
                avatar = below
            else:
                kind = blocks.pop(p)
                blocks[below] = kind
                fallen[below] = fallen.pop(p, 0) + 1
            moved = True
        if not moved:
            return blocks, avatar, crushed


def settle(static, blocks, avatar):
    blocks = dict(blocks)
    fallen = {}
    crushed = False
    lost = 0
    while True:
        blocks, avatar, c = _drop(static, blocks, avatar, fallen)
        crushed = crushed or c
        doomed = set()
        for p, kind in blocks.items():
            if kind == "H" and fallen.get(p, 0) >= 1:
                below = (p[0], p[1] + 1)
                if blocks.get(below) in ("L", "M"):
                    doomed.add(below)
            elif kind == "L" and fallen.get(p, 0) >= 2:
                doomed.add(p)
        if not doomed:
            return blocks, avatar, crushed, lost
        for p in doomed:
            if blocks.pop(p) == "M":
                lost += 1
            fallen.pop(p, None)


def step_target(static, blocks, avatar, d):
    x, y = avatar
    tgt = (x + d, y)
    if not (0 <= tgt[0] < N):
        return None
    occ = set(static) | set(blocks)
    if tgt not in occ:
        return tgt
    up = (x + d, y - 1)
    head = (x, y - 1)
    if up[1] >= 0 and up not in occ and head not in occ:
        return up
    return None


def faced_cell(avatar, facing):
    return (avatar[0] + facing[0], avatar[1] + facing[1])


def apply_move(static, blocks, avatar, d):
    tgt = step_target(static, blocks, avatar, d)
    if tgt is None:
        return blocks, avatar
    b, av, _, _ = settle(static, blocks, tgt)
    return b, av


def apply_cut(static, blocks, avatar, facing):
    target = faced_cell(avatar, facing)
    kind = blocks.get(target)
    if kind is None:
        return None
    rest = dict(blocks)
    rest.pop(target)
    b, av, crushed, lost = settle(static, rest, avatar)
    return b, av, crushed, lost, kind == "M"


def markers_left(blocks):
    return sum(1 for k in blocks.values() if k == "M")


def is_won(blocks, lost):
    return markers_left(blocks) == 0 and lost == 0

LEVELS_SPEC = [
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..SSSSSS......#",
        "#...P..M.......#",
        "#..SSSSSSS.....#",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..SSSSSS......#",
        "#...P..L.......#",
        "#..SSSSMSS.....#",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#......H.......#",
        "#......L...SS..#",
        "#...P..M...M...#",
        "#..SSSSSSSSSS..#",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.......L....P.#",
        "#.......HSSSSSS#",
        "#.......M......#",
        "#......SMS.....#",
        "#SSSSSSSSSSSSSS#",
        "################",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.......H...H..#",
        "#...L...MS..L..#",
        "#...M...MSS.P..#",
        "#SSSSSSSSSSSSSS#",
        "################",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....H...H....#",
        "#.....L..SM....#",
        "#..P..MSSSMS...#",
        "#SSSSSSSSSSSSSS#",
        "################",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....H....H....#",
        "#...SM...SM....#",
        "#P.SSM..SSM....#",
        "#SSSSSSSSSSSSSS#",
        "################",
        "################",
    ],
    [
        "................",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..H...H....H..#",
        "#..L..SM...SM..#",
        "#P.M.SSM..SSM..#",
        "#SSSSSSSSSSSSSS#",
        "################",
        "################",
    ],
]

TOTAL_MARKERS = [sum(row.count("M") for row in rows) for rows in LEVELS_SPEC]


def _solid(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _checker(a, b):
    return [[a if ((x // 2) + (y // 2)) % 2 == 0 else b for x in range(CELL)]
            for y in range(CELL)]


def _bordered(inner, edge):
    px = _solid(inner)
    for i in range(CELL):
        px[0][i] = px[CELL - 1][i] = edge
        px[i][0] = px[i][CELL - 1] = edge
    return px


TILE_PIXELS = {
    "#": _solid(BEDROCK),
    "S": _bordered(SEALED, SEALED_EDGE),
    "H": _solid(HEAVY),
    "L": _checker(LIGHT_A, LIGHT_B),
    "M": _solid(MARKER),
}


def _tile(pixels, name, layer):
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE, layer=layer,
    )


class G037A(RenderableUserDisplay):

    def __init__(self, game: "G037") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        total = TOTAL_MARKERS[self._game.level_index]
        left = markers_left(self._game.blocks)
        lost = self._game.lost
        taken = total - left - lost
        for i in range(total):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            if i < taken:
                colour = PIP_TAKEN
            elif i < taken + left:
                colour = PIP_LEFT
            else:
                colour = PIP_LOST
            frame[1:3, x:x + 2] = colour
        return frame


class G037(ARCBaseGame):

    def __init__(self) -> None:
        self.rows = LEVELS_SPEC[0]
        self.static, self.blocks, self.avatar = parse(self.rows)
        self.lost = 0
        self._facing = (0, 1)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=SKY, letter_box=5,
            interfaces=[G037A(self)],
        )
        super().__init__(game_id="g037", levels=self._blank_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5, 7])

    @staticmethod
    def _blank_levels() -> list[Level]:
        return [Level(sprites=[], grid_size=(N * CELL, N * CELL))
                for _ in LEVELS_SPEC]

    def on_set_level(self, level: Level) -> None:
        self.rows = LEVELS_SPEC[self.level_index]
        self.static, self.blocks, self.avatar = parse(self.rows)
        self.lost = 0
        self._facing = (0, 1)
        self._redraw()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _redraw(self) -> None:
        level = self.current_level
        level.remove_all_sprites()
        for (x, y) in sorted(self.static):
            level.add_sprite(_tile(TILE_PIXELS[self.rows[y][x]], f"r_{x}_{y}", -1)
                             .set_position(x * CELL, y * CELL))
        for (x, y), kind in sorted(self.blocks.items()):
            level.add_sprite(_tile(TILE_PIXELS[kind], f"b_{x}_{y}", 0)
                             .set_position(x * CELL, y * CELL))
        ax, ay = self.avatar
        level.add_sprite(_tile(_solid(AVATAR), "avatar", 1)
                         .set_position(ax * CELL, ay * CELL))

    def step(self) -> None:
        act = self.action.id
        if act == GameAction.ACTION7:
            self.complete_action()
            return

        if act == GameAction.ACTION1:
            self._facing = (0, -1)
        elif act == GameAction.ACTION2:
            self._facing = (0, 1)
        elif act in (GameAction.ACTION3, GameAction.ACTION4):
            d = -1 if act == GameAction.ACTION3 else 1
            self._facing = (d, 0)
            self.blocks, self.avatar = apply_move(
                self.static, self.blocks, self.avatar, d)
            self._redraw()
        elif act == GameAction.ACTION5:
            result = apply_cut(self.static, self.blocks, self.avatar, self._facing)
            if result is not None:
                blocks, avatar, crushed, lost, _ = result
                if crushed:
                    self.level_reset()
                    self.complete_action()
                    return
                self.blocks, self.avatar = blocks, avatar
                self.lost += lost
                self._redraw()
                if is_won(self.blocks, self.lost):
                    self.next_level()

        self.complete_action()
