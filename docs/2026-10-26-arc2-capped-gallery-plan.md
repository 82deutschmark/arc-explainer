# ARC-2 capped-output gallery

Author: GPT-6.1 Sol / Codex
Date: 26-October-2026

## Scope and acceptance

The Boss requested a focused page for Lattice's named always-capped panel outputs. Add `/arc2/capped`, grouping the exact 22 zero-based test-output references into 20 tasks. Show the selected test inputs and known solution grids, grid dimensions and answer cell counts, expandable training examples and other tests, and links to the existing task pages. Keep the supplied first-task explanation link only on that task: `highlight` selects an explanation record, not a test index.

This is a reported cohort from eight FN first-pass `panel_v60` runs, not the earlier rerun no-grid denominator and not a claim that these tasks are universally unsolved. No inference, new runs, solver changes or invented trace data.

## Reuse

Reuse `usePuzzle` and the existing puzzle API, `GridDisplay`, `TrainingPairGallery`, page metadata, Wouter links and shadcn cards/alerts. No copied dataset, new backend endpoint or bespoke grid renderer. Work in an isolated SSD worktree to preserve the shared main checkout.

## Checklist

- [x] Inspect guidance, existing galleries, task API and highlight semantics.
- [x] Validate all 22 references against `data/evaluation2` (20 distinct tasks).
- [x] Implement focused gallery and route; update changelog.
- [x] Build and check exact cohort/test indices, then visually inspect desktop/mobile.
- [ ] Publish through existing main-branch deployment and verify delivered page.

## Verification

Production build passed; final frontend build passed after responsive-grid adjustment. Exact cohort validation passed against all 20 evaluation2 task files and 22 test indices. Browser checks rendered 20 task links and 22 selected sections; training expansion/collapse and task-anchor navigation passed. Desktop (1440px) and mobile (375px) screenshots inspected; mobile document width equals viewport and no selected grid crosses it. Local Vite emitted one development WebSocket connection warning, not an application error. Repository-wide TypeScript check fails in existing unrelated SnakeBench, ingest and test files; no errors reference the changed page or router.
