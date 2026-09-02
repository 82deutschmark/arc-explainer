"""
Author: Claude Opus 5
Date: 02-September-2026
PURPOSE: Turn the raw JSONL written by hypothesis_sweep.py into the compact JSON the public
         research page reads (client/public/data/arc3-hypothesis-traces.json). The sweep's own
         output carries the full prompt, reasoning trace and provenance of every run and is
         gitignored machine-local research data; this extracts only what a reader needs and
         commits that.

         Splits each answer into its numbered hypotheses. The model writes them as
         `N. **Short name:** body`, so the short name -- which is the thing worth comparing
         across runs -- can be lifted out and the body kept beside it. A run whose answer does
         not parse is kept with its raw text rather than dropped, because a malformed answer is
         one of the outcomes the experiment is measuring.

         Usage: python scripts/arc3/build_hypothesis_dataset.py [jsonl ...] [--out PATH]
                Defaults to every hypotheses_*.jsonl in data/arc3-hypothesis-sweep/, so running
                it on a machine that has both hosts' files pools them.
SRP/DRY check: Pass -- extraction and shaping only. Parsing heuristics are deliberately NOT
         shared with hypothesis_report.py: that tool reads terminal-side and tolerates several
         numbering styles for triage, whereas this one targets the observed format and records
         its failures explicitly. Merging them would make one of the two worse.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IN_DIR = REPO_ROOT / "data" / "arc3-hypothesis-sweep"
DEFAULT_OUT = REPO_ROOT / "client" / "public" / "data" / "arc3-hypothesis-traces.json"

# Three layouts observed in 32 runs, all from the same prompt:
#   `1.  **Vertical Projectile Tracking:** This hypothesis suggests ...`
#   `2. **Colour-Charge Pairing** - The two framed squares ...`
#   `**1. Quantum Gravity Well**` with the number INSIDE the bold and the body on the next line
# The third appeared once and was silently unparsed by the first version of this pattern, which
# is exactly the sort of quiet loss the harness is supposed to avoid, so the number is now
# allowed on either side of the opening `**`.
ITEM_RE = re.compile(
    r"^[ \t]*(?:(\d+)[.)]\s*\*\*|\*\*\s*(\d+)[.)]\s*)"      # `1. **`  or  `**1. `
    r"(.+?)\*\*\s*[:–—-]*\s*"                                 # bold name, optional separator
    r"(.*?)(?=\n[ \t]*(?:\d+[.)]\s*\*\*|\*\*\s*\d+[.)])|\Z)", # up to the next item
    re.MULTILINE | re.DOTALL,
)


def split_hypotheses(content: str) -> list[dict]:
    out = []
    for match in ITEM_RE.finditer(content or ""):
        number = match.group(1) or match.group(2)
        name = match.group(3).strip().rstrip(":").strip()
        body = " ".join(match.group(4).split())
        out.append({"n": int(number), "name": name, "body": body})
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("Usage:")[0])
    parser.add_argument("results", nargs="*", type=Path)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)

    paths = args.results or sorted(DEFAULT_IN_DIR.glob("hypotheses_*.jsonl"))
    if not paths:
        raise SystemExit(f"No results found in {DEFAULT_IN_DIR}")

    runs, unparsed = [], 0
    for path in paths:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if not row.get("ok"):
                continue
            items = split_hypotheses(row.get("content", ""))
            if not items:
                unparsed += 1
            runs.append(
                {
                    "host": row.get("host"),
                    "model": row.get("model_id"),
                    "game": row.get("game_id"),
                    "frameSha": row.get("frame_sha"),
                    "effort": row.get("reasoning_effort"),
                    "temperature": row.get("temperature"),
                    "topK": row.get("top_k"),
                    "replicate": row.get("replicate"),
                    "elapsedMs": row.get("elapsed_ms"),
                    "promptTokens": row.get("prompt_tokens"),
                    "completionTokens": row.get("completion_tokens"),
                    "reasoningTokens": row.get("reasoning_tokens"),
                    "finishReason": row.get("finish_reason"),
                    "hypotheses": items,
                    # Kept only when parsing failed, so the page can show what actually came
                    # back rather than an empty row. A malformed answer is a result.
                    "raw": None if items else row.get("content", ""),
                }
            )

    runs.sort(key=lambda r: (r["game"], r["effort"], r["temperature"], r["replicate"]))
    cells = defaultdict(int)
    for run in runs:
        cells[f"{run['effort']}|{run['temperature']}"] += 1

    payload = {
        "generatedFrom": [p.name for p in paths],
        "runs": runs,
        "summary": {
            "runCount": len(runs),
            "hypothesisCount": sum(len(r["hypotheses"]) for r in runs),
            "unparsedRuns": unparsed,
            "games": sorted({r["game"] for r in runs}),
            "hosts": sorted({r["host"] for r in runs if r["host"]}),
            "models": sorted({r["model"] for r in runs if r["model"]}),
            "cells": dict(sorted(cells.items())),
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    size_kb = args.out.stat().st_size / 1024
    print(f"{len(runs)} runs, {payload['summary']['hypothesisCount']} hypotheses, "
          f"{unparsed} unparsed -> {args.out} ({size_kb:.0f} KB)")
    for cell, count in payload["summary"]["cells"].items():
        print(f"  {cell}: {count} runs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
