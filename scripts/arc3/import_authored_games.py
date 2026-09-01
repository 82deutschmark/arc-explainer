#!/usr/bin/env python3
"""
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Publish OUR hand-authored ARC-AGI-3 candidate tasks INTO this repo, under opaque
         names, as the first-party catalog `Arc3MirrorCatalog`'s `authored` source serves
         from `server/data/arc3-games/`. One-shot for the initial 50 and repeatable for
         every batch after it, which is the publish step that replaces the old
         fetch-from-a-private-repo path (see docs/plans/2026-09-01-arc3-catalog-flip.md).

         WHY THE NAMES ARE REWRITTEN. The authoring repo names each task for what it does
         (`gNNN_<mechanic>.py`, `class <Mechanic>`, usually with a `<Mechanic>Display`
         beside it), and this repo is public and permanent.
         The play surface prints the game id to the player, so a descriptive id or class
         name hands over the mechanic before the first move -- which is the exact data
         point the human-baseline experiment exists to collect. Every published name is
         therefore derived, and the descriptive one never enters this repo, not as a
         filename, not in the manifest, not in a class name, and not in git history: files
         are written straight to their opaque name and the source directory is never
         copied verbatim.

         THE DERIVATION IS FROZEN, NOT FREE. Published id is
         `"t" + sha256("arena:" + <authoring id>)[:8]` and published class is
         `"G" + sha256("arena:" + <authoring class>)[:8]`. `arena` is the source key the
         removed HTTP source used, and the 50 ids it produces are already baked into
         server/services/arc3Mirror/arc3Triage.json. Changing the prefix, the key or the
         hash orphans all 50 triage rows -- they would type-check, sort, and address
         nothing. --check exists to prove a re-run reproduces the committed ids.

         THE MAP OUT IS MANDATORY AND GOES OUTSIDE THIS REPO. --map-out is required and
         refuses to write inside the repository: a committed slug->id table would undo
         everything above in one file.

         Dependencies: stdlib only (ast, argparse, hashlib, json, pathlib, re).
         Usage (source dir is required; no path to a private repo is baked in):
             python3 scripts/arc3/import_authored_games.py \
                 --source /path/to/authored/dist --map-out /tmp/arc3-authored-map.json
             python3 scripts/arc3/build_authored_manifest.py
SRP/DRY check: Pass -- importing/renaming only. Enumerating the published directory into
         a manifest is build_authored_manifest.py's job and is not duplicated here; the
         class-name lookup below reads the SOURCE manifest rather than re-deriving it.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
from pathlib import Path

#: Source key mixed into every published name. Frozen -- see the module docstring.
SOURCE_KEY = "arena"

#: The engine base class every playable task derives from. Used only when the source
#: directory ships no manifest, so a batch can be imported straight from .py files.
BASE_CLASS = "ARCBaseGame"

#: Authoring filenames are `<id>_<mechanic>.py`; the id is the leading token.
AUTHORED_ID_RE = re.compile(r"^(g\d+)_")

#: Where published tasks live in this repo. Under server/ deliberately: Railway mounts a
#: volume at /app/data, so a repo-tracked file under the root data/ directory is shadowed
#: at runtime and would silently vanish in production.
PUBLISHED_DIR = Path(__file__).resolve().parents[2] / "server" / "data" / "arc3-games"

REPO_ROOT = Path(__file__).resolve().parents[2]


def opaque(prefix: str, raw: str) -> str:
    """The published name for `raw`. Mirrors `opaque()` in Arc3MirrorCatalog.ts."""
    return prefix + hashlib.sha256(f"{SOURCE_KEY}:{raw}".encode("utf-8")).hexdigest()[:8]


def _base_name(base: ast.expr) -> str | None:
    """Base-class name for `class X(ARCBaseGame)` and `class X(arcengine.ARCBaseGame)`."""
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        return base.attr
    return None


def declared_classes(path: Path) -> list[str]:
    """Every class the module defines at top level, in source order."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return [node.name for node in tree.body if isinstance(node, ast.ClassDef)]


def game_class_name(path: Path) -> str:
    """Name of the single ARCBaseGame subclass in `path`.

    Parsed rather than guessed: most authored modules open with a decoy display class, so
    first-class-wins emits a name Pyodide cannot instantiate. Raises when the count is not
    exactly one, because either way the answer would be a guess.
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


def source_entries(source: Path) -> list[dict[str, str]]:
    """One `{authored_id, class_name, path}` per task in `source`.

    Class names come from the source manifest when there is one, so this import follows
    whatever the authoring repo published rather than re-deriving it, and falls back to
    parsing when a batch arrives as bare .py files.
    """
    manifest = source / "manifest.json"
    by_file: dict[str, str] = {}
    if manifest.is_file():
        for entry in json.loads(manifest.read_text(encoding="utf-8")):
            by_file[entry["src_file"]] = entry["class_name"]

    entries: list[dict[str, str]] = []
    for path in sorted(source.glob("*.py")):
        if path.name.startswith("__"):
            continue
        match = AUTHORED_ID_RE.match(path.name)
        if not match:
            raise ValueError(f"{path.name}: filename does not start with an authored task id")
        entries.append(
            {
                "authored_id": match.group(1),
                "class_name": by_file.get(path.name) or game_class_name(path),
                "path": str(path),
            }
        )
    if not entries:
        raise ValueError(f"no task modules found in {source}")
    return entries


def rewrite(text: str, authored_id: str, game_id: str, classes: list[str]) -> str:
    """The authored module with every self-naming identifier replaced by its published one.

    EVERY class the module declares is renamed, not just the playable one. Most of these
    modules open with a display class named after the same mechanic as the game
    (`<Mechanic>Display` beside `class <Mechanic>`), so renaming only the game would leave
    the answer sitting three lines above it, in a file this repository keeps forever.

    Whole-word replacement rather than editing the `class` lines alone: a module refers to
    its own classes further down (a display is constructed in `interfaces=[...]`, the
    engine is handed `game_id=`), and a half-renamed module does not import. Safe to do
    blind here because no module in the set looks a class up by name -- no `getattr`, no
    `globals()`, no `__name__` comparison anywhere in it.

    Constants and helper functions are deliberately left alone. The identifiers renamed
    here are the ones a player is shown; the rest is the already-accepted limit that the
    Python is readable in devtools, and mangling it would break the games for no gain.
    """
    for name in classes:
        text = re.sub(rf"\b{re.escape(name)}\b", opaque("G", name), text)
    text = re.sub(rf"\b{re.escape(authored_id)}\b", game_id, text, flags=re.IGNORECASE)
    return text


def build(source: Path) -> list[dict[str, str]]:
    """Everything one import would publish, computed before anything is written."""
    published: list[dict[str, str]] = []
    for entry in source_entries(source):
        game_id = opaque("t", entry["authored_id"])
        published_class = opaque("G", entry["class_name"])
        module = Path(entry["path"])
        classes = declared_classes(module)
        if entry["class_name"] not in classes:
            raise ValueError(f"{module.name}: manifest names {entry['class_name']}, which the module does not declare")
        body = rewrite(module.read_text(encoding="utf-8"), entry["authored_id"], game_id, classes)

        # The id check is case-insensitive because an id may also be written in caps. The
        # class check is not: a module's constants are shouted versions of words its
        # classes also use, so folding case here would report a constant as an un-renamed
        # class and fail an import that is in fact correct.
        leaks: list[str] = []
        if re.search(rf"\b{re.escape(entry['authored_id'])}\b", body, re.IGNORECASE):
            leaks.append(entry["authored_id"])
        leaks += [name for name in classes if re.search(rf"\b{re.escape(name)}\b", body)]
        if leaks:
            raise ValueError(f"{Path(entry['path']).name}: rewrite left {leaks} in the published body")
        if f"class {published_class}" not in body:
            raise ValueError(f"{Path(entry['path']).name}: published body declares no class {published_class}")

        published.append(
            {
                "gameId": game_id,
                "className": published_class,
                "authoredId": entry["authored_id"],
                "authoredFile": Path(entry["path"]).name,
                "authoredClass": entry["class_name"],
                "body": body,
            }
        )

    for field, label in (("gameId", "published ids"), ("className", "published class names")):
        values = [p[field] for p in published]
        clashes = sorted({v for v in values if values.count(v) > 1})
        if clashes:
            raise ValueError(f"{label} collide: {clashes}")
    return published


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish authored ARC-AGI-3 tasks into this repo under opaque names.")
    parser.add_argument("--source", type=Path, required=True, help="directory of authored task modules")
    parser.add_argument("--out", type=Path, default=PUBLISHED_DIR, help=f"published directory (default: {PUBLISHED_DIR})")
    parser.add_argument("--map-out", type=Path, required=True, help="where to write the authored-name -> published-id map; MUST be outside this repository")
    parser.add_argument("--check", action="store_true", help="verify the published files match what an import would produce; write nothing, exit 1 on a difference")
    args = parser.parse_args()

    if not args.source.is_dir():
        print(f"error: no such directory: {args.source}", file=sys.stderr)
        return 1

    map_out = args.map_out.resolve()
    if not args.check and map_out.is_relative_to(REPO_ROOT):
        print(f"error: --map-out must be outside {REPO_ROOT}; a committed slug map defeats the rename", file=sys.stderr)
        return 1

    published = build(args.source)

    if args.check:
        stale = []
        for item in published:
            target = args.out / f"{item['gameId']}.py"
            current = target.read_text(encoding="utf-8") if target.exists() else ""
            if current != item["body"]:
                stale.append(target.name)
        if stale:
            print(f"{len(stale)} published file(s) differ from the source: {stale[:5]}", file=sys.stderr)
            return 1
        print(f"{args.out} is current ({len(published)} tasks)")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    for item in published:
        (args.out / f"{item['gameId']}.py").write_text(item["body"], encoding="utf-8")

    map_out.parent.mkdir(parents=True, exist_ok=True)
    map_out.write_text(
        json.dumps(
            [
                {k: item[k] for k in ("gameId", "className", "authoredId", "authoredFile", "authoredClass")}
                for item in published
            ],
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"published {len(published)} tasks to {args.out}")
    print(f"wrote the authored-name map to {map_out} (keep it out of this repo)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
