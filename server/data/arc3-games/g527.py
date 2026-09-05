# ARC-AGI-3 candidate task g527.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}


LEVELS = [
    {"name": "First Ribbon", "demo": (4, 1, 3), "rotation": 0, "mirror": False},
    {"name": "Quarter Canopy", "demo": (1, 4, 2, 3, 1, 4, 2, 3, 1, 2),
     "rotation": 1, "mirror": False},
    {"name": "Mirror Silk", "demo": (3, 1, 4, 2, 4, 1, 3, 2, 1, 2),
     "rotation": 1, "mirror": True},
    {"name": "Backspool", "demo": (1, 4, 4, 2, 3, 1, 2, 4, 3, 3),
     "rotation": 1, "mirror": True, "reverse": True},
    {"name": "Turning Beats", "demo": (1, 4, 2, 3, 4, 1, 3, 2, 4, 1),
     "rotation": 1, "mirror": True, "reverse": True,
     "beat_turns": (0, 1, 2, 3, 1, 0, 2, 1, 3, 2)},
    {"name": "Echo Rosettes", "demo": (4, 1, 3, 2, 4, 1, 2),
     "rotation": 1, "mirror": True, "reverse": True,
     "beat_turns": (0, 1, 2, 1, 3, 0, 2),
     "echoes": (True, False, True, False, False, True, False)},
    {"name": "Reversed Looking Glass", "demo": (1, 4, 2, 3, 1, 3, 4, 2, 1, 4, 3),
     "rotation": 1, "mirror": True, "reverse": True,
     "beat_turns": (0, 1, 0, 2, 1, 3, 0, 2, 3, 1, 2)},
    {"name": "Silk Compass", "demo": (4, 1, 3, 2, 4, 2, 1, 3),
     "rotation": 3, "mirror": True, "reverse": True,
     "beat_turns": (0, 1, 3, 2, 1, 0, 2, 3),
     "echoes": (True, False, True, False, True, False, True, False)},
]


def transform(action, rotation, mirror):
    dx, dy = DIRS[action]
    if mirror:
        dx = -dx
    for _ in range(rotation % 4):
        dx, dy = -dy, dx
    return next(key for key, vector in DIRS.items() if vector == (dx, dy))


def expanded_specs(level):
    turns = level.get("beat_turns", (0,) * len(level["demo"]))
    echoes = level.get("echoes", (False,) * len(level["demo"]))
    cards = list(zip(level["demo"], turns, echoes, range(len(level["demo"]))))
    if level.get("reverse"):
        cards.reverse()
    out = []
    for action, turn, echo, card_index in cards:
        item = (transform(action, level["rotation"] + turn, level["mirror"]), card_index)
        out.append(item)
        if echo:
            out.append(item)
    return tuple(out)


def expected_actions(level):
    return tuple(action for action, _card in expanded_specs(level))


def start_state(_level):
    return 0, 2, 0


def transition(level, state, action):
    progress, chances, terminal = state
    expected = expected_actions(level)
    if terminal or chances <= 0 or progress >= len(expected) or action not in DIRS:
        return state
    if action == expected[progress]:
        progress += 1
        return progress, chances, 2 if progress == len(expected) else 0
    chances -= 1
    return progress, chances, 3 if chances == 0 else 0


def solved(_level, state):
    return state[-1] == 2


class G527A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            x = x0 + (x1 - x0) * index // steps
            y = y0 + (y1 - y0) * index // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def _diamond(self, frame, center, radius, color, hollow=False):
        x, y = center
        for dy in range(-radius, radius + 1):
            width = radius - abs(dy)
            yy = y + dy
            if not 0 <= yy < 64:
                continue
            if hollow:
                for xx in (x - width, x + width):
                    if 0 <= xx < 64:
                        frame[yy, xx] = color
            else:
                frame[yy, max(0, x - width):min(64, x + width + 1)] = color

    def _arrow(self, frame, action, center, color):
        x, y = center
        dx, dy = DIRS[action]
        self._line(frame, (x - dx * 2, y - dy * 2), (x + dx * 3, y + dy * 3), color)
        px, py = -dy, dx
        self._line(frame, (x + dx * 3, y + dy * 3),
                   (x + dx - px * 2, y + dy - py * 2), color)
        self._line(frame, (x + dx * 3, y + dy * 3),
                   (x + dx + px * 2, y + dy + py * 2), color)

    @staticmethod
    def _positions(count):
        start = -math.pi / 2
        return tuple((32 + round(22 * math.cos(start + 2 * math.pi * index / count)),
                      31 + round(22 * math.sin(start + 2 * math.pi * index / count)))
                     for index in range(count))

    @staticmethod
    def _progress_position(count, index):
        return 5 + round(index * 54 / max(1, count - 1)), 60

    def _background(self, frame):
        frame[:, :] = PAPER
        for y in range(2, 62, 6):
            frame[y, 3 + (y // 2) % 5:61:8] = PEARL
        for x in range(4, 61, 9):
            frame[4 + x % 3:59:9, x] = ASH
        self._disc(frame, (32, 31), 29, ROSE)
        self._disc(frame, (32, 31), 27, PAPER)
        for index in range(16):
            angle = 2 * math.pi * index / 16
            point = (32 + round(27 * math.cos(angle)), 31 + round(27 * math.sin(angle)))
            self._disc(frame, point, 2, (AQUA, MAGENTA, GOLD, CORAL)[index % 4])

    def _kite(self, frame, center, error=False):
        x, y = center
        silk = RED if error else MAGENTA
        fill = ROSE if error else PEARL
        self._diamond(frame, center, 7, fill)
        self._line(frame, (x, y - 7), (x + 7, y), silk)
        self._line(frame, (x + 7, y), (x, y + 7), silk)
        self._line(frame, (x, y + 7), (x - 7, y), silk)
        self._line(frame, (x - 7, y), (x, y - 7), silk)
        self._line(frame, (x, y - 7), (x, y + 7), VIOLET)
        self._line(frame, (x, y), (x + 7, y), AQUA)
        self._line(frame, (x, y + 7), (x - 4, y + 12), CORAL)
        self._line(frame, (x - 4, y + 12), (x, y + 15), GOLD)

    def _apparatus(self, frame, draw_kite):
        level = self.game.level
        self._disc(frame, (32, 31), 9, PEARL)
        self._disc(frame, (32, 31), 7, AQUA, hollow=True)
        if draw_kite:
            self._kite(frame, (32, 31))
        if level.get("mirror"):
            self._line(frame, (20, 21), (20, 42), BLUE, dotted=True)
            self._line(frame, (44, 21), (44, 42), BLUE, dotted=True)
            for y in (24, 31, 38):
                self._line(frame, (17, y), (20, y - 2), BLUE)
                self._line(frame, (47, y), (44, y - 2), BLUE)
        if level.get("reverse"):
            self._arrow(frame, 3, (27, 5), VIOLET)
            self._arrow(frame, 4, (37, 5), ASH)

    def _compass_overlay(self, frame):
        level = self.game.level
        direction = (1, 4, 2, 3)[level["rotation"] % 4]
        self._arrow(frame, direction, (32, 31), INK)
        for index in range(level["rotation"] % 4):
            frame[28 + index * 3:30 + index * 3, 21:24] = VIOLET

    def _progress_mark(self, frame, center, complete):
        x, y = center
        if complete:
            self._disc(frame, center, 2, GREEN)
            frame[y, x] = PAPER
        else:
            self._line(frame, (x, y - 2), (x + 2, y), SLATE)
            self._line(frame, (x + 2, y), (x, y + 2), SLATE)
            self._line(frame, (x, y + 2), (x - 2, y), SLATE)
            self._line(frame, (x - 2, y), (x, y - 2), SLATE)

    def _current_pointer(self, frame, center, card_radius):
        x, y = center
        vx, vy = 32 - x, 31 - y
        scale = max(abs(vx), abs(vy), 1)
        distance = card_radius + 3
        point = (x + round(vx * distance / scale), y + round(vy * distance / scale))
        self._diamond(frame, point, 2, INK, hollow=True)
        inner = (point[0] + (1 if vx > 0 else -1 if vx < 0 else 0) * 2,
                 point[1] + (1 if vy > 0 else -1 if vy < 0 else 0) * 2)
        self._line(frame, point, inner, INK)

    def _cards(self, frame):
        g = self.game
        level = g.level
        positions = self._positions(len(level["demo"]))
        specs = expanded_specs(level)
        current_card = specs[min(g.state[0], len(specs) - 1)][1] if not solved(level, g.state) else -1
        turns = level.get("beat_turns", (0,) * len(level["demo"]))
        echoes = level.get("echoes", (False,) * len(level["demo"]))
        compact = len(level["demo"]) >= 10
        card_radius = 4 if compact else 5
        halo_radius = 6 if compact else 7
        for index, (action, center) in enumerate(zip(level["demo"], positions)):
            self._disc(frame, center, card_radius, GOLD if index == current_card else PEARL)
            self._disc(frame, center, card_radius, VIOLET, hollow=True)
            self._arrow(frame, action, center, INK)
            for notch in range(turns[index]):
                x, y = center
                frame[max(0, y - card_radius - 1 - notch), max(0, x - 1):min(64, x + 2)] = MAGENTA
            if echoes[index]:
                self._disc(frame, center, halo_radius, AQUA, hollow=True)
            if index == current_card:
                self._current_pointer(frame, center, halo_radius if echoes[index] else card_radius)
        count = len(specs)
        sewing = g.anim_kind in ("step", "success") and g.pending_state is not None
        for index in range(count):
            if sewing and index == g.state[0]:
                continue
            self._progress_mark(frame, self._progress_position(count, index), index < g.state[0])

    def _hud(self, frame):
        g = self.game
        for index, x in enumerate((54, 60)):
            if index < g.state[1]:
                self._disc(frame, (x, 5), 3, AQUA, hollow=True)
                frame[3:8, x:x + 3] = PAPER
            else:
                self._line(frame, (x - 2, 3), (x + 2, 7), RED)
                self._line(frame, (x + 2, 3), (x - 2, 7), RED)

    def _sew_rosette(self, frame, progress, total):
        g = self.game
        count = len(expanded_specs(g.level))
        center = self._progress_position(count, g.state[0])
        if progress <= 0:
            self._progress_mark(frame, center, False)
            return
        if progress >= total - 1:
            self._progress_mark(frame, center, True)
            return
        x, y = center
        petals = min(4, 1 + 4 * progress // max(1, total - 1))
        frame[y, x] = GREEN
        for dx, dy in ((0, -2), (2, 0), (0, 2), (-2, 0))[:petals]:
            self._line(frame, (x, y), (x + dx, y + dy), GREEN)

    @staticmethod
    def _travel(progress, total, distance):
        span = max(2, total - 1)
        half = max(1, span // 2)
        folded = progress if progress <= half else span - progress
        return max(0, distance * folded // half)

    def _animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                for radius in (4, 8, 12):
                    self._disc(frame, (32, 31), radius, GOLD, hollow=True)
            if g.terminal_hold == "loss":
                self._line(frame, (14, 18), (50, 44), RED)
                self._line(frame, (50, 18), (14, 44), RED)
            elif g.terminal_hold == "win":
                for radius in (9, 15, 21):
                    self._disc(frame, (32, 31), radius, GREEN, hollow=True)
            return
        progress = g.anim_progress
        total = max(1, g.anim_total)
        dx, dy = DIRS[g.anim_action]
        px, py = -dy, dx
        travel = self._travel(progress, total, 12 if g.anim_kind != "miss" else 9)
        lift = self._travel(progress, total, 2)
        center = (32 + dx * travel + px * lift, 31 + dy * travel + py * lift)
        if g.anim_kind in ("step", "success"):
            self._kite(frame, center)
            self._line(frame, (32, 31), center, AQUA, dotted=True)
            self._sew_rosette(frame, progress, total)
            if g.anim_kind == "success":
                for radius in range(5, min(28, 5 + progress * 4), 5):
                    self._disc(frame, (32, 31), radius, GREEN, hollow=True)
        elif g.anim_kind == "miss":
            self._kite(frame, center, error=True)
            for feather in range(progress + 1):
                along = 2 + feather * 2
                side = (1 if feather % 2 == 0 else -1) * (2 + feather // 2)
                origin = (center[0] - dx * along + px * side,
                          center[1] - dy * along + py * side)
                tip = (origin[0] + px * (2 if side > 0 else -2), origin[1] + py * (2 if side > 0 else -2))
                self._line(frame, origin, tip, CORAL)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        moving = self.game.anim_kind in ("step", "success", "miss")
        self._background(frame)
        self._cards(frame)
        self._apparatus(frame, draw_kite=not moving)
        self._hud(frame)
        self._animation(frame)
        self._compass_overlay(frame)
        return frame


class G527(ARCBaseGame):
    def __init__(self):
        self.display = G527A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_action = 4
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q111", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def _begin(self, kind, frames, action, state, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.anim_action = action
        self.pending_state = state
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.anim_kind = None
        self.pending_state = None
        self.pending_terminal = None
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
                self._finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        correct = after[0] > self.state[0]
        won = after[-1] == 2
        lost = after[-1] == 3
        self._begin("success" if won else "step" if correct else "miss", 7,
                    action, after, "win" if won else "loss" if lost else None)
