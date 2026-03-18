"""pt — Pirate Seas

Sail the Caribbean, destroy rival faction warships, and rule the seas!

Controls:
  ACTION1 (1) = Sail North
  ACTION2 (2) = Sail South
  ACTION3 (3) = Sail West
  ACTION4 (4) = Sail East
  ACTION5 (5) = Fire cannon at nearest enemy
  RESET       = Restart current level

Ship types:
  Small  = 4 HP  |  Medium = 6 HP  |  Large = 10 HP

Factions (6 ports):
  British (red flag)    — top-left
  French  (blue flag)   — top-right
  Dutch   (orange flag) — mid-left
  Spain   (yellow flag) — mid-right
  Pirate  (black flag)  — bottom-left & bottom-right  ← you!

Win:  destroy all enemy ships in the level
Lose: your ship sinks (HP reaches 0)
"""

import math
import random

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ── Grid ──────────────────────────────────────────────────────────────────────
GW, GH = 64, 64
HUD_Y  = 57               # row where HUD begins
SEA_H  = HUD_Y            # playfield uses rows 0 … SEA_H-1

# ── Color palette ─────────────────────────────────────────────────────────────
BLACK  = 0
DKBLUE = 1
GREEN  = 2
DKGRAY = 3
YELLOW = 4
GRAY   = 5
PINK   = 6
ORANGE = 7
AZURE  = 8
BLUE   = 9
MAROON = 10
BTYELL = 11
RED    = 12
TEAL   = 13
LIME   = 14
WHITE  = 15

SEA_C  = BLUE
SEA2_C = DKBLUE
HULL_C = MAROON
MAST_C = DKGRAY
SAIL_C = WHITE
SHOT_C = WHITE
HP_ON  = RED
HP_OFF = DKGRAY
SAND_C = YELLOW
DOCK_C = DKGRAY

# Faction flag colours (shown on mast top)
FACTION_FLAG = {
    'british': RED,
    'french':  BLUE,
    'dutch':   ORANGE,
    'spain':   YELLOW,
    'pirate':  GRAY,      # gray jolly-roger (visible on blue sea)
}

# Faction port accent colour
FACTION_PORT = {
    'british': RED,
    'french':  AZURE,
    'dutch':   ORANGE,
    'spain':   BTYELL,
    'pirate':  GRAY,
}

# ── Ship pixel art ─────────────────────────────────────────────────────────────
# All ships face RIGHT; flip horizontally when ship is on the right half.
# Row 0 (mast/flag row) gets recoloured to faction flag colour at draw time.
# -1 = transparent.

SMALL_PIX = [                                   # 4 w × 3 h  →  4 HP
    [-1,    MAST_C, -1,     -1    ],
    [HULL_C, HULL_C, HULL_C, HULL_C],
    [-1,    HULL_C, HULL_C, -1    ],
]

MED_PIX = [                                     # 6 w × 4 h  →  6 HP
    [-1,     -1,     MAST_C, -1,     -1,     -1    ],
    [HULL_C, SAIL_C, MAST_C, SAIL_C, HULL_C, -1    ],
    [HULL_C, HULL_C, HULL_C, HULL_C, HULL_C, HULL_C],
    [-1,     HULL_C, HULL_C, HULL_C, HULL_C, -1    ],
]

LARGE_PIX = [                                   # 8 w × 5 h  →  10 HP
    [-1, -1,     -1,     MAST_C, -1,     -1,     -1,     -1    ],
    [-1, -1,     SAIL_C, MAST_C, SAIL_C, -1,     -1,     -1    ],
    [HULL_C] * 8,
    [HULL_C] * 8,
    [-1, HULL_C, HULL_C, HULL_C, HULL_C, HULL_C, HULL_C, -1    ],
]

SHIP_PIX    = {'small': SMALL_PIX, 'medium': MED_PIX, 'large': LARGE_PIX}
SHIP_MAX_HP = {'small': 4,         'medium': 6,        'large': 10       }
SHIP_W      = {'small': 4,         'medium': 6,        'large': 8        }
SHIP_H      = {'small': 3,         'medium': 4,        'large': 5        }

# ── Port layout ─────────────────────────────────────────────────────────────────
PORT_W, PORT_H = 8, 6


def _port_pix(faction: str) -> list:
    fc = FACTION_FLAG[faction]
    pc = FACTION_PORT[faction]
    return [
        [DOCK_C] * 8,
        [DOCK_C, pc, fc, fc, fc, pc, DOCK_C, DOCK_C],
        [DOCK_C, pc, DOCK_C, DOCK_C, DOCK_C, pc, DOCK_C, DOCK_C],
        [DOCK_C] * 8,
        [SAND_C] * 8,
        [SAND_C] * 8,
    ]


# (left_x, top_y, faction)
PORT_DEFS = [
    ( 1,  1, 'british'),
    (55,  1, 'french' ),
    ( 1, 27, 'dutch'  ),
    (55, 27, 'spain'  ),
    ( 1, 50, 'pirate' ),
    (55, 50, 'pirate' ),
]

# Enemy patrol centre (cx, cy) — away from port, in open sea
FACTION_SPAWN = {
    'british': (17, 11),
    'french':  (39, 11),
    'dutch':   (17, 34),
    'spain':   (39, 34),
}

# ── Level definitions ──────────────────────────────────────────────────────────
LEVEL_DEFS = [
    # Level 1 — Caribbean Dawn: one small ship per faction
    [('british', 'small'), ('french', 'small'), ('dutch', 'small'), ('spain', 'small')],
    # Level 2 — Stormy Seas: one medium ship per faction
    [('british', 'medium'), ('french', 'medium'), ('dutch', 'medium'), ('spain', 'medium')],
    # Level 3 — Final Battle: large + medium mix
    [
        ('british', 'large'), ('french',   'large'),
        ('dutch',  'medium'), ('spain',   'medium'),
        ('british', 'small'), ('french',   'small'),
    ],
]
LEVEL_NAMES = ['Caribbean Dawn', 'Stormy Seas', 'Final Battle']

# ── Draw helpers ───────────────────────────────────────────────────────────────

def _draw_ship(frame: np.ndarray, x: int, y: int,
               stype: str, faction: str, flip: bool = False) -> None:
    pix  = SHIP_PIX[stype]
    fc   = FACTION_FLAG[faction]
    cols = len(pix[0])
    for r, row in enumerate(pix):
        for c, color in enumerate(row):
            if color == -1:
                continue
            color = fc if r == 0 else color   # flag colour on mast row
            dc = (cols - 1 - c) if flip else c
            ry, rcx = y + r, x + dc
            if 0 <= ry < SEA_H and 0 <= rcx < GW:
                frame[ry, rcx] = color


def _draw_hpbar(frame: np.ndarray, x: int, y: int,
                hp: int, max_hp: int, width: int) -> None:
    if y < 0 or y >= SEA_H:
        return
    filled = round(hp / max_hp * width)
    for i in range(width):
        rcx = x + i
        if 0 <= rcx < GW:
            frame[y, rcx] = HP_ON if i < filled else HP_OFF


# ── Display ───────────────────────────────────────────────────────────────────

class PirateDisplay(RenderableUserDisplay):
    def __init__(self, game: 'Pt01') -> None:
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game

        # ── Sea with wave ripple pattern ───────────────────────────────────────
        frame[:SEA_H, :] = SEA_C
        frame[1::6, 1::5] = SEA2_C
        frame[4::6, 3::5] = SEA2_C

        # ── Ports ─────────────────────────────────────────────────────────────
        for px, py, faction in PORT_DEFS:
            pp = _port_pix(faction)
            for r, row in enumerate(pp):
                for c, color in enumerate(row):
                    ry, rcx = py + r, px + c
                    if 0 <= ry < SEA_H and 0 <= rcx < GW:
                        frame[ry, rcx] = color

        # ── Enemy ships ────────────────────────────────────────────────────────
        for s in g.enemies:
            if s['alive']:
                flip = s['x'] > GW // 2
                _draw_ship(frame, s['x'], s['y'], s['ship_type'], s['faction'], flip)
                _draw_hpbar(frame, s['x'], s['y'] - 2,
                            s['hp'], s['max_hp'], SHIP_W[s['ship_type']])

        # ── Player ship ────────────────────────────────────────────────────────
        _draw_ship(frame, g.px, g.py, g.ship_type, 'pirate',
                   flip=(g.px > GW // 2))

        # ── Cannonballs (2×2 white dots) ──────────────────────────────────────
        for b in g.cannonballs:
            bx, by = int(b['x']), int(b['y'])
            for dr in range(2):
                for dc in range(2):
                    rr, cc = by + dr, bx + dc
                    if 0 <= rr < SEA_H and 0 <= cc < GW:
                        frame[rr, cc] = SHOT_C

        # ── HUD (bottom 7 rows) ────────────────────────────────────────────────
        frame[SEA_H:, :]  = BLACK
        frame[SEA_H,  :]  = GRAY      # divider line

        # Player HP — red/gray 4×3 squares, left side
        for i in range(g.max_hp):
            hx = 2 + i * 5
            if hx + 4 <= GW // 2:
                frame[SEA_H+2:SEA_H+5, hx:hx+4] = HP_ON if i < g.hp else HP_OFF

        # Enemies remaining — red/gray 3×3 squares, right side (right-to-left)
        alive = sum(1 for s in g.enemies if s['alive'])
        total = len(g.enemies)
        for i in range(total):
            hx = GW - 4 - i * 5
            if hx >= GW // 2 + 2:
                frame[SEA_H+2:SEA_H+5, hx:hx+3] = RED if i < alive else DKGRAY

        return frame


# ── Game ──────────────────────────────────────────────────────────────────────

class Pt01(ARCBaseGame):

    SPEED       = 2      # pixels per move action
    FIRE_RANGE  = 22     # auto-aim cannon range (pixels)
    SHOT_SPEED  = 3.5    # cannonball pixels per animation frame
    FIRE_CHANCE = 0.35   # per-action probability that a nearby enemy fires

    def __init__(self) -> None:
        self.display = PirateDisplay(self)

        # Player state — populated properly in on_set_level
        self.px        = 30
        self.py        = 26
        self.hp        = 6
        self.max_hp    = 6
        self.ship_type = 'medium'

        self.enemies:     list = []
        self.cannonballs: list = []
        self._processed:  bool = False

        levels = [
            Level(sprites=[], grid_size=(GW, GH), name=n)
            for n in LEVEL_NAMES
        ]
        super().__init__(
            "pt", levels,
            Camera(0, 0, GW, GH, SEA_C, SEA_C, [self.display]),
            False, len(levels), [1, 2, 3, 4, 5],
        )

    # ── Level initialisation ──────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        idx = self.level_index
        sw, sh = SHIP_W[self.ship_type], SHIP_H[self.ship_type]
        self.px = GW // 2 - sw // 2
        self.py = SEA_H // 2 - sh // 2
        self.hp = self.max_hp
        self.cannonballs = []
        self._processed  = False

        rng = random.Random(idx * 7919)
        self.enemies = []
        for faction, stype in LEVEL_DEFS[idx]:
            bcx, bcy = FACTION_SPAWN[faction]
            ex = max(PORT_W + 3,
                     min(GW - SHIP_W[stype] - 2,
                         bcx + rng.randint(-4, 4)))
            ey = max(PORT_H + 3,
                     min(SEA_H - SHIP_H[stype] - 3,
                         bcy + rng.randint(-3, 3)))
            mhp = SHIP_MAX_HP[stype]
            self.enemies.append({
                'x': ex, 'y': ey,
                'hp': mhp, 'max_hp': mhp,
                'ship_type': stype,
                'faction':   faction,
                'alive':     True,
                'dir':       1,
                'ptimer':    rng.randint(4, 12),
                'cooldown':  0,
            })

    # ── Main step ─────────────────────────────────────────────────────────────

    def step(self) -> None:
        # Phase 1 — process the player's action exactly once per turn
        if not self._processed:
            aid = self.action.id.value
            if aid in (1, 2, 3, 4):
                self._move(aid)
            elif aid == 5:
                self._fire()
            self._enemy_ai()
            self._processed = True

        # Phase 2 — animate cannonballs (keeps step() looping without completing)
        if self.cannonballs:
            self._advance()
            if self.hp <= 0:
                self.lose()
                self._processed = False
                self.complete_action()
            return   # come back next frame

        # Phase 3 — final state check then complete
        if self.hp <= 0:
            self.lose()
        elif self.enemies and not any(s['alive'] for s in self.enemies):
            self.next_level()

        self._processed = False
        self.complete_action()

    # ── Movement ──────────────────────────────────────────────────────────────

    def _move(self, aid: int) -> None:
        dx, dy = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}[aid]
        sw, sh = SHIP_W[self.ship_type], SHIP_H[self.ship_type]
        self.px = max(0, min(GW - sw,   self.px + dx * self.SPEED))
        self.py = max(0, min(SEA_H - sh, self.py + dy * self.SPEED))

    # ── Combat ────────────────────────────────────────────────────────────────

    def _fire(self) -> None:
        """Find nearest alive enemy in FIRE_RANGE and launch a cannonball."""
        ox, oy = self.px + 2, self.py + 1
        best_i, best_d = -1, self.FIRE_RANGE + 1
        for i, s in enumerate(self.enemies):
            if not s['alive']:
                continue
            tx = s['x'] + SHIP_W[s['ship_type']] // 2
            ty = s['y'] + SHIP_H[s['ship_type']] // 2
            d = math.hypot(tx - ox, ty - oy)
            if d < best_d:
                best_d, best_i = d, i
        if best_i >= 0:
            s = self.enemies[best_i]
            self._spawn(ox, oy,
                        s['x'] + SHIP_W[s['ship_type']] // 2,
                        s['y'] + SHIP_H[s['ship_type']] // 2,
                        True, best_i)

    def _enemy_ai(self) -> None:
        """Patrol and occasionally fire at the player."""
        for s in self.enemies:
            if not s['alive']:
                continue

            # Patrol: horizontal back-and-forth near spawn column
            s['ptimer'] -= 1
            if s['ptimer'] <= 0:
                s['x'] += s['dir']
                bx = FACTION_SPAWN[s['faction']][0]
                if   s['x'] > bx + 10: s['dir'] = -1
                elif s['x'] < bx - 10: s['dir'] =  1
                s['ptimer'] = 6

            sw = SHIP_W[s['ship_type']]
            s['x'] = max(PORT_W + 2, min(GW - sw - 2, s['x']))

            # Fire at player when in range
            if s['cooldown'] > 0:
                s['cooldown'] -= 1
                continue
            tx = s['x'] + sw // 2
            ty = s['y'] + SHIP_H[s['ship_type']] // 2
            dist = math.hypot(self.px + 2 - tx, self.py + 1 - ty)
            if dist <= self.FIRE_RANGE and random.random() < self.FIRE_CHANCE:
                self._spawn(tx, ty, self.px + 2, self.py + 1, False, -1)
                s['cooldown'] = 4

    def _spawn(self, x0: float, y0: float,
               tx: float, ty: float,
               from_p: bool, tgt: int) -> None:
        dx   = tx - x0
        dy   = ty - y0
        dist = math.hypot(dx, dy) + 1e-6
        spd  = self.SHOT_SPEED
        self.cannonballs.append({
            'x':      float(x0),
            'y':      float(y0),
            'dx':     dx / dist * spd,
            'dy':     dy / dist * spd,
            'steps':  max(2, int(dist / spd) + 1),
            'from_p': from_p,
            'tgt':    tgt,
        })

    def _advance(self) -> None:
        """Move each cannonball one step; resolve hits."""
        keep = []
        for b in self.cannonballs:
            b['x'] += b['dx']
            b['y'] += b['dy']
            b['steps'] -= 1
            bx, by = int(b['x']), int(b['y'])
            hit = False

            if b['from_p'] and b['tgt'] >= 0:
                s = self.enemies[b['tgt']]
                if s['alive']:
                    sw, sh = SHIP_W[s['ship_type']], SHIP_H[s['ship_type']]
                    if s['x'] <= bx < s['x'] + sw and s['y'] <= by < s['y'] + sh:
                        s['hp'] -= 1
                        if s['hp'] <= 0:
                            s['alive'] = False
                        hit = True
            elif not b['from_p']:
                sw, sh = SHIP_W[self.ship_type], SHIP_H[self.ship_type]
                if self.px <= bx < self.px + sw and self.py <= by < self.py + sh:
                    self.hp -= 1
                    hit = True

            if not hit and b['steps'] > 0 and 0 <= bx < GW and 0 <= by < SEA_H:
                keep.append(b)
        self.cannonballs = keep
