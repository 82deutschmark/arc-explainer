/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: PostgreSQL persistence layer for ARC3 game frames. Saves frame data, actions, and captions to database.
Replaces SDK's file-based saveFrame with database storage. Supports frame history queries and session tracking.
Dependencies: arc3_sessions and arc3_frames tables (defined in DatabaseSchema.ts)
SRP/DRY check: Pass — focused solely on frame persistence, delegates change detection to frameAnalysis helper.
*/

import { getPool } from '../../../repositories/base/BaseRepository.ts';
import { FrameData, GameAction } from '../Arc3ApiClient.ts';
import { logger } from '../../../utils/logger.ts';

/**
 * Saved frame structure for database storage
 */
export interface SavedFrame {
  id: number;
  sessionId: number;
  frameNumber: number;
  actionType: string;
  actionParams: Record<string, any>;
  caption: string | null;
  state: string;
  score: number;
  winScore: number;
  frameData: FrameData;
  pixelsChanged: number;
  timestamp: Date;
}

/**
 * Session metadata from database
 */
export interface SessionMetadata {
  id: number;
  gameId: string;
  guid: string;
  state: string;
  finalScore: number;
  winScore: number;
  totalFrames: number;
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * Save a frame to the database
 * @param sessionId - Database ID of the session (from arc3_sessions)
 * @param frameNumber - Sequential frame number (0-indexed)
 * @param frameData - Frame data from API
 * @param action - Action that produced this frame
 * @param caption - Human-readable caption describing the action
 * @param pixelsChanged - Number of pixels that changed (0 for first frame)
 * @returns Saved frame ID
 */
export async function saveFrame(
  sessionId: number,
  frameNumber: number,
  frameData: FrameData,
  action: GameAction,
  caption: string,
  pixelsChanged: number
): Promise<number> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `INSERT INTO arc3_frames (
        session_id, frame_number, action_type, action_params,
        caption, state, score, win_score, frame_data, pixels_changed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        sessionId,
        frameNumber,
        action.action,
        JSON.stringify(action.coordinates ? { coordinates: action.coordinates } : {}),
        caption,
        frameData.state,
        frameData.score,
        frameData.win_score,
        JSON.stringify(frameData),
        pixelsChanged
      ]
    );

    const frameId = result.rows[0].id;

    // Update session total_frames count
    await pool.query(
      'UPDATE arc3_sessions SET total_frames = $1 WHERE id = $2',
      [frameNumber + 1, sessionId]
    );

    logger.debug(`Frame ${frameNumber} saved for session ${sessionId}: ${caption}`, 'arc3');

    return frameId;
  } catch (error) {
    logger.error(`Failed to save frame: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * Load a specific frame from the database
 * @param sessionId - Database ID of the session
 * @param frameNumber - Frame number to load
 * @returns Saved frame data or null if not found
 */
export async function loadFrame(
  sessionId: number,
  frameNumber: number
): Promise<SavedFrame | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `SELECT
        id, session_id, frame_number, action_type, action_params,
        caption, state, score, win_score, frame_data, pixels_changed, timestamp
      FROM arc3_frames
      WHERE session_id = $1 AND frame_number = $2`,
      [sessionId, frameNumber]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      sessionId: row.session_id,
      frameNumber: row.frame_number,
      actionType: row.action_type,
      actionParams: row.action_params,
      caption: row.caption,
      state: row.state,
      score: row.score,
      winScore: row.win_score,
      frameData: row.frame_data,
      pixelsChanged: row.pixels_changed,
      timestamp: row.timestamp
    };
  } catch (error) {
    logger.error(`Failed to load frame: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * Get all frames for a session, ordered by frame number
 * @param sessionId - Database ID of the session
 * @returns Array of saved frames
 */
export async function getFrameHistory(sessionId: number): Promise<SavedFrame[]> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `SELECT
        id, session_id, frame_number, action_type, action_params,
        caption, state, score, win_score, frame_data, pixels_changed, timestamp
      FROM arc3_frames
      WHERE session_id = $1
      ORDER BY frame_number ASC`,
      [sessionId]
    );

    return result.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      frameNumber: row.frame_number,
      actionType: row.action_type,
      actionParams: row.action_params,
      caption: row.caption,
      state: row.state,
      score: row.score,
      winScore: row.win_score,
      frameData: row.frame_data,
      pixelsChanged: row.pixels_changed,
      timestamp: row.timestamp
    }));
  } catch (error) {
    logger.error(`Failed to get frame history: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}

/**
 * Delete all frames for a session
 * @param sessionId - Database ID of the session
 */
export async function deleteFrames(sessionId: number): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    await pool.query('DELETE FROM arc3_frames WHERE session_id = $1', [sessionId]);
    logger.debug(`Deleted all frames for session ${sessionId}`, 'arc3');
  } catch (error) {
    logger.error(`Failed to delete frames: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    throw error;
  }
}
