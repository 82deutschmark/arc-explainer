/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27
 * PURPOSE: GameReadRepository - Handles all read operations for SnakeBench/Worm Arena matches and models.
 *          Provides search, recent games, activity stats, and history views.
 * SRP/DRY check: Pass - focused exclusively on data retrieval.
 */

import { PoolClient } from 'pg';
import { BaseRepository } from './base/BaseRepository.ts';
import {
  clampLimit,
  clampOffset,
  parseSqlDate,
  safeNumeric,
  SQL_NORMALIZE_SLUG,
  logRepoError,
} from './snakebenchSqlHelpers.ts';
import type {
  SnakeBenchGameSummary,
  SnakeBenchArcExplainerStats,
  SnakeBenchMatchSearchQuery,
  SnakeBenchMatchSearchRow,
  SnakeBenchModelMatchHistoryEntry,
  SnakeBenchResultLabel,
} from '../../shared/types.js';

export interface SnakeBenchRecentGamesResult {
  games: SnakeBenchGameSummary[];
  total: number;
}

export interface SnakeBenchMatchSearchResult {
  rows: SnakeBenchMatchSearchRow[];
  total: number;
}

export class GameReadRepository extends BaseRepository {
  /**
   * List all models in the system.
   */
  async listModels(client?: PoolClient): Promise<any[]> {
    if (!this.isConnected()) return [];
    const sql = `
      SELECT id, model_slug, name, provider, is_active, test_status, discovered_at, created_at
      FROM public.models
      ORDER BY name ASC
    `;
    const { rows } = await this.query(sql, [], client);
    return rows;
  }

  /**
   * Lightweight "recent games" summary.
   */
  async getRecentGames(limit: number = 20, client?: PoolClient): Promise<SnakeBenchRecentGamesResult> {
    if (!this.isConnected()) return { games: [], total: 0 };

    const safeLimit = clampLimit(limit);

    try {
      const listSql = `
        SELECT g.id AS game_id, g.start_time, g.total_score, g.rounds, g.replay_path
        FROM public.games g
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC
        LIMIT $1;
      `;

      const countSql = `SELECT COUNT(*) AS total FROM public.games`;

      const [listResult, countResult] = await Promise.all([
        this.query(listSql, [safeLimit], client),
        this.query(countSql, [], client),
      ]);

      const total = parseInt(String(countResult.rows[0]?.total ?? '0'), 10) || 0;

      const games: SnakeBenchGameSummary[] = listResult.rows.map((row: any) => {
        const replayPath = row.replay_path ?? null;
        const filename = replayPath ? String(replayPath).split(/[/\\]/).pop() ?? '' : '';
        const startedAt = row.start_time ? new Date(row.start_time).toISOString() : '';

        return {
          gameId: String(row.game_id),
          filename,
          startedAt,
          totalScore: safeNumeric(row.total_score),
          roundsPlayed: safeNumeric(row.rounds),
          path: replayPath ?? undefined,
        };
      });

      return { games, total };
    } catch (error) {
      logRepoError('getRecentGames', error);
      return { games: [], total: 0 };
    }
  }

  /**
   * Fetch the replay path for a single game.
   */
  async getReplayPath(gameId: string, client?: PoolClient): Promise<{ replayPath: string | null } | null> {
    if (!this.isConnected()) return null;
    try {
      const sql = `SELECT replay_path FROM public.games WHERE id = $1 LIMIT 1;`;
      const { rows } = await this.query(sql, [gameId], client);
      if (!rows.length) return null;
      return { replayPath: rows[0]?.replay_path ?? null };
    } catch (error) {
      logRepoError('getReplayPath', error);
      return null;
    }
  }

  /**
   * Complex match search with filters.
   */
  async searchMatches(query: SnakeBenchMatchSearchQuery, client?: PoolClient): Promise<SnakeBenchMatchSearchResult> {
    if (!this.isConnected()) return { rows: [], total: 0 };

    const model = String(query.model ?? '').trim();
    const opponent = query.opponent != null ? String(query.opponent).trim() : '';
    const result = query.result;
    const deathReason = query.deathReason;

    const limit = clampLimit(query.limit, 50);
    const offset = clampOffset(query.offset);
    const sortBy = query.sortBy ?? 'startedAt';
    const sortDir = (query.sortDir ?? 'desc') === 'asc' ? 'asc' : 'desc';

    const where: string[] = [`g.status = 'completed'`, `COALESCE(g.rounds, 0) > 0`];
    const params: any[] = [];

    if (model) {
      params.push(model);
      where.push(`${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$' + params.length)}`);
    }

    if (opponent) {
      params.push(`%${opponent}%`);
      where.push(`opp.model_slug ILIKE $${params.length}`);
    }

    if (['won', 'lost', 'tied'].includes(result as string)) {
      params.push(result);
      where.push(`gp.result = $${params.length}`);
    }

    if (['head_collision', 'body_collision', 'wall'].includes(deathReason as string)) {
      params.push(deathReason);
      where.push(`gp.death_reason = $${params.length}`);
    } else if (deathReason === 'survived') {
      where.push(`gp.death_reason IS NULL`);
    }

    const addNumFilter = (val: number | undefined, column: string, operator: string) => {
      const n = Number(val);
      if (Number.isFinite(n)) {
        params.push(operator === '>=' || operator === '<=' ? Math.max(0, n) : n);
        where.push(`COALESCE(${column}, 0) ${operator} $${params.length}`);
      }
    };

    addNumFilter(query.minRounds, 'g.rounds', '>=');
    addNumFilter(query.maxRounds, 'g.rounds', '<=');
    addNumFilter(query.minScore, 'gp.score', '>=');
    addNumFilter(query.maxScore, 'gp.score', '<=');
    addNumFilter(query.minCost, 'g.total_cost', '>=');
    addNumFilter(query.maxCost, 'g.total_cost', '<=');

    const fromDate = parseSqlDate(query.from);
    if (fromDate) {
      params.push(fromDate);
      where.push(`COALESCE(g.start_time, g.created_at) >= $${params.length}`);
    }

    const toDate = parseSqlDate(query.to);
    if (toDate) {
      params.push(toDate);
      where.push(`COALESCE(g.start_time, g.created_at) <= $${params.length}`);
    }

    const sortColumn = (() => {
      switch (sortBy) {
        case 'rounds': return `COALESCE(g.rounds, 0)`;
        case 'totalCost': return `COALESCE(g.total_cost, 0)`;
        case 'maxFinalScore': return `GREATEST(COALESCE(gp.score, 0), COALESCE(opp_gp.score, 0))`;
        case 'scoreDelta': return `ABS(COALESCE(gp.score, 0) - COALESCE(opp_gp.score, 0))`;
        case 'myScore': return `COALESCE(gp.score, 0)`;
        default: return `COALESCE(g.start_time, g.created_at, NOW())`;
      }
    })();

    const whereSql = `WHERE ${where.join(' AND ')}`;

    try {
      const listSql = `
        SELECT
          g.id AS game_id, COALESCE(g.start_time, g.created_at) AS started_at,
          COALESCE(g.rounds, 0) AS rounds_played, COALESCE(g.board_width, 0) AS board_width,
          COALESCE(g.board_height, 0) AS board_height, COALESCE(g.total_cost, 0) AS total_cost,
          COALESCE(gp.score, 0) AS my_score, COALESCE(opp_gp.score, 0) AS opponent_score,
          COALESCE(gp.result, 'tied') AS my_result, gp.death_reason,
          m.model_slug AS model_slug, COALESCE(opp.model_slug, '') AS opponent_slug
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        ${whereSql}
        ORDER BY ${sortColumn} ${sortDir}, g.id DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        ${whereSql};
      `;

      const [listResult, countResult] = await Promise.all([
        this.query(listSql, params, client),
        this.query(countSql, params, client),
      ]);

      const rows: SnakeBenchMatchSearchRow[] = listResult.rows.map((row: any) => ({
        gameId: String(row.game_id),
        startedAt: row.started_at ? new Date(row.started_at).toISOString() : '',
        model: model || String(row.model_slug),
        opponent: String(row.opponent_slug),
        result: row.my_result as SnakeBenchResultLabel,
        myScore: safeNumeric(row.my_score),
        opponentScore: safeNumeric(row.opponent_score),
        roundsPlayed: safeNumeric(row.rounds_played),
        totalCost: safeNumeric(row.total_cost),
        maxFinalScore: Math.max(safeNumeric(row.my_score), safeNumeric(row.opponent_score)),
        scoreDelta: Math.abs(safeNumeric(row.my_score) - safeNumeric(row.opponent_score)),
        boardWidth: safeNumeric(row.board_width),
        boardHeight: safeNumeric(row.board_height),
        deathReason: row.death_reason,
      }));

      return { rows, total: parseInt(String(countResult.rows[0]?.total ?? '0'), 10) || 0 };
    } catch (error) {
      logRepoError('searchMatches', error);
      return { rows: [], total: 0 };
    }
  }

  /**
   * Recent activity snapshot.
   */
  async getRecentActivity(days: number = 7, client?: PoolClient): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    if (!this.isConnected()) return { days, gamesPlayed: 0, uniqueModels: 0 };
    try {
      const isAllHistory = !Number.isFinite(days) || days <= 0;
      const safeDays = Math.max(1, Math.min(90, days));
      const sql = `
        SELECT COUNT(DISTINCT g.id) AS games_played, COUNT(DISTINCT m.model_slug) AS unique_models
        FROM public.games g
        LEFT JOIN public.game_participants gp ON g.id = gp.game_id
        LEFT JOIN public.models m ON gp.model_id = m.id
        ${isAllHistory ? '' : `WHERE g.created_at >= NOW() - (INTERVAL '1 day' * $1)`}
      `;
      const result = await this.query(sql, isAllHistory ? [] : [safeDays], client);
      const row = result.rows[0];
      return {
        days: isAllHistory ? 0 : safeDays,
        gamesPlayed: parseInt(String(row?.games_played ?? '0'), 10) || 0,
        uniqueModels: parseInt(String(row?.unique_models ?? '0'), 10) || 0,
      };
    } catch (error) {
      logRepoError('getRecentActivity', error);
      return { days, gamesPlayed: 0, uniqueModels: 0 };
    }
  }

  /**
   * Global SnakeBench stats for ARC Explainer.
   */
  async getArcExplainerStats(client?: PoolClient): Promise<SnakeBenchArcExplainerStats> {
    if (!this.isConnected()) return { totalGames: 0, activeModels: 0, topApples: 0, totalCost: 0 };
    try {
      const sql = `
        SELECT
          (SELECT COUNT(*) FROM public.games) AS total_games,
          (SELECT COUNT(DISTINCT model_id) FROM public.game_participants) AS active_models,
          (SELECT COALESCE(MAX(score), 0) FROM public.game_participants) AS top_apples,
          (SELECT COALESCE(SUM(cost), 0) FROM public.game_participants) AS total_cost
      `;
      const result = await this.query(sql, [], client);
      const row = result.rows[0] ?? {};
      return {
        totalGames: parseInt(String(row.total_games ?? '0'), 10) || 0,
        activeModels: parseInt(String(row.active_models ?? '0'), 10) || 0,
        topApples: safeNumeric(row.top_apples),
        totalCost: safeNumeric(row.total_cost),
      };
    } catch (error) {
      logRepoError('getArcExplainerStats', error);
      return { totalGames: 0, activeModels: 0, topApples: 0, totalCost: 0 };
    }
  }

  /**
   * List all models that have played at least one game.
   */
  async getModelsWithGames(client?: PoolClient): Promise<any[]> {
    if (!this.isConnected()) return [];
    try {
      const sql = `
        SELECT ${SQL_NORMALIZE_SLUG('m.model_slug')} AS model_slug,
               m.name AS model_name,
               COUNT(DISTINCT gp.game_id) AS games_played,
               COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
               COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
               COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
        FROM public.models m
        JOIN public.game_participants gp ON m.id = gp.model_id
        JOIN public.games g ON gp.game_id = g.id
        WHERE COALESCE(g.rounds, 0) > 0
        GROUP BY ${SQL_NORMALIZE_SLUG('m.model_slug')}, m.name
        HAVING COUNT(DISTINCT gp.game_id) > 0
        ORDER BY games_played DESC, model_slug ASC;
      `;
      const { rows } = await this.query(sql, [], client);

      // JS-side deduplication by normalized slug
      const slugMap = new Map<string, any>();

      for (const row of rows) {
        const slug = row.model_slug;
        if (!slugMap.has(slug)) {
          slugMap.set(slug, {
            modelSlug: slug,
            modelName: row.model_name || slug,
            gamesPlayed: parseInt(String(row.games_played), 10),
            wins: parseInt(String(row.wins), 10),
            losses: parseInt(String(row.losses), 10),
            ties: parseInt(String(row.ties), 10),
            winRate: row.games_played > 0 ? row.wins / row.games_played : 0,
          });
        } else {
          // Aggregate stats for duplicate slugs (e.g. model was renamed)
          const existing = slugMap.get(slug);
          existing.gamesPlayed += parseInt(String(row.games_played), 10);
          existing.wins += parseInt(String(row.wins), 10);
          existing.losses += parseInt(String(row.losses), 10);
          existing.ties += parseInt(String(row.ties), 10);
          existing.winRate = existing.gamesPlayed > 0 ? existing.wins / existing.games_played : 0;
          // Keep the first (likely most recent/accurate) name
        }
      }

      return Array.from(slugMap.values());
    } catch (error) {
      logRepoError('getModelsWithGames', error);
      return [];
    }
  }

  /**
   * Match history for a specific model (limited).
   */
  async getModelMatchHistory(modelSlug: string, limit: number = 50, client?: PoolClient): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    if (!this.isConnected() || !modelSlug) return [];
    const safeLimit = clampLimit(limit);
    try {
      const sql = `
        SELECT g.id AS game_id, g.start_time, g.created_at, g.rounds, g.board_width, g.board_height,
               gp.score AS my_score, gp.result AS my_result, gp.death_reason,
               opp.model_slug AS opponent_slug, opp_gp.score AS opponent_score
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        WHERE ${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC
        LIMIT $2;
      `;
      const { rows } = await this.query(sql, [modelSlug, safeLimit], client);
      return rows.map((row: any) => ({
        gameId: String(row.game_id),
        startedAt: (row.start_time ?? row.created_at) ? new Date(row.start_time ?? row.created_at).toISOString() : '',
        opponentSlug: row.opponent_slug || '',
        result: row.my_result as SnakeBenchResultLabel,
        myScore: safeNumeric(row.my_score),
        opponentScore: safeNumeric(row.opponent_score),
        rounds: safeNumeric(row.rounds),
        deathReason: row.death_reason,
        boardWidth: safeNumeric(row.board_width),
        boardHeight: safeNumeric(row.board_height),
      }));
    } catch (error) {
      logRepoError('getModelMatchHistory', error);
      return [];
    }
  }

  /**
   * Full match history for a specific model (unbounded).
   */
  async getModelMatchHistoryUnbounded(modelSlug: string, client?: PoolClient): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    if (!this.isConnected() || !modelSlug) return [];
    try {
      const sql = `
        SELECT g.id AS game_id, g.start_time, g.end_time, g.created_at, g.rounds, g.board_width, g.board_height,
               gp.score AS my_score, gp.result AS my_result, gp.death_reason, gp.cost AS my_cost,
               opp.model_slug AS opponent_slug, opp_gp.score AS opponent_score
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        WHERE ${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
          AND COALESCE(g.rounds, 0) > 0
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC;
      `;
      const { rows } = await this.query(sql, [modelSlug], client);
      return rows.map((row: any) => ({
        gameId: String(row.game_id),
        startedAt: (row.start_time ?? row.created_at) ? new Date(row.start_time ?? row.created_at).toISOString() : '',
        endedAt: row.end_time ? new Date(row.end_time).toISOString() : '',
        opponentSlug: row.opponent_slug || '',
        result: row.my_result as SnakeBenchResultLabel,
        myScore: safeNumeric(row.my_score),
        opponentScore: safeNumeric(row.opponent_score),
        rounds: safeNumeric(row.rounds),
        deathReason: row.death_reason,
        boardWidth: safeNumeric(row.board_width),
        boardHeight: safeNumeric(row.board_height),
        cost: safeNumeric(row.my_cost),
      }));
    } catch (error) {
      logRepoError('getModelMatchHistoryUnbounded', error);
      return [];
    }
  }
}
