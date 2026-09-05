# ARC-AGI-3 candidate task g533.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
NONE, SIGIL, ECHO = 0, 1, 2


def observatory(name, n, start, goal, budget, charges, paths0, *, paths1=(),
                mode_rule="none", require_key=False, goal_mode=-1,
                hazard_decoys=False):
    def table(rows):
        return {(a, b): (c, d, bool(e)) for a, b, c, d, e in rows}
    return {
        "name": name,
        "n": n,
        "start": start,
        "goal": goal,
        "budget": budget,
        "charges": charges,
        "paths": (table(paths0), table(paths1) if paths1 else table(paths0)),
        "mode_rule": mode_rule,
        "require_key": require_key,
        "goal_mode": goal_mode,
        "hazard_decoys": hazard_decoys,
    }


LEVELS = [
    observatory("First Glass", 4, 0, 3, 7, 4,
                ((0, 1, 1, NONE, 0), (1, 2, 3, NONE, 0))),
    observatory("Fracture Paths", 5, 0, 4, 9, 5,
                ((0, 2, 2, NONE, 0), (2, 1, 3, NONE, 0),
                 (3, 0, 4, NONE, 0)), hazard_decoys=True),
    observatory("Turning Prism", 5, 0, 4, 11, 5,
                ((0, 0, 1, NONE, 0), (3, 2, 4, NONE, 0)),
                paths1=((1, 1, 3, NONE, 0),), mode_rule="phase", goal_mode=0,
                hazard_decoys=True),
    observatory("Patient Echo", 6, 0, 5, 9, 5,
                ((0, 1, 2, ECHO, 0), (2, 0, 3, NONE, 0),
                 (4, 2, 5, NONE, 0)), hazard_decoys=True),
    observatory("Sealed Meridian", 6, 0, 5, 9, 5,
                ((0, 2, 2, SIGIL, 0), (2, 1, 4, NONE, 0),
                 (4, 0, 5, NONE, 1)), require_key=True, hazard_decoys=True),
    observatory("Two Half Lenses", 5, 0, 4, 12, 6,
                ((0, 1, 2, NONE, 0), (2, 2, 4, NONE, 0)), mode_rule="split",
                hazard_decoys=True),
    observatory("Vesper Engine", 7, 0, 6, 14, 6,
                ((0, 1, 1, SIGIL, 0), (5, 1, 6, NONE, 1)),
                paths1=((1, 2, 3, ECHO, 0), (3, 0, 4, NONE, 0)),
                mode_rule="phase", require_key=True, goal_mode=0, hazard_decoys=True),
    observatory("Veiled Orrery", 7, 0, 6, 22, 10,
                ((0, 2, 2, SIGIL, 0), (2, 1, 3, ECHO, 0),
                 (3, 0, 4, NONE, 0), (5, 2, 6, NONE, 1)),
                mode_rule="split", require_key=True, hazard_decoys=True),
]


def start_state(level):
    return level["start"], 0, 0, 0, 0, 0, 0, level["charges"], 2, 0


def _edge_bit(level, node, mouth, mode):
    if level["mode_rule"] == "phase":
        return 1 << (mode * level["n"] * 3 + node * 3 + mouth)
    return 1 << (node * 3 + mouth)


def _base_outcome(level, node, mouth, mode):
    table = level["paths"][mode if level["mode_rule"] == "phase" else 0]
    if (node, mouth) not in table:
        return node, NONE, False, level["hazard_decoys"]
    destination, effect, needs_key = table[(node, mouth)]
    return destination, effect, needs_key, False


def resolved_outcome(level, state):
    node, mouth, mode, _known_a, _known_b, key, pending, _charges, _wards, _terminal = state
    base, effect, needs_key, authored_hazard = _base_outcome(level, node, mouth, mode)
    destination = (base + pending) % level["n"] if pending else base
    unsafe = authored_hazard or (needs_key and not key)
    return destination, effect, needs_key, unsafe, base


def _observed(level, state):
    node, mouth, mode, known_a, known_b, *_rest = state
    bit = _edge_bit(level, node, mouth, mode)
    if level["mode_rule"] == "split":
        return bool(known_a & bit) and bool(known_b & bit)
    return bool(known_a & bit)


def configuration_solved(level, state):
    node, _mouth, mode, _a, _b, key, pending, _charges, _wards, terminal = state
    correct_mode = level["goal_mode"] < 0 or mode == level["goal_mode"]
    return (not terminal and node == level["goal"] and pending == 0 and correct_mode
            and (not level["require_key"] or key == 1))


def _mistake(state):
    values = list(state)
    if values[8] > 0:
        values[8] -= 1
    else:
        values[9] = 3
    return tuple(values)


def transition(level, state, action):
    node, mouth, mode, known_a, known_b, key, pending, charges, wards, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 1:
        return node, (mouth - 1) % 3, mode, known_a, known_b, key, pending, charges, wards, 0
    if action == 2:
        return node, (mouth + 1) % 3, mode, known_a, known_b, key, pending, charges, wards, 0
    if action == 3:
        if level["mode_rule"] == "none":
            return state
        return node, mouth, 1 - mode, known_a, known_b, key, pending, charges, wards, 0
    if action == 4:
        if charges <= 0:
            return state
        bit = _edge_bit(level, node, mouth, mode)
        if level["mode_rule"] == "split":
            if (known_a if mode == 0 else known_b) & bit:
                return state
            if mode == 0:
                known_a |= bit
            else:
                known_b |= bit
        else:
            if known_a & bit:
                return state
            known_a |= bit
        return node, mouth, mode, known_a, known_b, key, pending, charges - 1, wards, 0
    if action == 5:
        if not _observed(level, state):
            return state
        destination, effect, _needs_key, unsafe, _base = resolved_outcome(level, state)
        if unsafe:
            return _mistake(state)
        had_pending = bool(pending)
        pending = 0
        if effect == SIGIL:
            key = 1
        elif effect == ECHO:
            pending = 1
        if had_pending or effect == ECHO:
            known_a = known_b = 0
        return destination, 0, mode, known_a, known_b, key, pending, charges, wards, 0
    if configuration_solved(level, state):
        return state[:-1] + (2,)
    return _mistake(state)


def action_cost(before, after):
    if after == before or after[8] != before[8] or after[9] in (2, 3):
        return 0
    return 1


def solved(_level, state):
    return state[-1] == 2


class G533A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False, limit=None):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        last = steps if limit is None else min(steps, max(0, limit * steps // 100))
        for step in range(last + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps; y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius * radius and (not hollow or d >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    @staticmethod
    def diamond(frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            y = cy + dy
            if not 0 <= y < 64:
                continue
            width = radius - abs(dy)
            if hollow:
                for x in (cx - width, cx + width):
                    if 0 <= x < 64: frame[y, x] = color
            else:
                frame[y, max(0, cx - width):min(64, cx + width + 1)] = color

    @staticmethod
    def positions(n):
        return tuple((32 + round(18 * math.cos(-math.pi / 2 + 2 * math.pi * i / n)),
                      29 + round(18 * math.sin(-math.pi / 2 + 2 * math.pi * i / n)))
                     for i in range(n))

    def background(self, frame):
        frame[:, :] = INK
        self.disc(frame, (32, 29), 27, CHARCOAL)
        self.disc(frame, (32, 29), 25, INK)
        self.disc(frame, (32, 29), 18, CHARCOAL, hollow=True)
        for radius in (9, 15, 23):
            self.disc(frame, (32, 29), radius, SLATE, hollow=True)
        for i in range(18):
            angle = 2 * math.pi * i / 18
            x = 32 + round(27 * math.cos(angle)); y = 29 + round(25 * math.sin(angle))
            self.diamond(frame, (x, y), 1, ASH if i % 2 else BLUE)
        for y in range(7, 54, 8):
            frame[y, 5 + y % 5:59:11] = SLATE

    def node(self, frame, index, center, selected=False, goal=False):
        x, y = center; kind = index % 4
        if kind == 0:
            self.disc(frame, center, 4, ASH, hollow=True)
            self.disc(frame, center, 1, PEARL)
        elif kind == 1:
            self.diamond(frame, center, 5, ASH, hollow=True)
            self.line(frame, (x, y - 3), (x, y + 3), SLATE)
        elif kind == 2:
            self.line(frame, (x, y - 5), (x - 5, y + 4), ASH)
            self.line(frame, (x - 5, y + 4), (x + 5, y + 4), ASH)
            self.line(frame, (x + 5, y + 4), (x, y - 5), ASH)
        else:
            self.disc(frame, center, 5, ASH, hollow=True)
            frame[y - 5:y + 6, x:x + 5] = INK
            self.line(frame, (x, y - 4), (x, y + 4), PEARL, dotted=True)
        if goal:
            for dx, dy in ((0, -7), (7, 0), (0, 7), (-7, 0)):
                self.diamond(frame, (x + dx, y + dy), 2, AQUA, hollow=True)
        if selected:
            self.disc(frame, center, 7, WHITE, hollow=True)

    def wisp(self, frame, center, key=False):
        x, y = center
        self.diamond(frame, (x, y - 1), 4, PEARL)
        self.line(frame, (x, y + 2), (x - 4, y + 7), ASH)
        self.line(frame, (x, y + 2), (x + 3, y + 6), SLATE)
        frame[y - 1, x] = VIOLET
        if key:
            self.diamond(frame, (x + 5, y - 5), 2, GOLD, hollow=True)
            frame[y - 5, x + 5] = WHITE

    @staticmethod
    def mouth_offset(mouth):
        return ((0, -8), (7, 5), (-7, 5))[mouth]

    def mouth(self, frame, center, mouth, selected=False):
        x, y = center; dx, dy = self.mouth_offset(mouth); p = (x + dx, y + dy)
        if mouth == 0:
            self.disc(frame, p, 2, WHITE if selected else SLATE, hollow=True)
        elif mouth == 1:
            self.line(frame, (p[0], p[1] - 2), (p[0] - 2, p[1] + 2), WHITE if selected else SLATE)
            self.line(frame, (p[0] - 2, p[1] + 2), (p[0] + 2, p[1] + 2), WHITE if selected else SLATE)
            self.line(frame, (p[0] + 2, p[1] + 2), (p[0], p[1] - 2), WHITE if selected else SLATE)
        else:
            self.line(frame, (p[0] - 2, p[1] - 2), (p[0] - 2, p[1] + 2), WHITE if selected else SLATE)
            self.line(frame, (p[0] + 2, p[1] - 2), (p[0] + 2, p[1] + 2), WHITE if selected else SLATE)
            self.line(frame, (p[0] - 2, p[1]), (p[0] + 2, p[1]), WHITE if selected else SLATE)
        if selected:
            self.line(frame, (p[0] - 4, p[1] - 3), (p[0] - 4, p[1] + 3), WHITE)
            self.line(frame, (p[0] + 4, p[1] - 3), (p[0] + 4, p[1] + 3), WHITE)

    def observed_path(self, frame, state, mouth, mode):
        g = self.game; node = state[0]; positions = self.positions(g.level["n"])
        synthetic = list(state); synthetic[1] = mouth; synthetic[2] = mode; synthetic = tuple(synthetic)
        destination, effect, needs_key, unsafe, base = resolved_outcome(g.level, synthetic)
        source, target, base_target = positions[node], positions[destination], positions[base]
        bit = _edge_bit(g.level, node, mouth, mode)
        if g.level["mode_rule"] == "split":
            first = bool(state[3] & bit); second = bool(state[4] & bit)
            if first:
                midpoint = ((source[0] + target[0]) // 2, (source[1] + target[1]) // 2)
                self.line(frame, source, midpoint, AQUA, dotted=True)
            if second:
                midpoint = ((source[0] + target[0]) // 2, (source[1] + target[1]) // 2)
                self.line(frame, midpoint, target, VIOLET, dotted=True)
            if not (first and second):
                return
        else:
            if not state[3] & bit:
                return
            self.line(frame, source, target, AQUA if not unsafe else ROSE, dotted=True)
        if state[6] and base != destination:
            self.line(frame, source, base_target, ASH, dotted=True)
            self.line(frame, base_target, target, VIOLET)
        if unsafe:
            self.line(frame, (target[0] - 3, target[1] - 3), (target[0] + 3, target[1] + 3), RED)
            self.line(frame, (target[0] + 3, target[1] - 3), (target[0] - 3, target[1] + 3), RED)
        elif effect == SIGIL:
            self.diamond(frame, ((source[0] + target[0]) // 2,
                                 (source[1] + target[1]) // 2), 3, GOLD, hollow=True)
        elif effect == ECHO:
            mid = ((source[0] + target[0]) // 2, (source[1] + target[1]) // 2)
            self.disc(frame, mid, 3, VIOLET, hollow=True)
            self.line(frame, mid, (mid[0] + 5, mid[1] - 4), PEARL, dotted=True)
        if needs_key:
            self.line(frame, (target[0] - 4, target[1]), (target[0] + 4, target[1]), GOLD)
            self.diamond(frame, target, 2, WHITE, hollow=True)

    def apparatus(self, frame):
        g = self.game; state = g.state; positions = self.positions(g.level["n"])
        for index, center in enumerate(positions):
            self.node(frame, index, center, goal=index == g.level["goal"])
        for mouth in range(3):
            suppress_selector = (g.anim_kind == "select"
                                  and g.anim_progress < max(1, g.anim_total - 1))
            self.mouth(frame, positions[state[0]], mouth,
                       selected=mouth == state[1] and not suppress_selector)
            modes = (state[2],) if g.level["mode_rule"] == "phase" else (0,)
            for mode in modes:
                self.observed_path(frame, state, mouth, mode)
        moving = g.anim_kind in ("commit", "hazard", "blocked")
        if not moving:
            self.wisp(frame, positions[state[0]], bool(state[5]))
        if g.level["mode_rule"] == "phase":
            self.diamond(frame, (32, 29), 6, BLUE if state[2] == 0 else VIOLET, hollow=True)
            dx = -4 if state[2] == 0 else 4
            self.line(frame, (32, 23), (32 + dx, 29), WHITE)
            self.line(frame, (32 + dx, 29), (32, 35), WHITE)
        elif g.level["mode_rule"] == "split":
            self.disc(frame, (32, 29), 7, ASH, hollow=True)
            if state[2] == 0:
                frame[24:35, 27:32] = BLUE
                frame[25:34, 28:32] = INK
            else:
                frame[24:35, 33:38] = VIOLET
                frame[25:34, 33:37] = INK
        if state[6]:
            self.disc(frame, (32, 29), 3, VIOLET, hollow=True)
            self.line(frame, (28, 34), (36, 24), PEARL, dotted=True)
        if g.level["require_key"]:
            goal = positions[g.level["goal"]]
            self.diamond(frame, goal, 3, GOLD, hollow=True)
        if g.level["goal_mode"] >= 0:
            goal = positions[g.level["goal"]]; dx = -5 if g.level["goal_mode"] == 0 else 5
            self.line(frame, (goal[0], goal[1] - 6), (goal[0] + dx, goal[1] - 9), WHITE)

    def hud(self, frame):
        g = self.game
        shown_budget = g.budget_left
        if (g.anim_kind and g.pending_budget is not None
                and g.anim_progress >= max(1, g.anim_total - 1)
                and g.anim_kind != "success"):
            shown_budget = g.pending_budget
        for group in range((g.budget_max + 3) // 4):
            cx = 7 + group * 9; cy = 4
            self.diamond(frame, (cx, cy), 1, SLATE)
            for tooth, (dx, dy) in enumerate(((0, -2), (2, 0), (0, 2), (-2, 0))):
                unit = group * 4 + tooth
                if unit < g.budget_max:
                    live = unit < shown_budget
                    ux, uy = cx + dx, cy + dy
                    if live:
                        self.diamond(frame, (ux, uy), 1, AQUA)
                    else:
                        for ox, oy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
                            if 0 <= ux + ox < 64 and 0 <= uy + oy < 64:
                                frame[uy + oy, ux + ox] = SLATE
        for index in range(g.level["charges"]):
            x = 6 + index * 4
            self.diamond(frame, (x, 60), 2, VIOLET if index < g.state[7] else SLATE,
                         hollow=index >= g.state[7])
        for index, x in enumerate((54, 60)):
            active = index < g.state[8]
            self.disc(frame, (x, 60), 3, PEARL if active else SLATE, hollow=True)
            if not active:
                self.line(frame, (x - 2, 58), (x + 2, 62), RED)
                self.line(frame, (x + 2, 58), (x - 2, 62), RED)

    def terminal(self, frame):
        g = self.game
        if g.state[9] == 3 and not g.anim_kind:
            for radius in (7, 13, 19):
                self.disc(frame, (32, 29), radius, RED, hollow=True)
            self.line(frame, (13, 10), (51, 48), ASH)
            self.line(frame, (51, 10), (13, 48), ASH)

    def animation(self, frame):
        g = self.game
        if g.intro_mark:
            for radius in (4, 8, 12):
                self.disc(frame, (32, 29), radius, VIOLET, hollow=True)
        if not g.anim_kind:
            return
        p = g.anim_progress; total = max(1, g.anim_total); span = max(1, total - 1)
        before, after = g.anim_before, g.pending_state
        positions = self.positions(g.level["n"]); source = positions[before[0]]
        if g.anim_kind == "select":
            if p < span:
                a = self.mouth_offset(before[1]); b = self.mouth_offset(after[1])
                center = (source[0] + a[0] + (b[0] - a[0]) * p // span,
                          source[1] + a[1] + (b[1] - a[1]) * p // span)
                self.disc(frame, center, 3, WHITE, hollow=True)
        elif g.anim_kind == "lens":
            if p < span:
                radius = 2 + 4 * p // span
                self.diamond(frame, (32, 29), radius, WHITE, hollow=True)
        elif g.anim_kind == "preview":
            if p < span:
                destination, _effect, _needs, unsafe, _base = resolved_outcome(g.level, before)
                target = positions[destination]
                self.line(frame, source, target, RED if unsafe else AQUA,
                          dotted=True, limit=100 * p // span)
                point = (source[0] + (target[0] - source[0]) * p // span,
                         source[1] + (target[1] - source[1]) * p // span)
                self.disc(frame, point, 2, PEARL, hollow=True)
        elif g.anim_kind == "commit":
            target = positions[after[0]]
            point = (source[0] + (target[0] - source[0]) * p // span,
                     source[1] + (target[1] - source[1]) * p // span)
            self.wisp(frame, point, bool(after[5] if p >= span else before[5]))
            if p < span:
                self.line(frame, source, point, AQUA, dotted=True)
            elif g.level["require_key"]:
                goal = positions[g.level["goal"]]
                self.diamond(frame, goal, 3, GOLD, hollow=True)
        elif g.anim_kind in ("hazard", "blocked"):
            if g.anim_kind == "hazard":
                target = positions[resolved_outcome(g.level, before)[0]]
            else:
                dx, dy = self.mouth_offset(before[1])
                target = (source[0] + dx, source[1] + dy)
            folded = min(p, span - p); denominator = max(1, span // 2)
            fraction = folded * 55 // denominator
            point = (source[0] + (target[0] - source[0]) * fraction // 100,
                     source[1] + (target[1] - source[1]) * fraction // 100)
            self.wisp(frame, point, bool(before[5]))
            if p < span:
                self.line(frame, (point[0] - 4, point[1] - 4),
                          (point[0] + 4, point[1] + 4), RED)
        elif g.anim_kind == "reject":
            if p < span:
                x = (54, 60)[max(0, before[8] - 1)] if before[8] else 60
                radius = 3 * p // span
                self.line(frame, (x - radius, 60 - radius), (x + radius, 60 + radius), RED)
                self.line(frame, (x + radius, 60 - radius), (x - radius, 60 + radius), RED)
        elif g.anim_kind == "success":
            for radius in range(4, min(28, 4 + p * 4), 5):
                self.disc(frame, (32, 29), radius, GREEN, hollow=True)
            for index, center in enumerate(positions):
                if index <= p:
                    self.diamond(frame, center, 3, AQUA, hollow=True)
        elif g.anim_kind == "loss":
            left = 8 + 5 * p // span; right = 56 - 5 * p // span
            top = 5 + 5 * p // span; bottom = 53 - 5 * p // span
            self.line(frame, (left, top), (right, bottom), ASH if p >= span else RED)
            self.line(frame, (right, top), (left, bottom), ASH)
            if p >= span:
                for radius in (7, 13, 19):
                    self.disc(frame, (32, 29), radius, RED, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        preview_settle = (g.anim_kind in (
            "select", "lens", "preview", "commit", "hazard", "blocked", "reject", "loss")
            and g.pending_state is not None
            and g.anim_progress >= max(1, g.anim_total - 1))
        current = g.state
        if preview_settle:
            g.state = g.pending_state
        self.background(frame); self.apparatus(frame); self.hud(frame); self.terminal(frame)
        if preview_settle:
            g.state = current
        self.animation(frame)
        return frame


class G533(ARCBaseGame):
    def __init__(self):
        self.display = G533A(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("g533", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True

    def begin(self, kind, frames, before, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.anim_before = before; self.pending_state = after; self.pending_budget = budget
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.budget_left = self.pending_budget; self.anim_kind = None
        self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win": self.next_level()
        elif terminal == "loss": self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self.finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action(); return
        self.intro_mark = False; before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, before, self.budget_left); return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:-1] + (3,)
            self.begin("loss", 7, before, lost, self.budget_left, "loss"); return
        budget = self.budget_left - cost
        if after[-1] == 2:
            kind, frames, terminal = "success", 7, "win"
        elif after[-1] == 3:
            kind, frames, terminal = "loss", 7, "loss"
        elif action in (1, 2):
            kind, frames, terminal = "select", 4, None
        elif action == 3:
            kind, frames, terminal = "lens", 5, None
        elif action == 4:
            kind, frames, terminal = "preview", 7, None
        elif action == 5:
            kind = "commit" if after[0] != before[0] else "hazard"
            frames, terminal = 7, None
        else:
            kind, frames, terminal = "reject", 5, None
        self.begin(kind, frames, before, after, budget, terminal)
