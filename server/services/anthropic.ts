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

// Latest Anthropic models - updated with current model names from official documentation
const MODELS = {
  "claude-sonnet-4-20250514": "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219": "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307": "claude-3-haiku-20240307",
} as const;

// Models that do NOT support temperature parameter (based on Anthropic documentation)
const MODELS_WITHOUT_TEMPERATURE = new Set<string>([
  // Most Anthropic models support temperature, but we'll keep this for potential future models
]);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class AnthropicService {
  async analyzePuzzleWithModel(
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
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    try {
      const requestOptions: any = {
        model: modelName,
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      };

      // Only add temperature for models that support it
      if (!MODELS_WITHOUT_TEMPERATURE.has(modelName)) {
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
      
      return {
        model: modelKey,
        reasoningLog: null,
        hasReasoningLog: false,
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
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // Anthropic uses messages array format
    const messageFormat = {
      model: modelName,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      temperature: temperature
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Temperature parameter supported",
      "Max tokens set to 4000"
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