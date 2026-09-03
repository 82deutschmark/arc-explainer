#!/usr/bin/env python3
"""
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Publish OUR hand-authored ARC-AGI-3 candidate tasks INTO this repo, under opaque
         names, as the first-party catalog `Arc3MirrorCatalog`'s `authored` source serves
         from `server/data/arc3-games/`. One-shot for the initial 50 and repeatable for
         every batch after it, which is the publish step that replaces the old
         fetch-from-a-private-repo path (see docs/plans/2026-09-01-arc3-catalog-flip.md).

         WHAT IS REWRITTEN, AND WHAT IS NOT. The authoring repo names each task
         `gNNN_<mechanic>.py` -- `g007_tumble_block.py` -- with `class <Mechanic>` and
         usually a `<Mechanic>Display` beside it. Exactly one half of that is a spoiler.
         `g007` is an ordinal and gives nothing away, so it is published VERBATIM and a
         game is called the same thing in this repo, in the arena repo, and in
         conversation. The mechanic slug is what must not cross: class names are derived
         (`G007`, `G007A`), and the docstrings and comments that name the mechanic are cut
         by strip_authoring_text.py, which is now the only thing standing between the
         authoring prose and a public endpoint.

         THIS REPLACED A HASH, ON PURPOSE. Published ids used to be
         `"t" + sha256("arena:" + <authoring id>)[:8]`, so g007 was published as
         t00810611. That hid the ordinal, which never needed hiding, and cost the ability
         to say "g007" and be understood on both sides. It also meant every cross-repo
         conversation went through a lookup table. Renamed in one pass on 02-Sep-2026 by
         scripts/arc3/rename_to_gnnn.py, which also moved the frames, the triage rows and
         every keyed JSON; the database rows are migrate_ids_db.sql.

         RE-RUNNING IS THE POINT, NOT AN EDGE CASE. A published id is a pure function of
         the authoring id, so importing an updated batch rewrites each game's bytes UNDER
         THE SAME id. That is what makes this the resync path as well as the first-import
         path: ids must not churn, because arc3Triage.json's rows, the human-play
         telemetry and the feedback rows are all keyed by them. Re-running with an
         unchanged source is a no-op that rewrites identical bytes.

         ORPHANS ARE REPORTED, NEVER DELETED. A game withdrawn upstream leaves a
         published file this import no longer produces. Deleting it is NOT this script's
         call -- the id still keys triage and telemetry rows, so retiring one is a
         decision with consequences outside this repository. Both modes print orphans and
         neither removes them; the exit code is unaffected.

         Dependencies: stdlib only (ast, argparse, hashlib, json, pathlib, re).
         Usage (source dir is required; no path to a private repo is baked in):
             python3 scripts/arc3/import_authored_games.py \
                 --source /path/to/autoresearch-arena/arc3games
             python3 scripts/arc3/build_authored_manifest.py
SRP/DRY check: Pass -- importing/renaming only. Enumerating the published directory into
         a manifest is build_authored_manifest.py's job and is not duplicated here; the
         class-name lookup below reads the SOURCE manifest rather than re-deriving it.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from strip_authoring_text import strip_authoring_text

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


def published_classes(game_id: str, classes: list[str], game_class: str) -> dict[str, str]:
    """Every class a module declares, mapped to the name it is published under.

    The class the manifest points at -- the one that leaves this repo, through
    manifest.json, to the Pyodide hook that instantiates it -- takes `G007`. The rest take
    `G007A`, `G007B` in declaration order, and are file-local: a published module imports
    only numpy and arcengine, so nothing outside it can refer to them.

    Class names stay derived when the id no longer is, because they are not the same kind
    of name. `g007` is an ordinal. `TumbleBlock` and `TumbleBlockDisplay` say the game is
    Bloxorz, in a file served to the player's own browser.
    """
    suffix = game_id[1:]
    renames = {game_class: f"G{suffix}"}
    for index, name in enumerate([c for c in classes if c != game_class]):
        if index >= 26:
            raise ValueError(f"{game_id}: more than 26 helper classes; the suffix rule no longer fits")
        renames[name] = f"G{suffix}{chr(ord('A') + index)}"
    return renames


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
    skipped: list[str] = []
    for path in sorted(source.glob("*.py")):
        if path.name.startswith("__"):
            continue
        match = AUTHORED_ID_RE.match(path.name)
        if not match:
            # SKIPPED, NOT FATAL -- but reported by name, every time.
            #
            # This raised until 02-Sep, on the assumption that the source directory holds
            # tasks and nothing else. It does not any more: the authoring repo keeps its
            # verifiers and tooling (verify_gNNN.py, funnel.py, legibility_gate.py, ...)
            # beside the tasks, so a hard failure meant no resync could run at all and we
            # sat on a 50-game snapshot while the pipeline reached 200.
            #
            # Skipping quietly would be the worse bug -- a real task dropped by a rename is
            # invisible in a directory of hundreds -- so every skip is printed. Read the
            # list. If something in it looks like a task, it is one, and the pattern is
            # what needs fixing, not the file.
            skipped.append(path.name)
            continue
        entries.append(
            {
                "authored_id": match.group(1),
                "class_name": by_file.get(path.name) or game_class_name(path),
                "path": str(path),
            }
        )

    if skipped:
        print(f"skipped {len(skipped)} non-task file(s) in {source}:", file=sys.stderr)
        for name in skipped:
            print(f"    {name}", file=sys.stderr)
    if not entries:
        raise ValueError(f"no task modules found in {source}")
    return entries


def rewrite(text: str, game_id: str, renames: dict[str, str]) -> str:
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
    for name, published in renames.items():
        text = re.sub(rf"\b{re.escape(name)}\b", published, text)

    # PROSE COMES OUT LAST, AND IT IS NOT OPTIONAL.
    #
    # Renaming identifiers was never the whole leak. The authored modules carry a docstring
    # naming the mechanic, the AI failure mode the task targets and often what each level
    # teaches -- and `#` comments doing the same job further down. That source is served
    # publicly at /api/arc3-mirror/games/:gameId/source and fetched into the player's own
    # browser by the Pyodide worker, so publishing it hands over the exact thing the human
    # baseline exists to measure someone inferring.
    #
    # This was not caught earlier because the authored modules did not carry those
    # docstrings when the first 50 were imported; they do now. A resync without this step
    # would have published the answer to all 200 tasks in plain English. See
    # strip_authoring_text.py, vendored from the authoring repo's make_submission.py.
    return f"# ARC-AGI-3 candidate task {game_id}.\n\n" + strip_authoring_text(text)


def build(source: Path) -> list[dict[str, str]]:
    """Everything one import would publish, computed before anything is written."""
    published: list[dict[str, str]] = []
    for entry in source_entries(source):
        game_id = entry["authored_id"]
        module = Path(entry["path"])
        classes = declared_classes(module)
        if entry["class_name"] not in classes:
            raise ValueError(f"{module.name}: manifest names {entry['class_name']}, which the module does not declare")
        renames = published_classes(game_id, classes, entry["class_name"])
        published_class = renames[entry["class_name"]]
        body = rewrite(module.read_text(encoding="utf-8"), game_id, renames)

        # Only class names are checked now. The id is SUPPOSED to survive into the
        # published body -- it is the name of the game in both repos -- so the check that
        # used to assert its absence would fail every import. Case is not folded: a
        # module's constants are shouted versions of words its classes also use, and
        # folding would report a constant as an un-renamed class.
        leaks = [name for name in classes if re.search(rf"\b{re.escape(name)}\b", body)]
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


def orphans(out_dir: Path, published: list[dict[str, str]]) -> list[str]:
    """Published modules in `out_dir` that this import does not produce, sorted.

    A game withdrawn upstream stops appearing in the source manifest but its published
    file stays on disk, where build_authored_manifest.py keeps enumerating it into the
    catalog and the play surface keeps serving it. Detected here because this is the only
    step that knows the full set the source SHOULD produce.

    Reported and not deleted, deliberately: the id keys triage rows, feedback rows and
    human-play telemetry, none of which live in this repository, so retiring one is a
    decision that has to be made with those in view rather than as a side effect of a
    sync. The manifest builder will also refuse a filename that is not a published id, so
    a stray file cannot masquerade as a game.
    """
    if not out_dir.is_dir():
        return []
    expected = {item["gameId"] for item in published}
    return sorted(
        path.stem for path in out_dir.glob("*.py")
        if not path.name.startswith("__") and path.stem not in expected
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish authored ARC-AGI-3 tasks into this repo.")
    parser.add_argument("--source", type=Path, required=True, help="directory of authored task modules")
    parser.add_argument("--out", type=Path, default=PUBLISHED_DIR, help=f"published directory (default: {PUBLISHED_DIR})")
    parser.add_argument("--check", action="store_true", help="verify the published files match what an import would produce; write nothing, exit 1 on a difference")
    args = parser.parse_args()

    if not args.source.is_dir():
        print(f"error: no such directory: {args.source}", file=sys.stderr)
        return 1

    published = build(args.source)

    stray = orphans(args.out, published)
    if stray:
        print(
            f"note: {len(stray)} published file(s) are no longer produced by this source: "
            f"{stray}. Nothing was deleted -- these ids key triage and telemetry rows; "
            "retiring one is a deliberate decision, not a side effect of a sync.",
            file=sys.stderr,
        )

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

    print(f"published {len(published)} tasks to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
