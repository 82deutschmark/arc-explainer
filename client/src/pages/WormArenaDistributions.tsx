/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-30
 * PURPOSE: Worm Arena Run Length Distribution page.
 *          Adds min-rounds filtering defaults (>=50), model inclusion controls,
 *          and forwards the threshold to the chart for bucketing and detail drill.
 * SRP/DRY check: Pass - page-level composition, thresholds, and state wiring only.
 */

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaRunLengthChart from '@/components/wormArena/stats/WormArenaRunLengthChart';
import useWormArenaDistributions from '@/hooks/useWormArenaDistributions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader, BarChart3, Trophy, Clock, Target, TrendingUp, Zap, SlidersHorizontal, EyeOff } from 'lucide-react';
import type { WormArenaRunLengthDistributionData } from '@shared/types';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const MIN_GAMES = 1; // Keep backend wide-open; apply client filters locally
const DEFAULT_MIN_ROUNDS = 50;
const MIN_ROUNDS_RANGE: [number, number] = [0, 120];

export default function WormArenaDistributions() {
  const { data, isLoading, error } = useWormArenaDistributions(MIN_GAMES);
  const [minRounds, setMinRounds] = React.useState<number>(DEFAULT_MIN_ROUNDS);
  const [includeLowModels, setIncludeLowModels] = React.useState<boolean>(false);

  // Compute summary statistics from distribution data
  const stats = React.useMemo(() => {
    if (!data || !data.distributionData || data.distributionData.length === 0) {
      return null;
    }

    // Aggregate all bins across models
    const roundCounts: Record<number, { wins: number; losses: number; total: number }> = {};
    let totalWins = 0;
    let totalLosses = 0;
    let totalRounds = 0;
    let gameCount = 0;

    data.distributionData.forEach((model) => {
      model.bins.forEach((bin) => {
        if (!roundCounts[bin.rounds]) {
          roundCounts[bin.rounds] = { wins: 0, losses: 0, total: 0 };
        }
        roundCounts[bin.rounds].wins += bin.wins;
        roundCounts[bin.rounds].losses += bin.losses;
        roundCounts[bin.rounds].total += bin.wins + bin.losses;
        totalWins += bin.wins;
        totalLosses += bin.losses;
        totalRounds += bin.rounds * (bin.wins + bin.losses);
        gameCount += bin.wins + bin.losses;
      });
    });

    // Find most common round (mode)
    let modeRound = 1;
    let modeCount = 0;
    Object.entries(roundCounts).forEach(([rounds, counts]) => {
      if (counts.total > modeCount) {
        modeCount = counts.total;
        modeRound = parseInt(rounds, 10);
      }
    });

    // Find round ranges
    const allRounds = Object.keys(roundCounts).map(Number).sort((a, b) => a - b);
    const minRound = allRounds[0] || 1;
    const maxRound = allRounds[allRounds.length - 1] || 1;

    // Average game length
    const avgRounds = gameCount > 0 ? totalRounds / gameCount : 0;

    // Find longest surviving model (model with highest avg rounds)
    let longestModel = '';
    let longestAvg = 0;
    data.distributionData.forEach((model) => {
      let modelRounds = 0;
      let modelGames = 0;
      model.bins.forEach((bin) => {
        modelRounds += bin.rounds * (bin.wins + bin.losses);
        modelGames += bin.wins + bin.losses;
      });
      const avg = modelGames > 0 ? modelRounds / modelGames : 0;
      if (avg > longestAvg) {
        longestAvg = avg;
        longestModel = model.modelSlug;
      }
    });

    // Find model with best win rate
    let bestWinRateModel = '';
    let bestWinRate = 0;
    data.distributionData.forEach((model) => {
      let modelWins = 0;
      let modelTotal = 0;
      model.bins.forEach((bin) => {
        modelWins += bin.wins;
        modelTotal += bin.wins + bin.losses;
      });
      const winRate = modelTotal > 0 ? modelWins / modelTotal : 0;
      if (winRate > bestWinRate && modelTotal >= 5) { // Min 5 games for significance
        bestWinRate = winRate;
        bestWinRateModel = model.modelSlug;
      }
    });

    return {
      totalGames: gameCount,
      totalWins,
      totalLosses,
      avgRounds: avgRounds.toFixed(1),
      modeRound,
      modeCount,
      minRound,
      maxRound,
      longestModel: shortenSlug(longestModel),
      longestAvg: longestAvg.toFixed(1),
      bestWinRateModel: shortenSlug(bestWinRateModel),
      bestWinRate: (bestWinRate * 100).toFixed(0),
      overallWinRate: gameCount > 0 ? ((totalWins / gameCount) * 100).toFixed(0) : '0',
    };
  }, [data]);

  // Helper to shorten model slugs for display
  function shortenSlug(slug: string): string {
    if (!slug) return '-';
    const parts = slug.split('/');
    const name = parts.length > 1 ? parts[parts.length - 1] : slug;
    return name.length > 20 ? name.slice(0, 18) + '..' : name;
  }

  return (
    <TooltipProvider>
      <div className="worm-page">
        <WormArenaHeader
          subtitle="Distributions"
          links={[
            { label: 'Replay', href: '/worm-arena' },
            { label: 'Live', href: '/worm-arena/live' },
            { label: 'Matches', href: '/worm-arena/matches' },
            { label: 'Models', href: '/worm-arena/models' },
            { label: 'Stats & Placement', href: '/worm-arena/stats' },
            { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
            { label: 'Distributions', href: '/worm-arena/distributions', active: true },
            { label: 'Rules', href: '/worm-arena/rules' },
          ]}
          showMatchupLabel={false}
        />

        <main className="w-full max-w-[1500px] mx-auto px-2 md:px-3 py-3 space-y-6">
        {/* Page title with icon */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#4A7C59]/10 rounded-xl">
            <BarChart3 className="w-8 h-8 text-[#4A7C59]" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#8B7355]">Game Length Analytics</h1>
            <p className="text-[#A0826D] mt-1">
              Distribution of game rounds across models, broken down by wins and losses
            </p>
          </div>
        </div>

        {/* Stats cards row - show when data available */}
        {data && stats && !isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              icon={<Target className="w-4 h-4" />}
              label="Models"
              value={data.modelsIncluded.toString()}
              subtext={`${stats.totalGames.toLocaleString()} games`}
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Avg Length"
              value={`${stats.avgRounds}`}
              subtext="rounds/game"
            />
            <StatCard
              icon={<Zap className="w-4 h-4" />}
              label="Most Common"
              value={`Round ${stats.modeRound}`}
              subtext={`${stats.modeCount} games`}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Range"
              value={`${stats.minRound}-${stats.maxRound}`}
              subtext="min to max"
            />
            <StatCard
              icon={<Trophy className="w-4 h-4" />}
              label="Top Win Rate"
              value={`${stats.bestWinRate}%`}
              subtext={stats.bestWinRateModel}
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Longest Avg"
              value={stats.longestAvg}
              subtext={stats.longestModel}
            />
          </div>
        )}

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

        {/* Chart */}
        {data && data.modelsIncluded > 0 && !isLoading && (
          <Card className="worm-card">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2">
                <CardTitle className="text-lg text-[#8B7355] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Run Length Distribution
                </CardTitle>
                <p className="text-sm text-[#A0826D]">
                  Stacked bars show game count at each round length. Defaults to models with ≥ {minRounds} round games.
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm text-[#8B7355]">
                  <SlidersHorizontal className="w-4 h-4" />
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between text-xs text-[#A0826D] mb-1">
                      <span>Minimum rounds to show</span>
                      <span className="font-semibold text-[#4A7C59]">{minRounds} rounds</span>
                    </div>
                    <Slider
                      value={[minRounds]}
                      min={MIN_ROUNDS_RANGE[0]}
                      max={MIN_ROUNDS_RANGE[1]}
                      step={5}
                      onValueChange={(v) => setMinRounds(v[0] ?? DEFAULT_MIN_ROUNDS)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-low-models"
                    checked={includeLowModels}
                    onCheckedChange={setIncludeLowModels}
                  />
                  <Label htmlFor="include-low-models" className="text-sm text-[#8B7355] flex items-center gap-1">
                    <EyeOff className="w-4 h-4" />
                    Show models without games ≥ {minRounds} rounds
                  </Label>
                </div>
                <p className="text-xs text-[#A0826D]">
                  Models are included by default only if they have at least one game at or above the minimum rounds. Games below the threshold are grouped into a “&lt;{minRounds}” bucket so totals stay accurate.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <WormArenaRunLengthChart
                data={data}
                minRounds={minRounds}
                includeLowModels={includeLowModels}
              />
            </CardContent>
          </Card>
        )}

        {/* Footer info */}
        {data && !isLoading && (
          <div className="flex items-center justify-between text-xs text-[#A0826D] px-1">
            <span>
              Data from <span className="font-semibold">{data.totalGamesAnalyzed.toLocaleString()}</span> games
            </span>
            <span>
              Updated: {new Date(data.timestamp).toLocaleString()}
            </span>
          </div>
        )}
        </main>
      </div>
    </TooltipProvider>
  );
}

/**
 * Compact stat card component for the stats row.
 */
function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#D4B5A0] p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[#A0826D] mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-[#4A7C59]">{value}</p>
      <p className="text-xs text-[#8B7355] truncate" title={subtext}>
        {subtext}
      </p>
    </div>
  );
}
