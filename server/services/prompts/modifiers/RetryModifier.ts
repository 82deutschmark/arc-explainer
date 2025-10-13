/**
 * server/services/prompts/modifiers/RetryModifier.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-12
 * PURPOSE: Augments prompts with retry context when a previous analysis failed.
 *          Provides structured feedback from failed attempts to help AI improve.
 * 
 * SRP/DRY check: Pass - Single responsibility: retry context augmentation
 * shadcn/ui: N/A (backend prompt augmentation)
 */

/**
 * Augments prompts with retry context
 * Provides structured information about previous failed attempts
 */
export class RetryModifier {
  /**
   * Augment system prompt with retry context
   */
  augmentSystemPrompt(
    basePrompt: string,
    previousAnalysis: any
  ): string {
    const retrySection = this.buildRetrySection(previousAnalysis);
    return `${basePrompt}\n\n${retrySection}`;
  }
  
  /**
   * Build retry context section
   */
  private buildRetrySection(previous: any): string {
    const parts = [
      "IMPORTANT: A previous analysis of this puzzle was incorrect.",
      "Please provide a fresh, more careful analysis with renewed attention to detail.",
      "",
      "PREVIOUS FAILED ANALYSIS:"
    ];
    
    if (previous.modelName) {
      parts.push(`Model: ${previous.modelName}`);
    }
    
    if (previous.patternDescription) {
      parts.push(`Pattern Description: "${previous.patternDescription}"`);
    }
    
    if (previous.solvingStrategy) {
      parts.push(`Solving Strategy: "${previous.solvingStrategy}"`);
    }
    
    if (previous.hints && previous.hints.length > 0) {
      parts.push(`Hints: ${previous.hints.map((h: string) => `"${h}"`).join(', ')}`);
    }
    
    if (previous.isPredictionCorrect === false) {
      parts.push(`Prediction Result: INCORRECT`);
    }
    
    if (previous.trustworthinessScore !== undefined) {
      parts.push(`Trustworthiness Score: ${Math.round(previous.trustworthinessScore * 100)}%`);
    }
    
    if (previous.confidence) {
      parts.push(`Model Confidence: ${previous.confidence}%`);
    }
    
    return parts.join('\n');
  }
}
