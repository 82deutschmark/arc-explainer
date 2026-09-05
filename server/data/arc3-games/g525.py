# ARC-AGI-3 candidate task g525.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, STEEL, IRON, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, ICE, AMBER, CORAL, EARTH, GREEN, VIOLET = range(6, 16)

WORLD, ROOM = 8, 3
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}


def _path(*points):
    result = [points[0]]
    for end in points[1:]:
        x, y = result[-1]
        ex, ey = end
        while (x, y) != (ex, ey):
            x += (ex > x) - (ex < x)
            y += (ey > y) - (ey < y)
            if (x, y) not in result:
                result.append((x, y))
    return tuple(result)


LEVELS = [
    {"name": "Inside the Hull", "start": ((2, 2), (0, 1), 0),
     "target": ((2, 2), (2, 1), 0), "carrier": False, "budget": 3},
    {"name": "Throw the Clutch", "start": ((0, 0), (0, 0), 0),
     "target": ((5, 5), (2, 2), 0), "carrier": True, "budget": 16},
    {"name": "Internal Bulkheads", "start": ((0, 1), (0, 0), 0),
     "target": ((4, 4), (2, 2), 0), "carrier": True,
     "inside_walls": ((1, 0), (1, 1)), "budget": 13},
    {"name": "Gantry Rail", "start": ((0, 0), (2, 0), 0),
     "target": ((5, 5), (0, 2), 0), "carrier": True,
     "rail": _path((0, 0), (2, 0), (2, 2), (4, 2), (4, 4), (5, 4), (5, 5)),
     "budget": 16},
    {"name": "One-Way Shutter", "start": ((0, 4), (2, 2), 0),
     "target": ((5, 1), (0, 0), 0), "carrier": True,
     "rail": tuple(dict.fromkeys(_path((0, 4), (5, 4), (5, 1))
                                   + _path((3, 4), (3, 1), (5, 1)))),
     "shutters": (((5, 3), (5, 2)),), "budget": 14},
    {"name": "Reverse Induction", "start": ((5, 5), (0, 2), 0),
     "target": ((0, 0), (2, 0), 1), "carrier": True,
     "inside_walls": ((0, 1),), "flip": (1, 1), "budget": 16},
    {"name": "Cold Junction", "start": ((4, 5), (0, 0), 0),
     "target": ((5, 0), (2, 2), 1), "carrier": True,
     "inside_walls": ((1, 0),), "flip": (1, 1),
     "rail": tuple(dict.fromkeys(_path((4, 5), (4, 1), (5, 1), (5, 0))
                                   + _path((4, 3), (2, 3), (2, 1), (4, 1)))),
     "shutters": (((4, 3), (4, 2)),), "budget": 16},
    {"name": "Blacksite Carriage", "start": ((5, 5), (0, 2), 0),
     "target": ((0, 0), (2, 0), 1), "carrier": True,
     "inside_walls": ((0, 1), (2, 1)), "flip": (1, 1),
     "rail": tuple(dict.fromkeys(_path((5, 5), (3, 5), (3, 3), (5, 3), (5, 1),
                                           (2, 1), (2, 3), (0, 3), (0, 0)))),
     "shutters": (((5, 3), (5, 2)), ((2, 2), (2, 1))), "budget": 16},
]


def start_state(level):
    origin, local, polarity = level["start"]
    return origin[0], origin[1], local[0], local[1], 0, polarity, 2, level["budget"], 0


def world_position(state):
    return state[0] + state[2], state[1] + state[3]


def ready(level, state):
    origin, local, polarity = level["target"]
    return (state[8] == 0 and (state[0], state[1]) == tuple(origin)
            and (state[2], state[3]) == tuple(local) and state[5] == polarity)


def solved(level, state):
    return ready(level, state)


def action_cost(before, after):
    return max(0, before[7] - after[7])


def _carrier_allowed(level, origin):
    x, y = origin
    if not (0 <= x <= WORLD - ROOM and 0 <= y <= WORLD - ROOM):
        return False
    return not level.get("rail") or origin in level["rail"]


def _consume(level, values):
    values[7] = max(0, values[7] - 1)
    candidate = tuple(values)
    if values[7] == 0 and not ready(level, candidate):
        values[8] = 2
    return tuple(values)


def transition(level, state, action):
    if state[8] or action not in (1, 2, 3, 4, 5, 6):
        return state
    values = list(state)

    if action == 6:
        if ready(level, state):
            values[8] = 1
            return tuple(values)
        values[6] -= 1
        values[7] = max(0, values[7] - 1)
        if values[6] <= 0 or values[7] == 0:
            values[8] = 2
        return tuple(values)

    if state[7] <= 0:
        values[8] = 2
        return tuple(values)

    if action == 5:
        if not level.get("carrier"):
            return state
        values[4] = 1 - state[4]
        return _consume(level, values)

    dx, dy = DIRS[action]
    if state[4] == 0:
        local = state[2] + dx, state[3] + dy
        if (0 <= local[0] < ROOM and 0 <= local[1] < ROOM
                and local not in level.get("inside_walls", ())):
            values[2], values[3] = local
            if level.get("flip") == local and local != (state[2], state[3]):
                values[5] = 1 - state[5]
    else:
        if state[5]:
            dx, dy = -dx, -dy
        origin = state[0] + dx, state[1] + dy
        edge = ((state[0], state[1]), origin)
        if (_carrier_allowed(level, origin)
                and edge not in level.get("shutters", ())):
            values[0], values[1] = origin
    return _consume(level, values)


def transition_kind(level, before, after, action):
    if after[8] == 1:
        return "success"
    if after[8] == 2:
        return "loss"
    if action == 6:
        return "reject"
    if action == 5 and before == after:
        return "blocked"
    if action == 5:
        return "clutch"
    moved_local = before[2:4] != after[2:4]
    moved_room = before[:2] != after[:2]
    if moved_local:
        return "induction" if before[5] != after[5] else "walker"
    if moved_room:
        return "carrier"
    return "blocked"


class G525A(RenderableUserDisplay):
    OX, OY, CELL = 8, 6, 6

    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, start, end, color, dotted=False):
        x0, y0 = start; x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            x = round(x0 + (x1 - x0) * index / steps)
            y = round(y0 + (y1 - y0) * index / steps)
            if 0 <= x < 64 and 0 <= y < 64:
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
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius * radius and (not hollow or distance >= (radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def polygon(frame, points, color):
        for start, end in zip(points, points[1:] + points[:1]):
            G525A.line(frame, start, end, color)

    @classmethod
    def cell_center(cls, cell):
        return cls.OX + cell[0] * cls.CELL + 3, cls.OY + cell[1] * cls.CELL + 3

    @classmethod
    def chamber_bounds(cls, origin):
        x = cls.OX + origin[0] * cls.CELL
        y = cls.OY + origin[1] * cls.CELL
        return x, y, x + ROOM * cls.CELL - 1, y + ROOM * cls.CELL - 1

    @staticmethod
    def interpolate(start, end, amount):
        return (round(start[0] + (end[0] - start[0]) * amount),
                round(start[1] + (end[1] - start[1]) * amount))

    def background(self, frame):
        frame[:, :] = INK
        for y in (3, 55):
            self.line(frame, (3, y), (60, y), STEEL, dotted=True)
        for x, y in ((4, 9), (59, 12), (4, 47), (59, 50), (31, 3)):
            self.diamond(frame, (x, y), 1, STEEL)
        for x in range(self.OX + 3, self.OX + WORLD * self.CELL, self.CELL):
            for y in range(self.OY + 3, self.OY + WORLD * self.CELL, self.CELL):
                frame[y, x] = STEEL

    def rail(self, frame, level):
        rail = level.get("rail", ())
        if not rail:
            return
        centers = {origin: self.cell_center((origin[0] + 1, origin[1] + 1)) for origin in rail}
        for origin, center in centers.items():
            for dx, dy in ((1, 0), (0, 1)):
                other = (origin[0] + dx, origin[1] + dy)
                if other in centers:
                    self.line(frame, center, centers[other], STEEL, dotted=True)
            self.diamond(frame, center, 1, ASH, hollow=True)
        for source, target in level.get("shutters", ()):
            start, end = centers[source], centers[target]
            center = ((start[0] + end[0]) // 2, (start[1] + end[1]) // 2)
            dx = (end[0] > start[0]) - (end[0] < start[0])
            dy = (end[1] > start[1]) - (end[1] < start[1])
            normal = (-dy, dx)
            tip = (center[0] + dx * 2, center[1] + dy * 2)
            points = [tip, (center[0] - dx * 2 + normal[0] * 2,
                            center[1] - dy * 2 + normal[1] * 2),
                      (center[0] - dx * 2 - normal[0] * 2,
                       center[1] - dy * 2 - normal[1] * 2)]
            self.polygon(frame, points, AMBER)
            self.line(frame, (tip[0] - normal[0] * 2, tip[1] - normal[1] * 2),
                      (tip[0] + normal[0] * 2, tip[1] + normal[1] * 2), WHITE)

    def target_ghost(self, frame, level):
        origin, local, _polarity = level["target"]
        x0, y0, x1, y1 = self.chamber_bounds(origin)
        points = [(x0 + 3, y0), (x1 - 3, y0), (x1, y0 + 3), (x1, y1 - 3),
                  (x1 - 3, y1), (x0 + 3, y1), (x0, y1 - 3), (x0, y0 + 3)]
        for start, end in zip(points, points[1:] + points[:1]):
            self.line(frame, start, end, ASH, dotted=True)

    def target_socket(self, frame, level):
        origin, local, _polarity = level["target"]
        socket = self.cell_center((origin[0] + local[0], origin[1] + local[1]))
        self.diamond(frame, socket, 4, WHITE, hollow=True)
        for dx, dy in ((-2, -2), (2, -2), (-2, 2), (2, 2)):
            frame[socket[1] + dy, socket[0] + dx] = AMBER

    def chamber(self, frame, state, offset=(0, 0), draw_walker=True):
        origin = state[0], state[1]
        x0, y0, x1, y1 = self.chamber_bounds(origin)
        x0 += offset[0]; x1 += offset[0]; y0 += offset[1]; y1 += offset[1]
        points = [(x0 + 3, y0), (x1 - 3, y0), (x1, y0 + 3), (x1, y1 - 3),
                  (x1 - 3, y1), (x0 + 3, y1), (x0, y1 - 3), (x0, y0 + 3)]
        for y in range(y0 + 1, y1):
            inset = max(0, 3 - min(y - y0, y1 - y))
            frame[y, max(0, x0 + inset):min(64, x1 - inset + 1)] = IRON
        self.polygon(frame, points, ICE)
        self.line(frame, (x0 + 3, y0 + 3), (x1 - 3, y1 - 3), STEEL)
        self.line(frame, (x1 - 3, y0 + 3), (x0 + 3, y1 - 3), STEEL)
        for lx in range(ROOM):
            for ly in range(ROOM):
                center = (x0 + lx * self.CELL + 3, y0 + ly * self.CELL + 3)
                self.disc(frame, center, 2, ASH, hollow=True)
                frame[center[1], center[0]] = STEEL
        for lx, ly in self.game.level.get("inside_walls", ()):
            cx, cy = x0 + lx * self.CELL + 3, y0 + ly * self.CELL + 3
            self.polygon(frame, [(cx - 3, cy - 2), (cx + 2, cy - 2),
                                 (cx + 3, cy + 2), (cx - 2, cy + 2)], ASH)
            self.line(frame, (cx - 2, cy), (cx + 2, cy), AMBER)
        flip = self.game.level.get("flip")
        if flip:
            cx, cy = x0 + flip[0] * self.CELL + 3, y0 + flip[1] * self.CELL + 3
            self.diamond(frame, (cx, cy), 3, AMBER, hollow=True)
            self.line(frame, (cx - 2, cy + 2), (cx + 2, cy - 2), WHITE)
            self.line(frame, (cx - 2, cy - 1), (cx + 1, cy - 3), WHITE)
        for center in ((x0 + 3, y0 + 3), (x1 - 3, y0 + 3),
                       (x0 + 3, y1 - 3), (x1 - 3, y1 - 3)):
            self.diamond(frame, center, 1, PEARL)
        if draw_walker:
            center = (x0 + state[2] * self.CELL + 3, y0 + state[3] * self.CELL + 3)
            self.walker(frame, center)

    def walker(self, frame, center):
        self.diamond(frame, center, 3, WHITE)
        self.line(frame, (center[0] - 2, center[1]), (center[0] + 2, center[1]), INK)
        self.line(frame, (center[0], center[1] - 2), (center[0], center[1] + 2), INK)

    def clutch(self, frame, state, amount=None):
        mode = state[4]
        cx, cy = 32, 58
        self.polygon(frame, [(cx - 6, cy - 3), (cx + 6, cy - 3),
                             (cx + 4, cy + 3), (cx - 4, cy + 3)], STEEL)
        if amount is None:
            position = cx - 3 if mode == 0 else cx + 3
        else:
            position = round(cx - 3 + amount * 6)
        self.diamond(frame, (position, cy), 2, WHITE)
        if mode == 0:
            self.line(frame, (cx - 8, cy - 3), (cx - 8, cy + 3), ICE)
        else:
            self.line(frame, (cx + 5, cy - 4), (cx + 11, cy - 4), ICE)
            self.line(frame, (cx + 5, cy + 4), (cx + 11, cy + 4), ICE)

    def polarity(self, frame, state):
        cx, cy = 51, 60
        reverse = state[5]
        direction = -1 if reverse else 1
        self.line(frame, (cx - 6, cy), (cx + 6, cy), STEEL)
        tip = (cx + direction * 6, cy)
        self.polygon(frame, [tip, (tip[0] - direction * 3, cy - 2),
                             (tip[0] - direction * 3, cy + 2)], WHITE)
        if reverse:
            self.line(frame, (cx - 1, cy - 3), (cx + 1, cy + 3), AMBER)
            self.line(frame, (cx + 1, cy - 3), (cx - 1, cy + 3), AMBER)
        target_reverse = self.game.level["target"][2]
        target_direction = -1 if target_reverse else 1
        target_tip = (cx + target_direction * 5, 56)
        self.polygon(frame, [target_tip,
                             (target_tip[0] - target_direction * 3, 54),
                             (target_tip[0] - target_direction * 3, 58)], AMBER)

    def budget(self, frame, state):
        maximum = self.game.level["budget"]
        for unit in range(maximum):
            row, column = divmod(unit, 16)
            x, y = 8 + column * 3, 1 + row * 3
            if unit < state[7]:
                self.diamond(frame, (x, y), 1, ICE)
            else:
                frame[y, x] = STEEL
        if state[6] >= 1:
            self.disc(frame, (3, 58), 2, WHITE, hollow=True)
        else:
            self.line(frame, (1, 56), (5, 60), RED)
        if state[6] >= 2:
            self.diamond(frame, (61, 58), 2, WHITE, hollow=True)
        else:
            self.line(frame, (59, 56), (63, 60), RED)

    def terminal(self, frame, state):
        if state[8] == 1:
            center = self.cell_center(world_position(state))
            for radius in (3, 6, 9):
                self.diamond(frame, center, radius, WHITE, hollow=True)
        elif state[8] == 2:
            self.line(frame, (8, 7), (55, 54), RED)
            self.line(frame, (55, 7), (8, 54), ASH)

    def scene(self, frame, state, *, chamber_offset=(0, 0), draw_chamber=True,
              draw_walker=True, walker_override=None, clutch_amount=None):
        self.background(frame); self.rail(frame, self.game.level)
        self.target_ghost(frame, self.game.level)
        if draw_chamber:
            self.chamber(frame, state, chamber_offset, draw_walker=draw_walker)
        if walker_override is not None:
            self.walker(frame, walker_override)
        self.target_socket(frame, self.game.level)
        self.clutch(frame, state, clutch_amount)
        self.polarity(frame, state); self.budget(frame, state); self.terminal(frame, state)

    def animation(self, frame, before, after, kind, progress, total):
        span = max(1, total - 1)
        p = min(progress, span)
        amount = p / span
        preview = after if p * 2 >= span else before
        if kind in ("walker", "induction"):
            self.scene(frame, preview, draw_walker=False)
            start = self.cell_center(world_position(before))
            end = self.cell_center(world_position(after))
            eased = 0.0 if p == 0 else min(1.0, max(0.0, (amount - .15) / .7))
            point = self.interpolate(start, end, eased)
            self.walker(frame, point)
            if kind == "induction":
                radius = 1 + 4 * min(p, span - p) // max(1, span // 2)
                self.diamond(frame, end, radius, AMBER, hollow=True)
        elif kind == "carrier":
            self.scene(frame, preview, draw_chamber=False)
            start = self.cell_center((before[0], before[1]))
            end = self.cell_center((after[0], after[1]))
            position = self.interpolate(start, end, amount)
            offset = position[0] - start[0], position[1] - start[1]
            trail = self.interpolate(start, end, max(0.0, amount - .22))
            self.diamond(frame, trail, 1, STEEL)
            self.chamber(frame, before, offset)
        elif kind == "clutch":
            self.scene(frame, preview, clutch_amount=(before[4] + (after[4] - before[4]) * amount))
        else:
            self.scene(frame, preview)
            if kind == "blocked":
                center = (32, 30); reach = 2 + 5 * min(p, span - p) // max(1, span // 2)
                for dx, dy in ((-reach, -2), (-reach, 2), (reach, -2), (reach, 2)):
                    self.line(frame, center, (center[0] + dx, center[1] + dy), AMBER, dotted=True)
            elif kind == "reject":
                center = (61, 58) if before[6] == 2 else (3, 58)
                reach = 1 + 3 * p // span
                self.line(frame, (center[0] - reach, center[1] - reach),
                          (center[0] + reach, center[1] + reach), RED)
            elif kind == "success":
                center = self.cell_center(world_position(after))
                for radius in range(2, min(12, 2 + p * 2), 3):
                    self.diamond(frame, center, radius, WHITE, hollow=True)
            elif kind == "loss":
                inset = 4 * p // span
                self.line(frame, (7 + inset, 6 + inset), (56 - inset, 55 - inset), RED)
                self.line(frame, (56 - inset, 6 + inset), (7 + inset, 55 - inset), ASH)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game
        if game.anim_kind:
            self.animation(frame, game.anim_before, game.pending_state, game.anim_kind,
                           game.anim_progress, game.anim_total)
        else:
            self.scene(frame, game.state)
            if game.intro_mark:
                x0, y0, x1, y1 = self.chamber_bounds((game.state[0], game.state[1]))
                self.polygon(frame, [(x0 + 3, y0 - 2), (x1 - 3, y0 - 2),
                                     (x1 + 2, y0 + 3), (x1 + 2, y1 - 3),
                                     (x1 - 3, y1 + 2), (x0 + 3, y1 + 2),
                                     (x0 - 2, y1 - 3), (x0 - 2, y0 + 3)], AMBER)
        return frame


class G525(ARCBaseGame):
    def __init__(self):
        self.display = G525A(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q102", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_terminal = None
        self.intro_mark = True

    def begin(self, kind, frames, after, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = after; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state
        self.budget_left = self.state[7]; self.anim_kind = None
        self.pending_state = None; self.pending_terminal = None
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
        self.intro_mark = False
        after = transition(self.level, self.state, action)
        kind = transition_kind(self.level, self.state, after, action)
        terminal = "win" if after[8] == 1 else "loss" if after[8] == 2 else None
        frames = 7 if kind in ("carrier", "induction", "success", "loss") else 6
        self.begin(kind, frames, after, terminal)
