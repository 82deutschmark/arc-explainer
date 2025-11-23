/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Utility functions for extracting puzzle metadata from ARCTask data.
 *          Centralizes logic for grid dimensions, test counts, and other puzzle properties
 *          to prevent duplication across PuzzleCard, PuzzleTradingCard, and ChallengePuzzleCard.
 * SRP/DRY check: Pass - Single responsibility for puzzle metadata extraction, eliminates duplicate grid calculation logic.
 */

import type { ARCTask } from '@shared/types';

export interface PuzzleGridDimensions {
  rows: number;
  cols: number;
  display: string; // e.g., "30×30"
}

/**
 * Extract grid dimensions from first training example in ARCTask data.
 * Returns null if taskData is invalid or missing.
 *
 * @param taskData - ARCTask data containing training examples
 * @returns Grid dimensions object or null if unavailable
 *
 * @example
 * const dims = extractGridDimensions(taskData);
 * if (dims) {
 *   console.log(dims.display); // "30×30"
 * }
 */
export function extractGridDimensions(
  taskData: ARCTask | null | undefined
): PuzzleGridDimensions | null {
  // Validate taskData structure
  if (!taskData?.train?.[0]?.input) {
    return null;
  }

  const inputGrid = taskData.train[0].input;

  // Validate grid is a 2D array
  if (!Array.isArray(inputGrid) || inputGrid.length === 0) {
    return null;
  }

  const rows = inputGrid.length;
  const cols = Array.isArray(inputGrid[0]) ? inputGrid[0].length : 0;

  // Validate dimensions are positive
  if (rows <= 0 || cols <= 0) {
    return null;
  }

  return {
    rows,
    cols,
    display: `${rows}×${cols}`
  };
}

/**
 * Get grid dimensions display string with fallback to maxGridSize.
 * Tries to extract from taskData first, falls back to maxGridSize if taskData unavailable.
 *
 * @param taskData - ARCTask data containing training examples
 * @param maxGridSize - Fallback maximum grid size from puzzle metadata
 * @returns Display string like "30×30" or "N/A" if no data available
 *
 * @example
 * const display = getGridSizeDisplay(taskData, puzzle.maxGridSize);
 * // Returns "30×10" from taskData, or "30×30" from maxGridSize, or "N/A"
 */
export function getGridSizeDisplay(
  taskData: ARCTask | null | undefined,
  maxGridSize?: number | null
): string {
  // Try extracting from taskData first
  const dimensions = extractGridDimensions(taskData);
  if (dimensions) {
    return dimensions.display;
  }

  // Fallback to maxGridSize (assumes square grid)
  if (maxGridSize && maxGridSize > 0) {
    return `${maxGridSize}×${maxGridSize}`;
  }

  // No data available
  return 'N/A';
}

/**
 * Extract test count and type from ARCTask data.
 *
 * @param taskData - ARCTask data containing test examples
 * @returns Object with count, isSingle, and isMulti flags
 *
 * @example
 * const testInfo = getTestCount(taskData);
 * console.log(testInfo.count); // 2
 * console.log(testInfo.isMulti); // true
 */
export function getTestCount(
  taskData: ARCTask | null | undefined
): { count: number; isSingle: boolean; isMulti: boolean } {
  if (!taskData?.test || !Array.isArray(taskData.test)) {
    return { count: 0, isSingle: false, isMulti: false };
  }

  const count = taskData.test.length;

  return {
    count,
    isSingle: count === 1,
    isMulti: count > 1
  };
}
