/**
 * client/src/pages/SaturnVisualSolver.tsx - FIXED: Added Puzzle Data Display
 *
 * Author: code-supernova using DeepSeek V3.2 Exp
 * Date: 2025-10-14
 * PURPOSE: Saturn Visual Solver with puzzle data display and information-dense layout.
 * Shows training examples and test cases prominently with clear In/Out labels.
 *
 * DESIGN FIXES:
 * - Added CompactPuzzleDisplay component for taskID examples and expected outputs
 * - Information-dense layout showing all puzzle data at once
 * - Clear visual hierarchy with puzzle data prominently displayed
 * - Uses existing CompactPuzzleDisplay component from other pages
 *
 * SRP/DRY check: Pass - Pure orchestration, delegates to specialized components
 * Design: Pass - Information-dense with puzzle data visibility
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
    <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
      {/* Header - ATC Style with Light Theme */}
      <header className="p-4 bg-gray-50 border-b border-gray-200">
        <h1 className="text-2xl tracking-tighter font-bold text-gray-700 text-spacing-px">SATURN VISUAL SOLVER</h1>
        <p className="mt-1 text-[10px] leading-none text-gray-500">
          <a
            href="#"
            className="hover:text-gray-700 italic underline"
          >
            VISUAL AI
          </a>
          <span className="px-1">•</span>
          <span className="text-gray-600">PUZZLE: {taskId}</span>
        </p>
      </header>

      {/* Main ATC-style layout with light theme */}
      <main className="flex-1 overflow-hidden p-4 bg-gray-50">
        {/* Desktop layout - ATC grid system */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-[30%_70%] gap-4 h-full min-h-0">

          {/* LEFT COLUMN: Puzzle Data + Monitoring + Work Table */}
          <section className="min-h-0 overflow-hidden grid grid-rows-[auto_auto_1fr] gap-3">

            {/* PUZZLE DATA DISPLAY - FIXED: Shows taskID examples and expected outputs */}
            <div className="bg-white border border-gray-300 overflow-hidden">
              <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
                <h2 className="bg-amber-400 px-2 py-1 font-bold text-black text-sm inline-block">
                  PUZZLE DATA
                </h2>
              </div>
              <div className="p-3">
                <CompactPuzzleDisplay
                  trainExamples={task.train}
                  testCases={task.test}
                  showEmojis={false}
                  title=""
                  maxTrainingExamples={3}
                  defaultTrainingCollapsed={false}
                  showTitle={false}
                />
              </div>
            </div>

            {/* Monitoring Table */}
            <SaturnMonitoringTable
              taskId={taskId}
              state={state}
              isRunning={isRunning}
            />

            {/* Work Table */}
            <SaturnWorkTable
              state={state}
              isRunning={isRunning}
            />
          </section>

          {/* RIGHT COLUMN: Terminal Logs + Radar */}
          <aside className="h-full min-h-0 overflow-hidden grid grid-rows-[1fr_auto] gap-3">

            {/* Terminal Logs - Information Dense */}
            <SaturnTerminalLogs
              logs={state.logLines || []}
              isRunning={isRunning}
              reasoning={state.streamingReasoning}
            />

            {/* Radar Canvas */}
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
          </aside>
        </div>

        {/* Mobile layout */}
        <div className="block lg:hidden h-full min-h-0 overflow-auto">
          <div className="flex flex-col gap-3 p-1">

            {/* PUZZLE DATA DISPLAY - Mobile */}
            <div className="bg-white border border-gray-300">
              <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
                <h2 className="bg-amber-400 px-2 py-1 font-bold text-black text-sm inline-block">
                  PUZZLE DATA
                </h2>
              </div>
              <div className="p-3">
                <CompactPuzzleDisplay
                  trainExamples={task.train}
                  testCases={task.test}
                  showEmojis={false}
                  title=""
                  maxTrainingExamples={2}
                  defaultTrainingCollapsed={true}
                  showTitle={false}
                />
              </div>
            </div>

            {/* Compact Monitoring */}
            <SaturnMonitoringTable
              taskId={taskId}
              state={state}
              isRunning={isRunning}
              compact
            />

            {/* Terminal Logs */}
            <SaturnTerminalLogs
              logs={state.logLines || []}
              isRunning={isRunning}
              reasoning={state.streamingReasoning}
              compact
            />

            {/* Radar */}
            <SaturnRadarCanvas
              state={state}
              isRunning={isRunning}
              compact
              model={model}
              setModel={setModel}
              temperature={temperature}
              setTemperature={setTemperature}
              reasoningEffort={reasoningEffort}
              setReasoningEffort={setReasoningEffort}
              onStart={onStart}
              onCancel={cancel}
            />

            {/* Work Table */}
            <SaturnWorkTable
              state={state}
              isRunning={isRunning}
              compact
            />
          </div>
        </div>
      </main>
    </div>
  );
}
