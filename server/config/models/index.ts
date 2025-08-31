/**
 * index.ts - Unified model configuration exports
 * 
 * Provides a unified interface to the modular model architecture.
 * Maintains backward compatibility while exposing new capabilities.
 * Follows Phase 5.1 architecture: clean separation with unified access.
 * 
 * @author Claude Code (Phase 5 refactor)
 */

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
  supportsFeature,
  getModelHealth
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
  const definition = ModelLookup.getById(modelKey);
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
  const definition = ModelLookup.getById(modelKey);
  if (!definition) return false;

  // Check static definition first
  switch (capability) {
    case 'temperature':
      return definition.supportsTemperature;
    case 'reasoning':
      return definition.supportsReasoning ?? false;
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
  return ModelLookup.getById(modelKey);
}

export function modelSupportsTemperature(modelKey: string): boolean {
  const definition = ModelLookup.getById(modelKey);
  return definition?.supportsTemperature ?? false;
}

export function modelSupportsReasoning(modelKey: string): boolean {
  const definition = ModelLookup.getById(modelKey);
  return definition?.supportsReasoning ?? false;
}

export function getApiModelName(modelKey: string): string {
  const definition = ModelLookup.getById(modelKey);
  return definition?.apiModelName ?? modelKey;
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

export const GPT5_CHAT_MODELS = new Set(
  ModelLookup.getByType('gpt5_chat').map(m => m.key)
);

export const MODELS_WITH_REASONING = new Set(
  MODEL_DEFINITIONS.filter(m => m.supportsReasoning).map(m => m.key)
);