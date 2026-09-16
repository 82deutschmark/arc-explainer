<!--
Author: Claude Opus 5
Date: 2026-09-16
PURPOSE: Plan for the ARC-AGI-3 game-page glow-up the owner asked for on 16-Sep-2026 while
         playing through the 25 public games: a full bullet list of every mechanic found in
         each game's code, action counts up top on every game page, two human difficulty
         ratings (top-10 board and the owner's own scorecards, both with old data cut out),
         and the "this is the tutorial" framing on the 25-game index page.
SRP/DRY check: Pass -- plan only. Builds on shared/arc3Games (registry),
         server/services/arc3/arcPrizeLeaderboardService.ts (live top-10 board),
         client/src/pages/Arc3GameSpoiler.tsx and Arc3GamesIndex.tsx (the two pages).
-->

# ARC-3 game pages glow-up — 16 Sep 2026

## What the owner asked for (restated)

1. **Every mechanic, as bullets, on every game page.** Pulled from the game code, not guessed
   from sprite names. The plain-English paragraph stays as the short version; the bullets are the
   complete list. Mechanics that only show up on a later level get called out under that level
   ("New on level 2"). The owner keeps finding things the pages miss — for example:
   - **TU93:** level 2 introduces the red enemy figure with a purple dot. Walk into it head-on
     and it bites and kills you; come at it from the side and you bite it and destroy it. The
     current page doesn't mention this.
   - **SU15:** a click shows a brief animation of the suction radius. Nothing on the page explains
     that animation, or that two same-size objects inside the radius join into the bigger one.
2. **Action counts up top on every game page.** What it takes, in actions, right under the title.
3. **Two human difficulty ratings instead of one:**
   - **Top 10:** from the ARC Prize human leaderboard. Show the spread for the top 10: scores
     (currently all 100 on every board checked, and the page will say so plainly) and action
     counts (fewest, median, most). The rating comes from the action spread. **The "2 or more
     resets in the top 10 = hard" rule is removed.** That rule alone is why TU93 reads "hard."
   - **Owner:** calibrated to the owner's own scorecards ("pretty damn average"), plus any other
     human scorecards we get later.
4. **No old data.** Anything older than **90 days (before 18 Jun 2026)** is dropped, and scorecards
   must be on the current game build. This applies to the owner's scorecards and to top-10 rows.
   The page shows how many top-10 rows survived the cut.
5. **The 25-game index page** says plainly that these 25 games are the tutorial for the private
   set, quoting François Chollet. The set doesn't cover everything the private set will have, but
   someone who learns these should do okay on it. **The quote must be real:** if the exact wording
   can't be found with a source, it's paraphrased without quote marks and flagged to the owner.

## Out of scope (owner's call, 16 Sep)

- **AI difficulty.** It needs a smarter method than one Astra run or our own arena data, but the
  owner said to leave AI run data alone for now. The `aiDifficulty` badge is not touched here.

## Work split

Agents run in parallel. The shared type (`MechanicPoint`, `mechanicsBreakdown` in
`shared/arc3Games/types.ts`) was added before the agents started, so no two agents edit the same
file.

| Agent | Owns | Must not touch |
| --- | --- | --- |
| Mechanics A–E (5 agents, 5 games each) | `shared/arc3Games/<id>.ts` for their 5 games: adds `mechanicsBreakdown`, fixes wrong or missing text in `description` / `simpleExplanation` / `mechanicsExplanation` | any other game's file, pages, types |
| Human data | new generator script, new generated data file, pure difficulty functions in `shared/arc3Games/humanDifficulty.ts`, leaderboard service recency + stats | per-game `.ts` files, pages |
| Pages | `Arc3GameSpoiler.tsx` (action strip, two human badges, mechanics bullets), `Arc3GamesIndex.tsx` (tutorial framing) | per-game `.ts` files, data scripts |

The pages agent runs after the human-data agent, because it renders what that agent produces.

### Mechanics agents — rules

- Read the live build's source: `external/ARCEngine/environment_files/<id>/<hash>/<id>.py`. Live
  hashes are in `GAME_HASHES` in `scripts/arc3/render_public_demo_levels.py`.
- Every bullet must be confirmed in code: step(), win and lose checks, per-level data, and
  collision/interaction code. Cite `file:line` in `source`. Where a claim can be run, run it in the
  engine (instantiate the class, `set_level(n)`, `perform_action`), the same way s5i5 level 5 was
  checked.
- Mark `introducedOnLevel` by checking which level data actually contains the piece or rule.
- Cover what a player can see and use: controls, goal, every piece type and what touching it does
  (from every direction where direction matters), hazards and enemies, budgets, lives, resets,
  whether undo exists, and on-screen feedback such as animations, flashes, and bars.
- Owner reports (TU93 side-bite, SU15 radius animation) must be confirmed in code before they go
  in. If the code says something different, write what the code says and flag the difference.
- Don't rewrite work another agent just committed (su15 and s5i5 got owner-verified rewrites
  today). Add what is missing.
- **Games already reviewed against a human run keep their facts:** s5i5, su15, ls20, lp85, m0r0,
  ka59, cn04, cd82, dc22, g50t.
- Don't rename games. Don't touch difficulty fields.

### Human data agent — rules

- **Owner scorecards:** pulled with the existing cookie flow (`~/bubba-workspace/tools/arc3/pull_boss_scorecards.py`
  shows the endpoints; the cookie lives outside the repo and never gets committed). Keep runs with
  actions > 0, `open_at` on or after 2026-06-18, and a build hash matching the live build. Commit
  only game, build, guid, state, levels, actions, resets, score, per-level actions and baselines,
  and `open_at`. No user id, no cookie.
- **Top 10:** live from the existing leaderboard service. Add row dates and the recency cut, plus
  score spread and action spread (fewest, median, most, relative spread).
- **Ratings:** pure, exported, and unit-tested.
  - Top-10 rating uses the action spread of recent rows only, with no reset rule.
  - Owner rating is calibrated to the owner's own median across the games he has played: actions
    against ARC's per-level baseline, plus failed runs before the win. It says "not played yet"
    where there's no recent run.
- **ARC baseline actions** per game come from `environment_files/<id>/<hash>/metadata.json`
  (`baseline_actions`).

### Pages agent — rules

- **Game page:** a stat strip right under the title with ARC baseline actions, fewest human
  actions (top 10), top-10 median, and the owner's actions. The badges become "Human (top 10)",
  "Human (owner)" and "AI" (unchanged). A "Every mechanic" bullet card sits right after In Plain
  English, grouped by level.
- **Index page:** the tutorial framing near the top, with the quote rules above.
- Use shadcn/ui, and no new fetches beyond the existing leaderboard route. Check with tsc, not the
  browser.

## Verification

- `npx tsc --noEmit -p tsconfig.json`: the baseline is 12 errors, and there must be no new ones.
- `npx vitest run tests/unit`, including the new difficulty-function tests.
- Mechanics claims are checked in source by the agent that writes them, with engine runs where
  practical. The main loop spot-checks TU93 and SU15, the two the owner flagged.

## Docs and changelog

- One CHANGELOG entry at the top (next minor after the current top), listing every file.
- Commit and push when done. Pull and rebase first, because another agent is committing in this
  tree.
