# ARC3 Scorecard to Video Conversion Plan

**Date**: 2025-12-29
**Goal**: Enable conversion of ARC3 game scorecard .jsonl files to MP4 videos or animated GIFs

---

## Summary

The user wants to convert ARC3 game scorecard files (JSONL format) into videos showing the game progression. We have a proven, production-ready pattern to adapt from SnakeBench/Worm Arena's existing video generation system.

**Example input file**: `arc3/as66-821a4dcad9c2.db85123a-891c-4fde-8bd3-b85c6702575d.jsonl` (155 frames)

---

## Understanding the Data Format

### JSONL vs JSON
- **JSONL (JSON Lines)**: Multiple JSON objects, one per line (vs single-object .json)
- **Advantage for replays**: Stream-friendly, append-only, memory-efficient
- **ARC3 scorecard structure**:
  ```
  Each line = one frame containing:
  - timestamp: When frame occurred
  - data.game_id: Game identifier
  - data.frame: 2D array (the grid state)
  - data.score: Current score at this frame
  - data.state: Game state
  - data.action_input: Action taken
  - metadata: guid, available_actions, full_reset, win_score
  ```

---

## Existing Infrastructure to Reuse

### SnakeBench Video Generation Pipeline
**Location**: `external/SnakeBench/backend/services/video_generator.py`

**Technologies**:
- **PIL/Pillow v11.1.0**: Render individual frames as images
- **MoviePy v1.0.3**: Encode image sequences into MP4 video
- **FFmpeg (via imageio-ffmpeg v0.6.0)**: Backend codec (libx264 H.264)
- **NumPy v2.2.2**: Frame array manipulation

**Pipeline Architecture**:
1. Load replay data (JSON or normalized format)
2. Render each frame as PIL Image:
   - Draw canvas (game grid/state)
   - Draw side panels (metadata, scores, reasoning)
3. Convert frames to numpy arrays
4. Use MoviePy's ImageSequenceClip to encode MP4

**Key class**: `SnakeVideoGenerator`
- Main method: `generate_video(game_id, replay_data, output_path)`
- Frame rendering: `render_frame(round_data, model_ids, model_names, ...)`
- Canvas drawing: `_draw_game_canvas()`, `_draw_player_panel()`

---

## Critical Questions for User (Clarification Needed)

1. **Grid Visualization**:
   - What do the numeric values in the grid represent? (Colors like standard ARC: 0-9 palette?)
   - What's the color mapping? (Look at ARC3 UI in client/)
   - Cell size in pixels? (SnakeBench uses 40px per cell)

2. **Metadata Display**:
   - What information should appear alongside the grid?
   - Show score, round number, model reasoning?
   - Any panels or text overlay needed?

3. **Video Specifications**:
   - Target resolution? (SnakeBench default: 1920x1080)
   - FPS? (SnakeBench default: 2 fps, matches 500ms playback)
   - MP4 or animated GIF? (Both possible; GIF requires slack-gif-creator skill)

4. **File Organization**:
   - Where should new code live? (e.g., `server/services/arc3VideoGenerator.ts` or `.py`?)
   - CLI tools in `server/cli/`?

---

## Implementation Approach

### Phase 1: Research & Setup
- [ ] Examine how ARC3 grids are rendered in client UI
- [ ] Identify color palette and grid dimensions
- [ ] Get answers to clarification questions above
- [ ] Set up dependencies (PIL, MoviePy, NumPy)

### Phase 2: Create ARC3VideoGenerator
- [ ] Create new service file: `server/services/arc3VideoGenerator.ts` (or `.py` if Python preferred)
- [ ] Mirror structure of `external/SnakeBench/backend/services/video_generator.py`
- [ ] Implement frame parsing from JSONL (line-by-line reading)
- [ ] Adapt grid rendering logic:
  - Replace snake/apple rendering with ARC3 grid rendering
  - Use correct color palette
  - Draw grid cells based on frame data

### Phase 3: Implement Frame Rendering
- [ ] Create PIL Image for each frame
- [ ] Draw ARC3 grid (colored cells)
- [ ] Add metadata panels (score, round number, action details)
- [ ] Convert to numpy arrays for MoviePy

### Phase 4: Video Encoding
- [ ] Use MoviePy's ImageSequenceClip
- [ ] Configure resolution, FPS, codec
- [ ] Handle output path and file naming

### Phase 5: CLI & Testing
- [ ] Create CLI tool for single video generation
- [ ] Create batch processing tool for multiple scorecards
- [ ] Test with `arc3/as66-821a4dcad9c2.db85123a-891c-4fde-8bd3-b85c6702575d.jsonl`
- [ ] Validate output quality

### Phase 6: Documentation
- [ ] Document usage in README or DEVELOPER_GUIDE
- [ ] Update CHANGELOG

---

## Technical Reference

### Color Palette (from SnakeBench - pattern to follow)
```python
COLOR_SCHEME = {
    'player_1': (79, 112, 34),      # Olive green
    'player_2': (3, 108, 142),      # Teal blue
    'apple': (234, 32, 20),         # Red
    'grid_lines': (229, 231, 235),  # Light gray
    'background': (26, 31, 46)      # Dark blue
}
```

### Resolution & Performance (SnakeBench defaults)
```python
width = 1920
height = 1080
fps = 2  # Matches replay playback speed
cell_size = 40  # pixels per grid cell
```

---

## Files to Create/Modify

**New files**:
- `server/services/arc3VideoGenerator.ts` (main service)
- `server/cli/generateArc3Video.ts` (single video CLI)
- `server/cli/generateArc3VideosBatch.ts` (batch processing)

**Reference files** (read-only):
- `external/SnakeBench/backend/services/video_generator.py` (template pattern)
- `external/SnakeBench/backend/cli/generate_video.py` (CLI example)
- `external/SnakeBench/backend/cli/generate_videos_local.py` (batch example)

---

## Potential Output Options

1. **MP4 Video** (recommended):
   - Use MoviePy with libx264 codec
   - Full-featured, standard format
   - Easy to share and playback

2. **Animated GIF** (if needed):
   - Use slack-gif-creator skill (`.claude/skills/slack-gif-creator/SKILL.md`)
   - Limited to 2MB for Slack message GIFs
   - May need aggressive optimization

---

## Notes

- JSONL format is ideal for streaming/real-time game recording
- 155-frame example file suggests ~5-8 second video at 20 FPS (or ~1.5 min at 2 FPS)
- Reusing SnakeBench pattern ensures production-quality, tested code
- No need to reinvent video encoding; adapt proven approach
