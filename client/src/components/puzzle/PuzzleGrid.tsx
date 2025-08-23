/**
 * PuzzleGrid Component
 * Renders a full grid of cells for puzzle input/output visualization
 * Optimized with React.memo and useMemo for performance with large grids
 * Author: Cascade
 */

import React, { useMemo } from 'react';
import { PuzzleGridProps } from '@/types/puzzle';
import { Badge } from '@/components/ui/badge';
import { GridCell } from './GridCell';

export const PuzzleGrid = React.memo(function PuzzleGrid({ grid, title, showEmojis, highlight = false, emojiSet, diffMask }: PuzzleGridProps) {
  // Memoize expensive calculations
  const gridMetadata = useMemo(() => {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;
    const maxDim = Math.max(rows, cols);
    const size: "small" | "normal" | "large" = maxDim <= 5 ? "large" : maxDim <= 10 ? "normal" : "small";
    
    return { rows, cols, maxDim, size };
  }, [grid]);

  // Memoize the grid content to prevent re-rendering cells unnecessarily
  const gridContent = useMemo(() => {
    return grid.map((row, rowIndex) => (
      <div key={rowIndex} className="flex">
        {row.map((cell, colIndex) => (
          <GridCell 
            key={`${rowIndex}-${colIndex}`} // More stable key for better React optimization
            value={cell} 
            showEmojis={showEmojis}
            size={gridMetadata.size}
            emojiSet={emojiSet}
            mismatch={diffMask ? Boolean(diffMask[rowIndex]?.[colIndex]) : false}
          />
        ))}
      </div>
    ));
  }, [grid, showEmojis, gridMetadata.size, emojiSet, diffMask]);
  
  return (
    <div className={`text-center space-y-2 ${highlight ? 'bg-green-50 p-4 rounded-lg border-2 border-green-300' : ''}`}>
      <div className="flex items-center justify-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant="outline" className="text-xs">{gridMetadata.rows}×{gridMetadata.cols}</Badge>
      </div>
      <div className="inline-block border-2 border-gray-400 rounded">
        {gridContent}
      </div>
    </div>
  );
});
