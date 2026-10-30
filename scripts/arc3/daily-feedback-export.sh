#!/bin/bash
#
# daily-feedback-export.sh
#
# Author: Claude Sonnet 5; Railway login fix 30-Oct-2026 by Claude Sonnet 5.5 Medium
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

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

log "Starting arc3 feedback export"
cd "$ARC_EXPLAINER"

# 30-Oct-2026: use the Railway CLI's stored login. A set RAILWAY_API_TOKEN/RAILWAY_TOKEN overrides it, and the
# old saved token file (~/.railway/bubba-token) is refused by Railway, so both are unset here.
env -u RAILWAY_API_TOKEN -u RAILWAY_TOKEN \
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
