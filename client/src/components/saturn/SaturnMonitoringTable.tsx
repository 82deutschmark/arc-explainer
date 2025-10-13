/**
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Monitoring table for Saturn solver - shows puzzle info, status, and controls.
 * ATC-style information-dense display with status color coding.
 * SRP: Single responsibility - monitoring and control display only
 * DRY: Pass - reusable component
 */

import React from 'react';
import { Rocket, Square } from 'lucide-react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';

interface Props {
  taskId: string;
  state: SaturnProgressState;
  isRunning: boolean;
  compact?: boolean;
}

export default function SaturnMonitoringTable({ taskId, state, isRunning, compact }: Props) {
  return (
    <div className="min-h-0 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center bg-amber-50 border-b border-amber-200">
        <h2 className="bg-amber-400 px-2 py-1 font-bold text-black text-sm">MONITORING TABLE</h2>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-[30%_1fr] gap-0 border border-gray-300 bg-white font-mono text-sm">
        {/* Puzzle ID */}
        <div className="border-r border-gray-300 p-3 bg-gray-50">
          <div className="text-xs text-amber-700 mb-1 font-bold">PUZZLE ID</div>
          <div className="text-gray-800">{taskId}</div>
        </div>

        {/* Status */}
        <div className="p-3">
          <div className="text-xs text-amber-700 mb-1 font-bold">STATUS</div>
          <div className={`inline-block px-2 py-1 text-xs font-bold ${
            isRunning ? 'bg-blue-100 text-blue-800' : 
            state.status === 'completed' ? 'bg-green-100 text-green-800' : 
            state.status === 'error' ? 'bg-red-100 text-red-800' : 
            'bg-gray-100 text-gray-600'
          }`}>
            {state.status?.toUpperCase() || 'IDLE'}
          </div>
        </div>

        {/* Phase */}
        <div className="border-r border-t border-gray-300 p-3 bg-gray-50">
          <div className="text-xs text-amber-700 mb-1 font-bold">PHASE</div>
          <div className="text-gray-800">{state.phase || 'WAITING'}</div>
        </div>

        {/* Progress */}
        <div className="border-t border-gray-300 p-3">
          <div className="text-xs text-amber-700 mb-1 font-bold">PROGRESS</div>
          <div className="text-gray-800">
            {state.step && state.totalSteps ? `${state.step}/${state.totalSteps}` : 'N/A'}
          </div>
        </div>

        {/* Images Generated */}
        <div className="border-r border-t border-gray-300 p-3 bg-gray-50">
          <div className="text-xs text-amber-700 mb-1 font-bold">IMAGES</div>
          <div className="text-gray-800">{state.galleryImages?.length || 0}</div>
        </div>

        {/* Log Lines */}
        <div className="border-t border-gray-300 p-3">
          <div className="text-xs text-amber-700 mb-1 font-bold">LOG LINES</div>
          <div className="text-gray-800">{state.logLines?.length || 0}</div>
        </div>
      </div>
    </div>
  );
}
