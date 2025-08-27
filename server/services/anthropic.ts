/**
 * Anthropic Claude service for analyzing ARC puzzles using Claude models
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade / Gemini Pro 2.5 (original), Claude (refactor)
 */

import Anthropic from "@anthropic-ai/sdk";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS } from "../../client/src/constants/models.js";

// Helper function to check if model supports temperature using centralized config
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? false;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class AnthropicService extends BaseAIService {
  protected provider = "Anthropic";
  protected models = {
    "claude-sonnet-4-20250514": "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-20250219": "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
    "claude-3-haiku-20240307": "claude-3-haiku-20240307",
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    // Build prompt package using inherited method
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      // Parse response using provider-specific method
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

      // Build standard response using inherited method
      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems
      );

    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = this.models[modelKey] || modelKey;
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    
    return {
      name: modelName,
      isReasoning: false, // Anthropic models don't have built-in reasoning mode
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.maxTokens || 200000,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false, // Anthropic doesn't support structured output yet
      supportsVision: modelName.includes('claude-3') // Most Claude 3+ models support vision
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): PromptPreview {
    const modelName = this.models[modelKey] || modelKey;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Build message format for Anthropic API
    const messageFormat: any = {
      model: modelName,
      max_tokens: 20000,
      messages: [{ role: "user", content: userMessage }],
      ...(systemMessage && { system: systemMessage }),
      ...(modelSupportsTemperature(modelKey) && { temperature })
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Supports dedicated system parameter",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using dedicated system parameter"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing (no structured output support)"
    ];

    const previewText = systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`;

    return {
      provider: this.provider,
      modelName,
      promptText: previewText,
      messageFormat,
      systemPromptMode,
      templateInfo: {
        id: promptPackage.selectedTemplate?.id || "custom",
        name: promptPackage.selectedTemplate?.name || "Custom Prompt",
        usesEmojis: promptPackage.selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: previewText.length,
        wordCount: previewText.split(/\s+/).length,
        lineCount: previewText.split('\n').length
      },
      providerSpecificNotes: providerSpecificNotes.join('; ')
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const modelName = this.models[modelKey] || modelKey;
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Build request options with proper Anthropic system parameter
    const requestOptions: any = {
      model: modelName,
      max_tokens: 20000,
      messages: [{ role: "user", content: userMessage }],
    };
    
    // Add system prompt if in ARC mode (Anthropic supports dedicated system parameter)
    if (systemMessage && systemPromptMode === 'ARC') {
      requestOptions.system = systemMessage;
    }

    // Only add temperature for models that support it
    if (modelSupportsTemperature(modelKey)) {
      requestOptions.temperature = temperature;
    }

    return await anthropic.messages.create(requestOptions);
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): {
    result: any;
    tokenUsage: TokenUsage;
    reasoningLog?: any;
    reasoningItems?: any[];
  } {
    // Extract text content from Anthropic response
    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';
    
    // Extract JSON using inherited method
    const result = this.extractJsonFromResponse(textContent, modelKey);

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.usage?.input_tokens || 0,
      output: response.usage?.output_tokens || 0,
      // Anthropic doesn't provide separate reasoning tokens
    };

    // Anthropic doesn't provide built-in reasoning logs
    return {
      result,
      tokenUsage,
      reasoningLog: null,
      reasoningItems: []
    };
  }
}

export const anthropicService = new AnthropicService();