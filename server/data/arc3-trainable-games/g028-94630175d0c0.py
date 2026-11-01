# ARC-AGI-3 candidate task g028.
#
# Author: Claude Opus 5.5 High (art pass and play changes, 20-October-2026); earlier rules and levels by Codex (GPT-6).
# Date: 20-October-2026
# PURPOSE: A walker on a sheet of paper. This file draws it the house way: every thing on screen is a named,
#   layered engine sprite (a yellow sheet on a maroon wood desk, orange flecks where the paper lies doubled,
#   green hedges, black keys, purple padlocks, a black doorway lit pale blue, a blue walker with eyes, a see-through
#   ghost of where it will land, a black scored line, and the paper's orange underside when it turns over).
#   The fold geometry (fold_board and its helpers), walking, aiming and the frame timing are the parent's; the
#   play changes are listed in the CHANGELOG.
# SRP/DRY check: Pass -- verify_g028.py imports the rule functions from this file's twin (g028_fold.py); the
#   drawing is one method (_draw) that places every sprite from the state; no rule is restated.
#
# CHANGELOG
# 20-Oct-2026 (Claude Opus 5.5 High): play changes, on the Boss's word ("You're absolutely allowed to change how
#   the game plays ... fix it, publish it"), to meet the vet gate. (1) A fold that would crush the walker on a
#   sheet not yet folded is refused with a short red shake instead of restarting the level; after a fold it
#   still restarts the level. (2) After that restart the engine's action count is put back, so a RESET pressed
#   next restarts this level, not the whole game. (3) Level one redrawn: the key sits below the padlock and
#   the walk round the hedge chamber makes the shortest win fourteen presses. (4) Two hedges added on level
#   six and two on level eight, placed so that most wrong fold orders bury the doorway; the shortest wins are
#   unchanged. Random play now clears levels five to eight about once in several hundred runs or less.
# 20-Oct-2026 (Claude Opus 5.5 High): art pass for the Boss ("Could be better with a slight graphics blow-up.").
#   The single "sheet" sprite that was repainted every frame is gone; the scene is built from named sprites in
#   build_levels and placed by _draw. New palette: maroon desk, yellow paper, green hedges, black key, purple
#   padlock, pale blue doorway, blue walker with white eyes, red only for a landing that crushes. Rules, levels,
#   inputs, frame counts, click geometry (CELL and the camera sizing), class name and id are untouched.

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


# ── Palette (indices into the engine's sixteen colours) ─────────────────────
# Each kind of thing the rules tell apart wears a colour nothing else live wears.
WHITE, DKGREY, BLACK = 0, 3, 5
RED, BLUE, LBLUE, YELLOW, ORANGE, MAROON, GREEN, PURPLE = 8, 9, 10, 11, 12, 13, 14, 15
_ = -1  # transparent

DESK = MAROON      # the camera's background and letter box: the desk round the sheet
PAPER = YELLOW     # the sheet, one flat field
LAYER = ORANGE     # flecks where the paper lies doubled; also the paper's underside as it turns over
HEDGE = GREEN      # walls
KEYC = BLACK      # an ink-black key: white was too faint on yellow paper
LOCKC = PURPLE
WALKER = BLUE
SCORE = BLACK      # the crease being aimed, the flap's edge
SEAM = DKGREY      # the pre-scored middle on the seam levels

GRAIN_SPOTS = ((0, 3), (3, 0), (0, 0), (3, 3))   # (row, col) of each extra paper layer's fleck, as the parent
HEDGE_GAPS = ((1, 1), (2, 0), (0, 2), (3, 1), (2, 2))  # (col, row) of the one dark gap in each hedge's leaves


def art(rows) -> np.ndarray:
    return np.array(rows, dtype=np.int8)


KEY_ART = art([[KEYC, KEYC, KEYC, _],          # a ring bow with a hole, and the shaft
               [KEYC, _, KEYC, KEYC],
               [KEYC, KEYC, KEYC, _],
               [_, _, _, _]])
LOCK_ART = art([[_, LOCKC, LOCKC, _],
                [LOCKC, _, _, LOCKC],
                [LOCKC, LOCKC, LOCKC, LOCKC],
                [LOCKC, BLACK, LOCKC, LOCKC]])
DOOR_ART = art([[BLACK, BLACK, BLACK, BLACK],
                [BLACK, LBLUE, LBLUE, BLACK],
                [BLACK, LBLUE, LBLUE, BLACK],
                [BLACK, LBLUE, LBLUE, BLACK]])


def hedge_art(x: int, y: int, shadow: bool) -> np.ndarray:
    """A hedge: flat green, one dark gap in the leaves that moves from cell to cell, and a black shadow along the
    bottom when no hedge stands below it."""
    px = np.full((4, 4), HEDGE, dtype=np.int8)
    gx, gy = HEDGE_GAPS[(x * 3 + y * 5) % len(HEDGE_GAPS)]
    px[gy, gx] = BLACK
    if shadow:
        px[3, :] = BLACK
    return px


def walker_art(facing: str, armed: bool, colour: int = WALKER) -> np.ndarray:
    """The walker: a round critter with two ears, two white eyes and a round chin. The eyes sit to the side it last
    stepped towards (up and down keep the last look); with a fold held ready it lays its ears flat.
    Drawn on purpose with no peak and no parted legs: that outline read as a capital A, and the screen must carry
    no letters."""
    c, e = colour, WHITE
    eyes = [e, c, e, c] if facing == "L" else [c, e, c, e]
    ears = [_, c, c, _] if armed else [c, _, _, c]
    return art([ears, [c, c, c, c], eyes, [_, c, c, _]])


def ghost_art(crushed: bool) -> np.ndarray:
    """Where the walker will land: its silhouette, every other pixel, blue when safe and red when it would be
    crushed."""
    body = walker_art("R", True, RED if crushed else WALKER)
    for y in range(4):
        for x in range(4):
            if (x + y) % 2 or body[y, x] == WHITE:
                body[y, x] = _
    return body


def canvas() -> np.ndarray:
    return np.full((64, 64), _, dtype=np.int8)


def outline(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for x in range(max(0, x0), min(w, x1)):
        if 0 <= y0 < h:
            frame[y0, x] = colour
        if 0 <= y1 - 1 < h:
            frame[y1 - 1, x] = colour
    for y in range(max(0, y0), min(h, y1)):
        if 0 <= x0 < w:
            frame[y, x0] = colour
        if 0 <= x1 - 1 < w:
            frame[y, x1 - 1] = colour
    return frame


# ── The parent's step animation helpers, unchanged ──────────────────────────

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


# ── The rules: the parent's, byte for byte (verify_g028.py imports these) ───

CELL = 4
SIDE = 64

FOLD_FRAMES = 4
CRUSH_FRAMES = 4
BALK_FRAMES = 2   # a refused fold: the flap starts to turn, flashes red, drops back

LEVELS_SPEC = [
    [
        '........',
        '.S......',
        '........',
        '..###...',
        '..#Xl...',
        '..###...',
        '........',
        '....k...',
    ],
    [
        '................',
        '................',
        '...S............',
        '................',
        '........k.......',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '.......#l#......',
        '.......#X#......',
        '.......###......',
        '................',
        '................',
    ],
    [
        '................',
        '................',
        '..S.............',
        '................',
        '................',
        '................',
        '...........#.#..',
        '.k.k.......#l#..',
        '...#.......#X#..',
        '...........###..',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '................',
        '.S..............',
        '................',
        '..k.............',
        '................',
        '................',
        '................',
        '...........###..',
        '...........lX#..',
        '...........###..',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '................',
        '.........#......',
        '..S......#......',
        '.........#......',
        '.........#......',
        '.........#......',
        '.........#......',
        '...........###..',
        'k..........lX#..',
        '...........###..',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '................',
        '.S............#.',
        '............#...',
        '..k.............',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '...#....###.....',
        '........#Xl.....',
        '........###.....',
        '.#..............',
        '................',
    ],
    [
        '................',
        '.S............#.',
        '................',
        '..k.............',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '........###.....',
        '........#Xl..l..',
        '........###.....',
        '.#..............',
        '................',
    ],
    [
        '................',
        '.S............#.',
        '..k.............',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '........###.....',
        '........#Xl.....',
        '...#....###.....',
        '................',
        '................',
        '.#.#............',
        '................',
    ],
]

N = 16
SEAM_LEVELS = frozenset((5, 6, 7))


def crease_choices(board, seamed=False):
    h, w = len(board), len(board[0])
    for orient, span in (("V", w), ("H", h)):
        for idx in ([span // 2] if seamed else range(1, span)):
            if 0 < idx < span:
                yield orient, idx, span

FOLD_KEYS = {"L": "V", "R": "V", "U": "H", "D": "H"}


def parse_level(rows: list[str]) -> tuple[list[list[str]], int, int]:
    board, px, py = [], 0, 0
    for y, row in enumerate(rows):
        line = []
        for x, ch in enumerate(row):
            if ch == "S":
                px, py = x, y
                line.append(".")
            else:
                line.append(ch)
        board.append(line)
    return board, px, py


def merge_cell(a: str, b: str) -> str:
    if a == "#" or b == "#":
        return "#"
    pair = {a, b}
    if "k" in pair and "l" in pair:
        return "."
    if "X" in pair:
        return "X"
    if "l" in pair:
        return "l"
    if "k" in pair:
        return "k"
    return "."


def fold_geometry(span: int, idx: int, pos: int) -> tuple[int, int, int]:
    if pos < idx:
        keep_lo, keep_hi = idx, span
    else:
        keep_lo, keep_hi = 0, idx
    return keep_lo, keep_hi, 2 * idx - 1 - pos - keep_lo


def fold_source(keep_lo: int, keep_hi: int, span: int, idx: int,
                j: int) -> tuple[int, int | None]:
    base = keep_lo + j
    mirror = 2 * idx - 1 - base
    if keep_lo <= mirror < keep_hi or not (0 <= mirror < span):
        mirror = None
    return base, mirror


def fold_board(board, ply, px, py, orient, idx):
    h, w = len(board), len(board[0])
    span, pos = (w, px) if orient == "V" else (h, py)
    keep_lo, keep_hi, landed = fold_geometry(span, idx, pos)
    new_span = keep_hi - keep_lo

    if orient == "V":
        nb = [[None] * new_span for _ in range(h)]
        npl = [[0] * new_span for _ in range(h)]
        for y in range(h):
            for j in range(new_span):
                base, mirror = fold_source(keep_lo, keep_hi, span, idx, j)
                if mirror is None:
                    nb[y][j], npl[y][j] = board[y][base], ply[y][base]
                else:
                    nb[y][j] = merge_cell(board[y][base], board[y][mirror])
                    npl[y][j] = ply[y][base] + ply[y][mirror]
    else:
        nb = [[None] * w for _ in range(new_span)]
        npl = [[0] * w for _ in range(new_span)]
        for i in range(new_span):
            base, mirror = fold_source(keep_lo, keep_hi, span, idx, i)
            for x in range(w):
                if mirror is None:
                    nb[i][x], npl[i][x] = board[base][x], ply[base][x]
                else:
                    nb[i][x] = merge_cell(board[base][x], board[mirror][x])
                    npl[i][x] = ply[base][x] + ply[mirror][x]

    crushed = not (0 <= landed < new_span)
    if orient == "V":
        nx, ny = landed, py
    else:
        nx, ny = px, landed
    if not crushed and nb[ny][nx] != ".":
        crushed = True
    return nb, npl, nx, ny, crushed


# ── The scene: named sprites, placed from the state by G028._draw ────────────

PIECE_ART = {"k": KEY_ART, "l": LOCK_ART, "X": DOOR_ART}
PIECE_NAME = {"k": "key", "l": "lock", "X": "door"}


def _sprite(pixels, name: str, layer: int, tags: list, visible: bool = True) -> Sprite:
    return Sprite(pixels=pixels, name=name, x=0, y=0, layer=layer,
                  blocking=BlockingMode.NOT_BLOCKED,
                  interaction=InteractionMode.INTANGIBLE if visible else InteractionMode.REMOVED,
                  tags=tags)


def build_levels() -> list[Level]:
    """One sprite per thing. Pools of keys, padlocks and doorways are sized from the level's own spec: a fold only
    ever merges pieces, so a sheet never holds more of a kind than it started with."""
    levels = []
    for rows in LEVELS_SPEC:
        text = "".join(rows)
        sprites = [
            _sprite(canvas(), "paper", 0, ["paper"]),
            _sprite(canvas(), "hedges", 1, ["hedge"]),
            _sprite(canvas(), "seams", 2, ["seam"]),
        ]
        for ch in ("k", "l", "X"):
            for k in range(max(1, text.count(ch))):
                sprites.append(_sprite(PIECE_ART[ch].copy(), f"{PIECE_NAME[ch]}-{k}", 3, [PIECE_NAME[ch]], False))
        sprites += [
            _sprite(ghost_art(False), "ghost", 4, ["ghost"], False),
            _sprite(canvas(), "flap", 5, ["flap"], False),
            _sprite(canvas(), "flap-edge", 6, ["flap"], False),
            _sprite(canvas(), "flap-print", 6, ["flap"], False),
            _sprite(canvas(), "crease", 7, ["crease"], False),
            _sprite(walker_art("D", False), "walker", 8, ["walker"]),
            _sprite(canvas(), "alarm", 9, ["alarm"], False),
        ]
        levels.append(Level(sprites=sprites, grid_size=(SIDE, SIDE)))
    return levels


class G028(ARCBaseGame):

    def __init__(self) -> None:
        self._beat = 0
        self._stage = None
        self._tick = 0
        self._pending = None
        self._fold = ("V", 1, 0, 0, 0)
        self._facing = "R"
        self.folds = 0
        self.board, self.px, self.py = parse_level(LEVELS_SPEC[0])
        self.ply = [[1] * len(self.board[0]) for _ in self.board]
        self.armed = False
        self.orient = "V"
        self.crease = 1
        super().__init__(
            game_id="g028",
            levels=build_levels(),
            available_actions=[1, 2, 3, 4, 5, 6, 7],
            camera=Camera(width=SIDE, height=SIDE, background=DESK, letter_box=DESK),
        )
        self._paint()

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self.board, self.px, self.py = parse_level(LEVELS_SPEC[self.level_index])
        self.ply = [[1] * len(self.board[0]) for _ in self.board]
        self.armed = False
        self.orient = "V"
        self.crease = 1
        self._stage = None
        self._tick = 0
        self._pending = None
        self._facing = "R"
        self.folds = 0
        self._paint()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    # ── drawing: every frame places each named sprite; nothing else is painted ──

    def _draw(self, board, ply, walker=None, ghost=None, crease=None, seams=False,
              flap=None, prints=None, alarm=None) -> None:
        """Place the scene for one frame.
        walker: (left, top, armed) in pixels, or None; ghost: (cell x, cell y, crushed); crease: (orient, idx);
        seams: draw the seam level's pre-scored middle; flap: (flap box, turned-over box) in pixels;
        prints: (mirror grid, parity) for the flap lying over the sheet; alarm: a painted crush mark or None.
        Sprites are looked up by name every time, so a level reset's fresh copies and a deep copy both work."""
        sprites = {s.name: s for s in self.current_level.get_sprites()}

        def put(name, pixels=None, x=0, y=0, visible=True):
            s = sprites[name]
            if pixels is not None:
                s.pixels = pixels
            s.set_position(x, y)
            s.set_visible(visible)

        h, w = len(board), len(board[0])
        paper, hedges = canvas(), canvas()
        pieces = {"k": [], "l": [], "X": []}
        for y in range(h):
            y0 = y * CELL
            for x in range(w):
                x0, ch = x * CELL, board[y][x]
                paper[y0:y0 + CELL, x0:x0 + CELL] = PAPER
                if ch != "#":
                    for k in range(min(ply[y][x] - 1, len(GRAIN_SPOTS))):
                        gy, gx = GRAIN_SPOTS[k]
                        paper[y0 + gy, x0 + gx] = LAYER
                else:
                    shadow = y + 1 >= h or board[y + 1][x] != "#"
                    hedges[y0:y0 + CELL, x0:x0 + CELL] = hedge_art(x, y, shadow)
                if ch in pieces:
                    pieces[ch].append((x0, y0))
        put("paper", paper)
        put("hedges", hedges)
        for ch, spots in pieces.items():
            k = 0
            while sprites.get(f"{PIECE_NAME[ch]}-{k}") is not None:
                if k < len(spots):
                    put(f"{PIECE_NAME[ch]}-{k}", None, *spots[k])
                else:
                    put(f"{PIECE_NAME[ch]}-{k}", visible=False)
                k += 1

        marks = canvas()
        if seams:
            for orient, idx, _span in crease_choices(board, True):
                if orient == "V":
                    marks[:h * CELL:2, idx * CELL] = SEAM
                else:
                    marks[idx * CELL, :w * CELL:2] = SEAM
        put("seams", marks, visible=seams)

        if ghost is not None:
            gx, gy, crushed = ghost
            put("ghost", ghost_art(crushed), gx * CELL, gy * CELL)
        else:
            put("ghost", visible=False)

        if flap is not None:
            box, turned = flap
            under = canvas()
            under[turned[1]:turned[3], turned[0]:turned[2]] = LAYER
            put("flap", under)
            put("flap-edge", outline(canvas(), box, SCORE))
        else:
            put("flap", visible=False)
            put("flap-edge", visible=False)

        if prints is not None:
            mirror, parity = prints
            sheet = canvas()
            for y, row in enumerate(mirror):
                for x, ch in enumerate(row):
                    if ch is None or ch == ".":
                        continue
                    piece = hedge_art(x, y, True) if ch == "#" else PIECE_ART[ch]
                    for dy in range(CELL):
                        for dx in range(CELL):
                            v = piece[dy, dx]
                            if v >= 0 and (dx + dy) % 2 == parity:
                                sheet[y * CELL + dy, x * CELL + dx] = v
            put("flap-print", sheet)
        else:
            put("flap-print", visible=False)

        line = canvas()
        if crease is not None:
            orient, idx = crease
            if orient == "V":
                line[0:h * CELL, idx * CELL] = SCORE
            else:
                line[idx * CELL, 0:w * CELL] = SCORE
        put("crease", line, visible=crease is not None)

        if walker is not None:
            left, top, armed = walker
            put("walker", walker_art(self._facing, armed), left, top)
        else:
            put("walker", visible=False)
        put("alarm", alarm, visible=alarm is not None)

    def _paint(self) -> None:
        h, w = len(self.board), len(self.board[0])
        self.camera.width, self.camera.height = w * CELL, h * CELL
        ghost = crease = None
        if self.armed:
            _, _, nx, ny, crushed = fold_board(self.board, self.ply, self.px, self.py, self.orient, self.crease)
            span, pos = (w, self.px) if self.orient == "V" else (h, self.py)
            lo, _, _ = fold_geometry(span, self.crease, pos)
            gx, gy = (nx + lo, ny) if self.orient == "V" else (nx, ny + lo)
            if 0 <= gx < w and 0 <= gy < h:
                ghost = (gx, gy, crushed)
            crease = (self.orient, self.crease)
        left, top = translation_position(self, (self.px * CELL, self.py * CELL))
        self._draw(self.board, self.ply, walker=(left, top, self.armed), ghost=ghost, crease=crease,
                   seams=self.level_index in SEAM_LEVELS)

    def _fold_views(self):
        orient, idx, keep_lo, keep_hi, span = self._fold
        board, ply = self.board, self.ply
        h, w = len(board), len(board[0])
        new_span = keep_hi - keep_lo
        base_g, base_p, mir_g = [], [], []
        if orient == "V":
            for y in range(h):
                brow, prow, mrow = [], [], []
                for j in range(new_span):
                    base, mirror = fold_source(keep_lo, keep_hi, span, idx, j)
                    brow.append(board[y][base])
                    prow.append(ply[y][base])
                    mrow.append(None if mirror is None else board[y][mirror])
                base_g.append(brow)
                base_p.append(prow)
                mir_g.append(mrow)
        else:
            for i in range(new_span):
                base, mirror = fold_source(keep_lo, keep_hi, span, idx, i)
                base_g.append(list(board[base]))
                base_p.append(list(ply[base]))
                mir_g.append([None] * w if mirror is None else list(board[mirror]))
        return base_g, base_p, mir_g

    def _flap_box(self, orient, idx, keep_lo, h, w):
        if orient == "V":
            return ((idx * CELL, 0, w * CELL, h * CELL) if keep_lo == 0
                    else (0, 0, idx * CELL, h * CELL))
        return ((0, idx * CELL, w * CELL, h * CELL) if keep_lo == 0
                else (0, 0, w * CELL, idx * CELL))

    def _lift_box(self, box, orient, keep_lo, stage):
        x0, y0, x1, y1 = box
        lifts = max(1, FOLD_FRAMES // 2)
        if orient == "V":
            reach = -(-(x1 - x0) * stage // lifts)
            return (x1 - reach, y0, x1, y1) if keep_lo == 0 else (x0, y0, x0 + reach, y1)
        reach = -(-(y1 - y0) * stage // lifts)
        return (x0, y1 - reach, x1, y1) if keep_lo == 0 else (x0, y0, x1, y0 + reach)

    def _paint_lift(self, stage: int) -> None:
        # The flap turns over whole: its orange underside sweeps in from the outer edge to the crease (the
        # parent's _lift_box geometry), the flap edged in black and the scored line across the sheet.
        orient, idx, keep_lo, _, _ = self._fold
        h, w = len(self.board), len(self.board[0])
        box = self._flap_box(orient, idx, keep_lo, h, w)
        self._draw(self.board, self.ply, walker=(self.px * CELL, self.py * CELL, True),
                   crease=(orient, idx), flap=(box, self._lift_box(box, orient, keep_lo, stage)))

    def _paint_superimposed(self, stage: int) -> None:
        # The flap lies on the kept half: what was printed on it shows through, dithered, over where it lands;
        # the desk shows where the paper has gone.
        base_g, base_p, mir_g = self._fold_views()
        h, w = len(base_g), len(base_g[0])
        _, _, nx, ny, _ = self._pending
        walker = (nx * CELL, ny * CELL, True) if 0 <= nx < w and 0 <= ny < h else None
        self._draw(base_g, base_p, walker=walker, prints=(mir_g, stage % 2))

    def _paint_balk(self, stage: int) -> None:
        # The fold that would crush the walker is refused: the flap starts to turn, then its edge flashes red.
        orient, idx, keep_lo, _, _ = self._fold
        h, w = len(self.board), len(self.board[0])
        box = self._flap_box(orient, idx, keep_lo, h, w)
        if stage == 1:
            self._draw(self.board, self.ply, walker=(self.px * CELL, self.py * CELL, True),
                       crease=(orient, idx), flap=(box, self._lift_box(box, orient, keep_lo, 1)))
            return
        self._draw(self.board, self.ply, walker=(self.px * CELL, self.py * CELL, True),
                   alarm=outline(outline(canvas(), box, RED), (box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1), RED))

    def _paint_crush(self, stage: int) -> None:
        # Red rings flash round the walker, or a red bar on the edge it fell off (the parent's boxes).
        board, ply, nx, ny, _ = self._pending
        orient = self._fold[0]
        h, w = len(board), len(board[0])
        inside = 0 <= nx < w and 0 <= ny < h
        alarm = None
        if stage % 2:
            alarm = canvas()
            if inside:
                for pad in (2, 3):
                    outline(alarm, (max(0, nx * CELL - pad), max(0, ny * CELL - pad),
                                    min(SIDE, nx * CELL + CELL + pad),
                                    min(SIDE, ny * CELL + CELL + pad)), RED)
            elif nx < 0 or ny < 0:
                box = (0, 0, 2, h * CELL) if orient == "V" else (0, 0, w * CELL, 2)
                alarm[box[1]:box[3], box[0]:box[2]] = RED
            else:
                box = ((w * CELL - 2, 0, w * CELL, h * CELL) if orient == "V"
                       else (0, h * CELL - 2, w * CELL, h * CELL))
                alarm[box[1]:box[3], box[0]:box[2]] = RED
        self._draw(board, ply, walker=(nx * CELL, ny * CELL, True) if inside else None, alarm=alarm)

    def _advance(self) -> None:
        self._tick += 1
        if self._stage == "fold":
            if self._tick <= FOLD_FRAMES // 2:
                self._paint_lift(self._tick)
                return
            if self._tick <= FOLD_FRAMES:
                self._paint_superimposed(self._tick)
                return
            board, ply, nx, ny, crushed = self._pending
            if crushed:
                self._stage, self._tick = "crush", 0
                self._advance()
                return
            self.board, self.ply, self.px, self.py = board, ply, nx, ny
            self.folds += 1
            self.orient, self.crease = "V", 1
            self._stage, self._pending = None, None
            self._paint()
            finish_translation(self)
            return
        if self._stage == "balk":
            # A refused fold: the flap starts to turn, flashes red and drops back; nothing changes.
            if self._tick <= BALK_FRAMES:
                self._paint_balk(self._tick)
                return
            self._stage, self._pending = None, None
            self._paint()
            finish_translation(self)
            return
        if self._tick <= CRUSH_FRAMES:
            self._paint_crush(self._tick)
            return
        self._stage, self._pending = None, None
        # The level starts again. The engine's level reset zeroes its action count, and RESET on a zero count
        # restarts the whole game, so the count is put back: a RESET pressed next restarts this level only.
        count = self._action_count
        self.level_reset()
        self._action_count = count
        finish_translation(self)

    def _walk(self, dx: int, dy: int) -> None:
        nx, ny = self.px + dx, self.py + dy
        if not (0 <= nx < len(self.board[0]) and 0 <= ny < len(self.board)):
            return
        cell = self.board[ny][nx]
        if cell in ("#", "k", "l"):
            return
        self.px, self.py = nx, ny
        if cell == "X":
            self.next_level()

    def _aim(self, key: str) -> None:
        h, w = len(self.board), len(self.board[0])
        want = FOLD_KEYS[key]
        if self.level_index in SEAM_LEVELS:
            self.orient = want
            self.crease = (w if want == "V" else h) // 2
            return
        limit = (w if want == "V" else h) - 1
        if limit < 1:
            return
        if self.orient != want:
            self.orient = want
            anchor = self.px if want == "V" else self.py
            self.crease = min(max(anchor, 1), limit)
            return
        self.crease = min(max(self.crease + (1 if key in ("R", "D") else -1), 1), limit)

    def _commit(self) -> None:
        if (self.orient, self.crease) not in {(a, b) for a, b, _ in crease_choices(self.board, self.level_index in SEAM_LEVELS)}:
            self.armed = False
            self._paint()
            finish_translation(self)
            return
        span = len(self.board[0]) if self.orient == "V" else len(self.board)
        pos = self.px if self.orient == "V" else self.py
        keep_lo, keep_hi, _ = fold_geometry(span, self.crease, pos)
        self._fold = (self.orient, self.crease, keep_lo, keep_hi, span)
        self._pending = fold_board(self.board, self.ply, self.px, self.py,
                                   self.orient, self.crease)
        self.armed = False
        # A fold that would crush the walker is refused while the sheet is still unfolded (restarting would
        # only put back the same sheet); once a fold has been made, the same mistake restarts the level.
        refuse = self._pending[4] and self.folds == 0
        self._stage, self._tick = ("balk" if refuse else "fold"), 0
        self._advance()

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, position=lambda: (self.px*CELL, self.py*CELL), repaint=self._paint, limit=CELL)
        self._beat += 1
        if self._stage:
            self._advance()
            return
        act = self.action.id
        if act == GameAction.ACTION7:
            self.armed = False
        elif act == GameAction.ACTION6:
            data = self.action.data or {}
            point = self.camera.display_to_grid(int(data.get("x", -1)), int(data.get("y", -1)))
            if point is not None:
                x, y = point
                choices = list(crease_choices(self.board, self.level_index in SEAM_LEVELS))
                if choices:
                    self.orient, self.crease, _ = min(choices, key=lambda c: abs((x if c[0] == "V" else y) - c[1] * CELL))
                    self.armed = True
        elif act == GameAction.ACTION5:
            if self.armed:
                self._commit()
                return
            self.armed = True
            self.orient = "V"
            self.crease = len(self.board[0]) // 2 if self.level_index in SEAM_LEVELS else min(max(self.px, 1), len(self.board[0]) - 1)
        elif act in (GameAction.ACTION1, GameAction.ACTION2,
                     GameAction.ACTION3, GameAction.ACTION4):
            key = {GameAction.ACTION1: "U", GameAction.ACTION2: "D",
                   GameAction.ACTION3: "L", GameAction.ACTION4: "R"}[act]
            if self.armed:
                self._aim(key)
            else:
                self._facing = key if key in ("L", "R") else self._facing   # drawing only: where its eyes look
                self._walk({"L": -1, "R": 1}.get(key, 0), {"U": -1, "D": 1}.get(key, 0))
        self._paint()
        finish_translation(self)
