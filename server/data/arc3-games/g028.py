# ARC-AGI-3 candidate task g028.

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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def figure(body: int, mark: int | None = None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    mid = cell // 2
    for x in range(1, cell - 1):
        px[0][x] = body
    for y in range(1, cell - 1):
        for x in range(cell):
            px[y][x] = body
    px[cell - 1][0] = px[cell - 1][mid] = -1
    for x in range(cell):
        if px[cell - 1][x] != -1:
            px[cell - 1][x] = body
    px[cell - 1][1] = body
    px[cell - 1][cell - 1] = body
    if mark is not None and cell >= 4:
        px[mid][mid] = mark
    return px

def key_shape(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[0][1] = px[0][2] = colour
    px[1][1] = px[1][2] = colour
    px[2][1] = colour
    px[3][1] = px[3][2] = colour
    return px

def door(frame_colour: int, bar: int | None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for y in range(cell):
        px[y][0] = px[y][last] = frame_colour
    for x in range(cell):
        px[0][x] = frame_colour
    if bar is not None:
        for y in range(1, cell):
            for x in range(1, last):
                px[y][x] = bar
    return px

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px

def dither(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            if (x + y) % 2:
                frame[y, x] = colour
    return frame

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


OUTSIDE = 4
FLOOR = 1
WALL = 6
KEY = 8
LOCK = 14
EXIT = 14
PLAYER = 10
CREASE = 8
GRAIN = OUTSIDE
SCONCE = (PLAYER, EXIT, WALL)

GRAIN_SPOTS = ((0, 3), (3, 0), (0, 0), (3, 3))

CELL = 4
SIDE = 64

FOLD_FRAMES = 4
CRUSH_FRAMES = 4

LEVELS_SPEC = [
    [
        '........',
        '........',
        '..S.....',
        '.....###',
        '..k..lX#',
        '.....###',
        '........',
        '........',
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
        '........###.....',
        '................',
        '................',
        '.#..............',
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


def build_levels() -> list[Level]:
    blank = [[OUTSIDE] * SIDE for _ in range(SIDE)]
    return [
        Level(sprites=[Sprite(pixels=[row[:] for row in blank], name="sheet",
                              blocking=BlockingMode.NOT_BLOCKED,
                              interaction=InteractionMode.INTANGIBLE, layer=0)
                       .set_position(0, 0)],
              grid_size=(SIDE, SIDE))
        for _ in LEVELS_SPEC
    ]


def _over(base: list, px: list) -> list:
    for dy, row in enumerate(px):
        for dx, v in enumerate(row):
            if v >= 0:
                base[dy][dx] = v
    return base


def _blit(frame, y0: int, x0: int, px: list) -> None:
    for dy, row in enumerate(px):
        for dx, v in enumerate(row):
            if v >= 0:
                frame[y0 + dy, x0 + dx] = v


def wall_art(x: int, y: int, beat: int) -> list:
    px = _over(block(WALL, CELL), speckle(FLOOR, (x * 3 + y) % 5, CELL))
    return px


def cell_art(ch: str, x: int, y: int, beat: int):
    if ch == "#":
        return wall_art(x, y, beat)
    if ch == "k":
        return key_shape(KEY, CELL)
    if ch == "l":
        return door(LOCK, OUTSIDE, CELL)
    if ch == "X":
        return door(EXIT, None, CELL)
    return None


def player_art(armed: bool) -> list:
    return figure(PLAYER, CREASE if armed else OUTSIDE, CELL)


class Fold(ARCBaseGame):

    def __init__(self) -> None:
        self._beat = 0
        self._stage = None
        self._tick = 0
        self._pending = None
        self._fold = ("V", 1, 0, 0, 0)
        self.board, self.px, self.py = parse_level(LEVELS_SPEC[0])
        self.ply = [[1] * len(self.board[0]) for _ in self.board]
        self.armed = False
        self.orient = "V"
        self.crease = 1
        super().__init__(
            game_id="g028",
            levels=build_levels(),
            available_actions=[1, 2, 3, 4, 5, 6, 7],
            camera=Camera(width=SIDE, height=SIDE, background=OUTSIDE, letter_box=OUTSIDE),
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
        self._paint()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _show(self, frame) -> None:
        sprites = self.current_level.get_sprites_by_name("sheet")
        if sprites:
            sprites[0].pixels = frame

    def _sheet_frame(self, board, ply, player=None):
        h, w = len(board), len(board[0])
        frame = np.full((SIDE, SIDE), OUTSIDE, dtype=np.int8)
        for y in range(h):
            y0 = y * CELL
            for x in range(w):
                x0, ch = x * CELL, board[y][x]
                frame[y0:y0 + CELL, x0:x0 + CELL] = FLOOR
                if ch != "#":
                    for k in range(min(ply[y][x] - 1, len(GRAIN_SPOTS))):
                        gy, gx = GRAIN_SPOTS[k]
                        frame[y0 + gy, x0 + gx] = GRAIN
                art = cell_art(ch, x, y, self._beat)
                if art is not None:
                    _blit(frame, y0, x0, art)
        if player is not None:
            px, py, armed = player
            _blit(frame, py * CELL, px * CELL, player_art(armed))
        return frame

    def _crease_line(self, frame, orient, idx, h, w) -> None:
        if orient == "V":
            frame[0:h * CELL, idx * CELL] = CREASE
        else:
            frame[idx * CELL, 0:w * CELL] = CREASE

    def _paint(self) -> None:
        frame = self._sheet_frame(self.board, self.ply)
        h, w = len(self.board), len(self.board[0])
        self.camera.width, self.camera.height = w * CELL, h * CELL
        if self.level_index in SEAM_LEVELS:
            for orient, idx, _ in crease_choices(self.board, True):
                if orient == "V":
                    frame[:h * CELL:2, idx * CELL] = 2
                else:
                    frame[idx * CELL, :w * CELL:2] = 2
        if self.armed:
            _, _, nx, ny, crushed = fold_board(self.board, self.ply, self.px, self.py, self.orient, self.crease)
            span, pos = (w, self.px) if self.orient == "V" else (h, self.py)
            lo, _, _ = fold_geometry(span, self.crease, pos)
            gx, gy = (nx + lo, ny) if self.orient == "V" else (nx, ny + lo)
            if 0 <= gx < w and 0 <= gy < h:
                outline(frame, (gx * CELL, gy * CELL, (gx+1) * CELL, (gy+1) * CELL), 8 if crushed else 0)
            self._crease_line(frame, self.orient, self.crease,
                              len(self.board), len(self.board[0]))
        left, top = translation_position(self, (self.px * CELL, self.py * CELL))
        _blit(frame, top, left, player_art(self.armed))
        self._show(frame)

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
        orient, idx, keep_lo, _, _ = self._fold
        h, w = len(self.board), len(self.board[0])
        frame = self._sheet_frame(self.board, self.ply, (self.px, self.py, True))
        box = self._flap_box(orient, idx, keep_lo, h, w)
        dither(frame, self._lift_box(box, orient, keep_lo, stage), CREASE)
        outline(frame, box, CREASE)
        self._crease_line(frame, orient, idx, h, w)
        self._show(frame)

    def _paint_superimposed(self, stage: int) -> None:
        base_g, base_p, mir_g = self._fold_views()
        frame = self._sheet_frame(base_g, base_p)
        h, w = len(base_g), len(base_g[0])
        parity = stage % 2
        for y in range(h):
            for x in range(w):
                ch = mir_g[y][x]
                art = None if ch is None else cell_art(ch, x, y, self._beat)
                if art is None:
                    continue
                y0, x0 = y * CELL, x * CELL
                for dy, row in enumerate(art):
                    for dx, v in enumerate(row):
                        if v >= 0 and (dx + dy) % 2 == parity:
                            frame[y0 + dy, x0 + dx] = v
        _, _, nx, ny, _ = self._pending
        if 0 <= nx < w and 0 <= ny < h:
            _blit(frame, ny * CELL, nx * CELL, player_art(True))
        self._show(frame)

    def _paint_crush(self, stage: int) -> None:
        board, ply, nx, ny, _ = self._pending
        orient = self._fold[0]
        h, w = len(board), len(board[0])
        inside = 0 <= nx < w and 0 <= ny < h
        frame = self._sheet_frame(board, ply, (nx, ny, True) if inside else None)
        mark = CREASE if stage % 2 else OUTSIDE
        if inside:
            for pad in (2, 3):
                outline(frame, (max(0, nx * CELL - pad), max(0, ny * CELL - pad),
                                min(SIDE, nx * CELL + CELL + pad),
                                min(SIDE, ny * CELL + CELL + pad)), mark)
        elif nx < 0 or ny < 0:
            box = (0, 0, 2, h * CELL) if orient == "V" else (0, 0, w * CELL, 2)
            frame[box[1]:box[3], box[0]:box[2]] = mark
        else:
            box = ((w * CELL - 2, 0, w * CELL, h * CELL) if orient == "V"
                   else (0, h * CELL - 2, w * CELL, h * CELL))
            frame[box[1]:box[3], box[0]:box[2]] = mark
        self._show(frame)

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
            self.orient, self.crease = "V", 1
            self._stage, self._pending = None, None
            self._paint()
            finish_translation(self)
            return
        if self._tick <= CRUSH_FRAMES:
            self._paint_crush(self._tick)
            return
        self._stage, self._pending = None, None
        self.level_reset()
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
        self._stage, self._tick = "fold", 0
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
                self._walk({"L": -1, "R": 1}.get(key, 0), {"U": -1, "D": 1}.get(key, 0))
        self._paint()
        finish_translation(self)
