"""
Author: Cascade
Date: 2025-11-17
PURPOSE: Rename existing ARC puzzle GIFs to include friendly names from shared/utils/puzzleNames.ts.
         Example: arc_puzzle_11852cab.gif -> arc_puzzle_11852cab_checkered.gif.
SRP/DRY check: Pass - Single responsibility for renaming, puzzle IDs and names come from canonical mapping.
"""

import re
from pathlib import Path


# Paths
REPO_ROOT = Path(r"D:\GitHub\arc-explainer")
PUZZLE_NAMES_TS = REPO_ROOT / "shared" / "utils" / "puzzleNames.ts"
GIF_DIR = REPO_ROOT / ".claude" / "skills" / "slack-gif-creator"

# Pattern to extract ID -> name pairs like '11852cab': 'checkered',
PUZZLE_ENTRY_PATTERN = re.compile(r"'([0-9a-f]{8})':\s*'([^']+)'")


def load_puzzle_id_name_pairs() -> list[tuple[str, str]]:
  """Parse puzzleNames.ts and return (id, friendly_name) pairs."""
  text = PUZZLE_NAMES_TS.read_text(encoding="utf-8")
  return PUZZLE_ENTRY_PATTERN.findall(text)


def slugify(name: str) -> str:
  """Convert a friendly name to a filesystem-safe slug.

  Names in puzzleNames.ts are already lowercase and hyphen/word style,
  but this keeps the script robust to future changes.
  """
  slug = name.lower()
  slug = re.sub(r"[^a-z0-9]+", "_", slug)
  slug = slug.strip("_")
  return slug or "puzzle"


def main() -> None:
  pairs = load_puzzle_id_name_pairs()
  total = len(pairs)
  print(f"Found {total} ID->name pairs in {PUZZLE_NAMES_TS.relative_to(REPO_ROOT)}")

  renamed = 0
  missing_source = 0
  target_exists = 0

  for index, (puzzle_id, friendly_name) in enumerate(pairs, start=1):
    slug = slugify(friendly_name)
    src_name = f"arc_puzzle_{puzzle_id}.gif"
    dst_name = f"arc_puzzle_{puzzle_id}_{slug}.gif"

    src_path = GIF_DIR / src_name
    dst_path = GIF_DIR / dst_name

    prefix = f"[{index}/{total}] {puzzle_id} ({friendly_name})"

    if not src_path.exists():
      print(f"{prefix}: Source GIF not found ({src_name}), skipping")
      missing_source += 1
      continue

    if dst_path.exists():
      print(f"{prefix}: Target already exists ({dst_name}), skipping")
      target_exists += 1
      continue

    print(f"{prefix}: Renaming {src_name} -> {dst_name}")
    src_path.rename(dst_path)
    renamed += 1

  print("\nRename complete.")
  print(f"  Pairs processed: {total}")
  print(f"  Renamed: {renamed}")
  print(f"  Missing source GIF: {missing_source}")
  print(f"  Target already existed: {target_exists}")


if __name__ == "__main__":
  main()
