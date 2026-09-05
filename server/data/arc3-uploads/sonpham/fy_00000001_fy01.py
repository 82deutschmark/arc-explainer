import random

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# Grid dimensions (64x64, rendered directly — no upscaling)
GW, GH = 64, 64
GROUND_TOP = 54   # y row where ground begins
PLANE_X = 10      # fixed horizontal position of the plane
PLANE_W = 6       # plane sprite width
PLANE_H = 3       # plane sprite height

# ARC-AGI-3 color indices used
# 0=black  1=dark-blue  2=green   3=dark-gray  4=yellow   5=gray
# 6=pink   7=orange     8=azure   9=blue       10=maroon  11=bright-yellow
# 12=red   13=teal      14=lime   15=white

DIRT_C     = 3   # obstacle / rock / dirt
EDGE_C     = 5   # lighter edge on obstacle
CLOUD_C    = 15  # cloud white
LIFE_C     = 12  # lives indicator (red)
PROGRESS_C = 11  # progress bar (bright yellow)

# Plane pixel art — row × col, -1 = transparent
PLANE_PIX = [
    [-1, -1, -1,  9,  9, -1],   # cockpit top (blue)
    [ 8,  8, 15, 15, -1, -1],   # wing + fuselage (azure + white)
    [ 8, 15, 15, 15,  7, -1],   # wing lower + fuselage + exhaust (orange)
]


# ---------------------------------------------------------------------------
# Level data helpers
# ---------------------------------------------------------------------------

def _gen_obstacles(seed, count, gap_h, first_x, spacing):
    """Return list of (world_x, gap_top, gap_height) tuples."""
    rng = random.Random(seed)
    margin = 8
    lo = margin
    hi = GROUND_TOP - gap_h - margin
    return [
        (first_x + i * spacing, rng.randint(lo, hi), gap_h)
        for i in range(count)
    ]


def _gen_clouds(seed, count, world_len):
    rng = random.Random(seed + 99)
    return [(rng.randint(0, world_len), rng.randint(4, 22)) for _ in range(count)]


_L = [
    {
        "name":    "Morning Flight",
        "sky":     9,    # blue sky
        "ground":  2,    # green ground
        "obs":     _gen_obstacles(1, 10, 18, 90, 50),
        "scroll":  3,
        "length":  600,
        "clouds":  _gen_clouds(1, 10, 600),
    },
    {
        "name":    "Canyon Pass",
        "sky":     8,    # azure dusk sky
        "ground":  7,    # orange earth
        "obs":     _gen_obstacles(2, 14, 14, 80, 42),
        "scroll":  4,
        "length":  720,
        "clouds":  _gen_clouds(2, 7, 720),
    },
    {
        "name":    "Night Storm",
        "sky":     0,    # black night sky
        "ground":  3,    # dark ground
        "obs":     _gen_obstacles(3, 18, 11, 70, 36),
        "scroll":  5,
        "length":  860,
        "clouds":  _gen_clouds(3, 5, 860),
    },
]

levels = [
    Level(sprites=[], grid_size=(GW, GH), name=d["name"], data=d)
    for d in _L
]


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

class FlyDisplay(RenderableUserDisplay):
    def __init__(self, game: "Fy01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game

        # ── Sky ──────────────────────────────────────────────────────────────
        frame[:GROUND_TOP, :] = g.sky_c

        # ── Ground ───────────────────────────────────────────────────────────
        frame[GROUND_TOP:GROUND_TOP + 4, :] = g.ground_c   # grass/surface
        frame[GROUND_TOP + 4:, :]           = DIRT_C        # dirt below

        # ── Stars (night sky only) ───────────────────────────────────────────
        if g.sky_c == 0:
            for (sx, sy) in g.stars:
                sx_screen = (sx - g.scroll_x) % (g.world_length + GW)
                if 0 <= sx_screen < GW and 0 <= sy < GROUND_TOP:
                    frame[sy, sx_screen] = 15

        # ── Clouds (half-speed parallax) ─────────────────────────────────────
        for (cwx, cwy) in g.clouds:
            sx = int((cwx - g.scroll_x // 2) % (g.world_length + GW))
            if sx < GW:
                r0 = max(0, cwy)
                r1 = min(GROUND_TOP, cwy + 3)
                c0, c1 = sx, min(GW, sx + 10)
                if r0 < r1 and c0 < c1:
                    frame[r0:r1, c0:c1] = CLOUD_C

        # ── Obstacles ────────────────────────────────────────────────────────
        for (wx, gt, gh) in g.obstacles:
            sx = wx - g.scroll_x
            if -6 <= sx < GW:
                c0 = max(0, sx)
                c1 = min(GW, sx + 6)
                if c0 >= c1:
                    continue
                # Top block (ceiling down to gap)
                if gt > 0:
                    frame[0:gt, c0:c1] = DIRT_C
                    if gt - 1 >= 0:
                        frame[gt - 1:gt, c0:c1] = EDGE_C
                # Bottom block (gap end up to ground)
                bot = gt + gh
                if bot < GROUND_TOP:
                    frame[bot:GROUND_TOP, c0:c1] = DIRT_C
                    frame[bot:bot + 1, c0:c1] = EDGE_C

        # ── Plane (blinks during invincibility) ──────────────────────────────
        if not (g.invincible > 0 and (g.invincible % 4 < 2)):
            py = int(g.plane_y)
            for row, prow in enumerate(PLANE_PIX):
                for col, color in enumerate(prow):
                    if color != -1:
                        ry = py + row
                        rx = PLANE_X + col
                        if 0 <= ry < GH and 0 <= rx < GW:
                            frame[ry, rx] = color

        # ── HUD: lives (red squares, top-left) ───────────────────────────────
        for i in range(g.lives):
            x = 1 + i * 5
            frame[1:3, x:x + 3] = LIFE_C

        # ── HUD: progress bar (top strip, yellow) ────────────────────────────
        if g.world_length > 0:
            prog = min(40, int(g.scroll_x / g.world_length * 40))
            frame[0:2, 24:24 + prog] = PROGRESS_C

        return frame


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Fy01(ARCBaseGame):
    def __init__(self):
        self.display = FlyDisplay(self)

        # State — initialised properly in on_set_level
        self.plane_y    = 20.0
        self.vy         = 0.0
        self.scroll_x   = 0
        self.obstacles  = []
        self.clouds     = []
        self.stars      = []
        self.lives      = 3
        self.invincible = 0
        self.scroll_speed  = 3
        self.world_length  = 600
        self.sky_c         = 9
        self.ground_c      = 2

        super().__init__(
            "fy",
            levels,
            Camera(0, 0, GW, GH, 0, 0, [self.display]),
            False,
            len(levels),
            [1, 2],   # ACTION1 = thrust up, ACTION2 = dive down
        )

    # ── Level setup ──────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        d = _L[self.level_index]
        self.plane_y      = 20.0
        self.vy           = 0.0
        self.scroll_x     = 0
        self.obstacles    = list(d["obs"])
        self.clouds       = list(d["clouds"])
        self.world_length = d["length"]
        self.scroll_speed = d["scroll"]
        self.sky_c        = d["sky"]
        self.ground_c     = d["ground"]
        self.lives        = 3
        self.invincible   = 0

        # Stars for night level
        if self.sky_c == 0:
            rng = random.Random(self.level_index * 7)
            self.stars = [
                (rng.randint(0, self.world_length + GW), rng.randint(2, GROUND_TOP - 3))
                for _ in range(40)
            ]
        else:
            self.stars = []

    # ── Collision ────────────────────────────────────────────────────────────

    def _check_collision(self) -> bool:
        py = int(self.plane_y)

        # Ground
        if py + PLANE_H > GROUND_TOP:
            return True
        # Ceiling
        if py < 0:
            return True

        # Obstacles
        for (wx, gt, gh) in self.obstacles:
            sx = wx - self.scroll_x
            # X overlap: plane cols [PLANE_X, PLANE_X+PLANE_W), obstacle cols [sx, sx+6)
            if PLANE_X < sx + 6 and PLANE_X + PLANE_W > sx:
                for row in range(PLANE_H):
                    if any(c != -1 for c in PLANE_PIX[row]):
                        ry = py + row
                        if ry < gt or ry >= gt + gh:
                            return True
        return False

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value

        # Thrust
        if aid == 1:    # up — fight gravity
            self.vy = max(-3.5, self.vy - 2.5)
        elif aid == 2:  # down — accelerate descent
            self.vy = min(3.5, self.vy + 1.5)

        # Gravity always pulls down
        self.vy = min(3.5, self.vy + 0.7)

        # Apply velocity, clamp to flying area
        self.plane_y = max(1.0, min(float(GROUND_TOP - PLANE_H - 1), self.plane_y + self.vy))

        # Scroll world
        self.scroll_x += self.scroll_speed

        # Invincibility countdown
        if self.invincible > 0:
            self.invincible -= 1

        # Collision check
        if self.invincible == 0 and self._check_collision():
            self.lives -= 1
            self.invincible = 10
            self.vy = -1.5   # slight bounce on hit
            if self.lives <= 0:
                self.lose()
                self.complete_action()
                return

        # Level complete
        if self.scroll_x >= self.world_length:
            self.next_level()
            self.complete_action()
            return

        self.complete_action()
