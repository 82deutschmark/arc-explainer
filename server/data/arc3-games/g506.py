# ARC-AGI-3 candidate task g506.

from __future__ import annotations

from copy import deepcopy
from functools import lru_cache
from itertools import permutations

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


LEVELS = [
    {"name": "First Ray", "masks": ((0b1,),), "initial": 0, "target": 0b1, "outputs": 1, "probes": 2, "isolate": False, "delayed": False, "solution_steps": 1, "required_modes": 1, "budget": 8},
    {"name": "Two Channels", "masks": ((0b01, 0b10, 0b00, 0b00, 0b00),), "initial": 0, "target": 0b11, "outputs": 2, "probes": 3, "isolate": True, "delayed": False, "solution_steps": 2, "evidence_steps": 3, "required_modes": 1, "budget": 13},
    {"name": "Shared Glass", "masks": ((0b011, 0b110, 0b111, 0b000, 0b000),), "initial": 0, "target": 0b101, "outputs": 3, "probes": 4, "isolate": True, "delayed": False, "solution_steps": 2, "evidence_steps": 3, "required_modes": 1, "budget": 13},
    {"name": "Violet Lens", "masks": ((0b001, 0b110, 0b101), (0b100, 0b011, 0b110)), "initial": 0, "target": 0b111, "outputs": 3, "probes": 5, "isolate": True, "delayed": False, "solution_steps": 2, "required_modes": 2, "budget": 12},
    {"name": "Charged Baseline", "masks": ((0b0011, 0b0110, 0b1100), (0b1001, 0b0101, 0b1010)), "initial": 0b1111, "target": 0b0101, "outputs": 4, "probes": 6, "isolate": True, "delayed": False, "solution_steps": 3, "required_modes": 2, "budget": 14},
    {"name": "Echo Socket", "masks": ((0b0011, 0b0110, 0b1100),), "initial": 0, "target": 0b1111, "outputs": 4, "probes": 5, "isolate": True, "delayed": True, "solution_steps": 2, "required_modes": 1, "budget": 10},
    {"name": "Double Refraction", "masks": ((0b00011, 0b01100, 0b10101, 0b11010), (0b10001, 0b00110, 0b01011, 0b11100)), "initial": 0b00101, "target": 0b10011, "outputs": 5, "probes": 7, "isolate": True, "delayed": True, "solution_steps": 3, "required_modes": 2, "budget": 14},
    {"name": "Glass Relay", "masks": ((0b00101, 0b01011, 0b10110, 0b11100), (0b10010, 0b01101, 0b11001, 0b00111)), "initial": 0b10001, "target": 0b01110, "outputs": 5, "probes": 8, "isolate": True, "delayed": True, "solution_steps": 3, "required_modes": 2, "budget": 14},
]


def lever_count(level):
    return len(level["masks"][0])


def start_state(level):
    return 0, 0, level["initial"], level["initial"], level["probes"], 0, 0, 0, 0, 2, 0


def decode_pending(level, code):
    value = code - 1
    return value // lever_count(level), value % lever_count(level)


def rotate_apertures(value, outputs):
    mask = (1 << outputs) - 1
    return ((value << 1) & mask) | ((value >> (outputs - 1)) & 1)


def delayed_apply(level, value, operator):
    return rotate_apertures(value, level["outputs"]) ^ operator


def _seen_operators(level, seen0, seen1):
    found = []
    for mode, seen in enumerate((seen0, seen1)):
        if mode >= len(level["masks"]):
            continue
        for cursor, operator in enumerate(level["masks"][mode]):
            if seen & (1 << cursor):
                found.append((mode, cursor, operator))
    return tuple(found)


@lru_cache(None)
def _evidence_search(masks, initial, target, outputs, delayed, steps, required_modes, seen0, seen1):
    level = {"masks": masks, "outputs": outputs}
    operators = _seen_operators(level, seen0, seen1)
    if len(operators) < steps:
        return False
    required = (1 << required_modes) - 1
    for sequence in permutations(operators, steps):
        modes = 0
        value = initial
        for mode, _cursor, operator in sequence:
            modes |= 1 << mode
            value = delayed_apply(level, value, operator) if delayed else value ^ operator
        if modes & required == required and value == target:
            return True
    return False


def evidence_sufficient(level, seen0, seen1):
    masks = tuple(tuple(family) for family in level["masks"])
    return _evidence_search(
        masks, level["initial"], level["target"], level["outputs"],
        level["delayed"], level.get("evidence_steps", level["solution_steps"]),
        level["required_modes"], seen0, seen1,
    )


def _mark_seen(level, code, seen0, seen1):
    mode, cursor = decode_pending(level, code)
    if mode == 0:
        seen0 |= 1 << cursor
    else:
        seen1 |= 1 << cursor
    return seen0, seen1


def transition(level, state, action):
    stage, cursor, test, live, probes, mode, pending, seen0, seen1, chances, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    count = lever_count(level)
    modes = len(level["masks"])

    if level["delayed"] and pending and action != 3:
        old_mode, old_cursor = decode_pending(level, pending)
        operator = level["masks"][old_mode][old_cursor]
        if stage == 0:
            test = delayed_apply(level, test, operator)
            seen0, seen1 = _mark_seen(level, pending, seen0, seen1)
        else:
            live = delayed_apply(level, live, operator)
        pending = 0

    if action == 1:
        return stage, (cursor - 1) % count, test, live, probes, mode, pending, seen0, seen1, chances, terminal
    if action == 2:
        return stage, (cursor + 1) % count, test, live, probes, mode, pending, seen0, seen1, chances, terminal
    if action == 6:
        if modes < 2:
            return stage, cursor, test, live, probes, mode, pending, seen0, seen1, chances, terminal
        return stage, cursor, test, live, probes, 1 - mode, pending, seen0, seen1, chances, terminal
    if action == 4:
        baseline = level["initial"]
        if stage == 0:
            return stage, cursor, baseline, live, probes, mode, 0, seen0, seen1, chances, terminal
        return stage, cursor, test, baseline, probes, mode, 0, seen0, seen1, chances, terminal
    if action == 3:
        if stage == 0:
            if probes <= 0 or (level["isolate"] and test != level["initial"]):
                return state
            if level["delayed"]:
                if pending:
                    old_mode, old_cursor = decode_pending(level, pending)
                    operator = level["masks"][old_mode][old_cursor]
                    test = delayed_apply(level, test, operator)
                    seen0, seen1 = _mark_seen(level, pending, seen0, seen1)
                pending = 1 + mode * count + cursor
            else:
                test ^= level["masks"][mode][cursor]
                if mode == 0:
                    seen0 |= 1 << cursor
                else:
                    seen1 |= 1 << cursor
            return stage, cursor, test, live, probes - 1, mode, pending, seen0, seen1, chances, terminal
        if level["delayed"]:
            if pending:
                old_mode, old_cursor = decode_pending(level, pending)
                live = delayed_apply(level, live, level["masks"][old_mode][old_cursor])
            pending = 1 + mode * count + cursor
        else:
            live ^= level["masks"][mode][cursor]
        return stage, cursor, test, live, probes, mode, pending, seen0, seen1, chances, terminal

    if stage == 0:
        if not evidence_sufficient(level, seen0, seen1):
            return stage, cursor, test, live, probes, mode, pending, seen0, seen1, chances, terminal
        return 1, cursor, test, level["initial"], probes, 0, 0, seen0, seen1, chances, terminal
    if live == level["target"]:
        terminal = 2
    else:
        chances -= 1
        if chances <= 0:
            terminal = 3
    return stage, cursor, test, live, probes, mode, pending, seen0, seen1, chances, terminal


def action_cost(state, after):
    if after == state:
        return 0
    if state[0] == 1 and after[9] < state[9]:
        return 0
    return 1


def solved(_level, state):
    return state[-1] == 2


class G506A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    @staticmethod
    def line(frame, a, b, color, dotted=False, thick=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 4 in (1, 2):
                continue
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color
                if thick and 0 <= y + 1 < 64:
                    frame[y + 1, x] = color

    def background(self, frame):
        frame[:, :] = INK
        for y in range(2, 63, 6):
            frame[y:y + 2, 3 + y % 4:62:8] = CHARCOAL
        for x in range(5, 63, 10):
            frame[3 + x % 5:61:12, x:x + 2] = SLATE
        self.disc(frame, (32, 29), 31, SLATE, hollow=True)
        self.disc(frame, (32, 29), 27, CHARCOAL, hollow=True)

    def lever_center(self, index):
        count = lever_count(self.game.level)
        return 9 + index * (46 // max(1, count - 1)), 49

    def lamp_center(self, index, live=False):
        count = self.game.level["outputs"]
        return 9 + index * (46 // max(1, count - 1)), 29 if live else 13

    def lamp(self, frame, center, index, active, target=False):
        x, y = center
        color = AQUA if active else ASH
        if index % 4 == 0:
            self.disc(frame, center, 5, color, hollow=not active)
        elif index % 4 == 1:
            self.line(frame, (x, y - 5), (x + 5, y), color, thick=True)
            self.line(frame, (x + 5, y), (x, y + 5), color, thick=True)
            self.line(frame, (x, y + 5), (x - 5, y), color, thick=True)
            self.line(frame, (x - 5, y), (x, y - 5), color, thick=True)
        elif index % 4 == 2:
            self.line(frame, (x, y - 5), (x + 5, y + 5), color, thick=True)
            self.line(frame, (x + 5, y + 5), (x - 5, y + 5), color, thick=True)
            self.line(frame, (x - 5, y + 5), (x, y - 5), color, thick=True)
        else:
            self.line(frame, (x - 5, y), (x + 5, y), color, thick=True)
            self.line(frame, (x, y - 5), (x, y + 5), color, thick=True)
        if active:
            self.disc(frame, center, 3, PEARL)
        if target:
            self.disc(frame, center, 7, VIOLET, hollow=True)

    def instrument(self, frame):
        g = self.game
        s = g.state
        frame[6:21, 3:61] = CHARCOAL
        frame[22:38, 3:61] = SLATE
        frame[7:9, 5:59] = ASH
        frame[35:37, 5:59] = CHARCOAL
        for index in range(g.level["outputs"]):
            bit = 1 << index
            self.lamp(frame, self.lamp_center(index, False), index, bool(s[2] & bit))
            self.lamp(frame, self.lamp_center(index, True), index, bool(s[3] & bit), bool(g.level["target"] & bit))

        for mode, seen in enumerate((s[7], s[8])):
            if mode >= len(g.level["masks"]):
                continue
            for index in range(lever_count(g.level)):
                if not seen & (1 << index):
                    continue
                operator = g.level["masks"][mode][index]
                source = self.lever_center(index)
                if mode:
                    self.line(frame, (source[0], 41), (source[0] + 2, 43), VIOLET, thick=True)
                    self.line(frame, (source[0] + 2, 43), (source[0] - 2, 43), VIOLET, thick=True)
                    self.line(frame, (source[0] - 2, 43), (source[0], 41), VIOLET, thick=True)
                else:
                    self.disc(frame, (source[0], 42), 2, AQUA, hollow=True)
                for lamp_index in range(g.level["outputs"]):
                    if not operator & (1 << lamp_index):
                        continue
                    destination = self.lamp_center(lamp_index, False)
                    offset = 1 if mode else -1
                    self.line(
                        frame, (source[0] + offset, source[1]),
                        (destination[0] + offset, destination[1]),
                        VIOLET if mode else AQUA, dotted=not mode, thick=True,
                    )
                    if mode:
                        midpoint = ((source[0] + destination[0]) // 2 + 1, (source[1] + destination[1]) // 2)
                        self.disc(frame, midpoint, 1, PEARL)

        for index in range(lever_count(g.level)):
            x, y = self.lever_center(index)
            selected = index == s[1]
            self.disc(frame, (x, y), 6, PEARL if selected else SLATE, hollow=not selected)
            tip = (x + 4, y - 4) if s[5] else (x - 3, y - 5)
            self.line(frame, (x, y + 2), tip, VIOLET if s[5] else AQUA, thick=True)
            if selected:
                self.disc(frame, (x, y), 8, AQUA if not s[5] else VIOLET, hollow=True)

        if s[6]:
            pending_mode, pending_cursor = decode_pending(g.level, s[6])
            x, y = self.lever_center(pending_cursor)
            if pending_mode:
                self.line(frame, (x, y - 15), (x + 5, y - 10), VIOLET, thick=True)
                self.line(frame, (x + 5, y - 10), (x, y - 5), VIOLET, thick=True)
                self.line(frame, (x, y - 5), (x - 5, y - 10), VIOLET, thick=True)
                self.line(frame, (x - 5, y - 10), (x, y - 15), VIOLET, thick=True)
            else:
                self.disc(frame, (x, y - 10), 5, AQUA, hollow=True)
            self.disc(frame, (x, y - 10), 2, PEARL)

        if s[5]:
            self.line(frame, (26, 43), (38, 43), VIOLET, thick=True)
            self.line(frame, (38, 43), (32, 37), VIOLET, thick=True)
            self.line(frame, (32, 37), (26, 43), VIOLET, thick=True)
        else:
            self.line(frame, (26, 37), (38, 37), AQUA, thick=True)
            self.line(frame, (38, 37), (32, 43), AQUA, thick=True)
            self.line(frame, (32, 43), (26, 37), AQUA, thick=True)
        if g.level["delayed"]:
            self.disc(frame, (32, 29), 10, PEARL, hollow=True)
            self.line(frame, (38, 23), (41, 27), AQUA, thick=True)
            self.line(frame, (41, 27), (36, 27), AQUA, thick=True)

    def hud(self, frame):
        g = self.game
        s = g.state
        for index in range(g.level["probes"]):
            group, cell = divmod(index, 4)
            x = 5 + cell * 4 + group * 19
            color = AQUA if index < s[4] else CHARCOAL
            self.disc(frame, (x, 60), 2, color, hollow=index >= s[4])
        for index in range(g.budget_max):
            group, cell = divmod(index, 5)
            x = 1 + cell
            y = 7 + group * 4
            if index < g.budget_left:
                frame[y:y + 2, x:x + 2] = PEARL
            else:
                frame[y, x] = CHARCOAL
            if cell == 4:
                frame[y:y + 2, 7] = SLATE
        for index in range(s[9]):
            self.disc(frame, (56 + index * 5, 60), 3, GOLD, hollow=True)

        if s[0] == 0:
            self.line(frame, (44, 56), (49, 62), GREEN, thick=True)
            self.line(frame, (54, 56), (49, 62), GREEN, thick=True)
        else:
            self.line(frame, (43, 60), (49, 54), RED, thick=True)
            self.line(frame, (49, 54), (55, 60), RED, thick=True)
            self.line(frame, (55, 60), (49, 63), RED, thick=True)
            self.line(frame, (49, 63), (43, 60), RED, thick=True)

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self.disc(frame, self.lever_center(0), 10, AQUA, hollow=True)
            if g.terminal_hold == "loss":
                self.line(frame, (7, 8), (57, 53), RED, thick=True)
                self.line(frame, (57, 8), (7, 53), RED, thick=True)
            return
        progress = g.anim_progress
        total = max(1, g.anim_total)
        before = g.state
        after = g.pending_state
        if g.anim_kind in ("cursor", "lens"):
            self.disc(frame, self.lever_center(after[1]), 7 + progress // 2, VIOLET if after[5] else AQUA, hollow=True)
        elif g.anim_kind in ("probe", "act", "park"):
            source = self.lever_center(before[1])
            if progress <= 2:
                self.disc(frame, source, max(3, 8 - progress * 2), PEARL, hollow=True)
            else:
                destination = (source[0], source[1] - 10)
                fraction = progress - 2
                bead = (source[0], source[1] + (destination[1] - source[1]) * fraction // max(1, total - 2))
                self.disc(frame, bead, 2, AQUA if before[5] == 0 else VIOLET)
        elif g.anim_kind in ("echo", "echo_reset"):
            pending_mode, pending_cursor = decode_pending(g.level, before[6])
            source = (self.lever_center(pending_cursor)[0], 39)
            destination = (32, 13 if before[0] == 0 else 29)
            bead = (
                source[0] + (destination[0] - source[0]) * progress // total,
                source[1] + (destination[1] - source[1]) * progress // total,
            )
            self.line(frame, source, bead, VIOLET if pending_mode else AQUA, dotted=True, thick=True)
            self.disc(frame, bead, 3, PEARL)
            if g.anim_kind == "echo_reset" and progress > total // 2:
                self.disc(frame, (32, 22), 5 + progress * 2, BLUE, hollow=True)
        elif g.anim_kind == "reset":
            for radius in range(5, min(31, 5 + progress * 4), 6):
                self.disc(frame, (32, 22), radius, BLUE, hollow=True)
        elif g.anim_kind == "seal":
            left = max(5, 32 - progress * 5)
            right = min(59, 32 + progress * 5)
            frame[18:39, left:right] = SLATE
            self.disc(frame, (32, 29), 5 + progress * 2, VIOLET, hollow=True)
        elif g.anim_kind == "recoil":
            y = 24 + progress
            frame[y:y + 2, 10 + progress:54 - progress] = RED
            self.disc(frame, (32, 29), 6 + progress, RED, hollow=True)
        elif g.anim_kind == "success":
            if before[6]:
                _mode, pending_cursor = decode_pending(g.level, before[6])
                source = (self.lever_center(pending_cursor)[0], 39)
                self.line(frame, source, (32, 29), AQUA, dotted=True, thick=True)
            for radius in range(6, min(32, 6 + progress * 4), 6):
                self.disc(frame, (32, 29), radius, AQUA, hollow=True)
        elif g.anim_kind == "loss":
            self.line(frame, (7 + progress, 8), (57 - progress, 53), RED, thick=True)
            self.line(frame, (57 - progress, 8), (7 + progress, 53), RED, thick=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        self.instrument(frame)
        self.hud(frame)
        self.animation(frame)
        return frame


class G506(ARCBaseGame):
    def __init__(self):
        self.display = G506A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("q021", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]), False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def begin(self, kind, frames, state, budget, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = state
        self.pending_budget = budget
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.budget_left = self.pending_budget
        self.anim_kind = None
        self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win":
            self.terminal_hold = "win"
            self.next_level()
        elif terminal == "loss":
            self.terminal_hold = "loss"
            self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1
            self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0:
                self.finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        if after == self.state:
            self.begin("recoil", 5, after, self.budget_left)
            return
        budget = self.budget_left - action_cost(self.state, after)
        won = after[-1] == 2
        lost = after[-1] == 3 or (budget <= 0 and not won)
        launched_echo = bool(self.level["delayed"] and self.state[6] and (
            after[2] != self.state[2] or after[3] != self.state[3]
        ))
        if won:
            kind = "success"
        elif lost:
            kind = "loss"
        elif after[9] < self.state[9]:
            kind = "recoil"
        elif after[0] != self.state[0]:
            kind = "seal"
        elif launched_echo and action == 4:
            kind = "echo_reset"
        elif launched_echo:
            kind = "echo"
        elif after[5] != self.state[5]:
            kind = "lens"
        elif after[1] != self.state[1]:
            kind = "cursor"
        elif action == 4:
            kind = "reset"
        elif action == 3 and self.level["delayed"]:
            kind = "park"
        elif action == 3:
            kind = "probe" if self.state[0] == 0 else "act"
        else:
            kind = "seal"
        frames = 7 if kind in ("success", "loss", "seal") else 6
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
