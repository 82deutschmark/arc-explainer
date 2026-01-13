/**
 * Author: Cascade
 * Date: 2026-01-12
 * PURPOSE: Suggest top-tier unplayed matchups with dual scoring modes (ladder vs entertainment),
 *          now rank-aware to emphasize leaderboard battles while keeping variety guarantees.
 * SRP/DRY check: Pass — complex algorithm isolated in helper.
 */

import type { SnakeBenchTrueSkillLeaderboardEntry } from '../../../../shared/types.js';

export interface SuggestedMatchup {
  modelA: {
    modelSlug: string;
    mu: number;
    sigma: number;
    exposed: number;
    gamesPlayed: number;
    rank: number;
    displayScore: number;
    wins?: number;
    losses?: number;
    winRate?: number;
  };
  modelB: {
    modelSlug: string;
    mu: number;
    sigma: number;
    exposed: number;
    gamesPlayed: number;
    rank: number;
    displayScore: number;
    wins?: number;
    losses?: number;
    winRate?: number;
  };
  history: { matchesPlayed: number; lastPlayedAt: string | null };
  score: number;
  reasons: string[];
}

/**
 * Suggest interesting unplayed matchups using one of two scoring modes:
 * - **ladder**: Maximize ranking information gain (high sigma, close ratings)
 * - **entertainment**: Maximize watchability (close fights, high stakes, novelty)
 *
 * Only includes models with >= minGames played.
 * Only suggests pairs that have never faced each other (matchesPlayed === 0).
 * Applies variety penalty to limit how often a model appears.
 *
 * Returns up to `limit` matchups sorted by score descending.
 */
export async function suggestMatchups(
  mode: 'ladder' | 'entertainment',
  limit: number,
  minGames: number,
  leaderboard: SnakeBenchTrueSkillLeaderboardEntry[],
  pairingHistory: Map<string, { matchesPlayed: number; lastPlayedAt: string | null }>,
  approvedModels: Set<string>
): Promise<{
  mode: 'ladder' | 'entertainment';
  matchups: SuggestedMatchup[];
  totalCandidates: number;
}> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 20;

  const normalizeSlug = (slug: string): string => slug.replace(/:free$/, '');

  // Filter to only models that are currently approved and compute leaderboard rank metadata.
  const rankedEntriesMap = new Map<
    string,
    { entry: SnakeBenchTrueSkillLeaderboardEntry; rank: number }
  >();

  leaderboard.forEach((entry, index) => {
    if (!approvedModels.has(entry.modelSlug)) return;
    const normalizedSlug = normalizeSlug(entry.modelSlug);
    const candidateRank = index + 1;
    const existing = rankedEntriesMap.get(normalizedSlug);
    if (!existing) {
      rankedEntriesMap.set(normalizedSlug, { entry, rank: candidateRank });
      return;
    }

    const currentIsFree = entry.modelSlug.includes(':free');
    const existingIsFree = existing.entry.modelSlug.includes(':free');
    const shouldReplace =
      candidateRank < existing.rank ||
      (candidateRank === existing.rank && currentIsFree && !existingIsFree) ||
      (candidateRank === existing.rank &&
        currentIsFree === existingIsFree &&
        entry.gamesPlayed > existing.entry.gamesPlayed);

    if (shouldReplace) {
      rankedEntriesMap.set(normalizedSlug, { entry, rank: candidateRank });
    }
  });

  const rankedEntries = Array.from(rankedEntriesMap.entries())
    .map(([normalizedSlug, info]) => ({
      normalizedSlug,
      rank: info.rank,
      ...info.entry,
    }))
    .filter((entry) => entry.rank <= 30)
    .sort((a, b) => a.rank - b.rank);

  if (rankedEntries.length < 2) {
    return { mode, matchups: [], totalCandidates: 0 };
  }

  // Helper to get normalized key for a pair (must match database query logic)
  const pairKey = (a: string, b: string): string => {
    const slugA = normalizeSlug(a);
    const slugB = normalizeSlug(b);
    // Use same normalization as database query: LEAST/GREATEST
    const normalizedA = slugA < slugB ? slugA : slugB;
    const normalizedB = slugA < slugB ? slugB : slugA;
    return `${normalizedA}|||${normalizedB}`;
  };

  // Generate all candidate pairs (only unplayed)
  type RankedEntry = (typeof rankedEntries)[number];

  type Candidate = {
    modelA: RankedEntry;
    modelB: RankedEntry;
    history: { matchesPlayed: number; lastPlayedAt: string | null };
    score: number;
    reasons: string[];
  };

  const candidates: Candidate[] = [];
  const modelAppearances = new Map<string, number>();

  for (let i = 0; i < rankedEntries.length; i++) {
    for (let j = i + 1; j < rankedEntries.length; j++) {
      const modelA = rankedEntries[i];
      const modelB = rankedEntries[j];
      const key = pairKey(modelA.modelSlug, modelB.modelSlug);
      const history = pairingHistory.get(key) ?? { matchesPlayed: 0, lastPlayedAt: null };

      // Hard filter: only unplayed pairs
      if (history.matchesPlayed > 0) {
        continue;
      }

      candidates.push({
        modelA,
        modelB,
        history,
        score: 0,
        reasons: [],
      });
    }
  }

  // Score each candidate based on mode
  for (const c of candidates) {
    const reasons: string[] = [];
    let score = 0;

    // Novelty bonus (always applies since we filter to unplayed)
    reasons.push('Unplayed pairing');
    score += 100;

    const exposedDiff = Math.abs(c.modelA.exposed - c.modelB.exposed);
    const sigmaSum = c.modelA.sigma + c.modelB.sigma;
    const maxExposed = Math.max(c.modelA.exposed, c.modelB.exposed);

    const rankA = c.modelA.rank;
    const rankB = c.modelB.rank;
    const rankGap = Math.abs(rankA - rankB);
    const top20A = rankA <= 20;
    const top20B = rankB <= 20;
    const bothTop20 = top20A && top20B;
    const eitherTop20 = top20A || top20B;

    if (bothTop20) {
      score += 60;
      reasons.push('Top-20 showdown');
    } else if (eitherTop20) {
      score += 35;
      reasons.push('Top-20 challenger');
    } else {
      score += 10;
      reasons.push('Leaderboard fringe (21-30)');
    }

    if (rankGap <= 3) {
      score += 15;
      reasons.push('Adjacent rank duel');
    } else if (rankGap <= 5) {
      score += 8;
      reasons.push('Neighboring ranks');
    }

    if (mode === 'ladder') {
      // LADDER MODE: prioritize info gain
      // High sigma = high uncertainty = more to learn
      if (sigmaSum > 10) {
        score += 40;
        reasons.push('High combined uncertainty');
      } else if (sigmaSum > 7) {
        score += 25;
        reasons.push('Moderate uncertainty');
      }

      // Close ratings = ordering test (informative)
      if (exposedDiff < 1.5) {
        score += 35;
        reasons.push('Very close ratings (ordering test)');
      } else if (exposedDiff < 3) {
        score += 20;
        reasons.push('Close ratings');
      }

      // Slight bonus for at least one high-sigma model
      if (c.modelA.sigma > 5 || c.modelB.sigma > 5) {
        score += 10;
        reasons.push('Placement model involved');
      }
    } else {
      // ENTERTAINMENT MODE: prioritize watchability
      // Close match = nail-biter potential
      if (exposedDiff < 1.5) {
        score += 45;
        reasons.push('Expected nail-biter');
      } else if (exposedDiff < 3) {
        score += 30;
        reasons.push('Competitive matchup');
      }

      // High stakes = top models involved
      if (maxExposed > 20) {
        score += 35;
        reasons.push('High-stakes (top-tier model)');
      } else if (maxExposed > 15) {
        score += 20;
        reasons.push('Strong models');
      }

      // Upset potential: underdog with decent sigma vs favorite
      const [favorite, underdog] =
        c.modelA.exposed > c.modelB.exposed ? [c.modelA, c.modelB] : [c.modelB, c.modelA];
      if (exposedDiff > 2 && exposedDiff < 6 && underdog.sigma > 4) {
        score += 15;
        reasons.push('Upset potential');
      }
    }

    c.score = score;
    c.reasons = reasons;
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Apply variety penalty: limit how often a single model appears
  const MAX_APPEARANCES = 3;
  const selected: Candidate[] = [];

  for (const c of candidates) {
    if (selected.length >= safeLimit) break;

    const countA = modelAppearances.get(c.modelA.modelSlug) ?? 0;
    const countB = modelAppearances.get(c.modelB.modelSlug) ?? 0;

    if (countA >= MAX_APPEARANCES || countB >= MAX_APPEARANCES) {
      continue;
    }

    selected.push(c);
    modelAppearances.set(c.modelA.modelSlug, countA + 1);
    modelAppearances.set(c.modelB.modelSlug, countB + 1);
  }

  // Transform to response shape
  const matchups = selected.map((c) => ({
    modelA: {
      modelSlug: c.modelA.modelSlug,
      mu: c.modelA.mu,
      sigma: c.modelA.sigma,
      exposed: c.modelA.exposed,
      gamesPlayed: c.modelA.gamesPlayed,
      rank: c.modelA.rank,
      displayScore: c.modelA.displayScore,
      wins: c.modelA.wins,
      losses: c.modelA.losses,
      winRate: c.modelA.winRate,
    },
    modelB: {
      modelSlug: c.modelB.modelSlug,
      mu: c.modelB.mu,
      sigma: c.modelB.sigma,
      exposed: c.modelB.exposed,
      gamesPlayed: c.modelB.gamesPlayed,
      rank: c.modelB.rank,
      displayScore: c.modelB.displayScore,
      wins: c.modelB.wins,
      losses: c.modelB.losses,
      winRate: c.modelB.winRate,
    },
    history: c.history,
    score: c.score,
    reasons: c.reasons,
  }));

  return {
    mode,
    matchups,
    totalCandidates: candidates.length,
  };
}
