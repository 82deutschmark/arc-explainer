# Plan - ARC3 Video Delta Rendering

## Scope
- Fix ARC3 replay video generation so every JSONL event renders a frame.
- Preserve accurate per-event timing from timestamps.
- Update documentation and changelog to reflect behavior changes.

## Objectives
1. Replace frame-only filtering with persistent grid state handling.
2. Apply delta updates for events without `data.frame`.
3. Recompute durations aligned to the rendered frame sequence.
4. Keep rendering logic SRP-focused and documented.

## Implementation Notes
- Add a stateful grid accumulator in `scripts/arc3/generate_arc3_video.py`.
- Detect and apply delta payloads (grid cell updates) when present.
- Render on every event with the current grid state.
- Preserve timestamp-derived duration per event (no slicing).

## Out of Scope
- Redesigning the JSONL schema or upstream streaming format.
- UI changes or new playback controls.

## Verification
1. Run the script for `SP-80` and `AS-66` JSONL files.
2. Confirm purple stream (Action 5) animates smoothly.
3. Spot-check per-event timing is stable (no speed jumps).

## Dependencies / Questions
- Confirm the exact delta payload keys used in ARC3 JSONL events.
