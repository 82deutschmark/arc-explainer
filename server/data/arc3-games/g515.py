# ARC-AGI-3 candidate task g515.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, SILVER, ASH, CHARCOAL, BLACK = 0, 1, 2, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 14, 15
LANE_Y = {0: 22, 1: 29, 2: 36, 3: 43}


LEVELS = [
    {"name": "First Caustic", "start": (0,), "kinds": ("p",), "fixed": (), "links": (),
     "inputs": (0,), "ray_checks": ((0,),), "plan": (2,), "budget": 4},
    {"name": "Serial Glass", "start": (0, 0, 0), "kinds": ("p", "p", "p"), "fixed": (), "links": (),
     "inputs": (0,), "ray_checks": ((0, 1, 2),), "plan": (1, 1, 3, 1, 1, 3, 1, 1), "budget": 10},
    {"name": "Opposed Curves", "start": (0, 1, 2), "kinds": ("p", "n", "p"), "fixed": (), "links": (),
     "inputs": (0,), "ray_checks": ((0, 1, 2),), "plan": (2, 4, 1, 1, 4, 2, 2), "budget": 9},
    {"name": "Bolted Compensation", "start": (3, 1, 0, 2), "kinds": ("p", "n", "p", "n"),
     "fixed": (1,), "links": (), "inputs": (0,), "ray_checks": ((0, 1, 2, 3),),
     "plan": (1, 1, 4, 1, 4, 2, 2, 4, 1), "budget": 11},
    {"name": "Mirror Pair", "start": (0, 1, 2, 0), "kinds": ("p", "m", "n", "p"),
     "fixed": (), "links": (), "inputs": (0, 1), "ray_checks": ((0, 1), (2, 3)),
     "plan": (2, 2, 4, 1, 4, 2, 4, 1, 1), "budget": 11},
    {"name": "Countergear", "start": (0, 1, 3, 2, 0), "kinds": ("p", "n", "p", "m", "n"),
     "fixed": (), "links": ((0, 2),), "inputs": (0, 1), "ray_checks": ((0, 2, 4), (1, 3)),
     "plan": (2, 2, 4, 1, 4, 4, 2, 4, 1, 1), "budget": 12},
    {"name": "Spectral Gearbox", "start": (0, 1, 2, 0, 3, 1),
     "kinds": ("p", "m", "n", "p", "n", "m"), "fixed": (), "links": ((0, 4),),
     "inputs": (0, 1), "ray_checks": ((0, 1, 4), (3, 5)),
     "plan": (2, 4, 2, 2, 4, 4, 1, 4, 4, 2), "budget": 12},
    {"name": "Chiral Caustic Forge", "start": (0, 2, 1, 3, 2, 0),
     "kinds": ("m", "n", "p", "m", "n", "p"), "fixed": (),
     "links": ((0, 4), (1, 5)), "inputs": (0, 1, 2), "ray_checks": ((0, 3), (1, 4), (2, 5)),
     "plan": (1, 1, 4, 2, 4, 1, 4, 1, 1), "budget": 11},
]


def start_state(level):
    return tuple(level["start"]), 0, 0


def transition(level, state, action):
    angles, cursor, calibrated = state
    size = len(angles)
    if action == 3:
        return angles, (cursor - 1) % size, calibrated
    if action == 4:
        return angles, (cursor + 1) % size, calibrated
    if action not in (1, 2):
        return state
    if cursor in level.get("fixed", ()):
        return angles, cursor, calibrated | (1 << cursor)
    delta = -1 if action == 1 else 1
    changed = list(angles)
    changed[cursor] = (changed[cursor] + delta) % 4
    for left, right in level.get("links", ()):
        if cursor == left:
            changed[right] = (changed[right] - delta) % 4
        elif cursor == right:
            changed[left] = (changed[left] - delta) % 4
    return tuple(changed), cursor, calibrated


def _surface(direction, angle, kind):
    if kind == "p":
        return (direction + angle) % 4
    if kind == "n":
        return (direction - angle) % 4
    return (-direction + angle) % 4


def ray_trace(level, angles, input_direction):
    result = []
    direction = input_direction
    for angle, kind in zip(angles, level["kinds"]):
        direction = _surface(direction, angle, kind)
        result.append(direction)
    return tuple(result)


_TARGET_CACHE = {}


def target_state(level):
    key = level["name"]
    if key not in _TARGET_CACHE:
        state = start_state(level)
        for action in level["plan"]:
            state = transition(level, state, action)
        _TARGET_CACHE[key] = state
    return _TARGET_CACHE[key]


def signature(level, angles):
    return tuple(ray_trace(level, angles, input_direction)[index]
                 for input_direction, checks in zip(level["inputs"], level["ray_checks"])
                 for index in checks)


def solved(level, state):
    required = sum(1 << index for index in level.get("fixed", ()))
    return (signature(level, state[0]) == signature(level, target_state(level)[0])
            and state[2] & required == required)


class G515A(RenderableUserDisplay):
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
    def _line(frame, a, b, color, dotted=False, width=1):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            for offset in range(-(width // 2), width // 2 + 1):
                if 0 <= x < 64 and 0 <= y + offset < 64:
                    frame[y + offset, x] = color

    def _positions(self):
        size = len(self.game.state[0])
        return tuple(12 + index * 40 // max(1, size - 1) for index in range(size))

    def _background(self, frame):
        frame[:, :] = BLACK
        frame[8:55, 3:61] = CHARCOAL
        for y in range(10, 54, 5):
            frame[y, 5 + (y % 4):60:7] = ASH
        frame[17:49, 5:59:4] = BLACK
        frame[8, 8:56] = GOLD
        frame[54, 8:56] = GOLD

    def _wedge(self, frame, center, angle, kind, selected, fixed, calibrated=False):
        cx, cy = center
        color = SILVER if fixed else AQUA if kind == "p" else MAGENTA if kind == "n" else GOLD
        points = {
            0: ((4, 0), (-3, -4), (-3, 4)),
            1: ((0, -5), (-4, 3), (4, 3)),
            2: ((-4, 0), (3, -4), (3, 4)),
            3: ((0, 5), (-4, -3), (4, -3)),
        }[angle]
        a, b, c = tuple((cx + x, cy + y) for x, y in points)
        self._line(frame, a, b, color)
        self._line(frame, b, c, color)
        self._line(frame, c, a, color)
        self._disc(frame, center, 2, color)
        if kind == "n":
            self._disc(frame, center, 1, BLACK)
        elif kind == "m":
            self._line(frame, (cx - 4, cy + 4), (cx + 4, cy - 4), WHITE, dotted=True)
        else:
            frame[cy, cx] = WHITE
        if fixed:
            for dx, dy in ((-5, -5), (5, -5), (-5, 5), (5, 5)):
                self._disc(frame, (cx + dx, cy + dy), 2 if calibrated else 1,
                           GOLD if calibrated else SILVER)
            if calibrated:
                frame[cy + 6, cx - 5:cx + 6] = GOLD
        if selected:
            frame[cy - 7, cx - 5:cx + 6:2] = CORAL
            frame[cy + 7, cx - 5:cx + 6:2] = CORAL
            frame[cy - 5:cy + 6:2, cx - 7] = CORAL
            frame[cy - 5:cy + 6:2, cx + 7] = CORAL

    @staticmethod
    def _ray_style(index):
        return ((AQUA, False, 1), (MAGENTA, True, 1), (GOLD, False, 2))[index]

    def _aperture(self, frame, center, ray_index, current=False):
        color, _, _ = self._ray_style(ray_index)
        cx, cy = center
        if ray_index == 0:
            self._disc(frame, center, 2 if current else 3, color)
            self._disc(frame, center, 1, BLACK)
        elif ray_index == 1:
            for row, width in ((-3, 1), (-2, 3), (-1, 5), (0, 7), (1, 5), (2, 3), (3, 1)):
                frame[cy + row, cx - width // 2:cx + width // 2 + 1] = color
            self._disc(frame, center, 1, BLACK)
        else:
            frame[cy - 3:cy + 4, cx - 3] = color
            frame[cy - 3:cy + 4, cx + 3] = color
            frame[cy - 3, cx - 3:cx + 4] = color
            frame[cy + 3, cx - 3:cx + 4] = color
            self._disc(frame, center, 1, BLACK)

    def _rays(self, frame, bright=False, stages=None):
        g = self.game
        xs = self._positions()
        target_angles = target_state(g.level)[0]
        for ray_index, input_direction in enumerate(g.level["inputs"]):
            color, dotted, width = self._ray_style(ray_index)
            if not bright:
                color = ASH
                width = 1
            trace = ray_trace(g.level, g.state[0], input_direction)
            target_trace = ray_trace(g.level, target_angles, input_direction)
            previous = (5, LANE_Y[input_direction])
            checks = g.level["ray_checks"][ray_index]
            for index, (x, direction) in enumerate(zip(xs, trace)):
                point = (x, LANE_Y[direction])
                if stages is None or index < stages:
                    self._line(frame, previous, point, color, dotted=dotted, width=width)
                if index in checks:
                    self._aperture(frame, (x + 4, LANE_Y[target_trace[index]]), ray_index)
                previous = point
            if stages is None or len(xs) < stages:
                self._line(frame, previous, (59, previous[1]), color, dotted=dotted, width=width)
                self._aperture(frame, (59, LANE_Y[target_trace[-1]]), ray_index)

    def _gears(self, frame):
        xs = self._positions()
        for left, right in self.game.level.get("links", ()):
            self._line(frame, (xs[left], 13), (xs[right], 13), GOLD, dotted=True)
            for index in (left, right):
                self._disc(frame, (xs[index], 13), 3, GOLD)
                self._disc(frame, (xs[index], 13), 1, BLACK)
                frame[9:18:2, xs[index]] = SILVER

    def _budget(self, frame):
        g = self.game
        for index in range(g.budget_max):
            x = 5 + index * 54 // max(1, g.budget_max - 1)
            if index < g.budget_left:
                self._disc(frame, (x, 59), 1, GOLD)
            else:
                frame[59, x] = ASH

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            frame[9:12, 8:57:3] = AQUA
        if g.terminal_hold == "win":
            frame[10:54, 4:60] = BLACK
            for radius, color in ((18, AQUA), (13, VIOLET), (8, WHITE), (3, GOLD)):
                self._disc(frame, (32, 32), radius, color)
        elif g.terminal_hold == "loss":
            frame[10:54:2, 4:60] = RED
            frame[10:54, 4:60:5] = ASH
        if not g.anim_kind:
            return
        p = g.anim_progress
        xs = self._positions()
        if g.anim_kind == "cursor":
            a, b = xs[g.anim_from], xs[g.anim_to]
            x = a + (b - a) * p // g.anim_total
            frame[47:51, x - 3:x + 4:2] = CORAL
        elif g.anim_kind == "rotate":
            x = xs[g.state[1]]
            radius = 4 + p
            for dx, dy in ((radius, 0), (-radius, 0), (0, radius), (0, -radius)):
                if 0 <= x + dx < 64 and 0 <= 32 + dy < 64:
                    frame[32 + dy, x + dx] = WHITE
            if g.pending_state is not None:
                self._wedge(frame, (x, 32), g.pending_state[0][g.state[1]],
                            g.level["kinds"][g.state[1]], True,
                            g.state[1] in g.level.get("fixed", ()),
                            bool(g.pending_state[2] & (1 << g.state[1])))
                for left, right in g.level.get("links", ()):
                    partner = right if g.state[1] == left else left if g.state[1] == right else None
                    if partner is not None:
                        self._wedge(frame, (xs[partner], 32), g.pending_state[0][partner],
                                    g.level["kinds"][partner], False, False)
        elif g.anim_kind == "calibrate":
            x = xs[g.state[1]]
            radius = min(8, 2 + p)
            for dx, dy in ((radius, radius), (radius, -radius), (-radius, radius), (-radius, -radius)):
                self._disc(frame, (x + dx, 32 + dy), 1, GOLD)
        elif g.anim_kind == "blocked":
            x = xs[g.state[1]]
            frame[24 + p:41 - p:2, x - 7:x + 8] = RED
        elif g.anim_kind in ("fire", "success"):
            self._rays(frame, bright=True, stages=min(len(xs) + 1, p + 1))
            if g.anim_kind == "success" and p >= len(xs) // 2:
                self._disc(frame, (59, 32), min(5, p), GREEN)
        elif g.anim_kind == "miss":
            self._rays(frame, bright=True, stages=min(len(xs) + 1, p + 1))
            if p >= len(xs) // 2:
                frame[18:47:3, 58:62] = RED

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        self._background(frame)
        self._rays(frame)
        self._gears(frame)
        xs = self._positions()
        for index, (x, angle, kind) in enumerate(zip(xs, g.state[0], g.level["kinds"])):
            self._wedge(frame, (x, 32), angle, kind, index == g.state[1],
                        index in g.level.get("fixed", ()), bool(g.state[2] & (1 << index)))
        self._budget(frame)
        self._animation(frame)
        return frame


class G515(ARCBaseGame):
    def __init__(self):
        self.display = G515A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q052", levels, Camera(0, 0, 64, 64, BLACK, BLACK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5])

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

    def _begin(self, kind, frames, *, next_state=None, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = next_state
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        if self.pending_state is not None:
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
            self.complete_action()
            return
        self.intro_mark = False
        if action == 5:
            won = solved(self.level, self.state)
            if not won:
                self.budget_left -= 1
            self._begin("success" if won else "miss", 7,
                        terminal="win" if won else ("loss" if self.budget_left <= 0 else None))
            return
        after = transition(self.level, self.state, action)
        if after == self.state:
            self._begin("blocked", 4)
            return
        self.budget_left -= 1
        self.anim_from, self.anim_to = self.state[1], after[1]
        if action in (1, 2) and self.state[1] in self.level.get("fixed", ()):
            kind = "calibrate"
        else:
            kind = "cursor" if action in (3, 4) else "rotate"
        self._begin(kind, 5, next_state=after,
                    terminal="loss" if self.budget_left <= 0 else None)
