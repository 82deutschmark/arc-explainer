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
import { Repeat, CheckCircle, XCircle, Code, Play, User, Sparkles } from 'lucide-react';

interface ExecutionResult {
  iteration: number;
  expert?: number;
  success: boolean;
  trainScore?: number;
  trainResults?: { success: boolean; error?: string }[];
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
      {/* Header - Clarified purpose */}
      <div className="border-b border-gray-300 bg-gradient-to-r from-indigo-900 to-purple-900 px-3 py-2 rounded-t">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Repeat className="w-4 h-4 text-indigo-300" />
            ITERATION PROGRESS
          </h3>
          {isRunning && (
            <span className="text-xs text-green-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <p className="text-[10px] text-indigo-300 mt-1">Code generation & testing results per iteration</p>
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-900 p-3 font-mono text-xs space-y-3"
      >
        {executions.length === 0 && !currentCode && (
          <div className="text-gray-500 text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Iteration results will appear here</p>
            <p className="text-[10px] mt-1">
              Each iteration: AI generates code {'->'} Tests on training {'->'} Shows pass/fail
            </p>
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
                  ITER {exec.iteration}
                </span>
                {exec.expert && (
                  <span className="text-[10px] text-blue-400 flex items-center gap-0.5 bg-blue-900/30 px-1 rounded">
                    <User className="w-3 h-3" /> Exp {exec.expert}
                  </span>
                )}
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
              </div>
            </div>

            {/* Training Results Details */}
            {exec.trainResults && exec.trainResults.length > 0 && (
              <div className="flex flex-wrap gap-1 my-1.5">
                {exec.trainResults.map((res, resIdx) => (
                  <div 
                    key={resIdx}
                    className={`w-2 h-2 rounded-full ${res.success ? 'bg-green-500' : 'bg-red-500'}`}
                    title={`Training Example ${resIdx + 1}: ${res.success ? 'Pass' : 'Fail'}${res.error ? ` - ${res.error}` : ''}`}
                  />
                ))}
                <span className="text-[9px] text-gray-500 ml-1">
                   ({exec.trainResults.filter(r => r.success).length}/{exec.trainResults.length} pass)
                </span>
              </div>
            )}

            {/* Error Output */}
            {exec.error && (
              <div className="text-red-300 text-[10px] mt-1 whitespace-pre-wrap border-t border-red-500/20 pt-1">
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
                <summary className="text-[10px] text-blue-400 cursor-pointer hover:text-blue-300 select-none">
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
