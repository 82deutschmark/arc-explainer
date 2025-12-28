/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-27
 * PURPOSE: Worm Arena Models page - browse every game a specific model has ever played,
 *          plus generate a per-model actionable insights report inline.
 *          Uses modular WormArenaMatchHistoryTable with sortable columns.
 *          Only lists models that have actually played games.
 * SRP/DRY check: Pass - page composition only, data fetching in hooks.
 */

import React, { useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaMatchHistoryTable from '@/components/wormArena/WormArenaMatchHistoryTable';
import WormArenaModelInsightsReport from '@/components/wormArena/WormArenaModelInsightsReport';
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
          compact
          showMatchupLabel={false}
        />

        <main className="w-full max-w-[1500px] mx-auto px-2 md:px-3 py-3 space-y-6">
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

        {/* Actionable Insights Report */}
        {selectedModel && (
          <div className="mb-6">
            <WormArenaModelInsightsReport modelSlug={selectedModel} />
          </div>
        )}

        {/* Match History Table - sortable, modular component */}
        {selectedModel && (
          <WormArenaMatchHistoryTable
            history={history}
            modelSlug={selectedModel}
            isLoading={historyLoading}
            error={historyError}
            onOpponentClick={setSelectedModel}
          />
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
        </main>
      </div>
    </TooltipProvider>
  );
}

