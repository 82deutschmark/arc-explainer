# Multi-model comparison UX plan

## Goal
Let analysts manage up to four models directly on the comparison page, reusing existing analytics components without duplicating logic.

## Key updates
- Promote dynamic model selection (add/remove) tied to the metrics comparison endpoint.
- Generalize summary rendering so cards work for more than two models.
- Surface per-model dataset insights via the existing `ModelPerformancePanel`.

## Target files & tasks
- `client/src/pages/ModelComparisonPage.tsx`
  - Hydrate selected models from comparison payload.
  - Integrate `useAvailableModels` and add UI for managing the model list.
  - Reuse fetching helper to refresh comparison data on add/remove.
  - Adjust summary and metrics sections to read from the dynamic model collection.
- `docs/2025-10-19-model-comparison-multi-model-plan.md`
  - Track rationale and scope (this document).

## Validation
- Manual walk-through: load page with two models, add a third, remove one, ensure data refreshes smoothly.
- Verify table, summary cards, and matrix reflect the expanded model set.
