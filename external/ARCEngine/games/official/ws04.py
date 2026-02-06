# Author: Claude Opus 4.6
# Date: 2026-02-06 (fixed color 0/1 in pickers, removed mgu left bar)
# PURPOSE: WS04 game - variant with Cyan/Blue/Yellow color theme and vertical UI
# Features: Cyan (8) borders/frames, Blue (9) walls, Yellow (4) door, Light Blue (10) background
#           Vertical energy bar on right side + level progress dots
# SRP/DRY check: Pass - Faithful adaptation of proven game mechanics with new color palette, layouts, and UI style

import logging
import math
from typing import List, Tuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay, Sprite

# WS04 color theme: Cyan (8) borders/frames, maroon (9) walls, yellow (4) door body
# Player: Dark Gray (3) top + Light Pink (7) bottom -- neutral/warm contrast, pops against Blue walls
# Shape sprites use 0 as base color so color_remap(0, target) works correctly
sprites = {
    "dcb": Sprite(pixels=[[-1, 0, -1], [0, 0, -1], [-1, 0, 0]], name="dcb", visible=True, collidable=True, layer=1),
    "fij": Sprite(pixels=[[0, 0, 0], [-1, -1, 0], [0, -1, 0]], name="fij", visible=True, collidable=False, layer=-2),
    "ggk": Sprite(pixels=[[8, 8, 8, 8, 8, 8, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, 8, 8, 8, 8, 8, 8]], name="ggk", visible=True, collidable=True, tags=["yar", "vdr"], layer=-3),
    "hep": Sprite(pixels=[[8]*10]*10, name="hep", visible=True, collidable=True, tags=["nfq"], layer=1),
    "hul": Sprite(pixels=[[4, 4, -1, -1, -1, -1, -1, 4, 4], [4]*9, [4]*9, [4]*9, [4]*9, [4]*9, [4]*9, [4]*9, [4]*9], name="hul", visible=True, collidable=True, layer=-4),
    "kdj": Sprite(pixels=[[0, -1, 0], [-1, 0, -1], [0, -1, 0]], name="kdj", visible=True, collidable=True, tags=["wex"], layer=10),
    "kdy": Sprite(pixels=[[-2]*5, [-2, -2, 8, -2, -2], [-2, 4, 8, 8, -2], [-2, -2, 4, -2, -2], [-2]*5], name="kdy", visible=True, collidable=True, tags=["bgt"], layer=-1),
    "krg": Sprite(pixels=[[2]], name="krg", visible=True, collidable=True, layer=3),
    "lhs": Sprite(pixels=[[8]*5]*5, name="lhs", visible=True, collidable=False, tags=["mae"], layer=-3),
    "lyd": Sprite(pixels=[[-1, 0, -1], [-1, 0, -1], [0, 0, 0]], name="lyd", visible=True, collidable=True),
    "mgu": Sprite(pixels=[[-1]*64]*52 + [[9]*12 + [-1]*52] + [[9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9] + [-1]*52]*7 + [[9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9] + [9]*52]*3 + [[9]*12 + [9]*52], name="mgu", visible=True, collidable=True),
    "nio": Sprite(pixels=[[-1, 0, 0], [0, -1, 0], [-1, 0, -1]], name="nio", visible=True, collidable=True),
    "nlo": Sprite(pixels=[[9]*5]*5, name="nlo", visible=True, collidable=True, tags=["jdd"], layer=-5),
    "opw": Sprite(pixels=[[0, 0, -1], [-1, 0, 0], [0, -1, 0]], name="opw", visible=True, collidable=True),
    "pca": Sprite(pixels=[[3, 3, 3, 3, 3], [3, 3, 3, 3, 3], [7, 7, 7, 7, 7], [7, 7, 7, 7, 7], [7, 7, 7, 7, 7]], name="pca", visible=True, collidable=True, tags=["caf"]),
    "qqv": Sprite(pixels=[[-2]*5, [-2, 9, 14, 14, -2], [-2, 9, 4, 8, -2], [-2, 12, 12, 8, -2], [-2]*5], name="qqv", visible=True, collidable=False, tags=["gic"], layer=-1),
    "rzt": Sprite(pixels=[[0, -1, -1], [-1, 0, -1], [-1, -1, 0]], name="rzt", visible=True, collidable=True, tags=["axa"]),
    "snw": Sprite(pixels=[[8]*7, [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8]*7], name="snw", visible=True, collidable=True, tags=["yar"], layer=-3),
    "tmx": Sprite(pixels=[[0, -1, 0], [0, -1, 0], [0, 0, 0]], name="tmx", visible=True, collidable=True),
    "tuv": Sprite(pixels=[[8]*10] + [[8] + [-1]*8 + [8]]*8 + [[8]*10], name="tuv", visible=False, collidable=True, tags=["fng"], layer=5),
    "ulq": Sprite(pixels=[[8]*7] + [[8] + [-1]*5 + [8]]*5 + [[8]*7], name="ulq", visible=False, collidable=True, tags=["qex"], layer=-1),
    "vxy": Sprite(pixels=[[-2]*5, [-2, 8, -2, -2, -2], [-2, -2, 8, 8, -2], [-2, -2, 8, -2, -2], [-2]*5], name="vxy", visible=True, collidable=False, tags=["gsu"], layer=-1),
    "zba": Sprite(pixels=[[4, 4, 4], [4, -1, 4], [4, 4, 4]], name="zba", visible=True, collidable=False, tags=["iri"], layer=-1),
}

BACKGROUND_COLOR = 10
PADDING_COLOR = 15

# Level definitions - 7 all-new levels with unique wall layouts
levels = [
    # Level 1: Tutorial - open layout, goal in upper-right quadrant
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(42, 13).set_rotation(270),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["kdy"].clone().set_position(34, 40),
            sprites["lhs"].clone().set_position(44, 15),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            (9,50),(14,50),(9,5),(14,5),
            (19,15),(24,15),(29,15),(19,20),(19,25),(19,30),
            (34,25),(39,25),(44,25),(34,30),(34,35),
            (49,35),(49,40),(49,45),(49,50),(54,50),
            (24,40),(29,40),(24,45),(29,45),
        ]] + [
            sprites["pca"].clone().set_position(24, 35),
            sprites["rzt"].clone().set_position(45, 16),
            sprites["snw"].clone().set_position(43, 14),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(43, 14),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": 3, "nlo": 12, "opw": 0, "qqv": 2, "ggk": 9, "fij": 90, "kdy": False},
        name="tutorial",
    ),
    # Level 2: Corridor maze - narrow paths between wall clusters
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(47, 43).set_rotation(180),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["kdy"].clone().set_position(14, 15),
            sprites["lhs"].clone().set_position(49, 45),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            (14,5),(14,10),(14,20),(14,25),(14,30),
            (24,10),(24,15),(24,20),(24,30),(24,35),(24,40),
            (34,5),(34,10),(34,15),(34,20),(34,25),
            (44,15),(44,20),(44,25),(44,30),(44,35),(44,40),
            (9,35),(9,40),(9,45),(9,50),
            (54,10),(54,15),(54,20),(54,25),
            (19,45),(19,50),(29,50),(39,50),(49,50),
        ]] + [
            sprites["pca"].clone().set_position(49, 5),
            sprites["rzt"].clone().set_position(50, 46),
            sprites["snw"].clone().set_position(48, 44),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(48, 44),
            sprites["zba"].clone().set_position(30, 6),
            sprites["zba"].clone().set_position(40, 31),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": 1, "nlo": 14, "opw": 180, "qqv": 4, "ggk": 8, "fij": 270, "kdy": False},
        name="corridor",
    ),
    # Level 3: Diamond layout - walls form diamond shapes
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(12, 8).set_rotation(90),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["kdy"].clone().set_position(49, 30),
            sprites["lhs"].clone().set_position(14, 10),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            # Diamond 1 center (29,20)
            (29,10),(24,15),(34,15),(19,20),(39,20),(24,25),(34,25),(29,30),
            # Diamond 2 center (44,40)
            (44,30),(39,35),(49,35),(34,40),(54,40),(39,45),(49,45),(44,50),
            # Corridor walls
            (9,15),(9,20),(9,25),(9,30),(9,35),(9,40),(9,45),(9,50),
            (54,5),(54,10),(54,15),(54,20),
        ]] + [
            sprites["pca"].clone().set_position(44, 5),
            sprites["qqv"].clone().set_position(19, 45),
            sprites["rzt"].clone().set_position(15, 11),
            sprites["snw"].clone().set_position(13, 9),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(13, 9),
            sprites["zba"].clone().set_position(15, 36),
            sprites["zba"].clone().set_position(50, 26),
            sprites["zba"].clone().set_position(35, 51),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": 0, "nlo": 12, "opw": 270, "qqv": 5, "ggk": 14, "fij": 0, "kdy": False},
        name="diamond",
    ),
    # Level 4: Split arena - central wall divides the map
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(52, 23).set_rotation(180),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["lhs"].clone().set_position(54, 25),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            # Central dividing wall with gap
            (29,5),(29,10),(29,15),(29,20),(29,35),(29,40),(29,45),(29,50),
            # Left side obstacles
            (14,15),(14,20),(14,25),(19,30),(19,35),(19,40),
            (9,10),(9,15),(9,45),(9,50),
            # Right side obstacles
            (44,10),(44,15),(44,20),(39,25),(39,30),(39,35),
            (49,40),(49,45),(49,50),(54,45),(54,50),
        ]] + [
            sprites["pca"].clone().set_position(14, 45),
            sprites["qqv"].clone().set_position(44, 45),
            sprites["rzt"].clone().set_position(55, 26),
            sprites["snw"].clone().set_position(53, 24),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(53, 24),
            sprites["vxy"].clone().set_position(34, 10),
            sprites["zba"].clone().set_position(20, 6),
            sprites["zba"].clone().set_position(40, 51),
            sprites["zba"].clone().set_position(10, 31),
            sprites["zba"].clone().set_position(50, 6),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": 4, "nlo": 9, "opw": 0, "qqv": 3, "ggk": 12, "fij": 180, "kdy": False},
        name="split",
    ),
    # Level 5: Spiral - walls create a spiral path inward
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(27, 23).set_rotation(270),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["kdy"].clone().set_position(54, 10),
            sprites["lhs"].clone().set_position(29, 25),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            # Spiral walls
            (14,5),(19,5),(24,5),(29,5),(34,5),(39,5),(44,5),(49,5),(54,5),
            (54,10),(54,15),(54,20),(54,25),(54,30),(54,35),(54,40),(54,45),(54,50),
            (9,50),(14,50),(19,50),(24,50),(29,50),(34,50),(39,50),(44,50),(49,50),
            (9,10),(9,15),(9,20),(9,25),(9,30),(9,35),(9,40),(9,45),
            (14,10),(19,10),(24,10),(29,10),(34,10),(39,10),(44,10),(49,10),
            (49,15),(49,20),(49,25),(49,30),(49,35),(49,40),(49,45),
            (14,45),(19,45),(24,45),(29,45),(34,45),(39,45),(44,45),
            (14,15),(14,20),(14,25),(14,30),(14,35),(14,40),
            (19,15),(24,15),(29,15),(34,15),(39,15),(44,15),
            (44,20),(44,25),(44,30),(44,35),(44,40),
            (19,40),(24,40),(29,40),(34,40),(39,40),
            (19,20),(19,25),(19,30),(19,35),
        ]] + [
            sprites["pca"].clone().set_position(39, 45),
            sprites["qqv"].clone().set_position(9, 6),
            sprites["rzt"].clone().set_position(30, 26),
            sprites["snw"].clone().set_position(28, 24),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(28, 24),
            sprites["vxy"].clone().set_position(44, 6),
            sprites["zba"].clone().set_position(35, 36),
            sprites["zba"].clone().set_position(25, 21),
            sprites["zba"].clone().set_position(40, 21),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": 2, "nlo": 8, "opw": 90, "qqv": 1, "ggk": 9, "fij": 0, "kdy": False},
        name="spiral",
    ),
    # Level 6: Dual targets - two goals in opposite corners
    Level(
        sprites=[
            sprites["ggk"].clone().set_position(8, 9),
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(52, 43).set_rotation(180),
            sprites["hul"].clone().set_position(7, 8).set_rotation(90),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["kdy"].clone().set_position(29, 25),
            sprites["lhs"].clone().set_position(54, 45),
            sprites["lhs"].clone().set_position(9, 10),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            # X-shaped barriers
            (19,15),(24,20),(34,30),(39,35),(44,40),
            (44,15),(39,20),(24,35),(19,40),
            # Perimeter reinforcement
            (9,5),(14,5),(9,50),(14,50),(49,5),(54,5),(49,50),(54,50),
            (9,25),(9,30),(54,25),(54,30),
            (29,10),(34,10),(29,45),(34,45),
            (14,35),(14,40),(49,15),(49,20),
        ]] + [
            sprites["pca"].clone().set_position(34, 50),
            sprites["qqv"].clone().set_position(24, 5),
            sprites["rzt"].clone().set_position(55, 46),
            sprites["rzt"].clone().set_position(10, 11),
            sprites["snw"].clone().set_position(53, 44),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(53, 44),
            sprites["ulq"].clone().set_position(8, 9),
            sprites["vxy"].clone().set_position(14, 25),
            sprites["zba"].clone().set_position(45, 6),
            sprites["zba"].clone().set_position(10, 46),
            sprites["zba"].clone().set_position(50, 36),
            sprites["zba"].clone().set_position(15, 11),
            sprites["zba"].clone().set_position(40, 26),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": [5, 3], "nlo": [9, 14], "opw": [90, 270], "qqv": 0, "ggk": 12, "fij": 0, "kdy": False},
        name="dual",
    ),
    # Level 7: Fog gauntlet - tight fog of war, energy management critical
    Level(
        sprites=[
            sprites["hep"].clone().set_position(1, 53),
            sprites["hul"].clone().set_position(47, 8).set_rotation(180),
            sprites["kdj"].clone().set_position(3, 55).set_scale(2),
            sprites["kdy"].clone().set_position(14, 45),
            sprites["lhs"].clone().set_position(49, 10),
            sprites["mgu"].clone(),
        ] + [sprites["nlo"].clone().set_position(x, y) for x, y in [
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            # Scattered obstacles for fog navigation
            (19,10),(24,10),(19,20),(24,20),(19,30),(24,30),
            (34,15),(39,15),(34,25),(39,25),(34,35),(39,35),
            (49,20),(49,30),(49,40),(49,50),
            (9,15),(9,25),(9,35),(9,45),(9,50),
            (14,10),(14,20),(14,30),(14,40),(14,50),
            (29,20),(29,40),(44,25),(44,35),(44,45),
            (54,15),(54,25),(54,35),(54,45),(54,50),
        ]] + [
            sprites["pca"].clone().set_position(29, 10),
            sprites["qqv"].clone().set_position(39, 45),
            sprites["rzt"].clone().set_position(50, 11),
            sprites["snw"].clone().set_position(48, 9),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(48, 9),
            sprites["vxy"].clone().set_position(34, 45),
            sprites["zba"].clone().set_position(25, 6),
            sprites["zba"].clone().set_position(45, 6),
            sprites["zba"].clone().set_position(10, 21),
            sprites["zba"].clone().set_position(55, 41),
            sprites["zba"].clone().set_position(30, 31),
            sprites["zba"].clone().set_position(40, 51),
        ],
        grid_size=(64, 64),
        data={"vxy": 36, "tuv": 1, "nlo": 8, "opw": 180, "qqv": 0, "ggk": 14, "fij": 90, "kdy": True},
        name="fogrun",
    ),
]


class jvq(RenderableUserDisplay):
    """WS04 interface - vertical energy bar on right side + level progress dots."""
    zba: List[Tuple[int, int]]

    def __init__(self, vxy: "Ws04", ulq: int):
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
        # Fog of war when enabled
        if self.tuv.qee:
            for hhe in range(64):
                for dcv in range(64):
                    if math.dist((hhe, dcv), (self.tuv.mgu.y + nlo, self.tuv.mgu.x + nlo)) > 15.0:
                        frame[hhe, dcv] = 9

            # Key indicator in corner when fog active - bordered panel
            if self.tuv.nio and self.tuv.nio.is_visible:
                nio = self.tuv.nio.render()
                mgu = 3
                lyd = 55
                # Draw bordered panel: 1px cyan border + gray background
                for hhe in range(lyd - 1, lyd + 7):
                    for w in range(mgu - 1, mgu + 7):
                        if 0 <= hhe < 64 and 0 <= w < 64:
                            if hhe == lyd - 1 or hhe == lyd + 6 or w == mgu - 1 or w == mgu + 6:
                                frame[hhe, w] = 8  # Cyan border
                            else:
                                frame[hhe, w] = 15  # Purple background
                # Draw key sprite on top
                for hhe in range(6):
                    for w in range(6):
                        if nio[hhe][w] != -1:
                            frame[lyd + hhe, mgu + w] = nio[hhe][w]

        # Vertical energy bar on right side (column 61-62, rows from bottom up)
        for hhe in range(self.tmx):
            row = 58 - hhe
            frame[row, 61] = 4 if self.tmx - hhe - 1 < self.snw else 9
            frame[row, 62] = 4 if self.tmx - hhe - 1 < self.snw else 9

        # Lives display (bottom-right, stacked vertically)
        for lhs in range(3):
            row = 61 - lhs * 3
            frame[row, 61] = 3 if self.tuv.lbq > lhs else 9
            frame[row, 62] = 3 if self.tuv.lbq > lhs else 9

        # Level progress dots (top-right corner, row 2, cols 55-61)
        total_levels = len(levels)
        current_idx = self.tuv.ypg
        for lvl in range(total_levels):
            col = 55 + lvl
            if col < 63:
                frame[2, col] = 4 if lvl < current_idx else (3 if lvl == current_idx else 8)

        return frame


class Ws04(ARCBaseGame):
    def __init__(self, seed: int = 0) -> None:
        dcb = levels[0].get_data("vxy") if levels else 0
        fij = dcb if dcb else 0
        self.ggk = jvq(self, fij)

        # Shape sprites: opw(0), lyd(1), tmx(2), nio(3), dcb(4), fij(5)
        self.hep = [sprites["opw"], sprites["lyd"], sprites["tmx"], sprites["nio"], sprites["dcb"], sprites["fij"]]
        self.hul = [12, 9, 14, 8]
        self.kdj = [0, 90, 180, 270]
        self.qee = False
        self.ypg = 0  # Current level index for progress dots

        super().__init__("ws04", levels, Camera(0, 0, 16, 16, BACKGROUND_COLOR, PADDING_COLOR, [self.ggk]), False, seed, [1, 2, 3, 4])

        self.krg()

    def _get_rotation_index(self, value) -> int:
        try:
            return self.kdj.index(value)
        except (ValueError, TypeError):
            logging.warning(f"ws04: rotation {value} not in {self.kdj}, using index 0")
            return 0

    def _get_color_index(self, value) -> int:
        try:
            return self.hul.index(value)
        except (ValueError, TypeError):
            logging.warning(f"ws04: color {value} not in {self.hul}, using index 0")
            return 0

    def krg(self) -> None:
        """Reset energy interface based on current level data."""
        fig = self.current_level.get_data("vxy")
        if fig:
            self.ggk.tmx = fig
            self.ggk.opw()

    def on_set_level(self, level: Level) -> None:
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
        self.qee = self.current_level.get_data("kdy")

        # Track level index for progress dots
        for idx, lvl in enumerate(levels):
            if lvl.name == self.current_level.name:
                self.ypg = idx
                break

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
            self.cjl.append(self._get_rotation_index(yxt[dqk]))
            self.vxy.append(self._get_color_index(lxu[dqk]))
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
        oyx = self.current_level._sprites
        return [bes for bes in oyx if bes.x >= edo and bes.x < edo + hds and bes.y >= cdg and bes.y < cdg + xwr]

    def step(self) -> None:
        if self.xhp:
            self.egb.set_visible(False)
            self.nio.set_visible(True)
            self.xhp = False
            self.complete_action()
            return

        if self.kbj:
            self.nlo.color_remap(None, 8)
            self.kbj = False
            self.complete_action()
            return

        lgr = 0
        kyr = 0
        axv = False
        if self.action.id.value == 1:
            kyr = -1
            axv = True
        elif self.action.id.value == 2:
            kyr = 1
            axv = True
        elif self.action.id.value == 3:
            lgr = -1
            axv = True
        elif self.action.id.value == 4:
            lgr = 1
            axv = True

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
                    self.complete_action()
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
            self.vcn = []
            self.bzf = []
            self.osd = []
            self.ggk.rzt(self.ggk.tmx)
            self.opw.set_visible(False)
            for sfs in self.current_level.get_sprites_by_tag("qex"):
                sfs.set_visible(False)
            for pqv in self.current_level.get_sprites_by_tag("yar"):
                pqv.set_visible(True)
            self.complete_action()
            return
        self.complete_action()

    def pxr(self) -> None:
        self.tuv = self._get_rotation_index(self.current_level.get_data("fij"))
        self.tmx = self._get_color_index(self.current_level.get_data("ggk"))
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

        for uop in range(len(self.rzt)):
            if not self.rzt[uop]:
                return False
        return True
