/**
 * EloLeaderboard.tsx
 *
 * Author: Cascade
 * Date: 2025-09-15
 * PURPOSE: Displays rankings and statistics for AI model explanation quality using ELO ratings
 * Reuses existing UI components and follows established patterns from ModelExaminer and PuzzleOverview
 *
 * ARCHITECTURE:
 * - Reuses Card, Badge, and table components from existing codebase
 * - Follows established API patterns with useQuery
 * - Minimal new code - leverages existing design system
 */

import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, ArrowLeft, BarChart3, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface EloLeaderboardEntry {
  modelName: string;
  currentRating: number;
  gamesPlayed: number;
  winRate: number;
  averageOpponentRating: number;
  ratingChange24h?: number;
  rank: number;
}

interface EloLeaderboardData {
  leaderboard: EloLeaderboardEntry[];
  totalComparisons: number;
  activeModels: number;
  lastUpdated: string;
}

export default function EloLeaderboard() {
  // Set page title
  React.useEffect(() => {
    document.title = 'ELO Leaderboard - ARC Puzzle Explainer';
  }, []);

  const { data: leaderboardData, isLoading, error } = useQuery<EloLeaderboardData>({
    queryKey: ['elo-leaderboard'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/elo/leaderboard');
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-yellow-50';
    if (rank === 2) return 'bg-gray-400 text-gray-50';
    if (rank === 3) return 'bg-orange-600 text-orange-50';
    if (rank <= 5) return 'bg-blue-500 text-blue-50';
    return 'bg-gray-200 text-gray-700';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4" />;
    if (rank === 2) return <Medal className="h-4 w-4" />;
    if (rank === 3) return <Award className="h-4 w-4" />;
    return <span className="text-sm font-medium">#{rank}</span>;
  };

  const formatRatingChange = (change?: number) => {
    if (!change) return null;
    const color = change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500';
    const symbol = change > 0 ? '+' : '';
    return (
      <span className={`text-sm ${color} flex items-center gap-1`}>
        <TrendingUp className="h-3 w-3" />
        {symbol}{change.toFixed(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/elo">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Arena
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            ELO Leaderboard
          </h1>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading leaderboard...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/elo">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Arena
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            ELO Leaderboard
          </h1>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load leaderboard data</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/elo">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Arena
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            ELO Leaderboard
          </h1>
        </div>
        <Badge variant="outline" className="text-sm">
          Updated {new Date(leaderboardData?.lastUpdated || '').toLocaleTimeString()}
        </Badge>
      </div>

      {/* Statistics Overview */}
      {leaderboardData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Comparisons</p>
                  <p className="text-2xl font-bold">{leaderboardData.totalComparisons.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-600">Active Models</p>
                  <p className="text-2xl font-bold">{leaderboardData.activeModels}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Top Rating</p>
                  <p className="text-2xl font-bold">
                    {leaderboardData.leaderboard[0]?.currentRating?.toFixed(0) || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Model Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!leaderboardData?.leaderboard?.length ? (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No rankings available yet</p>
              <p className="text-sm text-gray-500">Start comparing explanations to generate rankings!</p>
              <Link href="/elo">
                <Button className="mt-4">
                  Start Comparing
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Rank</th>
                    <th className="text-left py-3 px-2">Model</th>
                    <th className="text-right py-3 px-2">ELO Rating</th>
                    <th className="text-right py-3 px-2">Games</th>
                    <th className="text-right py-3 px-2">Win Rate</th>
                    <th className="text-right py-3 px-2">Avg Opponent</th>
                    <th className="text-right py-3 px-2">24h Change</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.leaderboard.map((entry: EloLeaderboardEntry) => (
                    <tr key={entry.modelName} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <Badge 
                          className={`${getRankBadgeColor(entry.rank)} border-0 flex items-center gap-1 w-fit`}
                        >
                          {getRankIcon(entry.rank)}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium">{entry.modelName}</div>
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className="font-mono text-lg font-semibold">
                          {entry.currentRating.toFixed(0)}
                        </span>
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className="text-gray-600">{entry.gamesPlayed}</span>
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className="text-gray-600">
                          {(entry.winRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className="text-gray-600 font-mono">
                          {entry.averageOpponentRating.toFixed(0)}
                        </span>
                      </td>
                      <td className="text-right py-3 px-2">
                        {formatRatingChange(entry.ratingChange24h)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Rankings are updated in real-time based on head-to-head comparisons.</p>
        <p>ELO ratings start at 1200 and adjust based on explanation quality votes.</p>
      </div>
    </div>
  );
}
