## Plan – Embed ARC3 Replay Videos On Game Pages

**Date:** 2026-01-09  
**Owner:** Cascade (ChatGPT)  
**Scope:** Ensure every ARC3 spoiler page embeds its corresponding MP4 replay clip stored under `client/public/videos/arc3/`.

### Context
- Existing `shared/arc3Games/*.ts` metadata lacks video references.
- Hero/spec sections in `Arc3GameSpoiler.tsx` show text, screenshots, and resource links only.
- Requirement: “all of these pages need to have the mp4 files of their videos included on the page.”
- MP4 assets currently present:  
  - `ls20-fa137e247ce6.mp4`  
  - `as66-test.mp4`  
  - `ft09-b8377d4b7815.mp4`  
  - `lp85-d265526edbaa.mp4`  
  - `sp80-test.mp4`  
  - `vc33-6ae7bf49eea5.mp4`

### Objectives
1. Extend the shared metadata schema so each game can reference a local MP4 path and descriptive caption.
2. Populate video metadata for all six ARC3 games using the assets above (store relative public-path URLs, e.g., `/videos/arc3/ls20-fa137e247ce6.mp4`).
3. Update `Arc3GameSpoiler.tsx` to render an accessible video player section (poster/controls, download fallback) using metadata when present.
4. Verify the clips load in dev build (Vite) without CSP issues and document asset expectations for future games.

### Implementation Steps
1. **Schema Update**
   - Modify `shared/arc3Games/types.ts` to add `video` metadata (fields: `src`, `caption`, optional `poster`).
   - Ensure export surface updated.

2. **Metadata Population**
   - For each game file (`ls20.ts`, `as66.ts`, `ft09.ts`, `lp85.ts`, `sp80.ts`, `vc33.ts`):
     - Add/update header metadata with new author/date.
     - Insert `video` field referencing the correct `/videos/arc3/*.mp4`.
     - Provide concise caption (e.g., “Agent replay of LS20 locksmith clear”).

3. **UI Integration**
   - Update `Arc3GameSpoiler.tsx`:
     - Add new “Featured Replay” card when `game.video` exists.
     - Use `<video controls>` with source fallback text + download link.
     - Respect styling guidance (no AI slop, reuse existing Card components).

4. **Verification**
   - Run `npm run build` (or at minimum `npm run lint` if faster) to ensure TypeScript + Vite compile.
   - Manually verify at least two routes (preview + evaluation) to confirm video renders.

5. **Docs & Changelog**
   - Mention asset embedding in `CHANGELOG.md` (top entry, SemVer note).
   - Note expectation for future MP4 placement in `docs/plans` or relevant README if needed.

### Risks / Mitigations
- **Large Asset Sizes:** Ensure videos already optimized; no change to files themselves.
- **Autoplay Restrictions:** Default to manual playback with controls; avoid autoplay/muted loops.
- **Missing Asset:** If file absent, display graceful message and log warning.

### Approval Needed
Please confirm this plan so I can proceed with implementation.
