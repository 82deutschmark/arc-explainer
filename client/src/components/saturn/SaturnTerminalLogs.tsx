/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-14
 * PURPOSE: Enhanced streaming AI output display for Saturn solver - visually rich terminal with animations
 * Displays streaming text and reasoning output with enhanced visual design, animations, and better UX
 * SRP: Single responsibility - streaming AI output display
 * DRY: Pass - reusable component
 * DaisyUI: Fail - Uses custom Tailwind (terminal-style component, no standard UI pattern)
 */

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  streamingText?: string;
  streamingReasoning?: string;
  isRunning: boolean;
  phase?: string;
  compact?: boolean;
}

export default function SaturnTerminalLogs({ streamingText, streamingReasoning, isRunning, phase, compact }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, streamingReasoning, autoScroll]);

  const hasContent = streamingText || streamingReasoning;

  if (compact) {
    return (
      <div className="min-h-0 overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-lg shadow-xl">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-blue-500/30 px-3 py-2">
          <h2 className="text-sm text-blue-300 font-bold flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
            AI Reasoning Stream
          </h2>
          <div className="flex items-center gap-2">
            {phase && <span className="text-xs text-cyan-400 font-mono bg-black/30 px-2 py-1 rounded">{phase}</span>}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                autoScroll ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-600/50 text-slate-400'
              }`}
            >
              {autoScroll ? 'Auto' : 'Manual'}
            </button>
          </div>
        </div>

        {/* Enhanced Streaming Content */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto p-3 bg-gradient-to-b from-slate-900 to-black"
        >
          {!hasContent ? (
            <div className="text-slate-400 text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
                <div className={`w-8 h-8 rounded-full ${isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
              </div>
              <p className="text-sm font-medium">
                {isRunning ? '🤖 AI is analyzing the puzzle...' : '💭 Waiting for AI analysis'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isRunning ? 'Streaming reasoning will appear here' : 'Click START to begin'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Enhanced Reasoning Section */}
              {streamingReasoning && (
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-400/30 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-blue-300 text-sm font-bold mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                    <span className="tracking-wide">REASONING PROCESS</span>
                    {isRunning && <div className="flex-1 h-px bg-gradient-to-r from-blue-400/50 to-transparent ml-4" />}
                  </div>
                  <div className="text-blue-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3 border border-blue-500/20">
                    {streamingReasoning}
                    {isRunning && (
                      <span className="inline-block w-2 h-5 bg-blue-400 ml-2 animate-pulse opacity-75" />
                    )}
                  </div>
                </div>
              )}

              {/* Enhanced Output Section */}
              {streamingText && (
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/30 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-green-300 text-sm font-bold mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    <span className="tracking-wide">AI OUTPUT</span>
                    {isRunning && <div className="flex-1 h-px bg-gradient-to-r from-green-400/50 to-transparent ml-4" />}
                  </div>
                  <div className="text-green-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3 border border-green-500/20">
                    {streamingText}
                    {isRunning && (
                      <span className="inline-block w-2 h-5 bg-green-400 ml-2 animate-pulse opacity-75" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Footer */}
        <div className="border-t border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">Saturn AI Stream</span>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="text-cyan-400 flex items-center gap-1">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
              {hasContent && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    showRaw ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-600/50 text-slate-400'
                  }`}
                >
                  {showRaw ? 'Formatted' : 'Raw'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full enhanced desktop version
  return (
    <div className="min-h-0 overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border border-slate-700 rounded-lg shadow-2xl">
      {/* Enhanced Header with better visual hierarchy */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-b border-blue-500/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' : 'bg-slate-500'}`} />
          <div>
            <h2 className="text-lg text-white font-bold tracking-wide">🧠 AI Reasoning Visualizer</h2>
            <p className="text-sm text-blue-200/80">
              Real-time AI analysis and pattern recognition
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {phase && (
            <div className="bg-black/30 px-3 py-1 rounded-lg border border-blue-400/30">
              <span className="text-cyan-300 font-mono text-sm">{phase}</span>
            </div>
          )}

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
              autoScroll
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-500/40'
                : 'bg-slate-600/50 text-slate-400 border border-slate-500/50 hover:bg-slate-600/60'
            }`}
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Enhanced main content area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 bg-gradient-to-b from-slate-900/50 to-black/50"
      >
        {!hasContent ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
              <div className={`w-12 h-12 rounded-full ${isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {isRunning ? '🤖 AI Analysis in Progress' : '💭 Ready for Analysis'}
            </h3>
            <p className="text-slate-300 max-w-md mx-auto leading-relaxed">
              {isRunning
                ? 'Watch as the AI analyzes patterns, discovers rules, and generates solutions in real-time'
                : 'Advanced AI reasoning, pattern recognition, and visual analysis will stream here'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Live Status Banner */}
            {isRunning && (
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                    <div>
                      <div className="text-cyan-300 font-semibold">Live AI Processing</div>
                      <div className="text-slate-300 text-sm">
                        {phase ? `Current Phase: ${phase}` : 'Analyzing puzzle patterns and generating insights...'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-400">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    <span className="font-mono text-sm tracking-wider">STREAMING</span>
                  </div>
                </div>

                {/* Animated progress indicator */}
                <div className="mt-3 w-full bg-black/30 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full animate-pulse" style={{ width: '75%' }} />
                </div>
              </div>
            )}

            {/* Enhanced Reasoning Section */}
            {streamingReasoning && (
              <div className="bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-400/40 rounded-lg p-6 backdrop-blur-sm hover:border-blue-300/60 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50" />
                  <div>
                    <h3 className="text-blue-300 font-bold text-lg tracking-wide">Reasoning Process</h3>
                    <p className="text-blue-200/80 text-sm">Step-by-step analytical thinking and pattern analysis</p>
                  </div>
                </div>

                <div className="text-blue-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded-lg p-4 border border-blue-500/20">
                  {streamingReasoning}
                  {isRunning && (
                    <span className="inline-block w-3 h-6 bg-blue-400 ml-2 animate-pulse opacity-75" />
                  )}
                </div>
              </div>
            )}

            {/* Enhanced Output Section */}
            {streamingText && (
              <div className="bg-gradient-to-br from-green-500/15 to-emerald-500/15 border border-green-400/40 rounded-lg p-6 backdrop-blur-sm hover:border-green-300/60 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                  <div>
                    <h3 className="text-green-300 font-bold text-lg tracking-wide">Final Output</h3>
                    <p className="text-green-200/80 text-sm">Generated solution and conclusions</p>
                  </div>
                </div>

                <div className="text-green-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded-lg p-4 border border-green-500/20">
                  {streamingText}
                  {isRunning && (
                    <span className="inline-block w-3 h-6 bg-green-400 ml-2 animate-pulse opacity-75" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Footer */}
      <div className="border-t border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-slate-400">
            <span className="font-mono">Saturn Visual Solver</span>
            <span>•</span>
            <span>Real-time AI streaming</span>
          </div>

          <div className="flex items-center gap-3">
            {isRunning && (
              <span className="text-cyan-400 flex items-center gap-2 font-mono text-sm">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                ACTIVE
              </span>
            )}

            {hasContent && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                  showRaw
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50'
                    : 'bg-slate-600/50 text-slate-400 border border-slate-500/50 hover:bg-slate-600/60'
                }`}
              >
                {showRaw ? 'Formatted View' : 'Raw Output'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
