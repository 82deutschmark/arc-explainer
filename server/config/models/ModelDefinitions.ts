/**
 * ModelDefinitions.ts
 * 
 * Static model metadata definitions for all AI models.
 * This file imports the raw model data and provides structured access to it.
 * Follows Phase 5.1 architecture: separates static definitions from runtime logic.
 * 
 * @author Cascade (with guidance from user)
 */

import { MODELS as MODEL_DEFINITIONS } from '../models.js';
import type { ModelConfig } from '@shared/types.js';

// Re-export for backward compatibility and direct access
export const MODELS = MODEL_DEFINITIONS;

/**
 * Provides structured access to model definitions.
 */
export class ModelLookup {
  private static readonly modelMap = new Map<string, ModelConfig>(
    MODEL_DEFINITIONS.map(m => [m.key, m])
  );

  static getById(modelKey: string): ModelConfig | undefined {
    return this.modelMap.get(modelKey);
  }

  static getByProvider(provider: string): ModelConfig[] {
    return MODEL_DEFINITIONS.filter(m => m.provider === provider);
  }

  static getByType(modelType: string): ModelConfig[] {
    return MODEL_DEFINITIONS.filter(m => m.modelType === modelType);
  }
}

// For backward compatibility with the old structure
export { MODEL_DEFINITIONS };

// Model categorization sets
export const MODEL_CATEGORIES = {
  O3_O4_REASONING_MODELS: new Set(
    ModelLookup.getByType('o3_o4').map(m => m.key)
  ),
  GPT5_REASONING_MODELS: new Set(
    ModelLookup.getByType('gpt5').map(m => m.key)
  ),
  GPT5_CHAT_MODELS: new Set(
    ModelLookup.getByType('gpt5_chat').map(m => m.key)
  ),
  MODELS_WITH_REASONING: new Set(
    MODEL_DEFINITIONS.filter(m => m.supportsReasoning).map(m => m.key)
  ),
  OPENAI_MODELS: new Set(
    ModelLookup.getByProvider('OpenAI').map(m => m.key)
  ),
  ANTHROPIC_MODELS: new Set(
    ModelLookup.getByProvider('Anthropic').map(m => m.key)
  ),
  XAI_MODELS: new Set(
    ModelLookup.getByProvider('xAI').map(m => m.key)
  ),
  GEMINI_MODELS: new Set(
    ModelLookup.getByProvider('Gemini').map(m => m.key)
  ),
  DEEPSEEK_MODELS: new Set(
    ModelLookup.getByProvider('DeepSeek').map(m => m.key)
  ),
  OPENROUTER_MODELS: new Set(
    ModelLookup.getByProvider('OpenRouter').map(m => m.key)
  )
};
