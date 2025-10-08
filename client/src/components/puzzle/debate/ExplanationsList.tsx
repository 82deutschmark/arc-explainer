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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Filter, CheckCircle, XCircle, Brain, AlertTriangle, Sparkles } from 'lucide-react';

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
  pageContext?: 'debate' | 'discussion'; // New: Determines UI text and warnings
}

export const ExplanationsList: React.FC<ExplanationsListProps> = ({
  explanations,
  models,
  testCases,
  correctnessFilter,
  onCorrectnessFilterChange,
  onStartDebate,
  showDebateButton = true,
  title,
  subtitle,
  pageContext = 'debate' // Default to debate context for backward compatibility
}) => {
  // Context-specific defaults
  const defaultTitle = pageContext === 'discussion'
    ? "Select Analysis to Refine"
    : "Explanations Available for Debate";

  const defaultSubtitle = pageContext === 'discussion'
    ? "Choose an explanation to refine through progressive reasoning with full memory"
    : "Browse existing explanations and start debates on incorrect ones";

  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;

  // Helper: Identify reasoning models (same logic as PuzzleDiscussion)
  const isReasoningModel = (modelName: string): boolean => {
    const normalizedModel = modelName.toLowerCase();
    return normalizedModel.includes('gpt-5') ||
           normalizedModel.includes('o3') ||
           normalizedModel.includes('o4') ||
           normalizedModel.includes('grok-4');
  };

  // Check if any explanations use non-reasoning models (for discussion context)
  const hasNonReasoningModels = pageContext === 'discussion' &&
    explanations.some(e => !isReasoningModel(e.modelName));

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
    <>
      {/* Reasoning Persistence Alert (Discussion Context Only) */}
      {pageContext === 'discussion' && (
        <Alert className="mb-4 bg-purple-50 border-purple-300">
          <Brain className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-sm text-purple-900">
            Selected analysis will be refined through progressive reasoning with full server-side memory (30-day retention).
            {hasNonReasoningModels && (
              <strong className="block mt-1 text-amber-800">⚠️ Some models may not support reasoning persistence.</strong>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {displayTitle}
                <Badge variant="outline" className="ml-2">
                  {filteredExplanations.length} of {explanations.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {displaySubtitle}
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
              <ToggleGroupItem value="all" className="text-xs px-3 py-1">
                All ({explanations.length})
              </ToggleGroupItem>
              <ToggleGroupItem value="correct" className="text-xs px-3 py-1 text-green-700 data-[state=on]:bg-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Correct ({explanations.filter(e => determineCorrectness({
                  modelName: e.modelName,
                  isPredictionCorrect: e.isPredictionCorrect,
                  multiTestAllCorrect: e.multiTestAllCorrect,
                  hasMultiplePredictions: e.hasMultiplePredictions
                }).isCorrect).length})
              </ToggleGroupItem>
              <ToggleGroupItem value="incorrect" className="text-xs px-3 py-1 text-red-700 data-[state=on]:bg-red-100">
                <XCircle className="h-3 w-3 mr-1" />
                Incorrect ({explanations.filter(e => determineCorrectness({
                  modelName: e.modelName,
                  isPredictionCorrect: e.isPredictionCorrect,
                  multiTestAllCorrect: e.multiTestAllCorrect,
                  hasMultiplePredictions: e.hasMultiplePredictions
                }).isIncorrect).length})
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
                debateButtonText={pageContext === 'discussion' ? 'Start Refinement' : 'Start Debate'}
                compact={true}
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
    </>
  );
};