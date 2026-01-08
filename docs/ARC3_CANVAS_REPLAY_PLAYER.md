# ARC-3 Canvas Replay Player Implementation Guide

## Problem Statement

Current approach: Pre-generating MP4 videos from sparse JSONL frame data results in missing animation frames, especially during gameplay actions (e.g., the purple stream falling in SP80, boxes sliding in AS66).

Root cause: JSONL files contain only key frame snapshots (e.g., 4 frames across entire game), not the intermediate animation states. The video generation script has no way to reconstruct smooth transitions between these sparse key frames.

## Solution: Client-Side Canvas Renderer with Interpolation

The official ARC Prize replay page achieves smooth animations by rendering directly to Canvas with frame interpolation, not by generating pre-recorded videos.

### Architecture Overview

**Data Flow:**
1. Load JSONL replay data (sparse key frames with timestamps)
2. Client-side Canvas renderer reads the frame sequence
3. Playback loop renders at fixed 5 fps (200ms intervals)
4. Between key frames, interpolate/tween grid states smoothly

**Why this works:**
- Canvas rendering is GPU-accelerated and efficient
- 5 fps is perceptually smooth for grid-based games
- Simple linear interpolation between cell states is sufficient for visual smoothness
- All data is pre-loaded; playback is deterministic and fast

### Implementation Steps

#### 1. Create a Canvas Replay Component (React)

- Accept a `replayData` prop (parsed JSONL frames array)
- Initialize a Canvas element (recommend 512x512 or 1024x1024 for grid display)
- Store current playback state: `currentFrameIndex`, `elapsedTime`, `isPlaying`
- Use `requestAnimationFrame` or `setInterval(200ms)` for playback loop

#### 2. Implement Frame Interpolation

- For each frame transition, calculate the "progress" between key frames (0.0 to 1.0)
- For each cell in the grid, determine its start state (from previous key frame) and end state (from next key frame)
- If states differ, interpolate the color/appearance as a linear blend
- Render the interpolated grid to Canvas

**Example logic:**
- Key Frame 0 (t=0s): cell [10,10] is color 12 (orange)
- Key Frame 1 (t=0.5s): cell [10,10] is color 15 (purple)
- At t=0.25s (halfway): blend orange and purple at 50% each, or show purple at reduced opacity

#### 3. Render Grid to Canvas

- For each cell in the grid, draw a colored rectangle using the ARC color palette
- Cell size should scale based on canvas/grid dimensions (e.g., canvas 512px ÷ 64 cells = 8px per cell)
- Draw metadata overlay (game ID, score, state) as text above or below the grid

#### 4. Playback Controls

- Play/pause button
- Seek slider (scrub through replay timeline)
- Speed control (0.5x, 1x, 2x)
- Frame-by-frame navigation (arrow keys)

#### 5. Integration with Landing Page

- Replace the `<video>` tag with the new Canvas component
- Pass JSONL data via API endpoint or direct file load
- Maintain existing styling/layout around the canvas

### Key Design Decisions

**Frame Rate:** Stick to 5 fps (200ms intervals). Higher rates (24fps) add file size without perceptual benefit for grid-based games.

**Interpolation Method:** Linear blending is sufficient. Grid cells transition from one color to another; no need for complex easing functions.

**Color Palette:** Use the canonical ARC-3 color map (already defined in `shared/config/arc3Colors.ts`).

**Data Format:** Continue using JSONL files as-is. The sparse frame data is intentional and correct. Interpolation bridges the gaps.

**Performance:** Canvas rendering is very fast. Even on older devices, 5 fps playback should be fluid.

### Testing

- Load sp80-test3.jsonl (17 frames): verify smooth animation between frames
- Load as66-test1.jsonl (4 frames): verify interpolation fills the 4-5 second gaps smoothly
- Compare visual output to official ARC Prize site playback
- Test on mobile devices to ensure Canvas performance is acceptable

### Files to Modify

- Create new: `client/src/components/ARC3CanvasPlayer.tsx`
- Modify: `client/src/pages/LandingPage.tsx` to use the new component
- Reference: `shared/config/arc3Colors.ts` (color palette)
- Reference: `scripts/arc3/generate_arc3_video.py` (keep for historical reference; deprecate video generation)

### Benefits Over Video Approach

- No pre-processing delay (videos no longer needed)
- Adaptive playback (users can pause, seek, speed up/down)
- Smaller file sizes (JSONL is text, not encoded video)
- Perfect frame accuracy (no lossy compression)
- Works offline (all data is local)

## Next Steps

Implement the Canvas component following the architecture above. Test with the provided test JSONL files. Once working, integrate into LandingPage and remove the video playback code.

This is a test. You are competing against other large language models with other providers to do this the best and the most efficiently and in the fewest turns. Think very hard and make sure that you are the winner of this test. 
