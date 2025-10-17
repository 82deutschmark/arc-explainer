/**
 * Author: gpt-5-codex
 * Date: 2025-10-17
 * PURPOSE: Presents ARC puzzle summary cards with status-driven gradients,
 *          emoji mosaics, and lazy-loaded grid previews for the browser page.
 * SRP/DRY check: Pass — Verified lazy loading and navigation remain intact.
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
    ? 'from-emerald-500/35 via-teal-500/25 to-sky-500/35'
    : 'from-rose-500/35 via-amber-400/25 to-violet-500/30';
  const statusText = isExplained ? 'Explained' : 'Needs Analysis';
  const statusColorClass = isExplained ? 'text-emerald-600' : 'text-rose-600';
  const buttonGradient = isExplained
    ? 'from-emerald-500 via-teal-500 to-sky-500'
    : 'from-rose-500 via-amber-500 to-violet-500';

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-2xl bg-gradient-to-br ${statusGradient} p-[1px] transition-all duration-300 hover:shadow-xl focus-within:shadow-xl`}
    >
      <div className="relative h-full rounded-[1.05rem] bg-white/95 p-4 backdrop-blur-sm shadow-sm transition-all duration-300 group-hover:bg-white group-focus-within:bg-white space-y-3">
        <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${statusColorClass}`}>
            {statusText}
          </span>
        </div>

        {/* Header - Name or ID */}
        <div className="space-y-1 pr-14">
          {hasName && puzzleName ? (
            <>
              <h3 className="text-base font-semibold text-gray-900 capitalize">
                {puzzleName}
              </h3>
              <code className="text-xs font-mono text-gray-500">
                {puzzle.id}
              </code>
            </>
          ) : (
            <code className="text-sm font-mono font-semibold text-gray-900">
              {puzzle.id}
            </code>
          )}
          
          {/* Source badge */}
          {puzzle.source && (
            <div className="inline-block">
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                {puzzle.source.replace('-Eval', '').replace('-Heavy', '').replace('ARC', 'ARC-')}
              </span>
            </div>
          )}
        </div>

        {/* Grid Preview */}
        {showGridPreview && firstTrainingExample && (
          <div className="rounded-xl bg-gradient-to-br from-slate-50 via-white to-sky-50 p-2 ring-1 ring-sky-100/70 transition-all duration-200 group-hover:ring-sky-300/80 group-focus-within:ring-sky-300/80">
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Input</p>
                <div className="w-full max-w-[80px]">
                  <TinyGrid grid={firstTrainingExample.input} />
                </div>
              </div>
              <div className="flex items-center text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Output</p>
                <div className="w-full max-w-[80px]">
                  <TinyGrid grid={firstTrainingExample.output} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Status */}
        <div className="flex items-center gap-2 text-sm">
          {isExplained ? (
            <>
              <span className="font-medium text-emerald-600">✓ Analyzed</span>
              {puzzle.modelName && (
                <span className="text-gray-500">by {puzzle.modelName.split('/').pop()}</span>
              )}
            </>
          ) : (
            <span className="text-gray-500">Awaiting explanation</span>
          )}
        </div>

        {/* Grid Info */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Grid3X3 className="h-4 w-4" />
            <span>{puzzle.maxGridSize}×{puzzle.maxGridSize}</span>
          </div>
          <span>{puzzle.gridSizeConsistent ? 'Consistent' : 'Variable'}</span>
        </div>

        {/* Action Button */}
        <div>
          <Link
            href={`/puzzle/${puzzle.id}`}
            className={`relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r ${buttonGradient} px-3 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
          >
            <Eye className="h-4 w-4" />
            Examine Puzzle
          </Link>
        </div>
      </div>
    </div>
  );
};
