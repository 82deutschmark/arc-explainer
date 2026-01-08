"""
Author: Cascade (Claude claude-sonnet-4-20250514)
Date: 2026-01-08T01:15:00Z
PURPOSE: Convert ARC3 JSONL scorecard files into MP4 clips for landing hero and documentation needs.
         Reads streamed frames, renders ARC palette grids with metadata overlay, and stitches them via ffmpeg.
         Supports batch encoding of all available replays in arc3/ and public/replays/ directories.
SRP/DRY check: Pass — dedicated CLI utility; uses canonical ARC3 color palette matching shared/config/arc3Colors.ts.
"""

from __future__ import annotations

import argparse
import glob
import json
import pathlib
from datetime import datetime
from typing import Iterable, List

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


# Canonical ARC3 color palette - matches shared/config/arc3Colors.ts (single source of truth)
# Values 0-5: Grayscale (white to black)
# Values 6-15: Colors for game objects
ARC3_COLOR_MAP = {
    0: (255, 255, 255),   # White
    1: (204, 204, 204),   # Light Gray
    2: (153, 153, 153),   # Gray
    3: (102, 102, 102),   # Dark Gray
    4: (51, 51, 51),      # Darker Gray
    5: (0, 0, 0),         # Black
    6: (229, 58, 163),    # Pink (#E53AA3)
    7: (255, 123, 204),   # Light Pink (#FF7BCC)
    8: (249, 60, 49),     # Red (#F93C31)
    9: (30, 147, 255),    # Blue (#1E93FF)
    10: (136, 216, 241),  # Light Blue (#88D8F1)
    11: (255, 220, 0),    # Yellow (#FFDC00)
    12: (255, 133, 27),   # Orange (#FF851B)
    13: (146, 18, 49),    # Dark Red (#921231)
    14: (79, 204, 48),    # Green (#4FCC30)
    15: (163, 86, 208),   # Purple (#A356D0)
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert ARC3 JSONL replays into MP4 clips. Supports single file or batch mode."
        )
    )
    parser.add_argument(
        "input_jsonl",
        type=pathlib.Path,
        nargs="?",
        default=None,
        help="Path to a single ARC3 JSONL file (omit for batch mode with --batch).",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=pathlib.Path,
        help="Optional output path. Defaults to <input>.mp4 beside the source file.",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=6.0,
        help="Frames per second for the rendered clip (default: 6).",
    )
    parser.add_argument(
        "--cell-size",
        type=int,
        default=12,
        help="Pixel size for each grid cell (default: 12).",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Optional cap for frames (useful when trimming long sessions).",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Encode all JSONL files in arc3/ and public/replays/ directories.",
    )
    parser.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=None,
        help="Output directory for batch mode (default: client/public/videos/arc3/).",
    )
    return parser.parse_args()


def load_frames(jsonl_path: pathlib.Path, max_frames: int | None = None) -> List[dict]:
    frames: List[dict] = []
    with jsonl_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = json.loads(line)
            frames.append(record)
            if max_frames is not None and len(frames) >= max_frames:
                break
    if not frames:
        raise ValueError(f"No frames parsed from {jsonl_path}")
    return frames


def filter_frame_events(frames_payload: List[dict], file_label: str) -> List[dict]:
    """Remove entries that do not contain a frame."""
    filtered: List[dict] = []
    skipped = 0
    for payload in frames_payload:
        data = payload.get("data") or {}
        if "frame" not in data:
            skipped += 1
            continue
        filtered.append(payload)

    if skipped:
        print(f"[arc3-video] Skipped {skipped} non-frame events in {file_label}")

    if not filtered:
        raise ValueError(f"No frame events found in {file_label}")

    return filtered


def calculate_frame_durations(
    frames_payload: List[dict],
) -> List[int]:
    """
    Calculate display duration (ms) for each frame based on timestamps.
    Preserves animation timing but caps long thinking pauses.

    Strategy:
    - Frames < 2s apart: keep natural timing (animation sequences)
    - Frames >= 2s apart: cap at 1500ms (skip long thinking/waiting)
    - Minimum per frame: 150ms (prevents jitter)

    Returns list of durations in milliseconds, one per frame.
    """
    durations: List[int] = []

    for i, frame_payload in enumerate(frames_payload):
        ts_str = frame_payload.get("timestamp", "")
        try:
            ts_current = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            durations.append(300)
            continue

        if i + 1 < len(frames_payload):
            ts_next_str = frames_payload[i + 1].get("timestamp", "")
            try:
                ts_next = datetime.fromisoformat(ts_next_str.replace('Z', '+00:00'))
                delta_ms = int((ts_next - ts_current).total_seconds() * 1000)
            except (ValueError, AttributeError):
                delta_ms = 300
        else:
            delta_ms = 500

        # Preserve animation sequences (< 2s), clamp long pauses (>= 2s)
        if delta_ms < 2000:
            # Animation or normal gameplay: keep natural timing
            display_ms = max(delta_ms, 150)
        else:
            # Long pause (thinking/waiting): clamp to 1500ms max
            display_ms = 1500

        durations.append(display_ms)

    return durations


def render_frame(
    frame_payload: dict,
    cell_size: int,
    font: ImageFont.FreeTypeFont,
    overlay_height: int = 80,
) -> Image.Image:
    raw_frame = frame_payload["data"]["frame"]
    # ARC3 scorecards sometimes wrap the grid in an extra list (e.g., [grid])
    if (
        isinstance(raw_frame, list)
        and raw_frame
        and isinstance(raw_frame[0], list)
        and raw_frame[0]
        and isinstance(raw_frame[0][0], list)
    ):
        grid = raw_frame[0]
    else:
        grid = raw_frame

    rows = len(grid)
    cols = len(grid[0])

    img_width = cols * cell_size
    img_height = rows * cell_size + overlay_height
    image = Image.new("RGB", (img_width, img_height), color=(2, 6, 23))
    draw = ImageDraw.Draw(image)

    # Draw the grid cells
    for r, row in enumerate(grid):
        for c, value in enumerate(row):
            color = ARC3_COLOR_MAP.get(value, (255, 255, 255))
            x0 = c * cell_size
            y0 = r * cell_size
            draw.rectangle([x0, y0, x0 + cell_size, y0 + cell_size], fill=color)

    # Overlay metadata panel
    panel_top = rows * cell_size
    draw.rectangle(
        [0, panel_top, img_width, img_height],
        fill=(3, 13, 45),
    )

    text_color = (226, 232, 240)
    game_id = frame_payload["data"].get("game_id", "arc3-game")
    score = frame_payload["data"].get("score", 0)
    frame_state = frame_payload["data"].get("state", "UNKNOWN")
    timestamp = frame_payload.get("timestamp", "n/a")

    draw.text((16, panel_top + 10), f"Game: {game_id}", font=font, fill=text_color)
    draw.text((16, panel_top + 36), f"Score: {score}", font=font, fill=text_color)
    draw.text((200, panel_top + 36), f"State: {frame_state}", font=font, fill=text_color)
    draw.text((16, panel_top + 58), f"Timestamp: {timestamp}", font=font, fill=(148, 163, 184))

    return image


def frames_to_video(
    frames_with_durations: Iterable[tuple[Image.Image, int]],
    output_path: pathlib.Path,
    fps: float,
) -> None:
    """
    Write frames to video, respecting per-frame display durations.

    Each frame is rendered for (duration_ms * fps / 1000) output frames.
    """
    with imageio.get_writer(output_path, fps=fps, codec="libx264", quality=7) as writer:
        total_encoded = 0
        for frame_img, duration_ms in frames_with_durations:
            # Calculate how many video frames to write for this duration at target fps
            num_frames = max(1, int(round(fps * duration_ms / 1000.0)))
            frame_array = np.array(frame_img)
            for _ in range(num_frames):
                writer.append_data(frame_array)
                total_encoded += 1
            if total_encoded % 25 == 0:
                print(f"[arc3-video] Encoded {total_encoded} frames…")


def find_all_jsonl_files() -> List[pathlib.Path]:
    """Discover all JSONL replay files in arc3/ and public/replays/ directories."""
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
    patterns = [
        repo_root / "arc3" / "*.jsonl",
        repo_root / "public" / "replays" / "*.jsonl",
    ]
    files: List[pathlib.Path] = []
    for pattern in patterns:
        files.extend(pathlib.Path(p) for p in glob.glob(str(pattern)))
    return sorted(set(files))


def encode_single_file(
    input_path: pathlib.Path,
    output_path: pathlib.Path,
    fps: float,
    cell_size: int,
    max_frames: int | None,
) -> None:
    """Encode a single JSONL file to MP4."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frames_payload = load_frames(input_path, max_frames)
    frames_payload = filter_frame_events(frames_payload, input_path.name)
    font = ImageFont.load_default()

    # Calculate per-frame display durations from timestamps
    durations_ms = calculate_frame_durations(frames_payload)

    # Render frames and pair with durations
    rendered_frames_with_durations = [
        (render_frame(payload, cell_size, font), duration_ms)
        for payload, duration_ms in zip(frames_payload, durations_ms)
    ]

    # Send to video writer
    frames_to_video(rendered_frames_with_durations, output_path, fps)

    # Calculate and report total duration
    total_duration_ms = sum(durations_ms)
    total_duration_s = total_duration_ms / 1000.0
    print(
        f"[arc3-video] Wrote {len(frames_payload)} frames ({total_duration_s:.1f}s) to {output_path}"
    )


def main() -> None:
    args = parse_args()

    if args.batch:
        repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
        output_dir = args.output_dir or (repo_root / "client" / "public" / "videos" / "arc3")
        output_dir.mkdir(parents=True, exist_ok=True)

        jsonl_files = find_all_jsonl_files()
        if not jsonl_files:
            print("[arc3-video] No JSONL files found in arc3/ or public/replays/")
            return

        print(f"[arc3-video] Batch mode: found {len(jsonl_files)} JSONL files")
        for jsonl_path in jsonl_files:
            game_name = jsonl_path.stem.split(".")[0]
            output_path = output_dir / f"{game_name}.mp4"
            print(f"[arc3-video] Encoding {jsonl_path.name} -> {output_path.name}")
            try:
                encode_single_file(
                    jsonl_path, output_path, args.fps, args.cell_size, args.max_frames
                )
            except Exception as e:
                print(f"[arc3-video] ERROR encoding {jsonl_path.name}: {e}")
        print(f"[arc3-video] Batch complete. Output directory: {output_dir}")
    else:
        if args.input_jsonl is None:
            print("[arc3-video] ERROR: Must provide input_jsonl or use --batch mode")
            return
        input_path = args.input_jsonl
        if not input_path.exists():
            raise FileNotFoundError(f"Missing JSONL file: {input_path}")

        output_path = args.output or input_path.with_suffix(".mp4")
        encode_single_file(
            input_path, output_path, args.fps, args.cell_size, args.max_frames
        )


if __name__ == "__main__":
    main()
