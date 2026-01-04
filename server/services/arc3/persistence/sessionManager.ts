/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Session lifecycle management for ARC3 games. Creates, tracks, and closes game sessions.
Maps game GUID to database session ID for frame persistence. Tracks session state and final results.
Dependencies: arc3_sessions table (defined in DatabaseSchema.ts)
SRP/DRY check: Pass — focused solely on session management, delegates frame operations to framePersistence.
*/

import { getPool } from '../../../repositories/base/BaseRepository.ts';
import { logger } from '../../../utils/logger.ts';

/**
 * Session metadata from database
 */
export interface SessionMetadata {
  id: number;
  gameId: string;
  guid: string;
  scorecardId?: string;
  state: string;
  finalScore: number;
  winScore: number;
  totalFrames: number;
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * Create a new game session in the database
 * @param gameId - Game identifier (e.g., "ls20")
 * @param guid - Session GUID from ARC3 API
 * @param winScore - Win score threshold
 * @param scorecardId - Optional scorecard ID for tracking
 * @returns Database ID of the created session
 */
export async function createSession(
  gameId: string,
  guid: string,
  winScore: number,
  scorecardId?: string
): Promise<number> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `INSERT INTO arc3_sessions (game_id, guid, scorecard_id, state, win_score)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [gameId, guid, scorecardId || null, 'IN_PROGRESS', winScore]
    );

    const sessionId = result.rows[0].id;
    logger.info(`Created session ${sessionId} for game ${gameId} (guid: ${guid}, scorecard: ${scorecardId || 'none'})`, 'arc3');

    return sessionId;
  } catch (error) {
    logger.error(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * Get session metadata by database ID
 * @param sessionId - Database ID of the session
 * @returns Session metadata or null if not found
 */
export async function getSessionById(sessionId: number): Promise<SessionMetadata | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `SELECT id, game_id, guid, scorecard_id, state, final_score, win_score, total_frames, started_at, ended_at
      FROM arc3_sessions
      WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      gameId: row.game_id,
      guid: row.guid,
      scorecardId: row.scorecard_id,
      state: row.state,
      finalScore: row.final_score,
      winScore: row.win_score,
      totalFrames: row.total_frames,
      startedAt: row.started_at,
      endedAt: row.ended_at
    };
  } catch (error) {
    logger.error(`Failed to get session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * Get session metadata by GUID
 * @param guid - Session GUID from ARC3 API
 * @returns Session metadata or null if not found
 */
export async function getSessionByGuid(guid: string): Promise<SessionMetadata | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `SELECT id, game_id, guid, scorecard_id, state, final_score, win_score, total_frames, started_at, ended_at
      FROM arc3_sessions
      WHERE guid = $1`,
      [guid]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      gameId: row.game_id,
      guid: row.guid,
      scorecardId: row.scorecard_id,
      state: row.state,
      finalScore: row.final_score,
      winScore: row.win_score,
      totalFrames: row.total_frames,
      startedAt: row.started_at,
      endedAt: row.ended_at
    };
  } catch (error) {
    logger.error(`Failed to get session by GUID: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * List all sessions for a game
 * @param gameId - Game identifier (e.g., "ls20")
 * @param limit - Maximum number of sessions to return (default: 50)
 * @returns Array of session metadata, ordered by started_at DESC
 */
export async function listSessions(gameId: string, limit: number = 50): Promise<SessionMetadata[]> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `SELECT id, game_id, guid, scorecard_id, state, final_score, win_score, total_frames, started_at, ended_at
      FROM arc3_sessions
      WHERE game_id = $1
      ORDER BY started_at DESC
      LIMIT $2`,
      [gameId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      gameId: row.game_id,
      guid: row.guid,
      scorecardId: row.scorecard_id,
      state: row.state,
      finalScore: row.final_score,
      winScore: row.win_score,
      totalFrames: row.total_frames,
      startedAt: row.started_at,
      endedAt: row.ended_at
    }));
  } catch (error) {
    logger.error(`Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * End a game session and record final state
 * @param sessionId - Database ID of the session
 * @param finalState - Final game state (WIN, GAME_OVER, etc.)
 * @param finalScore - Final score achieved
 */
export async function endSession(
  sessionId: number,
  finalState: string,
  finalScore: number
): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    await pool.query(
      `UPDATE arc3_sessions
      SET state = $1, final_score = $2, ended_at = CURRENT_TIMESTAMP
      WHERE id = $3`,
      [finalState, finalScore, sessionId]
    );

    logger.info(`Ended session ${sessionId} with state ${finalState} and score ${finalScore}`, 'arc3');
  } catch (error) {
    logger.error(`Failed to end session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * Delete a session and all its frames
 * @param sessionId - Database ID of the session
 */
export async function deleteSession(sessionId: number): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    // Frames will be deleted automatically due to ON DELETE CASCADE
    await pool.query('DELETE FROM arc3_sessions WHERE id = $1', [sessionId]);
    logger.info(`Deleted session ${sessionId}`, 'arc3');
  } catch (error) {
    logger.error(`Failed to delete session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}
