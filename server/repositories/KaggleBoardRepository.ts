/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: Stores and reads the full public Kaggle leaderboard for the public
 *          /kaggle-leaderboard page: every team now, our own half-hourly history of the
 *          board, the feed of score changes, and the one-off backfill of the days before we
 *          started saving it.
 *
 *          WHERE THE DATA COMES FROM. The Mac Mini runs scripts/leaderboard_snapshot.py in
 *          the arc-3 repo every 30 minutes. That script reads Kaggle (the site cannot: the
 *          Kaggle CLI's login expires and needs a human at a browser, see
 *          KaggleStandingRepository) and keeps the running history itself. After each run
 *          it pushes its files here. So this repository never accumulates anything; it
 *          only keeps the newest copy of each document, overwritten in place.
 *
 *          Bodies are stored and returned as JSON TEXT. They are served verbatim, never
 *          queried, and are up to a megabyte each; parsing them here would only cost time.
 * SRP/DRY check: Pass - KaggleStandingRepository owns our single-team standing (the
 *          landing page's live placing); this owns the whole board for the leaderboard page
 *          and nothing else. Reuses BaseRepository's pool and isConnected() guard; table
 *          creation lives in DatabaseSchema.ts with every other table.
 */

import { BaseRepository } from './base/BaseRepository.js';
import { logger } from '../utils/logger.js';

/** The documents the snapshot job pushes. backfill is static and pushed rarely. */
export const KAGGLE_BOARD_DOCUMENTS = ['latest', 'history', 'events', 'backfill'] as const;
export type KaggleBoardDocumentName = (typeof KAGGLE_BOARD_DOCUMENTS)[number];

export interface KaggleBoardDocument {
  name: KaggleBoardDocumentName;
  capturedAt: string;
  /** Raw JSON text exactly as pushed. */
  body: string;
}

interface DocumentRow {
  name: KaggleBoardDocumentName;
  captured_at: Date | string;
  body: string;
}

export class KaggleBoardRepository extends BaseRepository {
  /**
   * Replace the stored copy of each given document in one transaction, so a reader never
   * sees a new latest board beside an old history. Returns false when there is no database.
   */
  async saveDocuments(
    competition: string,
    capturedAt: string,
    documents: Array<{ name: KaggleBoardDocumentName; body: string }>,
  ): Promise<boolean> {
    if (!this.isConnected()) {
      logger.warn('No database; Kaggle board not stored.', 'kaggle-board');
      return false;
    }

    await this.transaction(async (client) => {
      for (const doc of documents) {
        await client.query(
          `INSERT INTO kaggle_board_documents (competition, name, captured_at, body, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (competition, name)
           DO UPDATE SET captured_at = EXCLUDED.captured_at,
                         body = EXCLUDED.body,
                         updated_at = CURRENT_TIMESTAMP`,
          [competition, doc.name, capturedAt, doc.body],
        );
      }
    });

    logger.info(
      `Kaggle board stored: ${competition} @ ${capturedAt} (${documents.map((d) => d.name).join(', ')})`,
      'kaggle-board',
    );
    return true;
  }

  /** The named documents that exist for a competition. Missing ones are simply absent. */
  async getDocuments(
    competition: string,
    names: readonly KaggleBoardDocumentName[],
  ): Promise<KaggleBoardDocument[]> {
    if (!this.isConnected()) return [];

    const result = await this.query<DocumentRow>(
      `SELECT name, captured_at, body
         FROM kaggle_board_documents
        WHERE competition = $1 AND name = ANY($2::text[])`,
      [competition, [...names]],
    );

    return result.rows.map((row) => ({
      name: row.name,
      capturedAt: new Date(row.captured_at).toISOString(),
      body: row.body,
    }));
  }
}

export const kaggleBoardRepository = new KaggleBoardRepository();
