# ARC-AGI-3 candidate task g531.

from __future__ import annotations

from copy import deepcopy
from math import cos, pi, sin

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


LEVELS = [
    {"name": "Amber Tooth", "mods": (4, 1), "rate_b": (0, 0), "target": (2, 0, 0, 0),
     "path": 1, "delayed": False, "tracks": 1, "budget": 4},
    {"name": "Skewed Twin", "mods": (7, 8), "rate_b": (1, 3), "target": (3, 0, 0, 0),
     "path": 1, "delayed": False, "tracks": 1, "coupled": True, "budget": 13},
    {"name": "Relay Orbit", "mods": (7, 8), "rate_b": (1, 3), "target": (3, 0, 0, 0),
     "path": 3, "delayed": True, "tracks": 1, "coupled": True, "budget": 13},
    {"name": "Prism Gate", "mods": (8, 9), "rate_b": (1, 3), "target": (2, 7, 2, 0),
     "path": 4, "delayed": True, "tracks": 1, "gate": 2, "gate_delta": ((1, 2),),
     "coupled": True, "budget": 13},
    {"name": "Holding Moon", "mods": (9, 10), "rate_b": (1, 3), "target": (7, 5, 1, 0),
     "path": 4, "delayed": True, "tracks": 1, "gate": 2, "gate_delta": ((1, 2),),
     "coupled": True,
     "buffer": True, "budget": 12},
    {"name": "Forked Escapement", "mods": (9, 11), "rate_b": (1, 2), "target": (8, 0, 1, 1),
     "path": 4, "delayed": True, "tracks": 2, "gate": 2,
     "gate_delta": ((1, 2), (2, 1)), "buffer": True, "coupled": True, "budget": 13},
    {"name": "Forked Ephemeris", "mods": (10, 11), "rate_b": (1, 3), "target": (0, 8, 1, 1),
     "path": 5, "delayed": True, "tracks": 2, "gate": 3,
     "gate_delta": ((1, 2), (2, 1)), "buffer": True, "coupled": True, "budget": 15},
    {"name": "Midnight Chronograph", "mods": (11, 13), "rate_b": (1, 2), "target": (0, 9, 2, 1),
     "path": 6, "delayed": True, "tracks": 2, "gate": 3,
     "gate_delta": ((1, 0), (0, 2)), "buffer": True, "coupled": True, "budget": 16},
]


def start_state(level):
    return 0, 0, 0, 0, -1, 0, -1, 0, 2, level["budget"], 0


def _ready(level, state):
    phase_a, phase_b, _route, _mode, packet, kind, track, queued, audits, _budget, terminal = state
    target_a, target_b, target_kind, target_track = level["target"]
    return (terminal == 0 and audits > 0 and queued == 0 and packet == level["path"]
            and kind == target_kind and track == target_track
            and phase_a == target_a and phase_b == target_b)


def solved(level, state):
    return _ready(level, state)


def action_cost(before, after):
    return max(0, before[9] - after[9])


def _gate_kind(level, track, mode, kind):
    deltas = level.get("gate_delta")
    if not deltas:
        return kind
    return (kind + deltas[track][mode]) % 3


def _consume(level, values):
    values[9] -= 1
    if values[9] < 0:
        values[9] = 0
        values[10] = 2
    else:
        candidate = tuple(values)
        if values[9] == 0 and not _ready(level, candidate):
            values[10] = 2
    return tuple(values)


def transition(level, state, action):
    if state[10] or action not in (1, 2, 3, 4, 5, 6):
        return state
    values = list(state)
    phase_a, phase_b, route, mode, packet, kind, track, queued, audits, budget, _terminal = state

    if action == 6:
        if _ready(level, state):
            values[10] = 1
            return tuple(values)
        if budget <= 0:
            values[10] = 2
            return tuple(values)
        values[8] = audits - 1
        values[9] = budget - 1
        if values[8] <= 0 or (values[9] == 0 and not _ready(level, tuple(values))):
            values[10] = 2
        return tuple(values)

    if budget <= 0:
        return state

    if action == 1:
        values[0] = (phase_a + 1) % level["mods"][0]
        values[1] = (phase_b + level["rate_b"][mode]) % level["mods"][1]
        if 0 <= packet < level["path"]:
            new_packet = packet + 1
            values[4] = new_packet
            if new_packet == level.get("gate"):
                values[5] = _gate_kind(level, track, mode, kind)
        return _consume(level, values)

    if action == 2 and level["tracks"] > 1 and packet == -1 and not queued:
        values[2] = 1 - route
        return _consume(level, values)

    if action == 3 and level.get("coupled") and packet < level.get("gate", level["path"] + 1):
        values[3] = 1 - mode
        return _consume(level, values)

    if action == 4 and level.get("buffer") and queued and packet == -1:
        values[7] = 0
        values[4] = 0
        values[6] = route
        return _consume(level, values)

    if action == 5 and packet == -1 and not queued:
        if level.get("buffer"):
            values[7] = 1
        else:
            values[6] = route
            if level.get("delayed"):
                values[4] = 0
            else:
                values[4] = level["path"]
                if level.get("gate") is not None:
                    values[5] = _gate_kind(level, route, mode, kind)
        return _consume(level, values)

    return state


class G531A(RenderableUserDisplay):
    CLOCK_A = (18, 17)
    CLOCK_B = (46, 17)
    SOURCE = (5, 39)
    RECEIVER = (58, 39)
    BUFFER = (6, 49)

    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            x = round(x0 + (x1 - x0) * index / steps)
            y = round(y0 + (y1 - y0) * index / steps)
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    def diamond(self, frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                distance = abs(x - cx) + abs(y - cy)
                if (not hollow and distance <= radius) or (hollow and distance == radius):
                    if 0 <= x < 64 and 0 <= y < 64:
                        frame[y, x] = color

    def polygon(self, frame, points, color):
        for start, end in zip(points, points[1:] + points[:1]):
            self.line(frame, start, end, color)

    @staticmethod
    def _point(center, radius, phase, modulus):
        angle = -pi / 2 + 2 * pi * phase / max(1, modulus)
        return round(center[0] + radius * cos(angle)), round(center[1] + radius * sin(angle))

    def packet(self, frame, center, kind, color=AQUA, small=False):
        radius = 2 if small else 3
        x, y = center
        if kind == 0:
            self.diamond(frame, center, radius, color, hollow=True)
            if 0 <= x < 64 and 0 <= y < 64: frame[y, x] = color
        elif kind == 1:
            points = [(x, y - radius), (x - radius, y + radius), (x + radius, y + radius)]
            self.polygon(frame, points, color)
            if 0 <= y + 1 < 64 and 0 <= x < 64: frame[y + 1, x] = color
        else:
            self.line(frame, (x - radius, y), (x + radius, y), color)
            self.line(frame, (x, y - radius), (x, y + radius), color)
            self.line(frame, (x - radius + 1, y - radius + 1), (x + radius - 1, y + radius - 1), color)
            self.line(frame, (x + radius - 1, y - radius + 1), (x - radius + 1, y + radius - 1), color)

    @staticmethod
    def route_points(level, track):
        length = level["path"]
        bend = (-8 if level["tracks"] > 1 and track == 0 else
                9 if level["tracks"] > 1 else -5)
        points = []
        for index in range(length + 1):
            t = index / length
            x = round(11 + 47 * t)
            y = round(39 + bend * 4 * t * (1 - t))
            points.append((x, y))
        return points

    @staticmethod
    def interpolate(a, b, amount):
        return round(a[0] + (b[0] - a[0]) * amount), round(a[1] + (b[1] - a[1]) * amount)

    def background(self, frame):
        frame[:, :] = INK
        frame[1:54, 2:62] = CHARCOAL
        frame[2:53, 3:61] = INK
        for x, y in ((6, 5), (12, 28), (25, 25), (38, 27), (53, 5), (58, 28), (31, 51)):
            frame[y, x] = SLATE
        self.line(frame, (3, 29), (60, 29), SLATE, dotted=True)

    def target_packet(self, frame, level):
        target_a, target_b, target_kind, _track = level["target"]
        self.line(frame, (25, 3), (43, 3), GOLD)
        self.packet(frame, (27, 3), target_kind, GOLD, small=True)
        self.disc(frame, (34, 3), 2, GOLD, hollow=True)
        self.diamond(frame, (41, 3), 2, GOLD, hollow=True)
        frame[3, 34] = AQUA if target_a == 0 else GOLD
        frame[3, 41] = AQUA if target_b == 0 else GOLD

    def clock(self, frame, center, modulus, phase, target, style, mode=0):
        if modulus <= 1:
            return
        cx, cy = center
        if style == 0:
            self.disc(frame, center, 9, SLATE, hollow=False)
            self.disc(frame, center, 8, INK, hollow=False)
            for tooth in range(modulus):
                inner = self._point(center, 9, tooth, modulus)
                outer = self._point(center, 11 if tooth % 2 == 0 else 10, tooth, modulus)
                self.line(frame, inner, outer, ASH)
        else:
            self.polygon(frame, [(cx, cy - 10), (cx + 10, cy), (cx, cy + 10), (cx - 10, cy)], SLATE)
            self.polygon(frame, [(cx, cy - 8), (cx + 8, cy), (cx, cy + 8), (cx - 8, cy)], ASH)
            for tooth in range(modulus):
                inner = self._point(center, 9, tooth, modulus)
                outer = self._point(center, 11, tooth, modulus)
                self.line(frame, inner, outer, SLATE)
        target_point = self._point(center, 11, target, modulus)
        self.diamond(frame, target_point, 1, GOLD)
        hand = self._point(center, 7, phase, modulus)
        self.line(frame, center, hand, AQUA)
        if style == 0:
            self.disc(frame, center, 2, PEARL, hollow=True)
        else:
            self.diamond(frame, center, 2, PEARL, hollow=True)
            if self.game.level.get("coupled"):
                if mode == 0: self.line(frame, (cx, cy - 3), (cx, cy + 3), GOLD)
                else: self.line(frame, (cx - 3, cy), (cx + 3, cy), GOLD)

    def clocks(self, frame, state, phase_override=None):
        phase_a, phase_b = state[:2] if phase_override is None else phase_override
        self.clock(frame, self.CLOCK_A, self.game.level["mods"][0], phase_a,
                   self.game.level["target"][0], 0, state[3])
        self.clock(frame, self.CLOCK_B, self.game.level["mods"][1], phase_b,
                   self.game.level["target"][1], 1, state[3])

    def routes(self, frame, state, draw_marker=True):
        level = self.game.level
        active = state[6] if state[6] >= 0 else state[2]
        for track in range(level["tracks"]):
            points = self.route_points(level, track)
            color = ASH if track == active else SLATE
            for start, end in zip(points, points[1:]):
                self.line(frame, start, end, color, dotted=track != active)
            for point in points[1:-1]:
                self.diamond(frame, point, 1, color, hollow=True)
        self.disc(frame, self.SOURCE, 4, SLATE, hollow=True)
        self.diamond(frame, self.RECEIVER, 4, ASH, hollow=True)
        if level["tracks"] > 1:
            target_track = level["target"][3]
            target_point = self.route_points(level, target_track)[-2]
            self.diamond(frame, target_point, 3, GOLD, hollow=True)
        if draw_marker and level["tracks"] > 1:
            y = 34 if state[2] == 0 else 45
            self.line(frame, (8, 39), (10, y), GOLD)
            self.diamond(frame, (10, y), 1, GOLD)

    def gate(self, frame, state, amount=None):
        level = self.game.level
        if level.get("gate") is None:
            return
        track = state[6] if state[6] >= 0 else state[2]
        point = self.route_points(level, track)[level["gate"]]
        x, y = point
        mode = state[3]
        if amount is None:
            if mode == 0:
                self.polygon(frame, [(x, y - 4), (x - 3, y), (x, y + 4)], GOLD)
            else:
                self.polygon(frame, [(x - 4, y - 2), (x + 4, y - 2), (x + 4, y + 2), (x - 4, y + 2)], GOLD)
        else:
            reach = round(2 + 2 * amount)
            self.line(frame, (x - reach, y - (3 - reach // 2)), (x + reach, y + (3 - reach // 2)), GOLD)
            self.line(frame, (x + reach, y - (3 - reach // 2)), (x - reach, y + (3 - reach // 2)), GOLD)
        self.packet(frame, (x, y), self.game.level["target"][2], SLATE, small=True)

    def buffer(self, frame, state, draw_packet=True):
        if not self.game.level.get("buffer"):
            return
        x, y = self.BUFFER
        self.polygon(frame, [(x - 4, y - 3), (x + 3, y - 3), (x + 4, y + 3), (x - 3, y + 3)], ASH)
        self.line(frame, (x - 2, y - 4), (x + 2, y - 4), GOLD)
        if state[7] and draw_packet:
            self.packet(frame, self.BUFFER, state[5], AQUA, small=True)

    def packet_position(self, state):
        if state[7]:
            return self.BUFFER
        if state[4] == -1:
            return self.SOURCE
        track = max(0, state[6])
        return self.route_points(self.game.level, track)[state[4]]

    def budget_rivet(self, frame, number, live, radius=1):
        group, within = divmod(number, 4)
        cx = 14 + group * 12; cy = 58
        offsets = ((-3, -2), (3, -2), (-3, 2), (3, 2))
        x, y = cx + offsets[within][0], cy + offsets[within][1]
        if live:
            self.diamond(frame, (x, y), radius, AQUA)
        elif 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = SLATE

    def hud(self, frame, state, budget_override=None, audits_override=None):
        budget = state[9] if budget_override is None else budget_override
        audits = state[8] if audits_override is None else audits_override
        for group in range(4):
            cx = 14 + group * 12
            self.disc(frame, (cx, 58), 5, SLATE, hollow=True)
        for number in range(self.game.level["budget"]):
            self.budget_rivet(frame, number, number < budget)
        if audits >= 1:
            self.disc(frame, (5, 58), 3, PEARL, hollow=True)
        else:
            self.line(frame, (3, 56), (7, 60), RED); self.line(frame, (7, 56), (3, 60), RED)
        if audits >= 2:
            self.diamond(frame, (59, 58), 3, PEARL, hollow=True)
        else:
            self.line(frame, (57, 56), (61, 60), RED); self.line(frame, (61, 56), (57, 60), RED)

    def shutter(self, frame, amount, color):
        cx, cy = self.RECEIVER
        reach = round(5 * amount)
        self.line(frame, (cx + 5, cy - 6), (cx + 5 - reach, cy - 1), color)
        self.line(frame, (cx + 5, cy + 6), (cx + 5 - reach, cy + 1), color)
        self.line(frame, (cx - 5, cy - 6), (cx - 5 + reach, cy - 1), color)
        self.line(frame, (cx - 5, cy + 6), (cx - 5 + reach, cy + 1), color)

    def terminal(self, frame, state):
        if state[10] == 1:
            for radius in (1, 3, 5):
                self.diamond(frame, self.RECEIVER, radius, GOLD, hollow=True)
            self.shutter(frame, 1.0, GOLD)
            self.line(frame, (43, 3), self.RECEIVER, GOLD, dotted=True)
        elif state[10] == 2:
            self.shutter(frame, 1.0, RED)
            self.line(frame, (48, 31), (63, 47), RED)
            self.line(frame, (63, 31), (48, 47), ASH)
            for center in (self.CLOCK_A, self.CLOCK_B):
                self.line(frame, (center[0] - 3, center[1] - 3), (center[0] + 3, center[1] + 3), RED)

    def scene(self, frame, state, *, draw_packet=True, draw_clocks=True,
              draw_marker=True, draw_gate=True, draw_hud=True,
              draw_buffer_packet=True):
        self.background(frame); self.target_packet(frame, self.game.level)
        if draw_clocks: self.clocks(frame, state)
        self.routes(frame, state, draw_marker=draw_marker)
        if draw_gate: self.gate(frame, state)
        self.buffer(frame, state, draw_packet=draw_buffer_packet)
        if draw_packet and state[10] == 0:
            self.packet(frame, self.packet_position(state), state[5])
        if draw_hud: self.hud(frame, state)
        self.terminal(frame, state)

    def hud_transition(self, frame, before, after, p, span):
        self.hud(frame, after)
        if before[9] > after[9] and p < span:
            spent = after[9]
            if p * 3 < span * 2:
                self.budget_rivet(frame, spent, True, 1 if p * 2 < span else 0)
        if before[8] > after[8] and p < span:
            seal_center = (59, 58) if before[8] == 2 else (5, 58)
            reach = max(1, round(3 * p / span))
            self.line(frame, (seal_center[0] - reach, seal_center[1] - reach),
                      (seal_center[0] + reach, seal_center[1] + reach), RED)

    def animated_packet(self, frame, before, after, p, span):
        start = self.packet_position(before)
        end = self.packet_position(after)
        amount = p / span
        position = self.interpolate(start, end, amount)
        kind = before[5] if p * 2 < span else after[5]
        self.packet(frame, position, kind)
        if 0 < p < span:
            trail = self.interpolate(start, end, max(0.0, amount - 0.18))
            self.diamond(frame, trail, 1, SLATE)

    def animation(self, frame, p, span):
        g = self.game; before, after = g.anim_before, g.pending_state
        kind = g.anim_kind
        if kind == "tick":
            moved = before[4] != after[4]
            self.scene(frame, before, draw_packet=not moved, draw_clocks=False, draw_hud=False)
            rate_b = g.level["rate_b"][before[3]]
            phases = (before[0] + p / span, before[1] + rate_b * p / span)
            self.clocks(frame, before, phase_override=phases)
            if moved: self.animated_packet(frame, before, after, p, span)
            self.hud_transition(frame, before, after, p, span)
        elif kind == "route":
            self.scene(frame, before, draw_marker=False, draw_hud=False)
            start_y = 34 if before[2] == 0 else 45; end_y = 34 if after[2] == 0 else 45
            y = round(start_y + (end_y - start_y) * p / span)
            self.line(frame, (8, 39), (10, y), GOLD); self.diamond(frame, (10, y), 1, GOLD)
            self.hud_transition(frame, before, after, p, span)
        elif kind == "mode":
            self.scene(frame, before, draw_gate=False, draw_hud=False)
            self.gate(frame, before, amount=p / span)
            self.hud_transition(frame, before, after, p, span)
        elif kind in ("load", "release"):
            self.scene(frame, before, draw_packet=False, draw_hud=False,
                       draw_buffer_packet=False)
            self.animated_packet(frame, before, after, p, span)
            self.hud_transition(frame, before, after, p, span)
        elif kind in ("success", "reject", "loss"):
            self.scene(frame, before, draw_packet=kind == "reject", draw_hud=False)
            if kind == "success": amount = p / span; color = GOLD
            elif kind == "loss": amount = p / span; color = RED
            else: amount = 1 - abs(2 * p - span) / span; color = CORAL
            self.shutter(frame, amount, color)
            if kind == "success" and p < span:
                self.packet(frame, self.RECEIVER, before[5], AQUA)
            if kind == "loss":
                reach = round(15 * p / span)
                self.line(frame, (58 - reach, 32), (58 + min(5, reach), 46), RED)
            self.hud_transition(frame, before, after, p, span)
        else:
            self.scene(frame, before)
            reach = round(3 * (1 - abs(2 * p - span) / span))
            self.line(frame, (29 - reach, 51), (35 + reach, 51), CORAL)

        if after[10] == 2 and kind not in ("loss",):
            reach = round(10 * p / span)
            self.line(frame, (58 - reach, 32), (58 + min(5, reach), 46), RED)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        if not g.anim_kind:
            self.scene(frame, g.state)
            if g.intro_mark:
                self.disc(frame, (34, 6), 4, ASH, hollow=True)
                self.diamond(frame, (34, 6), 6, SLATE, hollow=True)
            return frame
        span = max(1, g.anim_total - 1)
        if g.anim_progress >= span:
            self.scene(frame, g.pending_state)
        else:
            self.animation(frame, g.anim_progress, span)
        return frame


class G531(ARCBaseGame):
    def __init__(self):
        self.display = G531A(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q139", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_terminal = None
        self.intro_mark = True

    def begin(self, kind, frames, after, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = after; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.budget_left = self.state[9]; self.anim_kind = None
        self.pending_state = None; self.pending_terminal = None
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
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        if after == self.state:
            self.begin("blocked", 5, after); return
        terminal = "win" if after[10] == 1 else "loss" if after[10] == 2 else None
        if action == 1: kind, frames = "tick", 7
        elif action == 2: kind, frames = "route", 5
        elif action == 3: kind, frames = "mode", 5
        elif action == 4: kind, frames = "release", 7
        elif action == 5: kind, frames = "load", 7
        elif terminal == "win": kind, frames = "success", 7
        elif terminal == "loss": kind, frames = "loss", 7
        else: kind, frames = "reject", 7
        self.begin(kind, frames, after, terminal)
