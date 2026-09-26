# ARC-AGI-3 authoring support module.

from __future__ import annotations


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


def key_shape(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[0][1] = px[0][2] = colour
    px[1][1] = px[1][2] = colour
    px[2][1] = colour
    px[3][1] = px[3][2] = colour
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


def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]


def hatch(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 3 == 0 else -1 for x in range(cell)] for y in range(cell)]


def hex_face(colour: int, cell: int = 6) -> list[list[int]]:
    taper = max(1, cell // 3)
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        cut = max(0, taper - min(y, cell - 1 - y))
        for x in range(cut, cell - cut):
            px[y][x] = colour
    return px


def gauge(colour: int, value: int, cell: int = 6) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for k in range(min(value, cell - 2)):
        for x in range(1, cell - 1):
            px[cell - 2 - k][x] = colour
    return px


def hex_ring(colour: int, cell: int = 6) -> list[list[int]]:
    solid = hex_face(colour, cell)
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if solid[y][x] < 0:
                continue
            edge = any(
                not (0 <= y + dy < cell and 0 <= x + dx < cell)
                or solid[y + dy][x + dx] < 0
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
            )
            if edge:
                px[y][x] = colour
    return px


def pips(colour: int, count: int, cell: int = 6) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    if count <= 0:
        return px
    n = 0
    for y in range(cell - 2, 0, -1):
        for x in range(1, cell - 1):
            if n >= count:
                return px
            px[y][x] = colour
            n += 1
    return px


def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px


def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


def hairline(frame, a: tuple, b: tuple, colour: int, only_over=None):
    x0, y0 = a
    x1, y1 = b
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    h, w = frame.shape
    while True:
        if 0 <= x0 < w and 0 <= y0 < h:
            if only_over is None or int(frame[y0, x0]) in only_over:
                frame[y0, x0] = colour
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
    return frame


def dither(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            if (x + y) % 2:
                frame[y, x] = colour
    return frame


def outline(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for x in range(max(0, x0), min(w, x1)):
        if 0 <= y0 < h:
            frame[y0, x] = colour
        if 0 <= y1 - 1 < h:
            frame[y1 - 1, x] = colour
    for y in range(max(0, y0), min(h, y1)):
        if 0 <= x0 < w:
            frame[y, x0] = colour
        if 0 <= x1 - 1 < w:
            frame[y, x1 - 1] = colour
    return frame


def studs(frame, count: int, filled: int, on: int, off: int, side: str = "east",
          start: int = 8, gap: int = 6):
    h, w = frame.shape
    for i in range(count):
        top = start + i * gap
        if top + 2 > h:
            break
        colour = on if i < filled else off
        length = min(1 + i, w // 4)
        if side == "east":
            frame[top:top + 2, w - length:w] = colour
        else:
            frame[top:top + 2, 0:length] = colour
    return frame


def backdrop(frame, pattern: str, colours: tuple, background: int):
    h, w = frame.shape
    for y in range(h):
        for x in range(w):
            if int(frame[y, x]) != background:
                continue
            if pattern == "halves":
                frame[y, x] = colours[0] if x < w // 2 else colours[1]
            elif pattern == "quarters":
                frame[y, x] = colours[(0 if x < w // 2 else 1) + (0 if y < h // 2 else 2)]
            elif pattern == "checker":
                frame[y, x] = colours[((x // 8) + (y // 8)) % len(colours)]
    return frame


def ease_out(t: float) -> float:
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return 1 - (1 - t) * (1 - t)


def tween(a: int, b: int, step: int, span: int) -> int:
    if span <= 0:
        return b
    return int(round(a + (b - a) * ease_out(step / span)))


def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


def creep(current: int, target: int) -> int:
    if current == target:
        return current
    return current + (1 if target > current else -1)


def pixel_art(rows: tuple, colours: dict) -> list[list[int]]:
    return [[-1 if ch == "." else colours[ch] for ch in row] for row in rows]


def tree(canopy: int, shade: int, trunk: int) -> list[list[int]]:
    return pixel_art((".kk.kk..", "kggkggk.", "kgggggkk", "kggggggk",
                      "kggggggk", ".kkggkk.", "..kttk..", ".tt..tt."),
                     {"k": shade, "g": canopy, "t": trunk})


def pine(canopy: int, shade: int, trunk: int) -> list[list[int]]:
    return pixel_art(("...kk...", "..kggk..", "..kggk..", ".kggggk.",
                      ".kggggk.", "kggggggk", "kkkkkkkk", "...tt..."),
                     {"k": shade, "g": canopy, "t": trunk})


def pond(water: int, crest: int, phase: int = 0) -> list[list[int]]:
    rows = ["..wwww..", ".wwwwww.", "wwwwwwww", "wwwwwwww",
            "wwwwwwww", ".wwwwww.", "..wwww..", "........"]
    out = pixel_art(tuple(rows), {"w": water})
    for y, x in ((1, 3), (3, 5), (4, 1)):
        xx = (x + phase) % 8
        if out[y][xx] != -1:
            out[y][xx] = crest
    return out


def bush(leaf: int, shade: int) -> list[list[int]]:
    return pixel_art(("....", ".kk.", "kggk", "kkkk"), {"g": leaf, "k": shade})


def stones(light: int, dark: int) -> list[list[int]]:
    return pixel_art(("....", ".ld.", "lldd", "...."), {"l": light, "d": dark})


def brick(face: int, mortar: int, row: int = 0) -> list[list[int]]:
    return pixel_art(("fffm", "mmmm", "fmff", "mmmm") if row % 2 == 0
                     else ("fmff", "mmmm", "fffm", "mmmm"), {"f": face, "m": mortar})


def gate(colour: int) -> list[list[int]]:
    return pixel_art(("cccc", "c.c.", "c.c.", "cccc"), {"c": colour})


def altar(rim: int, hollow: int, flame: int | None = None) -> list[list[int]]:
    if flame is None:
        return pixel_art((".rr.", "rhhr", "rhhr", ".rr."), {"r": rim, "h": hollow})
    return pixel_art((".f..", "rffr", "rhhr", ".rr."), {"r": rim, "h": hollow, "f": flame})


def doorway(frame: int, dark: int) -> list[list[int]]:
    return pixel_art((".ff.", "fddf", "fddf", "fddf"), {"f": frame, "d": dark})


def walker(colour: int) -> list[list[int]]:
    return pixel_art((".cc.", "cccc", ".cc.", "c..c"), {"c": colour})


def critter(colour: int) -> list[list[int]]:
    return pixel_art(("c..c", "cccc", ".cc.", "c..c"), {"c": colour})


def flower(petal: int, centre: int, stem: int, open_: bool) -> list[list[int]]:
    if open_:
        return pixel_art((".p.p", "..c.", ".p.p", "...."), {"p": petal, "c": centre})
    return pixel_art(("....", "..p.", ".s.s", "...."), {"p": petal, "s": stem})


def thorns(colour: int) -> list[list[int]]:
    return pixel_art(("c.c.", ".ccc", "ccc.", ".c.c"), {"c": colour})


def lantern(flame: int, frame_: int) -> list[list[int]]:
    return pixel_art((".kk.", "kffk", "kffk", ".kk."), {"f": flame, "k": frame_})


def boot(leather: int) -> list[list[int]]:
    return pixel_art((".b..", ".b..", ".bb.", ".bbb"), {"b": leather})


def waves(sea: int, crest: int, seed: int) -> list[list[int]]:
    px = [[sea] * 4 for _ in range(4)]
    if seed % 3 == 0:
        y, x = (seed >> 2) % 3, (seed >> 4) % 3
        px[y][x] = crest
        px[y][x + 1] = crest
    return px


def shallows(water: int, foam: int, seed: int) -> list[list[int]]:
    px = [[water] * 4 for _ in range(4)]
    px[seed % 4][(seed >> 2) % 4] = foam
    px[(seed >> 4) % 4][(seed >> 6) % 4] = foam
    return px


def rune_ring(colour: int, glow: int | None = None) -> list[list[int]]:
    if glow is None:
        return pixel_art((".rr.", "r..r", "r..r", ".rr."), {"r": colour})
    return pixel_art((".rr.", "rggr", "rggr", ".rr."), {"r": colour, "g": glow})


def wall_torch(flame: int, tip: int, bowl: int, phase: int) -> list[list[int]]:
    rows = ("t.f.", ".ff.", "bbbb", ".bb.") if phase % 2 == 0 else (".t.f", ".ff.", "bbbb", ".bb.")
    return pixel_art(rows, {"f": flame, "t": tip, "b": bowl})


def sword(blade: int, hilt: int) -> list[list[int]]:
    return pixel_art(("...b", "..b.", "hb..", ".h.."), {"b": blade, "h": hilt})


def anchor_shape(colour: int) -> list[list[int]]:
    return pixel_art((".c..", "ccc.", ".c..", "c.c."), {"c": colour})


def crystal(colour: int, bright: bool) -> list[list[int]]:
    return pixel_art(("..c.", ".ccc", "..c.", "....") if bright
                     else ("....", "..c.", "..c.", "...."), {"c": colour})


def boulder(face: int, light: int) -> list[list[int]]:
    return pixel_art((".ll.", "lllf", "llff", ".ff."), {"l": light, "f": face})


def keyed_door(colour: int, pips, hole: int) -> list[list[int]]:
    px = pixel_art((".cc.", "cccc", "cccc", "cccc"), {"c": colour})
    for x, y in pips:
        px[y][x] = hole
    return px


def stair(frame_: int, dark: int, pips, mark: int) -> list[list[int]]:
    px = pixel_art((".ff.", "fddf", "fddf", "fddf"), {"f": frame_, "d": dark})
    for x, y in pips:
        px[min(3, y + 1)][x] = mark
    return px


def raft(wood: int, gap: int) -> list[list[int]]:
    return pixel_art(("wwww", "gggg", "wwww", "...."), {"w": wood, "g": gap})


def cleats(steel: int) -> list[list[int]]:
    return pixel_art(("....", "s...", "ssss", "s.s."), {"s": steel})


def tent(canvas: int, inside: int) -> list[list[int]]:
    return pixel_art(("..t.", ".tit", "tiit", "tttt"), {"t": canvas, "i": inside})


def cairn(stone: int) -> list[list[int]]:
    return pixel_art(("..s.", ".ss.", ".sss", "ssss"), {"s": stone})


def rock(face: int, crack: int, seed: int) -> list[list[int]]:
    px = [[face] * 4 for _ in range(4)]
    if seed % 4 == 0:
        y, x = 1 + (seed >> 3) % 2, (seed >> 5) % 3
        px[y][x] = crack
        px[y][x + 1] = crack
    return px


def stamp(frame, x: int, y: int, sprite) -> None:
    h, w = len(frame), len(frame[0])
    for r, row in enumerate(sprite):
        for c, v in enumerate(row):
            if v >= 0 and 0 <= y + r < h and 0 <= x + c < w:
                frame[y + r][x + c] = v


def _selftest() -> int:
    import numpy as np

    fails = []

    def check(name, ok):
        if not ok:
            fails.append(name)

    builders = {
        "block": block(3), "rounded": rounded(3), "ring": ring(3), "core": core(3),
        "figure": figure(3, 5), "facing": facing(3, 0, (1, 0)),
        "medallion": medallion(11, 12), "key_shape": key_shape(11),
        "door_shut": door(2, 5), "door_open": door(2, None),
        "weave": weave(8), "hatch": hatch(8), "speckle": speckle(1, 3),
        "fixture": fixture((6, 10), 1, 2),
    }
    for name, px in builders.items():
        check(f"{name}: shape", len(px) == 4 and all(len(r) == 4 for r in px))
        check(f"{name}: no -2", all(v != -2 for r in px for v in r))
        check(f"{name}: valid indices", all(v == -1 or 0 <= v <= 15 for r in px for v in r))

    hexes = {"hex_face": hex_face(9, 6), "hex_ring": hex_ring(9, 6),
             "pips": pips(8, 3, 6), "gauge": gauge(8, 2, 6)}
    for name, px in hexes.items():
        check(f"{name}: shape", len(px) == 6 and all(len(r) == 6 for r in px))
        check(f"{name}: no -2", all(v != -2 for r in px for v in r))
        check(f"{name}: valid indices", all(v == -1 or 0 <= v <= 15 for r in px for v in r))
    face = hexes["hex_face"]
    check("hex_face: corners cut", face[0][0] == -1 and face[5][5] == -1)
    check("hex_face: waist is full", all(v == 9 for v in face[2]))
    check("hex_face: tapers", sum(1 for v in face[0] if v >= 0) == 2
          and sum(1 for v in face[1] if v >= 0) == 4)
    for n in range(0, 5):
        rows_lit = [y for y in range(6) if any(v >= 0 for v in gauge(8, n, 6)[y])]
        check(f"gauge: {n} rows", len(rows_lit) == min(n, 4))
        check(f"gauge: {n} fills from the bottom",
              not rows_lit or max(rows_lit) == 4)
    check("hex_ring: hollow", hexes["hex_ring"][3][3] == -1)
    check("hex_ring: fits inside the face",
          all(face[y][x] >= 0 for y in range(6) for x in range(6)
              if hexes["hex_ring"][y][x] >= 0))
    for n in range(0, 9):
        check(f"pips: draws {n}",
              sum(1 for r in pips(8, n, 6) for v in r if v >= 0) == n)

    for name in ("rounded", "ring", "figure", "medallion", "key_shape", "weave"):
        check(f"{name}: is not solid", any(v == -1 for r in builders[name] for v in r))

    shut, opened = builders["door_shut"], builders["door_open"]
    same = all((shut[y][x] == -1) == (opened[y][x] == -1) or shut[y][x] == 5
               for y in range(4) for x in range(4))
    check("door: shut and open share a frame", same)

    for heading, probe in (((0, -1), (0, 1)), ((0, 1), (3, 1)), ((-1, 0), (1, 0)), ((1, 0), (1, 3))):
        px = facing(3, 0, heading)
        check(f"facing {heading}", px[probe[0]][probe[1]] == 0)

    check("speckle: deterministic", speckle(1, 5) == speckle(1, 5))
    check("speckle: seed changes it", speckle(1, 5) != speckle(1, 6))

    f = np.zeros((64, 64), dtype=int)
    hairline(f, (2, 2), (30, 20), 9)
    check("hairline: drew", int(f.sum()) > 0)
    f2 = np.full((64, 64), 7, dtype=int)
    hairline(f2, (0, 0), (63, 63), 9, only_over={0})
    check("hairline: only_over respected", not (f2 == 9).any())
    f3 = np.zeros((64, 64), dtype=int)
    outline(f3, (10, 10, 20, 20), 5)
    check("outline: edge drawn", f3[10, 15] == 5)
    check("outline: middle untouched", f3[15, 15] == 0)
    f4 = np.zeros((64, 64), dtype=int)
    f4[30, 30] = 4
    backdrop(f4, "halves", (1, 2), 0)
    check("backdrop: left half", f4[0, 0] == 1)
    check("backdrop: right half", f4[0, 63] == 2)
    check("backdrop: drawn pixel survives", f4[30, 30] == 4)
    f5 = np.zeros((64, 64), dtype=int)
    studs(f5, 4, 2, 11, 3)
    check("studs: first is shorter than last", int((f5[8:10] == 11).sum()) < int((f5[26:28] == 3).sum()) + 4)

    check("ease_out: bounds", ease_out(0) == 0.0 and ease_out(1) == 1.0)
    check("ease_out: front-loaded", ease_out(0.5) > 0.5)
    check("tween: endpoints", tween(0, 10, 0, 5) == 0 and tween(0, 10, 5, 5) == 10)
    check("tween: zero span", tween(0, 10, 0, 0) == 10)
    check("blink: alternates", blink(0) and not blink(3) and blink(6))
    check("creep: steps one", creep(4, 9) == 5 and creep(9, 4) == 8 and creep(7, 7) == 7)

    for name in fails:
        print(f"FAIL {name}")
    print(f"sprite_book selftest: {len(builders)} builders, "
          f"{'all ok' if not fails else str(len(fails)) + ' FAILURES'}")
    return 1 if fails else 0


if __name__ == "__main__":
    import sys
    sys.exit(_selftest())


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
