Author: Buffy the Base Agent (Codebuff)
Date: 2025-10-07
PURPOSE: Enable Grok-4 structured outputs via xAI Responses API with a compliant JSON schema and graceful fallback; document safe batch settings for ARC2-eval.
SRP/DRY check: Pass — single doc for enablement and ops guidance. No duplicated code.
shadcn/ui: Pass — backend/integration doc.

Overview
- Grok-4/Grok-4-fast now request structured outputs using response_format.json_schema.
- Minimal schema (GROK_JSON_SCHEMA) avoids unsupported constraints (no minLength/maxLength, no minItems/maxItems, no allOf). Shallow nesting only.
- If xAI responds with grammar/schema error (400/422/503 containing "grammar" or "schema"), we retry once without schema, then continue.
- Parsing supports output_parsed first; falls back to output_text or output blocks with robust extraction.

Request shape (xAI Responses API)
- body.response_format = { type: "json_schema", json_schema: { schema: GROK_JSON_SCHEMA.schema } }
- No name/strict used. No reasoning config sent for Grok-4.
- previous_response_id passed through for chaining.

GROK_JSON_SCHEMA contents (minimal)
- required: [multiplePredictedOutputs, predictedOutput]
- optional: predictedOutput1/2/3, confidence
- arrays of arrays of integers for all predicted grids.
- additionalProperties: false

Fallback behavior
- Detect grammar/schema errors in provider error body.
- Remove response_format and retry once (keeps other retries for 429/5xx with jitter).
- Guarantees batch won’t abort due to schema issues.

Batch run (ARC2-eval) - recommended settings
- Concurrency: MAX_CONCURRENCY defaults to 2 (override with env XAI_MAX_CONCURRENCY=1..3)
- Retries: XAI_MAX_RETRIES=2, XAI_RETRY_BASE_DELAY_MS=2000
- Command: npx ts-node scripts/grok-4-fast-reasoning.ts --dataset arc2
- Same pattern works for grok-4-fast-non-reasoning.ts and grok-4.ts

Operational notes
- ResponseProcessor consumes output_parsed when present; token usage and cost computed as before.
- getModelInfo now reports supportsStructuredOutput=true for Grok-4 variants.
- Logs will show one-shot fallback events: "Disabling structured output due to grammar/schema error...".

Next steps (optional)
- Add env flag to force schema off/on for A/B testing (e.g., XAI_FORCE_SCHEMA=true/false).
- Add resume mode to scripts to skip already-saved puzzles.
