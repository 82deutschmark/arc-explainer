/**
 * ModelDebate.tsx - REFACTORED
 *
 * Author: Claude Code using Sonnet 4.5 (Updated 2025-12-02)
 * Date: 2025-09-29 (Layout optimized: 2025-12-02)
 * PURPOSE: Clean orchestration-only component for Model Debate page. Manages debate state,
 * streaming analysis, and challenge generation. Uses container layout with proper spacing
 * to eliminate excessive white space while maintaining readability.
 * Single responsibility: Component coordination and routing only.
 * SRP/DRY check: Pass - Pure orchestration, delegates all concerns to focused components
 * shadcn/ui: Pass - Uses shadcn/ui components throughout focused child components
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { AnalysisResult, ExplanationData } from '@/types/puzzle';
import { useParams, Link, useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Focused components
import { PuzzleDebateHeader } from '@/components/puzzle/debate/PuzzleDebateHeader';
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
  const [location] = useLocation();
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);

  // Parse ?select=123 query parameter for auto-selection
  const selectId = useMemo(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const id = params.get('select');
    return id ? parseInt(id, 10) : null;
  }, [location]);

  // Page title management
  useEffect(() => {
    document.title = taskId ? `Model Debate - Puzzle ${taskId}` : 'Model Debate';
  }, [taskId]);

  // Data hooks
  // Use `task` directly (derived from query response) instead of `currentTask` (state via useEffect)
  // to avoid race condition where isLoadingTask=false but currentTask is still null
  const { task, isLoadingTask, taskError } = usePuzzle(taskId);
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
    setTemperature,
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
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    topP,
    setTopP,
    candidateCount,
    setCandidateCount,
    thinkingBudget,
    setThinkingBudget
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

  // Close streaming modal handler
  const closeStreamingModal = () => {
    if (streamingPanelStatus !== 'in_progress') {
      cancelStreamingAnalysis();
    }
  };


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

  // Auto-start debate when ?select= parameter is present
  // FIX: Inlined startDebate call directly to avoid closure issues (same fix as PuzzleDiscussion)
  useEffect(() => {
    if (!selectId || !explanations || explanations.length === 0 || isLoadingExplanations || debateState.isDebateActive || isAutoSelecting) {
      return;
    }

    console.log(`[ModelDebate] 🔍 Auto-select initiating for ID ${selectId}...`);
    setIsAutoSelecting(true);

    const explanation = explanations.find(e => e.id === selectId);
    if (explanation) {
      console.log(`[ModelDebate] ✅ Found explanation #${selectId}`);
      console.log(`[ModelDebate] Model: ${explanation.modelName}`);

      debateState.startDebate(explanation);
      setIsAutoSelecting(false);
      toast({
        title: "Debate loaded",
        description: `Starting debate for explanation #${selectId}`,
      });
    } else {
      console.error(`[ModelDebate] ❌ Explanation #${selectId} not found`);
      console.error(`[ModelDebate] Available IDs: ${explanations.map(e => e.id).join(', ')}`);
      setIsAutoSelecting(false);
      toast({
        title: "Explanation not found",
        description: `Could not find explanation #${selectId}. It may have been deleted.`,
        variant: "destructive"
      });
    }
  // NOTE: toast and debateState.startDebate intentionally omitted - they're stable references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectId, explanations, isLoadingExplanations, debateState.isDebateActive, isAutoSelecting]);

  // Loading states
  if (isLoadingTask || isLoadingExplanations || isAutoSelecting) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>{isAutoSelecting ? `Loading explanation #${selectId}...` : 'Loading puzzle and explanations...'}</span>
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="w-full max-w-6xl mx-auto px-4 space-y-3 pb-6">
        <PuzzleDebateHeader taskId={taskId} />

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
                task={task}
                challengerModel={debateState.challengerModel}
                customChallenge={debateState.customChallenge}
                processingModels={processingModels}
                analyzerErrors={analyzerErrors}
                temperature={temperature}
                onTemperatureChange={setTemperature}
                topP={topP}
                onTopPChange={setTopP}
                candidateCount={candidateCount}
                onCandidateCountChange={setCandidateCount}
                thinkingBudget={thinkingBudget}
                onThinkingBudgetChange={setThinkingBudget}
                reasoningEffort={(reasoningEffort || 'medium') as 'minimal' | 'low' | 'medium' | 'high'}
                onReasoningEffortChange={setReasoningEffort}
                reasoningVerbosity={(reasoningVerbosity || 'medium') as 'low' | 'medium' | 'high'}
                onReasoningVerbosityChange={setReasoningVerbosity}
                reasoningSummaryType={(reasoningSummaryType === 'auto' ? 'auto' : 'detailed') as 'auto' | 'detailed'}
                onReasoningSummaryTypeChange={(value) => {
                  // Convert component types to hook types
                  if (value === 'detailed' || value === 'auto') {
                    setReasoningSummaryType(value as 'auto' | 'detailed');
                  } else {
                    setReasoningSummaryType('detailed'); // Fallback to detailed for unsupported values
                  }
                }}
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

      {/* Streaming Modal Dialog - Same pattern as PuzzleExaminer */}
      <Dialog open={isStreamingActive} onOpenChange={closeStreamingModal}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Challenge'}`}
            </DialogTitle>
          </DialogHeader>
          <StreamingAnalysisPanel
            title={`${streamingModel?.name ?? streamingModelKey ?? 'Challenge'}`}
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
            onClose={closeStreamingModal}
            task={task}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
