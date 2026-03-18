# Author: Claude Opus 4.6
# Date: 2026-02-07 (redesigned pca player sprite to mage/wizard)
# PURPOSE: WS03 game - variant of LS20 with permanent fog of war + seeded randomness
# Features: Magenta borders (6), dark red walls (13), gray fog of war (2), mage player (15+12+6+13)
# SRP/DRY check: Pass - Reuses proven game mechanics from LS20, shape sprites use 0 base for remap

import logging
import math
from typing import List, Tuple

import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay, Sprite

# WS03 uses distinctive colors: Magenta borders (6), dark red walls (13), orange energy (12), mage player (15+12+6+13)
# Shape sprites (dcb, fij, lyd, nio, opw, tmx) use 0 as base color so color_remap(0, target) works
sprites = {
    "dcb": Sprite(pixels=[[-1, 0, -1], [0, 0, -1], [-1, 0, 0]], name="dcb", visible=True, collidable=True, layer=1),
    "fij": Sprite(pixels=[[0, 0, 0], [-1, -1, 0], [0, -1, 0]], name="fij", visible=True, collidable=False, layer=-2),
    "ggk": Sprite(pixels=[[6, 6, 6, 6, 6, 6, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, 6, 6, 6, 6, 6, 6]], name="ggk", visible=True, collidable=True, tags=["frame", "dual_slot_frame"], layer=-3),
    "hep": Sprite(pixels=[[6]*10]*10, name="hep", visible=True, collidable=True, tags=["level_boundary"], layer=1),
    "hul": Sprite(pixels=[[13, 13, -1, -1, -1, -1, -1, 13, 13], [13]*9, [13]*9, [13]*9, [13]*9, [13]*9, [13]*9, [13]*9, [13]*9], name="hul", visible=True, collidable=True, layer=-4),
    "kdj": Sprite(pixels=[[0, -1, 0], [-1, 0, -1], [0, -1, 0]], name="kdj", visible=True, collidable=True, tags=["key_indicator"], layer=10),
    "kdy": Sprite(pixels=[[-2]*5, [-2, -2, 6, -2, -2], [-2, 12, 6, 6, -2], [-2, -2, 12, -2, -2], [-2]*5], name="kdy", visible=True, collidable=True, tags=["rotation_changer"], layer=-1),
    "krg": Sprite(pixels=[[8]], name="krg", visible=True, collidable=True, layer=3),
    "lhs": Sprite(pixels=[[6]*5]*5, name="lhs", visible=True, collidable=False, tags=["key_slot"], layer=-3),
    "lyd": Sprite(pixels=[[-1, 0, -1], [-1, 0, -1], [0, 0, 0]], name="lyd", visible=True, collidable=True),
    "mgu": Sprite(pixels=[[6, 6, 6, 6] + [-1]*60]*52 + [[13]*12 + [-1]*52] + [[13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 13] + [-1]*52]*7 + [[13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 13] + [13]*52]*3 + [[13]*12 + [13]*52], name="mgu", visible=True, collidable=True),
    "nio": Sprite(pixels=[[-1, 0, 0], [0, -1, 0], [-1, 0, -1]], name="nio", visible=True, collidable=True),
    "nlo": Sprite(pixels=[[13]*5]*5, name="nlo", visible=True, collidable=True, tags=["wall"], layer=-5),
    "opw": Sprite(pixels=[[0, 0, -1], [-1, 0, 0], [0, -1, 0]], name="opw", visible=True, collidable=True),
    "pca": Sprite(pixels=[[-1, -1, 15, -1, -1], [-1, 15, 0, 15, -1], [15, 12, 12, 12, 15], [-1, 6, 6, 6, -1], [-1, 13, -1, 13, -1]], name="pca", visible=True, collidable=True, tags=["player"]),
    "qqv": Sprite(pixels=[[-2]*5, [-2, 15, 8, 8, -2], [-2, 15, 6, 11, -2], [-2, 12, 12, 11, -2], [-2]*5], name="qqv", visible=True, collidable=False, tags=["color_changer"], layer=-1),
    "rzt": Sprite(pixels=[[0, -1, -1], [-1, 0, -1], [-1, -1, 0]], name="rzt", visible=True, collidable=True, tags=["lock"]),
    "snw": Sprite(pixels=[[6]*7, [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6, -1, -1, -1, -1, -1, 6], [6]*7], name="snw", visible=True, collidable=True, tags=["frame"], layer=-3),
    "tmx": Sprite(pixels=[[0, -1, 0], [0, -1, 0], [0, 0, 0]], name="tmx", visible=True, collidable=True),
    "tuv": Sprite(pixels=[[6]*10] + [[6] + [-1]*8 + [6]]*8 + [[6]*10], name="tuv", visible=False, collidable=True, tags=["win_indicator"], layer=5),
    "ulq": Sprite(pixels=[[6]*7] + [[6] + [-1]*5 + [6]]*5 + [[6]*7], name="ulq", visible=False, collidable=True, tags=["slot_border"], layer=-1),
    "vxy": Sprite(pixels=[[-2]*5, [-2, 6, -2, -2, -2], [-2, -2, 6, 6, -2], [-2, -2, 6, -2, -2], [-2]*5], name="vxy", visible=True, collidable=False, tags=["shape_changer"], layer=-1),
    "zba": Sprite(pixels=[[12]], name="zba", visible=True, collidable=False, tags=["energy_pickup"], layer=-1),
}

BACKGROUND_COLOR = 10
PADDING_COLOR = 15


class FogOfWarInterface(RenderableUserDisplay):
    """Fog of War interface - renders visibility radius around player and UI elements."""
    zba: List[Tuple[int, int]]

    def __init__(self, game: "Ws03", max_energy: int):
        self.game = game
        self.max_energy = max_energy
        self.current_energy = max_energy

    def set_energy(self, energy: int) -> None:
        self.current_energy = max(0, min(energy, self.max_energy))

    def consume_energy(self) -> bool:
        if self.current_energy >= 0:
            self.current_energy -= 1
        return self.current_energy >= 0

    def refill_energy(self) -> None:
        self.current_energy = self.max_energy

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        if self.max_energy == 0 or self.game.showing_death_screen:
            return frame

        sprite_center_offset = 1.5
        # Always render fog of war in WS03
        if self.game.fog_enabled:
            for row in range(64):
                for col in range(64):
                    if math.dist((row, col), (self.game.player.y + sprite_center_offset, self.game.player.x + sprite_center_offset)) > 10.0:
                        frame[row, col] = 2

            if self.game.key_indicator and self.game.key_indicator.is_visible:
                key_pixels = self.game.key_indicator.render()
                panel_x = 3
                panel_y = 55
                # Draw bordered panel: 1px magenta border + gray background
                for row in range(panel_y - 1, panel_y + 7):
                    for col in range(panel_x - 1, panel_x + 7):
                        if 0 <= row < 64 and 0 <= col < 64:
                            if row == panel_y - 1 or row == panel_y + 6 or col == panel_x - 1 or col == panel_x + 6:
                                frame[row, col] = 6  # Magenta border
                            else:
                                frame[row, col] = 15  # Purple background
                # Draw key sprite on top of background
                for row in range(6):
                    for col in range(6):
                        if key_pixels[row][col] != -1:
                            frame[panel_y + row, panel_x + col] = key_pixels[row][col]

        for i in range(self.max_energy):
            energy_x = 13 + i
            energy_y = 61
            frame[energy_y : energy_y + 2, energy_x] = 12 if self.max_energy - i - 1 < self.current_energy else 15

        for life_index in range(3):
            life_x = 56 + 3 * life_index
            life_y = 61
            for x_offset in range(2):
                frame[life_y : life_y + 2, life_x + x_offset] = 14 if self.game.lives_remaining > life_index else 15
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
        data={"max_energy": 42, "slot_shapes": 5, "slot_colors": 9, "slot_rotations": 270, "initial_shape": 5, "initial_color": 12, "initial_rotation": 0, "enable_fog": True},
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
        data={"max_energy": 42, "slot_shapes": 5, "slot_colors": 9, "slot_rotations": 270, "initial_shape": 5, "initial_color": 9, "initial_rotation": 0, "enable_fog": True},
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
        data={"max_energy": 42, "slot_shapes": 5, "slot_colors": 9, "slot_rotations": 0, "initial_shape": 5, "initial_color": 9, "initial_rotation": 270, "enable_fog": True},
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
        data={"max_energy": 42, "slot_shapes": 5, "slot_colors": 9, "slot_rotations": 0, "initial_shape": 4, "initial_color": 14, "initial_rotation": 0, "enable_fog": True},
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
        data={"max_energy": 42, "slot_shapes": 5, "slot_colors": 9, "slot_rotations": 90, "initial_shape": 4, "initial_color": 12, "initial_rotation": 0, "enable_fog": True},
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
        data={"max_energy": 42, "slot_shapes": [5, 0], "slot_colors": [9, 8], "slot_rotations": [90, 90], "initial_shape": 0, "initial_color": 14, "initial_rotation": 0, "enable_fog": True},
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
        data={"max_energy": 42, "slot_shapes": 0, "slot_colors": 8, "slot_rotations": 180, "initial_shape": 1, "initial_color": 12, "initial_rotation": 0, "enable_fog": True},
        name="fij",
    ),
]


class Ws03(ARCBaseGame):
    """WS03 - Fog of War Puzzle Game.
    
    A variant of LS20 with permanent fog of war mechanics. The player must navigate through
    levels collecting energy pickups while solving shape/color/rotation puzzles to unlock keys.
    
    Game Mechanics:
    - Limited visibility radius around the player (fog of war)
    - Energy system: each move consumes energy, running out causes respawn
    - Lives system: 3 lives total, losing all lives ends the game
    - Key matching: player must configure key shape/color/rotation to match lock slots
    - Multiple levels with increasing difficulty
    
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
        """Initialize WS03 game instance.
        
        Args:
            seed: Random seed for procedural generation (default: 0)
        """
        # Initialize energy interface before super().__init__ since on_set_level is called during init
        initial_energy = levels[0].get_data("max_energy") if levels else 0
        energy_value = initial_energy if initial_energy else 0
        self.fog_interface = FogOfWarInterface(self, energy_value)
        
        # Must match ls20's order: opw(0), lyd(1), tmx(2), nio(3), dcb(4), fij(5)
        self.shape_templates = [sprites["opw"], sprites["lyd"], sprites["tmx"], sprites["nio"], sprites["dcb"], sprites["fij"]]
        # Match LS20's color palette order so level data indices work correctly
        # LS20 uses [12, 9, 14, 8] - we keep same values for compatibility
        self.color_palette = [12, 9, 14, 8]
        self.rotation_angles = [0, 90, 180, 270]
        self.fog_enabled = False
        
        super().__init__(
            game_id="ws03",
            levels=levels,
            camera=Camera(0, 0, 16, 16, BACKGROUND_COLOR, PADDING_COLOR, [self.fog_interface]),
            debug=False,
            seed=seed,
            available_actions=[1, 2, 3, 4]
        )
        
        self.reset_energy_interface()
    
    def reset_energy_interface(self) -> None:
        """Reset energy interface based on current level data.
        
        Reads the max_energy value from level data and refills the energy bar.
        """
        max_energy = self.current_level.get_data("max_energy")
        if max_energy:
            self.fog_interface.max_energy = max_energy
            self.fog_interface.refill_energy()

    def _get_rotation_index(self, value) -> int:
        """Convert rotation angle to index in rotation_angles array.
        
        Args:
            value: Rotation angle (0, 90, 180, or 270)
            
        Returns:
            Index in rotation_angles array, or 0 if invalid
        """
        try:
            return self.rotation_angles.index(value)
        except (ValueError, TypeError):
            logging.warning(f"Invalid rotation value {value}, defaulting to 0")
            return 0

    def _get_color_index(self, value) -> int:
        """Convert color value to index in color_palette array.
        
        Args:
            value: Color palette value (12, 9, 14, or 8)
            
        Returns:
            Index in color_palette array, or 0 if invalid
        """
        try:
            return self.color_palette.index(value)
        except (ValueError, TypeError):
            logging.warning(f"Invalid color value {value}, defaulting to 0")
            return 0

    def on_set_level(self, level: Level) -> None:
        """Called when a level is loaded. Initialize level-specific game state.
        
        Sets up:
        - Player and UI sprite references
        - Key slot configurations (shape, color, rotation)
        - Energy and lives
        - Fog of war state
        
        Args:
            level: The level being loaded
        """
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
        # Fog of war always enabled in WS03
        self.fog_enabled = True
        
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
            self.slot_rotations.append(self.rotation_angles.index(slot_rotations_data[slot_index]))
            self.slot_colors.append(self.color_palette.index(slot_colors_data[slot_index]))
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
        """Get all sprites within a rectangular area.
        
        Args:
            x: Left edge of the area
            y: Top edge of the area
            width: Width of the area
            height: Height of the area
            
        Returns:
            List of sprites whose position falls within the specified area
        """
        return [sprite for sprite in self.current_level.get_sprites() if sprite.x >= x and sprite.x < x + width and sprite.y >= y and sprite.y < y + height]

    def step(self) -> None:
        """Main game loop - processes player actions and updates game state.
        
        Handles:
        - Death screen display
        - Key error feedback
        - Movement (ACTION1-4 = up/down/left/right)
        - Collision detection
        - Energy/life management
        - Key matching and collection
        - Win/lose conditions
        """
        if self.showing_death_screen:
            self.death_overlay.set_visible(False)
            self.key_indicator.set_visible(True)
            self.showing_death_screen = False
            self.complete_action()
            return
        if self.showing_key_error:
            self.level_boundary.color_remap(None, 6)
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
                self.fog_interface.set_energy(self.fog_interface.max_energy)
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
        if not collected_energy and not self.fog_interface.consume_energy():
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
            self.fog_interface.set_energy(self.fog_interface.max_energy)
            self.win_indicator.set_visible(False)
            for border in self.current_level.get_sprites_by_tag("slot_border"):
                border.set_visible(False)
            for frame in self.current_level.get_sprites_by_tag("frame"):
                frame.set_visible(True)
            return
        self.complete_action()

    def reset_key_state(self) -> None:
        """Reset the key indicator to its initial configuration for the current level.
        
        Reads initial shape, color, and rotation from level data and applies to key indicator.
        """
        self.current_rotation_index = self.rotation_angles.index(self.current_level.get_data("initial_rotation"))
        self.current_color_index = self.color_palette.index(self.current_level.get_data("initial_color"))
        self.current_shape_index = self.current_level.get_data("initial_shape")
        self.key_indicator.pixels = self.shape_templates[self.current_shape_index].pixels.copy()
        self.key_indicator.color_remap(0, self.color_palette[self.current_color_index])
        self.key_indicator.set_rotation(self.rotation_angles[self.current_rotation_index])

    def update_key_slots(self) -> None:
        """Update visual state of key slots based on current key configuration.
        
        Shows/hides borders around slots that match the current key configuration.
        Controls visibility of the win indicator.
        """
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
        """Check if current key configuration matches a specific slot.
        
        Args:
            slot_index: Index of the slot to check
            
        Returns:
            True if current shape, color, and rotation match the slot's requirements
        """
        return self.current_shape_index == self.slot_shapes[slot_index] and self.current_color_index == self.slot_colors[slot_index] and self.current_rotation_index == self.slot_rotations[slot_index]

    def check_all_keys_collected(self) -> bool:
        """Check if player has collected all keys and update game state.
        
        When player is on a matching slot:
        - Marks key as collected
        - Removes slot and lock sprites
        - Updates visual indicators
        
        Returns:
            True if all keys have been collected (level complete)
        """
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
