/**
 * client/src/pages/SaturnVisualSolver.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-14
 * PURPOSE: Saturn Visual Solver with streaming AI output and generated images prominently displayed.
 * Info-dense layout focusing on AI streaming responses and visual grid generation.
 *
 * KEY FEATURES:
 * - Prominent AI streaming output display (reasoning + text responses)
 * - Image gallery for generated grid visualizations (base64 display)
 * - Compact puzzle data display (collapsible on mobile)
 * - Real-time phase indicators and status monitoring
 * - Removed Python logger approach - uses proper SSE streaming
 *
 * LAYOUT:
 * Desktop: 35% left (puzzle + images) / 65% right (AI streaming + status)
 * Mobile: Stacked with AI output first, collapsible puzzle data
 *
 * SRP/DRY check: Pass - Pure orchestration, delegates to specialized components
 * DaisyUI: Fail - Uses custom layout patterns for ATC-style interface
 */

import React from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, ArrowLeft, Rocket, Square } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useSaturnProgress } from '@/hooks/useSaturnProgress';
import SaturnMonitoringTable from '@/components/saturn/SaturnMonitoringTable';
import SaturnWorkTable from '@/components/saturn/SaturnWorkTable';
import SaturnRadarCanvas from '@/components/saturn/SaturnRadarCanvas';
import SaturnTerminalLogs from '@/components/saturn/SaturnTerminalLogs';
import SaturnImageGallery from '@/components/saturn/SaturnImageGallery';
import { getDefaultSaturnModel } from '@/lib/saturnModels';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel, sessionId } = useSaturnProgress(taskId);

  // Settings state - use dynamic defaults from model configuration
  const defaultModel = getDefaultSaturnModel();
  const [model, setModel] = React.useState(defaultModel?.key || 'grok-4-fast-reasoning');
  const [temperature, setTemperature] = React.useState(0.2);
  const [reasoningEffort, setReasoningEffort] = React.useState<'minimal' | 'low' | 'medium' | 'high'>('medium');
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
  });

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-gray-900 flex flex-col">
      {/* Compact Header */}
      <header className="p-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-700">🪐 SATURN VISUAL SOLVER</h1>
            <p className="text-xs text-gray-500">Puzzle: {taskId}</p>
          </div>
          {/* Controls moved to header for space efficiency */}
          <SaturnRadarCanvas
            state={state}
            isRunning={isRunning}
            model={model}
            setModel={setModel}
            temperature={temperature}
            setTemperature={setTemperature}
            reasoningEffort={reasoningEffort}
            setReasoningEffort={setReasoningEffort}
            onStart={onStart}
            onCancel={cancel}
          />
        </div>
      </header>

      {/* Main info-dense layout */}
      <main className="flex-1 overflow-hidden p-3">
        {/* Desktop layout - 2 column grid */}
        <div className="hidden lg:grid grid-cols-[35%_65%] gap-3 h-full min-h-0">

          {/* LEFT COLUMN: Puzzle Data + Image Gallery */}
          <section className="min-h-0 overflow-hidden grid grid-rows-[auto_1fr] gap-3">
            {/* Compact Puzzle Data */}
            <div className="bg-white border border-gray-300 rounded overflow-hidden">
              <div className="bg-blue-50 border-b border-blue-200 px-3 py-2">
                <h2 className="font-bold text-blue-900 text-sm">🧩 PUZZLE DATA</h2>
              </div>
              <div className="p-3 max-h-[300px] overflow-y-auto">
                <CompactPuzzleDisplay
                  trainExamples={task.train}
                  testCases={task.test}
                  showEmojis={false}
                  title=""
                  maxTrainingExamples={2}
                  defaultTrainingCollapsed={false}
                  showTitle={false}
                />
              </div>
            </div>

            {/* Image Gallery - PROMINENT */}
            <SaturnImageGallery
              images={state.galleryImages || []}
              isRunning={isRunning}
            />
          </section>

          {/* RIGHT COLUMN: AI Streaming Output + Status */}
          <aside className="h-full min-h-0 overflow-hidden grid grid-rows-[1fr_auto] gap-3">
            {/* AI Streaming Output - PROMINENT */}
            <SaturnTerminalLogs
              streamingText={state.streamingText}
              streamingReasoning={state.streamingReasoning}
              isRunning={isRunning}
              phase={state.streamingPhase || state.phase}
            />

            {/* Compact Status Monitor */}
            <div className="grid grid-cols-2 gap-2">
              <SaturnMonitoringTable
                taskId={taskId}
                state={state}
                isRunning={isRunning}
              />
              <SaturnWorkTable
                state={state}
                isRunning={isRunning}
              />
            </div>
          </aside>
        </div>

        {/* Mobile layout - single column */}
        <div className="block lg:hidden h-full min-h-0 overflow-auto space-y-3">
          {/* Controls */}
          <SaturnRadarCanvas
            state={state}
            isRunning={isRunning}
            model={model}
            setModel={setModel}
            temperature={temperature}
            setTemperature={setTemperature}
            reasoningEffort={reasoningEffort}
            setReasoningEffort={setReasoningEffort}
            onStart={onStart}
            onCancel={cancel}
            compact
          />

          {/* AI Streaming */}
          <SaturnTerminalLogs
            streamingText={state.streamingText}
            streamingReasoning={state.streamingReasoning}
            isRunning={isRunning}
            phase={state.streamingPhase || state.phase}
            compact
          />

          {/* Images */}
          <SaturnImageGallery
            images={state.galleryImages || []}
            isRunning={isRunning}
          />

          {/* Status */}
          <SaturnMonitoringTable
            taskId={taskId}
            state={state}
            isRunning={isRunning}
            compact
          />

          {/* Puzzle Data - collapsed by default on mobile */}
          <div className="bg-white border border-gray-300 rounded">
            <details>
              <summary className="bg-blue-50 border-b border-blue-200 px-3 py-2 cursor-pointer">
                <span className="font-bold text-blue-900 text-sm">🧩 PUZZLE DATA</span>
              </summary>
              <div className="p-3">
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
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
