"""Potion Mixer v2 -- Chemistry puzzle game for ARC-AGI-3.

Click vials in the correct sequence to mix a potion matching the target.
Grounded in real physics/chemistry. Multi-stage crafting in later levels.

9 levels. 5 lives per level. Vial positions randomized (solution order same).
Dead-state detection: auto-lose if no valid path to target remains.
"""

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ── Engine palette ──────────────────────────────────────────────────────
WHITE      = 0
LGRAY      = 1
GRAY       = 2
DGRAY      = 3
VDGRAY     = 4
BLACK      = 5
MAGENTA    = 6
LMAGENTA   = 7
RED        = 8
BLUE       = 9
LBLUE      = 10
YELLOW     = 11
ORANGE     = 12
MAROON     = 13
GREEN      = 14
PURPLE     = 15
T = -1  # transparent

# ── Potion state: (color, texture, temperature) ────────────────────────
# texture: 'empty','liquid','powder','bubbling','frozen','layered','crystal','smoke'
# temperature: 'cold','normal','hot'

E = (BLACK, 'empty', 'normal')  # empty cauldron state


# ── Texture renderers ──────────────────────────────────────────────────

def _render_potion(state, w, h):
    color, texture, temp = state
    if texture == 'empty':
        return [[BLACK] * w for _ in range(h)]
    elif texture == 'liquid':
        return [[color] * w for _ in range(h)]
    elif texture == 'powder':
        c2 = DGRAY if color != DGRAY else VDGRAY
        return [[(color if (x + y) % 2 == 0 else c2) for x in range(w)]
                for y in range(h)]
    elif texture == 'bubbling':
        g = [[color] * w for _ in range(h)]
        for y in range(0, h, 3):
            for x in range((y // 3) % 2, w, 3):
                if x < w and y < h:
                    g[y][x] = WHITE
        return g
    elif texture == 'frozen':
        g = [[color] * w for _ in range(h)]
        for y in range(0, h, 2):
            for x in range((y // 2) % 3, w, 3):
                if x < w and y < h:
                    g[y][x] = LBLUE if color != LBLUE else WHITE
        return g
    elif texture == 'layered':
        g = []
        split = h // 2
        for y in range(h):
            if y < split:
                g.append([color] * w)
            else:
                g.append([(MAROON if (x + y) % 2 == 0 else DGRAY) for x in range(w)])
        return g
    elif texture == 'crystal':
        g = [[color] * w for _ in range(h)]
        for y in range(0, h, 4):
            for x in range(0, w, 4):
                if x < w and y < h:
                    g[y][x] = WHITE
                if x + 1 < w and y + 1 < h:
                    g[y + 1][x + 1] = WHITE
        return g
    elif texture == 'smoke':
        g = [[DGRAY] * w for _ in range(h)]
        for y in range(h):
            for x in range(w):
                if (x + y * 3) % 5 == 0:
                    g[y][x] = GRAY
                elif (x * 2 + y) % 7 == 0:
                    g[y][x] = VDGRAY
        return g
    return [[color] * w for _ in range(h)]


# ── Ingredient definitions ─────────────────────────────────────────────

INGREDIENTS = {
    'water':      {'name': 'Water',       'color': LBLUE,   'icon': 'liquid'},
    'red_dye':    {'name': 'Red Dye',     'color': RED,     'icon': 'liquid'},
    'blue_dye':   {'name': 'Blue Dye',    'color': BLUE,    'icon': 'liquid'},
    'yellow_dye': {'name': 'Yellow Dye',  'color': YELLOW,  'icon': 'liquid'},
    'acid':       {'name': 'Acid',        'color': GREEN,   'icon': 'liquid'},
    'base':       {'name': 'Base',        'color': PURPLE,  'icon': 'liquid'},
    'chalk':      {'name': 'Chalk',       'color': WHITE,   'icon': 'powder'},
    'sulfur':     {'name': 'Sulfur',      'color': YELLOW,  'icon': 'powder'},
    'charcoal':   {'name': 'Charcoal',    'color': VDGRAY,  'icon': 'powder'},
    'salt':       {'name': 'Salt',        'color': WHITE,   'icon': 'powder'},
    'copper':     {'name': 'Copper',      'color': ORANGE,  'icon': 'powder'},
    'iron':       {'name': 'Iron',        'color': GRAY,    'icon': 'powder'},
    'indicator':  {'name': 'Indicator',   'color': LMAGENTA,'icon': 'liquid'},
    'flame':      {'name': 'Flame',       'color': RED,     'icon': 'flame'},
    'ice':        {'name': 'Ice',         'color': LBLUE,   'icon': 'ice'},
    'filter':     {'name': 'Filter',      'color': LGRAY,   'icon': 'filter'},
}


# ── Named states ───────────────────────────────────────────────────────

S_WATER     = (LBLUE,   'liquid',   'normal')
S_SALT_DRY  = (WHITE,   'powder',   'normal')
S_SULFUR_DRY= (YELLOW,  'powder',   'normal')

S_BLUE_LIQ  = (BLUE,    'liquid',   'normal')
S_YELLOW_LIQ= (YELLOW,  'liquid',   'normal')
S_RED_LIQ   = (RED,     'liquid',   'normal')
S_GREEN_LIQ = (GREEN,   'liquid',   'normal')
S_PURPLE_LIQ= (PURPLE,  'liquid',   'normal')
S_ORANGE_LIQ= (ORANGE,  'liquid',   'normal')
S_LBLUE_LIQ = (LBLUE,   'liquid',   'normal')

S_COPPER_DRY= (ORANGE,  'powder',   'normal')
S_IRON_DRY  = (GRAY,    'powder',   'normal')
S_CHAR_DRY  = (VDGRAY,  'powder',   'normal')

S_BOIL_W    = (LBLUE,   'bubbling', 'hot')
S_FREEZE_W  = (LBLUE,   'frozen',   'cold')
S_DRY_SMOKE = (RED,     'smoke',    'hot')

S_BLUE_BOIL = (BLUE,    'bubbling', 'hot')
S_BLUE_CRYST= (BLUE,    'crystal',  'normal')
S_BLUE_CRYST_C=(BLUE,   'crystal',  'cold')
S_BLUE_LAYER= (BLUE,    'layered',  'normal')

S_CHAR_LAYER= (DGRAY,   'layered',  'normal')
S_CHAR_BOIL = (DGRAY,   'bubbling', 'hot')
S_CHAR_SMOKE= (VDGRAY,  'smoke',    'hot')

S_NEUTRAL   = (LBLUE,   'liquid',   'normal')
S_ACID_IND  = (RED,     'liquid',   'normal')
S_BASE_IND  = (PURPLE,  'liquid',   'normal')
S_IND_PURE  = (LMAGENTA,'liquid',   'normal')
S_NEUT_IND  = (GREEN,   'liquid',   'normal')

S_RUST_SUSP = (ORANGE,  'layered',  'normal')
S_RUST_FILT = (ORANGE,  'liquid',   'normal')
S_RUST_BOIL = (ORANGE,  'bubbling', 'hot')

S_ACID_LIQ  = (GREEN,   'liquid',   'normal')
S_ACID_CU   = (BLUE,    'bubbling', 'normal')
S_ACID_CU_H = (PURPLE,  'bubbling', 'hot')
S_PURP_CRYST= (PURPLE,  'crystal',  'normal')

S_SULF_SUSP = (YELLOW,  'layered',  'normal')
S_SULF_BOIL = (YELLOW,  'bubbling', 'hot')
S_SULF_FILT = (YELLOW,  'liquid',   'hot')
S_SULF_COOL = (YELLOW,  'liquid',   'normal')
S_MAG_CRYST = (MAGENTA, 'crystal',  'normal')

S_ORANGE_LAY= (ORANGE,  'layered',  'normal')
S_GREEN_LAY = (GREEN,   'layered',  'normal')
S_GREEN_BOIL= (GREEN,   'bubbling', 'hot')
S_GREEN_FROZ= (GREEN,   'frozen',   'cold')
S_GRAY_LAY  = (GRAY,    'layered',  'normal')
S_LMAG_LIQ  = (LMAGENTA,'liquid',   'normal')
S_YELL_FROZ = (YELLOW,  'frozen',   'cold')
S_SULF_CRYST= (YELLOW,  'crystal',  'normal')

# Multi-stage intermediates
S_SALINE    = (LBLUE,   'liquid',   'normal')  # salt water
S_DILUTE_ACID=(GREEN,   'liquid',   'normal')  # water+acid
S_COPPER_SOL= (BLUE,    'liquid',   'normal')  # water+copper
S_ACID_SULF = (GREEN,   'bubbling', 'normal')  # acidified sulfur extract
S_GREEN_CRYST=(GREEN,   'crystal',  'normal')  # crystallized green indicator


# ── Level definitions ──────────────────────────────────────────────────
# Multi-stage levels: completing a stage yields a crafted ingredient
# that appears as a vial in the next stage.
#
# correct_sequence: indices into the stage's ingredient list (unshuffled).

_LEVELS = [
    # ══════════════════════════════════════════════════════════════════════
    # SINGLE-STAGE LEVELS (tutorial)
    # ══════════════════════════════════════════════════════════════════════

    # ── Level 1: Dissolving ────────────────────────────────────────────
    # NaCl dissolves in H2O; sulfur/charcoal don't.
    {
        'name': 'Salt Water',
        'stages': [{
            'ingredients': ['water', 'salt', 'sulfur', 'charcoal'],
            'correct_sequence': [0, 1],   # water + salt
            'target': S_SALINE,
            'transitions': {
                (E, 'water'):           S_WATER,
                (E, 'salt'):            S_SALT_DRY,
                (E, 'sulfur'):          S_SULFUR_DRY,
                (E, 'charcoal'):        S_CHAR_DRY,
                (S_WATER, 'salt'):      S_SALINE,
                (S_WATER, 'sulfur'):    S_SULF_SUSP,
                (S_WATER, 'charcoal'):  S_CHAR_LAYER,
                (S_SALT_DRY, 'water'):  (WHITE, 'layered', 'normal'),
                (S_SALT_DRY, 'sulfur'): S_SULFUR_DRY,
                (S_SALT_DRY, 'charcoal'):S_CHAR_DRY,
                (S_SULFUR_DRY, 'water'):S_SULF_SUSP,
                (S_SULFUR_DRY, 'salt'): S_SALT_DRY,
                (S_CHAR_DRY, 'water'):  S_CHAR_LAYER,
                (S_CHAR_DRY, 'salt'):   S_SALT_DRY,
            },
        }],
    },
    # ── Level 2: Color Mixing ──────────────────────────────────────────
    # Pigment mixing: blue + yellow = green.
    {
        'name': 'Color Mixing',
        'stages': [{
            'ingredients': ['blue_dye', 'yellow_dye', 'red_dye', 'chalk'],
            'correct_sequence': [0, 1],   # blue + yellow → green
            'target': S_GREEN_LIQ,
            'transitions': {
                (E, 'blue_dye'):              S_BLUE_LIQ,
                (E, 'yellow_dye'):            S_YELLOW_LIQ,
                (E, 'red_dye'):               S_RED_LIQ,
                (E, 'chalk'):                 (WHITE, 'powder', 'normal'),
                (S_BLUE_LIQ, 'yellow_dye'):   S_GREEN_LIQ,
                (S_BLUE_LIQ, 'red_dye'):      S_PURPLE_LIQ,
                (S_BLUE_LIQ, 'chalk'):        (LBLUE, 'layered', 'normal'),
                (S_YELLOW_LIQ, 'blue_dye'):   S_GREEN_LIQ,
                (S_YELLOW_LIQ, 'red_dye'):    S_ORANGE_LIQ,
                (S_YELLOW_LIQ, 'chalk'):      (YELLOW, 'layered', 'normal'),
                (S_RED_LIQ, 'blue_dye'):      S_PURPLE_LIQ,
                (S_RED_LIQ, 'yellow_dye'):    S_ORANGE_LIQ,
                (S_RED_LIQ, 'chalk'):         (RED, 'layered', 'normal'),
                ((WHITE, 'powder', 'normal'), 'blue_dye'):  (LBLUE, 'layered', 'normal'),
                ((WHITE, 'powder', 'normal'), 'yellow_dye'):(YELLOW, 'layered', 'normal'),
                ((WHITE, 'powder', 'normal'), 'red_dye'):   (RED, 'layered', 'normal'),
            },
        }],
    },
    # ── Level 3: Phase Change ──────────────────────────────────────────
    # Heating water → boiling. Ice/charcoal/sulfur are distractors.
    {
        'name': 'Phase Change',
        'stages': [{
            'ingredients': ['water', 'flame', 'ice', 'charcoal', 'sulfur'],
            'correct_sequence': [0, 1],  # water + flame = boiling
            'target': S_BOIL_W,
            'transitions': {
                (E, 'water'):             S_WATER,
                (E, 'flame'):             S_DRY_SMOKE,
                (E, 'ice'):               S_FREEZE_W,
                (E, 'charcoal'):          S_CHAR_DRY,
                (E, 'sulfur'):            S_SULFUR_DRY,
                (S_WATER, 'flame'):       S_BOIL_W,
                (S_WATER, 'ice'):         S_FREEZE_W,
                (S_WATER, 'charcoal'):    S_CHAR_LAYER,
                (S_WATER, 'sulfur'):      S_SULF_SUSP,
                (S_FREEZE_W, 'flame'):    S_WATER,
                (S_FREEZE_W, 'charcoal'): S_FREEZE_W,
                (S_BOIL_W, 'ice'):        S_WATER,
                (S_BOIL_W, 'charcoal'):   S_CHAR_BOIL,
                (S_BOIL_W, 'sulfur'):     S_SULF_BOIL,
                (S_DRY_SMOKE, 'water'):   S_BOIL_W,
                (S_DRY_SMOKE, 'ice'):     S_DRY_SMOKE,
                (S_CHAR_DRY, 'water'):    S_CHAR_LAYER,
                (S_CHAR_DRY, 'flame'):    S_CHAR_SMOKE,
                (S_SULFUR_DRY, 'water'):  S_SULF_SUSP,
                (S_SULFUR_DRY, 'flame'):  S_DRY_SMOKE,
                (S_CHAR_LAYER, 'flame'):  S_CHAR_BOIL,
                (S_SULF_SUSP, 'flame'):   S_SULF_BOIL,
            },
        }],
    },

    # ══════════════════════════════════════════════════════════════════════
    # TWO-STAGE LEVELS
    # ══════════════════════════════════════════════════════════════════════

    # ── Level 4: Crystal Growth ────────────────────────────────────────
    # Stage 1: Dissolve copper in water → blue solution
    # Stage 2: Heat solution, slow cool → blue crystals
    {
        'name': 'Crystal Growth',
        'stages': [
            {
                'ingredients': ['water', 'copper', 'salt', 'sulfur'],
                'correct_sequence': [0, 1],  # water + copper
                'target': S_COPPER_SOL,
                'transitions': {
                    (E, 'water'):               S_WATER,
                    (E, 'copper'):              S_COPPER_DRY,
                    (E, 'salt'):                S_SALT_DRY,
                    (E, 'sulfur'):              S_SULFUR_DRY,
                    (S_WATER, 'copper'):        S_COPPER_SOL,
                    (S_WATER, 'salt'):          S_SALINE,
                    (S_WATER, 'sulfur'):        S_SULF_SUSP,
                    (S_COPPER_DRY, 'water'):    S_ORANGE_LAY,
                    (S_COPPER_DRY, 'salt'):     S_SALT_DRY,
                    (S_COPPER_DRY, 'sulfur'):   S_SULFUR_DRY,
                    (S_SALT_DRY, 'water'):      (WHITE, 'layered', 'normal'),
                    (S_SULFUR_DRY, 'water'):    S_SULF_SUSP,
                },
            },
            {
                'ingredients': ['copper_sol', 'flame', 'ice', 'charcoal', 'iron'],
                'correct_sequence': [0, 1, 2],  # copper_sol + flame + ice
                'target': S_BLUE_CRYST,
                'transitions': {
                    (E, 'copper_sol'):          S_BLUE_LIQ,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'charcoal'):            S_CHAR_DRY,
                    (E, 'iron'):                S_IRON_DRY,
                    (S_BLUE_LIQ, 'flame'):      S_BLUE_BOIL,
                    (S_BLUE_LIQ, 'ice'):        S_BLUE_CRYST_C,   # too fast (wrong)
                    (S_BLUE_LIQ, 'charcoal'):   (BLUE, 'layered', 'normal'),
                    (S_BLUE_LIQ, 'iron'):       (BLUE, 'layered', 'normal'),
                    (S_BLUE_BOIL, 'ice'):       S_BLUE_CRYST,     # CRYSTALS!
                    (S_BLUE_BOIL, 'charcoal'):  S_BLUE_BOIL,
                    (S_BLUE_BOIL, 'iron'):      S_BLUE_BOIL,
                    (S_CHAR_DRY, 'copper_sol'): S_CHAR_LAYER,
                    (S_CHAR_DRY, 'flame'):      S_CHAR_SMOKE,
                    (S_IRON_DRY, 'copper_sol'): S_RUST_SUSP,
                    (S_IRON_DRY, 'flame'):      S_DRY_SMOKE,
                    (S_FREEZE_W, 'flame'):      S_WATER,
                    (S_DRY_SMOKE, 'ice'):       S_DRY_SMOKE,
                },
            },
        ],
    },
    # ── Level 5: Rust Extraction ───────────────────────────────────────
    # Stage 1: Iron in water → rust suspension
    # Stage 2: Filter the suspension, heat the extract
    {
        'name': 'Rust Extract',
        'stages': [
            {
                'ingredients': ['water', 'iron', 'copper', 'salt'],
                'correct_sequence': [0, 1],  # water + iron
                'target': S_RUST_SUSP,
                'transitions': {
                    (E, 'water'):               S_WATER,
                    (E, 'iron'):                S_IRON_DRY,
                    (E, 'copper'):              S_COPPER_DRY,
                    (E, 'salt'):                S_SALT_DRY,
                    (S_WATER, 'iron'):          S_RUST_SUSP,
                    (S_WATER, 'copper'):        S_BLUE_LIQ,
                    (S_WATER, 'salt'):          S_SALINE,
                    (S_IRON_DRY, 'water'):      S_RUST_SUSP,
                    (S_IRON_DRY, 'copper'):     S_COPPER_DRY,
                    (S_IRON_DRY, 'salt'):       S_IRON_DRY,
                    (S_COPPER_DRY, 'water'):    S_ORANGE_LAY,
                    (S_COPPER_DRY, 'iron'):     S_IRON_DRY,
                    (S_SALT_DRY, 'water'):      (WHITE, 'layered', 'normal'),
                },
            },
            {
                'ingredients': ['rust_water', 'filter', 'flame', 'ice', 'sulfur'],
                'correct_sequence': [0, 1, 2],  # rust_water + filter + flame
                'target': S_RUST_BOIL,
                'transitions': {
                    (E, 'rust_water'):          S_RUST_SUSP,
                    (E, 'filter'):              (LGRAY, 'powder', 'normal'),
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'sulfur'):              S_SULFUR_DRY,
                    (S_RUST_SUSP, 'filter'):    S_RUST_FILT,
                    (S_RUST_SUSP, 'flame'):     (ORANGE, 'smoke', 'hot'),  # burns off (wrong)
                    (S_RUST_SUSP, 'ice'):       (ORANGE, 'frozen', 'cold'),
                    (S_RUST_FILT, 'flame'):     S_RUST_BOIL,     # heated extract!
                    (S_RUST_FILT, 'ice'):       (ORANGE, 'frozen', 'cold'),
                    (S_RUST_FILT, 'sulfur'):    S_RUST_FILT,
                    (S_DRY_SMOKE, 'rust_water'):S_RUST_BOIL,
                    (S_DRY_SMOKE, 'ice'):       S_DRY_SMOKE,
                    (S_FREEZE_W, 'flame'):      S_WATER,
                    (S_SULFUR_DRY, 'rust_water'):S_SULF_SUSP,
                },
            },
        ],
    },

    # ══════════════════════════════════════════════════════════════════════
    # THREE-STAGE LEVELS
    # ══════════════════════════════════════════════════════════════════════

    # ── Level 6: Purple Crystals ───────────────────────────────────────
    # Stage 1: Dilute acid (water + acid)
    # Stage 2: React with copper, heat (dilute_acid + copper + flame)
    # Stage 3: Slow cool → purple crystals (hot_reaction + ice)
    {
        'name': 'Purple Crystals',
        'stages': [
            {
                'ingredients': ['water', 'acid', 'salt', 'iron'],
                'correct_sequence': [0, 1],  # water + acid
                'target': S_DILUTE_ACID,
                'transitions': {
                    (E, 'water'):               S_WATER,
                    (E, 'acid'):                S_ACID_LIQ,
                    (E, 'salt'):                S_SALT_DRY,
                    (E, 'iron'):                S_IRON_DRY,
                    (S_WATER, 'acid'):          S_DILUTE_ACID,
                    (S_WATER, 'salt'):          S_SALINE,
                    (S_WATER, 'iron'):          S_RUST_SUSP,
                    (S_ACID_LIQ, 'water'):      S_DILUTE_ACID,
                    (S_ACID_LIQ, 'salt'):       S_GREEN_LIQ,
                    (S_ACID_LIQ, 'iron'):       S_GREEN_BOIL,
                    (S_SALT_DRY, 'water'):      (WHITE, 'layered', 'normal'),
                    (S_SALT_DRY, 'acid'):       S_GREEN_LAY,
                    (S_IRON_DRY, 'water'):      S_RUST_SUSP,
                    (S_IRON_DRY, 'acid'):       S_GREEN_LAY,
                },
            },
            {
                'ingredients': ['dilute_acid', 'copper', 'flame', 'charcoal', 'ice'],
                'correct_sequence': [0, 1, 2],  # dilute_acid + copper + flame
                'target': S_ACID_CU_H,
                'transitions': {
                    (E, 'dilute_acid'):         S_DILUTE_ACID,
                    (E, 'copper'):              S_COPPER_DRY,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'charcoal'):            S_CHAR_DRY,
                    (E, 'ice'):                 S_FREEZE_W,
                    (S_DILUTE_ACID, 'copper'):  S_ACID_CU,
                    (S_DILUTE_ACID, 'flame'):   S_GREEN_BOIL,
                    (S_DILUTE_ACID, 'charcoal'):S_GREEN_LAY,
                    (S_DILUTE_ACID, 'ice'):     S_GREEN_FROZ,
                    (S_ACID_CU, 'flame'):       S_ACID_CU_H,     # heated!
                    (S_ACID_CU, 'ice'):         S_BLUE_CRYST_C,  # too fast
                    (S_ACID_CU, 'charcoal'):    (BLUE, 'layered', 'normal'),
                    (S_COPPER_DRY, 'dilute_acid'):S_GREEN_LAY,
                    (S_COPPER_DRY, 'flame'):    S_DRY_SMOKE,
                    (S_CHAR_DRY, 'dilute_acid'):S_GREEN_LAY,
                    (S_CHAR_DRY, 'flame'):      S_CHAR_SMOKE,
                    (S_FREEZE_W, 'flame'):      S_WATER,
                    (S_DRY_SMOKE, 'copper'):    S_DRY_SMOKE,
                },
            },
            {
                'ingredients': ['hot_acid_copper', 'ice', 'sulfur', 'base', 'red_dye'],
                'correct_sequence': [0, 1],  # hot_acid_copper + ice
                'target': S_PURP_CRYST,
                'transitions': {
                    (E, 'hot_acid_copper'):     S_ACID_CU_H,
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'sulfur'):              S_SULFUR_DRY,
                    (E, 'base'):               S_PURPLE_LIQ,
                    (E, 'red_dye'):             S_RED_LIQ,
                    (S_ACID_CU_H, 'ice'):       S_PURP_CRYST,    # slow cool!
                    (S_ACID_CU_H, 'sulfur'):    S_ACID_CU_H,
                    (S_ACID_CU_H, 'base'):      S_PURPLE_LIQ,
                    (S_ACID_CU_H, 'red_dye'):   S_ACID_CU_H,
                    (S_FREEZE_W, 'hot_acid_copper'):S_PURP_CRYST,
                    (S_SULFUR_DRY, 'hot_acid_copper'):(YELLOW, 'layered', 'hot'),
                    (S_PURPLE_LIQ, 'ice'):      (PURPLE, 'frozen', 'cold'),
                    (S_RED_LIQ, 'ice'):         (RED, 'frozen', 'cold'),
                },
            },
        ],
    },
    # ── Level 7: Sulfur Purification ───────────────────────────────────
    # Stage 1: Dissolve sulfur, heat (water + sulfur + flame)
    # Stage 2: Hot-filter, cool (sulfur_extract + filter + ice)
    # Stage 3: Color reaction (pure_sulfur + red_dye)
    {
        'name': 'Sulfur Purification',
        'stages': [
            {
                'ingredients': ['water', 'sulfur', 'flame', 'charcoal', 'salt'],
                'correct_sequence': [0, 1, 2],  # water + sulfur + flame
                'target': S_SULF_BOIL,
                'transitions': {
                    (E, 'water'):               S_WATER,
                    (E, 'sulfur'):              S_SULFUR_DRY,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'charcoal'):            S_CHAR_DRY,
                    (E, 'salt'):                S_SALT_DRY,
                    (S_WATER, 'sulfur'):        S_SULF_SUSP,
                    (S_WATER, 'flame'):         S_BOIL_W,
                    (S_WATER, 'charcoal'):      S_CHAR_LAYER,
                    (S_WATER, 'salt'):          S_SALINE,
                    (S_SULF_SUSP, 'flame'):     S_SULF_BOIL,
                    (S_SULF_SUSP, 'charcoal'):  S_CHAR_LAYER,
                    (S_SULF_SUSP, 'salt'):      S_SULF_SUSP,
                    (S_SULFUR_DRY, 'water'):    S_SULF_SUSP,
                    (S_SULFUR_DRY, 'flame'):    S_DRY_SMOKE,
                    (S_SULFUR_DRY, 'charcoal'): S_CHAR_DRY,
                    (S_BOIL_W, 'sulfur'):       S_SULF_BOIL,
                    (S_BOIL_W, 'charcoal'):     S_CHAR_BOIL,
                    (S_CHAR_DRY, 'water'):      S_CHAR_LAYER,
                    (S_CHAR_DRY, 'flame'):      S_CHAR_SMOKE,
                    (S_SALT_DRY, 'water'):      (WHITE, 'layered', 'normal'),
                    (S_CHAR_LAYER, 'flame'):    S_CHAR_BOIL,
                },
            },
            {
                'ingredients': ['sulfur_extract', 'filter', 'ice', 'flame', 'iron'],
                'correct_sequence': [0, 1, 2],  # sulfur_extract + filter + ice
                'target': S_SULF_COOL,
                'transitions': {
                    (E, 'sulfur_extract'):      S_SULF_BOIL,
                    (E, 'filter'):              (LGRAY, 'powder', 'normal'),
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'iron'):                S_IRON_DRY,
                    (S_SULF_BOIL, 'filter'):    S_SULF_FILT,
                    (S_SULF_BOIL, 'ice'):       S_SULF_CRYST,     # too fast
                    (S_SULF_BOIL, 'flame'):     S_SULF_BOIL,
                    (S_SULF_BOIL, 'iron'):      (YELLOW, 'layered', 'hot'),
                    (S_SULF_FILT, 'ice'):       S_SULF_COOL,
                    (S_SULF_FILT, 'flame'):     S_SULF_FILT,
                    (S_SULF_FILT, 'iron'):      S_RUST_SUSP,
                    (S_FREEZE_W, 'sulfur_extract'):S_YELL_FROZ,
                    (S_FREEZE_W, 'flame'):      S_WATER,
                    (S_IRON_DRY, 'sulfur_extract'):(GRAY, 'layered', 'hot'),
                    (S_IRON_DRY, 'flame'):      S_DRY_SMOKE,
                    (S_DRY_SMOKE, 'ice'):       S_DRY_SMOKE,
                },
            },
            {
                'ingredients': ['pure_sulfur', 'red_dye', 'blue_dye', 'acid'],
                'correct_sequence': [0, 1],  # pure_sulfur + red_dye
                'target': S_MAG_CRYST,
                'transitions': {
                    (E, 'pure_sulfur'):         S_SULF_COOL,
                    (E, 'red_dye'):             S_RED_LIQ,
                    (E, 'blue_dye'):            S_BLUE_LIQ,
                    (E, 'acid'):                S_ACID_LIQ,
                    (S_SULF_COOL, 'red_dye'):   S_MAG_CRYST,
                    (S_SULF_COOL, 'blue_dye'):  S_GREEN_LIQ,
                    (S_SULF_COOL, 'acid'):      S_SULF_BOIL,
                    (S_RED_LIQ, 'pure_sulfur'): S_ORANGE_LAY,
                    (S_RED_LIQ, 'blue_dye'):    S_PURPLE_LIQ,
                    (S_RED_LIQ, 'acid'):        S_RED_LIQ,
                    (S_BLUE_LIQ, 'pure_sulfur'):(BLUE, 'layered', 'normal'),
                    (S_BLUE_LIQ, 'red_dye'):    S_PURPLE_LIQ,
                    (S_ACID_LIQ, 'pure_sulfur'):S_GREEN_BOIL,
                    (S_ACID_LIQ, 'red_dye'):    S_RED_LIQ,
                },
            },
        ],
    },
    # ── Level 8: Neutralization Proof ──────────────────────────────────
    # Stage 1: Neutralize acid with base (acid + base)
    # Stage 2: Verify with indicator (neutral + indicator → green)
    # Stage 3: Crystallize proof (green_proof + flame + ice → green crystals)
    {
        'name': 'Indicator Crystal',
        'stages': [
            {
                'ingredients': ['acid', 'base', 'chalk', 'red_dye', 'sulfur'],
                'correct_sequence': [0, 1],  # acid + base
                'target': S_NEUTRAL,
                'transitions': {
                    (E, 'acid'):                S_ACID_LIQ,
                    (E, 'base'):               S_PURPLE_LIQ,
                    (E, 'chalk'):              (WHITE, 'powder', 'normal'),
                    (E, 'red_dye'):            S_RED_LIQ,
                    (E, 'sulfur'):              S_SULFUR_DRY,
                    (S_ACID_LIQ, 'base'):      S_NEUTRAL,
                    (S_ACID_LIQ, 'chalk'):     S_GREEN_LIQ,
                    (S_ACID_LIQ, 'red_dye'):   S_RED_LIQ,
                    (S_ACID_LIQ, 'sulfur'):    S_GREEN_LAY,
                    (S_PURPLE_LIQ, 'acid'):    S_NEUTRAL,
                    (S_PURPLE_LIQ, 'chalk'):   S_PURPLE_LIQ,
                    (S_PURPLE_LIQ, 'red_dye'): S_PURPLE_LIQ,
                    ((WHITE, 'powder', 'normal'), 'acid'): S_GREEN_LIQ,
                    ((WHITE, 'powder', 'normal'), 'base'): S_PURPLE_LIQ,
                    (S_RED_LIQ, 'base'):       S_PURPLE_LIQ,
                    (S_RED_LIQ, 'acid'):       S_RED_LIQ,
                    (S_SULFUR_DRY, 'acid'):    S_GREEN_LAY,
                },
            },
            {
                'ingredients': ['neutral_sol', 'indicator', 'salt', 'iron', 'flame'],
                'correct_sequence': [0, 1],  # neutral + indicator
                'target': S_NEUT_IND,
                'transitions': {
                    (E, 'neutral_sol'):         S_NEUTRAL,
                    (E, 'indicator'):          S_IND_PURE,
                    (E, 'salt'):                S_SALT_DRY,
                    (E, 'iron'):                S_IRON_DRY,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (S_NEUTRAL, 'indicator'):  S_NEUT_IND,
                    (S_NEUTRAL, 'salt'):       S_NEUTRAL,
                    (S_NEUTRAL, 'iron'):       (LBLUE, 'layered', 'normal'),
                    (S_NEUTRAL, 'flame'):      S_BOIL_W,
                    (S_IND_PURE, 'neutral_sol'):S_NEUT_IND,
                    (S_IND_PURE, 'salt'):      S_IND_PURE,
                    (S_IND_PURE, 'iron'):      (LMAGENTA, 'layered', 'normal'),
                    (S_SALT_DRY, 'neutral_sol'):(WHITE, 'layered', 'normal'),
                    (S_IRON_DRY, 'neutral_sol'):S_RUST_SUSP,
                    (S_IRON_DRY, 'flame'):      S_DRY_SMOKE,
                    (S_DRY_SMOKE, 'neutral_sol'):S_BOIL_W,
                },
            },
            {
                'ingredients': ['green_proof', 'flame', 'ice', 'charcoal', 'copper'],
                'correct_sequence': [0, 1, 2],  # green_proof + flame + ice
                'target': S_GREEN_CRYST,
                'transitions': {
                    (E, 'green_proof'):         S_NEUT_IND,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'charcoal'):            S_CHAR_DRY,
                    (E, 'copper'):              S_COPPER_DRY,
                    (S_NEUT_IND, 'flame'):      S_GREEN_BOIL,
                    (S_NEUT_IND, 'ice'):        S_GREEN_FROZ,    # too fast
                    (S_NEUT_IND, 'charcoal'):   (GREEN, 'layered', 'normal'),
                    (S_NEUT_IND, 'copper'):     (GREEN, 'layered', 'normal'),
                    (S_GREEN_BOIL, 'ice'):      S_GREEN_CRYST,   # CRYSTALS!
                    (S_GREEN_BOIL, 'charcoal'): S_GREEN_BOIL,
                    (S_GREEN_BOIL, 'copper'):   S_BLUE_BOIL,
                    (S_CHAR_DRY, 'green_proof'):S_CHAR_LAYER,
                    (S_CHAR_DRY, 'flame'):      S_CHAR_SMOKE,
                    (S_COPPER_DRY, 'green_proof'):S_GREEN_LAY,
                    (S_COPPER_DRY, 'flame'):    S_DRY_SMOKE,
                    (S_FREEZE_W, 'flame'):      S_WATER,
                    (S_DRY_SMOKE, 'ice'):       S_DRY_SMOKE,
                },
            },
        ],
    },

    # ══════════════════════════════════════════════════════════════════════
    # SIX-STAGE FINALE
    # ══════════════════════════════════════════════════════════════════════

    # ── Level 9: Grand Synthesis ───────────────────────────────────────
    # A 6-step sulfur-to-magenta pipeline:
    # 1. Dissolve sulfur in water
    # 2. Heat the suspension
    # 3. Hot-filter and cool
    # 4. Acidify the extract
    # 5. React with copper, heat
    # 6. Slow cool with dye → magenta crystals
    {
        'name': 'Grand Synthesis',
        'stages': [
            # Stage 1: water + sulfur → sulfur suspension
            {
                'ingredients': ['water', 'sulfur', 'salt', 'charcoal'],
                'correct_sequence': [0, 1],
                'target': S_SULF_SUSP,
                'transitions': {
                    (E, 'water'):               S_WATER,
                    (E, 'sulfur'):              S_SULFUR_DRY,
                    (E, 'salt'):                S_SALT_DRY,
                    (E, 'charcoal'):            S_CHAR_DRY,
                    (S_WATER, 'sulfur'):        S_SULF_SUSP,
                    (S_WATER, 'salt'):          S_SALINE,
                    (S_WATER, 'charcoal'):      S_CHAR_LAYER,
                    (S_SULFUR_DRY, 'water'):    S_SULF_SUSP,
                    (S_SULFUR_DRY, 'salt'):     S_SULFUR_DRY,
                    (S_SULFUR_DRY, 'charcoal'): S_CHAR_DRY,
                    (S_SALT_DRY, 'water'):      (WHITE, 'layered', 'normal'),
                    (S_CHAR_DRY, 'water'):      S_CHAR_LAYER,
                },
            },
            # Stage 2: sulfur_water + flame → hot sulfur
            {
                'ingredients': ['sulfur_water', 'flame', 'ice', 'iron'],
                'correct_sequence': [0, 1],
                'target': S_SULF_BOIL,
                'transitions': {
                    (E, 'sulfur_water'):        S_SULF_SUSP,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'iron'):                S_IRON_DRY,
                    (S_SULF_SUSP, 'flame'):     S_SULF_BOIL,
                    (S_SULF_SUSP, 'ice'):       S_YELL_FROZ,
                    (S_SULF_SUSP, 'iron'):      S_SULF_SUSP,
                    (S_DRY_SMOKE, 'sulfur_water'):S_SULF_BOIL,
                    (S_DRY_SMOKE, 'ice'):       S_DRY_SMOKE,
                    (S_FREEZE_W, 'sulfur_water'):S_YELL_FROZ,
                    (S_FREEZE_W, 'flame'):      S_WATER,
                    (S_IRON_DRY, 'sulfur_water'):(GRAY, 'layered', 'normal'),
                    (S_IRON_DRY, 'flame'):      S_DRY_SMOKE,
                },
            },
            # Stage 3: hot_sulfur + filter + ice → cooled filtered sulfur
            {
                'ingredients': ['hot_sulfur', 'filter', 'ice', 'charcoal', 'salt'],
                'correct_sequence': [0, 1, 2],
                'target': S_SULF_COOL,
                'transitions': {
                    (E, 'hot_sulfur'):          S_SULF_BOIL,
                    (E, 'filter'):              (LGRAY, 'powder', 'normal'),
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'charcoal'):            S_CHAR_DRY,
                    (E, 'salt'):                S_SALT_DRY,
                    (S_SULF_BOIL, 'filter'):    S_SULF_FILT,
                    (S_SULF_BOIL, 'ice'):       S_SULF_CRYST,     # too fast
                    (S_SULF_BOIL, 'charcoal'):  (YELLOW, 'layered', 'hot'),
                    (S_SULF_BOIL, 'salt'):      S_SULF_BOIL,
                    (S_SULF_FILT, 'ice'):       S_SULF_COOL,
                    (S_SULF_FILT, 'charcoal'):  S_SULF_FILT,
                    (S_SULF_FILT, 'salt'):      S_SULF_FILT,
                    (S_CHAR_DRY, 'hot_sulfur'): S_CHAR_BOIL,
                    (S_CHAR_DRY, 'ice'):        S_CHAR_DRY,
                    (S_FREEZE_W, 'hot_sulfur'): S_YELL_FROZ,
                    (S_FREEZE_W, 'filter'):     S_FREEZE_W,
                    (S_SALT_DRY, 'hot_sulfur'): (WHITE, 'layered', 'hot'),
                },
            },
            # Stage 4: cooled_extract + acid → acidified sulfur
            {
                'ingredients': ['cooled_extract', 'acid', 'base', 'chalk'],
                'correct_sequence': [0, 1],
                'target': S_ACID_SULF,
                'transitions': {
                    (E, 'cooled_extract'):      S_SULF_COOL,
                    (E, 'acid'):                S_ACID_LIQ,
                    (E, 'base'):               S_PURPLE_LIQ,
                    (E, 'chalk'):              (WHITE, 'powder', 'normal'),
                    (S_SULF_COOL, 'acid'):      S_ACID_SULF,      # acidified!
                    (S_SULF_COOL, 'base'):      S_PURPLE_LIQ,
                    (S_SULF_COOL, 'chalk'):     S_SULF_COOL,
                    (S_ACID_LIQ, 'cooled_extract'):S_ACID_SULF,
                    (S_ACID_LIQ, 'base'):       S_NEUTRAL,
                    (S_ACID_LIQ, 'chalk'):      S_GREEN_LIQ,
                    (S_PURPLE_LIQ, 'cooled_extract'):(PURPLE, 'layered', 'normal'),
                    (S_PURPLE_LIQ, 'acid'):     S_NEUTRAL,
                    ((WHITE, 'powder', 'normal'), 'acid'):S_GREEN_LIQ,
                    ((WHITE, 'powder', 'normal'), 'cooled_extract'):(YELLOW, 'layered', 'normal'),
                },
            },
            # Stage 5: acid_extract + copper + flame → hot copper-acid
            {
                'ingredients': ['acid_extract', 'copper', 'flame', 'iron', 'salt'],
                'correct_sequence': [0, 1, 2],
                'target': S_ACID_CU_H,
                'transitions': {
                    (E, 'acid_extract'):        S_ACID_SULF,
                    (E, 'copper'):              S_COPPER_DRY,
                    (E, 'flame'):               S_DRY_SMOKE,
                    (E, 'iron'):                S_IRON_DRY,
                    (E, 'salt'):                S_SALT_DRY,
                    (S_ACID_SULF, 'copper'):    S_ACID_CU,
                    (S_ACID_SULF, 'flame'):     S_GREEN_BOIL,
                    (S_ACID_SULF, 'iron'):      (GREEN, 'layered', 'normal'),
                    (S_ACID_SULF, 'salt'):      S_ACID_SULF,
                    (S_ACID_CU, 'flame'):       S_ACID_CU_H,
                    (S_ACID_CU, 'iron'):        (BLUE, 'layered', 'normal'),
                    (S_ACID_CU, 'salt'):        S_ACID_CU,
                    (S_COPPER_DRY, 'acid_extract'):S_GREEN_LAY,
                    (S_COPPER_DRY, 'flame'):    S_DRY_SMOKE,
                    (S_IRON_DRY, 'acid_extract'):(GRAY, 'layered', 'normal'),
                    (S_IRON_DRY, 'flame'):      S_DRY_SMOKE,
                    (S_DRY_SMOKE, 'copper'):    S_DRY_SMOKE,
                    (S_DRY_SMOKE, 'acid_extract'):S_GREEN_BOIL,
                    (S_SALT_DRY, 'acid_extract'):S_GREEN_LAY,
                },
            },
            # Stage 6: hot_mixture + ice + red_dye → magenta crystals
            {
                'ingredients': ['hot_mixture', 'ice', 'red_dye', 'blue_dye', 'base'],
                'correct_sequence': [0, 1, 2],
                'target': S_MAG_CRYST,
                'transitions': {
                    (E, 'hot_mixture'):         S_ACID_CU_H,
                    (E, 'ice'):                 S_FREEZE_W,
                    (E, 'red_dye'):             S_RED_LIQ,
                    (E, 'blue_dye'):            S_BLUE_LIQ,
                    (E, 'base'):               S_PURPLE_LIQ,
                    (S_ACID_CU_H, 'ice'):       S_PURP_CRYST,    # cool → purple crystals
                    (S_ACID_CU_H, 'red_dye'):   S_ACID_CU_H,
                    (S_ACID_CU_H, 'blue_dye'):  S_ACID_CU_H,
                    (S_ACID_CU_H, 'base'):      S_PURPLE_LIQ,
                    (S_PURP_CRYST, 'red_dye'):  S_MAG_CRYST,     # dye → MAGENTA!
                    (S_PURP_CRYST, 'blue_dye'): (PURPLE, 'crystal', 'cold'),
                    (S_PURP_CRYST, 'base'):     S_PURPLE_LIQ,
                    (S_FREEZE_W, 'hot_mixture'):S_PURP_CRYST,
                    (S_FREEZE_W, 'red_dye'):    (RED, 'frozen', 'cold'),
                    (S_RED_LIQ, 'hot_mixture'): S_ACID_CU_H,
                    (S_RED_LIQ, 'ice'):         (RED, 'frozen', 'cold'),
                    (S_RED_LIQ, 'blue_dye'):    S_PURPLE_LIQ,
                    (S_BLUE_LIQ, 'hot_mixture'):S_ACID_CU_H,
                    (S_BLUE_LIQ, 'red_dye'):    S_PURPLE_LIQ,
                    (S_PURPLE_LIQ, 'ice'):      (PURPLE, 'frozen', 'cold'),
                },
            },
        ],
    },
]

# Crafted ingredient metadata (for multi-stage items that appear as vials)
CRAFTED_INGREDIENTS = {
    'copper_sol':      {'name': 'Cu Sol.',     'color': BLUE,    'icon': 'liquid'},
    'rust_water':      {'name': 'Rust Mix',    'color': ORANGE,  'icon': 'liquid'},
    'dilute_acid':     {'name': 'Dil.Acid',    'color': GREEN,   'icon': 'liquid'},
    'hot_acid_copper': {'name': 'Hot CuAc',    'color': PURPLE,  'icon': 'liquid'},
    'sulfur_extract':  {'name': 'S.Extract',   'color': YELLOW,  'icon': 'liquid'},
    'pure_sulfur':     {'name': 'Pure S.',     'color': YELLOW,  'icon': 'liquid'},
    'neutral_sol':     {'name': 'Neutral',     'color': LBLUE,   'icon': 'liquid'},
    'green_proof':     {'name': 'Proof',       'color': GREEN,   'icon': 'liquid'},
    'sulfur_water':    {'name': 'S.Water',     'color': YELLOW,  'icon': 'liquid'},
    'hot_sulfur':      {'name': 'Hot S.',      'color': YELLOW,  'icon': 'liquid'},
    'cooled_extract':  {'name': 'Cool Ext.',   'color': YELLOW,  'icon': 'liquid'},
    'acid_extract':    {'name': 'Acid Ext.',   'color': GREEN,   'icon': 'liquid'},
    'hot_mixture':     {'name': 'Hot Mix',     'color': PURPLE,  'icon': 'liquid'},
}


# ── Pixel art ──────────────────────────────────────────────────────────

BEAKER = [
    [T, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, T],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [LGRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, LGRAY],
    [T, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, LGRAY, T],
]

CAULDRON = [
    [T,  GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  GRAY,  T],
    [GRAY, DGRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, DGRAY, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [GRAY,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T, GRAY],
    [T, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, T],
]

VIAL = [
    [T,  LGRAY, LGRAY, LGRAY, LGRAY, T],
    [T,  LGRAY,  T,     T,    LGRAY, T],
    [T,  LGRAY,  T,     T,    LGRAY, T],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [LGRAY, T,    T,     T,     T,  LGRAY],
    [T,  LGRAY, LGRAY, LGRAY, LGRAY, T],
]

ICON_FLAME = [
    [T, RED,  RED,  T],
    [RED, ORANGE, RED, T],
    [RED, YELLOW, ORANGE, RED],
    [T, RED,  RED,  T],
]

ICON_ICE = [
    [T, LBLUE, LBLUE, T],
    [LBLUE, WHITE, WHITE, LBLUE],
    [LBLUE, WHITE, WHITE, LBLUE],
    [T, LBLUE, LBLUE, T],
]

ICON_FILTER = [
    [LGRAY, LGRAY, LGRAY, LGRAY],
    [T, LGRAY, LGRAY, T],
    [T, T, LGRAY, T],
    [T, T, LGRAY, T],
]

# Heart icon for lives (5w x 5h)
ICON_HEART = [
    [T, RED, T, RED, T],
    [RED, RED, RED, RED, RED],
    [RED, RED, RED, RED, RED],
    [T, RED, RED, RED, T],
    [T, T, RED, T, T],
]

ICON_HEART_EMPTY = [
    [T, DGRAY, T, DGRAY, T],
    [DGRAY, DGRAY, DGRAY, DGRAY, DGRAY],
    [DGRAY, DGRAY, DGRAY, DGRAY, DGRAY],
    [T, DGRAY, DGRAY, DGRAY, T],
    [T, T, DGRAY, T, T],
]

# ── Layout constants ───────────────────────────────────────────────────

BEAKER_X = 5
BEAKER_Y = 8
BEAKER_FILL_X = 6
BEAKER_FILL_Y = 9
BEAKER_FILL_W = 10
BEAKER_FILL_H = 12

CAULDRON_X = 36
CAULDRON_Y = 7
CAULDRON_FILL_X = 37
CAULDRON_FILL_Y = 9
CAULDRON_FILL_W = 14
CAULDRON_FILL_H = 10

VIAL_Y = 38
VIAL_SPACING = 10

MAX_LIVES = 5


# ── Deterministic shuffle ─────────────────────────────────────────────
# We need deterministic randomization so replays work.
# Use a simple LCG seeded by level_index + stage_index.

def _det_shuffle(items, seed):
    """Deterministic Fisher-Yates shuffle using LCG."""
    a = 1664525
    c = 1013904223
    m = 2**32
    state = (seed * 2654435761 + 12345) % m
    result = list(items)
    for i in range(len(result) - 1, 0, -1):
        state = (a * state + c) % m
        j = state % (i + 1)
        result[i], result[j] = result[j], result[i]
    return result


# ── Dead-state detection ───────────────────────────────────────────────

def _can_reach_target(current_state, available_keys, transitions, target):
    """BFS: can we reach target from current_state using available ingredients?"""
    visited = set()
    queue = [current_state]
    visited.add(current_state)
    while queue:
        state = queue.pop(0)
        if state == target:
            return True
        for key in available_keys:
            lookup = (state, key)
            if lookup in transitions:
                next_state = transitions[lookup]
                if next_state not in visited:
                    visited.add(next_state)
                    queue.append(next_state)
    return False


# ── Display ────────────────────────────────────────────────────────────

class PxDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        stage_data = g._current_stage()

        # Background
        frame[:, :] = VDGRAY
        frame[36:, :] = DGRAY  # lab bench

        # ── Row 0-1: Level progress dots ──
        for i in range(len(_LEVELS)):
            x = 2 + i * 7
            c = GREEN if i < g.level_index else DGRAY
            if i == g.level_index:
                c = YELLOW
            frame[1, x:x+5] = c
            frame[2, x:x+5] = c

        # ── Row 3-5: Lives (hearts) ──
        for i in range(MAX_LIVES):
            hx = 2 + i * 6
            icon = ICON_HEART if i < g.lives else ICON_HEART_EMPTY
            self._blit(frame, icon, hx, 4)

        # ── Row 3-5: Stage indicator (right side) ──
        n_stages = len(_LEVELS[g.level_index]['stages'])
        if n_stages > 1:
            for s in range(n_stages):
                sx = 52 + s * 4
                c = GREEN if s < g.stage_index else DGRAY
                if s == g.stage_index:
                    c = YELLOW
                frame[4, sx:sx+3] = c
                frame[5, sx:sx+3] = c
                frame[6, sx:sx+3] = c

        # ── Target beaker (left) with "TARGET" label ──
        # Small "T" marker above beaker
        frame[BEAKER_Y - 1, BEAKER_X + 3:BEAKER_X + 9] = LBLUE

        tfill = _render_potion(stage_data['target'], BEAKER_FILL_W, BEAKER_FILL_H)
        self._fill(frame, tfill, BEAKER_FILL_X, BEAKER_FILL_Y)
        self._blit(frame, BEAKER, BEAKER_X, BEAKER_Y)
        self._temp_bar(frame, stage_data['target'][2], BEAKER_X + 2, BEAKER_Y + 14)

        # ── Cauldron (right) — your mix ──
        cfill = _render_potion(g.cauldron_state, CAULDRON_FILL_W, CAULDRON_FILL_H)
        self._fill(frame, cfill, CAULDRON_FILL_X, CAULDRON_FILL_Y)
        self._blit(frame, CAULDRON, CAULDRON_X, CAULDRON_Y)
        self._temp_bar(frame, g.cauldron_state[2], CAULDRON_X + 4, CAULDRON_Y + 14)

        # Match indicator: green border if matching, nothing otherwise
        match = g.cauldron_state == stage_data['target']
        if match:
            # Green border around cauldron
            frame[CAULDRON_Y - 1, CAULDRON_X:CAULDRON_X + 16] = GREEN
            frame[CAULDRON_Y + 13, CAULDRON_X:CAULDRON_X + 16] = GREEN

        # Arrow between beaker and cauldron
        frame[14, 20:24] = WHITE
        frame[14, 23] = WHITE
        frame[13, 22] = WHITE
        frame[15, 22] = WHITE

        # Pour step progress dots
        n_steps = len(stage_data['correct_sequence'])
        dot_x = CAULDRON_X + (16 - n_steps * 3) // 2
        for i in range(n_steps):
            c = GREEN if i < g.pour_step else DGRAY
            frame[CAULDRON_Y + 15, dot_x + i * 3:dot_x + i * 3 + 2] = c
            frame[CAULDRON_Y + 16, dot_x + i * 3:dot_x + i * 3 + 2] = c

        # ── Vials ──
        display_ings = g.display_ingredients
        n = len(display_ings)
        total_w = n * VIAL_SPACING
        sx = max(2, (64 - total_w) // 2)

        for i in range(n):
            vx = sx + i * VIAL_SPACING
            orig_idx = g.vial_map[i]  # original index
            used = orig_idx in g.used_vials
            key = display_ings[i]

            if used:
                self._blit_dim(frame, VIAL, vx, VIAL_Y)
            else:
                # Look up ingredient info
                if key in INGREDIENTS:
                    ing = INGREDIENTS[key]
                elif key in CRAFTED_INGREDIENTS:
                    ing = CRAFTED_INGREDIENTS[key]
                else:
                    ing = {'color': LGRAY, 'icon': 'liquid'}
                self._blit(frame, VIAL, vx, VIAL_Y)
                self._draw_vial_fill(frame, vx, VIAL_Y, ing)

            # Selection highlight
            if i == g.selected_vial:
                frame[VIAL_Y - 1, vx:vx+6] = YELLOW
                frame[VIAL_Y + 12, vx:vx+6] = YELLOW

        # ── Result overlay ──
        if g.show_result > 0:
            if g.result_success:
                self._draw_check(frame, 28, 25)
            else:
                self._draw_cross(frame, 28, 25)

        return frame

    def _blit(self, frame, art, ox, oy):
        for r, row in enumerate(art):
            for c, v in enumerate(row):
                if v != T:
                    py, px = oy + r, ox + c
                    if 0 <= py < 64 and 0 <= px < 64:
                        frame[py, px] = v

    def _blit_dim(self, frame, art, ox, oy):
        for r, row in enumerate(art):
            for c, v in enumerate(row):
                if v != T:
                    py, px = oy + r, ox + c
                    if 0 <= py < 64 and 0 <= px < 64:
                        frame[py, px] = DGRAY

    def _fill(self, frame, fill, ox, oy):
        for r in range(len(fill)):
            for c in range(len(fill[r])):
                py, px = oy + r, ox + c
                if 0 <= py < 64 and 0 <= px < 64:
                    frame[py, px] = fill[r][c]

    def _temp_bar(self, frame, temp, x, y):
        if temp == 'hot':
            frame[y, x:x+6] = RED
            frame[y+1, x+1:x+5] = ORANGE
        elif temp == 'cold':
            frame[y, x:x+6] = LBLUE
            frame[y+1, x+1:x+5] = WHITE

    def _draw_vial_fill(self, frame, vx, vy, ing):
        ic = ing['icon']
        color = ing['color']
        if ic == 'liquid':
            for r in range(4, 11):
                for c in range(1, 5):
                    py, px = vy + r, vx + c
                    if 0 <= py < 64 and 0 <= px < 64:
                        frame[py, px] = color
            for c in range(1, 5):
                py, px = vy + 3, vx + c
                if 0 <= py < 64 and 0 <= px < 64:
                    frame[py, px] = WHITE if color == LBLUE else LBLUE
        elif ic == 'powder':
            for r in range(6, 11):
                for c in range(1, 5):
                    py, px = vy + r, vx + c
                    if 0 <= py < 64 and 0 <= px < 64:
                        c2 = DGRAY if color != DGRAY else VDGRAY
                        frame[py, px] = color if (r + c) % 2 == 0 else c2
            py = vy + 5
            for c in [1, 2, 4]:
                px = vx + c
                if 0 <= py < 64 and 0 <= px < 64:
                    frame[py, px] = color
        elif ic == 'flame':
            self._blit(frame, ICON_FLAME, vx + 1, vy + 4)
        elif ic == 'ice':
            self._blit(frame, ICON_ICE, vx + 1, vy + 4)
        elif ic == 'filter':
            self._blit(frame, ICON_FILTER, vx + 1, vy + 4)

    def _draw_check(self, frame, cx, cy):
        for dx, dy in [(0,4),(1,5),(2,6),(3,5),(4,4),(5,3),(6,2)]:
            px, py = cx + dx, cy + dy
            if 0 <= py < 64 and 0 <= px < 64:
                frame[py, px] = GREEN
            if 0 <= py+1 < 64 and 0 <= px < 64:
                frame[py+1, px] = GREEN

    def _draw_cross(self, frame, cx, cy):
        for i in range(7):
            for px, py in [(cx+i, cy+i), (cx+6-i, cy+i)]:
                if 0 <= py < 64 and 0 <= px < 64:
                    frame[py, px] = RED
                if 0 <= py+1 < 64 and 0 <= px < 64:
                    frame[py+1, px] = RED


# ── Build levels ───────────────────────────────────────────────────────

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d['name'], data=d)
    for d in _LEVELS
]


# ── Game class ─────────────────────────────────────────────────────────

class Px02(ARCBaseGame):
    def __init__(self):
        self.display = PxDisplay(self)
        self.cauldron_state = E
        self.pour_step = 0
        self.used_vials = set()
        self.selected_vial = -1
        self.show_result = 0
        self.result_success = False
        self.lives = MAX_LIVES
        self.stage_index = 0
        self.vial_map = []          # shuffled index → original index
        self.display_ingredients = []  # ingredient keys in display order

        super().__init__(
            "px",
            levels,
            Camera(0, 0, 64, 64, VDGRAY, VDGRAY, [self.display]),
            False,
            len(levels),
            [6],
        )

    def _current_stage(self):
        return _LEVELS[self.level_index]['stages'][self.stage_index]

    def _setup_stage(self):
        """Set up vials for current stage with deterministic shuffle."""
        stage = self._current_stage()
        n = len(stage['ingredients'])
        seed = self.level_index * 100 + self.stage_index
        order = _det_shuffle(list(range(n)), seed)
        self.vial_map = order
        self.display_ingredients = [stage['ingredients'][i] for i in order]
        self.cauldron_state = E
        self.pour_step = 0
        self.used_vials = set()
        self.selected_vial = -1
        self.show_result = 0
        self.result_success = False

    def on_set_level(self, level):
        self.lives = MAX_LIVES
        self.stage_index = 0
        self._setup_stage()

    def _retry_stage(self):
        """Reset the current stage (vials re-dealt, cauldron emptied)."""
        self._setup_stage()

    def _get_vial_at(self, x, y):
        n = len(self.display_ingredients)
        total_w = n * VIAL_SPACING
        sx = max(2, (64 - total_w) // 2)
        for i in range(n):
            vx = sx + i * VIAL_SPACING
            if vx <= x < vx + 6 and VIAL_Y <= y < VIAL_Y + 12:
                return i
        return -1

    def _pour_vial(self, display_idx):
        """Pour vial at display position display_idx."""
        stage = self._current_stage()
        orig_idx = self.vial_map[display_idx]
        key = stage['ingredients'][orig_idx]
        transitions = stage['transitions']

        lookup = (self.cauldron_state, key)
        if lookup in transitions:
            self.cauldron_state = transitions[lookup]
        else:
            self.cauldron_state = (DGRAY, 'smoke', 'normal')

        self.used_vials.add(orig_idx)
        self.pour_step += 1

        # Check if we've used enough vials to evaluate
        n_required = len(stage['correct_sequence'])
        if self.pour_step >= n_required:
            if self.cauldron_state == stage['target']:
                self.show_result = 10
                self.result_success = True
                self._advance_stage()
            else:
                self._handle_wrong()
            return

        # Dead-state check: can we still reach the target?
        available_keys = [
            stage['ingredients'][self.vial_map[i]]
            for i in range(len(self.display_ingredients))
            if self.vial_map[i] not in self.used_vials
        ]
        if not _can_reach_target(self.cauldron_state, available_keys,
                                  stage['transitions'], stage['target']):
            self._handle_wrong()

    def _advance_stage(self):
        """Move to next stage or next level."""
        level_data = _LEVELS[self.level_index]
        if self.stage_index + 1 < len(level_data['stages']):
            self.stage_index += 1
            self._setup_stage()
        else:
            self.next_level()

    def _handle_wrong(self):
        """Handle a wrong answer: lose a life, retry or game over."""
        self.lives -= 1
        self.show_result = 10
        self.result_success = False
        if self.lives <= 0:
            self.lose()
        else:
            # Reset the current stage for retry (after show_result ticks)
            self._retry_stage()

    def step(self):
        if self.show_result > 0:
            self.show_result -= 1

        if self.action.id.value != 6:
            self.complete_action()
            return

        x = self.action.data.get("x", 0)
        y = self.action.data.get("y", 0)

        vial_display_idx = self._get_vial_at(x, y)
        if vial_display_idx >= 0:
            orig_idx = self.vial_map[vial_display_idx]
            if orig_idx not in self.used_vials:
                self._pour_vial(vial_display_idx)

        self.complete_action()
