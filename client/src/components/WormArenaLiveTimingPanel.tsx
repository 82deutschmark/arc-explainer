/**
 * Author: GLM4.7
 * Date: 2026-01-13
 * PURPOSE: Display timing metrics for Worm Arena live matches.
 *          Shows average time per round, per-player response times, and API latency.
 * SRP/DRY check: Pass - focused on timing display only.
 */

import React from 'react';
import type { WormArenaPlayerTiming, WormArenaRoundTiming } from '@shared/types';

interface WormArenaLiveTimingPanelProps {
  playerTiming: Record<string, WormArenaPlayerTiming>;
  roundTiming: WormArenaRoundTiming[];
}

function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatAvgTimePerRound(roundTiming: WormArenaRoundTiming[]): string {
  if (!roundTiming.length) return '—';
  const totalMs = roundTiming.reduce((sum, r) => sum + r.durationMs, 0);
  const avgMs = totalMs / roundTiming.length;
  return formatMs(avgMs);
}

export default function WormArenaLiveTimingPanel({
  playerTiming,
  roundTiming,
}: WormArenaLiveTimingPanelProps) {
  const playerIds = Object.keys(playerTiming);
  const hasData = playerIds.length > 0 || roundTiming.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="rounded-lg border-2 worm-border bg-white shadow-sm px-4 py-3 space-y-3">
      <div className="text-[11px] uppercase font-semibold text-muted-foreground">
        Timing Metrics
      </div>

      {/* Average time per round */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Avg time per round:</span>
        <span className="font-mono font-semibold">{formatAvgTimePerRound(roundTiming)}</span>
      </div>

      {/* Per-player timing */}
      {playerIds.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200">
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">
            Per-Player Response Times
          </div>
          {playerIds.map((playerId) => {
            const timing = playerTiming[playerId];
            if (!timing) return null;
            return (
              <div key={playerId} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Player {playerId}</span>
                  <span className="text-muted-foreground">{timing.moveCount} moves</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Avg response:</span>
                    <span className="font-mono">{formatMs(timing.avgResponseTimeMs)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Last response:</span>
                    <span className="font-mono">{formatMs(timing.lastResponseTimeMs)}</span>
                  </div>
                </div>
                {timing.avgApiLatencyMs > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Avg API latency: </span>
                    <span className="font-mono">{formatMs(timing.avgApiLatencyMs)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
