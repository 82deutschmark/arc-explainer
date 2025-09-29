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
    <Card className="p-0">
      {showTitle && (
        <CardHeader className="p-1">
          <CardTitle className="text-xs font-semibold">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {/* Test Input and Correct Output - ALWAYS VISIBLE */}
        <div>
          <h3 className="text-[10px] font-semibold px-1">Test Input & Correct Output</h3>
          <div className="flex items-center">
            <div className="border-r border-gray-200">
              <div className="text-[9px] text-center text-gray-600">Input</div>
              <div style={{ transform: 'scale(0.2)', transformOrigin: 'center', margin: '-40% auto' }}>
                <PuzzleGrid
                  grid={testCase.input}
                  title=""
                  showEmojis={showEmojis}
                />
              </div>
            </div>
            <div className="text-xs text-gray-400 px-1">→</div>
            <div className="border-l border-green-200 bg-green-50">
              <div className="text-[9px] text-center text-green-700 font-medium">Correct</div>
              <div style={{ transform: 'scale(0.2)', transformOrigin: 'center', margin: '-40% auto' }}>
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
            <Button variant="ghost" size="sm" className="w-full justify-start p-1 h-auto hover:bg-gray-100">
              <div className="flex items-center w-full">
                {isTrainingOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span className="text-[10px] font-semibold ml-1">
                  Training Examples
                  <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                    {trainExamples.length}
                  </Badge>
                </span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex overflow-x-auto">
              {displayedExamples.map((example, index) => (
                <div key={index} className="border-r border-gray-200 flex-shrink-0">
                  <div className="text-[9px] text-center">{index + 1}</div>
                  <div className="flex items-center">
                    <div style={{ transform: 'scale(0.2)', transformOrigin: 'center', margin: '-40% auto' }}>
                      <PuzzleGrid
                        grid={example.input}
                        title=""
                        showEmojis={showEmojis}
                      />
                    </div>
                    <div className="text-[9px] text-gray-400">→</div>
                    <div style={{ transform: 'scale(0.2)', transformOrigin: 'center', margin: '-40% auto' }}>
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
                <div className="text-[9px] text-gray-500 self-center px-1">
                  +{trainExamples.length - maxTrainingExamples}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};