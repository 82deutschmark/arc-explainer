/**
 * PuzzleGrid Component
 * Renders a full grid of cells for puzzle input/output visualization
 * Author: Cascade
 */

import React from 'react';
import { PuzzleGridProps } from '@/types/puzzle';
import { Badge } from '@/components/ui/badge';
import { GridCell } from './GridCell';

export function PuzzleGrid({ grid, title, showEmojis, highlight = false }: PuzzleGridProps) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const maxDim = Math.max(rows, cols);
  
  // Dynamically adjust cell size based on grid dimensions
  const size = maxDim <= 5 ? "large" : maxDim <= 10 ? "normal" : "small";
  
  return (
    <div className={`text-center space-y-2 ${highlight ? 'bg-green-50 p-4 rounded-lg border-2 border-green-300' : ''}`}>
      <div className="flex items-center justify-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant="outline" className="text-xs">{rows}×{cols}</Badge>
      </div>
      <div className="inline-block border-2 border-gray-400 rounded">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((cell, colIndex) => (
              <GridCell 
                key={colIndex}
                value={cell} 
                showEmojis={showEmojis}
                size={size}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
