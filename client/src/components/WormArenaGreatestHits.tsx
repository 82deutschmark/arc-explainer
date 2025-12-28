/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27
 * PURPOSE: Worm Arena "Greatest Hits" card with Share/Tweet buttons.
 *          Shows a short list of especially interesting matches
 *          (longest, most expensive, highest-scoring) with one-click
 *          replay links into the main Worm Arena viewer.
 *
 *          Layout note: Matchup strings can be long (provider/model IDs).
 *          We intentionally avoid truncation so users can always see both
 *          sides of the matchup (champion + challenger).
 *
 *          Note: Uses a simple overflow container instead of Radix ScrollArea.
 *          ScrollArea requires a fixed height and can render a 0-height viewport
 *          when only max-height is applied, causing the list to appear cut off.
 *          Replay links open in a new tab so users can keep the stats page open.
 * SRP/DRY check: Pass — purely presentational; data comes from hook.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';
import WormArenaShareButton from '@/components/WormArenaShareButton';
import type { WormArenaGreatestHitGame } from '@shared/types';

function normalizeGameId(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
  return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

const PINNED_GAMES: WormArenaGreatestHitGame[] = [
  {
    gameId: '17b4cccc-e0b2-44a7-bc65-d69a13221993',
    startedAt: '2025-12-26T00:44:49.624264',
    modelA: 'google/gemini-2.5-flash-preview-09-2025',
    modelB: 'deepseek/deepseek-v3.2-exp',
    roundsPlayed: 58,
    maxRounds: 150,
    totalCost: 0.7013982,
    maxFinalScore: 18,
    scoreDelta: 7,
    boardWidth: 10,
    boardHeight: 10,
    highlightReason: 'Pinned: 58-round slugfest, 18-11 finish (Gemini vs DeepSeek).',
  },
  {
    gameId: 'f1b8d1ab-5a62-410d-8e47-d52e27729eb6',
    startedAt: '2025-12-26T00:45:31.741935',
    modelA: 'deepseek/deepseek-v3.2-exp',
    modelB: 'openai/gpt-5-nano',
    roundsPlayed: 77,
    maxRounds: 150,
    totalCost: 0.1382053,
    maxFinalScore: 15,
    scoreDelta: 0,
    boardWidth: 10,
    boardHeight: 10,
    highlightReason: 'Pinned: 77-round tie, dual head-collision at 15-15 (DeepSeek vs GPT-5 Nano).',
  },
  {
    gameId: 'cbb4bc85-5970-4f9e-9335-914e6e3f1091',
    startedAt: '2025-12-26T02:10:00.173382',
    modelA: 'nvidia/nemotron-3-nano-30b-a3b:free',
    modelB: 'openai/gpt-5.1-codex-mini',
    roundsPlayed: 53,
    maxRounds: 150,
    totalCost: 0.117699,
    maxFinalScore: 11,
    scoreDelta: 1,
    boardWidth: 10,
    boardHeight: 10,
    highlightReason: 'Pinned: Nemotron 3 Nano edged GPT-5.1 Codex Mini 11-10 after a 53-round duel.',
  },
  {
    gameId: 'a3f0a2ba-7031-432f-87de-b57cab4623f3',
    startedAt: '2025-12-26T01:59:40.133172',
    modelA: 'openai/gpt-5.1-codex-mini',
    modelB: 'openai/gpt-5-nano',
    roundsPlayed: 90,
    maxRounds: 150,
    totalCost: 0.42447545,
    maxFinalScore: 21,
    scoreDelta: 1,
    boardWidth: 10,
    boardHeight: 10,
    highlightReason: 'Pinned: GPT-5 Nano outlasted GPT-5.1 Codex Mini 21-20 in a 90-round head-collision finish.',
  },
  {
    gameId: '2d061284-49be-44b3-84f1-38339c1f9211',
    startedAt: '2025-12-25T23:42:12.028394',
    modelA: 'x-ai/grok-4.1-fast',
    modelB: 'z-ai/glm-4.7',
    roundsPlayed: 94,
    maxRounds: 150,
    totalCost: 1.7030653,
    maxFinalScore: 24,
    scoreDelta: 3,
    boardWidth: 10,
    boardHeight: 10,
    highlightReason: 'Pinned: Grok 4.1 Fast thrashed GLM 4.7 in a 24-21, 94-round barnburner.',
  },
];

export default function WormArenaGreatestHits() {
  const { games, isLoading, error } = useWormArenaGreatestHits(20);
  const mergedGames = React.useMemo(() => {
    const existingIds = new Set(games.map((g) => g.gameId));
    const withPinned = [...games];
    PINNED_GAMES.forEach((pinned) => {
      if (!existingIds.has(pinned.gameId)) {
        withPinned.unshift(pinned);
      }
    });
    return withPinned;
  }, [games]);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-worm-ink">
          Greatest Hits Matches
        </CardTitle>
        <p className="text-sm mt-1 worm-muted">
          Curated Worm Arena games with long runs, high costs, big scores, or monster apple hauls.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base text-worm-ink">
        {isLoading && (
          <div className="py-3 text-base worm-muted">
            Loading greatest hits
            …
          </div>
        )}
        {error && !isLoading && (
          <div className="py-3 text-base text-red-700">{error}</div>
        )}
        {!isLoading && !error && mergedGames.length === 0 && (
          <div className="py-3 text-base worm-muted">
            No greatest hits yet — run a few matches to discover epic games.
          </div>
        )}

        {!isLoading && !error && mergedGames.length > 0 && (
          <div className="max-h-[560px] overflow-y-auto pr-3">
            <div className="space-y-3">
              {mergedGames.map((game) => {
                const matchup = `${game.modelA} vs ${game.modelB}`;
                const roundsLabel = `${game.roundsPlayed} / ${game.maxRounds || game.roundsPlayed} rounds`;
                const hasCost = game.totalCost > 0;
                const costLabel = hasCost ? `$${game.totalCost.toFixed(2)}` : null;
                const scoreLabel =
                  game.scoreDelta > 0
                    ? `Score delta: ${game.scoreDelta}`
                    : `Max score: ${game.maxFinalScore}`;

                // NEW: Duration badge (v3.x.x - Dec 2025)
                const durationLabel = game.durationSeconds && game.durationSeconds > 0
                  ? (() => {
                      const hours = Math.floor(game.durationSeconds / 3600);
                      const minutes = Math.floor((game.durationSeconds % 3600) / 60);
                      if (hours >= 1) {
                        return `${hours}h ${minutes}m`;
                      }
                      return `${minutes}m`;
                    })()
                  : null;

                // NEW: Total score badge (v3.x.x - Dec 2025)
                const totalScoreLabel = game.sumFinalScores && game.sumFinalScores > 0
                  ? `${game.sumFinalScores} total apples`
                  : null;

                const replayHref = `/worm-arena?matchId=${encodeURIComponent(normalizeGameId(game.gameId))}`;

                return (
                  <div
                    key={game.gameId}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-md border px-4 py-3 bg-white/80 worm-border"
                  >
                    <div className="space-y-2 min-w-0">
                      {/*
                        Matchup IDs can be long (e.g. provider/model names).
                        Avoid truncation so the challenger is always visible.
                      */}
                      <div className="font-mono text-sm leading-snug whitespace-normal break-words" title={matchup}>
                        <div className="flex gap-2">
                          <span className="shrink-0 worm-muted">Champion:</span>
                          <span className="min-w-0 break-words">{game.modelA}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="shrink-0 worm-muted">Challenger:</span>
                          <span className="min-w-0 break-words">{game.modelB}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="outline" className="font-semibold text-sm px-2 py-1">
                          {roundsLabel}
                        </Badge>
                        {costLabel && (
                          <Badge
                            variant="outline"
                            className="font-semibold text-sm px-2 py-1 worm-border"
                          >
                            Cost: {costLabel}
                          </Badge>
                        )}
                        <Badge variant="outline" className="font-semibold text-sm px-2 py-1">
                          {scoreLabel}
                        </Badge>
                        {durationLabel && (
                          <Badge
                            variant="outline"
                            className="font-semibold text-sm px-2 py-1 worm-border"
                          >
                            Duration: {durationLabel}
                          </Badge>
                        )}
                        {totalScoreLabel && (
                          <Badge
                            variant="outline"
                            className="font-semibold text-sm px-2 py-1 worm-border"
                          >
                            {totalScoreLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm worm-muted">
                        {game.highlightReason}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-end justify-end gap-2 md:gap-1">
                      {game.startedAt && (
                        <span className="text-sm worm-muted">
                          {new Date(game.startedAt).toLocaleDateString()}
                        </span>
                      )}
                      <div className="flex gap-2">
                        <WormArenaShareButton
                          data={{
                            gameId: game.gameId,
                            modelA: game.modelA,
                            modelB: game.modelB,
                            roundsPlayed: game.roundsPlayed,
                            maxFinalScore: game.maxFinalScore,
                            scoreDelta: game.scoreDelta,
                            totalCost: game.totalCost,
                            highlightReason: game.highlightReason,
                            durationSeconds: game.durationSeconds,
                            sumFinalScores: game.sumFinalScores,
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                        />
                        <a
                          href={replayHref}
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-semibold text-sm text-worm-ink hover:text-worm-green whitespace-nowrap"
                        >
                          View replay
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
