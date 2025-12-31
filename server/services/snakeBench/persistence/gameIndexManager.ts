/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Manage game_index.json file (local filesystem index of completed games).
 *          Handles reading, upserting entries, deduplication, sorting by date.
 * SRP/DRY check: Pass — isolated game index file management, single responsibility.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../../utils/logger.ts';
import { GAME_INDEX_FILENAME } from '../utils/constants.ts';

export interface GameIndexEntry {
  // Canonical snake_case properties written to disk
  game_id: string;
  filename: string;
  start_time: string;
  end_time: string;
  total_score: number;
  actual_rounds: number;
  model_a: string;
  model_b: string;

  // Optional camelCase aliases for legacy rows (ts-node scripts wrote camelCase prior to 2024)
  gameId?: string;
  startTime?: string;
  endTime?: string;
  totalScore?: number;
  actualRounds?: number;
  modelA?: string;
  modelB?: string;
}

export class GameIndexManager {
  private readonly indexPath: string;

  constructor(completedDir: string) {
    this.indexPath = path.join(completedDir, GAME_INDEX_FILENAME);
  }

  /**
   * Upsert a game entry into the index.
   * Reads completed game JSON, extracts metadata, deduplicates by game_id, writes back sorted.
   */
  async upsertGameEntry(
    completedGamePath: string | undefined,
    fallbackGameId: string,
    models: { modelA: string; modelB: string }
  ): Promise<void> {
    if (!completedGamePath) return;

    const completedDir = path.dirname(this.indexPath);

    try {
      await fs.promises.mkdir(completedDir, { recursive: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `GameIndexManager.upsertGameEntry: failed to ensure directory: ${msg}`,
        'snakebench-service'
      );
      return;
    }

    // Read and parse completed game JSON
    let payload: any = null;
    try {
      const raw = await fs.promises.readFile(completedGamePath, 'utf8');
      payload = JSON.parse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `GameIndexManager.upsertGameEntry: failed to read ${completedGamePath}: ${msg}`,
        'snakebench-service'
      );
      return;
    }

    // Extract metadata from various possible structures
    const gameBlock = payload?.game ?? payload?.metadata ?? {};
    const metadata = payload?.metadata ?? {};
    const totals = payload?.totals ?? {};

    const gameId: string = gameBlock.id ?? metadata.game_id ?? fallbackGameId ?? '';
    if (!gameId) return;

    const filename = path.basename(completedGamePath);
    const startedAt = metadata.start_time ?? gameBlock.started_at ?? '';
    const endTime = metadata.end_time ?? gameBlock.ended_at ?? '';
    const actualRounds = Number(metadata.actual_rounds ?? gameBlock.rounds_played ?? 0) || 0;

    // Sum total score from possible score structures
    const scoreSource = metadata.final_scores ?? totals.scores ?? {};
    const totalScore = Object.values(scoreSource).reduce<number>((acc, val) => {
      const num = typeof val === 'number' ? val : Number(val);
      return acc + (Number.isFinite(num) ? num : 0);
    }, 0);

    const entry: GameIndexEntry = {
      game_id: gameId,
      filename,
      start_time: startedAt,
      end_time: endTime,
      total_score: totalScore,
      actual_rounds: actualRounds,
      model_a: models.modelA,
      model_b: models.modelB,
    };

    // Read existing index
    let existing: any[] = [];
    try {
      if (fs.existsSync(this.indexPath)) {
        const rawIndex = await fs.promises.readFile(this.indexPath, 'utf8');
        const parsed = JSON.parse(rawIndex);
        if (Array.isArray(parsed)) existing = parsed;
      }
    } catch {
      existing = [];
    }

    // Deduplicate by game_id and add new entry
    const filtered = existing.filter((e) => (e.game_id ?? e.gameId) !== gameId);
    filtered.push(entry);

    // Sort by start_time descending
    filtered.sort((a, b) => {
      const at = new Date(a.start_time ?? a.startTime ?? 0).getTime();
      const bt = new Date(b.start_time ?? b.startTime ?? 0).getTime();
      return bt - at;
    });

    // Write back
    try {
      await fs.promises.writeFile(this.indexPath, JSON.stringify(filtered, null, 2), 'utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `GameIndexManager.upsertGameEntry: failed to write index: ${msg}`,
        'snakebench-service'
      );
    }
  }

  /**
   * Read the full game index.
   */
  async readIndex(): Promise<GameIndexEntry[]> {
    try {
      if (!fs.existsSync(this.indexPath)) {
        return [];
      }

      const raw = await fs.promises.readFile(this.indexPath, 'utf8');
      const entries: any[] = JSON.parse(raw);
      return Array.isArray(entries) ? entries : [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`GameIndexManager.readIndex: failed to read index: ${msg}`, 'snakebench-service');
      return [];
    }
  }

  /**
   * Find the filename for a given game_id by searching the index.
   * Returns null if not found.
   */
  async findGameFilename(gameId: string): Promise<string | null> {
    const entries = await this.readIndex();
    const entry = entries.find((e) => (e.game_id ?? e.gameId) === gameId);
    return entry?.filename ?? null;
  }
}
