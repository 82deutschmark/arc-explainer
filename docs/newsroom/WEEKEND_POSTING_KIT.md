# Weekend posting kit: drafts for Saturday night to Tuesday morning

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · companion to [WEEKEND_MAGAZINE.md](WEEKEND_MAGAZINE.md).

**Nothing in this file has been sent.** Every draft follows the standing order in [ART_DESK.md](ART_DESK.md): Discord preview first
(to #arc3-rollout-feed, tagging the Boss, with the picture attached), X only after a person's reaction or the Boss's written
word, one send per item, then stop ([FINISHING.md](FINISHING.md)). Each X draft is 280 characters or fewer counting every web
address as 23. Fill the `{braces}` from `client/public/specials/weekend/data/scoreboard.json` right before posting and check the
sentence still matches the board. Hold any draft whose claim you cannot verify at that moment.

Pictures (attach the full-size original; the magazine itself uses the light copies in `client/public/specials/img/`):
`client/public/news-images/2026-10-31-saturday-nvarc3-juggernaut.webp` (Legends cover),
`2026-10-22-arc3-lights-out-scoring-hall-v1.png` (Arena Report),
`2026-10-30-deadline-scoring-hall.png` (bell, clock, final hours),
`2026-10-24-gpu-valley-thaw-full-crew-v1-base.webp` (Field Guide),
`2026-10-23-mit-arc-heroic-cartoon-v1.png` (Who's Who).

Addresses: `https://arc.markbarney.net/specials/…` (the pages are in WEEKEND_MAGAZINE.md). Verified X handles: @JFPuget (CPMP),
@gonedarragh (Darragh Hanley), @chankhavu (Chan Kha Vu), @MindsAI_Jack (Jack Cole). Tag a team-mate only if the person themself
tagged them (Chan tagged @razdaibi and @nguyen_manh599 in his own post).

## The weekend calendar (Eastern times)

### 1. Saturday evening: the cover story
Picture: the juggernaut. Link: `/specials/2026-10-31-saturday-special.html`
```
LEGENDS OF THE KAGGLEVERSE. By day they’re data scientists, researchers and students. This weekend they’re the heroes of the biggest arena in AI, and the lights are flickering. Meet @JFPuget, @gonedarragh, Giba, Tufa’s Jeroen Cottaar and the whole top ten.
https://arc.markbarney.net/specials/2026-10-31-saturday-special.html
```

### 2. Saturday night or Sunday 8 am: the Arena Report
Picture: Lights Out at the Scoring Hall. Link: `/specials/weekend/arena-report.html`
```
THE ARENA REPORT. What’s going wrong in both ARC Prize contests, who’s saying what, and what it means for Monday night. No villains, just a crowded arena two days from the bell.
https://arc.markbarney.net/specials/weekend/arena-report.html
```

### 3. Sunday 9 am: the scoreboard
Picture: the Field Guide valley. Link: `/specials/weekend.html#scoreboard-section`
```
SUNDAY SCOREBOARD. ARC-2: {arc2 first} leads at {arc2 first score}. ARC-3: {arc3 first} leads at {arc3 first score}. Both top tens, with the time each score landed, and the field guide to every team in them.
https://arc.markbarney.net/specials/weekend.html
```

### 4. Sunday 6 pm: one day out
Picture: the scoring-hall clock. Link: `/specials/weekend/final-hours.html`
```
ONE DAY TO THE BELL. Monday, 11:59 pm UTC is 6:59 pm Eastern, 3:59 pm Pacific, 11:59 pm in London and 8:59 am Tuesday in Tokyo. How the finals are decided, what’s at stake and what to watch:
https://arc.markbarney.net/specials/weekend/final-hours.html
```

### 5. Monday 8 am: final day
Picture: the Field Guide valley. Link: `/specials/weekend/field-guide.html`
```
FINAL DAY. The bell rings at 6:59 pm Eastern tonight. Every team in both top tens, who’s playing and what they’ve won:
https://arc.markbarney.net/specials/weekend/field-guide.html
```

### 6. Monday 2:59 pm: four hours out
Picture: the scoring-hall clock. Link: `/specials/weekend.html`
```
FOUR HOURS TO THE BELL. {arc2 first} leads ARC-2 at {arc2 first score}; {arc3 first} leads ARC-3 at {arc3 first score}. Live top tens, countdown and the latest from the arena:
https://arc.markbarney.net/specials/weekend.html
```

### 7. Monday 6:30 pm: thirty minutes
Link: `/specials/weekend.html`. Post only if the board and the deadline are unchanged.
```
THIRTY MINUTES. The bell is 6:59 pm Eastern. Good luck to every competitor, from first place to last: the legends, the rookies, the one-person teams and the five students in Tokyo.
https://arc.markbarney.net/specials/weekend.html
```

### 8. Monday 7:05 pm: the bell has rung
Link: `/specials/weekend/final-hours.html`. Post only after the deadline has passed unchanged.
```
THE BELL HAS RUNG. Submissions are closed. The private leaderboard decides everything now. Last public top ten and what happens next: Kaggle lists the winners announcement for December 4.
https://arc.markbarney.net/specials/weekend/final-hours.html
```

### 9. Tuesday morning: waiting for the private board
Post only when you can add something true (a Kaggle or ARC Prize statement, or the first private scores).
```
{what changed, one sentence, who said it}. The private board is what counts. Latest on the ARC Prize finish:
https://arc.markbarney.net/specials/weekend.html
```

## Scenario drafts

**Deadline extended.**
```
DEADLINE EXTENDED. {who announced it} says the ARC Prize deadline is now {new deadline in UTC and Eastern}. The final hours, with every bell time, are updated:
https://arc.markbarney.net/specials/weekend/final-hours.html
```
**Freeze, rerun or outage statement from Kaggle.**
```
{Kaggle staff name} of Kaggle says {one plain sentence, their words or a close paraphrase}. What it means for the final hours:
https://arc.markbarney.net/specials/weekend/arena-report.html
```
**A new leader.**
```
NEW LEADER IN {contest}: {team} reaches {score} at {time} Eastern, passing {previous leader}. Both top tens, live:
https://arc.markbarney.net/specials/weekend.html
```
**Official results.** Verified private-board or ARC Prize results only.
```
OFFICIAL: {team} finishes {place} in {contest} on the private board with {score}. {one sentence on how far the order moved from the public board}. Full results as Kaggle lists them:
{official link}
```

## Discord preview (every post above)

Same text, then the Boss's mention, sent once with the picture attached:

```sh
openclaw message send --channel discord --target channel:1550165647911034940 \
  --message "<@293569238386606080> {the draft, with its link}" --media "<absolute path of the picture>" --json
```

Save the receipt as `~/bubba-workspace/reports/arc-daily-x/<date>-<slug>-discord.json` (state, picture and SHA-256, message id,
send time). Any person's reaction on that exact message, or the Boss's written word, clears the X post. No reaction means the X
post stays a draft; do not loop or poll.
