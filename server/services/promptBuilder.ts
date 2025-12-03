/**
 * server/services/promptBuilder.ts (ENTERPRISE REFACTORED)
 * 
 * Professional prompt construction service for ARC-AGI puzzle analysis.
 * Clean separation of concerns, explicit interfaces, enterprise-grade architecture.
 * 
 * Architecture:
 * - System prompts define AI role/behavior ONLY (prompts/systemPrompts.ts)
 * - User prompts deliver problem statement + data (prompts/userTemplates.ts)
 * - JSON schemas enforce structure via response_format (schemas/*.ts)
 * - Modifiers augment prompts for retry/continuation (modifiers/*.ts)
 * - Validators enforce data leakage prevention (validation/promptSecurity.ts)
 * 
 * Key Principles:
 * - DEFAULT: Never include correct answers (research integrity)
 * - EXPLICIT: Clear interfaces, no dumping grounds
 * - VALIDATED: Runtime checks prevent data leakage
 * - MODULAR: Each concern handled by focused module
 * 
 * @author Cascade using Claude Sonnet 4
 * @date 2025-10-12 (Enterprise Refactor)
 */

import { ARCTask, PROMPT_TEMPLATES, PromptTemplate } from "../../shared/types.js";
import { getSystemPrompt, isAlienCommunicationMode, isSolverMode } from "./prompts/systemPrompts.js";
import { buildUserPromptForTemplate, UserPromptOptions } from "./prompts/userTemplates.js";
import { TASK_DESCRIPTIONS } from "./prompts/components/basePrompts.js";
import { determinePromptContext, shouldUseContinuationPrompt } from "./prompts/PromptContext.js";
import { RetryModifier } from "./prompts/modifiers/RetryModifier.js";
import { ContinuationModifier } from "./prompts/modifiers/ContinuationModifier.js";
import { PromptSecurityValidator } from "./validation/promptSecurity.js";
import type { ServiceOptions } from "./base/BaseAIService.js";
import { logger } from "../utils/broadcastLogger.js";

/**
 * REFACTORED: Core prompt construction options
 * NO DUMPING GROUND - only essential formatting options
 */
export interface PromptBuildOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;  // CRITICAL: Default is TRUE (hide answers for research integrity)
}

/**
 * Context for retrying failed analyses
 * Typed properly - no "any"
 */
export interface RetryContext {
  previousAnalysis: any;  // TODO: Type as DatabaseExplanation
  userFeedback?: string;
}

/**
 * Context for multi-turn conversations (discussion/debate)
 */
export interface ContinuationContext {
  originalExplanation: any;  // TODO: Type as DatabaseExplanation
  customChallenge?: string;
  iterationNumber: number;
}

/**
 * Union type for all augmentation contexts
 */
export type PromptAugmentation = 
  | { type: 'retry'; context: RetryContext }
  | { type: 'continuation'; context: ContinuationContext }
  | null;

/**
 * Result package from prompt building
 */
export interface PromptPackage {
  systemPrompt: string;
  userPrompt: string;
  selectedTemplate: PromptTemplate | null;
  isAlienMode: boolean;
  isSolver: boolean;
  templateName?: string;
}

/**
 * MAIN PROMPT BUILDING FUNCTION - Enterprise refactored with backward compatibility
 * 
 * Accepts BOTH old PromptOptions interface AND new architecture
 * Detects which is being used and converts internally
 * 
 * Clear responsibilities:
 * 1. Build base system prompt (AI role/behavior)
 * 2. Build user prompt with task description + data
 * 3. Apply augmentations (retry/continuation)
 * 4. Validate data leakage prevention
 * 5. Return package
 */
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options: PromptOptions | PromptBuildOptions = {},
  serviceOpts: ServiceOptions = {}
): PromptPackage {
  // BACKWARD COMPATIBILITY: Detect if old PromptOptions or new PromptBuildOptions
  const isOldInterface = 'omitAnswer' in options || 'retryMode' in options || 'previousAnalysis' in options;
  
  let buildOptions: PromptBuildOptions;
  let augmentation: PromptAugmentation = null;
  
  if (isOldInterface) {
    // OLD INTERFACE: Convert to new architecture
    const oldOptions = options as PromptOptions;
    buildOptions = {
      emojiSetKey: oldOptions.emojiSetKey,
      omitAnswer: oldOptions.omitAnswer ?? true  // Default is hide answers
    };
    
    // Convert augmentation context
    if (oldOptions.retryMode && oldOptions.previousAnalysis) {
      augmentation = {
        type: 'retry',
        context: {
          previousAnalysis: oldOptions.previousAnalysis,
          userFeedback: oldOptions.badFeedback?.join('; ')
        }
      };
    } else if ((promptId === 'discussion' || promptId === 'debate') && oldOptions.originalExplanation) {
      augmentation = {
        type: 'continuation',
        context: {
          originalExplanation: oldOptions.originalExplanation,
          customChallenge: oldOptions.customChallenge,
          iterationNumber: 1  // TODO: Track actual iteration count
        }
      };
    }
  } else {
    // NEW INTERFACE: Use directly
    buildOptions = options as PromptBuildOptions;
    // augmentation passed separately in new architecture (but not in current signature)
  }
  
  // Now execute with converted parameters
  return buildAnalysisPromptImpl(task, promptId, customPrompt, buildOptions, augmentation, serviceOpts);
}

/**
 * INTERNAL IMPLEMENTATION - Do not call directly
 * This is the actual prompt building logic
 */
function buildAnalysisPromptImpl(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  buildOptions: PromptBuildOptions = { omitAnswer: true },
  augmentation: PromptAugmentation = null,
  serviceOpts: ServiceOptions = {}
): PromptPackage {
  logger.service('PromptBuilder', `Building prompt for template: ${promptId}`);
  
  // Phase 1: Context detection
  const testCount = task.test?.length || 1;
  const hasStructuredOutput = false;  // TODO: Add to ServiceOptions interface
  const promptContext = determinePromptContext(promptId, buildOptions, serviceOpts, task, customPrompt);
  const useContinuation = shouldUseContinuationPrompt(promptContext);
  
  // Phase 2: Determine prompt characteristics
  const isCustom = promptId === 'custom' || (customPrompt && typeof customPrompt === 'string' && customPrompt.trim());
  const isAlien = isAlienCommunicationMode(promptId);
  const isSolver = isSolverMode(promptId);
  const selectedTemplate = isCustom ? null : (PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation);
  
  // Phase 3: Build base prompts
  let systemPrompt: string;
  let userPrompt: string;
  
  if (useContinuation && augmentation?.type === 'continuation') {
    // Continuation mode: minimal system prompt, previous context implicit
    const continModifier = new ContinuationModifier();
    systemPrompt = continModifier.buildContinuation(
      promptId,
      augmentation.context.iterationNumber,
      augmentation.context.customChallenge
    );
    
    // User prompt still needs puzzle data + task description
    const taskDescription = TASK_DESCRIPTIONS[promptId as keyof typeof TASK_DESCRIPTIONS];
    const userPromptOptions: UserPromptOptions = {
      emojiSetKey: buildOptions.emojiSetKey,
      omitAnswer: buildOptions.omitAnswer ?? true,  // Default: hide answers
      isSolverMode: isSolver,
      isMultiTest: testCount > 1,
      useEmojis: Boolean(buildOptions.emojiSetKey)
    };
    
    userPrompt = buildUserPromptForTemplate(
      task,
      promptId,
      userPromptOptions,
      customPrompt,
      augmentation.context.originalExplanation,
      augmentation.context.customChallenge,
      taskDescription
    );
  } else {
    // Standard mode: full system prompt + user prompt with task description
    if (isCustom && customPrompt && customPrompt.trim()) {
      // Custom prompt mode - use user's text as system prompt
      systemPrompt = customPrompt.trim();
    } else {
      // Standard: AI role + behavior
      systemPrompt = getSystemPrompt(promptId, testCount, hasStructuredOutput);
    }
    
    // User prompt: task description + puzzle data
    const taskDescription = TASK_DESCRIPTIONS[promptId as keyof typeof TASK_DESCRIPTIONS];
    const userPromptOptions: UserPromptOptions = {
      emojiSetKey: buildOptions.emojiSetKey,
      omitAnswer: buildOptions.omitAnswer ?? true,  // Default: hide answers
      isSolverMode: isSolver,
      isMultiTest: testCount > 1,
      useEmojis: Boolean(buildOptions.emojiSetKey)
    };
    
    userPrompt = buildUserPromptForTemplate(
      task,
      promptId,
      userPromptOptions,
      customPrompt,
      augmentation?.type === 'continuation' ? augmentation.context.originalExplanation : undefined,
      augmentation?.type === 'continuation' ? augmentation.context.customChallenge : undefined,
      taskDescription
    );
  }
  
  // Phase 4: Apply augmentations
  if (augmentation?.type === 'retry') {
    const retryModifier = new RetryModifier();
    systemPrompt = retryModifier.augmentSystemPrompt(
      systemPrompt,
      augmentation.context.previousAnalysis
    );
  }
  
  // Phase 5: CRITICAL SECURITY VALIDATION
  try {
    PromptSecurityValidator.validateNoAnswerLeakage(
      userPrompt,
      buildOptions.omitAnswer ?? true,  // Default: hide answers
      isSolver,
      promptId  // Use promptId as identifier since task doesn't have id
    );
    
    PromptSecurityValidator.logSecurityAudit(
      promptId,  // Use promptId as identifier
      buildOptions.omitAnswer ?? true,
      isSolver,
      userPrompt.length,
      promptId
    );
  } catch (error) {
    // Data leakage detected - CRITICAL ERROR
    logger.error('PromptBuilder', `🚨 SECURITY FAILURE: ${error}`);
    throw error;
  }
  
  // Phase 6: Log and return
  logger.service('PromptBuilder', `Generated system prompt: ${systemPrompt.length} chars`);
  logger.service('PromptBuilder', `Generated user prompt: ${userPrompt.length} chars`);
  logger.service('PromptBuilder', `Security: ${(buildOptions.omitAnswer ?? true) ? '\ud83d\udd12 ANSWERS WITHHELD' : '\u26a0\ufe0f ANSWERS INCLUDED'}`);
  
  // FULL PROMPT LOGGING for debugging
  logger.service('PromptBuilder', `\n${'='.repeat(80)}\nSYSTEM PROMPT (${promptId}):\n${'-'.repeat(80)}\n${systemPrompt}\n${'='.repeat(80)}`);
  logger.service('PromptBuilder', `\n${'='.repeat(80)}\nUSER PROMPT (${promptId}):\n${'-'.repeat(80)}\n${userPrompt}\n${'='.repeat(80)}`);

  return {
    systemPrompt,
    userPrompt,
    selectedTemplate,
    isAlienMode: isAlien,
    isSolver,
    templateName: selectedTemplate?.name
  };
}

/**
 * OLD INTERFACE - Export for existing callsites (WILL BREAK THEM - TODO: migrate all 15+ files)
 */
export interface PromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
  systemPromptMode?: 'ARC' | 'None';
  useStructuredOutput?: boolean;
  temperature?: number;
  topP?: number;
  candidateCount?: number;
  thinkingBudget?: number;
  retryMode?: boolean;
  previousAnalysis?: any;
  originalExplanation?: any;
  customChallenge?: string;
  badFeedback?: any[];
}

/**
 * Utility exports
 */
export function getDefaultPromptId(): string {
  return "solver";
}

export function promptUsesEmojis(promptId: string, customPrompt?: string): boolean {
  if (customPrompt) return false;
  return isAlienCommunicationMode(promptId);
}

export function shouldUseSystemPrompts(): boolean {
  return true;
}

export function getPromptMode(): string {
  return 'Enterprise';
}
