/**
 * client/src/components/saturn/SaturnStreamingTerminal.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Modern terminal-style component for displaying live streaming logs and reasoning
 * from Saturn Visual Solver. Features auto-scroll, color-coded log levels, and beautiful typography.
 *
 * SRP/DRY check: Pass - Single responsibility for terminal display and streaming
 * DaisyUI: Pass - Uses DaisyUI components with modern terminal styling
 */

import React, { useEffect, useRef } from 'react';
import { Terminal, Loader2, ChevronDown, Pause, Play } from 'lucide-react';

interface SaturnStreamingTerminalProps {
  logs: string[];
  isRunning: boolean;
  reasoning?: string;
}

export default function SaturnStreamingTerminal({ logs, isRunning, reasoning }: SaturnStreamingTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = React.useState(true);
  const [isPaused, setIsPaused] = React.useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, reasoning, isAutoScroll, isPaused]);

  // Parse log lines for styling
  const parseLogLine = (line: string, index: number) => {
    const trimmed = line.trim();

    // Color-coded log levels
    if (trimmed.startsWith('ERROR:') || trimmed.includes('failed') || trimmed.includes('error')) {
      return (
        <div key={index} className="font-mono text-sm text-red-400 leading-relaxed">
          <span className="text-red-300">❌ </span>
          {trimmed}
        </div>
      );
    }

    if (trimmed.startsWith('WARN:') || trimmed.includes('warning')) {
      return (
        <div key={index} className="font-mono text-sm text-yellow-400 leading-relaxed">
          <span className="text-yellow-300">⚠️ </span>
          {trimmed}
        </div>
      );
    }

    if (trimmed.startsWith('SUCCESS:') || trimmed.includes('completed') || trimmed.includes('success')) {
      return (
        <div key={index} className="font-mono text-sm text-green-400 leading-relaxed">
          <span className="text-green-300">✅ </span>
          {trimmed}
        </div>
      );
    }

    if (trimmed.startsWith('🪐') || trimmed.startsWith('📸') || trimmed.startsWith('🔍')) {
      return (
        <div key={index} className="font-mono text-sm text-purple-400 leading-relaxed">
          {trimmed}
        </div>
      );
    }

    if (trimmed.startsWith('---') || trimmed.startsWith('===') || trimmed.match(/^\s*$/)) {
      return (
        <div key={index} className="font-mono text-sm text-gray-500 leading-relaxed">
          {trimmed}
        </div>
      );
    }

    // Default styling for regular logs
    return (
      <div key={index} className="font-mono text-sm text-gray-300 leading-relaxed">
        {trimmed}
      </div>
    );
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsAutoScroll(isAtBottom);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAutoScroll(true);
    }
  };

  return (
    <div className="card bg-gray-900/95 backdrop-blur-md border-0 shadow-2xl text-white">
      <div className="card-body p-0">

        {/* Terminal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-green-500 rounded-full">
              <Terminal className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-100">Live Saturn Terminal</h3>
              <p className="text-xs text-gray-400">
                {logs.length} lines • {isRunning ? 'Streaming' : 'Paused'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pause/Play Button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`btn btn-sm gap-2 ${isPaused ? 'btn-success' : 'btn-warning'}`}
              title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            {/* Scroll to Bottom Button */}
            {!isAutoScroll && (
              <button
                onClick={scrollToBottom}
                className="btn btn-sm btn-ghost gap-2"
                title="Scroll to bottom"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            )}

            {/* Status Indicator */}
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          </div>
        </div>

        {/* Terminal Content */}
        <div
          ref={scrollRef}
          className="p-4 max-h-96 overflow-y-auto font-mono text-sm bg-gray-900 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
          onScroll={handleScroll}
        >
          {logs.length === 0 && !reasoning ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Terminal className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-center">
                {isRunning ? 'Waiting for Saturn to start generating output...' : 'Terminal output will appear here'}
              </p>
              {isRunning && (
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Initializing Saturn Visual Solver</span>
                </div>
              )}
            </div>
          ) : (
            /* Log Lines */
            <div className="space-y-1">
              {logs.map((line, index) => parseLogLine(line, index))}

              {/* Live Reasoning Display */}
              {reasoning && (
                <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                  <div className="text-blue-300 text-xs font-semibold mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    Live Reasoning
                  </div>
                  <div className="font-mono text-sm text-blue-100 leading-relaxed whitespace-pre-wrap">
                    {reasoning}
                    {isRunning && (
                      <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse"></span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terminal Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/30 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>Saturn Visual Solver v2.0</span>
              <span>•</span>
              <span>{logs.length} total lines</span>
            </div>
            <div className="flex items-center gap-2">
              {isAutoScroll ? (
                <span className="text-green-400">● Auto-scroll</span>
              ) : (
                <span className="text-yellow-400">● Manual scroll</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
