/**
 * Anthropic Claude service for analyzing ARC puzzles using Claude models
 * Supports reasoning log capture through structured prompting with <reasoning> tags
 * Since Anthropic doesn't provide built-in reasoning logs, we prompt Claude to show its reasoning
 * 
 * NEW: Now supports dynamic prompt template selection via promptId parameter.
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

    // Build prompt using shared prompt builder
    const { prompt: basePrompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);
    
    // Add reasoning prompt wrapper for Anthropic if captureReasoning is enabled
    const prompt = captureReasoning ? 
      `${basePrompt}

IMPORTANT: Before providing your final answer, please show your step-by-step reasoning process inside <reasoning> tags. Think through the puzzle systematically, analyzing patterns, transformations, and logical connections. This reasoning will help users understand your thought process.

<reasoning>
[Your detailed step-by-step analysis will go here]
</reasoning>

Then provide your final structured response.` : basePrompt;

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
      
      // Handle reasoning extraction if requested
      let reasoningLog = null;
      let hasReasoningLog = false;
      let contentForParsing = textContent;
      
      if (captureReasoning && textContent.includes('<reasoning>')) {
        const reasoningMatch = textContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
        if (reasoningMatch) {
          reasoningLog = reasoningMatch[1].trim();
          hasReasoningLog = true;
          // Remove reasoning tags for JSON parsing
          contentForParsing = textContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
        }
      }
      
      // Simple JSON extraction - try direct parse first, then look for JSON in text
      let result;
      try {
        result = JSON.parse(contentForParsing);
      } catch (parseError) {
        // Look for JSON anywhere in the full text (including reasoning if needed)
        const allText = reasoningLog && !contentForParsing ? reasoningLog : textContent;
        const jsonMatch = allText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondError) {
            result = {
              patternDescription: "Parse error",
              solvingStrategy: "Could not extract valid JSON from response",
              hints: ["Model returned malformed JSON"],
              confidence: 0
            };
          }
        } else {
          result = {
            patternDescription: "No JSON found",
            solvingStrategy: "No JSON structure detected in response",
            hints: ["Model may need different prompting"],
            confidence: 0
          };
        }
      }
      
      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
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

    // Build prompt using shared prompt builder
    const { prompt: basePrompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);
    
    // Add reasoning prompt wrapper for Anthropic if captureReasoning is enabled
    const prompt = captureReasoning ? 
      `${basePrompt}

IMPORTANT: Before providing your final answer, please show your step-by-step reasoning process inside <reasoning> tags. Think through the puzzle systematically, analyzing patterns, transformations, and logical connections. This reasoning will help users understand your thought process.

<reasoning>
[Your detailed step-by-step analysis will go here]
</reasoning>

Then provide your final structured response.` : basePrompt;

    // Anthropic uses messages array format
    const messageFormat = {
      model: modelName,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      temperature: temperature
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Supports reasoning capture via <reasoning> tags",
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