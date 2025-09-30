/**
 * RebuttalCard.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-09-30
 * PURPOSE: Dedicated component for displaying a rebuttal/challenge in a debate.
 * This component wraps the AnalysisResultCard and adds context-specific styling and badges
 * to clearly identify this as a challenge response from another AI model.
 * SRP/DRY check: Pass - Single responsibility (display rebuttal), reuses AnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui Card and Badge components
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface RebuttalCardProps {
  explanation: ExplanationData;
  models?: ModelConfig[];
  testCases: ARCExample[];
  timestamp: string;
  rebuttalNumber?: number; // Optional number to show rebuttal order
}

export const RebuttalCard: React.FC<RebuttalCardProps> = ({
  explanation,
  models,
  testCases,
  timestamp,
  rebuttalNumber
}) => {
  // Determine correctness status
  const hasMultiTest = explanation.hasMultiplePredictions &&
    (explanation.multiTestAllCorrect !== undefined || explanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? explanation.multiTestAllCorrect === true
    : explanation.isPredictionCorrect === true;

  return (
    <Card className="border-2 border-red-200 bg-red-50/30">
      <CardHeader className="p-2 bg-red-100/50">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-red-600" />
          Challenge {rebuttalNumber ? `#${rebuttalNumber}` : ''}
          <Badge variant="destructive" className="text-xs">
            {explanation.modelName}
          </Badge>
          {isExplicitlyCorrect && (
            <Badge variant="default" className="text-xs bg-green-600">
              Correct
            </Badge>
          )}
          {!isExplicitlyCorrect && (
            <Badge variant="outline" className="text-xs">
              {(hasMultiTest ? explanation.multiTestAllCorrect : explanation.isPredictionCorrect) === false
                ? 'Incorrect'
                : 'Unverified'}
            </Badge>
          )}
          <span className="ml-auto text-[10px] text-gray-500 font-normal">
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <AnalysisResultCard
          result={explanation}
          modelKey={explanation.modelName}
          model={models?.find(m => m.key === explanation.modelName)}
          testCases={testCases}
          eloMode={false}
        />
      </CardContent>
    </Card>
  );
};
