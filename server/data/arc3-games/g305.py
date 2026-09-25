# ARC-AGI-3 candidate task g305.

from __future__ import annotations

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

from sprite_book import (altar, brick, bush, critter, doorway, flower, gate, pine, pond,
                         stamp, thorns, tree, walker)

VOID, STONE_HUE, GROUND_HUE = 5, 14, 11
BRICK_FACE, BRICK_MORTAR = 12, 13
SEAL_HUE = (8, 9, 15, 1)
PLATE_OFF, PLATE_ON = 7, 0
SANCTUM_HUE = 10
BODY = 5
FOE_BODY = 6
PROP_HUE = (6, 7, 10, 0, 12, 15)
SHADE, TRUNK, WATER, CREST = 5, 13, 9, 10

CELL = 4
VIEW = 16
SCREEN = VIEW * CELL

STONE_CH, GROUND_CH, ROUGH_CH, THORN_CH = "#", ".", ",", "x"
CORNERS = ((-1, -1, 0, 0), (1, -1, 3, 0), (-1, 1, 0, 3), (1, 1, 3, 3))


def _hash(x: int, y: int, salt: int) -> int:
    n = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    n = (n ^ (n >> 13)) & 0xFFFFFFFF
    n = (n * 1274126177) & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFFFFFF


WORLD = dict(
    w=65, h=65, start=(27, 27),
    shrines=[(9, 9), (56, 9), (9, 56), (56, 56)],
    sanctum=(32, 32), sanctum_door=(32, 30),
    rows=[
        '#################################################################',
        '#################################################################',
        '#########....####################################################',
        '#########..........###########################....###############',
        '#########..........###########################............#######',
        '#####.........##...###########################..x.....x......####',
        '#####.........################################....##.........####',
        '#####..#####..######################################..#####..####',
        '#####..#...#..################################...###..#...#..####',
        '#####..#...#..###############....######..#####........#......####',
        '#####..#...#..###############.........................#...#..####',
        '#####..##.##..###############....................###..#####..####',
        '#####.........##########....#..x.######..###########.........####',
        '##............##########..x......###################.....x.....##',
        '##.....##..#############.........#######################.....x.##',
        '##.....##..#############....###..########################......##',
        '#########..##############...###..##########################....##',
        '########....#############.x.##....##########################.x.##',
        '########....#############...##....##########################...##',
        '##########..####################..###############################',
        '##########..####################..###############################',
        '##########..####################..###############################',
        '##########..####################..###############################',
        '##########..####################..###############################',
        '######......####################......###########################',
        '###..........##....#############..x......#####....###############',
        '###..............x.#######...###.......x.#####...........########',
        '###................#######...##..........#####..x...x..x.########',
        '#######......##....#########.........#########...........########',
        '#######..##..###############.........#########....####....#######',
        '#######..##..###############..##.##..#########.x.#####..x.#######',
        '#######..#.......###########..#...#..##..#####............#######',
        '#######.......................#...#.......................#######',
        '#######.......................#...#..............#####..#########',
        '#########........###########..#####..##..#############..#########',
        '#########....###############.........#################..#########',
        '#########....###############.........#################..#########',
        '##########..##########################################..#########',
        '##########..##########################################..#########',
        '##########..#########################################....########',
        '##########..#########################################....########',
        '##########..##########################################..#########',
        '##########..##########################################..#########',
        '##########..##########################################..#########',
        '##########..##########################################..#########',
        '##########..##########################################..#########',
        '##########..##########################################....#######',
        '##########..##########################################.x..#######',
        '##########..##########################################....#######',
        '##########..###########################################..########',
        '##########..###########################################..########',
        '##########..###########################################..########',
        '#####.........######################################.........####',
        '#####.........###..#####...####....#################.........####',
        '#####..##.##.......................#################..#####..####',
        '#####..#...#....................x..#################..#...#..####',
        '#####..#...#..###..#####...####....##############.........#..####',
        '#####..#...#..##################..###....########.....#...#..####',
        '##.....#####..##################.......x.########..#..#####..####',
        '##............###################........#######.............####',
        '##............#######################....######..............####',
        '##....################################...######...x.#############',
        '###...################################...######.....#############',
        '#################################################################',
        '#################################################################',
    ])

LEVELS = [
    dict(order=[0, 3],
         seals=[(3, 13, 0), (3, 14, 0), (3, 15, 0), (32, 30, 3), (54, 42, 0), (54, 43, 0), (54, 44, 0), (54, 45, 0), (55, 41, 0), (55, 42, 0), (55, 43, 0), (55, 44, 0)],
         foes=[],
         props=[(8, 10), (46, 6), (12, 26), (54, 37), (27, 16), (2, 15)]),
    dict(order=[2, 1],
         seals=[(32, 30, 1), (41, 11, 2), (42, 10, 2), (42, 11, 2), (43, 10, 2), (43, 11, 2), (44, 10, 2), (44, 11, 2), (45, 10, 2)],
         foes=[(5, 52, 1, 0, 5), (52, 4, 0, 1, 6)],
         props=[(8, 10), (47, 11), (13, 31), (56, 6), (31, 27), (7, 26)]),
    dict(order=[0, 2, 3],
         seals=[(10, 42, 0), (10, 43, 0), (10, 44, 0), (10, 45, 0), (11, 41, 0), (11, 42, 0), (11, 43, 0), (11, 44, 0), (19, 55, 0), (20, 54, 0), (20, 55, 0), (21, 54, 0), (21, 55, 0), (22, 54, 0), (22, 55, 0), (23, 54, 0), (32, 30, 3), (54, 42, 2), (54, 43, 2), (54, 44, 2), (54, 45, 2), (55, 41, 2), (55, 42, 2), (55, 43, 2), (55, 44, 2)],
         foes=[(9, 3, 1, 0, 5), (10, 46, 0, 1, 6), (52, 52, 1, 0, 7)],
         props=[(8, 6), (49, 27), (24, 14), (2, 61), (40, 33), (13, 11)]),
    dict(order=[3, 0, 1],
         seals=[(10, 20, 3), (10, 21, 3), (10, 22, 3), (10, 23, 3), (11, 19, 3), (11, 20, 3), (11, 21, 3), (11, 22, 3), (32, 30, 1), (41, 11, 0), (42, 10, 0), (42, 11, 0), (43, 10, 0), (43, 11, 0), (44, 10, 0), (44, 11, 0), (45, 10, 0)],
         foes=[(52, 52, 1, 0, 5), (12, 2, 0, 1, 6), (46, 4, 1, 0, 7), (32, 24, 0, 1, 5)],
         props=[(8, 6), (49, 29), (19, 54), (62, 15), (39, 25), (12, 33)]),
    dict(order=[0, 2, 1, 3],
         seals=[(10, 42, 0), (10, 43, 0), (10, 44, 0), (10, 45, 0), (11, 41, 0), (11, 42, 0), (11, 43, 0), (11, 44, 0), (19, 55, 0), (20, 54, 0), (20, 55, 0), (21, 54, 0), (21, 55, 0), (22, 54, 0), (22, 55, 0), (23, 54, 0), (32, 30, 3), (41, 11, 2), (42, 10, 2), (42, 11, 2), (43, 10, 2), (43, 11, 2), (44, 10, 2), (44, 11, 2), (45, 10, 2), (54, 42, 1), (54, 43, 1), (54, 44, 1), (54, 45, 1), (55, 41, 1), (55, 42, 1), (55, 43, 1), (55, 44, 1)],
         foes=[(9, 3, 1, 0, 5), (10, 46, 0, 1, 6), (46, 4, 1, 0, 7), (56, 46, 0, 1, 5), (32, 26, 1, 0, 6)],
         props=[(8, 6), (52, 5), (29, 11), (8, 30), (52, 53), (29, 55)]),
    dict(order=[3, 2, 1, 0],
         seals=[(10, 20, 1), (10, 21, 1), (10, 22, 1), (10, 23, 1), (10, 42, 3), (10, 43, 3), (10, 44, 3), (10, 45, 3), (11, 19, 1), (11, 20, 1), (11, 21, 1), (11, 22, 1), (11, 41, 3), (11, 42, 3), (11, 43, 3), (11, 44, 3), (19, 55, 3), (20, 54, 3), (20, 55, 3), (21, 54, 3), (21, 55, 3), (22, 54, 3), (22, 55, 3), (23, 54, 3), (32, 30, 0), (41, 11, 2), (42, 10, 2), (42, 11, 2), (43, 10, 2), (43, 11, 2), (44, 10, 2), (44, 11, 2), (45, 10, 2)],
         foes=[(52, 52, 1, 0, 5), (10, 46, 0, 1, 6), (46, 4, 1, 0, 7), (12, 2, 0, 1, 5), (32, 26, 1, 0, 6), (32, 9, 0, 1, 7)],
         props=[(8, 6), (53, 8), (31, 13), (9, 57), (55, 6), (33, 32)]),
]


class Ground:

    def __init__(self, spec: dict) -> None:
        self.w, self.h = spec["w"], spec["h"]
        self.rows = spec["rows"]
        self.start = tuple(spec["start"])
        self.shrines = [tuple(s) for s in spec["shrines"]]
        self.sanctum = tuple(spec["sanctum"])
        self.sanctum_door = tuple(spec["sanctum_door"])

    def at(self, x: int, y: int) -> str:
        if not (0 <= x < self.w and 0 <= y < self.h):
            return STONE_CH
        return self.rows[y][x]

    def stone(self, x: int, y: int) -> bool:
        return self.at(x, y) == STONE_CH

    def thorn(self, x: int, y: int) -> bool:
        return self.at(x, y) == THORN_CH


GROUND = Ground(WORLD)


class Arrangement:

    def __init__(self, spec: dict) -> None:
        self.order = list(spec["order"])
        self.seals = {(x, y): c for x, y, c in spec["seals"]}
        self.foes = [dict(ox=ox, oy=oy, dx=dx, dy=dy, ln=ln)
                     for ox, oy, dx, dy, ln in spec["foes"]]
        self.props = [dict(pos=tuple(p), hue=PROP_HUE[i % len(PROP_HUE)])
                      for i, p in enumerate(spec["props"])]


ARRANGEMENTS = [Arrangement(s) for s in LEVELS]


def build_levels() -> list[Level]:
    return [Level(sprites=[Sprite(pixels=[[VOID] * CELL] * CELL, name="body",
                                  blocking=BlockingMode.NOT_BLOCKED,
                                  interaction=InteractionMode.INTANGIBLE, layer=1)
                           .set_position(GROUND.start[0] * CELL,
                                         GROUND.start[1] * CELL)])
            for _ in ARRANGEMENTS]


def _building(x: int, y: int) -> bool:
    return any(abs(x - bx) <= 2 and abs(y - by) <= 2
               for bx, by in GROUND.shrines + [GROUND.sanctum])


def _scenery(wx: int, wy: int):
    if not GROUND.stone(wx, wy) or _building(wx, wy):
        return None
    k = _hash(wx, wy, 7)
    wood = _hash(wx // 7, wy // 7, 17) % 3 == 0
    if wx % 2 == 0 and wy % 2 == 0 and all(
            GROUND.stone(wx + a, wy + b) and not _building(wx + a, wy + b)
            for a in (-1, 0, 1, 2) for b in (-1, 0, 1, 2)):
        if wood:
            return "pine" if k % 4 else "tree"
        if k % 5 == 0:
            return "pond" if k % 3 == 0 else "tree"
        return None
    if k % 7 == 1 and any(not GROUND.stone(wx + a, wy + b)
                          for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
        return "bush"
    return None


class Window(RenderableUserDisplay):

    def __init__(self, game: "Shrines") -> None:
        super().__init__()
        self._g = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._g
        lv = g.arrangement
        frame[:] = STONE_HUE
        stone = GROUND.stone
        for sy in range(VIEW):
            for sx in range(VIEW):
                wx, wy = sx + g.cam_x, sy + g.cam_y
                X, Y = sx * CELL, sy * CELL
                patch = frame[Y:Y + CELL, X:X + CELL]
                if stone(wx, wy):
                    if _building(wx, wy):
                        stamp(patch, 0, 0, brick(BRICK_FACE, BRICK_MORTAR, wy))
                        continue
                    for dx, dy, px, py in CORNERS:
                        if not stone(wx + dx, wy) and not stone(wx, wy + dy):
                            patch[py, px] = GROUND_HUE
                    continue
                patch[:] = GROUND_HUE
                if GROUND.thorn(wx, wy):
                    stamp(patch, 0, 0, thorns(FOE_BODY))
                for dx, dy, px, py in CORNERS:
                    if (stone(wx + dx, wy) and stone(wx, wy + dy)
                            and not _building(wx + dx, wy) and not _building(wx, wy + dy)):
                        patch[py, px] = STONE_HUE

        for sy in range(-1, VIEW):
            for sx in range(-1, VIEW):
                wx, wy = sx + g.cam_x, sy + g.cam_y
                kind = _scenery(wx, wy)
                if kind is None:
                    continue
                art = {"tree": lambda: tree(STONE_HUE, SHADE, TRUNK),
                       "pine": lambda: pine(STONE_HUE, SHADE, TRUNK),
                       "pond": lambda: pond(WATER, CREST, g.beat % 4),
                       "bush": lambda: bush(STONE_HUE, SHADE)}[kind]()
                stamp(frame, sx * CELL, sy * CELL, art)

        def at(cell):
            return (cell[0] - g.cam_x) * CELL, (cell[1] - g.cam_y) * CELL

        for (wx, wy), colour in lv.seals.items():
            if colour not in g.lit:
                stamp(frame, *at((wx, wy)), gate(SEAL_HUE[colour]))
        for i, cell in enumerate(GROUND.shrines):
            stamp(frame, *at(cell),
                  altar(PLATE_OFF, VOID, PLATE_ON if i in g.lit else None))
        stamp(frame, *at(GROUND.sanctum), doorway(SANCTUM_HUE, VOID))

        for i, q in enumerate(lv.props):
            stamp(frame, *at(q["pos"]),
                  flower(q["hue"], GROUND_HUE if q["hue"] == 0 else 0, STONE_HUE,
                         (g.beat + i) % 4 < 2))

        for f in g.foes:
            stamp(frame, *at((f["x"], f["y"])), critter(FOE_BODY))
        stamp(frame, *at((g.x, g.y)), walker(BODY))

        if g.hit:
            frame[0, :] = FOE_BODY
            frame[SCREEN - 1, :] = FOE_BODY
            frame[:, 0] = FOE_BODY
            frame[:, SCREEN - 1] = FOE_BODY
        return frame


class Shrines(ARCBaseGame):

    FLASH_FRAMES = 5

    def __init__(self) -> None:
        self.arrangement = ARRANGEMENTS[0]
        self.cam_x = self.cam_y = 0
        self.x, self.y = GROUND.start
        self.lit: set = set()
        self.anchor = GROUND.start
        self.foes: list = []
        self.flash = 0
        self.hit = 0
        self.beat = 0
        camera = Camera(width=SCREEN, height=SCREEN, background=VOID, letter_box=VOID,
                        interfaces=[Window(self)])
        super().__init__(game_id="g305", levels=build_levels(),
                         available_actions=[1, 2, 3, 4], camera=camera)
        self._enter(0)

    def _enter(self, index: int) -> None:
        lv = self.arrangement = ARRANGEMENTS[index]
        self.x, self.y = GROUND.start
        self.lit = set()
        self.anchor = GROUND.start
        self.foes = [dict(x=f["ox"], y=f["oy"], ox=f["ox"], oy=f["oy"], dx=f["dx"],
                          dy=f["dy"], ln=f["ln"], t=0, back=False) for f in lv.foes]
        self.flash = 0
        self.hit = 0
        self._follow()
        self._sync()

    def on_set_level(self, level: Level) -> None:
        self._enter(self.level_index)

    def level_reset(self) -> None:
        super().level_reset()
        self._enter(self.level_index)

    def full_reset(self) -> None:
        super().full_reset()
        self._enter(self.level_index)

    def _sync(self) -> None:
        found = self.current_level.get_sprites_by_name("body")
        if found:
            found[0].set_position(self.x * CELL, self.y * CELL)

    def _follow(self) -> None:
        self.cam_x = max(0, min(max(0, GROUND.w - VIEW), self.x - VIEW // 2))
        self.cam_y = max(0, min(max(0, GROUND.h - VIEW), self.y - VIEW // 2))
        self.camera.x = self.cam_x * CELL
        self.camera.y = self.cam_y * CELL

    def passable(self, x: int, y: int) -> bool:
        if GROUND.stone(x, y) or GROUND.thorn(x, y):
            return False
        colour = self.arrangement.seals.get((x, y))
        return colour is None or colour in self.lit

    def _step_foes(self) -> None:
        for f in self.foes:
            f["t"] += -1 if f["back"] else 1
            if f["t"] >= f["ln"]:
                f["t"], f["back"] = f["ln"], True
            elif f["t"] <= 0:
                f["t"], f["back"] = 0, False
            f["x"], f["y"] = f["ox"] + f["dx"] * f["t"], f["oy"] + f["dy"] * f["t"]

    def _caught(self) -> bool:
        return any((f["x"], f["y"]) == (self.x, self.y) for f in self.foes)

    def _send_back(self) -> None:
        self.x, self.y = self.anchor
        self.hit = 1
        self._follow()

    def step(self) -> None:
        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.next_level()
                self.complete_action()
            return

        self.hit = 0
        self.beat += 1
        delta = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                 GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                     self.action.id)
        if delta is None:
            self.complete_action()
            return

        nx, ny = self.x + delta[0], self.y + delta[1]
        if GROUND.thorn(nx, ny):
            self._send_back()
        elif self.passable(nx, ny):
            self.x, self.y = nx, ny
            if (nx, ny) in GROUND.shrines:
                i = GROUND.shrines.index((nx, ny))
                self.lit.add(i)
                self.anchor = (nx, ny)
            if (nx, ny) == GROUND.sanctum:
                self.flash = self.FLASH_FRAMES
                self._follow()
                self._sync()
                return

        self._step_foes()
        if self._caught():
            self._send_back()
        self._follow()
        self._sync()
        self.complete_action()
