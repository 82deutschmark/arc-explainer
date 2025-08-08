/**
 * Root PuzzleGrid Component  
 * Renders puzzle grids with emoji display (uses legacy default emoji set only)
 * Author: Cascade (GPT-5 High Reasoning)
 *
 * How it's used in the project:
 * - Displays ARC puzzle grids with fixed emoji mapping
 * - This is the legacy component - main emoji set selection is in puzzle/PuzzleGrid.tsx
 */

import React from 'react';
import { getSpaceEmoji, getEmojiDescription } from '@/lib/spaceEmojis';
import { cn } from '@/lib/utils';

interface PuzzleGridProps {
  grid: number[][];
  editable?: boolean;
  onCellClick?: (row: number, col: number, currentValue: number) => void;
  className?: string;
  title?: string;
}

export function PuzzleGrid({ 
  grid, 
  editable = false, 
  onCellClick, 
  className,
  title 
}: PuzzleGridProps) {
  const handleCellClick = (row: number, col: number) => {
    if (editable && onCellClick) {
      onCellClick(row, col, grid[row][col]);
    }
  };

  if (!grid || grid.length === 0) {
    return (
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-gray-500 text-center">No grid data</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {title && (
        <h3 className="text-lg font-semibold text-center">{title}</h3>
      )}
      <div 
        className="inline-block border-2 border-gray-800 bg-white"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${grid[0].length}, 1fr)`,
          gap: '1px',
          backgroundColor: '#1f2937'
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cellValue, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "w-12 h-12 flex items-center justify-center bg-white text-2xl select-none",
                editable && "cursor-pointer hover:bg-gray-100 active:bg-gray-200",
                "transition-colors duration-150"
              )}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              title={`${getEmojiDescription(cellValue)} (${cellValue})`}
            >
              {getSpaceEmoji(cellValue)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
