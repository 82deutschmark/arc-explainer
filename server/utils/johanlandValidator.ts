/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-15
 * PURPOSE: Validation utilities for Johan_Land_Solver_V6 submission format.
 *          Ensures data integrity before database ingestion with comprehensive
 *          error reporting and grid validation.
 * SRP/DRY check: Pass - Single responsibility (validation), reuses grid validation logic
 */

import type { JohanLandAttempt, JohanLandPuzzleData } from '../types/johanland.ts';

/**
 * Validation result with detailed error and warning information
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that a value is a valid ARC grid (2D array of 0-9)
 */
export function validateGrid(grid: any): grid is number[][] {
  if (!Array.isArray(grid)) {
    return false;
  }

  if (grid.length === 0) {
    return false;
  }

  for (const row of grid) {
    if (!Array.isArray(row)) {
      return false;
    }
    if (row.length === 0) {
      return false;
    }
    for (const cell of row) {
      if (typeof cell !== 'number' || cell < 0 || cell > 9 || !Number.isInteger(cell)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate a single attempt
 */
export function validateJohanLandAttempt(
  attempt: any,
  taskId: string,
  attemptNum: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check attempt exists
  if (!attempt) {
    errors.push(`Attempt ${attemptNum} missing for task ${taskId}`);
    return { valid: false, errors, warnings };
  }

  // Validate answer grid
  if (!('answer' in attempt)) {
    errors.push(`Attempt ${attemptNum}: missing 'answer' field`);
  } else if (!validateGrid(attempt.answer)) {
    errors.push(`Attempt ${attemptNum}: invalid grid in 'answer' field`);
  }

  // Validate correct flag
  if (!('correct' in attempt)) {
    errors.push(`Attempt ${attemptNum}: missing 'correct' field`);
  } else if (typeof attempt.correct !== 'boolean') {
    errors.push(`Attempt ${attemptNum}: 'correct' must be boolean`);
  }

  // Validate metadata
  if (!('metadata' in attempt)) {
    errors.push(`Attempt ${attemptNum}: missing 'metadata' object`);
    return { valid: errors.length === 0, errors, warnings };
  }

  const meta = attempt.metadata;

  // Check required string fields
  const requiredStringFields = ['model', 'provider', 'start_timestamp', 'end_timestamp', 'reasoning_summary', 'task_id', 'test_id'];
  for (const field of requiredStringFields) {
    if (!(field in meta)) {
      errors.push(`Attempt ${attemptNum}: missing metadata.${field}`);
    } else if (typeof meta[field] !== 'string' || meta[field].trim() === '') {
      errors.push(`Attempt ${attemptNum}: metadata.${field} must be non-empty string`);
    }
  }

  // Validate timestamps are valid ISO 8601
  if (meta.start_timestamp) {
    const start = new Date(meta.start_timestamp);
    if (isNaN(start.getTime())) {
      errors.push(`Attempt ${attemptNum}: invalid start_timestamp format`);
    }
  }

  if (meta.end_timestamp) {
    const end = new Date(meta.end_timestamp);
    if (isNaN(end.getTime())) {
      errors.push(`Attempt ${attemptNum}: invalid end_timestamp format`);
    }
  }

  // Verify end > start
  if (meta.start_timestamp && meta.end_timestamp) {
    const start = new Date(meta.start_timestamp).getTime();
    const end = new Date(meta.end_timestamp).getTime();
    if (end <= start) {
      errors.push(`Attempt ${attemptNum}: end_timestamp must be after start_timestamp`);
    }
  }

  // Validate pair_index
  if (!('pair_index' in meta)) {
    errors.push(`Attempt ${attemptNum}: missing metadata.pair_index`);
  } else if (typeof meta.pair_index !== 'number' || meta.pair_index < 0) {
    errors.push(`Attempt ${attemptNum}: metadata.pair_index must be non-negative number`);
  }

  // Validate usage
  if (!('usage' in meta)) {
    errors.push(`Attempt ${attemptNum}: missing metadata.usage`);
  } else {
    const usage = meta.usage;
    const usageFields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
    for (const field of usageFields) {
      if (!(field in usage)) {
        errors.push(`Attempt ${attemptNum}: missing metadata.usage.${field}`);
      } else if (typeof usage[field] !== 'number' || usage[field] < 0) {
        errors.push(`Attempt ${attemptNum}: metadata.usage.${field} must be non-negative number`);
      }
    }
  }

  // Validate cost
  if (!('cost' in meta)) {
    errors.push(`Attempt ${attemptNum}: missing metadata.cost`);
  } else {
    const cost = meta.cost;
    const costFields = ['prompt_cost', 'completion_cost', 'reasoning_cost', 'total_cost'];
    for (const field of costFields) {
      if (!(field in cost)) {
        errors.push(`Attempt ${attemptNum}: missing metadata.cost.${field}`);
      } else if (typeof cost[field] !== 'number' || cost[field] < 0) {
        errors.push(`Attempt ${attemptNum}: metadata.cost.${field} must be non-negative number`);
      }
    }
  }

  // Validate choices (may be "NA" but structure should exist)
  if (!('choices' in meta)) {
    errors.push(`Attempt ${attemptNum}: missing metadata.choices`);
  } else if (!Array.isArray(meta.choices)) {
    errors.push(`Attempt ${attemptNum}: metadata.choices must be array`);
  } else if (meta.choices.length === 0) {
    warnings.push(`Attempt ${attemptNum}: metadata.choices is empty`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate the full puzzle data structure
 */
export function validateJohanLandPuzzleData(
  data: any,
  puzzleId: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check array structure
  if (!Array.isArray(data)) {
    errors.push(`Puzzle ${puzzleId}: data must be array`);
    return { valid: false, errors, warnings };
  }

  if (data.length === 0) {
    errors.push(`Puzzle ${puzzleId}: array is empty`);
    return { valid: false, errors, warnings };
  }

  // Validate first element (only one expected currently)
  const elem = data[0];
  if (typeof elem !== 'object' || elem === null) {
    errors.push(`Puzzle ${puzzleId}: first array element must be object`);
    return { valid: false, errors, warnings };
  }

  // Check for attempts
  let hasAttempt1 = false;
  let hasAttempt2 = false;

  if ('attempt_1' in elem && elem.attempt_1) {
    hasAttempt1 = true;
    const result = validateJohanLandAttempt(elem.attempt_1, puzzleId, 1);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  if ('attempt_2' in elem && elem.attempt_2) {
    hasAttempt2 = true;
    const result = validateJohanLandAttempt(elem.attempt_2, puzzleId, 2);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  if (!hasAttempt1 && !hasAttempt2) {
    errors.push(`Puzzle ${puzzleId}: must have at least one of attempt_1 or attempt_2`);
  }

  // Warn if reasoning_summary looks empty (common mistake)
  if (elem.attempt_1?.metadata?.reasoning_summary === 'NA' || elem.attempt_1?.metadata?.reasoning_summary === '') {
    warnings.push(`Puzzle ${puzzleId}/attempt_1: reasoning_summary is empty or "NA"`);
  }

  if (elem.attempt_2?.metadata?.reasoning_summary === 'NA' || elem.attempt_2?.metadata?.reasoning_summary === '') {
    warnings.push(`Puzzle ${puzzleId}/attempt_2: reasoning_summary is empty or "NA"`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate and throw on error (for use in ingestion pipeline)
 */
export function validateJohanLandSubmissionOrThrow(
  data: any,
  puzzleId: string
): JohanLandPuzzleData[] {
  const result = validateJohanLandPuzzleData(data, puzzleId);

  if (!result.valid) {
    const errorMessage = result.errors.join('; ');
    throw new Error(`Validation failed for puzzle ${puzzleId}: ${errorMessage}`);
  }

  return data;
}

/**
 * Helper to check if two grids are identical
 */
export function gridsAreIdentical(grid1: number[][], grid2: number[][]): boolean {
  if (grid1.length !== grid2.length) {
    return false;
  }

  for (let i = 0; i < grid1.length; i++) {
    if (grid1[i].length !== grid2[i].length) {
      return false;
    }
    for (let j = 0; j < grid1[i].length; j++) {
      if (grid1[i][j] !== grid2[i][j]) {
        return false;
      }
    }
  }

  return true;
}
