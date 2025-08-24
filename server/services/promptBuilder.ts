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
import { getSystemPrompt, getStructuredOutputSystemPrompt, isAlienCommunicationMode, isSolverMode } from "./prompts/systemPrompts.js";
import { buildUserPromptForTemplate, UserPromptOptions } from "./prompts/userTemplates.js";
import { getSolverSchema } from "./schemas/solver.js";
import { getExplanationSchema } from "./schemas/explanation.js";

/**
 * Enhanced PromptOptions with new architecture support
 */
export interface PromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
  systemPromptMode?: 'ARC' | 'None';
  useStructuredOutput?: boolean;
}

/**
 * Complete prompt package for AI services
 */
export interface PromptPackage {
  systemPrompt: string;
  userPrompt: string;
  selectedTemplate: PromptTemplate | null;
  jsonSchema?: any;
  useStructuredOutput: boolean;
  isAlienMode: boolean;
  isSolver: boolean;
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
    useStructuredOutput = true
  } = options;

  // Determine prompt characteristics
  const isCustom = promptId === 'custom' || (customPrompt && customPrompt.trim());
  const isAlien = isAlienCommunicationMode(promptId);
  const isSolver = isSolverMode(promptId);
  const selectedTemplate = isCustom ? null : (PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation);
  
  console.log(`[PromptBuilder] Mode analysis - Custom: ${isCustom}, Alien: ${isAlien}, Solver: ${isSolver}`);

  // Build system prompt
  let systemPrompt: string;
  let jsonSchema: any = undefined;

  if (systemPromptMode === 'None') {
    // Legacy mode: minimal system prompt
    systemPrompt = "You are an expert at analyzing ARC-AGI puzzles.";
  } else {
    // New ARC mode: structured system prompt
    if (isCustom) {
      // Custom prompt mode - use basic system prompt since getCustomSystemPrompt was commented out
      systemPrompt = "You are an expert at analyzing ARC-AGI puzzles. Follow the instructions provided by the user.";
    } else if (useStructuredOutput) {
      // Get appropriate schema
      if (isSolver) {
        jsonSchema = getSolverSchema(task.test.length);
        systemPrompt = getStructuredOutputSystemPrompt(promptId, jsonSchema.name);
      } else {
        jsonSchema = getExplanationSchema(isAlien);
        systemPrompt = getStructuredOutputSystemPrompt(promptId, jsonSchema.name);
      }
    } else {
      systemPrompt = getSystemPrompt(promptId);
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
    userPrompt = buildUserPromptForTemplate(task, promptId, userPromptOptions, customPrompt);
  }

  console.log(`[PromptBuilder] Generated system prompt: ${systemPrompt.length} chars`);
  console.log(`[PromptBuilder] Generated user prompt: ${userPrompt.length} chars`);
  console.log(`[PromptBuilder] Schema attached: ${!!jsonSchema}`);

  return {
    systemPrompt,
    userPrompt,
    selectedTemplate,
    jsonSchema,
    useStructuredOutput: useStructuredOutput && !!jsonSchema,
    isAlienMode: isAlien,
    isSolver
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
 * Get structured output configuration for OpenAI
 */
export function getStructuredOutputConfig(promptPackage: PromptPackage) {
  if (!promptPackage.useStructuredOutput || !promptPackage.jsonSchema) {
    return undefined;
  }

  return {
    type: "json_schema",
    json_schema: {
      name: promptPackage.jsonSchema.name,
      strict: true,
      schema: promptPackage.jsonSchema.schema
    }
  };
}

/**
 * Extract reasoning log from structured response
 */
export function extractReasoningFromStructuredResponse(response: any): {
  reasoningLog: string;
  reasoningItems: string[];
} {
  return {
    reasoningLog: response.solvingStrategy || '',
    reasoningItems: response.keySteps || []
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