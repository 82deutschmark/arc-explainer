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

  const durationLabel = durationSeconds && durationSeconds > 0
    ? (() => {
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        return hours >= 1 ? `${hours}h ${minutes}m` : `${minutes}m`;
      })()
    : null;

  const replayHref = `/worm-arena?matchId=${encodeURIComponent(normalizeGameId(gameId))}`;

  return (
    <div className="group relative flex flex-col md:flex-row gap-2 md:gap-4 rounded-md border p-2.5 bg-white/80 worm-border hover:bg-white transition-colors">
      {/* Left side: Models and Badges */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-2 gap-y-0.5">
          <div className="font-mono text-[11px] font-bold flex items-center gap-1" title={modelA}>
            <span>{modelA}</span>
          </div>
          <span className="hidden sm:inline text-[10px] text-worm-muted">vs</span>
          <div className="font-mono text-[11px] font-bold flex items-center gap-1" title={modelB}>
            <span>{modelB}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="px-1.5 py-0 h-4.5 text-[9px] font-bold uppercase tracking-tight">
            {roundsLabel}
          </Badge>
          {costLabel && (
            <Badge variant="outline" className="px-1.5 py-0 h-4.5 text-[9px] font-bold uppercase tracking-tight border-[var(--worm-border)] text-[var(--worm-metric-cost)]">
              Cost: {costLabel}
            </Badge>
          )}
          <Badge variant="outline" className="px-1.5 py-0 h-4.5 text-[9px] font-bold uppercase tracking-tight">
            {scoreLabel}
          </Badge>
          {durationLabel && (
            <Badge variant="outline" className="px-1.5 py-0 h-4.5 text-[9px] font-bold uppercase tracking-tight border-[var(--worm-border)]">
              {durationLabel}
            </Badge>
          )}
          {result && (
            <Badge 
              variant="outline" 
              className={`px-1.5 py-0 h-4.5 text-[9px] font-bold uppercase tracking-tight ${
                result === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                result === 'lost' ? 'bg-red-50 text-red-700 border-red-200' : 
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {result}
            </Badge>
          )}
          {deathReason && deathReason !== 'survived' && (
            <span className="text-[10px] worm-muted italic opacity-80">({deathReason.replace(/_/g, ' ')})</span>
          )}
        </div>

        {highlightReason && (
          <div className="text-[11px] worm-muted leading-snug border-l-2 pl-2 border-worm-track py-0">
            {highlightReason}
          </div>
        )}
      </div>

      {/* Right side: Actions and Date */}
      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-1.5 shrink-0">
        <div className="text-[10px] worm-muted font-mono whitespace-nowrap">
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
            className="h-6 px-1.5 text-[10px] opacity-60 hover:opacity-100"
          />
          <a
            href={replayHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-0.5 bg-[var(--worm-track)] hover:bg-[var(--worm-track-hover)] rounded text-[10px] font-bold text-[var(--worm-ink)] transition-colors whitespace-nowrap border border-[var(--worm-border)]"
          >
            <Play className="w-2.5 h-2.5" />
            View replay
          </a>
        </div>
      </div>
    </div>
  );
}
