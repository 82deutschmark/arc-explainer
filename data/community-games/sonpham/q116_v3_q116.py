# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q116-v3 Counterexample Cabinet -- expose and audit visible policy evidence.

Candidate fingerprints are always visible.  A specimen probe carries the unknown
report through every row and settles contradictions into physical shutters.  Later
cabinets compose probe prices, linked slides, closing irises, inverted reports, and
balanced evidence seals.  Two audit seals are independent of evidence budget.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


BONE, SILVER, ASH, BRASS, BLACK = 0, 1, 2, 11, 5
MAGENTA, ROSE, RED, BLUE, GLASS, COPPER, GREEN, VIOLET = 6, 7, 8, 9, 10, 12, 14, 15


LEVELS = [
    {"name": "Single Contradiction", "rules": (0b0000, 0b1010, 0b0110, 0b1111),
     "target": 2, "examples": 4, "quota": 2, "budget": 7},
    {"name": "Priced Lens", "rules": (0b00000, 0b10110, 0b01101, 0b11011, 0b00111),
     "target": 3, "examples": 5, "costs": (3, 1, 1, 2, 1),
     "min_used": 3, "quota": 3, "budget": 11},
    {"name": "Twin Slide", "rules": (0b00000, 0b10101, 0b01110, 0b11001, 0b00111),
     "target": 4, "examples": 5, "links": ((1, 3),),
     "min_used": 4, "quota": 4, "budget": 10},
    {"name": "Closing Iris", "rules": (0b000000, 0b101011, 0b011101, 0b110110,
                                           0b001111, 0b111000),
     "target": 3, "examples": 6, "closes": ((0, 1), (4, 3)),
     "min_used": 3, "quota": 3, "require_close": True, "budget": 10},
    {"name": "Prism Report", "rules": (0b000000, 0b101101, 0b011011, 0b110010,
                                           0b001111, 0b111100),
     "target": 5, "examples": 6, "invert": (0, 2), "costs": (1, 2, 1, 1, 2, 1),
     "quota": 2, "budget": 10},
    {"name": "Balanced Seal", "rules": (0b000000, 0b101101, 0b011010, 0b110011,
                                            0b001111, 0b111000, 0b100110),
     "target": 6, "examples": 6, "require_both": True, "links": ((0, 5),),
     "quota": 3, "budget": 10},
    {"name": "Crossed Archive", "rules": (0b0000000, 0b1011010, 0b0110101, 0b1100110,
                                              0b0011111, 0b1110001, 0b1001100),
     "target": 4, "examples": 7, "costs": (1, 2, 1, 2, 1, 1, 2),
     "links": ((0, 4),), "invert": (0, 4), "require_both": True, "min_used": 4,
     "quota": 4, "budget": 11},
    {"name": "Counterexample Cabinet", "rules": (0b0000000, 0b1011010, 0b0110101,
                                                     0b1100110, 0b0011111, 0b1110001,
                                                     0b1001100, 0b0101011),
     "target": 7, "examples": 7, "costs": (2, 1, 2, 1, 1, 2, 1),
     "links": ((0, 4),), "closes": ((0, 1), (5, 6)), "invert": (3, 6),
     "require_both": True, "require_close": True, "require_prism": True,
     "min_used": 4, "quota": 4, "budget": 17},
]


def start_state(_level):
    # used, closed, specimen cursor, hypothesis cursor, audit seals, proof latch, terminal
    return 0, 0, 0, 0, 2, 0, 0


def report(level, rule_index, example):
    bit = (level["rules"][rule_index] >> example) & 1
    return bit ^ (1 if example in level.get("invert", ()) else 0)


def linked_examples(level, example):
    revealed = {example}
    for left, right in level.get("links", ()):
        if example == left:
            revealed.add(right)
        elif example == right:
            revealed.add(left)
    return revealed


def active_candidates(level, state):
    used = state[0]
    target = level["target"]
    return tuple(
        rule_index for rule_index in range(len(level["rules"]))
        if all(report(level, rule_index, example) == report(level, target, example)
               for example in range(level["examples"]) if used & (1 << example))
    )


def configuration_solved(level, state):
    used, closed, _example, hyp = state[:4]
    if active_candidates(level, state) != (level["target"],) or hyp != level["target"]:
        return False
    if used.bit_count() != level["quota"]:
        return False
    if level.get("require_close") and not closed:
        return False
    if level.get("require_prism") and not any(
            used & (1 << example) for example in level.get("invert", ())):
        return False
    if level.get("require_both"):
        outcomes = {report(level, level["target"], example)
                    for example in range(level["examples"]) if used & (1 << example)}
        if outcomes != {0, 1}:
            return False
    return True


def transition(level, state, action):
    used, closed, example, hyp, audits, proof, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state

    # While the proof clamp is partly closed, any physical control first acts
    # as a release handle: it opens the jaws, breaks one wax seal, and leaves
    # the evidence itself untouched.  A deliberate player closes all three
    # jaws with action 6; random input cannot wait at zero evidence energy and
    # receive a free terminal success.
    if proof and action != 6:
        audits -= 1
        return used, closed, example, hyp, audits, 0, 3 if audits <= 0 else terminal

    def edited(next_used, next_closed, next_example, next_hyp):
        """Opening a partly closed proof clamp breaks one visible wax seal."""
        next_audits = audits - (1 if proof else 0)
        next_terminal = 3 if next_audits <= 0 else terminal
        return next_used, next_closed, next_example, next_hyp, next_audits, 0, next_terminal

    if action == 1:
        next_example = max(0, example - 1)
        return state if next_example == example else edited(used, closed, next_example, hyp)
    if action == 2:
        next_example = min(level["examples"] - 1, example + 1)
        return state if next_example == example else edited(used, closed, next_example, hyp)
    if action == 3:
        next_hyp = max(0, hyp - 1)
        return state if next_hyp == hyp else edited(used, closed, example, next_hyp)
    if action == 4:
        next_hyp = min(len(level["rules"]) - 1, hyp + 1)
        return state if next_hyp == hyp else edited(used, closed, example, next_hyp)
    if action == 6:
        if configuration_solved(level, state):
            if proof < 2:
                return used, closed, example, hyp, audits, proof + 1, terminal
            return used, closed, example, hyp, audits, proof + 1, 2
        audits -= 1
        return used, closed, example, hyp, audits, 0, 3 if audits <= 0 else 0
    if used & (1 << example) or closed & (1 << example):
        return state
    for revealed in linked_examples(level, example):
        if not closed & (1 << revealed):
            used |= 1 << revealed
    for trigger, shuttered in level.get("closes", ()):
        if example == trigger and not used & (1 << shuttered):
            closed |= 1 << shuttered
    return edited(used, closed, example, hyp)


def action_cost(level, state, after):
    """Evidence energy is independent of the two audit seals."""
    if after == state or after[:4] == state[:4]:
        return 0
    if after[0] != state[0] or after[1] != state[1]:
        return level.get("costs", (1,) * level["examples"])[state[2]]
    return 1


def solved(_level, state):
    return state[-1] == 2


class CabinetDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def _background(self, frame):
        frame[:, :] = BLACK
        # A quiet smoked-glass case: depth comes from three rails, not a noisy grid.
        frame[2:62, 2] = BRASS; frame[2:62, 61] = BRASS
        frame[2, 2:62] = BRASS; frame[61, 2:62] = BRASS
        frame[23:25, 4:60] = ASH
        frame[56:58, 4:60] = ASH
        for x in (8, 32, 56):
            frame[3:59:8, x] = SILVER

    def _outcome(self, frame, outcome, center, color, small=False):
        x, y = center
        if outcome:
            self._disc(frame, center, 1 if small else 2, color, hollow=True)
        else:
            radius = 1 if small else 2
            self._line(frame, (x - radius, y - radius), (x + radius, y + radius), color)
            self._line(frame, (x + radius, y - radius), (x - radius, y + radius), color)

    @staticmethod
    def _shutter(frame, x, progress=1, total=1):
        # Expands from the iris center; progress==total exactly matches settled state.
        width = 4 * progress // max(1, total)
        up = 5 * progress // max(1, total)
        down = 6 * progress // max(1, total)
        top, bottom = 12 - up, 13 + down
        frame[top:bottom:2, x - width:x + width + 1] = RED
        frame[top:bottom, x - width:x + width + 1:2] = RED

    def _specimen(self, frame, index, center):
        x, _ = center
        frame[8:17, x - 3:x + 4] = BLACK
        kind = index % 4
        if kind == 0:
            self._disc(frame, (x, 12), 3, COPPER, hollow=True)
        elif kind == 1:
            for dy in range(4):
                frame[14 - dy, x - dy:x + dy + 1] = COPPER
        elif kind == 2:
            for dy in range(-3, 4):
                half = 3 - abs(dy)
                frame[12 + dy, x - half:x + half + 1] = COPPER
        else:
            frame[9:15, x - 3:x + 4:2] = COPPER
            frame[14:17, x - 3:x + 4] = COPPER

    def _example_bracket(self, frame, x, color=BONE):
        frame[4, x - 5:x + 6] = color
        frame[18:23, x - 5] = color
        frame[18:23, x + 5] = color
        self._disc(frame, (x, 4), 2, color, hollow=True)

    def _hyp_bracket(self, frame, y, color=BONE):
        frame[y - 2:y + 3, 2] = color
        frame[y - 2, 2:11] = color
        frame[y + 2, 2:11] = color
        frame[y, 2:5] = color

    def _header(self, frame):
        g = self.game
        xs = g.example_positions()
        costs = g.level.get("costs", (1,) * g.level["examples"])
        used, closed, example = g.state[:3]
        # The selected column is a broad, notched glass inspection channel.
        selected_x = xs[example]
        frame[24:56:2, selected_x - 3:selected_x + 4:2] = ASH
        for index, x in enumerate(xs):
            self._specimen(frame, index, (x, 12))
            for pip in range(costs[index]):
                frame[18, x - costs[index] + 1 + pip * 2] = BRASS
            if index in g.level.get("invert", ()):
                frame[6, x - 2:x + 3] = VIOLET
                frame[5:8, x] = BONE
            if closed & (1 << index):
                self._shutter(frame, x)
            elif used & (1 << index):
                self._outcome(frame, report(g.level, g.level["target"], index),
                              (x, 21), GREEN)
            if index == example and g.anim_kind != "move_example":
                self._example_bracket(frame, x)
        for left, right in g.level.get("links", ()):
            self._line(frame, (xs[left], 4), (xs[right], 4), GLASS, dotted=True)
            frame[3, (xs[left] + xs[right]) // 2] = BONE
        for trigger, shuttered in g.level.get("closes", ()):
            self._line(frame, (xs[trigger], 24), (xs[shuttered], 24), ROSE, dotted=True)
            frame[22:25, xs[trigger]] = RED
            frame[22:25, xs[shuttered] - 1:xs[shuttered] + 2] = RED

    def _candidate_row(self, frame, rule_index, state):
        g = self.game
        used, _closed, _example, hyp = state[:4]
        active = rule_index in active_candidates(g.level, state)
        xs = g.example_positions()
        y = 26 + rule_index * 4
        if active:
            frame[y - 1:y + 2, 4:60:2] = ASH
        else:
            frame[y - 1:y + 2, 4:60:3] = SILVER
            self._line(frame, (4, y + 1), (59, y - 1), SILVER, dotted=True)
        color = GLASS if active else SILVER
        # Each row begins with a deep asymmetric mask rather than a plain index bar.
        frame[y - 1:y + 2, 5:10] = color
        frame[y - 2:y + 3, 7] = color
        frame[y, 4] = color
        if rule_index == hyp and g.anim_kind != "move_hyp":
            self._hyp_bracket(frame, y)
        for example, x in enumerate(xs):
            prediction = report(g.level, rule_index, example)
            self._outcome(frame, prediction, (x, y), color, small=True)
            if used & (1 << example):
                expected = report(g.level, g.level["target"], example)
                if prediction != expected:
                    self._line(frame, (x - 2, y - 1), (x + 2, y + 1), RED)
                    self._line(frame, (x + 2, y - 1), (x - 2, y + 1), RED)

    def _candidates(self, frame):
        g = self.game
        reached = 0
        if g.anim_kind == "probe" and g.pending_state is not None:
            reached = min(len(g.level["rules"]), g.anim_progress)
        for rule_index in range(len(g.level["rules"])):
            state = g.pending_state if rule_index < reached else g.state
            self._candidate_row(frame, rule_index, state)

    def _lamp(self, frame, center, filled, color):
        if filled:
            self._disc(frame, center, 2, color)
            frame[center[1], center[0]] = BONE
        else:
            self._disc(frame, center, 2, SILVER, hollow=True)

    def _hud(self, frame):
        g = self.game
        # Exact evidence budget: five-pixel rivets collapse to one-pixel sockets.
        for index in range(g.budget_max):
            x = 4 + index * 48 // max(1, g.budget_max - 1)
            if index < g.budget_left:
                self._disc(frame, (x, 62), 1, BRASS)
            else:
                frame[62, x] = SILVER
        # Two large audit lamps are independent of that rail.
        for index in range(2):
            self._lamp(frame, (56 + index * 5, 57), index < g.state[4], COPPER)
        # One mechanical proof clamp has three jaws.  Correct closes converge
        # each jaw; any subsequent evidence/cursor edit visibly springs all
        # settled jaws open.  This is terminal proof, not three arbitrary audits.
        before_proof = g.state[5]
        after_proof = (g.pending_state[5] if g.pending_state is not None else before_proof)
        moving_proof = after_proof != before_proof and g.anim_kind is not None
        p = g.anim_progress; total = max(1, g.anim_total)
        for index in range(3):
            x, y = 41 + index * 5, 58
            if moving_proof and after_proof > before_proof and index == before_proof:
                gap = max(0, 2 - 2 * p // total)
                if gap == 0:
                    frame[y - 2:y + 3, x] = GREEN
                    frame[y, x - 1:x + 2] = GREEN
                else:
                    self._line(frame, (x - 2, y - 2), (x, y - gap), GREEN)
                    self._line(frame, (x + 2, y + 2), (x, y + gap), GREEN)
            elif moving_proof and after_proof < before_proof and index < before_proof:
                gap = min(2, 2 * p // total)
                self._line(frame, (x, y - gap), (x - 2, y - 2), SILVER)
                self._line(frame, (x, y + gap), (x + 2, y + 2), SILVER)
            elif index < before_proof:
                frame[y - 2:y + 3, x] = GREEN
                frame[y, x - 1:x + 2] = GREEN
            else:
                self._line(frame, (x - 2, y - 2), (x, y - 2), SILVER)
                self._line(frame, (x + 2, y + 2), (x, y + 2), SILVER)
        if g.level.get("require_both"):
            outcomes = {report(g.level, g.level["target"], example)
                        for example in range(g.level["examples"])
                        if g.state[0] & (1 << example)}
            self._outcome(frame, 0, (57, 48), GREEN if 0 in outcomes else SILVER)
            self._outcome(frame, 1, (57, 52), GREEN if 1 in outcomes else SILVER)
        for slot in range(g.level["quota"]):
            y = 47 - slot * 3
            if g.state[0].bit_count() > slot:
                frame[y, 58:61] = GREEN
            else:
                frame[y, 59] = SILVER
        if g.state[0].bit_count() > g.level["quota"]:
            self._line(frame, (56, 34), (61, 38), RED)
            self._line(frame, (61, 34), (56, 38), RED)

    def _probe_animation(self, frame):
        g = self.game
        p = g.anim_progress
        before, after = g.state, g.pending_state
        xs = g.example_positions()
        source_x = xs[before[2]]
        # A vertical beam reaches the same rows whose final material has settled.
        self._line(frame, (source_x, 21), (source_x, min(55, 22 + p * 5)), BONE)
        newly_used = after[0] & ~before[0]
        for example in range(g.level["examples"]):
            if not newly_used & (1 << example):
                continue
            target_x = xs[example]
            outcome = report(g.level, g.level["target"], example)
            if example == before[2]:
                self._outcome(frame, outcome, (target_x, 21), GREEN)
            else:
                x = source_x + (target_x - source_x) * p // g.anim_total
                self._outcome(frame, outcome, (x, 4), GREEN)
                if p == g.anim_total:
                    self._outcome(frame, outcome, (target_x, 21), GREEN)
        newly_closed = after[1] & ~before[1]
        for example in range(g.level["examples"]):
            if newly_closed & (1 << example):
                self._shutter(frame, xs[example], p, g.anim_total)

    def _animation(self, frame):
        g = self.game
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind == "move_example":
            xs = g.example_positions()
            x = xs[g.anim_from] + (xs[g.anim_to] - xs[g.anim_from]) * p // g.anim_total
            self._example_bracket(frame, x)
        elif g.anim_kind == "move_hyp":
            y = 26 + g.anim_from * 4 + (g.anim_to - g.anim_from) * 4 * p // g.anim_total
            self._hyp_bracket(frame, y)
        elif g.anim_kind == "probe":
            self._probe_animation(frame)
        elif g.anim_kind == "blocked":
            x = g.example_positions()[g.state[2]]
            self._shutter(frame, x, p, g.anim_total)
        elif g.anim_kind == "audit_reject":
            for index in range(2):
                self._disc(frame, (56 + index * 5, 57), 2 + p, RED, hollow=True)
        elif g.anim_kind == "proof_release":
            self._line(frame, (38 + p, 55), (54 - p, 61), RED)
            self._disc(frame, (56, 57), 2 + p, RED, hollow=True)
        elif g.anim_kind == "success":
            for radius, color in ((3 + p * 2, BRASS), (2 + p, GLASS), (1 + p // 2, GREEN)):
                self._disc(frame, (32, 40), radius, color, hollow=True)
        elif g.anim_kind == "loss":
            frame[25:55, 5 + p:59 - p:3] = RED

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame)
        self._header(frame)
        self._candidates(frame)
        self._hud(frame)
        self._animation(frame)
        return frame


class Q116(ARCBaseGame):
    def __init__(self):
        self.display = CabinetDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q116", levels, Camera(0, 0, 64, 64, BLACK, BLACK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def example_positions(self):
        count = self.level["examples"]
        return tuple(8 + index * 48 // max(1, count - 1) for index in range(count))

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

    def _begin(self, kind, frames, state, budget, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = state
        self.pending_budget = budget
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.budget_left = self.pending_budget
        self.anim_kind = None
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
                self._finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        before = self.state
        after = transition(self.level, before, action)
        if after == before:
            self._begin("blocked", 3, before, self.budget_left)
            return
        cost = action_cost(self.level, before, after)
        if cost > self.budget_left:
            self._begin("blocked", 3, before, self.budget_left)
            return
        budget = self.budget_left - cost
        won = after[-1] == 2
        lost = after[-1] == 3
        if won:
            kind = "success"
        elif lost:
            kind = "loss"
        elif before[5] > 0 and after[5] == 0:
            kind = "proof_release"
        elif action == 6 and after[5] > before[5]:
            kind = "proof_close"
        elif action == 6:
            kind = "audit_reject"
        elif action in (1, 2):
            self.anim_from, self.anim_to = before[2], after[2]
            kind = "move_example"
        elif action in (3, 4):
            self.anim_from, self.anim_to = before[3], after[3]
            kind = "move_hyp"
        else:
            kind = "probe"
        frames = (min(8, len(self.level["rules"]) + 1) if kind == "probe"
                  else 7 if kind in ("success", "loss") else 5 if kind in ("audit_reject", "proof_release") else 4)
        self._begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
