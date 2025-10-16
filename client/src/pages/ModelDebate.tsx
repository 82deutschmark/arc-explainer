/**
 * ModelDebate.tsx - REFACTORED
 *
 * Author: Claude Code using Sonnet 4 (Updated by Cascade using Sonnet 4 on 2025-10-04)
 * Date: 2025-09-29 (Layout update: 2025-10-04)
 * PURPOSE: Clean orchestration-only component for Model Debate page (< 100 lines).
 * Single responsibility: Component coordination and routing only.
 * LAYOUT: Removed container margins and max-width constraints for full-width explanation cards
 * SRP/DRY check: Pass - Pure orchestration, delegates all concerns to focused components
 * shadcn/ui: Pass - Uses shadcn/ui components throughout focused child components
 */

import React, { useEffect, useState } from 'react';
import type { AnalysisResult, ExplanationData } from '@/types/puzzle';
import { useParams, Link } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Focused components
import { PuzzleDebateHeader } from '@/components/puzzle/debate/PuzzleDebateHeader';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';
import { ExplanationsList } from '@/components/puzzle/debate/ExplanationsList';
import { StreamingAnalysisPanel } from '@/components/puzzle/StreamingAnalysisPanel';
import { IndividualDebate } from '@/components/puzzle/debate/IndividualDebate';

import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';
import { useDebateState } from '@/hooks/debate/useDebateState';

export default function ModelDebate() {
  const { taskId } = useParams<{ taskId?: string }>();
  const { toast } = useToast();
  const [showPromptPreview, setShowPromptPreview] = useState(false);

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

  // Get the selected explanation for debate context
  const selectedExplanation = explanations?.find(e => e.id === debateState.selectedExplanationId);

  // Analysis hook for challenge generation
  const {
    analyzeAndSaveMutation,
    processingModels,
    analyzerErrors,
    promptId,
    setPromptId,
    temperature,
    streamingEnabled,
    streamingModelKey,
    streamStatus,
    streamingText,
    streamingReasoning,
    streamingStructuredJsonText,
    streamingStructuredJson,
    streamingPhase,
    streamingMessage,
    streamingTokenUsage,
    streamError,
    cancelStreamingAnalysis,
    canStreamModel,
    startStreamingAnalysis,
    isGPT5ReasoningModel,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
    topP,
    candidateCount,
    thinkingBudget
  } = useAnalysisResults({
    taskId: taskId || '',
    refetchExplanations,
    omitAnswer: true,  // CRITICAL: Debate mode is SOLVER behavior - models should NOT see correct answers
    originalExplanation: selectedExplanation,
    customChallenge: debateState.customChallenge,
    previousResponseId: debateState.getLastResponseId(debateState.challengerModel), // Provider-aware chaining
    models,
  });

  const isStreamingActive = streamingModelKey !== null;
  const streamingState =
    streamStatus && typeof streamStatus === 'object' && 'state' in streamStatus
      ? (streamStatus as { state: string }).state || 'idle'
      : 'idle';
  const streamingModel = streamingModelKey ? models?.find(model => model.key === streamingModelKey) || null : null;
  const streamingPanelStatus: 'idle' | 'starting' | 'in_progress' | 'completed' | 'failed' = (() => {
    switch (streamingState) {
      case 'requested':
      case 'starting':
        return 'starting';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  })();
  const [pendingStream, setPendingStream] = useState<{ modelKey: string; baseline: string | null } | null>(null);


  // Set promptId to 'debate' when debate mode is active
  useEffect(() => {
    if (debateState.isDebateActive && selectedExplanation) {
      setPromptId('debate');
    } else {
      setPromptId('solver'); // Reset to default when not in debate
    }
  }, [debateState.isDebateActive, selectedExplanation, setPromptId]);

  // Challenge generation handler
  const handleGenerateChallenge = async () => {
    if (!debateState.challengerModel || !debateState.selectedExplanationId || !taskId) return;
    if (!selectedExplanation) return;

    try {
      setPromptId('debate');

      const challengerModelKey = debateState.challengerModel;
      const modelConfig = models?.find(model => model.key === challengerModelKey);
      const supportsTemperature = modelConfig?.supportsTemperature ?? true;
      const canStream = streamingEnabled && canStreamModel(challengerModelKey);

      if (canStream) {
        const baseline = explanations
          .filter(exp => exp.modelName === challengerModelKey)
          .reduce<string | null>((acc, exp) => {
            if (!acc) return exp.createdAt;
            return new Date(exp.createdAt) > new Date(acc) ? exp.createdAt : acc;
          }, null);
        setPendingStream({ modelKey: challengerModelKey, baseline });
        startStreamingAnalysis(challengerModelKey, supportsTemperature);
        toast({
          title: 'Streaming challenge started',
          description: `${modelConfig?.name ?? challengerModelKey} is streaming a new rebuttal.`,
        });
        return;
      }

      const lastResponseId = debateState.getLastResponseId(challengerModelKey);
      const lastMessage = debateState.debateMessages[debateState.debateMessages.length - 1];
      const lastProvider = lastMessage ? debateState.extractProvider(lastMessage.modelName) : 'none';
      const challengerProvider = debateState.extractProvider(challengerModelKey);

      const payload: any = {
        modelKey: challengerModelKey,
        temperature,
        topP,
        candidateCount,
        thinkingBudget,
        ...(isGPT5ReasoningModel(challengerModelKey) ? {
          reasoningEffort,
          reasoningVerbosity,
          reasoningSummaryType
        } : {})
      };

      if (lastResponseId) {
        console.log(`[Debate Chaining] Continuing ${challengerProvider} conversation with response ID: ${lastResponseId}`);
      } else if (lastProvider !== challengerProvider && lastProvider !== 'none') {
        console.log(`[Debate Chaining] Cross-provider debate detected (${lastProvider} -> ${challengerProvider}). Starting new conversation chain (no context).`);
      } else {
        console.log('[Debate Chaining] Starting new conversation (no previous response ID)');
      }

      const savedData = await analyzeAndSaveMutation.mutateAsync(payload);

      await refetchExplanations();

      const newExplanationData = savedData?.explanations?.[challengerModelKey];

      if (newExplanationData) {
        debateState.addChallengeMessage(newExplanationData);

        toast({
          title: "Challenge Generated!",
          description: `${modelConfig?.name || challengerModelKey} has responded to the challenge.`,
        });
      } else {
        throw new Error("Failed to retrieve challenge response");
      }

      debateState.setCustomChallenge('');
    } catch (error) {
      console.error('Challenge generation error:', error);
      toast({
        title: "Challenge Failed",
        description: error instanceof Error ? error.message : "Failed to generate challenge. Please try again.",
        variant: "destructive",
      });
    }
  };
  useEffect(() => {
    if (!pendingStream) {
      return;
    }
    if (isStreamingActive) {
      return;
    }
    const { modelKey, baseline } = pendingStream;
    const latest = explanations
      .filter(exp => exp.modelName === modelKey)
      .reduce((acc: ExplanationData | null, exp) => {
        if (!acc) return exp;
        return new Date(exp.createdAt) > new Date(acc.createdAt) ? exp : acc;
      }, null as ExplanationData | null);
    if (!latest) {
      return;
    }
    if (baseline && new Date(latest.createdAt) <= new Date(baseline)) {
      return;
    }
    debateState.addChallengeMessage(latest);
    toast({
      title: "Challenge Generated!",
      description: `${models?.find(m => m.key === modelKey)?.name || modelKey} has responded to the challenge.`,
    });
    debateState.setCustomChallenge('');
    setPendingStream(null);
  }, [pendingStream, isStreamingActive, explanations, debateState, models, toast]);

  useEffect(() => {
    if (!pendingStream) {
      return;
    }
    if (streamingPanelStatus !== 'failed') {
      return;
    }
    toast({
      title: 'Streaming failed',
      description: streamError?.message ?? 'The streaming request failed.',
      variant: 'destructive',
    });
    setPendingStream(null);
  }, [pendingStream, streamingPanelStatus, streamError, toast]);

  // Loading states
  if (isLoadingTask || isLoadingExplanations) {
    return (
      <div className="w-full">
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
      <div className="w-full">
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
    <div className="w-full space-y-1">
      <PuzzleDebateHeader taskId={taskId} />

      <CompactPuzzleDisplay
        trainExamples={task!.train}
        testCases={task!.test}
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
            <>
              {isStreamingActive && debateState.challengerModel && (
                <div className="mb-4">
                  <StreamingAnalysisPanel
                    title={`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Challenge'}`}
                    status={streamingPanelStatus}
                    phase={typeof streamingPhase === 'string' ? streamingPhase : undefined}
                    message={
                      streamingPanelStatus === 'failed'
                        ? streamError?.message ?? streamingMessage ?? 'Streaming failed'
                        : streamingMessage
                    }
                    text={streamingText}
                    structuredJsonText={streamingStructuredJsonText}
                    structuredJson={streamingStructuredJson}
                    reasoning={streamingReasoning}
                    tokenUsage={streamingTokenUsage}
                    onCancel={streamingPanelStatus === 'in_progress' ? () => { cancelStreamingAnalysis(); setPendingStream(null); } : undefined}
                  />
                </div>
              )}
              <IndividualDebate
                originalExplanation={selectedExplanation}
                debateMessages={debateState.debateMessages}
                taskId={taskId}
                testCases={task!.test}
                models={models}
                task={task}
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
            </>
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
