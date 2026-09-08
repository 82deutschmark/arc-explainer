/*
Author: Claude Opus 5
Date: 07-September-2026
PURPOSE: Which ARC-AGI-3 tasks are NOT played on a square-4 board, and therefore where the
         play surface offers click-to-move. One list, imported by the player page and by
         scripts/arc3/verify_probe_move.py's copy of it, so the UI and the verification
         harness cannot disagree about which games are covered.

         WHY A LIST AND NOT A SNIFF. "The source mentions ACTION7" is not the same question:
         g019 reads ACTION7 as a direction and ACTION6 as a wait, g033 reads ACTION7 and is
         an ordinary square board, and g043 is triangular while using only ACTION1/3/4/5.
         There is no topology field in the published metadata (mechanics.json carries
         geometry, which is cell size and board extent, not lattice), so a derived gate
         would be wrong in both directions on a set this small. Ten explicit ids, checked by
         reading the neighbour table in each game's source, is the honest version.

         WHAT MAKES A TASK EXOTIC: its neighbours are not the four a d-pad reaches.
           hex, six neighbours on an axial lattice: g013 g017 g019 g020 g046
           triangular, three neighbours whose direction depends on cell parity:
             g009 g015 g022 g027 g043
         A human has no way to learn that ACTION5 means "up and to the right" -- there is no
         key for it and the board does not say. That is the discoverability hole this closes.

         NOT AN ANSWER KEY. This says a board is not square. It does not say what any action
         does; the probe finds that at click time by asking the running game.

SRP/DRY check: Pass -- one constant and two predicates over it. No game logic, no
         rendering, no metadata about how a task is solved.
*/

/** Hex and triangular tasks in the reviewed fifty. Verified against the neighbour table in
 *  each game's source on 07-Sep-2026. Keep in sync with EXOTIC in
 *  scripts/arc3/verify_probe_move.py. */
export const EXOTIC_GAME_IDS: readonly string[] = [
  'g009', 'g013', 'g015', 'g017', 'g019', 'g020', 'g022', 'g027', 'g043', 'g046',
];

/**
 * Exotic tasks where a LEFT click on the board is already a real coordinate action.
 *
 * g013 plants at the hex cell you click, g020 fires the emitter you click, g009 reads
 * data["x"]/data["y"] off ACTION6. Taking the left click for click-to-move on these would
 * delete a working mechanic to fix a discoverability problem, which is a bad trade, so on
 * these three the move gesture is the RIGHT button and left click keeps its meaning.
 *
 * The other seven either ignore ACTION6 entirely or read it as a coordinate-free button
 * (g015 WAIT, g019 WAIT), so a left click there currently spends a step and lands nowhere.
 * Those get click-to-move on the left button, and ACTION6 stays on X and the deck.
 */
export const SPATIAL_CLICK_GAME_IDS: readonly string[] = ['g009', 'g013', 'g020'];

/** The action ids a probe may ever propose. ACTION6 is excluded: it is the coordinate
 *  action and already has its own path through the board click. */
export const PROBE_CANDIDATE_ACTIONS: readonly number[] = [1, 2, 3, 4, 5, 7];

export type ProbeGesture = 'left' | 'right' | null;

/** Which mouse button means "move me there" on this task, or null if the task is an
 *  ordinary square board and nothing changes. */
export function probeGestureFor(gameId: string | undefined | null): ProbeGesture {
  if (!gameId || !EXOTIC_GAME_IDS.includes(gameId)) return null;
  return SPATIAL_CLICK_GAME_IDS.includes(gameId) ? 'right' : 'left';
}
