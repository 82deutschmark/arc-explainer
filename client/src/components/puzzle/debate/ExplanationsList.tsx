/**
 * ExplanationsList.tsx
 *
 * Author: Claude Sonnet 4.5
 * Date: 2025-09-29
 * PURPOSE: Reusable component for displaying and filtering explanations with debate triggers.
 * NOW USES SHARED CORRECTNESS LOGIC to match AccuracyRepository (no more invented logic!)
 * Single responsibility: Explanation list display and filtering only.
 * SRP/DRY check: Pass - Uses shared correctness utility, focused on list concerns
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useMemo } from 'react';
import { determineCorrectness } from '@shared/utils/correctness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MessageSquare, Filter } from 'lucide-react';

// Reuse existing components
import { AnalysisResultListCard } from '@/components/puzzle/AnalysisResultListCard';

// Types
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface ExplanationsListProps {
  // Data
  explanations: ExplanationData[];
  models?: ModelConfig[];
  testCases: ARCExample[];

  // State
  correctnessFilter: 'all' | 'correct' | 'incorrect';

  // Actions
  onCorrectnessFilterChange: (filter: 'all' | 'correct' | 'incorrect') => void;
  onStartDebate: (explanationId: number) => void;

  // Configuration
  showDebateButton?: boolean;
  title?: string;
  subtitle?: string;
}

export const ExplanationsList: React.FC<ExplanationsListProps> = ({
  explanations,
  models,
  testCases,
  correctnessFilter,
  onCorrectnessFilterChange,
  onStartDebate,
  showDebateButton = true,
  title = "Explanations Available for Debate",
  subtitle = "Browse existing explanations and start debates on incorrect ones"
}) => {
  // Filter explanations based on correctness (use shared correctness logic!)
  const filteredExplanations = useMemo(() => {
    if (correctnessFilter === 'all') {
      return explanations;
    }

    return explanations.filter((explanation) => {
      const correctness = determineCorrectness({
        modelName: explanation.modelName,
        isPredictionCorrect: explanation.isPredictionCorrect,
        multiTestAllCorrect: explanation.multiTestAllCorrect,
        hasMultiplePredictions: explanation.hasMultiplePredictions
      });

      return correctnessFilter === 'correct' ? correctness.isCorrect : correctness.isIncorrect;
    });
  }, [explanations, correctnessFilter]);

  if (explanations.length === 0) {
    return null; // Let parent handle empty state
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {title}
              <Badge variant="outline" className="ml-2">
                {filteredExplanations.length} of {explanations.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {subtitle}
            </p>
          </div>

          {/* Correctness Filter - reused from PuzzleExaminer */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <ToggleGroup
              type="single"
              value={correctnessFilter}
              onValueChange={(value) => onCorrectnessFilterChange(value as 'all' | 'correct' | 'incorrect' || 'all')}
              className="bg-white border border-gray-200 rounded-md"
            >
              <ToggleGroupItem value="all" className="px-3 py-1 text-xs">
                All ({explanations.length})
              </ToggleGroupItem>
              <ToggleGroupItem value="incorrect" className="px-3 py-1 text-xs">
                Incorrect
              </ToggleGroupItem>
              <ToggleGroupItem value="correct" className="px-3 py-1 text-xs">
                Correct
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredExplanations.length > 0 ? (
          <div className="space-y-3">
            {filteredExplanations.map((explanation) => (
              <AnalysisResultListCard
                key={explanation.id}
                result={explanation}
                modelKey={explanation.modelName}
                model={models?.find(m => m.key === explanation.modelName)}
                testCases={testCases}
                onStartDebate={onStartDebate}
                showDebateButton={showDebateButton}
                compact={true}
                useScaledGrids={true}
                gridScale={0.5}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>
              No {correctnessFilter === 'correct' ? 'correct' : correctnessFilter === 'incorrect' ? 'incorrect' : ''} explanations found.
            </p>
            <p className="text-sm mt-1">
              {correctnessFilter === 'incorrect'
                ? 'All explanations appear to be correct, or switch to "All" to see all results.'
                : correctnessFilter === 'correct'
                ? 'No correct explanations found, or switch to "All" to see all results.'
                : 'No explanations available for this puzzle yet.'}
            </p>
            {filteredExplanations.length === 0 && explanations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onCorrectnessFilterChange('all')}
              >
                Show All Explanations
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};