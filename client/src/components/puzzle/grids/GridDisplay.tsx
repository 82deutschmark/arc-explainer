/**
 * GridDisplay.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Base component for rendering a single grid with label, dimensions, and styling.
 * Provides consistent grid rendering across training examples, test cases, and predictions.
 * Handles size constraints and auto-scaling using TinyGrid.
 * 
 * SRP/DRY check: Pass - Single responsibility: render one labeled grid
 * shadcn/ui: Pass - Uses Badge component for dimensions display
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TinyGrid } from '@/components/puzzle/TinyGrid';

interface GridDisplayProps {
  grid: number[][];
  label: string;
  sizeClass?: string;
  showDimensions?: boolean;
  className?: string;
}

/**
 * Renders a single grid with label and optional dimensions badge.
 * Used as building block for input/output displays across the app.
 */
export const GridDisplay = React.memo(function GridDisplay({
  grid,
  label,
  sizeClass = 'max-w-[16rem] max-h-[16rem]',
  showDimensions = true,
  className = ''
}: GridDisplayProps) {
  if (!grid || grid.length === 0) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="text-[11px] text-gray-600 mb-1 font-medium">{label}</div>
        <div className={`${sizeClass} border border-red-300 p-2 bg-red-50 flex items-center justify-center`}>
          <span className="text-xs text-red-600">Invalid grid</span>
        </div>
      </div>
    );
  }

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center gap-1 mb-1">
        <div className="text-[11px] text-gray-600 font-medium">{label}</div>
        {showDimensions && (
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            {rows}×{cols}
          </Badge>
        )}
      </div>
      <div className={`${sizeClass} border border-gray-400 p-1 bg-gray-900/5 flex items-center justify-center rounded`}>
        <TinyGrid grid={grid} />
      </div>
    </div>
  );
});
