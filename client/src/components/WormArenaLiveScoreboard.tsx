/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: Enhanced Worm Arena apple scoreboard with larger typography, centered layout,
 *          and visual styling that matches the redesigned WormArenaHeader. Shows model
 *          names prominently with apple scores in pill-style badges.
 * SRP/DRY check: Pass - renders only the apple score strip with no streaming/state logic.
 */

import React from 'react';

const APPLE_ICON = String.fromCodePoint(0x1F34E);

export interface WormArenaLiveScoreboardProps {
  playerAName: string;
  playerBName: string;
  playerAScore: number;
  playerBScore: number;
}

export default function WormArenaLiveScoreboard({
  playerAName,
  playerBName,
  playerAScore,
  playerBScore,
}: WormArenaLiveScoreboardProps) {
  // Determine who's winning for visual emphasis
  const aWinning = playerAScore > playerBScore;
  const bWinning = playerBScore > playerAScore;

  const renderPlayer = (
    name: string,
    score: number,
    color: 'green' | 'blue',
    isWinning: boolean,
  ) => {
    const colorClasses = color === 'green'
      ? 'bg-green-600 text-white border-green-700'
      : 'bg-blue-600 text-white border-blue-700';
    const nameColor = color === 'green' ? 'text-green-700' : 'text-blue-700';
    const wormIcon = color === 'green' ? String.fromCodePoint(0x1F40C) : String.fromCodePoint(0x1F41B);

    return (
      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
        {/* Model name - truncated if long */}
        <div className={`text-sm md:text-base font-bold uppercase tracking-wide truncate max-w-full px-2 ${nameColor}`}>
          {name}
        </div>

        {/* Apple score pill */}
        <div
          className={`
            flex items-center gap-2 px-5 py-2 rounded-full border-2 shadow-md
            transition-transform duration-200
            ${colorClasses}
            ${isWinning ? 'scale-110 shadow-lg' : ''}
          `}
        >
          <span className="text-2xl md:text-3xl font-bold tabular-nums">
            {Math.max(0, Number(score) || 0)}
          </span>
          <span className="text-xl md:text-2xl" aria-hidden="true">
            {APPLE_ICON}
          </span>
        </div>

        {/* Worm icon under score */}
        <span className="text-2xl" aria-hidden="true">{wormIcon}</span>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border-2 worm-border bg-white/95 shadow-lg px-6 py-4">
      {/* Header label */}
      <div className="text-center mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Apple Score
        </span>
      </div>

      {/* Score display - three column layout */}
      <div className="flex items-center justify-center gap-4 md:gap-8">
        {renderPlayer(playerAName, playerAScore, 'green', aWinning)}

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1 px-2">
          <span className="text-lg md:text-xl font-black tracking-widest text-worm-ink/60">
            VS
          </span>
        </div>

        {renderPlayer(playerBName, playerBScore, 'blue', bWinning)}
      </div>
    </div>
  );
}
