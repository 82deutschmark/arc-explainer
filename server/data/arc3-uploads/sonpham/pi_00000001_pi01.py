import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# Logical grid: 32×32 cells, each rendered as 2×2 pixels → 64×64 output
GL = 32
MAX_LIVES = 5

# ARC-AGI-3 colour indices
# 0=black  1=dark-blue  2=green   3=dark-gray  4=yellow   5=gray
# 6=pink   7=orange     8=azure   9=blue       11=bright-yellow
# 12=red   14=lime      15=white

OCEAN_C    = 9    # blue sea
LAND_C     = 2    # green island interior
SHORE_C    = 4    # yellow sand (shoreline cells)
ROCK_C     = 5    # gray rocks
SHIP_C     = 15   # white ship hull / sail
DECK_C     = 3    # dark deck
TREASURE_C = 11   # bright yellow chest
ENEMY_C    = 6    # magenta enemy ship (bouncing)
CHASER_C   = 14   # lime chasing enemy ship
PATROL_C   = 12   # red sentinel/patrol ship
LOS_C      = 7    # orange line-of-sight ray
LOS_RANGE  = 8    # cells the patrol ship can see ahead
LIFE_C     = 12   # red HUD lives
PROGRESS_C = 11   # yellow HUD progress
USED_PORT_C    = 5   # gray — docked / exhausted port
SWITCH_C       = 8   # azure — interactive switch (state 0)
SWITCH_ON_C    = 1   # dark-blue — switch (state 1)
CHEST_ORANGE_C = 7   # orange locked chest (needs orange key)
CHEST_RED_C    = 12  # red locked chest (needs red key)
KEY_ORANGE_C   = 7   # orange key (rendered as dot)
KEY_RED_C      = 12  # red key (rendered as dot)

# ── Faction identifiers & colours ────────────────────────────────────────
F_BRITISH = "british"
F_FRANCE  = "france"
F_SPAIN   = "spain"
F_DUTCH   = "dutch"
F_PIRATE  = "pirate"

FACTION_COLOR = {
    F_BRITISH: 12,   # red
    F_FRANCE:  8,    # azure
    F_SPAIN:   4,    # yellow / gold
    F_DUTCH:   7,    # orange
    F_PIRATE:  0,    # black
}

# Effect applied when docking at a port (effect_type, magnitude)
#   "life"         → +N lives (capped at MAX_LIVES)
#   "invincible"   → +N steps of invincibility
#   "remove_enemy" → remove N nearest enemy ships
PORT_EFFECT = {
    F_BRITISH: ("life",          1),
    F_FRANCE:  ("invincible",   15),
    F_SPAIN:   ("remove_enemy",  1),
    F_DUTCH:   ("life",          1),
    F_PIRATE:  ("life",          2),
}

FACTIONS_ORDERED = [F_BRITISH, F_FRANCE, F_SPAIN, F_DUTCH, F_PIRATE]

# Map cell types
OCEAN = 0
LAND  = 1
ROCK  = 2

# Action → direction  (1=up 2=down 3=left 4=right)
_DIR = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}

# Player ship pixel art (logical 2×3), -1 = transparent
SHIP_PIX = [
    [-1,     SHIP_C],
    [SHIP_C, SHIP_C],
    [DECK_C, DECK_C],
]
SHIP_LW, SHIP_LH = 2, 3


# ---------------------------------------------------------------------------
# Map helpers
# ---------------------------------------------------------------------------

def _make_map(islands, rocks):
    m = np.zeros((GL, GL), dtype=np.int8)
    for cx, cy, rx, ry in islands:
        for y in range(max(0, cy - ry), min(GL, cy + ry + 1)):
            for x in range(max(0, cx - rx), min(GL, cx + rx + 1)):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    m[y, x] = LAND
    for x, y in rocks:
        if 0 <= x < GL and 0 <= y < GL:
            m[y, x] = ROCK
    return m


def _shore_mask(m):
    s = np.zeros_like(m, dtype=bool)
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        rolled = np.roll(m == OCEAN, (dy, dx), axis=(0, 1))
        s |= ((m == LAND) & rolled)
    return s


def _port(lx, ly, faction):
    return {"lx": lx, "ly": ly, "faction": faction,
            "color": FACTION_COLOR[faction], "used": False}


# ── Map 1: Caribbean Cove ─────────────────────────────────────────────────
_MAP1 = _make_map(
    islands=[(10, 8, 4, 3), (22, 21, 3, 4)],
    rocks=[(17, 14), (18, 14), (17, 15)],
)
_PORTS1 = [
    _port(10,  8, F_BRITISH),
    _port( 8,  7, F_SPAIN),
    _port(11,  9, F_PIRATE),
    _port(22, 21, F_FRANCE),
    _port(23, 20, F_DUTCH),
]

# ── Map 2: Skull Shoals ───────────────────────────────────────────────────
_MAP2 = _make_map(
    islands=[(8, 6, 3, 2), (23, 8, 2, 4), (15, 23, 5, 3)],
    rocks=[(12, 15), (13, 16), (21, 16), (26, 6)],
)
_PORTS2 = [
    _port( 8,  6, F_BRITISH),
    _port(23,  8, F_FRANCE),
    _port(15, 23, F_SPAIN),
    _port(14, 22, F_DUTCH),
    _port(16, 24, F_PIRATE),
]

# ── Map 3: Dragon's Lair ──────────────────────────────────────────────────
_MAP3 = _make_map(
    islands=[(6, 5, 2, 2), (18, 4, 3, 2), (27, 11, 2, 3),
             (9, 21, 2, 3), (23, 25, 3, 2), (15, 16, 2, 2)],
    rocks=[(14, 10), (15, 10), (10, 15), (24, 18), (20, 20)],
)
_PORTS3 = [
    _port( 6,  5, F_BRITISH),
    _port(18,  4, F_FRANCE),
    _port(27, 11, F_SPAIN),
    _port( 9, 21, F_DUTCH),
    _port(23, 25, F_PIRATE),
]

# ── Map 4: Stormy Waters ──────────────────────────────────────────────────
_MAP4 = _make_map(
    islands=[(5, 5, 2, 2), (27, 5, 2, 2), (5, 27, 2, 2), (27, 27, 2, 2), (16, 16, 2, 2)],
    rocks=[(10, 10), (11, 10), (10, 11), (21, 10), (22, 10), (21, 21), (22, 21), (10, 21)],
)
_PORTS4 = [
    _port( 5,  5, F_BRITISH),
    _port(27,  5, F_FRANCE),
    _port( 5, 27, F_SPAIN),
    _port(27, 27, F_DUTCH),
    _port(16, 16, F_PIRATE),
]

# ── Map 5: Kraken's Hunt ──────────────────────────────────────────────────
_MAP5 = _make_map(
    islands=[(8, 8, 3, 2), (24, 8, 2, 3), (8, 24, 2, 3), (24, 24, 3, 2), (16, 4, 2, 2), (16, 28, 2, 2)],
    rocks=[(13, 13), (14, 13), (13, 14), (18, 13), (19, 13), (18, 18), (13, 18), (19, 18)],
)
_PORTS5 = [
    _port( 8,  8, F_BRITISH),
    _port(24,  8, F_FRANCE),
    _port( 8, 24, F_SPAIN),
    _port(24, 24, F_DUTCH),
    _port(16,  4, F_PIRATE),
]

# ── Map 6: Sentinel Straits ───────────────────────────────────────────────
# Two horizontal band islands create a clear corridor through the middle.
_MAP6 = _make_map(
    islands=[(16, 7, 7, 4), (16, 25, 7, 4)],
    rocks=[(4, 15), (4, 16), (4, 17), (28, 15), (28, 16), (28, 17)],
)
_PORTS6 = [
    _port(16,  7, F_BRITISH),
    _port(10,  7, F_FRANCE),
    _port(22,  7, F_SPAIN),
    _port(16, 25, F_DUTCH),
    _port(22, 25, F_PIRATE),
]

# ── Map 7: Hunter's Web ───────────────────────────────────────────────────
# Four corner islands leave a cross-shaped open ocean in the center.
_MAP7 = _make_map(
    islands=[(7, 7, 4, 4), (25, 7, 4, 4), (7, 25, 4, 4), (25, 25, 4, 4)],
    rocks=[(14, 14), (15, 14), (14, 15), (17, 17), (18, 17), (17, 18)],
)
_PORTS7 = [
    _port( 7,  7, F_BRITISH),
    _port(25,  7, F_FRANCE),
    _port( 7, 25, F_SPAIN),
    _port(25, 25, F_DUTCH),
]

# ── Map 8: Fog of War ────────────────────────────────────────────────────
# Central island with four small corner islands. Switch reveals hidden group.
_MAP8 = _make_map(
    islands=[(16, 16, 3, 3), (4, 4, 1, 1), (28, 4, 1, 1), (4, 28, 1, 1), (28, 28, 1, 1)],
    rocks=[(10, 8), (22, 8), (10, 24), (22, 24)],
)
_PORTS8 = [
    _port( 4,  4, F_BRITISH),
    _port(28,  4, F_FRANCE),
    _port( 4, 28, F_SPAIN),
    _port(28, 28, F_DUTCH),
    _port(16, 16, F_PIRATE),
]

# ── Map 9: Key & Switch ───────────────────────────────────────────────────
# Four corner islands, central rock ring. Keys unlock coloured chests.
_MAP9 = _make_map(
    islands=[(8, 8, 3, 3), (24, 8, 3, 3), (8, 24, 3, 3), (24, 24, 3, 3)],
    rocks=[(14, 14), (15, 14), (16, 14), (14, 15), (16, 15),
           (14, 16), (15, 16), (16, 16)],
)
_PORTS9 = [
    _port( 8,  8, F_BRITISH),
    _port(24,  8, F_FRANCE),
    _port( 8, 24, F_SPAIN),
    _port(24, 24, F_DUTCH),
]

_SHORE1, _SHORE2, _SHORE3 = _shore_mask(_MAP1), _shore_mask(_MAP2), _shore_mask(_MAP3)
_SHORE4, _SHORE5 = _shore_mask(_MAP4), _shore_mask(_MAP5)
_SHORE6, _SHORE7 = _shore_mask(_MAP6), _shore_mask(_MAP7)
_SHORE8, _SHORE9 = _shore_mask(_MAP8), _shore_mask(_MAP9)

_LEVELS = [
    {
        "name":      "Caribbean Cove",
        "map":       _MAP1, "shore": _SHORE1, "ports": _PORTS1,
        "ship":      (2, 16),
        "treasures": [(28, 4), (28, 27), (4, 27)],
        "enemies":   [{"pos": [16, 5],  "dir": [1, 0]}],
        "chasers":   [],
        "patrols":   [],
        "lives":     3,
        "timer":     100,
    },
    {
        "name":      "Skull Shoals",
        "map":       _MAP2, "shore": _SHORE2, "ports": _PORTS2,
        "ship":      (2, 16),
        "treasures": [(28, 4), (28, 28), (4, 28), (28, 16), (16, 28)],
        "enemies":   [{"pos": [16, 10], "dir": [0, 1]},
                      {"pos": [26, 22], "dir": [-1, 0]}],
        "chasers":   [],
        "patrols":   [],
        "lives":     3,
        "timer":     130,
    },
    {
        "name":      "Dragon's Lair",
        "map":       _MAP3, "shore": _SHORE3, "ports": _PORTS3,
        "ship":      (2, 16),
        "treasures": [(29, 3), (29, 29), (3, 29), (29, 16),
                      (16, 29), (16, 2),  (3,  3)],
        "enemies":   [{"pos": [20, 8],  "dir": [1, 0]},
                      {"pos": [5,  25], "dir": [0, -1]},
                      {"pos": [26, 16], "dir": [0, 1]}],
        "chasers":   [],
        "patrols":   [],
        "lives":     3,
        "timer":     170,
    },
    {
        "name":      "Stormy Waters",
        "map":       _MAP4, "shore": _SHORE4, "ports": _PORTS4,
        "ship":      (2, 16),
        "treasures": [(29, 2), (29, 29), (2, 29), (29, 16), (16, 2)],
        "enemies":   [{"pos": [16, 10], "dir": [1, 0]}],
        "chasers":   [{"pos": [29, 16], "budget": 0.0}],
        "patrols":   [],
        "lives":     3,
        "timer":     130,
    },
    {
        "name":      "Kraken's Hunt",
        "map":       _MAP5, "shore": _SHORE5, "ports": _PORTS5,
        "ship":      (2, 16),
        "treasures": [(29, 2), (29, 29), (2, 29), (29, 16),
                      (12, 29), (2, 2),  (12, 2)],
        "enemies":   [{"pos": [16, 16], "dir": [1, 0]}],
        "chasers":   [{"pos": [29, 4],  "budget": 0.0},
                      {"pos": [29, 28], "budget": 0.0}],
        "patrols":   [],
        "lives":     3,
        "timer":     170,
    },
    {
        "name":      "Sentinel Straits",
        "map":       _MAP6, "shore": _SHORE6, "ports": _PORTS6,
        "ship":      (2, 16),
        "treasures": [(29, 2), (2, 2), (2, 29), (29, 29), (16, 16)],
        "enemies":   [{"pos": [8, 16], "dir": [1, 0]}],
        "chasers":   [],
        # Patrol ship centered, LoS faces left toward the player's approach
        "patrols":   [{"pos": [16, 16], "dir": [-1, 0], "alerted": False, "budget": 0.0}],
        "lives":     3,
        "timer":     130,
    },
    {
        "name":      "Hunter's Web",
        "map":       _MAP7, "shore": _SHORE7, "ports": _PORTS7,
        "ship":      (2, 16),
        "treasures": [(29, 2), (28, 29), (16, 29), (29, 15),
                      (16, 2),  (2, 2),  (16, 16)],
        "enemies":   [{"pos": [16, 12], "dir": [1, 0]}],
        "chasers":   [{"pos": [2, 29], "budget": 0.0}],
        # Two patrol ships: one guards top corridor, one guards right corridor
        "patrols":   [{"pos": [16, 2],  "dir": [0,  1], "alerted": False, "budget": 0.0},
                      {"pos": [29, 16], "dir": [-1, 0], "alerted": False, "budget": 0.0}],
        "lives":     3,
        "timer":     175,
    },
    {
        "name":         "Fog of War",
        "map":          _MAP8, "shore": _SHORE8, "ports": _PORTS8,
        "ship":         (2, 16),
        # Normal chests always visible
        "treasures":    [(8, 16), (24, 16)],
        # Switch-A group: visible at start (state=0)
        "switch_a":     [(29, 16), (29, 2), (16, 2)],
        # Switch-B group: hidden at start, revealed when switch hit
        "switch_b":     [(2, 2), (2, 28), (16, 29)],
        "switch":       {"pos": [16, 8]},
        "orange_chests": [],
        "red_chests":   [],
        "keys":         [],
        "enemies":      [],
        "chasers":      [],
        "patrols":      [{"pos": [24, 24], "dir": [-1, 0], "alerted": False, "budget": 0.0}],
        "lives":        3,
        "timer":        175,
    },
    {
        "name":         "Key & Switch",
        "map":          _MAP9, "shore": _SHORE9, "ports": _PORTS9,
        "ship":         (2, 16),
        "treasures":    [(2, 2), (2, 29), (29, 3), (29, 13), (29, 19), (29, 29)],
        # Switch groups
        "switch_a":     [(2, 8), (16, 2)],
        "switch_b":     [(2, 24), (16, 29)],
        "switch":       {"pos": [16, 4]},
        "orange_chests": [],
        "red_chests":   [],
        "keys":         [],
        "enemies":      [],
        "chasers":      [{"pos": [29, 16], "budget": 0.0}],
        "patrols":      [{"pos": [8, 16], "dir": [1, 0], "alerted": False, "budget": 0.0}],
        "lives":        3,
        "timer":        200,
    },
]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d["name"], data=d)
    for d in _LEVELS
]


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------

def _fill(frame, lx, ly, color, lw=1, lh=1):
    px, py = lx * 2, ly * 2
    frame[py:py + lh * 2, px:px + lw * 2] = color


def _draw_sprite(frame, lx, ly, pix):
    for row, prow in enumerate(pix):
        for col, color in enumerate(prow):
            if color != -1:
                px = (lx + col) * 2
                py = (ly + row) * 2
                if 0 <= px < 63 and 0 <= py < 63:
                    frame[py:py + 2, px:px + 2] = color


def _los_clear(m, x0, y0, x1, y1):
    """Bresenham walk from (x0,y0) to (x1,y1); returns True iff every cell
    visited (excluding source, including target) is OCEAN."""
    if x0 == x1 and y0 == y1:
        return True
    adx = abs(x1 - x0)
    ady = abs(y1 - y0)
    sx = 1 if x1 > x0 else -1
    sy = 1 if y1 > y0 else -1
    err = adx - ady
    x, y = x0, y0
    while True:
        if x == x1 and y == y1:
            return m[y, x] == OCEAN
        e2 = 2 * err
        if e2 > -ady:
            err -= ady
            x += sx
        if e2 < adx:
            err += adx
            y += sy
        if m[y, x] != OCEAN:
            return False


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

class PiDisplay(RenderableUserDisplay):
    def __init__(self, game: "Pi01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        m = g.game_map
        shore = g.shore_mask

        # ── Ocean ────────────────────────────────────────────────────────────
        frame[:, :] = OCEAN_C

        # ── Terrain ──────────────────────────────────────────────────────────
        for ly in range(GL):
            for lx in range(GL):
                cell = m[ly, lx]
                if cell == LAND:
                    _fill(frame, lx, ly, SHORE_C if shore[ly, lx] else LAND_C)
                elif cell == ROCK:
                    _fill(frame, lx, ly, ROCK_C)

        # ── Faction ports ─────────────────────────────────────────────────────
        for port in g.ports:
            lx, ly = port["lx"], port["ly"]
            if port["used"]:
                # Gray rubble — port exhausted
                _fill(frame, lx, ly, USED_PORT_C)
            else:
                # Active port: faction colour + small flag spike above
                color = port["color"]
                _fill(frame, lx, ly, color)
                flag_py = ly * 2 - 1
                flag_px = lx * 2 + 1
                if 0 <= flag_py < 64:
                    frame[flag_py, flag_px] = color

        # ── Switch ───────────────────────────────────────────────────────────
        if g.switch is not None:
            sx, sy = g.switch["pos"]
            sw_col = SWITCH_C if g.switch_state == 0 else SWITCH_ON_C
            _fill(frame, sx, sy, sw_col)
            frame[sy * 2 + 1, sx * 2 + 1] = 15   # white center dot

        # ── Treasures (normal + visible switch group) ─────────────────────
        for tx, ty in g.treasures:
            _fill(frame, tx, ty, TREASURE_C)
        visible_sw = g.switch_a if g.switch_state == 0 else g.switch_b
        for tx, ty in visible_sw:
            _fill(frame, tx, ty, TREASURE_C)

        # ── Orange locked chests (orange block, dark center = lock) ───────
        for tx, ty in g.orange_chests:
            _fill(frame, tx, ty, CHEST_ORANGE_C)
            frame[ty * 2 + 1, tx * 2 + 1] = 3

        # ── Red locked chests (red block, dark center = lock) ─────────────
        for tx, ty in g.red_chests:
            _fill(frame, tx, ty, CHEST_RED_C)
            frame[ty * 2 + 1, tx * 2 + 1] = 3

        # ── Keys (small center-pixel dot) ─────────────────────────────────
        for k in g.keys:
            kx, ky = k["pos"]
            kc = KEY_ORANGE_C if k["color"] == "orange" else KEY_RED_C
            frame[ky * 2 + 1, kx * 2 + 1] = kc

        # ── Enemy ships ──────────────────────────────────────────────────────
        for e in g.enemies:
            _fill(frame, int(e["pos"][0]), int(e["pos"][1]), ENEMY_C)

        # ── Chaser ships ─────────────────────────────────────────────────────
        for c in g.chasers:
            _fill(frame, int(c["pos"][0]), int(c["pos"][1]), CHASER_C)

        # ── Patrol ships: LoS ray first, then ship on top ────────────────────
        for p in g.patrols:
            px, py = int(p["pos"][0]), int(p["pos"][1])
            dx, dy = p["dir"]
            if not p["alerted"]:
                # Draw LoS as quarter-circle cone with wall occlusion
                perp_x, perp_y = -dy, dx
                for fwd in range(1, LOS_RANGE + 1):
                    for lat in range(-fwd, fwd + 1):
                        if fwd * fwd + lat * lat > LOS_RANGE * LOS_RANGE:
                            continue
                        cx = px + dx * fwd + perp_x * lat
                        cy = py + dy * fwd + perp_y * lat
                        if cx < 0 or cx >= GL or cy < 0 or cy >= GL:
                            continue
                        if not _los_clear(g.game_map, px, py, cx, cy):
                            continue
                        frame[cy * 2 + 1, cx * 2 + 1] = LOS_C
            _fill(frame, px, py, PATROL_C)

        # ── Player ship (blinks when invincible) ─────────────────────────────
        if not (g.invincible > 0 and g.invincible % 4 < 2):
            _draw_sprite(frame, g.sx, g.sy, SHIP_PIX)

        # ── HUD: lives (red squares, top-left) ───────────────────────────────
        for i in range(g.lives):
            frame[1:3, 1 + i * 5:1 + i * 5 + 3] = LIFE_C

        # ── HUD: continues (azure squares, bottom-left) ───────────────────
        for i in range(g.continues):
            frame[61:63, 1 + i * 5:1 + i * 5 + 3] = SWITCH_C

        # ── HUD: timer bar (bottom-right) ─────────────────────────────────
        if g.max_timer > 0:
            frac = max(0.0, g.timer / g.max_timer)
            bar_w = round(44 * frac)
            if frac > 0.5:
                timer_c = PROGRESS_C   # bright-yellow
            elif frac > 0.25:
                timer_c = 7            # orange
            else:
                timer_c = LIFE_C       # red
            frame[61:63, 20:64] = 1    # dark-blue background track
            if bar_w > 0:
                frame[61:63, 20:20 + bar_w] = timer_c


        # ── HUD: treasure progress (top strip) ───────────────────────────────
        d = _LEVELS[g.level_index]
        total = (len(d["treasures"]) + len(d.get("switch_a", [])) +
                 len(d.get("switch_b", [])) + len(d.get("orange_chests", [])) +
                 len(d.get("red_chests", [])))
        collected = total - (len(g.treasures) + len(g.switch_a) + len(g.switch_b) +
                             len(g.orange_chests) + len(g.red_chests))
        for i in range(min(total, 12)):   # cap at 12 dots to fit HUD
            frame[0:2, 24 + i * 5:24 + i * 5 + 3] = PROGRESS_C if i < collected else 1

        return frame


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Pi01(ARCBaseGame):
    def __init__(self):
        self.display = PiDisplay(self)

        self.sx = 2
        self.sy = 16
        self.ship_start  = (2, 16)
        self.game_map    = np.zeros((GL, GL), dtype=np.int8)
        self.shore_mask  = np.zeros((GL, GL), dtype=bool)
        self.ports       = []
        self.treasures   = []
        self.enemies     = []
        self.chasers        = []
        self.patrols        = []
        self.player_steps   = 0
        self.switch         = None
        self.switch_state   = 0
        self.switch_a       = []
        self.switch_b       = []
        self.orange_chests  = []
        self.red_chests     = []
        self.keys           = []
        self.has_orange_key = False
        self.has_red_key    = False
        self.on_switch      = False
        self.lives          = 3
        self.continues      = 3
        self.invincible     = 0
        self.timer          = 0
        self.max_timer      = 0

        super().__init__(
            "pi",
            levels,
            Camera(0, 0, 64, 64, 0, 0, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4],
        )

    # ── Level setup ──────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        d = _LEVELS[self.level_index]
        self.game_map    = d["map"]
        self.shore_mask  = d["shore"]
        self.ports       = [dict(p) for p in d["ports"]]   # fresh copy, used=False
        self.ship_start  = d["ship"]
        self.sx, self.sy = d["ship"]
        self.treasures   = list(d["treasures"])
        self.enemies     = [{"pos": list(e["pos"]), "dir": list(e["dir"])}
                            for e in d["enemies"]]
        self.chasers        = [{"pos": list(c["pos"]), "budget": 0.0}
                               for c in d.get("chasers", [])]
        self.patrols        = [{"pos": list(p["pos"]), "dir": list(p["dir"]),
                                "alerted": False, "budget": 0.0}
                               for p in d.get("patrols", [])]
        self.player_steps   = 0
        sw                  = d.get("switch")
        self.switch         = {"pos": list(sw["pos"])} if sw else None
        self.switch_state   = 0
        self.switch_a       = list(d.get("switch_a", []))
        self.switch_b       = list(d.get("switch_b", []))
        self.orange_chests  = list(d.get("orange_chests", []))
        self.red_chests     = list(d.get("red_chests", []))
        self.keys           = [dict(k) for k in d.get("keys", [])]
        self.has_orange_key = False
        self.has_red_key    = False
        self.on_switch      = False
        self.lives          = d["lives"]
        self.invincible     = 0
        self.timer          = d["timer"]
        self.max_timer      = d["timer"]

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _blocked(self, lx: int, ly: int) -> bool:
        for row in range(SHIP_LH):
            for col in range(SHIP_LW):
                cx, cy = lx + col, ly + row
                if cx < 0 or cx >= GL or cy < 0 or cy >= GL:
                    return True
                if self.game_map[cy, cx] != OCEAN:
                    return True
        return False

    def _ship_adjacent_to(self, px: int, py: int) -> bool:
        """True if any cell in the ship's footprint is orthogonally adjacent to (px, py)."""
        for row in range(SHIP_LH):
            for col in range(SHIP_LW):
                cx, cy = self.sx + col, self.sy + row
                if abs(cx - px) + abs(cy - py) == 1:
                    return True
        return False

    def _apply_port_effect(self, faction: str) -> None:
        effect, magnitude = PORT_EFFECT[faction]
        if effect == "life":
            self.lives = min(MAX_LIVES, self.lives + magnitude)
        elif effect == "invincible":
            self.invincible = max(self.invincible, magnitude)
        elif effect == "remove_enemy":
            for _ in range(magnitude):
                if not self.enemies:
                    break
                # Remove the enemy nearest to the ship
                nearest = min(
                    self.enemies,
                    key=lambda e: abs(e["pos"][0] - self.sx) + abs(e["pos"][1] - self.sy),
                )
                self.enemies.remove(nearest)

    def _check_ports(self) -> None:
        """Dock at any adjacent unused port and apply its effect."""
        for port in self.ports:
            if not port["used"] and self._ship_adjacent_to(port["lx"], port["ly"]):
                port["used"] = True
                self._apply_port_effect(port["faction"])

    def _move_enemies(self) -> None:
        m = self.game_map
        for e in self.enemies:
            ex, ey = int(e["pos"][0]), int(e["pos"][1])
            dx, dy = e["dir"]
            nx, ny = ex + dx, ey + dy
            if nx < 0 or nx >= GL or ny < 0 or ny >= GL or m[ny, nx] != OCEAN:
                dx, dy = -dx, -dy
                nx, ny = ex + dx, ey + dy
                if nx < 0 or nx >= GL or ny < 0 or ny >= GL or m[ny, nx] != OCEAN:
                    dx, dy = dy, dx
                    nx, ny = ex + dx, ey + dy
                    if nx < 0 or nx >= GL or ny < 0 or ny >= GL or m[ny, nx] != OCEAN:
                        nx, ny = ex, ey
            e["pos"] = [nx, ny]
            e["dir"] = [dx, dy]

    def _move_chasers(self) -> None:
        m = self.game_map
        for c in self.chasers:
            c["budget"] += 2.0 / 3.0
            steps = int(c["budget"])
            c["budget"] -= steps
            for _ in range(steps):
                cx, cy = int(c["pos"][0]), int(c["pos"][1])
                dx = self.sx - cx
                dy = self.sy - cy
                # Try primary axis (whichever has more distance), then secondary
                if abs(dx) >= abs(dy):
                    axes = [(1 if dx > 0 else -1, 0), (0, 1 if dy > 0 else -1)]
                else:
                    axes = [(0, 1 if dy > 0 else -1), (1 if dx > 0 else -1, 0)]
                for adx, ady in axes:
                    if adx == 0 and ady == 0:
                        continue
                    nx, ny = cx + adx, cy + ady
                    if 0 <= nx < GL and 0 <= ny < GL and m[ny, nx] == OCEAN:
                        c["pos"] = [nx, ny]
                        break

    def _move_patrols(self) -> None:
        m = self.game_map
        for p in self.patrols:
            px, py = int(p["pos"][0]), int(p["pos"][1])
            dx, dy = p["dir"]

            # Check quarter-circle cone of sight with wall occlusion
            if not p["alerted"]:
                perp_x, perp_y = -dy, dx
                detected = False
                for fwd in range(1, LOS_RANGE + 1):
                    if detected:
                        break
                    for lat in range(-fwd, fwd + 1):
                        if fwd * fwd + lat * lat > LOS_RANGE * LOS_RANGE:
                            continue
                        cx = px + dx * fwd + perp_x * lat
                        cy = py + dy * fwd + perp_y * lat
                        if cx < 0 or cx >= GL or cy < 0 or cy >= GL:
                            continue
                        if not _los_clear(m, px, py, cx, cy):
                            continue
                        if (self.sx <= cx < self.sx + SHIP_LW and
                                self.sy <= cy < self.sy + SHIP_LH):
                            p["alerted"] = True
                            detected = True
                            break

            # Budget: 1 tile/action whether alerted or patrolling
            p["budget"] += 1.0
            steps = int(p["budget"])
            p["budget"] -= steps

            for _ in range(steps):
                px, py = int(p["pos"][0]), int(p["pos"][1])
                if p["alerted"]:
                    # Greedy chase toward player
                    ddx = self.sx - px
                    ddy = self.sy - py
                    if abs(ddx) >= abs(ddy):
                        axes = [(1 if ddx > 0 else -1, 0), (0, 1 if ddy > 0 else -1)]
                    else:
                        axes = [(0, 1 if ddy > 0 else -1), (1 if ddx > 0 else -1, 0)]
                    for adx, ady in axes:
                        if adx == 0 and ady == 0:
                            continue
                        nx, ny = px + adx, py + ady
                        if 0 <= nx < GL and 0 <= ny < GL and m[ny, nx] == OCEAN:
                            p["pos"] = [nx, ny]
                            p["dir"] = [adx, ady]
                            break
                else:
                    # Bounce patrol
                    nx, ny = px + dx, py + dy
                    if nx < 0 or nx >= GL or ny < 0 or ny >= GL or m[ny, nx] != OCEAN:
                        dx, dy = -dx, -dy
                        nx, ny = px + dx, py + dy
                        if nx < 0 or nx >= GL or ny < 0 or ny >= GL or m[ny, nx] != OCEAN:
                            dx, dy = dy, dx
                            nx, ny = px + dx, py + dy
                            if nx < 0 or nx >= GL or ny < 0 or ny >= GL or m[ny, nx] != OCEAN:
                                nx, ny = px, py
                    p["pos"] = [nx, ny]
                    p["dir"] = [dx, dy]

    def _enemy_collision(self) -> bool:
        all_enemies = list(self.enemies) + list(self.chasers) + list(self.patrols)
        for e in all_enemies:
            ex, ey = int(e["pos"][0]), int(e["pos"][1])
            if (self.sx < ex + 1 and self.sx + SHIP_LW > ex and
                    self.sy < ey + 1 and self.sy + SHIP_LH > ey):
                return True
        return False

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value
        dx, dy = _DIR.get(aid, (0, 0))

        nx, ny = self.sx + dx, self.sy + dy
        if not self._blocked(nx, ny):
            self.sx, self.sy = nx, ny

        def _overlaps(tx, ty):
            return (self.sx <= tx < self.sx + SHIP_LW and
                    self.sy <= ty < self.sy + SHIP_LH)

        # Toggle switch (only fires on entry, not while standing still on it)
        on_sw_now = (self.switch is not None and
                     _overlaps(self.switch["pos"][0], self.switch["pos"][1]))
        if on_sw_now and not self.on_switch:
            self.switch_state = 1 - self.switch_state
        self.on_switch = on_sw_now

        # Collect normal treasures
        self.treasures = [(tx, ty) for tx, ty in self.treasures
                          if not _overlaps(tx, ty)]

        # Collect visible switch-group treasures
        if self.switch_state == 0:
            self.switch_a = [(tx, ty) for tx, ty in self.switch_a
                             if not _overlaps(tx, ty)]
        else:
            self.switch_b = [(tx, ty) for tx, ty in self.switch_b
                             if not _overlaps(tx, ty)]

        # Collect keys
        remaining_keys = []
        for k in self.keys:
            if _overlaps(k["pos"][0], k["pos"][1]):
                if k["color"] == "orange":
                    self.has_orange_key = True
                else:
                    self.has_red_key = True
            else:
                remaining_keys.append(k)
        self.keys = remaining_keys

        # Collect locked chests (only if holding the matching key)
        if self.has_orange_key:
            self.orange_chests = [(tx, ty) for tx, ty in self.orange_chests
                                  if not _overlaps(tx, ty)]
        if self.has_red_key:
            self.red_chests = [(tx, ty) for tx, ty in self.red_chests
                               if not _overlaps(tx, ty)]

        # Dock at adjacent ports
        self._check_ports()

        self.player_steps += 1

        # ── Timer tick ────────────────────────────────────────────────────────
        self.timer -= 1
        if self.timer <= 0:
            self.lives -= 1
            if self.lives <= 0:
                if self.continues > 0:
                    self.continues -= 1
                    self.on_set_level(self._levels[self.level_index])
                    self.lives = MAX_LIVES
                else:
                    self.lose()
            else:
                saved_lives = self.lives
                self.on_set_level(self._levels[self.level_index])
                self.lives = saved_lives
            self.complete_action()
            return

        self._move_enemies()
        self._move_chasers()
        self._move_patrols()

        if self.invincible == 0 and self._enemy_collision():
            self.lives -= 1
            self.invincible = 12
            if self.lives <= 0:
                if self.continues > 0:
                    self.continues -= 1
                    self.on_set_level(self._levels[self.level_index])
                    self.lives = MAX_LIVES
                else:
                    self.lose()
                self.complete_action()
                return

        if self.invincible > 0:
            self.invincible -= 1

        if (not self.treasures and not self.switch_a and not self.switch_b
                and not self.orange_chests and not self.red_chests):
            self.next_level()
            self.complete_action()
            return

        self.complete_action()
