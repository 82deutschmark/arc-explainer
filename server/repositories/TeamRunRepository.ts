/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: Storage for the team-only Kaggle runs record (first user: ARC-AGI-2, Son's ask,
 *          19-Oct-2026). Two kinds of data, kept apart because they have different owners:
 *
 *          - Run documents, written by the Mac Mini's watcher (scripts/arc2_runs/ in this
 *            repo). One JSON document per Kaggle submission: what Kaggle says about it, the
 *            proposed baseline, the kept log, Claude's note. Overwritten in place on every
 *            publish; the Mini keeps the history on its own disk.
 *          - Team notes, written by people signed in on the team page: which run this one is
 *            judged against (overriding the Mini's guess), and a short note. Each edit is
 *            also appended to team_run_note_log, which is never changed afterwards.
 *
 *          Bodies are JSON TEXT, served almost verbatim, like kaggle_board_documents.
 * SRP/DRY check: Pass - storage only; HTTP in routes/teamRuns.ts, sign-in in
 *          middleware/teamSession.ts. Reuses BaseRepository's pool, transaction and
 *          isConnected guard; tables are created in DatabaseSchema.ts with all the others.
 */

import { BaseRepository } from './base/BaseRepository.js';
import { logger } from '../utils/logger.js';

export interface TeamRunNote {
  /** A run key, the word "none", or null (use the watcher's guess). */
  baseline: string | null;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

interface DocumentRow {
  run_key: string;
  body: string;
  updated_at: Date | string;
}

interface NoteRow {
  run_key: string;
  baseline: string | null;
  note: string | null;
  updated_by: string | null;
  updated_at: Date | string;
}

const toNote = (row: NoteRow): TeamRunNote => ({
  baseline: row.baseline,
  note: row.note,
  updatedBy: row.updated_by,
  updatedAt: new Date(row.updated_at).toISOString(),
});

export class TeamRunRepository extends BaseRepository {
  /** Replace one run's document. Returns false when there is no database. */
  async saveDocument(competition: string, runKey: string, body: string): Promise<boolean> {
    if (!this.isConnected()) {
      logger.warn('No database; team run document not stored.', 'team-runs');
      return false;
    }
    await this.query(
      `INSERT INTO team_run_documents (competition, run_key, body, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (competition, run_key)
       DO UPDATE SET body = EXCLUDED.body, updated_at = CURRENT_TIMESTAMP`,
      [competition, runKey, body],
    );
    return true;
  }

  /** Every run document for a competition, as raw JSON text. */
  async listDocuments(competition: string): Promise<Array<{ runKey: string; body: string; updatedAt: string }>> {
    if (!this.isConnected()) return [];
    const result = await this.query<DocumentRow>(
      `SELECT run_key, body, updated_at FROM team_run_documents WHERE competition = $1`,
      [competition],
    );
    return result.rows.map((r) => ({ runKey: r.run_key, body: r.body, updatedAt: new Date(r.updated_at).toISOString() }));
  }

  async getDocument(competition: string, runKey: string): Promise<string | null> {
    if (!this.isConnected()) return null;
    const result = await this.query<DocumentRow>(
      `SELECT run_key, body, updated_at FROM team_run_documents WHERE competition = $1 AND run_key = $2`,
      [competition, runKey],
    );
    return result.rows[0]?.body ?? null;
  }

  async listNotes(competition: string): Promise<Record<string, TeamRunNote>> {
    if (!this.isConnected()) return {};
    const result = await this.query<NoteRow>(
      `SELECT run_key, baseline, note, updated_by, updated_at FROM team_run_notes WHERE competition = $1`,
      [competition],
    );
    return Object.fromEntries(result.rows.map((r) => [r.run_key, toNote(r)]));
  }

  async getNote(competition: string, runKey: string): Promise<TeamRunNote | null> {
    if (!this.isConnected()) return null;
    const result = await this.query<NoteRow>(
      `SELECT run_key, baseline, note, updated_by, updated_at FROM team_run_notes
        WHERE competition = $1 AND run_key = $2`,
      [competition, runKey],
    );
    return result.rows[0] ? toNote(result.rows[0]) : null;
  }

  /** Set a run's note (both fields replaced) and append the edit to the log, in one transaction. */
  async saveNote(
    competition: string,
    runKey: string,
    fields: { baseline: string | null; note: string | null; updatedBy: string | null },
  ): Promise<TeamRunNote | null> {
    if (!this.isConnected()) return null;
    const row = await this.transaction(async (client) => {
      const saved = await client.query<NoteRow>(
        `INSERT INTO team_run_notes (competition, run_key, baseline, note, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (competition, run_key)
         DO UPDATE SET baseline = EXCLUDED.baseline, note = EXCLUDED.note,
                       updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
         RETURNING run_key, baseline, note, updated_by, updated_at`,
        [competition, runKey, fields.baseline, fields.note, fields.updatedBy],
      );
      await client.query(
        `INSERT INTO team_run_note_log (competition, run_key, baseline, note, updated_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [competition, runKey, fields.baseline, fields.note, fields.updatedBy],
      );
      return saved.rows[0];
    });
    logger.info(`Team run note saved: ${competition} ${runKey} by ${fields.updatedBy ?? 'unknown'}`, 'team-runs');
    return toNote(row);
  }
}

export const teamRunRepository = new TeamRunRepository();
