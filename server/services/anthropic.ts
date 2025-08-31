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
import { MODELS as MODEL_CONFIGS, getApiModelName, getModelConfig } from "../config/models/index.js";

// Helper function to check if model supports temperature using centralized config
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? false;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class AnthropicService extends BaseAIService {
  protected provider = "Anthropic";
  protected models = {}; // Required by BaseAIService, but we use centralized getApiModelName

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
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      const { result, tokenUsage, reasoningLog, reasoningItems, status, incomplete, incompleteReason } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems,
        status,
        incomplete,
        incompleteReason
      );
    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = getApiModelName(modelKey) || modelKey;
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    
    const max_tokens = modelConfig?.maxOutputTokens || 4096; // Default value

    return {
      name: modelName,
      isReasoning: false, // Anthropic models don't have built-in reasoning mode
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: max_tokens,
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
    const modelName = getApiModelName(modelKey) || modelKey;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const temperature = options?.temperature ?? 0.2; // Use passed temp or default
    const apiModelName = getApiModelName(modelName);

    const messageFormat: any = {
      model: apiModelName,
      max_tokens: 20000,
      messages: [{ role: "user", content: userMessage }],
      ...(systemMessage && { system: systemMessage }),
      ...(modelSupportsTemperature(modelKey) && { temperature })
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Supports dedicated system parameter",
      serviceOpts.systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using dedicated system parameter"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing (no structured output support)"
    ];

    const { systemPromptMode } = serviceOpts;
    const previewText = systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`;

    return {
      provider: this.provider,
      modelName,
      messageFormat,
      promptText: previewText,
      systemPromptMode: serviceOpts.systemPromptMode,
      providerSpecificNotes: providerSpecificNotes.join('; '),
      templateInfo: {
        id: promptPackage.selectedTemplate?.id || "custom",
        name: promptPackage.selectedTemplate?.name || "Custom Prompt",
        usesEmojis: promptPackage.selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: previewText.length,
        wordCount: previewText.split(/\s+/).length,
        lineCount: previewText.split('\n').length
      }
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const { systemPrompt, userPrompt } = promptPackage;
    const modelConfig = getModelConfig(modelKey);
    const apiModelName = getApiModelName(modelKey);
    const supportsTemp = modelConfig?.supportsTemperature ?? false;

    const requestBody: Anthropic.Messages.MessageCreateParams = {
      model: apiModelName,
      max_tokens: serviceOpts.maxOutputTokens || modelConfig?.maxOutputTokens || 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      ...(supportsTemp && { temperature }),
    };

    this.logAnalysisStart(modelKey, temperature, userPrompt.length, serviceOpts);
    const startTime = Date.now();
    const response = await anthropic.messages.create(requestBody);
    const processingTime = Date.now() - startTime;
    console.log(`[${this.provider}] Analysis for ${modelKey} completed in ${processingTime}ms`);

    return { ...response, processingTime };
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string } {
    const { content, usage, stop_reason } = response;
    const responseText = content[0]?.text || '';

    const tokenUsage: TokenUsage = {
      input: usage.input_tokens,
      output: usage.output_tokens,
    };

    const isComplete = stop_reason === 'end_turn';
    const incompleteReason = isComplete ? undefined : stop_reason;

    // For Anthropic, reasoning is not structured, so we pass the raw text if requested.
    const reasoningLog = captureReasoning ? responseText : undefined;

    // Attempt to extract JSON from the response text.
    const result = this.extractJsonFromResponse(responseText, modelKey);

    return {
      result,
      tokenUsage,
      reasoningLog,
      status: isComplete ? 'completed' : 'incomplete',
      incomplete: !isComplete,
      incompleteReason,
      reasoningItems: []
    };
  }
}

export const anthropicService = new AnthropicService();