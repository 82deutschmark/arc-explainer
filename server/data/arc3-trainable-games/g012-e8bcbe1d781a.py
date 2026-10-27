# ARC-AGI-3 candidate task g012.

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

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

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

def facing(body: int, visor: int, heading: tuple, cell: int = 4) -> list[list[int]]:
    px = rounded(body, cell)
    dx, dy = heading
    last = cell - 1
    if dy < 0:
        px[0][1] = px[0][cell - 2] = visor
    elif dy > 0:
        px[last][1] = px[last][cell - 2] = visor
    elif dx < 0:
        px[1][0] = px[cell - 2][0] = visor
    elif dx > 0:
        px[1][last] = px[cell - 2][last] = visor
    else:
        px[1][1] = visor
    return px

def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
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


TURF_TILE = 14
PALE_BLOCK = 0
POACHER_FILL = 4
POACHER_MARK = 0
KEEPER_FILL = 12
KEEPER_MARK = 4
SCENT_TRAIL = 12
STONE_FILL = 1
STONE_MARK = 13
GATE_FRAME = 13
GATE_BAR = 0
CAIRN_SOCKET_MARK = 13
CAIRN_MARK = 1
THISTLE_MARK = 1

W = 15
H = 11
CELL = 4
PERIOD = 8
SCENT_LEN = 3
DECOY_PERIOD = 3

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0), ".": (0, 0)}

LEVELS_SPEC = [
    {
        "rows": [
            "###############",
            "#..P..........#",
            "#.............#",
            "#.C.........C.#",
            "#.............#",
            "####.....######",
            "#.............#",
            "#.............#",
            "#.............#",
            "#.........X...#",
            "###############",
        ],
        "keepers": [
            {"anchor": (6, 6), "offset": 2, "rounds": ["RRRRLLLL", "UUUUDDDD"]},
        ],
        "cairn": [(4, 7), (3, 7)],
    },
    {
        "rows": [
            "###############",
            "#.............#",
            "#..P.......C..#",
            "#.............#",
            "#####...#######",
            "#.............#",
            "#..C.......C..#",
            "#.............#",
            "#######...#####",
            "#.......X.....#",
            "###############",
        ],
        "keepers": [
            {"anchor": (6, 5), "offset": 0,
             "rounds": ["RRRRLLLL", "DDUUDDUU", "RRDDLLUU"]},
        ],
        "cairn": [(10, 7), (9, 6), (10, 6)],
    },
    {
        "rows": [
            "###############",
            "#.............#",
            "#.P...........#",
            "#....##..##...#",
            "#..C.......C..#",
            "#.............#",
            "#.....###.....#",
            "#..C.......C..#",
            "#.........X...#",
            "#.............#",
            "###############",
        ],
        "keepers": [
            {"anchor": (2, 5), "offset": 0, "rounds": ["DDDDUUUU", "RRDDLLUU"]},
            {"anchor": (9, 5), "offset": 4,
             "rounds": ["RRRRLLLL", "DDDDUUUU", "RLRLRLRL"]},
        ],
        "cairn": [(8, 5), (7, 4), (8, 4), (7, 5)],
    },
    {
        "rows": [
            "###############",
            "#.P.......#####",
            "#.........#...#",
            "#.........#.C.#",
            "#.........#...#",
            "#.............#",
            "#.........#...#",
            "#.........#.C.#",
            "#.....C...#...#",
            "#...X.....#####",
            "###############",
        ],
        "keepers": [
            {"anchor": (5, 5), "offset": 2, "rounds": ["RRRRLLLL", "DDDDUUUU"]},
            {"anchor": (10, 5), "offset": 0, "rounds": ["LLLLRRRR", "........"]},
        ],
        "cairn": [(8, 3), (7, 2), (8, 2)],
    },
    {
        "rows": [
            "###############",
            "#.C.........C.#",
            "#.............#",
            "#....#####....#",
            "#.P...........#",
            "#.............#",
            "#..####.####..#",
            "#.........C...#",
            "#####.#########",
            "#..X.......C..#",
            "###############",
        ],
        "keepers": [
            {"anchor": (5, 9), "offset": 4,
             "rounds": ["LLLLRRRR", "........", "RLRLRLRL", "LLRRLLRR"]},
            {"anchor": (2, 4), "offset": 7,
             "rounds": ["DDDUUU..", "RRRRLLLL", "DDUUDDUU"]},
        ],
        "cairn": [(9, 5), (8, 4), (9, 4), (8, 5)],
    },
    {
        "rows": [
            "###############",
            "#.C.......#.C.#",
            "#.........#...#",
            "#..P......#...#",
            "#....###..#...#",
            "#.C.......#...#",
            "#.........###.#",
            "#....###......#",
            "#.C.......C...#",
            "#..X..........#",
            "###############",
        ],
        "keepers": [
            {"anchor": (5, 5), "offset": 0, "rounds": ["RRRRLLLL", "RLRLRLRL"]},
            {"anchor": (2, 6), "offset": 3,
             "rounds": ["DDDUUU..", "RRDDLLUU", "UUUDDD.."]},
            {"anchor": (13, 6), "offset": 5,
             "rounds": ["UUUUDDDD", "........", "DDDUUU..", "DDUUDDUU"]},
        ],
        "cairn": [(7, 2), (6, 1), (8, 1), (6, 2), (7, 1)],
    },
]


def _wide_room(dividers, start, stones, gate, keepers):
    rows = [["#" if x in (0, 22) or y in (0, H - 1) else "."
             for x in range(23)] for y in range(H)]
    for x, gap in dividers:
        for y in range(1, H - 1):
            rows[y][x] = "." if y == gap else "#"
    for (x, y), glyph in [(start, "P"), (gate, "X")] + [(c, "C") for c in stones]:
        rows[y][x] = glyph
    return {"rows": ["".join(r) for r in rows], "keepers": keepers,
            "cairn": [(3 + i, 8) for i in range(len(stones))]}


LEVELS_SPEC.extend([
    _wide_room([(11, 5)], (3, 1), [(3, 7), (19, 3), (19, 7)], (3, 9), [
        {"anchor": (11, 5), "offset": 0, "rounds": ["LLLLRRRR", "........"], "body": 3},
        {"anchor": (17, 5), "offset": 2, "rounds": ["RRRRLLLL", "DDDUUU.."], "body": 3},
    ]),
    _wide_room([(8, 3), (15, 7)], (2, 1), [(3, 6), (20, 2), (20, 8)], (2, 9), [
        {"anchor": (8, 3), "offset": 0, "rounds": ["LLLLRRRR", "........"], "body": 3},
        {"anchor": (15, 7), "offset": 4, "rounds": ["RRRRLLLL", "........"], "body": 2},
    ]),
])


def walls(spec) -> set:
    return {(x, y) for y, r in enumerate(spec["rows"])
            for x, c in enumerate(r) if c == "#"}


def find(spec, ch) -> list:
    return [(x, y) for y, r in enumerate(spec["rows"])
            for x, c in enumerate(r) if c == ch]


def round_cells(spec, keeper, path: str) -> list:
    if len(path) != PERIOD:
        raise ValueError(f"round {path!r} is not {PERIOD} steps")
    blocked = walls(spec)
    x, y = keeper["anchor"]
    cells = []
    for ch in path:
        cells.append((x, y))
        dx, dy = DIRS[ch]
        x, y = x + dx, y + dy
        if (x, y) in blocked or not (0 <= x < len(spec["rows"][0]) and 0 <= y < H):
            raise ValueError(f"round {path!r} from {keeper['anchor']} hits stone at {(x, y)}")
    if (x, y) != tuple(keeper["anchor"]):
        raise ValueError(f"round {path!r} from {keeper['anchor']} does not close")
    return cells


ROUNDS = [[[round_cells(s, k, r) for r in k["rounds"]] for k in s["keepers"]]
          for s in LEVELS_SPEC]


def keeper_cells(level: int, phase: int, tick: int) -> tuple:
    out = []
    for ki, keeper in enumerate(LEVELS_SPEC[level]["keepers"]):
        fam = ROUNDS[level][ki]
        cells = fam[phase % len(fam)]
        out.append(cells[(tick + keeper["offset"]) % PERIOD])
    return tuple(out)


def body_cells(level, phase, tick):
    return {keeper_cells(level, phase, tick - age)[i]
            for i, keeper in enumerate(LEVELS_SPEC[level]["keepers"])
            for age in range(1, keeper.get("body", 0) + 1)}


def advance(level: int, pos, stones: frozenset, tick: int, move):
    spec = LEVELS_SPEC[level]
    blocked = walls(spec)
    dx, dy = move
    nx, ny = pos[0] + dx, pos[1] + dy
    phase_before = len(spec["stones_all"]) - len(stones)
    if not (0 <= nx < len(spec["rows"][0]) and 0 <= ny < H) or (nx, ny) in blocked \
            or (nx, ny) in body_cells(level, phase_before, tick):
        nx, ny = pos
    new_pos = (nx, ny)
    new_stones = stones - {new_pos} if new_pos in stones else stones
    phase = len(spec["stones_all"]) - len(new_stones)
    ntick = tick + 1
    before = keeper_cells(level, phase, tick)
    after = keeper_cells(level, phase, ntick)
    dead = new_pos in after or new_pos in body_cells(level, phase, ntick)
    if not dead:
        for b, a in zip(before, after):
            if b == new_pos and a == pos:
                dead = True
                break
    return new_pos, new_stones, ntick, dead


for _spec in LEVELS_SPEC:
    _spec["stones_all"] = frozenset(find(_spec, "C"))
    _spec["start"] = find(_spec, "P")[0]
    _spec["gate"] = find(_spec, "X")[0]
    _spec.setdefault("cairn", [])


def thistles(spec) -> list:
    taken = set(spec["stones_all"]) | {spec["start"], spec["gate"]} | set(spec["cairn"])
    blocked = walls(spec)
    return [(x, y) for y in range(H) for x in range(len(spec["rows"][0]))
            if (x * 5 + y * 3) % 11 == 0 and (x, y) not in blocked and (x, y) not in taken]


def _stonework() -> list:
    return [[PALE_BLOCK] * CELL for _ in range(CELL)]


def _scent(age: int) -> list:
    px = [[-1] * CELL for _ in range(CELL)]
    px[1][1] = SCENT_TRAIL
    if age < 2:
        px[2][2] = SCENT_TRAIL
    if age < 1:
        px[1][2] = px[2][1] = SCENT_TRAIL
    return px


def _body():
    return [[13, 12, 12, 13], [12, 11, 12, 12],
            [12, 12, 11, 12], [13, 12, 12, 13]]


def _stone() -> list:
    return medallion(STONE_FILL, STONE_MARK, CELL)


def _keeper(heading: tuple) -> list:
    return facing(KEEPER_FILL, KEEPER_MARK, heading, CELL)


def _poacher(lit: bool = False) -> list:
    return figure(KEEPER_FILL if lit else POACHER_FILL, POACHER_MARK, CELL)


def _gate(shut: bool) -> list:
    return door(GATE_FRAME, GATE_BAR if shut else None, CELL)


def _socket() -> list:
    return ring(CAIRN_SOCKET_MARK, CELL)


def _banked(filled: bool) -> list:
    return core(CAIRN_MARK, CELL) if filled else [[-1] * CELL for _ in range(CELL)]


def _thistle(seed: int) -> list:
    return speckle(THISTLE_MARK, seed, CELL)


def _fitting(phase: int, seed: int) -> list:
    px = [[-1] * CELL for _ in range(CELL)]
    tone = (GATE_FRAME, TURF_TILE, POACHER_FILL)[(phase + seed) % DECOY_PERIOD]
    px[1][1] = px[CELL - 2][CELL - 2] = tone
    return px


def build_levels() -> list:
    levels = []
    for li, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_stonework(), name=f"stonework_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                    if (x * 7 + y * 3) % 5 == 0:
                        sprites.append(Sprite(
                            pixels=_fitting(0, (x + y) % DECOY_PERIOD),
                            name=f"fitting_{x}_{y}",
                            blocking=BlockingMode.NOT_BLOCKED,
                            interaction=InteractionMode.INTANGIBLE, layer=0,
                            tags=["decor"],
                        ).set_position(px, py))
                elif char == "C":
                    sprites.append(Sprite(
                        pixels=_stone(), name=f"stone_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0, tags=["stone"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_gate(True), name="gate",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))
        for tx, ty in thistles(spec):
            sprites.append(Sprite(
                pixels=_thistle((tx * 3 + ty) % 5), name=f"thistle_{tx}_{ty}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=-1, tags=["decor"],
            ).set_position(tx * CELL, ty * CELL))
        for ci, (cx, cy) in enumerate(spec["cairn"]):
            sprites.append(Sprite(
                pixels=_socket(), name=f"socket_{ci}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
            ).set_position(cx * CELL, cy * CELL))
            sprites.append(Sprite(
                pixels=_banked(False), name=f"banked_{ci}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(cx * CELL, cy * CELL))
        sx, sy = spec["start"]
        sprites.append(Sprite(
            pixels=_poacher(), name="poacher",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=3,
        ).set_position(sx * CELL, sy * CELL))
        for ki in range(len(spec["keepers"])):
            for k in range(max(SCENT_LEN, spec["keepers"][ki].get("body", 0))):
                cx, cy = keeper_cells(li, 0, -1 - k)[ki]
                sprites.append(Sprite(
                    pixels=_body() if spec["keepers"][ki].get("body") else _scent(k), name=f"scent_{ki}_{k}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0,
                ).set_position(cx * CELL, cy * CELL))
            gx, gy = keeper_cells(li, 0, 0)[ki]
            sprites.append(Sprite(
                pixels=_keeper((0, 0)), name=f"keeper_{ki}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=2,
            ).set_position(gx * CELL, gy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(min(64, len(spec["rows"][0]) * CELL), H * CELL)))
    return levels


class G012(ARCBaseGame):

    CAUGHT_FRAMES = 6

    def __init__(self) -> None:
        self._caught = 0

        self.pos = LEVELS_SPEC[0]["start"]
        self.stones = LEVELS_SPEC[0]["stones_all"]
        self.tick = 0
        self.deaths = 0
        camera = Camera(
            width=W * CELL, height=H * CELL,
            background=TURF_TILE, letter_box=PALE_BLOCK,
        )
        super().__init__(game_id="g012", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        spec = LEVELS_SPEC[self.level_index]
        self.camera.width = min(64, len(spec["rows"][0]) * CELL)
        self.camera.x = 0
        self.pos = spec["start"]
        self.stones = spec["stones_all"]
        self.tick = 0
        self._caught = 0

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.deaths = 0
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self) -> None:
        level = self.current_level
        spec = LEVELS_SPEC[self.level_index]
        phase = len(spec["stones_all"]) - len(self.stones)
        here = keeper_cells(self.level_index, phase, self.tick)
        nxt = keeper_cells(self.level_index, phase, self.tick + 1)
        for ki, (gx, gy) in enumerate(here):
            ax, ay = nxt[ki]
            for s in level.get_sprites_by_name(f"keeper_{ki}"):
                s.pixels = np.array(_keeper((ax - gx, ay - gy)))
                s.set_position(gx * CELL, gy * CELL)
            for k in range(max(SCENT_LEN, spec["keepers"][ki].get("body", 0))):
                tx, ty = keeper_cells(self.level_index, phase, self.tick - 1 - k)[ki]
                for s in level.get_sprites_by_name(f"scent_{ki}_{k}"):
                    s.set_position(tx * CELL, ty * CELL)
        for s in level.get_sprites_by_name("poacher"):
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        self.camera.x = max(0, min(len(spec["rows"][0]) * CELL - self.camera.width,
                                   self.pos[0] * CELL - self.camera.width // 2))
        for ci in range(len(spec["cairn"])):
            for s in level.get_sprites_by_name(f"banked_{ci}"):
                s.pixels = np.array(_banked(ci < phase))
        for s in level.get_sprites_by_tag("decor"):
            gx, gy = s.x // CELL, s.y // CELL
            if (gx, gy) in walls(spec):
                s.pixels = np.array(_fitting(self.tick, (gx + gy) % DECOY_PERIOD))
        for s in level.get_sprites_by_name("gate"):
            s.pixels = np.array(_gate(bool(self.stones)))

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('poacher', 'keeper_*'), limit=CELL)
        if self._caught:
            self._caught -= 1
            for sp in self.current_level.get_sprites_by_name("poacher"):
                sp.pixels = np.array(_poacher(lit=self._caught % 2 == 0))
            if self._caught == 0:
                self.level_reset()
                finish_translation(self)
            return

        move = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
            GameAction.ACTION5: (0, 0),
        }.get(self.action.id)
        if move is None:
            finish_translation(self)
            return

        spec = LEVELS_SPEC[self.level_index]
        before = self.stones
        self.pos, self.stones, self.tick, dead = advance(
            self.level_index, self.pos, self.stones, self.tick, move)

        for cx, cy in before - self.stones:
            for s in self.current_level.get_sprites_by_name(f"stone_{cx}_{cy}"):
                self.current_level.remove_sprite(s)

        if dead:
            self.deaths += 1
            self._redraw()
            self._caught = self.CAUGHT_FRAMES
            return

        self._redraw()
        if not self.stones and self.pos == spec["gate"]:
            self.next_level()
        finish_translation(self)
