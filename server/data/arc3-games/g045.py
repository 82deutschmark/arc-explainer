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
CELL = 3
XOFF = (64 - W * CELL) // 2
YOFF = (64 - H * CELL) // 2

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
        "  .........  .......",
        "  P........  .......",
        "  .........  ...c...",
        "   ........  .......",
        "    ......   ...X...",
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
    return np.array([[colour if c == "#" else -1 for c in row] for row in art],
                    dtype=np.int8)


def quay_pixels(rows) -> list:
    px = [[WATER] * (W * CELL) for _ in range(H * CELL)]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            for r in range(CELL):
                for c in range(CELL):
                    px[y * CELL + r][x * CELL + c] = FLOOR
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
        levels.append(Level(sprites=pieces, grid_size=(W * CELL, H * CELL)))
    return levels


class G045A(RenderableUserDisplay):

    PAD = 2
    LAMP_W, LAMP_GAP, LAMP_X = 9, 3, 3
    LAMP_Y, LAMP_H = PAD, YOFF - 2 * PAD
    DOT, DOT_GAP, DOT_X = 4, 2, 40
    DOT_Y = LAMP_Y + 2
    BAR_Y = YOFF + H * CELL + 4
    BAR_H, BAR_X = 4, XOFF
    BAR_MAX = 64 - 2 * XOFF

    def __init__(self, game: "G045") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        tick = self._game.tick
        for i in range(3):
            x = self.LAMP_X + i * (self.LAMP_W + self.LAMP_GAP)
            frame[self.LAMP_Y:self.LAMP_Y + self.LAMP_H, x:x + self.LAMP_W] = (
                PIP_LIT if i == tick % 3 else PIP_DIM)
        if "D" in self._game.present:
            for i in range(4):
                x = self.DOT_X + i * (self.DOT + self.DOT_GAP)
                frame[self.DOT_Y:self.DOT_Y + self.DOT, x:x + self.DOT] = (
                    PIP_LIT if i == tick % 4 else PIP_DIM)
        left = max(0, min(self._game.moves_left, self.BAR_MAX))
        if left:
            frame[self.BAR_Y:self.BAR_Y + self.BAR_H,
                  self.BAR_X:self.BAR_X + left] = PIP_LIT
        return frame


class G045(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.tick = 0
        self.moves_left = spec["budget"]
        self.px, self.py = 0, 0
        self.cargo_left: set = set()
        self.present = slips_present(spec["rows"])
        self.slips: dict = {}
        camera = Camera(
            width=W * CELL, height=H * CELL,
            background=WATER, letter_box=WATER,
            interfaces=[G045A(self)],
        )
        super().__init__(game_id="g045", levels=build_levels(), camera=camera)

    @property
    def spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def on_set_level(self, level: Level) -> None:
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
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        hull = level.get_sprites_by_name("hull")
        if hull:
            hull[0].set_position(self.px * CELL, self.py * CELL)
        berth = level.get_sprites_by_name("berth")
        if berth:
            art = BERTH_LOCKED if self.cargo_left else BERTH_ARMED
            berth[0].pixels[:, :] = stencil(art, GOAL)
        if self.spec.get("lock_beat") is not None:
            art = LOCK_OPEN if lock_open(self.spec, self.tick) else LOCK_SHUT
            for x, y in find_all(self.spec["rows"], "s"):
                for gate in level.get_sprites_by_name(f"lock_{x}_{y}"):
                    gate.pixels[:, :] = stencil(art, GATE)

    def step(self) -> None:
        d = DIRS.get(self.action.id)
        if d is None:
            self.complete_action()
            return

        spec = self.spec
        rows = spec["rows"]
        tick = self.tick
        nx, ny = self.px + d[0], self.py + d[1]
        ch = rows[ny][nx] if 0 <= nx < W and 0 <= ny < H else " "

        if ch == "X" and not self.cargo_left:
            self.next_level()
            self.complete_action()
            return

        if cell_walkable(spec, nx, ny, tick):
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
            self.complete_action()
            return

        self._sync()
        self.complete_action()
