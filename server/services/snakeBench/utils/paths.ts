/**
 * Author: Cascade (GLM 4.7)
 * Date: 2026-01-12
 * PURPOSE: Resolve SnakeBench completed games directory with env override and production defaults.
 *          Ensures Node backend, Python runner, and DB persistence all agree on where replays are stored.
 * SRP/DRY check: Pass — single responsibility is directory resolution; no business logic or side effects.
 */

import path from 'path';

/**
 * Environment variable name for overriding the completed games directory.
 */
export const SNAKEBENCH_COMPLETED_GAMES_DIR_ENV = 'SNAKEBENCH_COMPLETED_GAMES_DIR';

/**
 * Production default completed games directory (relative to SnakeBench backend).
 */
export const DEFAULT_COMPLETED_GAMES_DIR = 'completed_games_local';

/**
 * Resolve the completed games directory path.
 *
 * - Checks SNAKEBENCH_COMPLETED_GAMES_DIR env var first (for local dev or custom deployments).
 * - Falls back to DEFAULT_COMPLETED_GAMES_DIR ('completed_games_local') for production.
 * - Returns a path relative to the SnakeBench backend directory (external/SnakeBench/backend).
 *
 * @param envOverride - Optional env dict (for testing or explicit override).
 * @returns Directory name relative to SnakeBench backend root.
 */
export function resolveCompletedGamesDir(envOverride: Record<string, string | undefined> = process.env): string {
  const override = envOverride[SNAKEBENCH_COMPLETED_GAMES_DIR_ENV]?.trim();
  return override && override.length > 0 ? override : DEFAULT_COMPLETED_GAMES_DIR;
}

/**
 * Get the absolute path to the completed games directory.
 *
 * @param repoRoot - Absolute path to the arc-explainer repository root.
 * @param envOverride - Optional env dict (for testing or explicit override).
 * @returns Absolute path to the completed games directory.
 */
export function getCompletedGamesAbsolutePath(repoRoot: string, envOverride: Record<string, string | undefined> = process.env): string {
  const dirName = resolveCompletedGamesDir(envOverride);
  return path.join(repoRoot, 'external', 'SnakeBench', 'backend', dirName);
}

/**
 * Derive a replay_path value for DB storage, relative to the backend directory.
 *
 * This preserves the directory name (e.g., 'completed_games_local/snake_game_abc.json')
 * so that the replay resolver can reconstruct the absolute path correctly.
 *
 * @param absoluteReplayPath - Absolute path to the replay JSON file.
 * @param backendDir - Absolute path to SnakeBench backend directory.
 * @returns Replay path relative to backend directory (e.g., 'completed_games_local/snake_game_abc.json').
 */
export function deriveReplayPath(absoluteReplayPath: string, backendDir: string): string {
  const resolvedBackend = path.resolve(backendDir);
  const resolvedReplay = path.resolve(absoluteReplayPath);
  return path.relative(resolvedBackend, resolvedReplay);
}
