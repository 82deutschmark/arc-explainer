# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q161-v2 Velvet Probability Planetarium.

The player chooses among visibly partitioned comet lenses.  A charged probe
collapses every incompatible constellation on the deterministic side that
contains the concealed answer.  The golden claim aperture opens only when
exactly one hypothesis survives and the spotlight rests on it.  Probing or
claiming past that stopping condition produces one recoverable warning and a
finite second failure.

Pure hashable helpers expose partition choice, large-consequence elimination,
singleton stopping, counterfactual mutations, and recording action encoding.
"""

from __future__ import annotations

from copy import deepcopy
import math
from typing import NamedTuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, MIST, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, PINK, RED, SKY, GLASS, GOLD = 6, 7, 8, 9, 10, 11
AMBER, VELVET, MOSS, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
PROBE_ACTIONS = (5,)


class State(NamedTuple):
    survivors: int
    probe_cursor: int
    hypothesis_cursor: int
    used_probes: int
    charge: int
    evidence_left: int
    strikes: int
    last_eliminated: int
    last_event: int
    terminal: int


TERMINAL_INDEX = 9


def probe(mask, cost=1, *, requires=0, excludes=0):
    return {
        "mask": int(mask),
        "cost": int(cost),
        "requires": int(requires),
        "excludes": int(excludes),
    }


def _navigate(current, target, size, previous_action, next_action):
    backward = (current - target) % size
    forward = (target - current) % size
    if backward <= forward:
        return (previous_action,) * backward
    return (next_action,) * forward


def planetarium(name, n, answer, probes, solution, evidence_budget,
                large_elimination, curriculum, budget_slack=0):
    probes = tuple(dict(item) for item in probes)
    actions = []
    cursor = 0
    for target in solution:
        actions.extend(_navigate(cursor, target, len(probes), 1, 2))
        cursor = target
        actions.extend((5,) * probes[target]["cost"])
    actions.extend(_navigate(0, answer, n, 3, 4))
    actions.append(6)
    return {
        "name": name,
        "n": int(n),
        "answer": int(answer),
        "probes": probes,
        "solution": tuple(solution),
        "evidence_budget": int(evidence_budget),
        "large_elimination": int(large_elimination),
        "budget": len(actions) + int(budget_slack),
        "budget_slack": int(budget_slack),
        "witness": tuple(actions),
        "curriculum": tuple(curriculum),
    }


LEVELS = (
    planetarium(
        "First Aperture", 3, 2,
        (
            probe(0b011, 1),
            probe(0b101, 2),
        ),
        (0,), 1, 2,
        ("one-visible-partition", "one-probe-large-collapse",
         "singleton-claim"),
    ),
    planetarium(
        "Charged Pair", 4, 1,
        (
            probe(0b0011, 2),
            probe(0b0101, 3),
            probe(0b0110, 2),
            probe(0b1001, 3),
        ),
        (0, 2), 4, 2,
        ("chosen-probes", "two-step-comet-charge", "overlapping-partitions",
         "singleton-claim"),
    ),
    planetarium(
        "Overlapping Orbits", 5, 4,
        (
            probe(0b10011, 2),
            probe(0b11111, 3),
            probe(0b11101, 2, requires=1 << 0),
            probe(0b11111, 3),
            probe(0b10110, 2, requires=1 << 2),
        ),
        (0, 2, 4), 6, 2,
        ("three-way-overlap", "probe-order-planning", "charge",
         "large-collapse", "singleton-claim"),
    ),
    planetarium(
        "Nested Lens", 6, 2,
        (
            probe(0b001111, 2),
            probe(0b111111, 2),
            probe(0b110101, 2, requires=1 << 0),
            probe(0b111111, 2),
            probe(0b010110, 2, requires=1 << 2),
            probe(0b111111, 2),
        ),
        (0, 2, 4), 6, 2,
        ("dependency-ring", "nested-partitions", "charge",
         "large-collapse", "singleton-claim"),
    ),
    planetarium(
        "Weighted Comets", 6, 5,
        (
            probe(0b101011, 3),
            probe(0b111111, 3),
            probe(0b110101, 2, requires=1 << 0),
            probe(0b111111, 3),
            probe(0b100110, 1, requires=1 << 2),
            probe(0b111111, 3),
        ),
        (0, 2, 4), 6, 2,
        ("heterogeneous-visible-cost", "evidence-budget-planning",
         "overlap", "large-collapse", "singleton-claim"),
    ),
    planetarium(
        "Forked Ephemeris", 7, 3,
        (
            probe(0b0011011, 2),
            probe(0b1101111, 1, excludes=1 << 4),
            probe(0b0101101, 2, requires=1 << 0),
            probe(0b1111111, 3),
            probe(0b1001110, 2, requires=1 << 2),
            probe(0b1111111, 3),
        ),
        (0, 2, 4), 7, 3,
        ("exclusive-probe-branch", "visible-lockout", "dependency-planning",
         "cost", "large-collapse", "singleton-claim"),
        budget_slack=1,
    ),
    planetarium(
        "Eightfold Transit", 8, 6,
        (
            probe(0b01001011, 2),
            probe(0b11110111, 1, excludes=1 << 4),
            probe(0b01010101, 2, requires=1 << 0),
            probe(0b11111111, 3),
            probe(0b11100110, 2, requires=1 << 2),
            probe(0b11111111, 3),
        ),
        (0, 2, 4), 7, 4,
        ("eight-hypothesis-field", "dependency", "exclusive-branch",
         "charged-cost", "large-collapse", "singleton-claim"),
        budget_slack=1,
    ),
    planetarium(
        "Velvet Probability Planetarium", 8, 3,
        (
            probe(0b00011011, 3),
            probe(0b11101111, 1, excludes=1 << 4),
            probe(0b00101101, 2, requires=1 << 0),
            probe(0b11111111, 3),
            probe(0b11001110, 1, requires=1 << 2),
            probe(0b11111111, 3),
        ),
        (0, 2, 4), 7, 4,
        ("eight-hypothesis-field", "heterogeneous-cost", "dependency",
         "exclusive-branch", "charged-comet", "large-collapse",
         "exact-stopping", "recoverable-warning", "irreversible-aperture"),
        budget_slack=1,
    ),
)


def all_candidates(level):
    return (1 << level["n"]) - 1


def survivor_count(state):
    return state.survivors.bit_count()


def singleton_ready(level, state):
    return (survivor_count(state) == 1
            and bool(state.survivors & (1 << level["answer"])))


def probe_partition(level, probe_index):
    """Return complementary visible partition masks over the level field."""
    side_a = level["probes"][probe_index]["mask"] & all_candidates(level)
    return side_a, all_candidates(level) ^ side_a


def chosen_probe(level, state):
    return level["probes"][state.probe_cursor]


def probe_outcome(level, state, probe_index=None):
    """Return the deterministic surviving side for a selected partition."""
    index = state.probe_cursor if probe_index is None else int(probe_index)
    side_a, side_b = probe_partition(level, index)
    answer_bit = 1 << level["answer"]
    side = side_a if side_a & answer_bit else side_b
    return state.survivors & side


def probe_available(level, state, probe_index=None, *, ignore_dependencies=False):
    index = state.probe_cursor if probe_index is None else int(probe_index)
    item = level["probes"][index]
    bit = 1 << index
    return (not state.used_probes & bit
            and (ignore_dependencies
                 or state.used_probes & item["requires"] == item["requires"])
            and item["cost"] <= state.evidence_left
            and probe_outcome(level, state, index) != state.survivors)


def start_state(level):
    return State(
        all_candidates(level), 0, 0, 0, 0,
        level["evidence_budget"], 0, 0, 0, ACTIVE,
    )


def action_tokens(_level):
    return (1, 2, 3, 4, 5, 6)


def encode_action(_level, action):
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    return (aid,)


def solved(_level, state):
    # Normal transition is solely responsible for enforcing singleton entry.
    # Keeping solved terminal-only lets the explicit no-gate mutation be caught.
    return state.terminal == WIN


def _strike(state, event):
    strikes = state.strikes + 1
    return state._replace(
        strikes=strikes,
        last_eliminated=0,
        last_event=event,
        terminal=LOSS if strikes >= 2 else ACTIVE,
    )


def _transition(level, state, action, mode="normal"):
    if state.terminal != ACTIVE:
        return state
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    if aid not in action_tokens(level):
        return state

    if aid in (1, 2):
        size = len(level["probes"])
        delta = -1 if aid == 1 else 1
        cursor = (state.probe_cursor + delta) % size
        return state._replace(
            probe_cursor=cursor,
            charge=0,
            last_eliminated=0,
            last_event=aid,
        )

    if aid in (3, 4):
        delta = -1 if aid == 3 else 1
        cursor = (state.hypothesis_cursor + delta) % level["n"]
        return state._replace(
            hypothesis_cursor=cursor,
            last_eliminated=0,
            last_event=aid,
        )

    if aid == 5:
        if singleton_ready(level, state):
            return _strike(state, 5)
        if not probe_available(
                level, state, ignore_dependencies=mode == "without_dependencies"):
            return state
        item = chosen_probe(level, state)
        if state.charge + 1 < item["cost"]:
            return state._replace(
                charge=state.charge + 1,
                last_eliminated=0,
                last_event=5,
            )

        bit = 1 << state.probe_cursor
        excluded = 0 if mode == "without_exclusions" else item["excludes"]
        used = state.used_probes | bit | excluded
        expected = probe_outcome(level, state)
        removed = state.survivors ^ expected
        if mode == "without_probe_effect":
            after_survivors = state.survivors
            removed = 0
        elif mode == "without_large_consequence" and removed.bit_count() > 1:
            one = removed & -removed
            after_survivors = state.survivors ^ one
            removed = one
        else:
            after_survivors = expected
        return state._replace(
            survivors=after_survivors,
            used_probes=used,
            charge=0,
            evidence_left=state.evidence_left - item["cost"],
            last_eliminated=removed,
            last_event=5,
        )

    if mode == "without_singleton_gate":
        if state.hypothesis_cursor == level["answer"]:
            return state._replace(last_event=6, terminal=WIN)
        return _strike(state, 6)

    if (singleton_ready(level, state)
            and state.survivors & (1 << state.hypothesis_cursor)):
        return state._replace(last_eliminated=0, last_event=6, terminal=WIN)
    return _strike(state, 6)


def transition(level, state, action):
    return _transition(level, state, action, "normal")


def without_probe_effect(level, state, action):
    return _transition(level, state, action, "without_probe_effect")


def without_large_consequence(level, state, action):
    return _transition(level, state, action, "without_large_consequence")


def without_singleton_gate(level, state, action):
    return _transition(level, state, action, "without_singleton_gate")


def without_dependencies(level, state, action):
    """Counterfactual: every probe ignores its visible prerequisite marks."""
    return _transition(level, state, action, "without_dependencies")


def without_exclusions(level, state, action):
    """Counterfactual: fired probes no longer close their marked alternatives."""
    return _transition(level, state, action, "without_exclusions")


def action_cost(before, after):
    if after == before:
        return 0
    # A first timing/claim error is a visible free warning. The second is
    # terminal, so there is no zero-cost cycle.
    if after.strikes > before.strikes:
        return 0
    return 1


def execute(level, actions, transition_fn=transition):
    state = start_state(level)
    budget = level["budget"]
    for action in actions:
        after = transition_fn(level, state, action)
        budget -= action_cost(state, after)
        state = after
    return state, budget


for _level in LEVELS:
    _state, _left = execute(_level, _level["witness"])
    assert (solved(_level, _state)
            and _left == _level["budget_slack"]), (
                _level["name"], _state, _left)
    _state = start_state(_level)
    _large = False
    for _action in _level["witness"]:
        _after = transition(_level, _state, _action)
        if (_state.survivors ^ _after.survivors).bit_count() >= _level["large_elimination"]:
            _large = True
        _state = _after
    assert _large, _level["name"]
assert {action for level in LEVELS for action in level["witness"]} == set(range(1, 7))


def _points(level):
    result = []
    for index in range(level["n"]):
        angle = -math.pi / 2 + 2 * math.pi * index / level["n"]
        result.append((32 + round(19 * math.cos(angle)),
                       31 + round(14 * math.sin(angle))))
    return tuple(result)


class PlanetariumDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def pixel(frame, x, y, color):
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color

    @classmethod
    def line(cls, frame, start, end, color, dotted=False, width=1):
        x0, y0 = start; x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 4 in (1, 2):
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            for offset in range(width):
                cls.pixel(frame, x, y + offset, color)

    @classmethod
    def disc(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        inner = max(0, radius - 1) ** 2
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
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
    def triangle(cls, frame, center, radius, color, invert=False,
                 hollow=False):
        cx, cy = center
        for step in range(radius + 1):
            reach = step
            y = cy + (radius - step if invert else step - radius)
            if hollow:
                cls.pixel(frame, cx - reach, y, color)
                cls.pixel(frame, cx + reach, y, color)
            else:
                for x in range(cx - reach, cx + reach + 1):
                    cls.pixel(frame, x, y, color)

    @classmethod
    def hypothesis(cls, frame, center, index, color, folded=False):
        """Eight large silhouettes with distinct internal hatch patterns."""
        x, y = center
        if folded:
            cls.line(frame, (x - 4, y), (x + 4, y), RED, width=2)
            cls.line(frame, (x - 2, y - 2), (x + 2, y + 2), SLATE)
            return
        shape = index % 8
        if shape == 0:
            cls.triangle(frame, center, 4, color, hollow=True)
        elif shape == 1:
            cls.diamond(frame, center, 4, color, hollow=True)
        elif shape == 2:
            cls.disc(frame, center, 4, color, hollow=True)
        elif shape == 3:
            cls.line(frame, (x - 4, y), (x + 4, y), color, width=2)
            cls.line(frame, (x, y - 4), (x, y + 4), color, width=2)
        elif shape == 4:
            cls.triangle(frame, center, 4, color, invert=True, hollow=True)
        elif shape == 5:
            cls.line(frame, (x - 4, y + 3), (x, y - 3), color, width=2)
            cls.line(frame, (x, y - 3), (x + 4, y + 3), color, width=2)
        elif shape == 6:
            cls.disc(frame, center, 4, color)
            cls.disc(frame, (x + 2, y - 1), 3, INK)
        else:
            cls.diamond(frame, center, 4, color)
            cls.disc(frame, center, 2, INK)
        # Index-specific notches keep same-family shapes distinguishable.
        for mark in range(index % 3 + 1):
            cls.pixel(frame, x - 2 + mark * 2, y, PAPER)

    def background(self, frame):
        frame[:, :] = INK
        for y in range(2, 57, 7):
            for x in range((y * 5) % 11, 64, 13):
                frame[y, x] = VELVET if (x + y) % 3 else CHARCOAL
        self.disc(frame, (32, 29), 24, VELVET, hollow=True)
        self.disc(frame, (32, 29), 21, SLATE, hollow=True)
        for spoke in range(12):
            angle = 2 * math.pi * spoke / 12
            a = (32 + round(7 * math.cos(angle)),
                 29 + round(7 * math.sin(angle)))
            b = (32 + round(23 * math.cos(angle)),
                 29 + round(23 * math.sin(angle)))
            self.line(frame, a, b, CHARCOAL, dotted=True)

    def partition_halo(self, frame, point, in_a, color=None):
        if in_a:
            self.disc(frame, point, 6, SKY if color is None else color,
                      hollow=True)
            self.pixel(frame, point[0], point[1] - 6, PAPER)
        else:
            self.diamond(frame, point, 6, VIOLET if color is None else color,
                         hollow=True)
            self.pixel(frame, point[0] - 6, point[1], PAPER)

    def field(self, frame, state):
        level = self.game.level
        points = _points(level)
        side_a, _side_b = probe_partition(level, state.probe_cursor)
        for index, point in enumerate(points):
            bit = 1 << index
            alive = bool(state.survivors & bit)
            if alive:
                self.partition_halo(frame, point, bool(side_a & bit))
            self.hypothesis(frame, point, index,
                            GOLD if alive else SLATE, folded=not alive)
            if state.hypothesis_cursor == index:
                self.disc(frame, point, 7, PAPER, hollow=True)
                self.line(frame, (32, 29), point, GOLD, dotted=True)

    def probe_lenses(self, frame, state):
        level = self.game.level
        count = len(level["probes"])
        spacing = 9 if count >= 6 else 11
        start = 32 - spacing * (count - 1) // 2
        for index, item in enumerate(level["probes"]):
            x = start + index * spacing
            bit = 1 << index
            used = bool(state.used_probes & bit)
            available = probe_available(level, state, index)
            color = SLATE if used else MOSS if available else VELVET
            self.disc(frame, (x, 5), 3, color, hollow=not used)
            self.diamond(frame, (x, 5), 2, PAPER if index == state.probe_cursor
                         else ASH, hollow=True)
            for cost_mark in range(item["cost"]):
                self.pixel(frame, x - item["cost"] + 1 + cost_mark * 2,
                           9, AMBER if cost_mark < state.charge and
                           index == state.probe_cursor else ASH)
            if item["requires"]:
                self.line(frame, (x - 2, 11), (x + 2, 11), VIOLET,
                          dotted=True)
            if item["excludes"]:
                self.pixel(frame, x, 12, RED)
        selected_x = start + state.probe_cursor * spacing
        self.disc(frame, (selected_x, 5), 5, GOLD, hollow=True)

    def center_instrument(self, frame, state):
        level = self.game.level
        item = chosen_probe(level, state)
        side_a, side_b = probe_partition(level, state.probe_cursor)
        self.disc(frame, (32, 29), 7, VELVET)
        self.disc(frame, (32, 29), 7, GOLD, hollow=True)
        self.diamond(frame, (32, 29), 4, SKY, hollow=True)
        # Partition size is shown by paired countable round/diamond notches.
        for index in range(side_a.bit_count()):
            self.disc(frame, (27 + index * 2, 27), 1, SKY,
                      hollow=bool(index % 2))
        for index in range(side_b.bit_count()):
            self.diamond(frame, (27 + index * 2, 32), 1, VIOLET,
                         hollow=bool(index % 2))
        for index in range(item["cost"]):
            angle = -math.pi / 2 + index * math.pi / max(1, item["cost"] - 1)
            point = (32 + round(6 * math.cos(angle)),
                     29 + round(6 * math.sin(angle)))
            self.disc(frame, point, 1,
                      AMBER if index < state.charge else PAPER)

    def hud(self, frame, state):
        # One lower gold diamond per exact remaining action.
        for index in range(self.game.budget_max):
            row, column = divmod(index, 15)
            center = (4 + column * 4, 59 + row * 3)
            live = index < self.game.budget_left
            self.diamond(frame, center, 1, GOLD if live else CHARCOAL,
                         hollow=not live)
        # Evidence purse is independent from navigation/action budget.
        for index in range(self.game.level["evidence_budget"]):
            self.triangle(frame, (3, 13 + index * 4), 1,
                          MAGENTA if index < state.evidence_left else CHARCOAL,
                          hollow=index >= state.evidence_left)
        # Paired warning seals: first remains cracked, second closes terminally.
        for index, y in enumerate((18, 27)):
            cracked = index < state.strikes
            self.disc(frame, (61, y), 3, RED if cracked else MOSS,
                      hollow=not cracked)
            if cracked:
                self.line(frame, (59, y - 2), (63, y + 2), PAPER)

    def animation(self, frame, state):
        g = self.game
        if not g.anim_kind:
            if state.terminal == LOSS:
                self.line(frame, (5, 8), (59, 51), RED, width=2)
                self.line(frame, (59, 8), (5, 51), VIOLET, width=2)
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress
        span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        if g.anim_kind in ("probe_select", "claim_select"):
            center = (32, 29)
            self.disc(frame, center, 8 + wave, GOLD, hollow=True)
            angle = 2 * math.pi * p / max(1, span)
            point = (32 + round((9 + wave) * math.cos(angle)),
                     29 + round((9 + wave) * math.sin(angle)))
            self.line(frame, center, point, PAPER, dotted=True)
        elif g.anim_kind == "charge":
            radius = 3 + p
            self.disc(frame, (32, 29), radius, AMBER, hollow=True)
            self.diamond(frame, (32, 29), 2 + wave, GOLD)
        elif g.anim_kind == "probe":
            self.diamond(frame, (32, 29 - p * 2), 3 + wave, GOLD)
            points = _points(g.level)
            for index, point in enumerate(points):
                if not after.last_eliminated & (1 << index):
                    continue
                folded = (point[0] + (32 - point[0]) * p // span,
                          point[1] + (29 - point[1]) * p // span)
                self.line(frame, point, folded, SKY, dotted=True)
                self.diamond(frame, folded, max(1, 4 - p // 2), RED,
                             hollow=True)
        elif g.anim_kind == "warning":
            offset = (-2, 2, -1, 1, 0, 1, 0)[min(p, 6)]
            self.disc(frame, (32 + offset, 29), 8 + wave, RED, hollow=True)
            self.line(frame, (25, 26 + offset), (39, 32 - offset), PAPER)
        elif g.anim_kind == "success":
            self.disc(frame, (32, 29), 7 + p * 3, GOLD, hollow=True)
            self.disc(frame, (32, 29), max(1, 6 - p // 2), PAPER,
                      hollow=True)
            for index in range(8):
                angle = 2 * math.pi * index / 8
                point = (32 + round((8 + p) * math.cos(angle)),
                         29 + round((8 + p) * math.sin(angle)))
                self.diamond(frame, point, 1, AMBER)
        elif g.anim_kind == "loss":
            inset = min(22, p * 3)
            self.line(frame, (4 + inset, 6), (60 - inset, 52), RED, width=2)
            self.line(frame, (60 - inset, 6), (4 + inset, 52), VIOLET,
                      width=2)
        else:
            self.disc(frame, (32, 29), 8 + wave, ASH, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        state = self.game.state
        self.background(frame)
        self.probe_lenses(frame, state)
        self.field(frame, state)
        self.center_instrument(frame, state)
        self.hud(frame, state)
        self.animation(frame, state)
        return frame


class Q161(ARCBaseGame):
    def __init__(self):
        self.display = PlanetariumDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [
            Level(sprites=[], grid_size=(64, 64), data=deepcopy(item),
                  name=item["name"])
            for item in LEVELS
        ]
        super().__init__(
            "q161", levels,
            Camera(0, 0, 64, 64, INK, INK, [self.display]),
            False, len(levels), [1, 2, 3, 4, 5, 6],
        )

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = after
        self.pending_budget = budget
        self.pending_terminal = terminal

    def finish(self):
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
                self.finish()
            return
        aid = self.action.id.value
        if aid == 0:
            self.complete_action()
            return
        before = self.state
        after = transition(self.level, before, aid)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        cost = action_cost(before, after)
        budget = self.budget_left - cost
        won = after.terminal == WIN
        lost = after.terminal == LOSS or (budget <= 0 and not won)
        if lost and after.terminal != LOSS:
            after = after._replace(terminal=LOSS)
        if won:
            kind, frames, terminal = "success", 6, "win"
        elif lost:
            kind, frames, terminal = "loss", 6, "loss"
        elif after.strikes > before.strikes:
            kind, frames, terminal = "warning", 7, None
        elif aid in (1, 2):
            kind, frames, terminal = "probe_select", 6, None
        elif aid in (3, 4):
            kind, frames, terminal = "claim_select", 6, None
        elif aid == 5 and after.survivors != before.survivors:
            kind, frames, terminal = "probe", 8, None
        else:
            kind, frames, terminal = "charge", 6, None
        self.begin(kind, frames, after, budget, terminal)
