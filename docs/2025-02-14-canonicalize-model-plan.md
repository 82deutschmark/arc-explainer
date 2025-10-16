# Plan: Canonicalize OpenAI-prefixed model routing

## Objective
Ensure models with the `openai/` prefix route through the OpenAI service while maintaining original metadata for streaming responses.

## Target Files
- server/services/aiServiceFactory.ts
- server/services/streaming/analysisStreamService.ts
- server/services/streaming/saturnStreamService.ts (and other streaming entry points)
- tests (add/extend coverage for streaming OpenAI prefixed models)

## Todos
1. Add canonicalization helper in AI service factory to normalize provider keys while preserving originals.
2. Update streaming services to leverage canonical model keys for service selection and capability checks.
3. Adjust downstream calls to continue emitting original key values in SSE metadata.
4. Implement unit test validating streaming behavior for `openai/gpt-5-2025-08-07`.
5. Run relevant tests to ensure no regressions.
