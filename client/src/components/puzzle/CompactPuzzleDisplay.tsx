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
  title = "Puzzle Pattern",
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
      <CardContent>
        {/* Compact puzzle overview */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Training examples in compact format */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                Training Examples
                <Badge variant="outline" className="text-xs">
                  {trainExamples.length}
                </Badge>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {displayedExamples.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded p-2">
                    <div className="text-xs text-center mb-1">Ex {index + 1}</div>
                    <div className="flex items-center gap-1">
                      <div className="scale-75 origin-top-left">
                        <PuzzleGrid
                          grid={example.input}
                          title=""
                          showEmojis={showEmojis}
                        />
                      </div>
                      <div className="text-sm text-gray-400">→</div>
                      <div className="scale-75 origin-top-right">
                        <PuzzleGrid
                          grid={example.output}
                          title=""
                          showEmojis={showEmojis}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {trainExamples.length > maxTrainingExamples && (
                <p className="text-xs text-gray-500 mt-1">
                  ...and {trainExamples.length - maxTrainingExamples} more examples
                </p>
              )}
            </div>

            {/* Test case */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Test Question</h3>
              <div className="border border-gray-200 rounded p-2">
                <div className="flex justify-center">
                  <PuzzleGrid
                    grid={testCase.input}
                    title="Solve this"
                    showEmojis={showEmojis}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};