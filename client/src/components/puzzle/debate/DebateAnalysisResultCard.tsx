/**
 * DebateAnalysisResultCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-09-29T15:01:20-04:00
 * PURPOSE: Compact, scaled version of AnalysisResultCard specifically for Model Debate views.
 * Uses CSS transforms to scale down grids to fit multiple analyses side-by-side without overlap.
 * SRP/DRY check: Pass - Reuses existing AnalysisResultCard, adds only scaling wrapper
 * shadcn/ui: Pass - Uses shadcn/ui components throughout via AnalysisResultCard
 */

import React from 'react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { AnalysisResultCardProps } from '@/types/puzzle';

interface DebateAnalysisResultCardProps extends AnalysisResultCardProps {
  /**
   * Scale factor for the grids (0.3 = 30% of original size)
   * Default: 0.4 (40% scale for readable but compact display)
   */
  gridScale?: number;
}

/**
 * Wrapper component that scales down AnalysisResultCard for compact debate view.
 * Uses CSS transform to prevent grid overlap on smaller screens.
 */
export const DebateAnalysisResultCard: React.FC<DebateAnalysisResultCardProps> = ({
  gridScale = 0.4,
  ...props
}) => {
  return (
    <div 
      className="debate-result-card"
      style={{
        // Scale the entire card's grids
        // Use transform-origin center so scaling happens from the middle
        '--grid-scale': gridScale.toString(),
      } as React.CSSProperties}
    >
      <style>{`
        .debate-result-card [class*="PuzzleGrid"],
        .debate-result-card .inline-block {
          transform: scale(var(--grid-scale));
          transform-origin: center;
          margin: calc(-50% * var(--grid-scale)) auto;
        }
        
        /* Ensure the parent container doesn't overflow */
        .debate-result-card .grid {
          overflow: visible;
        }
        
        /* Adjust spacing around scaled grids */
        .debate-result-card [class*="space-y"] {
          gap: 0.5rem;
        }
      `}</style>
      <AnalysisResultCard {...props} />
    </div>
  );
};
