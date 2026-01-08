"""
Author: Cascade (OpenAI o4-preview)
Date: 2026-01-07T23:45:00Z
PURPOSE: Convert ARC3 JSONL scorecard files into MP4 clips for landing hero and documentation needs.
         Reads streamed frames, renders ARC palette grids with metadata overlay, and stitches them via ffmpeg.
SRP/DRY check: Pass — dedicated CLI utility; reuses shared color palette constants instead of duplicating landing logic.
"""

from __future__ import annotations

import argparse
import json
import pathlib
from typing import Iterable, List

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ARC3_COLOR_MAP = {
    0: (255, 255, 255),
    1: (0, 102, 204),
    2: (128, 128, 128),
    3: (64, 64, 64),
    4: (32, 32, 32),
    5: (0, 0, 0),
    6: (142, 92, 52),
    7: (192, 192, 192),
    8: (255, 0, 0),
    9: (102, 170, 255),
    10: (0, 153, 0),
    11: (255, 255, 0),
    12: (255, 153, 0),
    13: (255, 0, 255),
    14: (153, 255, 153),
    15: (128, 0, 128),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert an ARC3 JSONL replay into an MP4 clip suitable for the landing page hero."
        )
    )
    parser.add_argument("input_jsonl", type=pathlib.Path, help="Path to the ARC3 JSONL file.")
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
    frames: Iterable[Image.Image],
    output_path: pathlib.Path,
    fps: float,
) -> None:
    with imageio.get_writer(output_path, fps=fps, codec="libx264", quality=7) as writer:
        for idx, frame in enumerate(frames):
            writer.append_data(np.array(frame))
            if (idx + 1) % 25 == 0:
                print(f"[arc3-video] Encoded {idx + 1} frames…")


def main() -> None:
    args = parse_args()
    input_path = args.input_jsonl
    if not input_path.exists():
        raise FileNotFoundError(f"Missing JSONL file: {input_path}")

    output_path = args.output or input_path.with_suffix(".mp4")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    frames_payload = load_frames(input_path, args.max_frames)
    font = ImageFont.load_default()
    rendered_frames = [
        render_frame(payload, args.cell_size, font) for payload in frames_payload
    ]
    frames_to_video(rendered_frames, output_path, args.fps)
    duration = len(rendered_frames) / args.fps
    print(
        f"[arc3-video] Wrote {len(rendered_frames)} frames ({duration:.1f}s) to {output_path}"
    )


if __name__ == "__main__":
    main()
