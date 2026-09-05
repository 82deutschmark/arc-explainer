"""
mr01 – Medieval War RT  (ARC-AGI-3 real-time game)

Controls
--------
ACTION6 (click): Select a player unit → click any passable destination to
                 queue its movement path.  Click TICK in the panel to
                 manually advance one step (useful without live mode).
                 Click BLD / SPN / SEL as in the turn-based version.
ACTION7 (tick):  Real-time advance — auto-fired at 10 FPS in live mode.

Live mode
---------
Press Shift+Enter to start in live mode.  Each ACT7 tick:
  • Every unit with a queued path advances one cell toward its destination.
  • Enemy units continuously re-path toward their AI objectives.
  • Gold ticks up; unit strength regenerates; L3 hold counter increments.

Path preview
------------
After clicking a destination, the planned route is highlighted in yellow
(intermediate cells) / orange (destination) for ~0.8 s before the unit
begins to move.  Click elsewhere before the preview ends to cancel.

Goal: Conquer the medieval landscape across 4 unique levels.
  L1 Rolling Plains  – Control 60 % of the map (240 / 400 cells)
  L2 Fortress Valley – Eliminate all enemy units
  L3 River Crossing  – Hold (9,9) for 10 hold-periods (≈ 30 s)
  L4 The Keep        – Eliminate the enemy chief

Canvas: 64×64, grid 20×20 at 2 px/cell at offset (2,6), panel x=44..63
"""

from collections import deque

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ── ARC3 colour palette ────────────────────────────────────────────────────────
WHITE  = 0;  LGRAY = 1;  GRAY  = 2;  DGRAY = 3;  VDGRAY = 4
BLACK  = 5;  MAG   = 6;  LMAG  = 7;  RED   = 8;  BLUE   = 9
LBLUE  = 10; YEL   = 11; ORG   = 12; MAR   = 13; GRN    = 14; PUR = 15

# ── Canvas / Grid constants ────────────────────────────────────────────────────
CW = 64;  CH = 64
GRID_X = 2;  GRID_Y = 6;  CELL = 2
GW = 20;  GH = 20
PANEL_X = 44;  HDR_H = 6

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

# ── RT timing constants ────────────────────────────────────────────────────────
MOVE_SPEED_BASE      = 4   # ticks between steps at base move-range
PATH_PREVIEW_TICKS   = 8   # ticks to display path before unit starts moving
INCOME_INTERVAL      = 30  # ticks between gold income  (~3 s at 10 FPS)
STRENGTH_INTERVAL    = 60  # ticks between strength gain (~6 s at 10 FPS)
ENEMY_AI_INTERVAL    = 15  # ticks between enemy re-pathing
L3_HOLD_INTERVAL     = 30  # ticks per hold-counter increment (10 needed ≈ 30 s)
L4_CHIEF_ATK_IVL     = 25  # ticks between L4 chief AoE attacks

# ── Directions ────────────────────────────────────────────────────────────────
_DIRS = [(0, -1), (0, 1), (-1, 0), (1, 0)]


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


_LEVEL_TERRAIN_FN = [_build_terrain_l1, _build_terrain_l2,
                     _build_terrain_l3, _build_terrain_l4]
_LEVEL_NAMES = ["Rolling Plains", "Fortress Valley", "River Crossing", "The Keep"]


# ── Unit / barrack factories ───────────────────────────────────────────────────

def _unit(side, utype, number, x, y):
    return {
        'side': side, 'type': utype, 'number': number,
        'x': x, 'y': y,
        'path': [],          # queued movement cells
        'move_timer': 0,     # ticks until next step
        'path_preview': 0,   # ticks remaining in preview phase
    }


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
    if 0 <= x < CW and 0 <= y < CH:
        frame[y, x] = c


def _rect(frame, x, y, w, h, c):
    x0, x1 = max(0, x), min(CW, x + w)
    y0, y1 = max(0, y), min(CH, y + h)
    if x0 < x1 and y0 < y1:
        frame[y0:y1, x0:x1] = c


# ── 3×5 pixel font ─────────────────────────────────────────────────────────────
_FONT = {
    '0': [0b111,0b101,0b101,0b101,0b111], '1': [0b010,0b110,0b010,0b010,0b111],
    '2': [0b111,0b001,0b111,0b100,0b111], '3': [0b111,0b001,0b111,0b001,0b111],
    '4': [0b101,0b101,0b111,0b001,0b001], '5': [0b111,0b100,0b111,0b001,0b111],
    '6': [0b111,0b100,0b111,0b101,0b111], '7': [0b111,0b001,0b001,0b001,0b001],
    '8': [0b111,0b101,0b111,0b101,0b111], '9': [0b111,0b101,0b111,0b001,0b111],
    'A': [0b010,0b101,0b111,0b101,0b101], 'B': [0b110,0b101,0b110,0b101,0b110],
    'C': [0b111,0b100,0b100,0b100,0b111], 'D': [0b110,0b101,0b101,0b101,0b110],
    'E': [0b111,0b100,0b111,0b100,0b111], 'F': [0b111,0b100,0b111,0b100,0b100],
    'G': [0b111,0b100,0b101,0b101,0b111], 'H': [0b101,0b101,0b111,0b101,0b101],
    'I': [0b111,0b010,0b010,0b010,0b111], 'J': [0b001,0b001,0b001,0b101,0b111],
    'K': [0b101,0b101,0b110,0b101,0b101], 'L': [0b100,0b100,0b100,0b100,0b111],
    'M': [0b101,0b111,0b111,0b101,0b101], 'N': [0b101,0b111,0b111,0b111,0b101],
    'O': [0b111,0b101,0b101,0b101,0b111], 'P': [0b111,0b101,0b111,0b100,0b100],
    'Q': [0b111,0b101,0b101,0b111,0b001], 'R': [0b110,0b101,0b110,0b101,0b101],
    'S': [0b111,0b100,0b111,0b001,0b111], 'T': [0b111,0b010,0b010,0b010,0b010],
    'U': [0b101,0b101,0b101,0b101,0b111], 'V': [0b101,0b101,0b101,0b101,0b010],
    'W': [0b101,0b101,0b111,0b111,0b101], 'X': [0b101,0b101,0b010,0b101,0b101],
    'Y': [0b101,0b101,0b010,0b010,0b010], 'Z': [0b111,0b001,0b010,0b100,0b111],
    ' ': [0b000,0b000,0b000,0b000,0b000], '/': [0b001,0b001,0b010,0b100,0b100],
    '%': [0b101,0b001,0b010,0b100,0b101], '+': [0b000,0b010,0b111,0b010,0b000],
    '-': [0b000,0b000,0b111,0b000,0b000], ':': [0b000,0b010,0b000,0b010,0b000],
}


def _text(frame, x, y, text, color):
    cx = x
    for ch in str(text).upper():
        rows = _FONT.get(ch, _FONT[' '])
        for ry, bits in enumerate(rows):
            for b in range(3):
                if bits & (1 << (2 - b)):
                    _px(frame, cx + b, y + ry, color)
        cx += 4


# ── Unit colour ────────────────────────────────────────────────────────────────

def _unit_color(unit):
    side, utype, n = unit['side'], unit['type'], unit['number']
    if side == 'player':
        if utype == 'chief':   return YEL
        if n <= 7:             return LGRAY
        elif n <= 14:          return WHITE
        else:                  return LBLUE
    else:
        if utype == 'chief':   return LMAG
        if n <= 7:             return DGRAY
        elif n <= 14:          return ORG
        else:                  return LMAG


# ── Display ────────────────────────────────────────────────────────────────────

class Mr01Display(RenderableUserDisplay):
    def __init__(self, game: "Mr01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        frame[:, :] = BLACK

        # ── Header ────────────────────────────────────────────────────────────
        _text(frame, 1, 1, "L" + str(g.level_index + 1), WHITE)
        _text(frame, 9, 1, str(g.tick), LGRAY)
        _text(frame, 29, 1, "RT", GRN)

        # ── Grid ──────────────────────────────────────────────────────────────
        for gy in range(GH):
            for gx in range(GW):
                self._draw_cell(frame, g, gx, gy)

        # ── Panel ─────────────────────────────────────────────────────────────
        frame[:, PANEL_X:CW] = BLACK
        self._draw_panel(frame, g)
        return frame

    def _draw_cell(self, frame, g, gx, gy):
        px = GRID_X + gx * CELL
        py = GRID_Y + gy * CELL

        # Territory base
        base_c = TERRITORY_COLOR[g.territory.get((gx, gy), 0)]
        frame[py:py+CELL, px:px+CELL] = base_c

        # Terrain overlay
        terrain_t = g.terrain.get((gx, gy), T_EMPTY)
        if terrain_t != T_EMPTY:
            frame[py:py+CELL, px:px+CELL] = TERRAIN_COLOR[terrain_t]

        # L3 key location marker
        if g.level_index == 2 and gx == 9 and gy == 9:
            if g._unit_at(gx, gy) is None:
                frame[py:py+CELL, px:px+CELL] = PUR

        # Barrack: GRN top-left pixel
        for bar in g.barracks:
            if bar['x'] == gx and bar['y'] == gy:
                _px(frame, px, py, GRN)
                break

        # Unit
        unit = g._unit_at(gx, gy)
        if unit is not None:
            frame[py:py+CELL, px:px+CELL] = _unit_color(unit)

        # Path preview overlay — drawn on top of everything else
        sel = g.selected_unit
        if sel is not None and sel.get('path') and sel.get('path_preview', 0) > 0:
            path = sel['path']
            dest = path[-1]
            # Destination: ORG bottom row
            if dest == (gx, gy):
                _px(frame, px,   py + 1, ORG)
                _px(frame, px+1, py + 1, ORG)
            else:
                # Intermediate path cell: YEL bottom-right pixel
                for (cx, cy) in path[:-1]:
                    if cx == gx and cy == gy:
                        _px(frame, px + 1, py + 1, YEL)
                        break

        # Selected unit: WHITE top-left pixel
        if g.selected_unit is not None:
            su = g.selected_unit
            if su['x'] == gx and su['y'] == gy:
                _px(frame, px, py, WHITE)

        # Selected cell: white dot
        if g.selected_cell == (gx, gy):
            _px(frame, px + 1, py + 1, WHITE)

    def _draw_panel(self, frame, g):
        px = PANEL_X + 1

        # Stats
        _text(frame, px, 1, "G", YEL)
        _text(frame, px + 4, 1, str(g.gold), YEL)

        p_reg = sum(1 for u in g.units if u['side'] == 'player' and u['type'] == 'regular')
        _text(frame, px, 7, "U", BLUE)
        _text(frame, px + 4, 7, str(p_reg), BLUE)

        p_bars = sum(1 for b in g.barracks if b['side'] == 'player')
        _text(frame, px, 13, "B", GRN)
        _text(frame, px + 4, 13, str(p_bars), GRN)

        # Selected unit number
        sel = g.selected_unit
        if sel is not None:
            uc = _unit_color(sel)
            _rect(frame, PANEL_X, 19, 3, 5, uc)
            _text(frame, px + 3, 19, str(sel['number']), WHITE)
        else:
            chief = next((u for u in g.units
                          if u['side'] == 'player' and u['type'] == 'chief'), None)
            if chief is not None:
                _rect(frame, PANEL_X, 19, 3, 5, YEL)
                _text(frame, px + 3, 19, str(chief['number']), WHITE)

        # TICK button — manual advance
        _rect(frame, PANEL_X, 26, 20, 6, DGRAY)
        _text(frame, px, 27, "TICK", WHITE)

        # BLD / SPN / SEL buttons
        if g._can_show_bld():
            _rect(frame, PANEL_X, 33, 20, 6, BLUE)
            _text(frame, px, 34, "BLD", BLACK)

        if g._can_show_spn():
            _rect(frame, PANEL_X, 40, 20, 6, ORG)
            _text(frame, px, 41, "SPN", BLACK)

        if g._can_show_sel():
            _rect(frame, PANEL_X, 47, 20, 6, RED)
            _text(frame, px, 48, "SEL", BLACK)

        # Progress (y=53)
        self._draw_progress(frame, g, px)

        # Mini unit roster (y=57..63)
        player_units = sorted(
            (u for u in g.units if u['side'] == 'player'),
            key=lambda u: (0 if u['type'] == 'chief' else 1, -u['number'])
        )
        for i, u in enumerate(player_units[:4]):
            ry = 57 + (i // 2) * 4
            rx = PANEL_X + (i % 2) * 10
            _rect(frame, rx, ry, 2, 2, _unit_color(u))
            _text(frame, rx + 2, ry, str(u['number']), LGRAY)

    def _draw_progress(self, frame, g, px):
        y = 53
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

class Mr01(ARCBaseGame):
    def __init__(self):
        self.display = Mr01Display(self)

        # Mutable state (reset in on_set_level)
        self.units         = []
        self.territory     = {}
        self.barracks      = []
        self.terrain       = {}
        self.gold          = 100
        self.tick          = 0
        self.selected_unit = None
        self.selected_cell = None
        self.hold_counter  = 0

        super().__init__(
            "mr01",
            levels,
            Camera(0, 0, CW, CH, BLACK, BLACK, [self.display]),
            False,
            len(levels),
            [6, 7],   # ACTION6 = click, ACTION7 = RT tick
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
        self.tick          = 0
        self.selected_unit = None
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

    # ── Movement range / speed ─────────────────────────────────────────────────

    def _get_move_range(self, side):
        """Base 3 + 1 per 10 % of map (40 cells) captured."""
        owned = sum(1 for v in self.territory.values() if v == (1 if side == 'player' else 2))
        return 3 + owned // 40

    def _get_move_speed(self, side):
        """Ticks between steps. Lower = faster. Scales with territory captured."""
        return max(1, MOVE_SPEED_BASE + 3 - self._get_move_range(side))
        # range 3 → 4 ticks, range 4 → 3, range 5 → 2, range 6+ → 1

    # ── BFS path ──────────────────────────────────────────────────────────────

    def _bfs_path(self, sx, sy, tx, ty):
        """Shortest path from (sx,sy) to (tx,ty) ignoring units; returns cells
        after start, or [] if unreachable."""
        if sx == tx and sy == ty:
            return []
        prev = {(sx, sy): None}
        queue = deque([(sx, sy)])
        while queue:
            cx, cy = queue.popleft()
            for dx, dy in _DIRS:
                nx, ny = cx + dx, cy + dy
                if not (0 <= nx < GW and 0 <= ny < GH):
                    continue
                if (nx, ny) in prev:
                    continue
                if self.terrain.get((nx, ny), T_EMPTY) in IMPASSABLE:
                    continue
                prev[(nx, ny)] = (cx, cy)
                if nx == tx and ny == ty:
                    path, cur = [], (nx, ny)
                    while cur is not None:
                        path.append(cur)
                        cur = prev[cur]
                    path.reverse()
                    return path[1:]
                queue.append((nx, ny))
        return []

    # ── Combat / territory ─────────────────────────────────────────────────────

    def _do_combat(self, attacker, defender):
        loss = defender['number']
        attacker['number'] = max(1, attacker['number'] - loss)
        self.units = [u for u in self.units if u is not defender]

    def _claim_territory(self, unit, tx, ty):
        self.territory[(tx, ty)] = 1 if unit['side'] == 'player' else 2

    # ── RT unit movement ───────────────────────────────────────────────────────

    def _move_unit_rt(self, unit, tx, ty):
        """Advance unit one cell to (tx,ty), resolve combat, claim territory."""
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
            unit['path'] = []   # stop after combat
        if unit in self.units:
            unit['x'] = tx
            unit['y'] = ty
            self._claim_territory(unit, tx, ty)

    def _advance_unit(self, unit):
        """Advance one unit along its path by one step (called each tick)."""
        if not unit.get('path'):
            return

        # Preview phase — show path, don't move yet
        pv = unit.get('path_preview', 0)
        if pv > 0:
            unit['path_preview'] = pv - 1
            return

        # Move cooldown
        mt = unit.get('move_timer', 0)
        if mt > 0:
            unit['move_timer'] = mt - 1
            return

        nx, ny = unit['path'][0]

        # Terrain sanity (impassable path cell — clear and abort)
        if self.terrain.get((nx, ny), T_EMPTY) in IMPASSABLE:
            unit['path'] = []
            return

        # Friendly blocking — wait a couple ticks
        other = self._unit_at(nx, ny)
        if other is not None and other['side'] == unit['side']:
            unit['move_timer'] = 2
            return

        # Take the step
        unit['path'].pop(0)
        self._move_unit_rt(unit, nx, ny)
        unit['move_timer'] = self._get_move_speed(unit['side'])

    # ── Enemy AI ───────────────────────────────────────────────────────────────

    def _enemy_ai_assign_paths(self):
        """Assign movement paths to enemy units that are idle."""
        player_chief = next((u for u in self.units
                             if u['side'] == 'player' and u['type'] == 'chief'), None)
        pchief_x = player_chief['x'] if player_chief else 0
        pchief_y = player_chief['y'] if player_chief else 19

        for unit in list(self.units):
            if unit['side'] != 'enemy':
                continue
            if unit.get('path'):
                continue
            # L4 chief is stationary
            if self.level_index == 3 and unit['type'] == 'chief':
                continue

            if self.level_index == 0:
                target = _bfs_nearest_neutral(unit['x'], unit['y'],
                                              self.terrain, self.territory)
            elif self.level_index in (1, 2):
                target = (pchief_x, pchief_y)
            else:
                target = (10, 3)

            if target:
                path = self._bfs_path(unit['x'], unit['y'], target[0], target[1])
                if path:
                    unit['path'] = path

    def _l4_chief_attack(self, chief):
        """L4 stationary chief attacks all adjacent player units."""
        for dx, dy in _DIRS:
            nx, ny = chief['x'] + dx, chief['y'] + dy
            if not (0 <= nx < GW and 0 <= ny < GH):
                continue
            target = self._unit_at(nx, ny)
            if target is not None and target['side'] == 'player':
                loss = target['number']
                chief['number'] = max(1, chief['number'] - loss)
                self.units = [u for u in self.units if u is not target]

    # ── RT tick ────────────────────────────────────────────────────────────────

    def _do_tick(self):
        """Handle one real-time tick (ACTION7). Returns (win, lose)."""
        self.tick += 1

        # Advance all units
        for unit in list(self.units):
            if unit in self.units:
                self._advance_unit(unit)

        # Enemy re-path
        if self.tick % ENEMY_AI_INTERVAL == 0:
            self._enemy_ai_assign_paths()

        # L4 stationary chief attack
        if self.level_index == 3 and self.tick % L4_CHIEF_ATK_IVL == 0:
            chief = next((u for u in self.units
                          if u['side'] == 'enemy' and u['type'] == 'chief'), None)
            if chief:
                self._l4_chief_attack(chief)

        # Gold income
        if self.tick % INCOME_INTERVAL == 0:
            p_owned = self._count_player_owned()
            self.gold = min(200, self.gold + 15 + p_owned // 5)

        # Strength regeneration
        if self.tick % STRENGTH_INTERVAL == 0:
            for u in self.units:
                if self.level_index == 3 and u['side'] == 'enemy' and u['type'] == 'chief':
                    u['number'] += 5
                elif u['type'] == 'regular':
                    u['number'] = min(20, u['number'] * 2)
                elif u['type'] == 'chief':
                    u['number'] = min(30, u['number'] * 2)

        # L3 hold counter
        if self.level_index == 2 and self.tick % L3_HOLD_INTERVAL == 0:
            key_unit = self._unit_at(9, 9)
            if key_unit is not None and key_unit['side'] == 'player':
                self.hold_counter += 1
            else:
                self.hold_counter = 0

        if self._check_lose():
            return False, True
        if self._check_win():
            return True, False
        return False, False

    # ── Button visibility ──────────────────────────────────────────────────────

    def _can_show_bld(self):
        if self.selected_cell is None:
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
        if self.selected_cell is None:
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
        if self.selected_cell is None:
            return False
        sc = self.selected_cell
        bar = self._barrack_at(sc[0], sc[1])
        return bar is not None and bar['side'] == 'player'

    # ── Player actions ─────────────────────────────────────────────────────────

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
            self.gold = min(200, self.gold + 20)
        self.selected_cell = None

    # ── Click dispatch ─────────────────────────────────────────────────────────

    def _handle_click(self, px, py):
        if px >= PANEL_X:
            return self._handle_panel_click(px, py)
        if px < GRID_X or py < GRID_Y:
            return False, False
        gx = (px - GRID_X) // CELL
        gy = (py - GRID_Y) // CELL
        if not (0 <= gx < GW and 0 <= gy < GH):
            return False, False
        return self._handle_grid_click(gx, gy)

    def _handle_panel_click(self, px, py):
        # TICK button y=26..31
        if 26 <= py <= 31 and px >= PANEL_X:
            return self._do_tick()

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

            # Click own unit: deselect
            if su['x'] == gx and su['y'] == gy:
                self.selected_unit = None
                self.selected_cell = None
                return False, False

            # Click passable cell: assign path
            if self.terrain.get((gx, gy), T_EMPTY) not in IMPASSABLE:
                path = self._bfs_path(su['x'], su['y'], gx, gy)
                if path:
                    su['path']         = path
                    su['path_preview'] = PATH_PREVIEW_TICKS
                    su['move_timer']   = 0
            self.selected_unit = None
            self.selected_cell = None
            return False, False

        # Try to select a player unit
        unit = self._unit_at(gx, gy)
        if unit is not None and unit['side'] == 'player':
            self.selected_unit = unit
            self.selected_cell = None
        else:
            self.selected_cell = (gx, gy)

        return False, False

    # ── Step ───────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value

        if aid == 7:
            win, lose = self._do_tick()
        elif aid == 6:
            data = self.action.data
            if data and 'x' in data and 'y' in data:
                win, lose = self._handle_click(int(data['x']), int(data['y']))
            else:
                self.complete_action()
                return
        else:
            self.complete_action()
            return

        if lose:
            self.lose()
        elif win:
            if not self.is_last_level():
                self.next_level()
            else:
                self.win()
        self.complete_action()
