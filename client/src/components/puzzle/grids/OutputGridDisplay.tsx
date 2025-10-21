/**
 * OutputGridDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-20
 * PURPOSE: Semantic wrapper for output grids with consistent labeling and intelligent sizing.
 * Provides a standardized way to display puzzle outputs with smart aspect ratio handling.
 * Delegates rendering to GridDisplay with full support for intelligent sizing.
 *
 * SRP/DRY check: Pass - Semantic wrapper for outputs, delegates rendering to GridDisplay
 * shadcn/ui: Pass - Inherits from GridDisplay
 */

import React from 'react';
import { GridDisplay } from './GridDisplay';

interface OutputGridDisplayProps {
  grid: number[][];
  sizeClass?: string;
  showDimensions?: boolean;
  className?: string;
  /** Maximum width constraint in pixels (for intelligent sizing) */
  maxWidth?: number;
  /** Maximum height constraint in pixels (for intelligent sizing) */
  maxHeight?: number;
  /** Use intelligent sizing (default: true) */
  useIntelligentSizing?: boolean;
}

/**
 * Displays an output grid with standardized "Output" label.
 * Supports intelligent sizing to handle extreme aspect ratios.
 * Use this component anywhere you need to show puzzle output grids.
 */
export const OutputGridDisplay = React.memo(function OutputGridDisplay({
  grid,
  sizeClass,
  showDimensions = true,
  className,
  maxWidth,
  maxHeight,
  useIntelligentSizing,
}: OutputGridDisplayProps) {
  return (
    <GridDisplay
      grid={grid}
      label="Output"
      sizeClass={sizeClass}
      showDimensions={showDimensions}
      className={className}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      useIntelligentSizing={useIntelligentSizing}
    />
  );
});
