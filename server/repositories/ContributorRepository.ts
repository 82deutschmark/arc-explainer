/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Repository for managing ARC contributor data in the database.
 * Handles CRUD operations for notable human contributors to the ARC-AGI challenge.
 * Extends BaseRepository for consistent database access patterns.
 * SRP/DRY check: Pass - Single responsibility for contributor database operations
 */

import { BaseRepository } from './base/BaseRepository.ts';
import type { ArcContributor, CreateContributorRequest } from '@shared/types/contributor.ts';
import { logger } from '../utils/logger.ts';

export class ContributorRepository extends BaseRepository {

  /**
   * Get all contributors with optional filtering
   */
  async getAllContributors(filters?: {
    category?: string;
    yearStart?: number;
    limit?: number;
  }): Promise<ArcContributor[]> {
    try {
      let query = `
        SELECT
          id,
          full_name,
          handle,
          affiliation,
          achievement,
          description,
          year_start,
          year_end,
          score,
          approach,
          unique_technique,
          links,
          team_name,
          category,
          image_url,
          rank,
          created_at
        FROM arc_contributors
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (filters?.category) {
        query += ` AND category = $${paramCount++}`;
        params.push(filters.category);
      }

      if (filters?.yearStart) {
        query += ` AND year_start >= $${paramCount++}`;
        params.push(filters.yearStart);
      }

      query += ` ORDER BY rank ASC NULLS LAST, year_start DESC, id DESC`;

      if (filters?.limit) {
        query += ` LIMIT $${paramCount++}`;
        params.push(filters.limit);
      }

      const result = await this.query(query, params);
      return result.rows.map(this.mapRowToContributor);
    } catch (error) {
      logger.error(`Failed to get contributors: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Get a single contributor by ID
   */
  async getContributorById(id: number): Promise<ArcContributor | null> {
    try {
      const result = await this.query(
        `SELECT * FROM arc_contributors WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContributor(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get contributor by ID: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Create a new contributor
   */
  async createContributor(data: CreateContributorRequest): Promise<ArcContributor> {
    try {
      const result = await this.query(
        `
        INSERT INTO arc_contributors (
          full_name,
          handle,
          affiliation,
          achievement,
          description,
          year_start,
          year_end,
          score,
          approach,
          unique_technique,
          links,
          team_name,
          category,
          image_url,
          rank
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
        `,
        [
          data.fullName,
          data.handle || null,
          data.affiliation || null,
          data.achievement,
          data.description,
          data.yearStart || null,
          data.yearEnd || null,
          data.score || null,
          data.approach || null,
          data.uniqueTechnique || null,
          JSON.stringify(data.links || {}),
          data.teamName || null,
          data.category,
          data.imageUrl || null,
          data.rank || null
        ]
      );

      return this.mapRowToContributor(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to create contributor: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Update an existing contributor
   */
  async updateContributor(id: number, data: Partial<CreateContributorRequest>): Promise<ArcContributor | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.fullName !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(data.fullName);
      }
      if (data.handle !== undefined) {
        updates.push(`handle = $${paramCount++}`);
        values.push(data.handle);
      }
      if (data.affiliation !== undefined) {
        updates.push(`affiliation = $${paramCount++}`);
        values.push(data.affiliation);
      }
      if (data.achievement !== undefined) {
        updates.push(`achievement = $${paramCount++}`);
        values.push(data.achievement);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.yearStart !== undefined) {
        updates.push(`year_start = $${paramCount++}`);
        values.push(data.yearStart);
      }
      if (data.yearEnd !== undefined) {
        updates.push(`year_end = $${paramCount++}`);
        values.push(data.yearEnd);
      }
      if (data.score !== undefined) {
        updates.push(`score = $${paramCount++}`);
        values.push(data.score);
      }
      if (data.approach !== undefined) {
        updates.push(`approach = $${paramCount++}`);
        values.push(data.approach);
      }
      if (data.uniqueTechnique !== undefined) {
        updates.push(`unique_technique = $${paramCount++}`);
        values.push(data.uniqueTechnique);
      }
      if (data.links !== undefined) {
        updates.push(`links = $${paramCount++}`);
        values.push(JSON.stringify(data.links));
      }
      if (data.teamName !== undefined) {
        updates.push(`team_name = $${paramCount++}`);
        values.push(data.teamName);
      }
      if (data.category !== undefined) {
        updates.push(`category = $${paramCount++}`);
        values.push(data.category);
      }
      if (data.imageUrl !== undefined) {
        updates.push(`image_url = $${paramCount++}`);
        values.push(data.imageUrl);
      }
      if (data.rank !== undefined) {
        updates.push(`rank = $${paramCount++}`);
        values.push(data.rank);
      }

      if (updates.length === 0) {
        return this.getContributorById(id);
      }

      values.push(id);
      const result = await this.query(
        `UPDATE arc_contributors SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContributor(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to update contributor: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Delete a contributor
   */
  async deleteContributor(id: number): Promise<boolean> {
    try {
      const result = await this.query(
        `DELETE FROM arc_contributors WHERE id = $1`,
        [id]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Failed to delete contributor: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Delete all contributors (for seeding)
   */
  async deleteAllContributors(): Promise<void> {
    try {
      await this.query(`TRUNCATE TABLE arc_contributors RESTART IDENTITY`);
      logger.info('Cleared all contributors from database', 'contributor-repository');
    } catch (error) {
      logger.error(`Failed to delete all contributors: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Upsert a contributor by fullName - insert if not exists, update if exists.
   * Safe for auto-sync on server startup.
   */
  async upsertContributor(data: CreateContributorRequest): Promise<ArcContributor> {
    try {
      // Try to find existing contributor by full name
      const existing = await this.query(
        `SELECT id FROM arc_contributors WHERE full_name = $1`,
        [data.fullName]
      );

      if (existing.rows.length > 0) {
        // Update existing contributor
        const updated = await this.updateContributor(existing.rows[0].id, data);
        if (updated) return updated;
        throw new Error('Update failed unexpectedly');
      } else {
        // Insert new contributor
        return await this.createContributor(data);
      }
    } catch (error) {
      logger.error(`Failed to upsert contributor ${data.fullName}: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Get the count of contributors in the table
   */
  async getContributorCount(): Promise<number> {
    try {
      const result = await this.query(`SELECT COUNT(*) as count FROM arc_contributors`);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error(`Failed to get contributor count: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      return 0;
    }
  }

  /**
   * Get count of contributors by category
   */
  async getCountsByCategory(): Promise<Record<string, number>> {
    try {
      const result = await this.query(
        `SELECT category, COUNT(*) as count FROM arc_contributors GROUP BY category`
      );

      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[row.category] = parseInt(row.count, 10);
      }

      return counts;
    } catch (error) {
      logger.error(`Failed to get category counts: ${error instanceof Error ? error.message : String(error)}`, 'contributor-repository');
      throw error;
    }
  }

  /**
   * Map database row to ArcContributor object
   */
  private mapRowToContributor(row: any): ArcContributor {
    return {
      id: row.id,
      fullName: row.full_name,
      handle: row.handle,
      affiliation: row.affiliation,
      achievement: row.achievement,
      description: row.description,
      yearStart: row.year_start,
      yearEnd: row.year_end,
      score: row.score,
      approach: row.approach,
      uniqueTechnique: row.unique_technique,
      links: typeof row.links === 'string' ? JSON.parse(row.links) : row.links,
      teamName: row.team_name,
      category: row.category,
      imageUrl: row.image_url,
      rank: row.rank,
      createdAt: row.created_at
    };
  }
}
