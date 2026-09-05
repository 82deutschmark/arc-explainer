# Light Bender v3 - A beam-reflection puzzle game
#
# D-pad (1-4) moves cursor. ACTION5 cycles mirror orientation on any empty cell:
# empty -> M0 (---) -> M1 -> M2 (\) -> M3 -> M4 (|) -> M5 -> M6 (/) -> M7 -> empty
#
# Free placement: mirrors can go anywhere on the grid (not walls/sources/targets/etc.)
# but each level limits the number of mirrors you can place.
#
# Features: 8 mirror orientations, 8 beam directions (cardinal+diagonal),
# prisms (split white->RGB), mist (attenuates beam), doors+switches.

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

CELL = 4

# Colors (ARC-3 palette)
C_BLACK   = 5   # Black - background
C_FLOOR   = 4   # VeryDarkGray - floor
C_WALL    = 3   # DarkGray - walls
C_MIRROR  = 10  # LightBlue - player mirror bg
C_FIXED   = 3   # DarkGray - fixed mirror bg
C_WHITE   = 0   # White - mirror line, white beam
C_LGRAY   = 1   # LightGray - weakened white beam
C_GRAY    = 2   # Gray - very weak beam
C_DGRAY   = 3   # DarkGray - dying beam
C_RED     = 8   # Red - source, red beam/target
C_BLUE    = 9   # Blue - blue beam/target
C_AZURE   = 10  # LightBlue - progress bar done
C_YELLOW  = 11  # Yellow - white target
C_ORANGE  = 12  # Orange - source 2
C_MAROON  = 13  # Maroon - door closed, weak red
C_GREEN   = 14  # Green - green beam/target, cursor
C_PURPLE  = 15  # Purple - prism
C_MAGENTA = 6   # Magenta - switch
C_LMAGENTA = 7  # LightMagenta

# ============================================================================
# 8 beam directions (index -> dx, dy)
# ============================================================================
BEAM_DIRS = [
    (1, 0),   # 0: Right
    (1, 1),   # 1: Down-Right
    (0, 1),   # 2: Down
    (-1, 1),  # 3: Down-Left
    (-1, 0),  # 4: Left
    (-1, -1), # 5: Up-Left
    (0, -1),  # 6: Up
    (1, -1),  # 7: Up-Right
]
DIR_INDEX = {d: i for i, d in enumerate(BEAM_DIRS)}

# ============================================================================
# 8 mirror orientations: REFLECT[mirror_id][incoming_dir] = outgoing_dir or None
# Mirror surface angle = mirror_id * 22.5 degrees
# Reflection: out = (2*mirror_id - in) mod 8; None if out == in (parallel)
# ============================================================================
REFLECT = {}
for m in range(8):
    REFLECT[m] = {}
    for d in range(8):
        out = (m - d) % 8
        REFLECT[m][d] = None if out == d else out

# Mirror pixel patterns within a 4x4 cell: list of (col, row) offsets
# Surface angles: M0=0, M1=22.5, M2=45, M3=67.5, M4=90, M5=112.5, M6=135, M7=157.5
MIRROR_PIXELS = {
    0: [(0, 2), (1, 2), (2, 2), (3, 2)],             # M0: horizontal ---
    1: [(0, 1), (1, 2), (2, 2), (3, 3)],              # M1: shallow \ (barely tilted)
    2: [(0, 0), (1, 1), (2, 2), (3, 3)],              # M2: classic \ diagonal
    3: [(1, 0), (1, 1), (2, 2), (2, 3)],              # M3: steep \ (nearly vertical)
    4: [(2, 0), (2, 1), (2, 2), (2, 3)],              # M4: vertical |
    5: [(2, 0), (2, 1), (1, 2), (1, 3)],              # M5: steep / (nearly vertical)
    6: [(3, 0), (2, 1), (1, 2), (0, 3)],              # M6: classic / diagonal
    7: [(3, 1), (2, 2), (1, 2), (0, 3)],              # M7: shallow / (barely tilted)
}

# Beam line pixels within a 4x4 cell by line-type (direction pairs share a line)
BEAM_LINE = {
    0: [(0, 2), (1, 2), (2, 2), (3, 2)],  # Horizontal (dir 0,4)
    1: [(0, 0), (1, 1), (2, 2), (3, 3)],  # Backslash diagonal (dir 1,5)
    2: [(2, 0), (2, 1), (2, 2), (2, 3)],  # Vertical (dir 2,6)
    3: [(3, 0), (2, 1), (1, 2), (0, 3)],  # Slash diagonal (dir 3,7)
}
DIR_TO_LINE = {0: 0, 4: 0, 1: 1, 5: 1, 2: 2, 6: 2, 3: 3, 7: 3}

# Beam color mapping: (color_name, strength) -> palette index
BEAM_COLORS = {
    ("white", 3): C_WHITE,
    ("white", 2): C_LGRAY,
    ("white", 1): C_GRAY,
    ("red", 2): C_RED,
    ("red", 1): C_MAROON,
    ("green", 2): C_GREEN,
    ("green", 1): C_GRAY,
    ("blue", 2): C_BLUE,
    ("blue", 1): C_AZURE,
}

# Target color -> palette index for target cell fill
TARGET_COLORS = {
    "white": C_YELLOW,
    "red": C_RED,
    "green": C_GREEN,
    "blue": C_BLUE,
}

# ============================================================================
# Level definitions
# ============================================================================
LEVELS = [
    # L1: "First Bend" - Tutorial. One mirror to redirect beam.
    {
        "name": "First Bend",
        "grid_w": 7, "grid_h": 7,
        "walls": set(),
        "sources": [(0, 3, 1, 0)],
        "targets": [{"pos": (3, 6), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 1,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L2: "Two Turns" - Two mirrors, staircase down-right.
    {
        "name": "Two Turns",
        "grid_w": 8, "grid_h": 8,
        "walls": set(),
        "sources": [(1, 0, 0, 1)],
        "targets": [{"pos": (6, 4), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 2,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L3: "Periscope" - Route around wall column using / mirrors.
    {
        "name": "Periscope",
        "grid_w": 9, "grid_h": 9,
        "walls": {(4, 3), (4, 4), (4, 5), (4, 6)},
        "sources": [(0, 6, 1, 0)],
        "targets": [{"pos": (7, 2), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 2,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L4: "Fixed Guide" - One fixed mirror, one player mirror.
    {
        "name": "Fixed Guide",
        "grid_w": 9, "grid_h": 9,
        "walls": set(),
        "sources": [(0, 2, 1, 0)],
        "targets": [{"pos": (7, 6), "color": "white"}],
        "fixed_mirrors": {(4, 2): 2},  # M2 backslash
        "max_mirrors": 1,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L5: "Detour" - Route around wall column using mix of / and \.
    {
        "name": "Detour",
        "grid_w": 10, "grid_h": 10,
        "walls": {(5, 3), (5, 4), (5, 5)},
        "sources": [(0, 5, 1, 0)],
        "targets": [{"pos": (7, 3), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 3,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L6: "Diagonal Discovery" - First diagonal beams. M1 creates diagonal.
    {
        "name": "Diagonal",
        "grid_w": 10, "grid_h": 10,
        "walls": set(),
        "sources": [(0, 2, 1, 0)],
        "targets": [{"pos": (7, 8), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 4,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L7: "Fixed Angles" - Fixed diagonal mirror, player routes beam.
    {
        "name": "Fixed Angles",
        "grid_w": 11, "grid_h": 11,
        "walls": set(),
        "sources": [(0, 5, 1, 0)],
        "targets": [{"pos": (10, 9), "color": "white"}],
        "fixed_mirrors": {(4, 5): 1},  # M1: R -> DR
        "max_mirrors": 2,
        "prisms": set(), "mist": set(),
        "switch": None, "door": None,
    },

    # L8: "First Prism" - White beam splits into RGB through prism.
    {
        "name": "First Prism",
        "grid_w": 11, "grid_h": 11,
        "walls": {(7, 6)},
        "sources": [(5, 0, 0, 1)],
        "targets": [
            {"pos": (9, 5), "color": "red"},
            {"pos": (5, 9), "color": "green"},
            {"pos": (1, 8), "color": "blue"},
        ],
        "fixed_mirrors": {},
        "max_mirrors": 1,
        "prisms": {(5, 4)},
        "mist": set(),
        "switch": None, "door": None,
    },

    # L9: "Color Maze" - Route colored beams after prism split.
    {
        "name": "Color Maze",
        "grid_w": 12, "grid_h": 12,
        "walls": set(),
        "sources": [(0, 6, 1, 0)],
        "targets": [
            {"pos": (6, 1), "color": "red"},
            {"pos": (10, 6), "color": "green"},
            {"pos": (6, 10), "color": "blue"},
        ],
        "fixed_mirrors": {},
        "max_mirrors": 2,
        "prisms": {(4, 6)},
        "mist": set(),
        "switch": None, "door": None,
    },

    # L10: "Misty Path" - Mist blocks direct path, must route around.
    {
        "name": "Misty Path",
        "grid_w": 10, "grid_h": 10,
        "walls": set(),
        "sources": [(0, 4, 1, 0)],
        "targets": [{"pos": (8, 4), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 4,
        "prisms": set(),
        "mist": {(3, 4), (4, 4), (5, 4), (6, 4)},
        "switch": None, "door": None,
    },

    # L11: "Open Sesame" - Door + switch. Source 1 hits switch, source 2 goes through.
    {
        "name": "Open Sesame",
        "grid_w": 12, "grid_h": 12,
        "walls": {(5, 3)},
        "sources": [(0, 3, 1, 0), (0, 8, 1, 0)],
        "targets": [{"pos": (10, 8), "color": "white"}],
        "fixed_mirrors": {},
        "max_mirrors": 4,
        "prisms": set(), "mist": set(),
        "switch": (8, 3),
        "door": (6, 8),
    },

    # L12: "Grand Finale" - Prism + door + mist combined.
    {
        "name": "Grand Finale",
        "grid_w": 13, "grid_h": 13,
        "walls": {(5, 2), (8, 7)},
        "sources": [(0, 2, 1, 0), (0, 9, 1, 0)],
        "targets": [
            {"pos": (12, 8), "color": "red"},
            {"pos": (12, 9), "color": "green"},
            {"pos": (9, 12), "color": "blue"},
        ],
        "fixed_mirrors": {},
        "max_mirrors": 5,
        "prisms": {(6, 9)},
        "mist": {(10, 8)},
        "switch": (10, 2),
        "door": (4, 9),
    },
]


# ============================================================================
# Display
# ============================================================================

class LbDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        frame[:, :] = C_BLACK
        g = self.game
        ox = (64 - g.grid_w * CELL) // 2
        oy = (64 - g.grid_h * CELL) // 2

        # Draw grid floor and walls
        for gy in range(g.grid_h):
            for gx in range(g.grid_w):
                px, py = ox + gx * CELL, oy + gy * CELL
                if (gx, gy) in g.border_walls or (gx, gy) in g.interior_walls:
                    frame[py:py + CELL, px:px + CELL] = C_WALL
                else:
                    frame[py:py + CELL, px:px + CELL] = C_FLOOR

        # Draw mist tiles (checkerboard pattern)
        for (mx, my) in g.mist_cells:
            mpx, mpy = ox + mx * CELL, oy + my * CELL
            for r in range(CELL):
                for c in range(CELL):
                    if (r + c) % 2 == 0:
                        frame[mpy + r, mpx + c] = C_LGRAY

        # Draw door
        if g.door_pos:
            dx, dy = g.door_pos
            dpx, dpy = ox + dx * CELL, oy + dy * CELL
            if g.door_open:
                frame[dpy:dpy + CELL, dpx:dpx + CELL] = C_FLOOR
                frame[dpy, dpx:dpx + CELL] = C_MAROON
                frame[dpy + CELL - 1, dpx:dpx + CELL] = C_MAROON
            else:
                frame[dpy:dpy + CELL, dpx:dpx + CELL] = C_MAROON

        # Draw switch
        if g.switch_pos:
            sx, sy = g.switch_pos
            spx, spy = ox + sx * CELL, oy + sy * CELL
            frame[spy:spy + CELL, spx:spx + CELL] = C_MAGENTA

        # Draw prisms (triangle shape)
        for (prx, pry) in g.prism_cells:
            ppx, ppy = ox + prx * CELL, oy + pry * CELL
            frame[ppy:ppy + CELL, ppx:ppx + CELL] = C_FLOOR
            frame[ppy, ppx + 1:ppx + 3] = C_PURPLE
            frame[ppy + 1, ppx:ppx + CELL] = C_PURPLE
            frame[ppy + 2, ppx:ppx + CELL] = C_PURPLE
            frame[ppy + 3, ppx:ppx + CELL] = C_PURPLE

        # Draw sources
        for i, src in enumerate(g.sources):
            sx, sy = src[0], src[1]
            spx, spy = ox + sx * CELL, oy + sy * CELL
            color = C_RED if i == 0 else C_ORANGE
            frame[spy:spy + CELL, spx:spx + CELL] = color

        # Draw targets
        for tgt in g.targets:
            tx, ty = tgt["pos"]
            tpx, tpy = ox + tx * CELL, oy + ty * CELL
            tc = TARGET_COLORS.get(tgt["color"], C_YELLOW)
            frame[tpy:tpy + CELL, tpx:tpx + CELL] = tc
            if tgt["color"] != "white":
                frame[tpy, tpx] = C_YELLOW
                frame[tpy, tpx + CELL - 1] = C_YELLOW
                frame[tpy + CELL - 1, tpx] = C_YELLOW
                frame[tpy + CELL - 1, tpx + CELL - 1] = C_YELLOW

        # Draw mirrors
        for (mx, my), mid in g.mirrors.items():
            mpx, mpy = ox + mx * CELL, oy + my * CELL
            bg = C_FIXED if (mx, my) in g.fixed_mirrors else C_MIRROR
            frame[mpy:mpy + CELL, mpx:mpx + CELL] = bg
            for (c, r) in MIRROR_PIXELS[mid]:
                if 0 <= mpy + r < 64 and 0 <= mpx + c < 64:
                    frame[mpy + r, mpx + c] = C_WHITE

        # Draw beam segments as lines
        for seg in g.beam_segments:
            bx, by, bcolor, bdir, bstr = seg
            if any(bx == s[0] and by == s[1] for s in g.sources):
                continue
            if (bx, by) in g.mirrors:
                continue
            if (bx, by) in g.prism_cells:
                continue
            palette = BEAM_COLORS.get((bcolor, bstr))
            if palette is None:
                continue
            bpx, bpy = ox + bx * CELL, oy + by * CELL
            line_type = DIR_TO_LINE[bdir]
            for (c, r) in BEAM_LINE[line_type]:
                rr, cc = bpy + r, bpx + c
                if 0 <= rr < 64 and 0 <= cc < 64:
                    frame[rr, cc] = palette

        # Draw beam hitting targets
        for i, tgt in enumerate(g.targets):
            if i in g.targets_hit:
                tx, ty = tgt["pos"]
                tpx, tpy = ox + tx * CELL, oy + ty * CELL
                tc = TARGET_COLORS.get(tgt["color"], C_YELLOW)
                frame[tpy:tpy + CELL, tpx:tpx + CELL] = tc
                frame[tpy + 1:tpy + 3, tpx + 1:tpx + 3] = C_WHITE

        # Draw cursor border (green outline)
        cx_pos, cy_pos = g.cursor_x, g.cursor_y
        cpx, cpy = ox + cx_pos * CELL, oy + cy_pos * CELL
        for i in range(CELL):
            for r, c in [(cpy, cpx + i), (cpy + CELL - 1, cpx + i),
                         (cpy + i, cpx), (cpy + i, cpx + CELL - 1)]:
                if 0 <= r < 64 and 0 <= c < 64:
                    frame[r, c] = C_GREEN

        # Level progress bar at top
        n = len(LEVELS)
        bar_w = max(1, 64 // n)
        for li in range(n):
            color = C_AZURE if li < g.level_index else (C_YELLOW if li == g.level_index else C_DGRAY)
            c0 = li * bar_w
            c1 = min(64, c0 + bar_w - 1)
            frame[0:2, c0:c1] = color

        # Mirrors remaining indicator (bottom row): green dots = remaining, red = used
        remaining = g.max_mirrors - g.player_mirror_count
        total = g.max_mirrors
        ind_x = (64 - total * 3) // 2  # center the dots
        for i in range(total):
            dx = ind_x + i * 3
            if dx < 0 or dx + 1 >= 64:
                continue
            c = C_GREEN if i < remaining else C_RED
            frame[62, dx] = c
            frame[62, dx + 1] = c
            frame[63, dx] = c
            frame[63, dx + 1] = c

        return frame


# ============================================================================
# Game
# ============================================================================

class Lb03(ARCBaseGame):
    def __init__(self):
        self.display = LbDisplay(self)
        levels = []
        for d in LEVELS:
            levels.append(Level(
                sprites=[],
                grid_size=(64, 64),
                data=d,
                name=d["name"],
            ))
        super().__init__(
            "lb", levels,
            Camera(0, 0, 64, 64, C_BLACK, C_BLACK, [self.display]),
            False, len(levels), [1, 2, 3, 4, 5],
        )

    def on_set_level(self, level):
        d = LEVELS[self.level_index]
        self.grid_w = d["grid_w"]
        self.grid_h = d["grid_h"]
        self.max_mirrors = d.get("max_mirrors", 3)

        # Build border walls
        self.border_walls = set()
        for x in range(self.grid_w):
            self.border_walls.add((x, 0))
            self.border_walls.add((x, self.grid_h - 1))
        for y in range(self.grid_h):
            self.border_walls.add((0, y))
            self.border_walls.add((self.grid_w - 1, y))

        # Remove sources and targets from border walls
        for src in d["sources"]:
            self.border_walls.discard((src[0], src[1]))
        for tgt in d["targets"]:
            self.border_walls.discard(tgt["pos"])
        if d["switch"]:
            self.border_walls.discard(d["switch"])

        self.interior_walls = set(d.get("walls", set()))
        self.sources = list(d["sources"])
        self.targets = list(d["targets"])
        self.fixed_mirrors = dict(d.get("fixed_mirrors", {}))
        self.prism_cells = set(d.get("prisms", set()))
        self.mist_cells = set(d.get("mist", set()))
        self.switch_pos = d.get("switch")
        self.door_pos = d.get("door")

        # Occupied cells where player cannot place mirrors
        self._occupied = set()
        self._occupied |= self.border_walls
        self._occupied |= self.interior_walls
        self._occupied |= self.prism_cells
        self._occupied |= self.mist_cells
        self._occupied |= set(self.fixed_mirrors.keys())
        for src in self.sources:
            self._occupied.add((src[0], src[1]))
        for tgt in self.targets:
            self._occupied.add(tgt["pos"])
        if self.switch_pos:
            self._occupied.add(self.switch_pos)
        if self.door_pos:
            self._occupied.add(self.door_pos)

        # Active mirrors = fixed + player-placed
        self.mirrors = dict(self.fixed_mirrors)
        self.player_mirror_count = 0

        # Cursor starts at grid center
        self.cursor_x = self.grid_w // 2
        self.cursor_y = self.grid_h // 2

        # Beam state
        self.beam_segments = []
        self.targets_hit = set()
        self.door_open = False
        self._trace_all_beams()

    def _is_placeable(self, pos):
        """Check if a position is valid for placing a new mirror."""
        return pos not in self._occupied

    def _trace_all_beams(self):
        """Trace all beams from all sources, handling prisms, mist, doors."""
        self.beam_segments = []
        self.targets_hit = set()
        self.door_open = False

        all_walls = self.border_walls | self.interior_walls

        # First pass: trace source 0, check if it hits the switch
        if len(self.sources) > 0:
            segs = self._trace_single(self.sources[0], "white", 3, all_walls)
            self.beam_segments.extend(segs)
            if self.switch_pos:
                for seg in segs:
                    if (seg[0], seg[1]) == self.switch_pos:
                        self.door_open = True
                        break

        # Second pass: trace remaining sources (with door potentially open)
        for i in range(1, len(self.sources)):
            segs = self._trace_single(self.sources[i], "white", 3, all_walls)
            self.beam_segments.extend(segs)

        # Check which targets are hit
        for ti, tgt in enumerate(self.targets):
            tpos = tgt["pos"]
            tcol = tgt["color"]
            for seg in self.beam_segments:
                sx, sy, scol, sdir, sstr = seg
                if (sx, sy) == tpos and scol == tcol and sstr > 0:
                    self.targets_hit.add(ti)
                    break

    def _trace_single(self, source, color, strength, all_walls):
        """Trace one beam from source. Returns list of (x,y,color,dir,strength)."""
        sx, sy, dx, dy = source
        dir_idx = DIR_INDEX[(dx, dy)]
        segments = []
        queue = [(sx + dx, sy + dy, dir_idx, color, strength)]
        visited = set()

        while queue:
            x, y, d, col, stren = queue.pop(0)
            visit_key = (x, y, d, col)
            if visit_key in visited:
                continue
            if x < 0 or y < 0 or x >= self.grid_w or y >= self.grid_h:
                continue
            if (x, y) in all_walls:
                continue
            if (x, y) == self.door_pos and not self.door_open:
                continue
            visited.add(visit_key)

            # Mist attenuation
            cur_str = stren
            if (x, y) in self.mist_cells:
                cur_str -= 1
                if cur_str <= 0:
                    segments.append((x, y, col, d, 0))
                    continue

            segments.append((x, y, col, d, cur_str))

            # Check if this is a target cell - beam stops at target
            is_target = False
            for tgt in self.targets:
                if (x, y) == tgt["pos"]:
                    is_target = True
                    break
            if is_target:
                continue

            # Prism check
            if (x, y) in self.prism_cells and col == "white":
                for new_col, delta in [("red", -1), ("green", 0), ("blue", 1)]:
                    new_d = (d + delta) % 8
                    ndx, ndy = BEAM_DIRS[new_d]
                    queue.append((x + ndx, y + ndy, new_d, new_col, 2))
                continue

            # Mirror check
            if (x, y) in self.mirrors:
                mid = self.mirrors[(x, y)]
                new_d = REFLECT[mid][d]
                if new_d is None:
                    ndx, ndy = BEAM_DIRS[d]
                    queue.append((x + ndx, y + ndy, d, col, cur_str))
                else:
                    ndx, ndy = BEAM_DIRS[new_d]
                    queue.append((x + ndx, y + ndy, new_d, col, cur_str))
                continue

            # Continue in same direction
            ndx, ndy = BEAM_DIRS[d]
            queue.append((x + ndx, y + ndy, d, col, cur_str))

        return segments

    def _check_win(self):
        return len(self.targets_hit) == len(self.targets) and len(self.targets) > 0

    def step(self):
        aid = self.action.id.value

        if aid in (1, 2, 3, 4):
            # D-pad: move cursor
            ddx, ddy = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}[aid]
            nx, ny = self.cursor_x + ddx, self.cursor_y + ddy
            if 1 <= nx <= self.grid_w - 2 and 1 <= ny <= self.grid_h - 2:
                self.cursor_x, self.cursor_y = nx, ny
        elif aid == 5:
            # Cycle mirror orientation on any valid cell
            pos = (self.cursor_x, self.cursor_y)
            if pos in self.mirrors and pos not in self.fixed_mirrors:
                # Already has a player mirror: cycle or remove
                if self.mirrors[pos] < 7:
                    self.mirrors[pos] += 1
                else:
                    del self.mirrors[pos]
                    self.player_mirror_count -= 1
                self._trace_all_beams()
                if self._check_win():
                    self.next_level()
            elif self._is_placeable(pos) and self.player_mirror_count < self.max_mirrors:
                # Empty valid cell and we have mirrors left: place M0
                self.mirrors[pos] = 0
                self.player_mirror_count += 1
                self._trace_all_beams()
                if self._check_win():
                    self.next_level()

        self.complete_action()
