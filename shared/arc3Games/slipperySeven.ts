/*
 * Author: Claude Opus 5
 * Date: 2026-09-19
 * PURPOSE: The "Slippery Seven" -- the seven official ARC-AGI-3 games our own agents have the
 *          most trouble with. Source of truth is the arc-3 repo write-up
 *          docs/trace-findings/2026-09-17-the-slippery-seven.md: these seven scored 0.00 in all
 *          four passes of the Qwen3.8-27B mass-data run of 2026-09-16 (28 attempts, zero levels).
 *          Each entry carries which of the doc's three groups the game falls in, so the badge
 *          tooltip can say why it is on the list. Read by the games index tiles and the game page
 *          header (client/src/components/arc3/SlipperySevenBadge.tsx).
 *          NOT the 2026-09-12 Flash-Next "bottom seven" (only sk48, g50t, tn36 overlap) and not
 *          the aiDifficulty field, which comes from a different data snapshot.
 * SRP/DRY check: Pass -- one list, one place; no existing field in shared/arc3Games covered it.
 */

export interface SlipperySevenEntry {
  gameId: string;
  /** One line: why this game is on the list, from the write-up's three-way split. */
  reason: string;
}

const HARD_FOR_EVERY_MODEL = 'Hard for every model we have tried -- and Boss has not won it yet either.';
const HARD_FOR_BOTH = 'Hard for both models; the 27B does even worse on it.';
const TWENTY_SEVEN_B_ONLY = 'Only the 27B fails it -- Flash-Next clears levels on it regularly.';

export const SLIPPERY_SEVEN: readonly SlipperySevenEntry[] = [
  { gameId: 'dc22', reason: TWENTY_SEVEN_B_ONLY },
  { gameId: 'g50t', reason: HARD_FOR_BOTH },
  { gameId: 'm0r0', reason: TWENTY_SEVEN_B_ONLY },
  { gameId: 'sc25', reason: TWENTY_SEVEN_B_ONLY },
  { gameId: 'sk48', reason: HARD_FOR_EVERY_MODEL },
  { gameId: 'tn36', reason: TWENTY_SEVEN_B_ONLY },
  { gameId: 'tr87', reason: TWENTY_SEVEN_B_ONLY },
];

export const SLIPPERY_SEVEN_SUMMARY =
  'One of the Slippery Seven: the seven games that scored zero in all four passes of our ' +
  'Qwen 27B run on 16 Sept 2026.';

export function getSlipperySevenEntry(gameId: string): SlipperySevenEntry | undefined {
  return SLIPPERY_SEVEN.find((entry) => entry.gameId === gameId);
}
