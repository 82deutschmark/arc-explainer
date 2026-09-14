# ARC-AGI-3 candidate task g542.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PARCHMENT, PAPER, ASH, STONE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
ROSE, CORAL, RED, SKY, AQUA, GOLD = 6, 7, 8, 9, 10, 11
BRASS, OXBLOOD, MOSS, VIOLET = 12, 13, 14, 15

GLYPHS = 4
MAX_RIBBON = 4
TERMINAL_INDEX = 9
RUNTIME_VERSION = "q193-v3-qc-repair-2"

QC_CONTROL_LABELS = {
    1: "Up: choose the outlined shape to the left, or the previous cam after clamping",
    2: "Down: choose the outlined shape to the right, or the next cam after clamping",
    3: "Left or A: punch the chosen shape into the gold empty slot; after clamping, show the preview",
    4: "Right or D: remove the last editable punch, hide a preview, or reopen an unused clamp",
    5: "Z: clamp only a row that matches the shown row, or seal a large diamond page break",
    6: "Click the lit green preview platen to replay its whole row into the current page",
}
QC_GOAL = (
    "Complete the bottom ribbon so it matches the shown row. In Level 1 the "
    "brass-framed first punch is a locked example, the gold dotted slot is the "
    "place you can fill, and the needed shape starts selected in gold. Clamp the "
    "match, reveal the preview, then click the lit green platen to replay the "
    "whole row into each page; press Z when a large diamond page break blocks "
    "the next page. A rejected clamp or replay cracks one wax seal and the second "
    "rejection loses. Other useful moves spend side rivets; Right or D corrects "
    "editable work, and Reset restarts the level."
)


def bindery(name, motif, cams, budget, *, prefill=(), branch_after=(),
            locked_prefix=0, start_selector=0):
    branches = frozenset(branch_after)
    return {
        "name": name,
        "motif": tuple(motif),
        "cams": tuple(cams),
        "budget": budget,
        "prefill": tuple(prefill),
        "locked_prefix": locked_prefix,
        "start_selector": start_selector,
        "branch_after": branches,
        "required_branches": branches,
    }


LEVELS = [
    bindery("First Impression", (0, 2), (0, 0), 12, prefill=(0,),
             branch_after=(0,), locked_prefix=1, start_selector=2),
    bindery("Branch Binding", (1, 3, 0), (0, 1), 16,
             branch_after=(0,)),
    bindery("Ratchet Refrain", (2, 0, 3), (0, 0, 0), 19,
             branch_after=(0, 1)),
    bindery("Counterfeit Tooth", (0, 1, 3, 2), (3, 0), 17,
             branch_after=(0,)),
    bindery("Shifted Signatures", (3, 1, 0), (2, 1, 2), 23,
             branch_after=(0, 1)),
    bindery("Open the Misbinding", (1, 2, 3, 0), (0, 3), 14,
             prefill=(1, 2, 1), branch_after=(0,)),
    bindery("Four-Folio Register", (0, 3, 1, 2), (1, 0, 2, 1), 25,
             branch_after=(0, 2)),
    bindery("Brassbound Routines", (2, 1, 3, 0), (3, 0, 2, 3, 1), 26,
             prefill=(2, 1, 2), branch_after=(0, 2, 3)),
]


def transform_ribbon(ribbon, cam):
    ribbon = tuple(ribbon)
    if cam == 0:
        return ribbon
    if cam == 1:
        return tuple(reversed(ribbon))
    if cam == 2:
        return tuple((glyph + 1) % GLYPHS for glyph in ribbon)
    if not ribbon:
        return ribbon
    return ribbon[:-1] + ((ribbon[-1] + 1) % GLYPHS,)


def target_segments(level):
    return tuple(transform_ribbon(level["motif"], cam)
                 for cam in level["cams"])


def branch_bit(index):
    return 1 << (GLYPHS + index)


def required_branch_mask(level):
    return sum(branch_bit(index) for index in level["required_branches"])


def branch_contract_ready(level, state):
    required = required_branch_mask(level)
    return state[8] & required == required


def branch_pending(level, state):
    previous = state[5] - 1
    return (state[5] > 0 and previous in level["branch_after"]
            and not state[8] & branch_bit(previous))


def start_state(level):
    return (level["prefill"], level.get("start_selector", 0), 0, 0, 0, 0,
            2, 0, 0, 0)


def rejected(state):
    seals = state[6] - 1
    return state[:6] + (seals, 1) + state[8:TERMINAL_INDEX] + (
        3 if seals <= 0 else 0,
    )


def blocked(state):
    return state[:7] + (1,) + state[8:]


def transition(level, state, action):
    if state[TERMINAL_INDEX] or action not in (1, 2, 3, 4, 5, 6):
        return state
    ribbon, selector, bound, cam, preview, folio, seals, _warning, used, _ = state

    if not bound:
        if action == 1:
            return (ribbon, (selector - 1) % GLYPHS, bound, cam, preview,
                    folio, seals, 0, used, 0)
        if action == 2:
            return (ribbon, (selector + 1) % GLYPHS, bound, cam, preview,
                    folio, seals, 0, used, 0)
        if action == 3:
            if len(ribbon) >= len(level["motif"]):
                return blocked(state)
            return (ribbon + (selector,), selector, bound, cam, preview,
                    folio, seals, 0, used, 0)
        if action == 4:
            if len(ribbon) <= level.get("locked_prefix", 0):
                return blocked(state)
            return (ribbon[:-1], selector, bound, cam, preview, folio,
                    seals, 0, used, 0)
        if action == 5:
            if ribbon != level["motif"]:
                return rejected(state)
            return (ribbon, selector, 1, 0, 0, folio, seals, 0, used, 0)
        return blocked(state)

    if branch_pending(level, state):
        if action == 5:
            return (ribbon, selector, bound, 0, 0, folio, seals, 0,
                    used | branch_bit(folio - 1), 0)
        return blocked(state)
    if folio >= len(level["cams"]):
        return blocked(state)

    if action == 1:
        return (ribbon, selector, bound, (cam - 1) % GLYPHS, 0,
                folio, seals, 0, used, 0)
    if action == 2:
        return (ribbon, selector, bound, (cam + 1) % GLYPHS, 0,
                folio, seals, 0, used, 0)
    if action == 3:
        if preview:
            return blocked(state)
        return (ribbon, selector, bound, cam, 1, folio, seals, 0, used, 0)
    if action == 4:
        if preview:
            return (ribbon, selector, bound, cam, 0, folio,
                    seals, 0, used, 0)
        if folio:
            return blocked(state)
        return (ribbon, selector, 0, cam, 0, folio, seals, 0, used, 0)
    if action == 5:
        return blocked(state)

    if not preview or cam != level["cams"][folio]:
        return rejected(state)
    next_folio = folio + 1
    final = next_folio == len(level["cams"])
    terminal = 2 if final and branch_contract_ready(level, state) else 0
    return (ribbon, selector, bound, 0, 0, next_folio, seals, 0,
            used | (1 << cam), terminal)


def action_cost(state, after):
    if after == state:
        return 0
    if after[:7] == state[:7] and after[8:] == state[8:]:
        return 0
    if after[6] < state[6]:
        return 0
    return 1


def solved(_level, state):
    return (state[TERMINAL_INDEX] == 2
            and branch_contract_ready(_level, state))


def shortest_turns(current, target):
    clockwise = (target - current) % GLYPHS
    counter = (current - target) % GLYPHS
    if clockwise <= counter:
        return (2,) * clockwise
    return (1,) * counter


def known_solution(level):
    ribbon = level["prefill"]
    prefix = 0
    while (prefix < len(ribbon) and prefix < len(level["motif"])
           and ribbon[prefix] == level["motif"][prefix]):
        prefix += 1
    plan = [4] * (len(ribbon) - prefix)
    selector = level.get("start_selector", 0)
    for glyph in level["motif"][prefix:]:
        moves = shortest_turns(selector, glyph)
        plan.extend(moves); selector = glyph; plan.append(3)
    plan.append(5)
    for index, cam in enumerate(level["cams"]):
        plan.extend(shortest_turns(0, cam))
        plan.extend((3, 6))
        if index in level["branch_after"]:
            plan.append(5)
    return tuple(plan)


class BinderyDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False, width=1):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            x = x0 + (x1 - x0) * index // steps
            y = y0 + (y1 - y0) * index // steps
            for dy in range(-(width // 2), width - width // 2):
                for dx in range(-(width // 2), width - width // 2):
                    if 0 <= x + dx < 64 and 0 <= y + dy < 64:
                        frame[y + dy, x + dx] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        inner = max(0, radius - 1) ** 2
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
                    frame[y, x] = color

    @classmethod
    def box(cls, frame, left, top, right, bottom, color, dotted=False,
            width=1):
        cls.line(frame, (left, top), (right, top), color, dotted, width)
        cls.line(frame, (right, top), (right, bottom), color, dotted, width)
        cls.line(frame, (right, bottom), (left, bottom), color, dotted, width)
        cls.line(frame, (left, bottom), (left, top), color, dotted, width)

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            reach = radius - abs(dy)
            if hollow:
                frame[cy + dy, cx - reach] = color
                frame[cy + dy, cx + reach] = color
            else:
                frame[cy + dy, cx - reach:cx + reach + 1] = color

    @classmethod
    def triangle(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        height = max(1, radius * 2)
        for row in range(height + 1):
            y = cy - radius + row
            reach = row * radius // height
            if hollow:
                frame[y, cx - reach] = color; frame[y, cx + reach] = color
            else:
                frame[y, cx - reach:cx + reach + 1] = color
        cls.line(frame, (cx - radius, cy + radius),
                 (cx + radius, cy + radius), color)

    @classmethod
    def glyph(cls, frame, center, identity, color=INK, small=False):
        x, y = center; radius = 3 if small else 4
        if identity == 0:
            cls.disc(frame, center, radius, color, hollow=True)
            cls.line(frame, (x - 1, y - radius), (x + 1, y - radius), color)
            cls.line(frame, (x - 1, y + radius), (x + 1, y + radius), color)
        elif identity == 1:
            cls.triangle(frame, center, radius, color, hollow=True)
            cls.line(frame, (x, y - radius + 2), (x, y + radius - 1),
                     color, dotted=True)
        elif identity == 2:
            cls.diamond(frame, center, radius, color, hollow=True)
            cls.line(frame, (x - radius + 1, y), (x + radius - 1, y), color)
            cls.line(frame, (x, y - radius + 1), (x, y + radius - 1), color)
        else:
            cls.line(frame, (x - radius, y - radius),
                     (x - radius, y + radius), color)
            cls.line(frame, (x + radius, y - radius),
                     (x + radius, y + radius), color)
            cls.line(frame, (x - radius, y - radius), (x, y - 1), color)
            cls.line(frame, (x + radius, y - radius), (x, y - 1), color)
            cls.line(frame, (x - radius, y + radius), (x - 2, y + radius),
                     color)
            cls.line(frame, (x + 2, y + radius), (x + radius, y + radius),
                     color)

    @classmethod
    def cam(cls, frame, center, identity, color=BRASS, small=False):
        x, y = center; radius = 2 if small else 4
        if identity == 0:
            cls.disc(frame, center, radius, color, hollow=True)
            cls.line(frame, (x, y - radius - 1), (x, y - 1), color)
        elif identity == 1:
            cls.disc(frame, center, radius, color, hollow=True)
            cls.line(frame, (x - radius, y), (x + radius, y), color)
            cls.line(frame, (x - radius, y), (x - radius + 2, y - 2), color)
            cls.line(frame, (x + radius, y), (x + radius - 2, y + 2), color)
        elif identity == 2:
            cls.diamond(frame, center, radius, color, hollow=True)
            cls.line(frame, (x - 2, y), (x + 2, y), color)
            cls.line(frame, (x, y - 2), (x, y + 2), color)
        else:
            cls.line(frame, (x - radius, y - radius),
                     (x + radius, y - radius), color)
            cls.line(frame, (x - radius, y - radius),
                     (x - radius, y + radius), color)
            cls.line(frame, (x + radius, y - radius),
                     (x + radius, y + radius), color)
            cls.line(frame, (x - radius, y + radius),
                     (x + 1, y + radius), color)
            cls.line(frame, (x + 3, y + radius),
                     (x + radius, y + radius), color)
            cls.disc(frame, center, 1, color)

    @staticmethod
    def ribbon_centers(length):
        spacing = 11
        start = 32 - (length - 1) * spacing // 2
        return tuple((start + index * spacing) for index in range(length))

    def background(self, frame):
        frame[:, :] = PARCHMENT
        frame[1:63, 1] = CHARCOAL; frame[1:63, 62] = CHARCOAL
        frame[1, 1:63] = CHARCOAL; frame[62, 1:63] = CHARCOAL
        frame[35:62, 2:62] = OXBLOOD
        frame[37:60, 3:61] = PAPER
        for x in range(4, 61, 7):
            self.line(frame, (x, 61), (x + 4, 58), CHARCOAL, dotted=True)
        for x in range(4, 61, 9):
            self.line(frame, (x, 3), (x + 5, 3), ASH, dotted=True)
        self.line(frame, (3, 34), (60, 34), BRASS, dotted=True)
        for x in range(5, 61, 8):
            self.disc(frame, (x, 36), 1, GOLD, hollow=True)

    def folio_register(self, frame, state):
        level = self.game.level; total = len(level["cams"])
        centers = ((32,) if total == 1 else
                   tuple(8 + i * 48 // (total - 1) for i in range(total)))
        for index, (x, cam_id) in enumerate(zip(centers, level["cams"])):
            complete = index < state[5]
            color = CHARCOAL if complete else BRASS
            frame[6:20, max(3, x - 5):min(61, x + 6)] = PAPER
            self.line(frame, (x - 5, 6), (x - 5, 20), color,
                      dotted=not complete)
            self.line(frame, (x + 5, 6), (x + 5, 20), color,
                      dotted=not complete)
            self.line(frame, (x - 5, 6), (x + 5, 6), color)
            self.cam(frame, (x, 13), cam_id, color, small=True)
            if complete:
                self.disc(frame, (x, 18), 1, OXBLOOD)
                self.line(frame, (x - 2, 18), (x + 2, 18), INK)
            if index == state[5] and not state[TERMINAL_INDEX]:
                self.line(frame, (x - 6, 4), (x, 2), OXBLOOD)
                self.line(frame, (x, 2), (x + 6, 4), OXBLOOD)
            if index in level["branch_after"] and index + 1 < total:
                bx = (x + centers[index + 1]) // 2
                sealed = bool(state[8] & branch_bit(index))
                color = MOSS if sealed else OXBLOOD
                self.line(frame, (bx, 5), (bx, 21), color,
                          dotted=not sealed, width=2 if sealed else 1)
                self.diamond(frame, (bx, 22), 3, color, hollow=not sealed)
                if branch_pending(level, state) and state[5] - 1 == index:
                    self.line(frame, (bx, 21), (bx, 39), OXBLOOD, width=2)
                    self.diamond(frame, (bx, 34), 5, GOLD, hollow=True)
                    self.line(frame, (bx - 10, 30), (bx - 4, 34), BRASS,
                              width=2)
                    self.line(frame, (bx + 10, 30), (bx + 4, 34), BRASS,
                              width=2)

    def target_and_preview(self, frame, state):
        level = self.game.level
        if state[5] >= len(level["cams"]):
            target = transform_ribbon(level["motif"], level["cams"][-1])
        else:
            target = target_segments(level)[state[5]]
        centers = self.ribbon_centers(len(target))
        left, right = centers[0] - 6, centers[-1] + 6
        frame[22:32, left:right + 1] = PAPER
        self.box(frame, left, 22, right, 31, BRASS)
        for x, glyph in zip(centers, target):
            self.glyph(frame, (x, 27), glyph, CHARCOAL)
            frame[31, x - 3:x + 4:2] = ASH

        if (not self.game.level_index and not state[2]
                and len(state[0]) < len(target)):
            index = len(state[0])
            x = centers[index]
            self.box(frame, x - 5, 22, x + 5, 31, GOLD, width=2)

        frame[33:40, 10:55] = ASH
        if state[2] and state[4]:
            frame[33:40, 10:55] = PARCHMENT
            self.box(frame, 10, 32, 54, 39, MOSS, width=2)
            ghost = transform_ribbon(state[0], state[3])
            for x, glyph in zip(self.ribbon_centers(len(ghost)), ghost):
                self.glyph(frame, (x, 36), glyph, INK, small=True)
            self.line(frame, (7, 38), (7, 32), MOSS, width=2)
            self.triangle(frame, (7, 31), 2, MOSS)
            self.line(frame, (57, 38), (57, 32), MOSS, width=2)
            self.triangle(frame, (57, 31), 2, MOSS)
        else:
            self.box(frame, 10, 32, 54, 39, STONE, dotted=True)
            for x in centers:
                self.disc(frame, (x, 36), 1, STONE, hollow=True)
        if (not self.game.level_index and not state[2]
                and len(state[0]) < len(target)):
            x = centers[len(state[0])]
            self.line(frame, (x, 32), (x, 41), GOLD, dotted=True)

    def working_ribbon(self, frame, state):
        frame[42:52, 5:60] = PAPER
        self.line(frame, (5, 42), (59, 42), CHARCOAL, dotted=True)
        self.line(frame, (5, 51), (59, 51), CHARCOAL, dotted=True)
        centers = self.ribbon_centers(len(self.game.level["motif"]))
        locked = self.game.level.get("locked_prefix", 0)
        for index, x in enumerate(centers):
            slot_color = GOLD if index == len(state[0]) and not state[2] else ASH
            self.box(frame, x - 5, 42, x + 5, 51, slot_color,
                     dotted=index >= len(state[0]))
            if index < len(state[0]):
                match = state[0][index] == self.game.level["motif"][index]
                if index < locked:
                    frame[43:51, x - 4:x + 5] = ASH
                    self.box(frame, x - 5, 42, x + 5, 51, BRASS, width=2)
                    for dx in (-3, 3):
                        self.disc(frame, (x + dx, 49), 1, OXBLOOD)
                else:
                    self.box(frame, x - 5, 42, x + 5, 51,
                             MOSS if match else RED, width=2)
                self.glyph(frame, (x, 47), state[0][index], INK)
        if state[2]:
            self.line(frame, (3, 41), (3, 52), BRASS, width=2)
            self.line(frame, (61, 41), (61, 52), BRASS, width=2)
            self.line(frame, (3, 41), (11, 39), BRASS, width=2)
            self.line(frame, (61, 41), (53, 39), BRASS, width=2)
            self.line(frame, (11, 39), (53, 39), GOLD, width=2)
            self.diamond(frame, (32, 41), 3, OXBLOOD)
        else:
            self.line(frame, (4, 53), (60, 53), OXBLOOD, dotted=True)
            if len(state[0]) >= len(centers):
                self.line(frame, (4, 43), (4, 50), CHARCOAL, width=2)
                self.line(frame, (60, 43), (60, 50), CHARCOAL, width=2)

    def gauges(self, frame, state):
        active = state[3] if state[2] else state[1]
        for identity, x in enumerate((13, 26, 39, 52)):
            color = INK if identity == active else STONE
            if state[2]:
                self.cam(frame, (x, 58), identity, color)
            else:
                self.glyph(frame, (x, 58), identity, color, small=True)
            if identity == active:
                self.box(frame, x - 6, 53, x + 6, 62, GOLD, width=2)
                self.triangle(frame, (x, 53), 2, GOLD)

        if (not self.game.level_index and not state[2]
                and len(state[0]) < len(self.game.level["motif"])):
            slot_x = self.ribbon_centers(len(self.game.level["motif"]))[
                len(state[0])]
            choice_x = (13, 26, 39, 52)[active]
            self.line(frame, (choice_x, 52), (slot_x, 50), GOLD, width=2)

        for index, y in enumerate((25, 34)):
            live = index < state[6]
            self.disc(frame, (59, y), 3, OXBLOOD if live else ASH,
                      hollow=not live)
            if live:
                self.disc(frame, (59, y), 1, PAPER, hollow=True)
            else:
                self.line(frame, (56, y + 3), (62, y - 3), RED, width=2)

        shown = self.game.budget_left
        for index in range(self.game.budget_max):
            x = 3 if index < 13 else 60
            y = 24 + (index % 13) * 2
            if index < shown:
                self.disc(frame, (x, y), 1, GOLD)
            else:
                frame[y, x] = ASH
                if x + 1 < 64:
                    frame[y, x + 1] = CHARCOAL
        if not shown:
            self.line(frame, (2, 23), (4, 49), RED, width=2)
            self.line(frame, (4, 23), (2, 49), RED, width=2)

    def status_feedback(self, frame, state):
        if not state[7]:
            return
        if state[6] < 2:
            if state[2]:
                self.line(frame, (13, 32), (51, 39), RED, width=2)
                self.line(frame, (51, 32), (13, 39), RED, width=2)
                self.box(frame, 9, 31, 55, 40, RED, width=2)
            else:
                self.line(frame, (5, 40), (14, 46), RED, width=2)
                self.line(frame, (59, 40), (50, 46), RED, width=2)
                self.line(frame, (13, 43), (51, 51), RED, width=2)
                self.line(frame, (51, 43), (13, 51), RED, width=2)
                broken_y = 25 if state[6] == 0 else 34
                self.line(frame, (52, 45), (57, broken_y + 2), RED,
                          dotted=True)
        else:
            locked = self.game.level.get("locked_prefix", 0)
            if not state[2] and len(state[0]) >= len(self.game.level["motif"]):
                self.line(frame, (8, 40), (56, 40), CHARCOAL, width=2)
                self.line(frame, (8, 53), (56, 53), CHARCOAL, width=2)
                self.box(frame, 56, 42, 60, 51, ASH, width=2)
            elif not state[2] and len(state[0]) <= locked and locked:
                x = self.ribbon_centers(len(self.game.level["motif"]))[0]
                self.box(frame, x - 7, 40, x + 7, 53, BRASS, width=2)
                self.diamond(frame, (x, 40), 2, OXBLOOD)
                self.line(frame, (x - 3, 52), (x + 3, 52), BRASS, width=2)
            else:
                self.box(frame, 11, 32, 53, 39, CHARCOAL, width=2)
                self.line(frame, (18, 35), (46, 35), CHARCOAL, width=2)
                self.line(frame, (18, 38), (46, 38), ASH, width=2)

    def page_break_feedback(self, frame, state):
        level = self.game.level
        if not branch_pending(level, state):
            return
        total = len(level["cams"])
        centers = ((32,) if total == 1 else
                   tuple(8 + i * 48 // (total - 1) for i in range(total)))
        previous = state[5] - 1
        bx = (centers[previous] + centers[previous + 1]) // 2
        self.line(frame, (bx, 20), (bx, 41), OXBLOOD, width=2)
        self.diamond(frame, (bx, 34), 6, GOLD, hollow=True)
        self.diamond(frame, (bx, 34), 2, OXBLOOD)
        self.line(frame, (bx - 13, 30), (bx - 6, 34), BRASS, width=2)
        self.line(frame, (bx + 13, 30), (bx + 6, 34), BRASS, width=2)

    def tutorial_cues(self, frame, state):
        if self.game.level_index or state[TERMINAL_INDEX]:
            return
        centers = self.ribbon_centers(len(self.game.level["motif"]))
        if state[7]:
            return
        if branch_pending(self.game.level, state):
            self.diamond(frame, (32, 34), 6, GOLD, hollow=True)
            self.diamond(frame, (32, 34), 2, OXBLOOD)
            return
        if not state[2]:
            if state[0] == self.game.level["motif"]:
                self.box(frame, centers[0] - 6, 41,
                         centers[-1] + 6, 52, MOSS, width=2)
                self.line(frame, (4, 40), (12, 46), GOLD, width=2)
                self.line(frame, (60, 40), (52, 46), GOLD, width=2)
                self.diamond(frame, (32, 40), 2, GOLD, hollow=True)
            else:
                index = min(len(state[0]), len(centers) - 1)
                self.box(frame, centers[index] - 6, 41,
                         centers[index] + 6, 52, GOLD, width=2)
        elif not state[4]:
            self.box(frame, 9, 31, 55, 40, GOLD, width=2)
        else:
            self.box(frame, 8, 30, 56, 41, MOSS, width=2)
            self.line(frame, (6, 39), (6, 32), MOSS, width=2)
            self.triangle(frame, (6, 31), 2, MOSS)

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.state[TERMINAL_INDEX] == 3:
                self.box(frame, 4, 20, 60, 53, RED, width=2)
                self.line(frame, (8, 22), (56, 51), RED, width=2)
                self.line(frame, (56, 22), (8, 51), RED, width=2)
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress; span = max(1, g.anim_total - 1)
        wave = min(p, span - p)

        if g.anim_kind == "ratchet":
            center = (56, 56) if before[2] else (8, 56)
            radius = 5 + wave
            self.disc(frame, center, radius, BRASS, hollow=True)
            angle = 2 * math.pi * p / max(1, span)
            tooth = (center[0] + round(radius * math.cos(angle)),
                     center[1] + round(radius * math.sin(angle)))
            self.line(frame, center, tooth, GOLD)
        elif g.anim_kind == "punch":
            index = len(before[0])
            x = self.ribbon_centers(len(g.level["motif"]))[index]
            y = 35 + 12 * p // span
            self.box(frame, x - 6, 41, x + 6, 52, GOLD, width=2)
            self.line(frame, (x, 55), (x, 51), GOLD, width=2)
            self.line(frame, (x - 4, y - 5), (x + 4, y - 5), CHARCOAL, width=2)
            self.glyph(frame, (x, y), before[1], OXBLOOD)
        elif g.anim_kind == "edit":
            index = max(0, len(before[0]) - 1)
            x = self.ribbon_centers(len(g.level["motif"]))[index]
            y = 47 - 10 * p // span
            self.glyph(frame, (x + wave, y), before[0][-1] if before[0] else 3,
                       ASH)
            self.line(frame, (x - 4, y + 4), (x + 5, y - 3), OXBLOOD,
                      dotted=True)
        elif g.anim_kind == "clamp":
            inset = 20 * p // span
            self.line(frame, (3 + inset, 38), (3 + inset, 51), BRASS, width=2)
            self.line(frame, (61 - inset, 38), (61 - inset, 51), BRASS, width=2)
            self.line(frame, (3 + inset, 38), (10 + inset // 2, 34), GOLD)
            self.line(frame, (61 - inset, 38), (54 - inset // 2, 34), GOLD)
        elif g.anim_kind == "preview":
            edge = 13 + 38 * p // span
            self.line(frame, (13, 36), (edge, 36), GOLD, width=2)
            ghost = transform_ribbon(before[0], before[3])
            for index, (x, glyph) in enumerate(zip(self.ribbon_centers(len(ghost)), ghost)):
                if index * span <= p * len(ghost):
                    self.glyph(frame, (x, 36), glyph, BRASS, small=True)
        elif g.anim_kind == "release":
            self.line(frame, (8, 35 - wave), (56, 35 + wave), ASH,
                      dotted=True)
            self.line(frame, (8, 35 + wave), (56, 35 - wave), BRASS,
                      dotted=True)
        elif g.anim_kind == "unclamp":
            inset = 20 * (span - p) // span
            self.line(frame, (3 + inset, 38), (3 + inset, 51), BRASS, width=2)
            self.line(frame, (61 - inset, 38), (61 - inset, 51), BRASS, width=2)
        elif g.anim_kind == "replay":
            ghost = transform_ribbon(before[0], before[3])
            y = 47 - 20 * p // span
            for x, glyph in zip(self.ribbon_centers(len(ghost)), ghost):
                self.glyph(frame, (x, y), glyph, BRASS)
                self.line(frame, (x, 47), (x, y), ASH, dotted=True)
            self.disc(frame, (56, 56), 5 + wave, GOLD, hollow=True)
        elif g.anim_kind == "reject":
            offset = (-2, 1, 2, -1, 2, 0, -1, 0)[min(p, 7)]
            top = 32 if before[2] else 42
            bottom = 39 if before[2] else 51
            self.line(frame, (14 + offset, top), (50 + offset, bottom), RED,
                      width=2)
            self.line(frame, (50 + offset, top), (14 + offset, bottom), RED,
                      width=2)
            if not before[2]:
                self.line(frame, (5 + offset, 40), (14 + offset, 46), RED,
                          width=2)
                self.line(frame, (59 + offset, 40), (50 + offset, 46), RED,
                          width=2)
            self.disc(frame, (49, 32), 3 + wave, RED, hollow=True)
        elif g.anim_kind == "success":
            for index, x in enumerate(range(7, 59, 10)):
                y = 28 - (p + index) % 5
                self.glyph(frame, (x, y), index % GLYPHS, GOLD)
            self.line(frame, (5, 21), (5 + 54 * p // span, 21), MOSS,
                      width=2)
        elif g.anim_kind == "loss":
            inset = 27 * p // span
            self.line(frame, (3 + inset, 22), (3 + inset, 52), RED, width=2)
            self.line(frame, (61 - inset, 22), (61 - inset, 52), RED, width=2)
        else:
            offset = (-2, 2, -1, 1, 0)[min(p, 4)]
            self.box(frame, 12 + offset, 31, 52 + offset, 40,
                     OXBLOOD, width=2)
            self.line(frame, (18 + offset, 33), (46 + offset, 38),
                      OXBLOOD, width=2)
            self.line(frame, (46 + offset, 33), (18 + offset, 38),
                      OXBLOOD, width=2)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        state = self.game.state
        self.folio_register(frame, state)
        self.target_and_preview(frame, state)
        self.working_ribbon(frame, state)
        self.gauges(frame, state)
        self.page_break_feedback(frame, state)
        self.status_feedback(frame, state)
        self.tutorial_cues(frame, state)
        self.animation(frame)
        return frame


class G542(ARCBaseGame):
    def __init__(self):
        self.runtime_version = RUNTIME_VERSION
        self.display = BinderyDisplay(self)
        self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level),
                        name=level["name"]) for level in LEVELS]
        super().__init__("g542", levels,
                         Camera(0, 0, 64, 64, PARCHMENT, PARCHMENT, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

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
        before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:TERMINAL_INDEX] + (3,)
            self.begin("loss", 7, lost, self.budget_left, "loss")
            return
        budget = self.budget_left - cost
        won = after[TERMINAL_INDEX] == 2
        lost = after[TERMINAL_INDEX] == 3
        warning_only = (after[:7] == before[:7]
                        and after[8:] == before[8:])
        if won:
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 7, "loss"
        elif after[6] < before[6]:
            kind, frames, terminal = "reject", 7, None
        elif warning_only:
            kind, frames, terminal = "blocked", 5, None
        elif action in (1, 2):
            kind, frames, terminal = "ratchet", 5, None
        elif not before[2] and action == 3:
            kind, frames, terminal = "punch", 6, None
        elif action == 4:
            if before[2] and before[4]:
                kind, frames, terminal = "release", 5, None
            elif before[2]:
                kind, frames, terminal = "unclamp", 6, None
            else:
                kind, frames, terminal = "edit", 6, None
        elif not before[2] and action == 5:
            kind, frames, terminal = "clamp", 7, None
        elif before[2] and action == 3:
            kind, frames, terminal = "preview", 6, None
        elif before[2] and action == 5:
            kind, frames, terminal = "release", 5, None
        elif before[2] and action == 6:
            kind, frames, terminal = "replay", 7, None
        else:
            kind, frames, terminal = "blocked", 5, None
        self.begin(kind, frames, after, budget, terminal)
