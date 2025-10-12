/**
 * server/services/promptBuilder.ts (REFACTORED)
 * 
 * New modular prompt construction service for ARC-AGI puzzle analysis.
 * Orchestrates system prompts, user prompts, and JSON schemas for structured outputs.
 * 
 * Architecture:
 * - System prompts define AI role and behavior (prompts/systemPrompts.ts)
 * - User prompts deliver clean puzzle data (prompts/userTemplates.ts)
 * - JSON schemas enforce structure (schemas/*.ts)
 * - Grid formatters handle emoji/numeric conversion (formatters/grids.ts)
 * 
 * Key Features:
 * - Separation of system vs user concerns
 * - Structured JSON output enforcement
 * - OpenAI reasoning log capture
 * - Answer-first output for solver mode
 * - Modular, maintainable architecture
 * 
 * @author Claude Code with Sonnet 4
 * @date August 22, 2025
 */

import { ARCTask, PROMPT_TEMPLATES, PromptTemplate } from "../../shared/types.js";
import { getSystemPrompt, isAlienCommunicationMode, isSolverMode } from "./prompts/systemPrompts.js";
import { buildUserPromptForTemplate, UserPromptOptions } from "./prompts/userTemplates.js";
import { determinePromptContext, shouldUseContinuationPrompt } from "./prompts/PromptContext.js";
import { buildDiscussionContinuation, buildDebateContinuation, buildSolverContinuation } from "./prompts/components/continuationPrompts.js";
import type { ServiceOptions } from "./base/BaseAIService.js";
import { logger } from "../utils/broadcastLogger.js";

/**
 * Enhanced PromptOptions with new architecture support
 */
export interface PromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
  systemPromptMode?: 'ARC' | 'None';
  useStructuredOutput?: boolean;
  temperature?: number;
  topP?: number;
  candidateCount?: number;
  thinkingBudget?: number; // Gemini thinking budget: -1 = dynamic, 0 = disabled, >0 = specific tokens
  retryMode?: boolean; // Enhanced prompting for retry analysis
  previousAnalysis?: any; // Previous failed analysis data
  originalExplanation?: any; // For debate mode: the original explanation to challenge
  customChallenge?: string; // For debate mode: human guidance on what to focus on
  badFeedback?: any[]; // Feedback entries influencing retry prompts
}

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
 * Main prompt building function - orchestrates all components
 * Now supports context-aware continuation prompts for Discussion mode
 */
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options: PromptOptions = {},
  serviceOpts: ServiceOptions = {} // NEW: Added to detect continuation state
): PromptPackage {
  logger.service('PromptBuilder', `Building prompt for template: ${promptId}`);
  
  const {
    emojiSetKey,
    omitAnswer = false,
    systemPromptMode = 'ARC',
    useStructuredOutput = true,
    retryMode = false,
    previousAnalysis,
  
    originalExplanation,
    customChallenge
  } = options;
  
  // PHASE 12: Extract test count for dynamic prompt instructions
  const testCount = task.test?.length || 1;
  const hasStructuredOutput = useStructuredOutput ?? false;
  
  logger.service('PromptBuilder', `📊 Test count: ${testCount}, Structured output: ${hasStructuredOutput}`);
  
  // PHASE 1-2: Context-aware prompt detection
  const promptContext = determinePromptContext(promptId, options, serviceOpts, task, customPrompt);
  const useContinuation = shouldUseContinuationPrompt(promptContext);
  
  logger.service('PromptBuilder', '========== CONVERSATION CONTEXT ==========');
  logger.service('PromptBuilder', `Mode: ${promptId}`);
  logger.service('PromptBuilder', `State: ${promptContext.conversationState}`);
  logger.service('PromptBuilder', `Previous Response ID: ${serviceOpts.previousResponseId || 'NONE (Initial)'}`);
  logger.service('PromptBuilder', `Continuation: ${useContinuation ? '✅ YES' : '❌ NO'}`);
  
  if (useContinuation) {
    logger.service('PromptBuilder', '🔄 CONTINUING CONVERSATION - API will retrieve server-side context & reasoning');
    logger.service('PromptBuilder', 'Purpose: Enable progressive refinement with full conversation history');
  } else {
    logger.service('PromptBuilder', '📄 INITIAL TURN - Starting new conversation thread');
  }
  logger.service('PromptBuilder', '===============================================');

  // Determine prompt characteristics
  const isCustom = promptId === 'custom' || (customPrompt && typeof customPrompt === 'string' && customPrompt.trim());
  const isAlien = isAlienCommunicationMode(promptId);
  const isSolver = isSolverMode(promptId);
  const selectedTemplate = isCustom ? null : (PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation);
  
  // CRITICAL DATA LEAKAGE CHECK
  const includeAnswers = !omitAnswer;
  logger.service('PromptBuilder', `🔒 DATA LEAKAGE CHECK:`);
  logger.service('PromptBuilder', `   - Solver Mode: ${isSolver} (${isSolver ? 'NO answers sent' : 'answers MAY be sent'})`);
  logger.service('PromptBuilder', `   - includeAnswers: ${includeAnswers} (${includeAnswers ? '⚠️ TEST OUTPUTS WILL BE SENT' : '✅ Test outputs withheld'})`);
  logger.service('PromptBuilder', `   - Mode: ${promptId}${isCustom ? ' (Custom)' : ''}`);

  // PHASE 1-2: Use continuation prompt if this is a continuation turn
  if (useContinuation) {
    let continuationPrompt: string;
    let iterationCount = 1; // Default iteration
    
    // Try to infer iteration count from context (could be enhanced in Phase 3)
    // For now, just use a simple continuation prompt
    
    switch (promptId) {
      case 'discussion':
        continuationPrompt = buildDiscussionContinuation(iterationCount, customChallenge);
        break;
      
      case 'debate':
        continuationPrompt = buildDebateContinuation(iterationCount, customChallenge);
        break;
      
      case 'solver':
      case 'explanation':
        continuationPrompt = buildSolverContinuation(iterationCount);
        break;
      
      default:
        // Generic fallback
        continuationPrompt = `Continue your analysis in the same JSON format.`;
    }
    
    // Build user prompt (same as usual - still need puzzle data)
    const userPromptOptions: UserPromptOptions = {
      emojiSetKey,
      omitAnswer
    };
    
    const userPrompt = buildUserPromptForTemplate(
      task,
      promptId,
      userPromptOptions,
      originalExplanation,
      customChallenge
    );
    
    // Return continuation package (much shorter system prompt!)
    return {
      systemPrompt: continuationPrompt,
      userPrompt,
      selectedTemplate,
      isAlienMode: isAlien,
      isSolver,
      templateName: selectedTemplate?.name
    };
  }

  // Build system prompt (FULL VERSION - only for initial turns now)
  let systemPrompt: string;

  if (systemPromptMode === 'None') {
    // Legacy mode: minimal system prompt
    systemPrompt = "Provide your prediction for the correct Test Output grid or grids in the same format seen in the examples. Then, explain the simple transformation rules you discovered in the examples that led to your prediction. ";
  } else {
    // New ARC mode: structured system prompt
    if (isCustom && customPrompt && customPrompt.trim()) {
      // Custom prompt mode - use user's custom text directly as system prompt (NO additional text)
      logger.service('PromptBuilder', `Using custom text as system prompt: ${customPrompt.trim().substring(0, 100)}...`);
      systemPrompt = customPrompt.trim();
    } else if (isCustom) {
      // Custom prompt mode without text - use NO system prompt (minimal)
      logger.service('PromptBuilder', 'No custom text provided, using minimal system prompt');
      systemPrompt = "Provide your prediction for the correct Test Output grid or grids in the same format seen in the examples. Then, explain the simple transformation rules at place in the examples that led to your prediction. ";
    } else {
      // Phase 12: Pass testCount and hasStructuredOutput for dynamic instructions
      systemPrompt = getSystemPrompt(promptId, testCount, hasStructuredOutput);
      
      // Add retry enhancement to system prompt
      if (retryMode) {
        systemPrompt += "\n\nIMPORTANT: A previous analysis of this puzzle was incorrect. Please provide a fresh, more careful analysis with renewed attention to detail.";
        
        // Include previous analysis context if available
        if (previousAnalysis) {
          systemPrompt += `\n\nPREVIOUS FAILED ANALYSIS (Full DB Record):`;
          systemPrompt += `\nModel: ${previousAnalysis.modelName || 'Unknown'}`;
          systemPrompt += `\nDatabase ID: ${previousAnalysis.id}`;
          systemPrompt += `\nCreated: ${previousAnalysis.createdAt || 'Unknown'}`;
          
          if (previousAnalysis.patternDescription) {
            systemPrompt += `\nPattern Description: "${previousAnalysis.patternDescription}"`;
          }
          if (previousAnalysis.solvingStrategy) {
            systemPrompt += `\nSolving Strategy: "${previousAnalysis.solvingStrategy}"`;
          }
          if (previousAnalysis.hints && previousAnalysis.hints.length > 0) {
            systemPrompt += `\nHints: ${previousAnalysis.hints.map((h: string) => `"${h}"`).join(', ')}`;
          }
          if (previousAnalysis.isPredictionCorrect === false) {
            systemPrompt += `\nPrediction Result: INCORRECT`;
          }
          if (previousAnalysis.trustworthinessScore !== undefined) {
            systemPrompt += `\nTrustworthiness Score: ${Math.round(previousAnalysis.trustworthinessScore * 100)}%`;
          }
          if (previousAnalysis.confidence) {
            systemPrompt += `\nModel Confidence: ${previousAnalysis.confidence}%`;
          }
          if (previousAnalysis.apiProcessingTimeMs) {
            systemPrompt += `\nProcessing Time: ${previousAnalysis.apiProcessingTimeMs}ms`;
          }
          if (previousAnalysis.totalTokens) {
            systemPrompt += `\nTokens Used: ${previousAnalysis.totalTokens}`;
          }
          if (previousAnalysis.estimatedCost) {
            systemPrompt += `\nCost: $${previousAnalysis.estimatedCost}`;
          }
          if (previousAnalysis.reasoningLog) {
            systemPrompt += `\nHad Reasoning Log: Yes (${previousAnalysis.reasoningLog.length} chars)`;
          }
        }
      }
    }
  }

  // Build user prompt
  const userPromptOptions: UserPromptOptions = {
    emojiSetKey,
    omitAnswer,
    useEmojis: !!emojiSetKey,
    isSolverMode: isSolver,
    isMultiTest: task.test.length > 1
  };

  let userPrompt: string;
  
  if (systemPromptMode === 'None') {
    // Legacy mode: all instructions in user prompt (old behavior)  NEEDS TO BE DEPRECATED!
    const legacyResult = buildLegacyPrompt(task, promptId, customPrompt, options);
    userPrompt = legacyResult.prompt;
  } else {
    // New ARC mode: clean user prompt with just data
    // If custom prompt is being used as system prompt, don't include it in user prompt
    const customPromptForUser = (isCustom && customPrompt && customPrompt.trim()) ? undefined : customPrompt;
    userPrompt = buildUserPromptForTemplate(task, promptId, userPromptOptions, customPromptForUser, originalExplanation, customChallenge);
  }

  logger.service('PromptBuilder', `Generated system prompt: ${systemPrompt.length} chars`);
  logger.service('PromptBuilder', `Generated user prompt: ${userPrompt.length} chars`);

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
 * Legacy prompt building for backwards compatibility
 * Uses the old monolithic approach when systemPromptMode === 'None'
 */
function buildLegacyPrompt(
  task: ARCTask,
  promptId: string,
  customPrompt?: string,
  options: PromptOptions = {}
): { prompt: string; selectedTemplate: PromptTemplate | null } {
  logger.service('PromptBuilder', 'Using legacy prompt mode');
  
  // This would use the old promptBuilder logic
  // For now, return a simplified version
  const selectedTemplate = PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation;
  
  // Simple legacy prompt construction
  const userPromptOptions: UserPromptOptions = {
    emojiSetKey: options.emojiSetKey,
    omitAnswer: options.omitAnswer,
    useEmojis: !!options.emojiSetKey,
    isSolverMode: isSolverMode(promptId),
    isMultiTest: task.test.length > 1
  };

  const userPrompt = buildUserPromptForTemplate(task, promptId, userPromptOptions, customPrompt);
  const instructions = selectedTemplate ? selectedTemplate.content : '';
  
  const prompt = customPrompt && customPrompt.trim() ? 
    userPrompt : // Custom prompt already includes instructions
    `${instructions}\n\n${userPrompt}`;

  return {
    prompt,
    selectedTemplate
  };
}



/**
 * Backwards compatibility function - returns old format
 * PHASE 1-2: Pass empty serviceOpts to maintain compatibility
 */
export function buildAnalysisPromptLegacy(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options: PromptOptions = {}
): { prompt: string; selectedTemplate: PromptTemplate | null } {
  const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, { 
    ...options, 
    systemPromptMode: 'None' 
  }, {} as ServiceOptions); // Pass empty serviceOpts for legacy mode
  
  return {
    prompt: promptPackage.userPrompt,
    selectedTemplate: promptPackage.selectedTemplate
  };
}

/**
 * Utility functions for backwards compatibility
 */
export function getDefaultPromptId(): string {
  return "solver";
}

export function promptUsesEmojis(promptId: string, customPrompt?: string): boolean {
  if (customPrompt) return false;
  return isAlienCommunicationMode(promptId);
}

/**
 * Check if system prompts are enabled
 */
export function shouldUseSystemPrompts(options: PromptOptions = {}): boolean {
  return options.systemPromptMode !== 'None';
}

/**
 * Get prompt mode for logging/debugging
 */
export function getPromptMode(options: PromptOptions = {}): string {
  return options.systemPromptMode === 'None' ? 'Legacy' : 'ARC';
}
