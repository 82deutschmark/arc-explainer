import React from 'react';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

export interface WormArenaLiveStatusStripProps {
  status: StreamState;
  message?: string;
  error?: string | null;
  sessionId?: string;
  currentMatchIndex?: number | null;
  totalMatches?: number | null;
}

function StatusBadge({ status }: { status: StreamState }) {
  switch (status) {
    case 'connecting':
    case 'starting':
      return <span className="badge badge-outline">Starting...</span>;
    case 'in_progress':
      return <span className="badge badge-primary">Streaming</span>;
    case 'completed':
      return <span className="badge badge-success">Completed</span>;
    case 'failed':
      return <span className="badge badge-error">Failed</span>;
    default:
      return <span className="badge badge-neutral">Idle</span>;
  }
}

export default function WormArenaLiveStatusStrip({
  status,
  message,
  error,
  sessionId,
  currentMatchIndex,
  totalMatches,
}: WormArenaLiveStatusStripProps) {
  const batchText =
    currentMatchIndex && totalMatches ? `Match ${currentMatchIndex} / ${totalMatches}` : undefined;

  const sessionText = sessionId ? `${sessionId.slice(0, 12)}...` : undefined;

  return (
    <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-2 worm-border">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={status} />
          <div className="text-xs text-worm-ink truncate">
            {error ? error : message || (status === 'in_progress' ? 'Streaming...' : 'Preparing...')}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {batchText && <div className="text-[11px] worm-muted font-mono">{batchText}</div>}
          {sessionText && <div className="text-[11px] worm-muted font-mono">{sessionText}</div>}
        </div>
      </div>
    </div>
  );
}

