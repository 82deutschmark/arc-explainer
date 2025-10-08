/**
 * PredictionCard.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Display component for single prediction iteration in visual timeline.
 * Shows predicted grid with correctness indicator, iteration number, model, and timestamp.
 * Used in CompactPuzzleDisplay to create visual conversation of predictions.
 * SRP/DRY check: Pass - Single responsibility (prediction visualization), reuses TinyGrid
 * shadcn/ui: Pass - Uses shadcn/ui Badge component
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
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
        <div className="text-[8px] text-gray-400">↓</div>
        <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono">
          #{prediction.iterationNumber}
        </Badge>
      </div>

      {/* Grid display with dynamic sizing */}
      <div className={`min-w-[8rem] max-w-[24rem] aspect-square border-2 rounded ${
        prediction.isCorrect
          ? 'border-green-600 shadow-lg shadow-green-200'
          : 'border-red-400'
      } overflow-hidden`}>
        <TinyGrid grid={prediction.grid} />
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-0.5 text-[8px] min-w-fit">
        <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono whitespace-nowrap">
          {prediction.modelName}
        </Badge>
        {prediction.isCorrect ? (
          <Badge className="text-[8px] px-1 py-0 bg-green-600 flex items-center gap-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Correct!
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-red-100 text-red-700 flex items-center gap-0.5">
            <XCircle className="h-2.5 w-2.5" />
            Incorrect
          </Badge>
        )}
        <span className="text-gray-500 text-[8px]">
          {new Date(prediction.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};
