"""
td – Tower Defense  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Move cursor up
ACTION2 (v): Move cursor down
ACTION3 (<): Move cursor left
ACTION4 (>): Move cursor right
ACTION5    : Place tower at cursor / Sell tower under cursor (toggle)
ACTION6    : Tick (no-op — used by live mode auto-advance)
ACTION7    : Cycle tower type (normal 50g → slow 25g → laser 75g → electric 75g)

Goal: Survive 5 waves of enemies across 3 lanes.
- Lane 0 (top):    3 enemies per wave — light traffic
- Lane 1 (middle): 5 enemies per wave — medium traffic
- Lane 2 (bottom): 8 enemies per wave — heavy traffic
- Start with 100 money; each kill earns gold proportional to enemy HP.
- Enemies march from the gate (lime) along their lane to the castle (blue).
- Castle has 10 HP; each enemy that reaches it deals 1 damage.
- Place towers on green cells to auto-attack enemies in range.
- Normal tower   (50g): fires pellets that deal 1 HP damage.
- Slow tower     (25g): fires pellets that slow enemies for 20 steps.
- Laser tower    (75g): sets enemies on fire — burns 10% HP/step for 10 steps.
- Electric tower (75g): lightning bolt hits primary target then chains to the
  3 enemies furthest behind it (lower path progress), dealing 1 HP to each.
- Three levels with increasingly complex lane layouts.
"""

import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

GL = 32   # logical grid size → 64×64 pixel frame (2×2 per cell)

# ── Colour palette ───────────────────────────────────────────────────────────
#  0=black  1=dark-blue  2=green   3=dark-gray  4=yellow   5=gray
#  6=pink   7=orange     8=azure   9=blue      11=bright-yellow
# 12=red   14=lime       15=white

GRASS_C           = 2
PATH_C            = 3
GATE_C            = 14
CASTLE_C          = 9
TOWER_C           = 7
TOWER_TOP_C       = 11
SLOW_TOWER_C      = 8
SLOW_TOWER_TOP_C  = 15
SLOW_PELLET_C     = 1
LASER_TOWER_C        = 12
LASER_TOWER_TOP_C    = 4
LASER_PELLET_C       = 4
ELECTRIC_TOWER_C     = 0    # black base
ELECTRIC_TOWER_TOP_C = 15   # white tip
ELECTRIC_PELLET_C    = 15   # white bolt
ENEMY_C           = 12
SLOWED_ENEMY_C    = 6
BURNED_ENEMY_C    = 7
CURSOR_C          = 9
CURSOR_NO_C       = 5
MONEY_C           = 11
HP_C              = 12
WAVE_C            = 8

# ── Game constants ────────────────────────────────────────────────────────────
TOWER_RANGE       = 3.0
TOWER_COST        = 50
SLOW_TOWER_COST   = 25
LASER_TOWER_COST     = 75
ELECTRIC_TOWER_COST  = 75
TOWER_SELL_PRICE     = 25
KILL_REWARD       = 25
WAVES_PER_LEVEL   = 5
BURN_DURATION     = 10
NUM_LANES         = 3
SPAWN_INTERVAL    = 6
ENEMY_MOVE_EVERY  = 2
SLOWED_MOVE_EVERY = 6
SLOW_DURATION     = 20
PELLET_SPEED      = 1.5

# Per-wave, per-lane HP lists.
# Lane 0: 3 enemies, Lane 1: 5 enemies, Lane 2: 8 enemies per wave.
LANE_WAVE_HEALTH = [
    # wave 0
    [
        [2, 4, 6],
        [2, 3, 5, 7, 9],
        [1, 2, 3, 4, 5, 6, 7, 8],
    ],
    # wave 1
    [
        [3, 6, 9],
        [3, 6,  9, 12, 15],
        [2, 4,  6,  8, 10, 12, 14, 16],
    ],
    # wave 2
    [
        [4, 8, 12],
        [4,  8, 12, 16, 20],
        [3,  6,  9, 12, 15, 18, 21, 24],
    ],
    # wave 3
    [
        [5, 10, 15],
        [ 5, 10, 15, 20, 25],
        [ 4,  8, 12, 16, 20, 24, 28, 32],
    ],
    # wave 4
    [
        [3, 8, 12],
        [2, 5,  3, 10, 15],
        [2, 4,  6,  3,  5,  8, 10, 12],
    ],
]


# ── Path builder ─────────────────────────────────────────────────────────────

def _seg(x0, y0, x1, y1):
    """Axis-aligned segment from (x0,y0) to (x1,y1), both endpoints inclusive."""
    pts = []
    if x0 == x1:
        step = 1 if y1 >= y0 else -1
        for y in range(y0, y1 + step, step):
            pts.append((x0, y))
    else:
        step = 1 if x1 >= x0 else -1
        for x in range(x0, x1 + step, step):
            pts.append((x, y0))
    return pts


def _build_path(*waypoints):
    """Connect waypoints into a deduped axis-aligned path."""
    full = []
    for i in range(len(waypoints) - 1):
        seg = _seg(*waypoints[i], *waypoints[i + 1])
        if full:
            seg = seg[1:]
        full.extend(seg)
    return full


# ── Lane paths per level ──────────────────────────────────────────────────────
# Each level has 3 parallel lanes stacked vertically.
# Lane 0 (top): 3 enemies   — y-band  3– 8
# Lane 1 (mid): 5 enemies   — y-band 13–18 or similar
# Lane 2 (bot): 8 enemies   — y-band 23–28 or similar

# Level 1 – Crescent Bay: each lane dips downward (U-shape)
_LANES_1 = [
    _build_path((0, 3),  (10, 3),  (10, 8),  (20, 8),  (20, 3),  (31, 3)),   # top: 3 enemies
    _build_path((0, 13), (10, 13), (10, 18), (20, 18), (20, 13), (31, 13)),   # mid: 5 enemies
    _build_path((0, 23), (10, 23), (10, 28), (20, 28), (20, 23), (31, 23)),   # bot: 8 enemies
]

# Level 2 – River Bend: each lane arches upward (inverted-U shape)
_LANES_2 = [
    _build_path((0, 7),  (8,  7),  (8,  2),  (18, 2),  (18, 7),  (31, 7)),   # top: 3 enemies
    _build_path((0, 16), (10, 16), (10, 11), (22, 11), (22, 16), (31, 16)),   # mid: 5 enemies
    _build_path((0, 27), (12, 27), (12, 22), (22, 22), (22, 27), (31, 27)),   # bot: 8 enemies
]

# Level 3 – Serpentine: each lane zigzags twice (W-shape)
_LANES_3 = [
    _build_path((0, 3),  (5, 3),  (5, 8),  (11, 8),  (11, 3),  (17, 3),  (17, 8),  (31, 8)),   # top: 3 enemies
    _build_path((0, 14), (6, 14), (6, 19), (12, 19), (12, 14), (18, 14), (18, 19), (31, 19)),   # mid: 5 enemies
    _build_path((0, 25), (7, 25), (7, 30), (13, 30), (13, 25), (19, 25), (19, 30), (31, 30)),   # bot: 8 enemies
]

_LEVELS = [
    {"name": "Crescent Bay", "lane_paths": _LANES_1, "prep_time": 20},
    {"name": "River Bend",   "lane_paths": _LANES_2, "prep_time": 15},
    {"name": "Serpentine",   "lane_paths": _LANES_3, "prep_time": 15},
]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d["name"], data=d)
    for d in _LEVELS
]


# ── Render helpers ─────────────────────────────────────────────────────────────

def _fill(frame, lx, ly, color):
    px, py = lx * 2, ly * 2
    if 0 <= px < 63 and 0 <= py < 63:
        frame[py:py + 2, px:px + 2] = color


def _draw_range_circle(frame, lx, ly, radius_cells, color):
    """Draw a circle (Bresenham) around logical cell (lx, ly)."""
    cx = lx * 2 + 1
    cy = ly * 2 + 1
    r = int(radius_cells * 2)
    x, y, d = 0, r, 1 - r
    pts = []
    while x <= y:
        for px, py in [(cx+x, cy+y), (cx-x, cy+y), (cx+x, cy-y), (cx-x, cy-y),
                       (cx+y, cy+x), (cx-y, cy+x), (cx+y, cy-x), (cx-y, cy-x)]:
            pts.append((px, py))
        if d < 0:
            d += 2 * x + 3
        else:
            d += 2 * (x - y) + 5
            y -= 1
        x += 1
    for px, py in pts:
        if 0 <= px < 64 and 0 <= py < 64:
            frame[py, px] = color


# ── Display ───────────────────────────────────────────────────────────────────

class Td01Display(RenderableUserDisplay):
    def __init__(self, game: "Td01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game

        # Background: grass
        frame[:, :] = GRASS_C

        # Lane paths
        for lane_path in g.lane_paths:
            for (px, py) in lane_path:
                _fill(frame, px, py, PATH_C)

        # Gates (lane starts) and castle endpoints (lane ends)
        for lane_path in g.lane_paths:
            gx, gy = lane_path[0]
            _fill(frame, gx, gy, GATE_C)
            ex, ey = lane_path[-1]
            _fill(frame, ex, ey, CASTLE_C)

        # Tower range circles
        for (tx, ty) in g.towers:
            kind = g.tower_types.get((tx, ty), 'normal')
            if kind == 'slow':
                ring_c = SLOW_TOWER_C
            elif kind == 'laser':
                ring_c = LASER_TOWER_C
            elif kind == 'electric':
                ring_c = ELECTRIC_TOWER_TOP_C
            else:
                ring_c = 8
            _draw_range_circle(frame, tx, ty, TOWER_RANGE, ring_c)

        # Attack pellets
        for p in g.pellets:
            px = int(p['x'] * 2 + 1)
            py = int(p['y'] * 2 + 1)
            if p['kind'] == 'slow':
                pellet_c = SLOW_PELLET_C
            elif p['kind'] == 'laser':
                pellet_c = LASER_PELLET_C
            elif p['kind'] == 'electric':
                pellet_c = ELECTRIC_PELLET_C
            else:
                pellet_c = TOWER_TOP_C
            for dy in range(2):
                for dx in range(2):
                    if 0 <= px + dx < 64 and 0 <= py + dy < 64:
                        frame[py + dy, px + dx] = pellet_c

        # Towers
        for (tx, ty) in g.towers:
            kind = g.tower_types.get((tx, ty), 'normal')
            if kind == 'slow':
                _fill(frame, tx, ty, SLOW_TOWER_C)
                frame[ty * 2, tx * 2 + 1] = SLOW_TOWER_TOP_C
            elif kind == 'laser':
                _fill(frame, tx, ty, LASER_TOWER_C)
                frame[ty * 2, tx * 2 + 1] = LASER_TOWER_TOP_C
            elif kind == 'electric':
                _fill(frame, tx, ty, ELECTRIC_TOWER_C)
                frame[ty * 2, tx * 2 + 1] = ELECTRIC_TOWER_TOP_C
            else:
                _fill(frame, tx, ty, TOWER_C)
                frame[ty * 2, tx * 2 + 1] = TOWER_TOP_C

        # Enemies
        for e in g.enemies:
            ep = g.lane_paths[e["lane"]][e["idx"]]
            if e["burn"] > 0:
                color = BURNED_ENEMY_C
            elif e["slowed"] > 0:
                color = SLOWED_ENEMY_C
            else:
                color = ENEMY_C
            _fill(frame, ep[0], ep[1], color)

        # Cursor
        cc = CURSOR_NO_C if g._cursor_invalid() else CURSOR_C
        _fill(frame, g.cursor[0], g.cursor[1], cc)

        # HUD: money bar (top-left, rows 0-1)
        frame[0:2, 0:50] = 1
        blocks = min(g.money // KILL_REWARD, 12)
        for i in range(blocks):
            frame[0:2, 1 + i * 4: 1 + i * 4 + 3] = MONEY_C

        # HUD: selected tower type indicator (cols 50-51)
        if g.selected_tower == 'slow':
            sel_c = SLOW_TOWER_C
        elif g.selected_tower == 'laser':
            sel_c = LASER_TOWER_C
        elif g.selected_tower == 'electric':
            sel_c = ELECTRIC_TOWER_TOP_C   # white — visible against dark HUD bg
        else:
            sel_c = TOWER_C
        frame[0:2, 50:52] = sel_c

        # HUD: wave counter (top-right, rows 0-1, cols 52-63)
        frame[0:2, 52:64] = 1
        for i in range(WAVES_PER_LEVEL):
            col = WAVE_C if i < g.wave else 1
            c = 53 + i
            if c < 64:
                frame[0:2, c] = col

        # HUD: castle HP (bottom, rows 62-63)
        frame[62:64, 0:64] = 1
        for i in range(g.castle_hp):
            frame[62:64, 1 + i * 6: 1 + i * 6 + 4] = HP_C

        # HUD: PREP countdown bar (rows 0-1, overwrites center)
        if g.between_wave_timer > 0:
            d = _LEVELS[g.level_index]
            frac = g.between_wave_timer / d["prep_time"]
            bar = round(44 * frac)
            frame[0:2, 10:54] = 1
            if bar > 0:
                frame[0:2, 10:10 + bar] = 4

        return frame


# ── Game ──────────────────────────────────────────────────────────────────────

class Td01(ARCBaseGame):
    def __init__(self):
        self.display = Td01Display(self)

        # Mutable state – properly set by on_set_level
        self.lane_paths      = _LANES_1
        self.path_set        = set().union(*[set(lp) for lp in _LANES_1])
        self.cursor          = (2, 10)
        self.towers          = []
        self.tower_set       = set()
        self.enemies         = []
        self.money           = 100
        self.castle_hp       = 10
        self.wave            = 0
        self.enemies_spawned = [0] * NUM_LANES
        self.spawn_timer     = [0] * NUM_LANES
        self.between_wave_timer = 20
        self.step_count      = 0
        self.pellets         = []
        self.selected_tower  = 'normal'
        self.tower_types     = {}

        super().__init__(
            "td",
            levels,
            Camera(0, 0, 64, 64, GRASS_C, GRASS_C, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5, 6, 7],
        )

    # ── Level setup ───────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        d = _LEVELS[self.level_index]
        self.lane_paths      = d["lane_paths"]
        self.path_set        = set().union(*[set(lp) for lp in self.lane_paths])
        self.cursor          = (2, 10)
        self.towers          = []
        self.tower_set       = set()
        self.enemies         = []
        self.money           = 100
        self.castle_hp       = 10
        self.wave            = 0
        self.enemies_spawned = [0] * NUM_LANES
        self.spawn_timer     = [0] * NUM_LANES
        self.between_wave_timer = d["prep_time"]
        self.step_count      = 0
        self.pellets         = []
        self.tower_types     = {}
        # selected_tower persists across levels intentionally

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _cursor_invalid(self):
        return self.cursor in self.path_set or self.cursor in self.tower_set

    def _towers_shoot(self):
        """Each tower fires at the enemy furthest along its lane within range."""
        busy = {p['tower'] for p in self.pellets}
        for (tx, ty) in self.towers:
            if (tx, ty) in busy:
                continue
            kind = self.tower_types.get((tx, ty), 'normal')
            target = None
            best_progress = -1.0
            for e in self.enemies:
                ep = self.lane_paths[e["lane"]][e["idx"]]
                dist = math.sqrt((tx - ep[0]) ** 2 + (ty - ep[1]) ** 2)
                if dist <= TOWER_RANGE:
                    progress = e["idx"] / len(self.lane_paths[e["lane"]])
                    if progress > best_progress:
                        best_progress = progress
                        target = e
            if target is not None:
                ep = self.lane_paths[target["lane"]][target["idx"]]
                ex, ey = ep[0], ep[1]
                ddx, ddy = ex - tx, ey - ty
                dist = math.sqrt(ddx * ddx + ddy * ddy)
                if dist > 0:
                    ttl = math.ceil(dist / PELLET_SPEED) + 1
                    self.pellets.append({
                        'x': float(tx), 'y': float(ty),
                        'vx': ddx / dist * PELLET_SPEED,
                        'vy': ddy / dist * PELLET_SPEED,
                        'ttl': ttl,
                        'tower': (tx, ty),
                        'target': target,
                        'kind': kind,
                    })

    def _move_enemies(self):
        """Advance enemies along their lane; apply burn damage; slow affects speed."""
        reached = []
        burn_killed = []
        for e in self.enemies:
            if e["burn"] > 0:
                dmg = max(1, int(e["hp"] * 0.1))
                e["hp"] -= dmg
                e["burn"] -= 1
                if e["hp"] <= 0:
                    burn_killed.append(e)
                    continue

            if e["slowed"] > 0:
                e["slowed"] -= 1
            interval = SLOWED_MOVE_EVERY if e["slowed"] > 0 else ENEMY_MOVE_EVERY
            e["move_timer"] += 1
            if e["move_timer"] >= interval:
                e["move_timer"] = 0
                e["idx"] += 1
                if e["idx"] >= len(self.lane_paths[e["lane"]]):
                    reached.append(e)

        for e in burn_killed:
            if e in self.enemies:
                self.enemies.remove(e)
                self.money = min(200, self.money + e['reward'])
        for e in reached:
            if e in self.enemies:
                self.enemies.remove(e)
                self.castle_hp -= 1

    def _try_spawn(self):
        """Spawn one enemy per lane per step when spawn timer allows."""
        wave_lane_hps = LANE_WAVE_HEALTH[self.wave]
        for lane in range(NUM_LANES):
            lane_hps = wave_lane_hps[lane]
            if self.enemies_spawned[lane] >= len(lane_hps):
                continue
            if self.spawn_timer[lane] > 0:
                self.spawn_timer[lane] -= 1
                continue
            hp = lane_hps[self.enemies_spawned[lane]]
            reward = max(KILL_REWARD, hp // 2 * KILL_REWARD)
            self.enemies.append({
                "idx": 0, "hp": hp, "reward": reward,
                "move_timer": 0, "slowed": 0, "burn": 0,
                "lane": lane,
            })
            self.enemies_spawned[lane] += 1
            self.spawn_timer[lane] = SPAWN_INTERVAL

    def _apply_damage(self, enemy, dmg=1):
        """Deal dmg HP to enemy; remove and reward if it dies. Returns True if killed."""
        enemy['hp'] -= dmg
        if enemy['hp'] <= 0:
            if enemy in self.enemies:
                self.enemies.remove(enemy)
                self.money = min(200, self.money + enemy['reward'])
            return True
        return False

    def _move_pellets(self):
        """Advance pellets; apply damage and effects when they land."""
        alive = []
        for p in self.pellets:
            p['x'] += p['vx']
            p['y'] += p['vy']
            p['ttl'] -= 1
            if p['ttl'] > 0 and 0 <= p['x'] < GL and 0 <= p['y'] < GL:
                alive.append(p)
            else:
                t = p['target']
                if p['kind'] == 'slow':
                    if t in self.enemies:
                        t['slowed'] = SLOW_DURATION
                elif p['kind'] == 'laser':
                    if t in self.enemies:
                        t['burn'] = BURN_DURATION
                elif p['kind'] == 'electric':
                    # Primary hit
                    t_progress = t["idx"] / len(self.lane_paths[t["lane"]])
                    if t in self.enemies:
                        self._apply_damage(t)
                    # Chain: 3 enemies with the highest progress that is still
                    # below the primary target (i.e. furthest behind it)
                    behind = sorted(
                        [e for e in self.enemies if e is not t],
                        key=lambda e: e["idx"] / len(self.lane_paths[e["lane"]]),
                        reverse=True,
                    )
                    chain_targets = [
                        e for e in behind
                        if e["idx"] / len(self.lane_paths[e["lane"]]) < t_progress
                    ][:3]
                    for ct in chain_targets:
                        if ct in self.enemies:
                            self._apply_damage(ct)
                else:
                    if t in self.enemies:
                        self._apply_damage(t)
        self.pellets = alive

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value
        self.step_count += 1

        # Player action
        cx, cy = self.cursor
        if aid == 1 and cy > 0:
            self.cursor = (cx, cy - 1)
        elif aid == 2 and cy < GL - 1:
            self.cursor = (cx, cy + 1)
        elif aid == 3 and cx > 0:
            self.cursor = (cx - 1, cy)
        elif aid == 4 and cx < GL - 1:
            self.cursor = (cx + 1, cy)
        elif aid == 5:
            if (cx, cy) in self.tower_set:
                self.towers.remove((cx, cy))
                self.tower_set.discard((cx, cy))
                self.tower_types.pop((cx, cy), None)
                self.pellets = [p for p in self.pellets if p['tower'] != (cx, cy)]
                self.money = min(200, self.money + TOWER_SELL_PRICE)
            else:
                if self.selected_tower == 'slow':
                    cost = SLOW_TOWER_COST
                elif self.selected_tower == 'laser':
                    cost = LASER_TOWER_COST
                elif self.selected_tower == 'electric':
                    cost = ELECTRIC_TOWER_COST
                else:
                    cost = TOWER_COST
                if (cx, cy) not in self.path_set and self.money >= cost:
                    self.towers.append((cx, cy))
                    self.tower_set.add((cx, cy))
                    self.tower_types[(cx, cy)] = self.selected_tower
                    self.money -= cost
        elif aid == 7:
            _cycle = ['normal', 'slow', 'laser', 'electric']
            self.selected_tower = _cycle[(_cycle.index(self.selected_tower) + 1) % len(_cycle)]

        # Prep phase: countdown before each wave
        if self.between_wave_timer > 0:
            self.between_wave_timer -= 1
            self.complete_action()
            return

        # Wave-active phase
        self._try_spawn()
        self._move_enemies()
        self._towers_shoot()
        self._move_pellets()

        # Check lose
        if self.castle_hp <= 0:
            self.lose()
            self.complete_action()
            return

        # Check wave complete: all lanes fully spawned and no enemies alive
        wave_lane_hps = LANE_WAVE_HEALTH[self.wave]
        all_spawned = all(
            self.enemies_spawned[l] >= len(wave_lane_hps[l])
            for l in range(NUM_LANES)
        )
        if all_spawned and not self.enemies:
            self.wave += 1
            if self.wave >= WAVES_PER_LEVEL:
                if not self.is_last_level():
                    self.next_level()
                else:
                    self.win()
                self.complete_action()
                return
            self.enemies_spawned = [0] * NUM_LANES
            self.spawn_timer     = [0] * NUM_LANES
            self.between_wave_timer = _LEVELS[self.level_index]["prep_time"]

        self.complete_action()
