/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-18
 * PURPOSE: Console Mirror view component for Worm Arena.
 *          Shows Python-style ASCII board and chronological event log.
 *          Provides a raw "terminal" experience as alternative to the cartoon canvas view.
 * SRP/DRY check: Pass - single responsibility console rendering component.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { renderFrameAsAscii } from '@/lib/wormArena/renderPythonAsciiBoard';
import type { WormArenaEventLogEntry } from '@/hooks/useWormArenaStreaming';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export interface WormArenaConsoleMirrorProps {
  /** Current frame data (from SSE or replay) */
  frame: any;
  /** Board width */
  boardWidth: number;
  /** Board height */
  boardHeight: number;
  /** Event log entries (live page only) */
  eventLog?: WormArenaEventLogEntry[];
  /** Alive status map keyed by snake ID */
  aliveMap?: Record<string, boolean>;
  /** Current round number */
  currentRound?: number;
  /** Maximum rounds */
  maxRounds?: number;
  /** Scores keyed by snake ID */
  scores?: Record<string, number>;
  /** Player names keyed by snake ID */
  playerNames?: Record<string, string>;
  /** Whether this is a live view (shows event log) or replay (no event log) */
  isLive?: boolean;
}

/**
 * Format timestamp for display in event log.
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Get CSS class for event type badge.
 */
function getEventTypeClass(type: string): string {
  switch (type) {
    case 'init':
      return 'bg-blue-600 text-white';
    case 'status':
      return 'bg-gray-600 text-white';
    case 'frame':
      return 'bg-green-600 text-white';
    case 'chunk':
      return 'bg-purple-600 text-white';
    case 'complete':
      return 'bg-emerald-600 text-white';
    case 'error':
      return 'bg-red-600 text-white';
    case 'end':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

export default function WormArenaConsoleMirror({
  frame,
  boardWidth,
  boardHeight,
  eventLog = [],
  aliveMap,
  currentRound,
  maxRounds,
  scores,
  playerNames,
  isLive = false,
}: WormArenaConsoleMirrorProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [userScrolled, setUserScrolled] = React.useState(false);

  // Render ASCII board from frame data
  const asciiBoard = useMemo(() => {
    if (!frame) return '(waiting for frame data...)';

    // Inject alive map into frame state if provided separately
    const frameState = frame?.frame?.state ?? frame?.state ?? frame;
    if (aliveMap && frameState && !frameState.alive) {
      frameState.alive = aliveMap;
    }

    return renderFrameAsAscii(frame, boardWidth, boardHeight);
  }, [frame, boardWidth, boardHeight, aliveMap]);

  // Build status line (like Python's "Finished round X. Alive: [...], Scores: {...}")
  const statusLine = useMemo(() => {
    const parts: string[] = [];

    if (currentRound !== undefined && currentRound !== null) {
      if (maxRounds !== undefined && maxRounds !== null) {
        parts.push(`Round ${currentRound}/${maxRounds}`);
      } else {
        parts.push(`Round ${currentRound}`);
      }
    }

    if (scores && Object.keys(scores).length > 0) {
      const scoreStr = Object.entries(scores)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, score]) => {
          const name = playerNames?.[id] ?? id;
          // Truncate long model names for display
          const shortName = name.length > 25 ? name.slice(0, 22) + '...' : name;
          return `${shortName}: ${score}`;
        })
        .join(', ');
      parts.push(`Scores: {${scoreStr}}`);
    }

    return parts.length > 0 ? parts.join(' | ') : '';
  }, [currentRound, maxRounds, scores, playerNames]);

  // Auto-scroll to bottom when new events arrive (if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && !userScrolled && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eventLog.length, autoScroll, userScrolled]);

  // Detect user scroll to disable auto-scroll
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (!isAtBottom) {
      setUserScrolled(true);
    } else {
      setUserScrolled(false);
    }
  };

  // Reset user scroll state when auto-scroll is toggled on
  const handleAutoScrollToggle = (checked: boolean) => {
    setAutoScroll(checked);
    if (checked) {
      setUserScrolled(false);
      // Scroll to bottom immediately
      if (logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {/* ASCII Board Panel (left) */}
        <div className="flex-1">
          <Card className="worm-card bg-gray-900 text-green-400 border-gray-700 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-green-300 flex items-center gap-2">
                <span className="font-mono">$</span>
                <span>Python Console</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Status line */}
              {statusLine && (
                <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-xs font-mono text-gray-300">
                  {statusLine}
                </div>
              )}

              {/* ASCII board */}
              <pre className="p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre">
                {asciiBoard}
              </pre>

              {/* Legend */}
              <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs font-mono text-gray-400 flex flex-wrap gap-4">
                <span><code className="text-green-400">.</code> empty</span>
                <span><code className="text-yellow-400">A</code> apple</span>
                <span><code className="text-cyan-400">0</code> snake 0</span>
                <span><code className="text-blue-400">1</code> snake 1</span>
                <span><code className="text-gray-300">T</code> body</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Log Panel (right, live only) */}
        {isLive && (
          <div className="flex-1">
            <Card className="worm-card bg-gray-900 text-gray-200 border-gray-700 h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-bold text-gray-300 flex items-center gap-2 min-w-0">
                    <span className="font-mono">&gt;</span>
                    <span>Events</span>
                    <span className="text-xs font-normal text-gray-500">
                      ({eventLog.length})
                    </span>
                  </CardTitle>

                  {/* Auto-scroll toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      id="auto-scroll"
                      checked={autoScroll}
                      onCheckedChange={handleAutoScrollToggle}
                      className="scale-75"
                    />
                    <Label
                      htmlFor="auto-scroll"
                      className="text-xs text-gray-400 cursor-pointer"
                    >
                      Follow
                    </Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  ref={logContainerRef}
                  onScroll={handleScroll}
                  className="h-96 overflow-y-auto bg-gray-950 font-mono text-xs"
                >
                  {eventLog.length === 0 ? (
                    <div className="p-4 text-gray-500 italic">
                      Waiting...
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {eventLog.map((entry, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 hover:bg-gray-800/50 flex items-start gap-2"
                        >
                          {/* Timestamp */}
                          <span className="text-gray-500 shrink-0 text-[9px]">
                            {formatTime(entry.timestamp)}
                          </span>

                          {/* Event type badge */}
                          <span
                            className={`px-1 py-0 rounded text-[9px] font-semibold uppercase shrink-0 ${getEventTypeClass(entry.type)}`}
                          >
                            {entry.type}
                          </span>

                          {/* Summary */}
                          <span className="text-gray-300 break-all text-[10px]">
                            {entry.summary ?? JSON.stringify(entry.payload)}
                          </span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Help text for replay mode */}
      {!isLive && (
        <div className="text-xs text-gray-500 text-center">
          Console view shows the board exactly as Python's <code className="bg-gray-100 px-1 rounded">GameState.print_board()</code> renders it.
        </div>
      )}
    </div>
  );
}
