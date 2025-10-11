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
import { providerAdapters } from './ProviderAdapters.js';
import axios from 'axios';

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
  health: {
    status: 'healthy' | 'degraded' | 'unavailable';
    latency?: number;
    lastChecked: Date;
    errorCount: number;
  };
  limits: {
    maxConcurrentRequests: number;
    rateLimit?: number;
  };
}

/**
 * Provider-specific capability overrides
 */
interface ProviderCapabilityOverrides {
  [modelKey: string]: {
    features?: Partial<ModelCapabilityStatus['features']>;
    limits?: Partial<ModelCapabilityStatus['limits']>;
    health?: Partial<ModelCapabilityStatus['health']>;
  };
}


export class ModelCapabilities {
  private capabilityCache = new Map<string, ModelCapabilityStatus>();
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeCapabilities();
    this.startHealthMonitoring();
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
   * Get model health status
   */
  async getModelHealth(modelKey: string): Promise<ModelCapabilityStatus['health'] | null> {
    const capabilities = await this.getCapabilities(modelKey);
    return capabilities?.health ?? null;
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
        features: { isReasoning: true, supportsStreaming: false },
        limits: { maxConcurrentRequests: 1 }
      },
      'o4-mini-2025-04-16': {
        features: { isReasoning: true, supportsStreaming: false },
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
   * Start health monitoring background process
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`, 'model-capabilities');
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health monitoring
   */
    stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private getApiKeyForProvider(provider: string): string | undefined {
    const envVarName = `${provider.toUpperCase().replace(/ /g, '_')}_API_KEY`;
    return process.env[envVarName];
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
      if (overrides.health) {
        Object.assign(defaultCapabilities.health, overrides.health);
      }
    }

    // Perform an initial health check to determine availability
    await this.checkModelHealth(modelDef.key, defaultCapabilities);
    defaultCapabilities.isAvailable = defaultCapabilities.health.status === 'healthy' || defaultCapabilities.health.status === 'degraded';
    
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
      health: {
        status: 'healthy',
        lastChecked: new Date(),
        errorCount: 0
      },
      limits: {
        maxConcurrentRequests: modelDef.premium ? 1 : 3,
      
       
      }
    };
  }

  /**
   * Get cached capabilities if still valid
   */
  private getCachedCapabilities(modelKey: string): ModelCapabilityStatus | null {
    const cached = this.capabilityCache.get(modelKey);
    if (!cached) return null;

    const now = Date.now();
    const lastChecked = cached.health.lastChecked.getTime();
    
    if (now - lastChecked < this.CACHE_TTL_MS) {
      return cached;
    }
    
    return null;
  }

  /**
   * Cache capabilities for a model
   */
  private cacheCapabilities(modelKey: string, capabilities: ModelCapabilityStatus): void {
    capabilities.health.lastChecked = new Date();
    this.capabilityCache.set(modelKey, capabilities);
  }

  /**
   * Perform health checks on all models  WHY??!?!?  THIS SEEMS OVER-ENGINEERED?!?
   */
  private async performHealthChecks(): Promise<void> {
    const modelKeys = Array.from(this.capabilityCache.keys());
    
    // Perform health checks in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < modelKeys.length; i += batchSize) {
      const batch = modelKeys.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (key) => {
          try {
            await this.checkModelHealth(key);
          } catch (error) {
            logger.warn(`Health check failed for model ${key}: ${error instanceof Error ? error.message : String(error)}`, 'model-capabilities');
          }
        })
      );
    }
  }

  /**
   * Update health status
   */
  private updateHealthStatus(capabilities: ModelCapabilityStatus, status: 'healthy' | 'degraded' | 'unavailable', errorMessage?: string, latency?: number) {
    capabilities.health.lastChecked = new Date();
    capabilities.health.status = status;
    capabilities.health.latency = latency;

    if (status === 'healthy') {
      capabilities.health.errorCount = 0;
    } else {
      capabilities.health.errorCount++;
    }
    capabilities.isAvailable = status !== 'unavailable';
  }

  /**
   * Check health for a specific model
   */
  private async checkModelHealth(modelKey: string, capabilitiesToUpdate?: ModelCapabilityStatus): Promise<void> {
    const capabilities = capabilitiesToUpdate || this.capabilityCache.get(modelKey);
    if (!capabilities) return;

    const modelDef = ModelLookup.getById(modelKey);
    if (!modelDef) return;

    const providerConfig = providerAdapters.getProviderConfig(modelDef.provider);
    if (!providerConfig) return;

    const apiKey = this.getApiKeyForProvider(modelDef.provider);
    if (providerConfig.requiresApiKey && !apiKey) {
      this.updateHealthStatus(capabilities, 'unavailable', 'API key not configured');
      return;
    }

    const headers = providerAdapters.getAuthHeaders(modelDef.provider, apiKey || '');
    let url = `${providerConfig.baseUrl}/models`;
    
    // Handle query-based authentication (like Gemini)
    if (providerConfig.authMethod === 'query' && apiKey) {
      url += `?key=${apiKey}`;
    }

    try {
      const startTime = Date.now();
      await axios.get(url, { headers, timeout: 5000 });
      const latency = Date.now() - startTime;
      
      this.updateHealthStatus(capabilities, 'healthy', undefined, latency);

    } catch (error: any) {
      const errorMessage = providerAdapters.getRequestTransformer(modelDef.provider).extractError(error);
      logger.warn(`Health check failed for ${modelKey}: ${errorMessage}`, 'model-capabilities');
      this.updateHealthStatus(capabilities, 'unavailable', errorMessage);
    }
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

export async function getModelHealth(modelKey: string): Promise<ModelCapabilityStatus['health'] | null> {
  return await modelCapabilities.getModelHealth(modelKey);
}
