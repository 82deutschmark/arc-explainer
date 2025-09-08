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

  /**
   * Validate generation recovery using OpenRouter's generation endpoint
   * Used for diagnostics and confirming truncation recovery works
   */
  async validateGeneration(generationId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      logger.service('OpenRouter', `Validating generation: ${generationId}`);
      
      const response = await fetch(`https://openrouter.ai/api/v1/generation/${generationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://arc.markbarney.net',
          'X-Title': 'ARC Explainer'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.service('OpenRouter', `Generation validation failed: ${response.status} - ${errorText}`, 'error');
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}` 
        };
      }

      const data = await response.json();
      logger.service('OpenRouter', `Generation validation successful for ${generationId}`);
      
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.service('OpenRouter', `Generation validation error: ${errorMessage}`, 'error');
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Continue a truncated generation using OpenRouter's continue parameter
   * This is the core method for handling length-based truncation
   */
  async continueGeneration(
    modelKey: string, 
    generationId: string, 
    step: number
  ): Promise<any> {
    try {
      const modelName = getApiModelName(modelKey);
      logger.service('OpenRouter', `Continuing generation ${generationId} (step ${step}) for model: ${modelName}`);

      const continuePayload = {
        model: modelName,
        messages: [], // Usually empty for continue calls
        continue: {
          generation_id: generationId,
          step: step
        },
        response_format: { type: "json_object" }
      };

      logger.service('OpenRouter', `Continue payload: ${JSON.stringify(continuePayload)}`);

      const chatCompletion = await openrouter.chat.completions.create(continuePayload);
      
      logger.service('OpenRouter', `Continue response received for step ${step}`);
      return chatCompletion;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.service('OpenRouter', `Continue generation failed for ${generationId} step ${step}: ${errorMessage}`, 'error');
      throw error;
    }
  }

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
    return this.callProviderAPIRecursive(prompt, modelKey, temperature, serviceOpts, 0, null);
  }

  /**
   * Recursive API call that handles automatic continuation for truncated responses
   * Implements the core logic from the truncation fix plan
   */
  private async callProviderAPIRecursive(
    prompt: PromptPackage,
    modelKey: string, 
    temperature: number,
    serviceOpts: ServiceOptions,
    step: number = 0,
    previousGenerationId: string | null = null
  ): Promise<any> {
    const modelName = getApiModelName(modelKey);
    
    logger.service('OpenRouter', `Making API call to model: ${modelName} (step ${step})`);

    let payload: any;
    
    if (previousGenerationId) {
      // This is a continuation call - use ONLY continue parameter, no messages
      payload = {
        model: modelName,
        continue: {
          generation_id: previousGenerationId,
          step: step
        },
        response_format: { type: "json_object" } as const,
        temperature: temperature
      } as any; // OpenRouter-specific continue parameter not in OpenAI SDK types
      logger.service('OpenRouter', `Continuing generation ${previousGenerationId} at step ${step} (continue-only format)`);
    } else {
      // This is the initial call
      payload = {
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
        response_format: { type: "json_object" } as const
      };
      logger.service('OpenRouter', `Initial API call to model: ${modelName}`);
    }

    const response = await openrouter.chat.completions.create(payload);
    
    // Extract response metadata
    const completionText = response.choices?.[0]?.message?.content || '';
    const generationId = response.id;
    const finishReason = response.choices?.[0]?.finish_reason || response.choices?.[0]?.native_finish_reason;
    
    logger.service('OpenRouter', `Response received - finish_reason: ${finishReason}, length: ${completionText.length} chars`);
    
    // Check if the response was truncated due to length limit
    if (finishReason === 'length') {
      logger.service('OpenRouter', `Truncation detected (finish_reason: length) - continuing generation ${generationId}`, 'warn');
      
      // Recursively call to continue the generation
      const continuedResponse = await this.callProviderAPIRecursive(
        prompt, 
        modelKey, 
        temperature, 
        serviceOpts, 
        step + 1, 
        generationId
      );
      
      // Combine the responses - merge the content fields
      const continuedText = continuedResponse.choices?.[0]?.message?.content || '';
      
      // Create combined response preserving the structure but merging content
      const combinedResponse = {
        ...response,
        choices: [{
          ...response.choices[0],
          message: {
            ...response.choices[0].message,
            content: completionText + continuedText
          },
          finish_reason: continuedResponse.choices?.[0]?.finish_reason || 'stop'
        }],
        // Merge usage stats if available
        usage: {
          prompt_tokens: (response.usage?.prompt_tokens || 0) + (continuedResponse.usage?.prompt_tokens || 0),
          completion_tokens: (response.usage?.completion_tokens || 0) + (continuedResponse.usage?.completion_tokens || 0),
          total_tokens: (response.usage?.total_tokens || 0) + (continuedResponse.usage?.total_tokens || 0),
          reasoning_tokens: ((response.usage as any)?.reasoning_tokens || 0) + ((continuedResponse.usage as any)?.reasoning_tokens || 0)
        }
      };
      
      logger.service('OpenRouter', `Combined response: ${combinedResponse.choices[0].message.content.length} chars total`);
      return combinedResponse;
    } else {
      // Response completed normally, return as-is
      logger.service('OpenRouter', `Response completed normally with finish_reason: ${finishReason}`);
      return response;
    }
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    logger.service('OpenRouter', `Processing response for ${modelKey}`);
    logger.apiResponse('OpenRouter', 'API Response', JSON.stringify(response), 200);
    
    // Extract critical fields for continuation
    const responseText = response.choices?.[0]?.message?.content || '';
    const finishReason = response.choices?.[0]?.finish_reason || response.choices?.[0]?.native_finish_reason;
    const generationId = response.id;
    
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
      // Enhanced JSON validation after continuation completion
      logger.service('OpenRouter', `Validating JSON after potential continuation - length: ${responseText.length} chars`);
      
      // Use unified ResponseProcessor with enhanced error context
      const processedResponse = responseProcessor.processChatCompletion(response, {
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