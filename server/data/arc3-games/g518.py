# ARC-AGI-3 candidate task g518.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
COLORS = (MAGENTA, BLUE, GOLD, GREEN, VIOLET, CORAL, AQUA)
HEIGHTS = (6, 9, 8, 10, 7, 4, 5)
WIDTHS = (6, 2, 8, 3, 7, 4, 5)


LEVELS = [
    {"name": "Two Profiles", "n": 2, "order": (0, 1), "lights": (1,), "views": 1,
     "attached": True, "require_views": False, "budget": 3},
    {"name": "Shadow Balcony", "n": 4, "order": (3, 2, 1, 0), "lights": (1,), "views": 1,
     "attached": False, "require_views": False, "budget": 11},
    {"name": "High Sun", "n": 5, "order": (4, 3, 2, 1, 0), "lights": (2,), "views": 1,
     "attached": False, "require_views": False, "budget": 18},
    {"name": "Westward Light", "n": 5, "order": (0, 1, 2, 3, 4), "lights": (-2,), "views": 1,
     "attached": False, "require_views": False, "budget": 15},
    {"name": "Lace Curtain", "n": 6, "order": (5, 4, 3, 2, 1, 0), "lights": (2, 2), "views": 2,
     "attached": False, "occluded": True, "require_views": True, "budget": 28},
    {"name": "Twin Lamps", "n": 6, "order": (0, 5, 1, 4, 2, 3), "lights": (1, -3), "views": 2,
     "attached": False, "occluded": True, "require_views": True, "budget": 14},
    {"name": "Solstice Relay", "n": 7, "order": (6, 5, 4, 3, 2, 1, 0), "lights": (-2, -2), "views": 2,
     "attached": False, "occluded": True, "require_views": True, "budget": 30},
    {"name": "Sunspool Parade", "n": 7, "order": (0, 6, 1, 5, 2, 4, 3), "lights": (2, -3), "views": 2,
     "attached": False, "occluded": True, "require_views": True, "budget": 16},
]


def projection(identity, light):
    return HEIGHTS[identity] * abs(light) + WIDTHS[identity]


def target_order(level):
    identities = range(level["n"])
    lights = level["lights"]
    if len(set(lights)) > 1:
        return tuple(sorted(identities, key=lambda identity: tuple(projection(identity, light) for light in lights)))
    light = lights[0]
    return tuple(sorted(identities, key=lambda identity: projection(identity, light), reverse=light < 0))


def start_state(level):
    return tuple(level["order"]), 0, 0, 1, 2


def transition(level, state, action):
    order, cursor, view, seen, chances = state
    if chances <= 0:
        return state
    if action == 1 and level["views"] > 1:
        view = (view + 1) % level["views"]
        return order, cursor, view, seen | (1 << view), chances
    if action == 3:
        return order, (cursor - 1) % (len(order) - 1), view, seen, chances
    if action == 4:
        return order, (cursor + 1) % (len(order) - 1), view, seen, chances
    if action == 5:
        revised = list(order)
        revised[cursor], revised[cursor + 1] = revised[cursor + 1], revised[cursor]
        return tuple(revised), cursor, view, seen, chances
    return state


def solved(level, state):
    order, _cursor, _view, seen, chances = state
    all_views = (1 << level["views"]) - 1
    return order == target_order(level) and (not level.get("require_views") or seen == all_views) and chances > 0


def submit_transition(level, state):
    if solved(level, state):
        return state
    order, cursor, view, seen, chances = state
    return order, cursor, view, seen, chances - 1


class G518A(RenderableUserDisplay):
    def __init__(self, game): self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 2) ** 2): frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b; steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1: continue
            x = x0 + (x1 - x0) * i // steps; y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64: frame[y, x] = color

    @staticmethod
    def _xs(n):
        if n >= 7:
            xs = tuple(round(10 + 44 * i / (n - 1)) for i in range(n))
        else:
            xs = tuple(round(12 + 39 * i / (n - 1)) for i in range(n))
        gap = min(b - a for a, b in zip(xs, xs[1:]))
        return xs, gap

    def _background(self, frame):
        frame[:, :] = PAPER
        frame[3:48, 3:61] = PEARL
        for y in range(5, 47, 7): frame[y, 5 + y % 4:59:8] = ASH
        frame[13:31, 4:60] = AQUA
        frame[31:48, 4:60] = GOLD
        for x in range(5, 60, 6):
            self._disc(frame, (x, 4), 3, CORAL)
            self._disc(frame, (x, 47), 2, ROSE)
        frame[49:63, 3:61] = PEARL
        for x in range(5, 60, 5): frame[61:63, x:x + 2] = EARTH

    def _profile(self, frame, identity, center, color=None, tiny=False, compact=False):
        x, y = center; color = COLORS[identity] if color is None else color
        kind = identity % 7
        if tiny:
            if kind == 0:
                self._disc(frame, (x, y - 2), 1, color)
                frame[max(0, y - 1):min(64, y + 3), max(0, x - 1):min(64, x + 2)] = color
            elif kind == 1:
                for row in range(4):
                    span = min(2, row)
                    yy = y - 2 + row
                    frame[yy, max(0, x - span):min(64, x + span + 1)] = color
            elif kind == 2:
                self._line(frame, (x, y - 2), (x, y + 2), color)
                self._line(frame, (x - 2, y), (x + 2, y), color)
            elif kind == 3:
                self._disc(frame, (x, y), 2, color, hollow=True)
            elif kind == 4:
                self._line(frame, (x - 2, y + 2), (x, y - 2), color)
                self._line(frame, (x, y - 2), (x + 2, y + 2), color)
                self._line(frame, (x - 2, y + 2), (x + 2, y + 2), color)
            elif kind == 5:
                self._line(frame, (x - 2, y - 2), (x - 2, y + 2), color)
                self._line(frame, (x + 2, y - 2), (x + 2, y + 2), color)
                self._line(frame, (x - 2, y), (x + 2, y), color)
            else:
                self._disc(frame, (x, y), 2, color)
                frame[max(0, y - 1):min(64, y + 1), x] = PEARL
            return

        if compact:
            if kind == 0:
                self._disc(frame, (x, y - 3), 2, color)
                frame[y - 1:y + 5, x - 1:x + 2] = color
            elif kind == 1:
                for row in range(7):
                    span = min(2, row // 2)
                    frame[y - 4 + row, x - span:x + span + 1] = color
            elif kind == 2:
                frame[y - 4:y + 5, x] = color; frame[y - 1:y + 1, x - 3:x + 4] = color
                self._disc(frame, (x, y - 4), 1, color)
            elif kind == 3:
                self._disc(frame, (x, y - 2), 3, color, hollow=True); frame[y:y + 5, x] = color
            elif kind == 4:
                self._line(frame, (x - 3, y + 4), (x, y - 4), color)
                self._line(frame, (x, y - 4), (x + 3, y + 4), color)
                self._line(frame, (x - 3, y + 4), (x + 3, y + 4), color)
            elif kind == 5:
                frame[y - 4:y + 5, x - 2:x - 1] = color
                frame[y - 4:y + 5, x + 1:x + 2] = color
                frame[y - 1:y + 1, x - 2:x + 2] = color
            else:
                self._disc(frame, (x, y - 2), 3, color)
                frame[y - 3:y - 1, x] = PEARL; frame[y:y + 5, x] = color
            frame[y, max(0, x - 2):min(64, x + 3):2] = PAPER
            return

        r = 1 if tiny else 2
        if kind == 0:
            self._disc(frame, (x, y - 4), r + 1, color)
            frame[y - 2:y + 5, x - 2:x + 3] = color
        elif kind == 1:
            for row in range(8):
                span = min(row // 2, 3)
                frame[y - 5 + row, x - span:x + span + 1] = color
        elif kind == 2:
            frame[y - 5:y + 5, x] = color; frame[y - 2:y, x - 4:x + 5] = color
            self._disc(frame, (x, y - 5), r, color)
        elif kind == 3:
            self._disc(frame, (x, y - 3), 4, color, hollow=True); frame[y:y + 5, x - 1:x + 2] = color
        elif kind == 4:
            self._line(frame, (x - 4, y + 4), (x, y - 5), color)
            self._line(frame, (x, y - 5), (x + 4, y + 4), color)
            frame[y + 3:y + 5, x - 4:x + 5] = color
        elif kind == 5:
            frame[y - 5:y + 5, x - 3:x - 1] = color; frame[y - 5:y + 5, x + 1:x + 3] = color
            frame[y - 1:y + 1, x - 3:x + 3] = color
        else:
            self._disc(frame, (x, y - 3), 4, color)
            frame[y - 3:y, x - 1:x + 2] = PEARL
            frame[y:y + 5, x - 1:x + 2] = color
        frame[y, max(0, x - 3):min(64, x + 4):2] = PAPER

    def _shadow(self, frame, identity, origin, light, target=False, faint=False):
        x, y = origin; direction = 1 if light > 0 else -1
        ranked = sorted(range(self.game.level["n"]), key=lambda item: projection(item, light))
        rank = ranked.index(identity)
        length = 4 + rank
        color = ASH if faint else CHARCOAL
        tip = (max(3, min(60, x + direction * length)), y + 4)
        self._line(frame, (x, y), tip, color, dotted=faint)
        self._line(frame, (x, y), (x, y - 2 - rank), color, dotted=faint)
        frame[max(0, y - 2 - rank), max(0, x - 1):min(64, x + 2)] = color
        if not target:
            self._profile(frame, identity, tip, color=color, tiny=True)
        if target:
            self._disc(frame, tip, 3, EARTH, hollow=True)
            frame[tip[1], max(0, tip[0] - 2):min(64, tip[0] + 3)] = EARTH

    def _sun(self, frame):
        g = self.game; light = g.level["lights"][g.state[2]]
        center = (7, 10) if light > 0 else (57, 10)
        self._disc(frame, center, 5, GOLD)
        for dx, dy in ((0, -7), (0, 7), (-7, 0), (7, 0), (-5, -5), (5, 5), (-5, 5), (5, -5)):
            self._line(frame, center, (center[0] + dx, center[1] + dy), CORAL)
        for ring in range(max(0, abs(light) - 1)): self._disc(frame, center, 7 + ring * 2, CORAL, hollow=True)

    def _selection(self, frame, left, right):
        self._line(frame, (left - 3, 17), (left - 3, 14), VIOLET)
        self._line(frame, (left - 3, 14), (left + 3, 14), VIOLET)
        self._line(frame, (right + 3, 17), (right + 3, 14), VIOLET)
        self._line(frame, (right - 3, 14), (right + 3, 14), VIOLET)
        self._line(frame, (left + 3, 15), (right - 3, 15), VIOLET, dotted=True)
        self._disc(frame, ((left + right) // 2, 15), 2, GOLD, hollow=True)

    def _curtain(self, frame, view, side=None):
        if side is None:
            side = 1 if view == 0 else 58
        side = max(0, min(60, side))
        frame[18:46, side:side + 4] = ROSE
        for y in range(20 + view, 45, 5): self._disc(frame, (side + 1, y), 1, PAPER)

    def _stage(self, frame, skip_slots=(), draw_cursor=True, draw_curtain=True):
        g = self.game; order, cursor, view, _seen, _chances = g.state
        xs, gap = self._xs(len(order)); light = g.level["lights"][view]
        compact = len(order) >= 7
        skipped = set(skip_slots)
        for slot, identity in enumerate(order):
            if slot not in skipped:
                self._profile(frame, identity, (xs[slot], 26), compact=compact)
                shadow_y = 31 if g.level.get("attached") else 38
                visible = not g.level.get("occluded") or identity % g.level["views"] == view
                if visible:
                    self._shadow(frame, identity, (xs[slot], shadow_y), light)
                else:
                    self._disc(frame, (xs[slot], shadow_y + 2), 3, ASH, hollow=True)
                    frame[shadow_y + 1:shadow_y + 4, xs[slot] - 1:xs[slot] + 2] = PEARL
        if draw_cursor:
            self._selection(frame, xs[cursor], xs[cursor + 1])
        wanted = target_order(g.level)
        for slot, identity in enumerate(wanted):
            visible = not g.level.get("occluded") or identity % g.level["views"] == view
            if visible:
                self._shadow(frame, identity, (xs[slot], 53), light, target=True)
            else:
                self._disc(frame, (xs[slot], 56), 3, ASH, hollow=True)
                frame[55:58, xs[slot] - 1:xs[slot] + 2] = PEARL
        if g.level["views"] > 1 and draw_curtain:
            self._curtain(frame, view)

    def _hud(self, frame):
        g = self.game
        stitch_positions = ((0, 0), (0, -2), (2, 0), (0, 2), (-2, 0))
        for group in range((g.budget_max + 4) // 5):
            cx, cy = 18 + group * 6, 7
            self._disc(frame, (cx, cy), 3, ASH, hollow=True)
            for stitch, (dx, dy) in enumerate(stitch_positions):
                number = group * 5 + stitch
                if number >= g.budget_max:
                    continue
                if number < g.budget_left:
                    self._disc(frame, (cx + dx, cy + dy), 1, VIOLET)
                else:
                    frame[cy + dy, cx + dx] = ASH
        for i in range(2):
            x = 55 + i * 4
            if i < g.state[4]: self._disc(frame, (x, 61), 2, ROSE, hollow=True)
            else:
                self._line(frame, (x - 2, 59), (x + 2, 63), RED)
                self._line(frame, (x + 2, 59), (x - 2, 63), RED)
        if g.level.get("require_views"):
            for view in range(g.level["views"]):
                x = 28 + view * 8
                if g.state[3] & (1 << view):
                    self._disc(frame, (x, 60), 3, GOLD, hollow=True)
                    frame[60, x] = GOLD
                else: frame[59:62, x - 2:x + 3] = ASH

    def _loss_overlay(self, frame):
        frame[18:46, 29:35] = RED
        frame[24:40:4, 5:59] = RED

    def _idle_overlay(self, frame):
        g = self.game
        if g.intro_mark:
            self._line(frame, (19, 11), (45, 11), CORAL, dotted=True)
            self._disc(frame, (19, 11), 2, GOLD, hollow=True)
            self._disc(frame, (45, 11), 2, GOLD, hollow=True)
            for x in (25, 32, 39):
                self._line(frame, (x, 11), (x, 13), CORAL)
        if g.terminal_hold == "loss":
            self._loss_overlay(frame)
        elif g.terminal_hold == "win":
            for x in range(8, 58, 7):
                self._disc(frame, (x, 20 + x % 5), 2, GREEN)

    def _render_static(self, frame, skip_slots=(), draw_cursor=True, draw_curtain=True):
        self._background(frame)
        self._sun(frame)
        self._stage(frame, skip_slots=skip_slots, draw_cursor=draw_cursor,
                    draw_curtain=draw_curtain)
        self._hud(frame)

    def _moving_swap(self, frame, p, span):
        g = self.game; before = g.anim_before
        order, cursor, view, _seen, _chances = before
        xs, _ = self._xs(len(order)); compact = len(order) >= 7
        first, second = order[cursor], order[cursor + 1]
        x1 = xs[cursor] + (xs[cursor + 1] - xs[cursor]) * p // span
        x2 = xs[cursor + 1] + (xs[cursor] - xs[cursor + 1]) * p // span
        lift = 16 * p * (span - p) // max(1, span * span)
        self._profile(frame, first, (x1, 26 - lift), compact=compact)
        self._profile(frame, second, (x2, 26 + lift // 2), compact=compact)
        shadow_y = 31 if g.level.get("attached") else 38
        light = g.level["lights"][view]
        for identity, x in ((first, x1), (second, x2)):
            visible = not g.level.get("occluded") or identity % g.level["views"] == view
            if visible:
                self._shadow(frame, identity, (x, shadow_y), light)
            else:
                self._disc(frame, (x, shadow_y + 2), 3, ASH, hollow=True)
                frame[shadow_y + 1:shadow_y + 4, x - 1:x + 2] = PEARL

    def _animation(self, frame, span):
        g = self.game; p = g.anim_progress
        before, after = g.anim_before, g.pending_state
        if g.anim_kind == "cursor":
            xs, _ = self._xs(len(before[0]))
            left = xs[before[1]] + (xs[after[1]] - xs[before[1]]) * p // span
            right = xs[before[1] + 1] + (xs[after[1] + 1] - xs[before[1] + 1]) * p // span
            self._selection(frame, left, right)
        elif g.anim_kind == "swap":
            self._moving_swap(frame, p, span)
        elif g.anim_kind == "miss":
            reach = 2 + 10 * p // span
            self._line(frame, (32 - reach, 30 - reach // 2),
                       (32 + reach, 30 + reach // 2), RED)
            self._line(frame, (32 + reach, 30 - reach // 2),
                       (32 - reach, 30 + reach // 2), RED)
        elif g.anim_kind == "success":
            for radius in range(3, min(29, 3 + p * 4), 5):
                self._disc(frame, (32, 34), radius, GREEN, hollow=True)

    def _view_transition(self, frame, span):
        g = self.game; p = g.anim_progress
        if p >= span:
            current = g.state; g.state = g.pending_state
            self._render_static(frame)
            if g.pending_terminal == "loss":
                self._loss_overlay(frame)
            g.state = current
            return

        old_frame = np.zeros_like(frame); new_frame = np.zeros_like(frame)
        current = g.state
        g.state = g.anim_before
        self._render_static(old_frame, draw_curtain=False)
        g.state = g.pending_state
        self._render_static(new_frame, draw_curtain=False)
        g.state = current
        after_view = g.pending_state[2]
        if after_view:
            side = 1 + 57 * p // span
            frame[:, :] = old_frame
            frame[:, :side] = new_frame[:, :side]
        else:
            side = 58 - 57 * p // span
            frame[:, :] = old_frame
            frame[:, side + 4:] = new_frame[:, side + 4:]
        self._curtain(frame, after_view, side)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        if not g.anim_kind:
            self._render_static(frame)
            self._idle_overlay(frame)
            return frame

        span = max(1, g.anim_total - 1)
        if g.anim_kind == "view":
            self._view_transition(frame, span)
            return frame

        preview_settle = (g.pending_state is not None and g.anim_kind != "success"
                          and g.anim_progress >= span)
        current = g.state
        if preview_settle:
            g.state = g.pending_state
        skip_slots = ()
        draw_cursor = True
        if not preview_settle and g.anim_kind == "swap":
            cursor = g.anim_before[1]
            skip_slots = (cursor, cursor + 1)
        if not preview_settle and g.anim_kind == "cursor":
            draw_cursor = False
        self._render_static(frame, skip_slots=skip_slots, draw_cursor=draw_cursor)
        if preview_settle:
            if g.pending_terminal == "loss":
                self._loss_overlay(frame)
        else:
            self._animation(frame, span)
        if preview_settle:
            g.state = current
        return frame


class G518(ARCBaseGame):
    def __init__(self):
        self.display = G518A(self); self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0; self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0; self.anim_before = self.state
        self.pending_state = None; self.pending_terminal = None; self.intro_mark = True; self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("g518", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]), False, len(levels), [1, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None; self.pending_terminal = None; self.intro_mark = True; self.terminal_hold = None

    def _begin(self, kind, frames, state, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = state; self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.anim_kind = None; self.pending_state = None; self.pending_terminal = None
        if terminal == "win": self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss" or self.budget_left <= 0: self.terminal_hold = "loss"; self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self._finish()
            return
        action = self.action.id.value
        if action == 0: self.complete_action(); return
        self.intro_mark = False
        if action == 6:
            won = solved(self.level, self.state); after = self.state if won else submit_transition(self.level, self.state)
            if not won:
                self.budget_left -= 1
            self._begin("success" if won else "miss", 7, after,
                        "win" if won else "loss" if after[4] <= 0 or self.budget_left <= 0 else None)
            return
        after = transition(self.level, self.state, action)
        if after == self.state:
            self._begin("miss", 4, after); return
        self.budget_left -= 1
        kind = "view" if action == 1 else "cursor" if action in (3, 4) else "swap"
        self._begin(kind, 5 if kind != "swap" else 7, after, "loss" if self.budget_left <= 0 else None)
