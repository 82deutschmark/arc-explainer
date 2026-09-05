# ARC-AGI-3 candidate task g539.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


IVORY, PEARL, ASH, INK = 0, 1, 2, 5
MAGENTA, ROSE, RED, BLUE, AQUA, SUN, CORAL, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 14, 15


LEVELS = [
    {"name": "First Tide", "start": (0, 4, 0), "plan": (5,), "max_temp": 6,
     "budget": 4},
    {"name": "Warm and Cool", "start": (1, 4, 0, 2),
     "plan": (1, 1, 1, 4, 4, 5, 2, 3), "allow_heat": True, "allow_cool": True,
     "max_temp": 6, "budget": 10},
    {"name": "Ceramic Memory", "start": (0, 5, 1, 0, 3),
     "plan": (1, 1, 4, 4, 2, 3, 5, 5, 1, 5), "allow_heat": True, "allow_cool": True,
     "heavy": (2,), "max_temp": 6, "budget": 12},
    {"name": "Stitched Chambers", "start": (2, 0, 5, 0, 1),
     "plan": (1, 1, 4, 4, 4, 5, 1, 1, 1, 3, 2), "allow_heat": True,
     "allow_cool": True, "barriers": ((1, 2),), "max_temp": 6, "budget": 13},
    {"name": "Directional Wick", "start": (0, 4, 0, 5, 1, 0),
     "plan": (5, 2, 4, 4, 1, 4, 4, 1, 1, 1, 3, 5), "allow_heat": True,
     "allow_cool": True, "heavy": (4,), "wicks": ((2, 1),), "max_temp": 6,
     "budget": 14},
    {"name": "Phase Blossom", "start": (1, 5, 0, 2, 0, 3),
     "plan": (1, 1, 4, 4, 5, 2, 5, 1, 1, 3, 1, 5, 5), "allow_heat": True,
     "allow_cool": True, "heavy": (3,), "phase": ((2, 3),), "max_temp": 6,
     "budget": 15},
    {"name": "Looped Reservoir", "start": (0, 2, 5, 0, 3, 1),
     "plan": (4, 2, 2, 3, 3, 3, 1, 5, 5, 2, 3, 1, 1), "allow_heat": True,
     "allow_cool": True, "heavy": (1,), "barriers": ((2, 3),),
     "wicks": ((4, -1),), "phase": ((3, 3),), "reservoirs": ((0, 0), (5, 5)),
     "wrap": True, "max_temp": 6, "budget": 15},
    {"name": "Thermal Quilt", "start": (1, 5, 0, 3, 0, 4, 2),
     "plan": (3, 1, 1, 3, 1, 5, 1, 1, 5, 1, 5, 1, 3, 1, 3, 3, 2, 4),
     "allow_heat": True, "allow_cool": True, "heavy": (1, 5),
     "barriers": ((2, 3),), "wicks": ((4, 1),), "phase": ((3, 3), (6, 4)),
     "reservoirs": ((0, 1),), "wrap": True, "max_temp": 6, "budget": 20},
]


def _dict_entries(level, key):
    return dict(level.get(key, ()))


def _neighbors(level, values, index):
    size = len(values)
    wrap = level.get("wrap", False)
    left_index = index - 1
    right_index = index + 1
    if left_index < 0:
        left_index = size - 1 if wrap else index
    if right_index >= size:
        right_index = 0 if wrap else index
    barriers = {frozenset(pair) for pair in level.get("barriers", ())}
    left = values[index] if frozenset((index, left_index)) in barriers else values[left_index]
    right = values[index] if frozenset((index, right_index)) in barriers else values[right_index]
    return left, right


def _phase_settle(level, values, locks):
    values = list(values)
    for index, threshold in _dict_entries(level, "phase").items():
        if values[index] >= threshold:
            locks |= 1 << index
            values[index] = threshold
    for index, fixed in _dict_entries(level, "reservoirs").items():
        values[index] = fixed
    return tuple(values), locks


def diffuse(level, values, locks):
    changed = []
    heavy = set(level.get("heavy", ()))
    wicks = _dict_entries(level, "wicks")
    reservoirs = _dict_entries(level, "reservoirs")
    for index, value in enumerate(values):
        if locks & (1 << index) or index in reservoirs:
            changed.append(value)
            continue
        left, right = _neighbors(level, values, index)
        if index in wicks:
            next_value = ((3 * left + value + right) // 5 if wicks[index] < 0
                          else (left + value + 3 * right) // 5)
        elif index in heavy:
            next_value = (left + 4 * value + right) // 6
        else:
            next_value = (left + 2 * value + right) // 4
        changed.append(max(0, min(level["max_temp"], next_value)))
    return _phase_settle(level, tuple(changed), locks)


def start_state(level):
    values, locks = _phase_settle(level, tuple(level["start"]), 0)
    return values, locks, 0, 2, 0


_TARGET_CACHE = {}


def target_state(level):
    key = level["name"]
    if key not in _TARGET_CACHE:
        state = start_state(level)
        for action in level["plan"]:
            state = transition(level, state, action)
        _TARGET_CACHE[key] = state[:3]
    return _TARGET_CACHE[key]


def configuration_solved(level, state):
    return state[:3] == target_state(level)


def solved(level, state):
    return state[4] == 2


def transition(level, state, action):
    values, locks, cursor, audits, terminal = state
    if terminal:
        return state
    size = len(values)
    if action == 3:
        next_cursor = (cursor - 1) % size if level.get("wrap") else max(0, cursor - 1)
        return values, locks, next_cursor, audits, terminal
    if action == 4:
        next_cursor = (cursor + 1) % size if level.get("wrap") else min(size - 1, cursor + 1)
        return values, locks, next_cursor, audits, terminal
    if action in (1, 2):
        if ((action == 1 and not level.get("allow_heat"))
                or (action == 2 and not level.get("allow_cool"))
                or locks & (1 << cursor) or cursor in _dict_entries(level, "reservoirs")):
            return state
        changed = list(values)
        delta = 1 if action == 1 else -1
        changed[cursor] = max(0, min(level["max_temp"], changed[cursor] + delta))
        changed, locks = _phase_settle(level, tuple(changed), locks)
        return changed, locks, cursor, audits, terminal
    if action == 5:
        changed, locks = diffuse(level, values, locks)
        return changed, locks, cursor, audits, terminal
    if action == 6:
        if configuration_solved(level, state):
            return values, locks, cursor, audits, 2
        next_audits = max(0, audits - 1)
        return values, locks, cursor, next_audits, 3 if next_audits == 0 else 0
    return state


def action_cost(level, before, after):
    del level
    if after == before:
        return 0
    return 1 if after[:3] != before[:3] else 0


def _with_terminal(state, terminal):
    return state[:4] + (terminal,)


class G539A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        inner = max(0, radius - 1)
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner ** 2):
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

    @staticmethod
    def _interp(old, new, progress, total):
        delta = new - old
        distance = (abs(delta) * progress + total // 2) // max(1, total)
        return old + (distance if delta >= 0 else -distance)

    def _base_kind(self):
        kind = self.game.anim_kind or ""
        return kind if kind == "audit_loss" else kind.removesuffix("_loss")

    def _positions(self):
        size = len(self.game.state[0])
        return tuple(7 + index * 50 // max(1, size - 1) for index in range(size))

    def _visual_state(self):
        g = self.game
        before = g.state
        after = g.pending_state
        if after is None or not g.anim_kind:
            return before
        p, total = g.anim_progress, max(1, g.anim_total)
        base = self._base_kind()
        if base in ("heat", "cool", "diffuse"):
            values = tuple(self._interp(old, new, p, total)
                           for old, new in zip(before[0], after[0]))
            locks = after[1] if p >= total else before[1]
            audits = after[3] if p >= total else before[3]
            terminal = after[4] if p >= total else before[4]
            return values, locks, before[2], audits, terminal
        return after if p >= total else before

    def _background(self, frame):
        frame[:, :] = IVORY
        for y in range(3, 61, 6):
            frame[y, 1:63:4] = PEARL
        for x in range(2, 63, 7):
            frame[1:63:5, x] = ASH
        frame[13:55, 2:62] = PEARL
        for y in range(14, 54, 5):
            frame[y, 3:61:3] = IVORY

    def _pool(self, frame, index, x, value, target_value, locked, target_locked, selected):
        g = self.game
        center = (x, 34)
        size = len(g.state[0])
        radius = 4 if size >= 7 else 5 if size == 6 else 6
        material = "normal"
        if index in g.level.get("heavy", ()):
            material = "heavy"
        if index in _dict_entries(g.level, "wicks"):
            material = "wick"
        if index in _dict_entries(g.level, "reservoirs"):
            material = "reservoir"
        color = BLUE if value <= 1 else AQUA if value <= 3 else CORAL if value <= 5 else SUN
        self._disc(frame, center, radius + 1, INK)
        self._disc(frame, center, radius, PEARL)
        for band in range(value):
            y = 39 - band * 2
            width = min(radius, 2 + band // 2)
            frame[y:y + 2, x - width:x + width + 1] = color
        for band in range(target_value):
            y = 39 - band * 2
            frame[y, max(0, x - radius - 2):max(0, x - radius)] = MAGENTA
            frame[y, min(64, x + radius + 1):min(64, x + radius + 3)] = MAGENTA
        if material == "heavy":
            frame[29:31, x - radius:x + radius + 1:2] = VIOLET
            frame[38:40, x - radius:x + radius + 1:2] = VIOLET
        elif material == "wick":
            direction = _dict_entries(g.level, "wicks")[index]
            if direction < 0:
                frame[31:38, x - radius:x + 1] = GREEN
                frame[34, max(0, x - radius - 2):x - radius + 1] = GREEN
            else:
                frame[31:38, x:x + radius + 1] = GREEN
                frame[34, x + radius:min(64, x + radius + 3)] = GREEN
        elif material == "reservoir":
            frame[26:31, x - 2:x + 3] = BLUE
            frame[24:27, x - 1:x + 2] = BLUE
        if locked:
            reach = radius + 2
            for dx, dy in ((0, -reach), (reach, -reach + 2), (reach, 0),
                           (reach, reach - 2), (0, reach), (-reach, reach - 2),
                           (-reach, 0), (-reach, -reach + 2)):
                px, py = x + dx, 34 + dy
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = SUN
        if target_locked:
            frame[23, x - 3:x + 4:2] = MAGENTA
        if index in _dict_entries(g.level, "phase") and not locked:
            threshold = _dict_entries(g.level, "phase")[index]
            notch_y = 39 - (threshold - 1) * 2
            frame[notch_y, x - radius:x + radius + 1:2] = SUN
        if selected:
            frame[34 - radius - 3, x - radius:x + radius + 1:2] = INK
            frame[34 + radius + 3, x - radius:x + radius + 1:2] = INK
            frame[33:36, x - radius] = INK
            frame[33:36, x + radius] = INK

    def _seams(self, frame):
        g = self.game
        xs = self._positions()
        for left, right in g.level.get("barriers", ()):
            if abs(left - right) == 1:
                x = (xs[left] + xs[right]) // 2
                frame[25:44:2, x - 1:x + 2] = VIOLET
                frame[27:42:4, x - 3:x + 4] = VIOLET
        if g.level.get("wrap"):
            self._line(frame, (xs[0], 25), (xs[0], 15), AQUA)
            self._line(frame, (xs[0], 15), (xs[-1], 15), AQUA, dotted=True)
            self._line(frame, (xs[-1], 15), (xs[-1], 25), AQUA)

    def _cursor_stone(self, frame, center):
        self._disc(frame, center, 3, INK)
        self._disc(frame, center, 1, SUN)

    def _selected_gauge(self, frame, visual_state, target):
        selected = visual_state[2]
        value = visual_state[0][selected]
        target_value = target[0][selected]
        self._disc(frame, (27, 7), 5, INK, hollow=True)
        self._line(frame, (36, 2), (41, 7), MAGENTA)
        self._line(frame, (41, 7), (36, 12), MAGENTA)
        self._line(frame, (36, 12), (31, 7), MAGENTA)
        self._line(frame, (31, 7), (36, 2), MAGENTA)
        for band in range(value):
            y = 10 - band
            frame[y, 25:30] = AQUA if value <= 3 else CORAL
        for band in range(target_value):
            y = 10 - band
            frame[y, 34:39:2] = MAGENTA
        self._line(frame, (31, 3), (31, 11), ASH, dotted=True)
        if visual_state[1] & (1 << visual_state[2]):
            self._disc(frame, (27, 1), 1, SUN)
        if target[1] & (1 << selected):
            frame[1, 34:39:2] = MAGENTA

    def _audit_knot(self, frame, index, active):
        x, y = ((8, 8), (56, 8))[index]
        if index == 0:
            self._disc(frame, (x, y), 2, GREEN if active else ASH, hollow=not active)
            for dx, dy in ((0, -4), (4, 0), (0, 4), (-4, 0)):
                self._disc(frame, (x + dx, y + dy), 1, AQUA if active else ASH,
                           hollow=not active)
        else:
            color = CORAL if active else ASH
            self._line(frame, (x, y - 4), (x + 4, y), color)
            self._line(frame, (x + 4, y), (x, y + 4), color)
            self._line(frame, (x, y + 4), (x - 4, y), color)
            self._line(frame, (x - 4, y), (x, y - 4), color)
            if active:
                frame[y - 1:y + 2, x - 1:x + 2] = CORAL
            else:
                frame[y, x] = INK

    def _audits(self, frame, audits):
        for index in range(2):
            self._audit_knot(frame, index, index < audits)

    def _energy(self, frame):
        g = self.game
        for group in range((g.budget_max + 3) // 4):
            x, y = 8 + group * 12, 60
            frame[y, x] = INK
            for petal, (dx, dy) in enumerate(((0, -2), (2, 0), (0, 2), (-2, 0))):
                action = group * 4 + petal
                if action >= g.budget_max:
                    continue
                px, py = x + dx, y + dy
                if action < g.budget_left:
                    self._disc(frame, (px, py), 1, AQUA if group % 2 == 0 else CORAL)
                else:
                    frame[py, px] = ASH

    def _edge_weight(self, destination, source):
        g = self.game
        if g.state[1] & (1 << destination) or destination in _dict_entries(g.level, "reservoirs"):
            return 0
        if frozenset((destination, source)) in {frozenset(pair) for pair in g.level.get("barriers", ())}:
            return 0
        wicks = _dict_entries(g.level, "wicks")
        if destination in wicks:
            size = len(g.state[0])
            favored = ((destination - 1) % size if wicks[destination] < 0
                       else (destination + 1) % size)
            return 3 if source == favored else 1
        return 1

    def _phase_bloom(self, frame, progress):
        g = self.game
        if g.pending_state is None:
            return
        new_locks = g.pending_state[1] & ~g.state[1]
        xs = self._positions()
        size = len(g.state[0])
        reach = (4 if size >= 7 else 5 if size == 6 else 6) + 2
        petals = ((0, -reach), (reach, -reach + 2), (reach, 0),
                  (reach, reach - 2), (0, reach), (-reach, reach - 2),
                  (-reach, 0), (-reach, -reach + 2))
        for index, x in enumerate(xs):
            if not new_locks & (1 << index):
                continue
            for dx, dy in petals[:min(len(petals), progress + 1)]:
                px, py = x + dx, 34 + dy
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = SUN

    def _loss_hold(self, frame):
        frame[18:50:2, 4:60] = RED
        frame[18:50, 4:60:4] = VIOLET

    def _win_hold(self, frame):
        for radius, color in ((17, AQUA), (12, GREEN), (7, SUN)):
            self._disc(frame, (32, 34), radius, color)
        self._disc(frame, (32, 34), 3, IVORY)

    def _event_animation(self, frame, base, progress, total):
        g = self.game
        xs = self._positions()
        if progress >= total:
            return
        if base == "move":
            a, b = xs[g.anim_from], xs[g.anim_to]
            x = a + (b - a) * progress // max(1, total)
            lift = progress * (total - progress) // max(1, total * 2)
            self._cursor_stone(frame, (x, 49 - lift))
        elif base in ("heat", "cool"):
            x = xs[g.state[2]]
            radius = 2 + progress * 2
            for dx in range(-radius, radius + 1):
                y = 34 + abs(dx) // 3
                if 0 <= x + dx < 64 and 0 <= y < 64:
                    frame[y, x + dx] = CORAL if base == "heat" else BLUE
        elif base == "diffuse":
            for index, (left, right) in enumerate(zip(xs, xs[1:])):
                distance = right - left
                span = max(1, distance * progress // max(1, total))
                rightward = self._edge_weight(index + 1, index)
                leftward = self._edge_weight(index, index + 1)
                if rightward:
                    lane = 31 if rightward == 1 else 30
                    frame[lane:lane + (2 if rightward == 3 else 1),
                          left:min(right, left + span)] = CORAL
                if leftward:
                    lane = 37 if leftward == 1 else 38
                    frame[lane - (1 if leftward == 3 else 0):lane + 1,
                          max(left, right - span):right] = AQUA
            if g.level.get("wrap"):
                if self._edge_weight(0, len(xs) - 1):
                    frame[15 - min(4, progress):16, xs[0]:xs[-1]:2] = CORAL
                if self._edge_weight(len(xs) - 1, 0):
                    frame[16:17 + min(3, progress), xs[0]:xs[-1]:2] = AQUA
        if base in ("heat", "cool", "diffuse"):
            self._phase_bloom(frame, progress)

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            self._line(frame, (1, 18), (1, 50), AQUA, dotted=True)
            self._line(frame, (62, 18), (62, 50), CORAL, dotted=True)
        if g.terminal_hold == "win":
            self._win_hold(frame)
        elif g.terminal_hold == "loss":
            self._loss_hold(frame)
        if not g.anim_kind:
            return
        p, total = g.anim_progress, max(1, g.anim_total)
        base = self._base_kind()
        if base in ("move", "heat", "cool", "diffuse"):
            if base == "move" and p >= total:
                xs = self._positions()
                self._cursor_stone(frame, (xs[g.anim_to], 49))
            else:
                self._event_animation(frame, base, p, total)
        elif base == "blocked" and p < total:
            x = self._positions()[g.state[2]]
            frame[25 + p:44 - p, x - 7:x + 8:2] = RED
        elif base in ("audit_reject", "audit_loss") and p < total:
            spent = max(0, g.state[3] - 1)
            x, y = ((8, 8), (56, 8))[spent]
            end_x = x + (32 - x) * p // total
            end_y = y + (17 - y) * p // total
            self._line(frame, (x, y), (end_x, end_y), RED)
        elif base == "success":
            for radius, color in ((2 + p * 2, GREEN), (1 + p, AQUA)):
                self._disc(frame, (32, 34), radius, color, hollow=True)
            self._line(frame, (4, 54 - p * 5), (60, 54 - p * 5), SUN, dotted=True)
        if g.anim_kind.endswith("_loss") or base == "audit_loss":
            lead = max(0, p - (total - 3))
            if p >= total:
                self._loss_hold(frame)
            elif lead:
                frame[18 + lead:50 - lead:2, 4 + lead:60 - lead] = RED

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        visual = self._visual_state()
        target = target_state(g.level)
        self._background(frame)
        self._seams(frame)
        xs = self._positions()
        moving = self._base_kind() == "move" and g.anim_kind is not None
        for index, (x, value, target_value) in enumerate(zip(xs, visual[0], target[0])):
            self._pool(frame, index, x, value, target_value,
                       bool(visual[1] & (1 << index)), bool(target[1] & (1 << index)),
                       index == visual[2] and not moving)
        if not moving:
            self._cursor_stone(frame, (xs[visual[2]], 49))
        dock_x = xs[target[2]]
        frame[52:55, dock_x - 4:dock_x + 5:2] = MAGENTA
        frame[53, dock_x - 1:dock_x + 2] = IVORY
        self._selected_gauge(frame, visual, target)
        self._audits(frame, visual[3])
        self._energy(frame)
        self._animation(frame)
        return frame


class G539(ARCBaseGame):
    def __init__(self):
        self.display = G539A(self)
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
        super().__init__("g539", levels, Camera(0, 0, 64, 64, IVORY, IVORY, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

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
        before = self.state
        after = transition(self.level, before, action)
        if after == before:
            self._begin("blocked", 3, next_state=before)
            return
        if action == 6:
            if after[4] == 2:
                self._begin("success", 6, next_state=after, terminal="win")
            elif after[4] == 3:
                self._begin("audit_loss", 7, next_state=after, terminal="loss")
            else:
                self._begin("audit_reject", 5, next_state=after)
            return
        self.budget_left -= action_cost(self.level, before, after)
        self.anim_from, self.anim_to = before[2], after[2]
        base = ("move" if action in (3, 4) else "heat" if action == 1
                else "cool" if action == 2 else "diffuse")
        exhausted = self.budget_left <= 0 and not configuration_solved(self.level, after)
        if exhausted:
            after = _with_terminal(after, 3)
            self._begin(base + "_loss", 8, next_state=after, terminal="loss")
        else:
            self._begin(base, 7 if base == "diffuse" else 4, next_state=after)
