# ARC3 streaming continuation fix plan
**Date:** 2025-12-08  
**Author:** Codex (GPT-5)  
**Goal:** Stop 500s when users continue ARC3 runs after the agent reaches its move cap; ensure Responses API chaining is robust and well-validated.

## Context
- Error surfaced when user sends a follow-up message after ARC3 agent stops: `500 SERVICE_UNAVAILABLE` from `/api/arc3/stream/:sessionId/continue`.
- Likely causes: `previousResponseId` missing/undefined or continuation seeded without a cached frame, tripping Zod validation and bubbling as 500s.
- Must align with Responses API docs (`previous_response_id`, providerResponseId storage) and avoid corrupting ARC3 game sessions.

## Plan / TODOs
1) Harden continuation contract in backend:
   - Allow `previousResponseId` to default from stored `providerResponseId`.
   - Validate presence of a seed frame when continuing an existing game; return clear 400s instead of throwing.
2) Frontend review:
   - Ensure continue payload always includes last known frame and sends `previousResponseId` when available.
   - Surface user-friendly errors if continuation cannot proceed.
3) Verification:
   - Exercise continuation flow locally (happy path + missing `previousResponseId` case) and confirm JSON responses are non-500 with helpful messages.
4) Changelog:
   - Record changes with semantic version bump at the top.

## Files likely involved
- `server/routes/arc3.ts`
- `client/src/hooks/useArc3AgentStream.ts`
- `CHANGELOG.md`
