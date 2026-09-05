# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q140-v2 Grounded Labels -- invent a visible stamp dictionary, then route parcels.

The player chooses an arbitrary one-to-one marker for every active destination bay.
The same shape-coded markers are then reused as instructions for stop-motion workers.
Later parcels require compound stamps, pass through visible permutation presses, or
carry a stamp across a relay. Success grades visible relational consistency, never a
hidden authored mapping.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, FIBER, ASH, GRAPHITE, INK = 0, 1, 2, 3, 5
INDIGO, SKY, OCHRE, TANGERINE, CORAL, GREEN, PLUM = 9, 10, 11, 12, 6, 14, 15


def parcel(targets, twist=0, carry=False):
    return {"targets": tuple(targets), "twist": twist, "carry": carry}


LEVELS = [
    {"name": "First Impression", "active": (0,),
     "items": (parcel((0,)), parcel((0,))), "budget": 7},
    {"name": "Two Destinations", "active": (0, 1),
     "items": (parcel((0,)), parcel((1,)), parcel((0,)), parcel((1,))), "budget": 12},
    {"name": "Compound Parcel", "active": (0, 1),
     "items": (parcel((0, 1)), parcel((1,)), parcel((1, 0))), "budget": 12},
    {"name": "Turning Press", "active": (0, 1),
     "items": (parcel((0,), 1), parcel((1,), 1), parcel((0, 1), 1)), "budget": 11},
    {"name": "Ribbon Relay", "active": (0, 1),
     "items": (parcel((0, 1), carry=True), parcel((1,)),
               parcel((1, 0), carry=True), parcel((0,))), "budget": 12},
    {"name": "Three-Bay Bundle", "active": (0, 1, 2),
     "items": (parcel((0, 1, 2)), parcel((2, 0)), parcel((1, 2, 0))), "budget": 16},
    {"name": "Crossed Dispatch", "active": (0, 1, 2),
     "items": (parcel((0, 1), 1, True), parcel((1, 2), 1),
               parcel((2, 0, 1), 2, True), parcel((1,))), "budget": 17},
    {"name": "Grounded Labels", "active": (0, 1, 2),
     "items": (parcel((2, 0, 1), 1, True), parcel((1, 2), 1, True),
               parcel((2, 0)), parcel((0, 1, 2), 2, True), parcel((2,))), "budget": 22},
]


def start_state(_level):
    return (0, 0, 0), 0, 0, 0, ()


def transition(level, state, action):
    """Pure visible-state transition used by runtime and qualification."""
    labels, ground_index, phase, item_index, stamps = state
    labels = list(labels)
    active = level["active"]
    items = level["items"]

    if phase == 0:
        if action in (1, 2, 3) and ground_index < len(active):
            if action in labels:
                return state
            labels[active[ground_index]] = action
            return tuple(labels), ground_index + 1, phase, item_index, stamps
        if action == 5 and ground_index == len(active):
            return tuple(labels), ground_index, 1, item_index, ()
        return state

    if item_index >= len(items):
        return state
    item = items[item_index]
    targets = item["targets"]
    if action in (1, 2, 3):
        if len(stamps) >= len(targets):
            return state
        return tuple(labels), ground_index, phase, item_index, stamps + (action,)
    if action == 5:
        if not stamps:
            return state
        return tuple(labels), ground_index, phase, item_index, ()
    if action != 4:
        return state
    if len(stamps) != len(targets):
        return (tuple(labels), ground_index, phase, item_index, ()) if stamps else state
    actual = tuple((stamp - 1 + item["twist"]) % 3 + 1 for stamp in stamps)
    expected = tuple(labels[target] for target in targets)
    if actual != expected:
        return tuple(labels), ground_index, phase, item_index, ()
    next_index = item_index + 1
    carried = ()
    if item["carry"] and next_index < len(items) and items[next_index]["targets"]:
        carried = (stamps[-1],)
    return tuple(labels), ground_index, phase, next_index, carried


def solved(level, state):
    return state[2] == 1 and state[3] == len(level["items"])


class DispatchDisplay(RenderableUserDisplay):
    BAYS = ((12, 13), (32, 13), (52, 13))

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
    def _class_glyph(frame, kind, center, color, scale=1):
        cx, cy = center
        r = 3 * scale
        if kind == 0:
            DispatchDisplay._disc(frame, center, r, color)
            DispatchDisplay._disc(frame, center, max(0, r - scale), PAPER)
            frame[cy, cx] = color
        elif kind == 1:
            for dy in range(-r, r + 1):
                half = max(0, (dy + r) // 2)
                frame[cy + dy, max(0, cx - half):min(64, cx + half + 1)] = color
            frame[cy + scale:cy + r, cx - scale:cx + scale + 1] = PAPER
        else:
            frame[cy - r:cy + r + 1, cx - r:cx + r + 1] = color
            frame[cy - r + scale:cy + r - scale + 1,
                  cx - r + scale:cx + r - scale + 1] = PAPER
            frame[cy - r:cy - r + 2 * scale, cx - scale:cx + scale + 1] = PAPER

    @staticmethod
    def _label_glyph(frame, label, center, color, scale=1):
        cx, cy = center
        if label == 1:
            DispatchDisplay._disc(frame, center, 3 * scale, color)
            frame[cy - 2 * scale:cy + 2 * scale + 1:2 * scale,
                  cx - 2 * scale:cx + 2 * scale + 1:2 * scale] = PAPER
        elif label == 2:
            for offset in range(-3 * scale, 3 * scale + 1):
                x = cx + offset
                y1 = cy + offset
                y2 = cy - offset
                if 0 <= x < 64 and 0 <= y1 < 64:
                    frame[y1, x] = color
                if 0 <= x < 64 and 0 <= y2 < 64:
                    frame[y2, x] = color
        elif label == 3:
            frame[cy - 3 * scale:cy + 3 * scale + 1, cx - scale:cx + scale + 1] = color
            frame[cy - scale:cy + scale + 1, cx - 3 * scale:cx + 3 * scale + 1] = color
            frame[cy - 3 * scale:cy + 3 * scale + 1:2 * scale, cx - 3 * scale:cx + 3 * scale + 1] = color

    def _paper(self, frame):
        frame[:, :] = PAPER
        for y in range(2, 63, 5):
            frame[y, 1:63:4] = FIBER
        for x in range(4, 62, 9):
            frame[1:63:7, x] = ASH
        frame[2:62, 2] = GRAPHITE
        frame[2:62, 61] = GRAPHITE

    def _press(self, frame, twist, phase=0):
        """Draw opposite, animated chiralities for +1 and +2 permutations."""
        if not twist:
            return
        cx, cy = 50, 31
        turn = phase % 2
        if (twist == 1) ^ bool(turn):
            frame[cy - 4:cy - 1, cx - 3:cx + 2] = CORAL
            frame[cy - 1:cy + 4, cx:cx + 3] = CORAL
            frame[cy + 2:cy + 5, cx - 3:cx + 1] = CORAL
            frame[cy - 1:cy + 3, cx - 5:cx - 2] = CORAL
        else:
            frame[cy - 4:cy - 1, cx - 1:cx + 4] = CORAL
            frame[cy - 1:cy + 4, cx - 3:cx] = CORAL
            frame[cy + 2:cy + 5, cx:cx + 4] = CORAL
            frame[cy - 1:cy + 3, cx + 2:cx + 5] = CORAL
        frame[cy, cx] = INK
        # One or two punched dots redundantly expose permutation magnitude.
        for dot in range(twist):
            frame[cy + 6, cx - 1 + dot * 3] = INK

    def _dictionary(self, frame):
        g = self.game
        for index, cls in enumerate(g.level["active"]):
            cx, cy = self.BAYS[cls]
            # Cloth awning and punched class plate.
            frame[4:7, cx - 7:cx + 8] = OCHRE if index % 2 == 0 else TANGERINE
            frame[7:22, cx - 8:cx + 9] = PAPER
            frame[7:22, cx - 8:cx - 6] = INK
            frame[7:22, cx + 6:cx + 8] = INK
            frame[20:22, cx - 8:cx + 8] = INK
            self._class_glyph(frame, cls, (cx, 12), INK)
            if g.labels[cls]:
                self._label_glyph(frame, g.labels[cls], (cx, 18), INDIGO)
            elif g.phase == 0 and index == g.ground_index:
                frame[16:21, cx - 4:cx + 5:2] = CORAL

    def _queue(self, frame):
        g = self.game
        if g.phase == 0:
            # Raised blank card tells the player the dictionary is being authored.
            frame[27:44, 22:43] = FIBER
            frame[26:43, 21:42] = PAPER
            frame[26:43, 21:23] = INDIGO
            next_cls = g.level["active"][min(g.ground_index, len(g.level["active"]) - 1)]
            self._class_glyph(frame, next_cls, (31, 34), INK, 2)
            return
        if g.item_index >= len(g.level["items"]):
            frame[27:43, 23:41] = GREEN
            frame[30:40, 26:38] = PAPER
            return
        item = g.level["items"][g.item_index]
        targets = item["targets"]
        frame[26:44, 18:46] = FIBER
        frame[25:43, 17:45] = PAPER
        frame[25:43, 17:19] = INDIGO
        spacing = 10
        start = 31 - (len(targets) - 1) * spacing // 2
        for slot, target in enumerate(targets):
            self._class_glyph(frame, target, (start + slot * spacing, 32), INK)
            if slot < len(g.stamps):
                self._label_glyph(frame, g.stamps[slot], (start + slot * spacing, 39), INDIGO)
            else:
                frame[38:41, start - 3 + slot * spacing:start + 4 + slot * spacing:2] = ASH
        if item["twist"]:
            self._press(frame, item["twist"])
        if item["carry"]:
            frame[42:45, 39:57:3] = OCHRE

        # Remaining queue is a punched-card strip, fully visible by class silhouette.
        for offset, queued in enumerate(g.level["items"][g.item_index + 1:g.item_index + 4]):
            x = 7 + offset * 18
            frame[48:57, x:x + 15] = FIBER
            frame[47:56, x - 1:x + 14] = PAPER
            for j, cls in enumerate(queued["targets"][:3]):
                self._class_glyph(frame, cls, (x + 3 + j * 4, 51), GRAPHITE)

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            frame[1:4, 8:57:4] = OCHRE
            frame[59:62, 8:57:4] = INDIGO
        if g.terminal_hold == "win":
            frame[22:46, 7:58] = OCHRE
            frame[25:43, 10:55] = PAPER
            for x in range(14, 54, 10):
                self._disc(frame, (x, 34), 4, GREEN)
                frame[32:37, x] = INK
        elif g.terminal_hold == "loss":
            frame[23:46:3, 8:57] = CORAL
            frame[23:46, 8:57:4] = GRAPHITE
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind == "stamp":
            y = 22 + min(p, 3) * 4
            frame[y:y + 3, 24:40] = INDIGO
            frame[y + 3:y + 5, 28:36] = GRAPHITE
        elif g.anim_kind == "dispatch":
            x = 10 + p * 8
            self._disc(frame, (min(55, x), 45 - p % 2), 3, TANGERINE)
            frame[44 - p % 2:47 - p % 2, min(58, x + 2):min(61, x + 5)] = INDIGO
            item = g.level["items"][g.item_index]
            if item["twist"]:
                self._press(frame, item["twist"], p)
                if g.stamps:
                    raw = g.stamps[0]
                    transformed = (raw - 1 + item["twist"]) % 3 + 1
                    self._label_glyph(frame, raw, (42, 39), INDIGO)
                    self._label_glyph(frame, transformed, (57, 39), CORAL)
        elif g.anim_kind == "clear":
            # A cool paper sweep reads as deliberate recovery, never an error.
            edge = min(44, 18 + p * 7)
            frame[36:42, 18:edge] = SKY
            frame[38:40, 18:edge:3] = PAPER
        elif g.anim_kind == "blocked":
            offset = -2 if p % 2 else 2
            frame[24:44, 29 + offset:33 + offset] = CORAL
        elif g.anim_kind == "seal":
            frame[23 + p:27 + p, 16:46] = OCHRE
        elif g.anim_kind == "success":
            frame[21 + p:44 - p, 9 + p:56 - p:3] = GREEN
        elif g.anim_kind == "fail":
            frame[26:42, 12 + p:53 - p:3] = CORAL

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._paper(frame)
        self._dictionary(frame)
        self._queue(frame)
        g = self.game
        # Stamp rack: three permanent, non-color-coded tool silhouettes.
        for label, x in enumerate((9, 32, 55), 1):
            frame[58:63, x - 5:x + 6] = GRAPHITE
            self._label_glyph(frame, label, (x, 59), SKY if label == 1 else INDIGO)
        # Exact bound-page holes: each available action owns one persistent pip.
        # Long levels continue down the opposite spine instead of compressing state.
        per_spine = (g.budget_max + 1) // 2
        spacing = 50 // max(1, per_spine - 1)
        for index in range(g.budget_max):
            column = index // per_spine
            row = index % per_spine
            self._disc(frame, (4 if column == 0 else 59, 6 + row * spacing), 1,
                       OCHRE if index < g.budget_left else ASH)
        self._animation(frame)
        return frame


class Q140(ARCBaseGame):
    def __init__(self):
        self.display = DispatchDisplay(self)
        self.level = LEVELS[0]
        self.labels = (0, 0, 0)
        self.ground_index = self.phase = self.item_index = 0
        self.stamps = ()
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q140", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.labels, self.ground_index, self.phase, self.item_index, self.stamps = start_state(self.level)
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
            (self.labels, self.ground_index, self.phase,
             self.item_index, self.stamps) = self.pending_state
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
        state = (self.labels, self.ground_index, self.phase, self.item_index, self.stamps)
        if action == 6:
            won = solved(self.level, state)
            if not won:
                self.budget_left -= 1
            self._begin("success" if won else "fail", 4, terminal="win" if won else None)
            return
        after = transition(self.level, state, action)
        if after == state:
            self._begin("blocked", 3)
            return
        if state[2] == 0 and action in (1, 2, 3):
            kind, frames = "stamp", 4
        elif state[2] == 0 and action == 5:
            kind, frames = "seal", 4
        elif action == 4 and after[3] > state[3]:
            kind, frames = "dispatch", 5
        elif action in (1, 2, 3):
            kind, frames = "stamp", 4
        elif action == 5 and state[2] == 1 and state[4]:
            kind, frames = "clear", 4
        else:
            kind, frames = "blocked", 3
        if kind != "clear":
            self.budget_left -= 1
        self._begin(kind, frames, next_state=after)
