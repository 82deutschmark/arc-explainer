---
Title: OpenAI Reasoning Models – Project Audit & Best Practices
Date: 2025-08-25
Author: Cascade
---

# Summary
- Purpose: Document OpenAI reasoning model guidance (GPT-5, o3/o4) and audit our implementation.
- Scope: Responses API usage, reasoning params, token/cost control, context management, summaries, and incomplete handling.

# OpenAI Reasoning Model Essentials
- __API__: Use Responses API (`openai.responses.create`).
- __Reasoning effort__: `reasoning: { effort: minimal|low|medium|high }` (default `low`). Tradeoff: speed/cost vs completeness.
- __Reasoning tokens__: Counted as output tokens, not visible; see `usage.output_tokens_details.reasoning_tokens`.
- __Context planning__: Ensure headroom for reasoning. OpenAI suggests reserving ~25k tokens for reasoning+output when experimenting.
- __Cost control__: DO NOT USE!!! `max_output_tokens` to cap total (reasoning + visible output). If capped, responses may be `status: "incomplete"` with `incomplete_details.reason: "max_output_tokens"`.
- __Incomplete handling__: Detect `incomplete` and optionally surface partial output and guidance to increase `max_output_tokens`.
- __Summaries__: Opt-in via `reasoning.summary: "auto" | "detailed"` (availability varies by model). Returned under a `reasoning` output item.

# Current Implementation Findings
Files reviewed:
- `server/services/openai.ts`
- `server/config/models.ts`

Key observations:
- __Responses API__: Implemented via manual `fetch` to `https://api.openai.com/v1/responses` in `OpenAIService.callResponsesAPI()`.
- __Models__: Centralized registry (`server/config/models.ts`) with reasoning capability flags and context/token limits. Sets for `O3_O4_REASONING_MODELS`, `GPT5_REASONING_MODELS`, `GPT5_CHAT_MODELS`, `MODELS_WITH_REASONING`.
- __Reasoning config__:
  - GPT‑5: passes `reasoning.effort` (default `medium`), `reasoning.summary` (default `auto`), and `text.verbosity`.
  - o3/o4: passes simpler `reasoning.summary`.
- __Structured outputs__: Uses strict JSON Schema (`ARC_JSON_SCHEMA`) with Responses API `text.format` for models except `gpt-5-chat-latest`. Fallback to robust JSON extraction.
- __Token usage__: Parses `usage.input_tokens`, `usage.output_tokens`, and `usage.output_tokens_details.reasoning_tokens`; computes costs via `calculateCost()`.
- __Context/cost limits__: Passes `max_output_tokens` (default up to 128k; 100k for some chat models); exposes override via `serviceOpts.maxOutputTokens`.
- __Context continuity__: Supports `previous_response_id` passthrough.  NOT USED!!!
- __Summaries capture__: Extracts `output_reasoning.summary` and a list of items when available; normalizes into `reasoningLog` and `reasoningItems`.
- __Store mode__: Sends `store: true` by default.  SOMETIMES THIS IS INCORRECTLY STORING AS objectObject object in our DB columns for reasoning output, check columns 1-20 of the DB!!!

# Gaps & Risks
- __Incomplete status handling__: No explicit handling of `response.status === "incomplete"` / `incomplete_details.reason === "max_output_tokens"`. Risk: user sees empty output despite billed reasoning tokens.

- __UI controls__: While ModelExaminer mentions advanced controls, ensure UI exposes:
  - `reasoning.effort` (low/medium/high) and minimal for GPT-5 models!!
  - `reasoning.summary` (auto/detailed/none)
  - `text.verbosity` (for GPT‑5)
  - `max_output_tokens`
  - clear warnings about slow models and token costs
- __Summary availability__: We default `summary` to `auto`, but we don’t surface summary text consistently in the UI/DB as a first‑class field.
- __Safety rails__: No per‑model guardrails to prevent too‑low `max_output_tokens` causing starvation on complex puzzles.

# Recommendations
ument retention implications.
- __Headroom policy__:
  - Compute approximate prompt token size and set `max_output_tokens` to maintain ≥25k buffer for reasoning/output by default; allow override.

- __UI surfacing__:
  - Ensure ModelExaminer and PuzzleExaminer expose controls for effort/verbosity/summary/max_output_tokens and clearly label cost/latency tradeoffs per model.
  - Display reasoning summary (if available) in the analysis details with a toggle.
- __Per‑model safeguards__:
  - Add minimal `max_output_tokens` thresholds for known slow/complex models (e.g., o3/o4, gpt‑5) to avoid starvation.

# Implementation Pointers (code)
- `server/services/openai.ts`
  - Enhance `callResponsesAPI()` to:
    - Include `include: ["reasoning.encrypted_content"]` when `store === false`.
    - Return `status`, `incomplete_details` if present, plus any partial `output_text`.
    - Make `store` configurable via `serviceOpts`.
  - In `analyzePuzzleWithModel()`:
    - Thread through `serviceOpts.maxOutputTokens`, `reasoningEffort`, `reasoningVerbosity`, `reasoningSummaryType`, `store`.
    - If `status === "incomplete"`, populate result with flags and any partial output.
- `server/config/models.ts`
  - Optionally add recommended `minSuggestedMaxOutputTokens` or `suggestedHeadroom` per reasoning model.
- UI
  - Add/confirm controls for effort/verbosity/summary/max tokens; show warnings for slow models (see `v1.6.17` and performance memories).

# Testing Checklist
- __Happy path__: GPT‑5 with `effort=minimal|low/medium/high`, verify `usage.output_tokens_details.reasoning_tokens` captured and costs computed.
- __Incomplete path__: Force small `max_output_tokens`, verify `status=incomplete`, partial output surfaced, retry suggestion present.
- __Large prompts__: Ensure automatic headroom preserves ≥25k tokens for reasoning.
- __Summaries__: Verify `reasoning.summary=auto` returns summary content and is visible in UI/logs.

# References
- OpenAI Dashboard Docs: Reasoning Models, Responses API usage and parameters.
- Project code: `server/services/openai.ts`, `server/config/models.ts`.
