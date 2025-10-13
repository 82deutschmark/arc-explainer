/**
 * client/src/components/saturn/SaturnProgressTracker.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Modern progress tracker for Saturn Visual Solver with visual progress bars,
 * phase indicators, and elapsed time display.
 *
 * SRP/DRY check: Pass - Single responsibility for progress visualization
 * DaisyUI: Pass - Uses DaisyUI progress and badge components
 */

import React from 'react';
import { Clock, Zap, Loader2 } from 'lucide-react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';

interface SaturnProgressTrackerProps {
  state: SaturnProgressState;
  isRunning: boolean;
  startTime: Date | null;
}

export default function SaturnProgressTracker({ state, isRunning, startTime }: SaturnProgressTrackerProps) {
  const getElapsedTime = () => {
    if (!startTime) return null;
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!state.totalSteps || !state.step) return 0;
    return Math.min((state.step / state.totalSteps) * 100, 100);
  };

  const getPhaseColor = () => {
    if (!state.phase) return 'bg-gray-400';
    const phase = state.phase.toLowerCase();
    if (phase.includes('error') || phase.includes('failed')) return 'bg-red-500';
    if (phase.includes('complete') || phase.includes('success')) return 'bg-green-500';
    if (phase.includes('analyzing') || phase.includes('processing')) return 'bg-blue-500';
    if (phase.includes('generating') || phase.includes('creating')) return 'bg-purple-500';
    return 'bg-yellow-500';
  };

  return (
    <div className="card bg-white/90 backdrop-blur-sm border-0 shadow-xl">
      <div className="card-body p-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <h3 className="font-medium text-gray-800">Progress</h3>
          </div>
          {isRunning && (
            <div className="flex items-center gap-1 text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs font-medium">Live</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="mb-3">
          <div className={`badge badge-lg w-full justify-center gap-2 ${isRunning ? 'badge-info' : state.status === 'completed' ? 'badge-success' : state.status === 'error' ? 'badge-error' : 'badge-neutral'}`}>
            {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
            {state.status || 'Ready'}
          </div>
        </div>

        {/* Current Phase */}
        {state.phase && (
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-700 mb-1">Current Phase</div>
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              {state.phase}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isRunning && state.totalSteps && (
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Step {state.step || 0} of {state.totalSteps}</span>
              <span>{Math.round(getProgressPercentage())}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getPhaseColor()}`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>
        )}

        {/* Elapsed Time */}
        {startTime && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Elapsed: {getElapsedTime()}</span>
          </div>
        )}

        {/* Progress Message */}
        {state.message && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">{state.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
