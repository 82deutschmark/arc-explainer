/**
 * Author: gpt-5-codex
 * Date: 2025-10-16
 * PURPOSE: Centralized factory that lazily loads and routes AI service singletons by model prefix.
 *          Integration points: dynamic ES module imports for provider implementations (OpenAI, Anthropic, Grok, Gemini,
 *          DeepSeek, OpenRouter, Grover, Saturn, Heuristic) used by HTTP controllers when resolving model requests.
 * SRP/DRY check: Pass — single responsibility for provider routing and reuse of existing services.
 * DaisyUI: Pass — backend-only TypeScript module with no UI elements.
 */

export interface CanonicalModelKey {
  original: string;
  normalized: string;
}

const OPENAI_PREFIX = 'openai/';

export const canonicalizeModelKey = (modelKey: string): CanonicalModelKey => {
  if (typeof modelKey !== 'string' || modelKey.length === 0) {
    return {
      original: modelKey,
      normalized: modelKey,
    };
  }

  if (modelKey.startsWith(OPENAI_PREFIX)) {
    return {
      original: modelKey,
      normalized: modelKey.slice(OPENAI_PREFIX.length),
    };
  }

  return {
    original: modelKey,
    normalized: modelKey,
  };
};

class AIServiceFactory {
  private anthropicService: any;
  private openaiService: any;
  private grokService: any;
  private geminiService: any;
  private deepseekService: any;
  private openrouterService: any;
  private groverService: any;
  private saturnService: any;
  private heuristicService: any;

  /**
   * Initialize the factory by loading all AI services once at startup
   */
  async initialize() {
    try {
      // Import services once at startup
      const { anthropicService } = await import('./anthropic');
      const { openaiService } = await import('./openai');
      const { grokService } = await import('./grok');
      const { geminiService } = await import('./gemini');
      const { deepseekService } = await import('./deepseek');
      const { openrouterService } = await import('./openrouter');
      const { groverService } = await import('./grover');
      const { saturnService } = await import('./saturnService');
      const { heuristicService } = await import('./heuristic');

      this.anthropicService = anthropicService;
      this.openaiService = openaiService;
      this.grokService = grokService;
      this.geminiService = geminiService;
      this.deepseekService = deepseekService;
      this.openrouterService = openrouterService;
      this.groverService = groverService;
      this.saturnService = saturnService;
      this.heuristicService = heuristicService;
    } catch (error) {
      console.error('[Factory] Error initializing services:', error);
      throw error;
    }
  }

  /**
   * Get the appropriate AI service based on model name
   *
   * @param model - The model name to determine which service to use
   * @returns The appropriate AI service
   */
  getService(model: string) {
    const { original, normalized } = canonicalizeModelKey(model);
    // Log routing decision for debugging
    console.log(
      `[Factory] Routing model '${original}' (normalized: '${normalized}') to service:`
    );

    // Anthropic Claude models
    if (normalized.startsWith('claude-')) {
      console.log('   -> Anthropic service');
      return this.anthropicService;
    }

    // Heuristic solver (internal Python solver)
    if (normalized.startsWith('heuristic-')) {
      console.log('   -> heuristic service');
      return this.heuristicService;
    }

    // Saturn visual solver (uses underlying models with visual analysis)
    if (normalized.startsWith('saturn-')) {
      console.log('   -> Saturn service');
      return this.saturnService;
    }

    // Grover iterative solver (uses underlying models)
    if (normalized.startsWith('grover-')) {
      console.log('   -> Grover service');
      return this.groverService;
    }

    // xAI Grok models
    if (normalized.startsWith('grok-')) {
      console.log('   -> Grok service');
      return this.grokService;
    }

    // Google Gemini models
    if (normalized.startsWith('gemini-')) {
      console.log('   -> Gemini service');
      return this.geminiService;
    }

    // DeepSeek models
    if (normalized.startsWith('deepseek-')) {
      console.log('   -> DeepSeek service');
      return this.deepseekService;
    }

    // OpenRouter models (detect by provider-style naming: provider/model-name)
    if (
      normalized.includes('/') ||
      normalized.startsWith('meta-') ||
      normalized.startsWith('anthropic/') ||
      normalized.startsWith('google/') ||
      normalized.startsWith('qwen/') ||
      normalized.startsWith('x-ai/')
    ) {
      console.log('   -> OpenRouter service');
      return this.openrouterService;
    }

    // Default to OpenAI
    console.log('   -> OpenAI service');
    return this.openaiService;
  }
}

// Export a singleton instance
export const aiServiceFactory = new AIServiceFactory();
