/*
 * Author: Cascade using Deep Research Model
 * Date: 2025-10-03T20:50:00Z
 * PURPOSE: Service layer that merges config-based models with database overrides
 *          Provides unified model list with active/inactive status and aliases
 * SRP/DRY check: Pass - Single responsibility for model configuration merging
 * shadcn/ui: N/A - Backend service
 */

import { MODELS } from '../config/models.js';
import { ModelOverrideRepository } from '../repositories/ModelOverrideRepository.js';
import type { ModelConfig } from '@shared/types';

export class ModelManagementService {
  private static repo = new ModelOverrideRepository();

  /**
   * Get all models with overrides applied
   */
  static async getAllModels(includeInactive = true): Promise<ModelConfig[]> {
    // Get all overrides from database
    const overrides = await this.repo.getAll();
    const overrideMap = new Map(overrides.map(o => [o.modelKey, o]));

    // Start with config-based models
    const allModels: ModelConfig[] = MODELS.map(model => {
      const override = overrideMap.get(model.key);
      
      if (override) {
        // Apply override
        return {
          ...model,
          isActive: override.isActive,
          aliasFor: override.aliasFor,
          notes: override.notes,
          addedVia: override.addedVia,
          addedAt: override.addedAt.toISOString()
        };
      }
      
      // No override, return model with defaults
      return {
        ...model,
        isActive: true, // Default to active
        addedVia: 'config' as const
      };
    });

    // Add UI-added models (stored in overrides with config_json)
    for (const override of overrides) {
      if (override.configJson && !MODELS.find(m => m.key === override.modelKey)) {
        // This is a UI-added model
        allModels.push({
          ...override.configJson,
          isActive: override.isActive,
          aliasFor: override.aliasFor,
          notes: override.notes,
          addedVia: override.addedVia,
          addedAt: override.addedAt.toISOString()
        });
      }
    }

    // Filter by active status if requested
    if (!includeInactive) {
      return allModels.filter(m => m.isActive !== false);
    }

    return allModels;
  }

  /**
   * Get a single model by key with overrides applied
   */
  static async getModelByKey(modelKey: string): Promise<ModelConfig | null> {
    const allModels = await this.getAllModels(true);
    return allModels.find(m => m.key === modelKey) || null;
  }

  /**
   * Toggle active status
   */
  static async toggleActive(modelKey: string): Promise<ModelConfig | null> {
    await this.repo.toggleActive(modelKey);
    return this.getModelByKey(modelKey);
  }

  /**
   * Create an alias
   */
  static async createAlias(
    aliasKey: string, 
    targetKey: string, 
    aliasName: string,
    notes?: string
  ): Promise<ModelConfig> {
    // Verify target model exists
    const targetModel = await this.getModelByKey(targetKey);
    if (!targetModel) {
      throw new Error(`Target model '${targetKey}' not found`);
    }

    // Create the alias override
    await this.repo.createAlias(aliasKey, targetKey, notes);

    // Return the alias as a ModelConfig
    return {
      ...targetModel,
      key: aliasKey,
      name: aliasName,
      aliasFor: targetKey,
      notes,
      addedVia: 'ui',
      addedAt: new Date().toISOString()
    };
  }

  /**
   * Add a new model
   */
  static async addModel(modelConfig: ModelConfig): Promise<ModelConfig> {
    // Check for duplicate key
    const existing = await this.getModelByKey(modelConfig.key);
    if (existing && !existing.aliasFor) {
      throw new Error(`A model with key '${modelConfig.key}' already exists`);
    }

    // Validate required fields
    if (!modelConfig.key || !modelConfig.name || !modelConfig.provider) {
      throw new Error('Missing required fields: key, name, provider');
    }

    // Set defaults
    const modelToAdd: ModelConfig = {
      ...modelConfig,
      isActive: modelConfig.isActive !== false,
      addedVia: modelConfig.addedVia || 'ui',
      addedAt: new Date().toISOString()
    };

    // Persist to database
    await this.repo.addModel(modelToAdd);

    return modelToAdd;
  }

  /**
   * Update model notes
   */
  static async updateNotes(modelKey: string, notes: string): Promise<ModelConfig | null> {
    await this.repo.updateNotes(modelKey, notes);
    return this.getModelByKey(modelKey);
  }

  /**
   * Delete a UI-added model (only works for models added via UI, not config models)
   */
  static async deleteModel(modelKey: string): Promise<boolean> {
    const model = await this.getModelByKey(modelKey);
    
    if (!model) {
      return false;
    }

    // Only allow deleting UI-added models
    if (model.addedVia !== 'ui' && model.addedVia !== 'openrouter') {
      throw new Error('Cannot delete config-based models. Use toggle active instead.');
    }

    return this.repo.delete(modelKey);
  }

  /**
   * Get statistics about models
   */
  static async getStats() {
    const allModels = await this.getAllModels(true);
    const activeModels = allModels.filter(m => m.isActive !== false);

    const byProvider: Record<string, number> = {};
    const byProviderActive: Record<string, number> = {};
    
    for (const model of allModels) {
      byProvider[model.provider] = (byProvider[model.provider] || 0) + 1;
    }
    
    for (const model of activeModels) {
      byProviderActive[model.provider] = (byProviderActive[model.provider] || 0) + 1;
    }

    return {
      total: allModels.length,
      active: activeModels.length,
      inactive: allModels.filter(m => m.isActive === false).length,
      byProvider,
      byProviderActive,
      byType: {
        premium: allModels.filter(m => m.premium).length,
        free: allModels.filter(m => !m.premium).length,
        reasoning: allModels.filter(m => m.isReasoning).length,
        chat: allModels.filter(m => !m.isReasoning).length
      },
      bySpeed: {
        fast: allModels.filter(m => m.responseTime.speed === 'fast').length,
        moderate: allModels.filter(m => m.responseTime.speed === 'moderate').length,
        slow: allModels.filter(m => m.responseTime.speed === 'slow').length
      },
      bySource: {
        config: allModels.filter(m => m.addedVia === 'config').length,
        ui: allModels.filter(m => m.addedVia === 'ui').length,
        openrouter: allModels.filter(m => m.addedVia === 'openrouter').length
      },
      aliases: allModels.filter(m => m.aliasFor).length,
      newest: allModels
        .filter(m => m.releaseDate)
        .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
        .slice(0, 5)
        .map(m => ({
          key: m.key,
          name: m.name,
          releaseDate: m.releaseDate,
          provider: m.provider
        }))
    };
  }
}
