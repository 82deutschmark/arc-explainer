/**
 * OpenRouter service for analyzing ARC puzzles using multiple AI providers through OpenRouter API
 * OpenRouter provides unified access to models from OpenAI, Anthropic, Google, Meta, and more
 * Refactored to extend BaseAIService for code consolidation and consistency
 * 
 * @author Claude (original), Claude Code (refactor)
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { getModelConfig, getApiModelName, MODELS } from '../config/models/index.js';
import { responsePersistence } from './ResponsePersistence.js';
import { responseProcessor } from './ResponseProcessor.js';
import { jsonParser } from '../utils/JsonParser.js';
import { logger } from '../utils/logger.js';

// Initialize OpenRouter client with OpenAI-compatible interface
// Dynamic referer based on environment or default to production
const getRefererUrl = () => {
  // Check for environment-specific referer
  if (process.env.OPENROUTER_REFERER) {
    return process.env.OPENROUTER_REFERER;
  }
  
  // Auto-detect based on NODE_ENV
  if (process.env.NODE_ENV === 'development') {
    return "http://localhost:5000";
  }
  
  // Default to production URL
  return "https://arc.markbarney.net";
};

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 45 * 60 * 1000, // 45 minutes timeout for very long responses
  defaultHeaders: {
    "HTTP-Referer": getRefererUrl(), // Dynamic referer based on environment
    "X-Title": "ARC Explainer", // Your app name
  }
});

export class OpenRouterService extends BaseAIService {
  protected provider = "OpenRouter";
  protected models = {}; // We use centralized getApiModelName instead


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
    // For OpenRouter, reasoning is always included in the prompt.
    const usePromptReasoning = true;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, usePromptReasoning);
    
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, taskId);
      
      // For OpenRouter, reasoning is always included in the prompt.
      const captureReasoning = true;
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning, taskId);

      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        Boolean(reasoningLog),
        reasoningItems
      );
    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  protected async callProviderAPI(
    prompt: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    taskId?: string
  ): Promise<any> {
    const modelName = getApiModelName(modelKey);
    
    logger.service('OpenRouter', `Making API call to model: ${modelName}`);

    // CONTINUATION SUPPORT: Accumulate response across multiple API calls if truncated
    let fullResponseText = '';
    let generationId: string | null = null;
    let continuationStep = 0;
    let isComplete = false;
    let finalUsage: any = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const maxContinuations = 5; // Prevent infinite loops

    try {
      while (!isComplete && continuationStep < maxContinuations) {
      // Build request payload
      const payload: any = {
        model: modelName,
        temperature: temperature,
        response_format: { type: "json_object" } as const,
        stream: false // Explicitly disable streaming
      };

      if (continuationStep === 0) {
        // Initial request with full messages
        payload.messages = [
          {
            role: "system",
            content: prompt.systemPrompt
          },
          {
            role: "user", 
            content: prompt.userPrompt
          }
        ];
        
        // Set max_tokens if defined in the model configuration
        const modelConfig = getModelConfig(modelKey);
        if (modelConfig && modelConfig.maxOutputTokens) {
          payload.max_tokens = modelConfig.maxOutputTokens;
          logger.service('OpenRouter', `Setting max_tokens for ${modelKey}: ${payload.max_tokens}`);
        } else if (modelKey === 'x-ai/grok-4') {
          // Fallback for a specific problematic model if not in config
          payload.max_tokens = 120000;
          logger.service('OpenRouter', `Setting high token limit for ${modelKey}: ${payload.max_tokens}`);
        }
        
        logger.service('OpenRouter', `Initial API request - model: ${modelName}, max_tokens: ${payload.max_tokens || 'default'}`);
      } else {
        // Continuation request
        payload.messages = []; // Empty messages for continuation
        payload.continue = {
          generation_id: generationId,
          step: continuationStep
        };
        
        logger.service('OpenRouter', `Continuation request - step: ${continuationStep}, generation_id: ${generationId}`);
      }
      
      // Make API call
      const startTime = Date.now();
      const rawResponse = await openrouter.chat.completions.create(payload);
      const requestDuration = Date.now() - startTime;
      
      // Extract response data
      const completionText = rawResponse.choices?.[0]?.message?.content || '';
      const finishReason = rawResponse.choices?.[0]?.finish_reason || (rawResponse.choices?.[0] as any)?.native_finish_reason;
      generationId = rawResponse.id || generationId; // Store generation ID for continuation
      
      // Accumulate response text
      fullResponseText += completionText;
      
      // Accumulate token usage
      if (rawResponse.usage) {
        finalUsage.prompt_tokens += rawResponse.usage.prompt_tokens || 0;
        finalUsage.completion_tokens += rawResponse.usage.completion_tokens || 0;
        finalUsage.total_tokens += rawResponse.usage.total_tokens || 0;
      }
      
      logger.service('OpenRouter', `Step ${continuationStep} response - finish_reason: ${finishReason}, chunk_length: ${completionText.length} chars, duration: ${requestDuration}ms`);
      
      // Check if we need to continue
      if (finishReason === 'length') {
        logger.service('OpenRouter', `Response truncated at step ${continuationStep}, accumulated ${fullResponseText.length} chars so far, continuing...`, 'warn');
        continuationStep++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        isComplete = true;
        logger.service('OpenRouter', `Response complete after ${continuationStep + 1} step(s), total length: ${fullResponseText.length} chars`);
      }
    }
    } catch (error) {
      logger.error(`[OpenRouter] Critical error during API call to ${modelKey}: ${error instanceof Error ? error.message : String(error)}`);
      // Attempt to save whatever partial response we have for recovery
      if (fullResponseText) {
        if (taskId) {
          responsePersistence.saveExplanationResponse(taskId, modelKey, fullResponseText, 'PARSE_FAILED');
        }
      }
      throw error; // Rethrow the error after attempting to save
    }
    
    // Check if we hit the continuation limit
    if (!isComplete && continuationStep >= maxContinuations) {
      logger.service('OpenRouter', `Hit maximum continuation limit (${maxContinuations}), proceeding with partial response of ${fullResponseText.length} chars`, 'error');
    }
    
    // Handle empty responses
    if (!fullResponseText || fullResponseText.length === 0) {
      logger.service('OpenRouter', `EMPTY RESPONSE ERROR - modelKey: ${modelKey}, modelName: ${modelName}, steps attempted: ${continuationStep + 1}`, 'error');
      throw new Error(`Empty response from ${modelKey} after ${continuationStep + 1} attempts. Check model availability and API configuration.`);
    }
    
    // Preview final assembled response for debugging
    const contentPreview = fullResponseText.length > 200 
      ? `${fullResponseText.substring(0, 200)}...` 
      : fullResponseText;
    logger.service('OpenRouter', `Final assembled response preview: ${contentPreview.replace(/\n/g, '\\n')}`);
    
    // Return normalized response with full assembled text
    return {
      choices: [{
        message: {
          content: fullResponseText,
          role: 'assistant'
        },
        finish_reason: isComplete ? 'stop' : 'length'
      }],
      usage: finalUsage,
      id: generationId
    };
  }


  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    logger.service('OpenRouter', `Processing response for ${modelKey}`);
    logger.apiResponse('OpenRouter', 'API Response', JSON.stringify(response), 200);

    const responseText = response.choices?.[0]?.message?.content || '';

    // [CRITICAL-DEBUG] Log the raw response text before attempting to parse
    logger.service('OpenRouter', `[CRITICAL-DEBUG] Raw response text for ${modelKey} (length: ${responseText.length}):\n---\n${responseText}\n---`);

    const parseResult = jsonParser.parse(responseText, {
        preserveRawInput: true,
        allowPartialExtraction: true,
        logErrors: true,
        fieldName: `openrouter-${modelKey}`
    });

    if (!parseResult.success) {
        // Save the failed response for recovery
        if (puzzleId) {
          responsePersistence.saveExplanationResponse(puzzleId, modelKey, responseText, 'PARSE_FAILED');
        }
        logger.service('OpenRouter', `JSON parsing failed for ${modelKey}: ${parseResult.error}`, 'error');
        // Create a fallback response to preserve raw data
        const fallbackResult = {
            _parseError: parseResult.error,
            _rawResponse: responseText,
            _parsingFailed: true,
            solvingStrategy: "JSON parsing failed - raw response preserved",
            patternDescription: "Unable to parse model response",
            hints: [],
            confidence: 0
        };
        return {
            result: fallbackResult,
            tokenUsage: { input: 0, output: 0 }
        };
    }

    const robustResponse = {
        ...response,
        choices: [{
            ...response.choices[0],
            message: {
                ...response.choices[0].message,
                content: JSON.stringify(parseResult.data) // Ensure clean JSON string
            }
        }]
    };

    const processedResponse = responseProcessor.processChatCompletion(robustResponse, {
        captureReasoning,
        modelKey,
        provider: 'OpenRouter'
    });

    logger.service('OpenRouter', `JSON parsing successful for ${modelKey}`);
    logger.tokenUsage('OpenRouter', modelKey, processedResponse.tokenUsage.input, processedResponse.tokenUsage.output, processedResponse.tokenUsage.reasoning);

    return {
        result: processedResponse.result,
        tokenUsage: processedResponse.tokenUsage,
        reasoningLog: processedResponse.reasoningLog,
        reasoningItems: processedResponse.reasoningItems
    };
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelConfig = getModelConfig(modelKey);
    
    if (!modelConfig) {
      logger.service('OpenRouter', `No configuration found for model: ${modelKey}`, 'warn');
      // Return defaults for unknown OpenRouter models - no artificial context window limit
      return {
        name: modelKey,
        isReasoning: false,
        supportsTemperature: false,
        contextWindow: undefined, // Let the model use its natural context window
        supportsFunctionCalling: false,
        supportsSystemPrompts: true,
        supportsStructuredOutput: true,
        supportsVision: false
      };
    }

    return {
      name: modelConfig.name,
      isReasoning: modelConfig.isReasoning || false,
      supportsTemperature: modelConfig.supportsTemperature || false,
      contextWindow: modelConfig.contextWindow, // Use actual model context window, no artificial fallback
      supportsFunctionCalling: modelConfig.supportsFunctionCalling || false,
      supportsSystemPrompts: modelConfig.supportsSystemPrompts !== false,
      supportsStructuredOutput: modelConfig.supportsStructuredOutput !== false,
      supportsVision: modelConfig.supportsVision || false
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): PromptPreview {
    const promptPackage = this.buildPromptPackage(task, promptId || getDefaultPromptId(), customPrompt, options, serviceOpts);
    const modelName = getApiModelName(modelKey);
    
    const messages = [
      {
        role: "system",
        content: promptPackage.systemPrompt
      },
      {
        role: "user", 
        content: promptPackage.userPrompt
      }
    ];

    const fullPromptText = `System: ${promptPackage.systemPrompt}\n\nUser: ${promptPackage.userPrompt}`;

    return {
      provider: this.provider,
      modelName: modelName,
      promptText: fullPromptText,
      messageFormat: messages,
      systemPromptMode: serviceOpts?.systemPromptMode || 'ARC',
      templateInfo: {
        id: promptId || getDefaultPromptId(),
        name: promptPackage.templateName || 'Default',
        usesEmojis: promptPackage.templateName?.includes('emoji') || false
      },
      promptStats: {
        characterCount: fullPromptText.length,
        wordCount: fullPromptText.split(/\s+/).length,
        lineCount: fullPromptText.split('\n').length
      },
      providerSpecificNotes: "OpenRouter provides unified access to multiple AI providers. Response format and capabilities may vary by underlying model."
    };
  }
}

// Export singleton instance
export const openrouterService = new OpenRouterService();