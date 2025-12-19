/**
 * Author: Cascade
 * Date: 2025-12-19
 * PURPOSE: WormArenaSessionRepository
 *          Handles persistence of Worm Arena live session mappings
 *          (sessionId -> gameId) to enable durable live-link resolution.
 *          Allows old live URLs to redirect to exact replays even after
 *          server restarts by storing completed match mappings in Postgres.
 * SRP/DRY check: Pass — single responsibility for session persistence.
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';

export interface WormArenaSessionRow {
  session_id: string;
  model_a: string;
  model_b: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  expires_at: Date;
  completed_at?: Date | null;
  game_id?: string | null;
}

export class WormArenaSessionRepository extends BaseRepository {
  /**
   * Create a new pending session
   */
  async createPendingSession(
    sessionId: string,
    modelA: string,
    modelB: string,
    expiresAt: Date
  ): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('Database not connected, skipping session creation', 'worm-arena-repo');
      return;
    }

    const sql = `
      INSERT INTO worm_arena_sessions (session_id, model_a, model_b, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (session_id) DO NOTHING
    `;

    await this.query(sql, [sessionId, modelA, modelB, expiresAt]);
    logger.info(`Created pending Worm Arena session: ${sessionId}`, 'worm-arena-repo');
  }

  /**
   * Mark a session as completed with its gameId
   */
  async markCompleted(sessionId: string, gameId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('Database not connected, skipping session completion', 'worm-arena-repo');
      return;
    }

    const sql = `
      UPDATE worm_arena_sessions
      SET status = 'completed', game_id = $2, completed_at = NOW()
      WHERE session_id = $1
    `;

    await this.query(sql, [sessionId, gameId]);
    logger.info(`Marked Worm Arena session completed: ${sessionId} -> ${gameId}`, 'worm-arena-repo');
  }

  /**
   * Mark a session as failed
   */
  async markFailed(sessionId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('Database not connected, skipping session failure', 'worm-arena-repo');
      return;
    }

    const sql = `
      UPDATE worm_arena_sessions
      SET status = 'failed'
      WHERE session_id = $1
    `;

    await this.query(sql, [sessionId]);
    logger.info(`Marked Worm Arena session failed: ${sessionId}`, 'worm-arena-repo');
  }

  /**
   * Get session by sessionId
   */
  async getBySessionId(sessionId: string): Promise<WormArenaSessionRow | null> {
    if (!this.isConnected()) {
      logger.warn('Database not connected, cannot retrieve session', 'worm-arena-repo');
      return null;
    }

    const sql = `
      SELECT session_id, model_a, model_b, status, created_at, expires_at, completed_at, game_id
      FROM worm_arena_sessions
      WHERE session_id = $1
    `;

    const { rows } = await this.query(sql, [sessionId]);
    return rows.length > 0 ? (rows[0] as WormArenaSessionRow) : null;
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    const sql = `
      DELETE FROM worm_arena_sessions
      WHERE expires_at < NOW() AND status = 'pending'
    `;

    const { rowCount } = await this.query(sql);
    const count = rowCount || 0;

    if (count > 0) {
      logger.info(`Cleaned up ${count} expired Worm Arena sessions`, 'worm-arena-repo');
    }

    return count;
  }
}
