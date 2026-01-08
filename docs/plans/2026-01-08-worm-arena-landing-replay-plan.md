## 2026-01-08 – Worm Arena Landing Replay Plan

**Status:** Completed – 2026-01-08

### 1. Context & Problem
- Landing hero currently has two slices (ARC1/2 GIF rotator + ARC3 canvas replays).
- Worm Arena has rich replay infrastructure (`WormArenaReplayViewer`, `useWormArenaGreatestHits`, `/api/snakebench/greatest-hits`) but none of it is surfaced on the landing page.
- Owner wants a **three-slice** hero that also showcases Worm Arena replays we already host, using the same deterministic data as the Worm Arena page.

### 2. Objectives
1. Add a third landing slice that highlights curated Worm Arena replays without loading the full Worm Arena page.
2. Keep the section lightweight (fast landing load) while still animating or rotating through real matches.
3. Reuse existing hooks/utilities (e.g., `useWormArenaGreatestHits`, `WormArenaGameBoard`) instead of duplicating network logic.
4. Maintain accessibility + reduced-motion safeguards like the rest of the hero.

### 3. Deliverables
- **New landing slice** that:
  - Fetches a small list of matches (likely from greatest hits endpoint).
  - Renders a compact Worm Arena board or animated frame snippet with key metadata (models, match ID, link to `/worm-arena?gameId=...`).
  - Auto-rotates through the fetched matches similar to ARC galleries.
- Supporting utility/component for minimal replay preview (e.g., `WormArenaLandingReplay.tsx`).
- Updated `LandingPage.tsx` layout (three-column on desktop, stacked on mobile).
- CHANGELOG + plan completion note upon finish.

### 4. Implementation Approach
1. **Data Layer**
   - Leverage `useWormArenaGreatestHits` to fetch curated matches (limit ~3).
   - For each match, hit `/api/snakebench/games/:id` on demand or embed minimal state already provided (if available) to avoid duplicate HTTP.
   - Cache/serialize enough frame data to render a short loop (maybe first ~5 frames) to keep payload light.

2. **Preview Component**
   - Create `WormArenaLandingReplay`:
     - Accepts match metadata + frames.
     - Uses `WormArenaGameBoard` (emoji canvas) for continuity but trims controls to essential playback + CTA.
     - Handles reduced-motion (pause animation) and manual play/pause.
     - Displays matchup labels, score delta, and copyable match ID.

3. **Landing Layout**
   - Update hero grid to 3 columns on desktop (`md:grid-cols-3`), stacked on mobile.
   - Ensure spacing/typography matches existing aesthetic (dark gradient background, card hover states).
   - Maintain ARC1/2 + ARC3 sections untouched aside from layout adjustments.

4. **Prefetch & Rotation**
   - On load, fetch Worm Arena hits; while loading show shimmer/loader.
   - When data arrives, rotate through matches every N seconds similar to ARC sections.
   - Provide manual link to `/worm-arena` for full experience.

5. **Testing & Verification**
   - Manual QA with reduced-motion enabled/disabled.
   - Confirm network traffic stays minimal (limit fetch counts).
   - Test on mobile (stacked layout) and desktop (three columns).
   - Verify `ARC3CanvasPlayer` unaffected.

### 5. Risks & Mitigations
- **Payload size**: limit frames retrieved (e.g., first 10) or reuse simplified state to keep hero snappy.
- **Autoplay conflicts**: ensure only active section animates; pause when hidden or reduced-motion set.
- **API latency**: show fallback card encouraging click-through if data fails to load.

### 6. Exit Criteria
- Landing page hero shows three slices (ARC1/2 GIFs, ARC3 canvas, Worm Arena replays) with consistent styling.
- Worm slice rotates through real matches and links to `/worm-arena`.
- Plan marked complete + CHANGELOG updated with what/why/how, referencing new component(s).
