# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q009-v2 Abyssal Current Observatory.

Freeze local lenses while exact current quanta advance around a closed ring.
The targets below are authored constants, never derived from an answer plan.
Their known solutions and counterfactual mechanic-necessity bounds are checked
by the Cycle 22 qualifier against the same pure transition used at runtime.

Glow-up mechanic draw:
* accepted mx002 deterministic physics: exact modular quanta, typed currents,
  alternating gills, and a dual influence boundary;
* rejected mx001: multiple strategic fronts would replace the intimate focus
  boundary with an unrelated command layer;
* rejected mx007: direct mouse navigation would add a second control language
  without making any current decision clearer.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


INK, MIST, SLATE, DEEP, ABYSS = 0, 1, 2, 4, 5
FUCHSIA, PEARL, RED, BLUE, CYAN, LIME, CORAL, EARTH, GREEN, VIOLET = range(6, 16)

TERMINAL_INDEX = 6
ACTIVE, WIN, LOSS = 0, 2, 3
NORMAL = 1
COUNTER = -1
UNGATED = -1


def level(
    name,
    start,
    target,
    solution,
    *,
    radius_max=0,
    types=None,
    gates=None,
    reversible=False,
    dual_offset=None,
    budget,
):
    count = len(start)
    return {
        "name": name,
        "start": tuple(start),
        "target": tuple(target),
        "mod": 4,
        "radius_max": radius_max,
        "types": tuple(types or (NORMAL,) * count),
        "gates": tuple(gates or (UNGATED,) * count),
        "reversible": reversible,
        "dual_offset": dual_offset,
        "dock": 0,
        "budget": budget,
        "known_solution": tuple(solution),
    }


# Each solution ends in ACTION6 audit. Budgets include that audit. Levels 2+
# need at least five physical decisions before audit, resisting accidental play.
LEVELS = [
    level(
        "Still Lens", (0, 1, 2), (0, 2, 3), (5, 6), budget=4,
    ),
    level(
        "Swimming Focus", (0, 0, 1, 2), (2, 0, 1, 3),
        (1, 1, 5, 1, 5, 1, 5, 5, 5, 6), budget=10,
    ),
    level(
        "Breathing Boundary", (0, 1, 2, 0, 1), (2, 1, 3, 1, 3),
        (2, 5, 2, 3, 5, 1, 1, 6), radius_max=1, budget=8,
    ),
    level(
        "Closing the Ring", (0, 1, 2, 3, 0, 1), (1, 3, 0, 0, 0, 1),
        (1, 1, 3, 5, 2, 5, 2, 6), radius_max=1, budget=8,
    ),
    level(
        "Countercurrent Jellies", (0, 1, 2, 3, 0, 1), (1, 1, 2, 2, 2, 3),
        (2, 2, 3, 5, 1, 5, 1, 6), radius_max=1,
        types=(NORMAL, COUNTER, NORMAL, COUNTER, NORMAL, COUNTER), budget=8,
    ),
    level(
        "Alternating Gills", (0, 1, 2, 3, 0, 1), (0, 1, 1, 1, 3, 0),
        (4, 5, 2, 3, 5, 5, 1, 6), radius_max=1,
        types=(NORMAL, COUNTER, NORMAL, COUNTER, NORMAL, COUNTER),
        gates=(0, 1, UNGATED, 0, 1, UNGATED), reversible=True, budget=8,
    ),
    level(
        "Twin Lenses", (0, 1, 2, 3, 0, 1), (0, 0, 2, 2, 1, 2),
        (5, 5, 2, 3, 5, 1, 6), radius_max=1,
        types=(NORMAL, COUNTER, NORMAL, COUNTER, NORMAL, COUNTER),
        gates=(0, 1, UNGATED, 0, 1, UNGATED), reversible=True,
        dual_offset=2, budget=7,
    ),
    level(
        "Abyssal Current", (2, 0, 3, 1, 2, 0), (3, 0, 3, 0, 2, 0),
        (1, 5, 1, 3, 4, 5, 2, 2, 6), radius_max=1,
        types=(NORMAL, COUNTER, NORMAL, COUNTER, NORMAL, COUNTER),
        gates=(0, 1, UNGATED, 0, 1, UNGATED), reversible=True,
        dual_offset=2, budget=9,
    ),
]


def start_state(level_data):
    """values, focus, radius, direction, phase, audit strikes, terminal."""
    return tuple(level_data["start"]), 0, 0, 0, 0, 0, ACTIVE


def cyclic_distance(a, b, count):
    return min((a - b) % count, (b - a) % count)


def lens_centers(level_data, state):
    focus = state[1]
    centers = [focus]
    if level_data["dual_offset"] is not None:
        centers.append((focus + level_data["dual_offset"]) % len(state[0]))
    return tuple(centers)


def frozen_indices(level_data, state):
    count = len(state[0])
    centers = lens_centers(level_data, state)
    radius = state[2]
    return tuple(
        index for index in range(count)
        if any(cyclic_distance(index, center, count) <= radius for center in centers)
    )


def affected_indices(level_data, state):
    """Previewable pulse footprint in visible clockwise propagation order."""
    count = len(state[0])
    frozen = set(frozen_indices(level_data, state))
    phase = state[4]
    return tuple(
        index
        for step in range(1, count + 1)
        for index in ((state[1] + step) % count,)
        if index not in frozen
        and (level_data["gates"][index] == UNGATED
             or level_data["gates"][index] == phase)
    )


def pulse_values(level_data, state):
    values = list(state[0])
    direction = -1 if state[3] else 1
    for index in affected_indices(level_data, state):
        quantum = level_data["types"][index] * direction
        values[index] = (values[index] + quantum) % level_data["mod"]
    return tuple(values)


def transition(level_data, state, action):
    """Pure deterministic transition shared by runtime and exact search."""
    values, focus, radius, direction, phase, strikes, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    count = len(values)
    if action == 1:
        return values, (focus - 1) % count, radius, direction, phase, strikes, terminal
    if action == 2:
        return values, (focus + 1) % count, radius, direction, phase, strikes, terminal
    if action == 3:
        maximum = level_data["radius_max"]
        if not maximum:
            return state
        return values, focus, (radius + 1) % (maximum + 1), direction, phase, strikes, terminal
    if action == 4:
        if not level_data["reversible"]:
            return state
        return values, focus, radius, 1 - direction, phase, strikes, terminal
    if action == 5:
        return (pulse_values(level_data, state), focus, radius, direction,
                1 - phase, strikes, terminal)

    # The observation marks a pearl mooring at dock. Returning the lens there
    # is a visible physical settle condition, not hidden answer-plan state.
    if values == level_data["target"] and focus == level_data["dock"]:
        terminal = WIN
    else:
        strikes += 1
        if strikes >= 2:
            terminal = LOSS
    return values, focus, radius, direction, phase, strikes, terminal


def action_cost(state, after):
    """Wrong audits are the explicit recoverable error and spend no current."""
    if state[TERMINAL_INDEX] or after == state:
        return 0
    if after[5] > state[5]:
        return 0
    return 1


def solved(_level_data, state):
    return state[TERMINAL_INDEX] == WIN


RING_POSITIONS = {
    3: ((32, 13), (49, 43), (15, 43)),
    4: ((32, 11), (52, 31), (32, 51), (12, 31)),
    5: ((32, 10), (52, 25), (45, 50), (19, 50), (12, 25)),
    6: ((32, 10), (50, 20), (50, 42), (32, 52), (14, 42), (14, 20)),
}


class CurrentDisplay(RenderableUserDisplay):
    INNER = ((0, -3), (3, 0), (0, 3), (-3, 0))
    OUTER = ((0, -7), (7, 0), (0, 7), (-7, 0))

    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        inner = max(0, radius - 1) ** 2
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
                    frame[y, x] = color

    @staticmethod
    def line(frame, start, end, color, dotted=False, thick=False):
        x0, y0 = start
        x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 4 in (1, 2):
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color
                if thick and y + 1 < 64:
                    frame[y + 1, x] = color

    @classmethod
    def triangle(cls, frame, center, radius, color, down=False, hollow=False):
        cx, cy = center
        top = cy + radius if down else cy - radius
        base = cy - radius if down else cy + radius
        for y in range(min(top, base), max(top, base) + 1):
            width = abs(y - top) * radius // max(1, abs(base - top))
            if hollow:
                cls.line(frame, (cx - width, y), (cx + width, y), color,
                         dotted=width > 1)
            else:
                cls.line(frame, (cx - width, y), (cx + width, y), color)

    @classmethod
    def crescent(cls, frame, center, radius, color, cut_color, reverse=False):
        cls.disc(frame, center, radius, color)
        shift = -2 if reverse else 2
        cls.disc(frame, (center[0] + shift, center[1] - 1), max(1, radius - 1), cut_color)

    @classmethod
    def droplet(cls, frame, center, radius, color, orientation=0, hollow=False):
        cls.disc(frame, center, radius, color, hollow=hollow)
        dx, dy = ((0, -radius - 2), (radius + 2, 0),
                  (0, radius + 2), (-radius - 2, 0))[orientation % 4]
        tip = (center[0] + dx, center[1] + dy)
        cls.line(frame, center, tip, color, thick=not hollow)

    def positions(self):
        return RING_POSITIONS[len(self.game.state[0])]

    def background(self, frame):
        frame[:, :] = ABYSS
        # Fixed plankton and caustic commas add luminous depth without carrying state.
        for y in range(4, 61, 7):
            for x in range(3 + (y // 7) % 5, 63, 11):
                color = DEEP if (x + y) % 3 else SLATE
                self.disc(frame, (x, y), 1, color)
                if (x * 3 + y) % 5 == 0:
                    self.line(frame, (x - 2, y + 1), (x + 1, y - 2), BLUE,
                              dotted=True)
        self.disc(frame, (32, 31), 28, DEEP, hollow=True)
        self.disc(frame, (31, 32), 24, BLUE, hollow=True)
        self.disc(frame, (33, 30), 18, SLATE, hollow=True)
        for center in ((5, 14), (59, 17), (7, 49), (57, 48)):
            self.crescent(frame, center, 3, VIOLET, ABYSS,
                          reverse=center[0] < 32)

    def topology(self, frame, state):
        positions = self.positions()
        count = len(positions)
        reverse = bool(state[3])
        for index, start in enumerate(positions):
            end = positions[(index + 1) % count]
            node_type = self.game.level["types"][index]
            color = VIOLET if node_type == COUNTER else CYAN
            self.line(frame, start, end, color, dotted=True)
            midpoint = ((start[0] + end[0]) // 2, (start[1] + end[1]) // 2)
            clockwise = (node_type == NORMAL) != reverse
            dx = 2 if end[0] > start[0] else -2 if end[0] < start[0] else 0
            dy = 2 if end[1] > start[1] else -2 if end[1] < start[1] else 0
            if not clockwise:
                dx, dy = -dx, -dy
            self.line(frame, (midpoint[0] - dx, midpoint[1] - dy), midpoint,
                      PEARL)
            self.triangle(frame, (midpoint[0] + dx, midpoint[1] + dy), 2,
                          color, down=dy < 0)

    def gauge(self, frame, center, value, target, modulus):
        # Current fill and target ghost share the same four-lobed unary grammar.
        for index in range(modulus):
            ix, iy = self.INNER[index]
            ox, oy = self.OUTER[index]
            if index < value:
                self.droplet(frame, (center[0] + ix, center[1] + iy), 1,
                             LIME, orientation=index)
            else:
                frame[center[1] + iy, center[0] + ix] = DEEP
            if index < target:
                self.disc(frame, (center[0] + ox, center[1] + oy), 1,
                          FUCHSIA, hollow=True)
                frame[center[1] + oy, center[0] + ox] = PEARL
        if value == 0:
            self.disc(frame, center, 2, SLATE, hollow=True)
        if target == 0:
            self.crescent(frame, (center[0], center[1] - 7), 2,
                          FUCHSIA, DEEP)

    def node(self, frame, index, value, target, state):
        center = self.positions()[index]
        node_type = self.game.level["types"][index]
        # Normal types are asymmetric droplets; counter-current types are crescents.
        self.disc(frame, center, 7, DEEP)
        if node_type == NORMAL:
            self.droplet(frame, center, 5, CYAN, orientation=index)
            self.disc(frame, center, 4, BLUE)
        else:
            self.crescent(frame, center, 6, VIOLET, DEEP,
                          reverse=index % 2 == 0)
            self.disc(frame, center, 3, BLUE)
        self.gauge(frame, center, value, target, self.game.level["mod"])

        gate = self.game.level["gates"][index]
        if gate != UNGATED:
            open_now = gate == state[4]
            marker = (center[0], center[1] + 9)
            if gate == 0:
                self.triangle(frame, marker, 2, LIME if open_now else SLATE,
                              hollow=not open_now)
            else:
                self.crescent(frame, marker, 2,
                              FUCHSIA if open_now else SLATE, ABYSS,
                              reverse=True)

    def influence(self, frame, state):
        positions = self.positions()
        frozen = set(frozen_indices(self.game.level, state))
        affected = set(affected_indices(self.game.level, state))
        centers = lens_centers(self.game.level, state)
        for index in frozen:
            color = FUCHSIA if len(centers) > 1 and cyclic_distance(
                index, centers[-1], len(positions)) <= state[2] else CYAN
            self.disc(frame, positions[index], 9, color, hollow=True)
            # Offset twin rings form an amoebic, not perfectly circular, membrane.
            self.disc(frame, (positions[index][0] - 1, positions[index][1] + 1),
                      8, PEARL, hollow=True)
        for index in affected:
            self.disc(frame, positions[index], 9, LIME, hollow=True)
            x, y = positions[index]
            self.line(frame, (x - 3, y + 10), (x + 3, y + 10),
                      CYAN if self.game.level["types"][index] == NORMAL else VIOLET,
                      dotted=True)
        # A persistent hollow pearl shows where the lens must settle to audit.
        dock = positions[self.game.level["dock"]]
        self.disc(frame, dock, 11, FUCHSIA, hollow=True)
        self.droplet(frame, (dock[0], dock[1] + 11), 2, PEARL,
                     orientation=2, hollow=True)

    def hud(self, frame, state):
        phase, reverse, strikes = state[4], bool(state[3]), state[5]
        # Phase uses opposed sun/crescent silhouettes, never hue alone.
        if phase == 0:
            self.disc(frame, (5, 5), 3, LIME)
            for dx, dy in ((0, -5), (5, 0), (0, 5), (-5, 0)):
                self.line(frame, (5, 5), (5 + dx, 5 + dy), PEARL)
        else:
            self.crescent(frame, (5, 5), 4, FUCHSIA, ABYSS)

        # Direction is a curling seed whose tip physically reverses.
        self.disc(frame, (59, 5), 4, VIOLET, hollow=True)
        if reverse:
            self.line(frame, (62, 5), (56, 2), PEARL)
            self.triangle(frame, (56, 2), 2, LIME, down=False)
        else:
            self.line(frame, (56, 5), (62, 2), PEARL)
            self.triangle(frame, (62, 2), 2, LIME, down=False)

        # Two persistent shell scars expose the finite recoverable audit.
        for index in range(2):
            center = (59, 26 + index * 12)
            if index < strikes:
                self.crescent(frame, center, 4, RED, ABYSS,
                              reverse=index % 2 == 0)
                self.line(frame, (56, center[1] + 3), (62, center[1] - 3), PEARL)
            else:
                self.disc(frame, center, 4, SLATE, hollow=True)

        # Exact remaining action quanta appear as individually countable orbit beads.
        for index in range(self.game.budget_max):
            center = (6 + index * 4, 60)
            live = index < self.game.budget_left
            self.disc(frame, center, 1, CYAN if live else SLATE,
                      hollow=not live)
            if live and index % 2 == 0:
                frame[60, center[0]] = PEARL

    def pulse_state(self):
        g = self.game
        state = g.state
        if g.anim_kind != "pulse" or not g.anim_trace:
            return state
        completed = len(g.anim_trace) * g.anim_progress // max(1, g.anim_total - 1)
        if completed <= 0:
            return state
        values = list(state[0])
        for index in g.anim_trace[:completed]:
            values[index] = g.pending_state[0][index]
        phase = g.pending_state[4] if completed == len(g.anim_trace) else state[4]
        return (tuple(values), state[1], state[2], state[3], phase,
                state[5], state[6])

    def animation(self, frame, render_state):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                for index in affected_indices(g.level, g.state):
                    self.disc(frame, self.positions()[index], 11, LIME, hollow=True)
            if g.terminal_hold == "loss":
                self.crescent(frame, (32, 31), 27, RED, ABYSS)
            return
        progress = g.anim_progress
        span = max(1, g.anim_total - 1)
        before, after = g.state, g.pending_state
        if g.anim_kind == "focus":
            start = self.positions()[before[1]]
            end = self.positions()[after[1]]
            # Wrapping from 0 to the final node follows the closing ring edge.
            x = start[0] + (end[0] - start[0]) * progress // span
            y = start[1] + (end[1] - start[1]) * progress // span
            wobble = min(progress, span - progress)
            self.disc(frame, (x - wobble % 2, y + wobble % 3 - 1),
                      8 + wobble // 2, CYAN, hollow=True)
            self.crescent(frame, (x, y), 4, FUCHSIA, ABYSS,
                          reverse=after[1] < before[1])
        elif g.anim_kind == "radius":
            for index in frozen_indices(g.level, after):
                radius = 6 + 4 * progress // span
                self.disc(frame, self.positions()[index], radius, CYAN,
                          hollow=True)
                if index % 2:
                    self.crescent(frame, self.positions()[index],
                                  max(2, radius - 3), FUCHSIA, ABYSS)
        elif g.anim_kind == "reverse":
            for index, center in enumerate(self.positions()):
                radius = 7 + (progress + index) % 4
                self.crescent(frame, center, radius,
                              VIOLET if after[3] else CYAN, ABYSS,
                              reverse=bool(after[3]))
        elif g.anim_kind == "pulse":
            if g.anim_trace:
                trace_index = min(len(g.anim_trace) - 1,
                                  len(g.anim_trace) * progress // max(1, span + 1))
                node_index = g.anim_trace[trace_index]
                center = self.positions()[node_index]
                self.disc(frame, center, 8 + progress % 4, LIME, hollow=True)
                self.droplet(frame, center, 2, PEARL,
                             orientation=(node_index + progress) % 4)
            ripple = 5 + 24 * progress // span
            self.disc(frame, self.positions()[before[1]], ripple, CYAN,
                      hollow=True)
        elif g.anim_kind == "audit_fail":
            center = (59, 26 + min(1, after[5] - 1) * 12)
            self.crescent(frame, center, 3 + progress // 2, RED, ABYSS)
            self.disc(frame, (32, 31), 8 + progress * 2, FUCHSIA,
                      hollow=True)
        elif g.anim_kind == "success":
            self.disc(frame, (32, 31), 6 + progress * 4, LIME, hollow=True)
            for index, center in enumerate(self.positions()):
                self.droplet(frame, center, 2 + (progress + index) % 3,
                             PEARL, orientation=index)
        elif g.anim_kind == "loss":
            radius = max(3, 27 - progress * 3)
            self.crescent(frame, (32, 31), radius, RED, ABYSS,
                          reverse=progress % 2 == 0)
            self.line(frame, (8 + progress, 8), (56 - progress, 55), RED,
                      dotted=True, thick=True)
        else:  # blocked input: one localized elastic recoil, never a flash.
            center = self.positions()[before[1]]
            offset = (0, -2, 0, 2, 0)[min(progress, 4)]
            self.disc(frame, (center[0] + offset, center[1]), 9, RED,
                      hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        render_state = self.pulse_state()
        self.background(frame)
        self.topology(frame, render_state)
        for index, (value, target) in enumerate(zip(
                render_state[0], self.game.level["target"])):
            self.node(frame, index, value, target, render_state)
        if self.game.anim_kind != "focus":
            self.influence(frame, render_state)
        self.hud(frame, render_state)
        self.animation(frame, render_state)
        return frame


class Q009(ARCBaseGame):
    def __init__(self):
        self.display = CurrentDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_trace = ()
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None
        levels = [
            Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
            for item in LEVELS
        ]
        super().__init__(
            "q009", levels,
            Camera(0, 0, 64, 64, ABYSS, ABYSS, [self.display]),
            False, len(levels), [1, 2, 3, 4, 5, 6],
        )

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_trace = ()
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        self.terminal_hold = None

    def begin(self, kind, frames, state, budget, trace=(), terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.anim_trace = tuple(trace)
        self.pending_state = state
        self.pending_budget = budget
        self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state
        self.budget_left = self.pending_budget
        self.anim_kind = None
        self.anim_trace = ()
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
        won = after[TERMINAL_INDEX] == WIN
        lost = after[TERMINAL_INDEX] == LOSS or (budget <= 0 and not won)
        if lost and after[TERMINAL_INDEX] != LOSS:
            after = after[:TERMINAL_INDEX] + (LOSS,)
        if won:
            # Runtime counts the initiating frame and the level-transition
            # settle in addition to these authored animation ticks.
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 8, "loss"
        elif after[5] > before[5]:
            kind, frames, terminal = "audit_fail", 7, None
        elif action in (1, 2):
            kind, frames, terminal = "focus", 6, None
        elif action == 3:
            kind, frames, terminal = "radius", 6, None
        elif action == 4:
            kind, frames, terminal = "reverse", 6, None
        elif action == 5:
            kind, frames, terminal = "pulse", 8, None
        else:
            kind, frames, terminal = "blocked", 5, None
        trace = affected_indices(self.level, before) if action == 5 else ()
        self.begin(kind, frames, after, budget, trace=trace, terminal=terminal)
