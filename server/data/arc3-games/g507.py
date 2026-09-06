# ARC-AGI-3 candidate task g507.

from __future__ import annotations

from copy import deepcopy
import math
from typing import NamedTuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, MIST, PEARL, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, CYAN, SUN = 6, 7, 8, 9, 10, 11
COPPER, OXBLOOD, MOSS, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
LEVER_ACTIONS = (1, 2)
TERMINAL_INDEX = 7
LOW, HIGH = 0, 6


class G507A(NamedTuple):
    values: tuple
    cursor: int
    tension: tuple
    taut: int
    latched: int
    audited: int
    strikes: int
    terminal: int


def scaffold(name, start, target, lever_effects, witness, *, masses=None,
             slack=(), latches=(), cursor=0, features=()):
    start = tuple(int(value) for value in start)
    target = tuple(int(value) for value in target)
    effects = tuple(tuple(int(value) for value in row)
                    for row in lever_effects)
    masses = tuple(int(value) for value in (
        masses if masses is not None else (1,) * len(start)))
    assert len(start) == len(target) == len(masses)
    assert effects and all(len(row) == len(start) for row in effects)
    slack_mask = sum(1 << int(index) for index in slack)
    latch_mask = sum(1 << int(index) for index in latches)
    return {
        "name": name,
        "start": start,
        "target": target,
        "lever_effects": effects,
        "masses": masses,
        "slack_rigs": slack_mask,
        "required_latches": latch_mask,
        "cursor": int(cursor),
        "budget": len(tuple(witness)),
        "witness": tuple(witness),
        "physical_features": tuple(features),
        "bounds": (LOW, HIGH),
    }


LEVELS = (
    scaffold(
        "Opposed Rope",
        (1, 3), (3, 1),
        ((1, -1),),
        (1, 1, 5, 6),
        features=("signed_coupling",),
    ),
    scaffold(
        "Three-Way Balance",
        (0, 3, 6), (3, 3, 3),
        ((1, -1, 0), (0, 1, -1)),
        (1, 1, 1, 4, 1, 1, 1, 5, 6),
        features=("signed_coupling",),
    ),
    scaffold(
        "Ratio Flywheel",
        (0, 4, 6), (2, 6, 3),
        ((1, -1, 0), (0, 2, -1)),
        (1, 1, 1, 4, 1, 1, 1, 5, 6),
        masses=(1, 2, 1), slack=(0,),
        features=("signed_coupling", "ratio_gears", "mass_quanta",
                  "slack_takeup"),
    ),
    scaffold(
        "Slack Sunrise",
        (0, 3, 6), (3, 3, 3),
        ((1, -1, 0), (0, 1, -1)),
        (1, 1, 1, 1, 4, 1, 1, 1, 5, 6),
        slack=(0,),
        features=("signed_coupling", "slack_takeup"),
    ),
    scaffold(
        "Catch and Return",
        (6, 0, 6), (3, 3, 3),
        ((1, -1, 0), (-1, 0, 1)),
        (2, 2, 2, 4, 2, 2, 2, 5, 6),
        latches=(0,),
        features=("signed_coupling", "target_latches"),
    ),
    scaffold(
        "Asymmetric Gantry",
        (0, 6, 6, 0), (3, 6, 3, 3),
        ((2, -1, 0, 0), (0, 1, -1, 0), (0, 0, 0, 1)),
        (3, 1, 1, 1, 4, 1, 1, 1, 4, 1, 1, 1, 5, 6),
        masses=(2, 1, 1, 1), latches=(0,), cursor=1,
        features=("signed_coupling", "ratio_gears", "mass_quanta",
                  "target_latches"),
    ),
    scaffold(
        "Tension Choir",
        (0, 6, 6, 0), (3, 6, 3, 3),
        ((2, -1, 0, 0), (0, 1, -1, 0), (0, 0, 0, 1)),
        (3, 1, 1, 1, 1, 4, 1, 1, 1, 4, 1, 1, 1, 5, 6),
        masses=(2, 1, 1, 1), slack=(0,), latches=(0,), cursor=1,
        features=("signed_coupling", "ratio_gears", "mass_quanta",
                  "slack_takeup", "target_latches"),
    ),
    scaffold(
        "Daybreak Kinetic Scaffold",
        (0, 6, 6, 0), (3, 6, 4, 2),
        ((2, -2, 0, 0), (0, 3, -1, 0), (0, 0, -1, 2)),
        (1, 1, 1, 4, 1, 1, 1, 4, 1, 1, 5, 6),
        masses=(2, 1, 1, 2), slack=(1,), latches=(0, 2),
        features=("signed_coupling", "ratio_gears", "mass_quanta",
                  "slack_takeup", "target_latches"),
    ),
)


def parse_action(action):
    if isinstance(action, (tuple, list)):
        return int(action[0])
    return int(action)


def action_tokens(_level):
    return (1, 2, 3, 4, 5, 6)


def encode_action(_level, action):
    return (parse_action(action),)


def start_state(level):
    return G507A(
        level["start"], level["cursor"],
        tuple(0 for _ in level["start"]), 0, 0, 0, 0, ACTIVE,
    )


def lever_tokens(level):
    return LEVER_ACTIONS


def coupled_effect(level, state, lever_token=None):
    if lever_token is None:
        return tuple(level["lever_effects"][int(state)])
    direction = 1 if parse_action(lever_token) == 1 else -1
    return tuple(direction * value
                 for value in level["lever_effects"][state.cursor])


def physical_state(_level, state):
    return (tuple(state.values), tuple(state.tension), state.taut, state.latched)


def _signed_quotient(value, divisor):
    return (1 if value >= 0 else -1) * (abs(value) // divisor)


def physics_step(level, state, lever, direction=1, *, mode="physics",
                 missing_feature=None):
    lever = int(lever); direction = 1 if int(direction) >= 0 else -1
    if not 0 <= lever < len(level["lever_effects"]):
        return state
    if mode == "without_physics":
        return state
    if missing_feature == "slack_takeup" and level["slack_rigs"] & (1 << lever):
        return state

    bit = 1 << lever
    if level["slack_rigs"] & bit and not state.taut & bit:
        return state._replace(taut=state.taut | bit, audited=0)

    effect = list(coupled_effect(level, lever))
    if mode == "without_coupling":
        keep = next((index for index, value in enumerate(effect) if value), None)
        effect = [value if index == keep else 0
                  for index, value in enumerate(effect)]
    if missing_feature == "signed_coupling":
        effect = [value if index == lever % len(effect) else 0
                  for index, value in enumerate(effect)]
    if missing_feature == "ratio_gears":
        effect = [(value > 0) - (value < 0) for value in effect]

    masses = ((1,) * len(level["masses"])
              if missing_feature == "mass_quanta" else level["masses"])
    latch_enabled = missing_feature != "target_latches"
    values = list(state.values)
    tension = list(state.tension)
    for index, force in enumerate(effect):
        if state.latched & (1 << index):
            continue
        total = tension[index] + direction * force
        movement = _signed_quotient(total, masses[index])
        tension[index] = total - movement * masses[index]
        values[index] += movement

    low, high = level["bounds"]
    if any(value < low or value > high for value in values):
        return state

    latched = state.latched
    if latch_enabled:
        for index in range(len(values)):
            bit = 1 << index
            if (level["required_latches"] & bit
                    and values[index] == level["target"][index]
                    and tension[index] == 0):
                latched |= bit
    result = state._replace(
        values=tuple(values), tension=tuple(tension), latched=latched,
        audited=0,
    )
    return result


def effective_delta(level, state, lever, direction=1):
    after = physics_step(level, state, lever, direction)
    return tuple(right - left for left, right in zip(state.values, after.values))


def ready(level, state):
    return (state.values == level["target"]
            and all(value == 0 for value in state.tension)
            and state.latched & level["required_latches"]
            == level["required_latches"]
            and state.taut & level["slack_rigs"] == level["slack_rigs"])


def _transition(level, state, action, *, mode="physics",
                missing_feature=None, missing_lever=None):
    if state.terminal != ACTIVE:
        return state
    aid = parse_action(action)
    if aid not in action_tokens(level):
        return state
    if aid in LEVER_ACTIONS:
        if missing_lever == state.cursor:
            return state
        return physics_step(
            level, state, state.cursor, 1 if aid == 1 else -1,
            mode=mode, missing_feature=missing_feature)
    if aid in (3, 4):
        size = len(level["lever_effects"])
        cursor = max(0, min(size - 1,
                            state.cursor + (-1 if aid == 3 else 1)))
        if cursor == state.cursor:
            return state
        return state._replace(cursor=cursor, audited=0)
    if aid == 5:
        if ready(level, state):
            return state._replace(audited=1)
        strikes = state.strikes + 1
        return state._replace(
            strikes=strikes,
            terminal=LOSS if strikes >= 2 else ACTIVE,
        )
    if not state.audited or not ready(level, state):
        return state
    return state._replace(terminal=WIN)


def transition(level, state, action):
    return _transition(level, state, action)


def without_physics(level, state, action):
    return _transition(level, state, action, mode="without_physics")


def without_coupling(level, state, action):
    return _transition(level, state, action, mode="without_coupling")


def without_feature(level, state, action, feature):
    return _transition(level, state, action, missing_feature=str(feature))


def without_lever(level, state, action, lever):
    return _transition(level, state, action, missing_lever=int(lever))


def action_cost(before, after):
    if after == before:
        return 0
    if after.strikes > before.strikes or after.terminal == LOSS:
        return 0
    return 1


def solved(level, state):
    return state.terminal == WIN and state.audited and ready(level, state)


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
    assert solved(_level, _state) and _left == 0, (
        _level["name"], _state, _left)
assert {parse_action(action) for level in LEVELS
        for action in level["witness"]} == set(range(1, 7))


class G507B(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, start, end, color, dotted=False, width=1):
        x0, y0 = start; x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 4 in (1, 2):
                continue
            x = round(x0 + (x1 - x0) * step / steps)
            y = round(y0 + (y1 - y0) * step / steps)
            frame[max(0, y - width + 1):min(64, y + width),
                  max(0, x - width + 1):min(64, x + width)] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        yy, xx = np.ogrid[:64, :64]
        distance = (xx - cx) ** 2 + (yy - cy) ** 2
        mask = distance <= radius ** 2
        if hollow:
            mask &= distance >= max(0, radius - 1) ** 2
        frame[mask] = color

    @staticmethod
    def diamond(frame, center, radius, color, hollow=False):
        cx, cy = center
        yy, xx = np.ogrid[:64, :64]
        distance = abs(xx - cx) + abs(yy - cy)
        mask = distance <= radius
        if hollow:
            mask &= distance >= max(0, radius - 1)
        frame[mask] = color

    def tower_xs(self):
        count = len(self.game.level["start"])
        if count == 2:
            return (20, 44)
        if count == 3:
            return (13, 32, 51)
        return (10, 25, 40, 55)

    @staticmethod
    def value_y(value):
        return 43 - int(value) * 5

    def background(self, frame):
        frame[:, :] = PAPER
        frame[6:62, 3:61] = MIST
        for y in range(8, 60, 4):
            for x in range(5 + (y // 4) % 3, 60, 6):
                frame[y, x] = PEARL if (x + y) % 4 else CYAN
        frame[7:9, 5:59] = SUN
        frame[45:48, 5:59] = COPPER
        for x in range(5, 60, 7):
            frame[46:50, x:x + 2] = SLATE

    def effect_plate(self, frame, lever, center, selected, taut):
        cx, cy = center
        effect = coupled_effect(self.game.level, lever)
        color = BLUE if selected else COPPER
        frame[cy - 5:cy + 6, cx - 7:cx + 8] = CHARCOAL
        frame[cy - 4:cy + 5, cx - 6:cx + 7] = PEARL
        if self.game.level["slack_rigs"] & (1 << lever):
            self.diamond(frame, center, 7, MAGENTA if taut else ROSE,
                         hollow=True)
        else:
            self.disc(frame, center, 7, color, hollow=True)
        start = cx - (len(effect) * 3) // 2 + 1
        for index, force in enumerate(effect):
            x = start + index * 3
            hue = SUN if force > 0 else BLUE if force < 0 else SLATE
            frame[cy - 1:cy + 2, x:x + 2] = hue
            for notch in range(abs(force)):
                y = cy - 3 - notch * 2 if force > 0 else cy + 3 + notch * 2
                if 0 <= y < 64:
                    frame[y:y + 1, x:x + 2] = hue
        if selected:
            frame[cy - 7:cy - 5, cx - 2:cx + 3] = BLUE

    def ropes(self, frame, state):
        xs = self.tower_xs()
        count = len(self.game.level["lever_effects"])
        centers = tuple((round((index + 1) * 64 / (count + 1)), 55)
                        for index in range(count))
        for lever, center in enumerate(centers):
            for tower, force in enumerate(coupled_effect(self.game.level, lever)):
                if not force:
                    continue
                target = (xs[tower], 10 + lever * 2)
                color = SUN if force > 0 else BLUE
                self.line(frame, center, target, color,
                          dotted=force < 0, width=1)
                for notch in range(abs(force)):
                    x = target[0] + notch - abs(force) // 2
                    frame[target[1] - 1:target[1] + 2, x:x + 1] = color
        for lever, center in enumerate(centers):
            self.effect_plate(frame, lever, center, lever == state.cursor,
                              bool(state.taut & (1 << lever)))

    def towers(self, frame, state):
        for index, (x, value, target, mass, tension) in enumerate(zip(
                self.tower_xs(), state.values, self.game.level["target"],
                self.game.level["masses"], state.tension)):
            frame[11:44, x - 4:x + 5] = PEARL
            frame[11:44, x - 4:x - 2] = SLATE
            frame[11:44:3, x - 1:x + 4] = SLATE
            ty = self.value_y(target)
            frame[ty - 1:ty + 2, x - 6:x + 7] = MOSS
            frame[ty, x - 4:x + 5:2] = PAPER
            y = self.value_y(value)
            frame[y - 2:y + 3, x - 6:x + 7] = CHARCOAL
            frame[y - 1:y + 2, x - 5:x + 6] = SUN
            size = 2 + mass
            frame[y + 3:y + 3 + size, x - size:x + size + 1] = COPPER
            for mark in range(mass):
                frame[y + 4:y + 5, x - mass + mark * 2:x - mass + mark * 2 + 1] = INK
            if tension:
                self.diamond(frame, (x + 5, y + 5), abs(tension),
                             BLUE if tension < 0 else MAGENTA)
            bit = 1 << index
            if self.game.level["required_latches"] & bit:
                self.disc(frame, (x, ty), 7,
                          MOSS if state.latched & bit else ROSE, hollow=True)

    def instruments(self, frame, state):
        for bead in range(self.game.budget_max):
            x = 5 + bead * 3
            color = SUN if bead < self.game.budget_left else PEARL
            self.diamond(frame, (x, 3), 1, color)
        for seal in range(2):
            center = (58, 13 + seal * 7)
            self.disc(frame, center, 3,
                      RED if seal < state.strikes else MOSS,
                      hollow=seal >= state.strikes)
            if seal < state.strikes:
                self.line(frame, (center[0] - 2, center[1] - 2),
                          (center[0] + 2, center[1] + 2), PAPER)
        self.diamond(frame, (4, 13), 3,
                     MOSS if state.audited else SLATE, hollow=not state.audited)
        if state.terminal == LOSS:
            self.line(frame, (4, 9), (60, 58), RED, width=2)
            self.line(frame, (60, 9), (4, 58), OXBLOOD, width=2)

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress; span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        count = len(g.level["lever_effects"])
        controls = tuple((round((index + 1) * 64 / (count + 1)), 55)
                         for index in range(count))
        if g.anim_kind in ("pull", "slack"):
            source = controls[before.cursor]
            effect = coupled_effect(g.level, before.cursor)
            for tower, force in enumerate(effect):
                if not force:
                    continue
                target = (self.tower_xs()[tower], 10 + before.cursor * 2)
                center = (round(source[0] + (target[0] - source[0]) * p / span),
                          round(source[1] + (target[1] - source[1]) * p / span))
                self.diamond(frame, center, 1 + wave // 2,
                             SUN if force > 0 else BLUE)
                if before.values[tower] != after.values[tower]:
                    y0 = self.value_y(before.values[tower])
                    y1 = self.value_y(after.values[tower])
                    y = round(y0 + (y1 - y0) * p / span)
                    frame[y - 1:y + 2, target[0] - 6:target[0] + 7] = MAGENTA
        elif g.anim_kind == "select":
            a = controls[before.cursor]; b = controls[after.cursor]
            center = (round(a[0] + (b[0] - a[0]) * p / span),
                      round(a[1] + (b[1] - a[1]) * p / span))
            self.disc(frame, center, 7 + wave, BLUE, hollow=True)
        elif g.anim_kind in ("audit", "reject", "success", "loss"):
            self.disc(frame, (32, 31), 7 + p * 3, MOSS if g.anim_kind in ("audit", "success") else RED,
                      hollow=True)
            for index, x in enumerate(self.tower_xs()):
                phase = (p + index) % 4
                self.diamond(frame, (x, 8 + phase), 1 + wave // 2,
                             MOSS if after.values[index] == g.level["target"][index] else RED)
            if g.anim_kind == "loss":
                inset = min(18, p * 3)
                self.line(frame, (4 + inset, 8), (60 - inset, 58), RED, width=2)
                self.line(frame, (60 - inset, 8), (4 + inset, 58), OXBLOOD, width=2)
        else:
            center = controls[before.cursor]
            offset = (-2, 2, -1, 1, 0)[min(p, 4)]
            self.disc(frame, (center[0] + offset, center[1]), 8, RED,
                      hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        self.ropes(frame, self.game.state)
        self.towers(frame, self.game.state)
        self.instruments(frame, self.game.state)
        self.animation(frame)
        return frame


class G507(ARCBaseGame):
    def __init__(self):
        self.display = G507B(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_total = self.anim_left = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level),
                        name=level["name"]) for level in LEVELS]
        super().__init__("g507", levels,
                         Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_total = self.anim_left = self.anim_progress = 0
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
        self.anim_total = self.anim_left = self.anim_progress = 0
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
        elif aid in LEVER_ACTIONS:
            kind = "slack" if after.values == before.values else "pull"
            frames, terminal = 7, None
        elif aid in (3, 4):
            kind, frames, terminal = "select", 6, None
        elif aid == 5 and after.strikes > before.strikes:
            kind, frames, terminal = "reject", 6, None
        else:
            kind, frames, terminal = "audit", 6, None
        self.begin(kind, frames, after, budget, terminal)


if __name__ == "__main__":
    for configured in LEVELS:
        result, left = execute(configured, configured["witness"])
        assert solved(configured, result) and left == 0
    print("q022-v2 ok")
