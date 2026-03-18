# Author: Claude Opus 4.6
# Date: 2026-02-07 (fixed energy bar colors, redesigned player sprite)
# PURPOSE: WS04 game - variant with Cyan/Blue/Yellow color theme and vertical UI
# Features: Cyan (8) borders/frames, Blue (9) walls, Yellow (4) door, Light Blue (10) background
#           Vertical energy bar on right side + level progress dots
# SRP/DRY check: Pass - Faithful adaptation of proven game mechanics with new color palette, layouts, and UI style

import logging
import math
from typing import List, Tuple

import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay, Sprite

# WS04 color theme: Cyan (8) borders/frames, maroon (9) walls, yellow (4) door body
# Player: Yellow (11) helmet, White (0) eyes, Blue (9) suit, Cyan (8) boots/shoulders, Blue (1) visor
# Shape sprites use 0 as base color so color_remap(0, target) works correctly
sprites = {
    "dcb": Sprite(pixels=[[-1, 0, -1], [0, 0, -1], [-1, 0, 0]], name="dcb", visible=True, collidable=True, layer=1),
    "fij": Sprite(pixels=[[0, 0, 0], [-1, -1, 0], [0, -1, 0]], name="fij", visible=True, collidable=False, layer=-2),
    "ggk": Sprite(pixels=[[8, 8, 8, 8, 8, 8, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, 8, 8, 8, 8, 8, 8]], name="ggk", visible=True, collidable=True, tags=["frame", "dual_slot_frame"], layer=-3),
    "hep": Sprite(pixels=[[8]*10]*10, name="hep", visible=True, collidable=True, tags=["level_boundary"], layer=1),
    "hul": Sprite(pixels=[[4, 4, -1, -1, -1, -1, -1, 4, 4], [4]*9, [4]*9, [4]*9, [4]*9, [4]*9, [4]*9, [4]*9, [4]*9], name="hul", visible=True, collidable=True, layer=-4),
    "kdj": Sprite(pixels=[[0, -1, 0], [-1, 0, -1], [0, -1, 0]], name="kdj", visible=True, collidable=True, tags=["key_indicator"], layer=10),
    "kdy": Sprite(pixels=[[-2]*5, [-2, -2, 8, -2, -2], [-2, 4, 8, 8, -2], [-2, -2, 4, -2, -2], [-2]*5], name="kdy", visible=True, collidable=True, tags=["rotation_changer"], layer=-1),
    "krg": Sprite(pixels=[[2]], name="krg", visible=True, collidable=True, layer=3),
    "lhs": Sprite(pixels=[[8]*5]*5, name="lhs", visible=True, collidable=False, tags=["key_slot"], layer=-3),
    "lyd": Sprite(pixels=[[-1, 0, -1], [-1, 0, -1], [0, 0, 0]], name="lyd", visible=True, collidable=True),
    "mgu": Sprite(pixels=[[-1]*64]*52 + [[9]*12 + [-1]*52] + [[9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9] + [-1]*52]*7 + [[9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9] + [9]*52]*3 + [[9]*12 + [9]*52], name="mgu", visible=True, collidable=True),
    "nio": Sprite(pixels=[[-1, 0, 0], [0, -1, 0], [-1, 0, -1]], name="nio", visible=True, collidable=True),
    "nlo": Sprite(pixels=[[9]*5]*5, name="nlo", visible=True, collidable=True, tags=["wall"], layer=-5),
    "opw": Sprite(pixels=[[0, 0, -1], [-1, 0, 0], [0, -1, 0]], name="opw", visible=True, collidable=True),
    "pca": Sprite(pixels=[[-1, 11, 11, 11, -1], [11, 0, 1, 0, 11], [8, 9, 9, 9, 8], [-1, 9, 11, 9, -1], [-1, 8, -1, 8, -1]], name="pca", visible=True, collidable=True, tags=["player"]),
    "qqv": Sprite(pixels=[[-2]*5, [-2, 9, 14, 14, -2], [-2, 9, 4, 8, -2], [-2, 12, 12, 8, -2], [-2]*5], name="qqv", visible=True, collidable=False, tags=["color_changer"], layer=-1),
    "rzt": Sprite(pixels=[[0, -1, -1], [-1, 0, -1], [-1, -1, 0]], name="rzt", visible=True, collidable=True, tags=["lock"]),
    "snw": Sprite(pixels=[[8]*7, [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8, -1, -1, -1, -1, -1, 8], [8]*7], name="snw", visible=True, collidable=True, tags=["frame"], layer=-3),
    "tmx": Sprite(pixels=[[0, -1, 0], [0, -1, 0], [0, 0, 0]], name="tmx", visible=True, collidable=True),
    "tuv": Sprite(pixels=[[8]*10] + [[8] + [-1]*8 + [8]]*8 + [[8]*10], name="tuv", visible=False, collidable=True, tags=["win_indicator"], layer=5),
    "ulq": Sprite(pixels=[[8]*7] + [[8] + [-1]*5 + [8]]*5 + [[8]*7], name="ulq", visible=False, collidable=True, tags=["slot_border"], layer=-1),
    "vxy": Sprite(pixels=[[-2]*5, [-2, 8, -2, -2, -2], [-2, -2, 8, 8, -2], [-2, -2, 8, -2, -2], [-2]*5], name="vxy", visible=True, collidable=False, tags=["shape_changer"], layer=-1),
    "zba": Sprite(pixels=[[4, 4, 4], [4, -1, 4], [4, 4, 4]], name="zba", visible=True, collidable=False, tags=["energy_pickup"], layer=-1),
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
        data={"max_energy": 36, "slot_shapes": 3, "slot_colors": 12, "slot_rotations": 0, "initial_shape": 3, "initial_color": 12, "initial_rotation": 90, "enable_fog": False},
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
        data={"max_energy": 36, "slot_shapes": 1, "slot_colors": 14, "slot_rotations": 180, "initial_shape": 1, "initial_color": 14, "initial_rotation": 270, "enable_fog": False},
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
        data={"max_energy": 36, "slot_shapes": 0, "slot_colors": 12, "slot_rotations": 270, "initial_shape": 0, "initial_color": 14, "initial_rotation": 0, "enable_fog": False},
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
        data={"max_energy": 36, "slot_shapes": 4, "slot_colors": 9, "slot_rotations": 0, "initial_shape": 3, "initial_color": 12, "initial_rotation": 0, "enable_fog": False},
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
            # Perimeter walls
            (4,0),(9,0),(14,0),(19,0),(24,0),(29,0),(34,0),(39,0),(44,0),(49,0),(54,0),(59,0),
            (4,5),(59,5),(4,10),(59,10),(4,15),(59,15),(4,20),(59,20),
            (4,25),(59,25),(4,30),(59,30),(4,35),(59,35),(4,40),(59,40),
            (4,45),(59,45),(4,50),(59,50),(4,55),(9,55),(14,55),(19,55),
            (24,55),(29,55),(34,55),(39,55),(44,55),(49,55),(54,55),(59,55),
            # Spiral walls - outer ring (entry from top-left at y=5)
            (24,5),(29,5),(34,5),(39,5),(44,5),(49,5),(54,5),
            (54,10),(54,15),(54,20),(54,25),(54,30),(54,35),(54,40),(54,45),(54,50),
            (9,50),(14,50),(19,50),(24,50),(29,50),(34,50),(39,50),(44,50),(49,50),
            (9,10),(9,15),(9,20),(9,25),(9,30),(9,35),(9,40),(9,45),
            # Second ring (entry from left at x=9, y between 10-15)
            (14,10),(19,10),(24,10),(29,10),(34,10),(39,10),(44,10),(49,10),
            (49,15),(49,20),(49,25),(49,30),(49,35),(49,40),(49,45),
            (14,45),(19,45),(24,45),(29,45),(34,45),(39,45),(44,45),
            (14,20),(14,25),(14,30),(14,35),(14,40),
            # Third ring (entry from bottom at y=45)
            (19,15),(24,15),(29,15),(34,15),(39,15),(44,15),
            (44,20),(44,25),(44,30),(44,35),(44,40),
            (19,40),(24,40),(34,40),(39,40),
            (19,20),(19,25),(19,30),(19,35),
            # Inner walls (entry from right at x=44, y between 20-25)
            (24,20),(29,20),(34,20),(39,20),
            (24,35),(29,35),(34,35),(39,35),
            (24,25),(24,30),
        ]] + [
            sprites["pca"].clone().set_position(14, 5),
            sprites["qqv"].clone().set_position(9, 6),
            sprites["rzt"].clone().set_position(30, 26),
            sprites["snw"].clone().set_position(28, 24),
            sprites["tuv"].clone().set_position(1, 53),
            sprites["ulq"].clone().set_position(28, 24),
            sprites["vxy"].clone().set_position(19, 6),
            sprites["zba"].clone().set_position(35, 36),
            sprites["zba"].clone().set_position(29, 41),
            sprites["zba"].clone().set_position(40, 16),
        ],
        grid_size=(64, 64),
        data={"max_energy": 36, "slot_shapes": 2, "slot_colors": 8, "slot_rotations": 90, "initial_shape": 1, "initial_color": 9, "initial_rotation": 0, "enable_fog": False},
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
        data={"max_energy": 36, "slot_shapes": [5, 3], "slot_colors": [9, 14], "slot_rotations": [90, 270], "initial_shape": 0, "initial_color": 12, "initial_rotation": 0, "enable_fog": False},
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
        data={"max_energy": 36, "slot_shapes": 1, "slot_colors": 8, "slot_rotations": 180, "initial_shape": 0, "initial_color": 14, "initial_rotation": 90, "enable_fog": True},
        name="fogrun",
    ),
]


class VerticalEnergyInterface(RenderableUserDisplay):
    """WS04 interface - vertical energy bar on right side + level progress dots.
    
    Renders:
    - Fog of war overlay (when enabled)
    - Key indicator panel in corner during fog
    - Vertical energy bar (right side, columns 61-62)
    - Lives display (bottom-right, stacked vertically)
    - Level progress dots (top-right corner)
    """
    zba: List[Tuple[int, int]]

    def __init__(self, game: "Ws04", max_energy: int):
        self.game = game
        self.max_energy = max_energy
        self.current_energy = max_energy

    def set_energy(self, energy: int) -> None:
        """Set current energy level, clamped to [0, max_energy]."""
        self.current_energy = max(0, min(energy, self.max_energy))

    def consume_energy(self) -> bool:
        """Consume one unit of energy. Returns True if energy remains."""
        if self.current_energy >= 0:
            self.current_energy -= 1
        return self.current_energy >= 0

    def refill_energy(self) -> None:
        """Restore energy to maximum."""
        self.current_energy = self.max_energy

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        if self.max_energy == 0 or self.game.showing_death_screen:
            return frame

        sprite_center_offset = 1.5
        # Fog of war when enabled
        if self.game.fog_enabled:
            for row in range(64):
                for col in range(64):
                    if math.dist((row, col), (self.game.player.y + sprite_center_offset, self.game.player.x + sprite_center_offset)) > 15.0:
                        frame[row, col] = 9

            # Key indicator in corner when fog active - bordered panel
            if self.game.key_indicator and self.game.key_indicator.is_visible:
                key_pixels = self.game.key_indicator.render()
                panel_x = 3
                panel_y = 55
                # Draw bordered panel: 1px cyan border + gray background
                for row in range(panel_y - 1, panel_y + 7):
                    for col in range(panel_x - 1, panel_x + 7):
                        if 0 <= row < 64 and 0 <= col < 64:
                            if row == panel_y - 1 or row == panel_y + 6 or col == panel_x - 1 or col == panel_x + 6:
                                frame[row, col] = 8  # Cyan border
                            else:
                                frame[row, col] = 15  # Purple background
                # Draw key sprite on top
                for row in range(6):
                    for col in range(6):
                        if key_pixels[row][col] != -1:
                            frame[panel_y + row, panel_x + col] = key_pixels[row][col]

        # Vertical energy bar on right side (column 61-62, rows from bottom up)
        for i in range(self.max_energy):
            row = 58 - i
            frame[row, 61] = 11 if self.max_energy - i - 1 < self.current_energy else 9
            frame[row, 62] = 11 if self.max_energy - i - 1 < self.current_energy else 9

        # Lives display (bottom-right, stacked vertically)
        for life_idx in range(3):
            row = 61 - life_idx * 3
            frame[row, 61] = 15 if self.game.lives_remaining > life_idx else 9
            frame[row, 62] = 15 if self.game.lives_remaining > life_idx else 9

        # Level progress dots (top-right corner, row 2, cols 55-61)
        total_levels = len(levels)
        current_idx = self.game.current_level_index
        for lvl in range(total_levels):
            col = 55 + lvl
            if col < 63:
                frame[2, col] = 11 if lvl < current_idx else (15 if lvl == current_idx else 8)

        return frame


class Ws04(ARCBaseGame):
    """WS04 - Cyan/Blue/Yellow Puzzle Game.
    
    A variant with Cyan (8) borders/frames, Blue (9) walls, Yellow (4) doors,
    vertical energy bar on the right side, and level progress dots.
    
    Game Mechanics:
    - Optional fog of war (enabled per level via enable_fog data key)
    - Energy system: each move consumes energy, running out causes respawn
    - Lives system: 3 lives total, losing all lives ends the game
    - Key matching: player must configure key shape/color/rotation to match lock slots
    - 7 unique levels with increasing difficulty
    
    Level Data Keys:
    - max_energy: Maximum energy available for the level
    - slot_shapes: Shape indices for each key slot
    - slot_colors: Color indices for each key slot
    - slot_rotations: Rotation angles for each key slot
    - initial_shape: Initial shape index for the key indicator
    - initial_color: Initial color index for the key indicator
    - initial_rotation: Initial rotation angle for the key indicator
    - enable_fog: Flag to enable fog of war
    
    Sprite Tags:
    - player: Player sprite
    - key_indicator: Key indicator sprite
    - level_boundary: Level boundary sprite
    - win_indicator: Win indicator sprite
    - lock: Lock sprites
    - key_slot: Key slot sprites
    - wall: Wall sprites (blocks movement)
    - energy_pickup: Energy pickup sprites
    - shape_changer: Shape changer sprites
    - color_changer: Color changer sprites
    - rotation_changer: Rotation changer sprites
    - slot_border: Slot border sprites
    - frame: Frame sprites
    - dual_slot_frame: Special frame tag for dual-slot levels
    """
    def __init__(self, seed: int = 0) -> None:
        """Initialize WS04 game instance.
        
        Args:
            seed: Random seed for procedural generation (default: 0)
        """
        # Initialize energy interface before super().__init__ since on_set_level is called during init
        initial_energy = levels[0].get_data("max_energy") if levels else 0
        energy_value = initial_energy if initial_energy else 0
        self.energy_interface = VerticalEnergyInterface(self, energy_value)

        # Shape sprites: opw(0), lyd(1), tmx(2), nio(3), dcb(4), fij(5)
        self.shape_templates = [sprites["opw"], sprites["lyd"], sprites["tmx"], sprites["nio"], sprites["dcb"], sprites["fij"]]
        self.color_palette = [12, 9, 14, 8]
        self.rotation_angles = [0, 90, 180, 270]
        self.fog_enabled = False
        self.current_level_index = 0  # Current level index for progress dots

        super().__init__(
            game_id="ws04",
            levels=levels,
            camera=Camera(0, 0, 16, 16, BACKGROUND_COLOR, PADDING_COLOR, [self.energy_interface]),
            debug=False,
            seed=seed,
            available_actions=[1, 2, 3, 4]
        )

        self.reset_energy_interface()

    def _get_rotation_index(self, value) -> int:
        """Convert rotation angle to index in rotation_angles array."""
        try:
            return self.rotation_angles.index(value)
        except (ValueError, TypeError):
            logging.warning(f"ws04: rotation {value} not in {self.rotation_angles}, using index 0")
            return 0

    def _get_color_index(self, value) -> int:
        """Convert color value to index in color_palette array."""
        try:
            return self.color_palette.index(value)
        except (ValueError, TypeError):
            logging.warning(f"ws04: color {value} not in {self.color_palette}, using index 0")
            return 0

    def reset_energy_interface(self) -> None:
        """Reset energy interface based on current level data."""
        max_energy = self.current_level.get_data("max_energy")
        if max_energy:
            self.energy_interface.max_energy = max_energy
            self.energy_interface.refill_energy()

    def on_set_level(self, level: Level) -> None:
        """Called when a level is loaded. Initialize level-specific game state."""
        # Use tags to identify game sprites
        self.player = self.current_level.get_sprites_by_tag("player")[0]
        self.key_indicator = self.current_level.get_sprites_by_tag("key_indicator")[0]
        self.level_boundary = self.current_level.get_sprites_by_tag("level_boundary")[0]
        self.win_indicator = self.current_level.get_sprites_by_tag("win_indicator")[0]
        self.lock_sprites = self.current_level.get_sprites_by_tag("lock")
        self.key_slots = self.current_level.get_sprites_by_tag("key_slot")
        self.keys_collected = [False] * len(self.lock_sprites)

        self.current_shape_index = 0
        self.current_color_index = 0
        self.current_rotation_index = 0
        self.reset_energy_interface()

        self.slot_rotations = []
        self.slot_colors = []
        self.fog_enabled = self.current_level.get_data("enable_fog")

        # Track level index for progress dots
        for idx, lvl in enumerate(levels):
            if lvl.name == self.current_level.name:
                self.current_level_index = idx
                break

        self.slot_shapes = self.current_level.get_data("slot_shapes")
        if isinstance(self.slot_shapes, int):
            self.slot_shapes = [self.slot_shapes]

        slot_rotations_data = self.current_level.get_data("slot_rotations")
        if isinstance(slot_rotations_data, int):
            slot_rotations_data = [slot_rotations_data]

        slot_colors_data = self.current_level.get_data("slot_colors")
        if isinstance(slot_colors_data, int):
            slot_colors_data = [slot_colors_data]

        for slot_index in range(len(self.key_slots)):
            self.slot_rotations.append(self._get_rotation_index(slot_rotations_data[slot_index]))
            self.slot_colors.append(self._get_color_index(slot_colors_data[slot_index]))
            self.lock_sprites[slot_index].pixels = self.shape_templates[self.slot_shapes[slot_index]].pixels.copy()
            self.lock_sprites[slot_index].color_remap(0, self.color_palette[self.slot_colors[slot_index]])
            self.lock_sprites[slot_index].set_rotation(self.rotation_angles[self.slot_rotations[slot_index]])

        self.reset_key_state()
        self.death_overlay = sprites["krg"].clone()
        self.current_level.add_sprite(self.death_overlay)
        self.death_overlay.set_visible(False)
        self.lives_remaining = 3
        self.collected_energy_sprites: List[Sprite] = []
        self.removed_key_slots: List[Sprite] = []
        self.removed_locks: List[Sprite] = []
        self.showing_death_screen = False
        self.showing_key_error = False
        self.spawn_x = self.player.x
        self.spawn_y = self.player.y

    def get_sprites_in_area(self, x: int, y: int, width: int, height: int) -> List[Sprite]:
        """Get all sprites within a rectangular area."""
        return [sprite for sprite in self.current_level.get_sprites() if sprite.x >= x and sprite.x < x + width and sprite.y >= y and sprite.y < y + height]

    def step(self) -> None:
        """Main game loop - processes player actions and updates game state."""
        if self.showing_death_screen:
            self.death_overlay.set_visible(False)
            self.key_indicator.set_visible(True)
            self.showing_death_screen = False
            self.complete_action()
            return

        if self.showing_key_error:
            self.level_boundary.color_remap(None, 8)
            self.showing_key_error = False
            self.complete_action()
            return

        dx, dy, valid_action = 0, 0, False
        if self.action.id == GameAction.ACTION1:
            dy, valid_action = -1, True
        elif self.action.id == GameAction.ACTION2:
            dy, valid_action = 1, True
        elif self.action.id == GameAction.ACTION3:
            dx, valid_action = -1, True
        elif self.action.id == GameAction.ACTION4:
            dx, valid_action = 1, True

        if not valid_action:
            self.complete_action()
            return

        collected_energy = False
        new_x, new_y = self.player.x + dx * 5, self.player.y + dy * 5
        sprites_at_target = self.get_sprites_in_area(new_x, new_y, 5, 5)

        blocked_by_wall = False
        for sprite in sprites_at_target:
            if sprite.tags is None:
                break
            elif "wall" in sprite.tags:
                blocked_by_wall = True
                break
            elif "key_slot" in sprite.tags:
                slot_index = self.key_slots.index(sprite)
                if not self.check_key_matches(slot_index):
                    self.level_boundary.color_remap(None, 0)
                    self.showing_key_error = True
                    return
            elif "energy_pickup" in sprite.tags:
                collected_energy = True
                self.energy_interface.set_energy(self.energy_interface.max_energy)
                self.collected_energy_sprites.append(sprite)
                self.current_level.remove_sprite(sprite)
            elif "shape_changer" in sprite.tags:
                self.current_shape_index = (self.current_shape_index + 1) % len(self.shape_templates)
                self.key_indicator.pixels = self.shape_templates[self.current_shape_index].pixels.copy()
                self.key_indicator.color_remap(0, self.color_palette[self.current_color_index])
                self.update_key_slots()
            elif "color_changer" in sprite.tags:
                next_color = (self.current_color_index + 1) % len(self.color_palette)
                self.key_indicator.color_remap(self.color_palette[self.current_color_index], self.color_palette[next_color])
                self.current_color_index = next_color
                self.update_key_slots()
            elif "rotation_changer" in sprite.tags:
                self.current_rotation_index = (self.current_rotation_index + 1) % 4
                self.key_indicator.set_rotation(self.rotation_angles[self.current_rotation_index])
                self.update_key_slots()

        if not blocked_by_wall:
            self.player.set_position(new_x, new_y)

        if self.check_all_keys_collected():
            self.next_level()
            self.complete_action()
            return

        if not collected_energy and not self.energy_interface.consume_energy():
            self.lives_remaining -= 1
            if self.lives_remaining == 0:
                self.lose()
                self.complete_action()
                return
            self.death_overlay.set_visible(True)
            self.death_overlay.set_scale(64)
            self.death_overlay.set_position(0, 0)
            self.key_indicator.set_visible(False)

            self.showing_death_screen = True
            self.keys_collected = [False] * len(self.key_slots)
            self.player.set_position(self.spawn_x, self.spawn_y)
            self.reset_key_state()
            for energy_sprite in self.collected_energy_sprites:
                self.current_level.add_sprite(energy_sprite)
            for slot in self.removed_key_slots:
                self.current_level.add_sprite(slot)
            for lock in self.removed_locks:
                self.current_level.add_sprite(lock)
            self.collected_energy_sprites, self.removed_key_slots, self.removed_locks = [], [], []
            self.energy_interface.set_energy(self.energy_interface.max_energy)
            self.win_indicator.set_visible(False)
            for border in self.current_level.get_sprites_by_tag("slot_border"):
                border.set_visible(False)
            for frame in self.current_level.get_sprites_by_tag("frame"):
                frame.set_visible(True)
            return
        self.complete_action()

    def reset_key_state(self) -> None:
        """Reset the key indicator to its initial configuration for the current level."""
        self.current_rotation_index = self._get_rotation_index(self.current_level.get_data("initial_rotation"))
        self.current_color_index = self._get_color_index(self.current_level.get_data("initial_color"))
        self.current_shape_index = self.current_level.get_data("initial_shape")
        self.key_indicator.pixels = self.shape_templates[self.current_shape_index].pixels.copy()
        self.key_indicator.color_remap(0, self.color_palette[self.current_color_index])
        self.key_indicator.set_rotation(self.rotation_angles[self.current_rotation_index])

    def update_key_slots(self) -> None:
        """Update visual state of key slots based on current key configuration."""
        any_unlocked = False
        for slot_idx, slot in enumerate(self.key_slots):
            border = self.current_level.get_sprite_at(slot.x - 1, slot.y - 1, "slot_border")
            if self.check_key_matches(slot_idx) and not self.keys_collected[slot_idx]:
                any_unlocked = True
                if border:
                    border.set_visible(True)
            else:
                if border:
                    border.set_visible(False)
        self.win_indicator.set_visible(any_unlocked)

    def check_key_matches(self, slot_index: int) -> bool:
        """Check if current key configuration matches a specific slot."""
        return self.current_shape_index == self.slot_shapes[slot_index] and self.current_color_index == self.slot_colors[slot_index] and self.current_rotation_index == self.slot_rotations[slot_index]

    def check_all_keys_collected(self) -> bool:
        """Check if player has collected all keys and update game state."""
        for slot_idx, slot in enumerate(self.key_slots):
            if not self.keys_collected[slot_idx] and self.player.x == slot.x and self.player.y == slot.y and self.check_key_matches(slot_idx):
                self.keys_collected[slot_idx] = True
                self.removed_key_slots.append(self.key_slots[slot_idx])
                self.removed_locks.append(self.lock_sprites[slot_idx])
                self.current_level.remove_sprite(self.key_slots[slot_idx])
                self.current_level.remove_sprite(self.lock_sprites[slot_idx])

                frame = self.current_level.get_sprite_at(slot.x - 1, slot.y - 1, "frame")
                if frame and "dual_slot_frame" in frame.tags:
                    frame.set_visible(False)
                    border = self.current_level.get_sprite_at(slot.x - 1, slot.y - 1, "slot_border")
                    if border:
                        border.set_visible(False)
                    self.win_indicator.set_visible(False)

        return all(self.keys_collected)
