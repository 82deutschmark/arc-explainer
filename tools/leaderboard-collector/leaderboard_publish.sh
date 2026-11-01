#!/bin/bash
# Author: Codex
# Date: 2026-11-01
# PURPOSE: Retained collector entry point after the editor's single-checkout handover.
# SRP/DRY: Reuses the existing collector; never pulls or modifies the publishing checkout.
set -euo pipefail
if [[ "${ARC_DAILY_EDITOR_RELEASE:-}" != "approved" ]]; then
  echo "ARC Daily is on editor hold. No collection or upload performed."
  exit 0
fi
cd "$(dirname "$0")"
export PATH="/Users/macmini/.local/bin:/opt/homebrew/bin:/usr/bin:/bin"
export LEADERBOARD_DATA_DIR="${LEADERBOARD_DATA_DIR:-/Users/macmini/GitHub/arc-explainer/.newsroom-archive/2026-11-01/checkouts/arc-daily-collector/board-history}"
for arc_comp in 3 2; do
  export LEADERBOARD_COMPETITION="arc-prize-2026-arc-agi-$arc_comp"
  python3.13 leaderboard_snapshot.py
  python3.13 leaderboard_push_explainer.py
done
