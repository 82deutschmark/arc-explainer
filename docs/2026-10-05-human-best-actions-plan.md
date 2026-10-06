# Best known human action counts

Author: GPT-6 / Codex
Date: 2026-10-05

User authorized publishing the chart to both ARC Explainer and arc3.sonpham.net.

## Scope

- Publish a dated, self-contained `/human-records.html` snapshot of all 25 public game records, linked from the official games index.
- Reuse the official human endpoint already documented by `arcPrizeLeaderboardService.ts`: POST `/api/leaderboards/<id>` with `ai: false`.
- Take the minimum actions only from rows with score 100 and end state WIN. Display no baseline or median; a missing result must never be replaced by either.
- Sort ascending, calculate differences from the shortest game, and show joint record holders from the returned top ten.
- Preserve exact upstream rows as downloadable JSON. The same verified page and JSON are published in arc-3; this is a dated snapshot, not an automatic updater.
- Explain that the records are best known, not a proof of theoretical optimality; this endpoint supplies no per-level action counts.

## Validation

- [x] Independently re-fetched all 25 human boards; every count agrees with the earlier browser extraction.
- [x] Recomputed every rank and difference. Total 5,502 matches the aggregate leaderboard leaders' displayed total.
- [x] Verified all 25 rendered rows, direct source links, expandable record holders, identical downloadable evidence, and desktop/360px layout without horizontal overflow.
- [x] ARC Explainer production build passed; arc-3 shell syntax and both Git whitespace checks passed.

## Publication

Both repositories deploy from production `main`. Destinations: `https://arc.markbarney.net/human-records.html` and `https://arc3.sonpham.net/human-records.html`. The arc-3 page has one exact public route; no private route or data access changes.

## Follow-up: compact chart

Boss requested a chart about games, not the people who played them. Removed the 25 record-holder disclosures and their names, tightened the rows, and reduced the explanatory copy. Both pages retain the same counts and differences. Additional verification was skipped at the user’s request.

## Follow-up: human average

Added the arithmetic mean of score 100 / WIN action counts in each saved top-10 human leaderboard. Display uses whole-action half-up rounding; bars use the unrounded mean and share a scale with the best counts. Scope is explicitly top-10 winning entries, not all humans. No further verification pass requested.

## Comparison correction

The useful gap is within each game: displayed top-10 average minus best. Removed the cross-game r11l comparison and named the top-10 scope directly in the column.

## Follow-up: AI comparison

Fetched the task pages' public POST `/api/models` source for all 25 games, using the observed request schema (`game_id`, empty `models`, `runners`, `configs`). Stores all returned runs in the adjacent JSON snapshot. Displays the best verified published score per model/game, with all metrics taken from that run and its replay; ties use fewer actions then session ID. Model configurations may vary, so these are best published results rather than one controlled configuration across all games. Six named model columns show initially and all 16 can be selected. Human action counts remain alongside the AI columns. Scores are action efficiency; completed levels and WIN are separate. No deployment polling or post-push verification, as requested.

## Iteration: useful comparisons

The page now uses shared `static/human-ai-comparison.css` and `.js` assets on both sites, reading the existing dated source snapshots.

- Separate highest-score and fewest-winning-actions modes. A partial or failed run can never enter the winning-actions comparison.
- Sort any human/model column using unrounded values. Show the additional AI winning actions relative to the human best for that same game.
- Model-specific configuration selectors support fixed settings across games, while Best available retains the published-record comparison.
- Filter by human action budget, game ID, and win coverage among selected models. Missing configurations do not become evidence of failure. Header win counts cover all available games for that setting.
- Inspect every published configuration in a dialog, with exact score, completion, actions, date, game version and replay. Highlight the run supplying the cell; explicitly flag cases where a higher-scoring partial run hides another winning run.
- Preserve the comparison in URL parameters for reopening/sharing. Keep model names and game IDs visible while scrolling, and remove the need for hover to discover configurations.
- No deployment polling or post-push verification. This is the first requested improvement pass, ready for further user feedback.
