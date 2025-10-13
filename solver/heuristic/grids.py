"""
Grid operations and utilities for ARC puzzle solving.

This module provides basic operations on ARC grids (2D arrays of integers 0-9).
Follows SRP: Only handles grid manipulation, no puzzle logic.

Author: Max Power
Date: 2025-10-12
PURPOSE: Grid manipulation utilities for ARC solver
SRP/DRY check: Pass - Single responsibility (grid operations only)
"""

from typing import List, Tuple, Dict
import numpy as np

# Type alias for ARC grids
Grid = np.ndarray  # shape (H,W), dtype=int8, values 0..9


def to_grid(array_list: List[List[int]]) -> Grid:
    """Convert list of lists to numpy grid."""
    return np.array(array_list, dtype=np.int8)


def from_grid(grid: Grid) -> List[List[int]]:
    """Convert numpy grid back to list of lists."""
    return [[int(x) for x in row] for row in grid.tolist()]


def same_shape(a: Grid, b: Grid) -> bool:
    """Check if two grids have the same shape."""
    return a.shape == b.shape


def eq(a: Grid, b: Grid) -> bool:
    """Check if two grids are exactly equal."""
    return a.shape == b.shape and np.array_equal(a, b)


def trim_zero_border(grid: Grid) -> Grid:
    """Remove zero border from grid, keeping the smallest rectangle containing non-zero cells."""
    non_zero = np.argwhere(grid != 0)
    if non_zero.size == 0:
        return grid.copy()

    (min_row, min_col), (max_row, max_col) = non_zero.min(0), non_zero.max(0) + 1
    return grid[min_row:max_row, min_col:max_col]


def pad_to(grid: Grid, target_shape: Tuple[int, int], fill_value: int = 0) -> Grid:
    """Pad grid to target shape with fill_value (default 0)."""
    target_height, target_width = target_shape
    padded = np.full((target_height, target_width), fill_value, dtype=np.int8)

    grid_height, grid_width = grid.shape
    start_row = (target_height - grid_height) // 2
    start_col = (target_width - grid_width) // 2

    padded[start_row:start_row + grid_height, start_col:start_col + grid_width] = grid
    return padded


def rotate_k(grid: Grid, k: int) -> Grid:
    """Rotate grid by k*90 degrees (k=0,1,2,3)."""
    k = k % 4
    return np.rot90(grid, k=k)


def flip(grid: Grid, axis: int) -> Grid:
    """Flip grid along specified axis (0=vertical, 1=horizontal)."""
    return np.flip(grid, axis=axis)


def transpose(grid: Grid) -> Grid:
    """Transpose grid (swap rows and columns)."""
    return grid.T.copy()


def scale_nn(grid: Grid, factor: int) -> Grid:
    """Scale grid by integer factor using nearest neighbor interpolation."""
    return np.kron(grid, np.ones((factor, factor), dtype=np.int8))


def color_map(grid: Grid, mapping: Dict[int, int]) -> Grid:
    """Apply color mapping to grid."""
    result = grid.copy()
    for source_color, target_color in mapping.items():
        result[grid == source_color] = target_color
    return result


def most_common_color(grid: Grid) -> int:
    """Find the most common color in the grid."""
    values, counts = np.unique(grid, return_counts=True)
    return int(values[counts.argmax()])


# ---------- Connected components (4-connectivity) ----------
def cc_labels(grid: Grid) -> Tuple[Grid, Dict[int, int]]:
    """Find connected components in grid using 4-connectivity."""
    height, width = grid.shape
    labels = np.full((height, width), -1, dtype=np.int32)
    current_label = 0
    sizes = {}

    for row in range(height):
        for col in range(width):
            if grid[row, col] == 0 or labels[row, col] != -1:
                continue

            # BFS flood fill for connected component
            queue = [(row, col)]
            labels[row, col] = current_label
            size = 0
            color = grid[row, col]

            while queue:
                r, c = queue.pop()
                size += 1

                # Check 4 neighbors
                for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                    nr, nc = r + dr, c + dc
                    if (0 <= nr < height and 0 <= nc < width and
                        labels[nr, nc] == -1 and grid[nr, nc] == color):
                        labels[nr, nc] = current_label
                        queue.append((nr, nc))

            sizes[current_label] = size
            current_label += 1

    return labels, sizes


def keep_largest_object(grid: Grid) -> Grid:
    """Keep only the largest connected component in the grid."""
    labels, sizes = cc_labels(grid)

    if not sizes:
        return grid.copy()

    largest_label = max(sizes, key=sizes.get)
    result = np.zeros_like(grid)
    result[labels == largest_label] = grid[labels == largest_label]

    return result
