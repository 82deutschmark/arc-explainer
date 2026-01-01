# 2025-12-31 – RE-ARC Dataset Viewer Plan

**Goal**: Ship a lightweight, read-only page that lets users visually browse every task from `REARC2026.json` without touching solver or leaderboard workflows.

## Context
- Users already generate/download the RE-ARC dataset but cannot inspect it inside the app.
- Existing ReArc page focuses on generation/evaluation; we only need a viewer.
- `REARC2026.json` lives in repo root (~812 KB) so client-side fetch is acceptable.

## Scope
1. **Backend**: Add a single GET endpoint `/api/rearc/tasks` that streams/parses `REARC2026.json` and returns `{ success, data }` with the dataset map.
2. **Frontend Data Hook**: `useReArcDataset` (TanStack Query) to fetch/cache dataset and expose helper metadata (counts, sorted task IDs).
3. **Viewer Page**: New `/re-arc/dataset` page with:
   - Hero + download link.
   - Search by task ID (substring match).
   - Toggle for showing test inputs.
   - Responsive grid of task cards (train previews always visible, test previews optional).
   - Reuses existing grid components for consistency.
4. **Navigation**: Add CTA button on `/re-arc` explaining “View generated dataset” + router entry.
5. **Docs & CHANGELOG**: Document endpoint + route addition.

## Non-Goals
- No filters/sorting beyond simple search.
- No solver integration or submission flows.
- No mutation of dataset; strictly read-only.

## Implementation Outline
1. **Backend**
   - Extend `server/controllers/reArcController.ts` with `getTasks` that reads JSON once per request (use cached Promise if file access becomes hot later).
   - Register route in `server/routes.ts` (`app.get('/api/rearc/tasks', ...)`).
2. **Frontend Hooks & Types**
   - `client/src/hooks/useReArcDataset.ts`: fetch, map to sorted entries, expose helpers (filteredTasks, counts) based on search/toggles supplied by caller.
3. **UI Components**
   - `client/src/components/rearc/ReArcTaskCard.tsx`: small card showing task ID, mini grid previews (train input/output, optional test inputs), metadata badges (train/test counts, max dimensions).
4. **Viewer Page**
   - `client/src/pages/ReArcDataset.tsx`: uses hook + card component; includes hero copy + info alert referencing data provenance and download link to `/REARC2026.json`.
5. **Navigation Updates**
   - `/re-arc` page: add button linking to `/re-arc/dataset` near hero.
   - `App.tsx`: register route.

## Risks & Mitigations
- **Large render cost**: use CSS grid + `React.memo` + lazy grid render (only render TinyGrid when card visible).
- **JSON fetch latency**: show skeleton spinner until hook resolves.
- **Test outputs spoiler**: default toggle off, copy clarifies outputs remain hidden unless user opts in.

## Validation
- Manual QA: open `/re-arc/dataset`, confirm dataset loads, search works, toggle shows tests, cards link to `/task/:id`.
- Ensure no console errors and network call returns 200.

## TODOs
1. Backend endpoint + route wiring.
2. Hook + component + page + route + CTA.
3. Docs & CHANGELOG updates; smoke test viewer locally.
