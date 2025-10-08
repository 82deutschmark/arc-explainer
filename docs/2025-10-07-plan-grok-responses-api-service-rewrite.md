/**
 *
 * Author: Codex using GPT-5-high
 * Date: 2025-10-07T14:14:46-04:00
 * PURPOSE: Roadmap for rewriting the xAI Grok service to use the Responses API exclusively, removing deprecated Grok-3 handling, aligning with SRP/DRY, and documenting integration boundaries across services.
 * SRP/DRY check: Pass - Single-purpose planning doc referencing existing modules; verified server/services for prior Grok implementations.
 * shadcn/ui: Pass - No UI work scoped.
 */
# 2025-10-07 Plan - Grok Responses API Service Rewrite

## Objectives
- Replace legacy `grok.md` shim with production `grok.ts` aligned to Responses API contract.
- Enforce SRP by centralizing Grok request building, transport, and parsing into isolated helpers.
- Ensure DRY compliance by reusing BaseAIService utilities (prompt building, cost calc, JSON parsing).
- Remove reasoning capture paths because `grok-4`/`grok-4-fast` do not surface reasoning tokens or summaries.
- Maintain compatibility with metrics: provide token usage, provider response ID, and structured prediction payloads.

## Key Tasks
1. Design service API surface (methods, private helpers, retry strategy) consistent with BaseAIService overrides.
2. Implement `server/services/grok.ts` with Responses API integration, schema fallback, and no reasoning capture.
3. Deprecate `server/services/grok.md` placeholder; ensure factory imports updated path.
4. Validate model config alignment for supported keys (`grok-4`, `grok-4-fast`, related variants) and temperature handling.
5. Capture edge-case handling notes (structured output errors, chaining limits, rate limiting) within code comments.
6. Smoke-test via targeted TypeScript build or lint (if time) and review for SRP/DRY compliance.

## Dependencies & References
- `server/services/base/BaseAIService.ts` for shared helpers and response consolidation.
- `server/config/models/index.ts` for Grok model metadata.
- `server/services/openai.ts` as reference for Responses API shape.
- `docs/xAI-API.md` for endpoint behaviors and field names.

## Open Questions
- Do we need separate handling for `grok-4-fast-non-reasoning`? (Assume yes, but treat identically with reasoning disabled.)
- Should we default `store` to true for tracing? (Yes, following existing providers.)

## Deliverables
- `server/services/grok.ts` (new file) with production-grade implementation.
- Removal of `server/services/grok.md`.
- This plan document as historical record.

## Verification Steps
- Run `npm run lint -- grok` (optional if available) or ensure TypeScript build passes (pending capability).
- Manual review of `server/services/aiServiceFactory.ts` to confirm import path resolves to `.ts`.
- Confirm structured output fallback works by inspecting error handling pathways.