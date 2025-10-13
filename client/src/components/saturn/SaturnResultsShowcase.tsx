/**
 * client/src/components/saturn/SaturnResultsShowcase.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Beautiful results showcase for Saturn Visual Solver displaying analysis results,
 * token usage, and session information in an elegant card layout.
 *
 * SRP/DRY check: Pass - Single responsibility for results presentation
 * DaisyUI: Pass - Uses DaisyUI card and stats components
 */

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

interface SaturnResultsShowcaseProps {
  results: any;
  sessionId: string | null;
  isRunning: boolean;
}

export default function SaturnResultsShowcase({ results, sessionId, isRunning }: SaturnResultsShowcaseProps) {
  if (isRunning) {
    return (
      <div className="card bg-white/90 backdrop-blur-sm border-0 shadow-xl">
        <div className="card-body p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h3 className="font-medium text-gray-800">Results Pending</h3>
          </div>
          <div className="text-sm text-gray-600">
            Analysis in progress...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-white/90 backdrop-blur-sm border-0 shadow-xl">
      <div className="card-body p-4">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-800">Analysis Complete</h3>
        </div>

        {/* Session Info */}
        {sessionId && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-600 mb-1">Session ID</div>
            <div className="font-mono text-sm text-gray-800 break-all">{sessionId}</div>
          </div>
        )}

        {/* Results Content */}
        <div className="space-y-3">
          {results && typeof results === 'object' ? (
            <>
              {/* Pattern Description */}
              {results.patternDescription && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Pattern Analysis</div>
                  <div className="text-sm text-gray-800 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                    {results.patternDescription}
                  </div>
                </div>
              )}

              {/* Solving Strategy */}
              {results.solvingStrategy && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Solution Strategy</div>
                  <div className="text-sm text-gray-800 bg-green-50 p-2 rounded border-l-4 border-green-400">
                    {results.solvingStrategy}
                  </div>
                </div>
              )}

              {/* Confidence Score */}
              {results.confidence !== undefined && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Confidence</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          results.confidence >= 80 ? 'bg-green-500' :
                          results.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${results.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{results.confidence}%</span>
                  </div>
                </div>
              )}

              {/* Token Usage */}
              {results.tokenUsage && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-purple-50 rounded">
                    <div className="text-xs text-purple-600 font-medium">Input</div>
                    <div className="text-sm font-bold text-purple-800">
                      {results.tokenUsage.input || 0}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <div className="text-xs text-orange-600 font-medium">Output</div>
                    <div className="text-sm font-bold text-orange-800">
                      {results.tokenUsage.output || 0}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Simple Results Display */
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
