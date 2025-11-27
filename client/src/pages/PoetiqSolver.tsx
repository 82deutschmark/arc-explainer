/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-27 - Fixed nested anchors, added timing/event visibility
 * PURPOSE: Poetiq Iterative Code-Generation Solver page.
 *          EXACTLY matches Saturn's layout:
 *          - LEFT (4 cols): Control panel + puzzle grids
 *          - CENTER (5 cols): Token metrics + AI REASONING + AI OUTPUT streaming
 *          - RIGHT (3 cols): Python execution terminal (replaces image gallery)
 * 
 * SRP/DRY check: Pass - UI orchestration, delegates to specialized components
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, ArrowLeft, Square, ChevronDown, ChevronUp, Activity, Timer, Gauge, Layers, Copy, Check, Rocket } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';

// Poetiq components
import PoetiqControlPanel from '@/components/poetiq/PoetiqControlPanel';
import PoetiqPythonTerminal from '@/components/poetiq/PoetiqPythonTerminal';
import { PoetiqInfoCard } from '@/components/poetiq/PoetiqInfoCard';

export default function PoetiqSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = usePoetiqProgress(taskId);
  
  // Configuration state - Solver page allows any provider/model
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'openai'>('openrouter');
  const [model, setModel] = useState('openrouter/google/gemini-3-pro-preview');
  const [numExperts, setNumExperts] = useState(2);  // 1, 2, or 8 only (Gemini-3-a/b/c)
  const [maxIterations, setMaxIterations] = useState(10);
  const [temperature, setTemperature] = useState(1.0);
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [executions, setExecutions] = useState<any[]>([]);
  const [autoStartTriggered, setAutoStartTriggered] = useState(false);
  const [cameFromCommunity, setCameFromCommunity] = useState(false);
  const [showLogs, setShowLogs] = useState(true);  // Show event log panel
  const [copied, setCopied] = useState(false);  // For copy button feedback
  
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
        
        // Auto-start if configured and task is loaded
        // API key is optional - server falls back to project key
        if (config.autoStart && task) {
          setAutoStartTriggered(true);
          setCameFromCommunity(true);
          // Controls are now always visible
          
          // Small delay to let state settle
          setTimeout(() => {
            const poetiqProvider = config.provider === 'openai' ? 'openrouter' : config.provider;
            start({
              apiKey: config.apiKey || '', // Empty string uses server key
              provider: poetiqProvider,
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
    // Cast provider for hook (which expects gemini|openrouter)
    const poetiqProvider = provider === 'openai' ? 'openrouter' : provider;
    start({
      apiKey,
      provider: poetiqProvider,
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
      {/* Header - Spacious with inline controls when not running */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
        <div className="flex items-center gap-6">
          <Link href="/poetiq" className="flex items-center gap-2 text-indigo-200 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Link>
          <div className="h-8 w-px bg-indigo-600" />
          <div>
            <h1 className="text-xl font-bold">Poetiq Meta-System</h1>
            <p className="text-sm text-indigo-300 font-mono">{taskId}</p>
          </div>
        </div>
        
        {/* Right side: Status + Metrics + Controls */}
        <div className="flex items-center gap-6">
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
              <div className="flex items-center gap-2 px-4 py-2 rounded bg-white/10">
                <Layers className="h-5 w-5 text-indigo-300" />
                <span className="font-mono">
                  {state.iteration ?? 0}/{state.totalIterations ?? maxIterations}
                </span>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 rounded bg-white/10">
                <Timer className="h-5 w-5 text-indigo-300" />
                <span className="font-mono">{formatElapsed(elapsedSeconds)}</span>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 rounded bg-white/10">
                <Gauge className="h-5 w-5 text-indigo-300" />
                <span className="truncate max-w-[120px]">{state.phase || 'Ready'}</span>
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
            <button onClick={handleStart} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-colors font-bold">
              <Rocket className="h-5 w-5" />
              Start
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Dynamic layout based on state */}
      <main className="flex-1 overflow-hidden p-4">
        <div className="h-full grid grid-cols-12 gap-4">
          
          {/* LEFT: Control Panel + Puzzle Grids - HIDE when running/done */}
          {!isRunning && !isDone && (
            <div className="col-span-4 flex flex-col gap-3 overflow-y-auto">
              {/* Auto-start notice */}
              {cameFromCommunity && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-700">Auto-starting with community settings...</p>
                </div>
              )}

              {/* Control Panel */}
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
                  onStart={handleStart}
                  onCancel={cancel}
              />

              {/* Info Card */}
              <PoetiqInfoCard />

              {/* Puzzle Grids */}
              <div className="bg-white border border-gray-300 rounded">
                <div className="border-b border-gray-300 bg-gray-50 px-3 py-2">
                  <h2 className="text-sm font-bold text-gray-700">PUZZLE GRIDS</h2>
                </div>
                <div className="p-3 space-y-4 max-h-[500px] overflow-y-auto">
                  {task.train.slice(0, 2).map((example, idx) => (
                    <div key={`train-${idx}`} className="space-y-2">
                      <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Training {idx + 1}</div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Input</div>
                          <PuzzleGrid grid={example.input} title="Input" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Output</div>
                          <PuzzleGrid grid={example.output} title="Output" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact />
                        </div>
                      </div>
                    </div>
                  ))}
                  {task.test.map((testCase, idx) => (
                    <div key={`test-${idx}`} className="space-y-2">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Test {idx + 1}</div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Input</div>
                          <PuzzleGrid grid={testCase.input} title="Test Input" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact />
                        </div>
                        {testCase.output && (
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-1">Expected</div>
                            <PuzzleGrid grid={testCase.output} title="Expected Output" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CENTER: Output - Expands when running */}
          <div className={`${isRunning || isDone ? 'col-span-8' : 'col-span-5'} flex flex-col gap-3 min-h-0`}>
            {/* Fallback API Key Notice */}
            {state.usingFallback && (
              <div className="bg-amber-50 border border-amber-300 rounded px-4 py-2 text-sm text-amber-800">
                <strong>Note:</strong> Using server API key (no BYO key provided)
              </div>
            )}

            {/* Event Log Panel - Central, with Copy button, more vertical space */}
            {(isRunning || isDone || (state.logLines?.length ?? 0) > 0) && (
              <div className="bg-white border border-gray-300 rounded flex-1 min-h-0 flex flex-col">
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
                  <div className="flex-1 overflow-y-auto p-3 bg-gray-900 font-mono text-sm">
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

            {/* AI Streaming Output - Show ONLY while running */}
            {!isDone && (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                {/* Reasoning Box (blue) */}
                <div className="flex-1 bg-white border border-blue-300 rounded flex flex-col min-h-0">
                  <div className="border-b border-blue-300 bg-blue-50 px-3 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-blue-700">AI REASONING</h3>
                    {isRunning && <span className="text-xs text-blue-600 font-bold">● STREAMING</span>}
                  </div>
                  <div className="flex-1 overflow-auto p-3 bg-blue-50">
                    <div className="text-sm font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {state.streamingReasoning || state.message || 'Waiting for AI reasoning...'}
                    </div>
                  </div>
                </div>

                {/* Output Box (green) - Generated Code */}
                <div className="flex-1 bg-white border border-green-300 rounded flex flex-col min-h-0">
                  <div className="border-b border-green-300 bg-green-50 px-3 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-green-700">GENERATED CODE</h3>
                    {isRunning && (state.streamingCode || state.result?.generatedCode) && (
                      <span className="text-xs text-green-600 font-bold">● STREAMING</span>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-3 bg-green-50">
                    <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {state.streamingCode || state.result?.generatedCode || 'Waiting for code generation...'}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Final Result - Show ONLY when completed */}
            {isDone && resultSummary && (
              <div className="flex-1 overflow-auto">
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

          {/* RIGHT: Iteration Progress - Expands when running */}
          <div className={`${isRunning || isDone ? 'col-span-4' : 'col-span-3'} overflow-y-auto`}>
            <PoetiqPythonTerminal
              executions={executions}
              currentCode={isRunning ? state.result?.generatedCode : undefined}
              isRunning={isRunning}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
