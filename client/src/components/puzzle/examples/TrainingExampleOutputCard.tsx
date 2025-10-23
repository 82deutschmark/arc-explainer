/**
 * TrainingExampleOutputCard.tsx
 *
 * Author: gpt-5-codex
 * Date: 2025-02-14
 * PURPOSE: Dedicated card wrapper for training output grids. Provides
 *          consistent styling and intelligent sizing to prevent scrollbars
 *          while delegating rendering to OutputGridDisplay.
 * SRP/DRY check: Pass — focuses solely on the output grid card shell and
 *                reuses shared display utilities.
 */

import React from 'react';
import { OutputGridDisplay } from '@/components/puzzle/grids/OutputGridDisplay';

interface TrainingExampleOutputCardProps {
  grid: number[][];
  className?: string;
  /** Optional override for the maximum width in pixels */
  maxWidth?: number;
  /** Optional override for the maximum height in pixels */
  maxHeight?: number;
  /** Toggle intelligent sizing (defaults to true) */
  useIntelligentSizing?: boolean;
}

const DEFAULT_MAX_DIMENSION = 220;

export const TrainingExampleOutputCard = React.memo(function TrainingExampleOutputCard({
  grid,
  className = '',
  maxWidth = DEFAULT_MAX_DIMENSION,
  maxHeight = DEFAULT_MAX_DIMENSION,
  useIntelligentSizing = true
}: TrainingExampleOutputCardProps) {
  return (
    <div className={`card bg-base-100 border border-base-300 shadow-sm ${className}`}>
      <div className="card-body p-3 items-center">
        <OutputGridDisplay
          grid={grid}
          showDimensions
          className="items-center"
          maxWidth={maxWidth}
          maxHeight={maxHeight}
          useIntelligentSizing={useIntelligentSizing}
        />
      </div>
    </div>
  );
});
