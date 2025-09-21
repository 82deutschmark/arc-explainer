/**
 * OpenRouter service for analyzing ARC puzzles using multiple AI providers through OpenRouter API
 * OpenRouter provides unified access to models from OpenAI, Anthropic, Google, Meta, and more
 * Refactored to extend BaseAIService for code consolidation and consistency
 * 
 * @author Claude (original), Claude Code (refactor)
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

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
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
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
          stream: false, // Explicitly disable streaming
          // Additional streaming prevention
          stream_options: undefined // Ensure no stream options
        };

        logger.service('OpenRouter', `Request payload streaming config - stream: ${payload.stream}, step: ${continuationStep}`);;

        // Conditionally apply JSON mode based on model configuration
        const modelConfig = getModelConfig(modelKey);
        const supportsStructuredOutput = modelConfig?.supportsStructuredOutput !== false;
        
        if (supportsStructuredOutput) {
          payload.response_format = { type: "json_object" } as const;
        } else {
          logger.service('OpenRouter', `Disabling JSON mode for model that doesn't support structured output: ${modelName}`);
        }

        if (continuationStep === 0) {
          // Initial request with full messages
          const modelConfig = getModelConfig(modelKey);

          // Check if model requires prompt format instead of messages
          if (modelConfig && modelConfig.requiresPromptFormat) {
            payload.prompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`;
            logger.service('OpenRouter', `Using prompt format for ${modelName}`);
          }
          // Grok models and some others require a combined prompt strategy, or might not support system prompts.
          else if (modelName.includes('grok') || (modelConfig && modelConfig.supportsSystemPrompts === false)) {
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
          } else if (modelName.includes('grok')) {
            // Use a reasonable default for Grok models
            payload.max_tokens = modelConfig?.contextWindow ? Math.min(25000, Math.floor(modelConfig.contextWindow * 0.8)) : 25000;
            logger.service('OpenRouter', `Setting token limit for Grok model ${modelKey}: ${payload.max_tokens}`);
          }
          
          logger.service('OpenRouter', `Initial API request - model: ${modelName}, max_tokens: ${payload.max_tokens || 'default'}`);
        } else {
          // Continuation request
          const modelConfig = getModelConfig(modelKey);
          
          if (modelConfig && modelConfig.requiresPromptFormat) {
            payload.prompt = ""; // Empty prompt for continuation
          } else {
            payload.messages = []; // Empty messages for continuation
          }
          
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

        // FAIL-FAST: If the response is just whitespace, it's an empty response.
        if (responseText.trim() === '') {
          logger.service('OpenRouter', `API call to ${modelKey} returned only whitespace.`, 'error');
          throw new Error(`Empty response from ${modelKey}. The model returned only whitespace.`);
        }

        // Debug: Check for streaming artifacts in response
        const hasExcessiveLeadingWhitespace = responseText.length > 100 && responseText.trimStart().length < responseText.length - 50;
        if (hasExcessiveLeadingWhitespace) {
          logger.service('OpenRouter', `⚠️  Detected excessive leading whitespace in response from ${modelKey} (${responseText.length - responseText.trimStart().length} chars)`, 'warn');
        }

        if (!fetchResponse.ok) {
            // Log detailed error for debugging but create user-friendly error message
            logger.logError(`OpenRouter API Error from ${modelKey}`, {
              error: { status: fetchResponse.status, statusText: fetchResponse.statusText, response: responseText.substring(0, 500) },
              context: 'openrouter-api'
            });
            
            // Create user-friendly error with specific handling for common cases
            let userMessage = `OpenRouter API error: ${fetchResponse.status} ${fetchResponse.statusText}`;
            if (fetchResponse.status === 429) {
              userMessage = `Model ${modelKey} is temporarily rate-limited. Please retry shortly or select a different model.`;
            } else if (fetchResponse.status >= 500) {
              userMessage = `OpenRouter service temporarily unavailable for ${modelKey}. Please try again.`;
            } else if (fetchResponse.status === 404) {
              userMessage = `Model ${modelKey} not found or no longer available.`;
            } else if (responseText.includes('rate-limited')) {
              userMessage = `Model ${modelKey} is temporarily rate-limited. Please retry shortly.`;
            } else if (responseText.includes('unavailable')) {
              userMessage = `Model ${modelKey} is currently unavailable. Please try another model.`;
            }
            
            const error = new Error(userMessage);
            (error as any).statusCode = fetchResponse.status;
            (error as any).provider = 'OpenRouter';
            (error as any).modelKey = modelKey;
            throw error;
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

  /**
   * OpenRouter-specific response sanitizer for handling problematic responses
   * Some OpenRouter models return excessive leading whitespace/control characters
   *
   * Author: Claude Code using Sonnet 4
   * Date: 2025-09-20
   * PURPOSE: Defensive parsing specifically for OpenRouter responses with excessive leading junk
   * SRP and DRY check: Pass - Single responsibility for OpenRouter response cleaning
   */
  private sanitizeOpenRouterResponse(responseText: string): {
    cleanedText: string;
    reasoningText?: string;
    method: string;
    charactersRemoved: number;
  } {
    if (!responseText || typeof responseText !== 'string') {
      return {
        cleanedText: responseText || '',
        method: 'no_sanitization_needed',
        charactersRemoved: 0
      };
    }

    const originalLength = responseText.length;

    // Step 1: Remove null bytes and other problematic control characters
    let sanitized = responseText
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/\u0001/g, '') // Remove other control chars
      .replace(/\u0002/g, '')
      .replace(/\u0003/g, '');

    // Step 2: Find the first occurrence of '{' (JSON start)
    const jsonStartIndex = sanitized.indexOf('{');

    if (jsonStartIndex === -1) {
      // No JSON object start token '{' was found.
      const trimmed = sanitized.trim();
      // This case handles two scenarios:
      // 1. The response was purely non-JSON text (e.g., a plain error message).
      // 2. The response was only whitespace (and is now an empty string).
      // The check in callProviderAPI should catch #2, but this is an extra safeguard.
      return {
        cleanedText: trimmed, // Return the non-JSON text or an empty string.
        method: 'no_json_found',
        charactersRemoved: originalLength - trimmed.length
      };
    }

    // Step 3: Extract potential reasoning text before JSON
    let reasoningText: string | undefined;
    if (jsonStartIndex > 20) { // Only if there's substantial text before JSON
      const preJsonText = sanitized.substring(0, jsonStartIndex).trim();
      // Check if it looks like reasoning (not just whitespace/newlines)
      if (preJsonText.length > 10 && /[a-zA-Z]/.test(preJsonText)) {
        reasoningText = preJsonText;
      }
    }

    // Step 4: Find the last '}' to get complete JSON
    const jsonPortion = sanitized.substring(jsonStartIndex);
    const lastBraceIndex = jsonPortion.lastIndexOf('}');

    if (lastBraceIndex === -1) {
      // No closing brace found, use everything from first {
      const cleanedText = jsonPortion.trim();
      return {
        cleanedText,
        reasoningText,
        method: 'partial_json_extraction',
        charactersRemoved: originalLength - cleanedText.length
      };
    }

    // Step 5: Extract complete JSON between first { and last }
    const completeJson = jsonPortion.substring(0, lastBraceIndex + 1);
    const cleanedText = completeJson.trim();

    // Step 6: Quick validation - ensure it looks like JSON
    if (!cleanedText.startsWith('{') || !cleanedText.endsWith('}')) {
      // Fall back to original text if extraction doesn't look right
      return {
        cleanedText: sanitized.trim(),
        reasoningText,
        method: 'fallback_to_original',
        charactersRemoved: originalLength - sanitized.trim().length
      };
    }

    return {
      cleanedText,
      reasoningText,
      method: 'defensive_json_extraction',
      charactersRemoved: originalLength - cleanedText.length
    };
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

    // Apply OpenRouter-specific defensive sanitization
    const sanitizationResult = this.sanitizeOpenRouterResponse(responseText);
    const { cleanedText, reasoningText, method, charactersRemoved } = sanitizationResult;

    // Debug logging for sanitization
    if (charactersRemoved > 0) {
      logger.service('OpenRouter', `🛡️ Sanitized response: removed ${charactersRemoved} chars using method '${method}'`, 'info');
      if (charactersRemoved > 50) {
        logger.service('OpenRouter', `⚠️ Excessive leading content detected - original: ${responseText.length} chars, cleaned: ${cleanedText.length} chars`, 'warn');
      }
    }

    // Use reasoning from sanitization if available and reasoning capture is enabled
    let extractedReasoningLog: string | undefined;
    if (captureReasoning && reasoningText && reasoningText.length > 10) {
      extractedReasoningLog = reasoningText;
      logger.service('OpenRouter', `📝 Preserved reasoning text: ${reasoningText.length} chars`);
    }

    const parseResult = jsonParser.parse(cleanedText, {
        preserveRawInput: true,
        allowPartialExtraction: true,
        logErrors: true,
        fieldName: `openrouter-${modelKey}`
    });

    if (!parseResult.success) {
        // The raw response is preserved in the fallbackResult object
        logger.service('OpenRouter', `JSON parsing failed for ${modelKey}: ${parseResult.error}`, 'error');
        logger.service('OpenRouter', `Sanitization method used: ${method}, characters removed: ${charactersRemoved}`, 'error');

        // Create a fallback response to preserve raw data and sanitization info
        const fallbackResult = {
            _parseError: parseResult.error,
            _rawResponse: responseText,
            _cleanedResponse: cleanedText,
            _sanitizationMethod: method,
            _charactersRemoved: charactersRemoved,
            _parsingFailed: true,
            solvingStrategy: "JSON parsing failed - raw response preserved",
            patternDescription: "Unable to parse model response",
            hints: [],
            confidence: 0
        };
        return {
            result: fallbackResult,
            tokenUsage: { input: 0, output: 0 },
            reasoningLog: extractedReasoningLog
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

    // Merge reasoning: prioritize extracted reasoning from sanitization, then processedResponse reasoning
    const finalReasoningLog = extractedReasoningLog || processedResponse.reasoningLog;

    if (extractedReasoningLog && processedResponse.reasoningLog) {
      logger.service('OpenRouter', `🔄 Merged reasoning: sanitized (${extractedReasoningLog.length} chars) + processed (${processedResponse.reasoningLog.length} chars)`);
    }

    return {
        result: processedResponse.result,
        tokenUsage: processedResponse.tokenUsage,
        reasoningLog: finalReasoningLog,
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