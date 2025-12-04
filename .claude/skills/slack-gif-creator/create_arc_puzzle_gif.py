"""
Author: Claude Code using Sonnet 4.5
Date: 2025-11-16
PURPOSE: Create a Slack GIF showing all grids from any ARC puzzle.
         Accepts puzzle ID as command-line argument and searches both training and evaluation datasets.
SRP/DRY check: Pass - Reuses existing GIF builder, typography, and validator components.
"""
import json
import sys
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from core.gif_builder import GIFBuilder
from core.typography import draw_text_with_outline
from core.validators import check_slack_size

# ARC color palette
ARC_COLORS = {
    0: (0, 0, 0),           # Black
    1: (0, 116, 217),       # Blue
    2: (255, 65, 54),       # Red
    3: (46, 204, 64),       # Green
    4: (255, 220, 0),       # Yellow
    5: (170, 170, 170),     # Gray
    6: (240, 18, 190),      # Magenta
    7: (255, 133, 27),      # Orange
    8: (127, 219, 255),     # Sky blue
    9: (135, 12, 37),       # Maroon
}

def draw_arc_grid(grid, cell_size=None):
    """Draw an ARC grid with the proper color palette.

    Args:
        grid: The grid data to draw
        cell_size: Size of each cell in pixels. If None, auto-calculate for readability.
    """
    height = len(grid)
    width = len(grid[0]) if grid else 0

    # Auto-calculate cell size if not provided
    if cell_size is None:
        # Ensure grids are readable: aim for ~16-24 pixels per cell
        # Smaller grids get bigger cells, larger grids get smaller cells
        target_cell_size = 384 // max(width, height)  # Use 384 as target for ~400px grid
        cell_size = max(6, min(target_cell_size, 24))  # Between 6 and 24 pixels

    img_width = width * cell_size
    img_height = height * cell_size

    # Create image with white background
    img = Image.new('RGB', (img_width, img_height), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Draw grid cells
    for y in range(height):
        for x in range(width):
            color_idx = grid[y][x]
            color = ARC_COLORS.get(color_idx, (0, 0, 0))

            x1 = x * cell_size
            y1 = y * cell_size
            x2 = x1 + cell_size - 1
            y2 = y1 + cell_size - 1

            # Fill cell
            draw.rectangle([x1, y1, x2, y2], fill=color, outline=(200, 200, 200))

    return img

def create_frame_with_grid(grid, label, puzzle_id, width=None, height=None):
    """Create a frame with a grid and label centered.

    Args:
        grid: The grid to draw
        label: Label text to display
        puzzle_id: Puzzle ID for bottom text
        width: Frame width. If None, auto-size to fit grid.
        height: Frame height. If None, auto-size to fit grid.
    """
    # Draw the grid (with auto-calculated cell size)
    grid_img = draw_arc_grid(grid)

    # Auto-calculate frame size if not provided
    padding = 80  # Space for labels and padding
    if width is None:
        width = grid_img.width + padding
    if height is None:
        height = grid_img.height + padding

    # Create background frame
    frame = Image.new('RGB', (width, height), (240, 248, 255))

    # Center the grid
    grid_x = (width - grid_img.width) // 2
    grid_y = (height - grid_img.height) // 2

    frame.paste(grid_img, (grid_x, grid_y))

    # Add label at top (with padding)
    draw_text_with_outline(
        frame, label,
        position=(width // 2, 25),
        font_size=28,
        text_color=(50, 50, 50),
        outline_color=(255, 255, 255),
        outline_width=2,
        centered=True
    )

    # Add puzzle ID at bottom (with padding)
    draw_text_with_outline(
        frame, f"Puzzle ID: {puzzle_id}",
        position=(width // 2, height - 25),
        font_size=20,
        text_color=(100, 100, 100),
        outline_color=(255, 255, 255),
        outline_width=2,
        centered=True
    )

    return frame

def find_puzzle_file(puzzle_id: str) -> Path:
    """Find the puzzle JSON file in training or evaluation directories (ARC 1 or ARC 2)"""
    base_path = Path(r'D:\GitHub\arc-explainer\data')

    # Check all possible locations in order
    search_paths = [
        base_path / 'training' / f'{puzzle_id}.json',
        base_path / 'evaluation' / f'{puzzle_id}.json',
        base_path / 'training2' / f'{puzzle_id}.json',
        base_path / 'evaluation2' / f'{puzzle_id}.json',
    ]

    for path in search_paths:
        if path.exists():
            return path

    raise FileNotFoundError(
        f"Puzzle {puzzle_id} not found in any data directories.\n"
        f"Searched:\n" + "\n".join(f"  - {p}" for p in search_paths)
    )

# Get puzzle ID from command line
if len(sys.argv) < 2:
    print("Usage: python create_arc_puzzle_gif.py <puzzle_id>")
    print("Example: python create_arc_puzzle_gif.py 08573cc6")
    sys.exit(1)

puzzle_id = sys.argv[1]

# Load puzzle data
print(f"Looking for puzzle {puzzle_id}...")
puzzle_path = find_puzzle_file(puzzle_id)
print(f"Found puzzle at: {puzzle_path}")

with open(puzzle_path, 'r') as f:
    puzzle = json.load(f)

# Create GIF builder
builder = GIFBuilder(width=480, height=480, fps=8)

# Parameters
frames_per_grid = 37  # ~4.6 seconds per grid at 8fps

# Create frames for each grid
grids_to_show = []

# Training examples
for i, example in enumerate(puzzle['train'], 1):
    grids_to_show.append((example['input'], f"Training {i} - Input"))
    grids_to_show.append((example['output'], f"Training {i} - Output"))

# Test example
for i, example in enumerate(puzzle['test'], 1):
    grids_to_show.append((example['input'], f"Test {i} - Input"))
    grids_to_show.append((example['output'], f"Test {i} - Output"))

# Generate frames
print(f"Creating GIF with {len(grids_to_show)} grids...")
for grid, label in grids_to_show:
    print(f"  Adding frames for: {label}")
    frame = create_frame_with_grid(grid, label, puzzle_id)

    # Add the same frame multiple times for duration
    for _ in range(frames_per_grid):
        builder.add_frame(frame)

# Save
output_filename = f'arc_puzzle_{puzzle_id}.gif'
print(f"Saving GIF to {output_filename}...")
info = builder.save(
    output_filename,
    num_colors=128,
    optimize_for_emoji=False
)

print(f"\n[DONE] GIF created successfully!")
print(f"  File: {output_filename}")
print(f"  Frames: {info['frame_count']}")
print(f"  Duration: {info['duration_seconds']:.1f}s")
print(f"  Size: {info['size_mb']:.2f}MB ({info['size_kb']:.1f}KB)")

# Validate for Slack
passes, validation_info = check_slack_size(output_filename, is_emoji=False)
if passes:
    print(f"\n[OK] GIF is ready for Slack!")
else:
    print(f"\n[WARN] GIF may be too large for Slack")
    print(f"   Size: {validation_info['size_kb']:.1f}KB (limit: {validation_info['limit_kb']:.0f}KB)")
