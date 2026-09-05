# Sneeze — Infect as many people as possible!
#
# Click a person to start the infection. The simulation auto-plays as animation.
# Win: 70% of people infected. Lose: no active infected & no sneeze clouds.
#
# People types:
#   Child  (red, 2px tall)   - fast, wide sneeze, quick, 2 sneezes
#   Adult  (purple, 3px tall)- medium speed, narrow cone, 3 sneezes
#   Elder  (yellow, 3px tall)- slow, medium cone, 3 sneezes
#   Doctor (green+white nose)- runs to closest infected, heals them
#   Quarantiner (blue)       - blocks adults/elders from moving
#
# Later levels span multiple screens — use d-pad to pan before clicking.
# After clicking, the simulation auto-runs (multi-frame animation).

import math
import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay, Sprite

# ── Colors (ARC-3 palette indices) ──
# 0=White 1=LightGray 2=Gray 3=DarkGray 4=VeryDarkGray 5=Black
# 6=Magenta 7=LightMagenta 8=Red 9=Blue 10=LightBlue 11=Yellow
# 12=Orange 13=Maroon 14=Green 15=Purple
C_BG       = 5   # Black background
C_CHILD    = 8   # Red
C_ADULT    = 15  # Purple
C_ELDER    = 11  # Yellow
C_DOCTOR   = 14  # Green
C_QUARAN   = 9   # Blue
C_NOSE_INF = 12  # Orange (infected nose)
C_DEAD_BODY= 2   # Gray (dead body)
C_DEAD_NOSE= 3   # DarkGray (dead nose)
C_SNEEZE   = 0   # White (sneeze droplets)
C_WALL     = 3   # DarkGray walls
C_HUD_OK   = 14  # Green
C_WHITE    = 0   # White
C_ARROW    = 12  # Orange (scroll indicators)

# ── Person types ──
TYPE_CHILD = 0
TYPE_ADULT = 1
TYPE_ELDER = 2
TYPE_DOCTOR = 3
TYPE_QUARAN = 4

# Type colors (body color when healthy)
TYPE_BODY_COLOR = {
    TYPE_CHILD: C_CHILD,
    TYPE_ADULT: C_ADULT,
    TYPE_ELDER: C_ELDER,
    TYPE_DOCTOR: C_DOCTOR,
    TYPE_QUARAN: C_QUARAN,
}

# Type configs
TYPE_CONFIG = {
    TYPE_CHILD:  {"speed": 1, "delay": 6,  "sneezes": 2, "cone": 120, "range": 12, "cloud_ttl": 6},
    TYPE_ADULT:  {"speed": 2, "delay": 15, "sneezes": 3, "cone": 50,  "range": 14, "cloud_ttl": 8},
    TYPE_ELDER:  {"speed": 3, "delay": 10, "sneezes": 3, "cone": 80,  "range": 13, "cloud_ttl": 7},
    TYPE_DOCTOR: {"speed": 2, "delay": 99, "sneezes": 99,"cone": 0,   "range": 0,  "cloud_ttl": 0},
    TYPE_QUARAN: {"speed": 0, "delay": 99, "sneezes": 99,"cone": 0,   "range": 0,  "cloud_ttl": 0},
}

# ── Directions ──
DIR_VECTORS = [(0, -1), (1, 0), (0, 1), (-1, 0)]  # up, right, down, left
DIR_ANGLES  = [-math.pi/2, 0, math.pi/2, math.pi]

# ── Sprite definitions: (body_pixels, nose_pixel) per direction ──
# Child: 2 rows (small)
#   Up:  .N.    Right: B.   Down: BBB   Left: .B
#        BBB           BN         .N.         NB
#                      B.                     .B
CHILD_SPRITES = {
    0: {"body": [(0,1),(1,1),(2,1)], "nose": (1,0)},  # up
    1: {"body": [(0,0),(0,1),(0,2)], "nose": (1,1)},  # right
    2: {"body": [(0,0),(1,0),(2,0)], "nose": (1,1)},  # down
    3: {"body": [(1,0),(1,1),(1,2)], "nose": (0,1)},  # left
}

# Adult/Elder/Doctor/Quarantiner: 3 rows (bigger body)
#   Up:  .N.    Right: BB.   Down: BBB   Left: .BB
#        BBB           BBN         BBB         NBB
#        BBB           BB.         .N.         .BB
ADULT_SPRITES = {
    0: {"body": [(0,1),(1,1),(2,1),(0,2),(1,2),(2,2)], "nose": (1,0)},
    1: {"body": [(0,0),(1,0),(0,1),(1,1),(0,2),(1,2)], "nose": (2,1)},
    2: {"body": [(0,0),(1,0),(2,0),(0,1),(1,1),(2,1)], "nose": (1,2)},
    3: {"body": [(1,0),(2,0),(1,1),(2,1),(1,2),(2,2)], "nose": (0,1)},
}

def _get_sprite(ptype, direction):
    if ptype == TYPE_CHILD:
        return CHILD_SPRITES[direction]
    return ADULT_SPRITES[direction]

# ── Deterministic PRNG ──
def _det_rand(seed, n, lo, hi):
    vals = []
    s = seed
    for _ in range(n):
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        vals.append(lo + (s % (hi - lo)))
    return vals, s


def _generate_people(seed, type_counts, grid_w, grid_h, margin=3):
    people = []
    s = seed
    type_sequence = []
    for ptype, cnt in type_counts:
        type_sequence.extend([ptype] * cnt)

    total = len(type_sequence)
    xs, s = _det_rand(s, total, margin, grid_w - margin)
    ys, s = _det_rand(s, total, margin, grid_h - margin)
    dirs, s = _det_rand(s, total, 0, 4)

    shuffled = list(range(total))
    for i in range(total - 1, 0, -1):
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        j = s % (i + 1)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]

    used = set()
    for i in range(total):
        x, y = xs[i], ys[i]
        attempts = 0
        while (x, y) in used and attempts < 50:
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            x = margin + (s % (grid_w - 2 * margin))
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            y = margin + (s % (grid_h - 2 * margin))
            attempts += 1
        used.add((x, y))

        ptype = type_sequence[shuffled[i]]
        people.append({
            "type": ptype,
            "x": float(x), "y": float(y),
            "dir": dirs[i],
            "infected": False,
            "sneeze_timer": -1,
            "sneezes_left": TYPE_CONFIG[ptype]["sneezes"],
            "dead": False,
            "healed": False,
            "blocked": False,
            "move_counter": 0,
        })

    return people


# ============================================================================
# Level definitions
# ============================================================================
LEVELS = [
    {
        "name": "School Playground",
        "seed": 42,
        "type_counts": [(TYPE_CHILD, 22), (TYPE_ADULT, 8)],
        "grid_w": 56, "grid_h": 52,
        "win_pct": 0.70, "walls": [],
        "screens": (1, 1),
    },
    {
        "name": "City Park",
        "seed": 137,
        "type_counts": [(TYPE_CHILD, 12), (TYPE_ADULT, 12), (TYPE_ELDER, 11)],
        "grid_w": 56, "grid_h": 52,
        "win_pct": 0.70,
        "walls": [(18, 20, 8, 1), (32, 34, 8, 1)],
        "screens": (1, 1),
    },
    {
        "name": "Office Building",
        "seed": 256,
        "type_counts": [(TYPE_CHILD, 4), (TYPE_ADULT, 22), (TYPE_ELDER, 6)],
        "grid_w": 58, "grid_h": 54,
        "win_pct": 0.70,
        "walls": [
            (14, 12, 1, 12), (28, 12, 1, 12), (42, 12, 1, 12),
            (14, 36, 14, 1), (28, 24, 14, 1),
        ],
        "screens": (1, 1),
    },
    {
        "name": "Retirement Home",
        "seed": 333,
        "type_counts": [(TYPE_ADULT, 8), (TYPE_ELDER, 24)],
        "grid_w": 58, "grid_h": 54,
        "win_pct": 0.70,
        "walls": [
            (18, 10, 1, 16), (36, 10, 1, 16),
            (18, 32, 18, 1), (36, 26, 1, 6),
        ],
        "screens": (1, 1),
    },
    {
        "name": "Hospital",
        "seed": 800,
        "type_counts": [(TYPE_CHILD, 10), (TYPE_ADULT, 16), (TYPE_ELDER, 12), (TYPE_DOCTOR, 2)],
        "grid_w": 56, "grid_h": 52,
        "win_pct": 0.70,
        "walls": [(18, 16, 1, 14), (36, 16, 1, 14)],
        "screens": (1, 1),
    },
    {
        "name": "Airport Terminal",
        "seed": 777,
        "type_counts": [(TYPE_CHILD, 25), (TYPE_ADULT, 30), (TYPE_ELDER, 15), (TYPE_DOCTOR, 2), (TYPE_QUARAN, 1)],
        "grid_w": 100, "grid_h": 52,
        "win_pct": 0.70,
        "walls": [
            (24, 18, 1, 16), (48, 14, 1, 24), (74, 18, 1, 16),
        ],
        "screens": (2, 1),
    },
    {
        "name": "City Center",
        "seed": 999,
        "type_counts": [(TYPE_CHILD, 35), (TYPE_ADULT, 40), (TYPE_ELDER, 25), (TYPE_DOCTOR, 3), (TYPE_QUARAN, 2)],
        "grid_w": 100, "grid_h": 96,
        "win_pct": 0.70,
        "walls": [
            (20, 16, 1, 20), (48, 14, 1, 24), (76, 16, 1, 20),
            (20, 48, 1, 20), (48, 48, 1, 24), (76, 48, 1, 20),
            (20, 36, 28, 1), (48, 72, 28, 1),
        ],
        "screens": (2, 2),
    },
]

SCREEN_W = 60
SCREEN_H = 56
HUD_H = 3


# ============================================================================
# Display
# ============================================================================

class SnDisplay(RenderableUserDisplay):
    def __init__(self, game: "Sn01"):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g: "Sn01" = self.game
        frame[:, :] = C_BG

        ox = 2 - g._cam_x
        oy = HUD_H - g._cam_y

        # Walls
        for (wx, wy, ww, wh) in g._walls:
            x1, y1 = max(0, ox + wx), max(0, oy + wy)
            x2, y2 = min(64, ox + wx + ww), min(64, oy + wy + wh)
            if x1 < x2 and y1 < y2:
                frame[y1:y2, x1:x2] = C_WALL

        # Sneeze clouds
        for (sx, sy, ttl) in g._sneeze_particles:
            px, py = ox + int(sx), oy + int(sy)
            if 0 <= px < 64 and 0 <= py < 64:
                frame[py, px] = C_SNEEZE

        # People
        for p in g._people:
            self._draw_person(frame, p, ox, oy)

        # Scroll arrows
        self._draw_scroll_arrows(frame)

        # HUD
        self._draw_hud(frame)

        return frame

    def _draw_person(self, frame, p, ox, oy):
        px, py = int(p["x"]), int(p["y"])
        sprite = _get_sprite(p["type"], p["dir"])

        # Determine colors
        if p["dead"]:
            body_color = C_DEAD_BODY
            nose_color = C_DEAD_NOSE
        elif p["infected"]:
            body_color = TYPE_BODY_COLOR[p["type"]]
            nose_color = C_NOSE_INF  # orange nose when infected
        elif p["healed"]:
            body_color = TYPE_BODY_COLOR[p["type"]]
            nose_color = TYPE_BODY_COLOR[p["type"]]
        else:
            body_color = TYPE_BODY_COLOR[p["type"]]
            # Doctor has white nose, others match body
            nose_color = C_WHITE if p["type"] == TYPE_DOCTOR else body_color

        # Draw body pixels
        for (dx, dy) in sprite["body"]:
            fx = ox + px + dx - 1
            fy = oy + py + dy
            if 0 <= fx < 64 and 0 <= fy < 64:
                frame[fy, fx] = body_color

        # Draw nose pixel
        nx, ny = sprite["nose"]
        fx = ox + px + nx - 1
        fy = oy + py + ny
        if 0 <= fx < 64 and 0 <= fy < 64:
            frame[fy, fx] = nose_color

    def _draw_scroll_arrows(self, frame):
        g = self.game
        scr_cols, scr_rows = g._screens
        sx, sy = g._screen_x, g._screen_y

        if sx < scr_cols - 1:
            for y in range(28, 36):
                frame[y, 63] = C_ARROW
        if sx > 0:
            for y in range(28, 36):
                frame[y, 0] = C_ARROW
        if sy < scr_rows - 1:
            for x in range(28, 36):
                frame[63, x] = C_ARROW
        if sy > 0:
            for x in range(28, 36):
                frame[HUD_H, x] = C_ARROW

    def _draw_hud(self, frame):
        g = self.game
        total = len(g._people)
        if total == 0:
            return
        infected_count = sum(1 for p in g._people if p["infected"] or p["dead"])
        pct = infected_count / total

        bar_w, bar_x = 54, 2
        fill = int(pct * bar_w)
        target_x = bar_x + int(g._win_pct * bar_w)

        frame[0, bar_x:bar_x + bar_w] = C_WALL
        frame[1, bar_x:bar_x + bar_w] = C_WALL

        if fill > 0:
            c = C_HUD_OK if pct >= g._win_pct else C_NOSE_INF
            frame[0, bar_x:bar_x + min(fill, bar_w)] = c
            frame[1, bar_x:bar_x + min(fill, bar_w)] = c

        if bar_x <= target_x < bar_x + bar_w:
            frame[0, target_x] = C_WHITE
            frame[1, target_x] = C_WHITE

        for i in range(g._retries):
            rx = 62 - i * 2
            if 0 <= rx < 64:
                frame[0, rx] = C_HUD_OK
                frame[1, rx] = C_HUD_OK


# ============================================================================
# Game
# ============================================================================

class Sn01(ARCBaseGame):
    def __init__(self):
        self.display = SnDisplay(self)

        self._people = []
        self._walls = []
        self._sim_running = False
        self._sim_ended = False
        self._tick = 0
        self._win_pct = 0.70
        self._sneeze_particles = []
        self._retries = 3
        self._cam_x = 0
        self._cam_y = 0
        self._screen_x = 0
        self._screen_y = 0
        self._screens = (1, 1)

        levels = []
        for ldef in LEVELS:
            levels.append(Level(
                sprites=[],
                grid_size=(64, 64),
                data=ldef,
                name=ldef["name"],
            ))

        super().__init__(
            "sn",
            levels,
            Camera(0, 0, 64, 64, C_BG, C_BG, [self.display]),
            False,
            len(levels),
            [1, 2, 3, 4, 6],
        )

    def on_set_level(self, level: Level) -> None:
        ldef = LEVELS[self.level_index]
        gw, gh = ldef["grid_w"], ldef["grid_h"]

        self._walls = list(ldef.get("walls", []))
        self._win_pct = ldef.get("win_pct", 0.70)
        self._sim_running = False
        self._sim_ended = False
        self._tick = 0
        self._sneeze_particles = []
        self._screens = ldef.get("screens", (1, 1))
        self._screen_x = 0
        self._screen_y = 0
        self._cam_x = 0
        self._cam_y = 0

        self._people = _generate_people(
            ldef["seed"], ldef["type_counts"],
            gw, gh, margin=4,
        )

        for p in self._people:
            while self._in_wall(p["x"], p["y"]):
                p["x"] = (p["x"] + 3) % (gw - 8) + 4
                p["y"] = (p["y"] + 3) % (gh - 8) + 4

    def _in_wall(self, x, y):
        for (wx, wy, ww, wh) in self._walls:
            if wx - 1 <= x <= wx + ww and wy - 1 <= y <= wy + wh:
                return True
        return False

    def _pan_camera(self, direction):
        scr_cols, scr_rows = self._screens
        if direction == 1 and self._screen_y > 0:
            self._screen_y -= 1
        elif direction == 2 and self._screen_y < scr_rows - 1:
            self._screen_y += 1
        elif direction == 3 and self._screen_x > 0:
            self._screen_x -= 1
        elif direction == 4 and self._screen_x < scr_cols - 1:
            self._screen_x += 1
        self._cam_x = self._screen_x * SCREEN_W
        self._cam_y = self._screen_y * SCREEN_H

    def step(self) -> None:
        aid = self.action.id.value

        # D-pad: pan camera, completes immediately
        if aid in (1, 2, 3, 4):
            self._pan_camera(aid)
            self.complete_action()
            return

        # During auto-simulation: each step call = one tick, one frame
        if self._sim_running and not self._sim_ended:
            ended = self._sim_tick()
            if ended:
                self._sim_ended = True
                self.complete_action()
            # Don't complete_action → generates another frame
            return

        # Click action: infect patient zero, start auto-sim
        if aid == 6 and not self._sim_running:
            click_x = self.action.data.get("x", 0)
            click_y = self.action.data.get("y", 0)

            world_x = click_x - 2 + self._cam_x
            world_y = click_y - HUD_H + self._cam_y

            best = None
            best_dist = 999
            for p in self._people:
                dist = abs(world_x - p["x"]) + abs(world_y - p["y"])
                if dist < best_dist and dist <= 4:
                    best_dist = dist
                    best = p

            if best is not None and best["type"] not in (TYPE_DOCTOR, TYPE_QUARAN):
                best["infected"] = True
                best["sneeze_timer"] = TYPE_CONFIG[best["type"]]["delay"]
                self._sim_running = True
                self._sim_ended = False
                # Don't complete_action — start multi-frame animation
                return

        self.complete_action()

    def _sim_tick(self):
        """Run one simulation tick. Returns True if sim ended."""
        self._tick += 1

        self._move_people()
        self._process_doctors()
        self._process_sneezes()
        self._cloud_infect()

        self._sneeze_particles = [(x, y, t-1) for (x, y, t) in self._sneeze_particles if t > 1]

        total = len(self._people)
        infected_count = sum(1 for p in self._people if p["infected"] or p["dead"])

        if infected_count >= int(total * self._win_pct):
            self.next_level()
            return True

        if self._tick >= 5:
            active = sum(1 for p in self._people
                         if p["infected"] and not p["dead"] and not p["healed"])
            has_clouds = len(self._sneeze_particles) > 0
            if active == 0 and not has_clouds:
                self._retries -= 1
                if self._retries <= 0:
                    self.lose()
                    return True
                else:
                    self.on_set_level(self.current_level)
                    return True

        return False

    def _move_people(self):
        ldef = LEVELS[self.level_index]
        gw, gh = ldef["grid_w"], ldef["grid_h"]

        for p in self._people:
            if p["dead"]:
                continue

            ptype = p["type"]
            cfg = TYPE_CONFIG[ptype]

            if ptype == TYPE_QUARAN:
                continue

            if ptype in (TYPE_ADULT, TYPE_ELDER) and self._blocked_by_quarantiner(p):
                p["blocked"] = True
                continue
            else:
                p["blocked"] = False

            speed = cfg["speed"]
            if speed == 0:
                continue
            p["move_counter"] += 1
            if p["move_counter"] < speed:
                continue
            p["move_counter"] = 0

            dx, dy = DIR_VECTORS[p["dir"]]
            nx = p["x"] + dx
            ny = p["y"] + dy

            if nx < 2 or nx >= gw - 2 or ny < 2 or ny >= gh - 2:
                p["dir"] = (p["dir"] + 2) % 4
                dx, dy = DIR_VECTORS[p["dir"]]
                nx = p["x"] + dx
                ny = p["y"] + dy

            if self._in_wall(nx, ny):
                for turn in [1, 3, 2]:
                    new_dir = (p["dir"] + turn) % 4
                    ddx, ddy = DIR_VECTORS[new_dir]
                    tnx = p["x"] + ddx
                    tny = p["y"] + ddy
                    if not self._in_wall(tnx, tny) and 2 <= tnx < gw - 2 and 2 <= tny < gh - 2:
                        p["dir"] = new_dir
                        nx, ny = tnx, tny
                        break
                else:
                    continue

            p["x"] = nx
            p["y"] = ny

    def _blocked_by_quarantiner(self, person):
        for q in self._people:
            if q["type"] == TYPE_QUARAN and not q["dead"]:
                dist = abs(person["x"] - q["x"]) + abs(person["y"] - q["y"])
                if dist <= 6:
                    return True
        return False

    def _process_doctors(self):
        for doc in self._people:
            if doc["type"] != TYPE_DOCTOR or doc["dead"]:
                continue

            cfg = TYPE_CONFIG[TYPE_DOCTOR]
            doc["move_counter"] += 1
            if doc["move_counter"] < cfg["speed"]:
                continue
            doc["move_counter"] = 0

            closest = None
            closest_dist = 9999
            for p in self._people:
                if p is doc:
                    continue
                if p["infected"] and not p["dead"] and not p["healed"]:
                    dist = abs(doc["x"] - p["x"]) + abs(doc["y"] - p["y"])
                    if dist < closest_dist:
                        closest_dist = dist
                        closest = p

            if closest is not None:
                dx = 1 if closest["x"] > doc["x"] else (-1 if closest["x"] < doc["x"] else 0)
                dy = 1 if closest["y"] > doc["y"] else (-1 if closest["y"] < doc["y"] else 0)

                nx = doc["x"] + dx
                ny = doc["y"] + dy
                if not self._in_wall(nx, ny):
                    doc["x"] = nx
                    doc["y"] = ny

                if dx == 1: doc["dir"] = 1
                elif dx == -1: doc["dir"] = 3
                elif dy == -1: doc["dir"] = 0
                elif dy == 1: doc["dir"] = 2

                actual_dist = abs(doc["x"] - closest["x"]) + abs(doc["y"] - closest["y"])
                if actual_dist <= 1:
                    closest["infected"] = False
                    closest["healed"] = True
                    closest["sneeze_timer"] = -1

    def _process_sneezes(self):
        for p in self._people:
            if not p["infected"] or p["dead"] or p["healed"]:
                continue

            if p["sneeze_timer"] > 0:
                p["sneeze_timer"] -= 1
                continue

            if p["sneeze_timer"] == 0:
                self._do_sneeze(p)
                p["sneezes_left"] -= 1

                if p["sneezes_left"] <= 0:
                    p["dead"] = True
                else:
                    p["sneeze_timer"] = TYPE_CONFIG[p["type"]]["delay"] + 2

    def _do_sneeze(self, sneezer):
        cfg = TYPE_CONFIG[sneezer["type"]]
        cone_angle = math.radians(cfg["cone"])
        cone_range = cfg["range"]
        cloud_ttl = cfg["cloud_ttl"]
        facing_angle = DIR_ANGLES[sneezer["dir"]]

        for i in range(1, cone_range + 1):
            num_pts = max(1, int(i * cone_angle / 0.6))
            for j in range(num_pts):
                if num_pts == 1:
                    angle = facing_angle
                else:
                    angle = facing_angle - cone_angle/2 + cone_angle * j / (num_pts - 1)
                px = sneezer["x"] + math.cos(angle) * i
                py = sneezer["y"] + math.sin(angle) * i
                self._sneeze_particles.append((px, py, cloud_ttl))

        for p in self._people:
            if p is sneezer or p["infected"] or p["dead"] or p["healed"]:
                continue
            if p["type"] in (TYPE_DOCTOR, TYPE_QUARAN):
                continue

            dx = p["x"] - sneezer["x"]
            dy = p["y"] - sneezer["y"]
            dist = math.sqrt(dx * dx + dy * dy)

            if dist > cone_range or dist < 0.5:
                continue

            angle_to = math.atan2(dy, dx)
            diff = abs(angle_to - facing_angle)
            while diff > math.pi:
                diff -= 2 * math.pi
            diff = abs(diff)

            if diff <= cone_angle / 2:
                p["infected"] = True
                p["sneeze_timer"] = TYPE_CONFIG[p["type"]]["delay"]

    def _cloud_infect(self):
        for p in self._people:
            if p["infected"] or p["dead"] or p["healed"]:
                continue
            if p["type"] in (TYPE_DOCTOR, TYPE_QUARAN):
                continue

            for (cx, cy, ttl) in self._sneeze_particles:
                dx = p["x"] - cx
                dy = p["y"] - cy
                if dx * dx + dy * dy <= 4.0:
                    p["infected"] = True
                    p["sneeze_timer"] = TYPE_CONFIG[p["type"]]["delay"]
                    break

    @property
    def action(self):
        return self._action

    @property
    def available_actions(self):
        return self._available_actions
