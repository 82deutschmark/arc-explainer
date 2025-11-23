/**
 * Author: gpt-5-codex
 * Date: 2025-10-31
 * PURPOSE: Coordinates the Puzzle Examiner page layout, orchestrating data fetching, controls, and result surfaces.
 * SRP/DRY check: Pass - verified the page keeps orchestration concerns separated from child components that render UI.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'wouter';
import { Loader2 } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';

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

// Types
import type { CorrectnessFilter } from '@/hooks/useFilteredResults';

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
        <div role="alert" className="alert alert-error">
          <span>Invalid puzzle ID</span>
        </div>
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
  } = useAnalysisResults({
    taskId,
    refetchExplanations: refetchSummaries,
    emojiSetKey: sendAsEmojis ? emojiSet : undefined,
    omitAnswer,
    retryMode: isRetryMode,
    models,
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

  // Handle model selection
  const handleAnalyzeWithModel = (modelKey: string) => {
    const model = models?.find(m => m.key === modelKey);
    setPendingAnalysis({
      modelKey,
      supportsTemperature: model?.supportsTemperature ?? true,
    });
    setIsPromptPreviewOpen(true);
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
        <div role="alert" className="alert alert-error">
          <span>Failed to load puzzle: {taskError?.message || 'Puzzle not found'}</span>
        </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <section className="card card-compact bg-base-100 shadow-sm border border-base-200">
            <div className="card-body gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="card-title text-sm font-semibold">Prompt Style</h3>
                  <p className="text-xs text-base-content/70">
                    Select the template, tweak emoji options, and preview the compiled instructions.
                  </p>
                </div>
                <span className="badge badge-outline badge-xs uppercase tracking-wide">Prompt</span>
              </div>
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
            </div>
          </section>

          <section className="card card-compact bg-base-100 shadow-sm border border-base-200">
            <div className="card-body gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="card-title text-sm font-semibold">Advanced Controls</h3>
                  <p className="text-xs text-base-content/70">
                    Fine-tune sampling, candidate fan-out, and reasoning depth without leaving the page.
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-base-content/60">GPT-5 | Gemini</span>
              </div>
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
              />
            </div>
          </section>
        </div>

        {/* Model Selection - Organized by Provider */}
        <div className="bg-base-100 p-4 mb-4 rounded-lg max-w-4xl mx-auto">
          <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
            🚀 Model Selection
            <span className="text-sm opacity-60 font-normal">Choose AI models to run analysis with</span>
          </h3>
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

        {/* Analysis Results (PERFORMANCE-OPTIMIZED with progressive loading) */}
        {(allResults.length > 0 || isAnalyzing || isLoadingSummaries || highlightedExplanationData) && (
          <AnalysisResults
            results={allResults}
            counts={counts}
            total={total}
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
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm opacity-70">Loading previous analyses...</span>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-32 w-full"></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Streaming Modal Dialog (DaisyUI) */}
      <dialog className={`modal ${isStreamingActive ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <h3 className="font-bold text-lg mb-4">
            {`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}
          </h3>
          <StreamingAnalysisPanel
            title={`${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}
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
            onCancel={streamingPanelStatus === 'in_progress' ? cancelStreamingAnalysis : undefined}
            onClose={closeStreamingModal}
            task={task}
            promptPreview={streamingPromptPreview}
          />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            onClick={() => {
              if (streamingPanelStatus === 'in_progress') {
                cancelStreamingAnalysis();
              }
              if (streamingPanelStatus !== 'completed') {
                closeStreamingModal();
              }
            }}
          >
            close
          </button>
        </form>
      </dialog>

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
    </div>
  );
}
