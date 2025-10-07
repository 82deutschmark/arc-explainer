/**
 * PuzzleDiscussion.tsx - AI Self-Conversation Interface
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Progressive reasoning refinement through AI self-conversation.
 * One model refines its own analysis across multiple turns with full context chaining.
 * Mirrors ModelDebate structure but auto-locks to single model conversing with itself.
 * SRP/DRY check: Pass - Reuses all ModelDebate components (IndividualDebate, ExplanationsList, etc.)
 * shadcn/ui: Pass - Uses shadcn/ui components via reused components
 */

import React, { useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Loader2, Sparkles, AlertTriangle, Brain, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Reuse ModelDebate components - same UI, same flow
import { PuzzleDebateHeader } from '@/components/puzzle/debate/PuzzleDebateHeader';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';
import { ExplanationsList } from '@/components/puzzle/debate/ExplanationsList';
import { IndividualDebate } from '@/components/puzzle/debate/IndividualDebate';

import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';
import { useDebateState } from '@/hooks/debate/useDebateState';

// Utility: Identify models that support server-side reasoning persistence
// OpenAI GPT-5, o-series (o3, o4, o4-mini) and xAI Grok-4 models support Responses API
const isReasoningModel = (modelName: string): boolean => {
  const normalizedModel = modelName.toLowerCase();
  // OpenAI GPT-5 models
  if (normalizedModel.includes('gpt-5')) {
    return true;
  }
  // OpenAI o-series models
  if (normalizedModel.includes('o3') || normalizedModel.includes('o4')) {
    return true;
  }
  // xAI Grok-4 models (NOT grok-3)
  if (normalizedModel.includes('grok-4')) {
    return true;
  }
  return false;
};

// Get human-readable provider name from model key
const getProviderName = (modelName: string): string => {
  const normalizedModel = modelName.toLowerCase();
  if (normalizedModel.includes('gpt') || normalizedModel.includes('o1') || normalizedModel.includes('o3') || normalizedModel.includes('o4')) {
    return 'OpenAI';
  }
  if (normalizedModel.includes('grok')) {
    return 'xAI';
  }
  return 'Unknown';
};

export default function PuzzleDiscussion() {
  const { taskId } = useParams<{ taskId?: string }>();
  const { toast } = useToast();

  // Page title
  useEffect(() => {
    document.title = taskId ? `AI Self-Conversation - Puzzle ${taskId}` : 'AI Self-Conversation';
  }, [taskId]);

  // Data hooks (same as ModelDebate)
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { explanations, isLoading: isLoadingExplanations, refetchExplanations } = usePuzzleWithExplanation(taskId || '');
  const { data: models } = useModels();

  // State management (reuse useDebateState)
  const debateState = useDebateState();

  const selectedExplanation = explanations?.find(e => e.id === debateState.selectedExplanationId);

  // Analysis hook for refinement generation (same as ModelDebate)
  const {
    analyzeAndSaveMutation,
    processingModels,
    analyzerErrors,
    promptId,
    setPromptId,
    temperature,
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
    omitAnswer: false,
    originalExplanation: selectedExplanation,
    customChallenge: debateState.customChallenge,
    previousResponseId: debateState.getLastResponseId(debateState.challengerModel)
  });

  // Set promptId when active (same as ModelDebate)
  useEffect(() => {
    if (debateState.isDebateActive && selectedExplanation) {
      setPromptId('debate');
    } else {
      setPromptId('solver');
    }
  }, [debateState.isDebateActive, selectedExplanation, setPromptId]);

  // Generate refinement (same logic as ModelDebate's handleGenerateChallenge)
  const handleGenerateRefinement = async () => {
    if (!debateState.challengerModel || !debateState.selectedExplanationId || !taskId) return;
    if (!selectedExplanation) return;

    try {
      setPromptId('debate');
      const lastResponseId = debateState.getLastResponseId(debateState.challengerModel);

      const lastMessage = debateState.debateMessages[debateState.debateMessages.length - 1];
      const lastProvider = lastMessage ? debateState.extractProvider(lastMessage.modelName) : 'none';
      const challengerProvider = debateState.extractProvider(debateState.challengerModel);

      const payload: any = {
        modelKey: debateState.challengerModel,
        temperature,
        topP,
        candidateCount,
        thinkingBudget,
        ...(isGPT5ReasoningModel(debateState.challengerModel) ? {
          reasoningEffort,
          reasoningVerbosity,
          reasoningSummaryType
        } : {})
      };

      if (lastResponseId) {
        console.log(`[Self-Conversation] ✅ Continuing ${challengerProvider} conversation with response ID: ${lastResponseId}`);
      } else {
        console.log('[Self-Conversation] Starting new conversation');
      }

      const savedData = await analyzeAndSaveMutation.mutateAsync(payload);
      await refetchExplanations();

      const newExplanationData = savedData?.explanations?.[debateState.challengerModel];

      if (newExplanationData) {
        debateState.addChallengeMessage(newExplanationData);
        toast({
          title: "Analysis Refined!",
          description: `${models?.find(m => m.key === debateState.challengerModel)?.name || debateState.challengerModel} has refined its analysis.`,
        });
      } else {
        throw new Error("Failed to retrieve refinement");
      }

      debateState.setCustomChallenge('');
    } catch (error) {
      console.error('Refinement error:', error);
      toast({
        title: "Refinement Failed",
        description: error instanceof Error ? error.message : "Failed to generate refinement.",
        variant: "destructive",
      });
    }
  };

  // KEY DIFFERENCE: Auto-lock challenger to same model
  const handleStartConversation = (explanationId: number) => {
    const explanation = explanations?.find(e => e.id === explanationId);
    if (explanation) {
      debateState.startDebate(explanation);
      // AUTO-LOCK: Same model refines itself
      debateState.setChallengerModel(explanation.modelName);
    }
  };

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

  // No taskId - show instructions
  if (!taskId) {
    return (
      <div className="w-full space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600" />
              Progressive Reasoning with Full Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Primary Feature Callout */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-6">
                <h3 className="font-bold text-purple-900 mb-3 text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Server-Side Reasoning Persistence
                </h3>
                <div className="space-y-3 text-sm text-purple-800">
                  <p className="font-semibold">
                    This is NOT just self-conversation - it's progressive reasoning with full memory!
                  </p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Turn 1:</strong> Model generates 45,000 reasoning tokens → stored on provider's servers</li>
                    <li><strong>Turn 2:</strong> Provider retrieves ALL 45k tokens → model refines based on complete reasoning</li>
                    <li><strong>Turn 3:</strong> Provider retrieves ALL previous reasoning → progressive depth building</li>
                  </ul>
                  <div className="bg-white/70 rounded p-3 mt-3">
                    <p className="font-semibold text-purple-900">Why this matters:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>No token cost for re-sending reasoning (saved on provider servers)</li>
                      <li>No context limit issues (server-side storage)</li>
                      <li>30-day encrypted retention (OpenAI/xAI)</li>
                      <li>True progressive reasoning depth</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Provider Requirements */}
              <Alert className="bg-amber-50 border-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Provider Requirement:</strong> Only works with OpenAI GPT-5, o-series (o3, o4, o4-mini)
                  and xAI Grok-4 models. Other models won't have reasoning persistence.
                </AlertDescription>
              </Alert>

              {/* How it Works */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">How Reasoning Persistence Works:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                  <li>Generate initial analysis - reasoning tokens stored on provider servers</li>
                  <li>Click "Refine Analysis" - provider retrieves ALL previous reasoning</li>
                  <li>Model refines based on complete reasoning history</li>
                  <li>Each turn builds deeper reasoning chains</li>
                  <li>No token cost for retrieving previous reasoning</li>
                </ol>
                <p className="text-xs text-blue-700 mt-3">
                  <strong>Technical:</strong> Uses Responses API <code className="bg-blue-100 px-1 rounded">previous_response_id</code> parameter
                  to maintain server-side conversation state with encrypted reasoning storage.
                </p>
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground mb-3">Enter a puzzle ID to begin:</p>
                <PuzzleDebateHeader />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main interface (same structure as ModelDebate)
  return (
    <div className="w-full space-y-1">
      <PuzzleDebateHeader taskId={taskId} />

      <CompactPuzzleDisplay
        trainExamples={task!.train}
        testCases={task!.test}
      />

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

          // Calculate total reasoning tokens from all messages
          const totalReasoningTokens = debateState.debateMessages.reduce(
            (sum, msg) => sum + (msg.content.reasoningTokens || 0),
            0
          );

          // Get provider name from challenger model
          const provider = getProviderName(debateState.challengerModel);

          return (
            <>
              {/* Model Selection Warning for Non-Reasoning Models */}
              {selectedExplanation && !isReasoningModel(selectedExplanation.modelName) && (
                <Alert className="bg-amber-50 border-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    <strong>Limited Reasoning Persistence:</strong> This model ({selectedExplanation.modelName})
                    may not fully support server-side reasoning storage. For best results, use OpenAI GPT-5, o-series
                    (o3, o4, o4-mini) or xAI Grok-4 models.
                  </AlertDescription>
                </Alert>
              )}

              {/* Conversation Status Alert */}
              {debateState.debateMessages.length > 0 && (
                <Alert className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300">
                  <Link2 className="h-4 w-4 text-purple-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-semibold text-purple-900">
                        <Brain className="h-4 w-4 inline mr-1" />
                        Reasoning Chain Active: {debateState.debateMessages.length} turns
                      </div>
                      <p className="text-sm text-purple-800">
                        Model has access to {totalReasoningTokens > 0 ? `${totalReasoningTokens.toLocaleString()}+` : 'all'} reasoning tokens from previous turns.
                        All reasoning is retrieved automatically from {provider} servers.
                      </p>
                      <div className="flex gap-2 text-xs">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800">
                          {provider.toUpperCase()} Persisted
                        </Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          30-day retention
                        </Badge>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
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
                onGenerateChallenge={handleGenerateRefinement}
                challengeButtonText="Refine Analysis"
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
          onStartDebate={handleStartConversation}
          pageContext="discussion"
        />
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No explanations for this puzzle yet.</p>
            <p className="text-sm text-gray-400 mb-4">Generate an AI explanation first, then start a self-conversation.</p>
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
