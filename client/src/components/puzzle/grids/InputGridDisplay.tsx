/**
 * InputGridDisplay.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Semantic wrapper for input grids with consistent labeling and styling.
 * Provides a standardized way to display puzzle inputs across the application.
 * 
 * SRP/DRY check: Pass - Semantic wrapper for inputs, delegates rendering to GridDisplay
 * shadcn/ui: Pass - Inherits from GridDisplay
 */

import React from 'react';
import { GridDisplay } from './GridDisplay';

interface InputGridDisplayProps {
  grid: number[][];
  sizeClass?: string;
  showDimensions?: boolean;
  className?: string;
}

/**
 * Displays an input grid with standardized "Input" label.
 * Use this component anywhere you need to show puzzle input grids.
 */
export const InputGridDisplay = React.memo(function InputGridDisplay({
  grid,
  sizeClass,
  showDimensions = true,
  className
}: InputGridDisplayProps) {
  return (
    <GridDisplay
      grid={grid}
      label="Input"
      sizeClass={sizeClass}
      showDimensions={showDimensions}
      className={className}
    />
  );
});
