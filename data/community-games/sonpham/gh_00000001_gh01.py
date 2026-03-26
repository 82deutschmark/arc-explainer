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
- WIN  if the thief reaches the vault unseen.
- LOSE if the thief steps into any guard's or camera's vision cone (pink).

Progression
-----------
L1 Quiet Entry   – 2 static guards; easy introduction.
L2 Night Patrol  – 2 patrolling guards; timing matters.
L3 Triple Threat – 3 guards with overlapping cones; all 3 decoys needed.
L4 Camera System – 2 cameras (undistracted) + 3 guards; no margin for error.
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
DECOY_C      = 7    # orange noise decoy
CURSOR_C     = 9    # blue cursor (can place)
CURSOR_BAD_C = 5    # gray cursor (cannot place)
HUD_C        = 1    # dark-blue HUD background
SPOTTED_C    = 14   # lime flash when spotted

# ── Game constants ────────────────────────────────────────────────────────────
MAX_DECOYS       = 3
HEARING_RADIUS   = 8      # cells; guards hear decoys within this distance
VISION_RANGE     = 5      # cells forward in the guard's facing direction
CAMERA_RANGE     = 6      # cameras see a bit further
THIEF_SPEED      = 3      # thief advances 1 cell every N simulation ticks
GUARD_SPEED      = 4      # guards move 1 cell every N simulation ticks
INVESTIGATE_WAIT = 30     # ticks a guard waits at a decoy before returning

# Direction index → (dx, dy): 0=right, 1=down, 2=left, 3=up
_DVEC = [(1, 0), (0, 1), (-1, 0), (0, -1)]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fill(frame, lx, ly, color):
    px, py = lx * 2, ly * 2
    if 0 <= px < 63 and 0 <= py < 63:
        frame[py:py + 2, px:px + 2] = color


def _dist(x1, y1, x2, y2):
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def _vision_cells(guard):
    """Return the set of (x, y) cells inside this guard/camera's vision cone."""
    gx, gy = guard['x'], guard['y']
    dx, dy = _DVEC[guard['dir']]
    # Perpendicular unit vector (lateral spread ±1)
    px_d, py_d = -dy, dx
    vrange = CAMERA_RANGE if guard['is_camera'] else VISION_RANGE
    cells = set()
    for fwd in range(1, vrange + 1):
        for lat in range(-1, 2):
            cx = gx + dx * fwd + px_d * lat
            cy = gy + dy * fwd + py_d * lat
            if 0 <= cx < GL and 0 <= cy < GL:
                cells.add((cx, cy))
    return cells


def _step_toward(guard, tx, ty):
    """Move guard one cell toward (tx, ty) and update facing direction."""
    gx, gy = guard['x'], guard['y']
    if gx == tx and gy == ty:
        return
    dx_t = tx - gx
    dy_t = ty - gy
    if abs(dx_t) >= abs(dy_t):
        guard['x'] += 1 if dx_t > 0 else -1
        guard['dir'] = 0 if dx_t > 0 else 2
    else:
        guard['y'] += 1 if dy_t > 0 else -1
        guard['dir'] = 1 if dy_t > 0 else 3


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
        'state': 'patrol',    # 'patrol' | 'investigate'
        'target': None,       # (tx, ty) decoy being investigated
        'wait_timer': 0,
        'move_timer': 0,
    }


# Level 1 – two static guards above the corridor, facing down toward y=16
# Guard at (12, 11) facing down sees y=12..16 at x=11..13 → blocks thief at x=11..13
# Guard at (22, 11) facing down sees y=12..16 at x=21..23 → blocks thief at x=21..23
# Solution: place decoys at ~(12, 5) and ~(22, 5) to lure guards upward.
_L1 = {
    "name": "Quiet Entry",
    "thief_y": 16,
    "guards": [
        _g(12, 11, 1),   # static, facing down
        _g(22, 11, 1),   # static, facing down
    ],
}

# Level 2 – two guards that patrol vertically across the danger zone
# Guard at (12, 11) patrols (12,11)↔(12,18); sometimes sees y=16.
# Guard at (22, 11) patrols (22,11)↔(22,18); same.
# Solution: distract both before the thief crosses their x-band.
_L2 = {
    "name": "Night Patrol",
    "thief_y": 16,
    "guards": [
        _g(12, 11, 1, patrol=[(12, 11), (12, 18)]),
        _g(22, 11, 1, patrol=[(22, 11), (22, 18)]),
    ],
}

# Level 3 – three guards; all 3 decoys required
# Guard bands: x=7..9, x=15..17, x=23..25
_L3 = {
    "name": "Triple Threat",
    "thief_y": 16,
    "guards": [
        _g(8,  11, 1),                              # static
        _g(16, 11, 1, patrol=[(16, 11), (16, 18)]), # patrolling
        _g(24, 11, 1, patrol=[(24, 11), (24, 18)]), # patrolling
    ],
}

# Level 4 – two undistracted cameras + three guards; tight puzzle
# Cameras face up (away from y=16) but their presence fills cells the player
# might naively use for decoys, forcing creative placement.
# Guards still need all 3 decoys — cameras demonstrate they can't be lured.
_L4 = {
    "name": "Camera System",
    "thief_y": 16,
    "guards": [
        _g(6,  5, 3, cam=True),   # camera, facing up (watches upper-left area)
        _g(26, 5, 3, cam=True),   # camera, facing up (watches upper-right area)
        _g(10, 11, 1),            # guard, static, facing down
        _g(18, 11, 1, patrol=[(18, 11), (18, 18)]),  # guard, patrolling
        _g(26, 11, 1),            # guard, static, facing down
    ],
}

_LEVEL_CONFIGS = [_L1, _L2, _L3, _L4]

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

        # Vision cones (drawn first; guards/thief drawn on top)
        for guard in g.guards:
            vc = _vision_cells(guard)
            for (vx, vy) in vc:
                px, py = vx * 2 + 1, vy * 2 + 1
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = VISION_C

        # Start marker and vault
        _fill(frame, 1, g.thief_y, START_C)
        _fill(frame, GL - 2, g.thief_y, VAULT_C)

        # Decoys
        for (dx, dy) in g.decoys:
            _fill(frame, dx, dy, DECOY_C)

        # Guards and cameras
        for guard in g.guards:
            color = CAMERA_C if guard['is_camera'] else GUARD_C
            _fill(frame, guard['x'], guard['y'], color)

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
            # Draw cursor as a 2×2 outline (top row only, to avoid hiding objects)
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
                # At decoy — count down wait, then return to patrol
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
                # Follow patrol route
                pts = guard['patrol']
                if len(pts) < 2:
                    return
                pidx = guard['patrol_idx']
                tx, ty = pts[pidx]
                _step_toward(guard, tx, ty)
                if guard['x'] == tx and guard['y'] == ty:
                    guard['patrol_idx'] = (pidx + 1) % len(pts)

    def _check_spotted(self):
        """Return True if the thief is inside any guard's/camera's vision."""
        tx, ty = self.thief_x, self.thief_y
        for guard in self.guards:
            if (tx, ty) in _vision_cells(guard):
                self.spotted = True
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
                # Start the heist — switch to run phase
                self.phase = 'run'
            self.complete_action()
            return

        # ── Run phase: advance simulation every tick ──────────────────────────
        if self.spotted:
            self.lose()
            self.complete_action()
            return

        # Guards move first (before thief, so guards react immediately)
        for guard in self.guards:
            self._update_guard(guard)

        # Check if thief is spotted after guards reposition
        if self._check_spotted():
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

        # Check spotted again after thief moves
        if self._check_spotted():
            self.lose()
            self.complete_action()
            return

        self.complete_action()
