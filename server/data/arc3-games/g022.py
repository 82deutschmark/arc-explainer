# ARC-AGI-3 candidate task g022.

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


HEARTH_FILL = 2
FLOOR_GRIT = 4
KILN_WALL = 15
WALL_SEAM = 3
FLUE_MARK = 14

SHADES = (5, 13, 8, 12, 11, 7, 0)
SPAN = 3

STEPS = {
    ".": 0, "S": 0, "M": 0,
    "p": 1, "q": 2, "m": -1, "n": -2,
}
VENTS = "pqmn"

COLS = 13
ROWS = 6
CELL = 8
HALF = 4

TOUCHING = {
    0: ((-1, 0), (1, 0), (0, 1)),
    1: ((-1, 0), (1, 0), (0, -1)),
}

EDGE_KEY = {
    GameAction.ACTION3: 0,
    GameAction.ACTION4: 1,
}


def edge_action(edge, x, y):
    if edge == 2:
        return GameAction.ACTION2 if (x + y) % 2 == 0 else GameAction.ACTION1
    return (GameAction.ACTION3, GameAction.ACTION4)[edge]


def edges_of(x, y):
    return TOUCHING[(x + y) % 2]


LEVELS_SPEC = [
    {"wants": 2, "rows": [
        "#############",
        "#SM.........#",
        "#..#######..#",
        "#...........#",
        "#####.q.#####",
        "#############",
    ]},
    {"wants": 3, "rows": [
        "#############",
        "#S..........#",
        "#....##.....#",
        "####.p.##...#",
        "#########..M#",
        "#############",
    ]},
    {"wants": 0, "rows": [
        "#############",
        "#S....m.....#",
        "#...#..##...#",
        "#.n.#...#...#",
        "#...##Mq#...#",
        "#############",
    ]},
    {"wants": 1, "rows": [
        "#############",
        "#S..n...m..q#",
        "#####..######",
        "######..#####",
        "#######qppM##",
        "#############",
    ]},
    {"wants": 2, "rows": [
        "#############",
        "#S....p...n.#",
        "##..#####..##",
        "#..#######..#",
        "#.mmpM#####.#",
        "#############",
    ]},
]


def _facets(up):
    out = []
    for j in range(CELL):
        reach = j if up else CELL - 1 - j
        out.append(tuple(i for i in range(CELL) if abs(2 * i + 1 - CELL) <= reach))
    return out


UP_FACETS = _facets(True)
DOWN_FACETS = _facets(False)


def facets_at(x, y):
    return UP_FACETS if (x + y) % 2 == 0 else DOWN_FACETS


def _seam(facets, up):
    solid = {(i, j) for j, run in enumerate(facets) for i in run}
    floor_row = CELL - 1 if up else 0
    return {(i, j) for (i, j) in solid
            if j != floor_row
            and any((i + a, j + b) not in solid
                    for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))}


UP_SEAM, DOWN_SEAM = _seam(UP_FACETS, True), _seam(DOWN_FACETS, False)


def seam_at(x, y):
    return UP_SEAM if (x + y) % 2 == 0 else DOWN_SEAM


def _heart(facets, seam):
    inner = [(i, j) for j, run in enumerate(facets) for i in run if (i, j) not in seam]
    mx = sum(i for i, _ in inner) / len(inner)
    my = sum(j for _, j in inner) / len(inner)
    return sorted(inner, key=lambda p: ((p[0] - mx) ** 2 + (p[1] - my) ** 2, p[1], p[0]))


UP_HEART = _heart(UP_FACETS, UP_SEAM)
DOWN_HEART = _heart(DOWN_FACETS, DOWN_SEAM)


def heart_at(x, y):
    return UP_HEART if (x + y) % 2 == 0 else DOWN_HEART


def _bar_rows(facets):
    wide = [j for j in range(CELL) if len(facets[j]) >= 4]
    return [wide[len(wide) * k // 3] for k in (0, 1, 2)]


def blank():
    return [[-1] * CELL for _ in range(CELL)]


def carve(x, y, body, edge, marks=()):
    facets, seam = facets_at(x, y), seam_at(x, y)
    px = blank()
    for j, run in enumerate(facets):
        for i in run:
            px[j][i] = edge if (i, j) in seam else body
    for i, j, colour in marks:
        if 0 <= j < CELL and i in facets[j]:
            px[j][i] = colour
    return px


def ash_face(x, y):
    marks = ()
    if (x * 7 + y * 5) % 3 == 0:
        spot = heart_at(x, y)[6]
        marks = [(spot[0], spot[1], FLOOR_GRIT)]
    return carve(x, y, HEARTH_FILL, WALL_SEAM, marks)


def slate_face(x, y):
    facets = facets_at(x, y)
    wide = max(range(CELL), key=lambda j: len(facets[j]))
    streak = [(i, wide, FLOOR_GRIT) for i in facets[wide][1:-1]]
    return carve(x, y, KILN_WALL, WALL_SEAM, streak)


def flue_face(x, y):
    facets = facets_at(x, y)
    bars = [(i, j, FLUE_MARK) for j in _bar_rows(facets) for i in facets[j][1:-1]]
    return carve(x, y, HEARTH_FILL, WALL_SEAM, bars)


def mould_face(x, y, shade):
    heart = heart_at(x, y)
    mouth = [(i, j, HEARTH_FILL) for i, j in heart[:6]]
    return carve(x, y, shade, WALL_SEAM, mouth)


def billet_face(x, y, base, charge):
    px = [[-1] * CELL for _ in range(CELL)]
    shade = SHADES[charge + SPAN]
    for i, j in UP_HEART[:1 + 3 * (charge + SPAN)]:
        px[j][i] = shade
    return px


def cinder_walks(rows, count=4):
    ash = [(x, y) for y, row in enumerate(rows)
           for x, g in enumerate(row) if g == "."]
    seen, walks = set(), []
    stride = max(1, len(ash) // (count * 3))
    for seed in ash[::stride]:
        if len(walks) == count:
            break
        if seed in seen:
            continue
        walk = [seed]
        while len(walk) < 3:
            hx, hy = walk[-1]
            nxt = [(hx + dx, hy + dy) for dx, dy in edges_of(hx, hy)]
            nxt = [c for c in nxt if c in ash and c not in walk and c not in seen]
            if not nxt:
                break
            walk.append(nxt[0])
        if len(walk) == 3:
            seen |= set(walk)
            walks.append(walk)
    return walks


def slag_spots(rows, count=3):
    out = []
    for y, row in enumerate(rows):
        for x, g in enumerate(row):
            if g != "#" or len(out) == count:
                continue
            near = [(x + dx, y + dy) for dx, dy in edges_of(x, y)]
            if any(0 <= b < ROWS and 0 <= a < COLS and rows[b][a] == "."
                   for a, b in near) and (x + y) % 3 == 0:
                out.append((x, y))
    return out


def build_levels():
    levels = []
    for index, spec in enumerate(LEVELS_SPEC):
        rows = spec["rows"]
        pieces = []
        for y, row in enumerate(rows):
            for x, glyph in enumerate(row):
                px, py = x * HALF, y * CELL
                if glyph == "#":
                    pieces.append(Sprite(
                        pixels=slate_face(x, y), name=f"slate_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-2,
                    ).set_position(px, py))
                    continue
                pieces.append(Sprite(
                    pixels=ash_face(x, y), name=f"ash_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-2,
                ).set_position(px, py))
                if glyph in VENTS:
                    pieces.append(Sprite(
                        pixels=flue_face(x, y), name=f"flue_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif glyph == "M":
                    pieces.append(Sprite(
                        pixels=mould_face(x, y, SHADES[spec["wants"] + SPAN]),
                        name="mould", blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["mould"],
                    ).set_position(px, py))

        for wi, walk in enumerate(cinder_walks(rows)):
            cx, cy = walk[0]
            spot = heart_at(cx, cy)[0]
            pieces.append(Sprite(
                pixels=[[FLUE_MARK]], name=f"cinder_{wi}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(cx * HALF + spot[0], cy * CELL + spot[1]))
        for si, (sx, sy) in enumerate(slag_spots(rows)):
            spot = heart_at(sx, sy)[1]
            pieces.append(Sprite(
                pixels=[[KILN_WALL], [KILN_WALL]], name=f"slag_{si}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(sx * HALF + spot[0], sy * CELL + spot[1]))
        for di in range(2):
            pieces.append(Sprite(
                pixels=[[FLOOR_GRIT, -1, FLOOR_GRIT]], name=f"soot_{di}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=2,
            ).set_position(4 + di * 21, 1 + di * 2))

        bx, by = _seat(index)
        pieces.append(Sprite(
            pixels=billet_face(bx, by, ash_face(bx, by), 0), name="billet",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=3,
        ).set_position(bx * HALF, by * CELL))
        levels.append(Level(sprites=pieces, grid_size=(COLS * HALF + HALF, ROWS * CELL)))
    return levels


def _seat(index):
    rows = LEVELS_SPEC[index]["rows"]
    for y, row in enumerate(rows):
        for x, g in enumerate(row):
            if g == "S":
                return x, y
    raise AssertionError(f"level {index} has no start")


def mould_of(index):
    rows = LEVELS_SPEC[index]["rows"]
    for y, row in enumerate(rows):
        for x, g in enumerate(row):
            if g == "M":
                return x, y
    raise AssertionError(f"level {index} has no mould")


class Ember(ARCBaseGame):

    def __init__(self):
        self.charge = 0
        self.cell = _seat(0)
        self.draught = 0
        camera = Camera(
            width=COLS * HALF + HALF, height=ROWS * CELL,
            background=WALL_SEAM, letter_box=KILN_WALL,
        )
        super().__init__(game_id="g022", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])

    def on_set_level(self, level):
        clear_translation(self)
        self.charge = 0
        self.cell = _seat(self.level_index)
        self.draught = 0
        self._redraw()

    def level_reset(self):
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _redraw(self):
        x, y = self.cell
        glyph = LEVELS_SPEC[self.level_index]["rows"][y][x]
        base = flue_face(x, y) if glyph in VENTS else ash_face(x, y)
        for s in self.current_level.get_sprites_by_name("billet"):
            s.pixels[:, :] = billet_face(x, y, base, self.charge)
            s.set_position(x * HALF, y * CELL)

    def _dress(self):
        level, rows = self.current_level, LEVELS_SPEC[self.level_index]["rows"]
        for wi, walk in enumerate(cinder_walks(rows)):
            cx, cy = walk[(self.draught + wi) % len(walk)]
            spot = heart_at(cx, cy)[0]
            for s in level.get_sprites_by_name(f"cinder_{wi}"):
                s.set_position(cx * HALF + spot[0], cy * CELL + spot[1])
        for si in range(len(slag_spots(rows))):
            lit = KILN_WALL if (self.draught + si) % 4 < 2 else WALL_SEAM
            for s in level.get_sprites_by_name(f"slag_{si}"):
                s.pixels[:, :] = [[lit], [lit]]
        for di in range(2):
            for s in level.get_sprites_by_name(f"soot_{di}"):
                s.set_position(2 + (self.draught * (di + 1) + di * 21) % 50,
                               1 + di * 2)

    def step(self):
        if advance_translation(self):
            return
        begin_translation(self, ('billet',), limit=CELL)
        edge = EDGE_KEY.get(self.action.id)
        if self.action.id == edge_action(2, *self.cell):
            edge = 2
        if edge is not None:
            self.draught += 1
            self._advance(edge)
            self._dress()
        finish_translation(self)

    def _advance(self, edge):
        spec = LEVELS_SPEC[self.level_index]
        rows, wants = spec["rows"], spec["wants"]
        x, y = self.cell
        dx, dy = edges_of(x, y)[edge]
        nx, ny = x + dx, y + dy
        if not (0 <= nx < COLS and 0 <= ny < ROWS):
            return
        glyph = rows[ny][nx]

        if glyph == "#":
            return
        if glyph == "M":
            if self.charge == wants:
                self.next_level()
            return

        nxt = self.charge + STEPS[glyph]
        if abs(nxt) > SPAN:
            self.level_reset()
            return
        self.cell = (nx, ny)
        self.charge = nxt
        self._redraw()
