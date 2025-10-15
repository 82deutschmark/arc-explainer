/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-15
 * PURPOSE: Timeline showing Saturn's real iterative workflow - 5 iterations with program attempts,
 * grading system (0-10 scale), context saturation strategy, and phased analysis (visual, color-normalized).
 * Surfaces reasoning history, tool usage, and the Grover-inspired search algorithm mechanics.
 *
 * SATURN WORKFLOW (from README):
 * - Iteration 1: Initial attempts with varying context
 * - Iteration 2: Visual analysis with images
 * - Iteration 3: Color-normalized representations
 * - Iteration 4: Full training + test images to LLM
 * - Iteration 5: Final run after removing low-scoring attempts
 * Each iteration generates 3-5 program attempts, graded 0-10, sorted by quality
 *
 * SRP/DRY check: Pass - Displays real Saturn workflow data
 * DaisyUI: Pass - Uses DaisyUI components
 */

import React from 'react';
import { Layers, Image, CheckCircle, TrendingUp, Code, Star } from 'lucide-react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';

export interface SaturnPhaseTimelineProps {
  state: SaturnProgressState;
  isRunning: boolean;
  compact?: boolean;
}

interface IterationData {
  iteration: number;
  phase: string;
  attempts: number;
  bestGrade?: number;
  description: string;
  status: 'pending' | 'active' | 'completed';
}

function parseIterationsFromState(state: SaturnProgressState): IterationData[] {
  const iterations: IterationData[] = [
    { iteration: 1, phase: 'Initial Context', attempts: 0, description: 'Generate 3-5 programs with varying context', status: 'pending' },
    { iteration: 2, phase: 'Visual Analysis', attempts: 0, description: 'Add image analysis to guide solution paths', status: 'pending' },
    { iteration: 3, phase: 'Color Normalized', attempts: 0, description: 'Test with color-normalized representations', status: 'pending' },
    { iteration: 4, phase: 'Full Visual Context', attempts: 0, description: 'Provide all training + test images to LLM', status: 'pending' },
    { iteration: 5, phase: 'Context Pruning', attempts: 0, description: 'Remove low-scoring attempts, final generation', status: 'pending' },
  ];

  const currentIteration = state.step || 1;
  iterations.forEach((iter, idx) => {
    if (idx < currentIteration - 1) {
      iter.status = 'completed';
    } else if (idx === currentIteration - 1) {
      iter.status = 'active';
    }
  });

  return iterations;
}

export default function SaturnPhaseTimeline({ state, isRunning, compact = false }: SaturnPhaseTimelineProps) {
  const iterations = parseIterationsFromState(state);
  const progress = state.progress || (state.step && state.totalSteps ? (state.step / state.totalSteps) * 100 : 0);

/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-15
 * PURPOSE: Ultra-compact Saturn workflow display - no bullshit styling, just essential iteration info
 */

import React from 'react';
import { Layers, Image, CheckCircle, TrendingUp, Code, Star, Activity } from 'lucide-react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';

export interface SaturnPhaseTimelineProps {
  state: SaturnProgressState;
  isRunning: boolean;
  compact?: boolean;
}

interface IterationData {
  iteration: number;
  phase: string;
  attempts: number;
  bestGrade?: number;
  description: string;
  status: 'pending' | 'active' | 'completed';
}

function parseIterationsFromState(state: SaturnProgressState): IterationData[] {
  const iterations: IterationData[] = [
    { iteration: 1, phase: 'Initial Context', attempts: 0, description: '3-5 programs, varying context', status: 'pending' },
    { iteration: 2, phase: 'Visual Analysis', attempts: 0, description: 'Add image analysis entropy', status: 'pending' },
    { iteration: 3, phase: 'Color Normalized', attempts: 0, description: 'Test normalized representations', status: 'pending' },
    { iteration: 4, phase: 'Full Visual Context', attempts: 0, description: 'All train+test images to LLM', status: 'pending' },
    { iteration: 5, phase: 'Context Pruning', attempts: 0, description: 'Remove low-scoring attempts', status: 'pending' },
  ];

  const currentIteration = state.step || 1;
  iterations.forEach((iter, idx) => {
    if (idx < currentIteration - 1) {
      iter.status = 'completed';
    } else if (idx === currentIteration - 1) {
      iter.status = 'active';
    }
  });

  return iterations;
}

export default function SaturnPhaseTimeline({ state, isRunning, compact = false }: SaturnPhaseTimelineProps) {
  const iterations = parseIterationsFromState(state);
  const progress = state.progress || (state.step && state.totalSteps ? (state.step / state.totalSteps) * 100 : 0);

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">Saturn Workflow</span>
          <span className="text-gray-500">Iter {state.step || 0}/5</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-blue-600 font-mono text-xs">{Math.round(progress)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200">
      {/* Compact Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-sm">Saturn Workflow</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>Iter {state.step || 0}/5</span>
            <div className="flex items-center gap-1">
              <Activity className={`w-3 h-3 ${isRunning ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={isRunning ? 'text-green-600' : 'text-gray-500'}>
                {isRunning ? 'RUNNING' : 'IDLE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-blue-600 font-mono text-xs font-bold">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Iteration List - Ultra Compact */}
      <div className="max-h-64 overflow-y-auto">
        {iterations.map((iter) => {
          const isActive = iter.status === 'active';
          const isCompleted = iter.status === 'completed';

          return (
            <div
              key={iter.iteration}
              className={`px-3 py-2 border-b border-gray-100 text-sm ${
                isActive ? 'bg-blue-50 border-blue-200' :
                isCompleted ? 'bg-green-50 border-green-200' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive ? 'bg-blue-500 text-white' :
                    isCompleted ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {iter.iteration}
                  </span>
                  <div>
                    <span className={`font-medium ${isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-700'}`}>
                      {iter.phase}
                    </span>
                    {isActive && isRunning && (
                      <span className="ml-2 text-xs text-blue-600">●</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {iter.iteration === 2 && <Image className="w-3 h-3 text-purple-500" />}
                  {iter.iteration === 5 && <TrendingUp className="w-3 h-3 text-amber-500" />}
                  {iter.attempts > 0 && (
                    <span className="text-xs text-gray-500">
                      {iter.attempts}p
                    </span>
                  )}
                  {iter.bestGrade && (
                    <span className="text-xs text-amber-600">
                      {iter.bestGrade}/10
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {iter.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer - Essential Info Only */}
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-2">
        <div className="text-xs text-gray-600 grid grid-cols-1 gap-1">
          <div>• 3-5 programs per iteration, graded 0-10</div>
          <div>• Early exit: test match OR 2×10/10 scores</div>
        </div>
      </div>
    </div>
  );
}
