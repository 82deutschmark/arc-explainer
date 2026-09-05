# ARC-AGI-3 candidate task g514.

from __future__ import annotations

from collections import deque
from copy import deepcopy
from math import hypot

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, SLATE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, CYAN, GOLD, ORANGE, BROWN, GREEN, VIOLET = range(6, 16)

EMPTY, TIMBER, CABLE, STEEL = 0, 1, 2, 3
ANY, COMPRESSION, TENSION = 0, 1, 2


RAW_LEVELS = [
    {
        "name": "Ribbon Span",
        "nodes": ((7, 35), (31, 23), (57, 35), (31, 47)),
        "edges": ((0, 1), (1, 2), (0, 3), (3, 2), (1, 3)),
        "roles": (ANY, ANY, ANY, ANY, ANY), "buckling": (),
        "stock": (2, 0, 0), "stress": ((0, 2, 1),),
        "brace_sets": (), "brace_need": 0,
        "solution": (("edge", 0), ("edge", 1)),
    },
    {
        "name": "Twin Footpaths",
        "nodes": ((4, 35), (20, 18), (43, 18), (60, 35),
                  (20, 50), (43, 50), (32, 35)),
        "edges": ((0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 3),
                  (0, 6), (6, 3), (1, 6), (6, 5)),
        "roles": (ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY), "buckling": (),
        "stock": (8, 0, 0), "stress": ((0, 3, 3),),
        "brace_sets": (), "brace_need": 0,
        "solution": (("edge", 0), ("edge", 1), ("edge", 2),
                     ("edge", 3), ("edge", 4), ("edge", 5),
                     ("edge", 6), ("edge", 7)),
    },
    {
        "name": "Steel Viaduct",
        "nodes": ((4, 35), (20, 18), (43, 18), (60, 35), (20, 50), (43, 50)),
        "edges": ((0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 3)),
        "roles": (ANY, ANY, ANY, ANY, ANY, ANY),
        "buckling": (),
        "stock": (3, 0, 3), "stress": ((0, 3, 3),),
        "brace_sets": (), "brace_need": 0,
        "solution": (("edge", 0), ("edge", 1), ("edge", 2),
                     3, ("edge", 3), ("edge", 4), ("edge", 5)),
    },
    {
        "name": "Gusset Lesson",
        "nodes": ((5, 40), (20, 17), (32, 45), (44, 17), (59, 40)),
        "edges": ((0, 1), (1, 2), (0, 2), (2, 3), (3, 4), (2, 4),
                  (1, 3), (0, 4), (0, 3), (1, 4)),
        "roles": (ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY),
        "buckling": (),
        "stock": (6, 0, 0), "stress": ((0, 4, 2),),
        "brace_sets": ((0, 1, 2), (3, 4, 5)), "brace_need": 2,
        "solution": (("edge", 0), ("edge", 1), ("edge", 2),
                     ("edge", 3), ("edge", 4), ("edge", 5)),
    },
    {
        "name": "Tension Canopy",
        "nodes": ((5, 40), (20, 17), (32, 45), (44, 17), (59, 40)),
        "edges": ((0, 1), (1, 2), (0, 2), (2, 3), (3, 4), (2, 4)),
        "roles": (COMPRESSION, TENSION, COMPRESSION, ANY, TENSION, COMPRESSION),
        "buckling": (3,), "stock": (3, 2, 1), "stress": ((0, 4, 2),),
        "brace_sets": ((0, 1, 2), (3, 4, 5)), "brace_need": 2,
        "solution": (("edge", 0), ("edge", 2), ("edge", 5),
                     4, ("edge", 1), ("edge", 4), 4, ("edge", 3)),
    },
    {
        "name": "Traveling Lanterns",
        "nodes": ((4, 35), (28, 17), (28, 51), (60, 19), (60, 49)),
        "edges": ((0, 1), (1, 3), (1, 4), (0, 2), (2, 3), (2, 4)),
        "roles": (COMPRESSION, TENSION, COMPRESSION,
                  COMPRESSION, COMPRESSION, TENSION), "buckling": (),
        "stock": (4, 2, 0),
        "stress": ((0, 3, 2), (0, 4, 2), (3, 4, 2)),
        "brace_sets": (), "brace_need": 0,
        "solution": (("edge", 0), ("edge", 2), ("edge", 3), ("edge", 4),
                     4, ("edge", 1), ("edge", 5)),
    },
    {
        "name": "Two-Bay Pavilion",
        "nodes": ((5, 40), (20, 17), (32, 45), (44, 17), (59, 40)),
        "edges": ((0, 1), (1, 2), (0, 2), (2, 3), (3, 4), (2, 4), (1, 3)),
        "roles": (COMPRESSION, TENSION, COMPRESSION, COMPRESSION,
                  TENSION, COMPRESSION, ANY),
        "buckling": (6,), "stock": (4, 2, 0), "stress": ((0, 4, 2),),
        "brace_sets": ((0, 1, 2), (3, 4, 5)), "brace_need": 2,
        "solution": (("edge", 0), ("edge", 2), ("edge", 3), ("edge", 5),
                     4, ("edge", 1), ("edge", 4)),
    },
    {
        "name": "Festival Crossing",
        "nodes": ((4, 36), (18, 14), (18, 49), (45, 14), (45, 49), (60, 36)),
        "edges": ((0, 1), (0, 2), (1, 2), (1, 3), (2, 4),
                  (3, 4), (3, 5), (4, 5)),
        "roles": (COMPRESSION, COMPRESSION, TENSION, ANY, COMPRESSION,
                  TENSION, COMPRESSION, COMPRESSION),
        "buckling": (3,), "stock": (5, 2, 1),
        "stress": ((0, 5, 2), (0, 3, 2), (0, 4, 2), (2, 4, 3)),
        "brace_sets": ((0, 1, 2), (5, 6, 7)), "brace_need": 2,
        "solution": (("edge", 0), ("edge", 1), ("edge", 4), ("edge", 6),
                     ("edge", 7), 4, ("edge", 2), ("edge", 5),
                     4, ("edge", 3)),
    },
]


def edge_action(level, edge_index):
    a, b = level["edges"][edge_index]
    ax, ay = level["nodes"][a]; bx, by = level["nodes"][b]
    for numerator, denominator in ((1, 4), (1, 3), (2, 3), (3, 4), (1, 2)):
        x = (ax * (denominator - numerator) + bx * numerator) // denominator
        y = (ay * (denominator - numerator) + by * numerator) // denominator
        if _edge_at(level, x, y) == edge_index:
            return (6, x, y)
    return (6, (2 * ax + bx) // 3, (2 * ay + by) // 3)


def actions_for_level(level, include_audit=True):
    actions = [3, 4]
    actions.extend(edge_action(level, index) for index in range(len(level["edges"])))
    if include_audit:
        actions.append(5)
    return tuple(actions)


def start_state(level):
    return (TIMBER, (EMPTY,) * len(level["edges"]), tuple(level["stock"]), 2, 0)


def _action_parts(action):
    if isinstance(action, (tuple, list)):
        if not action:
            return 0, 0, 0
        return int(action[0]), int(action[1]) if len(action) > 1 else 0, int(action[2]) if len(action) > 2 else 0
    return int(action), 0, 0


def _edge_at(level, x, y):
    best = None
    for index, (a, b) in enumerate(level["edges"]):
        ax, ay = level["nodes"][a]; bx, by = level["nodes"][b]
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy)
                              / max(1, dx * dx + dy * dy)))
        distance = hypot(x - (ax + t * dx), y - (ay + t * dy))
        candidate = (distance, index)
        if best is None or candidate < best:
            best = candidate
    return best[1] if best is not None and best[0] <= 4 else None


def member_capacity(level, edge_index, material):
    if material == EMPTY:
        return 0
    role = level["roles"][edge_index]
    if role == COMPRESSION and material == CABLE:
        return 0
    if role == TENSION and material == TIMBER:
        return 0
    if edge_index in level["buckling"] and material == TIMBER:
        return 0
    return 2 if material == STEEL else 1


def max_flow(level, installed, source, sink):
    residual = {}
    for edge_index, (a, b) in enumerate(level["edges"]):
        capacity = member_capacity(level, edge_index, installed[edge_index])
        if capacity:
            residual[(a, b)] = residual.get((a, b), 0) + capacity
            residual[(b, a)] = residual.get((b, a), 0) + capacity
    flow = 0
    while True:
        parent = {source: None}; queue = deque([source])
        while queue and sink not in parent:
            node = queue.popleft()
            for neighbor in range(len(level["nodes"])):
                if neighbor not in parent and residual.get((node, neighbor), 0) > 0:
                    parent[neighbor] = node; queue.append(neighbor)
        if sink not in parent:
            return flow
        node = sink
        while parent[node] is not None:
            previous = parent[node]
            residual[(previous, node)] -= 1
            residual[(node, previous)] = residual.get((node, previous), 0) + 1
            node = previous
        flow += 1


def brace_count(level, installed):
    return sum(all(member_capacity(level, edge, installed[edge]) > 0 for edge in brace)
               for brace in level["brace_sets"])


def configuration_solved(level, state):
    if state[4] or brace_count(level, state[1]) < level["brace_need"]:
        return False
    return all(max_flow(level, state[1], source, sink) >= load
               for source, sink, load in level["stress"])


def transition(level, state, action):
    material, installed, stock, seals, terminal = state
    if terminal:
        return state
    action_id, x, y = _action_parts(action)
    if action_id in (3, 4):
        delta = -1 if action_id == 3 else 1
        selected = (material - 1 + delta) % 3 + 1
        return (selected, installed, stock, seals, terminal)
    if action_id == 6:
        edge = _edge_at(level, x, y)
        if edge is None:
            return state
        members = list(installed); supplies = list(stock)
        existing = members[edge]
        if existing:
            members[edge] = EMPTY; supplies[existing - 1] += 1
        elif supplies[material - 1] > 0:
            members[edge] = material; supplies[material - 1] -= 1
        else:
            return state
        return (material, tuple(members), tuple(supplies), seals, terminal)
    if action_id == 5:
        if configuration_solved(level, state):
            return state[:-1] + (2,)
        if seals > 1:
            return state[:3] + (seals - 1, 0)
        return state[:3] + (0, 3)
    return state


def action_cost(before, after):
    if before == after or before[3] != after[3] or after[4] in (2, 3):
        return 0
    return 1


def solved(_level, state):
    return state[4] == 2


def _finalize_levels():
    levels = []
    for raw in RAW_LEVELS:
        level = {key: deepcopy(value) for key, value in raw.items() if key != "solution"}
        compiled = tuple(edge_action(level, token[1]) if isinstance(token, tuple) else token
                         for token in raw["solution"])
        state = start_state(level)
        for action in compiled:
            before = state; state = transition(level, state, action)
            assert state != before, (raw["name"], action)
            assert not state[4]
        assert configuration_solved(level, state), raw["name"]
        level["solution"] = compiled
        level["optimal_cost"] = len(compiled)
        level["budget"] = len(compiled) + 2
        levels.append(level)
    return levels


LEVELS = _finalize_levels()


class G514A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, width=1, dotted=False, limit=100):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        last = min(steps, max(0, limit * steps // 100))
        for step in range(last + 1):
            if dotted and step % 4 in (2, 3):
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            frame[max(0, y - width + 1):min(64, y + width),
                  max(0, x - width + 1):min(64, x + width)] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius * radius and (not hollow or d >= max(0, radius - 1) ** 2):
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

    def curve(self, frame, a, b, color, dotted=False, limit=100):
        ax, ay = a; bx, by = b; steps = max(abs(bx - ax), abs(by - ay), 12)
        sag = min(6, max(2, abs(bx - ax) // 8))
        last = min(steps, max(0, limit * steps // 100))
        for step in range(last + 1):
            if dotted and step % 4 in (1, 2):
                continue
            t = step / steps
            x = round(ax + (bx - ax) * t)
            y = round(ay + (by - ay) * t + 4 * sag * t * (1 - t))
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def background(self, frame):
        frame[:, :] = PEARL
        for y in range(9, 55):
            color = WHITE if y < 28 else ASH
            frame[y, :] = color
        self.disc(frame, (53, 15), 8, GOLD)
        self.disc(frame, (53, 15), 5, PEARL)
        for x in range(0, 64, 8):
            self.line(frame, (x, 10), (x + 4, 13), ORANGE)
            self.line(frame, (x + 4, 13), (x + 8, 10), ROSE)
        frame[54:64, :] = BROWN
        for y in range(55, 64, 4):
            offset = 4 if y % 8 else 0
            for x in range(-offset, 64, 9):
                self.line(frame, (x, y), (x + 7, y), ORANGE)
        for x in range(3, 64, 12):
            self.line(frame, (x, 55), (x - 2, 63), RED, dotted=True)

    def candidate(self, frame, edge_index):
        level = self.game.level; a, b = level["edges"][edge_index]
        start, finish = level["nodes"][a], level["nodes"][b]
        role = level["roles"][edge_index]
        if role == TENSION:
            self.curve(frame, start, finish, VIOLET, dotted=True)
        elif role == COMPRESSION:
            self.line(frame, start, finish, SLATE, dotted=True)
            midpoint = ((start[0] + finish[0]) // 2, (start[1] + finish[1]) // 2)
            dx = 1 if abs(finish[1] - start[1]) > abs(finish[0] - start[0]) else 0
            dy = 0 if dx else 1
            self.line(frame, (midpoint[0] - dx * 2, midpoint[1] - dy * 2),
                      (midpoint[0] + dx * 2, midpoint[1] + dy * 2), SLATE)
        else:
            self.line(frame, start, finish, ASH, dotted=True)
        if edge_index in level["buckling"]:
            mx, my = (start[0] + finish[0]) // 2, (start[1] + finish[1]) // 2
            self.line(frame, (mx - 3, my - 2), (mx, my + 2), RED)
            self.line(frame, (mx, my + 2), (mx + 3, my - 2), RED)

    def member(self, frame, edge_index, material, limit=100, ghost=False):
        level = self.game.level; a, b = level["edges"][edge_index]
        start, finish = level["nodes"][a], level["nodes"][b]
        if material == TIMBER:
            self.line(frame, start, finish, BROWN, width=2, limit=limit)
            self.line(frame, start, finish, GOLD, dotted=True, limit=limit)
        elif material == CABLE:
            self.curve(frame, start, finish, VIOLET if not ghost else ROSE,
                       dotted=False, limit=limit)
            self.curve(frame, (start[0], start[1] - 1), (finish[0], finish[1] - 1),
                       MAGENTA, dotted=True, limit=limit)
        else:
            self.line(frame, start, finish, CYAN, width=2, limit=limit)
            self.line(frame, start, finish, WHITE, dotted=True, limit=limit)
        if limit >= 100:
            for point in (start, finish):
                self.disc(frame, point, 1, GOLD)

    def brace_cloth(self, frame, state):
        level = self.game.level
        for brace in level["brace_sets"]:
            if not all(member_capacity(level, edge, state[1][edge]) > 0 for edge in brace):
                continue
            vertices = sorted({node for edge in brace for node in level["edges"][edge]})
            if len(vertices) != 3:
                continue
            points = [level["nodes"][node] for node in vertices]
            center = (sum(point[0] for point in points) // 3,
                      sum(point[1] for point in points) // 3)
            for point in points:
                midpoint = ((center[0] + point[0]) // 2, (center[1] + point[1]) // 2)
                self.line(frame, center, midpoint, ORANGE, dotted=True)
            self.diamond(frame, center, 2, GOLD, hollow=True)

    def joint(self, frame, index, position):
        level = self.game.level
        is_source = any(source == index for source, _sink, _load in level["stress"])
        sink_loads = [load for _source, sink, load in level["stress"] if sink == index]
        x, y = position
        if is_source:
            self.line(frame, (x - 4, y + 4), (x - 4, y), BROWN)
            self.line(frame, (x - 4, y), (x, y - 4), BROWN)
            self.line(frame, (x, y - 4), (x + 4, y), BROWN)
            self.line(frame, (x + 4, y), (x + 4, y + 4), BROWN)
        self.disc(frame, position, 3, ORANGE)
        self.disc(frame, position, 1, WHITE)
        for case, load in enumerate(sink_loads):
            for unit in range(load):
                px = x + (unit - (load - 1) / 2) * 4
                py = y + 5 + case * 4
                self.line(frame, (round(px), y + 2), (round(px), round(py)), VIOLET)
                self.diamond(frame, (round(px), round(py) + 2), 2, RED, hollow=True)

    def stock_piece(self, frame, material, center, selected=False):
        x, y = center
        if material == TIMBER:
            self.line(frame, (x - 4, y + 2), (x + 4, y - 2), BROWN, width=2)
            self.line(frame, (x - 2, y + 1), (x, y), GOLD)
        elif material == CABLE:
            self.curve(frame, (x - 5, y - 1), (x + 5, y - 1), VIOLET)
            self.disc(frame, (x - 5, y - 1), 1, MAGENTA)
            self.disc(frame, (x + 5, y - 1), 1, MAGENTA)
        else:
            self.line(frame, (x - 4, y + 2), (x + 4, y - 2), CYAN, width=2)
            self.disc(frame, (x, y), 1, WHITE)
        if selected:
            for dx, dy in ((-6, 0), (0, -5), (6, 0), (0, 5)):
                self.diamond(frame, (x + dx, y + dy), 1, ORANGE)

    def hud(self, frame):
        game = self.game; state = game.state
        shown = game.budget_left
        if (game.anim_kind and game.pending_budget is not None
                and game.anim_progress >= max(1, game.anim_total - 1)
                and game.anim_kind != "success"):
            shown = game.pending_budget
        for unit in range(game.budget_max):
            x = 3 + (unit % 14) * 3; y = 3 + (unit // 14) * 3
            if unit < shown:
                self.diamond(frame, (x, y), 1, ORANGE)
            else:
                frame[y, x - 1:x + 2] = ASH
        for material, x in ((TIMBER, 34), (CABLE, 45), (STEEL, 56)):
            self.stock_piece(frame, material, (x, 5), selected=material == state[0])
            remaining = state[2][material - 1]
            for piece in range(remaining):
                self.diamond(frame, (x - 3 + piece * 3, 10), 1,
                             (BROWN, VIOLET, CYAN)[material - 1])
        for index, x in enumerate((57, 62)):
            live = index < state[3]
            self.disc(frame, (x, 59), 2, GREEN if live else RED, hollow=True)
            if live:
                self.line(frame, (x - 1, 59), (x + 1, 59), WHITE)
            else:
                self.line(frame, (x - 2, 57), (x + 2, 61), RED)

    def structure(self, frame):
        state = self.game.state; level = self.game.level
        for edge in range(len(level["edges"])):
            self.candidate(frame, edge)
        self.brace_cloth(frame, state)
        for edge, material in enumerate(state[1]):
            if material:
                self.member(frame, edge, material)
        for index, position in enumerate(level["nodes"]):
            self.joint(frame, index, position)
        self.hud(frame)

    def animation(self, frame):
        game = self.game
        if game.intro_mark:
            for radius in (4, 8, 12):
                self.disc(frame, (32, 34), radius, GOLD, hollow=True)
        if not game.anim_kind:
            return
        p = game.anim_progress; span = max(1, game.anim_total - 1)
        before, after = game.anim_before, game.pending_state
        if game.anim_kind == "material" and p < span:
            start_x = (TIMBER, CABLE, STEEL).index(before[0]) * 11 + 34
            end_x = (TIMBER, CABLE, STEEL).index(after[0]) * 11 + 34
            x = start_x + (end_x - start_x) * p // span
            self.stock_piece(frame, after[0], (x, 13), selected=True)
        elif game.anim_kind in ("place", "remove") and p < span:
            changed = next(index for index, (a, b) in enumerate(zip(before[1], after[1])) if a != b)
            if game.anim_kind == "place":
                material = after[1][changed]; amount = p * 100 // span
            else:
                material = before[1][changed]; amount = 100 - p * 100 // span
            self.member(frame, changed, material, limit=amount, ghost=game.anim_kind == "remove")
            a, b = game.level["edges"][changed]
            ax, ay = game.level["nodes"][a]; bx, by = game.level["nodes"][b]
            event = (ax + (bx - ax) * max(0, amount) // 100,
                     ay + (by - ay) * max(0, amount) // 100)
            self.disc(frame, event, 2, WHITE, hollow=True)
        elif game.anim_kind == "audit" and p < span:
            amount = p * 100 // span
            for edge, material in enumerate(before[1]):
                if material and member_capacity(game.level, edge, material):
                    self.member(frame, edge, material, limit=amount)
            for _source, sink, load in game.level["stress"]:
                x, y = game.level["nodes"][sink]
                self.line(frame, (x - load * 2, y + 7), (x + load * 2, y + 7),
                          GREEN if after[4] == 2 else RED, limit=amount)
        elif game.anim_kind == "blocked" and p < span:
            radius = 2 + min(p, span - p)
            self.diamond(frame, (32, 33), radius, RED, hollow=True)
        elif game.anim_kind == "success":
            for edge, material in enumerate(before[1]):
                if material and edge <= p:
                    self.member(frame, edge, material)
            for radius in range(5, min(30, 5 + p * 4), 5):
                self.disc(frame, (32, 34), radius, GREEN, hollow=True)
            for x in range(6, 61, 9):
                if x // 9 <= p:
                    self.diamond(frame, (x, 12), 2, ORANGE)
        elif game.anim_kind == "loss" and p < span:
            fall = 8 * p // span
            for edge, material in enumerate(before[1]):
                if not material:
                    continue
                a, b = game.level["edges"][edge]
                start = game.level["nodes"][a]; finish = game.level["nodes"][b]
                self.line(frame, (start[0], start[1] + fall),
                          (finish[0] + fall // 2, finish[1] + fall), RED, dotted=True)
            self.line(frame, (4 + fall, 53), (60 - fall, 53), CHARCOAL)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game
        preview = (game.anim_kind in ("material", "place", "remove", "audit", "blocked", "loss")
                   and game.pending_state is not None
                   and game.anim_progress >= max(1, game.anim_total - 1))
        current = game.state
        if preview:
            game.state = game.pending_state
        self.background(frame); self.structure(frame)
        if preview:
            game.state = current
        self.animation(frame)
        return frame


class G514(ARCBaseGame):
    def __init__(self):
        self.display = G514A(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level), name=level["name"])
                  for level in LEVELS]
        super().__init__("g514", levels, Camera(0, 0, 64, 64, PEARL, PEARL, [self.display]),
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
        action_id = self.action.id.value
        if action_id == 0:
            self.complete_action(); return
        action = ((action_id, int(self.action.data.get("x", 0)), int(self.action.data.get("y", 0)))
                  if action_id == 6 else action_id)
        self.intro_mark = False; before = self.state
        after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, before, self.budget_left); return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:-1] + (3,)
            self.begin("loss", 7, before, lost, self.budget_left, "loss"); return
        budget = self.budget_left - cost
        if after[4] == 2:
            kind, frames, terminal = "success", 7, "win"
        elif after[4] == 3:
            kind, frames, terminal = "loss", 7, "loss"
        elif action_id in (3, 4):
            kind, frames, terminal = "material", 5, None
        elif action_id == 6:
            changed = next(index for index, (a, b) in enumerate(zip(before[1], after[1])) if a != b)
            kind = "remove" if before[1][changed] else "place"
            frames, terminal = 7, None
        else:
            kind, frames, terminal = "audit", 7, None
        self.begin(kind, frames, before, after, budget, terminal)
