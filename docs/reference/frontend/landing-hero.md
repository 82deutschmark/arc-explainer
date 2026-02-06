# Landing Visual Hero
**Author:** GPT-5 Codex  
**Date:** 2026-02-06  
**Purpose:** Document the current `/` landing hero behavior after restoring ARC3 replay-data playback via a server proxy.

---

## 1. Overview
- `/` renders a two-column visual hero:
  - Left: rotating ARC 1 and ARC 2 puzzle GIF previews.
  - Right: ARC3 replay rendered from NDJSON recording data in a canvas player.
- A status banner displays: `On Hiatus - January 2026`.
- `prefers-reduced-motion` disables autoplay and GIF rotation.

## 2. ARC3 Replay Data Path
- Landing now uses `ARC3CanvasPlayer` instead of MP4-only playback.
- Replay source URL pattern (same-origin proxy):
  - `/api/arc3/recordings/:gameId/:recordingId`
- Backend proxy target:
  - `https://three.arcprize.org/api/recordings/:gameId/:recordingId`
- Reason for proxy:
  - Official recording endpoints are served as `application/x-ndjson` and are not consistently browser-CORS-friendly for direct client fetches.

## 3. Curated Landing Replay Set
The landing rotation currently uses:
- `ls20-fa137e247ce6 / 7405808f-ec5b-4949-a252-a1451b946bae`
- `vc33-6ae7bf49eea5 / 29409ce8-c164-447e-8810-828b96fa4ceb`
- `ft09-b8377d4b7815 / 39b51ef3-b565-43fe-b3a8-7374ca4c5058`
- `lp85-d265526edbaa / dc3d96aa-762b-4c2e-ac68-6418c8f54c74`
- `as66-f340c8e5138e / 7408e07e-83ca-4fbb-b9eb-1ed888cd751e-short`

The AS66 entry above is the replay endpoint reported during debugging.

## 4. Rendering Notes
- `ARC3CanvasPlayer` parses NDJSON lines and extracts frame grids from `data.frame`.
- Landing limits replay playback to an initial frame window (`maxFrames`) for predictable hero rotation timing.
- Replay completion advances the landing replay index when reduced-motion is not enabled.

## 5. Maintenance
- When adding new ARC3 landing replays, verify the recording endpoint returns valid NDJSON and test via the proxy route first.
- Keep this document and `CHANGELOG.md` aligned with landing behavior changes.
