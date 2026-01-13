/**
 * Author: GPT-5
 * Date: 2026-01-10
 * PURPOSE: GameWriteRepository - Handles all write operations for SnakeBench/Worm Arena,
 *          now canonicalizing OpenRouter model slugs so variants like :free collapse into
 *          a single canonical model entry for storage and analytics.
 * SRP/DRY check: Pass - focused exclusively on data mutation and persistence.
 */

import fs from 'fs';
import path from 'path';
import { PoolClient } from 'pg';
import { Rating, TrueSkill } from 'ts-trueskill';

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import { canonicalizeOpenRouterSlug } from '../utils/openRouterSlugCanonicalizer.ts';
import { deriveReplayPath, getCompletedGamesAbsolutePath } from '../services/snakeBench/utils/constants.ts';
import {
  DEFAULT_TRUESKILL_MU,
  DEFAULT_TRUESKILL_SIGMA,
  DEFAULT_TRUESKILL_BETA,
  DEFAULT_TRUESKILL_TAU,
  DEFAULT_TRUESKILL_DRAW_PROBABILITY,
  TRUESKILL_DISPLAY_MULTIPLIER,
  RESULT_RANK,
  RESULT_SCORE,
  calculateExpectedElo,
  ELO_K,
  logRepoError,
  safeNumeric,
} from './snakebenchSqlHelpers.ts';
import type {
  SnakeBenchRunMatchResult,
} from '../../shared/types.js';

export interface SnakeBenchRecordMatchParams {
  result: SnakeBenchRunMatchResult;
  width: number;
  height: number;
  numApples: number;
  gameType?: string;
}

export class GameWriteRepository extends BaseRepository {
  /**
   * Upsert models by model_slug.
   */
  async upsertModels(
    models: Array<{ modelSlug: string; name?: string; provider?: string; isActive?: boolean; testStatus?: string }>,
    client?: PoolClient
  ): Promise<{ inserted: number; updated: number }> {
    if (!this.isConnected() || models.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    let inserted = 0;
    let updated = 0;

    const execute = async (queryClient: PoolClient) => {
      for (const m of models) {
        const canonicalSlug = canonicalizeOpenRouterSlug(m.modelSlug);
        const name = m.name ?? canonicalSlug;
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
        const { rows } = await queryClient.query(sql, [name, provider, canonicalSlug, isActive, testStatus]);
        const wasInserted = rows?.[0]?.inserted_flag === true;
        if (wasInserted) inserted += 1;
        else updated += 1;
      }
    };

    if (client) {
      await execute(client);
    } else {
      await this.transaction(execute);
    }

    return { inserted, updated };
  }

  /**
   * Record a single SnakeBench match.
   */
  async recordMatchFromResult(params: SnakeBenchRecordMatchParams): Promise<void> {
    if (!this.isConnected()) return;

    const { result, width, height, numApples } = params;
    const gameId = result.gameId;

    if (!gameId || !result.modelA || !result.modelB) {
      logger.warn('GameWriteRepository.recordMatchFromResult: missing gameId/model names, skipping DB write', 'snakebench-db');
      return;
    }

    const gameType = params.gameType ?? 'arc-explainer';

    if (result.completedGamePath) {
      try {
        await this.ingestReplayFromFile(result.completedGamePath, { gameTypeOverride: gameType });
        return;
      } catch (err) {
        logRepoError('recordMatchFromResult (ingest fallback)', err);
      }
    }

    const scores = result.scores || {};
    const scoreA = safeNumeric(scores[result.modelA]);
    const scoreB = safeNumeric(scores[result.modelB]);
    const totalScore = scoreA + scoreB;

    const resultsByModel = result.results || {};
    const statusA = resultsByModel[result.modelA] ?? null;
    const statusB = resultsByModel[result.modelB] ?? null;

    const now = new Date();

    try {
      await this.transaction(async (client) => {
        const modelAId = await this.getOrCreateModelId(client, result.modelA);
        const modelBId = await this.getOrCreateModelId(client, result.modelB);

        const insertGameSql = `
          INSERT INTO public.games (
            id, status, start_time, end_time, rounds, replay_path,
            board_width, board_height, num_apples, total_score, total_cost,
            game_type, current_state
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING;
        `;

        const replayPath = result.completedGamePath ?? null;

        await client.query(insertGameSql, [
          gameId, 'completed', now, now, null, replayPath,
          width, height, numApples, totalScore, 0.0, gameType, null
        ]);

        const insertParticipantSql = `
          INSERT INTO public.game_participants (
            game_id, model_id, player_slot, score, result,
            death_round, death_reason, cost, opponent_rank_at_match
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (game_id, player_slot) DO NOTHING;
        `;

        if (modelAId != null) {
          await client.query(insertParticipantSql, [gameId, modelAId, 0, scoreA, statusA, null, null, 0.0, null]);
        }
        if (modelBId != null) {
          await client.query(insertParticipantSql, [gameId, modelBId, 1, scoreB, statusB, null, null, 0.0, null]);
        }
      });
    } catch (error) {
      logRepoError('recordMatchFromResult', error);
    }
  }

  /**
   * Set the replay path for a game.
   */
  async setReplayPath(gameId: string, replayPath: string, client?: PoolClient): Promise<void> {
    if (!this.isConnected() || !gameId || !replayPath) return;
    try {
      const sql = `UPDATE public.games SET replay_path = $2, updated_at = NOW() WHERE id = $1;`;
      if (client) {
        await client.query(sql, [gameId, replayPath]);
      } else {
        await this.query(sql, [gameId, replayPath]);
      }
    } catch (error) {
      logRepoError('setReplayPath', error);
    }
  }

  /**
   * Ingest a replay JSON file into the database.
   */
  async ingestReplayFromFile(
    filePath: string,
    opts: { forceRecompute?: boolean; gameTypeOverride?: string } = {},
    client?: PoolClient
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

    const execute = async (queryClient: PoolClient) => {
      const existedResult = await queryClient.query('SELECT 1 FROM public.games WHERE id = $1', [normalized.gameId]);
      const existed = (existedResult?.rowCount ?? 0) > 0;

      const modelIds: Record<number, number | null> = {};
      for (const p of normalized.participants) {
        modelIds[p.playerSlot] = await this.getOrCreateModelId(queryClient, p.modelName);
      }

      await queryClient.query(
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
          normalized.gameId, normalized.startTime ?? null, normalized.endTime ?? null,
          normalized.rounds ?? null, normalized.replayPath, normalized.boardWidth,
          normalized.boardHeight, normalized.numApples, normalized.totalScore,
          normalized.totalCost, normalized.gameType,
        ],
      );

      for (const p of normalized.participants) {
        const modelId = modelIds[p.playerSlot];
        if (modelId == null) continue;

        await queryClient.query(
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
          [normalized.gameId, modelId, p.playerSlot, p.score, p.result, p.deathRound, p.deathReason, p.cost],
        );
      }

      const shouldRecompute = forceRecompute || !existed;
      if (shouldRecompute) {
        await this.updateAggregatesForGame(normalized.gameId, queryClient);
        try {
          await this.updateTrueSkillForGame(normalized.gameId, queryClient);
        } catch (tsErr) {
          logRepoError(`TrueSkill update failed for ${normalized.gameId}, falling back to Elo`, tsErr);
          await this.updateEloForGame(normalized.gameId, queryClient);
        }
      }
    };

    if (client) {
      await execute(client);
    } else {
      await this.transaction(execute);
    }
  }

  /**
   * Parse replay JSON into normalized structure.
   */
  private parseReplayJson(
    raw: any,
    absolutePath: string,
    opts: { gameTypeOverride?: string } = {},
  ) {
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
    const boardWidth = safeNumeric(board.width);
    const boardHeight = safeNumeric(board.height);
    const numApples = safeNumeric(board.num_apples);

    const totalCost = safeNumeric(totals.cost);

    const participants: any[] = [];
    let totalScore = 0;

    for (const [slotKey, player] of Object.entries<any>(players)) {
      const playerSlot = Number(slotKey);
      const modelName = String(player?.name ?? player?.model_id ?? '').trim();
      const score = safeNumeric(player?.final_score);
      totalScore += score;
      const result = String(player?.result ?? 'tied');
      const deathRound = player?.death?.round ?? null;
      const deathReason = player?.death?.reason ?? null;
      const cost = safeNumeric(player?.totals?.cost);

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

    // Derive replay_path relative to SnakeBench backend directory
    // This preserves the actual directory name (e.g., 'completed_games_local/snake_game_abc.json')
    const repoRoot = process.cwd();
    const backendDir = path.join(repoRoot, 'external', 'SnakeBench', 'backend');
    const replayPath = deriveReplayPath(absolutePath, backendDir);
    const gameType = String(opts.gameTypeOverride ?? gameBlock.game_type ?? metadata.game_type ?? 'arc-explainer');

    return {
      gameId, startTime, endTime, rounds, boardWidth, boardHeight, numApples,
      totalScore, totalCost, gameType, replayPath, participants
    };
  }

  /**
   * Helper to get or create a model ID by slug.
   */
  async getOrCreateModelId(client: PoolClient, modelSlug: string): Promise<number | null> {
    if (!modelSlug) return null;
    const provider = 'OpenRouter';
    const canonicalSlug = canonicalizeOpenRouterSlug(modelSlug);
    const name = canonicalSlug;

    const insertSql = `
      INSERT INTO public.models (name, provider, model_slug, is_active, test_status, trueskill_mu, trueskill_sigma, trueskill_exposed, trueskill_updated_at)
      VALUES ($1, $2, $3, TRUE, 'ranked', $4, $5, $6, NOW())
      ON CONFLICT (model_slug) DO UPDATE
        SET name = EXCLUDED.name
      RETURNING id;
    `;

    const exposed = DEFAULT_TRUESKILL_MU - 3 * DEFAULT_TRUESKILL_SIGMA;
    const { rows } = await client.query(insertSql, [
      name, provider, canonicalSlug, DEFAULT_TRUESKILL_MU, DEFAULT_TRUESKILL_SIGMA, exposed,
    ]);
    if (!rows.length) return null;
    return rows[0].id as number;
  }

  /**
   * Update model aggregate stats for a game.
   */
  private async updateAggregatesForGame(gameId: string, client: PoolClient): Promise<void> {
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

  /**
   * Update TrueSkill ratings for a game.
   */
  private async updateTrueSkillForGame(gameId: string, client: PoolClient): Promise<void> {
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
    const participants: any[] = [];

    for (const row of res.rows) {
      const mu = typeof row.trueskill_mu === 'number' ? row.trueskill_mu : DEFAULT_TRUESKILL_MU;
      const sigma = typeof row.trueskill_sigma === 'number' ? row.trueskill_sigma : DEFAULT_TRUESKILL_SIGMA;
      const rating = new Rating(mu, sigma);
      ratingGroups.push([rating]);
      const result = String(row.result ?? 'tied');
      ranks.push(RESULT_RANK[result] ?? RESULT_RANK.tied);
      participants.push({ modelId: row.model_id, pre: rating });
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

  /**
   * Update Elo ratings for a game (fallback).
   */
  private async updateEloForGame(gameId: string, client: PoolClient): Promise<void> {
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
        const expectedI = calculateExpectedElo(ratings[rowI.model_id], ratings[rowJ.model_id]);
        const expectedJ = calculateExpectedElo(ratings[rowJ.model_id], ratings[rowI.model_id]);

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

  /**
   * Reset model ratings and aggregates.
   */
  async resetModelRatings(): Promise<void> {
    if (!this.isConnected()) return;
    const exposed = DEFAULT_TRUESKILL_MU - 3 * DEFAULT_TRUESKILL_SIGMA;
    const display = exposed * TRUESKILL_DISPLAY_MULTIPLIER;
    await this.query(
      `
      UPDATE public.models
      SET
        wins = 0, losses = 0, ties = 0, apples_eaten = 0, games_played = 0,
        last_played_at = NULL, trueskill_mu = $1, trueskill_sigma = $2,
        trueskill_exposed = $3, trueskill_updated_at = NOW(), elo_rating = $4, updated_at = NOW();
      `,
      [DEFAULT_TRUESKILL_MU, DEFAULT_TRUESKILL_SIGMA, exposed, display],
    );
  }

  /**
   * Deactivate OpenRouter models not present in the curated slug list.
   */
  async deactivateOpenRouterModelsNotIn(allowedSlugs: string[]): Promise<number> {
    if (!this.isConnected()) return 0;
    if (!allowedSlugs.length) return 0;
    const sql = `
      UPDATE public.models
      SET is_active = FALSE, updated_at = NOW()
      WHERE LOWER(provider) = 'openrouter'
        AND NOT (model_slug = ANY($1::text[]));
    `;
    const result = await this.query(sql, [allowedSlugs]);
    return result.rowCount || 0;
  }

  /**
   * Backfill games from a directory.
   */
  async backfillFromDirectory(completedDir: string): Promise<void> {
    if (!this.isConnected()) return;

    const dirPath = path.isAbsolute(completedDir) ? completedDir : path.join(process.cwd(), completedDir);
    const entries = await fs.promises.readdir(dirPath);
    const files = entries.filter((f) => /^snake_game_.*\.json$/i.test(f));

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
