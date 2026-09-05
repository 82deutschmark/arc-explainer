# ARC-AGI-3 candidate task g517.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, LINEN, MIST, CLAY, BARK, INK = 0, 1, 2, 3, 4, 5
BERRY, ROSE, RED, BLUE, SKY, HONEY, APRICOT, GREEN, SAGE, LAVENDER = 6, 7, 8, 9, 10, 11, 12, 14, 14, 15
WIDTH = HEIGHT = 6
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
ARROWS = {"^": (0, -1), "v": (0, 1), "<": (-1, 0), ">": (1, 0)}


def idx(x, y):
    return y * WIDTH + x


def scene(name, left, right, hazards, budget, **rules):
    base = {
        "name": name,
        "grids": (tuple(left), tuple(right)),
        "hazards": tuple(tuple(tuple(idx(x, y) for x, y in pane) for pane in phase)
                         for phase in hazards),
        "budget": budget,
        "transform": "identity",
        "phases": len(hazards),
        "goal_phase": None,
    }
    base.update(rules)
    return base


OPEN = (
    "######",
    "#S...#",
    "#....#",
    "#....#",
    "#...G#",
    "######",
)


LEVELS = [
    scene("Borrowed Map", OPEN, OPEN,
          ((((2, 1), (3, 3)), ((1, 2), (3, 2))),), 15),
    scene("Folded Warning",
          ("######", "#S...#", "#.##.#", "#....#", "#.#.G#", "######"),
          ("######", "#S...#", "#.#..#", "#....#", "#.##G#", "######"),
          ((((3, 1),), ((2, 1),)),), 17, transform="mirror"),
    scene("Two-Breath Weather", OPEN, OPEN,
          ((((2, 1), (2, 3)), ((1, 2), (3, 3))),
           (((3, 1), (3, 2)), ((2, 2), (3, 1)))), 18,
          transform="rotate", goal_phase=1),
    scene("Stitched Latch",
          ("######", "#SL..#", "#.####", "#..###", "#..DG#", "######"),
          ("######", "#SLDG#", "#.####", "#....#", "#....#", "######"),
          ((((3, 1),), ((2, 3),)),), 15),
    scene("Held Hem",
          ("######", "#S.P.#", "#.#..#", "#....#", "#...G#", "######"),
          ("######", "#S.HG#", "#.####", "#....#", "#....#", "######"),
          ((((2, 3),), ((3, 3),)),
           (((2, 2),), ((2, 3),))), 19, transform="mirror", goal_phase=1),
    scene("Arrow Weave",
          ("######", "#SL>.#", "#.#v.#", "#....#", "#...G#", "######"),
          ("######", "#S...#", "#v##.#", "#v.DG#", "######", "######"),
          ((((3, 3),), ((2, 1),)),), 14),
    scene("Changing Loom",
          ("######", "#SL>.#", "#.#..#", "#....#", "#...G#", "######"),
          ("######", "#S.DG#", "#.##.#", "#....#", "#....#", "######"),
          ((((3, 1), (2, 3)), ((2, 3),)),
           (((3, 2),), ((2, 1), (3, 3)))), 21,
          transform="mirror", goal_phase=1),
    scene("Split Couriers",
          ("######", "#SLP.#", "#.#v.#", "#..###", "#..DG#", "######"),
          ("######", "#SLHG#", "#.##.#", "#>...#", "#....#", "######"),
          ((((2, 4), (4, 2)), ((2, 3), (3, 3))),
           (((3, 2), (2, 3)), ((1, 3), (3, 1)))), 25,
          transform="rotate", goal_phase=1),
]


def find_tile(grid, tile):
    for y, row in enumerate(grid):
        for x, value in enumerate(row):
            if value == tile:
                return idx(x, y)
    return -1


def point(index):
    return index % WIDTH, index // WIDTH


def tile_at(level, pane, index):
    x, y = point(index)
    return level["grids"][pane][y][x]


def transform_point(level, index):
    x, y = point(index)
    if level["transform"] == "mirror":
        x = WIDTH - 1 - x
    elif level["transform"] == "rotate":
        x, y = WIDTH - 1 - x, HEIGHT - 1 - y
    return idx(x, y)


def starts(level):
    return tuple(find_tile(grid, "S") for grid in level["grids"])


def goals(level):
    return tuple(find_tile(grid, "G") for grid in level["grids"])


def start_state(level):
    return starts(level), 0, 0, 0, 0, 2, 0


def hold_open(level, positions, gate_pane):
    other = 1 - gate_pane
    return tile_at(level, other, positions[other]) == "P"


def configuration_solved(level, state):
    positions, _active, _latches, _pending, phase, _safety, _terminal = state
    phase_ok = level["goal_phase"] is None or phase == level["goal_phase"]
    return positions == goals(level) and phase_ok


def transition(level, state, action):
    positions, active, latches, pending, phase, safety, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    if action == 5:
        after = positions, 1 - active, latches, pending, phase, safety, terminal
        return after[:-1] + (2,) if configuration_solved(level, after) else after
    if action == 6:
        if level["phases"] < 2:
            return state
        if pending == 0:
            return positions, active, latches, 1, phase, safety, terminal
        phase = 1 - phase
        pending = 0
        occupied_thorn = any(positions[pane] in level["hazards"][phase][pane]
                             for pane in (0, 1))
        if occupied_thorn:
            safety -= 1
            terminal = 3 if safety <= 0 else 0
        after = positions, active, latches, pending, phase, safety, terminal
        return after[:-1] + (2,) if not terminal and configuration_solved(level, after) else after

    dx, dy = DIRS[action]
    x, y = point(positions[active])
    nx, ny = x + dx, y + dy
    if not (0 <= nx < WIDTH and 0 <= ny < HEIGHT):
        return state
    destination = idx(nx, ny)
    tile = tile_at(level, active, destination)
    if tile == "#":
        return state
    if tile == "D" and not (latches & (1 << (1 - active))):
        return state
    if tile == "H" and not hold_open(level, positions, active):
        return state
    if tile in ARROWS and ARROWS[tile] != (dx, dy):
        return state
    if destination in level["hazards"][phase][active]:
        safety -= 1
        return positions, active, latches, pending, phase, safety, 3 if safety <= 0 else 0
    moved = list(positions)
    moved[active] = destination
    positions = tuple(moved)
    if tile == "L":
        latches |= 1 << active
    after = positions, active, latches, pending, phase, safety, terminal
    return after[:-1] + (2,) if configuration_solved(level, after) else after


def action_cost(state, after):
    if after == state:
        return 0
    if after[5] < state[5] and after[:5] == state[:5]:
        return 0
    return 1


def solved(_level, state):
    return state[-1] == 2


class G517A(RenderableUserDisplay):
    CELL = 4
    ORIGINS = ((3, 25), (37, 25))

    def __init__(self, game):
        self.game = game

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 3 == 1:
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    def center(self, pane, index):
        x, y = point(index); ox, oy = self.ORIGINS[pane]
        return ox + x * self.CELL + 2, oy + y * self.CELL + 2

    def background(self, frame):
        frame[:, :] = PAPER
        frame[2:55, 1:30] = LINEN
        frame[2:55, 34:63] = MIST
        for y in range(4, 55, 8):
            frame[y, 3 + y % 5:29:9] = HONEY
            frame[y + 3, 37 + y % 4:62:10] = SKY
        for y in range(3, 56, 4):
            self.line(frame, (30, y), (33, y + 3), BERRY)
            self.line(frame, (33, y), (30, y + 3), SKY)
            self.disc(frame, (31 + (y // 4) % 2, y + 1), 1, HONEY)
        for x in range(2, 63, 8):
            self.disc(frame, (x, 54 + x % 3), 2, LINEN)

    def courier(self, frame, center, pane, active, scale=1):
        x, y = center
        if pane == 0:
            self.disc(frame, center, 2 + scale, SKY)
            self.disc(frame, (x - 1, y - 1), 1, PAPER)
            self.line(frame, (x - 3, y + 2), (x + 2, y + 3), BLUE)
        else:
            radius = 3 + scale
            for dy in range(radius):
                frame[max(0, y + 2 - dy), max(0, x - dy):min(64, x + dy + 1)] = ROSE
            self.line(frame, (x, y - 3), (x, y + 3), BERRY)
        if active:
            self.disc(frame, center, 5, INK, hollow=True)
            self.disc(frame, (x, y - 6), 1, INK)

    def thorn(self, frame, center, phase):
        x, y = center
        self.disc(frame, center, 3, LAVENDER if phase else APRICOT, hollow=True)
        if phase:
            self.line(frame, (x - 3, y), (x + 3, y), INK, dotted=True)
            self.line(frame, (x, y - 3), (x, y + 3), INK, dotted=True)
        else:
            self.line(frame, (x - 2, y - 2), (x + 2, y + 2), INK)
            self.line(frame, (x + 2, y - 2), (x - 2, y + 2), INK)

    def floor_tile(self, frame, pane, index, tile):
        center = self.center(pane, index); x, y = center
        self.disc(frame, center, 3, LINEN if pane == 0 else PAPER)
        self.disc(frame, center, 3, CLAY, hollow=True)
        if tile == "G":
            self.disc(frame, center, 3, GREEN, hollow=True)
            self.disc(frame, center, 1, HONEY)
        elif tile == "L":
            down = bool(self.game.state[2] & (1 << pane))
            self.disc(frame, center, 2 if down else 3, SAGE)
            self.disc(frame, center, 1, BARK, hollow=not down)
        elif tile == "P":
            held = tile_at(self.game.level, pane, self.game.state[0][pane]) == "P"
            self.disc(frame, center, 3, APRICOT if held else HONEY, hollow=not held)
            self.line(frame, (x - 2, y), (x + 2, y), BARK)
        elif tile in ("D", "H"):
            open_gate = ((tile == "D" and self.game.state[2] & (1 << (1 - pane)))
                         or (tile == "H" and hold_open(self.game.level, self.game.state[0], pane)))
            self.line(frame, (x - 3, y + 3), (x - 3, y - 3), SAGE)
            self.line(frame, (x + 3, y + 3), (x + 3, y - 3), SAGE)
            if open_gate:
                self.line(frame, (x - 3, y - 3), (x - 5, y - 5), GREEN)
                self.line(frame, (x + 3, y - 3), (x + 5, y - 5), GREEN)
            else:
                self.line(frame, (x - 3, y - 2), (x + 3, y + 2), BERRY)
                self.line(frame, (x + 3, y - 2), (x - 3, y + 2), BERRY)
        elif tile in ARROWS:
            dx, dy = ARROWS[tile]
            self.line(frame, (x - dx * 2, y - dy * 2), (x + dx * 2, y + dy * 2), BLUE)
            self.line(frame, (x + dx * 2, y + dy * 2), (x + dx * 2 - dy * 2, y + dy * 2 + dx * 2), BLUE)
            self.line(frame, (x + dx * 2, y + dy * 2), (x + dx * 2 + dy * 2, y + dy * 2 - dx * 2), BLUE)

    def pane(self, frame, pane):
        level = self.game.level; grid = level["grids"][pane]
        for y, row in enumerate(grid):
            for x, tile in enumerate(row):
                if tile != "#":
                    index = idx(x, y)
                    self.floor_tile(frame, pane, index, tile)
                    for dx, dy in ((1, 0), (0, 1)):
                        nx, ny = x + dx, y + dy
                        if nx < WIDTH and ny < HEIGHT and grid[ny][nx] != "#":
                            self.line(frame, self.center(pane, index), self.center(pane, idx(nx, ny)), CLAY, dotted=True)
        other = 1 - pane
        for hazard in level["hazards"][self.game.state[4]][other]:
            projected = transform_point(level, hazard)
            self.thorn(frame, self.center(pane, projected), self.game.state[4])

    def projected_thorn_overlay(self, frame, pane):
        level = self.game.level
        other = 1 - pane
        for hazard in level["hazards"][self.game.state[4]][other]:
            projected = transform_point(level, hazard)
            x, y = self.center(pane, projected)
            if self.game.state[4]:
                frame[max(0, y - 1):min(64, y + 2), max(0, x - 4)] = LAVENDER
                frame[max(0, y - 1):min(64, y + 2), min(63, x + 4)] = LAVENDER
                frame[max(0, y - 4), max(0, x - 1):min(64, x + 2)] = LAVENDER
                frame[min(63, y + 4), max(0, x - 1):min(64, x + 2)] = LAVENDER
            else:
                for dx, dy in ((-4, -4), (4, -4), (-4, 4), (4, 4)):
                    if 0 <= x + dx < 64 and 0 <= y + dy < 64:
                        frame[y + dy, x + dx] = INK

    def hud(self, frame):
        g = self.game
        for index in range(2):
            center = (6 + index * 8, 8)
            self.disc(frame, center, 3, SAGE if index < g.state[5] else CLAY, hollow=index >= g.state[5])
            self.line(frame, (center[0], center[1] - 3), (center[0] + 3, center[1] - 5), BARK)
        if g.level["transform"] == "mirror":
            self.disc(frame, (27, 9), 3, SKY, hollow=True); self.disc(frame, (37, 9), 3, ROSE, hollow=True)
            self.line(frame, (30, 5), (34, 13), INK)
        elif g.level["transform"] == "rotate":
            for dx, dy in ((0, -4), (4, 0), (0, 4), (-4, 0)):
                self.line(frame, (32, 9), (32 + dx, 9 + dy), LAVENDER)
                self.disc(frame, (32 + dx, 9 + dy), 1, INK)
        if g.level["phases"] > 1:
            self.disc(frame, (50, 8), 4, SKY if g.state[4] == 0 else LAVENDER, hollow=g.state[4] == 1)
            if g.state[4] == 0:
                self.line(frame, (46, 8), (54, 8), HONEY)
            else:
                self.line(frame, (48, 5), (52, 11), INK)
            if g.state[3]:
                self.disc(frame, (43, 8), 2, BERRY)
                self.line(frame, (43, 10), (32, 17), BERRY, dotted=True)
        offsets = ((0, -2), (2, 0), (0, 2), (-2, 0))
        for group in range((g.budget_max + 3) // 4):
            cx = 4 + group * 8; cy = 60
            self.disc(frame, (cx, cy), 1, BARK)
            for petal, (dx, dy) in enumerate(offsets):
                action = group * 4 + petal
                if action >= g.budget_max:
                    continue
                if action < g.budget_left:
                    self.disc(frame, (cx + dx, cy + dy), 1, SKY if group % 2 == 0 else ROSE)
                else:
                    frame[cy + dy, cx + dx] = CLAY

    def animation(self, frame):
        g = self.game
        if g.intro_mark:
            self.line(frame, (5, 18), (27, 15), HONEY, dotted=True)
            self.line(frame, (37, 15), (59, 18), SKY, dotted=True)
        if not g.anim_kind:
            return
        p = g.anim_progress
        if g.anim_kind in ("move", "latch", "success"):
            pane = g.anim_pane
            a = self.center(pane, g.anim_from); b = self.center(pane, g.anim_to)
            x = a[0] + (b[0] - a[0]) * p // g.anim_total
            y = a[1] + (b[1] - a[1]) * p // g.anim_total - p * (g.anim_total - p) // max(2, g.anim_total)
            self.courier(frame, (x, y), pane, True)
            if g.anim_kind == "latch":
                span = 28 * p // g.anim_total
                self.line(frame, (32, 22), (32, 22 + span), SAGE, dotted=True)
            elif g.anim_kind == "success":
                for goal_pane, goal in enumerate(g.pending_state[0]):
                    center = self.center(goal_pane, goal)
                    radius = 3 + p
                    self.disc(frame, center, radius, GREEN if goal_pane == 0 else BERRY,
                              hollow=True)
                    for dx, dy in ((0, -radius), (radius, 0), (0, radius), (-radius, 0)):
                        self.disc(frame, (center[0] + dx, center[1] + dy), 1, HONEY)
                self.line(frame, (32, 53), (32, max(17, 53 - p * 6)), GREEN, dotted=True)
        elif g.anim_kind == "switch":
            y = 18 + p * 5
            self.disc(frame, (32, min(53, y)), 2, SKY if g.pending_state[1] == 0 else ROSE)
        elif g.anim_kind == "signal":
            y = 17 + p * 6
            y = min(53, y)
            self.disc(frame, (32, y), 2, BERRY)
            self.disc(frame, (32, max(17, y - 4)), 1, HONEY)
        elif g.anim_kind in ("hazard", "loss"):
            pane = g.anim_pane
            source = self.center(pane, g.anim_from)
            impact = self.center(pane, g.anim_to)
            half = max(1, g.anim_total // 2)
            travel = p if p <= half else g.anim_total - p
            x = source[0] + (impact[0] - source[0]) * travel // half
            y = source[1] + (impact[1] - source[1]) * travel // half
            self.thorn(frame, impact, g.pending_state[4])
            if source == impact:
                x += (-1) ** p * min(2, p)
                self.disc(frame, impact, 3 + p // 2, RED, hollow=True)
            self.courier(frame, (x, y), pane, True)
            if g.anim_kind == "loss":
                self.line(frame, (4 + p * 3, 20), (60 - p * 3, 53), RED)
        elif g.anim_kind == "blocked":
            pane = g.state[1]; center = self.center(pane, g.state[0][pane])
            dx, dy = DIRS.get(g.anim_action, (0, 0))
            self.courier(frame, (center[0] + dx * (p % 2), center[1] + dy * (p % 2)), pane, True)
            self.line(frame, (center[0] + dx * 4 - dy * 2, center[1] + dy * 4 - dx * 2),
                      (center[0] + dx * 4 + dy * 2, center[1] + dy * 4 + dx * 2), BERRY)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame)
        self.pane(frame, 0); self.pane(frame, 1)
        moving = self.game.anim_kind in ("move", "latch", "success")
        for pane, position in enumerate(self.game.state[0]):
            if not (moving and pane == self.game.anim_pane):
                self.courier(frame, self.center(pane, position), pane, pane == self.game.state[1])
        self.projected_thorn_overlay(frame, 0)
        self.projected_thorn_overlay(frame, 1)
        self.hud(frame)
        self.animation(frame)
        return frame


class G517(ARCBaseGame):
    def __init__(self):
        self.display = G517A(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.anim_pane = 0
        self.anim_action = 0
        self.pending_state = None
        self.pending_budget = None
        self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("q061", levels, Camera(0, 0, 64, 64, PAPER, PAPER, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = 0
        self.anim_pane = 0
        self.anim_action = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True

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
        action = self.action.id.value
        if action == 0:
            self.complete_action()
            return
        self.intro_mark = False
        before = self.state
        after = transition(self.level, before, action)
        self.anim_action = action
        self.anim_pane = before[1]
        self.anim_from = before[0][before[1]]
        self.anim_to = after[0][before[1]]
        if action in DIRS:
            x, y = point(self.anim_from)
            dx, dy = DIRS[action]
            if 0 <= x + dx < WIDTH and 0 <= y + dy < HEIGHT:
                self.anim_to = idx(x + dx, y + dy)
        if after == before:
            self.begin("blocked", 4, before, self.budget_left)
            return
        budget = self.budget_left - action_cost(before, after)
        won = solved(self.level, after)
        lost = after[-1] == 3 or (budget <= 0 and not won)
        if won:
            kind, frames = "success", 7
        elif lost:
            kind, frames = "loss", 7
        elif after[5] < before[5]:
            if action == 6:
                for pane in (0, 1):
                    if before[0][pane] in self.level["hazards"][after[4]][pane]:
                        self.anim_pane = pane
                        self.anim_from = self.anim_to = before[0][pane]
                        break
            kind, frames = "hazard", 6
        elif action == 5:
            kind, frames = "switch", 5
        elif action == 6:
            kind, frames = "signal", 7
        elif after[2] != before[2]:
            kind, frames = "latch", 7
        else:
            kind, frames = "move", 5
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
