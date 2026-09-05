# ARC-AGI-3 candidate task g530.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, CREAM, FIBER, SAGE, MOSS, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, INDIGO, DEW_BLUE, GOLD, CORAL, BARK, LEAF, VIOLET = range(6, 16)
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
FLOWERS = "abcd"
W, H = 7, 5
SCENT_STUDS = (
    (-6, -4), (-3, -7), (0, -8), (3, -7), (6, -4), (8, 0), (6, 4), (3, 7),
    (0, 8), (-3, 7), (-6, 4), (-8, 0), (-5, -6), (5, -6), (5, 6), (-5, 6),
)


PLAIN = ("#######", "#a...b#", "#..S..#", "#c...d#", "#######")
TWINE_STAGE = ("#######", "#a.#.b#", "#..S..#", "#c.#.d#", "#######")
GROVE_STAGE = ("#######", "#a...b#", "##.S.##", "#c...d#", "#######")
ROTOR_STAGE = ("#######", "#a...b#", "#.#S#.#", "#c...d#", "#######")
DEW_STAGE = ("#######", "#a...b#", "#.#S#.#", "#c.r.d#", "#######")
PRISM_STAGE = ("#######", "##a.b##", "#..p..#", "#c.rSd#", "#######")
LEVELS = [
    {"name": "Soft Opening", "grid": PLAIN, "target": "a", "quota": 2, "distinct": 1,
     "echo": (), "fade": False, "guards": 1, "swap": 0, "budget": 7, "night_grace": 8},
    {"name": "Silk Duet", "grid": TWINE_STAGE, "target": "b", "quota": 5, "distinct": 3,
     "echo": (("a", "c"), ("b", "d")), "fade": False, "guards": 1, "swap": 0,
     "budget": 17, "night_grace": 8},
    {"name": "Falling Pollen", "grid": GROVE_STAGE, "target": "c", "quota": 6, "distinct": 3,
     "echo": (("a", "c"), ("b", "d")), "fade": True, "guards": 1, "swap": 0,
     "budget": 19, "night_grace": 8},
    {"name": "Two Velvet Owls", "grid": TWINE_STAGE, "target": "d", "quota": 5, "distinct": 3,
     "echo": (("a", "c"), ("b", "d")), "fade": True, "guards": 2, "swap": 0,
     "budget": 17, "night_grace": 8},
    {"name": "Revolving Beds", "grid": ROTOR_STAGE, "target": "a", "quota": 5, "distinct": 3,
     "echo": (("a", "c"), ("b", "d")), "fade": True, "guards": 2, "swap": 1,
     "budget": 15, "night_grace": 9},
    {"name": "Dew Revision", "grid": DEW_STAGE, "target": "b", "quota": 6, "distinct": 3,
     "dew_required": True, "echo": (("a", "c"), ("b", "d")), "fade": True,
     "guards": 2, "swap": 1, "budget": 18, "night_grace": 9},
    {"name": "Prismatic Gala", "grid": PRISM_STAGE, "target": "c", "quota": 7, "distinct": 4,
     "dew_required": True, "prism_required": True, "echo": (("a", "d"), ("b", "c")),
     "fade": True, "guards": 2, "swap": 2, "budget": 21, "night_grace": 10},
    {"name": "Velvet Moth Masque", "grid": PRISM_STAGE, "target": "d", "quota": 8,
     "distinct": 4, "dew_required": True, "prism_required": True,
     "echo": (("a", "d"), ("b", "c")), "fade": True, "guards": 2, "swap": 3,
     "budget": 24, "night_grace": 10},
]


def locate(grid, char):
    for y, row in enumerate(grid):
        for x, value in enumerate(row):
            if value == char:
                return x, y
    raise ValueError(char)


def start_state(level):
    x, y = locate(level["grid"], "S")
    return 0, x, y, (0, 0, 0, 0), 0, -1, 0, 0, 2, 0, 0, 0, 0, 0, 0


def flower_at(level, state, x, y):
    base = level["grid"][y][x]
    if base not in FLOWERS:
        return None
    if state[0] != 1:
        return base
    slot = FLOWERS.index(base)
    return FLOWERS[(slot - state[6]) % 4]


def echo_partner(level, key):
    for first, second in level["echo"]:
        if key == first:
            return second
        if key == second:
            return first
    return None


def guard_mask(level, attention):
    ranked = sorted(range(4), key=lambda index: (-attention[index], index))
    mask = 0
    for index in ranked[:level["guards"]]:
        mask |= 1 << index
    return mask


def transition(level, state, action):
    (phase, x, y, attention, lessons, last, rotation, protected, chances,
     seen, dew_used, night_steps, prism_used, refusals, terminal) = state
    if terminal or action not in (1, 2, 3, 4, 5):
        return state
    if action == 5:
        ready = (
            phase == 0
            and lessons == level["quota"]
            and seen.bit_count() >= level["distinct"]
            and (not level.get("dew_required") or dew_used)
            and (not level.get("prism_required") or prism_used)
        )
        if not ready:
            refusals += 1
            return (phase, x, y, attention, lessons, last, rotation, protected,
                    chances, seen, dew_used, night_steps, prism_used, refusals,
                    3 if refusals >= 3 else 0)
        protected = guard_mask(level, attention)
        sx, sy = locate(level["grid"], "S")
        return (1, sx, sy, attention, lessons, last, level["swap"], protected,
                chances, seen, dew_used, level["night_grace"], prism_used, 0, 0)

    dx, dy = DIRS[action]
    nx, ny = x + dx, y + dy
    if not (0 <= nx < W and 0 <= ny < H) or level["grid"][ny][nx] == "#":
        refusals += 1
        return (phase, x, y, attention, lessons, last, rotation, protected,
                chances, seen, dew_used, night_steps, prism_used, refusals,
                3 if refusals >= 3 else 0)
    key = flower_at(level, state, nx, ny)
    if phase == 0:
        values = list(attention)
        cell = level["grid"][ny][nx]
        if cell == "r" and last >= 0 and not dew_used and values[last] > 0:
            values[last] = max(0, values[last] - 2)
            dew_used = 1
        elif cell == "p" and last >= 0 and not prism_used:
            values[(last + 2) % 4] += 1
            prism_used = 1
        elif key is not None and lessons < level["quota"]:
            if level["fade"]:
                values = [max(0, value - 1) for value in values]
            index = FLOWERS.index(key)
            values[index] += 2 if level["fade"] else 1
            partner = echo_partner(level, key)
            if partner is not None:
                values[FLOWERS.index(partner)] += 1
            lessons += 1
            last = index
            seen |= 1 << index
        return (phase, nx, ny, tuple(values), lessons, last, rotation, protected,
                chances, seen, dew_used, night_steps, prism_used, 0, terminal)

    night_steps = max(0, night_steps - 1)
    if key is None:
        return (phase, nx, ny, attention, lessons, last, rotation, protected,
                chances, seen, dew_used, night_steps, prism_used, 0, terminal)
    index = FLOWERS.index(key)
    if key == level["target"] and not protected & (1 << index):
        return (phase, nx, ny, attention, lessons, last, rotation, protected,
                chances, seen, dew_used, night_steps, prism_used, 0, 2)
    chances -= 1
    if chances <= 0:
        return (phase, nx, ny, attention, lessons, last, rotation, protected,
                0, seen, dew_used, night_steps, prism_used, 0, 3)
    sx, sy = locate(level["grid"], "S")
    return (phase, sx, sy, attention, lessons, last, rotation, protected,
            chances, seen, dew_used, night_steps, prism_used, 0, 0)


def action_cost(state, _after):
    if _after[13] > state[13]:
        return 1
    return 0 if state[0] == 1 and state[11] > 0 else 1


def solved(_level, state):
    return state[-1] == 2


class G530A(RenderableUserDisplay):
    CELL, OX, OY = 7, 7, 13

    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def line(frame, a, b, color, dotted=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @classmethod
    def triangle(cls, frame, center, radius, color, hollow=False):
        x, y = center
        cls.line(frame, (x, y - radius), (x - radius, y + radius), color)
        cls.line(frame, (x - radius, y + radius), (x + radius, y + radius), color)
        cls.line(frame, (x + radius, y + radius), (x, y - radius), color)
        if not hollow:
            for inset in range(1, radius):
                cls.line(frame, (x, y - radius + inset), (x - radius + inset, y + radius - inset), color)
                cls.line(frame, (x, y - radius + inset), (x + radius - inset, y + radius - inset), color)

    @classmethod
    def center(cls, pos):
        return cls.OX + pos[0] * cls.CELL + 3, cls.OY + pos[1] * cls.CELL + 3

    def background(self, frame):
        frame[:, :] = PAPER
        for y in range(2, 63, 5):
            frame[y, 2 + (y * 3) % 7:62:11] = CREAM
        for x in range(4, 61, 7):
            frame[2 + (x * 2) % 5:61:12, x] = FIBER
        for y in range(13, 51, 6):
            self.disc(frame, (2, y), 4, ROSE)
            self.disc(frame, (61, y + 2), 4, MAGENTA)
        self.line(frame, (5, 12), (5, 52), GOLD, dotted=True)
        self.line(frame, (58, 12), (58, 52), GOLD, dotted=True)
        self.disc(frame, (32, 32), 29, BARK, hollow=True)
        self.disc(frame, (32, 32), 27, SAGE, hollow=True)

    def echo_silks(self, frame):
        if self.game.state[0] != 0:
            return
        for first, second in self.game.level["echo"]:
            a = self.center(locate(self.game.level["grid"], first))
            b = self.center(locate(self.game.level["grid"], second))
            self.line(frame, a, b, ROSE, dotted=True)
            mx, my = (a[0] + b[0]) // 2, (a[1] + b[1]) // 2
            self.disc(frame, (mx, my), 2, GOLD, hollow=True)

    def flower(self, frame, key, center, target=False, protected=False, preview=False):
        x, y = center
        colors = (CORAL, VIOLET, DEW_BLUE, GOLD)
        color = colors[FLOWERS.index(key)]
        if key == "a":
            for dx, dy in ((0, -3), (3, 0), (0, 3), (-3, 0)):
                self.disc(frame, (x + dx, y + dy), 2, color)
        elif key == "b":
            self.line(frame, (x, y - 5), (x + 4, y), color)
            self.line(frame, (x + 4, y), (x, y + 5), color)
            self.line(frame, (x, y + 5), (x - 4, y), color)
            self.line(frame, (x - 4, y), (x, y - 5), color)
        elif key == "c":
            self.triangle(frame, center, 4, color, hollow=True)
        else:
            for dx, dy in ((-4, 0), (4, 0), (0, -4), (0, 4), (-3, -3), (3, 3), (3, -3), (-3, 3)):
                self.line(frame, center, (x + dx, y + dy), color)
        self.disc(frame, center, 2, INK)
        if target:
            self.disc(frame, center, 6, GOLD, hollow=True)
            self.triangle(frame, (x, y - 8), 2, GOLD, hollow=True)
        if protected or preview:
            self.owl(frame, (x, y - 7), muted=preview and not protected)

    def owl(self, frame, center, muted=False):
        x, y = center
        color = FIBER if muted else INK
        self.disc(frame, center, 3, color)
        self.triangle(frame, (x - 2, y - 3), 2, color)
        self.triangle(frame, (x + 2, y - 3), 2, color)
        self.disc(frame, (x - 1, y), 1, CREAM)
        self.disc(frame, (x + 2, y), 1, CREAM)
        self.triangle(frame, (x, y + 3), 1, GOLD)

    def moth(self, frame, center, color=MAGENTA, wing=0):
        x, y = center
        spread = 3 if wing % 2 == 0 else 2
        self.disc(frame, (x - spread, y), 3, color)
        self.disc(frame, (x + spread, y), 3, color)
        self.triangle(frame, (x - spread, y + 2), 2, ROSE, hollow=True)
        self.triangle(frame, (x + spread, y + 2), 2, ROSE, hollow=True)
        self.disc(frame, center, 2, INK)
        self.line(frame, (x, y - 2), (x - 2, y - 5), INK)
        self.line(frame, (x, y - 2), (x + 2, y - 5), INK)

    def garden(self, frame):
        g = self.game
        state = g.state
        preview = guard_mask(g.level, state[3]) if state[0] == 0 else state[7]
        self.echo_silks(frame)
        for y, row in enumerate(g.level["grid"]):
            for x, char in enumerate(row):
                center = self.center((x, y))
                if char == "#":
                    self.disc(frame, (center[0] - 2, center[1]), 3, MOSS)
                    self.disc(frame, (center[0] + 2, center[1] - 1), 3, LEAF)
                    self.line(frame, (center[0] - 3, center[1] + 2), (center[0] + 3, center[1] - 2), BARK)
                    continue
                self.disc(frame, center, 4, CREAM)
                self.disc(frame, center, 3, PAPER, hollow=True)
                self.line(frame, (center[0] - 3, center[1] + 2), (center[0] + 3, center[1] - 2), SAGE, dotted=True)
                key = flower_at(g.level, state, x, y)
                if key is not None:
                    index = FLOWERS.index(key)
                    protected = state[0] == 1 and bool(state[7] & (1 << index))
                    show_target = key == g.level["target"] and (state[0] == 0 or not g.level["swap"])
                    self.flower(frame, key, center, show_target, protected,
                                state[0] == 0 and bool(preview & (1 << index)))
                    for mark in range(min(state[3][index], len(SCENT_STUDS))):
                        dx, dy = SCENT_STUDS[mark]
                        frame[center[1] + dy, center[0] + dx] = GOLD
                    if index == state[5]:
                        self.line(frame, (center[0] - 3, center[1] - 9), (center[0], center[1] - 6), ROSE)
                        self.line(frame, (center[0], center[1] - 6), (center[0] + 3, center[1] - 9), ROSE)
                elif char == "r":
                    self.disc(frame, (center[0], center[1] + 1), 3, DEW_BLUE, hollow=not state[10])
                    self.triangle(frame, (center[0], center[1] - 2), 3, DEW_BLUE, hollow=not state[10])
                elif char == "p":
                    self.triangle(frame, center, 4, VIOLET if not state[12] else FIBER, hollow=bool(state[12]))
                    self.line(frame, (center[0] - 3, center[1] + 2), (center[0] + 3, center[1] - 2), GOLD)
        if g.anim_kind not in ("move", "pollen", "dew", "prism"):
            self.moth(frame, self.center((state[1], state[2])))

    def hud(self, frame):
        g = self.game
        state = g.state
        for i in range(g.level["quota"]):
            x = 5 + i * 5
            self.disc(frame, (x, 6), 2, FIBER if i < state[4] else MAGENTA, hollow=i < state[4])
        for i in range(g.level["distinct"]):
            y = 15 + i * 4
            collected = i < state[9].bit_count()
            color = LEAF if collected else FIBER
            self.line(frame, (2, y + 2), (4, y), color)
            self.line(frame, (4, y), (6, y + 2), color)
            if collected:
                self.disc(frame, (4, y + 1), 1, color)
        for i in range(g.level["guards"]):
            self.owl(frame, (48 + i * 8, 7), muted=state[0] == 0)
        for i in range(state[8]):
            x = 51 + i * 6
            self.disc(frame, (x, 57), 3, GOLD)
            self.disc(frame, (x + 2, 56), 3, PAPER)
        self.disc(frame, (32, 58), 5, CORAL if state[0] == 0 else INK, hollow=state[0] == 0)
        if state[0] == 0:
            self.disc(frame, (32, 58), 2, GOLD)
            for i, pos in enumerate(((32, 51), (39, 58), (32, 63))):
                if i < g.level["swap"]:
                    self.disc(frame, pos, 1, VIOLET)
        else:
            self.disc(frame, (34, 56), 4, PAPER)
            for i in range(state[11]):
                frame[62, 8 + i * 4] = GOLD
        for i in range(g.budget_max):
            y = 11 + i * 2
            remaining = i < g.budget_left
            color = LEAF if remaining else FIBER
            if remaining:
                frame[y:y + 2, 60:62] = color
                frame[y + (i % 2), 59] = color
            else:
                frame[y:y + 2, 61] = color

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self.disc(frame, self.center(locate(g.level["grid"], "S")), 8, MAGENTA, hollow=True)
            if g.terminal_hold == "loss":
                self.line(frame, (8, 10), (56, 54), RED)
                self.line(frame, (56, 10), (8, 54), RED)
            return
        p = g.anim_progress
        total = g.anim_total
        before = self.center((g.state[1], g.state[2]))
        after = self.center((g.pending_state[1], g.pending_state[2]))
        mx = before[0] + (after[0] - before[0]) * p // total
        my = before[1] + (after[1] - before[1]) * p // total
        if g.anim_kind == "move":
            self.line(frame, before, (mx, my), ROSE, dotted=True)
            self.moth(frame, (mx, my), MAGENTA, p)
        elif g.anim_kind == "pollen":
            self.moth(frame, (mx, my), ROSE, p)
            changed = []
            for index, (old, new) in enumerate(zip(g.state[3], g.pending_state[3])):
                if old == new:
                    continue
                center = self.center(locate(g.level["grid"], FLOWERS[index]))
                color = GOLD if new > old else FIBER
                radius = 2 + p if new > old else max(2, 9 - p)
                self.disc(frame, center, radius, color, hollow=True)
                changed.append(center)
            if len(changed) > 1:
                for center in changed[1:]:
                    self.line(frame, after, center, ROSE, dotted=True)
            for dx, dy in ((-p, -p), (p, -p), (-p, p), (p, p)):
                if 0 <= after[1] + dy < 64 and 0 <= after[0] + dx < 64:
                    frame[after[1] + dy, after[0] + dx] = CORAL
        elif g.anim_kind == "dew":
            self.moth(frame, (mx, my), DEW_BLUE, p)
            self.disc(frame, after, 3 + p, DEW_BLUE, hollow=True)
            self.line(frame, (after[0], after[1] - p), (after[0], after[1] + p), CREAM)
        elif g.anim_kind == "prism":
            self.moth(frame, (mx, my), VIOLET, p)
            self.triangle(frame, after, min(9, 3 + p), VIOLET, hollow=True)
            self.line(frame, after, (after[0] - p * 2, after[1] + p), GOLD)
            self.line(frame, after, (after[0] + p * 2, after[1] + p), ROSE)
        elif g.anim_kind == "curtain":
            width = min(32, p * 4)
            frame[:, :width] = ROSE
            frame[:, 64 - width:] = MAGENTA
            for y in range(6, 62, 8):
                self.disc(frame, (width, y), 2, GOLD)
                self.disc(frame, (63 - width, y + 3), 2, GOLD)
        elif g.anim_kind == "turn":
            self.disc(frame, (32, 32), 7 + p * 3, VIOLET, hollow=True)
            self.line(frame, (10 + p * 3, 32), (54 - p * 3, 32), GOLD, dotted=True)
            self.triangle(frame, (32 + p * 2, 18 + p), 2, ROSE, hollow=True)
        elif g.anim_kind == "recoil":
            self.disc(frame, (32, 32), 5 + p * 3, RED, hollow=True)
            self.moth(frame, (32 + (-1) ** p * 3, 32), FIBER, p)
        elif g.anim_kind == "success":
            for radius in range(4, min(31, 4 + p * 4), 5):
                self.disc(frame, (32, 32), radius, LEAF, hollow=True)
            for x, y in ((12, 14), (52, 14), (12, 50), (52, 50)):
                self.disc(frame, (x, y), min(5, 1 + p // 2), GOLD, hollow=True)
        elif g.anim_kind == "loss":
            self.line(frame, (6 + p, 8), (58 - p, 56), RED)
            self.line(frame, (58 - p, 8), (6 + p, 56), RED)
            frame[8 + p:10 + p, 8:56] = FIBER

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        self.garden(frame)
        self.hud(frame)
        self.animation(frame)
        return frame


class G530(ARCBaseGame):
    def __init__(self):
        self.display = G530A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("g530", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]), False, len(levels), [1, 2, 3, 4, 5])

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
        if won:
            kind, frames = "success", 7
        elif lost:
            kind, frames = "loss", 7
        elif after[0] != self.state[0]:
            kind, frames = ("turn", 8) if self.level["swap"] else ("curtain", 8)
        elif after[8] < self.state[8]:
            kind, frames = "recoil", 6
        elif after[13] > self.state[13]:
            kind, frames = "recoil", 5
        elif after[12] > self.state[12]:
            kind, frames = "prism", 7
        elif after[10] > self.state[10]:
            kind, frames = "dew", 7
        elif after[4] > self.state[4]:
            kind, frames = "pollen", 7
        else:
            kind, frames = "move", 5
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
