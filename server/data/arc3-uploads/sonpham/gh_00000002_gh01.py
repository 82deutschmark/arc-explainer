"""
gh01 – Ghost Heist  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Move cursor up
ACTION2 (v): Move cursor down
ACTION3 (<): Move cursor left
ACTION4 (>): Move cursor right
ACTION5    : Place / remove noise decoy at cursor position
ACTION6    : Start the heist (then each tick auto-advances the simulation)

Goal: Guide the thief from the entrance (green) to the vault (yellow).

- Place up to 3 noise decoys on the map, then press ACTION6 to run the heist.
- Decoys attract guards within hearing range — guards walk toward the nearest
  active decoy, investigate for a moment, then return to their post.
- Security cameras (azure) ignore noise — they cannot be distracted.
- The thief auto-walks a straight path to the vault.
- Orange chasers patrol set routes; if the thief enters their vision cone they
  give chase and the run ends when they catch the thief (touch same cell).
- WIN  if the thief reaches the vault unseen and uncaught.
- LOSE if the thief steps into any guard's or camera's vision cone (pink),
       OR if an orange chaser catches the thief.

Progression
-----------
L1 Quiet Entry   – 2 static guards; easy introduction.
L2 Night Patrol  – 2 patrolling guards; timing matters.
L3 Triple Threat – 3 guards with overlapping cones; all 3 decoys needed.
L4 Camera System – 2 cameras (undistracted) + 3 guards; no margin for error.
L5 Shadow Patrol – orange chasers hunt on sight; lure them away to survive.
"""

import copy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

GL = 32   # logical grid size → 64×64 pixel frame (2 px per cell)

# ── Colour palette ────────────────────────────────────────────────────────────
#  0=black  1=dark-blue  2=green   3=dark-gray  4=yellow   5=gray
#  6=pink   7=orange     8=azure   9=blue      11=bright-yellow
# 12=red   14=lime       15=white

FLOOR_C      = 3    # dark-gray floor
GUARD_C      = 12   # red guard body
CAMERA_C     = 8    # azure camera body
VISION_C     = 6    # pink vision overlay
THIEF_C      = 4    # yellow thief
VAULT_C      = 11   # bright-yellow vault
START_C      = 2    # green start
DECOY_C      = 15   # white noise decoy (changed from orange to distinguish from chasers)
CHASER_C     = 7    # orange chaser enemy
CURSOR_C     = 9    # blue cursor (can place)
CURSOR_BAD_C = 5    # gray cursor (cannot place)
HUD_C        = 1    # dark-blue HUD background
SPOTTED_C    = 14   # lime flash when spotted

# ── Game constants ────────────────────────────────────────────────────────────
MAX_DECOYS         = 3
HEARING_RADIUS     = 8      # cells; guards/chasers hear decoys within this distance
VISION_RANGE       = 5      # cells forward in the guard's facing direction
CAMERA_RANGE       = 6      # cameras see a bit further
CHASER_VISION      = 6      # cells forward in the chaser's facing direction
THIEF_SPEED        = 3      # thief advances 1 cell every N simulation ticks
GUARD_SPEED        = 4      # guards move 1 cell every N simulation ticks
CHASER_PATROL_SPEED = 6     # chasers patrol slowly
CHASER_CHASE_SPEED  = 2     # chasers sprint when hunting (faster than thief!)
INVESTIGATE_WAIT   = 30     # ticks a guard/chaser waits at a decoy before returning

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
    # Perpendicular unit vector (lateral spread ±1)
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
        'state': 'patrol',    # 'patrol' | 'investigate'
        'target': None,       # (tx, ty) decoy being investigated
        'wait_timer': 0,
        'move_timer': 0,
    }


def _ch(x, y, d, patrol=None):
    """Build an orange chaser dict.

    Chasers patrol freely, react to noise decoys like guards, but when they
    spot the thief in their vision cone they switch to 'chase' state and
    sprint toward the thief. Game over when they occupy the same cell.
    """
    pts = patrol if patrol is not None else [(x, y)]
    return {
        'x': x, 'y': y,
        'dir': d,
        'start_dir': d,
        'patrol': pts,
        'patrol_idx': 0,
        'is_camera': False,
        'is_chaser': True,
        'state': 'patrol',    # 'patrol' | 'investigate' | 'chase'
        'target': None,
        'wait_timer': 0,
        'move_timer': 0,
    }


# Level 1 – two static guards above the corridor, facing down toward y=16
_L1 = {
    "name": "Quiet Entry",
    "thief_y": 16,
    "guards": [
        _g(12, 11, 1),   # static, facing down
        _g(22, 11, 1),   # static, facing down
    ],
    "chasers": [],
}

# Level 2 – two guards that patrol vertically across the danger zone
_L2 = {
    "name": "Night Patrol",
    "thief_y": 16,
    "guards": [
        _g(12, 11, 1, patrol=[(12, 11), (12, 18)]),
        _g(22, 11, 1, patrol=[(22, 11), (22, 18)]),
    ],
    "chasers": [],
}

# Level 3 – three guards; all 3 decoys required
_L3 = {
    "name": "Triple Threat",
    "thief_y": 16,
    "guards": [
        _g(8,  11, 1),                              # static
        _g(16, 11, 1, patrol=[(16, 11), (16, 18)]), # patrolling
        _g(24, 11, 1, patrol=[(24, 11), (24, 18)]), # patrolling
    ],
    "chasers": [],
}

# Level 4 – two undistracted cameras + three guards; tight puzzle
_L4 = {
    "name": "Camera System",
    "thief_y": 16,
    "guards": [
        _g(6,  5, 3, cam=True),   # camera, facing up
        _g(26, 5, 3, cam=True),   # camera, facing up
        _g(10, 11, 1),            # guard, static, facing down
        _g(18, 11, 1, patrol=[(18, 11), (18, 18)]),  # guard, patrolling
        _g(26, 11, 1),            # guard, static, facing down
    ],
    "chasers": [],
}

# Level 5 – Shadow Patrol: two orange chasers hunt by sight
#
# Chasers start at y=26, patrol vertically to y=18 (moving upward toward y=16).
# When a chaser is at y≤22 facing up its vision reaches y=16 — the thief's row.
# Solution: lure each chaser south with a decoy (y=28 is within hearing range=8),
# and lure the central guard north. All three decoys are needed.
#
# Suggested decoy placements:
#   (16,  5) → lures guard at (16,11) northward (out of thief's path)
#   (10, 28) → lures left chaser at (10,26) south  (vision flips downward)
#   (22, 28) → lures right chaser at (22,26) south (vision flips downward)
_L5 = {
    "name": "Shadow Patrol",
    "thief_y": 16,
    "guards": [
        _g(16, 11, 1),   # static guard blocking the center corridor
    ],
    "chasers": [
        # Left chaser: patrols (10,18)↔(10,26), starts at top facing down
        _ch(10, 18, 1, patrol=[(10, 18), (10, 26)]),
        # Right chaser: patrols (22,18)↔(22,26), starts at top facing down
        _ch(22, 18, 1, patrol=[(22, 18), (22, 26)]),
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

        # Vision cones for guards/cameras (drawn first)
        for guard in g.guards:
            vc = _vision_cells(guard)
            for (vx, vy) in vc:
                px, py = vx * 2 + 1, vy * 2 + 1
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = VISION_C

        # Vision cones for chasers (same pink overlay)
        for chaser in g.chasers:
            vc = _vision_cells(chaser)
            for (vx, vy) in vc:
                px, py = vx * 2 + 1, vy * 2 + 1
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = VISION_C

        # Start marker and vault
        _fill(frame, 1, g.thief_y, START_C)
        _fill(frame, GL - 2, g.thief_y, VAULT_C)

        # Decoys (now white)
        for (dx, dy) in g.decoys:
            _fill(frame, dx, dy, DECOY_C)

        # Guards and cameras
        for guard in g.guards:
            color = CAMERA_C if guard['is_camera'] else GUARD_C
            _fill(frame, guard['x'], guard['y'], color)

        # Chasers (orange) — draw on top of vision overlay
        for chaser in g.chasers:
            _fill(frame, chaser['x'], chaser['y'], CHASER_C)

        # Thief
        thief_color = SPOTTED_C if g.spotted else THIEF_C
        _fill(frame, g.thief_x, g.thief_y, thief_color)

        # Cursor (only visible in placement phase)
        if g.phase == 'place':
            cx, cy = g.cursor
            pos = (cx, cy)
            can_place = (
                pos not in g.decoys and
                1 <= cx <= GL - 2 and
                1 <= cy <= GL - 2
            )
            cc = CURSOR_C if (can_place or pos in g.decoys) else CURSOR_BAD_C
            px, py = cx * 2, cy * 2
            if 0 <= px < 63 and 0 <= py < 63:
                frame[py, px:px + 2] = cc
                frame[py + 1, px:px + 2] = cc

        # ── HUD top: decoy inventory ──────────────────────────────────────────
        frame[0:2, 0:64] = HUD_C
        used = len(g.decoys)
        for i in range(MAX_DECOYS):
            color = DECOY_C if i < used else HUD_C
            frame[0:2, 2 + i * 6: 2 + i * 6 + 4] = color

        # Phase indicator (top-right): green = running, dark = placement
        if g.phase == 'run':
            frame[0:2, 54:64] = START_C

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

        # Mutable state – properly reset by on_set_level
        self.thief_y     = 16
        self.thief_x     = 1
        self.thief_timer = 0
        self.guards      = []
        self.chasers     = []
        self.decoys      = []   # list of (x, y)
        self.cursor      = (8, 8)
        self.phase       = 'place'   # 'place' | 'run'
        self.spotted     = False
        self.step_count  = 0

        super().__init__(
            "gh",
            levels,
            Camera(0, 0, 64, 64, FLOOR_C, FLOOR_C, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5, 6],
        )

    # ── Level setup ───────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        cfg = _LEVEL_CONFIGS[self.level_index]
        self.thief_y     = cfg["thief_y"]
        self.thief_x     = 1
        self.thief_timer = 0
        self.guards      = copy.deepcopy(cfg["guards"])
        self.chasers     = copy.deepcopy(cfg.get("chasers", []))
        self.decoys      = []
        self.cursor      = (8, 8)
        self.phase       = 'place'
        self.spotted     = False
        self.step_count  = 0

    # ── Simulation helpers ────────────────────────────────────────────────────

    def _move_thief(self):
        self.thief_timer += 1
        if self.thief_timer >= THIEF_SPEED:
            self.thief_timer = 0
            if self.thief_x < GL - 2:
                self.thief_x += 1

    def _update_guard(self, guard):
        """Advance one guard by one simulation tick."""
        if guard['is_camera']:
            return  # cameras never move

        guard['move_timer'] += 1
        if guard['move_timer'] < GUARD_SPEED:
            return
        guard['move_timer'] = 0

        if guard['state'] == 'investigate':
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
            # Patrol state: listen for decoys first
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

    def _update_chaser(self, chaser):
        """Advance one orange chaser by one simulation tick.

        Vision is checked every tick (before movement rate-limiting).
        If the thief enters the cone the chaser immediately enters chase mode
        and sprints at CHASER_CHASE_SPEED until it catches the thief.
        """
        # ── Vision check (every tick, not rate-limited) ───────────────────────
        if (self.thief_x, self.thief_y) in _vision_cells(chaser):
            chaser['state'] = 'chase'

        # ── Movement (rate-limited by state) ─────────────────────────────────
        speed = CHASER_CHASE_SPEED if chaser['state'] == 'chase' else CHASER_PATROL_SPEED
        chaser['move_timer'] += 1
        if chaser['move_timer'] < speed:
            return
        chaser['move_timer'] = 0

        if chaser['state'] == 'chase':
            _step_toward(chaser, self.thief_x, self.thief_y)

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
            # Patrol state: chasers also respond to decoys (can be lured away)
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

    def _check_spotted(self):
        """Return True if the thief is inside any guard's/camera's vision."""
        tx, ty = self.thief_x, self.thief_y
        for guard in self.guards:
            if (tx, ty) in _vision_cells(guard):
                self.spotted = True
                return True
        return False

    def _check_caught(self):
        """Return True if an orange chaser has reached the thief's cell."""
        for chaser in self.chasers:
            if chaser['x'] == self.thief_x and chaser['y'] == self.thief_y:
                self.spotted = True   # reuse spotted flag for lose flash
                return True
        return False

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value
        self.step_count += 1

        # ── Placement phase ───────────────────────────────────────────────────
        if self.phase == 'place':
            cx, cy = self.cursor
            if aid == 1 and cy > 1:
                self.cursor = (cx, cy - 1)
            elif aid == 2 and cy < GL - 2:
                self.cursor = (cx, cy + 1)
            elif aid == 3 and cx > 1:
                self.cursor = (cx - 1, cy)
            elif aid == 4 and cx < GL - 2:
                self.cursor = (cx + 1, cy)
            elif aid == 5:
                pos = (cx, cy)
                if pos in self.decoys:
                    self.decoys.remove(pos)
                elif len(self.decoys) < MAX_DECOYS:
                    self.decoys.append(pos)
            elif aid == 6:
                self.phase = 'run'
            self.complete_action()
            return

        # ── Run phase: advance simulation every tick ──────────────────────────
        if self.spotted:
            self.lose()
            self.complete_action()
            return

        # Guards move first
        for guard in self.guards:
            self._update_guard(guard)

        # Check if thief is spotted by a guard/camera after they reposition
        if self._check_spotted():
            self.lose()
            self.complete_action()
            return

        # Chasers update (vision check + movement)
        for chaser in self.chasers:
            self._update_chaser(chaser)

        # Check if a chaser has caught the thief
        if self._check_caught():
            self.lose()
            self.complete_action()
            return

        # Move thief
        self._move_thief()

        # Check win: thief reached vault
        if self.thief_x >= GL - 2:
            if not self.is_last_level():
                self.next_level()
            else:
                self.win()
            self.complete_action()
            return

        # Check spotted/caught again after thief moves (thief may walk into danger)
        if self._check_spotted():
            self.lose()
            self.complete_action()
            return

        if self._check_caught():
            self.lose()
            self.complete_action()
            return

        self.complete_action()
