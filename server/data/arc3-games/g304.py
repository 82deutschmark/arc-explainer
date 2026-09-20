# ARC-AGI-3 candidate task g304.

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

VOID, FLOOR, WALL = 5, 4, 3
BODY, IDLE = 0, 2
FOE_BODY, FOE_CORE = 12, 13
MARK_OFF, MARK_ON = 15, 14
KEY_HUE = (6, 10, 11)
HOSTILE, WARDEN = 0, 1
WARD_BODY, WARD_CORE = 10, 9
BOOTS, BLADE, ANCHOR = 0, 1, 2
GEAR_HUE = (14, 8, 11)
RUBBLE = 2
PROP_HUE = (6, 7, 10, 11, 12, 15, 14)
PLATE = (6, 7, 10, 11, 12, 15, 14)

CELL = 4
VIEW = 16
SCREEN = VIEW * CELL

CIRCLE, SQUARE, TRI = 0, 1, 2
PINK, CYAN, GOLD = 0, 1, 2

RUNE_HUE = (6, 7, 10, 11, 12, 15, 14, 9, 8, 1, 0, 13, 2, 11, 10, 6)


def _hash(x: int, y: int, salt: int) -> int:
    n = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    n = (n ^ (n >> 13)) & 0xFFFFFFFF
    n = (n * 1274126177) & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFFFFFF


SPECS = [
    dict(cols=3, rows=2, roomW=12, roomH=12, gap=3,
         links=[((0,0),(1,0)), ((0,0),(0,1)), ((0,1),(1,1)), ((1,1),(2,1)), ((1,0),(2,0))],
         start=(0,0,3,3), startKey=(CIRCLE, PINK),
         tiles=[(1,1,6,6,"c",CYAN), (0,1,3,9,"s",SQUARE), (2,1,8,6,"c",GOLD)],
         doors=[((1,0),(2,0),CIRCLE,CYAN)],
         gates=[],
         exit=(2,0,8,6,SQUARE,GOLD),
         marks=[(0,0,8,8,0), (1,1,3,3,1), (2,1,3,8,2), (0,1,8,3,3)],
         gear=[(0,1,8,8,BOOTS)],
         rubble=[(1,1,5,6), (1,1,5,7), (1,1,6,7)],
         props=[(0,0,6,6,"#ff2d95"), (1,0,4,8,"#00e5ff"), (2,1,6,4,"#b14bff"), (0,1,9,8,"#9dff3c")],
         foes=[(1,1,2,6,1,0,8,HOSTILE)]),
    dict(cols=3, rows=3, roomW=12, roomH=12, gap=3,
         links=[((0,0),(1,0)), ((1,0),(2,0)), ((0,0),(0,1)), ((0,1),(0,2)), ((0,2),(1,2)), ((1,2),(2,2)), ((2,0),(2,1))],
         start=(0,0,3,3), startKey=(CIRCLE, PINK),
         tiles=[(0,2,3,3,"s",TRI), (2,2,8,8,"c",GOLD), (1,2,6,6,"s",SQUARE), (0,1,6,6,"c",CYAN)],
         doors=[((2,0),(2,1),TRI,GOLD)],
         gates=[((0,0),(0,1),(4, 5))],
         exit=(2,1,6,8,SQUARE,CYAN),
         marks=[(1,0,3,3,4), (2,0,8,8,5), (0,0,8,8,0), (0,1,3,3,1), (0,2,8,3,2), (1,2,3,8,6), (2,2,3,3,7)],
         gear=[(0,1,8,8,BOOTS), (2,0,4,4,ANCHOR)],
         rubble=[(0,2,5,5), (0,2,6,5), (1,2,7,7)],
         props=[(0,0,5,9,"#ffd400"), (0,1,6,7,"#ff2d95"), (1,2,4,4,"#00e5ff"), (2,2,8,9,"#b14bff"), (1,0,8,3,"#ff6a00")],
         foes=[(0,1,6,2,0,1,8,HOSTILE), (1,2,2,6,1,0,8,HOSTILE), (1,2,4,4,0,1,6,WARDEN)]),
    dict(cols=4, rows=3, roomW=12, roomH=12, gap=3,
         links=[((0,0),(1,0)), ((1,0),(2,0)), ((1,0),(1,1)), ((0,0),(0,1)), ((0,1),(0,2)), ((0,2),(1,2)), ((1,2),(2,2)), ((2,0),(3,0)), ((3,0),(3,1)), ((3,1),(3,2))],
         start=(0,0,3,3), startKey=(CIRCLE, PINK),
         tiles=[(0,2,3,3,"s",SQUARE), (1,1,6,6,"c",CYAN), (3,0,6,9,"c",PINK), (1,2,8,3,"s",CIRCLE), (2,2,6,6,"c",GOLD), (0,1,3,8,"s",TRI)],
         doors=[((2,0),(3,0),SQUARE,CYAN), ((3,1),(3,2),TRI,GOLD)],
         gates=[((0,0),(0,1),(4, 5, 6))],
         exit=(3,2,8,6,CIRCLE,PINK),
         marks=[(1,0,3,3,4), (2,0,8,8,5), (1,1,3,8,6), (0,0,8,8,0), (0,1,8,3,1), (0,2,8,8,2), (1,2,3,3,7), (2,2,8,3,8), (3,0,3,3,9), (3,1,8,8,10)],
         gear=[(0,1,3,3,BOOTS), (1,1,8,8,BLADE), (2,2,3,9,ANCHOR)],
         rubble=[(1,2,5,5), (1,2,6,5), (0,2,8,9), (2,2,4,4)],
         props=[(0,0,5,9,"#ffd400"), (1,0,3,4,"#ff6a00"), (0,2,7,8,"#ff2d95"), (2,2,7,7,"#9dff3c"), (3,0,7,8,"#00e5ff"), (1,1,3,9,"#b14bff")],
         foes=[(1,0,2,6,1,0,8,HOSTILE), (0,1,6,2,0,1,8,HOSTILE), (2,2,2,6,1,0,8,HOSTILE), (1,0,4,4,0,1,6,WARDEN), (2,2,4,4,0,1,6,WARDEN)]),
    dict(cols=4, rows=3, roomW=12, roomH=12, gap=3,
         links=[((0,0),(1,0)), ((1,0),(2,0)), ((1,0),(1,1)), ((0,0),(0,1)), ((0,1),(0,2)), ((0,2),(1,2)), ((1,2),(2,2)), ((2,1),(2,2)), ((2,0),(3,0)), ((3,0),(3,1)), ((3,1),(3,2))],
         start=(0,0,3,3), startKey=(CIRCLE, PINK),
         second=(0,2,3,8), secondKey=(CIRCLE, PINK),
         tiles=[(1,1,6,6,"s",SQUARE), (2,1,6,6,"c",CYAN), (0,1,3,3,"s",TRI), (2,2,8,8,"c",GOLD)],
         doors=[((2,0),(3,0),SQUARE,CYAN)],
         gates=[((0,0),(0,1),(4, 5))],
         exit=(3,2,8,6,TRI,GOLD),
         marks=[(1,0,3,3,4), (2,0,8,8,5), (0,0,8,8,0), (0,1,8,3,1), (0,2,3,3,2), (1,1,3,8,6), (1,2,6,6,7), (2,1,3,3,8), (2,2,3,8,9), (3,0,6,6,10), (3,1,3,3,11)],
         gear=[(0,1,6,3,BOOTS), (1,2,8,4,BLADE), (2,2,4,9,ANCHOR)],
         rubble=[(1,1,5,5), (1,1,6,5), (2,2,7,4), (0,2,8,8)],
         props=[(0,0,5,9,"#ffd400"), (1,0,4,8,"#ff6a00"), (2,1,7,7,"#ff2d95"), (1,2,8,3,"#00e5ff"), (3,1,6,6,"#b14bff"), (0,1,4,9,"#9dff3c")],
         foes=[(1,0,2,9,1,0,8,HOSTILE), (2,1,2,2,0,1,8,HOSTILE), (1,2,2,6,1,0,8,HOSTILE), (0,1,6,2,0,1,8,HOSTILE), (1,2,4,4,0,1,6,WARDEN)]),
    dict(cols=4, rows=4, roomW=12, roomH=12, gap=3,
         links=[((0,0),(1,0)), ((1,0),(2,0)), ((1,0),(1,1)), ((0,0),(0,1)), ((0,1),(0,2)), ((0,2),(0,3)), ((0,3),(1,3)), ((1,3),(2,3)), ((2,2),(2,3)), ((2,1),(2,2)), ((2,0),(3,0)), ((3,0),(3,1)), ((3,1),(3,2)), ((3,2),(3,3))],
         start=(0,0,3,3), startKey=(CIRCLE, PINK),
         second=(0,3,3,8), secondKey=(CIRCLE, PINK),
         tiles=[(1,1,6,6,"s",TRI), (2,1,6,6,"c",GOLD), (0,2,3,3,"s",SQUARE), (1,3,6,6,"c",CYAN), (2,2,8,8,"c",PINK), (0,1,8,8,"s",CIRCLE)],
         doors=[((2,0),(3,0),TRI,GOLD), ((3,1),(3,2),SQUARE,CYAN)],
         gates=[((0,0),(0,1),(4, 5, 6))],
         exit=(3,3,8,6,CIRCLE,PINK),
         marks=[(1,0,3,3,4), (2,0,8,8,5), (1,1,3,8,6), (0,0,8,8,0), (0,1,3,3,1), (0,2,8,8,2), (0,3,8,3,7), (1,3,3,3,8), (2,1,3,8,9), (2,2,3,3,10), (2,3,8,8,11), (3,0,6,6,12), (3,1,3,3,13)],
         gear=[(0,1,4,4,BOOTS), (1,1,7,7,BLADE), (2,2,6,6,ANCHOR), (1,3,3,9,BLADE)],
         rubble=[(0,2,5,6), (0,2,6,6), (2,2,4,8), (1,3,8,4), (2,1,6,9)],
         props=[(0,0,5,9,"#ffd400"), (1,0,4,4,"#ff6a00"), (2,1,7,4,"#ff2d95"), (0,3,6,6,"#00e5ff"), (2,3,4,9,"#b14bff"), (3,0,5,5,"#9dff3c")],
         foes=[(1,0,2,9,1,0,8,HOSTILE), (2,1,2,2,0,1,8,HOSTILE), (0,2,6,2,0,1,8,HOSTILE), (2,3,2,6,1,0,8,HOSTILE), (0,1,6,2,0,1,8,HOSTILE), (2,3,4,4,0,1,6,WARDEN), (1,0,4,7,0,1,4,WARDEN)]),
    dict(cols=5, rows=4, roomW=12, roomH=12, gap=3,
         links=[((0,0),(1,0)), ((1,0),(2,0)), ((1,0),(1,1)), ((0,0),(0,1)), ((0,1),(0,2)), ((0,2),(0,3)), ((0,3),(1,3)), ((1,3),(2,3)), ((2,2),(2,3)), ((2,1),(2,2)), ((2,0),(3,0)), ((3,0),(4,0)), ((3,0),(3,1)), ((3,1),(3,2)), ((3,2),(3,3)), ((4,0),(4,1)), ((4,1),(4,2)), ((4,2),(4,3))],
         start=(0,0,3,3), startKey=(CIRCLE, PINK),
         second=(0,3,3,8), secondKey=(CIRCLE, PINK),
         tiles=[(1,1,6,6,"s",SQUARE), (2,2,6,6,"c",CYAN), (0,2,3,3,"c",GOLD), (1,3,6,6,"s",TRI), (2,1,8,8,"c",PINK), (0,1,8,3,"s",CIRCLE)],
         doors=[((2,0),(3,0),SQUARE,CYAN), ((3,0),(4,0),TRI,GOLD)],
         gates=[((0,0),(0,1),(4, 5, 6))],
         exit=(4,2,8,6,CIRCLE,PINK),
         marks=[(1,0,3,3,4), (2,0,8,8,5), (1,1,3,8,6), (0,0,8,8,0), (0,1,3,3,1), (0,2,8,8,2), (0,3,8,3,7), (1,3,3,3,8), (2,1,3,3,9), (2,2,8,3,10), (2,3,3,8,11), (3,0,3,3,12), (3,1,8,8,13), (4,0,6,6,14), (4,1,3,3,15)],
         gear=[(0,1,4,9,BOOTS), (1,1,8,4,BLADE), (2,2,4,4,ANCHOR), (1,3,8,8,BLADE), (3,1,5,5,ANCHOR)],
         rubble=[(0,2,5,7), (0,2,6,7), (1,3,4,5), (2,1,7,8), (3,2,6,6), (2,2,9,3)],
         props=[(0,0,5,9,"#ffd400"), (1,0,4,4,"#ff6a00"), (2,1,5,3,"#ff2d95"), (0,3,6,6,"#00e5ff"), (2,3,8,4,"#b14bff"), (4,1,6,6,"#9dff3c"), (3,0,8,8,"#ff4f6d")],
         foes=[(1,0,2,9,1,0,8,HOSTILE), (2,1,2,2,0,1,8,HOSTILE), (0,2,6,2,0,1,8,HOSTILE), (2,3,2,6,1,0,8,HOSTILE), (3,1,2,9,1,0,8,HOSTILE), (0,1,6,2,0,1,8,HOSTILE), (2,3,4,4,0,1,6,WARDEN), (1,0,4,7,0,1,4,WARDEN), (3,1,4,7,0,1,4,WARDEN)]),
]


class World:

    def __init__(self, spec: dict) -> None:
        P, Q = spec["roomW"] + spec["gap"], spec["roomH"] + spec["gap"]
        self.rx = lambda c: 1 + c * P
        self.ry = lambda r: 1 + r * Q
        self.w = 2 + (spec["cols"] - 1) * P + spec["roomW"]
        self.h = 2 + (spec["rows"] - 1) * Q + spec["roomH"]

        rects = []
        for r in range(spec["rows"]):
            for c in range(spec["cols"]):
                rects.append((self.rx(c), self.ry(r), spec["roomW"], spec["roomH"]))
        for (c1, r1), (c2, r2) in spec["links"]:
            if r1 == r2:
                rects.append((self.rx(c1) + spec["roomW"],
                              self.ry(r1) + spec["roomH"] // 2 - 1, spec["gap"], 2))
            else:
                rects.append((self.rx(c1) + spec["roomW"] // 2 - 1,
                              self.ry(r1) + spec["roomH"], 2, spec["gap"]))

        self.grid = [["#"] * self.w for _ in range(self.h)]
        for x, y, w, h in rects:
            for j in range(y, y + h):
                for i in range(x, x + w):
                    if 0 <= j < self.h and 0 <= i < self.w:
                        self.grid[j][i] = "."

        at = lambda c, r, x, y: (self.rx(c) + x, self.ry(r) + y)

        def hall_mid(a, b):
            (c1, r1), (c2, r2) = a, b
            if r1 == r2:
                return (self.rx(c1) + spec["roomW"] + spec["gap"] // 2,
                        self.ry(r1) + spec["roomH"] // 2 - 1, True)
            return (self.rx(c1) + spec["roomW"] // 2 - 1,
                    self.ry(r1) + spec["roomH"] + spec["gap"] // 2, False)

        self.start = at(*spec["start"][:2], *spec["start"][2:])
        self.start_key = list(spec["startKey"])
        self.second = at(*spec["second"][:2], *spec["second"][2:]) if "second" in spec else None
        self.second_key = list(spec.get("secondKey", spec["startKey"]))

        self.tiles = {}
        for c, r, x, y, fam, val in spec["tiles"]:
            self.tiles[at(c, r, x, y)] = (fam, val)

        self.doors = {}
        for a, b, s, col in spec["doors"]:
            mx, my, horiz = hall_mid(a, b)
            cells = [(mx, my), (mx, my + 1)] if horiz else [(mx, my), (mx + 1, my)]
            for cc in cells:
                self.doors[cc] = (s, col)
        self.gates = {}
        for a, b, need in spec["gates"]:
            mx, my, horiz = hall_mid(a, b)
            cells = [(mx, my), (mx, my + 1)] if horiz else [(mx, my), (mx + 1, my)]
            for cc in cells:
                self.gates[cc] = tuple(need)

        self.marks = {}
        for c, r, x, y, g in spec["marks"]:
            self.marks[at(c, r, x, y)] = g

        ex = spec["exit"]
        self.exit = at(ex[0], ex[1], ex[2], ex[3])
        self.exit_key = (ex[4], ex[5])

        for cc in list(self.doors) + list(self.gates) + [self.exit]:
            self.grid[cc[1]][cc[0]] = "."

        self.foes = []
        for c, r, x, y, dx, dy, ln, kind in spec["foes"]:
            ox, oy = at(c, r, x, y)
            self.foes.append(dict(ox=ox, oy=oy, dx=dx, dy=dy, ln=ln, kind=kind))

        self.gear = [dict(pos=at(c, r, x, y), kind=k) for c, r, x, y, k in spec.get("gear", [])]
        self.rubble = {at(c, r, x, y) for c, r, x, y in spec.get("rubble", [])}
        self.props = [dict(pos=at(c, r, x, y), hue=PROP_HUE[i % len(PROP_HUE)])
                      for i, (c, r, x, y, _hex) in enumerate(spec.get("props", []))]

    def solid(self, x: int, y: int) -> bool:
        return not (0 <= x < self.w and 0 <= y < self.h) or self.grid[y][x] == "#"


WORLDS = [World(s) for s in SPECS]


def build_levels() -> list[Level]:
    levels = []
    for wd in WORLDS:
        sprites = [Sprite(pixels=[[VOID] * CELL] * CELL, name="body0",
                          blocking=BlockingMode.NOT_BLOCKED,
                          interaction=InteractionMode.INTANGIBLE, layer=1)
                   .set_position(wd.start[0] * CELL, wd.start[1] * CELL)]
        if wd.second:
            sprites.append(Sprite(pixels=[[VOID] * CELL] * CELL, name="body1",
                                  blocking=BlockingMode.NOT_BLOCKED,
                                  interaction=InteractionMode.INTANGIBLE, layer=1)
                           .set_position(wd.second[0] * CELL, wd.second[1] * CELL))
        levels.append(Level(sprites=sprites))
    return levels


class Window(RenderableUserDisplay):

    def __init__(self, game: "Crawler") -> None:
        super().__init__()
        self._g = game

    def _cell(self, frame, sx, sy, colour):
        frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL] = colour

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._g
        wd = g.world
        frame[:] = VOID
        for sy in range(VIEW):
            for sx in range(VIEW):
                wx, wy = sx + g.cam_x, sy + g.cam_y
                if not (0 <= wx < wd.w and 0 <= wy < wd.h):
                    continue
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                if wd.grid[wy][wx] == "#":
                    patch[:] = WALL
                    dec = _hash(wx, wy, g.level_index + 1)
                    if dec % 5 == 0:
                        patch[:] = PLATE[(dec >> 5) % len(PLATE)]
                        patch[1:3, 1:3] = VOID
                    continue
                patch[:] = FLOOR

                if (wx, wy) in wd.rubble:
                    patch[:] = RUBBLE
                    patch[0, 0] = FLOOR
                    patch[3, 3] = FLOOR

                tile = wd.tiles.get((wx, wy))
                if tile:
                    fam, val = tile
                    if fam == "c":
                        patch[:] = KEY_HUE[val]
                        patch[1:3, 1:3] = FLOOR
                    else:
                        patch[:] = 1
                        patch[1:3, 1:3] = FLOOR
                        for px, py in _shape_pips(val):
                            patch[py, px] = VOID

                gnum = wd.marks.get((wx, wy))
                if gnum is not None:
                    on = gnum in g.lit
                    patch[:] = MARK_ON if on else MARK_OFF
                    patch[1:3, 1:3] = RUNE_HUE[gnum % len(RUNE_HUE)]

                door = wd.doors.get((wx, wy))
                if door and (wx, wy) not in g.opened:
                    patch[:] = KEY_HUE[door[1]]
                    patch[1:3, 1:3] = VOID
                    for px, py in _shape_pips(door[0]):
                        patch[py, px] = KEY_HUE[door[1]]

                gate = wd.gates.get((wx, wy))
                if gate and not g.gate_open(gate):
                    patch[:] = MARK_OFF
                    for k, need in enumerate(gate[:4]):
                        qx, qy = (k % 2) * 2, (k // 2) * 2
                        patch[qy:qy + 2, qx:qx + 2] = (
                            RUNE_HUE[need % len(RUNE_HUE)] if need in g.lit else VOID)

                if (wx, wy) == wd.exit:
                    patch[:] = KEY_HUE[wd.exit_key[1]]
                    patch[1:3, 1:3] = VOID
                    for px, py in _shape_pips(wd.exit_key[0]):
                        patch[py, px] = KEY_HUE[wd.exit_key[1]]

        for i, q in enumerate(wd.props):
            sx, sy = q["pos"][0] - g.cam_x, q["pos"][1] - g.cam_y
            if 0 <= sx < VIEW and 0 <= sy < VIEW:
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                patch[:] = q["hue"]
                patch[1:3, 1:3] = VOID if (g.beat + i) % 4 < 2 else q["hue"]

        for gp in wd.gear:
            if id(gp) in g.taken:
                continue
            sx, sy = gp["pos"][0] - g.cam_x, gp["pos"][1] - g.cam_y
            if 0 <= sx < VIEW and 0 <= sy < VIEW:
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                patch[:] = FLOOR
                hue = GEAR_HUE[gp["kind"]]
                if gp["kind"] == BOOTS:
                    patch[2:4, :] = hue
                elif gp["kind"] == BLADE:
                    patch[:, 1:3] = hue
                else:
                    patch[0, :] = hue
                    patch[:, 1:3] = hue

        for f in g.foes:
            if id(f) in g.dead:
                continue
            sx, sy = f["x"] - g.cam_x, f["y"] - g.cam_y
            if 0 <= sx < VIEW and 0 <= sy < VIEW:
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                ward = f["kind"] == WARDEN
                patch[:] = WARD_BODY if ward else FOE_BODY
                patch[1:3, 1:3] = WARD_CORE if ward else FOE_CORE
                if ward:
                    patch[0, 0] = VOID
                    patch[3, 3] = VOID

        for i, b in enumerate(g.bodies):
            sx, sy = b["x"] - g.cam_x, b["y"] - g.cam_y
            if 0 <= sx < VIEW and 0 <= sy < VIEW:
                patch = frame[sy * CELL:(sy + 1) * CELL, sx * CELL:(sx + 1) * CELL]
                patch[:] = BODY if i == g.active else IDLE
                patch[1:3, 1:3] = KEY_HUE[b["key"][1]]
                for px, py in _shape_pips(b["key"][0]):
                    patch[py, px] = VOID
                if BOOTS in b["gear"]:
                    patch[3, 0] = GEAR_HUE[BOOTS]
                    patch[3, 3] = GEAR_HUE[BOOTS]
                if BLADE in b["gear"]:
                    patch[0, 3] = GEAR_HUE[BLADE]
                if ANCHOR in b["gear"]:
                    patch[0, 0] = GEAR_HUE[ANCHOR]

        if g.hit:
            frame[0, :] = FOE_CORE
            frame[SCREEN - 1, :] = FOE_CORE
            frame[:, 0] = FOE_CORE
            frame[:, SCREEN - 1] = FOE_CORE
        return frame


def _shape_pips(shape: int):
    if shape == CIRCLE:
        return ((1, 1), (2, 2))
    if shape == SQUARE:
        return ((1, 2), (2, 1))
    return ((1, 1), (2, 1))


class Crawler(ARCBaseGame):

    FLASH_FRAMES = 5

    def __init__(self) -> None:
        self.world = WORLDS[0]
        self.cam_x = self.cam_y = 0
        self.bodies = []
        self.active = 0
        self.opened = set()
        self.lit = set()
        self.foes = []
        self.flash = 0
        self.hit = 0
        self.beat = 0
        camera = Camera(width=SCREEN, height=SCREEN, background=VOID, letter_box=VOID,
                        interfaces=[Window(self)])
        super().__init__(game_id="g304", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])
        self._enter(0)

    def _enter(self, index: int) -> None:
        wd = self.world = WORLDS[index]
        self.bodies = [dict(x=wd.start[0], y=wd.start[1], key=list(wd.start_key), gear=[])]
        if wd.second:
            self.bodies.append(dict(x=wd.second[0], y=wd.second[1],
                                    key=list(wd.second_key), gear=[]))
        self.taken = set()
        self.dead = set()
        self.active = 0
        self.opened = set()
        self.lit = set()
        self.lit_order = []
        self.foes = [dict(x=f["ox"], y=f["oy"], ox=f["ox"], oy=f["oy"],
                          dx=f["dx"], dy=f["dy"], ln=f["ln"], t=0, back=False,
                          kind=f["kind"])
                     for i, f in enumerate(wd.foes)]
        self.flash = 0
        self.hit = 0
        self._follow(snap=True)
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
        for i, b in enumerate(self.bodies):
            found = self.current_level.get_sprites_by_name(f"body{i}")
            if found:
                found[0].set_position(b["x"] * CELL, b["y"] * CELL)

    def _follow(self, snap: bool = False) -> None:
        me = self.bodies[self.active]
        self.cam_x = max(0, min(max(0, self.world.w - VIEW), me["x"] - VIEW // 2))
        self.cam_y = max(0, min(max(0, self.world.h - VIEW), me["y"] - VIEW // 2))
        self.camera.x = self.cam_x * CELL
        self.camera.y = self.cam_y * CELL

    def gate_open(self, need) -> bool:
        return all(n in self.lit for n in need)

    @staticmethod
    def _has(body, kind: int) -> bool:
        return kind in body["gear"]

    def passable(self, x: int, y: int, who: int) -> bool:
        wd = self.world
        if wd.solid(x, y):
            return False
        if (x, y) in wd.rubble and not self._has(self.bodies[who], BOOTS):
            return False
        door = wd.doors.get((x, y))
        if door and (x, y) not in self.opened:
            return tuple(self.bodies[who]["key"]) == door
        gate = wd.gates.get((x, y))
        if gate and not self.gate_open(gate):
            return False
        return True

    def _resolve_foes(self) -> None:
        for w in self.foes:
            if w["kind"] != WARDEN or id(w) in self.dead:
                continue
            for f in self.foes:
                if f is w or f["kind"] != HOSTILE or id(f) in self.dead:
                    continue
                if f["x"] == w["x"] and f["y"] == w["y"]:
                    self.dead.add(id(f))

    def _step_foes(self) -> None:
        for f in self.foes:
            if id(f) in self.dead:
                continue
            f["t"] += -1 if f["back"] else 1
            if f["t"] >= f["ln"]:
                f["t"] = f["ln"]
                f["back"] = True
            elif f["t"] <= 0:
                f["t"] = 0
                f["back"] = False
            nx, ny = f["ox"] + f["dx"] * f["t"], f["oy"] + f["dy"] * f["t"]
            if self.world.solid(nx, ny):
                f["back"] = not f["back"]
            else:
                f["x"], f["y"] = nx, ny

    def _caught(self) -> bool:
        me = self.bodies[self.active]
        for f in self.foes:
            if id(f) in self.dead or (f["x"], f["y"]) != (me["x"], me["y"]):
                continue
            if self._has(me, BLADE):
                self.dead.add(id(f))
                me["gear"] = [k for k in me["gear"] if k != BLADE]
                self.hit = 1
                return False
            return f["kind"] == HOSTILE
        return False

    def _send_back(self) -> None:
        me = self.bodies[self.active]
        wd = self.world
        if self.lit_order:
            me["x"], me["y"] = self.lit_order[-1]
        elif self.active == 0 or not wd.second:
            me["x"], me["y"] = wd.start
        else:
            me["x"], me["y"] = wd.second
        if not self._has(me, ANCHOR):
            me["key"] = list(wd.start_key if self.active == 0 else wd.second_key)
        self.hit = 1
        self._follow(snap=True)

    def step(self) -> None:
        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.next_level()
                self.complete_action()
            return

        self.hit = 0
        self.beat += 1
        wd = self.world
        aid = self.action.id
        me = self.bodies[self.active]

        if aid == GameAction.ACTION5:
            if len(self.bodies) > 1:
                self.active = (self.active + 1) % len(self.bodies)
            self._step_foes()
            self._resolve_foes()
            if self._caught():
                self._send_back()
            self._follow()
            self._sync()
            self.complete_action()
            return

        delta = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                 GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(aid)
        if delta is None:
            self.complete_action()
            return
        nx, ny = me["x"] + delta[0], me["y"] + delta[1]

        other = next((i for i, b in enumerate(self.bodies)
                      if i != self.active and (b["x"], b["y"]) == (nx, ny)), None)
        if other is not None:
            self.active = other
        elif any(f["kind"] == WARDEN and id(f) not in self.dead
                 and (f["x"], f["y"]) == (nx, ny) for f in self.foes) \
                and not self._has(me, BLADE):
            pass
        elif self.passable(nx, ny, self.active):
            door = wd.doors.get((nx, ny))
            if door and (nx, ny) not in self.opened:
                self.opened.add((nx, ny))
            me["x"], me["y"] = nx, ny
            tile = wd.tiles.get((nx, ny))
            if tile:
                fam, val = tile
                me["key"][1 if fam == "c" else 0] = val
            for gp in wd.gear:
                if gp["pos"] == (nx, ny) and id(gp) not in self.taken:
                    self.taken.add(id(gp))
                    if gp["kind"] not in me["gear"]:
                        me["gear"].append(gp["kind"])
            gnum = wd.marks.get((nx, ny))
            if gnum is not None and gnum not in self.lit:
                self.lit.add(gnum)
                self.lit_order.append((nx, ny))
            if (nx, ny) == wd.exit and tuple(me["key"]) == wd.exit_key:
                self.flash = self.FLASH_FRAMES
                self._follow()
                self._sync()
                return

        if self._caught():
            self._send_back()
        else:
            self._step_foes()
            self._resolve_foes()
            if self._caught():
                self._send_back()
        self._follow()
        self._sync()
        self.complete_action()
