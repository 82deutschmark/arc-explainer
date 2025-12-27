/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Worm Arena Run Length Distribution page.
 *          Displays histogram visualization of game lengths (rounds) by model,
 *          with wins and losses separated. Includes minimum games threshold filter.
 * SRP/DRY check: Pass - focused on page composition and state management.
 */

import React from 'react';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaRunLengthChart from '@/components/wormArena/stats/WormArenaRunLengthChart';
import useWormArenaDistributions from '@/hooks/useWormArenaDistributions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader } from 'lucide-react';

const MIN_GAMES_OPTIONS = [5, 10, 15, 20, 25, 50];

export default function WormArenaDistributions() {
  const [minGames, setMinGames] = React.useState(5);
  const { data, isLoading, error } = useWormArenaDistributions(minGames);

  const handleMinGamesChange = (value: string) => {
    setMinGames(Number(value));
  };

  const handleDecreaseThreshold = () => {
    const currentIndex = MIN_GAMES_OPTIONS.indexOf(minGames);
    if (currentIndex > 0) {
      setMinGames(MIN_GAMES_OPTIONS[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFAF6]">
      <WormArenaHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Page title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-[#8B7355]">Game Length Distribution</h1>
          <p className="text-[#A0826D]">
            Analyze how game lengths (rounds played) are distributed across models, separated by
            wins and losses.
          </p>
        </div>

        {/* Filter controls */}
        <Card className="worm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-[#8B7355]">Filter Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-[#8B7355] mb-2">
                  Minimum Games Threshold
                </label>
                <Select value={String(minGames)} onValueChange={handleMinGamesChange}>
                  <SelectTrigger className="worm-border">
                    <SelectValue placeholder="Select threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    {MIN_GAMES_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}+ games
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#A0826D] mt-1">
                  Only models with at least this many completed games will be shown.
                </p>
              </div>

              {/* Summary stats */}
              {data && !isLoading && (
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="text-[#A0826D] font-medium">Models</p>
                    <p className="text-xl font-bold text-[#4A7C59]">{data.modelsIncluded}</p>
                  </div>
                  <div>
                    <p className="text-[#A0826D] font-medium">Total Games</p>
                    <p className="text-xl font-bold text-[#4A7C59]">{data.totalGamesAnalyzed}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {error && (
          <Card className="worm-card border-[#E8645B]">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-[#E8645B] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#8B7355]">Error loading distribution data</p>
                <p className="text-sm text-[#A0826D] mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading && (
          <Card className="worm-card">
            <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center gap-3">
              <Loader className="w-6 h-6 text-[#4A7C59] animate-spin" />
              <p className="text-[#8B7355] font-medium">Loading distribution data...</p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data && data.modelsIncluded === 0 && !isLoading && (
          <Card className="worm-card">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-[#8B7355] font-semibold">No Distribution Data Available</p>
              <p className="text-[#A0826D]">
                No models have played at least {minGames} games yet.
              </p>
              <Button
                onClick={handleDecreaseThreshold}
                disabled={minGames === MIN_GAMES_OPTIONS[0]}
                className="bg-[#4A7C59] hover:bg-[#3A6949] text-white"
              >
                Lower Threshold to {Math.max(minGames - 5, MIN_GAMES_OPTIONS[0])}+
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        {data && data.modelsIncluded > 0 && !isLoading && (
          <Card className="worm-card">
            <CardHeader>
              <CardTitle className="text-lg text-[#8B7355]">
                Run Length Distribution
              </CardTitle>
              <p className="text-sm text-[#A0826D] mt-1">
                Stacked histogram showing frequency of game rounds by model and outcome
              </p>
            </CardHeader>
            <CardContent>
              <WormArenaRunLengthChart data={data} />
            </CardContent>
          </Card>
        )}

        {/* Footer info */}
        {data && !isLoading && (
          <Card className="worm-card bg-[#FAF7F3]">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-[#A0826D]">
                <span className="font-semibold">Last updated:</span> {new Date(data.timestamp).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
