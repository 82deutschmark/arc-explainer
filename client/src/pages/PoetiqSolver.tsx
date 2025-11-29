/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-28 - BYO Key requirement (no server fallback)
 * PURPOSE: Poetiq Iterative Code-Generation Solver page.
 *          Single horizontal control bar at top, full-width content below.
 *          Controls disappear when running to maximize output visibility.
 * 
 * SRP/DRY check: Pass - UI orchestration, delegates to specialized components
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, Square, ChevronDown, ChevronUp, Activity, Timer, Layers, Copy, Check, Rocket, Key, Eye, EyeOff, Code2, Server, Brain, ListTree, FileJson, ScrollText, Coins } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { usePoetiqModels, type PoetiqModelOption } from '@/hooks/usePoetiqModels';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';

// Poetiq components
import PoetiqPythonTerminal from '@/components/poetiq/PoetiqPythonTerminal';

export default function PoetiqSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = usePoetiqProgress(taskId);
  
  // Configuration state - Solver page allows any provider/model
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'openai'>('openai');
  const [model, setModel] = useState('gpt-5.1-codex-mini');
  const [numExperts, setNumExperts] = useState(8);  // Default to 8 experts for best accuracy
  const [maxIterations, setMaxIterations] = useState(10);
  const [temperature, setTemperature] = useState(1.0);
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [executions, setExecutions] = useState<any[]>([]);
  const [autoStartTriggered, setAutoStartTriggered] = useState(false);
  const [cameFromCommunity, setCameFromCommunity] = useState(false);
  const [showLogs, setShowLogs] = useState(true);  // Show event log panel
  const [copied, setCopied] = useState(false);  // For copy button feedback
  const eventLogRef = useRef<HTMLDivElement>(null);  // For auto-scroll
  // showApiKey state removed - BYO key input always visible since it's required
  const [showPromptInspector, setShowPromptInspector] = useState(false);  // Toggle prompt inspector visibility
  const [showReasoningTraces, setShowReasoningTraces] = useState(false);  // Toggle reasoning traces visibility
  const [showPromptTimeline, setShowPromptTimeline] = useState(false);
  const [showRawEvents, setShowRawEvents] = useState(false);
  const [showReasoningStream, setShowReasoningStream] = useState(false);
  
  // Fetch available models for dropdown
  const { data: models = [], isLoading: modelsLoading } = usePoetiqModels();
  const selectedModel = models.find((m) => m.id === model) ?? null;
  const requiresByo = selectedModel?.requiresBYO ?? false;
  
  // Timing state for visibility
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Set page title
  useEffect(() => {
    document.title = taskId ? `Poetiq Solver - ${taskId}` : 'Poetiq Solver';
  }, [taskId]);

  // Check for auto-start config from community page (sessionStorage)
  useEffect(() => {
    if (autoStartTriggered) return; // Don't re-trigger
    
    try {
      const savedConfig = sessionStorage.getItem('poetiq_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        // Clear it immediately so refresh doesn't re-trigger
        sessionStorage.removeItem('poetiq_config');
        
        // Apply saved config
        if (config.apiKey) setApiKey(config.apiKey);
        if (config.provider) setProvider(config.provider);
        if (config.model) setModel(config.model);
        if (config.numExperts) setNumExperts(config.numExperts);
        if (config.temperature) setTemperature(config.temperature);
        
        // Determine if this configuration actually requires a BYO key
        const lowerModel = (config.model || '').toLowerCase();
        const requiresByoFromConfig =
          config.routing === 'openrouter' ||
          config.provider === 'gemini' ||
          lowerModel.startsWith('openrouter/') ||
          lowerModel.startsWith('gemini/');

        const shouldAutoStart =
          config.autoStart &&
          !!task &&
          (!requiresByoFromConfig || !!config.apiKey);

        if (shouldAutoStart) {
          setAutoStartTriggered(true);
          setCameFromCommunity(true);
          // Controls are now always visible
          
          // Small delay to let state settle
          setTimeout(() => {
            start({
              apiKey: config.apiKey || '', // Empty string uses server key
              model: config.model,
              numExperts: config.numExperts || 2,
              maxIterations: 10,
              temperature: config.temperature || 1.0,
            });
          }, 500);
        }
      }
    } catch (e) {
      console.error('Failed to parse poetiq_config:', e);
    }
  }, [task, autoStartTriggered, start]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  const hasApiKey = apiKey.trim().length > 0;
  const requiresApiKey = requiresByo;
  const promptTimeline = state.promptTimeline ?? [];
  const reasoningHistory = state.reasoningHistory ?? [];
  const rawEvents = state.rawEvents ?? [];
  const latestPromptTimeline = promptTimeline.slice(-20);
  const latestReasoningHistory = reasoningHistory.slice(-20);
  const latestRawEvents = rawEvents.slice(-20);
  const tokenUsage = state.tokenUsage ?? state.result?.tokenUsage ?? null;
  const costData = state.cost ?? state.result?.cost ?? null;
  const aggregatedExpertStats = useMemo(() => {
    const stats: Record<string, { tokens?: any; cost?: any }> = {};
    const tokenSource = state.expertTokenUsage ?? {};
    const costSource = state.expertCost ?? {};
    Object.entries(tokenSource).forEach(([key, value]) => {
      stats[key] = { ...(stats[key] ?? {}), tokens: value };
    });
    Object.entries(costSource).forEach(([key, value]) => {
      stats[key] = { ...(stats[key] ?? {}), cost: value };
    });
    if (Object.keys(stats).length === 0 && state.result?.expertBreakdown) {
      Object.entries(state.result.expertBreakdown).forEach(([key, value]) => {
        stats[key] = {
          tokens: (value as any).tokens,
          cost: (value as any).cost,
        };
      });
    }
    return stats;
  }, [state.expertTokenUsage, state.expertCost, state.result]);
  const hasExpertStats = Object.keys(aggregatedExpertStats).length > 0;
  const formatTokens = (value?: number) => (value ?? 0).toLocaleString();
  const formatCost = (value?: number) => `$${(value ?? 0).toFixed(4)}`;

  // Track start time when solver begins
  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(new Date());
      setLastUpdateTime(new Date());
    }
    if (!isRunning && (isDone || hasError)) {
      // Keep the final elapsed time, don't reset
    }
  }, [isRunning, isDone, hasError, startTime]);

  // Update elapsed time every second while running
  useEffect(() => {
    if (!isRunning || !startTime) return;
    
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Track last update time when state changes
  useEffect(() => {
    if (isRunning && (state.message || state.phase || state.iteration)) {
      setLastUpdateTime(new Date());
    }
  }, [state.message, state.phase, state.iteration, isRunning]);

  // Clear executions on new run
  useEffect(() => {
    if (isRunning) {
      setExecutions([]);
    }
  }, [isRunning]);

  // Auto-scroll event log to bottom when new events arrive
  useEffect(() => {
    if (eventLogRef.current && state.logLines?.length) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [state.logLines]);

  // Track iteration results for Python terminal
  useEffect(() => {
    if (state.iteration !== undefined && isRunning) {
      setExecutions(prev => {
        // Determine expert ID (default to 1 if missing)
        const expertId = (state as any).expert;
        
        // Check if we already have an entry for this iteration/expert
        const existingIndex = prev.findIndex(e => 
          e.iteration === state.iteration && 
          e.expert === expertId
        );
        
        const trainResults = state.result?.trainResults;
        const success = trainResults ? trainResults.every((r: any) => r.success) : false;
        const trainScore = trainResults ? trainResults.filter((r: any) => r.success).length / trainResults.length : undefined;

        const newExec = {
          iteration: state.iteration,
          expert: expertId,
          success,
          trainScore,
          trainResults,
          output: state.message,
          code: state.result?.generatedCode,
          error: state.status === 'error' ? state.message : undefined
        };

        if (existingIndex >= 0) {
          // Update existing entry
          const newPrev = [...prev];
          newPrev[existingIndex] = {
            ...newPrev[existingIndex],
            ...newExec,
            // Preserve code if current update doesn't have it but previous did
            code: newExec.code || newPrev[existingIndex].code, 
          };
          return newPrev;
        } else {
          // Append new entry
          return [...prev, newExec];
        }
      });
    }
  }, [state.iteration, state.message, isRunning, (state as any).expert, state.result?.trainResults, state.status]);

  const handleStart = () => {
    // Solver page allows any provider/model selection
    start({
      apiKey,
      model,
      numExperts,
      maxIterations,
      temperature,
      reasoningEffort,
    });
    // Reset timing on new run
    setStartTime(null);
    setElapsedSeconds(0);
  };

  // Format elapsed time as MM:SS or HH:MM:SS
  const formatElapsed = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format last update as relative time
  const formatLastUpdate = () => {
    if (!lastUpdateTime) return 'Never';
    const secondsAgo = Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000);
    if (secondsAgo < 5) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  // Loading states
  if (!taskId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded shadow">
          <p className="text-red-600">Invalid puzzle ID</p>
          <Link href="/poetiq" className="text-blue-600 hover:text-blue-800 text-sm mt-2 block">← Back to Community</Link>
        </div>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span>Loading puzzle {taskId}...</span>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded shadow">
          <p className="text-red-600">Failed to load puzzle: {taskError?.message || 'Not found'}</p>
          <Link href="/poetiq" className="text-blue-600 hover:text-blue-800 text-sm mt-2 block">← Back to Community</Link>
        </div>
      </div>
    );
  }

  // For result display when done
  const resultSummary = isDone && state.result ? {
    success: state.result.isPredictionCorrect,
    code: state.result.generatedCode,
    iterations: state.result.iterationCount,
    trainScore: state.result.bestTrainScore,
  } : null;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header - Informative with clear status */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
        {/* Left: Title + Explanation */}
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold">Poetiq Meta-System</h1>
            <p className="text-sm text-indigo-300 font-mono">{taskId}</p>
          </div>
          <div className="h-8 w-px bg-indigo-600" />
          {/* Explanatory text - always visible */}
          <div className="max-w-md text-sm text-indigo-200">
            {isRunning ? (
              <span>
                <strong className="text-white">{numExperts} AI experts</strong> are generating Python code in parallel. 
                Each expert iterates until the code solves all training examples, then applies it to the test case.
              </span>
            ) : isDone ? (
              <span>
                Solver finished. The generated code was tested against the puzzle's test case.
              </span>
            ) : (
              <span>
                Click <strong className="text-white">Start</strong> to run {numExperts} AI experts in parallel. 
                Each expert generates Python code, tests it, and iterates until it solves the puzzle.
              </span>
            )}
          </div>
        </div>
        
        {/* Right side: Status + Metrics + Controls */}
        <div className="flex items-center gap-4">
          {/* Provider Badge - Shows if using Direct API or OpenRouter */}
          {(isRunning || isDone) && state.currentPromptData?.provider && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10" title={`API: ${state.currentPromptData.apiStyle || 'Unknown'}`}>
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">
                {state.currentPromptData.provider === 'OpenAI' ? (
                  <span className="text-green-400">🔗 Direct OpenAI</span>
                ) : state.currentPromptData.provider === 'OpenRouter' ? (
                  <span className="text-amber-400">🔀 OpenRouter</span>
                ) : (
                  <span className="text-blue-400">{state.currentPromptData.provider}</span>
                )}
              </span>
              {state.currentPromptData.apiStyle && (
                <span className="text-xs text-indigo-300">({state.currentPromptData.apiStyle})</span>
              )}
            </div>
          )}
          
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : isDone ? 'bg-blue-400' : hasError ? 'bg-red-400' : 'bg-gray-400'}`} />
            <span className="font-medium">
              {isRunning ? 'RUNNING' : isDone ? 'DONE' : hasError ? 'ERROR' : 'READY'}
            </span>
          </div>
          
          {/* Metrics - only show when running/done */}
          {(isRunning || isDone) && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 rounded bg-white/10" title="Current iteration out of maximum iterations per expert">
                <Layers className="h-5 w-5 text-indigo-300" />
                <span className="font-mono text-sm">
                  Iteration {state.iteration ?? 0} of {state.totalIterations ?? maxIterations}
                </span>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 rounded bg-white/10" title="Elapsed time">
                <Timer className="h-5 w-5 text-indigo-300" />
                <span className="font-mono">{formatElapsed(elapsedSeconds)}</span>
              </div>
            </>
          )}
          
          {/* Start/Stop Button */}
          {isRunning ? (
            <button onClick={cancel} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 transition-colors font-bold">
              <Square className="h-5 w-5" />
              Stop
            </button>
          ) : !isDone && (
            <button 
              onClick={handleStart} 
              disabled={requiresApiKey && !hasApiKey}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-colors ${
                !requiresApiKey || hasApiKey
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              title={requiresApiKey && !hasApiKey ? 'Enter your API key to start' : 'Start the Poetiq solver'}
            >
              <Rocket className="h-5 w-5" />
              {requiresApiKey && !hasApiKey ? 'Need API Key' : 'Start'}
            </button>
          )}
        </div>
      </header>

      {/* Horizontal Control Bar - Only show when NOT running */}
      {!isRunning && !isDone && (
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Model Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Model:</label>
              {modelsLoading ? (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="select select-bordered select-xs text-xs min-w-[180px]"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Experts */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Experts:</label>
              <select
                value={numExperts}
                onChange={(e) => setNumExperts(parseInt(e.target.value))}
                className="select select-bordered select-xs text-xs w-20"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={8}>8</option>
              </select>
            </div>

            {/* Max Iterations */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Max Iter:</label>
              <input
                type="number"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 10)}
                className="input input-bordered input-xs text-xs w-16 text-center"
                min={1}
                max={50}
              />
            </div>

            {/* Temperature */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Temp:</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value) || 1.0)}
                className="input input-bordered input-xs text-xs w-16 text-center"
                min={0.1}
                max={2.0}
                step={0.1}
              />
            </div>

            {/* Bring Your Own Key - Required for Gemini/OpenRouter, optional for direct OpenAI */}
            <div className={`flex items-center gap-2 px-2 py-1 rounded border ${
              requiresApiKey
                ? hasApiKey
                  ? 'bg-green-50 border-green-300'
                  : 'bg-amber-50 border-amber-300'
                : hasApiKey
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-300'
            }`}>
              <Key className={`h-3.5 w-3.5 ${
                requiresApiKey
                  ? hasApiKey ? 'text-green-600' : 'text-amber-600'
                  : hasApiKey ? 'text-green-600' : 'text-gray-500'
              }`} />
              <span className={`text-xs font-medium ${
                requiresApiKey
                  ? hasApiKey ? 'text-green-700' : 'text-amber-700'
                  : hasApiKey ? 'text-green-700' : 'text-gray-700'
              }`}>
                {requiresApiKey
                  ? hasApiKey
                    ? 'BYO Key Set'
                    : 'BYO Key Required (Gemini/OpenRouter)'
                  : hasApiKey
                    ? 'Optional BYO Key Set'
                    : 'BYO Key Optional (server key used if configured)'}
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key..."
                className={`input input-bordered input-xs text-xs w-36 font-mono ${requiresApiKey && !hasApiKey && 'input-warning'}`}
              />
            </div>

            {/* Prompt Inspector Toggle */}
            {(isRunning || isDone || state.promptHistory?.length) && (
              <button
                onClick={() => setShowPromptInspector(!showPromptInspector)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                  showPromptInspector 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {showPromptInspector ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                Prompts
              </button>
            )}

            {/* Reasoning Traces Toggle - Only show when we have summaries (GPT-5.x) */}
            {(state.reasoningSummaryHistory?.length ?? 0) > 0 && (
              <button
                onClick={() => setShowReasoningTraces(!showReasoningTraces)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                  showReasoningTraces 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Brain className="h-3 w-3" />
                Reasoning ({state.reasoningSummaryHistory?.length})
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Puzzle preview thumbnails */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{task.train.length} train</span>
              <span>•</span>
              <span>{task.test.length} test</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Two-column layout, full width */}
      <main className="flex-1 overflow-hidden p-4">
        <div className="h-full grid grid-cols-12 gap-4">
          {/* LEFT: Iteration Progress (5 cols normally, 4 when running) */}
          <div className={`${isRunning || isDone ? 'col-span-4' : 'col-span-5'} overflow-y-auto`}>
            {/* Error Display - Including API key required error */}
            {hasError && state.message && (
              <div className="bg-red-50 border border-red-300 rounded px-4 py-2 text-sm text-red-800 mb-3">
                <strong>Error:</strong> {state.message}
              </div>
            )}
            
            <PoetiqPythonTerminal
              executions={executions}
              currentCode={isRunning ? state.result?.generatedCode : undefined}
              isRunning={isRunning}
            />

            {/* Final Result - Show ONLY when completed */}
            {isDone && resultSummary && (
              <div className="mt-3">
                <div className={`bg-white border-2 rounded p-4 ${
                  resultSummary.success ? 'border-green-500' : 'border-red-500'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      resultSummary.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      <span className="text-2xl">{resultSummary.success ? '✓' : '✗'}</span>
                    </div>
                    <div>
                      <div className={`text-xl font-bold ${
                        resultSummary.success ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {resultSummary.success ? 'PUZZLE SOLVED!' : 'NOT SOLVED'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {resultSummary.iterations} iterations
                        {resultSummary.trainScore !== undefined && ` • ${(resultSummary.trainScore * 100).toFixed(0)}% train accuracy`}
                      </div>
                    </div>
                  </div>
                  {resultSummary.code && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Generated Code:</h4>
                      <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-64">
                        {resultSummary.code}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Training Grids (before running) or Event Log (during/after running) */}
          <div className={`${isRunning || isDone ? 'col-span-8' : 'col-span-7'} flex flex-col min-h-0`}>
            {/* Training Grids - Show before running */}
            {!isRunning && !isDone && task && (
              <div className="bg-white border border-gray-300 rounded flex-1 min-h-0 flex flex-col h-full overflow-y-auto">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-300 sticky top-0">
                  <span className="text-base font-bold text-gray-700">Training Examples</span>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto">
                  {task.train.map((example, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="text-xs text-gray-500 font-medium">Example {idx + 1}</div>
                      <div className="flex gap-3 items-start">
                        <div className="border border-gray-300 rounded p-2 bg-gray-50">
                          <PuzzleGrid
                            grid={example.input}
                            title="Input"
                            compact
                            maxWidth={200}
                            maxHeight={200}
                            showEmojis={false}
                            showColorOnly={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                          />
                        </div>
                        <div className="text-gray-400 text-lg leading-none mt-2">→</div>
                        <div className="border border-gray-300 rounded p-2 bg-gray-50">
                          <PuzzleGrid
                            grid={example.output}
                            title="Output"
                            compact
                            maxWidth={200}
                            maxHeight={200}
                            showEmojis={false}
                            showColorOnly={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Inspector - Shows what's being sent to the AI */}
            {showPromptInspector && state.currentPromptData && (
              <div className="bg-white border border-purple-300 rounded mb-3 max-h-64 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-purple-50 border-b border-purple-300 sticky top-0">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-bold text-purple-700">PROMPT INSPECTOR</span>
                    <span className="text-xs text-purple-500">(Iteration {state.iteration || 1})</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {state.currentPromptData.provider && (
                      <span className={`px-2 py-0.5 rounded ${
                        state.currentPromptData.provider === 'OpenAI' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {state.currentPromptData.provider}
                      </span>
                    )}
                    {state.currentPromptData.apiStyle && (
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        {state.currentPromptData.apiStyle}
                      </span>
                    )}
                    {state.currentPromptData.reasoningParams?.effort && state.currentPromptData.reasoningParams.effort !== 'default' && (
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                        Reasoning: {state.currentPromptData.reasoningParams.effort}
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto p-3 text-xs font-mono bg-gray-50 flex-1">
                  {/* User Prompt (most important - show first) */}
                  <div className="mb-3">
                    <div className="text-purple-600 font-bold mb-1">User Prompt (sent to AI):</div>
                    <pre className="bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-gray-800">
                      {state.currentPromptData.userPrompt?.substring(0, 2000) || 'No user prompt'}
                      {state.currentPromptData.userPrompt && state.currentPromptData.userPrompt.length > 2000 && '...'}
                    </pre>
                  </div>
                  {/* System Prompt */}
                  <details className="mb-2">
                    <summary className="text-purple-600 font-bold cursor-pointer hover:text-purple-800">System Prompt (click to expand)</summary>
                    <pre className="bg-white border border-gray-200 rounded p-2 mt-1 whitespace-pre-wrap overflow-x-auto max-h-24 overflow-y-auto text-gray-600">
                      {state.currentPromptData.systemPrompt || 'No system prompt'}
                    </pre>
                  </details>
                  {/* Model & Config */}
                  <div className="text-gray-500 mt-2">
                    <span className="font-bold">Model:</span> {state.currentPromptData.model} • 
                    <span className="font-bold"> Temp:</span> {state.currentPromptData.temperature}
                    {state.currentPromptData.reasoningParams?.verbosity && state.currentPromptData.reasoningParams.verbosity !== 'default' && (
                      <span> • <span className="font-bold">Verbosity:</span> {state.currentPromptData.reasoningParams.verbosity}</span>
                    )}
                    {state.currentPromptData.reasoningParams?.summary && state.currentPromptData.reasoningParams.summary !== 'default' && (
                      <span> • <span className="font-bold">Summary:</span> {state.currentPromptData.reasoningParams.summary}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Reasoning Traces - Chain-of-thought summaries from GPT-5.x Responses API */}
            {showReasoningTraces && (state.reasoningSummaryHistory?.length ?? 0) > 0 && (
              <div className="bg-white border border-amber-300 rounded mb-3 max-h-64 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-300 sticky top-0">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-700">REASONING TRACES</span>
                    <span className="text-xs text-amber-500">({state.reasoningSummaryHistory?.length} summaries)</span>
                  </div>
                  <span className="text-xs text-amber-600">GPT-5.x chain-of-thought</span>
                </div>
                <div className="overflow-y-auto p-3 text-xs font-mono bg-amber-50/50 flex-1 space-y-3">
                  {state.reasoningSummaryHistory?.map((summary, idx) => (
                    <div key={idx} className="bg-white border border-amber-200 rounded p-3">
                      <div className="text-amber-700 font-bold text-xs mb-1">
                        {summary.match(/^\[.*?\]/)?.[0] || `Summary ${idx + 1}`}
                      </div>
                      <pre className="whitespace-pre-wrap text-gray-700 text-xs leading-relaxed">
                        {summary.replace(/^\[.*?\]\s*/, '')}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Event Log - Show when running or after completion */}
            {(isRunning || isDone || (state.logLines?.length ?? 0) > 0) && (
              <div className="bg-white border border-gray-300 rounded flex-1 min-h-0 flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-300">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-gray-600" />
                    <span className="text-base font-bold text-gray-700">EVENT LOG</span>
                    <span className="text-sm text-gray-500">({state.logLines?.length ?? 0} events)</span>
                    {isRunning && (
                      <span className="text-sm text-green-600 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Copy Button */}
                    <button
                      onClick={() => {
                        const text = state.logLines?.join('\n') || '';
                        navigator.clipboard.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium transition-colors"
                      title="Copy all events"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={() => setShowLogs(!showLogs)} className="p-1.5 rounded hover:bg-gray-200">
                      {showLogs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {showLogs && (
                  <div 
                    ref={eventLogRef}
                    className="flex-1 overflow-y-auto p-3 bg-gray-900 font-mono text-sm"
                  >
                    {state.logLines?.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">Waiting for events...</div>
                    ) : (
                      state.logLines?.map((line, idx) => (
                        <div key={idx} className="text-gray-300 py-1 border-b border-gray-800 last:border-0">
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
