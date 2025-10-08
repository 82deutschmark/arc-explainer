/**
 * AnalysisSelector.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Component for selecting which analysis to refine through progressive reasoning.
 * Shows list of eligible analyses with clear eligibility criteria and "Refine" actions.
 * Replaces ExplanationsList with pageContext prop hack.
 * Single responsibility: Analysis selection UI for refinement only.
 * SRP/DRY check: Pass - Focused only on analysis selection for refinement
 * shadcn/ui: Pass - Uses shadcn/ui Card, Button, Badge, Alert, ToggleGroup components
 */

import React, { useMemo } from 'react';
import { determineCorrectness } from '@shared/utils/correctness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Filter, CheckCircle, XCircle, Sparkles, Clock, AlertTriangle } from 'lucide-react';

// Reuse existing components
import { AnalysisResultListCard } from '@/components/puzzle/AnalysisResultListCard';

// Types
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface AnalysisSelectorProps {
  // Data
  explanations: ExplanationData[];
  models?: ModelConfig[];
  testCases: ARCExample[];

  // State
  correctnessFilter: 'all' | 'correct' | 'incorrect';

  // Actions
  onCorrectnessFilterChange: (filter: 'all' | 'correct' | 'incorrect') => void;
  onStartRefinement: (explanationId: number) => void;
}

// Helper: Identify models that support server-side reasoning persistence
const isReasoningModel = (modelName: string): boolean => {
  const normalizedModel = modelName.toLowerCase();
  return normalizedModel.includes('gpt-5') ||
         normalizedModel.includes('o3') ||
         normalizedModel.includes('o4') ||
         normalizedModel.includes('grok-4');
};

export const AnalysisSelector: React.FC<AnalysisSelectorProps> = ({
  explanations,
  models,
  testCases,
  correctnessFilter,
  onCorrectnessFilterChange,
  onStartRefinement
}) => {
  // Check if any explanations use non-reasoning models
  const hasNonReasoningModels = explanations.some(e => !isReasoningModel(e.modelName));

  // Filter explanations based on correctness
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

  // Count stats
  const totalCount = explanations.length;
  const correctCount = explanations.filter(e => {
    const correctness = determineCorrectness({
      modelName: e.modelName,
      isPredictionCorrect: e.isPredictionCorrect,
      multiTestAllCorrect: e.multiTestAllCorrect,
      hasMultiplePredictions: e.hasMultiplePredictions
    });
    return correctness.isCorrect;
  }).length;
  const incorrectCount = totalCount - correctCount;

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Select Analysis to Refine
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-sm text-gray-600 mb-3">
            Choose an explanation to refine through progressive reasoning with full conversation memory
          </p>

          {/* Warning for non-reasoning models */}
          {hasNonReasoningModels && (
            <Alert className="bg-amber-50 border-amber-300 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                <strong>Limited Memory Support:</strong> Some analyses below use models without server-side reasoning
                persistence. For best results, choose analyses from OpenAI GPT-5, o-series (o3, o4, o4-mini) or xAI Grok-4 models.
              </AlertDescription>
            </Alert>
          )}

          {/* Correctness Filter */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Filter by correctness:</span>
            <ToggleGroup
              type="single"
              value={correctnessFilter}
              onValueChange={(value) => {
                if (value) onCorrectnessFilterChange(value as 'all' | 'correct' | 'incorrect');
              }}
              className="bg-white border border-gray-200 rounded-md p-1"
            >
              <ToggleGroupItem value="all" className="text-xs px-3 py-1">
                All ({totalCount})
              </ToggleGroupItem>
              <ToggleGroupItem value="correct" className="text-xs px-3 py-1">
                <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                Correct ({correctCount})
              </ToggleGroupItem>
              <ToggleGroupItem value="incorrect" className="text-xs px-3 py-1">
                <XCircle className="h-3 w-3 mr-1 text-red-600" />
                Incorrect ({incorrectCount})
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* Explanations List */}
      {filteredExplanations.length > 0 ? (
        <div className="space-y-2">
          {filteredExplanations.map((explanation) => {
            const hasProviderResponseId = !!explanation.providerResponseId;
            const isEligible = hasProviderResponseId && isReasoningModel(explanation.modelName);

            return (
              <div key={explanation.id} className="relative">
                {/* Eligibility Badge Overlay */}
                {!isEligible && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Limited Memory
                    </Badge>
                  </div>
                )}

                <AnalysisResultListCard
                  result={explanation}
                  modelKey={explanation.modelName}
                  model={models?.find((m) => m.key === explanation.modelName)}
                  testCases={testCases}
                  actionButton={
                    <Button
                      size="sm"
                      onClick={() => onStartRefinement(explanation.id)}
                      className={
                        isEligible
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                          : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                      }
                    >
                      {isEligible ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          Refine This
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-1.5" />
                          Refine (Limited)
                        </>
                      )}
                    </Button>
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            No explanations match the current filter. Try adjusting your filter settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
