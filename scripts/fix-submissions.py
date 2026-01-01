#!/usr/bin/env python3
"""
Fix RE-ARC submission files to match validator requirements.
Replaces any null attempt_1/attempt_2 values with fallback grid [[0]].
Backs up originals with .bak extension.

Usage:
  python scripts/fix-submissions.py [submission-file.json ...]
  python scripts/fix-submissions.py rearc-submission-*.json
"""

import json
import sys
from pathlib import Path
from typing import Any

FALLBACK_GRID = [[0]]


def is_valid_grid(grid: Any) -> bool:
    """Check if value is a valid 2D grid."""
    if not isinstance(grid, list) or len(grid) == 0:
        return False
    return all(
        isinstance(row, list) and len(row) > 0 and
        all(isinstance(cell, int) and 0 <= cell <= 9 for cell in row)
        for row in grid
    )


def fix_submission(submission: dict) -> tuple[dict, int]:
    """
    Fix a submission object by replacing null grids with fallbacks.
    Returns (fixed_submission, num_fixed).
    """
    fixed_count = 0

    for task_id, predictions in submission.items():
        if not isinstance(predictions, list):
            continue

        for prediction in predictions:
            if not isinstance(prediction, dict):
                continue

            # Fix attempt_1
            if prediction.get("attempt_1") is None:
                prediction["attempt_1"] = FALLBACK_GRID
                fixed_count += 1
            elif not is_valid_grid(prediction.get("attempt_1")):
                prediction["attempt_1"] = FALLBACK_GRID
                fixed_count += 1

            # Fix attempt_2
            if prediction.get("attempt_2") is None:
                prediction["attempt_2"] = FALLBACK_GRID
                fixed_count += 1
            elif not is_valid_grid(prediction.get("attempt_2")):
                prediction["attempt_2"] = FALLBACK_GRID
                fixed_count += 1

    return submission, fixed_count


def process_file(filepath: Path) -> bool:
    """Process a single submission file. Returns True if successful."""
    print(f"Processing: {filepath.name}")

    try:
        # Read original
        with open(filepath, 'r') as f:
            submission = json.load(f)

        # Verify it looks like a submission
        if not isinstance(submission, dict):
            print(f"  Skipped: Not a submission object (expected dict, got {type(submission).__name__})")
            return False

        # Fix it
        fixed_submission, num_fixed = fix_submission(submission)

        if num_fixed == 0:
            print(f"  OK: No fixes needed")
            return True

        # Backup original
        backup_path = filepath.with_suffix(filepath.suffix + '.bak')
        filepath.rename(backup_path)
        print(f"  Backed up to: {backup_path.name}")

        # Write fixed version
        with open(filepath, 'w') as f:
            json.dump(fixed_submission, f, indent=2)

        print(f"  Fixed: {num_fixed} grid value(s) replaced")
        return True

    except json.JSONDecodeError as e:
        print(f"  Error: Invalid JSON - {e}")
        return False
    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    if len(sys.argv) < 2:
        # Default: fix all rearc-submission-*.json files in cwd
        files = list(Path.cwd().glob("rearc-submission-*.json"))
        if not files:
            print("Usage: python scripts/fix-submissions.py [submission-file.json ...]")
            print("No rearc-submission-*.json files found in current directory")
            sys.exit(1)
    else:
        files = [Path(f) for f in sys.argv[1:]]

    print(f"{'='*60}")
    print(f"RE-ARC Submission File Fixer")
    print(f"{'='*60}\n")

    successful = 0
    failed = 0

    for filepath in files:
        if not filepath.exists():
            print(f"Skipped: {filepath.name} (file not found)")
            failed += 1
            continue

        if process_file(filepath):
            successful += 1
        else:
            failed += 1
        print()

    print(f"{'='*60}")
    print(f"Results: {successful} successful, {failed} failed")
    print(f"{'='*60}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
