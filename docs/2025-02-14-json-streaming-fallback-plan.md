# Plan: Restore JSON streaming fallback for legacy output_text.delta events

## Objective
Ensure legacy models that only emit `response.output_text.delta` events continue to stream structured JSON when `expectingJson` is enabled.

## Scope
- Update `server/services/openai/streaming.ts` to reintroduce fallback handling without disrupting annotated JSON streams.
- Verify callbacks continue to emit both text and JSON chunks appropriately.

## Tasks
1. Extend stream aggregate state to track whether annotated JSON deltas have been observed.
2. When `expectingJson` is true and no annotated deltas have been seen, forward `response.output_text.delta` payloads to the parsed JSON buffer while keeping text aggregation intact.
3. Mark annotated JSON usage once `response.output_text.delta.annotated` events arrive to prevent duplicate forwarding.
4. Add contextual metadata if needed to help downstream consumers detect fallback usage.

## Verification
- Type-check the updated module (implicit via build tooling).
- Rely on existing automated coverage for runtime behavior; manual inspection of emitted chunk metadata.
