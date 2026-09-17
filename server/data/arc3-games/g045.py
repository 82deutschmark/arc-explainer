# ARC-AGI-3 candidate task g045.

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


WATER = 5
FLOOR = 2
AVATAR = 8
CRATE = 12
GOAL = 12
GATE = 1
PIP_LIT = 1
PIP_DIM = 3

SLIP = {"A": 10, "B": 14, "C": 15, "D": 6}

W, H = 20, 13
CELL = 6
VIEW_W, VIEW_H = 64, 48
XOFF, YOFF = 0, 8

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
    {"budget": 24, "lock_beat": None, "needs": ("slips",), "rows": [
        "                    ",
        "   .......          ",
        "  .........  .......",
        "  .........  .......",
        "  ...A.....  .B.....",
        "  .........  .c.....",
        "  P........  .......",
        "  .........  .X.....",
        "   ........  .......",
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


HULL = ("###",
        "###",
        ".#.")
SLIP_MOUTH = ("#.#",
              "#.#",
              "###")
CARGO = ("###",
         "#.#",
         "###")
BERTH_LOCKED = ("#.#",
                "...",
                "#.#")
BERTH_ARMED = ("###",
               "###",
               "###")
LOCK_SHUT = ("###",
             "###",
             "###")
LOCK_OPEN = ("#.#",
             "#.#",
             "#.#")


def stencil(art, colour: int) -> np.ndarray:
    return np.repeat(np.repeat(np.array([[colour if c == "#" else -1 for c in row] for row in art], dtype=np.int8), 2, axis=0), 2, axis=1)


def quay_pixels(rows) -> list:
    px = [[WATER] * (W * CELL) for _ in range(H * CELL)]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            for r in range(CELL):
                for c in range(CELL):
                    px[y * CELL + r][x * CELL + c] = (3 if r == CELL - 1 or c == CELL - 1 else 1 if r == 0 else FLOOR)
    return px


def build_levels() -> list:
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        pieces = [Sprite(
            pixels=quay_pixels(rows), name="quay",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-2,
        ).set_position(0, 0)]
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in " .P":
                    continue
                if ch == "c":
                    art, name = stencil(CARGO, CRATE), f"cargo_{x}_{y}"
                elif ch == "X":
                    art, name = stencil(BERTH_LOCKED, GOAL), "berth"
                elif ch == "s":
                    art, name = stencil(LOCK_SHUT, GATE), f"lock_{x}_{y}"
                else:
                    art, name = stencil(SLIP_MOUTH, SLIP[ch]), f"slip_{ch}"
                pieces.append(Sprite(
                    pixels=art, name=name,
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=0,
                ).set_position(x * CELL, y * CELL))
        pieces.append(Sprite(
            pixels=stencil(HULL, AVATAR), name="hull",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(0, 0))
        levels.append(Level(sprites=pieces, grid_size=(VIEW_W, VIEW_H)))
    return levels


class Instruments(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        g = self._game
        frame[:8, :] = WATER
        frame[56:, :] = WATER
        for i, (a, b) in enumerate(BASE_CYCLE):
            x = 2 + i * 12
            frame[1:7, x:x+10] = 0 if i == g.tick % 3 else PIP_DIM
            frame[2:6, x+1:x+4] = SLIP[a]
            frame[2:6, x+6:x+9] = SLIP[b]
            frame[3:5, x+4:x+6] = PIP_LIT if i == g.tick % 3 else WATER
        if "D" in g.present:
            for i in range(4):
                x = 41 + i * 5
                frame[2:6, x:x+3] = SLIP["D"] if i == g.tick % 4 else PIP_DIM
        left = max(0, min(60, round(60 * g.moves_left / g.spec["budget"])))
        frame[59:62, 2:62] = PIP_DIM
        frame[59:62, 2:2+left] = PIP_LIT
        return frame


class Ferry(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.tick = 0
        self.moves_left = spec["budget"]
        self.px, self.py = 0, 0
        self.cargo_left: set = set()
        self.present = slips_present(spec["rows"])
        self.slips: dict = {}
        camera = Camera(
            width=VIEW_W, height=VIEW_H,
            background=WATER, letter_box=WATER,
            interfaces=[Instruments(self)],
        )
        super().__init__(game_id="g045", levels=build_levels(), camera=camera, available_actions=[1, 2, 3, 4, 5])

    @property
    def spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        spec = self.spec
        rows = spec["rows"]
        self.tick = 0
        self.moves_left = spec["budget"]
        self.px, self.py = find_char(rows, "P")
        self.cargo_left = find_all(rows, "c")
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
        self.camera.x = max(0, min(W * CELL - VIEW_W, self.px * CELL - VIEW_W // 2))
        self.camera.y = max(0, min(H * CELL - VIEW_H, self.py * CELL - VIEW_H // 2))
        active = links(self.present, self.tick)
        for name, (x, y) in self.slips.items():
            for mouth in level.get_sprites_by_name(f"slip_{name}"):
                face = np.full((CELL, CELL), -1, dtype=np.int8)
                face[0, 1:5] = face[5, 1:5] = SLIP[name]
                face[1:5, 0] = face[1:5, 5] = SLIP[name]
                if name in active:
                    face[2:4, 2:4] = SLIP[active[name]]
                    face[1, 2:4] = face[4, 2:4] = 0
                    face[2:4, 1] = face[2:4, 4] = 0
                else:
                    wait = next((n for n in range(1, 13) if name in links(self.present, self.tick + n)), 0)
                    for n in range(min(wait, 4)):
                        face[2 + n // 2, 2 + n % 2] = PIP_DIM
                mouth.pixels = face
        hull = level.get_sprites_by_name("hull")
        if hull:
            hull[0].set_position(self.px * CELL, self.py * CELL)
        berth = level.get_sprites_by_name("berth")
        if berth:
            art = BERTH_LOCKED if self.cargo_left else BERTH_ARMED
            face = np.full((CELL, CELL), -1, dtype=np.int8)
            face[0, 1:5] = face[5, 1:5] = GOAL
            face[1:5, 0] = face[1:5, 5] = GOAL
            face[1, 1] = face[1, 4] = face[4, 1] = face[4, 4] = 11
            if self.cargo_left:
                face[2:4, 2:4] = 3
            else:
                face[2:4, 1:5] = 0
                face[1:5, 2:4] = 0
            berth[0].pixels[:, :] = face
        if self.spec.get("lock_beat") is not None:
            art = LOCK_OPEN if lock_open(self.spec, self.tick) else LOCK_SHUT
            for x, y in find_all(self.spec["rows"], "s"):
                for gate in level.get_sprites_by_name(f"lock_{x}_{y}"):
                    gate.pixels[:, :] = stencil(art, GATE)

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
            self.level_reset()
            finish_translation(self)
            return

        self._sync()
        finish_translation(self)
