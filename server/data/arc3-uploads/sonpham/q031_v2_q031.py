# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q031-v2 Cryogenic Manifold -- induce exact conserved-flow operators.

A dark glass transfer bench exposes every quantity, capacity, conduit direction,
movable bridge, phase filter, and linked-manifold consequence.  The player
selects a conduit and a machine, then composes exact, deterministic transfers.
"""

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, ASH, SLATE, STEEL, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, CYAN, GOLD, ORANGE, BROWN, GREEN, VIOLET = range(6, 16)

DRIP, FLUSH, SPLIT, SLIDE, BALANCE, PHASE, MANIFOLD, ROTOR = range(8)


RAW_LEVELS = [
    {
        "name": "Cold Start", "start": (4, 0, 0), "capacities": (4, 4, 4),
        "ops": (DRIP,), "directions": (1, 1), "bridge": False,
        "filter": False, "linked": False, "phase": 0,
        "solution": (5, 2, 5),
    },
    {
        "name": "Rated Chambers", "start": (6, 0, 0, 0),
        "capacities": (6, 2, 3, 4),
        "ops": (DRIP, FLUSH), "directions": (1, 1, 1), "bridge": False,
        "filter": False, "linked": False, "phase": 0,
        "solution": (4, 5, 2, 5, 2, 5),
    },
    {
        "name": "Sliding Coupler", "start": (5, 0, 0, 0),
        "capacities": (5, 5, 5, 5), "ops": (DRIP, SLIDE),
        "directions": (1, 1, 1), "bridge": True, "filter": False,
        "linked": False, "phase": 0,
        "solution": (5, 2, 4, 5, 3, 5, 4, 5, 3, 2, 5),
    },
    {
        "name": "Check-Valve Rack", "start": (0, 0, 8, 0),
        "capacities": (8, 8, 8, 8), "ops": (DRIP, SPLIT),
        "directions": (1, -1, 1), "bridge": False, "filter": False,
        "linked": False, "phase": 0,
        "solution": (2, 3, 5, 3, 5, 2, 5),
    },
    {
        "name": "Phase Interlock", "start": (4, 0, 0, 0),
        "capacities": (4, 4, 4, 4), "ops": (DRIP, PHASE, BALANCE),
        "directions": (1, 1, 1), "bridge": False, "filter": True,
        "linked": False, "phase": 0,
        "solution": (5, 2, 4, 5, 3, 5, 2, 4, 5, 3, 5),
    },
    {
        "name": "Mirrored Header", "start": (5, 0, 0, 0, 5),
        "capacities": (6, 6, 6, 6, 6),
        "ops": (MANIFOLD, BALANCE), "directions": (1, 1, -1, -1),
        "bridge": False, "filter": False, "linked": True, "phase": 0,
        "solution": (5, 5, 5, 2, 5, 5),
    },
    {
        "name": "Commissioning Run", "start": (8, 0, 0, 0, 0),
        "capacities": (8, 4, 3, 4, 4),
        "ops": (SPLIT, SLIDE, ROTOR, FLUSH), "directions": (1, 1, 1, -1),
        "bridge": True, "filter": False, "linked": False, "phase": 0,
        "solution": (5, 2, 4, 5, 3, 5, 2, 4, 5, 4, 5, 4, 5),
    },
    {
        "name": "Night Qualification", "start": (4, 0, 0, 0, 4),
        "capacities": (5, 3, 4, 3, 5),
        "ops": (MANIFOLD, PHASE, ROTOR, BALANCE),
        "directions": (1, 1, -1, -1), "bridge": False, "filter": True,
        "linked": True, "phase": 0,
        "solution": (5, 5, 1, 1, 5, 4, 5, 4, 5),
    },
]


def start_state(level):
    # conduit cursor, machine cursor, quantities, bridge position, phase,
    # two recoverable audit seals, terminal (0 live, 2 win, 3 loss)
    return (0, 0, tuple(level["start"]), 0, level["phase"], 2, 0)


def _edge_open(level, state, edge):
    if level["bridge"] and edge != state[3]:
        return False
    if level["filter"] and edge % 2 != state[4]:
        return False
    return True


def _oriented_pair(level, edge):
    if level["directions"][edge] > 0:
        return edge, edge + 1
    return edge + 1, edge


def _transfer(level, values, edge, amount=None):
    source, destination = _oriented_pair(level, edge)
    movable = values[source]
    room = level["capacities"][destination] - values[destination]
    count = min(movable, room) if amount is None else min(amount, movable, room)
    if count <= 0:
        return tuple(values)
    result = list(values); result[source] -= count; result[destination] += count
    return tuple(result)


def _apply_machine(level, state):
    channel, machine_cursor, values, bridge, phase, seals, terminal = state
    machine = level["ops"][machine_cursor]
    edges = len(values) - 1
    if machine == SLIDE:
        if not level["bridge"]:
            return state
        return (channel, machine_cursor, values, (bridge + 1) % edges,
                phase, seals, terminal)
    if machine == PHASE:
        if not level["filter"]:
            return state
        return (channel, machine_cursor, values, bridge, 1 - phase, seals, terminal)
    if machine == ROTOR:
        rotated = (values[-1],) + values[:-1]
        if any(value > capacity for value, capacity in zip(rotated, level["capacities"])):
            return state
        return (channel, machine_cursor, rotated, bridge, phase, seals, terminal)
    if not _edge_open(level, state, channel):
        return state
    if machine == DRIP:
        result = _transfer(level, values, channel, 1)
    elif machine == FLUSH:
        result = _transfer(level, values, channel)
    elif machine == SPLIT:
        source, destination = _oriented_pair(level, channel)
        if values[source] <= 0 or values[source] % 2 or values[destination] != 0:
            return state
        half = values[source] // 2
        if half > level["capacities"][destination]:
            return state
        result = list(values); result[source] = half; result[destination] = half
        result = tuple(result)
    elif machine == BALANCE:
        left, right = channel, channel + 1
        total = values[left] + values[right]
        low, high = total // 2, total - total // 2
        if level["directions"][channel] > 0:
            candidate = (low, high)
        else:
            candidate = (high, low)
        if candidate[0] > level["capacities"][left] or candidate[1] > level["capacities"][right]:
            return state
        result = list(values); result[left], result[right] = candidate
        result = tuple(result)
    elif machine == MANIFOLD:
        if not level["linked"]:
            return state
        mirror = edges - 1 - channel
        selected_edges = (channel,) if mirror == channel else (channel, mirror)
        deltas = [0] * len(values)
        for edge in selected_edges:
            source, destination = _oriented_pair(level, edge)
            deltas[source] -= 1; deltas[destination] += 1
        if any(values[index] + delta < 0 or
               values[index] + delta > level["capacities"][index]
               for index, delta in enumerate(deltas)):
            return state
        result = tuple(value + delta for value, delta in zip(values, deltas))
    else:
        return state
    if result == values:
        return state
    assert sum(result) == sum(values)
    return (channel, machine_cursor, result, bridge, phase, seals, terminal)


def configuration_solved(level, state):
    return (not state[6] and state[2] == level["target"]
            and (not level["bridge"] or state[3] == level["bridge_target"])
            and (not level["filter"] or state[4] == level["phase_target"]))


def transition(level, state, action):
    channel, machine, values, bridge, phase, seals, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 1:
        return ((channel - 1) % (len(values) - 1), machine, values,
                bridge, phase, seals, terminal)
    if action == 2:
        return ((channel + 1) % (len(values) - 1), machine, values,
                bridge, phase, seals, terminal)
    if action == 3:
        return (channel, (machine - 1) % len(level["ops"]), values,
                bridge, phase, seals, terminal)
    if action == 4:
        return (channel, (machine + 1) % len(level["ops"]), values,
                bridge, phase, seals, terminal)
    if action == 5:
        return _apply_machine(level, state)
    if configuration_solved(level, state):
        return state[:-1] + (2,)
    if seals > 1:
        return state[:5] + (seals - 1, 0)
    return state[:5] + (0, 3)


def action_cost(before, after):
    if before == after or before[5] != after[5] or after[6] in (2, 3):
        return 0
    return 1


def solved(_level, state):
    return state[6] == 2


def _finalize_levels():
    levels = []
    for raw in RAW_LEVELS:
        level = {key: deepcopy(value) for key, value in raw.items() if key != "solution"}
        state = start_state(level)
        for action in raw["solution"]:
            before = state; state = transition(level, state, action)
            assert state != before, (raw["name"], action, state)
            assert not state[6]
        assert state[2] != tuple(raw["start"])
        level["target"] = state[2]
        level["bridge_target"] = state[3]
        level["phase_target"] = state[4]
        level["budget"] = len(raw["solution"])
        level["solution"] = tuple(raw["solution"])
        assert configuration_solved(level, state)
        levels.append(level)
    return levels


LEVELS = _finalize_levels()


class ManifoldDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False, limit=100):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        last = min(steps, max(0, limit * steps // 100))
        for step in range(last + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
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

    def background(self, frame):
        frame[:, :] = INK
        for y in range(2, 52, 6):
            self.line(frame, (0, y), (63, y - 5), STEEL, dotted=True)
        for x in range(-12, 76, 12):
            self.line(frame, (x, 0), (x + 24, 48), SLATE, dotted=True)
        self.line(frame, (2, 18), (61, 18), BLUE)
        self.line(frame, (2, 49), (61, 49), CYAN)
        for x in range(4, 62, 8):
            self.diamond(frame, (x, 49), 1, STEEL)
        # Riveted asymmetric chassis corners keep the field instrument-like.
        for x, y in ((3, 3), (60, 3), (3, 46), (60, 46)):
            self.disc(frame, (x, y), 2, SLATE, hollow=True)
            self.diamond(frame, (x, y), 0, PEARL)

    @staticmethod
    def vessel_positions(n):
        spacing = 11 if n == 5 else 13
        left = 32 - spacing * (n - 1) // 2
        return tuple(left + spacing * index for index in range(n))

    def glass_vessel(self, frame, x, value, capacity, target=False):
        top, bottom = (7, 16) if target else (23, 45)
        half = 3 if target else 4
        color = VIOLET if target else CYAN
        # Chamfered glass rather than a rectangular tank.
        self.line(frame, (x - half + 1, top), (x + half - 1, top), BLUE)
        self.line(frame, (x - half + 1, top), (x - half, top + 2), BLUE)
        self.line(frame, (x - half, top + 2), (x - half + 1, bottom - 2), BLUE)
        self.line(frame, (x - half + 1, bottom - 2), (x - half + 2, bottom), BLUE)
        self.line(frame, (x - half + 2, bottom), (x + half - 2, bottom), BLUE)
        self.line(frame, (x + half - 2, bottom), (x + half - 1, bottom - 2), BLUE)
        self.line(frame, (x + half - 1, bottom - 2), (x + half, top + 2), BLUE)
        self.line(frame, (x + half, top + 2), (x + half - 1, top), BLUE)
        span = bottom - top - 3
        cap_y = bottom - max(1, span * capacity // 8)
        self.line(frame, (x - half + 1, cap_y), (x + half - 1, cap_y), GOLD, dotted=True)
        if target:
            fill_y = bottom - max(0, span * value // 8)
            self.line(frame, (x - half + 1, fill_y), (x + half - 1, fill_y), VIOLET)
            for unit in range(value):
                y = bottom - 1 - unit
                if y > top:
                    frame[y, x] = VIOLET
        else:
            for unit in range(value):
                y = bottom - 2 - unit * 2
                if y > top:
                    self.diamond(frame, (x, y), 1, color, hollow=unit % 2 == 1)
            fill_y = bottom - max(0, span * value // 8)
            self.line(frame, (x - half + 2, fill_y), (x + half - 2, fill_y), WHITE)

    def conduits(self, frame, state):
        level = self.game.level; xs = self.vessel_positions(len(state[2]))
        for edge in range(len(xs) - 1):
            left, right = xs[edge], xs[edge + 1]; y = 35
            open_edge = _edge_open(level, state, edge)
            color = CYAN if open_edge else SLATE
            self.line(frame, (left + 5, y), (right - 5, y), color,
                      dotted=not open_edge)
            direction = level["directions"][edge]
            tip = (right - 5 if direction > 0 else left + 5, y)
            wing = -2 if direction > 0 else 2
            self.line(frame, tip, (tip[0] + wing, y - 2), color)
            self.line(frame, tip, (tip[0] + wing, y + 2), color)
            if level["filter"]:
                mark = GOLD if edge % 2 == state[4] else STEEL
                for dx in (-2, 0, 2):
                    self.line(frame, ((left + right) // 2 + dx, 20),
                              ((left + right) // 2 + dx - 1, 22), mark)
        if level["bridge"]:
            edge = state[3]; center = (xs[edge] + xs[edge + 1]) // 2
            self.line(frame, (center - 4, 31), (center, 27), WHITE)
            self.line(frame, (center, 27), (center + 4, 31), WHITE)
            self.line(frame, (center - 4, 31), (center + 4, 31), BLUE)
        selected = state[0]; center = (xs[selected] + xs[selected + 1]) // 2
        for dx in (-4, 4):
            self.line(frame, (center + dx, 38), (center + dx // 2, 41), WHITE)
            self.line(frame, (center + dx // 2, 41), (center, 41), WHITE)
        if level["linked"]:
            mirror = len(xs) - 2 - selected
            mirror_center = (xs[mirror] + xs[mirror + 1]) // 2
            self.line(frame, (center, 20), (32, 19), MAGENTA, dotted=True)
            self.line(frame, (32, 19), (mirror_center, 20), MAGENTA, dotted=True)
            self.diamond(frame, (32, 19), 2, MAGENTA, hollow=True)

    def target_topology(self, frame):
        """Pair live topology controls with a compact violet blueprint above."""
        level = self.game.level; xs = self.vessel_positions(len(level["target"]))
        if level["bridge"]:
            edge = level["bridge_target"]
            center = (xs[edge] + xs[edge + 1]) // 2
            self.line(frame, (center - 3, 16), (center, 12), VIOLET)
            self.line(frame, (center, 12), (center + 3, 16), VIOLET)
            self.line(frame, (center - 3, 16), (center + 3, 16), VIOLET)
        if level["filter"]:
            for edge in range(len(xs) - 1):
                if edge % 2 != level["phase_target"]:
                    continue
                center = (xs[edge] + xs[edge + 1]) // 2
                self.line(frame, (center - 2, 11), (center - 1, 14), VIOLET)
                self.line(frame, (center + 1, 11), (center + 2, 14), VIOLET)

    def machine_icon(self, frame, center, machine, color):
        x, y = center
        if machine == DRIP:
            self.diamond(frame, (x, y - 1), 3, color, hollow=True)
            self.line(frame, (x, y + 2), (x, y + 4), color)
        elif machine == FLUSH:
            self.line(frame, (x - 4, y - 2), (x + 4, y - 2), color)
            self.line(frame, (x - 4, y - 2), (x, y + 4), color)
            self.line(frame, (x + 4, y - 2), (x, y + 4), color)
        elif machine == SPLIT:
            self.line(frame, (x, y - 4), (x, y), color)
            self.line(frame, (x, y), (x - 4, y + 3), color)
            self.line(frame, (x, y), (x + 4, y + 3), color)
            self.diamond(frame, (x, y - 4), 1, color)
        elif machine == SLIDE:
            self.line(frame, (x - 5, y), (x + 5, y), color)
            self.diamond(frame, (x - 2, y), 2, color, hollow=True)
        elif machine == BALANCE:
            self.line(frame, (x - 5, y + 3), (x + 5, y + 3), color)
            self.line(frame, (x, y - 4), (x, y + 3), color)
            self.diamond(frame, (x - 3, y), 2, color, hollow=True)
            self.diamond(frame, (x + 3, y), 2, color, hollow=True)
        elif machine == PHASE:
            self.diamond(frame, (x - 2, y), 3, color, hollow=True)
            self.diamond(frame, (x + 2, y), 3, color, hollow=True)
        elif machine == MANIFOLD:
            self.line(frame, (x - 5, y - 3), (x - 2, y), color)
            self.line(frame, (x - 2, y), (x - 5, y + 3), color)
            self.line(frame, (x + 5, y - 3), (x + 2, y), color)
            self.line(frame, (x + 2, y), (x + 5, y + 3), color)
            self.diamond(frame, (x, y), 1, color)
        else:
            self.disc(frame, center, 4, color, hollow=True)
            self.line(frame, (x + 1, y - 4), (x + 4, y - 2), color)
            self.line(frame, (x + 4, y - 2), (x + 2, y), color)

    @staticmethod
    def machine_positions(count):
        spacing = 14 if count == 4 else 16
        left = 32 - spacing * (count - 1) // 2
        return tuple((left + spacing * index, 57) for index in range(count))

    def console(self, frame, state):
        positions = self.machine_positions(len(self.game.level["ops"]))
        for index, (center, machine) in enumerate(zip(positions, self.game.level["ops"])):
            color = WHITE if index == state[1] else STEEL
            self.machine_icon(frame, center, machine, color)
            if index == state[1]:
                x, y = center
                self.line(frame, (x - 6, y - 5), (x - 4, y - 5), CYAN)
                self.line(frame, (x - 6, y - 5), (x - 6, y - 3), CYAN)
                self.line(frame, (x + 6, y + 5), (x + 4, y + 5), CYAN)
                self.line(frame, (x + 6, y + 5), (x + 6, y + 3), CYAN)

    def hud(self, frame):
        game = self.game
        shown = game.budget_left
        if (game.anim_kind and game.pending_budget is not None
                and game.anim_progress >= max(1, game.anim_total - 1)
                and game.anim_kind != "success"):
            shown = game.pending_budget
        for unit in range(game.budget_max):
            x = 7 + (unit % 9) * 3; y = 3 + (unit // 9) * 3
            color = CYAN if unit < shown else STEEL
            if unit < shown:
                self.diamond(frame, (x, y), 1, color)
            else:
                self.line(frame, (x - 1, y), (x + 1, y), color)
        for index, x in enumerate((55, 61)):
            live = index < self.game.state[5]
            self.diamond(frame, (x, 4), 3, VIOLET if live else RED, hollow=True)
            if live:
                self.line(frame, (x, 2), (x, 6), WHITE)
            else:
                self.line(frame, (x - 2, 2), (x + 2, 6), RED)
                self.line(frame, (x + 2, 2), (x - 2, 6), RED)

    def apparatus(self, frame):
        state = self.game.state; level = self.game.level
        xs = self.vessel_positions(len(state[2]))
        for x, target, capacity in zip(xs, level["target"], level["capacities"]):
            self.glass_vessel(frame, x, target, capacity, target=True)
        self.target_topology(frame)
        for x, value, capacity in zip(xs, state[2], level["capacities"]):
            self.glass_vessel(frame, x, value, capacity)
        self.conduits(frame, state); self.console(frame, state); self.hud(frame)

    def animation(self, frame):
        game = self.game
        if game.intro_mark:
            for radius in (3, 6, 9):
                self.diamond(frame, (32, 34), radius, BLUE, hollow=True)
        if not game.anim_kind:
            return
        p = game.anim_progress; span = max(1, game.anim_total - 1)
        before, after = game.anim_before, game.pending_state
        xs = self.vessel_positions(len(before[2]))
        if game.anim_kind == "channel" and p < span:
            a = (xs[before[0]] + xs[before[0] + 1]) // 2
            b = (xs[after[0]] + xs[after[0] + 1]) // 2
            x = a + (b - a) * p // span
            self.diamond(frame, (x, 41), 3, WHITE, hollow=True)
        elif game.anim_kind == "machine" and p < span:
            positions = self.machine_positions(len(game.level["ops"]))
            a, b = positions[before[1]], positions[after[1]]
            point = (a[0] + (b[0] - a[0]) * p // span, a[1])
            self.diamond(frame, point, 5, CYAN, hollow=True)
        elif game.anim_kind == "execute" and p < span:
            machine = game.level["ops"][before[1]]
            if machine == SLIDE:
                old = (xs[before[3]] + xs[before[3] + 1]) // 2
                new = (xs[after[3]] + xs[after[3] + 1]) // 2
                x = old + (new - old) * p // span
                self.line(frame, (x - 4, 30), (x, 26), WHITE)
                self.line(frame, (x, 26), (x + 4, 30), WHITE)
            elif machine == PHASE:
                for edge in range(len(xs) - 1):
                    if edge % 2 == after[4]:
                        center = (xs[edge] + xs[edge + 1]) // 2
                        self.diamond(frame, (center, 21), 1 + p * 2 // span,
                                     GOLD, hollow=True)
            elif machine == ROTOR:
                angle = 2 * math.pi * p / max(1, span)
                point = (32 + round(12 * math.cos(angle)), 34 + round(8 * math.sin(angle)))
                self.diamond(frame, point, 2, WHITE, hollow=True)
                self.line(frame, (32, 34), point, CYAN, dotted=True)
            else:
                changed = [i for i, (a, b) in enumerate(zip(before[2], after[2])) if a != b]
                for index in changed:
                    source = (xs[index], 34); destination = (xs[index], 25)
                    amount = p * 100 // span
                    self.line(frame, source, destination, WHITE, dotted=True, limit=amount)
                    y = source[1] + (destination[1] - source[1]) * amount // 100
                    self.diamond(frame, (xs[index], y), 2, CYAN, hollow=True)
        elif game.anim_kind == "audit" and p < span:
            x = 5 + 54 * p // span
            self.line(frame, (x, 7), (x, 46), GOLD, dotted=True)
        elif game.anim_kind == "blocked" and p < span:
            folded = min(p, span - p)
            center = (xs[before[0]] + xs[before[0] + 1]) // 2
            self.diamond(frame, (center, 35), 3 + folded, RED, hollow=True)
        elif game.anim_kind == "success":
            for index, x in enumerate(xs):
                if index <= p:
                    self.diamond(frame, (x, 34), 5, GREEN, hollow=True)
            for radius in range(5, min(31, 5 + p * 4), 6):
                self.diamond(frame, (32, 34), radius, CYAN, hollow=True)
        elif game.anim_kind == "loss" and p < span:
            inset = 26 * p // span
            self.line(frame, (2 + inset, 4), (2 + inset, 47), RED)
            self.line(frame, (61 - inset, 4), (61 - inset, 47), RED)
            for y in range(8, 47, 6):
                self.line(frame, (2 + inset, y), (61 - inset, y + 3), STEEL)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game
        preview = (game.anim_kind in ("channel", "machine", "execute", "audit", "blocked", "loss")
                   and game.pending_state is not None
                   and game.anim_progress >= max(1, game.anim_total - 1))
        current = game.state
        if preview:
            game.state = game.pending_state
        self.background(frame); self.apparatus(frame)
        if preview:
            game.state = current
        self.animation(frame)
        return frame


class Q031(ARCBaseGame):
    def __init__(self):
        self.display = ManifoldDisplay(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level), name=level["name"])
                  for level in LEVELS]
        super().__init__("q031", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]),
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
        self.intro_mark = False; before = self.state
        after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, before, self.budget_left); return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:-1] + (3,)
            self.begin("loss", 7, before, lost, self.budget_left, "loss"); return
        budget = self.budget_left - cost
        if after[6] == 2:
            kind, frames, terminal = "success", 7, "win"
        elif after[6] == 3:
            kind, frames, terminal = "loss", 7, "loss"
        elif action in (1, 2):
            kind, frames, terminal = "channel", 5, None
        elif action in (3, 4):
            kind, frames, terminal = "machine", 5, None
        elif action == 5:
            kind, frames, terminal = "execute", 7, None
        else:
            kind, frames, terminal = "audit", 6, None
        self.begin(kind, frames, before, after, budget, terminal)
