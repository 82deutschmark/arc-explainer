/**
 * Author: Cascade (GPT-5.2)
 * Date: 2026-01-13
 * PURPOSE: Timer calculation utilities for Worm Arena live streaming.
 *          Computes wall clock duration (time since match start) and since-last-move duration.
 *          Handles potential null inputs gracefully.
 * SRP/DRY check: Pass - encapsulates timer logic reused by hooks/UI.
 */

export interface WormArenaTimers {
  wallClockSeconds: number | null;
  sinceLastMoveSeconds: number | null;
}

/**
 * Compute derived timer values from authoritative timestamps.
 * 
 * @param matchStartedAt - Timestamp when the match began (ms)
 * @param lastMoveAt - Timestamp of the most recent frame/move (ms)
 * @param now - Current reference timestamp (ms)
 * @returns {WormArenaTimers} Object containing computed seconds (or null if inputs missing)
 */
export function computeTimerSeconds(
  matchStartedAt: number | null | undefined,
  lastMoveAt: number | null | undefined,
  now: number
): WormArenaTimers {
  const wallClockSeconds =
    Number.isFinite(matchStartedAt) && matchStartedAt! > 0
      ? Math.max(0, (now - matchStartedAt!) / 1000)
      : null;

  const sinceLastMoveSeconds =
    Number.isFinite(lastMoveAt) && lastMoveAt! > 0
      ? Math.max(0, (now - lastMoveAt!) / 1000)
      : null;

  return {
    wallClockSeconds,
    sinceLastMoveSeconds,
  };
}
