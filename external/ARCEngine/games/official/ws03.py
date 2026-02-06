# Author: Claude Opus 4.6
# Date: 2026-02-06 (pca invisible-padding removed, proper 5x5 checkerboard)
# PURPOSE: WS03 game - variant of LS20 with permanent fog of war + seeded randomness
# Features: Magenta borders (6), dark red walls (13), gray fog of war (2), blue+magenta player (9+6)
# SRP/DRY check: Pass - Reuses proven game mechanics from LS20, shape sprites use 0 base for remap

import logging
import math
from typing import List, Tuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay, Sprite

# WS03 uses distinctive colors: Magenta borders (6), dark red walls (13), orange energy (12), blue+magenta checkerboard player (9+6)
# Shape sprites (dcb, fij, lyd, nio, opw, tmx) use 0 as base color so color_remap(0, target) works
sprites = {
    "dcb": Sprite(pixels=[[-1, 0, -1], [0, 0, -1], [-1, 0, 0]], name="dcb", visible=True, collidable=True, layer=1),
    "fij": Sprite(pixels=[[0, 0, 0], [-1, -1, 0], [0, -1, 0]], name="fij", visible=True, collidable=False, layer=-2),
    "ggk": Sprite(pixels=[[6, 6, 6, 6, 6, 6, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, 6, 6, 6, 6, 6, 6]], name="ggk", visible=True, collidable=True, tags=["yar", "vdr"], layer=-3),
    "hep": Sprite(pixels=[[6]*10]*10, name="hep", visible=True, collidable=True, tags=["nfq"], layer=1),
    "hul": Sprite(pixels=[[13, 13, -1, -1, -1, -1, -1, 13, 13], [13]*9, [13]*9, [13]*9, [13]*9, [13]*9, [13]*9, [13]*9, [13]*9], name="hul", visible=True, collidable=True, layer=-4),
    "kdj": Sprite(pixels=[[0, -1, 0], [-1, 0, -1], [0, -1, 0]], name="kdj", visible=True, collidable=True, tags=["wex"], layer=10),
    "kdy": Sprite(pixels=[[-2]*5, [-2, -2, 6, -2, -2], [-2, 12, 6, 6, -2], [-2, -2, 12, -2, -2], [-2]*5], name="kdy", visible=True, collidable=True, tags=["bgt"], layer=-1),
    "krg": Sprite(pixels=[[8]], name="krg", visible=True, collidable=True, layer=3),
    "lhs": Sprite(pixels=[[6]*5]*5, name="lhs", visible=True, collidable=False, tags=["mae"], layer=-3),
    "lyd": Sprite(pixels=[[-1, 0, -1], [-1, 0, -1], [0, 0, 0]], name="lyd", visible=True, collidable=True),
    "mgu": Sprite(pixels=[[6, 6, 6, 6] + [-1]*60]*52 + [[13]*12 + [-1]*52] + [[13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 13] + [-1]*52]*7 + [[13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 13] + [13]*52]*3 + [[13]*12 + [13]*52], name="mgu", visible=True, collidable=True),
    "nio": Sprite(pixels=[[-1, 0, 0], [0, -1, 0], [-1, 0, -1]], name="nio", visible=True, collidable=True),
    "nlo": Sprite(pixels=[[13]*5]*5, name="nlo", visible=True, collidable=True, tags=["jdd"], layer=-5),
    "opw": Sprite(pixels=[[0, 0, -1], [-1, 0, 0], [0, -1, 0]], name="opw", visible=True, collidable=True),
    "pca": Sprite(pixels=[[9, 6, 9, 6, 9], [6, 9, 6, 9, 6], [9, 6, 9, 6, 9], [6, 9, 6, 9, 6], [9, 6, 9, 6, 9]], name="pca", visible=True, collidable=True, tags=["caf"]),
    "qqv": Sprite(pixels=[[-2]*5, [-2, 15, 8, 8, -2], [-2, 15, 6, 11, -2], [-2, 12, 12, 11, -2], [-2]*5], name="qqv", visible=True, collidable=False, tags=["gic"], layer=-1),
    "rzt": Sprite(pixels=[[0, -1, -1], [-1, 0, -1], [-1, -1, 0]], name="rzt", visible=True, collidable=True, tags=["axa"]),
    "snw": Sprite(pixels=[[6]*7, [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6]*7], name="snw", visible=True, collidable=True, tags=["yar"], layer=-3),
    "tmx": Sprite(pixels=[[0, -1, 0], [0, -1, 0], [0, 0, 0]], name="tmx", visible=True, collidable=True),
    "tuv": Sprite(pixels=[[6]*10] + [[6] + [-1]*8 + [6]]*8 + [[6]*10], name="tuv", visible=False, collidable=True, tags=["fng"], layer=5),
    "ulq": Sprite(pixels=[[6]*7] + [[6] + [-1]*5 + [6]]*5 + [[6]*7], name="ulq", visible=False, collidable=True, tags=["qex"], layer=-1),
    "vxy": Sprite(pixels=[[-2]*5, [-2, 6, -2, -2, -2], [-2, -2, 6, 6, -2], [-2, -2, 6, -2, -2], [-2]*5], name="vxy", visible=True, collidable=False, tags=["gsu"], layer=-1),
    "zba": Sprite(pixels=[[12]], name="zba", visible=True, collidable=False, tags=["iri"], layer=-1),
}

BACKGROUND_COLOR = 10
PADDING_COLOR = 15


class jvq(RenderableUserDisplay):
    """Fog of War interface - renders visibility radius around player and UI elements."""
    zba: List[Tuple[int, int]]

    def __init__(self, vxy: "Ws03", ulq: int):
        self.tuv = vxy
        self.tmx = ulq
        self.snw = ulq

    def rzt(self, qqv: int) -> None:
        self.snw = max(0, min(qqv, self.tmx))

    def pca(self) -> bool:
        if self.snw >= 0:
            self.snw -= 1
        return self.snw >= 0

    def opw(self) -> None:
        self.snw = self.tmx

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        if self.tmx == 0 or self.tuv.xhp:
            return frame

        nlo = 1.5
        # Always render fog of war in WS03
        if self.tuv.qee:
            for hhe in range(64):
                for dcv in range(64):
                    if math.dist((hhe, dcv), (self.tuv.mgu.y + nlo, self.tuv.mgu.x + nlo)) > 10.0:
                        frame[hhe, dcv] = 2

            if self.tuv.nio and self.tuv.nio.is_visible:
                nio = self.tuv.nio.render()
                mgu = 3
                lyd = 55
                # Draw bordered panel: 1px magenta border + gray background
                for hhe in range(lyd - 1, lyd + 7):
                    for w in range(mgu - 1, mgu + 7):
                        if 0 <= hhe < 64 and 0 <= w < 64:
                            if hhe == lyd - 1 or hhe == lyd + 6 or w == mgu - 1 or w == mgu + 6:
                                frame[hhe, w] = 6  # Magenta border
                            else:
                                frame[hhe, w] = 15  # Purple background
                # Draw key sprite on top of background
                for hhe in range(6):
                    for w in range(6):
                        if nio[hhe][w] != -1:
                            frame[lyd + hhe, mgu + w] = nio[hhe][w]

        for hhe in range(self.tmx):
            mgu = 13 + hhe
            lyd = 61
            frame[lyd : lyd + 2, mgu] = 12 if self.tmx - hhe - 1 < self.snw else 15

        for lhs in range(3):
            mgu = 56 + 3 * lhs
            lyd = 61
            for x in range(2):
                frame[lyd : lyd + 2, mgu + x] = 14 if self.tuv.lbq > lhs else 15
        return frame


levels = [
    # Level 1: puq - 3 base energy + 2 fog compensation = 5 total (was Level 3)
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(52, 48),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2), sprites["kdy"].clone().set_position(49, 10),
            sprites["lhs"].clone().set_position(54, 50), sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(4,30),(4,35),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(34,0),(59,10),(59,5),(39,10),(14,25),(19,40),(19,45),(19,35),(49,50),(39,35),(39,40),(39,45),(14,30),(49,45),(49,40),(14,20),(14,50),(39,5),(39,50),(44,45),(19,50),(44,40),(44,50),(44,20),(49,20),(39,20),(19,10),(14,35),(39,15),(34,35),(14,10),(14,15),(44,35),(24,35),(34,10),(24,10)]] + [
            sprites["pca"].clone().set_position(9, 45), sprites["qqv"].clone().set_position(29, 45),
            sprites["rzt"].clone().set_position(55, 51), sprites["snw"].clone().set_position(53, 49),
            sprites["tuv"].clone().set_position(1, 53), sprites["ulq"].clone().set_position(53, 49),
            # LS20 base energy
            sprites["zba"].clone().set_position(20, 31),
            sprites["zba"].clone().set_position(30, 16),
            sprites["zba"].clone().set_position(50, 36),
            # Fog compensation: 2 pickups in accessible corridors
            sprites["zba"].clone().set_position(50, 11),
            sprites["zba"].clone().set_position(10, 41),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": 5, "nlo": 9, "opw": 270, "qqv": 5, "ggk": 12, "fij": 0, "kdy": True},
        name="puq",
    ),
    # Level 2: mgu - 2 base energy + 2 fog compensation = 4 total
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(12, 38),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2), sprites["kdy"].clone().set_position(49, 45),
            sprites["lhs"].clone().set_position(14, 40), sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(4,30),(4,35),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(54,30),(34,0),(59,10),(59,5),(54,15),(54,10),(9,35),(9,45),(19,50),(9,40),(54,5),(14,45),(14,50),(9,5),(9,30),(9,25),(19,30),(24,30),(19,40),(19,45),(19,35),(39,15),(39,35),(44,30),(34,45),(14,5),(39,20),(44,20),(24,20),(44,25),(39,40),(39,45),(24,35),(24,25),(24,50),(19,25),(24,40),(24,45),(29,45),(29,30),(29,25),(24,15),(44,35),(54,34)]] + [
            sprites["pca"].clone().set_position(29, 40), sprites["rzt"].clone().set_position(15, 41),
            sprites["snw"].clone().set_position(13, 39), sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(13, 39),
            # LS20 base energy
            sprites["zba"].clone().set_position(35, 16),
            sprites["zba"].clone().set_position(30, 51),
            # Fog compensation: 2 pickups in accessible corridors
            sprites["zba"].clone().set_position(50, 16),
            sprites["zba"].clone().set_position(20, 36),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": 5, "nlo": 9, "opw": 270, "qqv": 5, "ggk": 9, "fij": 0, "kdy": True},
        name="mgu",
    ),
    # Level 3: krg - Tutorial level, 0 base energy + 2 fog compensation (was Level 1)
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(32, 8).set_rotation(180),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2), sprites["kdy"].clone().set_position(19, 30),
            sprites["lhs"].clone().set_position(34, 10), sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(54,25),(54,20),(34,0),(59,10),(59,5),(54,15),(54,10),(44,5),(39,5),(34,5),(29,5),(54,50),(54,45),(24,5),(19,5),(9,35),(9,45),(19,50),(9,40),(49,5),(54,5),(49,50),(14,50),(14,5),(9,5),(9,30),(9,25),(9,20),(9,15),(9,10),(49,10),(44,20),(39,10),(44,10),(49,15),(29,10),(29,15),(39,15),(44,15),(49,20),(14,15),(19,15),(24,15),(24,10),(19,10),(14,10),(29,20),(39,20),(24,20),(29,40),(19,20),(14,20),(54,30),(24,40),(14,45),(29,35),(4,30),(4,35),(54,35),(54,40),(14,40),(24,50),(29,50),(39,50),(44,50),(34,50),(29,30)]] + [
            sprites["pca"].clone().set_position(39, 45), sprites["rzt"].clone().set_position(35, 11),
            sprites["snw"].clone().set_position(33, 9), sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(33, 9),
            # Fog compensation: 2 pickups in accessible corridors
            sprites["zba"].clone().set_position(35, 21),
            sprites["zba"].clone().set_position(30, 26),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": 5, "nlo": 9, "opw": 0, "qqv": 5, "ggk": 9, "fij": 270, "kdy": True},
        name="krg",
    ),
    # Level 4: tmx - 4 base energy + 2 fog compensation = 6 total
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(7, 3).set_rotation(90),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["lhs"].clone().set_position(9, 5), sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(4,30),(4,35),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(34,0),(59,10),(59,5),(19,30),(14,10),(9,10),(24,25),(29,30),(19,10),(29,5),(9,20),(14,15),(29,25),(29,35),(34,35),(19,50),(39,50),(39,30),(49,35),(9,15),(49,10),(49,15),(44,10),(29,40),(29,20),(39,45),(44,50),(19,25),(39,35),(14,50),(9,45)]] + [
            sprites["pca"].clone().set_position(54, 5), sprites["qqv"].clone().set_position(34, 30),
            sprites["rzt"].clone().set_position(10, 6), sprites["snw"].clone().set_position(8, 4),
            sprites["tuv"].clone().set_position(1, 53), sprites["ulq"].clone().set_position(8, 4),
            sprites["vxy"].clone().set_position(24, 30),
            # LS20 base energy
            sprites["zba"].clone().set_position(35, 41),
            sprites["zba"].clone().set_position(15, 46),
            sprites["zba"].clone().set_position(35, 16),
            sprites["zba"].clone().set_position(55, 51),
            # Fog compensation: 2 pickups in accessible corridors
            sprites["zba"].clone().set_position(50, 26),
            sprites["zba"].clone().set_position(45, 26),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": 5, "nlo": 9, "opw": 0, "qqv": 4, "ggk": 14, "fij": 0, "kdy": True},
        name="tmx",
    ),
    # Level 5: zba - 3 base energy + 2 fog compensation = 5 total
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(52, 3).set_rotation(180),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2), sprites["kdy"].clone().set_position(19, 40),
            sprites["lhs"].clone().set_position(54, 5), sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(4,30),(4,35),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(34,0),(59,10),(59,5),(29,30),(29,35),(49,10),(49,5),(29,15),(29,20),(24,25),(19,25),(49,15),(24,30),(24,20),(34,20),(34,30),(49,35),(49,40),(49,45),(49,50),(44,50),(44,5),(14,25),(49,20),(49,30),(14,50),(9,45)]] + [
            sprites["pca"].clone().set_position(54, 50), sprites["qqv"].clone().set_position(29, 25),
            sprites["rzt"].clone().set_position(55, 6), sprites["snw"].clone().set_position(53, 4),
            sprites["tuv"].clone().set_position(1, 53), sprites["ulq"].clone().set_position(53, 4),
            sprites["vxy"].clone().set_position(19, 10),
            # LS20 base energy
            sprites["zba"].clone().set_position(40, 6),
            sprites["zba"].clone().set_position(10, 6),
            sprites["zba"].clone().set_position(40, 51),
            # Fog compensation: 2 pickups in accessible corridors
            sprites["zba"].clone().set_position(20, 26),
            sprites["zba"].clone().set_position(35, 11),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": 5, "nlo": 9, "opw": 90, "qqv": 4, "ggk": 12, "fij": 0, "kdy": True},
        name="zba",
    ),
    # Level 6: lyd - 5 base energy + 2 fog compensation = 7 total (dual targets)
    Level(
        sprites=[
            sprites["ggk"].clone().set_position(53, 34),
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(52, 48),
            sprites["hul"].clone().set_position(52, 33),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2), sprites["kdy"].clone().set_position(19, 25),
            sprites["lhs"].clone().set_position(54, 50), sprites["lhs"].clone().set_position(54, 35),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(4,30),(4,35),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(34,0),(59,10),(59,5),(29,30),(54,10),(24,30),(34,30),(49,35),(49,40),(49,45),(49,50),(44,50),(49,30),(54,5),(44,45),(39,50),(44,40),(34,50),(39,45),(49,25),(19,10),(14,30),(44,30),(49,5),(24,10),(34,25),(19,30),(34,15),(29,10),(9,45),(14,50),(14,25),(44,35),(14,15),(34,10),(14,10)]] + [
            sprites["pca"].clone().set_position(24, 50), sprites["qqv"].clone().set_position(24, 25),
            sprites["rzt"].clone().set_position(55, 51), sprites["rzt"].clone().set_position(55, 36),
            sprites["snw"].clone().set_position(53, 49), sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(53, 34), sprites["ulq"].clone().set_position(53, 49),
            sprites["vxy"].clone().set_position(29, 25),
            # LS20 base energy
            sprites["zba"].clone().set_position(40, 16),
            sprites["zba"].clone().set_position(10, 41),
            sprites["zba"].clone().set_position(55, 16),
            sprites["zba"].clone().set_position(55, 21),
            sprites["zba"].clone().set_position(10, 6),
            # Fog compensation: 2 pickups in accessible corridors
            sprites["zba"].clone().set_position(30, 41),
            sprites["zba"].clone().set_position(10, 21),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": [5, 0], "nlo": [9, 8], "opw": [90, 90], "qqv": 0, "ggk": 14, "fij": 0, "kdy": True},
        name="lyd",
    ),
    # Level 7: fij - 6 base energy, no fog compensation (originally had fog)
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53), sprites["hul"].clone().set_position(27, 48),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2), sprites["kdy"].clone().set_position(54, 20),
            sprites["lhs"].clone().set_position(29, 50), sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [(4,0),(9,0),(4,5),(14,0),(19,0),(24,0),(29,0),(39,0),(44,0),(49,0),(54,0),(59,0),(4,10),(4,15),(4,20),(4,25),(4,30),(4,35),(59,15),(59,20),(59,25),(59,30),(59,35),(59,40),(59,45),(59,50),(59,55),(54,55),(49,55),(44,55),(39,55),(34,55),(29,55),(24,55),(19,55),(4,40),(4,45),(4,50),(9,50),(4,55),(9,55),(14,55),(34,0),(59,10),(59,5),(24,40),(49,10),(49,5),(39,20),(29,20),(24,25),(49,15),(24,20),(34,20),(39,45),(34,40),(24,45),(34,45),(24,50),(34,50),(49,20),(39,40),(54,40),(19,50),(24,35),(39,50),(44,20),(9,45),(14,50),(19,45)]] + [
            sprites["pca"].clone().set_position(14, 10), sprites["qqv"].clone().set_position(9, 40),
            sprites["rzt"].clone().set_position(30, 51), sprites["snw"].clone().set_position(28, 49),
            sprites["tuv"].clone().set_position(1, 53), sprites["ulq"].clone().set_position(28, 49),
            sprites["vxy"].clone().set_position(19, 40),
            # LS20 base energy (fij already had fog, no compensation needed)
            sprites["zba"].clone().set_position(55, 6),
            sprites["zba"].clone().set_position(30, 26),
            sprites["zba"].clone().set_position(55, 51),
            sprites["zba"].clone().set_position(15, 46),
            sprites["zba"].clone().set_position(15, 21),
            sprites["zba"].clone().set_position(45, 11),
        ],
        grid_size=(64, 64),
        data={"vxy": 42, "tuv": 0, "nlo": 8, "opw": 180, "qqv": 1, "ggk": 12, "fij": 0, "kdy": True},
        name="fij",
    ),
]


class Ws03(ARCBaseGame):
    def __init__(self, seed: int = 0) -> None:
        # Initialize energy interface before super().__init__ since on_set_level is called during init
        dcb = levels[0].get_data("vxy") if levels else 0
        fij = dcb if dcb else 0
        self.ggk = jvq(self, fij)
        
        # Must match ls20's order: opw(0), lyd(1), tmx(2), nio(3), dcb(4), fij(5)
        self.hep = [sprites["opw"], sprites["lyd"], sprites["tmx"], sprites["nio"], sprites["dcb"], sprites["fij"]]
        # Match LS20's color palette order so level data indices work correctly
        # LS20 uses [12, 9, 14, 8] - we keep same values for compatibility
        self.hul = [12, 9, 14, 8]
        self.kdj = [0, 90, 180, 270]
        self.qee = False
        
        super().__init__("ws03", levels, Camera(0, 0, 16, 16, BACKGROUND_COLOR, PADDING_COLOR, [self.ggk]), False, seed, [1, 2, 3, 4])
        
        self.krg()
    
    def krg(self) -> None:
        """Reset energy interface based on current level data."""
        fig = self.current_level.get_data("vxy")
        if fig:
            self.ggk.tmx = fig
            self.ggk.opw()

    def _get_rotation_index(self, value) -> int:
        try:
            return self.kdj.index(value)
        except (ValueError, TypeError):
            logging.warning(f"Invalid rotation value {value}, defaulting to 0")
            return 0

    def _get_color_index(self, value) -> int:
        try:
            return self.hul.index(value)
        except (ValueError, TypeError):
            logging.warning(f"Invalid color value {value}, defaulting to 0")
            return 0

    def on_set_level(self, level: Level) -> None:
        # Use tags like ls20 does: caf=player piece, wex=key indicator, nfq=level boundary
        self.mgu = self.current_level.get_sprites_by_tag("caf")[0]
        self.nio = self.current_level.get_sprites_by_tag("wex")[0]
        self.nlo = self.current_level.get_sprites_by_tag("nfq")[0]
        self.opw = self.current_level.get_sprites_by_tag("fng")[0]
        self.pca = self.current_level.get_sprites_by_tag("axa")
        self.qqv = self.current_level.get_sprites_by_tag("mae")
        self.rzt = [False] * len(self.pca)
        
        self.snw = 0
        self.tmx = 0
        self.tuv = 0
        self.krg()
        
        self.cjl = []
        self.vxy = []
        # Fog of war always enabled in WS03
        self.qee = True
        
        self.gfy = self.current_level.get_data("tuv")
        if isinstance(self.gfy, int):
            self.gfy = [self.gfy]
        
        yxt = self.current_level.get_data("opw")
        if isinstance(yxt, int):
            yxt = [yxt]
        
        lxu = self.current_level.get_data("nlo")
        if isinstance(lxu, int):
            lxu = [lxu]
        
        for dqk in range(len(self.qqv)):
            self.cjl.append(self.kdj.index(yxt[dqk]))
            self.vxy.append(self.hul.index(lxu[dqk]))
            self.pca[dqk].pixels = self.hep[self.gfy[dqk]].pixels.copy()
            self.pca[dqk].color_remap(0, self.hul[self.vxy[dqk]])
            self.pca[dqk].set_rotation(self.kdj[self.cjl[dqk]])
        
        self.pxr()
        self.egb = sprites["krg"].clone()
        self.current_level.add_sprite(self.egb)
        self.egb.set_visible(False)
        self.lbq = 3
        self.vcn: List[Sprite] = []
        self.bzf: List[Sprite] = []
        self.osd: List[Sprite] = []
        self.xhp = False
        self.kbj = False
        self.rjw = self.mgu.x
        self.qbn = self.mgu.y

    def rbt(self, edo: int, cdg: int, hds: int, xwr: int) -> List[Sprite]:
        return [bes for bes in self.current_level._sprites if bes.x >= edo and bes.x < edo + hds and bes.y >= cdg and bes.y < cdg + xwr]

    def step(self) -> None:
        if self.xhp:
            self.egb.set_visible(False)
            self.nio.set_visible(True)
            self.xhp = False
            self.complete_action()
            return
        if self.kbj:
            self.nlo.color_remap(None, 6)
            self.kbj = False
            self.complete_action()
            return
        lgr, kyr, axv = 0, 0, False
        if self.action.id.value == 1:
            kyr, axv = -1, True
        elif self.action.id.value == 2:
            kyr, axv = 1, True
        elif self.action.id.value == 3:
            lgr, axv = -1, True
        elif self.action.id.value == 4:
            lgr, axv = 1, True
        if not axv:
            self.complete_action()
            return
        xpb = False
        qul, cfy = self.mgu.x + lgr * 5, self.mgu.y + kyr * 5
        yet = self.rbt(qul, cfy, 5, 5)
        mnc = False
        for oib in yet:
            if oib.tags is None:
                break
            elif "jdd" in oib.tags:
                mnc = True
                break
            elif "mae" in oib.tags:
                qzq = self.qqv.index(oib)
                if not self.qhg(qzq):
                    self.nlo.color_remap(None, 0)
                    self.kbj = True
                    return
            elif "iri" in oib.tags:
                xpb = True
                self.ggk.rzt(self.ggk.tmx)
                self.vcn.append(oib)
                self.current_level.remove_sprite(oib)
            elif "gsu" in oib.tags:
                self.snw = (self.snw + 1) % len(self.hep)
                self.nio.pixels = self.hep[self.snw].pixels.copy()
                self.nio.color_remap(0, self.hul[self.tmx])
                self.ihm()
            elif "gic" in oib.tags:
                apq = (self.tmx + 1) % len(self.hul)
                self.nio.color_remap(self.hul[self.tmx], self.hul[apq])
                self.tmx = apq
                self.ihm()
            elif "bgt" in oib.tags:
                self.tuv = (self.tuv + 1) % 4
                self.nio.set_rotation(self.kdj[self.tuv])
                self.ihm()
        if not mnc:
            self.mgu.set_position(qul, cfy)
        if self.nje():
            self.next_level()
            self.complete_action()
            return
        if not xpb and not self.ggk.pca():
            self.lbq -= 1
            if self.lbq == 0:
                self.lose()
                self.complete_action()
                return
            self.egb.set_visible(True)
            self.egb.set_scale(64)
            self.egb.set_position(0, 0)
            self.nio.set_visible(False)
            self.xhp = True
            self.rzt = [False] * len(self.qqv)
            self.mgu.set_position(self.rjw, self.qbn)
            self.pxr()
            for bqs in self.vcn:
                self.current_level.add_sprite(bqs)
            for grk in self.bzf:
                self.current_level.add_sprite(grk)
            for qmb in self.osd:
                self.current_level.add_sprite(qmb)
            self.vcn, self.bzf, self.osd = [], [], []
            self.ggk.rzt(self.ggk.tmx)
            self.opw.set_visible(False)
            for sfs in self.current_level.get_sprites_by_tag("qex"):
                sfs.set_visible(False)
            for pqv in self.current_level.get_sprites_by_tag("yar"):
                pqv.set_visible(True)
            return
        self.complete_action()

    def pxr(self) -> None:
        self.tuv = self.kdj.index(self.current_level.get_data("fij"))
        self.tmx = self.hul.index(self.current_level.get_data("ggk"))
        self.snw = self.current_level.get_data("qqv")
        self.nio.pixels = self.hep[self.snw].pixels.copy()
        self.nio.color_remap(0, self.hul[self.tmx])
        self.nio.set_rotation(self.kdj[self.tuv])

    def ihm(self) -> None:
        kic = False
        for fxn, qis in enumerate(self.qqv):
            dbb = self.current_level.get_sprite_at(qis.x - 1, qis.y - 1, "qex")
            if self.qhg(fxn) and not self.rzt[fxn]:
                kic = True
                if dbb:
                    dbb.set_visible(True)
            else:
                if dbb:
                    dbb.set_visible(False)
        self.opw.set_visible(kic)

    def qhg(self, azz: int) -> bool:
        return self.snw == self.gfy[azz] and self.tmx == self.vxy[azz] and self.tuv == self.cjl[azz]

    def nje(self) -> bool:
        for uop, ywm in enumerate(self.qqv):
            if not self.rzt[uop] and self.mgu.x == ywm.x and self.mgu.y == ywm.y and self.qhg(uop):
                self.rzt[uop] = True
                self.bzf.append(self.qqv[uop])
                self.osd.append(self.pca[uop])
                self.current_level.remove_sprite(self.qqv[uop])
                self.current_level.remove_sprite(self.pca[uop])
                xkp = self.current_level.get_sprite_at(ywm.x - 1, ywm.y - 1, "yar")
                if xkp and "vdr" in xkp.tags:
                    xkp.set_visible(False)
                    aoj = self.current_level.get_sprite_at(ywm.x - 1, ywm.y - 1, "qex")
                    if aoj:
                        aoj.set_visible(False)
                    self.opw.set_visible(False)
        return all(self.rzt)
