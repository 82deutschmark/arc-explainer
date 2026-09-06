/**
 * Author: Claude Opus 5
 * Date: 2026-09-06
 * PURPOSE: Reads and writes our standing on a public Kaggle competition leaderboard, for
 *          the arc3 landing page's live placing.
 *
 *          WHY THIS EXISTS. The landing page used to state "we are currently fifth" as a
 *          string in JSX. It was written when it was true (16-Aug-2026) and was still on
 *          the page on 06-Sep-2026, by which time we were ninth -- and the sentence beside
 *          it, naming the team one place ahead, had become wrong in a way any reader could
 *          check in ten seconds. This repository replaces that class of claim with data
 *          that carries its own timestamp.
 *
 *          WHY THE SITE NEVER CALLS KAGGLE. The Kaggle CLI authenticates with an OAuth
 *          token that expires and needs a human at a browser to renew. On Railway's
 *          ephemeral filesystem that is a page which silently stops updating and goes on
 *          confidently displaying a months-old rank -- the exact failure being designed
 *          out. Instead the Mac Mini job that ALREADY fetches this board daily, already
 *          authenticated, POSTs its result to us. See
 *          docs/2026-09-02-kaggle-leaderboard-monitoring.md, which reaches the same
 *          conclusion for scheduled jobs.
 *
 *          PEAK IS A QUERY, NOT A FIELD. "Our best ever placing" is MIN(rank) over
 *          history. Storing it as a value would reintroduce the hand-maintained claim this
 *          whole change deletes, and it would have to be edited by a human every time it
 *          improved -- which is when nobody is thinking about maintenance.
 * SRP/DRY check: Pass - searched repositories/. LeaderboardRepository owns MODEL accuracy
 *          leaderboards (our own Elo/accuracy domain) and is untouched; this owns an
 *          external competition standing and nothing else. Reuses BaseRepository's shared
 *          pool and isConnected() guard rather than opening its own connection. Table
 *          creation lives in DatabaseSchema.ts with every other table, not lazily here.
 */

import { BaseRepository } from './base/BaseRepository.js';
import { logger } from '../utils/logger.js';
import type { KaggleStanding, KaggleStandingObservation } from '../../shared/types.js';

/**
 * How long a pushed standing stays quotable as CURRENT.
 *
 * The upstream job runs daily, so a healthy standing is under 24h old. 48 tolerates
 * exactly one missed run -- a reboot, a Kaggle blip, a redeploy during the cron window --
 * without the page going quiet. Past that, silence about the current rank is correct:
 * two missed days means something is actually broken, and continuing to assert a rank we
 * have not confirmed is the original sin being fixed.
 */
export const STALE_AFTER_HOURS = 48;

/** One observation as the pusher sends it. */
export interface KaggleStandingPush {
  competition: string;
  capturedAt: string;
  rank: number;
  score: number | null;
  teamId: string;
  teamName: string | null;
  teamCount: number | null;
  leaderScore: number | null;
  submissions: number | null;
  /** Top-N table for display. Never queried, so its shape is the pusher's business. */
  topTeams: unknown;
}

interface StandingRow {
  captured_at: Date | string;
  rank: number;
  score: string | number | null;
  team_name: string | null;
  team_count: number | null;
}

/** Postgres NUMERIC comes back as a string to preserve precision; the UI wants a number. */
function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function toObservation(row: StandingRow): KaggleStandingObservation {
  return {
    capturedAt: new Date(row.captured_at).toISOString(),
    rank: row.rank,
    score: toNumber(row.score),
    teamName: row.team_name,
    teamCount: row.team_count,
  };
}

export class KaggleStandingRepository extends BaseRepository {
  /**
   * Record one observation. Idempotent on (competition, captured_at, team_id) so the
   * pusher can retry after a failed deploy without inflating history -- which would
   * corrupt nothing, but would make the archive lie about how often we looked.
   *
   * Returns false when there is no database, matching how the rest of the app degrades:
   * no DATABASE_URL is a valid local configuration, not an error.
   */
  async record(push: KaggleStandingPush): Promise<boolean> {
    if (!this.isConnected()) {
      logger.warn('No database; Kaggle standing not recorded.', 'kaggle-standing');
      return false;
    }

    await this.query(
      `INSERT INTO kaggle_leaderboard_snapshots
         (competition, captured_at, rank, score, team_id, team_name,
          team_count, leader_score, submissions, source, top_teams)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'observed', $10)
       ON CONFLICT ON CONSTRAINT kaggle_lb_unique_observation DO NOTHING`,
      [
        push.competition,
        push.capturedAt,
        push.rank,
        push.score,
        push.teamId,
        push.teamName,
        push.teamCount,
        push.leaderScore,
        push.submissions,
        push.topTeams === undefined ? null : JSON.stringify(push.topTeams),
      ],
    );

    logger.info(
      `Kaggle standing recorded: ${push.competition} rank ${push.rank} @ ${push.capturedAt}`,
      'kaggle-standing',
    );
    return true;
  }

  /**
   * Current standing and best-ever placing for one competition.
   *
   * Peak is MIN(rank) with the EARLIEST capture winning a tie -- if we hit 4th twice, the
   * honest brag is the first time we got there, not the most recent.
   *
   * Returns a fully-formed KaggleStanding even when there is no data at all (both fields
   * null). The landing page must render correctly against an empty database, so "no rows"
   * is a normal answer here and never an exception.
   */
  async getStanding(competition: string): Promise<KaggleStanding> {
    const empty: KaggleStanding = {
      competition,
      current: null,
      peak: null,
      isStale: false,
      staleAfterHours: STALE_AFTER_HOURS,
    };

    if (!this.isConnected()) return empty;

    const [latest, peak] = await Promise.all([
      this.query<StandingRow>(
        `SELECT captured_at, rank, score, team_name, team_count
           FROM kaggle_leaderboard_snapshots
          WHERE competition = $1
          ORDER BY captured_at DESC
          LIMIT 1`,
        [competition],
      ),
      this.query<StandingRow>(
        `SELECT captured_at, rank, score, team_name, team_count
           FROM kaggle_leaderboard_snapshots
          WHERE competition = $1
          ORDER BY rank ASC, captured_at ASC
          LIMIT 1`,
        [competition],
      ),
    ]);

    const current = latest.rows[0] ? toObservation(latest.rows[0]) : null;
    const ageMs = current ? Date.now() - new Date(current.capturedAt).getTime() : 0;

    return {
      competition,
      current,
      peak: peak.rows[0] ? toObservation(peak.rows[0]) : null,
      isStale: current !== null && ageMs > STALE_AFTER_HOURS * 60 * 60 * 1000,
      staleAfterHours: STALE_AFTER_HOURS,
    };
  }
}

export const kaggleStandingRepository = new KaggleStandingRepository();
