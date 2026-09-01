/*
Author: Claude Opus 5
Date: 2026-08-31 (revised 2026-09-01: second batch, generation as a field, and the
      illegible verdict)
PURPOSE: The review ordering for the 621 probed tasks — which are worth a human's
         time, which are duplicates of another, and which fall over to random input.
         571 are the qNNN-v1 generated set; 50 are the hand-authored set the arena
         catalog publishes, added 01-Sep and keyed by their PUBLISHED ids (see IDS below).

         ORDER IS BY RECENCY, NEWEST FIRST (01-Sep). This site is the slop filter for our
         own generator, not a shop window. The official 25, the 252 community tasks and
         the in-house set are known good and need nobody's opinion; what needs a human is
         the batch we generated last, because it is the work we have the least evidence
         about. Quality gates entry to the queue rather than position within it — see
         QUEUE below.

         WHY THIS EXISTS. The play page's "Next task" walked the raw 877-entry catalog in
         hash order. Reviewing that way serves duplicates and pushovers at random, which
         is why going through the set by hand felt like work with no yield: 99.5% of the
         generated tasks load, have levels and respond to input, so the only questions a
         person can settle by eye are already answered before they open one.

         The two defects that DO matter are invisible one task at a time. 66 tasks are
         structural near-copies of another (clusters land on consecutive ids — q239-245,
         q425-431, q488-494 — the generator emitted batches of variations on a template),
         and 191 across both batches surrender a level to random button-mashing (177 of
         the generated set, 14 of the 50 hand-authored). Neither is visible
         without comparing tasks against each other, or playing badly on purpose many
         times. Both were measured by executing every task against the engine; the
         verdicts are baked here rather than recomputed, because the measurement needs
         Python, the engine and ~20 minutes.

         DROPPED TASKS ARE STILL SERVED, carrying their reason. A cull you cannot audit
         from the UI is a cull nobody can overrule, and "duplicate of q239-v1" is exactly
         what a reviewer needs in order to disagree.

         THE THIRD DEFECT, added 01-Sep: 41 of these tasks cannot be won by anybody.
         ACTION6 is a commit button that compares the player's entire action history
         against a hidden literal plan baked into the level table and never drawn on
         screen; any mismatch calls lose(), and that is the only way to die. One blind
         guess at an invisible seven-symbol sequence, no feedback either way. 23 were in
         this queue, three of them in the first fifty tasks a reviewer meets.

         THE PROBE COULD NOT HAVE CAUGHT THEM. It culls what random play can BEAT, and
         these cannot be beaten, so they look like legitimately hard games on every
         metric it records -- and better than most: a commit-or-die game with five safe
         explorable actions produces plenty of distinct frames and reacts to every input.
         The flagged tasks sit ABOVE the median queued task on `frames` and `responsive`,
         which is what `rank` sorts on. q246-v1 carried rank 1. Random play is a lower
         bound on difficulty; this needed an upper bound, and it is a static one:
         scripts/arc3/legibility_gate.py, applied by scripts/arc3/apply_legibility_gate.py.
         See docs/2026-09-01-arc3-junk-game-audit.md.

         IDS. A row's `gameId` is used directly as a catalog id, so it must be the
         PUBLISHED id, not the id the task was authored under. The arena rows are therefore
         `t<8 hex>`.

         That id used to be derived at request time by `opaque('t', 'arena', manifestId)`
         in Arc3MirrorCatalog. It is not any more: since 01-Sep-2026 the 50 tasks live in
         this repository at server/data/arc3-games/<gameId>.py and the id is FROZEN INTO
         THE FILENAME, so nothing renames anything at serve time and looking for the
         rename in the catalog service will find nothing. The derivation
         (`"t" + sha256("arena:" + <authored id>)[:8]`) now lives in exactly one place,
         scripts/arc3/import_authored_games.py, and every one of the 50 rows below is
         addressed by its output. Change the prefix, the `arena` key or the hash there and
         these rows type-check, sort, and address nothing.

         Regenerate with probe_one.py / funnel.py in the authoring repo after a new batch
         lands, and its build_triage_entries.py for the arena rows, keyed by the ids in
         server/data/arc3-games/manifest.json; this file is data, not logic. Then run
         scripts/arc3/apply_legibility_gate.py --write over the result: the legibility
         verdict is derived from each task's source and has to be re-derived whenever the
         rows are, or a new batch enters the queue ungated.
SRP/DRY check: Pass — owns the ordering only. Catalog fetching stays in
         Arc3MirrorCatalog, which this never calls: triage is about the generated set and
         must not fail if the upstream mirror is down.
*/

import triage from './arc3Triage.json';

export type TriageStatus = 'queued' | 'duplicate' | 'weak' | 'illegible';

/**
 * Why a task was ruled unplayable, carried on the row so the cull is auditable.
 *
 * `previousStatus` is what the row held before the gate ran, and it is what a re-run
 * restores if the gate stops flagging the task -- so this verdict is reversible rather
 * than a one-way edit to measured data. A task that was already `weak` or `duplicate`
 * keeps that status and still carries this: it was already out of the queue, and
 * overwriting a measurement to gain nothing would lose the clustering's own record.
 * Which is why the totals still sum to `probed`.
 */
export interface Illegibility {
  /** Which combination fired, in words. */
  signal: string;
  /** The offending comparison, quoted from the task's own source. */
  comparison: string;
  /** The terms in it that no render method reads. */
  hiddenTerms: string[];
  /** What made the comparison a hidden ANSWER rather than an unrendered intermediate. */
  why: string[];
  previousStatus: TriageStatus;
}

export interface TriageEntry {
  gameId: string;
  status: TriageStatus;
  /**
   * Set when status is 'duplicate': the task this one is a near-copy of.
   *
   * Null means one of two different things, which is why `generations` records the method
   * per batch: for the qNNN set it means clustering ran and found no near-copy, and for
   * the arena set it means clustering was never run against it at all.
   */
  duplicateOf: string | null;
  /** Set when the legibility gate fired, whatever the status. See Illegibility. */
  illegibility?: Illegibility;
  /**
   * Which batch this task came from. Higher is newer; the queue sorts on it descending.
   *
   * Stored rather than parsed out of `gameId`, which is what it used to be. That worked
   * only while every id was `qNNN-vN`, and broke silently the moment a second source
   * arrived: an id that did not match sorted to -1, so an entire batch landed behind
   * every existing row and `next()` never reached it. An ordering key that a new id shape
   * can quietly opt out of is not an ordering key.
   */
  generation: number;
  /**
   * How built out a task is: position when its own batch's queued rows are sorted by
   * `frames` descending, then `responsive`. Numbered WITHIN a generation, so `rank: 1`
   * appears once per batch — it only ever breaks ties between rows of equal generation.
   */
  rank?: number;
  levels: number | null;
  frames: number;
  responsive: number;
  deaths: number;
  randomWin: boolean;
  randomClearedLevel: number;
}

/** What was measured for one batch, and what was not. */
export interface TriageGeneration {
  /** The `generation` values this covers, for display: '1000' or '1-800'. */
  generationRange: string;
  count: number;
  /** Names the batch, never a mechanic — this is served to the play surface. */
  label: string;
  method: string;
}

interface TriageFile {
  generatedFrom: string;
  duplicateThreshold: number;
  /** Per-batch provenance. Exists because the two batches were NOT measured the same way
   *  and a single `generatedFrom` string made the weaker measurement look like the
   *  stronger one. */
  generations: TriageGeneration[];
  totals: { probed: number; queued: number; duplicate: number; weak: number; illegible: number };
  games: TriageEntry[];
}

const DATA = triage as unknown as TriageFile;
const BY_ID = new Map<string, TriageEntry>(DATA.games.map((g) => [g.gameId, g]));

/**
 * The review queue: newest batch first, `rank` breaking ties inside a batch.
 *
 * WHY NEWEST AND NOT BEST. `rank` orders tasks by how built out they are, and ordering the
 * review by it was wrong: this site is a filter for slop, not a showcase. The tasks that
 * need a human are the ones we have the least evidence about, and that is the batch
 * generated most recently -- an older task has already been seen. Quality still gates
 * ENTRY to the queue (duplicates and the random-mashable never reach it), so a reviewer
 * meets recent work without meeting known junk. As of 01-Sep that gate includes the
 * legibility verdict: `illegible` is not `queued`, so the 23 unwinnable tasks leave the
 * queue by the same mechanism duplicates and pushovers do, and stay addressable and
 * explicable through all().
 *
 * A CAVEAT ON `rank`, worth knowing before anyone leans on it: it sorts by `frames` then
 * `responsive`, and the illegible class scores well on both -- it was rank 1 in its batch.
 * Ordering by rank alone would promote exactly the tasks that most need excluding. It
 * only breaks ties within a generation here, so this is a warning rather than a bug.
 *
 * WHY `generation` IS A FIELD. It was `/^q(\d+)-/` over the id, which is the only recency
 * signal the manifest carries -- no timestamp exists, and the duplicate clusters landing on
 * consecutive ids (q239-245, q425-431) is what shows the numbering follows the batches.
 * Parsing it was fine while every id was `qNNN-vN` and wrong the moment a second source
 * arrived: the arena set publishes under renamed `t<hex>` ids, which do not match, so they
 * scored -1 and sorted behind all 571 -- present in the file, in the totals, and
 * unreachable from `next()`. Reading a batch number out of an id shape is a coupling that
 * fails quietly, so the number is written down instead.
 *
 * The arena batch is 1000, above the highest generated id (800) because it is the newest
 * work and the least evidenced. The gap is deliberate: at 801 it would tie with the
 * generator's next batch and interleave two sets that were measured differently.
 */
const QUEUE: TriageEntry[] = DATA.games
  .filter((g) => g.status === 'queued')
  .sort((a, b) =>
    b.generation - a.generation
    || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));

export const Arc3Triage = {
  totals: () => DATA.totals,
  method: () => DATA.generatedFrom,

  /** How each batch was measured — and, for the arena batch, what was not measured. */
  generations: (): TriageGeneration[] => DATA.generations,

  /** The review queue: newest batch first, culled tasks never in it. */
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
