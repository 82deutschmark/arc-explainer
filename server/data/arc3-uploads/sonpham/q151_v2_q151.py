# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q151-v2 Daywind Ribbon Atlas.

Transfer highlighted source-graph roles into an independently embedded paper
fiber network.  Correct ties persist as stitched correspondences; a wrong tie
or premature launch gives one free diagnostic rewind and a finite second loss.
Only a complete structural transfer lets one wind action cascade through the
whole destination route.

The pure helpers expose structural role signatures, transfer progress, large
consequence size, two causal counterfactuals, and recording action encoding.
"""

from __future__ import annotations

from copy import deepcopy
import math
from typing import NamedTuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, PEARL, FOG, GRAPHITE, CHARCOAL, INK = 0, 1, 2, 3, 4, 5
CORAL, ROSE, RED, SKY, GLASS, SUN = 6, 7, 8, 9, 10, 11
ORANGE, PLUM, LEAF, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
ROLE_ACTIONS = (1, 2)
DESTINATION_ACTIONS = (3, 4)
TIE_ACTION = 5
CASCADE_ACTION = 6


class State(NamedTuple):
    bound_roles: int
    role_cursor: int
    destination_cursor: int
    cascade_count: int
    cascade_used: int
    strikes: int
    rewind_role: int
    rewind_destination: int
    last_event: int
    terminal: int


TERMINAL_INDEX = 9


def _navigate(current, target, size, previous_action, next_action):
    backward = (current - target) % size
    forward = (target - current) % size
    if backward <= forward:
        return (previous_action,) * backward
    return (next_action,) * forward


def _embedding(order, offsets, base_y):
    count = len(order)
    points = [None] * count
    for column, node in enumerate(order):
        x = 6 if count == 1 else 6 + round(51 * column / (count - 1))
        points[node] = (x, base_y + offsets[column])
    return tuple(points)


def atlas(name, edges, source_path, mapping, source_offsets,
          destination_order, destination_offsets, role_start,
          destination_start, solution, curriculum):
    node_count = len(mapping)
    mapping = tuple(int(item) for item in mapping)
    assert sorted(mapping) == list(range(node_count))
    source_path = tuple(int(item) for item in source_path)
    source_edges = tuple(tuple(sorted(edge)) for edge in edges)
    destination_edges = tuple(
        tuple(sorted((mapping[a], mapping[b]))) for a, b in source_edges)
    source_positions = _embedding(tuple(range(node_count)), source_offsets, 17)
    destination_positions = _embedding(
        destination_order, destination_offsets, 44)

    actions = []
    role_cursor = int(role_start)
    destination_cursor = int(destination_start)
    for role_index in solution:
        actions.extend(_navigate(
            role_cursor, role_index, len(source_path), 1, 2))
        role_cursor = role_index
        target = mapping[source_path[role_index]]
        actions.extend(_navigate(
            destination_cursor, target, node_count, 3, 4))
        destination_cursor = target
        actions.append(5)
    actions.append(6)
    return {
        "name": name,
        "node_count": node_count,
        "source_edges": source_edges,
        "destination_edges": destination_edges,
        "source_path": source_path,
        "mapping": mapping,
        "source_positions": source_positions,
        "destination_positions": destination_positions,
        "role_start": int(role_start),
        "destination_start": int(destination_start),
        "solution": tuple(int(item) for item in solution),
        "large_consequence": len(source_path),
        "budget": len(actions),
        "witness": tuple(actions),
        "curriculum": tuple(curriculum),
    }


LEVELS = (
    atlas(
        "First Tailwind",
        ((0, 1), (1, 2)), (0, 1, 2), (2, 0, 1),
        (0, -5, 2), (1, 2, 0), (3, -4, 1),
        0, 0, (1, 0, 2),
        ("paired-embodiments", "role-ties", "whole-route-cascade"),
    ),
    atlas(
        "Forked Pennant",
        ((0, 1), (1, 2), (1, 3)), (0, 1, 2), (1, 3, 0, 2),
        (2, -5, 3, -1), (2, 0, 3, 1), (-4, 2, -2, 4),
        2, 3, (1, 2, 0),
        ("branch-role", "independent-permutation", "diagnostic-rewind"),
    ),
    atlas(
        "Looping Kites",
        ((0, 1), (0, 2), (1, 3), (2, 3), (3, 4), (1, 4)),
        (0, 1, 3, 4), (3, 0, 4, 1, 2),
        (1, -6, 5, -2, 3), (4, 1, 3, 0, 2), (-5, 4, -1, 3, -3),
        1, 4, (1, 2, 3, 0),
        ("cycle-role", "nonmatching-geometry", "four-role-transfer"),
    ),
    atlas(
        "Bent Estuary",
        ((0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (4, 5)),
        (0, 2, 4, 5), (2, 5, 1, 4, 0, 3),
        (4, -5, 0, -7, 5, -1), (3, 0, 5, 1, 4, 2),
        (-6, 3, -2, 5, -4, 1),
        3, 5, (2, 1, 0, 3),
        ("bent-route", "degree-and-neighbor-role", "cascade-preview"),
    ),
    atlas(
        "Crosswind Orchard",
        ((0, 1), (0, 2), (1, 3), (2, 3), (2, 4), (3, 5), (4, 5)),
        (0, 2, 4, 5), (4, 1, 5, 0, 3, 2),
        (0, -7, 4, -2, 6, -4), (2, 5, 1, 4, 0, 3),
        (5, -3, 2, -6, 4, -1),
        0, 2, (3, 2, 0, 1),
        ("crossing-inhibition", "structural-not-geometric-match",
         "four-role-cascade"),
    ),
    atlas(
        "Seven-Reed Delta",
        ((0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (3, 5),
         (4, 6), (5, 6)),
        (0, 1, 3, 5, 6), (5, 2, 6, 0, 4, 1, 3),
        (3, -6, 5, -2, 6, -5, 1), (4, 1, 6, 0, 5, 2, 3),
        (-6, 4, -2, 5, -4, 2, -1),
        4, 6, (0, 4, 3, 2, 1),
        ("seven-node-role-transfer", "five-stitch-plan",
         "large-network-cascade"),
    ),
    atlas(
        "Eight-Sail Weave",
        ((0, 1), (0, 2), (1, 3), (2, 4), (3, 5), (4, 5),
         (4, 6), (5, 7), (6, 7)),
        (0, 2, 4, 6, 7), (6, 1, 4, 7, 0, 5, 2, 3),
        (1, -7, 5, -3, 6, -5, 3, -1),
        (5, 2, 7, 1, 6, 0, 4, 3), (-6, 5, -2, 6, -4, 3, -5, 1),
        2, 7, (2, 3, 4, 1, 0),
        ("eight-node-field", "crossing-decoys", "five-role-composition",
         "whole-network-cascade"),
    ),
    atlas(
        "Daywind Ribbon Atlas",
        ((0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (3, 5),
         (4, 6), (5, 7), (6, 7), (2, 6)),
        (0, 1, 3, 5, 7), (4, 7, 1, 5, 0, 2, 6, 3),
        (4, -6, 2, -7, 6, -3, 4, -1),
        (3, 6, 1, 7, 0, 5, 2, 4), (-5, 3, -7, 5, -2, 6, -4, 1),
        1, 6, (1, 2, 0, 4, 3),
        ("eight-node-synthesis", "independent-embodiments",
         "five-role-transfer", "diagnostic-rewind",
         "large-consequence-tailwind"),
    ),
)


def action_tokens(_level):
    return (1, 2, 3, 4, 5, 6)


def encode_action(_level, action):
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    return (aid,)


def start_state(level):
    return State(
        0, level["role_start"], level["destination_start"],
        0, 0, 0, -1, -1, 0, ACTIVE,
    )


def _adjacency(edges, node_count):
    result = [[] for _ in range(node_count)]
    for a, b in edges:
        result[a].append(b)
        result[b].append(a)
    return tuple(tuple(sorted(items)) for items in result)


def _distances(adjacency, start):
    values = [-1] * len(adjacency)
    values[start] = 0
    frontier = [start]
    for node in frontier:
        for neighbor in adjacency[node]:
            if values[neighbor] < 0:
                values[neighbor] = values[node] + 1
                frontier.append(neighbor)
    return tuple(values)


def role_signature(level, state_or_node):
    """Return a non-positional rooted graph signature for a source role.

    ``State`` selects its current source-path role.  An integer names a source
    node.  ``("destination", node)`` names a destination node, allowing an
    evaluator to compare corresponding signatures across embodiments.
    """
    destination = False
    if isinstance(state_or_node, State):
        node = level["source_path"][state_or_node.role_cursor]
    elif isinstance(state_or_node, (tuple, list)):
        destination = str(state_or_node[0]).lower().startswith("d")
        node = int(state_or_node[1])
    else:
        node = int(state_or_node)
    edges = (level["destination_edges"] if destination
             else level["source_edges"])
    adjacency = _adjacency(edges, level["node_count"])
    start = (level["mapping"][level["source_path"][0]] if destination
             else level["source_path"][0])
    goal = (level["mapping"][level["source_path"][-1]] if destination
            else level["source_path"][-1])
    distances = _distances(adjacency, node)
    degree_profile = tuple(sorted(
        (distances[index], len(adjacency[index]))
        for index in range(level["node_count"])))
    return (
        len(adjacency[node]),
        tuple(sorted(len(adjacency[n]) for n in adjacency[node])),
        _distances(adjacency, start)[node],
        _distances(adjacency, goal)[node],
        degree_profile,
    )


def expected_destination(level, role_index):
    return level["mapping"][level["source_path"][int(role_index)]]


def transfer_progress(_level, state):
    return state.bound_roles.bit_count()


def transfer_complete(level, state):
    return transfer_progress(level, state) == len(level["source_path"])


def large_consequence_count(_level, before, action, after):
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    if aid != CASCADE_ACTION:
        return 0
    return max(0, after.cascade_count - before.cascade_count)


def solved(_level, state):
    return state.terminal == WIN


def _strike(level, state, event, destination=-1):
    strikes = state.strikes + 1
    missing = (state.role_cursor if event == TIE_ACTION else next(
        (index for index in range(len(level["source_path"]))
         if not state.bound_roles & (1 << index)),
        state.role_cursor,
    ))
    return state._replace(
        strikes=strikes,
        rewind_role=missing,
        rewind_destination=int(destination),
        last_event=event,
        terminal=LOSS if strikes >= 2 else ACTIVE,
    )


def _transition(level, state, action, mode="normal"):
    if state.terminal != ACTIVE:
        return state
    aid = int(action[0]) if isinstance(action, (tuple, list)) else int(action)
    if aid not in action_tokens(level):
        return state

    if aid in ROLE_ACTIONS:
        delta = -1 if aid == 1 else 1
        cursor = (state.role_cursor + delta) % len(level["source_path"])
        return state._replace(
            role_cursor=cursor,
            rewind_role=-1,
            rewind_destination=-1,
            last_event=aid,
        )

    if aid in DESTINATION_ACTIONS:
        delta = -1 if aid == 3 else 1
        cursor = (state.destination_cursor + delta) % level["node_count"]
        return state._replace(
            destination_cursor=cursor,
            rewind_role=-1,
            rewind_destination=-1,
            last_event=aid,
        )

    if aid == TIE_ACTION:
        bit = 1 << state.role_cursor
        if state.bound_roles & bit:
            return state
        expected = expected_destination(level, state.role_cursor)
        if state.destination_cursor != expected:
            return _strike(
                level, state, TIE_ACTION, state.destination_cursor)
        if mode == "without_role_transfer":
            return state._replace(
                rewind_role=state.role_cursor,
                rewind_destination=state.destination_cursor,
                last_event=TIE_ACTION,
            )
        return state._replace(
            bound_roles=state.bound_roles | bit,
            rewind_role=-1,
            rewind_destination=-1,
            last_event=TIE_ACTION,
        )

    if not transfer_complete(level, state):
        return _strike(level, state, CASCADE_ACTION)
    if state.cascade_used:
        return state
    if mode == "without_large_consequence":
        return state._replace(
            cascade_count=1,
            cascade_used=1,
            last_event=CASCADE_ACTION,
        )
    return state._replace(
        cascade_count=level["large_consequence"],
        cascade_used=1,
        last_event=CASCADE_ACTION,
        terminal=WIN,
    )


def transition(level, state, action):
    return _transition(level, state, action, "normal")


def without_large_consequence(level, state, action):
    return _transition(level, state, action, "without_large_consequence")


def without_role_transfer(level, state, action):
    return _transition(level, state, action, "without_role_transfer")


def action_cost(before, after):
    if before == after:
        return 0
    if after.strikes > before.strikes:
        return 0
    return 1


def execute(level, actions, transition_fn=transition):
    state = start_state(level)
    budget = level["budget"]
    for action in actions:
        after = transition_fn(level, state, action)
        budget -= action_cost(state, after)
        state = after
    return state, budget


for _level in LEVELS:
    _end, _left = execute(_level, _level["witness"])
    assert solved(_level, _end) and _left == 0, (_level["name"], _end, _left)
    for _role in range(len(_level["source_path"])):
        _source = _level["source_path"][_role]
        _destination = expected_destination(_level, _role)
        assert role_signature(_level, _source) == role_signature(
            _level, ("destination", _destination))


class AtlasDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def pixel(frame, x, y, color):
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color

    @classmethod
    def line(cls, frame, start, end, color, dotted=False, width=1):
        x0, y0 = start
        x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 4 in (1, 2):
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            for offset in range(width):
                cls.pixel(frame, x, y + offset, color)

    @classmethod
    def disc(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        inner = max(0, radius - 1) ** 2
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
                    cls.pixel(frame, x, y, color)

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            reach = radius - abs(dy)
            if hollow:
                cls.pixel(frame, cx - reach, cy + dy, color)
                cls.pixel(frame, cx + reach, cy + dy, color)
            else:
                for x in range(cx - reach, cx + reach + 1):
                    cls.pixel(frame, x, cy + dy, color)

    @classmethod
    def triangle(cls, frame, center, radius, color, invert=False,
                 hollow=False):
        cx, cy = center
        for step in range(radius + 1):
            reach = step
            y = cy + (radius - step if invert else step - radius)
            if hollow:
                cls.pixel(frame, cx - reach, y, color)
                cls.pixel(frame, cx + reach, y, color)
            else:
                for x in range(cx - reach, cx + reach + 1):
                    cls.pixel(frame, x, y, color)

    def background(self, frame):
        frame[:, :] = PAPER
        frame[5:29, :] = GLASS
        frame[33:56, :] = PEARL
        for x in range(0, 64, 8):
            self.line(frame, (x, 30 + (x // 8) % 2),
                      (min(63, x + 5), 30), SKY, dotted=True)
        for x, y in ((3, 9), (18, 27), (40, 8), (59, 25), (9, 48), (51, 40)):
            self.pixel(frame, x, y, FOG)

    def graph(self, frame, edges, positions, color, highlighted=()):
        marked = {frozenset(edge) for edge in highlighted}
        for a, b in edges:
            edge = frozenset((a, b))
            edge_color = SUN if edge in marked else color
            self.line(frame, positions[a], positions[b], edge_color,
                      dotted=edge not in marked, width=2 if edge in marked else 1)
            if edge in marked:
                midpoint = ((positions[a][0] + positions[b][0]) // 2,
                            (positions[a][1] + positions[b][1]) // 2)
                self.diamond(frame, midpoint, 1, PAPER)

    def node(self, frame, point, degree, color, role_mark=False,
             bound=False):
        if degree <= 1:
            self.triangle(frame, point, 3, color, hollow=True)
        elif degree == 2:
            self.diamond(frame, point, 3, color, hollow=True)
        elif degree == 3:
            self.disc(frame, point, 3, color, hollow=True)
        else:
            x, y = point
            self.line(frame, (x - 3, y), (x + 3, y), color, width=2)
            self.line(frame, (x, y - 3), (x, y + 3), color, width=2)
        if role_mark:
            self.pixel(frame, point[0], point[1], INK)
        if bound:
            x, y = point
            self.line(frame, (x - 2, y - 2), (x + 2, y + 2), CORAL)
            self.line(frame, (x + 2, y - 2), (x - 2, y + 2), CORAL)

    def field(self, frame, state):
        level = self.game.level
        source_adjacency = _adjacency(
            level["source_edges"], level["node_count"])
        destination_adjacency = _adjacency(
            level["destination_edges"], level["node_count"])
        path_edges = tuple(zip(level["source_path"], level["source_path"][1:]))
        self.graph(frame, level["source_edges"], level["source_positions"],
                   SKY, path_edges)
        self.graph(frame, level["destination_edges"],
                   level["destination_positions"], GRAPHITE)
        for node, point in enumerate(level["source_positions"]):
            self.node(frame, point, len(source_adjacency[node]),
                      SUN if node in level["source_path"] else SKY,
                      role_mark=node in level["source_path"])
        for node, point in enumerate(level["destination_positions"]):
            bound = any(
                state.bound_roles & (1 << role)
                and expected_destination(level, role) == node
                for role in range(len(level["source_path"])))
            self.node(frame, point, len(destination_adjacency[node]),
                      LEAF if bound else GRAPHITE, bound=bound)

        source_node = level["source_path"][state.role_cursor]
        source_point = level["source_positions"][source_node]
        destination_point = level["destination_positions"][
            state.destination_cursor]
        self.disc(frame, source_point, 5, INK, hollow=True)
        self.diamond(frame, destination_point, 5, VIOLET, hollow=True)

        for role in range(len(level["source_path"])):
            if not state.bound_roles & (1 << role):
                continue
            a = level["source_positions"][level["source_path"][role]]
            b = level["destination_positions"][expected_destination(level, role)]
            self.line(frame, a, (a[0], 30), CORAL, dotted=True)
            self.line(frame, (a[0], 30), (b[0], 32), CORAL, dotted=True)
            self.line(frame, (b[0], 32), b, CORAL, dotted=True)

        start_destination = expected_destination(level, 0)
        goal_destination = expected_destination(
            level, len(level["source_path"]) - 1)
        self.triangle(frame, level["destination_positions"][start_destination],
                      5, SKY, hollow=True)
        self.disc(frame, level["destination_positions"][goal_destination],
                  5, SUN, hollow=True)

    def hud(self, frame, state):
        game = self.game
        # Non-text control legend in the paper horizon: paired round arrows
        # select source roles (1/2), paired diamond arrows select destination
        # nodes (3/4), a vertical stitch ties (5), and a wind star launches (6).
        frame[28:33, 37:64] = PAPER
        self.disc(frame, (41, 30), 2, INK, hollow=True)
        self.pixel(frame, 38, 30, INK)
        self.pixel(frame, 44, 30, INK)
        self.diamond(frame, (49, 30), 2, VIOLET, hollow=True)
        self.pixel(frame, 46, 30, VIOLET)
        self.pixel(frame, 52, 30, VIOLET)
        self.disc(frame, (56, 29), 1, INK, hollow=True)
        self.diamond(frame, (56, 32), 1, VIOLET, hollow=True)
        self.line(frame, (56, 29), (56, 32), CORAL, dotted=True)
        self.line(frame, (59, 30), (63, 30), SUN)
        self.line(frame, (61, 28), (61, 32), SUN)
        self.diamond(frame, (61, 30), 1, SKY)
        # One leaf-shaped diamond per exact remaining action.
        for index in range(game.budget_max):
            row, column = divmod(index, 20)
            center = (3 + column * 3, 59 + row * 3)
            self.diamond(frame, center, 1,
                         SUN if index < game.budget_left else FOG,
                         hollow=index >= game.budget_left)
        # Route roles are exact countable pennants; stitched roles turn solid.
        count = len(game.level["source_path"])
        for role in range(count):
            x = 4 + role * 5
            self.triangle(frame, (x, 3), 1,
                          LEAF if state.bound_roles & (1 << role) else GRAPHITE,
                          hollow=not bool(state.bound_roles & (1 << role)))
        # Paired diagnostic seals expose free first rewind and finite second loss.
        for index, y in enumerate((42, 49)):
            cracked = index < state.strikes
            self.disc(frame, (61, y), 2, RED if cracked else SKY,
                      hollow=not cracked)
            if cracked:
                self.line(frame, (60, y - 1), (62, y + 1), PAPER)

    def animation(self, frame, state):
        game = self.game
        if not game.anim_kind:
            return
        before = game.state
        after = game.pending_state
        p = game.anim_progress
        span = max(1, game.anim_total - 1)
        wave = min(p, span - p)
        level = game.level
        if game.anim_kind in ("role_cursor", "destination_cursor"):
            if game.anim_kind == "role_cursor":
                points = level["source_positions"]
                old = level["source_path"][before.role_cursor]
                new = level["source_path"][after.role_cursor]
            else:
                points = level["destination_positions"]
                old = before.destination_cursor
                new = after.destination_cursor
            a, b = points[old], points[new]
            moving = (a[0] + (b[0] - a[0]) * p // span,
                      a[1] + (b[1] - a[1]) * p // span)
            self.line(frame, a, moving, CORAL, dotted=True)
            self.diamond(frame, moving, 2 + wave // 2, SUN)
        elif game.anim_kind == "tie":
            a = level["source_positions"][
                level["source_path"][before.role_cursor]]
            b = level["destination_positions"][before.destination_cursor]
            midpoint = (a[0] + (b[0] - a[0]) * p // span,
                        a[1] + (b[1] - a[1]) * p // span)
            self.line(frame, a, midpoint, CORAL, dotted=p % 2 == 0, width=2)
            self.disc(frame, midpoint, 2 + wave // 2, SUN, hollow=True)
        elif game.anim_kind == "diagnostic":
            offset = (-2, 2, -1, 1, 0, 1, 0)[min(p, 6)]
            self.line(frame, (7, 30 + offset), (57, 30 - offset), RED,
                      dotted=True, width=2)
            self.diamond(frame, (32, 30), 4 + wave, CORAL, hollow=True)
        elif game.anim_kind == "cascade":
            destination_path = tuple(
                level["mapping"][node] for node in level["source_path"])
            for index, (a, b) in enumerate(zip(
                    destination_path, destination_path[1:])):
                if index > p * len(destination_path) // max(1, span):
                    continue
                start = level["destination_positions"][a]
                end = level["destination_positions"][b]
                self.line(frame, start, end, SUN, width=2)
                step = min(span, max(0, p - index))
                moving = (start[0] + (end[0] - start[0]) * step // span,
                          start[1] + (end[1] - start[1]) * step // span)
                self.diamond(frame, moving, 2 + wave // 2, CORAL)
            self.disc(frame, (32, 31), 3 + p, SKY, hollow=True)
        elif game.anim_kind == "loss":
            inset = min(24, p * 4)
            self.line(frame, (inset, 5), (63 - inset, 55), RED, width=2)
            self.line(frame, (63 - inset, 5), (inset, 55), PLUM, width=2)
        else:
            self.disc(frame, (32, 31), 4 + wave, FOG, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        state = self.game.state
        self.background(frame)
        self.field(frame, state)
        self.hud(frame, state)
        self.animation(frame, state)
        return frame


class Q151(ARCBaseGame):
    def __init__(self):
        self.display = AtlasDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [
            Level(sprites=[], grid_size=(64, 64), data=deepcopy(item),
                  name=item["name"])
            for item in LEVELS
        ]
        super().__init__(
            "q151", levels,
            Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
            False, len(levels), [1, 2, 3, 4, 5, 6],
        )

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = after
        self.pending_budget = budget
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.budget_left = self.pending_budget
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
        aid = self.action.id.value
        if aid == 0:
            self.complete_action()
            return
        before = self.state
        after = transition(self.level, before, aid)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        cost = action_cost(before, after)
        budget = self.budget_left - cost
        won = after.terminal == WIN
        lost = after.terminal == LOSS or (budget <= 0 and not won)
        if lost and after.terminal != LOSS:
            after = after._replace(terminal=LOSS)
        if won:
            kind, frames, terminal = "cascade", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 6, "loss"
        elif after.strikes > before.strikes:
            kind, frames, terminal = "diagnostic", 7, None
        elif aid in ROLE_ACTIONS:
            kind, frames, terminal = "role_cursor", 6, None
        elif aid in DESTINATION_ACTIONS:
            kind, frames, terminal = "destination_cursor", 6, None
        elif aid == TIE_ACTION:
            kind, frames, terminal = "tie", 7, None
        else:
            kind, frames, terminal = "blocked", 5, None
        self.begin(kind, frames, after, budget, terminal)
