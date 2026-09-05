# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q080-v3 Regime Cart -- carry a local physical law along a crystalline rail.

The cart moves a modular height-changing field.  Eight levels compose polarity,
radius, distance falloff, anchors, automatic switches, and a visibly bridged wrap
topology.  Movement energy and the two audit seals are deliberately independent:
an incorrect audit is recoverable without shortening the physical plan.
"""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, SILVER, SLATE, CHARCOAL, NIGHT = 0, 1, 2, 4, 5
MAGENTA, ROSE, RED, BLUE, GLASS, AMBER, COPPER, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 14, 15


LEVELS = [
    {"name": "First Pulse", "start": (0, 0, 0), "target": (1, 1, 1),
     "mod": 4, "radius": 0, "toggle": False, "goal_cart": 2, "goal_regime": 1,
     "budget": 6},
    {"name": "Inverse Glass", "start": (1, 0, 2, 0), "target": (0, 4, 3, 1),
     "mod": 5, "radius": 0, "toggle": True, "goal_cart": 3, "goal_regime": 1,
     "budget": 10},
    {"name": "Wide Lantern", "start": (0, 1, 0, 2, 0), "target": (1, 1, 4, 2, 1),
     "mod": 5, "radius": 1, "toggle": True, "goal_cart": 4, "goal_regime": 1,
     "budget": 10},
    {"name": "Tapered Law", "start": (2, 0, 1, 0, 3), "target": (0, 0, 2, 5, 0),
     "mod": 7, "radius": 1, "kernel": "falloff", "toggle": True,
     "goal_cart": 4, "goal_regime": -1, "budget": 12},
    {"name": "Anchored Ridge", "start": (0, 2, 1, 3, 0, 1), "target": (2, 2, 1, 5, 3, 2),
     "mod": 7, "radius": 1, "kernel": "falloff", "anchors": (2,), "toggle": True,
     "goal_cart": 3, "goal_regime": 1, "budget": 12},
    {"name": "Polarity Cairn", "start": (1, 0, 3, 2, 0, 4), "target": (6, 5, 0, 6, 0, 2),
     "mod": 7, "radius": 1, "kernel": "falloff", "anchors": (4,), "switches": (2,),
     "toggle": True, "goal_cart": 5, "goal_regime": -1, "budget": 12},
    {"name": "Looped Horizon", "start": (0, 3, 1, 4, 2, 0), "target": (6, 3, 3, 4, 2, 0),
     "mod": 7, "radius": 2, "kernel": "flat", "anchors": (3,), "switches": (5,),
     "wrap": True, "toggle": True, "goal_cart": 5, "goal_regime": -1, "budget": 13},
    {"name": "Regime Cart", "start": (2, 0, 4, 1, 3, 0, 5), "target": (6, 0, 1, 7, 2, 0, 2),
     "mod": 8, "radius": 2, "kernel": "falloff", "anchors": (1, 5),
     "switches": (3, 6), "wrap": True, "toggle": True,
     "goal_cart": 5, "goal_regime": -1, "budget": 13},
]


def start_state(level):
    """Return values, cart, polarity, remaining audit seals, terminal code."""
    return tuple(level["start"]), 0, 1, 2, 0


def field_distance(index, cart, size, wrap):
    distance = abs(index - cart)
    return min(distance, size - distance) if wrap else distance


def configuration_solved(level, state):
    values, cart, regime = state[:3]
    return (tuple(values) == tuple(level["target"])
            and cart == level["goal_cart"] and regime == level["goal_regime"])


def transition(level, state, action):
    """Pure deterministic transition used by the game and independent qualifier."""
    values, cart, regime, audits, terminal = state
    if terminal or action not in (1, 3, 4, 5, 6):
        return state
    size = len(values)
    if action == 1:
        if not level.get("toggle", True):
            return state
        return values, cart, -regime, audits, terminal
    if action == 3:
        next_cart = (cart - 1) % size if level.get("wrap") else max(0, cart - 1)
        return values, next_cart, regime, audits, terminal
    if action == 4:
        next_cart = (cart + 1) % size if level.get("wrap") else min(size - 1, cart + 1)
        return values, next_cart, regime, audits, terminal
    if action == 6:
        if configuration_solved(level, state):
            return values, cart, regime, audits, 2
        audits -= 1
        return values, cart, regime, audits, 3 if audits <= 0 else 0

    changed = list(values)
    for index, value in enumerate(values):
        distance = field_distance(index, cart, size, level.get("wrap", False))
        if distance > level["radius"] or index in level.get("anchors", ()):
            continue
        strength = 1
        if level.get("kernel", "flat") == "falloff":
            strength = level["radius"] - distance + 1
        changed[index] = (value + regime * strength) % level["mod"]
    if cart in level.get("switches", ()):
        regime = -regime
    return tuple(changed), cart, regime, audits, terminal


def action_cost(state, after):
    """Only a changed physical configuration spends movement energy."""
    return int(after[:3] != state[:3])


def solved(_level, state):
    return state[-1] == 2


class RegimeDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def _disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def _line(frame, a, b, color, dotted=False):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def _diamond(frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            width = radius - abs(dy)
            y = cy + dy
            if not 0 <= y < 64:
                continue
            if hollow:
                for x in (cx - width, cx + width):
                    if 0 <= x < 64:
                        frame[y, x] = color
            else:
                frame[y, max(0, cx - width):min(64, cx + width + 1)] = color

    def _positions(self):
        size = len(self.game.values)
        if size == 1:
            return (32,)
        return tuple(8 + index * 48 // (size - 1) for index in range(size))

    def _background(self, frame):
        frame[:, :] = NIGHT
        # Keep the play field quiet: sparse strata frame the high-contrast apparatus.
        for y in (17, 27, 37):
            frame[y, 4:61:6] = CHARCOAL
        frame[14, 5:60:4] = SLATE
        frame[56:59, 3:61] = CHARCOAL
        frame[57, 4:60:3] = COPPER

    def _tower(self, frame, index, x, value, target, current_height=None):
        base = 45
        height = value * 4 if current_height is None else current_height
        current_top = base - height
        target_top = base - target * 4
        # Current is a filled crystal; target is a dotted outline on the same scale.
        frame[max(15, target_top):base + 1:2, x - 4] = ROSE
        frame[max(15, target_top):base + 1:2, x + 4] = ROSE
        frame[max(15, target_top), x - 4:x + 5:2] = ROSE
        if height > 0:
            top = max(15, current_top)
            if top + 2 < base:
                frame[top + 2:base, x - 4:x + 5] = BLUE
                frame[top + 2:base, x - 2:x + 3] = GLASS
                frame[top + 2:base:3, x + 2:x + 4] = SILVER
            frame[top, x] = WHITE
            if top + 1 < 64:
                frame[top + 1, x - 2:x + 3] = GLASS
        frame[base:base + 3, x - 5:x + 6] = CHARCOAL
        if index in self.game.level.get("anchors", ()):
            frame[base - 5:base, x - 5:x + 6:2] = AMBER
            frame[base - 4:base + 1:2, x - 5:x + 6] = AMBER
        if index in self.game.level.get("switches", ()):
            frame[base + 3:base + 7, x - 4:x + 5] = VIOLET
            frame[base + 4:base + 6, x - 2:x + 3] = NIGHT
            frame[base + 4, x] = WHITE

    def _field(self, frame, cart, regime):
        g = self.game
        xs = self._positions()
        size = len(xs)
        for index, x in enumerate(xs):
            distance = field_distance(index, cart, size, g.level.get("wrap", False))
            if distance > g.level["radius"]:
                continue
            if g.level.get("kernel", "flat") == "falloff":
                height = 3 + (g.level["radius"] - distance) * 2
            else:
                height = 3 + g.level["radius"] * 2
            color = GLASS if regime > 0 else VIOLET
            frame[47 - height:48, max(1, x - 5):min(63, x + 6):2] = color
            if regime > 0:
                frame[47 - height, max(1, x - 3):min(63, x + 4)] = GLASS
                frame[45 - height:48 - height, x] = WHITE
            else:
                frame[46 - height:49 - height, max(1, x - 2):min(63, x + 3)] = NIGHT
                frame[47 - height, x - 3:x + 4:2] = VIOLET

    def _polarity(self, frame, center, regime, scale=3):
        x, y = center
        if scale <= 0:
            self._disc(frame, center, 1, WHITE)
            return
        if regime > 0:
            self._line(frame, (x, y - scale), (x, y + scale), WHITE)
            self._line(frame, (x - scale, y), (x + scale, y), WHITE)
        else:
            self._line(frame, (x - scale, y - 2), (x + scale, y - 2), WHITE)
            self._line(frame, (x - scale, y - 2), (x, y + scale), WHITE)
            self._line(frame, (x + scale, y - 2), (x, y + scale), WHITE)

    def _cart_at(self, frame, x, y, regime, morph_to=None, progress=0, total=1):
        # The complete silhouette travels: dome, chassis, wheels, and polarity glyph.
        self._disc(frame, (x, y - 1), 6, CHARCOAL)
        dome_regime = morph_to if morph_to is not None and progress > total // 2 else regime
        self._disc(frame, (x, y - 2), 5, GLASS if dome_regime > 0 else VIOLET)
        frame[y - 1:y + 4, x - 6:x + 7] = COPPER
        frame[y - 2:y + 1, x - 4:x + 5] = NIGHT
        self._disc(frame, (x - 4, y + 5), 2, SILVER)
        self._disc(frame, (x + 4, y + 5), 2, SILVER)
        self._disc(frame, (x - 4, y + 5), 1, NIGHT)
        self._disc(frame, (x + 4, y + 5), 1, NIGHT)
        if morph_to is None:
            self._polarity(frame, (x, y - 5), regime)
        else:
            half = max(1, total // 2)
            if progress <= half:
                scale = max(0, 3 * (half - progress) // half)
                self._polarity(frame, (x, y - 5), regime, scale)
            else:
                scale = max(1, 3 * (progress - half) // max(1, total - half))
                self._polarity(frame, (x, y - 5), morph_to, scale)

    def _cart(self, frame, cart, regime):
        self._cart_at(frame, self._positions()[cart], 49, regime)

    def _goal(self, frame):
        g = self.game
        x = self._positions()[g.level["goal_cart"]]
        frame[59:63, x - 5:x + 6:2] = GREEN
        frame[60, x - 2:x + 3] = GREEN if g.level["goal_regime"] > 0 else MAGENTA
        self._polarity(frame, (x, 59), g.level["goal_regime"], 2)

    def _lamp(self, frame, center, filled, color):
        # Five-pixel filled/hollow diamonds make every adjacent count distinct.
        self._diamond(frame, center, 2, color if filled else SLATE, hollow=not filled)
        if filled:
            frame[center[1], center[0]] = WHITE

    def _hud(self, frame):
        g = self.game
        for index in range(g.budget_max):
            center = (7 + (index % 7) * 7, 4 + (index // 7) * 6)
            self._lamp(frame, center, index < g.budget_left, AMBER)
        for index in range(2):
            self._lamp(frame, (57, 4 + index * 6), index < g.audits, COPPER)
        # A neutral three-facet audit seal advertises action 6 but never readiness.
        self._diamond(frame, (57, 18), 4, SILVER, hollow=True)
        self._line(frame, (54, 18), (60, 18), SLATE)
        self._line(frame, (57, 15), (57, 21), SLATE)
        self._line(frame, (55, 20), (59, 16), SLATE)

    @staticmethod
    def _path_point(points, progress, total):
        lengths = [abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in zip(points, points[1:])]
        distance = sum(lengths) * progress // max(1, total)
        for (a, b), length in zip(zip(points, points[1:]), lengths):
            if distance <= length:
                if length == 0:
                    return b
                return (a[0] + (b[0] - a[0]) * distance // length,
                        a[1] + (b[1] - a[1]) * distance // length)
            distance -= length
        return points[-1]

    def _pulse_animation(self, frame):
        g = self.game
        xs = self._positions()
        p = g.anim_progress
        for index, x in enumerate(xs):
            distance = field_distance(index, g.cart, len(xs), g.level.get("wrap", False))
            if distance > g.level["radius"]:
                continue
            source = (xs[g.cart], 39)
            destination = (x, 34)
            marker = (source[0] + (destination[0] - source[0]) * p // g.anim_total,
                      source[1] + (destination[1] - source[1]) * p // g.anim_total)
            self._diamond(frame, marker, 1, GLASS if g.regime > 0 else VIOLET)
            if index in g.level.get("anchors", ()):
                # A stable X-brace rejects the arriving impulse; the tower never moves.
                self._line(frame, (x - 4, 31), (x + 4, 37), AMBER)
                self._line(frame, (x + 4, 31), (x - 4, 37), AMBER)

    def _animation(self, frame):
        g = self.game
        if g.intro_mark:
            frame[13, 6:55:3] = GLASS
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind == "move":
            xs = self._positions()
            start_x = xs[g.anim_from_cart]
            end_x = xs[g.anim_to_cart]
            if abs(g.anim_to_cart - g.anim_from_cart) > 1:
                points = ((start_x, 49), (start_x, 25), (end_x, 25), (end_x, 49))
                x, y = self._path_point(points, p, g.anim_total)
            else:
                x = start_x + (end_x - start_x) * p // g.anim_total
                y = 49 - (p * (g.anim_total - p) * 4 // (g.anim_total * g.anim_total))
            self._cart_at(frame, x, y, g.regime)
        elif g.anim_kind == "toggle":
            self._cart_at(frame, self._positions()[g.cart], 49, g.regime,
                          g.pending_state[2], p, g.anim_total)
        elif g.anim_kind == "pulse":
            self._pulse_animation(frame)
        elif g.anim_kind == "blocked":
            x = self._positions()[g.cart]
            self._line(frame, (x - 6, 39 + p), (x + 6, 39 + p), RED, dotted=True)
        elif g.anim_kind == "audit_reject":
            self._diamond(frame, (57, 18), 4 + p, RED, hollow=True)
            self._line(frame, (53 + p, 14), (61 - p, 22), RED)
        elif g.anim_kind == "success":
            frame[14 + p:25, 5 + p:60 - p:2] = GREEN
        elif g.anim_kind == "loss":
            frame[14:29, 6 + p:59 - p:3] = RED

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        self._background(frame)
        xs = self._positions()
        if g.level.get("wrap"):
            self._line(frame, (xs[0], 39), (xs[0], 25), GLASS)
            self._line(frame, (xs[0], 25), (xs[-1], 25), GLASS, dotted=True)
            self._line(frame, (xs[-1], 25), (xs[-1], 39), GLASS)
        for tick in range(g.level["mod"]):
            frame[45 - tick * 4, 2:5] = SILVER if tick else COPPER
        for index, (x, value, target) in enumerate(zip(xs, g.values, g.level["target"])):
            height = None
            if g.anim_kind == "pulse" and g.pending_state is not None:
                new_value = g.pending_state[0][index]
                height = (value * 4 * (g.anim_total - g.anim_progress)
                          + new_value * 4 * g.anim_progress) // g.anim_total
            self._tower(frame, index, x, value, target, height)
        self._field(frame, g.cart, g.regime)
        moving_or_morphing = g.anim_kind in ("move", "toggle")
        switch_morph = (g.anim_kind == "pulse" and g.pending_state is not None
                        and g.pending_state[2] != g.regime)
        if not moving_or_morphing and not switch_morph:
            self._cart(frame, g.cart, g.regime)
        elif switch_morph:
            self._cart_at(frame, xs[g.cart], 49, g.regime, g.pending_state[2],
                          g.anim_progress, g.anim_total)
        self._goal(frame)
        self._hud(frame)
        self._animation(frame)
        return frame


class Q080(ARCBaseGame):
    def __init__(self):
        self.display = RegimeDisplay(self)
        self.level = LEVELS[0]
        self.values = ()
        self.cart = 0
        self.regime = 1
        self.audits = 2
        self.terminal = 0
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from_cart = self.anim_to_cart = 0
        self.pending_state = None
        self.pending_budget = None
        self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q080", levels, Camera(0, 0, 64, 64, NIGHT, NIGHT, [self.display]),
                         False, len(levels), [1, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.values, self.cart, self.regime, self.audits, self.terminal = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from_cart = self.anim_to_cart = self.cart
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True

    def state(self):
        return self.values, self.cart, self.regime, self.audits, self.terminal

    def _begin(self, kind, frames, next_state, budget, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = next_state
        self.pending_budget = budget
        self.pending_terminal = terminal

    def _finish(self):
        terminal = self.pending_terminal
        if self.pending_state is not None:
            self.values, self.cart, self.regime, self.audits, self.terminal = self.pending_state
        if self.pending_budget is not None:
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
                self._finish()
            return
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        before = self.state()
        after = transition(self.level, before, action)
        if after == before:
            self._begin("blocked", 3, before, self.budget_left)
            return
        budget = self.budget_left - action_cost(before, after)
        won = after[-1] == 2
        # Zero energy is a valid resting state: the player may still use the
        # separate audit reserve.  Only an attempted physical overdraft loses.
        lost = after[-1] == 3 or (budget < 0 and not won)
        if won:
            kind = "success"
        elif lost:
            kind = "loss"
        elif action == 6:
            kind = "audit_reject"
        elif action in (3, 4):
            self.anim_from_cart = self.cart
            self.anim_to_cart = after[1]
            kind = "move"
        elif action == 1:
            kind = "toggle"
        else:
            kind = "pulse"
        frames = 7 if kind in ("success", "loss") else 5 if kind != "blocked" else 3
        self._begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
