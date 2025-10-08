/**
 * CompactPuzzleDisplay.tsx
 *
 * Author: Cascade using Claude Sonnet 4 on 2025-10-07
 * Date: 2025-10-07T21:12:05-04:00
 * PURPOSE: Reusable component for displaying puzzle overview in compact format.
 * NOW SUPPORTS MULTIPLE TEST CASES for multi-test puzzles like 195c6913.
 * Shows all test inputs and correct outputs, with training examples collapsed.
 * Uses shadcn/ui Collapsible component for training examples toggle.
 * DESIGN FIX: Removed internal overflow-x-auto scrollbars (major UX violation).
 * Content now flows naturally, letting page-level scrolling handle overflow.
 * Single responsibility: Puzzle visualization only - highly reusable across app.
 * SRP/DRY check: Pass - Focused only on puzzle display concerns, reuses TinyGrid
 * shadcn/ui: Pass - Uses shadcn/ui Collapsible, Card, Badge components
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Reuse existing components
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { PredictionCard, PredictionIteration } from '@/components/puzzle/PredictionCard';

// Types
import type { ARCExample } from '@shared/types';

interface CompactPuzzleDisplayProps {
  // Core data
  trainExamples: ARCExample[];
  testCases: ARCExample[]; // Changed from single testCase to array

  // Predictions timeline (NEW)
  predictions?: PredictionIteration[];
  showPredictions?: boolean;

  // Configuration
  title?: string;
  maxTrainingExamples?: number;
  showEmojis?: boolean;
  showTitle?: boolean;
  defaultTrainingCollapsed?: boolean;
}

export const CompactPuzzleDisplay: React.FC<CompactPuzzleDisplayProps> = ({
  trainExamples,
  testCases,
  predictions,
  showPredictions = false,
  title = "Puzzle Overview",
  maxTrainingExamples = 4,
  showEmojis = false,
  showTitle = true,
  defaultTrainingCollapsed = true
}) => {
  const [isTrainingOpen, setIsTrainingOpen] = useState(!defaultTrainingCollapsed);
  const displayedExamples = trainExamples.slice(0, maxTrainingExamples);
  const isMultiTest = testCases.length > 1;
  const hasPredictions = showPredictions && predictions && predictions.length > 0;

  // Adaptive grid sizing based on test count
  const getGridSizeClass = (testCount: number): string => {
    if (testCount === 1) {
      return 'w-48 h-48';       // 192px - single test has space
    } else if (testCount === 2) {
      return 'w-32 h-32';       // 128px - dual test horizontal
    } else {
      return 'w-24 h-24';       // 96px - multi-test vertical stack
    }
  };

  const gridSizeClass = getGridSizeClass(testCases.length);

  // Adaptive layout direction
  const containerClass = testCases.length > 2
    ? 'flex flex-col gap-3'          // Vertical stack for 3+ tests
    : 'flex flex-row flex-wrap gap-8'; // Horizontal for 1-2 tests

  return (
    <Card className="p-0">
      {showTitle && (
        <CardHeader className="p-1">
          <CardTitle className="text-xs font-semibold">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-1">
        <div className="flex flex-wrap items-start gap-10">
          {/* Training Examples - COLLAPSIBLE (LEFT SIDE) */}
          <Collapsible open={isTrainingOpen} onOpenChange={setIsTrainingOpen} className="min-w-fit">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1 h-auto hover:bg-gray-100">
                <div className="flex items-center">
                  {isTrainingOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="text-[10px] font-semibold ml-1">
                    Train
                    <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                      {trainExamples.length}
                    </Badge>
                  </span>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-8 p-1">
                {displayedExamples.map((example, index) => (
                  <div key={index} className="flex items-center gap-6 min-w-fit">
                    <div className="text-[9px] text-gray-500">{index + 1}.</div>
                    <div className="min-w-[4rem] max-w-[12rem] aspect-square border border-white/30 p-0.5 bg-gray-900/5">
                      <TinyGrid grid={example.input} />
                    </div>
                    <div className="text-[9px] text-gray-400">→</div>
                    <div className="min-w-[4rem] max-w-[12rem] aspect-square border border-white/30 p-0.5 bg-gray-900/5">
                      <TinyGrid grid={example.output} />
                    </div>
                  </div>
                ))}
                {trainExamples.length > maxTrainingExamples && (
                  <div className="text-[9px] text-gray-500 min-w-fit">
                    +{trainExamples.length - maxTrainingExamples}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Test Cases - ADAPTIVE LAYOUT */}
          <div className={containerClass}>
            {testCases.map((testCase, index) => (
              <div key={index} className="flex flex-col gap-1 min-w-fit">
                {/* Badge ABOVE row if multi-test */}
                {isMultiTest && (
                  <span className="text-[9px] text-gray-500 font-medium">
                    Test {index + 1}
                  </span>
                )}

                {/* Input → Output row with proper spacing */}
                <div className={`flex items-center ${testCases.length > 2 ? 'gap-8' : 'gap-10'}`}>
                  <div>
                    <div className="text-[9px] text-gray-600 mb-1">Input</div>
                    <div className={`${gridSizeClass} border border-white/40 p-1 bg-gray-900/5`}>
                      <TinyGrid grid={testCase.input} />
                    </div>
                  </div>

                  {/* Visual separator - adaptive based on layout */}
                  {testCases.length > 2 ? (
                    <div className="text-xs text-gray-400">→</div>
                  ) : (
                    <div className="flex items-center px-2">
                      <div className="w-px h-24 bg-gray-300"></div>
                    </div>
                  )}

                  <div>
                    <div className="text-[9px] text-gray-600 mb-1">Output</div>
                    <div className={`${gridSizeClass} border border-white/40 p-1 bg-gray-900/5`}>
                      <TinyGrid grid={testCase.output} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction Timeline - VERTICAL (NEW) */}
        {hasPredictions && (
          <div className="w-full border-t border-purple-300 pt-2 mt-3">
            <div className="text-[9px] font-semibold text-purple-700 mb-1 flex items-center gap-1">
              <span>Prediction Evolution</span>
              <Badge variant="outline" className="text-[8px] px-1 py-0">
                {predictions!.length} iteration{predictions!.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              {predictions!.map((pred, index) => (
                <PredictionCard
                  key={index}
                  prediction={pred}
                  isLatest={index === predictions!.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};