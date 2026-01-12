# 2026-01-12 OpenRouter Model Coverage Plan

**Author:** Cascade (ChatGPT)
**Date:** 2026-01-12
**Goal:** Determine which leaderboard models are missing from our OpenRouter catalog configuration and outline remediation steps.

## Context
Recent OpenRouter catalog changes removed or renamed certain models (e.g., DeepSeek variants). The Worm Arena leaderboard still lists the historical set. We must compare the leaderboard inventory against `server/config/openrouterModels.ts` (driven by `OPENROUTER_MODEL_KEYS`) to identify gaps and recommend sync actions.

## Objectives
1. Enumerate the authoritative OpenRouter model list currently shipped with the app (from `OPENROUTER_MODEL_KEYS`).
2. Compare the leaderboard models provided by the user against that list.
3. Classify differences (missing entirely, renamed, deprecated, new leaderboard-only, etc.) and propose follow-up actions (catalog sync, slug updates, or leaderboard refresh).

## Tasks
### Phase 1 – Coverage Analysis (complete)
- [x] Extract `OPENROUTER_MODEL_KEYS` and normalize aliases (if any) in `OPENROUTER_ID_ALIASES`.
- [x] Build a structured leaderboard model list from the user-provided ranking (normalize slugs for comparison).
- [x] Compute set differences (leaderboard - OpenRouter list) and annotate each missing slug with mapping/rename hints.
- [x] Summarize findings, including actionable recommendations for updating OpenRouter config and/or leaderboard data sources.

### Phase 2 – Catalog Updates (in progress)
- [x] Pull/confirm the current `openrouter-catalog.json` snapshot and capture pricing/context metadata for each missing slug:
  - `amazon/nova-2-lite-v1`
  - `nex-agi/deepseek-v3.1-nex-n1`
  - `deepseek/deepseek-v3.2-exp`
  - `anthropic/claude-sonnet-4-5`
  - `google/gemma-3n-e2b-it`
  - `x-ai/grok-4-fast`
  - `openai/gpt-4.1-nano`
  - `google/gemini-2.0-flash-exp`
  - `deepseek/deepseek-r1-0528`
- [x] Update `OPENROUTER_MODEL_KEYS` to add the missing slugs (preserving alphabetical/logical grouping) and remove the `:free` suffix from `kwaipilot/kat-coder-pro`.
- [ ] Regenerate model configs via `buildOpenRouterModels` (ensuring catalog contains the added slugs) and verify pricing/metadata render correctly.
- [ ] Run existing OpenRouter health scripts or minimal validation (e.g., `scripts/testing/test-openrouter-models.ts`) to ensure no regression.
- [ ] Update documentation + `CHANGELOG.md` with the new model coverage and rationale.

## Deliverables
- Written summary back to the user covering:
  - Missing leaderboard models (with categories)
  - Any suspected renames/retirements
  - Recommended next steps (e.g., rerun catalog sync script, update Worm Arena dataset, or request user confirmation).
- No code changes are planned unless follow-up work is requested.
