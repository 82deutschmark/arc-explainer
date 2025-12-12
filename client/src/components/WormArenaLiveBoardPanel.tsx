import React from 'react';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import type { WormArenaFinalSummary, WormArenaFrameEvent } from '@shared/types';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

type ViewMode = 'live' | 'completed';

export interface WormArenaLiveBoardPanelProps {
  viewMode: ViewMode;
  status: StreamState;
  latestFrame: WormArenaFrameEvent | null;
  boardWidth: number;
  boardHeight: number;
  finalSummary?: WormArenaFinalSummary | null;
}

export default function WormArenaLiveBoardPanel({
  viewMode,
  status,
  latestFrame,
  boardWidth,
  boardHeight,
  finalSummary,
}: WormArenaLiveBoardPanelProps) {
  const title = viewMode === 'completed' ? 'Final board' : 'Live board';

  return (
    <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 worm-border">
      <div className="text-xs font-bold uppercase tracking-wide text-worm-ink mb-3">{title}</div>

      {latestFrame ? (
        <div className="flex items-center justify-center">
          <WormArenaGameBoard frame={latestFrame.frame} boardWidth={boardWidth} boardHeight={boardHeight} />
        </div>
      ) : (
        <div className="h-[240px] flex flex-col items-center justify-center text-center worm-muted">
          {viewMode === 'completed' ? (
            <>
              <div className="text-sm font-medium text-worm-ink">No frames streamed for this match.</div>
              {finalSummary?.gameId ? (
                <a
                  href={`/worm-arena?matchId=${encodeURIComponent(finalSummary.gameId)}`}
                  className="mt-3 px-4 py-2 rounded text-xs font-semibold text-white bg-worm-ink hover:opacity-90 transition-opacity"
                >
                  View replay
                </a>
              ) : null}
            </>
          ) : (
            <div className="text-sm font-medium text-worm-ink">
              {status === 'failed' ? 'Match failed.' : 'Waiting for first frame…'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
