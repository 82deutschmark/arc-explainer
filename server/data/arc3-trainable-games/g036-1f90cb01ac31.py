# Author: GPT 6.1 Sol
# Date: 25-October-2026
# PURPOSE: ARC-AGI-3 game g036 in one file (numpy + arcengine): level data, the cord rules, and the
#   scene drawn as named, layered engine sprites (green bench cloth, a wooden lattice of slats, the
#   cord one sprite per cell, a head with an eye, start and finish eyelets, crossing marks, spools of
#   spare thread, daisies).
# SRP/DRY check: Pass -- keeps the parent's movement/crossing functions and named sprite art;
#   adds six mixed-turn routing layouts through explicit crossing data; rules, safe opening,
#   unlimited Undo, current-level RESET and the once-decided tension-wave presentation are retained.
# CHANGELOG: 25-Oct-2026 (GPT 6.1 Sol) -- a separate tougher review version after Mark's "Better
#   but still seems very easy" note. Ordinary open slat meetings can turn but cannot be reused;
#   marked railed crossings retain straight-through two-pass order. Six levels compose these
#   existing rules into competing access choices instead of expanding forced perimeter travel.
# CHANGELOG: 25-Oct-2026 (GPT 6.1 Sol) -- a successful pull travels back along the intact cord,
#   tightens at the finish and holds a settled result; failed marks retain local feedback. Six
#   layouts use offset crossings, inset corners and branches. Unlimited ACTION7 stays; RESET,
#   including repeated RESET, keeps the current level and resets decoration to a reproducible phase.
#   Original rules by Codex (GPT-6); art and unlimited take-backs by Claude Opus 5.5 High.
# CHANGELOG: 21-Oct-2026 (Claude Opus 5.5 High) -- the Boss's review: "the player can get stuck. It seems
#   like this needs the undo button available." The take-back (ACTION7) is no longer rationed: it pulls
#   the cord back one cell at a time, as far as the start eyelet, on every level. A cord run into a dead
#   end can always be backed out of, so no state needs a full reset. The spools stay as a full rack on
#   the bench, inert (they no longer count anything). Levels, art and every other rule are unchanged.
# CHANGELOG: 20-Oct-2026 (Claude Opus 5.5 High) -- art pass. The paint routine is gone: every thing
#   on screen is a named sprite. Green cloth for ground, orange wooden slats rimmed in black for the
#   lattice, the cord as a light-blue strand (a strand that went under is black where it crosses),
#   a purple head with a black eye that looks the way it last moved, a black start eyelet and a
#   purple finish eyelet, spools of thread in the right margin for spare retracts, three daisies in
#   the corners that change each move and do nothing. Rules, levels, inputs and frames per action are
#   unchanged by the art.
#   Same day, play fixes on the Boss's word ("You're absolutely allowed to change how the game plays"):
#   level one is a winding run of twelve with one blind branch (it was six, under the gate's floor);
#   level two keeps its lesson on a wider board random play no longer clears; a RESET straight after a
#   bad pull restarts that level instead of the whole game. Levels three to ten are untouched.

import numpy as np


from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    GameState,
    InteractionMode,
    Level,
    Sprite,
)


# ── palette: each index has one job on the board ─────────────────────────────
CLOTH = 14        # green bench cloth, the camera background
WOOD = 12         # orange slats; spool flanges
RIM = 5           # black: slat rim, start eyelet, eye, empty spool core
UNDER = 5         # black: a strand gone into the groove at a crossing (its own name, same ink)
JUNCTION = 2      # a crossing that asks for nothing (no level carries one)
WANT_H = 9        # blue: the across strand must end on top
WANT_V = 0        # white: the up-and-down strand must end on top (yellow before; yellow is weak on wood)
CORD = 10         # light blue strand
PLAYER = 15       # purple head
END = 15          # purple finish eyelet; the cord's colour on a good pull
START = RIM
PETAL = 11        # yellow daisy petal (and level two's two dots, white before, kept apart from the bar)
PETAL_TURN = 0    # white: the one petal that turns
HEART = WOOD      # daisy centre


# ── the parent's slide helpers, unchanged ──────────────────────────────────────

def begin_translation(game, names=(), position=None, repaint=None, limit=8):
    game._translation_path = None
    sprites = {s.name: (s.x, s.y) for s in game.current_level.get_sprites()
               if any(s.name == n or (n.endswith('*') and s.name.startswith(n[:-1]))
                      for n in names)}
    game._translation_capture = (game.current_level, sprites,
        (game.camera.x, game.camera.y), position, position() if position else None,
        repaint, limit)

def translation_position(game, position):
    return getattr(game, '_translation_point', None) or position

def advance_translation(game):
    motion = getattr(game, '_translation_motion', None)
    if motion is None:
        return False
    motion['frame'] += 1
    t = motion['frame'] / motion['count']
    def lerp(a, b):
        return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
    for sprite, start, end in motion['sprites']:
        sprite.set_position(*(motion['path'][motion['frame']-1] if motion['path'] else lerp(start, end)))
    game.camera.x, game.camera.y = lerp(motion['camera'][0], motion['camera'][1])
    if motion['point'] is not None:
        game._translation_point = lerp(*motion['point'])
    if motion['repaint'] is not None:
        motion['repaint']()
    if motion['frame'] == motion['count']:
        game._translation_motion = None
        game._translation_point = None
        if motion['complete']:
            game.complete_action()
    return True

def finish_translation(game, complete=True):
    capture = getattr(game, '_translation_capture', None)
    game._translation_capture = None
    if capture is None or capture[0] is not game.current_level or game._next_level:
        if complete:
            game.complete_action()
        return
    level, previous, camera, position, point, repaint, limit = capture
    sprites = []
    distances = []
    path = getattr(game, "_translation_path", None)
    for sprite in level.get_sprites():
        if sprite.name not in previous:
            continue
        start, end = previous[sprite.name], (sprite.x, sprite.y)
        distance = max(abs(start[0] - end[0]), abs(start[1] - end[1]))
        if distance or path:
            sprites.append((sprite, start, end))
            distances.append(distance)
    points = (point, position()) if position else None
    if points:
        distances.append(max(abs(a-b) for a,b in zip(*points)))
    count = len(path) if path else max(distances, default=0)
    if count < 2 or (not path and count > limit):
        if complete:
            game.complete_action()
        return
    game._translation_motion = dict(frame=0, count=count, sprites=sprites,
        camera=(camera, (game.camera.x, game.camera.y)), point=points, repaint=repaint,
        complete=complete, path=path)
    advance_translation(game)

def clear_translation(game):
    game._translation_path = None
    game._translation_capture = None
    game._translation_motion = None
    game._translation_point = None


# ── refined level data; the parent's cord and crossing rules below are unchanged ──

N = 16
CELL = 4
LO, HI = 1, N - 2

UP, DOWN, LEFT, RIGHT = (0, -1), (0, 1), (-1, 0), (1, 0)
DIRS = (UP, DOWN, LEFT, RIGHT)

LEVELS_SPEC = [{'cols': [],
  'rows': [],
  'cuts': [],
  'start': (3, 4),
  'end': (4, 9),
  'marks': {},
  'undos': 4,
  'track': [(3, 4),
            (4, 4),
            (5, 4),
            (6, 4),
            (7, 4),
            (8, 4),
            (9, 4),
            (7, 5),
            (7, 6),
            (7, 7),
            (6, 7),
            (5, 7),
            (4, 7),
            (4, 8),
            (4, 9)]},
 {'cols': [5],
  'rows': [5],
  'cuts': [],
  'start': (2, 12),
  'end': (12, 2),
  'marks': {(5, 5): 'v'},
  'undos': 4,
  'track': [(2, 2),
            (2, 3),
            (2, 4),
            (2, 5),
            (2, 6),
            (2, 7),
            (2, 8),
            (2, 9),
            (2, 10),
            (2, 11),
            (2, 12),
            (3, 2),
            (3, 5),
            (3, 11),
            (4, 2),
            (4, 5),
            (4, 11),
            (5, 2),
            (5, 3),
            (5, 4),
            (5, 5),
            (5, 6),
            (5, 7),
            (5, 8),
            (5, 9),
            (5, 10),
            (5, 11),
            (6, 2),
            (6, 5),
            (6, 11),
            (7, 2),
            (7, 5),
            (7, 11),
            (8, 2),
            (8, 5),
            (8, 11),
            (9, 2),
            (9, 5),
            (9, 11),
            (10, 2),
            (10, 5),
            (10, 11),
            (11, 2),
            (11, 3),
            (11, 4),
            (11, 5),
            (11, 6),
            (11, 7),
            (11, 8),
            (11, 9),
            (11, 10),
            (11, 11),
            (12, 2),
            (12, 5),
            (13, 5)]},
 {'cols': [6],
  'rows': [6, 10],
  'cuts': [],
  'start': (2, 3),
  'end': (6, 11),
  'marks': {(6, 6): 'v'},
  'crossings': [(6, 6)],
  'undos': 4,
  'track': [(2, 3),
            (2, 4),
            (2, 5),
            (2, 6),
            (2, 7),
            (2, 8),
            (2, 9),
            (2, 10),
            (2, 11),
            (2, 12),
            (3, 3),
            (3, 6),
            (3, 10),
            (3, 12),
            (4, 3),
            (4, 6),
            (4, 10),
            (4, 12),
            (5, 3),
            (5, 6),
            (5, 10),
            (5, 12),
            (6, 3),
            (6, 4),
            (6, 5),
            (6, 6),
            (6, 7),
            (6, 8),
            (6, 9),
            (6, 10),
            (6, 11),
            (6, 12),
            (7, 3),
            (7, 6),
            (7, 10),
            (7, 12),
            (8, 3),
            (8, 6),
            (8, 10),
            (8, 12),
            (9, 3),
            (9, 6),
            (9, 10),
            (9, 12),
            (10, 3),
            (10, 6),
            (10, 10),
            (10, 12),
            (11, 3),
            (11, 6),
            (11, 10),
            (11, 12),
            (12, 3),
            (12, 4),
            (12, 5),
            (12, 6),
            (12, 7),
            (12, 8),
            (12, 9),
            (12, 10),
            (12, 11),
            (12, 12)]},
 {'cols': [9],
  'rows': [9],
  'cuts': [],
  'start': (1, 2),
  'end': (13, 13),
  'marks': {(9, 9): 'h'},
  'undos': 4,
  'track': [(1, 2),
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (1, 9),
            (1, 10),
            (1, 11),
            (1, 12),
            (1, 13),
            (2, 2),
            (2, 9),
            (2, 13),
            (3, 2),
            (3, 9),
            (3, 13),
            (4, 2),
            (4, 9),
            (4, 13),
            (5, 2),
            (5, 9),
            (5, 13),
            (5, 14),
            (5, 15),
            (6, 2),
            (6, 9),
            (6, 13),
            (7, 2),
            (7, 9),
            (7, 13),
            (8, 2),
            (8, 9),
            (8, 13),
            (9, 2),
            (9, 3),
            (9, 4),
            (9, 5),
            (9, 6),
            (9, 7),
            (9, 8),
            (9, 9),
            (9, 10),
            (9, 11),
            (9, 12),
            (9, 13),
            (10, 2),
            (10, 9),
            (10, 13),
            (11, 2),
            (11, 9),
            (11, 13),
            (12, 2),
            (12, 9),
            (12, 13),
            (13, 2),
            (13, 3),
            (13, 4),
            (13, 5),
            (13, 6),
            (13, 7),
            (13, 8),
            (13, 9),
            (13, 10),
            (13, 11),
            (13, 12),
            (13, 13)]},
 {'cols': [4, 10],
  'crossings': [(4, 5), (10, 10)],
  'cuts': [],
  'end': (10, 6),
  'marks': {(4, 5): 'h', (10, 10): 'v'},
  'rows': [5, 10],
  'start': (1, 1),
  'track': [(1, 1),
            (1, 2),
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (1, 9),
            (1, 10),
            (1, 11),
            (1, 12),
            (1, 13),
            (1, 14),
            (2, 1),
            (2, 5),
            (2, 10),
            (2, 14),
            (3, 1),
            (3, 5),
            (3, 10),
            (3, 14),
            (4, 1),
            (4, 2),
            (4, 3),
            (4, 4),
            (4, 5),
            (4, 6),
            (4, 7),
            (4, 8),
            (4, 9),
            (4, 10),
            (4, 11),
            (4, 12),
            (4, 13),
            (4, 14),
            (5, 1),
            (5, 5),
            (5, 10),
            (5, 14),
            (6, 1),
            (6, 5),
            (6, 10),
            (6, 14),
            (7, 1),
            (7, 5),
            (7, 10),
            (7, 14),
            (8, 1),
            (8, 5),
            (8, 10),
            (8, 14),
            (9, 1),
            (9, 5),
            (9, 10),
            (9, 14),
            (10, 1),
            (10, 2),
            (10, 3),
            (10, 4),
            (10, 5),
            (10, 6),
            (10, 7),
            (10, 8),
            (10, 9),
            (10, 10),
            (10, 11),
            (10, 12),
            (10, 13),
            (10, 14),
            (11, 1),
            (11, 5),
            (11, 10),
            (11, 14),
            (12, 1),
            (12, 5),
            (12, 10),
            (12, 14),
            (13, 1),
            (13, 5),
            (13, 10),
            (13, 14),
            (14, 1),
            (14, 2),
            (14, 3),
            (14, 4),
            (14, 5),
            (14, 6),
            (14, 7),
            (14, 8),
            (14, 9),
            (14, 10),
            (14, 11),
            (14, 12),
            (14, 13),
            (14, 14)],
  'undos': 4},
 {'cols': [4, 8, 12],
  'crossings': [(4, 5), (12, 5), (8, 11)],
  'cuts': [],
  'end': (8, 6),
  'marks': {(4, 5): 'h', (8, 11): 'v', (12, 5): 'h'},
  'rows': [5, 11],
  'start': (1, 1),
  'track': [(1, 1),
            (1, 2),
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (1, 9),
            (1, 10),
            (1, 11),
            (1, 12),
            (1, 13),
            (1, 14),
            (2, 1),
            (2, 5),
            (2, 11),
            (2, 14),
            (3, 1),
            (3, 5),
            (3, 11),
            (3, 14),
            (4, 1),
            (4, 2),
            (4, 3),
            (4, 4),
            (4, 5),
            (4, 6),
            (4, 7),
            (4, 8),
            (4, 9),
            (4, 10),
            (4, 11),
            (4, 12),
            (4, 13),
            (4, 14),
            (5, 1),
            (5, 5),
            (5, 11),
            (5, 14),
            (6, 1),
            (6, 5),
            (6, 11),
            (6, 14),
            (7, 1),
            (7, 5),
            (7, 11),
            (7, 14),
            (8, 1),
            (8, 2),
            (8, 3),
            (8, 4),
            (8, 5),
            (8, 6),
            (8, 7),
            (8, 8),
            (8, 9),
            (8, 10),
            (8, 11),
            (8, 12),
            (8, 13),
            (8, 14),
            (9, 1),
            (9, 5),
            (9, 11),
            (9, 14),
            (10, 1),
            (10, 5),
            (10, 11),
            (10, 14),
            (11, 1),
            (11, 5),
            (11, 11),
            (11, 14),
            (12, 1),
            (12, 2),
            (12, 3),
            (12, 4),
            (12, 5),
            (12, 6),
            (12, 7),
            (12, 8),
            (12, 9),
            (12, 10),
            (12, 11),
            (12, 12),
            (12, 13),
            (12, 14),
            (13, 1),
            (13, 5),
            (13, 11),
            (13, 14),
            (14, 1),
            (14, 2),
            (14, 3),
            (14, 4),
            (14, 5),
            (14, 6),
            (14, 7),
            (14, 8),
            (14, 9),
            (14, 10),
            (14, 11),
            (14, 12),
            (14, 13),
            (14, 14)],
  'undos': 4},
 {'cols': [4, 8, 12],
  'crossings': [(4, 4), (8, 4), (12, 4), (8, 12)],
  'cuts': [],
  'end': (12, 13),
  'marks': {(4, 4): 'h', (8, 4): 'h', (8, 12): 'v', (12, 4): 'h'},
  'rows': [4, 8, 12],
  'start': (1, 1),
  'track': [(1, 1),
            (1, 2),
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (1, 9),
            (1, 10),
            (1, 11),
            (1, 12),
            (1, 13),
            (1, 14),
            (2, 1),
            (2, 4),
            (2, 8),
            (2, 12),
            (2, 14),
            (3, 1),
            (3, 4),
            (3, 8),
            (3, 12),
            (3, 14),
            (4, 1),
            (4, 2),
            (4, 3),
            (4, 4),
            (4, 5),
            (4, 6),
            (4, 7),
            (4, 8),
            (4, 9),
            (4, 10),
            (4, 11),
            (4, 12),
            (4, 13),
            (4, 14),
            (5, 1),
            (5, 4),
            (5, 8),
            (5, 12),
            (5, 14),
            (6, 1),
            (6, 4),
            (6, 8),
            (6, 12),
            (6, 14),
            (7, 1),
            (7, 4),
            (7, 8),
            (7, 12),
            (7, 14),
            (8, 1),
            (8, 2),
            (8, 3),
            (8, 4),
            (8, 5),
            (8, 6),
            (8, 7),
            (8, 8),
            (8, 9),
            (8, 10),
            (8, 11),
            (8, 12),
            (8, 13),
            (8, 14),
            (9, 1),
            (9, 4),
            (9, 8),
            (9, 12),
            (9, 14),
            (10, 1),
            (10, 4),
            (10, 8),
            (10, 12),
            (10, 14),
            (11, 1),
            (11, 4),
            (11, 8),
            (11, 12),
            (11, 14),
            (12, 1),
            (12, 2),
            (12, 3),
            (12, 4),
            (12, 5),
            (12, 6),
            (12, 7),
            (12, 8),
            (12, 9),
            (12, 10),
            (12, 11),
            (12, 12),
            (12, 13),
            (12, 14),
            (13, 1),
            (13, 4),
            (13, 8),
            (13, 12),
            (13, 14),
            (14, 1),
            (14, 2),
            (14, 3),
            (14, 4),
            (14, 5),
            (14, 6),
            (14, 7),
            (14, 8),
            (14, 9),
            (14, 10),
            (14, 11),
            (14, 12),
            (14, 13),
            (14, 14)],
  'undos': 4},
 {'cols': [4, 12],
  'rows': [4, 12],
  'cuts': [],
  'start': (14, 14),
  'end': (12, 14),
  'marks': {(4, 4): 'h', (4, 12): 'v', (12, 4): 'v', (12, 12): 'v'},
  'undos': 3},
 {'cols': [4, 8, 12],
  'crossings': [(4, 4), (8, 8), (12, 12)],
  'cuts': [],
  'end': (14, 3),
  'marks': {(4, 4): 'h', (8, 8): 'v', (12, 12): 'h'},
  'rows': [4, 8, 12],
  'start': (1, 1),
  'track': [(1, 1),
            (1, 2),
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (1, 9),
            (1, 10),
            (1, 11),
            (1, 12),
            (1, 13),
            (1, 14),
            (2, 1),
            (2, 4),
            (2, 8),
            (2, 12),
            (2, 14),
            (3, 1),
            (3, 4),
            (3, 8),
            (3, 12),
            (3, 14),
            (4, 1),
            (4, 2),
            (4, 3),
            (4, 4),
            (4, 5),
            (4, 6),
            (4, 7),
            (4, 8),
            (4, 9),
            (4, 10),
            (4, 11),
            (4, 12),
            (4, 13),
            (4, 14),
            (5, 1),
            (5, 4),
            (5, 8),
            (5, 12),
            (5, 14),
            (6, 1),
            (6, 4),
            (6, 8),
            (6, 12),
            (6, 14),
            (7, 1),
            (7, 4),
            (7, 8),
            (7, 12),
            (7, 14),
            (8, 1),
            (8, 2),
            (8, 3),
            (8, 4),
            (8, 5),
            (8, 6),
            (8, 7),
            (8, 8),
            (8, 9),
            (8, 10),
            (8, 11),
            (8, 12),
            (8, 13),
            (8, 14),
            (9, 1),
            (9, 4),
            (9, 8),
            (9, 12),
            (9, 14),
            (10, 1),
            (10, 4),
            (10, 8),
            (10, 12),
            (10, 14),
            (11, 1),
            (11, 4),
            (11, 8),
            (11, 12),
            (11, 14),
            (12, 1),
            (12, 2),
            (12, 3),
            (12, 4),
            (12, 5),
            (12, 6),
            (12, 7),
            (12, 8),
            (12, 9),
            (12, 10),
            (12, 11),
            (12, 12),
            (12, 13),
            (12, 14),
            (13, 1),
            (13, 4),
            (13, 8),
            (13, 12),
            (13, 14),
            (14, 1),
            (14, 2),
            (14, 3),
            (14, 4),
            (14, 5),
            (14, 6),
            (14, 7),
            (14, 8),
            (14, 9),
            (14, 10),
            (14, 11),
            (14, 12),
            (14, 13),
            (14, 14)],
  'undos': 4},
 {'cols': [3, 6, 9, 12],
  'crossings': [(3, 4), (6, 4), (9, 4), (12, 4), (6, 12)],
  'cuts': [],
  'end': (14, 13),
  'marks': {(3, 4): 'h', (6, 4): 'h', (6, 12): 'v', (9, 4): 'h', (12, 4): 'v'},
  'rows': [4, 8, 12],
  'start': (1, 1),
  'track': [(1, 1),
            (1, 2),
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (1, 9),
            (1, 10),
            (1, 11),
            (1, 12),
            (1, 13),
            (1, 14),
            (2, 1),
            (2, 4),
            (2, 8),
            (2, 12),
            (2, 14),
            (3, 1),
            (3, 2),
            (3, 3),
            (3, 4),
            (3, 5),
            (3, 6),
            (3, 7),
            (3, 8),
            (3, 9),
            (3, 10),
            (3, 11),
            (3, 12),
            (3, 13),
            (3, 14),
            (4, 1),
            (4, 4),
            (4, 8),
            (4, 12),
            (4, 14),
            (5, 1),
            (5, 4),
            (5, 8),
            (5, 12),
            (5, 14),
            (6, 1),
            (6, 2),
            (6, 3),
            (6, 4),
            (6, 5),
            (6, 6),
            (6, 7),
            (6, 8),
            (6, 9),
            (6, 10),
            (6, 11),
            (6, 12),
            (6, 13),
            (6, 14),
            (7, 1),
            (7, 4),
            (7, 8),
            (7, 12),
            (7, 14),
            (8, 1),
            (8, 4),
            (8, 8),
            (8, 12),
            (8, 14),
            (9, 1),
            (9, 2),
            (9, 3),
            (9, 4),
            (9, 5),
            (9, 6),
            (9, 7),
            (9, 8),
            (9, 9),
            (9, 10),
            (9, 11),
            (9, 12),
            (9, 13),
            (9, 14),
            (10, 1),
            (10, 4),
            (10, 8),
            (10, 12),
            (10, 14),
            (11, 1),
            (11, 4),
            (11, 8),
            (11, 12),
            (11, 14),
            (12, 1),
            (12, 2),
            (12, 3),
            (12, 4),
            (12, 5),
            (12, 6),
            (12, 7),
            (12, 8),
            (12, 9),
            (12, 10),
            (12, 11),
            (12, 12),
            (12, 13),
            (12, 14),
            (13, 1),
            (13, 4),
            (13, 8),
            (13, 12),
            (13, 14),
            (14, 1),
            (14, 2),
            (14, 3),
            (14, 4),
            (14, 5),
            (14, 6),
            (14, 7),
            (14, 8),
            (14, 9),
            (14, 10),
            (14, 11),
            (14, 12),
            (14, 13),
            (14, 14)],
  'undos': 4}]

DECOR_CELLS = ()


def build_board(spec: dict) -> tuple[dict, dict]:
    track: dict[tuple[int, int], bool] = {}
    for i in range(LO, HI + 1):
        for cell in ((i, LO), (i, HI), (LO, i), (HI, i)):
            track[cell] = True
    for x in spec["cols"]:
        for y in range(LO, HI + 1):
            track[(x, y)] = True
    for y in spec["rows"]:
        for x in range(LO, HI + 1):
            track[(x, y)] = True
    if "track" in spec:
        track = {tuple(c): True for c in spec["track"]}
    for cell in spec["cuts"]:
        track.pop(tuple(cell), None)

    junctions: dict[tuple[int, int], str | None] = {}
    for x in spec["cols"]:
        for y in spec["rows"]:
            if (x, y) in track:
                junctions[(x, y)] = spec["marks"].get((x, y))
    if "crossings" in spec:
        # An unmarked open meeting of slats is ordinary track: it may turn but cannot be reused.
        # Only the visibly railed crossings have the established straight-through/two-pass rule.
        junctions = {tuple(cell): spec["marks"].get(tuple(cell)) for cell in spec["crossings"]}
    return track, junctions


def axis_of(direction: tuple[int, int]) -> str:
    return "H" if direction[1] == 0 else "V"


def initial_state(spec: dict) -> dict:
    start = tuple(spec["start"])
    return {"pos": start, "spent": {start}, "cross": {}, "arms": {start: set()}}


def clone_state(state: dict) -> dict:
    return {
        "pos": state["pos"],
        "spent": set(state["spent"]),
        "cross": dict(state["cross"]),
        "arms": {k: set(v) for k, v in state["arms"].items()},
    }


def try_step(state: dict, direction: tuple[int, int], track: dict, junctions: dict):
    dx, dy = direction
    axis = axis_of(direction)
    passed: list[tuple[int, int]] = []
    cur = (state["pos"][0] + dx, state["pos"][1] + dy)
    while True:
        if cur not in track:
            return None
        if cur not in junctions:
            break
        if axis in state["cross"].get(cur, ()) or cur in passed:
            return None
        passed.append(cur)
        cur = (cur[0] + dx, cur[1] + dy)
    if cur in state["spent"]:
        return None

    out = clone_state(state)
    back = (-dx, -dy)
    out["arms"].setdefault(state["pos"], set()).add(direction)
    for cell in passed:
        arms = out["arms"].setdefault(cell, set())
        arms.add(back)
        arms.add(direction)
        out["cross"][cell] = out["cross"].get(cell, ()) + (axis,)
    out["arms"].setdefault(cur, set()).add(back)
    out["spent"].add(cur)
    out["pos"] = cur
    return out


def failed_marks(state: dict, junctions: dict) -> list:
    bad = []
    for cell, mark in junctions.items():
        if mark is None:
            continue
        order = state["cross"].get(cell, ())
        if len(order) < 2 or order[1] != ("H" if mark == "h" else "V"):
            bad.append(cell)
    return bad


def knot_holds(state: dict, junctions: dict) -> bool:
    return not failed_marks(state, junctions)


def state_key(state: dict) -> tuple:
    return (state["pos"], frozenset(state["spent"]),
            tuple(sorted(state["cross"].items())))



# ── art: pixel grids only ────────────────────────────────────────────────────

def _slat(cell, track) -> list[list[int]]:
    """One wooden slat tile. An edge pixel facing cloth is black, so a run of slats gets one
    continuous rim; a corner where both sides face cloth is cut round (the parent's rounding); an
    inside corner whose diagonal is cloth is black too, so a crossing reads as framed."""
    x, y = cell
    px = [[WOOD] * CELL for _ in range(CELL)]
    up, down = (x, y - 1) in track, (x, y + 1) in track
    left, right = (x - 1, y) in track, (x + 1, y) in track
    for k in range(CELL):
        if not up:
            px[0][k] = RIM
        if not down:
            px[CELL - 1][k] = RIM
        if not left:
            px[k][0] = RIM
        if not right:
            px[k][CELL - 1] = RIM
    for j, i, dx, dy in ((0, 0, -1, -1), (0, 3, 1, -1), (3, 0, -1, 1), (3, 3, 1, 1)):
        side_x, side_y = (x + dx, y) in track, (x, y + dy) in track
        if not side_x and not side_y:
            px[j][i] = -1
        elif side_x and side_y and (x + dx, y + dy) not in track:
            px[j][i] = RIM
    return px


def _crossing(mark: str | None) -> list[list[int]]:
    # The parent's two bars per marked crossing, along the strand that must end on top.
    colour = JUNCTION if mark is None else WANT_H if mark == 'h' else WANT_V
    px = [[-1] * CELL for _ in range(CELL)]
    if mark == 'h':
        px[0] = [colour] * CELL
        px[3] = [colour] * CELL
    else:
        for row in px:
            row[0] = row[3] = colour
    return px


def _eyelet(colour: int) -> list[list[int]]:
    px = [[colour] * CELL for _ in range(CELL)]
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            px[y][x] = -1
    return px


def _arm(px, direction, colour) -> None:
    # The parent's two-pixel arm toward one side of the cell.
    if direction == UP:
        rows, cols = (0, 1), (1, 2)
    elif direction == DOWN:
        rows, cols = (2, 3), (1, 2)
    elif direction == LEFT:
        rows, cols = (1, 2), (0, 1)
    else:
        rows, cols = (1, 2), (2, 3)
    for r in rows:
        for c in cols:
            px[r][c] = colour


def _cord_pixels(arms, order, colour) -> list[list[int]]:
    """The strand in one cell. At a crossing laid twice the first strand is drawn gone-under and
    the second over it, exactly the parent's pixel order."""
    px = [[-1] * CELL for _ in range(CELL)]
    if len(order) == 2:
        under_axis = order[0]
        for axis in (under_axis, order[1]):
            for direction in arms:
                if axis_of(direction) == axis:
                    _arm(px, direction, UNDER if axis == under_axis else colour)
    else:
        for direction in arms:
            _arm(px, direction, colour)
    return px


# The head: a round purple tip with one or two black eyes on the side it is heading.
_HEAD = {
    "front": (".PP.", "PkkP", "PPPP", ".PP."),
    "up":    (".kk.", "PPPP", "PPPP", ".PP."),
    "down":  (".PP.", "PPPP", "PkkP", ".PP."),
    "left":  (".PP.", "kPPP", "PPPP", ".PP."),
    "right": (".PP.", "PPPk", "PPPP", ".PP."),
}
FACING = {UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right"}


def _head(face: str) -> list[list[int]]:
    key = {".": -1, "P": PLAYER, "k": RIM}
    return [[key[ch] for ch in row] for row in _HEAD[face]]


def _spool(full: bool) -> list[list[int]]:
    # A wooden spool: thread wound light blue (black core when empty). Since 21-Oct every spool stays
    # full: they are bench scenery, not a count of anything.
    t = CORD if full else RIM
    return [[WOOD] * CELL, [-1, t, t, -1], [-1, t, t, -1], [WOOD] * CELL]


def _daisy(phase: int) -> list[list[int]]:
    px = [[-1] * CELL for _ in range(CELL)]
    petals = ((0, 1), (1, 2), (2, 1), (1, 0))
    for k, (r, c) in enumerate(petals):
        px[r][c] = PETAL_TURN if k == phase % 4 else PETAL
    px[1][1] = HEART
    return px


def _hint_pixels() -> list[list[int]]:
    # Level two's wordless picture, the parent's exact pixels: a strand across, two dots, a bar.
    px = [[-1] * 10 for _ in range(18)]
    for r in (0, 1):
        px[r] = [CORD] * 10
    px[4][4] = PETAL
    px[6][4] = px[6][5] = PETAL
    for r in range(8, 18):
        px[r][4] = px[r][5] = WANT_V
    return px


SPOOL_X, SPOOL_TOP, SPOOL_GAP = N * CELL - CELL, 8, 6   # where the parent's retract studs sat
DAISY_CELLS = ((0, 0), (0, N - 1), (N - 1, N - 1))      # cloth corners, off every board
HINT_X, HINT_Y = 53, 34   # level two's picture, in the cloth right of its board (moved 20-Oct with the board)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for index, spec in enumerate(LEVELS_SPEC):
        track, junctions = build_board(spec)
        start, end = tuple(spec["start"]), tuple(spec["end"])
        sprites: list[Sprite] = []

        def add(pixels, name, x, y, layer, tags=(), visible=True):
            sprites.append(Sprite(
                pixels=pixels, name=name, x=x, y=y, layer=layer, tags=list(tags),
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, visible=visible,
            ))

        for cell in sorted(track):
            add(_slat(cell, track), f"t_{cell[0]}_{cell[1]}", cell[0] * CELL, cell[1] * CELL, -1, ("slat",))
        add(_eyelet(END), "anchor", end[0] * CELL, end[1] * CELL, 0, ("eyelet",))
        if start != end:
            add(_eyelet(START), "eyelet", start[0] * CELL, start[1] * CELL, 0, ("eyelet",))
        for cell in sorted(track):
            add([[-1] * CELL for _ in range(CELL)], f"cord_{cell[0]}_{cell[1]}",
                cell[0] * CELL, cell[1] * CELL, 1, ("cord",))
        for cell in sorted(junctions):
            add(_crossing(junctions[cell]), f"x_{cell[0]}_{cell[1]}", cell[0] * CELL, cell[1] * CELL, 2, ("mark",))
            mark = junctions[cell]
            if mark is not None:
                solid = [[WANT_H if mark == "h" else WANT_V] * CELL for _ in range(CELL)]
                add(solid, f"flash_{cell[0]}_{cell[1]}", cell[0] * CELL, cell[1] * CELL, 3,
                    ("flash",), visible=False)
        if index == 1:
            add(_hint_pixels(), "hint", HINT_X, HINT_Y, 4, ("picture",))
        for k, cell in enumerate(DAISY_CELLS):
            add(_daisy(k), f"daisy_{k}", cell[0] * CELL, cell[1] * CELL, 0, ("daisy",))
        # 'undos' was the take-back ration until 21-Oct; it now only sets how many spools stand on the bench.
        for i in range(spec["undos"]):
            add(_spool(True), f"spool_{i}", SPOOL_X, SPOOL_TOP + i * SPOOL_GAP, 5, ("spool",))
        add(_head("front"), "head", start[0] * CELL, start[1] * CELL, 6, ("head",))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G036(ARCBaseGame):

    CINCH_FRAMES = 8

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.track, self.junctions = build_board(spec)
        self.state = initial_state(spec)
        self.history: list[dict] = []
        self.cinch = 0
        self.pull_good = None
        self.pull_bad = ()
        self.pull_order = {}
        self.pull_length = 0
        self.tick = 0
        self.facing = "front"
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=CLOTH, letter_box=CLOTH,
        )
        super().__init__(game_id="g036", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5, 7])

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        spec = LEVELS_SPEC[self.level_index]
        self.track, self.junctions = build_board(spec)
        self.state = initial_state(spec)
        self.history = []
        self.cinch = 0
        self.pull_good = None
        self.pull_bad = ()
        self.pull_order = {}
        self.pull_length = 0
        self.tick = 0
        self.facing = "front"
        self._redraw()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()

    def handle_reset(self) -> None:
        # The engine normally treats a second RESET (zero presses since the first) as a full
        # restart. During play the player's retry always belongs to this level, even immediately
        # after a wrong pull or level transition. A finished run may start afresh.
        if self._state == GameState.WIN:
            self.full_reset()
        else:
            self.level_reset()

    # ── drawing: sprites take their pixels from the state; nothing here changes a rule ──

    def _sprite(self, name: str):
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def _place_head(self) -> None:
        head = self._sprite("head")
        if head is None:
            return
        px, py = translation_position(self, (self.state["pos"][0] * CELL, self.state["pos"][1] * CELL))
        if self.cinch and self.pull_good and self.cinch in (6, 5):
            # The whole tip draws one pixel back along its actual incoming strand, then settles
            # in the eyelet. This tug never changes the cord state or the decided outcome.
            previous = self.history[-1]["pos"] if self.history else self.state["pos"]
            px += (previous[0] > self.state["pos"][0]) - (previous[0] < self.state["pos"][0])
            py += (previous[1] > self.state["pos"][1]) - (previous[1] < self.state["pos"][1])
        head.set_position(px, py)

    def _redraw(self) -> None:
        state = self.state
        good_pull = self.pull_good is True
        # A monotone tension wave starts at the finish and runs back through the route. It never
        # alternates the whole cord, and the last two frames hold the intact, settled purple cord.
        progress = min(1.0, (self.CINCH_FRAMES - self.cinch + 1) / 6) if good_pull else 0.0
        threshold = self.pull_length * (1 - progress)
        for cell in self.track:
            sprite = self._sprite(f"cord_{cell[0]}_{cell[1]}")
            if sprite is None:
                continue
            arms = state["arms"].get(cell)
            if arms:
                colour = END if good_pull and self.pull_order.get(cell, -1) >= threshold else CORD
                sprite.pixels = np.array(_cord_pixels(arms, state["cross"].get(cell, ()), colour),
                                         dtype=np.int8)
                sprite.set_visible(True)
            else:
                sprite.set_visible(False)
        for cell, mark in self.junctions.items():
            if mark is not None:
                flash = self._sprite(f"flash_{cell[0]}_{cell[1]}")
                if flash is not None:
                    # Failed crossings alone fill in their own mark colour. The rest of the cord
                    # stays light blue; this cannot be confused with a successful tightening wave.
                    flash.set_visible(self.cinch > 2 and cell in self.pull_bad)
        for k in range(len(DAISY_CELLS)):
            daisy = self._sprite(f"daisy_{k}")
            if daisy is not None:
                daisy.pixels = np.array(_daisy(self.tick + k), dtype=np.int8)
        head = self._sprite("head")
        if head is not None:
            head.pixels = np.array(_head(self.facing), dtype=np.int8)
            if good_pull and self.cinch <= 2:
                # A closed bright centre inside the same purple silhouette is the settled latch.
                head.pixels[1:3, 1:3] = CORD
        self._place_head()

    # ── the parent's controls, unchanged apart from the facing and the redraw calls ──

    def lay(self, direction: tuple[int, int]) -> bool:
        nxt = try_step(self.state, direction, self.track, self.junctions)
        if nxt is None:
            return False
        self.history.append(self.state)
        self.state = nxt
        self.facing = FACING[direction]
        return True

    def retract(self) -> bool:
        # 21-Oct-2026: no ration. A take-back works whenever any cord is laid, so a cord run into a
        # dead end (every way forward spent or off the slats) can always be backed out of. It still
        # costs a press like any move. It refuses only at the start eyelet, where nothing is laid.
        if not self.history:
            return False
        self.state = self.history.pop()
        if self.history:
            previous = self.history[-1]["pos"]
            dx, dy = self.state["pos"][0] - previous[0], self.state["pos"][1] - previous[1]
            direction = ((dx > 0) - (dx < 0), (dy > 0) - (dy < 0))
            self.facing = FACING[direction]
        else:
            self.facing = "front"
        return True

    def pull(self) -> bool:
        if self.state["pos"] != tuple(LEVELS_SPEC[self.level_index]["end"]):
            return False
        # Decide once. Later frames read only this frozen result and the frozen route.
        self.pull_bad = tuple(failed_marks(self.state, self.junctions))
        self.pull_good = not self.pull_bad
        route = []
        states = self.history + [self.state]
        for before, after in zip(states, states[1:]):
            start, end = before["pos"], after["pos"]
            dx = (end[0] > start[0]) - (end[0] < start[0])
            dy = (end[1] > start[1]) - (end[1] < start[1])
            cell = start
            while cell != end:
                route.append(cell)
                cell = (cell[0] + dx, cell[1] + dy)
        route.append(self.state["pos"])
        self.pull_length = len(route) - 1
        self.pull_order = {cell: index for index, cell in enumerate(route)}
        self.cinch = self.CINCH_FRAMES
        return True

    def _settle(self) -> None:
        if self.pull_good:
            self.next_level()
        else:
            # Keep the accumulated press count for scoring; handle_reset owns retry semantics.
            presses = self._action_count
            self.level_reset()
            self._action_count = presses

    def step(self) -> None:
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if advance_translation(self):
            return
        begin_translation(self, position=lambda: (self.state['pos'][0]*CELL, self.state['pos'][1]*CELL),
                          repaint=self._place_head, limit=CELL)
        if self.cinch:
            self.cinch -= 1
            if self.cinch == 0:
                self._settle()
                self._redraw()
                finish_translation(self)
            else:
                self._redraw()
            return

        self.tick += 1
        action = self.action.id
        if action == GameAction.ACTION1:
            self.lay(UP)
        elif action == GameAction.ACTION2:
            self.lay(DOWN)
        elif action == GameAction.ACTION3:
            self.lay(LEFT)
        elif action == GameAction.ACTION4:
            self.lay(RIGHT)
        elif action == GameAction.ACTION5:
            if self.pull():
                self._redraw()
                return
        elif action == GameAction.ACTION7:
            self.retract()
        self._redraw()
        finish_translation(self)
