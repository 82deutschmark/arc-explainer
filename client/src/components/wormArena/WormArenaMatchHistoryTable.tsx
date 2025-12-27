/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-27
 * PURPOSE: Reusable, sortable match history table for Worm Arena.
 *          Displays rich metrics: opponent, date, duration, outcome, death reason,
 *          score, rounds, cost, and replay link. Supports column sorting.
 *          Designed to replace inline tables and redundant components.
 * SRP/DRY check: Pass - single responsibility for match history display with sorting.
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { SnakeBenchModelMatchHistoryEntry } from '@shared/types';

// Sortable columns
type SortColumn = 'opponent' | 'date' | 'duration' | 'outcome' | 'score' | 'rounds' | 'cost';
type SortDirection = 'asc' | 'desc';

interface WormArenaMatchHistoryTableProps {
  /** Match history entries to display */
  history: SnakeBenchModelMatchHistoryEntry[];
  /** Model slug for display in header (optional) */
  modelSlug?: string;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Callback when opponent is clicked (to switch models) */
  onOpponentClick?: (opponentSlug: string) => void;
  /** Whether to show the card wrapper (default: true) */
  showCard?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Format duration from start/end timestamps.
 */
function formatDuration(startedAt: string, endedAt?: string): string {
  if (!startedAt || !endedAt) return '-';
  try {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '-';
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } catch {
    return '-';
  }
}

/**
 * Get duration in milliseconds for sorting.
 */
function getDurationMs(startedAt: string, endedAt?: string): number {
  if (!startedAt || !endedAt) return 0;
  try {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    return Math.max(0, end.getTime() - start.getTime());
  } catch {
    return 0;
  }
}

/**
 * Format date for display.
 */
function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(',', '');
  } catch {
    return '-';
  }
}

/**
 * Outcome badge styling.
 */
function getOutcomeClass(result: string): string {
  if (result === 'won') return 'bg-green-100 text-green-800';
  if (result === 'lost') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

/**
 * Sortable column header component.
 */
function SortableHeader({
  label,
  column,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn | null;
  currentDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = currentSort === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 hover:text-indigo-600 transition-colors font-medium"
    >
      {label}
      {isActive ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" />
        )
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
      )}
    </button>
  );
}

export default function WormArenaMatchHistoryTable({
  history,
  modelSlug,
  isLoading = false,
  error = null,
  onOpponentClick,
  showCard = true,
  className = '',
}: WormArenaMatchHistoryTableProps) {
  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle sort toggle
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Sort the history data
  const sortedHistory = useMemo(() => {
    if (!sortColumn || history.length === 0) return history;

    const sorted = [...history].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'opponent':
          cmp = (a.opponentSlug || '').localeCompare(b.opponentSlug || '');
          break;
        case 'date':
          cmp = new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime();
          break;
        case 'duration':
          cmp = getDurationMs(a.startedAt, a.endedAt) - getDurationMs(b.startedAt, b.endedAt);
          break;
        case 'outcome':
          // Order: won > tied > lost
          const order = { won: 2, tied: 1, lost: 0 };
          cmp = (order[a.result as keyof typeof order] ?? 0) - (order[b.result as keyof typeof order] ?? 0);
          break;
        case 'score':
          // Sort by our score first, then by opponent score
          cmp = (a.myScore ?? 0) - (b.myScore ?? 0);
          if (cmp === 0) cmp = (b.opponentScore ?? 0) - (a.opponentScore ?? 0);
          break;
        case 'rounds':
          cmp = (a.rounds ?? 0) - (b.rounds ?? 0);
          break;
        case 'cost':
          cmp = (a.cost ?? 0) - (b.cost ?? 0);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [history, sortColumn, sortDirection]);

  // Table content
  const tableContent = (
    <>
      {isLoading && (
        <p className="text-sm text-gray-500 py-4">Loading match history...</p>
      )}
      {error && !isLoading && (
        <p className="text-sm text-red-600 py-4">{error}</p>
      )}
      {!isLoading && !error && history.length === 0 && (
        <p className="text-sm text-gray-500 py-4">
          {modelSlug ? `No matches found for ${modelSlug}.` : 'No matches found.'}
        </p>
      )}
      {!isLoading && !error && history.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Opponent"
                    column="opponent"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Date"
                    column="date"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Duration"
                    column="duration"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Outcome"
                    column="outcome"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>Death Reason</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Score"
                    column="score"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Rounds"
                    column="rounds"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Cost"
                    column="cost"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.map((game, idx) => (
                <TableRow key={game.gameId || idx}>
                  <TableCell className="font-medium">
                    {onOpponentClick ? (
                      <button
                        className="text-indigo-600 hover:text-indigo-900 text-left"
                        onClick={() => onOpponentClick(game.opponentSlug)}
                      >
                        {game.opponentSlug || '-'}
                      </button>
                    ) : (
                      <span className="text-indigo-600">{game.opponentSlug || '-'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(game.startedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDuration(game.startedAt, game.endedAt)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getOutcomeClass(game.result)}`}
                    >
                      {game.result.charAt(0).toUpperCase() + game.result.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {game.result === 'lost' && game.deathReason
                      ? game.deathReason.replace(/_/g, ' ')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {game.myScore} - {game.opponentScore}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {game.rounds}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    ${(game.cost ?? 0).toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/worm-arena?matchId=${encodeURIComponent(game.gameId)}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      View Replay
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  // Wrap in card if requested
  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            {modelSlug ? `Match History for ${modelSlug}` : 'Match History'}
            {history.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({history.length} games)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>{tableContent}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{tableContent}</div>;
}
