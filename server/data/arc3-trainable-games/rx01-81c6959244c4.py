# Author: Claude Sonnet 5.5 High
# Date: 15-October-2026
# PURPOSE: rx01, "the vine and the fire": a new original game branched from g013 (rebuild by the
#   senior's brief, docs/plans/2026-10-16-g005-g013-senior-design.md section 2). Click a seed pot and
#   a vine grows ring by ring out of it, ageing green, yellow, orange, red, then burning to a black
#   hole. The arrow rides the vine until it turns or forks, then stops. A closed flower opens when
#   the vine reaches it; ride onto it and its seed flies to the tray. Red cells set fire to the green
#   vine they touch. A position that can no longer be won kills the rider on the spot (table ALIVE,
#   written by build_rx.py from these same rules). No text anywhere on the play surface.
# SRP/DRY check: Pass. One file holds the rules (World and the functions on it), the pictures and
#   the engine glue. The verifier and trace builder import the rules from here, never restate them.
# CHANGELOG
#   15-Oct-2026 Claude Sonnet 5.5 High: first build. g013's cut verb, pod bubble, maroon strips and
#     white-blob seed spots removed; riding stops at turns and forks; flowers pay seeds when ridden
#     onto; fire jumps to touching green vine; furrowed pink soil, pot-and-seed spots; crackling
#     red; long win animation on levels 1 and 2, short after. Level 1 is a vine that never burns.

from typing import NamedTuple

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)


# ── colours: each index carries one meaning on the board ─────────────────────
BLACK = 5        # holes (burnt), the tray, the doorway, the seed pot
WHITE = 0        # seeds, stone paving, the rider's eyes, sparks
BLUE = 9         # sea: never footing, never grows
RIPPLE = 10      # sea ripples, stone joints
SOIL = 7         # light soil: grows, is not footing
DASH = 13        # the darker furrow dashes in the soil
GREEN = 14       # young vine
YELLOW = 11      # vine getting old; the door frame; the crackle
ORANGE = 12      # vine nearly spent
RED = 8          # vine's last tick; the rider as he dies
MAGENTA = 6      # the start pad
PURPLE = 15      # the rider; flower petals
RAMP = (GREEN, GREEN, YELLOW, ORANGE, RED)   # vine colour by age 0..4

COLS, ROWS = 8, 7
CELL = 8
FRAME = 64
BOARD_H = ROWS * CELL
CELLS = COLS * ROWS
FULL = (1 << CELLS) - 1
COL_FIRST = sum(1 << (r * COLS) for r in range(ROWS))
COL_LAST = COL_FIRST << (COLS - 1)

UP, DOWN, LEFT, RIGHT = (0, -1), (0, 1), (-1, 0), (1, 0)
MOVES = {GameAction.ACTION1: UP, GameAction.ACTION2: DOWN,
         GameAction.ACTION3: LEFT, GameAction.ACTION4: RIGHT}
HEADINGS = (UP, DOWN, LEFT, RIGHT)

LIFESPAN = 5       # a vine cell lives ages 0..4 and burns away when it reaches 5
RIDE_CAP = 14

WATER_CH = "#"
LOAM_CH = "."
POT_CH = "o"
FLOWER_CH = "f"
START_CH = "@"
EXIT_CH = "X"
STONE_CH = "="
FUSE_CHARS = "01234"
LEDGE_CHARS = STONE_CH + START_CH + EXIT_CH
GROWABLE_CHARS = LOAM_CH + POT_CH + FLOWER_CH + FUSE_CHARS

# rows: # water, . soil, o seed pot, f closed flower, = stone, @ start pad, X door, 0-4 soil that is
# already growing at that age when the level opens. seeds: seeds held at the start. fire: whether
# vine ages and burns (level 1 keeps its one vine green for good, so it cannot be lost).
LEVELS_SPEC = [
    {"rows": ["........",
              "........",
              "........",
              "@o..X...",
              "........",
              "........",
              "........"],
     "seeds": 1, "fire": False},
    {"rows": ["########",
              "@o.....#",
              "##.#####",
              "o#...#o#",
              "####.###",
              "###X.###",
              "########"],
     "seeds": 1, "fire": True},
    {"rows": ["########",
              "@o.....#",
              "##.#####",
              "##=====#",
              "######=#",
              "#X..o.=#",
              "########"],
     "seeds": 2, "fire": True},
    {"rows": ["########",
              "@o...=##",
              "###f#=##",
              "#####=##",
              "#X.o.=##",
              "########",
              "########"],
     "seeds": 1, "fire": True},
    {"rows": ["o######o",
              "@of...=#",
              "#.####=#",
              "#.####=#",
              "#=######",
              "#=o...X#",
              "#######o"],
     "seeds": 1, "fire": True},
    {"rows": ["###X..o.",
              "#####.#=",
              "#######=",
              "#######=",
              "@2.f.===",
              "##.#####",
              "#o#o#o##"],
     "seeds": 0, "fire": True},
    {"rows": ["#####.##",
              ".....fX#",
              ".####.##",
              "o..3..##",
              "#####.##",
              "@####.##",
              "of===o##"],
     "seeds": 1, "fire": True},
    {"rows": ["==.o###.",
              "=##.##o#",
              "=.Xf####",
              "@##.##o#",
              "f##.####",
              ".##=#o##",
              "o2==####"],
     "seeds": 0, "fire": True},
]

for _spec in LEVELS_SPEC:
    assert len(_spec["rows"]) == ROWS and all(len(r) == COLS for r in _spec["rows"])


# ── rules ─────────────────────────────────────────────────────────────────────
# The whole rule state is a World. A level's map is a Layout of bitmasks (bit = row * 8 +
# column). Every action is one or more ticks; a tick ages the vine, spreads it, lets red cells
# set fire to touching green, and burns what is spent. The drawing never decides anything.
# build_rx.py runs on these same functions (it builds the table of positions that can still be
# won from them), so there is one copy of the rules.

class Layout:

    def __init__(self, spec, index=None):
        rows = spec["rows"]
        self.index = index
        self.rows = tuple(rows)
        self.fire = bool(spec.get("fire", True))
        self.seeds = spec["seeds"]
        grow = ledge = spots = flowers = water = exits = 0
        lit = [0] * LIFESPAN
        start = exit_at = None
        for r, row in enumerate(rows):
            for q, ch in enumerate(row):
                m = 1 << (r * COLS + q)
                if ch == WATER_CH:
                    water |= m
                elif ch in GROWABLE_CHARS:
                    grow |= m
                    if ch == POT_CH:
                        spots |= m
                    elif ch == FLOWER_CH:
                        flowers |= m
                    elif ch in FUSE_CHARS:
                        lit[int(ch)] |= m
                elif ch in LEDGE_CHARS:
                    ledge |= m
                    if ch == START_CH:
                        start = r * COLS + q
                    elif ch == EXIT_CH:
                        exits |= m
                        exit_at = r * COLS + q
        if start is None or exit_at is None:
            raise ValueError("level needs a start pad and a door")
        self.grow, self.ledge, self.spots, self.flowers = grow, ledge, spots, flowers
        self.water, self.exits = water, exits
        self.start, self.exit_at = start, exit_at
        self.lit = tuple(lit)
        self.has_sea = bool(water)
        self.flower_count = bin(flowers).count("1")
        self.slots = self.seeds + self.flower_count


LAYOUTS = [Layout(_spec, _i) for _i, _spec in enumerate(LEVELS_SPEC)]


class World(NamedTuple):

    at: int          # the rider's cell (row * 8 + column)
    bloom: tuple     # five bitmasks: vine cells of age 0, 1, 2, 3, 4
    ash: int         # holes: burnt, never footing, never grow again
    seeds: int       # seeds in the tray
    picked: int      # flowers whose seed the rider has taken


def cell_of(i):
    return i % COLS, i // COLS


def index_of(q, r):
    return r * COLS + q


def on_board(q, r):
    return 0 <= q < COLS and 0 <= r < ROWS


def cells(rows, ch):
    return [(q, r) for r, row in enumerate(rows) for q, c in enumerate(row) if c == ch]


def bits(mask):
    out = []
    while mask:
        low = mask & -mask
        out.append(low.bit_length() - 1)
        mask ^= low
    return out


def opening(lay):
    return World(lay.start, lay.lit, 0, lay.seeds, 0)


def live_of(bloom):
    return bloom[0] | bloom[1] | bloom[2] | bloom[3] | bloom[4]


def ages_of(w):
    out = {}
    for age, mask in enumerate(w.bloom):
        for i in bits(mask):
            out[cell_of(i)] = age
    return out


def spread(mask):
    """Every cell next to a cell of mask (up, down, left, right)."""
    return (((mask << 1) & ~COL_FIRST) | ((mask >> 1) & ~COL_LAST)
            | (mask << COLS) | (mask >> COLS)) & FULL


def takes_seed(lay, w, q, r):
    """A click sows only on a bare, unburnt seed pot while a seed is held."""
    if not on_board(q, r) or w.seeds <= 0:
        return False
    m = 1 << index_of(q, r)
    return bool(lay.spots & m and not (live_of(w.bloom) | w.ash) & m)


def advance(lay, bloom, ash):
    """One tick. Without fire the vine only spreads and stays green. With fire: red cells set
    fire to the green (age 0 or 1) vine they touch, which jumps straight to red; every cell
    ages; cells still young spread into bare growable neighbours; cells that reach LIFESPAN
    burn to holes."""
    b0, b1, b2, b3, b4 = bloom
    if not lay.fire:
        live = b0 | b1 | b2 | b3 | b4
        born = spread(live) & lay.grow & ~live & ~ash
        return (live | born, 0, 0, 0, 0), ash
    jumped = spread(b4) & (b0 | b1)
    young = (b0 | b1 | b2 | b3) & ~jumped
    born = spread(young) & lay.grow & ~(b0 | b1 | b2 | b3 | b4) & ~ash
    return (born, b0 & ~jumped, b1 & ~jumped, b2, b3 | jumped), ash | b4


def resolve(lay, w, dq, dr, click):
    """One tick. click is a board cell index: a bare seed pot is sown. Otherwise the rider
    steps (dq, dr) if that cell is footing now, and takes the seed of an open flower he steps
    onto. Returns (World, outcome, the cell the rider stood on when the tick ended)."""
    at, bloom, ash, seeds, picked = w
    live = live_of(bloom)
    moved = False
    if click is not None:
        m = 1 << click
        if lay.spots & m and seeds > 0 and not (live | ash) & m:
            bloom = (bloom[0] | m,) + bloom[1:]
            seeds -= 1
    elif dq or dr:
        q, r = at % COLS + dq, at // COLS + dr
        if on_board(q, r) and (lay.ledge | live) >> (r * COLS + q) & 1:
            at = r * COLS + q
            moved = True
    if moved and lay.flowers >> at & 1 and not picked >> at & 1:
        seeds += 1
        picked |= 1 << at
    bloom, ash = advance(lay, bloom, ash)
    if not (lay.ledge | live_of(bloom)) >> at & 1:
        return World(lay.start, bloom, ash, seeds, picked), "fell", at
    if lay.exits >> at & 1:
        return World(at, bloom, ash, seeds, picked), "goal", at
    return World(at, bloom, ash, seeds, picked), "ok", at


def footing_near(lay, w, i):
    """The neighbours of cell i that can be stood on right now, as cell indices."""
    q, r = cell_of(i)
    ground = lay.ledge | live_of(w.bloom)
    return [index_of(q + dq, r + dr) for dq, dr in HEADINGS
            if on_board(q + dq, r + dr) and ground >> index_of(q + dq, r + dr) & 1]


def keeps_riding(lay, w, came, dq, dr):
    """A ride goes on only along a plain stretch: the one way on (other than back) is straight
    ahead. A turn, a fork or a dead end stops the rider."""
    onward = [i for i in footing_near(lay, w, w.at) if i != came]
    q, r = cell_of(w.at)
    return len(onward) == 1 and onward[0] == index_of(q + dq, r + dr) and on_board(q + dq, r + dr)


def ride_ticks(lay, w, dq, dr):
    """A press, one entry per tick: (World, outcome, cell). The first tick always happens
    (pressing toward a cell that is not footing is a one-tick wait). The ride goes on while the
    way is plain; it ends at a turn, a fork, a dead end, a flower taken, a fall or the door."""
    out = []
    while True:
        w2, outcome, at = resolve(lay, w, dq, dr, None)
        out.append((w2, outcome, at))
        if (outcome != "ok" or at == w.at or w2.picked != w.picked or len(out) >= RIDE_CAP
                or not keeps_riding(lay, w2, w.at, dq, dr)):
            return out
        w = w2


def apply(lay, w, move):
    """Verifier entry point. move is a heading (dq, dr) or ("S", q, r) for a click on a board
    cell. A click that does not sow is refused: same World, no tick."""
    if len(move) == 3:
        _, q, r = move
        if not takes_seed(lay, w, q, r):
            return w, "refused"
        w, outcome, _ = resolve(lay, w, 0, 0, index_of(q, r))
        return w, outcome
    last, outcome, _ = ride_ticks(lay, w, move[0], move[1])[-1]
    return last, outcome


def moves_from(lay, w):
    out = list(HEADINGS)
    if w.seeds > 0:
        out += [("S",) + cell_of(i) for i in bits(lay.spots & ~(live_of(w.bloom) | w.ash))]
    return out


def key_of(w):
    """A fixed 64-bit fingerprint of a position: the same on every machine and every run."""
    h = 14695981039346656037
    for v in (w.at, w.seeds, w.ash, w.picked) + w.bloom:
        h = ((h ^ v) * 1099511628211) & 0xFFFFFFFFFFFFFFFF
        h ^= h >> 29
    return h


# The positions from which the door can still be reached, one set of fingerprints per level.
# Written by build_rx.py from the rules above: every position reachable from the level's opening by
# any press or click, worked backwards from the door. A position that is not listed can never be
# won, and the game kills it on the spot.
# BEGIN ALIVE
ALIVE = (
    # level 1: 205 of 205 reachable positions can still be won
    frozenset((
        108992563863758303, 111451999084045061, 150770684596805841, 202786554764301082,
        207286674496083349, 330430649654213880, 373040592803654719, 467371462081385473,
        591417758594734725, 786419530027374395, 1013146562899400613, 1022996421882349023,
        1112289100587988519, 1264582173337441487, 1269300611322968896, 1476191354993441142,
        1672418225821047182, 1771692539055500519, 1871468787955518331, 1881763654036072257,
        1979879929603296769, 1986764531752053047, 2143577111850808518, 2217614484486041782,
        2273524638448536885, 2287035561557581212, 2327245044652347610, 2460874142655994851,
        2527581289413008278, 2664955719877481789, 2747935608645652520, 2771636215183480814,
        2948753295234899319, 2974533070473952099, 3099616912284807098, 3193046075202188903,
        3218434240530313862, 3533160178173683480, 3599514484408177756, 3603935037806235263,
        3630359301790335066, 3679243964360784103, 3791174493790015586, 3911948537146272258,
        3934980562547826021, 4378163251098412618, 4440276823155202068, 4809159968084517874,
        4950248438400100277, 5019648712510497485, 5069195406256298306, 5076396914189071093,
        5127214980043105243, 5171047485806500968, 5248833775621022456, 5290345664696429300,
        5325053418143493068, 5357611226728319569, 5389329768455322513, 5425355551122323337,
        5449800994899572312, 5532028010730672236, 5543479797622932108, 5638838079010174554,
        5754767552230101041, 6003157708943689392, 6178811315229600624, 6224486991848713476,
        6325289499183667928, 6358562888501746828, 6390449603000630104, 6883055246847523009,
        6935644230323049188, 6970103229582817551, 6971483371031907311, 7071623866441934855,
        7131199643064862144, 7496486158217234893, 7597585849781478021, 7620593299219076092,
        7698311668059616867, 7742601309654052353, 7827864530571458599, 7877478973569426848,
        7937758327614913905, 7989097588937939171, 8032538813900079188, 8069789687138239925,
        8166134996489929114, 8364656605739755977, 8443533168732812616, 8629603586599372893,
        8659340440646149879, 8919481073850435859, 9001479836214015512, 9072068227697647557,
        9265379936588347142, 9383887461137356825, 9525154029995192077, 9533343123997257368,
        9543420091274712414, 9593752706758391285, 9644339304202023611, 9751148059965368375,
        9760237222654645413, 9875327778989624377, 9917665311939913485, 9936626083669664442,
        9967851863660905835, 10030966461018826715, 10041891419808085562, 10043858025384629027,
        10063065247883025441, 10114312767947827502, 10185000962188065107, 10191815935175309218,
        10228042470289405287, 10402337176917799066, 10443977152562383120, 10550913422274937035,
        10612000766676576711, 10673929503461620935, 10706441934941800049, 10716033321095018382,
        10768133467178706674, 11050462835213102277, 11209665914764654615, 11293479496774828933,
        11332924622824290988, 11363510188759407843, 11548968290780013424, 11625888986273441024,
        11626384845534947364, 11917345471210833235, 12081240213337214357, 12205647393454941305,
        12240389150768873517, 12261342716725817524, 12302026516753594846, 12364767015313819987,
        12401780201121298876, 12624370168308311062, 12853988996919672113, 12890385570031080452,
        13195175169558440383, 13272287010487215776, 13332450451184978951, 13364217258497087314,
        13489402801376640036, 13620925935736227954, 13634479664470416521, 13862887673259533032,
        14040616725817460726, 14135367829659496012, 14293939818289229331, 14319425120031241969,
        14327671180916883531, 14414205666474375319, 14489826121914155734, 14532294049742930646,
        14533651429988374765, 14669321045732080307, 14680699661993286467, 14763174314855046725,
        14792296243351773816, 14853985972940790659, 14862572890538762720, 15046456715309136069,
        15084701240733964199, 15097648731496737078, 15101036671418358360, 15182811633780735973,
        15241272832732999798, 15441213618966409441, 15483176239405030937, 15599964078749269394,
        15617034060024439382, 15647282443573858881, 15752636568024705478, 15853135974079506857,
        15923394283634333245, 16111684011716521851, 16118392939816616693, 16215382665676695475,
        16277680764411763468, 16479655269895689432, 16543485343765428468, 16631970674881884470,
        16762268925495149726, 16767222639183738057, 16791188372882706505, 16847197505515993316,
        16976516584963940307, 17105895156532849324, 17265870608298377102, 17290918188949450761,
        17319233920781284313, 17430607354496266237, 17461120394849842816, 17704375680494346599,
        17785393507403152440, 18100866539158891419, 18124453384538283835, 18341680654710071134,
        18360796816956605394,
    )),
    # level 2: 19 of 42 reachable positions can still be won
    frozenset((
        548344821735767344, 1852282361767423711, 2784808499706519985, 4131656004129964436,
        4741966049156761803, 5007770626920910166, 8736610464345006420, 8800060877324084649,
        9024193785022413403, 9410550377031473247, 10091314908213849130, 10290475606309647164,
        11389086701056175198, 11817222029639505647, 13126414156859613603, 14155091345646873992,
        14793642376559996571, 16335191257915782870, 16810290817660209960,
    )),
    # level 3: 19 of 175 reachable positions can still be won
    frozenset((
        1730162646074544061, 4216924076278693105, 4528626991500293018, 5187696576067311323,
        5390690029575651136, 5411688999100602907, 5685678950566567758, 6355497883429063263,
        6401244033628616735, 6890711818005177562, 10602521252665465780, 11920860290043460427,
        11963358716441478256, 12163855676155925508, 13007935523120411542, 14264171482614335602,
        16517826962211959432, 16798165408718114256, 17843078263983148444,
    )),
    # level 4: 9 of 46 reachable positions can still be won
    frozenset((
        150036109738447722, 163492277187303923, 5007770626920910166, 5748255949747034327,
        5866128195720765196, 7887541993563103667, 8121584828047970431, 11098831309626185921,
        14155091345646873992,
    )),
    # level 5: 13 of 228 reachable positions can still be won
    frozenset((
        3239946319537662007, 4043623557521863538, 6065801593819925862, 7261098293703121784,
        9881332414863719045, 10342141995607078973, 10813166031585755886, 13586958546559180742,
        14155091345646873992, 15691265040164698422, 17126653662010531281, 17639357274824348525,
        17832079185025874382,
    )),
    # level 6: 15 of 94 reachable positions can still be won
    frozenset((
        1019364169147554737, 1543980344629000604, 2131842639499330845, 3607173255193438824,
        6792398441385563551, 8078286224951927497, 11555855530547875940, 11570121518225820504,
        12293710649091934611, 12320912051789758579, 12633390261295968290, 13848510040452743428,
        14214920849661589102, 15701956500533474257, 17038039131244057605,
    )),
    # level 7: 34 of 213 reachable positions can still be won
    frozenset((
        90251560332626017, 924013151663628376, 1007306797022656430, 1192750918742518162,
        3238128454959910501, 3579786105091555165, 5399431643549569182, 5510740508010198232,
        6809919663095466612, 6981794538856317045, 7405460061170204824, 7842648061130885317,
        7939015986835336436, 8190378835262174363, 8523361142607524404, 8745852881108405767,
        10131401858686448653, 10145214090694942690, 10300784637504822389, 10639364670449130683,
        11065027873631386862, 11115230241767612257, 11481607434642561765, 12254047863852611513,
        13129138714694634540, 14231789235843614727, 14698010532830605755, 14806175988305264677,
        15203199748264542314, 15300793046414979282, 15728585831384801605, 16807161886392674754,
        16926398298665118785, 17538565256030668173,
    )),
    # level 8: 20 of 151 reachable positions can still be won
    frozenset((
        933889350372643186, 1357094434612786743, 1435543552240275247, 2762154972754247701,
        3157477625006155796, 3349601660466628804, 3519035771388009838, 8245851554733856357,
        8252850329544707486, 8922875018978770448, 9689465746353564098, 11489674362056471460,
        12010810632807059841, 12694503013937310995, 13301253852213188417, 14911575505426999172,
        15076668556561477970, 15830980975484039222, 17308536338026963344, 17336174218089746847,
    )),
)
# END ALIVE


def winnable(lay, w):
    """Can the door still be reached from w? (A table lookup; see ALIVE.)"""
    return key_of(w) in ALIVE[lay.index]


# ── pictures ──────────────────────────────────────────────────────────────────

KEY = {"K": BLACK, "W": WHITE, "B": BLUE, "L": RIPPLE, "G": GREEN, "Y": YELLOW,
       "O": ORANGE, "R": RED, "S": SOIL, "D": DASH, "P": PURPLE, "N": MAGENTA}


def art(rows):
    return np.array([[-1 if c == "." else KEY[c] for c in row] for row in rows], dtype=np.int8)


SEED_ART = art([".WW.",
                "WWWW",
                "WWWW",
                "WWWW",
                ".WW."])

# a small dark pot with a white seed sitting in it
POT_ART = art(["........",
               "...WW...",
               "..WWWW..",
               "...WW...",
               ".KKKKKK.",
               "..KKKK..",
               "..KKKK..",
               "..KKKK.."])

# a flower in four states: closed bud, opening, half open, open with its seed showing
FLOWER_ART = (
    art(["........",
         "...PP...",
         "..PPPP..",
         "..PPPP..",
         "...PP...",
         "...DD...",
         ".D.DD.D.",
         "........"]),
    art(["........",
         "..P..P..",
         "..PPPP..",
         "..PPPP..",
         "...PP...",
         "...DD...",
         ".D.DD.D.",
         "........"]),
    art(["........",
         ".P....P.",
         ".PPPPPP.",
         "..PWWP..",
         "..PPPP..",
         "...DD...",
         "...DD...",
         "........"]),
    art([".P.PP.P.",
         "..PPPP..",
         ".PPWWPP.",
         ".PPWWPP.",
         "..PPPP..",
         ".P.PP.P.",
         "........",
         "........"]),
)

DOOR_ART = art(["..YYYY..",
                ".YYYYYY.",
                ".YKKKKY.",
                ".YKKKKY.",
                ".YKKKKY.",
                ".YKKKKY.",
                ".YKKKKY.",
                "YYYYYYYY"])

RIDER_ART = {
    DOWN: art(["..PPPP..", ".PPPPPP.", ".PWPPWP.", ".PWPPWP.", ".PPPPPP.", "..PPPP..", ".PP..PP.", ".KK..KK."]),
    UP: art(["..PPPP..", ".PPPPPP.", ".PPPPPP.", ".PPPPPP.", ".PPPPPP.", "..PPPP..", ".PP..PP.", ".KK..KK."]),
    LEFT: art(["..PPPP..", ".PPPPPP.", ".WPPPPP.", ".WPPPPP.", ".PPPPPP.", "..PPPP..", ".PP..PP.", ".KK..KK."]),
    RIGHT: art(["..PPPP..", ".PPPPPP.", ".PPPPPW.", ".PPPPPW.", ".PPPPPP.", "..PPPP..", ".PP..PP.", ".KK..KK."]),
}

PUFF_ART = art(["W..W..W.",
                ".W....W.",
                "........",
                "W......W",
                ".......W",
                "........",
                ".W....W.",
                "W..W..W."])


def paste(dst, x, y, tile):
    h, w = tile.shape
    for r in range(h):
        for c in range(w):
            if tile[r, c] >= 0:
                dst[y + r, x + c] = tile[r, c]


def shrunk(size, colour):
    """The rider as a rounded blob of the given size with a black rim, so it shows on any
    ground (used when he falls, dies, or steps into the door)."""
    px = np.full((CELL, CELL), -1, dtype=np.int8)
    if size <= 0:
        return px
    outer = min(CELL, size + 2)
    lo = (CELL - outer) // 2
    px[lo:lo + outer, lo:lo + outer] = BLACK
    px[lo, lo] = px[lo, lo + outer - 1] = px[lo + outer - 1, lo] = px[lo + outer - 1, lo + outer - 1] = -1
    inner = outer - 2
    px[lo + 1:lo + 1 + inner, lo + 1:lo + 1 + inner] = colour
    return px


def sea_face(q, r):
    px = np.full((CELL, CELL), BLUE, dtype=np.int8)
    dashes = ((1, 1), (5, 5)) if (q + r) % 2 == 0 else ((2, 4), (6, 1))
    for y, x in dashes:
        px[y, x:x + 3] = RIPPLE
    return px


def shave_of(lay, q, r):
    """Cell shape: a corner is cut where the sea lies on both sides of it, so the land
    reads as land and not as a grid of squares."""
    def sea(a, b):
        if not on_board(a, b):
            return lay.has_sea
        return bool(lay.water >> index_of(a, b) & 1)
    keep = np.ones((CELL, CELL), dtype=bool)
    if sea(q, r - 1) and sea(q - 1, r):
        keep[0, 0] = False
    if sea(q, r - 1) and sea(q + 1, r):
        keep[0, CELL - 1] = False
    if sea(q, r + 1) and sea(q - 1, r):
        keep[CELL - 1, 0] = False
    if sea(q, r + 1) and sea(q + 1, r):
        keep[CELL - 1, CELL - 1] = False
    return keep


def crackle(px, beat):
    """The burning front: two yellow pixels that swap places every frame."""
    for y, x in (((2, 2), (5, 5)) if beat % 2 == 0 else ((2, 5), (5, 2))):
        px[y, x] = YELLOW


def soil_face(kind, age, hole, keep, phase=3, beat=0):
    """A growable cell: furrowed soil (with its pot or closed flower), live vine of a given age
    (with an open flower on it while its seed is untaken), or a hole. phase is the flower's
    opening 0..3; kind is the map character; a taken flower has kind LOAM_CH."""
    px = np.full((CELL, CELL), SOIL, dtype=np.int8)
    if hole:
        px[:, :] = BLACK
    elif age is not None:
        px[:, :] = RAMP[age]
        if age == 4:
            crackle(px, beat)
        if kind == FLOWER_CH:
            paste(px, 0, 0, FLOWER_ART[phase])
    else:
        px[2, 1:4] = DASH
        px[5, 4:7] = DASH
        if kind == POT_CH:
            paste(px, 0, 0, POT_ART)
        elif kind == FLOWER_CH:
            paste(px, 0, 0, FLOWER_ART[0])
    px[~keep] = -1
    return px


def stone_face(kind, keep):
    px = np.full((CELL, CELL), WHITE, dtype=np.int8)
    if kind != EXIT_CH:
        seam = RIPPLE
        if kind == START_CH:
            px[:, :] = MAGENTA
            seam = BLACK
        px[CELL - 1, :] = seam
        px[:, CELL - 1] = seam
    px[~keep] = -1
    return px


def rider_face(heading, shrink, red):
    if shrink >= CELL:
        px = RIDER_ART.get(heading, RIDER_ART[DOWN]).copy()
        if red:
            px[px == PURPLE] = RED
        return px
    return shrunk(shrink, RED if red else PURPLE)


def outline_face(colour):
    px = np.full((CELL, CELL), -1, dtype=np.int8)
    px[0, :] = px[-1, :] = colour
    px[:, 0] = px[:, -1] = colour
    return px


def door_face(lit):
    """The door's black opening fills with white light from the bottom, lit rows at a time."""
    px = DOOR_ART.copy()
    for k in range(min(lit, 5)):
        px[6 - k, 2:6] = WHITE
    return px


def tray_slot(k):
    return 2 + 8 * k, BOARD_H + 2


def slot_face():
    """An empty place for a seed: the seed's own shape, dark."""
    px = SEED_ART.copy()
    px[px == WHITE] = DASH
    return px


def seed_at_spot(q, r):
    return q * CELL + 2, r * CELL + 1


def seed_at_slot(k):
    return tray_slot(k)


def lerp(a, b, t):
    return (int(round(a[0] + (b[0] - a[0]) * t)), int(round(a[1] + (b[1] - a[1]) * t)))


def cue_colour(lay, w, q, r):
    """White shows on dark cells (sea, holes); black on every bright one."""
    if not on_board(q, r):
        return WHITE
    dark = (lay.water | w.ash) >> index_of(q, r) & 1
    return WHITE if dark else BLACK


def burst_face(stage, centre):
    """White and yellow sparks on a ring around the door, wider each stage."""
    px = np.full((BOARD_H, FRAME), -1, dtype=np.int8)
    if stage <= 0:
        return px
    cx, cy = centre
    radius = 3 + 2 * stage
    for k in range(12):
        ang = k * np.pi / 6
        x, y = int(round(cx + radius * np.cos(ang))), int(round(cy + radius * np.sin(ang)))
        if 0 <= x < FRAME and 0 <= y < BOARD_H:
            px[y, x] = WHITE if k % 2 == 0 else YELLOW
    return px


# ── level sprites ─────────────────────────────────────────────────────────────

def plain(pixels, name, x, y, layer, tags, visible=True):
    return Sprite(pixels=pixels, name=name, x=x, y=y, layer=layer,
                  blocking=BlockingMode.NOT_BLOCKED,
                  interaction=InteractionMode.TANGIBLE if visible else InteractionMode.REMOVED,
                  tags=list(tags))


def growable_cells(lay):
    return [cell_of(i) for i in range(CELLS) if lay.grow >> i & 1]


def build_levels():
    made = []
    for lay in LAYOUTS:
        rows = lay.rows
        start = opening(lay)
        ages = ages_of(start)
        sprites = []
        if lay.has_sea:
            sea = np.zeros((BOARD_H, FRAME), dtype=np.int8)
            for r in range(ROWS):
                for q in range(COLS):
                    sea[r * CELL:(r + 1) * CELL, q * CELL:(q + 1) * CELL] = sea_face(q, r)
            sprites.append(plain(sea, "sea", 0, 0, -2, ["sea"]))
        for k in range(lay.slots):
            x, y = tray_slot(k)
            sprites.append(plain(slot_face(), f"slot_{k}", x, y, -1, ["tray"]))
        for r in range(ROWS):
            for q in range(COLS):
                ch = rows[r][q]
                x, y = q * CELL, r * CELL
                if ch in LEDGE_CHARS:
                    tags = ["ledge"] + (["pad"] if ch == START_CH else []) + (["exit"] if ch == EXIT_CH else [])
                    sprites.append(plain(stone_face(ch, shave_of(lay, q, r)), f"ledge_{q}_{r}", x, y, 0, tags))
                    if ch == EXIT_CH:
                        sprites.append(plain(DOOR_ART.copy(), "exit", x, y, 1, ["exit"]))
                elif ch in GROWABLE_CHARS:
                    kind = ch if ch in (POT_CH, FLOWER_CH) else LOAM_CH
                    tag = {POT_CH: "pot", FLOWER_CH: "flower"}.get(ch, "fuse" if ch in FUSE_CHARS else "loam")
                    sprites.append(plain(soil_face(kind, ages.get((q, r)), False, shave_of(lay, q, r)),
                                         f"soil_{q}_{r}", x, y, 0, ["soil", tag]))
        for k in range(lay.slots):
            x, y = seed_at_slot(k)
            sprites.append(plain(SEED_ART.copy(), f"tray_{k}", x, y, 2, ["tray"], visible=k < lay.seeds))
        sprites.append(plain(SEED_ART.copy(), "flyer", 0, 0, 4, ["cue"], visible=False))
        for k in range(max(1, lay.flower_count)):
            sprites.append(plain(SEED_ART.copy(), f"core_{k}", 0, 0, 4, ["cue"], visible=False))
        for k in range(6):
            sprites.append(plain(outline_face(WHITE), f"outline_{k}", 0, 0, 5, ["cue"], visible=False))
        sprites.append(plain(PUFF_ART.copy(), "puff", 0, 0, 5, ["cue"], visible=False))
        sprites.append(plain(burst_face(0, (0, 0)), "burst", 0, 0, 6, ["cue"], visible=False))
        x, y = (lay.start % COLS) * CELL, (lay.start // COLS) * CELL
        sprites.append(plain(RIDER_ART[DOWN].copy(), "rider", x, y, 3, ["rider"]))
        made.append(Level(sprites=sprites, grid_size=(FRAME, FRAME)))
    return made


# ── frames: plain data, so a deep copy of the game is exact ──────────────────

def frame_spec(w, **extra):
    spec = {"w": w, "rider": None, "face": DOWN, "shrink": CELL, "red": False, "gone": False,
            "outlines": (), "flyer": None, "cores": (), "puff": None, "opening": None,
            "tray": w.seeds, "shift": 0, "end": None, "lit": 0, "burst": 0}
    spec.update(extra)
    return spec


def rider_xy(i):
    q, r = cell_of(i)
    return q * CELL, r * CELL


class Rx01(ARCBaseGame):

    def __init__(self):
        self.world = opening(LAYOUTS[0])
        self.facing = DOWN
        self.queue = []
        self.painted = {}
        self.shown = None
        self.beat = 0
        super().__init__(
            game_id="rx01", levels=build_levels(),
            camera=Camera(width=FRAME, height=FRAME, background=BLACK, letter_box=BLACK),
            available_actions=[1, 2, 3, 4, 6],
        )

    @property
    def lay(self):
        return LAYOUTS[self.level_index]

    def on_set_level(self, level):
        self.queue = []
        self.painted = {}
        self.world = opening(self.lay)
        self.facing = DOWN
        self.draw(self.settled(self.world))

    def restore(self):
        """The position is lost: put the level back as it was entered (what RESET does).
        The engine's own level reset is not used: it would zero the action count and make
        the player's next RESET restart the whole game."""
        self.world = opening(self.lay)
        self.facing = DOWN
        self.draw(self.settled(self.world))

    # ── drawing ───────────────────────────────────────────────────────────────

    def sprite(self, name):
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def show(self, sprite, visible):
        if sprite is not None:
            sprite.set_interaction(InteractionMode.TANGIBLE if visible else InteractionMode.REMOVED)

    def settled(self, w, **extra):
        return frame_spec(w, rider=rider_xy(w.at), face=self.facing, **extra)

    def draw(self, spec):
        self.shown = spec
        self.beat += 1
        lay = self.lay
        w = spec["w"]
        ages = ages_of(w)
        shift = spec["shift"]
        for q, r in growable_cells(lay):
            i = index_of(q, r)
            name = f"soil_{q}_{r}"
            hole = bool(w.ash >> i & 1)
            age = ages.get((q, r))
            if age is not None:
                age += shift          # the withering shown at the end of a death
                if age >= LIFESPAN:
                    hole, age = True, None
            if hole:
                age = None
            ch = lay.rows[r][q]
            kind = ch if ch in (POT_CH, FLOWER_CH) else LOAM_CH
            phase = 3
            if kind == FLOWER_CH:
                if w.picked >> i & 1:
                    kind = LOAM_CH
                elif spec["opening"] and i in spec["opening"]:
                    phase = spec["opening"][i]
            key = (hole, age, kind, phase, self.beat % 2 if age == LIFESPAN - 1 else 0)
            if self.painted.get(name) == key:
                continue
            sprite = self.sprite(name)
            if sprite is not None:
                sprite.pixels[:, :] = soil_face(kind, age, hole, shave_of(lay, q, r), phase, self.beat)
            self.painted[name] = key
        k = 0
        while True:
            tray = self.sprite(f"tray_{k}")
            if tray is None:
                break
            self.show(tray, k < spec["tray"])
            k += 1
        flyer = self.sprite("flyer")
        if spec["flyer"] is not None:
            flyer.set_position(*spec["flyer"])
        self.show(flyer, spec["flyer"] is not None)
        k = 0
        while True:
            s = self.sprite(f"core_{k}")
            if s is None:
                break
            if k < len(spec["cores"]):
                s.set_position(*spec["cores"][k])
            self.show(s, k < len(spec["cores"]))
            k += 1
        for k in range(6):
            o = self.sprite(f"outline_{k}")
            if k < len(spec["outlines"]):
                x, y, colour = spec["outlines"][k]
                o.pixels[:, :] = outline_face(colour)
                o.set_position(x, y)
            self.show(o, k < len(spec["outlines"]))
        puff = self.sprite("puff")
        if spec["puff"] is not None:
            puff.set_position(*spec["puff"])
        self.show(puff, spec["puff"] is not None)
        door = self.sprite("exit")
        if door is not None:
            door.pixels[:, :] = door_face(spec["lit"])
            if spec["burst"]:
                burst = self.sprite("burst")
                dx, dy = rider_xy(lay.exit_at)
                burst.pixels[:, :] = burst_face(spec["burst"], (dx + CELL // 2, dy + CELL // 2))
            self.show(self.sprite("burst"), bool(spec["burst"]))
        rider = self.sprite("rider")
        rider.pixels[:, :] = rider_face(spec["face"], spec["shrink"], spec["red"])
        if spec["rider"] is not None:
            rider.set_position(*spec["rider"])
        self.show(rider, not spec["gone"])

    # ── what each action looks like ───────────────────────────────────────────

    def after_tick(self, prev, new, outcome, at, frames):
        """Frames for one resolved tick: the board after it, a flower the vine just reached
        opening in three frames, a taken flower's seed flying to the tray, and the fall."""
        face = self.facing
        stand = rider_xy(at)
        opened = bits(new.bloom[0] & self.lay.flowers & ~new.picked)
        taken = bits(new.picked & ~prev.picked)
        tray = new.seeds - len(taken)
        for phase in ((1, 2, 3) if opened else (3,)):
            frames.append(frame_spec(new, rider=stand, face=face, tray=tray,
                                     opening={i: phase for i in opened}))
        if taken:
            spots = [seed_at_spot(*cell_of(i)) for i in taken]
            midway = [lerp(spots[j], seed_at_slot(tray + j), 0.5) for j in range(len(taken))]
            frames.append(frame_spec(new, rider=stand, face=face, cores=tuple(spots), tray=tray))
            frames.append(frame_spec(new, rider=stand, face=face, cores=tuple(midway), tray=tray))
            frames.append(frame_spec(new, rider=stand, face=face, tray=new.seeds))
        if outcome == "fell":
            for size in (6, 4, 2):
                frames.append(frame_spec(new, rider=stand, face=face, shrink=size, red=True))

    def plan(self, move):
        """The outcome is decided here, once; the frames only show it. Returns
        (World after, outcome, frames, the cell the rider stood on when it ended)."""
        lay = self.lay
        pre = self.world
        frames = []
        if move[0] == "T":
            spots = []
            if pre.seeds > 0:
                spots = [cell_of(i) for i in bits(lay.spots & ~(live_of(pre.bloom) | pre.ash))]
            if spots:
                marks = tuple((q * CELL, r * CELL, cue_colour(lay, pre, q, r)) for q, r in spots[:6])
            else:
                marks = ((move[1] // CELL * CELL, BOARD_H, WHITE),)
            for _ in range(3):
                frames.append(self.settled(pre, outlines=marks))
            frames.append(self.settled(pre))
            return pre, "refused", frames, pre.at
        if move[0] == "S":
            _, q, r = move
            if not takes_seed(lay, pre, q, r):
                mark = ((q * CELL, r * CELL, cue_colour(lay, pre, q, r)),)
                for _ in range(3):
                    frames.append(self.settled(pre, outlines=mark))
                frames.append(self.settled(pre))
                return pre, "refused", frames, pre.at
            new, outcome, at = resolve(lay, pre, 0, 0, index_of(q, r))
            slot, spot = seed_at_slot(pre.seeds - 1), seed_at_spot(q, r)
            for t in (1 / 4, 2 / 4, 3 / 4, 1):
                frames.append(self.settled(pre, flyer=lerp(slot, spot, t), tray=pre.seeds - 1))
            self.after_tick(pre, new, outcome, at, frames)
            return new, outcome, frames, at
        dq, dr = move
        self.facing = (dq, dr)
        ticks = ride_ticks(lay, pre, dq, dr)
        prev = pre
        for new, outcome, at in ticks:
            x, y = rider_xy(prev.at)
            if at != prev.at:
                frames.append(frame_spec(prev, rider=(x + dq * 4, y + dr * 4), face=self.facing))
                self.after_tick(prev, new, outcome, at, frames)
            else:
                nudge = (x + dq * 2, y + dr * 2)
                frames.append(frame_spec(prev, rider=nudge, face=self.facing))
                before = len(frames)
                self.after_tick(prev, new, outcome, at, frames)
                frames[before] = dict(frames[before], rider=nudge)
                if outcome != "fell":
                    frames.append(self.settled(new))
            prev = new
        last, outcome, at = ticks[-1]
        return last, outcome, frames, at

    def win_frames(self, w):
        """The door lights from the bottom, the rider shrinks into it, sparks fly out in a
        widening ring. Long (about twenty frames) on levels one and two, short after."""
        long_run = self.level_index < 2
        lit_steps = (1, 2, 3, 4, 5) if long_run else (2, 5)
        shrink = (6, 4, 2) if long_run else (5, 2)
        sparks = tuple(range(1, 13)) if long_run else (1, 3, 5, 7, 9)
        frames = []
        for lit in lit_steps:
            frames.append(self.settled(w, lit=lit))
        for size in shrink:
            frames.append(frame_spec(w, rider=rider_xy(w.at), face=self.facing, shrink=size, lit=5))
        for stage in sparks:
            frames.append(frame_spec(w, gone=True, lit=5, burst=stage))
        return frames

    def death_frames(self, w, at, shrunk):
        """A short, visible death, about half a second: the rider goes red and shrinks where
        he stands (if a fall has not already done that) while the vine withers away, a puff,
        then the empty board holds for a moment."""
        frames = []
        stand = rider_xy(at)
        face = self.facing
        if not shrunk:
            for size in (CELL, 6, 4, 2):
                frames.append(frame_spec(w, rider=stand, face=face, red=True, shrink=size, shift=1))
        base = len(frames)
        for i in range(15 - base):
            frames.append(frame_spec(w, rider=stand, face=face, red=True, shrink=0, gone=True,
                                     shift=min(5, i + 2), puff=stand if i < 3 else None))
        return frames

    # ── input and the step loop ───────────────────────────────────────────────

    def read_move(self):
        heading = MOVES.get(self.action.id)
        if heading is not None:
            return heading
        if self.action.id != GameAction.ACTION6:
            return None
        data = self.action.data or {}
        x = min(FRAME - 1, max(0, int(data.get("x", 0))))
        y = min(FRAME - 1, max(0, int(data.get("y", 0))))
        hit = self.camera.display_to_grid(x, y)
        if hit is None:
            return ("T", x, y)
        gx, gy = hit
        if not (0 <= gx < FRAME and 0 <= gy < BOARD_H):
            return ("T", min(FRAME - 1, max(0, gx)), BOARD_H)
        return ("S", gx // CELL, gy // CELL)

    def step(self):
        if self.queue:
            self.play_next()
            return
        move = self.read_move()
        if move is None:
            self.queue = []
            self.complete_action()
            return
        new, outcome, frames, at = self.plan(move)
        self.world = new
        if outcome == "goal":
            frames += self.win_frames(new)
            frames[-1]["end"] = "next"
        elif outcome != "refused":
            lost = outcome == "fell" or not winnable(self.lay, new)
            if lost:
                frames += self.death_frames(new, at, outcome == "fell")
                frames[-1]["end"] = "death"
        self.queue = frames
        self.play_next()

    def play_next(self):
        spec = self.queue.pop(0)
        if spec["end"] == "death":
            self.queue = []
            self.restore()
            self.complete_action()
            return
        self.draw(spec)
        if self.queue:
            return
        if spec["end"] == "next":
            self.next_level()
        self.complete_action()
