"""
gh01 – Ghost Heist  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Move thief up
ACTION2 (v): Move thief down
ACTION3 (<): Move thief left
ACTION4 (>): Move thief right
ACTION5    : Place / remove noise decoy at thief's position
ACTION7    : Live tick — enemies patrol, vision updates, chasers pursue

Goal: Sneak the thief from the entrance (green) to the vault (yellow),
      collect the loot, then return to the black gate (exit).

- Move the thief with the d-pad while enemies patrol in real-time.
- Place up to 3 noise decoys to lure guards and chasers away.
- Security cameras (azure) are fixed — stepping into their vision is instant game over.
- Guards (red) and chasers (orange) will chase you if you enter their vision cone.
- If a guard or chaser catches you (same cell), you lose.
- Collect the vault loot (yellow), then return to the black gate at the start.

Progression
-----------
L1 Quiet Entry   – 2 static guards; easy introduction.
L2 Cross Traffic – guards sweep horizontally and vertically; time your crossing.
L3 Triple Threat – 3 guards with overlapping cones; all 3 decoys needed.
L4 Camera System – 2 cameras (undistracted) + 3 guards; no margin for error.
L5 Shadow Patrol – orange chasers hunt on sight; lure them away to survive.
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
GUARD_C      = 8    # Red
CAMERA_C     = 10   # LightBlue
VISION_C     = 7    # LightMagenta (vision overlay)
THIEF_C      = 11   # Yellow
VAULT_C      = 11   # Yellow (vault target)
START_C      = 14   # Green (start marker)
GATE_C       = 5    # Black (exit after collecting loot)
DECOY_C      = 0    # White (noise decoy)
CHASER_C     = 12   # Orange (chaser enemy)
HUD_C        = 5    # Black (HUD background)
SPOTTED_C    = 6    # Magenta (flash when caught)

# ── Game constants ────────────────────────────────────────────────────────────
MAX_DECOYS         = 3
HEARING_RADIUS     = 8      # cells; guards/chasers hear decoys within this distance
VISION_RANGE       = 5      # cells forward in the guard's facing direction
CAMERA_RANGE       = 6      # cameras see a bit further
CHASER_VISION      = 6      # cells forward in the chaser's facing direction
GUARD_SPEED        = 4      # guards move 1 cell every N ticks
GUARD_CHASE_SPEED  = 3      # guards sprint when chasing
CHASER_PATROL_SPEED = 6     # chasers patrol slowly
CHASER_CHASE_SPEED  = 2     # chasers sprint when hunting (faster than thief!)
INVESTIGATE_WAIT   = 30     # ticks a guard/chaser waits at a decoy before returning
CHASE_GIVE_UP      = 8      # distance beyond vision range before enemy gives up chase

# Direction index → (dx, dy): 0=right, 1=down, 2=left, 3=up
_DVEC = [(1, 0), (0, 1), (-1, 0), (0, -1)]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fill(frame, lx, ly, color):
    px, py = lx * 2, ly * 2
    if 0 <= px < 63 and 0 <= py < 63:
        frame[py:py + 2, px:px + 2] = color


def _dist(x1, y1, x2, y2):
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def _vision_cells(entity):
    """Return the set of (x, y) cells inside this entity's vision cone."""
    gx, gy = entity['x'], entity['y']
    dx, dy = _DVEC[entity['dir']]
    px_d, py_d = -dy, dx
    if entity['is_camera']:
        vrange = CAMERA_RANGE
    elif entity.get('is_chaser'):
        vrange = CHASER_VISION
    else:
        vrange = VISION_RANGE
    cells = set()
    for fwd in range(1, vrange + 1):
        for lat in range(-1, 2):
            cx = gx + dx * fwd + px_d * lat
            cy = gy + dy * fwd + py_d * lat
            if 0 <= cx < GL and 0 <= cy < GL:
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


# ── Level configuration ───────────────────────────────────────────────────────

def _g(x, y, d, patrol=None, cam=False):
    """Build a guard/camera dict."""
    pts = patrol if patrol is not None else [(x, y)]
    return {
        'x': x, 'y': y,
        'dir': d,
        'start_dir': d,
        'patrol': pts,
        'patrol_idx': 0,
        'is_camera': cam,
        'is_chaser': False,
        'state': 'patrol',
        'target': None,
        'wait_timer': 0,
        'move_timer': 0,
    }


def _ch(x, y, d, patrol=None):
    """Build an orange chaser dict."""
    pts = patrol if patrol is not None else [(x, y)]
    return {
        'x': x, 'y': y,
        'dir': d,
        'start_dir': d,
        'patrol': pts,
        'patrol_idx': 0,
        'is_camera': False,
        'is_chaser': True,
        'state': 'patrol',
        'target': None,
        'wait_timer': 0,
        'move_timer': 0,
    }


# Level 1 – two static guards above the corridor, facing down toward y=16
_L1 = {
    "name": "Quiet Entry",
    "thief_y": 16,
    "guards": [
        _g(12, 11, 1),
        _g(22, 11, 1),
    ],
    "chasers": [],
}

# Level 2 – Cross Traffic: one guard sweeps horizontally across the thief's
# row, another patrols vertically near the vault. The player must time their
# crossing through two perpendicular vision sweeps.
_L2 = {
    "name": "Cross Traffic",
    "thief_y": 22,
    "guards": [
        # Horizontal sweeper at y=22 — blocks the direct path to the vault
        _g(16, 22, 0, patrol=[(8, 22), (24, 22)]),
        # Vertical sentry near the vault — sweeps up/down guarding approach
        _g(26, 16, 1, patrol=[(26, 12), (26, 26)]),
    ],
    "chasers": [],
}

# Level 3 – three guards; all 3 decoys required
_L3 = {
    "name": "Triple Threat",
    "thief_y": 16,
    "guards": [
        _g(8,  11, 1),
        _g(16, 11, 1, patrol=[(16, 11), (16, 18)]),
        _g(24, 11, 1, patrol=[(24, 11), (24, 18)]),
    ],
    "chasers": [],
}

# Level 4 – two undistracted cameras + three guards; tight puzzle
_L4 = {
    "name": "Camera System",
    "thief_y": 16,
    "guards": [
        _g(6,  5, 3, cam=True),
        _g(26, 5, 3, cam=True),
        _g(10, 11, 1),
        _g(18, 11, 1, patrol=[(18, 11), (18, 18)]),
        _g(26, 11, 1),
    ],
    "chasers": [],
}

# Level 5 – Shadow Patrol: two orange chasers hunt by sight
_L5 = {
    "name": "Shadow Patrol",
    "thief_y": 16,
    "guards": [
        _g(16, 11, 1),
    ],
    "chasers": [
        _ch(10, 22, 3, patrol=[(10, 17), (10, 27)]),
        _ch(22, 27, 3, patrol=[(22, 17), (22, 27)]),
    ],
}

_LEVEL_CONFIGS = [_L1, _L2, _L3, _L4, _L5]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=cfg["name"], data=cfg)
    for cfg in _LEVEL_CONFIGS
]


# ── Display ───────────────────────────────────────────────────────────────────

class Gh01Display(RenderableUserDisplay):
    def __init__(self, game: "Gh01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game

        # Floor
        frame[:, :] = FLOOR_C

        # Vision cones for guards/cameras
        for guard in g.guards:
            vc = _vision_cells(guard)
            for (vx, vy) in vc:
                px, py = vx * 2 + 1, vy * 2 + 1
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = VISION_C

        # Vision cones for chasers
        for chaser in g.chasers:
            vc = _vision_cells(chaser)
            for (vx, vy) in vc:
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

        # Guards and cameras
        for guard in g.guards:
            color = CAMERA_C if guard['is_camera'] else GUARD_C
            _fill(frame, guard['x'], guard['y'], color)

        # Chasers (orange)
        for chaser in g.chasers:
            _fill(frame, chaser['x'], chaser['y'], CHASER_C)

        # Thief
        thief_color = SPOTTED_C if g.spotted else THIEF_C
        _fill(frame, g.thief_x, g.thief_y, thief_color)

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

class Gh01(ARCBaseGame):
    def __init__(self):
        self.display = Gh01Display(self)

        # Mutable state – reset by on_set_level
        self.thief_x     = 1
        self.thief_y     = 16
        self.start_y     = 16
        self.vault_y     = 16
        self.guards      = []
        self.chasers     = []
        self.decoys      = []
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
        self.start_y     = cfg["thief_y"]
        self.vault_y     = cfg["thief_y"]
        self.guards      = copy.deepcopy(cfg["guards"])
        self.chasers     = copy.deepcopy(cfg.get("chasers", []))
        self.decoys      = []
        self.has_loot    = False
        self.spotted     = False
        self.step_count  = 0

    # ── Vision detection (runs every step) ───────────────────────────────────

    def _detect_thief(self):
        """Set mobile enemies to chase if thief is in their vision cone."""
        thief_pos = (self.thief_x, self.thief_y)
        for guard in self.guards:
            if guard['is_camera']:
                continue
            if guard['state'] != 'investigate' and thief_pos in _vision_cells(guard):
                guard['state'] = 'chase'
        for chaser in self.chasers:
            if chaser['state'] != 'investigate' and thief_pos in _vision_cells(chaser):
                chaser['state'] = 'chase'

    # ── Enemy movement helpers ─────────────────────────────────────────────

    def _move_guard(self, guard):
        """Move one guard by one tick (vision detection is separate)."""
        if guard['is_camera']:
            return

        guard['move_timer'] += 1
        speed = GUARD_CHASE_SPEED if guard['state'] == 'chase' else GUARD_SPEED
        if guard['move_timer'] < speed:
            return
        guard['move_timer'] = 0

        if guard['state'] == 'chase':
            _step_toward(guard, self.thief_x, self.thief_y)
            # Give up if thief is far and out of vision
            if (self.thief_x, self.thief_y) not in _vision_cells(guard):
                d = _dist(guard['x'], guard['y'], self.thief_x, self.thief_y)
                if d > VISION_RANGE + CHASE_GIVE_UP:
                    guard['state'] = 'patrol'
                    guard['dir'] = guard['start_dir']

        elif guard['state'] == 'investigate':
            tx, ty = guard['target']
            if guard['x'] == tx and guard['y'] == ty:
                if guard['wait_timer'] > 0:
                    guard['wait_timer'] -= 1
                else:
                    guard['state'] = 'patrol'
                    guard['target'] = None
                    guard['dir'] = guard['start_dir']
            else:
                _step_toward(guard, tx, ty)

        else:
            # Patrol: listen for decoys
            nearest_decoy = None
            best_dist = float('inf')
            for (dx, dy) in self.decoys:
                d = _dist(guard['x'], guard['y'], dx, dy)
                if d <= HEARING_RADIUS and d < best_dist:
                    best_dist = d
                    nearest_decoy = (dx, dy)

            if nearest_decoy is not None:
                guard['state'] = 'investigate'
                guard['target'] = nearest_decoy
                guard['wait_timer'] = INVESTIGATE_WAIT
            else:
                pts = guard['patrol']
                if len(pts) < 2:
                    return
                pidx = guard['patrol_idx']
                tx, ty = pts[pidx]
                _step_toward(guard, tx, ty)
                if guard['x'] == tx and guard['y'] == ty:
                    guard['patrol_idx'] = (pidx + 1) % len(pts)

    def _move_chaser(self, chaser):
        """Move one orange chaser by one tick (vision detection is separate)."""
        speed = CHASER_CHASE_SPEED if chaser['state'] == 'chase' else CHASER_PATROL_SPEED
        chaser['move_timer'] += 1
        if chaser['move_timer'] < speed:
            return
        chaser['move_timer'] = 0

        if chaser['state'] == 'chase':
            _step_toward(chaser, self.thief_x, self.thief_y)
            # Give up if thief far and out of vision
            if (self.thief_x, self.thief_y) not in _vision_cells(chaser):
                d = _dist(chaser['x'], chaser['y'], self.thief_x, self.thief_y)
                if d > CHASER_VISION + CHASE_GIVE_UP:
                    chaser['state'] = 'patrol'
                    chaser['dir'] = chaser['start_dir']

        elif chaser['state'] == 'investigate':
            tx, ty = chaser['target']
            if chaser['x'] == tx and chaser['y'] == ty:
                if chaser['wait_timer'] > 0:
                    chaser['wait_timer'] -= 1
                else:
                    chaser['state'] = 'patrol'
                    chaser['target'] = None
                    chaser['dir'] = chaser['start_dir']
            else:
                _step_toward(chaser, tx, ty)

        else:
            # Patrol: respond to decoys
            nearest_decoy = None
            best_dist = float('inf')
            for (ddx, ddy) in self.decoys:
                d = _dist(chaser['x'], chaser['y'], ddx, ddy)
                if d <= HEARING_RADIUS and d < best_dist:
                    best_dist = d
                    nearest_decoy = (ddx, ddy)

            if nearest_decoy is not None:
                chaser['state'] = 'investigate'
                chaser['target'] = nearest_decoy
                chaser['wait_timer'] = INVESTIGATE_WAIT
            else:
                pts = chaser['patrol']
                if len(pts) < 2:
                    return
                pidx = chaser['patrol_idx']
                tx, ty = pts[pidx]
                _step_toward(chaser, tx, ty)
                if chaser['x'] == tx and chaser['y'] == ty:
                    chaser['patrol_idx'] = (pidx + 1) % len(pts)

    def _check_caught(self):
        """Return True if a guard or chaser has reached the thief's cell."""
        for guard in self.guards:
            if not guard['is_camera'] and guard['x'] == self.thief_x and guard['y'] == self.thief_y:
                self.spotted = True
                return True
        for chaser in self.chasers:
            if chaser['x'] == self.thief_x and chaser['y'] == self.thief_y:
                self.spotted = True
                return True
        return False

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value
        self.step_count += 1

        # ── D-pad: move the thief ────────────────────────────────────────────
        if aid == 1 and self.thief_y > 1:
            self.thief_y -= 1
        elif aid == 2 and self.thief_y < GL - 2:
            self.thief_y += 1
        elif aid == 3 and self.thief_x > 1:
            self.thief_x -= 1
        elif aid == 4 and self.thief_x < GL - 2:
            self.thief_x += 1

        # ── ACTION5: place / remove decoy at thief's position ────────────────
        elif aid == 5:
            pos = (self.thief_x, self.thief_y)
            if pos in self.decoys:
                self.decoys.remove(pos)
            elif len(self.decoys) < MAX_DECOYS:
                self.decoys.append(pos)

        # ACTION6 (click) is ignored

        # ── Advance all enemies on every step (d-pad, tick, decoy) ───────────
        for guard in self.guards:
            self._move_guard(guard)
        for chaser in self.chasers:
            self._move_chaser(chaser)

        # ── Vision detection runs on EVERY step ──────────────────────────────
        self._detect_thief()

        # ── Post-action checks ───────────────────────────────────────────────

        # Camera vision = instant lose (cameras can't move, can't be escaped)
        for guard in self.guards:
            if guard['is_camera'] and (self.thief_x, self.thief_y) in _vision_cells(guard):
                self.spotted = True
                self.lose()
                self.complete_action()
                return

        # Caught by a guard or chaser on the same cell
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
