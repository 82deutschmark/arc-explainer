/**
 * CompactPuzzleDisplay.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Last Modified: 2025-10-11 (Complete modularization)
 * Date: 2025-10-07T21:12:05-04:00
 * PURPOSE: Reusable component for displaying puzzle overview in compact format.
 * Orchestrates training examples, test cases, and prediction history.
 * FULLY MODULARIZED: All grids now use dedicated components (Phase 3 refactor).
 * 
 * ARCHITECTURE (Oct 11, 2025):
 * - TrainingPairGallery for training examples (collapsible)
 * - TestCaseGallery for test cases (adaptive layout)
 * - PredictionCard for refinement history (horizontal scroll)
 * - All grid rendering delegated to specialized components
 * 
 * Single responsibility: Orchestration only - no direct grid rendering.
 * SRP/DRY check: Pass - Pure orchestration, delegates all rendering
 * shadcn/ui: Pass - Uses shadcn/ui Collapsible, Card, Badge components
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

// Reuse existing components
import { PredictionCard, PredictionIteration } from '@/components/puzzle/PredictionCard';
import { TrainingPairGallery } from '@/components/puzzle/examples/TrainingPairGallery';
import { TestCaseGallery } from '@/components/puzzle/testcases/TestCaseGallery';

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
  const hasPredictions = showPredictions && predictions && predictions.length > 0;

  return (
    <Card className="p-0">
      {showTitle && (
        <CardHeader className="p-1">
          <CardTitle className="text-xs font-semibold">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-3">
        <div className="space-y-4">
          {/* Training Examples - GALLERY LAYOUT IN COLLAPSIBLE */}
          <Collapsible open={isTrainingOpen} onOpenChange={setIsTrainingOpen}>
            <div className="flex items-center justify-between mb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 h-auto hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    {isTrainingOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="text-sm font-semibold">Training Examples</span>
                    <Badge variant="outline" className="text-xs">
                      {trainExamples.length}
                    </Badge>
                  </div>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="pl-2">
                <TrainingPairGallery
                  trainExamples={trainExamples}
                  showEmojis={showEmojis}
                  showHeader={false}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Test Cases - DELEGATED TO TESTCASEGALLERY */}
          <TestCaseGallery
            testCases={testCases}
            showHeader={false}
            showEmojis={showEmojis}
          />

          {/* Refinement History - HORIZONTAL with better visibility */}
          {hasPredictions && (
            <div className="w-full border-t-2 border-purple-400 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-purple-900">
                  Refinement History
                </h3>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700">
                  {predictions!.length} iteration{predictions!.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-2">
                {predictions!.map((pred, index) => (
                  <div key={index} className="flex-shrink-0">
                    <PredictionCard
                      prediction={pred}
                      isLatest={index === predictions!.length - 1}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};