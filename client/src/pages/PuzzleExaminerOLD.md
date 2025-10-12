/**NEEDS AUDIT!    In fact...  this seems really bloated and not DRY or SRP??
 * PuzzleExaminer.tsx
 *
 * @author Cascade using Claude Sonnet 4.5
 * @date 2025-10-11 3:58 PM
 * @description This is the main page component for examining a single ARC puzzle.
 * It orchestrates the fetching of puzzle data and existing explanations from the database.
 * NOW USES SHARED CORRECTNESS LOGIC to match AccuracyRepository (no more invented logic!)
 * The component is designed around a database-first architecture, ensuring that the UI
 * always reflects the stored state, making puzzle pages static and shareable.
 * ADDED: Deep linking support via ?highlight={explanationId} query parameter for direct links to specific explanations.
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { AnalysisResult } from '@/types/puzzle';
import { determineCorrectness } from '@shared/utils/correctness';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { StreamingAnalysisPanel } from '@/components/puzzle/StreamingAnalysisPanel';
import { Loader2, Eye, Hash, Brain, Rocket, RefreshCw, Grid3X3, Settings, Filter, CheckCircle, XCircle } from 'lucide-react';
import { EMOJI_SET_INFO, DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';

// Import our refactored components and hooks
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ModelButton } from '@/components/puzzle/ModelButton';
import { ModelProgressIndicator } from '@/components/puzzle/ModelProgressIndicator';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { PromptPicker } from '@/components/PromptPicker';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';
import { CollapsibleCard } from '@/components/ui/collapsible-card';

export default function PuzzleExaminer() {
  const { taskId } = useParams<{ taskId: string }>();
  
  // Check if we're in retry mode (coming from discussion page)
  const isRetryMode = window.location.search.includes('retry=true') || document.referrer.includes('/discussion');
  const [showEmojis, setShowEmojis] = useState(false); // Default to colors as requested - controls UI display
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [sendAsEmojis, setSendAsEmojis] = useState(false); // Controls what gets sent to AI models
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [omitAnswer, setOmitAnswer] = useState(true); // Cascade: researcher option to hide correct answer in prompt
  const [correctnessFilter, setCorrectnessFilter] = useState<'all' | 'correct' | 'incorrect'>('all'); // Filter for showing only correct/incorrect results
  // systemPromptMode is now hardcoded to 'ARC' - the new modular architecture replaces legacy {ARC}/{None} toggle

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

  // Fetch puzzle data
  const { data: models, isLoading: isLoadingModels, error: modelsError } = useModels();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { explanations, hasExplanation, refetchExplanations } = usePuzzleWithExplanation(taskId);

  // Handle highlight query parameter for deep linking
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlight');
    
    if (highlightId) {
      // Wait for DOM to render, then scroll to and highlight the explanation
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`explanation-${highlightId}`);
        if (element) {
          // Scroll to element with smooth behavior
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add highlight effect
          element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50');
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50');
          }, 3000);
        }
      }, 500); // Wait for explanations to load
      
      return () => clearTimeout(timeoutId);
    }
  }, [explanations]);

  // Use the custom hook for analysis results management
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
    streamingPhase,
    streamingMessage,
    streamingTokenUsage,
    streamError,
    cancelStreamingAnalysis,
    closeStreamingModal,
    canStreamModel,
    // GPT-5 reasoning parameters
    reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    isGPT5ReasoningModel,
    topP,
    setTopP,
    candidateCount,
    setCandidateCount,
    thinkingBudget,
    setThinkingBudget,
  } = useAnalysisResults({
    taskId,
    refetchExplanations,
    // Forward researcher options to backend
    emojiSetKey: sendAsEmojis ? emojiSet : undefined, // Only send emoji set if "Send as emojis" is enabled
    omitAnswer,
    retryMode: isRetryMode, // Enable retry mode if coming from discussion
    // systemPromptMode removed - now hardcoded to 'ARC' in the backend
    models,
  });
  
  // Find the current model's details if we're analyzing

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

  const currentModel = currentModelKey ? models?.find(model => model.key === currentModelKey) : null;

  // Use only saved explanations from database (no optimistic UI)
  const allResults = React.useMemo(() => {
    return explanations.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [explanations]);

  // Filter results based on correctness (use shared correctness logic!)
  const filteredResults = React.useMemo(() => {
    if (correctnessFilter === 'all') {
      return allResults;
    }

    return allResults.filter((result) => {
      const correctness = determineCorrectness({
        modelName: result.modelName,
        isPredictionCorrect: result.isPredictionCorrect,
        multiTestAllCorrect: result.multiTestAllCorrect,
        hasMultiplePredictions: result.hasMultiplePredictions
      });

      return correctnessFilter === 'correct' ? correctness.isCorrect : correctness.isIncorrect;
    });
  }, [allResults, correctnessFilter]);

  // Loading state
  if (isLoadingTask || isLoadingModels) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading tasks...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (taskError || !task || modelsError) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div role="alert" className="alert alert-error">
          <span>Failed to load puzzle: {taskError?.message || modelsError?.message || 'Puzzle not found'}</span>
        </div>
      </div>
    );
  }

  // Handle model selection
  const handleAnalyzeWithModel = (modelKey: string) => {
    const model = models?.find(m => m.key === modelKey);
    analyzeWithModel(modelKey, model?.supportsTemperature ?? true);
  };

  return (
    <div className="container mx-auto p-2 max-w-6xl space-y-2">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold">
            Puzzle {getPuzzleName(taskId) ? `${taskId} - ${getPuzzleName(taskId)}` : taskId}
            {task?.source && (
              <div className={`badge badge-outline ml-2 ${
                task.source === 'ARC1' ? 'bg-blue-50 text-blue-700' : 
                task.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700 font-semibold' : 
                task.source === 'ARC2' ? 'bg-purple-50 text-purple-700' : 
                task.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700 font-bold' :
                'bg-gray-50 text-gray-700'
              }`}>
                {task.source}
              </div>
            )}
            {isRetryMode && (
              <div className="badge badge-outline ml-2 bg-orange-50 text-orange-700 border-orange-200">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry Mode
              </div>
            )}
          </h1>
          <p className="text-sm text-gray-600">
            {isRetryMode ? "Enhanced Analysis - Previous attempt was incorrect" : "ARC Task Examiner"}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className={`btn btn-sm transition-all duration-300 ${
              showEmojis 
                ? 'animate-slow-pulse bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/25 border-2 border-purple-400/50 text-white' 
                : 'btn-outline animate-slow-pulse border-2 border-amber-400/50 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 shadow-lg shadow-amber-500/25'
            }`}
            onClick={() => setShowEmojis(!showEmojis)}
          >
            {showEmojis ? (
              <Hash className="h-4 w-4 mr-2 animate-slow-bounce text-white" />
            ) : (
              <Eye className="h-4 w-4 mr-2 animate-slow-bounce text-amber-600" />
            )}
            <span className={showEmojis ? 'text-white font-semibold' : 'text-amber-700 font-semibold'}>
              {showEmojis ? '🔢 Show Numbers' : '🛸 Show Emojis'}
            </span>
          </button>
          
          {/* Emoji Palette Selector */}
          {showEmojis && (
            <select
              className="select select-bordered select-sm w-40"
              value={emojiSet}
              onChange={(e) => setEmojiSet(e.target.value as EmojiSet)}
              disabled={isAnalyzing}
              title={EMOJI_SET_INFO[emojiSet]?.description}
            >
              <optgroup label="Emoji Palettes">
                {Object.entries(EMOJI_SET_INFO)
                  .map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          )}

          {/* Saturn Visual Solver Button */}
          <Link href={`/puzzle/saturn/${taskId}`}>
            <button
              className="btn btn-sm transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 border-2 border-indigo-400/50 text-white font-semibold"
            >
              <Rocket className="h-4 w-4 mr-2" />
              🪐 Saturn Solver
            </button>
          </Link>

          {/* Grover Iterative Solver Button */}
          <Link href={`/puzzle/grover/${taskId}`}>
            <button
              className="btn btn-sm transition-all duration-300 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg shadow-green-500/25 border-2 border-green-400/50 text-white font-semibold"
            >
              <Rocket className="h-4 w-4 mr-2" />
              🔄 Grover Solver
            </button>
          </Link>
        </div>
      </div>


      {/* Puzzle Overview - Tiered Responsive Layout System */}
      <div className="bg-white border border-gray-200 rounded p-2">
        <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          Puzzle Grids
          <span className="text-xs font-normal text-gray-500">
            ({task.train.length} train, {task.test.length} test)
          </span>
        </div>

        {/* TRAINING EXAMPLES - Stratified Layout */}
        <div className="mb-3">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
            Training
          </div>
          
          {(() => {
            // Pre-computation: Classify pairs into buckets based on dimensions
            const standardPairs: Array<{example: typeof task.train[0], idx: number}> = [];
            const widePairs: Array<{example: typeof task.train[0], idx: number}> = [];
            const tallPairs: Array<{example: typeof task.train[0], idx: number}> = [];
            
            task.train.forEach((example, idx) => {
              const inputRows = example.input.length;
              const inputCols = example.input[0]?.length || 0;
              const outputRows = example.output.length;
              const outputCols = example.output[0]?.length || 0;
              
              const maxHeight = Math.max(inputRows, outputRows);
              const combinedWidth = inputCols + outputCols;
              const maxDim = Math.max(inputRows, inputCols, outputRows, outputCols);
              
              // Classification logic
              if (maxHeight > 20) {
                tallPairs.push({ example, idx });
              } else if (combinedWidth > 40 || maxDim > 18) {
                widePairs.push({ example, idx });
              } else {
                standardPairs.push({ example, idx });
              }
            });
            
            return (
              <div className="space-y-2">
                {/* Standard Pairs: Flex wrap with align-items-start */}
                {standardPairs.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-start">
                    {standardPairs.map(({ example, idx }) => (
                      <div 
                        key={idx}
                        className="flex items-start gap-0.5 p-1 max-w-[400px]"
                      >
                        <PuzzleGrid 
                          grid={example.input}
                          title={`Training Example ${idx + 1} Input`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          compact={true}
                          maxWidth={180}
                          maxHeight={180}
                        />
                        <span className="text-xs text-gray-400 self-center">→</span>
                        <PuzzleGrid 
                          grid={example.output}
                          title={`Training Example ${idx + 1} Output`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          compact={true}
                          maxWidth={180}
                          maxHeight={180}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Wide Pairs: Full-width blocks */}
                {widePairs.length > 0 && (
                  <div className="space-y-1">
                    {widePairs.map(({ example, idx }) => (
                      <div 
                        key={idx}
                        className="flex items-start gap-0.5 p-1 w-full"
                      >
                        <PuzzleGrid 
                          grid={example.input}
                          title={`Training Example ${idx + 1} Input`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          compact={true}
                          maxWidth={300}
                          maxHeight={250}
                        />
                        <span className="text-xs text-gray-400 self-center">→</span>
                        <PuzzleGrid 
                          grid={example.output}
                          title={`Training Example ${idx + 1} Output`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          compact={true}
                          maxWidth={300}
                          maxHeight={250}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Tall Pairs: Horizontal scroll */}
                {tallPairs.length > 0 && (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <div className="flex gap-1" style={{ width: 'max-content' }}>
                      {tallPairs.map(({ example, idx }) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-0.5 p-1 flex-shrink-0"
                        >
                          <PuzzleGrid 
                            grid={example.input}
                            title={`Training Example ${idx + 1} Input`}
                            showEmojis={showEmojis}
                            emojiSet={emojiSet}
                            compact={true}
                            maxWidth={250}
                            maxHeight={400}
                          />
                          <span className="text-xs text-gray-400">→</span>
                          <PuzzleGrid 
                            grid={example.output}
                            title={`Training Example ${idx + 1} Output`}
                            showEmojis={showEmojis}
                            emojiSet={emojiSet}
                            compact={true}
                            maxWidth={250}
                            maxHeight={400}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* TEST CASES - Stratified Layout */}
        <div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
            Test
          </div>
          
          {(() => {
            // Pre-computation: Classify test pairs
            const standardPairs: Array<{testCase: typeof task.test[0], idx: number}> = [];
            const widePairs: Array<{testCase: typeof task.test[0], idx: number}> = [];
            const tallPairs: Array<{testCase: typeof task.test[0], idx: number}> = [];
            
            task.test.forEach((testCase, idx) => {
              const inputRows = testCase.input.length;
              const inputCols = testCase.input[0]?.length || 0;
              const outputRows = testCase.output.length;
              const outputCols = testCase.output[0]?.length || 0;
              
              const maxHeight = Math.max(inputRows, outputRows);
              const combinedWidth = inputCols + outputCols;
              const maxDim = Math.max(inputRows, inputCols, outputRows, outputCols);
              
              if (maxHeight > 20) {
                tallPairs.push({ testCase, idx });
              } else if (combinedWidth > 40 || maxDim > 18) {
                widePairs.push({ testCase, idx });
              } else {
                standardPairs.push({ testCase, idx });
              }
            });
            
            return (
              <div className="space-y-2">
                {/* Standard Test Pairs */}
                {standardPairs.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-start">
                    {standardPairs.map(({ testCase, idx }) => (
                      <div 
                        key={idx}
                        className="flex items-start gap-0.5 p-1 max-w-[400px]"
                      >
                        <PuzzleGrid 
                          grid={testCase.input}
                          title={`Test ${idx + 1} Input`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          compact={true}
                          maxWidth={180}
                          maxHeight={180}
                        />
                        <span className="text-xs text-gray-400 self-center">→</span>
                        <PuzzleGrid 
                          grid={testCase.output}
                          title={`Test ${idx + 1} Output`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          highlight={true}
                          compact={true}
                          maxWidth={180}
                          maxHeight={180}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Wide Test Pairs */}
                {widePairs.length > 0 && (
                  <div className="space-y-1">
                    {widePairs.map(({ testCase, idx }) => (
                      <div 
                        key={idx}
                        className="flex items-start gap-0.5 p-1 w-full"
                      >
                        <PuzzleGrid 
                          grid={testCase.input}
                          title={`Test ${idx + 1} Input`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          compact={true}
                          maxWidth={300}
                          maxHeight={250}
                        />
                        <span className="text-xs text-gray-400 self-center">→</span>
                        <PuzzleGrid 
                          grid={testCase.output}
                          title={`Test ${idx + 1} Output`}
                          showEmojis={showEmojis}
                          emojiSet={emojiSet}
                          highlight={true}
                          compact={true}
                          maxWidth={300}
                          maxHeight={250}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Tall Test Pairs */}
                {tallPairs.length > 0 && (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <div className="flex gap-1" style={{ width: 'max-content' }}>
                      {tallPairs.map(({ testCase, idx }) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-0.5 p-1 flex-shrink-0"
                        >
                          <PuzzleGrid 
                            grid={testCase.input}
                            title={`Test ${idx + 1} Input`}
                            showEmojis={showEmojis}
                            emojiSet={emojiSet}
                            compact={true}
                            maxWidth={250}
                            maxHeight={400}
                          />
                          <span className="text-xs text-gray-400">→</span>
                          <PuzzleGrid 
                            grid={testCase.output}
                            title={`Test ${idx + 1} Output`}
                            showEmojis={showEmojis}
                            emojiSet={emojiSet}
                            highlight={true}
                            compact={true}
                            maxWidth={250}
                            maxHeight={400}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Prompt Style */}
      <CollapsibleCard
        title="Prompt Style"
        icon={Brain}
        defaultOpen={false}
        headerDescription={
          <p className="text-sm text-gray-600">Configure how puzzles are presented to AI models</p>
        }
      >
        <PromptPicker
          selectedPromptId={promptId}
          onPromptChange={setPromptId}
          customPrompt={customPrompt}
          onCustomPromptChange={setCustomPrompt}
          disabled={isAnalyzing}
          sendAsEmojis={sendAsEmojis}
          onSendAsEmojisChange={setSendAsEmojis}
          omitAnswer={omitAnswer}
          onOmitAnswerChange={setOmitAnswer}
        />

        {/* Prompt Preview */}
        <div className="mb-3 flex justify-center">
          <button
            className="btn btn-outline btn-sm flex items-center gap-2"
            onClick={() => setShowPromptPreview(true)}
            disabled={isAnalyzing}
          >
            <Eye className="h-4 w-4" />
            Preview Prompt
          </button>
        </div>
      </CollapsibleCard>

      {/* Streaming Modal Dialog - appears as popup */}
      <dialog className={`modal ${isStreamingActive ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <h3 className="font-bold text-lg mb-4">{`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}</h3>
          <StreamingAnalysisPanel
            title={`${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}
            status={streamingPanelStatus}
            phase={typeof streamingPhase === 'string' ? streamingPhase : undefined}
            message={streamingPanelStatus === 'failed' ? streamError?.message ?? streamingMessage ?? 'Streaming failed' : streamingMessage}
            text={streamingText}
            reasoning={streamingReasoning}
            tokenUsage={streamingTokenUsage}
            onCancel={streamingPanelStatus === 'in_progress' ? cancelStreamingAnalysis : undefined}
            onClose={closeStreamingModal}
          />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => {
            if (streamingPanelStatus === 'in_progress') {
              cancelStreamingAnalysis();
            }
          }}>close</button>
        </form>
      </dialog>

      {/* Advanced Controls */}
      <CollapsibleCard
        title="Advanced Controls"
        icon={Settings}
        defaultOpen={false}
        headerDescription={
          <p className="text-sm text-gray-600">Fine-tune model behavior with advanced parameters</p>
        }
      >
            {/* Temperature Control */}
            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center gap-3">
                <label htmlFor="temperature" className="label text-sm font-medium whitespace-nowrap">
                  Temperature: {temperature}
                </label>
                <div className="flex-1 max-w-xs">
                  <input
                    type="range"
                    id="temperature"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="range range-xs w-full"
                  />
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  <div>Controls creativity • Gemini & GPT-4.1 & older only!!!</div>
                  <div className="text-blue-600">💡 Temperature and reasoning are mutually exclusive</div>
                </div>
              </div>
            </div>

            {/* Top P Control */}
            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center gap-3">
                <label htmlFor="topP" className="label text-sm font-medium whitespace-nowrap">
                  Top P: {topP.toFixed(2)}
                </label>
                <div className="flex-1 max-w-xs">
                  <input
                    type="range"
                    id="topP"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="range range-xs w-full"
                  />
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  <div>Controls diversity • Gemini only</div>
                </div>
              </div>
            </div>

            {/* Candidate Count Control */}
            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center gap-3">
                <label htmlFor="candidateCount" className="label text-sm font-medium whitespace-nowrap">
                  Candidates: {candidateCount}
                </label>
                <div className="flex-1 max-w-xs">
                  <input
                    type="range"
                    id="candidateCount"
                    min="1"
                    max="8"
                    step="1"
                    value={candidateCount}
                    onChange={(e) => setCandidateCount(parseInt(e.target.value))}
                    className="range range-xs w-full"
                  />
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  <div>Number of responses • Gemini only</div>
                </div>
              </div>
            </div>

            {/* Thinking Budget Control */}
            <div className="mb-2 p-2 bg-purple-50 border border-purple-200 rounded">
              <div className="flex items-center gap-3">
                <label htmlFor="thinkingBudget" className="label text-sm font-medium whitespace-nowrap">
                  Thinking Budget: {thinkingBudget === -1 ? 'Dynamic' : thinkingBudget === 0 ? 'Disabled' : thinkingBudget}
                </label>
                <div className="flex-1 max-w-xs">
                  <select 
                    className="select select-bordered w-full"
                    value={thinkingBudget.toString()} 
                    onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                  >
                    <option value="-1">Dynamic (Model Chooses)</option>
                    <option value="0">Disabled</option>
                    <option value="512">512 tokens</option>
                    <option value="1024">1024 tokens</option>
                    <option value="2048">2048 tokens</option>
                    <option value="4096">4096 tokens</option>
                    <option value="8192">8192 tokens</option>
                    <option value="16384">16384 tokens</option>
                    <option value="24576">24576 tokens (Max Flash)</option>
                    <option value="32768">32768 tokens (Max Pro)</option>
                  </select>
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  <div>Internal reasoning tokens • Gemini 2.5+ only</div>
                </div>
              </div>
            </div>

            {/* GPT-5 Reasoning Parameters */}
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                GPT-5 Reasoning Parameters
              </h5>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Effort Control */}
                  <div>
                    <label htmlFor="reasoning-effort" className="label text-sm font-medium text-blue-700">
                      Effort Level
                    </label>
                    <select 
                      className="select select-bordered w-full mt-1"
                      value={reasoningEffort} 
                      onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
                    >
                      <option value="minimal">Minimal</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {reasoningEffort === 'minimal' && 'Basic reasoning'}
                      {reasoningEffort === 'low' && 'Light reasoning'}
                      {reasoningEffort === 'medium' && 'Moderate reasoning'}
                      {reasoningEffort === 'high' && 'Intensive reasoning'}
                    </p>
                  </div>

                  {/* Verbosity Control */}
                  <div>
                    <label htmlFor="reasoning-verbosity" className="label text-sm font-medium text-blue-700">
                      Verbosity
                    </label>
                    <select 
                      className="select select-bordered w-full mt-1"
                      value={reasoningVerbosity} 
                      onChange={(e) => setReasoningVerbosity(e.target.value as 'low' | 'medium' | 'high')}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {reasoningVerbosity === 'low' && 'Concise reasoning logs'}
                      {reasoningVerbosity === 'medium' && 'Balanced detail'}
                      {reasoningVerbosity === 'high' && 'Detailed reasoning logs'}
                    </p>
                  </div>

                  {/* Summary Control */}
                  <div>
                    <label htmlFor="reasoning-summary" className="label text-sm font-medium text-blue-700">
                      Summary
                    </label>
                    <select 
                      className="select select-bordered w-full mt-1"
                      value={reasoningSummaryType} 
                      onChange={(e) => setReasoningSummaryType(e.target.value as 'auto' | 'detailed')}
                    >
                      <option value="auto">Auto</option>
                      <option value="detailed">Detailed</option>
                    </select>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {reasoningSummaryType === 'auto' && 'Automatic summary generation'}
                      {reasoningSummaryType === 'detailed' && 'Comprehensive summary'}
                    </p>
                  </div>
                </div>
              </div>
      </CollapsibleCard>

      {/* Model Selection */}
      <CollapsibleCard
        title="Model Selection"
        icon={Rocket}
        defaultOpen={true}
        headerDescription={
          <p className="text-sm text-gray-600">Choose which AI models to run analysis with</p>
        }
      >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {models?.map((model) => {
                const isProcessing = processingModels.has(model.key);
                const isStreamingThisModel = streamingModelKey === model.key;
                const disableDueToStreaming = isStreamingActive && !isStreamingThisModel;

                return (
                  <ModelButton
                    key={model.key}
                    model={model}
                    isAnalyzing={isProcessing}
                    isStreaming={isStreamingThisModel}
                    streamingSupported={streamingEnabled && canStreamModel(model.key)}
                    explanationCount={explanations.filter(explanation => explanation.modelName === model.key).length}
                    onAnalyze={handleAnalyzeWithModel}
                    disabled={isProcessing || disableDueToStreaming}
                    error={analyzerErrors.get(model.key)}
                  />
                );
              })}
        </div>
      </CollapsibleCard>

      {/* Analysis Results - THE FOCUS OF THE PAGE (separate from AI Model Testing) */}
      {(allResults.length > 0 || isAnalyzing) && (
        <div className="card bg-base-100 shadow">
          <div className="card-body pb-2">
            <div className="flex items-center justify-between">
              <h2 className="card-title flex items-center gap-2 text-base">
                <Brain className="h-4 w-4" />
                Analysis Results ({explanations.length})
              </h2>
                
              {/* Correctness Filter */}
              <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <div className="btn-group">
                    <button 
                      className={`btn btn-xs ${correctnessFilter === 'all' ? 'btn-active' : 'btn-outline'}`}
                      onClick={() => setCorrectnessFilter('all')}
                    >
                      All ({allResults.length})
                    </button>
                    <button 
                      className={`btn btn-xs ${correctnessFilter === 'correct' ? 'btn-active btn-success' : 'btn-outline'} text-green-700`}
                      onClick={() => setCorrectnessFilter('correct')}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Correct ({allResults.filter(r => determineCorrectness({
                        modelName: r.modelName,
                        isPredictionCorrect: r.isPredictionCorrect,
                        multiTestAllCorrect: r.multiTestAllCorrect,
                        hasMultiplePredictions: r.hasMultiplePredictions
                      }).isCorrect).length})
                    </button>
                    <button 
                      className={`btn btn-xs ${correctnessFilter === 'incorrect' ? 'btn-active btn-error' : 'btn-outline'} text-red-700`}
                      onClick={() => setCorrectnessFilter('incorrect')}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Incorrect ({allResults.filter(r => determineCorrectness({
                        modelName: r.modelName,
                        isPredictionCorrect: r.isPredictionCorrect,
                        multiTestAllCorrect: r.multiTestAllCorrect,
                        hasMultiplePredictions: r.hasMultiplePredictions
                      }).isIncorrect).length})
                    </button>
                  </div>
              </div>
            </div>
          </div>
          <div className="card-body pt-2">
              {/* Show loading state when analysis is in progress */}
              {isAnalyzing && (
                <div className="mb-2 p-2 border rounded bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <div>
                      <p className="text-xs font-medium text-blue-800">
                        Analysis in progress...
                      </p>
                      {currentModel && (
                        <p className="text-[10px] text-blue-600">
                          Running {currentModel.name}
                          {currentModel.responseTime && (
                            <span className="ml-2">
                              (Expected: {currentModel.responseTime.estimate})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Show existing results */}
              {filteredResults.length > 0 && (
                <div className="space-y-2">
                  {filteredResults.map((result) => (
                    <AnalysisResultCard
                      key={`${result.id}-${result.modelName}`}
                      modelKey={result.modelName}
                      result={result}
                      model={models?.find(m => m.key === result.modelName)} // Pass model config to enable temperature display
                      testCases={task.test} // Pass the full test array
                    />
                  ))}
                </div>
              )}
              
              {/* Show message when no results match filter */}
              {filteredResults.length === 0 && allResults.length > 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No {correctnessFilter === 'correct' ? 'correct' : 'incorrect'} results found.</p>
                  <p className="text-sm mt-1">
                    {correctnessFilter === 'correct' 
                      ? 'Try running more analyses or switch to "All" to see all results.'
                      : 'All results appear to be correct, or switch to "All" to see all results.'}
                  </p>
                </div>
              )}
          </div>
        </div>
      )}
      
      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={showPromptPreview}
        onClose={() => setShowPromptPreview(false)}
        task={task}
        taskId={taskId}

        promptId={promptId}
        customPrompt={customPrompt}
        options={{
          emojiSetKey: emojiSet,
          omitAnswer,
          sendAsEmojis
        }}
      />
    </div>
  );
}
