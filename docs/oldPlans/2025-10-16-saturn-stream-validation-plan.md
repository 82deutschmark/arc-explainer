# 2025-10-16 Saturn stream validation plan

## Goal
Ensure Saturn streaming path validates puzzle analyses identically to the generic streaming flow so malformed results are never persisted or emitted.

## Affected areas
- `server/services/streaming/saturnStreamService.ts`

## Tasks
1. Review existing validation logic in `puzzleAnalysisService.analyzePuzzleStreaming` to understand harness wrapping.
2. Update Saturn streaming harness to reuse `validateStreamingResult` before closing the stream.
3. Confirm persistence still occurs after validation and errors are logged without interrupting SSE closure.
4. Run targeted TypeScript checks or relevant tests if feasible.

## Risks & Mitigations
- **Risk:** Validation errors could prevent stream completion.  
  **Mitigation:** Wrap validator in try/catch and fall back to logging while still completing the stream.
- **Risk:** Duplicate persistence calls.  
  **Mitigation:** Ensure only the base harness performs database writes.
