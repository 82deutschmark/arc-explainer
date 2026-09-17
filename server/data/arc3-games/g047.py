# ARC-AGI-3 candidate task g047.

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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def ring(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = -1
    return px

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
    return px

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


FIELD = 0
GRIT = 3
M_FLOOR = 0
M_WALL = 3
M_PLAYER = 8
M_EXIT = 14
M_EMPTY = 1
CHROME = 3
BAR_ARMED = 11
FITTINGS = (3, 14, 8, 1, 3)

N = 12
CELL = 4
ORIGIN = 8
SPAN = N * CELL
SLOT_DEEP = 6
BAND_DEEP = 8

ANCHORS = ((5, 0), (11, 5), (6, 11), (0, 6))
DIRS = ((0, -1), (1, 0), (0, 1), (-1, 0))

CORNERS = ((0, 0), (0, 64 - ORIGIN), (64 - ORIGIN, 0), (64 - ORIGIN, 64 - ORIGIN))


MIRROR_COLOURS = (9, 12, 15, 10)


def strip_cells(rows, anchor, orient):
    cells = []
    x, y = anchor
    dx, dy = DIRS[orient]
    while 0 <= x < N and 0 <= y < N and len(cells) < N:
        cells.append((x, y))
        if rows[y][x] == "#":
            break
        x += dx
        y += dy
    return cells


def visible_cells(rows, orients):
    seen = set()
    for k in range(4):
        seen.update(strip_cells(rows, ANCHORS[k], orients[k]))
    return seen


LEVELS_SPEC = [
    {"orients": [2, 3, 0, 1], "rows": [
        "............",
        ".....P......",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        ".....X......",
        "............",
        "............",
    ]},
    {"orients": [2, 3, 3, 1], "rows": [
        "............",
        ".....P......",
        "............",
        "......X.....",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
    ]},
    {"orients": [2, 1, 0, 1], "rows": [
        "............",
        ".##########.",
        ".#........#.",
        ".#.######.#.",
        ".#.#....#.#.",
        "..X.........",
        ".#.#....#.#.",
        ".#.######.#.",
        ".#........#.",
        ".##########.",
        ".....P......",
        "............",
    ]},
    {"orients": [1, 0, 3, 0], "rows": [
        "............",
        "..####.####.",
        "..#......#..",
        "..#.#.##.#..",
        "....#..#....",
        "..#.#..#.#..",
        "....#..#....",
        "..#.####.#..",
        "..#......#..",
        "..####.####.",
        "...........X",
        "..P.........",
    ]},
    {"orients": [0, 0, 1, 0], "rows": [
        "............",
        ".#.#######.#",
        ".#P......#.#",
        ".#.#####.#.#",
        ".#.#...#.#.#",
        "...#.#.#....",
        ".#.#.#.#.#.#",
        ".#.#.#.#.#.#",
        ".#...#...#.#",
        ".#####.####.",
        "............",
        "..X.........",
    ]},
    {"orients": [1, 1, 0, 3], "rows": [
        "..#....#....",
        "..#.##.#.##.",
        "..#.#..#..#.",
        "....#.###.#.",
        ".####.#...#.",
        "......#.###.",
        ".###..#...#.",
        ".#..#.###.#.",
        ".#.##.....#.",
        "X#....###.#.",
        ".####.#.....",
        ".........P..",
    ]},
    {"orients": [3, 3, 1, 3], "rows": [
        "....#.......",
        ".##.#.#####.",
        ".#P.#.....#.",
        ".#.##.###.#.",
        ".#....#.#.#.",
        "...####.#...",
        ".#.#....#.#.",
        ".#.#.####.#.",
        ".#...#....#.",
        ".#####.####.",
        ".......#....",
        ".........#.X",
    ]},
]


def _cell_block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = ORIGIN + x * CELL, ORIGIN + y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIELD), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIELD), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0, tags=["exit"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIELD), name="player",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


class MirrorRing(RenderableUserDisplay):

    def __init__(self, game: "Peephole") -> None:
        super().__init__()
        self._game = game


    def _paint_field(self, frame):
        g=self._game
        field=frame[ORIGIN:ORIGIN+SPAN, ORIGIN:ORIGIN+SPAN]
        field[:]=FIELD
        beams=g.visible()
        for y in range(N):
            for x in range(N):
                px,py=x*CELL,y*CELL
                patch=field[py:py+CELL,px:px+CELL]
                if (x,y) not in g.explored:
                    patch[1,1]=1
                    continue
                if g.rows[y][x]=='#':
                    patch[:]=3;patch[0,:]=2;patch[:,0]=2
                else:
                    patch[0,:]=1;patch[:,0]=1
                if (x,y)==g.exit:
                    patch[:]=M_EXIT if (x,y) in beams else 2
                    patch[1:3,1:3]=0
                    if (x,y) not in beams:patch[1:3,2]=3
        for k in range(4):
            for x,y in strip_cells(g.rows,ANCHORS[k],g.orients[k]):
                px,py=x*CELL,y*CELL
                if g.rows[y][x]!='#' and (x,y)!=g.exit:
                    if g.orients[k]%2:field[py+2,px+1:px+CELL]=MIRROR_COLOURS[k]
                    else:field[py+1:py+CELL,px+2]=MIRROR_COLOURS[k]
        for k,(x,y) in enumerate(ANCHORS):
            px,py=x*CELL,y*CELL;patch=field[py:py+CELL,px:px+CELL]
            patch[:]=MIRROR_COLOURS[k]
            patch[1:3,1:3]=11 if g.held==k else 0
            dx,dy=DIRS[g.orients[k]];patch[2+dy,2+dx]=5
        px,py=translation_position(g, (g.px*CELL,g.py*CELL))
        field[py:py+CELL,px:px+CELL]=[[0,8,8,0],[8,0,0,8],[8,8,8,8],[0,8,8,0]]


    def _paint_corners(self, frame):
        g=self._game
        for k,(top,left) in enumerate(CORNERS):
            frame[top:top+ORIGIN,left:left+ORIGIN]=FIELD
            colour=MIRROR_COLOURS[k]
            frame[top+1:top+7,left+1:left+7]=colour
            frame[top+2:top+6,left+2:left+6]=11 if g.held==k else 0
            dx,dy=DIRS[g.orients[k]]
            for distance in (0,1,2): frame[top+4+dy*distance,left+4+dx*distance]=5

    def _paint_flash(self, frame) -> None:
        step = Peephole.FLASH_FRAMES - self._game.flash
        inset = 4 * (Peephole.FLASH_FRAMES - step)
        lo, hi = ORIGIN + inset, ORIGIN + SPAN - inset
        if hi - lo >= 4:
            outline(frame, (lo, lo, hi, hi), M_EXIT)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._paint_field(frame)
        self._paint_corners(frame)
        if self._game.flash:
            self._paint_flash(frame)
        return frame


class Peephole(ARCBaseGame):

    FLASH_FRAMES = 5

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.rows = spec["rows"]
        self.orients = list(spec["orients"])
        self.explored = set()
        self.held: int | None = None
        self.flash = 0
        self.tick = 0
        self.px, self.py = self._find(spec["rows"], "P")
        self.exit = self._find(spec["rows"], "X")
        camera = Camera(
            width=64, height=64, background=FIELD, letter_box=FIELD,
            interfaces=[MirrorRing(self)],
        )
        super().__init__(game_id="g047", levels=build_levels(), camera=camera, available_actions=[1,2,3,4,5])

    @staticmethod
    def _find(rows, char) -> tuple[int, int]:
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c == char:
                    return x, y
        raise AssertionError(f"board has no {char}")

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        spec = LEVELS_SPEC[self.level_index]
        self.rows = spec["rows"]
        self.orients = list(spec["orients"])
        self.held = None
        self.flash = 0
        self.px, self.py = self._find(spec["rows"], "P")
        self.exit = self._find(spec["rows"], "X")
        self._sync_sprite()
        self._arm()
        self.explored = set()
        self._reveal()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.tick = 0
        self.on_set_level(self.current_level)

    def _sync_sprite(self) -> None:
        found = self.current_level.get_sprites_by_name("player")
        if found:
            found[0].set_position(ORIGIN + self.px * CELL, ORIGIN + self.py * CELL)

    def _arm(self) -> None:
        for k, (ax, ay) in enumerate(ANCHORS):
            if abs(self.px - ax) + abs(self.py - ay) <= 1:
                self.held = k
                return

    def _reveal(self):
        self.explored.update(self.visible())
        self.explored.update(ANCHORS)
        for y in range(max(0,self.py-1),min(N,self.py+2)):
            for x in range(max(0,self.px-1),min(N,self.px+2)):
                self.explored.add((x,y))

    def visible(self) -> set:
        return visible_cells(self.rows, self.orients)

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, position=lambda: (self.px*CELL, self.py*CELL), limit=CELL)
        self.tick += 1

        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.next_level()
                finish_translation(self)
            return

        aid = self.action.id
        if aid in (GameAction.ACTION1, GameAction.ACTION2,
                   GameAction.ACTION3, GameAction.ACTION4):
            dx, dy = {
                GameAction.ACTION1: (0, -1),
                GameAction.ACTION2: (0, 1),
                GameAction.ACTION3: (-1, 0),
                GameAction.ACTION4: (1, 0),
            }[aid]
            nx, ny = self.px + dx, self.py + dy
            if 0 <= nx < N and 0 <= ny < N and self.rows[ny][nx] != "#":
                self.px, self.py = nx, ny
                self._sync_sprite()
                self._arm()
        elif aid == GameAction.ACTION5:
            if self.held is not None:
                self.orients[self.held] = (self.orients[self.held] + 1) % 4

        self._reveal()

        if (self.px, self.py) == self.exit and self.exit in self.visible():
            self.flash = self.FLASH_FRAMES
            return

        finish_translation(self)
