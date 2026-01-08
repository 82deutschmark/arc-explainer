# Landing “Choose Your Path” Hero
**Author:** Cascade (OpenAI o4-preview)  
**Date:** 2026-01-07  
**Purpose:** Document the split landing hero that presents ARC 1&2 exploration beside an ARC-3 replay, plus the replay asset pipeline.

---

## 1. Overview
- `/` now renders a two-column hero:
  - **Left slice:** Rotating ARC 1&2 GIF previews, CTA buttons (“Browse ARC 1&2 puzzles”, “View analytics”), dataset stats blurb.
  - **Right slice:** Embedded MP4 replay generated from ARC-3 scorecard JSONL data with metadata overlay and CTA buttons (“Launch ARC-3 arena”, “See agent plan”).
- Respect reduced-motion preferences: GIF rotation pauses and the replay video auto-pausing.
- Layout target: purposeful dark gradient background, rounded cards, reused `Button` + `buttonVariants`.

---

## 2. ARC 1&2 Slice Details
- Source assets: `/images/decoration/arc_puzzle_*.gif`.
- State: `activeIndex` cycles through `PUZZLE_GIF_GALLERY` every 4.5s (`ROTATION_INTERVAL_MS`).
- Accessibility:
  - `prefers-reduced-motion` short-circuits rotation so the current GIF remains static.
  - Each GIF uses descriptive `alt`.
  - Entire preview is wrapped in `<Link href={`/task/${activeGif.id}`}>` for immediate puzzle access.
- CTAs reuse `Button` (primary) and ghost variant (secondary) to `/browser` and `/analytics`.
- Dataset stats string communicates scope (puzzle count, solver families, analytics link).

---

## 3. ARC-3 Replay Slice
- Video path: `/videos/arc3/choose-your-path.mp4` (20 seconds, 120 frames, fps=6).
- Metadata overlay displays `gameId`, duration, frame count; CTA buttons go to `/arc3/games` and documentation.
- Reduced-motion guard pauses autoplay and exposes native controls for manual playback.
- Poster image uses `/ls20.png` (existing public asset) to avoid blank frames before buffering.

---

## 4. Replay Generation Pipeline
1. **Script location:** `scripts/arc3/generate_arc3_video.py`
   - Reads ARC-3 JSONL scorecards (found under `arc3/` or `public/replays/`).
   - Handles frame payloads with or without extra nesting.
   - Renders each frame via Pillow with color palette + metadata strip.
   - Encodes MP4 via `imageio` + `imageio-ffmpeg`.
2. **Dependencies:** Ensure `imageio` and `imageio-ffmpeg` are installed (`requirements.txt` updated).
3. **Usage example:**
   ```
   python scripts/arc3/generate_arc3_video.py \
     arc3/ls20-fa137e247ce6.7405808f-ec5b-4949-a252-a1451b946bae.jsonl \
     --output client/public/videos/arc3/choose-your-path.mp4 \
     --fps 6 \
     --cell-size 10 \
     --max-frames 120
   ```
4. **Output location:** `client/public/videos/arc3/`. Commit short clips (<5 MB) directly; otherwise upload to CDN and update `ARC3_REPLAY_METADATA.clipPath`.

---

## 5. Maintenance Checklist
- When adding new ARC-3 clips, rerun the script and update `ARC3_REPLAY_METADATA`.
- Keep GIF gallery in sync with `/images/decoration/` assets; remove entries if files disappear.
- Update this doc plus `CHANGELOG.md` whenever the hero behavior or pipeline changes.
