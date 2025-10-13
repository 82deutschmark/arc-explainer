"""
Parameterized transform primitives for ARC puzzle solving.

This module defines basic transformation functions that can be applied to grids.
Follows SRP: Only defines primitive transforms, no composition or search logic.

Author: Max Power
Date: 2025-10-12
PURPOSE: Parameterized transform primitives for ARC solver
SRP/DRY check: Pass - Single responsibility (primitive definitions only)
"""

from dataclasses import dataclass
from typing import Callable, List, Tuple, Dict, Optional
import numpy as np

from .grids import Grid, to_grid, most_common_color


@dataclass(frozen=True)
class Transform:
    """A named transformation function that can be applied to grids."""
    name: str
    fn: Callable[[Grid], Grid]


def deduce_color_map(train_pairs: List[Tuple[Grid, Grid]]) -> Optional[Dict[int, int]]:
    """
    Deduce color mapping from training pairs.

    For each color in input, find the most common corresponding color in output
    across all training examples. Requires consistent 1-1 mapping.
    """
    mapping: Dict[int, int] = {}

    for input_grid, output_grid in train_pairs:
        input_colors = np.unique(input_grid)

        for color in input_colors:
            if color == 0:  # Skip background
                continue

            # Find where input has this color, what color is in output at same positions
            mask = (input_grid == color)
            if not np.any(mask):
                continue

            # Get most common output color where input had this color
            output_colors_at_positions = output_grid[mask]
            if len(output_colors_at_positions) == 0:
                continue

            target_color = int(np.bincount(output_colors_at_positions.ravel(), minlength=10).argmax())

            # Check consistency across examples
            if color in mapping and mapping[color] != target_color:
                return None  # Inconsistent mapping

            mapping[color] = target_color

    return mapping if mapping else None


def candidate_transforms(train_pairs: List[Tuple[Grid, Grid]]) -> List[Transform]:
    """
    Generate candidate primitive transforms based on training examples.

    This creates a set of basic transforms that could potentially solve the puzzle,
    including geometry transforms, object operations, and learned color mappings.
    """
    transforms: List[Transform] = []

    # Geometry transforms
    transforms += [
        Transform(f"rot_{k*90}", lambda g, k=k: np.rot90(g, k=k))
        for k in range(4)
    ]

    transforms += [
        Transform("flip_vertical", lambda g: np.flip(g, axis=0)),
        Transform("flip_horizontal", lambda g: np.flip(g, axis=1)),
        Transform("transpose", lambda g: g.T.copy())
    ]

    # Object and framing operations
    transforms += [
        Transform("trim_borders", lambda g: trim_zero_border(g)),
        Transform("keep_largest", lambda g: keep_largest_object(g))
    ]

    # Scaling operations
    transforms += [
        Transform("scale_2x", lambda g: scale_nn(g, 2)),
        Transform("scale_3x", lambda g: scale_nn(g, 3))
    ]

    # Color mapping learned from training data
    color_mapping = deduce_color_map(train_pairs)
    if color_mapping:
        def apply_color_map(g: Grid) -> Grid:
            return color_map_grid(g, color_mapping)

        transforms.append(Transform("learned_color_map", apply_color_map))

    # Baseline transforms
    transforms.append(Transform("identity", lambda g: g.copy()))

    # Constant fill with most common output color
    if train_pairs:
        # Get all output grids and find most common color
        all_outputs = [output for _, output in train_pairs]
        if all_outputs:
            combined_output = np.block([[output] for output in all_outputs])
            most_common = most_common_color(combined_output)
            transforms.append(
                Transform("const_fill",
                         lambda g, c=most_common: np.full(g.shape, c, dtype=np.int8))
            )

    return transforms


# Helper function for color mapping
def color_map_grid(grid: Grid, mapping: Dict[int, int]) -> Grid:
    """Apply color mapping to grid (imported from grids module for consistency)."""
    from .grids import color_map
    return color_map(grid, mapping)


# Re-export functions from grids module for convenience
from .grids import (
    trim_zero_border,
    keep_largest_object,
    scale_nn,
    color_map
)
