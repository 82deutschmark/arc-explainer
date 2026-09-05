# ARC-AGI-3 candidate task g510.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


SILVER, ASH, IRON, CHARCOAL, BLACK = 0, 1, 2, 4, 5
ACID, ROSE, RED, BLUE, GLASS, GOLD, COPPER, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 14, 15


def forge(name, n, start, faces, steps, plan, budget, **rules):
    base = {
        "name": name,
        "n": n,
        "start": start,
        "faces": faces,
        "steps": tuple(tuple(row) for row in steps),
        "plan": tuple(plan),
        "budget": budget,
        "clamps": 0,
        "echo_shift": 0,
        "gate_face": -1,
        "gate_bit": -1,
        "gate_phase_only": False,
    }
    base.update(rules)
    return base


LEVELS = [
    forge("First Casting", 4, 0b0000, 1, ((1,),), (5, 4, 5), 4),
    forge("Twin Dies", 5, 0b00001, 2, ((1, 2),),
          (3, 3, 5, 1, 4, 4, 5), 8),
    forge("Clamped Crown", 6, 0b000011, 2, ((1, 2),),
          (1, 3, 3, 3, 5, 3, 3, 3, 5), 10, clamps=1 << 1),
    forge("Ratchet Teeth", 6, 0b001001, 2, ((1, 2), (2, 3)),
          (1, 3, 3, 3, 5, 1, 3, 5, 3, 3, 5), 12),
    forge("Echo Crucible", 7, 0b0000101, 2, ((1, 2), (2, 3)),
          (1, 3, 3, 3, 5, 1, 3, 5, 5, 3, 3, 3, 5, 5, 5), 16,
          echo_shift=3),
    forge("Keyed Link", 6, 0b000000, 2, ((1, 2), (1, 2)),
          (3, 3, 3, 5, 4, 4, 5, 1, 4, 5, 1, 3), 13,
          gate_face=1, gate_bit=0, gate_phase_only=True),
    forge("Crowned Echo", 7, 0b0010101, 2, ((1, 2), (2, 3)),
          (1, 3, 5, 3, 5, 5, 4, 4, 4, 5, 5, 1, 3, 5), 15,
          clamps=1 << 0, echo_shift=3),
    forge("Parity Orrery", 8, 0b00100101, 3, ((1, 2, 3), (2, 3, 1)),
          (2, 3, 3, 5, 5, 5, 1, 4, 4, 5), 11,
          clamps=1 << 0, echo_shift=4, gate_face=2, gate_bit=0),
]


def start_state(level):
    return level["start"], 0, 0, 0, 0, 2, 0


def rotate_mask(mask, amount, n):
    result = 0
    for node in range(n):
        if mask & (1 << node):
            result |= 1 << ((node + amount) % n)
    return result


def strike_mask(level, station, face, phase):
    step = level["steps"][phase % len(level["steps"])][face]
    return (1 << station) | (1 << ((station + step) % level["n"]))


def connector_allowed(level, state, mask):
    bits, _station, face, _phase, _pending = state[:5]
    echo = rotate_mask(mask, level["echo_shift"], level["n"]) if level["echo_shift"] else 0
    if (mask | echo) & level["clamps"]:
        return False
    if face == level["gate_face"] and not (bits & (1 << level["gate_bit"])):
        return False
    return True


def transition(level, state, action):
    bits, station, face, phase, pending, audits, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 1:
        return bits, station, (face + 1) % level["faces"], phase, pending, audits, terminal
    if action == 2:
        return bits, station, (face - 1) % level["faces"], phase, pending, audits, terminal
    if action == 3:
        return bits, (station - 1) % level["n"], face, phase, pending, audits, terminal
    if action == 4:
        return bits, (station + 1) % level["n"], face, phase, pending, audits, terminal
    if action == 6:
        if configuration_solved(level, state):
            return bits, station, face, phase, pending, audits, 2
        audits -= 1
        return bits, station, face, phase, pending, audits, 3 if audits <= 0 else 0
    if pending:
        return bits ^ pending, station, face, phase, 0, audits, terminal
    mask = strike_mask(level, station, face, phase)
    if not connector_allowed(level, state, mask):
        return state
    bits ^= mask
    if level["echo_shift"]:
        pending = rotate_mask(mask, level["echo_shift"], level["n"])
    if level["gate_phase_only"]:
        if face == level["gate_face"]:
            phase = (phase + 1) % len(level["steps"])
    else:
        phase = (phase + 1) % len(level["steps"])
    return bits, station, face, phase, pending, audits, terminal


_TARGETS = {}


def target_core(level):
    key = level["name"]
    if key not in _TARGETS:
        state = start_state(level)
        for action in level["plan"]:
            state = transition(level, state, action)
        if state[4] or state[-1]:
            raise ValueError(f"target plan for {key} did not settle")
        _TARGETS[key] = state[:5]
    return _TARGETS[key]


def configuration_solved(level, state):
    return state[:5] == target_core(level)


def action_cost(state, after):
    if after == state or after[5] < state[5] or after[-1] == 2:
        return 0
    return 1


def solved(_level, state):
    return state[-1] == 2


NODE_LAYOUTS = {
    4: ((32, 12), (52, 32), (32, 52), (12, 32)),
    5: ((32, 10), (52, 25), (44, 49), (20, 49), (12, 25)),
    6: ((32, 9), (50, 19), (50, 43), (32, 53), (14, 43), (14, 19)),
    7: ((32, 8), (49, 16), (55, 33), (44, 50), (20, 50), (9, 33), (15, 16)),
    8: ((32, 8), (48, 14), (56, 30), (49, 47), (32, 55), (15, 47), (8, 30), (16, 14)),
}


class G510A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def diamond(frame, center, radius, color, hollow=False):
        x, y = center
        for dy in range(-radius, radius + 1):
            width = radius - abs(dy)
            yy = y + dy
            if not 0 <= yy < 64:
                continue
            if hollow:
                left, right = x - width, x + width
                if 0 <= left < 64:
                    frame[yy, left] = color
                if 0 <= right < 64:
                    frame[yy, right] = color
            else:
                left, right = max(0, x - width), min(64, x + width + 1)
                if left < right:
                    frame[yy, left:right] = color

    def background(self, frame):
        frame[:, :] = BLACK
        for radius in (13, 21, 28):
            self.disc(frame, (32, 31), radius, CHARCOAL, hollow=True)
        for x, y in ((4, 4), (60, 4), (4, 58), (60, 58), (32, 3), (3, 31), (61, 31)):
            self.disc(frame, (x, y), 1, COPPER)
        for y in range(5, 60, 9):
            frame[y, 5 + y % 7:60:13] = IRON

    def face(self, frame, center, face, color=COPPER, scale=1):
        x, y = center; kind = face % 3; r = 2 + scale
        if kind == 0:
            self.diamond(frame, center, r, color, hollow=True)
            self.line(frame, (x - r, y), (x + r, y), color)
        elif kind == 1:
            self.line(frame, (x, y - r), (x + r, y + r), color)
            self.line(frame, (x + r, y + r), (x - r, y + r), color)
            self.line(frame, (x - r, y + r), (x, y - r), color)
        else:
            self.disc(frame, center, r, color, hollow=True)
            self.line(frame, (x - r, y), (x + r, y), color)
            self.line(frame, (x, y - r), (x, y + r), color)

    def node(self, frame, index, current, target, selected, target_station):
        center = NODE_LAYOUTS[self.game.level["n"]][index]; x, y = center
        if current:
            self.diamond(frame, center, 5, GOLD)
            self.diamond(frame, center, 3, COPPER, hollow=True)
            frame[y, x] = SILVER
        else:
            self.disc(frame, center, 5, IRON, hollow=True)
            self.line(frame, (x - 4, y + 3), (x - 1, y + 5), ASH)
        if target:
            for dx, dy in ((0, -6), (6, 0), (0, 6), (-6, 0)):
                self.diamond(frame, (x + dx, y + dy), 1, ACID)
        else:
            self.disc(frame, center, 7, ASH, hollow=True)
        if target_station:
            inward_x = 0 if x == 32 else (1 if x < 32 else -1)
            inward_y = 0 if y == 31 else (1 if y < 31 else -1)
            anchor = (x + inward_x * 11, y + inward_y * 11)
            tangent = (-inward_y * 2, inward_x * 2)
            self.diamond(frame, (anchor[0] + tangent[0], anchor[1] + tangent[1]),
                         1, ACID, hollow=True)
            self.diamond(frame, (anchor[0] - tangent[0], anchor[1] - tangent[1]),
                         1, ACID, hollow=True)
        if selected:
            self.disc(frame, center, 7, GLASS, hollow=True)
            inward_x = 0 if x == 32 else (1 if x < 32 else -1)
            inward_y = 0 if y == 31 else (1 if y < 31 else -1)
            self.diamond(frame, (x + inward_x * 8, y + inward_y * 8), 1, SILVER)
        if self.game.level["clamps"] & (1 << index):
            self.line(frame, (x - 7, y - 5), (x + 7, y + 5), RED)
            self.line(frame, (x + 7, y - 5), (x - 7, y + 5), RED)
            self.disc(frame, center, 8, RED, hollow=True)

    def connector(self, frame, mask, color, progress=None, total=1, dotted=False):
        nodes = [i for i in range(self.game.level["n"]) if mask & (1 << i)]
        if len(nodes) < 2:
            return
        a = NODE_LAYOUTS[self.game.level["n"]][nodes[0]]
        for node in nodes[1:]:
            b = NODE_LAYOUTS[self.game.level["n"]][node]
            if progress is None:
                self.line(frame, a, b, color, dotted=dotted)
            else:
                p = min(total, progress)
                end = (a[0] + (b[0] - a[0]) * p // total,
                       a[1] + (b[1] - a[1]) * p // total)
                self.line(frame, a, end, color, dotted=dotted)
                self.diamond(frame, end, 1 + p // max(1, total // 2), SILVER)

    def mechanics(self, frame):
        g = self.game; state = g.state
        mask = strike_mask(g.level, state[1], state[2], state[3])
        allowed = connector_allowed(g.level, state, mask)
        self.connector(frame, mask, COPPER if allowed else RED, dotted=not allowed)
        if state[4]:
            self.connector(frame, state[4], VIOLET, dotted=True)
            self.diamond(frame, (32, 31), 4, VIOLET, hollow=True)
        elif g.level["echo_shift"]:
            preview = rotate_mask(mask, g.level["echo_shift"], g.level["n"])
            self.connector(frame, preview, VIOLET if allowed else RED, dotted=True)
        phase_points = ((32, 24), (38, 35), (26, 35))
        for index in range(len(g.level["steps"])):
            self.diamond(frame, phase_points[index], 2, GOLD if index == state[3] else IRON,
                         hollow=index != state[3])
            if index == target_core(g.level)[3]:
                self.disc(frame, phase_points[index], 3, ACID, hollow=True)
        if g.level["gate_face"] >= 0:
            gate_node = NODE_LAYOUTS[g.level["n"]][g.level["gate_bit"]]
            open_gate = bool(state[0] & (1 << g.level["gate_bit"]))
            self.line(frame, (29, 28), gate_node, GREEN if open_gate else RED, dotted=not open_gate)
            self.diamond(frame, (32, 27), 3, GREEN if open_gate else RED, hollow=True)

    def hud(self, frame):
        g = self.game; target = target_core(g.level)
        self.face(frame, (7, 7), g.state[2], COPPER)
        self.face(frame, (15, 7), target[2], ACID, scale=0)
        for index in range(2):
            center = (54 + index * 6, 7)
            self.disc(frame, center, 2, GOLD if index < g.state[5] else ASH,
                      hollow=index >= g.state[5])
            self.line(frame, (center[0] - 2, center[1] + 3),
                      (center[0] + 2, center[1] - 3), COPPER)
        offsets = ((0, -2), (2, 0), (0, 2), (-2, 0))
        for group in range((g.budget_max + 3) // 4):
            center = (7 + group * 8, 60)
            self.disc(frame, center, 1, IRON)
            for tooth, (dx, dy) in enumerate(offsets):
                number = group * 4 + tooth
                if number >= g.budget_max:
                    continue
                if number < g.budget_left:
                    self.diamond(frame, (center[0] + dx, center[1] + dy), 1, ACID)
                else:
                    frame[center[1] + dy, center[0] + dx] = ASH

    def animation(self, frame):
        g = self.game
        if g.intro_mark:
            self.disc(frame, (32, 31), 11, COPPER, hollow=True)
            self.disc(frame, (32, 31), 14, ACID, hollow=True)
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind == "face":
            scale = max(0, 3 - abs(g.anim_total // 2 - p))
            self.face(frame, (32, 31), g.pending_state[2], ACID, scale=scale)
        elif g.anim_kind == "rotate":
            a = NODE_LAYOUTS[g.level["n"]][g.anim_from]
            b = NODE_LAYOUTS[g.level["n"]][g.anim_to]
            x = a[0] + (b[0] - a[0]) * p // g.anim_total
            y = a[1] + (b[1] - a[1]) * p // g.anim_total
            self.disc(frame, (x, y), 7, GLASS, hollow=True)
        elif g.anim_kind in ("strike", "echo"):
            mask = g.state[4] if g.anim_kind == "echo" else strike_mask(
                g.level, g.state[1], g.state[2], g.state[3])
            if p <= 2:
                self.face(frame, (32, 31), g.state[2], GOLD, scale=3 - p)
            self.connector(frame, mask, ACID if g.anim_kind == "strike" else VIOLET,
                           p, g.anim_total)
            for node, center in enumerate(NODE_LAYOUTS[g.level["n"]]):
                if mask & (1 << node):
                    self.disc(frame, center, 5 + min(2, p // 3), SILVER, hollow=True)
        elif g.anim_kind == "blocked":
            mask = strike_mask(g.level, g.state[1], g.state[2], g.state[3])
            self.connector(frame, mask, RED, p, g.anim_total, dotted=True)
            self.diamond(frame, (32, 31), 3 + p, RED, hollow=True)
        elif g.anim_kind == "audit_reject":
            for offset in range(0, 54, 9):
                self.line(frame, (5 + offset, 8 + p), (10 + offset, 3 + p), RED)
        elif g.anim_kind == "success":
            for node, center in enumerate(NODE_LAYOUTS[g.level["n"]]):
                self.diamond(frame, center, 3 + p // 2,
                             GREEN if node % 2 else GOLD, hollow=True)
            self.disc(frame, (32, 31), 5 + p * 2, ACID, hollow=True)
        elif g.anim_kind == "loss":
            self.line(frame, (5 + p * 3, 6), (59 - p * 3, 57), RED)
            self.line(frame, (59 - p * 3, 6), (5 + p * 3, 57), RED)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game; self.background(frame)
        target = target_core(g.level)
        self.mechanics(frame)
        for node in range(g.level["n"]):
            self.node(frame, node, bool(g.state[0] & (1 << node)),
                      bool(target[0] & (1 << node)),
                      node == g.state[1] and g.anim_kind != "rotate",
                      node == target[1])
        self.hud(frame)
        self.animation(frame)
        if g.state[-1] == 3 and not g.anim_kind:
            self.line(frame, (20, 19), (29, 28), RED)
            self.line(frame, (35, 34), (44, 43), RED)
            self.line(frame, (44, 19), (36, 27), RED)
            self.line(frame, (28, 35), (20, 43), RED)
            self.diamond(frame, (32, 31), 8, ASH, hollow=True)
        return frame


class G510(ARCBaseGame):
    def __init__(self):
        self.display = G510A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q032", levels, Camera(0, 0, 64, 64, BLACK, BLACK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames
        self.anim_progress = 0; self.pending_state = after
        self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None
        self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win":
            self.next_level()
        elif terminal == "loss":
            self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0:
                self.finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action(); return
        self.intro_mark = False
        before = self.state; after = transition(self.level, before, action)
        if after == before:
            kind = "face" if action in (1, 2) else "blocked"
            self.begin(kind, 5, before, self.budget_left); return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            exhausted = before[:-1] + (3,)
            self.begin("loss", 7, exhausted, self.budget_left, "loss"); return
        budget = self.budget_left - cost
        won, lost = after[-1] == 2, after[-1] == 3
        self.anim_from, self.anim_to = before[1], after[1]
        if won:
            kind, frames = "success", 7
        elif lost:
            kind, frames = "loss", 7
        elif action == 6:
            kind, frames = "audit_reject", 5
        elif action in (1, 2):
            kind, frames = "face", 5
        elif action in (3, 4):
            kind, frames = "rotate", 5
        elif before[4]:
            kind, frames = "echo", 7
        else:
            kind, frames = "strike", 7
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
