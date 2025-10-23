/**
 * TrainingPairCard.tsx
 *
 * Author: gpt-5-codex
 * Date: 2025-02-14
 * PURPOSE: Layout container for a single training example that renders the
 *          input and output grids as distinct cards with intelligent sizing.
 *          Eliminates scrollbars by delegating rendering to dedicated grid
 *          card components and provides an optional zoom affordance.
 * SRP/DRY check: Pass — orchestrates training pair presentation while
 *                reusing specialized input/output card components.
 */

import React from 'react';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { TrainingExampleInputCard } from './TrainingExampleInputCard';
import { TrainingExampleOutputCard } from './TrainingExampleOutputCard';

interface TrainingPairCardProps {
  input: number[][];
  output: number[][];
  index: number;
  onZoom: () => void;
}

const CARD_DIMENSION = 220;

export const TrainingPairCard = React.memo(function TrainingPairCard({
  input,
  output,
  index,
  onZoom
}: TrainingPairCardProps) {
  const inputDims = `${input.length}×${input[0]?.length || 0}`;
  const outputDims = `${output.length}×${output[0]?.length || 0}`;

  return (
    <div
      className="relative flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onZoom}
    >
      {/* Zoom indicator overlay */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="bg-blue-500 text-white rounded p-1 shadow">
          <Maximize2 className="h-3 w-3" />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        <span>Training Example {index + 1}</span>
        <span className="font-normal text-[10px] text-gray-400 normal-case">
          {inputDims} → {outputDims}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <TrainingExampleInputCard
          grid={input}
          className="sm:flex-1"
          maxWidth={CARD_DIMENSION}
          maxHeight={CARD_DIMENSION}
        />

        <div className="flex items-center justify-center text-gray-400">
          <ArrowRight className="h-5 w-5" />
        </div>

        <TrainingExampleOutputCard
          grid={output}
          className="sm:flex-1"
          maxWidth={CARD_DIMENSION}
          maxHeight={CARD_DIMENSION}
        />
      </div>
    </div>
  );
});
