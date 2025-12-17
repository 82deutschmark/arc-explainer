/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-19
 * PURPOSE: Ultra-compact Worm Arena apple scoreboard that stays above the live board
 *          without crowding the viewport (roughly 50% shorter than the previous design).
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
  const renderEntry = (label: string, score: number, accentClass: string) => (
    <div className="flex flex-col items-center gap-0.5 px-3">
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}>{label}</div>
      <div className="text-2xl font-bold text-worm-ink flex items-center gap-1.5 leading-none">
        {Math.max(0, Number(score) || 0)}
        <span aria-hidden="true" className="text-xl">
          {APPLE_ICON}
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border-2 worm-border bg-white shadow-sm px-4 py-2 flex flex-col gap-1.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Apple score</div>
      <div className="flex items-center justify-between gap-4">
        {renderEntry(playerAName, playerAScore, 'text-green-700')}
        <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-worm-ink/80">vs</div>
        {renderEntry(playerBName, playerBScore, 'text-blue-700')}
      </div>
    </div>
  );
}
