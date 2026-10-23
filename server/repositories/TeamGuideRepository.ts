/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-22
 * PURPOSE: Persist private team reference documents outside the public source and assets.
 * SRP/DRY check: Pass - reuses the existing database pool; HTTP and validation live elsewhere.
 */
import { randomBytes } from 'node:crypto';
import { BaseRepository } from './base/BaseRepository';

export class TeamGuideRepository extends BaseRepository {
  async get(key: string): Promise<string | null> {
    if (!this.isConnected()) return null;
    const result = await this.query<{ body: string }>('SELECT body FROM team_guides WHERE guide_key = $1', [key]);
    return result.rows[0]?.body ?? null;
  }
  async ensureShareKey(key: string): Promise<string | null> {
    if (!this.isConnected()) return null;
    // A separate runtime row keeps the capability out of public source and preserves it
    // across publication. ON CONFLICT also makes concurrent first publications safe.
    const shareRow = key + '-share-key';
    await this.query('INSERT INTO team_guides (guide_key, body) VALUES ($1, $2) ON CONFLICT (guide_key) DO NOTHING', [shareRow, randomBytes(32).toString('base64url')]);
    return this.get(shareRow);
  }
  async put(key: string, body: string): Promise<boolean> {
    if (!this.isConnected()) return false;
    await this.query('INSERT INTO team_guides (guide_key, body, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (guide_key) DO UPDATE SET body = EXCLUDED.body, updated_at = CURRENT_TIMESTAMP', [key, body]);
    return true;
  }
}
export const teamGuideRepository = new TeamGuideRepository();
