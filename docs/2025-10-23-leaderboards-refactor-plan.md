# Leaderboards Page Refactor Plan

## Objective
Rebuild the `Leaderboards` page as a modular React layout that sources live model performance metrics from the Metrics and Accuracy repositories. Replace the previous monolithic page (now Markdown) with composable, SRP-friendly components that present accuracy, confidence, and trend insights clearly.

## Key Files to Update / Create
- `client/src/pages/Leaderboards.tsx` (new React page)
- `client/src/components/leaderboards/AccuracyOverviewCard.tsx` (new)
- `client/src/components/leaderboards/ModelPerformanceTable.tsx` (new)
- `client/src/components/leaderboards/ModelTrendChart.tsx` (new, wraps existing chart utils if available)
- `client/src/components/leaderboards/ConfidenceDistributionCard.tsx` (new)
- `client/src/hooks/useLeaderboardMetrics.ts` (new hook to aggregate data)
- `client/src/constants/leaderboard.ts` (new shared constants/enums)
- `client/src/types/leaderboards.ts` (new shared types for the page)
- `client/src/index.css` or component-level styles if DaisyUI classes insufficient (avoid unless required)

## Tasks
1. **Audit existing data hooks**: Review current metrics hooks/components (e.g., `client/src/components/overview/leaderboards/*`, `hooks/useMetrics.ts`) to reuse API calls aligned with `MetricsRepository` and `AccuracyRepository`.
2. **Design data layer**: Build `useLeaderboardMetrics` hook that calls `/api/metrics/aggregated`, `/api/feedback/accuracy-stats`, and any accuracy endpoints to fetch model stats. Normalize responses into shared types.
3. **Define types/constants**: Introduce TypeScript interfaces and enums that describe leaderboard cards, table columns, and thresholds (pulled from `server/constants/metricsConstants.ts` where possible).
4. **Create modular components**: Implement individual cards/tables for accuracy overview, trustworthiness/confidence, and performance trends using DaisyUI/Tailwind utilities.
5. **Compose new page**: Assemble the new `Leaderboards.tsx` using the components and hook, ensuring loading/error states and responsive layout.
6. **Remove old page references**: Update routing/imports so the app uses the new `Leaderboards.tsx` instead of the Markdown placeholder.
7. **Testing**: Run relevant lint/build commands (e.g., `npm run lint`, `npm run test -- --watch=false`) to verify no regressions.

## Open Questions / Follow-ups
- Confirm whether trend data already exists in Metrics APIs; if not, limit scope to static aggregates with TODO referencing data gaps.
- Validate DaisyUI components available for charts; reuse existing chart wrappers (`client/src/components/charts/*`) if necessary.

