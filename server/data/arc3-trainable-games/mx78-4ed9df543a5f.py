# Author: GPT 6.1 Sol
# Date: 25-October-2026
# PURPOSE: mx78 feedback revision: readable travellers and countable pack weights, a clear
# suspended balance gauge and shelf docks, with unlimited ACTION7 Undo and current-level
# RESET. The reviewed weight-times-distance rules and levels 3-9 are retained.
# SRP/DRY check: Pass - original rule/animation separation retained; shared sprite_book
# pixel_art, lantern and medallion primitives are inlined into this standalone source.
"""mx78: travellers balance a rigid gangway to meet the far shelves.

Left/right walks the traveller holding the lantern. ACTION5 passes that lantern along
position order. From level 4 the suspended lamp car moves once after each accepted input.
Pack bundles and body height both show traveller weight; the lantern shows selection.
The round slider moves one notch per unit of lean, with shelf alignments marked in gold.
ACTION7 reverses the whole previous input, including selection and car motion. RESET
retries the current level, retaining earlier progress. No action limit and no terminal loss.

Human follow-up to mx78@c21c4197d2cb: the second lesson now uses one heavy and two
identical light travellers already standing apart on the deck. Travellers stand apart visually when
sharing nearby panels; short colored foot braces meet their actual load contacts. Every
later weight rule and layout is retained. Rendering never decides legality.
"""

import numpy as np


from arcengine import ARCBaseGame, BlockingMode, Camera, GameAction, Level, Sprite


# --- shared art, inlined at packaging time ---
def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
    """A struck disc: bright rim, darker core. What a coin, token or gem should look
    like instead of a filled square."""
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for x in range(1, last):
        px[0][x] = px[last][x] = rim
    for y in range(1, last):
        px[y][0] = px[y][last] = rim
    for y in range(1, last):
        for x in range(1, last):
            px[y][x] = centre
    return px

def pixel_art(rows: tuple, colours: dict) -> list[list[int]]:
    """Letters to colour indices; '.' is -1, so the ground shows through."""
    return [[-1 if ch == "." else colours[ch] for ch in row] for row in rows]

def lantern(flame: int, frame_: int) -> list[list[int]]:
    """A hand lantern: a handle, a flame in a frame."""
    return pixel_art((".kk.", "kffk", "kffk", ".kk."), {"f": flame, "k": frame_})


SLOT = 4  # screen pixels per gangway panel (one unit of distance)
DECK = 26  # screen row of the gangway's walking surface at the pin
TRUSS = 5  # rows from the walking surface down to the bottom chord
TUBE = 3  # rows of the lean gauge, slung two rows under the deck
HANG = 13  # the gap between the bottom chord and the gauge
SWING = 8  # the tip rises or falls this many pixels at the level's biggest lean
STEPS = 3  # frames for a walk, a climb or a crossing
CAR_STEPS = 2  # frames for the lamp car's own step
X = -1  # transparent

# Colours (arcengine palette indices): cool steel over warm sandstone; gold marks alignment and selection.
BLACK, DARK, ROCK, ROCKLIT, WHITE, PALE, ICE, BLUE, PURPLE, LAMP = 5, 4, 13, 12, 0, 1, 10, 9, 15, 11

# Levels. w: traveller weights. shelves: the leans at which the tip meets each far shelf,
# highest shelf first. cars: (weight, first panel, last panel, start panel, heading).
LEVELS = [
    # 1. One traveller, eleven panels: walking out tips the gangway one notch a step, and the tip
    #    settles onto the shelf exactly as she reaches the end.
    {"n": 11, "p": 5, "back": 5, "front": 5, "shelves": [5], "w": [1], "cars": []},
    # 2. One heavy traveller between two light helpers. The left helper already
    #    counterbalances; move the right helper back before walking the heavy one out.
    {"n": 6, "p": 2, "back": 4, "front": 3, "shelves": [3], "w": [2, 1, 1], "cars": [], "start": [2, 0, 4]},
    # 3. A longer front arm: every step out there swings the lean further, so the light pair
    #    relay the heavy one out in stages and cross last themselves.
    {"n": 8, "p": 3, "back": 6, "front": 4, "shelves": [4], "w": [2, 1, 1], "cars": []},
    # 4. The same crossing, now with a lamp car running under the gangway on its own, one panel
    #    a turn: its weight moves whether you like it or not.
    {"n": 8, "p": 3, "back": 6, "front": 4, "shelves": [4], "w": [2, 1, 1], "cars": [(1, 0, 7, 0, 1)]},
    # 5. A porter of weight three and a heavier car on a short run: no partner balances the
    #    porter alone, and the car's swing decides when he can move at all.
    {"n": 7, "p": 3, "back": 6, "front": 4, "shelves": [3], "w": [3, 2, 1], "cars": [(2, 0, 4, 0, 1)]},
    # 6. Two shelves, high and low: they need different leans to step off, and neither shelf
    #    alone gets everybody across.
    {"n": 7, "p": 3, "back": 4, "front": 6, "shelves": [-1, 6], "w": [3, 2, 1], "cars": []},
    # 7. Everything at once on eight panels: two shelves, a car, two heavy travellers.
    {"n": 8, "p": 3, "back": 6, "front": 4, "shelves": [-3, 4], "w": [2, 2, 1], "cars": [(1, 0, 7, 0, 1)]},
    # 8. Four travellers on a short-tailed gangway, where the back stop bites first.
    {"n": 7, "p": 2, "back": 4, "front": 4, "shelves": [-3, 4], "w": [2, 2, 1, 1], "cars": [(1, 0, 6, 0, 1)]},
    # 9. Four travellers, three of them heavy: the car has to be caught in the right panel for
    #    every single crossing, at both shelves.
    {"n": 8, "p": 3, "back": 6, "front": 4, "shelves": [-3, 4], "w": [2, 2, 2, 1], "cars": [(1, 0, 7, 0, 1)]},
]


# ── geometry ──────────────────────────────────────────────────────────────────


def _drop(x: int, pin: int, scale: float, lean: float) -> int:
    """How far the gangway's surface at column x sits below its height at the pin."""
    return int(round(scale * lean * (x - pin)))


def _geometry(spec: dict) -> dict:
    """Screen positions for one level. The tip swings SWING pixels at the level's biggest lean,
    so every level reads at the same angle whatever its stops allow."""
    n, p = spec["n"], spec["p"]
    x0 = 24 - n  # leaves room for the waiting travellers on the left and the far rock on the right
    pin = x0 + p * SLOT + SLOT // 2
    tip = x0 + (n - 1) * SLOT + SLOT // 2
    scale = SWING / (max(spec["back"], spec["front"]) * (tip - pin))
    tube_w = 2 * (spec["back"] + spec["front"]) + 5
    margin = max(0, (tube_w - n * SLOT + 1) // 2)
    creak = 0.5  # the half notch a refused move creaks against a stop
    ends = (x0 - margin, x0 + n * SLOT - 1 + margin, pin - tube_w // 2, pin + tube_w // 2)
    drops = [_drop(x, pin, scale, lean) for x in ends
             for lean in (-spec["back"] - creak, spec["front"] + creak)]
    return {
        "x0": x0, "pin": pin, "tip": tip, "scale": scale,
        "up": -min(drops) + 1, "down": max(drops) + 1, "margin": margin, "tube_w": tube_w,
        # the back end comes to rest on the cliff top exactly at the back stop
        "cliff": DECK + _drop(x0, pin, scale, -spec["back"]) + TRUSS,
        "shelf_y": [DECK + _drop(tip, pin, scale, lean) for lean in spec["shelves"]],
        "rock": x0 + n * SLOT + 1,  # left edge of the far rock
    }


# ── pixel art ─────────────────────────────────────────────────────────────────


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]  # 4x4 ordered dither


def _sky(width: int, height: int) -> list[list[int]]:
    """Broad quiet night bands leave the moving figures and steelwork readable."""
    rows = [[BLACK] * width for _ in range(height)]
    for y in range(9, 13):
        rows[y] = [PURPLE if y < 11 else BLUE] * width
    for x, y in ((18, 3), (31, 5), (45, 2), (55, 6)):
        rows[y][x] = PALE
    return rows


def _moon(radius: int = 3) -> list[list[int]]:
    size = radius * 2 + 1
    rows = []
    for y in range(size):
        row = [PALE if (x - radius) ** 2 + (y - radius) ** 2 <= radius * radius + 1 else X for x in range(size)]
        rows.append(row)
    rows[1][2] = 2  # craters, so the moon reads as a body and not a dot
    rows[4][4] = 2
    return rows


def _ridge(width: int, height: int) -> list[list[int]]:
    """The far side of the gorge: a ridge line in purple, one silhouette."""
    tops = [((x * 5) % 17) for x in range(width)]
    tops = [(t if t < 9 else 17 - t) // 2 for t in tops]
    return [[PURPLE if y >= (height - 2 - tops[x]) else X for x in range(width)] for y in range(height)]


def _rock(width: int, height: int, lit_top: bool = True, notch: int = 0) -> list[list[int]]:
    """Layered rock: a dark body, dark strata every nine rows, a lit top edge, and a face that
    steps in and out a pixel or two instead of ruling straight down."""
    rows = []
    for y in range(height):
        row = [DARK if y % 9 == 8 else ROCK for x in range(width)]
        if notch:
            cut = (y // 3 + y // 7) % 3  # a stepped rock face, the same every time
            for x in range(min(cut, width)):
                row[x if notch > 0 else width - 1 - x] = X
        rows.append(row)
    if lit_top and height:
        rows[0] = [ROCKLIT] * width
    return rows


def _gangway(n: int, geo: dict, lean: float, shelves: list[int], back: int, front: int) -> list[list[int]]:
    """The gangway as one rigid piece: a steel truss turned about its pin, with the lean gauge
    bolted under the deck. Every column carries the same pattern, set at the row the straight
    line puts it, so the whole thing turns together."""
    margin, x0, pin = geo["margin"], geo["x0"], geo["pin"]
    width = n * SLOT + 2 * margin
    height = geo["up"] + geo["down"] + TRUSS + HANG + TUBE + 1
    grid = [[X] * width for _ in range(height)]
    for i in range(n * SLOT):
        x = x0 + i
        top = geo["up"] + _drop(x, pin, geo["scale"], lean)
        col = i + margin
        grid[top][col] = ICE  # walking surface
        grid[top + TRUSS - 1][col] = ICE  # bottom chord
        if i % SLOT == 0:  # a post at every panel joint, with a white node on the surface
            grid[top][col] = WHITE
            for r in range(1, TRUSS - 1):
                grid[top + r][col] = BLUE
        else:  # one diagonal per panel, so the panels can be counted
            grid[top + TRUSS - 1 - (i % SLOT)][col] = BLUE
    # the gauge: a tube of marks centred on the pin, one mark per notch of lean
    left = pin - geo["tube_w"] // 2
    for i in range(geo["tube_w"]):
        x = left + i
        col = x - x0 + margin
        if not 0 <= col < width:
            continue
        top = geo["up"] + _drop(x, pin, geo["scale"], lean) + TRUSS + HANG
        if i in (1, geo["tube_w"] - 2):
            for hanger in range(1, HANG):
                grid[top - HANG + hanger][col] = DARK
        grid[top][col] = PALE
        grid[top + 1][col] = DARK
        grid[top + 2][col] = ROCK
        if i in (0, geo["tube_w"] - 1):  # the buffers at each end of the run
            for r in range(TUBE):
                grid[top + r][col] = ROCKLIT
        elif (i - 2) % 2 == 0 and 2 <= i <= geo["tube_w"] - 3:
            notch = (i - 2) // 2 - back
            grid[top + 2][col] = LAMP if notch in shelves else ICE
    return grid


def _traveller(weight: int, lit: bool, coat: int = ICE) -> list[list[int]]:
    """A face, coat, split boots and a pack of one clearly separated bundle per weight.

    The lantern lives in reserved headroom, so a selection change never changes the
    figure's height or foot position. Its fixed pose translates intact during movement.
    """
    rows = [".....", ".....", ".....", "..ss.", "ppcc."]
    for _ in range(weight):
        rows.extend(("ppcc.", "ddcc."))
    rows.extend((".c.c.", ".b.b."))
    pixels = pixel_art(tuple(rows), {"s": WHITE, "p": PALE, "c": coat, "d": DARK, "b": ROCKLIT})
    if lit:
        for row, pattern in enumerate(("...h.", "..hfh", "...h.")):
            for col, mark in enumerate(pattern):
                if mark != ".":
                    pixels[row][col] = LAMP if mark == "f" else WHITE
        pixels[3][4] = WHITE
    return pixels


def _car(weight: int) -> list[list[int]]:
    """Wheels on the lower chord, a thin hanger and countable stone bundles above its lamp."""
    rows = ["o.o.o", ".sss.", "..s..", "..s..", "..s..", "..s.."]
    for _ in range(weight):
        rows.extend((".ppp.", "pdpdp"))
    rows.append(".lll.")
    return pixel_art(tuple(rows), {"o": WHITE, "s": PALE, "p": ICE, "d": BLUE, "l": LAMP})


def _ball() -> list[list[int]]:
    return medallion(WHITE, ICE, 3)


def _plank() -> list[list[int]]:
    return [[WHITE, LAMP, WHITE], [ROCKLIT, PALE, ROCKLIT]]


def _ladder(height: int) -> list[list[int]]:
    return [[PALE, PALE, PALE] if y % 2 else [PALE, X, PALE] for y in range(height)]


def _beacon() -> list[list[int]]:
    return lantern(LAMP, PALE) + [[X, PALE, PALE, X], [X, PALE, PALE, X]]


def _landing(aligned: bool) -> list[list[int]]:
    """The same solid shelf nose in both states; gold appears only when a plank meets it."""
    cap = LAMP if aligned else PALE
    return [[cap] * 5, [ROCKLIT] * 4 + [ROCK], [X, ROCK, ROCK, ROCK, ROCK]]


def _pebble() -> list[list[int]]:
    return [[ROCKLIT]]


# ── level construction ────────────────────────────────────────────────────────


def _build(index: int, spec: dict) -> Level:
    geo = _geometry(spec)
    n = spec["n"]
    cliff, rock_x, shelf_y = geo["cliff"], geo["rock"], geo["shelf_y"]
    low, high = max(shelf_y), min(shelf_y)
    deep = cliff + 4  # where the gorge goes dark
    sprites = [
        Sprite(_sky(64, 64), name="sky", x=0, y=0, layer=0, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
        Sprite(_moon(), name="moon", x=5, y=2, layer=1, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
        Sprite(_ridge(64, 5), name="ridge", x=0, y=deep - 1, layer=1, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
        Sprite([[BLACK] * 64 for _ in range(64 - deep)], name="gorge", x=0, y=deep, layer=2, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
        Sprite([[ICE if (x + y) % 4 == 0 else BLUE for x in range(64)] for y in range(2)], name="river", x=0, y=62, layer=3, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
        Sprite(_rock(geo["pin"] + 2, 64 - cliff, notch=-1), name="cliff", x=0, y=cliff, layer=4, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
        Sprite(_rock(64 - rock_x, 64 - low, notch=1), name="rock", x=rock_x, y=low, layer=4, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]),
    ]
    for j, y in enumerate(shelf_y):
        if y != low:  # a second shelf: an overhang above the lower one, with a lip at the tip
            sprites.append(Sprite(_rock(64 - rock_x - 5, 3), name=f"shelf-{j}", x=rock_x + 5, y=y, layer=4, blocking=BlockingMode.NOT_BLOCKED, tags=["shelf"]))
            sprites.append(Sprite([[ROCKLIT] * 5], name=f"lip-{j}", x=rock_x, y=y, layer=4, blocking=BlockingMode.NOT_BLOCKED, tags=["shelf"]))
        sprites.append(Sprite(_landing(False), name=f"landing-{j}", x=rock_x, y=y, layer=6, blocking=BlockingMode.NOT_BLOCKED, tags=["shelf"]))
        sprites.append(Sprite(_plank(), name=f"plank-{j}", x=rock_x - 3, y=y - 1, layer=7, visible=False, blocking=BlockingMode.NOT_BLOCKED, tags=["shelf"]))
    sprites.append(Sprite(_beacon(), name="beacon", x=60, y=max(0, high - 6), layer=5, blocking=BlockingMode.NOT_BLOCKED, tags=["goal"]))
    if spec["front"] > max(spec["shelves"]):  # a rock knob is the front stop when no shelf is
        knob = DECK + _drop(geo["tip"], geo["pin"], geo["scale"], spec["front"]) + TRUSS
        sprites.append(Sprite(_rock(5, 64 - knob), name="knob", x=rock_x - 1, y=knob, layer=5, blocking=BlockingMode.NOT_BLOCKED, tags=["stop"]))
    sprites.append(Sprite(_ladder(max(2, cliff - DECK)), name="ladder", x=geo["x0"] - 3, y=DECK, layer=5, blocking=BlockingMode.NOT_BLOCKED, tags=["ladder"]))
    sprites.append(Sprite(_gangway(n, geo, 0, spec["shelves"], spec["back"], spec["front"]), name="gangway",
                          x=geo["x0"] - geo["margin"], y=DECK - geo["up"], layer=6, blocking=BlockingMode.NOT_BLOCKED, tags=["gangway"]))
    sprites.append(Sprite(medallion(ROCKLIT, WHITE, 4), name="pin", x=geo["pin"] - 1, y=DECK + TRUSS, layer=7, blocking=BlockingMode.NOT_BLOCKED, tags=["gangway"]))
    sprites.append(Sprite(_ball(), name="ball", x=geo["pin"], y=DECK + TRUSS + 1, layer=8, blocking=BlockingMode.NOT_BLOCKED, tags=["gauge"]))
    sprites.append(Sprite(_pebble(), name="pebble", x=0, y=0, layer=9, visible=False, blocking=BlockingMode.NOT_BLOCKED, tags=["scenery"]))
    for j, car in enumerate(spec["cars"]):
        sprites.append(Sprite(_car(car[0]), name=f"car-{j}", x=0, y=0, layer=8, blocking=BlockingMode.NOT_BLOCKED, tags=["car"]))
    for i, weight in enumerate(spec["w"]):
        sprites.append(Sprite([[X]], name=f"contact-{i}", x=0, y=0, layer=9, blocking=BlockingMode.NOT_BLOCKED, tags=["load-contact"]))
        sprites.append(Sprite(_traveller(weight, i == 0, (ICE, 7, 14, 1)[i]), name=f"walker-{i}", x=0, y=0, layer=9, blocking=BlockingMode.NOT_BLOCKED, tags=["traveller"]))
    data = {
        "n": n, "p": spec["p"], "back": spec["back"], "front": spec["front"],
        "shelves": list(spec["shelves"]), "w": list(spec["w"]),
        "cars": [list(c) for c in spec["cars"]], "geo": geo,
        "start": list(spec.get("start", [-1] * len(spec["w"]))),
    }
    return Level(sprites=sprites, name=f"level-{index + 1}", data=data)


class Mx78(ARCBaseGame):
    def __init__(self) -> None:
        self.n = self.p = self.back = self.front = 0
        self.shelves: list[int] = []
        self.weights: list[int] = []
        self.pos: list[int] = []  # -1 home, 0..n-1 panels, n+j far shelf j
        self.cars: list[list[int]] = []  # weight, first, last, panel, heading
        self.lit = 0
        self.history: list[tuple] = []
        self.geo: dict = {}
        self.plan: list[dict] = []
        self.finish = False
        self.spr: dict[str, Sprite] = {}
        super().__init__(
            game_id="mx78",
            levels=[_build(i, spec) for i, spec in enumerate(LEVELS)],
            camera=Camera(background=BLACK, letter_box=BLACK),
            available_actions=[3, 4, 5, 7],
        )

    # ── rule state ────────────────────────────────────────────────────────────

    def on_set_level(self, level: Level) -> None:
        self.n = level.get_data("n")
        self.p = level.get_data("p")
        self.back = level.get_data("back")
        self.front = level.get_data("front")
        self.shelves = list(level.get_data("shelves"))
        self.weights = list(level.get_data("w"))
        self.cars = [list(c) for c in level.get_data("cars")]
        self.geo = dict(level.get_data("geo"))
        self.pos = list(level.get_data("start"))
        self.lit = 0
        self.history = []
        self.plan = []
        self.finish = False
        self.spr = {s.name: s for s in level.get_sprites()}
        self._show(self._frame())

    def _lean(self, pos: list[int] | None = None, cars: list[list[int]] | None = None) -> int:
        pos = self.pos if pos is None else pos
        cars = self.cars if cars is None else cars
        total = 0
        for weight, slot in zip(self.weights, pos):
            if 0 <= slot < self.n:
                total += weight * (slot - self.p)
        for car in cars:
            total += car[0] * (car[3] - self.p)
        return total

    def _legal(self, lean: int) -> bool:
        return -self.back <= lean <= self.front

    def _flush(self, lean: int) -> int:
        for j, value in enumerate(self.shelves):
            if value == lean:
                return j
        return -1

    def _order(self) -> list[int]:
        return sorted(range(len(self.pos)), key=lambda i: (self.pos[i], i))

    # ── actions: settle the rules once, then only show them ───────────────────

    def handle_reset(self) -> None:
        # Engine default can reset the whole run on a second R at a new level. Every R
        # here retries only the current level, including before any move at that level.
        self.level_reset()

    def step(self) -> None:
        if self.action.id == GameAction.RESET:  # the engine calls step() once for RESET too
            self.complete_action()
            return
        if not self.plan:
            if self.action.id == GameAction.ACTION7:
                if self.history:
                    positions, cars, selected = self.history.pop()
                    self.pos = list(positions)
                    self.cars = [list(car) for car in cars]
                    self.lit = selected
                self.plan = [self._frame(bob=1), self._frame()]
                self.finish = False
            else:
                self.history.append((tuple(self.pos), tuple(tuple(car) for car in self.cars), self.lit))
                self._decide(self.action.id)
        self._show(self.plan.pop(0))
        if not self.plan:
            if self.finish and all(s >= self.n for s in self.pos):
                self.next_level()
            self.finish = False
            self.complete_action()

    def _decide(self, action: GameAction) -> None:
        if action == GameAction.ACTION5:  # pass the lantern along the line
            order = self._order()
            self.lit = order[(order.index(self.lit) + 1) % len(order)]
            self.plan = [self._frame(bob=1), self._frame()]
            self._add_car_frames()
            return
        walker = self.lit
        here = self.pos[walker]
        step = -1 if action == GameAction.ACTION3 else 1
        lean = self._lean()
        target = here + step
        if (here == -1 and step < 0) or (here >= self.n and step > 0):
            self.plan = self._refuse(walker, step, 0)  # the ends of the line
            return
        if here >= self.n:  # stepping back onto the tip from a shelf
            if self.shelves[here - self.n] != lean:
                self.plan = self._refuse(walker, step, 0)
                return
            target = self.n - 1
        elif here == self.n - 1 and step > 0:  # crossing from the tip to a shelf
            shelf = self._flush(lean)
            if shelf < 0:
                self.plan = self._refuse(walker, step, 0)
                return
            target = self.n + shelf
        moved = list(self.pos)
        moved[walker] = target
        new_lean = self._lean(moved)
        if not self._legal(new_lean):
            self.plan = self._refuse(walker, step, 1 if new_lean > self.front else -1)
            return
        self.pos = moved
        self.plan = self._walk_frames(walker, here, target, lean, new_lean)
        self.finish = target >= self.n
        self._add_car_frames()

    def _refuse(self, walker: int, step: int, stop: int) -> list[dict]:
        """A refused move: a one-pixel nudge that settles back. When a stop refused it, the
        gangway creaks against that stop and a pebble drops from it. Nothing else changes."""
        creak = 0.45 * stop
        return [
            self._frame(nudge=(walker, step), creak=creak, pebble=stop),
            self._frame(nudge=(walker, 0), creak=creak / 2, pebble=stop, pebble_fall=1),
            self._frame(),
        ]

    def _walk_frames(self, walker: int, here: int, target: int, lean: int, new_lean: int) -> list[dict]:
        # A compact group makes room as one intact set of figures. Interpolate every
        # figure, not just the walker, so joining/leaving a shared panel cannot teleport
        # somebody's silhouette. Colored foot braces still meet exact rule coordinates.
        old_positions = list(self.pos)
        old_positions[walker] = here
        before = self._layout(old_positions, lean)
        after = self._layout(self.pos, new_lean)
        frames = []
        on_deck = 0 <= here < self.n and 0 <= target < self.n
        for k in range(1, STEPS + 1):
            fraction = k / STEPS
            part = lean + (new_lean - lean) * fraction
            poses = []
            for index, (first, last) in enumerate(zip(before, after)):
                pose = [int(round(a + (b - a) * fraction)) for a, b in zip(first[:4], last[:4])]
                stays_on_deck = (on_deck if index == walker else 0 <= self.pos[index] < self.n)
                if stays_on_deck:
                    pose[3] = self._surface(pose[2] - 2, part)
                    first_lift = first[3] - first[1] - self._height(index)
                    last_lift = last[3] - last[1] - self._height(index)
                    lift = int(round(first_lift + (last_lift - first_lift) * fraction))
                    pose[1] = pose[3] - self._height(index) - lift
                if index == walker and k < STEPS and not on_deck:
                    pose[1] -= 2
                pose.append(first[4] or last[4])
                poses.append(pose)
            frames.append(self._frame(lean=part, poses=poses))
        frames.append(self._frame())
        return frames

    def _add_car_frames(self) -> None:
        """After an accepted action every lamp car takes its own step, or waits where a stop
        blocks it. Its frames follow the walker's, so each change is attributable."""
        if not self.cars:
            return
        before = [list(c) for c in self.cars]
        for index, car in enumerate(self.cars):
            weight, first, last, panel, heading = car
            if panel + heading > last or panel + heading < first:
                heading = -heading
            trial = [list(c) for c in self.cars]
            trial[index] = [weight, first, last, panel + heading, heading]
            if self._legal(self._lean(cars=trial)):
                car[3] = panel + heading
            car[4] = heading
        if all(b[3] == c[3] for b, c in zip(before, self.cars)):
            self.plan += [self._frame(waiting=True), self._frame()]  # it strains and stays put
            return
        lean, new_lean = self._lean(cars=before), self._lean()
        for k in range(1, CAR_STEPS + 1):
            part = lean + (new_lean - lean) * k / CAR_STEPS
            slide = [b[3] + (c[3] - b[3]) * k / CAR_STEPS for b, c in zip(before, self.cars)]
            self.plan.append(self._frame(lean=part, cars=slide))
        self.plan.append(self._frame())

    # ── presentation ──────────────────────────────────────────────────────────

    def _height(self, walker: int) -> int:
        return 7 + 2 * self.weights[walker]  # fixed lantern headroom, pack bundles and split boots

    def _surface(self, x: float, lean: float) -> int:
        return DECK + _drop(int(round(x)) + 1, self.geo["pin"], self.geo["scale"], lean)

    def _panel_x(self, slot: int) -> int:
        return self.geo["x0"] + slot * SLOT

    def _anchor_spot(self, walker: int, slot: int, lean: float) -> tuple[int, int]:
        """Exact load position; a decorative offset must never move this contact."""
        if slot == -1:
            # Four-pixel coats fit this pitch; unlike the earlier clamped queue, no
            # two waiting travellers collapse to the same left-edge position.
            if len(self.pos) <= 3:
                x = max(1, self.geo["x0"] - 5 - 5 * walker)
            else:
                x = max(13, self.geo["x0"] - 4) - 4 * walker
            return x, self.geo["cliff"] - self._height(walker)
        if slot >= self.n:
            x = min(self.geo["rock"] + 1 + 4 * walker, 59)
            return x, self.geo["shelf_y"][slot - self.n] - self._height(walker)
        x = self._panel_x(slot)
        return x, self._surface(x, lean) - self._height(walker)

    def _layout(self, positions: list[int], lean: float) -> list[list[int]]:
        """Separate nearby coats while keeping every colored foot brace at its true panel.

        The slightly raised braces are presentation, with no collision or extra weight.
        The fan stays inside the scene and uses no title, count glyph or control symbol.
        """
        poses = []
        for walker, slot in enumerate(positions):
            x, y = self._anchor_spot(walker, slot, lean)
            poses.append([x, y, x + 2, y + self._height(walker), 0])
        deck = sorted((self._panel_x(slot), walker) for walker, slot in enumerate(positions) if 0 <= slot < self.n)
        groups = []
        for item in deck:
            if not groups or item[0] - groups[-1][-1][0] >= 5:
                groups.append([item])
            else:
                groups[-1].append(item)
        # A crowded group can extend toward a neighbour. Merge until the expanded
        # silhouettes also have a real five-pixel gap; raw panel distance alone is
        # insufficient when three or four people share a contact.
        while True:
            merged = False
            for index in range(len(groups) - 1):
                first, second = groups[index], groups[index + 1]
                right = sum(item[0] for item in first) / len(first) + (len(first) - 1) * 2.5
                left = sum(item[0] for item in second) / len(second) - (len(second) - 1) * 2.5
                if left - right < 5:
                    groups[index:index + 2] = [first + second]
                    merged = True
                    break
            if not merged:
                break
        for group in groups:
            if len(group) < 2:
                continue
            center = sum(item[0] for item in group) / len(group)
            left = int(round(center - (len(group) - 1) * 2.5))
            for rank, (_, walker) in enumerate(group):
                x = left + rank * 5
                poses[walker][0] = x
                poses[walker][1] -= 3
                poses[walker][4] = 1
        return poses

    def _spot(self, walker: int, slot: int, lean: float) -> tuple[int, int]:
        positions = list(self.pos)
        positions[walker] = slot
        pose = self._layout(positions, lean)[walker]
        return pose[0], pose[1]

    def _contact(self, walker: int, x: int, y: int, contact_x: int, contact_y: int, visible: bool) -> None:
        """Short physical foot brace, plus its actual two-pixel contact on the gangway."""
        sprite = self.spr[f"contact-{walker}"]
        sprite.set_visible(visible)
        if not visible:
            return
        foot_x, foot_y = x + 2, y + self._height(walker)
        left, top = min(foot_x, contact_x), min(foot_y, contact_y)
        width, height = abs(foot_x - contact_x) + 2, abs(foot_y - contact_y) + 1
        pixels = [[X] * width for _ in range(height)]
        count = max(abs(foot_x - contact_x), abs(foot_y - contact_y), 1)
        coat = (ICE, 7, 14, 1)[walker]
        for step in range(count + 1):
            px = int(round(foot_x + (contact_x - foot_x) * step / count)) - left
            py = int(round(foot_y + (contact_y - foot_y) * step / count)) - top
            pixels[py][px] = coat
        for dx in (0, 1):
            pixels[contact_y - top][contact_x - left + dx] = LAMP if walker == self.lit else coat
        sprite.pixels = _grid(pixels)
        sprite.set_position(left, top)

    def _frame(self, lean: float | None = None, carry: tuple[int, int, int] | None = None,
               cars: list[float] | None = None, nudge: tuple[int, int] = (-1, 0), creak: float = 0.0,
               pebble: int = 0, pebble_fall: int = 0, bob: int = 0, waiting: bool = False,
               poses: list[list[int]] | None = None) -> dict:
        return {"lean": self._lean() if lean is None else lean, "carry": carry, "cars": cars,
                "nudge": nudge, "creak": creak, "pebble": pebble, "pebble_fall": pebble_fall,
                "bob": bob, "waiting": waiting, "poses": poses}

    def _show(self, frame: dict) -> None:
        geo, spr = self.geo, self.spr
        lean = frame["lean"] + frame["creak"]
        settled = int(round(frame["lean"]))
        spr["gangway"].pixels = _grid(_gangway(self.n, geo, lean, self.shelves, self.back, self.front))
        # the gauge ball rolls to the low side, one mark per notch
        ball_x = geo["pin"] - geo["tube_w"] // 2 + 2 + 2 * (self.back + settled)
        spr["ball"].set_position(ball_x, self._surface(ball_x - 1, lean) + TRUSS + HANG)
        # the hinged plank falls across wherever the tip lines up with a shelf
        flush = self._flush(settled) if abs(lean - settled) < 0.001 else -1
        for j in range(len(self.shelves)):
            spr[f"plank-{j}"].set_visible(j == flush)
            spr[f"landing-{j}"].pixels = _grid(_landing(j == flush))
        car_slots = frame["cars"] or [float(c[3]) for c in self.cars]
        for j, slot in enumerate(car_slots):
            x = self._panel_x(0) + slot * SLOT
            spr[f"car-{j}"].set_position(int(round(x)) + (1 if frame["waiting"] else 0), self._surface(x, lean) + TRUSS)
        poses = frame["poses"] if frame["poses"] is not None else self._layout(self.pos, lean)
        for i, pose in enumerate(poses):
            sprite = spr[f"walker-{i}"]
            sprite.set_layer(22 if i == self.lit else 10 + i)
            sprite.pixels = _grid(_traveller(self.weights[i], i == self.lit, (ICE, 7, 14, 1)[i]))
            x, y, contact_x, contact_y, braced = pose
            x += frame["nudge"][1] if frame["nudge"][0] == i else 0
            y -= 1 if frame["bob"] and i == self.lit else 0
            sprite.set_position(x, y)
            self._contact(i, x, y, contact_x, contact_y, bool(braced))
        pebble = spr["pebble"]
        pebble.set_visible(bool(frame["pebble"]))
        if frame["pebble"] > 0:
            x = geo["rock"]
            y = DECK + _drop(geo["tip"], geo["pin"], geo["scale"], self.front) + TRUSS
        else:
            x, y = geo["pin"] + 2, geo["cliff"]
        pebble.set_position(x, y + 3 * frame["pebble_fall"])


def _grid(rows: list[list[int]]) -> np.ndarray:
    return np.array(rows, dtype=np.int8)
