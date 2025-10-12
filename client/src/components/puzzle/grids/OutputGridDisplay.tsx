/**
 * OutputGridDisplay.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Semantic wrapper for output grids with consistent labeling and styling.
 * Provides a standardized way to display puzzle outputs across the application.
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
}

/**
 * Displays an output grid with standardized "Output" label.
 * Use this component anywhere you need to show puzzle output grids.
 */
export const OutputGridDisplay = React.memo(function OutputGridDisplay({
  grid,
  sizeClass,
  showDimensions = true,
  className
}: OutputGridDisplayProps) {
  return (
    <GridDisplay
      grid={grid}
      label="Output"
      sizeClass={sizeClass}
      showDimensions={showDimensions}
      className={className}
    />
  );
});
