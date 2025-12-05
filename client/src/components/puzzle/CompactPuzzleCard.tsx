/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-03
 * PURPOSE: Reusable compact ARC puzzle card with lazy TinyGrid preview and cost/token metrics.
 *          Mirrors the PuzzleDBViewer inline card so multiple pages can surface identical previews.
 * SRP/DRY check: Pass — isolated presentational component, reuses shared types/utilities.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { ARCTask } from '@shared/types';
import type { PuzzleDBStats } from '@/hooks/usePuzzleDBStats';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { getPuzzleGif } from '@/utils/puzzleGifMap';

interface CompactPuzzleCardProps {
  puzzle: PuzzleDBStats;
  prefetchedTask?: ARCTask | null;
  lazyLoadGrid?: boolean;
  showMetrics?: boolean;
  onOpenDetails?: () => void;
  className?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export const CompactPuzzleCard: React.FC<CompactPuzzleCardProps> = ({
  puzzle,
  prefetchedTask = null,
  lazyLoadGrid = true,
  showMetrics = true,
  onOpenDetails,
  className = '',
}) => {
  const [taskData, setTaskData] = useState<ARCTask | null>(prefetchedTask);
  const [isVisible, setIsVisible] = useState(!lazyLoadGrid);
  const [hasRequestedTask, setHasRequestedTask] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const puzzleGifSrc = getPuzzleGif(puzzle.id);

  useEffect(() => {
    setTaskData(prefetchedTask ?? null);
  }, [prefetchedTask]);

  useEffect(() => {
    if (!lazyLoadGrid || !cardRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' },
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [lazyLoadGrid]);

  useEffect(() => {
    // Skip fetching grid data when an animated GIF is available.
    if (!isVisible || taskData || hasRequestedTask || puzzleGifSrc) return;

    let isCancelled = false;
    setHasRequestedTask(true);

    fetch(`/api/puzzle/task/${puzzle.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.success) {
          setTaskData(data.data);
        }
      })
      .catch(() => {
        // Silent failure keeps UI responsive even if preview can't load.
      });

    return () => {
      isCancelled = true;
    };
  }, [isVisible, taskData, hasRequestedTask, puzzle.id]);

  const firstPuzzleGrid =
    taskData?.test?.[0]?.output ??
    taskData?.test?.[0]?.input ??
    taskData?.train?.[0]?.output ??
    taskData?.train?.[0]?.input;

  const totalSpend =
    puzzle.performanceData.avgCost && puzzle.performanceData.totalExplanations
      ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations
      : 0;
  const totalTokens =
    puzzle.performanceData.avgTotalTokens && puzzle.performanceData.totalExplanations
      ? puzzle.performanceData.avgTotalTokens * puzzle.performanceData.totalExplanations
      : 0;

  const actionLabel =
    puzzle.performanceData.totalExplanations === 0 ? 'Analyze First' : 'View Analysis';

  const actionButton = (
    <button
      className="btn btn-outline btn-xs w-full mt-2"
      onClick={onOpenDetails}
      type="button"
    >
      {actionLabel}
    </button>
  );

  const cardClasses = ['card shadow-lg hover:shadow-xl transition-shadow bg-base-100 text-slate-900', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={cardRef} className={cardClasses}>
      <div className="card-body p-2">
        <div className="flex items-start justify-between mb-1 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-mono flex items-center gap-1 flex-wrap">
              <span className="truncate">{puzzle.id}</span>
              <div className="badge badge-outline badge-xs">{puzzle.source}</div>
            </h3>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="shrink-0" style={{ width: '64px', height: '64px' }}>
            {puzzleGifSrc && isVisible ? (
              <img
                src={puzzleGifSrc}
                alt={`Animated ARC preview for puzzle ${puzzle.id}`}
                className="w-full h-full rounded-sm border border-base-200 object-contain bg-base-200"
                loading="lazy"
              />
            ) : firstPuzzleGrid ? (
              <TinyGrid grid={firstPuzzleGrid} style={{ width: '64px', height: '64px' }} />
            ) : (
              <div className="w-full h-full rounded-sm bg-base-200 animate-pulse" />
            )}
          </div>

          {showMetrics && (
            <div className="flex-1 min-w-0">
              {puzzle.performanceData.totalExplanations > 0 ? (
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {totalSpend > 0 && (
                    <div>
                      <div className="font-bold">{formatCurrency(totalSpend)}</div>
                      <div className="text-base-content/60">Total $</div>
                    </div>
                  )}
                  {puzzle.performanceData.avgCost && puzzle.performanceData.avgCost > 0 && (
                    <div>
                      <div className="font-semibold">
                        {formatCurrency(puzzle.performanceData.avgCost)}
                      </div>
                      <div className="text-base-content/60">$/Attempt</div>
                    </div>
                  )}
                  {puzzle.performanceData.avgTotalTokens &&
                    puzzle.performanceData.avgTotalTokens > 0 && (
                      <div>
                        <div className="font-semibold">
                          {formatNumber(Math.round(puzzle.performanceData.avgTotalTokens))}
                        </div>
                        <div className="text-base-content/60">Tok/Attempt</div>
                      </div>
                    )}
                  {totalTokens > 0 && (
                    <div>
                      <div className="font-semibold">{formatNumber(Math.round(totalTokens))}</div>
                      <div className="text-base-content/60">Total Tok</div>
                    </div>
                  )}
                  {puzzle.performanceData.modelsAttemptedCount &&
                    puzzle.performanceData.modelsAttemptedCount > 0 && (
                      <div>
                        <div className="font-semibold">
                          {puzzle.performanceData.modelsAttemptedCount}
                        </div>
                        <div className="text-base-content/60">Models</div>
                      </div>
                    )}
                  {puzzle.performanceData.avgProcessingTime &&
                    puzzle.performanceData.avgProcessingTime > 0 && (
                      <div>
                        <div className="font-semibold">
                          {formatTime(Math.round(puzzle.performanceData.avgProcessingTime / 1000))}
                        </div>
                        <div className="text-base-content/60">Avg Time</div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-sm font-bold text-base-content/50">No Attempts</div>
                  <div className="text-xs text-base-content/60">Untested puzzle</div>
                </div>
              )}
            </div>
          )}
        </div>

        {onOpenDetails ? (
          actionButton
        ) : (
          <a
            href={`/puzzle/${puzzle.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {actionButton}
          </a>
        )}
      </div>
    </div>
  );
};
