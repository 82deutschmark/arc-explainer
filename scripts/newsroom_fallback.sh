#!/bin/bash
# Author: Claude Opus 5.5
# Date: 2026-10-10
# PURPOSE: The ARC Daily Digest's backup desk. A launchd agent runs this after each Codex job; it
# does nothing when the Codex run delivered. When an edition is missing (or Codex is signed out
# for the wire), it runs Claude Haiku 5.5 headless through the Boss's Claude Code subscription
# (claude.ai sign-in, never a paid API key) in its own checkout, following the same newsroom docs.
# Usage: newsroom_fallback.sh morning|evening|wire   (docs/newsroom/FALLBACK.md)
# SRP/DRY check: Pass — detection and launch only; the reporting workflow lives in the docs and helpers.
set -uo pipefail

JOB="${1:?morning, evening or wire}"
CHECKOUT=/Users/macmini/GitHub/arc-explainer-fallback
CLAUDE=/Users/macmini/.local/bin/claude
CODEX="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"
MODEL=claude-haiku-5-5
LOGS="$HOME/Library/Logs/arc-daily-fallback"
DAY=$(TZ=America/New_York date +%F)
LOG="$LOGS/$DAY-$JOB.log"
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
# The subscription sign-in only: a stray key or proxy would bill the paid API instead.
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX
mkdir -p "$LOGS"
exec >>"$LOG" 2>&1
echo "=== $(date) backup check: $JOB"

notify() { /usr/bin/osascript -e "display notification \"$1\" with title \"ARC Daily backup desk\"" || true; }

cd "$CHECKOUT" || { notify "Backup checkout missing"; exit 1; }
git fetch -q origin || { echo "fetch failed"; exit 1; }

case "$JOB" in
  morning|evening)
    # Delivered if either contest's edition for today is on main.
    if git ls-tree --name-only origin/main content/news/articles/ | grep -q "/$DAY-$JOB-arc-"; then
      echo "Codex delivered the $JOB edition; nothing to do."; exit 0
    fi
    # A Codex run still working (started in the last two hours) gets to finish; never race it.
    AUTOMATION=$([ "$JOB" = morning ] && echo the-arc-daily-morning-edition || echo arc-agi-3-evening-leaderboard-recap)
    RUNNING=$(/usr/bin/sqlite3 -readonly "$HOME/.codex/sqlite/codex-dev.db" "select count(*) from automation_runs where automation_id='$AUTOMATION' and status='IN_PROGRESS' and created_at > (strftime('%s','now') - 7200) * 1000" 2>/dev/null || echo 0)
    if [ "${RUNNING:-0}" -gt 0 ]; then
      echo "Codex is still running the $JOB edition; leaving it alone."; exit 0
    fi ;;
  wire)
    # A quiet board legitimately files nothing, so the wire backs up only when Codex is signed out.
    if "$CODEX" login status >/dev/null 2>&1; then
      echo "Codex is signed in; the wire desk is its job."; exit 0
    fi ;;
  *) echo "unknown job $JOB"; exit 2 ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  notify "Backup checkout has unexpected changes; not running $JOB"; echo "dirty checkout"; exit 1
fi
git checkout -q claude/newsroom-fallback && git merge -q --ff-only origin/main || { notify "Backup checkout could not update"; exit 1; }

if [ "$JOB" = wire ]; then
  TASK="Run one wire desk shift. Read docs/newsroom/FALLBACK.md, then docs/newsroom/WIRE_DESK.md, and follow WIRE_DESK.md with the backup changes FALLBACK.md lists."
else
  TASK="Codex did not publish today's $JOB edition. Read docs/newsroom/FALLBACK.md, then AGENTS.md and docs/newsroom/REPORTER.md, and publish the $JOB edition following REPORTER.md with the backup changes FALLBACK.md lists."
fi

notify "Codex missed the $JOB job; Claude Haiku is covering it"
"$CLAUDE" -p "$TASK You are the ARC Daily Digest backup desk, Claude Haiku 5.5, running unattended in $CHECKOUT on branch claude/newsroom-fallback. Today's Eastern date is $DAY. Finish with what you published and pushed, or the exact reason you could not." \
  --model "$MODEL" --permission-mode bypassPermissions --max-turns 120 --output-format text
STATUS=$?
echo "=== $(date) claude exited $STATUS"
[ $STATUS -eq 0 ] && notify "Backup $JOB run finished; log in ~/Library/Logs/arc-daily-fallback" || notify "Backup $JOB run failed; see the log"
exit $STATUS
