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

VOID, STONE_HUE, GROUND_HUE, FLECK_HUE = 5, 14, 11, 12
SEAL_HUE = (8, 9, 13, 15)
PLATE_OFF, PLATE_ON = 7, 0
SANCTUM_HUE = 10
BODY = 5
FOE_BODY = 6
PROP_HUE = (6, 7, 10, 0, 12, 15)

BODY_SHAPE = ((0, 1, 1, 0), (1, 1, 1, 1), (0, 1, 1, 0), (1, 0, 0, 1))
FOE_SHAPE = ((1, 0, 0, 1), (1, 1, 1, 1), (0, 1, 1, 0), (1, 0, 0, 1))

CELL = 4
VIEW = 16
SCREEN = VIEW * CELL

STONE_CH, GROUND_CH, ROUGH_CH = "#", ".", ","


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
        '##,.,.#,##,.....#..########..#,.#....,,..#####......,#.,...##..##',
        '##.,,...#,.#...#..######.,...,.,,,...,..######...#,..,...#,,,..##',
        '##.#...#....,.,,..,######..,,,.,,###,.#.######.,#.,.,#.,..#.,,###',
        '###..,#.,,,...,...,#####....##,....#.,#.,#####,...,....,.#...,###',
        '##,..,..#.,#,#.#,..#####.....,#..#.,.....#####..#,,....,....,..##',
        '##.##,,#####..,,#..#####...,.,.#.#,..,...#####.,,,....#####,.#.##',
        '##,.#..#...#.#.,,..#####......#,,#...#.,.#####,,,,.,..#...#,#,###',
        '##,...,#...#,#.#...#######.....#...#..,#,#####.......,#.......###',
        '###,.,.#...#.#,...,#####.,,.,.#,,#.....#.,....,.#.,,..#...#.#..##',
        '##..,,.##.##.,.#...#####.,,.,.#.......,.,...,,##.,..#,#####...###',
        '##,,..##.,...,..,#,#####.,..#.........#.,#####..,..,.,...#.,#,.##',
        '##.,.,...#.#..,.#..#####......,.,.#.,#..,#####,.#,...,,......,,##',
        '##.,.#.........##..#####...#...#.,#..,...#####.,,,,......,.,...##',
        '##..,#.#....#..,..######..,#,,....#..,...#####..#.......#,..,#,##',
        '##,.,.,..,.,#..#,,.#####.,,#,,#.,#.#.,#,.#######..,,...,,,,#...##',
        '##.###.,###,.#..,..#####....,#...#....#..#####......,....#.,#..##',
        '##..,.,..,..#...#..#######,,,......#.....#####,..#....#.,...,.###',
        '##########.,####################..###############################',
        '##########,,####################..###############################',
        '##########.,####################..###############################',
        '##########..####################..###############################',
        '##########,.####################..###############################',
        '#####.,...,....,#.######.,........#....,.#####,....##.........###',
        '###.##..,..##..#..######,####,.......,,..#####..,..#..,#,.#...,##',
        '###...,...#...#.,#,#####,...#.,#..##,#...######,#.,,...#...#,.,##',
        '###,,.#.#,.,....#,.#####,....,......#.,#.#####........,,.#.#..###',
        '##..,.#....,,,..,..#####......##....,....#####.........,.##,...##',
        '##,.......,...#.,,######,,..,.#....,.,.#.#####.,..,..,.,.#.,...##',
        '##.#.,..#...,,.....#####..#...##.##...,.,#####.,.#.,,.......#.###',
        '##,,,,#...,,.##....#####......#...#.##...#####.#..##......,.,,,##',
        '##.#..#.,.....,#..,.,.,.,.,#,.#...####...,...,..,...,.,#,....,###',
        '##,,,....#,#,,...,......#,..#.#...#.#..#.,....,..,..,,,...#..,###',
        '##...,.##,,...#.#,.#####.,.#..#####,...#,#####,.,,.,,.#,....##.##',
        '##.,......#..#....,#####.......#..,....,.#####.,...,...,#.,,..,##',
        '##..#.#...#,...,.,,#####.,#.,,.....#.#...#####...,#.#....,....###',
        '##,,,......,,,,....#####.,,..,,,.,,..#,.,######...,,##..,,.....##',
        '##....#...#...#..#.#####......,#.#...#,.,#####,,.,....#,.#,...,##',
        '##,.#,..,....,..#..######.,...##.,,.###..#####,.,..#...,...,.####',
        '##.........,......######..#,.,.,..#.####.#####.#...#,..,.#...,.##',
        '##########..##########################################.,#########',
        '##########.,##########################################.,#########',
        '##########,.##########################################..#########',
        '##########,,##########################################..#########',
        '##########..##########################################.,#########',
        '##.,,,.#.#,....#########.#.#...........,.#####,....,.,...#.,,.,##',
        '##,#.#.#.#,#,.##########.,,...#,##,.##,..#####..........,,....,##',
        '##,...,....#.###########.,#.#.....#...,#.#####.....,,..#.....,.##',
        '##..,..,..,#....########.,.#,..,......,..#####,,,,,,....,#.....##',
        '##....,.,#....#..#######,#,...#......,,#,#####.#.##..##..,..,.###',
        '###..,#..#...,..,,,######,.#....#,..#,..#######..#....#..,....###',
        '##..#.,...,##...,#,#####..#.#...,..,.,#,.#####.,.,.....#.#,...###',
        '##...#....,...,#...######.,.,#..,....###.#####.##..,.,........###',
        '##.....##.##.#.#.#..,..,.#...#,...###.#.,#####...,#...######.####',
        '####.,##...#,,..................#..#.,...#####,..,#.#,#...#,..###',
        '##.,..,#...#..,...######....,....,......,#####,..#.,......#..#.##',
        '##.....#...#...,#.,######...,....,...,.,,#####.,,..,..#...##...##',
        '##..#..#####....#.,#####...,..,....,,,,.,#####,.#....,#####,#.,##',
        '##..,.#......,#,...######.#.##...........#####,,...,,...#.,,.####',
        '##...#.,.,.....,...#######.,.,..#..#.....#####.,.#,.....,#.....##',
        '####..,,...........#########.#...#....,..######..........#.,...##',
        '###,,,.,.,##...,..#########......#,.,,..,#####,.,#......,,.....##',
        '#################################################################',
        '#################################################################',
    ])

LEVELS = [
    dict(order=[0, 3],
         seals=[(3, 13, 0), (3, 14, 0), (3, 15, 0), (32, 30, 3), (54, 42, 0), (54, 43, 0), (54, 44, 0), (54, 45, 0), (55, 41, 0), (55, 42, 0), (55, 43, 0), (55, 44, 0)],
         foes=[],
         props=[(4, 29), (52, 7), (35, 6), (17, 14), (4, 6), (51, 55)]),
    dict(order=[2, 1],
         seals=[(32, 30, 1), (41, 11, 2), (42, 10, 2), (42, 11, 2), (43, 10, 2), (43, 11, 2), (44, 10, 2), (44, 11, 2), (45, 10, 2)],
         foes=[(2, 48, 1, 0, 5), (46, 2, 0, 1, 6)],
         props=[(4, 28), (52, 32), (35, 28), (17, 56), (4, 54), (52, 57)]),
    dict(order=[0, 2, 3],
         seals=[(10, 42, 0), (10, 43, 0), (10, 44, 0), (10, 45, 0), (11, 41, 0), (11, 42, 0), (11, 43, 0), (11, 44, 0), (19, 55, 0), (20, 54, 0), (20, 55, 0), (21, 54, 0), (21, 55, 0), (22, 54, 0), (22, 55, 0), (23, 54, 0), (32, 30, 3), (54, 42, 2), (54, 43, 2), (54, 44, 2), (54, 45, 2), (55, 41, 2), (55, 42, 2), (55, 43, 2), (55, 44, 2)],
         foes=[(10, 2, 1, 0, 5), (8, 46, 0, 1, 6), (46, 46, 1, 0, 7)],
         props=[(4, 26), (52, 54), (36, 30), (24, 11), (6, 29), (54, 60)]),
    dict(order=[3, 0, 1],
         seals=[(10, 20, 3), (10, 21, 3), (10, 22, 3), (10, 23, 3), (11, 19, 3), (11, 20, 3), (11, 21, 3), (11, 22, 3), (32, 30, 1), (41, 11, 0), (42, 10, 0), (42, 11, 0), (43, 10, 0), (43, 11, 0), (44, 10, 0), (44, 11, 0), (45, 10, 0)],
         foes=[(46, 46, 1, 0, 5), (5, 2, 0, 1, 6), (46, 5, 1, 0, 7), (24, 24, 0, 1, 5)],
         props=[(4, 26), (52, 61), (36, 14), (21, 32), (6, 30), (54, 52)]),
    dict(order=[0, 2, 1, 3],
         seals=[(10, 42, 0), (10, 43, 0), (10, 44, 0), (10, 45, 0), (11, 41, 0), (11, 42, 0), (11, 43, 0), (11, 44, 0), (19, 55, 0), (20, 54, 0), (20, 55, 0), (21, 54, 0), (21, 55, 0), (22, 54, 0), (22, 55, 0), (23, 54, 0), (32, 30, 3), (41, 11, 2), (42, 10, 2), (42, 11, 2), (43, 10, 2), (43, 11, 2), (44, 10, 2), (44, 11, 2), (45, 10, 2), (54, 42, 1), (54, 43, 1), (54, 44, 1), (54, 45, 1), (55, 41, 1), (55, 42, 1), (55, 43, 1), (55, 44, 1)],
         foes=[(10, 2, 1, 0, 5), (8, 46, 0, 1, 6), (46, 5, 1, 0, 7), (48, 46, 0, 1, 5), (24, 24, 1, 0, 6)],
         props=[(4, 26), (53, 18), (37, 11), (25, 15), (8, 13), (56, 57)]),
    dict(order=[3, 2, 1, 0],
         seals=[(10, 20, 1), (10, 21, 1), (10, 22, 1), (10, 23, 1), (10, 42, 3), (10, 43, 3), (10, 44, 3), (10, 45, 3), (11, 19, 1), (11, 20, 1), (11, 21, 1), (11, 22, 1), (11, 41, 3), (11, 42, 3), (11, 43, 3), (11, 44, 3), (19, 55, 3), (20, 54, 3), (20, 55, 3), (21, 54, 3), (21, 55, 3), (22, 54, 3), (22, 55, 3), (23, 54, 3), (32, 30, 0), (41, 11, 2), (42, 10, 2), (42, 11, 2), (43, 10, 2), (43, 11, 2), (44, 10, 2), (44, 11, 2), (45, 10, 2)],
         foes=[(46, 46, 1, 0, 5), (8, 46, 0, 1, 6), (46, 5, 1, 0, 7), (5, 2, 0, 1, 5), (24, 24, 1, 0, 6), (27, 2, 0, 1, 7)],
         props=[(4, 26), (53, 40), (37, 56), (25, 55), (9, 6), (57, 55)]),
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


def _stamp(patch: np.ndarray, shape: tuple, hue: int) -> None:
    for r, row in enumerate(shape):
        for c, on in enumerate(row):
            if on:
                patch[r, c] = hue


class Window(RenderableUserDisplay):

    def __init__(self, game: "Shrines") -> None:
        super().__init__()
        self._g = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._g
        lv = g.arrangement
        frame[:] = VOID
        for sy in range(VIEW):
            for sx in range(VIEW):
                wx, wy = sx + g.cam_x, sy + g.cam_y
                if not (0 <= wx < GROUND.w and 0 <= wy < GROUND.h):
                    continue
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                ch = GROUND.at(wx, wy)
                if ch == STONE_CH:
                    patch[:] = STONE_HUE
                    continue
                patch[:] = GROUND_HUE
                if ch == ROUGH_CH:
                    dec = _hash(wx, wy, 5)
                    patch[dec % 4, (dec >> 3) % 4] = FLECK_HUE
                    patch[(dec >> 6) % 4, (dec >> 9) % 4] = FLECK_HUE

                colour = lv.seals.get((wx, wy))
                if colour is not None and colour not in g.lit:
                    patch[:] = SEAL_HUE[colour]
                    patch[1:3, 1:3] = VOID

                if (wx, wy) == GROUND.sanctum:
                    patch[:] = SANCTUM_HUE
                    patch[1:3, 1:3] = VOID

                if (wx, wy) in GROUND.shrines:
                    i = GROUND.shrines.index((wx, wy))
                    patch[:] = PLATE_ON if i in g.lit else PLATE_OFF
                    patch[1:3, 1:3] = VOID

        for i, q in enumerate(lv.props):
            sx, sy = q["pos"][0] - g.cam_x, q["pos"][1] - g.cam_y
            if 0 <= sx < VIEW and 0 <= sy < VIEW:
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                patch[:] = q["hue"]
                patch[1:3, 1:3] = VOID if (g.beat + i) % 4 < 2 else q["hue"]

        for f in g.foes:
            sx, sy = f["x"] - g.cam_x, f["y"] - g.cam_y
            if 0 <= sx < VIEW and 0 <= sy < VIEW:
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                _stamp(patch, FOE_SHAPE, FOE_BODY)

        sx, sy = g.x - g.cam_x, g.y - g.cam_y
        if 0 <= sx < VIEW and 0 <= sy < VIEW:
            patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
            _stamp(patch, BODY_SHAPE, BODY)

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
        if GROUND.stone(x, y):
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
        if self.passable(nx, ny):
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
