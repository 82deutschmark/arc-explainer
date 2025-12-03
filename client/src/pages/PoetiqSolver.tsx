/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-12-03 - Migrated to SSE streaming, compact dashboard layout
 * PURPOSE: Poetiq Iterative Code-Generation Solver page.
 *          Single horizontal control bar at top, full-width content below.
 *          Compact data-dense layout with live SSE streaming.
 * 
 * SRP/DRY check: Pass - UI orchestration, delegates to specialized components
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, ChevronDown, ChevronUp, Activity, Timer, Layers, Copy, Check, Eye, EyeOff, Code2, Server, Brain, ListTree, FileJson, ScrollText, Coins, TerminalSquare, Download } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';

// Poetiq components
import PoetiqControlPanel from '@/components/poetiq/PoetiqControlPanel';
import PoetiqPythonTerminal from '@/components/poetiq/PoetiqPythonTerminal';
import PoetiqLiveDashboard from '@/components/poetiq/PoetiqLiveDashboard';
import PoetiqAgentsPanel from '@/components/poetiq/PoetiqAgentsRuntimePanel';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const PROMPT_ROLE_BADGES: Record<string, string> = {
  system: 'bg-gray-200 text-gray-700',
  user: 'bg-blue-100 text-blue-700',
  assistant: 'bg-green-100 text-green-700',
  developer: 'bg-purple-100 text-purple-700',
  tool: 'bg-amber-100 text-amber-700',
};

const getRoleBadgeClass = (role?: string) =>
  PROMPT_ROLE_BADGES[role ?? 'user'] ?? 'bg-slate-100 text-slate-700';

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
  const [promptStyle, setPromptStyle] = useState<'classic' | 'arc' | 'arc_de' | 'arc_ru' | 'arc_fr' | 'arc_tr'>('classic');
  const [useAgents, setUseAgents] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [autoStartTriggered, setAutoStartTriggered] = useState(false);
  const [cameFromCommunity, setCameFromCommunity] = useState(false);
  const [showLogs, setShowLogs] = useState(true);  // Show event log panel
  const [copied, setCopied] = useState(false);  // For copy button feedback
  const eventLogRef = useRef<HTMLDivElement>(null);  // For auto-scroll
  const [showPromptInspector, setShowPromptInspector] = useState(false);  // Toggle prompt inspector visibility
  const [showReasoningTraces, setShowReasoningTraces] = useState(false);  // Toggle reasoning traces visibility
  const [showPromptTimeline, setShowPromptTimeline] = useState(true);
  const [showRawEvents, setShowRawEvents] = useState(true);
  const [showReasoningStream, setShowReasoningStream] = useState(false);
  
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
        if (
          config.promptStyle === 'classic' ||
          config.promptStyle === 'arc' ||
          config.promptStyle === 'arc_de' ||
          config.promptStyle === 'arc_ru' ||
          config.promptStyle === 'arc_fr' ||
          config.promptStyle === 'arc_tr'
        ) {
          setPromptStyle(config.promptStyle);
        }
        
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
              promptStyle:
                config.promptStyle === 'classic' ||
                config.promptStyle === 'arc' ||
                config.promptStyle === 'arc_de' ||
                config.promptStyle === 'arc_ru' ||
                config.promptStyle === 'arc_fr' ||
                config.promptStyle === 'arc_tr'
                  ? config.promptStyle
                  : 'classic',
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

  const promptTimeline = state.promptTimeline ?? [];
  const promptHistory = state.promptHistory ?? [];
  const reasoningHistory = state.reasoningHistory ?? [];
  const rawEvents = state.rawEvents ?? [];
  const latestPromptTimeline = promptTimeline.slice(-20);
  const latestReasoningHistory = reasoningHistory.slice(-20);
  const latestRawEvents = rawEvents.slice(-20);
  const previousPromptForDiff =
    promptHistory.length > 1 ? promptHistory[promptHistory.length - 2] : undefined;

  const promptChangeSummary = useMemo(() => {
    const current = state.currentPromptData;
    const prev = previousPromptForDiff;
    if (!current || !prev) return null;

    const parts: string[] = [];
    const currentStats = current.stats || {};
    const prevStats = prev.stats || {};

    if (
      typeof currentStats.previousSolutionCount === 'number' ||
      typeof prevStats.previousSolutionCount === 'number'
    ) {
      const prevCount = prevStats.previousSolutionCount ?? 0;
      const currCount = currentStats.previousSolutionCount ?? 0;
      if (currCount !== prevCount) {
        const delta = currCount - prevCount;
        const dir = delta > 0 ? 'more' : 'fewer';
        parts.push(
          `Includes ${currCount} previous solution(s) (${dir} than last prompt by ${Math.abs(delta)}).`,
        );
      } else {
        parts.push(`Previous solution count unchanged at ${currCount}.`);
      }
    }

    if (
      typeof currentStats.userPromptChars === 'number' &&
      typeof prevStats.userPromptChars === 'number'
    ) {
      const deltaChars = currentStats.userPromptChars - prevStats.userPromptChars;
      if (deltaChars !== 0) {
        const dir = deltaChars > 0 ? 'longer' : 'shorter';
        parts.push(
          `User prompt is ${Math.abs(deltaChars)} characters ${dir} than last time.`,
        );
      }
    }

    const prevHasFeedback = !!(prev.feedbackSection && prev.feedbackSection.trim().length > 0);
    const currHasFeedback = !!(
      current.feedbackSection && current.feedbackSection.trim().length > 0
    );
    if (currHasFeedback && !prevHasFeedback) {
      parts.push('This is the first prompt that includes previous attempts and feedback.');
    } else if (!currHasFeedback && prevHasFeedback) {
      parts.push('This prompt no longer includes previous attempts/feedback.');
    }

    const prevMessageCount = prev.messages?.length ?? 0;
    const currMessageCount = current.messages?.length ?? 0;
    if (currMessageCount !== prevMessageCount) {
      parts.push(
        `Conversation now includes ${currMessageCount} turn(s) (was ${prevMessageCount}).`,
      );
    }

    if (!parts.length) return null;
    return parts;
  }, [state.currentPromptData, previousPromptForDiff]);
  const pythonLogLines = state.pythonLogLines ?? [];
  const tokenUsage = state.tokenUsage ?? state.result?.tokenUsage ?? null;
  const costData = state.cost ?? state.result?.cost ?? null;
  const formatTokens = (value?: number) => (value ?? 0).toLocaleString();
  const formatCost = (value?: number) => `$${(value ?? 0).toFixed(4)}`;
  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'N/A';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString();
  };
  const headerTokenSummary = tokenUsage
    ? `${formatTokens(tokenUsage.input_tokens)} in / ${formatTokens(tokenUsage.output_tokens)} out / ${formatTokens(tokenUsage.total_tokens)} total`
    : 'Collecting tokens...';
  const headerCostSummary = costData
    ? `${formatCost(costData.total)} total`
    : 'Collecting cost...';

  const isAgentsRuntime =
    state.currentPromptData?.apiStyle === 'openai_agents' ||
    !!state.agentModel;

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
      provider,
      model,
      numExperts,
      maxIterations,
      temperature,
      reasoningEffort,
      promptStyle,
      useAgentsSdk: useAgents,
    });
    // Reset timing on new run
    setStartTime(null);
    setElapsedSeconds(0);
  };

  const downloadTextFile = useCallback((filename: string, lines?: string[]) => {
    if (!lines || lines.length === 0) return;
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header - Informative with clear status */}
      <header className="flex flex-col gap-4 border-b border-indigo-900/30 bg-gradient-to-r from-indigo-900 to-purple-900 px-6 py-4 text-white shadow-lg md:flex-row md:items-center md:justify-between">
        {/* Left: Title + Explanation */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div>
            <h1 className="text-xl font-bold">Poetiq Meta-System</h1>
            <p className="text-sm text-indigo-300 font-mono">{taskId}</p>
          </div>
          <div className="hidden h-10 w-px bg-indigo-600/60 lg:block" />
          {/* Explanatory text - always visible */}
          <div className="max-w-xl text-sm text-indigo-200 space-y-1">
            {isRunning ? (
              <>
                <p>
                  <strong className="text-white">{numExperts} AI teammates</strong> are currently writing tiny Python
                  rules, testing them on the sample grids, and revising until the outputs match.
                </p>
                <p>We keep every promising idea and show you the winning code as soon as the hidden test agrees.</p>
              </>
            ) : isDone ? (
              <p>
                The run is complete, and the best rule (plus a short history of every expert) has been saved to your
                explanation library for future reference.
              </p>
            ) : (
              <>
                <p>
                  Click <strong className="text-white">Start</strong> to let {numExperts} AI coders compete. Each one
                  will propose code, test it, learn from mistakes, and vote on the final answer.
                </p>
                <p>When several coders land on the same answer, we count that as a stronger vote of confidence.</p>
              </>
            )}
          </div>
        </div>
        
        {/* Right side: Status + Metrics + Controls */}
        <div className="flex flex-wrap items-center gap-3">
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

            {(tokenUsage || costData) && (
              <div className="flex items-center gap-2 px-4 py-2 rounded bg-white/10" title="Live token and cost tracking">
                <Coins className="h-5 w-5 text-amber-200" />
                <div className="text-[11px] font-mono leading-tight">
                  <div>Tokens: {headerTokenSummary}</div>
                  <div>Cost: {headerCostSummary}</div>
                  </div>
                </div>
              )}
            </>
          )}
          
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-800">{task.train.length} train grids</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-800">{task.test.length} test grids</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(isRunning || isDone || (state.promptHistory?.length ?? 0) > 0) && (
              <Button
                type="button"
                size="sm"
                variant={showPromptInspector ? 'default' : 'outline'}
                onClick={() => setShowPromptInspector(prev => !prev)}
                className="flex items-center gap-1.5"
              >
                {showPromptInspector ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Prompts
              </Button>
            )}
            {(state.reasoningSummaryHistory?.length ?? 0) > 0 && (
              <Button
                type="button"
                size="sm"
                variant={showReasoningTraces ? 'default' : 'outline'}
                onClick={() => setShowReasoningTraces(prev => !prev)}
                className="flex items-center gap-1.5"
              >
                <Brain className="h-3.5 w-3.5" />
                Reasoning ({state.reasoningSummaryHistory?.length})
              </Button>
            )}
            {/* Timeline is now always visible when data exists; no toggle button */}
            {(isRunning || isDone || latestReasoningHistory.length > 0) && (
              <Button
                type="button"
                size="sm"
                variant={showReasoningStream ? 'default' : 'outline'}
                onClick={() => setShowReasoningStream(prev => !prev)}
                className="flex items-center gap-1.5"
              >
                <ScrollText className="h-3.5 w-3.5" />
                Stream ({latestReasoningHistory.length})
              </Button>
            )}
            {/* Raw events are now always visible when data exists; no toggle button */}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Control Panel - Hidden when running */}
          {!isRunning && !isDone && (
            <PoetiqControlPanel
              state={state}
              isRunning={isRunning}
              apiKey={apiKey}
              setApiKey={setApiKey}
              provider={provider}
              setProvider={setProvider}
              model={model}
              setModel={setModel}
              numExperts={numExperts}
              setNumExperts={setNumExperts}
              maxIterations={maxIterations}
              setMaxIterations={setMaxIterations}
              temperature={temperature}
              setTemperature={setTemperature}
              reasoningEffort={reasoningEffort}
              setReasoningEffort={setReasoningEffort}
              promptStyle={promptStyle}
              setPromptStyle={setPromptStyle}
              onStart={handleStart}
              onCancel={cancel}
              useAgents={useAgents}
              setUseAgents={setUseAgents}
            />
          )}

          {/* Cancel Button - Only when running */}
          {isRunning && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-sm font-medium text-red-700">
                Running with {numExperts} expert{numExperts > 1 ? 's' : ''} • {model}
              </span>
              <Button size="sm" variant="destructive" onClick={cancel} className="h-7">
                Cancel Run
              </Button>
            </div>
          )}

          {/* Training Examples - Tiny grids inline, hidden when running */}
          {!isRunning && !isDone && task && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
              <span className="text-xs font-semibold text-slate-500">Training:</span>
              {task.train.map((example, idx) => (
                <div key={idx} className="flex items-center gap-1 rounded border border-slate-100 bg-slate-50 p-1">
                  <div className="h-10 w-10">
                    <TinyGrid grid={example.input} />
                  </div>
                  <span className="text-slate-400">→</span>
                  <div className="h-10 w-10">
                    <TinyGrid grid={example.output} />
                  </div>
                </div>
              ))}
              <span className="text-xs font-semibold text-slate-500 ml-2">Test:</span>
              {task.test.map((example, idx) => (
                <div key={idx} className="flex items-center gap-1 rounded border border-amber-100 bg-amber-50 p-1">
                  <div className="h-10 w-10">
                    <TinyGrid grid={example.input} />
                  </div>
                  <span className="text-amber-400">→</span>
                  <div className="h-10 w-10 flex items-center justify-center text-amber-400 text-xs">?</div>
                </div>
              ))}
            </div>
          )}

          {/* Error Display */}
          {hasError && state.message && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>Error:</strong> {state.message}
            </div>
          )}

          {/* Live Dashboard - Shows when running or completed */}
          {(isRunning || isDone || state.status === 'error') && (
            <PoetiqLiveDashboard state={state} rawEvents={state.rawEvents} />
          )}

          {/* Agents Panel */}
          {isAgentsRuntime && (
            <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-sm">
              <PoetiqAgentsPanel state={state} />
            </div>
          )}

          {/* Two-column layout: Terminal + Logs */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: Terminal + Python Console */}
            <div className="space-y-4">
              <PoetiqPythonTerminal
                executions={executions}
                currentCode={isRunning ? state.result?.generatedCode : undefined}
                isRunning={isRunning}
              />

              {pythonLogLines.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <TerminalSquare className="w-4 h-4 text-slate-600" />
                      Python Console
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{pythonLogLines.length} lines</span>
                      <button
                        onClick={() => downloadTextFile(`poetiq-python-${taskId}.txt`, pythonLogLines)}
                        disabled={pythonLogLines.length === 0}
                        className="flex items-center gap-1.5 rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100">
                    {pythonLogLines.map((line, idx) => (
                      <div key={`${line}-${idx}`} className="border-b border-slate-800/60 pb-1 last:border-b-0 last:pb-0">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Result */}
              {isDone && resultSummary && (
                <div
                  className={`rounded-xl border-2 px-4 py-3 shadow-sm ${
                    resultSummary.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        resultSummary.success ? 'bg-white text-green-600' : 'bg-white text-red-600'
                      }`}
                    >
                      <span className="text-xl">{resultSummary.success ? '✓' : '✗'}</span>
                    </div>
                    <div>
                      <div
                        className={`text-lg font-bold ${
                          resultSummary.success ? 'text-green-800' : 'text-red-700'
                        }`}
                      >
                        {resultSummary.success ? 'SOLVED' : 'NOT SOLVED'}
                      </div>
                      <div className="text-xs text-slate-600">
                        {resultSummary.iterations} iter{resultSummary.trainScore !== undefined && ` • ${(resultSummary.trainScore * 100).toFixed(0)}% train`}
                      </div>
                    </div>
                  </div>
                  {resultSummary.code && (
                    <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-2 font-mono text-xs text-green-400">
                      {resultSummary.code}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Right: Inspectors and Logs */}
            <div className="space-y-4">

            {/* Prompt Inspector - Shows what's being sent to the AI */}
            {showPromptInspector && state.currentPromptData && (
              <div className="flex max-h-64 flex-col overflow-hidden rounded-2xl border border-purple-300 bg-white shadow-sm">
                <div className="sticky top-0 flex items-center justify-between border-b border-purple-200 bg-purple-50 px-4 py-2">
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
                  {/* Model & Config */}
                  <div className="text-gray-500 mt-2">
                    <span className="font-bold">Model:</span> {state.currentPromptData.model} 
                    <span className="font-bold"> Temp:</span> {state.currentPromptData.temperature}
                    {state.currentPromptData.reasoningParams?.verbosity && state.currentPromptData.reasoningParams.verbosity !== 'default' && (
                      <span> <span className="font-bold">Verbosity:</span> {state.currentPromptData.reasoningParams.verbosity}</span>
                    )}
                    {state.currentPromptData.reasoningParams?.summary && state.currentPromptData.reasoningParams.summary !== 'default' && (
                      <span> <span className="font-bold">Summary:</span> {state.currentPromptData.reasoningParams.summary}</span>
                    )}
                  </div>
                  {state.currentPromptData.messages?.length ? (
                    <div className="mt-3 space-y-2">
                      {state.currentPromptData.messages.map((msg, idx) => {
                        const metadata = (msg.metadata ?? {}) as Record<string, unknown>;
                        const iterationMeta =
                          typeof metadata.iteration === 'number' ? (metadata.iteration as number) : undefined;
                        const expertMeta =
                          typeof metadata.expert === 'number' ? (metadata.expert as number) : undefined;
                        const passMeta =
                          typeof metadata.trainPasses === 'number' ? (metadata.trainPasses as number) : undefined;
                        const totalMeta =
                          typeof metadata.trainTotal === 'number' ? (metadata.trainTotal as number) : undefined;
                        return (
                          <div key={`prompt-msg-${idx}`} className="bg-white border border-gray-200 rounded p-2">
                            <div className="flex items-center justify-between mb-1 text-[10px] text-gray-500">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${getRoleBadgeClass(
                                    msg.role,
                                  )}`}
                                >
                                  {(msg.label || msg.role || 'message').toString()}
                                </span>
                                {typeof iterationMeta === 'number' && <span>Iter {iterationMeta}</span>}
                                {typeof expertMeta === 'number' && <span>Exp {expertMeta}</span>}
                              </div>
                              {typeof passMeta === 'number' &&
                                typeof totalMeta === 'number' &&
                                totalMeta > 0 && (
                                  <span>
                                    {passMeta}/{totalMeta} pass
                                  </span>
                                )}
                            </div>
                            <pre className="whitespace-pre-wrap text-gray-800 max-h-32 overflow-y-auto">
                              {msg.content || '—'}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="text-purple-600 font-bold mb-1">User Prompt (sent to AI):</div>
                      <pre className="bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-gray-800">
                        {state.currentPromptData.userPrompt || 'No user prompt'}
                      </pre>
                    </div>
                  )}
                  {/* System Prompt */}
                  <details className="mb-2">
                    <summary className="text-purple-600 font-bold cursor-pointer hover:text-purple-800">System Prompt (click to expand)</summary>
                    <pre className="bg-white border border-gray-200 rounded p-2 mt-1 whitespace-pre-wrap overflow-x-auto max-h-24 overflow-y-auto text-gray-600">
                      {state.currentPromptData.systemPrompt || 'No system prompt'}
                    </pre>
                  </details>
                  {/* Quick Prompt Stats */}
                  {state.currentPromptData.stats && (
                    <div className="mt-1 text-[11px] text-gray-500 space-x-2">
                      {typeof state.currentPromptData.stats.systemPromptChars === 'number' && (
                        <span>System: {state.currentPromptData.stats.systemPromptChars} chars</span>
                      )}
                      {typeof state.currentPromptData.stats.userPromptChars === 'number' && (
                        <span>User: {state.currentPromptData.stats.userPromptChars} chars</span>
                      )}
                      {typeof state.currentPromptData.stats.previousSolutionCount === 'number' && (
                        <span>Prev solutions: {state.currentPromptData.stats.previousSolutionCount}</span>
                      )}
                    </div>
                  )}
                  {/* Problem / Feedback Sections */}
                  {state.currentPromptData.problemSection && (
                    <div className="mt-3">
                      <div className="text-purple-600 font-bold mb-1">Puzzle & examples section:</div>
                      <pre className="bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-gray-800">
                        {state.currentPromptData.problemSection}
                      </pre>
                    </div>
                  )}
                  {state.currentPromptData.feedbackSection && (
                    <div className="mt-3">
                      <div className="text-purple-600 font-bold mb-1">Previous attempts & feedback:</div>
                      <pre className="bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-gray-800">
                        {state.currentPromptData.feedbackSection}
                      </pre>
                    </div>
                  )}
                  {/* Change summary vs previous prompt */}
                  {promptChangeSummary && promptChangeSummary.length > 0 && (
                    <div className="mt-3 text-[11px] text-purple-700">
                      <div className="font-semibold uppercase tracking-wide mb-0.5">What changed since last prompt?</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {promptChangeSummary.map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {showPromptTimeline && (
              <div className="flex max-h-64 flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
                <div className="sticky top-0 flex items-center justify-between border-b border-indigo-200 bg-indigo-50 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <ListTree className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-bold text-indigo-700">PROMPT TIMELINE</span>
                    <span className="text-xs text-indigo-500">({latestPromptTimeline.length} entries)</span>
                  </div>
                </div>
                <div className="overflow-y-auto p-3 text-xs bg-slate-50 flex-1 space-y-2">
                  {latestPromptTimeline.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">Waiting for prompt data...</div>
                  ) : (
                    latestPromptTimeline.map((entry, idx) => (
                      <div key={`${entry.timestamp}-${idx}`} className="border border-indigo-100 rounded p-2 bg-white">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Iter {entry.iteration ?? 'N/A'}</span>
                            <span>Exp {entry.expert ?? 'N/A'}</span>
                          </div>
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                        {entry.prompt.messages?.length ? (
                          <div className="space-y-1 text-gray-700 font-mono">
                            {entry.prompt.messages.map((msg, msgIdx) => {
                              const metadata = (msg.metadata ?? {}) as Record<string, unknown>;
                              const passes =
                                typeof metadata.trainPasses === 'number'
                                  ? (metadata.trainPasses as number)
                                  : undefined;
                              const total =
                                typeof metadata.trainTotal === 'number'
                                  ? (metadata.trainTotal as number)
                                  : undefined;
                              return (
                                <div key={`${entry.timestamp}-${idx}-${msgIdx}`} className="border border-indigo-100 rounded p-1">
                                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${getRoleBadgeClass(
                                        msg.role,
                                      )}`}
                                    >
                                      {(msg.label || msg.role || 'message').toString()}
                                    </span>
                                    {typeof passes === 'number' &&
                                      typeof total === 'number' &&
                                      total > 0 && <span>{passes}/{total} pass</span>}
                                  </div>
                                  <pre className="whitespace-pre-wrap max-h-16 overflow-y-auto text-gray-700">
                                    {msg.content || '—'}
                                  </pre>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-gray-700 font-mono whitespace-pre-wrap max-h-16 overflow-y-auto">
                            {entry.prompt.userPrompt || 'No prompt'}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Reasoning Traces - Chain-of-thought summaries from GPT-5.x Responses API */}
            {showReasoningTraces && (state.reasoningSummaryHistory?.length ?? 0) > 0 && (
              <div className="flex max-h-64 flex-col overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-sm">
                <div className="sticky top-0 flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
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

            {showReasoningStream && (
              <div className="flex max-h-64 flex-col overflow-hidden rounded-2xl border border-blue-300 bg-white shadow-sm">
                <div className="sticky top-0 flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-700">LLM STREAM</span>
                    <span className="text-xs text-blue-500">({latestReasoningHistory.length} entries)</span>
                  </div>
                </div>
                <div className="overflow-y-auto p-3 text-xs font-mono bg-blue-50/40 flex-1 space-y-2">
                  {latestReasoningHistory.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">Waiting for reasoning output...</div>
                  ) : (
                    latestReasoningHistory.map((block, idx) => (
                      <pre key={`${block}-${idx}`} className="bg-white border border-blue-100 rounded p-2 whitespace-pre-wrap text-gray-700">
                        {block}
                      </pre>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {/* Event Log - Show when running or after completion */}
            {(isRunning || isDone || (state.logLines?.length ?? 0) > 0) && (
              <div className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-slate-600" />
                    <span className="text-base font-bold text-slate-800">EVENT LOG</span>
                    <span className="text-sm text-slate-500">({state.logLines?.length ?? 0} events)</span>
                    {isRunning && (
                      <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadTextFile(`poetiq-events-${taskId}.txt`, state.logLines)}
                      disabled={!state.logLines || state.logLines.length === 0}
                      className="flex items-center gap-1.5 rounded bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50"
                      title="Download full event log"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    {/* Copy Button */}
                    <button
                      onClick={() => {
                        const text = state.logLines?.join('\n') || '';
                        navigator.clipboard.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300"
                      title="Copy all events"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={() => setShowLogs(!showLogs)} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
                      {showLogs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {showLogs && (
                  <div 
                    ref={eventLogRef}
                    className="flex-1 overflow-y-auto bg-slate-950 p-3 font-mono text-sm"
                  >
                    {state.logLines?.length === 0 ? (
                      <div className="py-8 text-center text-slate-500">Waiting for events...</div>
                    ) : (
                      state.logLines?.map((line, idx) => (
                        <div key={idx} className="border-b border-slate-800 py-1 text-slate-200 last:border-0">
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {showRawEvents && (
              <div className="flex max-h-64 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-slate-700" />
                    <span className="text-sm font-bold text-slate-800">RAW EVENTS</span>
                    <span className="text-xs text-slate-500">({latestRawEvents.length} recent)</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 text-xs font-mono">
                  {latestRawEvents.length === 0 ? (
                    <div className="py-4 text-center text-slate-500">Waiting for events...</div>
                  ) : (
                    latestRawEvents.map((event, idx) => {
                      const payloadText = JSON.stringify(event.payload, null, 2);
                      const clippedPayload = payloadText.length > 1500 ? `${payloadText.slice(0, 1500)}...` : payloadText;
                      return (
                        <div key={`${event.timestamp}-${idx}`} className="rounded border border-slate-200 bg-white p-2">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-700">{event.type}</span>
                              {event.phase && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">{event.phase}</span>}
                            </div>
                            <span>{formatTimestamp(event.timestamp)}</span>
                          </div>
                          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-slate-100">
                            {clippedPayload}
                          </pre>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
