# ARC-AGI-3 candidate task g017.

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

VOID_BG = 15
COMB_FLOOR = 11
COMB_GRAIN = 12
CAP_MARK = 0
WANE_BG = 12
WANE_PIP = 0
SEALED_TILE = 5
EXIT_SHUT = 8
EXIT_OPEN = 10
PLAYER = 13

COLS = 8
ROWS = 9
CELL = 5
ORIGIN_X = 2
ORIGIN_Y = 9

LOAN = 10

HEX = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (1, -1),
    GameAction.ACTION7: (-1, 1),
}

BOARDS = [
    [
        "@-*-----",
        ".......-",
        "....---.",
        "...-..-.",
        "...-..-.",
        "..-..-..",
        "..*..-..",
        ".....-..",
        ".....O..",
    ],
    [
        "........",
        "........",
        "...---..",
        "..-..@..",
        ".*...*-O",
        ".-..-...",
        ".---....",
        "........",
        "........",
    ],
    [
        "........",
        "......@.",
        ".---..-.",
        "O..*..-.",
        "...--*..",
        "..-.....",
        ".-......",
        ".-......",
        ".*......",
    ],
    [
        ".O-.....",
        "-.-*....",
        "--.--...",
        "..-.--..",
        "..-..*-.",
        ".-....-.",
        ".*...-..",
        "-....*..",
        "-@......",
    ],
    [
        "........",
        "...-*--.",
        "..-...-.",
        ".*....-.",
        "O.....@.",
        "-....-..",
        "-...-...",
        "-*--.--*",
        "...--...",
    ],
    [
        ".--.--.*",
        "-.--.--.",
        "--.-*...",
        ".--.--..",
        "@..O.-*.",
        "--.--.--",
        ".-*..-.-",
        "-.--.--.",
        "--.--.-*",
    ],
]

WALKABLE = "-*@O"
UNLIFTED = -1
STONE = 0

WANE_ORDER = ((0, 2), (4, 2), (1, 0), (1, 4), (2, 0),
              (2, 4), (3, 0), (3, 4), (0, 1), (4, 3))

DRIFT_TINTS = (CAP_MARK, COMB_FLOOR, SEALED_TILE)
DRIFT_LOOPS = (
    ((1, 1), (7, 0), (14, 0), (21, 1), (28, 2), (35, 3), (42, 4), (49, 5),
     (55, 8), (58, 14), (55, 20), (48, 22), (40, 21), (32, 18), (24, 13), (12, 6)),
    ((2, 56), (9, 58), (17, 59), (25, 58), (33, 56), (41, 53), (48, 50), (54, 46),
     (58, 40), (56, 33), (50, 30), (42, 32), (33, 37), (24, 44), (14, 50)),
    ((59, 2), (60, 10), (59, 19), (56, 28), (52, 37), (46, 45), (38, 52), (29, 57),
     (20, 59), (11, 57), (5, 51), (2, 43), (1, 34), (2, 25), (5, 16), (12, 8),
     (20, 4), (30, 2), (40, 1), (50, 1)),
)


def cell_of(rows: list[str], mark: str) -> tuple[int, int]:
    for r, row in enumerate(rows):
        for q, char in enumerate(row):
            if char == mark:
                return q, r
    raise AssertionError(f"board has no {mark!r}")


def cap_cells(rows: list[str]) -> list[tuple[int, int]]:
    return [(q, r) for r, row in enumerate(rows)
            for q, char in enumerate(row) if char == "*"]


def is_comb(rows: list[str], cell: tuple[int, int]) -> bool:
    q, r = cell
    if not (0 <= q < COLS and 0 <= r < ROWS):
        return False
    return rows[r][q] in WALKABLE


def screen_of(cell: tuple[int, int]) -> tuple[int, int]:
    q, r = cell
    return ORIGIN_X + q * CELL + (r * CELL) // 2, ORIGIN_Y + r * CELL


def _hex_face(fill: int) -> list[list[int]]:
    face = [[fill] * CELL for _ in range(CELL)]
    for r, q in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        face[r][q] = -1
    return face


def _wax_face() -> list[list[int]]:
    face = _hex_face(COMB_FLOOR)
    face[0][2] = COMB_GRAIN
    face[4][2] = COMB_GRAIN
    return face


def _cap_face() -> list[list[int]]:
    face = _wax_face()
    for r, q in ((1, 2), (2, 1), (2, 2), (2, 3), (3, 2)):
        face[r][q] = CAP_MARK
    return face


def _wane_face(left: int) -> list[list[int]]:
    face = _hex_face(WANE_BG)
    for r, q in WANE_ORDER[:max(left, 0)]:
        face[r][q] = WANE_PIP
    return face


def _sealed_face() -> list[list[int]]:
    return _hex_face(SEALED_TILE)


def _mouth_face(open_now: bool) -> list[list[int]]:
    face = _hex_face(EXIT_OPEN if open_now else EXIT_SHUT)
    for r, q in ((1, 2), (2, 1), (2, 2), (2, 3), (3, 2)):
        face[r][q] = -1 if open_now else SEALED_TILE
    return face


def _mote_face(tint: int) -> list[list[int]]:
    return [[-1, tint, -1], [tint, -1, tint], [-1, tint, -1]]


def _wearing(face: list[list[int]]) -> list[list[int]]:
    worn = [row[:] for row in face]
    for r, q in ((1, 2), (2, 1), (2, 2), (2, 3), (3, 2)):
        worn[r][q] = PLAYER
    return worn


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for rows in BOARDS:
        pieces: list[Sprite] = []
        for r, row in enumerate(rows):
            for q, char in enumerate(row):
                if char not in WALKABLE:
                    continue
                px, py = screen_of((q, r))
                assert 0 <= px and px + CELL <= 64, (q, r, px)
                assert 0 <= py and py + CELL <= 64, (q, r, py)
                if char == "*":
                    face, tag, name = _cap_face(), "cap", f"cap_{q}_{r}"
                elif char == "O":
                    face, tag, name = _mouth_face(False), "mouth", "mouth"
                else:
                    face, tag, name = _wax_face(), "wax", f"wax_{q}_{r}"
                pieces.append(Sprite(
                    pixels=face, name=name, blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=0, tags=[tag],
                ).set_position(px, py))
        for i, tint in enumerate(DRIFT_TINTS):
            pieces.append(Sprite(
                pixels=_mote_face(tint), name=f"mote_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=2, tags=["mote"],
            ).set_position(*DRIFT_LOOPS[i][0]))
        start = cell_of(rows, "@")
        pieces.append(Sprite(
            pixels=_wearing(_wax_face()), name="forager",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(*screen_of(start)))
        levels.append(Level(sprites=pieces, grid_size=(64, 64)))
    return levels


class G017(ARCBaseGame):

    def __init__(self) -> None:
        self.ledger: dict[tuple[int, int], int] = {}
        self.here: tuple[int, int] = (0, 0)
        self.drift = 0
        super().__init__(
            game_id="g017", levels=build_levels(),
            camera=Camera(width=64, height=64,
                          background=VOID_BG, letter_box=VOID_BG),
            available_actions=[1, 2, 3, 4, 5, 7],
        )
        self.on_set_level(self.current_level)

    @property
    def rows(self) -> list[str]:
        return BOARDS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        self.ledger = {cell: UNLIFTED for cell in cap_cells(self.rows)}
        self.here = cell_of(self.rows, "@")
        self.drift = 0
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _piece(self, name: str) -> Sprite | None:
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def _face_of(self, cell: tuple[int, int]) -> list[list[int]]:
        state = self.ledger.get(cell)
        if state == UNLIFTED:
            return _cap_face()
        if state is not None and state > STONE:
            return _wane_face(state)
        if state == STONE:
            return _sealed_face()
        if self.rows[cell[1]][cell[0]] == "O":
            return _mouth_face(self.all_lifted())
        return _wax_face()

    def _dress(self, piece: Sprite | None, face: list[list[int]]) -> None:
        if piece is not None:
            piece.pixels[:, :] = np.array(face, dtype=np.int8)

    def _repaint(self) -> None:
        for cell in self.ledger:
            self._dress(self._piece(f"cap_{cell[0]}_{cell[1]}"), self._face_of(cell))
        mouth = self._piece("mouth")
        if mouth is not None:
            self._dress(mouth, _mouth_face(self.all_lifted()))
        for i in range(len(DRIFT_TINTS)):
            mote = self._piece(f"mote_{i}")
            if mote is not None:
                loop = DRIFT_LOOPS[i]
                mote.set_position(*loop[self.drift % len(loop)])
        forager = self._piece("forager")
        if forager is not None:
            self._dress(forager, _wearing(self._face_of(self.here)))
            forager.set_position(*screen_of(self.here))

    def all_lifted(self) -> bool:
        return all(state != UNLIFTED for state in self.ledger.values())

    def underfoot(self) -> tuple[int, int]:
        return self.here

    def passable(self, cell: tuple[int, int]) -> bool:
        if not is_comb(self.rows, cell):
            return False
        if self.ledger.get(cell) == STONE:
            return False
        if self.rows[cell[1]][cell[0]] == "O" and not self.all_lifted():
            return False
        return True

    def step(self) -> None:
        step = HEX.get(self.action.id)
        if step is not None:
            ahead = (self.here[0] + step[0], self.here[1] + step[1])
            if self.passable(ahead):
                self.here = ahead
        self.drift += 1

        if self.ledger.get(self.here) == UNLIFTED:
            self.ledger[self.here] = LOAN + 1
        for cell, state in list(self.ledger.items()):
            if state > STONE:
                self.ledger[cell] = state - 1

        if self.ledger.get(self.here, UNLIFTED) == STONE:
            self._repaint()
            self.level_reset()
            self.complete_action()
            return

        self._repaint()

        if self.all_lifted() and self.here == cell_of(self.rows, "O"):
            self.next_level()

        self.complete_action()
