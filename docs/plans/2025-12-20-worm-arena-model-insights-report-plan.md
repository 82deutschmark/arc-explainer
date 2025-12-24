Author: Codex (GPT-5)
Date: 2025-12-20
PURPOSE: Plan for adding a per-model actionable insights report on the Worm Arena Models page, with inline display, copy, save, and Twitter share options using full match history.
SRP/DRY check: Pass - plan only, no implementation.

# Plan

Build a per-model actionable insights report that runs on demand from the Worm Arena Models page, uses full history data, and renders inline with copy, save, and Twitter share actions.

## Requirements
- Add an inline report section on `client/src/pages/WormArenaModels.tsx` with a Generate Report button.
- Use full match history for the selected model.
- Show failure modes with the most common loss reasons.
- Include copy, save, and Twitter share actions for the report.
- Keep UI controls hidden while the report is generating.
- Update docs and `CHANGELOG.md` for the new endpoint and UI behavior.

## Scope
- In: API endpoint, repository aggregation, shared types, client hook, and UI report panel.
- Out: new DB schema fields unless approved later.
- Out: streaming report generation for this iteration.

## Files and entry points
- `client/src/pages/WormArenaModels.tsx`
- `client/src/hooks/useWormArenaModels.ts`
- `client/src/components/wormArena/WormArenaModelInsightsReport.tsx` (new)
- `server/controllers/snakeBenchController.ts`
- `server/services/snakeBenchService.ts`
- `server/repositories/SnakeBenchRepository.ts`
- `server/routes.ts`
- `shared/types.ts`
- `docs/reference/data/WormArena_Model_Insights_Report.md` (new)
- `CHANGELOG.md`

## Data and metrics
- Summary: games played, wins, losses, ties, win rate, total cost, cost per game, cost per win, cost per loss.
- Performance: average rounds, average score, average death round for losses.
- Failure modes: loss counts by `death_reason` plus unknowns.
- Opponent pain points: top opponents by losses with loss rate and last played.
- Data quality: loss death-reason coverage and unknown loss count.

## Action items
- Add repository aggregation queries for per-model insights.
- Add service formatter to build report markdown and tweet text.
- Add controller route for `GET /api/snakebench/model-insights?modelSlug=...`.
- Add shared response types and client hook to fetch report on demand.
- Add inline UI report card with actions for copy, save, and Twitter share.
- Update docs and changelog with the new endpoint and UI behavior.

## Validation
- Call the endpoint for a model with known history and confirm totals.
- Confirm the UI generates, displays, and copies the report text.
- Confirm the save link downloads a markdown file.
- Confirm Twitter share link opens with a short summary.
