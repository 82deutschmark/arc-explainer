/**
 * CompactPuzzleDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Reusable component for displaying puzzle overview in compact format.
 * Single responsibility: Puzzle visualization only - highly reusable across app.
 * SRP/DRY check: Pass - Focused only on puzzle display concerns, reuses PuzzleGrid
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

// Reuse existing components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';

// Types
import type { ARCExample } from '@shared/types';

interface CompactPuzzleDisplayProps {
  // Core data
  trainExamples: ARCExample[];
  testCase: ARCExample;

  // Configuration
  title?: string;
  maxTrainingExamples?: number;
  showEmojis?: boolean;
  showTitle?: boolean;
}

export const CompactPuzzleDisplay: React.FC<CompactPuzzleDisplayProps> = ({
  trainExamples,
  testCase,
  title = "Training Grids",
  maxTrainingExamples = 4,
  showEmojis = false,
  showTitle = true
}) => {
  const displayedExamples = trainExamples.slice(0, maxTrainingExamples);

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-3">
        {/* Very compact puzzle overview - minimal vertical space */}
        <div className="flex gap-4">
          {/* Training examples in ultra-compact format */}
          <div className="flex-1">
            <h3 className="text-xs font-semibold mb-1 flex items-center gap-1">
              Training Grids
              <Badge variant="outline" className="text-xs px-1 py-0">
                {trainExamples.length}
              </Badge>
            </h3>
            <div className="flex gap-1 overflow-x-auto">
              {displayedExamples.map((example, index) => (
                <div key={index} className="border border-gray-200 rounded p-1 flex-shrink-0">
                  <div className="text-xs text-center mb-1">{index + 1}</div>
                  <div className="flex items-center gap-1">
                    <div className="scale-25 origin-center transform -my-8 -mx-4">
                      <PuzzleGrid
                        grid={example.input}
                        title=""
                        showEmojis={showEmojis}
                      />
                    </div>
                    <div className="text-xs text-gray-400">→</div>
                    <div className="scale-25 origin-center transform -my-8 -mx-4">
                      <PuzzleGrid
                        grid={example.output}
                        title=""
                        showEmojis={showEmojis}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {trainExamples.length > maxTrainingExamples && (
                <div className="text-xs text-gray-500 self-center px-2">
                  +{trainExamples.length - maxTrainingExamples} more
                </div>
              )}
            </div>
          </div>

          {/* Test case - also very compact */}
          <div className="flex-shrink-0">
            <h3 className="text-xs font-semibold mb-1">Test Grid</h3>
            <div className="border border-gray-200 rounded p-1">
              <div className="scale-25 origin-center transform -my-8 -mx-4">
                <PuzzleGrid
                  grid={testCase.input}
                  title=""
                  showEmojis={showEmojis}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};