# 2025-10-18 Leaderboards Refresh Plan

## Goal
Replace the deprecated leaderboards page with a production-ready dashboard that surfaces the real metrics computed in the repositories (accuracy, trustworthiness, reliability, speed, efficiency, feedback).

## Impacted Files
- `client/src/pages/Leaderboards.tsx`

## Tasks
1. Audit existing hooks (`useModelLeaderboards`, `usePerformanceInsights`) to confirm available metrics and shapes.
2. Design a new layout that highlights:
   - Overall trustworthiness, reliability, feedback satisfaction, confidence calibration gap.
   - High-risk overconfident models and dataset coverage numbers.
   - Trustworthiness, accuracy, feedback leaderboards (reuse existing modular components).
   - Technical reliability leaderboard (existing component).
   - Speed and efficiency leaderboards sourced from `/api/puzzle/performance-stats`.
3. Implement new `Leaderboards.tsx` with:
   - Required file header metadata per repo standards.
   - Consolidated loading/error handling across queries.
   - Metric summary cards and insight sections grounded in repository data.
   - Responsive layout using existing component library conventions.
4. Manually verify TypeScript compilation expectations (imports, types) and ensure new page reuses hooks/components without introducing mock data.
