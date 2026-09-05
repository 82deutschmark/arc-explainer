# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q145-v2 Twin Tidepool Policy Observatory.

Two translucent tidepools receive the same authored sequence of exact pulse
quanta.  Their round and diamond floats have different starts, masses, walls,
and (later) support gates, so the pair of stateful trajectories identifies one
concealed policy law.  The player selects that policy, previews its complete
effect on a separate main pool, and only then makes the irreversible release.

The module exposes a pure, hashable rules contract for independent search,
counterfactual mutation, replay, and exact random-policy analysis.  It adopts
mx002 deterministic physics only; there is no stochastic or twitch component.
"""

from __future__ import annotations

from copy import deepcopy
from typing import NamedTuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


# ARC palette indices only.
PAPER, MIST, PEARL, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
ORCHID, ROSE, CORAL, SKY, GLASS, SUN = 6, 7, 8, 9, 10, 11
AMBER, OXBLOOD, MOSS, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
TEST_ACTIONS = (1, 2)


class State(NamedTuple):
    tick: int
    left_trace: tuple
    right_trace: tuple
    pulse_history: tuple
    selected: int
    preview: tuple
    strikes: int
    last_event: int
    terminal: int


TERMINAL_INDEX = 8


POLICY_NAMES = ("lift", "sink", "tide", "reed")


def _shortest_selection(policies, answer):
    target = policies.index(answer)
    size = len(policies)
    backward = (size - target) % size
    forward = target
    if backward <= forward:
        return (3,) * backward
    return (4,) * forward


def observatory(name, probes, policies, answer, starts, *, limit=12,
                masses=(1, 1, 1), gates=(None, None, None), tide_phase=0,
                curriculum=()):
    probes = tuple(int(item) for item in probes)
    policies = tuple(int(item) for item in policies)
    starts = tuple((int(p), int(v)) for p, v in starts)
    witness = probes + _shortest_selection(policies, answer) + (5, 6)
    return {
        "name": name,
        "probes": probes,
        "policies": policies,
        "answer": int(answer),
        "starts": starts,
        "limit": int(limit),
        "masses": tuple(int(item) for item in masses),
        "gates": tuple(gates),
        "tide_phase": int(tide_phase),
        "budget": len(witness) + 4,
        "witness": witness,
        "curriculum": tuple(curriculum),
    }


# Pulse 1 is a pointed sun quantum; pulse 2 is a cut-diamond moon quantum.
# Level 2+ uses exactly eighteen prescribed pulses. Even after allowing one
# recoverable wrong pulse, blindly reproducing the visible experiment has the
# strict upper bound 19 / 2^18 < 1e-4 before policy selection is considered.
# Length is held flat while new laws, typed bodies, collision, and support
# compose rather than relying on later count inflation.
LEVELS = (
    observatory(
        "First Paired Drift",
        (1, 2, 1, 1, 2, 2, 1, 2),
        (0, 1), 1,
        ((5, 0), (8, 0), (6, 0)),
        limit=14,
        curriculum=("parallel-pulse", "constant-current"),
    ),
    observatory(
        "Momentum Ledger",
        (1, 1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 2, 1, 2, 1, 2, 1, 2),
        (0, 1, 2), 1,
        ((4, 1), (10, -1), (7, 0)),
        limit=16, tide_phase=1,
        curriculum=("parallel-pulse", "persistent-momentum",
                    "three-policy-discrimination"),
    ),
    observatory(
        "Pearl Wall Return",
        (1, 1, 1, 2, 2, 1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 2, 2, 1),
        (0, 1, 2), 2,
        ((2, -1), (8, 1), (5, 0)),
        limit=10, tide_phase=0,
        curriculum=("momentum", "exact-wall-reflection",
                    "paired-collision-evidence"),
    ),
    observatory(
        "Reed Brake",
        (2, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 2, 1, 2, 2),
        (0, 1, 2, 3), 3,
        ((3, 2), (9, -2), (6, 1)),
        limit=12, tide_phase=1,
        curriculum=("momentum", "reflection", "velocity-opposing-drag",
                    "four-policy-discrimination"),
    ),
    observatory(
        "Alternating Spring Tide",
        (1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 2, 1, 2, 1),
        (0, 1, 2, 3), 1,
        ((1, 1), (11, -1), (6, 0)),
        limit=12, tide_phase=1,
        curriculum=("momentum", "reflection", "alternating-tide",
                    "drag-comparison"),
    ),
    observatory(
        "Shell and Seed Mass",
        (1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 2, 1, 1, 2, 1, 2, 1, 2),
        (0, 1, 2, 3), 2,
        ((2, 0), (10, 0), (5, 1)),
        limit=12, masses=(1, 2, 1), tide_phase=0,
        curriculum=("typed-body-mass", "momentum", "reflection",
                    "alternating-tide", "drag"),
    ),
    observatory(
        "Lily Support Gate",
        (2, 1, 1, 2, 1, 2, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 1),
        (0, 1, 2, 3), 3,
        ((1, 2), (10, -1), (4, 1)),
        limit=12, masses=(1, 2, 1), gates=(6, 6, 7), tide_phase=1,
        curriculum=("typed-body-mass", "support-threshold", "collision",
                    "tide", "drag"),
    ),
    observatory(
        "Twin Tidepool Policy Observatory",
        (1, 2, 1, 1, 2, 2, 1, 2, 1, 2, 2, 1, 1, 2, 1, 2, 2, 1),
        (0, 1, 2, 3), 1,
        ((2, 1), (11, -2), (5, 1)),
        limit=13, masses=(1, 2, 2), gates=(7, 6, 8), tide_phase=0,
        curriculum=("paired-stateful-trajectories", "typed-mass",
                    "momentum", "support", "reflection", "alternating-tide",
                    "drag", "previewed-irreversible-commit"),
    ),
)


def _sign(value):
    return (value > 0) - (value < 0)


def _reflect(position, velocity, limit):
    """Exact mirror reflection on an integer interval."""
    while position < 0 or position > limit:
        if position < 0:
            position = -position
            velocity = -velocity
        elif position > limit:
            position = 2 * limit - position
            velocity = -velocity
    return position, velocity


def physics_step(level, body, tick, position, velocity, policy, pulse):
    """One public deterministic position/momentum quantum.

    Bodies 0/1 are the parallel round/diamond sandbox floats; body 2 is the
    separately previewed main float.  Mass is an exact skipped impulse quantum,
    not division or floating-point integration.  A support gate catches only a
    slow crossing; faster momentum passes it.  Walls mirror exactly.
    """
    pulse_force = 1 if int(pulse) == 1 else -1
    mass = level["masses"][body]
    if mass > 1 and (tick + body) % mass:
        pulse_force = 0

    if policy == 0:      # steady lift current
        current = 1
    elif policy == 1:    # steady sink current
        current = -1
    elif policy == 2:    # alternating spring tide
        current = 1 if (tick + body + level["tide_phase"]) % 2 == 0 else -1
    else:                # reed brake opposes current momentum
        current = -_sign(velocity)

    velocity = max(-4, min(4, velocity + pulse_force + current))
    proposed = position + velocity
    gate = level["gates"][body]
    if gate is not None:
        crossed = ((position < gate <= proposed)
                   or (position > gate >= proposed))
        if crossed and abs(velocity) <= 1:
            return int(gate), 0
    return _reflect(proposed, velocity, level["limit"])


def sandbox_trajectory(level, body, policy, probes=None):
    """Public exact trajectory including the initial (position, velocity)."""
    probes = level["probes"] if probes is None else tuple(probes)
    position, velocity = level["starts"][body]
    trace = [(position, velocity)]
    for tick, pulse in enumerate(probes):
        position, velocity = physics_step(
            level, body, tick, position, velocity, policy, pulse)
        trace.append((position, velocity))
    return tuple(trace)


def sandbox_trajectories(level, policy):
    """The paired visible evidence signature for one candidate policy."""
    return (sandbox_trajectory(level, 0, policy),
            sandbox_trajectory(level, 1, policy))


def main_trajectory(level, policy):
    """The separate preview trajectory; it never mutates the main pool."""
    return sandbox_trajectory(level, 2, policy)


def start_state(level):
    return State(
        0,
        (tuple(level["starts"][0]),),
        (tuple(level["starts"][1]),),
        (),
        0,
        (),
        0,
        0,
        ACTIVE,
    )


def selected_policy(level, state):
    return level["policies"][state.selected]


def evidence_ready(level, state):
    expected_left, expected_right = sandbox_trajectories(
        level, level["answer"])
    return (state.tick == len(level["probes"])
            and state.pulse_history == level["probes"]
            and state.left_trace == expected_left
            and state.right_trace == expected_right)


def commit_ready(level, state):
    return (evidence_ready(level, state)
            and state.preview == main_trajectory(
                level, selected_policy(level, state)))


def solved(level, state):
    return (state.terminal == WIN and commit_ready(level, state)
            and selected_policy(level, state) == level["answer"])


def action_tokens(_level):
    return (1, 2, 3, 4, 5, 6)


def encode_action(_level, action):
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    return (aid,)


def _transition(level, state, action, mode="physics"):
    if state.terminal != ACTIVE:
        return state
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    if aid not in action_tokens(level):
        return state

    if aid in TEST_ACTIONS:
        if state.tick >= len(level["probes"]):
            return state
        tick = state.tick
        expected_pulse = level["probes"][tick]
        if aid != expected_pulse:
            strikes = state.strikes + 1
            return state._replace(
                strikes=strikes,
                last_event=aid,
                terminal=LOSS if strikes >= 2 else ACTIVE,
            )
        pulse_history = state.pulse_history + (aid,)
        if mode == "without_physics":
            left = state.left_trace + (state.left_trace[-1],)
            right = state.right_trace + (state.right_trace[-1],)
        else:
            lp, lv = state.left_trace[-1]
            left_after = physics_step(
                level, 0, tick, lp, lv, level["answer"], aid)
            left = state.left_trace + (left_after,)
            if mode == "without_parallel":
                right = state.right_trace + (state.right_trace[-1],)
            else:
                rp, rv = state.right_trace[-1]
                right_after = physics_step(
                    level, 1, tick, rp, rv, level["answer"], aid)
                right = state.right_trace + (right_after,)
        return state._replace(
            tick=tick + 1,
            left_trace=left,
            right_trace=right,
            pulse_history=pulse_history,
            preview=(),
            last_event=aid,
        )

    if aid in (3, 4):
        size = len(level["policies"])
        delta = -1 if aid == 3 else 1
        choice = (state.selected + delta) % size
        if choice == state.selected:
            return state
        return state._replace(
            selected=choice, preview=(), last_event=aid)

    if aid == 5:
        if not evidence_ready(level, state):
            return state
        preview = main_trajectory(level, selected_policy(level, state))
        if preview == state.preview:
            return state
        return state._replace(preview=preview, last_event=5)

    if not commit_ready(level, state):
        return state
    if selected_policy(level, state) == level["answer"]:
        return state._replace(last_event=6, terminal=WIN)
    strikes = state.strikes + 1
    return state._replace(
        preview=(), strikes=strikes, last_event=6,
        terminal=LOSS if strikes >= 2 else ACTIVE,
    )


def transition(level, state, action):
    return _transition(level, state, action, "physics")


def without_physics(level, state, action):
    """Counterfactual: pulses record but bodies never obey a physical law."""
    return _transition(level, state, action, "without_physics")


def without_parallel(level, state, action):
    """Counterfactual: only the left sandbox runs; paired evidence disappears."""
    return _transition(level, state, action, "without_parallel")


def action_cost(before, after):
    if after == before:
        return 0
    # The first mistaken irreversible release cracks a persistent shell but
    # costs no bead, leaving enough exact budget to select, preview, and apply
    # the corrected law.  It cannot cycle: the second mistake terminates.
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


# Public assertions pin causal curriculum and prevent a decorative physics
# implementation from importing successfully.
for _level in LEVELS:
    _signatures = tuple(sandbox_trajectories(_level, policy)
                        for policy in _level["policies"])
    assert len(set(_signatures)) == len(_signatures), _level["name"]
    assert len(set(main_trajectory(_level, policy)
                   for policy in _level["policies"])) == len(_level["policies"])
    _state, _left = execute(_level, _level["witness"])
    assert solved(_level, _state) and _left == 4, (_level["name"], _state, _left)
    _mutant, _ = execute(_level, _level["witness"], without_physics)
    assert not solved(_level, _mutant)
    _mutant, _ = execute(_level, _level["witness"], without_parallel)
    assert not solved(_level, _mutant)
assert {action for level in LEVELS for action in level["witness"]} == set(range(1, 7))


class TidepoolDisplay(RenderableUserDisplay):
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
    def triangle(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(radius + 1):
            reach = dy
            y = cy - radius + dy
            if hollow:
                cls.pixel(frame, cx - reach, y, color)
                cls.pixel(frame, cx + reach, y, color)
            else:
                for x in range(cx - reach, cx + reach + 1):
                    cls.pixel(frame, x, y, color)

    @classmethod
    def pulse_glyph(cls, frame, center, pulse, color, large=False):
        radius = 3 if large else 2
        if pulse == 1:
            cls.triangle(frame, center, radius, color, hollow=True)
            cls.line(frame, (center[0], center[1] - radius + 1),
                     (center[0], center[1] + radius), color, dotted=True)
        else:
            cls.diamond(frame, center, radius, color, hollow=True)
            cls.line(frame, (center[0] - radius + 1, center[1]),
                     (center[0] + radius - 1, center[1]), color, dotted=True)

    @classmethod
    def policy_glyph(cls, frame, center, policy, color, hollow=False):
        x, y = center
        if policy == 0:
            cls.triangle(frame, (x, y - 1), 4, color, hollow)
            cls.line(frame, (x, y + 3), (x, y - 3), color, dotted=True)
        elif policy == 1:
            cls.triangle(frame, (x, y + 1), 4, color, hollow)
            cls.line(frame, (x, y - 3), (x, y + 3), color, dotted=True)
        elif policy == 2:
            cls.line(frame, (x - 4, y + 2), (x - 2, y - 2), color, width=2)
            cls.line(frame, (x - 2, y - 2), (x, y + 2), color, width=2)
            cls.line(frame, (x, y + 2), (x + 2, y - 2), color, width=2)
            cls.line(frame, (x + 2, y - 2), (x + 4, y + 2), color, width=2)
        else:
            for offset in (-3, 0, 3):
                cls.line(frame, (x - 4, y + offset),
                         (x + 2, y + offset), color, dotted=bool(offset))
            cls.line(frame, (x + 3, y - 4), (x + 3, y + 4), color, width=2)

    def background(self, frame):
        frame[:, :] = PAPER
        # Sparse fibrous paper and translucent sea-glass crescents.
        for y in range(1, 64, 6):
            for x in range((y * 3) % 8, 64, 13):
                frame[y, x] = MIST if (x + y) % 2 else PEARL
        self.disc(frame, (18, 27), 14, SKY)
        self.disc(frame, (18, 27), 12, GLASS)
        self.disc(frame, (18, 27), 10, PAPER)
        self.disc(frame, (46, 27), 14, MOSS)
        self.disc(frame, (46, 27), 12, GLASS)
        self.disc(frame, (46, 27), 10, PAPER)
        # Unequal petal notches defeat a raw circle/square read.
        for center, flip in (((8, 21), False), ((27, 34), True),
                             ((55, 19), True), ((38, 36), False)):
            self.diamond(frame, center, 3, MIST if flip else PEARL)
        self.disc(frame, (32, 45), 8, VIOLET, hollow=True)
        self.disc(frame, (32, 45), 6, GLASS, hollow=True)

    def schedule(self, frame, state):
        level = self.game.level
        # Every prescribed quantum remains visible. Shape and internal hatch,
        # not hue, distinguish the two pulses. A halo marks the next quantum.
        for index, pulse in enumerate(level["probes"]):
            row, column = divmod(index, 9)
            center = (13 + column * 5, 3 + row * 5)
            done = index < state.tick
            color = MOSS if done and state.pulse_history[index] == pulse else (
                OXBLOOD if done else SLATE)
            self.pulse_glyph(frame, center, pulse, color)
            if index == state.tick:
                self.disc(frame, center, 3, SUN, hollow=True)

        # Exact remaining action beads, split along the open margins and
        # grouped by five with a diamond knot.
        for index in range(self.game.budget_max):
            side = index % 2
            row = index // 2
            center = (2 if side == 0 else 61, 4 + row * 4)
            live = index < self.game.budget_left
            self.disc(frame, center, 1, SUN if live else PEARL,
                      hollow=not live)
            if row and row % 5 == 0:
                self.diamond(frame, (4 if side == 0 else 59, center[1]),
                             1, SLATE, hollow=True)

    def _pool_x(self, body, position):
        center = 18 if body == 0 else 46
        limit = self.game.level["limit"]
        return center - 9 + (18 * position // max(1, limit))

    def body(self, frame, body, position, center_y=27, color=CORAL):
        center = (self._pool_x(body, position), center_y)
        if body == 0:
            self.disc(frame, center, 4, color)
            self.disc(frame, center, 2, PAPER, hollow=True)
            self.line(frame, (center[0] - 3, center[1]),
                      (center[0] + 3, center[1]), INK, dotted=True)
        else:
            self.diamond(frame, center, 5, color)
            self.diamond(frame, center, 2, PAPER, hollow=True)
            self.line(frame, (center[0], center[1] - 4),
                      (center[0], center[1] + 4), INK, dotted=True)
        return center

    def pool(self, frame, body, trace):
        # Full stateful trajectory is retained as a patterned wake. Position
        # and signed velocity are both visible without digits.
        color = CORAL if body == 0 else VIOLET
        for index, (position, _velocity) in enumerate(trace[:-1]):
            center = (self._pool_x(body, position), 22 + (index % 4) * 3)
            if body == 0:
                self.disc(frame, center, 1, color, hollow=bool(index % 2))
            else:
                self.diamond(frame, center, 1, color, hollow=bool(index % 2))
        position, velocity = trace[-1]
        center = self.body(frame, body, position, color=color)
        direction = _sign(velocity)
        for mark in range(abs(velocity)):
            x = center[0] + direction * (5 + mark * 2)
            self.triangle(frame, (x, center[1]), 1, INK, hollow=True)
        gate = self.game.level["gates"][body]
        if gate is not None:
            x = self._pool_x(body, gate)
            self.line(frame, (x, 16), (x, 38), MOSS, dotted=True)
            self.diamond(frame, (x, 18), 2, MOSS, hollow=True)

    def policies(self, frame, state):
        level = self.game.level
        count = len(level["policies"])
        spacing = 13 if count == 4 else 17
        start = 32 - spacing * (count - 1) // 2
        for index, policy in enumerate(level["policies"]):
            center = (start + index * spacing, 59)
            selected = index == state.selected
            # Each policy card openly predicts the two sandbox endpoints.
            # The round upper mark and diamond lower mark match the large
            # bodies, while the one-pixel tail shows signed final momentum.
            # Players can therefore compare observed evidence with every
            # candidate rather than relying on an answer hidden in state.
            predicted = sandbox_trajectories(level, policy)
            for body, y in ((0, 51), (1, 54)):
                position, velocity = predicted[body][-1]
                x = center[0] - 4 + 8 * position // max(1, level["limit"])
                if body == 0:
                    self.disc(frame, (x, y), 1, CORAL, hollow=True)
                else:
                    self.diamond(frame, (x, y), 1, VIOLET, hollow=True)
                self.pixel(frame, x + _sign(velocity) * 2, y, INK)
            if selected:
                self.disc(frame, center, 6, SUN, hollow=True)
                self.disc(frame, center, 5, VIOLET, hollow=True)
            self.policy_glyph(frame, center, policy,
                              INK if selected else SLATE, hollow=not selected)

    def main_pool(self, frame, state):
        trace = state.preview
        if not trace:
            trace = (tuple(self.game.level["starts"][2]),)
        limit = self.game.level["limit"]
        for index, (position, _velocity) in enumerate(trace[:-1]):
            x = 26 + 12 * position // max(1, limit)
            y = 43 + (index % 3)
            self.diamond(frame, (x, y), 1, VIOLET, hollow=bool(index % 2))
        position, velocity = trace[-1]
        x = 26 + 12 * position // max(1, limit)
        self.diamond(frame, (x, 45), 3, AMBER if state.preview else PEARL)
        for mark in range(abs(velocity)):
            self.pixel(frame, x + _sign(velocity) * (4 + mark), 45, INK)
        # Two shell seals make the recoverable first release and terminal
        # second release countable by shape and fracture pattern.
        for index, sx in enumerate((22, 42)):
            cracked = index < state.strikes
            self.disc(frame, (sx, 47), 3, OXBLOOD if cracked else MOSS,
                      hollow=not cracked)
            if cracked:
                self.line(frame, (sx - 2, 45), (sx + 2, 49), INK)

    def animation(self, frame, state):
        g = self.game
        if not g.anim_kind:
            if state.terminal == LOSS:
                self.line(frame, (6, 14), (58, 40), OXBLOOD, width=2)
                self.line(frame, (58, 14), (6, 40), VIOLET, width=2)
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress
        span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        if g.anim_kind == "probe":
            for body, center_y in ((0, 27), (1, 27)):
                before_pos = (before.left_trace if body == 0
                              else before.right_trace)[-1][0]
                after_pos = (after.left_trace if body == 0
                             else after.right_trace)[-1][0]
                shown = before_pos + (after_pos - before_pos) * p // span
                center = self.body(frame, body, shown, center_y - wave // 2,
                                   SUN if body == 0 else ORCHID)
                self.disc(frame, center, 5 + wave, SKY, hollow=True)
            self.pulse_glyph(frame, (32, 13), after.last_event, OXBLOOD,
                             large=True)
        elif g.anim_kind == "select":
            count = len(g.level["policies"])
            spacing = 13 if count == 4 else 17
            start = 32 - spacing * (count - 1) // 2
            x0 = start + before.selected * spacing
            x1 = start + after.selected * spacing
            x = x0 + (x1 - x0) * p // span
            self.disc(frame, (x, 59), 6 + wave, SUN, hollow=True)
        elif g.anim_kind == "preview":
            trace = after.preview
            index = min(len(trace) - 1,
                        p * max(1, len(trace) - 1) // span)
            position, _velocity = trace[index]
            x = 26 + 12 * position // max(1, g.level["limit"])
            self.diamond(frame, (x, 44 - wave // 2), 4, VIOLET)
            self.disc(frame, (32, 45), 8 + wave, GLASS, hollow=True)
        elif g.anim_kind == "reject":
            offset = (-2, 2, -1, 1, 0, 1, 0)[min(p, 6)]
            self.disc(frame, (32 + offset, 45), 8 + wave,
                      OXBLOOD, hollow=True)
            self.line(frame, (25, 42 + offset), (39, 48 - offset), INK)
        elif g.anim_kind == "success":
            self.disc(frame, (32, 45), 8 + p * 2, MOSS, hollow=True)
            for index in range(8):
                x = 32 + ((p + 4) * (-1 if index % 2 else 1))
                y = 45 + (index - 4) * max(1, p) // 3
                self.diamond(frame, (x, y), 1, SUN)
        elif g.anim_kind == "loss":
            inset = min(20, p * 3)
            self.line(frame, (5 + inset, 12), (59 - inset, 42), OXBLOOD,
                      width=2)
            self.line(frame, (59 - inset, 12), (5 + inset, 42), VIOLET,
                      width=2)
        else:
            self.disc(frame, (32, 45), 8 + wave, PEARL, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        state = self.game.state
        self.background(frame)
        self.schedule(frame, state)
        self.pool(frame, 0, state.left_trace)
        self.pool(frame, 1, state.right_trace)
        self.main_pool(frame, state)
        self.policies(frame, state)
        self.animation(frame, state)
        return frame


class Q145(ARCBaseGame):
    def __init__(self):
        self.display = TidepoolDisplay(self)
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
            "q145", levels,
            Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
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
            # Level transitions add one engine frame; seven internal frames
            # keep the complete response within the 5-9 frame contract.
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 7, "loss"
        elif after.strikes > before.strikes:
            kind, frames, terminal = "reject", 7, None
        elif aid in TEST_ACTIONS:
            kind, frames, terminal = "probe", 7, None
        elif aid in (3, 4):
            kind, frames, terminal = "select", 6, None
        else:
            kind, frames, terminal = "preview", 7, None
        self.begin(kind, frames, after, budget, terminal)
