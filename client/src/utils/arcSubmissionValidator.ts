/**
 * arcSubmissionValidator.ts
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27 (Refactored to use discriminated unions on 2025-12-28)
 *       Updated: 2025-12-28 - Added validation for empty submissions and empty predictions arrays
 * PURPOSE: Validation utilities for ARC submission format verification.
 *          Validates task IDs, prediction structure, grid dimensions, and cell values.
 *          Uses discriminated union types for type-safe error handling.
 *          Handles edge cases: empty submissions ({}) and empty prediction arrays ([]).
 * SRP/DRY check: Pass - Single responsibility: validate ARC submissions
 */


// Discriminated union for grid-specific issues
export type GridIssue =
  | { kind: 'empty' }
  | { kind: 'too_tall'; height: number }
  | { kind: 'too_wide'; height: number; width: number }
  | { kind: 'invalid_row'; row: number }
  | { kind: 'invalid_cell'; row: number; col: number; value: any };

// Validation error discriminated union (client-side format validation only)
export type ValidationError =
  | { type: 'invalid_submission_format' }
  | { type: 'empty_submission' }
  | { type: 'task_count_mismatch'; found: number; expected: number; tooMany: boolean }
  | { type: 'invalid_task_id'; taskId: string }
  | { type: 'invalid_task_structure'; taskId: string; found: 'grid' | 'object' | 'grid_array' }
  | { type: 'empty_predictions'; taskId: string }
  | { type: 'invalid_prediction_object'; taskId: string; predictionIndex?: number }
  | { type: 'invalid_attempt_structure'; taskId: string; predictionIndex?: number }
  | { type: 'invalid_grid'; taskId: string; predictionIndex?: number; attemptName: string; issue: GridIssue };

/**
 * Validates a grid (2D number array) for ARC format compliance
 * Returns only the GridIssue; caller wraps it in the full ValidationError
 */
function validateGrid(grid: any): GridIssue | null {
  if (!Array.isArray(grid) || grid.length === 0) {
    return { kind: 'empty' };
  }

  // Check dimensions (1x1 to 30x30)
  const height = grid.length;
  if (height > 30) {
    return { kind: 'too_tall', height };
  }

  for (let row = 0; row < grid.length; row++) {
    if (!Array.isArray(grid[row])) {
      return { kind: 'invalid_row', row };
    }

    const width = grid[row].length;
    if (width > 30) {
      return { kind: 'too_wide', height, width };
    }

    // Validate cell values (0-9)
    for (let col = 0; col < grid[row].length; col++) {
      const value = grid[row][col];
      if (!Number.isInteger(value) || value < 0 || value > 9) {
        return { kind: 'invalid_cell', row, col, value };
      }
    }
  }

  return null;
}

/**
 * Validates an ARC submission against format requirements
 */
export function validateSubmission(
  submission: any,
  expectedNumTasks: number
): ValidationError | null {
  // Check if submission is an object
  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
    return { type: 'invalid_submission_format' };
  }

  const taskIds = Object.keys(submission);

  // Check if submission is empty
  if (taskIds.length === 0) {
    return { type: 'empty_submission' };
  }

  // Check if we have correct number of tasks
  if (taskIds.length < expectedNumTasks) {
    return {
      type: 'task_count_mismatch',
      found: taskIds.length,
      expected: expectedNumTasks,
      tooMany: false,
    };
  }
  if (taskIds.length > expectedNumTasks) {
    return {
      type: 'task_count_mismatch',
      found: taskIds.length,
      expected: expectedNumTasks,
      tooMany: true,
    };
  }

  // Validate each task
  for (const taskId of taskIds) {
    // Validate task ID format (8 char hex)
    if (!/^[0-9a-f]{8}$/.test(taskId)) {
      return { type: 'invalid_task_id', taskId };
    }

    const predictions = submission[taskId];

    // Check if predictions value is a grid or grid array instead of prediction objects
    if (Array.isArray(predictions) && predictions.length > 0 && Array.isArray(predictions[0])) {
      // Distinguish between single grid vs array of grids
      const isArrayOfGrids = predictions[0].length > 0 && Array.isArray(predictions[0][0]);
      return {
        type: 'invalid_task_structure',
        taskId,
        found: isArrayOfGrids ? 'grid_array' : 'grid'
      };
    }

    // Check if predictions is an array
    if (!Array.isArray(predictions)) {
      return { type: 'invalid_task_structure', taskId, found: 'object' };
    }

    // Check if predictions array is empty
    if (predictions.length === 0) {
      return { type: 'empty_predictions', taskId };
    }

    // Validate each prediction
    for (let i = 0; i < predictions.length; i++) {
      const prediction = predictions[i];

      if (!prediction || typeof prediction !== 'object') {
        return {
          type: 'invalid_prediction_object',
          taskId,
          predictionIndex: predictions.length > 1 ? i : undefined
        };
      }

      const { attempt_1, attempt_2 } = prediction;

      // Check if attempts exist and are arrays
      if (!Array.isArray(attempt_1) || !Array.isArray(attempt_2)) {
        return {
          type: 'invalid_attempt_structure',
          taskId,
          predictionIndex: predictions.length > 1 ? i : undefined
        };
      }

      // Validate both grids (only include index if multiple predictions)
      const indexToPass = predictions.length > 1 ? i : undefined;

      const issue1 = validateGrid(attempt_1);
      if (issue1) {
        return {
          type: 'invalid_grid',
          taskId,
          predictionIndex: indexToPass,
          attemptName: 'attempt_1',
          issue: issue1
        };
      }

      const issue2 = validateGrid(attempt_2);
      if (issue2) {
        return {
          type: 'invalid_grid',
          taskId,
          predictionIndex: indexToPass,
          attemptName: 'attempt_2',
          issue: issue2
        };
      }
    }
  }

  return null;
}
