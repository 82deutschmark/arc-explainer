#!/bin/bash
# Author: Codex; Claude Opus 5.5 Medium
# Date: 2026-11-01; 28-Nov-2026 (Claude Opus 5.5 Medium): Generalist Gaming joins the loop, and one contest failing
#       no longer stops the others.
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
status=0
for comp in generalist-gaming-agent arc-prize-2026-arc-agi-3 arc-prize-2026-arc-agi-2; do
  export LEADERBOARD_COMPETITION="$comp"
  # Each contest stands alone: a failed fetch or push is reported and the next contest still runs.
  if ! { python3.13 leaderboard_snapshot.py && python3.13 leaderboard_push_explainer.py; }; then
    echo "$comp: board not updated this run" >&2
    status=1
  fi
done
exit $status
