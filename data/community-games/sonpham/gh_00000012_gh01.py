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
- Walls (gray) block the thief's movement — enemies and their vision pass through walls freely.

Progression
-----------
L1 Quiet Entry   – 2 static guards; learn to navigate around walls and vision.
L2 Cross Traffic – guards sweep horizontally and vertically; time your crossing.
L3 Triple Threat – 3 guards with overlapping cones; all 3 decoys needed.
L4 Camera System – 2 cameras (undistracted) + 3 guards; no margin for error.
L5 Shadow Patrol – orange chasers hunt on sight; use cover and lure them away.
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
WALL_C       = 3    # DarkGray (solid walls — block thief only; enemies/vision pass through)
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
    """Return the set of (x, y) cells inside this entity's vision cone.
    Enemies and vision pass through walls freely.
    """
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
    """Move entity one cell toward (tx, ty) and update facing direction.
    Enemies move through walls freely.
    """
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


def _vault_room(ty):
    """Walled enclosure around vault at (30, ty) with a single-cell approach corridor.

    The vault room (x=27–30) has one entrance at (27, ty).
    A corridor approach (x=20–26) has walls on both sides at y=ty±1, leaving
    only one way in: from the left at (19, ty) → straight right to (27, ty).

    Layout:
        W W W W W W W W W |   ← ty-2  vault top
        W W W W W W W W . |   ← ty-1  corridor + vault left side
        . . . . . . . . V |   ← ty    open corridor → entrance → vault
        W W W W W W W W . |   ← ty+1  corridor + vault left side
        W W W W W W W W W |   ← ty+2  vault bottom
        x=20           30
    """
    return (
        _wh(ty - 2, 27, 29) +        # vault top wall
        _wh(ty + 2, 27, 29) +        # vault bottom wall
        [(27, ty - 1), (27, ty + 1)] +  # vault left wall sides
        _wh(ty - 1, 20, 26) +        # corridor top wall (connects to vault left)
        _wh(ty + 1, 20, 26)          # corridor bottom wall (connects to vault left)
    )


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


# ── Level 1 – Quiet Entry ─────────────────────────────────────────────────────
# Two static guards at y=11 facing down. Vertical dividers split the map into
# three zones. Thief row (y=16) is always passable — walls end at y=14.
# Vision is blocked by walls: use the cover blocks to hide from the guards.
_L1 = {
    "name": "Quiet Entry",
    "thief_y": 16,
    "guards": [
        _g(12, 11, 1),
        _g(22, 11, 1),
    ],
    "chasers": [],
    "walls": set(
        _wh(4, 3, 8) +          # top-left cap
        _wh(4, 10, 20) +        # top-middle cap
        _wh(4, 22, 29) +        # top-right cap
        _wc(9, 5, 14) +         # left divider  (stops at y=14; thief row clear)
        _wc(21, 5, 14) +        # right divider
        _wr(6, 13, 7, 15) +     # left cover block
        _wr(25, 13, 26, 15) +   # right cover block
        # ── extra walls ───────────────────────────────────────────────────────
        _wh(21, 3, 29) +        # lower horizontal barrier
        _wc(5, 17, 20) +        # lower-left column
        _wc(13, 17, 20) +       # lower-mid-left column
        _wc(19, 17, 20) +       # lower-mid-right column
        _wc(25, 17, 20) +       # lower-right column
        _vault_room(16)         # walled vault enclosure (entrance at x=27)
    ),
}

# ── Level 2 – Cross Traffic ───────────────────────────────────────────────────
# One guard sweeps horizontally at y=22 (thief's row), another sweeps
# vertically near the vault. Walls channel both guards and the thief; vision
# is blocked by the pillars so timing the crossing matters less — use them.
_L2 = {
    "name": "Cross Traffic",
    "thief_y": 22,
    "guards": [
        _g(16, 22, 0, patrol=[(8, 22), (24, 22)]),
        _g(26, 16, 1, patrol=[(26, 12), (26, 26)]),
    ],
    "chasers": [],
    "walls": set(
        _wh(17, 5, 22) +        # upper corridor wall
        _wh(27, 5, 22) +        # lower corridor wall
        _wc(5, 18, 21) +        # left wall upper (gap at y=22 for thief entry)
        _wc(5, 23, 26) +        # left wall lower
        _wc(13, 18, 21) +       # mid-left pillar upper
        _wc(13, 23, 26) +       # mid-left pillar lower
        _wr(8, 18, 9, 20) +     # left-corridor upper cover
        _wr(8, 24, 9, 26) +     # left-corridor lower cover
        _wr(18, 19, 19, 21) +   # right-area upper cover
        _wr(18, 23, 19, 25) +   # right-area lower cover
        # ── extra walls ───────────────────────────────────────────────────────
        _wc(20, 18, 21) +       # right pillar upper
        _wc(20, 23, 26) +       # right pillar lower
        _wr(15, 18, 16, 21) +   # mid-right block upper
        _wr(15, 23, 16, 26) +   # mid-right block lower
        _wh(18, 6, 10) +        # upper-left cross wall
        _wh(26, 6, 10) +        # upper-right cross wall
        _vault_room(22)         # walled vault enclosure (entrance at x=27)
    ),
}

# ── Level 3 – Triple Threat ───────────────────────────────────────────────────
# Three guards in separate rooms created by vertical dividers. Each guard's
# vision is walled off from the other zones. You need all 3 decoys.
# Note: boundary walls end at y=15 so the thief can walk row 16 freely.
_L3 = {
    "name": "Triple Threat",
    "thief_y": 16,
    "guards": [
        _g(8,  11, 1),
        _g(16, 11, 1, patrol=[(16, 11), (16, 18)]),
        _g(24, 11, 1, patrol=[(24, 11), (24, 18)]),
    ],
    "chasers": [],
    "walls": set(
        _wh(4, 3, 11) +         # top-left cap
        _wh(4, 13, 19) +        # top-middle cap
        _wh(4, 21, 29) +        # top-right cap
        _wc(12, 5, 14) +        # left-mid divider (thief crosses at y=16 freely)
        _wc(20, 5, 14) +        # mid-right divider
        _wh(19, 3, 11) +        # bottom-left wall
        _wh(19, 13, 19) +       # bottom-middle wall
        _wh(19, 21, 29) +       # bottom-right wall
        _wc(3, 5, 15) +                 # far-left boundary (ends at y=15; thief row clear)
        _wc(29, 5, 14) +                # far-right boundary (stops at y=14; (29,15) is vault interior)
        _wr(5, 14, 6, 15) +             # left lower cover
        _wr(17, 14, 18, 15) +           # middle lower cover
        [(27, 14), (27, 15)] +          # right lower cover (28,15 removed — vault room interior)
        # ── extra walls ───────────────────────────────────────────────────────
        _wr(5, 8, 6, 10) +     # left-room left pillar
        _wr(9, 8, 10, 10) +    # left-room right pillar
        _wr(13, 8, 14, 10) +   # mid-room left pillar
        _wr(17, 8, 18, 10) +   # mid-room right pillar
        _wr(21, 8, 22, 10) +   # right-room left pillar
        _wr(25, 8, 26, 10) +   # right-room right pillar
        _wh(22, 3, 11) +       # lower-left barrier
        _wh(22, 13, 19) +      # lower-mid barrier
        _wh(22, 21, 29) +      # lower-right barrier
        _vault_room(16)                 # walled vault enclosure (entrance at x=27)
    ),
}

# ── Level 4 – Camera System ───────────────────────────────────────────────────
# Two cameras in alcoves + three guards in a narrower corridor below.
# Walls create camera rooms and pinch-points; vision is blocked by alcove walls.
_L4 = {
    "name": "Camera System",
    "thief_y": 16,
    "guards": [
        _g(6,  5, 1, cam=True),
        _g(26, 5, 1, cam=True),
        _g(10, 11, 1),
        _g(18, 11, 1, patrol=[(18, 11), (18, 18)]),
        _g(26, 11, 1),
    ],
    "chasers": [],
    "walls": set(
        _wh(3, 3, 29) +         # top boundary wall
        _wh(7, 3, 9) +          # left camera room floor
        _wh(7, 23, 29) +        # right camera room floor
        _wc(3, 4, 7) +          # left camera room left wall
        _wc(9, 4, 7) +          # left camera room right wall
        _wc(23, 4, 7) +         # right camera room left wall
        _wc(29, 4, 7) +         # right camera room right wall
        _wh(13, 3, 8) +         # left guard corridor ceiling
        _wh(13, 21, 29) +       # right guard corridor ceiling
        _wc(8, 8, 13) +                 # left mid-wall
        _wc(21, 8, 13) +                # right mid-wall
        _wr(4, 13, 5, 15) +             # left lower cover
        _wr(27, 13, 28, 14) + [(27, 15)] +  # right lower cover (28,15 removed — vault room interior)
        # ── extra walls ───────────────────────────────────────────────────────
        _wr(12, 8, 13, 12) +   # left-center block
        _wr(16, 9, 17, 12) +   # center block
        _wr(19, 8, 20, 12) +   # right-center block
        _wh(20, 10, 22) +      # lower barrier
        _vault_room(16)                 # walled vault enclosure (entrance at x=27)
    ),
}

# ── Level 5 – Shadow Patrol ───────────────────────────────────────────────────
# One guard above, two fast orange chasers below. Thick side walls and cover
# blocks let the thief break line-of-sight — chasers can't see through walls.
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
    "walls": set(
        _wh(6, 3, 13) +         # top-left cap
        _wh(6, 19, 29) +        # top-right cap
        _wc(14, 7, 15) +        # left-center divider
        _wc(18, 7, 15) +        # right-center divider
        _wc(3, 7, 15) +         # far-left wall
        _wc(29, 7, 14) +        # far-right wall (stops at y=14; (29,15) is vault room interior)
        _wc(6, 18, 26) +        # left chaser shield
        _wc(7, 18, 26) +        # left chaser shield depth
        _wc(25, 18, 26) +       # right chaser shield
        _wc(26, 18, 26) +       # right chaser shield depth
        _wr(13, 20, 14, 23) +   # central lower cover
        _wr(18, 20, 19, 23) +   # central lower cover (right)
        # ── extra walls ───────────────────────────────────────────────────────
        _wr(8, 20, 9, 25) +     # left-area block
        _wr(23, 20, 24, 25) +   # right-area block
        _wc(16, 17, 22) +       # center column
        _wh(28, 8, 28) +        # upper-right cap
        _wr(4, 17, 5, 22) +     # far-left lower block
        _vault_room(16)         # walled vault enclosure (entrance at x=27)
    ),
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

        # Walls (drawn before vision so vision overlay sits on top)
        for (wx, wy) in g.walls:
            _fill(frame, wx, wy, WALL_C)

        # Vision cones for guards/cameras (wall-blocked)
        for guard in g.guards:
            vc = _vision_cells(guard)
            for (vx, vy) in vc:
                px, py = vx * 2 + 1, vy * 2 + 1
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = VISION_C

        # Vision cones for chasers (wall-blocked)
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
        self.start_y     = cfg["thief_y"]
        self.vault_y     = cfg["thief_y"]
        self.guards      = copy.deepcopy(cfg["guards"])
        self.chasers     = copy.deepcopy(cfg.get("chasers", []))
        self.walls       = cfg.get("walls", set())
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

        # ── D-pad: move the thief (walls block movement) ──────────────────────
        if aid == 1:
            ny = self.thief_y - 1
            if ny >= 1 and (self.thief_x, ny) not in self.walls:
                self.thief_y = ny
        elif aid == 2:
            ny = self.thief_y + 1
            if ny <= GL - 2 and (self.thief_x, ny) not in self.walls:
                self.thief_y = ny
        elif aid == 3:
            nx = self.thief_x - 1
            if nx >= 1 and (nx, self.thief_y) not in self.walls:
                self.thief_x = nx
        elif aid == 4:
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
