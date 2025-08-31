/**
 * ModelDefinitions.ts
 * 
 * Static model metadata definitions for all AI models.
 * Contains only immutable configuration data without runtime logic.
 * Follows Phase 5.1 architecture separation: static metadata vs. capabilities vs. provider logic.
 * 
 * @author Claude Code (Phase 5 refactor)
 */

import type { ModelConfig } from '@shared/types.js';

/**
 * Core model definitions - static metadata only
 * No runtime logic, capability detection, or provider-specific behavior
 */
export const MODEL_DEFINITIONS: ModelConfig[] = [
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
    maxOutputTokens: 100000,
    contextWindow: 1000000
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
    maxOutputTokens: 100000,
    contextWindow: 1000000
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
    maxOutputTokens: 65536,
    contextWindow: 128000
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
    maxOutputTokens: 128000,
    contextWindow: 200000
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
    maxOutputTokens: 128000,
    contextWindow: 200000
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
    maxOutputTokens: 128000,
    contextWindow: 400000
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
    maxOutputTokens: 100000,
    contextWindow: 1000000
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
    maxOutputTokens: 128000,
    contextWindow: 400000
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
    maxOutputTokens: 100000,
    contextWindow: 256000
  },
  { 
    key: 'gpt-5-mini-2025-08-07', 
    name: 'GPT-5 Mini', 
    color: 'bg-indigo-500', 
    premium: false,
    cost: { input: '$0.50', output: '$5.00' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-mini-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 128000,
    contextWindow: 200000
  },
  { 
    key: 'gpt-5-nano-2025-08-07', 
    name: 'GPT-5 Nano', 
    color: 'bg-teal-500', 
    premium: false,
    cost: { input: '$0.25', output: '$2.50' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'gpt-5-nano-2025-08-07',
    modelType: 'gpt5',
    maxOutputTokens: 64000,
    contextWindow: 100000
  },

  // Anthropic Models
  { 
    key: 'claude-3-5-haiku-20241022', 
    name: 'Claude 3.5 Haiku', 
    color: 'bg-orange-600', 
    premium: false,
    cost: { input: '$1', output: '$5' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    apiModelName: 'claude-3-5-haiku-20241022',
    modelType: 'claude',
    maxOutputTokens: 8192,
    contextWindow: 200000
  },
  { 
    key: 'claude-3-5-sonnet-20241022', 
    name: 'Claude 3.5 Sonnet', 
    color: 'bg-orange-700', 
    premium: false,
    cost: { input: '$3', output: '$15' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    apiModelName: 'claude-3-5-sonnet-20241022',
    modelType: 'claude',
    maxOutputTokens: 8192,
    contextWindow: 200000
  },

  // xAI Models  
  { 
    key: 'grok-2-1212', 
    name: 'Grok 2', 
    color: 'bg-gray-600', 
    premium: true,
    cost: { input: '$2', output: '$10' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'grok-2-1212',
    modelType: 'grok',
    maxOutputTokens: 131072,
    contextWindow: 131072
  },
  { 
    key: 'grok-2-vision-1212', 
    name: 'Grok 2 Vision', 
    color: 'bg-gray-700', 
    premium: true,
    cost: { input: '$2', output: '$10' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'grok-2-vision-1212',
    modelType: 'grok',
    maxOutputTokens: 8192,
    contextWindow: 32768
  },
  { 
    key: 'grok-beta', 
    name: 'Grok Beta', 
    color: 'bg-gray-500', 
    premium: true,
    cost: { input: '$5', output: '$15' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'slow', estimate: '2-3 min' },
    apiModelName: 'grok-beta',
    modelType: 'grok',
    maxOutputTokens: 131072,
    contextWindow: 131072
  },

  // Gemini Models
  { 
    key: 'gemini-2.5-pro', 
    name: 'Gemini 2.5 Pro', 
    color: 'bg-blue-600', 
    premium: true,
    cost: { input: '$1.25', output: '$5.00' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'gemini-2.5-pro',
    modelType: 'gemini',
    maxOutputTokens: 65000,
    contextWindow: 2000000
  },
  { 
    key: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    color: 'bg-blue-500', 
    premium: false,
    cost: { input: '$0.075', output: '$0.30' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'fast', estimate: '<30 sec' },
    supportsReasoning: true,
    apiModelName: 'gemini-2.5-flash',
    modelType: 'gemini',
    maxOutputTokens: 65000,
    contextWindow: 1000000
  },
  { 
    key: 'gemini-2.5-flash-lite', 
    name: 'Gemini 2.5 Flash Lite', 
    color: 'bg-blue-400', 
    premium: false,
    cost: { input: '$0.0375', output: '$0.15' },
    supportsTemperature: true,
    provider: 'Gemini',
    responseTime: { speed: 'fast', estimate: '<20 sec' },
    supportsReasoning: false,
    apiModelName: 'gemini-2.5-flash-lite',
    modelType: 'gemini',
    maxOutputTokens: 32000,
    contextWindow: 1000000
  },

  // DeepSeek Models
  { 
    key: 'deepseek-reasoner', 
    name: 'DeepSeek Reasoner', 
    color: 'bg-purple-600', 
    premium: true,
    cost: { input: '$0.55', output: '$2.19' },
    supportsTemperature: true,
    provider: 'DeepSeek',
    responseTime: { speed: 'slow', estimate: '2-3 min' },
    supportsReasoning: true,
    apiModelName: 'deepseek-reasoner',
    modelType: 'deepseek',
    maxOutputTokens: 8192,
    contextWindow: 65536
  },
  { 
    key: 'deepseek-chat', 
    name: 'DeepSeek V3', 
    color: 'bg-purple-500', 
    premium: false,
    cost: { input: '$0.27', output: '$1.10' },
    supportsTemperature: true,
    provider: 'DeepSeek',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' },
    apiModelName: 'deepseek-chat',
    modelType: 'deepseek',
    maxOutputTokens: 8192,
    contextWindow: 65536
  },

  // OpenRouter Models
  {
    key: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    color: 'bg-green-600',
    premium: false,
    cost: { input: '$0.59', output: '$0.79' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'meta-llama/llama-3.3-70b-instruct',
    modelType: 'openrouter',
    maxOutputTokens: 32000,
    contextWindow: 131072
  },
  {
    key: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    color: 'bg-red-600',
    premium: false,
    cost: { input: '$0.70', output: '$2.10' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'qwen/qwen-2.5-coder-32b-instruct',
    modelType: 'openrouter',
    maxOutputTokens: 32768,
    contextWindow: 131072
  },
  {
    key: 'mistralai/mistral-large',
    name: 'Mistral Large',
    color: 'bg-indigo-600',
    premium: false,
    cost: { input: '$2.00', output: '$6.00' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'mistralai/mistral-large',
    modelType: 'openrouter',
    maxOutputTokens: 32768,
    contextWindow: 131072
  },
  {
    key: 'cohere/command-r-plus',
    name: 'Command R+',
    color: 'bg-pink-600',
    premium: false,
    cost: { input: '$2.50', output: '$10.00' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'cohere/command-r-plus',
    modelType: 'openrouter',
    maxOutputTokens: 4096,
    contextWindow: 131072
  },
  {
    key: 'deepseek/deepseek-chat-v3.1',
    name: 'DeepSeek Chat v3.1 (OpenRouter)',
    color: 'bg-purple-400',
    premium: false,
    cost: { input: '$0.27', output: '$1.10' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'deepseek/deepseek-chat-v3.1',
    modelType: 'openrouter',
    maxOutputTokens: 8192,
    contextWindow: 65536
  },
  {
    key: 'nousresearch/hermes-4-70b',
    name: 'Hermes 4 70B',
    color: 'bg-emerald-600',
    premium: false,
    cost: { input: '$0.35', output: '$0.40' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    apiModelName: 'nousresearch/hermes-4-70b',
    modelType: 'openrouter',
    maxOutputTokens: 4096,
    contextWindow: 131072
  },
  {
    key: 'deepseek/deepseek-r1-0528:free',
    name: 'DeepSeek R1 0528 (Free)',
    color: 'bg-cyan-300',
    premium: false,
    cost: { input: '$0.00', output: '$0.00' },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime: { speed: 'moderate', estimate: '1-2 min' },
    supportsReasoning: true,
    apiModelName: 'deepseek/deepseek-r1-0528:free',
    modelType: 'openrouter',
    maxOutputTokens: 66384,
    contextWindow: 256000
  }
];

/**
 * Model categorization for efficient lookups
 * Static groupings based on model metadata
 */
export const MODEL_CATEGORIES = {
  byProvider: {
    OpenAI: MODEL_DEFINITIONS.filter(m => m.provider === 'OpenAI'),
    Anthropic: MODEL_DEFINITIONS.filter(m => m.provider === 'Anthropic'),
    xAI: MODEL_DEFINITIONS.filter(m => m.provider === 'xAI'),
    Gemini: MODEL_DEFINITIONS.filter(m => m.provider === 'Gemini'),
    DeepSeek: MODEL_DEFINITIONS.filter(m => m.provider === 'DeepSeek'),
    OpenRouter: MODEL_DEFINITIONS.filter(m => m.provider === 'OpenRouter')
  },
  
  byType: {
    gpt5: MODEL_DEFINITIONS.filter(m => m.modelType === 'gpt5'),
    gpt5_chat: MODEL_DEFINITIONS.filter(m => m.modelType === 'gpt5_chat'),
    o3_o4: MODEL_DEFINITIONS.filter(m => m.modelType === 'o3_o4'),
    claude: MODEL_DEFINITIONS.filter(m => m.modelType === 'claude'),
    grok: MODEL_DEFINITIONS.filter(m => m.modelType === 'grok'),
    gemini: MODEL_DEFINITIONS.filter(m => m.modelType === 'gemini'),
    deepseek: MODEL_DEFINITIONS.filter(m => m.modelType === 'deepseek'),
    openrouter: MODEL_DEFINITIONS.filter(m => m.modelType === 'openrouter')
  },
  
  byCapability: {
    reasoning: MODEL_DEFINITIONS.filter(m => m.supportsReasoning),
    temperature: MODEL_DEFINITIONS.filter(m => m.supportsTemperature),
    premium: MODEL_DEFINITIONS.filter(m => m.premium),
    free: MODEL_DEFINITIONS.filter(m => !m.premium)
  }
};

/**
 * Model lookup utilities - static data operations only
 */
export const ModelLookup = {
  getById: (modelKey: string): ModelConfig | undefined => {
    return MODEL_DEFINITIONS.find(m => m.key === modelKey);
  },
  
  getByProvider: (provider: string): ModelConfig[] => {
    return MODEL_DEFINITIONS.filter(m => m.provider === provider);
  },
  
  getByType: (modelType: string): ModelConfig[] => {
    return MODEL_DEFINITIONS.filter(m => m.modelType === modelType);
  },
  
  getAllKeys: (): string[] => {
    return MODEL_DEFINITIONS.map(m => m.key);
  },
  
  getAllProviders: (): string[] => {
    return [...new Set(MODEL_DEFINITIONS.map(m => m.provider))];
  },
  
  getAllTypes: (): string[] => {
    return [...new Set(MODEL_DEFINITIONS.map(m => m.modelType))];
  }
};

/**
 * Backward compatibility exports
 * Maintains compatibility with existing code
 */
export const MODELS = MODEL_DEFINITIONS;
export { MODEL_DEFINITIONS as default };