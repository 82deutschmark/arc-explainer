# ARC-AGI-3 candidate task g541.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, SILVER, ASH, SLATE, COAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


LEVELS = [
    {"name": "First Cut", "period": 8, "events": (2,), "budget": 5,
     "warp": (), "reverse": (), "echo": (), "drift": False},
    {"name": "Shape Reel", "period": 13, "events": (3, 10, 5), "budget": 23,
     "warp": (), "reverse": (), "echo": (), "drift": False},
    {"name": "Elastic Film", "period": 15, "events": (5, 12, 7), "budget": 25,
     "warp": (1, 2, 8), "reverse": (), "echo": (), "drift": False},
    {"name": "Backsplice", "period": 14, "events": (3, 10, 5), "budget": 26,
     "warp": (), "reverse": (0, 1), "echo": (), "drift": False},
    {"name": "Echo Gate", "period": 12, "events": (2, 7), "budget": 27,
     "warp": (), "reverse": (), "echo": (1,), "drift": False},
    {"name": "Walking Marks", "period": 15, "events": (4, 11, 6), "budget": 26,
     "warp": (), "reverse": (), "echo": (), "drift": True},
    {"name": "Moonlit Assembly", "period": 16, "events": (3, 12, 7), "budget": 38,
     "warp": (1, 8, 9), "reverse": (0, 2), "echo": (1,), "drift": False},
    {"name": "Shutter Orbit", "period": 17, "events": (4, 13, 8, 1), "budget": 48,
     "warp": (2, 3, 10), "reverse": (0, 2), "echo": (1,), "drift": True},
]


def start_state(level):
    return 0, 0, 1, 0, 0, 2


def event_phase(level, state, index=None):
    if index is None:
        index = state[1]
    return (level["events"][index] + state[3]) % level["period"]


def transition(level, state, action):
    phase, index, direction, shift, echo, slips = state
    if index >= len(level["events"]) or slips <= 0:
        return state
    if action == 5:
        jump = 2 if phase in level.get("warp", ()) else 1
        phase = (phase + direction * jump) % level["period"]
        if echo == 1:
            opposite = (event_phase(level, state) + level["period"] // 2) % level["period"]
            if phase == opposite:
                echo = 2
        return phase, index, direction, shift, echo, slips
    if action != 6 or phase != event_phase(level, state):
        return phase, index, direction, shift, echo, slips - (1 if action == 6 else 0)
    if index in level.get("echo", ()):
        if echo == 0:
            return phase, index, direction, shift, 1, slips
        if echo != 2:
            return phase, index, direction, shift, echo, slips - 1
    old_index = index
    index += 1
    echo = 0
    if level.get("drift"):
        shift = (shift + direction) % level["period"]
    if old_index in level.get("reverse", ()):
        direction *= -1
    return phase, index, direction, shift, echo, slips


def solved(level, state):
    return state[1] == len(level["events"]) and state[5] > 0


class G541A(RenderableUserDisplay):
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
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def _pos(phase, period, radius=20):
        angle = -math.pi / 2 + 2 * math.pi * phase / period
        return 32 + round(radius * math.cos(angle)), 31 + round(radius * math.sin(angle))

    def _background(self, frame):
        frame[:, :] = INK
        frame[3:59, 3:61] = COAL
        for y in range(6, 58, 5):
            frame[y, 5 + (y % 7):59:9] = SLATE
        for x in range(6, 59, 7):
            frame[5:8, x:x + 2] = ASH
            frame[54:57, x:x + 2] = ASH
        frame[9:53, 6:58] = INK
        self._disc(frame, (32, 31), 23, SLATE, hollow=True)
        self._disc(frame, (32, 31), 18, COAL, hollow=True)
        self._disc(frame, (32, 31), 4, ASH, hollow=True)

    def _event_glyph(self, frame, index, center, color, tiny=False):
        x, y = center; r = 1 if tiny else 3
        kind = index % 4
        if kind == 0:
            self._disc(frame, center, r + 1, color, hollow=True)
            frame[y, x] = color
        elif kind == 1:
            for d in range(-r, r + 1):
                span = r - abs(d)
                frame[y + d, x - span:x + span + 1] = color
        elif kind == 2:
            frame[y - r:y + r + 1, x] = color
            frame[y, x - r:x + r + 1] = color
        else:
            self._line(frame, (x - r, y - r), (x + r, y + r), color)
            self._line(frame, (x + r, y - r), (x - r, y + r), color)

    def _track(self, frame):
        g = self.game; state = g.state
        for p in range(g.level["period"]):
            x, y = self._pos(p, g.level["period"])
            color = ASH if p not in g.level.get("warp", ()) else VIOLET
            if p in g.level.get("warp", ()):
                frame[y - 1:y + 2, x - 1:x + 2] = color
                frame[y, x] = INK
            else:
                self._disc(frame, (x, y), 1, color)
        for i in range(state[1], len(g.level["events"])):
            phase = (g.level["events"][i] + state[3]) % g.level["period"]
            self._event_glyph(frame, i, self._pos(phase, g.level["period"]), GOLD if i == state[1] else AQUA)
        if state[1] < len(g.level["events"]) and state[1] in g.level.get("echo", ()):
            opposite = (event_phase(g.level, state) + g.level["period"] // 2) % g.level["period"]
            x, y = self._pos(opposite, g.level["period"])
            self._disc(frame, (x, y), 4, ROSE, hollow=True)
            if state[4] == 2:
                self._disc(frame, (x, y), 2, ROSE)
        x, y = self._pos(state[0], g.level["period"], 16)
        self._disc(frame, (x, y), 4, SILVER)
        self._disc(frame, (x, y), 2, BLUE)
        frame[y, x + state[2] * 4] = GOLD
        frame[y - 1:y + 2, x + state[2] * 3] = GOLD

    def _reel_hud(self, frame):
        g = self.game; state = g.state
        start = 30 - 6 * len(g.level["events"]) // 2
        for i in range(len(g.level["events"])):
            x = start + i * 7
            frame[1:7, x - 2:x + 3] = SLATE
            if i < state[1]:
                self._event_glyph(frame, i, (x, 4), GOLD, tiny=True)
            else:
                frame[3:5, x - 1:x + 2] = INK
        d = state[2]
        cx = 32
        for k in range(5):
            frame[59 + abs(2 - k):61 + abs(2 - k), cx + d * (k - 2)] = AQUA
        groups, remainder = divmod(g.budget_left, 4)
        for i in range(groups):
            x = 5 + i * 3
            self._disc(frame, (x, 58), 2, SILVER, hollow=True)
            frame[58, x] = SILVER
        for i in range(remainder):
            frame[57:59, 43 + i * 2] = GOLD
        for i in range(2):
            x = 53 + i * 4
            if i < state[5]:
                self._disc(frame, (x, 58), 2, ROSE, hollow=True)
            else:
                frame[57:60, x - 1:x + 2] = RED

    def _animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self._disc(frame, (32, 31), 6, GOLD, hollow=True)
            if g.terminal_hold == "loss":
                frame[28:35, 7:57] = RED
                frame[30:33, 11:53:4] = INK
            elif g.terminal_hold == "win":
                self._disc(frame, (32, 31), 12, GREEN, hollow=True)
            return
        p = g.anim_progress; total = max(1, g.anim_total)
        if g.anim_kind == "wait":
            before = self._pos(g.anim_before[0], g.level["period"], 16)
            after = self._pos(g.pending_state[0], g.level["period"], 16)
            x = before[0] + (after[0] - before[0]) * p // total
            y = before[1] + (after[1] - before[1]) * p // total
            self._disc(frame, (x, y), 2 + p % 2, AQUA)
            self._line(frame, before, (x, y), VIOLET, dotted=True)
        elif g.anim_kind in ("capture", "echo"):
            x, y = self._pos(g.state[0], g.level["period"])
            self._disc(frame, (x, y), min(8, 2 + p), GOLD, hollow=True)
            self._line(frame, (x, y), (32, 4), GOLD, dotted=(g.anim_kind == "echo"))
            if g.anim_kind == "echo":
                self._disc(frame, (32, 31), min(10, 2 + p), ROSE, hollow=True)
        elif g.anim_kind == "miss":
            offset = (2, -2, 1, -1, 0)[min(p, 4)]
            frame[12:51, 30 + offset:34 + offset] = RED
            frame[16:47:4, 7:57] = RED
        elif g.anim_kind == "transition":
            self._disc(frame, (32, 31), min(20, 3 + p * 3), GREEN, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame)
        self._track(frame)
        self._reel_hud(frame)
        self._animation(frame)
        return frame


class G541(ARCBaseGame):
    def __init__(self):
        self.display = G541A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("g541", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]),
                         False, len(levels), [5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def _begin(self, kind, frames, next_state, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.anim_before = self.state
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
        elif terminal == "loss" or self.budget_left <= 0:
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
            self.complete_action(); return
        self.intro_mark = False
        if action not in (5, 6):
            self._begin("miss", 4, self.state); return
        after = transition(self.level, self.state, action)
        self.budget_left -= 1
        if action == 5:
            kind = "wait"
        elif after[5] < self.state[5]:
            kind = "miss"
        elif after[1] == self.state[1]:
            kind = "echo"
        else:
            kind = "capture"
        terminal = "win" if solved(self.level, after) else "loss" if after[5] <= 0 or self.budget_left <= 0 else None
        self._begin(kind, 4 if kind == "wait" else 6, after, terminal)
