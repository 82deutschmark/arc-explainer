#!/usr/bin/env python3
"""
Normalize colors in ARC problems to a consistent palette.
Makes the most common color black (0) and maps other colors consistently.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from collections import Counter
from typing import Dict, List, Tuple
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

# ARC color palette
PALETTE = {
    0: (0, 0, 0),        # black
    1: (0, 116, 217),    # blue
    2: (255, 65, 54),    # red
    3: (46, 204, 64),    # green
    4: (255, 220, 0),    # yellow
    5: (255, 133, 27),   # orange
    6: (240, 18, 190),   # pink
    7: (177, 13, 201),   # dark red/purple
    8: (133, 20, 75),    # maroon
    9: (0, 176, 255),    # light blue
}


def count_colors_in_grid(grid: List[List[int]]) -> Counter:
    """Count occurrences of each color in a grid."""
    counter = Counter()
    for row in grid:
        for cell in row:
            counter[cell] += 1
    return counter


def get_color_mapping(problem: Dict) -> Dict[int, int]:
    """
    Create a color mapping for a problem.
    Maps most common color to 0 (black), then maps other colors to consistent palette.
    """
    # Count all colors across all grids in the problem
    total_counter = Counter()

    for sample in problem.get('train', []):
        total_counter.update(count_colors_in_grid(sample['input']))
        total_counter.update(count_colors_in_grid(sample['output']))

    for sample in problem.get('test', []):
        total_counter.update(count_colors_in_grid(sample['input']))
        if 'output' in sample:
            total_counter.update(count_colors_in_grid(sample['output']))

    # Get unique colors sorted by frequency (most common first)
    sorted_colors = [color for color, _ in total_counter.most_common()]

    # Create mapping: most common -> 0, then sequential
    color_mapping = {}
    for idx, color in enumerate(sorted_colors):
        color_mapping[color] = idx

    return color_mapping


def normalize_grid(grid: List[List[int]], color_mapping: Dict[int, int]) -> List[List[int]]:
    """Apply color mapping to a grid."""
    return [[color_mapping.get(cell, cell) for cell in row] for row in grid]


def grid_to_image(grid: List[List[int]], cell_size: int = 30) -> np.ndarray:
    """Convert a grid to an RGB image array."""
    grid_array = np.array(grid)
    height, width = grid_array.shape

    rgb_image = np.zeros((height * cell_size, width * cell_size, 3), dtype=np.uint8)

    for y in range(height):
        for x in range(width):
            color_id = int(grid_array[y, x])
            color = PALETTE.get(color_id, (128, 128, 128))
            rgb_image[y*cell_size:(y+1)*cell_size, x*cell_size:(x+1)*cell_size] = color

    return rgb_image


def visualize_problem(problem: Dict, color_mapping: Dict[int, int], output_path: str):
    """Create visualization showing original and normalized grids side by side."""
    num_train = len(problem.get('train', []))
    num_test = len(problem.get('test', []))

    # Calculate grid layout: 4 columns (original input, normalized input, original output, normalized output)
    num_rows = num_train + num_test
    fig, axes = plt.subplots(num_rows, 4, figsize=(16, 4 * num_rows))

    # Ensure axes is 2D
    if num_rows == 1:
        axes = axes.reshape(1, -1)

    row_idx = 0

    # Process training samples
    for i, sample in enumerate(problem.get('train', [])):
        original_input = sample['input']
        original_output = sample['output']
        normalized_input = normalize_grid(original_input, color_mapping)
        normalized_output = normalize_grid(original_output, color_mapping)

        # Original input
        axes[row_idx, 0].imshow(grid_to_image(original_input))
        axes[row_idx, 0].set_title(f'Train {i+1} Input (Original)')
        axes[row_idx, 0].axis('off')

        # Normalized input
        axes[row_idx, 1].imshow(grid_to_image(normalized_input))
        axes[row_idx, 1].set_title(f'Train {i+1} Input (Normalized)')
        axes[row_idx, 1].axis('off')

        # Original output
        axes[row_idx, 2].imshow(grid_to_image(original_output))
        axes[row_idx, 2].set_title(f'Train {i+1} Output (Original)')
        axes[row_idx, 2].axis('off')

        # Normalized output
        axes[row_idx, 3].imshow(grid_to_image(normalized_output))
        axes[row_idx, 3].set_title(f'Train {i+1} Output (Normalized)')
        axes[row_idx, 3].axis('off')

        row_idx += 1

    # Process test samples
    for i, sample in enumerate(problem.get('test', [])):
        original_input = sample['input']
        normalized_input = normalize_grid(original_input, color_mapping)

        # Original input
        axes[row_idx, 0].imshow(grid_to_image(original_input))
        axes[row_idx, 0].set_title(f'Test {i+1} Input (Original)')
        axes[row_idx, 0].axis('off')

        # Normalized input
        axes[row_idx, 1].imshow(grid_to_image(normalized_input))
        axes[row_idx, 1].set_title(f'Test {i+1} Input (Normalized)')
        axes[row_idx, 1].axis('off')

        # Original output (if available)
        if 'output' in sample:
            original_output = sample['output']
            normalized_output = normalize_grid(original_output, color_mapping)

            axes[row_idx, 2].imshow(grid_to_image(original_output))
            axes[row_idx, 2].set_title(f'Test {i+1} Output (Original)')
            axes[row_idx, 2].axis('off')

            axes[row_idx, 3].imshow(grid_to_image(normalized_output))
            axes[row_idx, 3].set_title(f'Test {i+1} Output (Normalized)')
            axes[row_idx, 3].axis('off')
        else:
            axes[row_idx, 2].axis('off')
            axes[row_idx, 3].axis('off')

        row_idx += 1

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()


def format_grid(grid: List[List[int]]) -> str:
    """Format a grid as a string of arrays."""
    return '\n'.join(['[' + ', '.join(str(cell) for cell in row) + ']' for row in grid])


def pretty_print_normalized(problem: Dict, color_mapping: Dict[int, int]) -> str:
    """Generate pretty printed text output of normalized problem."""
    output_lines = []

    # Print color mapping
    output_lines.append("Color Mapping:")
    for original, normalized in sorted(color_mapping.items()):
        output_lines.append(f"  {original} -> {normalized}")
    output_lines.append("")

    # Process training samples
    for i, sample in enumerate(problem.get('train', [])):
        original_input = sample['input']
        original_output = sample['output']
        normalized_input = normalize_grid(original_input, color_mapping)
        normalized_output = normalize_grid(original_output, color_mapping)

        output_lines.append(f"Training Example {i+1} - Input (Normalized)")
        output_lines.append(f"Size: {len(normalized_input[0])}x{len(normalized_input)}")
        output_lines.append(format_grid(normalized_input))
        output_lines.append("")

        output_lines.append(f"Training Example {i+1} - Output (Normalized)")
        output_lines.append(f"Size: {len(normalized_output[0])}x{len(normalized_output)}")
        output_lines.append(format_grid(normalized_output))
        output_lines.append("-" * 80)

    # Process test samples
    for i, sample in enumerate(problem.get('test', [])):
        original_input = sample['input']
        normalized_input = normalize_grid(original_input, color_mapping)

        output_lines.append(f"Test Example {i+1} - Input (Normalized)")
        output_lines.append(f"Size: {len(normalized_input[0])}x{len(normalized_input)}")
        output_lines.append(format_grid(normalized_input))
        output_lines.append("-" * 80)

    return '\n'.join(output_lines)


def get_normalized_problem_text(problem_path: str) -> str:
    """Get pretty printed normalized text for a problem file."""
    with open(problem_path, 'r') as f:
        problem = json.load(f)

    color_mapping = get_color_mapping(problem)
    return pretty_print_normalized(problem, color_mapping)


def main():
    parser = argparse.ArgumentParser(description='Normalize colors in ARC problems')
    parser.add_argument('problem_path', help='Path to problem JSON file')
    parser.add_argument('--save-images', action='store_true', help='Save visualization images')
    args = parser.parse_args()

    if not os.path.exists(args.problem_path):
        print(f"Error: File not found: {args.problem_path}")
        sys.exit(1)

    # Load problem
    with open(args.problem_path, 'r') as f:
        problem = json.load(f)

    # Get color mapping
    color_mapping = get_color_mapping(problem)

    # Print pretty formatted output
    print(pretty_print_normalized(problem, color_mapping))

    # Optionally save images
    if args.save_images:
        # Create output directory
        output_dir = Path("img_tmp")
        output_dir.mkdir(exist_ok=True)

        # Generate visualization
        problem_name = Path(args.problem_path).stem
        output_path = output_dir / f"{problem_name}_normalized.png"

        visualize_problem(problem, color_mapping, str(output_path))

        print(f"\nVisualization saved to: {output_path}")


if __name__ == "__main__":
    main()
