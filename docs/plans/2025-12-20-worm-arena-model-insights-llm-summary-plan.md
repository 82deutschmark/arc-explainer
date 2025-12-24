Author: Codex (GPT-5)
Date: 2025-12-20
PURPOSE: Plan to add an OpenAI Responses API summary step to the Worm Arena model insights report.
SRP/DRY check: Pass - planning only, no code.

# Worm Arena Model Insights LLM Summary Plan

## Goals
- Add a short, readable LLM summary for the model insights report.
- Use OpenAI Responses API directly with GPT-5 Nano.
- Handle LLM failures gracefully without blocking the report.

## Decisions
- Summary format: one short paragraph, no bullets or headings.
- Failure behavior: show report even if LLM summary fails.

## Files to touch
- `server/services/snakeBenchService.ts`
- `shared/types.ts`
- `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`
- `docs/reference/data/WormArena_Model_Insights_Report.md`
- `CHANGELOG.md`

## Tasks
1. Add a small OpenAI summary helper that builds a prompt from existing stats.
2. Extend the insights report payload to include `llmSummary` and `llmModel`.
3. Render the summary inline on the Models page report card with a fallback message.
4. Update documentation and changelog entry.
