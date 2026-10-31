# The Weekend Magazine: how it runs, and what to do when something shakes up

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · built at the Boss's request so the last weekend of ARC Prize 2026
(Saturday 31 October to Monday 2 November) is covered without him babysitting. Drafts to post are in
[WEEKEND_POSTING_KIT.md](WEEKEND_POSTING_KIT.md). Standing orders still apply: [FINISHING.md](FINISHING.md) (verify once, push,
stop; never poll the deployment) and [ART_DESK.md](ART_DESK.md) (Discord first, X after the Boss's word).

## What it is

A small, hand-written magazine that lives next to the paper, not inside it, so the scheduled editions and the wire cannot
break it and it cannot break them. Nothing here posts anywhere.

| Page | Address | What it holds |
|---|---|---|
| Cover | `/specials/weekend.html` | Countdown to the bell, breaking bar, latest-news ticker, contents, live top-ten scoreboard, paper feed |
| Legends of the Kaggleverse | `/specials/2026-10-31-saturday-special.html` | The Saturday cover story (frozen as published, boards as of Saturday afternoon) |
| Arena Report | `/specials/weekend/arena-report.html` | What is going wrong in both contests, who said what (sourced), what the hosts say, a dated timeline |
| Field Guide | `/specials/weekend/field-guide.html` | Every team in both top tens, regenerated from the live boards |
| Who's Who | `/specials/weekend/whos-who.html` | The master list: Kaggle handle, X handle, team and place in each contest, searchable |
| Final Hours | `/specials/weekend/final-hours.html` | Bell times by city, how finals are decided, prizes, medal lines, watch list |

Files: pages in `client/public/specials/weekend/`, look in `assets/magazine.css`, behaviour in `assets/magazine.js`, data in
`data/` (`breaking.json`, `ticker.json`, `scoreboard.json`), tooling in `scripts/weekend_magazine.py`, tests in
`tests/test_newsroom_weekend_magazine.py`. Optimised copies of the art are in `client/public/specials/img/` (the originals in
`news-images/` are 2 to 4 MB each; never point a magazine page at them).

## The three things that move on their own

1. **The countdown** ticks in the browser toward Monday 23:59 UTC (`data-target` on the cover and Final Hours).
2. **The scoreboard** on the cover re-reads the public board API when it scrolls into view and replaces the saved tables if the
   board is newer. If the API is slow or down it keeps the saved table and says so.
3. **The red BREAKING bar and the ticker** read `data/breaking.json` and `data/ticker.json` on every page view.

## Routine: refresh and push (every few hours, and before any post)

```sh
cd <a clean worktree of arc-explainer main>
python3.13 scripts/weekend_magazine.py refresh      # rebuilds tables, field guide, Who's Who, bell times, medal lines, paper feed; then runs the gate
git add client/public/specials docs && git commit -m "Weekend magazine: refresh boards" && git push origin HEAD:main
```

`refresh` pulls both boards from the API, rewrites only the regions between `<!-- BEGIN:name -->` and `<!-- END:name -->`, writes
`data/scoreboard.json`, and runs `check`. It exits non-zero and prints `PROBLEM:` lines if anything is unsafe to publish. A push
is the whole publication; do not poll the site afterwards.

## Shakeups: three one-line commands

```sh
python3.13 scripts/weekend_magazine.py breaking --headline "Kaggle extends the deadline to Tuesday 23:59 UTC" \
  --text "Kaggle posted the change on both contest timelines." --link-url /specials/weekend/final-hours.html --link-text "The Final Hours"
python3.13 scripts/weekend_magazine.py ticker --kicker "Scoreboard" --text "A new leader in ARC-3: <team> at <score>." \
  --link-url /specials/weekend.html#scoreboard-section --link-text "Both top tens"
python3.13 scripts/weekend_magazine.py clear-breaking
```

Rules the commands enforce: text under 280 characters, no bare web addresses (links go in `--link-url` and `--link-text`; a link must
start with `/` or `https://`). Then commit and push `client/public/specials/weekend/data`. A banner or ticker line shows within a
minute of the deploy. For a change to a page's prose (a correction, a new timeline entry), edit the HTML and run `check`.

## Playbooks

For every scenario: verify with the primary source first (the contest's Kaggle Overview > Timeline, the Kaggle forum thread, the
host's own post), say who said it, give the time in Eastern, then act. Never state a cause as fact unless the host or Kaggle staff
confirmed it; attribute it to the person who claimed it.

**1. The deadline is extended.** Source: Kaggle's Overview > Timeline for each contest or an ARC Prize / Kaggle staff post.
Do: `breaking` (new deadline in UTC and Eastern), update `data-target` in `weekend.html` and `final-hours.html`, the dateline
and bell table text (`zones` is computed from `DEADLINE` in `scripts/weekend_magazine.py`: change it, run `refresh`), and add a
timeline line to the Arena Report. Post: [kit, scenario 1].

**2. The deadline passes with no extension (Monday 6:59 pm Eastern).** The countdown flips to "The bell has rung" by itself.
Do: `clear-breaking` if one is up, `ticker` "The bell has rung. Private scoring decides everything.", and refresh once more so the
public tables are the last public ones. Do not publish final standings: only the private board decides.

**3. Kaggle freezes submissions, reruns runs, or announces an outage.** Source: a Kaggle staff post. Do: `breaking` with the
staff member's name and wording, a timeline line, and the ARC-2 or ARC-3 section of the Arena Report if the plan changes
(what reruns will count, new selection window). Quote briefly; do not speculate about causes.

**4. The top of a board changes.** `refresh` handles the tables; add a `ticker` line if a new team takes first place, if an
NVIDIA team or Team Turducken moves into or out of the top three, or if a score jumps by more than five points. Check the
Field Guide blurb for the team that moved; teams without a curated line get a plain roster line.

**5. The private leaderboard or results appear.** Only official Kaggle results count (the private board, or an ARC Prize
announcement). Verify twice. Import results through the cards tooling described in [README.md](README.md) (`node --import tsx
scripts/newsroom_cards.ts import-results`) before saying "winner", "gold" or "silver" anywhere. Then `breaking`, a ticker line, a
new Final Hours section ("The results") and a Discord preview before any X post.

**6. A host or Kaggle statement without a rule change** (a clarification, a new thread, a staff apology). `ticker` with the
statement's author, one line, and the thread as the link. Add a voice card to the Arena Report if it is quotable.

## What the magazine will not do

It does not post, reply, follow, or tag anyone. It does not name a cause for the platform trouble on anyone's behalf. It does not
publish a pairing between an X account and a Kaggle account unless the person's own profile or a ledger source links them (see
`content/news/handle-candidates.json` for the ones that are only probable). It does not repeat the "AI-generated illustration"
disclaimers; the Boss ruled those out.

## Known limits

The board API refreshes about every 30 minutes (`latest.fetched` says when); the page always prints the board's own time. The
"reached" time is when our tracker first saw a score, not when Kaggle posted it. Arrows compare with the board's baseline, the
previous 6 pm Eastern cutoff. The Legends page and the Arena Report are Saturday's reporting: update the Arena Report timeline and
the Final Hours watch list as the weekend moves; leave the Legends page as published. The ticker is hand-fed: if nobody adds a line,
the paper feed on the cover still shows the newest stories.

## Optional: an hourly refresh job (not switched on)

The only thing that goes stale on its own is the saved copy of the tables and the paper feed (the live scoreboard fixes the tables
for anyone with JavaScript). If the Boss wants the saved copy kept fresh through Monday night with nobody watching, schedule one
job, hourly from Saturday 5 pm to Monday 8 pm Eastern, with this instruction and nothing more:

> In a clean worktree of arc-explainer `main`, run `python3.13 scripts/weekend_magazine.py refresh`. If it prints `PROBLEM:` lines,
> push nothing and send one alert through `~/bubba-workspace/tools/arc_daily_announce.py --alert`. If it passes and files changed,
> commit "Weekend magazine: refresh boards" and push to `main`, then remove the worktree. Edit no prose. Post nothing to X or
> Discord. Stop after one run.

Pushes redeploy the site, so hourly is the ceiling; a stale saved table is harmless because the page prints the board's own time.
