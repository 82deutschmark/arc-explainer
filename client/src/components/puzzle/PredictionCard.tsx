/**
 * PredictionCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:26:00Z
 * PURPOSE: Display component for single prediction iteration in visual timeline.
 * Shows predicted grid with correctness indicator, iteration number, model, and timestamp.
 * Used in CompactPuzzleDisplay to create visual conversation of predictions.
 * FIXES: Removed aspect-square constraint, improved typography (8px->10px), better spacing
 * SRP/DRY check: Pass - Single responsibility (prediction visualization), reuses TinyGrid
 * shadcn/ui: Pass - Converted to DaisyUI badge
 */

import React from 'react';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface PredictionIteration {
  grid: number[][];
  iterationNumber: number;
  isCorrect: boolean;
  modelName: string;
  timestamp: string;
}

interface PredictionCardProps {
  prediction: PredictionIteration;
  isLatest: boolean;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  isLatest
}) => {
  return (
    <div className={`flex items-start gap-2 p-1 rounded transition-all ${
      prediction.isCorrect
        ? 'bg-green-50/50 border border-green-300'
        : isLatest
        ? 'bg-purple-50/50 border border-purple-300'
        : 'bg-gray-50/30 border border-gray-200'
    }`}>
      {/* Iteration indicator */}
      <div className="flex flex-col items-center min-w-fit gap-0.5">
        <div className="text-[10px] text-gray-400">↓</div>
        <div className="badge badge-outline text-[10px] px-1 py-0 font-mono">
          #{prediction.iterationNumber}
        </div>
      </div>

      {/* Grid display with natural aspect ratio - NO FORCED SQUARES */}
      <div className={`min-w-[6rem] max-w-[20rem] max-h-[20rem] border-2 rounded ${
        prediction.isCorrect
          ? 'border-green-600 shadow-lg shadow-green-200'
          : 'border-red-400'
      } overflow-hidden flex items-center justify-center p-1`}>
        <TinyGrid grid={prediction.grid} />
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-1 text-[10px] min-w-fit">
        <div className="badge badge-outline text-[10px] px-1.5 py-0.5 font-mono whitespace-nowrap">
          {prediction.modelName}
        </div>
        {prediction.isCorrect ? (
          <div className="badge text-[10px] px-1.5 py-0.5 bg-green-600 text-white flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Correct!
          </div>
        ) : (
          <div className="badge text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Incorrect
          </div>
        )}
        <span className="text-gray-500 text-[10px]">
          {new Date(prediction.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};
