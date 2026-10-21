/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: Storage for the team-only ARC-AGI-2 eval runs (Son's ask, 21-Oct-2026): our own
 *          model-evaluation box runs, each a model scored on a panel of ARC-AGI-2 public-eval
 *          outputs, and one reasoning trace per output so the team can read where the model goes
 *          wrong. Not Kaggle submissions; those are TeamRunRepository's.
 *
 *          - team_eval_runs: one JSON document per run (config, summary, reference lines and
 *            one row per output). Overwritten in place on every publish.
 *          - team_eval_traces: one JSON document per (run, output): the puzzle, the expected and
 *            model answers, the final content and the full reasoning. A trace can only be stored
 *            for a run that exists (checked in the same statement), and deleting a run deletes
 *            its traces in one transaction.
 *
 *          Bodies are JSON TEXT, served verbatim, like team_run_documents and
 *          kaggle_board_documents. The list returns only the index fields, never the per-output
 *          rows; they are picked out in Node rather than with a jsonb cast, because JSON.stringify
 *          may write escapes (\u0000, a lone surrogate) that jsonb refuses, and one such run
 *          would otherwise break the whole list.
 * SRP/DRY check: Pass - storage only; HTTP in routes/teamEvals.ts, the machine token in
 *          middleware/arc2EvalToken.ts. Reuses BaseRepository's pool, transaction and
 *          isConnected guard; tables are created in DatabaseSchema.ts with all the others.
 */

import { BaseRepository } from './base/BaseRepository.js';
import { logger } from '../utils/logger.js';

/** What the runs list needs; the per-output rows and notes stay on the run page. */
export interface EvalRunIndexRow {
  key: string;
  title: unknown;
  createdAt: unknown;
  model: unknown;
  panel: unknown;
  summary: unknown;
  reference: unknown;
  updatedAt: string;
}

export type TraceStoreResult = 'stored' | 'no_run' | 'no_database';

interface RunRow {
  run_key: string;
  body: string;
  updated_at: Date | string;
}

function parseObject(body: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(body);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export class TeamEvalRepository extends BaseRepository {
  /** Replace one run's document. Returns false when there is no database. */
  async upsertRun(competition: string, runKey: string, body: string): Promise<boolean> {
    if (!this.isConnected()) {
      logger.warn('No database; eval run not stored.', 'team-evals');
      return false;
    }
    await this.query(
      `INSERT INTO team_eval_runs (competition, run_key, body, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (competition, run_key)
       DO UPDATE SET body = EXCLUDED.body, updated_at = CURRENT_TIMESTAMP`,
      [competition, runKey, body],
    );
    return true;
  }

  /** Replace one output's trace, only if its run exists (one statement, so no race with the check). */
  async upsertTrace(competition: string, runKey: string, outputKey: string, body: string): Promise<TraceStoreResult> {
    if (!this.isConnected()) {
      logger.warn('No database; eval trace not stored.', 'team-evals');
      return 'no_database';
    }
    const result = await this.query(
      `INSERT INTO team_eval_traces (competition, run_key, output_key, body, updated_at)
       SELECT $1::text, $2::text, $3::text, $4::text, CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM team_eval_runs WHERE competition = $1::text AND run_key = $2::text)
       ON CONFLICT (competition, run_key, output_key)
       DO UPDATE SET body = EXCLUDED.body, updated_at = CURRENT_TIMESTAMP`,
      [competition, runKey, outputKey, body],
    );
    return (result.rowCount ?? 0) > 0 ? 'stored' : 'no_run';
  }

  /** Every run's index fields, newest first (by the run's own createdAt, then by last publish). */
  async listRuns(competition: string): Promise<EvalRunIndexRow[]> {
    if (!this.isConnected()) return [];
    const result = await this.query<RunRow>(
      `SELECT run_key, body, updated_at FROM team_eval_runs WHERE competition = $1`,
      [competition],
    );
    const runs: EvalRunIndexRow[] = [];
    for (const r of result.rows) {
      const doc = parseObject(r.body);
      if (!doc) continue;
      runs.push({
        key: r.run_key,
        title: doc.title ?? null,
        createdAt: doc.createdAt ?? null,
        model: doc.model ?? null,
        panel: doc.panel ?? null,
        summary: doc.summary ?? null,
        reference: doc.reference ?? null,
        updatedAt: new Date(r.updated_at).toISOString(),
      });
    }
    const createdKey = (run: EvalRunIndexRow) => (typeof run.createdAt === 'string' ? run.createdAt : '');
    return runs.sort((a, b) => createdKey(b).localeCompare(createdKey(a)) || b.updatedAt.localeCompare(a.updatedAt));
  }

  /** One run's document as stored (JSON text), or null. */
  async getRun(competition: string, runKey: string): Promise<string | null> {
    if (!this.isConnected()) return null;
    const result = await this.query<{ body: string }>(
      `SELECT body FROM team_eval_runs WHERE competition = $1 AND run_key = $2`,
      [competition, runKey],
    );
    return result.rows[0]?.body ?? null;
  }

  /** One output's trace as stored (JSON text), or null. */
  async getTrace(competition: string, runKey: string, outputKey: string): Promise<string | null> {
    if (!this.isConnected()) return null;
    const result = await this.query<{ body: string }>(
      `SELECT body FROM team_eval_traces WHERE competition = $1 AND run_key = $2 AND output_key = $3`,
      [competition, runKey, outputKey],
    );
    return result.rows[0]?.body ?? null;
  }

  /** Remove a run and all its traces. Returns null without a database, else whether the run existed. */
  async deleteRun(competition: string, runKey: string): Promise<{ run: boolean; traces: number } | null> {
    if (!this.isConnected()) return null;
    const removed = await this.transaction(async (client) => {
      const traces = await client.query(
        `DELETE FROM team_eval_traces WHERE competition = $1 AND run_key = $2`,
        [competition, runKey],
      );
      const run = await client.query(
        `DELETE FROM team_eval_runs WHERE competition = $1 AND run_key = $2`,
        [competition, runKey],
      );
      return { run: (run.rowCount ?? 0) > 0, traces: traces.rowCount ?? 0 };
    });
    logger.info(`Eval run deleted: ${competition} ${runKey} (${removed.traces} traces)`, 'team-evals');
    return removed;
  }
}

export const teamEvalRepository = new TeamEvalRepository();
