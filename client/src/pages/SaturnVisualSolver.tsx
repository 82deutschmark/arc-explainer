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
import SaturnFinalResultPanel from '@/components/saturn/SaturnFinalResultPanel';
import { getDefaultSaturnModel, getModelProvider, modelSupportsTemperature } from '@/lib/saturnModels';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = useSaturnProgress(taskId);

  // Settings state - GPT-5 Mini with balanced (low) reasoning depth and detailed summary by default
  const defaultModel = getDefaultSaturnModel();
  const [model, setModel] = React.useState(defaultModel?.key || 'gpt-5-mini-2025-08-07');
  const [temperature, setTemperature] = React.useState(0.2);
  const [reasoningEffort, setReasoningEffort] = React.useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [reasoningVerbosity, setReasoningVerbosity] = React.useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = React.useState<'auto' | 'detailed'>('detailed');
  // Track running state
  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  const modelProvider = React.useMemo(() => getModelProvider(model), [model]);
  const isGrokFamily = React.useMemo(() => (modelProvider ?? '').toLowerCase() === 'xai', [modelProvider]);
  const showTemperatureControl = React.useMemo(() => isGrokFamily && modelSupportsTemperature(model), [isGrokFamily, model]);
  const showReasoningControls = React.useMemo(() => !isGrokFamily, [isGrokFamily]);

  const finalAnalysis = React.useMemo(() => {
    if (!state.result || typeof state.result !== 'object') {
      return null;
    }

    const analysis = (state.result as { analysis?: Record<string, unknown> }).analysis;
    if (analysis && typeof analysis === 'object') {
      return analysis as Record<string, unknown>;
    }

    return state.result as Record<string, unknown>;
  }, [state.result]);

  const expectedOutputs = React.useMemo(() => {
    return (task?.test ?? []).map((testCase) => testCase.output);
  }, [task]);

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
    start({
      model,
      temperature: showTemperatureControl ? temperature : undefined,
      reasoningEffort: showReasoningControls ? reasoningEffort : undefined,
      reasoningVerbosity: showReasoningControls ? reasoningVerbosity : undefined,
      reasoningSummaryType: showReasoningControls ? reasoningSummaryType : undefined,
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-300 px-3 py-2">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <a href="/" className="btn btn-ghost btn-xs gap-1">
              <ArrowLeft className="h-3 w-3" />
              Back
            </a>
            <div className="border-l border-gray-300 pl-2">
              <h1 className="text-sm font-bold text-gray-900">🪐 Saturn Visual Solver - Puzzle {taskId}</h1>
            </div>
          </div>
          {/* Start/Stop */}
          {!isRunning ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">Ready to Start?</span>
              <button
                onClick={onStart}
                className="btn btn-primary btn-lg gap-2 font-semibold uppercase tracking-wide shadow-lg shadow-primary/30"
              >
                <Rocket className="h-5 w-5" />
                Start Analysis
              </button>
            </div>
          ) : (
            <button onClick={cancel} className="btn btn-error btn-lg gap-2 font-semibold uppercase tracking-wide">
              <Square className="h-5 w-5" />
              Stop
            </button>
          )}
        </div>

        {/* Controls - ALL visible, compact */}
        <div className="grid grid-cols-12 gap-3 text-xs md:text-sm items-end">
          {/* Model */}
          <div className="col-span-12 md:col-span-5">
            <label className="block text-gray-600 mb-1 font-semibold uppercase text-[11px] tracking-wide">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="select select-bordered select-sm md:select-md w-full"
            >
              <option value="gpt-5-mini-2025-08-07">GPT-5 Mini</option>
              <option value="gpt-5-nano-2025-08-07">GPT-5 Nano</option>
              <option value="grok-4-fast-reasoning">Grok-4 Fast</option>
              <option value="o3-mini-2025-01-31">O3 Mini</option>
            </select>
          </div>

          {/* Temperature */}
          {showTemperatureControl && (
            <div className="col-span-12 md:col-span-3">
              <label className="block text-gray-600 mb-1 font-semibold uppercase text-[11px] tracking-wide">Temperature</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  disabled={isRunning}
                  className="range range-sm range-primary flex-1"
                />
                <span className="w-12 text-center text-xs font-semibold text-gray-700">{temperature.toFixed(1)}</span>
              </div>
            </div>
          )}

          {/* Status */}
          <div className={`col-span-12 ${showTemperatureControl ? 'md:col-span-4' : 'md:col-span-5'}`}>
            <label className="block text-gray-600 mb-1 font-semibold uppercase text-[11px] tracking-wide">Status</label>
            <div
              className={`px-3 py-2 rounded text-xs md:text-sm font-bold tracking-wide uppercase text-center ${
                isRunning ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                isDone ? 'bg-green-100 text-green-800 border border-green-200' :
                hasError ? 'bg-red-100 text-red-800 border border-red-200' :
                'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              {state.status.toUpperCase()}
            </div>
          </div>
        </div>

        {showReasoningControls && (
          <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Reasoning Controls</span>
              <span className="text-[10px] text-primary/70">Fine-tune depth &amp; verbosity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-gray-700 mb-1 text-xs font-semibold uppercase tracking-wide">Effort Level</label>
                <select
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value as any)}
                  disabled={isRunning}
                  className="select select-bordered select-sm md:select-md w-full"
                >
                  <option value="minimal">Minimal</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1 text-xs font-semibold uppercase tracking-wide">Verbosity</label>
                <select
                  value={reasoningVerbosity}
                  onChange={(e) => setReasoningVerbosity(e.target.value as any)}
                  disabled={isRunning}
                  className="select select-bordered select-sm md:select-md w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1 text-xs font-semibold uppercase tracking-wide">Summary Style</label>
                <select
                  value={reasoningSummaryType}
                  onChange={(e) => setReasoningSummaryType(e.target.value as any)}
                  disabled={isRunning}
                  className="select select-bordered select-sm md:select-md w-full"
                >
                  <option value="auto">Auto</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs md:text-sm">
          <article className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
            <h2 className="text-xs md:text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">Visual-first methodology</h2>
            <p className="text-gray-700 leading-snug">
              Saturn converts ARC grids into PNGs and stages training examples across phased prompts so GPT-5 can spot palette-driven transformations, maintain conversation history, and treat puzzles as visual pattern recognition tasks rather than symbolic manipulation.
            </p>
          </article>

          <article className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
            <h2 className="text-xs md:text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">Measured performance</h2>
            <p className="text-gray-700 leading-snug">
              Initial testing on 40 ARC-AGI-2 evaluation samples reached a 22% success rate versus the 15.9% published state-of-the-art, with each puzzle averaging about $0.90 in token spend. The solver’s reasoning phases lean on GPT-5 Thinking with high-effort settings and tool calls for intermediate visualizations.
            </p>
          </article>

          <article className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
            <h2 className="text-xs md:text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">Reproduce &amp; explore</h2>
            <p className="text-gray-700 leading-snug">
              To replicate the Python pipeline, export an OpenAI API key and run <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded">python3 arc_visual_solver.py</code> against ARC task files or batch scripts. Detailed setup notes, comparative runs, and qualitative reasoning transcripts live in the solver README.
            </p>
            <a
              className="link link-primary text-xs mt-2 inline-flex items-center gap-1"
              href="/solver/readme"
            >
              View solver README →
            </a>
          </article>
        </section>
      </header>

      {/* Main Content - INFO DENSE */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full grid grid-cols-12 gap-2">
          {/* LEFT: Status + Work Table + Puzzle (3 cols) */}
          <div className="col-span-3 flex flex-col gap-2 overflow-y-auto">
            {/* Monitoring Status - TOP */}
            <SaturnMonitoringTable
              taskId={taskId}
              state={state}
              isRunning={isRunning}
            />

            {/* Work Table - PROMINENT */}
            <div className="flex-1 min-h-0">
              <SaturnWorkTable
                state={state}
                isRunning={isRunning}
              />
            </div>

            {/* Puzzle Display - BOTTOM */}
            <div className="bg-white border border-gray-300 rounded">
              <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                <h2 className="text-xs font-bold text-gray-700">PUZZLE</h2>
              </div>
              <div className="p-2">
                <CompactPuzzleDisplay
                  trainExamples={task.train}
                  testCases={task.test}
                  showEmojis={false}
                  title=""
                  maxTrainingExamples={1}
                  defaultTrainingCollapsed={true}
                  showTitle={false}
                />
              </div>
            </div>
          </div>

          {/* CENTER: AI Output (6 cols) */}
          <div className="col-span-6 flex flex-col gap-2 min-h-0">
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

            {/* AI Streaming Output - MAIN */}
            <div className="flex-1 min-h-0">
              <SaturnTerminalLogs
                streamingText={state.streamingText}
                streamingReasoning={state.streamingReasoning}
                logLines={state.logLines}
                isRunning={isRunning}
                phase={state.streamingPhase || state.phase}
              />
            </div>
            <div className="max-h-[50vh] overflow-auto">
              <SaturnFinalResultPanel
                analysis={finalAnalysis}
                expectedOutputs={expectedOutputs}
                status={state.status}
              />
            </div>
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
    </div>
  );
}
