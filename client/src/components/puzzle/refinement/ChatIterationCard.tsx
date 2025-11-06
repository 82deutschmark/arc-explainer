/**
 * ChatIterationCard.tsx
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Chat-style iteration display for progressive reasoning.
 * Compact, conversation-focused UI showing ONLY predicted grid + correctness.
 * Uses TinyGrid for compact grid display.
 * 
 * DESIGN PHILOSOPHY:
 * - Chat bubble style (like messaging app)
 * - Focus: Did it get the right answer? (✓/✗)
 * - Show predicted grid using TinyGrid
 * - Show confidence, brief pattern, reasoning tokens
 * - NO training examples, NO test inputs, NO verbose strategy
 * 
 * SRP/DRY check: Pass - Single responsibility (chat message display)
 * shadcn/ui: Pass - Uses shadcn/ui Card, Badge components
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Sparkles, Brain, TrendingUp } from 'lucide-react';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import type { ExplanationData } from '@/types/puzzle';

interface ChatIterationCardProps {
  explanation: ExplanationData;
  iterationNumber: number;
  timestamp: string;
  cumulativeReasoningTokens?: number;
  correctAnswerGrid?: number[][]; // For visual comparison
}

export const ChatIterationCard: React.FC<ChatIterationCardProps> = ({
  explanation,
  iterationNumber,
  timestamp,
  cumulativeReasoningTokens,
  correctAnswerGrid
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine correctness
  const hasMultiTest = explanation.hasMultiplePredictions;
  const isCorrect = hasMultiTest
    ? explanation.multiTestAllCorrect === true
    : explanation.isPredictionCorrect === true;

  // Get predicted grid - handle both single and multi-test predictions
  const predictedGrid = React.useMemo(() => {
    // First try single prediction
    if (explanation.predictedOutputGrid) {
      return Array.isArray(explanation.predictedOutputGrid)
        ? explanation.predictedOutputGrid
        : explanation.predictedOutputGrid;
    }

    // Then try multi-prediction (check for predictedOutput1 directly)
    // Don't rely on boolean flag which may be serialized as string/number from DB
    if ((explanation as any).predictedOutput1) {
      const grid = (explanation as any).predictedOutput1;
      return Array.isArray(grid) ? grid : [[0]];
    }

    // Fallback
    return [[0]];
  }, [explanation]);

  // Get confidence
  const confidence = explanation.confidence || 0;

  // Truncate pattern to 150 chars
  const patternSummary = explanation.patternDescription
    ? (explanation.patternDescription.length > 150
      ? explanation.patternDescription.substring(0, 150) + '...'
      : explanation.patternDescription)
    : 'No pattern description';

  // Color scheme based on correctness
  const borderColor = isCorrect ? 'border-green-500' : 'border-amber-500';
  const bgColor = isCorrect ? 'bg-green-50/50' : 'bg-amber-50/50';
  const headerBg = isCorrect ? 'bg-gradient-to-r from-green-100/80 to-emerald-100/80' : 'bg-gradient-to-r from-amber-100/80 to-orange-100/80';

  return (
    <Card className={`${borderColor} border-l-4 ${bgColor} overflow-visible`}>
      <CardHeader className={`p-3 ${headerBg}`}>
        <div className="flex items-start gap-3">
          {/* Correctness Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {isCorrect ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-amber-600" />
            )}
          </div>

          {/* Iteration Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs font-mono bg-white/80">
                Iteration #{iterationNumber}
              </Badge>
              <Badge 
                variant={isCorrect ? "default" : "secondary"} 
                className={`text-xs font-semibold ${isCorrect ? 'bg-green-600' : 'bg-amber-600 text-white'}`}
              >
                {isCorrect ? '✓ CORRECT' : '✗ Incorrect'}
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/80">
                {confidence}% confident
              </Badge>
              <span className="text-[10px] text-gray-500 ml-auto">
                {new Date(timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Pattern Summary - Always visible */}
            <p className="text-xs text-gray-700 italic line-clamp-2">
              {patternSummary}
            </p>

            {/* Reasoning Tokens */}
            {explanation.reasoningTokens && explanation.reasoningTokens > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-xs text-purple-700 font-medium">
                  {explanation.reasoningTokens.toLocaleString()} reasoning tokens
                </span>
                {cumulativeReasoningTokens && (
                  <span className="text-xs text-gray-500">
                    (Total: {cumulativeReasoningTokens.toLocaleString()})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Predicted Grid - Compact TinyGrid */}
          <div className="flex-shrink-0">
            <div className="text-[8px] text-gray-500 mb-0.5 text-center font-medium">
              PREDICTION
            </div>
            <div className="w-16 h-16 border-2 border-gray-300 rounded">
              <TinyGrid grid={predictedGrid} />
            </div>
          </div>

          {/* Correct Answer Grid (if provided and incorrect) */}
          {!isCorrect && correctAnswerGrid && (
            <div className="flex-shrink-0">
              <div className="text-[8px] text-gray-500 mb-0.5 text-center font-medium">
                CORRECT
              </div>
              <div className="w-16 h-16 border-2 border-green-500 rounded">
                <TinyGrid grid={correctAnswerGrid} />
              </div>
            </div>
          )}
        </div>

        {/* Expand/Collapse Toggle */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-6 text-xs justify-center hover:bg-white/50"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Less detail
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  More detail
                </>
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-3 p-3 bg-white/60 rounded-lg border border-gray-200 space-y-2">
              {/* Full Pattern Description */}
              {explanation.patternDescription && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Brain className="h-3 w-3 text-purple-600" />
                    <span className="text-xs font-semibold text-gray-700">Pattern Analysis</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {explanation.patternDescription}
                  </p>
                </div>
              )}

              {/* Strategy */}
              {explanation.solvingStrategy && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700">Strategy</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {explanation.solvingStrategy}
                  </p>
                </div>
              )}

              {/* Hints */}
              {explanation.hints && explanation.hints.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-gray-700 block mb-1">Hints</span>
                  <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                    {explanation.hints.map((hint, idx) => (
                      <li key={idx}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Token Usage */}
              <div className="pt-2 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Input:</span>
                    <span className="font-mono ml-1">{explanation.inputTokens || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Output:</span>
                    <span className="font-mono ml-1">{explanation.outputTokens || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total:</span>
                    <span className="font-mono ml-1">{explanation.totalTokens || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
};
