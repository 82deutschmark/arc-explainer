# ARC-AGI-3 candidate task g511.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


INK, MIST, SLATE, KELP_DARK, ABYSS = 0, 1, 2, 4, 5
FUCHSIA, PEARL, RED, BLUE, CYAN, SUN, ORANGE, BARK, GREEN, VIOLET = range(6, 16)


def edge(a, b, *, oneway=False, phase=None, link=None, amount=1, bend=0):
    return {
        "a": a,
        "b": b,
        "oneway": oneway,
        "phase": phase,
        "link": link,
        "amount": amount,
        "bend": bend,
    }


LEVELS = [
    {
        "name": "First Current", "start": (3, 0), "targets": ((1, 2),), "cap": (3, 3),
        "pos": ((15, 33), (49, 29)), "edges": (edge(0, 1, bend=-7),), "budget": 5,
    },
    {
        "name": "Forked Current", "start": (2, 2, 0),
        "targets": ((1, 2, 1), (2, 2, 0), (1, 2, 1), (1, 1, 2)), "cap": (3, 3, 3),
        "pos": ((13, 19), (15, 47), (50, 32)),
        "edges": (edge(0, 2, bend=-8), edge(2, 1, bend=9)), "budget": 11,
    },
    {
        "name": "Petal Capacity", "start": (4, 0, 1),
        "targets": ((3, 1, 1), (2, 2, 1), (2, 1, 2), (1, 2, 2), (2, 1, 2)),
        "cap": (4, 2, 3),
        "pos": ((12, 34), (34, 14), (51, 43)),
        "edges": (edge(0, 1, bend=-7), edge(1, 2, bend=-6), edge(0, 2, bend=11)),
        "budget": 11,
    },
    {
        "name": "Anemone Valves", "start": (3, 0, 1, 0),
        "targets": ((3, 1, 0, 0), (3, 0, 1, 0), (2, 1, 1, 0), (1, 1, 1, 1)),
        "cap": (3, 2, 2, 2), "pos": ((10, 33), (30, 14), (33, 50), (54, 29)),
        "edges": (edge(0, 1, oneway=True, bend=-6), edge(1, 2, bend=-7),
                  edge(0, 3, oneway=True, bend=8)), "budget": 12,
    },
    {
        "name": "Moon Gills", "start": (3, 0, 0),
        "targets": ((2, 1, 0), (3, 0, 0), (2, 1, 0), (1, 1, 1)), "cap": (3, 2, 2),
        "pos": ((12, 33), (49, 16), (49, 49)),
        "edges": (edge(0, 1, phase=0, bend=-10),
                  edge(0, 2, oneway=True, phase=1, bend=10)), "budget": 12,
    },
    {
        "name": "Twin Ripple", "start": (4, 0, 0, 0),
        "targets": ((2, 1, 0, 1), (1, 1, 0, 2), (1, 0, 1, 2),
                    (1, 1, 0, 2), (1, 0, 1, 2)), "cap": (4, 2, 2, 2),
        "pos": ((10, 32), (31, 13), (53, 31), (31, 51)),
        "edges": (edge(0, 1, oneway=True, link=1, bend=-6), edge(0, 3, oneway=True, bend=6),
                  edge(1, 2, bend=-5), edge(2, 3, bend=-5)), "budget": 12,
    },
    {
        "name": "Double-Braid Bloom", "start": (6, 0, 0, 0),
        "targets": ((4, 2, 0, 0), (4, 1, 0, 1), (2, 3, 0, 1), (2, 2, 0, 2)),
        "cap": (6, 3, 2, 3), "pos": ((9, 33), (28, 13), (53, 30), (31, 52)),
        "edges": (edge(0, 1, oneway=True, phase=0, amount=2, bend=-8),
                  edge(1, 2, oneway=True, link=2, bend=-6),
                  edge(2, 3, oneway=True, bend=-6), edge(0, 2, bend=9)), "budget": 10,
    },
    {
        "name": "Moonpool Balance Web", "start": (8, 0, 0, 0, 0),
        "targets": ((6, 2, 0, 0, 0), (6, 1, 0, 0, 1), (5, 1, 1, 0, 1),
                    (5, 1, 0, 1, 1), (3, 3, 0, 1, 1), (3, 2, 0, 1, 2),
                    (3, 2, 1, 0, 2)),
        "cap": (8, 4, 3, 3, 3),
        "pos": ((8, 33), (24, 13), (23, 52), (44, 17), (55, 40)),
        "edges": (edge(0, 1, oneway=True, phase=0, amount=2, bend=-7),
                  edge(0, 2, oneway=True, bend=7),
                  edge(1, 3, oneway=True, link=4, bend=-5),
                  edge(2, 3, phase=1, bend=8),
                  edge(3, 4, oneway=True, bend=-5),
                  edge(4, 2, bend=8)),
        "budget": 23,
    },
]


def start_state(level):
    return tuple(level["start"]), 0, 0, False, 0, 0, 0


def _sealed(state):
    values, tide, cursor, reverse, stage, seals, _terminal = state
    seals += 1
    return values, tide, cursor, reverse, stage, seals, 3 if seals >= 3 else 0


def _move(values, authored, reverse, cap):
    a, b = authored["a"], authored["b"]
    if reverse:
        if authored["oneway"]:
            return tuple(values), False
        a, b = b, a
    amount = authored["amount"]
    if values[a] < amount or values[b] + amount > cap[b]:
        return tuple(values), False
    changed = list(values)
    changed[a] -= amount
    changed[b] += amount
    return tuple(changed), True


def _open(authored, tide):
    return authored["phase"] is None or tide % 2 == authored["phase"]


def pump_trace(level, state):
    values, tide, cursor, reverse, _stage, _seals, _terminal = state
    selected = level["edges"][cursor]
    if not _open(selected, tide):
        return values, (), "gate"
    values, moved = _move(values, selected, reverse, level["cap"])
    if not moved:
        return values, (), "blocked"
    trace = [(cursor, bool(reverse))]
    linked_index = selected["link"]
    visited = {cursor}
    while linked_index is not None and linked_index not in visited:
        visited.add(linked_index)
        linked = level["edges"][linked_index]
        if not _open(linked, tide):
            break
        values, linked_moved = _move(values, linked, False, level["cap"])
        if not linked_moved:
            break
        trace.append((linked_index, False))
        linked_index = linked["link"]
    return values, tuple(trace), "moved"


def transition(level, state, action):
    values, tide, cursor, reverse, stage, seals, terminal = state
    if terminal or action not in (1, 3, 4, 5, 6):
        return state
    if action == 1:
        return values, tide, cursor, not reverse, stage, seals, terminal
    if action in (3, 4):
        if len(level["edges"]) == 1:
            return _sealed(state)
        delta = -1 if action == 3 else 1
        return values, tide, (cursor + delta) % len(level["edges"]), reverse, stage, seals, terminal
    if action == 6:
        if stage == len(level["targets"]):
            return values, tide, cursor, reverse, stage, seals, 2
        return _sealed(state)

    moved_values, _trace, result = pump_trace(level, state)
    tide += 1
    if result == "blocked":
        blocked = values, tide, cursor, reverse, stage, seals, terminal
        return _sealed(blocked)
    if result == "gate":
        return values, tide, cursor, reverse, stage, seals, terminal
    if stage < len(level["targets"]) and moved_values == tuple(level["targets"][stage]):
        stage += 1
    return moved_values, tide, cursor, reverse, stage, seals, terminal


def solved(_level, state):
    return state[-1] == 2


def action_cost(state, _after):
    return 0 if state[-1] else 1


def _curve_point(a, b, bend, numerator, denominator):
    x0, y0 = a
    x1, y1 = b
    dx, dy = x1 - x0, y1 - y0
    length = max(1, abs(dx) + abs(dy))
    cx = (x0 + x1) // 2 - dy * bend // length
    cy = (y0 + y1) // 2 + dx * bend // length
    t = numerator
    u = denominator - t
    den2 = denominator * denominator
    x = (u * u * x0 + 2 * u * t * cx + t * t * x1) // den2
    y = (u * u * y0 + 2 * u * t * cy + t * t * y1) // den2
    return x, y


def _curve(frame, a, b, bend, color, *, dotted=False, companion=0):
    steps = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 12)
    for index in range(steps + 1):
        if dotted and index % 4 in (1, 2):
            continue
        x, y = _curve_point(a, b, bend + companion, index, steps)
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color


class G511A(RenderableUserDisplay):
    PETALS = ((0, -7), (5, -5), (7, 0), (5, 5), (0, 7), (-5, 5), (-7, 0), (-5, -5))
    LOADS = ((-2, 2), (2, 2), (0, -2), (-3, -1), (3, -1), (-1, 0), (1, 0), (0, 3))

    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius * radius and (not hollow or distance >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def line(frame, a, b, color, dotted=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            x = x0 + (x1 - x0) * index // steps
            y = y0 + (y1 - y0) * index // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def background(self, frame):
        frame[:, :] = ABYSS
        for y in range(5, 61, 7):
            for x in range(4 + (y // 7) % 3, 62, 11):
                self.disc(frame, (x, y), 1 if (x + y) % 3 else 2, KELP_DARK, hollow=(x + y) % 3 == 0)
        _curve(frame, (1, 10), (62, 7), -6, SLATE, dotted=True)
        _curve(frame, (2, 57), (61, 54), 7, BLUE, dotted=True)
        for y in (18, 31, 44):
            self.disc(frame, (2, y), 3, KELP_DARK, hollow=True)
            self.line(frame, (3, y + 2), (6, y - 3), GREEN, dotted=True)

    def edge(self, frame, index, authored):
        g = self.game
        a = g.level["pos"][authored["a"]]
        b = g.level["pos"][authored["b"]]
        selected = index == g.cursor
        phase_open = _open(authored, g.tide)
        base = CYAN if phase_open else SLATE
        _curve(frame, a, b, authored["bend"], SUN if selected else base, dotted=not phase_open)
        _curve(frame, a, b, authored["bend"], PEARL if selected else BLUE,
               dotted=True, companion=3)
        if authored["amount"] == 2:
            _curve(frame, a, b, authored["bend"], VIOLET if selected else CYAN,
                   dotted=False, companion=-3)
        midpoint = _curve_point(a, b, authored["bend"], 5, 9)
        nextpoint = _curve_point(a, b, authored["bend"], 6, 9)
        dx = 1 if nextpoint[0] > midpoint[0] else -1 if nextpoint[0] < midpoint[0] else 0
        dy = 1 if nextpoint[1] > midpoint[1] else -1 if nextpoint[1] < midpoint[1] else 0
        if g.reverse and not authored["oneway"]:
            dx, dy = -dx, -dy
        mx, my = midpoint
        self.disc(frame, midpoint, 2, SUN if selected else MIST)
        self.line(frame, (mx - dx * 3, my - dy * 3), midpoint, PEARL)
        if authored["oneway"]:
            self.line(frame, midpoint, (mx - dy * 3 - dx, my + dx * 3 - dy), ORANGE)
            self.line(frame, midpoint, (mx + dy * 3 - dx, my - dx * 3 - dy), ORANGE)
        else:
            self.disc(frame, (mx - dx * 4, my - dy * 4), 1, PEARL)
        if authored["phase"] is not None:
            gate = _curve_point(a, b, authored["bend"], 3, 8)
            self.disc(frame, gate, 3, VIOLET, hollow=not phase_open)
            self.disc(frame, (gate[0] + (1 if authored["phase"] else -1), gate[1]), 1, ABYSS)
        if authored["link"] is not None:
            knot = _curve_point(a, b, authored["bend"], 2, 7)
            self.disc(frame, (knot[0] - 2, knot[1]), 2, FUCHSIA, hollow=True)
            self.disc(frame, (knot[0] + 2, knot[1]), 2, FUCHSIA, hollow=True)

    def node(self, frame, index, value, target, cap):
        cx, cy = self.game.level["pos"][index]
        self.disc(frame, (cx, cy), 8, KELP_DARK)
        self.disc(frame, (cx - 1, cy + 1), 7, CYAN)
        self.disc(frame, (cx, cy), 6, BLUE)
        self.disc(frame, (cx, cy), 5, ABYSS)
        for px, py in self.PETALS[:cap]:
            self.disc(frame, (cx + px, cy + py), 1, MIST)
            frame[cy + py, cx + px] = PEARL
        for px, py in self.PETALS[:target]:
            self.disc(frame, (cx + px, cy + py), 2, ORANGE, hollow=True)
        for dx, dy in self.LOADS[:value]:
            self.disc(frame, (cx + dx, cy + dy), 2, SUN)
            frame[cy + dy, cx + dx] = PEARL
        if value == target:
            self.disc(frame, (cx, cy), 5, GREEN, hollow=True)
        for notch in range(index + 1):
            angle_slot = self.PETALS[(notch * 3) % len(self.PETALS)]
            nx, ny = cx + angle_slot[0], cy + angle_slot[1]
            self.disc(frame, (nx, ny), 1, FUCHSIA)

    def hud(self, frame):
        g = self.game
        count = len(g.level["targets"])
        start = 32 - (count - 1) * 4
        for index in range(count):
            x = start + index * 8
            if index < g.stage:
                self.disc(frame, (x, 5), 2, GREEN)
                frame[5, x] = PEARL
            elif index == g.stage:
                self.line(frame, (x - 3, 5), (x + 3, 5), SUN)
                self.line(frame, (x, 2), (x, 8), SUN)
                self.disc(frame, (x, 5), 1, ORANGE)
            else:
                self.disc(frame, (x, 5), 2, SLATE, hollow=True)
        self.disc(frame, (5, 5), 4, VIOLET if g.tide % 2 else CYAN)
        if g.tide % 2:
            self.disc(frame, (7, 4), 3, ABYSS)
        else:
            self.line(frame, (2, 5), (8, 5), MIST)
            self.line(frame, (5, 2), (5, 8), MIST)
        self.disc(frame, (58, 5), 3, ORANGE, hollow=True)
        if g.reverse:
            self.line(frame, (61, 5), (56, 2), PEARL)
            self.line(frame, (56, 2), (57, 6), PEARL)
        else:
            self.line(frame, (55, 5), (60, 2), PEARL)
            self.line(frame, (60, 2), (59, 6), PEARL)
        for index in range(3):
            y = 20 + index * 8
            closed = index < g.seals
            self.disc(frame, (61, y), 3, RED if closed else SLATE, hollow=not closed)
            self.line(frame, (59, y + 2), (63, y - 2), PEARL if closed else MIST)
        for index in range(g.budget_max):
            x = 5 + index * 2
            remaining = index < g.budget_left
            frame[61:63, x] = CYAN if remaining else SLATE
            if remaining and index % 2 == 0:
                frame[60, x] = PEARL

    def moving_drop(self, frame, edge_index, reverse, progress, total, color=SUN):
        authored = self.game.level["edges"][edge_index]
        a = self.game.level["pos"][authored["a"]]
        b = self.game.level["pos"][authored["b"]]
        if reverse and not authored["oneway"]:
            a, b = b, a
        x, y = _curve_point(a, b, -authored["bend"] if reverse else authored["bend"], progress, total)
        self.disc(frame, (x, y), 3 if authored["amount"] == 2 else 2, color)
        self.disc(frame, (x, y), 1, PEARL)
        if authored["amount"] == 2:
            self.disc(frame, (x + 2, y - 2), 1, VIOLET)

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                for pos in g.level["pos"]:
                    self.disc(frame, pos, 10, CYAN, hollow=True)
            if g.terminal_hold == "win":
                for pos in g.level["pos"]:
                    self.disc(frame, pos, 10, GREEN, hollow=True)
            elif g.terminal_hold == "loss":
                self.line(frame, (8, 10), (56, 54), RED, dotted=True)
                self.line(frame, (56, 10), (8, 54), RED, dotted=True)
            return
        p, total = g.anim_progress, g.anim_total
        if g.anim_kind == "select":
            edge_index = g.pending_state[2]
            self.moving_drop(frame, edge_index, False, p, total, PEARL)
            authored = g.level["edges"][edge_index]
            a, b = g.level["pos"][authored["a"]], g.level["pos"][authored["b"]]
            for wake in range(max(0, p - 2), p):
                x, y = _curve_point(a, b, authored["bend"] + 2, wake, total)
                self.disc(frame, (x, y), 1, SUN)
        elif g.anim_kind == "reverse":
            edge_index = g.cursor
            self.moving_drop(frame, edge_index, False, p, total, FUCHSIA)
            self.moving_drop(frame, edge_index, True, p, total, PEARL)
        elif g.anim_kind == "pump":
            trace = g.anim_trace
            segment = min(len(trace) - 1, p * len(trace) // max(1, total + 1))
            local_start = segment * total // len(trace)
            local_end = max(local_start + 1, (segment + 1) * total // len(trace))
            local = min(local_end - local_start, max(0, p - local_start))
            edge_index, reverse = trace[segment]
            self.moving_drop(frame, edge_index, reverse, local, local_end - local_start)
            for completed in range(segment):
                authored = g.level["edges"][trace[completed][0]]
                destination = authored["a"] if trace[completed][1] else authored["b"]
                self.disc(frame, g.level["pos"][destination], 9, GREEN, hollow=True)
        elif g.anim_kind == "gate":
            authored = g.level["edges"][g.cursor]
            gate = _curve_point(g.level["pos"][authored["a"]], g.level["pos"][authored["b"]],
                                authored["bend"], 3, 8)
            self.disc(frame, gate, 3 + p, VIOLET, hollow=True)
            self.disc(frame, (5, 5), min(8, 3 + p), CYAN if g.tide % 2 else VIOLET, hollow=True)
        elif g.anim_kind in ("blocked", "seal"):
            authored = g.level["edges"][g.cursor]
            a, b = g.level["pos"][authored["a"]], g.level["pos"][authored["b"]]
            extent = min(p, max(0, total - p))
            x, y = _curve_point(a, b, authored["bend"], extent, max(1, total * 2))
            self.disc(frame, (x, y), 2, RED)
            self.disc(frame, (61, 20 + min(2, g.pending_state[5] - 1) * 8), 3 + p // 2, RED, hollow=True)
        elif g.anim_kind == "success":
            for index, pos in enumerate(g.level["pos"]):
                radius = 7 + (p + index) % 5
                self.disc(frame, pos, radius, GREEN, hollow=True)
            self.disc(frame, (32, 32), 4 + p * 3, CYAN, hollow=True)
        elif g.anim_kind == "loss":
            for pos in g.level["pos"]:
                self.disc(frame, pos, max(2, 9 - p), SLATE, hollow=True)
            self.line(frame, (7 + p, 9), (57 - p, 55), RED, dotted=True)
            self.line(frame, (57 - p, 9), (7 + p, 55), RED, dotted=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        self.background(frame)
        for index, authored in enumerate(g.level["edges"]):
            self.edge(frame, index, authored)
        target = g.level["targets"][min(g.stage, len(g.level["targets"]) - 1)]
        for index, (value, wanted, cap) in enumerate(zip(g.values, target, g.level["cap"])):
            self.node(frame, index, value, wanted, cap)
        self.hud(frame)
        self.animation(frame)
        return frame


class G511(ARCBaseGame):
    def __init__(self):
        self.display = G511A(self)
        self.level = LEVELS[0]
        self.values = ()
        self.tide = self.cursor = self.stage = self.seals = self.terminal = 0
        self.reverse = False
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_trace = ()
        self.pending_state = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("g511", levels, Camera(0, 0, 64, 64, ABYSS, ABYSS, [self.display]),
                         False, len(levels), [1, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        (self.values, self.tide, self.cursor, self.reverse, self.stage,
         self.seals, self.terminal) = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_trace = ()
        self.pending_state = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def begin(self, kind, frames, state, trace=(), terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.anim_trace = trace
        self.pending_state = state
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        (self.values, self.tide, self.cursor, self.reverse, self.stage,
         self.seals, self.terminal) = self.pending_state
        self.anim_kind = None
        self.anim_trace = ()
        self.pending_state = self.pending_terminal = None
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
                self.finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        before = (self.values, self.tide, self.cursor, self.reverse, self.stage,
                  self.seals, self.terminal)
        after = transition(self.level, before, action)
        self.budget_left -= action_cost(before, after)
        lost = after[-1] == 3 or (self.budget_left <= 0 and after[-1] != 2)
        if after[-1] == 2:
            self.begin("success", 7, after, terminal="win")
        elif lost:
            self.begin("loss", 7, after, terminal="loss")
        elif after[5] > before[5]:
            self.begin("seal", 6, after)
        elif action == 1:
            self.begin("reverse", 6, after)
        elif action in (3, 4):
            self.begin("select", 5, after)
        elif action == 5:
            _values, trace, result = pump_trace(self.level, before)
            self.begin("gate" if result == "gate" else "pump", 7 if len(trace) <= 1 else 8,
                       after, trace=trace)
        else:
            self.begin("seal", 6, after)
