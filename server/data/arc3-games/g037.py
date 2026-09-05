# ARC-AGI-3 candidate task g037.

import numpy as np

from sprite_book import (
    facing, fixture, hairline, medallion, outline, rounded, speckle, studs, weave,
)

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

SKY = 11
BEDROCK = 5
SEALED = 3
SEALED_JOINT = 5
SEAM = 9
SEAM_VEIN = 5
MARKER = 14
MARKER_HEART = 5
AVATAR = 6
AVATAR_VISOR = 5

PIP_TAKEN = AVATAR
PIP_LEFT = MARKER
PIP_LOST = SEAM

GAUGE_TOP = 20
GAUGE_GAP = 7

DECOR_CELLS = ((2, 4), (7, 9), (11, 3), (12, 7))
DECOR_COLOURS = (MARKER, SEAM, SEALED)

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


def _paint(px, pixels):
    for y, row in enumerate(pixels):
        for x, value in enumerate(row):
            if value >= 0:
                px[y][x] = value
    return px


def _bedrock(seed):
    return _paint([[BEDROCK] * CELL for _ in range(CELL)], speckle(SEALED, seed, CELL))


def _sealed():
    px = rounded(SEALED, CELL)
    px[0][1] = px[0][CELL - 2] = SEALED_JOINT
    px[2][2] = SEALED_JOINT
    return px


def _heavy():
    px = [[SEAM] * CELL for _ in range(CELL)]
    px[1][1] = px[2][2] = SEAM_VEIN
    return px


def _light():
    return weave(SEAM, CELL)


def _marker():
    return medallion(MARKER, MARKER_HEART, CELL)


def _avatar(heading):
    return facing(AVATAR, AVATAR_VISOR, heading, CELL)


BLOCK_FACES = {"H": _heavy, "L": _light, "M": _marker}


def _static_pixels(ch, x, y):
    return _bedrock(x + 3 * y) if ch == "#" else _sealed()


def _tile(pixels, name, layer):
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE, layer=layer,
    )


def _cell_box(cell):
    return (cell[0] * CELL, cell[1] * CELL, cell[0] * CELL + CELL, cell[1] * CELL + CELL)


def _stamp(frame, cell, pixels):
    px, py = cell[0] * CELL, cell[1] * CELL
    for y, row in enumerate(pixels):
        for x, value in enumerate(row):
            if value >= 0:
                frame[py + y, px + x] = value


class G037A(RenderableUserDisplay):

    def __init__(self, game: "G037") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        total = TOTAL_MARKERS[game.level_index]
        left = markers_left(game.blocks)
        taken = total - left - game.lost

        for cell in DECOR_CELLS:
            if cell in game.static or cell in game.blocks or cell == game.avatar:
                continue
            _stamp(frame, cell, fixture(DECOR_COLOURS, game.tick // 2,
                                        cell[0] + cell[1], CELL))

        if game.crush % 2:
            x0, y0, x1, y1 = _cell_box(game.avatar)
            frame[y0:y1, x0:x1] = SEAM

        if game.bury % 2:
            outline(frame, _cell_box(game.cut_cell), AVATAR)

        hairline(frame, (frame.shape[1] - 1, GAUGE_TOP - 2),
                 (frame.shape[1] - 1, GAUGE_TOP + (total - 1) * GAUGE_GAP + 3), SEALED)
        studs(frame, total, taken + left, PIP_LEFT,
              SKY if game.bury % 2 else PIP_LOST,
              side="east", start=GAUGE_TOP, gap=GAUGE_GAP)
        studs(frame, taken, taken, PIP_TAKEN, PIP_TAKEN,
              side="east", start=GAUGE_TOP, gap=GAUGE_GAP)
        return frame


class G037(ARCBaseGame):

    CRUSH_FRAMES = 6
    BURY_FRAMES = 6

    def __init__(self) -> None:
        self.rows = LEVELS_SPEC[0]
        self.static, self.blocks, self.avatar = parse(self.rows)
        self.lost = 0
        self._facing = (0, 1)
        self.crush = 0
        self.bury = 0
        self.cut_cell = self.avatar
        self.tick = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=SKY, letter_box=BEDROCK,
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
        self.crush = 0
        self.bury = 0
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
            level.add_sprite(_tile(_static_pixels(self.rows[y][x], x, y), f"r_{x}_{y}", -1)
                             .set_position(x * CELL, y * CELL))
        for (x, y), kind in sorted(self.blocks.items()):
            level.add_sprite(_tile(BLOCK_FACES[kind](), f"b_{x}_{y}", 0)
                             .set_position(x * CELL, y * CELL))
        ax, ay = self.avatar
        level.add_sprite(_tile(_avatar(self._facing), "avatar", 1)
                         .set_position(ax * CELL, ay * CELL))

    def step(self) -> None:
        self.tick += 1

        if self.crush:
            self.crush -= 1
            if self.crush == 0:
                self.level_reset()
                self.complete_action()
            return

        if self.bury:
            self.bury -= 1
            if self.bury == 0:
                if is_won(self.blocks, self.lost):
                    self.next_level()
                self.complete_action()
            return

        act = self.action.id
        if act == GameAction.ACTION7:
            self.complete_action()
            return

        if act in (GameAction.ACTION1, GameAction.ACTION2):
            self._facing = (0, -1) if act == GameAction.ACTION1 else (0, 1)
            self._redraw()
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
                self.cut_cell = faced_cell(self.avatar, self._facing)
                self.blocks, self.avatar = blocks, avatar
                self.lost += lost
                self._redraw()
                if crushed:
                    self.crush = self.CRUSH_FRAMES
                    return
                if lost:
                    self.bury = self.BURY_FRAMES
                    return
                if is_won(self.blocks, self.lost):
                    self.next_level()

        self.complete_action()
