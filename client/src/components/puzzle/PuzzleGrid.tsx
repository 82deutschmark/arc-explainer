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
  // Validate grid and filter out null/undefined rows
  const validGrid = useMemo(() => {
    if (!grid || !Array.isArray(grid)) return [];
    return grid.filter(row => row && Array.isArray(row));
  }, [grid]);

  // Memoize expensive calculations
  const gridMetadata = useMemo(() => {
    const rows = validGrid.length;
    const cols = validGrid[0]?.length || 0;
    const maxDim = Math.max(rows, cols);
    const size: "small" | "normal" | "large" = maxDim <= 5 ? "large" : maxDim <= 10 ? "normal" : "small";
    
    return { rows, cols, maxDim, size };
  }, [validGrid]);

  // Memoize the grid content to prevent re-rendering cells unnecessarily
  const gridContent = useMemo(() => {
    return validGrid.map((row, rowIndex) => (
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
  }, [validGrid, showEmojis, gridMetadata.size, emojiSet, diffMask]);
  
  return (
    <div className={`text-center ${highlight ? 'bg-green-50 p-2 rounded-lg border-2 border-green-300' : ''}`}>
      <div className="flex items-center justify-center gap-1 mb-1">
        <h3 className="text-xs font-medium">{title}</h3>
        <Badge variant="outline" className="text-[10px] px-1 py-0">{gridMetadata.rows}×{gridMetadata.cols}</Badge>
      </div>
      <div className="inline-block border border-gray-400 rounded">
        {gridContent}
      </div>
    </div>
  );
});
