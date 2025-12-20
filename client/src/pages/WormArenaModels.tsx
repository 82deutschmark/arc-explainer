/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-20
 * PURPOSE: Worm Arena Models page - browse every game a specific model has ever played.
 *          Mirrors the external SnakeBench /models/[id] page functionality.
 *          Only lists models that have actually played games.
 * SRP/DRY check: Pass - page composition only, data fetching in hooks.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';

import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaRecentMatches from '@/components/wormArena/WormArenaRecentMatches';
import {
  useWormArenaModelsWithGames,
  useWormArenaModelHistory,
} from '@/hooks/useWormArenaModels';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { SnakeBenchModelMatchHistoryEntry } from '@shared/types';

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

export default function WormArenaModels() {
  // Fetch list of models that have games
  const {
    models,
    isLoading: modelsLoading,
    error: modelsError,
    fetchModels,
  } = useWormArenaModelsWithGames();

  // Fetch full match history for selected model
  const {
    history,
    rating,
    isLoading: historyLoading,
    error: historyError,
    fetchHistory,
    clearHistory,
  } = useWormArenaModelHistory();

  // Selected model state
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Load models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // When model selection changes, fetch history
  useEffect(() => {
    if (selectedModel) {
      fetchHistory(selectedModel);
    } else {
      clearHistory();
    }
  }, [selectedModel, fetchHistory, clearHistory]);

  // Compute stats for header display
  const totalGames = rating
    ? rating.wins + rating.losses + rating.ties
    : 0;
  const decidedGames = rating ? rating.wins + rating.losses : 0;
  const winRatePercent = decidedGames > 0
    ? ((rating!.wins / decidedGames) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-gray-50">
      <WormArenaHeader
        subtitle="Model Match History"
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Matches', href: '/worm-arena/matches' },
          { label: 'Models', href: '/worm-arena/models', active: true },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
          { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Model Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select a Model</CardTitle>
          </CardHeader>
          <CardContent>
            {modelsLoading && (
              <p className="text-sm text-gray-500">Loading models...</p>
            )}
            {modelsError && (
              <p className="text-sm text-red-600">{modelsError}</p>
            )}
            {!modelsLoading && !modelsError && models.length === 0 && (
              <p className="text-sm text-gray-500">No models with games found.</p>
            )}
            {!modelsLoading && models.length > 0 && (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choose a model to view its match history" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.modelSlug} value={m.modelSlug}>
                      {m.modelSlug} ({m.gamesPlayed} games, {((m.winRate ?? 0) * 100).toFixed(0)}% win)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/snakebench/models-with-games" target="_blank" rel="noreferrer">
                  Open models-with-games JSON
                </a>
              </Button>

              {selectedModel && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/api/snakebench/model-history-full?modelSlug=${encodeURIComponent(selectedModel)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open model-history-full JSON
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Model Stats Header (shown when model is selected) */}
        {selectedModel && rating && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Total Matches</div>
                <div className="mt-1 text-2xl font-semibold">{totalGames}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Win Rate</div>
                <div className="mt-1 text-2xl font-semibold">{winRatePercent}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Rating</div>
                <div className="mt-1 text-2xl font-semibold">
                  {rating.displayScore?.toLocaleString() ?? '-'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Apples Eaten</div>
                <div className="mt-1 text-2xl font-semibold">{rating.applesEaten}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Total Cost</div>
                <div className="mt-1 text-2xl font-semibold">
                  ${(rating.totalCost ?? 0).toFixed(4)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Matches */}
        {selectedModel && (
          <div className="mb-6">
            <WormArenaRecentMatches modelSlug={selectedModel} limit={10} />
          </div>
        )}

        {/* Match History Table */}
        {selectedModel && (
          <Card>
            <CardHeader>
              <CardTitle>
                Match History for {selectedModel}
                {history.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({history.length} games)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading && (
                <p className="text-sm text-gray-500">Loading match history...</p>
              )}
              {historyError && (
                <p className="text-sm text-red-600">{historyError}</p>
              )}
              {!historyLoading && !historyError && history.length === 0 && (
                <p className="text-sm text-gray-500">No matches found for this model.</p>
              )}
              {!historyLoading && history.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opponent</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Death Reason</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Rounds</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((game: SnakeBenchModelMatchHistoryEntry, idx: number) => (
                        <TableRow key={game.gameId || idx}>
                          <TableCell className="font-medium">
                            <button
                              className="text-indigo-600 hover:text-indigo-900 text-left"
                              onClick={() => setSelectedModel(game.opponentSlug)}
                            >
                              {game.opponentSlug || '-'}
                            </button>
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
            </CardContent>
          </Card>
        )}

        {/* Empty state when no model selected */}
        {!selectedModel && !modelsLoading && models.length > 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                Select a model above to view its complete match history.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
