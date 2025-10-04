/*
 * Author: Cascade using Deep Research Model  
 * Date: 2025-10-03T21:05:00Z
 * PURPOSE: Repository for managing model_overrides table operations
 *          Handles active/inactive toggles, aliases, and UI-added model persistence
 * SRP/DRY check: Pass - Single responsibility for model override database operations
 * shadcn/ui: N/A - Backend repository
 */

import { BaseRepository } from './base/BaseRepository.js';
import type { ModelConfig } from '@shared/types';

export interface ModelOverride {
  id: number;
  modelKey: string;
  isActive: boolean;
  aliasFor?: string;
  notes?: string;
  addedVia: 'config' | 'ui' | 'openrouter';
  addedAt: Date;
  updatedAt: Date;
  configJson?: ModelConfig;
}

export class ModelOverrideRepository extends BaseRepository {
  /**
   * Get all model overrides
   */
  async getAll(): Promise<ModelOverride[]> {
    const query = `
      SELECT 
        id,
        model_key as "modelKey",
        is_active as "isActive",
        alias_for as "aliasFor",
        notes,
        added_via as "addedVia",
        added_at as "addedAt",
        updated_at as "updatedAt",
        config_json as "configJson"
      FROM model_overrides
      ORDER BY model_key
    `;
    
    const result = await this.query(query);
    return result.rows;
  }

  /**
   * Get override for a specific model
   */
  async getByKey(modelKey: string): Promise<ModelOverride | null> {
    const query = `
      SELECT 
        id,
        model_key as "modelKey",
        is_active as "isActive",
        alias_for as "aliasFor",
        notes,
        added_via as "addedVia",
        added_at as "addedAt",
        updated_at as "updatedAt",
        config_json as "configJson"
      FROM model_overrides
      WHERE model_key = $1
    `;
    
    const result = await this.query(query, [modelKey]);
    return result.rows[0] || null;
  }

  /**
   * Toggle active status for a model
   */
  async toggleActive(modelKey: string): Promise<ModelOverride> {
    // Check if override exists
    const existing = await this.getByKey(modelKey);
    
    if (existing) {
      // Update existing override
      const query = `
        UPDATE model_overrides
        SET is_active = NOT is_active
        WHERE model_key = $1
        RETURNING 
          id,
          model_key as "modelKey",
          is_active as "isActive",
          alias_for as "aliasFor",
          notes,
          added_via as "addedVia",
          added_at as "addedAt",
          updated_at as "updatedAt",
          config_json as "configJson"
      `;
      
      const result = await this.query(query, [modelKey]);
      return result.rows[0];
    } else {
      // Create new override with is_active = false
      return this.createOverride({
        modelKey,
        isActive: false,
        addedVia: 'config'
      });
    }
  }

  /**
   * Create an alias for a model
   */
  async createAlias(aliasKey: string, targetKey: string, notes?: string): Promise<ModelOverride> {
    const query = `
      INSERT INTO model_overrides (model_key, alias_for, notes, added_via)
      VALUES ($1, $2, $3, 'ui')
      ON CONFLICT (model_key) 
      DO UPDATE SET alias_for = $2, notes = $3
      RETURNING 
        id,
        model_key as "modelKey",
        is_active as "isActive",
        alias_for as "aliasFor",
        notes,
        added_via as "addedVia",
        added_at as "addedAt",
        updated_at as "updatedAt",
        config_json as "configJson"
    `;
    
    const result = await this.query(query, [aliasKey, targetKey, notes || null]);
    return result.rows[0];
  }

  /**
   * Add a new model via UI (stores full config)
   */
  async addModel(modelConfig: ModelConfig): Promise<ModelOverride> {
    const query = `
      INSERT INTO model_overrides (
        model_key, 
        is_active, 
        notes, 
        added_via, 
        config_json
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (model_key)
      DO UPDATE SET 
        is_active = $2,
        notes = $3,
        config_json = $5
      RETURNING 
        id,
        model_key as "modelKey",
        is_active as "isActive",
        alias_for as "aliasFor",
        notes,
        added_via as "addedVia",
        added_at as "addedAt",
        updated_at as "updatedAt",
        config_json as "configJson"
    `;
    
    const result = await this.query(query, [
      modelConfig.key,
      modelConfig.isActive !== false, // Default to true
      modelConfig.notes || null,
      modelConfig.addedVia || 'ui',
      JSON.stringify(modelConfig)
    ]);
    
    return result.rows[0];
  }

  /**
   * Update model notes
   */
  async updateNotes(modelKey: string, notes: string): Promise<ModelOverride> {
    const existing = await this.getByKey(modelKey);
    
    if (existing) {
      const query = `
        UPDATE model_overrides
        SET notes = $2
        WHERE model_key = $1
        RETURNING 
          id,
          model_key as "modelKey",
          is_active as "isActive",
          alias_for as "aliasFor",
          notes,
          added_via as "addedVia",
          added_at as "addedAt",
          updated_at as "updatedAt",
          config_json as "configJson"
      `;
      
      const result = await this.query(query, [modelKey, notes]);
      return result.rows[0];
    } else {
      return this.createOverride({
        modelKey,
        isActive: true,
        notes,
        addedVia: 'config'
      });
    }
  }

  /**
   * Delete an override (restores default behavior)
   */
  async delete(modelKey: string): Promise<boolean> {
    const query = `DELETE FROM model_overrides WHERE model_key = $1`;
    const result = await this.query(query, [modelKey]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Create a basic override
   */
  private async createOverride(data: {
    modelKey: string;
    isActive: boolean;
    aliasFor?: string;
    notes?: string;
    addedVia: 'config' | 'ui' | 'openrouter';
  }): Promise<ModelOverride> {
    const query = `
      INSERT INTO model_overrides (model_key, is_active, alias_for, notes, added_via)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        model_key as "modelKey",
        is_active as "isActive",
        alias_for as "aliasFor",
        notes,
        added_via as "addedVia",
        added_at as "addedAt",
        updated_at as "updatedAt",
        config_json as "configJson"
    `;
    
    const result = await this.query(query, [
      data.modelKey,
      data.isActive,
      data.aliasFor || null,
      data.notes || null,
      data.addedVia
    ]);
    
    return result.rows[0];
  }
}
