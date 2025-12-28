# 2025-12-01 – Poetiq Solver layout plan

## Goal
Deliver a reorganized Poetiq Solver UI that keeps the control inputs, solver state, and transparency panels in view without extreme scrolling or wasted spacing.

## Tasks & Target Files
1. **Page frame refresh (`client/src/pages/PoetiqSolver.tsx`)**
   - Replace the stacked container with a split layout (sticky control rail on the left, scrollable insights on the right).
   - Tighten hero/header padding, expose quick stats row, and ensure log/prompt panels share vertical space using CSS grid rather than serial stacking.
2. **Control panel compaction (`client/src/components/poetiq/PoetiqControlPanel.tsx`)**
   - Convert the cards into a two-column responsive grid with collapsible detail helpers so default height stays under ~60% viewport.
   - Normalize paddings/margins and keep start/cancel buttons pinned to the panel footer with subtle background.
3. **Supporting layout polish (same files as above)**
   - Standardize gap tokens, lighten backgrounds for training grids/logs so they visually belong to the new canvas, and cap scroll regions.
4. **Docs + bookkeeping (`CHANGELOG.md`)**
   - Record the redesign with a new semantic version entry noting both layout and spacing changes.

## Verification
- Manual: eyeball the JSX structure to confirm every major card now lives inside a bounded scroll container; ensure no stateful logic was removed.
- Optional local UI check (not run automatically here) once `npm run dev` is available.
