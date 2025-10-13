/**
 * server/services/prompts/modifiers/ContinuationModifier.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-12
 * PURPOSE: Handles discussion/debate continuation prompts for conversation chaining.
 *          Builds minimal continuation prompts that leverage server-side conversation history.
 * 
 * SRP/DRY check: Pass - Single responsibility: continuation prompt generation
 * shadcn/ui: N/A (backend prompt augmentation)
 */

import { buildDiscussionContinuation, buildDebateContinuation, buildSolverContinuation } from '../components/continuationPrompts.js';

/**
 * Handles discussion/debate continuation prompts
 */
export class ContinuationModifier {
  /**
   * Build continuation prompt based on mode
   */
  buildContinuation(
    promptId: string,
    iterationNumber: number,
    customChallenge?: string
  ): string {
    switch (promptId) {
      case 'discussion':
        return buildDiscussionContinuation(iterationNumber, customChallenge);
      
      case 'debate':
        return buildDebateContinuation(iterationNumber, customChallenge);
      
      case 'solver':
      case 'explanation':
        return buildSolverContinuation(iterationNumber);
      
      default:
        // Generic fallback
        return `Continue your analysis in the same JSON format.`;
    }
  }
}
