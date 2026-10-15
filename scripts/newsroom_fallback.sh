#!/bin/bash
# Author: Claude Opus 5.5; Claude Opus 5.5 Max
# Date: 2026-10-10; 15-October-2026 (Sonnet 5.5, Discord reports, self-recovery, wider wire trigger,
#       missing-contest cover, rehearsal mode)
# PURPOSE: The ARC Daily Digest's backup desk. A launchd agent (com.arcdaily.fallback) runs this
# after each Codex job; it does nothing when Codex delivered. When an edition contest is missing,
# or the Codex wire desk is signed out or has stopped running, it runs Claude Sonnet 5.5 headless
# through the Boss's Claude Code subscription (claude.ai sign-in, never a paid API key) in its own
# checkout, following the same newsroom docs (docs/newsroom/FALLBACK.md says how it differs).
# Every step in and every outcome is reported to the Digest's Discord channel through the desk relay
# (~/bubba-workspace/tools/arc_daily_announce.py --alert), so a failure is never silent.
# Usage: newsroom_fallback.sh morning|evening|wire [--rehearse]
#   --rehearse runs the whole job regardless of Codex but publishes, commits, pushes and posts nothing.
# SRP/DRY check: Pass — detection, recovery and launch only; the reporting workflow lives in the
# docs and helpers, and Discord posting reuses the desk relay.
set -uo pipefail

JOB="${1:?morning, evening or wire}"
MODE="${2:-}"
CHECKOUT=/Users/macmini/GitHub/arc-explainer-fallback
CLAUDE=/Users/macmini/.local/bin/claude
CODEX="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"
CODEX_DB="$HOME/.codex/sqlite/codex-dev.db"
RELAY=/Users/macmini/bubba-workspace/tools/arc_daily_announce.py
MODEL=claude-sonnet-5-5
LOGS="$HOME/Library/Logs/arc-daily-fallback"
DAY=$(TZ=America/New_York date +%F)
STAMP=$(TZ=America/New_York date +%F-%H%M)
LOG="$LOGS/$DAY-$JOB.log"
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
# The subscription sign-in only: a stray key or proxy would bill the paid API instead.
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX
mkdir -p "$LOGS"
exec >>"$LOG" 2>&1
echo "=== $(date) backup check: $JOB $MODE"

case "$JOB" in morning|evening|wire) ;; *) echo "unknown job $JOB"; exit 2 ;; esac
[ -z "$MODE" ] || [ "$MODE" = --rehearse ] || { echo "unknown option $MODE"; exit 2; }
LABEL=$([ "$JOB" = morning ] && echo "Early edition" || { [ "$JOB" = evening ] && echo "Late edition" || echo "wire"; })

# Report to the Boss in the Digest's Discord channel; a Mac notification if the relay cannot post.
tell() {
  echo "tell: $1"
  /opt/homebrew/bin/python3.13 "$RELAY" --alert "$1" >/dev/null 2>&1 \
    || /usr/bin/osascript -e "display notification \"$1\" with title \"ARC Daily backup desk\"" || true
}
# Codex's own run ledger: a run is IN_PROGRESS while it works (then PENDING_REVIEW/ACCEPTED).
codex_running() {
  /usr/bin/sqlite3 -readonly "$CODEX_DB" "select count(*) from automation_runs where automation_id='$1' and status='IN_PROGRESS' and created_at > (strftime('%s','now') - 7200) * 1000" 2>/dev/null || echo 0
}
codex_last_start() {
  /usr/bin/sqlite3 -readonly "$CODEX_DB" "select coalesce(max(created_at), 0) / 1000 from automation_runs where automation_id='$1'" 2>/dev/null || echo 0
}
# Edition files for today on main: one per contest, e.g. 2026-10-15-morning-arc-3.json.
published_contests() {
  git ls-tree --name-only origin/main content/news/articles/ | grep -E "/$DAY-$JOB-arc-[23]\.json$" | sed -E 's/.*-(arc-[23])\.json$/\1/'
}

cd "$CHECKOUT" || { tell "the backup desk's folder $CHECKOUT is missing, so backups cannot run until it is restored."; exit 1; }
git fetch -q origin || { echo "fetch failed; the next check retries"; exit 1; }
# Always run the newest backup workflow: fast-forward a clean folder first, and restart once if
# this script itself changed (bash would otherwise keep running the copy it started with).
SELF="$CHECKOUT/scripts/newsroom_fallback.sh"
if [ -z "${ARC_DAILY_FALLBACK_UPDATED:-}" ] && [ -z "$(git status --porcelain)" ] && git merge-base --is-ancestor HEAD origin/main; then
  BEFORE=$(git hash-object "$SELF")
  git merge -q --ff-only origin/main
  if [ "$(git hash-object "$SELF")" != "$BEFORE" ]; then
    echo "backup workflow updated; restarting with the new version"
    export ARC_DAILY_FALLBACK_UPDATED=1
    exec /bin/bash "$SELF" "$@"
  fi
fi

REASON=""
if [ "$MODE" = --rehearse ]; then
  REASON="rehearsal requested"
elif [ "$JOB" = wire ]; then
  # A quiet board legitimately files nothing, so the wire backs up only when Codex is not running it at all.
  if ! "$CODEX" login status >/dev/null 2>&1; then
    REASON="Codex is signed out"
  else
    AGE=$(( $(date +%s) - $(codex_last_start arc-daily-digest-wire-desk) ))
    # The wire runs every two hours; two and a half hours without a start means Codex is not running it.
    [ "$AGE" -gt 9000 ] && REASON="Codex has not started a wire run for $(( AGE / 60 )) minutes"
  fi
  [ -n "$REASON" ] || { echo "Codex is running the wire; nothing to do."; exit 0; }
  [ "$(codex_running arc-daily-digest-wire-desk)" -gt 0 ] && { echo "A Codex wire run is in progress; leaving it alone."; exit 0; }
else
  DONE=$(published_contests | sort -u | tr '\n' ' ')
  case "$DONE" in *arc-2*arc-3*|*arc-3*arc-2*) echo "Codex delivered both $JOB contests; nothing to do."; exit 0 ;; esac
  AUTOMATION=$([ "$JOB" = morning ] && echo the-arc-daily-morning-edition || echo arc-agi-3-evening-leaderboard-recap)
  # A Codex run still working (started in the last two hours) gets to finish; never race it.
  [ "$(codex_running "$AUTOMATION")" -gt 0 ] && { echo "Codex is still running the $JOB edition; leaving it alone."; exit 0; }
  REASON=$([ -z "$DONE" ] && echo "today's $LABEL is not on the site" || echo "today's $LABEL has only ${DONE% } on the site")
fi
echo "stepping in: $REASON"

# A half-finished earlier backup must not disable every later one: save what it left, then start clean.
LEFTOVER=$(git status --porcelain)
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ -n "$LEFTOVER" ] || [ "$AHEAD" -gt 0 ]; then
  RESCUE="$LOGS/rescue-$STAMP"
  mkdir -p "$RESCUE"
  git diff --binary HEAD > "$RESCUE/uncommitted.patch"
  git ls-files --others --exclude-standard -z | tar --null -T - -czf "$RESCUE/untracked.tgz"
  [ "$AHEAD" -gt 0 ] && git format-patch -q -o "$RESCUE/commits" origin/main..HEAD
  git reset -q --hard origin/main && git clean -qfd
  tell "the backup desk found unfinished work from an earlier run and saved it to $RESCUE before starting clean."
fi
git checkout -q claude/newsroom-fallback && git merge -q --ff-only origin/main \
  || { tell "the backup desk could not update its folder, so it could not cover the $LABEL ($REASON). Log: $LOG"; exit 1; }

# Briefs, drafts and plans live here, never in /tmp (shared with Codex) or the repository.
WORK="$LOGS/$([ "$MODE" = --rehearse ] && echo "rehearsal-$STAMP" || echo "$DAY-$JOB-work")"
mkdir -p "$WORK"
if [ "$MODE" = --rehearse ]; then
  RULES="This is a REHEARSAL: do every step up to and including validation, but do not run any publish command, do not stage, commit or push, and do not write to the X outbox. Finish with what you would have published."
else
  RULES="Publication is authorized: publish, commit and push following those docs."
fi
if [ "$JOB" = wire ]; then
  TASK="Run one wire desk shift ($REASON). Read docs/newsroom/FALLBACK.md, then docs/newsroom/WIRE_DESK.md, and follow WIRE_DESK.md with the backup changes FALLBACK.md lists."
else
  TASK="Cover today's $JOB edition ($REASON): publish only the contests that are not on the site yet. Read docs/newsroom/FALLBACK.md, then AGENTS.md and docs/newsroom/REPORTER.md, and follow REPORTER.md with the backup changes FALLBACK.md lists."
fi

[ "$MODE" = --rehearse ] || tell "Codex missed the $LABEL ($REASON). Claude Sonnet 5.5 is covering it now."
"$CLAUDE" -p "$TASK $RULES You are the ARC Daily Digest backup desk, Claude Sonnet 5.5, running unattended in $CHECKOUT on branch claude/newsroom-fallback. Today's Eastern date is $DAY. Keep every brief, draft and plan you write in $WORK. End with one plain line starting OUTCOME: saying what you published (with links) or the exact reason you could not." \
  --model "$MODEL" --permission-mode bypassPermissions --max-turns 150 --output-format text | tee "$WORK/claude-output.txt"
STATUS=${PIPESTATUS[0]}
echo "=== $(date) claude exited $STATUS"
OUTCOME=$(grep -E '^OUTCOME:' "$WORK/claude-output.txt" | tail -1 | sed 's/^OUTCOME: *//' | cut -c1-600)
[ -n "$(git status --porcelain)" ] && OUTCOME="$OUTCOME (it left unfinished changes; the next run saves and clears them)"

if [ "$MODE" = --rehearse ]; then
  echo "rehearsal outcome: ${OUTCOME:-none reported}"
  exit $STATUS
fi
if [ "$JOB" = wire ]; then
  tell "backup wire shift finished: ${OUTCOME:-no outcome reported (exit $STATUS)}. Log: $LOG"
else
  git fetch -q origin
  STILL=$(published_contests | sort -u | tr '\n' ' ')
  case "$STILL" in
    *arc-2*arc-3*|*arc-3*arc-2*) tell "the backup desk published today's $LABEL. ${OUTCOME}" ;;
    *) tell "the backup desk could not fully cover today's $LABEL (on the site: ${STILL:-nothing}). ${OUTCOME:-No outcome reported (exit $STATUS).} Log: $LOG" ;;
  esac
fi
exit $STATUS
