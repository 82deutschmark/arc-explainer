# ARC-AGI-3 candidate task g500.

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PEARL, MIST, SLATE, SMOKE, CHARCOAL, VELVET = 0, 1, 2, 3, 4, 5
MAGENTA, PINK, RED, BLUE, ICE, AMBER = 6, 7, 8, 9, 10, 11
GOLD, OXBLOOD, MOSS, VIOLET = 12, 13, 14, 15

SHY, BOLD = 0, 1
ACTIVE, WIN, LOSS = 0, 2, 3
TERMINAL_INDEX = 9
MAX_SHUTTERS = 2
SHUTTER_MASK = (1 << MAX_SHUTTERS) - 1

EYE_POSITIONS = (
    (9, 9), (20, 7), (32, 6), (44, 7), (55, 9),
    (9, 18), (20, 16), (32, 15), (44, 16), (55, 18),
)

LEFT_LOOP = ((13, 29), (20, 27), (24, 33), (22, 41),
             (16, 46), (9, 41), (8, 34))
CENTER_LOOP = ((32, 27), (39, 31), (42, 38), (38, 45),
               (31, 49), (24, 44), (22, 35))
RIGHT_LOOP = ((50, 29), (56, 34), (55, 42), (49, 47),
              (43, 43), (42, 35))


def puppet(kind, path, start, target, *, flips=()):
    return {
        "kind": int(kind),
        "path": tuple(tuple(point) for point in path),
        "start": int(start),
        "target": int(target),
        "flips": frozenset(int(index) for index in flips),
    }


def theatre(name, orbs, *, eye=2, target_eye=2, veils=(), shutters=(),
            start_shutters=0, target_shutters=0, required_toggles=0,
            required_flips=0, required_rewind=False, history_start=(),
            budget=12, witness=()):
    return {
        "name": name,
        "orbs": tuple(orbs),
        "eye": int(eye),
        "target_eye": int(target_eye),
        "veils": tuple(tuple(veil) for veil in veils),
        "shutters": tuple(tuple(shutter) for shutter in shutters),
        "start_shutters": int(start_shutters),
        "target_shutters": int(target_shutters),
        "required_toggles": int(required_toggles),
        "required_flips": int(required_flips),
        "required_rewind": bool(required_rewind),
        "history_start": tuple(history_start),
        "budget": int(budget),
        "witness": tuple(witness),
    }


LEVELS = [
    theatre(
        "Moth in the Wing",
        (puppet(SHY, LEFT_LOOP, 0, 2),),
        eye=4, target_eye=4, veils=((30, 19, 51, 3),), budget=5,
        witness=(5, 5),
    ),
    theatre(
        "Lantern Crossing",
        (puppet(BOLD, RIGHT_LOOP, 0, 5),),
        eye=0, target_eye=0, veils=((31, 18, 52, 2),), budget=10,
        witness=(2, 2, 5, 5, 5, 5, 5, 1, 1),
    ),
    theatre(
        "Opposite Cues",
        (puppet(SHY, LEFT_LOOP, 0, 5),
         puppet(BOLD, RIGHT_LOOP, 0, 5)),
        eye=2, target_eye=2, veils=((31, 18, 52, 3),), budget=10,
        witness=(2, 2, 5, 1, 5, 5, 5, 5, 1),
    ),
    theatre(
        "Velvet Turn",
        (puppet(SHY, CENTER_LOOP, 0, 5),
         puppet(BOLD, RIGHT_LOOP, 0, 5)),
        eye=1, target_eye=1, veils=((17, 21, 50, 2),),
        shutters=((36, 21, 52, 5),), start_shutters=1,
        target_shutters=0, required_toggles=1, budget=14,
        witness=(1, 3, 5, 5, 5, (6, 0), 5, 3, 5, 2, 5, 5, 5),
    ),
    theatre(
        "Twin Curtains",
        (puppet(SHY, LEFT_LOOP, 0, 5),
         puppet(BOLD, CENTER_LOOP, 0, 6)),
        eye=3, target_eye=3,
        shutters=((25, 20, 51, 5), (42, 20, 51, 5)),
        start_shutters=3, target_shutters=0, required_toggles=3,
        budget=9,
        witness=(5, (6, 1), 5, 5, 5, 5, (6, 0), 5),
    ),
    theatre(
        "Changed Temperament",
        (puppet(SHY, CENTER_LOOP, 1, 5, flips=(2,)),),
        eye=4, target_eye=4, veils=((36, 18, 51, 3),),
        required_flips=1, required_rewind=True,
        history_start=(((0,), (SHY,), 0),), budget=15,
        witness=(4, 1, 3, 5, 5, 2, 5, 5, 1, 1, 3, 5, 2, 2),
    ),
    theatre(
        "Three-Puppet Matinee",
        (puppet(SHY, LEFT_LOOP[:4], 0, 3),
         puppet(BOLD, CENTER_LOOP[:4], 0, 3),
         puppet(SHY, RIGHT_LOOP[:4], 0, 3, flips=(2,))),
        eye=2, target_eye=2, veils=((31, 20, 53, 2),),
        shutters=((19, 21, 50, 5),), start_shutters=1,
        target_shutters=0, required_toggles=1, required_flips=4,
        budget=13,
        witness=(2, 3, 5, 1, 5, 1, 5, (6, 0), 5, 2, 3, 5),
    ),
    theatre(
        "Velvet Eclipse Theatre",
        (puppet(BOLD, LEFT_LOOP[:4], 1, 3, flips=(1,)),
         puppet(BOLD, CENTER_LOOP[:4], 1, 3),
         puppet(SHY, RIGHT_LOOP[:4], 1, 3, flips=(2,))),
        eye=0, target_eye=0,
        shutters=((25, 20, 52, 5), (42, 20, 52, 5)),
        start_shutters=3, target_shutters=1, required_toggles=3,
        required_flips=5, required_rewind=True,
        history_start=(((0, 0, 0), (SHY, BOLD, SHY), 0),),
        budget=14,
        witness=(4, 2, 2, 3, 5, 1, 1, 3, (6, 0), 5, (6, 1), 5,
                 (6, 0)),
    ),
]


def _bresenham(a, b):
    x0, y0 = a; x1, y1 = b
    dx = abs(x1 - x0); sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0); sy = 1 if y0 < y1 else -1
    error = dx + dy
    while True:
        yield x0, y0
        if x0 == x1 and y0 == y1:
            return
        double = 2 * error
        if double >= dy:
            error += dy; x0 += sx
        if double <= dx:
            error += dx; y0 += sy


def _veil_cells(veil):
    x, y0, y1, width = veil
    cells = set()
    for y in range(y0, y1 + 1):
        sway = round(math.sin((y - y0) * math.pi / max(1, y1 - y0)) * 2)
        for dx in range(-(width // 2), width - width // 2):
            cells.add((x + sway + dx, y))
    return cells


def opaque_cells(level, shutters):
    cells = set()
    for veil in level["veils"]:
        cells.update(_veil_cells(veil))
    for index, shutter in enumerate(level["shutters"]):
        if shutters & (1 << index):
            cells.update(_veil_cells(shutter))
    return cells


def visible(level, state, orb_index):
    point = level["orbs"][orb_index]["path"][state[0][orb_index]]
    eye = EYE_POSITIONS[state[2]]
    opaque = opaque_cells(level, state[3])
    return not any(cell in opaque for cell in list(_bresenham(eye, point))[1:-1])


def affected_indices(level, state):
    affected = []
    for index, kind in enumerate(state[1]):
        is_visible = visible(level, state, index)
        if (kind == BOLD and is_visible) or (kind == SHY and not is_visible):
            affected.append(index)
    return tuple(affected)


def toggle_evidence(value):
    return (value & SHUTTER_MASK,
            (value >> MAX_SHUTTERS) & SHUTTER_MASK,
            (value >> (2 * MAX_SHUTTERS)) & SHUTTER_MASK)


def pack_toggle_evidence(completed, pending, baseline):
    return (completed | (pending << MAX_SHUTTERS)
            | (baseline << (2 * MAX_SHUTTERS)))


def target_kind(orb):
    kind = orb["kind"]
    position = orb["start"]
    while position != orb["target"]:
        position = (position + 1) % len(orb["path"])
        if position in orb["flips"]:
            kind = BOLD if kind == SHY else SHY
    return kind


def start_state(level):
    positions = tuple(orb["start"] for orb in level["orbs"])
    kinds = tuple(orb["kind"] for orb in level["orbs"])
    history = level["history_start"]
    return (positions, kinds, level["eye"], level["start_shutters"],
            0, 0, history, 0, 2, ACTIVE)


def ready(level, state):
    completed_toggles, _pending, _baseline = toggle_evidence(state[4])
    return (
        state[0] == tuple(orb["target"] for orb in level["orbs"])
        and state[2] == level["target_eye"]
        and state[3] == level["target_shutters"]
        and completed_toggles & level["required_toggles"] == level["required_toggles"]
        and state[5] & level["required_flips"] == level["required_flips"]
        and (not level["required_rewind"] or state[7])
    )


def _finish(level, state):
    if ready(level, state):
        return state[:TERMINAL_INDEX] + (WIN,)
    return state


def parse_action(action):
    if isinstance(action, (tuple, list)):
        return int(action[0]), int(action[1]) if len(action) > 1 else None
    return int(action), None


def transition(level, state, action):
    if state[TERMINAL_INDEX]:
        return state
    aid, target = parse_action(action)
    if aid not in (1, 2, 3, 4, 5, 6):
        return state
    positions, kinds, eye, shutters, toggled, flipped, history, rewound, seals, _ = state
    column = eye % 5; balcony = eye // 5

    if level["required_rewind"] and not rewound and aid != 4:
        return state

    if aid == 1:
        if column == 0:
            return state
        return _finish(level, (positions, kinds, eye - 1, shutters, toggled,
                               flipped, history, rewound, seals, ACTIVE))
    if aid == 2:
        if column == 4:
            return state
        return _finish(level, (positions, kinds, eye + 1, shutters, toggled,
                               flipped, history, rewound, seals, ACTIVE))
    if aid == 3:
        return _finish(level, (positions, kinds, column + (1 - balcony) * 5,
                               shutters, toggled, flipped, history, rewound,
                               seals, ACTIVE))
    if aid == 4:
        if not history:
            seals -= 1
            return (positions, kinds, eye, shutters, toggled, flipped, history,
                    rewound, seals, LOSS if seals <= 0 else ACTIVE)
        old_positions, old_kinds, old_flipped = history[0]
        return _finish(level, (tuple(old_positions), tuple(old_kinds), eye,
                               shutters, toggled, old_flipped, (), 1, seals,
                               ACTIVE))
    if aid == 5:
        next_positions = list(positions); next_kinds = list(kinds)
        next_flipped = flipped
        for index in affected_indices(level, state):
            orb = level["orbs"][index]
            next_positions[index] = (positions[index] + 1) % len(orb["path"])
            if next_positions[index] in orb["flips"]:
                next_kinds[index] = BOLD if kinds[index] == SHY else SHY
                next_flipped |= 1 << index
        snapshot = () if level["required_rewind"] and rewound else (
            (positions, kinds, flipped),)
        completed, pending, baseline = toggle_evidence(toggled)
        credited = 0
        for index in range(len(level["shutters"])):
            bit = 1 << index
            if not pending & bit:
                continue
            counterfactual_shutters = ((shutters & ~bit) | (baseline & bit))
            counterfactual = (positions, kinds, eye, counterfactual_shutters,
                              toggled, flipped, history, rewound, seals, ACTIVE)
            if affected_indices(level, state) != affected_indices(
                    level, counterfactual):
                credited |= bit
        completed |= credited
        pending &= ~credited
        baseline &= ~credited
        next_toggled = pack_toggle_evidence(completed, pending, baseline)
        return _finish(level, (tuple(next_positions), tuple(next_kinds), eye,
                               shutters, next_toggled, next_flipped, snapshot,
                               rewound, seals, ACTIVE))
    if target is None or not 0 <= target < len(level["shutters"]):
        return state
    bit = 1 << target
    completed, pending, baseline = toggle_evidence(toggled)
    next_shutters = shutters ^ bit
    if not completed & bit:
        if pending & bit:
            returned = bool(next_shutters & bit) == bool(baseline & bit)
            if returned:
                pending &= ~bit
                baseline &= ~bit
        else:
            pending |= bit
            baseline = (baseline | bit) if shutters & bit else (baseline & ~bit)
    next_toggled = pack_toggle_evidence(completed, pending, baseline)
    return _finish(level, (positions, kinds, eye, shutters ^ bit,
                           next_toggled, flipped,
                           history, rewound, seals, ACTIVE))


def action_cost(state, after):
    if after == state:
        return 0
    if after[8] < state[8]:
        return 0
    return 1


def solved(level, state):
    return state[TERMINAL_INDEX] == WIN and ready(level, state)


def action_tokens(level):
    return (1, 2, 3, 4, 5) + tuple((6, index)
                                    for index in range(len(level["shutters"])))


def encoded_witness(level):
    encoded = []
    for action in level["witness"]:
        aid, target = parse_action(action)
        if aid == 6 and target is not None:
            x, y0, y1, _width = level["shutters"][target]
            encoded.append((6, x, (y0 + y1) // 2))
        else:
            encoded.append((aid,))
    return tuple(encoded)


class G500A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, start, end, color, dotted=False, width=1):
        points = list(_bresenham(start, end))
        for index, (x, y) in enumerate(points):
            if dotted and index % 4 in (1, 2):
                continue
            for dy in range(-(width // 2), width - width // 2):
                for dx in range(-(width // 2), width - width // 2):
                    if 0 <= x + dx < 64 and 0 <= y + dy < 64:
                        frame[y + dy, x + dx] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center; inner = max(0, radius - 1) ** 2
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
                    frame[y, x] = color

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
    def crescent(cls, frame, center, radius, color, cut=VELVET, reverse=False):
        cls.disc(frame, center, radius, color)
        shift = -2 if reverse else 2
        cls.disc(frame, (center[0] + shift, center[1] - 1),
                 max(1, radius - 1), cut)

    @classmethod
    def almond(cls, frame, center, radius, color, pupil=CHARCOAL):
        x, y = center
        for dy in range(-radius // 2, radius // 2 + 1):
            reach = radius - abs(dy) * 2
            if reach >= 0:
                frame[y + dy, x - reach:x + reach + 1] = color
        cls.disc(frame, center, 2, pupil)
        frame[y, x] = PEARL

    @classmethod
    def sun(cls, frame, center, radius, color, hollow=False):
        cls.disc(frame, center, radius - 1, color, hollow=hollow)
        x, y = center
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            start = (x + round((radius - 1) * math.cos(rad)),
                     y + round((radius - 1) * math.sin(rad)))
            end = (x + round((radius + 2) * math.cos(rad)),
                   y + round((radius + 2) * math.sin(rad)))
            cls.line(frame, start, end, color)

    @classmethod
    def puppet(cls, frame, center, kind, color=None, hollow=False):
        color = color if color is not None else (MAGENTA if kind == SHY else AMBER)
        if kind == SHY:
            cls.crescent(frame, center, 5, color, VELVET, reverse=True)
            cls.diamond(frame, (center[0] + 2, center[1] + 3), 2, PINK,
                        hollow=hollow)
            cls.line(frame, (center[0] - 4, center[1] - 1),
                     (center[0] - 7, center[1] - 3), color)
        else:
            cls.sun(frame, center, 4, color, hollow=hollow)
            cls.disc(frame, center, 1, OXBLOOD if not hollow else CHARCOAL)

    def background(self, frame):
        frame[:, :] = VELVET
        for x in range(0, 64, 5):
            color = CHARCOAL if (x // 5) % 2 else SMOKE
            self.line(frame, (x, 0), (x + 2, 63), color, dotted=True)
        self.line(frame, (2, 22), (8, 8), OXBLOOD, width=2)
        self.line(frame, (8, 8), (32, 2), OXBLOOD, width=2)
        self.line(frame, (32, 2), (56, 8), OXBLOOD, width=2)
        self.line(frame, (56, 8), (62, 22), OXBLOOD, width=2)
        for x in range(8, 57, 8):
            self.disc(frame, (x, 8 - abs(32 - x) // 8), 1, GOLD)
        self.line(frame, (4, 56), (60, 56), SLATE, dotted=True)
        for x in range(6, 61, 9):
            self.crescent(frame, (x, 60), 2, CHARCOAL, VELVET,
                          reverse=(x // 9) % 2 == 0)

    def curve(self, frame, points, color):
        for index, (start, end) in enumerate(zip(points, points[1:] + points[:1])):
            self.line(frame, start, end, color, dotted=True)
            midpoint = ((start[0] + end[0]) // 2, (start[1] + end[1]) // 2)
            self.disc(frame, midpoint, 1, SLATE, hollow=index % 2 == 0)

    def veil(self, frame, spec, closed=True, selected=False):
        x, y0, y1, width = spec
        color = OXBLOOD if closed else SLATE
        if not closed:
            self.line(frame, (x - 5, y0), (x + 5, y0 + 5), color, width=2)
            self.line(frame, (x + 5, y0 + 5), (x - 4, y0 + 9), color,
                      dotted=True)
            return
        cells = _veil_cells(spec)
        for px, py in cells:
            if 0 <= px < 64 and 0 <= py < 64:
                frame[py, px] = color
        for y in range(y0 + 2, y1, 5):
            sway = round(math.sin((y - y0) * math.pi / max(1, y1 - y0)) * 2)
            self.line(frame, (x - width // 2 + sway, y),
                      (x + width // 2 + sway, y + 2),
                      GOLD if selected else SMOKE, dotted=True)
        self.crescent(frame, (x, y0), max(2, width // 2), color, VELVET)

    def shutter_mark(self, frame, state, index, spec):
        completed, pending, _baseline = toggle_evidence(state[4])
        bit = 1 << index
        x, y0, _y1, _width = spec
        center = (x, y0 - 4)
        if completed & bit:
            self.diamond(frame, center, 3, PEARL, hollow=True)
            self.line(frame, (x - 2, y0 - 4), (x + 2, y0 - 4), PEARL)
            self.line(frame, (x, y0 - 6), (x, y0 - 2), PEARL)
        elif pending & bit:
            self.disc(frame, center, 3, PEARL, hollow=True)
            self.line(frame, (x - 2, y0 - 1), (x + 2, y0 - 1), MIST,
                      dotted=True)

    def sight_and_preview(self, frame, state):
        g = self.game; eye = EYE_POSITIONS[state[2]]
        affected = set(affected_indices(g.level, state))
        for index, orb in enumerate(g.level["orbs"]):
            point = orb["path"][state[0][index]]
            if visible(g.level, state, index):
                self.line(frame, eye, point, MIST, dotted=True)
            if index in affected:
                self.disc(frame, point, 7, PINK if state[1][index] == SHY else GOLD,
                          hollow=True)
                self.line(frame, (point[0] - 5, point[1] + 7),
                          (point[0] + 5, point[1] + 7), PEARL, dotted=True)

    def stable_stage(self, frame, state):
        g = self.game
        for orb in g.level["orbs"]:
            self.curve(frame, orb["path"], SLATE)
            target = orb["path"][orb["target"]]
            self.puppet(frame, target, target_kind(orb), color=SMOKE,
                        hollow=True)
        for veil in g.level["veils"]:
            self.veil(frame, veil, True)
        for index, shutter in enumerate(g.level["shutters"]):
            self.veil(frame, shutter, bool(state[3] & (1 << index)))
            self.shutter_mark(frame, state, index, shutter)
        self.sight_and_preview(frame, state)
        for index, orb in enumerate(g.level["orbs"]):
            point = orb["path"][state[0][index]]
            self.puppet(frame, point, state[1][index])
        self.almond(frame, EYE_POSITIONS[state[2]], 5, PEARL, VIOLET)

    def hud(self, frame, state):
        for index in range(self.game.budget_max):
            group = index // 5; offset = index % 5
            x = 4 + group * 11 + offset * 2
            y = 58
            live = index < self.game.budget_left
            self.disc(frame, (x, y), 1, AMBER if live else SLATE,
                      hollow=not live)
            if offset == 4:
                self.line(frame, (x + 1, y - 2), (x + 1, y + 2), OXBLOOD)
        for index, x in enumerate((55, 61)):
            live = index < state[8]
            self.crescent(frame, (x, 24), 2, MAGENTA if live else SLATE,
                          VELVET, reverse=index == 1)
        if self.game.level["required_rewind"] and not state[7] and state[6]:
            old_positions, old_kinds, _old_flipped = state[6][0]
            for index, orb in enumerate(self.game.level["orbs"]):
                self.puppet(frame, orb["path"][old_positions[index]],
                            old_kinds[index], color=MIST, hollow=True)
            self.crescent(frame, (54, 29), 4, PINK, VELVET, reverse=True)
            self.line(frame, (58, 28), (60, 31), MIST, dotted=True)
            for index in range(4):
                self.diamond(frame, (49 + index * 3, 35), 1, PEARL,
                             hollow=bool(index % 2))
        if state[7]:
            self.line(frame, (51, 29), (57, 27), MIST, dotted=True)
            self.line(frame, (51, 27), (57, 31), PINK, dotted=True)

    def animated_state(self):
        g = self.game
        if g.anim_kind != "pulse" or not g.anim_trace:
            return g.state
        span = max(1, g.anim_total - 1)
        completed = len(g.anim_trace) * g.anim_progress // max(1, span + 1)
        if not completed:
            return g.state
        positions = list(g.state[0]); kinds = list(g.state[1])
        for index in g.anim_trace[:completed]:
            positions[index] = g.pending_state[0][index]
            kinds[index] = g.pending_state[1][index]
        return (tuple(positions), tuple(kinds)) + g.state[2:]

    def animation(self, frame, render_state):
        g = self.game
        if not g.anim_kind:
            if g.terminal_hold == "loss":
                self.line(frame, (8, 24), (56, 53), RED, width=2)
                self.line(frame, (56, 24), (8, 53), RED, width=2)
            return
        before, after = g.state, g.pending_state
        p = g.anim_progress; span = max(1, g.anim_total - 1)
        wave = min(p, span - p)
        if g.anim_kind == "eye":
            start = EYE_POSITIONS[before[2]]; end = EYE_POSITIONS[after[2]]
            x = start[0] + (end[0] - start[0]) * p // span
            y = start[1] + (end[1] - start[1]) * p // span
            self.almond(frame, (x, y + wave // 2), 5, PEARL, VIOLET)
            for index, orb in enumerate(g.level["orbs"]):
                point = orb["path"][before[0][index]]
                self.line(frame, (x, y), point, MIST, dotted=True)
        elif g.anim_kind == "shutter":
            changed = before[3] ^ after[3]
            index = max(0, changed.bit_length() - 1)
            x, y0, y1, width = g.level["shutters"][index]
            bow = 5 * wave // max(1, span // 2)
            self.line(frame, (x - bow, y0), (x + bow, y1), GOLD, width=2)
            self.line(frame, (x + bow, y0), (x - bow, y1), OXBLOOD,
                      dotted=True)
        elif g.anim_kind == "pulse":
            for index in g.anim_trace:
                orb = g.level["orbs"][index]
                old = orb["path"][before[0][index]]
                new = orb["path"][after[0][index]]
                x = old[0] + (new[0] - old[0]) * p // span
                y = old[1] + (new[1] - old[1]) * p // span - wave
                kind = before[1][index] if p < span // 2 else after[1][index]
                self.puppet(frame, (x, y), kind)
                self.line(frame, old, (x, y), MIST, dotted=True)
                if before[1][index] != after[1][index]:
                    self.disc(frame, (x, y), 7 + wave, GOLD, hollow=True)
            self.disc(frame, EYE_POSITIONS[before[2]], 7 + p * 3,
                      PINK, hollow=True)
        elif g.anim_kind == "rewind":
            for index, orb in enumerate(g.level["orbs"]):
                old = orb["path"][before[0][index]]
                new = orb["path"][after[0][index]]
                x = old[0] + (new[0] - old[0]) * p // span
                y = old[1] + (new[1] - old[1]) * p // span + wave
                self.puppet(frame, (x, y), after[1][index], color=MIST)
                self.crescent(frame, (x - 4, y), 3, PINK, VELVET, reverse=True)
        elif g.anim_kind == "reject":
            self.crescent(frame, (55, 24), 3 + wave, RED, VELVET)
            self.line(frame, (24 + wave, 19), (40 - wave, 24), OXBLOOD,
                      width=2)
        elif g.anim_kind == "success":
            self.line(frame, (5, 54), (5 + 54 * p // span, 54), GOLD, width=2)
            for index, orb in enumerate(g.level["orbs"]):
                point = orb["path"][after[0][index]]
                self.disc(frame, point, 6 + wave, MOSS, hollow=True)
        elif g.anim_kind == "loss":
            inset = 26 * p // span
            self.line(frame, (5 + inset, 21), (5 + inset, 54), RED, width=2)
            self.line(frame, (59 - inset, 21), (59 - inset, 54), RED, width=2)
        else:
            eye = EYE_POSITIONS[before[2]]
            offset = (-2, 2, -1, 1, 0)[min(p, 4)]
            self.almond(frame, (eye[0] + offset, eye[1]), 5, PINK, VIOLET)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        render_state = self.animated_state()
        self.stable_stage(frame, render_state)
        self.hud(frame, render_state)
        self.animation(frame, render_state)
        return frame


class G500(ARCBaseGame):
    def __init__(self):
        self.display = G500A(self)
        self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_trace = (); self.pending_state = self.pending_budget = None
        self.pending_terminal = None; self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level),
                        name=level["name"]) for level in LEVELS]
        super().__init__("g500", levels,
                         Camera(0, 0, 64, 64, VELVET, VELVET, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_trace = (); self.pending_state = self.pending_budget = None
        self.pending_terminal = None; self.terminal_hold = None

    def snap_shutter(self, x, y):
        for index, (sx, y0, y1, width) in enumerate(self.level["shutters"]):
            if sx - width - 4 <= x <= sx + width + 4 and y0 - 4 <= y <= y1 + 4:
                return index
        return None

    def begin(self, kind, frames, after, budget, trace=(), terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames
        self.anim_progress = 0; self.pending_state = after
        self.pending_budget = budget; self.anim_trace = tuple(trace)
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.anim_trace = ()
        self.pending_state = self.pending_budget = self.pending_terminal = None
        if terminal == "win":
            self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss":
            self.terminal_hold = "loss"; self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1
            self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0:
                self.finish()
            return
        aid = self.action.id.value
        if aid == 0:
            self.complete_action(); return
        token = aid
        if aid == 6:
            target = self.snap_shutter(int(self.action.data.get("x", -99)),
                                       int(self.action.data.get("y", -99)))
            token = aid if target is None else (aid, target)
        before = self.state; after = transition(self.level, before, token)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left); return
        cost = action_cost(before, after); budget = self.budget_left - cost
        won = after[TERMINAL_INDEX] == WIN
        lost = after[TERMINAL_INDEX] == LOSS or (budget <= 0 and not won)
        if lost and after[TERMINAL_INDEX] != LOSS:
            after = after[:TERMINAL_INDEX] + (LOSS,)
        if won:
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 7, "loss"
        elif after[8] < before[8]:
            kind, frames, terminal = "reject", 6, None
        elif aid in (1, 2, 3):
            kind, frames, terminal = "eye", 6, None
        elif aid == 4:
            kind, frames, terminal = "rewind", 7, None
        elif aid == 5:
            kind, frames, terminal = "pulse", 7, None
        else:
            kind, frames, terminal = "shutter", 6, None
        trace = affected_indices(self.level, before) if aid == 5 else ()
        self.begin(kind, frames, after, budget, trace=trace, terminal=terminal)
