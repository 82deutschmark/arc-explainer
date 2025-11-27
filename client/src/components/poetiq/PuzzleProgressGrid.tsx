/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Visual grid showing the status of all ARC2-eval puzzles for Poetiq solver.
 *          Redesigned to use ClickablePuzzleBadge pattern like analytics page with dark theme styling.
 *          Clicking a puzzle navigates to the solver page.
 *
 * SRP/DRY check: Pass - Single responsibility for puzzle progress visualization, reuses ClickablePuzzleBadge
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  CheckCircle,
  XCircle,
  Circle,
  Filter,
  Grid3X3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { PoetiqPuzzleStatus, PuzzleStatus } from '@/hooks/usePoetiqCommunityProgress';

interface PuzzleProgressGridProps {
  puzzles: PoetiqPuzzleStatus[];
  isLoading?: boolean;
  onPuzzleClick?: (puzzleId: string) => void;
}

type FilterOption = 'all' | 'solved' | 'attempted' | 'unattempted';

export function PuzzleProgressGrid({
  puzzles,
  isLoading = false,
  onPuzzleClick
}: PuzzleProgressGridProps) {
  const [filter, setFilter] = useState<FilterOption>('all');

  // Filter puzzles based on selected filter
  const filteredPuzzles = useMemo(() => {
    if (filter === 'all') return puzzles;
    return puzzles.filter(p => p.status === filter);
  }, [puzzles, filter]);

  // Count by status for filter badges
  const counts = useMemo(() => ({
    all: puzzles.length,
    solved: puzzles.filter(p => p.status === 'solved').length,
    attempted: puzzles.filter(p => p.status === 'attempted').length,
    unattempted: puzzles.filter(p => p.status === 'unattempted').length,
  }), [puzzles]);

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-12"
        style={{
          background: 'rgba(0, 217, 255, 0.03)',
          border: '1px solid rgba(0, 217, 255, 0.15)',
        }}
      >
        <div className="flex items-center justify-center gap-3 text-gray-400">
          <div className="h-6 w-6 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
          <span className="font-ibm">Scanning mission database...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.03) 0%, rgba(180, 255, 57, 0.03) 100%)',
        border: '1px solid rgba(0, 217, 255, 0.15)',
      }}
    >
      <div className="p-6 space-y-6">
        {/* Legend and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Legend */}
          <div className="flex items-center gap-6 text-sm font-ibm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-cyan-400" />
              <span className="text-cyan-300">Solved ({counts.solved})</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300">Failed ({counts.attempted})</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Pending ({counts.unattempted})</span>
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as FilterOption)}
              className="bg-gray-900/50 rounded-lg p-1 border border-gray-700"
            >
              <ToggleGroupItem
                value="all"
                className="text-xs px-3 py-1.5 h-auto font-ibm data-[state=on]:bg-cyan-500/20 data-[state=on]:text-cyan-300 text-gray-400"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="unattempted"
                className="text-xs px-3 py-1.5 h-auto font-ibm data-[state=on]:bg-gray-500/20 data-[state=on]:text-gray-300 text-gray-400"
              >
                Pending
              </ToggleGroupItem>
              <ToggleGroupItem
                value="solved"
                className="text-xs px-3 py-1.5 h-auto font-ibm data-[state=on]:bg-cyan-500/20 data-[state=on]:text-cyan-300 text-gray-400"
              >
                Solved
              </ToggleGroupItem>
              <ToggleGroupItem
                value="attempted"
                className="text-xs px-3 py-1.5 h-auto font-ibm data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-300 text-gray-400"
              >
                Failed
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Puzzle Badge Grid */}
        {filteredPuzzles.length === 0 ? (
          <div className="py-12 text-center text-gray-500 font-ibm">
            No missions match the selected filter
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
            {filteredPuzzles.map((puzzle) => (
              <PuzzleBadgeCell
                key={puzzle.puzzleId}
                puzzle={puzzle}
                onClick={() => onPuzzleClick?.(puzzle.puzzleId)}
              />
            ))}
          </div>
        )}

        {/* Show count when filtered */}
        {filter !== 'all' && (
          <div className="text-center text-sm text-gray-500 font-ibm">
            Displaying {filteredPuzzles.length} of {puzzles.length} missions
          </div>
        )}
      </div>
    </div>
  );
}

// Individual puzzle badge cell with dark theme styling
function PuzzleBadgeCell({
  puzzle,
  onClick
}: {
  puzzle: PoetiqPuzzleStatus;
  onClick?: () => void;
}) {
  const statusStyles: Record<PuzzleStatus, string> = {
    solved: 'text-cyan-300 border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20',
    attempted: 'text-amber-300 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20',
    unattempted: 'text-gray-400 border-gray-600 bg-gray-800/30 hover:bg-gray-700/50',
  };

  const statusIcons: Record<PuzzleStatus, React.ReactNode> = {
    solved: <CheckCircle className="h-3 w-3" />,
    attempted: <XCircle className="h-3 w-3" />,
    unattempted: <Circle className="h-3 w-3" />,
  };

  const handleClick = () => {
    onClick?.();
    window.open(`/puzzle/poetiq/${puzzle.puzzleId}`, '_blank');
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer transition-all duration-200 font-jetbrains justify-start gap-1.5 px-2 py-1.5 h-auto',
        statusStyles[puzzle.status]
      )}
      onClick={handleClick}
    >
      {statusIcons[puzzle.status]}
      <span className="truncate">{puzzle.puzzleId}</span>
    </Badge>
  );
}
