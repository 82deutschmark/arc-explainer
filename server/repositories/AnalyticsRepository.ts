/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27
 * PURPOSE: AnalyticsRepository - Handles complex data aggregations, model insights,
 *          and run-length distributions for Worm Arena/SnakeBench.
 *          INTERCHANGEABLE: "Game" and "Match" refer to the same entity.
 * SRP/DRY check: Pass - focused exclusively on analytical data processing.
 */

import { PoolClient } from 'pg';
import { BaseRepository } from './base/BaseRepository.ts';
import {
  SQL_NORMALIZE_SLUG,
  logRepoError,
  safeNumeric,
} from './snakebenchSqlHelpers.ts';
import type {
  WormArenaModelInsightsSummary,
  WormArenaModelInsightsFailureMode,
  WormArenaModelInsightsOpponent,
  WormArenaRunLengthDistributionData,
  WormArenaRunLengthModelData,
} from '../../shared/types.js';

export class AnalyticsRepository extends BaseRepository {
  /**
   * Aggregate per-model insights for the Worm Arena Models page report.
   */
  async getModelInsightsData(
    modelSlug: string,
    client?: PoolClient
  ): Promise<{
    summary: WormArenaModelInsightsSummary;
    failureModes: WormArenaModelInsightsFailureMode[];
    lossOpponents: WormArenaModelInsightsOpponent[];
  } | null> {
    if (!this.isConnected() || !modelSlug) return null;

    const earlyLossThreshold = 5;

    try {
      const summarySql = `
        SELECT
          COUNT(*) AS games_played,
          SUM(CASE WHEN gp.result = 'won' THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN gp.result = 'lost' THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN gp.result = 'tied' THEN 1 ELSE 0 END) AS ties,
          COALESCE(SUM(gp.cost), 0) AS total_cost,
          AVG(g.rounds) AS avg_rounds,
          MIN(g.rounds) AS min_rounds,
          MAX(g.rounds) AS max_rounds,
          AVG(gp.score) AS avg_score,
          MAX(gp.score) AS max_score,
          MIN(gp.score) AS min_score,
          COALESCE(SUM(gp.score), 0) AS total_apples,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gp.score) AS median_score,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gp.score) AS p75_score,
          AVG(CASE WHEN gp.result = 'lost' THEN gp.death_round END) AS avg_death_round_loss,
          SUM(CASE WHEN gp.result = 'lost' AND gp.death_round IS NOT NULL AND gp.death_round <= $2 THEN 1 ELSE 0 END) AS early_losses,
          SUM(CASE WHEN gp.result = 'lost' AND gp.death_reason IS NOT NULL THEN 1 ELSE 0 END) AS losses_with_reason,
          SUM(CASE WHEN gp.result = 'lost' AND gp.death_reason IS NULL THEN 1 ELSE 0 END) AS losses_without_reason,
          m.trueskill_mu,
          m.trueskill_sigma,
          m.trueskill_exposed
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        WHERE ${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
          AND g.status = 'completed' AND COALESCE(g.rounds, 0) > 0
        GROUP BY m.trueskill_mu, m.trueskill_sigma, m.trueskill_exposed;
      `;

      const summaryRes = await this.query(summarySql, [modelSlug, earlyLossThreshold], client);
      const row: any = summaryRes.rows[0] ?? {};

      // Calculate leaderboard ranking by TrueSkill exposed rating
      const rankingSql = `
        WITH ranked_models AS (
          SELECT
            ${SQL_NORMALIZE_SLUG('m.model_slug')} AS normalized_slug,
            COALESCE(m.trueskill_exposed, m.trueskill_mu - 3 * m.trueskill_sigma) AS exposed_rating,
            ROW_NUMBER() OVER (ORDER BY COALESCE(m.trueskill_exposed, m.trueskill_mu - 3 * m.trueskill_sigma) DESC) AS rank
          FROM public.models m
          JOIN public.game_participants gp ON m.id = gp.model_id
          JOIN public.games g ON gp.game_id = g.id
          WHERE g.status = 'completed' AND COALESCE(g.rounds, 0) > 0
          GROUP BY ${SQL_NORMALIZE_SLUG('m.model_slug')}, m.trueskill_exposed, m.trueskill_mu, m.trueskill_sigma
        )
        SELECT
          rank,
          (SELECT COUNT(*) FROM ranked_models) AS total_models,
          exposed_rating
        FROM ranked_models
        WHERE ${SQL_NORMALIZE_SLUG('normalized_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
      `;

      const rankingRes = await this.query(rankingSql, [modelSlug], client);
      const rankingRow: any = rankingRes.rows[0];
      const leaderboardRank = rankingRow?.rank ? parseInt(String(rankingRow.rank), 10) : null;
      const totalModelsRanked = rankingRow?.total_models ? parseInt(String(rankingRow.total_models), 10) : null;

      const wins = parseInt(String(row.wins || '0'), 10);
      const losses = parseInt(String(row.losses || '0'), 10);
      const gamesPlayed = parseInt(String(row.games_played || '0'), 10);
      const totalCost = Number(row.total_cost || 0);

      const summary: WormArenaModelInsightsSummary = {
        gamesPlayed, wins, losses,
        ties: parseInt(String(row.ties || '0'), 10),
        winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
        totalCost,
        costPerGame: gamesPlayed > 0 ? totalCost / gamesPlayed : null,
        costPerWin: wins > 0 ? totalCost / wins : null,
        costPerLoss: losses > 0 ? totalCost / losses : null,
        // Round statistics
        averageRounds: row.avg_rounds != null ? Number(row.avg_rounds) : null,
        minRounds: row.min_rounds != null ? Number(row.min_rounds) : null,
        maxRounds: row.max_rounds != null ? Number(row.max_rounds) : null,
        // Score/apple statistics
        averageScore: row.avg_score != null ? Number(row.avg_score) : null,
        minScore: row.min_score != null ? Number(row.min_score) : null,
        maxScore: row.max_score != null ? Number(row.max_score) : null,
        medianScore: row.median_score != null ? Number(row.median_score) : null,
        p75Score: row.p75_score != null ? Number(row.p75_score) : null,
        totalApples: parseInt(String(row.total_apples || '0'), 10),
        // Death statistics
        averageDeathRoundLoss: row.avg_death_round_loss != null ? Number(row.avg_death_round_loss) : null,
        earlyLosses: parseInt(String(row.early_losses || '0'), 10),
        earlyLossRate: losses > 0 ? parseInt(String(row.early_losses || '0'), 10) / losses : 0,
        lossDeathReasonCoverage: losses > 0 ? parseInt(String(row.losses_with_reason || '0'), 10) / losses : 0,
        unknownLosses: parseInt(String(row.losses_without_reason || '0'), 10),
        // TrueSkill rating
        trueSkillMu: row.trueskill_mu != null ? Number(row.trueskill_mu) : null,
        trueSkillSigma: row.trueskill_sigma != null ? Number(row.trueskill_sigma) : null,
        trueSkillExposed: row.trueskill_exposed != null ? Number(row.trueskill_exposed) : null,
      };

      const failureSql = `
        SELECT COALESCE(gp.death_reason, 'unknown') AS death_reason, COUNT(*) AS losses, AVG(gp.death_round) AS avg_death_round
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        WHERE ${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
          AND g.status = 'completed' AND COALESCE(g.rounds, 0) > 0 AND gp.result = 'lost'
        GROUP BY death_reason ORDER BY losses DESC;
      `;
      const failureRes = await this.query(failureSql, [modelSlug], client);
      const failureModes: WormArenaModelInsightsFailureMode[] = failureRes.rows.map((r: any) => ({
        reason: String(r.death_reason),
        losses: parseInt(String(r.losses), 10),
        percentOfLosses: losses > 0 ? parseInt(String(r.losses), 10) / losses : 0,
        averageDeathRound: r.avg_death_round != null ? Number(r.avg_death_round) : null,
      }));

      const opponentSql = `
        SELECT ${SQL_NORMALIZE_SLUG('opp.model_slug')} AS opponent_slug, COUNT(*) AS games_played,
               SUM(CASE WHEN gp.result = 'won' THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN gp.result = 'lost' THEN 1 ELSE 0 END) AS losses,
               SUM(CASE WHEN gp.result = 'tied' THEN 1 ELSE 0 END) AS ties,
               MAX(COALESCE(g.start_time, g.created_at)) AS last_played_at
        FROM public.game_participants gp
        JOIN public.models m ON gp.model_id = m.id
        JOIN public.games g ON gp.game_id = g.id
        LEFT JOIN public.game_participants opp_gp ON opp_gp.game_id = gp.game_id AND opp_gp.player_slot <> gp.player_slot
        LEFT JOIN public.models opp ON opp_gp.model_id = opp.id
        WHERE ${SQL_NORMALIZE_SLUG('m.model_slug')} = ${SQL_NORMALIZE_SLUG('$1')}
          AND g.status = 'completed' AND COALESCE(g.rounds, 0) > 0 AND opp.model_slug IS NOT NULL
        GROUP BY opponent_slug ORDER BY losses DESC, games_played DESC LIMIT 5;
      `;
      const opponentRes = await this.query(opponentSql, [modelSlug], client);
      const lossOpponents: WormArenaModelInsightsOpponent[] = opponentRes.rows.map((r: any) => {
        const oppGames = parseInt(String(r.games_played), 10);
        return {
          opponentSlug: String(r.opponent_slug),
          gamesPlayed: oppGames,
          wins: parseInt(String(r.wins), 10),
          losses: parseInt(String(r.losses), 10),
          ties: parseInt(String(r.ties), 10),
          lossRate: oppGames > 0 ? parseInt(String(r.losses), 10) / oppGames : 0,
          lastPlayedAt: r.last_played_at ? new Date(r.last_played_at).toISOString() : null,
        };
      });

      return { summary, failureModes, lossOpponents };
    } catch (error) {
      logRepoError('getModelInsightsData', error);
      return null;
    }
  }

  /**
   * Get run length distribution data.
   */
  async getRunLengthDistribution(minGames: number = 5, client?: PoolClient): Promise<WormArenaRunLengthDistributionData> {
    if (!this.isConnected()) return { minGamesThreshold: minGames, modelsIncluded: 0, totalGamesAnalyzed: 0, distributionData: [], timestamp: Date.now() };

    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, Math.min(minGames, 1000)) : 5;

    try {
      const sql = `
        SELECT ${SQL_NORMALIZE_SLUG('m.model_slug')} AS model_slug, COALESCE(g.rounds, 0) AS rounds, gp.result, COUNT(*) AS frequency
        FROM public.game_participants gp
        JOIN public.games g ON gp.game_id = g.id
        JOIN public.models m ON gp.model_id = m.id
        WHERE g.status = 'completed' AND COALESCE(g.rounds, 0) > 0
        GROUP BY model_slug, rounds, gp.result ORDER BY model_slug, rounds;
      `;

      const result = await this.query(sql, [], client);
      const rows = result.rows;

      const modelMap = new Map<string, Map<number, { wins: number; losses: number }>>();
      const modelGameCounts = new Map<string, number>();
      let totalGamesAnalyzed = 0;

      rows.forEach((row: any) => {
        const slug = String(row.model_slug);
        const rounds = Number(row.rounds);
        const res = String(row.result).toLowerCase();
        const freq = parseInt(String(row.frequency), 10);

        modelGameCounts.set(slug, (modelGameCounts.get(slug) || 0) + freq);
        if (!modelMap.has(slug)) modelMap.set(slug, new Map());
        const binMap = modelMap.get(slug)!;
        if (!binMap.has(rounds)) binMap.set(rounds, { wins: 0, losses: 0 });
        const bin = binMap.get(rounds)!;

        if (res === 'won') bin.wins += freq;
        else if (res === 'lost') bin.losses += freq;

        if (res === 'won' || res === 'lost') totalGamesAnalyzed += freq;
      });

      const distributionData: WormArenaRunLengthModelData[] = Array.from(modelMap.entries())
        .filter(([slug]) => (modelGameCounts.get(slug) || 0) >= safeMinGames)
        .map(([slug, binMap]) => ({
          modelSlug: slug,
          totalGames: modelGameCounts.get(slug)!,
          bins: Array.from(binMap.entries()).map(([rounds, b]) => ({ rounds, ...b })).sort((a, b) => a.rounds - b.rounds),
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
      logRepoError('getRunLengthDistribution', error);
      return { minGamesThreshold: safeMinGames, modelsIncluded: 0, totalGamesAnalyzed: 0, distributionData: [], timestamp: Date.now() };
    }
  }
}
