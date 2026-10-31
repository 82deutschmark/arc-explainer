# The Loose Goose: a Kaggle sports tabloid, built from the ARC Daily Digest

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · written at the Boss's request, from everything the ARC Daily Digest
did in October 2026. Runs in Codex with Codex automations. Read the other four files in this folder next.

## What it is

The ARC Daily Digest covered one contest pair (ARC Prize 2026) like a sports page. The Loose Goose does the same for any
Kaggle competition: standings, climbers, rivalries, the people behind the handles, comic-book art, and an X account that
posts it. Kaggle is the Kaggleverse, the competitors are superheroes with data-scientist day jobs, and nobody is an
"opponent" or a villain. See [EDITORIAL_PLAYBOOK.md](EDITORIAL_PLAYBOOK.md).

## The four playbooks

| File | Use it for |
|---|---|
| [X_PLAYBOOK.md](X_PLAYBOOK.md) | Every post on X: gates, tags, cadence, how to send and schedule, templates, receipts, the traps we hit |
| [EDITORIAL_PLAYBOOK.md](EDITORIAL_PLAYBOOK.md) | Voice, finding the story in a leaderboard, writing it, fact-checking it, correcting it |
| [CODEX_AUTOMATIONS.md](CODEX_AUTOMATIONS.md) | The desks as Codex automations: schedules, checkouts, prompts, alarms, final-days mode |
| [ART_AND_CARDS.md](ART_AND_CARDS.md) | Characters, reference images, the card set, the art stock, what to reuse and what to remake |

## Reuse inventory

Reuse as it is (nothing ARC in it):
- [FINISHING.md](../newsroom/FINISHING.md): verify once, push, stop. The most important rule in the project.
- [KAGGLE_PRIMER.md](../newsroom/KAGGLE_PRIMER.md) and [HANDLE_CROSSWALK.md](../newsroom/HANDLE_CROSSWALK.md) with `scripts/newsroom_crosswalk.py`: how Kaggle tiers, medals, teams and handles work, and how to pair an X handle with a Kaggle handle without guessing.
- `.agents/skills/competition-reporter/SKILL.md`: the sourcing, identity and attribution rules. It already says "ARC adapter" in one section; add a Goose adapter the same way.
- [CARD_PLAYBOOK.md](../newsroom/CARD_PLAYBOOK.md) and [TEAM_PLAYBOOK.md](../newsroom/TEAM_PLAYBOOK.md): lookup-before-you-name, cards link in every post. Rename the set per contest.
- [ART_DESK.md](../newsroom/ART_DESK.md) rules: the two-generation limit, reference images required, Discord delivery before X.
- `scripts/newsroom_x.py` (outbox state machine: draft, posting, posted, never overwritten), `scripts/newsroom_artwork.py`, `scripts/newsroom_people.py`, `scripts/newsroom_social.py`, `scripts/newsroom_wire.py`.
- `scripts/weekend_story_page.py`: any dispatch becomes a standalone page with its own share card.
- The desk relay and alarm path (`~/bubba-workspace/tools/arc_daily_announce.py`), Discord preview habit, receipts in `~/bubba-workspace/reports/arc-daily-x/`.

Reuse with a rename or a small change:
- Editions: the 6 am and 6 pm shape, 5 pm art prepress, 2:20 pm recap. Keep the rhythm, change the contest names.
- `content/news/` ledgers (`people.json`, `competitors.json`, `cards.json`, `careers.json`, `social*.json`): keep the people. People carry over between contests, and that is the whole advantage of the Goose: a Grandmaster's card and portrait are built once. Add a contest key per entry.
- The board collector (`~/GitHub/arc-daily-collector`) and `/api/kaggle/<contest>/board`: works for any contest with a public leaderboard once the contest slug is added. Row shape: rank, team id, name, last submission, score, submissions, members.
- `scripts/weekend_magazine.py`: the refresh, check, breaking and ticker commands are generic; the contest list, deadline, notes and gold-line wording are ARC-specific. Copy it as `scripts/goose_magazine.py` and move the ARC parts into a config file.
- The Weekend Magazine pages (cover, arena report, field guide, who's who, final hours) are a template for any contest's last week.

ARC-only (do not carry over):
- ARC-2 and ARC-3 contest names, prizes, the 85 percent bonus, the L4 and RTX machine details, the Kaggle thread links, the Digest editions already published, the Tufa and Chen storylines.
- The Team Turducken and Mark Barney disclosure lines: only repeat them where the Boss's team is actually in the contest.

## Launching the Goose on a new contest: the checklist

1. Pick the contest and write down its facts from Kaggle itself: overview, timeline (deadline, merger date, announcement date, all in UTC), prizes, rules for final selection, hardware. Never copy these from a tweet.
2. Add the contest slug to the collector so both public boards save every 30 minutes. Check `/api/kaggle/<slug>/board` returns rows.
3. Seed the ledgers: top 50 teams and their members into `competitors.json`, handles into the crosswalk, an identity check for every person you will name.
4. Cast the art: one character per top team from real reference images (ART_AND_CARDS.md). Two generations then stop.
5. Set up the desks from CODEX_AUTOMATIONS.md, paused, and show the Boss the first edition in Discord before anything posts.
6. Open the X account's first post only after the Boss reacts to the Discord preview.
7. Two weeks before the deadline, switch to final-days mode.
