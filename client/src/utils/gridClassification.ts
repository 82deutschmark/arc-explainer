/**
 * Author: Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Shared utility for classifying grid pairs by dimensions to optimize rendering layout.
 * Eliminates 150+ lines of duplicate code between training and test grid rendering.
 * SRP/DRY check: Pass - Single responsibility (grid classification), eliminates duplication
 * DaisyUI: N/A - Utility function
 */

export interface GridPair {
  input: number[][];
  output: number[][];
}

export interface ClassifiedGridPairs<T extends GridPair> {
  standard: Array<{ item: T; idx: number }>;
  wide: Array<{ item: T; idx: number }>;
  tall: Array<{ item: T; idx: number }>;
}

/**
 * Classifies grid pairs into rendering categories based on dimensions
 *
 * @param pairs - Array of grid pairs with input/output grids
 * @returns Classified pairs organized by layout type
 *
 * Classification rules:
 * - tall: maxHeight > 20 (requires horizontal scroll)
 * - wide: combinedWidth > 40 OR maxDim > 18 (requires full width)
 * - standard: all others (can flex-wrap)
 */
export function classifyGridPairs<T extends GridPair>(
  pairs: T[]
): ClassifiedGridPairs<T> {
  const standard: Array<{ item: T; idx: number }> = [];
  const wide: Array<{ item: T; idx: number }> = [];
  const tall: Array<{ item: T; idx: number }> = [];

  pairs.forEach((item, idx) => {
    const inputRows = item.input.length;
    const inputCols = item.input[0]?.length || 0;
    const outputRows = item.output.length;
    const outputCols = item.output[0]?.length || 0;

    const maxHeight = Math.max(inputRows, outputRows);
    const combinedWidth = inputCols + outputCols;
    const maxDim = Math.max(inputRows, inputCols, outputRows, outputCols);

    // Classification logic
    if (maxHeight > 20) {
      tall.push({ item, idx });
    } else if (combinedWidth > 40 || maxDim > 18) {
      wide.push({ item, idx });
    } else {
      standard.push({ item, idx });
    }
  });

  return { standard, wide, tall };
}
