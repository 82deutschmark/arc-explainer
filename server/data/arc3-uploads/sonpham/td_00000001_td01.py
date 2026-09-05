"""
td – Tower Defense  (ARC-AGI-3 game)

Controls
--------
ACTION1 (^): Move cursor up
ACTION2 (v): Move cursor down
ACTION3 (<): Move cursor left
ACTION4 (>): Move cursor right
ACTION5    : Place tower at cursor
ACTION6    : Cycle tower type (normal 50g → slow 25g → laser 75g)
ACTION7    : Sell tower under cursor (refund 25g)

Goal: Survive 5 waves of enemies.
- Start with 100 money; each kill earns 25.
- Enemies march from the gate along the path to the castle.
- Castle has 10 HP; each enemy that reaches it deals 1 damage.
- Place towers on green cells to auto-attack enemies in range.
- Normal tower: fires pellets that deal 1 HP damage.
- Slow tower: fires pellets that slow enemies for 20 steps.
- Laser tower: fires a beam that sets enemies on fire — burns for
  10 steps, draining 10% of current HP each step.
- Three levels with increasingly complex paths.
"""

import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

GL = 32   # logical grid size → 64×64 pixel frame (2×2 per cell)

# ── Colour palette ───────────────────────────────────────────────────────────
#  0=black  1=dark-blue  2=green   3=dark-gray  4=yellow   5=gray
#  6=pink   7=orange     8=azure   9=blue      11=bright-yellow
# 12=red   14=lime       15=white

GRASS_C          = 2    # green – placeable field
PATH_C           = 3    # dark-gray – enemy road
GATE_C           = 14   # lime – enemy spawn point
CASTLE_C         = 9    # blue – player castle
TOWER_C          = 7    # orange – normal tower base
TOWER_TOP_C      = 11   # bright-yellow – normal tower tip / pellet
SLOW_TOWER_C     = 8    # azure – slow tower base
SLOW_TOWER_TOP_C = 15   # white – slow tower tip
SLOW_PELLET_C    = 1    # dark-blue – slow tower pellet
LASER_TOWER_C    = 12   # red – laser tower base
LASER_TOWER_TOP_C= 4    # yellow – laser tower tip
LASER_PELLET_C   = 4    # yellow – laser beam pellet
ENEMY_C          = 12   # red – enemy
SLOWED_ENEMY_C   = 6    # pink – slowed enemy
BURNED_ENEMY_C   = 7    # orange – burning enemy
CURSOR_C         = 9    # purple – valid placement cursor
CURSOR_NO_C      = 5    # gray – invalid placement cursor
MONEY_C          = 11   # bright-yellow – HUD money
HP_C             = 12   # red – HUD castle HP
WAVE_C           = 8    # azure – HUD wave dots

# ── Game constants ────────────────────────────────────────────────────────────
TOWER_RANGE      = 3.0   # Euclidean attack range in cells
TOWER_COST       = 50
SLOW_TOWER_COST  = 25
LASER_TOWER_COST = 75
TOWER_SELL_PRICE = 25
KILL_REWARD      = 25
WAVES_PER_LEVEL  = 5
BURN_DURATION    = 10   # steps an enemy stays burning after laser hit

# HP values for each enemy in each wave (index = spawn order)
WAVE_HEALTH = [
    [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],           # wave 1: +2 each
    [3, 6, 9, 12, 15, 18],                            # wave 2: +3 each
    [4, 8, 12, 16, 20, 24, 28, 32],                   # wave 3: +4 each
    [5, 10, 15, 20, 25, 30, 35, 40],                  # wave 4: +5 each
    [2, 5, 3, 10, 15, 2, 5, 3, 10, 15],               # wave 5: repeating pattern
]
SPAWN_INTERVAL   = 6    # steps between enemy spawns within a wave
ENEMY_MOVE_EVERY = 2    # enemies advance 1 cell every N player steps
SLOWED_MOVE_EVERY= 6    # slowed enemies advance 1 cell every N player steps
SLOW_DURATION    = 20   # steps an enemy stays slowed
PELLET_SPEED     = 1.5  # pellet travel speed in logical cells per step


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
            seg = seg[1:]   # drop duplicate junction point
        full.extend(seg)
    return full


def _widen_path(path, width=1):
    """Return a set of all cells within `width` perpendicular to the path centerline."""
    wide = set(path)
    for i, (px, py) in enumerate(path):
        # Determine local movement direction
        if i < len(path) - 1:
            nx, ny = path[i + 1]
            dx, dy = nx - px, ny - py
        else:
            px2, py2 = path[i - 1]
            dx, dy = px - px2, py - py2
        # If moving horizontally, expand vertically; if vertically, expand horizontally
        if dx != 0:  # horizontal movement → perp is vertical
            for w in range(1, width + 1):
                if 0 <= py + w < GL:
                    wide.add((px, py + w))
                if 0 <= py - w < GL:
                    wide.add((px, py - w))
        else:  # vertical movement → perp is horizontal
            for w in range(1, width + 1):
                if 0 <= px + w < GL:
                    wide.add((px + w, py))
                if 0 <= px - w < GL:
                    wide.add((px - w, py))
    return wide


# ── Hardcoded level paths ─────────────────────────────────────────────────────

# Level 1 – Crescent Bay: U-shape
_PATH1 = _build_path(
    (0, 8), (14, 8), (14, 22), (28, 22), (28, 8), (31, 8)
)

# Level 2 – River Bend: S-curve
_PATH2 = _build_path(
    (0, 4), (8, 4), (8, 14), (22, 14), (22, 24), (31, 24)
)

# Level 3 – Serpentine: tight zigzag
_PATH3 = _build_path(
    (0, 28), (6, 28), (6, 4), (16, 4), (16, 20), (24, 20), (24, 10), (31, 10)
)

_LEVELS = [
    {"name": "Crescent Bay", "path": _PATH1, "enemy_hp": 2, "prep_time": 20},
    {"name": "River Bend",   "path": _PATH2, "enemy_hp": 2, "prep_time": 15},
    {"name": "Serpentine",   "path": _PATH3, "enemy_hp": 2, "prep_time": 15},
]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d["name"], data=d)
    for d in _LEVELS
]


# ── Render helper ─────────────────────────────────────────────────────────────

def _fill(frame, lx, ly, color):
    px, py = lx * 2, ly * 2
    if 0 <= px < 63 and 0 <= py < 63:
        frame[py:py + 2, px:px + 2] = color


def _draw_range_circle(frame, lx, ly, radius_cells, color):
    """Draw a dashed circle (Bresenham) around logical cell (lx, ly)."""
    cx = lx * 2 + 1
    cy = ly * 2 + 1
    r = int(radius_cells * 2)
    x, y, d = 0, r, 1 - r
    pts = []
    while x <= y:
        for px, py in [(cx+x,cy+y),(cx-x,cy+y),(cx+x,cy-y),(cx-x,cy-y),
                       (cx+y,cy+x),(cx-y,cy+x),(cx+y,cy-x),(cx-y,cy-x)]:
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
        path = g.path

        # ── Background: grass ────────────────────────────────────────────────
        frame[:, :] = GRASS_C

        # ── Path (3 cells wide) ───────────────────────────────────────────────
        for (px, py) in g.wide_path_set:
            _fill(frame, px, py, PATH_C)

        # ── Gate & Castle ─────────────────────────────────────────────────────
        gx, gy = path[0]
        ex, ey = path[-1]
        _fill(frame, gx, gy, GATE_C)
        _fill(frame, ex, ey, CASTLE_C)

        # ── Tower range circles ───────────────────────────────────────────────
        for (tx, ty) in g.towers:
            kind = g.tower_types.get((tx, ty), 'normal')
            if kind == 'slow':
                ring_c = SLOW_TOWER_C
            elif kind == 'laser':
                ring_c = LASER_TOWER_C
            else:
                ring_c = 8
            _draw_range_circle(frame, tx, ty, TOWER_RANGE, ring_c)

        # ── Attack pellets ────────────────────────────────────────────────────
        for p in g.pellets:
            px = int(p['x'] * 2 + 1)
            py = int(p['y'] * 2 + 1)
            if p['kind'] == 'slow':
                pellet_c = SLOW_PELLET_C
            elif p['kind'] == 'laser':
                pellet_c = LASER_PELLET_C
            else:
                pellet_c = TOWER_TOP_C
            for dy in range(2):
                for dx in range(2):
                    if 0 <= px + dx < 64 and 0 <= py + dy < 64:
                        frame[py + dy, px + dx] = pellet_c

        # ── Towers ────────────────────────────────────────────────────────────
        for (tx, ty) in g.towers:
            kind = g.tower_types.get((tx, ty), 'normal')
            if kind == 'slow':
                _fill(frame, tx, ty, SLOW_TOWER_C)
                frame[ty * 2, tx * 2 + 1] = SLOW_TOWER_TOP_C
            elif kind == 'laser':
                _fill(frame, tx, ty, LASER_TOWER_C)
                frame[ty * 2, tx * 2 + 1] = LASER_TOWER_TOP_C
            else:
                _fill(frame, tx, ty, TOWER_C)
                frame[ty * 2, tx * 2 + 1] = TOWER_TOP_C

        # ── Enemies ───────────────────────────────────────────────────────────
        for e in g.enemies:
            ep = path[e["idx"]]
            if e["burn"] > 0:
                color = BURNED_ENEMY_C
            elif e["slowed"] > 0:
                color = SLOWED_ENEMY_C
            else:
                color = ENEMY_C
            _fill(frame, ep[0], ep[1], color)

        # ── Cursor (always visible) ───────────────────────────────────────────
        cc = CURSOR_NO_C if g._cursor_invalid() else CURSOR_C
        _fill(frame, g.cursor[0], g.cursor[1], cc)

        # ── HUD: money bar (top-left, rows 0-1) ──────────────────────────────
        frame[0:2, 0:50] = 1   # dark-blue track
        blocks = min(g.money // KILL_REWARD, 12)   # 1 block = 25 money, max 12
        for i in range(blocks):
            frame[0:2, 1 + i * 4: 1 + i * 4 + 3] = MONEY_C

        # ── HUD: selected tower type indicator (cols 50-51) ──────────────────
        if g.selected_tower == 'slow':
            sel_c = SLOW_TOWER_C
        elif g.selected_tower == 'laser':
            sel_c = LASER_TOWER_C
        else:
            sel_c = TOWER_C
        frame[0:2, 50:52] = sel_c

        # ── HUD: wave counter (top-right, rows 0-1, cols 52-63) ──────────────
        frame[0:2, 52:64] = 1
        for i in range(WAVES_PER_LEVEL):
            col = WAVE_C if i < g.wave else 1
            c = 53 + i
            if c < 64:
                frame[0:2, c] = col

        # ── HUD: castle HP (bottom, rows 62-63) ──────────────────────────────
        frame[62:64, 0:64] = 1   # dark-blue track
        for i in range(g.castle_hp):
            frame[62:64, 1 + i * 6: 1 + i * 6 + 4] = HP_C

        # ── HUD: PREP countdown bar (rows 0-1, overwrites center) ────────────
        if g.between_wave_timer > 0:
            d = _LEVELS[g.level_index]
            frac = g.between_wave_timer / d["prep_time"]
            bar = round(44 * frac)
            frame[0:2, 10:54] = 1          # clear center of top strip
            if bar > 0:
                frame[0:2, 10:10 + bar] = 4   # yellow countdown

        return frame


# ── Game ──────────────────────────────────────────────────────────────────────

class Td01(ARCBaseGame):
    def __init__(self):
        self.display = Td01Display(self)

        # Mutable state – will be properly set by on_set_level
        self.path            = _PATH1
        self.wide_path_set   = _widen_path(_PATH1)
        self.path_set        = self.wide_path_set
        self.cursor          = (2, 2)
        self.towers          = []
        self.tower_set       = set()
        self.enemies         = []
        self.money           = 100
        self.castle_hp       = 10
        self.wave            = 0
        self.enemies_spawned = 0
        self.spawn_timer     = 0
        self.between_wave_timer = 20
        self.step_count      = 0
        self.enemy_hp_val    = 1
        self.pellets         = []   # in-flight projectiles: {x,y,vx,vy,ttl,tower,target,kind}
        self.selected_tower  = 'normal'   # 'normal' or 'slow'
        self.tower_types     = {}         # (x,y) -> 'normal' or 'slow'

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
        self.path            = d["path"]
        self.wide_path_set   = _widen_path(d["path"])
        self.path_set        = self.wide_path_set
        self.cursor          = (2, 2)
        self.towers          = []
        self.tower_set       = set()
        self.enemies         = []
        self.money           = 100
        self.castle_hp       = 10
        self.wave            = 0
        self.enemies_spawned = 0
        self.spawn_timer     = 0
        self.between_wave_timer = d["prep_time"]
        self.step_count      = 0
        self.enemy_hp_val    = d["enemy_hp"]
        self.pellets         = []
        self.tower_types     = {}
        # selected_tower persists across levels intentionally

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _cursor_invalid(self):
        return self.cursor in self.path_set or self.cursor in self.tower_set

    def _towers_shoot(self):
        """Each tower fires one pellet at a time; waits until it lands before reloading."""
        busy = {p['tower'] for p in self.pellets}
        for (tx, ty) in self.towers:
            if (tx, ty) in busy:
                continue
            kind = self.tower_types.get((tx, ty), 'normal')
            target = None
            best_idx = -1
            for e in self.enemies:
                ep = self.path[e["idx"]]
                dist = math.sqrt((tx - ep[0]) ** 2 + (ty - ep[1]) ** 2)
                if dist <= TOWER_RANGE and e["idx"] > best_idx:
                    best_idx = e["idx"]
                    target = e
            if target is not None:
                ep = self.path[target["idx"]]
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
        """Advance enemies along the path; apply burn damage; slowed enemies move less."""
        reached = []
        burn_killed = []
        for e in self.enemies:
            # Burn damage: 10% of current HP per step, min 1
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
                if e["idx"] >= len(self.path):
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
        """Spawn one enemy at the gate if the spawn timer allows."""
        wave_hps = WAVE_HEALTH[self.wave]
        if self.enemies_spawned >= len(wave_hps):
            return
        if self.spawn_timer > 0:
            self.spawn_timer -= 1
            return
        hp = wave_hps[self.enemies_spawned]
        reward = hp // 2 * KILL_REWARD
        self.enemies.append({"idx": 0, "hp": hp, "reward": reward,
                             "move_timer": 0, "slowed": 0, "burn": 0})
        self.enemies_spawned += 1
        self.spawn_timer = SPAWN_INTERVAL

    def _move_pellets(self):
        """Advance pellets; apply damage and remove enemies when a pellet lands."""
        alive = []
        for p in self.pellets:
            p['x'] += p['vx']
            p['y'] += p['vy']
            p['ttl'] -= 1
            if p['ttl'] > 0 and 0 <= p['x'] < GL and 0 <= p['y'] < GL:
                alive.append(p)
            else:
                # Pellet landed
                t = p['target']
                if t in self.enemies:
                    if p['kind'] == 'slow':
                        t['slowed'] = SLOW_DURATION
                    elif p['kind'] == 'laser':
                        t['burn'] = BURN_DURATION   # ignite / refresh burn
                    else:
                        t['hp'] -= 1
                        if t['hp'] <= 0:
                            self.enemies.remove(t)
                            self.money = min(200, self.money + t['reward'])
        self.pellets = alive

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self) -> None:
        aid = self.action.id.value
        self.step_count += 1

        # ── Player action ──────────────────────────────────────────────────────
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
            if self.selected_tower == 'slow':
                cost = SLOW_TOWER_COST
            elif self.selected_tower == 'laser':
                cost = LASER_TOWER_COST
            else:
                cost = TOWER_COST
            if not self._cursor_invalid() and self.money >= cost:
                self.towers.append((cx, cy))
                self.tower_set.add((cx, cy))
                self.tower_types[(cx, cy)] = self.selected_tower
                self.money -= cost
        elif aid == 6:
            # Cycle tower type: normal → slow → laser → normal
            if self.selected_tower == 'normal':
                self.selected_tower = 'slow'
            elif self.selected_tower == 'slow':
                self.selected_tower = 'laser'
            else:
                self.selected_tower = 'normal'
        elif aid == 7:
            # Sell tower under cursor
            if (cx, cy) in self.tower_set:
                self.towers.remove((cx, cy))
                self.tower_set.discard((cx, cy))
                self.tower_types.pop((cx, cy), None)
                self.pellets = [p for p in self.pellets if p['tower'] != (cx, cy)]
                self.money = min(200, self.money + TOWER_SELL_PRICE)

        # ── Prep phase: countdown before each wave ────────────────────────────
        if self.between_wave_timer > 0:
            self.between_wave_timer -= 1
            self.complete_action()
            return

        # ── Wave-active phase ─────────────────────────────────────────────────
        self._try_spawn()

        self._move_enemies()

        self._towers_shoot()
        self._move_pellets()

        # ── Check lose ────────────────────────────────────────────────────────
        if self.castle_hp <= 0:
            self.lose()
            self.complete_action()
            return

        # ── Check wave complete ───────────────────────────────────────────────
        if self.enemies_spawned >= len(WAVE_HEALTH[self.wave]) and not self.enemies:
            self.wave += 1
            if self.wave >= WAVES_PER_LEVEL:
                # All 10 waves cleared
                if not self.is_last_level():
                    self.next_level()
                else:
                    self.win()
                self.complete_action()
                return
            # Begin prep for next wave
            self.enemies_spawned = 0
            self.spawn_timer = 0
            self.between_wave_timer = _LEVELS[self.level_index]["prep_time"]

        self.complete_action()
