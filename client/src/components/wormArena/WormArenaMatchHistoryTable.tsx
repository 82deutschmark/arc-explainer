/**
 * Author: Claude Opus 4.5 (frontend-design skill)
 * Date: 2025-12-27
 * PURPOSE: Reusable, sortable match history table for Worm Arena.
 *          Fixed: All grey text replaced with readable dark colors using worm theme.
 *          Displays opponent, date, duration, outcome, death reason, score, rounds, cost, replay.
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
import { ArrowUpDown, ArrowUp, ArrowDown, Play } from 'lucide-react';
import type { SnakeBenchModelMatchHistoryEntry } from '@shared/types';

type SortColumn = 'opponent' | 'date' | 'duration' | 'outcome' | 'score' | 'rounds' | 'cost';
type SortDirection = 'asc' | 'desc';

interface WormArenaMatchHistoryTableProps {
  history: SnakeBenchModelMatchHistoryEntry[];
  modelSlug?: string;
  isLoading?: boolean;
  error?: string | null;
  onOpponentClick?: (opponentSlug: string) => void;
  showCard?: boolean;
  className?: string;
}

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

function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '-';
  }
}

function getOutcomeStyle(result: string): { bg: string; text: string; label: string } {
  if (result === 'won') return {
    bg: 'bg-[var(--worm-highlight-bg)]',
    text: 'text-[var(--worm-green-ink)]',
    label: 'Won'
  };
  if (result === 'lost') return {
    bg: 'bg-red-100',
    text: 'text-red-900',
    label: 'Lost'
  };
  return {
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    label: 'Tied'
  };
}

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
      className="flex items-center gap-1 hover:text-[var(--worm-blue)] transition-colors font-semibold text-[var(--worm-ink)]"
    >
      {label}
      {isActive ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" />
        )
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
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
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

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
          const order = { won: 2, tied: 1, lost: 0 };
          cmp = (order[a.result as keyof typeof order] ?? 0) - (order[b.result as keyof typeof order] ?? 0);
          break;
        case 'score':
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

  const tableContent = (
    <>
      {isLoading && (
        <div className="py-8 text-center">
          <div className="inline-flex items-center gap-2 text-[var(--worm-ink)]">
            <div className="w-4 h-4 border-2 border-[var(--worm-ink)] border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Loading match history...</span>
          </div>
        </div>
      )}
      {error && !isLoading && (
        <p className="text-sm text-[var(--worm-red)] font-medium py-4">{error}</p>
      )}
      {!isLoading && !error && history.length === 0 && (
        <p className="text-sm text-[var(--worm-ink)] py-4">
          {modelSlug ? `No matches found for ${modelSlug}.` : 'No matches found.'}
        </p>
      )}
      {!isLoading && !error && history.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="worm-table-head">
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
                <TableHead className="text-[var(--worm-ink)] font-semibold">Death</TableHead>
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
                <TableHead className="text-[var(--worm-ink)] font-semibold">Replay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.map((game, idx) => {
                const outcomeStyle = getOutcomeStyle(game.result);
                return (
                  <TableRow key={game.gameId || idx} className="worm-table-row hover:bg-[var(--worm-track)]/50">
                    <TableCell className="font-semibold">
                      {onOpponentClick ? (
                        <button
                          className="text-[var(--worm-blue)] hover:text-[var(--worm-blue-hover)] text-left font-semibold"
                          onClick={() => onOpponentClick(game.opponentSlug)}
                        >
                          {game.opponentSlug || '-'}
                        </button>
                      ) : (
                        <span className="text-[var(--worm-ink)]">{game.opponentSlug || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--worm-ink)]">
                      {formatDate(game.startedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--worm-ink)]">
                      {formatDuration(game.startedAt, game.endedAt)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-md ${outcomeStyle.bg} ${outcomeStyle.text}`}>
                        {outcomeStyle.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--worm-ink)]">
                      {game.result === 'lost' && game.deathReason
                        ? game.deathReason.replace(/_/g, ' ')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[var(--worm-ink)]">
                      <span className="worm-metric-wins">{game.myScore}</span>
                      <span className="mx-1">-</span>
                      <span className="worm-metric-losses">{game.opponentScore}</span>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--worm-ink)]">
                      {game.rounds}
                    </TableCell>
                    <TableCell className="text-sm worm-metric-cost font-medium">
                      ${(game.cost ?? 0).toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/worm-arena?matchId=${encodeURIComponent(game.gameId)}`}
                        className="inline-flex items-center gap-1 text-[var(--worm-blue)] hover:text-[var(--worm-blue-hover)] text-sm font-semibold"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Watch
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  if (showCard) {
    return (
      <Card className={`worm-card ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-[var(--worm-ink)] flex items-center justify-between">
            <span>
              {modelSlug ? `Match History` : 'Match History'}
            </span>
            {history.length > 0 && (
              <span className="text-sm font-medium text-[var(--worm-muted)]">
                {history.length} games
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">{tableContent}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{tableContent}</div>;
}
