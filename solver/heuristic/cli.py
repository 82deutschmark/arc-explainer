"""
CLI interface for heuristic ARC solver.

This module provides the main entry point that accepts ARC task JSON files
and outputs predictions in the expected contract format.
Follows SRP: Only handles CLI interface and JSON contract, no solving logic.

Author: Max Power
Date: 2025-10-12
PURPOSE: JSON contract interface for ARC solver backend integration
SRP/DRY check: Pass - Single responsibility (CLI interface only)
"""

import json
import sys
from typing import Dict, List

from .grids import Grid, to_grid, from_grid
from .program import learn_program, apply_with_shape_match


def load_task(task_path: str) -> tuple[List[tuple[Grid, Grid]], List[Grid]]:
    """
    Load ARC task from JSON file.

    Returns:
        train_pairs: List of (input_grid, output_grid) tuples
        test_inputs: List of input grids to predict
    """
    with open(task_path, 'r') as f:
        task_data = json.load(f)

    # Convert training pairs
    train_pairs = []
    for pair in task_data["train"]:
        input_grid = to_grid(pair["input"])
        output_grid = to_grid(pair["output"])
        train_pairs.append((input_grid, output_grid))

    # Convert test inputs
    test_inputs = [to_grid(pair["input"]) for pair in task_data["test"]]

    return train_pairs, test_inputs


def predict_for_task(task_path: str) -> Dict:
    """
    Generate predictions for an ARC task.

    Returns prediction in the format expected by the backend:
    - Single test: {"program": name, "predicted_output_grid": grid}
    - Multiple tests: {"program": name, "multiple_predicted_outputs": grids}
    """
    train_pairs, test_inputs = load_task(task_path)

    # Learn the transformation program
    program = learn_program(train_pairs)

    # Fallback if no program found
    if program is None:
        program = create_fallback_program()

    # Generate predictions
    predictions = []
    for test_input in test_inputs:
        # Use median shape from training outputs as target shape
        target_shapes = [output.shape for _, output in train_pairs]
        if target_shapes:
            heights, widths = zip(*target_shapes)
            median_height = int(sum(heights) / len(heights))
            median_width = int(sum(widths) / len(widths))
            target_shape = (median_height, median_width)
        else:
            target_shape = test_input.shape  # Fallback to input shape

        predicted_grid = apply_with_shape_match(program, test_input, target_shape)
        predictions.append(from_grid(predicted_grid))

    # Format response according to contract
    if len(predictions) == 1:
        return {
            "program": program.name,
            "predicted_output_grid": predictions[0]
        }
    else:
        return {
            "program": program.name,
            "multiple_predicted_outputs": predictions
        }


def create_fallback_program() -> 'Transform':
    """Create a fallback transform when no program can be learned."""
    from .grids import keep_largest_object, trim_zero_border
    from .prims import Transform

    def fallback_fn(grid: Grid) -> Grid:
        # Keep largest object and center it
        trimmed = trim_zero_border(grid)
        largest = keep_largest_object(trimmed)
        return largest

    return Transform("fallback_largest_centered", fallback_fn)


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python -m solver.heuristic.cli /path/to/task.json")
        sys.exit(1)

    task_path = sys.argv[1]

    try:
        result = predict_for_task(task_path)
        print(json.dumps(result, indent=2))
    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
