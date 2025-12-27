/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-27
 * PURPOSE: SnakeBenchRepository
 *          Handles compatibility-first persistence of SnakeBench games
 *          into PostgreSQL tables that mirror the root SnakeBench
 *          project schema (models, games, game_participants).
 *          IMPORTANT: Worm Arena analytics (TrueSkill leaderboard, model ratings,
 *          global stats) must include all games regardless of upstream game_type.
 *          To prevent analytics pages from appearing empty, this repository:
 *          - Allows replay ingest to override or standardize game_type for ARC Explainer.
 *          - Avoids filtering analytics queries by game_type.
 *          Exposes model discovery timestamps for Worm Arena UI sorting.
 *          Adds per-model insights aggregation for the Models page.
 * SRP/DRY check: Pass - focused exclusively on SnakeBench DB reads and writes.
 */

import fs from 'fs';
import path from 'path';
import { Rating, TrueSkill } from 'ts-trueskill';

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import type {
  SnakeBenchRunMatchResult,
  SnakeBenchGameSummary,
  SnakeBenchArcExplainerStats,
  SnakeBenchModelRating,
  SnakeBenchModelMatchHistoryEntry,
  SnakeBenchResultLabel,
  SnakeBenchTrueSkillLeaderboardEntry,
  WormArenaGreatestHitGame,
  SnakeBenchMatchSearchQuery,
  SnakeBenchMatchSearchRow,
  WormArenaModelInsightsSummary,
  WormArenaModelInsightsFailureMode,
  WormArenaModelInsightsOpponent,
  WormArenaRunLengthDistributionData,
  WormArenaRunLengthModelData,
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

export interface SnakeBenchMatchSearchResult {
  rows: SnakeBenchMatchSearchRow[];
  total: number;
}

const DEFAULT_TRUESKILL_MU = 25.0;
const DEFAULT_TRUESKILL_SIGMA = DEFAULT_TRUESKILL_MU / 3.0;
const DEFAULT_TRUESKILL_BETA = DEFAULT_TRUESKILL_MU / 6.0;
const DEFAULT_TRUESKILL_TAU = 0.5;
const DEFAULT_TRUESKILL_DRAW_PROBABILITY = 0.1;
const TRUESKILL_DISPLAY_MULTIPLIER = 50.0;

const ELO_K = 32;
const RESULT_RANK: Record<string, number> = { won: 0, tied: 1, lost: 2 };
const RESULT_SCORE: Record<string, [number, number]> = {
  won: [1, 0],
  lost: [0, 1],
  tied: [0.5, 0.5],
};

export class SnakeBenchRepository extends BaseRepository {
  async listModels(): Promise<
    Array<{
      id: number;
      model_slug: string;
      name: string;
      provider: string;
      is_active: boolean;
      test_status: string;
      discovered_at?: string | Date | null;
      created_at?: string | Date | null;
    }>
  > {
    if (!this.isConnected()) return [];
    const sql = `
      SELECT id, model_slug, name, provider, is_active, test_status, discovered_at, created_at
      FROM public.models
      ORDER BY name ASC
    `;
    const { rows } = await this.query(sql);
    return rows as any[];
  }

  async upsertModels(
    models: Array<{ modelSlug: string; name?: string; provider?: string; isActive?: boolean; testStatus?: string }>
  ): Promise<{ inserted: number; updated: number }> {
    if (!this.isConnected() || models.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    let inserted = 0;
    let updated = 0;

    await this.transaction(async (client) => {
      for (const m of models) {
        const name = m.name ?? m.modelSlug;
        const provider = m.provider ?? 'OpenRouter';
        const isActive = m.isActive ?? true;
        const testStatus = m.testStatus ?? 'untested';
        const sql = `
          INSERT INTO public.models (name, provider, model_slug, is_active, test_status)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (model_slug) DO UPDATE
            SET name = EXCLUDED.name,
                provider = EXCLUDED.provider,
                is_active = EXCLUDED.is_active
          RETURNING xmax = 0 AS inserted_flag;
        `;
        const { rows } = await client.query(sql, [name, provider, m.modelSlug, isActive, testStatus]);
        const wasInserted = rows?.[0]?.inserted_flag === true;
        if (wasInserted) inserted += 1;
        else updated += 1;
      }
    });

    return { inserted, updated };
  }

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

    // If we have a completed replay file, ingest the full parity data path instead of the minimal summary.
    if (result.completedGamePath) {
      try {
        await this.ingestReplayFromFile(result.completedGamePath, { gameTypeOverride: gameType });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`SnakeBenchRepository.recordMatchFromResult: full replay ingest failed, falling back to minimal insert: ${msg}`, 'snakebench-db');
      }
    }

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
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC
        LIMIT $1;
      `;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM public.games
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

  async searchMatches(query: SnakeBenchMatchSearchQuery): Promise<SnakeBenchMatchSearchResult> {
    if (!this.isConnected()) {
      return { rows: [], total: 0 };
    }

    const model = String(query.model ?? '').trim();
    // Model is now optional - can search across all models

    const opponent = query.opponent != null ? String(query.opponent).trim() : '';
    const result = query.result;
    const deathReason = query.deathReason;

    // Parse numeric filters
    const parseNum = (val: number | undefined): number | undefined => {
      if (val == null) return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : undefined;
    };

    const minRounds = parseNum(query.minRounds);
    const maxRounds = parseNum(query.maxRounds);
    const minScore = parseNum(query.minScore);
    const maxScore = parseNum(query.maxScore);
    const minCost = parseNum(query.minCost);
    const maxCost = parseNum(query.maxCost);

    const limitRaw = query.limit != null ? Number(query.limit) : 50;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 50;

    const offsetRaw = query.offset != null ? Number(query.offset) : 0;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const sortBy = query.sortBy ?? 'startedAt';
    const sortDir = (query.sortDir ?? 'desc') === 'asc' ? 'asc' : 'desc';

    const where: string[] = [];
    const params: any[] = [];

    // Model filter (optional now)
    if (model) {
      params.push(model);
      where.push(`regexp_replace(m.model_slug, ':free$', '') = regexp_replace($${params.length}, ':free$', '')`);
    }
    where.push(`g.status = 'completed'`);

    if (opponent) {
      params.push(`%${opponent}%`);
      where.push(`opp.model_slug ILIKE $${params.length}`);
    }

    if (result === 'won' || result === 'lost' || result === 'tied') {
      params.push(result);
      where.push(`gp.result = $${params.length}`);
    }

    // Death reason filter
    if (deathReason === 'head_collision' || deathReason === 'body_collision' || deathReason === 'wall') {
      params.push(deathReason);
      where.push(`gp.death_reason = $${params.length}`);
    } else if (deathReason === 'survived') {
      where.push(`gp.death_reason IS NULL`);
    }

    if (minRounds != null) {
      params.push(Math.max(0, Math.floor(minRounds)));
      where.push(`COALESCE(g.rounds, 0) >= $${params.length}`);
    }

    if (maxRounds != null) {
      params.push(Math.max(0, Math.floor(maxRounds)));
      where.push(`COALESCE(g.rounds, 0) <= $${params.length}`);
    }

    // Score filters (on my_score)
    if (minScore != null) {
      params.push(Math.max(0, Math.floor(minScore)));
      where.push(`COALESCE(gp.score, 0) >= $${params.length}`);
    }

    if (maxScore != null) {
      params.push(Math.max(0, Math.floor(maxScore)));
      where.push(`COALESCE(gp.score, 0) <= $${params.length}`);
    }

    // Cost filters
    if (minCost != null) {
      params.push(Math.max(0, minCost));
      where.push(`COALESCE(g.total_cost, 0) >= $${params.length}`);
    }

    if (maxCost != null) {
      params.push(Math.max(0, maxCost));
      where.push(`COALESCE(g.total_cost, 0) <= $${params.length}`);
    }

    const parseDate = (value: string | undefined): Date | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber) && asNumber > 0) {
        const d = new Date(asNumber);
        return Number.isFinite(d.getTime()) ? d : null;
      }
      const d = new Date(trimmed);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const fromDate = parseDate(query.from);
    if (fromDate) {
      params.push(fromDate);
      where.push(`COALESCE(g.start_time, g.created_at) >= $${params.length}`);
    }

    const toDate = parseDate(query.to);
    if (toDate) {
      params.push(toDate);
      where.push(`COALESCE(g.start_time, g.created_at) <= $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sortColumn = (() => {
      switch (sortBy) {
        case 'rounds':
          return `COALESCE(g.rounds, 0)`;
        case 'totalCost':
          return `COALESCE(g.total_cost, 0)`;
        case 'maxFinalScore':
          return `GREATEST(COALESCE(gp.score, 0), COALESCE(opp_gp.score, 0))`;
        case 'scoreDelta':
          return `ABS(COALESCE(gp.score, 0) - COALESCE(opp_gp.score, 0))`;
        case 'myScore':
          return `COALESCE(gp.score, 0)`;
        case 'startedAt':
        default:
          return `COALESCE(g.start_time, g.created_at, NOW())`;
      }
    })();

    try {
      const listSql = `
        SELECT
          g.id AS game_id,
          COALESCE(g.start_time, g.created_at) AS started_at,
          COALESCE(g.rounds, 0) AS rounds_played,
          COALESCE(g.board_width, 0) AS board_width,
          COALESCE(g.board_height, 0) AS board_height,
          COALESCE(g.total_cost, 0) AS total_cost,
          COALESCE(gp.score, 0) AS my_score,
          COALESCE(opp_gp.score, 0) AS opponent_score,
          COALESCE(gp.result, 'tied') AS my_result,
          gp.death_reason,
          m.model_slug AS model_slug,
          COALESCE(opp.model_slug, '') AS opponent_slug
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp
          ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
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
        LEFT JOIN public.game_participants opp_gp
          ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        ${whereSql};
      `;

      const [listResult, countResult] = await Promise.all([
        this.query(listSql, params),
        this.query(countSql, params),
      ]);

      const total = parseInt((countResult.rows[0]?.total as string) ?? '0', 10) || 0;

      const rows: SnakeBenchMatchSearchRow[] = (listResult.rows ?? []).map((row: any) => {
        const myScore = Number(row.my_score ?? 0) || 0;
        const opponentScore = Number(row.opponent_score ?? 0) || 0;
        const maxFinalScore = Math.max(myScore, opponentScore);
        const scoreDelta = Math.abs(myScore - opponentScore);

        const startedAt = row.started_at ? new Date(row.started_at).toISOString() : '';
        const resultLabelRaw = String(row.my_result ?? 'tied') as SnakeBenchResultLabel;
        const resultLabel: SnakeBenchResultLabel =
          resultLabelRaw === 'won' || resultLabelRaw === 'lost' || resultLabelRaw === 'tied' ? resultLabelRaw : 'tied';

        // Parse death reason - null means survived (no death)
        const deathReasonRaw = row.death_reason ? String(row.death_reason) : null;
        const deathReasonParsed = deathReasonRaw === 'head_collision' || deathReasonRaw === 'body_collision' || deathReasonRaw === 'wall'
          ? deathReasonRaw
          : null;

        return {
          gameId: String(row.game_id ?? ''),
          startedAt,
          model: model || String(row.model_slug ?? ''),
          opponent: String(row.opponent_slug ?? ''),
          result: resultLabel,
          myScore,
          opponentScore,
          roundsPlayed: Number(row.rounds_played ?? 0) || 0,
          totalCost: Number(row.total_cost ?? 0) || 0,
          maxFinalScore,
          scoreDelta,
          boardWidth: Number(row.board_width ?? 0) || 0,
          boardHeight: Number(row.board_height ?? 0) || 0,
          deathReason: deathReasonParsed,
        };
      });

      return { rows, total };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.searchMatches: query failed for ${model}: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return { rows: [], total: 0 };
    }
  }

  /**
   * Recent activity snapshot: games played in the last N days.
   * When days <= 0, returns all-time activity.
   */
  async getRecentActivity(days: number = 7): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    if (!this.isConnected()) {
      return { days, gamesPlayed: 0, uniqueModels: 0 };
    }

    try {
      // All-history mode: no date filter
      if (!Number.isFinite(days) || days <= 0) {
        const sqlAll = `
          SELECT
            COUNT(DISTINCT g.id) AS games_played,
            COUNT(DISTINCT m.model_slug) AS unique_models
          FROM public.games g
          LEFT JOIN public.game_participants gp ON g.id = gp.game_id
          LEFT JOIN public.models m ON gp.model_id = m.id
        `;

        const result = await this.query(sqlAll);
        const row = result.rows[0];

        return {
          days: 0,
          gamesPlayed: parseInt((row?.games_played as string) ?? '0', 10) || 0,
          uniqueModels: parseInt((row?.unique_models as string) ?? '0', 10) || 0,
        };
      }

      const safeDays = Math.max(1, Math.min(90, days)); // Clamp to 1-90
      const sql = `
        SELECT
          COUNT(DISTINCT g.id) AS games_played,
          COUNT(DISTINCT m.model_slug) AS unique_models
        FROM public.games g
        LEFT JOIN public.game_participants gp ON g.id = gp.game_id
        LEFT JOIN public.models m ON gp.model_id = m.id
        WHERE g.created_at >= NOW() - (INTERVAL '1 day' * $1);
      `;

      const result = await this.query(sql, [safeDays]);
      const row = result.rows[0];

      return {
        days: safeDays,
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

  async getArcExplainerStats(): Promise<SnakeBenchArcExplainerStats> {
    if (!this.isConnected()) {
      return { totalGames: 0, activeModels: 0, topApples: 0, totalCost: 0 };
    }

    try {
      const sql = `
        SELECT
          (SELECT COUNT(*) FROM public.games g) AS total_games,
          (
            SELECT COUNT(DISTINCT m.model_slug)
            FROM public.models m
            JOIN public.game_participants gp ON m.id = gp.model_id
            JOIN public.games g2 ON gp.game_id = g2.id
          ) AS active_models,
          (
            SELECT COALESCE(MAX(gp2.score), 0)
            FROM public.game_participants gp2
            JOIN public.games g3 ON gp2.game_id = g3.id
          ) AS top_apples,
          (
            SELECT COALESCE(SUM(gp3.cost), 0)
            FROM public.game_participants gp3
            JOIN public.games g4 ON gp3.game_id = g4.id
          ) AS total_cost;
      `;

      const result = await this.query(sql);
      const row = result.rows[0] ?? {};

      const totalGames = parseInt(String(row.total_games ?? '0'), 10) || 0;
      const activeModels = parseInt(String(row.active_models ?? '0'), 10) || 0;
      const topApples = Number(row.top_apples ?? 0) || 0;
      const totalCost = Number(row.total_cost ?? 0) || 0;

      return { totalGames, activeModels, topApples, totalCost };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getArcExplainerStats: query failed: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return { totalGames: 0, activeModels: 0, topApples: 0, totalCost: 0 };
    }
  }

  /**
   * Greatest-hits selector for Worm Arena.
   *
   * Uses multiple leaderboards over completed games:
   * - Longest by rounds played (rounds >= 20)
   * - Most expensive by total_cost (cost > $0.01, rounds >= 5)
   * - Highest scoring by max per-player score (rounds >= 5)
   * - Monster apple hauls (any player with 25+ apples)
   *
   * Then merges/deduplicates the results into a compact list of
   * WormArenaGreatestHitGame entries with human-readable highlight reasons.
   */
  async getWormArenaGreatestHits(limitPerDimension: number = 5): Promise<WormArenaGreatestHitGame[]> {
    if (!this.isConnected()) {
      logger.warn(
        'SnakeBenchRepository.getWormArenaGreatestHits: database not connected, returning empty list',
        'snakebench-db',
      );
      return [];
    }

    const rawLimit = Number(limitPerDimension);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 10)) : 5;
    const MAX_TOTAL = 20;

    try {
      const roundsSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND COALESCE(g.rounds, 0) >= 20
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING MAX(gp.score) > 0 OR g.total_cost > 0
        ORDER BY COALESCE(g.rounds, 0) DESC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      const costSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND COALESCE(g.rounds, 0) >= 5
          AND g.total_cost >= 0.010
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING MAX(gp.score) > 0 OR g.total_cost > 0
        ORDER BY g.total_cost DESC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      const scoreSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND COALESCE(g.rounds, 0) >= 5
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING MAX(gp.score) > 0 OR g.total_cost > 0
        ORDER BY MAX(gp.score) DESC, COALESCE(g.rounds, 0) DESC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      // NEW: Duration query (longest wall-clock games)
      const durationSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b,
          EXTRACT(EPOCH FROM (g.end_time - g.start_time)) AS duration_seconds
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND g.start_time IS NOT NULL
          AND g.end_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (g.end_time - g.start_time)) >= 60
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING MAX(gp.score) > 0 OR g.total_cost > 0
        ORDER BY duration_seconds DESC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      // NEW: Total score query (highest combined apples from both players)
      const totalScoreSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND COALESCE(g.rounds, 0) >= 5
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING SUM(gp.score) >= 10
        ORDER BY SUM(gp.score) DESC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      // NEW: Close matches query (photo finishes with score delta <= 2)
      const closeMatchesSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND COALESCE(g.rounds, 0) >= 5
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING ABS(
          COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
          COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
        ) <= 2
        AND MAX(gp.score) >= 5
        ORDER BY MAX(gp.score) DESC, score_delta ASC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      const applesHaulSql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.rounds AS rounds_played,
          g.board_width,
          g.board_height,
          g.total_cost,
          MAX(gp.score) AS max_final_score,
          SUM(gp.score) AS sum_final_scores,
          ABS(
            COALESCE(MAX(CASE WHEN gp.player_slot = 0 THEN gp.score END), 0) -
            COALESCE(MAX(CASE WHEN gp.player_slot = 1 THEN gp.score END), 0)
          ) AS score_delta,
          MAX(CASE WHEN gp.player_slot = 0 THEN m.model_slug END) AS model_a,
          MAX(CASE WHEN gp.player_slot = 1 THEN m.model_slug END) AS model_b
        FROM public.games g
        JOIN public.game_participants gp ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
          AND COALESCE(g.rounds, 0) >= 5
        GROUP BY g.id, g.start_time, g.end_time, g.rounds, g.board_width, g.board_height, g.total_cost
        HAVING MAX(gp.score) >= 25
        ORDER BY MAX(gp.score) DESC, COALESCE(g.start_time, NOW()) DESC
        LIMIT $1;
      `;

      const [
        roundsResult,
        costResult,
        scoreResult,
        durationResult,
        totalScoreResult,
        closeMatchesResult,
        applesHaulResult,
      ] = await Promise.all([
        this.query(roundsSql, [safeLimit]),
        this.query(costSql, [safeLimit]),
        this.query(scoreSql, [safeLimit]),
        this.query(durationSql, [safeLimit]),
        this.query(totalScoreSql, [safeLimit]),
        this.query(closeMatchesSql, [safeLimit]),
        this.query(applesHaulSql, [safeLimit]),
      ]);

      const seen = new Map<string, WormArenaGreatestHitGame>();
      const ordered: WormArenaGreatestHitGame[] = [];

      const addGameFromRow = (
        row: any,
        dimension: 'rounds' | 'cost' | 'score' | 'duration' | 'total_score' | 'close_match' | 'apples_25_plus',
      ) => {
        const gameId = String(row.game_id ?? row.id ?? '').trim();
        if (!gameId || seen.has(gameId)) return;

        const roundsPlayed = Number(row.rounds_played ?? row.rounds ?? 0) || 0;
        const totalCost = Number(row.total_cost ?? 0) || 0;
        const maxFinalScore = Number(row.max_final_score ?? 0) || 0;
        const scoreDelta = Number(row.score_delta ?? 0) || 0;
        const boardWidth = Number(row.board_width ?? 0) || 0;
        const boardHeight = Number(row.board_height ?? 0) || 0;
        const sumFinalScores = Number(row.sum_final_scores ?? 0) || 0;
        const durationSeconds = Number(row.duration_seconds ?? 0) || 0;

        const startTs = row.start_time ?? null;
        const startedAt = startTs ? new Date(startTs).toISOString() : '';

        const endTs = row.end_time ?? null;
        const endedAt = endTs ? new Date(endTs).toISOString() : undefined;

        const modelA = String(row.model_a ?? '').trim();
        const modelB = String(row.model_b ?? '').trim();

        // Guardrails: skip trivial or malformed games
        if (!modelA || !modelB) return;
        if (roundsPlayed <= 0) return;
        if (maxFinalScore <= 0 && totalCost <= 0) return;

        // We currently don't persist max_rounds in the DB, so we approximate
        // using the actual rounds played. This still makes the UI readable
        // (e.g., "42 / 42 rounds").
        const maxRounds = roundsPlayed;

        let highlightReason: string;
        let category: string;

        if (dimension === 'rounds') {
          category = 'longest_rounds';
          if (roundsPlayed >= 50) {
            highlightReason = 'Epic long game (50+ rounds)';
          } else if (roundsPlayed >= 40) {
            highlightReason = 'Very long game (40+ rounds)';
          } else {
            highlightReason = 'Long game (20+ rounds)';
          }
        } else if (dimension === 'cost') {
          category = 'highest_cost';
          if (totalCost >= 1) {
            highlightReason = 'Extremely expensive match (>$1)';
          } else if (totalCost >= 0.25) {
            highlightReason = 'High-cost match (>$0.25)';
          } else {
            highlightReason = 'Expensive match (>$0.01)';
          }
        } else if (dimension === 'score') {
          category = 'highest_score';
          if (maxFinalScore >= 15) {
            highlightReason = 'Highest-scoring match (15+ apples)';
          } else if (maxFinalScore >= 10) {
            highlightReason = 'Big scoring match (10+ apples)';
          } else {
            highlightReason = 'Notable scoring match';
          }
        } else if (dimension === 'duration') {
          category = 'longest_duration';
          const hours = Math.floor(durationSeconds / 3600);
          const minutes = Math.floor((durationSeconds % 3600) / 60);
          if (hours >= 2) {
            highlightReason = `Marathon duration (${hours}h ${minutes}m)`;
          } else if (hours >= 1) {
            highlightReason = `Long duration (${hours}h ${minutes}m)`;
          } else {
            highlightReason = `Extended duration (${minutes}m)`;
          }
        } else if (dimension === 'total_score') {
          category = 'highest_total_score';
          if (sumFinalScores >= 30) {
            highlightReason = `Epic combined score (${sumFinalScores} apples)`;
          } else if (sumFinalScores >= 20) {
            highlightReason = `High combined score (${sumFinalScores} apples)`;
          } else {
            highlightReason = `Combined score (${sumFinalScores} apples)`;
          }
        } else if (dimension === 'apples_25_plus') {
          category = 'apples_25_plus';
          if (maxFinalScore >= 35) {
            highlightReason = `Monster apple haul (${maxFinalScore} apples by one player)`;
          } else if (maxFinalScore >= 30) {
            highlightReason = `Huge apple haul (${maxFinalScore} apples by one player)`;
          } else {
            highlightReason = `25+ apples by one player`;
          }
        } else {
          // close_match
          category = 'close_match';
          if (scoreDelta === 0) {
            highlightReason = 'Perfect tie';
          } else if (scoreDelta === 1) {
            highlightReason = 'Photo finish (1 apple difference)';
          } else {
            highlightReason = `Neck-and-neck (${scoreDelta} apple difference)`;
          }
        }

        const game: WormArenaGreatestHitGame = {
          gameId,
          startedAt,
          endedAt,
          modelA,
          modelB,
          roundsPlayed,
          maxRounds,
          totalCost,
          maxFinalScore,
          scoreDelta,
          boardWidth,
          boardHeight,
          highlightReason,
          sumFinalScores: sumFinalScores > 0 ? sumFinalScores : undefined,
          durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
          category,
        };

        seen.set(gameId, game);
        ordered.push(game);
      };

      // Priority: long games first, then expensive, then scoring, then new dimensions
      for (const row of roundsResult.rows ?? []) {
        addGameFromRow(row, 'rounds');
        if (ordered.length >= MAX_TOTAL) break;
      }

      if (ordered.length < MAX_TOTAL) {
        for (const row of costResult.rows ?? []) {
          addGameFromRow(row, 'cost');
          if (ordered.length >= MAX_TOTAL) break;
        }
      }

      if (ordered.length < MAX_TOTAL) {
        for (const row of scoreResult.rows ?? []) {
          addGameFromRow(row, 'score');
          if (ordered.length >= MAX_TOTAL) break;
        }
      }

      if (ordered.length < MAX_TOTAL) {
        for (const row of durationResult.rows ?? []) {
          addGameFromRow(row, 'duration');
          if (ordered.length >= MAX_TOTAL) break;
        }
      }

      if (ordered.length < MAX_TOTAL) {
        for (const row of totalScoreResult.rows ?? []) {
          addGameFromRow(row, 'total_score');
          if (ordered.length >= MAX_TOTAL) break;
        }
      }

      if (ordered.length < MAX_TOTAL) {
        for (const row of closeMatchesResult.rows ?? []) {
          addGameFromRow(row, 'close_match');
          if (ordered.length >= MAX_TOTAL) break;
        }
      }

      if (ordered.length < MAX_TOTAL) {
        for (const row of applesHaulResult.rows ?? []) {
          addGameFromRow(row, 'apples_25_plus');
          if (ordered.length >= MAX_TOTAL) break;
        }
      }

      return ordered.slice(0, MAX_TOTAL);
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getWormArenaGreatestHits: query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return [];
    }
  }

  async getModelRating(modelSlug: string): Promise<SnakeBenchModelRating | null> {
    if (!this.isConnected()) {
      return null;
    }

    if (!modelSlug) {
      return null;
    }

    try {
      const sql = `
        SELECT
          m.model_slug,
          m.trueskill_mu,
          m.trueskill_sigma,
          m.trueskill_exposed,
          m.wins,
          m.losses,
          m.ties,
          m.apples_eaten,
          m.games_played,
          m.is_active,
          COALESCE(SUM(gp.cost), 0) AS total_cost
        FROM public.models m
        JOIN public.game_participants gp ON m.id = gp.model_id
        JOIN public.games g ON gp.game_id = g.id
        WHERE regexp_replace(m.model_slug, ':free$', '') = regexp_replace($1, ':free$', '')
        GROUP BY
          m.model_slug,
          m.trueskill_mu,
          m.trueskill_sigma,
          m.trueskill_exposed,
          m.wins,
          m.losses,
          m.ties,
          m.apples_eaten,
          m.games_played,
          m.is_active
        ORDER BY m.games_played DESC
        LIMIT 1;
      `;

      const result = await this.query(sql, [modelSlug]);
      if (!result.rows.length) {
        return null;
      }

      const row: any = result.rows[0];

      const mu = typeof row.trueskill_mu === 'number' ? row.trueskill_mu : DEFAULT_TRUESKILL_MU;
      const sigma = typeof row.trueskill_sigma === 'number' ? row.trueskill_sigma : DEFAULT_TRUESKILL_SIGMA;
      const exposedRaw = typeof row.trueskill_exposed === 'number' ? row.trueskill_exposed : undefined;
      const exposed = typeof exposedRaw === 'number' ? exposedRaw : mu - 3 * sigma;
      const displayScore = exposed * TRUESKILL_DISPLAY_MULTIPLIER;

      const wins = parseInt(String(row.wins ?? '0'), 10) || 0;
      const losses = parseInt(String(row.losses ?? '0'), 10) || 0;
      const ties = parseInt(String(row.ties ?? '0'), 10) || 0;
      const applesEaten = parseInt(String(row.apples_eaten ?? '0'), 10) || 0;
      const gamesPlayed = parseInt(String(row.games_played ?? '0'), 10) || 0;
      const totalCost = Number(row.total_cost ?? 0) || 0;
      const isActive = typeof row.is_active === 'boolean' ? row.is_active : undefined;

      const rating: SnakeBenchModelRating = {
        modelSlug: String(row.model_slug ?? modelSlug),
        mu,
        sigma,
        exposed,
        displayScore,
        wins,
        losses,
        ties,
        applesEaten,
        gamesPlayed,
        totalCost,
        ...(isActive !== undefined ? { isActive } : {}),
      };

      return rating;
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getModelRating: query failed for ${modelSlug}: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return null;
    }
  }

  async getModelMatchHistory(modelSlug: string, limit: number = 50): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    if (!this.isConnected()) {
      return [];
    }

    if (!modelSlug) {
      return [];
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50;

    try {
      const sql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.created_at,
          g.rounds,
          g.board_width,
          g.board_height,
          gp.score AS my_score,
          gp.result AS my_result,
          gp.death_reason,
          opp.model_slug AS opponent_slug,
          opp_gp.score AS opponent_score
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp
          ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        WHERE regexp_replace(m.model_slug, ':free$', '') = regexp_replace($1, ':free$', '')
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC
        LIMIT $2;
      `;

      const result = await this.query(sql, [modelSlug, safeLimit]);

      const history: SnakeBenchModelMatchHistoryEntry[] = result.rows.map((row: any) => {
        const startedTs = row.start_time ?? row.created_at ?? null;
        const startedAt = startedTs ? new Date(startedTs).toISOString() : '';

        const myScore = Number(row.my_score ?? 0) || 0;
        const opponentScore = Number(row.opponent_score ?? 0) || 0;
        const rounds = Number(row.rounds ?? 0) || 0;
        const boardWidth = Number(row.board_width ?? 0) || 0;
        const boardHeight = Number(row.board_height ?? 0) || 0;

        const resultLabelRaw = String(row.my_result ?? 'tied') as SnakeBenchResultLabel;
        const resultLabel: SnakeBenchResultLabel =
          resultLabelRaw === 'won' || resultLabelRaw === 'lost' || resultLabelRaw === 'tied'
            ? resultLabelRaw
            : 'tied';

        const deathReason = row.death_reason != null ? String(row.death_reason) : null;
        const opponentSlug = row.opponent_slug ? String(row.opponent_slug) : '';

        return {
          gameId: String(row.game_id),
          startedAt,
          opponentSlug,
          result: resultLabel,
          myScore,
          opponentScore,
          rounds,
          deathReason,
          boardWidth,
          boardHeight,
        };
      });

      return history;
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getModelMatchHistory: query failed for ${modelSlug}: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return [];
    }
  }

  async getTrueSkillLeaderboard(
    limit: number = 150,
    minGames: number = 3,
  ): Promise<SnakeBenchTrueSkillLeaderboardEntry[]> {
    if (!this.isConnected()) {
      return [];
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 150)) : 150;
    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, minGames) : 3;

    try {
      const sql = `
        SELECT
          regexp_replace(m.model_slug, ':free$', '') AS normalized_slug,
          m.trueskill_mu,
          m.trueskill_sigma,
          m.trueskill_exposed,
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
        GROUP BY regexp_replace(m.model_slug, ':free$', ''), m.trueskill_mu, m.trueskill_sigma, m.trueskill_exposed
        HAVING COUNT(gp.game_id) >= $2
        ORDER BY COALESCE(m.trueskill_exposed, m.trueskill_mu - 3 * m.trueskill_sigma) DESC
        LIMIT $1;
      `;

      const result = await this.query(sql, [safeLimit, safeMinGames]);

      return result.rows.map((row: any) => {
        const mu = typeof row.trueskill_mu === 'number' ? row.trueskill_mu : DEFAULT_TRUESKILL_MU;
        const sigma = typeof row.trueskill_sigma === 'number' ? row.trueskill_sigma : DEFAULT_TRUESKILL_SIGMA;
        const exposedRaw = typeof row.trueskill_exposed === 'number' ? row.trueskill_exposed : undefined;
        const exposed = typeof exposedRaw === 'number' ? exposedRaw : mu - 3 * sigma;
        const displayScore = exposed * TRUESKILL_DISPLAY_MULTIPLIER;

        const gamesPlayed = parseInt(String(row.games_played ?? '0'), 10) || 0;
        const wins = parseInt(String(row.wins ?? '0'), 10) || 0;
        const losses = parseInt(String(row.losses ?? '0'), 10) || 0;
        const ties = parseInt(String(row.ties ?? '0'), 10) || 0;
        const applesEaten = parseInt(String(row.apples_eaten ?? '0'), 10) || 0;
        const topScore = Number(row.top_score ?? 0) || 0;
        const totalCost = Number(row.total_cost ?? 0) || 0;

        const winRate = gamesPlayed > 0 ? wins / gamesPlayed : undefined;

        const entry: SnakeBenchTrueSkillLeaderboardEntry = {
          modelSlug: String(row.normalized_slug ?? ''),
          mu,
          sigma,
          exposed,
          displayScore,
          gamesPlayed,
          wins,
          losses,
          ties,
          applesEaten,
          topScore,
          totalCost,
          ...(winRate !== undefined ? { winRate } : {}),
        };

        return entry;
      });
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getTrueSkillLeaderboard: query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return [];
    }
  }

  /**
   * Get pairing history matrix: for each pair of models that have played,
   * returns matchesPlayed and lastPlayedAt. Used by suggest-matchups endpoint
   * to identify unplayed or rare pairings.
   *
   * Note: only includes pairs that have actually played; unplayed pairs won't appear.
   */
  async getPairingHistory(): Promise<
    Map<string, { matchesPlayed: number; lastPlayedAt: string | null }>
  > {
    const result = new Map<string, { matchesPlayed: number; lastPlayedAt: string | null }>();

    if (!this.isConnected()) {
      return result;
    }

    try {
      // Self-join game_participants to find all (A, B) pairings that occurred in the same game.
      // Normalize model slugs by removing ':free' suffix to treat free/paid versions as the same.
      // We normalize the key so that (A, B) and (B, A) map to the same entry by sorting slugs.
      const sql = `
        SELECT
          LEAST(
            regexp_replace(m1.model_slug, ':free$', ''),
            regexp_replace(m2.model_slug, ':free$', '')
          ) AS slug_a,
          GREATEST(
            regexp_replace(m1.model_slug, ':free$', ''),
            regexp_replace(m2.model_slug, ':free$', '')
          ) AS slug_b,
          COUNT(DISTINCT gp1.game_id) AS matches_played,
          MAX(COALESCE(g.start_time, g.created_at)) AS last_played_at
        FROM public.game_participants gp1
        JOIN public.game_participants gp2
          ON gp1.game_id = gp2.game_id AND gp1.player_slot < gp2.player_slot
        JOIN public.models m1 ON gp1.model_id = m1.id
        JOIN public.models m2 ON gp2.model_id = m2.id
        JOIN public.games g ON gp1.game_id = g.id
        WHERE g.status = 'completed'
        GROUP BY LEAST(
          regexp_replace(m1.model_slug, ':free$', ''),
          regexp_replace(m2.model_slug, ':free$', '')
        ), GREATEST(
          regexp_replace(m1.model_slug, ':free$', ''),
          regexp_replace(m2.model_slug, ':free$', '')
        );
      `;

      const { rows } = await this.query(sql);

      for (const row of rows) {
        const slugA = String(row.slug_a ?? '').trim();
        const slugB = String(row.slug_b ?? '').trim();
        if (!slugA || !slugB) continue;

        const key = `${slugA}|||${slugB}`;
        const matchesPlayed = parseInt(String(row.matches_played ?? '0'), 10) || 0;
        const lastPlayedRaw = row.last_played_at;
        const lastPlayedAt = lastPlayedRaw ? new Date(lastPlayedRaw).toISOString() : null;

        result.set(key, { matchesPlayed, lastPlayedAt });
      }

      return result;
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getPairingHistory: query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return result;
    }
  }

  /**
   * Basic local leaderboard: top N models by games played or local win rate.
   */
  async getBasicLeaderboard(limit: number = 10, sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed'): Promise<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>> {
    if (!this.isConnected()) {
      return [];
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 150)) : 10;

    try {
      let sql = '';
      let orderBy = '';

      if (sortBy === 'winRate') {
        sql = `
          SELECT
            regexp_replace(m.model_slug, ':free$', '') AS normalized_slug,
            COUNT(gp.game_id) AS games_played,
            COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
            COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
            COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
          FROM public.models m
          JOIN public.game_participants gp ON m.id = gp.model_id
          JOIN public.games g ON gp.game_id = g.id
          GROUP BY regexp_replace(m.model_slug, ':free$', '')
          HAVING COUNT(gp.game_id) > 0
          ORDER BY (COUNT(CASE WHEN gp.result = 'won' THEN 1 END)::float / NULLIF(COUNT(gp.game_id), 0)) DESC NULLS LAST
          LIMIT $1;
        `;
      } else {
        sql = `
          SELECT
            regexp_replace(m.model_slug, ':free$', '') AS normalized_slug,
            COUNT(gp.game_id) AS games_played,
            COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
            COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
            COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
          FROM public.models m
          JOIN public.game_participants gp ON m.id = gp.model_id
          JOIN public.games g ON gp.game_id = g.id
          GROUP BY regexp_replace(m.model_slug, ':free$', '')
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
          modelSlug: String(row?.normalized_slug ?? ''),
          gamesPlayed,
          wins,
          losses,
          ties,
          winRate,
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

  /**
   * Fetch the replay path for a single game (if present). This is a light
   * helper so API callers can resolve the on-disk JSON even when the server
   * restarted and lost the in-memory index.
   */
  async getReplayPath(gameId: string): Promise<{ replayPath: string | null } | null> {
    if (!this.isConnected()) return null;

    try {
      const sql = `SELECT replay_path FROM public.games WHERE id = $1 LIMIT 1;`;
      const { rows } = await this.query(sql, [gameId]);
      if (!rows.length) return null;
      return { replayPath: rows[0]?.replay_path ?? null };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getReplayPath: query failed for game ${gameId}: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
      return null;
    }
  }

  async setReplayPath(gameId: string, replayPath: string): Promise<void> {
    if (!this.isConnected()) return;
    if (!gameId || !replayPath) return;

    try {
      const sql = `UPDATE public.games SET replay_path = $2, updated_at = NOW() WHERE id = $1;`;
      await this.query(sql, [gameId, replayPath]);
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.setReplayPath: update failed for game ${gameId}: ${error instanceof Error ? error.message : String(error)}`,
        'snakebench-db',
      );
    }
  }

  /**
   * Full-fidelity ingest of a completed SnakeBench replay JSON, matching Greg's DB writes:
   * - Upsert models
   * - Upsert game with completed status, scores, costs, board params
   * - Upsert participants with score/result/death/cost
   * - Update aggregates and TrueSkill (Elo fallback) for this game
   *
   * @param filePath Absolute or relative path to snake_game_<id>.json
   * @param opts.forceRecompute When true, run aggregates/ratings even if the game already exists (for backfill)
   */
  async ingestReplayFromFile(
    filePath: string,
    opts: { forceRecompute?: boolean; gameTypeOverride?: string } = {},
  ): Promise<void> {
    if (!this.isConnected()) return;

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const raw = await fs.promises.readFile(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);

    const normalized = this.parseReplayJson(parsed, absolutePath, {
      gameTypeOverride: opts.gameTypeOverride,
    });
    if (!normalized.gameId) {
      throw new Error(`Replay missing game id: ${absolutePath}`);
    }

    const forceRecompute = opts.forceRecompute === true;

    await this.transaction(async (client) => {
      const existedResult = await client.query('SELECT 1 FROM public.games WHERE id = $1', [normalized.gameId]);
      const existed = (existedResult?.rowCount ?? 0) > 0;

      // Upsert models and collect ids by player_slot
      const modelIds: Record<number, number | null> = {};
      for (const p of normalized.participants) {
        modelIds[p.playerSlot] = await this.getOrCreateModelId(client, p.modelName);
      }

      // Upsert game row
      await client.query(
        `
        INSERT INTO public.games (
          id, status, start_time, end_time, rounds, replay_path,
          board_width, board_height, num_apples, total_score, total_cost, game_type, current_state
        ) VALUES (
          $1, 'completed', $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, NULL
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          start_time = COALESCE(EXCLUDED.start_time, public.games.start_time),
          end_time = COALESCE(EXCLUDED.end_time, public.games.end_time),
          rounds = COALESCE(EXCLUDED.rounds, public.games.rounds),
          replay_path = EXCLUDED.replay_path,
          board_width = EXCLUDED.board_width,
          board_height = EXCLUDED.board_height,
          num_apples = EXCLUDED.num_apples,
          total_score = EXCLUDED.total_score,
          total_cost = EXCLUDED.total_cost,
          game_type = EXCLUDED.game_type,
          current_state = NULL,
          updated_at = NOW();
        `,
        [
          normalized.gameId,
          normalized.startTime ?? null,
          normalized.endTime ?? null,
          normalized.rounds ?? null,
          normalized.replayPath,
          normalized.boardWidth,
          normalized.boardHeight,
          normalized.numApples,
          normalized.totalScore,
          normalized.totalCost,
          normalized.gameType,
        ],
      );

      // Upsert participants
      for (const p of normalized.participants) {
        const modelId = modelIds[p.playerSlot];
        if (modelId == null) continue;

        await client.query(
          `
          INSERT INTO public.game_participants (
            game_id, model_id, player_slot, score, result, death_round, death_reason, cost, opponent_rank_at_match
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, NULL
          )
          ON CONFLICT (game_id, player_slot) DO UPDATE SET
            score = EXCLUDED.score,
            result = EXCLUDED.result,
            death_round = EXCLUDED.death_round,
            death_reason = EXCLUDED.death_reason,
            cost = EXCLUDED.cost;
          `,
          [
            normalized.gameId,
            modelId,
            p.playerSlot,
            p.score,
            p.result,
            p.deathRound,
            p.deathReason,
            p.cost,
          ],
        );
      }

      const shouldRecompute = forceRecompute || !existed;
      if (shouldRecompute) {
        await this.updateAggregatesForGame(normalized.gameId, client);
        try {
          await this.updateTrueSkillForGame(normalized.gameId, client);
        } catch (tsErr) {
          const msg = tsErr instanceof Error ? tsErr.message : String(tsErr);
          logger.warn(`SnakeBenchRepository: TrueSkill update failed for ${normalized.gameId}, falling back to Elo: ${msg}`, 'snakebench-db');
          await this.updateEloForGame(normalized.gameId, client);
        }
      }
    });
  }

  /**
   * Parse replay JSON into normalized structures for DB writes.
   */
  private parseReplayJson(
    raw: any,
    absolutePath: string,
    opts: { gameTypeOverride?: string } = {},
  ): {
    gameId: string;
    startTime: Date | null;
    endTime: Date | null;
    rounds: number | null;
    boardWidth: number;
    boardHeight: number;
    numApples: number;
    totalScore: number;
    totalCost: number;
    gameType: string;
    replayPath: string;
    participants: Array<{
      playerSlot: number;
      modelName: string;
      result: string;
      score: number;
      deathRound: number | null;
      deathReason: string | null;
      cost: number;
    }>;
  } {
    const gameBlock = raw?.game ?? {};
    const metadata = raw?.metadata ?? {};
    const players = raw?.players ?? {};
    const totals = raw?.totals ?? {};

    const gameId: string =
      gameBlock.id ??
      metadata.game_id ??
      path.basename(absolutePath).replace(/^snake_game_/, '').replace(/\.json$/i, '');

    const startTimeStr: string | undefined = gameBlock.started_at ?? metadata.start_time;
    const endTimeStr: string | undefined = gameBlock.ended_at ?? metadata.end_time;
    const startTime = startTimeStr ? new Date(startTimeStr) : null;
    const endTime = endTimeStr ? new Date(endTimeStr) : null;

    const rounds =
      (typeof gameBlock.rounds_played === 'number' ? gameBlock.rounds_played : null) ??
      (typeof metadata.actual_rounds === 'number' ? metadata.actual_rounds : null) ??
      null;

    const board = gameBlock.board ?? {};
    const boardWidth = Number(board.width ?? 0) || 0;
    const boardHeight = Number(board.height ?? 0) || 0;
    const numApples = Number(board.num_apples ?? 0) || 0;

    const totalCost = Number(totals.cost ?? 0) || 0;

    const participants: Array<{
      playerSlot: number;
      modelName: string;
      result: string;
      score: number;
      deathRound: number | null;
      deathReason: string | null;
      cost: number;
    }> = [];

    let totalScore = 0;

    for (const [slotKey, player] of Object.entries<any>(players)) {
      const playerSlot = Number(slotKey);
      const modelName = String(player?.name ?? player?.model_id ?? '').trim();
      const score = Number(player?.final_score ?? 0) || 0;
      totalScore += score;
      const result = String(player?.result ?? 'tied');
      const deathRound = player?.death?.round ?? null;
      const deathReason = player?.death?.reason ?? null;
      const cost = Number(player?.totals?.cost ?? 0) || 0;

      participants.push({
        playerSlot,
        modelName,
        result,
        score,
        deathRound: deathRound != null ? Number(deathRound) : null,
        deathReason: deathReason ? String(deathReason) : null,
        cost,
      });
    }

    const filename = path.basename(absolutePath);
    const replayPath = path.join('completed_games', filename);
    const gameTypeRaw = (opts.gameTypeOverride ?? gameBlock.game_type ?? metadata.game_type ?? 'arc-explainer') as any;
    const gameType = String(gameTypeRaw);

    return {
      gameId,
      startTime,
      endTime,
      rounds,
      boardWidth,
      boardHeight,
      numApples,
      totalScore,
      totalCost,
      gameType,
      replayPath,
      participants,
    };
  }

  private async getOrCreateModelId(client: any, modelSlug: string): Promise<number | null> {
    if (!modelSlug) return null;
    const provider = 'OpenRouter';
    const name = modelSlug;

    const insertSql = `
      INSERT INTO public.models (name, provider, model_slug, is_active, test_status, trueskill_mu, trueskill_sigma, trueskill_exposed, trueskill_updated_at)
      VALUES ($1, $2, $3, TRUE, 'ranked', $4, $5, $6, NOW())
      ON CONFLICT (model_slug) DO UPDATE
        SET name = EXCLUDED.name
      RETURNING id;
    `;

    const exposed = DEFAULT_TRUESKILL_MU - 3 * DEFAULT_TRUESKILL_SIGMA;
    const { rows } = await client.query(insertSql, [
      name,
      provider,
      modelSlug,
      DEFAULT_TRUESKILL_MU,
      DEFAULT_TRUESKILL_SIGMA,
      exposed,
    ]);
    if (!rows.length) return null;
    return rows[0].id as number;
  }

  private async updateAggregatesForGame(gameId: string, client: any): Promise<void> {
    // Increment aggregates per participant, idempotent only if called once per game after a reset.
    await client.query(
      `
      UPDATE public.models m
      SET
        wins = wins + CASE WHEN gp.result = 'won' THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN gp.result = 'lost' THEN 1 ELSE 0 END,
        ties = ties + CASE WHEN gp.result = 'tied' THEN 1 ELSE 0 END,
        apples_eaten = apples_eaten + COALESCE(gp.score, 0),
        games_played = games_played + 1,
        last_played_at = NOW(),
        updated_at = NOW()
      FROM public.game_participants gp
      WHERE gp.model_id = m.id
        AND gp.game_id = $1;
      `,
      [gameId],
    );
  }

  private async updateTrueSkillForGame(gameId: string, client: any): Promise<void> {
    const res = await client.query(
      `
      SELECT gp.model_id, gp.player_slot, gp.score, gp.result,
             m.trueskill_mu, m.trueskill_sigma, m.name
      FROM public.game_participants gp
      JOIN public.models m ON gp.model_id = m.id
      WHERE gp.game_id = $1
      ORDER BY gp.player_slot ASC;
      `,
      [gameId],
    );

    if (!res.rows.length) return;

    const env = new TrueSkill(
      DEFAULT_TRUESKILL_MU,
      DEFAULT_TRUESKILL_SIGMA,
      DEFAULT_TRUESKILL_BETA,
      DEFAULT_TRUESKILL_TAU,
      DEFAULT_TRUESKILL_DRAW_PROBABILITY,
    );

    const ratingGroups: Rating[][] = [];
    const ranks: number[] = [];
    const participants: Array<{ modelId: number; slot: number; pre: Rating; result: string }> = [];

    for (const row of res.rows) {
      const mu = typeof row.trueskill_mu === 'number' ? row.trueskill_mu : DEFAULT_TRUESKILL_MU;
      const sigma = typeof row.trueskill_sigma === 'number' ? row.trueskill_sigma : DEFAULT_TRUESKILL_SIGMA;
      const rating = new Rating(mu, sigma);
      ratingGroups.push([rating]);
      const result = String(row.result ?? 'tied');
      ranks.push(RESULT_RANK[result] ?? RESULT_RANK.tied);
      participants.push({ modelId: row.model_id, slot: row.player_slot, pre: rating, result });
    }

    const rated = env.rate(ratingGroups, ranks);

    for (let i = 0; i < participants.length; i += 1) {
      const participant = participants[i];
      const newRating = rated[i][0] as Rating;
      const exposed = newRating.mu - 3 * newRating.sigma;
      const display = exposed * TRUESKILL_DISPLAY_MULTIPLIER;

      await client.query(
        `
        UPDATE public.models
        SET
          trueskill_mu = $1,
          trueskill_sigma = $2,
          trueskill_exposed = $3,
          trueskill_updated_at = NOW(),
          elo_rating = $4,
          updated_at = NOW()
        WHERE id = $5;
        `,
        [newRating.mu, newRating.sigma, exposed, display, participant.modelId],
      );
    }
  }

  private async updateEloForGame(gameId: string, client: any): Promise<void> {
    const res = await client.query(
      `
      SELECT gp.model_id, gp.result, m.elo_rating
      FROM public.game_participants gp
      JOIN public.models m ON gp.model_id = m.id
      WHERE gp.game_id = $1
      ORDER BY gp.player_slot ASC;
      `,
      [gameId],
    );
    const rows = res.rows;
    const n = rows.length;
    if (n < 2) return;

    const ratings: Record<number, number> = {};
    rows.forEach((r: any) => {
      ratings[r.model_id] = typeof r.elo_rating === 'number' ? r.elo_rating : 1500;
    });

    const scoreSum: Record<number, number> = {};
    const expectedSum: Record<number, number> = {};
    rows.forEach((r: any) => {
      scoreSum[r.model_id] = 0;
      expectedSum[r.model_id] = 0;
    });

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const rowI = rows[i];
        const rowJ = rows[j];
        const [sI, sJ] = RESULT_SCORE[rowI.result] ?? [0.5, 0.5];
        const expectedI = this.expectedScore(ratings[rowI.model_id], ratings[rowJ.model_id]);
        const expectedJ = this.expectedScore(ratings[rowJ.model_id], ratings[rowI.model_id]);

        scoreSum[rowI.model_id] += sI;
        scoreSum[rowJ.model_id] += sJ;
        expectedSum[rowI.model_id] += expectedI;
        expectedSum[rowJ.model_id] += expectedJ;
      }
    }

    for (const row of rows) {
      const mid = row.model_id;
      const delta = (ELO_K / (n - 1)) * (scoreSum[mid] - expectedSum[mid]);
      const newRating = ratings[mid] + delta;
      await client.query(
        `UPDATE public.models SET elo_rating = $1, updated_at = NOW() WHERE id = $2;`,
        [newRating, mid],
      );
    }
  }

  private expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  }

  /**
   * Reset model aggregates and TrueSkill/Elo to baseline (used before backfill).
   */
  async resetModelRatings(): Promise<void> {
    if (!this.isConnected()) return;
    const exposed = DEFAULT_TRUESKILL_MU - 3 * DEFAULT_TRUESKILL_SIGMA;
    const display = exposed * TRUESKILL_DISPLAY_MULTIPLIER;
    await this.query(
      `
      UPDATE public.models
      SET
        wins = 0,
        losses = 0,
        ties = 0,
        apples_eaten = 0,
        games_played = 0,
        last_played_at = NULL,
        trueskill_mu = $1,
        trueskill_sigma = $2,
        trueskill_exposed = $3,
        trueskill_updated_at = NOW(),
        elo_rating = $4,
        updated_at = NOW();
      `,
      [DEFAULT_TRUESKILL_MU, DEFAULT_TRUESKILL_SIGMA, exposed, display],
    );
  }

  /**
   * Backfill all completed replay files in a directory (chronological order).
   */
  async backfillFromDirectory(completedDir: string): Promise<void> {
    if (!this.isConnected()) return;

    const dirPath = path.isAbsolute(completedDir) ? completedDir : path.join(process.cwd(), completedDir);
    const entries = await fs.promises.readdir(dirPath);
    const files = entries.filter((f) => /^snake_game_.*\.json$/i.test(f));

    // Sort by start_time inside the file if available; fallback to filename
    const withTimes: Array<{ file: string; time: number }> = [];
    for (const file of files) {
      const full = path.join(dirPath, file);
      try {
        const raw = await fs.promises.readFile(full, 'utf8');
        const parsed = JSON.parse(raw);
        const t = parsed?.game?.started_at ?? parsed?.metadata?.start_time;
        const timeVal = t ? new Date(t).getTime() : fs.statSync(full).mtimeMs;
        withTimes.push({ file: full, time: timeVal });
      } catch {
        withTimes.push({ file: full, time: fs.statSync(full).mtimeMs });
      }
    }

    withTimes.sort((a, b) => a.time - b.time);

    for (const entry of withTimes) {
      await this.ingestReplayFromFile(entry.file, { forceRecompute: true });
    }
  }

  /**
   * Get all models that have actually played games.
   * Used for the "Model Match History" page picker - only shows models with data.
   */
  async getModelsWithGames(): Promise<
    Array<{
      modelSlug: string;
      gamesPlayed: number;
      wins: number;
      losses: number;
      ties: number;
      winRate?: number;
    }>
  > {
    if (!this.isConnected()) {
      return [];
    }

    try {
      // Group by normalized slug (remove :free suffix) to treat free/paid as same model
      const sql = `
        SELECT
          regexp_replace(m.model_slug, ':free$', '') AS normalized_slug,
          COUNT(DISTINCT gp.game_id) AS games_played,
          COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
          COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
          COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
        FROM public.models m
        JOIN public.game_participants gp ON m.id = gp.model_id
        JOIN public.games g ON gp.game_id = g.id
        WHERE g.status = 'completed'
        GROUP BY regexp_replace(m.model_slug, ':free$', '')
        HAVING COUNT(DISTINCT gp.game_id) > 0
        ORDER BY games_played DESC, normalized_slug ASC;
      `;

      const result = await this.query(sql);

      return result.rows.map((row: any) => {
        const gamesPlayed = parseInt(String(row.games_played ?? '0'), 10) || 0;
        const wins = parseInt(String(row.wins ?? '0'), 10) || 0;
        const losses = parseInt(String(row.losses ?? '0'), 10) || 0;
        const ties = parseInt(String(row.ties ?? '0'), 10) || 0;
        const winRate = gamesPlayed > 0 ? wins / gamesPlayed : undefined;

        return {
          modelSlug: String(row.normalized_slug ?? ''),
          gamesPlayed,
          wins,
          losses,
          ties,
          ...(winRate !== undefined ? { winRate } : {}),
        };
      });
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getModelsWithGames: query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return [];
    }
  }

  /**
   * Get ALL match history for a model (unbounded).
   * Used by the Model Match History page to show every game a model has ever played.
   */
  async getModelMatchHistoryUnbounded(modelSlug: string): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    if (!this.isConnected()) {
      return [];
    }

    if (!modelSlug) {
      return [];
    }

    try {
      const sql = `
        SELECT
          g.id AS game_id,
          g.start_time,
          g.end_time,
          g.created_at,
          g.rounds,
          g.board_width,
          g.board_height,
          gp.score AS my_score,
          gp.result AS my_result,
          gp.death_reason,
          gp.cost AS my_cost,
          opp.model_slug AS opponent_slug,
          opp_gp.score AS opponent_score
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp
          ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        WHERE regexp_replace(m.model_slug, ':free$', '') = regexp_replace($1, ':free$', '')
          AND g.status = 'completed'
        ORDER BY COALESCE(g.start_time, g.created_at, NOW()) DESC;
      `;

      const result = await this.query(sql, [modelSlug]);

      const history: SnakeBenchModelMatchHistoryEntry[] = result.rows.map((row: any) => {
        const startedTs = row.start_time ?? row.created_at ?? null;
        const startedAt = startedTs ? new Date(startedTs).toISOString() : '';
        const endedTs = row.end_time ?? null;
        const endedAt = endedTs ? new Date(endedTs).toISOString() : '';

        const myScore = Number(row.my_score ?? 0) || 0;
        const opponentScore = Number(row.opponent_score ?? 0) || 0;
        const rounds = Number(row.rounds ?? 0) || 0;
        const boardWidth = Number(row.board_width ?? 0) || 0;
        const boardHeight = Number(row.board_height ?? 0) || 0;
        const myCost = Number(row.my_cost ?? 0) || 0;

        const resultLabelRaw = String(row.my_result ?? 'tied') as SnakeBenchResultLabel;
        const resultLabel: SnakeBenchResultLabel =
          resultLabelRaw === 'won' || resultLabelRaw === 'lost' || resultLabelRaw === 'tied'
            ? resultLabelRaw
            : 'tied';

        const deathReason = row.death_reason != null ? String(row.death_reason) : null;
        const opponentSlug = row.opponent_slug ? String(row.opponent_slug) : '';

        return {
          gameId: String(row.game_id),
          startedAt,
          endedAt,
          opponentSlug,
          result: resultLabel,
          myScore,
          opponentScore,
          rounds,
          deathReason,
          boardWidth,
          boardHeight,
          cost: myCost,
        };
      });

      return history;
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getModelMatchHistoryUnbounded: query failed for ${modelSlug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return [];
    }
  }

  /**
   * Aggregate per-model insights for the Worm Arena Models page report.
   */
  async getModelInsightsData(
    modelSlug: string,
  ): Promise<{
    summary: WormArenaModelInsightsSummary;
    failureModes: WormArenaModelInsightsFailureMode[];
    lossOpponents: WormArenaModelInsightsOpponent[];
  } | null> {
    if (!this.isConnected()) {
      return null;
    }

    if (!modelSlug) {
      return null;
    }

    // Early loss threshold in rounds for the report.
    const earlyLossThreshold = 5;

    try {
      // Summary stats for the model across all completed games.
      const summarySql = `
        SELECT
          COUNT(*) AS games_played,
          SUM(CASE WHEN gp.result = 'won' THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN gp.result = 'lost' THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN gp.result = 'tied' THEN 1 ELSE 0 END) AS ties,
          COALESCE(SUM(gp.cost), 0) AS total_cost,
          AVG(g.rounds) AS avg_rounds,
          AVG(gp.score) AS avg_score,
          AVG(CASE WHEN gp.result = 'lost' THEN gp.death_round END) AS avg_death_round_loss,
          SUM(CASE WHEN gp.result = 'lost' AND gp.death_round IS NOT NULL AND gp.death_round <= $2 THEN 1 ELSE 0 END) AS early_losses,
          SUM(CASE WHEN gp.result = 'lost' AND gp.death_reason IS NOT NULL THEN 1 ELSE 0 END) AS losses_with_reason,
          SUM(CASE WHEN gp.result = 'lost' AND gp.death_reason IS NULL THEN 1 ELSE 0 END) AS losses_without_reason
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        WHERE regexp_replace(m.model_slug, ':free$', '') = regexp_replace($1, ':free$', '')
          AND g.status = 'completed';
      `;

      const summaryResult = await this.query(summarySql, [modelSlug, earlyLossThreshold]);
      const summaryRow: any = summaryResult.rows[0] ?? {};

      const gamesPlayed = parseInt(String(summaryRow.games_played ?? '0'), 10) || 0;
      const wins = parseInt(String(summaryRow.wins ?? '0'), 10) || 0;
      const losses = parseInt(String(summaryRow.losses ?? '0'), 10) || 0;
      const ties = parseInt(String(summaryRow.ties ?? '0'), 10) || 0;
      const totalCost = Number(summaryRow.total_cost ?? 0) || 0;
      const averageRounds = summaryRow.avg_rounds != null ? Number(summaryRow.avg_rounds) : null;
      const averageScore = summaryRow.avg_score != null ? Number(summaryRow.avg_score) : null;
      const averageDeathRoundLoss =
        summaryRow.avg_death_round_loss != null ? Number(summaryRow.avg_death_round_loss) : null;
      const earlyLosses = parseInt(String(summaryRow.early_losses ?? '0'), 10) || 0;
      const lossesWithReason = parseInt(String(summaryRow.losses_with_reason ?? '0'), 10) || 0;
      const lossesWithoutReason = parseInt(String(summaryRow.losses_without_reason ?? '0'), 10) || 0;

      // Derived rates for the report summary.
      const decidedGames = wins + losses;
      const winRate = decidedGames > 0 ? wins / decidedGames : 0;
      const costPerGame = gamesPlayed > 0 ? totalCost / gamesPlayed : null;
      const costPerWin = wins > 0 ? totalCost / wins : null;
      const costPerLoss = losses > 0 ? totalCost / losses : null;
      const earlyLossRate = losses > 0 ? earlyLosses / losses : 0;
      const lossDeathReasonCoverage = losses > 0 ? lossesWithReason / losses : 0;

      const summary: WormArenaModelInsightsSummary = {
        gamesPlayed,
        wins,
        losses,
        ties,
        winRate,
        totalCost,
        costPerGame,
        costPerWin,
        costPerLoss,
        averageRounds,
        averageScore,
        averageDeathRoundLoss,
        earlyLosses,
        earlyLossRate,
        lossDeathReasonCoverage,
        unknownLosses: lossesWithoutReason,
      };

      // Loss failure modes grouped by death reason.
      const failureSql = `
        SELECT
          COALESCE(gp.death_reason, 'unknown') AS death_reason,
          COUNT(*) AS losses,
          AVG(gp.death_round) AS avg_death_round
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        WHERE regexp_replace(m.model_slug, ':free$', '') = regexp_replace($1, ':free$', '')
          AND g.status = 'completed'
          AND gp.result = 'lost'
        GROUP BY COALESCE(gp.death_reason, 'unknown')
        ORDER BY losses DESC;
      `;

      const failureResult = await this.query(failureSql, [modelSlug]);
      const totalLosses = losses;
      const failureModes: WormArenaModelInsightsFailureMode[] = failureResult.rows.map((row: any) => {
        const lossCount = parseInt(String(row.losses ?? '0'), 10) || 0;
        const avgDeathRound = row.avg_death_round != null ? Number(row.avg_death_round) : null;
        return {
          reason: String(row.death_reason ?? 'unknown'),
          losses: lossCount,
          percentOfLosses: totalLosses > 0 ? lossCount / totalLosses : 0,
          averageDeathRound: avgDeathRound,
        };
      });

      // Opponents that account for the most losses.
      const opponentSql = `
        SELECT
          regexp_replace(opp.model_slug, ':free$', '') AS opponent_slug,
          COUNT(*) AS games_played,
          SUM(CASE WHEN gp.result = 'won' THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN gp.result = 'lost' THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN gp.result = 'tied' THEN 1 ELSE 0 END) AS ties,
          MAX(COALESCE(g.start_time, g.created_at)) AS last_played_at
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp
          ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        WHERE regexp_replace(m.model_slug, ':free$', '') = regexp_replace($1, ':free$', '')
          AND g.status = 'completed'
          AND opp.model_slug IS NOT NULL
          AND opp.model_slug <> ''
        GROUP BY regexp_replace(opp.model_slug, ':free$', '')
        ORDER BY losses DESC, games_played DESC
        LIMIT 5;
      `;

      const opponentResult = await this.query(opponentSql, [modelSlug]);
      const lossOpponents: WormArenaModelInsightsOpponent[] = opponentResult.rows.map((row: any) => {
        const opponentSlug = String(row.opponent_slug ?? '');
        const opponentGames = parseInt(String(row.games_played ?? '0'), 10) || 0;
        const opponentWins = parseInt(String(row.wins ?? '0'), 10) || 0;
        const opponentLosses = parseInt(String(row.losses ?? '0'), 10) || 0;
        const opponentTies = parseInt(String(row.ties ?? '0'), 10) || 0;
        const lastPlayedRaw = row.last_played_at ?? null;
        const lastPlayedAt = lastPlayedRaw ? new Date(lastPlayedRaw).toISOString() : null;
        const lossRate = opponentGames > 0 ? opponentLosses / opponentGames : 0;

        return {
          opponentSlug,
          gamesPlayed: opponentGames,
          wins: opponentWins,
          losses: opponentLosses,
          ties: opponentTies,
          lossRate,
          lastPlayedAt,
        };
      });

      return { summary, failureModes, lossOpponents };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getModelInsightsData: query failed for ${modelSlug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return null;
    }
  }

  /**
   * Get run length distribution data for models with minimum games threshold.
   * Returns distribution of game lengths (rounds) separated by win/loss outcome.
   * Aggregates across all completed games for qualifying models.
   * Follows same pattern as getTrueSkillLeaderboard for consistency.
   */
  async getRunLengthDistribution(
    minGames: number = 5,
  ): Promise<WormArenaRunLengthDistributionData> {
    if (!this.isConnected()) {
      return {
        minGamesThreshold: minGames,
        modelsIncluded: 0,
        totalGamesAnalyzed: 0,
        distributionData: [],
        timestamp: Date.now(),
      };
    }

    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, Math.min(minGames, 1000)) : 5;

    try {
      // Get all run length data grouped by model, rounds, and result.
      // Follows getTrueSkillLeaderboard pattern: simple GROUP BY aggregation with COALESCE for NULLs.
      // Filter by completion in TypeScript to handle edge cases gracefully.
      const sql = `
        SELECT
          regexp_replace(m.model_slug, ':free$', '') AS model_slug,
          COALESCE(g.rounds, 0) AS rounds,
          gp.result AS result,
          COUNT(*) AS frequency
        FROM public.game_participants gp
        JOIN public.games g ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed'
        GROUP BY regexp_replace(m.model_slug, ':free$', ''), COALESCE(g.rounds, 0), gp.result
        ORDER BY regexp_replace(m.model_slug, ':free$', ''), COALESCE(g.rounds, 0)
      `;

      const result = await this.query(sql);
      const rows: any[] = result.rows || [];

      if (rows.length === 0) {
        return {
          minGamesThreshold: safeMinGames,
          modelsIncluded: 0,
          totalGamesAnalyzed: 0,
          distributionData: [],
          timestamp: Date.now(),
        };
      }

      // Aggregate in TypeScript: compute model totals and filter by minGames threshold.
      // This keeps SQL simple (just GROUP BY), matching the getTrueSkillLeaderboard pattern.
      const modelMap = new Map<string, Map<number, { wins: number; losses: number }>>();
      const modelGameCounts = new Map<string, number>();
      let totalGamesAnalyzed = 0;

      rows.forEach((row: any) => {
        const modelSlug = String(row.model_slug ?? '');
        const rounds = parseInt(String(row.rounds ?? '0'), 10) || 0;
        const resultLabel = String(row.result ?? 'lost').toLowerCase();
        const frequency = parseInt(String(row.frequency ?? '0'), 10) || 0;

        // Skip rows with 0 frequency (shouldn't happen, but defensive)
        if (frequency <= 0) {
          return;
        }

        // Track total games per model
        const currentTotal = modelGameCounts.get(modelSlug) || 0;
        modelGameCounts.set(modelSlug, currentTotal + frequency);

        // Initialize model map if needed
        if (!modelMap.has(modelSlug)) {
          modelMap.set(modelSlug, new Map());
        }

        const binMap = modelMap.get(modelSlug)!;
        if (!binMap.has(rounds)) {
          binMap.set(rounds, { wins: 0, losses: 0 });
        }

        const bin = binMap.get(rounds)!;
        if (resultLabel === 'won') {
          bin.wins += frequency;
        } else if (resultLabel === 'lost') {
          bin.losses += frequency;
        }
        // Note: 'tied' games are intentionally excluded from this distribution
        // as the chart only displays win/loss binary outcomes

        // Only count won/lost in totalGamesAnalyzed (exclude ties)
        if (resultLabel === 'won' || resultLabel === 'lost') {
          totalGamesAnalyzed += frequency;
        }
      });

      // Filter to only models with >= minGames and build response.
      const distributionData: WormArenaRunLengthModelData[] = Array.from(modelMap.entries())
        .filter(([modelSlug]) => (modelGameCounts.get(modelSlug) || 0) >= safeMinGames)
        .map(([modelSlug, binMap]) => ({
          modelSlug,
          totalGames: modelGameCounts.get(modelSlug) || 0,
          bins: Array.from(binMap.entries())
            .map(([rounds, { wins, losses }]) => ({
              rounds,
              wins,
              losses,
            }))
            .sort((a, b) => a.rounds - b.rounds),
        }))
        .sort((a, b) => b.totalGames - a.totalGames);

      return {
        minGamesThreshold: safeMinGames,
        modelsIncluded: distributionData.length,
        totalGamesAnalyzed,
        distributionData,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.warn(
        `SnakeBenchRepository.getRunLengthDistribution: query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'snakebench-db',
      );
      return {
        minGamesThreshold: safeMinGames,
        modelsIncluded: 0,
        totalGamesAnalyzed: 0,
        distributionData: [],
        timestamp: Date.now(),
      };
    }
  }
}

