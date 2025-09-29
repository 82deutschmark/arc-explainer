/**
 * TinyGrid.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-09-29T18:15:00-04:00
 * PURPOSE: Renders JUST the raw grid cells with ZERO wrappers, borders, titles, or spacing.
 * Each cell is 4px square. No fluff. Maximum density.
 * SRP/DRY check: Pass - Single responsibility: draw grid cells only
 * shadcn/ui: N/A - This is raw grid rendering with no UI components
 */

import React from 'react';

interface TinyGridProps {
  grid: number[][];
  cellSize?: number; // pixels per cell, default 4
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

export const TinyGrid: React.FC<TinyGridProps> = ({ grid, cellSize = 4 }) => {
  if (!grid || grid.length === 0) return null;

  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }}>
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', height: cellSize }}>
          {row.map((cell, colIndex) => (
            <div
              key={colIndex}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: ARC_COLORS[cell] || '#000000',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
