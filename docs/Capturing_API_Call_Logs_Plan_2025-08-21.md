<!--
Capturing API Call Logs Plan
What: End-to-end strategy to capture raw API requests/responses, reasoning summaries, and related solver events for Saturn Visual Solver and backend AI services.
How: Adds structured logging hooks in Python wrapper/solver and Node services, redacts secrets, persists selectively behind feature flags, and integrates with existing DB fields and event streams.
Used by: `server/python/saturn_wrapper.py`, `solver/arc_visual_solver.py`, `server/services/{openai.ts,anthropic.ts}`, `server/services/{pythonBridge.ts,saturnVisualService.ts,dbService.ts}`.
Author: Cascade
-->

# Capturing API Call Logs Plan (2025-08-21)

Objective: Provide comprehensive and safe capture of API call context during ARC Saturn visual solver execution and backend AI service analysis, enabling reproducible debugging while respecting privacy and chain‑of‑thought policies.

## 0) User Directives (Locked)

- Dev/Prod parity: same behavior in all environments (no reduced prod mode)
- Provider scope: start with OpenAI; add others later
- No size caps or truncation on stored payloads/events
- Storage is ample; persist rich artifacts, including raw provider responses
- Rich UI required for exploring API calls (timeline, tabs, stats, raw viewers)

## 1) Scope and Goals

- Capture for two paths:
  - Saturn Visual Solver (Python): `solver/arc_visual_solver.py` via `server/python/saturn_wrapper.py`.
  - Backend AI services (Node): `server/services/openai.ts`, `server/services/anthropic.ts`.
- Data to capture (feature-flagged):
  - Request metadata: provider, model, endpoint, timestamps, retry info.
  - Request body (sanitized): prompts, inputs, images refs, parameters.
  - Response metadata: status, ids (e.g., `response.id`), latency, headers (redacted).
  - Response body (sanitized): final text, structured fields (e.g., Responses `output_text`, `output_reasoning.summary/items`).
- Explicitly do NOT persist raw chain‑of‑thought. Only summarized reasoning already surfaced by providers.

## 2) Components & Integration Points

- Python runtime
  - `server/python/saturn_wrapper.py`
    - Emits NDJSON events; buffers full verbose log; watches solver-generated PNGs.
    - Integration: add new event types for API call logging (see Section 3).
  - `solver/arc_visual_solver.py`
    - Calls OpenAI Responses API with multimodal inputs and iterative phases.
    - Integration: wrap each API call with logging hooks that emit sanitized request/response snapshots.

- Node backend
  - `server/services/openai.ts`
    - Responses API usage, retries, reasoning extraction. Key for backend analyses.
    - Integration: capture sanitized request/response and reasoning items; persist via `dbService.ts`.
  - `server/services/anthropic.ts`
    - Summarized reasoning capture; similar hooks as OpenAI.
  - `server/services/pythonBridge.ts`
    - Streams NDJSON from Python; aggregate event trace and verbose logs.
    - Integration: forward new NDJSON `api_call` events to `saturnVisualService.ts`.
  - `server/services/saturnVisualService.ts`
    - Orchestrates Saturn runs; aggregates logs/images; persists final record.
    - Integration: include API call snapshots in final payloads persisted by DB.
  - `server/services/dbService.ts`
    - Persists explanation rows including `provider_response_id`, `provider_raw_response` (flagged), `reasoning_items`, `saturnLog`, `saturnEvents`.

## 3) Event Model (Streaming via NDJSON)

- New Python-emitted event types
  - `api_call_start`:
    - `ts`, `phase`, `provider`, `model`, `endpoint`, `requestId` (client-generated UUID), `attempt`, `params` (sanitized), `images`: array of descriptors (e.g., filenames or `data:image/png;base64;len=...`).
  - `api_call_end`:
    - `ts`, `requestId`, `status` (success/error), `latencyMs`, `providerResponseId` (if available), `httpStatus`, `reasoningSummary` (if provided), `tokenUsage` (if exposed), `error` (sanitized message only).
  - Optional `api_call_chunk` (future): to surface partial reasoning summaries if streaming.
 - Rationale: Keeps Python solver fully transparent; `pythonBridge.ts` forwards these to Node and includes them in the full `saturnEvents` trace and final `saturnLog`.

## 4) Sanitization & Redaction Policy

- Always redact the following prior to emission/persistence:
  - API keys and Authorization headers.
  - Provider-specific secrets (org IDs, account IDs) if present.
  - Full raw image bytes in request logs (store as length + hash or filename reference; images themselves are already persisted separately as PNG artifacts).
  - User-supplied secrets from `.env` or runtime configs.
  - Remove/avoid raw chain‑of‑thought fields; only store summarized reasoning that providers designate for logging (e.g., `output_reasoning.summary/items`).
- Header handling: store only minimal diagnostic headers (rate limit info) after redaction; omit bodies like `Set-Cookie`.
 - No size caps: persist full request/response bodies (minus redactions). No truncation.

## 5) Persistence Model (DB)

- Use existing fields in `explanations` (always on with dev/prod parity):
  - `provider_response_id TEXT`
  - `provider_raw_response JSONB` — `RAW_RESPONSE_PERSIST` enabled by default across all environments.
  - `reasoning_items JSONB`
  - `saturnLog TEXT` (full verbose log)
  - `saturnEvents JSONB` (full event trace including new `api_call_*` events)
- Optional follow-up (if needed at scale): introduce `api_call_logs` table keyed by explanation id for multiple calls with paging. Start with in-row storage to stay lightweight.

## 6) Feature Flags & Env Controls

- Existing: `RAW_RESPONSE_PERSIST` — controls DB persistence of `provider_raw_response`.
- Effective defaults (dev = prod):
  - `RAW_RESPONSE_PERSIST=true` (enabled by default)
  - `API_LOG_REQUESTS=true` (always on)
  - `API_LOG_RESPONSES=true` (always on)
  - No `API_LOG_MAX_BYTES` cap (disabled)
  - No `SATURN_LOG_MAX_EVENTS` cap; store the full event stream
  - `SATURN_TIMEOUT_MINUTES` (existing) — included in metadata for correlation

## 7) Implementation Plan (Phased)

- Phase 1 — Planning (this doc)
- Phase 2 — Python Instrumentation
  - In `arc_visual_solver.py`: wrap each OpenAI call (before/after) to emit `api_call_start`/`api_call_end` via the wrapper’s emitter.
  - In `saturn_wrapper.py`: ensure passthrough of new event types and include in verbose log; maintain existing image watcher.
- Phase 3 — Node Instrumentation (Backends)
  - OpenAI first: In `openai.ts` capture sanitized request params and response snapshots; include `providerResponseId`, `reasoningItems`, `tokenUsage` (when available). Anthropic and others to follow.
  - Include retries metadata (attempt counts, backoff timing) in logs.
- Phase 4 — Bridge & Service Wiring
  - In `pythonBridge.ts`: forward `api_call_*` events; include in event buffer; tag with `source: "python"`.
  - In `saturnVisualService.ts`: on finalization, persist `saturnEvents` (event trace) and `saturnLog` (verbose log). If `RAW_RESPONSE_PERSIST=true`, also persist `provider_raw_response` when available.
- Phase 5 — Persistence and Size Controls
  - No truncation; persist full payloads. Redact images and secrets before write.
- Phase 6 — QA
  - Run representative puzzles; verify events appear in UI console and DB; confirm no secrets stored.

 - Phase 7 — Rich UI (Saturn Visual Solver)
   - API Timeline panel: chronological `api_call_*` entries with status, latency, model, endpoint, and expandable details
   - Tabs: Timeline | Requests | Responses | Reasoning | Raw JSON
   - Statistics Cards: total calls, successes/errors, avg latency, tokens (if available)
   - Raw JSON viewers with copy/download actions (respecting redaction policy)
   - Filters: by phase, status, provider/model

## 8) Data Schemas (Logical)

- `ApiCallEvent` (NDJSON):
  - start: `{ type: "api_call_start", ts, phase, provider, model, endpoint, requestId, attempt, params, images[] }`
  - end: `{ type: "api_call_end", ts, requestId, status, latencyMs, httpStatus, providerResponseId, reasoningSummary?, tokenUsage?, error? }`
- `ProviderRawResponse` (JSONB, flagged): provider-specific; minimum keys recommended:
  - OpenAI Responses: `{ id, output_text, output_reasoning: { summary, items }, output? }`
  - Anthropic: structured fields without raw CoT.

## 9) Testing Plan

- Unit (Node):
  - Verify `openai.ts` logs include id, summary, items; ensure redaction and truncation.
  - Simulate 429/5xx and validate attempts/latency fields.
- E2E (Saturn):
  - Confirm `api_call_*` events flow wrapper → bridge → service → DB.
  - Validate images are referenced (filename/hash/length) not re-embedded.
  - Check `RAW_RESPONSE_PERSIST` gating for DB.
- Manual: Inspect UI console/log panes to verify visibility and no secret leakage.

## 10) Security & Compliance

- No API keys or Authorization headers ever persisted.
- No raw chain‑of‑thought captured; only provider-endorsed summaries.
- Redaction applied before disk or DB write.
- Logs are for debugging and reproducibility; respect retention limits.

## 11) Rollout & Ownership

- Owner: Cascade (plan); implementation pending user approval.
 - Rollout: dev = prod parity; logging always on. No caps.
 - Post‑rollout review: observe storage footprint; no need to trim unless issues arise.

## 12) Open Questions

- Do we need a separate `api_call_logs` table immediately or defer until volume requires it?
- Which token usage fields are reliably exposed per provider SDK version?
