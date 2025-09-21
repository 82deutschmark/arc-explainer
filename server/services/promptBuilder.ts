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
  badFeedback?: any[]; // Bad feedback entries for context
}

/**
 * Complete prompt package for AI services
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
 */
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options: PromptOptions = {}
): PromptPackage {
  console.log(`[PromptBuilder] Building prompt for template: ${promptId}`);
  
  const {
    emojiSetKey,
    omitAnswer = false,
    systemPromptMode = 'ARC',
    useStructuredOutput = true,
    retryMode = false,
    previousAnalysis,
    badFeedback
  } = options;

  // Determine prompt characteristics
  const isCustom = promptId === 'custom' || (customPrompt && typeof customPrompt === 'string' && customPrompt.trim());
  const isAlien = isAlienCommunicationMode(promptId);
  const isSolver = isSolverMode(promptId);
  const selectedTemplate = isCustom ? null : (PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation);
  
  console.log(`[PromptBuilder] Mode analysis - Custom: ${isCustom}, Alien: ${isAlien}, Solver: ${isSolver}`);

  // Build system prompt
  let systemPrompt: string;

  if (systemPromptMode === 'None') {
    // Legacy mode: minimal system prompt
    systemPrompt = "Provide your prediction for the Test Output grid or grids in the same format seen in the examples. Then, explain the simple transformation rules you discovered in the examples that led to your prediction. ";
  } else {
    // New ARC mode: structured system prompt
    if (isCustom && customPrompt && customPrompt.trim()) {
      // Custom prompt mode - use user's custom text directly as system prompt (NO additional text)
      console.log(`[PromptBuilder] Using custom text as system prompt: ${customPrompt.trim().substring(0, 100)}...`);
      systemPrompt = customPrompt.trim();
    } else if (isCustom) {
      // Custom prompt mode without text - use NO system prompt (minimal)
      console.log(`[PromptBuilder] No custom text provided, using minimal system prompt`);
      systemPrompt = "Explain the simple transformation rules at place in the examples. Provide your prediction for the Test Output grid or grids in the same format seen in the examples.";
    } else {
      systemPrompt = getSystemPrompt(promptId);
      
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
          if (previousAnalysis.predictionAccuracyScore !== undefined) {
            systemPrompt += `\nTrustworthiness Score: ${Math.round(previousAnalysis.predictionAccuracyScore * 100)}%`;
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
        
        // Include bad feedback if available
        if (badFeedback && badFeedback.length > 0) {
          systemPrompt += `\n\nUSER FEEDBACK ON PREVIOUS ANALYSIS (Full DB Records):`;
          badFeedback.forEach((feedback, index) => {
            systemPrompt += `\nFeedback ${index + 1} (DB ID: ${feedback.id}):`;
            systemPrompt += `\n  Vote: ${feedback.voteType}`;
            systemPrompt += `\n  Comment: "${feedback.comment}"`;
            systemPrompt += `\n  Created: ${feedback.createdAt || 'Unknown'}`;
            if (feedback.explanationId) {
              systemPrompt += `\n  Related to Explanation ID: ${feedback.explanationId}`;
            }
            if (feedback.modelName) {
              systemPrompt += `\n  Model: ${feedback.modelName}`;
            }
            if (feedback.confidence) {
              systemPrompt += `\n  Model Confidence: ${feedback.confidence}%`;
            }
            systemPrompt += `\n`;
          });
          systemPrompt += `\nPlease address these specific criticisms in your new analysis.`;
        }
      }
    }
  }

  // Build user prompt
  const userPromptOptions: UserPromptOptions = {
    emojiSetKey,
    omitAnswer,
    useEmojis: isAlien,
    isSolverMode: isSolver,
    isMultiTest: task.test.length > 1
  };

  let userPrompt: string;
  
  if (systemPromptMode === 'None') {
    // Legacy mode: all instructions in user prompt (old behavior)
    const legacyResult = buildLegacyPrompt(task, promptId, customPrompt, options);
    userPrompt = legacyResult.prompt;
  } else {
    // New ARC mode: clean user prompt with just data
    // If custom prompt is being used as system prompt, don't include it in user prompt
    const customPromptForUser = (isCustom && customPrompt && customPrompt.trim()) ? undefined : customPrompt;
    userPrompt = buildUserPromptForTemplate(task, promptId, userPromptOptions, customPromptForUser);
  }

  console.log(`[PromptBuilder] Generated system prompt: ${systemPrompt.length} chars`);
  console.log(`[PromptBuilder] Generated user prompt: ${userPrompt.length} chars`);

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
  console.log(`[PromptBuilder] Using legacy prompt mode`);
  
  // This would use the old promptBuilder logic
  // For now, return a simplified version
  const selectedTemplate = PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation;
  
  // Simple legacy prompt construction
  const userPromptOptions: UserPromptOptions = {
    emojiSetKey: options.emojiSetKey,
    omitAnswer: options.omitAnswer,
    useEmojis: selectedTemplate?.emojiMapIncluded || false,
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
  });
  
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