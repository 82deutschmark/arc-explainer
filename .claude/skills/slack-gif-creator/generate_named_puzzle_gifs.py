"""
Author: Cascade
Date: 2025-11-16
PURPOSE: Batch-generate ARC puzzle GIFs for every named puzzle in shared/utils/puzzleNames.ts.
         Reuses the existing single-puzzle GIF generator script without duplicating puzzle ID lists.
SRP/DRY check: Pass - Single responsibility for batch generation, puzzle IDs come from canonical mapping.
"""

import re
import subprocess
import sys
from pathlib import Path


# Paths
REPO_ROOT = Path(r"D:\GitHub\arc-explainer")
PUZZLE_NAMES_TS = REPO_ROOT / "shared" / "utils" / "puzzleNames.ts"
GIF_SCRIPT = REPO_ROOT / ".claude" / "skills" / "slack-gif-creator" / "create_arc_puzzle_gif.py"
DATA_DIR = REPO_ROOT / "data"

# Regex to extract 8-hex-digit puzzle IDs inside single quotes, e.g. '08573cc6'
PUZZLE_ID_PATTERN = re.compile(r"'([0-9a-f]{8})'")


def load_puzzle_ids() -> list[str]:
    """Parse puzzleNames.ts and return a sorted unique list of puzzle IDs."""
    text = PUZZLE_NAMES_TS.read_text(encoding="utf-8")
    ids = sorted(set(PUZZLE_ID_PATTERN.findall(text)))
    return ids


def is_supported_dataset_puzzle(puzzle_id: str) -> bool:
    """Return True if the puzzle JSON exists in a dataset supported by create_arc_puzzle_gif.py.

    The current GIF script only searches data/training and data/evaluation, so we mirror that
    here to avoid noisy FileNotFoundError traces for puzzles that only exist in other folders
    (training2, evaluation2, arc-heavy, concept-arc, etc.).
    """
    for subdir in ("training", "evaluation"):
        candidate = DATA_DIR / subdir / f"{puzzle_id}.json"
        if candidate.exists():
            return True
    return False


def main() -> None:
    puzzle_ids = load_puzzle_ids()
    total = len(puzzle_ids)
    print(f"Found {total} puzzle IDs in {PUZZLE_NAMES_TS.relative_to(REPO_ROOT)}")

    generated = 0
    skipped_missing = 0

    for index, puzzle_id in enumerate(puzzle_ids, start=1):
        prefix = f"[{index}/{total}] {puzzle_id}"

        if not is_supported_dataset_puzzle(puzzle_id):
            print(f"{prefix}: Skipping (no JSON in data/training or data/evaluation)")
            skipped_missing += 1
            continue

        print(f"{prefix}: Generating GIF...")
        try:
            result = subprocess.run(
                [sys.executable, str(GIF_SCRIPT), puzzle_id],
                cwd=str(GIF_SCRIPT.parent),
                check=False,
            )
        except Exception as exc:  # noqa: BLE001 - simple batch script logging
            print(f"{prefix}: ERROR running GIF script: {exc}")
            continue

        if result.returncode == 0:
            print(f"{prefix}: ✅ GIF generated successfully")
            generated += 1
        else:
            print(f"{prefix}: ⚠️ GIF script exited with code {result.returncode}")

    print("\nBatch complete.")
    print(f"  Total IDs: {total}")
    print(f"  GIFs generated: {generated}")
    print(f"  Skipped (no JSON in training/evaluation): {skipped_missing}")


if __name__ == "__main__":
    main()
