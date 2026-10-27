# Author: Claude Opus 5.5 High (this version); earlier g050 by Codex (GPT-6) and contributors
# Date: 21-October-2026
# PURPOSE: ARC-AGI-3 candidate task g050, rebuilt after the Boss's review of g050@240220fa73b7
#   ("too easy because the pathable spaces are too few ... the player is very much on a set
#   path"). The rule is unchanged: ground you step off gives way behind you, stepping stones
#   never do, a flower lets you cross one hole, and the hut opens once every flower is taken.
#   What changed: every level is new open ground with real route choice, the whole board is in
#   view (no scrolling darkness), and the scene is drawn as named engine sprites.
# SRP/DRY check: Pass. The pure rule (ash_step / exit_open) is the one copy; the engine step,
#   the offline lab and the verifier all call it. Translation helpers kept from the published
#   version. No text, digits or labels are drawn.
#
# CHANGELOG
# 21-Oct-2026, Claude Opus 5.5 High: new levels (open meadows with ponds, stones and flowers in
#   place of one-wide corridors); board drawn whole at four pixels a cell instead of a scrolling
#   six-pixel view under fog; named sprites for water, holes, stones, flowers, hut and a
#   creature with an eye that looks where it last went and wears the flowers it carries; the
#   bar of pips under the board is gone (carried flowers are on the creature). Rule functions,
#   inputs (four arrows) and the stranded-restart are as published.

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


# ---------------------------------------------------------------------------
# Palette (ARC-3 indices) and the house look: green meadow, blue water, a yellow creature.
# ---------------------------------------------------------------------------
WHITE, GREY, NEAR_BLACK, BLACK = 0, 2, 4, 5
BLUE, LIGHT_BLUE, YELLOW, ORANGE, MAROON, GREEN, PURPLE = 9, 10, 11, 12, 13, 14, 15

MEADOW = GREEN          # ground that gives way once you step off it
WATER = BLUE            # never walkable
SHORE = BLACK           # the hard edge where water meets ground
HOLE = BLACK            # ground that has given way
CRUMB = MAROON          # the broken rim of a hole
CREATURE = YELLOW
EYE = BLACK
FLOWER = PURPLE
STONE = WHITE
STONE_SHADE = GREY
HUT = ORANGE
HUT_SHUT = BLACK
HUT_LIT = WHITE

LEVELS_SPEC = [
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "##............##",
        "##...........X##",
        "##....##......##",
        "##.P..........##",
        "##............##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "##.....#.....###",
        "##.....#..O..###",
        "##....S.S....###",
        "##...P.#.....###",
        "##X....#.....###",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "##.....#.....###",
        "##.....#..O..###",
        "##.....#.....###",
        "##..P.S.S....###",
        "##.....#.....###",
        "##.....#..O..###",
        "##X....#.....###",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "##.....#.....###",
        "##..O..#...P.###",
        "##.....S.....###",
        "##.....#.....###",
        "##.....#.....###",
        "####.#####S#####",
        "##.....#.....###",
        "##.....#.....###",
        "##.....S.....###",
        "##.....#..O..###",
        "##..X..#.....###",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "##............##",
        "##.O..........##",
        "##..##....##..##",
        "##..##....##..##",
        "##............##",
        "##.....##..O..##",
        "##....P##.....##",
        "##............##",
        "##..##....##..##",
        "##..##....##..##",
        "##..O........X##",
        "##............##",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "###O.#..#.O#..##",
        "###..#..#..#..##",
        "###..#..#..#..##",
        "###..#..#..#..##",
        "###..#..#..#..##",
        "###...........##",
        "###.....P.....##",
        "###..#..#..#..##",
        "###..#..#..#..##",
        "###..#..#..#..##",
        "###..#O.#..#.X##",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "##....#..#....##",
        "##.O..#..#....##",
        "##............##",
        "##....#..#....##",
        "###.########.###",
        "###S########S###",
        "##....#..#....##",
        "##....#..#..O.##",
        "##.P..........##",
        "##....#..#....##",
        "###.########.###",
        "###.########S###",
        "##X...#..#....##",
        "##............##",
        "################",
    ]},
    {"rows": [
        "################",
        "##...#....#..O##",
        "##.P.#....#...##",
        "##.............#",
        "##...#....#...##",
        "####S######.####",
        "##...#....#...##",
        "##O..#....#...##",
        "##.............#",
        "##...#....#...##",
        "####.######S####",
        "##...#....#...##",
        "##...#....#..O##",
        "##.............#",
        "##...#....#..X##",
        "################",
    ]},
    {"rows": [
        "################",
        "##O.#..#..#...O#",
        "##..#..#..#....#",
        "##..#..#..#....#",
        "##.............#",
        "##.............#",
        "##..#..####P.#.#",
        "##..#..####..#.#",
        "#####S#####.####",
        "##.....#.......#",
        "##..O..#.......#",
        "##.............#",
        "##.....#.......#",
        "##.....#.....X.#",
        "################",
        "################",
    ]},
]

N = 16
CELL = 4
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))


# ---------------------------------------------------------------------------
# The rule: pure functions, shared by the engine step, the lab and the verifier.
# ---------------------------------------------------------------------------

def coolant_cells(rows):
    return frozenset((x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c=='O')

def ash_step(rows,pos,ash,coolant,used,direction):
    dest=(pos[0]+direction[0],pos[1]+direction[1])
    x,y=dest
    if not (0<=x<N and 0<=y<N) or rows[y][x]=='#':return None
    ash=set(ash)
    if dest in ash:
        if coolant<=0:return None
        coolant-=1
        ash.remove(dest)
    if rows[pos[1]][pos[0]]!='S':ash.add(pos)
    if rows[y][x]=='O' and dest not in used:
        coolant+=1
        used=frozenset(used|{dest})
    return dest,frozenset(ash),coolant,used

def exit_open(rows,used):
    return coolant_cells(rows)<=used

def find_char(rows, char):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == char:
                return x, y
    raise AssertionError(f"level has no {char!r}")

def stone_cells(rows):
    return {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "S"}

def open_cells(rows):
    return {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != "#"}

def _open(rows, x, y) -> bool:
    return 0 <= x < N and 0 <= y < N and rows[y][x] != "#"


# ---------------------------------------------------------------------------
# Pictures. Every thing on the board is a named sprite built from these.
# ---------------------------------------------------------------------------
_ = -1

def creature_art(facing=(1, 0), carrying=0, body=CREATURE):
    """A round yellow body on two feet, one eye on the side it last moved toward, and a
    flower bud on its head for each flower it carries (at most two shown)."""
    px = [[_, body, body, _],
          [body, body, body, body],
          [body, body, body, body],
          [body, _, _, body]]
    dx, dy = facing
    if dy < 0:
        px[1][1] = px[1][2] = EYE        # looking up: both eyes high
    elif dy > 0:
        px[2][1] = px[2][2] = EYE        # looking down
    elif dx < 0:
        px[1][0] = EYE
    else:
        px[1][3] = EYE
    if carrying >= 1:
        px[0][1] = FLOWER
    if carrying >= 2:
        px[0][2] = FLOWER
    return px

def water_art(rows, x, y):
    """Flat water, with a black shoreline on each side that touches ground."""
    px = [[WATER] * CELL for _ in range(CELL)]
    if _open(rows, x, y - 1):
        px[0] = [SHORE] * CELL
    if _open(rows, x, y + 1):
        px[CELL - 1] = [SHORE] * CELL
    if _open(rows, x - 1, y):
        for r in range(CELL):
            px[r][0] = SHORE
    if _open(rows, x + 1, y):
        for r in range(CELL):
            px[r][CELL - 1] = SHORE
    return px

def ripple_art(phase):
    """A short light wave that slides one pixel back and forth."""
    px = [[-1] * CELL for _row in range(CELL)]
    px[2][phase % 2] = px[2][1 + phase % 2] = px[1][1 + phase % 2] = LIGHT_BLUE
    return px

def stone_art():
    return [[_, STONE, STONE, _],
            [STONE, STONE, STONE, STONE_SHADE],
            [STONE, STONE, STONE_SHADE, STONE_SHADE],
            [_, STONE_SHADE, STONE_SHADE, _]]

def stone_pressed_art():
    """The stone as the creature steps off it: a shade darker for a beat, then whole again."""
    return [[_, STONE_SHADE, STONE_SHADE, _],
            [STONE_SHADE, STONE, STONE, STONE_SHADE],
            [STONE_SHADE, STONE, STONE, STONE_SHADE],
            [_, STONE_SHADE, STONE_SHADE, _]]

def flower_art():
    return [[_, FLOWER, FLOWER, _],
            [FLOWER, WHITE, WHITE, FLOWER],
            [_, FLOWER, FLOWER, _],
            [_, _, NEAR_BLACK, _]]

def crack_art():
    """Ground in the middle of giving way."""
    return [[_, HOLE, _, _],
            [_, CRUMB, HOLE, _],
            [_, HOLE, CRUMB, _],
            [_, _, HOLE, _]]

def hole_art(flash=False):
    rim = YELLOW if flash else CRUMB
    return [[rim, HOLE, HOLE, rim],
            [HOLE, HOLE, HOLE, HOLE],
            [HOLE, HOLE, HOLE, HOLE],
            [rim, HOLE, HOLE, rim]]

def hut_art(lit, flash=False):
    door = HUT_LIT if lit else HUT_SHUT
    wall = YELLOW if flash else HUT
    return [[_, wall, wall, _],
            [wall, wall, wall, wall],
            [wall, door, door, wall],
            [wall, door, door, wall]]


def _water_runs(rows):
    """Each run of water along a row is one sprite, its cells pictured one by one."""
    for y, row in enumerate(rows):
        x = 0
        while x < N:
            if row[x] == "#":
                x0 = x
                while x < N and row[x] == "#":
                    x += 1
                cells = [water_art(rows, x0 + i, y) for i in range(x - x0)]
                yield x0, y, [[cells[i][r][c] for i in range(len(cells)) for c in range(CELL)]
                              for r in range(CELL)]
            else:
                x += 1

def ripple_cells(rows):
    """A few water cells, well inside the water, where a ripple drifts. They do nothing."""
    return [(x, y) for y in range(N) for x in range(N)
            if rows[y][x] == "#" and (x * 5 + y * 11) % 23 == 4
            and not any(_open(rows, x + dx, y + dy) for dx, dy in DIRS)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for x0, y, px in _water_runs(rows):
            sprites.append(Sprite(
                pixels=px, name=f"water_{x0}_{y}", tags=["water"],
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=-1,
            ).set_position(x0 * CELL, y * CELL))
        for x, y in ripple_cells(rows):
            sprites.append(Sprite(
                pixels=ripple_art((x + y) % 2), name=f"ripple_{x}_{y}", tags=["ripple"],
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
            ).set_position(x * CELL, y * CELL))
        for x, y in sorted(stone_cells(rows)):
            sprites.append(Sprite(
                pixels=stone_art(), name=f"stone_{x}_{y}", tags=["stone"],
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
            ).set_position(x * CELL, y * CELL))
        for x, y in sorted(coolant_cells(rows)):
            sprites.append(Sprite(
                pixels=flower_art(), name=f"flower_{x}_{y}", tags=["flower"],
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
            ).set_position(x * CELL, y * CELL))
        ex, ey = find_char(rows, "X")
        sprites.append(Sprite(
            pixels=hut_art(exit_open(rows, frozenset())), name="hut", tags=["exit"],
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
        ).set_position(ex * CELL, ey * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=creature_art(), name="player", tags=["creature"],
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G050(ARCBaseGame):

    BURN_FRAMES = 1
    DIE_FRAMES = 5
    WIN_FRAMES = 5

    def __init__(self) -> None:
        self.ash: set[tuple[int, int]] = set()
        self.coolant = 0
        self.used_coolant = frozenset()
        self._fx: tuple[str, int] | None = None
        self._vacated: tuple[int, int] | None = None
        self._pending: str | None = None
        self._facing = (1, 0)
        self._beat = 0
        camera = Camera(width=64, height=64, background=MEADOW, letter_box=BLACK)
        super().__init__(game_id="g050", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])
        self.on_set_level(self.current_level)

    @property
    def rows(self) -> list[str]:
        return LEVELS_SPEC[self.level_index]["rows"]

    def player_cell(self) -> tuple[int, int]:
        player = self.current_level.get_sprites_by_name("player")
        if not player:
            return 0, 0
        return player[0].x // CELL, player[0].y // CELL

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self.ash = set()
        self.coolant = 0
        self.used_coolant = frozenset()
        self._fx = None
        self._vacated = None
        self._pending = None
        self._facing = (1, 0)
        self._beat = 0
        self.camera.x = self.camera.y = 0
        self._paint_ripples()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def passable(self, x: int, y: int) -> bool:
        if not (0 <= x < N and 0 <= y < N):
            return False
        return self.rows[y][x] != "#" and ((x, y) not in self.ash or self.coolant>0)

    def _stuck(self) -> bool:
        x, y = self.player_cell()
        return not any(self.passable(x + dx, y + dy) for dx, dy in DIRS)

    def _repaint(self, name: str, pixels) -> None:
        for sprite in self.current_level.get_sprites_by_name(name):
            sprite.pixels = np.array(pixels)

    def _paint_creature(self, body=CREATURE) -> None:
        self._repaint("player", creature_art(self._facing, self.coolant, body))

    def _paint_ripples(self) -> None:
        for sprite in self.current_level.get_sprites_by_tag("ripple"):
            phase = (sprite.x // CELL + sprite.y // CELL + self._beat // 2) % 2
            sprite.pixels = np.array(ripple_art(phase))

    def _give_way(self, x: int, y: int) -> None:
        """The cell just left starts to break: a crack now, a hole once the step settles."""
        self.current_level.add_sprite(Sprite(
            pixels=crack_art(), name=f"hole_{x}_{y}", tags=["hole"],
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
        ).set_position(x * CELL, y * CELL))

    def _paint_vacated(self, settling: bool) -> None:
        if self._vacated is None:
            return
        x, y = self._vacated
        if self.rows[y][x] == "S":
            self._repaint(f"stone_{x}_{y}", stone_pressed_art() if settling else stone_art())
        else:
            self._repaint(f"hole_{x}_{y}", crack_art() if settling else hole_art())

    def _paint_fx(self, kind: str, left: int) -> None:
        if kind == "burn":
            self._paint_vacated(settling=left > 0)
            return
        lit = left % 2 == 1
        if kind == "die":
            # Stranded: the creature greys out and every hole flashes its rim.
            self._paint_creature(GREY if lit else CREATURE)
            for sprite in self.current_level.get_sprites_by_tag("hole"):
                sprite.pixels = np.array(hole_art(lit))
        else:
            self._paint_creature(WHITE if lit else CREATURE)
            self._repaint("hut", hut_art(True, lit))

    def _resolve(self, kind: str) -> None:
        if kind == "burn":
            if self._pending == "win":
                self._fx = ("win", self.WIN_FRAMES)
                self._paint_fx("win", self.WIN_FRAMES)
                return
            if self._pending == "die":
                self._fx = ("die", self.DIE_FRAMES)
                self._paint_fx("die", self.DIE_FRAMES)
                return
        elif kind == "win":
            self.next_level()
        else:
            # Stranded: the level starts again. level_reset() zeroes the engine's action
            # count, and a RESET on a zero count restarts the whole game, so put it back.
            count = self._action_count
            self.level_reset()
            self._action_count = max(1, count)
        finish_translation(self)

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('player',), limit=CELL)
        self._beat += 1
        self._paint_ripples()

        if self._fx is not None:
            kind, left = self._fx
            left -= 1
            self._fx = (kind, left) if left else None
            self._paint_fx(kind, left)
            if left == 0:
                self._resolve(kind)
            return

        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1

        if dx or dy:
            before = self.player_cell()
            self._facing = (dx, dy)
            result=ash_step(self.rows,before,self.ash,self.coolant,self.used_coolant,(dx,dy))
            if result is None:
                # Refused: the creature still turns to look, so the press is seen.
                self._paint_creature()
                finish_translation(self)
                return
            after,new_ash,self.coolant,self.used_coolant=result
            for sprite in self.current_level.get_sprites_by_name('player'):
                sprite.set_position(after[0]*CELL,after[1]*CELL)
            if after in self.ash:
                # A carried flower fills the hole for this one crossing.
                for sprite in self.current_level.get_sprites_by_name(f'hole_{after[0]}_{after[1]}'):
                    self.current_level.remove_sprite(sprite)
            if self.rows[before[1]][before[0]] != "S":
                self._give_way(*before)
            self.ash=set(new_ash)
            for sprite in self.current_level.get_sprites_by_name(f'flower_{after[0]}_{after[1]}'):
                self.current_level.remove_sprite(sprite)
            self._paint_creature()
            self._repaint('hut', hut_art(exit_open(self.rows, self.used_coolant)))
            self._vacated = before
            if after == find_char(self.rows, "X") and exit_open(self.rows,self.used_coolant):
                self._pending = "win"
            elif self._stuck():
                self._pending = "die"
            else:
                self._pending = None
            self._fx = ("burn", self.BURN_FRAMES)
            self._paint_fx("burn", self.BURN_FRAMES)
            finish_translation(self, complete=False)
            return

        finish_translation(self)
