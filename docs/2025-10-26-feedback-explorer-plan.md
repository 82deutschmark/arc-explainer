# Feedback Explorer Page Plan  Completed

**Date:** 2025-10-26 20:51 UTC
**Author:** Cascade (OpenAI GPT-4.1)

---

## 🎯 Goal
Deliver a dedicated `Feedback` page where researchers can browse, filter, and analyze human feedback tied to ARC explanations. The page will consolidate feedback records, summary statistics, and drilldowns by puzzle/explanation while reusing existing feedback hooks.

## 🧭 Current State
- `/feedback` route currently points to `PuzzleFeedback` ("Test Solution" UI) and lives in navigation under "Test Solution".
- Feedback data hooks exist (`useFeedback`, `useFeedbackStats`, etc.) but no standalone page visualizes them.
- Components `FeedbackSummary` and `FeedbackViewer` can render aggregate stats and lists but need orchestration.

## 🚨 Required Changes
1. **Routing & Navigation**
   - Introduce new `FeedbackExplorer` page at `/feedback`.
   - Move existing "Test Solution" experience to `/test-solution` (with optional `/:taskId`).
   - Update `AppNavigation` labels/links and any deep links pointing to `/feedback`.

2. **Feedback Explorer Page**
   - Layout: summary cards (stats), filters (puzzle/model/type/date range), paginated table/list, drilldowns linking to puzzle/explanation details.
   - Use shadcn/Card + existing feedback components; add new filter controls as needed.
   - Support API query params: `limit (<=10000)`, `offset`, `puzzleId`, `modelName`, `feedbackType`, `startDate`, `endDate`.
   - Display per-feedback metadata (model, confidence, comment, timestamp).

3. **API Integration**
   - Extend `useFeedback` hook to accept pagination & new filters (if missing) and expose `limit/offset` helpers.
   - Add helper for posting feedback? (Not required for read-only explorer right now.)
   - Ensure summary stats via `useFeedbackStats` and puzzle/explanation breakdown with existing hooks.

4. **UI Enhancements**
   - Build lightweight filter toolbar component (chips + inputs).
   - Provide pagination controls (respect 10k max) with `offset` increments.
   - Include quick navigation: click puzzle ID -> `/puzzle/<id>`, explanation -> `/discussion/<taskId>?explanationId=<id>` (confirm available route).

5. **Documentation & Changelog**
   - Update `docs/CHANGELOG.md` with new page + routing changes.

## 🧱 Implementation Steps
1. **Refactor Routing**
   - Duplicate `PuzzleFeedback` route under `/test-solution` (and `/:taskId`).
   - Adjust imports, navigation labels, and any references.

2. **Create Page Skeleton**
   - `client/src/pages/FeedbackExplorer.tsx` with header, summary section, filters placeholder, feedback list.
   - Wire `useFeedbackStats` + `FeedbackSummary` for overview.

3. **Build Filters & Data Controls**
   - Implement local state for filter inputs (puzzle ID, model, type, date range, limit).
   - Compose query params for `useFeedback` hook; handle `isLoading`, empty states.
   - Add pagination controls using offset/limit.

4. **Render Feedback Items**
   - Reuse `FeedbackViewer` for list; augment with table-style layout if needed.
   - Provide quick actions (navigate to puzzle/explanation).

5. **QA & Cleanup**
   - Verify navigation updates, route guards, document titles.
   - Update changelog and confirm linting/build unaffected.

## 📁 File Touch List
- `client/src/App.tsx`
- `client/src/components/layout/AppNavigation.tsx`
- `client/src/pages/FeedbackExplorer.tsx` *(new)*
- `client/src/pages/PuzzleFeedback.tsx` *(ensure compatibility with new route)*
- `client/src/hooks/useFeedback.ts` *(filter/pagination support if required)*
- `client/src/components/feedback/FeedbackViewer.tsx` *(optional enhancements for explorer view)*
- `client/src/components/feedback/FeedbackSummary.tsx` *(optional props for layout)*
- `docs/CHANGELOG.md`

## ✅ TODO Checklist
- [ ] Add `/test-solution` route, keep legacy functionality intact
- [ ] Build `FeedbackExplorer` page with stats, filters, feedback list
- [ ] Integrate pagination & filtering against feedback endpoints
- [ ] Refresh navigation labels/links
- [ ] Update changelog and run smoke checks

---

*Ready for implementation once reviewed/approved.*
