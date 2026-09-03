#!/usr/bin/env python3
"""
Author: Claude Opus 5
Date: 02-September-2026
PURPOSE: One-shot rename of the 50 published authored tasks from the old hashed ids
(`t00810611`) to the authoring ids they have in autoresearch-arena (`g007`), so a game is
called the same thing in both repos. The hash protected the ordinal, which is not a spoiler;
the mechanic slug is the spoiler and it still never crosses over.

Renames files, class names, and every JSON keyed by a game id. Does NOT touch the database --
that is migrate_ids_db.sql, which needs credentials this repo does not have.

Usage: python3 scripts/arc3/rename_to_gnnn.py --source /path/to/autoresearch-arena/arc3games
       add --apply to write; without it, prints what would change.
SRP/DRY check: Pass -- mechanical rename only. Computes no fact about any game.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GAMES = REPO / "server" / "data" / "arc3-games"

# The old derivation, kept only long enough to recognise what each published file used to be.
OLD_ID = lambda gid: "t" + hashlib.sha256(f"arena:{gid}".encode()).hexdigest()[:8]

# Every file that addresses a game by id. Plain token replacement: a published id is a
# 9-character token that occurs nowhere else, so structural editing buys nothing here.
TARGETS = [
    GAMES / "manifest.json",
    GAMES / "frames.json",
    GAMES / "mechanics.json",
    GAMES / "mechanics-notes.json",
    GAMES / "categories.json",
    REPO / "server" / "services" / "arc3Mirror" / "arc3Triage.json",
    REPO / "client" / "public" / "data" / "arc3-hypothesis-traces.json",
    REPO / "client" / "src" / "pages" / "arc3-community" / "CommunityGamePlay.tsx",
    REPO / "client" / "src" / "pages" / "arc3-community" / "Arc3HypothesisResearch.tsx",
]


def build_map(source: Path) -> dict[str, str]:
    """old published id -> authoring id, for the 50 tasks actually published here."""
    authored = sorted(m.group(1) for f in source.iterdir()
                      if (m := re.match(r"(g\d{3})_.*\.py$", f.name)))
    published = sorted(p.stem for p in GAMES.glob("t*.py"))
    id_map = {OLD_ID(g): g for g in authored}
    missing = [p for p in published if p not in id_map]
    if missing:
        sys.exit(f"{len(missing)} published tasks have no match in {source}: {missing}")
    out = {p: id_map[p] for p in published}
    if len(set(out.values())) != len(out):
        sys.exit("two tasks would take the same name; refusing to rename")
    return out


def rename_sources(id_map: dict[str, str], apply: bool) -> list[str]:
    """Rewrite each task module under its new name, renaming its classes to match.

    Classes stay derived -- the authoring ones are `TumbleBlock`/`TumbleBlockDisplay` and
    would give the game away. The class the manifest points at becomes `G007`; any other
    class in the file becomes `G007A`, `G007B` in order of appearance. Modules are
    self-contained (numpy and arcengine only), so those are file-local names.
    """
    manifest = {m["id"]: m for m in json.loads((GAMES / "manifest.json").read_text())}
    log = []
    for old, new in id_map.items():
        src = (GAMES / f"{old}.py").read_text()
        seen: list[str] = []
        for c in re.findall(r"\bG[0-9a-f]{8}\b", src):
            if c not in seen:
                seen.append(c)
        game_cls = manifest[old]["class_name"]
        renames = {game_cls: "G" + new[1:]}
        for i, c in enumerate([c for c in seen if c != game_cls]):
            renames[c] = f"G{new[1:]}{chr(ord('A') + i)}"
        for a, b in renames.items():
            src = re.sub(rf"\b{a}\b", b, src)
        src = re.sub(rf"\b{old}\b", new, src)
        log.append(f"  {old}.py -> {new}.py   {game_cls} -> G{new[1:]}"
                   + (f"  (+{len(renames) - 1} helper)" if len(renames) > 1 else ""))
        if apply:
            (GAMES / f"{new}.py").write_text(src)
            (GAMES / f"{old}.py").unlink()
    return log


def rewrite_targets(id_map: dict[str, str], apply: bool) -> list[str]:
    log = []
    for path in TARGETS:
        if not path.exists():
            log.append(f"  {path.relative_to(REPO)}  -- absent, skipped")
            continue
        text = original = path.read_text()
        hits = 0
        for old, new in id_map.items():
            text, n = re.subn(rf"\b{old}\b", new, text)
            hits += n
        # manifest.json also carries the class name and source filename per row
        if path.name == "manifest.json":
            for m in json.loads(original):
                text = re.sub(rf"\b{m['class_name']}\b", "G" + id_map[m["id"]][1:], text)
        if path.name == "mechanics.json":
            for m in json.loads(original):
                if m.get("className"):
                    text = re.sub(rf"\b{m['className']}\b", "G" + id_map[m["gameId"]][1:], text)
        log.append(f"  {path.relative_to(REPO)}  {hits} ids")
        if apply and text != original:
            path.write_text(text)
    return log


def rename_frames(id_map: dict[str, str], apply: bool) -> str:
    frames = GAMES / "frames"
    moved = 0
    for old, new in id_map.items():
        png = frames / f"{old}.png"
        if png.exists():
            moved += 1
            if apply:
                png.rename(frames / f"{new}.png")
    return f"  frames/  {moved} previews"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, required=True, help="autoresearch-arena/arc3games")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    id_map = build_map(args.source)
    print(f"{len(id_map)} tasks: {min(id_map.values())}..{max(id_map.values())}\n")
    for line in rename_sources(id_map, args.apply):
        print(line)
    print()
    for line in rewrite_targets(id_map, args.apply):
        print(line)
    print(rename_frames(id_map, args.apply))
    print("\n" + ("applied." if args.apply else "dry run -- nothing written. add --apply"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
