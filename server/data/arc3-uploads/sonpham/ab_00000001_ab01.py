"""
ab - Angry Birds  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Aim higher
ACTION2 (v): Aim lower
ACTION3 (<-): Reduce power
ACTION4 (->): Increase power
ACTION5    : Fire / trigger bird ability (auto-triggers in-flight)

Five levels with increasing difficulty.  Fully deterministic.
"""

import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# --- ARC colour palette ------------------------------------------------------
#  0=black  1=dark-blue  2=green   3=dark-gray  4=yellow   5=gray
#  6=pink   7=orange     8=azure   9=blue      11=bright-yellow
# 12=red   14=lime       15=white

SKY_C   = 9    # blue sky
CLOUD_C = 15   # white cloud
SUN_C   = 11   # bright yellow sun
MOUN_C  = 1    # dark-blue mountain silhouette
GND_C   = 2    # green ground fill
GRASS_C = 14   # lime grass edge
SLING_C = 3    # dark-gray slingshot

WOOD_C  = 7    # orange wood block
STON_C  = 5    # gray stone block
ICE_C   = 8    # azure ice block
WOOD_HI = 4    # yellow highlight on wood
STON_HI = 15   # white highlight on stone
ICE_HI  = 15   # white highlight on ice

PIG_C   = 2    # green pig body
PIG_HI  = 14   # lime pig highlight
PIG_EYE = 15   # white eye
DEAD_PIG = 5   # gray dead pig

BIRD_C  = {'red':12, 'blue':8, 'yellow':4, 'black':3, 'green':14}
TRAIL_C = 15   # white trail

AIM_DOT = 15   # white aim dots

# --- Game constants -----------------------------------------------------------
GW, GH   = 64, 64
GROUND_Y = 44          # first row of ground (rows 44-63 = dirt)
SLING_X  = 10          # slingshot x
SLING_Y  = 39          # launch point y
GRAV     = 0.30        # pixels per frame- downward
BIRD_R   = 2           # bird radius in pixels
PIG_R    = 3           # pig radius

MIN_POWER, MAX_POWER, POWER_STEP = 3, 10, 1
MIN_ANGLE, MAX_ANGLE, ANGLE_STEP = 10, 75, 5   # degrees above horizontal

# Frame number at which each bird type auto-triggers its ability
# -1 = never  -2 = at trajectory apex
ABILITY_FRAME = {'red': -1, 'blue': 10, 'yellow': -2, 'black': 38, 'green': 22}

HP_MAP  = {'wood': 3, 'stone': 7, 'ice': 1}
DMG_MULT = {'wood': 1.0, 'stone': 0.45, 'ice': 2.5}

# --- Level definitions --------------------------------------------------------
# block: (type, x, y, w, h)     pig: (cx, cy, hp)
_LEVELS = [
    {   # -- Level 1 : Tutorial tower ------------------------------------------
        'name':   'Wooden Keep',
        'birds':  ['red', 'red', 'red'],
        'blocks': [
            ('wood', 33, 32, 5, 12),   # left pillar
            ('wood', 44, 32, 5, 12),   # right pillar
            ('wood', 31, 29, 20,  3),  # roof plank
        ],
        'pigs': [(41, 26, 1)],
    },
    {   # -- Level 2 : Stone & Ice ---------------------------------------------
        'name':   'Stone Bridge',
        'birds':  ['red', 'red', 'blue'],
        'blocks': [
            ('stone', 26, 26, 6, 18),  # tall left tower
            ('wood',  44, 30, 6, 14),  # right tower
            ('ice',   34, 36, 8,  8),  # ice box under bridge
            ('wood',  24, 23, 28, 3),  # wide bridge plank
            ('stone', 52, 24, 5, 10),  # right buttress
        ],
        'pigs': [(29, 20, 1), (38, 19, 1), (48, 27, 2)],
    },
    {   # -- Level 3 : Three Towers --------------------------------------------
        'name':   'Triple Spire',
        'birds':  ['red', 'yellow', 'yellow', 'blue'],
        'blocks': [
            # Left spire
            ('stone', 24, 28, 6, 16), ('stone', 24, 18, 6, 10),
            ('wood',  22, 15,10,  3),
            # Centre spire
            ('wood',  35, 34, 5, 10), ('ice',   35, 24, 5, 10),
            ('wood',  33, 21, 9,  3),
            # Right spire
            ('stone', 46, 30, 5, 14), ('wood',  46, 21, 5,  9),
            ('stone', 44, 18,10,  3),
            # Cross beam
            ('ice',   30, 33,22,  2),
        ],
        'pigs': [(27, 12, 1), (37, 18, 1), (49, 15, 2), (37, 30, 1)],
    },
    {   # -- Level 4 : Castle -------------------------------------------------
        'name':   'Stone Castle',
        'birds':  ['red', 'yellow', 'black', 'blue', 'blue'],
        'blocks': [
            # Left keep walls
            ('stone', 24, 28, 4, 16), ('stone', 34, 28, 4, 16),
            ('stone', 24, 20, 14, 8), ('stone', 24, 17, 14, 3),
            # Interior floor (wooden)
            ('wood',  28, 36, 6,  8),
            # Centre spire
            ('stone', 40, 22, 5, 22), ('stone', 45, 22, 5, 22),
            ('stone', 40, 19,10,  3),
            # Right keep walls
            ('stone', 50, 30, 4, 14), ('stone', 58, 30, 4, 14),
            ('stone', 50, 22, 12, 8), ('stone', 50, 19,12,  3),
            # Wooden floors in right keep
            ('wood',  54, 38, 4,  6),
            # Ice decorations
            ('ice',   27, 24, 8,  4),
            ('ice',   53, 26, 7,  4),
        ],
        'pigs': [
            (31, 13, 2), (42, 16, 1), (55, 16, 2),
            (31, 32, 1), (55, 34, 1),
        ],
    },
    {   # -- Level 5 : Ultimate Fortress ---------------------------------------
        'name':   'Iron Fortress',
        'birds':  ['red', 'yellow', 'black', 'black', 'green', 'blue'],
        'blocks': [
            # Far-left tower
            ('stone', 22, 18, 5, 26), ('stone', 22, 10, 5,  8),
            ('stone', 20,  7, 9,  3),
            # Left wall
            ('stone', 27, 30, 4, 14), ('stone', 27, 22, 4,  8),
            # Central keep (heavy)
            ('stone', 33, 24, 6, 20), ('stone', 39, 24, 6, 20),
            ('stone', 33, 16, 12, 8), ('stone', 33, 13, 12, 3),
            ('wood',  35, 34, 8,  6),
            # Right wall
            ('stone', 45, 30, 4, 14), ('stone', 45, 22, 4,  8),
            # Far-right tower
            ('stone', 49, 18, 5, 26), ('stone', 49, 10, 5,  8),
            ('stone', 47,  7, 9,  3),
            # Roof bridge
            ('stone', 24,  4,34,  3),
            # Ice fill in walls
            ('ice',   28, 28, 5,  8), ('ice',   43, 28, 4,  8),
        ],
        'pigs': [
            (24,  4, 2), (36, 10, 2), (45,  4, 2),
            (36, 30, 2), (24, 34, 1), (52, 34, 1),
        ],
    },
]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d['name'], data=d)
    for d in _LEVELS
]


# --- Pixel helpers -----------------------------------------------------------

def _fill(frame, x, y, w, h, color):
    """Fill a rectangle (clipped to frame bounds)."""
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(GW, x + w), min(GH, y + h)
    if x0 < x1 and y0 < y1:
        frame[y0:y1, x0:x1] = color


def _circle(frame, cx, cy, r, color):
    """Fill a circle (clipped)."""
    for dy in range(-r, r + 1):
        w = int(math.sqrt(max(0, r * r - dy * dy)))
        y = cy + dy
        if 0 <= y < GH:
            x0, x1 = max(0, cx - w), min(GW, cx + w + 1)
            if x0 < x1:
                frame[y, x0:x1] = color


def _pset(frame, x, y, color):
    if 0 <= x < GW and 0 <= y < GH:
        frame[y, x] = color


# --- Display -----------------------------------------------------------------

class Ab01Display(RenderableUserDisplay):
    def __init__(self, game: "Ab01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        frame[:] = SKY_C

        # -- Background --------------------------------------------------------
        # Sun
        _circle(frame, 56, 7, 5, SUN_C)
        _pset(frame, 56, 2, 11); _pset(frame, 56, 12, 11)
        _pset(frame, 51, 7, 11); _pset(frame, 61, 7, 11)

        # Clouds (fixed positions)
        _fill(frame,  7,  5, 14,  3, CLOUD_C)
        _fill(frame,  9,  3,  9,  4, CLOUD_C)
        _fill(frame, 28,  8, 16,  3, CLOUD_C)
        _fill(frame, 30,  6, 10,  4, CLOUD_C)
        _fill(frame, 48, 12, 11,  3, CLOUD_C)
        _fill(frame, 50, 10,  7,  4, CLOUD_C)

        # Mountain silhouette
        for mx, peak, mw in [(18, 12, 10), (36, 8, 12), (54, 15, 9)]:
            for i in range(-mw, mw + 1):
                col_h = max(0, peak - abs(i) * peak // mw)
                _fill(frame, mx + i, GROUND_Y - col_h, 1, col_h, MOUN_C)

        # Ground
        _fill(frame, 0, GROUND_Y, GW, GH - GROUND_Y, GND_C)
        frame[GROUND_Y, :] = GRASS_C

        # -- Slingshot ---------------------------------------------------------
        sx, sy = SLING_X, SLING_Y
        # Trunk
        _fill(frame, sx - 1, sy + 1, 3, GROUND_Y - sy, SLING_C)
        # Left fork
        _fill(frame, sx - 3, sy - 5, 2, 6, SLING_C)
        # Right fork
        _fill(frame, sx + 2, sy - 5, 2, 6, SLING_C)

        # Elastic bands (only while aiming on slingshot)
        if g.state == 'AIMING' and g.bird_type is not None:
            bx, by = int(g.bird_x), int(g.bird_y)
            # Simple dots along elastic
            for t in range(0, 10):
                tt = t / 9
                ex = int((sx - 3) * (1 - tt) + bx * tt)
                ey = int((sy - 5) * (1 - tt) + by * tt)
                _pset(frame, ex, ey, SLING_C)
            for t in range(0, 10):
                tt = t / 9
                ex = int((sx + 3) * (1 - tt) + bx * tt)
                ey = int((sy - 5) * (1 - tt) + by * tt)
                _pset(frame, ex, ey, SLING_C)

        # -- Aim trajectory preview (AIMING state) -----------------------------
        if g.state == 'AIMING' and g.bird_type is not None:
            a = math.radians(g.aim_angle)
            pvx = g.aim_power * math.cos(a)
            pvy = -g.aim_power * math.sin(a)
            px, py = float(SLING_X), float(SLING_Y)
            for step_i in range(80):
                pvy += GRAV
                px += pvx; py += pvy
                ix, iy = int(px), int(py)
                if py >= GROUND_Y or px >= GW:
                    break
                if step_i % 4 < 2:  # dotted pattern
                    _pset(frame, ix, iy, AIM_DOT)

        # -- Blocks ------------------------------------------------------------
        for blk in g.blocks:
            if blk['destroyed']:
                continue
            bx, by = int(blk['x']), int(blk['y'])
            bw, bh = blk['w'], blk['h']
            t = blk['type']
            c = {'wood': WOOD_C, 'stone': STON_C, 'ice': ICE_C}[t]
            hi = {'wood': WOOD_HI, 'stone': STON_HI, 'ice': ICE_HI}[t]

            _fill(frame, bx, by, bw, bh, c)
            # Highlight edges
            _fill(frame, bx, by, bw, 1, hi)        # top
            _fill(frame, bx, by, 1, bh, hi)        # left

            # Crack when damaged
            hp_r = blk['hp'] / blk['max_hp']
            if hp_r < 0.7:
                mx = bx + bw // 2
                _fill(frame, mx, by, 1, bh, 0)
            if hp_r < 0.35:
                my = by + bh // 2
                _fill(frame, bx, my, bw, 1, 0)

        # -- Pigs --------------------------------------------------------------
        for pig in g.pigs:
            if pig['destroyed']:
                if pig['die_timer'] > 0:
                    _circle(frame, int(pig['cx']), int(pig['cy']),
                            PIG_R - 1, DEAD_PIG)
                    pig['die_timer'] -= 1
                continue
            cx, cy = int(pig['cx']), int(pig['cy'])
            _circle(frame, cx, cy, PIG_R, PIG_C)
            _circle(frame, cx, cy, PIG_R - 1, PIG_HI)
            # Eyes
            _pset(frame, cx - 1, cy - 1, PIG_EYE)
            _pset(frame, cx + 1, cy - 1, PIG_EYE)
            # Helmet for hp-2
            if pig['max_hp'] >= 2:
                _fill(frame, cx - 2, cy - PIG_R - 1, 5, 2, STON_C)

        # -- Birds in flight / on slingshot ------------------------------------
        # Trail
        for tx, ty in g.trail:
            _pset(frame, tx, ty, TRAIL_C)

        # Current bird
        if g.bird_type is not None and g.bird_x is not None:
            bc = BIRD_C[g.bird_type]
            bx, by = int(g.bird_x), int(g.bird_y)
            _circle(frame, bx, by, BIRD_R, bc)
            # Eye
            _pset(frame, bx + 1, by - 1, PIG_EYE)
            # Beak
            _pset(frame, bx + BIRD_R, by, WOOD_HI)
            # Black bird fuse spark
            if g.bird_type == 'black' and g.state == 'FLYING':
                spk = (g.flight_frame // 3) % 2
                _pset(frame, bx, by - BIRD_R - 1, 15 if spk else 11)

        # -- HUD ---------------------------------------------------------------
        # Level number dots (top-left)
        li = g.level_index
        for i in range(5):
            c = 11 if i <= li else 5
            _pset(frame, 1 + i * 3, 1, c)

        # Bird queue icons (top center)
        hx = 18
        for bt in g.bird_queue:
            _pset(frame, hx, 1, BIRD_C[bt])
            hx += 3
        if g.bird_type:
            _pset(frame, 15, 1, BIRD_C[g.bird_type])

        # Aim angle arrow (left side, under slingshot)
        if g.state == 'AIMING':
            a = math.radians(g.aim_angle)
            for d in range(1, 5):
                ax = SLING_X + int(d * math.cos(a))
                ay = SLING_Y - int(d * math.sin(a))
                _pset(frame, ax, ay, 11)

        # Power bar (right edge)
        bar_total = MAX_POWER - MIN_POWER
        bar_filled = g.aim_power - MIN_POWER
        _fill(frame, GW - 3, GH - 2 - bar_total, 2, bar_total, SLING_C)
        _fill(frame, GW - 3, GH - 2 - bar_filled, 2, bar_filled, 12)

        # "WIN" / "LOSE" flash
        if g.state == 'WON':
            _fill(frame, 20, 28, 24, 8, 11)
            _fill(frame, 22, 30,  4, 4, 0)  # W
            _fill(frame, 27, 30,  4, 4, 0)  # I
            _fill(frame, 32, 30,  4, 4, 0)  # N
        elif g.state == 'LOST':
            _fill(frame, 10, 23, 44, 18, 7)   # orange background
            # "GAME" row — y=26, letters at x=25,29,33,37 (3×5 black pixel font)
            # G
            _fill(frame, 26, 26, 2, 1, 0)
            _pset(frame, 25, 27, 0)
            _fill(frame, 25, 28, 3, 1, 0)
            _pset(frame, 25, 29, 0); _pset(frame, 27, 29, 0)
            _fill(frame, 26, 30, 2, 1, 0)
            # A
            _pset(frame, 30, 26, 0)
            _pset(frame, 29, 27, 0); _pset(frame, 31, 27, 0)
            _fill(frame, 29, 28, 3, 1, 0)
            _pset(frame, 29, 29, 0); _pset(frame, 31, 29, 0)
            _pset(frame, 29, 30, 0); _pset(frame, 31, 30, 0)
            # M
            _pset(frame, 33, 26, 0); _pset(frame, 35, 26, 0)
            _fill(frame, 33, 27, 3, 1, 0)
            _pset(frame, 33, 28, 0); _pset(frame, 35, 28, 0)
            _pset(frame, 33, 29, 0); _pset(frame, 35, 29, 0)
            _pset(frame, 33, 30, 0); _pset(frame, 35, 30, 0)
            # E
            _fill(frame, 37, 26, 3, 1, 0)
            _pset(frame, 37, 27, 0)
            _fill(frame, 37, 28, 2, 1, 0)
            _pset(frame, 37, 29, 0)
            _fill(frame, 37, 30, 3, 1, 0)
            # "OVER" row — y=33, letters at x=25,29,33,37
            # O
            _pset(frame, 26, 33, 0)
            _pset(frame, 25, 34, 0); _pset(frame, 27, 34, 0)
            _pset(frame, 25, 35, 0); _pset(frame, 27, 35, 0)
            _pset(frame, 25, 36, 0); _pset(frame, 27, 36, 0)
            _pset(frame, 26, 37, 0)
            # V
            _pset(frame, 29, 33, 0); _pset(frame, 31, 33, 0)
            _pset(frame, 29, 34, 0); _pset(frame, 31, 34, 0)
            _pset(frame, 29, 35, 0); _pset(frame, 31, 35, 0)
            _pset(frame, 30, 36, 0)
            _pset(frame, 30, 37, 0)
            # E
            _fill(frame, 33, 33, 3, 1, 0)
            _pset(frame, 33, 34, 0)
            _fill(frame, 33, 35, 2, 1, 0)
            _pset(frame, 33, 36, 0)
            _fill(frame, 33, 37, 3, 1, 0)
            # R
            _fill(frame, 37, 33, 2, 1, 0)
            _pset(frame, 37, 34, 0); _pset(frame, 39, 34, 0)
            _fill(frame, 37, 35, 2, 1, 0)
            _pset(frame, 37, 36, 0); _pset(frame, 39, 36, 0)
            _pset(frame, 37, 37, 0); _pset(frame, 39, 37, 0)

        return frame


# --- Game --------------------------------------------------------------------

class Ab01(ARCBaseGame):
    def __init__(self):
        self.display = Ab01Display(self)

        # Mutable game state (initialised in on_set_level)
        self.state       = 'AIMING'   # AIMING | FLYING | WON | LOST
        self.blocks      = []
        self.pigs        = []
        self.bird_queue  = []
        self.bird_type   = None
        self.bird_x      = None
        self.bird_y      = None
        self.bird_vx     = 0.0
        self.bird_vy     = 0.0
        self.flight_frame = 0
        self.bird_ability_used = False
        self.aim_angle   = 45
        self.aim_power   = 6
        self.trail       = []   # list of (x, y) ints
        self.end_timer   = 0    # countdown before win/lose completes

        super().__init__(
            'ab',
            levels,
            Camera(0, 0, 64, 64, SKY_C, SKY_C, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5],
        )

    # -- Level setup ----------------------------------------------------------

    def on_set_level(self, level: Level) -> None:
        d = _LEVELS[self.level_index]
        self.blocks = []
        for (t, x, y, w, h) in d['blocks']:
            hp = HP_MAP[t]
            self.blocks.append({
                'type': t, 'x': float(x), 'y': float(y),
                'w': w, 'h': h,
                'hp': hp, 'max_hp': hp,
                'destroyed': False,
                'vx': 0.0, 'vy': 0.0,
                'active': False,   # stays frozen until bird hits it
            })
        self.pigs = []
        for (cx, cy, hp) in d['pigs']:
            self.pigs.append({
                'cx': float(cx), 'cy': float(cy),
                'r': PIG_R, 'hp': hp, 'max_hp': hp,
                'destroyed': False, 'die_timer': 0,
            })
        self.bird_queue    = list(d['birds'])
        self.state         = 'AIMING'
        self.aim_angle     = 45
        self.aim_power     = 6
        self.trail         = []
        self.end_timer     = 0
        self._load_next_bird()

    def _load_next_bird(self):
        if self.bird_queue:
            self.bird_type = self.bird_queue.pop(0)
            self.bird_x    = float(SLING_X)
            self.bird_y    = float(SLING_Y)
        else:
            self.bird_type = None
            self.bird_x    = None
            self.bird_y    = None

    # -- Step -----------------------------------------------------------------

    def step(self) -> None:
        aid = self.action.id.value

        if self.state == 'AIMING':
            if   aid == 1:
                self.aim_angle = min(MAX_ANGLE, self.aim_angle + ANGLE_STEP)
            elif aid == 2:
                self.aim_angle = max(MIN_ANGLE, self.aim_angle - ANGLE_STEP)
            elif aid == 3:
                self.aim_power = max(MIN_POWER, self.aim_power - POWER_STEP)
            elif aid == 4:
                self.aim_power = min(MAX_POWER, self.aim_power + POWER_STEP)
            elif aid == 5 and self.bird_type is not None:
                # Fire the bird - keep action open to animate flight
                a = math.radians(self.aim_angle)
                self.bird_vx = self.aim_power * math.cos(a)
                self.bird_vy = -self.aim_power * math.sin(a)
                self.flight_frame = 0
                self.bird_ability_used = False
                self.trail = []
                self.state = 'FLYING'
                return   # do NOT complete_action - start animation
            self.complete_action()

        elif self.state == 'FLYING':
            self._physics_tick()
            if self._flight_done():
                self.state = 'AIMING'
                self._load_next_bird()
                self._check_level()
                if self.state not in ('WON', 'LOST'):
                    self.complete_action()
                # else: WON/LOST loop will auto-advance after flash
            # else: keep looping (animate)

        elif self.state in ('WON', 'LOST'):
            self.end_timer -= 1
            if self.end_timer <= 0:
                if self.state == 'WON':
                    if not self.is_last_level():
                        self.next_level()
                    else:
                        self.win()
                else:
                    self.lose()
                self.complete_action()
            # else: keep looping to animate the win/lose flash

    # -- Physics ---------------------------------------------------------------

    def _physics_tick(self):
        # Sub-step to prevent tunnelling through thin blocks at high speed
        SUB = 3
        for _ in range(SUB):
            self.bird_vy += GRAV / SUB
            self.bird_x  += self.bird_vx / SUB
            self.bird_y  += self.bird_vy / SUB
            self._check_bird_block()
            self._check_bird_pig()

        self.flight_frame += 1

        # Trail (keep last 10 points)
        tx, ty = int(self.bird_x), int(self.bird_y)
        self.trail.append((tx, ty))
        if len(self.trail) > 10:
            self.trail.pop(0)

        # Auto-trigger ability
        af = ABILITY_FRAME[self.bird_type]
        if not self.bird_ability_used:
            if af >= 0 and self.flight_frame == af:
                self._use_ability()
            elif af == -2 and self.bird_vy >= 0:
                self._use_ability()

        # Block physics (only for blocks the bird has already hit)
        for blk in self.blocks:
            if blk['destroyed'] or not blk['active']:
                continue
            blk['vy'] += GRAV * 0.4
            blk['x']  += blk['vx']
            blk['y']  += blk['vy']
            blk['vx'] *= 0.85
            if blk['y'] + blk['h'] >= GROUND_Y:
                blk['y']  = GROUND_Y - blk['h']
                blk['vy'] *= -0.12
                blk['vx'] *= 0.75

        # Ground collision for bird
        if self.bird_y + BIRD_R >= GROUND_Y:
            self.bird_y   = GROUND_Y - BIRD_R
            self.bird_vy *= -0.20
            self.bird_vx *= 0.70

    def _check_bird_block(self):
        for blk in self.blocks:
            if blk['destroyed']:
                continue
            bx, by = self.bird_x, self.bird_y
            # Nearest point on AABB to circle centre
            cx = max(blk['x'], min(bx, blk['x'] + blk['w']))
            cy = max(blk['y'], min(by, blk['y'] + blk['h']))
            dx, dy = bx - cx, by - cy
            dist2 = dx * dx + dy * dy
            if dist2 >= BIRD_R * BIRD_R:
                continue

            # Push bird out so it sits on the block surface
            dist = math.sqrt(dist2) if dist2 > 0.0001 else 0.01
            nx_n, ny_n = dx / dist, dy / dist
            overlap = BIRD_R - dist
            self.bird_x += nx_n * overlap
            self.bird_y += ny_n * overlap

            # Damage based on impact speed along the collision normal
            impact = self.bird_vx * nx_n + self.bird_vy * ny_n
            if impact < 0:   # only when moving INTO the block
                dmg = max(1, int(abs(impact) * DMG_MULT[blk['type']] * 0.9))
                blk['hp'] -= dmg
                if blk['hp'] <= 0:
                    blk['destroyed'] = True

                # Impulse on block — also wake it up
                blk['active'] = True
                blk['vx'] += self.bird_vx * 0.28
                blk['vy'] += self.bird_vy * 0.28

                # Reflect normal component (bounce) + dampen tangential (friction)
                restitution = 0.35 if self.bird_type == 'blue' else 0.15
                self.bird_vx -= (1 + restitution) * impact * nx_n
                self.bird_vy -= (1 + restitution) * impact * ny_n
                self.bird_vx *= 0.80
                self.bird_vy *= 0.80

    def _check_bird_pig(self):
        bx, by = self.bird_x, self.bird_y
        for pig in self.pigs:
            if pig['destroyed']:
                continue
            dx = bx - pig['cx']
            dy = by - pig['cy']
            if dx * dx + dy * dy >= (BIRD_R + PIG_R) ** 2:
                continue
            spd = math.sqrt(self.bird_vx ** 2 + self.bird_vy ** 2)
            dmg = max(1, int(spd * 0.40))
            pig['hp'] -= dmg
            if pig['hp'] <= 0:
                pig['destroyed'] = True
                pig['die_timer'] = 12
            self.bird_vx *= 0.40
            self.bird_vy *= 0.40

    def _use_ability(self):
        self.bird_ability_used = True
        t = self.bird_type
        if t == 'yellow':
            spd = math.sqrt(self.bird_vx ** 2 + self.bird_vy ** 2)
            ang = math.atan2(self.bird_vy, self.bird_vx)
            self.bird_vx = math.cos(ang) * spd * 1.9
            self.bird_vy = math.sin(ang) * spd * 1.9
        elif t == 'black':
            self._explode()
        elif t == 'green':
            self.bird_vx = -self.bird_vx * 0.85
            self.bird_vy = -abs(self.bird_vy) * 0.55
        # blue: piercing already handled in collision

    def _explode(self):
        """Black bird explosion: destroy blocks/pigs within radius 14."""
        R = 14
        cx, cy = self.bird_x, self.bird_y
        for blk in self.blocks:
            if blk['destroyed']:
                continue
            dx = (blk['x'] + blk['w'] / 2) - cx
            dy = (blk['y'] + blk['h'] / 2) - cy
            if dx * dx + dy * dy < R * R:
                blk['hp']        = 0
                blk['destroyed'] = True
                blk['vx']        = dx * 0.25
                blk['vy']        = dy * 0.25 - 2.0
        for pig in self.pigs:
            if pig['destroyed']:
                continue
            dx = pig['cx'] - cx
            dy = pig['cy'] - cy
            if dx * dx + dy * dy < (R + PIG_R) ** 2:
                pig['hp']        = 0
                pig['destroyed'] = True
                pig['die_timer'] = 12
        # Move bird off-screen (spent)
        self.bird_y = GROUND_Y + 10

    # -- Win / lose detection -------------------------------------------------

    def _flight_done(self) -> bool:
        # Off the right/left/bottom edges
        if self.bird_x > GW + 8 or self.bird_x < -8 or self.bird_y > GH:
            return True
        # Very slow near ground
        spd = math.sqrt(self.bird_vx ** 2 + self.bird_vy ** 2)
        if spd < 0.4 and self.bird_y >= GROUND_Y - BIRD_R - 1:
            return True
        # Hard cap
        if self.flight_frame > 350:
            return True
        return False

    def _check_level(self):
        alive = [p for p in self.pigs if not p['destroyed']]
        if not alive:
            self.state     = 'WON'
            self.end_timer = 40
        elif self.bird_type is None and not self.bird_queue:
            self.state     = 'LOST'
            self.end_timer = 40
