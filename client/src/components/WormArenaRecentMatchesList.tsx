/**
 * Author: Claude
 * Date: 2025-01-04
 * PURPOSE: Recent matches list component for the Worm Arena Live page.
 *          Shows the most recent matches with quick replay access.
 * SRP/DRY check: Pass - purely presentational; data comes from hook.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useWormArenaAllRecentMatches } from '@/hooks/useWormArenaAllRecentMatches';
import { Clock, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentMatchesProps {
    limit?: number;
}

function normalizeGameId(raw: string): string {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return '';
    const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
    return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default function WormArenaRecentMatchesList({ limit = 8 }: RecentMatchesProps) {
    const { matches, isLoading, error, refresh } = useWormArenaAllRecentMatches(limit);

    return (
        <Card className="worm-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg font-bold text-black flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        Recent Matches
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                        Latest completed games
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="h-8 px-2 text-gray-500 hover:text-black"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent className="pt-0">
                {isLoading && matches.length === 0 && (
                    <div className="py-4 text-sm text-gray-500 text-center">
                        Loading recent matches...
                    </div>
                )}
                {error && !isLoading && (
                    <div className="py-4 text-sm text-red-600 text-center">
                        {error}
                    </div>
                )}
                {!isLoading && !error && matches.length === 0 && (
                    <div className="py-4 text-sm text-gray-500 text-center">
                        No recent matches yet — start a match to see history here.
                    </div>
                )}

                {matches.length > 0 && (
                    <div className="space-y-2">
                        {matches.map((match) => {
                            const replayHref = `/worm-arena?matchId=${encodeURIComponent(normalizeGameId(match.gameId))}`;
                            const scoreDisplay = `${match.myScore}-${match.opponentScore}`;

                            return (
                                <div
                                    key={match.gameId}
                                    className="flex items-center gap-3 p-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-mono font-medium text-black truncate" title={match.model}>
                                                {match.model}
                                            </span>
                                            <span className="text-gray-500">vs</span>
                                            <span className="font-mono font-medium text-black truncate" title={match.opponent}>
                                                {match.opponent}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                                            <span className="font-semibold">
                                                {scoreDisplay}
                                            </span>
                                            <span>
                                                {match.roundsPlayed} rnds
                                            </span>
                                            {match.result && (
                                                <span className={`font-medium ${match.result === 'won' ? 'text-emerald-600' :
                                                        match.result === 'lost' ? 'text-red-600' :
                                                            'text-amber-600'
                                                    }`}>
                                                    {match.result}
                                                </span>
                                            )}
                                            <span className="text-gray-400">
                                                {formatTimeAgo(match.startedAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <a
                                        href={replayHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-xs font-bold text-white transition-colors shrink-0"
                                    >
                                        <Play className="w-3 h-3" />
                                        Replay
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
