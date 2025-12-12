/**
 * Author: Cascade
 * Date: 2025-12-12
 * PURPOSE: Worm Arena Live status strip component for live mode.
 *          Displays slim status UI with state badge, message, and optional batch progress.
 *          Used only in live mode to show current streaming status without wasted space.
 * SRP/DRY check: Pass - Single responsibility for status display.
 */

import React from 'react';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

interface WormArenaLiveStatusStripProps {
  status: StreamState;
  message?: string;
  error?: string;
  currentMatchIndex?: number | null;
  totalMatches?: number | null;
  sessionId?: string;
}

export default function WormArenaLiveStatusStrip({
  status,
  message,
  error,
  currentMatchIndex,
  totalMatches,
  sessionId,
}: WormArenaLiveStatusStripProps) {
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

  const batchProgress = currentMatchIndex && totalMatches
    ? `Match ${currentMatchIndex} of ${totalMatches}`
    : null;

  return (
    <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-3 worm-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">
            Status
          </div>
          {statusBadge}
          {batchProgress && (
            <span className="text-xs worm-muted font-mono">
              {batchProgress}
            </span>
          )}
        </div>
        {sessionId && (
          <div className="text-xs worm-muted font-mono" title={sessionId}>
            {sessionId.slice(0, 12)}…
          </div>
        )}
      </div>
      <div className="text-xs text-worm-ink leading-relaxed mt-2">
        {infoText}
      </div>
    </div>
  );
}
