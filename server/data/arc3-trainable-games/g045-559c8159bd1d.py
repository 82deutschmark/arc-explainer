# ARC-AGI-3 candidate task g045.
#
# Author: Claude Opus 5.5 High (art pass and fixes), on Codex (GPT-6)'s game
# Date: 21-October-2026
# PURPOSE: One self-contained game file for the Games page. The harbour is drawn as named
#   sprites: blue water, yellow sand islands, a small black figure with eyes, wooden crates,
#   a moored boat that fills as crates are gathered, coloured round mouths, plank bridges,
#   lamps along the top and a burning wick for the moves left.
# SRP/DRY check: Pass -- the rule functions (links, lock_open, cell_walkable, the board
#   helpers) are the ones the verifier imports; drawing lives only in build_levels, _sync
#   and the Lamps interface.
#
# CHANGELOG
# 21-Oct-2026, Claude Opus 5.5 High: the Boss's review ("wasn't very clear to me what to do,
#   could use a glow-up"). Art: every thing on screen is a named sprite; cells are five
#   pixels so the whole board height fits under the lamp strip and the camera only pans
#   sideways; the goal is a boat whose deck fills with each crate collected and whose sail
#   goes up when the last one is aboard. Fixes: running out of moves on a later level no
#   longer lets the next RESET throw the player back to level one; level one is a few
#   moves longer (its crate and boat sit further apart) and starts where the far island
#   is in view. Rules, inputs and levels two to
#   seven are unchanged.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    RenderableUserDisplay,
    Sprite,
)


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


# ── palette ────────────────────────────────────────────────────────────────────
# 0 White 1 LtGray 2 Gray 3 DkGray 4 DarkerGray 5 Black 6 Pink 7 LtPink 8 Red 9 Blue
# 10 LtBlue 11 Yellow 12 Orange 13 Maroon 14 Green 15 Purple
# The house look: two flat fields (blue water, yellow sand) and strong things on them.
# The four mouth colours are kept off everything else that matters, so a mouth is
# identifiable at a glance; pink stays out (pink means "sends you back" in this set).
WATER = 9          # Blue. Open water and every impassable cell.
SAND = 11          # Yellow. Walkable island.
INK = 5            # Black. The figure, the mast, the mouths' holes, the sky strip.
EYE = 0            # White. The figure's eyes.
WOOD = 13          # Maroon. Crates, the boat's hull, bridges.
CARGO_C = 12       # Orange. Crate faces, and crates once they are on the boat's deck.
SAIL = 11          # Yellow. The sail goes up when every crate is aboard.
GLINT = 10         # LtBlue. Inert sparkle on the water.
PIP = 1            # LtGray. Waiting dots in an idle mouth; the link between lit lamps.
DIM = 3            # DkGray. A lamp beat that is not now.
WICK = 2           # Gray. The wick that is left.
SPARK = 8          # Red. The flame on the wick: run it out and the level starts over.

SLIP = {"A": 10, "B": 14, "C": 15, "D": 0}

W, H = 20, 13
CELL = 5
VIEW = 64
BAND = 8           # the lamp strip across the top of the screen
Y0 = 3             # world y of board row 0; row 0 is open water and sits under the strip

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}

BASE_CYCLE = (("A", "B"), ("B", "C"), ("C", "A"))
ODD_ONE_OUT = ("C", "A", "B")


def links(present: frozenset, tick: int) -> dict:
    out: dict = {}
    a, b = BASE_CYCLE[tick % 3]
    if a in present and b in present:
        out[a] = b
        out[b] = a
    if "D" in present and tick % 4 == 0:
        odd = ODD_ONE_OUT[tick % 3]
        if odd in present:
            out["D"] = odd
            out[odd] = "D"
    return out


def lock_open(spec: dict, tick: int) -> bool:
    beat = spec.get("lock_beat")
    return beat is not None and tick % 3 == beat


def slips_present(rows) -> frozenset:
    return frozenset(c for row in rows for c in row if c in SLIP)


def slip_positions(rows) -> dict:
    return {c: (x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c in SLIP}


def find_char(rows, target) -> tuple:
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == target:
                return x, y
    raise AssertionError(f"board has no {target}")


def find_all(rows, target) -> set:
    return {(x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c == target}


def cell_walkable(spec: dict, x: int, y: int, tick: int) -> bool:
    rows = spec["rows"]
    if not (0 <= x < W and 0 <= y < H):
        return False
    ch = rows[y][x]
    if ch == " ":
        return False
    if ch == "s":
        return lock_open(spec, tick)
    return ch != "X"


LEVELS_SPEC = [
    {"budget": 28, "lock_beat": None, "needs": ("slips",), "rows": [
        "                    ",
        "   .......          ",
        "  .........  .......",
        "  .........  .......",
        "  ...A.....  .B.....",
        "  .........  .......",
        "  ........P  ...c...",
        "  .........  .......",
        "   ........  .....X.",
        "    ......   .......",
        "             .......",
        "              ....  ",
        "                    ",
    ]},
    {"budget": 34, "lock_beat": None, "needs": ("slips", "return"), "rows": [
        "                    ",
        "    ......          ",
        "   ........   ......",
        "  .........  .......",
        "  ....A....  ..B....",
        "  .........  .......",
        "  .........  .......",
        "  ...X.....  .......",
        "   ........  ....c..",
        "    ..P....   ......",
        "     ......    .....",
        "                    ",
        "                    ",
    ]},
    {"budget": 38, "lock_beat": None, "needs": ("slips", "return", "residues"), "rows": [
        "                    ",
        " .....  .....       ",
        " .....  .....  .....",
        " ..A..  ..B..  .....",
        " .....  .....  .....",
        " .....  ..c..  ..C..",
        " ..P..  .....  .....",
        " .....  .....  .....",
        " .....  .....  ..c..",
        " .....  .....  .....",
        " ..X..  .....       ",
        " .....              ",
        "                    ",
    ]},
    {"budget": 42, "lock_beat": 1,
     "needs": ("slips", "return", "residues", "lock"), "rows": [
        "                    ",
        " ......  .....      ",
        " ..A...  ..B..      ",
        " ......  .....  ....",
        " ......  .....  ....",
        " ......  .....  ..C.",
        " ..P...    s    ....",
        " ......  .....  ..c.",
        " ......  .....  ....",
        " ......  ..c..      ",
        " ..X...  .....      ",
        " ......  .....      ",
        "                    ",
    ]},
    {"budget": 30, "lock_beat": None,
     "needs": ("slips", "return", "residues", "order"), "rows": [
        "                    ",
        "  ......X.          ",
        "  ..A.....          ",
        "  ........    ......",
        "  ...c....    ..B...",
        "  .P......    ......",
        "              ...c..",
        "     ......   ......",
        "     ..C...   ......",
        "     ......         ",
        "     ..c...         ",
        "     ......         ",
        "                    ",
    ]},
    {"budget": 28, "lock_beat": None,
     "needs": ("slips", "return", "residues", "fourth", "bump"), "rows": [
        "                    ",
        "  .......  ........ ",
        "  ...A...  ....B... ",
        "  .......  ........ ",
        "  .......  ........ ",
        "  ..P....  ....c... ",
        "                    ",
        "  .......  ........ ",
        "  ...C...  ....D... ",
        "  .......  ........ ",
        "  ...c...  ...X.... ",
        "  .......  ........ ",
        "                    ",
    ]},
    {"budget": 40, "lock_beat": 0,
     "needs": ("slips", "return", "residues", "lock", "fourth", "bump", "order"),
     "rows": [
        "                    ",
        "  ......   ........ ",
        "  ...A..   ....B... ",
        "  ......      s     ",
        "  ...c..   ......c. ",
        "  ..P...   ........ ",
        "                    ",
        "   .....   ........ ",
        "   ..C..   ....D... ",
        "   .....   ........ ",
        "   ..X..   ..c..... ",
        "   .....   ........ ",
        "                    ",
    ]},
]


# ── the drawing ────────────────────────────────────────────────────────────────
# Every thing is a named Sprite, CELL x CELL, placed at its cell. "#" is the art's own
# colour, "." is transparent so the ground shows through.

def art(rows, colours) -> np.ndarray:
    return np.array([[colours.get(c, -1) for c in row] for row in rows], dtype=np.int8)


FIGURE = (".###.",
          "#####",
          "#####",
          ".###.",
          ".#.#.")
# where the two eyes sit for each way the figure last stepped (row, col)
EYES = {"down": ((1, 1), (1, 3)), "left": ((1, 0), (1, 2)),
        "right": ((1, 2), (1, 4)), "up": ((0, 1), (0, 3))}
CRATE_ART = ("MMMMM",
             "MOMOM",
             "MMOMM",
             "MOMOM",
             "MMMMM")
BOAT = ("..k..",
        "..k..",
        ".....",
        "MMMMM",
        ".MMM.")
SAIL_UP = ((0, 3), (1, 3), (1, 4))
DECK_SLOTS = ((2, 0), (2, 4), (2, 1), (2, 3))   # where crates sit on deck, in order


def cell_xy(x: int, y: int) -> tuple:
    return x * CELL, Y0 + y * CELL


def water_cells(rows) -> list:
    """Open-water cells, water all round where possible, in reading order (for inert glints)."""
    out = []
    for reach in ((-1, 0, 1), (0,)):     # prefer open water; narrow straits if there is none
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if all(rows[y + dy][x + dx] == " " for dx in reach for dy in reach):
                    out.append((x, y))
        if len(out) >= 4:
            return out
    return out


def ground_pixels(rows) -> np.ndarray:
    px = np.full((Y0 + H * CELL, W * CELL), WATER, dtype=np.int8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in " sX":      # bridges and the boat's mooring sit on water
                continue
            sx, sy = cell_xy(x, y)
            px[sy:sy + CELL, sx:sx + CELL] = SAND
    return px


def bridge_runs_across(rows, x: int, y: int) -> bool:
    return 0 < x < W - 1 and rows[y][x - 1] not in " " and rows[y][x + 1] not in " "


def bridge_pixels(across: bool, down: bool) -> np.ndarray:
    px = np.full((CELL, CELL), -1, dtype=np.int8)
    if down:
        px[1:4, :] = WOOD
        px[2, 1] = px[2, 3] = INK          # plank seams
    else:
        px[1, 0] = px[3, 0] = px[1, 4] = px[3, 4] = WOOD   # the posts, deck raised
    return px if across else px.T.copy()


def build_levels() -> list:
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        pieces = [Sprite(pixels=ground_pixels(rows), name="ground",
                         blocking=BlockingMode.NOT_BLOCKED,
                         interaction=InteractionMode.TANGIBLE, layer=-2).set_position(0, 0)]
        wet = water_cells(rows)
        for i in range(4):
            x, y = wet[(i * 7 + 3) * len(wet) // 28]
            pieces.append(Sprite(pixels=np.full((CELL, CELL), -1, dtype=np.int8),
                                 name=f"glint_{i}", blocking=BlockingMode.NOT_BLOCKED,
                                 interaction=InteractionMode.INTANGIBLE, layer=-1
                                 ).set_position(*cell_xy(x, y)))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in " .P":
                    continue
                if ch == "c":
                    px, name = art(CRATE_ART, {"M": WOOD, "O": CARGO_C}), f"cargo_{x}_{y}"
                elif ch == "X":
                    px, name = art(BOAT, {"M": WOOD, "k": INK}), "berth"
                elif ch == "s":
                    px, name = bridge_pixels(bridge_runs_across(rows, x, y), False), f"lock_{x}_{y}"
                else:
                    px, name = np.full((CELL, CELL), -1, dtype=np.int8), f"slip_{ch}"
                pieces.append(Sprite(pixels=px, name=name, blocking=BlockingMode.NOT_BLOCKED,
                                     interaction=InteractionMode.TANGIBLE, layer=0
                                     ).set_position(*cell_xy(x, y)))
        pieces.append(Sprite(pixels=art(FIGURE, {"#": INK}), name="hull",
                             blocking=BlockingMode.NOT_BLOCKED,
                             interaction=InteractionMode.TANGIBLE, layer=2).set_position(0, 0))
        levels.append(Level(sprites=pieces, grid_size=(VIEW, VIEW)))
    return levels


class Lamps(RenderableUserDisplay):
    """The strip across the top: three pairs of lamps (the lit pair is joined), a row of
    four white lamps once the fourth mouth is on the board, and the wick of moves left."""

    def __init__(self, game):
        super().__init__()
        self._game = game

    @staticmethod
    def _lamp(frame, x, colour, lit):
        frame[1:4, x:x + 3] = colour
        if not lit:
            frame[2, x + 1] = INK

    def render_interface(self, frame):
        g = self._game
        frame[:BAND, :] = INK
        for i, (a, b) in enumerate(BASE_CYCLE):
            x = 2 + i * 13
            lit = i == g.tick % 3
            self._lamp(frame, x, SLIP[a], lit)
            self._lamp(frame, x + 7, SLIP[b], lit)
            if lit:
                frame[2, x + 3:x + 7] = PIP
        if "D" in g.present:
            for i in range(4):
                x = 43 + i * 5
                frame[1:4, x:x + 3] = SLIP["D"] if i == g.tick % 4 else DIM
        left = max(0, min(60, round(60 * g.moves_left / g.spec["budget"])))
        if left:
            frame[6, 2:2 + left] = WICK
            frame[6, 1 + left] = SPARK
            frame[5, 1 + left] = 12
        return frame


class G045(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.tick = 0
        self.moves_left = spec["budget"]
        self.px, self.py = 0, 0
        self.facing = "down"
        self.cargo_left: set = set()
        self.cargo_total = 0
        self.present = slips_present(spec["rows"])
        self.slips: dict = {}
        camera = Camera(width=VIEW, height=VIEW, background=WATER, letter_box=INK,
                        interfaces=[Lamps(self)])
        super().__init__(game_id="g045", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    @property
    def spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        rows = self.spec["rows"]
        self.tick = 0
        self.moves_left = self.spec["budget"]
        self.px, self.py = find_char(rows, "P")
        self.facing = "down"
        self.cargo_left = find_all(rows, "c")
        self.cargo_total = len(self.cargo_left)
        self.present = slips_present(rows)
        self.slips = slip_positions(rows)
        self._sync()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        self.camera.x = max(0, min(W * CELL - VIEW, self.px * CELL + CELL // 2 - VIEW // 2))
        self.camera.y = 0

        # the figure, eyes on the way it last went
        for hull in level.get_sprites_by_name("hull"):
            px = art(FIGURE, {"#": INK})
            for r, c in EYES[self.facing]:
                px[r, c] = EYE
            hull.pixels = px
            hull.set_position(*cell_xy(self.px, self.py))

        # the mouths: a ring in their own colour; open, the hole shows the colour of the
        # mouth it leads to; shut, it is dark with one dot per beat still to wait (max 4)
        active = links(self.present, self.tick)
        for name in self.slips:
            for mouth in level.get_sprites_by_name(f"slip_{name}"):
                px = np.full((CELL, CELL), -1, dtype=np.int8)
                px[0, 1:4] = px[4, 1:4] = SLIP[name]
                px[1:4, 0] = px[1:4, 4] = SLIP[name]
                if name in active:
                    px[1:4, 1:4] = SLIP[active[name]]
                else:
                    px[1:4, 1:4] = INK
                    wait = next((n for n in range(1, 13)
                                 if name in links(self.present, self.tick + n)), 0)
                    for n, (r, c) in enumerate(((1, 1), (1, 3), (3, 1), (3, 3))[:min(wait, 4)]):
                        px[r, c] = PIP
                mouth.pixels = px

        # the boat: a crate on deck for each one gathered, sail up once all are aboard
        for boat in level.get_sprites_by_name("berth"):
            px = art(BOAT, {"M": WOOD, "k": INK})
            for r, c in DECK_SLOTS[:self.cargo_total - len(self.cargo_left)]:
                px[r, c] = CARGO_C
            if not self.cargo_left:
                for r, c in SAIL_UP:
                    px[r, c] = SAIL
            boat.pixels = px

        # bridges: deck down on the beat it can be crossed, raised otherwise
        if self.spec.get("lock_beat") is not None:
            down = lock_open(self.spec, self.tick)
            rows = self.spec["rows"]
            for x, y in find_all(rows, "s"):
                for gate in level.get_sprites_by_name(f"lock_{x}_{y}"):
                    gate.pixels = bridge_pixels(bridge_runs_across(rows, x, y), down)

        # inert glints on open water, shimmering with the beat
        for i in range(4):
            for glint in level.get_sprites_by_name(f"glint_{i}"):
                px = np.full((CELL, CELL), -1, dtype=np.int8)
                c = 0 if (self.tick + i) % 2 else 2
                px[1 + i % 3, c:c + 2] = GLINT
                glint.pixels = px

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('hull',), limit=CELL)
        waiting = self.action.id == GameAction.ACTION5
        d = (0, 0) if waiting else DIRS.get(self.action.id)
        if d is None:
            finish_translation(self)
            return

        spec = self.spec
        rows = spec["rows"]
        tick = self.tick
        nx, ny = self.px + d[0], self.py + d[1]
        ch = rows[ny][nx] if 0 <= nx < W and 0 <= ny < H else " "
        if not waiting:
            self.facing = {(0, -1): "up", (0, 1): "down", (-1, 0): "left", (1, 0): "right"}[d]

        if ch == "X" and not self.cargo_left:
            self.next_level()
            finish_translation(self)
            return

        if not waiting and cell_walkable(spec, nx, ny, tick):
            self.px, self.py = nx, ny
            if ch in SLIP:
                partner = links(self.present, tick).get(ch)
                if partner is not None:
                    self.px, self.py = self.slips[partner]
            self.cargo_left.discard((self.px, self.py))
            for crate in self.current_level.get_sprites_by_name(f"cargo_{self.px}_{self.py}"):
                self.current_level.remove_sprite(crate)

        self.tick += 1
        self.moves_left -= 1
        if self.moves_left <= 0:
            # level_reset() zeroes the engine's action count, and a RESET on a zero count
            # restarts the whole game; keep the count so RESET after this only restarts
            # the level the player was on.
            presses = self._action_count
            self.level_reset()
            self._action_count = presses
            finish_translation(self)
            return

        self._sync()
        finish_translation(self)
