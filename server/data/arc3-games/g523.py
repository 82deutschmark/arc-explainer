# ARC-AGI-3 candidate task g523.

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


WHITE, PEARL, IRON, STEEL, CHARCOAL, BLACK = 0, 1, 2, 3, 4, 5
HAZARD, RED, BRASS, RUST, GREEN, VIOLET = 6, 8, 11, 12, 14, 15


def depot(name, length, start, tasks, transfers, scales, goal, budget, **rules):
    item = {
        "name": name,
        "length": length,
        "start": tuple(start),
        "tasks": tuple(tuple(task) for task in tasks),
        "transfers": tuple(transfers),
        "scales": tuple(tuple(row) for row in scales),
        "goal": tuple(goal),
        "budget": budget,
        "capacity": (3, 3),
        "helmet_gates": (),
        "debt_gates": (),
        "witness": tuple(-1 for _ in tasks),
    }
    item.update(rules)
    item["helmet_gates"] = tuple(tuple(gate) for gate in item["helmet_gates"])
    item["debt_gates"] = tuple(tuple(gate) for gate in item["debt_gates"])
    item["witness"] = tuple(item["witness"])
    return item


LEVELS = [
    depot("First Weight", 5, (0, 0, 0, 0), ((0, 2, 1),), (), ((1,), (1,)),
          (0, 0, 0, 0), 7),
    depot("Aligned Handoff", 6, (2, 0, 1, 0), ((1, 4, 1),), (2,), ((1,), (3,)),
          (2, 2, 0, 0), 14),
    depot("Helmet Gate", 7, (2, 2, 0, 0), ((1, 5, 1),), (2,), ((1,), (4,)),
          (2, 2, 0, 0), 13, helmet_gates=((1, 3),)),
    depot("Weight Limit", 7, (2, 2, 0, 0), ((1, 4, 2), (1, 5, 2)), (2,),
          ((1,), (3,)), (2, 2, 0, 0), 19, capacity=(3, 2),
          helmet_gates=((1, 3),)),
    depot("Debt Passage", 7, (2, 2, 0, 0), ((1, 4, 1), (1, 6, 1)), (2,),
          ((1,), (3, 6)), (2, 2, 0, 0), 17, capacity=(3, 2),
          helmet_gates=((1, 3),), debt_gates=((1, 4, 0),)),
    depot("Witness Bay", 7, (2, 0, 1, 0), ((0, 5, 1),), (2,), ((4,), (1,)),
          (2, 4, 0, 0), 14, helmet_gates=((0, 3),), witness=(4,)),
    depot("Double Customs", 7, (2, 2, 0, 0),
          ((0, 4, 1), (1, 4, 1), (1, 6, 1)), (2,), ((3,), (3, 6)),
          (2, 2, 0, 0), 23, capacity=(2, 1),
          helmet_gates=((0, 3), (1, 3)), debt_gates=((1, 4, 0),)),
    depot("Iron Porters", 7, (2, 0, 1, 0),
          ((0, 5, 1), (1, 5, 1), (1, 6, 1)), (4,), ((4,), (4, 6)),
          (4, 4, 0, 0), 24, capacity=(1, 1),
          helmet_gates=((0, 3),), debt_gates=((1, 5, 1),),
          witness=(4, 4, 4)),
]


def start_state(level):
    pa, pb, active, helmet = level["start"]
    return pa, pb, active, helmet, 0, 0, 0, 2, 0


def _position(state, owner):
    return state[owner]


def _debt(state, owner):
    return state[5 + owner]


def _movement_allowed(level, state, owner, old, new):
    edge = min(old, new)
    if (owner, edge) in level["helmet_gates"] and state[3] != owner:
        return False
    for gate_owner, gate_edge, maximum in level["debt_gates"]:
        if owner == gate_owner and edge == gate_edge and _debt(state, owner) > maximum:
            return False
    return True


def configuration_solved(level, state):
    done = (1 << len(level["tasks"])) - 1
    return (state[4] == done and state[5] == 0 and state[6] == 0
            and state[:4] == level["goal"])


def transition(level, state, action):
    pa, pb, active, helmet, done, debt_a, debt_b, audits, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    values = [pa, pb]
    debts = [debt_a, debt_b]
    if action in (1, 2):
        old = values[active]
        new = old + (-1 if action == 1 else 1)
        if not 0 <= new < level["length"]:
            return state
        if not _movement_allowed(level, state, active, old, new):
            return state
        values[active] = new
        return values[0], values[1], active, helmet, done, debts[0], debts[1], audits, 0
    if action == 3:
        return pa, pb, 1 - active, helmet, done, debt_a, debt_b, audits, 0
    if action == 4:
        if active != helmet or pa != pb or pa not in level["transfers"]:
            return state
        return pa, pb, active, 1 - helmet, done, debt_a, debt_b, audits, 0
    if action == 6:
        if configuration_solved(level, state):
            return pa, pb, active, helmet, done, debt_a, debt_b, audits, 2
        audits -= 1
        return pa, pb, active, helmet, done, debt_a, debt_b, audits, 3 if audits <= 0 else 0

    other = 1 - active
    for index, (owner, position, weight) in enumerate(level["tasks"]):
        if done & (1 << index) or owner != active or position != values[active]:
            continue
        witness = level["witness"][index]
        witnessed = witness < 0 or values[other] == witness
        if helmet == active and witnessed and debts[active] + weight <= level["capacity"][active]:
            done |= 1 << index
            debts[active] += weight
            return pa, pb, active, helmet, done, debts[0], debts[1], audits, 0
        break
    if debts[active] and values[active] in level["scales"][active]:
        debts[active] -= 1
        return pa, pb, active, helmet, done, debts[0], debts[1], audits, 0
    return state


def action_cost(before, after):
    if after == before or after[7] < before[7] or after[-1] in (2, 3):
        return 0
    return 1


def solved(_level, state):
    return state[-1] == 2


class G523A(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

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
                left, right = max(0, cx - width), min(64, cx + width + 1)
                frame[y, left:right] = color

    @staticmethod
    def rect(frame, x0, y0, x1, y1, color, hollow=False):
        x0, x1 = max(0, x0), min(63, x1); y0, y1 = max(0, y0), min(63, y1)
        if hollow:
            frame[y0, x0:x1 + 1] = color; frame[y1, x0:x1 + 1] = color
            frame[y0:y1 + 1, x0] = color; frame[y0:y1 + 1, x1] = color
        else:
            frame[y0:y1 + 1, x0:x1 + 1] = color

    def xs(self):
        n = self.game.level["length"]
        return tuple(7 + index * 50 // max(1, n - 1) for index in range(n))

    @staticmethod
    def tag_direction(owner, x):
        direction = -1 if owner == 0 else 1
        if x < 17:
            direction = 1
        elif x > 47:
            direction = -1
        return direction

    def background(self, frame):
        frame[:, :] = BLACK
        self.rect(frame, 2, 3, 61, 55, CHARCOAL, hollow=True)
        for x in range(5, 61, 8):
            self.rect(frame, x, 5, x + 3, 52, STEEL, hollow=True)
        for y in (17, 27, 39, 50):
            frame[y, 3:61] = IRON
            frame[y + 1, 4:60:4] = RUST
        for y in range(6, 54, 7):
            frame[y, 6 + y % 5:59:11] = STEEL
        for x, y in ((4, 4), (59, 4), (4, 54), (59, 54)):
            self.diamond(frame, (x, y), 1, BRASS)

    def porter(self, frame, owner, x, selected, helmet, debts, offset=(0, 0)):
        x += offset[0]; y = (21, 44)[owner] + offset[1]
        if owner == 0:
            for row in range(6):
                frame[y - 4 + row, max(0, x - row):min(64, x + row + 1)] = RUST
            self.line(frame, (x, y - 4), (x, y + 5), WHITE)
            frame[y + 2:y + 5, max(0, x - 3):min(64, x + 4):2] = IRON
        else:
            self.rect(frame, x - 4, y - 4, x - 2, y + 4, STEEL)
            self.rect(frame, x + 2, y - 4, x + 4, y + 4, STEEL)
            self.rect(frame, x - 4, y, x + 4, y + 2, RUST)
            frame[y - 2:y, x - 2:x + 3:2] = WHITE
        if selected:
            self.rect(frame, x - 6, y - 6, x + 6, y + 6, WHITE, hollow=True)
            frame[y - 7, x - 3:x + 4:2] = BRASS
        if helmet:
            self.helmet(frame, x, y - 6)
        capacity = self.game.level["capacity"][owner]
        direction = self.tag_direction(owner, x)
        anchor = (x + direction * 4, y + 4)
        self.line(frame, anchor, (x + direction * (6 + capacity * 3), y + 6),
                  BRASS if debts else STEEL, dotted=True)
        for index in range(capacity):
            tx = x + direction * (7 + index * 3)
            filled = index < debts
            self.diamond(frame, (tx, y + 6), 2 if filled else 1,
                         BRASS if filled else STEEL, hollow=True)
            if filled:
                frame[y + 6, tx] = RUST

    def helmet(self, frame, x, y):
        self.rect(frame, x - 4, y - 2, x + 4, y, BRASS)
        frame[y - 4:y - 1, x - 2:x + 3] = IRON
        frame[y - 3, x] = WHITE

    def static_geometry(self, frame):
        g = self.game; xs = self.xs(); level = g.level
        frame[10, xs[0]:xs[-1] + 1] = IRON
        frame[11, xs[0]:xs[-1] + 1:3] = BRASS
        for position in level["transfers"]:
            x = xs[position]
            self.rect(frame, x - 2, 13, x + 2, 51, STEEL, hollow=True)
            frame[15:50:4, x] = WHITE
            if g.state[0] == position and g.state[1] == position:
                self.diamond(frame, (x, 32), 3, BRASS, hollow=True)
        for owner, edge in level["helmet_gates"]:
            x = (xs[edge] + xs[edge + 1]) // 2; y = (21, 44)[owner]
            open_gate = g.state[3] == owner
            color = WHITE if open_gate else HAZARD
            if open_gate:
                self.rect(frame, x - 4, y - 7, x - 2, y + 7, color, hollow=True)
                self.rect(frame, x + 2, y - 7, x + 4, y + 7, color, hollow=True)
            else:
                self.rect(frame, x - 1, y - 7, x + 1, y + 7, color, hollow=True)
                frame[y, x - 4:x + 5] = color
            self.helmet(frame, x, y - 7)
        for owner, edge, maximum in level["debt_gates"]:
            x = (xs[edge] + xs[edge + 1]) // 2; y = (21, 44)[owner]
            open_gate = _debt(g.state, owner) <= maximum
            color = WHITE if open_gate else RED
            if open_gate:
                self.line(frame, (x - 5, y - 6), (x - 2, y - 2), color)
                self.line(frame, (x + 5, y + 6), (x + 2, y + 2), color)
            else:
                self.line(frame, (x - 3, y - 6), (x + 3, y + 6), color)
                self.line(frame, (x + 3, y - 6), (x - 3, y + 6), color)
            for notch in range(maximum + 1):
                self.diamond(frame, (x - 2 + notch * 4, y), 1, BRASS, hollow=True)
        for owner, positions in enumerate(level["scales"]):
            y = (29, 52)[owner]
            for position in positions:
                x = xs[position]
                frame[y, x - 4:x + 5] = BRASS
                frame[y + 1:y + 3, x - 3:x + 4:2] = IRON
        for index, witness in enumerate(level["witness"]):
            if witness < 0:
                continue
            owner = level["tasks"][index][0]; other = 1 - owner
            x, y = xs[witness], (21, 44)[other]
            self.rect(frame, x - 5, y + 7, x + 5, y + 9, WHITE, hollow=True)
            frame[y + 8, x - 4:x + 5:2] = RUST
            if _position(g.state, other) == witness:
                self.diamond(frame, (x, y + 8), 2, WHITE)

    def station(self, frame, index, owner, position, done):
        x = self.xs()[position]; y = (14, 36)[owner]
        color = STEEL if done else BRASS
        if owner == 0:
            self.line(frame, (x - 5, y + 3), (x, y - 3), color)
            self.line(frame, (x, y - 3), (x + 5, y + 3), color)
            self.line(frame, (x + 5, y + 3), (x - 5, y + 3), color)
        else:
            self.rect(frame, x - 5, y - 3, x - 3, y + 3, color)
            self.rect(frame, x + 3, y - 3, x + 5, y + 3, color)
            frame[y + 1:y + 3, x - 5:x + 6] = color
        weight = self.game.level["tasks"][index][2]
        for rivet in range(weight):
            self.diamond(frame, (x - 2 + rivet * 4, y), 1, WHITE if not done else IRON)
        if done:
            self.line(frame, (x - 5, y - 4), (x + 5, y + 4), GREEN)
            self.line(frame, (x + 5, y - 4), (x - 5, y + 4), GREEN)

    def goals(self, frame):
        g = self.game; xs = self.xs(); pa, pb, active, helmet = g.level["goal"]
        for owner, position in enumerate((pa, pb)):
            x, y = xs[position], (21, 44)[owner]
            color = WHITE if owner == active else IRON
            self.line(frame, (x - 7, y - 7), (x - 7, y - 3), color)
            self.line(frame, (x - 7, y - 7), (x - 3, y - 7), color)
            self.line(frame, (x + 7, y + 7), (x + 7, y + 3), color)
            self.line(frame, (x + 7, y + 7), (x + 3, y + 7), color)
            if owner == active:
                if x < 16:
                    targets = ((x + 8, y - 3), (x + 8, y + 3))
                elif x > 48:
                    targets = ((x - 8, y - 3), (x - 8, y + 3))
                else:
                    targets = ((x - 8, y), (x + 8, y))
                for target in targets:
                    self.diamond(frame, target, 2, WHITE, hollow=True)
            if owner == helmet:
                self.rect(frame, x - 3, y - 10, x + 3, y - 9, BRASS, hollow=True)

    def audits(self, frame):
        g = self.game
        audit_count = g.state[7]
        if (g.anim_kind == "audit_reject" and g.pending_state is not None
                and g.anim_progress >= max(1, g.anim_total - 1)):
            audit_count = g.pending_state[7]
        for index, center in enumerate(((8, 7), (56, 7))):
            active = index < audit_count
            if index == 0:
                self.rect(frame, center[0] - 3, center[1] - 3,
                          center[0] + 3, center[1] + 3,
                          BRASS if active else STEEL, hollow=not active)
                frame[center[1], center[0] - 4:center[0] + 5:2] = WHITE if active else IRON
            else:
                self.diamond(frame, center, 4, BRASS if active else STEEL, hollow=not active)
                self.line(frame, (center[0] - 3, center[1]),
                          (center[0] + 3, center[1]), WHITE if active else IRON)

    def energy(self, frame):
        g = self.game
        budget_left = g.budget_left
        if (g.anim_kind and g.pending_budget is not None
                and g.anim_progress >= max(1, g.anim_total - 1)
                and g.anim_kind != "success"):
            budget_left = g.pending_budget
        for group in range((g.budget_max + 3) // 4):
            cx = 7 + group * 8; cy = 60
            self.diamond(frame, (cx, cy), 1, IRON)
            for tooth, (dx, dy) in enumerate(((0, -2), (2, 0), (0, 2), (-2, 0))):
                number = group * 4 + tooth
                if number >= g.budget_max:
                    continue
                self.diamond(frame, (cx + dx, cy + dy), 1,
                             BRASS if number < budget_left else STEEL)

    def animation(self, frame):
        g = self.game
        if g.intro_mark:
            self.line(frame, (5, 13), (59, 13), WHITE, dotted=True)
            self.line(frame, (5, 54), (59, 54), RUST, dotted=True)
        if not g.anim_kind:
            return
        p, total = g.anim_progress, max(1, g.anim_total)
        span = max(1, total - 1)
        xs = self.xs(); owner = g.state[2]
        if g.anim_kind == "move":
            start, end = xs[g.anim_from], xs[g.anim_to]
            x = start + (end - start) * p // span
            lift = 8 * p * (span - p) // max(1, span * span)
            self.porter(frame, owner, x, True, g.state[3] == owner,
                        _debt(g.state, owner), (0, -lift))
        elif g.anim_kind == "switch":
            old, new = g.state[2], g.pending_state[2]
            x0, y0 = xs[g.state[old]], (21, 44)[old]
            x1, y1 = xs[g.state[new]], (21, 44)[new]
            x = x0 + (x1 - x0) * p // span; y = y0 + (y1 - y0) * p // span
            if p >= span:
                self.porter(frame, new, x1, True, g.pending_state[3] == new,
                            _debt(g.pending_state, new))
            else:
                self.rect(frame, x - 6, y - 6, x + 6, y + 6, WHITE, hollow=True)
                frame[y - 7, max(0, x - 3):min(64, x + 4):2] = BRASS
        elif g.anim_kind == "transfer":
            x = xs[g.state[0]]; old, new = g.state[3], g.pending_state[3]
            y0, y1 = (15, 38)[old], (15, 38)[new]
            y = y0 + (y1 - y0) * p // span
            self.helmet(frame, x, y)
            self.line(frame, (x, min(y0, y1)), (x, max(y0, y1)), BRASS, dotted=True)
        elif g.anim_kind in ("service", "repay"):
            x = xs[_position(g.state, owner)]; y = (21, 44)[owner]
            station_y = (14, 36)[owner] if g.anim_kind == "service" else (29, 52)[owner]
            direction = self.tag_direction(owner, x)
            if g.anim_kind == "service":
                old_debt = _debt(g.state, owner)
                new_debt = _debt(g.pending_state, owner)
                for index in range(old_debt, new_debt):
                    target = (x + direction * (7 + index * 3), y + 6)
                    tx = x + (target[0] - x) * p // span
                    ty = station_y + (target[1] - station_y) * p // span
                    self.diamond(frame, (tx, ty), 2, BRASS, hollow=True)
                    self.line(frame, (x, station_y), (tx, ty), WHITE, dotted=True)
            else:
                debt_index = max(0, _debt(g.state, owner) - 1)
                source = (x + direction * (7 + debt_index * 3), y + 6)
                tx = source[0] + (x - source[0]) * p // span
                ty = source[1] + (station_y - source[1]) * p // span
                if p < span:
                    self.diamond(frame, (tx, ty), 2, BRASS, hollow=True)
                    self.line(frame, source, (tx, ty), WHITE, dotted=True)
        elif g.anim_kind == "blocked":
            direction = -1 if g.anim_action == 1 else 1 if g.anim_action == 2 else 0
            x = xs[_position(g.state, owner)]
            folded = min(p, span - p)
            recoil = (3 * folded + max(1, span // 4)) // max(1, span // 2)
            offset = (-direction * recoil, 0) if direction else (0, -recoil)
            self.porter(frame, owner, x, True, g.state[3] == owner,
                        _debt(g.state, owner), offset)
            if p < span:
                cue = 6 * (span - p) // span
                self.line(frame, (x - cue, (21, 44)[owner] - cue),
                          (x + cue, (21, 44)[owner] + cue), RED)
        elif g.anim_kind == "audit_reject":
            seal = max(0, g.state[7] - 1); x = (8, 56)[seal]
            radius = 2 * p // span
            if p < span:
                self.line(frame, (x - radius, 5 - radius), (x + radius, 5 + radius), RED)
                self.line(frame, (x + radius, 5 - radius), (x - radius, 5 + radius), RED)
        elif g.anim_kind == "success":
            for owner, position in enumerate(g.level["goal"][:2]):
                x, y = xs[position], (21, 44)[owner]
                self.rect(frame, x - 5 - p, y - 5, x + 5 + p, y + 5,
                          GREEN, hollow=True)
            self.line(frame, (6, 32), (6 + p * 8, 32), BRASS)
        elif g.anim_kind == "loss":
            left = 4 + 11 * p // span; right = 60 - 11 * p // span
            top = 14 + 4 * p // span; bottom = 53 - 4 * p // span
            self.line(frame, (left, top), (right, bottom), RED)
            self.line(frame, (right, top), (left, bottom), HAZARD)
            if p >= span:
                self.rect(frame, 24, 28, 40, 38, STEEL, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        preview_settle = (g.anim_kind in (
            "move", "switch", "transfer", "service", "repay",
            "blocked", "audit_reject", "loss")
            and g.pending_state is not None
            and g.anim_progress >= max(1, g.anim_total - 1))
        current_state = g.state
        if preview_settle:
            g.state = g.pending_state
        self.background(frame); self.static_geometry(frame)
        for index, (owner, position, _weight) in enumerate(g.level["tasks"]):
            self.station(frame, index, owner, position, bool(g.state[4] & (1 << index)))
        self.goals(frame)
        moving = g.anim_kind == "move"
        transferring = g.anim_kind == "transfer"
        switching = g.anim_kind == "switch"
        blocked = g.anim_kind == "blocked"
        xs = self.xs()
        for owner in (0, 1):
            if (moving or blocked) and owner == g.state[2]:
                continue
            visible_debt = _debt(g.state, owner)
            if g.anim_kind == "repay" and owner == g.state[2] and not preview_settle:
                visible_debt = max(0, visible_debt - 1)
            self.porter(frame, owner, xs[_position(g.state, owner)],
                        owner == g.state[2] and not switching,
                        g.state[3] == owner and not transferring,
                        visible_debt)
        self.audits(frame); self.energy(frame); self.animation(frame)
        if g.state[-1] == 3 and not g.anim_kind:
            self.line(frame, (15, 18), (49, 49), RED)
            self.line(frame, (49, 18), (15, 49), HAZARD)
            self.rect(frame, 24, 28, 40, 38, STEEL, hollow=True)
        if preview_settle:
            g.state = current_state
        return frame


class G523(ARCBaseGame):
    def __init__(self):
        self.display = G523A(self)
        self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = self.anim_action = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
                  for item in LEVELS]
        super().__init__("g523", levels, Camera(0, 0, 64, 64, BLACK, BLACK, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.anim_from = self.anim_to = self.anim_action = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        self.intro_mark = True

    def begin(self, kind, frames, after, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.pending_state = after; self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal
        self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.pending_state = self.pending_budget = self.pending_terminal = None
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
        self.intro_mark = False; self.anim_action = action
        before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left); return
        cost = action_cost(before, after)
        if cost > self.budget_left:
            lost = before[:-1] + (3,)
            self.begin("loss", 7, lost, self.budget_left, "loss"); return
        budget = self.budget_left - cost
        self.anim_from, self.anim_to = _position(before, before[2]), _position(after, before[2])
        if after[-1] == 2:
            kind, frames, terminal = "success", 7, "win"
        elif after[-1] == 3:
            kind, frames, terminal = "loss", 7, "loss"
        elif action == 6:
            kind, frames, terminal = "audit_reject", 5, None
        elif action in (1, 2):
            kind, frames, terminal = "move", 5, None
        elif action == 3:
            kind, frames, terminal = "switch", 4, None
        elif action == 4:
            kind, frames, terminal = "transfer", 6, None
        else:
            kind = "service" if after[4] != before[4] else "repay"
            frames, terminal = 6, None
        self.begin(kind, frames, after, budget, terminal)
