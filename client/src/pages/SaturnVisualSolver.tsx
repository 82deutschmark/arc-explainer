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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white flex flex-col">
      {/* Enhanced Header with better visual hierarchy */}
      <header className="p-4 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🪐</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">SATURN VISUAL SOLVER</h1>
              <p className="text-sm text-blue-200/80">Advanced AI Pattern Recognition & Visual Analysis</p>
            </div>
          </div>

          {/* Enhanced Controls */}
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

      {/* Enhanced Main Layout */}
      <main className="flex-1 overflow-hidden p-4">
        {/* Desktop layout - Enhanced 2 column grid */}
        <div className="hidden lg:grid grid-cols-[35%_65%] gap-4 h-full min-h-0">

          {/* LEFT COLUMN: Enhanced Context + Image Gallery */}
          <section className="min-h-0 overflow-hidden grid grid-rows-[auto_1fr] gap-4">
            {/* Enhanced Puzzle Context */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-blue-400/30 px-4 py-3">
                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  PUZZLE CONTEXT
                </h2>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
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

            {/* Enhanced Image Gallery */}
            <SaturnImageGallery
              images={state.galleryImages?.map(img => ({
                ...img,
                phase: 'analysis',
                timestamp: new Date(),
                metadata: {
                  confidence: 85,
                  description: `Generated during ${state.streamingPhase || state.phase || 'analysis'} phase`
                }
              })) || []}
              isRunning={isRunning}
              title="🎨 Visual Analysis Gallery"
            />
          </section>

          {/* RIGHT COLUMN: Enhanced AI Streaming + Status */}
          <aside className="h-full min-h-0 overflow-hidden grid grid-rows-[1fr_auto] gap-4">
            {/* Enhanced AI Streaming Display */}
            <SaturnTerminalLogs
              streamingText={state.streamingText}
              streamingReasoning={state.streamingReasoning}
              isRunning={isRunning}
              phase={state.streamingPhase || state.phase}
            />

            {/* Enhanced Status Grid */}
            <div className="grid grid-cols-2 gap-3">
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

        {/* Enhanced Mobile layout */}
        <div className="block lg:hidden h-full min-h-0 overflow-auto space-y-4">
          {/* Enhanced Mobile Controls */}
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

          {/* Enhanced Mobile AI Streaming */}
          <SaturnTerminalLogs
            streamingText={state.streamingText}
            streamingReasoning={state.streamingReasoning}
            isRunning={isRunning}
            phase={state.streamingPhase || state.phase}
            compact
          />

          {/* Enhanced Mobile Images */}
          <SaturnImageGallery
            images={state.galleryImages?.map(img => ({
              ...img,
              phase: 'analysis',
              timestamp: new Date(),
              metadata: {
                confidence: 85,
                description: `Generated during ${state.streamingPhase || state.phase || 'analysis'} phase`
              }
            })) || []}
            isRunning={isRunning}
            title="🎨 Visual Gallery"
          />

          {/* Enhanced Mobile Status */}
          <SaturnMonitoringTable
            taskId={taskId}
            state={state}
            isRunning={isRunning}
            compact
          />

          {/* Enhanced Mobile Puzzle Data */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl">
            <details className="group">
              <summary className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-blue-400/30 px-4 py-3 cursor-pointer list-none">
                <span className="font-bold text-white text-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  PUZZLE CONTEXT
                  <div className="ml-auto transform transition-transform group-open:rotate-180">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </span>
              </summary>
              <div className="p-4">
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
