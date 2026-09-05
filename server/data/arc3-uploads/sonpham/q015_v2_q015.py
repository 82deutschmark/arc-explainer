# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q015-v2 Reciprocity Garden -- visible short-memory social causality.

Every partner carries a three-knot memory garland and a shape-coded response
policy.  Open-hand and closed-knot gestures rewrite that partner's memory;
their visible reply then changes blooms or persistent obligations.  Later
gardens add seeds, shelters, delayed replies, and neighbor cascades.  The
target is a second, outer garland rather than a hidden answer string.
"""

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15

ECHO, MAJORITY, FORGIVING, GUARDED = 0, 1, 2, 3
HAND, KNOT, SEED, SHELTER = 0, 1, 2, 3


RAW_LEVELS = [
    {
        "name": "First Welcome", "n": 2, "policies": (ECHO, ECHO),
        "memories": (2, 5), "gestures": 2, "delay": False,
        "cascade": False, "relay": False, "budget": 1,
        "solution": (5,),
    },
    {
        "name": "Many Garlands", "n": 3, "policies": (ECHO, ECHO, ECHO),
        "memories": (0, 7, 2), "gestures": 2, "delay": False,
        "cascade": False, "relay": False, "budget": 6,
        "solution": (5, 2, 4, 5, 2, 3, 5),
    },
    {
        "name": "Three-Petal Council", "n": 3,
        "policies": (MAJORITY, ECHO, MAJORITY), "memories": (7, 0, 3),
        "gestures": 2, "delay": False, "cascade": False, "relay": False,
        "budget": 7, "solution": (4, 5, 2, 3, 5, 2, 4, 5),
    },
    {
        "name": "Seed and Shelter", "n": 3,
        "policies": (GUARDED, FORGIVING, ECHO), "memories": (0, 0, 5),
        "gestures": 4, "delay": False, "cascade": False, "relay": False,
        "budget": 6, "solution": (5, 3, 5, 2, 3, 5, 3, 3, 5),
    },
    {
        "name": "Patient Ribbon", "n": 3,
        "policies": (ECHO, MAJORITY, FORGIVING), "memories": (2, 7, 0),
        "gestures": 4, "delay": True, "cascade": False, "relay": False,
        "budget": 11, "solution": (5, 3, 3, 5, 2, 4, 4, 5, 3, 3, 5),
    },
    {
        "name": "Neighbor Garland", "n": 4,
        "policies": (ECHO, MAJORITY, FORGIVING, ECHO),
        "memories": (0, 7, 0, 2), "gestures": 4, "delay": False,
        "cascade": True, "relay": False, "budget": 7,
        "solution": (5, 2, 4, 5, 2, 3, 5),
    },
    {
        "name": "Remembered Circle", "n": 4,
        "policies": (MAJORITY, GUARDED, ECHO, FORGIVING),
        "memories": (7, 0, 2, 0), "gestures": 4, "delay": True,
        "cascade": True, "relay": False, "budget": 12,
        "solution": (4, 5, 4, 5, 2, 4, 5, 3, 3, 5, 4, 5),
    },
    {
        "name": "Reciprocity Garden", "n": 5,
        "policies": (GUARDED, MAJORITY, FORGIVING, ECHO, MAJORITY),
        "memories": (0, 7, 1, 2, 3), "gestures": 4, "delay": True,
        "cascade": True, "relay": True, "budget": 15,
        "solution": (3, 5, 4, 5, 4, 4, 5, 2, 2, 4, 4, 5, 4, 4, 5),
    },
]


def start_state(level):
    # partner, gesture, three-knot memories, blooms, seeds, shelters,
    # obligations, queued reply, two repair patches, terminal
    return (0, 0, tuple(level["memories"]), 0, 0, 0, 0, 0, 2, 0)


def _reply(level, memories, shelters, partner):
    memory = memories[partner]
    policy = level["policies"][partner]
    if policy == ECHO:
        return memory & 1
    if policy == MAJORITY:
        return int(memory.bit_count() >= 2)
    if policy == FORGIVING:
        return int(bool(memory & 3))
    return int(bool(shelters & (1 << partner)))


def _apply_reply(level, memories, blooms, seeds, obligations, recipient, reply):
    memories = list(memories)

    def apply_one(index, bit, rewrite):
        nonlocal blooms, seeds, obligations
        marker = 1 << index
        if rewrite:
            memories[index] = ((memories[index] << 1) | bit) & 7
        if bit:
            if seeds & marker:
                seeds &= ~marker
                blooms |= marker
            else:
                blooms ^= marker
        else:
            obligations ^= marker

    apply_one(recipient, reply, level["relay"])
    if level["cascade"]:
        neighbor = (recipient + 1) % level["n"]
        apply_one(neighbor, reply, True)
    return tuple(memories), blooms, seeds, obligations


def configuration_solved(level, state):
    if state[9]:
        return False
    target = level["target"]
    return (state[2] == target["memories"] and state[3] == target["blooms"]
            and state[4] == target["seeds"] and state[5] == target["shelters"]
            and state[6] == target["obligations"] and state[7] == target["pending"])


def _mistake(state):
    values = list(state)
    if values[8] > 0:
        values[8] -= 1
    else:
        values[9] = 3
    return tuple(values)


def transition(level, state, action):
    partner, gesture, memories, blooms, seeds, shelters, obligations, pending, repairs, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 1:
        return ((partner - 1) % level["n"], gesture, memories, blooms, seeds,
                shelters, obligations, pending, repairs, 0)
    if action == 2:
        return ((partner + 1) % level["n"], gesture, memories, blooms, seeds,
                shelters, obligations, pending, repairs, 0)
    if action == 3:
        return (partner, (gesture - 1) % level["gestures"], memories, blooms,
                seeds, shelters, obligations, pending, repairs, 0)
    if action == 4:
        return (partner, (gesture + 1) % level["gestures"], memories, blooms,
                seeds, shelters, obligations, pending, repairs, 0)
    if action == 6:
        if configuration_solved(level, state):
            return state[:-1] + (2,)
        return _mistake(state)

    marker = 1 << partner
    if gesture in (HAND, KNOT):
        if pending:
            return state
        memories = list(memories)
        memories[partner] = ((memories[partner] << 1) | int(gesture == HAND)) & 7
        memories = tuple(memories)
        reply = _reply(level, memories, shelters, partner)
        recipient = (partner + 1) % level["n"] if level["relay"] else partner
        if level["delay"]:
            pending = recipient * 2 + reply + 1
        else:
            memories, blooms, seeds, obligations = _apply_reply(
                level, memories, blooms, seeds, obligations, recipient, reply)
    elif gesture == SEED:
        if pending:
            coded = pending - 1
            recipient, reply = coded // 2, coded % 2
            memories, blooms, seeds, obligations = _apply_reply(
                level, memories, blooms, seeds, obligations, recipient, reply)
            pending = 0
        else:
            seeds ^= marker
    else:
        shelters ^= marker
        if shelters & marker:
            obligations &= ~marker
    return (partner, gesture, memories, blooms, seeds, shelters, obligations,
            pending, repairs, 0)


def action_cost(before, after):
    if after == before or after[8] != before[8] or after[9] in (2, 3):
        return 0
    return 1


def solved(_level, state):
    return state[9] == 2


def _finalize_levels():
    levels = []
    for raw in RAW_LEVELS:
        level = {key: deepcopy(value) for key, value in raw.items() if key != "solution"}
        state = start_state(level)
        for action in raw["solution"]:
            state = transition(level, state, action)
            assert not state[9]
        assert not state[7]
        level["target"] = {
            "memories": state[2], "blooms": state[3], "seeds": state[4],
            "shelters": state[5], "obligations": state[6], "pending": state[7],
        }
        levels.append(level)
    return levels


LEVELS = _finalize_levels()


class GardenDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False, limit=None):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        last = steps if limit is None else min(steps, max(0, limit * steps // 100))
        for step in range(last + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius * radius and (not hollow or distance >= max(0, radius - 2) ** 2):
                    frame[y, x] = color

    @staticmethod
    def diamond(frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            y = cy + dy
            if not 0 <= y < 64:
                continue
            width = radius - abs(dy)
            if hollow:
                for x in (cx - width, cx + width):
                    if 0 <= x < 64:
                        frame[y, x] = color
            else:
                frame[y, max(0, cx - width):min(64, cx + width + 1)] = color

    @staticmethod
    def positions(n):
        return tuple((32 + round(15 * math.cos(-math.pi / 2 + 2 * math.pi * i / n)),
                      31 + round(15 * math.sin(-math.pi / 2 + 2 * math.pi * i / n)))
                     for i in range(n))

    @staticmethod
    def gesture_positions():
        return ((32, 24), (39, 31), (32, 38), (25, 31))

    @staticmethod
    def badge_position(center, slot, target=False):
        """Place seven paired state channels in one outward partner fan."""
        x, y = center; radial_x, radial_y = x - 32, y - 31
        length = max(1.0, math.hypot(radial_x, radial_y))
        normal_x, normal_y = radial_x / length, radial_y / length
        tangent_x, tangent_y = -normal_y, normal_x
        radial = 11 if target else 7
        tangent = (slot - 3) * 4
        return (round(x + normal_x * radial + tangent_x * tangent),
                round(y + normal_y * radial + tangent_y * tangent))

    def background(self, frame):
        frame[:, :] = PEARL
        for index in range(16):
            angle = 2 * math.pi * index / 16
            center = (32 + round(25 * math.cos(angle)), 31 + round(24 * math.sin(angle)))
            self.disc(frame, center, 5, ROSE)
        self.disc(frame, (32, 31), 24, WHITE)
        self.disc(frame, (32, 31), 22, PEARL)
        self.disc(frame, (32, 31), 18, ROSE, hollow=True)
        for y in range(9, 56, 7):
            for x in range(5 + (y % 3), 60, 11):
                self.line(frame, (x, y), (x + 2, y - 1), ASH)
        for index in range(24):
            angle = 2 * math.pi * index / 24
            x = 32 + round(28 * math.cos(angle)); y = 31 + round(27 * math.sin(angle))
            self.diamond(frame, (x, y), 1, CORAL if index % 2 else GOLD)

    def policy_body(self, frame, center, policy, identity):
        x, y = center
        if policy == ECHO:
            self.diamond(frame, center, 4, GREEN)
            self.line(frame, (x, y - 3), (x, y + 4), EARTH)
            self.line(frame, (x, y), (x + 3, y - 2), WHITE)
        elif policy == MAJORITY:
            for dx, dy in ((0, -3), (-3, 2), (3, 2)):
                self.disc(frame, (x + dx, y + dy), 3, GOLD)
            self.diamond(frame, center, 2, EARTH)
        elif policy == FORGIVING:
            self.disc(frame, center, 5, AQUA)
            self.disc(frame, (x + 3, y - 1), 5, PEARL)
            self.diamond(frame, (x - 2, y + 1), 2, GREEN)
        else:
            self.line(frame, (x - 5, y + 3), (x, y - 5), VIOLET)
            self.line(frame, (x, y - 5), (x + 5, y + 3), VIOLET)
            self.line(frame, (x - 5, y + 3), (x + 5, y + 3), EARTH)
            self.diamond(frame, (x, y), 3, ROSE)
        # One-to-three inset notches distinguish partners that share a policy
        # without occupying the outward state fan.
        count = identity % 3 + 1
        radial_x, radial_y = x - 32, y - 31
        length = max(1.0, math.hypot(radial_x, radial_y))
        normal_x, normal_y = radial_x / length, radial_y / length
        tangent_x, tangent_y = -normal_y, normal_x
        for mark in range(count):
            tangent = (mark - (count - 1) / 2) * 2
            notch = (round(x - normal_x * 4 + tangent_x * tangent),
                     round(y - normal_y * 4 + tangent_y * tangent))
            self.diamond(frame, notch, 0, WHITE)

    def memory_mark(self, frame, center, bit, target=False):
        color = VIOLET if target else GREEN
        if bit:
            self.diamond(frame, center, 1, color, hollow=target)
        else:
            x, y = center
            self.line(frame, (x - 1, y - 1), (x + 1, y + 1), color)
            self.line(frame, (x + 1, y - 1), (x - 1, y + 1), color)

    def memories(self, frame, center, index, state):
        level = self.game.level
        current = state[2][index]; target = level["target"]["memories"][index]
        for order in range(3):
            current_center = self.badge_position(center, order)
            target_center = self.badge_position(center, order, target=True)
            self.memory_mark(frame, current_center, (current >> (2 - order)) & 1)
            self.memory_mark(frame, target_center, (target >> (2 - order)) & 1, target=True)

    def badge_connectors(self, frame, center):
        for slot in range(7):
            current_center = self.badge_position(center, slot)
            target_center = self.badge_position(center, slot, target=True)
            self.line(frame, current_center, target_center, ASH, dotted=True)

    def small_status(self, frame, center, kind, active, target=False):
        x, y = center; color = VIOLET if target else EARTH
        if not active:
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = SLATE
            return
        if kind == 0:  # bloom
            for dx, dy in ((0, 0), (0, -1), (1, 0), (0, 1), (-1, 0)):
                if 0 <= x + dx < 64 and 0 <= y + dy < 64:
                    frame[y + dy, x + dx] = color
        elif kind == 1:  # seed
            self.line(frame, (x, y - 1), (x - 1, y + 1), color)
            self.line(frame, (x - 1, y + 1), (x + 1, y + 1), color)
            self.line(frame, (x + 1, y + 1), (x, y - 1), color)
        elif kind == 2:  # shelter
            self.line(frame, (x - 1, y), (x, y - 1), color)
            self.line(frame, (x, y - 1), (x + 1, y), color)
            self.line(frame, (x - 1, y), (x - 1, y + 1), color)
            self.line(frame, (x + 1, y), (x + 1, y + 1), color)
        else:  # obligation knot
            self.line(frame, (x - 1, y - 1), (x + 1, y + 1), color)
            self.line(frame, (x + 1, y - 1), (x - 1, y + 1), color)

    def statuses(self, frame, center, index, state):
        current_masks = state[3:7]
        target = self.game.level["target"]
        target_masks = (target["blooms"], target["seeds"], target["shelters"], target["obligations"])
        for kind in range(4):
            current_center = self.badge_position(center, 3 + kind)
            target_center = self.badge_position(center, 3 + kind, target=True)
            self.small_status(frame, current_center, kind,
                              bool(current_masks[kind] & (1 << index)))
            self.small_status(frame, target_center, kind,
                              bool(target_masks[kind] & (1 << index)), target=True)

    def gesture_icon(self, frame, center, gesture, selected=False):
        x, y = center
        if gesture == HAND:
            self.diamond(frame, (x, y + 1), 2, GREEN)
            for dx in (-2, 0, 2):
                self.line(frame, (x + dx, y), (x + dx, y - 3), GREEN)
        elif gesture == KNOT:
            self.disc(frame, center, 3, EARTH, hollow=True)
            self.line(frame, (x - 3, y - 3), (x + 3, y + 3), EARTH)
            self.line(frame, (x + 3, y - 3), (x - 3, y + 3), EARTH)
        elif gesture == SEED:
            self.line(frame, (x, y - 3), (x - 3, y + 3), GOLD)
            self.line(frame, (x - 3, y + 3), (x + 3, y + 3), GOLD)
            self.line(frame, (x + 3, y + 3), (x, y - 3), GOLD)
            self.diamond(frame, center, 1, GREEN)
        else:
            self.line(frame, (x - 4, y + 3), (x, y - 4), VIOLET)
            self.line(frame, (x, y - 4), (x + 4, y + 3), VIOLET)
            self.line(frame, (x - 4, y + 3), (x + 4, y + 3), EARTH)
        if selected:
            for dx, dy in ((0, -5), (5, 0), (0, 5), (-5, 0)):
                self.diamond(frame, (x + dx, y + dy), 1, WHITE)

    def apparatus(self, frame):
        game = self.game; state = game.state; positions = self.positions(game.level["n"])
        moving_partner = game.anim_kind == "partner" and game.anim_progress < max(1, game.anim_total - 1)
        moving_gesture = game.anim_kind == "gesture" and game.anim_progress < max(1, game.anim_total - 1)
        for index, center in enumerate(positions):
            self.policy_body(frame, center, game.level["policies"][index], index)
        for center in positions:
            self.badge_connectors(frame, center)
        for index, center in enumerate(positions):
            self.memories(frame, center, index, state)
            self.statuses(frame, center, index, state)
            if index == state[0] and not moving_partner:
                radial_x, radial_y = center[0] - 32, center[1] - 31
                length = max(1.0, math.hypot(radial_x, radial_y))
                tangent_x, tangent_y = -radial_y / length, radial_x / length
                for side in (-1, 1):
                    marker = (round(center[0] + tangent_x * 7 * side),
                              round(center[1] + tangent_y * 7 * side))
                    self.diamond(frame, marker, 1, WHITE)
        for gesture in range(game.level["gestures"]):
            self.gesture_icon(frame, self.gesture_positions()[gesture], gesture,
                              selected=gesture == state[1] and not moving_gesture)
        # A delayed reply remains as a physical bead and tether.
        if state[7]:
            coded = state[7] - 1; recipient, reply = coded // 2, coded % 2
            target = positions[recipient]
            self.line(frame, (32, 31), target, VIOLET, dotted=True)
            midpoint = ((32 + target[0]) // 2, (31 + target[1]) // 2)
            if reply:
                self.diamond(frame, midpoint, 3, GREEN, hollow=True)
            else:
                self.disc(frame, midpoint, 3, EARTH, hollow=True)
                self.line(frame, (midpoint[0] - 2, midpoint[1] - 2),
                          (midpoint[0] + 2, midpoint[1] + 2), EARTH)

    def hud(self, frame):
        game = self.game
        shown = game.budget_left
        if (game.anim_kind and game.pending_budget is not None
                and game.anim_progress >= max(1, game.anim_total - 1)
                and game.anim_kind != "success"):
            shown = game.pending_budget
        for group in range((game.budget_max + 4) // 5):
            cx, cy = 8 + group * 12, 3
            self.disc(frame, (cx, cy), 1, EARTH)
            offsets = ((0, -2), (2, -1), (2, 1), (-2, 1), (-2, -1))
            for leaf, (dx, dy) in enumerate(offsets):
                unit = group * 5 + leaf
                if unit >= game.budget_max:
                    continue
                x, y = cx + dx, cy + dy
                if unit < shown:
                    self.diamond(frame, (x, y), 1, GREEN)
                else:
                    self.line(frame, (x - 1, y - 1), (x + 1, y + 1), SLATE)
                    self.line(frame, (x + 1, y - 1), (x - 1, y + 1), SLATE)
        for index, x in enumerate((56, 61)):
            active = index < game.state[8]
            self.disc(frame, (x, 60), 2, VIOLET if active else SLATE, hollow=True)
            if active:
                self.line(frame, (x - 1, 60), (x + 1, 60), WHITE)
            else:
                self.line(frame, (x - 2, 58), (x + 2, 62), RED)
                self.line(frame, (x + 2, 58), (x - 2, 62), RED)

    def terminal(self, frame):
        terminal = self.game.state[9]
        if terminal == 3:
            for radius in (8, 14, 20):
                self.disc(frame, (32, 31), radius, EARTH, hollow=True)
            self.line(frame, (14, 13), (50, 49), SLATE)
            self.line(frame, (50, 13), (14, 49), SLATE)

    def animation(self, frame):
        game = self.game
        if game.intro_mark:
            for radius in (3, 7, 11):
                self.disc(frame, (32, 31), radius, GOLD, hollow=True)
        if not game.anim_kind:
            return
        p = game.anim_progress; span = max(1, game.anim_total - 1)
        before, after = game.anim_before, game.pending_state
        positions = self.positions(game.level["n"])
        if game.anim_kind == "partner" and p < span:
            start, finish = positions[before[0]], positions[after[0]]
            point = (start[0] + (finish[0] - start[0]) * p // span,
                     start[1] + (finish[1] - start[1]) * p // span)
            self.disc(frame, point, 7, WHITE, hollow=True)
        elif game.anim_kind == "gesture" and p < span:
            icons = self.gesture_positions(); start, finish = icons[before[1]], icons[after[1]]
            point = (start[0] + (finish[0] - start[0]) * p // span,
                     start[1] + (finish[1] - start[1]) * p // span)
            self.diamond(frame, point, 4, WHITE, hollow=True)
        elif game.anim_kind == "interact" and p < span:
            source = (32, 31); actor = positions[before[0]]
            if p * 2 <= span:
                self.line(frame, source, actor, CORAL, dotted=True, limit=200 * p // span)
                reach = (source[0] + (actor[0] - source[0]) * (2 * p) // span,
                         source[1] + (actor[1] - source[1]) * (2 * p) // span)
                self.disc(frame, reach, 2, GOLD, hollow=True)
            else:
                self.line(frame, source, actor, CORAL, dotted=True)
                changed = ((before[3] ^ after[3]) | (before[4] ^ after[4])
                           | (before[5] ^ after[5]) | (before[6] ^ after[6]))
                for index, target in enumerate(positions):
                    if changed & (1 << index):
                        amount = (2 * p - span) * 100 // span
                        self.line(frame, actor, target, VIOLET, dotted=True, limit=amount)
                        point = (actor[0] + (target[0] - actor[0]) * amount // 100,
                                 actor[1] + (target[1] - actor[1]) * amount // 100)
                        self.diamond(frame, point, 2, GREEN, hollow=True)
                if before[7] != after[7]:
                    radius = 1 + (2 * p - span) * 4 // span
                    self.disc(frame, (32, 31), radius, VIOLET, hollow=True)
        elif game.anim_kind == "audit" and p < span:
            x = (56, 61)[max(0, before[8] - 1)] if before[8] else 61
            radius = 1 + 2 * p // span
            self.line(frame, (x - radius, 60 - radius), (x + radius, 60 + radius), RED)
            self.line(frame, (x + radius, 60 - radius), (x - radius, 60 + radius), RED)
        elif game.anim_kind == "blocked" and p < span:
            folded = min(p, span - p); radius = 3 + 3 * folded // max(1, span // 2)
            self.disc(frame, positions[before[0]], radius, EARTH, hollow=True)
        elif game.anim_kind == "success":
            for radius in range(4, min(29, 4 + p * 4), 5):
                self.disc(frame, (32, 31), radius, GREEN, hollow=True)
            for index, center in enumerate(positions):
                if index <= p:
                    self.diamond(frame, center, 5, GOLD, hollow=True)
        elif game.anim_kind == "loss" and p < span:
            inset = 6 * p // span
            self.line(frame, (8 + inset, 7 + inset), (56 - inset, 55 - inset), EARTH)
            self.line(frame, (56 - inset, 7 + inset), (8 + inset, 55 - inset), SLATE)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game
        preview = (game.anim_kind in ("partner", "gesture", "interact", "audit", "blocked", "loss")
                   and game.pending_state is not None
                   and game.anim_progress >= max(1, game.anim_total - 1))
        current = game.state
        if preview:
            game.state = game.pending_state
        self.background(frame); self.apparatus(frame); self.hud(frame); self.terminal(frame)
        if preview:
            game.state = current
        self.animation(frame)
        return frame


class Q015(ARCBaseGame):
    def __init__(self):
        self.display = GardenDisplay(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level), name=level["name"])
                  for level in LEVELS]
        super().__init__("q015", levels, Camera(0, 0, 64, 64, PEARL, PEARL, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True

    def begin(self, kind, frames, before, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.anim_before = before; self.pending_state = after; self.pending_budget = budget
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.budget_left = self.pending_budget; self.anim_kind = None
        self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win":
            self.next_level()
        elif terminal == "loss":
            self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0:
                self.finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action(); return
        self.intro_mark = False; before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, before, self.budget_left); return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:-1] + (3,)
            self.begin("loss", 7, before, lost, self.budget_left, "loss"); return
        budget = self.budget_left - cost
        if after[9] == 2:
            kind, frames, terminal = "success", 7, "win"
        elif after[9] == 3:
            kind, frames, terminal = "loss", 7, "loss"
        elif action in (1, 2):
            kind, frames, terminal = "partner", 5, None
        elif action in (3, 4):
            kind, frames, terminal = "gesture", 5, None
        elif action == 5:
            kind, frames, terminal = "interact", 7, None
        else:
            kind, frames, terminal = "audit", 6, None
        self.begin(kind, frames, before, after, budget, terminal)
