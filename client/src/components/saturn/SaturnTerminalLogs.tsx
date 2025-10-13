/**
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Terminal logs display for Saturn solver - monospace log output with auto-scroll.
 * ATC-style information-dense terminal following monospace patterns.
 * SRP: Single responsibility - log display only
 * DRY: Pass - reusable component
 */

import React, { useEffect, useRef } from 'react';

interface Props {
  logs: string[];
  isRunning: boolean;
  reasoning?: string;
  compact?: boolean;
}

export default function SaturnTerminalLogs({ logs, isRunning, reasoning, compact }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, reasoning]);

  return (
    <div className="min-h-0 overflow-hidden flex flex-col border border-gray-300 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-100 border-b border-gray-300 px-2 py-1">
        <h2 className="text-sm text-gray-700 font-bold">LIVE THROUGHPUT</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{logs.length} lines</span>
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto bg-gray-900 p-3 font-mono text-xs"
      >
        {logs.length === 0 && !reasoning ? (
          <div className="text-gray-500 text-center py-8">
            {isRunning ? 'Initializing Saturn...' : 'No logs yet'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((line, idx) => {
              // Color-code based on content
              const isError = line.includes('ERROR') || line.includes('failed');
              const isWarning = line.includes('WARN') || line.includes('warning');
              const isSuccess = line.includes('success') || line.includes('completed');
              const isInfo = line.startsWith('🪐') || line.startsWith('📸');

              return (
                <div 
                  key={idx}
                  className={`${
                    isError ? 'text-red-400' :
                    isWarning ? 'text-yellow-400' :
                    isSuccess ? 'text-green-400' :
                    isInfo ? 'text-blue-400' :
                    'text-gray-300'
                  }`}
                >
                  {line}
                </div>
              );
            })}

            {/* Live Reasoning */}
            {reasoning && (
              <div className="mt-3 p-2 bg-blue-900/30 border border-blue-700 rounded">
                <div className="text-blue-300 text-xs font-bold mb-1">● LIVE REASONING</div>
                <div className="text-blue-100 whitespace-pre-wrap">
                  {reasoning}
                  {isRunning && <span className="inline-block w-1 h-3 bg-blue-400 ml-1 animate-pulse"></span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 bg-gray-50 px-2 py-1 text-xs font-mono text-gray-600">
        SATURN VISUAL SOLVER v2.0
      </div>
    </div>
  );
}
