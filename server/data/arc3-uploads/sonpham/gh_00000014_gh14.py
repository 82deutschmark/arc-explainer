"""
gh14 – Ghost Heist  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Move thief up
ACTION2 (v): Move thief down
ACTION3 (<): Move thief left
ACTION4 (>): Move thief right
ACTION5    : Place / remove noise decoy at thief's position
ACTION7    : Live tick — enemies patrol, vision updates

Goal: Sneak the thief from the entrance (green) to the vault (yellow),
      collect the loot, then return to the black gate (exit).

- Move the thief with the d-pad while enemies patrol.
- Place up to 3 noise decoys to lure enemies away.
- Guards (red) chase you if you enter their vision — walls block their sight.
- Ghosts (purple) chase you if you enter their vision — they see through walls!
- If any enemy catches you (same cell), you lose.
- Collect the vault loot (yellow), then return to the black gate at the start.

Enemy types
-----------
Guard (red):   Quarter-circle vision, blocked by walls. Hide behind cover.
Ghost (purple): Quarter-circle vision, sees through walls. Only decoys and
                distance keep you safe.

Progression
-----------
L1 Quiet Entry       – 2 static guards; learn to navigate around vision cones.
L2 Cross Traffic     – patrolling guards; time your crossing.
L3 Haunted Hall      – first ghost; walls won't save you from it.
L4 Double Threat     – guards + ghosts; decoys are essential.
L5 Phantom Gauntlet  – multiple ghosts; stealth mastery required.
"""

import copy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

GL = 32   # logical grid size → 64×64 pixel frame (2 px per cell)

# ── ARC3 colour palette ───────────────────────────────────────────────────────
#  0=White  1=LightGray  2=Gray  3=DarkGray  4=VeryDarkGray  5=Black
#  6=Magenta  7=LightMagenta  8=Red  9=Blue  10=LightBlue
# 11=Yellow  12=Orange  13=Maroon  14=Green  15=Purple

FLOOR_C      = 4    # VeryDarkGray
WALL_C       = 3    # DarkGray
GUARD_C      = 8    # Red
GHOST_C      = 15   # Purple
VISION_C     = 7    # LightMagenta (vision overlay)
THIEF_C      = 11   # Yellow
VAULT_C      = 11   # Yellow (vault target)
START_C      = 14   # Green (start marker)
GATE_C       = 5    # Black (exit after collecting loot)
DECOY_C      = 0    # White (noise decoy)
HUD_C        = 5    # Black (HUD background)
SPOTTED_C    = 6    # Magenta (flash when caught)

# ── Game constants ────────────────────────────────────────────────────────────
MAX_DECOYS         = 3
HEARING_RADIUS     = 8
VISION_RANGE       = 5      # guard vision radius
GHOST_VISION       = 6      # ghosts see further
GUARD_SPEED        = 4      # guards move 1 cell every N ticks
GUARD_CHASE_SPEED  = 3      # guards sprint when chasing
GHOST_PATROL_SPEED = 6      # ghosts patrol slowly
GHOST_CHASE_SPEED  = 2      # ghosts sprint faster than thief
INVESTIGATE_WAIT   = 30
CHASE_GIVE_UP      = 8

# Direction index → (dx, dy): 0=right, 1=down, 2=left, 3=up
_DVEC = [(1, 0), (0, 1), (-1, 0), (0, -1)]

# 3×3 directional entity shapes (pixel offsets from center pixel at lx*2, ly*2)
#  .X.        XX.        XXX        .XX
#  XXX  up    XXX right  XXX down   XXX left
#  XXX        XX.        .X.        .XX
_ENTITY_SHAPES = {
    0: [(-1,-1),(0,-1), (-1,0),(0,0),(1,0), (-1,1),(0,1)],      # right
    1: [(-1,-1),(0,-1),(1,-1), (-1,0),(0,0),(1,0), (0,1)],      # down
    2: [(0,-1),(1,-1), (-1,0),(0,0),(1,0), (0,1),(1,1)],        # left
    3: [(0,-1), (-1,0),(0,0),(1,0), (-1,1),(0,1),(1,1)],        # up
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fill(frame, lx, ly, color):
    px, py = lx * 2, ly * 2
    if 0 <= px < 63 and 0 <= py < 63:
        frame[py:py + 2, px:px + 2] = color


def _fill_entity(frame, lx, ly, color, direction):
    """Draw a 3×3 directional entity shape at logical position (lx, ly)."""
    px, py = lx * 2, ly * 2
    for dx, dy in _ENTITY_SHAPES[direction]:
        fx, fy = px + dx, py + dy
        if 0 <= fx < 64 and 0 <= fy < 64:
            frame[fy, fx] = color


def _dist(x1, y1, x2, y2):
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def _los_clear(x0, y0, x1, y1, walls):
    """Return True if no wall blocks the line from (x0,y0) to (x1,y1)."""
    dx = x1 - x0
    dy = y1 - y0
    steps = max(abs(dx), abs(dy))
    if steps == 0:
        return True
    for i in range(1, steps):
        t = i / steps
        cx = round(x0 + dx * t)
        cy = round(y0 + dy * t)
        if (cx, cy) in walls:
            return False
    return True


def _vision_cells(entity, walls):
    """Return the set of (x, y) cells in this entity's quarter-circle vision.

    Vision is a 90° arc in the facing direction, radius = vision range.
    Walls block line-of-sight for guards; ghosts see through walls.
    """
    gx, gy = entity['x'], entity['y']
    d = entity['dir']
    vrange = GHOST_VISION if entity.get('is_ghost') else VISION_RANGE
    sees_through = entity.get('is_ghost', False)
    r2 = vrange * vrange
    cells = set()

    for dx in range(-vrange, vrange + 1):
        for dy in range(-vrange, vrange + 1):
            if dx == 0 and dy == 0:
                continue
            if dx * dx + dy * dy > r2:
                continue
            # Quarter-circle: cell must be in the forward 90° sector
            if d == 0 and not (dx > 0 and abs(dy) <= dx):
                continue
            if d == 1 and not (dy > 0 and abs(dx) <= dy):
                continue
            if d == 2 and not (dx < 0 and abs(dy) <= -dx):
                continue
            if d == 3 and not (dy < 0 and abs(dx) <= -dy):
                continue

            cx, cy = gx + dx, gy + dy
            if not (0 <= cx < GL and 0 <= cy < GL):
                continue

            # Wall blocks line-of-sight (ghosts see through walls)
            if not sees_through and not _los_clear(gx, gy, cx, cy, walls):
                continue

            cells.add((cx, cy))

    return cells


def _step_toward(entity, tx, ty):
    """Move entity one cell toward (tx, ty) and update facing direction."""
    ex, ey = entity['x'], entity['y']
    if ex == tx and ey == ty:
        return
    dx_t = tx - ex
    dy_t = ty - ey
    if abs(dx_t) >= abs(dy_t):
        entity['x'] += 1 if dx_t > 0 else -1
        entity['dir'] = 0 if dx_t > 0 else 2
    else:
        entity['y'] += 1 if dy_t > 0 else -1
        entity['dir'] = 1 if dy_t > 0 else 3


# ── Wall layout helpers ───────────────────────────────────────────────────────

def _wh(y, x1, x2):
    """Horizontal wall segment: row y from x1 to x2 inclusive."""
    return [(x, y) for x in range(x1, x2 + 1)]


def _wc(x, y1, y2):
    """Vertical wall segment: column x from y1 to y2 inclusive."""
    return [(x, y) for y in range(y1, y2 + 1)]


def _wr(x1, y1, x2, y2):
    """Wall rectangle."""
    return [(x, y) for x in range(x1, x2 + 1) for y in range(y1, y2 + 1)]


def _vault_approach(ty):
    """Vault corridor (x=22–30) with pinch entrance, 3 cells high inside.

    Layout:
        W W W W W W W W W   ty-2   top wall
        W W W W W . . . .   ty-1   corridor wall + open vault room
        . . . . . . . . V   ty     open corridor → vault at x=30
        W W W W W . . . .   ty+1   corridor wall + open vault room
        W W W W W W W W W   ty+2   bottom wall
        x=22          30
    """
    return (
        _wh(ty - 2, 22, 30) +
        _wh(ty + 2, 22, 30) +
        _wh(ty - 1, 22, 26) +
        _wh(ty + 1, 22, 26) +
        [(27, ty - 1), (27, ty + 1)]
    )


# ── Level configuration ───────────────────────────────────────────────────────

def _g(x, y, d, patrol=None):
    """Build a guard dict."""
    pts = patrol if patrol is not None else [(x, y)]
    return {
        'x': x, 'y': y,
        'dir': d,
        'start_dir': d,
        'patrol': pts,
        'patrol_idx': 0,
        'is_ghost': False,
        'state': 'patrol',
        'target': None,
        'wait_timer': 0,
        'move_timer': 0,
    }


def _gh(x, y, d, patrol=None):
    """Build a ghost dict."""
    pts = patrol if patrol is not None else [(x, y)]
    return {
        'x': x, 'y': y,
        'dir': d,
        'start_dir': d,
        'patrol': pts,
        'patrol_idx': 0,
        'is_ghost': True,
        'state': 'patrol',
        'target': None,
        'wait_timer': 0,
        'move_timer': 0,
    }


# ── Level 1 – Quiet Entry ─────────────────────────────────────────────────────
# Two static guards facing down.  Their quarter-circle vision reaches the
# thief row (y=16) when the thief walks through x ≈ 7–13 or 19–25.
# Cover blocks above the thief row break line-of-sight.
_L1 = {
    "name": "Quiet Entry",
    "thief_y": 16,
    "guards": [
        _g(10, 12, 1),     # static, facing down
        _g(22, 12, 1),     # static, facing down
    ],
    "ghosts": [],
    "walls": set(
        _wh(5, 4, 28) +            # top boundary
        # Cover blocks (above thief row, break guard LOS)
        _wr(7, 14, 8, 15) +        # left cover
        _wr(15, 14, 16, 15) +      # middle cover (safe gap between guards)
        _wr(25, 14, 26, 15) +      # right cover
        # Lower area walls
        _wh(20, 4, 20) +           # lower barrier
        _wr(5, 22, 6, 25) +        # lower-left block
        _wr(12, 22, 13, 25) +      # lower-mid block
        _wr(18, 22, 19, 25) +      # lower-right block
        _vault_approach(16)
    ),
}

# ── Level 2 – Cross Traffic ──────────────────────────────────────────────────
# One guard patrols horizontally across the thief's row; another patrols
# vertically near the vault.  Pillars provide momentary cover.
_L2 = {
    "name": "Cross Traffic",
    "thief_y": 16,
    "guards": [
        _g(14, 16, 0, patrol=[(6, 16), (18, 16)]),    # horizontal patrol
        _g(20, 10, 1, patrol=[(20, 8), (20, 24)]),     # vertical patrol
    ],
    "ghosts": [],
    "walls": set(
        _wh(5, 4, 28) +            # top boundary
        _wh(26, 4, 20) +           # bottom boundary
        # Pillars for cover
        _wr(9, 12, 10, 14) +       # pillar upper-left
        _wr(9, 18, 10, 20) +       # pillar lower-left
        _wr(15, 10, 16, 12) +      # pillar upper-mid
        _wr(15, 20, 16, 22) +      # pillar lower-mid
        _wr(17, 14, 18, 15) +      # cover near vault approach
        _wr(17, 17, 18, 18) +      # cover near vault approach lower
        _vault_approach(16)
    ),
}

# ── Level 3 – Haunted Hall ───────────────────────────────────────────────────
# Two guards in the upper zone (walls block their vision) plus one ghost
# patrolling below.  The ghost sees through walls — you need timing or decoys.
_L3 = {
    "name": "Haunted Hall",
    "thief_y": 16,
    "guards": [
        _g(10, 10, 1),             # static, upper area
        _g(20, 10, 1),             # static, upper area
    ],
    "ghosts": [
        _gh(15, 22, 3, patrol=[(15, 19), (15, 27)]),  # patrols below
    ],
    "walls": set(
        _wh(5, 4, 28) +            # top boundary
        # Upper dividers (block guard vision from reaching thief row)
        _wc(10, 6, 8) +            # left guard upper wall
        _wc(20, 6, 8) +            # right guard upper wall
        # Cover blocks
        _wr(7, 13, 8, 15) +        # left cover
        _wr(14, 13, 15, 15) +      # middle cover
        _wr(23, 13, 24, 15) +      # right cover
        # Lower walls (block thief, but ghost sees through)
        _wh(18, 4, 20) +           # lower barrier
        _wr(6, 20, 7, 24) +        # lower-left block
        _wr(11, 20, 12, 23) +      # lower-mid-left block
        _wr(19, 20, 20, 23) +      # lower-mid-right block
        _vault_approach(16)
    ),
}

# ── Level 4 – Double Threat ──────────────────────────────────────────────────
# One patrolling guard plus two ghosts.  Walls help against the guard but
# the ghosts require decoys to manage.
_L4 = {
    "name": "Double Threat",
    "thief_y": 16,
    "guards": [
        _g(12, 12, 1, patrol=[(12, 8), (12, 14)]),  # vertical patrol
    ],
    "ghosts": [
        _gh(8, 22, 3, patrol=[(8, 18), (8, 26)]),   # ghost lower-left
        _gh(18, 22, 3, patrol=[(18, 18), (18, 26)]), # ghost lower-right
    ],
    "walls": set(
        _wh(5, 4, 28) +            # top boundary
        _wc(16, 6, 14) +           # center divider
        # Cover blocks
        _wr(6, 12, 7, 14) +        # left cover
        _wr(19, 12, 20, 14) +      # right cover
        # Lower cover (helps against guard, not ghosts)
        _wr(12, 19, 13, 22) +      # lower-left cover
        _wr(16, 19, 17, 22) +      # lower-right cover
        _wh(27, 4, 20) +           # bottom boundary
        _vault_approach(16)
    ),
}

# ── Level 5 – Phantom Gauntlet ───────────────────────────────────────────────
# One static guard above plus two aggressive ghosts.  Ghosts see through all
# walls so cover is only useful against the guard.  Decoys are essential.
_L5 = {
    "name": "Phantom Gauntlet",
    "thief_y": 16,
    "guards": [
        _g(16, 8, 1),              # static guard facing down
    ],
    "ghosts": [
        _gh(8, 20, 3, patrol=[(8, 16), (8, 26)]),    # ghost left
        _gh(20, 24, 3, patrol=[(20, 16), (20, 28)]),  # ghost right
    ],
    "walls": set(
        _wh(5, 4, 28) +            # top boundary
        # Upper cover
        _wr(12, 10, 13, 12) +      # upper cover left
        _wr(19, 10, 20, 12) +      # upper cover right
        # Scattered cover (helps vs guard only)
        _wr(5, 18, 6, 21) +        # lower-left block
        _wr(13, 18, 14, 21) +      # lower-center-left block
        _wr(18, 18, 19, 21) +      # lower-center-right block
        _wr(25, 18, 26, 21) +      # lower-right block
        _vault_approach(16)
    ),
}

_LEVEL_CONFIGS = [_L1, _L2, _L3, _L4, _L5]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=cfg["name"], data=cfg)
    for cfg in _LEVEL_CONFIGS
]


# ── Display ───────────────────────────────────────────────────────────────────

class Gh14Display(RenderableUserDisplay):
    def __init__(self, game: "Gh14"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game

        # Floor
        frame[:, :] = FLOOR_C

        # Walls
        for (wx, wy) in g.walls:
            _fill(frame, wx, wy, WALL_C)

        # Vision cones for all enemies (quarter-circle)
        for enemy in g.guards + g.ghosts:
            for (vx, vy) in _vision_cells(enemy, g.walls):
                px, py = vx * 2 + 1, vy * 2 + 1
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = VISION_C

        # Start marker / black gate
        if g.has_loot:
            _fill(frame, 1, g.start_y, GATE_C)
        else:
            _fill(frame, 1, g.start_y, START_C)

        # Vault (only visible when loot not yet collected)
        if not g.has_loot:
            _fill(frame, GL - 2, g.vault_y, VAULT_C)

        # Decoys (white)
        for (dx, dy) in g.decoys:
            _fill(frame, dx, dy, DECOY_C)

        # Guards (red, 3×3 directional)
        for guard in g.guards:
            _fill_entity(frame, guard['x'], guard['y'], GUARD_C, guard['dir'])

        # Ghosts (purple, 3×3 directional)
        for ghost in g.ghosts:
            _fill_entity(frame, ghost['x'], ghost['y'], GHOST_C, ghost['dir'])

        # Thief (yellow, 3×3 directional)
        thief_color = SPOTTED_C if g.spotted else THIEF_C
        _fill_entity(frame, g.thief_x, g.thief_y, thief_color, g.thief_dir)

        # ── HUD top: decoy inventory ──────────────────────────────────────────
        frame[0:2, 0:64] = HUD_C
        used = len(g.decoys)
        for i in range(MAX_DECOYS):
            color = DECOY_C if i < used else HUD_C
            frame[0:2, 2 + i * 6: 2 + i * 6 + 4] = color

        # Loot indicator (top-right): bright-yellow = collected
        if g.has_loot:
            frame[0:2, 54:64] = VAULT_C

        # ── HUD bottom: level progress dots ──────────────────────────────────
        frame[62:64, 0:64] = HUD_C
        for i in range(len(_LEVEL_CONFIGS)):
            col = VAULT_C if i <= g.level_index else HUD_C
            frame[62:64, 2 + i * 8: 2 + i * 8 + 6] = col

        return frame


# ── Game ──────────────────────────────────────────────────────────────────────

class Gh14(ARCBaseGame):
    def __init__(self):
        self.display = Gh14Display(self)

        # Mutable state – reset by on_set_level
        self.thief_x     = 1
        self.thief_y     = 16
        self.thief_dir   = 0   # facing right (toward vault)
        self.start_y     = 16
        self.vault_y     = 16
        self.guards      = []
        self.ghosts      = []
        self.decoys      = []
        self.walls       = set()
        self.has_loot    = False
        self.spotted     = False
        self.step_count  = 0

        super().__init__(
            "gh",
            levels,
            Camera(0, 0, 64, 64, FLOOR_C, FLOOR_C, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5, 7],
        )

    # ── Level setup ───────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        cfg = _LEVEL_CONFIGS[self.level_index]
        self.thief_y     = cfg["thief_y"]
        self.thief_x     = 1
        self.thief_dir   = 0   # facing right (toward vault)
        self.start_y     = cfg["thief_y"]
        self.vault_y     = cfg["thief_y"]
        self.guards      = copy.deepcopy(cfg["guards"])
        self.ghosts      = copy.deepcopy(cfg.get("ghosts", []))
        self.walls       = cfg.get("walls", set())
        self.decoys      = []
        self.has_loot    = False
        self.spotted     = False
        self.step_count  = 0

    # ── Vision detection (runs every step) ───────────────────────────────────

    def _detect_thief(self):
        """Set enemies to chase if thief is in their vision cone."""
        thief_pos = (self.thief_x, self.thief_y)
        for enemy in self.guards + self.ghosts:
            if enemy['state'] != 'investigate' and thief_pos in _vision_cells(enemy, self.walls):
                enemy['state'] = 'chase'

    # ── Unified enemy movement ───────────────────────────────────────────────

    def _move_enemy(self, enemy):
        """Move one enemy (guard or ghost) by one tick."""
        if enemy['is_ghost']:
            speed = GHOST_CHASE_SPEED if enemy['state'] == 'chase' else GHOST_PATROL_SPEED
        else:
            speed = GUARD_CHASE_SPEED if enemy['state'] == 'chase' else GUARD_SPEED

        enemy['move_timer'] += 1
        if enemy['move_timer'] < speed:
            return
        enemy['move_timer'] = 0

        if enemy['state'] == 'chase':
            _step_toward(enemy, self.thief_x, self.thief_y)
            # Give up if thief far and out of vision
            if (self.thief_x, self.thief_y) not in _vision_cells(enemy, self.walls):
                vrange = GHOST_VISION if enemy['is_ghost'] else VISION_RANGE
                d = _dist(enemy['x'], enemy['y'], self.thief_x, self.thief_y)
                if d > vrange + CHASE_GIVE_UP:
                    enemy['state'] = 'patrol'
                    enemy['dir'] = enemy['start_dir']

        elif enemy['state'] == 'investigate':
            tx, ty = enemy['target']
            if enemy['x'] == tx and enemy['y'] == ty:
                if enemy['wait_timer'] > 0:
                    enemy['wait_timer'] -= 1
                else:
                    enemy['state'] = 'patrol'
                    enemy['target'] = None
                    enemy['dir'] = enemy['start_dir']
            else:
                _step_toward(enemy, tx, ty)

        else:
            # Patrol: listen for decoys
            nearest_decoy = None
            best_dist = float('inf')
            for (dx, dy) in self.decoys:
                d = _dist(enemy['x'], enemy['y'], dx, dy)
                if d <= HEARING_RADIUS and d < best_dist:
                    best_dist = d
                    nearest_decoy = (dx, dy)

            if nearest_decoy is not None:
                enemy['state'] = 'investigate'
                enemy['target'] = nearest_decoy
                enemy['wait_timer'] = INVESTIGATE_WAIT
            else:
                pts = enemy['patrol']
                if len(pts) < 2:
                    return
                pidx = enemy['patrol_idx']
                tx, ty = pts[pidx]
                _step_toward(enemy, tx, ty)
                if enemy['x'] == tx and enemy['y'] == ty:
                    enemy['patrol_idx'] = (pidx + 1) % len(pts)

    def _check_caught(self):
        """Return True if any enemy has reached the thief's cell."""
        for enemy in self.guards + self.ghosts:
            if enemy['x'] == self.thief_x and enemy['y'] == self.thief_y:
                self.spotted = True
                return True
        return False

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value
        self.step_count += 1

        # ── D-pad: move the thief (walls block movement) ──────────────────────
        if aid == 1:
            self.thief_dir = 3  # up
            ny = self.thief_y - 1
            if ny >= 1 and (self.thief_x, ny) not in self.walls:
                self.thief_y = ny
        elif aid == 2:
            self.thief_dir = 1  # down
            ny = self.thief_y + 1
            if ny <= GL - 2 and (self.thief_x, ny) not in self.walls:
                self.thief_y = ny
        elif aid == 3:
            self.thief_dir = 2  # left
            nx = self.thief_x - 1
            if nx >= 1 and (nx, self.thief_y) not in self.walls:
                self.thief_x = nx
        elif aid == 4:
            self.thief_dir = 0  # right
            nx = self.thief_x + 1
            if nx <= GL - 2 and (nx, self.thief_y) not in self.walls:
                self.thief_x = nx

        # ── ACTION5: place / remove decoy at thief's position ────────────────
        elif aid == 5:
            pos = (self.thief_x, self.thief_y)
            if pos in self.decoys:
                self.decoys.remove(pos)
            elif len(self.decoys) < MAX_DECOYS:
                self.decoys.append(pos)

        # ACTION6 (click) is ignored

        # ── Advance all enemies ────────────────────────────────────────────────
        for enemy in self.guards + self.ghosts:
            self._move_enemy(enemy)

        # ── Vision detection runs on EVERY step ──────────────────────────────
        self._detect_thief()

        # ── Post-action checks ───────────────────────────────────────────────

        # Caught by any enemy on the same cell
        if self._check_caught():
            self.lose()
            self.complete_action()
            return

        # Collect loot from the vault
        if not self.has_loot and self.thief_x == GL - 2 and self.thief_y == self.vault_y:
            self.has_loot = True

        # Return to black gate with loot → win
        if self.has_loot and self.thief_x == 1 and self.thief_y == self.start_y:
            if not self.is_last_level():
                self.next_level()
            else:
                self.win()
            self.complete_action()
            return

        self.complete_action()
