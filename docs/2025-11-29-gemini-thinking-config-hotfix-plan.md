# 2025-11-29 Gemini Thinking Config Hotfix Plan

## Goal
Stop Gemini runs from failing with `Unknown field for GenerationConfig: thinking_config` by only sending supported generation config fields for Gemini models.

## Target Files
- `server/services/gemini.ts` — build GenerationConfig safely for Gemini models.
- `solver/poetiq/llm.py` — align Python solver GenerationConfig with supported fields.
- `CHANGELOG.md` — record the hotfix with a semantic version bump.

## Tasks
1. Confirm current GenerationConfig fields and SDK support for Gemini requests.
2. Remove or gate `thinking_config` for models that reject it while keeping temperature/topP/candidateCount handling.
3. Mirror the safe GenerationConfig in the Poetiq solver to prevent retry loops for Gemini runs.
4. Update the changelog with the applied fix and touched files.

## Notes
- No mock data; keep production-ready defaults.
- Do not start the dev server; rely on static analysis for this hotfix.
