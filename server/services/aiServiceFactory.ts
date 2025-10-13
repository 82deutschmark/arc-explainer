/**
 * aiServiceFactory.ts
 * 
 * Factory pattern implementation to get the appropriate AI service based on model name.
 * Supports OpenAI, Anthropic (Claude), xAI Grok, Google Gemini, and DeepSeek providers.
 * This replaces dynamic imports in route handlers with a more efficient approach that
 * loads services once at startup.
 * 
 * @author Cascade
 */

class AIServiceFactory {
  private anthropicService: any;
  private openaiService: any;
  private grokService: any;
  private geminiService: any;
  private deepseekService: any;
  private openrouterService: any;
  private groverService: any;
  private saturnService: any;
  private jjoshService: any;

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

      this.anthropicService = anthropicService;
      this.openaiService = openaiService;
      this.grokService = grokService;
      this.geminiService = geminiService;
      this.deepseekService = deepseekService;
      this.openrouterService = openrouterService;
      this.groverService = groverService;
      this.saturnService = saturnService;

      // Optional external solver - only import if file exists
      try {
        const { jjoshService } = await import('./jjosh');
        this.jjoshService = jjoshService;
      } catch (error) {
        console.log('[Factory] jjosh service not available, skipping...');
        this.jjoshService = null;
      }
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
    // Log routing decision for debugging
    console.log(`[Factory] Routing model '${model}' to service:`);

    // Anthropic Claude models
    if (model.startsWith('claude-')) {
      console.log('   -> Anthropic service');
      return this.anthropicService;
    }
    
    // jjosh ARC AGI solver (external Python solver)
    if (model.startsWith('jjosh-')) {
      console.log('   -> jjosh service');
      return this.jjoshService;
    }

    // Anthropic Claude models
    
    // Grover iterative solver (uses underlying models)
    if (model.startsWith('grover-')) {
      console.log('   -> Grover service');
      return this.groverService;
    }

    // xAI Grok models
    if (model.startsWith('grok-')) {
      console.log('   -> Grok service');
      return this.grokService;
    }
    
    // Google Gemini models
    if (model.startsWith('gemini-')) {
      console.log('   -> Gemini service');
      return this.geminiService;
    }
    
    // DeepSeek models
    if (model.startsWith('deepseek-')) {
      console.log('   -> DeepSeek service');
      return this.deepseekService;
    }
    
    // OpenRouter models (detect by provider-style naming: provider/model-name)
    if (model.includes('/') || model.startsWith('meta-') || model.startsWith('anthropic/') || model.startsWith('google/') || model.startsWith('openai/') || model.startsWith('qwen/') || model.startsWith('x-ai/')) {
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
