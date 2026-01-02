/**
 * Author: gpt-5-codex
 * Date: 2025-10-31
 * Updated: 2025-12-25 - Added BYOK support for production environment
 * PURPOSE: Coordinates the Puzzle Examiner page layout, orchestrating data fetching, controls, and result surfaces.
 * SRP/DRY check: Pass - verified the page keeps orchestration concerns separated from child components that render UI.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'wouter';
import { Loader2, ChevronDown, Brain } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';
import { requiresUserApiKey } from '@/lib/environmentPolicy';

// Independent data fetching hooks (progressive loading for better UX)
import { useModels } from '@/hooks/useModels';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePaginatedExplanationSummaries, useExplanationById, fetchExplanationById } from '@/hooks/useExplanation';
import { useQueryClient } from '@tanstack/react-query';

// Analysis orchestration hook
import { useAnalysisResults } from '@/hooks/useAnalysisResults';

// UI Components (SRP-compliant)
import { PuzzleHeader } from '@/components/puzzle/PuzzleHeader';
import { ModelSelection } from '@/components/puzzle/ModelSelection';
import { AnalysisResults } from '@/components/puzzle/AnalysisResults';
import { StreamingAnalysisPanel } from '@/components/puzzle/StreamingAnalysisPanel';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import { PuzzleGridDisplay } from '@/components/puzzle/PuzzleGridDisplay';
import { PromptConfiguration } from '@/components/puzzle/PromptConfiguration';
import { AdvancedControls } from '@/components/puzzle/AdvancedControls';

// shadcn/ui Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Types
import type { CorrectnessFilter } from '@/hooks/useFilteredResults';

const PROVIDER_PREVIEW_DEFAULT = 'openai';

function getPreviewProvider(providerName?: string): string {
  return PROVIDER_PREVIEW_DEFAULT;
}

export default function PuzzleExaminer() {
  const { taskId } = useParams<{ taskId: string }>();

  // Check if we're in retry mode (coming from discussion page)
  const isRetryMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('retry') === 'true') {
      return true;
    }

    if (!document.referrer) {
      return false;
    }

    try {
      const referrerUrl = new URL(document.referrer);
      return (
        referrerUrl.origin === window.location.origin &&
        referrerUrl.pathname.startsWith('/discussion')
      );
    } catch {
      return false;
    }
  }, []);

  // Local UI state
  const [showEmojis, setShowEmojis] = useState(false);
  const [showColorOnly, setShowColorOnly] = useState(false);
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [sendAsEmojis, setSendAsEmojis] = useState(false);
  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{ modelKey: string; supportsTemperature: boolean } | null>(null);
  const [omitAnswer, setOmitAnswer] = useState(true);
  const [correctnessFilter, setCorrectnessFilter] = useState<CorrectnessFilter>('all');
  const [highlightedExplanationId, setHighlightedExplanationId] = useState<number | null>(null);
  // BYOK: API key state for production environment
  const [userApiKey, setUserApiKey] = useState('');
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [pendingModelForApiKey, setPendingModelForApiKey] = useState<{ modelKey: string; supportsTemperature: boolean } | null>(null);
  const [isModelSelectorExpanded, setIsModelSelectorExpanded] = useState(() => {
    // Default to COLLAPSED - users want to see results first
    const saved = localStorage.getItem('puzzleExaminer.modelSelector.expanded');
    return saved ? JSON.parse(saved) : false;
  });

  // Persist model selector state
  React.useEffect(() => {
    localStorage.setItem('puzzleExaminer.modelSelector.expanded', JSON.stringify(isModelSelectorExpanded));
  }, [isModelSelectorExpanded]);

  // Set page title with puzzle ID
  React.useEffect(() => {
    const puzzleName = getPuzzleName(taskId);
    const title = puzzleName ? `${taskId} - ${puzzleName}` : `ARC Puzzle ${taskId}`;
    document.title = taskId ? title : 'ARC Puzzle Examiner';
  }, [taskId]);

  // Emoji view overrides color-only mode
  React.useEffect(() => {
    if (showEmojis && showColorOnly) {
      setShowColorOnly(false);
    }
  }, [showEmojis, showColorOnly]);

  // Early return if no taskId
  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert variant="destructive">
          <AlertDescription>Invalid puzzle ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  // PERFORMANCE FIX: Independent queries with progressive rendering
  // Load models (cached for 1 hour)
  const { data: models, isLoading: isLoadingModels } = useModels();

  // Load puzzle immediately (don't wait for anything else)
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId ?? undefined);

  const queryClient = useQueryClient();

  // Load explanation summaries in background (don't block puzzle display)
  const {
    summaries,
    counts,
    total,
    filteredTotal,
    hasMore: hasMoreSummaries,
    fetchNextPage,
    isInitialLoading: isLoadingSummaries,
    isFetchingNextPage,
    isFetching: isFetchingSummaries,
    refetch: refetchSummaries
  } = usePaginatedExplanationSummaries(taskId || null, {
    pageSize: 12,
    correctness: correctnessFilter
  });

  // Only block initial render if puzzle is still loading
  const isLoading = isLoadingTask;

  // Analysis orchestration hook
  const {
    temperature,
    setTemperature,
    promptId,
    setPromptId,
    customPrompt,
    setCustomPrompt,
    analyzeWithModel,
    currentModelKey,
    processingModels,
    isAnalyzing,
    analyzerErrors,
    streamingEnabled,
    streamingModelKey,
    streamStatus,
    streamingText,
    streamingReasoning,
    streamingStructuredJsonText,
    streamingStructuredJson,
    streamingPhase,
    streamingMessage,
    streamingPhaseHistory,
    streamingTokenUsage,
    streamingPromptPreview,
    streamError,
    cancelStreamingAnalysis,
    closeStreamingModal,
    canStreamModel,
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
    includeGridImages,
    setIncludeGridImages,
  } = useAnalysisResults({
    taskId,
    refetchExplanations: refetchSummaries,
    emojiSetKey: sendAsEmojis ? emojiSet : undefined,
    omitAnswer,
    retryMode: isRetryMode,
    models,
    // BYOK: Pass user API key if provided (required in production)
    apiKey: userApiKey.trim() || undefined,
  });

  // Sort explanations by date (newest first)
  const allResults = useMemo(() => {
    const sorted = [...summaries];
    return sorted.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [summaries]);

  const highlightMissingFromSummaries = useMemo(
    () => highlightedExplanationId !== null && !summaries.some(result => result.id === highlightedExplanationId),
    [highlightedExplanationId, summaries]
  );

  const { data: highlightedExplanationData } = useExplanationById(
    highlightMissingFromSummaries ? highlightedExplanationId : null,
    { enabled: highlightMissingFromSummaries }
  );

  const loadFullExplanation = useCallback(
    async (explanationId: number) => {
      const data = await queryClient.fetchQuery({
        queryKey: ['explanation-by-id', explanationId],
        queryFn: () => fetchExplanationById(explanationId)
      });

      return data;
    },
    [queryClient]
  );

  // Handle highlight query parameter for deep linking
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightParam = params.get('highlight');
    const parsedHighlight = highlightParam ? Number.parseInt(highlightParam, 10) : NaN;

    if (Number.isFinite(parsedHighlight)) {
      setHighlightedExplanationId(parsedHighlight);
    } else {
      setHighlightedExplanationId(null);
    }

    if (Number.isFinite(parsedHighlight)) {
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`explanation-${parsedHighlight}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50');
          }, 3000);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [summaries, highlightedExplanationData]);

  // Streaming state calculations
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

  const currentModel = currentModelKey ? models?.find(model => model.key === currentModelKey) ?? null : null;

  // Handle model selection - intercept if API key needed but missing
  const handleAnalyzeWithModel = (modelKey: string) => {
    console.log('[PuzzleExaminer] handleAnalyzeWithModel called with:', modelKey);
    const model = models?.find(m => m.key === modelKey);
    console.log('[PuzzleExaminer] Found model:', model?.name);
    
    // Check if API key is required but missing (and not the "test" bypass)
    if (requiresUserApiKey() && !userApiKey.trim()) {
      console.log('[PuzzleExaminer] API key required but missing, showing dialog');
      setPendingModelForApiKey({
        modelKey,
        supportsTemperature: model?.supportsTemperature ?? true,
      });
      setIsApiKeyDialogOpen(true);
      return;
    }
    
    console.log('[PuzzleExaminer] Setting pendingAnalysis and opening modal');
    setPendingAnalysis({
      modelKey,
      supportsTemperature: model?.supportsTemperature ?? true,
    });
    setIsPromptPreviewOpen(true);
    console.log('[PuzzleExaminer] Modal should now be open');
  };
  
  // Handle API key dialog submission
  const handleApiKeySubmit = () => {
    if (!userApiKey.trim() || !pendingModelForApiKey) return;
    
    setIsApiKeyDialogOpen(false);
    // Now proceed with the original flow
    setPendingAnalysis(pendingModelForApiKey);
    setIsPromptPreviewOpen(true);
    setPendingModelForApiKey(null);
  };
  
  const handleApiKeyDialogClose = () => {
    setIsApiKeyDialogOpen(false);
    setPendingModelForApiKey(null);
  };

  const handleConfirmAnalysis = async () => {
    if (!pendingAnalysis) {
      return;
    }
    analyzeWithModel(pendingAnalysis.modelKey, pendingAnalysis.supportsTemperature);
    setPendingAnalysis(null);
    setIsPromptPreviewOpen(false);
  };

  const handleClosePromptPreview = () => {
    setPendingAnalysis(null);
    setIsPromptPreviewOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (taskError || (!isLoadingTask && !task)) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert variant="destructive">
          <AlertDescription>Failed to load puzzle: {taskError?.message || 'Puzzle not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // TypeScript guard: task is guaranteed non-null after error check above
  if (!task) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Header Component */}
      <PuzzleHeader
        taskId={taskId}
        source={task.source}
        isRetryMode={isRetryMode}
        showEmojis={showEmojis}
        onToggleEmojis={() => setShowEmojis(!showEmojis)}
        showColorOnly={showColorOnly}
        onToggleColorOnly={() => setShowColorOnly(!showColorOnly)}
        isColorOnlyDisabled={showEmojis}
        emojiSet={emojiSet}
        onEmojiSetChange={setEmojiSet}
        isAnalyzing={isAnalyzing}
      />

      {/* Main Content Area - Full Width */}
      <div className="px-2">
        {/* Puzzle Examples Section – restored compact card layout */}
        <div className="mb-4">
          <PuzzleGridDisplay
            task={task}
            showEmojis={showEmojis}
            showColorOnly={showColorOnly}
            emojiSet={emojiSet}
          />
        </div>

        {/* BYOK: API Key Input - Only shown in production */}
        {requiresUserApiKey() && (
          <Card className="mb-4 border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-sm text-amber-900">API Key Required</CardTitle>
                  <CardDescription className="text-xs mt-1 text-amber-700">
                    Production requires your API key. Your key is used for this session only and is never stored.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs uppercase tracking-wide border-amber-300 text-amber-700">
                  BYOK
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="api-key" className="sr-only">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your OpenAI/Anthropic/OpenRouter API key..."
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    className="font-mono text-sm"
                    disabled={isAnalyzing}
                  />
                </div>
                {userApiKey.trim() && (
                  <span className="text-xs text-green-600 font-medium">Key provided</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-sm">Prompt Style</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Select the template, tweak emoji options, and preview the compiled instructions.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs uppercase tracking-wide">
                  Prompt
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="gap-3 flex flex-col">
              <PromptConfiguration
                promptId={promptId}
                onPromptChange={setPromptId}
                customPrompt={customPrompt}
                onCustomPromptChange={setCustomPrompt}
                disabled={isAnalyzing}
                sendAsEmojis={sendAsEmojis}
                onSendAsEmojisChange={setSendAsEmojis}
                omitAnswer={omitAnswer}
                onOmitAnswerChange={setOmitAnswer}
                onPreviewClick={() => {
                  setPendingAnalysis(null);
                  setIsPromptPreviewOpen(true);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-sm">Advanced Controls</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Fine-tune sampling, candidate fan-out, and reasoning depth without leaving the page.
                  </CardDescription>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">GPT-5 | Gemini</span>
              </div>
            </CardHeader>
            <CardContent className="gap-3 flex flex-col">
              <AdvancedControls
                temperature={temperature}
                onTemperatureChange={setTemperature}
                topP={topP}
                onTopPChange={setTopP}
                candidateCount={candidateCount}
                onCandidateCountChange={setCandidateCount}
                thinkingBudget={thinkingBudget}
                onThinkingBudgetChange={setThinkingBudget}
                reasoningEffort={reasoningEffort}
                onReasoningEffortChange={setReasoningEffort}
                reasoningVerbosity={reasoningVerbosity}
                onReasoningVerbosityChange={setReasoningVerbosity}
                reasoningSummaryType={reasoningSummaryType}
                onReasoningSummaryTypeChange={setReasoningSummaryType}
                includeGridImages={includeGridImages}
                onIncludeGridImagesChange={(value: boolean) => setIncludeGridImages(value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Model Selection - Collapsible to save vertical space */}
        <div className="bg-background mb-4 rounded-lg border border-border">
          {/* Compact Header - Always Visible */}
          <button
            onClick={() => setIsModelSelectorExpanded(!isModelSelectorExpanded)}
            className="w-full p-3 flex items-center justify-between hover:bg-muted transition-colors rounded-lg"
          >
            <h3 className="font-semibold text-base">Models</h3>
            <div className="flex items-center gap-2">
              {isAnalyzing && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Running analysis...
                </span>
              )}
              <ChevronDown className={`h-5 w-5 transition-transform ${isModelSelectorExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Expanded Content */}
          {isModelSelectorExpanded && (
            <div className="p-4 pt-2 border-t border-base-300">
              <ModelSelection
                models={models}
                processingModels={processingModels}
                streamingModelKey={streamingModelKey}
                streamingEnabled={streamingEnabled}
                canStreamModel={canStreamModel}
                explanations={allResults}
                onAnalyze={handleAnalyzeWithModel}
                analyzerErrors={analyzerErrors}
              />
            </div>
          )}
        </div>

        {/* Human Insights Banner - Above Analysis Results */}
        <a
          href={`https://arc-visualizations.github.io/${taskId}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300/60 hover:border-amber-400 hover:bg-gradient-to-r hover:from-amber-100 hover:to-orange-100 rounded-lg transition-all duration-300 group"
          title="View human test participant explanations and error examples for this puzzle"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-700 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-amber-900">💡 Human Insights</span>
            </div>
            <span className="text-sm text-amber-700 group-hover:text-amber-900 font-medium">
              See how humans solved this puzzle →
            </span>
          </div>
        </a>

        {/* Analysis Results (PERFORMANCE-OPTIMIZED with progressive loading) */}
        {(allResults.length > 0 || isAnalyzing || isLoadingSummaries || highlightedExplanationData) && (
          <AnalysisResults
            results={allResults}
            counts={counts}
            filteredTotal={filteredTotal}
            correctnessFilter={correctnessFilter}
            onFilterChange={setCorrectnessFilter}
            models={models}
            task={task}
            isAnalyzing={isAnalyzing}
            currentModel={currentModel}
            highlightedExplanationId={highlightedExplanationId}
            highlightedExplanation={highlightedExplanationData ?? null}
            hasMore={hasMoreSummaries}
            onLoadMore={() => { void fetchNextPage(); }}
            isLoadingInitial={isLoadingSummaries}
            isFetchingMore={isFetchingNextPage}
            isFetching={isFetchingSummaries}
            loadFullResult={loadFullExplanation}
          />
        )}

        {/* Loading skeleton for explanations (progressive loading UX) */}
        {isLoadingSummaries && allResults.length === 0 && !isAnalyzing && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading previous analyses...</span>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Streaming Modal Dialog */}
      <Dialog open={isStreamingActive} onOpenChange={closeStreamingModal}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}
            </DialogTitle>
          </DialogHeader>
          <StreamingAnalysisPanel
            title={`${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}
            status={streamingPanelStatus}
            phase={typeof streamingPhase === 'string' ? streamingPhase : undefined}
            message={
              streamingPanelStatus === 'failed'
                ? streamError?.message ?? streamingMessage ?? 'Streaming failed'
                : streamingMessage
            }
            phaseHistory={streamingPhaseHistory}
            text={streamingText}
            structuredJsonText={streamingStructuredJsonText}
            structuredJson={streamingStructuredJson}
            reasoning={streamingReasoning}
            tokenUsage={streamingTokenUsage}
            onCancel={streamingPanelStatus === 'in_progress' ? cancelStreamingAnalysis : undefined}
            onClose={closeStreamingModal}
            task={task}
            promptPreview={streamingPromptPreview}
          />
        </DialogContent>
      </Dialog>

      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={isPromptPreviewOpen}
        onClose={handleClosePromptPreview}
        task={task}
        taskId={taskId}
        promptId={promptId}
        customPrompt={customPrompt}
        options={{
          emojiSetKey: emojiSet,
          omitAnswer,
          sendAsEmojis
        }}
        confirmMode={pendingAnalysis !== null}
        onConfirm={pendingAnalysis ? handleConfirmAnalysis : undefined}
        confirmButtonText="Confirm & Send Analysis"
      />

      {/* API Key Required Dialog - Shows when user tries to analyze without key in production */}
      <Dialog open={isApiKeyDialogOpen} onOpenChange={(open) => !open && handleApiKeyDialogClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-900">API Key Required</DialogTitle>
            <DialogDescription className="text-amber-700">
              Production mode requires your own API key to run analysis. Your key is used for this request only and is never stored on our servers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-api-key">Your API Key</Label>
              <Input
                id="dialog-api-key"
                type="password"
                placeholder="sk-... or AIza... (OpenAI/Anthropic/OpenRouter/Gemini)"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userApiKey.trim()) {
                    handleApiKeySubmit();
                  }
                }}
                className="font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Get keys from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI</a>,{' '}
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline">Anthropic</a>,{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">OpenRouter</a>, or{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleApiKeyDialogClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleApiKeySubmit} 
              disabled={!userApiKey.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue to Analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
