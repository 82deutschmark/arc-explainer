#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 19-October-2026
PURPOSE: Turns what Kaggle gives us about an ARC-AGI-2 run into what people and Claude can read:
  - the notebook's code (code cells only, numbered, never cut) from the source Kaggle serves;
  - a unified diff of that code against the baseline run's code;
  - the run log condensed from Kaggle's JSON stream format to plain text, keeping the start and the
    end when it is long;
  - a guessed baseline: descriptions usually name the run they build on by its public score
    ("the 39.31 serving"), so the newest earlier submission with a score the description mentions.
  Sizes are capped so a run document stays well under the site's 4 MB limit.
SRP/DRY check: Pass - pure text work, no Kaggle or site calls.
"""
from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

MAX_LOG = 200_000      # characters of log on the page: the first quarter and the last three quarters
MAX_DIFF = 300_000     # characters of diff on the page
MAX_DIFF_LINE = 2_000  # one diff line longer than this is an embedded blob; its tail is cut


def notebook_code(source: str) -> str:
    """Code cells of a notebook as one text, each headed by its number; plain scripts pass through."""
    try:
        nb = json.loads(source)
    except (json.JSONDecodeError, TypeError):
        return source
    if not isinstance(nb, dict) or "cells" not in nb:
        return source
    parts = []
    for i, cell in enumerate(nb["cells"]):
        if cell.get("cell_type") != "code":
            continue
        text = "".join(cell.get("source") or []) if isinstance(cell.get("source"), list) else str(cell.get("source") or "")
        parts.append(f"# ===== cell {i} =====\n{text.rstrip()}\n")
    return "\n".join(parts)


HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
CELL_RE = re.compile(r"^# ===== cell (\d+) =====")


def code_diff(base_code: str, run_code: str, base_label: str, run_label: str) -> tuple[str, bool]:
    """Unified diff of the full code (long cells are never cut, since notebooks embed their solver
    files in cells and the change is often inside one). Each hunk header names the cell it starts in,
    the way git names the function, and over-long lines (embedded blobs) are cut."""
    run_lines = run_code.splitlines(keepends=True)
    cell_at, current = [], None
    for line in run_lines:
        m = CELL_RE.match(line)
        current = m.group(1) if m else current
        cell_at.append(current)
    out = []
    for line in difflib.unified_diff(base_code.splitlines(keepends=True), run_lines,
                                     fromfile=base_label, tofile=run_label, n=3):
        m = HUNK_RE.match(line)
        if m and cell_at:
            cell = cell_at[min(max(int(m.group(1)) - 1, 0), len(cell_at) - 1)]
            line = line.rstrip("\n") + (f" cell {cell}" if cell else "") + "\n"
        if len(line) > MAX_DIFF_LINE:
            line = line[:MAX_DIFF_LINE] + f" … ({len(line) - MAX_DIFF_LINE} characters cut)\n"
        out.append(line)
    text = "".join(out)
    if len(text) <= MAX_DIFF:
        return text or "(the code is identical)", False
    return text[:MAX_DIFF] + "\n… diff cut here …\n", True


def condense_log(path: Path) -> tuple[str, bool]:
    """Kaggle's log is a JSON array of {stream_name, time, data}; plain text otherwise."""
    raw = path.read_text(errors="replace")
    try:
        events = json.loads(raw)
        text = "".join(("! " if e.get("stream_name") == "stderr" else "") + str(e.get("data", ""))
                       for e in events if isinstance(e, dict))
    except json.JSONDecodeError:
        text = raw
    if len(text) <= MAX_LOG:
        return text, False
    head = MAX_LOG // 4
    return f"{text[:head]}\n\n… {len(text) - MAX_LOG} characters cut from the middle …\n\n{text[-(MAX_LOG - head):]}", True


def main_log(out_dir: Path, slug: str) -> Path | None:
    """The notebook's own log (named after the notebook), else the biggest top-level log."""
    own = out_dir / f"{slug}.log"
    if own.is_file():
        return own
    logs = sorted(out_dir.glob("*.log"), key=lambda p: p.stat().st_size, reverse=True)
    return logs[0] if logs else None


SCORE_RE = re.compile(r"(?<![\d.])(\d{1,2}\.\d{2})(?![\d.])")


def guess_baseline(run: dict, earlier: list[dict]) -> dict | None:
    """{key, reason} for the newest earlier submission whose score the description mentions."""
    mentioned = set(SCORE_RE.findall(run.get("description") or ""))
    if not mentioned:
        return None
    for other in sorted(earlier, key=lambda r: r["submittedAt"] or "", reverse=True):
        score = other.get("publicScore")
        if score is not None and f"{score:.2f}" in mentioned:
            return {"key": other["key"],
                    "reason": f"guessed: the description mentions {score:.2f}, this run's public score"}
    return None
