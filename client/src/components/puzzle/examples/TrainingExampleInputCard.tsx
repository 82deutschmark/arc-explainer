/**
 * TrainingExampleInputCard.tsx
 *
 * Author: gpt-5-codex
 * Date: 2025-02-14
 * PURPOSE: Dedicated card for rendering a single training input grid with
 *          intelligent sizing and consistent styling. Ensures grids fit
 *          within the card without scrollbars while delegating rendering to
 *          InputGridDisplay for label + dimension handling.
 * SRP/DRY check: Pass — component only concerns the input card wrapper and
 *                reuses shared grid rendering utilities.
 */

import React from 'react';
import { InputGridDisplay } from '@/components/puzzle/grids/InputGridDisplay';

interface TrainingExampleInputCardProps {
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

export const TrainingExampleInputCard = React.memo(function TrainingExampleInputCard({
  grid,
  className = '',
  maxWidth = DEFAULT_MAX_DIMENSION,
  maxHeight = DEFAULT_MAX_DIMENSION,
  useIntelligentSizing = true
}: TrainingExampleInputCardProps) {
  return (
    <div className={`card bg-base-100 border border-base-300 shadow-sm ${className}`}>
      <div className="card-body p-3 items-center">
        <InputGridDisplay
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
