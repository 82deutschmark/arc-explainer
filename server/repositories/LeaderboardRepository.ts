/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27 (updated 2026-01-17 by Cascade)
 * PURPOSE: LeaderboardRepository - Handles TrueSkill and Elo ranking data, pairing history,
 *          and per-model rating summaries. INTERCHANGEABLE: "Game" and "Match" refer to the same entity.
 *          Now filters out culled games (is_culled = FALSE) to exclude low-quality matches from stats.
 * SRP/DRY check: Pass - focused exclusively on ranking and pairing data.
 */

import { PoolClient } from 'pg';
import { BaseRepository } from './base/BaseRepository.ts';
import {
  DEFAULT_TRUESKILL_MU,
  DEFAULT_TRUESKILL_SIGMA,
  TRUESKILL_DISPLAY_MULTIPLIER,
  SQL_NORMALIZE_SLUG,
  SQL_TRUESKILL_EXPOSED,
  clampLimit,
  logRepoError,
} from './snakebenchSqlHelpers.ts';
import type {
  SnakeBenchModelRating,
  SnakeBenchTrueSkillLeaderboardEntry,
} from '../../shared/types.js';

export class LeaderboardRepository extends BaseRepository {
  /**
   * Get the current rating summary for a specific model.
   */
  async getModelRating(modelSlug: string, client?: PoolClient): Promise<SnakeBenchModelRating | null> {
    if (!this.isConnected() || !modelSlug) return null;

    try {
      const sql = `
        SELECT
          m.model_slug, m.trueskill_mu, m.trueskill_sigma, m.trueskill_exposed,
          m.wins, m.losses, m.ties, m.apples_eaten, m.games_played, m.is_active,
          COALESCE(SUM(gp.cost), 0) AS total_cost
        FROM public.models m
        JOIN public.game_participants gp ON m.id = gp.model_id
        JOIN public.games g ON gp.game_id = g.id
        WHERE ${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
          AND COALESCE(g.is_culled, false) = false
        GROUP BY
          m.model_slug, m.trueskill_mu, m.trueskill_sigma, m.trueskill_exposed,
          m.wins, m.losses, m.ties, m.apples_eaten, m.games_played, m.is_active
        ORDER BY m.games_played DESC
        LIMIT 1;
      `;

      const result = await this.query(sql, [modelSlug], client);
      if (!result.rows.length) return null;

      const row: any = result.rows[0];
      const mu = typeof row.trueskill_mu === 'number' ? row.trueskill_mu : DEFAULT_TRUESKILL_MU;
      const sigma = typeof row.trueskill_sigma === 'number' ? row.trueskill_sigma : DEFAULT_TRUESKILL_SIGMA;
      const exposed = typeof row.trueskill_exposed === 'number' ? row.trueskill_exposed : mu - 3 * sigma;

      return {
        modelSlug: String(row.model_slug ?? modelSlug),
        mu,
        sigma,
        exposed,
        displayScore: exposed * TRUESKILL_DISPLAY_MULTIPLIER,
        wins: parseInt(String(row.wins ?? '0'), 10) || 0,
        losses: parseInt(String(row.losses ?? '0'), 10) || 0,
        ties: parseInt(String(row.ties ?? '0'), 10) || 0,
        applesEaten: parseInt(String(row.apples_eaten ?? '0'), 10) || 0,
        gamesPlayed: parseInt(String(row.games_played ?? '0'), 10) || 0,
        totalCost: Number(row.total_cost ?? 0) || 0,
        isActive: typeof row.is_active === 'boolean' ? row.is_active : undefined,
      };
    } catch (error) {
      logRepoError('getModelRating', error);
      return null;
    }
  }

  /**
   * Get the TrueSkill-based leaderboard.
   */
  async getTrueSkillLeaderboard(
    limit: number = 150,
    minGames: number = 3,
    client?: PoolClient
  ): Promise<SnakeBenchTrueSkillLeaderboardEntry[]> {
    if (!this.isConnected()) return [];

    const safeLimit = clampLimit(limit, 150, 150);
    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, minGames) : 3;

    try {
      const sql = `
        WITH aggregated AS (
          SELECT
            ${SQL_NORMALIZE_SLUG('m.model_slug')} AS normalized_slug,
            COUNT(gp.game_id) AS games_played,
            COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
            COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
            COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties,
            COALESCE(SUM(gp.score), 0) AS apples_eaten,
            COALESCE(MAX(gp.score), 0) AS top_score,
            COALESCE(SUM(gp.cost), 0) AS total_cost
          FROM public.models m
          JOIN public.game_participants gp ON m.id = gp.model_id
          JOIN public.games g ON gp.game_id = g.id
          WHERE COALESCE(g.is_culled, false) = false
          GROUP BY ${SQL_NORMALIZE_SLUG('m.model_slug')}
          HAVING COUNT(gp.game_id) >= $2
        ), representative AS (
          SELECT DISTINCT ON (${SQL_NORMALIZE_SLUG('m.model_slug')})
            ${SQL_NORMALIZE_SLUG('m.model_slug')} AS normalized_slug,
            m.trueskill_mu,
            m.trueskill_sigma,
            m.trueskill_exposed,
            ${SQL_TRUESKILL_EXPOSED('m')} AS exposed_rating
          FROM public.models m
          ORDER BY ${SQL_NORMALIZE_SLUG('m.model_slug')}, COALESCE(m.games_played, 0) DESC
        )
        SELECT
          agg.normalized_slug,
          rep.trueskill_mu,
          rep.trueskill_sigma,
          rep.trueskill_exposed,
          rep.exposed_rating,
          agg.games_played,
          agg.wins,
          agg.losses,
          agg.ties,
          agg.apples_eaten,
          agg.top_score,
          agg.total_cost
        FROM aggregated agg
        LEFT JOIN representative rep ON rep.normalized_slug = agg.normalized_slug
        ORDER BY
          COALESCE(rep.exposed_rating, rep.trueskill_mu - 3 * rep.trueskill_sigma, ${DEFAULT_TRUESKILL_MU} - 3 * ${DEFAULT_TRUESKILL_SIGMA}) DESC,
          agg.games_played DESC
        LIMIT $1;
      `;

      const result = await this.query(sql, [safeLimit, safeMinGames], client);

      return result.rows.map((row: any) => {
        const mu = typeof row.trueskill_mu === 'number' ? row.trueskill_mu : DEFAULT_TRUESKILL_MU;
        const sigma = typeof row.trueskill_sigma === 'number' ? row.trueskill_sigma : DEFAULT_TRUESKILL_SIGMA;
        const exposed = typeof row.trueskill_exposed === 'number'
          ? row.trueskill_exposed
          : mu - 3 * sigma;
        const gamesPlayed = parseInt(String(row.games_played), 10);
        const wins = parseInt(String(row.wins), 10);

        return {
          modelSlug: String(row.normalized_slug),
          mu,
          sigma,
          exposed,
          displayScore: exposed * TRUESKILL_DISPLAY_MULTIPLIER,
          gamesPlayed,
          wins,
          losses: parseInt(String(row.losses), 10),
          ties: parseInt(String(row.ties), 10),
          applesEaten: parseInt(String(row.apples_eaten), 10),
          topScore: Number(row.top_score),
          totalCost: Number(row.total_cost),
          winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
        };
      });
    } catch (error) {
      logRepoError('getTrueSkillLeaderboard', error);
      return [];
    }
  }

  /**
   * Get a basic leaderboard based on win rate or games played.
   */
  async getBasicLeaderboard(
    limit: number = 10,
    sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed',
    client?: PoolClient
  ): Promise<any[]> {
    if (!this.isConnected()) return [];

    const safeLimit = clampLimit(limit, 10, 150);

    try {
      const orderSql = sortBy === 'winRate'
        ? `(COUNT(CASE WHEN gp.result = 'won' THEN 1 END)::float / NULLIF(COUNT(gp.game_id), 0)) DESC NULLS LAST`
        : `games_played DESC`;

      const sql = `
        SELECT
          ${SQL_NORMALIZE_SLUG('m.model_slug')} AS normalized_slug,
          COUNT(gp.game_id) AS games_played,
          COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
          COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
          COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
        FROM public.models m
        JOIN public.game_participants gp ON m.id = gp.model_id
        JOIN public.games g ON gp.game_id = g.id
        WHERE COALESCE(g.rounds, 0) > 0 AND COALESCE(g.is_culled, false) = false
        GROUP BY ${SQL_NORMALIZE_SLUG('m.model_slug')}
        HAVING COUNT(gp.game_id) > 0
        ORDER BY ${orderSql}
        LIMIT $1;
      `;

      const result = await this.query(sql, [safeLimit], client);

      return result.rows.map((row: any) => {
        const gamesPlayed = parseInt(String(row.games_played), 10);
        const wins = parseInt(String(row.wins), 10);
        return {
          modelSlug: String(row.normalized_slug),
          gamesPlayed,
          wins,
          losses: parseInt(String(row.losses), 10),
          ties: parseInt(String(row.ties), 10),
          winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
        };
      });
    } catch (error) {
      logRepoError('getBasicLeaderboard', error);
      return [];
    }
  }

  /**
   * Get historical pairing data for matchup suggestions.
   */
  async getPairingHistory(client?: PoolClient): Promise<Map<string, { matchesPlayed: number; lastPlayedAt: string | null }>> {
    const result = new Map<string, { matchesPlayed: number; lastPlayedAt: string | null }>();
    if (!this.isConnected()) return result;

    try {
      const sql = `
        SELECT
          LEAST(${SQL_NORMALIZE_SLUG('m1.model_slug')}, ${SQL_NORMALIZE_SLUG('m2.model_slug')}) AS slug_a,
          GREATEST(${SQL_NORMALIZE_SLUG('m1.model_slug')}, ${SQL_NORMALIZE_SLUG('m2.model_slug')}) AS slug_b,
          COUNT(DISTINCT gp1.game_id) AS matches_played,
          MAX(COALESCE(g.start_time, g.created_at)) AS last_played_at
        FROM public.game_participants gp1
        JOIN public.game_participants gp2 ON gp1.game_id = gp2.game_id AND gp1.player_slot < gp2.player_slot
        JOIN public.models m1 ON gp1.model_id = m1.id
        JOIN public.models m2 ON gp2.model_id = m2.id
        JOIN public.games g ON gp1.game_id = g.id
        WHERE g.status = 'completed' AND COALESCE(g.rounds, 0) > 0 AND COALESCE(g.is_culled, false) = false
        GROUP BY slug_a, slug_b;
      `;

      const { rows } = await this.query(sql, [], client);

      for (const row of rows) {
        const key = `${row.slug_a}|||${row.slug_b}`;
        result.set(key, {
          matchesPlayed: parseInt(String(row.matches_played), 10),
          lastPlayedAt: row.last_played_at ? new Date(row.last_played_at).toISOString() : null,
        });
      }

      return result;
    } catch (error) {
      logRepoError('getPairingHistory', error);
      return result;
    }
  }
}
