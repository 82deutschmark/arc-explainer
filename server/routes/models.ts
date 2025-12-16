/**
 * Models API routes - serves model configuration to client
 * Centralizes all model metadata on server-side
 * Exposes DB-discovered OpenRouter model timestamps for client sorting.
 * 
 * @author Cascade
 * Date: 2025-12-16
 */

import { Router } from 'express';
import { MODELS, getModelConfig, getModelsByProvider } from '../config/models/index.js';
import { repositoryService } from '../repositories/RepositoryService.js';

const router = Router();

type ClientSafeModel = {
  key: string;
  name: string;
  color: string;
  premium: boolean;
  cost: any;
  supportsTemperature: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  provider: string;
  responseTime: any;
  isReasoning?: boolean;
  releaseDate?: string;
  addedAt?: string;
};

function toClientSafeModel(model: any): ClientSafeModel {
  return {
    key: model.key,
    name: model.name,
    color: model.color,
    premium: model.premium,
    cost: model.cost,
    supportsTemperature: model.supportsTemperature,
    supportsStreaming: model.supportsStreaming ?? false,
    supportsVision: model.supportsVision ?? false,
    provider: model.provider,
    responseTime: model.responseTime,
    isReasoning: model.isReasoning,
    releaseDate: model.releaseDate,
    addedAt: model.addedAt,
  };
}

async function getDbOpenRouterModels(): Promise<Array<{ key: string; name: string; addedAt?: string }>> {
  if (!repositoryService.isInitialized()) return [];
  const dbModels = await repositoryService.snakeBench.listModels();
  return dbModels
    .filter((m) => (m.provider || '').toLowerCase() === 'openrouter' && m.is_active)
    .map((m) => ({
      key: m.model_slug,
      name: m.name || m.model_slug,
      addedAt: (() => {
        const raw = (m as any).discovered_at ?? (m as any).created_at ?? null;
        if (!raw) return undefined;
        try {
          const d = raw instanceof Date ? raw : new Date(raw);
          return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
        } catch {
          return undefined;
        }
      })(),
    }))
    .filter((m) => typeof m.key === 'string' && m.key.trim().length > 0);
}

function buildFallbackOpenRouterClientModel(slug: string, name: string, addedAt?: string): ClientSafeModel {
  return {
    key: slug,
    name,
    color: 'bg-slate-500',
    premium: false,
    cost: { input: 'TBD', output: 'TBD' },
    supportsTemperature: true,
    supportsStreaming: true,
    supportsVision: false,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    isReasoning: undefined,
    releaseDate: undefined,
    addedAt,
  };
}

/**
 * GET /api/models
 * Returns all available models with client-safe properties
 */
router.get('/', async (req, res) => {
  const configModels = MODELS.map(toClientSafeModel);

  const configKeySet = new Set(configModels.map((m) => m.key));
  const dbOpenRouter = await getDbOpenRouterModels();

  const dbOnly = dbOpenRouter
    .filter((m) => !configKeySet.has(m.key))
    .map((m) => buildFallbackOpenRouterClientModel(m.key, m.name, m.addedAt));

  res.json([...configModels, ...dbOnly]);
});

/**
 * GET /api/models/:modelKey
 * Returns specific model configuration
 */
router.get('/:modelKey', (req, res) => {
  const { modelKey } = req.params;
  const model = getModelConfig(modelKey);
  
  if (!model) {
    return res.status(404).json({ 
      error: 'Model not found',
      modelKey 
    });
  }

  // Strip server-only properties
  const clientModel = {
    key: model.key,
    name: model.name,
    color: model.color,
    premium: model.premium,
    cost: model.cost,
    supportsTemperature: model.supportsTemperature,
    supportsStreaming: model.supportsStreaming ?? false,
    supportsVision: model.supportsVision ?? false,
    provider: model.provider,
    responseTime: model.responseTime,
    isReasoning: model.isReasoning,
    releaseDate: model.releaseDate
  };

  res.json(clientModel);
});

/**
 * GET /api/models/provider/:provider
 * Returns models filtered by provider
 */
router.get('/provider/:provider', async (req, res) => {
  const { provider } = req.params;
  const models = getModelsByProvider(provider);
  
  // Strip server-only properties
  const clientModels = models.map(toClientSafeModel);

  if ((provider || '').toLowerCase() === 'openrouter') {
    const configKeySet = new Set(clientModels.map((m) => m.key));
    const dbOpenRouter = await getDbOpenRouterModels();
    const dbOnly = dbOpenRouter
      .filter((m) => !configKeySet.has(m.key))
      .map((m) => buildFallbackOpenRouterClientModel(m.key, m.name, m.addedAt));
    return res.json([...clientModels, ...dbOnly]);
  }

  res.json(clientModels);
});

export default router;
