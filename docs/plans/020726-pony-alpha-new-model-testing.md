# 020726-pony-alpha-new-model-testing

## Objective

Create a reusable Python testing pipeline for evaluating new OpenRouter models.
First target: `openrouter/pony-alpha` (cloaked model, free, likely a major Frontier Lab release).

## Opponents (Worm Arena Baselines)

| Model Slug | Type | Notes |
|---|---|---|
| `openai/gpt-5-nano` | Paid (cheap) | Anchor model, strong baseline |
| `openai/gpt-5-mini` | Paid (cheap) | Mid-tier reasoning |
| `nvidia/nemotron-3-nano-30b-a3b:free` | Free | Strong free model |
| `x-ai/grok-4.1-fast` | Paid (cheap) | Fast reasoning model |

## Deliverables

### 1. Model Registration
- Add `openrouter/pony-alpha` to `OPENROUTER_MODEL_KEYS` in `server/config/openrouterModels.ts`
- Add minimal catalog entry to `server/config/openrouter-catalog.json`

### 2. Worm Arena Tournament Script (`scripts/worm-arena-tournaments/new-model-eval.py`)
- **Reusable** Python script that takes a new model slug via CLI arg
- Runs the new model against all baseline opponents in both directions
- Calls `/api/snakebench/run-batch` (same pattern as `glm47.py`, `champion-vs-field-tournament.py`)
- Supports `--dry-run`, `--count`, `--base-url`, etc.
- ThreadPoolExecutor for parallel pairings

### 3. ARC Puzzle Analysis Script (`scripts/analysis/analyze-new-model.py`)
- **Reusable** Python script that sends ARC puzzles to a new model via the server API
- Calls `/api/puzzle/analyze/{puzzleId}/{modelKey}` then `/api/puzzle/save-explained/{puzzleId}`
- Pulls puzzle IDs from `/api/puzzle/list` (ARC1-Eval, ARC2-Eval sources)
- Skips puzzles that already have explanations from the target model
- Rate-limited to avoid overwhelming the server
- Supports `--model`, `--source`, `--limit`, `--base-url` CLI args

## Architecture Notes

- Worm Arena allowlist: `server/services/snakeBench/helpers/modelAllowlist.ts` reads from `MODELS`
- `MODELS` export in `models.ts` merges `STATIC_MODELS` (non-OpenRouter) + `OPENROUTER_MODELS` (catalog-driven)
- New OpenRouter model must be in both `OPENROUTER_MODEL_KEYS` and `openrouter-catalog.json`

## File Changes

| File | Change |
|---|---|
| `server/config/openrouterModels.ts` | Add `openrouter/pony-alpha` to `OPENROUTER_MODEL_KEYS` |
| `server/config/openrouter-catalog.json` | Add minimal catalog entry |
| `scripts/worm-arena-tournaments/new-model-eval.py` | NEW - Reusable Worm Arena tournament script |
| `scripts/analysis/analyze-new-model.py` | NEW - Reusable ARC puzzle analysis script |
| `docs/plans/020726-pony-alpha-new-model-testing.md` | This plan |
