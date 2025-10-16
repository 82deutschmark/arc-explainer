*
* Author: Codex using GPT-5
* Date: 2025-10-09 18:56:31
* PURPOSE: Document ConceptARC dataset integration goals, dependencies, and SRP-aligned task plan referencing ARC-Heavy pattern and identifying reuse points across import scripts, loaders, types, backend services, and frontend filters.
* SRP/DRY check: Pass — This plan consolidates responsibilities for ConceptARC integration strategy without duplicating existing docs.
* shadcn/ui: Pass — No custom UI; references existing frontend patterns only at a planning level.

# ConceptARC Integration Plan

## Context
- ConceptARC resides in the `neoneye/arc-dataset-collection` repository alongside ARC-Heavy; files live under `dataset/ConceptARC`.
- ARC-Heavy integration is our precedent: import script, loader extension, type updates, validation, batch service wiring, and UI filters.
- Goal: treat ConceptARC as a peer dataset with consistent prioritization and selection behavior while preserving SRP in data ingestion and exposure layers.

## Objectives
- Import ConceptARC puzzles into `data/concept-arc/` with verifiable metadata and checksum logging.
- Extend shared types, loaders, and services to recognize `'ConceptARC'` as a valid source.
- Ensure backend filtering, validation, and batch services accept the dataset with no cross-domain leakage.
- Update frontend filter controls and styling to surface the new dataset without bespoke UI.
- Capture documentation and automation hooks for future dataset expansions.

## Assumptions & Constraints
- Dataset format mirrors ARC JSON schema (train/test grids). If deviations exist, we must normalize them inside the import script only.
- PostgreSQL schema remains unchanged; `source` metadata maps to new enum value.
- Existing priority ordering extends with the lowest priority slot unless ConceptARC demands different semantics.
- No Git submodule unless we need real-time sync; snapshot download should suffice for reproducibility and avoids submodule complexity.

## High-Level Tasks
1. **Dataset Analysis**
   - Inspect ConceptARC file structure, naming conventions, and metadata (e.g., `metadata.json` if present).
   - Confirm license compatibility and attribution requirements.
2. **Import Pipeline**
   - Clone or download concept dataset assets via new script `scripts/importConceptArc.ts`.
   - Implement checksum validation, retries, and logging consistent with `importArcHeavy.js`.
   - Store puzzles under `data/concept-arc/` with deterministic filenames.
3. **Shared Types & Loader**
   - Add `'ConceptARC'` to shared enums/interfaces (`shared/types.ts`).
   - Update `server/services/puzzleLoader.ts` data source list with priority and directory mapping.
4. **Backend Services**
   - Extend `puzzleService`, `puzzleFilterService`, and `BatchSessionManager` to acknowledge ConceptARC.
   - Update `enhancedValidation` dataset enum for batch endpoints.
5. **Frontend Exposure**
   - Update `usePuzzle` hook filter typings.
   - Adjust `PuzzleBrowser` (and any badge helpers) to include ConceptARC labeling and color token reuse.
6. **Regression Pass**
   - Run import script, verify counts and sample puzzle load.
   - Execute API smoke tests or targeted requests ensuring filters respond with ConceptARC data.
   - Manual UI check for filter dropdown and puzzle list rendering.
7. **Documentation & Automation**
   - Update `docs/EXTERNAL_API.md` if API exposes dataset as filter option.
   - Append ConceptARC row to integration reference tables.
   - Consider scheduled task or README note about refreshing dataset.

## Open Questions
- Does ConceptARC require specialized metadata (e.g., concept tags) that we should persist? If so, determine storage mapping.
- Should ConceptARC share priority with ARC-Heavy or sit below? Need clarity on default dataset ordering.
- Are there additional frontend views (Analytics dashboards) that rely on dataset enumeration, requiring updates beyond PuzzleBrowser?

## Next Steps
- Gather dataset details (Task 1) and confirm parity with ARC-Heavy assumptions.
- Draft import script leveraging existing `scripts/importArcHeavy.js` for structure.
- Prepare code updates following high-level tasks, preserving SRP across modules.

