#!/usr/bin/env python3
"""
Author: Cascade (ChatGPT)
Date: 2026-01-09
PURPOSE: Utility to validate and sanitize RE-ARC submission JSON files by ensuring
         each attempt grid is a non-empty ≤30×30 integer matrix. Automatically
         replaces invalid entries with [[0]] and rewrites files atomically.
SRP/DRY check: Pass — focuses solely on submission sanitation without touching solver logic.
"""

import argparse
import json
from pathlib import Path
from typing import List

MAX_DIMENSION = 30
FALLBACK_GRID = [[0]]


def is_valid_grid(grid) -> bool:
    if not isinstance(grid, list) or not grid:
        return False
    if len(grid) > MAX_DIMENSION:
        return False
    width = None
    for row in grid:
        if not isinstance(row, list) or not row:
            return False
        if len(row) > MAX_DIMENSION:
            return False
        width = len(row) if width is None else width
        if len(row) != width:
            return False
        for cell in row:
            if not isinstance(cell, int) or cell < 0 or cell > 9:
                return False
    return True


def sanitize_file(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    patched = 0
    for task_entries in data.values():
        for entry in task_entries:
            for key in ("attempt_1", "attempt_2"):
                if not is_valid_grid(entry.get(key)):
                    entry[key] = FALLBACK_GRID
                    patched += 1
    if patched:
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp_path.replace(path)
    return patched


def main():
    parser = argparse.ArgumentParser(description="Sanitize RE-ARC submission JSON files.")
    parser.add_argument("files", nargs="+", help="Submission JSON files to sanitize.")
    args = parser.parse_args()

    for file_path in args.files:
        path = Path(file_path)
        if not path.exists():
            print(f"Skipping missing file: {path}")
            continue
        patched = sanitize_file(path)
        print(f"{path.name}: patched {patched} attempt(s).")


if __name__ == "__main__":
    main()
