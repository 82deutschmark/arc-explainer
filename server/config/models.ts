/**
 * models.ts - Backward Compatible Model Configuration
 * 
 * Maintains full backward compatibility with existing code while using
 * the new modular architecture under the hood (Phase 5.1 refactor).
 * 
 * All existing imports and function calls will continue to work exactly as before,
 * but now benefit from the improved separation of concerns and enhanced capabilities.
 * 
 * @author Cascade (original), Claude Code (Phase 5 refactor)
 */

// Import from the new modular architecture
export {
  // Core exports - maintain exact same interface
  MODELS,
  getModelConfig,
  modelSupportsTemperature,
  modelSupportsReasoning,
  getApiModelName,
  getModelsByProvider,
  getModelsByType,
  
  // Model categorization sets - maintain exact same interface
  O3_O4_REASONING_MODELS,
  GPT5_REASONING_MODELS,
  GPT5_CHAT_MODELS,
  MODELS_WITH_REASONING,
  
  // Provider-specific model sets
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  XAI_MODELS,
  GEMINI_MODELS,
  DEEPSEEK_MODELS,
  OPENROUTER_MODELS,
  
  // Enhanced functionality from new architecture (optional usage)
  getModelInfo,
  getAvailableModels,
  modelSupports,
  modelCapabilities,
  providerAdapters
} from './models/index.js';

// Re-export types for compatibility
export type { ModelConfig } from '@shared/types.js';
export type { ModelCapabilityStatus, ProviderConfig, RequestTransformer } from './models/index.js';

/**
 * MIGRATION NOTES:
 * 
 * This file now acts as a compatibility layer over the new modular architecture.
 * All existing code will continue to work without changes, but can optionally 
 * take advantage of new capabilities:
 * 
 * OLD WAY (still works):
 *   import { MODELS, getModelConfig } from '../config/models.js'
 * 
 * NEW WAY (enhanced features):
 *   import { getModelInfo, modelCapabilities } from '../config/models.js'
 *   const info = await getModelInfo(modelKey); // Includes runtime capabilities
 *   const isAvailable = await modelCapabilities.isModelAvailable(modelKey);
 * 
 * The modular files can also be imported directly:
 *   import { ModelLookup } from '../config/models/ModelDefinitions.js'
 *   import { modelCapabilities } from '../config/models/ModelCapabilities.js'  
 *   import { providerAdapters } from '../config/models/ProviderAdapters.js'
 */