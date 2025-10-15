/**
 * Author: Cascade
 * Date: 2025-10-15
 * PURPOSE: Streaming AI output display for Saturn solver - real-time reasoning and text output
 * Shows GPT-5 reasoning process and final output as it streams
 * SRP: Single responsibility - streaming AI output display
 * DRY: Pass - reusable component
 */

import React, { useEffect, useRef } from 'react';

interface Props {
  streamingText?: string;
  streamingReasoning?: string;
  isRunning: boolean;
  phase?: string;
}

export default function SaturnTerminalLogs({ streamingText, streamingReasoning, isRunning, phase }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, streamingReasoning]);

  const hasContent = streamingText || streamingReasoning;

  return (
    <div className="bg-white border border-gray-300 rounded h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-300 bg-gray-50 px-3 py-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">AI REASONING OUTPUT</h2>
        <div className="flex items-center gap-2">
          {phase && (
            <span className="text-xs text-gray-600 font-mono">{phase}</span>
          )}
          {isRunning && (
            <span className="text-xs text-blue-600 font-bold">● STREAMING</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 bg-gray-50"
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <p className="text-sm text-gray-500">
              {isRunning ? 'Waiting for AI output...' : 'No output yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Real-time reasoning and text will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Reasoning */}
            {streamingReasoning && (
              <div className="border border-blue-300 rounded bg-blue-50 p-3">
                <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-2">
                  {isRunning && <span className="text-blue-600">●</span>}
                  REASONING
                </div>
                <div className="text-sm font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {streamingReasoning}
                </div>
              </div>
            )}

            {/* Output */}
            {streamingText && (
              <div className="border border-green-300 rounded bg-green-50 p-3">
                <div className="text-xs font-bold text-green-700 mb-2 flex items-center gap-2">
                  {isRunning && <span className="text-green-600">●</span>}
                  OUTPUT
                </div>
                <div className="text-sm font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {streamingText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
