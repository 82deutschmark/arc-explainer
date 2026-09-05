# ARC-AGI-3 candidate task g540.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
ARROWS = {"^": 1, "v": 2, "<": 3, ">": 4}
W, H = 9, 5


LEVELS = [
    {"name": "One Tomorrow", "first": ("#########", "#S..a..G#", "#.......#", "#########", "#########"),
     "future": ("#########", "#S.....G#", "#.#####.#", "#.......#", "#########"),
     "debts": {"a": ((4, 1),)}, "budget": 15},
    {"name": "Bramble Shape", "first": ("#########", "#S..a..G#", "#.......#", "#########", "#########"),
     "future": ("#########", "#S.....G#", "#.#####.#", "#.......#", "#########"),
     "debts": {"a": ((3, 1), (4, 1), (5, 1))}, "budget": 15},
    {"name": "Two Ledgers", "first": ("#########", "#S.a...G#", "#.#####.#", "#..b....#", "#########"),
     "future": ("#########", "#S.....G#", "#.#####.#", "#.......#", "#########"),
     "debts": {"a": ((4, 1),), "b": ((4, 3),)}, "budget": 17},
    {"name": "Countermark", "first": ("#########", "#S.a...G#", "#..b....#", "#########", "#########"),
     "future": ("#########", "#S.....G#", "#########", "#########", "#########"),
     "debts": {"a": ((4, 1),), "b": ((4, 1),)}, "toggle": True, "budget": 15},
    {"name": "Rewind Shrine", "first": ("#########", "#S.a...G#", "###.#####", "###r#####", "#########"),
     "future": ("#########", "#S.....G#", "#########", "#########", "#########"),
     "debts": {"a": ((4, 1),)}, "budget": 17},
    {"name": "Wind Reeds", "first": ("#########", "#S..a..G#", "#########", "#########", "#########"),
     "future": ("#########", "#S.....G#", "#.#####^#", "#..>....#", "#########"),
     "debts": {"a": ((4, 1),)}, "budget": 17},
    {"name": "Double Entry", "first": ("#########", "#S.a...G#", "#..b....#", "#########", "#########"),
     "future": ("#########", "#S.....G#", "#.#####^#", "#..>....#", "#########"),
     "debts": {"a": ((4, 1), (5, 1)), "b": ((4, 1), (5, 1))}, "toggle": True, "budget": 15},
    {"name": "Palimpsest Garden", "first": ("#########", "#S.a...G#", "#..b.r..#", "#########", "#########"),
     "future": ("#########", "#S.....G#", "#.#####^#", "#..>....#", "#########"),
     "debts": {"a": ((4, 1), (5, 1)), "b": ((4, 1),)}, "toggle": True, "budget": 15},
]


def locate(grid, char):
    for y, row in enumerate(grid):
        for x, value in enumerate(row):
            if value == char:
                return x, y
    raise ValueError(char)


def debt_keys(level):
    return tuple(sorted(level["debts"]))


def debt_cells(level, state):
    _phase, _x, _y, active, repaired, _last = state
    cells = set()
    for index, key in enumerate(debt_keys(level)):
        bit = 1 << index
        if not active & bit or repaired & bit:
            continue
        shape = set(level["debts"][key])
        if level.get("toggle"):
            cells ^= shape
        else:
            cells |= shape
    return frozenset(cells)


def start_state(level):
    x, y = locate(level["first"], "S")
    return 0, x, y, 0, 0, -1


def transition(level, state, action):
    phase, x, y, active, repaired, last = state
    if phase >= 2 or action not in DIRS:
        return state
    grid = level["first"] if phase == 0 else level["future"]
    dx, dy = DIRS[action]; nx, ny = x + dx, y + dy
    if not (0 <= nx < W and 0 <= ny < H) or grid[ny][nx] == "#":
        return state
    if phase == 1 and (nx, ny) in debt_cells(level, state):
        return state
    if phase == 1 and grid[ny][nx] in ARROWS and ARROWS[grid[ny][nx]] != action:
        return state
    char = grid[ny][nx]
    if phase == 0 and char in level["debts"]:
        index = debt_keys(level).index(char); bit = 1 << index
        if not active & bit:
            active |= bit; last = index
    if phase == 0 and char == "r" and last >= 0 and not repaired:
        repaired |= 1 << last
    if char == "G":
        if phase == 0:
            sx, sy = locate(level["future"], "S")
            return 1, sx, sy, active, repaired, last
        return 2, nx, ny, active, repaired, last
    return phase, nx, ny, active, repaired, last


def solved(_level, state):
    return state[0] == 2


class G540A(RenderableUserDisplay):
    CELL, OX, TOP, BOTTOM = 5, 9, 3, 36

    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b; steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps; y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @classmethod
    def _center(cls, phase, pos):
        ox = cls.OX; oy = cls.TOP if phase == 0 else cls.BOTTOM
        return ox + pos[0] * cls.CELL + 2, oy + pos[1] * cls.CELL + 2

    def _glyph(self, frame, key, center, color, hollow=False):
        x, y = center; index = max(0, ord(key) - ord("a"))
        if index % 3 == 0:
            self._disc(frame, center, 2, color, hollow=hollow)
        elif index % 3 == 1:
            self._line(frame, (x, y - 2), (x + 2, y), color)
            self._line(frame, (x + 2, y), (x, y + 2), color)
            self._line(frame, (x, y + 2), (x - 2, y), color)
            self._line(frame, (x - 2, y), (x, y - 2), color)
        else:
            self._line(frame, (x, y - 2), (x + 2, y + 2), color)
            self._line(frame, (x + 2, y + 2), (x - 2, y + 2), color)
            self._line(frame, (x - 2, y + 2), (x, y - 2), color)

    def _background(self, frame):
        frame[:, :] = INK
        for y in range(1, 63, 5): frame[y, 2 + y % 4:62:8] = CHARCOAL
        for x in range(3, 62, 7): frame[2 + x % 5:62:9, x] = EARTH
        frame[30:35, 5:59] = SLATE
        for x in range(8, 58, 8):
            self._disc(frame, (x, 32), 2, GOLD, hollow=True)

    def _wall(self, frame, center, future):
        x, y = center; color = BLUE if future else EARTH
        self._disc(frame, center, 3, color)
        self._disc(frame, (x - 2, y - 1), 2, CHARCOAL)
        self._disc(frame, (x + 2, y + 1), 2, color)
        frame[y - 2:y + 3:2, x - 2:x + 3:2] = ASH if future else GOLD

    def _path(self, frame, center, future):
        x, y = center; base = SLATE if future else EARTH; accent = AQUA if future else CORAL
        self._disc(frame, center, 3, base)
        frame[y, x - 2:x + 3:2] = accent

    def _debt(self, frame, center):
        x, y = center
        self._disc(frame, center, 3, CHARCOAL)
        self._line(frame, (x - 3, y + 3), (x, y - 3), RED)
        self._line(frame, (x, y - 3), (x + 3, y + 3), RED)
        self._line(frame, (x - 3, y), (x + 3, y), VIOLET)

    def _beetle(self, frame, center, color=GREEN):
        x, y = center
        self._disc(frame, center, 3, color)
        self._line(frame, (x, y - 3), (x, y + 3), INK)
        self._line(frame, (x - 2, y - 1), (x - 4, y - 3), color)
        self._line(frame, (x + 2, y - 1), (x + 4, y - 3), color)

    def _goal(self, frame, center, future):
        x, y = center; color = AQUA if future else GOLD
        self._disc(frame, center, 4, color, hollow=True)
        frame[y:y + 4, x - 4:x + 5] = color
        frame[y + 1:y + 4, x - 2:x + 3] = INK

    def _room(self, frame, phase, grid, state):
        g = self.game; future = phase == 1; active_debts = debt_cells(g.level, state)
        preview = {}
        for key, cells in g.level["debts"].items():
            for cell in cells: preview.setdefault(tuple(cell), []).append(key)
        for y, row in enumerate(grid):
            for x, char in enumerate(row):
                center = self._center(phase, (x, y))
                if char == "#": self._wall(frame, center, future); continue
                self._path(frame, center, future)
                if future and (x, y) in active_debts:
                    self._debt(frame, center)
                elif future and (x, y) in preview:
                    for offset, key in enumerate(preview[(x, y)][:2]):
                        self._glyph(frame, key, (center[0] - 1 + offset * 2, center[1]), ASH, hollow=True)
                if char in g.level["debts"]:
                    index = debt_keys(g.level).index(char); used = bool(state[3] & (1 << index)); repaired = bool(state[4] & (1 << index))
                    self._glyph(frame, char, center, ASH if repaired else PEARL if used else GOLD, hollow=used)
                elif char == "r":
                    self._disc(frame, center, 3, AQUA, hollow=True)
                    self._line(frame, (center[0] - 2, center[1]), (center[0] + 2, center[1] - 2), AQUA)
                elif char in ARROWS:
                    action = ARROWS[char]; dx, dy = DIRS[action]
                    self._line(frame, (center[0] - dx * 2, center[1] - dy * 2), (center[0] + dx * 2, center[1] + dy * 2), PEARL)
                    self._line(frame, (center[0] + dx * 2, center[1] + dy * 2), (center[0] + dx - dy * 2, center[1] + dy + dx * 2), PEARL)
                if char == "G": self._goal(frame, center, future)
        if state[0] == phase:
            self._beetle(frame, self._center(phase, (state[1], state[2])))
        elif phase == 0:
            self._beetle(frame, self._center(phase, locate(grid, "G")), ASH)
        else:
            self._beetle(frame, self._center(phase, locate(grid, "S")), ASH)

    def _hud(self, frame):
        g = self.game; groups, remainder = divmod(g.budget_left, 5)
        for i in range(groups):
            x = 4 + i * 7
            self._disc(frame, (x, 62), 2, GREEN, hollow=True)
            frame[60:63, x] = GREEN
        for i in range(remainder): frame[60:63, 43 + i * 3] = GOLD
        for index, key in enumerate(debt_keys(g.level)):
            x = 47 + index * 7; y = 32
            used = bool(g.state[3] & (1 << index)); repaired = bool(g.state[4] & (1 << index))
            self._glyph(frame, key, (x, y), AQUA if repaired else RED if used else ASH, hollow=not used)
            if used:
                self._line(frame, (x, 28), (x, 36), AQUA if repaired else RED, dotted=repaired)

    def _animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self._disc(frame, self._center(0, locate(g.level["first"], "S")), 7, GOLD, hollow=True)
            if g.terminal_hold == "loss":
                self._line(frame, (8, 8), (56, 57), RED)
                self._line(frame, (56, 8), (8, 57), RED)
            return
        p = g.anim_progress
        if g.anim_kind == "move":
            before = self._center(g.state[0], (g.state[1], g.state[2])); after = self._center(g.pending_state[0], (g.pending_state[1], g.pending_state[2]))
            x = before[0] + (after[0] - before[0]) * p // g.anim_total
            y = before[1] + (after[1] - before[1]) * p // g.anim_total
            self._beetle(frame, (x, y), CORAL)
        elif g.anim_kind in ("stamp", "repair"):
            key = debt_keys(g.level)[g.pending_state[5] if g.pending_state[5] >= 0 else 0]
            source = self._center(0, (g.pending_state[1], g.pending_state[2]))
            target = self._center(1, g.level["debts"][key][0])
            mid = (source[0] + (target[0] - source[0]) * p // g.anim_total,
                   source[1] + (target[1] - source[1]) * p // g.anim_total)
            self._glyph(frame, key, mid, AQUA if g.anim_kind == "repair" else RED)
            self._line(frame, source, mid, AQUA if g.anim_kind == "repair" else VIOLET, dotted=True)
        elif g.anim_kind == "phase":
            y = 4 + p * 7
            frame[max(0, y - 2):min(64, y + 3), 5:59] = AQUA
            self._disc(frame, (32, 32), min(12, 2 + p * 2), GOLD, hollow=True)
        elif g.anim_kind == "blocked":
            center = self._center(g.state[0], (g.state[1], g.state[2]))
            self._disc(frame, center, 4 + p % 2, RED, hollow=True)
        elif g.anim_kind == "success":
            for radius in range(4, min(30, 4 + p * 4), 5): self._disc(frame, (32, 32), radius, GREEN, hollow=True)
        elif g.anim_kind == "loss":
            self._line(frame, (8 + p, 8), (56 - p, 57), RED)
            self._line(frame, (56 - p, 8), (8 + p, 57), RED)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame); self._room(frame, 0, self.game.level["first"], self.game.state)
        self._room(frame, 1, self.game.level["future"], self.game.state)
        self._hud(frame); self._animation(frame); return frame


class G540(ARCBaseGame):
    def __init__(self):
        self.display = G540A(self); self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0; self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None; self.pending_budget = None; self.pending_terminal = None
        self.intro_mark = True; self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("g540", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]), False, len(levels), [1, 2, 3, 4])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None; self.pending_budget = None; self.pending_terminal = None
        self.intro_mark = True; self.terminal_hold = None

    def _begin(self, kind, frames, state, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.pending_state = state; self.pending_budget = budget; self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win":
            self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss":
            self.terminal_hold = "loss"; self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self._finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action(); return
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        if after == self.state:
            self._begin("blocked", 4, after, self.budget_left); return
        budget = self.budget_left - 1; won = solved(self.level, after); lost = budget <= 0 and not won
        new_active = after[3] != self.state[3]; new_repair = after[4] != self.state[4]
        phase_change = after[0] != self.state[0] and not won
        kind = "success" if won else "phase" if phase_change else "repair" if new_repair else "stamp" if new_active else "move"
        self._begin(kind, 7 if kind in ("success", "phase", "stamp", "repair") else 5,
                    after, budget, "win" if won else "loss" if lost else None)
