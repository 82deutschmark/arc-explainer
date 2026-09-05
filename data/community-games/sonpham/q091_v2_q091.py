# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q091-v2 Hearthwork Atelier -- assemble keyed artifacts on a tactile bench.

Parts expose shape-coded leaves and oriented ports.  The player moves a bench
cursor, lifts two parts, chooses a persistent fixture, and presses.  Later work
orders add rotation, unlike fixtures, and limited fixture faces.
"""

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


CREAM, PEARL, FELT, WOOD, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RUST, BLUE, TEAL, MUSTARD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
DANGER = MAGENTA


def R(a, b, tool, ra, rb, out, ro=0):
    return (a, b, tool, ra, rb, out, ro)


LEVELS = [
    {"name": "First Snap", "parts": ((1, 0), (2, 0)), "target": 3,
     "tools": (0,), "limits": (9,), "rotatable": False,
     "recipes": (R(1, 2, 0, 0, 0, 3),), "budget": 6},
    {"name": "Growing Key", "parts": ((1, 0), (2, 0), (4, 0), (8, 0)), "target": 15,
     "tools": (0,), "limits": (9,), "rotatable": False,
     "recipes": (R(1, 2, 0, 0, 0, 3), R(3, 4, 0, 0, 0, 7), R(7, 8, 0, 0, 0, 15)), "budget": 15},
    {"name": "Turning Teeth", "parts": ((1, 0), (2, 0), (4, 0), (8, 0)), "target": 15,
     "tools": (0,), "limits": (9,), "rotatable": True,
     "recipes": (R(1, 2, 0, 1, 0, 3), R(3, 4, 0, 0, 2, 7), R(7, 8, 0, 0, 1, 15)), "budget": 18},
    {"name": "Brass Clamp", "parts": ((1, 0), (2, 0), (4, 0), (8, 0)), "target": 15,
     "tools": (0, 1), "limits": (9, 9), "rotatable": False,
     "recipes": (R(1, 2, 1, 0, 0, 3), R(4, 8, 0, 0, 0, 12), R(3, 12, 1, 0, 0, 15)), "budget": 17},
    {"name": "Two Fixtures", "parts": ((1, 0), (2, 0), (4, 0), (8, 0)), "target": 15,
     "tools": (0, 1, 2), "limits": (9, 9, 9), "rotatable": False,
     "recipes": (R(1, 4, 1, 0, 0, 5), R(2, 8, 2, 0, 0, 10), R(5, 10, 0, 0, 0, 15)), "budget": 18},
    {"name": "Finite Faces", "parts": ((1, 0), (2, 0), (4, 0), (8, 0), (16, 0)), "target": 31,
     "tools": (0, 1, 2), "limits": (9, 1, 2), "rotatable": False,
     "recipes": (R(1, 2, 2, 0, 0, 3), R(4, 8, 1, 0, 0, 12), R(3, 16, 2, 0, 0, 19), R(12, 19, 0, 0, 0, 31)), "budget": 25},
    {"name": "Rose Engine", "parts": ((1, 0), (2, 0), (4, 0), (8, 0), (16, 0), (32, 0)), "target": 63,
     "tools": (0, 1, 2), "limits": (9, 2, 2), "rotatable": True,
     "recipes": (R(1, 16, 1, 1, 0, 17), R(2, 8, 2, 0, 2, 10), R(4, 32, 1, 3, 1, 36),
                 R(10, 17, 2, 0, 0, 27), R(27, 36, 0, 0, 0, 63)), "budget": 39},
    {"name": "Hearthwork Atelier", "parts": ((1, 0), (2, 0), (4, 0), (8, 0), (16, 0), (32, 0)), "target": 63,
     "tools": (0, 1, 2), "limits": (9, 2, 2), "rotatable": True,
     "recipes": (R(1, 32, 2, 1, 3, 33), R(2, 16, 1, 2, 0, 18), R(4, 8, 2, 0, 1, 12),
                 R(18, 33, 1, 0, 0, 51), R(12, 51, 0, 0, 0, 63)), "budget": 40},
]


def start_state(level):
    # ordered (mask, orientation) parts; cursor; selected indices; tool slot; uses; strikes
    return tuple(level["parts"]), 0, (), 0, tuple(0 for _ in level["tools"]), 2


def _recipe(level, left, right, tool):
    for a, b, needed, ra, rb, out, ro in level["recipes"]:
        if needed != tool:
            continue
        if left == (a, ra) and right == (b, rb):
            return out, ro
        if left == (b, rb) and right == (a, ra):
            return out, ro
    return None


def keyed_orientation(level, mask):
    """Return the single alternate detent authored for a loose part, if any."""
    for a, b, _tool, ra, rb, _out, _ro in level["recipes"]:
        if a == mask and ra:
            return ra
        if b == mask and rb:
            return rb
    return 0


def transition(level, state, action):
    parts, cursor, selected, tool_slot, uses, strikes = state
    if strikes <= 0 or any(mask == level["target"] for mask, _ in parts):
        return state
    n = len(parts)
    if action == 1:
        return parts, (cursor - 1) % n, selected, tool_slot, uses, strikes
    if action == 2:
        return parts, (cursor + 1) % n, selected, tool_slot, uses, strikes
    if action == 3:
        chosen = list(selected)
        if cursor in chosen:
            chosen.remove(cursor)
        elif len(chosen) < 2:
            chosen.append(cursor)
        return parts, cursor, tuple(chosen), tool_slot, uses, strikes
    if action == 4:
        if not level.get("rotatable"):
            return state
        revised = list(parts)
        mask, orient = revised[cursor]
        detent = keyed_orientation(level, mask)
        if not detent:
            return state
        revised[cursor] = (mask, detent if orient == 0 else 0)
        return tuple(revised), cursor, selected, tool_slot, uses, strikes
    if action == 5:
        if len(level["tools"]) < 2:
            return state
        return parts, cursor, selected, (tool_slot + 1) % len(level["tools"]), uses, strikes
    if action != 6 or len(selected) != 2:
        return state
    i, j = sorted(selected)
    tool = level["tools"][tool_slot]
    result = _recipe(level, parts[i], parts[j], tool)
    if result is None or uses[tool_slot] >= level["limits"][tool_slot]:
        return parts, cursor, (), tool_slot, uses, strikes - 1
    revised = list(parts)
    revised.pop(j); revised.pop(i); revised.append(result)
    use_list = list(uses); use_list[tool_slot] += 1
    return tuple(revised), min(i, len(revised) - 1), (), tool_slot, tuple(use_list), strikes


def solved(level, state):
    return any(mask == level["target"] for mask, _ in state[0]) and state[5] > 0


class AtelierDisplay(RenderableUserDisplay):
    COLORS = (RUST, TEAL, MUSTARD, VIOLET, GREEN, ROSE, BLUE)

    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def _centers(n):
        if n <= 4:
            return ((14, 29), (28, 26), (42, 26), (52, 34))[:n]
        return tuple((10 + (i % 4) * 14, 25 + (i // 4) * 17) for i in range(n))

    def _background(self, frame):
        frame[:, :] = CREAM
        # Warm wooden apron with irregular grain; felt work island is rounded.
        frame[10:59, 3:61] = WOOD
        for y in range(12, 58, 6):
            frame[y, 5 + y % 5:59:9] = EARTH
        frame[16:54, 6:58] = PEARL
        self._disc(frame, (16, 35), 14, FELT)
        self._disc(frame, (43, 35), 14, FELT)
        frame[22:49, 16:44] = FELT
        for x in range(7, 58, 7):
            frame[53:56, x:x + 3] = CHARCOAL

    def _leaf(self, frame, bit, center, scale=1):
        x, y = center; color = self.COLORS[bit % len(self.COLORS)]
        kind = bit % 7
        if kind == 0:
            self._disc(frame, center, 2 * scale, color, hollow=True)
        elif kind == 1:
            for row in range(4 * scale + 1):
                span = row if row <= 2 * scale else 4 * scale - row
                frame[y - 2 * scale + row, x - span:x + span + 1] = color
        elif kind == 2:
            frame[y - 2 * scale:y + 3 * scale, x] = color
            frame[y, x - 2 * scale:x + 3 * scale] = color
        elif kind == 3:
            self._line(frame, (x - 2 * scale, y - 2 * scale), (x + 2 * scale, y + 2 * scale), color)
            self._line(frame, (x + 2 * scale, y - 2 * scale), (x - 2 * scale, y + 2 * scale), color)
        elif kind == 4:
            frame[y - 2 * scale:y + 3 * scale, x - 2 * scale] = color
            frame[y - 2 * scale:y + 3 * scale, x + 2 * scale] = color
            frame[y, x - 2 * scale:x + 3 * scale] = color
        elif kind == 5:
            self._disc(frame, center, 2 * scale, color)
            frame[y - scale:y + scale + 1, x - scale:x + scale + 1] = PEARL
        else:
            frame[y - 2 * scale:y + 3 * scale, x] = color
            frame[y - 2 * scale:y + 1, x - 2 * scale:x + 3 * scale] = color

    @staticmethod
    def _join_info(level, parts, index):
        mask = parts[index][0]
        present = {item[0] for item in parts}
        for recipe_index, (a, b, tool, ra, rb, _out, _ro) in enumerate(level["recipes"]):
            if mask == a and b in present:
                return recipe_index, tool, ra
            if mask == b and a in present:
                return recipe_index, tool, rb
        return None

    def _part(self, frame, part, center, selected=False, cursor=False, tiny=False,
              join_info=None, target=False):
        mask, orient = part; x, y = center
        radius = 4 if tiny else 7
        # Irregular ceramic medallion and tooth direction encode orientation.
        self._disc(frame, center, radius, CREAM)
        self._disc(frame, center, radius, CHARCOAL, hollow=True)
        port = ((0, -radius - 2), (radius + 2, 0), (0, radius + 2), (-radius - 2, 0))[orient]
        px, py = x + port[0], y + port[1]
        if target:
            self._disc(frame, (px, py), 2 if not tiny else 1, MUSTARD)
        elif join_info is None:
            # A capped port has crossed geometry until its dependency exists.
            self._disc(frame, (px, py), 2 if not tiny else 1, CHARCOAL, hollow=True)
            self._line(frame, (px - 1, py - 1), (px + 1, py + 1), EARTH)
            self._line(frame, (px + 1, py - 1), (px - 1, py + 1), EARTH)
        else:
            recipe_index, tool, _required_orientation = join_info
            key = recipe_index % 3
            if key == 0:
                self._disc(frame, (px, py), 2 if not tiny else 1, MUSTARD, hollow=True)
            elif key == 1:
                for row in range(5):
                    span = row if row <= 2 else 4 - row
                    frame[py - 2 + row, px - span:px + span + 1] = MUSTARD
            else:
                frame[py - 2:py + 3, px] = MUSTARD
                frame[py, px - 2:px + 3] = MUSTARD
            # Fixture requirement is a second, non-color silhouette around the key.
            if tool == 1:
                frame[py - 3:py + 4, px - 4] = RUST
                frame[py - 3:py + 4, px + 4] = RUST
            elif tool == 2:
                self._line(frame, (px - 3, py + 3), (px, py - 4), VIOLET)
                self._line(frame, (px, py - 4), (px + 3, py + 3), VIOLET)
        bits = [i for i in range(7) if mask & (1 << i)]
        if len(bits) == 1:
            self._leaf(frame, bits[0], center, 1)
        else:
            offsets = ((-3, -2), (3, -2), (-3, 3), (3, 3), (0, -4), (0, 4), (0, 0))
            for bit, offset in zip(bits, offsets):
                self._leaf(frame, bit, (x + offset[0], y + offset[1]), 1)
        if selected:
            frame[y - radius - 2:y - radius, x - radius:x + radius + 1] = TEAL
            frame[y + radius + 1:y + radius + 3, x - radius:x + radius + 1] = TEAL
            frame[y - radius:y + radius + 1, x - radius - 2:x - radius] = TEAL
            frame[y - radius:y + radius + 1, x + radius + 1:x + radius + 3] = TEAL
        if cursor:
            self._disc(frame, (x, y + radius + 4), 2, RUST)
            frame[y + radius + 3, x] = CREAM

    def _target(self, frame):
        target = (self.game.level["target"], 0)
        self._part(frame, target, (32, 8), tiny=True, target=True)
        frame[7:10, 21:24] = MUSTARD
        frame[7:10, 40:43] = MUSTARD
        self._line(frame, (24, 8), (27, 8), EARTH, dotted=True)
        self._line(frame, (37, 8), (40, 8), EARTH, dotted=True)

    def _tools(self, frame):
        g = self.game; state = g.state
        for slot, tool in enumerate(g.level["tools"]):
            x = 10 + slot * 16; y = 59
            active = slot == state[3]
            color = RUST if active else CHARCOAL
            if active:
                # Raised U-bracket makes the active fixture legible without hue.
                frame[y - 8:y - 6, x - 5:x + 6] = MUSTARD
                frame[y - 8:y - 2, x - 5:x - 3] = MUSTARD
                frame[y - 8:y - 2, x + 3:x + 5] = MUSTARD
            if tool == 0:  # bare wooden press
                frame[y - 4:y + 1, x - 3:x - 1] = color
                frame[y - 4:y + 1, x + 1:x + 3] = color
                frame[y - 1:y + 1, x - 3:x + 3] = color
            elif tool == 1:  # clamp jaws
                frame[y - 5:y + 1, x - 4:x - 2] = color
                frame[y - 5:y + 1, x + 2:x + 4] = color
                frame[y - 5:y - 3, x - 4:x + 4] = color
            else:  # triangular punch
                for row in range(6):
                    frame[y - 5 + row, x - row // 2:x + row // 2 + 1] = color
            remaining = g.level["limits"][slot] - state[4][slot]
            for token in range(min(3, remaining)):
                self._disc(frame, (x - 3 + token * 3, 62), 1, MUSTARD)

    def _bench(self, frame):
        g = self.game; parts, cursor, selected, _, _, _ = g.state
        centers = self._centers(len(parts))
        # A live exploded-order diagram links only currently compatible inputs.
        positions = {part[0]: centers[i] for i, part in enumerate(parts)}
        for recipe_index, (a, b, tool, _ra, _rb, _out, _ro) in enumerate(g.level["recipes"]):
            if a not in positions or b not in positions:
                continue
            color = EARTH if tool == 0 else RUST if tool == 1 else VIOLET
            self._line(frame, positions[a], positions[b], color, dotted=(tool == 1))
            if tool == 2:
                ax, ay = positions[a]; bx, by = positions[b]
                self._line(frame, (ax, ay + 2), (bx, by + 2), color)
        for i, part in enumerate(parts):
            x, y = centers[i]
            if i in selected:
                y -= 2
            self._part(frame, part, (x, y), selected=i in selected, cursor=i == cursor,
                       join_info=self._join_info(g.level, parts, i))
        # Press jaws are large, asymmetric, and physically separate from the pieces.
        frame[31:45, 29:32] = RUST
        frame[31:45, 35:38] = RUST
        frame[31:34, 29:38] = MUSTARD
        frame[42:45, 29:38] = CHARCOAL
        groups, remainder = divmod(g.budget_left, 5)
        for i in range(groups):
            self._disc(frame, (8 + i * 5, 14), 2, GREEN, hollow=True)
            frame[14, 8 + i * 5] = GREEN
        for i in range(remainder):
            frame[12:14, 49 + i * 2] = MUSTARD
        for i in range(2):
            x = 55 + i * 4
            if i < g.state[5]:
                self._disc(frame, (x, 13), 2, TEAL, hollow=True)
            else:
                self._line(frame, (x - 2, 11), (x + 2, 15), DANGER)
                self._line(frame, (x + 2, 11), (x - 2, 15), DANGER)

    def _animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self._disc(frame, (32, 37), 11, MUSTARD, hollow=True)
            if g.terminal_hold == "loss":
                frame[28:47, 28:30] = DANGER; frame[28:47, 37:39] = DANGER
                frame[35:39, 28:39] = DANGER
            elif g.terminal_hold == "win":
                self._disc(frame, (32, 36), 14, GREEN, hollow=True)
            return
        p = g.anim_progress; total = max(1, g.anim_total)
        if g.anim_kind == "cursor":
            before = self._centers(len(g.anim_before[0]))[g.anim_before[1]]
            after = self._centers(len(g.pending_state[0]))[g.pending_state[1]]
            x = before[0] + (after[0] - before[0]) * p // total
            y = before[1] + (after[1] - before[1]) * p // total
            self._disc(frame, (x, y + 11 - p % 2), 2, RUST)
        elif g.anim_kind == "select":
            x, y = self._centers(len(g.state[0]))[g.state[1]]
            self._disc(frame, (x, y), min(10, 4 + p), TEAL, hollow=True)
        elif g.anim_kind == "rotate":
            x, y = self._centers(len(g.state[0]))[g.state[1]]
            self._disc(frame, (x, y), 9, MUSTARD, hollow=True)
            self._line(frame, (x - 7 + p, y - 7), (x + 5, y - 5 + p), RUST)
        elif g.anim_kind == "tool":
            frame[50 - p:53 - p, 7:55] = MUSTARD
        elif g.anim_kind == "press":
            gap = max(0, 6 - p)
            frame[31:45, 31 - gap:33 - gap] = RUST
            frame[31:45, 34 + gap:36 + gap] = RUST
            for d in range(-p, p + 1, 3):
                self._disc(frame, (32 + d, 38 + (d % 3)), 1, MUSTARD)
        elif g.anim_kind == "recoil":
            gap = 2 + (p % 3)
            frame[34:42, 27 - gap:30 - gap] = DANGER
            frame[34:42, 35 + gap:38 + gap] = DANGER
        elif g.anim_kind == "blocked":
            self._disc(frame, (32, 38), 5 + p, EARTH, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._background(frame)
        self._target(frame)
        self._bench(frame)
        self._tools(frame)
        self._animation(frame)
        return frame


class Q091(ARCBaseGame):
    def __init__(self):
        self.display = AtelierDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q091", levels, Camera(0, 0, 64, 64, CREAM, CREAM, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

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

    def _begin(self, kind, frames, next_state, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.anim_before = self.state
        self.pending_state = next_state
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.anim_kind = None
        self.pending_state = None
        self.pending_terminal = None
        if terminal == "win":
            self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss" or self.budget_left <= 0:
            self.terminal_hold = "loss"; self.lose()
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
            self.complete_action(); return
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        if after == self.state:
            self._begin("blocked", 4, after); return
        self.budget_left -= 1
        if action in (1, 2): kind = "cursor"
        elif action == 3: kind = "select"
        elif action == 4: kind = "rotate"
        elif action == 5: kind = "tool"
        elif after[5] < self.state[5]: kind = "recoil"
        else: kind = "press"
        terminal = "win" if solved(self.level, after) else "loss" if after[5] <= 0 or self.budget_left <= 0 else None
        self._begin(kind, 5 if kind not in ("press", "recoil") else 7, after, terminal)
