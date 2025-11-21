/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-20 / Updated 2025-11-21
 * PURPOSE: Presents ARC puzzle summary cards with status-driven gradients,
 *          lazy-loaded grid previews, and information-dense performance metrics.
 *          FIXED: Replaces misleading "Solve Rate: 0%" for unsolved puzzles with binary correctness:
 *                 - "Status: Never Tried" for puzzles with no attempts
 *                 - "Correctness: ❌ Unsolved" for puzzles with failed attempts
 *                 - "Solve Rate: X%" only shown when puzzle has some success (accuracy > 0)
 * SRP/DRY check: Pass — Verified lazy loading and navigation remain intact, single responsibility (puzzle card display).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { Eye, Grid3X3 } from 'lucide-react';
import { TinyGrid } from './TinyGrid';
import { getPuzzleName, hasPuzzleName } from '@shared/utils/puzzleNames';
import type { ARCTask } from '@shared/types';

interface PuzzleCardProps {
  puzzle: {
    id: string;
    source?: string;
    maxGridSize: number;
    gridSizeConsistent: boolean;
    hasExplanation?: boolean;
    modelName?: string;
    hasMultiplePredictions?: boolean;

    // Performance data (may be optional in some contexts)
    performanceData?: {
      avgAccuracy: number;            // 0.0 - 1.0, server-clamped
      totalExplanations: number;      // Total attempts (explanations)
      // Prefer counts from server-side aggregation when present
      modelsAttemptedCount?: number;  // Distinct models that attempted this puzzle
      // Backwards-compat: some callers may still pass an array
      modelsAttempted?: string[];     // Legacy list of model names
      avgCost?: number;               // Average cost per attempt
      avgProcessingTime?: number;     // Milliseconds
      wrongCount?: number;            // Number of incorrect attempts
    };
  };
  showGridPreview?: boolean;
}

export const PuzzleCard: React.FC<PuzzleCardProps> = ({ 
  puzzle, 
  showGridPreview = true 
}) => {
  const [taskData, setTaskData] = useState<ARCTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const puzzleName = getPuzzleName(puzzle.id);
  const hasName = hasPuzzleName(puzzle.id);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!showGridPreview || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, [showGridPreview]);

  // Load puzzle data when visible
  useEffect(() => {
    if (!isVisible || taskData) return;

    fetch(`/api/puzzle/task/${puzzle.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTaskData(data.data);
        }
      })
      .catch(() => {
        // Silent fail - just don't show grid
      });
  }, [isVisible, puzzle.id, taskData]);

  const firstTrainingExample = taskData?.train?.[0];
  const isExplained = Boolean(puzzle.hasExplanation);
  const statusGradient = isExplained
    ? 'from-emerald-400/80 via-teal-400/70 to-sky-500/80'
    : 'from-rose-500/80 via-amber-400/70 to-violet-600/80';
  const statusText = isExplained ? 'Explained' : 'Needs Analysis';
  const statusColorClass = isExplained ? 'text-emerald-600' : 'text-rose-600';
  const buttonGradient = isExplained
    ? 'from-emerald-500 via-teal-500 to-sky-500'
    : 'from-rose-600 via-amber-500 to-violet-600';

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-[2.25rem] bg-gradient-to-br ${statusGradient} p-[3px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)] focus-within:-translate-y-1 focus-within:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)]`}
    >
      <div className="relative h-full rounded-[2rem] bg-gradient-to-br from-white via-slate-50 to-sky-50 p-7 backdrop-blur-sm shadow-lg transition-all duration-300 group-hover:translate-y-[-2px] group-hover:shadow-xl group-focus-within:translate-y-[-2px] group-focus-within:shadow-xl space-y-5">
        <div className="pointer-events-none absolute right-7 top-7 flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${statusColorClass}`}>
            {statusText}
          </span>
        </div>

        {/* Header - Name or ID */}
        <div className="space-y-3 pr-24">
          {hasName && puzzleName ? (
            <>
              <h3 className="text-xl font-semibold text-gray-900 capitalize">
                {puzzleName}
              </h3>
              <code className="text-base font-mono text-gray-500">
                {puzzle.id}
              </code>
            </>
          ) : (
            <code className="text-lg font-mono font-semibold text-gray-900">
              {puzzle.id}
            </code>
          )}

          {/* Source badge */}
          {puzzle.source && (
            <div className="inline-block">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {puzzle.source.replace('-Eval', '').replace('-Heavy', '').replace('ARC', 'ARC-')}
              </span>
            </div>
          )}
        </div>

        {/* Grid Preview */}
        {showGridPreview && firstTrainingExample && (
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 via-white to-sky-100/80 p-4 ring-1 ring-sky-200/80 transition-all duration-200 group-hover:ring-sky-400 group-focus-within:ring-sky-400">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="mb-1 text-sm font-semibold text-gray-500">Input</p>
                <div className="w-full max-w-[140px]">
                  <TinyGrid grid={firstTrainingExample.input} />
                </div>
              </div>
              <div className="flex items-center text-gray-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="mb-1 text-sm font-semibold text-gray-500">Output</p>
                <div className="w-full max-w-[140px]">
                  <TinyGrid grid={firstTrainingExample.output} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics - Information Dense */}
        <div className="space-y-3">
          {/* Row 1: Correctness & Attempts */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {/* Show different label based on whether puzzle has been solved */}
              {(() => {
                const hasAttempts = puzzle.performanceData && puzzle.performanceData.totalExplanations > 0;
                const accuracy = puzzle.performanceData?.avgAccuracy || 0;
                const isSolved = accuracy > 0;

                if (!hasAttempts) {
                  return (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                      <p className="text-2xl font-bold text-gray-900">Never Tried</p>
                    </>
                  );
                } else if (!isSolved) {
                  // Unsolved but has attempts - show binary failure status
                  return (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Correctness</p>
                      <p className="text-2xl font-bold text-red-600">❌ Unsolved</p>
                    </>
                  );
                } else {
                  // Has some success - show actual solve rate
                  return (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Solve Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.min(100, Math.max(0, accuracy * 100)).toFixed(1)}%
                      </p>
                    </>
                  );
                }
              })()}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attempts</p>
              <p className="text-2xl font-bold text-gray-900">
                {puzzle.performanceData?.totalExplanations || 0}
              </p>
            </div>
          </div>

          {/* Row 2: Models & Test Cases */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Models Tested</p>
              <p className="text-lg font-bold text-gray-900">
                {(() => {
                  const perf = puzzle.performanceData;
                  if (!perf) return 0;
                  if (typeof perf.modelsAttemptedCount === 'number') {
                    return perf.modelsAttemptedCount;
                  }
                  return perf.modelsAttempted?.length || 0;
                })()}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Test Cases</p>
              <p className="text-lg font-bold text-gray-900">
                {puzzle.hasMultiplePredictions ? 'Multi' : 'Single'}
              </p>
            </div>
          </div>

          {/* Row 3: Status Badges */}
          <div className="flex flex-wrap gap-2">
            {/* Unsolved Badge - Highest Priority */}
            {puzzle.performanceData?.avgAccuracy === 0 && puzzle.performanceData?.totalExplanations > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                🔥 UNSOLVED - 0% Success
              </span>
            )}

            {/* Solved by All Badge */}
            {puzzle.performanceData?.avgAccuracy === 1.0 && puzzle.performanceData?.totalExplanations > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                ✅ Solved by all models
              </span>
            )}

            {/* Cost Badge */}
            {puzzle.performanceData?.avgCost && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                💰 ${puzzle.performanceData.avgCost.toFixed(3)} avg
              </span>
            )}
          </div>
        </div>

        {/* Grid Info */}
        <div className="flex items-center gap-5 text-base text-gray-600">
          <div className="flex items-center gap-1.5">
            <Grid3X3 className="h-6 w-6" />
            <span className="font-semibold">{puzzle.maxGridSize}×{puzzle.maxGridSize}</span>
          </div>
          <span className="font-medium">{puzzle.gridSizeConsistent ? 'Consistent grid' : 'Variable grid'}</span>
        </div>

        {/* Action Button */}
        <div>
          <Link
            href={`/puzzle/${puzzle.id}`}
            className={`relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r ${buttonGradient} px-5 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-200 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
          >
            <Eye className="h-6 w-6" />
            Examine Puzzle
          </Link>
        </div>
      </div>
    </div>
  );
};
