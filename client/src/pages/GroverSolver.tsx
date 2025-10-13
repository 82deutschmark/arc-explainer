/**
 * client/src/pages/GroverSolver.tsx
 * 
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Grover Iterative Solver page - shows real-time iteration progress,
 * code generation, execution results, and grading scores. Displays quantum-inspired
 * amplitude amplification process with best/worst program tracking.
 * 
 * SRP/DRY check: Pass - UI only, delegates to useGroverProgress hook
 * shadcn/ui: Pass - Uses shadcn components throughout
 */

import React from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, ArrowLeft, Rocket, Settings, Brain, XCircle } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useGroverProgress } from '@/hooks/useGroverProgress';
import GroverModelSelect, { type GroverModelKey } from '@/components/grover/GroverModelSelect';
import { IterationCard } from '@/components/grover/IterationCard';
import { LiveActivityStream } from '@/components/grover/LiveActivityStream';
import { SearchVisualization } from '@/components/grover/SearchVisualization';
import { CollapsibleCard } from '@/components/ui/collapsible-card';

export default function GroverSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel, sessionId } = useGroverProgress(taskId);
  const [model, setModel] = React.useState<GroverModelKey>('grover-gpt-5-nano');
  const [startTime, setStartTime] = React.useState<Date | null>(null);
  const [temperature, setTemperature] = React.useState(0.2);
  const [reasoningEffort, setReasoningEffort] = React.useState<'minimal' | 'low' | 'medium' | 'high'>('medium');
  const [reasoningVerbosity, setReasoningVerbosity] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [reasoningSummaryType, setReasoningSummaryType] = React.useState<'auto' | 'detailed'>('auto');

  // Set page title
  React.useEffect(() => {
    document.title = taskId ? `Grover Solver - ${taskId}` : 'Grover Iterative Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  // Track start time
  React.useEffect(() => {
    if (state.status === 'running' && !startTime) {
      setStartTime(new Date());
    } else if (state.status !== 'running') {
      setStartTime(null);
    }
  }, [state.status, startTime]);

  // Force re-render for timer AND poll for updates
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (isRunning) {
      // Update every second for timer + force React to check state changes
      const interval = setInterval(() => {
        setTick(tick => tick + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div role="alert" className="alert alert-error">
          <span>Invalid puzzle ID</span>
        </div>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle…</span>
          </div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div role="alert" className="alert alert-error">
          <span>Failed to load puzzle: {taskError?.message || 'Puzzle not found'}</span>
        </div>
      </div>
    );
  }

  const onStart = () => start({
    modelKey: model,
    temperature: temperature,
    maxIterations: 5, // This can be made dynamic later if needed
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
  });

  const getElapsedTime = () => {
    if (!startTime) return null;
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-3 max-w-6xl">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link href={`/puzzle/${taskId}`}>
            <button 
              className="btn btn-outline btn-sm hover:bg-gray-100 hover:border-gray-400 shadow-sm transition-all hover:shadow-md"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="font-medium">Back</span>
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">Grover Solver</h1>
              <a 
                href="https://github.com/zoecarver/grover-arc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 hover:from-purple-200 hover:to-blue-200 rounded-full border-2 border-purple-400 hover:border-purple-500 transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 text-purple-900" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                <span className="text-xs font-bold text-purple-900">by Zoe Carver</span>
              </a>
            </div>
            <p className="text-xs text-gray-600">{taskId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <GroverModelSelect value={model} onChange={setModel} disabled={isRunning} />
          {isRunning ? (
            <button 
              onClick={cancel}
              className="btn btn-error btn-lg flex items-center gap-2 font-bold shadow-lg hover:shadow-xl transition-all px-6"
            >
              <XCircle className="h-5 w-5" />
              Cancel
            </button>
          ) : (
            <button 
              onClick={onStart} 
              className="btn btn-primary btn-lg flex items-center gap-2 font-bold shadow-lg hover:shadow-xl transition-all px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Rocket className="h-5 w-5" />
              Start Grover Search
            </button>
          )}
        </div>
      </div>

      {/* Advanced Controls */}
      <CollapsibleCard
        title="Advanced Controls"
        icon={Settings}
        defaultOpen={false}
        headerDescription={
          <p className="text-sm text-gray-600">Fine-tune model behavior with advanced parameters</p>
        }
      >
        <div className="space-y-3 p-2">
            {/* Temperature Control */}
            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
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
                    disabled={isRunning}
                  />
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  <div>Controls creativity/randomness</div>
                  <div className="text-blue-600">💡 Affects code generation diversity</div>
                </div>
              </div>
            </div>

            {/* GPT-5 Reasoning Parameters */}
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
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
                      disabled={isRunning}
                    >
                      <option value="minimal">Minimal</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
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
                      disabled={isRunning}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
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
                      disabled={isRunning}
                    >
                      <option value="auto">Auto</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </div>
                </div>
              </div>
        </div>
      </CollapsibleCard>

      {/* Visual Status Panel */}
      {isRunning && (
        <div className="card mb-3 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 shadow">
          <div className="card-body p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="relative">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-800">{state.iteration || 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-blue-900">
                    {state.phase === 'initializing' && '🔄 Initializing'}
                    {state.phase === 'iteration_start' && '🔁 Starting Iteration'}
                    {state.phase === 'prompt_ready' && '📤 Sending Prompt'}
                    {state.phase === 'waiting_llm' && '⏳ Waiting for AI Response'}
                    {state.phase === 'response_received' && '✅ Response Received'}
                    {state.phase === 'programs_extracted' && '📝 Extracting Programs'}
                    {state.phase === 'execution' && '🐍 Executing Programs'}
                    {state.phase === 'iteration_complete' && '🎯 Iteration Complete'}
                    {state.phase === 'finalizing' && '✨ Finalizing Results'}
                    {state.phase === 'complete' && '🎉 Complete!'}
                    {!state.phase && 'Processing...'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="badge badge-outline text-xs">
                      Iteration {state.iteration}/{state.totalIterations || 5}
                    </div>
                    {state.bestScore !== undefined && (
                      <div className="badge bg-green-600 text-xs">
                        Best: {state.bestScore.toFixed(1)}/10
                      </div>
                    )}
                    {startTime && (
                      <div className="badge badge-outline text-xs">{getElapsedTime()}</div>
                    )}
                  </div>
                </div>
                {state.message && (
                  <p className="text-sm text-gray-700 mb-2">{state.message}</p>
                )}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 transition-all duration-500 ease-out"
                    style={{ width: `${((state.iteration || 0) / (state.totalIterations || 5)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Status Bar (when not running) */}
      {!isRunning && (
        <div className="mb-2 p-2 bg-gray-50 rounded border flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className={`badge text-xs py-0 ${isDone ? '' : hasError ? 'badge-error' : 'badge-secondary'}`}>
              {state.status}
            </div>
            {state.bestScore !== undefined && (
              <div className="badge bg-green-600 text-xs py-0">
                Best: {state.bestScore.toFixed(1)}/10
              </div>
            )}
          </div>
        </div>
      )}

      {/* Three Column Layout - Compact & Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
        {/* LEFT: Iteration Cards - 50% width */}
        <div className="lg:col-span-6 space-y-0">
          {Array.from({ length: state.totalIterations || 5 }).map((_, idx) => {
            const iterNum = idx + 1;
            const iterData = state.iterations?.find(it => it.iteration === idx);
            const isActive = isRunning && state.iteration === iterNum;
            
            const bestOverall = state.iterations
              ?.filter(it => it.iteration < idx)
              .reduce((max, it) => Math.max(max, it.best?.score || 0), 0) || 0;
            
            return (
              <IterationCard
                key={iterNum}
                iteration={iterNum}
                data={iterData}
                isActive={isActive}
                phase={isActive ? state.phase : undefined}
                message={isActive ? state.message : undefined}
                bestOverall={bestOverall > 0 ? bestOverall : undefined}
                promptPreview={isActive ? state.promptPreview : undefined}
                conversationChain={isActive ? state.conversationChain : undefined}
                tokenUsage={isActive ? state.tokenUsage : undefined}
              />
            );
          })}
        </div>

        {/* MIDDLE: Live Activity Stream - 25% width, compact */}
        <div className="lg:col-span-3">
          {(isRunning || (state.logLines && state.logLines.length > 0)) ? (
            <LiveActivityStream
              logs={state.logLines || []}
              maxHeight="500px"
            />
          ) : (
            <div className="card h-32 flex items-center justify-center text-gray-400 text-sm bg-base-100 shadow">
              Start analysis to see live progress
            </div>
          )}
        </div>

        {/* RIGHT: Visualizations - 25% width */}
        <div className="lg:col-span-3 space-y-3">
          {state.iterations && state.iterations.length > 0 && (
            <SearchVisualization 
              iterations={state.iterations}
              currentIteration={state.iteration}
            />
          )}
        </div>
      </div>
    </div>
  );
}
