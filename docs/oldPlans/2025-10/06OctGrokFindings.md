Author: Buffy the Base Agent (Codebuff)
Date: 2025-10-07T00:00:00Z
PURPOSE: Document concrete findings and safe recommendations for improving xAI Grok-4 integration reliability (reduce ~10% failures) without breaking other providers. Captures routing, parsing, and stability fixes plus optional structured-output experiment.
SRP/DRY check: Pass (documentation only; proposes SRP-compliant refactors and DRY reuse of existing ResponseProcessor)
shadcn/ui: Pass (N/A for backend docs; no custom UI)

---

# Grok-4 Integration: Findings & Recommendations (06 Oct)

## Executive Summary
Most requests succeed, but a non-trivial subset (~10%) fail due to a combination of:
- Model routing mismatch (grok-3 variants hitting GrokService /v1/responses)
- Per-request undici Agent with massive timeouts (resource pressure + no retry/backoff)
- Parsing logic duplication in grok.ts (drifting from centralized ResponseProcessor)
- Capability inconsistency: structured output reported as supported but force-disabled
- Heavy prompting with schema disabled (increases edge-case JSON adherence and rate-limit exposure)

The quickest, lowest-risk path: fix routing and capability reporting, then stabilize HTTP usage. All other providers remain untouched.

---

## Key Findings

1) Routing mismatch (high impact)
- aiServiceFactory routes any model starting with "grok-" to GrokService (Responses API).
- GrokService explicitly supports only Grok-4 variants via /v1/responses.
- Grok-3 variants require Chat Completions (and are already supported via OpenRouter service).
- Likely a major cause of intermittent 400/422 failures.

2) Transport stability risks (medium/high)
- grok.ts creates a new undici Agent per request with 45-minute header/body timeouts.
- Under concurrency this risks socket exhaustion; no retry/backoff for transient 429/5xx.

3) Parsing duplication (medium)
- grok.ts re-implements parsing that ResponseProcessor already centralizes.
- Divergence causes occasional parse failures for less-common output shapes.

4) Capability inconsistency (low/medium)
- getModelInfo() claims supportsStructuredOutput=true for grok-4 but callResponsesAPI disables schema for grok-4 due to 503 ("Grammar is too complex").
- Confusing to callers and tests.

5) Prompt + no schema (context)
- Not a direct failure cause, but heavy prompts without provider-enforced schema raise parser burden and rate limit exposure.

---

## Recommendations (Phased, Low-Risk First)

Phase A — Safety fixes (do first)
1. Fix routing in aiServiceFactory
   - Route only grok-4, grok-4-fast, grok-4-fast-reasoning, grok-4-fast-non-reasoning to GrokService.
   - Route any grok-3 variants (including x-ai/grok-3 via OpenRouter) to openrouterService.
2. Correct getModelInfo() in GrokService
   - Report supportsStructuredOutput=false for grok-4 until we intentionally enable a lightweight schema.

Phase B — Stability hardening (still low risk, localized)
3. Reuse a singleton undici Agent with env-configurable timeouts
   - Create a shared Agent (module-level or small httpClient utility) and reuse it across calls.
   - Expose headers/body/overall timeouts via env with sensible defaults (e.g., 120–300s for hobby scale).
   - Add minimal retry with jitter for transient 429/5xx (1–2 attempts max).
4. Persist raw failure responses consistently
   - Use ResponsePersistence for Grok failures as well, as already done elsewhere, to aid triage.

Phase C — Parsing consistency (medium, behind a flag)
5. Delegate to ResponseProcessor.processResponsesAPI first, keep current logic as fallback
   - Reduces edge-case drift and centralizes parsing/usage extraction.
6. Optional experiment (feature-flagged): lightweight Grok schema
   - Implement GROK_JSON_SCHEMA (simplified) and a boolean flag to enable it for grok-4 only.
   - Keep default OFF (prompt-only). If xAI accepts it without 503s, we can flip ON per environment.

Phase D — Prompt refinement (optional)
7. Minimal "solver" prompt variant for Grok-4 (prompt-based JSON only)
   - Lighter instructions reduce token pressure and parsing complexity, especially without schema.

---

## Concrete Changes (Targeted; minimal blast radius)

A) aiServiceFactory.ts
- Restrict GrokService routing to grok-4 variants only.
- Route grok-3 variants (and similar) to openrouterService.

B) server/services/grok.ts
- getModelInfo(): supportsStructuredOutput=false (until schema experiment is proven).
- Replace per-request Agent creation with shared singleton Agent.
- Add configurable timeouts via env (e.g., XAI_HEADERS_TIMEOUT_MS, XAI_BODY_TIMEOUT_MS, XAI_OVERALL_TIMEOUT_MS) + default fallbacks.
- Add minimal retry/backoff for 429/5xx (1–2 tries) with jitter.
- Delegate parsing to ResponseProcessor.processResponsesAPI first; retain local parsing as fallback.
- Ensure ResponsePersistence is used for failures for easier debugging.
- Remove unused imports/instances (e.g., unused OpenAI instance, unused jsonParser import if not used after delegation).

C) Optional: server/services/schemas/grokJsonSchema.ts (feature-flagged)
- Implement lightweight schema from 06OCTGrok.md (strict=false, minimal required fields).
- Toggle via env (XAI_USE_LIGHT_SCHEMA=true) for controlled testing.

D) Optional: promptBuilder minimal variant
- Add minimalSolver instructions for grok-4 prompt-only flow (if desired), behind a model check.

---

## Testing & Rollout Plan

1) Phase A first (routing + supportsStructuredOutput=false)
- Unit smoke: route selection tests for grok-4 vs grok-3.
- Manual: run a few puzzle analyses for known models (grok-4, grok-4-fast, x-ai/grok-3 via OpenRouter) to verify no regressions.

2) Phase B (stability)
- Verify no socket/file descriptor growth under 5–10 concurrent requests.
- Simulate transient 429/5xx (by toggling a mock or intercept) to confirm retry behavior, capped at 1–2 attempts.

3) Phase C (parsing delegation)
- Compare parsed outputs before/after on a small batch (3–10 puzzles) to ensure fields match expectation (predictedOutput*, multiplePredictedOutputs, etc.).
- Validate tokens and cost fields still populate.

4) Optional lightweight schema experiment
- Enable flag on dev for single puzzle test; monitor for 503 "Grammar is too complex".
- If stable across multiple puzzles, consider enabling per-environment.

---

## Risk Analysis
- Routing fix: very low risk (tightens behavior to intended contract).
- Singleton Agent + retries: low risk; improves reliability and resource usage.
- Parser delegation: moderate; mitigate via fallback to current logic + small batch test first.
- Lightweight schema: experimental; keep feature-flagged OFF by default.

---

## Expected Outcomes
- Immediate drop in intermittent failures by stopping grok-3 requests from hitting /v1/responses.
- Fewer network/transport flakes due to Agent reuse and retries.
- More consistent parsing and token usage extraction via ResponseProcessor.
- Optional structured-output path for Grok-4 without triggering 503s (if accepted).

---

## Open Questions
- Do we want to expose env toggles for: (a) retries count, (b) timeouts, (c) lightweight schema usage, (d) prompt minimal mode by model?
- Are any frontend callers relying on supportsStructuredOutput=true for grok-4? (If so, update UI hints.)

---

## Quick Triage Checklist
- Is the model grok-3? Ensure the request is routed via OpenRouter (Chat Completions), not GrokService.
- Did we hit 429/5xx? Confirm retry fired (logs) and raw response persisted for inspection.
- Parsing failed? Compare grok.ts output with ResponseProcessor behavior for the same payload.

---

## No Code Changes Yet
This document captures the safe plan. Phase A can be implemented in a single, minimal PR. Phases B–D can follow incrementally.
