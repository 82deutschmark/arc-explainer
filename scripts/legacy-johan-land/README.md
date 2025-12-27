# Author: Cascade (OpenAI GPT-4o)
# Date: 2025-12-24
# PURPOSE: Document Johan_Land solver verification utilities relocated from repo root.
# SRP/DRY check: Pass - consolidates legacy scripts without altering behavior.

## Johan_Land Legacy Checks

This folder holds the one-off `.mjs` utilities originally used to sanity-check the Johan_Land solver imports. They share the same assumptions:

- connect directly to `DATABASE_URL` via `pg`
- inspect `explanations` rows where `model_name ILIKE 'Johan_Land_Solver_V6%'`
- validate pair counts, ingestion correctness, or reproduce leaderboard scoring numbers

Scripts include:

- `calc_per_puzzle_score.mjs` – recomputes per-puzzle accuracy from DB attempts
- `verify_pairs.mjs` – confirms total pair distribution vs. official 71.29% score
- `trace_validation.mjs` – cross-checks DB rows against Beetree submission JSONs
- `check_*.mjs` – assorted LIMITed queries for quick diagnostics

They are intentionally isolated from the main build. Run them manually as:

```bash
node ./scripts/legacy-johan-land/calc_per_puzzle_score.mjs
```

> **Note:** none of these scripts are referenced by `package.json`; keep them here (or delete) once the historical investigation is finished.
