/**
 * RefinementThread.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Main component for displaying progressive refinement thread.
 * Shows original analysis followed by linear progression of refinement iterations.
 * Replaces IndividualDebate with refinement-focused UI and terminology.
 * Single responsibility: Manage refinement thread display and coordination.
 * SRP/DRY check: Pass - Single responsibility (thread coordination), reuses OriginalExplanationCard and delegates to IterationCard
 * shadcn/ui: Pass - Uses shadcn/ui Card, Badge, Button, Alert components
 */

import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, ArrowLeft, Sparkles, TrendingUp } from 'lucide-react';

// Reuse existing components
import { OriginalExplanationCard } from '@/components/puzzle/debate/OriginalExplanationCard';
import { IterationCard } from './IterationCard';
import { RefinementControls } from './RefinementControls';

// Types
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface RefinementIteration {
  id: string;
  iterationNumber: number;
  content: ExplanationData;
  timestamp: string;
}

interface RefinementThreadProps {
  // Core data
  originalExplanation: ExplanationData;
  iterations: RefinementIteration[];
  taskId: string;
  testCases: ARCExample[];
  models?: ModelConfig[];

  // State
  activeModel: string;
  userGuidance: string;
  isProcessing: boolean;
  error?: Error | null;

  // Actions
  onBackToList: () => void;
  onResetRefinement: () => void;
  onUserGuidanceChange: (guidance: string) => void;
  onContinueRefinement: () => void;
}

export const RefinementThread: React.FC<RefinementThreadProps> = ({
  originalExplanation,
  iterations,
  taskId,
  testCases,
  models,
  activeModel,
  userGuidance,
  isProcessing,
  error,
  onBackToList,
  onResetRefinement,
  onUserGuidanceChange,
  onContinueRefinement
}) => {
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest iteration when thread updates
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [iterations.length]);

  // Get original iteration (iteration 0)
  const originalIteration = iterations.find(iter => iter.iterationNumber === 0);

  // Get refinement iterations (iteration > 0)
  const refinementIterations = iterations.filter(iter => iter.iterationNumber > 0);

  // Calculate total reasoning tokens across all iterations
  const totalReasoningTokens = iterations.reduce(
    (sum, iter) => sum + (iter.content.reasoningTokens || 0),
    0
  );

  // Get model display name
  const modelDisplayName = models?.find(m => m.key === activeModel)?.name || activeModel;

  // Determine if original was correct
  const hasMultiTest = originalExplanation.hasMultiplePredictions &&
    (originalExplanation.multiTestAllCorrect !== undefined || originalExplanation.multiTestAverageAccuracy !== undefined);

  const isOriginalCorrect = hasMultiTest
    ? originalExplanation.multiTestAllCorrect === true
    : originalExplanation.isPredictionCorrect === true;

  return (
    <div className="space-y-3">
      {/* Refinement Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Progressive Reasoning: {modelDisplayName}
                  {!isOriginalCorrect && (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                      Refining Solution
                    </Badge>
                  )}
                  {isOriginalCorrect && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      ✓ Correct (Exploring Alternatives)
                    </Badge>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  Model refines its own analysis through iterative reasoning
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={onBackToList}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </div>

          {/* Progress indicator */}
          {refinementIterations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-purple-200">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-900">
                  {refinementIterations.length} iteration{refinementIterations.length !== 1 ? 's' : ''} completed
                </span>
                {totalReasoningTokens > 0 && (
                  <>
                    <span className="text-gray-400">•</span>
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-900 font-medium">
                      {totalReasoningTokens.toLocaleString()} reasoning tokens preserved
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responsive grid layout - thread gets more space */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        {/* Refinement Thread - takes 3/4 width on xl screens, full width on smaller */}
        <div className="xl:col-span-3 space-y-3">
          {/* Thread Header Card */}
          <Card className="border-purple-200">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-purple-600" />
                Reasoning Evolution
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-800">
                  {iterations.length} stage{iterations.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Thread content - flows naturally with page scroll */}
          <div className="space-y-3">
            {/* Original Analysis */}
            {originalIteration && (
              <OriginalExplanationCard
                explanation={originalIteration.content}
                models={models}
                testCases={testCases}
                timestamp={originalIteration.timestamp}
              />
            )}

            {/* Refinement Iterations */}
            {refinementIterations.map((iteration, index) => {
              // Calculate cumulative reasoning tokens up to this point
              const cumulativeReasoningTokens = iterations
                .slice(0, iterations.indexOf(iteration) + 1)
                .reduce((sum, iter) => sum + (iter.content.reasoningTokens || 0), 0);

              return (
                <IterationCard
                  key={iteration.id}
                  explanation={iteration.content}
                  models={models}
                  testCases={testCases}
                  timestamp={iteration.timestamp}
                  iterationNumber={iteration.iterationNumber}
                  cumulativeReasoningTokens={cumulativeReasoningTokens}
                />
              );
            })}

            {/* Anchor for auto-scroll to bottom */}
            <div ref={threadEndRef} />
          </div>
        </div>

        {/* Refinement Controls - 1/4 width sidebar on xl screens */}
        <div>
          <RefinementControls
            activeModel={activeModel}
            modelDisplayName={modelDisplayName}
            userGuidance={userGuidance}
            onUserGuidanceChange={onUserGuidanceChange}
            currentIteration={iterations.length - 1}
            isProcessing={isProcessing}
            error={error}
            totalReasoningTokens={totalReasoningTokens}
            onContinueRefinement={onContinueRefinement}
            onReset={onResetRefinement}
            onBackToList={onBackToList}
          />
        </div>
      </div>
    </div>
  );
};
