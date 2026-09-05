"""Potion Mixer -- Chemistry puzzle game for ARC-AGI-3.

Click vials in the correct sequence to mix a potion matching the target.
Mechanics: color mixing, temperature (heat/cool), volatile reactions,
filtering, and multi-step synthesis.

10 levels of increasing difficulty inspired by real chemistry exercises.
"""

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# ── Engine palette ──────────────────────────────────────────────────────
# 0=White  1=LightGray  2=Gray      3=DarkGray  4=VeryDarkGray  5=Black
# 6=Magenta 7=LightMagenta 8=Red    9=Blue      10=LightBlue    11=Yellow
# 12=Orange 13=Maroon      14=Green 15=Purple

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

# ── Potion state ────────────────────────────────────────────────────────
# (color, texture, temperature)
# texture: 'empty','liquid','powder','bubbling','frozen','layered','crystal','smoke'
# temperature: 'cold','normal','hot'

E = (BLACK, 'empty', 'normal')  # empty cauldron state


# ── Texture renderers ──────────────────────────────────────────────────

def _render_potion(state, w, h):
    """Render a potion state as a 2D pixel array."""
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


# ── Ingredient definitions ──────────────────────────────────────────────

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


# ── Shorthand states for transitions ───────────────────────────────────
# Named intermediates so we avoid duplicate dict keys.
# Convention: S_<description> = (color, texture, temp)

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
S_ACID_CU_H = (PURPLE,  'bubbling', 'hot')    # copper-acid heated = purplish
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


# ── Level definitions ───────────────────────────────────────────────────
# transitions: dict mapping (current_state, ingredient_key) -> new_state
# This is a proper state machine: no duplicate keys possible.

_LEVELS = [
    # ── Level 1: Simple Dissolution ─────────────────────────────────────
    {
        'name': 'Saline Solution',
        'ingredients': ['water', 'salt', 'sulfur'],
        'correct_sequence': [0, 1],
        'target': S_LBLUE_LIQ,
        'transitions': {
            (E, 'water'):           S_WATER,
            (E, 'salt'):            S_SALT_DRY,
            (E, 'sulfur'):          S_SULFUR_DRY,
            (S_WATER, 'salt'):      S_LBLUE_LIQ,    # salt dissolves in water
            (S_WATER, 'sulfur'):    S_SULF_SUSP,     # sulfur floats
            (S_SALT_DRY, 'water'):  (WHITE, 'layered', 'normal'),
            (S_SALT_DRY, 'sulfur'): S_SULFUR_DRY,
            (S_SULFUR_DRY, 'water'):S_SULF_SUSP,
            (S_SULFUR_DRY, 'salt'): S_SALT_DRY,
        },
    },
    # ── Level 2: Color Mixing ───────────────────────────────────────────
    {
        'name': 'Color Theory',
        'ingredients': ['blue_dye', 'yellow_dye', 'red_dye'],
        'correct_sequence': [0, 1],
        'target': S_GREEN_LIQ,
        'transitions': {
            (E, 'blue_dye'):              S_BLUE_LIQ,
            (E, 'yellow_dye'):            S_YELLOW_LIQ,
            (E, 'red_dye'):               S_RED_LIQ,
            (S_BLUE_LIQ, 'yellow_dye'):   S_GREEN_LIQ,   # blue+yellow=green
            (S_BLUE_LIQ, 'red_dye'):      S_PURPLE_LIQ,  # blue+red=purple
            (S_YELLOW_LIQ, 'blue_dye'):   S_GREEN_LIQ,   # yellow+blue=green
            (S_YELLOW_LIQ, 'red_dye'):    S_ORANGE_LIQ,  # yellow+red=orange
            (S_RED_LIQ, 'blue_dye'):      S_PURPLE_LIQ,  # red+blue=purple
            (S_RED_LIQ, 'yellow_dye'):    S_ORANGE_LIQ,  # red+yellow=orange
        },
    },
    # ── Level 3: Order Matters ──────────────────────────────────────────
    {
        'name': 'Copper Sulfate',
        'ingredients': ['copper', 'water', 'acid'],
        'correct_sequence': [1, 0],
        'target': S_BLUE_LIQ,
        'transitions': {
            (E, 'copper'):              S_COPPER_DRY,
            (E, 'water'):               S_WATER,
            (E, 'acid'):                S_ACID_LIQ,
            (S_COPPER_DRY, 'water'):    S_ORANGE_LAY,    # powder stays
            (S_COPPER_DRY, 'acid'):     S_GREEN_LAY,     # acid on powder
            (S_WATER, 'copper'):        S_BLUE_LIQ,      # copper dissolves!
            (S_WATER, 'acid'):          S_GREEN_LIQ,     # dilute acid
            (S_ACID_LIQ, 'copper'):     S_GREEN_BOIL,    # vigorous reaction
            (S_ACID_LIQ, 'water'):      S_GREEN_LIQ,     # dilute
        },
    },
    # ── Level 4: Heating ────────────────────────────────────────────────
    {
        'name': 'Boiling Brine',
        'ingredients': ['water', 'flame', 'salt', 'ice'],
        'correct_sequence': [0, 1, 2],
        'target': S_BOIL_W,
        'transitions': {
            (E, 'water'):             S_WATER,
            (E, 'flame'):             S_DRY_SMOKE,
            (E, 'salt'):              S_SALT_DRY,
            (E, 'ice'):               S_FREEZE_W,
            (S_WATER, 'flame'):       S_BOIL_W,          # boiling water
            (S_WATER, 'salt'):        S_LBLUE_LIQ,       # cold dissolve
            (S_WATER, 'ice'):         S_FREEZE_W,
            (S_BOIL_W, 'salt'):       S_BOIL_W,          # hot brine! (target)
            (S_BOIL_W, 'ice'):        S_WATER,            # cool down
            (S_SALT_DRY, 'water'):    (WHITE, 'layered', 'normal'),
            (S_SALT_DRY, 'flame'):    S_DRY_SMOKE,
            (S_FREEZE_W, 'flame'):    S_WATER,
            (S_FREEZE_W, 'salt'):     S_FREEZE_W,
            (S_DRY_SMOKE, 'water'):   S_BOIL_W,
            (S_DRY_SMOKE, 'salt'):    S_DRY_SMOKE,
            (S_DRY_SMOKE, 'ice'):     S_DRY_SMOKE,
            (S_LBLUE_LIQ, 'flame'):   S_BOIL_W,
            (S_LBLUE_LIQ, 'ice'):     S_FREEZE_W,
        },
    },
    # ── Level 5: Cooling & Crystallization ──────────────────────────────
    {
        'name': 'Crystallization',
        'ingredients': ['water', 'copper', 'flame', 'ice'],
        'correct_sequence': [0, 1, 2, 3],
        'target': S_BLUE_CRYST,
        'transitions': {
            (E, 'water'):               S_WATER,
            (E, 'copper'):              S_COPPER_DRY,
            (E, 'flame'):               S_DRY_SMOKE,
            (E, 'ice'):                 S_FREEZE_W,
            (S_WATER, 'copper'):        S_BLUE_LIQ,       # dissolve copper
            (S_WATER, 'flame'):         S_BOIL_W,
            (S_WATER, 'ice'):           S_FREEZE_W,
            (S_BLUE_LIQ, 'flame'):      S_BLUE_BOIL,      # heat blue solution
            (S_BLUE_LIQ, 'ice'):        S_BLUE_CRYST_C,   # too fast = cold crystals
            (S_BLUE_LIQ, 'copper'):     S_BLUE_LAYER,     # supersaturated
            (S_BLUE_BOIL, 'ice'):       S_BLUE_CRYST,     # slow cool = crystals!
            (S_BLUE_BOIL, 'copper'):    S_BLUE_BOIL,
            (S_BLUE_BOIL, 'water'):     S_BOIL_W,         # dilute
            (S_COPPER_DRY, 'water'):    S_ORANGE_LAY,
            (S_COPPER_DRY, 'flame'):    S_DRY_SMOKE,
            (S_BOIL_W, 'copper'):       S_BLUE_BOIL,
            (S_BOIL_W, 'ice'):          S_WATER,
            (S_FREEZE_W, 'flame'):      S_WATER,
            (S_FREEZE_W, 'copper'):     S_FREEZE_W,
        },
    },
    # ── Level 6: Volatile Reaction ──────────────────────────────────────
    {
        'name': 'Carbon Suspension',
        'ingredients': ['charcoal', 'water', 'flame', 'sulfur'],
        'correct_sequence': [1, 0, 2],
        'target': S_CHAR_BOIL,
        'transitions': {
            (E, 'charcoal'):            S_CHAR_DRY,
            (E, 'water'):               S_WATER,
            (E, 'flame'):               S_DRY_SMOKE,
            (E, 'sulfur'):              S_SULFUR_DRY,
            (S_CHAR_DRY, 'flame'):      S_CHAR_SMOKE,     # VOLATILE! burns
            (S_CHAR_DRY, 'water'):      S_CHAR_LAYER,     # wet charcoal
            (S_CHAR_DRY, 'sulfur'):     S_SULFUR_DRY,
            (S_WATER, 'charcoal'):      S_CHAR_LAYER,     # charcoal in water
            (S_WATER, 'flame'):         S_BOIL_W,
            (S_WATER, 'sulfur'):        S_SULF_SUSP,
            (S_CHAR_LAYER, 'flame'):    S_CHAR_BOIL,      # carbon suspension!
            (S_CHAR_LAYER, 'water'):    S_CHAR_LAYER,
            (S_CHAR_LAYER, 'sulfur'):   S_CHAR_LAYER,
            (S_BOIL_W, 'charcoal'):     S_CHAR_BOIL,
            (S_BOIL_W, 'sulfur'):       S_SULF_BOIL,
            (S_SULFUR_DRY, 'water'):    S_SULF_SUSP,
            (S_SULFUR_DRY, 'flame'):    S_DRY_SMOKE,
            (S_SULF_SUSP, 'flame'):     S_SULF_BOIL,
            (S_SULF_SUSP, 'charcoal'):  S_CHAR_LAYER,
        },
    },
    # ── Level 7: Acid-Base Neutralization ───────────────────────────────
    {
        'name': 'Neutralization',
        'ingredients': ['acid', 'base', 'indicator', 'red_dye'],
        'correct_sequence': [0, 1, 2],
        'target': S_NEUT_IND,
        'transitions': {
            (E, 'acid'):                S_ACID_LIQ,
            (E, 'base'):               S_PURPLE_LIQ,
            (E, 'indicator'):          S_IND_PURE,
            (E, 'red_dye'):            S_RED_LIQ,
            (S_ACID_LIQ, 'base'):      S_NEUTRAL,        # neutralized!
            (S_ACID_LIQ, 'indicator'): S_ACID_IND,       # acid turns red
            (S_ACID_LIQ, 'red_dye'):   S_RED_LIQ,
            (S_NEUTRAL, 'indicator'):  S_NEUT_IND,       # neutral = green!
            (S_NEUTRAL, 'red_dye'):    S_LMAG_LIQ,
            (S_NEUTRAL, 'acid'):       S_ACID_LIQ,
            (S_NEUTRAL, 'base'):       S_PURPLE_LIQ,
            (S_PURPLE_LIQ, 'acid'):    S_NEUTRAL,        # neutralized
            (S_PURPLE_LIQ, 'indicator'):S_BASE_IND,      # base = purple
            (S_PURPLE_LIQ, 'red_dye'): S_PURPLE_LIQ,
            (S_IND_PURE, 'acid'):      S_RED_LIQ,
            (S_IND_PURE, 'base'):      S_PURPLE_LIQ,
            (S_RED_LIQ, 'base'):       S_PURPLE_LIQ,
            (S_RED_LIQ, 'acid'):       S_RED_LIQ,
            (S_RED_LIQ, 'indicator'):  S_RED_LIQ,
        },
    },
    # ── Level 8: Filtration ─────────────────────────────────────────────
    {
        'name': 'Filtration',
        'ingredients': ['water', 'iron', 'filter', 'flame'],
        'correct_sequence': [0, 1, 2, 3],
        'target': S_RUST_BOIL,
        'transitions': {
            (E, 'water'):               S_WATER,
            (E, 'iron'):                S_IRON_DRY,
            (E, 'filter'):              (LGRAY, 'powder', 'normal'),
            (E, 'flame'):               S_DRY_SMOKE,
            (S_WATER, 'iron'):          S_RUST_SUSP,      # rust suspension
            (S_WATER, 'filter'):        S_WATER,          # nothing to filter
            (S_WATER, 'flame'):         S_BOIL_W,
            (S_RUST_SUSP, 'filter'):    S_RUST_FILT,      # filtered! clear orange
            (S_RUST_SUSP, 'flame'):     S_RUST_BOIL,      # heat rust (not pure)
            (S_RUST_SUSP, 'water'):     S_RUST_SUSP,
            (S_RUST_FILT, 'flame'):     S_RUST_BOIL,      # purified hot extract!
            (S_RUST_FILT, 'water'):     S_RUST_FILT,
            (S_RUST_FILT, 'iron'):      S_RUST_SUSP,
            (S_IRON_DRY, 'water'):      S_RUST_SUSP,
            (S_IRON_DRY, 'flame'):      S_DRY_SMOKE,
            (S_IRON_DRY, 'filter'):     S_IRON_DRY,
            (S_BOIL_W, 'iron'):         S_RUST_BOIL,
            (S_BOIL_W, 'filter'):       S_BOIL_W,
        },
    },
    # ── Level 9: Multi-Step Synthesis ───────────────────────────────────
    {
        'name': 'Synthesis',
        'ingredients': ['water', 'acid', 'copper', 'flame', 'ice'],
        'correct_sequence': [0, 1, 2, 3, 4],
        'target': S_PURP_CRYST,
        'transitions': {
            (E, 'water'):               S_WATER,
            (E, 'acid'):                S_ACID_LIQ,
            (E, 'copper'):              S_COPPER_DRY,
            (E, 'flame'):               S_DRY_SMOKE,
            (E, 'ice'):                 S_FREEZE_W,
            (S_WATER, 'acid'):          S_ACID_LIQ,       # dilute acid
            (S_WATER, 'copper'):        S_BLUE_LIQ,
            (S_WATER, 'flame'):         S_BOIL_W,
            (S_WATER, 'ice'):           S_FREEZE_W,
            (S_ACID_LIQ, 'copper'):     S_ACID_CU,        # copper reacts in acid
            (S_ACID_LIQ, 'flame'):      S_GREEN_BOIL,
            (S_ACID_LIQ, 'ice'):        S_GREEN_FROZ,
            (S_ACID_LIQ, 'water'):      S_GREEN_LIQ,
            (S_ACID_CU, 'flame'):       S_ACID_CU_H,      # heat the reaction
            (S_ACID_CU, 'ice'):         S_BLUE_CRYST_C,   # too fast
            (S_ACID_CU, 'water'):       S_BLUE_LIQ,
            (S_ACID_CU_H, 'ice'):       S_PURP_CRYST,     # slow cool = purple!
            (S_ACID_CU_H, 'water'):     S_BOIL_W,
            (S_ACID_CU_H, 'copper'):    S_ACID_CU_H,
            (S_COPPER_DRY, 'water'):    S_ORANGE_LAY,
            (S_COPPER_DRY, 'acid'):     S_GREEN_LAY,
            (S_COPPER_DRY, 'flame'):    S_DRY_SMOKE,
            (S_BLUE_LIQ, 'acid'):       S_ACID_CU,
            (S_BLUE_LIQ, 'flame'):      S_BLUE_BOIL,
            (S_BLUE_LIQ, 'ice'):        S_BLUE_CRYST_C,
            (S_BOIL_W, 'acid'):         S_GREEN_BOIL,
            (S_BOIL_W, 'copper'):       S_BLUE_BOIL,
            (S_BOIL_W, 'ice'):          S_WATER,
            (S_BLUE_BOIL, 'ice'):       S_BLUE_CRYST,
        },
    },
    # ── Level 10: Grand Synthesis ───────────────────────────────────────
    {
        'name': 'Philosophers Stone',
        'ingredients': ['water', 'sulfur', 'flame', 'filter', 'ice', 'red_dye'],
        'correct_sequence': [0, 1, 2, 3, 4, 5],
        'target': S_MAG_CRYST,
        'transitions': {
            (E, 'water'):               S_WATER,
            (E, 'sulfur'):              S_SULFUR_DRY,
            (E, 'flame'):               S_DRY_SMOKE,
            (E, 'filter'):              (LGRAY, 'powder', 'normal'),
            (E, 'ice'):                 S_FREEZE_W,
            (E, 'red_dye'):             S_RED_LIQ,
            (S_WATER, 'sulfur'):        S_SULF_SUSP,
            (S_WATER, 'flame'):         S_BOIL_W,
            (S_WATER, 'ice'):           S_FREEZE_W,
            (S_WATER, 'red_dye'):       S_RED_LIQ,
            (S_WATER, 'filter'):        S_WATER,
            (S_SULF_SUSP, 'flame'):     S_SULF_BOIL,      # heat sulfur
            (S_SULF_SUSP, 'filter'):    S_WATER,           # removes sulfur
            (S_SULF_SUSP, 'ice'):       S_YELL_FROZ,
            (S_SULF_SUSP, 'red_dye'):   S_ORANGE_LAY,
            (S_SULF_SUSP, 'water'):     S_SULF_SUSP,
            (S_SULF_BOIL, 'filter'):    S_SULF_FILT,       # filter hot = clear
            (S_SULF_BOIL, 'ice'):       S_SULF_CRYST,      # too fast
            (S_SULF_BOIL, 'red_dye'):   S_RUST_BOIL,
            (S_SULF_BOIL, 'water'):     S_SULF_BOIL,
            (S_SULF_FILT, 'ice'):       S_SULF_COOL,       # cool clear yellow
            (S_SULF_FILT, 'red_dye'):   (ORANGE, 'liquid', 'hot'),
            (S_SULF_FILT, 'water'):     S_SULF_FILT,
            (S_SULF_FILT, 'flame'):     S_SULF_FILT,
            (S_SULF_COOL, 'red_dye'):   S_MAG_CRYST,       # magic reaction!
            (S_SULF_COOL, 'flame'):     S_SULF_BOIL,
            (S_SULF_COOL, 'ice'):       S_YELL_FROZ,
            (S_SULF_COOL, 'filter'):    S_SULF_COOL,
            (S_SULF_COOL, 'water'):     S_SULF_COOL,
            (S_SULFUR_DRY, 'flame'):    S_DRY_SMOKE,
            (S_SULFUR_DRY, 'water'):    S_SULF_SUSP,
            (S_RED_LIQ, 'sulfur'):      S_ORANGE_LAY,
            (S_RED_LIQ, 'flame'):       (RED, 'bubbling', 'hot'),
            (S_RED_LIQ, 'ice'):         (RED, 'frozen', 'cold'),
            (S_BOIL_W, 'sulfur'):       S_SULF_BOIL,
            (S_BOIL_W, 'ice'):          S_WATER,
            (S_BOIL_W, 'red_dye'):      (RED, 'bubbling', 'hot'),
            (S_FREEZE_W, 'flame'):      S_WATER,
            (S_FREEZE_W, 'sulfur'):     S_FREEZE_W,
        },
    },
]


# ── Pixel art ───────────────────────────────────────────────────────────

# Beaker (target display) - 12w x 16h, rectangular with pouring lip
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

# Cauldron (mixing vessel) - 16w x 14h, wide pot with handles
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

# Vial - 6w x 12h, test tube shape
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


# ── Layout constants ───────────────────────────────────────────────────

BEAKER_X = 5
BEAKER_Y = 5
BEAKER_FILL_X = 6     # interior left edge (beaker left wall at x=5)
BEAKER_FILL_Y = 6     # interior top (beaker rim at y=5)
BEAKER_FILL_W = 10    # interior width
BEAKER_FILL_H = 12    # interior height (rows 1-12)

CAULDRON_X = 36
CAULDRON_Y = 4
CAULDRON_FILL_X = 37  # interior left (wall at x=36)
CAULDRON_FILL_Y = 6   # interior top (rim at y=4-5)
CAULDRON_FILL_W = 14  # interior width
CAULDRON_FILL_H = 10  # interior height (rows 2-11)

VIAL_Y = 36
VIAL_SPACING = 10


# ── Display ─────────────────────────────────────────────────────────────

class PxDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self.game
        ld = _LEVELS[g.level_index]

        # Background
        frame[:, :] = VDGRAY
        frame[34:, :] = DGRAY  # lab bench

        # Level progress dots (top)
        for i in range(10):
            x = 2 + i * 6
            c = GREEN if i < g.level_index else DGRAY
            if i == g.level_index:
                c = YELLOW
            frame[1, x:x+4] = c
            frame[2, x:x+4] = c

        # Target label bar
        frame[3, BEAKER_X:BEAKER_X+12] = LBLUE

        # Mix status bar (green if matching, orange if not)
        match = g.cauldron_state == ld['target']
        frame[3, CAULDRON_X:CAULDRON_X+16] = GREEN if match else ORANGE

        # Draw beaker (target) - fill first, then outline on top
        tfill = _render_potion(ld['target'], BEAKER_FILL_W, BEAKER_FILL_H)
        self._fill(frame, tfill, BEAKER_FILL_X, BEAKER_FILL_Y)
        self._blit(frame, BEAKER, BEAKER_X, BEAKER_Y)
        self._temp_bar(frame, ld['target'][2], BEAKER_X + 2, 19)

        # Draw cauldron (mix) - fill first, then outline on top
        cfill = _render_potion(g.cauldron_state, CAULDRON_FILL_W, CAULDRON_FILL_H)
        self._fill(frame, cfill, CAULDRON_FILL_X, CAULDRON_FILL_Y)
        self._blit(frame, CAULDRON, CAULDRON_X, CAULDRON_Y)
        self._temp_bar(frame, g.cauldron_state[2], CAULDRON_X + 4, 18)

        # Arrow between beaker and cauldron
        frame[10, 20:24] = WHITE
        frame[12, 20:24] = WHITE

        # Pour step progress dots
        n_steps = len(ld['correct_sequence'])
        dot_x = CAULDRON_X + (16 - n_steps * 3) // 2
        for i in range(n_steps):
            c = GREEN if i < g.pour_step else DGRAY
            frame[20, dot_x + i * 3:dot_x + i * 3 + 2] = c
            frame[21, dot_x + i * 3:dot_x + i * 3 + 2] = c

        # Draw vials
        ings = ld['ingredients']
        n = len(ings)
        total_w = n * VIAL_SPACING
        sx = max(2, (64 - total_w) // 2)

        for i, key in enumerate(ings):
            vx = sx + i * VIAL_SPACING
            used = i in g.used_vials
            if used:
                self._blit_dim(frame, VIAL, vx, VIAL_Y)
            else:
                ing = INGREDIENTS[key]
                self._blit(frame, VIAL, vx, VIAL_Y)
                self._draw_vial_fill(frame, vx, VIAL_Y, ing)

            # Selection highlight
            if i == g.selected_vial:
                frame[VIAL_Y - 1, vx:vx+6] = YELLOW
                frame[VIAL_Y + 12, vx:vx+6] = YELLOW

        # Result overlay
        if g.show_result > 0:
            if g.result_success:
                self._draw_check(frame, 28, 23)
            else:
                self._draw_cross(frame, 28, 23)

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
            # Meniscus
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


# ── Build levels ────────────────────────────────────────────────────────

levels = [
    Level(sprites=[], grid_size=(64, 64), name=d['name'], data=d)
    for d in _LEVELS
]


# ── Game class ──────────────────────────────────────────────────────────

class Px01(ARCBaseGame):
    def __init__(self):
        self.display = PxDisplay(self)
        self.cauldron_state = E
        self.pour_step = 0
        self.used_vials = set()
        self.selected_vial = -1
        self.show_result = 0
        self.result_success = False

        super().__init__(
            "px",
            levels,
            Camera(0, 0, 64, 64, VDGRAY, VDGRAY, [self.display]),
            False,
            len(levels),
            [6],
        )

    def on_set_level(self, level):
        self.cauldron_state = E
        self.pour_step = 0
        self.used_vials = set()
        self.selected_vial = -1
        self.show_result = 0
        self.result_success = False

    def _get_vial_at(self, x, y):
        ld = _LEVELS[self.level_index]
        ings = ld['ingredients']
        n = len(ings)
        total_w = n * VIAL_SPACING
        sx = max(2, (64 - total_w) // 2)
        for i in range(n):
            vx = sx + i * VIAL_SPACING
            if vx <= x < vx + 6 and VIAL_Y <= y < VIAL_Y + 12:
                return i
        return -1

    def _pour_vial(self, vial_idx):
        ld = _LEVELS[self.level_index]
        ings = ld['ingredients']
        key = ings[vial_idx]
        transitions = ld['transitions']

        lookup = (self.cauldron_state, key)
        if lookup in transitions:
            self.cauldron_state = transitions[lookup]
        else:
            # Unknown transition → smoke (failure state)
            self.cauldron_state = (DGRAY, 'smoke', 'normal')

        self.used_vials.add(vial_idx)
        self.pour_step += 1

        # Check if all required pours are done
        n_required = len(ld['correct_sequence'])
        if self.pour_step >= n_required:
            if self.cauldron_state == ld['target']:
                self.show_result = 10
                self.result_success = True
                self.next_level()
            else:
                self.show_result = 10
                self.result_success = False
                self.lose()

    def step(self):
        if self.show_result > 0:
            self.show_result -= 1

        if self.action.id.value != 6:
            self.complete_action()
            return

        x = self.action.data.get("x", 0)
        y = self.action.data.get("y", 0)

        vial_idx = self._get_vial_at(x, y)
        if vial_idx >= 0 and vial_idx not in self.used_vials:
            self._pour_vial(vial_idx)

        self.complete_action()
