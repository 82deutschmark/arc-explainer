/*
Author: Cascade
Date: 2026-01-04
PURPOSE: Scorecard service for ARC3 games. Manages scorecard lifecycle (open, close, get) and tracks game statistics.
Replaces SDK's file-based scorecard management with database storage.
Dependencies: New scorecards table (to be added to DatabaseSchema.ts).
SRP/DRY check: Pass — focused solely on scorecard management and statistics aggregation.
*/

import { getPool } from '../../repositories/base/BaseRepository.ts';
import { logger } from '../../utils/logger.ts';

export interface Scorecard {
  cardId: string;
  apiKey?: string;
  sourceUrl?: string;
  tags?: string[];
  opaque?: any; // metadata
  openedAt: Date;
  closedAt?: Date;
  isActive: boolean;
}

export interface ScorecardSummary {
  cardId: string;
  played: number;
  won: number;
  score: number;
  total_actions: number;
  cards: Record<string, PerGameScorecard>;
}

export interface PerGameScorecard {
  total_plays: number;
  total_actions: number;
  scores?: number[];
  states?: string[];
  actions?: number[];
}

/**
 * Open a new scorecard
 */
export async function openScorecard(
  sourceUrl?: string,
  tags?: string[],
  metadata?: any
): Promise<string> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    // Generate a unique scorecard ID
    const cardId = `sc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await pool.query(
      `INSERT INTO scorecards (
        card_id, source_url, tags, opaque, opened_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        cardId,
        sourceUrl || null,
        tags || null,
        metadata ? JSON.stringify(metadata) : null,
        new Date(),
        true
      ]
    );

    logger.info(`Opened scorecard ${cardId}`, 'scorecard');
    return cardId;
  } catch (error) {
    logger.error(`Failed to open scorecard: ${error instanceof Error ? error.message : String(error)}`, 'scorecard');
    throw error;
  }
}

/**
 * Close a scorecard and calculate final statistics
 */
export async function closeScorecard(cardId: string): Promise<ScorecardSummary> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    // Mark scorecard as closed
    await pool.query(
      `UPDATE scorecards SET closed_at = $1, is_active = false WHERE card_id = $2`,
      [new Date(), cardId]
    );

    // Aggregate statistics from sessions
    const sessionsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_plays,
        COUNT(CASE WHEN s.state = 'WIN' THEN 1 END) as wins,
        COALESCE(SUM(s.final_score), 0) as total_score,
        COALESCE(SUM(f.action_count), 0) as total_actions,
        s.game_id,
        array_agg(s.final_score ORDER BY s.started_at) as scores,
        array_agg(s.state ORDER BY s.started_at) as states,
        array_agg(f.action_count ORDER BY s.started_at) as actions
      FROM arc3_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as action_count
        FROM arc3_frames
        WHERE action_type != 'RESET'
        GROUP BY session_id
      ) f ON s.id = f.session_id
      WHERE s.scorecard_id = $1
      GROUP BY s.game_id`,
      [cardId]
    );

    const cards: Record<string, PerGameScorecard> = {};
    let totalPlayed = 0;
    let totalWon = 0;
    let totalScore = 0;
    let totalActions = 0;

    for (const row of sessionsResult.rows) {
      const gameCard: PerGameScorecard = {
        total_plays: row.total_plays,
        total_actions: row.total_actions || 0,
        scores: row.scores || [],
        states: row.states || [],
        actions: row.actions || []
      };
      cards[row.game_id] = gameCard;

      totalPlayed += row.total_plays;
      totalWon += row.wins;
      totalScore += row.total_score;
      totalActions += row.total_actions || 0;
    }

    const summary: ScorecardSummary = {
      cardId,
      played: totalPlayed,
      won: totalWon,
      score: totalScore,
      total_actions: totalActions,
      cards
    };

    logger.info(`Closed scorecard ${cardId}: ${totalWon}/${totalPlayed} games won`, 'scorecard');
    return summary;
  } catch (error) {
    logger.error(`Failed to close scorecard: ${error instanceof Error ? error.message : String(error)}`, 'scorecard');
    throw error;
  }
}

/**
 * Get scorecard details and current statistics
 */
export async function getScorecard(cardId: string, gameId?: string): Promise<ScorecardSummary> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    // Get scorecard metadata
    const scorecardResult = await pool.query(
      `SELECT card_id, source_url, tags, opaque, opened_at, closed_at, is_active
       FROM scorecards WHERE card_id = $1`,
      [cardId]
    );

    if (scorecardResult.rows.length === 0) {
      throw new Error('Scorecard not found');
    }

    // Aggregate statistics (same query as closeScorecard but without marking as closed)
    let query = `
      SELECT 
        COUNT(*) as total_plays,
        COUNT(CASE WHEN s.state = 'WIN' THEN 1 END) as wins,
        COALESCE(SUM(s.final_score), 0) as total_score,
        COALESCE(SUM(f.action_count), 0) as total_actions,
        s.game_id,
        array_agg(s.final_score ORDER BY s.started_at) as scores,
        array_agg(s.state ORDER BY s.started_at) as states,
        array_agg(f.action_count ORDER BY s.started_at) as actions
      FROM arc3_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as action_count
        FROM arc3_frames
        WHERE action_type != 'RESET'
        GROUP BY session_id
      ) f ON s.id = f.session_id
      WHERE s.scorecard_id = $1
    `;
    
    const params = [cardId];
    
    if (gameId) {
      query += ` AND s.game_id = $2`;
      params.push(gameId);
    }
    
    query += ` GROUP BY s.game_id`;

    const sessionsResult = await pool.query(query, params);

    const cards: Record<string, PerGameScorecard> = {};
    let totalPlayed = 0;
    let totalWon = 0;
    let totalScore = 0;
    let totalActions = 0;

    for (const row of sessionsResult.rows) {
      const gameCard: PerGameScorecard = {
        total_plays: row.total_plays,
        total_actions: row.total_actions || 0,
        scores: row.scores || [],
        states: row.states || [],
        actions: row.actions || []
      };
      cards[row.game_id] = gameCard;

      totalPlayed += row.total_plays;
      totalWon += row.wins;
      totalScore += row.total_score;
      totalActions += row.total_actions || 0;
    }

    const summary: ScorecardSummary = {
      cardId,
      played: totalPlayed,
      won: totalWon,
      score: totalScore,
      total_actions: totalActions,
      cards
    };

    return summary;
  } catch (error) {
    logger.error(`Failed to get scorecard: ${error instanceof Error ? error.message : String(error)}`, 'scorecard');
    throw error;
  }
}

/**
 * Get the currently active scorecard for a session (if any)
 */
export async function getActiveScorecard(): Promise<Scorecard | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(
      `SELECT card_id, source_url, tags, opaque, opened_at, closed_at, is_active
       FROM scorecards WHERE is_active = true ORDER BY opened_at DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      cardId: row.card_id,
      sourceUrl: row.source_url,
      tags: row.tags || [],
      opaque: row.opaque ? JSON.parse(row.opaque) : undefined,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      isActive: row.is_active
    };
  } catch (error) {
    logger.error(`Failed to get active scorecard: ${error instanceof Error ? error.message : String(error)}`, 'scorecard');
    throw error;
  }
}
