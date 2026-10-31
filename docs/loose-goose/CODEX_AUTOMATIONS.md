# Running the Loose Goose as Codex automations

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · the Digest's desks, restated for the Goose. Source of truth for the
Digest's version: [README.md](../newsroom/README.md), [SCHEDULED_EDITIONS.md](../newsroom/SCHEDULED_EDITIONS.md),
[WIRE_DESK.md](../newsroom/WIRE_DESK.md), [SOCIAL_DESK.md](../newsroom/SOCIAL_DESK.md), [FALLBACK.md](../newsroom/FALLBACK.md),
[CHECKIN.md](../newsroom/CHECKIN.md) and `docs/newsroom/automation-prompts/`.

## The principle

Rules live in the docs. A Codex job's instructions only point at the docs, so a rule is written once and every desk picks it up.
Each job reads FINISHING.md first: verify once, push, stop.

## The desks (copy, rename, retime)

| Desk | Engine | When (Eastern) | Does | May send |
|---|---|---|---|---|
| Early edition | Codex GPT-6.1 Sol | 6:00 am | Edition for each tracked contest, one illustrated X post | one routine X post; Discord via relay |
| Late edition | Codex GPT-6.1 Sol | 5:00 pm art prepress, 6:00 pm release | Same, with finished score overlays | one routine X post; Discord via relay |
| Wire | Codex GPT-6 Luna | every two hours | One breaking story when the board or a statement warrants it | wire stories on the site |
| Research | Codex GPT-6.1 Sol | running | Reads Kaggle forums, X, organizer posts into evidence | nothing public |
| Personal briefing | Codex GPT-6.1 Sol | 5:30 am and 5:30 pm | Private note for the Boss: what happened and what to react to | nothing public |
| Afternoon recap | Codex GPT-6.1 Sol | 2:20 pm | One board recap post, hand-off to the evening desk | one X post |
| Backup desk | Claude Sonnet 5.5 and Haiku 5.5 | 6:50 am and pm; wire at 9:40, 12:40, 3:40, 9:40 | Only what Codex missed | same as above |
| Check-in | Claude Sonnet 5.5 | about 7:05 am | Reads the morning edition and fixes what it safely can | daily report only |
| Collector | launchd | every 30 minutes | Saves each contest's board to the site | board data |
| Desk relay | launchd | every 10 minutes | Posts edition announcements and alarms to Discord | Discord |

For the Goose, keep the shape and trim: start with Early and Late editions, the wire and the research desk. Add the recap and the briefing once the Boss likes the editions. Do not start eight desks for a contest with a few hundred teams.

## Checkouts

Each publishing desk has its own locked git worktree so two jobs never edit the same checkout (newsroom, wire, fallback; see AGENTS.md "Required newspaper checkouts"). Never remove, unlock, prune, rename or repurpose them. The Goose needs its own set under new names, created once and then left alone. Research and briefing desks work read-only.

## A job's prompt (skeleton)

1. One sentence: who you are, when you run, what you may publish or send.
2. "Read FINISHING.md, then the desk doc named here: <path>."
3. The authorized outputs and the forbidden ones (for example: "never post to X without the Discord receipt and approval").
4. The state to check first (existing outbox, existing edition for today), and "an existing `posting` or `posted` state is never overwritten".
5. Where to write results and receipts.
6. When to stop: after a successful push and one outbox update.

Keep prompts short. Do not paste rules into them.

## State and safety

- The live state of every Codex desk is its `status` in the Codex `automations` table. Never pause or resume a desk without the Boss.
- Outboxes (`~/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-*.json`) are the memory between runs. Read before preparing; never overwrite sent states.
- Pushes to `main` redeploy the site. Never poll the deployment. If a job needs a page live before posting (share cards), it checks once for a 200, and otherwise leaves the post as a draft with the reason.
- Alarms go through the desk relay to Discord. A blocker is a concrete sentence, not a log.
- Machine limits: the Mac Mini runs at most two heavy sessions at once. Big data (boards history, art originals, caches) goes on the Samsung SSD under `/Volumes/Samsung 9100 SSD/`; stop and say so if it is not mounted.

## Final-days mode (the last week of a contest)

Switch on at seven days out:
1. The weekend-magazine pages for the contest (cover with countdown and scoreboard, arena report, field guide, who's who, final hours). Build from `scripts/weekend_magazine.py`'s template; put contest names, deadline and notes in a config file.
2. Shakeup commands: `breaking`, `ticker`, `clear-breaking`, `refresh`, `check`. A shakeup is verified against the primary source, attributed, pushed, previewed in Discord, then posted.
3. A fact-check workflow on every new page before it goes out (EDITORIAL_PLAYBOOK.md).
4. The optional hourly refresh job: refresh the saved tables, push only if the page gate passes, edit no prose, post nothing. Documented in WEEKEND_MAGAZINE.md; the Boss decides whether to switch it on.
5. A posting calendar with spaced slots (X_PLAYBOOK.md), with each slot's trigger written down. A slot with no news is deleted, not filled.
6. At the bell: "the bell has rung" post, no standings claims, then wait for the private board or an official announcement.

## Launch order for a new contest

Collector, then ledgers, then reference art, then one edition in Discord, then Codex jobs paused, then the Boss's reaction, then jobs on. In that order, every time.
