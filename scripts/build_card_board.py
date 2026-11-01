#!/usr/bin/env python3.13
# Author: Claude Sonnet 5.5 (effort unknown)
# Date: 30-October-2026
# PURPOSE: Boil the newsroom's edition evidence files down to content/news/board-history.json, what a
# Card Cabinet card needs to put a rank in context: how many teams were on each board when a standing was
# saved ("#8 of 4,975"), the medal-band cut scores at that moment (gold, silver, bronze zone), and each
# team's best rank so far. Reads content/news/evidence/*-arc-2.json and *-arc-3.json (the saved board
# snapshots every edition keeps); invents nothing and makes no network requests. Byte-stable output.
# The board is keyed by the contest key the evidence file name ends with (arc-2, arc-3), the same key the
# card registry uses, so a new season's boards slot in by the same rule.
# Usage: python3.13 scripts/build_card_board.py [--check]
# SRP/DRY check: Pass — one job (evidence -> board-history.json); the server reads the result.
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "content/news/evidence"
OUT = ROOT / "content/news/board-history.json"
KEEP = 600  # newest saved snapshots kept per board


def walk(node, collect) -> None:
    """Find every saved board snapshot: an object with a time 't' and a team count 'teams'."""
    if isinstance(node, dict):
        if isinstance(node.get("t"), str) and isinstance(node.get("teams"), int):
            collect(node)
        for value in node.values():
            walk(value, collect)
    elif isinstance(node, list):
        for value in node:
            walk(value, collect)


def main() -> int:
    boards: dict[str, dict[str, dict]] = {}
    peaks: dict[str, dict] = {}
    for path in sorted(EVIDENCE.glob("*.json")):
        contest = next((key for key in ("arc-2", "arc-3") if path.stem.endswith(f"-{key}")), None)
        if contest is None:
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        snapshots = boards.setdefault(contest, {})

        def collect(snapshot: dict, snapshots=snapshots) -> None:
            band = {name: snapshot[name] for name in ("gold", "silver", "bronze", "top") if isinstance(snapshot.get(name), (int, float))}
            snapshots[snapshot["t"]] = {"teams": snapshot["teams"], **band}

        walk(data, collect)
        for team_id, series in (data.get("scoreHistory") or {}).items():
            for stamp, _score, rank in series:
                key = f"{contest}:{team_id}"
                if key not in peaks or (rank, stamp) < (peaks[key]["rank"], peaks[key]["at"]):
                    peaks[key] = {"rank": rank, "at": stamp}
    result = {
        "version": 1,
        "boards": {contest: [{"t": stamp, **snapshots[stamp]} for stamp in sorted(snapshots)[-KEEP:]] for contest, snapshots in sorted(boards.items())},
        "peaks": dict(sorted(peaks.items())),
    }
    text = json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != text:
            print("content/news/board-history.json is stale: run python3.13 scripts/build_card_board.py")
            return 1
        print("board-history.json is current")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: boards {{{', '.join(f'{k}: {len(v)}' for k, v in result['boards'].items())}}}, team peaks {len(peaks)}, {len(text) // 1000} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
