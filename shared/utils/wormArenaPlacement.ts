/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Shared helper for Worm Arena placement story based on SnakeBench
 *          TrueSkill snapshots. Provides a lightweight, DB-free way to
 *          classify placement status and progress from a SnakeBenchModelRating.
 * SRP/DRY check: Pass — pure functions only, reused by frontend and tests.
 */

import type { SnakeBenchModelRating } from '../types.ts';

export type WormArenaPlacementPhase =
  | 'not_started'
  | 'in_progress'
  | 'effectively_complete'
  | 'complete';

export interface WormArenaPlacementSummary {
  modelSlug: string;
  gamesPlayed: number;
  maxGames: number;
  sigma: number;
  mu: number;
  exposed: number;
  displayScore: number;
  phase: WormArenaPlacementPhase;
  progress: number; // 0-1 fraction of placement games completed (heuristic)
  label: string;
  description: string;
}

const DEFAULT_MAX_GAMES = 9;
const EFFECTIVE_SIGMA_THRESHOLD = 3.0;

export function summarizeWormArenaPlacement(
  rating: SnakeBenchModelRating | null | undefined,
): WormArenaPlacementSummary | null {
  if (!rating) return null;

  const gamesPlayed = Number.isFinite(rating.gamesPlayed) ? Math.max(0, rating.gamesPlayed) : 0;
  const sigma = Number.isFinite(rating.sigma) ? Math.max(0, rating.sigma) : 0;
  const mu = Number.isFinite(rating.mu) ? rating.mu : 25.0;
  const exposed = Number.isFinite(rating.exposed) ? rating.exposed : mu - 3 * sigma;
  const displayScore = Number.isFinite(rating.displayScore) ? rating.displayScore : exposed * 50.0;

  const maxGames = DEFAULT_MAX_GAMES;

  let phase: WormArenaPlacementPhase;
  let label: string;
  let description: string;

  if (gamesPlayed === 0) {
    phase = 'not_started';
    label = 'Placement not started';
    description =
      "This model has not played any Worm Arena games yet. Once it starts playing, we will begin estimating its skill.";
  } else if (gamesPlayed >= maxGames) {
    phase = 'complete';
    label = 'Placement complete';
    description =
      'This model has finished its 9-game placement run. The pessimistic rating should be relatively stable.';
  } else if (sigma <= EFFECTIVE_SIGMA_THRESHOLD) {
    phase = 'effectively_complete';
    label = 'Placement effectively complete';
    description =
      'Even though this model has not reached 9 games, uncertainty is already low. Additional games will refine the rating but not change it dramatically.';
  } else {
    phase = 'in_progress';
    label = 'Placement in progress';
    description =
      'This model is still in its placement run. Each additional game helps shrink uncertainty and lock in its starting rating.';
  }

  const rawProgress = gamesPlayed / maxGames;
  const clampedProgress = Math.max(0, Math.min(1, rawProgress));

  return {
    modelSlug: rating.modelSlug,
    gamesPlayed,
    maxGames,
    sigma,
    mu,
    exposed,
    displayScore,
    phase,
    progress: clampedProgress,
    label,
    description,
  };
}
