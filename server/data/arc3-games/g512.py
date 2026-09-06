# ARC-AGI-3 candidate task g512.

from __future__ import annotations

from copy import deepcopy
from typing import NamedTuple

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, BONE, ASH, SLATE, STONE, CINDER = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, EMBER, BLUE, GLASS, BRASS = 6, 7, 8, 9, 10, 11
COPPER, OXBLOOD, MOSS, VIOLET = 12, 13, 14, 15

ACTIVE, WIN, LOSS = 0, 2, 3
TERMINAL_INDEX = 9
HEX_ACTIONS = (1, 2, 3, 4, 5, 6)
HEX_DELTAS = {
    1: (1, 0), 2: (0, 1), 3: (-1, 1),
    4: (-1, 0), 5: (0, -1), 6: (1, -1),
}
class G512A(NamedTuple):
    position: tuple
    revealed: int
    has_key: bool
    collapsed: int
    used_apertures: int
    opened_doors: int
    strikes: int
    last_event: int
    free_action: int
    terminal: int


def hex_center(cell):
    q, r = cell
    return 30 + 7 * q + 3 * r, 25 + 6 * r


def hex_distance(left, right):
    dq = left[0] - right[0]
    dr = left[1] - right[1]
    return (abs(dq) + abs(dr) + abs(dq + dr)) // 2


def _move_cell(cell, aid, deltas=HEX_DELTAS):
    dq, dr = deltas[int(aid)]
    return cell[0] + dq, cell[1] + dr


def vault(name, start, moves, apertures, *, keys=(), doors=(),
          fragile=(), required_collapse=(), require_key=False,
          curriculum=()):
    route = [tuple(start)]
    for aid in moves:
        route.append(_move_cell(route[-1], aid))
    cells = tuple(dict.fromkeys(route))
    index = {cell: offset for offset, cell in enumerate(cells)}
    apertures = tuple(tuple(cell) for cell in apertures)
    aperture_masks = []
    for center in apertures:
        mask = 0
        for cell, offset in index.items():
            if hex_distance(center, cell) <= 1:
                mask |= 1 << offset
        aperture_masks.append(frozenset(
            cell for cell in cells if mask & (1 << index[cell])))
    initial_revealed = frozenset((tuple(start),))
    witness = [(6, *hex_center(cell)) for cell in apertures]
    position = tuple(start)
    for aid in moves:
        position = _move_cell(position, aid)
        witness.append((6, *hex_center(position)) if aid == 6 else aid)
    result = {
        "name": name,
        "cells": cells,
        "cell_index": index,
        "start": tuple(start),
        "goal": route[-1],
        "hex_audit_cell": tuple(start),
        "route": tuple(route),
        "apertures": apertures,
        "aperture_masks": tuple(aperture_masks),
        "initial_revealed": initial_revealed,
        "keys": tuple(tuple(cell) for cell in keys),
        "doors": tuple(tuple(cell) for cell in doors),
        "fragile": tuple(tuple(cell) for cell in fragile),
        "required_collapse": tuple(tuple(cell) for cell in required_collapse),
        "require_key": bool(require_key),
        "budget": len(witness),
        "witness": tuple(witness),
        "curriculum": tuple(curriculum),
    }
    covered = set(initial_revealed)
    for mask in aperture_masks:
        covered.update(mask)
    assert all(cell in covered for cell in route)
    return result


LEVELS = (
    vault(
        "First Ember", (0, 0), (1, 1), ((1, 0),),
        curriculum=("hex-east", "radius-one-aperture"),
    ),
    vault(
        "Descending Keyholes", (0, -2), (2, 2, 2, 2, 2, 2),
        ((0, -1), (0, 1), (0, 3)),
        curriculum=("hex-southeast", "two-information-cuts"),
    ),
    vault(
        "Brass Detour", (0, 0), (3, 6, 1, 1, 1, 1),
        ((0, 0), (2, 0), (4, 0)), keys=((-1, 1),), doors=((3, 0),),
        require_key=True,
        curriculum=("hex-southwest", "pointer-return", "key-door-detour"),
    ),
    vault(
        "Pressure Span", (3, 0), (4, 4, 4, 4, 4, 4),
        ((2, 0), (0, 0), (-2, 0)), doors=((-2, 0),), fragile=((2, 0),),
        required_collapse=((2, 0),),
        curriculum=("hex-west", "collapse-pressure-door"),
    ),
    vault(
        "Ashen Ascent", (0, 4), (5, 5, 5, 5, 5, 5),
        ((0, 3), (0, 1), (0, -1)),
        curriculum=("hex-northwest", "aperture-overlap"),
    ),
    vault(
        "Needle Causeway", (-1, 4), (6, 6, 6, 6, 6, 6),
        ((0, 3), (3, 0), (4, -1)), keys=((0, 3),), doors=((3, 0),),
        fragile=((2, 1),), required_collapse=((2, 1),),
        require_key=True,
        curriculum=("pointer-sixth-neighbor", "key", "collapse", "door"),
    ),
    vault(
        "Cinder Circuit", (0, 0), (1, 2, 3, 4, 5, 6),
        ((0, 0), (1, 1), (-1, 2)), keys=((1, 0),), doors=((1, 1),),
        fragile=((1, 0),), required_collapse=((1, 0),),
        require_key=True,
        curriculum=("hex-cycle", "future-route-cut", "opened-door-goal-cut"),
    ),
    vault(
        "Cinder Keyhole Catacomb", (0, 0),
        (5, 2, 1, 2, 3, 4, 5, 6, 6),
        ((0, 0), (1, 1), (-1, 2)),
        keys=((0, -1),), doors=((1, 1),), fragile=((1, 0),),
        required_collapse=((1, 0),), require_key=True,
        curriculum=("all-six-neighbors", "three-aperture-plan", "key-spur",
                    "future-reachability-collapse", "door-cut", "return-seal"),
    ),
)


def action_id(action):
    return int(action[0]) if isinstance(action, (tuple, list)) else int(action)


def action_tokens(level):
    pointer = tuple((6, *hex_center(cell)) for cell in level["cells"])
    return (1, 2, 3, 4, 5) + pointer


def encode_action(_level, action):
    if isinstance(action, (tuple, list)):
        return tuple(int(value) for value in action)
    return (int(action),)


def _bit(level, cell):
    index = level["cell_index"].get(tuple(cell))
    return 0 if index is None else 1 << index


def _mask(level, cells):
    result = 0
    for cell in cells:
        result |= _bit(level, cell)
    return result


def terrain_at(level, cell):
    cell = tuple(cell)
    if cell not in level["cell_index"]:
        return "wall"
    if cell == level["goal"]:
        return "goal"
    if cell in level["keys"]:
        return "key"
    if cell in level["doors"]:
        return "door"
    if cell in level["fragile"]:
        return "fragile"
    return "floor"


def hex_neighbor(_level, cell, action):
    return _move_cell(tuple(cell), action_id(action))


def _clicked_cell(level, action):
    if not isinstance(action, (tuple, list)) or len(action) != 3:
        return None
    x, y = int(action[1]), int(action[2])
    return min(level["cells"],
               key=lambda cell: abs(x - hex_center(cell)[0])
               + abs(y - hex_center(cell)[1]))


def action6_mode(level, state, action):
    if action_id(action) != 6:
        return "blocked"
    clicked = _clicked_cell(level, action)
    if clicked is None:
        return "blocked"
    for index, center in enumerate(level["apertures"]):
        if clicked == center and not state.used_apertures & (1 << index):
            return "aperture"
    return ("move" if clicked == hex_neighbor(level, state.position, 6)
            else "blocked")


def start_state(level):
    return G512A(
        level["start"], level["initial_revealed"], False, frozenset(), 0, 0,
        0, 0, 0, ACTIVE,
    )


def _warning(state, event):
    strikes = state.strikes + 1
    return state._replace(
        strikes=strikes, last_event=event,
        free_action=0,
        terminal=LOSS if strikes >= 2 else ACTIVE,
    )


def _goal_ready(level, state, mode):
    key_ok = (not level["require_key"] or state.has_key
              or mode == "without_key_gate")
    collapse_ok = set(level["required_collapse"]).issubset(state.collapsed)
    doors_ok = (_mask(level, level["doors"]) & state.opened_doors
                == _mask(level, level["doors"])
                or not level["doors"])
    return key_ok and collapse_ok and doors_ok


def _enter(level, state, target, aid, mode):
    bit = _bit(level, target)
    collapsed_block = (target in state.collapsed
                       and mode != "without_collapse")
    if not bit or target not in state.revealed or collapsed_block:
        return _warning(state, aid)
    terrain = terrain_at(level, target)
    prospective_collapse = state.collapsed
    if state.position in level["fragile"]:
        prospective_collapse = prospective_collapse | frozenset((state.position,))
    if terrain == "door":
        collapse_mask = _mask(level, level["required_collapse"])
        keyed = (not level["require_key"] or state.has_key
                 or mode == "without_key_gate")
        pressured = set(level["required_collapse"]).issubset(
            prospective_collapse)
        if not keyed or not pressured:
            return _warning(state, aid)
    if target == level["goal"] and not _goal_ready(level, state, mode):
        return _warning(state, aid)

    collapsed = prospective_collapse
    opened = state.opened_doors
    if terrain == "door":
        opened |= bit
    result = state._replace(
        position=target,
        has_key=state.has_key or terrain == "key",
        collapsed=collapsed,
        opened_doors=opened,
        last_event=aid,
        free_action=0,
    )
    if target == level["goal"] and _goal_ready(level, result, mode):
        result = result._replace(terminal=WIN)
    return result


def _step(level, state, aid, mode):
    return _enter(level, state, _move_cell(state.position, aid), aid, mode)


def _transition(level, state, action, mode="normal"):
    if state.terminal != ACTIVE:
        return state
    aid = action_id(action)
    if aid not in HEX_ACTIONS:
        return state
    if aid != 6:
        return _step(level, state, aid, mode)

    clicked = _clicked_cell(level, action)
    if clicked is None:
        return state
    for index, center in enumerate(level["apertures"]):
        bit = 1 << index
        if clicked == center and not state.used_apertures & bit:
            return state._replace(
                revealed=state.revealed | level["aperture_masks"][index],
                used_apertures=state.used_apertures | bit,
                last_event=60 + index,
                free_action=1 if mode == "without_information_cost" else 0,
            )
    expected = _move_cell(state.position, 6)
    if clicked == expected:
        return _step(level, state, 6, mode)
    if mode == "without_hex_adjacency":
        return _enter(level, state, clicked, 6, mode)
    return state


def transition(level, state, action):
    return _transition(level, state, action)


def without_hex_adjacency(level, state, action):
    return _transition(level, state, action, "without_hex_adjacency")


def without_information_cost(level, state, action):
    return _transition(level, state, action, "without_information_cost")


def without_key_gate(level, state, action):
    return _transition(level, state, action, "without_key_gate")


def without_collapse(level, state, action):
    return _transition(level, state, action, "without_collapse")


def action_cost(before, after):
    if (after == before or after.strikes > before.strikes
            or after.free_action):
        return 0
    return 1


def solved(_level, state):
    return state.terminal == WIN


def execute(level, actions, transition_fn=transition):
    state = start_state(level)
    budget = level["budget"]
    for action in actions:
        after = transition_fn(level, state, action)
        budget -= action_cost(state, after)
        state = after
    return state, budget


for _level in LEVELS:
    _state, _left = execute(_level, _level["witness"])
    assert solved(_level, _state) and _left == 0, (
        _level["name"], _state, _left, _level["witness"])
assert {action_id(action) for level in LEVELS
        for action in level["witness"]} == set(HEX_ACTIONS)


class G512B(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def pixel(frame, x, y, color):
        if 0 <= x < 64 and 0 <= y < 64:
            frame[y, x] = color

    @classmethod
    def line(cls, frame, start, end, color, dotted=False):
        x0, y0 = start; x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for index in range(steps + 1):
            if dotted and index % 3 == 1:
                continue
            x = x0 + (x1 - x0) * index // steps
            y = y0 + (y1 - y0) * index // steps
            cls.pixel(frame, x, y, color)

    @classmethod
    def hexagon(cls, frame, cell, color, inner=None):
        x, y = hex_center(cell)
        spans = (2, 3, 4, 4, 3, 2, 1)
        for dy, span in zip(range(-3, 4), spans):
            frame[y + dy, max(0, x - span):min(64, x + span + 1)] = color
        if inner is not None:
            for dy in range(-1, 2):
                frame[y + dy, max(0, x - 2):min(64, x + 3)] = inner

    @classmethod
    def outline_hex(cls, frame, center, color):
        x, y = center
        points = ((x, y - 5), (x + 5, y - 2), (x + 5, y + 2),
                  (x, y + 5), (x - 5, y + 2), (x - 5, y - 2))
        for left, right in zip(points, points[1:] + points[:1]):
            cls.line(frame, left, right, color)

    def background(self, frame):
        frame[:, :] = CINDER
        for r in range(-3, 6):
            for q in range(-5, 6):
                x, y = hex_center((q, r))
                if 4 <= x < 60 and 5 <= y < 56:
                    self.hexagon(frame, (q, r), STONE, CINDER)
        frame[0:3, :] = OXBLOOD
        frame[57:64, :] = STONE

    def tile(self, frame, level, state, cell):
        bit = _bit(level, cell)
        terrain = terrain_at(level, cell)
        visible = cell in state.revealed
        if not visible:
            self.hexagon(frame, cell, SLATE, CINDER)
            x, y = hex_center(cell)
            self.pixel(frame, x, y, ASH)
            return
        color = ASH if terrain == "floor" else STONE
        if terrain == "goal":
            color = MOSS
        elif terrain == "door":
            color = BRASS if not state.opened_doors & bit else ASH
        elif terrain == "fragile":
            color = EMBER
        elif terrain == "key":
            color = BLUE if not state.has_key else ASH
        if cell in state.collapsed:
            color = OXBLOOD
        self.hexagon(frame, cell, color, BONE if color in (ASH, STONE) else None)
        x, y = hex_center(cell)
        if terrain == "key" and not state.has_key:
            self.outline_hex(frame, (x - 2, y), PAPER)
            self.line(frame, (x + 1, y), (x + 5, y), PAPER)
            self.line(frame, (x + 4, y), (x + 4, y + 2), CINDER)
        elif terrain == "door":
            self.line(frame, (x - 3, y - 3), (x - 3, y + 3), CINDER)
            self.line(frame, (x, y - 3), (x, y + 3), CINDER)
            self.line(frame, (x + 3, y - 3), (x + 3, y + 3), CINDER)
            self.line(frame, (x - 4, y - 1), (x + 4, y - 1), PAPER)
            self.line(frame, (x - 4, y + 2), (x + 4, y + 2), CINDER)
        elif terrain == "goal":
            self.hexagon(frame, cell, MOSS, CINDER)
        elif terrain == "fragile" and cell not in state.collapsed:
            self.line(frame, (x - 3, y - 2), (x + 2, y + 2), PAPER,
                      dotted=True)
            self.line(frame, (x + 3, y - 2), (x - 2, y + 2), CINDER,
                      dotted=True)
        if cell in state.collapsed:
            self.line(frame, (x - 3, y - 2), (x + 3, y + 2), EMBER)
            self.line(frame, (x + 2, y - 3), (x - 2, y + 3), BRASS)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self.game; level = game.level; state = game.visual_state()
        self.background(frame)
        for cell in level["cells"]:
            for aid in (1, 2, 3):
                other = hex_neighbor(level, cell, aid)
                if other in level["cell_index"]:
                    self.line(frame, hex_center(cell), hex_center(other), SLATE)
        for cell in level["cells"]:
            self.tile(frame, level, state, cell)

        for index, cell in enumerate(level["apertures"]):
            x, y = hex_center(cell); used = bool(state.used_apertures & (1 << index))
            color = COPPER if used else BRASS
            for aid in HEX_ACTIONS:
                neighbor = _move_cell(cell, aid)
                nx, ny = hex_center(neighbor)
                self.line(frame, (x, y), ((x * 2 + nx) // 3,
                                           (y * 2 + ny) // 3), color)
            self.pixel(frame, x, y, PAPER if not used else COPPER)

        px, py = hex_center(state.position)
        self.hexagon(frame, state.position, MAGENTA, VIOLET)
        self.pixel(frame, px, py, PAPER)

        sixth = hex_neighbor(level, state.position, 6)
        sixth_bit = _bit(level, sixth)
        if sixth_bit:
            target = hex_center(sixth)
            priority = any(
                sixth == cell and not state.used_apertures & (1 << index)
                for index, cell in enumerate(level["apertures"]))
            self.outline_hex(frame, target, ROSE if priority else GLASS)
            if priority:
                self.outline_hex(frame, (target[0], target[1] + 1), BRASS)

        for index in range(game.budget_left):
            x = 3 + index * 4
            frame[59:62, x:x + 3] = BRASS
        remaining = len(level["apertures"]) - state.used_apertures.bit_count()
        for index in range(remaining):
            self.hexagon(frame, (-4 + index, 5), BLUE)
        for index in range(2):
            y = 6 + index * 8
            color = EMBER if index < state.strikes else MOSS
            self.outline_hex(frame, (59, y), color)
            if index < state.strikes:
                self.line(frame, (56, y - 3), (62, y + 3), PAPER)
                self.line(frame, (62, y - 3), (56, y + 3), EMBER)
            elif index == 0:
                self.line(frame, (57, y), (61, y), PAPER)
            else:
                self.line(frame, (59, y - 2), (59, y + 2), PAPER)

        if state.terminal == LOSS:
            self.line(frame, (16, 15), (48, 47), PAPER)
            self.line(frame, (48, 15), (16, 47), PAPER)
            self.line(frame, (13, 12), (51, 12), OXBLOOD)
            self.line(frame, (13, 50), (51, 50), OXBLOOD)

        kind = game.anim_kind
        if kind:
            progress = game.anim_progress
            direction = 1 if progress % 4 < 2 else -1
            if kind in ("move", "key", "door", "collapse"):
                target = game.pending_state.position
                tx, ty = hex_center(target)
                self.line(frame, (px, py), (tx, ty),
                          GLASS if progress % 2 else BRASS, dotted=True)
                self.pixel(frame, tx + direction, ty, PAPER)
            elif kind == "aperture":
                event = max(0, game.pending_state.last_event - 60)
                center = level["apertures"][min(event, len(level["apertures"]) - 1)]
                cx, cy = hex_center(center)
                radius = 1 + progress % 4
                for aid in HEX_ACTIONS:
                    nx, ny = hex_center(_move_cell(center, aid))
                    self.pixel(frame, cx + (nx - cx) * radius // 4,
                               cy + (ny - cy) * radius // 4, BRASS)
            elif kind == "blocked":
                color = BRASS if progress % 2 else COPPER
                self.line(frame, (2, 30), (6 + progress % 3, 30), color)
                self.line(frame, (61, 30), (57 - progress % 3, 30), color)
            elif kind == "warning":
                frame[29:35, 1 + progress % 4:5 + progress % 4] = EMBER
                frame[29:35, 59 - progress % 4:63 - progress % 4] = EMBER
                self.outline_hex(frame, (32, 8), PAPER if progress % 2 else EMBER)
                self.line(frame, (29, 5), (35, 11), EMBER)
            elif kind == "loss":
                color = EMBER if progress % 2 else BRASS
                self.line(frame, (16, 15), (48, 47), color)
                self.line(frame, (48, 15), (16, 47), color)
                self.line(frame, (13, 12), (51, 12), OXBLOOD)
                self.line(frame, (13, 50), (51, 50), OXBLOOD)
            elif kind == "success":
                for y in range(4, min(57, 8 + progress * 8)):
                    self.pixel(frame, 32 + (y % 3) - 1, y, BRASS)
        return frame


class G512(ARCBaseGame):
    def __init__(self):
        self.display = G512B(self)
        self.level = None; self.state = None
        self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_total = 0
        self.anim_left = 0; self.anim_progress = 0
        self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item),
                        name=item["name"]) for item in LEVELS]
        super().__init__("g512", levels,
                         Camera(0, 0, 64, 64, CINDER, CINDER, [self.display]),
                         False, len(levels), list(HEX_ACTIONS))

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_total = 0
        self.anim_left = 0; self.anim_progress = 0
        self.pending_state = None; self.pending_budget = None
        self.pending_terminal = None

    def visual_state(self):
        return self.pending_state if self.anim_kind and self.anim_progress >= 4 else self.state

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames
        self.anim_progress = 0; self.pending_state = after
        self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.anim_total = self.anim_left = 0
        self.anim_progress = 0; self.pending_state = self.pending_budget = None
        self.pending_terminal = None
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
            self.complete_action(); return
        action = aid
        if aid == 6:
            action = (6, int(self.action.data.get("x", -99)),
                      int(self.action.data.get("y", -99)))
        before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left); return
        cost = action_cost(before, after); budget = self.budget_left - cost
        won = after.terminal == WIN
        lost = after.terminal == LOSS or (budget <= 0 and not won)
        if lost and after.terminal != LOSS:
            after = after._replace(terminal=LOSS)
        if won:
            kind, frames, terminal = "success", 6, "win"
        elif lost:
            kind, frames, terminal = "loss", 6, "loss"
        elif after.strikes > before.strikes:
            kind, frames, terminal = "warning", 6, None
        elif after.used_apertures != before.used_apertures:
            kind, frames, terminal = "aperture", 7, None
        elif after.has_key and not before.has_key:
            kind, frames, terminal = "key", 7, None
        elif after.opened_doors != before.opened_doors:
            kind, frames, terminal = "door", 7, None
        elif after.collapsed != before.collapsed:
            kind, frames, terminal = "collapse", 7, None
        else:
            kind, frames, terminal = "move", 7, None
        self.begin(kind, frames, after, budget, terminal)


if __name__ == "__main__":
    print("q041-v2 ok")
