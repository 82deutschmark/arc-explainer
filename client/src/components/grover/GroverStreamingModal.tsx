/**
 * Author: Cascade
 * Date: 2025-11-01
 * PURPOSE: Streaming modal for Grover solver - displays real-time AI reasoning,
 * code generation, and execution feedback as it happens. Inspired by Saturn's
 * streaming visualizer but adapted for Grover's iterative code generation workflow.
 * 
 * SRP/DRY check: Pass - Single responsibility for streaming visualization
 * shadcn/ui: Pass - Uses modal dialog and consistent UI patterns
 */

import React, { useEffect, useRef } from 'react';
import { X, Brain, Code2, Zap, Activity } from 'lucide-react';
import type { GroverProgressState } from '@/hooks/useGroverProgress';

interface GroverStreamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GroverProgressState;
}

export default function GroverStreamingModal({ isOpen, onClose, state }: GroverStreamingModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.streamingText, state.streamingReasoning, state.logLines]);

  if (!isOpen) return null;

  const isStreaming = state.streamingStatus === 'in_progress' || state.status === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-cyan-500/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Brain className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Grover AI Reasoning Stream</h2>
              <p className="text-sm text-white/70">
                {state.phase || 'Initializing'}
                {state.iteration && ` • Iteration ${state.iteration}/${state.totalIterations || 5}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isStreaming && (
              <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded-full border border-cyan-400/30">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-300 text-sm font-mono font-bold">LIVE</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        {state.streamingTokenUsage && (
          <div className="px-4 py-2 bg-black/30 border-b border-white/10 flex items-center justify-around text-xs">
            <div className="text-center">
              <div className="text-cyan-400 font-bold">
                {(state.streamingTokenUsage.input || 0).toLocaleString()}
              </div>
              <div className="text-white/60">Input Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-bold">
                {(state.streamingTokenUsage.output || 0).toLocaleString()}
              </div>
              <div className="text-white/60">Output Tokens</div>
            </div>
            {state.streamingTokenUsage.reasoning && (
              <div className="text-center">
                <div className="text-purple-400 font-bold">
                  {state.streamingTokenUsage.reasoning.toLocaleString()}
                </div>
                <div className="text-white/60">Reasoning Tokens</div>
              </div>
            )}
          </div>
        )}

        {/* Streaming Content Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20"
        >
          {/* Phase indicator */}
          {state.streamingPhase && (
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
                <Activity className="w-4 h-4 animate-pulse" />
                <span>Phase: {state.streamingPhase}</span>
              </div>
              {state.streamingMessage && (
                <p className="text-white/80 text-sm mt-2">{state.streamingMessage}</p>
              )}
            </div>
          )}

          {/* Streaming Reasoning */}
          {state.streamingReasoning && (
            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-400/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">AI Reasoning</h4>
                  <div className="text-white/70 text-xs">Internal thought process</div>
                </div>
              </div>
              <pre className="text-blue-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3 max-h-96 overflow-y-auto">
                {state.streamingReasoning}
                {isStreaming && <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />}
              </pre>
            </div>
          )}

          {/* Streaming Text Output */}
          {state.streamingText && (
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Code2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Generated Output</h4>
                  <div className="text-white/70 text-xs">Code and analysis results</div>
                </div>
              </div>
              <pre className="text-green-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3 max-h-96 overflow-y-auto">
                {state.streamingText}
                {isStreaming && <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse" />}
              </pre>
            </div>
          )}

          {/* JSON Output */}
          {state.streamingJson && (
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Structured Data</h4>
                  <div className="text-white/70 text-xs">JSON response</div>
                </div>
              </div>
              <pre className="text-yellow-100 font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3 max-h-64 overflow-y-auto">
                {state.streamingJson}
                {isStreaming && <span className="inline-block w-2 h-4 bg-yellow-400 ml-1 animate-pulse" />}
              </pre>
            </div>
          )}

          {/* Activity Log */}
          {state.logLines && state.logLines.length > 0 && (
            <div className="bg-black/40 border border-white/20 rounded-lg p-3">
              <h4 className="text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">Activity Log</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                {state.logLines.slice(-50).map((line, idx) => (
                  <div key={idx} className="text-gray-300 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!state.streamingText && !state.streamingReasoning && !state.streamingJson && (!state.logLines || state.logLines.length === 0) && (
            <div className="text-center py-16 text-white/50">
              <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Waiting for AI reasoning stream...</p>
              <p className="text-sm mt-2">Real-time output will appear here</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/20 bg-black/30 flex items-center justify-between text-sm">
          <div className="text-white/60">
            {state.status === 'running' ? (
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-pulse" />
                Processing iteration {state.iteration || 0} of {state.totalIterations || 5}
              </span>
            ) : (
              <span>Stream {state.status}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
