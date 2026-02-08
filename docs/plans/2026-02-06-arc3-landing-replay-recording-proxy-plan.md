# 2026-02-06 ARC3 Landing Replay Recording Proxy Plan

## Context
Some ARC3 replays were not loading on the landing page. The reported replay source was:
`https://three.arcprize.org/api/recordings/as66-f340c8e5138e/7408e07e-83ca-4fbb-b9eb-1ed888cd751e-short`.

## Root Cause
- Official replay recording endpoints return `application/x-ndjson` payloads.
- Direct browser fetches from the landing page are unreliable due cross-origin restrictions.
- Landing had shifted to MP4-only replay rendering, which excluded problematic recordings.

## Objectives
1. Add a same-origin backend proxy for ARC3 recording payloads.
2. Render landing ARC3 replay from recording data instead of MP4-only sources.
3. Include the provided AS66 replay in the curated landing rotation.
4. Document behavior and update changelog.

## TODOs
- [x] Add `GET /api/arc3/recordings/:gameId/:recordingId` in `server/routes/arc3.ts`.
- [x] Update `client/src/pages/LandingPage.tsx` to use `ARC3CanvasPlayer` with proxy recording URLs.
- [x] Add landing-specific `maxFrames` and `hideHeader` options in `client/src/components/ARC3CanvasPlayer.tsx`.
- [x] Update `docs/reference/frontend/landing-hero.md` and top entry in `CHANGELOG.md`.
- [ ] Manual browser verification in local dev/staging.

## Validation Notes
- Confirmed upstream recording endpoints return NDJSON with expected frame data.
- Type-check/build verification still required after code edits.
