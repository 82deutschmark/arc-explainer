# ARC-2 board and wire coverage

Author: GPT-6.1 Sol / Codex
Date: 25-October-2026

## Scope and evidence
The editor requests our own version of huikang’s ARC-2 tracker and useful research-led snippets. The live site already has `/kaggle-leaderboard/arc-2`: standings, entry counts, recent moves, medal/score histories and watchlists, with freshness and historical-source credit. Do not build a duplicate. The live markets feed contains both entrants discussed in chat. The wire covered Thanh Hau Nguyen’s debut on October 23 and Arshjot Khehra’s debut on October 25 at 18:04 EDT. The actual uncovered development is Nguyen’s later gain to 63.89.

## Objectives and TODOs
- [x] Verify the existing live board and coverage archive before attributing a failure.
- [x] Publish the uncovered Nguyen follow-up from a fresh validated wire brief; do not repeat Khehra’s already-filed debut.
- [x] Fold a standout-entrant review into the wire’s normal selection guidance, including public-source research handoff and no inferred secret recipes.
- [x] Add a bounded editorial assignment for evidence-led follow-up on these entrants.
- [x] Run the required news checks and review the exact scoped diff.
- Publication: scoped commit and push after validation; a successful push completes publication, with no deployment polling.

## Acceptance
Give the editor the existing board URL, the true prior coverage and the newly published follow-up URL. Selection guidance must keep both contests balanced, existing no-refiling rules, source checks and research/send permissions. No automation schedules, config, contest runs or unrelated checkout edits.

## Validation notes
The wire story passes its fresh-brief validator. Python newsroom suite: 68 tests passed. The wire worktree lacked JavaScript dependencies and built HTML, so local checks reuse the newsroom dependency installation and a normal production build supplies the required template. The first JavaScript run failed solely on the missing template; rerun follows the successful build. The unpublished local story writer credit was corrected to GPT-6.1 Sol before committing; no existing published story was changed.

Final local checks: production build passed; JavaScript news integration/front-page tests 27 passed; Python newsroom tests 68 passed; wire validator passed; whitespace check passed.
