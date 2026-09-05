# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q071-v3 Season Pilgrim -- walk a bright, living action-calendar.

Each successful hop or deliberate wait advances one fully visible seasonal
clock.  Flower and snowflake causeways alternate, faceted climate stones invert
their meaning, brittle trail-stones fall behind the pilgrim, and spiral
solstice wells restart the warm interval.  The puzzle is turn-based and exact:
weather animation clarifies a transition but never supplies hidden state.
"""

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, CREAM, STONE, SLATE, ASH, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, SUN, CORAL, EARTH, LEAF, VIOLET = range(6, 16)
CELL, OX, OY = 6, 8, 8
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}


RAW_LEVELS = [
    {"name": "First Bloom",
     "map": ("########", "#SaaaG##", "########", "########",
             "########", "########", "########", "########"),
     "period": 6, "budget": 6,
     "solution": (4, 4, 4, 4)},
    {"name": "Frost Patience",
     "map": ("########", "#SG#####", "#b######", "#bbbo###",
             "########", "########", "########", "########"),
     "period": 2, "budget": 20,
     "solution": (4, 3, 2, 2, 5, 5, 4, 4, 4, 5, 3, 3, 5, 5, 3, 1, 1, 4)},
    {"name": "Mixed Garden",
     "map": ("########", "#SG#####", "#a######", "#aab####",
             "###bo###", "########", "########", "########"),
     "period": 2, "budget": 21,
     "solution": (2, 2, 5, 5, 4, 5, 4, 2, 4, 5, 3, 1, 3, 3, 5, 5, 1, 1, 4)},
    {"name": "Climate Mirror",
     "map": ("########", "#SG#####", "#a######", "#aaM####",
             "###bo###", "########", "########", "########"),
     "period": 1, "budget": 17,
     "solution": (2, 5, 2, 5, 4, 4, 2, 4, 3, 1, 3, 5, 3, 5, 1, 1, 4)},
    {"name": "Brittle Return",
     "map": ("########", "#SM!a###", "#o#ba###", "##Gbo###",
             "########", "########", "########", "########"),
     "period": 2, "budget": 10,
     "solution": (2, 1, 4, 4, 2, 2, 4, 5, 3, 3)},
    {"name": "Solstice Well",
     "map": ("########", "#S.!W###", "#o##M###", "####b###",
             "##Gao###", "########", "########", "########"),
     "period": 3, "budget": 12,
     "solution": (2, 1, 4, 4, 4, 2, 2, 2, 3, 3)},
    {"name": "Falling Equinox",
     "map": ("########", "#S.!b###", "#o##M###", "##G!ao##",
             "########", "########", "########", "########"),
     "period": 2, "budget": 19,
     "solution": (2, 1, 2, 1, 4, 4, 4, 2, 5, 5, 2, 4, 5, 5, 3, 3, 3)},
    {"name": "Season Pilgrim",
     "map": ("########", "#S######", "#o.!a###", "####M###",
             "#Woba###", "#a######", "#G######", "########"),
     "period": 3, "budget": 22,
     "solution": (2, 1, 2, 1, 2, 4, 4, 4, 2, 1, 2, 5, 2, 5, 5, 3, 3, 3, 2, 2)},
]


def locate(level, symbol):
    for y, row in enumerate(level["map"]):
        for x, value in enumerate(row):
            if value == symbol:
                return x, y
    raise ValueError(symbol)


def required_tiles(level, symbol):
    mask = 0
    for y, row in enumerate(level["map"]):
        for x, value in enumerate(row):
            if value == symbol:
                mask |= 1 << (y * 8 + x)
    return mask


def start_state(level):
    x, y = locate(level, "S")
    # x, y, season, ticks, inversion, collapsed, seeds, wells, mirrors,
    # two recoverable audit seals, terminal (0 live, 2 win, 3 loss)
    return (x, y, 0, level["period"], 0, 0, 0, 0, 0, 2, 0)


def _open(state, symbol):
    phase, inverted = state[2], state[4]
    return (symbol == "a") == (phase == (1 if inverted else 0))


def _passable(level, state, x, y):
    if not (0 <= x < 8 and 0 <= y < 8):
        return False
    symbol = level["map"][y][x]
    if symbol == "#" or state[5] & (1 << (y * 8 + x)):
        return False
    return symbol not in "ab" or _open(state, symbol)


def configuration_ready(level, state):
    return (state[:2] == locate(level, "G")
            and state[6] & required_tiles(level, "o") == required_tiles(level, "o")
            and state[5] & required_tiles(level, "!") == required_tiles(level, "!")
            and state[7] & required_tiles(level, "W") == required_tiles(level, "W")
            and state[8] & required_tiles(level, "M") == required_tiles(level, "M"))


def transition(level, state, action):
    x, y, phase, until, inverted, collapsed, seeds, wells, mirrors, seals, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 6:
        if configuration_ready(level, state):
            return state[:-1] + (2,)
        if seals > 1:
            return state[:9] + (seals - 1, 0)
        return state[:9] + (0, 3)

    moved = False
    entered_well = False
    if action in DIRS:
        dx, dy = DIRS[action]
        nx, ny = x + dx, y + dy
        if not _passable(level, state, nx, ny):
            return state
        if level["map"][y][x] == "!":
            collapsed |= 1 << (y * 8 + x)
        x, y = nx, ny
        moved = True
        symbol = level["map"][y][x]
        bit = 1 << (y * 8 + x)
        if symbol == "M":
            inverted = 1 - inverted
            mirrors |= bit
        elif symbol == "W":
            phase, until = 0, level["period"]
            wells |= bit
            entered_well = True
        elif symbol == "o":
            seeds |= bit
    # Wait is always causal; a successful hop is causal unless the well resets.
    if not entered_well and (moved or action == 5):
        until -= 1
        if until <= 0:
            phase = 1 - phase
            until = level["period"]
    return (x, y, phase, until, inverted, collapsed, seeds, wells, mirrors,
            seals, terminal)


def action_cost(before, after):
    """Pure runtime cost: exploration/audits are recoverable; clock steps cost one."""
    if before == after or before[9] != after[9] or after[10] in (2, 3):
        return 0
    return 1


def solved(_level, state):
    return state[10] == 2


def _finalize_levels():
    levels = []
    for raw in RAW_LEVELS:
        level = {key: deepcopy(value) for key, value in raw.items() if key != "solution"}
        state = start_state(level)
        for action in raw["solution"]:
            before = state
            state = transition(level, state, action)
            assert state != before, (raw["name"], action, state)
            assert not state[10]
        assert configuration_ready(level, state), raw["name"]
        level["solution"] = tuple(raw["solution"])
        levels.append(level)
    return levels


LEVELS = _finalize_levels()


class PilgrimDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for yy in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for xx in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (xx - cx) ** 2 + (yy - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 1) ** 2):
                    frame[yy, xx] = color

    @staticmethod
    def line(frame, a, b, color, dotted=False, width=1):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            for yy in range(y - width + 1, y + width):
                for xx in range(x - width + 1, x + width):
                    if 0 <= xx < 64 and 0 <= yy < 64:
                        frame[yy, xx] = color

    @staticmethod
    def center(x, y):
        return OX + x * CELL + CELL // 2, OY + y * CELL + CELL // 2

    def petal(self, frame, center, radius, color, core=WHITE):
        x, y = center
        for dx, dy in ((0, -radius), (radius, 0), (0, radius), (-radius, 0)):
            self.disc(frame, (x + dx, y + dy), max(1, radius // 2), color)
        self.disc(frame, center, max(1, radius // 2), core)

    def snowflake(self, frame, center, radius, color):
        x, y = center
        self.line(frame, (x - radius, y), (x + radius, y), color)
        self.line(frame, (x, y - radius), (x, y + radius), color)
        self.line(frame, (x - radius + 1, y - radius + 1),
                  (x + radius - 1, y + radius - 1), color, dotted=True)
        self.line(frame, (x + radius - 1, y - radius + 1),
                  (x - radius + 1, y + radius - 1), color, dotted=True)

    def diamond(self, frame, center, radius, color, hollow=False):
        cx, cy = center
        for yy in range(max(0, cy - radius), min(64, cy + radius + 1)):
            span = radius - abs(yy - cy)
            if hollow:
                for xx in (cx - span, cx + span):
                    if 0 <= xx < 64:
                        frame[yy, xx] = color
            else:
                frame[yy, max(0, cx - span):min(64, cx + span + 1)] = color

    def background(self, frame, state):
        # High-key stitched paper landscape with large, stable landmarks.
        warm = state[2] == 0
        frame[:, :] = LEAF if warm else AQUA
        frame[8:57, 4:60] = CREAM
        for y in range(10, 57, 6):
            color = SUN if warm else BLUE
            start = 5 + ((y // 6) % 2) * 3
            frame[y, start:60:6] = color
        # Embroidered border: no words or numerals.
        for x in range(4, 61, 4):
            frame[8, x] = CORAL if warm else VIOLET
            frame[56, x] = CORAL if warm else VIOLET
        for y in range(8, 57, 4):
            frame[y, 4] = EARTH
            frame[y, 59] = EARTH
        # Large sun-flower and snowy mountain establish scale and season.
        self.disc(frame, (55, 13), 5, SUN if warm else CREAM)
        if warm:
            self.petal(frame, (55, 13), 4, CORAL, SUN)
        else:
            self.snowflake(frame, (55, 13), 5, BLUE)
        self.line(frame, (5, 52), (13, 43), EARTH, width=2)
        self.line(frame, (13, 43), (22, 52), EARTH, width=2)
        self.line(frame, (9, 48), (13, 43), WHITE)
        self.line(frame, (13, 43), (17, 48), WHITE)
        for x, y in ((7, 15), (56, 34), (51, 50), (24, 12)):
            self.line(frame, (x, y), (x + 2, y - 2), LEAF)
            self.line(frame, (x, y), (x + 3, y + 1), LEAF)

    def causeways(self, frame, state):
        level = self.game.level
        for y, row in enumerate(level["map"]):
            for x, symbol in enumerate(row):
                if symbol == "#":
                    continue
                bit = 1 << (y * 8 + x)
                if state[5] & bit:
                    continue
                here = self.center(x, y)
                for dx, dy in ((1, 0), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx >= 8 or ny >= 8 or level["map"][ny][nx] == "#":
                        continue
                    nbit = 1 << (ny * 8 + nx)
                    if state[5] & nbit:
                        continue
                    there = self.center(nx, ny)
                    self.line(frame, here, there, EARTH, width=2)
                    self.line(frame, here, there, CREAM, dotted=True)

    def warm_bed(self, frame, center, opened):
        if opened:
            self.petal(frame, center, 3, CORAL, SUN)
        else:
            self.disc(frame, center, 3, STONE)
            self.line(frame, (center[0] - 3, center[1]),
                      (center[0] + 3, center[1]), INK, width=2)

    def cold_bed(self, frame, center, opened):
        if opened:
            self.disc(frame, center, 3, BLUE)
            self.snowflake(frame, center, 3, WHITE)
        else:
            self.diamond(frame, center, 3, STONE)
            self.line(frame, (center[0], center[1] - 3),
                      (center[0], center[1] + 3), INK, width=2)

    def tile(self, frame, state, x, y, symbol):
        if symbol == "#":
            return
        center = self.center(x, y); bit = 1 << (y * 8 + x)
        self.disc(frame, center, 4, CREAM)
        if symbol == "a":
            self.warm_bed(frame, center, _open(state, "a"))
        elif symbol == "b":
            self.cold_bed(frame, center, _open(state, "b"))
        elif symbol == "M":
            self.diamond(frame, center, 4, VIOLET, hollow=True)
            self.diamond(frame, center, 2, WHITE)
            self.line(frame, (center[0] - 4, center[1] - 2),
                      (center[0] + 4, center[1] + 2), MAGENTA, dotted=True)
            if state[8] & bit:
                self.diamond(frame, center, 4, SUN, hollow=True)
        elif symbol == "!":
            if state[5] & bit:
                self.disc(frame, center, 4, EARTH)
                self.diamond(frame, center, 2, INK)
            else:
                self.diamond(frame, center, 4, AQUA)
                self.line(frame, (center[0] - 2, center[1] - 3),
                          (center[0] + 2, center[1] + 3), BLUE)
                self.line(frame, (center[0] + 2, center[1] - 3),
                          center, BLUE)
        elif symbol == "W":
            awake = bool(state[7] & bit)
            self.disc(frame, center, 4, AQUA if awake else BLUE)
            for radius in (3, 2, 1):
                angle = radius * math.pi / 2
                point = (center[0] + round(radius * math.cos(angle)),
                         center[1] + round(radius * math.sin(angle)))
                self.disc(frame, point, 1, SUN if awake else WHITE)
            if awake:
                self.petal(frame, center, 4, SUN, WHITE)
        elif symbol == "o":
            if state[6] & bit:
                self.disc(frame, center, 3, CREAM)
                self.line(frame, (center[0] - 3, center[1]),
                          (center[0] + 3, center[1]), STONE, dotted=True)
            else:
                self.petal(frame, center, 3, ROSE, SUN)
                self.line(frame, (center[0], center[1] - 4),
                          (center[0] + 2, center[1] - 6), LEAF)
        elif symbol == "G":
            ready = configuration_ready(self.game.level, state)
            self.petal(frame, center, 4 if ready else 3,
                       MAGENTA if ready else STONE, WHITE)
            if not ready:
                self.line(frame, (center[0] - 2, center[1]),
                          (center[0] + 2, center[1]), INK, width=2)
        elif symbol == ".":
            self.disc(frame, center, 2, CREAM)
            self.line(frame, (center[0] - 2, center[1] + 1),
                      (center[0] + 2, center[1] - 1), LEAF)
        else:  # S
            self.disc(frame, center, 3, CREAM)
            self.disc(frame, center, 2, CORAL, hollow=True)

    def traveler(self, frame, center, color=CORAL, lift=0):
        x, y = center; y -= lift
        self.diamond(frame, (x, y - 1), 4, color)
        self.diamond(frame, (x, y - 2), 2, SUN)
        self.line(frame, (x - 4, y - 1), (x - 6, y - 3), MAGENTA)
        self.line(frame, (x - 5, y - 2), (x - 7, y - 1), MAGENTA)
        self.line(frame, (x - 2, y + 3), (x - 3, y + 5), INK)
        self.line(frame, (x + 2, y + 3), (x + 3, y + 5), INK)

    def hud(self, frame, state):
        game = self.game
        # Season and clock are shape-coded: petal vs snowflake plus live beads.
        if state[2] == 0:
            self.petal(frame, (7, 4), 3, CORAL, SUN)
        else:
            self.snowflake(frame, (7, 4), 3, BLUE)
        for index in range(game.level["period"]):
            x = 17 + index * 25 // max(1, game.level["period"] - 1)
            if index < state[3]:
                self.diamond(frame, (x, 4), 2,
                             SUN if state[2] == 0 else BLUE)
            else:
                self.line(frame, (x - 1, 4), (x + 1, 4), STONE)
        if state[4]:
            self.diamond(frame, (49, 4), 3, VIOLET, hollow=True)
            self.line(frame, (47, 2), (51, 6), MAGENTA)
            self.line(frame, (51, 2), (47, 6), MAGENTA)
        else:
            self.disc(frame, (49, 4), 3, CREAM)
            self.line(frame, (46, 4), (52, 4), LEAF)
        # Two large wax seals support one recoverable mistaken audit.
        for index, x in enumerate((56, 62)):
            live = index < state[9]
            self.diamond(frame, (x, 4), 2, ROSE if live else RED,
                         hollow=not live)
        shown = game.budget_left
        if (game.anim_kind and game.pending_budget is not None
                and game.anim_progress >= max(1, game.anim_total - 1)):
            shown = game.pending_budget
        for index in range(game.budget_max):
            x = 5 + index * 54 // max(1, game.budget_max - 1)
            if index < shown:
                self.disc(frame, (x, 60), 1, CORAL)
            else:
                frame[60, x] = INK

    def landscape(self, frame, state):
        self.causeways(frame, state)
        for y, row in enumerate(self.game.level["map"]):
            for x, symbol in enumerate(row):
                self.tile(frame, state, x, y, symbol)

    def animation(self, frame, render_state):
        game = self.game
        if game.intro_mark:
            for radius in (3, 6, 9):
                self.disc(frame, (32, 33), radius, CORAL, hollow=True)
        if not game.anim_kind:
            return
        p = game.anim_progress; span = max(1, game.anim_total - 1)
        before, after = game.anim_before, game.pending_state
        if game.anim_kind in ("move", "well") and p < span:
            a = self.center(before[0], before[1]); b = self.center(after[0], after[1])
            point = (a[0] + (b[0] - a[0]) * p // span,
                     a[1] + (b[1] - a[1]) * p // span)
            lift = (4 * min(p, span - p)) // max(1, span // 2)
            self.traveler(frame, point, lift=lift)
            self.line(frame, a, point, SUN, dotted=True)
            if before[5] != after[5]:
                radius = max(1, 5 - 4 * p // span)
                self.diamond(frame, a, radius, AQUA, hollow=True)
        elif game.anim_kind == "wait" and p < span:
            center = self.center(before[0], before[1])
            self.disc(frame, center, 2 + 4 * min(p, span - p) // max(1, span),
                      ROSE, hollow=True)
            for angle in range(0, 360, 90):
                dx = round(5 * p * math.cos(math.radians(angle)) / span)
                dy = round(5 * p * math.sin(math.radians(angle)) / span)
                self.disc(frame, (center[0] + dx, center[1] + dy), 1, SUN)
        elif game.anim_kind == "blocked" and p < span:
            center = self.center(before[0], before[1])
            fold = min(p, span - p)
            self.diamond(frame, center, 5 + fold, RED, hollow=True)
            self.line(frame, (center[0] - 4, center[1] - 4),
                      (center[0] + 4, center[1] + 4), INK)
        elif game.anim_kind == "audit" and p < span:
            x = 5 + 54 * p // span
            self.line(frame, (x, 9), (x, 55), SUN, dotted=True)
            self.petal(frame, (x, 33), 2, ROSE, WHITE)
        elif game.anim_kind == "success":
            for radius in range(4, min(31, 5 + p * 4), 6):
                self.disc(frame, (32, 33), radius, SUN, hollow=True)
            for angle in range(0, 360, 45):
                length = 6 + 2 * p
                end = (32 + round(length * math.cos(math.radians(angle))),
                       33 + round(length * math.sin(math.radians(angle))))
                self.line(frame, (32, 33), end, CORAL, dotted=True)
            self.petal(frame, (32, 33), min(8, 3 + p), MAGENTA, WHITE)
        elif game.anim_kind == "loss" and p < span:
            inset = 27 * p // span
            self.line(frame, (3 + inset, 10), (3 + inset, 56), RED, width=2)
            self.line(frame, (60 - inset, 10), (60 - inset, 56), RED, width=2)
            for y in range(13, 55, 7):
                self.line(frame, (4 + inset, y), (59 - inset, y + 3), EARTH,
                          dotted=True)

        if after is not None and after[2] != before[2] and p < span:
            # One directional, nonflashing full-field weather front.
            edge = 5 + 54 * p // span
            color = BLUE if after[2] else SUN
            for y in range(10, 56, 5):
                self.line(frame, (5, y), (edge, y), color, dotted=True)
        if after is not None and after[4] != before[4] and p < span:
            center = self.center(after[0], after[1])
            self.diamond(frame, center, 2 + 5 * p // span, VIOLET, hollow=True)
        if game.anim_kind == "well" and p < span:
            center = self.center(after[0], after[1])
            for radius in range(2, 2 + p, 2):
                self.disc(frame, center, min(8, radius), AQUA, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game
        span = max(1, game.anim_total - 1)
        preview = (game.anim_kind is not None and game.pending_state is not None
                   and game.anim_progress >= span)
        render_state = game.pending_state if preview else game.state
        self.background(frame, render_state)
        self.landscape(frame, render_state)
        moving = (game.anim_kind in ("move", "well") and not preview)
        if not moving:
            self.traveler(frame, self.center(render_state[0], render_state[1]))
        self.hud(frame, render_state)
        self.animation(frame, render_state)
        return frame


class Q071(ARCBaseGame):
    def __init__(self):
        self.display = PilgrimDisplay(self); self.level = LEVELS[0]
        self.state = start_state(self.level); self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_before = self.state; self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None; self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(level), name=level["name"])
                  for level in LEVELS]
        super().__init__("q071", levels, Camera(0, 0, 64, 64, LEAF, LEAF, [self.display]),
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
        if after[10] == 2:
            kind, frames, terminal = "success", 7, "win"
        elif after[10] == 3:
            kind, frames, terminal = "loss", 7, "loss"
        elif action == 6:
            kind, frames, terminal = "audit", 6, None
        elif action == 5:
            kind, frames, terminal = "wait", 6, None
        elif self.level["map"][after[1]][after[0]] == "W":
            kind, frames, terminal = "well", 7, None
        else:
            kind, frames, terminal = "move", 7, None
        self.begin(kind, frames, before, after, budget, terminal)
