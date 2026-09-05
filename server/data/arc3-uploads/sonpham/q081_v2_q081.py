# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q081-v2 Night-Clock Masquerade -- track identity through a mechanical revue."""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


PAPER, SILVER, ASH, STEEL, SMOKE, INK = 0, 1, 2, 3, 4, 5
MAGENTA, ROSE, RED, BLUE, AQUA, GOLD, COPPER, WINE, GREEN, VIOLET = 6, 7, 8, 9, 10, 11, 12, 13, 14, 15


def ev(kind, a=0, b=0):
    return kind, a, b


LEVELS = [
    {"name": "First Crossing", "n": 3, "events": (ev("pos", 0, 2),), "adjacent": False, "ring": False, "budget": 7},
    {"name": "Borrowed Faces", "n": 4, "events": (ev("pos", 0, 3), ev("costume", 1, 2), ev("pos", 0, 1)), "adjacent": False, "ring": False, "budget": 11},
    {"name": "Badge and Body", "n": 4, "events": (ev("badge", 0, 2), ev("pos", 1, 3), ev("costume", 0, 3), ev("pos", 0, 2)), "adjacent": False, "ring": False, "budget": 16},
    {"name": "Coupled Footlights", "n": 5, "events": (ev("pos", 0, 4), ev("costume", 1, 3), ev("badge", 0, 2), ev("pos", 1, 2)), "adjacent": True, "ring": False, "budget": 13},
    {"name": "Wound Carousel", "n": 5, "events": (ev("rotate", 1), ev("costume", 0, 3), ev("pos", 1, 4), ev("badge", 2, 3)), "adjacent": True, "ring": True, "budget": 18},
    {"name": "Traveling Sockets", "n": 5, "events": (ev("goal", 2), ev("pos", 0, 3), ev("badge", 1, 4), ev("rotate", 1), ev("costume", 0, 2)), "adjacent": True, "ring": True, "budget": 19},
    {"name": "Mirror Revue", "n": 6, "events": (ev("mirror"), ev("costume", 0, 5), ev("badge", 1, 4), ev("pos", 2, 5), ev("goal", 1), ev("rotate", 2)), "adjacent": True, "ring": True, "budget": 18},
    {"name": "Night-Clock Masquerade", "n": 6, "events": (ev("goal", 2), ev("pos", 0, 5), ev("costume", 1, 4), ev("badge", 0, 3), ev("rotate", 1), ev("mirror"), ev("pos", 2, 5)), "adjacent": True, "ring": True, "budget": 24},
]


def rotate(values, amount):
    amount %= len(values)
    return values[-amount:] + values[:-amount] if amount else values


def target_order(level, state):
    return rotate(tuple(range(level["n"])), state[7])


def start_state(level):
    values = tuple(range(level["n"]))
    # phase, identities, costumes, badges, event, cursor, held, goal shift, chances, terminal
    return 0, values, values, values, 0, 0, -1, 0, 2, 0


def transition(level, state, action):
    phase, identities, costumes, badges, event_index, cursor, held, goal_shift, chances, terminal = state
    if terminal or action not in (1, 2, 3, 4, 5, 6):
        return state
    n = level["n"]
    if phase == 0:
        if action != 5 or event_index >= len(level["events"]):
            return state
        kind, a, b = level["events"][event_index]
        identities, costumes, badges = list(identities), list(costumes), list(badges)
        if kind == "pos":
            identities[a], identities[b] = identities[b], identities[a]
            costumes[a], costumes[b] = costumes[b], costumes[a]
            badges[a], badges[b] = badges[b], badges[a]
        elif kind == "costume":
            costumes[a], costumes[b] = costumes[b], costumes[a]
        elif kind == "badge":
            badges[a], badges[b] = badges[b], badges[a]
        elif kind == "rotate":
            identities = list(rotate(tuple(identities), a)); costumes = list(rotate(tuple(costumes), a)); badges = list(rotate(tuple(badges), a))
        elif kind == "mirror":
            identities.reverse(); costumes.reverse(); badges.reverse()
        elif kind == "goal":
            goal_shift = (goal_shift + a) % n
        event_index += 1
        phase = int(event_index == len(level["events"]))
        return phase, tuple(identities), tuple(costumes), tuple(badges), event_index, cursor, -1, goal_shift, chances, terminal

    if action == 1:
        return phase, identities, costumes, badges, event_index, (cursor - 1) % n, held, goal_shift, chances, terminal
    if action == 2:
        return phase, identities, costumes, badges, event_index, (cursor + 1) % n, held, goal_shift, chances, terminal
    if action == 3:
        if held < 0:
            return phase, identities, costumes, badges, event_index, cursor, cursor, goal_shift, chances, terminal
        if held == cursor:
            return phase, identities, costumes, badges, event_index, cursor, -1, goal_shift, chances, terminal
        distance = min((held - cursor) % n, (cursor - held) % n)
        if level["adjacent"] and distance != 1:
            return state
        identities, costumes, badges = list(identities), list(costumes), list(badges)
        identities[held], identities[cursor] = identities[cursor], identities[held]
        costumes[held], costumes[cursor] = costumes[cursor], costumes[held]
        badges[held], badges[cursor] = badges[cursor], badges[held]
        return phase, tuple(identities), tuple(costumes), tuple(badges), event_index, cursor, -1, goal_shift, chances, terminal
    if action == 4:
        if not level["ring"]:
            return state
        return phase, rotate(identities, 1), rotate(costumes, 1), rotate(badges, 1), event_index, cursor, held, goal_shift, chances, terminal
    if action == 6:
        if identities == target_order(level, state):
            return phase, identities, costumes, badges, event_index, cursor, held, goal_shift, chances, 2
        chances -= 1
        return phase, identities, costumes, badges, event_index, cursor, -1, goal_shift, chances, 3 if chances <= 0 else 0
    return state


def action_cost(state, after):
    # A rejected curtain check spends a brass retry, not a spring tooth.
    return 0 if after[8] < state[8] else 1


def solved(_level, state):
    return state[-1] == 2


class MasqueradeDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, a, b, color, dotted=False):
        x0, y0 = a; x1, y1 = b; steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            if dotted and i % 3 == 1:
                continue
            x = x0 + (x1 - x0) * i // steps; y = y0 + (y1 - y0) * i // steps
            if 0 <= x < 64 and 0 <= y < 64:
                frame[y, x] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d <= radius ** 2 and (not hollow or d >= max(0, radius - 1) ** 2):
                    frame[y, x] = color

    @staticmethod
    def center(index, n, y=31):
        return 7 + index * (50 // max(1, n - 1)), y

    def background(self, frame):
        frame[:, :] = INK
        frame[11:51, 3:61] = SMOKE
        for x in range(5, 61, 6):
            frame[12:50:4, x] = STEEL
        self.line(frame, (3, 10), (60, 10), GOLD)
        self.line(frame, (3, 51), (60, 51), COPPER)
        for x in range(5, 61, 8):
            self.disc(frame, (x, 9), 2, GOLD)

    def sigil(self, frame, center, identity, color=SILVER, small=False):
        x, y = center; r = 2 if small else 3; kind = identity % 6
        if kind == 0:
            self.disc(frame, center, r, color, hollow=True); frame[y, x] = color
        elif kind == 1:
            self.line(frame, (x, y - r), (x + r, y + r), color); self.line(frame, (x + r, y + r), (x - r, y + r), color); self.line(frame, (x - r, y + r), (x, y - r), color)
        elif kind == 2:
            self.line(frame, (x, y - r), (x + r, y), color); self.line(frame, (x + r, y), (x, y + r), color); self.line(frame, (x, y + r), (x - r, y), color); self.line(frame, (x - r, y), (x, y - r), color)
        elif kind == 3:
            self.line(frame, (x - r, y), (x + r, y), color); self.line(frame, (x, y - r), (x, y + r), color)
        elif kind == 4:
            self.line(frame, (x - r, y - r), (x + r, y + r), color); self.line(frame, (x + r, y - r), (x - r, y + r), color)
        else:
            for dx, dy in ((0, -r), (r, 0), (0, r), (-r, 0)):
                self.disc(frame, (x + dx, y + dy), 1, color)

    def mask(self, frame, center, costume, badge, identity=None):
        x, y = center; color = (MAGENTA, AQUA, GOLD, COPPER, GREEN, VIOLET)[costume % 6]
        kind = costume % 3
        if kind == 0:
            self.disc(frame, (x, y), 7, color)
            frame[y - 2:y + 3, x - 6:x + 7:3] = INK
        elif kind == 1:
            self.line(frame, (x, y - 8), (x + 7, y + 5), color); self.line(frame, (x + 7, y + 5), (x - 7, y + 5), color); self.line(frame, (x - 7, y + 5), (x, y - 8), color)
            frame[y + 2:y + 5, x - 4:x + 5] = color
        else:
            frame[y - 6:y + 7, x - 6:x + 7] = color
            frame[y - 8:y - 5, x - 3:x + 4] = color
            frame[y - 2:y + 3, x - 4:x + 5] = INK
        # Badge vocabulary is pattern/shape redundant, never hue-only.
        by = y - 10
        if badge % 3 == 0:
            self.disc(frame, (x, by), 2, SILVER, hollow=True)
        elif badge % 3 == 1:
            self.line(frame, (x - 2, by + 2), (x, by - 2), SILVER); self.line(frame, (x, by - 2), (x + 2, by + 2), SILVER)
        else:
            frame[by - 1:by + 2, x - 1:x + 2] = SILVER
        if identity is not None:
            self.disc(frame, center, 4, INK)
            self.sigil(frame, center, identity, SILVER)

    def footlight(self, frame, center, identity):
        x, y = center
        self.disc(frame, center, 6, STEEL, hollow=True)
        self.sigil(frame, (x, y), identity, GOLD, small=True)
        frame[y + 5:y + 7, x - 4:x + 5] = COPPER

    def event_glyph(self, frame, kind, center, done=False):
        x, y = center; color = ASH if done else GOLD
        if kind == "pos":
            self.line(frame, (x - 3, y - 1), (x + 3, y + 1), color); self.disc(frame, (x - 3, y - 1), 1, color); self.disc(frame, (x + 3, y + 1), 1, color)
        elif kind == "costume":
            self.line(frame, (x - 3, y + 2), (x, y - 2), color); self.line(frame, (x, y - 2), (x + 3, y + 2), color)
        elif kind == "badge":
            self.disc(frame, center, 2, color, hollow=True); frame[y, x] = color
        elif kind == "rotate":
            self.disc(frame, center, 3, color, hollow=True); frame[y - 3:y, x + 2:x + 4] = color
        elif kind == "mirror":
            self.line(frame, (x, y - 3), (x, y + 3), color); self.line(frame, (x - 3, y), (x - 1, y - 2), color); self.line(frame, (x + 3, y), (x + 1, y + 2), color)
        else:
            self.disc(frame, center, 3, color, hollow=True); self.sigil(frame, center, 0, color, small=True)

    def moving_positions(self):
        g = self.game
        if not g.anim_kind or not g.pending_state:
            return None
        if g.anim_kind not in ("event_pos", "event_rotate", "event_mirror", "repair_swap", "ring"):
            return None
        old_ids = g.state[1]; new_ids = g.pending_state[1]
        return {i: new_ids.index(identity) for i, identity in enumerate(old_ids)}

    def stage(self, frame):
        g = self.game; state = g.state; n = g.level["n"]; movers = self.moving_positions()
        if movers:
            p = g.anim_progress
            for old_pos, new_pos in movers.items():
                a = self.center(old_pos, n); b = self.center(new_pos, n)
                x = a[0] + (b[0] - a[0]) * p // g.anim_total
                arch = abs(b[0] - a[0]) // 6
                y = a[1] - (arch * p * (g.anim_total - p) * 4 // max(1, g.anim_total * g.anim_total))
                self.mask(frame, (x, y), state[2][old_pos], state[3][old_pos])
        else:
            reveal = state[0] == 0 and state[4] == 0
            for i in range(n):
                self.mask(frame, self.center(i, n), state[2][i], state[3][i], state[1][i] if reveal else None)
        goals = target_order(g.level, state)
        if g.anim_kind == "event_goal" and g.pending_state:
            new_goals = target_order(g.level, g.pending_state); p = g.anim_progress
            for old_pos, identity in enumerate(goals):
                new_pos = new_goals.index(identity)
                before = self.center(old_pos, n, 57); after = self.center(new_pos, n, 57)
                center = (before[0] + (after[0] - before[0]) * p // g.anim_total,
                          before[1] - p * (g.anim_total - p) // max(1, g.anim_total))
                self.footlight(frame, center, identity)
        else:
            for i, identity in enumerate(goals):
                self.footlight(frame, self.center(i, n, 57), identity)
        # A toothed floor coupling advertises adjacent-only repair.
        if g.level["adjacent"]:
            for i in range(n - 1):
                a = self.center(i, n, 46); b = self.center(i + 1, n, 46)
                self.line(frame, a, b, SILVER, dotted=True)
            # Coupling is a closed rail: a low U-shaped return makes the legal
            # first-to-last edge as explicit as every neighboring segment.
            first = self.center(0, n, 46); last = self.center(n - 1, n, 46)
            self.line(frame, first, (first[0], 50), SILVER, dotted=True)
            self.line(frame, (first[0], 50), (last[0], 50), SILVER, dotted=True)
            self.line(frame, (last[0], 50), last, SILVER, dotted=True)
            self.disc(frame, (first[0], 48), 1, GOLD); self.disc(frame, (last[0], 48), 1, GOLD)
        if g.level["ring"]:
            # The winding handle anticipates the whole-carousel repair verb.
            self.disc(frame, (32, 48), 3, COPPER, hollow=True)
            frame[45:48, 34:37] = COPPER
        if state[0] == 1:
            cx, _ = self.center(state[5], n)
            self.disc(frame, (cx, 31), 10, GOLD, hollow=True)
            frame[43:47, max(0, cx - 5):min(64, cx + 6)] = GOLD
            if state[6] >= 0:
                hx, _ = self.center(state[6], n)
                self.disc(frame, (hx, 31), 12, AQUA, hollow=True)

    def hud(self, frame):
        g = self.game; state = g.state
        for i, item in enumerate(g.level["events"]):
            self.event_glyph(frame, item[0], (8 + i * 7, 5), i < state[4])
            # Endpoint/amount pinholes make the settled event ledger an exact
            # record rather than asking animation memory to carry the rule.
            if item[0] in ("pos", "costume", "badge"):
                color = ASH if i < state[4] else GOLD
                # Two height-coded brass posts remain readable when six slot
                # indices cannot fit as tiny horizontal pinholes.
                left = 5 + i * 7; right = left + 5
                frame[11 - (item[1] + 1):11, left:left + 2] = color
                frame[11 - (item[2] + 1):11, right:right + 2] = color
            elif item[0] in ("rotate", "goal"):
                frame[9, 5 + i * 7:5 + i * 7 + min(6, item[1])] = ASH if i < state[4] else GOLD
        # Remaining spring teeth are broad; spent teeth collapse to pins.
        for i in range(g.budget_max):
            y = 13 + i
            if i < g.budget_left:
                frame[y, 1:4] = GOLD
            else:
                frame[y, 1] = ASH
        for i in range(state[8]):
            self.disc(frame, (56 + i * 5, 5), 2, COPPER, hollow=True)

    def animation(self, frame):
        g = self.game
        if not g.anim_kind:
            if g.intro_mark:
                self.line(frame, (4, 50), (60, 50), GOLD)
            if g.terminal_hold == "loss":
                frame[12:51, 29:35] = RED
            return
        p = g.anim_progress; n = g.level["n"]
        if g.anim_kind in ("event_costume", "event_badge"):
            kind, a, b = g.active_event
            ca, cb = self.center(a, n), self.center(b, n)
            color = VIOLET if kind == "costume" else SILVER
            for source, dest in ((ca, cb), (cb, ca)):
                mid = (source[0] + (dest[0] - source[0]) * p // g.anim_total,
                       source[1] - 9 - (p * (g.anim_total - p) // max(1, g.anim_total)))
                self.disc(frame, mid, 3 if kind == "costume" else 2, color, hollow=True)
        elif g.anim_kind == "event_goal":
            self.disc(frame, (32, 57), 5 + p * 4, GOLD, hollow=True)
        elif g.anim_kind in ("cursor", "pick"):
            self.disc(frame, self.center(g.pending_state[5], n), 9 + p, AQUA if g.anim_kind == "pick" else GOLD, hollow=True)
        elif g.anim_kind == "recoil":
            cx, _ = self.center(g.state[5], n)
            self.disc(frame, (cx + (-1) ** p * 2, 31), 9 + p, RED, hollow=True)
        elif g.anim_kind == "success":
            frame[11:11 + min(40, p * 7), 3:8] = WINE
            frame[11:11 + min(40, p * 7), 56:61] = WINE
            for x in range(7, 59, 7):
                self.disc(frame, (x, 9), 2 + p // 2, GOLD, hollow=True)
        elif g.anim_kind == "loss":
            frame[11:51, 3:3 + min(29, p * 5)] = WINE
            frame[11:51, 61 - min(29, p * 5):61] = WINE

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self.background(frame); self.stage(frame); self.hud(frame); self.animation(frame); return frame


class Q081(ARCBaseGame):
    def __init__(self):
        self.display = MasqueradeDisplay(self); self.level = LEVELS[0]; self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0; self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None; self.active_event = None; self.intro_mark = True; self.terminal_hold = None
        levels = [Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"]) for item in LEVELS]
        super().__init__("q081", levels, Camera(0, 0, 64, 64, INK, INK, [self.display]), False, len(levels), [1, 2, 3, 4, 5, 6])

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]; self.state = start_state(self.level); self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None; self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None; self.active_event = None; self.intro_mark = True; self.terminal_hold = None

    def begin(self, kind, frames, state, budget, terminal=None):
        self.anim_kind = kind; self.anim_total = self.anim_left = frames; self.anim_progress = 0
        self.pending_state = state; self.pending_budget = budget; self.pending_terminal = terminal

    def finish(self):
        terminal = self.pending_terminal; self.state = self.pending_state; self.budget_left = self.pending_budget
        self.anim_kind = None; self.pending_state = self.pending_budget = self.pending_terminal = None; self.active_event = None
        if terminal == "win": self.terminal_hold = "win"; self.next_level()
        elif terminal == "loss": self.terminal_hold = "loss"; self.lose()
        self.complete_action()

    def step(self):
        if self.anim_left:
            self.anim_left -= 1; self.anim_progress = self.anim_total - self.anim_left
            if self.anim_left == 0: self.finish()
            return
        action = self.action.id.value
        if action == 0: self.complete_action(); return
        self.intro_mark = False; before = self.state; after = transition(self.level, before, action)
        if after == before:
            self.begin("recoil", 4, before, self.budget_left); return
        budget = self.budget_left - action_cost(before, after); won = after[-1] == 2; lost = after[-1] == 3 or (budget <= 0 and not won)
        if won: kind = "success"
        elif lost: kind = "loss"
        elif before[0] == 0:
            self.active_event = self.level["events"][before[4]]
            kind = "event_" + self.active_event[0]
        elif after[8] < before[8]: kind = "recoil"
        elif action in (1, 2): kind = "cursor"
        elif action == 3 and before[6] < 0: kind = "pick"
        elif action == 3: kind = "repair_swap"
        elif action == 4: kind = "ring"
        else: kind = "recoil"
        frames = 7 if kind in ("success", "loss", "event_rotate", "event_mirror", "event_goal") else 5
        self.begin(kind, frames, after, budget, "win" if won else "loss" if lost else None)
