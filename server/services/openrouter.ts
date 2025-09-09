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

    // CONTINUATION SUPPORT: Accumulate response across multiple API calls if truncated
    let fullResponseText = '';
    let generationId: string | null = null;
    let continuationStep = 0;
    let isComplete = false;
    let finalUsage: any = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const maxContinuations = 5; // Prevent infinite loops
    
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
        
        // Only set max_tokens for specific problematic models
        if (modelKey === 'x-ai/grok-4') {
          payload.max_tokens = 120000; // High limit for Grok-4 specifically
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
    
    // Validate JSON structure of complete response
    try {
      JSON.parse(fullResponseText);
      logger.service('OpenRouter', `Final response contains valid JSON structure`);
    } catch (error) {
      logger.service('OpenRouter', `Final response contains malformed JSON - will attempt repair: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn');
    }
    
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
   * Enhanced JSON extraction with better partial content handling
   */
  private extractJSONFromContent(content: string): any {
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response content');
    }
    
    // Try direct JSON parse first
    try {
      return JSON.parse(content);
    } catch (error) {
      logger.service('OpenRouter', `Initial JSON parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn');
    }
    
    // Try to find and extract JSON from mixed content (handles markdown code blocks, etc.)
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        logger.service('OpenRouter', `JSON extraction failed, trying advanced repair...`, 'warn');
      }
    }
    
    // Advanced JSON repair for partial responses
    let repairedContent = content.trim();
    
    // Remove any surrounding markdown code blocks
    repairedContent = repairedContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    
    // Handle incomplete JSON structures
    if (repairedContent.includes('{') || repairedContent.includes('[')) {
      // Count unmatched braces and brackets
      const openBraces = (repairedContent.match(/\{/g) || []).length;
      const closeBraces = (repairedContent.match(/\}/g) || []).length;
      const openBrackets = (repairedContent.match(/\[/g) || []).length;
      const closeBrackets = (repairedContent.match(/\]/g) || []).length;
      
      // Remove trailing incomplete structures (common in truncated responses)
      repairedContent = repairedContent.replace(/,\s*$/, ''); // trailing comma
      repairedContent = repairedContent.replace(/:\s*$/, ': null'); // incomplete key-value
      repairedContent = repairedContent.replace(/"\s*$/, '"'); // incomplete string
      
      // Add missing closing characters in correct order
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repairedContent += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repairedContent += '}';
      }
      
      // Clean up common JSON formatting issues
      repairedContent = repairedContent.replace(/,(\s*[}\]])/g, '$1'); // trailing commas
      repairedContent = repairedContent.replace(/([{,]\s*)"([^"]+)"\s*:\s*"([^"]*)"(?=\s*[,}])/g, '$1"$2": "$3"'); // fix spacing
      
      try {
        const parsed = JSON.parse(repairedContent);
        logger.service('OpenRouter', `Advanced JSON repair successful! Recovered ${JSON.stringify(parsed).length} chars`, 'info');
        return parsed;
      } catch (error) {
        logger.service('OpenRouter', `Advanced JSON repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn');
      }
    }
    
    // Try to extract partial data for common response fields
    const partialData = this.extractPartialResponseData(content);
    if (partialData && Object.keys(partialData).length > 0) {
      logger.service('OpenRouter', `Extracted partial data from malformed response: ${Object.keys(partialData).join(', ')}`, 'warn');
      return partialData;
    }
    
    // Final fallback - return structured error with content preview
    logger.service('OpenRouter', `All JSON repair attempts failed, returning error structure`, 'error');
    return {
      multiplePredictedOutputs: false,
      predictedOutput: [],
      predictedOutput1: [],
      predictedOutput2: [],
      predictedOutput3: [],
      patternDescription: "JSON parsing failed - response may be truncated or malformed",
      solvingStrategy: `Unable to parse response. Content preview: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`,
      hints: [
        "Response parsing failed due to malformed JSON",
        "This may indicate model output truncation or formatting issues",
        "Consider retrying with the same model or trying a different model"
      ],
      confidence: 5,
      reasoningItems: [
        `Raw response length: ${content.length} characters`,
        `Content preview: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`,
        "Response structure could not be parsed - may need manual review"
      ]
    };
  }

  /**
   * Extract partial data from malformed responses using regex patterns
   */
  private extractPartialResponseData(content: string): any | null {
    const partialData: any = {
      multiplePredictedOutputs: false,
      predictedOutput: [],
      predictedOutput1: [],
      predictedOutput2: [],
      predictedOutput3: []
    };
    
    try {
      // Try to extract key fields using regex patterns
      const patterns = {
        patternDescription: /"patternDescription"\s*:\s*"([^"]+)"/,
        solvingStrategy: /"solvingStrategy"\s*:\s*"([^"]+)"/,
        confidence: /"confidence"\s*:\s*(\d+)/,
        multiplePredictedOutputs: /"multiplePredictedOutputs"\s*:\s*(true|false)/
      };
      
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = content.match(pattern);
        if (match) {
          if (key === 'confidence') {
            partialData[key] = parseInt(match[1], 10);
          } else if (key === 'multiplePredictedOutputs') {
            partialData[key] = match[1] === 'true';
          } else {
            partialData[key] = match[1];
          }
        }
      }
      
      // Try to extract hints array
      const hintsMatch = content.match(/"hints"\s*:\s*\[([^\]]*)\]/);
      if (hintsMatch) {
        try {
          partialData.hints = JSON.parse(`[${hintsMatch[1]}]`);
        } catch {
          partialData.hints = ["Unable to parse hints from partial response"];
        }
      }
      
      return Object.keys(partialData).length > 4 ? partialData : null; // Only return if we found some data
    } catch (error) {
      logger.service('OpenRouter', `Partial data extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn');
      return null;
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
      // Note: Continuation logic is now handled in callProviderAPI, this should not happen
      logger.service('OpenRouter', `WARNING: Truncation detected after continuation logic - this indicates a problem`, 'error');
    }

    try {
      // ROBUST JSON PARSING: Use our enhanced JSON extraction before response processor
      logger.service('OpenRouter', `Validating JSON after potential continuation - length: ${responseText.length} chars`);
      
      // Apply robust JSON extraction to handle truncated/malformed responses
      let parsedJSON;
      let jsonExtractionFailed = false;
      try {
        parsedJSON = this.extractJSONFromContent(responseText);
      } catch (jsonError) {
        logger.service('OpenRouter', `JSON extraction failed: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`, 'error');
        jsonExtractionFailed = true;
        
        // CRITICAL: Don't throw - create fallback response to preserve raw data
        parsedJSON = {
          _parseError: jsonError instanceof Error ? jsonError.message : String(jsonError),
          _rawResponse: responseText,
          _parsingFailed: true,
          _fallbackResponse: true,
          solvingStrategy: "JSON parsing failed - raw response preserved",
          patternDescription: "Unable to parse model response",
          hints: [],
          confidence: 0
        };
        
        logger.service('OpenRouter', `Created fallback response to preserve ${responseText.length} chars of raw data`, 'warn');
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
        metadata: {
          responseLength: responseText.length,
          finishReason: finishReason,
          generationId: generationId,
          wasTruncated: isTruncated
        }
      });
      
      // Note: Raw response is already saved by puzzleAnalysisService.saveRawLog()
      // Only log the error, don't duplicate file saves
      logger.service('OpenRouter', `JSON processing failed, raw response length: ${responseText.length} chars`, 'error');
      logger.service('OpenRouter', `Response preview for debugging: ${responseText.substring(0, 200)}...`, 'error');
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