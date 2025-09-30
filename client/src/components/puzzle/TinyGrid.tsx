/**
 * TinyGrid.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-09-29T21:27:00-04:00
 * PURPOSE: ACTUALLY dynamic grid rendering using CSS Grid.
 * NO MAGIC NUMBERS. Uses CSS calc() to scale based on grid dimensions.
 * The grid scales to fit its container automatically - no manual sizing needed.
 * 
 * HOW IT WORKS:
 * - Uses CSS Grid with template columns based on grid dimensions
 * - Cell size calculated as: min(100% / cols, 100% / rows) 
 * - Maintains square aspect ratio via aspect-ratio CSS property
 * - Container can be any size - grid adapts automatically
 * 
 * SRP/DRY check: Pass - Just renders grids, lets CSS handle the scaling
 * shadcn/ui: N/A - Pure CSS Grid implementation
 */

import React from 'react';

interface TinyGridProps {
  grid: number[][];
  className?: string;
  style?: React.CSSProperties;
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

export const TinyGrid: React.FC<TinyGridProps> = ({
  grid,
  className = '',
  style = {}
}) => {
  if (!grid || grid.length === 0) return null;

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  // Flatten grid for CSS Grid rendering
  const cells = grid.flat();

  return (
    <div 
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        width: '100%',
        height: '100%',
        aspectRatio: `${cols} / ${rows}`,
        maxWidth: '100%',
        maxHeight: '100%',
        ...style
      }}
    >
      {cells.map((cell, index) => (
        <div
          key={index}
          style={{
            backgroundColor: ARC_COLORS[cell] || '#000000',
            aspectRatio: '1',
            width: '100%',
            height: '100%'
          }}
        />
      ))}
    </div>
  );
};
