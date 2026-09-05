# Author: OpenAI Codex (GPT-5), for Son Pham
# Date: 2026-09-05
# PURPOSE: Standalone verified ARC3 community game exported from Son Pham's pairwise glow-up program; behavior and qualified source body are preserved exactly.
# SRP/DRY check: Pass - one self-contained ARCBaseGame implementation with no ARC Explainer runtime-service changes.

"""q070-v2 High Alpine Signal Survey.

Triangulate one deterministic hidden route hypothesis by sending limited range
sweeps from patterned mountain beacons.  Every observation visibly contracts
the remaining family; target contact never reveals truth.  Later surveys add
asymmetric baselines, climb-cost instruments, occluded bearings, a previewed
beacon relocation, and deterministic target drift.

The two-beacon opener is an ordered control tutorial. Every later level offers
one more large patterned station than there are scan stones. Selecting a
station previews its exact surviving family; only distinct informative scans
consume a stone, while alias stations and repeats recoil at zero cost.

Glow-up mechanic draw:
* accepted mx003 uncertainty: every deterministic scan partitions and shrinks
  an explicit hidden-state family before a fix can be attempted;
* rejected mx004: a counter-combat layer would replace localization with type
  matching rather than deepen evidence gathering;
* rejected mx006: hex adjacency would decorate the relief map without changing
  this game's range contours, so the survey retains irregular alpine terrain.
"""

from __future__ import annotations

from copy import deepcopy
import math

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay


SNOW, CLOUD, GRANITE, SHALE, INK, NIGHT = 0, 1, 2, 4, 5, 3
MAGENTA, ROSE, RED, SKY, ICE, SUN, ALPINE, MAROON, MEADOW, VIOLET = range(6, 16)

TERMINAL_INDEX = 10
ACTIVE, WIN, LOSS = 0, 2, 3
UNAVAILABLE = 255


def beacon(position, metric="range", *, decoy=False):
    return {
        "position": tuple(position),
        "metric": metric,
        "decoy": bool(decoy),
    }


def static_tracks(sites):
    return tuple((tuple(site),) for site in sites)


def survey(
    name,
    sites,
    target,
    beacons,
    scans,
    budget,
    *,
    ridge=None,
    relocation=None,
    drift=False,
    free_scan=False,
    tracks=None,
    fix_sites=None,
):
    tracks = tuple(tuple(tuple(point) for point in track) for track in (
        tracks if tracks is not None else static_tracks(sites)))
    authored_fix_sites = []
    for point in fix_sites or ():
        if tuple(point) not in authored_fix_sites:
            authored_fix_sites.append(tuple(point))
    for track in tracks:
        for point in track:
            if point not in authored_fix_sites:
                authored_fix_sites.append(point)
    return {
        "name": name,
        "tracks": tracks,
        "fix_sites": tuple(authored_fix_sites),
        "target": int(target),
        "beacons": tuple(deepcopy(beacons)),
        "scans": int(scans),
        "budget": int(budget),
        "ridge": ridge,
        "relocation": deepcopy(relocation),
        "drift": bool(drift),
        # Level 1 teaches the beacon-selection control in a fixed order. Every
        # later survey exposes one extra station and lets the player compare
        # exact affected-family previews before choosing N informative scans.
        "scan_order": () if free_scan else tuple(range(scans)),
    }


# The data are authored as hypothesis families, never generated from an answer
# sequence.  Candidate order also defines the snapped diamond-fix route.
LEVELS = [
    survey(
        "Snowline Ranges",
        ((1, 3), (3, 2), (8, 3), (10, 4), (2, 3), (9, 8), (4, 9),
         (5, 6), (7, 9), (10, 9), (1, 8), (6, 2), (11, 6), (3, 7)), 7,
        (beacon((1, 1)), beacon((10, 1))), scans=2, budget=11,
    ),
    survey(
        "Third Bearing",
        ((4, 10), (2, 8), (4, 1), (4, 9), (9, 1), (9, 9), (5, 3),
         (7, 3), (10, 7), (1, 7), (6, 9), (8, 4), (7, 1), (3, 5)), 7,
        (beacon((1, 2)), beacon((6, 9), decoy=True),
         beacon((5, 6)), beacon((9, 2))),
        scans=3, budget=15, free_scan=True,
    ),
    survey(
        "Asymmetric Cairns",
        ((9, 2), (1, 4), (2, 3), (8, 4), (5, 6), (2, 7), (7, 8),
         (2, 1), (9, 6), (4, 9), (10, 8), (6, 3), (3, 7), (8, 8)), 7,
        (beacon((11, 2)), beacon((5, 4)),
         beacon((9, 9), decoy=True), beacon((3, 10))),
        scans=3, budget=15, free_scan=True,
    ),
    survey(
        "Climb-Cost Dial",
        ((10, 5), (2, 8), (4, 3), (4, 7), (6, 2), (6, 8), (8, 7),
         (8, 3), (10, 2), (10, 8), (3, 5), (9, 5), (5, 9), (7, 1)), 7,
        (beacon((6, 5), "climb"), beacon((3, 1), decoy=True),
         beacon((1, 5)), beacon((11, 5))),
        scans=3, budget=15, free_scan=True,
    ),
    survey(
        "Ridge Shadow",
        ((2, 2), (2, 8), (4, 3), (4, 7), (6, 8), (7, 7), (10, 4),
         (8, 6), (10, 2), (10, 8), (3, 5), (6, 2), (9, 9), (5, 5)), 7,
        (beacon((11, 1), decoy=True), beacon((1, 5)),
         beacon((6, 1)), beacon((2, 2), "sight")),
        scans=3, budget=16, free_scan=True,
        ridge={"x": 7, "gap": (7, 8)},
    ),
    survey(
        "Relocated Baseline",
        ((2, 2), (2, 8), (4, 2), (4, 8), (6, 3), (6, 7), (8, 8),
         (8, 2), (10, 3), (10, 7), (3, 5), (9, 5), (5, 9), (7, 1)), 7,
        (beacon((7, 10)), beacon((10, 9), decoy=True),
         beacon((1, 4)), beacon((6, 5))),
        scans=3, budget=17, free_scan=True,
        relocation={"beacon": 3, "to": (11, 3)},
    ),
    survey(
        "Drifting Transponder",
        (), 3,
        (beacon((11, 10)), beacon((10, 9), decoy=True),
         beacon((6, 1)), beacon((1, 7))),
        scans=3, budget=17, drift=True, free_scan=True,
        tracks=(
            ((4, 3), (5, 4), (6, 5), (7, 6)),
            ((4, 7), (5, 6), (6, 5), (7, 4)),
            ((7, 3), (7, 4), (8, 5), (9, 6)),
            ((7, 7), (7, 6), (8, 5), (9, 4)),
            ((9, 2), (8, 3), (7, 4), (6, 5)),
            ((9, 8), (8, 7), (7, 6), (6, 5)),
            ((6, 8), (6, 5), (4, 4), (5, 5)),
            ((8, 6), (8, 5), (8, 4), (8, 3)),
        ),
        fix_sites=((1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6),
                   (7, 7), (8, 8), (9, 8), (9, 4), (10, 3), (8, 2),
                   (6, 2), (4, 2), (2, 4), (3, 7), (7, 3), (10, 7)),
    ),
    survey(
        "High Alpine Signal",
        (), 5,
        (beacon((1, 5)), beacon((10, 2)), beacon((3, 9), "climb"),
         beacon((2, 1), "sight"), beacon((11, 8), decoy=True)),
        scans=4, budget=21, drift=True, free_scan=True,
        ridge={"x": 7, "gap": (5, 6)},
        relocation={"beacon": 3, "to": (3, 9)},
        tracks=(
            ((3, 2), (4, 3), (5, 4), (6, 5), (8, 6)),
            ((3, 8), (4, 7), (5, 6), (6, 5), (8, 4)),
            ((5, 2), (6, 3), (7, 4), (8, 5), (9, 6)),
            ((5, 8), (6, 7), (7, 6), (8, 5), (9, 4)),
            ((8, 2), (8, 3), (9, 4), (9, 5), (10, 6)),
            ((8, 8), (8, 7), (9, 6), (9, 5), (10, 4)),
            ((10, 3), (9, 4), (8, 5), (7, 6), (6, 7)),
            ((10, 7), (9, 6), (8, 5), (7, 4), (6, 3)),
            ((9, 7), (7, 6), (7, 4), (8, 4), (9, 3)),
            ((10, 6), (6, 5), (8, 5), (10, 1), (9, 2)),
            # A high-route mirror agrees with any tempting three-station fix
            # and with the final station's plain range, but its climb-cost
            # signature diverges. It keeps both the fourth stone and typed
            # altimeter evidence causally necessary in the finale.
            ((8, 2), (8, 7), (9, 6), (1, 1), (1, 1)),
        ),
        fix_sites=((1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6),
                   (7, 7), (8, 8), (9, 8), (10, 7), (10, 4), (9, 3),
                   (8, 2), (7, 1), (5, 1), (3, 1), (2, 4), (2, 7),
                   (4, 9), (7, 9)),
    ),
]


# Scan-first witnesses are intentionally human-legible.  Independent BFS may
# return an equal-length plan that parks the cursor before gathering evidence;
# target contact still reveals nothing and both orders have the same cost.
KNOWN_SOLUTIONS = (
    (4, 3, 4, *(1,) * 7, 6),
    (4, 3, 3, 4, 3, 4, *(1,) * 7, 6),
    (4, 3, 4, 3, 3, 4, *(1,) * 7, 6),
    (4, 3, 3, 4, 3, 4, *(1,) * 7, 6),
    (3, 4, 3, 4, 3, 4, *(1,) * 7, 6),
    (4, 3, 3, 4, 5, 5, 4, *(1,) * 7, 6),
    (4, 3, 3, 4, 3, 4, *(2,) * 9, 6),
    (4, 3, 4, 3, 4, 5, 5, 4, *(2,) * 10, 6),
)
for _level, _solution in zip(LEVELS, KNOWN_SOLUTIONS):
    _level["known_solution"] = tuple(_solution)


def elevation(point):
    x, y = point
    return (3 * x + 2 * y + x * y) % 6


def current_position(level, hypothesis, phase):
    track = level["tracks"][hypothesis]
    return track[min(phase, len(track) - 1)]


def beacon_position(level, relocated, index):
    relocation = level["relocation"]
    if relocated and relocation and index == relocation["beacon"]:
        return tuple(relocation["to"])
    return tuple(level["beacons"][index]["position"])


def ridge_blocked(level, source, destination):
    ridge = level["ridge"]
    if not ridge:
        return False
    ridge_x = ridge["x"]
    x0, y0 = source
    x1, y1 = destination
    if (x0 - ridge_x) * (x1 - ridge_x) >= 0 or x0 == x1:
        return False
    ratio = (ridge_x - x0) / (x1 - x0)
    crossing_y = y0 + ratio * (y1 - y0)
    low, high = ridge["gap"]
    return not low <= crossing_y <= high


def reading(level, beacon_index, hypothesis, phase, relocated=False):
    if level["beacons"][beacon_index]["decoy"]:
        return UNAVAILABLE
    source = beacon_position(level, relocated, beacon_index)
    destination = current_position(level, hypothesis, phase)
    metric = level["beacons"][beacon_index]["metric"]
    if metric == "sight" and ridge_blocked(level, source, destination):
        return UNAVAILABLE
    dx = abs(source[0] - destination[0])
    dy = abs(source[1] - destination[1])
    if metric == "climb":
        return dx + dy + 2 * elevation(destination)
    return dx + dy


def scan_token(level, beacon_index, phase, relocated):
    # A station may contribute at most one report per level. Drift changes the
    # hypothesis family after an informative sweep; it never turns repeat
    # clicking into a source of extra evidence.
    del level, phase, relocated
    return beacon_index


def projected_candidates(level, state, beacon_index=None):
    """Exact family preview for the currently selected survey station."""
    beacon_index = state[1] if beacon_index is None else beacon_index
    candidates = state[3]
    actual = reading(level, beacon_index, level["target"], state[8], state[6])
    projected = 0
    for hypothesis in range(len(level["tracks"])):
        if candidates & (1 << hypothesis) and reading(
                level, beacon_index, hypothesis, state[8], state[6]) == actual:
            projected |= 1 << hypothesis
    return projected, actual


def initial_candidates(level):
    return (1 << len(level["tracks"])) - 1


def start_state(level):
    # cursor, beacon, scanned tokens, candidates, scans left, relocation
    # preview, relocated, false-fix strikes, drift phase, last report, terminal.
    return 0, 0, 0, initial_candidates(level), level["scans"], 0, 0, 0, 0, -1, ACTIVE


def solved(_level, state):
    return state[TERMINAL_INDEX] == WIN


def singleton(mask):
    return mask != 0 and mask & (mask - 1) == 0


def transition(level, state, action):
    if state[TERMINAL_INDEX] or action not in (1, 2, 3, 4, 5, 6):
        return state
    cursor, selected, scanned, candidates, scans_left, preview, relocated, strikes, phase, report, _ = state
    if action in (1, 2):
        step = -1 if action == 1 else 1
        cursor = (cursor + step) % len(level["fix_sites"])
        return cursor, selected, scanned, candidates, scans_left, 0, relocated, strikes, phase, report, ACTIVE
    if action == 3:
        selected = (selected + 1) % len(level["beacons"])
        return cursor, selected, scanned, candidates, scans_left, 0, relocated, strikes, phase, report, ACTIVE
    if action == 4:
        scan_index = level["scans"] - scans_left
        if level["scan_order"]:
            if scan_index >= len(level["scan_order"]):
                return state
            required_beacon = level["scan_order"][scan_index]
            if selected != required_beacon:
                return state
        if (level["relocation"] and selected == level["relocation"]["beacon"]
                and not relocated):
            return state
        token = scan_token(level, selected, phase, relocated)
        if scans_left <= 0 or scanned & (1 << token):
            return state
        filtered, actual = projected_candidates(level, state, selected)
        # A redundant station, or a station made redundant by earlier
        # evidence, merely recoils: no scan stone or action budget is spent.
        if filtered == candidates:
            return state
        next_phase = phase
        if level["drift"]:
            next_phase = min(
                phase + 1,
                max(len(track) for track in level["tracks"]) - 1,
            )
        return (cursor, selected, scanned | (1 << token), filtered,
                scans_left - 1, 0, relocated, strikes, next_phase, actual, ACTIVE)
    if action == 5:
        relocation = level["relocation"]
        if not relocation or relocated:
            return state
        if not preview:
            return cursor, selected, scanned, candidates, scans_left, 1, relocated, strikes, phase, report, ACTIVE
        selected = relocation["beacon"]
        return cursor, selected, scanned, candidates, scans_left, 0, 1, strikes, phase, report, ACTIVE

    target_point = current_position(level, level["target"], phase)
    cursor_point = level["fix_sites"][cursor]
    protocol_ready = scans_left == 0
    if level["relocation"]:
        protocol_ready = protocol_ready and bool(relocated)
    if level["drift"]:
        protocol_ready = protocol_ready and phase >= level["scans"]
    if (protocol_ready and singleton(candidates)
            and candidates & (1 << level["target"])
            and cursor_point == target_point):
        return state[:TERMINAL_INDEX] + (WIN,)
    strikes += 1
    return state[:7] + (strikes,) + state[8:TERMINAL_INDEX] + (
        LOSS if strikes >= 2 else ACTIVE,
    )


def action_cost(before, after):
    if after == before:
        return 0
    if after[7] > before[7]:
        return 0
    return 1


def map_point(point):
    x, y = point
    return 7 + x * 4, 8 + y * 4


class SurveyDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    @staticmethod
    def line(frame, start, end, color, dotted=False, width=1):
        x0, y0 = start; x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            if dotted and step % 4 in (1, 2):
                continue
            x = x0 + (x1 - x0) * step // steps
            y = y0 + (y1 - y0) * step // steps
            for offset in range(width):
                if 0 <= y + offset < 64 and 0 <= x < 64:
                    frame[y + offset, x] = color

    @staticmethod
    def disc(frame, center, radius, color, hollow=False):
        cx, cy = center
        inner = max(0, radius - 1) ** 2
        for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(64, cx + radius + 1)):
                distance = (x - cx) ** 2 + (y - cy) ** 2
                if distance <= radius ** 2 and (not hollow or distance >= inner):
                    frame[y, x] = color

    @classmethod
    def diamond(cls, frame, center, radius, color, hollow=False):
        cx, cy = center
        for dy in range(-radius, radius + 1):
            reach = radius - abs(dy)
            if hollow:
                frame[cy + dy, cx - reach] = color
                frame[cy + dy, cx + reach] = color
            else:
                frame[cy + dy, cx - reach:cx + reach + 1] = color

    @classmethod
    def triangle(cls, frame, center, radius, color, pattern=0):
        cx, cy = center
        for row in range(radius + 1):
            y = cy - radius // 2 + row
            reach = row
            cls.line(frame, (cx - reach, y), (cx + reach, y), color,
                     dotted=bool(pattern and row % 2))
        cls.line(frame, (cx - radius, cy + radius // 2),
                 (cx + radius, cy + radius // 2), INK)
        if pattern == 1:
            cls.line(frame, (cx, cy - 1), (cx, cy + radius // 2), SNOW)
        elif pattern == 2:
            cls.diamond(frame, (cx, cy + 1), 1, SNOW)
        elif pattern == 3:
            cls.disc(frame, (cx, cy + 1), 1, SNOW, hollow=True)

    def background(self, frame):
        frame[:, :] = SNOW
        # Layered relief contours and tree-line stipple: no rectangular board.
        for band, color in ((0, CLOUD), (1, ICE), (2, GRANITE), (3, CLOUD)):
            points = []
            for x in range(2, 63, 2):
                y = 11 + band * 11 + round(3 * math.sin((x + band * 7) / 8))
                points.append((x, y))
            for a, b in zip(points, points[1:]):
                self.line(frame, a, b, color, dotted=band % 2 == 0)
        for x in range(4, 62, 7):
            y = 54 + ((x * 5) % 7) // 2
            self.triangle(frame, (x, y), 2, MEADOW, pattern=x % 3)
        for center, radius in (((11, 18), 7), ((50, 27), 9), ((30, 42), 6)):
            self.disc(frame, center, radius, CLOUD, hollow=True)
            self.disc(frame, (center[0] + 1, center[1] - 1), radius - 2,
                      ICE, hollow=True)

    def ridge(self, frame):
        ridge = self.game.level["ridge"]
        if not ridge:
            return
        x = map_point((ridge["x"], 0))[0]
        low, high = ridge["gap"]
        low_y = map_point((0, low))[1]; high_y = map_point((0, high))[1]
        for y in list(range(8, low_y)) + list(range(high_y, 53)):
            reach = 2 + (y % 3)
            self.line(frame, (x - reach, y), (x + reach, y), SHALE,
                      dotted=y % 4 == 0)
        self.diamond(frame, (x, (low_y + high_y) // 2), 2, SUN, hollow=True)

    def candidates(self, frame, state):
        phase = state[8]
        preview = None
        if not self.game.level["scan_order"] and state[4] > 0:
            preview, _report = projected_candidates(self.game.level, state)
        occupied = {}
        for hypothesis in range(len(self.game.level["tracks"])):
            point = current_position(self.game.level, hypothesis, phase)
            occupied.setdefault(point, []).append(hypothesis)
        for point, hypotheses in occupied.items():
            center = map_point(point)
            live = any(state[3] & (1 << index) for index in hypotheses)
            self.disc(frame, center, 2, SKY if live else GRANITE,
                      hollow=live)
            if live:
                spokes = sum(bool(state[3] & (1 << index)) for index in hypotheses)
                for index in range(spokes):
                    self.line(frame, center,
                              (center[0] + (index % 3) - 1, center[1] - 3),
                              VIOLET)
                if preview is not None:
                    survives = any(
                        state[3] & preview & (1 << index)
                        for index in hypotheses)
                    removed = any(
                        state[3] & ~preview & (1 << index)
                        for index in hypotheses)
                    if survives:
                        self.diamond(frame, center, 4, VIOLET, hollow=True)
                    if removed:
                        self.line(frame, (center[0] - 3, center[1] + 3),
                                  (center[0] + 3, center[1] - 3), ROSE,
                                  dotted=True)
            else:
                self.line(frame, (center[0] - 2, center[1] - 2),
                          (center[0] + 2, center[1] + 2), GRANITE)

    def beacons(self, frame, state):
        scan_index = self.game.level["scans"] - state[4]
        scan_order = self.game.level["scan_order"]
        required = scan_order[scan_index] if scan_index < len(scan_order) else -1
        for index, item in enumerate(self.game.level["beacons"]):
            center = map_point(beacon_position(self.game.level, state[6], index))
            color = ALPINE if index == state[1] else MAROON
            if index == required:
                self.disc(frame, center, 6, SUN, hollow=True)
                self.diamond(frame, (center[0], center[1] - 7), 2, VIOLET)
            self.triangle(frame, center, 4, color, pattern=index)
            metric = item["metric"]
            if metric == "climb":
                self.line(frame, (center[0] - 3, center[1] + 5),
                          (center[0] + 3, center[1] - 2), SUN, dotted=True)
            elif metric == "sight":
                self.disc(frame, (center[0], center[1] + 1), 2, ICE,
                          hollow=True)

    def instruments(self, frame, state):
        # Countable scan stones, piton strikes, and a radial report dial.
        for index in range(self.game.level["scans"]):
            self.disc(frame, (5 + index * 4, 60), 1,
                      SKY if index < state[4] else GRANITE,
                      hollow=index >= state[4])
        for index in range(2):
            self.triangle(frame, (58, 56 + index * 4), 2,
                          RED if index < state[7] else ALPINE,
                          pattern=3 if index < state[7] else 0)
        self.disc(frame, (57, 6), 5, ICE, hollow=True)
        self.line(frame, (57, 1), (57, 11), GRANITE, dotted=True)
        self.line(frame, (52, 6), (62, 6), GRANITE, dotted=True)
        if state[9] == UNAVAILABLE:
            self.line(frame, (53, 2), (61, 10), RED, width=2)
            self.line(frame, (61, 2), (53, 10), RED, width=2)
        elif state[9] >= 0:
            ticks = 1 + state[9] % 8
            for index in range(ticks):
                angle = 2 * math.pi * index / ticks
                x = 57 + round(4 * math.cos(angle))
                y = 6 + round(4 * math.sin(angle))
                frame[y, x] = VIOLET

    def cursor(self, frame, state, center=None, color=INK):
        center = center or map_point(self.game.level["fix_sites"][state[0]])
        self.diamond(frame, center, 4, color, hollow=True)
        self.disc(frame, center, 1, SUN)

    def relocation_preview(self, frame, state):
        relocation = self.game.level["relocation"]
        if not relocation or not state[5]:
            return
        destination = map_point(relocation["to"])
        self.triangle(frame, destination, 5, ROSE,
                      pattern=relocation["beacon"])
        for hypothesis in range(len(self.game.level["tracks"])):
            old = reading(self.game.level, relocation["beacon"], hypothesis,
                          state[8], False)
            new = reading(self.game.level, relocation["beacon"], hypothesis,
                          state[8], True)
            if old != new and state[3] & (1 << hypothesis):
                self.diamond(frame,
                             map_point(current_position(self.game.level,
                                                        hypothesis, state[8])),
                             3, MAGENTA, hollow=True)

    def animation(self, frame):
        game = self.game
        if not game.anim_kind:
            if game.state[TERMINAL_INDEX] == LOSS:
                self.line(frame, (7, 7), (56, 54), RED, dotted=True, width=2)
            return
        before = game.state; after = game.pending_state
        progress = game.anim_progress; span = max(1, game.anim_total - 1)
        wave = min(progress, span - progress)
        if game.anim_kind == "cursor":
            a = map_point(game.level["fix_sites"][before[0]])
            b = map_point(game.level["fix_sites"][after[0]])
            center = (a[0] + (b[0] - a[0]) * progress // span,
                      a[1] + (b[1] - a[1]) * progress // span)
            self.cursor(frame, before, center=center, color=VIOLET)
        elif game.anim_kind == "beacon":
            center = map_point(beacon_position(game.level, before[6], after[1]))
            self.disc(frame, center, 5 + wave, SUN, hollow=True)
            self.triangle(frame, center, 4, ALPINE, pattern=after[1])
        elif game.anim_kind == "scan":
            center = map_point(beacon_position(game.level, before[6], before[1]))
            self.disc(frame, center, 3 + progress * 5, SKY, hollow=True)
            self.disc(frame, center, 4 + progress * 3, VIOLET, hollow=True)
            if progress > span // 2:
                removed = before[3] & ~after[3]
                for hypothesis in range(len(game.level["tracks"])):
                    if removed & (1 << hypothesis):
                        point = current_position(game.level, hypothesis, before[8])
                        self.line(frame, (map_point(point)[0] - 2, map_point(point)[1] - 2),
                                  (map_point(point)[0] + 2, map_point(point)[1] + 2), RED)
        elif game.anim_kind == "preview":
            destination = map_point(game.level["relocation"]["to"])
            self.disc(frame, destination, 3 + wave, MAGENTA, hollow=True)
            self.line(frame, map_point(beacon_position(game.level, False,
                                                        game.level["relocation"]["beacon"])),
                      destination, VIOLET, dotted=True)
        elif game.anim_kind == "relocate":
            index = game.level["relocation"]["beacon"]
            a = map_point(beacon_position(game.level, False, index))
            b = map_point(game.level["relocation"]["to"])
            center = (a[0] + (b[0] - a[0]) * progress // span,
                      a[1] + (b[1] - a[1]) * progress // span)
            self.triangle(frame, center, 4, MAGENTA, pattern=index)
        elif game.anim_kind == "reject":
            center = map_point(game.level["fix_sites"][before[0]])
            offset = (-2, 2, -1, 1, 0, 1, 0)[min(progress, 6)]
            self.diamond(frame, (center[0] + offset, center[1]), 5,
                         RED, hollow=True)
        elif game.anim_kind == "success":
            center = map_point(game.level["fix_sites"][before[0]])
            self.disc(frame, center, 4 + progress * 3, MEADOW, hollow=True)
            for index in range(5):
                angle = 2 * math.pi * index / 5
                point = (center[0] + round((3 + progress) * math.cos(angle)),
                         center[1] + round((3 + progress) * math.sin(angle)))
                self.diamond(frame, point, 1, SUN)
        elif game.anim_kind == "loss":
            inset = progress * 3
            self.line(frame, (5 + inset, 5), (59 - inset, 58), RED,
                      dotted=True, width=2)
            self.line(frame, (59 - inset, 5), (5 + inset, 58), MAROON,
                      dotted=True, width=2)
        else:
            center = map_point(game.level["fix_sites"][before[0]])
            offset = (-2, 2, -1, 1, 0)[min(progress, 4)]
            self.diamond(frame, (center[0] + offset, center[1]), 4,
                         GRANITE, hollow=True)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        state = self.game.state
        self.background(frame)
        self.ridge(frame)
        self.candidates(frame, state)
        self.beacons(frame, state)
        self.instruments(frame, state)
        self.cursor(frame, state)
        self.relocation_preview(frame, state)
        self.animation(frame)
        return frame


class Q070(ARCBaseGame):
    def __init__(self):
        self.display = SurveyDisplay(self)
        self.level = LEVELS[0]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = 0
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None
        levels = [
            Level(sprites=[], grid_size=(64, 64), data=deepcopy(item), name=item["name"])
            for item in LEVELS
        ]
        super().__init__(
            "q070", levels,
            Camera(0, 0, 64, 64, SNOW, SNOW, [self.display]),
            False, len(levels), [1, 2, 3, 4, 5, 6],
        )

    def on_set_level(self, _level):
        self.level = LEVELS[self.level_index]
        self.state = start_state(self.level)
        self.budget_left = self.budget_max = self.level["budget"]
        self.anim_kind = None
        self.anim_left = self.anim_total = self.anim_progress = 0
        self.pending_state = self.pending_budget = self.pending_terminal = None

    def begin(self, kind, frames, state, budget, terminal=None):
        self.anim_kind = kind
        self.anim_total = self.anim_left = frames
        self.anim_progress = 0
        self.pending_state = state
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
        before = self.state
        after = transition(self.level, before, action)
        if after == before:
            self.begin("blocked", 5, before, self.budget_left)
            return
        cost = action_cost(before, after)
        budget = self.budget_left - cost
        won = after[TERMINAL_INDEX] == WIN
        lost = after[TERMINAL_INDEX] == LOSS or (budget <= 0 and not won)
        if lost and after[TERMINAL_INDEX] != LOSS:
            after = after[:TERMINAL_INDEX] + (LOSS,)
        if won:
            kind, frames, terminal = "success", 7, "win"
        elif lost:
            kind, frames, terminal = "loss", 8, "loss"
        elif after[7] > before[7]:
            kind, frames, terminal = "reject", 7, None
        elif action in (1, 2):
            kind, frames, terminal = "cursor", 6, None
        elif action == 3:
            kind, frames, terminal = "beacon", 5, None
        elif action == 4:
            kind, frames, terminal = "scan", 8, None
        elif action == 5 and not before[5]:
            kind, frames, terminal = "preview", 7, None
        elif action == 5:
            kind, frames, terminal = "relocate", 8, None
        else:
            kind, frames, terminal = "blocked", 5, None
        self.begin(kind, frames, after, budget, terminal)
