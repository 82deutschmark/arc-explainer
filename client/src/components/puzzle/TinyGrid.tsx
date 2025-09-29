/**
 * TinyGrid.tsx
 *
 * Author: Claude Sonnet 4.5
 * Date: 2025-09-29T19:00:00-04:00
 * PURPOSE: Renders JUST the raw grid cells with dynamic scaling based on grid dimensions.
 * Automatically calculates optimal cell size to fit within maxSize while respecting min/max bounds.
 * SRP/DRY check: Pass - Single responsibility: draw grid cells with smart scaling
 * shadcn/ui: N/A - This is raw grid rendering with no UI components
 */

import React, { useMemo } from 'react';

interface TinyGridProps {
  grid: number[][];
  cellSize?: number; // Fixed cell size in pixels (overrides dynamic scaling)
  maxSize?: number; // Maximum width/height for the grid in pixels (default: 120)
  minCellSize?: number; // Minimum cell size (default: 2)
  maxCellSize?: number; // Maximum cell size (default: 8)
}

// ARC color palette
const ARC_COLORS: Record<number, string> = {
  0: '#000000', // black
  1: '#0074D9', // blue
  2: '#FF4136', // red
  3: '#2ECC40', // green
  4: '#FFDC00', // yellow
  5: '#AAAAAA', // gray
  6: '#F012BE', // magenta
  7: '#FF851B', // orange
  8: '#7FDBFF', // cyan
  9: '#870C25', // maroon
};

/**
 * Calculate optimal cell size based on grid dimensions
 */
const calculateCellSize = (
  rows: number,
  cols: number,
  maxSize: number,
  minCellSize: number,
  maxCellSize: number
): number => {
  // Calculate cell size that would fit the grid within maxSize
  const maxDimension = Math.max(rows, cols);
  const calculatedSize = Math.floor(maxSize / maxDimension);

  // Clamp to min/max bounds
  return Math.max(minCellSize, Math.min(maxCellSize, calculatedSize));
};

export const TinyGrid: React.FC<TinyGridProps> = ({
  grid,
  cellSize,
  maxSize = 200,
  minCellSize = 3,
  maxCellSize = 12
}) => {
  if (!grid || grid.length === 0) return null;

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  // Calculate dynamic cell size if not explicitly provided
  const computedCellSize = useMemo(() => {
    if (cellSize !== undefined) return cellSize;
    return calculateCellSize(rows, cols, maxSize, minCellSize, maxCellSize);
  }, [cellSize, rows, cols, maxSize, minCellSize, maxCellSize]);

  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }}>
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', height: computedCellSize }}>
          {row.map((cell, colIndex) => (
            <div
              key={colIndex}
              style={{
                width: computedCellSize,
                height: computedCellSize,
                backgroundColor: ARC_COLORS[cell] || '#000000',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
