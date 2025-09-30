/**
 * DebateAnalysisResultCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-09-29T21:48:00-04:00
 * PURPOSE: Simple pass-through to AnalysisResultCard for Model Debate views.
 * NO MORE CSS TRANSFORM HACKS - let PuzzleGrid/GridCell handle sizing naturally.
 * The proper components (PuzzleGrid, GridCell) already scale based on grid dimensions.
 * 
 * SRP/DRY check: Pass - Just delegates to AnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui components via AnalysisResultCard
 */

import React from 'react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { AnalysisResultCardProps } from '@/types/puzzle';

/**
 * For debate views, just use the standard AnalysisResultCard.
 * PuzzleGrid automatically scales based on grid dimensions (small/normal/large).
 * No transform hacks needed - proper components handle it.
 */
export const DebateAnalysisResultCard: React.FC<AnalysisResultCardProps> = (props) => {
  return <AnalysisResultCard {...props} />;
};
