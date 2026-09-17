"""
Author: Claude Opus 5
Date: 17-September-2026 (rewritten the same day to read the game's own sprite table)
PURPOSE: Build the TR87 rune legend -- one tiny PNG per rune showing that rune in all four
rotations -- for the named-symbol card on /arc3/games/tr87. TR87 gives every tile a random
quarter-turn when the level loads, so one rune shows up four different ways; a reader who has
only seen one orientation cannot tell two sightings apart, and prose about the game needs
both a name and a picture of the turns.

WHERE THE BITMAPS COME FROM. The game's own sprite table: the 21 glyph sprites
`nxkictbbvzt{A,B,C}{1..7}` in tr87.py, seven per alphabet -- A is light blue (the sentence),
B is light pink (the middle language), C is yellow (the answer), matching the three tile
sprites `gyrdjxybtcm{A,B,C}`. Each glyph is 5x5 of colour 5 (black) on -1 (transparent),
drawn here centred on a 7x7 tile of its alphabet's colour, the way the game draws it.

    The first version of this script read the runes off Boss's player-console captures
    instead, because tr87 has no local environment_files/ copy. That found 19 of the 21:
    all 7 blue, all 7 pink, 5 of 7 yellow. Every one of those 19 matched a source sprite
    exactly, and the two it could not see are C4 (Sparks) and C5 (Window).

THE SOURCE FILE. Not in this repo. Pass --source, or drop it at the default path:
    external/ARCEngine/environment_files/tr87/cd924810/tr87.py
Failing that, arc-3 publishes a copy (build cd924810, the live one):
    gh api -H "Accept: application/vnd.github.raw" \\
      repos/sonpham-org/arc-3/contents/docs/static/games/src/tr87-cd924810/tr87.py

ROTATION IS THE POINT. Runes are keyed by the lexicographically smallest of their four
rotations -- the same equality the game itself uses -- so RUNE_NAMES survives a rebuild from a
differently-rotated copy of the sprite table. A key with no name is reported, never skipped.

THE PALETTE IS NOT REDEFINED HERE. Parsed from shared/config/arc3Colors.ts, the same single
source of truth that scripts/arc3/render_public_demo_levels.py reads.

OUTPUT. client/public/arc3-levels/tr87/runes/<slug>.png, each four tiles wide (one per
rotation, 6 px per cell, 4 px gutters), plus a JSON summary on stdout in the shape of
`symbolGlyphs` in shared/arc3Games/tr87.ts.

Run:  python3 scripts/arc3/extract_tr87_runes.py --source path/to/tr87.py
      python3 scripts/arc3/extract_tr87_runes.py --source path/to/tr87.py --print-keys
SRP/DRY check: Pass - reads the palette from arc3Colors.ts rather than copying it. Sprite
parsing lives only here; render_public_demo_levels.py renders whole levels through the engine,
which needs a local environment_files/ copy this game does not have.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "client" / "public" / "arc3-levels" / "tr87" / "runes"
PALETTE_TS = REPO / "shared" / "config" / "arc3Colors.ts"
DEFAULT_SOURCE = REPO / "external" / "ARCEngine" / "environment_files" / "tr87" / "cd924810" / "tr87.py"

GLYPH_SPRITE = re.compile(r'"nxkictbbvzt([ABC])([1-7])": Sprite\(\s*pixels=(\[.*?\]),\s*name=', re.S)
GLYPH_VALUE = 5  # black, in the game's own palette indices
GRID = 7  # cells per drawn tile (a 5x5 glyph centred with a one-cell border)
SCALE = 6  # px per cell in the output PNG
GUTTER = 4  # px between rotations

# Sprite-name letter -> (our word for the alphabet, its tile colour, what it is in the game).
ALPHABETS = {
    "A": ("blue", 10, "the sentence"),
    "B": ("pink", 7, "the middle language"),
    "C": ("yellow", 11, "the answer"),
}
GLYPH_COLOR = 5  # black

# Canonical key (smallest of the four rotations) -> (name, what it looks like). The names are
# ours, from Boss's play on 17-Sep-2026; the game itself never names a rune.
RUNE_NAMES: dict[str, tuple[str, str]] = {
    "0000100101111110010100001": ("Fork", "a spine with two prongs off one side"),  # A1, blue
    "0000100101111111010010000": ("Lightning", "a bar with a step up one end and a step down the other"),  # A2, blue
    "1000110001110111000111111": ("Gate", "two posts and a crossbar, with a notch in the middle"),  # A3, blue
    "0010010101101011111100100": ("Trident", "three prongs off a crossbar"),  # A4, blue
    "1000111111001001111110001": ("Butterfly", "two wings each side, pinched in the middle"),  # A5, blue
    "1000110001111011010110111": ("Staircase", "a bar, a step down, a bar"),  # A6, blue
    "1000111111100011000111011": ("I-Beam", "a bar at each end, joined through the middle"),  # A7, blue
    "0000101111010010100111111": ("Flag", "a box with a short tail off one corner"),  # B1, pink
    "1111110001101111010111111": ("Maze", "a box with a little maze inside it"),  # B2, pink
    "0011100101111111010011100": ("Pinwheel", "two boxes offset diagonally, joined through the middle"),  # B3, pink
    "0011111101101011110100111": ("Snail", "a box with a smaller box curled inside it"),  # B4, pink
    "0010011111100011000111111": ("Lantern", "a box with a stub on top, like a handle"),  # B5, pink
    "0111111001100011001111110": ("Ring", "a fat ring with a nick in it"),  # B6, pink
    "0010011111101011111100100": ("Ladder", "two little boxes side by side, a stub out of each end"),  # B7, pink
    "1010100001101010000111111": ("Comb", "a long back with broken-off teeth"),  # C1, yellow
    "1001100001100011000011001": ("Corners", "two broken corners facing away from each other"),  # C2, yellow
    "1000110000111110000110001": ("Hooks", "a bar with a hook at each end, pointing opposite ways"),  # C3, yellow
    "0010010101001001010100100": ("Sparks", "a dashed line with a dot off each side"),  # C4, yellow
    "1101110001101011000111011": ("Window", "a frame with a gap top and bottom and a speck in the middle"),  # C5, yellow
    "1010100000101111010111101": ("Fence", "three rungs stacked with gaps"),  # C6, yellow
    "0101011011100010000010001": ("Fangs", "two eyes on top, two fangs below"),  # C7, yellow
}


def load_palette() -> dict[int, tuple[int, int, int]]:
    src = PALETTE_TS.read_text(encoding="utf-8")
    m = re.search(r"ARC3_COLORS_TUPLES[^{]*\{(.*?)\n\}", src, re.S)
    if not m:
        raise SystemExit(f"could not find ARC3_COLORS_TUPLES in {PALETTE_TS}")
    palette = {
        int(k): (int(r), int(g), int(b))
        for k, r, g, b in re.findall(
            r"(\d+)\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]", m.group(1)
        )
    }
    if set(palette) != set(range(16)):
        raise SystemExit(f"expected colours 0-15, parsed {sorted(palette)}")
    return palette


def read_glyphs(source: Path) -> dict[str, np.ndarray]:
    """The 21 glyph sprites, as {sprite suffix (e.g. 'A1'): 5x5 binary bitmap}."""
    text = source.read_text(encoding="utf-8")
    glyphs: dict[str, np.ndarray] = {}
    for letter, index, pixels in GLYPH_SPRITE.findall(text):
        bitmap = (np.array(ast.literal_eval(pixels)) == GLYPH_VALUE).astype(int)
        if bitmap.shape != (5, 5):
            raise SystemExit(f"glyph {letter}{index} is {bitmap.shape}, expected (5, 5)")
        glyphs[f"{letter}{index}"] = bitmap
    expected = {f"{a}{n}" for a in ALPHABETS for n in range(1, 8)}
    if set(glyphs) != expected:
        raise SystemExit(f"expected 21 glyph sprites, found {sorted(glyphs)}")
    return glyphs


def rotations(bitmap: np.ndarray) -> list[np.ndarray]:
    out = [bitmap]
    for _ in range(3):
        out.append(np.rot90(out[-1]))
    return out


def canonical_key(bitmap: np.ndarray) -> str:
    return min("".join(str(int(v)) for v in rot.flatten()) for rot in rotations(bitmap))


def ascii_art(bitmap: np.ndarray) -> list[str]:
    return ["".join("#" if v else "." for v in row) for row in bitmap]


def render_rune(bitmap: np.ndarray, tile_color: int, palette: dict[int, tuple[int, int, int]]) -> Image.Image:
    """The rune on its tile, four times over: one tile per quarter-turn."""
    tile_px = GRID * SCALE
    canvas = Image.new("RGBA", (4 * tile_px + 3 * GUTTER, tile_px), (0, 0, 0, 0))
    tile_rgb, glyph_rgb = palette[tile_color], palette[GLYPH_COLOR]
    for n, rot in enumerate(rotations(bitmap)):
        cells = np.zeros((tile_px, tile_px, 4), dtype=np.uint8)
        cells[:, :] = (*tile_rgb, 255)
        for i in range(rot.shape[0]):
            for j in range(rot.shape[1]):
                if rot[i, j]:
                    y, x = (i + 1) * SCALE, (j + 1) * SCALE  # centred: one cell of border
                    cells[y : y + SCALE, x : x + SCALE] = (*glyph_rgb, 255)
        canvas.paste(Image.fromarray(cells, mode="RGBA"), (n * (tile_px + GUTTER), 0))
    return canvas


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="path to tr87.py")
    parser.add_argument("--print-keys", action="store_true", help="print canonical keys and ASCII art, write nothing")
    args = parser.parse_args(argv)

    if not args.source.exists():
        raise SystemExit(f"no tr87.py at {args.source} -- see this script's docstring for where to get it")

    glyphs = read_glyphs(args.source)

    if args.print_keys:
        for sprite in sorted(glyphs):
            key = canonical_key(glyphs[sprite])
            named = RUNE_NAMES.get(key)
            print(f'"{key}": {sprite} {ALPHABETS[sprite[0]][0]} {named[0] if named else "UNNAMED"}')
            for row in ascii_art(glyphs[sprite]):
                print("   " + row)
        return 0

    unnamed = [s for s in sorted(glyphs) if canonical_key(glyphs[s]) not in RUNE_NAMES]
    if unnamed:
        for sprite in unnamed:
            print(f"unnamed rune {sprite} ({canonical_key(glyphs[sprite])}):", file=sys.stderr)
            for row in ascii_art(glyphs[sprite]):
                print("   " + row, file=sys.stderr)
        raise SystemExit(f"{len(unnamed)} rune(s) missing from RUNE_NAMES; add them and re-run")

    palette = load_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = []
    for sprite in sorted(glyphs, key=lambda s: (s[0], RUNE_NAMES[canonical_key(glyphs[s])][0])):
        alphabet, tile_color, role = ALPHABETS[sprite[0]]
        name, looks_like = RUNE_NAMES[canonical_key(glyphs[sprite])]
        slug = name.lower().replace(" ", "-")
        render_rune(glyphs[sprite], tile_color, palette).save(OUT_DIR / f"{slug}.png")
        summary.append(
            {
                "name": name,
                "alphabet": alphabet,
                "role": role,
                "sprite": f"nxkictbbvzt{sprite}",
                "looksLike": looks_like,
                "imageUrl": f"/arc3-levels/tr87/runes/{slug}.png",
            }
        )
    print(json.dumps(summary, indent=2))
    print(f"\n{len(summary)} rune PNGs written to {OUT_DIR}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
