#!/bin/bash
#
# daily-feedback-export.sh
#
# Author: Claude Sonnet 5
# Date: 2026-09-06
# PURPOSE: The command a launchd job runs once a day (see docs/ARC3-FEEDBACK-EXPORT.md).
#          Pulls new player feedback out of arc-explainer's database via
#          server/scripts/export-arc3-feedback.ts, then commits and pushes the result in
#          autoresearch-arena so Son Pham sees it without anyone remembering to run a
#          command. Kept as a checked-in script, not typed straight into the plist, so the
#          whole setup survives a machine reset — see the plist install step in the docs.
#
#          A daily commit is expected even when no new feedback arrived: the current-
#          version snapshot (game-versions.json) carries a generatedAt timestamp that
#          changes every run, which is deliberate — it is the proof-of-life that this job
#          is still actually running, not silently broken. See export-arc3-feedback.ts.
#
# SRP/DRY check: Pass — orchestrates the existing export script and existing git remotes;
#          no logic duplicated from either.
#
# Usage (installed by the launchd plist; safe to run by hand too):
#   scripts/arc3/daily-feedback-export.sh
#
set -euo pipefail

# launchd runs jobs with a minimal environment — it does not source .zshrc, so node,
# npx and railway (all Homebrew-installed) are not on PATH unless stated here explicitly.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin"

ARC_EXPLAINER="/Users/macmini/GitHub/arc-explainer"
AUTORESEARCH_ARENA="/Users/macmini/GitHub/autoresearch-arena"
RAILWAY_TOKEN_FILE="$HOME/.railway/bubba-token"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

if [ ! -f "$RAILWAY_TOKEN_FILE" ]; then
  log "ERROR: Railway token not found at $RAILWAY_TOKEN_FILE"
  exit 1
fi

log "Starting arc3 feedback export"
cd "$ARC_EXPLAINER"

RAILWAY_API_TOKEN="$(cat "$RAILWAY_TOKEN_FILE")" \
  railway run node --import tsx server/scripts/export-arc3-feedback.ts

log "Export script finished; checking for changes in autoresearch-arena"
cd "$AUTORESEARCH_ARENA"

if [ -z "$(git status --porcelain arc3games/feedback.jsonl arc3games/game-versions.json)" ]; then
  log "Nothing changed (unexpected — game-versions.json should always update). Skipping commit."
  exit 0
fi

git add arc3games/feedback.jsonl arc3games/game-versions.json
git commit -m "arc3: daily feedback export ($(date -u +%Y-%m-%d))

Automated via arc-explainer/scripts/arc3/daily-feedback-export.sh (launchd, daily).
See docs/ARC3-FEEDBACK-EXPORT.md in arc-explainer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin master

log "Done: pushed to sonpham-org/autoresearch-arena"
