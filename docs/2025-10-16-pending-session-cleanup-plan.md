# 2025-10-16 Pending session cleanup plan

## Goal
Polish the new analysis streaming handshake by ensuring pending payloads are always cleaned up and coverage/docs reflect the server-side cache lifecycle.

## Tasks
- [x] Update `server/services/streaming/analysisStreamService.ts` to clear pending payloads on unsupported/invalid session paths and tighten lifecycle logging (including TTL-based expirations for abandoned handshakes).
- [x] Refresh `tests/analysisStreamService.test.ts` to cover the cleanup behaviour and repair module imports.
- [x] Verify controller cancellation keeps cache in sync and document the flow touch-up in `docs/reference/api/EXTERNAL_API.md` if needed.
- [x] Run targeted tests (`node --import tsx --test tests/analysisStreamService.test.ts`).

## Notes
- Reuse existing logging utilities; avoid new dependencies.
- Ensure tests reset service state between cases to keep Map isolation.
