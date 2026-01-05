/**
 * Author: Cascade
 * Date: 2025-12-30
 * PURPOSE: A reusable, compact card for displaying Worm Arena matches.
 *          Unifies the design between "Greatest Hits" and "Search Results"
 *          while minimizing wasted vertical space.
 *          Updated to remove "Champion/Challenger" labels and prevent model name truncation.
 * SRP/DRY check: Pass - Single responsibility for match display, reused across pages.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import WormArenaShareButton from '@/components/WormArenaShareButton';
import { Play } from 'lucide-react';

export interface MatchCardProps {
  gameId: string;
  startedAt: string;
  modelA: string;
  modelB: string;
  roundsPlayed: number;
  maxRounds?: number;
  totalCost: number;
  maxFinalScore: number;
  scoreDelta: number;
  highlightReason?: string;
  durationSeconds?: number;
  sumFinalScores?: number;
  deathReason?: string | null;
  // For search results where we know the specific score of 'my' model
  myScore?: number;
  opponentScore?: number;
  result?: 'won' | 'lost' | 'tied';
}

function normalizeGameId(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
  return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

export default function WormArenaMatchCard(props: MatchCardProps) {
  const {
    gameId,
    startedAt,
    modelA,
    modelB,
    roundsPlayed,
    maxRounds,
    totalCost,
    maxFinalScore,
    scoreDelta,
    highlightReason,
    durationSeconds,
    sumFinalScores,
    deathReason,
    myScore,
    opponentScore,
    result
  } = props;

  const roundsLabel = `${roundsPlayed}${maxRounds ? ` / ${maxRounds}` : ''} rounds`;
  const costLabel = totalCost > 0 ? `$${totalCost.toFixed(3)}` : null;

  // Scoring label logic: show specific scores if available, else delta
  let scoreLabel = '';
  if (myScore !== undefined && opponentScore !== undefined) {
    scoreLabel = `${myScore}-${opponentScore}`;
  } else if (scoreDelta > 0) {
    scoreLabel = `Delta: ${scoreDelta}`;
  } else {
    scoreLabel = `Max Score: ${maxFinalScore}`;
  }

  // Duration in minutes:seconds format (e.g., "5:23" or "1:02:45" for hours)
  const durationLabel = durationSeconds && durationSeconds > 0
    ? (() => {
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.floor((durationSeconds % 3600) / 60);
      const seconds = Math.floor(durationSeconds % 60);
      if (hours >= 1) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    })()
    : null;

  const replayHref = `/worm-arena?matchId=${encodeURIComponent(normalizeGameId(gameId))}`;

  return (
    <div className="group relative flex flex-col md:flex-row gap-3 md:gap-6 rounded-lg border-2 p-4 bg-white hover:bg-gray-50 border-[var(--worm-border)] hover:border-[var(--worm-ink)] transition-all shadow-sm">
      {/* Left side: Models and Badges */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-1">
          <div className="font-mono text-sm font-bold text-black flex items-center gap-1" title={modelA}>
            <span>{modelA}</span>
          </div>
          <span className="hidden sm:inline text-sm text-gray-600 font-medium">vs</span>
          <div className="font-mono text-sm font-bold text-black flex items-center gap-1" title={modelB}>
            <span>{modelB}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-2 py-0.5 h-6 text-xs font-bold uppercase tracking-tight text-black border-gray-400">
            {roundsLabel}
          </Badge>
          {costLabel && (
            <Badge variant="outline" className="px-2 py-0.5 h-6 text-xs font-bold uppercase tracking-tight border-amber-500 text-amber-800 bg-amber-50">
              Cost: {costLabel}
            </Badge>
          )}
          <Badge variant="outline" className="px-2 py-0.5 h-6 text-xs font-bold uppercase tracking-tight text-black border-gray-400">
            {scoreLabel}
          </Badge>
          {durationLabel && (
            <Badge variant="outline" className="px-2 py-0.5 h-6 text-xs font-bold uppercase tracking-tight border-blue-400 text-blue-800 bg-blue-50">
              ⏱ {durationLabel}
            </Badge>
          )}
          {result && (
            <Badge
              variant="outline"
              className={`px-2 py-0.5 h-6 text-xs font-bold uppercase tracking-tight ${result === 'won' ? 'bg-emerald-100 text-emerald-800 border-emerald-400' :
                  result === 'lost' ? 'bg-red-100 text-red-800 border-red-400' :
                    'bg-amber-100 text-amber-800 border-amber-400'
                }`}
            >
              {result}
            </Badge>
          )}
          {deathReason && deathReason !== 'survived' && (
            <span className="text-xs text-gray-700 italic">({deathReason.replace(/_/g, ' ')})</span>
          )}
        </div>

        {highlightReason && (
          <div className="text-sm text-black leading-snug border-l-4 pl-3 border-amber-400 bg-amber-50/50 py-1 rounded-r">
            {highlightReason}
          </div>
        )}
      </div>

      {/* Right side: Actions and Date */}
      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0">
        <div className="text-xs text-gray-700 font-mono whitespace-nowrap font-medium">
          {new Date(startedAt).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-2">
          <WormArenaShareButton
            data={{
              gameId,
              modelA,
              modelB,
              roundsPlayed,
              maxFinalScore,
              scoreDelta,
              totalCost,
              highlightReason,
              durationSeconds,
              sumFinalScores,
            }}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-600 hover:text-black"
          />
          <a
            href={replayHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-md text-xs font-bold text-white transition-colors whitespace-nowrap shadow-sm"
          >
            <Play className="w-3 h-3" />
            View replay
          </a>
        </div>
      </div>
    </div>
  );
}
