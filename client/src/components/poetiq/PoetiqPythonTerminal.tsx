/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Python execution terminal for Poetiq solver - replaces Saturn's image gallery.
 *          Shows real-time Python execution results, errors, and test scores.
 *          Matches Saturn's information density with auto-scroll and color coding.
 *
 * SRP/DRY check: Pass - Single responsibility for Python output display
 * DaisyUI: Pass - Uses DaisyUI with Saturn-style layout
 */

import React, { useEffect, useRef } from 'react';
import { Terminal, CheckCircle, XCircle, Code, Play } from 'lucide-react';

interface ExecutionResult {
  iteration: number;
  success: boolean;
  trainScore?: number;
  testCorrect?: boolean;
  error?: string;
  output?: string;
  code?: string;
  elapsedMs?: number;
}

interface PoetiqPythonTerminalProps {
  executions: ExecutionResult[];
  currentCode?: string;
  isRunning: boolean;
}

export default function PoetiqPythonTerminal({
  executions,
  currentCode,
  isRunning,
}: PoetiqPythonTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [executions, currentCode]);

  return (
    <div className="bg-white border border-gray-300 rounded flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-300 bg-gray-900 px-3 py-2 flex items-center justify-between rounded-t">
        <h3 className="text-sm font-bold text-green-400 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          PYTHON EXECUTION
        </h3>
        {isRunning && (
          <span className="text-xs text-green-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            RUNNING
          </span>
        )}
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-900 p-3 font-mono text-xs space-y-3"
      >
        {executions.length === 0 && !currentCode && (
          <div className="text-gray-500 text-center py-8">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Python execution results will appear here</p>
            <p className="text-[10px] mt-1">Generated code will be tested on training examples</p>
          </div>
        )}

        {/* Current code being generated/tested */}
        {currentCode && isRunning && (
          <div className="border border-yellow-500/30 rounded p-2 bg-yellow-900/20">
            <div className="text-yellow-400 text-[10px] font-bold mb-1 flex items-center gap-1">
              <Code className="w-3 h-3" />
              GENERATING CODE...
            </div>
            <pre className="text-yellow-200 whitespace-pre-wrap text-[10px] max-h-32 overflow-y-auto">
              {currentCode}
            </pre>
          </div>
        )}

        {/* Execution Results */}
        {executions.map((exec, idx) => (
          <div
            key={idx}
            className={`border rounded p-2 ${
              exec.success
                ? 'border-green-500/30 bg-green-900/20'
                : exec.error
                ? 'border-red-500/30 bg-red-900/20'
                : 'border-gray-500/30 bg-gray-800/50'
            }`}
          >
            {/* Iteration Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400">
                  ITERATION {exec.iteration}
                </span>
                {exec.success ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : exec.error ? (
                  <XCircle className="w-3 h-3 text-red-400" />
                ) : (
                  <Play className="w-3 h-3 text-blue-400" />
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                {exec.trainScore !== undefined && (
                  <span className={`px-1 rounded ${
                    exec.trainScore >= 0.8 ? 'bg-green-800 text-green-200' :
                    exec.trainScore >= 0.5 ? 'bg-yellow-800 text-yellow-200' :
                    'bg-red-800 text-red-200'
                  }`}>
                    Train: {(exec.trainScore * 100).toFixed(0)}%
                  </span>
                )}
                {exec.testCorrect !== undefined && (
                  <span className={`px-1 rounded ${
                    exec.testCorrect ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'
                  }`}>
                    Test: {exec.testCorrect ? 'PASS' : 'FAIL'}
                  </span>
                )}
                {exec.elapsedMs && (
                  <span className="text-gray-500">
                    {(exec.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>

            {/* Error Output */}
            {exec.error && (
              <div className="text-red-300 text-[10px] mt-1 whitespace-pre-wrap">
                <span className="text-red-500 font-bold">ERROR: </span>
                {exec.error}
              </div>
            )}

            {/* Standard Output */}
            {exec.output && (
              <div className="text-gray-300 text-[10px] mt-1 whitespace-pre-wrap max-h-20 overflow-y-auto">
                {exec.output}
              </div>
            )}

            {/* Generated Code (collapsed by default, show first few lines) */}
            {exec.code && (
              <details className="mt-2">
                <summary className="text-[10px] text-blue-400 cursor-pointer hover:text-blue-300">
                  View generated code ({exec.code.split('\n').length} lines)
                </summary>
                <pre className="text-green-300 text-[10px] mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto bg-black/30 p-2 rounded">
                  {exec.code}
                </pre>
              </details>
            )}
          </div>
        ))}

        {/* Running indicator at bottom */}
        {isRunning && (
          <div className="text-green-400 text-[10px] flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Executing Python code...
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-gray-700 bg-gray-900 px-3 py-2 flex items-center justify-between text-[10px] text-gray-400 rounded-b">
        <span>{executions.length} executions</span>
        <span>
          {executions.filter(e => e.success).length} passed / {executions.filter(e => e.error).length} failed
        </span>
      </div>
    </div>
  );
}
