/**
 * OriginalExplanationCard.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-09-30
 * PURPOSE: Dedicated component for displaying the original explanation in a debate.
 * This component wraps the AnalysisResultCard and adds context-specific styling and badges
 * to clearly identify this as the original explanation being debated.
 * SRP/DRY check: Pass - Single responsibility (display original explanation), reuses AnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui Card and Badge components
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquare, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface OriginalExplanationCardProps {
  explanation: ExplanationData;
  models?: ModelConfig[];
  testCases: ARCExample[];
  timestamp: string;
}

export const OriginalExplanationCard: React.FC<OriginalExplanationCardProps> = ({
  explanation,
  models,
  testCases,
  timestamp
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Determine correctness status
  const hasMultiTest = explanation.hasMultiplePredictions &&
    (explanation.multiTestAllCorrect !== undefined || explanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? explanation.multiTestAllCorrect === true
    : explanation.isPredictionCorrect === true;

  const wasIncorrect = !isExplicitlyCorrect;

  // Create brief summary from pattern description (first 80 chars)
  const briefSummary = explanation.patternDescription
    ? (explanation.patternDescription.length > 80
      ? explanation.patternDescription.substring(0, 80) + '...'
      : explanation.patternDescription)
    : 'No pattern description available';

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-2 bg-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-sm flex-wrap">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            Original Explanation
            <Badge variant="default" className="text-xs">
              {explanation.modelName}
            </Badge>
            {(hasMultiTest ? explanation.multiTestAllCorrect : explanation.isPredictionCorrect) === false && (
              <Badge variant="destructive" className="text-xs">
                Incorrect
              </Badge>
            )}
            {explanation.rebuttingExplanationId && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                Rebuttal
              </Badge>
            )}
            <span className="ml-auto text-[10px] text-gray-500 font-normal">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          </CardTitle>

          {/* Brief summary - always visible */}
          <p className="text-xs text-gray-700 mt-2 line-clamp-2">
            {briefSummary}
          </p>

          {/* Toggle button */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-7 text-xs justify-center"
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
          <CardContent className="p-2">
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
