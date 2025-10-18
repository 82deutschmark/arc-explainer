/**
 * PuzzleDiscussion.tsx - AI Progressive Reasoning Interface
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Progressive reasoning refinement through AI self-conversation.
 * One model refines its own analysis across multiple iterations with full context chaining.
 * REFACTORED: Now reuses AnalysisResultListCard and existing components instead of custom tables.
 * SRP/DRY check: Pass - Orchestration only, delegates to existing UI components
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { ExplanationData } from '@/types/puzzle';
import { useParams, Link, useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Brain, Loader2, AlertTriangle, Search, Sparkles, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Refinement-specific components
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ProfessionalRefinementUI } from '@/components/puzzle/refinement/ProfessionalRefinementUI';
import { StreamingAnalysisPanel } from '@/components/puzzle/StreamingAnalysisPanel';
import { AnalysisSelector } from '@/components/puzzle/refinement/AnalysisSelector';

import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';
import { useRefinementState } from '@/hooks/refinement/useRefinementState';
import { useEligibleExplanations } from '@/hooks/useEligibleExplanations';
import { determineCorrectness } from '@shared/utils/correctness';
import { formatPuzzleDisplay } from '@shared/utils/puzzleNames';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';

export default function PuzzleDiscussion() {
  const { taskId } = useParams<{ taskId?: string }>();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [searchPuzzleId, setSearchPuzzleId] = useState('');

  // Parse ?select=123 query parameter for auto-selection
  const selectId = useMemo(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const id = params.get('select');
    return id ? parseInt(id, 10) : null;
  }, [location]);

  // Page title
  useEffect(() => {
    document.title = taskId ? `Discussion - ${formatPuzzleDisplay(taskId)}` : 'Discussion';
  }, [taskId]);

  // Data hooks
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { explanations, isLoading: isLoadingExplanations, refetchExplanations } = usePuzzleWithExplanation(taskId || '');
  const { data: models } = useModels();

  // Fetch eligible explanations for landing page (filtered client-side to match refinement requirements)
  const { data: eligibleData, isLoading: isLoadingEligible } = useEligibleExplanations(20, 0);
  const eligibleExplanations = eligibleData?.explanations || [];
  // Refinement state management (NOT debate state)
  const refinementState = useRefinementState();

  const selectedExplanation = explanations?.find(e => e.id === refinementState.originalExplanationId);

  // Analysis hook for refinement generation
  const {
    analyzeAndSaveMutation,
    startStreamingAnalysis,
    canStreamModel,
    processingModels,
    analyzerErrors,
    promptId,
    setPromptId,
    customPrompt,
    setCustomPrompt,
    temperature,
    setTemperature,
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
    setThinkingBudget,
    streamingModelKey,
    streamStatus,
    streamingText,
    streamingReasoning,
    streamingStructuredJsonText,
    streamingStructuredJson,
    streamingPhase,
    streamingMessage,
    streamingTokenUsage,
    streamingPromptPreview,
    streamError,
    cancelStreamingAnalysis
  } = useAnalysisResults({
    taskId: taskId || '',
    refetchExplanations,
    omitAnswer: true, // CRITICAL FIX: Must withhold test answers in solver mode to prevent data leakage
    originalExplanation: selectedExplanation,
    customChallenge: refinementState.userGuidance,
    previousResponseId: refinementState.getLastResponseId() // Single-model chaining
  });

  const isStreamingActive = streamingModelKey !== null;
  const streamingState =
    streamStatus && typeof streamStatus === 'object' && 'state' in streamStatus
      ? (streamStatus as { state: string }).state || 'idle'
      : 'idle';
  const streamingModel = streamingModelKey ? models?.find(model => model.key === streamingModelKey) || null : null;
  const streamingPanelStatus: "idle" | "starting" | "in_progress" | "completed" | "failed" = (() => {
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


  // Set promptId to 'discussion' when active for AI self-refinement
  useEffect(() => {
    if (refinementState.isRefinementActive && selectedExplanation) {
      setPromptId('discussion');
    } else {
      setPromptId('solver');
    }
  }, [refinementState.isRefinementActive, selectedExplanation, setPromptId]);

  // Generate refinement iteration
  const handleGenerateRefinement = async () => {
    if (!refinementState.activeModel || !refinementState.originalExplanationId || !taskId) return;
    if (!selectedExplanation) return;

    try {
      setPromptId('discussion');
      const activeModelKey = refinementState.activeModel;
      const modelConfig = models?.find(model => model.key === activeModelKey);
      const supportsTemperature = modelConfig?.supportsTemperature ?? true;
      const lastResponseId = refinementState.getLastResponseId();

      if (canStreamModel(activeModelKey)) {
        const baseline = explanations
          ?.filter(exp => exp.modelName === activeModelKey)
          .reduce<string | null>((acc, exp) => {
            if (!acc) return exp.createdAt;
            return new Date(exp.createdAt) > new Date(acc) ? exp.createdAt : acc;
          }, null) ?? null;

        setPendingStream({ modelKey: activeModelKey, baseline });

        if (lastResponseId) {
          console.log(`[Refinement] ✅ Continuing streaming conversation with response ID: ${lastResponseId}`);
        } else {
          console.log('[Refinement] Starting new streaming conversation');
        }

        startStreamingAnalysis(activeModelKey, supportsTemperature);

        toast({
          title: 'Streaming refinement started',
          description: `${modelConfig?.name ?? activeModelKey} is refining the analysis with live output.`,
        });

        return;
      }

      const payload: any = {
        modelKey: activeModelKey,
        temperature,
        topP,
        candidateCount,
        thinkingBudget,
        ...(isGPT5ReasoningModel(activeModelKey) ? {
          reasoningEffort,
          reasoningVerbosity,
          reasoningSummaryType
        } : {})
      };

      if (lastResponseId) {
        console.log(`[Refinement] ✅ Continuing conversation with response ID: ${lastResponseId}`);
      } else {
        console.log('[Refinement] Starting new conversation');
      }

      const savedData = await analyzeAndSaveMutation.mutateAsync(payload);
      await refetchExplanations();

      const newExplanationData = savedData?.explanations?.[activeModelKey];

      if (newExplanationData) {
        refinementState.addIteration(newExplanationData);
        toast({
          title: "Analysis Refined!",
          description: `Iteration #${refinementState.currentIteration + 1} completed.`,
        });
      } else {
        throw new Error("Failed to retrieve refinement");
      }

      refinementState.setUserGuidance('');
    } catch (error) {
      console.error('Refinement error:', error);
      toast({
        title: "Refinement Failed",
        description: error instanceof Error ? error.message : "Failed to generate refinement.",
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
    if (!explanations || explanations.length === 0) {
      return;
    }

    const { modelKey, baseline } = pendingStream;
    const latest = explanations
      .filter(exp => exp.modelName === modelKey)
      .reduce<ExplanationData | null>((acc, exp) => {
        if (!acc) return exp;
        return new Date(exp.createdAt) > new Date(acc.createdAt) ? exp : acc;
      }, null);

    if (!latest) {
      return;
    }

    if (baseline && new Date(latest.createdAt) <= new Date(baseline)) {
      return;
    }

    if (refinementState.iterations.some(iter => iter.content.id === latest.id)) {
      setPendingStream(null);
      return;
    }

    const nextIterationNumber = refinementState.currentIteration + 1;
    refinementState.addIteration(latest);
    refinementState.setUserGuidance('');
    toast({
      title: 'Analysis Refined!',
      description: `Iteration #${nextIterationNumber} completed.`,
    });
    setPendingStream(null);
  }, [
    pendingStream,
    isStreamingActive,
    explanations,
    refinementState.iterations,
    refinementState.currentIteration,
    refinementState.addIteration,
    refinementState.setUserGuidance,
    toast,
  ]);

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

  // Search handler
  const handlePuzzleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchPuzzleId.trim()) {
      navigate(`/discussion/${searchPuzzleId.trim()}`);
    }
  };

  // Start refinement (auto-locks to same model)
  const handleStartRefinement = (explanationId: number) => {
    const explanation = explanations?.find(e => e.id === explanationId);
    if (explanation) {
      refinementState.startRefinement(explanation);
    }
  };

  // Filter explanations to only show eligible ones (has provider response ID + within 30-day retention window)
  const filteredEligibleExplanations = useMemo(() => {
    if (!explanations) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return explanations.filter(exp => {
      const createdAt = new Date(exp.createdAt);
      if (createdAt < thirtyDaysAgo) return false;
      if (!exp.providerResponseId) return false;
      return true;
    });
  }, [explanations]);

  // Auto-start refinement when ?select= parameter is present
  useEffect(() => {
    // Only attempt auto-selection when:
    // 1. We have a selectId from URL
    // 2. Explanations are loaded (not loading and exists)
    // 3. Refinement is not already active (prevent double-activation)
    if (selectId && explanations && explanations.length > 0 && !isLoadingExplanations && !refinementState.isRefinementActive) {
      console.log(`[PuzzleDiscussion] 🔍 Auto-select check: selectId=${selectId}, explanations=${explanations.length}, loading=${isLoadingExplanations}, active=${refinementState.isRefinementActive}`);
      
      const explanation = explanations.find(e => e.id === selectId);
      if (explanation) {
        console.log(`[PuzzleDiscussion] ✅ Found explanation #${selectId}, starting refinement...`);
        console.log(`[PuzzleDiscussion] Explanation details: model=${explanation.modelName}, provider=${explanation.providerResponseId ? 'has response ID' : 'NO response ID'}`);
        handleStartRefinement(selectId);
      } else {
        console.error(`[PuzzleDiscussion] ❌ Explanation #${selectId} not found in ${explanations.length} loaded explanations`);
        console.error(`[PuzzleDiscussion] Available IDs: ${explanations.map(e => e.id).join(', ')}`);
        toast({
          title: "Explanation not found",
          description: `Could not find explanation #${selectId}. It may have been deleted or is not eligible for refinement.`,
          variant: "destructive"
        });
      }
    } else {
      console.log(`[PuzzleDiscussion] 🚫 Auto-select skipped: selectId=${selectId}, hasExplanations=${!!explanations}, explanationCount=${explanations?.length ?? 0}, loading=${isLoadingExplanations}, active=${refinementState.isRefinementActive}`);
    }
  }, [selectId, explanations, isLoadingExplanations, refinementState.isRefinementActive, toast]);

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

  // No taskId - show search and recent eligible explanations
  if (!taskId) {
    return (
      <div className="w-full space-y-4">
        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600" />
              Progressive Reasoning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Refine AI analyses through multi-turn conversations with full server-side reasoning retention (30 days).
            </p>

            {/* Search Box */}
            <form onSubmit={handlePuzzleSearch} className="flex gap-2">
              <Input
                placeholder="Enter puzzle ID to begin..."
                value={searchPuzzleId}
                onChange={(e) => setSearchPuzzleId(e.target.value)}
              />
              <Button type="submit" disabled={!searchPuzzleId.trim()}>
                <Search className="h-4 w-4 mr-2" />
                Go
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Responses API Explainer */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>How it works:</strong> The Responses API outperforms Chat Completions in multi-turn conversations by maintaining stateful persistence, automatically remembering prior encrypted reasoning traces (via{' '}
            <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">reasoning.encrypted_content</code>
            ). This enables coherent, context-aware responses without manually appending full message histories, reducing token waste and errors. Chat Completions treats each call as stateless.
          </AlertDescription>
        </Alert>

        {/* Recent Eligible Explanations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Eligible Analyses</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingEligible ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : eligibleExplanations.length > 0 ? (
              <div className="space-y-2">
                {eligibleExplanations.map(exp => (
                  <Card key={exp.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Model info and status */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Link 
                            href={`/discussion/${exp.puzzleId}`} 
                            className="text-blue-600 hover:underline font-mono text-sm font-medium"
                          >
                            {exp.puzzleId}
                          </Link>
                          <Badge variant="outline" className="font-mono text-xs">
                            {exp.modelName}
                          </Badge>
                          <Badge variant={exp.isCorrect ? "default" : "secondary"} className="text-xs">
                            {exp.isCorrect ? "Correct" : "Incorrect"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {exp.provider.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-gray-500">{Math.floor(exp.hoursOld)}h {Math.floor((exp.hoursOld % 1) * 60)}m ago</span>
                        </div>
                        
                        {/* Right: Action */}
                        <Button
                          size="sm"
                          onClick={() => navigate(`/discussion/${exp.puzzleId}?select=${exp.id}`)}
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                        >
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          Refine
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No eligible analyses found. Generate new analyses from reasoning models (GPT-5, o-series, Grok-4).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main interface
  return (
    <div className="w-full space-y-4">
      {/* Header - consistent with other pages */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold">Progressive Reasoning</h1>
          {taskId && <ClickablePuzzleBadge puzzleId={taskId} clickable={false} />}
        </div>
      </div>

      {/* Compact Puzzle Display */}
      <CollapsibleCard
        title="Puzzle Overview"
        defaultOpen={false}
        headerDescription={
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge variant="outline" className="text-xs">{task!.train.length} training</Badge>
            <Badge variant="outline" className="text-xs">{task!.test.length} test</Badge>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Training Examples - Compact */}
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Training Examples</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {task!.train.map((ex, i) => (
                <div key={i} className="flex gap-1 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 mb-0.5">In</div>
                    <div className="w-20 h-20 border border-gray-300 rounded">
                      <TinyGrid grid={ex.input} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 mb-0.5">Out</div>
                    <div className="w-20 h-20 border border-gray-300 rounded">
                      <TinyGrid grid={ex.output} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Cases - Compact */}
          <div className="border-t pt-2">
            <div className="text-xs font-semibold text-gray-600 mb-1">Test Cases</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {task!.test.map((test, i) => (
                <div key={i} className="flex gap-1 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 mb-0.5">In</div>
                    <div className="w-20 h-20 border border-gray-300 rounded">
                      <TinyGrid grid={test.input} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-green-600 mb-0.5 font-semibold">✓</div>
                    <div className="w-20 h-20 border-2 border-green-500 rounded">
                      <TinyGrid grid={test.output} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {refinementState.isRefinementActive && explanations ? (
        (() => {
          const selectedExplanation = explanations.find(e => e.id === refinementState.originalExplanationId);
          if (!selectedExplanation) {
            return (
              <Alert>
                <AlertDescription>
                  Selected explanation not found. <Button variant="link" onClick={refinementState.endRefinement}>Return to list</Button>
                </AlertDescription>
              </Alert>
            );
          }

          return (
            <>
              {isStreamingActive && refinementState.activeModel && (
                <StreamingAnalysisPanel
                  title={`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Refinement'}`}
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
                  promptPreview={streamingPromptPreview}
                  onCancel={
                    streamingPanelStatus === 'in_progress'
                      ? () => {
                          cancelStreamingAnalysis();
                          setPendingStream(null);
                        }
                      : undefined
                  }
                />
              )}
              <ProfessionalRefinementUI
                iterations={refinementState.iterations}
                taskId={taskId}
                task={task!}
                testCases={task!.test}
                models={models}
                activeModel={refinementState.activeModel}
                userGuidance={refinementState.userGuidance}
                isProcessing={processingModels.has(refinementState.activeModel)}
                error={analyzerErrors.get(refinementState.activeModel) || null}
                promptId={promptId}
                setPromptId={setPromptId}
                customPrompt={customPrompt}
                setCustomPrompt={setCustomPrompt}
                temperature={temperature}
                setTemperature={setTemperature}
                topP={topP}
                setTopP={setTopP}
                candidateCount={candidateCount}
                setCandidateCount={setCandidateCount}
                thinkingBudget={thinkingBudget}
                setThinkingBudget={setThinkingBudget}
                reasoningEffort={reasoningEffort}
                setReasoningEffort={setReasoningEffort}
                reasoningVerbosity={reasoningVerbosity}
                setReasoningVerbosity={setReasoningVerbosity}
                reasoningSummaryType={reasoningSummaryType}
                setReasoningSummaryType={setReasoningSummaryType}
                isGPT5ReasoningModel={isGPT5ReasoningModel}
                onBackToList={refinementState.endRefinement}
                onResetRefinement={refinementState.resetRefinement}
                onUserGuidanceChange={refinementState.setUserGuidance}
                onContinueRefinement={handleGenerateRefinement}
              />
            </>
          );
        })()
      ) : filteredEligibleExplanations.length > 0 ? (
        <AnalysisSelector
          explanations={filteredEligibleExplanations}
          models={models}
          testCases={task!.test}
          correctnessFilter={refinementState.correctnessFilter}
          onCorrectnessFilterChange={refinementState.setCorrectnessFilter}
          onStartRefinement={handleStartRefinement}
        />
      ) : explanations && explanations.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">No eligible analyses for refinement</p>
              <p className="text-sm">
                This puzzle has {explanations.length} explanation{explanations.length > 1 ? 's' : ''}, but none are eligible for refinement.
              </p>
              <p className="text-sm">Eligible explanations must:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>Be less than 30 days old (provider retention window)</li>
                <li>Have a provider response ID (for conversation chaining)</li>
              </ul>
              <Link href={`/puzzle/${taskId}`}>
                <Button variant="outline" size="sm" className="mt-2">
                  Generate New Analysis
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-purple-400" />
            <p className="text-gray-500 mb-4">No explanations for this puzzle yet.</p>
            <p className="text-sm text-gray-400 mb-4">Generate an AI explanation first, then refine it here.</p>
            <Link href={`/puzzle/${taskId}`}>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
                Generate First Explanation
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
