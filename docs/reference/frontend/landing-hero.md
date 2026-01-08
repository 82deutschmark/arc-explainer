# Landing Visual Hero
**Author:** Cascade (Claude claude-sonnet-4-20250514)  
**Date:** 2026-01-08  
**Purpose:** Minimal visual landing page with rotating ARC 1&2 GIFs, ARC-3 canvas replays, and Worm Arena replays.

---

## 1. Overview
- `/` renders a three-column visual showcase:
  - **Left:** Rotating ARC 1&2 GIF previews (clickable, links to puzzle).
  - **Middle:** ARC-3 canvas replay (clickable, links to ARC-3 games).
  - **Right:** Worm Arena replay (clickable, links to replay).
- No descriptive text, headlines, or CTA buttons - purely visual with placeholder labels.
- Respects `prefers-reduced-motion`: GIF rotation pauses and replay autoplay is disabled.
- Dark gradient background with subtle borders and hover effects.

---

## 2. ARC 1&2 GIF Showcase
- Source assets: `/images/decoration/arc_puzzle_*.gif`.
- State: `activeIndex` cycles through `PUZZLE_GIF_GALLERY` every 4.5s.
- Accessibility: `prefers-reduced-motion` stops rotation; descriptive `alt` on images.
- Click navigates to `/task/{puzzleId}`.

---

## 3. ARC-3 Replay
- Canvas-based replay via `ARC3CanvasPlayer`, loading JSONL replays from `/replays/`.
- Rotation uses the available non-problem games: `ls20`, `vc33`, `ft09`, `lp85`.
- SP80 and AS66 are intentionally skipped on the landing page while their replays are being fixed.
- Reduced-motion guard disables autoplay.
- Click navigates to `/arc3/games`.

---

## 4. Worm Arena Replay
- Uses curated greatest-hits data from `/api/snakebench/greatest-hits`.
- Fetches replay JSON for the active game from `/api/snakebench/games/{gameId}`.
- Rotation runs every 6 seconds when multiple curated games are available.

## 5. Replay Generation Pipeline

### 4.1 Script Location
`scripts/arc3/generate_arc3_video.py`

### 4.2 Color Palette
Uses canonical ARC3 colors matching `shared/config/arc3Colors.ts`:
- Values 0-5: Grayscale (white to black)
- Values 6-15: Pink, Light Pink, Red, Blue, Light Blue, Yellow, Orange, Dark Red, Green, Purple

### 5.3 Single File Encoding
```bash
python scripts/arc3/generate_arc3_video.py \
  arc3/ls20-fa137e247ce6.7405808f-ec5b-4949-a252-a1451b946bae.jsonl \
  --output client/public/videos/arc3/ls20.mp4 \
  --fps 6 \
  --cell-size 12
```

### 5.4 Batch Encoding (All Games)
```bash
python scripts/arc3/generate_arc3_video.py --batch
```
This encodes all JSONL files in `arc3/` and `public/replays/` to `client/public/videos/arc3/`.

Options:
- `--output-dir PATH` - Custom output directory
- `--fps N` - Frames per second (default: 6)
- `--cell-size N` - Pixel size per cell (default: 12)
- `--max-frames N` - Cap frame count per video

### 5.5 Available Replays
| Game | Source JSONL |
|------|--------------|
| as66 | `arc3/as66-821a4dcad9c2.*.jsonl` |
| ft09 | `arc3/ft09-b8377d4b7815.*.jsonl` |
| lp85 | `arc3/lp85-d265526edbaa.*.jsonl` |
| ls20 | `arc3/ls20-fa137e247ce6.*.jsonl` |
| ms93 | `arc3/ms93-*.jsonl` |
| ot24 | `arc3/ot24-*.jsonl` |

### 5.6 Dependencies
- `imageio`, `imageio-ffmpeg`, `pillow`, `numpy` (see `requirements.txt`)

---

## 6. Maintenance
- Run `--batch` after adding new JSONL replays.
- Keep GIF gallery in sync with `/images/decoration/` assets.
- Update this doc plus `CHANGELOG.md` on changes.
