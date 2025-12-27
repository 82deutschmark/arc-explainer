/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-19
 * PURPOSE: Under-board live status strip that restores the familiar round/score/alive
 *          grid while also summarizing stream state and batch progress.
 * SRP/DRY check: Pass - renders contextual status and stats; streaming logic lives in hooks.
 */

import React from 'react';

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

        <div>
          <div className="text-[11px] uppercase font-semibold text-green-700">{playerAName}</div>
          <div className="text-worm-ink font-semibold">{Math.max(0, Number(playerAScore) || 0)} 🍎</div>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold text-blue-700">{playerBName}</div>
          <div className="text-worm-ink font-semibold">{Math.max(0, Number(playerBScore) || 0)} 🍎</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Phase</div>
          <div className="text-worm-ink font-medium">{phase || (sessionId ? 'Live stream' : '—')}</div>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold text-muted-foreground">Session</div>
          <div className="text-worm-ink font-mono text-xs break-all">{sessionId || '—'}</div>
        </div>
      </div>
    </div>
  );
}
