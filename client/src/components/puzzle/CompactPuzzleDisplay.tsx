/**
 * CompactPuzzleDisplay.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-09-29T17:18:00-04:00
 * PURPOSE: Reusable component for displaying puzzle overview in compact format.
 * Shows TEST INPUT and correct output by default, with training examples collapsed.
 * Uses shadcn/ui Collapsible component for training examples toggle.
 * Single responsibility: Puzzle visualization only - highly reusable across app.
 * SRP/DRY check: Pass - Focused only on puzzle display concerns, reuses PuzzleGrid
 * shadcn/ui: Pass - Uses shadcn/ui Collapsible, Card, Badge components
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  defaultTrainingCollapsed?: boolean;
}

export const CompactPuzzleDisplay: React.FC<CompactPuzzleDisplayProps> = ({
  trainExamples,
  testCase,
  title = "Puzzle Overview",
  maxTrainingExamples = 4,
  showEmojis = false,
  showTitle = true,
  defaultTrainingCollapsed = true
}) => {
  const [isTrainingOpen, setIsTrainingOpen] = useState(!defaultTrainingCollapsed);
  const displayedExamples = trainExamples.slice(0, maxTrainingExamples);

  return (
    <Card>
      {showTitle && (
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-semibold">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-3 space-y-3">
        {/* Test Input and Correct Output - ALWAYS VISIBLE */}
        <div>
          <h3 className="text-xs font-semibold mb-2">Test Input & Correct Output</h3>
          <div className="flex gap-2 items-center">
            <div className="border border-gray-200 rounded p-1">
              <div className="text-[10px] text-center mb-1 text-gray-600">Input</div>
              <div className="scale-25 origin-center transform -my-8 -mx-4">
                <PuzzleGrid
                  grid={testCase.input}
                  title=""
                  showEmojis={showEmojis}
                />
              </div>
            </div>
            <div className="text-sm text-gray-400">→</div>
            <div className="border border-green-200 bg-green-50 rounded p-1">
              <div className="text-[10px] text-center mb-1 text-green-700 font-medium">Correct Output</div>
              <div className="scale-25 origin-center transform -my-8 -mx-4">
                <PuzzleGrid
                  grid={testCase.output}
                  title=""
                  showEmojis={showEmojis}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Training Examples - COLLAPSIBLE */}
        <Collapsible open={isTrainingOpen} onOpenChange={setIsTrainingOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start p-2 h-auto hover:bg-gray-100">
              <div className="flex items-center gap-2 w-full">
                {isTrainingOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <h3 className="text-xs font-semibold flex items-center gap-1">
                  Training Examples
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {trainExamples.length}
                  </Badge>
                </h3>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
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
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};