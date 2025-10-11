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
import { logger } from "../utils/logger.js";

// Helper function to check if model supports temperature
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? true; // Most DeepSeek models support temperature
}

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
  timeout: 45 * 60 * 1000, // 45 minutes timeout for very long responses
});

export class DeepSeekService extends BaseAIService {
  protected provider = "DeepSeek";
  protected models = {}; // Required by BaseAIService, but we use centralized getApiModelName


  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    const testCount = task.test.length;

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, testCount);
      
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, true);

      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems,
        undefined, // status
        undefined, // incomplete
        undefined, // incompleteReason
        promptPackage,
        promptId,
        customPrompt
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
      contextWindow: modelConfig?.contextWindow,
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

    // Build message format for DeepSeek API
    const messageFormat: any = {
      model: modelName,
      messages,
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
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string
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

    const response = await deepseek.chat.completions.create({
      model: modelName,
      messages,
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
    const choice = response.choices[0];
    let result: any = {};
    let reasoningLog = null;

    // DeepSeek-R1 (deepseek-reasoner) returns two separate fields:
    // 1. reasoning_content = Chain of Thought reasoning steps
    // 2. content = Final JSON answer (not text containing JSON)
    const isReasoningModel = modelKey.includes('reasoner') || modelKey.includes('prover');
    
    if (isReasoningModel) {
      // For reasoning models, content field IS the JSON response
      const contentField = choice?.message?.content || '';
      logger.service('DeepSeek', `Raw content field length: ${contentField.length}`, 'debug');
      logger.apiResponse('DeepSeek', 'Content preview', contentField, 200);
      
      try {
        // Try parsing content directly as JSON
        result = JSON.parse(contentField);
        logger.service('DeepSeek', 'Successfully parsed content as JSON', 'debug');
      } catch (error) {
        logger.service('DeepSeek', 'Content not direct JSON, attempting extraction...', 'debug');
        // Fallback to inherited JSON extraction if content is wrapped in text
        result = this.extractJsonFromResponse(contentField, modelKey);
      }
      
      // Extract reasoning from reasoning_content field
      if (captureReasoning && choice?.message?.reasoning_content) {
        reasoningLog = choice.message.reasoning_content;
        logger.service('DeepSeek', `Extracted reasoning log: ${reasoningLog.length} chars`, 'debug');
      }
    } else {
      // For non-reasoning models, use standard text extraction
      const textContent = choice?.message?.content || '';
      result = this.extractJsonFromResponse(textContent, modelKey);
    }

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      reasoning: response.usage?.reasoning_tokens
    };

    const isComplete = response.choices[0].finish_reason === 'stop';
    const incompleteReason = isComplete ? undefined : response.choices[0].finish_reason;

    // Extract reasoningItems from the JSON response (structured content only)
    let reasoningItems: any[] = [];
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      logger.service('DeepSeek', `✅ Extracted ${reasoningItems.length} reasoning items from JSON response`, 'debug');
    } else {
      logger.service('DeepSeek', '❌ No reasoningItems found in JSON response - model may not be following structured format', 'warn');
      if (isReasoningModel) {
        logger.service('DeepSeek', `⚠️ DeepSeek reasoning model ${modelKey} should provide reasoningItems in JSON structure`, 'warn');
      }
    }

    logger.service('DeepSeek', `Parse complete - result keys: ${Object.keys(result || {}).join(', ')}`, 'debug');

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