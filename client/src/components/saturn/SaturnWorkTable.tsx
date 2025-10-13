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
  // Build phase history from logs
  const phases = React.useMemo(() => {
    const phaseList: Array<{ phase: string; message?: string; status: string; timestamp: string }> = [];
    
    if (state.phase) {
      phaseList.push({
        phase: state.phase,
        message: state.message,
        status: isRunning ? 'in_progress' : state.status || 'idle',
        timestamp: new Date().toLocaleTimeString()
      });
    }
    
    return phaseList;
  }, [state.phase, state.message, state.status, isRunning]);

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
            {phases.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-400">
                  NO PHASES YET
                </td>
              </tr>
            ) : (
              phases.map((item, idx) => (
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

      {/* Footer Stats */}
      <div className="border-t border-gray-300 bg-gray-50 p-2 flex items-center justify-between text-xs font-mono">
        <span className="text-gray-600">TOTAL PHASES: {phases.length}</span>
        <span className={`font-bold ${isRunning ? 'text-blue-600' : 'text-gray-600'}`}>
          {isRunning ? '● RUNNING' : '○ IDLE'}
        </span>
      </div>
    </div>
  );
}
