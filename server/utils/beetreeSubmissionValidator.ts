/**
 * BeeTree Submission Validator
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-01-12
 * PURPOSE: Validate BeeTree submission file structure and grid formats before processing.
 *          Ensures data integrity and catches malformed submissions early.
 *
 * SRP/DRY check: Pass - Single responsibility (validation), reuses grid validation logic.
 */

import type { BeeTreeSubmission, BeeTreeTestEntry } from '../types/beetree.ts';

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that a value is a proper ARC grid (2D array of integers 0-9)
 * Matches the validation logic from server/services/schemas/solver.ts
 */
export function validateGrid(grid: any): grid is number[][] {
  if (!Array.isArray(grid)) return false;

  // Must be non-empty
  if (grid.length === 0) return false;

  for (const row of grid) {
    if (!Array.isArray(row)) return false;
    if (row.length === 0) return false; // Empty rows not allowed

    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) return false;
    }
  }

  return true;
}

/**
 * Validate a single test entry (attempt_1 and attempt_2)
 */
export function validateTestEntry(entry: any, taskId: string, testIndex: number): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (typeof entry !== 'object' || entry === null) {
    result.valid = false;
    result.errors.push(`${taskId}:${testIndex} - Test entry is not an object`);
    return result;
  }

  // Check for attempt_1
  if (!('attempt_1' in entry)) {
    result.valid = false;
    result.errors.push(`${taskId}:${testIndex} - Missing attempt_1`);
  } else if (!validateGrid(entry.attempt_1)) {
    result.valid = false;
    result.errors.push(`${taskId}:${testIndex} - Invalid attempt_1 grid`);
  }

  // Check for attempt_2
  if (!('attempt_2' in entry)) {
    result.valid = false;
    result.errors.push(`${taskId}:${testIndex} - Missing attempt_2`);
  } else if (!validateGrid(entry.attempt_2)) {
    result.valid = false;
    result.errors.push(`${taskId}:${testIndex} - Invalid attempt_2 grid`);
  }

  // Warn if grids are identical
  if (result.valid && JSON.stringify(entry.attempt_1) === JSON.stringify(entry.attempt_2)) {
    result.warnings.push(`${taskId}:${testIndex} - attempt_1 and attempt_2 are identical`);
  }

  return result;
}

/**
 * Validate the submission file structure
 */
export function validateSubmissionStructure(data: any): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Must be an object
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.valid = false;
    result.errors.push('Submission must be an object (not an array or null)');
    return result;
  }

  const taskIds = Object.keys(data);

  // Must have at least one task
  if (taskIds.length === 0) {
    result.valid = false;
    result.errors.push('Submission contains no tasks');
    return result;
  }

  // Validate each task
  for (const taskId of taskIds) {
    // Task ID should be 8-character hex string
    if (!/^[a-f0-9]{8}$/.test(taskId)) {
      result.warnings.push(`Task ID "${taskId}" does not match expected format (8-char hex)`);
    }

    const testEntries = data[taskId];

    // Must be an array
    if (!Array.isArray(testEntries)) {
      result.valid = false;
      result.errors.push(`${taskId} - Test entries must be an array`);
      continue;
    }

    // Must have at least one test
    if (testEntries.length === 0) {
      result.valid = false;
      result.errors.push(`${taskId} - No test entries found`);
      continue;
    }

    // Validate each test entry
    for (let i = 0; i < testEntries.length; i++) {
      const entryResult = validateTestEntry(testEntries[i], taskId, i + 1);
      result.errors.push(...entryResult.errors);
      result.warnings.push(...entryResult.warnings);
      if (!entryResult.valid) {
        result.valid = false;
      }
    }
  }

  return result;
}

/**
 * Validate entire BeeTree submission file
 */
export function validateBeeTreeSubmission(submission: any): ValidationResult {
  const result = validateSubmissionStructure(submission);

  if (result.valid) {
    result.warnings.push(`Validated ${Object.keys(submission).length} tasks successfully`);
  }

  return result;
}

/**
 * Validate submission and throw if invalid
 */
export function validateBeeTreeSubmissionOrThrow(submission: any): BeeTreeSubmission {
  const result = validateBeeTreeSubmission(submission);

  if (!result.valid) {
    const errorMsg = `Submission validation failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMsg);
  }

  return submission as BeeTreeSubmission;
}

/**
 * Check if grids in a test entry are valid and different
 */
export function validateAttemptGrids(attempt1: number[][], attempt2: number[][]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!validateGrid(attempt1)) {
    result.valid = false;
    result.errors.push('attempt_1 is not a valid grid');
  }

  if (!validateGrid(attempt2)) {
    result.valid = false;
    result.errors.push('attempt_2 is not a valid grid');
  }

  if (result.valid && JSON.stringify(attempt1) === JSON.stringify(attempt2)) {
    result.warnings.push('Both attempts have identical grids');
  }

  return result;
}
