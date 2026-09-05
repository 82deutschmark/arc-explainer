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

BACKGROUND = 3
FLOOR = 7
WALL = 13
PLAYER = 5
GOAL = 9
MARK = 0
TINTS = {"a": 14, "b": 14, "c": 15, "d": 15, "e": 12, "f": 12}

SPAN = 13
CELL = 4
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
            "#############",
            "#..@..#....b#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#a######O...#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#.....#.c.d.#",
            "#############",
        ],
        "links": [("a", "b", 0), ("c", "d", 1)],
        "notch": {},
        "socket": "W",
    },
    {
        "rows": [
            "#############",
            "#.@.........#",
            "#.#########.#",
            "#a#########b#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#.#########.#",
            "#.####O####.#",
            "#.####.####.#",
            "#...........#",
            "#############",
        ],
        "links": [("a", "b", 1)],
        "notch": {},
        "socket": "E",
    },
    {
        "rows": [
            "#############",
            "#.@...c.....#",
            "#.####.####.#",
            "#.####.####b#",
            "#.####.####.#",
            "#.###...###.#",
            "#.#O........#",
            "#.###...###.#",
            "#.####.####.#",
            "#a####.####.#",
            "#.####.####.#",
            "#.....d.....#",
            "#############",
        ],
        "links": [("a", "b", 1), ("c", "d", 2)],
        "notch": {},
        "socket": "S",
    },
    {
        "rows": [
            "#############",
            "#.@.........#",
            "#.####a####.#",
            "#.####.####.#",
            "#.####.####.#",
            "#.###...###.#",
            "#.#O........#",
            "#.###...###.#",
            "#.####.####.#",
            "#.####.####.#",
            "#.####b####.#",
            "#...........#",
            "#############",
        ],
        "links": [("a", "b", 1)],
        "notch": {"b": "S"},
        "socket": "S",
    },
    {
        "rows": [
            "#############",
            "#.@...c.....#",
            "#.####.####.#",
            "#.####.####.#",
            "#.####.####.#",
            "#.###...###.#",
            "#a......bO#.#",
            "#.###...###.#",
            "#.####.####.#",
            "#.####.####.#",
            "#.####.####.#",
            "#.....d.....#",
            "#############",
        ],
        "links": [("a", "b", 1), ("c", "d", 1)],
        "notch": {"b": "N"},
        "socket": "N",
    },
    {
        "rows": [
            "#############",
            "#.@.........#",
            "#.#########.#",
            "#.#...c...#.#",
            "#.#.#####.#.#",
            "#.#.#.###.#.#",
            "#a#b#dO##f#e#",
            "#.#.#####.#.#",
            "#.#.#####.#.#",
            "#.#.......#.#",
            "#.#########.#",
            "#...........#",
            "#############",
        ],
        "links": [("a", "b", 3), ("c", "d", 1), ("e", "f", 2)],
        "notch": {"c": "S", "b": "N"},
        "socket": "W",
    },
]


def cells_of(rows: list[str], glyph: str) -> list[tuple[int, int]]:
    return [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == glyph]


def gate_of(wheel: dict, mouth: str) -> tuple[str, int]:
    for left, right, quarters in wheel["links"]:
        if mouth == left:
            return right, quarters
        if mouth == right:
            return left, quarters
    raise KeyError(mouth)


def mouths_of(wheel: dict) -> list[str]:
    return [m for link in wheel["links"] for m in link[:2]]


def _slab(tint: int) -> list[list[int]]:
    return [[tint] * CELL for _ in range(CELL)]


def _notched(tint: int, heading: str) -> list[list[int]]:
    slab = _slab(tint)
    dx, dy = HEADINGS[heading]
    if dy == 1:
        slab[0] = [MARK] * CELL
    elif dy == -1:
        slab[CELL - 1] = [MARK] * CELL
    elif dx == 1:
        for row in slab:
            row[0] = MARK
    else:
        for row in slab:
            row[CELL - 1] = MARK
    return slab


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for wheel in WHEELS:
        rows = wheel["rows"]
        parts: list[Sprite] = [Sprite(
            pixels=[[FLOOR] * (SPAN * CELL) for _ in range(SPAN * CELL)], name="deck",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-2,
        ).set_position(INSET, INSET)]
        for y, row in enumerate(rows):
            for x, glyph in enumerate(row):
                if glyph in ".@":
                    continue
                if glyph == "#":
                    pixels, layer = _slab(WALL), -1
                elif glyph == "O":
                    pixels, layer = _notched(GOAL, wheel["socket"]), 0
                elif glyph in wheel["notch"]:
                    pixels, layer = _notched(TINTS[glyph], wheel["notch"][glyph]), 0
                else:
                    pixels, layer = _slab(TINTS[glyph]), 0
                parts.append(Sprite(
                    pixels=pixels, name=f"t.{x}.{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=layer,
                ).set_position(INSET + x * CELL, INSET + y * CELL))
        parts.append(Sprite(
            pixels=_slab(PLAYER), name="head",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(INSET, INSET))
        levels.append(Level(sprites=parts, grid_size=(64, 64)))
    return levels


class G041(ARCBaseGame):

    def __init__(self) -> None:
        self.hx, self.hy, self.turn = 0, 0, 0
        camera = Camera(
            width=64, height=64,
            background=BACKGROUND, letter_box=BACKGROUND,
        )
        super().__init__(game_id="g041", levels=build_levels(), camera=camera)

    @property
    def wheel(self) -> dict:
        return WHEELS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        self.hx, self.hy = cells_of(self.wheel["rows"], "@")[0]
        self.turn = 0
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
            else:
                _, xs, ys = part.name.split(".")
                sx, sy = quarter_pos(int(xs), int(ys), self.turn)
            part.set_position(INSET + sx * CELL, INSET + sy * CELL)

    def step(self) -> None:
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
                self.turn = (self.turn + quarters) % 4

        self._repaint()
        self.complete_action()
