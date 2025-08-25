/**
 * Centralized model configuration - single source of truth for all AI models
 * Replaces client-side constants and scattered server-side hardcoded lists
 * 
 * @author Cascade
 */

export interface ModelConfig {
  key: string;
  name: string;
  color: string;
  premium: boolean;
  cost: { input: string; output: string };
  supportsTemperature: boolean;
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'xAI' | 'DeepSeek';
  responseTime: { speed: 'fast' | 'moderate' | 'slow'; estimate: string };
  supportsReasoning?: boolean;
  // Server-only properties
  apiModelName?: string; // Actual API model name if different from key
  modelType?: 'o3_o4' | 'gpt5' | 'gpt5_chat' | 'claude' | 'gemini' | 'grok' | 'deepseek';
  maxOutputTokens?: number;
  contextWindow?: number;
}

/**
 * Complete model registry - single source of truth
 */
export const MODELS: ModelConfig[] = [
  // OpenAI Models
  { 
    key: 'gpt-4.1-nano-2025-04-14', 
    name: 'GPT-4.1 Nano', 
    color: 'bg-blue-500', 
    premium: false,
    cost: { input: '$0.10', output: '$0.40' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    apiModelName: 'gpt-4.1-nano-2025-04-14',
    modelType: 'gpt5_chat',
    maxOutputTokens: 100000
  },
  { 
    key: 'gpt-4.1-mini-2025-04-14', 
    name: 'GPT-4.1 Mini', 
    color: 'bg-purple-500', 
    premium: false,
    cost: { input: '$0.40', output: '$1.60' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    apiModelName: 'gpt-4.1-mini-2025-04-14',
    modelType: 'gpt5_chat',
    maxOutputTokens: 100000
  },
  { 
    key: 'gpt-4o-mini-2024-07-18', 
    name: 'GPT-4o Mini', 
    color: 'bg-orange-500', 
    premium: false,
    cost: { input: '$0.15', output: '$0.60' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    apiModelName: 'gpt-4o-mini-2024-07-18',
    modelType: 'gpt5_chat',
    maxOutputTokens: 65536
  },
  { 
    key: 'o3-mini-2025-01-31', 
    name: 'o3 Mini', 
    color: 'bg-red-500', 
    premium: true,
    cost: { input: '$1.50', output: '$6.00' },
    supportsTemperature: false, // Responses API doesn't support temperature for o3/o4
    provider: 'OpenAI',
    responseTime: { speed: 'slow', estimate: '2-5 min' },
    supportsReasoning: true,
    apiModelName: 'o3-mini-2025-01-31',
    modelType: 'o3_o4',
    maxOutputTokens: 128000
  },
  { 
    key: 'o4-mini-2025-04-16', 
    name: 'o4 Mini', 
    color: 'bg-pink-500', 
    premium: true,
    cost: { input: '$2.50', output: '$10.00' },
    supportsTemperature: false, // Responses API doesn't support temperature for o3/o4
    provider: 'OpenAI',
    responseTime: { speed: 'slow', estimate: '2-5 min' },
    supportsReasoning: true,
    apiModelName: 'o4-mini-2025-04-16',
    modelType: 'o3_o4',
    maxOutputTokens: 128000
  },
  { 
    key: 'o3-2025-04-16', 
    name: 'o3 Pro', 
    color: 'bg-gray-700', 
    premium: true,
    cost: { input: '$15.00', output: '$60.00' },
    supportsTemperature: false, // Responses API doesn't support temperature for o3/o4
    provider: 'OpenAI',
    responseTime: { speed: 'slow', estimate: '5-15 min' },
    supportsReasoning: true,
    apiModelName: 'o3-2025-04-16',
    modelType: 'o3_o4',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-4.1-2025-04-14', 
    name: 'GPT-4.1', 
    color: 'bg-sky-500', 
    premium: true,
    cost: { input: '$2.50', output: '$10.00' },
    supportsTemperature: false, // Based on your temperature error fix
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: false,
    apiModelName: 'gpt-4.1-2025-04-14',
    modelType: 'gpt5_chat',
    maxOutputTokens: 100000
  },
  { 
    key: 'gpt-5-2025-08-07', 
    name: 'GPT-5', 
    color: 'bg-indigo-500', 
    premium: true,
    cost: { input: '$0.25', output: '$2.00' },
    supportsTemperature: false, // Based on your temperature error fix
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-5-nano-2025-08-07', 
    name: 'GPT-5 Nano', 
    color: 'bg-teal-500', 
    premium: false,
    cost: { input: '$0.05', output: '$0.40' },
    supportsTemperature: false, // GPT-5 nano doesn't support temperature in Responses API
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-nano-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-5-mini-2025-08-07', 
    name: 'GPT-5 Mini', 
    color: 'bg-emerald-500', 
    premium: false,
    cost: { input: '$0.10', output: '$0.40' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-mini-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-5-chat-latest', 
    name: 'GPT-5 Chat', 
    color: 'bg-cyan-500', 
    premium: true,
    cost: { input: '$1.00', output: '$4.00' },
    supportsTemperature: true, // GPT-5 Chat supports temperature
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: false,
    apiModelName: 'gpt-5-chat-latest',
    modelType: 'gpt5_chat',
    maxOutputTokens: 100000
  },

  // Anthropic Models
  { 
    key: 'claude-sonnet-4-20250514', 
    name: 'Claude Sonnet 4', 
    color: 'bg-orange-600', 
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '45-90 sec' },
    apiModelName: 'claude-sonnet-4-20250514',
    modelType: 'claude',
    maxOutputTokens: 20000
  },
  { 
    key: 'claude-3-7-sonnet-20250219', 
    name: 'Claude 3.7 Sonnet', 
    color: 'bg-amber-600', 
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '45-90 sec' },
    apiModelName: 'claude-3-7-sonnet-20250219',
    modelType: 'claude',
    maxOutputTokens: 20000
  },

  // Google Gemini Models  
  { 
    key: 'gemini-2.5-pro', 
    name: 'Gemini 2.5 Pro', 
    color: 'bg-blue-600', 
    premium: true,
    cost: { input: '$1.25', output: '$5.00' },
    supportsTemperature: true,
    provider: 'Google',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: true,
    apiModelName: 'models/gemini-2.5-pro',
    modelType: 'gemini',
    maxOutputTokens: 65536,
    contextWindow: 1000000
  }
];

/**
 * Helper functions for model capabilities
 */
export function getModelConfig(modelKey: string): ModelConfig | undefined {
  return MODELS.find(m => m.key === modelKey);
}

export function modelSupportsTemperature(modelKey: string): boolean {
  const config = getModelConfig(modelKey);
  return config?.supportsTemperature ?? false;
}

export function modelSupportsReasoning(modelKey: string): boolean {
  const config = getModelConfig(modelKey);
  return config?.supportsReasoning ?? false;
}

export function getApiModelName(modelKey: string): string {
  const config = getModelConfig(modelKey);
  return config?.apiModelName ?? modelKey;
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODELS.filter(m => m.provider === provider);
}

export function getModelsByType(modelType: string): ModelConfig[] {
  return MODELS.filter(m => m.modelType === modelType);
}

/**
 * Model type categorization for backward compatibility
 */
export const O3_O4_REASONING_MODELS = new Set(
  getModelsByType('o3_o4').map(m => m.key)
);

export const GPT5_REASONING_MODELS = new Set(
  getModelsByType('gpt5').map(m => m.key)
);

export const GPT5_CHAT_MODELS = new Set(
  getModelsByType('gpt5_chat').map(m => m.key)
);

export const MODELS_WITH_REASONING = new Set(
  MODELS.filter(m => m.supportsReasoning).map(m => m.key)
);
