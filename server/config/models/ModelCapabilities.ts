/**
 * ModelCapabilities.ts
 * THIS FILE SEEMS LIKE TOTAL OVER-ENGINEERED INSANITY???  We dont need any of the stuff in
 * here and none of it seems to be useful. isnt all of this defined in the models.ts file?
 * 
 * 
 * Runtime capability detection and dynamic model feature management.
 * Handles availability checking, feature validation, and real-time capability assessment.
 * Follows Phase 5.1 architecture: separates runtime logic from static definitions.
 * 
 * @author Claude Code (Phase 5 refactor)
 */

import { ModelLookup, MODEL_DEFINITIONS } from './ModelDefinitions.js';
import type { ModelConfig } from '@shared/types.js';
import { logger } from '../../utils/logger.js';

/**
 * Runtime capability status for a model
 */
export interface ModelCapabilityStatus {
  modelKey: string;
  isAvailable: boolean;
  features: {
    supportsTemperature: boolean;
    isReasoning: boolean;
    supportsBatch: boolean;
    supportsStreaming: boolean;
  };
  limits: {
    maxConcurrentRequests: number;
    rateLimit?: number;
  };
  lastUpdated: Date;
}

/**
 * Provider-specific capability overrides
 */
interface ProviderCapabilityOverrides {
  [modelKey: string]: {
    features?: Partial<ModelCapabilityStatus['features']>;
    limits?: Partial<ModelCapabilityStatus['limits']>;
  };
}


export class ModelCapabilities {
  private capabilityCache = new Map<string, ModelCapabilityStatus>();
  private readonly CACHE_TTL_MS = 300000; // 5 minutes

  constructor() {
    this.initializeCapabilities();
  }

  /**
   * Get comprehensive capability status for a model
   */
  async getCapabilities(modelKey: string): Promise<ModelCapabilityStatus | null> {
    const cached = this.getCachedCapabilities(modelKey);
    if (cached) {
      return cached;
    }

    const modelDef = ModelLookup.getById(modelKey);
    if (!modelDef) {
      logger.warn(`Model definition not found for: ${modelKey}`, 'model-capabilities');
      return null;
    }

    const capabilities = await this.detectCapabilities(modelDef);
    this.cacheCapabilities(modelKey, capabilities);
    
    return capabilities;
  }

  /**
   * Check if a model supports a specific feature
   */
  async supportsFeature(modelKey: string, feature: keyof ModelCapabilityStatus['features']): Promise<boolean> {
    const capabilities = await this.getCapabilities(modelKey);
    return capabilities?.features[feature] ?? false;
  }

  /**
   * Check if a model is currently available
   */
  async isModelAvailable(modelKey: string): Promise<boolean> {
    const capabilities = await this.getCapabilities(modelKey);
    return capabilities?.isAvailable ?? false;
  }

  /**
   * Get all available models with their capabilities
   */
  async getAllAvailableModels(): Promise<ModelCapabilityStatus[]> {
    const allModels = MODEL_DEFINITIONS.map(m => m.key);
    const capabilities = await Promise.all(
      allModels.map(async (key) => await this.getCapabilities(key))
    );
    
    return capabilities.filter((cap): cap is ModelCapabilityStatus => 
      cap !== null && cap.isAvailable
    );
  }

  /**
   * Force refresh capabilities for a model
   */
  async refreshCapabilities(modelKey: string): Promise<ModelCapabilityStatus | null> {
    this.capabilityCache.delete(modelKey);
    return await this.getCapabilities(modelKey);
  }

  /**
   * Bulk refresh all model capabilities
   */
  async refreshAllCapabilities(): Promise<void> {
    this.capabilityCache.clear();
    
    const allModels = MODEL_DEFINITIONS.map(m => m.key);
    await Promise.all(
      allModels.map(async (key) => await this.getCapabilities(key))
    );
    
    logger.info(`Refreshed capabilities for ${allModels.length} models`, 'model-capabilities');
  }

  /**
   * Get provider-specific capability overrides
   */
  getProviderOverrides(): ProviderCapabilityOverrides {
    return {
      // OpenAI specific overrides
      'gpt-5-2025-08-07': {
        features: { isReasoning: true, supportsStreaming: true },
        limits: { maxConcurrentRequests: 1 } // Reasoning models have lower limits
      },
      'o3-mini-2025-01-31': {
        features: { isReasoning: true, supportsStreaming: true },
        limits: { maxConcurrentRequests: 1 }
      },
      'o4-mini-2025-04-16': {
        features: { isReasoning: true, supportsStreaming: true },
        limits: { maxConcurrentRequests: 1 }
      },
      
      // DeepSeek overrides
      'deepseek-reasoner': {
        features: { isReasoning: true, supportsBatch: false },
        limits: { maxConcurrentRequests: 2 }
      },
      
      // Gemini overrides for thinking models
      'gemini-2.5-pro': {
        features: { isReasoning: true },
        limits: { maxConcurrentRequests: 3 }
      },
      'gemini-2.5-flash': {
        features: { isReasoning: true },
        limits: { maxConcurrentRequests: 5 }
      },
      
      // OpenRouter models have different limits
      'meta-llama/llama-3.3-70b-instruct': {
        limits: { maxConcurrentRequests: 2 }
      },
      'deepseek/deepseek-r1-0528:free': {
        features: { isReasoning: true, supportsBatch: false },
        limits: { maxConcurrentRequests: 1 }
      }
    };
  }

  /**
   * Initialize capabilities cache with defaults
   */
  private initializeCapabilities(): void {
    for (const model of MODEL_DEFINITIONS) {
      const defaultCapabilities = this.createDefaultCapabilities(model);
      this.capabilityCache.set(model.key, defaultCapabilities);
    }
  }

  /**
   * Detect actual capabilities for a model
   */
  private async detectCapabilities(modelDef: ModelConfig): Promise<ModelCapabilityStatus> {
    const defaultCapabilities = this.createDefaultCapabilities(modelDef);
    const overrides = this.getProviderOverrides()[modelDef.key];
    
    // Apply provider-specific overrides
    if (overrides) {
      if (overrides.features) {
        Object.assign(defaultCapabilities.features, overrides.features);
      }
      if (overrides.limits) {
        Object.assign(defaultCapabilities.limits, overrides.limits);
      }
    }

    return defaultCapabilities;
  }

  /**
   * Create default capabilities based on model definition
   */
  private createDefaultCapabilities(modelDef: ModelConfig): ModelCapabilityStatus {
    return {
      modelKey: modelDef.key,
      isAvailable: true,
      features: {
        supportsTemperature: modelDef.supportsTemperature,
        isReasoning: modelDef.isReasoning ?? false,
        supportsBatch: !modelDef.premium, // Premium models typically don't support batch
        supportsStreaming: true // Most models support streaming
      },
      limits: {
        maxConcurrentRequests: modelDef.premium ? 1 : 3,
        rateLimit: modelDef.premium ? 60 : undefined
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Get cached capabilities if still valid
   */
  private getCachedCapabilities(modelKey: string): ModelCapabilityStatus | null {
    const cached = this.capabilityCache.get(modelKey);
    if (!cached) return null;

    const now = Date.now();
    const lastChecked = cached.lastUpdated.getTime();

    if (now - lastChecked < this.CACHE_TTL_MS) {
      return cached;
    }

    return null;
  }

  /**
   * Cache capabilities for a model
   */
  private cacheCapabilities(modelKey: string, capabilities: ModelCapabilityStatus): void {
    capabilities.lastUpdated = new Date();
    this.capabilityCache.set(modelKey, capabilities);
  }
}

// Export singleton instance
export const modelCapabilities = new ModelCapabilities();

/**
 * Convenience functions for backward compatibility
 */
export async function getModelCapabilities(modelKey: string): Promise<ModelCapabilityStatus | null> {
  return await modelCapabilities.getCapabilities(modelKey);
}

export async function isModelAvailable(modelKey: string): Promise<boolean> {
  return await modelCapabilities.isModelAvailable(modelKey);
}

export async function supportsFeature(modelKey: string, feature: keyof ModelCapabilityStatus['features']): Promise<boolean> {
  return await modelCapabilities.supportsFeature(modelKey, feature);
}
