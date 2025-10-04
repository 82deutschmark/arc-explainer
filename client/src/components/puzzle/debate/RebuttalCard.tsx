/**
 * RebuttalCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T22:00:00-04:00
 * PURPOSE: Wrapper component for displaying rebuttal/challenge responses in debates.
 * Removed width constraints and added overflow handling to properly display large multi-test grids.
 * Wraps AnalysisResultCard which handles all grid scaling naturally via PuzzleGrid component.
 * SRP/DRY check: Pass - Single responsibility (contextual wrapper), reuses AnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui Card, Badge, Collapsible components
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);

  // Determine correctness status
  const hasMultiTest = explanation.hasMultiplePredictions &&
    (explanation.multiTestAllCorrect !== undefined || explanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? explanation.multiTestAllCorrect === true
    : explanation.isPredictionCorrect === true;

  // Create brief summary from pattern description (first 80 chars)
  const briefSummary = explanation.patternDescription
    ? (explanation.patternDescription.length > 80
      ? explanation.patternDescription.substring(0, 80) + '...'
      : explanation.patternDescription)
    : 'No pattern description available';

  return (
    <Card className="border-2 border-red-200 bg-red-50/30 overflow-visible">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-2 bg-red-100/50">
          <CardTitle className="flex items-center gap-2 text-sm flex-wrap">
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
            {(hasMultiTest ? explanation.multiTestAllCorrect : explanation.isPredictionCorrect) === false && (
              <Badge variant="destructive" className="text-xs">
                Incorrect
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
          <CardContent className="p-2 overflow-x-auto">
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
