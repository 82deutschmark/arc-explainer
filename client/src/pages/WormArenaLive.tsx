import React, { useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import useWormArenaStreaming from '@/hooks/useWormArenaStreaming';

/**
 * Author: Cascade
 * Date: 2025-12-09
 * PURPOSE: Live Worm Arena match view opened in a new tab.
 *          Shows status + board (when frames are streamed) or a waiting state.
 * SRP/DRY check: Pass — consumes the streaming hook, no replay logic here.
 */

export default function WormArenaLive() {
  const [match, params] = useRoute('/worm-arena/live/:sessionId');
  const sessionId = params?.sessionId ?? '';
  const {
    status,
    message,
    frames,
    finalSummary,
    error,
    connect,
    disconnect,
  } = useWormArenaStreaming();

  useEffect(() => {
    if (!sessionId) return;
    connect(sessionId);
    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  const latestFrame = useMemo(() => {
    if (frames.length === 0) return null;
    return frames[frames.length - 1];
  }, [frames]);

  const boardWidth = (latestFrame as any)?.frame?.state?.width ?? 10;
  const boardHeight = (latestFrame as any)?.frame?.state?.height ?? 10;

  const statusBadge = (() => {
    switch (status) {
      case 'connecting':
      case 'starting':
        return <span className="badge badge-outline">Starting…</span>;
      case 'in_progress':
        return <span className="badge badge-primary">Streaming</span>;
      case 'completed':
        return <span className="badge badge-success">Completed</span>;
      case 'failed':
        return <span className="badge badge-error">Failed</span>;
      default:
        return <span className="badge badge-neutral">Idle</span>;
    }
  })();

  const infoText = error
    ? error
    : message || (status === 'in_progress' ? 'Running your match…' : 'Preparing your match…');

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <header className="px-6 py-4 border-b border-amber-200 bg-white/80 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-amber-900">🌱 Worm Arena — Live Match</div>
            <div className="text-sm text-amber-700">
              This may take a little while. Keep this tab open to watch progress.
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">{statusBadge}</div>
        </div>
      </header>

      <main className="p-6 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-amber-900 font-semibold">Session</div>
              <div className="text-xs text-amber-700 break-all">{sessionId || 'Unknown session'}</div>
            </div>
            <div className="text-sm text-amber-800">{infoText}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border border-amber-200 bg-white/90 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-amber-900 mb-3">Board</h2>
            {latestFrame ? (
              <WormArenaGameBoard frame={latestFrame.frame} boardWidth={boardWidth} boardHeight={boardHeight} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-amber-700 text-sm">
                {status === 'failed'
                  ? 'Match failed.'
                  : status === 'completed'
                  ? 'No frames streamed for this match.'
                  : 'Waiting for live updates…'}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-white/90 p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-amber-900">Live Status</h2>
            <div className="text-sm text-amber-800 min-h-[2rem]">{infoText}</div>

            {finalSummary && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-amber-900">Final</div>
                <div className="text-sm text-amber-800">Game ID: {finalSummary.gameId}</div>
                <div className="text-sm text-amber-800">
                  Models: {finalSummary.modelA} vs {finalSummary.modelB}
                </div>
                <div className="text-sm text-amber-800">
                  Scores:{' '}
                  {Object.entries(finalSummary.scores || {}).map(([k, v]) => (
                    <span key={k} className="mr-2">
                      {k}:{v}
                    </span>
                  ))}
                </div>
                <a
                  href={`/worm-arena?gameId=${encodeURIComponent(finalSummary.gameId)}`}
                  className="btn btn-sm btn-primary text-white"
                >
                  View replay in Worm Arena
                </a>
              </div>
            )}

            {!finalSummary && status !== 'failed' && (
              <div className="text-xs text-amber-700">
                We’ll show the final scores and replay link here once the match completes.
              </div>
            )}

            {error && <div className="text-sm text-red-600">Error: {error}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
