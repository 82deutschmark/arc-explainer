# 2025-12-15 – Scoring Fix Plan (ARC Harness Alignment)

## Goal
Align scoring with the official ARC-AGI benchmarking harness (pair-based accuracy per task) and update the `/scoring` page copy to clearly explain the correct methodology.

## Files to touch
- `server/repositories/MetricsRepository.ts` (attempt union stats computation, surface pair-based accuracy)
- `client/src/pages/HuggingFaceUnionAccuracy.tsx` (use backend attempt union stats and update page copy)
- `client/src/utils/modelComparison.ts` (fallback union computation interface alignment)
- `client/src/components/analytics/ModelComparisonDialog.tsx` (display corrected pair-based stats)
- `client/src/pages/ModelComparisonPage.tsx` (display corrected pair-based stats)
- `client/src/pages/AnalyticsOverview.tsx` (types for attempt union stats)
- `shared/types.ts` (AttemptUnionStats alignment if shared there)
- `CHANGELOG.md` (semantic version bump with summary)

## Todos
1. Update backend attempt union stats to count correct test pairs (any attempt correct) and include total test pairs.
2. Prefer backend attempt union stats in the `/scoring` page; fallback to client computation only if backend data is missing.
3. Refresh user-facing copy on `/scoring` to describe pair-based scoring per the ARC-AGI harness.
4. Adjust UI components to display pair counts and percentages using total test pairs.
5. Bump changelog (top) with version + summary of scoring alignment and copy updates.
