# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q155-v2 Echo Council -- transfer one visible relation across strange roles.

The upper gallery demonstrates a transformation on simple emblems.  The lower
council asks for the matching embodied role.  Turns, marked soloists, duets,
and a passed baton compose the same relation without language or digits.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, MIST, ASH, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, SUN, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
TWIST, MARKED, DUET, RELAY = 1, 2, 4, 8


LEVELS = [
    {"name": "Four Echoes", "axis": 0, "turn": 0, "emblem_roles": True,
     "queries": ((0, 0, 0), (1, 0, 0), (3, 0, 0), (2, 0, 0))},
    {"name": "New Masks", "axis": 1, "turn": 0, "emblem_roles": False,
     "queries": ((0, 0, 0), (2, 0, 0), (1, 0, 0), (3, 0, 0),
                 (2, 0, 0), (0, 0, 0), (3, 0, 0), (1, 0, 0), (2, 0, 0))},
    {"name": "Turning Chorus", "axis": 2, "turn": 1, "emblem_roles": False,
     "queries": ((0, 0, 0), (1, TWIST, 0), (3, 0, 0), (2, TWIST, 0),
                 (1, 0, 0), (0, TWIST, 0), (2, 0, 0), (3, TWIST, 0), (1, TWIST, 0))},
    {"name": "Marked Soloists", "axis": 3, "turn": 0,
     "queries": ((0, 0, 0), (1, MARKED, 0), (2, 0, 0), (3, MARKED, 0),
                 (0, MARKED, 0), (2, MARKED, 0), (1, 0, 0), (3, 0, 0), (2, 0, 0))},
    {"name": "Duet Relation", "axis": 1, "turn": 0,
     "queries": ((0, DUET, 1), (2, DUET, 3), (1, DUET, 1), (3, DUET, 0),
                 (2, DUET, 0), (1, DUET, 3), (0, DUET, 2), (3, DUET, 2), (1, DUET, 0))},
    {"name": "Passing Baton", "axis": 2, "turn": 0,
     "queries": ((0, RELAY, 0), (1, RELAY, 0), (3, RELAY, 0), (2, RELAY, 0),
                 (0, RELAY, 0), (2, RELAY, 0), (1, RELAY, 0), (3, RELAY, 0), (2, RELAY, 0))},
    {"name": "Festival Round", "axis": 0, "turn": 1,
     "queries": ((0, TWIST, 0), (1, MARKED, 0), (2, TWIST | DUET, 3),
                 (3, MARKED | DUET, 1), (1, TWIST | MARKED, 0),
                 (0, DUET, 2), (3, TWIST | MARKED | DUET, 2),
                 (2, MARKED, 0), (1, TWIST | DUET, 0), (0, TWIST | MARKED, 0))},
    {"name": "Echo Council", "axis": 3, "turn": 1,
     "queries": ((0, TWIST | RELAY, 0), (1, MARKED | RELAY, 0),
                 (2, DUET | RELAY, 3), (3, TWIST | MARKED | RELAY, 0),
                 (1, TWIST | DUET | RELAY, 0), (0, MARKED | DUET | RELAY, 2),
                 (3, TWIST | MARKED | DUET | RELAY, 1), (2, RELAY, 0),
                 (1, TWIST | MARKED | RELAY, 0), (0, DUET | RELAY, 3))},
]


def start_state(_level):
    return 0, 2, 0


def answer(level, query, last):
    shape, flags, partner = query
    value = (level["axis"] - shape) % 4
    if flags & TWIST:
        value = (value + level["turn"]) % 4
    if flags & MARKED:
        value = (-value) % 4
    if flags & DUET:
        value = (value + (level["axis"] - partner)) % 4
    if flags & RELAY:
        value = (value + last) % 4
    return value + 1


def transition(level, state, action):
    progress, chances, last = state
    if action not in (1, 2, 3, 4) or progress >= len(level["queries"]):
        return state
    if action == answer(level, level["queries"][progress], last):
        return progress + 1, chances, action - 1
    return progress, chances - 1, last


def solved(level, state):
    return state[0] == len(level["queries"])


class CouncilDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def _background(self, frame):
        frame[:, :] = PAPER
        self._disc(frame, (32, 32), 29, PEARL)
        self._disc(frame, (32, 32), 25, MIST)
        for x, y in ((7, 8), (56, 9), (5, 39), (59, 36), (12, 58), (50, 57)):
            self._disc(frame, (x, y), 3, ROSE)
            self._disc(frame, (x, y), 1, SUN)
        for radius in (19, 23):
            for x, y in ((32, 32 - radius), (32 + radius, 32), (32, 32 + radius), (32 - radius, 32)):
                self._disc(frame, (x, y), 1, VIOLET)

    def _emblem(self, frame, shape, center, scale=1, color=VIOLET):
        x, y = center
        r = 2 * scale
        if shape == 0:
            self._disc(frame, center, r, color)
            self._disc(frame, center, max(0, r - scale), PAPER)
        elif shape == 1:
            for dy in range(-r, r + 1):
                span = r - abs(dy)
                frame[y + dy, x - span:x + span + 1] = color
        elif shape == 2:
            for row in range(2 * r + 1):
                span = row
                frame[y - r + row, x - span // 2:x + span // 2 + 1] = color
        else:
            frame[y - r:y + r + 1, x] = color
            frame[y, x - r:x + r + 1] = color

    def _role(self, frame, role, center, scale=1, color=None):
        x, y = center
        colors = (AQUA, CORAL, GREEN, MAGENTA)
        color = colors[role] if color is None else color
        if role == 0:
            self._disc(frame, (x, y), 3 * scale, color)
            self._disc(frame, (x, y), scale, PAPER)
            frame[y - 5 * scale:y - 3 * scale, x] = color
        elif role == 1:
            for dy in range(-3 * scale, 3 * scale + 1):
                span = 3 * scale - abs(dy)
                frame[y + dy, x - span:x + span + 1] = color
            frame[y, x - 5 * scale:x + 6 * scale:2 * scale] = color
        elif role == 2:
            for row in range(6 * scale + 1):
                span = row
                frame[y - 3 * scale + row, x - span // 2:x + span // 2 + 1] = color
            frame[y - scale:y + 2 * scale, x - 5 * scale:x + 6 * scale:3 * scale] = color
        else:
            frame[y - 3 * scale:y + 4 * scale, x - 3 * scale:x + 4 * scale] = color
            frame[y - 5 * scale:y + 6 * scale, x] = PAPER
            frame[y, x - 5 * scale:x + 6 * scale] = PAPER

    def _output(self, frame, role, center, scale=1, color=None):
        if self.game.level.get("emblem_roles"):
            self._emblem(frame, role, center, scale, VIOLET if color is None else color)
        else:
            self._role(frame, role, center, scale, color)

    def _query(self, frame, query, center, last, small=False):
        shape, flags, partner = query
        x, y = center
        scale = 1
        self._emblem(frame, shape, center, scale, VIOLET)
        if flags & TWIST:
            for dx, dy in ((0, -6), (6, 0), (0, 6), (-6, 0)):
                frame[y + dy, x + dx] = BLUE
            self._line(frame, (x - 5, y - 5), (x + 5, y - 5), BLUE, dotted=True)
        if flags & MARKED:
            frame[y - 7:y - 5, x - 5:x + 6:2] = INK
            frame[y + 5:y + 7, x - 5:x + 6:2] = INK
        if flags & DUET:
            self._emblem(frame, partner, (x + (8 if not small else 6), y + 3), 1, CORAL)
            self._line(frame, (x + 3, y), (x + 6, y + 2), GREEN, dotted=True)
        if flags & RELAY:
            self._role(frame, last, (x - (9 if not small else 7), y + 2), 1, SUN)
            self._line(frame, (x - 6, y + 1), (x - 3, y), SUN, dotted=True)

    def _examples(self, frame):
        g = self.game
        last = 0
        for index, query in enumerate(g.level["queries"][:3]):
            x = 12 + index * 20
            self._disc(frame, (x, 10), 7, PAPER)
            self._query(frame, query, (x - 3, 10), last, small=True)
            role = answer(g.level, query, last) - 1
            self._output(frame, role, (x + 5, 10), 1)
            self._line(frame, (x, 4), (x, 16), ASH, dotted=True)
            last = role

    def _council(self, frame):
        g = self.game
        if not solved(g.level, g.state):
            query = g.level["queries"][g.state[0]]
            self._disc(frame, (32, 31), 13, PAPER)
            self._disc(frame, (32, 31), 10, PEARL)
            self._query(frame, query, (32, 31), g.state[2])
        positions = ((9, 52), (24, 55), (40, 55), (55, 52))
        for role, center in enumerate(positions):
            self._disc(frame, center, 7, PAPER)
            self._output(frame, role, center)
        total = len(g.level["queries"])
        for index in range(total):
            x = 8 + index * 48 // max(1, total - 1)
            if index < g.state[0]:
                self._disc(frame, (x, 43), 2, GREEN)
            elif index == g.state[0]:
                for dx, dy in ((0, -2), (2, 0), (0, 2), (-2, 0)):
                    frame[43 + dy, x + dx] = VIOLET
            else:
                frame[43, x] = ASH
        for chance in range(2):
            x = 29 + chance * 6
            if chance < g.state[1]:
                self._disc(frame, (x, 19), 2, ROSE)
                frame[17:22, x] = PAPER
            else:
                self._line(frame, (x - 2, 17), (x + 2, 21), RED)
                self._line(frame, (x + 2, 17), (x - 2, 21), RED)

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            for x in range(8, 59, 5):
                self._disc(frame, (x, 3), 1, SUN)
        if g.terminal_hold == "win":
            for role, center in enumerate(((32, 14), (49, 31), (32, 48), (15, 31))):
                self._role(frame, role, center)
            for radius, color in ((13, ROSE), (8, SUN), (3, PAPER)):
                self._disc(frame, (32, 31), radius, color)
        elif g.terminal_hold == "loss":
            frame[8:57:3, 5:60] = RED
            frame[8:57, 5:60:4] = CHARCOAL
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind == "correct":
            start = ((9, 52), (24, 55), (40, 55), (55, 52))[g.anim_action - 1]
            x = start[0] + (32 - start[0]) * p // g.anim_total
            y = start[1] + (31 - start[1]) * p // g.anim_total
            self._output(frame, g.anim_action - 1, (x, y))
            self._disc(frame, (32, 31), min(9, 2 + p), SUN)
        elif g.anim_kind == "wrong":
            offset = -2 if p % 2 else 2
            self._output(frame, g.anim_action - 1, (32 + offset, 31), color=RED)
            frame[22 + p:41 - p:3, 23:42] = RED

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame)
        self._examples(frame)
        self._council(frame)
        self._animation(frame)
        return frame


class Q155(ARCBaseGame):
    def __init__(self):
        self.display = CouncilDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_action = 1
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q155", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_action = 1
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def _begin(self, kind, action, next_state, terminal=None):
        self.anim_kind = kind
        self.anim_action = action
        self.anim_total = self.anim_left = 6
        self.anim_progress = 0
        self.pending_state = next_state
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.anim_kind = None
        self.pending_state = None
        self.pending_terminal = None
        if terminal == "win":
            self.terminal_hold = "win"
            self.next_level()
        elif terminal == "loss":
            self.terminal_hold = "loss"
            self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1
            self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0:
                self._finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        correct = after[0] > self.state[0]
        terminal = "win" if solved(self.level, after) else "loss" if after[1] <= 0 else None
        self._begin("correct" if correct else "wrong", action, after, terminal)
