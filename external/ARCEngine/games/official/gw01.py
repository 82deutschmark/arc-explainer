# Author: Claude Opus 4.6
# Date: 2026-02-06
# PURPOSE: gw01 - Gravity Well puzzle. Control gravity to collect orbs into wells.
#          Yellow+Orange fuse to Green. Wells cycle colors. Green phases through platforms.
#          Fixed: Cyrillic key in level data, orb movement ordering, phase-through permanence,
#          fusion return correctness.
# SRP/DRY check: Pass

from typing import List, Optional, Tuple

from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, InteractionMode, Level, Sprite

# Colors
VDC = 5   # void/background
PLT = 2   # platform
PLE = 4   # platform edge
WLC = 3   # well center
WLY = 11  # well yellow
WLO = 12  # well orange
WLG = 14  # well green
WLA = 0   # well any (white)
OBL = 11  # orb light (yellow)
OBH = 12  # orb heavy (orange)
OBF = 14  # orb fused (green)
OBM = 6   # orb fused mark
RMA = 9   # rim A
RMB = 10  # rim B
LBX = 4   # letterbox


def gwr() -> list[list[int]]:
    p = []
    for y in range(64):
        r = []
        for x in range(64):
            rim = x < 2 or x >= 62 or y < 2 or y >= 62
            r.append(RMA if rim and (x + y) % 2 == 0 else (RMB if rim else -1))
        p.append(r)
    return p


def gwl(c: int) -> list[list[int]]:
    return [
        [c, c, c, c, c],
        [c, WLC, WLC, WLC, c],
        [c, WLC, c, WLC, c],
        [c, WLC, WLC, WLC, c],
        [c, c, c, c, c],
    ]


sprites = {
    "plt": Sprite(
        pixels=[
            [PLE, PLE, PLE, PLE, PLE],
            [PLE, PLT, PLT, PLT, PLE],
            [PLE, PLT, PLT, PLT, PLE],
            [PLE, PLT, PLT, PLT, PLE],
            [PLE, PLE, PLE, PLE, PLE],
        ],
        name="plt",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        layer=0,
        tags=["sld"],
    ),
    "psm": Sprite(
        pixels=[
            [PLE, PLE, PLE],
            [PLE, PLT, PLE],
            [PLE, PLE, PLE],
        ],
        name="psm",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        layer=0,
        tags=["sld"],
    ),
    "wel": Sprite(
        pixels=gwl(WLA),
        name="wel",
        blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE,
        layer=-1,
        tags=["wel"],
    ),
    "obl": Sprite(
        pixels=[[-1, OBL, -1], [OBL, OBL, OBL], [-1, OBL, -1]],
        name="obl",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        layer=5,
        tags=["orb", "lgt"],
    ),
    "obh": Sprite(
        pixels=[[-1, OBH, -1], [OBH, 8, OBH], [-1, OBH, -1]],
        name="obh",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        layer=5,
        tags=["orb", "hvy"],
    ),
    "obf": Sprite(
        pixels=[[-1, OBF, -1], [OBF, OBM, OBF], [-1, OBF, -1]],
        name="obf",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        layer=5,
        tags=["orb", "fsd"],
    ),
    "rim": Sprite(
        pixels=gwr(),
        name="rim",
        blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.INTANGIBLE,
        layer=20,
        tags=["rim"],
    ),
    "bnh": Sprite(pixels=[[-2] * 60], name="bnh", blocking=BlockingMode.BOUNDING_BOX, interaction=InteractionMode.INVISIBLE, layer=10, tags=["bnd"]),
    "bnv": Sprite(pixels=[[-2] for _ in range(60)], name="bnv", blocking=BlockingMode.BOUNDING_BOX, interaction=InteractionMode.INVISIBLE, layer=10, tags=["bnd"]),
}

FSN = {
    (OBL, OBH): (OBF, "fsd"),
    (OBH, OBL): (OBF, "fsd"),
    (OBL, OBL): (OBL, "lgt"),
    (OBH, OBH): (OBH, "hvy"),
}

ACC = {
    WLY: [OBL],
    WLO: [OBH],
    WLG: [OBF],
    WLA: [OBL, OBH, OBF],
}

levels = [
    Level(
        sprites=[
            sprites["rim"].clone().set_position(0, 0),
            sprites["bnh"].clone().set_position(2, 2),
            sprites["bnh"].clone().set_position(2, 61),
            sprites["bnv"].clone().set_position(2, 2),
            sprites["bnv"].clone().set_position(61, 2),
            sprites["wel"].clone().set_position(29, 50),
            sprites["plt"].clone().set_position(20, 30),
            sprites["plt"].clone().set_position(35, 30),
            sprites["obl"].clone().set_position(21, 27),
            sprites["obl"].clone().set_position(36, 27),
        ],
        grid_size=(64, 64),
        data={"ned": 2, "phs": WLA, "cyc": False},
    ),
    Level(
        sprites=[
            sprites["rim"].clone().set_position(0, 0),
            sprites["bnh"].clone().set_position(2, 2),
            sprites["bnh"].clone().set_position(2, 61),
            sprites["bnv"].clone().set_position(2, 2),
            sprites["bnv"].clone().set_position(61, 2),
            sprites["wel"].clone().set_position(29, 45),
            sprites["plt"].clone().set_position(15, 25),
            sprites["plt"].clone().set_position(44, 25),
            sprites["obl"].clone().set_position(16, 22),
            sprites["obl"].clone().set_position(45, 22),
            sprites["obh"].clone().set_position(30, 12),
        ],
        grid_size=(64, 64),
        data={"ned": 2, "phs": WLY, "cyc": False},
    ),
    Level(
        sprites=[
            sprites["rim"].clone().set_position(0, 0),
            sprites["bnh"].clone().set_position(2, 2),
            sprites["bnh"].clone().set_position(2, 61),
            sprites["bnv"].clone().set_position(2, 2),
            sprites["bnv"].clone().set_position(61, 2),
            sprites["wel"].clone().set_position(29, 50),
            sprites["plt"].clone().set_position(29, 30),
            sprites["obl"].clone().set_position(15, 27),
            sprites["obh"].clone().set_position(43, 27),
        ],
        grid_size=(64, 64),
        data={"ned": 1, "phs": WLG, "cyc": False},
    ),
    Level(
        sprites=[
            sprites["rim"].clone().set_position(0, 0),
            sprites["bnh"].clone().set_position(2, 2),
            sprites["bnh"].clone().set_position(2, 61),
            sprites["bnv"].clone().set_position(2, 2),
            sprites["bnv"].clone().set_position(61, 2),
            sprites["wel"].clone().set_position(29, 50),
            sprites["plt"].clone().set_position(20, 20),
            sprites["plt"].clone().set_position(38, 35),
            sprites["obl"].clone().set_position(21, 17),
            sprites["obh"].clone().set_position(39, 32),
        ],
        grid_size=(64, 64),
        data={"ned": 2, "phs": WLY, "cyc": True},
    ),
    Level(
        sprites=[
            sprites["rim"].clone().set_position(0, 0),
            sprites["bnh"].clone().set_position(2, 2),
            sprites["bnh"].clone().set_position(2, 61),
            sprites["bnv"].clone().set_position(2, 2),
            sprites["bnv"].clone().set_position(61, 2),
            sprites["wel"].clone().set_position(29, 52),
            sprites["plt"].clone().set_position(24, 42),
            sprites["plt"].clone().set_position(34, 42),
            sprites["plt"].clone().set_position(20, 20),
            sprites["plt"].clone().set_position(38, 20),
            sprites["obl"].clone().set_position(21, 17),
            sprites["obh"].clone().set_position(39, 17),
        ],
        grid_size=(64, 64),
        data={"ned": 1, "phs": WLG, "cyc": False},
    ),
    Level(
        sprites=[
            sprites["rim"].clone().set_position(0, 0),
            sprites["bnh"].clone().set_position(2, 2),
            sprites["bnh"].clone().set_position(2, 61),
            sprites["bnv"].clone().set_position(2, 2),
            sprites["bnv"].clone().set_position(61, 2),
            sprites["wel"].clone().set_position(29, 40),
            sprites["psm"].clone().set_position(15, 15),
            sprites["psm"].clone().set_position(45, 15),
            sprites["psm"].clone().set_position(15, 30),
            sprites["psm"].clone().set_position(45, 30),
            sprites["plt"].clone().set_position(5, 5),
            sprites["plt"].clone().set_position(54, 5),
            sprites["plt"].clone().set_position(5, 50),
            sprites["plt"].clone().set_position(54, 50),
            sprites["obl"].clone().set_position(6, 12),
            sprites["obl"].clone().set_position(55, 12),
            sprites["obh"].clone().set_position(6, 47),
            sprites["obh"].clone().set_position(55, 47),
        ],
        grid_size=(64, 64),
        data={"ned": 4, "phs": WLY, "cyc": True},
    ),
]


class Gw01(ARCBaseGame):
    def __init__(self) -> None:
        super().__init__("gw01", levels, Camera(0, 0, 64, 64, VDC, LBX))

    def on_set_level(self, level: Level) -> None:
        self.rim = level.get_sprites_by_tag("rim")[0]
        self.wel = level.get_sprites_by_tag("wel")[0]
        self.orb = level.get_sprites_by_tag("orb")
        self.sld = level.get_sprites_by_tag("sld")
        self.rph = 0
        self.col = 0
        self.ned = level.get_data("ned") or len(self.orb)
        self.phs = level.get_data("phs") or WLA
        self.cyc = level.get_data("cyc") or False
        self.seq = [WLY, WLO, WLG]
        self.idx = self.seq.index(self.phs) if self.phs in self.seq else 0
        self.sim = False
        self.smn = 0
        self.sdx = 0
        self.sdy = 0
        self.uwl()

    def uwl(self) -> None:
        p = gwl(self.phs)
        for y in range(5):
            for x in range(5):
                self.wel.pixels[y][x] = p[y][x]

    def cwl(self) -> None:
        if not self.cyc:
            return
        self.idx = (self.idx + 1) % len(self.seq)
        self.phs = self.seq[self.idx]
        self.uwl()

    def crm(self) -> None:
        self.rph = (self.rph + 1) % 4
        for y in range(64):
            for x in range(64):
                rim = x < 2 or x >= 62 or y < 2 or y >= 62
                if rim:
                    self.rim.pixels[y][x] = RMA if (x + y + self.rph) % 2 == 0 else RMB

    def step(self) -> None:
        if self.sim:
            mv, fu = self.sst()
            self.smn += 1
            self.chc()
            if (not mv and not fu) or self.smn > 100:
                self.sim = False
                self.chw()
                self.complete_action()
            return

        dx, dy = 0, 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1

        if dx != 0 or dy != 0:
            self.crm()
            self.cwl()
            self.sdx, self.sdy = dx, dy
            self.sim = True
            self.smn = 0
            for o in self.orb:
                if hasattr(o, "mvd"):
                    o.mvd = False
            return

        self.complete_action()

    def sst(self) -> Tuple[bool, bool]:
        mv, fu = False, False
        self.orb = [o for o in self.current_level.get_sprites_by_tag("orb") if o.interaction != InteractionMode.REMOVED]

        # Sort orbs so the leading orb (closest to destination edge) moves first.
        # This prevents false collisions between orbs moving in the same direction.
        if self.sdx > 0:
            self.orb.sort(key=lambda o: -o.x)
        elif self.sdx < 0:
            self.orb.sort(key=lambda o: o.x)
        elif self.sdy > 0:
            self.orb.sort(key=lambda o: -o.y)
        elif self.sdy < 0:
            self.orb.sort(key=lambda o: o.y)

        fsl: List[Tuple[Sprite, Sprite]] = []

        for o in self.orb:
            if o.interaction == InteractionMode.REMOVED:
                continue
            hvy = "hvy" in o.tags
            fsd = "fsd" in o.tags

            if hvy:
                if not hasattr(o, "mvd"):
                    o.mvd = False
                if o.mvd:
                    continue

            clo = self.cor(o, self.sdx, self.sdy)
            if clo:
                fsl.append((o, clo))
                continue

            can, _ = self.cmv(o, self.sdx, self.sdy, fsd)
            if can:
                o.move(self.sdx, self.sdy)
                mv = True
                if hvy:
                    o.mvd = True

        for a, b in fsl:
            if a.interaction == InteractionMode.REMOVED or b.interaction == InteractionMode.REMOVED:
                continue
            if self.fus(a, b):
                fu = True

        return mv, fu

    def cor(self, o: Sprite, dx: int, dy: int) -> Optional[Sprite]:
        nx, ny = o.x + dx, o.y + dy
        for ot in self.orb:
            if ot is o or ot.interaction == InteractionMode.REMOVED:
                continue
            if self.ovl(nx, ny, 3, 3, ot.x, ot.y, 3, 3):
                return ot
        return None

    def cmv(self, o: Sprite, dx: int, dy: int, phs: bool) -> Tuple[bool, bool]:
        nx, ny = o.x + dx, o.y + dy
        if nx < 2 or nx + 3 > 62 or ny < 2 or ny + 3 > 62:
            return False, False
        for p in self.sld:
            ph = len(p.pixels)
            pw = len(p.pixels[0]) if ph > 0 else 0
            if self.ovl(nx, ny, 3, 3, p.x, p.y, pw, ph):
                if phs:
                    return True, True
                return False, False
        return True, False

    def ovl(self, x1: int, y1: int, w1: int, h1: int, x2: int, y2: int, w2: int, h2: int) -> bool:
        return x1 < x2 + w2 and x1 + w1 > x2 and y1 < y2 + h2 and y1 + h1 > y2

    def fus(self, a: Sprite, b: Sprite) -> bool:
        c1 = OBL if "lgt" in a.tags else (OBH if "hvy" in a.tags else OBF)
        c2 = OBL if "lgt" in b.tags else (OBH if "hvy" in b.tags else OBF)
        if (c1, c2) not in FSN:
            return False
        rc, rt = FSN[(c1, c2)]
        a.set_interaction(InteractionMode.REMOVED)
        b.set_interaction(InteractionMode.REMOVED)
        mx, my = (a.x + b.x) // 2, (a.y + b.y) // 2
        tag_to_sprite = {"fsd": "obf", "lgt": "obl", "hvy": "obh"}
        nw = sprites[tag_to_sprite[rt]].clone().set_position(mx, my)
        self.current_level.add_sprite(nw)
        return True

    def chc(self) -> None:
        wx, wy = self.wel.x, self.wel.y
        acc = ACC.get(self.phs, [])
        for o in self.current_level.get_sprites_by_tag("orb"):
            if o.interaction == InteractionMode.REMOVED:
                continue
            cx, cy = o.x + 1, o.y + 1
            if wx <= cx <= wx + 4 and wy <= cy <= wy + 4:
                oc = OBL if "lgt" in o.tags else (OBH if "hvy" in o.tags else OBF)
                if oc in acc:
                    o.set_interaction(InteractionMode.REMOVED)
                    self.col += 1

    def chw(self) -> None:
        if self.col >= self.ned:
            if self.is_last_level():
                self.win()
            else:
                self.next_level()
