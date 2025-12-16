/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-15
 * PURPOSE: Live game status strip showing game state, round, scores, and apple counts.
 *          Large, centered, bold typography to make streaming status obvious.
 * SRP/DRY check: Pass - focused solely on rendering live game state at top of page.
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
  currentRound?: number;
  maxRounds?: number;
  aliveSnakes?: string[];
}

function StatusIcon({ status }: { status: StreamState }) {
  switch (status) {
    case 'in_progress':
      return <span className="text-xl">🔴</span>;
    case 'completed':
      return <span className="text-xl">✓</span>;
    case 'failed':
      return <span className="text-xl">✗</span>;
    case 'connecting':
    case 'starting':
      return <span className="text-xl">↻</span>;
    default:
      return <span className="text-xl">○</span>;
  }
}

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
  currentRound = 0,
  maxRounds = 0,
  aliveSnakes = [],
}: WormArenaLiveStatusStripProps) {
  const batchText =
    currentMatchIndex && totalMatches ? `Match ${currentMatchIndex}/${totalMatches}` : undefined;
  const sessionText = sessionId ? `${sessionId.slice(0, 8)}…` : undefined;
  const roundText = maxRounds > 0 ? `Round ${currentRound}/${maxRounds}` : '';
  const aliveText = aliveSnakes.length > 0 ? `Alive: ${aliveSnakes.join(', ')}` : '';

  return (
    <div className="rounded-lg border-2 worm-border bg-gradient-to-b from-worm-ink/5 to-white/90 shadow-md px-6 py-4">
      <div className="space-y-3">
        {/* Header with status and batch info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon status={status} />
            <div className="text-lg font-bold text-worm-ink">
              {error ? (
                <span className="text-red-600">Error: {error}</span>
              ) : (
                <>
                  {status === 'in_progress'
                    ? 'Streaming'
                    : status === 'completed'
                      ? 'Match Complete'
                      : status === 'connecting' || status === 'starting'
                        ? 'Starting'
                        : 'Idle'}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            {batchText && <span>{batchText}</span>}
            {sessionText && <span>{sessionText}</span>}
          </div>
        </div>

        {/* Message or game state */}
        {message && (
          <div className="text-sm text-worm-ink font-medium">{message}</div>
        )}

        {/* Game state grid: Round | Scores | Alive */}
        {(roundText || playerAScore !== undefined || playerBScore !== undefined || aliveText) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-dashed border-worm-ink/10">
            {roundText && (
              <div className="flex flex-col items-center">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">Round</div>
                <div className="text-lg font-bold text-worm-ink">{roundText}</div>
              </div>
            )}

            {playerAScore !== undefined && (
              <div className="flex flex-col items-center">
                <div className="text-[11px] font-semibold uppercase text-green-700">{playerAName}</div>
                <div className="text-2xl font-bold text-green-600">
                  {playerAScore} <span className="text-lg">🍎</span>
                </div>
              </div>
            )}

            {playerBScore !== undefined && (
              <div className="flex flex-col items-center">
                <div className="text-[11px] font-semibold uppercase text-blue-700">{playerBName}</div>
                <div className="text-2xl font-bold text-blue-600">
                  {playerBScore} <span className="text-lg">🍎</span>
                </div>
              </div>
            )}

            {aliveText && (
              <div className="flex flex-col items-center">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">Status</div>
                <div className="text-sm font-medium text-worm-ink">{aliveText}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

