/**
 * DeepSeek Service Integration for ARC-AGI Puzzle Analysis
 * @author Cascade / Gemini Pro 2.5
 * 
 * This service provides integration with DeepSeek's AI models for analyzing ARC-AGI puzzles.
 * It leverages DeepSeek's reasoning capabilities to explain puzzle solutions in the
 * context of alien communication patterns, making abstract reasoning more accessible.
 * 
 * Key Features:
 * - Full compatibility with DeepSeek's REST API using OpenAI SDK
 * - Support for multiple DeepSeek models (deepseek-v3, deepseek-chat, deepseek-reasoner)
 * - Structured JSON output for consistent puzzle explanations
 * - Emoji-based interpretation for accessibility and engagement
 * - Creative alien communication framing for educational purposes
 * 
 * Model Capabilities:
 * - DeepSeek V3: Latest reasoning model with advanced capabilities
 * - DeepSeek Chat: Conversational model optimized for dialogue
 * - DeepSeek Reasoner: Specialized reasoning model for complex problems
 * 
 * API Integration:
 * - Uses OpenAI SDK with base URL https://api.deepseek.com
 * - Requires DEEPSEEK_API_KEY environment variable
 * - Fully compatible with existing puzzle analysis pipeline
 * - Maintains same interface as other AI services for seamless integration
 * 
 * Educational Context:
 * The service frames ARC-AGI puzzles as alien communication challenges, where:
 * - Numbers 0-9 are mapped to meaningful emojis
 * - Transformations represent alien logical concepts
 * - Solutions reveal the "meaning" of alien messages
 * - Explanations focus on WHY answers work, not just HOW to solve
 * 
 * This approach makes abstract reasoning more intuitive and accessible,
 * especially for users with colorblindness or neurodivergent thinking patterns.
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder";
import type { PromptOptions } from "./promptBuilder"; // Cascade: modular prompt options

const MODELS = {
  "deepseek-chat": "deepseek-chat",
  "deepseek-reasoner": "deepseek-reasoner",
} as const;

// DeepSeek reasoning models that may have parameter limitations
const REASONING_MODELS = new Set([
  "deepseek-reasoner", // Only this model has parameter limitations
]);

// Initialize DeepSeek client with OpenAI SDK compatibility
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export class DeepSeekService {
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

    // Use custom prompt if provided, otherwise use selected template
    // Build prompt using shared prompt builder and forward PromptOptions (emojiSetKey, omitAnswer)
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // DeepSeek requires the word "json" in the prompt when using json_object response format
    const deepseekPrompt = prompt + "\n\nPlease respond in valid JSON format.";

    try {
      const requestOptions: any = {
        model: modelName,
        messages: [{ role: "user", content: deepseekPrompt }],
        response_format: { type: "json_object" },
      };

      // Apply temperature for non-reasoning models
      if (!REASONING_MODELS.has(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await deepseek.chat.completions.create(requestOptions);

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // For deepseek-reasoner, also capture the reasoning content (Chain of Thought)
      const responseData: any = {
        model: modelKey,
        ...result,
      };
      
      if (modelKey === "deepseek-reasoner") {
        // DeepSeek-specific field not in OpenAI SDK types, so we cast to any
        const message = response.choices[0].message as any;
        if (message.reasoning_content) {
          responseData.reasoningLog = message.reasoning_content;
          responseData.hasReasoningLog = true;
        }
      }
      
      return responseData;
    } catch (error) {
      console.error(`Error with DeepSeek model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`DeepSeek model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Get available DeepSeek models
   */
  getAvailableModels(): string[] {
    return Object.keys(MODELS);
  }

  /**
   * Check if model supports temperature parameter
   */
  supportsTemperature(modelKey: keyof typeof MODELS): boolean {
    return !REASONING_MODELS.has(modelKey);
  }

  /**
   * Get model capabilities and limitations
   */
  getModelInfo(modelKey: keyof typeof MODELS) {
    const modelName = MODELS[modelKey];
    const isReasoning = REASONING_MODELS.has(modelKey);
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: !isReasoning,
      contextWindow: 64000, // DeepSeek API maximum input length is 64K
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: true,
      supportsVision: false, // Update based on actual DeepSeek capabilities
    };
  }

  /**
   * Generate a preview of the exact prompt that will be sent to DeepSeek
   * Shows the provider-specific message format and structure
   * 
   * @author Claude 4 Sonnet
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
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // DeepSeek uses OpenAI-compatible messages format
    const messageFormat: any = {
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    };

    const providerSpecificNotes = [
      "Uses DeepSeek API with OpenAI SDK compatibility",
      "Base URL: https://api.deepseek.com",
      "JSON response format enforced",
      "64k context window for all models"
    ];

    // DeepSeek reasoning models don't support temperature
    if (!REASONING_MODELS.has(modelKey)) {
      messageFormat.temperature = temperature;
      providerSpecificNotes.push("Temperature parameter supported");
    } else {
      providerSpecificNotes.push("Temperature parameter NOT supported (reasoning model)");
      providerSpecificNotes.push("Supports reasoning log capture via reasoning_content field");
    }

    return {
      provider: "DeepSeek",
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
      temperature: REASONING_MODELS.has(modelKey) ? "Not supported" : temperature,
      isReasoningModel: REASONING_MODELS.has(modelKey)
    };
  }
}

export const deepseekService = new DeepSeekService();
