#!/usr/bin/env python3
"""
Author: Claude Opus 5 (Bubba)
Date: 05-September-2026
PURPOSE: Turn a contributor's raw upload in server/data/arc3-uploads/<who>/ into a source
         directory that scripts/arc3/import_authored_games.py can publish, by assigning
         each qualifying file a stable id out of the range reserved for that contributor
         in authored-ids.json. Writes nothing into server/data/arc3-games/ itself: this is
         the step BEFORE the importer, and the importer remains the only thing that
         strips prose, renames classes and stamps the published header.

         WHY A STAGING STEP AT ALL. import_authored_games.py identifies a task by
         `AUTHORED_ID_RE = ^(g\\d+)_`, because an authored id is an ordinal this project
         allocated. A contributor's files carry their own naming (`q001_v2_q001.py`,
         `gh_00000001_gh01.py`), so the importer skips every one of them -- reports them
         and moves on. Renaming here is what lets the existing publish path do the work,
         rather than growing a second path that would have to re-implement the strip, the
         class rename and the leak check, and would drift from them.

         THE SELECTION RULE IS THE CONTRIBUTOR'S OWN. Son Pham, 05-Sep-2026: "On the front
         page, we will only accept games with at least one glow-up." His filenames carry
         the version (`q001_v2_q001.py`), so "at least one glow-up" is `v2` or later, and
         that is exactly what GLOWUP_RE matches. On the 94-file upload it selects the 44
         files of PR #461 and none of the 50 v1 seeds beside them -- which is also the
         scope the PR's own plan doc approved ("Exclude every remaining v1 seed").

         IDS ARE ALLOCATED ONCE AND WRITTEN DOWN. The ledger beside the upload maps
         published id -> contributor id, and an entry in it is never reassigned. This
         matters because a published id keys arc3Triage.json, the human-play telemetry and
         the feedback rows: re-deriving ids from a directory listing would silently
         renumber every game the day a file is added or withdrawn, and hand one game's
         play history to another. New files take the lowest free id in the range; a file
         that disappears leaves its id burnt, which is the correct trade.

         WHAT IS DELIBERATELY NOT DONE HERE. No prose is stripped, no class is renamed and
         no file is validated -- all three belong to import_authored_games.py and running
         them twice would mean two definitions of each. The staged directory is a
         throwaway; the ledger is the only durable output.

         Dependencies: stdlib only (argparse, json, pathlib, re, shutil, sys).
         Usage:
             python3 scripts/arc3/stage_contributed_glowups.py --out /tmp/stage
             python3 scripts/arc3/stage_contributed_glowups.py --out /tmp/stage --check
SRP/DRY check: Pass -- id allocation and file naming only. Publishing stays in
         import_authored_games.py, the manifest in build_authored_manifest.py, and the
         reserved ranges stay declared in authored-ids.json, which this reads rather than
         restating.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

#: Contributor uploads. NOT under the repository-root `data/` directory: Railway mounts a
#: persistent volume at /app/data, so a repo-tracked file there is shadowed at runtime --
#: it reads fine locally and is simply absent in production. The 94 files this script
#: reads sat there, unread by any code path, from PR #461 until 05-Sep-2026.
UPLOADS = REPO / "server" / "data" / "arc3-uploads"

#: Written by import_authored_games.py; `reserved` is where a contributor's id range is
#: declared. Read, never written, here.
ALLOCATIONS = REPO / "server" / "data" / "arc3-games" / "authored-ids.json"

#: A contributed file qualifies when its own name says it has been revised at least once.
#: `<id>_v<N>_<slug>.py` with N >= 2. See the selection note in the module docstring.
GLOWUP_RE = re.compile(r"^([a-z0-9]+)_v([2-9]\d*)_")


def ledger_path(who: str) -> Path:
    return UPLOADS / f"{who}-ids.json"


def load_ledger(who: str) -> dict:
    path = ledger_path(who)
    if not path.is_file():
        return {"_README": "", "contributor": who, "published": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def reserved_range(who: str) -> tuple[int, int]:
    """The id range authored-ids.json hands to `who`. Absent is fatal, not a default.

    Inventing a range here would let a contributor's games land on ids the authoring
    pipeline is using, which overwrites a game and reassigns its telemetry -- the exact
    thing check_publish_integrity.py's id check exists to prevent.
    """
    doc = json.loads(ALLOCATIONS.read_text(encoding="utf-8"))
    span = doc.get("reserved", {}).get(who)
    if not span:
        raise SystemExit(
            f"error: no id range reserved for {who!r} in {ALLOCATIONS.relative_to(REPO)}. "
            "Ranges are declared in RESERVED_RANGES in import_authored_games.py and "
            "written from there; add one before staging this contributor."
        )
    return int(span["from"]), int(span["to"])


def qualifying(src: Path) -> list[Path]:
    """The contributor's files that carry at least one revision, sorted by name."""
    return sorted(p for p in src.glob("*.py")
                  if not p.name.startswith("__") and GLOWUP_RE.match(p.name))


def allocate(who: str, files: list[Path]) -> dict[str, str]:
    """published id -> upload filename, extending the ledger without ever reassigning.

    Sorted by filename so a first run is deterministic, and existing entries are kept
    exactly as they are so a later run cannot renumber anything already serving.
    """
    low, high = reserved_range(who)
    ledger = load_ledger(who)
    published: dict[str, str] = dict(ledger.get("published", {}))

    by_file = {name: gid for gid, name in published.items()}
    used = {int(gid[1:]) for gid in published}

    for path in files:
        if path.name in by_file:
            continue
        free = next((n for n in range(low, high + 1) if n not in used), None)
        if free is None:
            raise SystemExit(
                f"error: {who}'s reserved range g{low:03d}-g{high:03d} is full "
                f"({len(used)} ids). Widen it in RESERVED_RANGES in "
                "import_authored_games.py and re-import, which is a deliberate decision: "
                "the range is a promise about which ids nobody else will use."
            )
        used.add(free)
        published[f"g{free}"] = path.name

    return dict(sorted(published.items()))


def write_ledger(who: str, published: dict[str, str], src: Path) -> None:
    doc = {
        "_README": (
            f"Published id -> the filename it came from in {src.relative_to(REPO)}. "
            "Written by scripts/arc3/stage_contributed_glowups.py. An entry is NEVER "
            "reassigned: a published id keys arc3Triage.json, the human-play telemetry "
            "and the feedback rows, so renumbering hands one game's history to another. "
            "A withdrawn file leaves its id burnt on purpose."
        ),
        "contributor": who,
        "published": published,
    }
    ledger_path(who).write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rename a contributor's revised games into import_authored_games.py's input shape.")
    parser.add_argument("--who", default="sonpham-org",
                        help="contributor key, matching a range in authored-ids.json")
    parser.add_argument("--dir", default="sonpham",
                        help=f"upload subdirectory under {UPLOADS.relative_to(REPO)}")
    parser.add_argument("--out", type=Path, required=True, help="staging directory to write")
    parser.add_argument("--check", action="store_true",
                        help="allocate and report, but write neither the ledger nor the staging dir")
    args = parser.parse_args()

    src = UPLOADS / args.dir
    if not src.is_dir():
        print(f"error: no such upload directory: {src}", file=sys.stderr)
        return 1

    everything = sorted(p for p in src.glob("*.py") if not p.name.startswith("__"))
    files = qualifying(src)
    skipped = [p.name for p in everything if p not in files]

    if not files:
        print(f"error: no revised (v2+) games in {src}", file=sys.stderr)
        return 1

    published = allocate(args.who, files)
    staged = {gid: name for gid, name in published.items() if (src / name).is_file()}

    # Every skip is printed, never summarised away. A real game held back by a rename is
    # invisible in a directory of hundreds, and the same reasoning is written out at
    # length in source_entries() in import_authored_games.py.
    if skipped:
        print(f"holding back {len(skipped)} file(s) in {src.name} with no recorded revision:",
              file=sys.stderr)
        for name in skipped:
            print(f"    {name}", file=sys.stderr)

    missing = sorted(gid for gid in published if gid not in staged)
    if missing:
        print(f"note: {len(missing)} ledger id(s) name a file no longer in the upload "
              f"({missing}). The ids stay burnt; nothing was reassigned.", file=sys.stderr)

    if args.check:
        print(f"{len(staged)} revised game(s) would stage as "
              f"{min(staged)}-{max(staged)}; {len(skipped)} held back")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    for gid, name in staged.items():
        # `<gid>_<original stem>.py`: the importer reads only the leading id, and the rest
        # is there so a human reading the staging directory can see what became what. The
        # staging directory is a throwaway and none of this reaches the published body.
        shutil.copy(src / name, args.out / f"{gid}_{Path(name).stem}.py")

    write_ledger(args.who, published, src)
    print(f"staged {len(staged)} revised game(s) into {args.out} as "
          f"{min(staged)}-{max(staged)}; ledger: {ledger_path(args.who).relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
