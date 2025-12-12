import React from 'react';
import type { WormArenaFinalSummary } from '@shared/types';

export interface WormArenaLiveResultsPanelProps {
  finalSummary: WormArenaFinalSummary;
}

export default function WormArenaLiveResultsPanel({ finalSummary }: WormArenaLiveResultsPanelProps) {
  return (
    <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 worm-border space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">Match complete</div>
        <div className="text-[11px] worm-muted font-mono">{finalSummary.gameId.slice(0, 12)}…</div>
      </div>

      <div>
        <div className="text-[11px] worm-muted">Matchup</div>
        <div className="text-sm text-worm-ink font-semibold break-words">
          {finalSummary.modelA} vs {finalSummary.modelB}
        </div>
      </div>

      <div>
        <div className="text-[11px] worm-muted mb-2">Final scores</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(finalSummary.scores || {}).map(([k, v]) => (
            <div key={k} className="text-xs font-mono bg-white/60 rounded p-2">
              <span className="text-worm-ink font-semibold">{k}:</span> {v}
            </div>
          ))}
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
