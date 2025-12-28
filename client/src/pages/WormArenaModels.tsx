/**
 * Author: Claude Opus 4.5 (frontend-design skill)
 * Date: 2025-12-27
 * PURPOSE: Worm Arena Models page - "Combat Dossier" style redesign.
 *          Auto-selects first model on load, eliminates illegible grey text,
 *          uses warm earthy Worm Arena theme with bold typography and visual flair.
 *          Shows model combat profile with stats, streaks, and full match history.
 * SRP/DRY check: Pass - page composition only, data fetching in hooks.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaMatchHistoryTable from '@/components/wormArena/WormArenaMatchHistoryTable';
import WormArenaModelInsightsReport from '@/components/wormArena/WormArenaModelInsightsReport';
import {
  useWormArenaModelsWithGames,
  useWormArenaModelHistory,
} from '@/hooks/useWormArenaModels';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  Skull,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  FileJson,
} from 'lucide-react';

/** Calculate current streak from match history */
function calculateStreak(history: { result: string }[]): { type: 'win' | 'loss' | 'tie' | 'none'; count: number } {
  if (!history || history.length === 0) return { type: 'none', count: 0 };

  // Sort by date descending (most recent first)
  const sorted = [...history].sort((a: any, b: any) =>
    new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
  );

  const firstResult = sorted[0].result as 'won' | 'lost' | 'tied';
  let count = 0;

  for (const game of sorted) {
    if (game.result === firstResult) {
      count++;
    } else {
      break;
    }
  }

  const typeMap: Record<string, 'win' | 'loss' | 'tie'> = {
    won: 'win',
    lost: 'loss',
    tied: 'tie',
  };

  return { type: typeMap[firstResult] || 'none', count };
}

/** Streak badge component */
function StreakBadge({ streak }: { streak: { type: string; count: number } }) {
  if (streak.type === 'none' || streak.count === 0) return null;

  const config = {
    win: {
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-700',
      text: 'text-emerald-800',
      icon: TrendingUp,
      label: 'Win Streak'
    },
    loss: {
      bg: 'bg-red-900/20',
      border: 'border-red-700',
      text: 'text-red-800',
      icon: TrendingDown,
      label: 'Loss Streak'
    },
    tie: {
      bg: 'bg-amber-900/20',
      border: 'border-amber-700',
      text: 'text-amber-800',
      icon: Minus,
      label: 'Tie Streak'
    },
  }[streak.type] || { bg: '', border: '', text: '', icon: Minus, label: '' };

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border ${config.bg} ${config.border}`}>
      <Icon className={`w-4 h-4 ${config.text}`} />
      <span className={`text-sm font-bold ${config.text}`}>
        {streak.count} {config.label}
      </span>
    </div>
  );
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

  // AUTO-SELECT FIRST MODEL when models load (fixes empty state issue)
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      // Select model with most games played
      const sorted = [...models].sort((a, b) => (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0));
      setSelectedModel(sorted[0].modelSlug);
    }
  }, [models, selectedModel]);

  // When model selection changes, fetch history
  useEffect(() => {
    if (selectedModel) {
      fetchHistory(selectedModel);
    } else {
      clearHistory();
    }
  }, [selectedModel, fetchHistory, clearHistory]);

  // Compute stats
  const totalGames = rating ? rating.wins + rating.losses + rating.ties : 0;
  const decidedGames = rating ? rating.wins + rating.losses : 0;
  const winRatePercent = decidedGames > 0
    ? ((rating!.wins / decidedGames) * 100).toFixed(1)
    : '0.0';

  // Calculate streak from history
  const streak = useMemo(() => calculateStreak(history), [history]);

  // Get selected model info
  const selectedModelInfo = models.find(m => m.modelSlug === selectedModel);

  return (
    <TooltipProvider>
      <div className="worm-page">
        <WormArenaHeader
          subtitle="Model Match History"
          links={[
            { label: 'Replay', href: '/worm-arena' },
            { label: 'Live', href: '/worm-arena/live' },
            { label: 'Matches', href: '/worm-arena/matches' },
            { label: 'Models', href: '/worm-arena/models', active: true },
            { label: 'Stats & Placement', href: '/worm-arena/stats' },
            { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
            { label: 'Distributions', href: '/worm-arena/distributions' },
            { label: 'Rules', href: '/worm-arena/rules' },
          ]}
          showMatchupLabel={false}
        />

        <main className="w-full max-w-[1400px] mx-auto px-3 md:px-4 py-4 space-y-5">

          {/* Model Selector - Compact Header Bar */}
          <div className="worm-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-[var(--worm-ink)] mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[var(--worm-metric-rating)]" />
                  Select Model
                </h2>

                {modelsLoading && (
                  <p className="text-sm text-[var(--worm-ink)]">Loading models...</p>
                )}
                {modelsError && (
                  <p className="text-sm text-[var(--worm-red)] font-medium">{modelsError}</p>
                )}
                {!modelsLoading && !modelsError && models.length === 0 && (
                  <p className="text-sm text-[var(--worm-ink)]">No models with games found.</p>
                )}
                {!modelsLoading && models.length > 0 && (
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-full max-w-lg bg-white border-[var(--worm-border)] text-[var(--worm-ink)] font-medium">
                      <SelectValue placeholder="Choose a model..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {models.map((m) => (
                        <SelectItem
                          key={m.modelSlug}
                          value={m.modelSlug}
                          className="text-[var(--worm-ink)]"
                        >
                          {m.modelName || m.modelSlug} ({m.gamesPlayed} games, {((m.winRate ?? 0) * 100).toFixed(0)}% win)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[var(--worm-border)] text-[var(--worm-ink)] hover:bg-[var(--worm-track)]"
                  asChild
                >
                  <a href="/api/snakebench/models-with-games" target="_blank" rel="noreferrer">
                    <FileJson className="w-4 h-4 mr-1.5" />
                    Models JSON
                  </a>
                </Button>
                {selectedModel && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[var(--worm-border)] text-[var(--worm-ink)] hover:bg-[var(--worm-track)]"
                    asChild
                  >
                    <a
                      href={`/api/snakebench/model-history-full?modelSlug=${encodeURIComponent(selectedModel)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileJson className="w-4 h-4 mr-1.5" />
                      History JSON
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Combat Profile - Compact header only when model selected */}
          {selectedModel && rating && (
            <>
              <div className="worm-card overflow-hidden">
                <div className="bg-gradient-to-r from-[var(--worm-header-bg)] to-[#3d2817] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-[var(--worm-header-ink)]">
                        {selectedModelInfo?.modelName || selectedModel}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StreakBadge streak={streak} />
                      {selectedModelInfo && (
                        <span className="text-xs text-[var(--worm-header-accent)] font-semibold">
                          Rank #{models.findIndex(m => m.modelSlug === selectedModel) + 1}/{models.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actionable Insights Report */}
          {selectedModel && (
            <WormArenaModelInsightsReport modelSlug={selectedModel} />
          )}

          {/* Match History Table */}
          {selectedModel && (
            <WormArenaMatchHistoryTable
              history={history}
              modelSlug={selectedModel}
              isLoading={historyLoading}
              error={historyError}
              onOpponentClick={setSelectedModel}
            />
          )}

          {/* Loading state for initial load */}
          {modelsLoading && (
            <Card className="worm-card">
              <CardContent className="py-12 text-center">
                <div className="inline-flex items-center gap-2 text-[var(--worm-ink)]">
                  <div className="w-5 h-5 border-2 border-[var(--worm-ink)] border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium">Loading combatants...</span>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
