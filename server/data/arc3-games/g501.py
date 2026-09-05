# ARC-AGI-3 candidate task g501.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


SOOT, ASH, IRON, OXIDE, BRONZE, INK = 5, 4, 3, 13, 12, 2
MAGENTA, ROSE, RED, COBALT, GLASS, AMBER = 6, 7, 8, 9, 10, 11
BRASS, BURGUNDY, VERDIGRIS, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
TERMINAL_INDEX = 7


def turbine(center, route, steps, memory=4):
    route = tuple(tuple(point) for point in route)
    steps = tuple((int(program), int(phase)) for program, phase in steps)
    assert len(route) == len(steps) + 1
    return {
        "center": tuple(center),
        "route": route,
        "steps": steps,
        "memory": int(memory),
    }


def foundry(name, turbines, phase_mod, budget, witness):
    return {
        "name": name,
        "turbines": tuple(deepcopy(turbines)),
        "phase_mod": int(phase_mod),
        "budget": int(budget),
        "witness": tuple(witness),
    }


LEVELS = (
    foundry(
        "Spark Register",
        (turbine((15, 18), ((21, 23), (29, 27), (38, 23)),
                 ((1, -1), (1, -1))),),
        1, 4, (1, (6, 0), 5, 5),
    ),
    foundry(
        "Glass Return",
        (turbine((49, 18),
                 ((43, 23), (36, 27), (29, 24), (22, 29), (16, 24)),
                 ((1, -1), (2, -1), (3, -1), (4, -1))),),
        1, 15,
        (1, (6, 0), 5,
         (6, 0), 2, (6, 0), 5,
         (6, 0), 3, (6, 0), 5,
         (6, 0), 4, (6, 0), 5),
    ),
    foundry(
        "Phase Escapement",
        (
            turbine((16, 17), ((20, 23), (27, 27), (34, 24)),
                    ((1, 0), (3, 0))),
            turbine((48, 18), ((44, 24), (37, 30)), ((2, 1),)),
        ),
        2, 10,
        (1, (6, 0), 2, (6, 1), 5, 5, (6, 0), 3, (6, 0), 5),
    ),
    foundry(
        "Split Vanes",
        (
            turbine((14, 20), ((20, 24), (27, 27), (34, 25), (40, 29)),
                    ((1, -1), (2, -1), (3, -1))),
            turbine((50, 20), ((44, 24), (37, 27), (30, 25), (24, 29)),
                    ((4, -1), (3, -1), (2, -1))),
        ),
        1, 19,
        (1, (6, 0), 4, (6, 1), 5,
         (6, 0), 2, (6, 0), (6, 1), 3, (6, 1), 5,
         (6, 0), 3, (6, 0), (6, 1), 2, (6, 1), 5),
    ),
    foundry(
        "Three-Bell Route",
        (
            turbine((15, 17), ((20, 23), (28, 25), (34, 30)),
                    ((1, 0), (3, 2))),
            turbine((49, 18), ((44, 24), (37, 28), (31, 34)),
                    ((2, 1), (4, 0))),
        ),
        3, 14,
        (1, (6, 0), 2, (6, 1), 5, 5,
         (6, 0), 3, (6, 0), 5,
         (6, 1), 4, (6, 1), 5),
    ),
    foundry(
        "Cooling Latches",
        (
            turbine((32, 12), ((32, 19), (28, 25)), ((1, 0),)),
            turbine((50, 34), ((43, 33), (37, 29), (31, 33)),
                    ((2, 0), (2, 1))),
            turbine((15, 40), ((21, 38), (27, 34), (34, 39), (40, 43)),
                    ((3, 1), (4, 0), (4, 1))),
        ),
        2, 13,
        (1, (6, 0), 2, (6, 1), 3, (6, 2), 5, 5,
         (6, 2), 4, (6, 2), 5, 5),
    ),
    foundry(
        "Sextant Choir",
        (
            turbine((32, 11), ((32, 18), (27, 23), (23, 29)),
                    ((1, 0), (4, 0))),
            turbine((51, 36), ((44, 34), (38, 29), (32, 33)),
                    ((2, 1), (1, 1))),
            turbine((13, 38), ((20, 36), (26, 32), (32, 38)),
                    ((3, 2), (2, 2))),
        ),
        3, 21,
        (1, (6, 0), 2, (6, 1), 3, (6, 2), 5, 5, 5,
         (6, 0), 4, (6, 0),
         (6, 1), 1, (6, 1),
         (6, 2), 2, (6, 2), 5, 5, 5),
    ),
    foundry(
        "Afterimage Foundry",
        (
            turbine((32, 10), ((32, 17), (27, 22), (23, 28)),
                    ((1, 0), (4, 0))),
            turbine((53, 29), ((46, 29), (40, 24), (34, 28)),
                    ((2, 0), (1, 0))),
            turbine((35, 52), ((34, 45), (40, 39), (36, 33)),
                    ((3, 1), (2, 2))),
            turbine((11, 34), ((18, 34), (24, 39), (29, 34)),
                    ((4, 1), (3, 2))),
        ),
        3, 24,
        (1, (6, 0), 2, (6, 1), 3, (6, 2), 4, (6, 3), 5, 5,
         (6, 2), 2, (6, 2),
         (6, 3), 3, (6, 3), 5,
         (6, 0), 4, (6, 0),
         (6, 1), 1, (6, 1), 5),
    ),
)


def parse_action(action):
    if isinstance(action, (tuple, list)):
        return int(action[0]), int(action[1]) if len(action) > 1 else None
    return int(action), None


def action_tokens(level):
    return (1, 2, 3, 4, 5) + tuple(
        (6, index) for index in range(len(level["turbines"])))


def encode_action(level, action):
    aid, target = parse_action(action)
    if aid == 6 and target is not None:
        x, y = level["turbines"][target]["center"]
        return (6, x, y)
    return (aid,)


def start_state(level):
    memories = tuple(item["memory"] for item in level["turbines"])
    return (tuple(0 for _ in level["turbines"]), memories,
            0, 0, 0, 0, 0, ACTIVE)


def solved(level, state):
    complete = (1 << len(level["turbines"])) - 1
    return state[TERMINAL_INDEX] == WIN and state[4] == complete


def transition(level, state, action):
    if state[TERMINAL_INDEX]:
        return state
    aid, target = parse_action(action)
    if aid not in (1, 2, 3, 4, 5, 6):
        return state
    progress, memories, closed, phase, latched, strikes, _moved, _terminal = state
    complete_mask = (1 << len(level["turbines"])) - 1

    if aid in (1, 2, 3, 4):
        updated = list(memories)
        for index in range(len(updated)):
            bit = 1 << index
            if not closed & bit and not latched & bit:
                updated[index] = aid
        updated = tuple(updated)
        if updated == memories:
            return state
        return progress, updated, closed, phase, latched, strikes, 0, ACTIVE

    if aid == 6:
        if target is None or not 0 <= target < len(level["turbines"]):
            return state
        bit = 1 << target
        if latched & bit:
            return state
        return (progress, memories, closed ^ bit, phase, latched,
                strikes, 0, ACTIVE)

    next_progress = list(progress)
    moved = 0
    next_latched = latched
    for index, item in enumerate(level["turbines"]):
        bit = 1 << index
        if not closed & bit or latched & bit:
            continue
        position = progress[index]
        if position >= len(item["steps"]):
            continue
        required_program, required_phase = item["steps"][position]
        phase_ready = required_phase < 0 or required_phase == phase
        if memories[index] == required_program and phase_ready:
            next_progress[index] += 1
            moved |= bit
            if next_progress[index] == len(item["steps"]):
                next_latched |= bit

    if not moved:
        next_strikes = strikes + 1
        return (progress, memories, closed, phase, latched, next_strikes, 0,
                LOSS if next_strikes >= 2 else ACTIVE)

    next_phase = (phase + 1) % level["phase_mod"]
    terminal = WIN if next_latched == complete_mask else ACTIVE
    return (tuple(next_progress), memories, closed, next_phase,
            next_latched, strikes, moved, terminal)


def action_cost(before, after):
    if after == before:
        return 0
    if after[5] > before[5]:
        return 0
    return 1


def execute(level, actions):
    state = start_state(level)
    budget = level["budget"]
    for action in actions:
        after = transition(level, state, action)
        budget -= action_cost(state, after)
        state = after
    return state, budget


for _level in LEVELS:
    _state, _left = execute(_level, _level["witness"])
    assert solved(_level, _state) and _left >= 0, (_level["name"], _state, _left)
assert {parse_action(action)[0] for level in LEVELS
        for action in level["witness"]} == {1, 2, 3, 4, 5, 6}


class G501A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, start, end, color, dotted=False, width=1):
        x0, y0 = start; x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 4 in (1, 2):
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            for offset in range(width):
                if 0 <= x < 64 and 0 <= y + offset < 64:
                    frame[y + offset, x] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center; inner = max(0, radius - 1) ** 2
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
                    frame[y, x] = color

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            reach = radius - abs(dy)
            if 0 <= cy + dy < 64:
                if hollow:
                    if 0 <= cx - reach < 64: frame[cy + dy, cx - reach] = color
                    if 0 <= cx + reach < 64: frame[cy + dy, cx + reach] = color
                else:
                    frame[cy + dy, max(0, cx - reach):min(64, cx + reach + 1)] = color

    def background(self, frame):
        frame[:, :] = SOOT
        for y in range(2, 62, 4):
            for x in range(2 + (y % 7), 63, 7):
                frame[y, x] = ASH if (x + y) % 3 else IRON
        for radius, color in ((27, OXIDE), (22, IRON), (15, VERDIGRIS)):
            self.disc(frame, (32, 31), radius, color, hollow=True)
        for spoke in range(12):
            angle = 2 * math.pi * spoke / 12
            a = (32 + round(12 * math.cos(angle)), 31 + round(12 * math.sin(angle)))
            b = (32 + round(27 * math.cos(angle)), 31 + round(27 * math.sin(angle)))
            self.line(frame, a, b, BRONZE, dotted=True)
        self.disc(frame, (32, 31), 7, INK)
        self.disc(frame, (32, 31), 6, GLASS, hollow=True)
        self.diamond(frame, (32, 31), 3, AMBER, hollow=True)

    def route(self, frame, item, progress, latched):
        points = item["route"]
        for index, (a, b) in enumerate(zip(points, points[1:])):
            color = VERDIGRIS if index < progress else IRON
            self.line(frame, a, b, color, dotted=index >= progress, width=2)
            midpoint = ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)
            program, required_phase = item["steps"][index]
            self.disc(frame, midpoint, 4, SOOT)
            self.disc(frame, midpoint, 4,
                      VERDIGRIS if index < progress else BRASS, hollow=True)
            self.program_glyph(
                frame, midpoint, program,
                VERDIGRIS if index < progress else AMBER)
            phase_center = (midpoint[0], midpoint[1] + 5)
            if required_phase < 0:
                self.disc(frame, phase_center, 1, GLASS, hollow=True)
            else:
                count = required_phase + 1
                for mark in range(count):
                    x = phase_center[0] + mark * 2 - (count - 1)
                    self.diamond(frame, (x, phase_center[1]), 1, VIOLET)
        self.diamond(frame, points[-1], 4, VERDIGRIS if latched else GLASS,
                     hollow=True)

    def program_glyph(self, frame, center, program, color):
        x, y = center
        if program == 1:
            self.line(frame, (x, y + 3), (x, y - 3), color, width=2)
            self.line(frame, (x - 2, y - 1), (x, y - 3), color)
            self.line(frame, (x + 2, y - 1), (x, y - 3), color)
        elif program == 2:
            self.line(frame, (x, y - 3), (x, y + 3), color, width=2)
            self.line(frame, (x - 2, y + 1), (x, y + 3), color)
            self.line(frame, (x + 2, y + 1), (x, y + 3), color)
        elif program == 3:
            self.line(frame, (x + 3, y), (x - 3, y), color, width=2)
            self.line(frame, (x - 1, y - 2), (x - 3, y), color)
            self.line(frame, (x - 1, y + 2), (x - 3, y), color)
        else:
            self.line(frame, (x - 3, y), (x + 3, y), color, width=2)
            self.line(frame, (x + 1, y - 2), (x + 3, y), color)
            self.line(frame, (x + 1, y + 2), (x + 3, y), color)

    def turbine(self, frame, item, index, state, center=None):
        center = center or item["center"]
        bit = 1 << index
        closed = bool(state[2] & bit); latched = bool(state[4] & bit)
        self.disc(frame, center, 7, OXIDE)
        self.disc(frame, center, 6, BRASS if not closed else BRONZE, hollow=True)
        if latched:
            self.disc(frame, center, 5, VERDIGRIS, hollow=True)
            self.diamond(frame, center, 3, GLASS, hollow=True)
        elif closed:
            self.disc(frame, center, 5, INK)
            self.line(frame, (center[0] - 4, center[1] - 4),
                      (center[0] + 4, center[1] + 4), BRONZE, width=2)
            self.line(frame, (center[0] + 4, center[1] - 4),
                      (center[0] - 4, center[1] + 4), BRONZE, width=2)
        else:
            self.disc(frame, center, 4, GLASS, hollow=True)
            self.program_glyph(frame, center, state[1][index], AMBER)

    def capsule(self, frame, item, progress, color=GLASS, center=None):
        center = center or item["route"][progress]
        self.diamond(frame, center, 3, color)
        self.disc(frame, center, 1, SOOT)

    def instruments(self, frame, state):
        for index in range(self.game.budget_max):
            x = 7 + (index % 12) * 4
            y = 58 + 3 * (index // 12)
            live = index < self.game.budget_left
            self.disc(frame, (x, y), 1, BRASS if live else IRON,
                      hollow=not live)
            if index % 4 == 3:
                self.line(frame, (x + 2, y - 2), (x + 2, y + 2), OXIDE)
        for phase in range(self.game.level["phase_mod"]):
            angle = 2 * math.pi * phase / self.game.level["phase_mod"] - math.pi / 2
            center = (32 + round(10 * math.cos(angle)),
                      31 + round(10 * math.sin(angle)))
            self.disc(frame, center, 2, VIOLET if phase == state[3] else ASH,
                      hollow=phase != state[3])
        for index in range(2):
            center = (57, 8 + index * 7)
            self.disc(frame, center, 3, RED if index < state[5] else VERDIGRIS,
                      hollow=index >= state[5])
            if index < state[5]:
                self.line(frame, (center[0] - 2, center[1]),
                          (center[0] + 2, center[1]), BRASS)

    def animation(self, frame, state):
        g = self.game
        if not g.anim_kind:
            if state[TERMINAL_INDEX] == LOSS:
                self.line(frame, (5, 8), (59, 54), RED, width=2)
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress; span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        if g.anim_kind == "program":
            for index, item in enumerate(g.level["turbines"]):
                if before[1][index] != after[1][index]:
                    self.disc(frame, item["center"], 8 + wave, AMBER, hollow=True)
                    shown = before[1][index] if p < span // 2 else after[1][index]
                    self.program_glyph(frame, item["center"], shown, GLASS)
        elif g.anim_kind == "toggle":
            changed = before[2] ^ after[2]
            index = max(0, changed.bit_length() - 1)
            center = g.level["turbines"][index]["center"]
            self.disc(frame, center, 8 + wave, BRASS, hollow=True)
            for spoke in range(4):
                angle = 2 * math.pi * spoke / 4 + p * math.pi / 8
                end = (center[0] + round((3 + wave) * math.cos(angle)),
                       center[1] + round((3 + wave) * math.sin(angle)))
                self.line(frame, center, end, OXIDE, width=2)
        elif g.anim_kind == "pulse":
            self.disc(frame, (32, 31), 8 + p * 4, VIOLET, hollow=True)
            for index, item in enumerate(g.level["turbines"]):
                if not after[6] & (1 << index):
                    continue
                a = item["route"][before[0][index]]
                b = item["route"][after[0][index]]
                center = (a[0] + (b[0] - a[0]) * p // span,
                          a[1] + (b[1] - a[1]) * p // span - wave // 2)
                self.capsule(frame, item, before[0][index], BRASS, center)
        elif g.anim_kind == "reject":
            offset = (-2, 2, -1, 1, 0, 1, 0)[min(p, 6)]
            self.disc(frame, (32 + offset, 31), 8 + wave, RED, hollow=True)
        elif g.anim_kind == "success":
            self.disc(frame, (32, 31), 8 + p * 4, VERDIGRIS, hollow=True)
            for index in range(8):
                angle = 2 * math.pi * index / 8
                center = (32 + round((8 + p) * math.cos(angle)),
                          31 + round((8 + p) * math.sin(angle)))
                self.diamond(frame, center, 1, BRASS)
        elif g.anim_kind == "loss":
            inset = p * 3
            self.line(frame, (4 + inset, 5), (60 - inset, 57), RED, width=2)
            self.line(frame, (60 - inset, 5), (4 + inset, 57), BURGUNDY,
                      width=2)
        else:
            self.disc(frame, (32, 31), 7 + wave, ASH, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        state = self.game.state
        self.background(frame)
        for index, item in enumerate(self.game.level["turbines"]):
            self.route(frame, item, state[0][index], bool(state[4] & (1 << index)))
        for index, item in enumerate(self.game.level["turbines"]):
            self.turbine(frame, item, index, state)
            self.capsule(frame, item, state[0][index],
                         VERDIGRIS if state[4] & (1 << index) else GLASS)
        self.instruments(frame, state)
        self.animation(frame, state)
        return frame


class G501(ARCBaseGame):
    def __init__(self):
        self.display = G501A(self)
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
        super().__init__("q002", levels,
                         Camera(0, 0, 64, 64, SOOT, SOOT, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

    def snap_turbine(self, x, y):
        distances = [
            ((x - item["center"][0]) ** 2 + (y - item["center"][1]) ** 2,
             index)
            for index, item in enumerate(self.level["turbines"])
        ]
        distance, index = min(distances)
        return index if distance <= 10 ** 2 else None

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
        token = aid
        if aid == 6:
            target = self.snap_turbine(
                int(self.action.data.get("x", -99)),
                int(self.action.data.get("y", -99)),
            )
            token = aid if target is None else (aid, target)
        before = self.state
        after = transition(self.level, before, token)
        if after == before:
            self.begin("blocked", 6, before, self.budget_left)
            return
        cost = action_cost(before, after)
        budget = self.budget_left - cost
        won = after[TERMINAL_INDEX] == WIN
        lost = after[TERMINAL_INDEX] == LOSS or (budget <= 0 and not won)
        if lost and after[TERMINAL_INDEX] != LOSS:
            after = after[:TERMINAL_INDEX] + (LOSS,)
        if won:
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 7, "loss"
        elif after[5] > before[5]:
            kind, frames, terminal = "reject", 6, None
        elif aid in (1, 2, 3, 4):
            kind, frames, terminal = "program", 6, None
        elif aid == 5:
            kind, frames, terminal = "pulse", 8, None
        else:
            kind, frames, terminal = "toggle", 7, None
        self.begin(kind, frames, after, budget, terminal)
