# ARC-AGI-3 candidate task g504.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


CREAM, LINEN, ASH, CLAY, BARK, INK = 0, 1, 2, 3, 4, 5
BERRY, PINK, RED, BLUE, SKY, HONEY, APRICOT, PLUM, SAGE, LAVENDER = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15

ITEM_FEATURES = ((0, 0), (1, 1), (2, 2), (3, 0), (0, 1), (1, 2))

LEVELS = [
    {"name": "First Taste", "items": (0,), "prefs": (0,), "dual": False, "probes": 1, "rotate": 0, "order": (), "budget": 4},
    {"name": "Shared Basket", "items": (0, 1, 2), "prefs": (2, 0, 1), "dual": False, "probes": 3, "rotate": 0, "order": (), "budget": 14},
    {"name": "Shape and Crumb", "items": (0, 4, 1), "prefs": (4, 1, 0), "dual": True, "probes": 3, "rotate": 0, "order": (), "budget": 14},
    {"name": "Quiet Placemat", "items": (0, 4, 1, 5), "prefs": (5, 0, 4, 1), "dual": True, "probes": 3, "rotate": 0, "order": (), "budget": 19},
    {"name": "Turning Picnic", "items": (0, 4, 1, 5), "prefs": (4, 1, 5, 0), "dual": True, "probes": 4, "rotate": 1, "order": (), "budget": 19},
    {"name": "Courtesy Path", "items": (0, 4, 1, 5), "prefs": (1, 4, 0, 5), "dual": True, "probes": 3, "rotate": 1, "order": (2, 0, 3, 1), "budget": 24},
    {"name": "Cloudberry Circle", "items": (0, 4, 1, 5, 2), "prefs": (4, 2, 5, 0, 1), "dual": True, "probes": 4, "rotate": 1, "order": (1, 4, 0, 3, 2), "budget": 28},
    {"name": "Cloudberry Commons", "items": (0, 4, 1, 5, 2), "prefs": (5, 0, 1, 4, 2), "dual": True, "probes": 4, "rotate": 2, "order": (4, 1, 3, 0, 2), "budget": 34},
]


def start_state(level):
    n = len(level["prefs"])
    return 0, 0, 0, tuple(level["items"]), 0, (0,) * n, 0, 0, 0, 0, 2, 0


def rotate(values, amount):
    amount %= len(values)
    return values[-amount:] + values[:-amount] if amount else values


def transition(level, state, action):
    phase, guest, slot, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    n = len(level["prefs"])
    if action == 1:
        return phase, (guest - 1) % n, slot, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal
    if action == 2:
        return phase, (guest + 1) % n, slot, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal
    if action == 3:
        return phase, guest, (slot - 1) % n, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal
    if action == 4:
        return phase, guest, (slot + 1) % n, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal
    if phase == 0 and action == 5:
        if probes >= level["probes"] or seen & (1 << guest):
            return state
        item = platter[slot]; values = list(evidence); values[guest] = item + 1
        return phase, guest, slot, platter, seen | (1 << guest), tuple(values), probes + 1, assigned, used, courtesy, chances, terminal
    if phase == 0 and action == 6:
        if probes != level["probes"] or seen.bit_count() != level["probes"]:
            return state
        return 1, guest, slot, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal
    if phase == 1 and action == 5:
        if assigned & (1 << guest):
            return state
        if level["order"] and guest != level["order"][courtesy]:
            return state
        item = platter[slot]
        if used & (1 << item):
            return state
        if item != level["prefs"][guest]:
            values = list(evidence); values[guest] = item + 1; chances -= 1
            return phase, guest, slot, platter, seen | (1 << guest), tuple(values), probes, assigned, used, courtesy, chances, 3 if chances <= 0 else 0
        assigned |= 1 << guest; used |= 1 << item; courtesy += 1
        if level["rotate"] == 1:
            platter = rotate(platter, 1)
        elif level["rotate"] == 2:
            platter = rotate(platter, 1 + ITEM_FEATURES[item][1] % 2)
        terminal = 2 if assigned.bit_count() == n else 0
        return phase, guest, slot, platter, seen, evidence, probes, assigned, used, courtesy, chances, terminal
    if phase == 1 and action == 6:
        chances -= 1
        return phase, guest, slot, platter, seen, evidence, probes, assigned, used, courtesy, chances, 3 if chances <= 0 else 0
    return state


def action_cost(state, after):
    return 0 if after[10] < state[10] else 1


def solved(_level, state):
    return state[-1] == 2


class G504A(RenderableUserDisplay):
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
        x0, y0 = a; x1, y1 = b; steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps; y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def guest_center(index, n):
        return (32, 18) if n == 1 else (8 + index * (48 // (n - 1)), 17 + (index % 2) * 3)

    @staticmethod
    def item_center(index, n):
        return (32, 45) if n == 1 else (9 + index * (46 // (n - 1)), 45 - (index % 2) * 2)

    def background(self, frame):
        frame[:, :] = CREAM
        for y in range(3, 62, 6):
            frame[y, 2 + y % 4:62:10] = LINEN
        for x in range(4, 62, 9):
            frame[2 + x % 5:62:11, x] = ASH
        frame[28:57, 4:60] = LINEN
        for x in range(5, 60, 6):
            self.disc(frame, (x, 57), 3, LINEN)
        self.line(frame, (6, 31), (57, 53), CLAY, dotted=True)

    def guest(self, frame, center, index, assigned=False):
        x, y = center; colors = (SAGE, APRICOT, SKY, LAVENDER, PINK); color = colors[index % len(colors)]
        self.disc(frame, (x, y), 6, color)
        if index % 5 == 0:
            self.disc(frame, (x - 4, y - 5), 3, color); self.disc(frame, (x + 4, y - 5), 3, color)
        elif index % 5 == 1:
            self.line(frame, (x - 5, y - 3), (x - 2, y - 9), color); self.line(frame, (x + 5, y - 3), (x + 2, y - 9), color)
        elif index % 5 == 2:
            self.disc(frame, (x, y - 7), 3, color); frame[y - 10:y - 7, x] = color
        elif index % 5 == 3:
            frame[y - 9:y - 4, x - 5:x - 2] = color; frame[y - 9:y - 4, x + 3:x + 6] = color
        else:
            for dx in (-5, 0, 5): self.disc(frame, (x + dx, y - 5), 2, color)
        frame[y - 1:y + 1, x - 3:x - 1] = INK; frame[y - 1:y + 1, x + 2:x + 4] = INK
        if assigned:
            self.line(frame, (x - 3, y + 3), (x, y + 5), HONEY); self.line(frame, (x, y + 5), (x + 4, y + 2), HONEY)
            self.disc(frame, (x, y), 8, SAGE, hollow=True)

    def food(self, frame, center, item, used=False, small=False):
        x, y = center; shape, texture = ITEM_FEATURES[item]; r = 2 if small else 4
        color = (BERRY, HONEY, APRICOT, SAGE, LAVENDER, SKY)[item]
        if used:
            self.disc(frame, center, r + 1, ASH, hollow=True)
            if texture == 1: self.line(frame, (x - r, y), (x + r, y), CLAY, dotted=True)
            elif texture == 2: self.disc(frame, center, 1, CLAY, hollow=True)
            return
        if shape == 0:
            self.disc(frame, center, r, color)
        elif shape == 1:
            self.line(frame, (x - r, y + r), (x, y - r), color); self.line(frame, (x, y - r), (x + r, y + r), color); self.line(frame, (x + r, y + r), (x - r, y + r), color)
        elif shape == 2:
            self.line(frame, (x - r, y), (x + r, y), color); self.line(frame, (x, y - r), (x, y + r), color); self.line(frame, (x - r + 1, y - r + 1), (x + r - 1, y + r - 1), color)
        else:
            self.line(frame, (x, y - r), (x + r, y), color); self.line(frame, (x + r, y), (x, y + r), color); self.line(frame, (x, y + r), (x - r, y), color); self.line(frame, (x - r, y), (x, y - r), color)
        if texture == 1:
            self.line(frame, (x - r + 1, y), (x + r - 1, y), INK, dotted=True)
        elif texture == 2:
            self.disc(frame, center, 1, INK, hollow=True)

    def cue(self, frame, center, offered, preferred, dual):
        ox, oy = ITEM_FEATURES[offered]; px, py = ITEM_FEATURES[preferred]
        for row, (source, target) in enumerate(((ox, px), (oy, py))):
            if row and not dual:
                continue
            x, y = center[0], center[1] + row * 5
            delta = (target - source) % 4 if row == 0 else (target - source) % 3
            if delta == 0:
                self.disc(frame, (x, y), 2, SAGE, hollow=True); frame[y, x] = SAGE
            elif row == 0 and delta == 2:
                for offset in (-2, 2):
                    self.line(frame, (x + offset - 1, y - 2), (x + offset + 1, y), APRICOT)
                    self.line(frame, (x + offset + 1, y), (x + offset - 1, y + 2), APRICOT)
            elif delta == 1:
                self.line(frame, (x - 2, y - 2), (x + 2, y), APRICOT); self.line(frame, (x + 2, y), (x - 2, y + 2), APRICOT)
            else:
                self.line(frame, (x + 2, y - 2), (x - 2, y), PLUM); self.line(frame, (x - 2, y), (x + 2, y + 2), PLUM)

    def commons(self, frame):
        g = self.game; s = g.state; n = len(g.level["prefs"])
        for i in range(n):
            center = self.guest_center(i, n); self.guest(frame, center, i, bool(s[7] & (1 << i)))
            if s[5][i]:
                offered = s[5][i] - 1
                self.food(frame, (center[0] - 4, 29), offered, small=True)
                self.cue(frame, (center[0] + 3, 27), offered, g.level["prefs"][i], g.level["dual"])
            elif s[0] == 1:
                self.disc(frame, (center[0], 29), 3, ASH, hollow=True)
        if g.anim_kind == "serve_turn" and g.pending_state:
            served = s[3][s[2]]; p = g.anim_progress
            for old_slot, item in enumerate(s[3]):
                if item == served:
                    continue
                new_slot = g.pending_state[3].index(item)
                before = self.item_center(old_slot, n); after = self.item_center(new_slot, n)
                center = (before[0] + (after[0] - before[0]) * p // g.anim_total,
                          before[1] + (after[1] - before[1]) * p // g.anim_total)
                self.food(frame, center, item, bool(s[8] & (1 << item)))
        else:
            traveling = s[3][s[2]] if g.anim_kind in ("serve", "return") else -1
            for slot, item in enumerate(s[3]):
                if item == traveling:
                    continue
                self.food(frame, self.item_center(slot, n), item, bool(s[8] & (1 << item)))
        gc = self.guest_center(s[1], n); ic = self.item_center(s[2], n)
        self.disc(frame, gc, 9, BERRY, hollow=True)
        self.line(frame, (ic[0] - 6, ic[1] + 7), (ic[0], ic[1] + 4), HONEY)
        self.line(frame, (ic[0], ic[1] + 4), (ic[0] + 6, ic[1] + 7), HONEY)
        if g.level["order"] and s[0] == 1 and s[9] < n:
            expected = g.level["order"][s[9]]; ex, ey = self.guest_center(expected, n)
            self.disc(frame, (ex, ey), 11, SAGE, hollow=True)
        if g.level["rotate"] and s[0] == 1:
            selected_item = s[3][s[2]]
            shift = 1 if g.level["rotate"] == 1 else 1 + ITEM_FEATURES[selected_item][1] % 2
            for i in range(shift):
                cx = 28 + i * 8
                self.disc(frame, (cx, 36), 3, SKY, hollow=True)
                frame[33:36, cx + 2:cx + 5] = SKY

    def hud(self, frame):
        g = self.game; s = g.state
        for i in range(g.level["probes"]):
            x = 6 + i * 6; self.disc(frame, (x, 5), 2, ASH if i < s[6] else BERRY, hollow=i < s[6])
        for i in range(s[10]):
            self.disc(frame, (55 + i * 5, 5), 2, BERRY); frame[3:5, 55 + i * 5] = SAGE
        if s[0] == 0:
            self.disc(frame, (32, 5), 3, SKY, hollow=True); self.line(frame, (34, 7), (38, 10), SKY)
        else:
            self.line(frame, (29, 3), (35, 8), APRICOT); self.line(frame, (35, 3), (29, 8), APRICOT); self.disc(frame, (32, 6), 2, HONEY)
        for i in range(g.budget_max):
            x = 4 + i
            if i < g.budget_left:
                frame[61:63, x] = SAGE
            else:
                frame[62, x] = ASH

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self.disc(frame, self.guest_center(0, len(g.level["prefs"])), 11, SKY, hollow=True)
            if g.terminal_hold == "loss":
                for x in range(4, 61, 7): self.line(frame, (x, 2), (x - 3, 58), BLUE, dotted=True)
            return
        p = g.anim_progress; n = len(g.level["prefs"]); s = g.state
        if g.anim_kind in ("guest_cursor", "item_cursor"):
            center = self.guest_center(g.pending_state[1], n) if g.anim_kind == "guest_cursor" else self.item_center(g.pending_state[2], n)
            self.disc(frame, center, 7 + p, BERRY if g.anim_kind == "guest_cursor" else HONEY, hollow=True)
        elif g.anim_kind == "probe":
            source = self.item_center(s[2], n); destination = self.guest_center(s[1], n)
            mid = (source[0] + (destination[0] - source[0]) * p // g.anim_total,
                   source[1] + (destination[1] - source[1]) * p // g.anim_total - p * (g.anim_total - p) // 2)
            self.food(frame, mid, s[3][s[2]], small=True)
            self.disc(frame, destination, 7 + p, SKY, hollow=True)
        elif g.anim_kind in ("serve", "serve_turn", "return"):
            source = self.item_center(s[2], n); destination = self.guest_center(s[1], n)
            if g.anim_kind == "return":
                half = max(1, g.anim_total // 2)
                if p <= half:
                    start, end, phase, span = source, destination, p, half
                else:
                    start, end, phase, span = destination, source, p - half, g.anim_total - half
                mid = (start[0] + (end[0] - start[0]) * phase // max(1, span),
                       start[1] + (end[1] - start[1]) * phase // max(1, span) - 4)
            else:
                mid = (source[0] + (destination[0] - source[0]) * p // g.anim_total,
                       source[1] + (destination[1] - source[1]) * p // g.anim_total - 4)
            self.food(frame, mid, s[3][s[2]], small=True)
            if g.anim_kind == "return": self.disc(frame, destination, 7 + p, RED, hollow=True)
            elif g.anim_kind == "serve_turn":
                self.disc(frame, (32, 45), 7 + p * 3, SKY, hollow=True)
        elif g.anim_kind == "phase":
            self.disc(frame, (32, 33), 6 + p * 4, APRICOT, hollow=True)
        elif g.anim_kind == "success":
            for x in range(7, 60, 8):
                self.disc(frame, (x, 32), 2 + p, (BERRY, APRICOT, SAGE)[(x // 8) % 3], hollow=True)
        elif g.anim_kind == "loss":
            for x in range(4 + p, 61, 8): self.line(frame, (x, 2), (x - 4, 58), BLUE, dotted=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame); self.commons(frame); self.hud(frame); self.animation(frame); return frame


class G504(ARCBaseGame):
    def __init__(self):
        self.display = G504A(self); self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0; self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None; self.intro_mark = True; self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("g504", levels, Camera(0, 0, 64, 64, CREAM, CREAM, [self.display]), False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level); self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None; self.intro_mark = True; self.terminal_hold = None

    def begin(self, kind, frames, state, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.pending_state = state; self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win": self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss": self.terminal_hold = "loss"; self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self.finish()
            return
        action = self.action.id.value
        if action == 0: self.complete_action(); return
        self.intro_mark = False; before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("return", 4, before, self.budget_left); return
        budget = self.budget_left - action_cost(before, after); won = after[-1] == 2; lost = after[-1] == 3 or (budget <= 0 and not won)
        if won: kind = "success"
        elif lost: kind = "loss"
        elif after[10] < before[10]: kind = "return"
        elif before[0] != after[0]: kind = "phase"
        elif action in (1, 2): kind = "guest_cursor"
        elif action in (3, 4): kind = "item_cursor"
        elif before[0] == 0: kind = "probe"
        elif before[3] != after[3]: kind = "serve_turn"
        else: kind = "serve"
        frames = 7 if kind in ("success", "loss", "phase", "serve_turn") else 5
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
