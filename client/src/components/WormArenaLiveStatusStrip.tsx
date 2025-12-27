/**
 * Author: Cascade (GPT-4.1)
 * Date: 2025-12-27
 * PURPOSE: Under-board live status strip that restores the round/score/alive grid,
 *          surfaces timing + session metadata, and keeps layout legible during streaming.
 * SRP/DRY check: Pass - purely presentational; all streaming logic lives in hooks/pages.
 */

import React from 'react';
import { Clipboard } from 'lucide-react';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

export interface WormArenaLiveStatusStripProps {
  status: StreamState;
  message?: string;
  error?: string | null;
  sessionId?: string;
  currentMatchIndex?: number | null;
  totalMatches?: number | null;
  playerAName?: string;
  playerBName?: string;
  playerAScore?: number;
  playerBScore?: number;
  currentRound?: number | null;
  maxRounds?: number | null;
  phase?: string;
  aliveSnakes?: string[];
  wallClockSeconds?: number | null;
  sinceLastMoveSeconds?: number | null;
}

const STATUS_LABELS: Record<StreamState, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  starting: 'Starting',
  in_progress: 'Streaming',
  completed: 'Match complete',
  failed: 'Match failed',
};

export default function WormArenaLiveStatusStrip({
  status,
  message,
  error,
  sessionId,
  currentMatchIndex,
  totalMatches,
  playerAName = 'Player A',
  playerBName = 'Player B',
  playerAScore = 0,
  playerBScore = 0,
  currentRound = null,
  maxRounds = null,
  phase,
  aliveSnakes = [],
  wallClockSeconds = null,
  sinceLastMoveSeconds = null,
}: WormArenaLiveStatusStripProps) {
  const batchText =
    currentMatchIndex && totalMatches ? `Match ${currentMatchIndex}/${totalMatches}` : undefined;
  const aliveText = aliveSnakes.length > 0 ? aliveSnakes.join(', ') : '—';
  const statusColor =
    status === 'failed'
      ? 'bg-red-500'
      : status === 'completed'
      ? 'bg-emerald-500'
      : status === 'in_progress'
      ? 'bg-green-500'
      : status === 'starting' || status === 'connecting'
      ? 'bg-amber-400'
      : 'bg-slate-400';
  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.idle;
  const roundValue =
    maxRounds && maxRounds > 0
      ? `${Math.max(0, currentRound ?? 0)} / ${maxRounds}`
      : currentRound !== null && currentRound !== undefined
      ? `${Math.max(0, currentRound)}`
      : '—';

  const copySession = React.useCallback(() => {
    if (!sessionId) return;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(sessionId);
    }
  }, [sessionId]);

  return (
    <div className="rounded-lg border-2 worm-border bg-white shadow-sm px-6 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${statusColor}`} aria-hidden="true" />
        <div className="text-base font-semibold text-worm-ink">
          {error ? <span className="text-red-600">Error: {error}</span> : statusLabel}
        </div>
        {batchText && (
          <div className="text-xs font-mono text-muted-foreground ml-auto">{batchText}</div>
        )}
      </div>

      {message && <div className="text-sm text-worm-ink font-medium">{message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Round</div>
          <div className="text-worm-ink font-semibold">{roundValue}</div>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Alive</div>
          <div className="text-worm-ink font-medium">{aliveText}</div>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Wall clock</div>
          <div className="text-worm-ink font-medium">
            {wallClockSeconds != null ? `${Math.max(0, wallClockSeconds).toFixed(1)}s` : '—'}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Since move</div>
          <div className="text-worm-ink font-medium">
            {sinceLastMoveSeconds != null ? `${Math.max(0, sinceLastMoveSeconds).toFixed(1)}s` : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2">
          <div className="text-[11px] uppercase font-semibold text-emerald-800">Player A</div>
          <div className="flex flex-col min-w-0">
            <div className="text-worm-ink font-semibold truncate">{playerAName}</div>
            <div className="text-worm-ink font-semibold">{Math.max(0, Number(playerAScore) || 0)} 🍎</div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2">
          <div className="text-[11px] uppercase font-semibold text-blue-800">Player B</div>
          <div className="flex flex-col min-w-0">
            <div className="text-worm-ink font-semibold truncate">{playerBName}</div>
            <div className="text-worm-ink font-semibold">{Math.max(0, Number(playerBScore) || 0)} 🍎</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Phase</div>
          <div className="text-worm-ink font-medium">{phase || (sessionId ? 'Live stream' : '—')}</div>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-2">
            <span>Session</span>
            {sessionId && (
              <button
                type="button"
                onClick={copySession}
                className="inline-flex items-center gap-1 rounded border border-muted-foreground/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted-foreground/10"
                aria-label="Copy session id"
              >
                <Clipboard className="h-3 w-3" aria-hidden="true" />
                Copy
              </button>
            )}
          </div>
          <div className="text-worm-ink font-mono text-xs break-all">{sessionId || '—'}</div>
        </div>
      </div>
    </div>
  );
}
