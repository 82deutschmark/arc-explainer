# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q200-v2 Clock of Clocks -- mesh visible local completions into macro time.

Three tactile dials have visible periods. Wrapping a dial raises a shape-coded latch;
the escapement accepts only the displayed latch recipe and advances the macro ring.
Later levels add ordered recipes, linked gears, a clutch, and period changes. Success
depends only on rendered state, never on a hidden action trace.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


# Restrained mechanical art bible: paper, charcoal, brass, and one vermilion accent.
PAPER, PALE, SILVER, GRAPHITE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
VERMILION, ROSE, BLUE, SKY, BRASS, COPPER, GREEN, PURPLE = 8, 7, 9, 10, 11, 12, 14, 15


LEVELS = [
    {"name": "Single Escapement", "periods": ((2, 0, 0),), "recipe": (1,), "active": 1,
     "budget": 9},
    {"name": "Second Escapement", "periods": ((2, 3, 0),), "recipe": (1, 2, 1), "active": 2,
     "budget": 11},
    {"name": "Conjunction", "periods": ((2, 3, 0),), "recipe": (3, 1, 2), "active": 2,
     "budget": 14},
    {"name": "Phase Gate", "periods": ((2, 3, 0),), "recipe": (1, 2, 1), "active": 2,
     "phase_gate": ((1, 1), (0, 1), (1, 2)), "budget": 13},
    {"name": "Shifting Cadence", "periods": ((2, 3, 4), (3, 2, 4), (3, 4, 2)),
     "recipe": (3, 4, 5), "active": 3, "budget": 18},
    {"name": "Gear Cascade", "periods": ((2, 3, 4),), "recipe": (3, 4), "active": 3,
     "coupling": {0: 1}, "budget": 11},
    {"name": "Clutched Pair", "periods": ((3, 4, 0),), "recipe": (3, 1), "active": 2,
     "clutch_pair": (0, 1), "clutch_required": (1,), "budget": 10},
    {"name": "Clock of Clocks", "periods": ((2, 3, 4), (3, 2, 4), (3, 4, 2)),
     "recipe": (3, 4, 6), "active": 3, "coupling": {0: 1},
     "clutch_pair": (1, 2), "clutch_required": (2,), "budget": 16},
]


def periods_for(level, macro):
    banks = level["periods"]
    return tuple(banks[min(macro, len(banks) - 1)])


def start_state(level):
    return (0, 0, 0), 0, 0, False


def _tick(phases, pending, index, periods):
    if periods[index] <= 0:
        return phases, pending, False
    phases = list(phases)
    phases[index] = (phases[index] + 1) % periods[index]
    wrapped = phases[index] == 0
    if wrapped:
        pending |= 1 << index
    return tuple(phases), pending, wrapped


def transition(level, state, action):
    """Pure visible-state transition; ``None`` is a jammed escapement."""
    phases, pending, macro, clutch = state
    periods = periods_for(level, macro)
    if action == 5:
        if "clutch_pair" not in level:
            return state
        return phases, pending, macro, not clutch
    if action == 4:
        gate = None
        if macro < len(level.get("phase_gate", ())):
            gate = level["phase_gate"][macro]
        gate_open = gate is None or phases[gate[0]] == gate[1]
        if macro >= len(level["recipe"]) or pending != level["recipe"][macro] or not gate_open:
            # A rejected mesh visibly releases the latches instead of killing the run.
            return phases, 0, macro, clutch
        macro += 1
        new_periods = periods_for(level, macro)
        phases = tuple(phase % period if period else 0
                       for phase, period in zip(phases, new_periods))
        return phases, 0, macro, clutch
    if action not in (1, 2, 3):
        return state
    index = action - 1
    if index >= level["active"]:
        return state
    if index in level.get("clutch_required", ()):
        return state
    phases, pending, wrapped = _tick(phases, pending, index, periods)
    if wrapped and index in level.get("coupling", {}):
        phases, pending, _ = _tick(phases, pending, level["coupling"][index], periods)
    if clutch and "clutch_pair" in level and index in level["clutch_pair"]:
        a, b = level["clutch_pair"]
        partner = b if index == a else a
        phases, pending, _ = _tick(phases, pending, partner, periods)
    return phases, pending, macro, clutch


def solved(level, state):
    _phases, pending, macro, _clutch = state
    return macro == len(level["recipe"]) and pending == 0


def _line(frame, a, b, color):
    x0, y0 = a
    x1, y1 = b
    steps = max(abs(x1 - x0), abs(y1 - y0), 1)
    for index in range(steps + 1):
        x = x0 + (x1 - x0) * index // steps
        y = y0 + (y1 - y0) * index // steps
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color


class ClockDisplay(RenderableUserDisplay):
    CLOCKS = ((13, 21), (32, 17), (51, 21))
    NOTCHES = ((0, -7), (5, -5), (7, 0), (5, 5), (0, 7), (-5, 5), (-7, 0), (-5, -5))
    HANDS = ((0, -4), (3, -3), (4, 0), (3, 3), (0, 4), (-3, 3), (-4, 0), (-3, -3))

    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                    frame[y, x] = color

    def _paper(self, frame):
        frame[:, :] = PAPER
        for y in range(3, 62, 6):
            frame[y, 2:62:4] = PALE
        for x in range(5, 60, 10):
            frame[2:61:8, x] = SILVER
        frame[6:57, 4] = GRAPHITE
        frame[6:57, 59] = GRAPHITE

    def _clock(self, frame, index, center, period, phase):
        if index >= self.game.level["active"]:
            return
        cx, cy = center
        # Squared teeth around a circular engraved face.
        for dx, dy in self.NOTCHES:
            frame[max(0, cy + dy - 1):min(64, cy + dy + 2),
                  max(0, cx + dx - 1):min(64, cx + dx + 2)] = GRAPHITE
        self._disc(frame, center, 7, CHARCOAL)
        self._disc(frame, center, 6, PALE)
        self._disc(frame, center, 4, PAPER)
        # Period has explicit unique notches; current phase is a triangular hand.
        for slot in range(period):
            dx, dy = self.NOTCHES[slot * 8 // period]
            frame[cy + dy, cx + dx] = BRASS
        dx, dy = self.HANDS[phase * 8 // max(1, period)]
        _line(frame, center, (cx + dx, cy + dy), INK)
        frame[cy + dy, cx + dx] = VERMILION
        self._disc(frame, center, 1, COPPER)
        # Pending latch: each dial uses a different shape, not color alone.
        if self.game.pending & (1 << index):
            ly = 31
            if index == 0:
                self._disc(frame, (cx, ly), 2, GREEN)
            elif index == 1:
                frame[ly - 2:ly + 3, cx - 2:cx + 3] = BLUE
                frame[ly - 1:ly + 2, cx - 1:cx + 2] = PAPER
            else:
                frame[ly, cx - 3:cx + 4] = PURPLE
                frame[ly - 1:ly + 2, cx] = PURPLE

    @staticmethod
    def _mask_glyph(frame, mask, x, y, active):
        outline = VERMILION if active else GRAPHITE
        frame[y:y + 9, x] = outline
        frame[y:y + 9, x + 10] = outline
        frame[y, x:x + 11] = outline
        frame[y + 8, x:x + 11] = outline
        if active:
            frame[y - 2:y, x + 3:x + 8] = VERMILION
            frame[y - 3, x + 5] = INK
        for bit in range(3):
            gx = x + 2 + bit * 3
            if mask & (1 << bit):
                if bit == 0:
                    frame[y + 3:y + 6, gx:gx + 2] = GREEN
                elif bit == 1:
                    frame[y + 2:y + 7, gx] = BLUE
                else:
                    frame[y + 2:y + 7:2, gx:gx + 2] = PURPLE

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            frame[7:11, 8:56:3] = BRASS
            frame[53:57, 8:56:3] = GRAPHITE
            frame[8:56:3, 7:11] = GRAPHITE
            frame[8:56:3, 53:57] = BRASS
        if g.terminal_hold == "win":
            self._disc(frame, (32, 32), 15, BRASS)
            self._disc(frame, (32, 32), 11, PAPER)
            self._disc(frame, (32, 32), 6, GREEN)
        elif g.terminal_hold == "loss":
            frame[8:56:3, 8:56:3] = VERMILION
            _line(frame, (12, 12), (52, 52), INK)
            _line(frame, (52, 12), (12, 52), INK)
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind == "tick" and g.anim_clock is not None:
            clock_index = g.anim_clock
            local_p = p
            if g.anim_partner is not None and p > g.anim_total // 2:
                clock_index = g.anim_partner
                local_p = p - g.anim_total // 2
            cx, cy = self.CLOCKS[clock_index]
            radius = 8 + local_p
            for dx, dy in self.NOTCHES:
                x = cx + dx * radius // 8
                y = cy + dy * radius // 8
                if 0 <= x < 64 and 0 <= y < 64:
                    frame[y, x] = BRASS
        elif g.anim_kind == "mesh":
            frame[37 + p:39 + p, 12:53:2] = BRASS
        elif g.anim_kind == "clutch":
            y = 35 + p % 2
            _line(frame, (13, y), (51, y), VERMILION)
        elif g.anim_kind == "jam":
            frame[39:42, 9 + p:55 - p] = VERMILION
        elif g.anim_kind == "blocked":
            # Crossed teeth are a nonterminal, non-budget-consuming refusal cue.
            frame[12 + p:14 + p, 27:38] = VERMILION
            _line(frame, (28, 12), (37, 21), INK)
            _line(frame, (37, 12), (28, 21), INK)
        elif g.anim_kind == "success":
            self._disc(frame, (32, 44), 8 + p, BRASS)
            self._disc(frame, (32, 44), 5, PAPER)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        self._paper(frame)
        periods = periods_for(g.level, g.macro)
        # Coupled gears have a permanent toothed shaft and directional stop.
        for source, partner in g.level.get("coupling", {}).items():
            ax, ay = self.CLOCKS[source]
            bx, by = self.CLOCKS[partner]
            _line(frame, (ax + 5, ay + 5), (bx - 5, by + 5), GRAPHITE)
            for x in range(min(ax, bx) + 8, max(ax, bx) - 6, 4):
                frame[min(63, max(0, ay + 7)), x:x + 2] = BRASS
            frame[max(0, by + 4):min(64, by + 8), max(0, bx - 7):min(64, bx - 4)] = INK
        for index, center in enumerate(self.CLOCKS):
            self._clock(frame, index, center, periods[index], g.phases[index])
        if g.macro < len(g.level.get("phase_gate", ())):
            gate = g.level["phase_gate"][g.macro]
            if gate is not None:
                clock_index, required_phase = gate
                cx, cy = self.CLOCKS[clock_index]
                dx, dy = self.NOTCHES[required_phase * 8 // periods[clock_index]]
                gx, gy = cx + dx, cy + dy
                frame[max(0, gy - 2):min(64, gy + 3), max(0, gx - 2):min(64, gx + 3):2] = ROSE
                frame[gy, gx] = INK
        # Engraved escapement and macro ring.
        frame[37:40, 9:55] = CHARCOAL
        frame[38, 12:53:4] = BRASS
        self._disc(frame, (32, 45), 8, CHARCOAL)
        self._disc(frame, (32, 45), 6, PAPER)
        for step in range(len(g.level["recipe"])):
            dx, dy = self.NOTCHES[step * 8 // max(1, len(g.level["recipe"]))]
            frame[45 + dy, 32 + dx] = BRASS if step < g.macro else SILVER
        hand_slot = min(7, g.macro * 8 // max(1, len(g.level["recipe"])))
        dx, dy = self.HANDS[hand_slot]
        _line(frame, (32, 45), (32 + dx, 45 + dy), VERMILION)
        # Visible recipe cards; current card is vermilion outlined.
        width = len(g.level["recipe"]) * 13
        start = max(1, 32 - width // 2)
        for index, mask in enumerate(g.level["recipe"]):
            self._mask_glyph(frame, mask, start + index * 13, 53, index == g.macro)
        # Clutch is a physical bridge with two square jaw ends.
        if "clutch_pair" in g.level:
            a, b = g.level["clutch_pair"]
            ax, _ = self.CLOCKS[a]
            bx, _ = self.CLOCKS[b]
            frame[34:37, ax:bx + 1] = VERMILION if g.clutch else SILVER
            frame[33:38, ax - 1:ax + 2] = CHARCOAL
            frame[33:38, bx - 1:bx + 2] = CHARCOAL
            if g.clutch:
                frame[33:38:2, ax + 3:bx - 2:4] = INK
            else:
                gap = (ax + bx) // 2
                frame[33:38, gap - 1:gap + 2] = PAPER
        # Budget as screw heads rather than a generic bar.
        lit = max(0, min(10, (g.budget_left * 10 + g.budget_max - 1) // max(1, g.budget_max)))
        for index in range(10):
            self._disc(frame, (6 + index * 6, 4), 1, BRASS if index < lit else SILVER)
        self._animation(frame)
        return frame


class Q200(ARCBaseGame):
    def __init__(self):
        self.display = ClockDisplay(self)
        self.level = LEVELS[0]
        self.phases = (0, 0, 0)
        self.pending = self.macro = 0
        self.clutch = False
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_clock = None
        self.anim_partner = None
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q200", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, level):
        self.level = LEVELS[self.level_index]
        self.phases, self.pending, self.macro, self.clutch = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_clock = None
        self.anim_partner = None
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def _begin_animation(self, kind, frames, *, clock=None, partner=None,
                         next_state=None, terminal=None):
        self.anim_kind = kind
        self.anim_total = frames
        self.anim_left = frames
        self.anim_progress = 0
        self.anim_clock = clock
        self.anim_partner = partner
        self.pending_state = next_state
        self.pending_terminal = terminal

    def _finish_animation(self):
        terminal = self.pending_terminal
        next_state = self.pending_state
        if next_state is not None:
            self.phases, self.pending, self.macro, self.clutch = next_state
        self.anim_kind = None
        self.anim_clock = None
        self.anim_partner = None
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
                self._finish_animation()
            return

        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        state = (self.phases, self.pending, self.macro, self.clutch)
        if action == 6:
            won = solved(self.level, state)
            if not won:
                self.budget_left -= 1
            self._begin_animation("success" if won else "jam", 4,
                                  terminal="win" if won else None)
            return

        gate = None
        if self.macro < len(self.level.get("phase_gate", ())):
            gate = self.level["phase_gate"][self.macro]
        wrong_mesh = action == 4 and (
            self.macro >= len(self.level["recipe"])
            or self.pending != self.level["recipe"][self.macro]
            or (gate is not None and self.phases[gate[0]] != gate[1])
        )
        after = transition(self.level, state, action)
        if after == state:
            self._begin_animation("blocked", 3)
            return
        self.budget_left -= 1
        if action in (1, 2, 3):
            partner = next((index for index, (before_phase, after_phase) in
                            enumerate(zip(state[0], after[0]))
                            if index != action - 1 and before_phase != after_phase), None)
            self._begin_animation("tick", 6 if partner is not None else 3,
                                  clock=action - 1, partner=partner, next_state=after)
        elif action == 4:
            self._begin_animation("jam" if wrong_mesh else "mesh", 4, next_state=after)
        else:
            self._begin_animation("clutch", 3, next_state=after)
