#!/usr/bin/env python3
"""
Convert ARC problems to monochrome (black and white).
Makes the most common color black (0) and all other colors white (1).
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

# Monochrome palette
PALETTE = {
    0: (0, 0, 0),        # black
    1: (255, 255, 255),  # white
}


def count_colors_in_grid(grid: List[List[int]]) -> Counter:
    """Count occurrences of each color in a grid."""
    counter = Counter()
    for row in grid:
        for cell in row:
            counter[cell] += 1
    return counter


def get_most_common_color(problem: Dict) -> int:
    """Find the most common color across all grids in a problem."""
    total_counter = Counter()

    for sample in problem.get('train', []):
        total_counter.update(count_colors_in_grid(sample['input']))
        total_counter.update(count_colors_in_grid(sample['output']))

    for sample in problem.get('test', []):
        total_counter.update(count_colors_in_grid(sample['input']))
        if 'output' in sample:
            total_counter.update(count_colors_in_grid(sample['output']))

    # Get most common color
    most_common = total_counter.most_common(1)
    return most_common[0][0] if most_common else 0


def monochrome_grid(grid: List[List[int]], most_common_color: int) -> List[List[int]]:
    """Convert grid to monochrome: most common color -> 0 (black), all others -> 1 (white)."""
    return [[0 if cell == most_common_color else 1 for cell in row] for row in grid]


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


def visualize_problem(problem: Dict, most_common_color: int, output_path: str):
    """Create visualization showing original and monochrome grids side by side."""
    num_train = len(problem.get('train', []))
    num_test = len(problem.get('test', []))

    # Calculate grid layout: 4 columns (original input, monochrome input, original output, monochrome output)
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
        monochrome_input = monochrome_grid(original_input, most_common_color)
        monochrome_output = monochrome_grid(original_output, most_common_color)

        # Original input
        axes[row_idx, 0].imshow(grid_to_image(original_input))
        axes[row_idx, 0].set_title(f'Train {i+1} Input (Original)')
        axes[row_idx, 0].axis('off')

        # Monochrome input
        axes[row_idx, 1].imshow(grid_to_image(monochrome_input))
        axes[row_idx, 1].set_title(f'Train {i+1} Input (Monochrome)')
        axes[row_idx, 1].axis('off')

        # Original output
        axes[row_idx, 2].imshow(grid_to_image(original_output))
        axes[row_idx, 2].set_title(f'Train {i+1} Output (Original)')
        axes[row_idx, 2].axis('off')

        # Monochrome output
        axes[row_idx, 3].imshow(grid_to_image(monochrome_output))
        axes[row_idx, 3].set_title(f'Train {i+1} Output (Monochrome)')
        axes[row_idx, 3].axis('off')

        row_idx += 1

    # Process test samples
    for i, sample in enumerate(problem.get('test', [])):
        original_input = sample['input']
        monochrome_input = monochrome_grid(original_input, most_common_color)

        # Original input
        axes[row_idx, 0].imshow(grid_to_image(original_input))
        axes[row_idx, 0].set_title(f'Test {i+1} Input (Original)')
        axes[row_idx, 0].axis('off')

        # Monochrome input
        axes[row_idx, 1].imshow(grid_to_image(monochrome_input))
        axes[row_idx, 1].set_title(f'Test {i+1} Input (Monochrome)')
        axes[row_idx, 1].axis('off')

        # Original output (if available)
        if 'output' in sample:
            original_output = sample['output']
            monochrome_output = monochrome_grid(original_output, most_common_color)

            axes[row_idx, 2].imshow(grid_to_image(original_output))
            axes[row_idx, 2].set_title(f'Test {i+1} Output (Original)')
            axes[row_idx, 2].axis('off')

            axes[row_idx, 3].imshow(grid_to_image(monochrome_output))
            axes[row_idx, 3].set_title(f'Test {i+1} Output (Monochrome)')
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


def pretty_print_monochrome(problem: Dict, most_common_color: int) -> str:
    """Generate pretty printed text output of monochrome problem."""
    output_lines = []

    # Print most common color mapping
    output_lines.append(f"Most common color (mapped to black): {most_common_color}")
    output_lines.append("All other colors mapped to white (1)")
    output_lines.append("")

    # Process training samples
    for i, sample in enumerate(problem.get('train', [])):
        original_input = sample['input']
        original_output = sample['output']
        monochrome_input = monochrome_grid(original_input, most_common_color)
        monochrome_output = monochrome_grid(original_output, most_common_color)

        output_lines.append(f"Training Example {i+1} - Input (Monochrome)")
        output_lines.append(f"Size: {len(monochrome_input[0])}x{len(monochrome_input)}")
        output_lines.append(format_grid(monochrome_input))
        output_lines.append("")

        output_lines.append(f"Training Example {i+1} - Output (Monochrome)")
        output_lines.append(f"Size: {len(monochrome_output[0])}x{len(monochrome_output)}")
        output_lines.append(format_grid(monochrome_output))
        output_lines.append("-" * 80)

    # Process test samples
    for i, sample in enumerate(problem.get('test', [])):
        original_input = sample['input']
        monochrome_input = monochrome_grid(original_input, most_common_color)

        output_lines.append(f"Test Example {i+1} - Input (Monochrome)")
        output_lines.append(f"Size: {len(monochrome_input[0])}x{len(monochrome_input)}")
        output_lines.append(format_grid(monochrome_input))
        output_lines.append("-" * 80)

    return '\n'.join(output_lines)


def main():
    parser = argparse.ArgumentParser(description='Convert ARC problems to monochrome')
    parser.add_argument('problem_path', help='Path to problem JSON file')
    parser.add_argument('--save-images', action='store_true', help='Save visualization images')
    args = parser.parse_args()

    if not os.path.exists(args.problem_path):
        print(f"Error: File not found: {args.problem_path}")
        sys.exit(1)

    # Load problem
    with open(args.problem_path, 'r') as f:
        problem = json.load(f)

    # Get most common color
    most_common_color = get_most_common_color(problem)

    # Print pretty formatted output
    print(pretty_print_monochrome(problem, most_common_color))

    # Optionally save images
    if args.save_images:
        # Create output directory
        output_dir = Path("img_tmp")
        output_dir.mkdir(exist_ok=True)

        # Generate visualization
        problem_name = Path(args.problem_path).stem
        output_path = output_dir / f"{problem_name}_monochrome.png"

        visualize_problem(problem, most_common_color, str(output_path))

        print(f"\nVisualization saved to: {output_path}")


if __name__ == "__main__":
    main()
