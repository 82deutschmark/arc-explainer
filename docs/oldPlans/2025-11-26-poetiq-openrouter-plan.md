# 2025-11-26 – Poetiq OpenRouter plan

## Goal
Let the Poetiq solver default to OpenRouter (instead of direct Gemini) everywhere: CLI scripts, backend wrapper, and UI model selectors.

## Tasks & Target Files
1. **Model selection (client)**
   - `client/src/hooks/usePoetiqModels.ts`: add a tiny hook that calls `/api/poetiq/models` (returns LiteLLM-ready ids).
   - `client/src/components/poetiq/PoetiqControlPanel.tsx`: swap to the new hook, keep provider filtering, ensure defaults favour OpenRouter, and surface correct model ids in the POST body.

2. **Backend wrapper**
   - `server/python/poetiq_wrapper.py`: accept `OPENROUTER_API_KEY`, treat it as a valid credential, and default the model to the OpenRouter Gemini id when the client does not supply one.

3. **Batch/utility scripts**
   - `run-poetiq-batch.js`: update the `MODEL` constant and logging so ad‑hoc runs hit OpenRouter by default.

4. **Docs & Config**
   - `poetiq-solver/README.md`: document the `USE_OPENROUTER=true` toggle plus `OPENROUTER_API_KEY`.
   - `CHANGELOG.md`: record the change (Poetiq now routes through OpenRouter by default, docs updated, wrapper accepts the key).

5. **Verification**
   - Re-run `rg`/lint checks manually (no automated tests) and spot-check that provider dropdowns still populate with consistent ids.
