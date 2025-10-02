/*
 * Author: Cascade using Deep Research Model
 * Date: 2025-09-30T16:35:00Z
 * PURPOSE: Backend controller for model management GUI operations
 *          Provides REST API endpoints for listing, adding, and removing AI models
 * SRP/DRY check: Pass - Handles only model management HTTP operations
 * shadcn/ui: N/A - Backend controller
 */

import { Request, Response } from 'express';
import { MODELS } from '../config/models.js';
import type { ModelConfig } from '@shared/types';

/**
 * GET /api/models
 * List all configured AI models
 */
export async function listModels(req: Request, res: Response) {
  try {
    // Return models with additional metadata for UI
    const modelsWithStats = MODELS.map((model, index) => ({
      ...model,
      index,
      costPerMillion: {
        input: model.cost.input,
        output: model.cost.output
      }
    }));

    res.json({
      models: modelsWithStats,
      total: MODELS.length,
      providers: [...new Set(MODELS.map(m => m.provider))],
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
 * GET /api/models/stats
 * Get statistics about configured models
 */
export async function getModelStats(req: Request, res: Response) {
  try {
    const stats = {
      total: MODELS.length,
      byProvider: {} as Record<string, number>,
      byType: {
        premium: MODELS.filter(m => m.premium).length,
        free: MODELS.filter(m => !m.premium).length,
        reasoning: MODELS.filter(m => m.isReasoning).length,
        chat: MODELS.filter(m => !m.isReasoning).length
      },
      bySpeed: {
        fast: MODELS.filter(m => m.responseTime.speed === 'fast').length,
        moderate: MODELS.filter(m => m.responseTime.speed === 'moderate').length,
        slow: MODELS.filter(m => m.responseTime.speed === 'slow').length
      },
      newest: MODELS
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

    // Count by provider
    MODELS.forEach(model => {
      stats.byProvider[model.provider] = (stats.byProvider[model.provider] || 0) + 1;
    });

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
    if (modelConfig.key && MODELS.some(m => m.key === modelConfig.key)) {
      errors.push(`A model with key "${modelConfig.key}" already exists`);
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
 * GET /api/models/search
 * Search models by query string
 */
export async function searchModels(req: Request, res: Response) {
  try {
    const query = (req.query.q as string || '').toLowerCase();
    const provider = req.query.provider as string | undefined;
    const premium = req.query.premium === 'true' ? true : req.query.premium === 'false' ? false : undefined;

    let filtered = MODELS;

    // Filter by search query
    if (query) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.key.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query)
      );
    }

    // Filter by provider
    if (provider) {
      filtered = filtered.filter(m => m.provider === provider);
    }

    // Filter by premium
    if (premium !== undefined) {
      filtered = filtered.filter(m => m.premium === premium);
    }

    res.json({
      models: filtered,
      total: filtered.length,
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
