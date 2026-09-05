# ARC-AGI-3 candidate task g529.

from __future__ import annotations

from collections import Counter
from copy import deepcopy
import hashlib

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, CREAM, ASH, GRAPHITE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, PINK, CORAL, SKY, AQUA, SUN = 6, 7, 8, 9, 10, 11
ORANGE, OXBLOOD, LEAF, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
TERMINAL_INDEX = 5
SNAP_RADIUS = 10
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
REVERSE = {1: 2, 2: 1, 3: 4, 4: 3}


def prediction(history):
    counts = Counter(history)
    return max(range(1, 5), key=lambda action: (counts[action], -action))


def _walk(directions, start=(11, 34)):
    points = [start]
    x, y = start
    for index, direction in enumerate(directions):
        dx, dy = DIRS[direction]
        x += dx * 5
        y += dy * 5
        wobble = (-1, 1, 0)[index % 3]
        if dx:
            y += wobble
        else:
            x += wobble
        points.append((x, y))
    assert all(5 <= x <= 58 and 16 <= y <= 53 for x, y in points)
    return tuple(points)


def ribbon(name, directions, history, window, *, budget=None,
           backtracks=True, mouse_steps=(), blocked=(), opening_scare=False):
    directions = tuple(directions)
    nodes = _walk(directions)
    mouse_steps = frozenset(mouse_steps)
    edges = []
    bit_index = 0
    required_mouse = 0
    for index, direction in enumerate(directions):
        mouse_only = index in mouse_steps
        bit = 0
        if mouse_only:
            bit = 1 << bit_index
            bit_index += 1
            required_mouse |= bit
        edges.append((index, index + 1, direction, mouse_only, bit))
        if backtracks and index:
            back = REVERSE[directions[index - 1]]
            if back != direction:
                edges.append((index, index - 1, back, False, 0))
    if backtracks and len(directions) > 1:
        edges.append((len(directions), len(directions) - 1,
                      REVERSE[directions[-1]], False, 0))
    return {
        "name": name,
        "nodes": nodes,
        "edges": tuple(edges),
        "start": 0,
        "goal": len(nodes) - 1,
        "history": tuple(history),
        "window": int(window),
        "budget": len(directions) if budget is None else int(budget),
        "required_mouse": required_mouse,
        "opening_scare": bool(opening_scare),
        "blocked": tuple((int(node), int(direction))
                         for node, direction in blocked),
        "witness": ((5,) if opening_scare else ()) + tuple(
            (6, index + 1) if index in mouse_steps else direction
            for index, direction in enumerate(directions)),
    }


LEVELS = (
    ribbon("First Footfall", (4, 1, 4, 2, 4), (3,), 1,
           opening_scare=True),
    ribbon("Two Prints", (4, 4, 1, 4, 4, 2, 4, 4, 2, 4, 4, 1, 4),
           (3, 3), 2, blocked=((4, 1),)),
    ribbon("Three-Beat Braid",
           (4, 4, 1, 2, 4, 4, 2, 2, 4, 4, 1, 1, 4, 4),
           (3, 3, 3), 3, blocked=((5, 1), (8, 2))),
    ribbon("Forked Hedgerow",
           (1, 4, 2, 2, 4, 4, 1, 1, 4, 4, 2, 3, 4, 4),
           (2, 2, 3), 3, blocked=((3, 3), (7, 1), (10, 2))),
    ribbon("Finger Gate",
           (4, 4, 4, 2, 2, 4, 4, 4, 1, 1, 4, 4, 4),
           (3, 3, 3, 3), 4, mouse_steps=(6,),
           blocked=((4, 1), (9, 2))),
    ribbon("Coral Return",
           (4, 4, 4, 2, 1, 1, 4, 4, 4, 2, 2, 4, 4, 4),
           (3, 3, 3, 3), 4, mouse_steps=(4,),
           blocked=((6, 2), (11, 1))),
    ribbon("Five-Print Chase",
           (4, 4, 4, 1, 2, 2, 4, 4, 4, 2, 1, 1, 4, 4),
           (3, 3, 3, 3, 3), 5, mouse_steps=(3, 10),
           blocked=((5, 3), (9, 1), (12, 2))),
    ribbon("Daylight Ribbon Chase",
           (4, 4, 4, 1, 2, 2, 4, 4, 4, 2, 1, 1, 4, 4, 4),
           (3, 3, 3, 3, 3), 5, mouse_steps=(3, 9, 12),
           blocked=((4, 3), (7, 1), (11, 2), (13, 1))),
)


def start_state(level):
    return (level["start"], level["history"], 0,
            int(level["opening_scare"]), 0, ACTIVE)


def _parse_action(action):
    if isinstance(action, (tuple, list)):
        return int(action[0]), int(action[1]) if len(action) > 1 else None
    return int(action), None


def _outgoing(level, position):
    return tuple(edge for edge in level["edges"] if edge[0] == position)


def _edge_for_action(level, state, action):
    aid, target = _parse_action(action)
    edges = _outgoing(level, state[0])
    if aid in DIRS:
        return next((edge for edge in edges
                     if edge[2] == aid and not edge[3]), None)
    if aid == 6 and target is not None:
        return next((edge for edge in edges if edge[1] == target), None)
    return None


def ready(level, state):
    return (state[0] == level["goal"]
            and state[4] & level["required_mouse"]
            == level["required_mouse"])


def transition(level, state, action):
    if state[TERMINAL_INDEX] != ACTIVE:
        return state
    aid, _target = _parse_action(action)
    position, history, strikes, scare, mouse_mask, _terminal = state
    if aid == 5:
        if scare:
            return (position, history, strikes, 0, mouse_mask, ACTIVE)
        return state
    if scare:
        edge = _edge_for_action(level, state, action)
        direction = aid if aid in DIRS else (edge[2] if edge else None)
        if direction == prediction(history):
            if strikes:
                return (position, history, strikes, 1, mouse_mask, LOSS)
            return (position, history, 1, 1, mouse_mask, ACTIVE)
        return state
    if aid in DIRS and aid == prediction(history):
        if strikes:
            return (position, history, strikes, 1, mouse_mask, LOSS)
        return (position, history, 1, 1, mouse_mask, ACTIVE)
    edge = _edge_for_action(level, state, action)
    if edge is None:
        return state
    direction = edge[2]
    if direction == prediction(history):
        if strikes:
            return (position, history, strikes, 1, mouse_mask, LOSS)
        return (position, history, 1, 1, mouse_mask, ACTIVE)
    next_history = (history + (direction,))[-level["window"]:]
    next_mask = mouse_mask | edge[4]
    after = (edge[1], next_history, strikes, 0, next_mask, ACTIVE)
    if ready(level, after):
        after = after[:TERMINAL_INDEX] + (WIN,)
    return after


def action_cost(state, after):
    if after == state:
        return 0
    if after[TERMINAL_INDEX] == LOSS:
        return 0
    if (after[0] != state[0] or after[1] != state[1]
            or after[4] != state[4]
            or after[TERMINAL_INDEX] == WIN):
        return 1
    return 0


def solved(level, state):
    return state[TERMINAL_INDEX] == WIN and ready(level, state)


def action_tokens(level):
    return (1, 2, 3, 4, 5) + tuple((6, index)
                                    for index in range(len(level["nodes"])))


def encoded_witness(level):
    result = []
    for action in level["witness"]:
        aid, target = _parse_action(action)
        if aid == 6:
            x, y = level["nodes"][target]
            result.append((6, x, y))
        else:
            result.append((aid,))
    return tuple(result)


def encode_action(level, action):
    aid, target = _parse_action(action)
    if aid == 6 and target is not None:
        x, y = level["nodes"][target]
        return (6, x, y)
    return (aid,)


def _bresenham(start, end):
    x0, y0 = start; x1, y1 = end
    dx = abs(x1 - x0); sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0); sy = 1 if y0 < y1 else -1
    error = dx + dy
    while True:
        yield x0, y0
        if x0 == x1 and y0 == y1:
            return
        twice = 2 * error
        if twice >= dy:
            error += dy; x0 += sx
        if twice <= dx:
            error += dx; y0 += sy


class G529A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def pixel(frame, x, y, color):
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color

    @classmethod
    def line(cls, frame, start, end, color, dotted=False, width=1):
        for index, (x, y) in enumerate(_bresenham(start, end)):
            if dotted and index % 4 in (1, 2):
                continue
            for oy in range(-(width // 2), width - width // 2):
                for ox in range(-(width // 2), width - width // 2):
                    cls.pixel(frame, x + ox, y + oy, color)

    @classmethod
    def disc(cls, frame, center, radius, color, hollow=False):
        cx, cy = center; inner = max(0, radius - 1) ** 2
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= inner):
                    cls.pixel(frame, x, y, color)

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            reach = radius - abs(dy)
            if hollow:
                cls.pixel(frame, cx - reach, cy + dy, color)
                cls.pixel(frame, cx + reach, cy + dy, color)
            else:
                for x in range(cx - reach, cx + reach + 1):
                    cls.pixel(frame, x, cy + dy, color)

    @classmethod
    def crescent(cls, frame, center, radius, color, cut=CREAM, flip=False):
        cls.disc(frame, center, radius, color)
        shift = -2 if flip else 2
        cls.disc(frame, (center[0] + shift, center[1] - 1),
                 max(1, radius - 1), cut)

    @classmethod
    def leaf(cls, frame, center, color=LEAF, flip=False):
        x, y = center
        for dy in range(-3, 4):
            reach = 3 - abs(dy)
            start = x - reach if flip else x
            end = x if flip else x + reach
            for px in range(start, end + 1):
                cls.pixel(frame, px, y + dy, color)
        cls.line(frame, (x - 2 if flip else x + 2, y - 3),
                 (x + 2 if flip else x - 2, y + 3), GRAPHITE, dotted=True)

    @classmethod
    def flower(cls, frame, center, color=CORAL, hollow=False):
        x, y = center
        for dx, dy in ((0, -4), (4, 0), (0, 4), (-4, 0)):
            cls.disc(frame, (x + dx, y + dy), 3, color, hollow=hollow)
        cls.disc(frame, center, 2, SUN if not hollow else GRAPHITE,
                 hollow=hollow)

    @classmethod
    def fox(cls, frame, center, color=ORANGE, crouch=0):
        x, y = center
        cls.disc(frame, (x, y + crouch), 4, color)
        cls.diamond(frame, (x - 3, y - 4 + crouch), 3, color)
        cls.diamond(frame, (x + 2, y - 3 + crouch), 2, PINK)
        cls.disc(frame, (x + 2, y + crouch), 2, CREAM)
        cls.pixel(frame, x + 3, y - 1 + crouch, INK)
        cls.line(frame, (x - 3, y + 2 + crouch),
                 (x - 7, y + 4 + crouch), OXBLOOD, width=2)

    @classmethod
    def footprint(cls, frame, center, direction, color=VIOLET,
                  hollow=False):
        x, y = center
        if direction == 1:
            cls.diamond(frame, (x, y - 1), 3, color, hollow)
            cls.line(frame, (x, y + 1), (x, y + 4), color, dotted=True)
        elif direction == 2:
            cls.line(frame, (x - 3, y - 2), (x, y + 3), color)
            cls.line(frame, (x + 3, y - 2), (x, y + 3), color)
            cls.pixel(frame, x - 2, y - 3, color)
            cls.pixel(frame, x + 2, y - 3, color)
        elif direction == 3:
            cls.line(frame, (x + 3, y - 2), (x - 3, y), color)
            cls.line(frame, (x - 3, y), (x + 2, y + 3), color)
            cls.pixel(frame, x, y - 2, color)
        else:
            cls.line(frame, (x - 3, y - 2), (x + 3, y), color)
            cls.line(frame, (x + 3, y), (x - 2, y + 3), color)
            cls.pixel(frame, x, y - 3, color)
            cls.pixel(frame, x - 2, y - 2, color)

    def background(self, frame):
        frame[:, :] = CREAM
        for y in range(0, 64, 4):
            for x in range((y // 4) % 3, 64, 9):
                frame[y, x] = PAPER if (x + y) % 2 else ASH
        self.disc(frame, (57, 18), 12, SUN, hollow=True)
        self.disc(frame, (57, 18), 9, PAPER, hollow=True)
        self.line(frame, (2, 54), (62, 51), AQUA, dotted=True, width=2)
        for x in range(3, 64, 11):
            self.leaf(frame, (x, 55 + (x // 11) % 3),
                      LEAF if x % 2 else SKY, flip=bool(x % 3))

    def curved_ribbon(self, frame, start, end, color, mouse_only=False):
        x0, y0 = start; x1, y1 = end
        mx, my = (x0 + x1) // 2, (y0 + y1) // 2
        bend = 2 if (x0 + y1) % 2 else -2
        if abs(x1 - x0) >= abs(y1 - y0):
            my += bend
        else:
            mx += bend
        self.line(frame, start, (mx, my), color, dotted=not mouse_only,
                  width=2)
        self.line(frame, (mx, my), end, color, dotted=not mouse_only,
                  width=2)
        if mouse_only:
            self.diamond(frame, (mx, my), 2, MAGENTA, hollow=True)
            self.disc(frame, (mx, my), 1, INK)

    def stable_trail(self, frame, state):
        level = self.game.level
        drawn = set()
        for source, target, _direction, mouse_only, _bit in level["edges"]:
            pair = tuple(sorted((source, target)))
            if pair in drawn:
                continue
            drawn.add(pair)
            self.curved_ribbon(frame, level["nodes"][source],
                               level["nodes"][target],
                               MAGENTA if mouse_only else PINK, mouse_only)
        for index, point in enumerate(level["nodes"]):
            if index == level["goal"]:
                self.flower(frame, point, CORAL, hollow=True)
            else:
                self.disc(frame, point, 2, SKY if index % 2 else AQUA,
                          hollow=True)
                self.diamond(frame, point, 1, GRAPHITE,
                             hollow=bool(index % 2))
                self.disc(frame, point, 1, GRAPHITE)
        for edge in _outgoing(level, state[0]):
            target = level["nodes"][edge[1]]
            if edge[3]:
                self.diamond(frame, target, 5, MAGENTA, hollow=True)
                self.disc(frame, target, 2, INK, hollow=True)
            else:
                self.disc(frame, target, 5, SKY, hollow=True)
                self.footprint(frame, target, edge[2], GRAPHITE)
        for index, (node, direction) in enumerate(level["blocked"]):
            x, y = level["nodes"][node]; dx, dy = DIRS[direction]
            point = (x + dx * 6, y + dy * 6)
            if index % 2:
                self.leaf(frame, point, LEAF, flip=bool(direction % 2))
            else:
                self.crescent(frame, point, 3, CORAL, CREAM,
                              flip=bool(direction % 2))

    def forecast(self, frame, state):
        level = self.game.level; direction = prediction(state[1])
        position = level["nodes"][state[0]]
        edge = next((e for e in _outgoing(level, state[0])
                     if e[2] == direction), None)
        dx, dy = DIRS[direction]
        hunter_point = (level["nodes"][edge[1]] if edge else
                        (position[0] + dx * 8, position[1] + dy * 8))
        self.crescent(frame, hunter_point, 5, OXBLOOD, CREAM,
                      flip=direction in (1, 3))
        self.line(frame, (hunter_point[0] - 4, hunter_point[1] - 3),
                  (hunter_point[0] + 2, hunter_point[1] + 3), INK,
                  dotted=True)
        self.footprint(frame, (57, 8), direction, INK)
        self.crescent(frame, (57, 8), 6, OXBLOOD, CREAM,
                      flip=direction in (1, 3))
        self.footprint(frame, (57, 8), direction, PAPER)

    def hud(self, frame, state):
        for index, direction in enumerate(state[1]):
            x = 7 + index * 9
            self.footprint(frame, (x, 7), direction,
                           VIOLET if index == len(state[1]) - 1 else GRAPHITE)
            self.pixel(frame, x, 12, INK if index == len(state[1]) - 1 else ASH)
        for index, x in enumerate((48, 54)):
            live = index >= state[2]
            self.crescent(frame, (x, 14), 3,
                          ORANGE if live else ASH, CREAM, flip=bool(index))
            if not live:
                self.line(frame, (x - 2, 11), (x + 2, 17), INK)
        if state[3]:
            self.diamond(frame, (43, 14), 4, OXBLOOD, hollow=True)
            self.line(frame, (39, 14), (47, 14), INK, dotted=True)
            for index in range(5):
                self.diamond(frame, (39 + index * 2, 20), 1, INK,
                             hollow=bool(index % 2))
        required = self.game.level["required_mouse"]
        for index in range(required.bit_length()):
            used = bool(state[4] & (1 << index))
            self.flower(frame, (39 + index * 7, 59),
                        MAGENTA if used else ASH, hollow=not used)
            if used:
                self.diamond(frame, (39 + index * 7, 59), 2, INK,
                             hollow=True)
        for index in range(self.game.budget_max):
            x = 3 + index * 3 + (index // 5)
            live = index < self.game.budget_left
            self.disc(frame, (x, 61), 1, SUN if live else ASH,
                      hollow=not live)
            if index % 5 == 4:
                self.pixel(frame, x + 2, 61, INK)

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress; span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        old = g.level["nodes"][before[0]]
        new = g.level["nodes"][after[0]]
        if g.anim_kind in ("hop", "mouse", "success"):
            x = old[0] + (new[0] - old[0]) * p // span
            y = old[1] + (new[1] - old[1]) * p // span - wave
            self.fox(frame, (x, y), ORANGE if g.anim_kind != "mouse" else MAGENTA,
                     crouch=1 if p in (0, span) else 0)
            self.line(frame, old, (x, y), OXBLOOD, dotted=True)
            if g.anim_kind == "mouse":
                self.diamond(frame, (x, y), 6 + wave, MAGENTA, hollow=True)
            if g.anim_kind == "success":
                self.flower(frame, new, CORAL if p % 2 else SUN, hollow=True)
        elif g.anim_kind == "scare":
            direction = prediction(before[1]); dx, dy = DIRS[direction]
            hunter = (old[0] + dx * (8 - wave), old[1] + dy * (8 - wave))
            self.crescent(frame, hunter, 5 + wave, OXBLOOD, CREAM,
                          flip=direction in (1, 3))
            self.fox(frame, (old[0] - dx * wave, old[1] - dy * wave),
                     ORANGE, crouch=wave // 2)
        elif g.anim_kind == "feint":
            offset = (-2, 1, 3, 1, 0)[min(p, 4)]
            self.fox(frame, (old[0] + offset, old[1] - abs(offset)), SKY)
            self.crescent(frame, (old[0] - offset, old[1] + 5), 3,
                          OXBLOOD, CREAM, flip=True)
        elif g.anim_kind == "capture":
            inset = 10 * p // span
            self.crescent(frame, (old[0] - 10 + inset, old[1]),
                          6 + wave, OXBLOOD, CREAM)
            self.crescent(frame, (old[0] + 10 - inset, old[1]),
                          6 + wave, OXBLOOD, CREAM, flip=True)
            self.fox(frame, old, ASH, crouch=wave)
        else:
            self.leaf(frame, (old[0] + (-2, 1, 3, 1, 0)[min(p, 4)],
                              old[1] + 6), LEAF, flip=bool(p % 2))

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        self.stable_trail(frame, self.game.state)
        self.forecast(frame, self.game.state)
        self.hud(frame, self.game.state)
        if not self.game.anim_kind or self.game.anim_kind not in (
                "hop", "mouse", "success", "scare", "feint", "capture"):
            self.fox(frame, self.game.level["nodes"][self.game.state[0]])
        if self.game.state[TERMINAL_INDEX] == LOSS:
            point = self.game.level["nodes"][self.game.state[0]]
            self.line(frame, (point[0] - 6, point[1] - 6),
                      (point[0] + 6, point[1] + 6), OXBLOOD, width=2)
            self.line(frame, (point[0] + 6, point[1] - 6),
                      (point[0] - 6, point[1] + 6), OXBLOOD, width=2)
        elif self.game.state[TERMINAL_INDEX] == WIN:
            self.flower(frame,
                        self.game.level["nodes"][self.game.state[0]],
                        SUN, hollow=True)
        self.animation(frame)
        return frame


class G529(ARCBaseGame):
    def __init__(self):
        self.display = G529A(self)
        self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_total = self.anim_left = 0
        self.anim_progress = 0; self.pending_state = self.pending_budget = None
        self.pending_terminal = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level),
                        name=level["name"]) for level in LEVELS]
        super().__init__("q121", levels,
                         Camera(0, 0, 64, 64, CREAM, CREAM, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_total = self.anim_left = 0
        self.anim_progress = 0; self.pending_state = self.pending_budget = None
        self.pending_terminal = None

    def snap_node(self, x, y):
        candidates = []
        for edge in _outgoing(self.level, self.state[0]):
            tx, ty = self.level["nodes"][edge[1]]
            distance = (tx - x) ** 2 + (ty - y) ** 2
            if distance <= SNAP_RADIUS ** 2:
                candidates.append((distance, edge[1]))
        return min(candidates)[1] if candidates else None

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames
        self.anim_progress = 0; self.pending_state = after
        self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.anim_total = self.anim_left = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win":
            self.next_level()
        elif terminal == "loss":
            self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1
            self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0:
                self.finish()
            return
        aid = self.action.id.value
        if aid == 0:
            self.complete_action(); return
        token = aid
        if aid == 6:
            target = self.snap_node(int(self.action.data.get("x", -99)),
                                    int(self.action.data.get("y", -99)))
            token = aid if target is None else (aid, target)
        before = self.state; after = transition(self.level, before, token)
        if after == before:
            self.begin("blocked", 4, before, self.budget_left); return
        cost = action_cost(before, after)
        budget = self.budget_left - cost
        won = after[TERMINAL_INDEX] == WIN
        lost = after[TERMINAL_INDEX] == LOSS or (budget <= 0 and not won)
        if lost and after[TERMINAL_INDEX] != LOSS:
            after = after[:TERMINAL_INDEX] + (LOSS,)
        if won:
            kind, frames, terminal = "success", 5, "win"
        elif lost:
            kind, frames, terminal = "capture", 5, "loss"
        elif after[2] > before[2]:
            kind, frames, terminal = "scare", 5, None
        elif aid == 5:
            kind, frames, terminal = "feint", 5, None
        else:
            edge = _edge_for_action(self.level, before, token)
            kind = "mouse" if aid == 6 and edge and edge[3] else "hop"
            frames, terminal = 5, None
        self.begin(kind, frames, after, budget, terminal)


if __name__ == "__main__":
    for configured in LEVELS:
        state = start_state(configured); budget = configured["budget"]
        for move in configured["witness"]:
            after = transition(configured, state, move)
            budget -= action_cost(state, after); state = after
        assert solved(configured, state) and budget == 0
    print(hashlib.sha256(__file__.encode()).hexdigest()[:12], "q121-v2 ok")
