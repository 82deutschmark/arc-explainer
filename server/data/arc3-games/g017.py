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


VOID_BG = 0
SPAN_FLOOR = 9
BEAD_MARK = 0
FRAY_BG = 13
FRAY_PIP = 0
COLLAPSED_TILE = 13
EXIT_SHUT = 15
EXIT_OPEN = 10
PLAYER = 6

SPAN = 13
CELL = 4
ORIGIN = (64 - SPAN * CELL) // 2

LOAN = 10

BOARDS = [
    [
        ".............",
        ".@-----*----.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........-.",
        "...........O.",
        ".............",
    ],
    [
        ".............",
        ".............",
        ".............",
        ".O--*----*-..",
        "......-......",
        "......-......",
        "......-......",
        "......-......",
        "......-......",
        "......-----..",
        "..........-..",
        "..........@..",
        ".............",
    ],
    [
        ".............",
        ".............",
        ".............",
        "..O..........",
        "..-..........",
        "..-..........",
        "..--------*..",
        "......*......",
        "......-......",
        "......-......",
        ".-*---@......",
        ".............",
        ".............",
    ],
    [
        ".............",
        ".............",
        "......O......",
        "......-......",
        "......-......",
        "......-......",
        "......*......",
        ".-*-------*-.",
        "......-......",
        "......-......",
        "......-......",
        "......@......",
        ".............",
    ],
    [
        ".............",
        ".............",
        ".............",
        ".............",
        "......O......",
        "......-......",
        "......-......",
        ".....--......",
        ".....**......",
        ".-----@-----.",
        ".*.........*.",
        ".............",
        ".............",
    ],
    [
        ".............",
        ".............",
        ".............",
        ".............",
        "....--*--....",
        "....-...-....",
        "....*...*....",
        "....-...-....",
        "....-@*--....",
        "......-......",
        "......O......",
        ".............",
        ".............",
    ],
    [
        ".............",
        ".*----------.",
        ".-....-....-.",
        ".-....*....-.",
        ".-....-....-.",
        ".-...---...-.",
        ".--*--O--*--.",
        ".-...---...-.",
        ".-.........-.",
        ".-.........-.",
        ".-.........-.",
        ".-----@----*.",
        ".............",
    ],
]

WALKABLE = "-*@O"
UNLIFTED = -1
STONE = 0


def cell_of(rows: list[str], mark: str) -> tuple[int, int]:
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            if char == mark:
                return x, y
    raise AssertionError(f"board has no {mark!r}")


def bead_cells(rows: list[str]) -> list[tuple[int, int]]:
    return [(x, y) for y, row in enumerate(rows)
            for x, char in enumerate(row) if char == "*"]


def is_span(rows: list[str], cell: tuple[int, int]) -> bool:
    x, y = cell
    if not (0 <= x < SPAN and 0 <= y < SPAN):
        return False
    return rows[y][x] in WALKABLE


def _flat(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _bead_face() -> list[list[int]]:
    return [
        [SPAN_FLOOR, BEAD_MARK, BEAD_MARK, SPAN_FLOOR],
        [BEAD_MARK, BEAD_MARK, BEAD_MARK, BEAD_MARK],
        [BEAD_MARK, BEAD_MARK, BEAD_MARK, BEAD_MARK],
        [SPAN_FLOOR, BEAD_MARK, BEAD_MARK, SPAN_FLOOR],
    ]


def _fray_face(left: int) -> list[list[int]]:
    face = [[FRAY_BG] * CELL for _ in range(CELL)]
    for i in range(min(left, CELL * CELL)):
        face[CELL - 1 - (i // CELL)][i % CELL] = FRAY_PIP
    return face


def _wearing(face: list[list[int]]) -> list[list[int]]:
    worn = [[-1] * CELL for _ in range(CELL)]
    for y in (1, 2):
        for x in (1, 2):
            worn[y][x] = PLAYER
    return worn


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for rows in BOARDS:
        pieces: list[Sprite] = []
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char not in WALKABLE:
                    continue
                px, py = ORIGIN + x * CELL, ORIGIN + y * CELL
                if char == "*":
                    face, tag, name = _bead_face(), "bead", f"bead_{x}_{y}"
                elif char == "O":
                    face, tag, name = _flat(EXIT_SHUT), "mouth", "mouth"
                else:
                    face, tag, name = _flat(SPAN_FLOOR), "span", f"span_{x}_{y}"
                pieces.append(Sprite(
                    pixels=face, name=name, blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=0, tags=[tag],
                ).set_position(px, py))
        start = cell_of(rows, "@")
        pieces.append(Sprite(
            pixels=_wearing(_flat(SPAN_FLOOR)), name="wader",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(ORIGIN + start[0] * CELL, ORIGIN + start[1] * CELL))
        levels.append(Level(sprites=pieces, grid_size=(64, 64)))
    return levels


class Interest(ARCBaseGame):

    def __init__(self) -> None:
        self.ledger: dict[tuple[int, int], int] = {}
        self.here: tuple[int, int] = (0, 0)
        super().__init__(
            game_id="g017", levels=build_levels(), available_actions=[1,2,3,4,5],
            camera=Camera(width=64, height=64,
                          background=VOID_BG, letter_box=VOID_BG),
        )
        self.on_set_level(self.current_level)

    @property
    def rows(self) -> list[str]:
        return BOARDS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self.ledger = {cell: UNLIFTED for cell in bead_cells(self.rows)}
        self.here = cell_of(self.rows, "@")
        self._repaint()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _piece(self, name: str) -> Sprite | None:
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def _face_of(self, cell: tuple[int, int]) -> list[list[int]]:
        state = self.ledger.get(cell)
        if state == UNLIFTED:
            return _bead_face()
        if state is not None and state > STONE:
            return _fray_face(state)
        if state == STONE:
            return _flat(COLLAPSED_TILE)
        if self.rows[cell[1]][cell[0]] == "O":
            return _flat(EXIT_OPEN if self.all_lifted() else EXIT_SHUT)
        return _flat(SPAN_FLOOR)

    def _dress(self, piece: Sprite | None, face: list[list[int]]) -> None:
        if piece is not None:
            piece.pixels[:, :] = np.array(face, dtype=np.int8)

    def _repaint(self) -> None:
        for cell in self.ledger:
            self._dress(self._piece(f"bead_{cell[0]}_{cell[1]}"), self._face_of(cell))
        mouth = self._piece("mouth")
        if mouth is not None:
            self._dress(mouth, _flat(EXIT_OPEN if self.all_lifted() else EXIT_SHUT))
        wader = self._piece("wader")
        if wader is not None:
            self._dress(wader, _wearing(self._face_of(self.here)))
            wader.set_position(ORIGIN + self.here[0] * CELL, ORIGIN + self.here[1] * CELL)

    def all_lifted(self) -> bool:
        return all(state != UNLIFTED for state in self.ledger.values())

    def underfoot(self) -> tuple[int, int]:
        return self.here

    def passable(self, cell: tuple[int, int]) -> bool:
        if not is_span(self.rows, cell):
            return False
        if self.ledger.get(cell) == STONE:
            return False
        if self.rows[cell[1]][cell[0]] == "O" and not self.all_lifted():
            return False
        return True

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('wader',), limit=CELL)
        moves = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                 GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}
        if self.action.id not in moves and self.action.id != GameAction.ACTION5:
            finish_translation(self)
            return
        step = moves.get(self.action.id)
        if step is not None:
            ahead = (self.here[0] + step[0], self.here[1] + step[1])
            if self.passable(ahead):
                self.here = ahead

        if self.ledger.get(self.here) == UNLIFTED:
            self.ledger[self.here] = LOAN + 1
        for cell, state in list(self.ledger.items()):
            if state > STONE:
                self.ledger[cell] = state - 1

        if self.ledger.get(self.here, UNLIFTED) == STONE:
            self._repaint()
            self.level_reset()
            finish_translation(self)
            return

        self._repaint()

        if self.all_lifted() and self.here == cell_of(self.rows, "O"):
            self.next_level()

        finish_translation(self)
