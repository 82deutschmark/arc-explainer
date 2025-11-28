# 2025-11-28 – Poetiq Direct SDK Routing Fix Plan

## Goal
Fix the arc3 branch so that the Poetiq solver reliably calls external LLM APIs (especially OpenAI GPT-5.1 Codex Mini via the Responses API) using the new direct-SDK integration, with accurate token and cost tracking.

## Current State (arc3 vs main)
- Poetiq has been **internalized** into `solver/poetiq/` and no longer depends on LiteLLM.
- `solver/poetiq/llm.py` now routes to:
  - OpenAI Responses API (`llm_openai`)
  - Anthropic Messages API (`llm_anthropic`)
  - Google Gemini SDK (`llm_gemini`)
  - OpenRouter via OpenAI SDK (`llm_openrouter`)
  - xAI via OpenAI SDK (`llm_xai`)
- `server/python/poetiq_wrapper.py` now calls unified `llm()` and emits rich NDJSON events (prompt data, tokenUsage, cost, etc.).
- `server/services/poetiq/poetiqService.ts` supports **5 providers** and BYO API keys.
- `client` side has new Poetiq UI (Prompt Inspector, Reasoning Traces, BYO Key requirement).

## Symptom on arc3
- When running Poetiq with GPT-5.1 Codex Mini (or other direct models), **no calls appear on the provider dashboards**.
- From code inspection, we expect `llm_openai()` to be used for models like `gpt-5.1-codex-mini`, but something is preventing real network calls.

## Root Cause (code-level)
1. **BYO key enforcement** in `poetiqController.solve()`:
   - Now requires `req.body.apiKey`; no more silent fallback to server env keys.
2. **Env var expected by Python**:
   - `llm_openai()` in `solver/poetiq/llm.py` requires `OPENAI_API_KEY` in the **Python child process environment**.
3. **How keys are actually passed from TS → Python**:
   - `poetiqService.solvePuzzle()` builds `childEnv` and, if `options.apiKey` is present, maps it to one of:
     - `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`.
   - The mapping uses: `provider = options.provider || inferProviderFromModel(options.model)`.
4. **Front-end provider wiring is stale**:
   - `usePoetiqProgress.start()` always derives a `provider` (default `'openrouter'`).
   - `PoetiqSolver` and the Community auto-start logic still contain old behavior where an "OpenAI" selection was internally treated as **OpenRouter** (from the LiteLLM era).
   - For models like `gpt-5.1-codex-mini`, the body ends up with:
     - `model: 'gpt-5.1-codex-mini'` (direct OpenAI model)
     - `provider: 'openrouter'`.
5. **Mismatched view of provider**:
   - Python `llm()` uses `get_provider(model)` and correctly decides **`'openai'`** for `gpt-5.*` models.
   - But the TS service has set only `OPENROUTER_API_KEY` on the child env (because `options.provider` was `'openrouter'`).
   - Result: `llm_openai()` sees **no `OPENAI_API_KEY`**, raises internally, and retries/ultimately fails **before** any real OpenAI network call.
   - Errors are swallowed at the Poetiq loop level (other than debug prints), so from the outside it looks like "nothing is hitting the API".

## Design Decision
- **Do NOT revert to LiteLLM.**
- Keep the direct-SDK architecture and fix the **routing + key mapping** so that:
  - Direct models (`gpt-5.1-codex-mini`, `gemini/...`, `anthropic/...`, `grok-...`) rely on **model ID** to infer provider.
  - OpenRouter models (`openrouter/...`) explicitly use `provider = 'openrouter'`.
  - BYO key is always mapped to the correct `*_API_KEY` env var for the Python child process.

## Implementation Plan

### 1. Centralize provider inference on the backend
- Keep `PoetiqService.inferProviderFromModel(model)` as the canonical provider mapping.
- Ensure it is used for any case where `options.provider` is not explicitly needed.
- Provider mapping rules (already implemented):
  - `openrouter/...` → `'openrouter'`
  - `gpt-5*`, `o3-*`, `o4-*`, `gpt-4.1*` → `'openai'`
  - `claude*` / `anthropic` → `'anthropic'`
  - `gemini*` → `'gemini'`
  - `grok*` / `xai` → `'xai'`

### 2. Fix front-end → controller payload
- **File**: `client/src/hooks/usePoetiqProgress.ts`
- Change `start()` so that the request body behaves as follows:
  - Compute `model` as today (use existing defaults).
  - Compute `isOpenRouterModel = model.toLowerCase().startsWith('openrouter/')`.
  - Build `requestBody` with:
    - `apiKey`, `model`, `numExperts`, `maxIterations`, `temperature`, `reasoningEffort`.
  - **Only add** `provider: 'openrouter'` for `isOpenRouterModel === true`.
  - For **all other models (direct OpenAI, Gemini, Anthropic, xAI)**, **omit `provider`** so the backend uses `inferProviderFromModel(model)` and maps the BYO key to the correct env var.
- This removes the stale assumption that the UI-supplied `provider` is authoritative, while keeping OpenRouter routing explicit.

### 3. Keep PoetiqSolver UI behavior but stop influencing routing
- **File**: `client/src/pages/PoetiqSolver.tsx`
- The page will continue to:
  - Let users choose models (including `gpt-5.1-codex-mini`).
  - Require a BYO API key before enabling "Start".
- The routing decision for which SDK/env var to use will be **derived from the `model`** on the backend; no further front-end provider hacks are required.
- (Optional later enhancement): Add a visible provider badge selection to make it clear when a model is using direct OpenAI vs. OpenRouter routing, but this is cosmetic, not required for correctness.

### 4. Validate end-to-end behavior
1. **Happy path: GPT-5.1 Codex Mini (direct OpenAI)**
   - Model: `gpt-5.1-codex-mini`
   - BYO key: OpenAI key
   - Expected:
     - Controller accepts request (apiKey present).
     - `PoetiqService` sets `OPENAI_API_KEY` on child env via `inferProviderFromModel`.
     - Python `llm()` routes to `llm_openai`, which calls the Responses API.
     - OpenAI dashboard shows usage; Poetiq UI shows `provider: OpenAI`, `apiStyle: Responses API (Direct SDK)` in Prompt Inspector.
     - `tokenUsage` and `cost` fields are present in NDJSON events and in final result.

2. **OpenRouter Gemini model**
   - Model: `openrouter/google/gemini-3-pro-preview`
   - BYO key: OpenRouter key
   - Expected:
     - Front-end sends `provider: 'openrouter'` because the model starts with `openrouter/`.
     - `PoetiqService` maps key to `OPENROUTER_API_KEY`.
     - Python `llm()` routes to `llm_openrouter` using OpenRouter via OpenAI SDK.

3. **Direct Gemini / Anthropic / xAI models**
   - Models: `gemini/gemini-3-pro-preview`, `anthropic/claude-sonnet-4-5`, `grok-4-fast-reasoning`, etc.
   - Expected:
     - No `provider` field in request body; backend infers provider from `model`.
     - Correct `*_API_KEY` env var is set; Python routes to `llm_gemini`, `llm_anthropic`, or `llm_xai`.

### 5. Observability & Debugging
- Rely on existing logs:
  - TS service: logs available API key env names (`[Poetiq] Environment API keys available: [...]`).
  - Python wrapper: `get_api_routing()` prints routing info (`[OpenAI]`, `[OpenRouter]`, etc.).
  - `llm.py`: prints provider-specific log lines when calling each SDK.
- During testing, confirm that for GPT-5.1 Codex Mini runs:
  - TS service logs show `OPENAI_API_KEY` present in child env.
  - Python logs show `[OpenAI Responses API] Calling gpt-5.1-codex-mini...`.

### 6. Changelog & Documentation
- **Changelog**: Add `5.32.2` entry at the top of `CHANGELOG.md`:
  - Note: Poetiq direct-SDK routing fix for BYO keys and GPT-5.1 Codex Mini.
  - Mention that `poetiq-solver` git submodule was restored as a reference.
- **Docs**: This plan file serves as the implementation reference for this change.
