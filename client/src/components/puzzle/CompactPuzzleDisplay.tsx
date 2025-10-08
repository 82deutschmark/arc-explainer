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

// Types
import type { ARCExample } from '@shared/types';

interface CompactPuzzleDisplayProps {
  // Core data
  trainExamples: ARCExample[];
  testCases: ARCExample[]; // Changed from single testCase to array

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
  title = "Puzzle Overview",
  maxTrainingExamples = 4,
  showEmojis = false,
  showTitle = true,
  defaultTrainingCollapsed = true
}) => {
  const [isTrainingOpen, setIsTrainingOpen] = useState(!defaultTrainingCollapsed);
  const displayedExamples = trainExamples.slice(0, maxTrainingExamples);
  const isMultiTest = testCases.length > 1;

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
                    <div className="w-16 h-16 border border-white/30 p-0.5 bg-gray-900/5">
                      <TinyGrid grid={example.input} />
                    </div>
                    <div className="text-[9px] text-gray-400">→</div>
                    <div className="w-16 h-16 border border-white/30 p-0.5 bg-gray-900/5">
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

          {/* Test Cases - ALWAYS VISIBLE (RIGHT SIDE) */}
          <div className="flex flex-wrap items-center gap-12 min-w-fit">
            {testCases.map((testCase, index) => (
              <div key={index} className="flex items-center gap-6 min-w-fit">
                {isMultiTest && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    Test {index + 1}
                  </Badge>
                )}
                <div>
                  <div className="text-[9px] text-gray-600 mb-1">Input</div>
                  <div className="w-32 h-32 border border-white/40 p-1 bg-gray-900/5">
                    <TinyGrid grid={testCase.input} />
                  </div>
                </div>
                <div className="text-xs text-gray-400">→</div>
                <div>
                  <div className="text-[9px] text-green-700 font-medium mb-1">Correct</div>
                  <div className="w-32 h-32 border border-white/40 p-1 bg-gray-900/5">
                    <TinyGrid grid={testCase.output} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};