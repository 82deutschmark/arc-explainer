/**
 * Models API routes - serves model configuration to client
 * Centralizes all model metadata on server-side
 * 
 * @author Cascade  
 */

import { Router } from 'express';
import { MODELS, getModelConfig, getModelsByProvider } from '../config/models.js';

const router = Router();

/**
 * GET /api/models
 * Returns all available models with client-safe properties
 */
router.get('/', (req, res) => {
  // Strip server-only properties for client
  const clientModels = MODELS.map(model => ({
    key: model.key,
    name: model.name,
    color: model.color,
    premium: model.premium,
    cost: model.cost,
    supportsTemperature: model.supportsTemperature,
    provider: model.provider,
    responseTime: model.responseTime,
    supportsReasoning: model.supportsReasoning
  }));

  res.json(clientModels);
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
    provider: model.provider,
    responseTime: model.responseTime,
    supportsReasoning: model.supportsReasoning
  };

  res.json(clientModel);
});

/**
 * GET /api/models/provider/:provider
 * Returns models filtered by provider
 */
router.get('/provider/:provider', (req, res) => {
  const { provider } = req.params;
  const models = getModelsByProvider(provider);
  
  // Strip server-only properties
  const clientModels = models.map(model => ({
    key: model.key,
    name: model.name,
    color: model.color,
    premium: model.premium,
    cost: model.cost,
    supportsTemperature: model.supportsTemperature,
    provider: model.provider,
    responseTime: model.responseTime,
    supportsReasoning: model.supportsReasoning
  }));

  res.json(clientModels);
});

export default router;
