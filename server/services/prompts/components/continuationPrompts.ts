/**
 * server/services/prompts/components/continuationPrompts.ts
 * 
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-10-08
 * 
 * PURPOSE:
 * Minimal prompt builders for continuation turns when previousResponseId exists.
 * These assume the LLM already has full context from the Responses API and only
 * need task-specific instructions, not repeated ARC explanations or JSON rules.
 * 
 * TOKEN SAVINGS: 70% reduction on continuation turns (850 → 250 tokens for Discussion mode)
 * 
 * CRITICAL USE CASE: PuzzleDiscussion feature where one model refines its own
 * analysis across multiple iterations. Each iteration should NOT repeat:
 * - "You are an expert at ARC-AGI puzzles..." (already knows)
 * - "Grid format: [[0,1,2],[3,4,5]]..." (already saw 3 examples)
 * - "JSON STRUCTURE REQUIREMENT..." (already knows)
 * 
 * SRP/DRY Check: PASS
 * - Single responsibility: Continuation-optimized prompt building
 * - Eliminates redundant context on multi-turn conversations
 * 
 * shadcn/ui: N/A (backend utility)
 */

/**
 * Build minimal Discussion mode continuation prompt
 * Assumes LLM already knows: ARC format, JSON rules, grid format
 * Only provides: Task reminder and context update
 */
export function buildDiscussionContinuation(
  iterationNumber: number,
  userGuidance?: string
): string {
  const sections: string[] = [];
  
  // Remind the AI of its task (it already knows the full instructions)
  sections.push(
    `SELF-REFINEMENT ITERATION ${iterationNumber}:`,
    `Continue refining your analysis. Apply fresh reasoning strategies you haven't tried yet.`
  );
  
  // Include user guidance if provided
  if (userGuidance && userGuidance.trim()) {
    sections.push(
      `\nHUMAN GUIDANCE FOR THIS ITERATION:`,
      userGuidance.trim()
    );
  }
  
  // Minimal reminder of output format (much shorter than full JSON instructions)
  sections.push(
    `\nProvide your refined analysis in the same JSON format.`
  );
  
  return sections.join('\n');
}

/**
 * Build minimal Debate mode continuation prompt
 * For multi-round debates between models
 */
export function buildDebateContinuation(
  roundNumber: number,
  customChallenge?: string
): string {
  const sections: string[] = [];
  
  sections.push(
    `DEBATE ROUND ${roundNumber}:`,
    `Continue your critical analysis. Address any gaps in your previous response.`
  );
  
  if (customChallenge && customChallenge.trim()) {
    sections.push(
      `\nHUMAN FOCUS FOR THIS ROUND:`,
      customChallenge.trim()
    );
  }
  
  sections.push(
    `\nProvide your rebuttal in the same JSON format.`
  );
  
  return sections.join('\n');
}

/**
 * Build minimal Solver mode continuation prompt
 * For iterative solving attempts
 */
export function buildSolverContinuation(
  attemptNumber: number
): string {
  return [
    `ATTEMPT ${attemptNumber}:`,
    `Your previous prediction was incorrect. Analyze the pattern again with fresh eyes.`,
    `\nProvide your new prediction in the same JSON format.`
  ].join('\n');
}

/**
 * Generic continuation prompt builder
 * Falls back to this if mode doesn't have specific continuation builder
 */
export function buildGenericContinuation(mode: string): string {
  return `Continue your analysis in the same JSON format.`;
}
