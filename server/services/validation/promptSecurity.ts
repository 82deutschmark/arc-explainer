/**
 * server/services/validation/promptSecurity.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-12
 * PURPOSE: Security validation to prevent data leakage in prompts sent to AI models.
 *          Enforces that correct answers are never accidentally included when they should be hidden.
 *          This is CRITICAL for research integrity - contaminated data invalidates all accuracy metrics.
 * 
 * SRP/DRY check: Pass - Single responsibility: prompt security validation
 * shadcn/ui: N/A (backend security validation)
 */

import { logger } from '../../utils/broadcastLogger.js';

/**
 * CRITICAL ERROR: Data leakage detected in prompt
 * This means correct answers were found in a prompt where they should be hidden
 */
export class DataLeakageError extends Error {
  constructor(
    message: string,
    public readonly context: {
      omitAnswer: boolean;
      isSolverMode: boolean;
      leakagePattern: string;
      promptLength: number;
    }
  ) {
    super(message);
    this.name = 'DataLeakageError';
  }
}

/**
 * Patterns that indicate correct answers are present in prompt
 */
const ANSWER_LEAKAGE_PATTERNS = [
  /Correct Answer:/i,
  /Test \d+ Output:/i,
  /Expected Output:/i,
  /The correct output is:/i,
  /Solution:/i
] as const;

/**
 * Security validator to prevent data leakage in prompts
 */
export class PromptSecurityValidator {
  /**
   * CRITICAL: Verify prompt does not contain correct answers when it shouldn't
   * 
   * @throws DataLeakageError if answers detected when they should be hidden
   */
  static validateNoAnswerLeakage(
    userPrompt: string,
    omitAnswer: boolean,
    isSolverMode: boolean,
    puzzleId?: string
  ): void {
    // SECURITY CHECK: If we should be hiding answers, verify they're not present
    const shouldHideAnswers = omitAnswer || isSolverMode;
    
    if (!shouldHideAnswers) {
      // Answers are intentionally included - no validation needed
      logger.info(`SECURITY: Answers intentionally included for puzzle ${puzzleId || 'unknown'}`, 'PromptSecurity');
      return;
    }
    
    // Search for leakage patterns
    for (const pattern of ANSWER_LEAKAGE_PATTERNS) {
      if (pattern.test(userPrompt)) {
        const error = new DataLeakageError(
          `SECURITY VIOLATION: Correct answer found in prompt when omitAnswer=${omitAnswer}, isSolverMode=${isSolverMode}`,
          {
            omitAnswer,
            isSolverMode,
            leakagePattern: pattern.toString(),
            promptLength: userPrompt.length
          }
        );
        
        logger.error('PromptSecurity', `🚨 DATA LEAKAGE DETECTED: ${error.message}`);
        logger.error('PromptSecurity', `Pattern: ${pattern.toString()}`);
        logger.error('PromptSecurity', `Puzzle: ${puzzleId || 'unknown'}`);
        
        throw error;
      }
    }
    
    // PASSED: No leakage detected
    logger.info(`SECURITY: ✅ No data leakage detected for puzzle ${puzzleId || 'unknown'}`, 'PromptSecurity');
  }
  
  /**
   * Log comprehensive security audit trail
   * This creates a permanent record of whether answers were hidden
   */
  static logSecurityAudit(
    puzzleId: string,
    omitAnswer: boolean,
    isSolverMode: boolean,
    promptLength: number,
    mode: string
  ): void {
    const shouldHideAnswers = omitAnswer || isSolverMode;
    
    logger.info(`SECURITY_AUDIT: ${puzzleId} | Mode: ${mode} | HideAnswers: ${shouldHideAnswers} | Status: ${shouldHideAnswers ? '🔒 SECURED' : '⚠️ ANSWERS_INCLUDED'}`, 'PROMPT_SECURITY');
  }
  
  /**
   * Validate that omitAnswer flag matches actual prompt content
   * Double-check that implementation matches intent
   */
  static validateConsistency(
    userPrompt: string,
    omitAnswer: boolean
  ): void {
    const hasAnswerPatterns = ANSWER_LEAKAGE_PATTERNS.some(pattern => pattern.test(userPrompt));
    
    if (!omitAnswer && !hasAnswerPatterns) {
      logger.warn('PromptSecurity', '⚠️ omitAnswer=false (should show answers) but no answer patterns found in prompt');
    }
    
    if (omitAnswer && hasAnswerPatterns) {
      throw new DataLeakageError(
        'CONSISTENCY VIOLATION: omitAnswer=true (should hide answers) but answer patterns found in prompt',
        {
          omitAnswer,
          isSolverMode: false,
          leakagePattern: 'Consistency check failed',
          promptLength: userPrompt.length
        }
      );
    }
  }
}

/**
 * Simple helper for common case: validate solver mode prompt
 */
export function validateSolverPrompt(userPrompt: string, puzzleId?: string): void {
  PromptSecurityValidator.validateNoAnswerLeakage(
    userPrompt,
    true,  // omitAnswer=true for solver
    true,  // isSolverMode=true
    puzzleId
  );
}

/**
 * Simple helper: validate research mode prompt (no answers unless explicitly requested)
 */
export function validateResearchPrompt(
  userPrompt: string,
  omitAnswer: boolean,
  puzzleId?: string
): void {
  PromptSecurityValidator.validateNoAnswerLeakage(
    userPrompt,
    omitAnswer,
    false,  // Not solver mode
    puzzleId
  );
}
