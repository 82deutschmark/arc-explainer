/**
 * Author: Claude
 * Date: 2025-12-17
 * PURPOSE: Inline Worm Arena results card that summarizes the finished match without
 *          navigating away from the streaming experience.
 *          Now displays match duration and average time per round when timestamps available.
 * SRP/DRY check: Pass – only formats the final summary payload.
 */

import React from 'react';
import { Check, Copy } from 'lucide-react';
import type { WormArenaFinalSummary } from '@shared/types';

export interface WormArenaLiveResultsPanelProps {
  finalSummary: WormArenaFinalSummary;
}

/**
 * Calculate match duration from startedAt/completedAt or use pre-calculated fields.
 */
function calculateDuration(summary: WormArenaFinalSummary): {
  durationSeconds: number | null;
  avgSecondsPerRound: number | null;
} {
  // Use pre-calculated fields if available
  if (summary.durationSeconds != null) {
    const avg = summary.avgSecondsPerRound ?? 
      (summary.roundsPlayed && summary.roundsPlayed > 0 
        ? summary.durationSeconds / summary.roundsPlayed 
        : null);
    return { durationSeconds: summary.durationSeconds, avgSecondsPerRound: avg };
  }

  // Calculate from timestamps
  if (summary.startedAt && summary.completedAt) {
    try {
      const start = new Date(summary.startedAt).getTime();
      const end = new Date(summary.completedAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const durationSeconds = (end - start) / 1000;
        const avgSecondsPerRound = summary.roundsPlayed && summary.roundsPlayed > 0
          ? durationSeconds / summary.roundsPlayed
          : null;
        return { durationSeconds, avgSecondsPerRound };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { durationSeconds: null, avgSecondsPerRound: null };
}

/**
 * Format seconds as human-readable duration (e.g., "1m 23s" or "45s").
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

export default function WormArenaLiveResultsPanel({ finalSummary }: WormArenaLiveResultsPanelProps) {
  const resultEntries = Object.entries(finalSummary.results || {});
  const winners = resultEntries.filter(([, label]) => label === 'won').map(([id]) => id);
  const tied = resultEntries.some(([, label]) => label === 'tied');
  const summaryText = winners.length
    ? `Winner: ${winners.join(', ')}`
    : tied
      ? 'Result: tied'
      : 'Result: pending';

  const { durationSeconds, avgSecondsPerRound } = calculateDuration(finalSummary);

  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    try {
      navigator.clipboard.writeText(finalSummary.gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Swallow copy errors quietly
    }
  }, [finalSummary.gameId]);

  const modelEntries: Array<{ key: 'modelA' | 'modelB'; label: string }> = [
    { key: 'modelA', label: 'A' },
    { key: 'modelB', label: 'B' },
  ];

  return (
    <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 worm-border space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">Match complete</div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded border border-worm-ink/40 hover:bg-worm-card transition"
          title="Copy game ID"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {finalSummary.gameId.slice(0, 12)}...
        </button>
      </div>

      <div>
        <div className="text-[11px] worm-muted">Matchup</div>
        <div className="text-sm text-worm-ink font-semibold break-words">
          {finalSummary.modelA} vs {finalSummary.modelB}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] worm-muted">Summary</div>
        <div className="text-sm text-worm-ink font-semibold">{summaryText}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
          {finalSummary.roundsPlayed !== undefined && (
            <div className="rounded border bg-white/70 px-2 py-1">
              <div className="text-[10px] uppercase tracking-wide worm-muted">Rounds</div>
              <div className="font-mono text-worm-ink">{finalSummary.roundsPlayed}</div>
            </div>
          )}
          {durationSeconds != null && (
            <div className="rounded border bg-white/70 px-2 py-1">
              <div className="text-[10px] uppercase tracking-wide worm-muted">Duration</div>
              <div className="font-mono text-worm-ink">{formatDuration(durationSeconds)}</div>
            </div>
          )}
          {avgSecondsPerRound != null && (
            <div className="rounded border bg-white/70 px-2 py-1">
              <div className="text-[10px] uppercase tracking-wide worm-muted">Avg / round</div>
              <div className="font-mono text-worm-ink">{avgSecondsPerRound.toFixed(1)}s</div>
            </div>
          )}
          <div className="rounded border bg-white/70 px-2 py-1">
            <div className="text-[10px] uppercase tracking-wide worm-muted">Game ID</div>
            <div className="font-mono text-worm-ink">{finalSummary.gameId.slice(0, 8)}…</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] worm-muted">Players</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {modelEntries.map(({ key, label }) => {
            const slug = (finalSummary as any)[key] as string | undefined;
            if (!slug) return null;
            const resultLabel = finalSummary.results?.[label === 'A' ? '0' : '1'] ?? '';
            const scoreValue = finalSummary.scores?.[slug] ?? finalSummary.scores?.[label] ?? 0;
            return (
              <div key={key} className="rounded border bg-white/80 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-worm-ink">{label}: {slug}</div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-worm-card text-worm-ink border border-worm-ink/20">
                    {resultLabel || '—'}
                  </span>
                </div>
                <div className="text-xs font-mono text-worm-ink">Score: {scoreValue}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <a
          href={`/worm-arena?matchId=${encodeURIComponent(finalSummary.gameId)}`}
          className="px-4 py-2 rounded text-xs font-semibold text-white bg-worm-ink hover:opacity-90 transition-opacity"
        >
          View replay
        </a>

        {['modelA', 'modelB'].map((key) => {
          const slug = (finalSummary as any)[key] as string | undefined;
          if (!slug) return null;
          return (
            <a
              key={key}
              href={`/worm-arena/stats?model=${encodeURIComponent(slug)}`}
              className="px-3 py-2 rounded text-xs font-semibold text-worm-ink border border-worm-ink hover:bg-worm-card transition-colors"
            >
              {slug} stats
            </a>
          );
        })}
      </div>
    </div>
  );
}
