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
import { getDefaultSaturnModel } from '@/lib/saturnModels';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel, sessionId } = useSaturnProgress(taskId);

  // Settings state - GPT-5 Mini with high reasoning/verbosity/detailed summary as DEFAULT
  const defaultModel = getDefaultSaturnModel();
  const [model, setModel] = React.useState(defaultModel?.key || 'gpt-5-mini-2025-08-07');
  const [temperature, setTemperature] = React.useState(0.2);
  const [reasoningEffort, setReasoningEffort] = React.useState<'minimal' | 'low' | 'medium' | 'high'>('high');
  const [reasoningVerbosity, setReasoningVerbosity] = React.useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = React.useState<'auto' | 'detailed'>('detailed');
  const [startTime, setStartTime] = React.useState<Date | null>(null);

  // Track running state
  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  // Track start time for elapsed calculation
  React.useEffect(() => {
    if (state.status === 'running' && !startTime) {
      setStartTime(new Date());
    } else if (state.status !== 'running') {
      setStartTime(null);
    }
  }, [state.status, startTime]);

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

  const onStart = () => start({
    model,
    temperature,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
  });

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-300 px-3 py-2">
        <div className="flex items-center justify-between mb-2">
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
            <button onClick={onStart} className="btn btn-success btn-sm gap-1">
              <Rocket className="h-4 w-4" />
              Start Analysis
            </button>
          ) : (
            <button onClick={cancel} className="btn btn-error btn-sm gap-1">
              <Square className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>
        
        {/* Controls - ALL visible, compact */}
        <div className="grid grid-cols-6 gap-2 text-xs">
          {/* Model */}
          <div>
            <label className="block text-gray-600 mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="select select-bordered select-xs w-full"
            >
              <option value="gpt-5-mini-2025-08-07">GPT-5 Mini</option>
              <option value="gpt-5-nano-2025-08-07">GPT-5 Nano</option>
              <option value="grok-4-fast-reasoning">Grok-4 Fast</option>
              <option value="o3-mini-2025-01-31">O3 Mini</option>
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-gray-600 mb-1">Temperature</label>
            <input
              type="number"
              min="0.1"
              max="2.0"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              disabled={isRunning}
              className="input input-bordered input-xs w-full"
            />
          </div>

          {/* Reasoning Effort */}
          <div>
            <label className="block text-gray-600 mb-1">Reasoning Effort</label>
            <select
              value={reasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value as any)}
              disabled={isRunning}
              className="select select-bordered select-xs w-full"
            >
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Reasoning Verbosity */}
          <div>
            <label className="block text-gray-600 mb-1">Verbosity</label>
            <select
              value={reasoningVerbosity}
              onChange={(e) => setReasoningVerbosity(e.target.value as any)}
              disabled={isRunning}
              className="select select-bordered select-xs w-full"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Summary Type */}
          <div>
            <label className="block text-gray-600 mb-1">Summary</label>
            <select
              value={reasoningSummaryType}
              onChange={(e) => setReasoningSummaryType(e.target.value as any)}
              disabled={isRunning}
              className="select select-bordered select-xs w-full"
            >
              <option value="auto">Auto</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-gray-600 mb-1">Status</label>
            <div className={`px-2 py-1 rounded text-xs font-bold ${
              isRunning ? 'bg-blue-100 text-blue-800' : 
              isDone ? 'bg-green-100 text-green-800' : 
              hasError ? 'bg-red-100 text-red-800' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {state.status.toUpperCase()}
            </div>
          </div>
        </div>
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
