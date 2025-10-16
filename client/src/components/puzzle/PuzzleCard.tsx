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
      className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
    >
      <div className="p-4 space-y-3">
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
          <div className="bg-gray-50 rounded border border-gray-200 p-2">
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
        <Link href={`/puzzle/${puzzle.id}`} className="btn btn-primary btn-sm w-full">
          <Eye className="h-4 w-4 mr-2" />
          Examine Puzzle
        </Link>
      </div>
    </div>
  );
};
