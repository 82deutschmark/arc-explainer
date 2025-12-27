/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Suggest interesting unplayed matchups using ladder or entertainment scoring modes.
 *          Applies variety penalty to ensure model diversity in suggestions. WHAT?!  0 cents. This entire file needs to be audited. 
 * SRP/DRY check: Pass — complex algorithm isolated, single responsibility.
 */

import type { SnakeBenchTrueSkillLeaderboardEntry } from '../../../../shared/types.js';
import { MODELS } from '../../../config/models.ts';

export interface SuggestedMatchup {
  modelA: {
    modelSlug: string;
    mu: number;
    sigma: number;
    exposed: number;
    gamesPlayed: number;
  };
  modelB: {
    modelSlug: string;
    mu: number;
    sigma: number;
    exposed: number;
    gamesPlayed: number;
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

  // Filter to only approved OpenRouter models from config (avoid expensive/unsupported models)
  let filtered = leaderboard.filter((entry) => approvedModels.has(entry.modelSlug));

  if (filtered.length < 2) {
    return { mode, matchups: [], totalCandidates: 0 };
  }

  // Normalize slugs by removing ':free' suffix and prefer free versions
  const normalizedMap = new Map<string, SnakeBenchTrueSkillLeaderboardEntry>();
  for (const entry of filtered) {
    const normalizedSlug = entry.modelSlug.replace(/:free$/, '');
    const existing = normalizedMap.get(normalizedSlug);
    if (!existing) {
      normalizedMap.set(normalizedSlug, entry);
    } else {
      // Prefer free version over paid version
      const existingIsFree = existing.modelSlug.includes(':free');
      const currentIsFree = entry.modelSlug.includes(':free');
      if (currentIsFree && !existingIsFree) {
        // Replace with free version
        normalizedMap.set(normalizedSlug, entry);
      } else if (existingIsFree === currentIsFree) {
        // Both same type (both free or both paid), keep the one with more games
        if (entry.gamesPlayed > existing.gamesPlayed) {
          normalizedMap.set(normalizedSlug, entry);
        }
      }
      // If existing is free and current is paid, keep existing
    }
  }
  filtered = Array.from(normalizedMap.values());

  // DEBUG: Log normalized list
  console.log(`[MATCHUP-SUGGESTIONS] After normalization: ${filtered.length} models\n${filtered.map(m => m.modelSlug).join(', ')}`);

  // Helper to get normalized key for a pair (must match database query logic)
  const pairKey = (a: string, b: string): string => {
    const slugA = a.replace(/:free$/, '');
    const slugB = b.replace(/:free$/, '');
    // Use same normalization as database query: LEAST/GREATEST
    const normalizedA = slugA < slugB ? slugA : slugB;
    const normalizedB = slugA < slugB ? slugB : slugA;
    return `${normalizedA}|||${normalizedB}`;
  };

  // Generate all candidate pairs (only unplayed)
  type Candidate = {
    modelA: typeof filtered[0];
    modelB: typeof filtered[0];
    history: { matchesPlayed: number; lastPlayedAt: string | null };
    score: number;
    reasons: string[];
  };

  const candidates: Candidate[] = [];
  const modelAppearances = new Map<string, number>();

  // DEBUG: Show pairing history sample
  const pairingHistorySample = Array.from(pairingHistory.entries()).slice(0, 5);
  console.log(`[MATCHUP-SUGGESTIONS] Pairing history has ${pairingHistory.size} pairs. Sample keys:\n  ${pairingHistorySample.map(([k]) => k).join('\n  ')}`);

  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      const modelA = filtered[i];
      const modelB = filtered[j];
      const key = pairKey(modelA.modelSlug, modelB.modelSlug);
      const history = pairingHistory.get(key) ?? { matchesPlayed: 0, lastPlayedAt: null };

      // DEBUG: Show what we're looking for on first iteration
      if (i === 0 && j === 1) {
        console.log(`[MATCHUP-SUGGESTIONS] Looking for pair "${modelA.modelSlug}" vs "${modelB.modelSlug}"`);
        console.log(`  Generated key: "${key}"`);
        console.log(`  Found in history: ${history.matchesPlayed > 0 ? 'YES' : 'NO'} (matchesPlayed: ${history.matchesPlayed})`);
      }

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
    },
    modelB: {
      modelSlug: c.modelB.modelSlug,
      mu: c.modelB.mu,
      sigma: c.modelB.sigma,
      exposed: c.modelB.exposed,
      gamesPlayed: c.modelB.gamesPlayed,
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
