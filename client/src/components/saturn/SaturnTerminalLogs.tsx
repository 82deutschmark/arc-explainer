/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-14
 * PURPOSE: Streaming AI output display for Saturn solver - shows AI responses and reasoning in real-time
 * Displays streaming text and reasoning output prominently, separate from system logs
 * SRP: Single responsibility - streaming AI output display
 * DRY: Pass - reusable component
 * DaisyUI: Fail - Uses custom Tailwind (terminal-style component, no standard UI pattern)
 */

import React, { useEffect, useRef } from 'react';

interface Props {
  streamingText?: string;
  streamingReasoning?: string;
  isRunning: boolean;
  phase?: string;
  compact?: boolean;
}

export default function SaturnTerminalLogs({ streamingText, streamingReasoning, isRunning, phase, compact }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, streamingReasoning]);

  const hasContent = streamingText || streamingReasoning;

  return (
    <div className="min-h-0 overflow-hidden flex flex-col border border-gray-300 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between bg-blue-100 border-b border-blue-300 px-2 py-1">
        <h2 className="text-sm text-blue-900 font-bold">🤖 AI STREAMING OUTPUT</h2>
        <div className="flex items-center gap-2">
          {phase && <span className="text-xs text-blue-700 font-mono">{phase}</span>}
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        </div>
      </div>

      {/* Streaming Content */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto bg-gray-900 p-3"
      >
        {!hasContent ? (
          <div className="text-gray-500 text-center py-8 font-mono text-sm">
            {isRunning ? '⏳ Waiting for AI response...' : '💤 No streaming output yet'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Streaming Reasoning */}
            {streamingReasoning && (
              <div className="p-3 bg-blue-900/30 border border-blue-700 rounded">
                <div className="text-blue-300 text-xs font-bold mb-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  REASONING PROCESS
                </div>
                <div className="text-blue-100 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                  {streamingReasoning}
                  {isRunning && <span className="inline-block w-1 h-4 bg-blue-400 ml-1 animate-pulse"></span>}
                </div>
              </div>
            )}

            {/* Streaming Text Output */}
            {streamingText && (
              <div className="p-3 bg-green-900/20 border border-green-700 rounded">
                <div className="text-green-300 text-xs font-bold mb-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  OUTPUT
                </div>
                <div className="text-green-100 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                  {streamingText}
                  {isRunning && <span className="inline-block w-1 h-4 bg-green-400 ml-1 animate-pulse"></span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with streaming indicator */}
      <div className="border-t border-gray-300 bg-gray-50 px-2 py-1 text-xs font-mono text-gray-600 flex items-center justify-between">
        <span>SATURN AI STREAMING</span>
        {isRunning && (
          <span className="text-green-600 flex items-center gap-1">
            <span className="inline-block w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
            LIVE
          </span>
        )}
      </div>
    </div>
  );
}
