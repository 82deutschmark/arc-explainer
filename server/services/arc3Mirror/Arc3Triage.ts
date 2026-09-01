/*
Author: Claude Opus 5
Date: 2026-08-31
PURPOSE: The review ordering for the 571 generated tasks — which are worth a human's
         time, which are duplicates of another, and which fall over to random input.

         WHY THIS EXISTS. The play page's "Next task" walked the raw 877-entry catalog in
         hash order. Reviewing that way serves duplicates and pushovers at random, which
         is why going through the set by hand felt like work with no yield: 99.5% of the
         generated tasks load, have levels and respond to input, so the only questions a
         person can settle by eye are already answered before they open one.

         The two defects that DO matter are invisible one task at a time. 66 tasks are
         structural near-copies of another (clusters land on consecutive ids — q239-245,
         q425-431, q488-494 — the generator emitted batches of variations on a template),
         and 177 more surrender a level to random button-mashing. Neither is visible
         without comparing tasks against each other, or playing badly on purpose many
         times. Both were measured by executing every task against the engine; the
         verdicts are baked here rather than recomputed, because the measurement needs
         Python, the engine and ~20 minutes.

         DROPPED TASKS ARE STILL SERVED, carrying their reason. A cull you cannot audit
         from the UI is a cull nobody can overrule, and "duplicate of q239-v1" is exactly
         what a reviewer needs in order to disagree.

         Regenerate with arc3games/{probe_one,funnel}.py in the autoresearch-arena repo
         after a new batch lands; this file is data, not logic.
SRP/DRY check: Pass — owns the ordering only. Catalog fetching stays in
         Arc3MirrorCatalog, which this never calls: triage is about the generated set and
         must not fail if the upstream mirror is down.
*/

import triage from './arc3Triage.json';

export type TriageStatus = 'queued' | 'duplicate' | 'weak';

export interface TriageEntry {
  gameId: string;
  status: TriageStatus;
  /** Set when status is 'duplicate': the task this one is a near-copy of. */
  duplicateOf: string | null;
  rank?: number;
  levels: number | null;
  frames: number;
  responsive: number;
  deaths: number;
  randomWin: boolean;
  randomClearedLevel: number;
}

interface TriageFile {
  generatedFrom: string;
  duplicateThreshold: number;
  totals: { probed: number; queued: number; duplicate: number; weak: number };
  games: TriageEntry[];
}

const DATA = triage as unknown as TriageFile;
const BY_ID = new Map<string, TriageEntry>(DATA.games.map((g) => [g.gameId, g]));

/** Ranked, best first. Only tasks that survived both filters. */
const QUEUE: TriageEntry[] = DATA.games
  .filter((g) => g.status === 'queued')
  .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));

export const Arc3Triage = {
  totals: () => DATA.totals,
  method: () => DATA.generatedFrom,

  /** The review queue, best first. */
  queue: (): TriageEntry[] => QUEUE,

  /** Every verdict, including culled tasks, so the UI can explain a drop. */
  all: (): TriageEntry[] => DATA.games,

  get: (gameId: string): TriageEntry | undefined => BY_ID.get(gameId),

  /**
   * The next task to review after `afterGameId`, skipping anything in `played`.
   *
   * Position is taken from the queue rather than from the played set, so finishing a
   * task moves you forward one place instead of jumping to wherever the first unplayed
   * gap happens to be. Wraps once, then gives up rather than looping forever.
   */
  next: (afterGameId: string | null, played: Set<string> = new Set()): TriageEntry | null => {
    if (QUEUE.length === 0) return null;
    const at = afterGameId ? QUEUE.findIndex((g) => g.gameId === afterGameId) : -1;
    for (let i = 1; i <= QUEUE.length; i++) {
      const cand = QUEUE[(at + i + QUEUE.length) % QUEUE.length];
      if (cand.gameId !== afterGameId && !played.has(cand.gameId)) return cand;
    }
    // Everything queued has been played: fall back to the next one along regardless.
    return at >= 0 ? QUEUE[(at + 1) % QUEUE.length] : QUEUE[0];
  },
};
