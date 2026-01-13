/**
 * Author: Cascade
 * Date: 2025-12-30
 * PURPOSE: Worm Arena "Greatest Hits" card with Share/Tweet buttons.
 *          Shows a short list of especially interesting matches
 *          (longest, most expensive, highest-scoring) with one-click
 *          replay links into the main Worm Arena viewer.
 *
 *          Layout note: Matchup strings can be long (provider/model IDs).
 *          Updated to ensure full model slugs are visible without truncation
 *          labels (Champion/Challenger).
 *
 *          Note: Uses a simple overflow container instead of Radix ScrollArea.
 *          ScrollArea requires a fixed height and can render a 0-height viewport
 *          when only max-height is applied, causing the list to appear cut off.
 *          Replay links open in a new tab so users can keep the stats page open.
 * SRP/DRY check: Pass — purely presentational; data comes from hook.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';
import WormArenaMatchCard from '@/components/wormArena/WormArenaMatchCard';
import type { WormArenaGreatestHitGame } from '@shared/types';

function normalizeGameId(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
  return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

const PINNED_GAMES: WormArenaGreatestHitGame[] = [
  {
    gameId: '42ccab35-b987-425c-8a32-5a9f7040f6aa',
    startedAt: '2026-01-13T17:41:21.371773',
    modelA: 'openai/gpt-5.2',
    modelB: 'x-ai/grok-4.1-fast',
    roundsPlayed: 52,
    maxRounds: 150,
    totalCost: 1.5168757,
    maxFinalScore: 26,
    scoreDelta: 2,
    boardWidth: 10,
    boardHeight: 10,
    highlightReason: 'Pinned: GPT-5.2 defeated Grok 4.1 Fast 24-26 in a 52-round match. Grok died via body collision in round 51.',
  },
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
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-black">
          Greatest Hits Matches
        </CardTitle>
        <p className="text-base mt-2 text-gray-800 leading-relaxed">
          Curated Worm Arena games with long runs, high costs, big scores, or monster apple hauls.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base text-black">
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
          <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
              {mergedGames.map((game) => (
                <WormArenaMatchCard
                  key={game.gameId}
                  gameId={game.gameId}
                  startedAt={game.startedAt}
                  modelA={game.modelA}
                  modelB={game.modelB}
                  roundsPlayed={game.roundsPlayed}
                  maxRounds={game.maxRounds}
                  totalCost={game.totalCost}
                  maxFinalScore={game.maxFinalScore}
                  scoreDelta={game.scoreDelta}
                  highlightReason={game.highlightReason}
                  durationSeconds={game.durationSeconds}
                  sumFinalScores={game.sumFinalScores}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
