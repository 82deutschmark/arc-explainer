# ARC-AGI-3 candidate task g526.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


LEVELS = [
    {"name": "First Pleat", "n": 3, "plan": (5,), "budget": 3,
     "hinge_control": False, "side_control": False, "faces": False, "one_use": False, "required": (), "anchor": None},
    {"name": "Traveling Hinge", "n": 5, "plan": (4, 4, 5, 3, 3, 5, 4, 5), "budget": 10,
     "hinge_control": True, "side_control": False, "faces": False, "one_use": False, "required": (), "anchor": None},
    {"name": "Two Hands", "n": 5, "plan": (1, 4, 5, 1, 3, 5, 1, 4, 5, 4, 5), "budget": 13,
     "side_control": True, "faces": False, "one_use": False, "required": (), "anchor": None},
    {"name": "Night Printing", "n": 5, "plan": (4, 5, 1, 4, 5, 3, 3, 5, 1, 4, 5), "budget": 13,
     "side_control": True, "faces": True, "one_use": False, "required": (), "anchor": None},
    {"name": "Wax Memory", "n": 6, "plan": (4, 5, 4, 4, 5, 1, 3, 5, 3, 3, 5), "budget": 13,
     "side_control": True, "faces": True, "one_use": True, "required": (0, 1, 2, 3), "anchor": None},
    {"name": "Survey Nail", "n": 6, "plan": (3, 3, 5, 3, 5, 3, 3, 5, 3, 5, 3, 5), "budget": 14,
     "side_control": True, "faces": True, "one_use": False, "required": (), "anchor": 3,
     "require_anchor": True},
    {"name": "Sealed Archipelago", "n": 6,
     "plan": (3, 5, 3, 3, 5, 3, 3, 5, 4, 5, 4, 4, 5), "budget": 15,
     "side_control": True, "faces": True, "one_use": True, "required": (1, 2, 3), "anchor": 4,
     "require_anchor": True},
    {"name": "Atlas Loom", "n": 7,
     "plan": (3, 3, 5, 3, 3, 5, 3, 3, 5, 3, 5, 3, 3, 5, 3, 3, 5), "budget": 19,
     "side_control": True, "faces": True, "one_use": True, "required": (1, 2, 3), "anchor": 4,
     "require_anchor": True},
]


def start_state(level):
    return tuple((index, 0) for index in range(level["n"])), 0, 1, 0, 0


def fold_side(level, state):
    panels, hinge, side, spent, anchor_used = state
    selected = range(hinge + 1) if side == 0 else range(hinge + 1, len(panels))
    effective = side
    anchor = level.get("anchor")
    if anchor is not None and any(panels[index][0] == anchor for index in selected):
        effective = 1 - side
        anchor_used = 1
    if level.get("one_use") and spent & (1 << hinge):
        return state
    lifted = list(panels[:hinge + 1] if effective == 0 else panels[hinge + 1:])
    grounded = list(panels[hinge + 1:] if effective == 0 else panels[:hinge + 1])
    lifted = [(identity, 1 - face) for identity, face in reversed(lifted)]
    result = tuple(lifted + grounded if effective == 0 else grounded + lifted)
    return result, hinge, side, spent | (1 << hinge), anchor_used


def transition(level, state, action):
    panels, hinge, side, spent, anchor_used = state
    if action == 1 and level.get("side_control"):
        return panels, hinge, 1 - side, spent, anchor_used
    if action == 3 and level.get("hinge_control", True):
        return panels, (hinge - 1) % (len(panels) - 1), side, spent, anchor_used
    if action == 4 and level.get("hinge_control", True):
        return panels, (hinge + 1) % (len(panels) - 1), side, spent, anchor_used
    if action == 5:
        return fold_side(level, state)
    return state


_TARGET_CACHE = {}


def target_state(level):
    if level["name"] not in _TARGET_CACHE:
        state = start_state(level)
        for action in level["plan"]:
            state = transition(level, state, action)
        _TARGET_CACHE[level["name"]] = state
    return _TARGET_CACHE[level["name"]]


def solved(level, state):
    target = target_state(level)
    current_panels, _, _, spent, anchor_used = state
    if level.get("faces"):
        panel_match = current_panels == target[0]
    else:
        panel_match = tuple(x for x, _ in current_panels) == tuple(x for x, _ in target[0])
    required = sum(1 << hinge for hinge in level.get("required", ()))
    return (panel_match and spent & required == required
            and (not level.get("require_anchor") or anchor_used))


class G526A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def _background(self, frame):
        frame[:, :] = INK
        frame[5:59, 3:61] = CHARCOAL
        for y in range(7, 58, 6):
            frame[y, 5 + y % 4:60:8] = SLATE
        for x in range(6, 60, 9):
            frame[8 + x % 3:58:8, x] = EARTH
        frame[17:51, 4:60] = ASH

    @staticmethod
    def _xs(n):
        width = max(6, 48 // n)
        start = (64 - n * width) // 2
        return tuple(start + index * width for index in range(n)), width

    def _glyph(self, frame, identity, face, center, scale=1):
        x, y = center
        color = (AQUA, GOLD, CORAL, GREEN, VIOLET, ROSE, BLUE)[identity % 7]
        if identity % 7 == 0:
            self._disc(frame, center, 2 * scale, color)
            self._disc(frame, center, max(0, scale - 1), INK)
        elif identity % 7 == 1:
            for d in range(-2 * scale, 2 * scale + 1):
                span = 2 * scale - abs(d)
                frame[y + d, x - span:x + span + 1] = color
        elif identity % 7 == 2:
            for row in range(4 * scale + 1):
                span = row if face == 0 else 4 * scale - row
                yy = y - 2 * scale + row
                frame[yy, x - span // 2:x + span // 2 + 1] = color
        elif identity % 7 == 3:
            frame[y - 2 * scale:y + 2 * scale + 1, x] = color
            frame[y, x - 2 * scale:x + 2 * scale + 1] = color
        elif identity % 7 == 4:
            self._line(frame, (x - 2 * scale, y - 2 * scale), (x + 2 * scale, y + 2 * scale), color)
            self._line(frame, (x + 2 * scale, y - 2 * scale), (x - 2 * scale, y + 2 * scale), color)
        elif identity % 7 == 5:
            frame[y - scale:y + scale + 1, x - 2 * scale:x + 2 * scale + 1] = color
        else:
            frame[y - 2 * scale:y + 2 * scale + 1, x - 2 * scale] = color
            frame[y - 2 * scale:y + 2 * scale + 1, x + 2 * scale] = color
            frame[y - 2 * scale, x - 2 * scale:x + 2 * scale + 1] = color
            frame[y + 2 * scale, x - 2 * scale:x + 2 * scale + 1] = color
        if face:
            frame[y + 3 * scale:y + 4 * scale + 1, x - scale:x + scale + 1] = PAPER
        else:
            frame[y - 4 * scale:y - 2 * scale, x - scale:x + scale + 1] = PAPER

    def _panel(self, frame, left, width, panel, anchor=False, tiny=False):
        identity, face = panel
        top, bottom = (20, 43) if not tiny else (8, 15)
        color = PEARL if face == 0 else SLATE
        inset = 1 if not tiny else 0
        frame[top + inset:bottom - inset, left + 1:left + width - 1] = color
        frame[top, left + 2:left + width - 2] = PAPER
        frame[bottom - 1, left + 2:left + width - 2] = EARTH
        if not tiny:
            self._glyph(frame, identity, face, (left + width // 2, 31))
            if anchor:
                self._disc(frame, (left + width // 2, 38), 3, GOLD)
                self._disc(frame, (left + width // 2, 38), 1, INK)
                if self.game.state[4]:
                    frame[38, left + 1:left + width - 1] = GOLD
        else:
            x, y = left + width // 2, 11
            color = (AQUA, GOLD, CORAL, GREEN, VIOLET, ROSE, BLUE)[identity % 7]
            if identity % 7 == 0:
                self._disc(frame, (x, y), 1, color)
                frame[y, x] = INK
            elif identity % 7 == 1:
                frame[y - 1:y + 2, x] = color
                frame[y, x - 1:x + 2] = color
            elif identity % 7 == 2:
                frame[y - 2:y + 3, x] = color
            elif identity % 7 == 3:
                frame[y, x - 2:x + 3] = color
            elif identity % 7 == 4:
                for d in (-1, 0, 1):
                    frame[y + d, x + d] = color
            elif identity % 7 == 5:
                for d in (-1, 0, 1):
                    frame[y + d, x - d] = color
            else:
                frame[y - 1:y + 2, x - 1] = color
                frame[y - 1:y + 2, x + 1] = color
            frame[14 if face else 8, left + 2:left + width - 2] = PAPER

    def _target(self, frame):
        g = self.game
        xs, width = self._xs(len(g.state[0]))
        target = target_state(g.level)[0]
        for left, panel in zip(xs, target):
            shown = panel if g.level.get("faces") else (panel[0], 0)
            self._panel(frame, left, width, shown, tiny=True)

    def _map(self, frame):
        g = self.game
        xs, width = self._xs(len(g.state[0]))
        for left, panel in zip(xs, g.state[0]):
            self._panel(frame, left, width, panel, panel[0] == g.level.get("anchor"))
        for seam in range(len(xs) - 1):
            x = xs[seam] + width
            spent = bool(g.state[3] & (1 << seam))
            color = RED if spent else GOLD
            for y in range(22, 43, 4):
                frame[y, x + ((y // 4) % 2 if spent else 0)] = color
            if spent:
                frame[32, x - 2:x + 3] = color
            if seam in g.level.get("required", ()):
                self._disc(frame, (x, 47), 2 if not spent else 1, color)
                if spent:
                    self._line(frame, (x - 2, 45), (x + 2, 49), INK)
        hinge_x = xs[g.state[1]] + width
        frame[19:46, hinge_x] = CORAL
        if g.state[2] == 0:
            frame[18, xs[0]:hinge_x + 1] = CORAL
            frame[46, hinge_x:xs[-1] + width:3] = SLATE
        else:
            frame[18, hinge_x:xs[-1] + width] = CORAL
            frame[46, xs[0]:hinge_x:3] = SLATE

    def _budget(self, frame):
        g = self.game
        for index in range(g.budget_max):
            x = 6 + index * 52 // max(1, g.budget_max - 1)
            if index < g.budget_left:
                self._disc(frame, (x, 57), 1, GOLD)
            else:
                frame[57, x] = SLATE

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            frame[4:7, 7:58:3] = AQUA
        if g.terminal_hold == "win":
            for radius, color in ((19, GOLD), (13, VIOLET), (7, PAPER)):
                self._disc(frame, (32, 33), radius, color)
        elif g.terminal_hold == "loss":
            frame[18:51:3, 4:60] = RED
            frame[18:51, 4:60:5] = INK
        if not g.anim_kind:
            return
        p = g.anim_progress
        xs, width = self._xs(len(g.state[0]))
        if g.anim_kind == "cursor":
            a = xs[g.anim_from] + width
            b = xs[g.anim_to] + width
            x = a + (b - a) * p // g.anim_total
            frame[16:49, x] = GOLD
        elif g.anim_kind == "side":
            y = 17 + p
            frame[y, xs[0]:xs[-1] + width:2] = CORAL
        elif g.anim_kind == "fold":
            hinge_x = xs[g.state[1]] + width
            radius = 2 + p * 3
            for dx in range(-min(radius, 28), min(radius, 28) + 1):
                yy = 19 + abs(dx) * max(1, 8 - p) // max(1, radius)
                x = hinge_x + dx
                if 4 <= x < 60 and yy < 48:
                    frame[yy, x] = PAPER if p < 4 else GOLD
            if g.pending_state is not None and p >= 4:
                for index, panel in enumerate(g.pending_state[0]):
                    self._glyph(frame, panel[0], panel[1], (xs[index] + width // 2, 31))
        elif g.anim_kind == "blocked":
            x = xs[g.state[1]] + width
            frame[21 + p:44 - p:2, x - 3:x + 4] = RED
        elif g.anim_kind == "miss":
            frame[9 + p:17, 6:58:3] = RED
        elif g.anim_kind == "success":
            self._disc(frame, (32, 31), min(12, 3 + 2 * p), GOLD)
            self._disc(frame, (32, 31), min(7, 1 + p), PAPER)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame)
        self._target(frame)
        self._map(frame)
        self._budget(frame)
        self._animation(frame)
        return frame


class G526(ARCBaseGame):
    def __init__(self):
        self.display = G526A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("g526", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]),
                         False, len(levels), [1, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def _begin(self, kind, frames, *, next_state=None, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = next_state
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        if self.pending_state is not None:
            self.state = self.pending_state
        self.anim_kind = None
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
                self._finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        if action == 6:
            won = solved(self.level, self.state)
            if not won:
                self.budget_left -= 1
            self._begin("success" if won else "miss", 6,
                        terminal="win" if won else ("loss" if self.budget_left <= 0 else None))
            return
        after = transition(self.level, self.state, action)
        if after == self.state:
            self._begin("blocked", 4)
            return
        self.budget_left -= 1
        self.anim_from, self.anim_to = self.state[1], after[1]
        kind = "side" if action == 1 else "cursor" if action in (3, 4) else "fold"
        self._begin(kind, 7 if kind == "fold" else 4, next_state=after,
                    terminal="loss" if self.budget_left <= 0 else None)
