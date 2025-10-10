*
* Author: Codex using GPT-5
* Date: 2025-10-09 19:54:33
* PURPOSE: Capture the immediate ConceptARC integration cleanup work, focusing on aligning loader/service/front-end touchpoints with documented SRP/DRY guidance while finalizing ingestion script readiness without unnecessary logging systems.
* SRP/DRY check: Pass — Single responsibility planning doc referencing existing integration work; avoids duplicating instructions already tracked elsewhere.
* shadcn/ui: Pass — Documentation only; no UI components involved.

# ConceptARC Integration Cleanup & Validation Plan

## Situation Snapshot
- ConceptARC source enum is partially wired through loaders, filters, and shared types, but UI/source maps still miss the dataset.
- New import script (`scripts/importConceptArc.js`) exists yet needs verification for deterministic outputs and dataset parity.
- Frontend select inputs gained ConceptARC options but include PowerShell artifact literals (`` `r`n ``) that will render incorrectly.
- Grover progress hook logging was expanded but lost the `status: 'error'` transition, risking stuck "running" states.
- Model dataset analytics pages do not label ConceptARC cleanly because their display name maps stop at ARC-Heavy.

## High-Priority Tasks (Today)
1. **Sanitize UI Controls** — Remove literal `` `r`n `` artifacts from `PuzzleDiscussion` and `DifficultPuzzlesSection`; ensure ConceptARC option formatting matches shadcn/ui guidance.
2. **Restore Grover Error State** — Keep the enhanced logging but reinstate the `status: 'error'` transition so consumers behave correctly.
3. **Extend Dataset Display Maps** — Add ConceptARC to the dataset display map shared by `AnalyticsOverview` and `ModelBrowser` to prevent undefined labels.
4. **Loader & Script Verification** — Double-check `puzzleLoader`, `puzzleFilterService`, and `ingest-huggingface-dataset.ts` heuristics so ConceptARC flows mirror ARC-Heavy without cross-domain leakage.
5. **Documentation & QA Hooks** — Note ConceptARC coverage in existing docs if gaps remain after code fixes; schedule smoke checks (API filter calls + loader refresh) once code stabilizes.

## Validation Checklist
- [ ] `npm run lint` (or targeted TypeScript build) succeeds after modifications.
- [ ] Puzzle Browser, Discussion, and Analytics UI render ConceptARC without console warnings.
- [ ] Backend `/api/puzzles?source=ConceptARC` returns data when concept files exist.
- [ ] Import script run logs "ConceptARC puzzles are ready for ingestion." with accurate counts; no ingestion log table required.

## Risks & Watchouts
- Avoid duplicating dataset enums across files; always lean on shared types to satisfy DRY.
- Ensure ConceptARC priority remains at lowest precedence in `puzzleLoader` to preserve existing ordering logic.
- Respect existing SRP boundaries—do not blend ConceptARC-specific behavior into accuracy/trustworthiness repositories.

