<!--
OpenAI Responses API Migration Plan
What: Comprehensive plan to migrate all OpenAI usage from Chat Completions to Responses, including parsing, token budgeting, logging, chaining, and streaming/polling.
How: Defines audit findings, decisions, API/param changes, phased refactor tasks, test plan, and rollback/fallbacks.
Used by: Backend services in `server/services/` (notably `openai.ts`), controllers, DB persistence in `dbService.ts`, and frontend streaming consumers.
Author: Cascade
-->

# OpenAI Responses API Migration Plan (2025-08-20)

This plan migrates all OpenAI usage to the Responses API and updates our parsers, logging, and data model to surface summarized reasoning safely without capturing raw chain-of-thought.

## Progress Update — 2025-08-20 19:25 ET

- Completed Phase 1 (Schema):
  - Added `provider_response_id` (TEXT), `provider_raw_response` (JSONB, feature-flagged), `reasoning_items` (JSONB) to `explanations` with safe conditional ALTERs.
  - Extended `PuzzleExplanation` and `dbService.saveExplanation()` to persist these fields (`provider_raw_response` gated by `RAW_RESPONSE_PERSIST`).
- Completed Phase 2 (Core service wiring):
  - `server/services/openai.ts` now uses Responses API universally and returns `providerResponseId`, `providerRawResponse`, and `reasoningItems` derived from `output_reasoning.items`.
  - Parsing prefers `output_text` with fallback to `output[]`; summarized reasoning captured without raw chain-of-thought.
- Changelog updated under v1.4.0 reflecting schema additions and service wiring.
- Phase 3 (partial):
  - Threaded `previousResponseId` through `openai.ts` and forwarded from `saturnVisualService.ts` to support `previous_response_id` chaining.
  - Added simple exponential backoff retry (1s/2s/4s) in `openai.ts` Responses calls; configurable attempts.

Next up: Phase 3–5
- Controller wiring: ensure controllers/services pass `previousResponseId` from request payload everywhere.
- Add explicit request timeout around Responses calls and persist partials on timeout.
- Implement streaming or polling for reasoning summaries; add `RESPONSES_STREAMING` flag.

## 1) Audit Findings

- __OpenAI endpoint usage__: `server/services/openai.ts`
  - Reasoning models already call `openai.responses.create(...)` and parse `output_text`/`output[]`.
  - Non-reasoning models still call `openai.chat.completions.create(...)` and parse `choices[0].message.content`.
- __Legacy parsing patterns__: Found assumptions of `choices[0].message.content` in:
  - `server/services/openai.ts` (non-reasoning branch)
  - `server/services/deepseek.ts` (DeepSeek provider; OpenAI SDK compatible but not OpenAI’s API)
  - `server/services/grok.ts` (xAI provider; not OpenAI’s API)
- __DB persistence__: `server/services/dbService.ts` has no fields for `response.id`, raw JSON response, or reasoning history arrays.
- __Logging__: `openai.ts` logs Response objects to console, but we do not persist raw JSON for diagnosis.
- __Chaining__: No usage of `previous_response_id`.
- __Token budgeting__: No explicit `max_output_tokens` or reasoning token controls in Responses requests.
- __Streaming__: Current Responses path does not forward streamed reasoning summaries; UI expects logs from Saturn only.

Scope: Only OpenAI needs migration to Responses. Other providers keep their respective endpoints but we should not assume Chat Completions response shape globally.

## 2) Migration Objectives

- __API surface__: Use `openai.responses.create(...)` for all OpenAI models (reasoning and standard).
- __Model compatibility__: Only select OpenAI models that support the Responses API and summarized reasoning. For legacy non-reasoning models, still use Responses but without `reasoning` block.
- __Params__: Use Responses-style params. Prefer `reasoning: { summary: "auto" | "detailed" }`, `max_output_tokens`, optional `max_steps`. Avoid `max_completion_tokens` and legacy ChatCompletions-only params.
- __Parsing__: Read `response.output_text` for final text. If empty, inspect `response.output[]` blocks. Read `response.output_reasoning.summary` and `response.output_reasoning.items[]` if present; otherwise extract reasoning blocks from `output[]` entries of type `reasoning`.
- __No raw CoT__: Do not request or store raw chain-of-thought. Only summarized reasoning.
- __Session chaining__: Persist `response.id` and use `previous_response_id` to continue chains.
- __Streaming or polling__: Support both. If streaming, forward reasoning-summary deltas and final output. If polling, fetch the Response object by id until complete.
- __Diagnostics__: Persist raw JSON in DB for failing runs (behind a feature flag) and include keys: `id`, `output_reasoning`, `output_text`, `output`.
- __Retries/timeouts__: Exponential backoff for 429/5xx; request timeout 30–60s; persist partial `response.id` and partial reasoning history on timeout.

## 3) Detailed Changes

- __Endpoint change (OpenAI)__:
  - Replace all uses of `openai.chat.completions.create(...)` in `server/services/openai.ts` with `openai.responses.create(...)`.
  - Request shape:
    - `model`
    - `input`: `[{ role: "user", content: promptString }]`
    - `reasoning`: `{ summary: "auto", effort: "medium" | "high" }` for reasoning-capable models; omit or set summary for others as needed.
    - `max_output_tokens`: set per-mode default (e.g., 1024 or higher) to avoid starving visible output.
    - Optional: `metadata` to help correlate responses.
    - Optional: `previous_response_id` to chain.
- __Param mapping__: Remove `response_format`, `messages`, `temperature` for OpenAI paths. If temperature is desired for non-reasoning models, evaluate Responses param support; otherwise embed determinism guidance in the prompt.
- __Parsing update__:
  - Prefer `response.output_text`.
  - Fallback: Scan `response.output[]` for first message/content block; capture tool outputs if relevant.
  - Reasoning summary: If available, read `response.output_reasoning.summary` and items; else collect `output[]` entries of type `reasoning` and join summaries.
- __DB schema additions__ (new columns in `explanations`):
  - `provider_response_id TEXT` (indexable)
  - `provider_raw_response JSONB` (nullable, feature-flagged persistence)
  - `reasoning_items JSONB` (array of summarized steps)
- __Server interfaces__:
  - Extend return shape from `openai.ts` to include `responseId`, `reasoningHistory` (array), `rawResponse` (optional, guarded by flag), and `tokenUsage` if exposed by Responses.
- __Chaining__:
  - Save `responseId` with explanation record.
  - Accept `previousResponseId` in controller/service to continue sessions.
- __Streaming__:
  - If using Responses streaming, forward reasoning-summary chunks to the client channel (similar to Saturn logs) with a compact event type and throttle.
  - Otherwise, implement polling by id until status complete, then persist and return.
- __Retries/Timeouts__:
  - Backoff: 1s, 2s, 4s up to N tries for 429/5xx.
  - Timeout: 60s per request; on timeout, persist `responseId` (if any) and partial reasoning to aid resume.
- __Token budgeting__:
  - Defaults: `max_output_tokens` ≥ 1024 for explanation mode; allow UI override.
  - Enforce cap for reasoning steps (`max_steps`) when experimenting to reduce cost; ensure visible output isn’t starved.

## 4) Backward Compatibility and Fallbacks

- For models that fail with Responses, temporarily fall back to provider-specific endpoints behind a kill switch, but keep parser generic (no `choices[0]...` assumptions in shared code).
- A feature flag toggles raw JSON persistence to DB to control storage footprint.

## 5) Test Plan

- __Quick repro__: Call Responses with `{ reasoning: { summary: "auto" }, max_steps: 5, max_output_tokens: 512 }` and verify both `output_reasoning.summary` and `output_text` populated.
- __Parser unit tests__: Feed fixture Responses with variations:
  - Has `output_text` vs empty `output_text`.
  - Reasoning in `output_reasoning` vs in `output[]` as type `reasoning`.
  - Tool output blocks present.
- __E2E__: Run a subset of puzzles across: o3-mini, o4-mini, gpt-5 variants using Responses, verify DB fields populated and UI shows reasoning summary when available.
- __Failure drills__: Simulate 429, 5xx, and timeouts; ensure backoff works and partial data persists.

## 6) Rollout Plan (Phased)

- __Phase 0: Planning__ (this doc) ✓
- __Phase 1: Schema__
  - Add new DB columns/migrations and TypeScript types.
  - Add feature flags: RAW_RESPONSE_PERSIST, RESPONSES_STREAMING.
- __Phase 2: Refactor OpenAI service__
  - Move all OpenAI calls to Responses.
  - Implement param mapping and parser.
  - Return `responseId`, `reasoningSummary`, `reasoningHistory`.
- __Phase 3: Controller + Factory__
  - Thread `previousResponseId` from request body through service.
  - Add retries/timeouts.
- __Phase 4: Logging__
  - Persist raw JSON for failing runs when flag is on.
  - Add structured logs.
- __Phase 5: Streaming/Polling__
  - Implement streaming path or polling-by-id.
- __Phase 6: QA__
  - Run Quick repro + unit + E2E tests.
- __Phase 7: Cleanup__
  - Remove legacy Chat Completions code paths in OpenAI service.

## 7) Owner/Tasks Checklist

- (a) __Confirm endpoint__: Replace OpenAI Chat Completions with Responses everywhere in `openai.ts`.
- (b) __Log raw JSON__: Persist JSON for failing runs (flagged) in `provider_raw_response`.
- (c) __Parser__: Read `output_text`, `output[]`, and `output_reasoning` fields; remove `choices[0]...` assumptions.
- (d) __Token caps__: Set `max_output_tokens` high enough; optional `max_steps`.
- (e) __Persist id__: Save `response.id` → `provider_response_id` and accept `previous_response_id`.
- (f) __Test__: Run quick repro with `reasoning.summary = auto` and validate both summary and output.

## 8) Open Questions / Notes

- Confirm exact token usage fields exposed by Responses in the current SDK version; capture if available.
- Decide whether to expose `previousResponseId` in the UI for manual chaining.
- Storage cost of raw JSON at scale; likely keep it flagged and time-bound.
