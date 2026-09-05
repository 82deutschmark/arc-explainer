# ARC-AGI-3 candidate task g042.

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

WATER = 0
BLOCK = 5
CRATE = 8
GOAL = 15
BARGE_C = 9

LOCK_HUE = {"a": 11, "b": 14, "c": 6, "d": 2, "e": 13, "f": 12}

N = 15
CELL = 4

STEPS = ((0, -1), (0, 1), (-1, 0), (1, 0))

CHARTS = [
    [
        "###############",
        "####@......####",
        "####.#####.####",
        "####.#####.####",
        "####......A####",
        "###############",
        "##a..........##",
        "##.#########.##",
        "##.#########.##",
        "##...........##",
        "##.#########.##",
        "##.#########.##",
        "##.#########.##",
        "##...o....=..##",
        "###############",
    ],
    [
        "###############",
        "#@............#",
        "#.##.##.##.##.#",
        "#A...........B#",
        "###############",
        "#a............#",
        "#.###########.#",
        "#.###########.#",
        "#...o.........#",
        "########C######",
        "###############",
        "#b...........c#",
        "#.###########.#",
        "#......=......#",
        "###############",
    ],
    [
        "###############",
        "#..@..#a.....c#",
        "#.....#.#####.#",
        "#A...F#.......#",
        "#######.#####.#",
        "#b....#.......#",
        "#..o..#.......#",
        "#....C#B.....D#",
        "###############",
        "#d.....#e....f#",
        "#.####.#.####.#",
        "#..o...#..=...#",
        "#.####.#.####.#",
        "#E.....#......#",
        "###############",
    ],
    [
        "###############",
        "#@............#",
        "#.##.##.##.##.#",
        "#A...........E#",
        "###############",
        "#a.....#c.....#",
        "#.####.#.####.#",
        "#..o...#..o...#",
        "#.####.#.####.#",
        "#B.....#.....D#",
        "###############",
        "#b....e#d.....#",
        "#.####.#..=...#",
        "#.o...C#......#",
        "###############",
    ],
    [
        "###############",
        "#@............#",
        "#.##.##.##.##.#",
        "#A...........E#",
        "###############",
        "#..o...#...o..#",
        "#.####.#.####.#",
        "#......a......#",
        "#.####.#.####.#",
        "#B.....#c....D#",
        "###############",
        "#b...e###d....#",
        "#.###.###..=..#",
        "#..o.C###.....#",
        "###############",
    ],
    [
        "###############",
        "#@............#",
        "#D...........F#",
        "###############",
        "#..o..d#...o..#",
        "#.####.#.####.#",
        "#......a......#",
        "#E.....#.....B#",
        "###############",
        "#b....###f...e#",
        "#.###.###.###.#",
        "#..o.A###..o.C#",
        "###############",
        "#######=.....c#",
        "###############",
    ],
]


def cells(rows: list[str], mark: str) -> list[tuple[int, int]]:
    return [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == mark]


def lock_ids(rows: list[str]) -> list[str]:
    return sorted({ch.lower() for row in rows for ch in row if ch.lower() in LOCK_HUE})


def cargo(rows: list[str]) -> list[tuple[int, int]]:
    return cells(rows, "o")


def read(rows: list[str], x: int, y: int, jammed: frozenset, lifted: frozenset) -> str:
    ch = rows[y][x]
    if ch == "@":
        return "."
    if ch == "o":
        return "." if (x, y) in lifted else "o"
    if ch.lower() in LOCK_HUE:
        return "#" if ch.lower() in jammed else ch
    return ch


def tile(colour: int) -> np.ndarray:
    return np.full((CELL, CELL), colour, dtype=np.int8)


def socket(colour: int) -> np.ndarray:
    face = tile(colour)
    face[1:CELL - 1, 1:CELL - 1] = WATER
    return face


def face_of(ch: str) -> np.ndarray:
    if ch == "#":
        return tile(BLOCK)
    if ch == "o":
        return tile(CRATE)
    if ch == "=":
        return tile(GOAL)
    if ch.lower() in LOCK_HUE:
        hue = LOCK_HUE[ch.lower()]
        return tile(hue) if ch.isupper() else socket(hue)
    return tile(WATER)


def paint(rows: list[str], jammed: frozenset, lifted: frozenset) -> np.ndarray:
    board = np.full((N * CELL, N * CELL), BLOCK, dtype=np.int8)
    for y in range(N):
        for x in range(N):
            board[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = face_of(
                read(rows, x, y, jammed, lifted))
    return board


def build_levels() -> list[Level]:
    made: list[Level] = []
    for rows in CHARTS:
        works = Sprite(
            pixels=paint(rows, frozenset(), frozenset()), name="works",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-1,
        ).set_position(0, 0)
        barge = Sprite(
            pixels=tile(BARGE_C), name="barge",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(0, 0)
        made.append(Level(sprites=[works, barge], grid_size=(N * CELL, N * CELL)))
    return made


class G042(ARCBaseGame):

    def __init__(self) -> None:
        self.bx, self.by = 0, 0
        self.jammed: frozenset = frozenset()
        self.lifted: frozenset = frozenset()
        super().__init__(
            game_id="g042", levels=build_levels(),
            camera=Camera(width=N * CELL, height=N * CELL,
                          background=BLOCK, letter_box=BLOCK),
        )

    @property
    def chart(self) -> list[str]:
        return CHARTS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        self.bx, self.by = cells(self.chart, "@")[0]
        self.jammed = frozenset()
        self.lifted = frozenset()
        self.repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def repaint(self) -> None:
        works = self.current_level.get_sprites_by_name("works")
        if works:
            works[0].pixels[:, :] = paint(self.chart, self.jammed, self.lifted)
        barge = self.current_level.get_sprites_by_name("barge")
        if barge:
            barge[0].set_position(self.bx * CELL, self.by * CELL)

    def step(self) -> None:
        heading = {
            GameAction.ACTION1: STEPS[0],
            GameAction.ACTION2: STEPS[1],
            GameAction.ACTION3: STEPS[2],
            GameAction.ACTION4: STEPS[3],
        }.get(self.action.id)
        if heading is None:
            self.complete_action()
            return

        rows = self.chart
        nx, ny = self.bx + heading[0], self.by + heading[1]
        if not (0 <= nx < N and 0 <= ny < N):
            self.complete_action()
            return

        ch = read(rows, nx, ny, self.jammed, self.lifted)
        if ch == "#":
            pass
        elif ch == "=":
            if len(self.lifted) == len(cargo(rows)):
                self.next_level()
                self.complete_action()
                return
        elif ch.isupper() and ch.lower() in LOCK_HUE:
            self.bx, self.by = cells(rows, ch.lower())[0]
            self.jammed = self.jammed | {ch.lower()}
        else:
            self.bx, self.by = nx, ny
            if ch == "o":
                self.lifted = self.lifted | {(nx, ny)}

        self.repaint()
        self.complete_action()
