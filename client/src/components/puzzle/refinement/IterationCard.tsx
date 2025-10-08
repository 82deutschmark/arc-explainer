/**
 * IterationCard.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Display component for single refinement iteration in progressive reasoning.
 * Shows one iteration of model's self-refinement with positive/progressive styling.
 * Wraps AnalysisResultCard which handles all grid scaling naturally via PuzzleGrid component.
 * SRP/DRY check: Pass - Single responsibility (iteration display), reuses AnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui Card, Badge, Collapsible components
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface IterationCardProps {
  explanation: ExplanationData;
  models?: ModelConfig[];
  testCases: ARCExample[];
  timestamp: string;
  iterationNumber: number; // Which iteration this is (1, 2, 3...)
  cumulativeReasoningTokens?: number; // Cumulative reasoning tokens from all iterations
}

export const IterationCard: React.FC<IterationCardProps> = ({
  explanation,
  models,
  testCases,
  timestamp,
  iterationNumber,
  cumulativeReasoningTokens
}) => {
  const [isOpen, setIsOpen] = useState(true); // Open by default for latest iteration

  // Determine correctness status
  const hasMultiTest = explanation.hasMultiplePredictions &&
    (explanation.multiTestAllCorrect !== undefined || explanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? explanation.multiTestAllCorrect === true
    : explanation.isPredictionCorrect === true;

  // Create brief summary from pattern description (first 100 chars)
  const briefSummary = explanation.patternDescription
    ? (explanation.patternDescription.length > 100
      ? explanation.patternDescription.substring(0, 100) + '...'
      : explanation.patternDescription)
    : 'No pattern description available';

  return (
    <Card className="border-2 border-purple-200 bg-purple-50/30 overflow-visible">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-3 bg-gradient-to-r from-purple-100/50 to-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-sm flex-wrap">
            <Brain className="h-5 w-5 text-purple-600" />
            <span className="text-purple-900 font-semibold">Iteration #{iterationNumber}</span>
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300">
              {explanation.modelName}
            </Badge>
            {isExplicitlyCorrect && (
              <Badge variant="default" className="text-xs bg-green-600">
                ✓ Correct
              </Badge>
            )}
            {(hasMultiTest ? explanation.multiTestAllCorrect : explanation.isPredictionCorrect) === false && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                Needs Refinement
              </Badge>
            )}
            <span className="ml-auto text-[10px] text-gray-500 font-normal">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          </CardTitle>

          {/* Brief summary - always visible */}
          <p className="text-sm text-gray-700 mt-2 line-clamp-2 italic">
            {briefSummary}
          </p>

          {/* Reasoning Token Display */}
          {explanation.reasoningTokens && explanation.reasoningTokens > 0 && (
            <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-900">
                    Reasoning: {explanation.reasoningTokens.toLocaleString()} tokens
                  </span>
                </div>
                {cumulativeReasoningTokens !== undefined && (
                  <span className="text-xs text-purple-700 font-medium">
                    Chain Total: {cumulativeReasoningTokens.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <div className="w-full bg-purple-200 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min((explanation.reasoningTokens / 100000) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-purple-600 mt-1.5">
                  Reasoning depth: {Math.round((explanation.reasoningTokens / 1000))}k tokens preserved on server
                </p>
              </div>
            </div>
          )}

          {/* Toggle button */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-xs justify-center hover:bg-purple-100"
            >
              {isOpen ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show details
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-3 overflow-x-auto">
            <AnalysisResultCard
              result={explanation}
              modelKey={explanation.modelName}
              model={models?.find(m => m.key === explanation.modelName)}
              testCases={testCases}
              eloMode={false}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
