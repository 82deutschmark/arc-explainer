/**
 * GridDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-20
 * PURPOSE: Base component for rendering a single grid with label, dimensions, and intelligent sizing.
 * Provides consistent grid rendering across training examples, test cases, and predictions.
 * Uses dynamic sizing utility to handle extreme aspect ratios without scrollbars or wasted space.
 * Integrates with gridSizing.ts for intelligent container dimension calculations.
 *
 * SRP/DRY check: Pass - Single responsibility: render one labeled grid with smart sizing
 * shadcn/ui: Pass - Uses Badge component for dimensions display
 */

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { calculateGridSize } from '@/utils/gridSizing';

interface GridDisplayProps {
  grid: number[][];
  label: string;
  sizeClass?: string; // Legacy prop - if provided, overrides intelligent sizing
  showDimensions?: boolean;
  className?: string;
  /** Maximum width constraint in pixels (default: auto-calculated) */
  maxWidth?: number;
  /** Maximum height constraint in pixels (default: auto-calculated) */
  maxHeight?: number;
  /** Use intelligent sizing (default: true) */
  useIntelligentSizing?: boolean;
}

/**
 * Renders a single grid with label and optional dimensions badge.
 * Uses intelligent sizing to handle extreme aspect ratios without scrollbars.
 * Used as building block for input/output displays across the app.
 */
export const GridDisplay = React.memo(function GridDisplay({
  grid,
  label,
  sizeClass,
  showDimensions = true,
  className = '',
  maxWidth,
  maxHeight,
  useIntelligentSizing = true,
}: GridDisplayProps) {
  if (!grid || grid.length === 0) {
    const fallbackSizeClass = sizeClass || 'max-w-[16rem] max-h-[16rem]';
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="text-[11px] text-gray-600 mb-1 font-medium">{label}</div>
        <div className={`${fallbackSizeClass} border border-red-300 p-2 bg-red-50 flex items-center justify-center`}>
          <span className="text-xs text-red-600">Invalid grid</span>
        </div>
      </div>
    );
  }

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  // Calculate intelligent container size
  const containerStyle = useMemo(() => {
    // If legacy sizeClass is provided, skip intelligent sizing
    if (sizeClass || !useIntelligentSizing) {
      return undefined;
    }

    const size = calculateGridSize(
      { rows, cols },
      {
        maxWidth,
        maxHeight,
      }
    );

    return {
      width: `${size.width}px`,
      maxWidth: `${size.width}px`,
      height: `${size.height}px`,
      maxHeight: `${size.height}px`,
    };
  }, [rows, cols, sizeClass, useIntelligentSizing, maxWidth, maxHeight]);

  // Use legacy sizeClass if provided, otherwise use inline styles
  const containerClassName = sizeClass || '';

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
      <div
        className={`${containerClassName} border border-gray-400 p-1 bg-gray-900/5 flex items-center justify-center rounded`}
        style={containerStyle}
      >
        <TinyGrid grid={grid} />
      </div>
    </div>
  );
});
