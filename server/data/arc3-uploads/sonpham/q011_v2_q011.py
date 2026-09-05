# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q011-v2 Courtesy Carnival -- infer stable yielding through staged meetings.

The player schedules adjacent walkers beneath a row of street-theatre arches. A
meeting leaves a permanent, shape-coded courtesy ribbon showing who passed and
who yielded; the final audit accepts an anonymous locally stable line rather
than displaying a solution order. Later arches witness evidence, reverse the
local courtesy rule, rotate the whole roundabout, and close after one meeting.
Chalk undo restores the physical arrangement while deliberately preserving the
social evidence, so play stays about learned relations rather than target-copy
sorting.
"""

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


CREAM, CHALK, CERAMIC, MOSS, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, CORAL, RED, SKY, AQUA, SUN = 6, 7, 8, 9, 10, 11
MARIGOLD, TERRACOTTA, LEAF, LILAC = 12, 13, 14, 15
ROSE = MAGENTA
RANK = (2, 0, 4, 1, 5, 3)


def pair_bit(a, b):
    lo, hi = sorted((a, b))
    return 1 << (lo * 6 + hi)


def pairs_mask(pairs):
    mask = 0
    for a, b in pairs:
        mask |= pair_bit(a, b)
    return mask


def carnival(name, order, budget, *, reverse=(), witness=(), closing=(),
             active_gaps=None, required=(), required_witness=(),
             required_reverse=(), required_closed=(), rotate=False,
             require_rotation=False, undo=False, require_undo=False):
    gaps = len(order) - 1
    return {
        "name": name,
        "order": tuple(order),
        "budget": budget,
        "reverse": frozenset(reverse),
        "witness": frozenset(witness),
        "closing": frozenset(closing),
        "active_gaps": frozenset(range(gaps) if active_gaps is None else active_gaps),
        "required": pairs_mask(required),
        "required_witness": pairs_mask(required_witness),
        "required_reverse": pairs_mask(required_reverse),
        "required_closed": sum(1 << gap for gap in required_closed),
        "rotate": rotate,
        "require_rotation": require_rotation,
        "undo": undo,
        "require_undo": require_undo,
    }


LEVELS = [
    carnival("First Bow", (1, 0), 1),
    carnival("Ribbon Memory", (1, 3, 0, 2), 11,
             required=((0, 1), (0, 2), (0, 3),
                       (1, 2), (1, 3), (2, 3))),
    carnival("Witness Canopy", (3, 0, 1, 2), 7, witness=(1,),
             required=((0, 3),), required_witness=((2, 3),)),
    carnival("Contrary Arch", (0, 2, 3, 1), 9, reverse=(1,),
             required=((0, 1), (0, 2), (1, 3), (2, 3)),
             required_reverse=((0, 3),)),
    carnival("Roundabout Matinee", (4, 1, 3, 0, 2), 10,
             reverse=(2,), active_gaps=(0, 2), rotate=True,
             required_reverse=((0, 3),), require_rotation=True),
    carnival("Chalk Encore", (5, 1, 3, 0, 2), 10,
             witness=(1,), closing=(1,), rotate=True, undo=True,
             required_witness=((1, 3),), required_closed=(1,),
             require_rotation=True, require_undo=True),
    carnival("Twin-Curtain Parade", (1, 5, 3, 0, 2, 4), 9,
             reverse=(1, 3), witness=(2,), rotate=True,
             required_witness=((0, 3),), required_reverse=((1, 5),),
             require_rotation=True),
    carnival("Courtesy Carnival", (3, 1, 5, 0, 4, 2), 10,
             reverse=(1, 4), witness=(2,), closing=(3,),
             rotate=True, undo=True, required=((0, 5),),
             required_witness=((0, 5),), required_reverse=((1, 3),),
             required_closed=(3,), require_rotation=True, require_undo=True),
]


def start_state(level):
    # order, cursor, all evidence, witnessed evidence, reversed evidence,
    # closed gaps, ever-closed gaps, one physical undo snapshot,
    # rotated, undone, wax seals, terminal (0/2/3)
    return level["order"], 0, 0, 0, 0, 0, 0, (), 0, 0, 2, 0


def would_swap(level, order, gap):
    a, b = order[gap], order[gap + 1]
    result = RANK[a] < RANK[b]
    return not result if gap in level["reverse"] else result


def configuration_ready(level, state):
    return all(not would_swap(level, state[0], gap)
               for gap in range(len(state[0]) - 1))


def audit_ready(level, state):
    return (configuration_ready(level, state)
            and state[2] & level["required"] == level["required"]
            and state[3] & level["required_witness"] == level["required_witness"]
            and state[4] & level["required_reverse"] == level["required_reverse"]
            and state[6] & level["required_closed"] == level["required_closed"]
            and (not level["require_rotation"] or state[8])
            and (not level["require_undo"] or state[9]))


def transition(level, state, action):
    (order, cursor, evidence, witnessed, reversed_evidence, closed,
     closed_seen, history, rotated, undone, seals, terminal) = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    gaps = len(order) - 1
    if action == 1:
        return (order, (cursor - 1) % gaps, evidence, witnessed,
                reversed_evidence, closed, closed_seen, history, rotated,
                undone, seals, terminal)
    if action == 2:
        return (order, (cursor + 1) % gaps, evidence, witnessed,
                reversed_evidence, closed, closed_seen, history, rotated,
                undone, seals, terminal)
    if action == 3:
        if cursor not in level["active_gaps"] or closed & (1 << cursor):
            return state
        a, b = order[cursor], order[cursor + 1]
        bit = pair_bit(a, b)
        new_order = list(order)
        if would_swap(level, order, cursor):
            new_order[cursor], new_order[cursor + 1] = b, a
        new_closed = closed | ((1 << cursor) if cursor in level["closing"] else 0)
        snapshot = (order, cursor, closed)
        return (tuple(new_order), cursor, evidence | bit,
                witnessed | (bit if cursor in level["witness"] else 0),
                reversed_evidence | (bit if cursor in level["reverse"] else 0),
                new_closed, closed_seen | new_closed, snapshot, rotated,
                undone, seals, terminal)
    if action == 4:
        if not level["undo"] or not history:
            return state
        old_order, old_cursor, old_closed = history
        reopened = int(closed != old_closed)
        return (old_order, old_cursor, evidence, witnessed, reversed_evidence,
                old_closed, closed_seen, (), rotated, undone or reopened,
                seals, terminal)
    if action == 5:
        if not level["rotate"]:
            return state
        snapshot = (order, cursor, closed)
        return (order[1:] + order[:1], cursor, evidence, witnessed,
                reversed_evidence, closed, closed_seen, snapshot, 1, undone,
                seals, terminal)
    if audit_ready(level, state):
        return state[:-1] + (2,)
    remaining = seals - 1
    return state[:-2] + (remaining, 3 if remaining <= 0 else 0)


def action_cost(state, after):
    if after == state:
        return 0
    # Every valid selection movement, meeting, roundabout turn, and physical
    # chalk undo consumes one program action. Only audits are free.
    if after[10] < state[10] or after[11] != state[11]:
        return 0
    return 1


def solved(_level, state):
    return state[-1] == 2


class CarnivalDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False, width=1):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            for dy in range(-(width // 2), width - width // 2):
                for dx in range(-(width // 2), width - width // 2):
                    if 0 <= x + dx < 64 and 0 <= y + dy < 64:
                        frame[y + dy, x + dx] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        x, y = center
        for dy in range(-radius, radius + 1):
            reach = radius - abs(dy)
            if hollow:
                frame[y + dy, x - reach] = color
                frame[y + dy, x + reach] = color
            else:
                frame[y + dy, x - reach:x + reach + 1] = color

    @staticmethod
    def centers(count):
        return tuple((7 + i * 50 // max(1, count - 1), 39) for i in range(count))

    def background(self, frame):
        frame[:, :] = CREAM
        frame[22:55, :] = SUN
        frame[25:52, :] = TERRACOTTA
        frame[29:49, :] = CERAMIC
        for x in range(0, 64, 6):
            self.line(frame, (x, 50 + (x // 6) % 2),
                      (x + 4, 50 + (x // 6) % 2), CHALK)
        self.line(frame, (1, 22), (62, 22), LEAF, dotted=True)
        for x in range(4, 63, 8):
            color = (CORAL, MARIGOLD, LEAF)[(x // 8) % 3]
            self.line(frame, (x - 3, 22), (x, 26), color)
            self.line(frame, (x, 26), (x + 3, 22), color)
        self.disc(frame, (55, 8), 6, MARIGOLD)
        self.disc(frame, (55, 8), 3, CREAM)
        for angle in range(0, 360, 45):
            end = (55 + round(9 * math.cos(math.radians(angle))),
                   8 + round(9 * math.sin(math.radians(angle))))
            self.line(frame, (55, 8), end, CORAL, dotted=True)
        for x in range(3, 62, 9):
            frame[53, x:x + 3] = MOSS
            frame[54, x + 1] = LEAF

    def sigil(self, frame, center, identity, color=INK, small=False):
        x, y = center; r = 1 if small else 2
        kind = identity % 6
        if kind == 0:
            self.disc(frame, center, r + 1, color, hollow=True)
            frame[y, x] = color
        elif kind == 1:
            self.line(frame, (x, y - r - 1), (x + r + 1, y + r), color)
            self.line(frame, (x + r + 1, y + r), (x - r - 1, y + r), color)
            self.line(frame, (x - r - 1, y + r), (x, y - r - 1), color)
        elif kind == 2:
            self.diamond(frame, center, r + 1, color, hollow=True)
        elif kind == 3:
            self.line(frame, (x - r - 1, y), (x + r + 1, y), color)
            self.line(frame, (x, y - r - 1), (x, y + r + 1), color)
        elif kind == 4:
            self.line(frame, (x - r, y - r), (x + r, y + r), color)
            self.line(frame, (x + r, y - r), (x - r, y + r), color)
        else:
            for dx, dy in ((0, -2), (2, 0), (0, 2), (-2, 0)):
                self.disc(frame, (x + dx, y + dy), 1, color)

    def walker(self, frame, center, identity, bow=0, offset=0):
        x, y = center; x += offset; y += bow
        color = (CORAL, LEAF, MARIGOLD, ROSE, AQUA, LILAC)[identity]
        if identity == 0:
            self.disc(frame, (x, y - 8), 3, color)
            for yy in range(y - 5, y + 5):
                reach = 2 + (yy - (y - 5)) // 3
                frame[yy, x - reach:x + reach + 1] = color
        elif identity == 1:
            self.diamond(frame, (x, y - 7), 3, color)
            self.line(frame, (x - 1, y - 4), (x - 6, y + 4), color, width=2)
            self.line(frame, (x - 5, y + 4), (x + 3, y + 4), color, width=2)
        elif identity == 2:
            self.line(frame, (x, y - 12), (x - 5, y - 5), color, width=2)
            self.line(frame, (x, y - 12), (x + 5, y - 5), color, width=2)
            self.diamond(frame, (x, y), 6, color)
        elif identity == 3:
            for dx, dy in ((0, -4), (4, 0), (0, 4), (-4, 0)):
                self.disc(frame, (x + dx, y - 6 + dy), 3, color)
            self.disc(frame, (x, y - 6), 3, CERAMIC)
            self.line(frame, (x, y - 2), (x, y + 5), color, width=2)
        elif identity == 4:
            self.diamond(frame, (x, y - 8), 5, color)
            self.diamond(frame, (x, y + 1), 5, color)
            self.line(frame, (x - 4, y - 4), (x + 4, y - 4), CERAMIC, dotted=True)
        else:
            self.disc(frame, (x, y - 5), 7, color)
            self.disc(frame, (x + 3, y - 7), 6, CERAMIC)
            self.line(frame, (x - 3, y), (x + 3, y + 4), color, width=2)
        self.sigil(frame, (x, y - 5), identity, INK)
        self.line(frame, (x - 2, y + 5), (x - 3, y + 8), INK)
        self.line(frame, (x + 2, y + 5), (x + 3, y + 8), INK)

    def gate(self, frame, gap, center, state):
        level = self.game.level; x, _ = center
        closed = bool(state[5] & (1 << gap))
        active = gap in level["active_gaps"]
        color = TERRACOTTA if active else CHALK
        if gap in level["reverse"]:
            self.line(frame, (x - 5, 31), (x, 26), CORAL, width=2)
            self.line(frame, (x, 26), (x + 5, 31), CORAL, width=2)
            self.line(frame, (x - 4, 28), (x + 4, 28), INK, dotted=True)
            self.diamond(frame, (x - 5, 31), 2, CORAL)
            self.diamond(frame, (x + 5, 31), 2, CORAL)
        elif gap in level["witness"]:
            self.line(frame, (x - 5, 31), (x - 5, 25), LEAF)
            self.line(frame, (x + 5, 31), (x + 5, 25), LEAF)
            self.line(frame, (x - 5, 25), (x + 5, 25), LEAF, dotted=True)
            self.disc(frame, (x, 25), 2, MARIGOLD)
        else:
            self.line(frame, (x - 4, 30), (x, 26), color)
            self.line(frame, (x, 26), (x + 4, 30), color)
        if gap in level["closing"]:
            self.line(frame, (x - 6, 31), (x - 3, 27), INK, dotted=True)
            self.line(frame, (x + 6, 31), (x + 3, 27), INK, dotted=True)
        if closed:
            self.line(frame, (x - 6, 27), (x + 6, 31), RED, width=2)
            self.line(frame, (x + 6, 27), (x - 6, 31), RED, width=2)

    @staticmethod
    def relation_entries(mask):
        return [(a, b, pair_bit(a, b))
                for a in range(6) for b in range(a + 1, 6)
                if mask & pair_bit(a, b)]

    def evidence(self, frame, state):
        level = self.game.level
        critical = (level["required"] | level["required_witness"]
                    | level["required_reverse"])
        # Six compact slots always reserve room for every audit-critical edge.
        # Noncritical discoveries fill only the remaining slots, so a required,
        # witnessed, or contrary ribbon can never scroll out of view.
        required_entries = self.relation_entries(state[2] & critical)
        other_entries = self.relation_entries(state[2] & ~critical)
        entries = (required_entries + other_entries)[:6]
        for index, (a, b, bit) in enumerate(entries):
            x = 3 + index * 7
            stronger, weaker = (a, b) if RANK[a] > RANK[b] else (b, a)
            self.sigil(frame, (x, 9), stronger, INK, small=True)
            self.sigil(frame, (x + 4, 13), weaker, INK, small=True)
            self.line(frame, (x + 1, 10), (x + 3, 12), TERRACOTTA,
                      dotted=bool(state[3] & bit))
            if state[4] & bit:
                self.line(frame, (x, 15), (x + 4, 7), CORAL)

    def hud(self, frame, state):
        for index, x in enumerate((55, 62)):
            live = index < state[10]
            self.disc(frame, (x, 18), 2, ROSE if live else RED, hollow=not live)
            self.sigil(frame, (x, 18), 3, INK, small=True)
        shown = self.game.budget_left
        offsets = ((0, -2), (2, 0), (0, 2), (-2, 0))
        for group in range((self.game.budget_max + 3) // 4):
            center = (4 + group * 8, 60)
            self.disc(frame, center, 1, TERRACOTTA)
            for petal, (dx, dy) in enumerate(offsets):
                i = group * 4 + petal
                if i >= self.game.budget_max:
                    continue
                if i < shown:
                    self.disc(frame, (center[0] + dx, center[1] + dy), 1, MARIGOLD)
                else:
                    frame[center[1] + dy, center[0] + dx] = CHALK
        # This anonymous arch now reflects the complete audit contract, not
        # merely physical order: missing evidence/undo/rotation stays closed.
        ready = audit_ready(self.game.level, state)
        self.line(frame, (48, 13), (51, 8), LEAF if ready else TERRACOTTA)
        self.line(frame, (51, 8), (54, 13), LEAF if ready else TERRACOTTA)
        self.disc(frame, (51, 8), 1, CERAMIC)
        if state[8]:
            self.disc(frame, (59, 8), 3, CORAL, hollow=True)
            self.line(frame, (59, 4), (62, 7), INK)
        if state[9]:
            self.line(frame, (57, 13), (62, 10), CHALK, dotted=True)
            self.line(frame, (57, 11), (62, 14), TERRACOTTA, dotted=True)

    def base_queue(self, frame, state, skip=()):
        centers = self.centers(len(state[0]))
        for gap in range(len(state[0]) - 1):
            gx = (centers[gap][0] + centers[gap + 1][0]) // 2
            self.gate(frame, gap, (gx, 29), state)
        for index, identity in enumerate(state[0]):
            if index not in skip:
                self.walker(frame, centers[index], identity)
        return centers

    def animation(self, frame, centers):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                for radius in (3, 6, 9):
                    self.disc(frame, (55, 8), radius, MARIGOLD, hollow=True)
            if g.state[-1] == 3:
                for y in range(27, 50, 5):
                    self.line(frame, (2, y), (61, y + 2), RED,
                              dotted=True, width=2)
            return
        p = g.anim_progress; span = max(1, g.anim_total - 1)
        before, after = g.state, g.pending_state
        if g.anim_kind == "cursor":
            old = (centers[before[1]][0] + centers[before[1] + 1][0]) // 2
            new = (centers[after[1]][0] + centers[after[1] + 1][0]) // 2
            x = old + (new - old) * p // span
            self.diamond(frame, (x, 52), 2 + min(p, span - p), CORAL, hollow=True)
        elif g.anim_kind in ("encounter", "undo", "rotate"):
            for identity in before[0]:
                old_i = before[0].index(identity); new_i = after[0].index(identity)
                a, b = centers[old_i], centers[new_i]
                x = a[0] + (b[0] - a[0]) * p // span
                arc = -4 * min(p, span - p) // max(1, span // 2)
                bow = 2 * math.sin(math.pi * p / span) if g.anim_kind == "encounter" else 0
                self.line(frame, a, (x, a[1] + arc), CHALK, dotted=True)
                self.walker(frame, (x, a[1] + arc), identity, bow=round(bow))
            if g.anim_kind == "undo":
                for x in range(5, 60, 7):
                    self.disc(frame, (x, 53 - p % 2), 1, TERRACOTTA, hollow=True)
            if g.anim_kind == "rotate":
                self.disc(frame, (32, 39), 12 + p, CORAL, hollow=True)
        elif g.anim_kind in ("audit", "reject"):
            edge = 4 + 55 * p // span
            color = LEAF if g.anim_kind == "audit" else RED
            self.line(frame, (edge, 24), (edge, 51), color,
                      dotted=True, width=2)
            self.diamond(frame, (edge, 21), 2, MARIGOLD)
        elif g.anim_kind == "success":
            self.line(frame, (8, 49), (8 + 48 * p // span, 27), LEAF, width=2)
            self.line(frame, (56, 49), (56 - 48 * p // span, 27), LEAF, width=2)
            for x in range(8, 57, 8):
                self.diamond(frame, (x, 19 + (x + p) % 3), 2, CORAL)
        elif g.anim_kind == "loss":
            inset = 28 * p // span
            self.line(frame, (2 + inset, 26), (2 + inset, 51), RED, width=2)
            self.line(frame, (61 - inset, 26), (61 - inset, 51), RED, width=2)
        else:
            index = before[1]
            x, y = centers[index]
            offset = (-2, 0, 2, 0, -1, 0)[min(p, 5)]
            self.disc(frame, (x + offset, y - 14), 2, RED, hollow=True)
            self.line(frame, (x - 4 + offset, y - 14),
                      (x + 4 + offset, y - 14), INK)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        state = self.game.state
        skip = tuple(range(len(state[0]))) if self.game.anim_kind in (
            "encounter", "undo", "rotate") else ()
        centers = self.base_queue(frame, state, skip)
        self.evidence(frame, state)
        self.hud(frame, state)
        self.animation(frame, centers)
        if not self.game.anim_kind:
            gap_x = (centers[state[1]][0] + centers[state[1] + 1][0]) // 2
            self.diamond(frame, (gap_x, 52), 2, CORAL, hollow=True)
        return frame


class Q011(ARCBaseGame):
    def __init__(self):
        self.display = CarnivalDisplay(self)
        self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None; self.pending_budget = None; self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level), name=level["name"])
                  for level in LEVELS]
        super().__init__("q011", levels, Camera(0, 0, 64, 64, CREAM, CREAM, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames
        self.anim_progress = 0; self.pending_state = after
        self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state; self.budget_left = self.pending_budget
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
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:-1] + (3,)
            self.begin("loss", 7, lost, self.budget_left, "loss")
            return
        budget = self.budget_left - cost
        won = after[-1] == 2; lost = after[-1] == 3
        if won:
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 7, "loss"
        elif after[10] < before[10]:
            kind, frames, terminal = "reject", 6, None
        elif action in (1, 2):
            kind, frames, terminal = "cursor", 5, None
        elif action == 3:
            kind, frames, terminal = "encounter", 7, None
        elif action == 4:
            kind, frames, terminal = "undo", 7, None
        elif action == 5:
            kind, frames, terminal = "rotate", 7, None
        else:
            kind, frames, terminal = "audit", 6, None
        self.begin(kind, frames, after, budget, terminal)
