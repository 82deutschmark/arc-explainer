/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Service-level constants for SnakeBench match configuration and validation.
 *          Defines safe boundaries for board size, rounds, apples, and batch operations.
 * SRP/DRY check: Pass — isolated constants, no business logic or duplication.
 */

export const MIN_BOARD_SIZE = 4;
export const MAX_BOARD_SIZE = 50;
export const MIN_MAX_ROUNDS = 10;
export const MAX_MAX_ROUNDS = 500;
export const MIN_NUM_APPLES = 1;
export const MAX_NUM_APPLES = 20;
export const MAX_BATCH_COUNT = 10;
export const DEFAULT_SNAKEBENCH_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours (safe for 2+ hour matches)

// HTTP fetching
export const DEFAULT_REMOTE_FETCH_TIMEOUT_MS = 15_000;
export const MAX_HTTP_REDIRECTS = 3;

// Game index
export const GAME_INDEX_FILENAME = 'game_index.json';
export const COMPLETED_GAMES_DIR = 'completed_games';
