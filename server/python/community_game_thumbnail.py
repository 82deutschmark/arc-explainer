"""
Author: Claude Opus 5
Date: 2026-08-28
PURPOSE: Render a single ARC-AGI-3 community game's opening frame to a PNG thumbnail.
         Loads the game the same way community_game_runner.py does, issues one RESET,
         takes the first animation frame of the result, and paints it with the canonical
         ARC-3 16-colour palette at one pixel per cell (nearest-neighbour upscaled), so
         the gallery shows what a task actually looks like rather than decorative art.
         Writes PNG bytes to the path given as the second argument and prints a JSON
         status line. Read-only with respect to the game: it never advances state past
         the reset frame and never touches the database.

         Usage: python3 community_game_thumbnail.py <game_id|--file PATH> <out.png> [size]
SRP/DRY check: Pass — rendering only; game loading reuses the loaders in
         community_game_runner.py rather than reimplementing registry/file resolution.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Canonical ARC-3 palette, matching client/src/utils/arc3Colors.ts exactly.
ARC3_PALETTE = [
    (0xFF, 0xFF, 0xFF), (0xCC, 0xCC, 0xCC), (0x99, 0x99, 0x99), (0x66, 0x66, 0x66),
    (0x33, 0x33, 0x33), (0x00, 0x00, 0x00), (0xE5, 0x3A, 0xA3), (0xFF, 0x7B, 0xCC),
    (0xF9, 0x3C, 0x31), (0x1E, 0x93, 0xFF), (0x88, 0xD8, 0xF1), (0xFF, 0xDC, 0x00),
    (0xFF, 0x85, 0x1B), (0x92, 0x12, 0x31), (0x4F, 0xCC, 0x30), (0xA3, 0x56, 0xD0),
]


def fail(message: str, code: str = "THUMBNAIL_ERROR") -> None:
    print(json.dumps({"ok": False, "error": message, "code": code}))
    sys.exit(1)


def first_grid(frame_data):
    """FrameData.frame is list[list[list[int]]] — animation frames of 2D grids."""
    frame = frame_data.frame
    if hasattr(frame, "tolist"):
        frame = frame.tolist()
    if not frame:
        return None
    grid = frame[0]
    if hasattr(grid, "tolist"):
        grid = grid.tolist()
    # A 1-deep frame (already a 2D grid) is tolerated.
    if grid and not isinstance(grid[0], (list, tuple)):
        grid = frame
    return grid


def main() -> None:
    if len(sys.argv) < 3:
        fail("usage: community_game_thumbnail.py <game_id|--file PATH> <out.png> [size]",
             "BAD_ARGS")

    try:
        from PIL import Image
    except ImportError:
        fail("Pillow is required to render thumbnails", "PILLOW_MISSING")

    from community_game_runner import load_game_from_registry, load_game_from_file
    from arcengine import ActionInput, GameAction

    if sys.argv[1] == "--file":
        if len(sys.argv) < 4:
            fail("--file needs a path and an output path", "BAD_ARGS")
        source, out_path = sys.argv[2], sys.argv[3]
        size = int(sys.argv[4]) if len(sys.argv) > 4 else 256
        game = load_game_from_file(source)
    else:
        out_path = sys.argv[2]
        size = int(sys.argv[3]) if len(sys.argv) > 3 else 256
        game = load_game_from_registry(sys.argv[1])

    if game is None:
        fail("game could not be loaded", "GAME_NOT_FOUND")

    # The two loaders differ: load_game_from_registry returns a constructed game,
    # load_game_from_file returns the class. Normalise to an instance.
    if isinstance(game, type):
        game = game()

    grid = first_grid(game.perform_action(ActionInput(id=GameAction.RESET)))
    if not grid:
        fail("game returned no frame on RESET", "NO_FRAME")

    height, width = len(grid), len(grid[0])
    image = Image.new("RGB", (width, height))
    image.putdata([
        ARC3_PALETTE[cell] if isinstance(cell, int) and 0 <= cell < len(ARC3_PALETTE)
        else ARC3_PALETTE[5]
        for row in grid for cell in row
    ])
    # Nearest neighbour: these are pixel grids, and smoothing would misrepresent them.
    image = image.resize((size, size), Image.NEAREST)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    image.save(out_path, "PNG", optimize=True)
    print(json.dumps({"ok": True, "path": out_path, "grid": [width, height]}))


if __name__ == "__main__":
    main()
