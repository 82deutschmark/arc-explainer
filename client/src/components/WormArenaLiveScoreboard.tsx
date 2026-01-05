/**
 * Author: Cascade (GPT-4.1)
 * Date: 2025-12-27
 * PURPOSE: Compact Worm Arena scoreboard with TrueSkill stats integration.
 *          Shows model names, adjacent apple scores, and key TrueSkill metrics (mu, sigma, exposed).
 *          Adds live timing context (wall clock + since-last-move) in-band with the strip.
 * SRP/DRY check: Pass - presentational only; all streaming/state logic passed via props.
 */

import React from 'react';

// Consistent worm emoji for all players
const WORM_ICON = '\uD83D\uDC1B'; // 🐛
const APPLE_ICON = '\uD83C\uDF4E'; // 🍎

export interface WormArenaLiveScoreboardProps {
  playerAName: string;
  playerBName: string;
  playerAScore: number;
  playerBScore: number;
  wallClockSeconds?: number | null;
  sinceLastMoveSeconds?: number | null;
  /** Optional TrueSkill stats for player A */
  playerAStats?: {
    mu?: number;
    sigma?: number;
    exposed?: number;
    gamesPlayed?: number;
  };
  /** Optional TrueSkill stats for player B */
  playerBStats?: {
    mu?: number;
    sigma?: number;
    exposed?: number;
    gamesPlayed?: number;
  };
}

export default function WormArenaLiveScoreboard({
  playerAName,
  playerBName,
  playerAScore,
  playerBScore,
  wallClockSeconds = null,
  sinceLastMoveSeconds = null,
  playerAStats,
  playerBStats,
}: WormArenaLiveScoreboardProps) {
  // Determine who's winning for visual emphasis
  const aWinning = playerAScore > playerBScore;
  const bWinning = playerBScore > playerAScore;

  // Format times in proper MM:SS format
  const formatTime = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return '—';
    const totalSeconds = Math.max(0, Math.floor(value));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const renderPlayer = (
    name: string,
    score: number,
    color: 'green' | 'blue',
    isWinning: boolean,
    stats?: { mu?: number; sigma?: number; exposed?: number; gamesPlayed?: number },
  ) => {
    const pillClasses = color === 'green'
      ? 'bg-green-600 text-white'
      : 'bg-blue-600 text-white';
    const nameColor = color === 'green' ? 'text-green-700' : 'text-blue-700';

    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Worm icon */}
        <span className="text-lg shrink-0" aria-hidden="true">{WORM_ICON}</span>

        {/* Name + stats + score pill grouped tightly */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold uppercase tracking-wide truncate ${nameColor}`}>
              {name}
            </div>
            {stats && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                {stats.exposed !== undefined && (
                  <span title="Pessimistic rating (mu - 3*sigma)">
                    {stats.exposed.toFixed(1)}
                  </span>
                )}
                {stats.mu !== undefined && stats.sigma !== undefined && (
                  <span className="opacity-60" title={`mu=${stats.mu.toFixed(1)}, sigma=${stats.sigma.toFixed(1)}`}>
                    ({stats.sigma.toFixed(1)}\u03C3)
                  </span>
                )}
                {stats.gamesPlayed !== undefined && (
                  <span className="opacity-60" title="Games played">
                    {stats.gamesPlayed}g
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Apple score pill - tight to name */}
          <div
            className={`
              flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold
              transition-transform duration-150 shrink-0
              ${pillClasses}
              ${isWinning ? 'scale-105 ring-2 ring-offset-1 ring-yellow-400' : ''}
            `}
          >
            <span className="tabular-nums">{Math.max(0, Number(score) || 0)}</span>
            <span className="text-xs" aria-hidden="true">{APPLE_ICON}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border worm-border bg-white/95 shadow-sm px-3 py-2 space-y-1.5">
      {/* Compact single-row layout */}
      <div className="flex items-center gap-4">
        {renderPlayer(playerAName, playerAScore, 'green', aWinning, playerAStats)}

        {/* VS divider - minimal */}
        <span className="text-xs font-bold text-worm-ink/60 shrink-0 px-2">vs</span>

        {renderPlayer(playerBName, playerBScore, 'blue', bWinning, playerBStats)}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
        <span className="uppercase text-[10px] text-worm-ink/70">Clock</span>
        <span className="tabular-nums">{formatTime(wallClockSeconds)}</span>
        <span className="uppercase text-[10px] text-worm-ink/70">Since move</span>
        <span className="tabular-nums">{formatTime(sinceLastMoveSeconds)}</span>
      </div>
    </div>
  );
}
