/**
 * xAI Grok Service Integration for ARC-AGI Puzzle Analysis
 * Supports reasoning log capture for Grok reasoning models (grok-4-0709)
 * These models provide reasoning logs similar to OpenAI reasoning models
 * @author Cascade / Gemini Pro 2.5
 * 
 * This service provides integration with xAI's Grok models for analyzing ARC-AGI puzzles.
 * It leverages Grok's advanced reasoning capabilities to explain puzzle solutions in the
 * context of alien communication patterns, making abstract reasoning more accessible.
 * 
 * Key Features:
 * - Full compatibility with xAI's REST API using OpenAI SDK
 * - Support for multiple Grok models (beta, 3, 3-mini, 4, 4-mini)
 * - Intelligent handling of reasoning vs non-reasoning model limitations
 * - Structured JSON output for consistent puzzle explanations
 * - Emoji-based interpretation for accessibility and engagement
 * - Creative alien communication framing for educational purposes
 * 
 * Model Capabilities:
 * - Grok Beta: Preview model with 128k context, vision support
 * - Grok 3/3-mini: Standard reasoning models with temperature control
 * - Grok 4/4-mini: Latest reasoning models (no temperature/penalty support)
 * 
 * API Integration:
 * - Uses OpenAI SDK with base URL https://api.x.ai/v1
 * - Requires GROK_API_KEY environment variable
 * - Fully compatible with existing puzzle analysis pipeline
 * - Maintains same interface as OpenAI service for seamless integration
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
  "grok-4-0709": "grok-4-0709",
  "grok-3": "grok-3", 
  "grok-3-mini": "grok-3-mini",
  "grok-3-fast": "grok-3-fast",
  "grok-3-mini-fast": "grok-3-mini-fast",
} as const;

// Grok 4 and other reasoning models don't support certain parameters
const REASONING_MODELS = new Set([
  "grok-4-0709",
]);

// Models that support reasoning logs (Grok reasoning models)
const MODELS_WITH_REASONING = new Set([
  "grok-4-0709",
]);

// Initialize xAI client with OpenAI SDK compatibility
const xai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export class GrokService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: {
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder (refactored by Claude 4 Sonnet Thinking)
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    try {
      const requestOptions: any = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      };

      // Grok 4 reasoning models don't support temperature, presence_penalty, frequency_penalty, or stop
      if (!REASONING_MODELS.has(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await xai.chat.completions.create(requestOptions);

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Extract reasoning log if available and requested
      let reasoningLog = null;
      let hasReasoningLog = false;
      
      if (captureReasoning && MODELS_WITH_REASONING.has(modelKey)) {
        // Type assertion for reasoning field that may not be in xAI types yet
        const message = response.choices[0].message as any;
        
        // Debug: Log all available fields in the message
        console.log(`[Grok] Debug - Available message fields for ${modelKey}:`, Object.keys(message));
        console.log(`[Grok] Debug - Full message object:`, JSON.stringify(message, null, 2));
        
        // Grok uses reasoning_content field for reasoning logs (not reasoning)
        const reasoning = message.reasoning_content;
        if (reasoning) {
          reasoningLog = reasoning;
          hasReasoningLog = true;
          console.log(`[Grok] Successfully captured reasoning log for model ${modelKey} (${reasoning.length} characters)`);
        } else {
          console.log(`[Grok] No reasoning_content field found for model ${modelKey}`);
          
          // Also check legacy reasoning field for backward compatibility
          if (message.reasoning) {
            reasoningLog = message.reasoning;
            hasReasoningLog = true;
            console.log(`[Grok] Found legacy reasoning field for model ${modelKey} (${message.reasoning.length} characters)`);
          } else {
            // Check for alternative reasoning field names
            const alternativeFields = ['thought_process', 'analysis', 'thinking', 'rationale', 'explanation'];
            for (const field of alternativeFields) {
              if (message[field]) {
                console.log(`[Grok] Found alternative reasoning field '${field}' with ${message[field].length} characters`);
                reasoningLog = message[field];
                hasReasoningLog = true;
                break;
              }
            }
          }
        }
      }
      
      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
        // Include analysis parameters for database storage
        temperature,
        reasoningEffort: serviceOpts?.reasoningEffort || null,
        reasoningVerbosity: serviceOpts?.reasoningVerbosity || null,
        reasoningSummaryType: serviceOpts?.reasoningSummaryType || null,
        ...result,
      };
    } catch (error) {
      console.error(`Error with Grok model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Grok model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Get available Grok models
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
      contextWindow: 128000, // All Grok models have 128k context
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: true,
      supportsVision: modelKey === "grok-4-0709", // Only the latest Grok 4 supports vision
    };
  }

  /**
   * Generate a preview of the exact prompt that will be sent to Grok
   * Shows the provider-specific message format and structure
   * 
   * author Claude 4 Sonnet
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

    // Grok uses OpenAI-compatible messages format
    const messageFormat: any = {
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    };

    const providerSpecificNotes = [
      "Uses xAI API with OpenAI SDK compatibility",
      "Base URL: https://api.x.ai/v1",
      "JSON response format enforced",
      "128k context window for all models"
    ];

    // Grok 4 reasoning models don't support temperature
    if (!REASONING_MODELS.has(modelKey)) {
      messageFormat.temperature = temperature;
      providerSpecificNotes.push("Temperature parameter supported");
    } else {
      providerSpecificNotes.push("Temperature parameter NOT supported (reasoning model)");
    }

    if (MODELS_WITH_REASONING.has(modelKey)) {
      providerSpecificNotes.push("Supports reasoning log capture via reasoning_content field");
    }

    if (modelKey === "grok-4-0709") {
      providerSpecificNotes.push("Vision capabilities supported");
    }

    return {
      provider: "xAI Grok",
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

export const grokService = new GrokService();