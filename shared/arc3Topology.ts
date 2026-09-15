/*
Author: Codex (GPT-6), with existing contributors
Date: 2026-09-12
PURPOSE: Movement gestures for the remaining triangular boards. Authored and contributed
hex movement games now use cardinal square grids. G043 also returned to squares.
SRP/DRY check: Pass — shared UI facts, checked against the shipped neighbor tables.
*/
export const EXOTIC_GAME_IDS: readonly string[] = ['g009', 'g015', 'g022', 'g027'];
export const SPATIAL_CLICK_GAME_IDS: readonly string[] = ['g009'];
export const TRIANGULAR_MOVEMENT_GAME_IDS: readonly string[] = ['g015', 'g022', 'g027'];
export const PROBE_CANDIDATE_ACTIONS: readonly number[] = [1, 2, 3, 4, 5, 7];
export type ProbeGesture = 'left' | 'right' | null;
export function probeGestureFor(gameId: string | undefined | null): ProbeGesture {
  if (!gameId || !EXOTIC_GAME_IDS.includes(gameId)) return null;
  return SPATIAL_CLICK_GAME_IDS.includes(gameId) ? 'right' : 'left';
}
