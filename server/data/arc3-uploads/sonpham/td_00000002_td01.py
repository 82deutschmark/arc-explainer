"""
td01 – Tower Defense v2  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Move cursor up
ACTION2 (v): Move cursor down
ACTION3 (<): Move cursor left
ACTION4 (>): Move cursor right
ACTION5 (X): Cycle selected tower type
ACTION6 (Z): Place tower / Sell tower (if cursor is on existing tower)

Goal: Defend the castle from waves of enemies across 4 levels.
- Start with 150 money; kills earn money based on enemy HP.
- Enemies march along the road toward the castle.
- Castle has 10 HP; each enemy that reaches it deals 1 damage.
- Place towers on grass (non-road, non-tower) cells.
- Press Z on an existing tower to sell it (refund half cost).

Tower types:
  1. Shooter (50g) - Fires pellets, 2 damage
  2. Rapid Fire (40g) - Fires fast, 1 damage, short cooldown
  3. Freeze (60g) - Slows enemies for 30 steps
  4. Anti-Air (70g) - Targets air first, hits ground too, 3 damage
  5. Stun (80g) - Stuns enemies (stops movement) for 8 steps

Enemy types:
  - Ground: follows road, normal speed
  - Fast: follows road, moves every step
  - Tank: follows road, slow but high HP
  - Flying: ignores road, goes straight to castle (appears level 3+)

Levels:
  1. U-shaped road - good for tower placement in the bend
  2. Two roads converging into one
  3. Zigzag road + flying enemies
  4. Two converging roads + one straight road
"""

import math
import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

GL = 32   # logical grid → 64×64 pixel frame (2×2 per cell)

# ── ARC3 Colour palette ─────────────────────────────────────────────────────
# 0=White 1=LightGray 2=Gray 3=DarkGray 4=VeryDarkGray 5=Black
# 6=Magenta 7=LightMagenta 8=Red 9=Blue 10=LightBlue 11=Yellow
# 12=Orange 13=Maroon 14=Green 15=Purple

GRASS_C          = 14   # Green – placeable field
PATH_C           = 3    # DarkGray – enemy road
PATH_GLOW_C      = 4    # VeryDarkGray – road border glow
GATE_C           = 12   # Orange – enemy spawn
CASTLE_C         = 9    # Blue – player castle
CURSOR_C         = 11   # Yellow – valid cursor
CURSOR_NO_C      = 2    # Gray – invalid cursor
ENEMY_C          = 8    # Red – ground enemy
FAST_ENEMY_C     = 6    # Magenta – fast enemy
TANK_ENEMY_C     = 13   # Maroon – tank enemy
FLY_ENEMY_C      = 15   # Purple – flying enemy
SLOWED_ENEMY_C   = 10   # LightBlue – slowed/frozen
STUNNED_ENEMY_C  = 1    # LightGray – stunned

# Tower colours
SHOOTER_C        = 12   # Orange
SHOOTER_TOP_C    = 11   # Yellow
RAPID_C          = 7    # LightMagenta
RAPID_TOP_C      = 6    # Magenta
FREEZE_C         = 10   # LightBlue
FREEZE_TOP_C     = 9    # Blue
ANTIAIR_C        = 15   # Purple
ANTIAIR_TOP_C    = 7    # LightMagenta
STUN_C           = 11   # Yellow
STUN_TOP_C       = 5    # Black

PELLET_NORMAL_C  = 11   # Yellow
PELLET_RAPID_C   = 7    # LightMagenta
PELLET_FREEZE_C  = 10   # LightBlue
PELLET_AA_C      = 15   # Purple
PELLET_STUN_C    = 1    # LightGray

HUD_BG_C         = 5    # Black

# ── Tower stats ──────────────────────────────────────────────────────────────
TOWER_DEFS = {
    'shooter':  {'cost': 50,  'range': 4.0, 'cooldown': 3, 'damage': 2,
                 'base_c': SHOOTER_C, 'top_c': SHOOTER_TOP_C, 'pellet_c': PELLET_NORMAL_C},
    'rapid':    {'cost': 40,  'range': 3.0, 'cooldown': 1, 'damage': 1,
                 'base_c': RAPID_C, 'top_c': RAPID_TOP_C, 'pellet_c': PELLET_RAPID_C},
    'freeze':   {'cost': 60,  'range': 3.5, 'cooldown': 4, 'damage': 0,
                 'base_c': FREEZE_C, 'top_c': FREEZE_TOP_C, 'pellet_c': PELLET_FREEZE_C},
    'antiair':  {'cost': 70,  'range': 5.0, 'cooldown': 3, 'damage': 3,
                 'base_c': ANTIAIR_C, 'top_c': ANTIAIR_TOP_C, 'pellet_c': PELLET_AA_C},
    'stun':     {'cost': 80,  'range': 3.5, 'cooldown': 5, 'damage': 1,
                 'base_c': STUN_C, 'top_c': STUN_TOP_C, 'pellet_c': PELLET_STUN_C},
}

TOWER_ORDER = ['shooter', 'rapid', 'freeze', 'antiair', 'stun']

FREEZE_DURATION  = 30
STUN_DURATION    = 8
PELLET_SPEED     = 2.0

# Enemy move intervals (lower = faster). Player moves every step (interval=1).
ENEMY_MOVE_INTERVAL  = 2   # ground: every 2 steps
FAST_MOVE_INTERVAL   = 1   # fast: every step (same as player)
TANK_MOVE_INTERVAL   = 3   # tank: every 3 steps
FLY_MOVE_INTERVAL    = 2   # flying: every 2 steps
SLOWED_INTERVAL      = 5   # when frozen

WAVES_PER_LEVEL = 5
SPAWN_INTERVAL  = 5

# ── Wave definitions per level ───────────────────────────────────────────────
# Each wave: list of (enemy_type, hp) tuples
# Types: 'ground', 'fast', 'tank', 'fly'

LEVEL_WAVES = [
    # Level 1: ground only, easy
    [
        [('ground', 3)] * 5,
        [('ground', 4)] * 6,
        [('ground', 5)] * 5 + [('fast', 3)] * 2,
        [('ground', 6)] * 6 + [('fast', 4)] * 2,
        [('tank', 12)] * 2 + [('ground', 5)] * 6,
    ],
    # Level 2: two roads, more enemies
    [
        [('ground', 4)] * 6,
        [('ground', 5)] * 4 + [('fast', 3)] * 4,
        [('fast', 4)] * 5 + [('ground', 6)] * 4,
        [('tank', 15)] * 3 + [('fast', 5)] * 4,
        [('tank', 20)] * 2 + [('ground', 8)] * 6 + [('fast', 6)] * 3,
    ],
    # Level 3: zigzag + flying enemies
    [
        [('ground', 5)] * 5 + [('fly', 4)] * 2,
        [('ground', 6)] * 4 + [('fly', 5)] * 3,
        [('fast', 5)] * 4 + [('fly', 6)] * 3 + [('ground', 7)] * 3,
        [('tank', 18)] * 3 + [('fly', 8)] * 4,
        [('fly', 10)] * 5 + [('tank', 25)] * 2 + [('fast', 8)] * 3,
    ],
    # Level 4: three roads, all enemy types
    [
        [('ground', 6)] * 5 + [('fly', 5)] * 3,
        [('fast', 6)] * 5 + [('fly', 6)] * 3 + [('ground', 8)] * 3,
        [('tank', 20)] * 3 + [('fly', 8)] * 4 + [('fast', 7)] * 4,
        [('tank', 25)] * 3 + [('fly', 10)] * 5 + [('ground', 10)] * 4,
        [('tank', 30)] * 3 + [('fly', 12)] * 5 + [('fast', 10)] * 5 + [('ground', 12)] * 3,
    ],
]


# ── Path builder ─────────────────────────────────────────────────────────────

def _seg(x0, y0, x1, y1):
    pts = []
    if x0 == x1:
        step = 1 if y1 >= y0 else -1
        for y in range(y0, y1 + step, step):
            pts.append((x0, y))
    else:
        step = 1 if x1 >= x0 else -1
        for x in range(x0, x1 + step, step):
            pts.append((x, y0))
    return pts


def _build_path(*waypoints):
    full = []
    for i in range(len(waypoints) - 1):
        seg = _seg(*waypoints[i], *waypoints[i + 1])
        if full:
            seg = seg[1:]
        full.extend(seg)
    return full


def _path_cells_3x3(path):
    """Return set of all cells occupied by a 3-wide road (1 cell each side of center)."""
    cells = set()
    for i, (px, py) in enumerate(path):
        # Add the center and neighbors
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                nx, ny = px + dx, py + dy
                if 0 <= nx < GL and 0 <= ny < GL:
                    cells.add((nx, ny))
    return cells


def _path_glow_cells(path_cells_set):
    """Return cells that form a 1-pixel glow border around the road."""
    glow = set()
    for (px, py) in path_cells_set:
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                nx, ny = px + dx, py + dy
                if 0 <= nx < GL and 0 <= ny < GL and (nx, ny) not in path_cells_set:
                    glow.add((nx, ny))
    return glow


# ── Level paths ──────────────────────────────────────────────────────────────

# Level 1: U-shape — enters top-left, goes right, down, left, down, right to exit
_PATH1 = _build_path(
    (0, 5), (12, 5), (12, 15), (4, 15), (4, 25), (31, 25)
)

# Level 2: Two roads converging
_PATH2A = _build_path(
    (0, 4), (10, 4), (10, 14), (20, 14)
)
_PATH2B = _build_path(
    (0, 24), (10, 24), (10, 14), (20, 14)
)
_PATH2_MERGED = _build_path(
    (20, 14), (31, 14)
)

# Level 3: Zigzag
_PATH3 = _build_path(
    (0, 4), (8, 4), (8, 16), (22, 16), (22, 4), (31, 4)
)

# Level 4: Two converging + one straight
_PATH4A = _build_path(
    (0, 3), (8, 3), (8, 13), (18, 13)
)
_PATH4B = _build_path(
    (0, 25), (8, 25), (8, 13), (18, 13)
)
_PATH4_MERGED = _build_path(
    (18, 13), (31, 13)
)
_PATH4C = _build_path(
    (0, 13), (31, 13)
)

# Flying path: straight line from left edge to castle
def _fly_path(castle_pos):
    """Generate straight-line waypoints for flying enemies."""
    cx, cy = castle_pos
    pts = []
    for x in range(0, cx + 1):
        pts.append((x, cy))
    return pts


# Level configs
_LEVELS = [
    {
        "name": "U-Bend",
        "paths": [_PATH1],
        "castle": _PATH1[-1],
        "gates": [_PATH1[0]],
        "prep_time": 25,
        "has_fly": False,
    },
    {
        "name": "Convergence",
        "paths": [_PATH2A + _PATH2_MERGED[1:], _PATH2B + _PATH2_MERGED[1:]],
        "castle": _PATH2_MERGED[-1],
        "gates": [_PATH2A[0], _PATH2B[0]],
        "prep_time": 20,
        "has_fly": False,
    },
    {
        "name": "Zigzag",
        "paths": [_PATH3],
        "castle": _PATH3[-1],
        "gates": [_PATH3[0]],
        "prep_time": 20,
        "has_fly": True,
    },
    {
        "name": "Triple Threat",
        "paths": [_PATH4A + _PATH4_MERGED[1:], _PATH4B + _PATH4_MERGED[1:], _PATH4C],
        "castle": _PATH4_MERGED[-1],
        "gates": [_PATH4A[0], _PATH4B[0], _PATH4C[0]],
        "prep_time": 20,
        "has_fly": True,
    },
]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d["name"], data=d)
    for d in _LEVELS
]


# ── Render helpers ───────────────────────────────────────────────────────────

def _fill3(frame, lx, ly, color):
    """Fill a 3×3 pixel block (1.5 logical cells) centered at logical cell."""
    px, py = lx * 2, ly * 2
    for dy in range(-1, 2):
        for dx in range(-1, 2):
            fx, fy = px + dx, py + dy
            if 0 <= fx < 64 and 0 <= fy < 64:
                frame[fy, fx] = color


def _fill2(frame, lx, ly, color):
    """Fill a 2×2 pixel block at logical cell."""
    px, py = lx * 2, ly * 2
    if 0 <= px < 63 and 0 <= py < 63:
        frame[py:py + 2, px:px + 2] = color


def _draw_digit(frame, x, y, digit, color):
    """Draw a 3×5 pixel digit at pixel position (x, y)."""
    DIGITS = {
        0: [0b111, 0b101, 0b101, 0b101, 0b111],
        1: [0b010, 0b110, 0b010, 0b010, 0b111],
        2: [0b111, 0b001, 0b111, 0b100, 0b111],
        3: [0b111, 0b001, 0b111, 0b001, 0b111],
        4: [0b101, 0b101, 0b111, 0b001, 0b001],
        5: [0b111, 0b100, 0b111, 0b001, 0b111],
        6: [0b111, 0b100, 0b111, 0b101, 0b111],
        7: [0b111, 0b001, 0b010, 0b010, 0b010],
        8: [0b111, 0b101, 0b111, 0b101, 0b111],
        9: [0b111, 0b101, 0b111, 0b001, 0b111],
    }
    pattern = DIGITS.get(digit, DIGITS[0])
    for row_i, bits in enumerate(pattern):
        for col_i in range(3):
            if bits & (1 << (2 - col_i)):
                px, py = x + col_i, y + row_i
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = color


def _draw_number(frame, x, y, number, color):
    """Draw a multi-digit number at pixel position (x, y)."""
    number = max(0, number)
    s = str(number)
    for i, ch in enumerate(s):
        _draw_digit(frame, x + i * 4, y, int(ch), color)


def _draw_range_circle(frame, lx, ly, radius_cells, color):
    """Draw a circle around logical cell (lx, ly)."""
    cx = lx * 2 + 1
    cy = ly * 2 + 1
    r = int(radius_cells * 2)
    x, y, d = 0, r, 1 - r
    pts = []
    while x <= y:
        for px, py in [(cx+x,cy+y),(cx-x,cy+y),(cx+x,cy-y),(cx-x,cy-y),
                       (cx+y,cy+x),(cx-y,cy+x),(cx+y,cy-x),(cx-y,cy-x)]:
            pts.append((px, py))
        if d < 0:
            d += 2 * x + 3
        else:
            d += 2 * (x - y) + 5
            y -= 1
        x += 1
    for px, py in pts:
        if 0 <= px < 64 and 0 <= py < 64:
            frame[py, px] = color


# ── Display ──────────────────────────────────────────────────────────────────

class Td01Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        g = self.game
        lv = _LEVELS[g.level_index]

        # ── Background: grass ────────────────────────────────────────────
        frame[:, :] = GRASS_C

        # ── Road glow (1px border) ──────────────────────────────────────
        for (px, py) in g.glow_cells:
            _fill2(frame, px, py, PATH_GLOW_C)

        # ── Road (3-cell wide) ──────────────────────────────────────────
        for (px, py) in g.road_cells:
            _fill2(frame, px, py, PATH_C)

        # ── Gates & Castle (3×3) ────────────────────────────────────────
        for gx, gy in lv["gates"]:
            _fill3(frame, gx, gy, GATE_C)
        cx, cy = lv["castle"]
        _fill3(frame, cx, cy, CASTLE_C)

        # ── Tower range circles ─────────────────────────────────────────
        # Only show for tower under cursor
        if g.cursor in g.tower_set:
            kind = g.tower_types[g.cursor]
            td = TOWER_DEFS[kind]
            _draw_range_circle(frame, g.cursor[0], g.cursor[1], td['range'], td['base_c'])

        # ── Towers (3×3) ────────────────────────────────────────────────
        for (tx, ty) in g.towers:
            kind = g.tower_types[(tx, ty)]
            td = TOWER_DEFS[kind]
            _fill3(frame, tx, ty, td['base_c'])
            # Tower top indicator (center pixel)
            px, py = tx * 2, ty * 2
            if 0 <= px < 64 and 0 <= py < 64:
                frame[py, px] = td['top_c']

        # ── Pellets ─────────────────────────────────────────────────────
        for p in g.pellets:
            px = int(p['x'] * 2 + 1)
            py = int(p['y'] * 2 + 1)
            if 0 <= px < 64 and 0 <= py < 64:
                frame[py, px] = p['color']

        # ── Enemies (3×3) ───────────────────────────────────────────────
        for e in g.enemies:
            ex, ey = e['pos']
            if e['stun'] > 0:
                color = STUNNED_ENEMY_C
            elif e['slowed'] > 0:
                color = SLOWED_ENEMY_C
            else:
                color = e['color']
            _fill3(frame, ex, ey, color)

        # ── Cursor (3×3 outline) ────────────────────────────────────────
        cc = CURSOR_NO_C if g._cursor_invalid() else CURSOR_C
        cx, cy = g.cursor
        px, py = cx * 2, cy * 2
        # Draw 3×3 outline (border only)
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if abs(dx) == 1 or abs(dy) == 1:  # border pixels
                    fx, fy = px + dx, py + dy
                    if 0 <= fx < 64 and 0 <= fy < 64:
                        frame[fy, fx] = cc

        # ── HUD: top strip ──────────────────────────────────────────────
        frame[0:7, 0:64] = HUD_BG_C

        # Money (numeric) at top-left
        _draw_number(frame, 1, 1, g.money, 11)   # Yellow digits

        # Selected tower type indicator + cost
        sel = g.selected_tower
        td = TOWER_DEFS[sel]
        # Tower color swatch
        frame[1:4, 24:27] = td['base_c']
        # Cost
        _draw_number(frame, 28, 1, td['cost'], 1)  # LightGray

        # Wave counter
        _draw_number(frame, 46, 1, g.wave + 1, 10)  # LightBlue
        # slash
        frame[5, 50] = 1
        _draw_number(frame, 52, 1, WAVES_PER_LEVEL, 10)

        # ── HUD: castle HP (bottom strip) ───────────────────────────────
        frame[58:64, 0:64] = HUD_BG_C
        # HP icon + number
        frame[59:62, 1:4] = 8   # Red heart
        _draw_number(frame, 5, 59, g.castle_hp, 8)

        # Tower type name abbreviation
        NAMES = {'shooter': 'SH', 'rapid': 'RF', 'freeze': 'FZ', 'antiair': 'AA', 'stun': 'ST'}
        name = NAMES.get(sel, 'SH')
        # Simple 2-char label using pixels
        # S
        if name[0] == 'S':
            for px2 in [20, 21, 22]: frame[59, px2] = 1
            frame[60, 20] = 1
            for px2 in [20, 21, 22]: frame[61, px2] = 1
            frame[62, 22] = 1
            for px2 in [20, 21, 22]: frame[63, px2] = 1
        elif name[0] == 'R':
            frame[59, 20] = 1; frame[59, 21] = 1
            frame[60, 20] = 1; frame[60, 22] = 1
            frame[61, 20] = 1; frame[61, 21] = 1
            frame[62, 20] = 1; frame[62, 22] = 1
            frame[63, 20] = 1; frame[63, 22] = 1
        elif name[0] == 'F':
            for px2 in [20, 21, 22]: frame[59, px2] = 1
            frame[60, 20] = 1
            for px2 in [20, 21]: frame[61, px2] = 1
            frame[62, 20] = 1
            frame[63, 20] = 1
        elif name[0] == 'A':
            frame[59, 21] = 1
            frame[60, 20] = 1; frame[60, 22] = 1
            for px2 in [20, 21, 22]: frame[61, px2] = 1
            frame[62, 20] = 1; frame[62, 22] = 1
            frame[63, 20] = 1; frame[63, 22] = 1

        if name[1] == 'H':
            frame[59, 24] = 1; frame[59, 26] = 1
            frame[60, 24] = 1; frame[60, 26] = 1
            for px2 in [24, 25, 26]: frame[61, px2] = 1
            frame[62, 24] = 1; frame[62, 26] = 1
            frame[63, 24] = 1; frame[63, 26] = 1
        elif name[1] == 'F':
            for px2 in [24, 25, 26]: frame[59, px2] = 1
            frame[60, 24] = 1
            for px2 in [24, 25]: frame[61, px2] = 1
            frame[62, 24] = 1
            frame[63, 24] = 1
        elif name[1] == 'Z':
            for px2 in [24, 25, 26]: frame[59, px2] = 1
            frame[60, 26] = 1
            frame[61, 25] = 1
            frame[62, 24] = 1
            for px2 in [24, 25, 26]: frame[63, px2] = 1
        elif name[1] == 'A':
            frame[59, 25] = 1
            frame[60, 24] = 1; frame[60, 26] = 1
            for px2 in [24, 25, 26]: frame[61, px2] = 1
            frame[62, 24] = 1; frame[62, 26] = 1
            frame[63, 24] = 1; frame[63, 26] = 1
        elif name[1] == 'T':
            for px2 in [24, 25, 26]: frame[59, px2] = 1
            frame[60, 25] = 1
            frame[61, 25] = 1
            frame[62, 25] = 1
            frame[63, 25] = 1

        # ── Prep timer bar ──────────────────────────────────────────────
        if g.between_wave_timer > 0:
            prep = lv["prep_time"]
            frac = g.between_wave_timer / prep
            bar = round(40 * frac)
            if bar > 0:
                frame[5:6, 12:12 + bar] = 11   # Yellow countdown

        return frame


# ── Game ─────────────────────────────────────────────────────────────────────

class Td01(ARCBaseGame):
    def __init__(self):
        self.display = Td01Display(self)

        # State (reset by on_set_level)
        self.cursor          = (2, 10)
        self.towers          = []
        self.tower_set       = set()
        self.tower_types     = {}
        self.tower_cooldowns = {}
        self.enemies         = []
        self.pellets         = []
        self.money           = 150
        self.castle_hp       = 10
        self.wave            = 0
        self.enemies_spawned = 0
        self.spawn_timer     = 0
        self.between_wave_timer = 25
        self.step_count      = 0
        self.selected_tower  = 'shooter'
        self.road_cells      = set()
        self.glow_cells      = set()
        self.road_center     = set()
        self.fly_path        = []
        self.spawn_path_idx  = 0  # for multi-path spawning

        super().__init__(
            "td",
            levels,
            Camera(0, 0, 64, 64, GRASS_C, GRASS_C, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5, 6],
        )

    def on_set_level(self, level):
        lv = _LEVELS[self.level_index]
        # Build road cells from all paths (3-cell wide)
        self.road_center = set()
        for p in lv["paths"]:
            self.road_center.update(p)
        self.road_cells = _path_cells_3x3(list(self.road_center))
        self.glow_cells = _path_glow_cells(self.road_cells)

        # Flying path
        castle = lv["castle"]
        self.fly_path = _fly_path(castle)

        self.cursor          = (2, 10)
        self.towers          = []
        self.tower_set       = set()
        self.tower_types     = {}
        self.tower_cooldowns = {}
        self.enemies         = []
        self.pellets         = []
        self.money           = 150
        self.castle_hp       = 10
        self.wave            = 0
        self.enemies_spawned = 0
        self.spawn_timer     = 0
        self.between_wave_timer = lv["prep_time"]
        self.step_count      = 0
        self.spawn_path_idx  = 0

    # ── Helpers ──────────────────────────────────────────────────────────

    def _cursor_invalid(self):
        """Cursor is invalid if on road, glow, gate, castle, or existing tower."""
        lv = _LEVELS[self.level_index]
        pos = self.cursor
        if pos in self.road_cells or pos in self.glow_cells:
            return True
        if pos in self.tower_set:
            return True  # But Z will sell here
        # Check gate/castle proximity (3×3 zone)
        for gx, gy in lv["gates"]:
            if abs(pos[0] - gx) <= 1 and abs(pos[1] - gy) <= 1:
                return True
        cx, cy = lv["castle"]
        if abs(pos[0] - cx) <= 1 and abs(pos[1] - cy) <= 1:
            return True
        # Check bounds for 3×3 tower (tower occupies center ±1)
        if pos[0] < 1 or pos[0] >= GL - 1 or pos[1] < 1 or pos[1] >= GL - 1:
            return True
        return False

    def _can_place(self):
        """Check if we can place a tower at cursor (not on road, not on tower, enough money)."""
        if self._cursor_invalid():
            return False
        td = TOWER_DEFS[self.selected_tower]
        return self.money >= td['cost']

    def _get_enemy_pos(self, e):
        """Get logical position of an enemy."""
        return e['pos']

    def _towers_shoot(self):
        """Each tower fires based on its cooldown."""
        for (tx, ty) in self.towers:
            kind = self.tower_types[(tx, ty)]
            td = TOWER_DEFS[kind]
            cd = self.tower_cooldowns.get((tx, ty), 0)
            if cd > 0:
                self.tower_cooldowns[(tx, ty)] = cd - 1
                continue

            # Find target
            target = None
            best_dist = td['range'] + 1

            if kind == 'antiair':
                # Anti-air: prioritize flying, then closest ground
                best_fly = None
                best_fly_dist = td['range'] + 1
                best_ground = None
                best_ground_dist = td['range'] + 1
                for e in self.enemies:
                    ex, ey = e['pos']
                    dist = math.sqrt((tx - ex) ** 2 + (ty - ey) ** 2)
                    if dist <= td['range']:
                        if e['type'] == 'fly':
                            if dist < best_fly_dist:
                                best_fly = e
                                best_fly_dist = dist
                        else:
                            if dist < best_ground_dist:
                                best_ground = e
                                best_ground_dist = dist
                target = best_fly if best_fly else best_ground
            else:
                # Normal targeting: closest to castle (highest path index)
                best_progress = -1
                for e in self.enemies:
                    ex, ey = e['pos']
                    dist = math.sqrt((tx - ex) ** 2 + (ty - ey) ** 2)
                    if dist <= td['range'] and e['path_idx'] > best_progress:
                        best_progress = e['path_idx']
                        target = e

            if target is not None:
                ex, ey = target['pos']
                ddx, ddy = ex - tx, ey - ty
                dist = math.sqrt(ddx * ddx + ddy * ddy)
                if dist > 0:
                    ttl = math.ceil(dist / PELLET_SPEED) + 1
                    self.pellets.append({
                        'x': float(tx), 'y': float(ty),
                        'vx': ddx / dist * PELLET_SPEED,
                        'vy': ddy / dist * PELLET_SPEED,
                        'ttl': ttl,
                        'target': target,
                        'kind': kind,
                        'damage': td['damage'],
                        'color': td['pellet_c'],
                    })
                    self.tower_cooldowns[(tx, ty)] = td['cooldown']

    def _move_pellets(self):
        alive = []
        for p in self.pellets:
            p['x'] += p['vx']
            p['y'] += p['vy']
            p['ttl'] -= 1
            if p['ttl'] > 0 and 0 <= p['x'] < GL and 0 <= p['y'] < GL:
                alive.append(p)
            else:
                t = p['target']
                if t in self.enemies:
                    if p['kind'] == 'freeze':
                        t['slowed'] = FREEZE_DURATION
                    elif p['kind'] == 'stun':
                        t['stun'] = STUN_DURATION
                        t['hp'] -= p['damage']
                    else:
                        t['hp'] -= p['damage']
                    if t['hp'] <= 0 and t in self.enemies:
                        self.enemies.remove(t)
                        self.money += t['reward']
        self.pellets = alive

    def _move_enemies(self):
        reached = []
        for e in self.enemies:
            # Decrement status effects
            if e['stun'] > 0:
                e['stun'] -= 1
                continue  # Stunned enemies don't move
            if e['slowed'] > 0:
                e['slowed'] -= 1

            # Determine move interval
            if e['slowed'] > 0:
                interval = SLOWED_INTERVAL
            elif e['type'] == 'fast':
                interval = FAST_MOVE_INTERVAL
            elif e['type'] == 'tank':
                interval = TANK_MOVE_INTERVAL
            elif e['type'] == 'fly':
                interval = FLY_MOVE_INTERVAL
            else:
                interval = ENEMY_MOVE_INTERVAL

            e['move_timer'] += 1
            if e['move_timer'] >= interval:
                e['move_timer'] = 0
                e['path_idx'] += 1
                if e['path_idx'] >= len(e['path']):
                    reached.append(e)
                else:
                    e['pos'] = e['path'][e['path_idx']]

        for e in reached:
            if e in self.enemies:
                self.enemies.remove(e)
                self.castle_hp = max(0, self.castle_hp - 1)

    def _try_spawn(self):
        lv = _LEVELS[self.level_index]
        wave_enemies = LEVEL_WAVES[self.level_index][self.wave]
        if self.enemies_spawned >= len(wave_enemies):
            return
        if self.spawn_timer > 0:
            self.spawn_timer -= 1
            return

        etype, hp = wave_enemies[self.enemies_spawned]

        # Determine path
        if etype == 'fly':
            path = self.fly_path
            color = FLY_ENEMY_C
        else:
            # Cycle through available paths
            paths = lv["paths"]
            path = paths[self.spawn_path_idx % len(paths)]
            self.spawn_path_idx += 1
            if etype == 'fast':
                color = FAST_ENEMY_C
            elif etype == 'tank':
                color = TANK_ENEMY_C
            else:
                color = ENEMY_C

        reward = max(5, hp * 3)
        self.enemies.append({
            'path': path,
            'path_idx': 0,
            'pos': path[0],
            'hp': hp,
            'type': etype,
            'color': color,
            'reward': reward,
            'move_timer': 0,
            'slowed': 0,
            'stun': 0,
        })
        self.enemies_spawned += 1
        self.spawn_timer = SPAWN_INTERVAL

    # ── Step ─────────────────────────────────────────────────────────────

    def step(self):
        aid = self.action.id.value
        self.step_count += 1

        cx, cy = self.cursor

        # ── Player movement (ACTION1-4) ──────────────────────────────────
        if aid == 1 and cy > 1:
            self.cursor = (cx, cy - 1)
        elif aid == 2 and cy < GL - 2:
            self.cursor = (cx, cy + 1)
        elif aid == 3 and cx > 1:
            self.cursor = (cx - 1, cy)
        elif aid == 4 and cx < GL - 2:
            self.cursor = (cx + 1, cy)

        # ── Cycle tower type (ACTION5 = X) ───────────────────────────────
        elif aid == 5:
            idx = TOWER_ORDER.index(self.selected_tower)
            self.selected_tower = TOWER_ORDER[(idx + 1) % len(TOWER_ORDER)]

        # ── Place or Sell (ACTION6 = Z) ──────────────────────────────────
        elif aid == 6:
            pos = self.cursor
            if pos in self.tower_set:
                # Sell tower
                kind = self.tower_types[pos]
                td = TOWER_DEFS[kind]
                self.towers.remove(pos)
                self.tower_set.discard(pos)
                self.tower_types.pop(pos, None)
                self.tower_cooldowns.pop(pos, None)
                self.pellets = [p for p in self.pellets if p.get('tower_pos') != pos]
                self.money += td['cost'] // 2
            elif self._can_place():
                # Place tower
                td = TOWER_DEFS[self.selected_tower]
                self.towers.append(pos)
                self.tower_set.add(pos)
                self.tower_types[pos] = self.selected_tower
                self.tower_cooldowns[pos] = 0
                self.money -= td['cost']

        # ── Prep phase ───────────────────────────────────────────────────
        if self.between_wave_timer > 0:
            self.between_wave_timer -= 1
            self.complete_action()
            return

        # ── Wave active ──────────────────────────────────────────────────
        self._try_spawn()
        self._move_enemies()
        self._towers_shoot()
        self._move_pellets()

        # ── Check lose ───────────────────────────────────────────────────
        if self.castle_hp <= 0:
            self.lose()
            self.complete_action()
            return

        # ── Check wave complete ──────────────────────────────────────────
        wave_enemies = LEVEL_WAVES[self.level_index][self.wave]
        if self.enemies_spawned >= len(wave_enemies) and not self.enemies:
            self.wave += 1
            if self.wave >= WAVES_PER_LEVEL:
                if not self.is_last_level():
                    self.next_level()
                else:
                    self.win()
                self.complete_action()
                return
            self.enemies_spawned = 0
            self.spawn_timer = 0
            self.spawn_path_idx = 0
            self.between_wave_timer = _LEVELS[self.level_index]["prep_time"]

        self.complete_action()
