/**
 * Author: Cascade
 * Date: 2025-10-15
 * PURPOSE: Saturn Visual Solver - GPT-5 multimodal ARC-AGI solver interface.
 * Achieves 22% on ARC-AGI-2 eval (vs 15.9% SOTA) using visual pattern recognition.
 * Shows: real-time AI reasoning, generated PNG images, token usage, phase progress.
 * ~27min/problem, ~$0.90/problem average.
 *
 * SRP/DRY check: Pass - Main page orchestration
 * DaisyUI: Pass - Uses project's standard components
 */

import React from 'react';
import { useParams } from 'wouter';
import { Rocket, Square, ArrowLeft } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useSaturnProgress } from '@/hooks/useSaturnProgress';
import SaturnMonitoringTable from '@/components/saturn/SaturnMonitoringTable';
import SaturnWorkTable from '@/components/saturn/SaturnWorkTable';
import SaturnTerminalLogs from '@/components/saturn/SaturnTerminalLogs';
import SaturnImageGallery from '@/components/saturn/SaturnImageGallery';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { useSaturnExplanation } from '@/hooks/useSaturnExplanation';
import { getDefaultSaturnModel, getModelProvider, modelSupportsTemperature } from '@/lib/saturnModels';
import { PuzzleGridDisplay } from '@/components/puzzle/PuzzleGridDisplay';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import { useSaturnAudioNarration } from '@/hooks/useSaturnAudioNarration';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = useSaturnProgress(taskId);
  const {
    enabled: audioEnabled,
    available: audioAvailable,
    status: audioStatus,
    error: audioError,
    volume: audioVolume,
    toggleEnabled: toggleAudio,
    setVolume: setAudioVolume,
    enqueueReasoning,
    flush: flushAudio,
    reset: resetAudio,
  } = useSaturnAudioNarration();
  const reasoningCursorRef = React.useRef(0);
  const previousStatusRef = React.useRef(state.status);

  // Settings state - GPT-5 Nano with balanced (low) reasoning depth and detailed summary by default
  const defaultModel = getDefaultSaturnModel();
  const [model, setModel] = React.useState(defaultModel?.key || 'gpt-5-nano-2025-08-07');
  const [temperature, setTemperature] = React.useState(0.2);
  const [reasoningEffort, setReasoningEffort] = React.useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [reasoningVerbosity, setReasoningVerbosity] = React.useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = React.useState<'auto' | 'detailed'>('detailed');

  // Fetch saved explanation from database after streaming completes
  const { explanation, isLoading: isLoadingExplanation, error: explanationError } = useSaturnExplanation(
    taskId,
    model,
    state.status === 'completed'
  );

  // Track running state
  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  const modelProvider = React.useMemo(() => getModelProvider(model), [model]);
  const isGrokFamily = React.useMemo(() => (modelProvider ?? '').toLowerCase() === 'xai', [modelProvider]);
  const showTemperatureControl = React.useMemo(() => isGrokFamily && modelSupportsTemperature(model), [isGrokFamily, model]);
  const showReasoningControls = React.useMemo(() => !isGrokFamily, [isGrokFamily]);

  React.useEffect(() => {
    const prev = previousStatusRef.current;
    if (state.status === 'running' && prev !== 'running') {
      reasoningCursorRef.current = state.streamingReasoning?.length ?? 0;
      resetAudio();
    }
    if ((state.status === 'completed' || state.status === 'error') && prev === 'running') {
      flushAudio();
    }
    if (state.status === 'idle') {
      reasoningCursorRef.current = 0;
    }
    previousStatusRef.current = state.status;
  }, [flushAudio, resetAudio, state.status, state.streamingReasoning]);

  React.useEffect(() => {
    if (!audioEnabled) {
      return;
    }
    const reasoningText = state.streamingReasoning ?? '';
    if (reasoningText.length < reasoningCursorRef.current) {
      reasoningCursorRef.current = reasoningText.length;
      return;
    }
    if (reasoningText.length > reasoningCursorRef.current) {
      const delta = reasoningText.slice(reasoningCursorRef.current);
      reasoningCursorRef.current = reasoningText.length;
      enqueueReasoning(delta);
    }
  }, [audioEnabled, enqueueReasoning, state.streamingReasoning]);

  const previousAudioEnabledRef = React.useRef(audioEnabled);

  React.useEffect(() => {
    const wasEnabled = previousAudioEnabledRef.current;
    if (audioEnabled && !wasEnabled) {
      reasoningCursorRef.current = state.streamingReasoning?.length ?? 0;
    }
    if (!audioEnabled && wasEnabled) {
      resetAudio();
    }
    previousAudioEnabledRef.current = audioEnabled;
  }, [audioEnabled, resetAudio, state.streamingReasoning]);


  // Error states
  if (!taskId) {
    return (
      <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="p-4">
          <div className="text-red-600 text-sm font-bold">⚠️ INVALID PUZZLE ID</div>
        </div>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="p-4">
          <div className="text-amber-600 text-sm font-bold">🔄 LOADING PUZZLE...</div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="p-4">
          <div className="text-red-600 text-sm font-bold">❌ PUZZLE NOT FOUND</div>
          <div className="text-gray-600 text-xs mt-1">{taskError?.message || 'Puzzle could not be loaded'}</div>
        </div>
      </div>
    );
  }

  const onStart = () => {
    const config: any = {
      model,
    };
    
    // Only send temperature for models that support it (Grok family)
    if (showTemperatureControl) {
      config.temperature = temperature;
    }
    
    // Only send reasoning parameters for OpenAI models
    if (showReasoningControls) {
      config.reasoningEffort = reasoningEffort;
      config.reasoningVerbosity = reasoningVerbosity;
      config.reasoningSummaryType = reasoningSummaryType;
    }
    
    start(config);
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-gray-900 flex flex-col">
      {/* Compact Header - Always visible */}
      <header className="bg-white border-b border-gray-300 px-2 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <a href="/" className="btn btn-ghost btn-xs gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back
          </a>
          <div className="border-l border-gray-300 pl-2">
            <h1 className="text-xs font-bold text-gray-900">🪐 Saturn - {taskId}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="text-xs">
              <span className="font-semibold text-gray-600">Model:</span> <span className="text-gray-900">{model.split('/').pop()?.replace('gpt-5-', 'GPT-5 ').replace('grok-', 'Grok ').replace('o3-', 'O3 ')}</span>
            </div>
          )}
          <a href="/solver/readme" className="btn btn-ghost btn-xs">README</a>
          {audioAvailable && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleAudio}
                className={`btn btn-xs ${audioEnabled ? 'btn-secondary' : 'btn-ghost'}`}
                title={audioEnabled ? 'Disable narration' : 'Enable narration'}
              >
                🔊 {audioEnabled ? 'On' : 'Off'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                className="range range-xs w-20"
                disabled={!audioEnabled}
              />
            </div>
          )}
          {isRunning && (
            <button onClick={cancel} className="btn btn-error btn-sm gap-1">
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          )}
        </div>
      </header>

      {/* IDLE STATE: Configuration Screen */}
      {!isRunning && !isDone && !hasError && (
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Hero: Start Button */}
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-bold text-gray-900">Saturn Visual ARC Solver</h2>
              <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                Visual-first solver using GPT-5 multimodal. Converts grids to PNGs, applies phased prompts. 22% success on ARC-AGI-2 eval vs 15.9% SOTA.
              </p>
              <button
                onClick={onStart}
                className="btn btn-primary btn-lg gap-3 text-lg font-bold uppercase tracking-wide shadow-2xl shadow-primary/40 px-12 py-6"
              >
                <Rocket className="h-6 w-6" />
                Start Visual Analysis
              </button>
            </div>

            {/* Configuration Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Model Selection */}
              <div className="card bg-white border border-gray-300 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Model Configuration</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label py-1">
                        <span className="label-text text-xs font-semibold">Model</span>
                      </label>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="select select-bordered select-sm w-full"
                      >
                        <option value="gpt-5-nano-2025-08-07">GPT-5 Nano (Recommended)</option>
                        <option value="gpt-5-mini-2025-08-07">GPT-5 Mini</option>
                        <option value="grok-4-fast-reasoning">Grok-4 Fast</option>
                        <option value="o3-mini-2025-01-31">O3 Mini</option>
                      </select>
                    </div>
                    {showTemperatureControl && (
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs font-semibold">Temperature: {temperature.toFixed(1)}</span>
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="2.0"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="range range-primary range-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reasoning Controls */}
              {showReasoningControls && (
                <div className="card bg-white border border-gray-300 shadow-sm">
                  <div className="card-body p-4">
                    <h3 className="card-title text-sm">Reasoning Configuration</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs font-semibold">Effort Level</span>
                        </label>
                        <select
                          value={reasoningEffort}
                          onChange={(e) => setReasoningEffort(e.target.value as any)}
                          className="select select-bordered select-sm w-full"
                        >
                          <option value="minimal">Minimal</option>
                          <option value="low">Low (Recommended)</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label py-1">
                            <span className="label-text text-xs font-semibold">Verbosity</span>
                          </label>
                          <select
                            value={reasoningVerbosity}
                            onChange={(e) => setReasoningVerbosity(e.target.value as any)}
                            className="select select-bordered select-sm w-full"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="label py-1">
                            <span className="label-text text-xs font-semibold">Summary</span>
                          </label>
                          <select
                            value={reasoningSummaryType}
                            onChange={(e) => setReasoningSummaryType(e.target.value as any)}
                            className="select select-bordered select-sm w-full"
                          >
                            <option value="auto">Auto</option>
                            <option value="detailed">Detailed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Puzzle Preview */}
            <div>
              <PuzzleGridDisplay
                task={task}
                showEmojis={false}
                emojiSet={DEFAULT_EMOJI_SET}
              />
            </div>
          </div>
        </main>
      )}

      {/* RUNNING/DONE STATE: Monitoring Screen */}
      {(isRunning || isDone || hasError) && (
        <main className="flex-1 overflow-hidden p-2">
          <div className="h-full grid grid-cols-12 gap-2">
            {/* LEFT: Status + Work Table + Puzzle (4 cols - expanded) */}
            <div className="col-span-4 flex flex-col gap-2 overflow-y-auto">
              {/* Monitoring Status */}
              <SaturnMonitoringTable
                taskId={taskId}
                state={state}
                isRunning={isRunning}
              />

              {/* Work Table */}
              <div className="flex-1 min-h-0">
                <SaturnWorkTable
                  state={state}
                  isRunning={isRunning}
                />
              </div>

              {/* Puzzle Display - Training & Test Grids */}
              <div className="bg-white border border-gray-300 rounded">
                <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                  <h2 className="text-xs font-bold text-gray-700">PUZZLE GRIDS</h2>
                </div>
                <div className="p-2 space-y-3 max-h-[600px] overflow-y-auto">
                  {/* Training Examples */}
                  {task.train.slice(0, 2).map((example, idx) => (
                    <div key={`train-${idx}`} className="space-y-1">
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Training {idx + 1}</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-[9px] text-gray-500 mb-0.5">Input</div>
                          <PuzzleGrid
                            grid={example.input}
                            title="Input"
                            showEmojis={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                            compact
                            maxWidth={200}
                            maxHeight={200}
                          />
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500 mb-0.5">Output</div>
                          <PuzzleGrid
                            grid={example.output}
                            title="Output"
                            showEmojis={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                            compact
                            maxWidth={200}
                            maxHeight={200}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Test Cases */}
                  {task.test.map((testCase, idx) => (
                    <div key={`test-${idx}`} className="space-y-1">
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Test {idx + 1}</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-[9px] text-gray-500 mb-0.5">Input</div>
                          <PuzzleGrid
                            grid={testCase.input}
                            title="Test Input"
                            showEmojis={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                            compact
                            maxWidth={200}
                            maxHeight={200}
                          />
                        </div>
                        {testCase.output && (
                          <div>
                            <div className="text-[9px] text-gray-500 mb-0.5">Expected</div>
                            <PuzzleGrid
                              grid={testCase.output}
                              title="Expected Output"
                              showEmojis={false}
                              emojiSet={DEFAULT_EMOJI_SET}
                              compact
                              maxWidth={200}
                              maxHeight={200}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER: AI Output (5 cols) */}
            <div className="col-span-5 flex flex-col gap-2 min-h-0">
            {/* Token Metrics - TOP */}
            <div className="bg-white border border-gray-300 rounded">
              <div className="grid grid-cols-4 divide-x divide-gray-300">
                <div className="p-2">
                  <div className="text-xs text-gray-600">Input</div>
                  <div className="text-sm font-bold text-gray-900">
                    {state.streamingTokenUsage?.input || 0}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-600">Output</div>
                  <div className="text-sm font-bold text-gray-900">
                    {state.streamingTokenUsage?.output || 0}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-600">Reasoning</div>
                  <div className="text-sm font-bold text-gray-900">
                    {state.streamingTokenUsage?.reasoning || 0}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-600">Total</div>
                  <div className="text-sm font-bold text-gray-900">
                    {(state.streamingTokenUsage?.input || 0) + 
                     (state.streamingTokenUsage?.output || 0) + 
                     (state.streamingTokenUsage?.reasoning || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Streaming Output - Show ONLY while running */}
            {!isDone && (
              <div className="flex-1 min-h-0">
                {audioAvailable && (
                  <div className="px-2 pb-1 text-[11px] text-gray-500 flex items-center gap-2">
                    <span>
                      {audioEnabled ? '🔊 Narration' : '🔇 Narration disabled'}
                    </span>
                    {audioEnabled && (
                      <span>
                        {audioStatus === 'buffering' && 'preparing…'}
                        {audioStatus === 'playing' && 'playing'}
                        {audioStatus === 'idle' && 'idle'}
                        {audioStatus === 'error' && 'error'}
                      </span>
                    )}
                    {!audioEnabled && audioError && <span className="text-red-500">{audioError}</span>}
                    {audioEnabled && audioError && <span className="text-red-500">{audioError}</span>}
                  </div>
                )}
                {!audioAvailable && audioError && (
                  <div className="px-2 pb-1 text-[11px] text-red-500">🔇 {audioError}</div>
                )}
                <SaturnTerminalLogs
                  streamingText={state.streamingText}
                  streamingReasoning={state.streamingReasoning}
                  logLines={state.logLines}
                  isRunning={isRunning}
                  phase={state.streamingPhase || state.phase}
                />
              </div>
            )}

            {/* Saturn Final Result - Show ONLY when completed */}
            {isDone && (
              <div className="flex-1 overflow-auto">
                {explanation ? (
                  <AnalysisResultCard
                    modelKey={model}
                    result={explanation}
                    model={undefined}
                    testCases={task.test}
                    eloMode={false}
                  />
                ) : isLoadingExplanation ? (
                  <div className="bg-white border border-indigo-200 rounded p-6 text-center">
                    <div className="text-indigo-600 font-semibold">Loading results...</div>
                    <div className="text-xs text-gray-500 mt-1">Fetching saved explanation from database</div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded p-6 text-center">
                    <div className="text-red-600 font-semibold">Failed to load explanation</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {explanationError?.message || 'Explanation not found in database'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

            {/* RIGHT: Images (3 cols) */}
            <div className="col-span-3 overflow-y-auto">
            <SaturnImageGallery
              images={state.galleryImages || []}
              isRunning={isRunning}
            />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
