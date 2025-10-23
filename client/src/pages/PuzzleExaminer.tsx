/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: PuzzleExaminer orchestrates ARC puzzle inspection by coordinating data hooks,
 *          model execution workflows, and modal UIs. Restores the legacy DaisyUI streaming
 *          dialog and card-based model selection grid after recent regressions introduced a
 *          data-table layout and shadcn modal wrapper.
 * SRP/DRY check: Pass — delegates fetching, controls, and result rendering to dedicated
 *                components while handling orchestration only (verified via regression
 *                comparison against 2025-10-12 card layout commit).
 * DaisyUI: Pass — ensures modal + card primitives rely on DaisyUI components per repository
 *                 conventions.
 */

import React, { useState, useMemo } from 'react';
import { useParams } from 'wouter';
import { Loader2, Grid3X3 } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';

// Independent data fetching hooks (progressive loading for better UX)
import { useModels } from '@/hooks/useModels';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';

// Analysis orchestration hook
import { useAnalysisResults } from '@/hooks/useAnalysisResults';

// UI Components (SRP-compliant)
import { PuzzleHeader } from '@/components/puzzle/PuzzleHeader';
import { CompactControls } from '@/components/puzzle/CompactControls';
import { ModelSelection } from '@/components/puzzle/ModelSelection';
import { AnalysisResults } from '@/components/puzzle/AnalysisResults';
import { StreamingAnalysisPanel } from '@/components/puzzle/StreamingAnalysisPanel';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import { TrainingPairGallery } from '@/components/puzzle/examples/TrainingPairGallery';
import { TestCaseGallery } from '@/components/puzzle/testcases/TestCaseGallery';

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
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [sendAsEmojis, setSendAsEmojis] = useState(false);
  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{ modelKey: string; supportsTemperature: boolean } | null>(null);
  const [omitAnswer, setOmitAnswer] = useState(true);
  const [correctnessFilter, setCorrectnessFilter] = useState<CorrectnessFilter>('all');

  // Set page title with puzzle ID
  React.useEffect(() => {
    const puzzleName = getPuzzleName(taskId);
    const title = puzzleName ? `${taskId} - ${puzzleName}` : `ARC Puzzle ${taskId}`;
    document.title = taskId ? title : 'ARC Puzzle Examiner';
  }, [taskId]);

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

  // Load explanations in background (don't block puzzle display)
  const {
    explanations,
    isLoading: isLoadingExplanations,
    refetchExplanations
  } = usePuzzleWithExplanation(taskId || null);

  // Only block initial render if puzzle is still loading
  const isLoading = isLoadingTask;

  // Handle highlight query parameter for deep linking
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlight');

    if (highlightId) {
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`explanation-${highlightId}`);
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
  }, [explanations]);

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
    refetchExplanations,
    emojiSetKey: sendAsEmojis ? emojiSet : undefined,
    omitAnswer,
    retryMode: isRetryMode,
    models,
  });

  // Sort explanations by date (newest first)
  const allResults = useMemo(() => {
    return explanations.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [explanations]);

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
        emojiSet={emojiSet}
        onEmojiSetChange={setEmojiSet}
        isAnalyzing={isAnalyzing}
      />

      {/* Main Content Area - Full Width */}
      <div className="px-2">
        {/* Puzzle Examples Section – custom sculpted container highlighting training + tests */}
        <div className="mb-4">
          <section className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-white via-amber-50/80 to-rose-50/60 shadow-[0_24px_48px_-28px_rgba(244,114,182,0.55)]">
            <div className="absolute inset-y-0 right-0 w-36 bg-gradient-to-br from-transparent via-rose-100/40 to-amber-100/60 opacity-70" aria-hidden="true" />

            <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-amber-100/70 bg-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-amber-900">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-600 shadow-inner">
                  <Grid3X3 className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <h2 className="text-base font-semibold tracking-tight">Puzzle Pattern Overview</h2>
                  <p className="text-xs font-medium text-amber-700/80">
                    {task.train.length} training · {task.test.length} test grids
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                {task.train.length + task.test.length} total grids
              </span>
            </header>

            <div className="space-y-10 px-6 py-7">
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-blue-600">
                    Training Examples
                  </span>
                  <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/70 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                    {task.train.length} {task.train.length === 1 ? 'example' : 'examples'}
                  </span>
                </div>
                <TrainingPairGallery
                  trainExamples={task.train}
                  showHeader={false}
                />
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">
                    Test Inputs & Outputs
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    {task.test.length} {task.test.length === 1 ? 'test' : 'tests'}
                  </span>
                </div>
                <TestCaseGallery
                  testCases={task.test}
                  showHeader={false}
                  showEmojis={showEmojis}
                />
              </section>
            </div>
          </section>
        </div>

        {/* Compact Controls - Prompt & Advanced Parameters */}
        <div className="mb-2">
          <CompactControls
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

        {/* Model Selection - Card Grid */}
        <div className="bg-base-100 p-2 mb-2">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
            🚀 Model Selection
            <span className="text-xs opacity-60">Choose AI models to run analysis with</span>
          </h3>
          <ModelSelection
            models={models}
            processingModels={processingModels}
            streamingModelKey={streamingModelKey}
            streamingEnabled={streamingEnabled}
            canStreamModel={canStreamModel}
            explanations={explanations}
            onAnalyze={handleAnalyzeWithModel}
            analyzerErrors={analyzerErrors}
          />
        </div>

        {/* Analysis Results (PERFORMANCE-OPTIMIZED with progressive loading) */}
        {(allResults.length > 0 || isAnalyzing || isLoadingExplanations) && (
          <AnalysisResults
            allResults={allResults}
            correctnessFilter={correctnessFilter}
            onFilterChange={setCorrectnessFilter}
            models={models}
            task={task}
            isAnalyzing={isAnalyzing}
            currentModel={currentModel}
          />
        )}

        {/* Loading skeleton for explanations (progressive loading UX) */}
        {isLoadingExplanations && allResults.length === 0 && !isAnalyzing && (
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
              closeStreamingModal();
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
