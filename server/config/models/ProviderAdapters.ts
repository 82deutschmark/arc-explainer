/**
 * ProviderAdapters.ts
 * 
 * Provider-specific logic and adapter patterns for AI service integration.
 * Handles authentication, request/response transformation, and provider quirks.
 * Follows Phase 5.1 architecture: isolates provider-specific behavior from static definitions.
 * 
 * @author Claude Code (Phase 5 refactor)
 */

import { ModelLookup } from './ModelDefinitions.js';
import type { ModelConfig } from '@shared/types.js';
import { logger } from '../../utils/logger.js';

/**
 * Standard provider configuration interface
 */
export interface ProviderConfig {
  name: string;
  baseUrl: string;
  requiresApiKey: boolean;
  authMethod: 'bearer' | 'header' | 'query';
  supportedFeatures: {
    streaming: boolean;
    batchProcessing: boolean;
    functionCalling: boolean;
    vision: boolean;
    structured_output: boolean;
  };
  requestLimits: {
    maxRequestsPerMinute: number;
    maxTokensPerRequest?: number; // Only used for Anthropic models
    maxConcurrentRequests: number;
  };
  errorHandling: {
    retryableErrors: string[];
    maxRetries: number;
    baseDelayMs: number;
  };
}

/**
 * Request/response transformation interface
 */
export interface RequestTransformer {
  transformRequest: (request: any, modelKey: string) => any;
  transformResponse: (response: any, modelKey: string) => any;
  extractError: (error: any) => string;
  shouldRetry: (error: any) => boolean;
}

/**
 * Provider-specific adapters
 */
export class ProviderAdapters {
  private static readonly PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    OpenAI: {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      requiresApiKey: true,
      authMethod: 'bearer',
      supportedFeatures: {
        streaming: true,
        batchProcessing: true,
        functionCalling: true,
        vision: true,
        structured_output: true
      },
      requestLimits: {
        maxRequestsPerMinute: 500,
        maxConcurrentRequests: 5
      },
      errorHandling: {
        retryableErrors: ['rate_limit_exceeded', 'server_error', 'timeout'],
        maxRetries: 3,
        baseDelayMs: 1000
      }
    },

    Anthropic: {
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      requiresApiKey: true,
      authMethod: 'header',
      supportedFeatures: {
        streaming: true,
        batchProcessing: false,
        functionCalling: true,
        vision: true,
        structured_output: false
      },
      requestLimits: {
        maxRequestsPerMinute: 1000,
        maxConcurrentRequests: 5
      },
      errorHandling: {
        retryableErrors: ['rate_limit_exceeded', 'overloaded_error', 'timeout'],
        maxRetries: 3,
        baseDelayMs: 1000
      }
    },

    xAI: {
      name: 'xAI',
      baseUrl: 'https://api.x.ai/v1',
      requiresApiKey: true,
      authMethod: 'bearer',
      supportedFeatures: {
        streaming: true,
        batchProcessing: false,
        functionCalling: true,
        vision: true,
        structured_output: false
      },
      requestLimits: {
        maxRequestsPerMinute: 60,
        maxConcurrentRequests: 2
      },
      errorHandling: {
        retryableErrors: ['rate_limit_exceeded', 'server_error'],
        maxRetries: 2,
        baseDelayMs: 2000
      }
    },

    Gemini: {
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      requiresApiKey: true,
      authMethod: 'query',
      supportedFeatures: {
        streaming: true,
        batchProcessing: false,
        functionCalling: true,
        vision: true,
        structured_output: false
      },
      requestLimits: {
        maxRequestsPerMinute: 1500,
        maxConcurrentRequests: 5
      },
      errorHandling: {
        retryableErrors: ['RATE_LIMIT_EXCEEDED', 'INTERNAL_ERROR'],
        maxRetries: 3,
        baseDelayMs: 1000
      }
    },

    DeepSeek: {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      requiresApiKey: true,
      authMethod: 'bearer',
      supportedFeatures: {
        streaming: true,
        batchProcessing: false,
        functionCalling: false,
        vision: false,
        structured_output: false
      },
      requestLimits: {
        maxRequestsPerMinute: 300,
        maxConcurrentRequests: 3
      },
      errorHandling: {
        retryableErrors: ['rate_limit_exceeded', 'server_error'],
        maxRetries: 2,
        baseDelayMs: 1500
      }
    },

    OpenRouter: {
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      requiresApiKey: true,
      authMethod: 'bearer',
      supportedFeatures: {
        streaming: true,
        batchProcessing: false,
        functionCalling: false,
        vision: false,
        structured_output: true
      },
      requestLimits: {
        maxRequestsPerMinute: 200,
        maxConcurrentRequests: 3
      },
      errorHandling: {
        retryableErrors: ['rate_limit_exceeded', 'server_error', 'bad_gateway'],
        maxRetries: 3,
        baseDelayMs: 2000
      }
    }
  };

  /**
   * Get provider configuration
   */
  static getProviderConfig(provider: string): ProviderConfig | null {
    return this.PROVIDER_CONFIGS[provider] || null;
  }

  /**
   * Get provider configuration for a specific model
   */
  static getProviderConfigForModel(modelKey: string): ProviderConfig | null {
    const modelDef = ModelLookup.getById(modelKey);
    if (!modelDef) return null;
    
    return this.getProviderConfig(modelDef.provider);
  }

  /**
   * Get request transformer for a provider
   */
  static getRequestTransformer(provider: string): RequestTransformer {
    switch (provider) {
      case 'OpenAI':
        return new OpenAITransformer();
      case 'Anthropic':
        return new AnthropicTransformer();
      case 'xAI':
        return new XAITransformer();
      case 'Gemini':
        return new GeminiTransformer();
      case 'DeepSeek':
        return new DeepSeekTransformer();
      case 'OpenRouter':
        return new OpenRouterTransformer();
      default:
        return new DefaultTransformer();
    }
  }

  /**
   * Check if provider supports a feature
   */
  static providerSupportsFeature(provider: string, feature: keyof ProviderConfig['supportedFeatures']): boolean {
    const config = this.getProviderConfig(provider);
    return config?.supportedFeatures[feature] ?? false;
  }

  /**
   * Get authentication headers for provider
   */
  static getAuthHeaders(provider: string, apiKey: string): Record<string, string> {
    const config = this.getProviderConfig(provider);
    if (!config || !config.requiresApiKey) return {};

    switch (config.authMethod) {
      case 'bearer':
        return { 'Authorization': `Bearer ${apiKey}` };
      case 'header':
        if (provider === 'Anthropic') {
          return { 
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          };
        }
        return { 'Authorization': apiKey };
      case 'query':
        // For Gemini, API key is added as query parameter
        return {};
      default:
        return {};
    }
  }

  /**
   * Get provider-specific request options
   */
  static getRequestOptions(provider: string, modelKey: string): any {
    const config = this.getProviderConfig(provider);
    const modelDef = ModelLookup.getById(modelKey);
    
    if (!config || !modelDef) return {};

    const baseOptions = {
      timeout: 120000, // 2 minutes default
      maxRetries: config.errorHandling.maxRetries,
      baseDelay: config.errorHandling.baseDelayMs
    };

    // Provider-specific customizations
    switch (provider) {
      case 'OpenAI':
        if (modelDef.modelType === 'o3_o4' || modelDef.modelType === 'gpt5') {
          return { ...baseOptions, timeout: 300000 }; // 5 minutes for reasoning models
        }
        break;
      case 'xAI':
        return { ...baseOptions, timeout: 180000 }; // 3 minutes for Grok
      case 'DeepSeek':
        if (modelKey === 'deepseek-reasoner') {
          return { ...baseOptions, timeout: 240000 }; // 4 minutes for reasoning
        }
        break;
    }

    return baseOptions;
  }
}

/**
 * Provider-specific request/response transformers
 */

class OpenAITransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    const modelDef = ModelLookup.getById(modelKey);
    
    // Handle different OpenAI API endpoints
    if (modelDef?.modelType === 'gpt5' || modelDef?.modelType === 'o3_o4') {
      // Use Responses API for reasoning models
      return {
        ...request,
        model: modelDef.apiModelName,
        response_format: { type: 'json_object' }
      };
    }
    
    // Standard Chat Completions API
    return {
      ...request,
      model: modelDef?.apiModelName || modelKey,
      response_format: { type: 'json_object' }
    };
  }

  transformResponse(response: any, modelKey: string): any {
    // Handle both Chat Completions and Responses API formats
    if (response.output_text || response.output) {
      // Responses API format
      return {
        content: response.output_text || response.output?.[0]?.text,
        reasoning: response.output_reasoning,
        usage: response.usage
      };
    }
    
    // Chat Completions format
    return {
      content: response.choices?.[0]?.message?.content,
      usage: response.usage
    };
  }

  extractError(error: any): string {
    return error?.error?.message || error?.message || 'Unknown OpenAI error';
  }

  shouldRetry(error: any): boolean {
    const errorType = error?.error?.type || error?.type;
    return ['rate_limit_exceeded', 'server_error', 'timeout'].includes(errorType);
  }
}

class AnthropicTransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    const modelDef = ModelLookup.getById(modelKey);
    
    return {
      model: modelDef?.apiModelName || modelKey,
      max_tokens: request.max_tokens,
      messages: request.messages,
      temperature: request.temperature,
      system: request.system
    };
  }

  transformResponse(response: any, modelKey: string): any {
    return {
      content: response.content?.[0]?.text,
      usage: response.usage
    };
  }

  extractError(error: any): string {
    return error?.error?.message || error?.message || 'Unknown Anthropic error';
  }

  shouldRetry(error: any): boolean {
    const errorType = error?.error?.type || error?.type;
    return ['rate_limit_exceeded', 'overloaded_error'].includes(errorType);
  }
}

class XAITransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    const modelDef = ModelLookup.getById(modelKey);
    
    return {
      ...request,
      model: modelDef?.apiModelName || modelKey,
      response_format: { type: 'json_object' }
    };
  }

  transformResponse(response: any, modelKey: string): any {
    return {
      content: response.choices?.[0]?.message?.content,
      usage: response.usage
    };
  }

  extractError(error: any): string {
    return error?.error?.message || error?.message || 'Unknown xAI error';
  }

  shouldRetry(error: any): boolean {
    const errorType = error?.error?.type || error?.type;
    return ['rate_limit_exceeded', 'server_error'].includes(errorType);
  }
}

class GeminiTransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    const modelDef = ModelLookup.getById(modelKey);
    
    return {
      model: modelDef?.apiModelName || modelKey,
      generationConfig: {
        temperature: request.temperature,
        topP: request.topP
      },
      contents: request.messages?.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      })),
      systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined
    };
  }

  transformResponse(response: any, modelKey: string): any {
    return {
      content: response.candidates?.[0]?.content?.parts?.[0]?.text,
      usage: response.usageMetadata
    };
  }

  extractError(error: any): string {
    return error?.error?.message || error?.message || 'Unknown Gemini error';
  }

  shouldRetry(error: any): boolean {
    const errorCode = error?.error?.code;
    return ['RATE_LIMIT_EXCEEDED', 'INTERNAL_ERROR'].includes(errorCode);
  }
}

class DeepSeekTransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    const modelDef = ModelLookup.getById(modelKey);
    
    return {
      ...request,
      model: modelDef?.apiModelName || modelKey
    };
  }

  transformResponse(response: any, modelKey: string): any {
    const choice = response.choices?.[0];
    
    return {
      content: choice?.message?.content,
      reasoning: choice?.message?.reasoning_content,
      usage: response.usage
    };
  }

  extractError(error: any): string {
    return error?.error?.message || error?.message || 'Unknown DeepSeek error';
  }

  shouldRetry(error: any): boolean {
    const errorType = error?.error?.type || error?.type;
    return ['rate_limit_exceeded', 'server_error'].includes(errorType);
  }
}

class OpenRouterTransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    const modelDef = ModelLookup.getById(modelKey);
    
    return {
      ...request,
      model: modelDef?.apiModelName || modelKey,
      response_format: { type: 'json_object' },
      // OpenRouter-specific headers added separately
    };
  }

  transformResponse(response: any, modelKey: string): any {
    return {
      content: response.choices?.[0]?.message?.content,
      usage: response.usage
    };
  }

  extractError(error: any): string {
    return error?.error?.message || error?.message || 'Unknown OpenRouter error';
  }

  shouldRetry(error: any): boolean {
    const errorType = error?.error?.type || error?.type;
    const status = error?.status || error?.response?.status;
    return ['rate_limit_exceeded', 'server_error', 'bad_gateway'].includes(errorType) || 
           [502, 503, 504].includes(status);
  }
}

class DefaultTransformer implements RequestTransformer {
  transformRequest(request: any, modelKey: string): any {
    return request;
  }

  transformResponse(response: any, modelKey: string): any {
    return response;
  }

  extractError(error: any): string {
    return error?.message || 'Unknown error';
  }

  shouldRetry(error: any): boolean {
    return false;
  }
}

// Export convenience functions
export const providerAdapters = ProviderAdapters;