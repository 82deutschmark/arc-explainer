/**
 * IterationCard.tsx
 *
 * Displays a single refinement iteration using shadcn/ui components.
 */

import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface IterationCardProps {
  explanation: ExplanationData;
  models?: ModelConfig[];
  testCases: ARCExample[];
  timestamp: string;
  iterationNumber: number;
  cumulativeReasoningTokens?: number;
}

export const IterationCard: React.FC<IterationCardProps> = ({
  explanation,
  models,
  testCases,
  timestamp,
  iterationNumber,
  cumulativeReasoningTokens,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const hasMultiTest =
    explanation.hasMultiplePredictions &&
    (explanation.multiTestAllCorrect !== undefined || explanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? explanation.multiTestAllCorrect === true
    : explanation.isPredictionCorrect === true;

  const needsRefinement =
    (hasMultiTest ? explanation.multiTestAllCorrect : explanation.isPredictionCorrect) === false;

  const briefSummary = explanation.patternDescription
    ? explanation.patternDescription.length > 100
      ? `${explanation.patternDescription.substring(0, 100)}...`
      : explanation.patternDescription
    : 'No pattern description available';

  return (
    <Card className="border-2 border-purple-200 bg-purple-50/30">
      <CardContent className="space-y-3 p-3">
        <div className="space-y-2 rounded-2xl bg-gradient-to-r from-purple-100/60 to-blue-100/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-purple-600" />
            <span className="text-purple-900">Iteration #{iterationNumber}</span>
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
              {explanation.modelName}
            </Badge>
            {isExplicitlyCorrect && (
              <Badge className="bg-green-600 text-xs text-white hover:bg-green-600">Correct</Badge>
            )}
            {needsRefinement && (
              <Badge variant="secondary" className="text-xs text-amber-800">
                Needs Refinement
              </Badge>
            )}
            <span className="ml-auto text-[10px] text-gray-500">{new Date(timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm italic text-gray-700">{briefSummary}</p>

          {explanation.reasoningTokens && explanation.reasoningTokens > 0 && (
            <div className="rounded-lg border border-purple-300 bg-purple-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-900">
                    Reasoning: {explanation.reasoningTokens.toLocaleString()} tokens
                  </span>
                </div>
                {cumulativeReasoningTokens !== undefined && (
                  <span className="text-xs font-medium text-purple-700">
                    Chain Total: {cumulativeReasoningTokens.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <div className="h-2.5 w-full rounded-full bg-purple-200">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600"
                    style={{ width: `${Math.min((explanation.reasoningTokens / 100000) * 100, 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-purple-600">
                  Reasoning depth: {Math.round(explanation.reasoningTokens / 1000)}k tokens preserved
                </p>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => setIsOpen(open => !open)}
          >
            {isOpen ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" />
                Show details
              </>
            )}
          </Button>
        </div>

        {isOpen && (
          <div className="rounded-2xl border border-purple-100 bg-white p-3">
            <AnalysisResultCard
              result={explanation}
              modelKey={explanation.modelName}
              model={models?.find(m => m.key === explanation.modelName)}
              testCases={testCases}
              eloMode={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
