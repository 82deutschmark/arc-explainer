/**
 * Author: code-supernova using DeepSeek V3.2 Exp
 * Date: 2025-10-13
 * PURPOSE: Utility functions for Saturn Visual Solver model selection and configuration.
 * Integrates with real backend model configuration from models.ts for dynamic model selection.
 * SRP: Single responsibility - Saturn model utilities
 * DRY: Pass - reusable model selection logic
 */

import { MODELS } from '../../../server/config/models';
import type { ModelConfig } from '@shared/types';

/**
 * Get all models that are compatible with Saturn Visual Solver
 * Saturn works with models that support vision and reasoning capabilities.
 *
 * Compatible models:
 * - OpenAI: o3, o4 series (reasoning models with vision support)
 * - xAI: Grok-4, Grok-4-fast-reasoning (vision-capable reasoning models)
 *
 * Excluded: OpenRouter models (unless specifically tested for Saturn compatibility)
 */
export function getSaturnCompatibleModels(): ModelConfig[] {
  return MODELS.filter((model: ModelConfig) => {
    // Saturn needs models that support vision and reasoning capabilities
    const isOpenAIReasoning = model.provider === 'OpenAI' && model.isReasoning === true;
    const isGrokVisionReasoning = model.provider === 'xAI' && model.isReasoning === true;

    // Specifically include these known Saturn-compatible models
    const saturnCompatibleKeys = [
      'o3-mini-2025-01-31',
      'o4-mini-2025-04-16',
      'o3-2025-04-16',
      'grok-4',
      'grok-4-fast-reasoning'
    ];

    return isOpenAIReasoning || isGrokVisionReasoning || saturnCompatibleKeys.includes(model.key);
  });
}

/**
 * Get the default model for Saturn Visual Solver
 * Uses the first available Saturn-compatible model, preferring faster ones
 */
export function getDefaultSaturnModel(): ModelConfig | null {
  const compatibleModels = getSaturnCompatibleModels();

  // Prefer faster models first for better UX
  const preferredOrder = [
    'grok-4-fast-reasoning',  // Fastest Grok model
    'o4-mini-2025-04-16',     // Fast OpenAI reasoning model
    'o3-mini-2025-01-31',     // Mini OpenAI reasoning model
  ];

  for (const key of preferredOrder) {
    const model = compatibleModels.find(m => m.key === key);
    if (model) return model;
  }

  // Fallback to first available model
  return compatibleModels.length > 0 ? compatibleModels[0] : null;
}

/**
 * Convert model key to display name for UI
 */
export function getModelDisplayName(modelKey: string): string {
  const model = MODELS.find((m: ModelConfig) => m.key === modelKey);
  return model?.name || modelKey;
}

/**
 * Check if a model supports temperature control
 */
export function modelSupportsTemperature(modelKey: string): boolean {
  const model = MODELS.find((m: ModelConfig) => m.key === modelKey);
  return model?.supportsTemperature ?? false;
}

/**
 * Check if a model supports reasoning effort configuration
 */
export function modelSupportsReasoningEffort(modelKey: string): boolean {
  const model = MODELS.find((m: ModelConfig) => m.key === modelKey);
  // Most reasoning models support effort configuration
  return model?.isReasoning ?? false;
}

/**
 * Get model provider for API routing
 */
export function getModelProvider(modelKey: string): string | null {
  const model = MODELS.find((m: ModelConfig) => m.key === modelKey);
  return model?.provider ?? null;
}

/**
 * Get API model name for backend requests
 */
export function getApiModelName(modelKey: string): string | null {
  const model = MODELS.find((m: ModelConfig) => m.key === modelKey);
  return model?.apiModelName ?? null;
}
