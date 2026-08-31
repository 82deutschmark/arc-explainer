/**
 * Author: Claude Opus 5
 * Date: 2026-08-29
 * PURPOSE: Anonymous human-play telemetry for ARC-AGI-3 community tasks.
 *
 *          The play page executes the game CLIENT-side in Pyodide, so actions never
 *          reach the server and server-side per-action logging would record almost
 *          nothing. Events are therefore batched here and POSTed to
 *          /api/arc3-play/human-events every 10s and on pagehide.
 *
 *          Records the harness's own action integers (1=Up 2=Down 3=Left 4=Right
 *          5=Action 6=Click 7=Undo) so a human row joins an agent row directly. RESET is
 *          deliberately outside that space: it is not a move, and counting it would make
 *          human and agent action counts incomparable.
 *
 *          isFirstPlay() is read-only at load and burned on the FIRST ACTION, not on
 *          page load: opening a task and closing it must not spend the one blind run
 *          this browser has, and a session written as not-first cannot be reclassified.
 *
 *          Anonymous: a random GUID minted by the game session, coarse desktop/mobile
 *          only, no account, no PII. Never throws into the game loop.
 * SRP/DRY check: Pass - the only client telemetry module; the play page owns no
 *          transport, batching or identity code.
 */

const ENDPOINT = '/api/arc3-play/human-events';
const FLUSH_MS = 10_000;
const MAX_QUEUE = 2000;

const ACTION_INTS: Record<string, number> = {
  ACTION1: 1, ACTION2: 2, ACTION3: 3, ACTION4: 4, ACTION5: 5, ACTION6: 6, ACTION7: 7,
};

interface QueuedEvent {
  seq: number;
  action: string;
  action_int: number | null;
  level: number | null;
  level_actions: number | null;
  state: string | null;
  t_ms: number;
}

function playedKey(gameId: string) { return `arc3_played_${gameId}`; }

/** True when this browser has never played this task. Read only -- see the header. */
export function isFirstPlay(gameId: string): boolean {
  try { return !localStorage.getItem(playedKey(gameId)); } catch { return true; }
}

export function uaFamily(): string {
  try {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  } catch { return 'unknown'; }
}

export function viewport(): string {
  try { return `${window.innerWidth}x${window.innerHeight}`; } catch { return ''; }
}

class Telemetry {
  private sessionGuid: string | null = null;
  private gameId = '';
  private queue: QueuedEvent[] = [];
  private seq = 0;
  private levelActions = 0;
  private lastLevel: number | null = null;
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private markedPlayed = false;
  private isFirst = false;

  /** Begin a run. The GUID is minted here because the browser runs the game -- the
   *  server never sees a Pyodide session. Random, derived from nothing about the user. */
  start(gameId: string): void {
    this.sessionGuid = (() => {
      // Calling it directly rather than testing for it: the lib types declare
      // randomUUID as always present, so a truthiness guard is flagged as dead. It is
      // genuinely absent in insecure contexts and older browsers, where this throws and
      // the catch supplies the fallback.
      try { return crypto.randomUUID(); } catch { /* fall through */ }
      return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    })();
    this.isFirst = isFirstPlay(gameId);
    this.gameId = gameId;
    this.queue = [];
    this.seq = 0;
    this.levelActions = 0;
    this.lastLevel = null;
    this.startedAt = Date.now();
    this.markedPlayed = false;
    if (this.timer === null) {
      this.timer = setInterval(() => this.flush(false), FLUSH_MS);
      try {
        addEventListener('pagehide', () => this.flush(true));
        addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') this.flush(true);
        });
      } catch { /* no-op */ }
    }
  }

  record(action: string, level: number | null, state: string | null): void {
    try {
      if (!this.sessionGuid || this.queue.length >= MAX_QUEUE) return;
      const upper = action.toUpperCase();
      const actionInt = ACTION_INTS[upper] ?? null;

      if (actionInt !== null && !this.markedPlayed) {
        this.markedPlayed = true;
        try { localStorage.setItem(playedKey(this.gameId), '1'); } catch { /* no-op */ }
      }

      // Level boundaries come from the score advancing, which is how the engine reports
      // a level clear. Per-level action counts are what "actions to solve" is made of.
      if (level !== this.lastLevel) { this.levelActions = 0; this.lastLevel = level; }
      if (actionInt !== null) this.levelActions += 1;

      this.queue.push({
        seq: this.seq++,
        action: upper,
        action_int: actionInt,
        level,
        level_actions: actionInt !== null ? this.levelActions : null,
        state,
        t_ms: Date.now() - this.startedAt,
      });
    } catch { /* telemetry must never break the game */ }
  }

  flush(useBeacon: boolean): void {
    try {
      if (!this.sessionGuid || this.queue.length === 0) return;
      const batch = this.queue;
      this.queue = [];
      const body = JSON.stringify({
        sessionGuid: this.sessionGuid,
        gameId: this.gameId,
        isFirstSession: this.isFirst,
        uaFamily: uaFamily(),
        viewport: viewport(),
        events: batch,
      });
      if (useBeacon && navigator.sendBeacon
          && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) {
        return;
      }
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* fire and forget */ });
    } catch { /* no-op */ }
  }
}

export const humanPlay = new Telemetry();
