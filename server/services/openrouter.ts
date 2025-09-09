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
    const usePromptReasoning = true;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, usePromptReasoning);
    
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // 1. Get the raw text response from the provider
      const responseText = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, taskId);
      
      // 2. Let the robust parser handle the raw text
      const captureReasoning = true;
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(responseText, modelKey, captureReasoning, taskId);

      // 3. Build the standard response
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
  ): Promise<string> { // Returns a string now
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
          stream: false // Explicitly disable streaming
        };

        // Conditionally apply JSON mode. Grok-4 seems to have issues with it.
        if (!modelName.includes('grok-4')) {
          payload.response_format = { type: "json_object" } as const;
        }

        if (continuationStep === 0) {
          // Initial request with full messages
          const modelConfig = getModelConfig(modelKey);

          // Grok-4 models seem to require a combined prompt. Other models might not support system prompts.
          if (modelName.includes('grok-4') || (modelConfig && modelConfig.supportsSystemPrompts === false)) {
            payload.messages = [
              {
                role: "user",
                content: `${prompt.systemPrompt}\n\n${prompt.userPrompt}`
              }
            ];
            logger.service('OpenRouter', `Using combined-prompt strategy for ${modelName}`);
          } else {
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
          }
          
          if (modelConfig && modelConfig.maxOutputTokens) {
            payload.max_tokens = modelConfig.maxOutputTokens;
            logger.service('OpenRouter', `Setting max_tokens for ${modelKey}: ${payload.max_tokens}`);
          } else if (modelKey === 'x-ai/grok-4') {
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
        
        const fetchResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              "HTTP-Referer": getRefererUrl(),
              "X-Title": "ARC Explainer",
          },
          body: JSON.stringify(payload)
        });

        const responseText = await fetchResponse.text();
        const requestDuration = Date.now() - startTime;

        if (!fetchResponse.ok) {
            logger.error(`[OpenRouter] API Error from ${modelKey}: ${JSON.stringify({ status: fetchResponse.status, statusText: fetchResponse.statusText, error: responseText }, null, 2)}`);
            throw new Error(`OpenRouter API error: ${fetchResponse.status} ${fetchResponse.statusText} - ${responseText}`);
        }

        // Continuation logic requires parsing each chunk. Handle non-JSON chunks gracefully.
        let chunkData;
        try {
            chunkData = JSON.parse(responseText);
        } catch (e) {
            logger.warn(`[OpenRouter] Non-JSON chunk received from ${modelKey}. Assuming it's a complete but non-standard response.`);
            fullResponseText += responseText;
            isComplete = true;
            continue; // Proceed to end of loop
        }

        const completionText = chunkData.choices?.[0]?.message?.content || '';
        const finishReason = chunkData.choices?.[0]?.finish_reason;
        
        fullResponseText += completionText;
        
        if (finishReason === 'length') {
          logger.service('OpenRouter', `Response truncated, continuing...`);
          continuationStep++;
        } else {
          isComplete = true;
        }
      }
    } catch (error) {
      logger.error(`[OpenRouter] Critical error during API call to ${modelKey}: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Rethrow the error after attempting to save
    }

    if (!isComplete && continuationStep >= maxContinuations) {
      logger.service('OpenRouter', `Hit maximum continuation limit (${maxContinuations}), proceeding with partial response of ${fullResponseText.length} chars`, 'error');
    }
    
    if (!fullResponseText || fullResponseText.length === 0) {
      logger.service('OpenRouter', `EMPTY RESPONSE ERROR - modelKey: ${modelKey}, modelName: ${modelName}, steps attempted: ${continuationStep + 1}`, 'error');
      throw new Error(`Empty response from ${modelKey} after ${continuationStep + 1} attempts. Check model availability and API configuration.`);
    }
    
    const contentPreview = fullResponseText.length > 200 
      ? `${fullResponseText.substring(0, 200)}...` 
      : fullResponseText;
    logger.service('OpenRouter', `Final assembled response preview: ${contentPreview.replace(/\n/g, '\\n')}`);
    
    // Return the raw text, as it's already been processed by the robust parser
    return fullResponseText;
  }

  protected parseProviderResponse(
    responseText: string,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    logger.service('OpenRouter', `Processing response for ${modelKey}`);
    // Log the raw text, not a stringified object
    logger.apiResponse('OpenRouter', 'API Response', responseText, 200);
    logger.service('OpenRouter', `Processing response for ${modelKey}`);

    const parseResult = jsonParser.parse(responseText, {
        preserveRawInput: true,
        allowPartialExtraction: true,
        logErrors: true,
        fieldName: `openrouter-${modelKey}`
    });

    if (!parseResult.success) {
        // The raw response is preserved in the fallbackResult object
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

    // Simulate a provider response object for the responseProcessor
    const simulatedResponse = {
      choices: [{
        message: {
          content: JSON.stringify(parseResult.data) // Use the clean, parsed JSON
        }
      }]
    };

    const processedResponse = responseProcessor.processChatCompletion(simulatedResponse, {
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