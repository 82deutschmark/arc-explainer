/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-12-19
 * PURPOSE: Hook for transforming raw Worm Arena replay data into structured display values.
 *          Extracts frames, player info, scores, and other metadata from replay JSON.
 * SRP/DRY check: Pass - data transformation only, no rendering or state management.
 */

import React from 'react';

export interface WormArenaReplayDataResult {
  /** Array of game frames */
  frames: any[];
  /** Board width in cells */
  boardWidth: number;
  /** Board height in cells */
  boardHeight: number;
  /** Map of snake ID to display name */
  playerLabels: Record<string, string>;
  /** Array of model slugs */
  models: string[];
  /** Array of player IDs (snake IDs) */
  playerIds: string[];
  /** Player A display name */
  playerAName: string;
  /** Player B display name */
  playerBName: string;
  /** Current frame scores by snake ID */
  currentScores: Record<string, number>;
  /** Final scores by snake ID */
  finalScores: Record<string, number>;
  /** Number of rounds played */
  roundsPlayed: number;
  /** Match start timestamp */
  startedAt: string;
}

/**
 * Transform raw replay data into structured display values.
 *
 * @param replayData - Raw replay JSON from API
 * @param selectedMeta - Optional metadata from games list (provides startedAt, roundsPlayed)
 * @param currentFrame - Current frame being displayed (for current scores)
 * @returns Structured replay data for display
 */
export function useWormArenaReplayData(
  replayData: any | null,
  selectedMeta?: { startedAt?: string; roundsPlayed?: number } | null,
  currentFrame?: any | null,
): WormArenaReplayDataResult {
  // Extract frames array
  const frames: any[] = React.useMemo(() => {
    if (replayData && Array.isArray(replayData.frames)) return replayData.frames;
    return [];
  }, [replayData]);

  // Board dimensions
  const boardWidth = replayData?.game?.board?.width ?? 10;
  const boardHeight = replayData?.game?.board?.height ?? 10;

  // Build player labels map (snake ID -> display name)
  const playerLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    const players = replayData?.players ?? {};
    Object.entries(players).forEach(([sid, player], idx) => {
      const name = (player as any)?.name ?? (player as any)?.model_name ?? (player as any)?.modelName ?? `Snake ${idx + 1}`;
      labels[sid] = String(name);
    });
    return labels;
  }, [replayData]);

  // Extract model slugs
  const models = React.useMemo(() => {
    const mods = replayData?.metadata?.models;
    return Array.isArray(mods) ? mods : [];
  }, [replayData]);

  // Player IDs and names
  const playerIds = Object.keys(playerLabels);
  const playerAName = playerIds.length > 0 ? playerLabels[playerIds[0]] : 'Player A';
  const playerBName = playerIds.length > 1 ? playerLabels[playerIds[1]] : 'Player B';

  // Scores
  const finalScores = replayData?.metadata?.final_scores ?? replayData?.totals?.scores ?? {};
  const currentScores = currentFrame?.state?.scores ?? replayData?.initial_state?.scores ?? {};

  // Metadata
  const roundsPlayed = selectedMeta?.roundsPlayed ?? replayData?.metadata?.actual_rounds ?? replayData?.game?.rounds_played ?? frames.length ?? 0;
  const startedAt = selectedMeta?.startedAt ?? replayData?.metadata?.start_time ?? replayData?.game?.started_at ?? '';

  return {
    frames,
    boardWidth,
    boardHeight,
    playerLabels,
    models,
    playerIds,
    playerAName,
    playerBName,
    currentScores,
    finalScores,
    roundsPlayed,
    startedAt,
  };
}

export default useWormArenaReplayData;
