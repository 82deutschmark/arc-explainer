/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Enhanced AI reasoning display for Poetiq solver - borrowed from Saturn pattern.
 *          Transforms basic progress updates into rich visual experience with
 *          streaming text, iteration progress, and code generation visualization.
 *
 * SRP/DRY check: Pass - Specialized component for Poetiq streaming visualization
 * DaisyUI: Pass - Uses DaisyUI with Saturn-style glass-morphism effects
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Brain, Code2, Zap, Activity, ChevronDown, ChevronUp, 
  Terminal, Clock, CheckCircle, XCircle, Play
} from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

interface PoetiqIterationData {
  iteration: number;
  code?: string;
  trainScore?: number;
  testCorrect?: boolean;
  elapsedMs?: number;
  error?: string;
}

interface PoetiqStreamingVisualizerProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  iterations?: PoetiqIterationData[];
  logs?: string[];
  generatedCode?: string;
  compact?: boolean;
  onExpand?: () => void;
}

export default function PoetiqStreamingVisualizer({
  state,
  isRunning,
  iterations = [],
  logs = [],
  generatedCode,
  compact = false,
  onExpand,
}: PoetiqStreamingVisualizerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [showCode, setShowCode] = useState(true);

  // Auto-scroll when new content arrives
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state, logs, autoScroll]);

  // Get phase color
  const getPhaseColor = (phase?: string) => {
    if (!phase) return 'text-gray-400';
    if (phase.includes('generating') || phase.includes('code')) return 'text-purple-400';
    if (phase.includes('testing') || phase.includes('executing')) return 'text-blue-400';
    if (phase.includes('complete') || phase.includes('success')) return 'text-green-400';
    if (phase.includes('error') || phase.includes('failed')) return 'text-red-400';
    return 'text-cyan-400';
  };

  // Compact version for inline display
  if (compact) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">Progress</span>
          </div>
          {onExpand && (
            <button
              onClick={onExpand}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Expand ->
            </button>
          )}
        </div>

        {/* Progress bar */}
        {state.iteration !== undefined && state.totalIterations && (
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-xs text-white/70">
              <span>Iteration {state.iteration}/{state.totalIterations}</span>
              <span>{Math.round((state.iteration / state.totalIterations) * 100)}%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${(state.iteration / state.totalIterations) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Current phase */}
        {state.phase && (
          <div className={`text-sm ${getPhaseColor(state.phase)} mb-2`}>
            {isRunning && <span className="inline-block w-2 h-2 bg-current rounded-full mr-2 animate-pulse" />}
            {state.phase}
          </div>
        )}

        {/* Message */}
        {state.message && (
          <p className="text-xs text-white/60 truncate">{state.message}</p>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Code Generation</h3>
            {state.phase && (
              <p className={`text-sm ${getPhaseColor(state.phase)}`}>
                {state.phase}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded-full border border-cyan-400/30">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-cyan-300 text-sm font-mono font-bold">LIVE</span>
            </div>
          )}
          {state.status === 'completed' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-400/30">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-sm font-bold">DONE</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {state.iteration !== undefined && state.totalIterations && (
        <div className="p-4 bg-black/20 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">
              Iteration {state.iteration} of {state.totalIterations}
            </span>
            <span className="text-sm text-white/60">
              {Math.round((state.iteration / state.totalIterations) * 100)}% complete
            </span>
          </div>
          <div className="h-3 bg-black/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 transition-all duration-500 ease-out"
              style={{ width: `${(state.iteration / state.totalIterations) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {/* Idle State */}
        {state.status === 'idle' && !isRunning && (
          <div className="text-center py-16 text-white/50">
            <Code2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-xl font-semibold mb-2">Ready to Generate</h3>
            <p className="text-white/70">
              Poetiq will iteratively generate Python transform() functions
              <br />until it finds one that solves the puzzle.
            </p>
          </div>
        )}

        {/* Running/Active State */}
        {(isRunning || state.status === 'running') && (
          <>
            {/* Live Status Banner */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
                  <div>
                    <div className="text-purple-300 font-semibold">Code Generation Active</div>
                    <div className="text-white/80 text-sm">
                      {state.message || 'Generating Python transform() function...'}
                    </div>
                  </div>
                </div>
                <Activity className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
            </div>

            {/* Iteration Progress Cards */}
            {iterations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Iteration History
                </h4>
                {iterations.map((iter, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      iter.testCorrect 
                        ? 'bg-green-500/20 border-green-400/30' 
                        : iter.error 
                        ? 'bg-red-500/20 border-red-400/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        Iteration {iter.iteration}
                      </span>
                      <div className="flex items-center gap-2">
                        {iter.trainScore !== undefined && (
                          <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded">
                            Train: {(iter.trainScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {iter.testCorrect !== undefined && (
                          iter.testCorrect 
                            ? <CheckCircle className="w-4 h-4 text-green-400" />
                            : <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        {iter.elapsedMs && (
                          <span className="text-xs text-white/50">
                            {(iter.elapsedMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                    {iter.error && (
                      <p className="text-xs text-red-300 mt-1">{iter.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Completed State */}
        {state.status === 'completed' && state.result && (
          <div className="space-y-4">
            {/* Result Banner */}
            <div className={`p-4 rounded-lg border ${
              state.result.isPredictionCorrect 
                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/30'
                : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-400/30'
            }`}>
              <div className="flex items-center gap-3">
                {state.result.isPredictionCorrect 
                  ? <CheckCircle className="w-8 h-8 text-green-400" />
                  : <XCircle className="w-8 h-8 text-red-400" />
                }
                <div>
                  <div className={`text-xl font-bold ${
                    state.result.isPredictionCorrect ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {state.result.isPredictionCorrect ? 'SOLVED!' : 'UNSOLVED'}
                  </div>
                  <div className="text-white/70 text-sm">
                    {state.result.iterationCount} iterations - {Math.round((state.result.elapsedMs || 0) / 1000)}s
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Code */}
            {(state.result.generatedCode || generatedCode) && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
                >
                  <Code2 className="w-4 h-4 text-green-400" />
                  Generated Code
                  {showCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showCode && (
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-96 border border-gray-700">
                    <code>{state.result.generatedCode || generatedCode}</code>
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400" />
              <div>
                <div className="text-red-300 font-semibold">Error</div>
                <div className="text-white/70 text-sm">{state.message}</div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Log (Collapsible) */}
        {logs.length > 0 && (
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
            >
              <Terminal className="w-4 h-4" />
              Activity Log ({logs.length})
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showLogs && (
              <div className="mt-2 bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {logs.map((log, idx) => (
                  <div key={idx} className="text-gray-300 py-0.5">
                    <span className="text-gray-500 mr-2">[{idx + 1}]</span>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between text-sm text-white/60 border-t border-white/20 p-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              autoScroll
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                : 'bg-white/10 text-white/60 border border-white/20'
            }`}
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-cyan-400">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="font-mono">STREAMING</span>
          </div>
        )}
      </div>
    </div>
  );
}
