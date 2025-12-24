/**
 * Author: Codex (GPT-5) / Refactored by Claude Sonnet 4
 * Date: 2025-12-03 / Refactored 2025-12-05
 * PURPOSE: Compact ARC puzzle card following PuzzleCard patterns with shadcn/ui.
 *          Fixed: theme mismatch, tiny grids, poor navigation, excessive whitespace.
 * SRP/DRY check: Pass — uses shadcn/ui Card, CSS variables for theming, wouter Link.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import type { ARCTask } from '@shared/types';
import type { PuzzleDBStats } from '@/hooks/usePuzzleDBStats';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { getPuzzleGif } from '@/utils/puzzleGifMap';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CompactPuzzleCardProps {
  puzzle: PuzzleDBStats;
  prefetchedTask?: ARCTask | null;
  lazyLoadGrid?: boolean;
  showMetrics?: boolean;
  onOpenDetails?: () => void;
  className?: string;
}

function formatCurrency(amount: number) {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
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
  const attemptCount = puzzle.performanceData.totalExplanations;
  const wrongCount = puzzle.performanceData.wrongCount ?? 0;
  const testCount = taskData?.test?.length ?? taskData?.train?.length ?? 0;
  const gridHeight = firstPuzzleGrid?.length ?? taskData?.train?.[0]?.input?.length ?? 0;
  const gridWidth =
    firstPuzzleGrid?.[0]?.length ??
    taskData?.train?.[0]?.input?.[0]?.length ??
    0;
  const gridSizeLabel =
    gridWidth > 0 && gridHeight > 0 ? `${gridWidth}×${gridHeight}` : '—';
  const testsLabel =
    testCount > 1 ? `${testCount}` : testCount === 1 ? 'Single' : '—';
  const generalStats = [
    { label: 'Attempts', value: attemptCount },
    { label: 'Wrong', value: wrongCount },
    { label: 'Tests', value: testsLabel },
    { label: 'Grid', value: gridSizeLabel },
  ];

  const totalSpend =
    puzzle.performanceData.avgCost && puzzle.performanceData.totalExplanations
      ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations
      : 0;

  // Card content - wrapped in Link for navigation
  const cardContent = (
    <Card
      ref={cardRef}
      className={`group h-full transition-shadow hover:shadow-md cursor-pointer ${className}`}
    >
      <CardContent className="p-3 h-full flex flex-col gap-2">
        {/* Header: ID + Source Badge */}
        <div className="flex items-start justify-between gap-2">
          <code className="text-sm font-mono font-semibold text-card-foreground truncate flex-1">
            {puzzle.id}
          </code>
          <Badge variant="outline" className="text-[9px] shrink-0">
            {puzzle.source}
          </Badge>
        </div>

        {/* Main Content: Grid + Metrics Side-by-Side */}
        <div className="grid grid-cols-[80px_1fr] gap-3 flex-1">
          {/* Grid Preview - Left Side (80px like PuzzleCard) */}
          <div className="w-20 h-20 flex items-center justify-center bg-gray-900 rounded border overflow-hidden">
            {puzzleGifSrc && isVisible ? (
              <img
                src={puzzleGifSrc}
                alt={`Animated ARC preview for puzzle ${puzzle.id}`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : firstPuzzleGrid ? (
              <TinyGrid
                grid={firstPuzzleGrid}
                style={{ maxWidth: '80px', maxHeight: '80px' }}
              />
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}
          </div>

          {/* Metrics Table - Right Side */}
          {showMetrics && (
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              {generalStats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {stat.label}
                  </div>
                  <div className="text-sm font-semibold text-card-foreground">
                    {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                  </div>
                </div>
              ))}

              {/* Cost metrics - only if attempts > 0 */}
              {attemptCount > 0 && totalSpend > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Total $
                  </div>
                  <div className="text-sm font-semibold text-card-foreground">
                    {formatCurrency(totalSpend)}
                  </div>
                </div>
              )}
              {attemptCount > 0 && puzzle.performanceData.avgProcessingTime && puzzle.performanceData.avgProcessingTime > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Avg Time
                  </div>
                  <div className="text-sm font-semibold text-card-foreground">
                    {formatTime(puzzle.performanceData.avgProcessingTime)}
                  </div>
                </div>
              )}
              {attemptCount > 0 && puzzle.performanceData.modelsAttemptedCount && puzzle.performanceData.modelsAttemptedCount > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Models
                  </div>
                  <div className="text-sm font-semibold text-card-foreground">
                    {puzzle.performanceData.modelsAttemptedCount}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: View Analysis link */}
        <div className="pt-1 mt-auto border-t border-border">
          <div className="text-xs text-muted-foreground group-hover:text-primary transition-colors font-medium">
            {attemptCount === 0 ? 'Analyze Puzzle →' : 'View Analysis →'}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // If onOpenDetails provided, use that; otherwise wrap in Link
  if (onOpenDetails) {
    return (
      <div onClick={onOpenDetails} className="cursor-pointer">
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={`/task/${puzzle.id}`}>
      {cardContent}
    </Link>
  );
};
