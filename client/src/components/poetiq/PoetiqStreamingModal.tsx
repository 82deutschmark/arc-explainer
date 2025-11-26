/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Full-screen streaming modal for Poetiq solver - borrowed from Grover pattern.
 *          Pop-out view for detailed live stream while browsing puzzle context.
 *          Shows real-time code generation, iteration progress, and activity logs.
 *
 * SRP/DRY check: Pass - Single responsibility for streaming modal display
 * shadcn/ui: Pass - Uses modal dialog patterns with Saturn-style visuals
 */

import React, { useEffect, useRef } from 'react';
import { 
  X, Brain, Code2, Zap, Activity, Terminal, 
  CheckCircle, XCircle, Clock, Copy, Check 
} from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

interface PoetiqStreamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: PoetiqProgressState;
  logs?: string[];
  elapsedSeconds?: number;
}

export default function PoetiqStreamingModal({
  isOpen,
  onClose,
  state,
  logs = [],
  elapsedSeconds = 0,
}: PoetiqStreamingModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state, logs]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleCopyCode = () => {
    const code = state.result?.generatedCode;
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (!isOpen) return null;

  const isStreaming = state.status === 'running';
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border-2 border-purple-500/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Poetiq Code Generation Stream</h2>
              <p className="text-sm text-white/70">
                {state.phase || 'Initializing'}
                {state.iteration !== undefined && state.totalIterations && 
                  ` • Iteration ${state.iteration}/${state.totalIterations}`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Timer */}
            {elapsedSeconds > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full">
                <Clock className="w-4 h-4 text-white/70" />
                <span className="text-white/80 font-mono">{formatTime(elapsedSeconds)}</span>
              </div>
            )}
            {/* Live indicator */}
            {isStreaming && (
              <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-full border border-purple-400/30">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                <span className="text-purple-300 text-sm font-mono font-bold">LIVE</span>
              </div>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {state.iteration !== undefined && state.totalIterations && (
          <div className="px-4 py-2 bg-black/30 border-b border-white/10">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <span>Progress</span>
              <span>{Math.round((state.iteration / state.totalIterations) * 100)}%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${(state.iteration / state.totalIterations) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Content Area - Split View */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel: Status & Code */}
          <div className="flex-1 flex flex-col border-r border-white/10">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Current Status */}
              {state.message && (
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-purple-300 text-sm font-semibold mb-1">
                    <Activity className="w-4 h-4 animate-pulse" />
                    Current Phase
                  </div>
                  <p className="text-white/90">{state.message}</p>
                </div>
              )}

              {/* Generated Code Preview */}
              {state.result?.generatedCode && (
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Code2 className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Generated Code</h4>
                        <div className="text-white/70 text-xs">
                          {state.result.isPredictionCorrect ? 'Solution found!' : 'Best attempt'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm text-white/80 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-green-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/30 rounded p-3 max-h-80 overflow-y-auto">
                    {state.result.generatedCode}
                  </pre>
                </div>
              )}

              {/* Result Summary */}
              {state.status === 'completed' && state.result && (
                <div className={`p-4 rounded-lg border ${
                  state.result.isPredictionCorrect
                    ? 'bg-green-500/20 border-green-400/30'
                    : 'bg-orange-500/20 border-orange-400/30'
                }`}>
                  <div className="flex items-center gap-3">
                    {state.result.isPredictionCorrect 
                      ? <CheckCircle className="w-8 h-8 text-green-400" />
                      : <XCircle className="w-8 h-8 text-orange-400" />
                    }
                    <div>
                      <div className={`text-xl font-bold ${
                        state.result.isPredictionCorrect ? 'text-green-300' : 'text-orange-300'
                      }`}>
                        {state.result.isPredictionCorrect ? 'PUZZLE SOLVED!' : 'NOT SOLVED'}
                      </div>
                      <div className="text-white/70 text-sm grid grid-cols-2 gap-x-4 mt-1">
                        <span>Iterations: {state.result.iterationCount}</span>
                        <span>Time: {Math.round((state.result.elapsedMs || 0) / 1000)}s</span>
                        {state.result.bestTrainScore !== undefined && (
                          <span>Train Score: {(state.result.bestTrainScore * 100).toFixed(1)}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!state.message && !state.result && state.status === 'idle' && (
                <div className="text-center py-16 text-white/50">
                  <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Waiting for code generation stream...</p>
                  <p className="text-sm mt-2">Real-time output will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Activity Log */}
          <div className="w-80 flex flex-col bg-black/20">
            <div className="px-4 py-3 border-b border-white/10">
              <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Activity Log
                <span className="text-xs text-white/50 ml-auto">{logs.length} entries</span>
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-center text-white/40 py-8">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Waiting for activity...</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, idx) => {
                    // Color-code log lines
                    let color = 'text-gray-400';
                    if (log.includes('error') || log.includes('Error')) color = 'text-red-400';
                    else if (log.includes('success') || log.includes('✓')) color = 'text-green-400';
                    else if (log.includes('iteration') || log.includes('Iteration')) color = 'text-blue-400';
                    else if (log.includes('generating') || log.includes('code')) color = 'text-purple-400';
                    
                    return (
                      <div key={idx} className={`py-0.5 ${color}`}>
                        <span className="text-gray-600 mr-2">[{idx + 1}]</span>
                        {log}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/20 bg-black/30 flex items-center justify-between text-sm">
          <div className="text-white/60">
            {isStreaming ? (
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-pulse" />
                Processing iteration {state.iteration || 0} of {state.totalIterations || '?'}
              </span>
            ) : (
              <span>Stream {state.status}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs">Press ESC to close</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
