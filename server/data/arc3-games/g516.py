# ARC-AGI-3 candidate task g516.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PAPER, STEEL, IRON, COAL, VOID = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, CYAN, AMBER = 6, 7, 8, 9, 10, 11
COPPER, CRIMSON, VERDIGRIS, VIOLET = 12, 13, 14, 15

EMPTY, CAM_A, CAM_B, DELAY, FEEDBACK = 0, 1, 2, 3, 4
TICK_DELAY, TICK_A, TICK_B, TICK_EMPTY = 0, 1, 2, 3
ACTIVE, WIN, LOSS = 0, 2, 3
TERMINAL_INDEX = 4
SNAP_RADIUS = 8
POINTER_ACTION = 6


def run_sequence(program):
    trace = []
    previous = TICK_A
    for part in program:
        if part == CAM_A:
            previous = TICK_A
            trace.append(TICK_A)
        elif part == CAM_B:
            previous = TICK_B
            trace.append(TICK_B)
        elif part == DELAY:
            trace.append(TICK_DELAY)
        elif part == FEEDBACK:
            trace.extend((previous, previous))
        else:
            trace.append(TICK_EMPTY)
    return tuple(trace)


def works(name, sockets, target_program, start, budget, witness,
          pointer_only=()):
    sockets = tuple(tuple(point) for point in sockets)
    target_program = tuple(int(part) for part in target_program)
    pointer_mask = sum(1 << int(index) for index in pointer_only)
    assert len(sockets) == len(target_program)
    assert 0 <= start < len(sockets)
    assert not pointer_mask & (1 << start)
    return {
        "name": name,
        "sockets": sockets,
        "target_program": target_program,
        "target": run_sequence(target_program),
        "required_delays": target_program.count(DELAY),
        "start": int(start),
        "budget": int(budget),
        "witness": tuple(witness),
        "pointer_only": pointer_mask,
    }


LEVELS = (
    works(
        "Twin Dies",
        ((23, 27), (41, 32)),
        (CAM_A, CAM_B), 0, 5,
        (1, 4, 1, 1, 5),
    ),
    works(
        "Quiet Tooth",
        ((18, 22), (32, 17), (45, 27), (36, 41)),
        (CAM_B, CAM_A, DELAY, CAM_B), 1, 12,
        (1, 3, 1, 1, 4, 4, 2, 2, 4, 1, 1, 5),
    ),
    works(
        "Echo Pawl",
        ((19, 19), (36, 16), (47, 31), (31, 43)),
        (CAM_A, FEEDBACK, DELAY, CAM_B), 0, 10,
        (1, 4, 2, 4, 2, 2, 4, 1, 1, 5),
    ),
    works(
        "Spiral Register",
        ((15, 27), (24, 15), (40, 17), (48, 31), (34, 43)),
        (CAM_B, DELAY, CAM_A, FEEDBACK, CAM_B), 2, 15,
        (1, 3, 2, 2, 3, 1, 1, 4, 4, 4, 2, 4, 1, 1, 5),
    ),
    works(
        "Waxed Echo",
        ((15, 26), (24, 14), (41, 16), (49, 31), (34, 44)),
        (CAM_A, DELAY, CAM_B, FEEDBACK, CAM_A), 0, 12,
        (1, (6, 1), 2, 2, (6, 2), 1, 1,
         (6, 3), 2, (6, 4), 1, 5),
        pointer_only=(3,),
    ),
    works(
        "Double Seal",
        ((14, 30), (21, 15), (38, 13), (49, 27), (37, 44)),
        (CAM_B, FEEDBACK, DELAY, CAM_A, FEEDBACK), 0, 12,
        (1, 1, (6, 1), 2, 4, 2, 2, 4, 1,
         (6, 4), 2, 5),
        pointer_only=(1, 4),
    ),
    works(
        "Counterweight Choir",
        ((13, 31), (20, 15), (37, 12), (49, 26), (37, 44)),
        (CAM_A, DELAY, FEEDBACK, CAM_B, DELAY), 0, 13,
        (1, 4, 2, 2, (6, 2), 2, 4, 1, 1,
         (6, 4), 2, 2, 5),
        pointer_only=(2, 4),
    ),
    works(
        "Midnight Stampworks",
        ((12, 31), (18, 15), (34, 10), (49, 22), (42, 43)),
        (CAM_B, DELAY, FEEDBACK, CAM_A, DELAY), 0, 13,
        (1, 1, (6, 1), 2, 2, (6, 2), 2, (6, 3), 1,
         (6, 4), 2, 2, 5),
        pointer_only=(1, 3, 4),
    ),
)


def parse_action(action):
    if isinstance(action, (tuple, list)):
        return int(action[0]), int(action[1]) if len(action) > 1 else None
    return int(action), None


def action_tokens(level):
    return (1, 2, 3, 4, 5) + tuple(
        (POINTER_ACTION, index) for index in range(len(level["sockets"]))
        if level["pointer_only"] & (1 << index))


def encode_action(level, action):
    aid, target = parse_action(action)
    if aid == 6 and target is not None and 0 <= target < len(level["sockets"]):
        x, y = level["sockets"][target]
        return (6, x, y)
    return (aid,)


def start_state(level):
    return (tuple(EMPTY for _ in level["sockets"]), level["start"],
            0, (), ACTIVE)


def _keyboard_targets(level):
    return tuple(index for index in range(len(level["sockets"]))
                 if not level["pointer_only"] & (1 << index))


def _navigate(level, cursor, direction):
    allowed = _keyboard_targets(level)
    if cursor not in allowed:
        lower = tuple(index for index in allowed if index < cursor)
        upper = tuple(index for index in allowed if index > cursor)
        if direction < 0:
            return lower[-1] if lower else allowed[0]
        return upper[0] if upper else allowed[-1]
    position = allowed.index(cursor)
    return allowed[max(0, min(len(allowed) - 1, position + direction))]


def ready(level, state):
    return (EMPTY not in state[0]
            and run_sequence(state[0]) == level["target"])


def transition(level, state, action):
    if state[TERMINAL_INDEX] != ACTIVE:
        return state
    aid, target = parse_action(action)
    program, cursor, strikes, _last_trace, _terminal = state
    if aid in (1, 2):
        updated = list(program)
        delta = 1 if aid == 1 else -1
        updated[cursor] = (updated[cursor] + delta) % 5
        return (tuple(updated), cursor, strikes, (), ACTIVE)
    if aid in (3, 4):
        selected = _navigate(level, cursor, -1 if aid == 3 else 1)
        if selected == cursor:
            return state
        return (program, selected, strikes, (), ACTIVE)
    if aid == 6:
        if target is None or not 0 <= target < len(program) or target == cursor:
            return state
        return (program, target, strikes, (), ACTIVE)
    if aid != 5:
        return state
    trace = run_sequence(program)
    if ready(level, state):
        return (program, cursor, strikes, trace, WIN)
    next_strikes = strikes + 1
    return (program, cursor, next_strikes, trace,
            LOSS if next_strikes >= 2 else ACTIVE)


def action_cost(before, after):
    if after == before:
        return 0
    if after[2] > before[2] or after[TERMINAL_INDEX] == LOSS:
        return 0
    return 1


def solved(level, state):
    return state[TERMINAL_INDEX] == WIN and ready(level, state)


def _behavior_samples(program):
    samples = []
    value = TICK_A
    tick = 0
    for part in program:
        if part == CAM_A:
            value = TICK_A
            samples.append((value, tick)); tick += 1
        elif part == CAM_B:
            value = TICK_B
            samples.append((value, tick)); tick += 1
        elif part == DELAY:
            samples.append((value, tick)); tick += 1
        elif part == FEEDBACK:
            samples.append((value, tick)); tick += 1
            samples.append((value, tick)); tick += 1
        else:
            samples.append((TICK_EMPTY, tick)); tick += 1
    return tuple(samples)


def program_trace(level, plan):
    state = start_state(level)
    for action in plan:
        state = transition(level, state, action)
        if state[TERMINAL_INDEX]:
            break
    return _behavior_samples(state[0])


def _mutant_run(level, state, action, trace):
    aid, _target = parse_action(action)
    if aid != 5 or state[TERMINAL_INDEX] != ACTIVE:
        return transition(level, state, action)
    program, cursor, strikes, _last_trace, _terminal = state
    if EMPTY not in program and trace == level["target"]:
        return (program, cursor, strikes, trace, WIN)
    next_strikes = strikes + 1
    return (program, cursor, next_strikes, trace,
            LOSS if next_strikes >= 2 else ACTIVE)


def without_delays(level, state, action):
    program = state[0]
    trace = tuple(tick for part in program if part != DELAY
                  for tick in run_sequence((part,)))
    return _mutant_run(level, state, action, trace)


def without_autonomy(level, state, action):
    trace = run_sequence(state[0])[:1]
    return _mutant_run(level, state, action, trace)


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
    assert solved(_level, _state) and _left >= 0, (
        _level["name"], _state, _left)
assert {parse_action(action)[0] for level in LEVELS
        for action in level["witness"]} == {1, 2, 3, 4, 5, 6}


class G516A(RenderableUserDisplay):
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
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        mask = d2 <= radius ** 2
        if hollow:
            mask &= d2 >= max(0, radius - 1) ** 2
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

    def background(self, frame):
        frame[:, :] = VOID
        frame[2:62, 2:62] = COAL
        frame[5:60, 5:59] = IRON
        frame[7:58, 7:57] = VOID
        for y in range(9, 56, 4):
            for x in range(9 + (y // 4) % 2, 56, 5):
                frame[y, x] = COAL if (x + y) % 3 else CRIMSON
        self.disc(frame, (32, 29), 24, COAL, hollow=True)
        self.disc(frame, (32, 29), 20, COPPER, hollow=True)
        self.disc(frame, (32, 29), 18, VOID, hollow=True)
        for spoke in range(12):
            angle = 2 * math.pi * spoke / 12
            a = (32 + round(18 * math.cos(angle)),
                 29 + round(18 * math.sin(angle)))
            b = (32 + round(21 * math.cos(angle)),
                 29 + round(21 * math.sin(angle)))
            self.line(frame, a, b, STEEL, width=1)

    def part_glyph(self, frame, center, part, color=None):
        cx, cy = center
        color = color if color is not None else (
            STEEL if part == EMPTY else AMBER if part == CAM_A
            else CYAN if part == CAM_B else PAPER if part == DELAY
            else VIOLET)
        if part == EMPTY:
            self.disc(frame, center, 3, color, hollow=True)
            frame[cy, cx] = VOID
            frame[cy - 2, cx] = frame[cy + 2, cx] = VOID
        elif part == CAM_A:
            self.diamond(frame, center, 4, color)
            self.diamond(frame, center, 1, VOID)
            frame[cy - 4:cy - 2, cx - 1:cx + 2] = COPPER
        elif part == CAM_B:
            self.disc(frame, (cx - 2, cy), 3, color)
            self.disc(frame, (cx + 2, cy), 3, color)
            frame[cy - 1:cy + 2, cx - 4:cx + 5:2] = VOID
        elif part == DELAY:
            self.line(frame, (cx - 3, cy - 4), (cx + 3, cy - 4), color)
            self.line(frame, (cx - 3, cy + 4), (cx + 3, cy + 4), color)
            self.line(frame, (cx - 3, cy - 3), (cx + 3, cy + 3), color)
            self.line(frame, (cx + 3, cy - 3), (cx - 3, cy + 3), color)
            frame[cy, cx] = RED
        else:
            self.disc(frame, center, 4, color, hollow=True)
            self.disc(frame, center, 2, color, hollow=True)
            self.line(frame, (cx, cy), (cx + 4, cy - 2), color)
            frame[cy - 1:cy + 2, cx - 1:cx + 2] = VOID

    def socket(self, frame, index, center, state):
        program, cursor, _strikes, _trace, _terminal = state
        pointer = bool(self.game.level["pointer_only"] & (1 << index))
        self.disc(frame, center, 7, CRIMSON)
        self.disc(frame, center, 6, COAL)
        if pointer:
            self.diamond(frame, center, 8, MAGENTA, hollow=True)
            cx, cy = center
            frame[cy - 6:cy - 4, cx - 1:cx + 2] = ROSE
            frame[cy + 5:cy + 7, cx - 1:cx + 2] = ROSE
        else:
            self.disc(frame, center, 7, COPPER, hollow=True)
        self.part_glyph(frame, center, program[index])
        if index == cursor:
            self.disc(frame, center, 9, WHITE, hollow=True)
            cx, cy = center
            self.diamond(frame, (cx, cy - 9), 1, AMBER)

    def tick_glyph(self, frame, center, tick, target=False):
        cx, cy = center
        edge = PAPER if target else COPPER
        frame[cy - 3:cy + 4, cx - 3:cx + 4] = COAL
        if tick == TICK_DELAY:
            self.diamond(frame, center, 3, edge, hollow=True)
            frame[cy, cx - 2:cx + 3:2] = VOID
        elif tick == TICK_A:
            self.diamond(frame, center, 3, AMBER if not target else WHITE)
            frame[cy, cx] = VOID
        elif tick == TICK_B:
            self.disc(frame, (cx - 1, cy), 2, CYAN if not target else PAPER)
            self.disc(frame, (cx + 2, cy), 2, CYAN if not target else PAPER)
            frame[cy, cx] = VOID
        else:
            self.line(frame, (cx - 3, cy - 3), (cx + 3, cy + 3), RED)
            self.line(frame, (cx + 3, cy - 3), (cx - 3, cy + 3), RED)

    def timeline(self, frame, y, trace, target=False, limit=None):
        count = len(trace) if limit is None else min(len(trace), limit)
        width = max(1, len(trace)) * 7
        x0 = max(4, 32 - width // 2 + 3)
        self.line(frame, (x0 - 3, y),
                  (min(60, x0 + max(0, len(trace) - 1) * 7 + 3), y),
                  STEEL, dotted=not target)
        for index in range(count):
            self.tick_glyph(frame, (x0 + index * 7, y), trace[index], target)

    def instruments(self, frame, state):
        _program, _cursor, strikes, trace, terminal = state
        for bead in range(self.game.budget_max):
            x = 5 + (bead % 18) * 3
            y = 3 + (bead // 18) * 3
            color = COPPER if bead < self.game.budget_left else COAL
            self.diamond(frame, (x, y), 1, color)
        for seal in range(2):
            cx = 58; cy = 11 + seal * 7
            self.disc(frame, (cx, cy), 3, RED if seal < strikes else VERDIGRIS,
                      hollow=seal >= strikes)
            if seal < strikes:
                self.line(frame, (cx - 2, cy - 2), (cx + 2, cy + 2), WHITE)
        self.timeline(frame, 55, self.game.level["target"], target=True)
        if trace:
            self.timeline(frame, 47, trace, target=False)
        if terminal == LOSS:
            self.line(frame, (7, 9), (56, 54), RED, width=2)
            self.line(frame, (56, 9), (7, 54), CRIMSON, width=2)

    def animation(self, frame, state):
        g = self.game
        if not g.anim_kind:
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress
        span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        if g.anim_kind == "edit":
            center = g.level["sockets"][before[1]]
            self.disc(frame, center, 8 + wave, AMBER, hollow=True)
            shown = before[0][before[1]] if p < span // 2 else after[0][after[1]]
            self.part_glyph(frame, center, shown, WHITE)
            angle = p * math.pi / 3
            tip = (center[0] + round(10 * math.cos(angle)),
                   center[1] + round(10 * math.sin(angle)))
            self.line(frame, center, tip, COPPER)
        elif g.anim_kind in ("navigate", "pointer"):
            a = g.level["sockets"][before[1]]
            b = g.level["sockets"][after[1]]
            center = (round(a[0] + (b[0] - a[0]) * p / span),
                      round(a[1] + (b[1] - a[1]) * p / span))
            self.disc(frame, center, 8 + wave, MAGENTA if g.anim_kind == "pointer" else WHITE,
                      hollow=True)
            if g.anim_kind == "pointer":
                self.diamond(frame, center, 2 + wave // 2, ROSE, hollow=True)
        elif g.anim_kind in ("run", "success", "reject", "loss"):
            trace = after[3]
            shown = max(1, min(len(trace), 1 + p * max(1, len(trace)) // (span + 1)))
            self.timeline(frame, 47, trace, target=False, limit=shown)
            index = min(len(trace) - 1, shown - 1) if trace else 0
            width = max(1, len(trace)) * 7
            x0 = max(4, 32 - width // 2 + 3)
            head_x = x0 + index * 7
            self.line(frame, (head_x, 39 - wave), (head_x, 43),
                      VERDIGRIS if g.anim_kind == "success" else RED,
                      width=2)
            self.disc(frame, (32, 29), 6 + p % 4, COPPER, hollow=True)
            if g.anim_kind == "success":
                self.disc(frame, (32, 29), 9 + p * 2, VERDIGRIS, hollow=True)
            elif g.anim_kind == "loss":
                inset = min(16, p * 2)
                self.line(frame, (5 + inset, 8), (59 - inset, 54), RED, width=2)
                self.line(frame, (59 - inset, 8), (5 + inset, 54), CRIMSON, width=2)
            elif g.anim_kind == "reject":
                offset = (-2, 2, -1, 1, 0, 1, 0, 0, 0)[min(p, 8)]
                self.disc(frame, (32 + offset, 29), 10, RED, hollow=True)
        else:
            center = g.level["sockets"][before[1]]
            offset = (-2, 2, -1, 1, 0)[min(p, 4)]
            self.disc(frame, (center[0] + offset, center[1]), 9, RED, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        state = self.game.state
        self.background(frame)
        sockets = self.game.level["sockets"]
        for index in range(len(sockets) - 1):
            self.line(frame, sockets[index], sockets[index + 1], COPPER,
                      dotted=index % 2 == 1, width=1)
        if len(sockets) > 2:
            self.line(frame, sockets[-1], sockets[0], STEEL, dotted=True)
        for index, center in enumerate(sockets):
            self.socket(frame, index, center, state)
        self.instruments(frame, state)
        self.animation(frame, state)
        return frame


class G516(ARCBaseGame):
    def __init__(self):
        self.display = G516A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_total = self.anim_left = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [
            Level(sprites=[], grid_size=(64, 64), data=deepcopy(level),
                  name=level["name"])
            for level in LEVELS
        ]
        super().__init__("g516", levels,
                         Camera(0, 0, 64, 64, VOID, VOID, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_total = self.anim_left = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

    def snap_socket(self, x, y):
        candidates = []
        for index, (sx, sy) in enumerate(self.level["sockets"]):
            if not self.level["pointer_only"] & (1 << index):
                continue
            distance = (sx - x) ** 2 + (sy - y) ** 2
            if distance <= SNAP_RADIUS ** 2:
                candidates.append((distance, index))
        return min(candidates)[1] if candidates else None

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
        token = aid
        if aid == 6:
            target = self.snap_socket(
                int(self.action.data.get("x", -99)),
                int(self.action.data.get("y", -99)),
            )
            token = aid if target is None else (aid, target)
        before = self.state
        after = transition(self.level, before, token)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        cost = action_cost(before, after)
        budget = self.budget_left - cost
        won = after[TERMINAL_INDEX] == WIN
        lost = after[TERMINAL_INDEX] == LOSS or (budget <= 0 and not won)
        if lost and after[TERMINAL_INDEX] != LOSS:
            after = after[:TERMINAL_INDEX] + (LOSS,)
        if won:
            kind, frames, terminal = "success", 6, "win"
        elif lost:
            kind, frames, terminal = "loss", 6, "loss"
        elif aid == 5:
            kind, frames, terminal = "reject", 8, None
        elif aid in (1, 2):
            kind, frames, terminal = "edit", 6, None
        elif aid == 6:
            kind, frames, terminal = "pointer", 6, None
        else:
            kind, frames, terminal = "navigate", 6, None
        self.begin(kind, frames, after, budget, terminal)


if __name__ == "__main__":
    for configured in LEVELS:
        result, left = execute(configured, configured["witness"])
        assert solved(configured, result) and left >= 0
    print("q060-v2 ok")
