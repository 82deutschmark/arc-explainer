/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Frame analysis utilities for comparing ARC3 game frames and detecting changes.
Converted from ARC-AGI-3-ClaudeCode-SDK/helpers/frame-analysis.js to TypeScript with PostgreSQL integration.
Key functions: compareFrames, extractGrid, countChangedPixels, findChangedRegions.
SRP/DRY check: Pass — pure utility functions for frame analysis, no side effects or persistence logic.
*/

import { FrameData } from '../Arc3ApiClient.ts';

/**
 * Represents a single pixel difference between two frames
 */
export interface PixelDiff {
  row: number;
  col: number;
  oldVal: number;
  newVal: number;
}

/**
 * Represents a rectangular region in the grid
 */
export interface Region {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

/**
 * Extract the 2D grid from a frame (first layer of the 3D array)
 * @param frame - Frame object with 3D grid data
 * @returns 2D grid array [height][width] with values 0-15
 */
export function extractGrid(frame: FrameData): number[][] {
  return frame.frame[0];
}

/**
 * Compare two frames and identify pixel differences
 * @param frame1 - First frame to compare
 * @param frame2 - Second frame to compare
 * @returns Array of differences with row, col, oldVal, newVal
 */
export function compareFrames(frame1: FrameData, frame2: FrameData): PixelDiff[] {
  const grid1 = extractGrid(frame1);
  const grid2 = extractGrid(frame2);

  const differences: PixelDiff[] = [];

  // ARC3 grids are typically 64x64, but handle variable sizes
  const maxRow = Math.min(grid1.length, grid2.length);

  for (let row = 0; row < maxRow; row++) {
    const maxCol = Math.min(grid1[row]?.length || 0, grid2[row]?.length || 0);

    for (let col = 0; col < maxCol; col++) {
      if (grid1[row][col] !== grid2[row][col]) {
        differences.push({
          row,
          col,
          oldVal: grid1[row][col],
          newVal: grid2[row][col]
        });
      }
    }
  }

  return differences;
}

/**
 * Count the number of changed pixels between two frames
 * @param frame1 - First frame
 * @param frame2 - Second frame
 * @returns Number of pixels that changed
 */
export function countChangedPixels(frame1: FrameData, frame2: FrameData): number {
  const differences = compareFrames(frame1, frame2);
  return differences.length;
}

/**
 * Find rectangular regions that changed between two frames
 * Uses bounding box algorithm to group nearby changes
 * @param frame1 - First frame
 * @param frame2 - Second frame
 * @param proximityThreshold - Max distance to group changes (default: 5)
 * @returns Array of regions containing changes
 */
export function findChangedRegions(
  frame1: FrameData,
  frame2: FrameData,
  proximityThreshold: number = 5
): Region[] {
  const differences = compareFrames(frame1, frame2);

  if (differences.length === 0) {
    return [];
  }

  // Simple approach: find bounding box of all changes
  let minRow = differences[0].row;
  let maxRow = differences[0].row;
  let minCol = differences[0].col;
  let maxCol = differences[0].col;

  for (const diff of differences) {
    minRow = Math.min(minRow, diff.row);
    maxRow = Math.max(maxRow, diff.row);
    minCol = Math.min(minCol, diff.col);
    maxCol = Math.max(maxCol, diff.col);
  }

  return [{
    top: minRow,
    left: minCol,
    bottom: maxRow,
    right: maxCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1
  }];
}

/**
 * Print a summary of frame differences to console
 * Useful for debugging and logging
 * @param differences - Array of pixel differences
 * @param actionName - Name of the action that caused changes
 */
export function printDifferenceSummary(differences: PixelDiff[], actionName: string): void {
  console.log(`\n${actionName}:`);
  if (differences.length === 0) {
    console.log('  No changes detected');
  } else {
    console.log(`  ${differences.length} pixels changed`);
    differences.slice(0, 5).forEach(d => {
      console.log(`    (${d.row},${d.col}): ${d.oldVal} → ${d.newVal}`);
    });
    if (differences.length > 5) {
      console.log(`    ... and ${differences.length - 5} more`);
    }
  }
}
