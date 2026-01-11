# 2026-01-10 Worm Arena Live Preflight Fix Plan

**Author:** Cascade (ChatGPT)
**Date:** 2026-01-10
**Status:** In Progress

## Scope
Update the Worm Arena Live frontend to consume the new `/api/wormarena/live/:sessionId` resolve + SSE endpoints introduced in commit `a7d872cb1`, ensuring preflight and reconnect flows no longer hit the old `/api/wormarena/resolve/:sessionId` route. Preserve existing UX behaviors (redirects, helpful errors) while restoring API compatibility.

## Objectives
1. Verify the new backend REST surface (resolve + SSE routes) so the frontend mirrors the expected shape.
2. Point all WormArena Live preflight/fallback fetches at the correct `live` endpoints with DRY URL construction while leaving redirect logic unchanged.
3. Re-run lint/type checks that cover the client bundle to prevent regressions, preparing for the upcoming SSE backend work.

## Tasks / TODOs
- [x] Confirm backend routing + controller expectations (`server/routes.ts`, `server/controllers/wormArenaStreamController.ts`).
- [x] Refactor `client/src/pages/WormArenaLive.tsx` (and related hooks if needed) so both the initial preflight fetch and retry/failure handler call the new `live` endpoint helper.
- [ ] Execute `npm run lint -- --max-warnings=0` (or `tsc --noEmit`) to ensure no type/lint errors were introduced.
- [ ] Update this plan status to **Done** once all tasks and verifications succeed, then document the change in `CHANGELOG.md` per repository policy.

## Risks & Notes
- Streaming backend (`runMatchStreaming`) remains out of scope; this work simply prevents 404s before SSE wires up.
- Keep UX identical: redirect to `/worm-arena` for missing/finished sessions and surface existing toast/error flows.
- Remember repo rules: file headers for TS updates, inline comments only where logic is non-obvious, and no auth gates.
