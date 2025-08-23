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
import { calculateCost } from "../utils/costCalculator";
import { MODELS as MODEL_CONFIGS } from "../../client/src/constants/models";

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
    serviceOpts?: {
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
      systemPromptMode?: 'ARC' | 'None';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    // Build prompt package using new modular architecture
    const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, {
      ...options,
      systemPromptMode,
      useStructuredOutput: false // DeepSeek doesn't support structured output yet
    });
    
    console.log(`[DeepSeek] Using modular system prompt architecture`);
    console.log(`[DeepSeek] System prompt mode: ${systemPromptMode}`);
    
    // Extract system and user prompts from prompt package
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const selectedTemplate = promptPackage.selectedTemplate;
    
    console.log(`[DeepSeek] System prompt: ${systemMessage.length} chars`);
    console.log(`[DeepSeek] User prompt: ${userMessage.length} chars`);

    try {
      // Create message array based on system prompt mode
      const messages: any[] = [];
      if (systemPromptMode === 'ARC' && systemMessage) {
        messages.push({ role: "system", content: systemMessage });
      }
      messages.push({ role: "user", content: userMessage });
      
      const requestOptions: any = {
        model: modelName,
        messages: messages,
        response_format: { type: "json_object" },
      };

      // Apply temperature for non-reasoning models
      if (!REASONING_MODELS.has(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await deepseek.chat.completions.create(requestOptions);

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Extract token usage from DeepSeek response (OpenAI-compatible + reasoning_tokens for R1)
      let tokenUsage: { input: number; output: number; reasoning?: number } | undefined;
      let cost: { input: number; output: number; reasoning?: number; total: number } | undefined;
      
      if (response.usage) {
        tokenUsage = {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          reasoning: (response.usage as any).reasoning_tokens, // DeepSeek R1 specific
        };

        // Find the model config to get pricing
        const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
        if (modelConfig && tokenUsage) {
          cost = calculateCost(modelConfig.cost, tokenUsage);
        }
      }
      
      // For deepseek-reasoner, also capture the reasoning content (Chain of Thought)
      const responseData: any = {
        model: modelKey,
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
    serviceOpts?: {
      systemPromptMode?: 'ARC' | 'None';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';

    // Build prompt package using new modular architecture
    const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, {
      ...options,
      systemPromptMode,
      useStructuredOutput: false
    });
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const selectedTemplate = promptPackage.selectedTemplate;

    // Create message array based on system prompt mode
    const messages: any[] = [];
    if (systemPromptMode === 'ARC' && systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    // DeepSeek uses OpenAI-compatible messages format
    const messageFormat: any = {
      model: modelName,
      messages: messages,
      response_format: { type: "json_object" }
    };

    const providerSpecificNotes = [
      "Uses DeepSeek API with OpenAI SDK compatibility",
      "Base URL: https://api.deepseek.com",
      "JSON response format enforced",
      "64k context window for all models"
    ];
    
    // Add system prompt mode notes
    if (systemPromptMode === 'ARC') {
      providerSpecificNotes.push("System Prompt Mode: {ARC} - Using structured system prompt for better parsing");
      providerSpecificNotes.push(`System Message: "${systemMessage}"`);
    } else {
      providerSpecificNotes.push("System Prompt Mode: {None} - Old behavior (all content as user message)");
    }

    // DeepSeek reasoning models don't support temperature
    if (!REASONING_MODELS.has(modelKey)) {
      messageFormat.temperature = temperature;
      providerSpecificNotes.push("Temperature parameter supported");
    } else {
      providerSpecificNotes.push("Temperature parameter NOT supported (reasoning model)");
      providerSpecificNotes.push("Supports reasoning log capture via reasoning_content field");
    }

    // Compose preview text; in ARC mode, system is separate so show user content; in None, show combined
    const previewText = systemPromptMode === 'ARC'
      ? userMessage
      : `${systemMessage}\n\n${userMessage}`;

    return {
      provider: "DeepSeek",
      modelName,
      promptText: previewText,
      systemPrompt: systemMessage,
      messageFormat,
      templateInfo: {
        id: selectedTemplate?.id || "custom",
        name: selectedTemplate?.name || "Custom Prompt",
        usesEmojis: selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: basePrompt.length,
        wordCount: basePrompt.split(/\s+/).length,
        lineCount: basePrompt.split('\n').length
      },
      providerSpecificNotes,
      captureReasoning,
      temperature: REASONING_MODELS.has(modelKey) ? "Not supported" : temperature,
      isReasoningModel: REASONING_MODELS.has(modelKey)
    };
  }
}

export const deepseekService = new DeepSeekService();
