/**
 * Author: Claude Opus 5
 * Date: 2026-09-01
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
 *          IDLE MARKERS. Inter-move think time is t_ms deltas, but a long gap is
 *          ambiguous: 40 seconds is either someone reasoning hard or someone who left the
 *          room, and treating the second as the first poisons exactly the deep-thinking
 *          signal the timing is collected for. BLUR and FOCUS are emitted from the
 *          browser's own visibility events to bracket the away time. They follow the
 *          RESET precedent and sit OUTSIDE the harness action space, so no marker can
 *          ever be counted as a move. They say attention left and came back; nothing
 *          about where it went, which is not observable here and is not wanted.
 *
 *          ACTION6 is a click and carries an (x, y). Coordinates ride along on the event
 *          when the caller supplies them -- the only spatial signal the action space has.
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

/** Mirrors ACTION_INTS in server/repositories/HumanPlayRepository.ts, which this cannot
 *  import. Anything absent from this map records with a null action_int and is excluded
 *  from every move count, server-side and client-side. */
const ACTION_INTS: Record<string, number> = {
  ACTION1: 1, ACTION2: 2, ACTION3: 3, ACTION4: 4, ACTION5: 5, ACTION6: 6, ACTION7: 7,
};

/** Attention left the page / came back. Outside ACTION_INTS on purpose -- see the header. */
const BLUR = 'BLUR';
const FOCUS = 'FOCUS';

interface QueuedEvent {
  seq: number;
  action: string;
  action_int: number | null;
  level: number | null;
  /** The engine's score. Distinct from level -- see record(). */
  score: number | null;
  level_actions: number | null;
  state: string | null;
  t_ms: number;
  /** Click target, ACTION6 only. */
  x: number | null;
  y: number | null;
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
  /** Whether the page currently has the player's attention. Seeded true by start(). */
  private attentionPresent = true;
  /** Identity of the game build being played, from the source response. Null until the
   *  source lands: start() runs when the run begins, which is before the fetch resolves. */
  private sourceVersion: string | null = null;

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
    this.attentionPresent = true;
    this.sourceVersion = null;
    if (this.timer === null) {
      this.timer = setInterval(() => this.flush(false), FLUSH_MS);
      try {
        addEventListener('pagehide', () => this.flush(true));
        // visibilitychange covers tab switches and phone lock; blur/focus additionally
        // cover a window that stays visible but loses focus, which is the common desktop
        // case of turning to something else. Both feed one deduped marker.
        addEventListener('visibilitychange', () => {
          const hidden = document.visibilityState === 'hidden';
          this.markAttention(!hidden);
          // The marker has to be on the wire before the tab is frozen or discarded.
          if (hidden) this.flush(true);
        });
        addEventListener('blur', () => this.markAttention(false));
        addEventListener('focus', () => this.markAttention(true));
      } catch { /* no-op */ }
    }
  }

  /** The current run's anonymous id, so feedback can be joined to the keystroke stream
   *  it belongs to. Null before start() — feedback without a run is not collected. */
  currentSessionGuid(): string | null {
    return this.sessionGuid;
  }

  /**
   * One event.
   *
   * `level` and `score` are SEPARATE and must be passed separately. The caller used to
   * pass the score into the level slot, so both columns held the score and the level the
   * player had actually reached was never recorded at all. Pass null for level when the
   * engine does not report one -- do NOT fall back to the score, which recreates the bug.
   *
   * `coords` is the ACTION6 click target and is null on every other action.
   */
  record(
    action: string,
    level: number | null,
    state: string | null,
    score: number | null = null,
    coords?: { x: number; y: number } | null,
  ): void {
    try {
      if (!this.sessionGuid || this.queue.length >= MAX_QUEUE) return;
      const upper = action.toUpperCase();
      const actionInt = ACTION_INTS[upper] ?? null;

      if (actionInt !== null && !this.markedPlayed) {
        this.markedPlayed = true;
        try { localStorage.setItem(playedKey(this.gameId), '1'); } catch { /* no-op */ }
      }

      // Per-level action counts are what "actions to solve" is made of, so the counter
      // resets when the level does.
      if (level !== this.lastLevel) { this.levelActions = 0; this.lastLevel = level; }
      if (actionInt !== null) this.levelActions += 1;

      this.queue.push({
        seq: this.seq++,
        action: upper,
        action_int: actionInt,
        level,
        score,
        level_actions: actionInt !== null ? this.levelActions : null,
        state,
        t_ms: Date.now() - this.startedAt,
        x: coords ? Math.trunc(coords.x) : null,
        y: coords ? Math.trunc(coords.y) : null,
      });
    } catch { /* telemetry must never break the game */ }
  }

  /**
   * Bracket an away-from-keyboard gap.
   *
   * Recorded through record() so a marker is an ordinary row on the same stream with the
   * same t_ms clock -- which is the whole point, since the gap being disambiguated is a
   * t_ms delta. BLUR/FOCUS are outside ACTION_INTS, so they carry a null action_int and
   * no move count on either side of the wire can see them.
   *
   * Repeats are suppressed: browsers fire blur and visibilitychange together on a tab
   * switch, and two BLURs in a row would read as a gap that never happened.
   */
  private markAttention(present: boolean): void {
    if (!this.sessionGuid || this.attentionPresent === present) return;
    this.attentionPresent = present;
    this.record(present ? FOCUS : BLUR, this.lastLevel, null);
  }

  /** Record which build of the game was loaded. Called by the play page once the source
   *  response lands, because that response is the only place the version exists. */
  setSourceVersion(version: string | null): void {
    this.sourceVersion = version && /^[0-9a-f]{6,64}$/.test(version) ? version : null;
  }

  /** The build the current run is playing, for the feedback form to snapshot onto its
   *  row the same way it snapshots the level and outcome. */
  currentSourceVersion(): string | null {
    return this.sourceVersion;
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
        sourceVersion: this.sourceVersion,
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
