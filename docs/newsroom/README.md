# The ARC Daily Digest newsroom: how it runs

Author: Claude Opus 5.5 Max · 15 October 2026 · written at the Boss's request after the pipeline
sanity check (`docs/2026-10-14-arc-daily-pipeline-sanity-check.md`), with GPT-6.1 Sol reviewing.

This is the map. Every desk reads it first. The rules each desk follows live in one guide per
desk (below); the Codex job instructions only point at them, so a rule is written once.

## The desks

All times America/New_York. Codex is the engine; Claude is the backup and the plumbing.

| Desk | Who | When | Folder | Follows | May publish or send |
|---|---|---|---|---|---|
| Early edition | Codex, GPT-6.1 Sol | 6:00 am | newsroom checkout | [REPORTER.md](REPORTER.md) | both contests' editions; one Early edition X post |
| Late edition | Codex, GPT-6.1 Sol | 6:00 pm | newsroom checkout | [REPORTER.md](REPORTER.md) | both contests' editions; one Late edition X post |
| Wire | Codex, GPT-6 Luna | every two hours, on the even hour | wire checkout | [WIRE_DESK.md](WIRE_DESK.md) | wire stories |
| Research | Codex, GPT-6.1 Sol | every hour (full shifts 3, 5, 11 am, 5, 11 pm) | newsroom checkout, read-only | [SOCIAL_DESK.md](SOCIAL_DESK.md), [DISCUSSIONS.md](DISCUSSIONS.md) | nothing public |
| Personal briefing | Codex, GPT-6.1 Sol | 5:30 am, 5:30 pm | newsroom checkout, read-only | [SOCIAL_DESK.md](SOCIAL_DESK.md) | nothing public |
| Afternoon X recap | Codex, GPT-6.1 Sol | 2:20 pm | newsroom checkout, read-only | [X_POSTING.md](X_POSTING.md) | one afternoon X post |
| Backup desk | Claude Sonnet 5.5 (launchd `com.arcdaily.fallback`) | 6:50 am/pm; wire checks 9:40 am, 12:40, 3:40, 9:40 pm | fallback checkout | [FALLBACK.md](FALLBACK.md) | only what Codex missed |
| Desk relay | launchd `ai.bubba.arc-daily-announce` | every 10 minutes | `~/bubba-workspace/tools/arc_daily_announce.py` | this page | Discord: edition announcements and alarms |
| Leaderboard collector | launchd `com.arc3.leaderboard` | every 30 minutes | `~/GitHub/arc-daily-collector` | this page | uploads both boards to the site |

The two editions, the wire and the backup push to `main`; the site redeploys itself on every push
(never poll the deployment). Research, briefings and the X recap never change the repository.

## Where everything lives

| Place | What it is | Rule |
|---|---|---|
| `~/GitHub/arc-explainer` | the Boss's own checkout of the repository | desks never work here |
| `~/GitHub/arc-explainer-newsroom` (`codex/newsroom-publisher`) | editions, research, briefings, X recap | locked worktree: never remove, unlock, prune or repurpose |
| `~/GitHub/arc-explainer-wire` (`codex/wire-desk`) | the wire | locked worktree, same rule |
| `~/GitHub/arc-explainer-fallback` (`claude/newsroom-fallback`) | the backup desk | locked worktree, same rule |
| `~/GitHub/arc-daily-collector` | collector scripts (scripts-only clone of `sonpham-org/arc-3`), `board-history/` (the saved boards), `job.log` | the paper's data source; keep |
| `content/news/` in the repository | the published paper: `articles/`, `evidence/`, `wire/`, `wire-evidence/`, `dispatches/`, `artwork/`, the ledgers (`people.json`, `competitors.json`, `social*.json`, `discussions.json`) and the desk's data files (`editorial-assignments.json`, `artwork-inventory.json`, `visual-identities.json`, `social-watch.json`, `social-editorial.json`) | immutable once published |
| `~/bubba-workspace/reports/arc-daily-social/` | the private research archive: `state.json`, `public.json`, `founder-coverage.json`, `collections/`, `discussion-collections/`, `briefings/`, `discussion-briefings/`, and dated handoffs in `identity-leads/`, `founder-handoffs/`, `overnight/<date>/`, `art-planning/`, `editorial/<date>-<topic>/` | private; never staged into the repository |
| `~/bubba-workspace/reports/arc-daily-x/` | X outboxes (`<date>-early-edition.json`, `-late-edition.json`, `-afternoon.json`) and the afternoon research handoff | send-once state lives here |
| `~/Library/Logs/arc-daily-fallback/` | backup desk logs, working files and any `rescue-…` folder | |
| `~/.codex/automations/<id>/` | each Codex job's saved instruction and its short `memory.md` note | change only through GPT-6 (below) |

**Keep it tidy.** Desks do not create new top-level folders anywhere. A one-off handoff goes in a
dated folder under `reports/arc-daily-social/` that already exists for its kind. Edition Discord
text is the article's own `discord` field and the relay announces the edition, so desks do not
save separate Discord draft files. One-run briefs and drafts may live in `/tmp` (the backup desk
uses its own log folder instead). Big downloads belong on `/Volumes/Samsung 9100 SSD/`.

## How to change what a desk does

- **Standing rules** go in that desk's guide in `docs/newsroom/`, in the section they belong to.
  Do not add dated "latest direction" sections on top; fold the rule into the workflow.
- **One-off orders** (a commission for a particular issue, a feature, a shout-out, a picture) go
  in `content/news/editorial-assignments.json` with an `expiresAt`. The edition brief carries
  them; they end on their own (72 hours after `createdAt` when no expiry is given).
- **Picture stock** is tracked in `content/news/artwork-inventory.json` and
  `content/news/visual-identities.json`, not in prose. See [ART_DESK.md](ART_DESK.md).
- **Codex job instructions** are short and identical in shape. The reviewed copy of each lives in
  [automation-prompts/](automation-prompts/), one file per job. To change one, edit that file,
  then ask GPT-6 to apply it word for word with its `automation_update` tool, through the
  configuration conversation:
  `"/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex" queue --thread 01a11d8a-c27e-7c83-9539-d62cb844c400 --message "..."`.
  Check the result read-only in `~/.codex/sqlite/codex-dev.db` (table `automations`). Never
  hand-edit `~/.codex`, and never paste a new rule into a job instruction.
- **Job memory notes.** Codex reads `~/.codex/automations/<id>/memory.md` at the start of each
  run and updates it at the end. Keep it a short current note (what the last run did, what is
  open), replaced rather than appended, no more than about forty lines. Rules never go there.

## Checks and alarms

- The desk relay posts to Discord **#arc3-rollout-feed** (`channel:1550165647911034940`), tagging
  the Boss, when an edition goes live and when something is wrong: the site leaving out a broken
  news file (`GET /api/news/health`), a leaderboard more than 75 minutes old (editions and the
  wire refuse data over 90 minutes old), or the site not answering for half an hour. It posts
  once when a problem starts and once when it clears. The backup desk reports through it too.
  All Digest messages go to that channel; desks send nothing to Discord themselves.
- The site leaves out an invalid news file instead of failing (`server/services/news/newsStore.ts`).
  Before pushing code that touches news, run the content check:
  `npx vitest run tests/integration/news.test.ts tests/newsFrontPage.test.ts` and
  `python3.13 -m unittest discover -s tests -p 'test_newsroom*.py'`.
- Allowed writer IDs are in `shared/newsWriters.json`, read by the site and both newsroom scripts.
