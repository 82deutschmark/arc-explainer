/**
 * InputGridDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-20
 * PURPOSE: Semantic wrapper for input grids with consistent labeling and intelligent sizing.
 * Provides a standardized way to display puzzle inputs with smart aspect ratio handling.
 * Delegates rendering to GridDisplay with full support for intelligent sizing.
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
  /** Maximum width constraint in pixels (for intelligent sizing) */
  maxWidth?: number;
  /** Maximum height constraint in pixels (for intelligent sizing) */
  maxHeight?: number;
  /** Use intelligent sizing (default: true) */
  useIntelligentSizing?: boolean;
}

/**
 * Displays an input grid with standardized "Input" label.
 * Supports intelligent sizing to handle extreme aspect ratios.
 * Use this component anywhere you need to show puzzle input grids.
 */
export const InputGridDisplay = React.memo(function InputGridDisplay({
  grid,
  sizeClass,
  showDimensions = true,
  className,
  maxWidth,
  maxHeight,
  useIntelligentSizing,
}: InputGridDisplayProps) {
  return (
    <GridDisplay
      grid={grid}
      label="Input"
      sizeClass={sizeClass}
      showDimensions={showDimensions}
      className={className}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      useIntelligentSizing={useIntelligentSizing}
    />
  );
});
