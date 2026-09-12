"""
Author: Claude Sonnet 5
Date: 12-September-2026
PURPOSE: Render every level's opening frame for the 25-game ARC-AGI-3 public demo set, so
each game's spoiler page (client/src/pages/Arc3GameSpoiler.tsx) can show real screenshots
instead of prose alone -- the same treatment the 5 original preview/eval games already have.

WHAT IT RENDERS. For each game, instantiate the ARCBaseGame subclass, then for every level
index n call set_level(n) and render via camera.render(current_level.get_sprites()). This is
verified equivalent to the engine's own perform_action(RESET) path for level 0 (see the
sibling script's opening_frame()); it generalizes cleanly to every other level because
set_level(n) runs the same on_set_level() hook a real RESET-into-level-n would, and nothing
has moved yet. perform_action(RESET) itself cannot be reused past level 0: it decides
full_reset vs level_reset from _action_count, which set_level() always zeroes, so chaining
set_level(n) -> perform_action(RESET) would silently snap back to level 0.

CUSTOM-ENGINE GAMES. A few games (BP35 confirmed) build their own rendering path instead of
using arcengine.Camera directly, and will fail here -- caught per level, logged, skipped.
Getting 24/25 real is better than blocking on the one that needs bespoke handling later.

THE PALETTE IS NOT REDEFINED HERE. Same as render_authored_frames.py: parsed from
shared/config/arc3Colors.ts, the single source of truth, rather than copied a third time.

OUTPUT. client/public/arc3-levels/<gameId>/lvl<N>.png (1-indexed to match levelScreenshots'
existing `level` field convention), plus a JSON manifest at
client/public/arc3-levels/manifest.json of {gameId: [level numbers rendered]} for the next
step (wiring these into each shared/arc3Games/<id>.ts as levelScreenshots).

Run:  python3 scripts/arc3/render_public_demo_levels.py
      python3 scripts/arc3/render_public_demo_levels.py --selftest
"""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
ENV_FILES = REPO / "external" / "ARCEngine" / "environment_files"
PUBLIC_OUT = REPO / "client" / "public" / "arc3-levels"
PALETTE_TS = REPO / "shared" / "config" / "arc3Colors.ts"

SCALE = 4

# gameId -> live hash subdirectory. Three games (ft09, ls20, vc33) have two hash dirs on
# disk; the newer one (2026-08-31) is the live version, resolved the same way the
# 2026-09-12 adversarial fact-check pass resolved it (see CHANGELOG.md).
GAME_HASHES = {
    "ar25": "0c556536", "bp35": "0a0ad940", "cd82": "fb555c5d", "cn04": "2fe56bfb",
    "dc22": "fdcac232", "ft09": "0d8bbf25", "g50t": "5849a774", "ka59": "38d34dbb",
    "lf52": "271a04aa", "lp85": "305b61c3", "ls20": "9607627b", "m0r0": "492f87ba",
    "r11l": "495a7899", "re86": "8af5384d", "s5i5": "18d95033", "sb26": "7fbdac44",
    "sc25": "635fd71a", "sk48": "d8078629", "sp80": "589a99af", "su15": "1944f8ab",
    "tn36": "ef4dde99", "tr87": "cd924810", "tu93": "0768757b", "vc33": "5430563c",
    "wa30": "ee6fef47",
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
    if len(palette) != 16 or set(palette) != set(range(16)):
        raise SystemExit(f"expected colours 0-15, parsed {sorted(palette)}")
    return palette


def load_game_class(path: Path):
    from arcengine import ARCBaseGame  # noqa: WPS433

    spec = importlib.util.spec_from_file_location(f"render_{path.stem}", path)
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
        raise ValueError("no ARCBaseGame subclass in module")
    return cls


def render_frame(grid: np.ndarray, palette: dict[int, tuple[int, int, int]]) -> Image.Image:
    unknown = sorted(set(grid.flatten().tolist()) - set(palette))
    if unknown:
        raise ValueError(f"colour index outside 0-15: {unknown}")
    rgb = np.zeros((*grid.shape, 3), dtype=np.uint8)
    for value, colour in palette.items():
        rgb[grid == value] = colour
    img = Image.fromarray(rgb, mode="RGB")
    return img.resize((grid.shape[1] * SCALE, grid.shape[0] * SCALE), Image.NEAREST)


def render_game_levels(
    game_id: str, path: Path, palette: dict[int, tuple[int, int, int]], out_dir: Path
) -> tuple[list[int], list[str]]:
    """Render every level's opening frame for one game. Returns (levels_rendered, errors)."""
    rendered: list[int] = []
    errors: list[str] = []
    try:
        cls = load_game_class(path)
    except Exception as exc:  # noqa: BLE001
        return [], [f"load: {type(exc).__name__}: {exc}"]

    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            game = cls()
        n_levels = len(game._levels)  # noqa: SLF001 -- no public accessor for level count
    except Exception as exc:  # noqa: BLE001
        return [], [f"instantiate: {type(exc).__name__}: {exc}"]

    out_dir.mkdir(parents=True, exist_ok=True)
    for i in range(n_levels):
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                fresh = cls()
                fresh.set_level(i)
                grid = fresh.camera.render(fresh.current_level.get_sprites())
            grid = np.asarray(grid, dtype=int)
            if grid.ndim != 2:
                raise ValueError(f"expected a 2-D grid, got shape {grid.shape}")
            img = render_frame(grid, palette)
            img.save(out_dir / f"lvl{i + 1}.png", optimize=True)
            rendered.append(i + 1)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"level {i + 1}: {type(exc).__name__}: {exc}")
    return rendered, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[3])
    parser.add_argument("--selftest", action="store_true", help="check palette and one game, write nothing")
    parser.add_argument("--only", help="comma-separated gameIds to render (default: all 25)")
    args = parser.parse_args()

    palette = load_palette()
    targets = args.only.split(",") if args.only else sorted(GAME_HASHES)

    if args.selftest:
        assert palette[6] == (229, 58, 163), palette[6]
        gid = targets[0]
        path = ENV_FILES / gid / GAME_HASHES[gid] / f"{gid}.py"
        rendered, errors = render_game_levels(gid, path, palette, REPO / "/tmp/arc3-levels-selftest" / gid)
        print(f"selftest {gid}: rendered {rendered}, errors {errors}")
        return 1 if errors else 0

    manifest: dict[str, list[int]] = {}
    all_errors: dict[str, list[str]] = {}
    for gid in targets:
        path = ENV_FILES / gid / GAME_HASHES[gid] / f"{gid}.py"
        if not path.exists():
            print(f"SKIP  {gid}: source not found at {path}", file=sys.stderr)
            continue
        rendered, errors = render_game_levels(gid, path, palette, PUBLIC_OUT / gid)
        manifest[gid] = rendered
        if errors:
            all_errors[gid] = errors
        print(f"{gid}: {len(rendered)} levels rendered" + (f", {len(errors)} errors" if errors else ""))

    PUBLIC_OUT.mkdir(parents=True, exist_ok=True)
    (PUBLIC_OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    total = sum(len(v) for v in manifest.values())
    print(f"\nTotal: {total} level images across {len(manifest)} games")
    if all_errors:
        print("\nGames with errors:", file=sys.stderr)
        for gid, errs in all_errors.items():
            print(f"  {gid}:", file=sys.stderr)
            for e in errs[:3]:
                print(f"    {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
