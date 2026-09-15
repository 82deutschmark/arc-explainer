# ARC-AGI-3 candidate task g014.

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

FLOOR_LIT = 11
FLOOR_HALF = 2
FLOOR_DEEP = 3
FLOOR_DARK = 5
TONES = (FLOOR_LIT, FLOOR_HALF, FLOOR_DEEP, FLOOR_DARK)

BLOCK = 8
BLOCK_EDGE = 7
WALL = 4
SUN = FLOOR_LIT

CELL = 4
N = 13
INSET = (64 - N * CELL) // 2

SUNS = ((0, -1), (1, 0), (0, 1), (-1, 0))

LEVELS_SPEC = [{'rows': ['.............',
           '.............',
           '.............',
           '..333333333..',
           '..aaaaaaaaa..',
           '..aaaaaaaaa..',
           '..aaaaaaaaa..',
           '.............',
           '.............',
           '.............',
           '.............',
           '.............',
           '.............']},
 {'sun0': 0,
  'rows': ['.............',
           '...5.........',
           '...a.........',
           '...a.........',
           '...a.........',
           '...a.........',
           '...a.........',
           '.........a...',
           '.........a...',
           '.........a...',
           '.........a...',
           '.........a...',
           '.........5...']},
 {'sun0': 1,
  'rows': ['.............',
           '..3333333....',
           '..aaaaaaa....',
           '..aaaaaaa....',
           '..aaaaaaa....',
           '.............',
           '.............',
           '.............',
           '....aaaaaaa..',
           '....aaaaaaa..',
           '....aaaaaaa..',
           '....3333333..',
           '.............']},
 {'rows': ['.....55555...',
           '....5bbbbb...',
           '....5bbbbb...',
           '....5bbbbb...',
           '....5bbbbb...',
           '....5bbbbb...',
           '...........3.',
           '...........a.',
           '...........a.',
           '..aaaaa....a.',
           '..aaaaa......',
           '..aaaaa......',
           '..33333......']},
 {'rows': ['3333.........',
           'aaaa.........',
           'aaaa.b.aa3...',
           'aaaa.b.aa3...',
           '.....b.aa3...',
           '.....b.aa3...',
           '.....b.aa3...',
           '.....b.aa3...',
           '.....b.aa3...',
           '3aaa.b.aa3...',
           '3aaa.........',
           '3aaa.........',
           '3aaa.........']},
 {'rows': ['.............',
           '.3aaa....3aaa',
           '.3aaa....3aaa',
           '.3aaa....3aaa',
           '.3aaa....3aaa',
           '.............',
           '........44444',
           '........aaaaa',
           '...bbbbbaaaaa',
           '........aaaaa',
           '...aaaaaaaaaa',
           '...aaaaa.....',
           '...33333.....']}]

DEPTHS = {".": 0, "a": -1, "b": -2, "c": -3}


def heights(rows: list[str]) -> tuple[tuple[int, ...], ...]:
    return tuple(
        tuple(DEPTHS[c] if c in DEPTHS else int(c) for c in row)
        for row in rows
    )


def shade_map(field, sun: tuple[int, int]) -> list[list[int]]:
    reach = max(max(row) for row in field)
    out = [[0] * N for _ in range(N)]
    sx, sy = sun
    for y in range(N):
        for x in range(N):
            margin = 0
            for d in range(1, reach + 1 - min(0, field[y][x]) + 1):
                nx, ny = x + sx * d, y + sy * d
                if not (0 <= nx < N and 0 <= ny < N):
                    break
                margin = max(margin, field[ny][nx] - field[y][x] - d + 1)
            out[y][x] = min(max(margin, 0), len(TONES) - 1)
    return out


def block_at(field, cell: tuple[int, int]) -> frozenset:
    x, y = cell
    if not (0 <= x < N and 0 <= y < N) or field[y][x] < 1:
        return frozenset()
    tall = field[y][x]
    seen, stack = {cell}, [cell]
    while stack:
        cx, cy = stack.pop()
        for dx, dy in SUNS:
            nx, ny = cx + dx, cy + dy
            if (0 <= nx < N and 0 <= ny < N and (nx, ny) not in seen
                    and field[ny][nx] == tall):
                seen.add((nx, ny))
                stack.append((nx, ny))
    return frozenset(seen)


def shadow_of(field, solid: frozenset, sun: tuple[int, int]):
    if not solid:
        return None
    seed = next(iter(solid))
    tall = field[seed[1]][seed[0]]
    fx, fy = -sun[0], -sun[1]
    out = set()
    for x, y in solid:
        d = 0
        while True:
            d += 1
            nx, ny = x + fx * d, y + fy * d
            if not (0 <= nx < N and 0 <= ny < N):
                if d <= tall:
                    return None
                break
            if (nx, ny) in solid:
                break
            if tall - field[ny][nx] - d + 1 <= 0:
                break
            if field[ny][nx] >= 1:
                return None
            out.add((nx, ny))
    return out


def fell(field, cell: tuple[int, int], sun_index: int):
    solid = block_at(field, cell)
    landing = shadow_of(field, solid, SUNS[sun_index])
    if not landing:
        return None
    grid = [list(row) for row in field]
    for x, y in landing:
        grid[y][x] += 1
    for x, y in solid:
        grid[y][x] = 0
    return tuple(tuple(row) for row in grid)


def is_flat(field) -> bool:
    return all(v == 0 for row in field for v in row)


def build_levels() -> list[Level]:
    pad = lambda: Sprite(
        pixels=[[WALL] * (N * CELL) for _ in range(N * CELL)], name="board",
        blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
        layer=-2, tags=["sys_click", "sys_every_pixel"],
    ).set_position(INSET, INSET)
    return [Level(sprites=[pad()], grid_size=(64, 64)) for _ in LEVELS_SPEC]


WEDGE = (5, 4, 3, 2, 1)

TOPPLE_FRAMES = 12


class ShadowDisplay(RenderableUserDisplay):

    def __init__(self, game: "LongShadow") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        frame[:, :] = WALL
        frame[INSET-1:INSET+N*CELL+1, INSET-1:INSET+N*CELL+1] = 1
        shade = shade_map(g.field, SUNS[g.sun])
        for y in range(N):
            for x in range(N):
                px, py = INSET + x*CELL, INSET + y*CELL
                h = g.field[y][x]
                frame[py:py+CELL, px:px+CELL] = BLOCK if h > 0 else TONES[shade[y][x]]
                if h > 0:
                    frame[py,px:px+CELL] = BLOCK_EDGE
                    frame[py+CELL-1,px:px+CELL] = 13
                    for k in range(min(h,6)):
                        frame[py+1+k//3,px+k%3] = 0
                elif h < 0:
                    frame[py,px:px+CELL] = 10
                    frame[py:py+CELL,px] = 9
                    for k in range(-h): frame[py+2,px+1+k] = 10
                elif not shade[y][x] and (x+2*y)%5==0:
                    frame[py,px] = 12
        self._paint_seams(frame, g.field)
        if g.toppling:
            self._paint_topple(frame,g)
        self._paint_sun(frame,SUNS[g.sun])
        return frame

    def _paint_seams(self, frame: np.ndarray, field) -> None:
        for y in range(N):
            for x in range(N):
                if field[y][x] < 1:
                    continue
                px, py = INSET + x * CELL, INSET + y * CELL
                if x + 1 < N and 1 <= field[y][x + 1] != field[y][x]:
                    frame[py:py + CELL, px + CELL - 1] = BLOCK_EDGE
                if y + 1 < N and 1 <= field[y + 1][x] != field[y][x]:
                    frame[py + CELL - 1, px:px + CELL] = BLOCK_EDGE

    def _paint_topple(self, frame: np.ndarray, g: 'LongShadow') -> None:
        progress = (TOPPLE_FRAMES-g.toppling+1)/(TOPPLE_FRAMES+1)
        fx,fy = -SUNS[g.sun][0],-SUNS[g.sun][1]
        solid,landing = g.topple_from,g.topple_to
        if not landing: return
        origin = min(x*fx+y*fy for x,y in solid)
        reach = max(x*fx+y*fy for x,y in landing)-origin+1
        front = origin*CELL+progress*reach*CELL
        for x,y in landing:
            for j in range(CELL):
                for i in range(CELL):
                    along = (x*CELL+i)*fx+(y*CELL+j)*fy
                    if along <= front:
                        frame[INSET+y*CELL+j,INSET+x*CELL+i] = BLOCK_EDGE if front-along < 1.5 else BLOCK
        for x,y in solid:
            px,py=INSET+x*CELL,INSET+y*CELL
            for j in range(CELL):
                for i in range(CELL):
                    if (i+j*CELL)/(CELL*CELL) < progress: frame[py+j,px+i]=FLOOR_LIT

    def _paint_sun(self, frame: np.ndarray, sun: tuple[int, int]) -> None:
        sx, sy = sun
        mid = 32
        for offset in (-12, 0, 12):
            for k in range(3):
                if sy < 0: frame[2+k,32+offset] = SUN
                elif sy > 0: frame[61-k,32+offset] = SUN
                elif sx < 0: frame[32+offset,2+k] = SUN
                else: frame[32+offset,61-k] = SUN
        for depth, half in enumerate(WEDGE):
            lo, hi = mid - half, mid + half
            if sy < 0:
                frame[depth, lo:hi] = SUN
            elif sy > 0:
                frame[63 - depth, lo:hi] = SUN
            elif sx < 0:
                frame[lo:hi, depth] = SUN
            else:
                frame[lo:hi, 63 - depth] = SUN


class LongShadow(ARCBaseGame):

    def __init__(self) -> None:
        self.field = heights(LEVELS_SPEC[0]["rows"])
        self.sun = LEVELS_SPEC[0].get("sun0", 0)
        self.toppling = 0
        self.topple_from: frozenset = frozenset()
        self.topple_to: set = set()
        self.pending = self.field
        camera = Camera(
            width=64, height=64,
            background=WALL, letter_box=WALL,
            interfaces=[ShadowDisplay(self)],
        )
        super().__init__(game_id="g014", levels=build_levels(), camera=camera, available_actions=[5, 6])

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.field = heights(spec["rows"])
        self.sun = spec.get("sun0", 0)
        self.toppling = 0
        self.topple_from = frozenset()
        self.topple_to = set()
        self.pending = self.field

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def step(self) -> None:
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return

        if self.toppling:
            self.toppling -= 1
            if self.toppling == 0:
                self.field = self.pending
                self.topple_from = frozenset()
                self.topple_to = set()
                if is_flat(self.field):
                    self.next_level()
                    self.complete_action()
                    return
                self.sun = (self.sun + 1) % len(SUNS)
                self.complete_action()
            return

        if self.action.id not in (GameAction.ACTION5,GameAction.ACTION6):
            self.complete_action()
            return
        if self.action.id == GameAction.ACTION6:
            cell = ((self.action.data.get("x", 0) - INSET) // CELL,
                    (self.action.data.get("y", 0) - INSET) // CELL)
            landed = fell(self.field, cell, self.sun)
            if landed is not None:
                self.topple_from = block_at(self.field, cell)
                self.topple_to = shadow_of(self.field, self.topple_from, SUNS[self.sun])
                self.pending = landed
                self.toppling = TOPPLE_FRAMES
                return

        self.sun = (self.sun + 1) % len(SUNS)
        self.complete_action()
