/**
 * TrainingPairCard.tsx
 * 
 * Author: Cascade using Sonnet 4
 * Date: 2025-10-11T19:15:00Z
 * PURPOSE: Compact card displaying a single training example (input→output pair).
 * Clicking the card opens a zoom modal for detailed inspection.
 * Uses auto-scaling PuzzleGrid to fit irregular dimensions within fixed card bounds.
 * SRP: Single responsibility = render one training pair with zoom capability
 * DRY: Reuses PuzzleGrid component, no duplication
 * shadcn/ui: Uses Card components
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ArrowRight, Maximize2 } from 'lucide-react';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface TrainingPairCardProps {
  input: number[][];
  output: number[][];
  index: number;
  showEmojis: boolean;
  emojiSet?: EmojiSet;
  onZoom: () => void;
}

/**
 * Compact card for a single training example.
 * Auto-scales grids to fit within card, shows grid dimensions.
 * Click to open zoom modal for full-size view.
 */
export const TrainingPairCard = React.memo(function TrainingPairCard({
  input,
  output,
  index,
  showEmojis,
  emojiSet,
  onZoom
}: TrainingPairCardProps) {
  const inputDims = `${input.length}×${input[0]?.length || 0}`;
  const outputDims = `${output.length}×${output[0]?.length || 0}`;

  return (
    <Card 
      className="p-2 hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden"
      onClick={onZoom}
    >
      {/* Zoom indicator overlay */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="bg-blue-500 text-white rounded p-1">
          <Maximize2 className="h-3 w-3" />
        </div>
      </div>

      {/* Example number badge */}
      <div className="text-[10px] font-semibold text-gray-500 mb-1 text-center">
        Example {index + 1}
      </div>

      {/* Grid pair display */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex-shrink-0">
          <PuzzleGrid 
            grid={input}
            title="Input"
            showEmojis={showEmojis}
            emojiSet={emojiSet}
          />
        </div>
        
        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        
        <div className="flex-shrink-0">
          <PuzzleGrid 
            grid={output}
            title="Output"
            showEmojis={showEmojis}
            emojiSet={emojiSet}
          />
        </div>
      </div>

      {/* Dimensions info */}
      <div className="text-[9px] text-gray-400 text-center mt-1">
        {inputDims} → {outputDims}
      </div>
    </Card>
  );
});
