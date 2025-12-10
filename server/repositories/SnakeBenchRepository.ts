/**
 * Author: Cascade
 * Date: 2025-12-09
 * PURPOSE: SnakeBenchRepository
 *          Handles compatibility-first persistence of SnakeBench games
 *          into PostgreSQL tables that mirror the root SnakeBench
 *          project schema (models, games, game_participants).
 * SRP/DRY check: Pass — focused exclusively on SnakeBench DB reads/writes.
 */

import fs from 'fs';
import path from 'path';
import { Rating, TrueSkill } from 'ts-trueskill';

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

    // If we have a completed replay file, ingest the full parity data path instead of the minimal summary.
    if (result.completedGamePath) {
      try {
        await this.ingestReplayFromFile(result.completedGamePath);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`SnakeBenchRepository.recordMatchFromResult: full replay ingest failed, falling back to minimal insert: ${msg}`, 'snakebench-db');
      }
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
      const safeDays = Math.max(1, Math.min(90, days)); // Clamp to 1-90
      const sql = `
        SELECT
          COUNT(DISTINCT g.id) AS games_played,
          COUNT(DISTINCT m.model_slug) AS unique_models
        FROM public.games g
        LEFT JOIN public.game_participants gp ON g.id = gp.game_id
        LEFT JOIN public.models m ON gp.model_id = m.id
        WHERE g.game_type = 'arc-explainer'
          AND g.created_at >= NOW() - (INTERVAL '1 day' * $1);
      `;

      const result = await this.query(sql, [safeDays]);
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
  async ingestReplayFromFile(filePath: string, opts: { forceRecompute?: boolean } = {}): Promise<void> {
    if (!this.isConnected()) return;

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const raw = await fs.promises.readFile(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);

    const normalized = this.parseReplayJson(parsed, absolutePath);
    if (!normalized.gameId) {
      throw new Error(`Replay missing game id: ${absolutePath}`);
    }

    const forceRecompute = opts.forceRecompute === true;

    await this.transaction(async (client) => {
      const existed = (await client.query('SELECT 1 FROM public.games WHERE id = $1', [normalized.gameId])).rowCount > 0;

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
  private parseReplayJson(raw: any, absolutePath: string): {
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
    const gameType = String(gameBlock.game_type ?? metadata.game_type ?? 'ladder');

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
}
