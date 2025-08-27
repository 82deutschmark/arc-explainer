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
  provider: 'OpenAI' | 'Anthropic' | 'Gemini' | 'xAI' | 'DeepSeek' | 'OpenRouter';
  responseTime: { speed: 'fast' | 'moderate' | 'slow'; estimate: string };
  supportsReasoning?: boolean;
  // Server-only properties
  apiModelName?: string; // Actual API model name if different from key
  modelType?: 'o3_o4' | 'gpt5' | 'gpt5_chat' | 'claude' | 'gemini' | 'grok' | 'deepseek' | 'openrouter';
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
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    apiModelName: 'gpt-4o-mini-2024-07-18',
    modelType: 'gpt5_chat',
    maxOutputTokens: 65536
  },
  { 
    key: 'o3-mini-2025-01-31', 
    name: 'o3-mini', 
    color: 'bg-red-500', 
    premium: true,
    cost: { input: '$1.10', output: '$4.40' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'o3-mini-2025-01-31',
    modelType: 'o3_o4',
    maxOutputTokens: 128000
  },
  { 
    key: 'o4-mini-2025-04-16', 
    name: 'o4-mini', 
    color: 'bg-pink-500', 
    premium: true,
    cost: { input: '$1.10', output: '$4.40' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-3 min' },
    supportsReasoning: true,
    apiModelName: 'o4-mini-2025-04-16',
    modelType: 'o3_o4',
    maxOutputTokens: 128000
  },
  { 
    key: 'o3-2025-04-16', 
    name: 'o3-2025-04-16', 
    color: 'bg-green-500', 
    premium: true,
    cost: { input: '$2', output: '$8' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'slow', estimate: '3-5+ min' },
    supportsReasoning: true,
    apiModelName: 'o3-2025-04-16',
    modelType: 'o3_o4',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-4.1-2025-04-14', 
    name: 'GPT-4.1', 
    color: 'bg-yellow-500', 
    premium: true,
    cost: { input: '$2.00', output: '$8.00' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'gpt-4.1-2025-04-14',
    modelType: 'gpt5_chat',
    maxOutputTokens: 100000
  },
  { 
    key: 'gpt-5-2025-08-07', 
    name: 'GPT-5', 
    color: 'bg-emerald-500', 
    premium: true,
    cost: { input: '$1.25', output: '$10.00' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-5-chat-latest', 
    name: 'GPT-5 Chat', 
    color: 'bg-amber-500', 
    premium: false,
    cost: { input: '$1.25', output: '$10.00' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: false,
    apiModelName: 'gpt-5-chat-latest',
    modelType: 'gpt5_chat',
    maxOutputTokens: 100000
  },
  { 
    key: 'gpt-5-mini-2025-08-07', 
    name: 'GPT-5 Mini', 
    color: 'bg-indigo-500', 
    premium: true,
    cost: { input: '$0.25', output: '$2.00' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-mini-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000
  },
  { 
    key: 'gpt-5-nano-2025-08-07', 
    name: 'GPT-5 Nano', 
    color: 'bg-teal-500', 
    premium: false,
    cost: { input: '$0.05', output: '$0.40' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-nano-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000
  },

  // Anthropic Models
  { 
    key: 'claude-sonnet-4-20250514', 
    name: 'Claude Sonnet 4', 
    color: 'bg-indigo-500', 
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '1-3 min' },
    supportsReasoning: true,
    apiModelName: 'claude-sonnet-4-20250514',
    modelType: 'claude',
    maxOutputTokens: 20000
  },
  { 
    key: 'claude-3-7-sonnet-20250219', 
    name: 'Claude 3.7 Sonnet', 
    color: 'bg-indigo-400', 
    premium: false,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'claude-3-7-sonnet-20250219',
    modelType: 'claude',
    maxOutputTokens: 20000
  },
  { 
    key: 'claude-3-5-sonnet-20241022', 
    name: 'Claude 3.5 Sonnet', 
    color: 'bg-violet-500', 
    premium: false,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'claude-3-5-sonnet-20241022',
    modelType: 'claude',
    maxOutputTokens: 20000
  },
  { 
    key: 'claude-3-5-haiku-20241022', 
    name: 'Claude 3.5 Haiku', 
    color: 'bg-violet-400', 
    premium: false,
    cost: { input: '$0.80', output: '$4.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: true,
    apiModelName: 'claude-3-5-haiku-20241022',
    modelType: 'claude',
    maxOutputTokens: 20000
  },
  { 
    key: 'claude-3-haiku-20240307', 
    name: 'Claude 3 Haiku', 
    color: 'bg-purple-400', 
    premium: false,
    cost: { input: '$0.25', output: '$1.25' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'fast', estimate: '<60 sec' },
    supportsReasoning: true,
    apiModelName: 'claude-3-haiku-20240307',
    modelType: 'claude',
    maxOutputTokens: 20000
  },

  // xAI Grok Models
  {
    key: 'grok-4-0709',
    name: 'Grok 4 (July 2025)',
    color: 'bg-gray-900',
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: false,
    provider: 'xAI',
    responseTime: { speed: 'slow', estimate: '3-5+ min' },
    supportsReasoning: true,
    apiModelName: 'grok-4-0709',
    modelType: 'grok',
    maxOutputTokens: 65536
  },
  {
    key: 'grok-3',
    name: 'Grok 3',
    color: 'bg-gray-600',
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'slow', estimate: '3-5+ min' },
    apiModelName: 'grok-3',
    modelType: 'grok',
    maxOutputTokens: 65536
  },
  {
    key: 'grok-3-mini',
    name: 'Grok 3 Mini',
    color: 'bg-gray-500',
    premium: false,
    cost: { input: '$0.30', output: '$0.50' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'grok-3-mini',
    modelType: 'grok',
    maxOutputTokens: 65536
  },
  {
    key: 'grok-3-mini-fast',
    name: 'Grok 3 Mini Fast',
    color: 'bg-gray-600',
    premium: false,
    cost: { input: '$0.60', output: '$4.00' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'fast', estimate: '30-60 sec' },
    apiModelName: 'grok-3-mini-fast',
    modelType: 'grok',
    maxOutputTokens: 65536
  },

  // Google Gemini Models
  {
    key: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    color: 'bg-teal-600',
    premium: true,
    cost: { input: '$2.50', output: '$8.00' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'models/gemini-2.5-pro',
    modelType: 'gemini',
    maxOutputTokens: 65536,
    contextWindow: 1000000
  },
  {
    key: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    color: 'bg-teal-500',
    premium: false,
    cost: { input: '$0.70', output: '$2.10' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: true,
    apiModelName: 'models/gemini-2.5-flash',
    modelType: 'gemini',
    maxOutputTokens: 65536,
    contextWindow: 1000000
  },
  {
    key: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    color: 'bg-teal-400',
    premium: false,
    cost: { input: '$0.35', output: '$1.05' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'models/gemini-2.5-flash-lite',
    modelType: 'gemini',
    maxOutputTokens: 65536,
    contextWindow: 1000000
  },
  {
    key: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    color: 'bg-teal-300',
    premium: false,
    cost: { input: '$0.20', output: '$0.60' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'models/gemini-2.0-flash',
    modelType: 'gemini',
    maxOutputTokens: 65536,
    contextWindow: 1000000
  },
  {
    key: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    color: 'bg-teal-200',
    premium: false,
    cost: { input: '$0.10', output: '$0.30' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'models/gemini-2.0-flash-lite',
    modelType: 'gemini',
    maxOutputTokens: 65536,
    contextWindow: 1000000
  },
  
  // DeepSeek Models
  {
    key: 'deepseek-chat',
    name: 'DeepSeek Chat',
    color: 'bg-cyan-600',
    premium: false,
    cost: { input: '$0.14', output: '$0.28' },
    supportsTemperature: true,
    provider: 'DeepSeek',
    responseTime: { speed: 'moderate', estimate: '30-90 sec' },
    supportsReasoning: true,
    apiModelName: 'deepseek-chat',
    modelType: 'deepseek',
    maxOutputTokens: 65536
  },
  {
    key: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    color: 'bg-cyan-800',
    premium: true,
    cost: { input: '$0.55', output: '$2.19' },
    supportsTemperature: false,
    provider: 'DeepSeek',
    responseTime: { speed: 'slow', estimate: '5-10 min' },
    supportsReasoning: true,
    apiModelName: 'deepseek-reasoner',
    modelType: 'deepseek',
    maxOutputTokens: 65536
  },

  // OpenRouter Models (accessing various providers through OpenRouter)
  {
    key: 'meta-llama/llama-3.2-90b-vision-instruct',
    name: 'Llama 3.2 90B Vision',
    color: 'bg-orange-600',
    premium: false,
    cost: { input: '$0.90', output: '$0.90' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: false,
    apiModelName: 'meta-llama/llama-3.2-90b-vision-instruct',
    modelType: 'openrouter',
    maxOutputTokens: 8192
  },
  {
    key: 'anthropic/claude-3.5-sonnet:beta',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    color: 'bg-violet-600',
    premium: false,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: false,
    apiModelName: 'anthropic/claude-3.5-sonnet:beta',
    modelType: 'openrouter',
    maxOutputTokens: 8192
  },
  {
    key: 'google/gemini-2.5-flash-exp',
    name: 'Gemini 2.5 Flash Exp (OpenRouter)',
    color: 'bg-teal-700',
    premium: false,
    cost: { input: '$0.35', output: '$1.05' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: false,
    apiModelName: 'google/gemini-2.5-flash-exp',
    modelType: 'openrouter',
    maxOutputTokens: 8192
  },
  {
    key: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (OpenRouter)',
    color: 'bg-orange-400',
    premium: false,
    cost: { input: '$0.15', output: '$0.60' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: false,
    apiModelName: 'openai/gpt-4o-mini',
    modelType: 'openrouter',
    maxOutputTokens: 16384
  },
  {
    key: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    color: 'bg-red-600',
    premium: false,
    cost: { input: '$0.30', output: '$0.30' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    supportsReasoning: false,
    apiModelName: 'qwen/qwen-2.5-coder-32b-instruct',
    modelType: 'openrouter',
    maxOutputTokens: 8192
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
