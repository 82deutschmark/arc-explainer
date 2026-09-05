# ARC-AGI-3 candidate task g508.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


LEVELS = [
    {"name": "First Root", "start": (2, 2, 1), "edges": ((0, 1), (1, 2)),
     "plan": (5, 4, 5), "distance": False, "shields": (), "hidden": False,
     "catalysts": (), "one_use": False, "required": (0, 1), "budget": 5},
    {"name": "Second Ring", "start": (2, 1, 2, 1, 2), "edges": ((0, 1), (1, 2), (2, 3), (3, 4)),
     "plan": (5, 4, 4, 5, 4, 4, 5, 3, 3, 5), "distance": True, "shields": (), "hidden": False,
     "catalysts": (), "one_use": False, "required": (0, 2, 4), "budget": 7},
    {"name": "Shell Nodes", "start": (2, 2, 1, 2, 1), "edges": ((0, 1), (0, 2), (2, 3), (2, 4)),
     "plan": (4, 5, 4, 5, 4, 5, 3, 3, 3, 5), "distance": True, "shields": (1, 3), "hidden": False,
     "catalysts": (), "one_use": False, "required": (0, 1, 2, 3), "budget": 11},
    {"name": "Buried Mycelium", "start": (2, 1, 2, 1, 2, 1),
     "edges": ((0, 1), (1, 2), (1, 3), (3, 4), (2, 5)),
     "plan": (1, 5, 4, 4, 5, 4, 4, 5, 3, 3, 5), "distance": True, "shields": (4,), "hidden": True,
     "catalysts": (), "one_use": False, "required": (0, 2, 4), "budget": 11},
    {"name": "Star Sap", "start": (2, 2, 1, 2, 2, 1),
     "edges": ((0, 1), (1, 2), (2, 3), (2, 4), (4, 5)),
     "plan": (4, 4, 5, 4, 4, 5, 3, 3, 3, 5, 4, 5), "distance": True, "shields": (1,), "hidden": False,
     "catalysts": (2, 4), "one_use": False, "required": (1, 2, 4), "budget": 9},
    {"name": "Scar Memory", "start": (2, 1, 2, 2, 1, 2),
     "edges": ((0, 1), (1, 2), (2, 3), (3, 4), (2, 5)),
     "plan": (5, 4, 4, 5, 4, 5, 4, 5, 4, 5), "distance": True, "shields": (3,), "hidden": False,
     "catalysts": (2,), "one_use": True, "required": (0, 2, 3, 4, 5), "budget": 12},
    {"name": "Moonroot Ward", "start": (2, 2, 1, 2, 1, 2, 1),
     "edges": ((0, 1), (1, 2), (1, 3), (3, 4), (3, 5), (5, 6)),
     "plan": (1, 4, 5, 4, 4, 5, 4, 4, 5, 3, 3, 3, 5, 4, 4, 5), "distance": True,
     "shields": (2, 5), "hidden": True, "catalysts": (1, 4), "one_use": True,
     "required": (1, 2, 3, 4, 5), "budget": 14},
    {"name": "Rootward Clinic", "start": (2, 1, 2, 2, 1, 2, 2, 1),
     "edges": ((0, 1), (1, 2), (2, 3), (2, 4), (4, 5), (4, 6), (6, 7)),
     "plan": (1, 5, 4, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5), "distance": True,
     "shields": (3, 6), "hidden": True, "catalysts": (2, 4), "one_use": True,
     "required": (0, 2, 4, 5, 7), "budget": 15},
]


def adjacency(level):
    out = {i: set() for i in range(len(level["start"]))}
    for a, b in level["edges"]:
        out[a].add(b); out[b].add(a)
    return out


def rings(level, node):
    near = adjacency(level)[node]
    graph = adjacency(level)
    far = set().union(*(graph[n] for n in near)) - near - {node} if near else set()
    return near, far


def start_state(level):
    return tuple(level["start"]), 0, not level.get("hidden"), 0, 2


def transition(level, state, action):
    values, cursor, probed, spent, chances = state
    if chances <= 0:
        return state
    if action == 1 and level.get("hidden") and not probed:
        return values, cursor, True, spent, chances
    if action == 3:
        return values, (cursor - 1) % len(values), probed, spent, chances
    if action == 4:
        return values, (cursor + 1) % len(values), probed, spent, chances
    if action != 5:
        return state
    if level.get("one_use") and spent & (1 << cursor):
        return state
    near, far = rings(level, cursor)
    revised = list(values)
    revised[cursor] = max(0, revised[cursor] - 1)
    shields = set(level.get("shields", ()))
    for node in near:
        if node not in shields:
            revised[node] = max(0, revised[node] - 1)
    if level.get("distance"):
        healing_star = cursor in level.get("catalysts", ())
        for node in far:
            if node in shields:
                continue
            revised[node] = max(0, revised[node] - 1) if healing_star else min(2, revised[node] + 1)
    return tuple(revised), cursor, probed, spent | (1 << cursor), chances


def target_values(level):
    state = start_state(level)
    for action in level["plan"]:
        state = transition(level, state, action)
    return state[0]


def solved(level, state):
    values, _cursor, probed, spent, chances = state
    required = sum(1 << node for node in level.get("required", ()))
    return (values == target_values(level) and probed and spent & required == required and chances > 0)


def submit_transition(level, state):
    if solved(level, state):
        return state
    values, cursor, probed, spent, chances = state
    return values, cursor, probed, spent, chances - 1


class G508A(RenderableUserDisplay):
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
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps; y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def _positions(n):
        return tuple((32 + round(19 * math.cos(-math.pi / 2 + 2 * math.pi * i / n)),
                      33 + round(18 * math.sin(-math.pi / 2 + 2 * math.pi * i / n))) for i in range(n))

    def _background(self, frame):
        frame[:, :] = INK
        frame[3:61, 3:61] = CHARCOAL
        for y in range(5, 60, 6):
            frame[y, 5 + y % 5:59:8] = EARTH
        for x in range(6, 59, 9):
            frame[7 + x % 4:58:7, x] = SLATE
        self._disc(frame, (32, 34), 25, INK)

    def _edges(self, frame):
        g = self.game; positions = self._positions(len(g.state[0]))
        if g.state[2]:
            for a, b in g.level["edges"]:
                self._line(frame, positions[a], positions[b], AQUA, dotted=False)
                ax, ay = positions[a]; bx, by = positions[b]
                self._line(frame, (ax, ay + 1), (bx, by + 1), GREEN, dotted=True)
        elif g.level.get("hidden"):
            self._disc(frame, (32, 34), 23, VIOLET, hollow=True)
            for i in range(12):
                x, y = 32 + round(23 * math.cos(i * math.pi / 6)), 34 + round(23 * math.sin(i * math.pi / 6))
                frame[y, x] = ASH

    def _node(self, frame, node, center, value, target, cursor, spent):
        g = self.game; x, y = center
        color = (GREEN, GOLD, RED)[value]
        self._disc(frame, center, 6, SLATE)
        for dx, dy in ((0, -5), (5, 0), (0, 5), (-5, 0)):
            self._disc(frame, (x + dx, y + dy), 3, color)
        self._disc(frame, center, 3, INK)
        for i in range(value):
            frame[y - 1 + i * 2:y + i * 2 + 1, x - 7:x + 8] = RED
        for i in range(target):
            self._disc(frame, (x - 2 + i * 4, y - 9), 1, PEARL)
        if node in g.level.get("shields", ()):
            self._disc(frame, center, 9, PEARL, hollow=True)
            frame[y - 9:y - 7, x - 2:x + 3] = PEARL
        if node in g.level.get("catalysts", ()):
            frame[y - 3:y + 4, x] = GOLD; frame[y, x - 3:x + 4] = GOLD
            self._line(frame, (x - 3, y - 3), (x + 3, y + 3), GOLD)
        if node in g.level.get("required", ()):
            marker = (x + 8, y + 6)
            if spent:
                self._disc(frame, marker, 2, PEARL, hollow=True)
                frame[marker[1], marker[0]] = PEARL
            else:
                self._line(frame, (x + 6, y + 3), (x + 6, y + 10), PEARL)
                self._line(frame, (x + 6, y + 3), (x + 11, y + 5), PEARL)
                self._line(frame, (x + 11, y + 5), (x + 6, y + 7), PEARL)
        if spent and g.level.get("one_use"):
            self._line(frame, (x - 6, y - 6), (x + 6, y + 6), ASH)
            self._line(frame, (x + 6, y - 6), (x - 6, y + 6), ASH)
        if cursor:
            frame[y - 11:y - 9, x - 5:x + 6] = ROSE
            frame[y + 9:y + 11, x - 5:x + 6] = ROSE
            frame[y - 5:y + 6, x - 11:x - 9] = ROSE
            frame[y - 5:y + 6, x + 9:x + 11] = ROSE

    def _hud(self, frame):
        g = self.game
        groups, remainder = divmod(g.budget_left, 5)
        for i in range(groups): self._disc(frame, (7 + i * 5, 59), 2, GREEN, hollow=True)
        for i in range(remainder): frame[57:59, 44 + i * 2] = GOLD
        for i in range(2):
            x = 55 + i * 4
            if i < g.state[4]: self._disc(frame, (x, 59), 2, ROSE, hollow=True)
            else:
                self._line(frame, (x - 2, 57), (x + 2, 61), RED)
                self._line(frame, (x + 2, 57), (x - 2, 61), RED)
        if g.level.get("hidden"):
            if g.state[2]:
                self._disc(frame, (6, 6), 4, AQUA, hollow=True)
                frame[6, 2:11] = AQUA; frame[2:11, 6] = AQUA
            else:
                self._disc(frame, (6, 6), 4, VIOLET)
                frame[5:8, 4:9] = INK

    def _animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark: self._disc(frame, (32, 34), 12, GOLD, hollow=True)
            if g.terminal_hold == "loss":
                self._line(frame, (9, 19), (55, 50), RED)
                self._line(frame, (55, 19), (9, 50), RED)
            elif g.terminal_hold == "win":
                self._disc(frame, (32, 34), 20, GREEN, hollow=True)
            return
        p = g.anim_progress; positions = self._positions(len(g.state[0]))
        if g.anim_kind == "cursor":
            a = positions[g.anim_before[1]]; b = positions[g.pending_state[1]]
            x = a[0] + (b[0] - a[0]) * p // g.anim_total
            y = a[1] + (b[1] - a[1]) * p // g.anim_total
            self._disc(frame, (x, y), 2 + p % 2, ROSE)
        elif g.anim_kind == "probe":
            self._disc(frame, (32, 34), min(25, 4 + p * 4), AQUA, hollow=True)
        elif g.anim_kind == "treat":
            center = positions[g.state[1]]
            self._disc(frame, center, min(14, 3 + p * 2), GOLD, hollow=True)
            near, far = rings(g.level, g.state[1])
            for node in near: self._line(frame, center, positions[node], GREEN)
            for node in far: self._line(frame, center, positions[node], VIOLET, dotted=True)
        elif g.anim_kind == "blocked":
            x, y = positions[g.state[1]]
            self._line(frame, (x - 7 - p, y - 7), (x + 7 + p, y + 7), ASH)
        elif g.anim_kind == "miss":
            self._disc(frame, (32, 34), min(22, 5 + p * 3), RED, hollow=True)
        elif g.anim_kind == "success":
            self._disc(frame, (32, 34), min(25, 5 + p * 3), GREEN, hollow=True)
            for x, y in positions:
                self._disc(frame, (x, y), min(8, 2 + p), PEARL, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame); self._edges(frame)
        g = self.game; positions = self._positions(len(g.state[0])); targets = target_values(g.level)
        for i, value in enumerate(g.state[0]):
            self._node(frame, i, positions[i], value, targets[i], i == g.state[1], bool(g.state[3] & (1 << i)))
        self._hud(frame); self._animation(frame)
        return frame


class G508(ARCBaseGame):
    def __init__(self):
        self.display = G508A(self); self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0; self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0; self.anim_before = self.state
        self.pending_state = None; self.pending_terminal = None; self.intro_mark = True; self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("q030", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]), False, len(levels), [1, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None; self.pending_terminal = None; self.intro_mark = True; self.terminal_hold = None

    def _begin(self, kind, frames, state, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = state; self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.anim_kind = None; self.pending_state = None; self.pending_terminal = None
        if terminal == "win": self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss" or self.budget_left <= 0: self.terminal_hold = "loss"; self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self._finish()
            return
        action = self.action.id.value
        if action == 0: self.complete_action(); return
        self.intro_mark = False
        if action == 6:
            won = solved(self.level, self.state); after = self.state if won else submit_transition(self.level, self.state)
            if not won: self.budget_left -= 1
            self._begin("success" if won else "miss", 7, after,
                        "win" if won else "loss" if after[4] <= 0 or self.budget_left <= 0 else None)
            return
        after = transition(self.level, self.state, action)
        if after == self.state:
            self._begin("blocked", 4, after); return
        self.budget_left -= 1
        kind = "probe" if action == 1 else "cursor" if action in (3, 4) else "treat"
        self._begin(kind, 5 if kind != "treat" else 7, after,
                    "loss" if self.budget_left <= 0 else None)
