/**
 * Author: Cascade
 * Date: 2025-12-09
 * PURPOSE: SnakeBenchRepository
 *          Handles compatibility-first persistence of SnakeBench games
 *          into PostgreSQL tables that mirror the root SnakeBench
 *          project schema (models, games, game_participants).
 * SRP/DRY check: Pass — focused exclusively on SnakeBench DB reads/writes.
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import type {
  SnakeBenchRunMatchResult,
  SnakeBenchGameSummary,
} from '../../shared/types.js';

export interface SnakeBenchRecordMatchParams {
  result: SnakeBenchRunMatchResult;
  width: number;
  height: number;
  numApples: number;
  gameType?: string;
}

export interface SnakeBenchRecentGamesResult {
  games: SnakeBenchGameSummary[];
  total: number;
}

export class SnakeBenchRepository extends BaseRepository {
  /**
   * Record a single SnakeBench match in the compatibility-first schema.
   *
   * This is designed so that rows can be merged with Greg's root
   * SnakeBench dataset without translation. It uses the canonical
   * tables from docs/SNAKE_BENCH_DB.md:
   *   - public.models
   *   - public.games
   *   - public.game_participants
   */
  async recordMatchFromResult(params: SnakeBenchRecordMatchParams): Promise<void> {
    if (!this.isConnected()) {
      // DB is optional; skip persistence in fallback mode.
      return;
    }

    const { result, width, height, numApples } = params;
    const gameId = result.gameId;

    if (!gameId || !result.modelA || !result.modelB) {
      logger.warn('SnakeBenchRepository.recordMatchFromResult: missing gameId/model names, skipping DB write', 'snakebench-db');
      return;
    }

    const gameType = params.gameType ?? 'arc-explainer';

    // Compute simple aggregates from the result we already have.
    const scores = result.scores || {};
    const scoreA = Number.isFinite(scores[result.modelA] as number) ? (scores[result.modelA] as number) : 0;
    const scoreB = Number.isFinite(scores[result.modelB] as number) ? (scores[result.modelB] as number) : 0;
    const totalScore = scoreA + scoreB;

    const resultsByModel = result.results || {};
    const statusA = resultsByModel[result.modelA] ?? null;
    const statusB = resultsByModel[result.modelB] ?? null;

    const now = new Date();

    try {
      await this.transaction(async (client) => {
        // Upsert models by model_slug so we stay aligned with root SnakeBench.
        const getOrCreateModel = async (modelSlug: string): Promise<number | null> => {
          if (!modelSlug) return null;

          const provider = 'OpenRouter';
          const name = modelSlug;

          const insertSql = `
            INSERT INTO public.models (name, provider, model_slug, is_active, test_status)
            VALUES ($1, $2, $3, TRUE, 'arc-explainer')
            ON CONFLICT (model_slug) DO UPDATE
              SET name = EXCLUDED.name
            RETURNING id;
          `;

          const { rows } = await client.query(insertSql, [name, provider, modelSlug]);
          if (!rows.length) return null;
          return rows[0].id as number;
        };

        const modelAId = await getOrCreateModel(result.modelA);
        const modelBId = await getOrCreateModel(result.modelB);

        // Insert game row — minimal fields only, but schema-compatible.
        const insertGameSql = `
          INSERT INTO public.games (
            id,
            status,
            start_time,
            end_time,
            rounds,
            replay_path,
            board_width,
            board_height,
            num_apples,
            total_score,
            total_cost,
            game_type,
            current_state
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING;
        `;

        const replayPath = result.completedGamePath ?? null;

        await client.query(insertGameSql, [
          gameId,
          'completed',
          now,
          now,
          null, // rounds (we do not have actual rounds yet)
          replayPath,
          width,
          height,
          numApples,
          totalScore,
          0.0, // total_cost — cost accounting is handled elsewhere
          gameType,
          null, // current_state — not tracked in ARC Explainer
        ]);

        // Insert participants if we have corresponding model ids.
        const insertParticipantSql = `
          INSERT INTO public.game_participants (
            game_id,
            model_id,
            player_slot,
            score,
            result,
            death_round,
            death_reason,
            cost,
            opponent_rank_at_match
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (game_id, player_slot) DO NOTHING;
        `;

        if (modelAId != null) {
          await client.query(insertParticipantSql, [
            gameId,
            modelAId,
            0,
            scoreA,
            statusA,
            null,
            null,
            0.0,
            null,
          ]);
        }

        if (modelBId != null) {
          await client.query(insertParticipantSql, [
            gameId,
            modelBId,
            1,
            scoreB,
            statusB,
            null,
            null,
            0.0,
            null,
          ]);
        }
      });
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.recordMatchFromResult: failed to persist game ${gameId}: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      // Swallow errors so SnakeBench HTTP requests are never blocked by DB issues.
    }
  }

  /**
   * Lightweight "recent games" summary used by Phase III.
   *
   * Returns a structure compatible with SnakeBenchGameSummary so existing
   * frontend components can consume it with minimal changes.
   */
  async getRecentGames(limit: number = 20): Promise<SnakeBenchRecentGamesResult> {
    if (!this.isConnected()) {
      return { games: [], total: 0 };
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20;

    try {
      const listSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.total_score,
          g.rounds,
          g.replay_path
        FROM public.games g
        WHERE g.game_type = 'arc-explainer'
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC
        LIMIT $1;
      `;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM public.games
        WHERE game_type = 'arc-explainer';
      `;

      const [listResult, countResult] = await Promise.all([
        this.query(listSql, [safeLimit]),
        this.query(countSql),
      ]);

      const total = parseInt((countResult.rows[0]?.total as string) ?? '0', 10) || 0;

      const games: SnakeBenchGameSummary[] = listResult.rows.map((row: any) => {
        const replayPath: string | null = row.replay_path ?? null;
        const filename = replayPath ? String(replayPath).split(/[/\\]/).pop() ?? '' : '';
        const startedAt = row.start_time ? new Date(row.start_time).toISOString() : '';

        const rounds = row.rounds != null ? Number(row.rounds) : 0;
        const totalScore = row.total_score != null ? Number(row.total_score) : 0;

        return {
          gameId: String(row.game_id),
          filename,
          startedAt,
          totalScore,
          roundsPlayed: rounds,
          path: replayPath ?? undefined,
        };
      });

      return { games, total };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getRecentGames: query failed, falling back to filesystem in service: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return { games: [], total: 0 };
    }
  }

  /**
   * Recent activity snapshot: games played in the last N days.
   */
  async getRecentActivity(days: number = 7): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    if (!this.isConnected()) {
      return { days, gamesPlayed: 0, uniqueModels: 0 };
    }

    try {
      const sql = `
        SELECT
          COUNT(DISTINCT g.id) AS games_played,
          COUNT(DISTINCT m.model_slug) AS unique_models
        FROM public.games g
        LEFT JOIN public.game_participants gp ON g.id = gp.game_id
        LEFT JOIN public.models m ON gp.model_id = m.id
        WHERE g.game_type = 'arc-explainer'
          AND g.created_at >= NOW() - INTERVAL '${Math.max(1, days)} days';
      `;

      const result = await this.query(sql);
      const row = result.rows[0];

      return {
        days,
        gamesPlayed: parseInt((row?.games_played as string) ?? '0', 10) || 0,
        uniqueModels: parseInt((row?.unique_models as string) ?? '0', 10) || 0,
      };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getRecentActivity: query failed: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return { days, gamesPlayed: 0, uniqueModels: 0 };
    }
  }

  /**
   * Basic local leaderboard: top N models by games played or local win rate.
   */
  async getBasicLeaderboard(limit: number = 10, sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed'): Promise<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>> {
    if (!this.isConnected()) {
      return [];
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 10;

    try {
      let sql = '';
      let orderBy = '';

      if (sortBy === 'winRate') {
        sql = `
          SELECT
            m.model_slug,
            COUNT(gp.game_id) AS games_played,
            COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
            COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
            COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
          FROM public.models m
          JOIN public.game_participants gp ON m.id = gp.model_id
          JOIN public.games g ON gp.game_id = g.id
          WHERE g.game_type = 'arc-explainer'
          GROUP BY m.model_slug
          HAVING COUNT(gp.game_id) > 0
          ORDER BY (COUNT(CASE WHEN gp.result = 'won' THEN 1 END)::float / NULLIF(COUNT(gp.game_id), 0)) DESC NULLS LAST
          LIMIT $1;
        `;
      } else {
        sql = `
          SELECT
            m.model_slug,
            COUNT(gp.game_id) AS games_played,
            COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
            COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
            COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
          FROM public.models m
          JOIN public.game_participants gp ON m.id = gp.model_id
          JOIN public.games g ON gp.game_id = g.id
          WHERE g.game_type = 'arc-explainer'
          GROUP BY m.model_slug
          HAVING COUNT(gp.game_id) > 0
          ORDER BY games_played DESC
          LIMIT $1;
        `;
      }

      const result = await this.query(sql, [safeLimit]);

      return result.rows.map((row: any) => {
        const gamesPlayed = parseInt((row?.games_played as string) ?? '0', 10) || 0;
        const wins = parseInt((row?.wins as string) ?? '0', 10) || 0;
        const losses = parseInt((row?.losses as string) ?? '0', 10) || 0;
        const ties = parseInt((row?.ties as string) ?? '0', 10) || 0;
        const winRate = gamesPlayed > 0 ? wins / gamesPlayed : undefined;

        return {
          modelSlug: String(row?.model_slug ?? ''),
          gamesPlayed,
          wins,
          losses,
          ties,
          ...(sortBy === 'winRate' ? { winRate } : {}),
        };
      });
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getBasicLeaderboard: query failed: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return [];
    }
  }
}
