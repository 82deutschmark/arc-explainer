"""
Program learning and composition logic for ARC puzzle solving.

This module handles finding the right sequence of transforms to solve puzzles.
Follows SRP: Only handles program search and composition, no grid operations.

Author: Max Power
Date: 2025-10-12
PURPOSE: Program search and composition for ARC solver
SRP/DRY check: Pass - Single responsibility (program learning only)
"""

import itertools
from typing import List, Tuple, Optional

from .grids import Grid, eq, same_shape
from .prims import Transform, candidate_transforms


def apply_with_shape_match(transform: Transform, input_grid: Grid, target_shape: Tuple[int, int]) -> Grid:
    """
    Apply transform and ensure output matches target shape.

    If the transform changes the shape, attempt to pad or trim to match target.
    """
    output = transform.fn(input_grid)

    # If shapes match, return as-is
    if output.shape == target_shape:
        return output

    # If output is larger, try trimming borders
    if output.shape[0] > target_shape[0] or output.shape[1] > target_shape[1]:
        output = trim_to_fit(output, target_shape)

    # If still doesn't match, pad to target shape
    if output.shape != target_shape:
        output = pad_to_target(output, target_shape)

    return output


def fits_transform_on_all(transform: Transform, train_pairs: List[Tuple[Grid, Grid]]) -> bool:
    """Check if transform works correctly on all training pairs."""
    for input_grid, expected_output in train_pairs:
        predicted = apply_with_shape_match(transform, input_grid, expected_output.shape)

        if not eq(predicted, expected_output):
            return False

    return True


def compose(transform1: Transform, transform2: Transform) -> Transform:
    """Compose two transforms: apply transform2 first, then transform1."""
    def composed_fn(grid: Grid) -> Grid:
        return transform1.fn(transform2.fn(grid))

    return Transform(f"{transform1.name}∘{transform2.name}", composed_fn)


def learn_program(train_pairs: List[Tuple[Grid, Grid]]) -> Optional[Transform]:
    """
    Learn a program (single transform or composition) that solves the puzzle.

    Strategy:
    1. Try single primitive transforms
    2. Try two-step compositions
    3. Try trim + transform combinations as fallback
    """
    primitives = candidate_transforms(train_pairs)

    # Step 1: Try single transforms
    for transform in primitives:
        if fits_transform_on_all(transform, train_pairs):
            return transform

    # Step 2: Try two-step compositions
    for transform1, transform2 in itertools.product(primitives, primitives):
        composition = compose(transform1, transform2)
        if fits_transform_on_all(composition, train_pairs):
            return composition

    # Step 3: Try trim + transform combinations
    from .grids import trim_zero_border

    trim_transform = Transform("trim", trim_zero_border)
    for transform in primitives:
        trim_then_transform = compose(transform, trim_transform)
        if fits_transform_on_all(trim_then_transform, train_pairs):
            return trim_then_transform

    # No program found
    return None


# Helper functions for shape matching
def trim_to_fit(grid: Grid, target_shape: Tuple[int, int]) -> Grid:
    """Trim grid to fit target shape, removing borders."""
    from .grids import trim_zero_border
    return trim_zero_border(grid)


def pad_to_target(grid: Grid, target_shape: Tuple[int, int]) -> Grid:
    """Pad grid to target shape with zeros."""
    from .grids import pad_to
    return pad_to(grid, target_shape, fill_value=0)
