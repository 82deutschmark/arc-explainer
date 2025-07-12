/**
 * aiServiceFactory.ts
 * 
 * Factory pattern implementation to get the appropriate AI service based on model name.
 * This replaces dynamic imports in route handlers with a more efficient approach that
 * loads services once at startup.
 * 
 * @author Cascade
 */

class AIServiceFactory {
  private anthropicService: any;
  private openaiService: any;

  /**
   * Initialize the factory by loading all AI services once at startup
   */
  async initialize() {
    // Import services once at startup
    const { anthropicService } = await import('./anthropic');
    const { openaiService } = await import('./openai');
    
    this.anthropicService = anthropicService;
    this.openaiService = openaiService;
  }

  /**
   * Get the appropriate AI service based on model name
   * 
   * @param model - The model name to determine which service to use
   * @returns The appropriate AI service
   */
  getService(model: string) {
    if (model.startsWith('claude-')) {
      return this.anthropicService;
    }
    return this.openaiService;
  }
}

// Export a singleton instance
export const aiServiceFactory = new AIServiceFactory();
