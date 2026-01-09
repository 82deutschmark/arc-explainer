# Plan - Fix ARC3 Video Generation Frame Skipping

## Problem
The `generate_arc3_video.py` script currently filters out events that do not contain a "frame" key. In ARC3, some events (especially animations like the purple stream after Action 5) are sent as incremental updates (deltas) rather than full frame snapshots. Discarding these events leads to "frozen time" or skipped animations in the generated videos.

## Objectives
1.  Modify `generate_arc3_video.py` to maintain a persistent grid state.
2.  Process every event in the JSONL file.
3.  If an event has a `frame` key, update the full state.
4.  If an event lacks a `frame` key but has other state updates (like grid deltas), apply them to the current state.
5.  Render a video frame for every event to capture smooth animations.
6.  Regenerate videos for `SP-80` and `AS-66`.

## Proposed Changes

### `scripts/arc3/generate_arc3_video.py`
- Update `load_frames` to return all records.
- Remove `filter_frame_events`.
- Update `encode_single_file` to:
    - Initialize a `last_grid` variable.
    - Loop through all payloads.
    - Extract grid updates from `payload["data"]["frame"]` or other relevant delta keys.
    - Update `last_grid`.
    - Render the frame using the updated `last_grid`.
- Ensure `render_frame` can handle the persistent grid state.

## Verification Plan
1.  Run the updated script on `SP-80` and `AS-66` JSONL files.
2.  Inspect the output MP4 files to ensure the "Action 5" animation (purple stream) is visible and smooth.
3.  Update `CHANGELOG.md`.
