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
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      // For OpenRouter, reasoning is always included in the prompt.
      const captureReasoning = true;
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

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
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const modelName = getApiModelName(modelKey);
    
    logger.service('OpenRouter', `Making API call to model: ${modelName}`);

    // SIMPLIFIED APPROACH: Single API call with model-specific token limits
    const payload: any = {
      model: modelName,
      messages: [
        {
          role: "system",
          content: prompt.systemPrompt
        },
        {
          role: "user", 
          content: prompt.userPrompt
        }
      ],
      temperature: temperature,
      response_format: { type: "json_object" } as const,
      stream: false // Explicitly disable streaming
    };

    // Only set max_tokens for specific problematic models
    if (modelKey === 'x-ai/grok-4') {
      payload.max_tokens = 120000; // High limit for Grok-4 specifically
      logger.service('OpenRouter', `Setting high token limit for ${modelKey}: ${payload.max_tokens}`);
    }
    // For other models, let them use their natural limits
    
    logger.service('OpenRouter', `API request - model: ${modelName}, max_tokens: ${payload.max_tokens}, streaming: disabled`);

    const rawResponse = await openrouter.chat.completions.create(payload);
    
    // Basic format handling: Normalize the response format
    const response = this.normalizeResponseFormat(rawResponse);
    
    // Extract response metadata
    const completionText = response.choices?.[0]?.message?.content || '';
    const finishReason = response.choices?.[0]?.finish_reason || response.choices?.[0]?.native_finish_reason;
    
    logger.service('OpenRouter', `Response received - finish_reason: ${finishReason}, length: ${completionText.length} chars`);
    
    // Handle empty responses
    if (!completionText || completionText.length === 0) {
      logger.service('OpenRouter', `EMPTY RESPONSE received from ${modelKey}`, 'error');
      throw new Error(`Empty response from ${modelKey}. This may indicate a model configuration or API issue.`);
    }
    
    // Log truncation but don't attempt continuation 
    if (finishReason === 'length') {
      logger.service('OpenRouter', `Response truncated (finish_reason: length) but proceeding with ${completionText.length} chars`, 'warn');
    }
    
    return response;
  }

  /**
   * Detect if response is in streaming format (even if delivered as single object)
   */
  private isStreamingResponse(response: any): boolean {
    // Check for streaming format indicators
    return response.choices?.[0]?.delta || 
           response.object === 'chat.completion.chunk' ||
           response.stream === true ||
           (response.choices?.[0]?.message === undefined && response.choices?.[0]?.delta !== undefined);
  }

  /**
   * Detect if response is truncated (incomplete JSON)
   */
  private isTruncatedResponse(response: any): boolean {
    const content = response.choices?.[0]?.message?.content || '';
    
    // Check for common truncation indicators
    if (!content || content.length === 0) return false;
    
    // Check if JSON content is incomplete
    if (content.includes('{') || content.includes('[')) {
      try {
        JSON.parse(content);
        return false; // Valid JSON
      } catch (error) {
        // Check if it's a truncation error vs other JSON error
        const errorMsg = error instanceof Error ? error.message : String(error);
        return errorMsg.includes('Unexpected end') || 
               errorMsg.includes('Unterminated') ||
               content.trim().endsWith(',') ||
               content.trim().endsWith('{') ||
               content.trim().endsWith('[');
      }
    }
    
    return false;
  }

  /**
   * Normalize different response formats to consistent structure
   */
  private normalizeResponseFormat(response: any): any {
    // Handle streaming format
    if (this.isStreamingResponse(response)) {
      logger.service('OpenRouter', 'Detected streaming response format, normalizing...', 'warn');
      
      const content = response.choices?.[0]?.delta?.content || 
                     response.choices?.[0]?.message?.content || '';
      
      return {
        ...response,
        choices: [{
          ...response.choices?.[0],
          message: {
            content: content,
            role: 'assistant'
          },
          delta: undefined // Clear delta to avoid confusion
        }]
      };
    }
    
    // Handle truncated responses
    if (this.isTruncatedResponse(response)) {
      logger.service('OpenRouter', 'Detected truncated response, attempting recovery...', 'warn');
      
      const content = response.choices?.[0]?.message?.content || '';
      const finishReason = response.choices?.[0]?.finish_reason;
      
      // Mark as truncated for potential continuation
      return {
        ...response,
        choices: [{
          ...response.choices[0],
          finish_reason: finishReason || 'length', // Force continuation trigger
          message: {
            ...response.choices[0].message,
            content: content
          }
        }]
      };
    }
    
    // Standard format - return as-is
    return response;
  }

  /**
   * Robust JSON extraction from potentially malformed content
   */
  private extractJSONFromContent(content: string): any {
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response content');
    }
    
    // Try direct JSON parse first
    try {
      return JSON.parse(content);
    } catch (error) {
      logger.service('OpenRouter', `Initial JSON parse failed, attempting recovery...`, 'warn');
    }
    
    // Try to find and extract JSON from mixed content
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        logger.service('OpenRouter', `JSON extraction failed, trying repair...`, 'warn');
      }
    }
    
    // Try to repair truncated JSON
    let repairedContent = content.trim();
    
    // Add missing closing braces/brackets
    const openBraces = (repairedContent.match(/\{/g) || []).length;
    const closeBraces = (repairedContent.match(/\}/g) || []).length;
    const openBrackets = (repairedContent.match(/\[/g) || []).length;
    const closeBrackets = (repairedContent.match(/\]/g) || []).length;
    
    // Add missing closing characters
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repairedContent += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repairedContent += '}';
    }
    
    // Remove trailing commas that might cause issues
    repairedContent = repairedContent.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      const parsed = JSON.parse(repairedContent);
      logger.service('OpenRouter', `JSON repair successful!`, 'info');
      return parsed;
    } catch (error) {
      logger.service('OpenRouter', `JSON repair failed, returning partial data`, 'error');
      // Return a basic structure with the raw content
      return {
        patternDescription: "Response parsing failed - truncated or malformed JSON",
        solvingStrategy: repairedContent.substring(0, 500) + "...",
        confidence: 10,
        reasoningItems: [`Raw response (first 500 chars): ${repairedContent.substring(0, 500)}`]
      };
    }
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    logger.service('OpenRouter', `Processing response for ${modelKey}`);
    logger.apiResponse('OpenRouter', 'API Response', JSON.stringify(response), 200);
    
    // ROBUST FORMAT HANDLING: Normalize response format first
    const normalizedResponse = this.normalizeResponseFormat(response);
    
    // Extract critical fields from normalized response
    const responseText = normalizedResponse.choices?.[0]?.message?.content || '';
    const finishReason = normalizedResponse.choices?.[0]?.finish_reason || normalizedResponse.choices?.[0]?.native_finish_reason;
    const generationId = normalizedResponse.id;
    
    // Enhanced logging for continuation support
    logger.service('OpenRouter', `Response finish_reason: ${finishReason}`);
    logger.service('OpenRouter', `Response generation_id: ${generationId}`);
    logger.service('OpenRouter', `Response content length: ${responseText.length} chars`);
    
    const isTruncated = this.detectResponseTruncation(responseText, finishReason);
    if (isTruncated) {
      logger.service('OpenRouter', `TRUNCATION DETECTED for ${modelKey} - finish_reason: ${finishReason}`, 'warn');
      logger.service('OpenRouter', `Generation ID for potential continuation: ${generationId}`, 'warn');
      
      // Save truncated response for analysis
      responsePersistence.saveRawResponse(
        modelKey,
        responseText,
        200,
        {
          provider: 'OpenRouter',
          requestId: generationId || 'unknown',
          truncated: true
        }
      );
    }

    try {
      // ROBUST JSON PARSING: Use our enhanced JSON extraction before response processor
      logger.service('OpenRouter', `Validating JSON after potential continuation - length: ${responseText.length} chars`);
      
      // Apply robust JSON extraction to handle truncated/malformed responses
      let parsedJSON;
      try {
        parsedJSON = this.extractJSONFromContent(responseText);
      } catch (jsonError) {
        logger.service('OpenRouter', `JSON extraction failed: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`, 'error');
        throw jsonError;
      }
      
      // Create a normalized response for the response processor
      const robustResponse = {
        ...normalizedResponse,
        choices: [{
          ...normalizedResponse.choices[0],
          message: {
            ...normalizedResponse.choices[0].message,
            content: JSON.stringify(parsedJSON) // Ensure clean JSON string
          }
        }]
      };
      
      // Use unified ResponseProcessor with the cleaned response
      const processedResponse = responseProcessor.processChatCompletion(robustResponse, {
        captureReasoning,
        modelKey,
        provider: 'OpenRouter'
      });

      logger.service('OpenRouter', `JSON parsing successful for ${modelKey} after continuation process`);
      logger.tokenUsage('OpenRouter', modelKey, processedResponse.tokenUsage.input, processedResponse.tokenUsage.output, processedResponse.tokenUsage.reasoning);
      logger.service('OpenRouter', `Result keys: ${Object.keys(processedResponse.result).join(', ')}`);
      
      if (processedResponse.reasoningItems && processedResponse.reasoningItems.length > 0) {
        logger.service('OpenRouter', `Extracted ${processedResponse.reasoningItems.length} reasoning items`);
      }

      return {
        result: processedResponse.result,
        tokenUsage: processedResponse.tokenUsage,
        reasoningLog: processedResponse.reasoningLog,
        reasoningItems: processedResponse.reasoningItems
      };
    } catch (error) {
      // Enhanced error logging for continuation failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.logError(`JSON processing failed for ${modelKey} after continuation`, {
        error: errorMessage,
        context: 'OpenRouter',
        responseLength: responseText.length,
        finishReason: finishReason,
        generationId: generationId,
        wasTruncated: isTruncated
      });
      
      // Save failed response with enhanced metadata for analysis
      responsePersistence.saveRawResponse(
        modelKey,
        responseText,
        200,
        {
          provider: 'OpenRouter',
          requestId: generationId || 'unknown',
          truncated: isTruncated,
          processingError: errorMessage,
          postContinuation: true
        }
      );
      
      logger.service('OpenRouter', `Raw response preserved for debugging: ${responseText.substring(0, 200)}...`, 'error');
      throw new Error(`OpenRouter JSON processing failed for ${modelKey}: ${errorMessage}. Raw response preserved for analysis.`);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelConfig = getModelConfig(modelKey);
    
    if (!modelConfig) {
      logger.service('OpenRouter', `No configuration found for model: ${modelKey}`, 'warn');
      // Return defaults for unknown OpenRouter models - no artificial context window limit
      return {
        name: modelKey,
        isReasoning: false,
        supportsTemperature: true,
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
      supportsTemperature: modelConfig.supportsTemperature || true,
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