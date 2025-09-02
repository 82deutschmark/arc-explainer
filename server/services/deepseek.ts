/**
 * DeepSeek Service Integration for ARC-AGI Puzzle Analysis
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade / Gemini Pro 2.5 (original), Claude (refactor)
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS, getApiModelName } from "../config/models/index.js";

// Helper function to check if model supports temperature
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? true; // Most DeepSeek models support temperature
}

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export class DeepSeekService extends BaseAIService {
  protected provider = "DeepSeek";
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
    
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

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
    const modelName = getApiModelName(modelKey);
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    
    // Check if it's a reasoning model (DeepSeek Reasoner has reasoning capabilities)
    const isReasoning = modelName.includes('reasoner');
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow || 2048,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false, // DeepSeek doesn't support structured output format
      supportsVision: false // Most DeepSeek models don't support vision currently
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
    const temperature = options?.temperature;
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Create message array for DeepSeek API (same as OpenAI format)
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    // Get model configuration for max tokens
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    const maxTokens = modelConfig?.maxOutputTokens || 65536;

    // Build message format for DeepSeek API
    const messageFormat: any = {
      model: modelName,
      messages,
      max_tokens: maxTokens,
      ...(modelSupportsTemperature(modelKey) && { temperature })
    };

    const providerSpecificNotes = [
      "Uses DeepSeek API with OpenAI SDK compatibility",
      "Base URL: https://api.deepseek.com",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using system message role"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing",
      modelName.includes('reasoner') 
        ? "Reasoning model - provides step-by-step reasoning" 
        : "Standard chat model"
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
    const modelName = getApiModelName(modelKey) || modelKey;
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Build message array for DeepSeek API
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    // Get model configuration for max tokens
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    const maxTokens = modelConfig?.maxOutputTokens || 65536;

    const response = await deepseek.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: maxTokens,
      ...(modelSupportsTemperature(modelKey) && { temperature })
    });

    return response;
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
    status?: string;
    incomplete?: boolean;
    incompleteReason?: string;
  } {
    // Extract text content from DeepSeek response (OpenAI format)
    const choice = response.choices[0];
    const textContent = choice?.message?.content || '';
    
    // Extract JSON using inherited method
    const result = this.extractJsonFromResponse(textContent, modelKey);

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      // DeepSeek may provide reasoning tokens for reasoning models
      reasoning: response.usage?.reasoning_tokens
    };

    // Extract reasoning for reasoning models - let BaseAIService handle the processing
    let reasoningLog = null;
    if (captureReasoning && (modelKey.includes('reasoner') || modelKey.includes('prover'))) {
      // Check if DeepSeek provides reasoning in the message
      if (choice?.message?.reasoning_content) {
        reasoningLog = choice.message.reasoning_content;
      }
      // For other reasoning patterns, let BaseAIService.validateReasoningLog() handle extraction
    }

    const isComplete = response.choices[0].finish_reason === 'stop';
    const incompleteReason = isComplete ? undefined : response.choices[0].finish_reason;

    // Extract reasoningItems from the JSON response
    let reasoningItems: any[] = [];
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      console.log(`[DeepSeek] Extracted ${reasoningItems.length} reasoning items from JSON response`);
    }

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status: isComplete ? 'completed' : 'incomplete',
      incomplete: !isComplete,
      incompleteReason
    };
  }
}

export const deepseekService = new DeepSeekService();