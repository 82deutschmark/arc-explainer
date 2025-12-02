/**
 * index.ts - Unified model configuration exports
 * 
 * Provides a unified interface to the modular model architecture.
 * Maintains backward compatibility while exposing new capabilities.
 * Follows Phase 5.1 architecture: clean separation with unified access.
 * 
 * @author Claude Code (Phase 5 refactor)
 */

import { ModelLookup, MODEL_DEFINITIONS } from './ModelDefinitions.js';
import { modelCapabilities } from './ModelCapabilities.js';
import { ProviderAdapters } from './ProviderAdapters.js';

function resolveModelDefinition(modelKey: string) {
  if (typeof modelKey !== 'string' || modelKey.length === 0) {
    return undefined;
  }

  const trimmedKey = modelKey.trim();
  if (!trimmedKey) {
    return undefined;
  }

  const directMatch = ModelLookup.getById(trimmedKey);
  if (directMatch) {
    return directMatch;
  }

  const slashIndex = trimmedKey.indexOf('/');
  if (slashIndex === -1) {
    return undefined;
  }

  const providerStripped = trimmedKey.slice(slashIndex + 1);
  if (!providerStripped) {
    return undefined;
  }

  return ModelLookup.getById(providerStripped);
}

// Static definitions
export {
  MODEL_DEFINITIONS,
  MODEL_CATEGORIES,
  ModelLookup,
  MODELS // Backward compatibility
} from './ModelDefinitions.js';

// Runtime capabilities
export {
  ModelCapabilities,
  modelCapabilities,
  getModelCapabilities,
  isModelAvailable,
  supportsFeature
} from './ModelCapabilities.js';
export type { ModelCapabilityStatus } from './ModelCapabilities.js';

// Provider adapters
export {
  ProviderAdapters,
  providerAdapters
} from './ProviderAdapters.js';
export type { ProviderConfig, RequestTransformer } from './ProviderAdapters.js';

/**
 * Convenience functions that combine multiple modules
 * These provide the main API surface for consumers
 */

/**
 * Get complete model information including static data and runtime capabilities
 */
export async function getModelInfo(modelKey: string): Promise<{
  definition: any;
  capabilities: any;
  providerConfig: any;
} | null> {
  const definition = resolveModelDefinition(modelKey);
  if (!definition) return null;

  const [capabilities, providerConfig] = await Promise.all([
    modelCapabilities.getCapabilities(modelKey),
    Promise.resolve(ProviderAdapters.getProviderConfigForModel(modelKey))
  ]);

  return {
    definition,
    capabilities,
    providerConfig
  };
}

/**
 * Get all available models with their capabilities
 */
export async function getAvailableModels(): Promise<any[]> {
  const availableCapabilities = await modelCapabilities.getAllAvailableModels();
  
  return availableCapabilities.map(cap => ({
    definition: ModelLookup.getById(cap.modelKey),
    capabilities: cap,
    providerConfig: ProviderAdapters.getProviderConfigForModel(cap.modelKey)
  })).filter(model => model.definition);
}

/**
 * Check if a model supports a specific capability
 */
export async function modelSupports(modelKey: string, capability: string): Promise<boolean> {
  const definition = resolveModelDefinition(modelKey);
  if (!definition) return false;

  // Check static definition first
  switch (capability) {
    case 'temperature':
      return definition.supportsTemperature;
    case 'reasoning':
      return definition.isReasoning ?? false;
    case 'premium':
      return definition.premium;
  }

  // Check runtime capabilities
  const capabilities = await modelCapabilities.getCapabilities(modelKey);
  if (!capabilities) return false;

  switch (capability) {
    case 'batch':
      return capabilities.features.supportsBatch;
    case 'streaming':
      return capabilities.features.supportsStreaming;
    default:
      return false;
  }
}

/**
 * Legacy compatibility exports
 * These maintain compatibility with existing code
 */

// Re-export core functions from the original models.ts interface
export function getModelConfig(modelKey: string) {
  return resolveModelDefinition(modelKey);
}

export function modelSupportsTemperature(modelKey: string): boolean {
  const definition = resolveModelDefinition(modelKey);
  return definition?.supportsTemperature ?? false;
}

export function modelSupportsReasoning(modelKey: string): boolean {
  const definition = resolveModelDefinition(modelKey);
  return definition?.isReasoning ?? false;
}

export function getApiModelName(modelKey: string): string {
  const definition = resolveModelDefinition(modelKey);
  const normalizedKey = typeof modelKey === 'string' ? modelKey.trim() : modelKey;
  return definition?.apiModelName ?? normalizedKey;
}

export function getModelsByProvider(provider: string) {
  return ModelLookup.getByProvider(provider);
}

export function getModelsByType(modelType: string) {
  return ModelLookup.getByType(modelType);
}

// Legacy model categorization sets
export const O3_O4_REASONING_MODELS = new Set(
  ModelLookup.getByType('o3_o4').map(m => m.key)
);

export const GPT5_REASONING_MODELS = new Set(
  ModelLookup.getByType('gpt5').map(m => m.key)
);

export const GPT5_CODEX_MODELS = new Set(
  MODEL_DEFINITIONS
    .filter(m => m.key === 'gpt-5.1-codex' || m.key === 'gpt-5.1-codex-mini')
    .map(m => m.key)
);

export const GPT5_CHAT_MODELS = new Set(
  ModelLookup.getByType('gpt5_chat').map(m => m.key)
);

export const MODELS_WITH_REASONING = new Set(
  MODEL_DEFINITIONS.filter(m => m.isReasoning).map(m => m.key)
);

export const OPENAI_MODELS = new Set(
  ModelLookup.getByProvider('OpenAI').map(m => m.key)
);

export const ANTHROPIC_MODELS = new Set(
  ModelLookup.getByProvider('Anthropic').map(m => m.key)
);

export const XAI_MODELS = new Set(
  ModelLookup.getByProvider('xAI').map(m => m.key)
);

export const GEMINI_MODELS = new Set(
  ModelLookup.getByProvider('Gemini').map(m => m.key)
);

export const DEEPSEEK_MODELS = new Set(
  ModelLookup.getByProvider('DeepSeek').map(m => m.key)
);

export const OPENROUTER_MODELS = new Set(
  ModelLookup.getByProvider('OpenRouter').map(m => m.key)
);