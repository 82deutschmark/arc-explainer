/**
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Work table for Saturn solver - shows phase history with status color coding.
 * ATC-style information-dense table following WorkTable patterns.
 * SRP: Single responsibility - phase/step tracking display
 * DRY: Pass - reusable component
 */

import React from 'react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';

interface Props {
  state: SaturnProgressState;
  isRunning: boolean;
  compact?: boolean;
}

export default function SaturnWorkTable({ state, isRunning, compact }: Props) {
  // Track phase history (accumulates across phases)
  const [phaseHistory, setPhaseHistory] = React.useState<Array<{
    phase: string;
    message?: string;
    status: string;
    timestamp: string;
  }>>([]);

  // Update phase history when phase changes
  React.useEffect(() => {
    const nextPhase = state.phase;
    if (!nextPhase) {
      return;
    }

    setPhaseHistory(prev => {
      const existingIndex = prev.findIndex(p => p.phase === nextPhase);
      const baseEntry = {
        phase: nextPhase,
        message: state.streamingMessage || state.message,
        timestamp: new Date().toLocaleTimeString()
      } as const;

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...baseEntry,
          status: isRunning ? 'in_progress' : state.status || 'completed'
        };
        return updated;
      }

      return [
        ...prev,
        {
          ...baseEntry,
          status: isRunning ? 'in_progress' : 'completed'
        }
      ];
    });
  }, [state.phase, state.message, state.streamingMessage, state.status, isRunning]);

  // Reset history when returning to idle
  React.useEffect(() => {
    if (state.status === 'idle') {
      setPhaseHistory([]);
    }
  }, [state.status]);

  return (
    <div className="min-h-0 overflow-hidden flex flex-col border border-gray-300 bg-white">
      {/* Header */}
      <div className="flex items-center bg-gray-100 border-b border-gray-300">
        <h2 className="text-sm text-gray-700 px-2 py-1 font-bold">WORK TABLE</h2>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b border-gray-300">
              <th className="text-left p-2 font-bold text-gray-700">PHASE</th>
              <th className="text-left p-2 font-bold text-gray-700">MESSAGE</th>
              <th className="text-left p-2 font-bold text-gray-700">STATUS</th>
              <th className="text-right p-2 font-bold text-gray-700">TIME</th>
            </tr>
          </thead>
          <tbody>
            {phaseHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-400">
                  NO PHASES YET
                </td>
              </tr>
            ) : (
              phaseHistory.map((item, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-200 ${
                    item.status === 'in_progress' ? 'bg-amber-50' :
                    item.status === 'completed' ? 'bg-emerald-50' :
                    item.status === 'error' ? 'bg-red-50' :
                    'bg-white'
                  }`}
                >
                  <td className="p-2 font-bold text-gray-800">{item.phase}</td>
                  <td className="p-2 text-gray-600">{item.message || '-'}</td>
                  <td className="p-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold ${
                      item.status === 'in_progress' ? 'bg-amber-200 text-amber-900' :
                      item.status === 'completed' ? 'bg-emerald-200 text-emerald-900' :
                      item.status === 'error' ? 'bg-red-200 text-red-900' :
                      'bg-gray-200 text-gray-700'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-right text-gray-500">{item.timestamp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Status Log Section */}
      {state.logLines && state.logLines.length > 0 && (
        <div className="border-t border-gray-300">
          <div className="bg-gray-100 px-2 py-1 border-b border-gray-300">
            <h3 className="text-xs font-bold text-gray-700">DETAILED STATUS LOG</h3>
          </div>
          <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 font-mono text-[10px] leading-tight">
            {state.logLines.map((line, idx) => (
              <div
                key={idx}
                className={`${
                  line.includes('ERROR') ? 'text-red-600 font-bold' :
                  line.includes('Phase') ? 'text-blue-600 font-semibold' :
                  line.includes('complete') ? 'text-emerald-600' :
                  'text-gray-700'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="border-t border-gray-300 bg-gray-50 p-2 flex items-center justify-between text-xs font-mono">
        <span className="text-gray-600">TOTAL PHASES: {phaseHistory.length}</span>
        <span className={`font-bold ${isRunning ? 'text-blue-600' : 'text-gray-600'}`}>
          {isRunning ? '● RUNNING' : '○ IDLE'}
        </span>
      </div>
    </div>
  );
}
