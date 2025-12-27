# 2025-10-23 Leaderboards Refactor Plan

## Goal
Replace the bloated `Leaderboards.md` page with a composable `Leaderboards.tsx` screen that reuses focused leaderboard components backed by MetricsRepository and AccuracyRepository data.

## Scope & Files
- `client/src/pages/Leaderboards.tsx`
  - Build new page composed of modular sections.
- `client/src/components/overview/leaderboards/*`
  - Create small presentational wrappers for summary cards, layout grid, and insight banners as needed.
- `client/src/hooks/useModelLeaderboards.ts`
  - Confirm hook provides required data (no code changes expected).

## Tasks
1. Design page layout with hero summary, accuracy focus, trust & reliability columns, and feedback insights.
2. Implement reusable subcomponents (summary grid, stat cards, insight banner) in `client/src/components/overview/leaderboards/`.
3. Wire components to real leaderboard data exposed by `useModelLeaderboards` (AccuracyRepository, MetricsRepository, FeedbackRepository).
4. Remove legacy `.md` view reference by replacing imports and ensuring routing uses new `.tsx` file.
5. Verify TypeScript builds and UI components compile via `npm run lint` (or equivalent quick type check).
