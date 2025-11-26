/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-26 - Saturn-style exact layout with streaming boxes
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
import { Loader2, ArrowLeft, Square } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';

// Poetiq components
import PoetiqControlPanel from '@/components/poetiq/PoetiqControlPanel';
import PoetiqPythonTerminal from '@/components/poetiq/PoetiqPythonTerminal';

export default function PoetiqSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = usePoetiqProgress(taskId);
  
  // Configuration state
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'openai'>('openrouter');
  const [model, setModel] = useState('openrouter/openai/gpt-5-nano');
  const [numExperts, setNumExperts] = useState(2);
  const [maxIterations, setMaxIterations] = useState(10);
  const [temperature, setTemperature] = useState(1.0);
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [executions, setExecutions] = useState<any[]>([]);

  // Set page title
  useEffect(() => {
    document.title = taskId ? `Poetiq Solver - ${taskId}` : 'Poetiq Code-Generation Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

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
        // Add new execution result
        const newExec = {
          iteration: state.iteration,
          success: false,
          output: state.message,
          code: state.result?.generatedCode,
        };
        // Don't add duplicates
        if (prev.some(e => e.iteration === state.iteration)) {
          return prev.map(e => e.iteration === state.iteration ? newExec : e);
        }
        return [...prev, newExec];
      });
    }
  }, [state.iteration, state.message, isRunning]);

  const handleStart = () => {
    // Cast provider to expected type for Poetiq (which only supports gemini/openrouter)
    const poetiqProvider = provider === 'openai' ? 'openrouter' : provider;
    start({
      apiKey,
      provider: poetiqProvider,
      model,
      numExperts,
      maxIterations,
      temperature,
    });
  };

  // Loading states
  if (!taskId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded shadow">
          <p className="text-red-600">Invalid puzzle ID</p>
          <Link href="/poetiq">
            <a className="text-blue-600 hover:text-blue-800 text-sm mt-2 block">← Back to Community</a>
          </Link>
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
          <Link href="/poetiq">
            <a className="text-blue-600 hover:text-blue-800 text-sm mt-2 block">← Back to Community</a>
          </Link>
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link href="/poetiq">
            <a className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </a>
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <div>
            <h1 className="text-lg font-bold text-gray-800">Poetiq Code Generator</h1>
            <p className="text-xs text-gray-500 font-mono">{taskId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button onClick={cancel} className="btn btn-error btn-sm">
              <Square className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Saturn's exact 12-column grid */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full grid grid-cols-12 gap-2">
          
          {/* LEFT: Control Panel + Puzzle Grids (4 cols) */}
          <div className="col-span-4 flex flex-col gap-2 overflow-y-auto">
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

            {/* Puzzle Display - Training & Test Grids (Saturn style) */}
            <div className="bg-white border border-gray-300 rounded">
              <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                <h2 className="text-xs font-bold text-gray-700">PUZZLE GRIDS</h2>
              </div>
              <div className="p-2 space-y-3 max-h-[400px] overflow-y-auto">
                {/* Training Examples */}
                {task.train.slice(0, 2).map((example, idx) => (
                  <div key={`train-${idx}`} className="space-y-1">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Training {idx + 1}</div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="text-[9px] text-gray-500 mb-0.5">Input</div>
                        <PuzzleGrid
                          grid={example.input}
                          title="Input"
                          showEmojis={false}
                          emojiSet={DEFAULT_EMOJI_SET}
                          compact
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-[9px] text-gray-500 mb-0.5">Output</div>
                        <PuzzleGrid
                          grid={example.output}
                          title="Output"
                          showEmojis={false}
                          emojiSet={DEFAULT_EMOJI_SET}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Test Cases */}
                {task.test.map((testCase, idx) => (
                  <div key={`test-${idx}`} className="space-y-1">
                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Test {idx + 1}</div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="text-[9px] text-gray-500 mb-0.5">Input</div>
                        <PuzzleGrid
                          grid={testCase.input}
                          title="Test Input"
                          showEmojis={false}
                          emojiSet={DEFAULT_EMOJI_SET}
                          compact
                        />
                      </div>
                      {testCase.output && (
                        <div className="flex-1">
                          <div className="text-[9px] text-gray-500 mb-0.5">Expected</div>
                          <PuzzleGrid
                            grid={testCase.output}
                            title="Expected Output"
                            showEmojis={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: AI Streaming Output (5 cols) - Saturn's exact layout */}
          <div className="col-span-5 flex flex-col gap-2 min-h-0">
            {/* Token Metrics - TOP */}
            <div className="bg-white border border-gray-300 rounded">
              <div className="grid grid-cols-4 divide-x divide-gray-300">
                <div className="p-2">
                  <div className="text-xs text-gray-600">Iteration</div>
                  <div className="text-sm font-bold text-gray-900">
                    {state.iteration ?? 0} / {state.totalIterations ?? maxIterations}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-600">Experts</div>
                  <div className="text-sm font-bold text-gray-900">{numExperts}</div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-600">Phase</div>
                  <div className="text-sm font-bold text-gray-900 truncate">
                    {state.phase || 'Ready'}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-600">Status</div>
                  <div className={`text-sm font-bold ${
                    isRunning ? 'text-blue-600' : isDone ? 'text-green-600' : hasError ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {state.status.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

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
                      {state.message || 'Waiting for AI reasoning...'}
                    </div>
                  </div>
                </div>

                {/* Output Box (green) - Generated Code */}
                <div className="flex-1 bg-white border border-green-300 rounded flex flex-col min-h-0">
                  <div className="border-b border-green-300 bg-green-50 px-3 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-green-700">GENERATED CODE</h3>
                    {isRunning && state.result?.generatedCode && <span className="text-xs text-green-600 font-bold">● STREAMING</span>}
                  </div>
                  <div className="flex-1 overflow-auto p-3 bg-green-50">
                    <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {state.result?.generatedCode || 'Waiting for code generation...'}
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

          {/* RIGHT: Python Execution Terminal (3 cols) */}
          <div className="col-span-3 overflow-y-auto">
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
