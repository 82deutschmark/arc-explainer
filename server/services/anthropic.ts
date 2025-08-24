/**
 * Anthropic Claude service for analyzing ARC puzzles using Claude models
 * Simplified to focus on clean, direct responses without complex reasoning capture
 * 
 * Supports dynamic prompt template selection via promptId parameter.
 * Uses PROMPT_TEMPLATES from shared/types to allow different explanation approaches:
 * - alienCommunication: Frames puzzles as alien communication (includes emoji map)
 * - standardExplanation: Direct puzzle explanations without thematic framing
 * - educationalApproach: Teaching-focused explanations for learning
 * 
 * The emoji map and JSON response format adapt automatically based on template selection.
 * 
 * @author Cascade / Gemini Pro 2.5
 */

import Anthropic from "@anthropic-ai/sdk";
import { ARCTask } from "../../shared/types";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder";
import type { PromptOptions } from "./promptBuilder"; // Cascade: modular prompt options
import { calculateCost } from "../utils/costCalculator";
import { MODELS as MODEL_CONFIGS } from "../../client/src/constants/models";

// Latest Anthropic models - updated with current model names from official documentation
const MODELS = {
  "claude-sonnet-4-20250514": "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219": "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307": "claude-3-haiku-20240307",
} as const;

// Helper function to check if model supports temperature using centralized config
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? false;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompts are now handled by the modular promptBuilder architecture
// No hardcoded system prompts needed here - they come from prompts/systemPrompts.ts

export class AnthropicService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: {
      systemPromptMode?: 'ARC' | 'None';
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    // Build prompt package using new modular architecture
    const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, {
      ...options,
      systemPromptMode,
      useStructuredOutput: false // Anthropic doesn't support structured output yet
    });
    
    console.log(`[Anthropic] Using modular system prompt architecture`);
    console.log(`[Anthropic] System prompt mode: ${systemPromptMode}`);
    console.log(`[Anthropic] Template: ${promptId}${promptPackage.isSolver ? ' (solver mode)' : ''}${promptPackage.isAlienMode ? ' (alien mode)' : ''}`);
    
    // Use system and user prompts from the modular architecture
    const systemMessage = systemPromptMode === 'ARC' ? promptPackage.systemPrompt : undefined;
    const userMessage = promptPackage.userPrompt;

    try {
      // Build request options with proper Anthropic system parameter
      const requestOptions: any = {
        model: modelName,
        max_tokens: 20000, // Increased from 4000 based on models.yml capabilities
        messages: [{ role: "user", content: userMessage }],
      };
      
      // Add system prompt if in ARC mode (Anthropic supports dedicated system parameter)
      if (systemMessage) {
        requestOptions.system = systemMessage;
      }

      // Only add temperature for models that support it
      if (modelSupportsTemperature(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await anthropic.messages.create(requestOptions);
      
      // Simple response parsing
      const content = response.content[0];
      const textContent = content.type === 'text' ? content.text : '';
      
      // Simple JSON extraction - try direct parse first, then look for JSON in text
      let result;
      try {
        result = JSON.parse(textContent);
      } catch (parseError) {
        // Look for JSON anywhere in the text
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondError) {
            // If no JSON found, treat as natural language response
            result = {
              patternDescription: textContent.length > 0 ? textContent : "No response received",
              solvingStrategy: "",
              hints: [],
              confidence: 50
            };
          }
        } else {
          // If no JSON found, treat as natural language response
          result = {
            patternDescription: textContent.length > 0 ? textContent : "No response received",
            solvingStrategy: "",
            hints: [],
            confidence: 50
          };
        }
      }

      // Extract token usage from Anthropic response
      let tokenUsage: { input: number; output: number; reasoning?: number } | undefined;
      let cost: { input: number; output: number; reasoning?: number; total: number } | undefined;
      
      if (response.usage) {
        tokenUsage = {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          // For Anthropic, we don't have separate reasoning tokens, but we could estimate from reasoning content length
        };

        // Find the model config to get pricing
        const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
        if (modelConfig && tokenUsage) {
          cost = calculateCost(modelConfig.cost, tokenUsage);
        }
      }
      
      return {
        model: modelKey,
        reasoningLog: null,
        hasReasoningLog: false,
        // Include analysis parameters for database storage
        temperature,
        reasoningEffort: serviceOpts?.reasoningEffort || null,
        reasoningVerbosity: serviceOpts?.reasoningVerbosity || null,
        reasoningSummaryType: serviceOpts?.reasoningSummaryType || null,
        // Token usage and cost data
        inputTokens: tokenUsage?.input || null,
        outputTokens: tokenUsage?.output || null,
        reasoningTokens: tokenUsage?.reasoning || null,
        totalTokens: tokenUsage ? (tokenUsage.input + tokenUsage.output + (tokenUsage.reasoning || 0)) : null,
        estimatedCost: cost?.total || null,
        ...result,
      };
    } catch (error) {
      console.error(`Error with model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a preview of the exact prompt that will be sent to Anthropic
   * Shows the provider-specific message format and structure
   */
  async generatePromptPreview(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder - keep it simple
    const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, options);
    const prompt = promptPackage.userPrompt;
    const selectedTemplate = promptPackage.selectedTemplate;

    // Anthropic uses messages array format
    const messageFormat = {
      model: modelName,
      max_tokens: 20000, // Updated from 4000 based on models.yml
      messages: [{ role: "user", content: prompt }],
      temperature: temperature
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Temperature parameter supported",
      "Max tokens set to 20000"
    ];

    return {
      provider: "Anthropic",
      modelName,
      promptText: prompt,
      messageFormat,
      templateInfo: {
        id: selectedTemplate?.id || "custom",
        name: selectedTemplate?.name || "Custom Prompt",
        usesEmojis: selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: prompt.length,
        wordCount: prompt.split(/\s+/).length,
        lineCount: prompt.split('\n').length
      },
      providerSpecificNotes,
      captureReasoning,
      temperature
    };
  }
}

export const anthropicService = new AnthropicService(); 