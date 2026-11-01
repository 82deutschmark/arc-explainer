# ARC-AGI-3 candidate task g026.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
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


TIDE_FILL = 9
BANK_WALL = 1
LANTERN_GOAL = 11
WADER_PIP = 6
WRACK_MARK = 5
SILT_MARK = 10
EDDY_INK = (0, 8, 15, 13)

N = 14
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (0, 0),
}


def sustain(cells, hold=0, phase=0):
    cells = [tuple(c) for c in cells]
    if len(cells) == 1:
        return cells
    loop = cells + [cells[-1]] * hold + list(reversed(cells[1:-1]))
    cut = phase % len(loop)
    return loop[cut:] + loop[:cut]


def held(cell):
    return sustain([cell])


LEVELS_SPEC = [
    {"rows": [
        "##############",
        "#............#",
        "#............#",
        "#............#",
        "#....#####...#",
        "#....#...#...#",
        "#....#.*.#...#",
        "#....#...#...#",
        "#....##.##...#",
        "#............#",
        "#............#",
        "#..o.........#",
        "#............#",
        "##############",
     ], "voices": [
        held((7, 8)),
        sustain([(2, 2), (3, 2)]),
        sustain([(11, 10), (11, 9)], hold=1),
        sustain([(2, 5), (2, 6), (2, 7)], hold=1),
     ]},

    {"rows": [
        "##############",
        "#.....#......#",
        "#.....#...*..#",
        "#............#",
        "#.....#......#",
        "#.....#......#",
        "#.....#......#",
        "#.....#......#",
        "###.##########",
        "#............#",
        "#............#",
        "#..o.........#",
        "#............#",
        "##############",
     ], "voices": [
        held((3, 8)),
        sustain([(5, 3), (6, 3)]),
        sustain([(6, 3), (7, 3)], hold=1, phase=1),
        sustain([(3, 10), (4, 10), (5, 10)], hold=1),
     ]},

    {"rows": [
        "##############",
        "#............#",
        "#.##########.#",
        "#.#........#.#",
        "#.#.######.#.#",
        "#.#.#....#.#.#",
        "#.#.#.*..#.#.#",
        "#.#.#....#.#.#",
        "#.#.#....#.#.#",
        "#.#.###.##.#.#",
        "#.#........#.#",
        "#.##.#######.#",
        "#..o.........#",
        "##############",
     ], "voices": [
        sustain([(7, 7), (7, 8)]),
        sustain([(7, 10), (7, 9)], hold=1),
        sustain([(7, 7), (7, 8), (7, 9)], hold=1),
     ]},

    {"rows": [
        "##############",
        "#o...........#",
        "#.##.##.##.#.#",
        "#.##.##.##.#.#",
        "#......#.....#",
        "######..######",
        "######..######",
        "#######......#",
        "#.....##.....#",
        "#.###....###.#",
        "#.#...*...##.#",
        "#.#........#.#",
        "#..........#.#",
        "##############",
     ], "voices": [
        sustain([(6, 5), (7, 5)], phase=1),
        sustain([(7, 5), (7, 6)], hold=1, phase=2),
        sustain([(6, 5), (6, 6), (7, 6)], hold=1, phase=1),
     ]},

    {"rows": [
        "##############",
        "#.o..........#",
        "#............#",
        "#####=########",
        "#............#",
        "#......#.....#",
        "######..######",
        "#######.######",
        "#............#",
        "#............#",
        "#.....*......#",
        "#............#",
        "#............#",
        "##############",
     ], "voices": [
        sustain([(6, 6), (7, 6)]),
        sustain([(7, 6), (7, 7)], hold=1, phase=2),
        sustain([(6, 6), (7, 6), (7, 7)], hold=1, phase=1),
     ]},

    {"rows": [
        "##############",
        "#o...........#",
        "#...........##",
        "##=.........##",
        "###.........##",
        "####........##",
        "#####.......##",
        "######......##",
        "######.....###",
        "######.#######",
        "#............#",
        "#....=.......#",
        "#.....*......#",
        "##############",
     ], "voices": [
        sustain([(6, 8), (6, 9)]),
        sustain([(6, 10), (6, 9)], hold=1, phase=2),
        sustain([(6, 7), (6, 8), (6, 9)], hold=1, phase=4),
     ]},
]


LEVELS_SPEC.append({"rows": [
    "##############", "#o...........#", "#............#", "#####=########",
    "#............#", "######..######", "#######.######", "#............#",
    "#######=######", "#............#", "######..######", "#######.######",
    "#.....*......#", "##############",
], "voices": [
    sustain([(6, 5), (7, 5)]),
    sustain([(7, 5), (7, 6)], hold=1, phase=2),
    sustain([(6, 5), (7, 5), (7, 6)], hold=1, phase=1),
    sustain([(6, 10), (7, 10)], phase=1),
    sustain([(7, 10), (7, 11)], hold=1),
    sustain([(6, 10), (7, 10), (7, 11)], hold=1, phase=3),
]})


def _find(index, mark):
    rows = LEVELS_SPEC[index]["rows"]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == mark:
                return (x, y)
    raise AssertionError(f"level {index} has no {mark!r}")


def start_of(index):
    return _find(index, "o")


def goal_of(index):
    return _find(index, "*")


def seals_of(index):
    rows = LEVELS_SPEC[index]["rows"]
    return [(x, y) for y, row in enumerate(rows)
            for x, ch in enumerate(row) if ch == "="]


def board_period(index):
    from math import gcd
    p = 1
    for loop in LEVELS_SPEC[index]["voices"]:
        p = p * len(loop) // gcd(p, len(loop))
    return p


def voice_cells(index, tick):
    return [loop[tick % len(loop)] for loop in LEVELS_SPEC[index]["voices"]]


def doubled(index, cell, tick):
    return voice_cells(index, tick).count(cell) >= 2


def advance(index, pos, tick, shut, move):
    rows = LEVELS_SPEC[index]["rows"]
    seals = set(seals_of(index))
    nx, ny = pos[0] + move[0], pos[1] + move[1]
    nxt = pos
    if 0 <= nx < N and 0 <= ny < N and rows[ny][nx] != "#" and (nx, ny) not in shut:
        nxt = (nx, ny)
    if nxt != pos and pos in seals:
        shut = shut | frozenset({pos})
    tick += 1
    return nxt, tick, shut, doubled(index, nxt, tick)


CORNERS = ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1))


def _slab(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _bank(x, y):
    px = _slab(BANK_WALL)
    px[CELL - 1] = [WRACK_MARK] * CELL
    px[0][(x + y) % CELL] = WRACK_MARK
    return px


def _lamp():
    px = _slab(LANTERN_GOAL)
    for (y, x) in CORNERS:
        px[y][x] = -1
    px[1][1] = WRACK_MARK
    px[2][2] = WRACK_MARK
    return px


def _ring(colour):
    px = [[-1] * CELL for _ in range(CELL)]
    for i in range(CELL):
        px[0][i] = px[CELL - 1][i] = colour
        px[i][0] = px[i][CELL - 1] = colour
    for (y, x) in CORNERS:
        px[y][x] = -1
    return px


def _overlap_face(active):
    if active:
        return [[8 if x == y or x + y == CELL - 1 else 11
                 for x in range(CELL)] for y in range(CELL)]
    return [[10 if (x, y) in ((0, 0), (3, 3)) else -1
             for x in range(CELL)] for y in range(CELL)]


SWIRL_CORNER = CORNERS


def _swirl(colour, eddy_index):
    px = [[-1] * CELL for _ in range(CELL)]
    ty, tx = SWIRL_CORNER[eddy_index % len(SWIRL_CORNER)]
    px[ty][tx] = colour
    return px


def _silt(colour):
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(CELL)]
            for y in range(CELL)]


def _wader(under):
    px = [[-1] * CELL for _ in range(CELL)]
    for j in (1, 2):
        for i in (1, 2):
            px[j][i] = WADER_PIP
    px[0][1] = px[CELL - 1][2] = WRACK_MARK
    return px


def _open_water():
    return [[-1] * CELL for _ in range(CELL)]


def under_face(index, pos, shut):
    if pos in seals_of(index) and pos not in shut:
        return _silt(SILT_MARK)
    return _open_water()


def ripple_lanes(index, count=6):
    rows = LEVELS_SPEC[index]["rows"]
    lanes = [y for y, row in enumerate(rows) if row.count(".") >= 9] or [y for y in range(1, N)]
    return [lanes[i % len(lanes)] for i in range(count)]


def shell_spots(index, count=6):
    rows = LEVELS_SPEC[index]["rows"]
    water = [(x, y) for y, row in enumerate(rows)
             for x, ch in enumerate(row) if ch == "."]
    loops = {c for loop in LEVELS_SPEC[index]["voices"] for c in loop}
    water = [c for c in water if c not in loops and c != start_of(index)]
    stride = max(1, len(water) // count)
    return water[::stride][:count]


def wrack_spots(index, count=5):
    rows = LEVELS_SPEC[index]["rows"]
    out = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." or len(out) == count:
                continue
            near = ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if any(0 <= b < N and 0 <= a < N and rows[b][a] == "#" for a, b in near) \
                    and (x * 3 + y) % 7 == 0:
                out.append((x, y))
    return out


def build_levels():
    levels = []
    for index, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_bank(x, y), name=f"bank_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-3,
                    ).set_position(px, py))
                elif ch == "*":
                    sprites.append(Sprite(
                        pixels=_lamp(), name="lantern",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif ch == "=":
                    sprites.append(Sprite(
                        pixels=_slab(BANK_WALL), name=f"silted_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                    sprites.append(Sprite(
                        pixels=_silt(SILT_MARK), name=f"ford_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))

        for li, lane in enumerate(ripple_lanes(index)):
            sprites.append(Sprite(
                pixels=[[SILT_MARK, -1, SILT_MARK, -1]], name=f"ripple_{li}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-4,
            ).set_position((li * 5) % N * CELL, lane * CELL + 2))
        for si, (sx, sy) in enumerate(shell_spots(index)):
            sprites.append(Sprite(
                pixels=[[EDDY_INK[0]]], name=f"shell_{si}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-4,
            ).set_position(sx * CELL + 2, sy * CELL + 1))
        for wi, (wx, wy) in enumerate(wrack_spots(index)):
            sprites.append(Sprite(
                pixels=[[WRACK_MARK, WRACK_MARK]], name=f"wrack_{wi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-4,
            ).set_position(wx * CELL + 1, wy * CELL + 2))

        overlap = {c for loop in spec["voices"] for c in loop
                   if sum(c in other for other in spec["voices"]) >= 2}
        for cx, cy in overlap:
            sprites.append(Sprite(
                pixels=_overlap_face(doubled(index, (cx, cy), 0)),
                name=f"overlap_{cx}_{cy}", blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=3,
            ).set_position(cx * CELL, cy * CELL))
        for vi, loop in enumerate(spec["voices"]):
            ink = EDDY_INK[vi % len(EDDY_INK)]
            for (cx, cy) in sorted(set(loop)):
                sprites.append(Sprite(
                    pixels=_swirl(ink, vi), name=f"swirl_{vi}_{cx}_{cy}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(cx * CELL, cy * CELL))
            vx, vy = loop[0]
            sprites.append(Sprite(
                pixels=_ring(ink), name=f"eddy_{vi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(vx * CELL, vy * CELL))

        sx, sy = start_of(index)
        sprites.append(Sprite(
            pixels=_wader(under_face(index, (sx, sy), frozenset())), name="wader",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))

        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G026(ARCBaseGame):

    def __init__(self):
        self.pos = start_of(0)
        self.tick = 0
        self.shut = frozenset()
        self.wash = 0
        self._pause = 0
        self._pending = None
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=TIDE_FILL, letter_box=WRACK_MARK,
        )
        super().__init__(game_id="g026", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level):
        clear_translation(self)
        self.pos = start_of(self.level_index)
        self.tick = 0
        self.shut = frozenset()
        self.wash = 0
        self._pause = 0
        self._pending = None

    def level_reset(self):
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self):
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self):
        level = self.current_level
        for vi, (cx, cy) in enumerate(voice_cells(self.level_index, self.tick)):
            for s in level.get_sprites_by_name(f"eddy_{vi}"):
                s.set_position(cx * CELL, cy * CELL)
        for s in level.get_sprites():
            if s.name.startswith("overlap_"):
                _, cx, cy = s.name.split("_")
                s.pixels[:, :] = _overlap_face(
                    doubled(self.level_index, (int(cx), int(cy)), self.tick))
        for s in level.get_sprites_by_name("wader"):
            s.pixels[:, :] = _wader(under_face(self.level_index, self.pos, self.shut))
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        for (sx, sy) in self.shut:
            for s in level.get_sprites_by_name(f"ford_{sx}_{sy}"):
                level.remove_sprite(s)

    def _dress(self):
        level = self.current_level
        for li, lane in enumerate(ripple_lanes(self.level_index)):
            for s in level.get_sprites_by_name(f"ripple_{li}"):
                s.set_position(((li * 5 + self.wash) % N) * CELL, lane * CELL + 2)
        for wi in range(len(wrack_spots(self.level_index))):
            lit = WRACK_MARK if (self.wash + wi) % 3 else -1
            for s in level.get_sprites_by_name(f"wrack_{wi}"):
                s.pixels[:, :] = [[lit, lit]]

    def step(self):
        if advance_translation(self):
            return
        begin_translation(self, ('wader',), limit=CELL)
        if self._pause:
            self._pause -= 1
            if self._pause == 0:
                pending = self._pending
                self._pending = None
                if pending == "reset":
                    self.level_reset()
                elif pending == "advance":
                    self.next_level()
                finish_translation(self)
            return
        move = DIRS.get(self.action.id)
        if move is None:
            finish_translation(self)
            return

        self.wash += 1
        self.pos, self.tick, self.shut, dead = advance(
            self.level_index, self.pos, self.tick, self.shut, move)

        self._redraw()
        self._dress()
        if dead:
            self._pause, self._pending = 7, "reset"
            return
        if self.pos == goal_of(self.level_index):
            self._pause, self._pending = 4, "advance"
            return
        finish_translation(self)
