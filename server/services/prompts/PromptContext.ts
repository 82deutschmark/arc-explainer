/**
 * server/services/prompts/PromptContext.ts
 * 
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-10-08
 * 
 * PURPOSE:
 * Central context detection system that determines HOW to build prompts
 * based on WHAT the situation is. Enables context-aware prompt assembly
 * that adapts to conversation state, mode requirements, and provider capabilities.
 * 
 * CRITICAL FIX: Addresses "context blindness" problem where Discussion mode
 * prompts were identical on continuation turns, wasting 600+ tokens repeating
 * grid examples and ARC explanations that the LLM already knows from previousResponseId.
 * 
 * SRP/DRY Check: PASS
 * - Single responsibility: Context detection and classification
 * - Eliminates redundant prompt content on continuation turns
 * - Foundation for provider-specific optimizations
 * 
 * shadcn/ui: N/A (backend utility)
 */

import type { ARCTask } from '../../../shared/types.js';
import type { PromptOptions } from '../promptBuilder.js';
import type { ServiceOptions } from '../base/BaseAIService.js';

/**
 * Conversation state determines what context the LLM already has
 */
export type ConversationState = 'initial' | 'continuation';

/**
 * Provider type affects API capabilities and prompt requirements
 */
export type ProviderType = 'openai' | 'anthropic' | 'grok' | 'gemini' | 'deepseek' | 'openrouter';

/**
 * Prompt mode determines structure and content requirements
 */
export type PromptMode = 
  | 'solver' 
  | 'explanation' 
  | 'debate' 
  | 'discussion' 
  | 'alienCommunication' 
  | 'educational'
  | 'gepa'
  | 'custom';

/**
 * Complete context for prompt generation decisions
 */
export interface PromptContext {
  /** Mode determines structure and content */
  mode: PromptMode;
  
  /** Conversation state determines what to include */
  conversationState: ConversationState;
  
  /** Provider determines API-specific adaptations */
  provider: ProviderType;
  
  /** Special data flags that affect prompt content */
  flags: {
    /** Debate mode: Has original explanation to critique */
    hasOriginalExplanation: boolean;
    
    /** Retry mode: Has previous failed analysis */
    hasPreviousAnalysis: boolean;
    
    /** Alien mode: Uses emoji representations */
    useEmojis: boolean;
    
    /** Multi-test affects JSON field instructions */
    isMultiTest: boolean;
    
    /** Custom prompt mode */
    hasCustomPrompt: boolean;
  };
  
  /** Provider-specific context from serviceOpts */
  providerContext: {
    /** Responses API: Previous response ID for chaining */
    previousResponseId?: string;
    
    /** System prompt mode (ARC vs None) */
    systemPromptMode?: string;
  };
}

/**
 * Detect provider type from service options or infer from context
 * In a real implementation, this could use model key patterns or explicit provider field
 */
function detectProvider(serviceOpts: ServiceOptions): ProviderType {
  // For now, default to openai since most models use Responses API
  // In Phase 3, we'd detect from modelKey or add explicit provider field
  return 'openai';
}

/**
 * Determine conversation state based on previousResponseId
 * This is the KEY insight: If we have a previousResponseId, the LLM has full context!
 */
function determineConversationState(serviceOpts: ServiceOptions): ConversationState {
  return serviceOpts.previousResponseId ? 'continuation' : 'initial';
}

/**
 * Main context detection function
 * This is called once per prompt build to determine the optimal prompt structure
 */
export function determinePromptContext(
  promptId: string,
  options: PromptOptions,
  serviceOpts: ServiceOptions,
  task: ARCTask,
  customPrompt?: string
): PromptContext {
  const conversationState = determineConversationState(serviceOpts);
  
  return {
    mode: promptId as PromptMode,
    conversationState,
    provider: detectProvider(serviceOpts),
    
    flags: {
      hasOriginalExplanation: !!options.originalExplanation,
      hasPreviousAnalysis: !!options.previousAnalysis,
      useEmojis: !!options.emojiSetKey || promptId === 'alienCommunication',
      isMultiTest: task.test.length > 1,
      hasCustomPrompt: !!customPrompt
    },
    
    providerContext: {
      previousResponseId: serviceOpts.previousResponseId,
      systemPromptMode: serviceOpts.systemPromptMode
    }
  };
}

/**
 * Check if this mode supports conversation chaining
 * Some modes (like alien) need full context every time
 */
export function supportsChaining(mode: PromptMode): boolean {
  switch (mode) {
    case 'discussion':
    case 'debate':
    case 'solver':
    case 'explanation':
      return true;
    
    case 'alienCommunication':
      return false; // Emoji context must be maintained
    
    case 'educational':
    case 'gepa':
    case 'custom':
      return true;
    
    default:
      return true;
  }
}

/**
 * Determine if we should use continuation-optimized prompt
 * Only use if: mode supports it, we have previousResponseId, and provider supports it
 */
export function shouldUseContinuationPrompt(context: PromptContext): boolean {
  // Must have previousResponseId
  if (!context.providerContext.previousResponseId) {
    return false;
  }
  
  // Mode must support chaining
  if (!supportsChaining(context.mode)) {
    return false;
  }
  
  // Provider must support chaining (Anthropic doesn't have native previousResponseId)
  if (context.provider === 'anthropic') {
    return false;
  }
  
  return context.conversationState === 'continuation';
}
