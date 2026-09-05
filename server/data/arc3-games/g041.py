# ARC-AGI-3 candidate task g041.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

BACKGROUND = 4
FLOOR = 1
FLOOR_RIVET = 3
WALL = 3
WALL_COURSE = 2
PLAYER = 6
PLAYER_VISOR = 7
GOAL = 9
MARK = 7
GATE_A = 14
GATE_B = 2

SPAN = 10
CELL = 6
INSET = (64 - SPAN * CELL) // 2

HEADINGS = {"N": (0, -1), "S": (0, 1), "W": (-1, 0), "E": (1, 0)}
STEPS = ("N", "S", "W", "E")


def quarter_pos(x: int, y: int, q: int) -> tuple[int, int]:
    q %= 4
    if q == 0:
        return x, y
    if q == 1:
        return SPAN - 1 - y, x
    if q == 2:
        return SPAN - 1 - x, SPAN - 1 - y
    return y, SPAN - 1 - x


def quarter_dir(heading: tuple[int, int], q: int) -> tuple[int, int]:
    dx, dy = heading
    q %= 4
    if q == 0:
        return dx, dy
    if q == 1:
        return -dy, dx
    if q == 2:
        return -dx, -dy
    return dy, -dx


WHEELS = [
    {
        "rows": [
            "##########",
            "#@.......#",
            "#.#####a.#",
            "#.######.#",
            "#.######.#",
            "#.######.#",
            "#.#####O.#",
            "#.######.#",
            "#b.......#",
            "##########",
        ],
        "links": [("a", "b", 1)],
        "notch": {},
        "socket": "W",
    },
    {
        "rows": [
            "##########",
            "#@.......#",
            "#.#####a.#",
            "#.######.#",
            "#.######.#",
            "#.O#####.#",
            "#.######.#",
            "#.#####b.#",
            "#........#",
            "##########",
        ],
        "links": [("a", "b", 1)],
        "notch": {},
        "socket": "S",
    },
    {
        "rows": [
            "##########",
            "#@.......#",
            "#.######.#",
            "#.#b..O#.#",
            "#.#.####.#",
            "#.#.####.#",
            "#.#.####.#",
            "#.#....a.#",
            "#........#",
            "##########",
        ],
        "links": [("a", "b", 1)],
        "notch": {"a": "S", "b": "N"},
        "socket": "E",
    },
    {
        "rows": [
            "##########",
            "#@..a#b..#",
            "#....#...#",
            "#....#..c#",
            "##########",
            "#d...#e..#",
            "#....#.#.#",
            "#....#.#O#",
            "#...f#..##",
            "##########",
        ],
        "links": [("a", "b", 1), ("c", "d", 0), ("e", "f", 3)],
        "notch": {"c": "N"},
        "socket": "S",
    },
    {
        "rows": [
            "##########",
            "#@..c....#",
            "#.#.###..#",
            "#.#.###.a#",
            "#...#....#",
            "#.#.#.##.#",
            "#.#O#.##.#",
            "#.#####.b#",
            "#...d....#",
            "##########",
        ],
        "links": [("a", "b", 1), ("c", "d", 2)],
        "notch": {"c": "E", "d": "S"},
        "socket": "E",
    },
    {
        "rows": [
            "##########",
            "#@.......#",
            "#.######.#",
            "#.#...##.#",
            "#.#.#bO#c#",
            "#.#.####.#",
            "#.#....#.#",
            "#.######.#",
            "#a..d....#",
            "##########",
        ],
        "links": [("a", "b", 1), ("c", "d", 3)],
        "notch": {"c": "W", "d": "E"},
        "socket": "W",
    },
    {
        "rows": [
            "##########",
            "#@..a#b..#",
            "#....#...#",
            "#h...#..c#",
            "##########",
            "#g...#d..#",
            "#....#...#",
            "#....#.e.#",
            "#..f.#.#O#",
            "##########",
        ],
        "links": [("a", "b", 2), ("c", "d", 2), ("e", "f", 2), ("g", "h", 1)],
        "notch": {"f": "W", "h": "N"},
        "socket": "W",
    },
]

PAIR_TINT = (GATE_A, GATE_B, GATE_A, GATE_B)
PAIR_PIPS = (1, 2, 3, 4)
PIP_SEATS = ((2, 2), (3, 3), (2, 3), (3, 2))

LAMP_TINTS = (PLAYER, GATE_A, FLOOR, MARK)
LAMP_STARTS = (0, 9, 18, 27)


def border_ring() -> list[tuple[int, int]]:
    top = [(x, 0) for x in range(SPAN - 1)]
    right = [(SPAN - 1, y) for y in range(SPAN - 1)]
    bottom = [(x, SPAN - 1) for x in range(SPAN - 1, 0, -1)]
    left = [(0, y) for y in range(SPAN - 1, 0, -1)]
    return top + right + bottom + left


TRACK = border_ring()


def cells_of(rows: list[str], glyph: str) -> list[tuple[int, int]]:
    return [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == glyph]


def gate_of(wheel: dict, mouth: str) -> tuple[str, int]:
    for left, right, quarters in wheel["links"]:
        if mouth == left:
            return right, quarters
        if mouth == right:
            return left, quarters
    raise KeyError(mouth)


def pair_index(wheel: dict, mouth: str) -> int:
    for i, (left, right, _) in enumerate(wheel["links"]):
        if mouth in (left, right):
            return i
    raise KeyError(mouth)


def mouths_of(wheel: dict) -> list[str]:
    return [m for link in wheel["links"] for m in link[:2]]


def _blank(tint: int) -> list[list[int]]:
    return [[tint] * CELL for _ in range(CELL)]


def _plate(width: int, height: int) -> list[list[int]]:
    sheet = [[FLOOR] * width for _ in range(height)]
    for y in range(1, height, CELL):
        for x in range(1, width, CELL):
            sheet[y][x] = FLOOR_RIVET
            if x + 3 < width:
                sheet[y][x + 3] = FLOOR_RIVET
    return sheet


def _bulkhead() -> list[list[int]]:
    face = _blank(WALL)
    for x in range(CELL):
        face[2][x] = WALL_COURSE
        face[CELL - 1][x] = WALL_COURSE
    face[0][CELL - 1] = WALL_COURSE
    face[1][CELL - 1] = WALL_COURSE
    face[3][2] = WALL_COURSE
    face[4][2] = WALL_COURSE
    return face


def _hollow(tint: int) -> list[list[int]]:
    face = _blank(tint)
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            face[y][x] = -1
    return face


def _drum(tint: int, pips: int) -> list[list[int]]:
    face = _hollow(tint)
    for y, x in PIP_SEATS[:pips]:
        face[y][x] = MARK
    return face


def _socket() -> list[list[int]]:
    face = _hollow(GOAL)
    face[2][2] = GOAL
    face[3][3] = GOAL
    return face


def _striped(face: list[list[int]], heading: str) -> list[list[int]]:
    struck = [row[:] for row in face]
    dx, dy = HEADINGS[heading]
    if dy == 1:
        struck[0] = [MARK] * CELL
    elif dy == -1:
        struck[CELL - 1] = [MARK] * CELL
    elif dx == 1:
        for row in struck:
            row[0] = MARK
    else:
        for row in struck:
            row[CELL - 1] = MARK
    return struck


def _head() -> list[list[int]]:
    p, v, o = PLAYER, PLAYER_VISOR, -1
    return [
        [o, o, p, p, o, o],
        [o, p, p, p, p, o],
        [p, p, v, v, p, p],
        [p, p, p, p, p, p],
        [o, p, p, p, p, o],
        [o, p, o, o, p, o],
    ]


def _lamp(tint: int) -> list[list[int]]:
    o = -1
    return [[o, tint, o], [tint, o, tint], [o, tint, o]]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for wheel in WHEELS:
        rows = wheel["rows"]
        parts: list[Sprite] = [Sprite(
            pixels=_plate(SPAN * CELL, SPAN * CELL), name="deck",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-2,
        ).set_position(INSET, INSET)]
        for y, row in enumerate(rows):
            for x, glyph in enumerate(row):
                if glyph in ".@":
                    continue
                if glyph == "#":
                    pixels, layer = _bulkhead(), -1
                elif glyph == "O":
                    pixels, layer = _striped(_socket(), wheel["socket"]), 0
                else:
                    i = pair_index(wheel, glyph)
                    pixels = _drum(PAIR_TINT[i], PAIR_PIPS[i])
                    if glyph in wheel["notch"]:
                        pixels = _striped(pixels, wheel["notch"][glyph])
                    layer = 0
                parts.append(Sprite(
                    pixels=pixels, name=f"t.{x}.{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=layer,
                ).set_position(INSET + x * CELL, INSET + y * CELL))
        for i, tint in enumerate(LAMP_TINTS):
            parts.append(Sprite(
                pixels=_lamp(tint), name=f"lamp.{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=2,
            ).set_position(INSET, INSET))
        parts.append(Sprite(
            pixels=_head(), name="head",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(INSET, INSET))
        levels.append(Level(sprites=parts, grid_size=(64, 64)))
    return levels


class G041(ARCBaseGame):

    def __init__(self) -> None:
        self.hx, self.hy, self.turn = 0, 0, 0
        self.spin: list[int] = []
        self.drift = 0
        camera = Camera(
            width=64, height=64,
            background=BACKGROUND, letter_box=BACKGROUND,
        )
        super().__init__(game_id="g041", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])

    @property
    def wheel(self) -> dict:
        return WHEELS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        self.hx, self.hy = cells_of(self.wheel["rows"], "@")[0]
        self.turn = 0
        self.spin = []
        self.drift = 0
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        for part in self.current_level.get_sprites():
            if part.name == "deck":
                continue
            if part.name == "head":
                sx, sy = quarter_pos(self.hx, self.hy, self.turn)
            elif part.name.startswith("lamp."):
                seat = LAMP_STARTS[int(part.name.split(".")[1])]
                cell = TRACK[(seat + self.drift) % len(TRACK)]
                sx, sy = quarter_pos(cell[0], cell[1], self.turn)
                part.set_position(INSET + sx * CELL + 1, INSET + sy * CELL + 1)
                continue
            else:
                _, xs, ys = part.name.split(".")
                sx, sy = quarter_pos(int(xs), int(ys), self.turn)
            part.set_position(INSET + sx * CELL, INSET + sy * CELL)

    def step(self) -> None:
        if self.spin:
            self.turn = self.spin.pop(0)
            self._repaint()
            if not self.spin:
                self.complete_action()
            return

        keys = {
            GameAction.ACTION1: "N",
            GameAction.ACTION2: "S",
            GameAction.ACTION3: "W",
            GameAction.ACTION4: "E",
        }
        name = keys.get(self.action.id)
        if name is None:
            self.complete_action()
            return

        self.drift += 1
        wheel = self.wheel
        rows = wheel["rows"]
        dx, dy = HEADINGS[name]
        nx, ny = self.hx + dx, self.hy + dy
        glyph = rows[ny][nx]
        onscreen = quarter_dir((dx, dy), self.turn)

        if glyph == "#":
            pass
        elif glyph == "O":
            if onscreen == HEADINGS[wheel["socket"]]:
                self.next_level()
                self.complete_action()
                return
        elif glyph in ".@":
            self.hx, self.hy = nx, ny
        else:
            shut = glyph in wheel["notch"] and onscreen != HEADINGS[wheel["notch"][glyph]]
            if not shut:
                partner, quarters = gate_of(wheel, glyph)
                self.hx, self.hy = cells_of(rows, partner)[0]
                if quarters:
                    self.spin = [(self.turn + k) % 4 for k in range(1, quarters + 1)]
                    self._repaint()
                    return

        self._repaint()
        self.complete_action()
