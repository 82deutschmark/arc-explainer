/*
Author: Claude Opus 5
Date: 2026-09-04
PURPOSE: Which games a human has validated, and on which build -- the selection signal the
         training side has never had. Human play is the only place a human baseline exists;
         until now it stopped at a database nobody read, so the agent trained on whatever
         games happened to be in a run rather than on games somebody confirmed were fair.

         ADVISORY, NOT A GATE, AND DELIBERATELY SO. It emits every candidate with the
         numbers behind it and the reasons it did or did not clear, and the caller decides.
         The sample this runs on is one or two testers over a few evenings; a hard filter on
         that would exclude the entire set and look authoritative doing it. Turning it into
         a gate is a change to the CONSUMER, not to this file.

         BUILD-AWARE IS THE WHOLE POINT. A game keeps its id when its content changes, so a
         verdict is only about the build that was played. A verdict on a superseded build is
         reported as `stale`, never as absent -- knowing a game was liked before its last
         rebuild is useful, and silently dropping it would look like nobody ever played it.
SRP/DRY check: Pass -- the promotion rule and nothing else. Verdict SQL stays in
         Arc3FeedbackRepository (getVerdictsByBuild); the current build comes from
         Arc3MirrorCatalog, the existing owner of what is served. The HTTP layer is
         routes/arc3HumanPlay.ts and holds no policy.
*/

import { Arc3FeedbackRepository, type VerdictBuildRow } from '../../repositories/Arc3FeedbackRepository.js';
import { Arc3MirrorCatalog } from './Arc3MirrorCatalog';
import { logger } from '../../utils/logger';

/**
 * The cut. Every clause is here so that changing the rule is a diff, not an argument.
 *
 * - `onCurrentBuild`  a verdict on a superseded build says nothing about what a trainer
 *                     would play now. This is the clause the version stamp exists for.
 * - `minReachedLevel` somebody got past the tutorial. A game nobody has ever cleared a
 *                     level of is not established as solvable, and unsolvable games teach
 *                     the model nothing -- the SFT filter keeps only solved levels, so
 *                     they contribute no data at any difficulty.
 * - `maxFeltBroken` /
 *   `maxFeltImpossible`  one person calling it broken is enough to hold it back while the
 *                     sample is this small. Cheap to revisit, expensive to train on.
 *
 * Not included on purpose: `enjoyed_it`. Enjoyment is the signal for what to BUILD MORE OF,
 * not for what is safe to train on, and a dull-but-fair game is perfectly good training data.
 */
export const PROMOTION_RULE = {
  onCurrentBuild: true,
  minReachedLevel: 1,
  maxFeltBroken: 0,
  maxFeltImpossible: 0,
} as const;

export interface PromotionCandidate extends VerdictBuildRow {
  /** The build this game serves right now. Null if the game is no longer in the catalog. */
  currentVersion: string | null;
  /** Whether these verdicts describe what a player would be served today. */
  isCurrentBuild: boolean;
  promoted: boolean;
  /** Why it did not clear. Empty when it did. Plain enough to paste into a message. */
  reasons: string[];
}

/** Reasons are phrased as the fact, not the fix: this file does not know what to do about
 *  a game, only what the play data says about it. */
function evaluate(row: VerdictBuildRow, currentVersion: string | null): PromotionCandidate {
  const isCurrentBuild = row.sourceVersion !== null && row.sourceVersion === currentVersion;
  const reasons: string[] = [];

  if (row.sourceVersion === null) {
    reasons.push('verdict predates the build stamp, so which version it describes is unknown');
  } else if (currentVersion === null) {
    reasons.push('game is no longer in the catalog');
  } else if (!isCurrentBuild) {
    reasons.push(`verdict is on build ${row.sourceVersion}, which has been replaced by ${currentVersion}`);
  }

  if (row.maxReachedLevel < PROMOTION_RULE.minReachedLevel) {
    reasons.push('no player has cleared a level');
  }
  if (row.feltBroken > PROMOTION_RULE.maxFeltBroken) {
    reasons.push(`${row.feltBroken} player(s) called it broken`);
  }
  if (row.feltImpossible > PROMOTION_RULE.maxFeltImpossible) {
    reasons.push(`${row.feltImpossible} player(s) called it impossible`);
  }

  return { ...row, currentVersion, isCurrentBuild, promoted: reasons.length === 0, reasons };
}

export class Arc3Promotion {
  /**
   * Every game with a verdict, ranked, with the promotion decision and its reasons.
   *
   * Ranking is by how far a human actually got, then by how much evidence there is. NOT by
   * enjoyment: the list answers "what is safe to train on", and sorting it by what was fun
   * would quietly turn it into a different question.
   */
  static async list(gameId?: string): Promise<{
    rule: typeof PROMOTION_RULE;
    generatedAt: string;
    promoted: string[];
    candidates: PromotionCandidate[];
  }> {
    const rows = await Arc3FeedbackRepository.getVerdictsByBuild(gameId);

    // Resolved only for games that actually have verdicts. Local sources are read from
    // disk on every call, so asking about all 900+ catalog entries would be real I/O for
    // rows we are not going to emit.
    const currentVersions = new Map<string, string | null>();
    for (const id of new Set(rows.map((r) => r.gameId))) {
      try {
        const source = await Arc3MirrorCatalog.getSource(id);
        currentVersions.set(id, source?.sourceVersion ?? null);
      } catch (error) {
        // A game we cannot read is reported as uncatalogued rather than failing the whole
        // list: one unreadable game must not hide every other game's verdicts.
        logger.warn(`arc3 promotion: could not resolve current build for ${id} - ${error instanceof Error ? error.message : String(error)}`);
        currentVersions.set(id, null);
      }
    }

    const candidates = rows
      .map((r) => evaluate(r, currentVersions.get(r.gameId) ?? null))
      .sort((a, b) =>
        Number(b.promoted) - Number(a.promoted)
        || b.maxReachedLevel - a.maxReachedLevel
        || b.responses - a.responses
        || a.gameId.localeCompare(b.gameId));

    return {
      rule: PROMOTION_RULE,
      generatedAt: new Date().toISOString(),
      promoted: candidates.filter((c) => c.promoted).map((c) => c.gameId),
      candidates,
    };
  }
}
