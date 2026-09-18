<!--
Author: Claude Fable 5.1
Date: 2026-09-18
PURPOSE: Product brief for two things Boss asked for on 18-Sep-2026 while looking at
         /arc3/games/dc22: (1) a UI/UX glow-up of the 25 game pages so they read level by
         level with pictures instead of walls of text, and (2) turning the same human-curated
         game knowledge into a dataset that our own training pipeline (autoresearch-arena and
         sonpham-org/arc-3) actually reads, and that we can hand to the community.
         Written for a non-technical project manager first, and for the assistant who builds it
         second. The mockup beside it (2026-09-18-arc3-game-page-mockup-dc22.html) uses only
         real data from shared/arc3Games/dc22.ts and humanPlay.generated.json.
Amended 18-Sep-2026 (Claude Opus 5) with Boss's decisions after reading it; see Amendments.
SRP/DRY check: Pass -- brief only, no code. Everything it proposes reads from the one registry
         in shared/arc3Games that the pages and /arc3/games.md already read; nothing is copied.
-->

# The game pages: glow-up and dataset

> **Status 18-Sep-2026: approved by Boss. Steps 1, 3, 4 and 6 are DONE (the JSON, the page
> rebuild, the dc22 level 6 render, the arc-3 fetch script). Left: the `corrections[]`
> migration (step 2) and, when Boss says so, curation and release (step 5).** The mockup beside this file is the spec ("exactly what I want"), minus what the
> amendments below cut. Read the amendments first: they override the parts of the brief
> they name. The JSON is private (token-gated) until curated; our own pipeline fetches it.

## Amendments, 18-Sep-2026 (Boss, after reading the brief)

1. **The pipeline fetches the JSON from day one, with the arc3 admin token.** Not public, not
   linked from any page, but not locked away either. Live at `GET /api/arc3/dataset` (all 25)
   and `GET /api/arc3/dataset/:gameId`, header `X-ARC3-Admin-Token` =
   `ARC3_COMMUNITY_ADMIN_TOKEN` (on the Mac Mini: keychain service
   `arc3-community-admin-token`). Checked 18-Sep: the keychain value matches production.
   NOT `middleware/apiKeyAuth.ts`, which is do-not-use and ships published keys.
2. **One source, no copies.** arc-explainer's `shared/arc3Games` is the only place the
   write-ups are edited. arc-3 pulls with `tools/fetch_explainer_games.py` into a gitignored
   folder and never commits a copy. The dataset is built per request from the registry, so
   there is no export script or `dist/` folder to go stale; the release step can add one.
3. **No per-level step budget.** `levelBudgets` is dropped, from the types, the page header
   and the dataset. Boss: noise, numbers for the sake of numbers. The same goes for the
   Boss-vs-baseline bar in the level header: show his actions and ARC's baseline as plain
   numbers, no chart, no derived statistics anywhere.
4. **No GitHub code links.** The game code lives in ARC's engine package, not in a repo we
   publish, so `sourceUrl` is dropped. Each rule keeps its plain citation
   (`dc22.py:10663-10708`), and the dataset gives the `build` hash it refers to.
5. **as66 is never in the dataset.** It is test-only in the arc-3 harness.
6. **One document per game with `levels[]`, not one flat record per level.** Game fields are
   not repeated 6-9 times, and each rule appears once, on the level that introduces it
   (`newRules`; rules in force on level N = `newRules` of levels 1..N). The shape is in
   `server/services/arc3/arc3GameDataset.ts`.
7. **Only the live build's levels.** Screenshots filed under a higher level than the game has
   today (ft09's two preview-era shots of levels 8 and 9) stay on the page but are not in the
   dataset.
8. **Human captures are tagged in the data** (`LevelScreenshot.kind: 'human'`, all 10 of them),
   so nothing guesses from captions. `capturedBy`/`capturedAt` are not added: the caption and
   notes already say it.
9. **Play notes, all of them.** Everything Boss said about the games was collected from every chat
   on the Mac Mini (Discord through Bubba, and the Claude Code sessions) and written into the game
   files as `playerObservations`, plus his 18-Sep round-up on the games he had never written about.
   63 notes, every live game has some. 14 of his Discord screenshots are now human captures (10 on
   sk48). ka59 renamed Kick Away; g50t's ACTION5 is no longer called Rewind.

## The one-paragraph version

Every one of the 25 game pages is built from one file per game. Those files are the best
thing this project owns: 553 rule entries, 527 of them pointing at the exact line in the game's
own code, plus 50 of Boss's recorded runs, screenshots of every level, and Boss's notes from
play. Two problems. First, the page dumps all that as text, so a human cannot see the game.
Second, nothing on the training side reads those files at all. This brief fixes both with one
move: **make the level the unit of everything.** The page becomes a level-by-level dossier with
the picture next to the rules, and the dataset becomes one record per level, exported from the
same files the page renders. Same data, two outputs, nothing drifts.

---

## Part 1: what is wrong with the page today

Looking at the current dc22 page, in order from the top:

1. Title, badges, a 4-number strip. Fine.
2. "In Plain English." Fine, but it is the only readable thing before the wall starts.
3. "Every Mechanic": 23 bullets in one card, about 1,200 words, grouped by level as headings
   but with no picture of the level anywhere near them.
4. "Notes From Play" (when a game has any): another text block.
5. "Level Screenshots": six pictures, each 350px wide, in a two-column grid, far down the page,
   with no rules next to them.
6. Human Records table, replays, then "How It Works", which is a 500-word paragraph that
   repeats the bullets in prose.
7. Action mappings, resources, tags, notes. The `notes` field is a 400-word run-on of dated
   corrections.

So the reader gets the rules and the pictures in two different places, and gets the rules
twice (bullets, then prose). Nothing on the page tells you which picture a rule is about.

## Part 2: the new layout

The mockup file is the spec. What each band is and why:

**Band 1, header.** Name, id, the four badges, the one-line description, and the buttons
(Play, Human leaderboard). Same as now, just tighter. **No JSON button yet**: Boss's call on
18-Sep is that the dataset gets curated and checked before anything is released, so the
export exists behind an admin route only until he says otherwise.

**Band 1b, "Play it officially" line.** One sentence under the buttons, on every game page:
to get a real scorecard you play on the official ARC Prize site, not here. Go to
arcprize.org/platform, log in with a Google or GitHub account (those are the only two
options, and the login is hard to find), and play as a human; the scorecard is then locked
to you. That is where Boss's own scorecards and the replay links on these pages come from.
Our Play button is for looking at the game without a login, and it says so in its tooltip.

**Band 2, the level strip.** A single row of every level's opening frame, each about 112px,
pixel-sharp, with the level number and a tiny "Boss actions / ARC baseline" under each one.
This is the thing Boss asked for. It sticks to the top of the window as you scroll, and
clicking a level jumps to that level's section. On a phone it scrolls sideways.

**Band 3, at a glance.** Two cards side by side. Left: "In plain English" with the four
action counts under it. Right: the controls as a key-cap table (ACTION1 = Up, and so on).
Both come from data that already exists.

**Band 4, one section per level.** This is the body of the page and replaces "Every
Mechanic", "Level Screenshots", "Notes From Play" and "How It Works" all at once.

- Section header: "Level N", ARC's baseline actions for that level, and Boss's actions for
  that level as a plain number (on every game, won or not: for an unwon game, his best run's
  actions on the levels he reached, and "not reached" past that). No step budget and no bar
  (amendment 3). On dc22 the numbers alone show level 5 is where it got hard for him: 740
  actions against a 324 baseline.
- Left column, about 300px: the engine-rendered opening frame, labelled "Engine render".
  Underneath it, any human captures for that level (Boss's mid-play screenshots), labelled
  "Human capture" with the date and what state the board is in. Those captures are the gold
  Boss mentioned; they get their own slot instead of being mixed in with renders.
- Right column: the rules. Level 1 shows "The rules from the start"; every later level shows
  only "New on level N". Each rule is one compact row: a small colored category chip
  (controls, goal, pieces, hazards, budget, feedback), one or two sentences, and the source
  citation as a clickable link that opens the exact lines in the game's code on GitHub.
  Under the rules, that level's "Notes from play" in a yellow box: Saw, Did, Expected,
  Happened, In the code.

**Band 5, the fold-outs.** Human Records (the table) and "Replays, sources and correction
history" are collapsed by default with a one-line summary showing. The long `notes` blob
becomes a dated list of corrections.

**What goes away.** The "How It Works" prose card. It says the same as the rules, and the
rules are checked line by line in source and the prose is not. The prose stays in the data
file as the short version for the markdown export, it just stops being a card.

### Design rules for whoever builds it

- Use the existing shadcn Card, Badge, Collapsible and Tabs components. No new UI kit.
- Pixel art stays pixel art: `image-rendering: pixelated` on every game image, never smoothed.
- No purple gradients, no big rounded blobs, no centered hero text. Left-aligned, a hard
  black rule between level sections, small monospace for citations and numbers.
- Mobile: the level strip scrolls sideways, the two columns stack, the picture goes first.
- A game with no `mechanicsBreakdown` (only as66, the withdrawn game) falls back to the
  prose card. A level with no rules of its own still gets a section with its picture.
- Every level's engine render must exist. dc22 level 6 currently only has Boss's capture,
  because the render was replaced on 15-Sep. Re-run the render script so both exist, and
  keep both: the render is the "before", the capture is the "during".

### Data changes needed (small)

All in `shared/arc3Games/types.ts`, all optional so no game breaks:

| field | why |
| --- | --- |
| `LevelScreenshot.kind: 'engine' \| 'human'` (**done**) | so the page can label renders vs captures without guessing from the caption |
| ~~`LevelScreenshot.capturedBy`, `capturedAt`~~ (**cut, amendment 8**) | who and when, for the caption and the dataset |
| ~~`MechanicPoint.sourceUrl`~~ | **cut, amendment 4**: no code links |
| `corrections: { date, text }[]` | replaces the run-on `notes` string, one entry per dated correction; `notes` keeps anything undated |
| ~~`levelBudgets?: number[]`~~ | **cut, amendment 3**: no step budgets |

`humanPlay.generated.json` already has per-level actions and baselines per run, so the level
header needs no new data.

---

## Part 3: the training side, in plain terms

### Where things stand

There are three machines' worth of work happening and they do not talk to each other:

| what | where | reads our game files? |
| --- | --- | --- |
| The agent that plays games (the harness) | `sonpham-org/arc-3`, box `gx10-a108` | no |
| The training corpus and LoRA fine-tuning | `sonpham-org/arc-3`, `ARC3-Inference/distill/`, box `gx10-a424` | no |
| The synthetic game factory | `autoresearch-arena/arc3games/` | no |
| The 25 game write-ups and Boss's runs | this repo, `shared/arc3Games/` | this is the source |

The training corpus is stuck at 381 usable turns against a target of 2,000 to 5,000. The
reason is not the extractor. The model only gets to keep turns from levels it actually
beat, and it beats one level on about half the games. So the corpus grows only as fast as
the model wins, which is slowly.

Meanwhile this repo holds, for every one of the 25 games: the rules per level, verified in
source; pictures of every level; Boss's per-level action counts on 50 runs; the GUIDs of
those runs, which are the key into the replay corpus in arc-3; and Boss's written
observations of what he saw, tried, expected, and got. None of it is being used.

### Three ways the same data can feed training

Each is a different kind of training example. The dataset export in Part 4 produces all
three from the same per-level records.

**A. Rules as a reference card.** Give the model, for a game it is about to play, the plain
rules and the level picture. Use: put the rules into the harness's prompt for the public 25
during practice runs, so we can measure how much of the model's failure is "cannot figure out
the rules" versus "knows the rules and still cannot execute". This is the experiment the
arc-3 notes call "arm C". It does not help on the private games directly, because we do not
have their rules, but it splits the problem in two so we know which half to work on.

**B. Boss's notes as reasoning examples.** Every `playerObservation` is already in the
shape a good reasoning step should have: I saw X, I did Y, I expected Z, W happened, and
here is the rule that explains it. That is exactly what we want the model to write before it
acts. Paired with the level picture, these become "here is how a human reasons about a screen
like this" examples. Today there are only a handful of them, so the ask to Boss is: keep
writing them, one per surprise, and the export will pick them up.

**C. Boss's runs as demonstrations.** The 50 runs have GUIDs. The arc-3 replay corpus can
pull the frame-by-frame record for a GUID. Together they give "a human won this level in N
actions, here is every action and every frame", which is the same shape as the model's own
winning turns, except a human made them and there are 19 games won instead of 11 half-won.
This is the most direct route to the 2,000-turn target and nobody has walked it yet. It is
the first thing to try.

Fairness note, stated once: everything here is about the 25 public games, which ARC calls the
tutorial. Training on them is allowed and expected. It will not teach the model the private
games' rules. It teaches how to reason about a new screen, which is the skill being tested.

---

## Part 4: the dataset

### What it is

One record per (game, level), exported from `shared/arc3Games` by a script, published as
JSONL plus the PNGs in a folder. Roughly 170 records (25 games, 6 to 9 levels each). The same
script serves the JSON button on each page, so the page and the dataset can never disagree.

### One record, in words

- Game: id, informal name, build hash, category, level count, action mappings.
- Level: number, step budget, ARC's baseline actions for that level.
- Pictures: the engine opening frame (path plus the raw 64x64 color grid, since the PNG is a
  lossless 4x scale-up of it), and each human capture with who, when, and board state.
- Rules in force on this level: every rule introduced on this level or earlier, each with
  category, text, and the source citation as both `file:lines` and a GitHub URL.
- Rules new on this level: the subset introduced here.
- Human runs: for each of Boss's runs, actions on this level, whether he cleared it, the run
  GUID (the key into the replay corpus), the date.
- Observations: Boss's notes for this level, as saw / did / expected / happened / in-code.
- Provenance: the dated corrections that touched this game, and the export date.

### What it is not

- Not the game code. ARCEngine's environment files are ARC Prize's. The dataset cites lines
  and links to the public fork at github.com/82deutschmark/ARCEngine; it does not bundle the
  Python. Anyone who wants the code gets it from the source.
- Not the 50 synthetic games or their answer key. Those stay unlisted on purpose.
- Not frame-level replays. Those live in arc-3; the dataset carries the GUIDs to join them.

### Licence and sharing

Write-ups, notes, screenshots and run data: CC BY 4.0, credited to Mark Barney / ARC
Explainer. Publish as a GitHub release in this repo and as a Hugging Face dataset card
(`arc-agi-3-public-games-annotated` or similar), with a README that says what each field is,
how the rules were verified, and the fairness note above. Version it by date, because the
files change weekly.

### Who consumes it first

1. arc-3's `ARC3-Inference/distill/`: add a loader for record type C (human runs joined to
   replays) and see how far it moves the 381-turn number. That is the measurable win.
2. arc-3's harness: the "arm C" rules-in-prompt experiment on the public 25, paired against
   the current baseline, so the number means something.
3. autoresearch-arena's game factory: the "rules in force per level" lists are a ready-made
   inventory of mechanics the public set already uses, which the differentiation loop is
   supposed to steer away from.

---

## Build order for the assistant that takes this

Each step is its own commit and changelog entry.

1. ~~Export script and JSON route.~~ **Done 18-Sep** as amended above: the route builds per
   request, no export script. The raw 64x64 grid is not added: arc-3 has the engine and can
   render any level's grid itself.
2. **Type additions.** `kind` is done. Left: a one-off migration of each game's `notes` into
   `corrections[]`, for the page's fold-out. Keep `notes` for undated text.
3. ~~Page rebuild.~~ **Done 18-Sep.** Components in `client/src/components/arc3/gamePage/`;
   the page file is layout only (1254 -> 415 lines). The level cut lives in
   `shared/arc3Games/gameLevels.ts` and is shared by the page, the dataset and the markdown
   export, which now also reads level by level. Differences from the mockup: no budget, no
   bars, no code links (amendments 3 and 4), and the mockup's dc22 level 6 "Notes from play"
   box is not there, because it was drawn from the prose `notes`, not from anything Boss said
   in saw / did / expected form.
4. ~~Re-render.~~ **Done 18-Sep.** dc22 level 6 was the only live-set gap; its engine render is
   back and Boss's capture sits beside it. (as66, withdrawn, has never had levels 1 and 2.)
5. **Curation pass, then dataset card and release.** Before anything is public: every
   record spot-checked against its page, every citation opened, every run GUID resolved
   against the replay corpus. Then README, licence, Hugging Face upload. Boss signs off.
6. ~~Hand-off note to arc-3.~~ **Done 18-Sep**: `tools/fetch_explainer_games.py` there carries
   the URL, the token and the record shape; its AGENTS.md repo map names arc-explainer as the
   only place the write-ups are edited.

## Verification

- `npx tsc --noEmit`: no new errors over the current baseline.
- Every game page renders every level with at least one image and the right rule count
  (sum of rules across levels equals the game's `mechanicsBreakdown.length`).
- The JSON route for dc22 returns 6 records; level 6 carries one engine render and one
  human capture; level 1 carries 8 rules and 0 new-on-level rules beyond those.
- The markdown at `/arc3/games.md` still renders and still contains every rule.
- Lighthouse on the page: no layout shift from the sticky strip, images lazy-loaded.

## Open questions for Boss

1. ~~JSON button public from day one?~~ Answered 18-Sep: **no.** Curate first, release later.
   The export runs, the route is admin-only, nothing is linked from the page.
2. ~~Hugging Face under your account or a shared org with Son?~~ Answered 18-Sep: Boss's
   own account, when the time comes. His words: that is the cart way ahead of the horse.
   We have not learned to use this data ourselves yet. Nobody spends time on the release
   until the in-house uses in Part 3 have produced a result.
3. ~~Boss's per-level actions on games he has not won?~~ Answered 18-Sep: **show them on
   every game page, won or not.** For an unwon game the level header shows his actions on
   the levels he reached and his furthest level; he is grinding out the last six (lf52,
   re86, sc25, sk48, sp80, tn36), so a later scorecard pull replaces the numbers in place.
