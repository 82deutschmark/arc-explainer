"""Parallel Clone (pc01) — Temporal collaboration puzzle.

The player records actions over a temporal loop. When the loop timer expires,
time resets and a clone spawns that replays the exact past actions. Multiple
loops stack clones. All clones (and the player) must cooperate to reach the
exit — typically by standing on pressure plates simultaneously.

Mechanics:
- Loop duration is fixed per level (LOOP_STEPS).
- When the timer hits 0, the current recording is saved, all positions reset,
  and clones begin replaying their recorded moves.
- Pressure plates require a body standing on them to stay active.
- When ALL plates are active simultaneously, the exit opens.
- The PLAYER (not a clone) must reach the open exit to win.
- Traps (spikes) kill any entity that steps on them.
- Enemies patrol and kill on contact.
- If a clone dies, its plate contribution is lost.
- ACTION5 = "wait" (do nothing but advance the timer).
"""

import numpy as np
from arcengine import ARCBaseGame, Camera, Level
from arcengine.interfaces import RenderableUserDisplay

# -- Palette (ARC3 16-color palette) --
# 0=White,1=LightGray,2=Gray,3=DarkGray,4=VeryDarkGray,5=Black
# 6=Magenta,7=LightMagenta,8=Red,9=Blue,10=LightBlue,11=Yellow
# 12=Orange,13=Maroon,14=Green,15=Purple
BG_C           = 5   # Black — background
FLOOR_C        = 5   # Black — walkable floor
WALL_C         = 4   # VeryDarkGray — walls
PLATE_C        = 2   # Gray — inactive plate
PLATE_ACTIVE_C = 14  # Green — active plate
EXIT_CLOSED_C  = 9   # Blue — locked exit
EXIT_OPEN_C    = 14  # Green — open exit
PLAYER_C       = 11  # Yellow — player
CLONE_COLORS   = [6, 15, 10]  # Magenta, Purple, LightBlue
SPIKE_C        = 12  # Orange — spikes
ENEMY_C        = 8   # Red — enemies
TIMER_C        = 14  # Green — timer bar
LOOP_C         = 9   # Blue — loop counter

# Cell size in pixels (each grid cell = CELL x CELL pixels)
CELL = 3
# HUD height
HUD_H = 4
# Direction deltas: up, down, left, right
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}

# ── Level Definitions ──────────────────────────────────────────────────────

def _make_level(name, grid, player_start, loop_steps, plates, exit_pos,
                spikes=None, enemies=None, num_clones_needed=1):
    return {
        "name": name,
        "grid": grid,
        "player_start": player_start,
        "loop_steps": loop_steps,
        "plates": plates,
        "exit_pos": exit_pos,
        "spikes": spikes or [],
        "enemies": enemies or [],
        "num_clones_needed": num_clones_needed,
    }

# ── Level 1: "First Echo" — 1 plate, 1 clone ──
# 8x8 grid. Clone walks to plate, player walks to exit.
_G1 = [
    [1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,1],
    [1,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1],
]
# BFS: plate(2,5)=5 steps, exit(6,6)=10 steps. loop=12 OK.
_L1 = _make_level("First Echo", _G1, (1,1), 12, [(2,5)], (6,6), num_clones_needed=1)

# ── Level 2: "Double Duty" — 2 plates, 2 clones ──
# 10x8 grid
_G2 = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1],
]
# BFS: plate_a(2,3)=3, plate_b(2,5)=5, exit(8,4)=10. loop=12 OK.
_L2 = _make_level("Double Duty", _G2, (1,1), 12, [(2,3),(2,5)], (8,4), num_clones_needed=2)

# ── Level 3: "Spike Corridor" — 2 plates + spikes, 2 clones ──
# 10x10 grid
_G3 = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1],
]
# BFS: plate_a(1,4)=3, plate_b(1,6)=5, exit(8,5)=11. loop=14.
# Spikes at (5,3),(5,7) block shortcuts through the center.
_L3 = _make_level("Spike Corridor", _G3, (1,1), 14,
                   [(1,4),(1,6)], (8,5),
                   spikes=[(5,3),(5,7)],
                   num_clones_needed=2)

# ── Level 4: "Triple Threat" — 3 plates, 3 clones ──
# 12x10 grid with internal walls creating three chambers
_G4 = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,1,0,0,0,1],
    [1,0,0,0,1,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,1,0,0,0,1],
    [1,0,0,0,1,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
]
# BFS: plate_a(2,3)=3, plate_b(2,7)=7, plate_c(9,5)=12, exit(5,5)=8. loop=15.
_L4 = _make_level("Triple Threat", _G4, (1,1), 15,
                   [(2,3),(2,7),(9,5)], (5,5),
                   num_clones_needed=3)

# ── Level 5: "The Gauntlet" — 3 plates + spikes + enemy ──
# 12x10 grid
_G5 = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
]
# BFS: plate_a(1,5)=4, plate_b(5,1)=4, plate_c(10,5)=13, exit(5,8)=11. loop=16.
# Enemy patrols center column. Spikes guard corners.
_L5 = _make_level("The Gauntlet", _G5, (1,1), 16,
                   [(1,5),(5,1),(10,5)], (5,8),
                   spikes=[(4,4),(6,4),(4,6),(6,6)],
                   enemies=[{"pos":(5,5),"path":[(5,5),(5,4),(5,3),(5,2),(5,3),(5,4),(5,5),(5,6),(5,7),(5,8),(5,7),(5,6)]}],
                   num_clones_needed=3)

# ── Level 6: "Maze of Echoes" — maze, 3 plates, spikes, enemy ──
# 12x12 grid
_G6 = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,1,0,1],
    [1,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,0,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
]
# BFS: plate_a(1,9)=12, plate_b(5,5)=8, plate_c(10,1)=13, exit(10,9)=17. loop=20.
_L6 = _make_level("Maze of Echoes", _G6, (1,1), 20,
                   [(1,9),(5,5),(10,1)], (10,9),
                   spikes=[(3,5),(9,3)],
                   enemies=[{"pos":(5,7),"path":[(5,7),(5,8),(5,9),(5,8),(5,7)]}],
                   num_clones_needed=3)

# ── Level 7: "Paradox Engine" — maze, 3 plates, 2 enemies, spikes ──
# 14x12 grid
_G7 = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,0,0,1,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,1,0,1],
    [1,1,0,1,1,1,0,1,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,1,0,1],
    [1,0,1,1,0,0,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,0,1,0,1,0,1,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]
# BFS: plate_a(1,10)=11, plate_b(6,5)=9, plate_c(12,10)=20, exit(12,1)=15. loop=24.
_L7 = _make_level("Paradox Engine", _G7, (1,1), 24,
                   [(1,10),(6,5),(12,10)], (12,1),
                   spikes=[(3,5),(8,3),(4,8)],
                   enemies=[
                       {"pos":(6,1),"path":[(6,1),(6,2),(6,3),(6,2),(6,1)]},
                       {"pos":(7,10),"path":[(7,10),(8,10),(9,10),(10,10),(9,10),(8,10)]},
                   ],
                   num_clones_needed=3)

_LEVEL_CONFIGS = [_L1, _L2, _L3, _L4, _L5, _L6, _L7]

levels = [
    Level(sprites=[], grid_size=(64, 64), name=cfg["name"], data=cfg)
    for cfg in _LEVEL_CONFIGS
]


# ── Display ─────────────────────────────────────────────────────────────────

class Pc01Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def _fill(self, frame, gx, gy, color, ox, oy):
        """Fill a CELL x CELL block at grid position (gx, gy)."""
        px = ox + gx * CELL
        py = oy + gy * CELL
        for dy in range(CELL):
            for dx in range(CELL):
                fx, fy = px + dx, py + dy
                if 0 <= fx < 64 and 0 <= fy < 64:
                    frame[fy, fx] = color

    def _fill_inner(self, frame, gx, gy, color, ox, oy):
        """Fill inner pixel of a cell (leaves 1px border)."""
        px = ox + gx * CELL + 1
        py = oy + gy * CELL + 1
        if 0 <= px < 64 and 0 <= py < 64:
            frame[py, px] = color

    def render_interface(self, frame):
        g = self.game
        if not hasattr(g, '_grid') or g._grid is None:
            return frame

        frame[:, :] = BG_C

        grid = g._grid
        rows = len(grid)
        cols = len(grid[0]) if rows > 0 else 0

        # Center the grid
        grid_w = cols * CELL
        grid_h = rows * CELL
        ox = (64 - grid_w) // 2
        oy = HUD_H + (64 - HUD_H - grid_h) // 2
        if oy < HUD_H:
            oy = HUD_H

        # Draw grid: walls
        for gy in range(rows):
            for gx in range(cols):
                if grid[gy][gx] == 1:
                    self._fill(frame, gx, gy, WALL_C, ox, oy)

        # Draw spikes (X pattern)
        for (sx, sy) in g._spikes:
            px = ox + sx * CELL
            py = oy + sy * CELL
            # corners
            for corner in [(0,0),(2,0),(0,2),(2,2)]:
                fx, fy = px + corner[0], py + corner[1]
                if 0 <= fx < 64 and 0 <= fy < 64:
                    frame[fy, fx] = SPIKE_C
            # center
            self._fill_inner(frame, sx, sy, SPIKE_C, ox, oy)

        # Draw pressure plates
        for i, (ppx, ppy) in enumerate(g._plates):
            active = g._plate_active[i]
            c = PLATE_ACTIVE_C if active else PLATE_C
            self._fill(frame, ppx, ppy, c, ox, oy)

        # Draw exit
        ex, ey = g._exit_pos
        c = EXIT_OPEN_C if g._exit_open else EXIT_CLOSED_C
        self._fill(frame, ex, ey, c, ox, oy)

        # Draw enemies at animated pixel positions
        for en in g._enemies:
            if en["alive"]:
                epx = ox + en["x"] * CELL + en["anim_dx"]
                epy = oy + en["y"] * CELL + en["anim_dy"]
                for dy in range(CELL):
                    for dx in range(CELL):
                        fx, fy = epx + dx, epy + dy
                        if 0 <= fx < 64 and 0 <= fy < 64:
                            frame[fy, fx] = ENEMY_C
                # Advance animation offset by 1 pixel toward 0
                if en["anim_dx"] > 0: en["anim_dx"] -= 1
                elif en["anim_dx"] < 0: en["anim_dx"] += 1
                if en["anim_dy"] > 0: en["anim_dy"] -= 1
                elif en["anim_dy"] < 0: en["anim_dy"] += 1

        # Draw clones at animated pixel positions (oldest first)
        for ci, clone in enumerate(g._clones):
            if clone["alive"]:
                cc = CLONE_COLORS[ci % len(CLONE_COLORS)]
                cpx = ox + clone["x"] * CELL + clone["anim_dx"] + 1
                cpy = oy + clone["y"] * CELL + clone["anim_dy"] + 1
                if 0 <= cpx < 64 and 0 <= cpy < 64:
                    frame[cpy, cpx] = cc
                if clone["anim_dx"] > 0: clone["anim_dx"] -= 1
                elif clone["anim_dx"] < 0: clone["anim_dx"] += 1
                if clone["anim_dy"] > 0: clone["anim_dy"] -= 1
                elif clone["anim_dy"] < 0: clone["anim_dy"] += 1

        # Draw player at animated pixel position (on top)
        ppx = ox + g._px * CELL + g._anim_dx + 1
        ppy = oy + g._py * CELL + g._anim_dy + 1
        if 0 <= ppx < 64 and 0 <= ppy < 64:
            frame[ppy, ppx] = PLAYER_C
        if g._anim_dx > 0: g._anim_dx -= 1
        elif g._anim_dx < 0: g._anim_dx += 1
        if g._anim_dy > 0: g._anim_dy -= 1
        elif g._anim_dy < 0: g._anim_dy += 1

        # ── HUD ──
        frame[0:HUD_H, 0:64] = BG_C

        # Timer bar (green, left side, up to 30px wide)
        if g._loop_steps > 0:
            bar_max = 30
            filled = int(bar_max * g._timer / g._loop_steps)
            for bx in range(filled):
                frame[1:HUD_H - 1, 1 + bx] = TIMER_C

        # Loop counter (cyan dots, right side)
        for li in range(g._loop_count + 1):
            dot_x = 62 - li * 3
            if dot_x >= 34:
                frame[1:HUD_H - 1, dot_x:dot_x + 2] = LOOP_C

        # Clone count (colored dots, middle)
        for ci in range(len(g._clones)):
            cc = CLONE_COLORS[ci % len(CLONE_COLORS)]
            dx = 34 + ci * 3
            if dx + 2 < 58:
                frame[1:HUD_H - 1, dx:dx + 2] = cc

        return frame


# ── Game Class ──────────────────────────────────────────────────────────────

class Pc01(ARCBaseGame):
    def __init__(self):
        self.display = Pc01Display(self)

        # Mutable state — reset in on_set_level
        self._grid = None
        self._px = 1
        self._py = 1
        self._anim_dx = 0
        self._anim_dy = 0
        self._plates = []
        self._plate_active = []
        self._exit_pos = (0, 0)
        self._exit_open = False
        self._spikes = []
        self._enemies = []
        self._enemy_defs = []
        self._clones = []
        self._recordings = []
        self._current_recording = []
        self._timer = 0
        self._loop_steps = 10
        self._loop_count = 0
        self._num_clones_needed = 1
        self._step_in_loop = 0
        self._anim_ticks = 0  # animation frames remaining before complete_action

        super().__init__(
            "pc",
            levels,
            Camera(0, 0, 64, 64, BG_C, BG_C, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 5],  # d-pad + wait
        )

    def on_set_level(self, level):
        cfg = _LEVEL_CONFIGS[self.level_index]
        self._grid = [row[:] for row in cfg["grid"]]
        sx, sy = cfg["player_start"]
        self._px = sx
        self._py = sy
        self._anim_dx = 0
        self._anim_dy = 0
        self._plates = list(cfg["plates"])
        self._plate_active = [False] * len(self._plates)
        self._exit_pos = cfg["exit_pos"]
        self._exit_open = False
        self._spikes = list(cfg.get("spikes", []))
        self._loop_steps = cfg["loop_steps"]
        self._num_clones_needed = cfg["num_clones_needed"]
        self._timer = self._loop_steps
        self._loop_count = 0
        self._clones = []
        self._recordings = []
        self._current_recording = []
        self._step_in_loop = 0
        self._anim_ticks = 0

        # Init enemies
        self._enemy_defs = cfg.get("enemies", [])
        self._enemies = []
        for edef in self._enemy_defs:
            ex, ey = edef["pos"]
            self._enemies.append({
                "x": ex, "y": ey, "anim_dx": 0, "anim_dy": 0,
                "alive": True, "path": list(edef["path"]), "path_idx": 0,
            })

    def _can_move(self, x, y):
        rows = len(self._grid)
        cols = len(self._grid[0])
        if x < 0 or x >= cols or y < 0 or y >= rows:
            return False
        return self._grid[y][x] == 0

    def _is_spike(self, x, y):
        return (x, y) in self._spikes

    def _enemy_at(self, x, y):
        for en in self._enemies:
            if en["alive"] and en["x"] == x and en["y"] == y:
                return True
        return False

    def _update_plates(self):
        for i, (px, py) in enumerate(self._plates):
            occupied = False
            if self._px == px and self._py == py:
                occupied = True
            if not occupied:
                for clone in self._clones:
                    if clone["alive"] and clone["x"] == px and clone["y"] == py:
                        occupied = True
                        break
            self._plate_active[i] = occupied
        self._exit_open = all(self._plate_active) if self._plates else True

    def _move_enemies(self):
        for en in self._enemies:
            if not en["alive"] or not en["path"]:
                continue
            old_x, old_y = en["x"], en["y"]
            en["path_idx"] = (en["path_idx"] + 1) % len(en["path"])
            nx, ny = en["path"][en["path_idx"]]
            en["x"] = nx
            en["y"] = ny
            en["anim_dx"] = (old_x - nx) * CELL
            en["anim_dy"] = (old_y - ny) * CELL

    def _advance_clones(self):
        for clone in self._clones:
            if not clone["alive"]:
                continue
            old_x, old_y = clone["x"], clone["y"]
            rec = clone["recording"]
            step = self._step_in_loop
            if step >= len(rec):
                continue
            aid = rec[step]
            if aid in DIRS:
                dx, dy = DIRS[aid]
                nx, ny = clone["x"] + dx, clone["y"] + dy
                if self._can_move(nx, ny):
                    clone["x"] = nx
                    clone["y"] = ny
            clone["anim_dx"] = (old_x - clone["x"]) * CELL
            clone["anim_dy"] = (old_y - clone["y"]) * CELL
            # Check spike/enemy death
            if self._is_spike(clone["x"], clone["y"]):
                clone["alive"] = False
            if self._enemy_at(clone["x"], clone["y"]):
                clone["alive"] = False

    def _start_new_loop(self):
        self._recordings.append(list(self._current_recording))
        cfg = _LEVEL_CONFIGS[self.level_index]
        sx, sy = cfg["player_start"]
        self._px = sx
        self._py = sy
        self._anim_dx = 0  # instant teleport — no slide
        self._anim_dy = 0

        # Respawn all clones from recordings
        self._clones = []
        for rec in self._recordings:
            self._clones.append({
                "x": sx, "y": sy, "anim_dx": 0, "anim_dy": 0,
                "alive": True, "recording": rec,
            })

        # Reset enemies
        self._enemies = []
        for edef in self._enemy_defs:
            ex, ey = edef["pos"]
            self._enemies.append({
                "x": ex, "y": ey, "anim_dx": 0, "anim_dy": 0,
                "alive": True, "path": list(edef["path"]), "path_idx": 0,
            })

        self._current_recording = []
        self._timer = self._loop_steps
        self._loop_count += 1
        self._step_in_loop = 0
        # Reset plate state for clean display
        self._plate_active = [False] * len(self._plates)
        self._exit_open = False

    def step(self):
        # Animation continuation: let render_interface tick offsets toward 0
        if self._anim_ticks > 0:
            self._anim_ticks -= 1
            if self._anim_ticks == 0:
                self.complete_action()
            return

        # === Game logic (first frame only) ===
        aid = self.action.id.value

        # Normalize action to record
        aid_record = aid if aid in DIRS else 5

        # Record the action
        self._current_recording.append(aid_record)

        # Move player
        if aid in DIRS:
            dx, dy = DIRS[aid]
            nx, ny = self._px + dx, self._py + dy
            if self._can_move(nx, ny):
                self._px = nx
                self._py = ny
                self._anim_dx = -dx * CELL
                self._anim_dy = -dy * CELL

        # Advance clones
        self._advance_clones()

        # Move enemies
        self._move_enemies()

        # Check player death (spike or enemy)
        if self._is_spike(self._px, self._py) or self._enemy_at(self._px, self._py):
            self.lose()
            self.complete_action()
            return

        # Update plates and exit state
        self._update_plates()

        # Check win: player on open exit
        if self._exit_open and (self._px, self._py) == self._exit_pos:
            if not self.is_last_level():
                self.next_level()
            else:
                self.win()
            self.complete_action()
            return

        # Timer countdown
        self._timer -= 1
        self._step_in_loop += 1

        if self._timer <= 0:
            self._start_new_loop()
            self.complete_action()
            return

        # Produce CELL extra frames so render_interface can slide offsets to 0
        self._anim_ticks = CELL
