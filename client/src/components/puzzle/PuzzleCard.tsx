/**
 * PuzzleCard.tsx
 * 
 * Author: Cascade using DeepSeek V3
 * Date: 2025-10-15
 * PURPOSE: Enhanced puzzle card component for the browser page.
 * Displays puzzle ID, name (if available), grid preview, and analysis status.
 * Lazy loads puzzle grids only when card is visible (intersection observer).
 * 
 * FEATURES:
 * - Named puzzles show friendly name prominently
 * - Optional grid preview (first training example)
 * - Clean, professional styling consistent with redesigned landing page
 * - Lazy loading for performance
 * - Clickable to navigate to puzzle details
 * 
 * SRP/DRY check: Pass - Single responsibility for puzzle card display
 * DaisyUI: Pass - Uses DaisyUI components and classes
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

  return (
    <div
      ref={cardRef}
      className="group relative rounded-2xl bg-gradient-to-br from-blue-600/35 via-indigo-500/25 to-purple-600/35 p-[1px] transition-all duration-300 hover:shadow-xl focus-within:shadow-xl hover:from-blue-600/45 hover:via-indigo-500/35 hover:to-purple-600/45 focus-within:from-blue-600/45 focus-within:via-indigo-500/35 focus-within:to-purple-600/45"
    >
      <div className="relative h-full rounded-[1.05rem] bg-white/95 p-4 backdrop-blur-sm shadow-sm transition-all duration-300 group-hover:bg-white group-focus-within:bg-white space-y-3">
        {/* Header - Name or ID */}
        <div className="space-y-1">
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
          <div className="rounded-xl bg-slate-50/90 p-2 outline outline-1 outline-blue-200/70 transition-all duration-200 group-hover:outline-blue-400/80 group-focus-within:outline-blue-400/80">
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
          {puzzle.hasExplanation ? (
            <>
              <span className="text-green-600 font-medium">✓ Analyzed</span>
              {puzzle.modelName && (
                <span className="text-gray-500">by {puzzle.modelName.split('/').pop()}</span>
              )}
            </>
          ) : (
            <span className="text-gray-500">Not analyzed</span>
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
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span
              aria-hidden="true"
              className="inline-grid grid-cols-2 gap-[1px] rounded-sm bg-blue-100/80 p-0.5 text-[9px] leading-[0.7rem] text-blue-700 transition-transform duration-200 group-hover:scale-110 group-focus-within:scale-110"
            >
              <span>🟦</span>
              <span>🟦</span>
              <span>🟪</span>
              <span>🟪</span>
            </span>
            <span
              aria-hidden="true"
              className="inline-grid grid-cols-2 gap-[1px] rounded-sm bg-purple-100/80 p-0.5 text-[9px] leading-[0.7rem] text-purple-700 transition-transform duration-200 group-hover:scale-110 group-focus-within:scale-110"
            >
              <span>🟪</span>
              <span>🟪</span>
              <span>🟦</span>
              <span>🟦</span>
            </span>
          </div>
          <Link
            href={`/puzzle/${puzzle.id}`}
            className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-indigo-800 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Eye className="h-4 w-4" />
            Examine Puzzle
          </Link>
        </div>
      </div>
    </div>
  );
};
