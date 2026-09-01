# ARC-AGI-3 candidate task t61247d23.

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

FLOOR = 4
WALL = 1
GATE = 5
EXIT = 14
PLAYER = 12
CRATE = 11
CRATE_CORE = 3
CRATE_SEATED = 14
PLATE = 8
PORTAL_COLOURS = {"a": 9, "b": 15, "c": 10, "d": 6}

CELL = 4

LEVELS_SPEC = [
    {"rows": [
        "################",
        "#..............#",
        "#..P..o.....a..#",
        "#..............#",
        "#..............#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#..............#",
        "#.a........._###",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#.P............#",
        "#......o.......#",
        "#...o..a.......#",
        "#..............#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#..............#",
        "#..............#",
        "#......a......_#",
        "#..............#",
        "#..............#",
        "#......_.......#",
        "################",
    ]},
    {"rows": [
        "################",
        "#.P............#",
        "#..............#",
        "#.o.o..a.......#",
        "#..............#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#..............#",
        "#.a......._.#..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..........b...#",
        "#..........o...#",
        "#...o..a...P...#",
        "#..............#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#..........#...#",
        "#.a......._....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..........b...#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..P....########",
        "#......o########",
        "#..o.o.a########",
        "#.......########",
        "#######....#####",
        "#######....=..X#",
        "################",
        "################",
        "#..............#",
        "#.a......._.#..#",
        "#._............#",
        "#.#............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..P...........#",
        "#......o.......#",
        "#.o....a.......#",
        "#..............#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#..............#",
        "#.a....b.......#",
        "#..............#",
        "#..............#",
        "#.b......_#....#",
        "#......_.......#",
        "################",
    ]},
    {"rows": [
        "################",
        "#.P............#",
        "#..............#",
        "#...o..a..o....#",
        "#......o.......#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#._............#",
        "#_a.........._##",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#.P............#",
        "#....o.........#",
        "#..o.a...bo....#",
        "#..............#",
        "#..........#####",
        "#..........=..X#",
        "#..........#####",
        "################",
        "#..............#",
        "#.a........._#.#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.__.b.........#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}


class Ga92bf8e0:

    __slots__ = ("walls", "plates", "gates", "exits", "portals", "start", "crates")

    def __init__(self, rows: list[str]) -> None:
        self.walls: set[tuple[int, int]] = set()
        self.plates: set[tuple[int, int]] = set()
        self.gates: set[tuple[int, int]] = set()
        self.exits: set[tuple[int, int]] = set()
        self.portals: dict[tuple[int, int], tuple[int, int]] = {}
        self.crates: frozenset[tuple[int, int]] = frozenset()
        self.start: tuple[int, int] = (0, 0)
        groups: dict[str, list[tuple[int, int]]] = {}
        crates: set[tuple[int, int]] = set()
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "#":
                    self.walls.add((x, y))
                elif ch == "_":
                    self.plates.add((x, y))
                elif ch == "=":
                    self.gates.add((x, y))
                elif ch == "X":
                    self.exits.add((x, y))
                elif ch == "P":
                    self.start = (x, y)
                elif ch == "o":
                    crates.add((x, y))
                elif ch in PORTAL_COLOURS:
                    groups.setdefault(ch, []).append((x, y))
        self.crates = frozenset(crates)
        for letter, cells in groups.items():
            if len(cells) != 2:
                raise ValueError(f"portal '{letter}' needs exactly 2 mouths, got {len(cells)}")
            self.portals[cells[0]] = cells[1]
            self.portals[cells[1]] = cells[0]


def parse_level(rows: list[str]) -> Ga92bf8e0:
    if len(rows) != N or any(len(r) != N for r in rows):
        raise ValueError("every level must be a square grid of side N")
    return Ga92bf8e0(rows)


def plates_held(st: Ga92bf8e0, crates: frozenset) -> bool:
    return st.plates <= crates


def _crate_blocked(st: Ga92bf8e0, cell: tuple[int, int], others: frozenset) -> bool:
    x, y = cell
    if not (0 <= x < N and 0 <= y < N):
        return True
    return cell in st.walls or cell in st.gates or cell in st.exits or cell in others


def push_crate(st: Ga92bf8e0, crates: frozenset, src: tuple[int, int],
               d: tuple[int, int]) -> frozenset | None:
    dx, dy = d
    others = crates - {src}
    dest = (src[0] + dx, src[1] + dy)
    if _crate_blocked(st, dest, others):
        return None
    if dest not in st.portals:
        return others | {dest}

    out = st.portals[dest]
    if out in others:
        return None
    pos = out
    seen = {pos}
    while True:
        nxt = (pos[0] + dx, pos[1] + dy)
        if _crate_blocked(st, nxt, others):
            break
        if nxt in st.portals:
            hop = st.portals[nxt]
            if hop in others or hop in seen:
                break
            seen.add(hop)
            pos = hop
            continue
        if nxt in seen:
            break
        seen.add(nxt)
        pos = nxt
    return others | {pos}


def apply_move(st: Ga92bf8e0, player: tuple[int, int], crates: frozenset,
               d: tuple[int, int]) -> tuple[tuple[int, int], frozenset, bool]:
    dx, dy = d
    tgt = (player[0] + dx, player[1] + dy)
    x, y = tgt
    if not (0 <= x < N and 0 <= y < N) or tgt in st.walls:
        return player, crates, False
    if tgt in st.gates:
        if not plates_held(st, crates):
            return player, crates, False
        return tgt, crates, False
    if tgt in crates:
        moved = push_crate(st, crates, tgt, d)
        if moved is None:
            return player, crates, False
        return tgt, moved, False
    if tgt in st.exits:
        return tgt, crates, True
    return tgt, crates, False


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _cored(shell: int, core: int) -> list[list[int]]:
    block = _solid(shell)
    for i in (1, 2):
        for j in (1, 2):
            block[i][j] = core
    return block


def _ring(colour: int) -> list[list[int]]:
    return _cored(colour, FLOOR)


def _dot(colour: int) -> list[list[int]]:
    return _cored(FLOOR, colour)


def _static_sprite(pixels, name, layer, tags=()) -> Sprite:
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE, layer=layer, tags=list(tags),
    )


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        st = parse_level(spec["rows"])
        sprites: list[Sprite] = []
        for (x, y) in sorted(st.walls):
            sprites.append(_static_sprite(_solid(WALL), f"wall_{x}_{y}", -1)
                           .set_position(x * CELL, y * CELL))
        for (x, y) in sorted(st.plates):
            sprites.append(_static_sprite(_dot(PLATE), f"plate_{x}_{y}", -1, ["plate"])
                           .set_position(x * CELL, y * CELL))
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                if ch in PORTAL_COLOURS:
                    sprites.append(
                        _static_sprite(_ring(PORTAL_COLOURS[ch]), f"mouth_{ch}_{x}_{y}",
                                       -1, ["mouth", f"pair_{ch}"])
                        .set_position(x * CELL, y * CELL))
        for (x, y) in sorted(st.exits):
            sprites.append(_static_sprite(_solid(EXIT), f"exit_{x}_{y}", -1, ["exit"])
                           .set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Gdf672e23(ARCBaseGame):

    def __init__(self) -> None:
        self._statics = [parse_level(spec["rows"]) for spec in LEVELS_SPEC]
        self._st = self._statics[0]
        self._player = self._st.start
        self._crates = self._st.crates
        camera = Camera(width=N * CELL, height=N * CELL, background=FLOOR, letter_box=5)
        super().__init__(game_id="t61247d23", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self._st = self._statics[self.level_index]
        self._player = self._st.start
        self._crates = self._st.crates
        self._sync()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        for sprite in list(level.get_sprites_by_tag("dyn")):
            level.remove_sprite(sprite)
        held = plates_held(self._st, self._crates)
        if not held:
            for (x, y) in sorted(self._st.gates):
                level.add_sprite(
                    _static_sprite(_solid(GATE), f"gate_{x}_{y}", 0, ["dyn", "gate"])
                    .set_position(x * CELL, y * CELL))
        for (x, y) in sorted(self._crates):
            core = CRATE_SEATED if (x, y) in self._st.plates else CRATE_CORE
            level.add_sprite(
                _static_sprite(_cored(CRATE, core), f"crate_{x}_{y}", 1, ["dyn", "crate"])
                .set_position(x * CELL, y * CELL))
        px, py = self._player
        level.add_sprite(
            _static_sprite(_solid(PLAYER), "player", 2, ["dyn"])
            .set_position(px * CELL, py * CELL))

    def step(self) -> None:
        d = DIRS.get(self.action.id)
        if d is not None:
            self._player, self._crates, reached = apply_move(
                self._st, self._player, self._crates, d)
            self._sync()
            if reached:
                self.next_level()
        self.complete_action()
