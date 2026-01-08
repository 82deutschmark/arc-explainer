# Landing Visual Hero
**Author:** Cascade (Claude claude-sonnet-4-20250514)  
**Date:** 2026-01-08  
**Purpose:** Minimal visual landing page with two graphics side-by-side and the replay asset pipeline.

---

## 1. Overview
- `/` renders a two-column visual showcase:
  - **Left:** Rotating ARC 1&2 GIF previews (clickable, links to puzzle).
  - **Right:** Looping ARC-3 MP4 replay (clickable, links to arena).
- No descriptive text, headlines, or CTA buttons - purely visual with placeholder labels.
- Respects `prefers-reduced-motion`: GIF rotation pauses and video auto-pausing.
- Dark gradient background with subtle borders and hover effects.

---

## 2. ARC 1&2 GIF Showcase
- Source assets: `/images/decoration/arc_puzzle_*.gif`.
- State: `activeIndex` cycles through `PUZZLE_GIF_GALLERY` every 4.5s.
- Accessibility: `prefers-reduced-motion` stops rotation; descriptive `alt` on images.
- Click navigates to `/task/{puzzleId}`.

---

## 3. ARC-3 Replay
- Video path: `/videos/arc3/choose-your-path.mp4`.
- Reduced-motion guard pauses autoplay.
- Click navigates to `/arc3/games`.

---

## 4. Replay Generation Pipeline

### 4.1 Script Location
`scripts/arc3/generate_arc3_video.py`

### 4.2 Color Palette
Uses canonical ARC3 colors matching `shared/config/arc3Colors.ts`:
- Values 0-5: Grayscale (white to black)
- Values 6-15: Pink, Light Pink, Red, Blue, Light Blue, Yellow, Orange, Dark Red, Green, Purple

### 4.3 Single File Encoding
```bash
python scripts/arc3/generate_arc3_video.py \
  arc3/ls20-fa137e247ce6.7405808f-ec5b-4949-a252-a1451b946bae.jsonl \
  --output client/public/videos/arc3/ls20.mp4 \
  --fps 6 \
  --cell-size 12
```

### 4.4 Batch Encoding (All Games)
```bash
python scripts/arc3/generate_arc3_video.py --batch
```
This encodes all JSONL files in `arc3/` and `public/replays/` to `client/public/videos/arc3/`.

Options:
- `--output-dir PATH` - Custom output directory
- `--fps N` - Frames per second (default: 6)
- `--cell-size N` - Pixel size per cell (default: 12)
- `--max-frames N` - Cap frame count per video

### 4.5 Available Replays
| Game | Source JSONL |
|------|--------------|
| as66 | `arc3/as66-821a4dcad9c2.*.jsonl` |
| ft09 | `arc3/ft09-b8377d4b7815.*.jsonl` |
| lp85 | `arc3/lp85-d265526edbaa.*.jsonl` |
| ls20 | `arc3/ls20-fa137e247ce6.*.jsonl` |
| ms93 | `arc3/ms93-*.jsonl` |
| ot24 | `arc3/ot24-*.jsonl` |

### 4.6 Dependencies
- `imageio`, `imageio-ffmpeg`, `pillow`, `numpy` (see `requirements.txt`)

---

## 5. Maintenance
- Run `--batch` after adding new JSONL replays.
- Keep GIF gallery in sync with `/images/decoration/` assets.
- Update this doc plus `CHANGELOG.md` on changes.
