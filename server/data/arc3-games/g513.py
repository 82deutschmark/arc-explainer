# ARC-AGI-3 candidate task g513.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, CORAL, EARTH, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


RAW_LEVELS = [
    {
        "name": "One Keepsake", "faces": ((1, 6), (4, 3), (2, 5)),
        "bank": 1, "recipe": ((2, 0, 0),), "reorder": False,
        "flip": False, "develop": False, "paired_flip": False,
        "spread": False, "season": 1, "budget": 3,
    },
    {
        "name": "Small Folio", "faces": ((2, 5), (6, 1), (3, 4), (5, 2)),
        "bank": 2, "recipe": ((3, 0, 0), (1, 0, 0)), "reorder": True,
        "flip": False, "develop": False, "paired_flip": False,
        "spread": False, "season": 2, "budget": 9,
    },
    {
        "name": "Underleaf", "faces": ((1, 5), (4, 2), (7, 0), (3, 6), (6, 1)),
        "bank": 2, "recipe": ((3, 1, 0), (1, 0, 0)), "reorder": True,
        "flip": True, "develop": False, "paired_flip": False,
        "spread": False, "season": 4, "budget": 12,
    },
    {
        "name": "Tomorrow's Press", "faces": ((0, 7), (2, 5), (6, 1), (3, 4), (5, 0)),
        "bank": 2, "recipe": ((4, 0, 1), (1, 1, 0)), "reorder": True,
        "flip": True, "develop": True, "paired_flip": False,
        "spread": False, "season": 3, "budget": 13,
    },
    {
        "name": "Stitched Pair", "faces": ((1, 4), (6, 2), (0, 5), (3, 7), (5, 1), (2, 6)),
        "bank": 3, "recipe": ((3, 1, 0), (1, 1, 0), (4, 0, 0)), "reorder": True,
        "flip": True, "develop": False, "paired_flip": True,
        "spread": False, "season": 2, "budget": 13,
    },
    {
        "name": "Root Ink", "faces": ((4, 1), (7, 2), (2, 6), (0, 5), (5, 3), (1, 4)),
        "bank": 3, "recipe": ((4, 0, 1), (2, 0, 1), (0, 0, 0)), "reorder": True,
        "flip": False, "develop": True, "paired_flip": False,
        "spread": True, "season": 3, "budget": 17,
    },
    {
        "name": "Braided Herbarium", "faces": ((3, 6), (0, 5), (5, 1), (2, 7), (6, 4), (1, 3)),
        "bank": 3, "recipe": ((5, 1, 1), (2, 1, 1), (4, 0, 0)), "reorder": True,
        "flip": True, "develop": True, "paired_flip": True,
        "spread": True, "season": 5, "budget": 15,
    },
    {
        "name": "Wildflower Atlas", "faces": ((0, 5), (6, 1), (3, 7), (5, 2), (1, 4), (7, 0)),
        "bank": 3, "recipe": ((5, 1, 0), (1, 1, 1), (4, 0, 1)), "reorder": True,
        "flip": True, "develop": True, "paired_flip": True,
        "spread": True, "season": 3, "budget": 15,
    },
]


def encode_card(source, flipped=0, developed=0):
    return source * 4 + int(bool(flipped)) * 2 + int(bool(developed))


def decode_card(card):
    return card // 4, (card // 2) & 1, card & 1


def card_value(level, card):
    source, flipped, developed = decode_card(card)
    value = level["faces"][source][flipped]
    return value ^ level["season"] if developed else value


def target_cards(level):
    return tuple(encode_card(*item) for item in level["recipe"])


def start_state(level):
    return (0, 0, (), -1, 0, 2, level["budget"], 0)


def solved(level, state):
    return (state[0] == 1 and state[2] == target_cards(level)
            and state[3] == -1 and state[7] == 0)


def action_cost(before, after):
    return max(0, before[6] - after[6])


def _replace(state, **updates):
    names = ("phase", "cursor", "cards", "held", "lens", "seals", "budget", "terminal")
    values = dict(zip(names, state)); values.update(updates)
    return tuple(values[name] for name in names)


def _mistake(state):
    if state[5] > 1:
        return _replace(state, seals=state[5] - 1)
    return _replace(state, seals=0, terminal=2)


def _spend(state, **updates):
    if state[6] <= 0:
        return _replace(state, terminal=2)
    updates["budget"] = state[6] - 1
    return _replace(state, **updates)


def _transform(card, flip=False, develop=False):
    source, flipped, developed = decode_card(card)
    return encode_card(source, flipped ^ int(flip), developed ^ int(develop))


def transition(level, state, action):
    phase, cursor, cards, held, lens, seals, budget, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 6:
        return _replace(state, terminal=1) if solved(level, state) else _mistake(state)

    if phase == 0:
        count = len(level["faces"])
        if action == 1:
            return _spend(state, cursor=(cursor - 1) % count)
        if action == 2:
            return _spend(state, cursor=(cursor + 1) % count)
        if action == 3:
            sources = {decode_card(card)[0] for card in cards}
            if cursor in sources or len(cards) >= level["bank"]:
                return state
            pressing = encode_card(cursor, flipped=lens)
            placed = tuple(sorted(cards + (pressing,), key=lambda card: decode_card(card)[0]))
            return _spend(state, cards=placed)
        if action == 4:
            if len(cards) != level["bank"]:
                return _mistake(state)
            return _spend(state, phase=1, cursor=0, lens=0)
        if action == 5:
            return _spend(state, lens=1 - lens)
        return state

    count = len(cards) + (1 if held != -1 else 0)
    if action == 1 and count:
        return _spend(state, cursor=(cursor - 1) % count)
    if action == 2 and count:
        return _spend(state, cursor=(cursor + 1) % count)
    if action == 3 and level["reorder"]:
        if held == -1 and cards:
            picked = cards[cursor]
            remainder = cards[:cursor] + cards[cursor + 1:]
            return _spend(state, cards=remainder, held=picked,
                          cursor=min(cursor, len(remainder)))
        if held != -1:
            insertion = max(0, min(cursor, len(cards)))
            placed = cards[:insertion] + (held,) + cards[insertion:]
            return _spend(state, cards=placed, held=-1,
                          cursor=min(insertion, len(placed) - 1))
        return state
    if action == 4 and level["flip"] and held == -1 and cards:
        changed = list(cards); changed[cursor] = _transform(changed[cursor], flip=True)
        if level["paired_flip"] and len(changed) > 1:
            neighbor = (cursor + 1) % len(changed)
            changed[neighbor] = _transform(changed[neighbor], flip=True)
        return _spend(state, cards=tuple(changed))
    if action == 5 and level["develop"] and held == -1 and cards:
        changed = list(cards); changed[cursor] = _transform(changed[cursor], develop=True)
        if level["spread"] and len(changed) > 1:
            neighbor = (cursor + 1) % len(changed)
            changed[neighbor] = _transform(changed[neighbor], develop=True)
        return _spend(state, cards=tuple(changed))
    return state


LEVELS = []
for raw in RAW_LEVELS:
    level = deepcopy(raw)
    level["target"] = target_cards(level)
    LEVELS.append(level)


class G513A(RenderableUserDisplay):
    SOURCE_POSITIONS = ((8, 19), (16, 10), (26, 18), (36, 9), (47, 17), (55, 9), (55, 28))

    def __init__(self, game):
        self.game = game

    @staticmethod
    def pixel(frame, x, y, color):
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color

    @classmethod
    def line(cls, frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            cls.pixel(frame, round(x0 + (x1 - x0) * index / steps),
                      round(y0 + (y1 - y0) * index / steps), color)

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                distance = abs(x - cx) + abs(y - cy)
                if distance == radius if hollow else distance <= radius:
                    cls.pixel(frame, x, y, color)

    @classmethod
    def disc(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 1) ** 2):
                    cls.pixel(frame, x, y, color)

    @classmethod
    def polygon(cls, frame, points, color):
        for start, end in zip(points, points[1:] + points[:1]):
            cls.line(frame, start, end, color)

    def paper(self, frame):
        frame[:, :] = PEARL
        self.polygon(frame, [(2, 3), (12, 1), (24, 3), (35, 1), (47, 4), (61, 2),
                             (60, 53), (50, 55), (39, 53), (27, 55), (15, 53), (3, 55)], ASH)
        frame[5:52, 4:60] = WHITE
        for x, y, color in ((7, 6, ROSE), (20, 4, GOLD), (31, 6, GREEN), (43, 5, CORAL),
                            (56, 6, VIOLET), (10, 34, EARTH), (23, 32, AQUA),
                            (39, 34, ROSE), (54, 33, GREEN)):
            self.diamond(frame, (x, y), 1, color)
        self.line(frame, (5, 37), (59, 37), EARTH, dotted=True)

    def botanical(self, frame, center, value, color, small=False, developed=False):
        x, y = center; scale = 1 if small else 2
        self.line(frame, (x, y + 3 * scale), (x, y - 2 * scale), GREEN)
        if value & 1:
            self.disc(frame, (x - 2 * scale, y), scale, color, hollow=True)
        else:
            self.line(frame, (x - 3 * scale, y - scale), (x - scale, y + scale), SLATE)
            self.line(frame, (x - scale, y - scale), (x - 3 * scale, y + scale), SLATE)
        if value & 2:
            self.polygon(frame, [(x, y - scale), (x + 3 * scale, y - 2 * scale),
                                 (x + 2 * scale, y + scale)], color)
        else:
            self.diamond(frame, (x + 2 * scale, y), scale, SLATE, hollow=True)
        if value & 4:
            self.diamond(frame, (x, y - 3 * scale), scale + (0 if small else 1), color, hollow=True)
            self.pixel(frame, x, y - 3 * scale, GOLD)
        else:
            self.disc(frame, (x, y - 3 * scale), scale, SLATE, hollow=True)
        if developed:
            for dx, dy in ((-2, -2), (2, -2), (-2, 2), (2, 2)):
                self.diamond(frame, (x + dx * scale, y + dy * scale), 1, GOLD)

    def identity(self, frame, center, source, color, small=False):
        x, y = center
        if source % 3 == 0:
            self.disc(frame, (x, y), 2 if not small else 1, color, hollow=True)
        elif source % 3 == 1:
            self.diamond(frame, (x, y), 2 if not small else 1, color, hollow=True)
        else:
            reach = 2 if not small else 1
            self.line(frame, (x - reach, y + reach), (x, y - reach), color)
            self.line(frame, (x, y - reach), (x + reach, y + reach), color)
        for bit in range(3):
            px = x - 3 + bit * 3
            if source & (1 << bit): self.diamond(frame, (px, y + 3), 1, color)
            else: self.pixel(frame, px, y + 3, SLATE)

    def card(self, frame, center, card, target=False, selected=False, small=False):
        level = self.game.level
        source, flipped, developed = decode_card(card)
        x, y = center; half_w = 4 if small else 6; half_h = 6 if small else 8
        color = (CORAL, GREEN, VIOLET, GOLD, ROSE, AQUA, EARTH)[source % 7]
        points = [(x - half_w, y - half_h + 1), (x - half_w + 2, y - half_h),
                  (x + half_w, y - half_h + 1), (x + half_w - 1, y + half_h),
                  (x - half_w, y + half_h - 1)]
        self.polygon(frame, points, GOLD if target else EARTH)
        if selected:
            for corner in ((x - half_w, y - half_h), (x + half_w, y - half_h),
                           (x - half_w, y + half_h), (x + half_w, y + half_h)):
                self.diamond(frame, corner, 1, INK)
        self.botanical(frame, (x, y - 1), card_value(level, card), color,
                       small=True, developed=bool(developed))
        self.identity(frame, (x, y + half_h - 3), source, color, small=True)
        notch_x = x + half_w if flipped else x - half_w
        self.line(frame, (notch_x, y - 3), (notch_x + (-2 if flipped else 2), y - 1), INK)

    def source(self, frame, source, center, captured, lens, selected):
        level = self.game.level; color = (CORAL, GREEN, VIOLET, GOLD, ROSE, AQUA, EARTH)[source % 7]
        value = level["faces"][source][lens]
        if captured:
            self.disc(frame, center, 5, ASH, hollow=True)
            self.line(frame, (center[0] - 3, center[1] - 3), (center[0] + 3, center[1] + 3), EARTH)
            self.line(frame, (center[0] + 3, center[1] - 3), (center[0] - 3, center[1] + 3), EARTH)
        else:
            self.botanical(frame, center, value, color)
            self.identity(frame, (center[0], center[1] + 8), source, color)
        if selected:
            self.polygon(frame, [(center[0], center[1] - 10), (center[0] + 7, center[1] - 3),
                                 (center[0], center[1] + 10), (center[0] - 7, center[1] - 3)], INK)

    @staticmethod
    def row_positions(count, y):
        gap = 13 if count >= 4 else 16
        start = 32 - gap * (count - 1) / 2
        return [(round(start + index * gap), y) for index in range(count)]

    def target_row(self, frame, y=11, small=False):
        target = target_cards(self.game.level)
        for position, card in zip(self.row_positions(len(target), y), target):
            self.card(frame, position, card, target=True, small=small)

    def atlas_row(self, frame, state, y=43, *, omit=None):
        cards = state[2]
        for index, (position, card) in enumerate(zip(self.row_positions(len(cards), y), cards)):
            if index != omit:
                self.card(frame, position, card, selected=state[3] == -1 and index == state[1])
        if state[3] != -1:
            positions = self.row_positions(len(cards) + 1, y)
            insertion = max(0, min(state[1], len(cards)))
            self.card(frame, (positions[insertion][0], y - 8), state[3], selected=True)
            self.line(frame, (positions[insertion][0], y + 2), (positions[insertion][0], y + 9), VIOLET, dotted=True)
        positions = self.row_positions(max(1, len(cards)), y)
        for active, color, link_y in (
                (self.game.level["paired_flip"], VIOLET, y + 9),
                (self.game.level["spread"], GREEN, y + 11)):
            if not active:
                continue
            for start, finish in zip(positions, positions[1:] + positions[:1]):
                direction = 1 if finish[0] > start[0] else -1
                source_x = start[0] + direction * 4
                target_x = finish[0] - direction * 4
                self.line(frame, (source_x, link_y), (target_x, link_y), color, dotted=True)
                self.polygon(frame, [(target_x, link_y),
                                     (target_x - direction * 2, link_y - 1),
                                     (target_x - direction * 2, link_y + 1)], color)

    def garden(self, frame, state):
        captured = {decode_card(card)[0] for card in state[2]}
        for source in range(len(self.game.level["faces"])):
            self.source(frame, source, self.SOURCE_POSITIONS[source], source in captured,
                        state[4], source == state[1])
        self.target_row(frame, y=43, small=True)
        for index in range(self.game.level["bank"]):
            x = 25 + index * 7
            self.disc(frame, (x, 52), 2, EARTH, hollow=True)
            if index < len(state[2]): self.diamond(frame, (x, 52), 1, GREEN)
        if state[4] == 0:
            self.disc(frame, (58, 35), 3, AQUA, hollow=True)
        else:
            self.diamond(frame, (58, 35), 3, VIOLET, hollow=True)
            self.line(frame, (56, 37), (60, 33), INK)

    def atlas(self, frame, state):
        self.polygon(frame, [(5, 6), (13, 8), (22, 5), (31, 8), (41, 5),
                             (50, 8), (59, 5), (57, 30), (45, 33), (34, 30),
                             (23, 33), (10, 30)], ROSE)
        for x in (10, 21, 33, 46, 57):
            self.line(frame, (x, 7), (x - 2, 30), CORAL, dotted=True)
        self.target_row(frame, y=18)
        self.line(frame, (7, 34), (57, 34), EARTH, dotted=True)
        self.atlas_row(frame, state)

    def hud(self, frame, state):
        budget = state[6]
        for number in range(self.game.level["budget"]):
            row, column = divmod(number, 8)
            x, y = 4 + column * 7, 56 + row * 3
            if number < budget:
                self.diamond(frame, (x, y), 1, GREEN)
            else:
                self.line(frame, (x - 1, y - 1), (x + 1, y + 1), SLATE)
        if state[5] >= 1: self.disc(frame, (60, 57), 2, VIOLET, hollow=True)
        else:
            self.line(frame, (58, 55), (62, 59), RED); self.line(frame, (62, 55), (58, 59), RED)
        if state[5] >= 2: self.diamond(frame, (60, 62), 1, GOLD, hollow=True)
        else:
            self.line(frame, (58, 60), (62, 63), RED); self.line(frame, (62, 60), (58, 63), RED)

    def terminal(self, frame, state):
        if state[7] == 1:
            for radius in (5, 10, 15):
                self.polygon(frame, [(32, 26 - radius), (32 + radius, 26),
                                     (32, 26 + radius), (32 - radius, 26)], GOLD)
        elif state[7] == 2:
            self.line(frame, (9, 8), (55, 51), EARTH)
            self.line(frame, (55, 8), (9, 51), RED)
            for y in (15, 25, 35): self.line(frame, (7, y), (57, y + 3), SLATE, dotted=True)

    def scene(self, frame, state):
        self.paper(frame)
        if state[0] == 0: self.garden(frame, state)
        else: self.atlas(frame, state)
        self.hud(frame, state); self.terminal(frame, state)

    @staticmethod
    def interpolate(start, finish, amount):
        return (round(start[0] + (finish[0] - start[0]) * amount),
                round(start[1] + (finish[1] - start[1]) * amount))

    def animation(self, frame, before, after, kind, p, span):
        motion_span = max(1, span - 1)
        amount = min(1.0, p / motion_span)
        if kind == "navigate":
            self.scene(frame, before)
            positions = (self.SOURCE_POSITIONS if before[0] == 0
                         else self.row_positions(max(1, len(before[2]) + (before[3] != -1)), 43))
            start = positions[before[1]]; finish = positions[after[1]]
            point = self.interpolate(start, finish, amount)
            self.diamond(frame, point, 8 if before[0] == 0 else 7, INK, hollow=True)
        elif kind == "capture":
            self.scene(frame, after)
            source = self.SOURCE_POSITIONS[before[1]]
            finish = (32, 51)
            point = self.interpolate(source, finish, amount)
            self.card(frame, point, encode_card(before[1], flipped=before[4]),
                      selected=True, small=True)
            self.line(frame, source, point, VIOLET, dotted=True)
        elif kind == "reveal":
            self.scene(frame, before if p * 2 < motion_span else after)
            reach = round(27 * (1 - abs(2 * p - motion_span) / motion_span))
            for y in range(7, 35, 4): self.line(frame, (32 - reach, y), (32 + reach, y), ROSE)
        elif kind == "lens":
            self.scene(frame, before)
            developed = np.empty_like(frame)
            self.scene(developed, after)
            cut = round(64 * amount)
            if cut:
                frame[:, :cut] = developed[:, :cut]
            if 0 < cut < 64:
                self.line(frame, (cut, 5), (cut, 52),
                          AQUA if after[4] == 0 else VIOLET, dotted=True)
                self.disc(frame, (cut, 35), 3, INK, hollow=True)
        elif kind in ("lift", "drop"):
            self.scene(frame, after if amount >= .5 else before)
            frame[35:52, 4:60] = WHITE
            old_cards, new_cards = before[2], after[2]
            old_positions = self.row_positions(max(1, len(old_cards)), 43)
            new_positions = self.row_positions(max(1, len(new_cards)), 43)
            if kind == "lift":
                removed = before[1]
                for new_index, card in enumerate(new_cards):
                    old_index = new_index if new_index < removed else new_index + 1
                    point = self.interpolate(old_positions[old_index], new_positions[new_index], amount)
                    self.card(frame, point, card, selected=False)
                held = after[3]
                source = old_positions[removed]
                finish = (source[0], 35)
            else:
                inserted = after[1]
                for old_index, card in enumerate(old_cards):
                    new_index = old_index if old_index < inserted else old_index + 1
                    point = self.interpolate(old_positions[old_index], new_positions[new_index], amount)
                    self.card(frame, point, card, selected=False)
                held = before[3]
                finish = new_positions[inserted]
                source = (finish[0], 35)
            self.card(frame, self.interpolate(source, finish, amount), held, selected=True)
            link_count = len(new_cards) if kind == "lift" else len(old_cards) + 1
            positions = self.row_positions(max(1, link_count), 43)
            for active, color, link_y in (
                    (self.game.level["paired_flip"], VIOLET, 52),
                    (self.game.level["spread"], GREEN, 54)):
                if not active:
                    continue
                for start, finish_pos in zip(positions, positions[1:] + positions[:1]):
                    direction = 1 if finish_pos[0] > start[0] else -1
                    source_x = start[0] + direction * 4
                    target_x = finish_pos[0] - direction * 4
                    self.line(frame, (source_x, link_y), (target_x, link_y), color, dotted=True)
                    self.polygon(frame, [(target_x, link_y),
                                         (target_x - direction * 2, link_y - 1),
                                         (target_x - direction * 2, link_y + 1)], color)
        elif kind == "flip":
            self.scene(frame, before if p * 2 < motion_span else after)
            positions = self.row_positions(len(after[2]), 43)
            for index, (old, new) in enumerate(zip(before[2], after[2])):
                if old != new:
                    squeeze = max(1, round(6 * abs(2 * p - motion_span) / motion_span))
                    x, y = positions[index]
                    self.line(frame, (x - squeeze, y), (x + squeeze, y), VIOLET)
                    self.diamond(frame, (x, y), 2, GOLD, hollow=True)
        elif kind == "develop":
            self.scene(frame, before if p * 2 < motion_span else after)
            positions = self.row_positions(len(after[2]), 43)
            radius = 1 + round(5 * amount)
            for index, (old, new) in enumerate(zip(before[2], after[2])):
                if old != new:
                    self.disc(frame, positions[index], radius, GREEN, hollow=True)
                    for dx, dy in ((-radius, 0), (radius, 0), (0, -radius), (0, radius)):
                        self.diamond(frame, (positions[index][0] + dx, positions[index][1] + dy), 1, GOLD)
        elif kind in ("audit", "success", "loss"):
            self.scene(frame, before if p < motion_span else after)
            if kind == "audit":
                center = (60, 62 if before[5] == 2 else 57)
                reach = 1 + round(3 * amount)
                self.line(frame, (center[0] - reach, center[1] - reach),
                          (center[0] + reach, center[1] + reach), RED)
            elif kind == "success":
                for radius in range(3, 3 + round(17 * amount), 4):
                    self.diamond(frame, (32, 26), radius, GOLD, hollow=True)
            else:
                reach = round(23 * amount)
                self.line(frame, (32 - reach, 8), (32 + reach, 51), EARTH)
                self.line(frame, (32 + reach, 8), (32 - reach, 51), RED)
        else:
            self.scene(frame, before)
            center = self.SOURCE_POSITIONS[before[1]] if before[0] == 0 else (32, 43)
            radius = 2 + round(3 * (1 - abs(2 * p - motion_span) / motion_span))
            self.disc(frame, center, radius, CORAL, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game
        if not game.anim_kind:
            self.scene(frame, game.state)
            if game.intro_mark:
                self.polygon(frame, [(32, 2), (36, 5), (32, 8), (28, 5)], GOLD)
            return frame
        span = max(1, game.anim_total - 1)
        if game.anim_progress >= span:
            self.scene(frame, game.pending_state)
        else:
            self.animation(frame, game.anim_before, game.pending_state,
                           game.anim_kind, game.anim_progress, span)
        return frame


class G513(ARCBaseGame):
    def __init__(self):
        self.display = G513A(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.state[6]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q044", levels, Camera(0, 0, 64, 64, PEARL, PEARL, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.state[6]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_terminal = None
        self.intro_mark = True

    def begin(self, kind, after, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = 7; self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = after; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.budget_left = self.state[6]; self.anim_kind = None
        self.pending_state = None; self.pending_terminal = None
        if terminal == "win": self.next_level()
        elif terminal == "loss": self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self.finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action(); return
        self.intro_mark = False
        before = self.state; after = transition(self.level, before, action)
        terminal = "win" if after[7] == 1 else "loss" if after[7] == 2 else None
        if after == before: kind = "blocked"
        elif action in (1, 2): kind = "navigate"
        elif action == 3 and before[0] == 0: kind = "capture"
        elif action == 3 and before[3] == -1: kind = "lift"
        elif action == 3: kind = "drop"
        elif action == 4 and before[0] == 0: kind = "reveal" if after[0] == 1 else "audit"
        elif action == 4: kind = "flip"
        elif action == 5 and before[0] == 0: kind = "lens"
        elif action == 5: kind = "develop"
        elif terminal == "win": kind = "success"
        elif terminal == "loss": kind = "loss"
        else: kind = "audit"
        self.begin(kind, after, terminal)
