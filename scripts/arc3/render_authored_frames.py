"""
Author: Claude Opus 5
Date: 02-September-2026
PURPOSE: Render the opening frame of every hand-authored ARC-AGI-3 task to a PNG, so the
mechanic guide can SHOW a task instead of only describing it. Step 1 of
docs/2026-09-02-arc3-mechanics-page-remediation.md: the page is a reference for a set of
VISUAL puzzles and carries no images, which is why the two complaints players actually
left -- "a big empty screen" and "formulaic" -- cannot be judged from it at all.

WHAT IT RENDERS. Level 1 as the player first meets it: instantiate, RESET, take the frame
the engine hands back. Nothing is played, so this leaks no solution -- it is the same
pixels anyone gets by opening the task, and is therefore safe on a page that is already a
full answer key. Frames are written to server/data/arc3-games/frames/<gameId>.png.

THE PALETTE IS NOT REDEFINED HERE. shared/config/arc3Colors.ts calls itself the single
source of truth and it is; this parses ARC3_COLORS_TUPLES out of that file rather than
adding a fourth copy of sixteen RGB triples to the repo. scripts/arc3/generate_arc3_video.py
already made that copy once and it is why a palette change has to be made in three places
today. If the parse ever fails this script refuses to run rather than falling back to a
guess, because a wrong palette produces a plausible-looking image that is quietly lying.

THE DENSITY NUMBERS. frames.json carries, per game, the count of distinct colours and the
fraction of cells that are not the modal (background) colour. "Formulaic" and "empty" are
judgements a human has to make, but they are judgements about something measurable, and a
task whose opening frame uses three colours on 4% of the board is the one to look at first.
These are descriptive only -- nothing gates on them.

SRP/DRY check: Pass -- rendering only. Derives no mechanic facts (mechanic_digest.py owns
those), computes no verdict (legibility_gate.py owns those), and writes only into
frames/. Run with --selftest to check the palette parse and that no frame came out blank.

Run:  PYTHONPATH=external/ARCEngine python3 scripts/arc3/render_authored_frames.py
      PYTHONPATH=external/ARCEngine python3 scripts/arc3/render_authored_frames.py --selftest
"""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
GAMES_DIR = REPO / "server" / "data" / "arc3-games"
FRAMES_DIR = GAMES_DIR / "frames"
PALETTE_TS = REPO / "shared" / "config" / "arc3Colors.ts"

# 64 engine cells at 4x. Big enough to read a mechanic in a card, small enough that fifty
# of them do not make the guide page heavy.
SCALE = 4


def load_palette() -> dict[int, tuple[int, int, int]]:
    """Parse ARC3_COLORS_TUPLES out of the TS single source of truth.

    Deliberately strict. A missing or renamed export means the palette moved, and the
    right response is to stop -- a default palette here would render fifty images that
    look fine and are wrong.
    """
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
    if len(palette) != 16 or set(palette) != set(range(16)):
        raise SystemExit(f"expected colours 0-15, parsed {sorted(palette)}")
    return palette


def opening_frame(path: Path) -> np.ndarray:
    """Instantiate the game, RESET, and return level 1's grid as a 2-D int array.

    perform_action() RETURNS the FrameData -- polling the game object shows nothing. The
    frame is a list of layers; every authored task has exactly one, and a task that grows
    a second one should be looked at rather than silently half-rendered.
    """
    from arcengine import ARCBaseGame, ActionInput, GameAction  # noqa: WPS433

    spec = importlib.util.spec_from_file_location(f"frame_{path.stem}", path)
    mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        spec.loader.exec_module(mod)
    cls = next(
        (
            obj
            for _, obj in vars(mod).items()
            if isinstance(obj, type) and issubclass(obj, ARCBaseGame) and obj is not ARCBaseGame
        ),
        None,
    )
    if cls is None:
        raise ValueError("no ARCBaseGame subclass")
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        game = cls()
        frame_data = game.perform_action(ActionInput(id=GameAction.RESET))
    layers = frame_data.frame
    if not layers:
        raise ValueError("RESET returned an empty frame")
    if len(layers) != 1:
        raise ValueError(f"expected 1 layer, got {len(layers)}")
    grid = np.asarray(layers[0], dtype=int)
    if grid.ndim != 2:
        raise ValueError(f"expected a 2-D grid, got shape {grid.shape}")
    return grid


def render(grid: np.ndarray, palette: dict[int, tuple[int, int, int]]) -> Image.Image:
    unknown = sorted(set(grid.flatten().tolist()) - set(palette))
    if unknown:
        raise ValueError(f"colour index outside 0-15: {unknown}")
    rgb = np.zeros((*grid.shape, 3), dtype=np.uint8)
    for value, colour in palette.items():
        rgb[grid == value] = colour
    img = Image.fromarray(rgb, mode="RGB")
    return img.resize((grid.shape[1] * SCALE, grid.shape[0] * SCALE), Image.NEAREST)


def describe(grid: np.ndarray) -> dict[str, object]:
    """Descriptive only. The objective half of 'this one is a big empty screen'."""
    flat = grid.flatten().tolist()
    background, _ = Counter(flat).most_common(1)[0]
    return {
        "height": int(grid.shape[0]),
        "width": int(grid.shape[1]),
        "distinctColours": len(set(flat)),
        "backgroundColour": int(background),
        "inkFraction": round(sum(1 for v in flat if v != background) / len(flat), 4),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[3])
    parser.add_argument("--selftest", action="store_true", help="check palette and output, render nothing to disk")
    args = parser.parse_args()

    palette = load_palette()
    if args.selftest:
        # Two spot values against the TS file's own comments. If these drift, the parse is
        # reading the wrong block.
        assert palette[0] == (255, 255, 255), palette[0]
        assert palette[9] == (30, 147, 255), palette[9]
        print(f"palette ok: 16 colours parsed from {PALETTE_TS.relative_to(REPO)}")

    # gNNN since the 03-Sep rename; the old hashed t-form is still matched so this
    # renders a tree that has not been re-imported yet instead of reporting none.
    sources = sorted(p for p in GAMES_DIR.glob("[gt]*.py")
                     if p.is_file() and not p.name.startswith("__"))
    if not sources:
        raise SystemExit(f"no authored task sources under {GAMES_DIR}")

    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    index: dict[str, object] = {}
    failures: list[str] = []
    blank: list[str] = []

    for path in sources:
        game_id = path.stem
        try:
            grid = opening_frame(path)
            img = render(grid, palette)
            stats = describe(grid)
        except Exception as exc:  # one bad game must not stop the other forty-nine
            failures.append(f"{game_id}: {type(exc).__name__}: {exc}")
            continue
        # A single-colour opening frame means we captured nothing worth showing -- either
        # the game draws on its first step rather than on reset, or it is broken.
        if stats["distinctColours"] < 2:
            blank.append(game_id)
        if not args.selftest:
            img.save(FRAMES_DIR / f"{game_id}.png", optimize=True)
        index[game_id] = stats

    if not args.selftest:
        (GAMES_DIR / "frames.json").write_text(
            json.dumps(index, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

    print(f"rendered {len(index)} of {len(sources)} authored tasks at {SCALE}x")
    if index:
        sparse = sorted(index.items(), key=lambda kv: kv[1]["inkFraction"])[:5]
        # Crude on purpose: "not the modal colour" counts a surrounding border as ink, so
        # a low number is a prompt to go and look at the frame, not a verdict on it.
        print("sparsest opening frames, by share of cells that are not the modal colour:")
        for game_id, stats in sparse:
            print(f"   {game_id}  ink={stats['inkFraction']:.1%}  colours={stats['distinctColours']}")
    for line in failures:
        print(f"FAILED  {line}", file=sys.stderr)
    if blank:
        print(f"BLANK   single-colour opening frame: {', '.join(blank)}", file=sys.stderr)

    if args.selftest:
        if failures or blank:
            print("selftest FAILED", file=sys.stderr)
            return 1
        print(f"selftest ok: {len(index)} frames render, none blank")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
