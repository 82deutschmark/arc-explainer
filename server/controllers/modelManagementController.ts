/*
 * Author: Cascade using Deep Research Model
 * Date: 2025-10-03T20:55:00Z
 * PURPOSE: Backend controller for model management GUI operations
 *          Provides REST API endpoints for listing, adding, removing, toggling, and aliasing AI models
 * SRP/DRY check: Pass - Handles only model management HTTP operations
 * shadcn/ui: N/A - Backend controller
 */

import { Request, Response } from 'express';
import { ModelManagementService } from '../services/modelManagementService.js';
import type { ModelConfig } from '@shared/types';

/**
 * GET /api/model-management/list
 * List all configured AI models with overrides applied
 */
export async function listModels(req: Request, res: Response) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const models = await ModelManagementService.getAllModels(includeInactive);

    const modelsWithStats = models.map((model, index) => ({
      ...model,
      index
    }));

    res.json({
      models: modelsWithStats,
      total: models.length,
      providers: [...new Set(models.map(m => m.provider))],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ 
      error: 'Failed to list models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/model-management/stats
 * Get statistics about configured models
 */
export async function getModelStats(req: Request, res: Response) {
  try {
    const stats = await ModelManagementService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting model stats:', error);
    res.status(500).json({ 
      error: 'Failed to get model statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/models/validate
 * Validate a model configuration before adding
 */
export async function validateModel(req: Request, res: Response) {
  try {
    const modelConfig = req.body as Partial<ModelConfig>;
    const errors: string[] = [];

    // Required field validation
    if (!modelConfig.key) errors.push('key is required');
    if (!modelConfig.name) errors.push('name is required');
    if (!modelConfig.provider) errors.push('provider is required');
    if (!modelConfig.color) errors.push('color is required');
    if (modelConfig.premium === undefined) errors.push('premium is required');
    if (!modelConfig.cost?.input) errors.push('cost.input is required');
    if (!modelConfig.cost?.output) errors.push('cost.output is required');
    if (modelConfig.supportsTemperature === undefined) errors.push('supportsTemperature is required');
    if (modelConfig.isReasoning === undefined) errors.push('isReasoning is required');
    if (!modelConfig.responseTime?.speed) errors.push('responseTime.speed is required');
    if (!modelConfig.responseTime?.estimate) errors.push('responseTime.estimate is required');

    // Check for duplicate key
    if (modelConfig.key) {
      const existingModel = await ModelManagementService.getModelByKey(modelConfig.key);
      if (existingModel && !existingModel.aliasFor) {
        errors.push(`A model with key "${modelConfig.key}" already exists`);
      }
    }

    // Validate provider
    const validProviders = ['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'OpenRouter'];
    if (modelConfig.provider && !validProviders.includes(modelConfig.provider)) {
      errors.push(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
    }

    // Validate speed
    const validSpeeds = ['fast', 'moderate', 'slow'];
    if (modelConfig.responseTime?.speed && !validSpeeds.includes(modelConfig.responseTime.speed)) {
      errors.push(`Invalid speed. Must be one of: ${validSpeeds.join(', ')}`);
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings: []
    });
  } catch (error) {
    console.error('Error validating model:', error);
    res.status(500).json({ 
      error: 'Failed to validate model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/model-management/search
 * Search models by query string
 */
export async function searchModels(req: Request, res: Response) {
  try {
    const query = (req.query.q as string || '').toLowerCase();
    const provider = req.query.provider as string | undefined;
    const premium = req.query.premium === 'true' ? true : req.query.premium === 'false' ? false : undefined;

    let allModels = await ModelManagementService.getAllModels(true);

    // Filter by search query
    if (query) {
      allModels = allModels.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.key.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query)
      );
    }

    // Filter by provider
    if (provider) {
      allModels = allModels.filter(m => m.provider === provider);
    }

    // Filter by premium
    if (premium !== undefined) {
      allModels = allModels.filter(m => m.premium === premium);
    }

    res.json({
      models: allModels,
      total: allModels.length,
      query: { q: query, provider, premium }
    });
  } catch (error) {
    console.error('Error searching models:', error);
    res.status(500).json({ 
      error: 'Failed to search models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/model-management/toggle-active
 * Toggle active status for a model
 */
export async function toggleActive(req: Request, res: Response) {
  try {
    const { modelKey } = req.body;

    if (!modelKey) {
      return res.status(400).json({ error: 'modelKey is required' });
    }

    const updated = await ModelManagementService.toggleActive(modelKey);

    if (!updated) {
      return res.status(404).json({ error: 'Model not found' });
    }

    res.json({
      success: true,
      model: updated,
      message: `Model ${updated.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling model:', error);
    res.status(500).json({ 
      error: 'Failed to toggle model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/model-management/create-alias
 * Create an alias for an existing model
 */
export async function createAlias(req: Request, res: Response) {
  try {
    const { aliasKey, targetKey, aliasName, notes } = req.body;

    if (!aliasKey || !targetKey || !aliasName) {
      return res.status(400).json({ 
        error: 'aliasKey, targetKey, and aliasName are required' 
      });
    }

    const aliasModel = await ModelManagementService.createAlias(
      aliasKey,
      targetKey,
      aliasName,
      notes
    );

    res.json({
      success: true,
      model: aliasModel,
      message: 'Alias created successfully'
    });
  } catch (error) {
    console.error('Error creating alias:', error);
    res.status(400).json({ 
      error: 'Failed to create alias',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/model-management/add
 * Add a new model configuration
 */
export async function addModel(req: Request, res: Response) {
  try {
    const modelConfig = req.body as ModelConfig;

    const addedModel = await ModelManagementService.addModel(modelConfig);

    res.json({
      success: true,
      model: addedModel,
      message: 'Model added successfully'
    });
  } catch (error) {
    console.error('Error adding model:', error);
    res.status(400).json({ 
      error: 'Failed to add model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PUT /api/model-management/notes
 * Update model notes
 */
export async function updateNotes(req: Request, res: Response) {
  try {
    const { modelKey, notes } = req.body;

    if (!modelKey) {
      return res.status(400).json({ error: 'modelKey is required' });
    }

    const updated = await ModelManagementService.updateNotes(modelKey, notes || '');

    if (!updated) {
      return res.status(404).json({ error: 'Model not found' });
    }

    res.json({
      success: true,
      model: updated,
      message: 'Notes updated successfully'
    });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ 
      error: 'Failed to update notes',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * DELETE /api/model-management/delete
 * Delete a UI-added model
 */
export async function deleteModel(req: Request, res: Response) {
  try {
    const { modelKey } = req.body;

    if (!modelKey) {
      return res.status(400).json({ error: 'modelKey is required' });
    }

    const deleted = await ModelManagementService.deleteModel(modelKey);

    if (!deleted) {
      return res.status(404).json({ error: 'Model not found or cannot be deleted' });
    }

    res.json({
      success: true,
      message: 'Model deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(400).json({ 
      error: 'Failed to delete model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/model-management/openrouter-models
 * Fetch available models from OpenRouter API
 */
export async function fetchOpenRouterModels(req: Request, res: Response) {
  try {
    // TODO: Implement OpenRouter API integration
    // For now, return placeholder
    res.json({
      models: [],
      message: 'OpenRouter integration coming soon'
    });
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch OpenRouter models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
