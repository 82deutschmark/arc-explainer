/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-26
 * PURPOSE: Visual grid showing the status of all ARC2-eval puzzles for Poetiq solver.
 *          Color-coded: green (solved), orange (attempted/failed), gray (unattempted).
 *          Clicking a puzzle navigates to the solver page.
 * 
 * SRP/DRY check: Pass - Single responsibility for puzzle progress visualization
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <div className="h-5 w-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
            <span>Loading puzzle progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-indigo-600" />
          Puzzle Progress Grid
        </CardTitle>
        <CardDescription>
          Click any puzzle to run the Poetiq solver on it
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-gray-600">Solved ({counts.solved})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span className="text-gray-600">Attempted ({counts.attempted})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-gray-300" />
              <span className="text-gray-600">Not tried ({counts.unattempted})</span>
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <ToggleGroup 
              type="single" 
              value={filter} 
              onValueChange={(v) => v && setFilter(v as FilterOption)}
              className="bg-gray-100 rounded-lg p-0.5"
            >
              <ToggleGroupItem value="all" className="text-xs px-2 py-1 h-7">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="unattempted" className="text-xs px-2 py-1 h-7">
                Need Help
              </ToggleGroupItem>
              <ToggleGroupItem value="solved" className="text-xs px-2 py-1 h-7">
                Solved
              </ToggleGroupItem>
              <ToggleGroupItem value="attempted" className="text-xs px-2 py-1 h-7">
                Failed
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Puzzle Grid */}
        {filteredPuzzles.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No puzzles match the selected filter
          </div>
        ) : (
          <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-20 gap-1">
            {filteredPuzzles.map((puzzle) => (
              <PuzzleCell 
                key={puzzle.puzzleId} 
                puzzle={puzzle}
                onClick={() => onPuzzleClick?.(puzzle.puzzleId)}
              />
            ))}
          </div>
        )}

        {/* Show count when filtered */}
        {filter !== 'all' && (
          <div className="text-center text-sm text-gray-500">
            Showing {filteredPuzzles.length} of {puzzles.length} puzzles
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Individual puzzle cell
function PuzzleCell({ 
  puzzle, 
  onClick 
}: { 
  puzzle: PoetiqPuzzleStatus;
  onClick?: () => void;
}) {
  const statusColors: Record<PuzzleStatus, string> = {
    solved: 'bg-green-500 hover:bg-green-600 ring-green-300',
    attempted: 'bg-orange-500 hover:bg-orange-600 ring-orange-300',
    unattempted: 'bg-gray-300 hover:bg-gray-400 ring-gray-200',
  };

  const statusIcons: Record<PuzzleStatus, React.ReactNode> = {
    solved: <CheckCircle className="h-3 w-3 text-white" />,
    attempted: <XCircle className="h-3 w-3 text-white" />,
    unattempted: null,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/puzzle/poetiq/${puzzle.puzzleId}`}>
          <button
            onClick={onClick}
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center transition-all',
              'hover:ring-2 hover:scale-110 cursor-pointer',
              statusColors[puzzle.status]
            )}
            aria-label={`Puzzle ${puzzle.puzzleId}: ${puzzle.status}`}
          >
            {statusIcons[puzzle.status]}
          </button>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-mono font-medium">{puzzle.puzzleId}</div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={puzzle.status === 'solved' ? 'default' : puzzle.status === 'attempted' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {puzzle.status === 'solved' ? 'Solved ✓' : 
               puzzle.status === 'attempted' ? 'Failed' : 
               'Not attempted'}
            </Badge>
          </div>
          {puzzle.modelName && (
            <div className="text-xs text-gray-500">
              Model: {puzzle.modelName}
            </div>
          )}
          {puzzle.elapsedMs && (
            <div className="text-xs text-gray-500">
              Time: {Math.round(puzzle.elapsedMs / 1000)}s
            </div>
          )}
          <div className="text-xs text-indigo-600 font-medium">
            Click to open solver →
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
