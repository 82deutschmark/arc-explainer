# 2025-02-16 OpenAI Responses API Refactor Plan

## Goals
- Restore successful OpenAI Responses API calls for both batch and streaming modes.
- Re-establish SRP/DRY boundaries in the OpenAI service implementation to reduce maintenance risk.

## Existing Pain Points
- `server/services/openai.ts` mixes payload construction, HTTP wiring, streaming aggregation, and response parsing.
- Recent Responses API migration introduced regressions (broken calls) and duplicated logic that is hard to reason about.

## Target Deliverables
1. Modular helper utilities dedicated to:
   - Building request payloads for OpenAI Responses API.
   - Normalizing/inspecting Responses API outputs.
   - Managing streaming aggregation and emitting harness events.
2. Updated `OpenAIService` that delegates to helpers and exposes a clear public surface.
3. Guardrails/tests: smoke check for non-streaming invocation and streaming harness event flow (unit-level where possible).

## Work Breakdown
1. **Audit & Extraction**
   - Identify payload builder, response normalization, and streaming logic currently embedded in `openai.ts`.
   - Decide on helper module boundaries inside `server/services/openai/` (or similar namespace).
2. **Implement Helpers**
   - Create new TypeScript modules with headers per repo style.
   - Move/refine logic ensuring pure functions (no side effects besides logging where needed).
3. **Refactor `OpenAIService`**
   - Replace inline logic with helper usage.
   - Ensure error handling, token usage, and reasoning capture remain intact.
4. **Verification**
   - Run targeted tests/linters available (likely `npm run test` or focused script).
   - Manual sanity checks by invoking helper functions if feasible.

## Open Questions / Follow-ups
- Confirm whether additional providers rely on extracted helpers (future reuse potential).
- Determine best location for streaming event typings (may live beside helpers for now).

