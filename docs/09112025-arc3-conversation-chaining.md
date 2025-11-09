# ARC3 previousResponseId chaining

## Objective
Ensure ARC3 streaming sessions forward `previousResponseId` into the OpenAI Agents run and persist the new response id so continuations stay in the same conversation chain.

## Files to Modify
- `server/services/arc3/types.ts` - extend `Arc3AgentRunConfig` with conversation-chaining fields
- `server/services/arc3/Arc3StreamService.ts` - include `previousResponseId` when building continuation run configs
- `server/services/arc3/Arc3RealGameRunner.ts` - forward chaining parameters into `run`/`runWithStreaming` and emit new response metadata
- `server/routes/arc3.ts` - surface chaining payloads from HTTP handlers if required by service changes
- `docs/CHANGELOG.md` - record the enhancement

## Implementation Tasks

1. Update `Arc3AgentRunConfig` in `server/services/arc3/types.ts` to add optional `previousResponseId` and `storeResponse` flags used during runs.
2. In `server/services/arc3/Arc3StreamService.ts`, thread any received `previousResponseId` and `store` intent into both initial and continuation `runConfig` objects, ensuring continuation payloads persist it.
3. Amend `server/services/arc3/Arc3RealGameRunner.ts` so both `run` and `runWithStreaming`:
   - pass `previous_response_id` and `store` (true when chaining) into the Agents SDK invocation
   - capture the returned `response_id` from the run state and include it in stream completion metadata for later reuse.
4. Adjust `server/routes/arc3.ts` (or whichever controller builds the request payload) to accept and forward `previousResponseId` fields consistent with the service signature.
5. Add an entry to `docs/CHANGELOG.md` describing ARC3 conversation-chaining support updates.

## Integration Points
- ARC3 SSE pipeline now emits latest `providerResponseId` so the client can continue chains.
- OpenAI Agents SDK invocations persist responses via `store: true` for reuse by ARC3 continuations.

## Validation
- Manually trigger an ARC3 continuation request and confirm the resulting log/stream summary includes a non-null `providerResponseId`.
- Tell user plan is complete.
