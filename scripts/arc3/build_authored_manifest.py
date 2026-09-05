#!/usr/bin/env python3
"""
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Generate server/data/arc3-games/manifest.json -- the catalog of OUR authored
         ARC-AGI-3 tasks, in the exact entry shape Arc3MirrorCatalog already parses for
         the upstream arc3.sonpham.net manifest ({id, class_name, src_file, category,
         official, default_fps, tile_scale}). Generated FROM THE DIRECTORY rather than
         hand-maintained, so adding a task is dropping a file in and re-running this;
         a manifest edited by hand drifts from the files it describes and the drift only
         shows up as a 404 in the browser.

         The game class is resolved by PARSING each module with `ast` and finding the
         single ARCBaseGame subclass -- not by taking the first class in the file, because
         most of these modules open with a decoy display class and a first-class-wins
         heuristic emits a class_name Pyodide cannot instantiate. Parsing is also
         import-free: no module is executed, so a task needing arcengine or numpy at
         import time cannot break the build.

         NO title, description or tags are emitted, deliberately -- the mirror strips
         those as spoilers and a field never written cannot leak. Filenames are already
         opaque published ids; see scripts/arc3/import_authored_games.py, which is what
         puts them there.

         Dependencies: stdlib only (ast, json, argparse, pathlib, re). Usage:
             python3 scripts/arc3/build_authored_manifest.py
             python3 scripts/arc3/build_authored_manifest.py --check
SRP/DRY check: Pass -- enumerating the published directory only. Renaming and publishing
         live in import_authored_games.py; serving lives in Arc3MirrorCatalog.ts.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

#: The engine base class every playable task derives from.
BASE_CLASS = "ARCBaseGame"

#: Published filenames are `<gameId>.py`, and the id is opaque by construction.
# Published ids became gNNN on 03-Sep (see "a game is called g007 in both repos").
# The old hashed t-form is still accepted so a directory left over from before the
# rename builds rather than raising, which is what a half-migrated tree looks like.
GAME_ID_RE = re.compile(r"^(g[0-9]{3}|t[0-9a-f]{8})$")

#: Category slug for our entries. The mirror treats category as an open string and the
#: gallery sections on it, so ours must be distinguishable from anything upstream. Kept
#: as `arena` because it is the value already published to the play surface.
CATEGORY = "arena"

#: Defaults matching the mirror's own fallbacks, stated explicitly so entries are complete.
DEFAULT_FPS = 10
TILE_SCALE = 4

PUBLISHED_DIR = Path(__file__).resolve().parents[2] / "server" / "data" / "arc3-games"


def _base_name(base: ast.expr) -> str | None:
    """Base-class name for `class X(ARCBaseGame)` and `class X(arcengine.ARCBaseGame)`."""
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        return base.attr
    return None


def game_class_name(path: Path) -> str:
    """Name of the single ARCBaseGame subclass in `path`.

    Raises when the count is not exactly one: either case means the entry would be a
    guess, and a guess here is a manifest row that fails at play time in the browser.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found = [
        node.name
        for node in tree.body
        if isinstance(node, ast.ClassDef)
        and any(_base_name(b) == BASE_CLASS for b in node.bases)
    ]
    if len(found) != 1:
        raise ValueError(f"{path.name}: expected exactly one {BASE_CLASS} subclass, found {found or 'none'}")
    return found[0]


def support_names(directory: Path) -> frozenset[str]:
    """Modules published beside the games because the games import them.

    Read from authored-ids.json rather than inferred from the filename, so a stray .py
    dropped into this directory is still the hard error it has always been.
    """
    allocations = directory / "authored-ids.json"
    if not allocations.is_file():
        return frozenset()
    return frozenset(json.loads(allocations.read_text(encoding="utf-8")).get("support", []))


def build(directory: Path) -> list[dict[str, object]]:
    """One manifest entry per published module, sorted by id for a stable diff."""
    entries: list[dict[str, object]] = []
    for path in sorted(directory.glob("*.py")):
        if path.name.startswith("__"):
            continue
        if path.stem in support_names(directory):
            # A shared module the games import, published beside them by
            # import_authored_games.py. It is not a game and gets no manifest entry.
            continue
        if not GAME_ID_RE.match(path.stem):
            raise ValueError(f"{path.name}: filename is not a published game id; import it with import_authored_games.py")
        entries.append(
            {
                "id": path.stem,
                "class_name": game_class_name(path),
                "src_file": path.name,
                "category": CATEGORY,
                "official": False,
                "default_fps": DEFAULT_FPS,
                "tile_scale": TILE_SCALE,
            }
        )
    if not entries:
        raise ValueError(f"no published task modules found in {directory}")
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the authored-catalog manifest from the published directory.")
    parser.add_argument("--dir", type=Path, default=PUBLISHED_DIR, help=f"published directory (default: {PUBLISHED_DIR})")
    parser.add_argument("--out", type=Path, default=None, help="output path (default: <dir>/manifest.json)")
    parser.add_argument("--check", action="store_true", help="verify the committed manifest is current; write nothing, exit 1 if stale")
    args = parser.parse_args()

    directory: Path = args.dir
    if not directory.is_dir():
        print(f"error: no such directory: {directory}", file=sys.stderr)
        return 1
    out: Path = args.out or directory / "manifest.json"

    # Trailing newline so the file is well-formed text and `git diff` stays clean.
    rendered = json.dumps(build(directory), indent=2) + "\n"

    if args.check:
        current = out.read_text(encoding="utf-8") if out.exists() else ""
        if current != rendered:
            print(f"{out} is stale; rerun without --check", file=sys.stderr)
            return 1
        print(f"{out} is current")
        return 0

    out.write_text(rendered, encoding="utf-8")
    print(f"wrote {out} ({len(json.loads(rendered))} games)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
