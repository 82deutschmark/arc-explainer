/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Visual grid showing status of all ARC2-eval puzzles for Poetiq solver.
 *          Matches analytics page pattern with readable badge cells.
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

  // Count by status
  const counts = useMemo(() => ({
    all: puzzles.length,
    solved: puzzles.filter(p => p.status === 'solved').length,
    attempted: puzzles.filter(p => p.status === 'attempted').length,
    unattempted: puzzles.filter(p => p.status === 'unattempted').length,
  }), [puzzles]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <div className="h-5 w-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
            <span>Loading puzzles...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Legend */}
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Solved ({counts.solved})</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-gray-600">Failed ({counts.attempted})</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Circle className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Pending ({counts.unattempted})</span>
            </div>
          </div>

          {/* Filter */}
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as FilterOption)}
            size="sm"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="unattempted">Pending</ToggleGroupItem>
            <ToggleGroupItem value="solved">Solved</ToggleGroupItem>
            <ToggleGroupItem value="attempted">Failed</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredPuzzles.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No puzzles match the selected filter
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 text-xs">
            {filteredPuzzles.map((puzzle) => (
              <PuzzleBadgeCell
                key={puzzle.puzzleId}
                puzzle={puzzle}
                onClick={() => onPuzzleClick?.(puzzle.puzzleId)}
              />
            ))}
          </div>
        )}

        {filter !== 'all' && (
          <div className="text-center text-sm text-gray-500 mt-3">
            Showing {filteredPuzzles.length} of {puzzles.length} puzzles
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Individual puzzle badge cell matching analytics page style
function PuzzleBadgeCell({
  puzzle,
  onClick
}: {
  puzzle: PoetiqPuzzleStatus;
  onClick?: () => void;
}) {
  const statusStyles: Record<PuzzleStatus, string> = {
    solved: 'text-green-700 border-green-300 bg-green-50 hover:bg-green-100',
    attempted: 'text-red-700 border-red-300 bg-red-50 hover:bg-red-100',
    unattempted: 'text-gray-700 border-gray-300 bg-gray-50 hover:bg-gray-100',
  };

  const statusIcons: Record<PuzzleStatus, React.ReactNode> = {
    solved: <CheckCircle className="h-3 w-3" />,
    attempted: <XCircle className="h-3 w-3" />,
    unattempted: <Circle className="h-3 w-3" />,
  };

  const handleClick = () => {
    onClick?.();
    window.open(`/task/${puzzle.puzzleId}`, '_blank');
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer transition-colors font-mono justify-start gap-1.5 px-2 py-1.5 h-auto',
        statusStyles[puzzle.status]
      )}
      onClick={handleClick}
    >
      {statusIcons[puzzle.status]}
      <span className="truncate">{puzzle.puzzleId}</span>
    </Badge>
  );
}
