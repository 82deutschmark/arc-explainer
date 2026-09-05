# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q165-v3 The Patient Folio -- an archival cabinet for patient inference.

Candidates advertise their predictions before the player chooses a specimen press.
Evidence is retained as a separate card and never edits the candidate stack: the
player must park incompatible leaves manually, may restore them, and audits only
after a discriminative evidence set has been assembled.  Later folios introduce
negative impressions, delayed development, pinned evidence, explicit revision,
and compound two-mark observations.  This version keeps the inference model
unchanged while giving every input a quiet five-to-seven-frame press/develop/
settle response and arranging the predictions as a dense glass-and-paper atlas.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, LINEN, MIST, CLAY, BARK, INK = 0, 1, 2, 3, 4, 5
BERRY, ROSE, RED, BLUE, SKY, HONEY, APRICOT, PLUM, SAGE, LAVENDER = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


def folio(name, predictions, target, quota, budget, **rules):
    probes = len(predictions[0])
    base = {
        "name": name,
        "predictions": tuple(tuple(row) for row in predictions),
        "target": target,
        "quota": quota,
        "budget": budget,
        "negative_mask": 0,
        "delayed_mask": 0,
        "locked_mask": 0,
        "required_mask": 0,
        "revisions": 0,
        "must_revise": False,
        "revision_probe": -1,
        "compound": (-1,) * probes,
    }
    base.update(rules)
    return base


LEVELS = [
    folio("First Impression", ((0, 0), (1, 0), (1, 1)), 0, 1, 10,
          required_mask=0b01),
    folio("Forked Claims", ((0, 0, 0), (0, 1, 0), (1, 0, 0), (1, 1, 0)), 2, 2, 15,
          required_mask=0b011),
    folio("Counterleaf", ((0, 0, 1), (1, 0, 1), (1, 1, 1), (2, 0, 1)), 1, 2, 15,
          negative_mask=0b010, required_mask=0b011),
    folio("Sleeping Ink", ((0, 0, 0, 0), (0, 1, 0, 1), (1, 0, 1, 0),
                            (1, 1, 0, 0), (1, 0, 0, 1)), 3, 2, 21,
          delayed_mask=0b0001, required_mask=0b0011),
    folio("Pinned Specimen", ((0, 0, 0, 0), (0, 1, 1, 0), (1, 0, 0, 1),
                               (1, 1, 0, 0), (1, 0, 1, 0)), 4, 2, 21,
          locked_mask=0b0001, required_mask=0b0101),
    folio("Erratum Thread", ((0, 0, 0, 0), (1, 0, 1, 1), (2, 1, 0, 1),
                              (0, 1, 1, 0), (1, 0, 0, 1)), 2, 2, 24,
          locked_mask=0b0001, required_mask=0b0110, revisions=1,
          must_revise=True, revision_probe=0),
    folio("Twin Imprint", ((0, 0, 0, 0, 0), (0, 0, 1, 0, 1), (0, 1, 0, 1, 0),
                            (0, 1, 1, 1, 1), (1, 1, 0, 1, 1),
                            (1, 1, 1, 0, 1)), 4, 2, 28,
          delayed_mask=0b00010, required_mask=0b00011,
          compound=(-1, 3, -1, -1, -1)),
    folio("The Patient Folio", ((0, 0, 0, 0, 0), (1, 1, 0, 1, 2),
                                 (2, 1, 2, 0, 2), (0, 0, 2, 1, 2),
                                 (1, 1, 2, 1, 0), (2, 1, 2, 1, 2)), 5, 3, 34,
          delayed_mask=0b00100, locked_mask=0b00001,
          required_mask=0b01110, revisions=1, must_revise=True,
          revision_probe=0, compound=(-1, -1, -1, 4, -1)),
]


def probe_count(level):
    return len(level["predictions"][0])


def reported(level, candidate, probe):
    value = level["predictions"][candidate][probe]
    return 2 - value if level["negative_mask"] & (1 << probe) else value


def probe_signature(level, candidate, probe):
    result = (reported(level, candidate, probe),)
    partner = level["compound"][probe]
    if partner >= 0:
        result += (reported(level, candidate, partner),)
    return result


def consistent_mask(level, used_mask):
    target = level["target"]
    mask = 0
    for candidate in range(len(level["predictions"])):
        if all(probe_signature(level, candidate, probe) == probe_signature(level, target, probe)
               for probe in range(probe_count(level)) if used_mask & (1 << probe)):
            mask |= 1 << candidate
    return mask


def evidence_ready(level, state):
    used = state[3]
    revised = state[7] < level["revisions"]
    return (state[4] < 0
            and used.bit_count() == level["quota"]
            and used & level["required_mask"] == level["required_mask"]
            and (not level["must_revise"] or revised)
            and consistent_mask(level, used) == 1 << level["target"])


def start_state(level):
    count = len(level["predictions"])
    # phase, candidate cursor, probe cursor, used probes, pending probe,
    # active candidates, retained evidence order, revisions, retries, terminal
    return 0, 0, 0, 0, -1, (1 << count) - 1, (), level["revisions"], 2, 0


def transition(level, state, action):
    phase, cursor, probe, used, pending, active, history, revisions, chances, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    candidates = len(level["predictions"])
    probes = probe_count(level)

    if action == 1:
        return phase, (cursor - 1) % candidates, probe, used, pending, active, history, revisions, chances, terminal
    if action == 2:
        return phase, (cursor + 1) % candidates, probe, used, pending, active, history, revisions, chances, terminal

    if phase == 0:
        if action == 3:
            return phase, cursor, (probe - 1) % probes, used, pending, active, history, revisions, chances, terminal
        if action == 4:
            return phase, cursor, (probe + 1) % probes, used, pending, active, history, revisions, chances, terminal
        if action == 5:
            if pending >= 0:
                bit = 1 << pending
                if used & bit or used.bit_count() >= level["quota"]:
                    return state
                return phase, cursor, probe, used | bit, -1, active, history + (pending,), revisions, chances, terminal
            bit = 1 << probe
            if used & bit:
                if level["locked_mask"] & bit:
                    if revisions <= 0 or probe != level["revision_probe"]:
                        return state
                    revisions -= 1
                new_history = tuple(item for item in history if item != probe)
                return phase, cursor, probe, used & ~bit, -1, active, new_history, revisions, chances, terminal
            if used.bit_count() >= level["quota"]:
                return state
            if level["delayed_mask"] & bit:
                return phase, cursor, probe, used, probe, active, history, revisions, chances, terminal
            return phase, cursor, probe, used | bit, -1, active, history + (probe,), revisions, chances, terminal
        if action == 6:
            if evidence_ready(level, state):
                return 1, cursor, probe, used, pending, active, history, revisions, chances, terminal
            chances -= 1
            return phase, cursor, probe, used, pending, active, history, revisions, chances, 3 if chances <= 0 else 0
        return state

    if action == 3:
        return phase, cursor, probe, used, pending, active ^ (1 << cursor), history, revisions, chances, terminal
    if action == 4:
        if not history:
            return state
        next_probe = history[0] if probe not in history else history[(history.index(probe) + 1) % len(history)]
        return phase, cursor, next_probe, used, pending, active, history, revisions, chances, terminal
    if action == 6:
        if (evidence_ready(level, state)
                and active == 1 << level["target"]
                and cursor == level["target"]):
            return phase, cursor, probe, used, pending, active, history, revisions, chances, 2
        chances -= 1
        return phase, cursor, probe, used, pending, active, history, revisions, chances, 3 if chances <= 0 else 0
    return state


def action_cost(state, after):
    # A rejected folio close consumes a wax retry, not a page-turn action.
    return 0 if after[8] < state[8] else 1


def solved(_level, state):
    return state[-1] == 2


class FolioDisplay(RenderableUserDisplay):
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
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @classmethod
    def rect(cls, frame, left, top, right, bottom, color, dotted=False):
        """A thin archival plate; critical cards are never raw filled boxes."""
        cls.line(frame, (left, top), (right, top), color, dotted)
        cls.line(frame, (right, top), (right, bottom), color, dotted)
        cls.line(frame, (right, bottom), (left, bottom), color, dotted)
        cls.line(frame, (left, bottom), (left, top), color, dotted)

    @staticmethod
    def candidate_centers(count):
        layouts = {
            3: ((14, 44), (32, 31), (51, 44)),
            4: ((11, 45), (25, 33), (40, 33), (54, 45)),
            5: ((9, 46), (20, 36), (32, 31), (45, 36), (56, 46)),
            6: ((8, 47), (17, 38), (28, 32), (39, 32), (50, 38), (57, 47)),
        }
        return layouts[count]

    @staticmethod
    def probe_center(index, total):
        xs = (8, 19, 31, 43, 55)
        ys = (10, 6, 9, 6, 11)
        return xs[index], ys[index]

    @staticmethod
    def evidence_center(index):
        # Three retained glass slides sit in one calm, countable row.
        return 8 + index * 10, 23

    def background(self, frame):
        frame[:, :] = PAPER
        # Quiet specimen-cabinet architecture: rag paper, glass, and metal.
        self.rect(frame, 1, 1, 62, 62, CLAY)
        self.rect(frame, 3, 13, 60, 29, MIST)
        self.rect(frame, 3, 30, 60, 56, LINEN)
        for y in range(4, 61, 7):
            frame[y, 4 + (y * 3) % 8:60:13] = LINEN
        for x in range(6, 60, 11):
            frame[15 + x % 3:28:6, x] = MIST
        # Four brass hinge rosettes and a stitched lower binding.
        for center in ((3, 3), (60, 3), (3, 60), (60, 60)):
            self.disc(frame, center, 2, BARK, hollow=True)
            frame[center[1], center[0]] = INK
        self.line(frame, (4, 57), (59, 57), CLAY, dotted=True)
        for x in range(6, 59, 8):
            self.line(frame, (x, 55), (x + 3, 59), MIST)

    def sigil(self, frame, center, identity, color=INK, small=False):
        x, y = center; radius = 1 if small else 2; kind = identity % 6
        if kind == 0:
            self.disc(frame, center, radius + 1, color, hollow=True); frame[y, x] = color
        elif kind == 1:
            self.line(frame, (x, y - radius - 1), (x + radius + 1, y + radius), color)
            self.line(frame, (x + radius + 1, y + radius), (x - radius - 1, y + radius), color)
            self.line(frame, (x - radius - 1, y + radius), (x, y - radius - 1), color)
        elif kind == 2:
            self.line(frame, (x, y - radius - 1), (x + radius + 1, y), color)
            self.line(frame, (x + radius + 1, y), (x, y + radius + 1), color)
            self.line(frame, (x, y + radius + 1), (x - radius - 1, y), color)
            self.line(frame, (x - radius - 1, y), (x, y - radius - 1), color)
        elif kind == 3:
            self.line(frame, (x - radius - 1, y), (x + radius + 1, y), color)
            self.line(frame, (x, y - radius - 1), (x, y + radius + 1), color)
        elif kind == 4:
            self.line(frame, (x - radius, y - radius), (x + radius, y + radius), color)
            self.line(frame, (x + radius, y - radius), (x - radius, y + radius), color)
        else:
            for dx, dy in ((0, -2), (2, 0), (0, 2), (-2, 0)):
                self.disc(frame, (x + dx, y + dy), 1, color)

    def outcome(self, frame, center, value, small=False):
        x, y = center; radius = 1 if small else 2
        if value == 0:
            self.disc(frame, center, radius + 1, PLUM, hollow=True)
        elif value == 1:
            self.disc(frame, center, radius + 1, SAGE)
            self.line(frame, (x, y - radius - 2), (x + 2, y - radius - 4), SAGE)
        else:
            self.line(frame, (x - radius - 1, y + radius), (x, y - radius - 1), APRICOT)
            self.line(frame, (x, y - radius - 1), (x + radius + 1, y + radius), APRICOT)
            self.line(frame, (x - radius, y), (x + radius, y), INK, dotted=True)

    def probe_glyph(self, frame, center, probe, color=CLAY):
        self.sigil(frame, center, probe, color, small=True)

    def leaf(self, frame, center, identity, active, selected, signature):
        x, y = center
        # A glass plate makes prediction comparison dense and rectilinear,
        # while the specimen itself keeps a distinct leaf/rosette silhouette.
        self.rect(frame, x - 7, y - 10, x + 7, y + 8,
                  CLAY if active else MIST, dotted=not active)
        self.line(frame, (32, 56), (x, y + 6), BARK, dotted=not active)
        if active:
            # Low-saturation paper/glass field; identity is shape-coded, never
            # a rainbow lookup.  Sage and steel are restrained accents.
            color = (LINEN, MIST, CLAY, LINEN, MIST, CLAY)[identity % 6]
            self.disc(frame, center, 6, color)
            self.line(frame, (x, y - 8), (x - 5, y + 2), color)
            self.line(frame, (x, y - 8), (x + 5, y + 2), color)
            if identity % 2:
                self.disc(frame, (x - 4, y - 3), 2, color)
            if identity % 3 == 2:
                self.disc(frame, (x + 4, y - 2), 2, color)
        else:
            self.disc(frame, center, 6, MIST, hollow=True)
            self.line(frame, (x - 5, y - 4), (x + 5, y + 4), CLAY)
            self.line(frame, (x + 2, y + 1), (x + 6, y - 3), CLAY)
        self.sigil(frame, (x, y - 2), identity, INK)
        offsets = (-3, 3) if len(signature) == 2 else (0,)
        for dx, value in zip(offsets, signature):
            self.outcome(frame, (x + dx, y + 4), value, small=True)
        if selected:
            self.disc(frame, center, 9, INK, hollow=True)
            self.disc(frame, (x, y - 10), 1, BERRY)

    def probes(self, frame):
        g = self.game; level = g.level; state = g.state; total = probe_count(level)
        for probe in range(total):
            center = self.probe_center(probe, total); used = bool(state[3] & (1 << probe))
            self.disc(frame, center, 5, CLAY if used else LINEN)
            self.disc(frame, center, 5, CLAY, hollow=True)
            self.probe_glyph(frame, center, probe, INK)
            if level["required_mask"] & (1 << probe):
                self.line(frame, (center[0] - 3, center[1] + 6), (center[0] + 3, center[1] + 6), SAGE)
                frame[center[1] + 5:center[1] + 8, center[0]] = SAGE
            if level["locked_mask"] & (1 << probe):
                self.disc(frame, (center[0] + 4, center[1] - 4), 2, PLUM)
                frame[center[1] - 4:center[1] + 1, center[0] + 4] = INK
            if level["delayed_mask"] & (1 << probe):
                self.disc(frame, center, 7, SKY, hollow=True)
            if level["compound"][probe] >= 0:
                self.disc(frame, (center[0] + 6, center[1]), 3, APRICOT, hollow=True)
            if probe == state[2] and state[0] == 0:
                self.disc(frame, center, 8, INK, hollow=True)
                self.disc(frame, (center[0], center[1] - 9), 1, BERRY)
            elif probe == state[2] and state[0] == 1:
                # Review focus is a double-notched ring, visibly distinct from
                # the open investigation cursor and tied to the evidence card.
                self.disc(frame, center, 8, PLUM, hollow=True)
                self.line(frame, (center[0] - 3, center[1] - 8),
                          (center[0] + 3, center[1] - 8), INK)
                self.line(frame, (center[0] - 3, center[1] + 8),
                          (center[0] + 3, center[1] + 8), INK)

    def evidence(self, frame):
        g = self.game; level = g.level; state = g.state
        for index, probe in enumerate(state[6]):
            center = self.evidence_center(index)
            self.rect(frame, center[0] - 4, center[1] - 5,
                      center[0] + 4, center[1] + 5, BARK)
            self.disc(frame, center, 5, LINEN)
            self.disc(frame, center, 5, BARK, hollow=True)
            self.probe_glyph(frame, (center[0], center[1] - 2), probe, INK)
            signature = probe_signature(level, level["target"], probe)
            offsets = (-2, 2) if len(signature) == 2 else (0,)
            for dx, value in zip(offsets, signature):
                self.outcome(frame, (center[0] + dx, center[1] + 2), value, small=True)
            if state[0] == 1 and probe == state[2]:
                self.disc(frame, center, 7, PLUM, hollow=True)
                self.line(frame, (center[0] - 5, center[1] + 6),
                          (center[0] + 5, center[1] + 6), INK)
        if state[4] >= 0:
            self.rect(frame, 47, 15, 59, 27, SKY)
            self.disc(frame, (53, 21), 6, SKY, hollow=True)
            self.probe_glyph(frame, (53, 21), state[4], INK)
            self.line(frame, (49, 25), (57, 17), SKY, dotted=True)

    def candidates(self, frame):
        g = self.game; state = g.state; level = g.level
        centers = self.candidate_centers(len(level["predictions"]))
        for candidate, center in enumerate(centers):
            signature = probe_signature(level, candidate, state[2])
            self.leaf(frame, center, candidate, bool(state[5] & (1 << candidate)),
                      candidate == state[1], signature)

    def hud(self, frame):
        g = self.game; state = g.state
        # Investigation is an open magnifying flower; review is a tied folio.
        if state[0] == 0:
            self.disc(frame, (37, 21), 4, SKY, hollow=True)
            self.line(frame, (40, 24), (43, 27), SKY)
        else:
            self.line(frame, (33, 17), (41, 24), CLAY)
            self.line(frame, (41, 17), (33, 24), CLAY)
            self.disc(frame, (37, 21), 3, LINEN)
        for index in range(g.level["revisions"]):
            center = (43 + index * 6, 27)
            self.disc(frame, center, 2, LAVENDER if index < state[7] else MIST, hollow=index >= state[7])
            self.line(frame, (center[0] - 2, center[1] + 3), (center[0] + 2, center[1] - 3), PLUM, dotted=True)
        for index in range(state[8]):
            self.disc(frame, (54 + index * 5, 27), 2, BERRY)
            self.disc(frame, (54 + index * 5, 27), 1, PAPER)
        # Four actions form one seed bloom.  A remaining action is a full
        # five-pixel petal; a spent action is only a one-pixel socket.  The
        # grouped silhouette therefore exposes every exact count without a
        # merged color strip, even at the 34-action maximum.
        petal_offsets = ((0, -2), (2, 0), (0, 2), (-2, 0))
        for group in range((g.budget_max + 3) // 4):
            center = (4 + group * 7, 60)
            self.disc(frame, center, 1, BARK)
            for petal, (dx, dy) in enumerate(petal_offsets):
                index = group * 4 + petal
                if index >= g.budget_max:
                    continue
                if index < g.budget_left:
                    self.disc(frame, (center[0] + dx, center[1] + dy), 1, BARK)
                else:
                    frame[center[1] + dy, center[0] + dx] = CLAY

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self.line(frame, (4, 56), (58, 53), HONEY, dotted=True)
            if g.terminal_hold == "loss":
                self.line(frame, (4, 13), (59, 55), PLUM, dotted=True)
                self.line(frame, (59, 13), (4, 55), PLUM, dotted=True)
            return
        p = g.anim_progress; state = g.state; after = g.pending_state
        if g.anim_kind in ("candidate_cursor", "probe_cursor"):
            if g.anim_kind == "candidate_cursor":
                center = self.candidate_centers(len(g.level["predictions"]))[after[1]]
            else:
                center = self.probe_center(after[2], probe_count(g.level))
            self.disc(frame, center, 7 + p, BERRY, hollow=True)
        elif g.anim_kind in ("press", "develop"):
            probe = state[4] if g.anim_kind == "develop" else state[2]
            card_index = len(state[6])
            card = self.evidence_center(card_index)
            if g.anim_kind == "develop":
                source, destination = (53, 21), card
            elif after[4] >= 0 and state[4] < 0:
                source, destination = self.probe_center(probe, probe_count(g.level)), (53, 21)
            else:
                source, destination = self.probe_center(probe, probe_count(g.level)), card
            x = source[0] + (destination[0] - source[0]) * p // g.anim_total
            y = source[1] + (destination[1] - source[1]) * p // g.anim_total - p * (g.anim_total - p) // 2
            self.disc(frame, (x, y), 3, SKY if g.anim_kind == "develop" else CLAY)
            self.probe_glyph(frame, (x, y), probe, INK)
        elif g.anim_kind in ("retract", "revision"):
            probe = state[2]
            card_index = state[6].index(probe) if probe in state[6] else max(0, len(state[6]) - 1)
            source = self.evidence_center(card_index)
            destination = self.probe_center(probe, probe_count(g.level))
            x = source[0] + (destination[0] - source[0]) * p // g.anim_total
            y = source[1] + (destination[1] - source[1]) * p // g.anim_total
            self.disc(frame, (x, y), 3 + p // 2, LAVENDER if g.anim_kind == "revision" else LINEN, hollow=True)
        elif g.anim_kind in ("park", "restore"):
            center = self.candidate_centers(len(g.level["predictions"]))[state[1]]
            self.disc(frame, center, 7 + p, MIST if g.anim_kind == "park" else SAGE, hollow=True)
            self.line(frame, (center[0] - 6 + p, center[1] - 5), (center[0] + 6 - p, center[1] + 5), CLAY)
        elif g.anim_kind == "phase":
            edge = 3 + p * 8
            frame[24:58, 2:min(62, edge):3] = LINEN
            self.line(frame, (edge, 23), (edge - 5, 57), CLAY)
        elif g.anim_kind == "reject":
            for offset in range(0, 55, 8):
                self.line(frame, (5 + offset + p, 14), (2 + offset, 55), PLUM, dotted=True)
        elif g.anim_kind == "success":
            for index, center in enumerate(self.candidate_centers(len(g.level["predictions"]))):
                self.disc(frame, center, 2 + p, (BARK, CLAY, SKY)[index % 3], hollow=True)
        elif g.anim_kind == "loss":
            self.line(frame, (4 + p * 3, 13), (59 - p * 3, 55), PLUM)
            self.line(frame, (59 - p * 3, 13), (4 + p * 3, 55), PLUM)
        else:
            # A blocked action presses two nonflashing metal brackets inward;
            # the fifth frame settles on the same deterministic state.
            center = (self.probe_center(state[2], probe_count(g.level))
                      if state[0] == 0 else
                      self.candidate_centers(len(g.level["predictions"]))[state[1]])
            inset = min(4, p)
            self.line(frame, (center[0] - 10 + inset, center[1] - 7),
                      (center[0] - 10 + inset, center[1] + 7), PLUM)
            self.line(frame, (center[0] + 10 - inset, center[1] - 7),
                      (center[0] + 10 - inset, center[1] + 7), PLUM)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        self.probes(frame)
        self.evidence(frame)
        self.candidates(frame)
        self.hud(frame)
        self.animation(frame)
        return frame


class Q165(ARCBaseGame):
    def __init__(self):
        self.display = FolioDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = None
        self.pending_budget = None
        self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q165", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

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
        before = self.state
        after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        budget = self.budget_left - action_cost(before, after)
        won = solved(self.level, after)
        lost = after[-1] == 3 or (budget <= 0 and not won)
        if won:
            kind = "success"
        elif lost:
            kind = "loss"
        elif after[8] < before[8]:
            kind = "reject"
        elif before[0] != after[0]:
            kind = "phase"
        elif before[1] != after[1]:
            kind = "candidate_cursor"
        elif before[2] != after[2]:
            kind = "probe_cursor"
        elif before[4] < 0 <= after[4]:
            kind = "press"
        elif before[4] >= 0 > after[4]:
            kind = "develop"
        elif before[3].bit_count() > after[3].bit_count():
            kind = "revision" if after[7] < before[7] else "retract"
        elif before[3] != after[3]:
            kind = "press"
        elif before[5] != after[5]:
            kind = "park" if after[5].bit_count() < before[5].bit_count() else "restore"
        else:
            kind = "blocked"
        frames = 7 if kind in ("success", "loss", "phase") else 5
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
