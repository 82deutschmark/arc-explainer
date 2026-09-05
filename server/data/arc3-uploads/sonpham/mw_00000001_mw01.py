"""
mw01 – Medieval War  (ARC-AGI-3 game)

Controls
--------
ACTION6 (click): Select units, move, build barracks, spawn units, end turn

Goal: Conquer the medieval landscape across 4 unique levels.

L1 Rolling Plains  – Control 60% of the map (240 of 400 cells)
L2 Fortress Valley – Eliminate all enemy units
L3 River Crossing  – Hold the key location (9,9) for 10 consecutive turns
L4 The Keep        – Eliminate the enemy chief

Canvas: 64×64, grid 20×20 at 2px/cell at offset (2,6), panel x=44..63
"""

from collections import deque

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ── ARC3 colour palette ────────────────────────────────────────────────────────
WHITE  = 0
LGRAY  = 1
GRAY   = 2
DGRAY  = 3
VDGRAY = 4
BLACK  = 5
MAG    = 6
LMAG   = 7
RED    = 8
BLUE   = 9
LBLUE  = 10
YEL    = 11
ORG    = 12
MAR    = 13
GRN    = 14
PUR    = 15

# ── Canvas / Grid constants ────────────────────────────────────────────────────
CW = 64
CH = 64
GRID_X = 2      # grid top-left pixel x
GRID_Y = 6      # grid top-left pixel y
CELL   = 2      # pixels per cell
GW     = 20     # grid width in cells
GH     = 20     # grid height in cells
PANEL_X = 44    # panel starts at x=44 (20px wide)
HDR_H   = 6     # header height in pixels

# ── Terrain types ──────────────────────────────────────────────────────────────
T_EMPTY    = 0
T_FOREST   = 1
T_MOUNTAIN = 2
T_RIVER    = 3
T_BRIDGE   = 4
T_WALL     = 5

IMPASSABLE = {T_FOREST, T_MOUNTAIN, T_RIVER, T_WALL}

TERRAIN_COLOR = {
    T_FOREST:   GRN,
    T_MOUNTAIN: DGRAY,
    T_RIVER:    LBLUE,
    T_BRIDGE:   ORG,
    T_WALL:     VDGRAY,
}

TERRITORY_COLOR = {0: GRAY, 1: BLUE, 2: RED}

# ── Terrain builders ───────────────────────────────────────────────────────────

def _build_terrain_l1():
    t = {}
    for r in range(GH):
        t[(9, r)] = T_RIVER
    for br in [5, 10, 15]:
        t[(9, br)] = T_BRIDGE
    for pos in [(3,0),(4,0),(3,1),(4,1),(3,7),(4,7),(3,8),(4,8),
                (13,13),(14,13),(13,14),(14,14)]:
        t[pos] = T_FOREST
    return t


def _build_terrain_l2():
    t = {}
    for c in range(6, 14):
        for r in range(4, 6):
            t[(c, r)] = T_MOUNTAIN
    for c in range(5, 15):
        if c not in (9, 10):
            t[(c, 6)] = T_MOUNTAIN
    for c in range(4, 7):
        for r in range(7, 9):
            t[(c, r)] = T_MOUNTAIN
    for c in range(13, 16):
        for r in range(7, 9):
            t[(c, r)] = T_MOUNTAIN
    for c in range(5, 15):
        if c not in (9, 10):
            t[(c, 9)] = T_MOUNTAIN
    for c in range(6, 14):
        for r in range(10, 12):
            t[(c, r)] = T_MOUNTAIN
    return t


def _build_terrain_l3():
    t = {}
    for r in range(GH):
        t[(9, r)] = T_RIVER
    for br in [5, 10, 15]:
        t[(9, br)] = T_BRIDGE
    for c in range(0, 9):
        t[(c, 9)] = T_RIVER
    # (9,9) is already T_BRIDGE from above
    for pos in [(1,1),(2,1),(1,2),(2,2),(13,16),(14,16),(13,17),(14,17)]:
        t[pos] = T_FOREST
    return t


def _build_terrain_l4():
    t = {}
    for c in range(4, 16):
        t[(c, 0)] = T_WALL
    for c in range(4, 10):
        t[(c, 4)] = T_WALL
    for c in range(11, 16):
        t[(c, 4)] = T_WALL
    for pos in [(4,1),(4,2),(4,3),(15,1),(15,2),(15,3)]:
        t[pos] = T_WALL
    for pos in [(9,5),(9,6),(10,5),(10,6)]:
        t[pos] = T_FOREST
    for pos in [(4,7),(5,7),(4,8),(5,8),(14,7),(15,7),(14,8),(15,8)]:
        t[pos] = T_MOUNTAIN
    return t


_LEVEL_TERRAIN_FN = [_build_terrain_l1, _build_terrain_l2, _build_terrain_l3, _build_terrain_l4]
_LEVEL_NAMES = ["Rolling Plains", "Fortress Valley", "River Crossing", "The Keep"]


# ── Unit / barrack factories ───────────────────────────────────────────────────

def _unit(side, utype, number, x, y):
    return {'side': side, 'type': utype, 'number': number,
            'x': x, 'y': y, 'moved': False, 'ready': True}


def _barrack(side, x, y, built_by):
    return {'side': side, 'x': x, 'y': y, 'built_by': built_by}


# ── Initial states ─────────────────────────────────────────────────────────────

def _player_start_units():
    return [
        _unit('player', 'chief',   20, 0, 19),
        _unit('player', 'regular', 10, 1, 19),
        _unit('player', 'regular', 10, 0, 18),
        _unit('player', 'regular', 10, 1, 18),
        _unit('player', 'regular', 10, 2, 19),
        _unit('player', 'regular', 10, 0, 17),
    ]


def _base_territory():
    t = {}
    for c in range(GW):
        for r in range(GH):
            t[(c, r)] = 0
    for pos in [(0,19),(1,19),(0,18),(1,18),(2,19),(0,17)]:
        t[pos] = 1
    return t


def _l1_state():
    units = _player_start_units() + [
        _unit('enemy', 'chief',   20, 19, 0),
        _unit('enemy', 'regular', 10, 18, 0),
        _unit('enemy', 'regular', 10, 19, 1),
        _unit('enemy', 'regular', 10, 18, 1),
        _unit('enemy', 'regular', 10, 17, 0),
        _unit('enemy', 'regular', 10, 19, 2),
    ]
    terr = _base_territory()
    for pos in [(19,0),(18,0),(19,1),(18,1),(17,0),(19,2)]:
        terr[pos] = 2
    return units, terr, []


def _l2_state():
    units = _player_start_units() + [
        _unit('enemy', 'chief',   20, 19, 0),
        _unit('enemy', 'regular', 10, 14, 0),
        _unit('enemy', 'regular', 10, 15, 0),
        _unit('enemy', 'regular', 10, 16, 0),
        _unit('enemy', 'regular', 10, 17, 0),
        _unit('enemy', 'regular', 10, 18, 0),
        _unit('enemy', 'regular', 10, 14, 1),
        _unit('enemy', 'regular', 10, 15, 1),
        _unit('enemy', 'regular', 10, 16, 1),
        _unit('enemy', 'regular', 10, 17, 1),
        _unit('enemy', 'regular', 10, 18, 1),
    ]
    terr = _base_territory()
    for pos in [(19,0),(14,0),(15,0),(16,0),(17,0),(18,0),
                (14,1),(15,1),(16,1),(17,1),(18,1)]:
        terr[pos] = 2
    return units, terr, []


def _l3_state():
    units = _player_start_units() + [
        _unit('enemy', 'chief',   20, 19, 0),
        _unit('enemy', 'regular', 10, 18, 0),
        _unit('enemy', 'regular', 10, 19, 1),
        _unit('enemy', 'regular', 10, 18, 1),
        _unit('enemy', 'regular', 10, 17, 0),
        _unit('enemy', 'regular', 10, 19, 2),
    ]
    terr = _base_territory()
    for pos in [(19,0),(18,0),(19,1),(18,1),(17,0),(19,2)]:
        terr[pos] = 2
    return units, terr, []


def _l4_state():
    units = _player_start_units() + [
        _unit('enemy', 'chief',   50, 10, 2),
        _unit('enemy', 'regular', 10, 10, 4),
        _unit('enemy', 'regular', 10,  9, 5),
        _unit('enemy', 'regular', 10, 11, 5),
        _unit('enemy', 'regular', 10,  8, 7),
        _unit('enemy', 'regular', 10, 12, 7),
    ]
    terr = _base_territory()
    for pos in [(10,2),(10,4),(9,5),(11,5),(8,7),(12,7)]:
        terr[pos] = 2
    return units, terr, []


_LEVEL_STATE_FN = [_l1_state, _l2_state, _l3_state, _l4_state]

levels = [
    Level(sprites=[], grid_size=(CW, CH), name=_LEVEL_NAMES[i], data={})
    for i in range(4)
]


# ── BFS helpers ────────────────────────────────────────────────────────────────

_DIRS = [(0, -1), (0, 1), (-1, 0), (1, 0)]


def _bfs_next_step(sx, sy, tx, ty, terrain, blocked_set):
    """One BFS step toward (tx,ty), returns first (nx,ny) or None."""
    if sx == tx and sy == ty:
        return None
    visited = {(sx, sy)}
    queue = deque([(sx, sy, None)])
    while queue:
        cx, cy, first = queue.popleft()
        for dx, dy in _DIRS:
            nx, ny = cx + dx, cy + dy
            if not (0 <= nx < GW and 0 <= ny < GH):
                continue
            if (nx, ny) in visited:
                continue
            if terrain.get((nx, ny), T_EMPTY) in IMPASSABLE:
                continue
            if (nx, ny) in blocked_set:
                continue
            step = first if first is not None else (nx, ny)
            if nx == tx and ny == ty:
                return step
            visited.add((nx, ny))
            queue.append((nx, ny, step))
    return None


def _bfs_nearest_neutral(sx, sy, terrain, territory):
    """BFS to nearest neutral (territory==0) cell, returns (tx,ty) or None."""
    visited = {(sx, sy)}
    queue = deque([(sx, sy)])
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in _DIRS:
            nx, ny = cx + dx, cy + dy
            if not (0 <= nx < GW and 0 <= ny < GH):
                continue
            if (nx, ny) in visited:
                continue
            if terrain.get((nx, ny), T_EMPTY) in IMPASSABLE:
                continue
            visited.add((nx, ny))
            if territory.get((nx, ny), 0) == 0:
                return (nx, ny)
            queue.append((nx, ny))
    return None


# ── Minimal pixel helpers ──────────────────────────────────────────────────────

def _px(frame, x, y, c):
    """Set a single pixel if in bounds."""
    if 0 <= x < CW and 0 <= y < CH:
        frame[y, x] = c


def _rect(frame, x, y, w, h, c):
    """Fill a rectangle."""
    x0, x1 = max(0, x), min(CW, x + w)
    y0, y1 = max(0, y), min(CH, y + h)
    if x0 < x1 and y0 < y1:
        frame[y0:y1, x0:x1] = c


def _hline(frame, x, y, w, c):
    for i in range(w):
        _px(frame, x + i, y, c)


def _vline(frame, x, y, h, c):
    for i in range(h):
        _px(frame, x, y + i, c)


# ── Tiny 3×3 digit font (for unit numbers in 2px cells) ───────────────────────
# We draw numbers at 1px scale in the panel; cells are only 2x2 so no room
# for numbers in-cell. Numbers shown in panel instead.

# 3×5 font for panel labels
_FONT = {
    '0': [0b111,0b101,0b101,0b101,0b111],
    '1': [0b010,0b110,0b010,0b010,0b111],
    '2': [0b111,0b001,0b111,0b100,0b111],
    '3': [0b111,0b001,0b111,0b001,0b111],
    '4': [0b101,0b101,0b111,0b001,0b001],
    '5': [0b111,0b100,0b111,0b001,0b111],
    '6': [0b111,0b100,0b111,0b101,0b111],
    '7': [0b111,0b001,0b001,0b001,0b001],
    '8': [0b111,0b101,0b111,0b101,0b111],
    '9': [0b111,0b101,0b111,0b001,0b111],
    'A': [0b010,0b101,0b111,0b101,0b101],
    'B': [0b110,0b101,0b110,0b101,0b110],
    'C': [0b111,0b100,0b100,0b100,0b111],
    'D': [0b110,0b101,0b101,0b101,0b110],
    'E': [0b111,0b100,0b111,0b100,0b111],
    'F': [0b111,0b100,0b111,0b100,0b100],
    'G': [0b111,0b100,0b101,0b101,0b111],
    'H': [0b101,0b101,0b111,0b101,0b101],
    'I': [0b111,0b010,0b010,0b010,0b111],
    'J': [0b001,0b001,0b001,0b101,0b111],
    'K': [0b101,0b101,0b110,0b101,0b101],
    'L': [0b100,0b100,0b100,0b100,0b111],
    'M': [0b101,0b111,0b111,0b101,0b101],
    'N': [0b101,0b111,0b111,0b111,0b101],
    'O': [0b111,0b101,0b101,0b101,0b111],
    'P': [0b111,0b101,0b111,0b100,0b100],
    'Q': [0b111,0b101,0b101,0b111,0b001],
    'R': [0b110,0b101,0b110,0b101,0b101],
    'S': [0b111,0b100,0b111,0b001,0b111],
    'T': [0b111,0b010,0b010,0b010,0b010],
    'U': [0b101,0b101,0b101,0b101,0b111],
    'V': [0b101,0b101,0b101,0b101,0b010],
    'W': [0b101,0b101,0b111,0b111,0b101],
    'X': [0b101,0b101,0b010,0b101,0b101],
    'Y': [0b101,0b101,0b010,0b010,0b010],
    'Z': [0b111,0b001,0b010,0b100,0b111],
    ' ': [0b000,0b000,0b000,0b000,0b000],
    '/': [0b001,0b001,0b010,0b100,0b100],
    '%': [0b101,0b001,0b010,0b100,0b101],
    '+': [0b000,0b010,0b111,0b010,0b000],
    '-': [0b000,0b000,0b111,0b000,0b000],
    ':': [0b000,0b010,0b000,0b010,0b000],
}


def _text(frame, x, y, text, color):
    """Draw text with 3×5 pixel font."""
    cx = x
    for ch in str(text).upper():
        rows = _FONT.get(ch, _FONT[' '])
        for ry, bits in enumerate(rows):
            for b in range(3):
                if bits & (1 << (2 - b)):
                    _px(frame, cx + b, y + ry, color)
        cx += 4


# ── Unit colour (strength-encoded) ────────────────────────────────────────────

def _unit_color(unit):
    """Return ARC3 colour for a unit, encoding strength as brightness."""
    side, utype, n = unit['side'], unit['type'], unit['number']
    if side == 'player':
        if utype == 'chief':
            return YEL                          # chief always yellow
        # regular: LGRAY → WHITE → LBLUE (weak → strong)
        if n <= 7:   return LGRAY
        elif n <= 14: return WHITE
        else:         return LBLUE
    else:  # enemy
        if utype == 'chief':
            return LMAG                         # enemy chief: light magenta
        # regular: DGRAY → ORG → RED (weak → strong, all visible on red territory)
        if n <= 7:   return DGRAY
        elif n <= 14: return ORG
        else:         return LMAG


# ── Display ────────────────────────────────────────────────────────────────────

class Mw01Display(RenderableUserDisplay):
    def __init__(self, game: "Mw01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        frame[:, :] = BLACK

        # ── Header (y=0..5) ───────────────────────────────────────────────────
        frame[0:HDR_H, :] = BLACK
        _text(frame, 1, 1, "L" + str(g.level_index + 1), WHITE)
        _text(frame, 9, 1, "T" + str(g.turn), LGRAY)
        # Phase indicator
        if g.phase == 'player':
            _text(frame, 21, 1, "YOU", BLUE)
        else:
            _text(frame, 21, 1, "ENM", RED)

        # ── Grid (20x20 cells at 2px each) ────────────────────────────────────
        for gy in range(GH):
            for gx in range(GW):
                self._draw_cell(frame, g, gx, gy)

        # ── Panel (x=44..63) ──────────────────────────────────────────────────
        frame[:, PANEL_X:CW] = BLACK
        self._draw_panel(frame, g)

        return frame

    def _draw_cell(self, frame, g, gx, gy):
        px = GRID_X + gx * CELL
        py = GRID_Y + gy * CELL

        # Territory base
        terr = g.territory.get((gx, gy), 0)
        base_c = TERRITORY_COLOR[terr]
        frame[py:py+CELL, px:px+CELL] = base_c

        # Terrain overlay (top pixel of the 2x2 cell)
        terrain_t = g.terrain.get((gx, gy), T_EMPTY)
        if terrain_t != T_EMPTY:
            tc = TERRAIN_COLOR[terrain_t]
            frame[py:py+CELL, px:px+CELL] = tc

        # Key location (level 3): purple marker when no unit
        if g.level_index == 2 and gx == 9 and gy == 9:
            if g._unit_at(gx, gy) is None:
                _px(frame, px, py, PUR)
                _px(frame, px+1, py, PUR)
                _px(frame, px, py+1, PUR)
                _px(frame, px+1, py+1, PUR)

        # Barrack: bright green top-left pixel
        for bar in g.barracks:
            if bar['x'] == gx and bar['y'] == gy:
                _px(frame, px, py, GRN)
                break

        # Unit: strength-encoded colour (always visible against territory)
        unit = g._unit_at(gx, gy)
        if unit is not None:
            frame[py:py+CELL, px:px+CELL] = _unit_color(unit)

        # Selected unit: WHITE top-left pixel as indicator
        if g.selected_unit is not None:
            su = g.selected_unit
            if su['x'] == gx and su['y'] == gy:
                _px(frame, px, py, WHITE)

        # Valid move: WHITE top-left corner pixel
        if (gx, gy) in g.valid_moves:
            _px(frame, px, py, WHITE)

        # Selected cell: white dot
        if g.selected_cell is not None and g.selected_cell == (gx, gy):
            _px(frame, px+1, py+1, WHITE)

    def _draw_panel(self, frame, g):
        px = PANEL_X + 1

        # ── Stats ─────────────────────────────────────────────────────────────
        _text(frame, px, 1, "G", YEL)
        _text(frame, px + 4, 1, str(g.gold), YEL)

        p_reg = sum(1 for u in g.units if u['side'] == 'player' and u['type'] == 'regular')
        _text(frame, px, 7, "U", BLUE)
        _text(frame, px + 4, 7, str(p_reg), BLUE)

        p_bars = sum(1 for b in g.barracks if b['side'] == 'player')
        _text(frame, px, 13, "B", GRN)
        _text(frame, px + 4, 13, str(p_bars), GRN)

        # ── Selected unit number (prominent display) ───────────────────────────
        sel = g.selected_unit
        if sel is not None:
            uc = _unit_color(sel)
            _rect(frame, PANEL_X, 19, 3, 5, uc)       # colour swatch
            _text(frame, px + 3, 19, str(sel['number']), WHITE)
        else:
            # Show player chief number when nothing selected
            chief = next((u for u in g.units
                          if u['side'] == 'player' and u['type'] == 'chief'), None)
            if chief is not None:
                _rect(frame, PANEL_X, 19, 3, 5, YEL)
                _text(frame, px + 3, 19, str(chief['number']), WHITE)

        # ── Buttons ───────────────────────────────────────────────────────────
        end_c = GRN if g.phase == 'player' else DGRAY
        _rect(frame, PANEL_X, 26, 20, 6, end_c)
        _text(frame, px, 27, "END", BLACK)

        if g._can_show_bld():
            _rect(frame, PANEL_X, 33, 20, 6, BLUE)
            _text(frame, px, 34, "BLD", BLACK)

        if g._can_show_spn():
            _rect(frame, PANEL_X, 40, 20, 6, ORG)
            _text(frame, px, 41, "SPN", BLACK)

        if g._can_show_sel():
            _rect(frame, PANEL_X, 47, 20, 6, RED)
            _text(frame, px, 48, "SEL", BLACK)

        # ── Progress ──────────────────────────────────────────────────────────
        self._draw_progress(frame, g, px)

        # ── Mini unit roster (bottom strip y=55..63) ───────────────────────────
        # Show first 4 player units (chief first) as colour block + number
        player_units = sorted(
            (u for u in g.units if u['side'] == 'player'),
            key=lambda u: (0 if u['type'] == 'chief' else 1, -u['number'])
        )
        for i, u in enumerate(player_units[:4]):
            ry = 55 + (i // 2) * 5
            rx = PANEL_X + (i % 2) * 10
            _rect(frame, rx, ry, 2, 2, _unit_color(u))
            _text(frame, rx + 2, ry, str(u['number']), LGRAY)

    def _draw_progress(self, frame, g, px):
        y = 55
        if g.level_index == 0:
            owned = sum(1 for v in g.territory.values() if v == 1)
            pct = (owned * 100) // 400
            _text(frame, px, y, str(pct) + "%", GRN if pct >= 60 else LGRAY)
        elif g.level_index == 1:
            e_count = sum(1 for u in g.units if u['side'] == 'enemy')
            _text(frame, px, y, "E" + str(e_count), RED if e_count > 0 else GRN)
        elif g.level_index == 2:
            _text(frame, px, y, str(g.hold_counter), GRN if g.hold_counter >= 10 else LGRAY)
        elif g.level_index == 3:
            chief = next((u for u in g.units
                          if u['side'] == 'enemy' and u['type'] == 'chief'), None)
            hp = chief['number'] if chief else 0
            _text(frame, px, y, str(hp), RED if hp > 0 else GRN)


# ── Game class ─────────────────────────────────────────────────────────────────

class Mw01(ARCBaseGame):
    def __init__(self):
        self.display = Mw01Display(self)

        # Mutable state (reset in on_set_level)
        self.units         = []
        self.territory     = {}
        self.barracks      = []
        self.terrain       = {}
        self.gold          = 100
        self.turn          = 1
        self.phase         = 'player'
        self.selected_unit = None
        self.valid_moves   = set()
        self.selected_cell = None
        self.hold_counter  = 0

        super().__init__(
            "mw",
            levels,
            Camera(0, 0, CW, CH, BLACK, BLACK, [self.display]),
            False,
            len(levels),
            [6],
        )

    # ── Level setup ────────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        idx = self.level_index
        self.terrain       = _LEVEL_TERRAIN_FN[idx]()
        units, terr, bars  = _LEVEL_STATE_FN[idx]()
        self.units         = units
        self.territory     = terr
        self.barracks      = bars
        self.gold          = 100
        self.turn          = 1
        self.phase         = 'player'
        self.selected_unit = None
        self.valid_moves   = set()
        self.selected_cell = None
        self.hold_counter  = 0

    # ── Lookup helpers ─────────────────────────────────────────────────────────

    def _unit_at(self, x, y):
        for u in self.units:
            if u['x'] == x and u['y'] == y:
                return u
        return None

    def _barrack_at(self, x, y):
        for b in self.barracks:
            if b['x'] == x and b['y'] == y:
                return b
        return None

    def _player_max_units(self):
        captured = sum(1 for b in self.barracks
                       if b['side'] == 'player' and b['built_by'] == 'enemy')
        return 15 + captured

    def _player_regular_count(self):
        return sum(1 for u in self.units
                   if u['side'] == 'player' and u['type'] == 'regular')

    def _player_built_count(self):
        return sum(1 for b in self.barracks
                   if b['side'] == 'player' and b['built_by'] == 'player')

    def _count_player_owned(self):
        return sum(1 for v in self.territory.values() if v == 1)

    # ── Win / lose checks ──────────────────────────────────────────────────────

    def _check_win(self):
        if self.level_index == 0:
            return self._count_player_owned() >= 240
        elif self.level_index == 1:
            return not any(u for u in self.units if u['side'] == 'enemy')
        elif self.level_index == 2:
            return self.hold_counter >= 10
        elif self.level_index == 3:
            return not any(u for u in self.units
                           if u['side'] == 'enemy' and u['type'] == 'chief')
        return False

    def _check_lose(self):
        return not any(u for u in self.units
                       if u['side'] == 'player' and u['type'] == 'chief')

    # ── Movement / combat ──────────────────────────────────────────────────────

    def _compute_valid_moves(self, unit):
        moves = set()
        for dx, dy in _DIRS:
            nx, ny = unit['x'] + dx, unit['y'] + dy
            if not (0 <= nx < GW and 0 <= ny < GH):
                continue
            if self.terrain.get((nx, ny), T_EMPTY) in IMPASSABLE:
                continue
            other = self._unit_at(nx, ny)
            if other is not None and other['side'] == unit['side']:
                continue
            moves.add((nx, ny))
        return moves

    def _do_combat(self, attacker, defender):
        loss = defender['number']
        attacker['number'] = max(1, attacker['number'] - loss)
        self.units = [u for u in self.units if u is not defender]

    def _claim_territory(self, unit, tx, ty):
        self.territory[(tx, ty)] = 1 if unit['side'] == 'player' else 2

    def _move_unit(self, unit, tx, ty):
        """Move unit to (tx,ty): resolve combat if enemy present, claim territory."""
        defender = self._unit_at(tx, ty)
        if defender is not None and defender['side'] != unit['side']:
            bar = self._barrack_at(tx, ty)
            if bar is not None:
                if unit['side'] == 'player':
                    bar['side'] = 'player'
                else:
                    if self.level_index == 1:
                        self.barracks = [b for b in self.barracks if b is not bar]
                    else:
                        bar['side'] = 'enemy'
            self._do_combat(unit, defender)
        unit['x'] = tx
        unit['y'] = ty
        unit['moved'] = True
        self._claim_territory(unit, tx, ty)

    # ── Button visibility ──────────────────────────────────────────────────────

    def _can_show_bld(self):
        if self.phase != 'player' or self.selected_cell is None:
            return False
        sc = self.selected_cell
        if self.territory.get(sc, 0) != 1:
            return False
        if self.terrain.get(sc, T_EMPTY) in IMPASSABLE:
            return False
        if self._unit_at(sc[0], sc[1]) is not None:
            return False
        if self._barrack_at(sc[0], sc[1]) is not None:
            return False
        if self.gold < 50:
            return False
        if self._player_built_count() >= 3:
            return False
        return True

    def _can_show_spn(self):
        if self.phase != 'player' or self.selected_cell is None:
            return False
        sc = self.selected_cell
        bar = self._barrack_at(sc[0], sc[1])
        if bar is None or bar['side'] != 'player':
            return False
        if self._unit_at(sc[0], sc[1]) is not None:
            return False
        if self.gold < 20:
            return False
        if self._player_regular_count() >= self._player_max_units():
            return False
        return True

    def _can_show_sel(self):
        if self.phase != 'player' or self.selected_cell is None:
            return False
        sc = self.selected_cell
        bar = self._barrack_at(sc[0], sc[1])
        return bar is not None and bar['side'] == 'player'

    # ── Enemy AI ───────────────────────────────────────────────────────────────

    def _enemy_turn(self):
        enemy_units = [u for u in self.units if u['side'] == 'enemy']

        player_chief = next((u for u in self.units
                             if u['side'] == 'player' and u['type'] == 'chief'), None)
        pchief_x = player_chief['x'] if player_chief else 0
        pchief_y = player_chief['y'] if player_chief else 19

        for unit in enemy_units:
            if unit not in self.units:
                continue  # eliminated mid-turn

            # Level 4: enemy chief is stationary, attacks adjacent player units
            if self.level_index == 3 and unit['type'] == 'chief':
                self._l4_chief_attack(unit)
                continue

            # Priority: attack adjacent player unit
            attacked = False
            for dx, dy in _DIRS:
                nx, ny = unit['x'] + dx, unit['y'] + dy
                if not (0 <= nx < GW and 0 <= ny < GH):
                    continue
                target = self._unit_at(nx, ny)
                if target is not None and target['side'] == 'player':
                    self._move_unit(unit, nx, ny)
                    attacked = True
                    break
            if attacked:
                continue

            # Move based on level AI
            friendly = {(u2['x'], u2['y']) for u2 in self.units
                        if u2['side'] == 'enemy' and u2 is not unit}

            if self.level_index == 0:
                target = _bfs_nearest_neutral(unit['x'], unit['y'],
                                               self.terrain, self.territory)
                if target is not None:
                    step = _bfs_next_step(unit['x'], unit['y'],
                                          target[0], target[1],
                                          self.terrain, friendly)
                    if step is not None:
                        tx, ty = step
                        other = self._unit_at(tx, ty)
                        if other is None or other['side'] == 'player':
                            self._move_unit(unit, tx, ty)

            elif self.level_index in (1, 2):
                step = _bfs_next_step(unit['x'], unit['y'],
                                      pchief_x, pchief_y,
                                      self.terrain, friendly)
                if step is not None:
                    tx, ty = step
                    other = self._unit_at(tx, ty)
                    if other is None or other['side'] == 'player':
                        self._move_unit(unit, tx, ty)

            elif self.level_index == 3:
                step = _bfs_next_step(unit['x'], unit['y'],
                                      10, 3,
                                      self.terrain, friendly)
                if step is not None:
                    tx, ty = step
                    other = self._unit_at(tx, ty)
                    if other is None or other['side'] == 'player':
                        self._move_unit(unit, tx, ty)

    def _l4_chief_attack(self, chief):
        """Stationary chief attacks all adjacent player units (chief initiates)."""
        for dx, dy in _DIRS:
            nx, ny = chief['x'] + dx, chief['y'] + dy
            if not (0 <= nx < GW and 0 <= ny < GH):
                continue
            target = self._unit_at(nx, ny)
            if target is not None and target['side'] == 'player':
                loss = target['number']
                chief['number'] = max(1, chief['number'] - loss)
                self.units = [u for u in self.units if u is not target]

    # ── End-of-turn ────────────────────────────────────────────────────────────

    def _end_of_turn(self):
        # Double numbers
        for u in self.units:
            if self.level_index == 3 and u['side'] == 'enemy' and u['type'] == 'chief':
                u['number'] += 5  # no cap, no double
            elif u['type'] == 'regular':
                u['number'] = min(20, u['number'] * 2)
            elif u['type'] == 'chief':
                u['number'] = min(30, u['number'] * 2)

        # Reset moved; newly spawned units (ready=False) become ready
        for u in self.units:
            u['moved'] = False
            if not u['ready']:
                u['ready'] = True

        # Gold income
        self.gold = min(100, self.gold + 30 + 5 * self._count_player_owned())

        # Level 3 hold counter
        if self.level_index == 2:
            key_unit = self._unit_at(9, 9)
            if key_unit is not None and key_unit['side'] == 'player':
                self.hold_counter += 1
            else:
                self.hold_counter = 0

        self.turn += 1

    # ── Player actions ─────────────────────────────────────────────────────────

    def _do_end_turn(self):
        """End player turn, run enemy, end-of-turn. Returns (win, lose)."""
        self.selected_unit = None
        self.valid_moves   = set()
        self.selected_cell = None
        self.phase = 'enemy'

        self._enemy_turn()
        if self._check_lose():
            return False, True

        self._end_of_turn()

        if self._check_win():
            return True, False
        if self._check_lose():
            return False, True

        self.phase = 'player'
        return False, False

    def _do_build(self):
        if not self._can_show_bld():
            return
        sc = self.selected_cell
        self.gold -= 50
        self.barracks.append(_barrack('player', sc[0], sc[1], 'player'))
        self.selected_cell = None

    def _do_spawn(self):
        if not self._can_show_spn():
            return
        sc = self.selected_cell
        self.gold -= 20
        nu = _unit('player', 'regular', 10, sc[0], sc[1])
        nu['ready'] = False
        nu['moved'] = True
        self.units.append(nu)
        self._claim_territory(nu, sc[0], sc[1])
        self.selected_cell = None

    def _do_sell(self):
        if not self._can_show_sel():
            return
        sc = self.selected_cell
        bar = self._barrack_at(sc[0], sc[1])
        if bar is not None:
            self.barracks = [b for b in self.barracks if b is not bar]
            self.gold = min(100, self.gold + 20)
        self.selected_cell = None

    # ── Click dispatch ─────────────────────────────────────────────────────────

    def _handle_click(self, px, py):
        """Returns (win, lose)."""
        if px >= PANEL_X:
            return self._handle_panel_click(px, py)
        if self.phase != 'player':
            return False, False
        if px < GRID_X or py < GRID_Y:
            return False, False
        gx = (px - GRID_X) // CELL
        gy = (py - GRID_Y) // CELL
        if not (0 <= gx < GW and 0 <= gy < GH):
            return False, False
        return self._handle_grid_click(gx, gy)

    def _handle_panel_click(self, px, py):
        if self.phase != 'player':
            return False, False

        # END button y=26..31
        if 26 <= py <= 31 and px >= PANEL_X:
            return self._do_end_turn()

        # BLD button y=33..38
        if 33 <= py <= 38 and px >= PANEL_X:
            self._do_build()
            return False, False

        # SPN button y=40..45
        if 40 <= py <= 45 and px >= PANEL_X:
            self._do_spawn()
            return False, False

        # SEL button y=47..52
        if 47 <= py <= 52 and px >= PANEL_X:
            self._do_sell()
            return False, False

        return False, False

    def _handle_grid_click(self, gx, gy):
        if self.selected_unit is not None:
            su = self.selected_unit

            if su['x'] == gx and su['y'] == gy:
                # Deselect
                self.selected_unit = None
                self.valid_moves   = set()
                return False, False

            if (gx, gy) in self.valid_moves:
                # Execute move
                self._move_unit(su, gx, gy)
                self.selected_unit = None
                self.valid_moves   = set()
                self.selected_cell = None
                if self._check_lose():
                    return False, True
                if self._check_win():
                    return True, False
                return False, False

            # Click elsewhere: deselect
            self.selected_unit = None
            self.valid_moves   = set()
            self.selected_cell = None

        # Try to select unit or cell
        unit = self._unit_at(gx, gy)
        if (unit is not None and unit['side'] == 'player'
                and unit['ready'] and not unit['moved']):
            self.selected_unit = unit
            self.valid_moves   = self._compute_valid_moves(unit)
            self.selected_cell = None
        else:
            self.selected_cell = (gx, gy)

        return False, False

    # ── Step ───────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value

        if aid != 6:
            self.complete_action()
            return

        data = self.action.data
        if not data or 'x' not in data or 'y' not in data:
            self.complete_action()
            return

        px = int(data['x'])
        py = int(data['y'])
        win_t, lose_t = self._handle_click(px, py)

        if lose_t:
            self.lose()
            self.complete_action()
            return

        if win_t:
            if not self.is_last_level():
                self.next_level()
            else:
                self.win()
            self.complete_action()
            return

        self.complete_action()
