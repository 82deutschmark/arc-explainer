import json
import os
import sys
import numpy as np
from pathlib import Path
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

IMG_W, IMG_H = 30, 62

# Resolve data directory: __file__ isn't set when loaded via exec(),
# so fall back to searching environment_files for this game's directory.
def _resolve_data_dir() -> Path:
    try:
        return Path(__file__).parent
    except NameError:
        # Loaded via exec() — find the directory from environment_files
        candidates = sorted(Path("environment_files/fd").glob("*/fd.py"))
        if candidates:
            return candidates[0].parent
        return Path(".")

_DATA_DIR = _resolve_data_dir()
CUSTOM_SCENES_FILE = _DATA_DIR / "custom_scenes.json"
CUSTOM_DIFFS_FILE  = _DATA_DIR / "custom_diffs.json"


def _load_custom_scenes() -> dict:
    try:
        if CUSTOM_SCENES_FILE.exists():
            return json.loads(CUSTOM_SCENES_FILE.read_text())
    except Exception:
        pass
    return {}


def _load_custom_diffs() -> dict:
    try:
        if CUSTOM_DIFFS_FILE.exists():
            return json.loads(CUSTOM_DIFFS_FILE.read_text())
    except Exception:
        pass
    return {}


DIV_START, RIGHT_START = 30, 34
HEADER_H = 2


def draw_house(img):
    img[:, :] = 9        # sky (blue)
    img[42:, :] = 2      # ground (green)
    img[28:42, 8:22] = 4 # house (yellow)
    img[22:28, 10:20] = 2 # roof (green)
    img[24:28, 12:18] = 7 # roof accent (orange)
    img[30:38, 12:16] = 0 # window left (black)
    img[30:38, 16:20] = 0 # window right (black)
    img[35:42, 14:18] = 6 # door (magenta)
    img[28:42, 23:27] = 3 # tree trunk (dark)
    img[20:30, 21:29] = 2 # tree leaves (green)
    img[2:6, 24:28] = 11  # sun (yellow)


def draw_ocean(img):
    img[:, :] = 9        # water (blue)
    img[50:, :] = 11     # sandy bottom (yellow)
    img[55:, :] = 4      # deep sand (orange-ish yellow4)
    img[30:38, 5:14] = 12 # fish 1 (red)
    img[32:36, 14:16] = 12
    img[20:28, 18:27] = 6 # fish 2 (magenta)
    img[22:26, 27:29] = 6
    img[45:55, 3:6] = 2  # seaweed (green)
    img[40:55, 8:11] = 2
    img[48:58, 22:25] = 14 # coral (lime)
    img[50:60, 15:18] = 14
    img[15:18, 10:12] = 0 # bubbles (black dots)
    img[10:13, 20:22] = 0


def draw_space(img):
    img[:, :] = 0        # black sky
    for sy, sx in [(5,5),(8,25),(12,15),(3,20),(18,8),(6,28),(15,2),(20,27)]:
        img[sy:sy+1, sx:sx+1] = 15  # stars (white)
    img[25:40, 10:25] = 8  # planet (azure)
    img[28:37, 13:22] = 9  # planet surface
    img[24:26, 5:30] = 3   # planet ring
    img[5:20, 22:27] = 5   # rocket body (gray)
    img[3:5, 23:26] = 12   # rocket tip (red)
    img[20:23, 21:23] = 7  # rocket flame left (orange)
    img[20:23, 25:27] = 7  # rocket flame right
    img[45:55, 2:14] = 15  # moon (white)
    img[47:53, 4:12] = 3   # moon shadow (dark gray)


def draw_forest(img):
    img[:, :] = 9        # sky (blue)
    img[45:, :] = 2      # ground (green)
    img[25:45, 2:8] = 3  # tree trunk 1
    img[10:26, 0:12] = 2 # tree 1 canopy
    img[28:45, 20:26] = 3 # tree trunk 2
    img[12:29, 17:29] = 2 # tree 2 canopy
    img[38:45, 14:17] = 7  # mushroom stem (orange)
    img[34:39, 12:20] = 12 # mushroom cap (red)
    img[42:45, 10:13] = 11 # flower 1 (yellow)
    img[42:45, 25:28] = 14 # flower 2 (lime)
    img[48:62, 6:20] = 9  # river (blue)
    img[2:5, 20:26] = 11  # sun (yellow)


def draw_city(img):
    img[:, :] = 9        # sky (blue)
    img[50:, :] = 3      # road (dark gray)
    img[25:50, 2:14] = 3  # building 1 (dark gray)
    img[15:50, 16:28] = 3  # building 2 (dark gray)
    for wy in range(27, 49, 6):
        img[wy:wy+4, 4:7] = 11   # windows b1 (yellow)
        img[wy:wy+4, 9:12] = 11
    for wy in range(17, 49, 6):
        img[wy:wy+4, 18:21] = 11 # windows b2 (yellow)
        img[wy:wy+4, 23:26] = 11
    img[53:60, 3:12] = 12  # car (red)
    img[54:58, 12:14] = 12
    img[4:10, 5:15] = 15   # cloud 1 (white)
    img[3:8, 20:28] = 15   # cloud 2 (white)


SCENES = [draw_house, draw_ocean, draw_space, draw_forest, draw_city]

# Built-in diffs in old (dx, dy, rc, side) format — converted to rect on load
DIFFS = [
    [(20, 5, 8, 'R'), (10, 55, 14, 'L'), (10, 29, 11, 'R'), (14, 34, 3, 'L'), (15, 40, 12, 'R')],
    [(5, 10, 8, 'R'), (20, 52, 7, 'L'), (8, 57, 11, 'R'), (8, 33, 6, 'L'), (22, 24, 12, 'R'), (9, 47, 14, 'L')],
    [(5, 3, 3, 'R'), (11, 30, 9, 'L'), (17, 32, 8, 'R'), (20, 24, 0, 'L'), (26, 21, 4, 'R'), (2, 50, 5, 'L'), (24, 4, 6, 'R')],
    [(5, 30, 0, 'R'), (26, 43, 2, 'L'), (22, 3, 4, 'R'), (15, 36, 6, 'L'), (11, 43, 7, 'R'), (25, 8, 8, 'L'), (15, 41, 11, 'R'), (5, 18, 14, 'L')],
    [(5, 12, 8, 'R'), (28, 10, 8, 'L'), (22, 5, 5, 'R'), (8, 30, 0, 'L'), (20, 35, 0, 'R'), (25, 20, 5, 'L'), (4, 27, 4, 'R'), (19, 29, 7, 'L'), (7, 56, 6, 'R')],
]


def _builtin_to_rect(d):
    """Convert built-in (dx,dy,rc,side) → {x,y,w,h,color,side} dict."""
    dx, dy, rc, side = d[0], d[1], d[2], d[3]
    return {"x": dx - 1, "y": dy - 1, "w": 4, "h": 4, "color": rc, "side": side}


levels = [
    Level(sprites=[], grid_size=(64, 64), data={"i": i}, name=f"Level {i+1}")
    for i in range(5)
]


class FdDisplay(RenderableUserDisplay):
    def __init__(self, game: "Fd01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        # Left panel
        frame[HEADER_H:, :IMG_W] = g.base_img
        # Blue divider
        frame[HEADER_H:, DIV_START:RIGHT_START] = 9
        # Right panel
        frame[HEADER_H:, RIGHT_START:RIGHT_START + IMG_W] = g.base_img

        # Apply diffs (each diff is a {x,y,w,h,color,side} dict)
        for d in g.diffs:
            x, y, w, h, rc, side = d["x"], d["y"], d["w"], d["h"], d["color"], d["side"]
            r0 = HEADER_H + max(0, y)
            r1 = HEADER_H + min(IMG_H, y + h)
            c0 = max(0, x)
            c1 = min(IMG_W, x + w)
            if side == 'L':
                frame[r0:r1, c0:c1] = rc
            else:
                frame[r0:r1, RIGHT_START + c0:RIGHT_START + c1] = rc

        # Green outlines for found diffs
        for i, d in enumerate(g.diffs):
            if g.found[i]:
                x, y, w, h = d["x"], d["y"], d["w"], d["h"]
                for px_off in [0, RIGHT_START]:
                    c0 = max(0, px_off + x - 1)
                    c1 = min(63, px_off + x + w)
                    r0 = max(HEADER_H, HEADER_H + y - 1)
                    r1 = min(64, HEADER_H + y + h + 1)
                    # top / bottom border
                    tr = max(HEADER_H, HEADER_H + y - 1)
                    br = min(63, HEADER_H + y + h)
                    frame[tr, c0:c1] = 14
                    frame[br, c0:c1] = 14
                    # left / right border
                    lc = max(0, px_off + x - 1)
                    rc2 = min(63, px_off + x + w)
                    frame[r0:r1, lc]  = 14
                    frame[r0:r1, rc2] = 14

        # Progress bar
        n = len(g.diffs)
        spacing = 64 // n
        width = max(2, spacing - 2)
        for seg in range(n):
            color = 11 if g.found[seg] else 3
            c0 = seg * spacing
            c1 = min(64, c0 + width)
            frame[0:2, c0:c1] = color
        return frame


class Fd01(ARCBaseGame):
    def __init__(self):
        self.display = FdDisplay(self)
        self.base_img = np.zeros((IMG_H, IMG_W), dtype=np.int16)
        self.diffs = [_builtin_to_rect(d) for d in DIFFS[0]]
        self.found = [False] * len(self.diffs)
        super().__init__(
            "fd",
            levels,
            Camera(0, 0, 64, 64, 0, 0, [self.display]),
            False,
            1,
            [6],
        )

    def on_set_level(self, level: Level) -> None:
        i = self.level_index
        self.base_img = np.zeros((IMG_H, IMG_W), dtype=np.int16)
        custom = _load_custom_scenes()
        if str(i) in custom:
            self.base_img[:] = np.array(custom[str(i)], dtype=np.int16)
        else:
            SCENES[i](self.base_img)

        custom_d = _load_custom_diffs()
        if str(i) in custom_d:
            self.diffs = custom_d[str(i)]
        else:
            self.diffs = [_builtin_to_rect(d) for d in DIFFS[i]]
        self.found = [False] * len(self.diffs)

    def step(self) -> None:
        if self.action.id.value == 6:
            cx = self.action.data.get("x", 0)
            cy = self.action.data.get("y", 0)
            iy = cy - HEADER_H
            if cy >= HEADER_H and iy < IMG_H:
                if cx < IMG_W:
                    ix = cx
                elif RIGHT_START <= cx < RIGHT_START + IMG_W:
                    ix = cx - RIGHT_START
                else:
                    self.complete_action()
                    return
                for i, d in enumerate(self.diffs):
                    if not self.found[i]:
                        if d["x"] <= ix < d["x"] + d["w"] and d["y"] <= iy < d["y"] + d["h"]:
                            self.found[i] = True
                            break
                if all(self.found):
                    self.next_level()
        self.complete_action()
