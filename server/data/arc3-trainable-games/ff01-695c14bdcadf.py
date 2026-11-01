# Author: Claude Opus 5.5 Medium
# Date: 15-October-2026
# PURPOSE: ff01, a fish game in a sea several screens big. You are a small fish seen through a
#   64x64 window that follows you. Eat fish no bigger than you, grow after a few meals, and keep
#   away from bigger fish, which bite (three lives). Currents run through the sea and carry you and
#   every other fish; on every turn of the tide (shown by the yellow pips top right) each current
#   and each fish takes a new heading, and the yellow pixel on each current's arrows and on each
#   fish shows the heading it takes next. Fish you can eat that are off the window show as small
#   marks in their colour on the window's edge. Later levels have a time bar (bottom HUD row);
#   running it out, or losing the last life, ends the run. Arrows only; nothing to click.
#   Rebuilt from fr01 (one 64x64 screen, five levels) at the Boss's ask, 15-Oct-2026: a bigger
#   world behind the window, directions that keep changing inside a level, finer fish art.
#   Level data below is written by the generator (polish/ff01/ff01_gen.py); never hand-edit it.
# SRP/DRY check: Pass -- one self-contained game file (the site execs it alone); level data is
#   generated elsewhere and pasted between the GENERATED markers.

import math

import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay

# ---------------------------------------------------------------------------
# Screen and palette
# ---------------------------------------------------------------------------
SCREEN = 64
HUD_H = 4                  # rows 0-3 are the HUD; the window onto the sea is below it
VIEW_W, VIEW_H = SCREEN, SCREEN - HUD_H
FLOOR_ROWS = 6             # the sea bed fills the bottom rows of the world

WHITE, MAGENTA, PINK, RED, BLUE, SKY, YELLOW, ORANGE, MAROON, GREEN, PURPLE = 0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
SEA = BLUE
CURRENT_WATER = SKY
FLOW_MARK = WHITE
NEXT_MARK = YELLOW          # "where this goes next", on currents and on fish alike
PLAYER_C = GREEN
TIER_C = {1: ORANGE, 2: PINK, 3: MAGENTA, 4: RED, 5: MAROON}
BED = PURPLE
HUD_BG = PURPLE

UP, RIGHT, DOWN, LEFT = 0, 1, 2, 3
DV = ((0, -1), (1, 0), (0, 1), (-1, 0))

SWIM = 2                   # player pixels per arrow press
FISH_SPEED = 1
BITE_GRACE = 8             # steps of blinking safety after a bite
WIN_FRAMES = 12
DEATH_FRAMES = 6

# ---------------------------------------------------------------------------
# Fish art, facing right. B body, E eye, . water.
# ---------------------------------------------------------------------------
_ART = {
    1: ["B..BBB.",
        ".BBBBEB",
        "B..BBB."],
    2: ["....B....",
        "B..BBBB..",
        ".BBBBBBEB",
        "B..BBBBB.",
        "....B...."],
    3: [".....BB.....",
        "B...BBBBB...",
        "BB.BBBBBBBE.",
        "BBBBBBBBBBBB",
        "B..BBBBBBBB.",
        ".....B......"],
    4: ["......BBB......",
        "B....BBBBBB....",
        "BB..BBBBBBBBB..",
        "BBBBBBBBBBBBEBB",
        "BB..BBBBBBBBBB.",
        "B....BBBBBBB...",
        "......B..B....."],
    5: ["........BBBB.......",
        "B......BBBBBBB.....",
        "BB....BBBBBBBBBB...",
        "BBB..BBBBBBBBBBBB..",
        "BBBBBBBBBBBBBBBEBB.",
        "BBB..BBBBBBBBBBBBBB",
        "BB....BBBBBBBBBBB..",
        "B......BBBBBBBB....",
        "........BB..BB....."],
}
FISH_W = {s: len(a[0]) for s, a in _ART.items()}
FISH_H = {s: len(a) for s, a in _ART.items()}


def _cells(rows, flip):
    out = []
    w = len(rows[0])
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                out.append((w - 1 - x if flip else x, y, ch))
    return tuple(out)


ART_R = {s: _cells(a, False) for s, a in _ART.items()}
ART_L = {s: _cells(a, True) for s, a in _ART.items()}


def _tell_pixel(cells, w, h, d):
    """The body pixel that shows a fish's next heading: its outermost pixel on that side, on the
    middle row (left/right) or the middle column (up/down)."""
    body = [(x, y) for x, y, _ in cells]
    if d in (LEFT, RIGHT):
        row = [p for p in body if p[1] == h // 2] or body
        return min(row) if d == LEFT else max(row)
    col = [p for p in body if p[0] == w // 2] or body
    return min(col, key=lambda p: p[1]) if d == UP else max(col, key=lambda p: p[1])


TELL = {(s, facing, d): _tell_pixel(ART_R[s] if facing else ART_L[s], FISH_W[s], FISH_H[s], d)
        for s in _ART for facing in (True, False) for d in range(4)}

LIFE_ICON = ((0, 0), (2, 0), (3, 0), (1, 1), (2, 1), (3, 1))

# ---------------------------------------------------------------------------
# Levels. Each: world w,h; player start and size; meals to grow at; meals to clear; lives;
# tide period; time budget (0 = none); currents [x, y, w, h, strength, headings];
# fish [x, y, size, headings]. Headings: 0 up, 1 right, 2 down, 3 left, one per tide.
# ---------------------------------------------------------------------------
# <<<GENERATED
LEVEL_DATA = [
    {"w": 128, "h": 60, "player": [6, 28], "size": 1, "grow": [], "eat": 2, "lives": 3, "period": 8, "budget": 0, "zones": [[0, 16, 88, 24, 3, [1, 3]]], "fish": [[21, 27, 1, [1, 2, 3]], [8, 4, 1, [3, 1]], [37, 32, 1, [3, 2]], [21, 12, 1, [0, 3]], [29, 39, 1, [1, 0]]]},
    {"w": 192, "h": 60, "player": [6, 28], "size": 1, "grow": [3], "eat": 5, "lives": 3, "period": 8, "budget": 107, "zones": [[0, 16, 160, 16, 3, [3, 1]], [56, 32, 128, 16, 3, [3, 1]]], "fish": [[138, 4, 1, [3, 2, 1]], [22, 11, 1, [1, 0, 2, 0]], [169, 31, 1, [1, 3]], [91, 48, 1, [3, 1, 3, 0]], [152, 11, 1, [1, 2, 0]], [35, 11, 2, [0, 1, 0, 3]], [178, 35, 2, [2, 3, 1]], [108, 44, 1, [2, 1]], [62, 40, 4, [0, 3, 1]]]},
    {"w": 128, "h": 120, "player": [6, 58], "size": 1, "grow": [3], "eat": 6, "lives": 3, "period": 7, "budget": 91, "zones": [[0, 8, 16, 56, 4, [2, 0]], [32, 8, 64, 16, 4, [1, 3, 1, 3]], [56, 48, 64, 16, 4, [0, 2, 3]]], "fish": [[32, 76, 1, [2, 1, 3, 0]], [115, 37, 1, [3, 0, 3, 2]], [119, 59, 1, [3, 1, 3, 1]], [51, 20, 1, [0, 2]], [12, 73, 2, [1, 3, 0]], [106, 40, 1, [0, 1]], [101, 62, 1, [3, 1, 0]], [48, 6, 2, [2, 0, 2, 0]], [37, 84, 1, [1, 3]], [103, 14, 3, [2, 0]], [84, 68, 3, [0, 3, 1, 3]]]},
    {"w": 192, "h": 120, "player": [6, 58], "size": 2, "grow": [3, 7], "eat": 8, "lives": 3, "period": 7, "budget": 170, "zones": [[0, 48, 88, 24, 3, [1, 3]], [96, 16, 16, 96, 2, [1, 2]], [136, 8, 24, 104, 2, [3, 0]]], "fish": [[52, 36, 1, [0, 2]], [80, 70, 1, [0, 2]], [37, 55, 2, [1, 3, 1, 3]], [108, 23, 1, [0, 1, 2]], [129, 105, 4, [1, 3, 2, 3]], [72, 21, 4, [1, 3, 0, 3]], [80, 63, 2, [1, 3, 1, 3]], [27, 39, 4, [3, 2, 3, 1]], [110, 9, 4, [1, 0, 1, 2]], [114, 102, 3, [2, 0]], [53, 21, 3, [1, 2, 3]], [156, 66, 5, [1, 2]], [78, 36, 5, [2, 0, 3]]]},
    {"w": 256, "h": 60, "player": [6, 28], "size": 2, "grow": [4], "eat": 8, "lives": 3, "period": 6, "budget": 135, "zones": [[0, 8, 16, 40, 4, [0, 2, 1, 2]], [24, 16, 120, 16, 3, [3, 1, 2]], [160, 8, 64, 16, 4, [3, 1, 3, 1]], [72, 32, 120, 16, 3, [1, 0]]], "fish": [[77, 15, 2, [1, 2, 3]], [168, 25, 2, [2, 1, 3]], [190, 22, 2, [1, 3, 0]], [225, 29, 1, [1, 3]], [109, 39, 2, [1, 3, 0]], [62, 13, 2, [1, 3, 1, 3]], [162, 34, 3, [0, 2, 0, 1]], [205, 16, 2, [1, 3, 0]], [236, 24, 3, [3, 2, 1]], [96, 48, 3, [3, 1, 0, 1]], [234, 12, 5, [1, 3]], [55, 47, 4, [1, 3, 2]], [57, 2, 4, [3, 0, 1]]]},
    {"w": 192, "h": 180, "player": [6, 88], "size": 2, "grow": [3, 7], "eat": 9, "lives": 3, "period": 7, "budget": 154, "zones": [[0, 80, 72, 24, 4, [1, 2, 1, 3]], [24, 40, 72, 16, 2, [1, 0]], [64, 56, 120, 16, 4, [1, 3, 0]], [0, 8, 104, 24, 3, [0, 3, 2]]], "fish": [[125, 41, 1, [3, 1, 3, 1]], [148, 31, 1, [3, 2]], [66, 88, 1, [0, 1]], [89, 156, 2, [3, 2, 0]], [104, 21, 4, [1, 3, 2]], [127, 54, 4, [2, 3]], [156, 37, 3, [3, 1, 3, 2]], [52, 89, 2, [3, 1, 3, 1]], [94, 164, 3, [0, 2, 0, 2]], [123, 21, 2, [0, 3]], [139, 45, 2, [3, 1]], [149, 3, 5, [1, 3]], [24, 21, 5, [0, 1, 2]], [150, 128, 5, [3, 2, 0]]]},
    {"w": 256, "h": 120, "player": [6, 58], "size": 3, "grow": [4, 8], "eat": 10, "lives": 3, "period": 6, "budget": 168, "zones": [[0, 8, 24, 64, 3, [0, 3, 2]], [24, 64, 152, 16, 3, [1, 3, 1, 3]], [176, 80, 80, 24, 3, [3, 0]], [32, 24, 64, 24, 4, [2, 0, 3, 1]], [136, 16, 64, 16, 3, [1, 3]]], "fish": [[113, 49, 2, [3, 0]], [202, 97, 3, [1, 2, 0, 2]], [34, 34, 3, [2, 1, 3, 1]], [143, 20, 3, [3, 2, 1]], [103, 85, 3, [2, 3, 0, 1]], [216, 52, 4, [1, 3]], [89, 53, 5, [3, 2, 3, 1]], [219, 88, 3, [1, 2, 1, 3]], [41, 42, 4, [3, 1, 2]], [158, 27, 4, [3, 2, 3, 0]], [108, 93, 3, [1, 0, 3]], [220, 37, 5, [3, 1]], [91, 40, 4, [1, 3, 1, 3]], [118, 57, 4, [0, 2, 1]], [169, 12, 4, [0, 1]], [189, 68, 4, [1, 3]]]},
    {"w": 256, "h": 180, "player": [6, 88], "size": 3, "grow": [4, 8], "eat": 11, "lives": 3, "period": 6, "budget": 195, "zones": [[0, 80, 120, 24, 3, [1, 3, 2, 0]], [216, 72, 16, 64, 3, [1, 2, 0]], [48, 56, 112, 16, 3, [3, 1]], [88, 136, 88, 16, 2, [3, 1]], [72, 40, 152, 16, 3, [3, 1]], [32, 152, 104, 16, 4, [1, 3, 1, 3]]], "fish": [[120, 151, 2, [0, 2]], [39, 141, 3, [2, 0, 1]], [46, 38, 3, [2, 3, 1]], [188, 112, 3, [1, 0, 1, 3]], [54, 53, 3, [1, 0]], [104, 64, 5, [3, 0]], [106, 165, 4, [2, 0, 3]], [41, 156, 4, [2, 0, 1]], [49, 30, 3, [2, 3, 0, 1]], [192, 103, 3, [2, 1]], [74, 65, 5, [3, 1, 2]], [80, 77, 5, [1, 2]], [99, 157, 3, [2, 3, 1]], [159, 126, 4, [1, 0, 1, 3]], [190, 75, 4, [0, 1, 2]], [204, 94, 4, [3, 2, 1]], [116, 127, 4, [1, 3, 2, 3]]]},
]
# GENERATED>>>

levels = [Level(sprites=[], grid_size=(SCREEN, SCREEN), name=f"ff01-{i + 1}", data={"i": i})
          for i in range(len(LEVEL_DATA))]


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------
class SeaView(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        g = self.game
        cx, cy = g.camera_xy()
        view = np.full((VIEW_H, VIEW_W), SEA, dtype=np.int8)

        def put(wx, wy, c):
            sx, sy = wx - cx, wy - cy
            if 0 <= sx < VIEW_W and 0 <= sy < VIEW_H:
                view[sy, sx] = c

        # surface: white crests drifting along the top row of the world
        if cy == 0:
            for x in range(VIEW_W):
                if (x + cx + g.step_count // 2) % 7 < 3:
                    view[0, x] = WHITE

        # currents: lighter water with corners cut, then the flow marks
        for zi, (zx, zy, zw, zh, st, heads) in enumerate(g.zones):
            x0, y0 = max(zx, cx), max(zy, cy)
            x1, y1 = min(zx + zw, cx + VIEW_W), min(zy + zh, cy + VIEW_H)
            if x0 >= x1 or y0 >= y1:
                continue
            view[y0 - cy:y1 - cy, x0 - cx:x1 - cx] = CURRENT_WATER
            for kx, ky in ((zx, zy), (zx + zw - 1, zy), (zx, zy + zh - 1), (zx + zw - 1, zy + zh - 1)):
                put(kx, ky, SEA)
            now, nxt = g.zone_heading(zi), g.zone_heading(zi, 1)
            ox, oy = g.zone_drift[zi]
            # zones are whole multiples of 8 cells, so the lattice wraps without bunching
            for ly in range(4, zh, 8):
                for lx in range(4 if (ly // 8) % 2 else 0, zw, 8):
                    mx = zx + (lx + ox) % zw
                    my = zy + (ly + oy) % zh
                    self._flow_mark(put, mx, my, now, nxt, zx, zy, zw, zh)

        # sea bed, kelp and rocks, all one purple
        for x in range(max(0, cx), min(g.w, cx + VIEW_W)):
            top = g.h - g.bed[x]
            for y in range(max(top, cy), min(g.h, cy + VIEW_H)):
                view[y - cy, x - cx] = BED
        for kx, kh in g.kelp:              # kelp: a swaying stem with leaves on alternate sides
            sway = 1 if (g.step_count // 3 + kx) % 4 < 2 else 0
            base = g.h - g.bed[kx]
            for k in range(kh):
                sx = kx + (sway if k > kh // 2 else 0)
                put(sx, base - 1 - k, BED)
                if k >= 2 and k % 2 == 0:
                    put(sx + (1 if (k // 2) % 2 else -1), base - 1 - k, BED)
        # bubble streams rising from vents in the bed: landmarks in open water
        for vx in g.vents:
            base = g.h - g.bed[vx]
            put(vx - 1, base - 1, BED)
            put(vx, base - 1, BED)
            put(vx + 1, base - 1, BED)
            for j in range(0, g.h, 11):
                by = base - 3 - (g.step_count * 2 + j) % max(1, base - 4)
                bx = vx + (1 if (by // 4) % 2 else 0)
                if g._zone_at_point(bx, by) < 0:
                    put(bx, by, WHITE)

        # fish
        for f in g.fish:
            if f[3]:
                self._fish(put, f[0], f[1], f[2], f[4], TIER_C[f[2]], g.fish_heading(f, 1))
        if g.dying:
            self._burst(put, g.px + FISH_W[g.size] // 2, g.py + FISH_H[g.size] // 2, 2 + g.dying)
        elif g.winning:
            # the level-clear dance: the fish spins as it rises and flashes, in a shower of bubbles
            t = g.winning
            spin = g.facing if (t // 2) % 2 == 0 else not g.facing
            self._fish(put, g.px, g.py - t, g.size, spin, WHITE if t % 4 >= 2 else PLAYER_C, None)
        elif not (g.grace > 0 and g.step_count % 2 == 1):
            self._fish(put, g.px, g.py, g.size, g.facing, PLAYER_C, None)

        # bubbles where something was eaten, and the win shower
        for bx, by, r in g.bursts:
            self._burst(put, bx, by, r)
        if g.winning:
            t = g.winning
            ccx, ccy = g.px + FISH_W[g.size] // 2, g.py - t + FISH_H[g.size] // 2
            self._burst(put, ccx, ccy, 2 + t * 3)
            for j in range(0, VIEW_W, 4):
                for k in range(2):
                    by = VIEW_H - 1 - (t * 6 + j * 7 + k * 31) % VIEW_H
                    if (by + j) % 3:
                        view[by, (j + (by // 3) % 2) % VIEW_W] = WHITE

        # fish you can eat that are off the window: a 2x2 mark in their colour on the window's
        # edge, on the line towards them, so the food in a sea bigger than the screen can be found
        if not g.winning and not g.dying:
            for f in g.fish:
                if not f[3] or f[2] > g.size:
                    continue
                fx, fy = f[0] + FISH_W[f[2]] // 2 - cx, f[1] + FISH_H[f[2]] // 2 - cy
                if 0 <= fx < VIEW_W and 0 <= fy < VIEW_H:
                    continue
                mx, my = max(0, min(VIEW_W - 2, fx)), max(0, min(VIEW_H - 2, fy))
                view[my:my + 2, mx:mx + 2] = TIER_C[f[2]]

        frame[HUD_H:, :] = view
        self._hud(frame)
        return frame

    @staticmethod
    def _flow_mark(put, mx, my, now, nxt, zx, zy, zw, zh):
        """A chevron pointing the way the water runs now. Its yellow pixel sits two cells from the
        chevron's centre on the side the water runs next: a yellow tip means "same again", a
        yellow dot behind it means "turning back", a yellow arm end means "turning that way"."""
        dx, dy = DV[now]
        px, py = -dy, dx
        pts = [(mx + 2 * dx, my + 2 * dy), (mx + dx + px, my + dy + py), (mx + dx - px, my + dy - py),
               (mx + 2 * px, my + 2 * py), (mx - 2 * px, my - 2 * py)]
        nx, ny = DV[nxt]
        tell = (mx + 2 * nx, my + 2 * ny)
        for x, y in pts:
            if zx <= x < zx + zw and zy <= y < zy + zh and (x, y) != tell:
                put(x, y, FLOW_MARK)
        put(tell[0], tell[1], NEXT_MARK)

    @staticmethod
    def _fish(put, x, y, size, facing, colour, nxt):
        cells = ART_R[size] if facing else ART_L[size]
        for cx_, cy_, ch in cells:
            put(x + cx_, y + cy_, WHITE if ch == 'E' else colour)
        if nxt is not None:
            tx, ty = TELL[(size, facing, nxt)]
            put(x + tx, y + ty, NEXT_MARK)

    @staticmethod
    def _burst(put, cx, cy, r):
        for k in range(8):
            a = k * math.pi / 4
            put(int(round(cx + r * math.cos(a))), int(round(cy + r * math.sin(a))), WHITE)

    def _hud(self, frame):
        g = self.game
        frame[0:HUD_H, :] = HUD_BG
        for i in range(g.lives):
            for ix, iy in LIFE_ICON:
                frame[1 + iy, 1 + i * 5 + ix] = PLAYER_C
        # meals: one pip per meal needed, white once eaten
        for i in range(g.eat):
            frame[1:3, 17 + i * 2] = WHITE if i < g.eaten else SEA
        # the tide: one yellow pip per step left before every heading changes
        left = g.period - g.step_count % g.period
        for i in range(left):
            frame[1:3, 62 - i * 2] = NEXT_MARK
        # time bar, shrinking from the right
        if g.budget:
            n = int(math.ceil(SCREEN * g.moves_left / g.budget))
            frame[3, :n] = WHITE


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------
class Ff01(ARCBaseGame):
    def __init__(self):
        self.display = SeaView(self)
        self._load_level(0)
        super().__init__('ff01', levels, Camera(0, 0, SCREEN, SCREEN, SEA, SEA, [self.display]),
                         False, len(levels), [1, 2, 3, 4])

    # -- level setup --------------------------------------------------------
    def on_set_level(self, level):
        self._load_level(self.level_index)

    def _load_level(self, i):
        d = LEVEL_DATA[i]
        self.w, self.h = d["w"], d["h"]
        self.px, self.py = d["player"]
        self.size = d["size"]
        self.grow = list(d["grow"])
        self.eat = d["eat"]
        self.lives = d["lives"]
        self.period = d["period"]
        self.budget = d["budget"]
        self.moves_left = d["budget"]
        self.zones = [tuple(z[:5]) + (tuple(z[5]),) for z in d["zones"]]
        self.zone_drift = [[0, 0] for _ in self.zones]
        # fish: [x, y, size, alive, facing_right, headings]
        self.fish = [[f[0], f[1], f[2], True, f[3][0] != LEFT, tuple(f[3])] for f in d["fish"]]
        self.facing = True
        self.eaten = 0
        self.grace = 0
        self.step_count = 0
        self.bursts = []
        self.winning = 0
        self.dying = 0
        # scenery from a fixed formula of the level number, so it is identical every time
        self.bed = [3 + int(1.5 + 1.5 * math.sin(x / 9.0 + i) + math.sin(x / 23.0 + 2 * i))
                    for x in range(self.w)]
        self.kelp = [(x, 6 + (x * 7 + i * 3) % 7) for x in range(9 + i * 5 % 13, self.w - 2, 23 + i % 3 * 4)]
        self.vents = [x for x in range(30 + i * 7 % 20, self.w - 6, 64)]

    # -- queries the drawing and the generator share ------------------------
    def camera_xy(self):
        cx = self.px + FISH_W[self.size] // 2 - VIEW_W // 2
        cy = self.py + FISH_H[self.size] // 2 - VIEW_H // 2
        return max(0, min(self.w - VIEW_W, cx)), max(0, min(self.h - VIEW_H, cy))

    def tide(self, ahead=0):
        return self.step_count // self.period + ahead

    def zone_heading(self, zi, ahead=0):
        heads = self.zones[zi][5]
        return heads[self.tide(ahead) % len(heads)]

    def fish_heading(self, f, ahead=0):
        return f[5][self.tide(ahead) % len(f[5])]

    def _zone_at(self, x, y, size):
        """The current carrying a body whose top-left is (x, y): the first zone holding its centre."""
        cx, cy = x + FISH_W[size] // 2, y + FISH_H[size] // 2
        for zi, (zx, zy, zw, zh, st, heads) in enumerate(self.zones):
            if zx <= cx < zx + zw and zy <= cy < zy + zh:
                return zi
        return -1

    def _zone_at_point(self, x, y):
        for zi, (zx, zy, zw, zh, st, heads) in enumerate(self.zones):
            if zx <= x < zx + zw and zy <= y < zy + zh:
                return zi
        return -1

    def _clamp(self, x, y, size):
        return (max(0, min(self.w - FISH_W[size], x)),
                max(2, min(self.h - FLOOR_ROWS - FISH_H[size], y)))

    def _carry(self, x, y, size):
        zi = self._zone_at(x, y, size)
        if zi < 0:
            return x, y
        dx, dy = DV[self.zone_heading(zi)]
        st = self.zones[zi][4]
        return self._clamp(x + dx * st, y + dy * st, size)

    @staticmethod
    def _touch(ax, ay, asz, bx, by, bsz):
        return ax < bx + FISH_W[bsz] and ax + FISH_W[asz] > bx and ay < by + FISH_H[bsz] and ay + FISH_H[asz] > by

    def _eat(self):
        for f in self.fish:
            if f[3] and f[2] <= self.size and self._touch(self.px, self.py, self.size, f[0], f[1], f[2]):
                f[3] = False
                self.eaten += 1
                self.bursts.append([f[0] + FISH_W[f[2]] // 2, f[1] + FISH_H[f[2]] // 2, 2])
                if self.grow and self.eaten >= self.grow[0]:
                    self.grow.pop(0)
                    self.size += 1
                    self.px, self.py = self._clamp(self.px, self.py, self.size)
                    self.bursts.append([self.px + FISH_W[self.size] // 2, self.py + FISH_H[self.size] // 2, 3])
        return self.eaten >= self.eat

    # -- one action ---------------------------------------------------------
    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if self.winning:                     # the level-clear animation, one frame per call
            self.winning += 1
            self.bursts = [[x, y, r + 2] for x, y, r in self.bursts if r < 6]
            if self.winning > WIN_FRAMES:
                self.winning = 0
                self.next_level()
                self.complete_action()
            return
        if self.dying:                       # the last bite: the fish breaks into bubbles
            self.dying += 1
            if self.dying > DEATH_FRAMES:
                self.lose()
                self.complete_action()
            return
        self.bursts = [[x, y, r + 2] for x, y, r in self.bursts if r < 6]
        aid = self.action.id.value

        # 1. you swim, then the current you are in carries you
        if aid in (1, 2, 3, 4):
            d = (UP, DOWN, LEFT, RIGHT)[aid - 1]
            if d == LEFT:
                self.facing = False
            elif d == RIGHT:
                self.facing = True
            self.px, self.py = self._clamp(self.px + DV[d][0] * SWIM, self.py + DV[d][1] * SWIM, self.size)
        self.px, self.py = self._carry(self.px, self.py, self.size)
        if self._eat():
            return self._start_win()

        # 2. every other fish swims its heading for this tide, then its current carries it
        for f in self.fish:
            if not f[3]:
                continue
            h = self.fish_heading(f)
            if h == LEFT:
                f[4] = False
            elif h == RIGHT:
                f[4] = True
            x, y = self._clamp(f[0] + DV[h][0] * FISH_SPEED, f[1] + DV[h][1] * FISH_SPEED, f[2])
            f[0], f[1] = self._carry(x, y, f[2])
        for zi in range(len(self.zones)):
            dx, dy = DV[self.zone_heading(zi)]
            st = self.zones[zi][4]
            self.zone_drift[zi][0] = (self.zone_drift[zi][0] + dx * st) % 64
            self.zone_drift[zi][1] = (self.zone_drift[zi][1] + dy * st) % 64
        self.step_count += 1
        if self._eat():
            return self._start_win()

        # 3. bigger fish bite
        if self.grace > 0:
            self.grace -= 1
        else:
            for f in self.fish:
                if f[3] and f[2] > self.size and self._touch(self.px, self.py, self.size, f[0], f[1], f[2]):
                    self.lives -= 1
                    self.grace = BITE_GRACE
                    break
        if self.budget:
            self.moves_left -= 1
        if self.lives <= 0 or (self.budget and self.moves_left <= 0):
            self.lives = max(0, self.lives)
            self.dying = 1
            return
        self.complete_action()

    def _start_win(self):
        self.winning = 1
