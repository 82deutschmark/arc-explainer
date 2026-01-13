/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27 (updated 2026-01-13 by Cascade)
 * PURPOSE: CurationRepository - Handles curated lists and featured content for Worm Arena.
 *          Primarily manages the "Greatest Hits" logic across multiple dimensions.
 *          INTERCHANGEABLE: "Game" and "Match" refer to the same entity.
 *          Now filters out culled games (is_culled = FALSE) to exclude low-quality matches.
 * SRP/DRY check: Pass - focused exclusively on curated content retrieval.
 */

import { PoolClient } from 'pg';
import { BaseRepository } from './base/BaseRepository.ts';
import {
  clampLimit,
  logRepoError,
} from './snakebenchSqlHelpers.ts';
import type {
  WormArenaGreatestHitGame,
} from '../../shared/types.js';

export class CurationRepository extends BaseRepository {
  /**
   * Greatest-hits selector for Worm Arena.
   *
   * Uses multiple dimensions over completed games:
   * - Longest by rounds played
   * - Most expensive by total_cost
   * - Highest scoring by max per-player score
   * - Longest duration (wall-clock)
   * - Highest total score (combined)
   * - Close matches (photo finishes)
   * - Monster apple hauls (25+)
   */
  async getWormArenaGreatestHits(limitPerDimension: number = 5, client?: PoolClient): Promise<WormArenaGreatestHitGame[]> {
    if (!this.isConnected()) return [];

    const safeLimit = clampLimit(limitPerDimension, 5, 10);
    const MAX_TOTAL = 20;

    try {
      const baseFields = `
        g.id AS game_id, g.start_time, g.end_time, g.rounds AS rounds_played,
        g.board_width, g.board_height, g.total_cost,
        MAX(gp.score) AS max_final_score, SUM(gp.score) AS sum_final_scores,
        ABS(
          COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
          COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
        ) AS score_delta,
        MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
        MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
      `;

      const baseFrom = `
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed' AND COALESCE(g.rounds, 0) > 0 AND COALESCE(g.is_culled, false) = false
      `;

      const baseHaving = `HAVING MAX(gp.score) > 0 OR g.total_cost > 0`;

      const roundsSql = `SELECT ${baseFields} ${baseFrom} AND COALESCE(g.rounds, 0) >= 20 GROUP BY g.id ${baseHaving} ORDER BY COALESCE(g.rounds, 0) DESC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;
      const costSql = `SELECT ${baseFields} ${baseFrom} AND COALESCE(g.rounds, 0) >= 5 AND g.total_cost >= 0.01 GROUP BY g.id ${baseHaving} ORDER BY g.total_cost DESC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;
      const scoreSql = `SELECT ${baseFields} ${baseFrom} AND COALESCE(g.rounds, 0) >= 5 GROUP BY g.id ${baseHaving} ORDER BY MAX(gp.score) DESC, COALESCE(g.rounds, 0) DESC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;
      const durationSql = `SELECT ${baseFields}, EXTRACT(EPOCH FROM (g.end_time - g.start_time)) AS duration_seconds ${baseFrom} AND g.start_time IS NOT NULL AND g.end_time IS NOT NULL AND EXTRACT(EPOCH FROM (g.end_time - g.start_time)) >= 60 GROUP BY g.id ${baseHaving} ORDER BY duration_seconds DESC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;
      const totalScoreSql = `SELECT ${baseFields} ${baseFrom} AND COALESCE(g.rounds, 0) >= 5 GROUP BY g.id HAVING SUM(gp.score) >= 10 ORDER BY SUM(gp.score) DESC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;
      const closeMatchesSql = `SELECT ${baseFields} ${baseFrom} AND COALESCE(g.rounds, 0) >= 5 GROUP BY g.id HAVING ABS(COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) - COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)) <= 2 AND MAX(gp.score) >= 5 ORDER BY MAX(gp.score) DESC, score_delta ASC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;
      const applesHaulSql = `SELECT ${baseFields} ${baseFrom} AND COALESCE(g.rounds, 0) >= 5 GROUP BY g.id HAVING MAX(gp.score) >= 25 ORDER BY MAX(gp.score) DESC, COALESCE(g.start_time, NOW()) DESC LIMIT $1;`;

      const [roundsRes, costRes, scoreRes, durationRes, totalScoreRes, closeRes, applesRes] = await Promise.all([
        this.query(roundsSql, [safeLimit], client),
        this.query(costSql, [safeLimit], client),
        this.query(scoreSql, [safeLimit], client),
        this.query(durationSql, [safeLimit], client),
        this.query(totalScoreSql, [safeLimit], client),
        this.query(closeMatchesSql, [safeLimit], client),
        this.query(applesHaulSql, [safeLimit], client),
      ]);

      const seen = new Map<string, WormArenaGreatestHitGame>();
      const ordered: WormArenaGreatestHitGame[] = [];

      const addFromRow = (row: any, dimension: string) => {
        const gameId = String(row.game_id || row.id || '').trim();
        if (!gameId || seen.has(gameId)) return;

        const roundsPlayed = Number(row.rounds_played ?? row.rounds ?? 0);
        const totalCost = Number(row.total_cost ?? 0);
        const maxFinalScore = Number(row.max_final_score ?? 0);
        const scoreDelta = Number(row.score_delta ?? 0);
        const sumFinalScores = Number(row.sum_final_scores ?? 0);
        const durationSeconds = Number(row.duration_seconds ?? 0);
        const modelA = String(row.model_a ?? '').trim();
        const modelB = String(row.model_b ?? '').trim();

        if (!modelA || !modelB || roundsPlayed <= 0) return;

        let highlightReason = '';
        let category = '';

        switch (dimension) {
          case 'rounds':
            category = 'longest_rounds';
            highlightReason = roundsPlayed >= 50 ? 'Epic long game (50+ rounds)' : roundsPlayed >= 40 ? 'Very long game (40+ rounds)' : 'Long game (20+ rounds)';
            break;
          case 'cost':
            category = 'highest_cost';
            highlightReason = totalCost >= 1 ? 'Extremely expensive match (>$1)' : totalCost >= 0.25 ? 'High-cost match (>$0.25)' : 'Expensive match (>$0.01)';
            break;
          case 'score':
            category = 'highest_score';
            highlightReason = maxFinalScore >= 15 ? 'Highest-scoring match (15+ apples)' : maxFinalScore >= 10 ? 'Big scoring match (10+ apples)' : 'Notable scoring match';
            break;
          case 'duration':
            category = 'longest_duration';
            const m = Math.floor(durationSeconds / 60);
            const h = Math.floor(m / 60);
            highlightReason = h >= 1 ? `Duration (${h}h ${m % 60}m)` : `Duration (${m}m)`;
            break;
          case 'total_score':
            category = 'highest_total_score';
            highlightReason = `Combined score (${sumFinalScores} apples)`;
            break;
          case 'apples_25_plus':
            category = 'apples_25_plus';
            highlightReason = maxFinalScore >= 30 ? `Huge apple haul (${maxFinalScore})` : `25+ apples haul`;
            break;
          case 'close_match':
            category = 'close_match';
            highlightReason = scoreDelta === 0 ? 'Perfect tie' : scoreDelta === 1 ? 'Photo finish' : `Neck-and-neck`;
            break;
        }

        const game: WormArenaGreatestHitGame = {
          gameId,
          startedAt: row.start_time ? new Date(row.start_time).toISOString() : '',
          endedAt: row.end_time ? new Date(row.end_time).toISOString() : undefined,
          modelA, modelB,
          roundsPlayed, maxRounds: roundsPlayed,
          totalCost, maxFinalScore, scoreDelta,
          boardWidth: Number(row.board_width ?? 0),
          boardHeight: Number(row.board_height ?? 0),
          highlightReason, category,
          sumFinalScores: sumFinalScores > 0 ? sumFinalScores : undefined,
          durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
        };

        seen.set(gameId, game);
        ordered.push(game);
      };

      const results = [
        { res: roundsRes, dim: 'rounds' },
        { res: costRes, dim: 'cost' },
        { res: scoreRes, dim: 'score' },
        { res: durationRes, dim: 'duration' },
        { res: totalScoreRes, dim: 'total_score' },
        { res: closeRes, dim: 'close_match' },
        { res: applesRes, dim: 'apples_25_plus' },
      ];

      for (const { res, dim } of results) {
        for (const row of res.rows) {
          addFromRow(row, dim);
          if (ordered.length >= MAX_TOTAL) break;
        }
        if (ordered.length >= MAX_TOTAL) break;
      }

      return ordered.slice(0, MAX_TOTAL);
    } catch (error) {
      logRepoError('getWormArenaGreatestHits', error);
      return [];
    }
  }
}
