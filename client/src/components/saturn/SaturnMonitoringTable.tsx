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
      {/* Compact Single-Row Status Bar */}
      <div className="border border-gray-300 bg-white">
        <div className="flex items-center gap-4 px-3 py-1.5 font-mono text-xs">
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold ${
            isRunning ? 'bg-blue-100 text-blue-800' : 
            state.status === 'completed' ? 'bg-green-100 text-green-800' : 
            state.status === 'error' ? 'bg-red-100 text-red-800' : 
            'bg-gray-100 text-gray-600'
          }`}>
            <span className="text-[9px]">●</span>
            {state.status?.toUpperCase() || 'IDLE'}
          </div>

          {/* Phase */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500 font-semibold">Phase:</span>
            <span className="text-gray-900">{state.phase || 'WAITING'}</span>
          </div>

          {/* Progress */}
          {state.step && state.totalSteps && (
            <div className="flex items-center gap-1">
              <span className="text-gray-500 font-semibold">Progress:</span>
              <span className="text-gray-900">{state.step}/{state.totalSteps}</span>
            </div>
          )}

          {/* Images Count */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-gray-500 font-semibold">Images:</span>
            <span className="text-gray-900">{state.galleryImages?.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
