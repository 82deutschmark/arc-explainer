/**
 * OpenAI service for analyzing ARC puzzles using OpenAI models
 * Supports reasoning log capture for OpenAI reasoning models (o3-mini, o4-mini, o3-2025-04-16)
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade (original), Claude (refactor)
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
// Default prompt ID to use when none is specified
const DEFAULT_PROMPT_ID = 'solver';
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { ARC_JSON_SCHEMA } from "./schemas/arcJsonSchema.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";

// Import centralized model configuration
import { 
  MODELS as MODEL_CONFIGS, 
  getApiModelName, 
  getModelConfig, 
  modelSupportsTemperature, 
  O3_O4_REASONING_MODELS,
  GPT5_REASONING_MODELS,
  GPT5_CHAT_MODELS,
  MODELS_WITH_REASONING
} from '../config/models/index.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService extends BaseAIService {
  protected provider = "OpenAI";
  protected models = {
    "gpt-4": "gpt-4",
    "gpt-4-turbo": "gpt-4-turbo",
    "o3-mini": "o3-mini",
    "o3-2025-04-16": "o3-2025-04-16",
    "gpt-5-chat-latest": "gpt-5-chat-latest",
    // Add other models as needed
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    promptId: string = DEFAULT_PROMPT_ID,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const modelName = getApiModelName(modelKey);

    // ===== COMPREHENSIVE DEBUG LOGGING PHASE 1 =====
    console.log(`\n🔍 [${this.provider}-DEBUG] ===== ANALYSIS START =====`);
    console.log(`🔍 [${this.provider}-DEBUG] Model: ${modelKey} → API: ${modelName}`);
    console.log(`🔍 [${this.provider}-DEBUG] Temperature: ${temperature}`);
    console.log(`🔍 [${this.provider}-DEBUG] ServiceOpts received:`, JSON.stringify(serviceOpts, null, 2));
    console.log(`🔍 [${this.provider}-DEBUG] GPT-5 Parameters:`);
    console.log(`🔍 [${this.provider}-DEBUG]   reasoningEffort: ${serviceOpts.reasoningEffort}`);
    console.log(`🔍 [${this.provider}-DEBUG]   reasoningVerbosity: ${serviceOpts.reasoningVerbosity}`);
    console.log(`🔍 [${this.provider}-DEBUG]   reasoningSummaryType: ${serviceOpts.reasoningSummaryType}`);
    console.log(`🔍 [${this.provider}-DEBUG]   maxOutputTokens: ${serviceOpts.maxOutputTokens}`);

    // For models with native reasoning, disable reasoning instructions in the prompt
    const usePromptReasoning = !MODELS_WITH_REASONING.has(modelKey);

    // Build prompt package using inherited method
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, usePromptReasoning);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      // Parse response using provider-specific method
      // CRITICAL FIX: Pass captureReasoning=true to enable reasoning extraction
      const { result, tokenUsage, reasoningLog, reasoningItems, status, incomplete, incompleteReason } = 
        this.parseProviderResponse(response, modelKey, true);

      // Validate response completeness
      const completeness = this.validateResponseCompleteness(response, modelKey);
      if (!completeness.isComplete) {
        console.warn(`[${this.provider}] Incomplete response detected for ${modelKey}:`, completeness.suggestion);
      }

      // Build standard response using inherited method
      const finalResponse = this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems,
        status || (completeness.isComplete ? 'complete' : 'incomplete'),
        !completeness.isComplete,
        incompleteReason || completeness.suggestion
      );

      // ===== DEBUG LOGGING PHASE 8: FINAL AI RESPONSE =====
      console.log(`\n🔍 [${this.provider}-DEBUG] ===== FINAL AI RESPONSE =====`);
      console.log(`🔍 [${this.provider}-DEBUG] Final AIResponse object:`);
      console.log(`🔍 [${this.provider}-DEBUG]   model: ${finalResponse.model}`);
      console.log(`🔍 [${this.provider}-DEBUG]   temperature: ${finalResponse.temperature}`);
      console.log(`🔍 [${this.provider}-DEBUG]   reasoningEffort: ${finalResponse.reasoningEffort}`);
      console.log(`🔍 [${this.provider}-DEBUG]   reasoningVerbosity: ${finalResponse.reasoningVerbosity}`);
      console.log(`🔍 [${this.provider}-DEBUG]   reasoningSummaryType: ${finalResponse.reasoningSummaryType}`);
      console.log(`🔍 [${this.provider}-DEBUG]   hasReasoningLog: ${finalResponse.hasReasoningLog}`);
      console.log(`🔍 [${this.provider}-DEBUG]   reasoningItems: ${finalResponse.reasoningItems?.length || 0} items`);
      console.log(`🔍 [${this.provider}-DEBUG]   inputTokens: ${finalResponse.inputTokens}`);
      console.log(`🔍 [${this.provider}-DEBUG]   outputTokens: ${finalResponse.outputTokens}`);
      console.log(`🔍 [${this.provider}-DEBUG]   reasoningTokens: ${finalResponse.reasoningTokens}`);
      console.log(`🔍 [${this.provider}-DEBUG]   totalTokens: ${finalResponse.totalTokens}`);
      console.log(`🔍 [${this.provider}-DEBUG]   estimatedCost: ${finalResponse.estimatedCost}`);
      console.log(`🔍 [${this.provider}-DEBUG] ===== ANALYSIS COMPLETE =====\n`);

      return finalResponse;

    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = getApiModelName(modelKey);
    const isReasoning = MODELS_WITH_REASONING.has(modelKey);
    const modelConfig = getModelConfig(modelKey);
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow || 128000,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: !modelName.includes('gpt-5-chat-latest'),
      supportsVision: false // Update based on actual capabilities
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId: string = DEFAULT_PROMPT_ID,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): PromptPreview {
    const modelName = getApiModelName(modelKey);
    const usePromptReasoning = !MODELS_WITH_REASONING.has(modelKey);
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, usePromptReasoning);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Create message array for preview
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);

    // Get model configuration for max tokens
    const modelConfig = getModelConfig(modelKey);
    const maxTokens = modelConfig?.maxOutputTokens || 128000;

    // Build message format for Responses API
    const messageFormat: any = {
      model: modelName,
      input: messages,
      max_output_tokens: maxTokens,
      ...(isReasoningModel && {
        reasoning: isGPT5Model 
          ? { 
              effort: serviceOpts.reasoningEffort || "medium",
              summary: serviceOpts.reasoningSummaryType || "detailed" 
            }
          : { summary: "detailed" },
        ...(isGPT5Model && {
          text: { verbosity: serviceOpts.reasoningVerbosity || "medium" }
        })
      })
    };

    const providerSpecificNotes = [
      "Uses OpenAI Responses API",
      "Temperature/JSON response_format not used; JSON enforced via prompt",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using structured system prompt for better parsing"
        : "System Prompt Mode: {None} - Old behavior (all content as user message)"
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
    const modelName = getApiModelName(modelKey);
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;

    // Build message array
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    // Build reasoning config based on model type
    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
    const isGPT5ChatModel = GPT5_CHAT_MODELS.has(modelKey);
    const modelConfig = getModelConfig(modelKey);

    // ===== DEBUG LOGGING PHASE 2: REASONING CONFIG =====
    console.log(`\n🔍 [${this.provider}-DEBUG] ===== REASONING CONFIG BUILD =====`);
    console.log(`🔍 [${this.provider}-DEBUG] Model Classifications:`);
    console.log(`🔍 [${this.provider}-DEBUG]   isReasoningModel: ${isReasoningModel}`);
    console.log(`🔍 [${this.provider}-DEBUG]   isGPT5Model: ${isGPT5Model}`);
    console.log(`🔍 [${this.provider}-DEBUG]   isO3O4Model: ${isO3O4Model}`);
    console.log(`🔍 [${this.provider}-DEBUG]   isGPT5ChatModel: ${isGPT5ChatModel}`);

    let reasoningConfig = undefined;
    let textConfig = undefined;
    
    if (isReasoningModel) {
      if (isGPT5Model) {
        reasoningConfig = {
          effort: serviceOpts.reasoningEffort || 'low',
          summary: serviceOpts.reasoningSummaryType || serviceOpts.reasoningSummary || 'detailed'
        };
        textConfig = {
          verbosity: serviceOpts.reasoningVerbosity || 'high'
        };
        console.log(`🔍 [${this.provider}-DEBUG] GPT-5 reasoningConfig built:`, JSON.stringify(reasoningConfig, null, 2));
        console.log(`🔍 [${this.provider}-DEBUG] GPT-5 textConfig built:`, JSON.stringify(textConfig, null, 2));
      } else if (isO3O4Model) {
        reasoningConfig = {
          summary: serviceOpts.reasoningSummary || 'auto'
        };
        console.log(`🔍 [${this.provider}-DEBUG] O3/O4 reasoningConfig built:`, JSON.stringify(reasoningConfig, null, 2));
      }
    } else {
      console.log(`🔍 [${this.provider}-DEBUG] Non-reasoning model - no reasoning config`);
    }

    const request = {
      model: modelName,
      input: messages,
      reasoning: reasoningConfig,
      ...(textConfig && { text: textConfig }),
      max_steps: serviceOpts.maxSteps,
      previous_response_id: serviceOpts.previousResponseId,
      ...(modelSupportsTemperature(modelKey) && {
        temperature: temperature || 0.2,
        ...(isGPT5ChatModel && { top_p: 1.00 })
      }),
      max_output_tokens: serviceOpts.maxOutputTokens || modelConfig?.maxOutputTokens || (isGPT5ChatModel ? 100000 : undefined),
    };

    // ===== DEBUG LOGGING PHASE 3: API REQUEST =====
    console.log(`\n🔍 [${this.provider}-DEBUG] ===== API REQUEST BUILD =====`);
    console.log(`🔍 [${this.provider}-DEBUG] Final API request:`, JSON.stringify(request, null, 2));
    console.log(`🔍 [${this.provider}-DEBUG] Request includes reasoning config: ${!!request.reasoning}`);
    console.log(`🔍 [${this.provider}-DEBUG] Request includes text config: ${!!request.text}`);
    console.log(`🔍 [${this.provider}-DEBUG] Max output tokens: ${request.max_output_tokens}`);
    console.log(`🔍 [${this.provider}-DEBUG] Temperature: ${request.temperature || 'not set'}`);
    console.log(`🔍 [${this.provider}-DEBUG] About to call callResponsesAPI...`);

    // Retry logic with exponential backoff
    const maxRetries = Math.max(0, serviceOpts.maxRetries ?? 2);
    let lastErr: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.callResponsesAPI(request, modelKey);
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(`[${this.provider}] API call failed (attempt ${attempt + 1}/${maxRetries + 1}). Backing off ${backoffMs}ms`);
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }
    
    throw lastErr || new Error('API call failed after retries');
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean = false
  ): {
    result: any;
    tokenUsage: TokenUsage;
    reasoningLog?: any;
    reasoningItems?: any[];
    status?: string;
    incomplete?: boolean;
    incompleteReason?: string;
  } {
    // ===== DEBUG LOGGING PHASE 6: RESPONSE PARSING =====
    console.log(`\n🔍 [${this.provider}-PARSE-DEBUG] ===== RESPONSE PARSING START =====`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] Model: ${modelKey}`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] Capture reasoning: ${captureReasoning}`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] Response structure:`, {
      hasOutputParsed: !!response.output_parsed,
      hasOutputText: !!response.output_text,
      hasOutput: !!response.output && Array.isArray(response.output),
      outputCount: response.output?.length || 0,
      hasOutputReasoning: !!response.output_reasoning,
      reasoningItemsCount: response.output_reasoning?.items?.length || 0,
      reasoningSummaryType: typeof response.output_reasoning?.summary
    });

    let result: any = {};
    let reasoningLog = null;
    let reasoningItems: any[] = [];

    // GPT-5-nano returns clean structured data in different fields
    if (response.output_parsed) {
      result = response.output_parsed;
    } else if (response.output_text) {
      result = JSON.parse(response.output_text);
    } else if (response.output && Array.isArray(response.output) && response.output.length > 0) {
      // GPT-5-nano returns structured data in output array
      const outputBlock = response.output[0];
      if (outputBlock.type === 'text' && outputBlock.text) {
        result = JSON.parse(outputBlock.text);
      } else {
        console.error(`[${this.provider}] Unexpected output format:`, outputBlock);
        result = {};
      }
    } else {
      console.error(`[${this.provider}] No structured output found in response`);
      result = {};
    }

    // Extract reasoning log from API response
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] Starting reasoning log extraction...`);
    if (captureReasoning && response.output_reasoning?.summary) {
      const summary = response.output_reasoning.summary;
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] Found summary, type: ${typeof summary}, isArray: ${Array.isArray(summary)}`);
      
      if (Array.isArray(summary)) {
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Processing summary array with ${summary.length} items`);
        reasoningLog = summary.map((s: any) => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object' && s.text) return s.text;
          if (s && typeof s === 'object' && s.content) return s.content;
          return typeof s === 'object' ? JSON.stringify(s) : String(s);
        }).filter(Boolean).join('\n\n');
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Processed array summary into ${reasoningLog ? reasoningLog.length : 0} char string`);
      } else if (typeof summary === 'string') {
        reasoningLog = summary;
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Used string summary directly: ${reasoningLog.length} chars`);
      } else if (summary && typeof summary === 'object') {
        // Handle object summary (this was the missing case causing [object Object])
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Found object summary, attempting to extract content`);
        if (summary.text) {
          reasoningLog = summary.text;
          console.log(`🔍 [${this.provider}-PARSE-DEBUG] Extracted summary.text: ${reasoningLog.length} chars`);
        } else if (summary.content) {
          reasoningLog = summary.content;
          console.log(`🔍 [${this.provider}-PARSE-DEBUG] Extracted summary.content: ${reasoningLog.length} chars`);
        } else {
          reasoningLog = JSON.stringify(summary, null, 2);
          console.log(`🔍 [${this.provider}-PARSE-DEBUG] JSON stringified object summary: ${reasoningLog.length} chars`);
        }
      }
    } else {
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] No reasoning log: captureReasoning=${captureReasoning}, hasSummary=${!!response.output_reasoning?.summary}`);
    }

    // Extract reasoning items and convert them to an array of strings
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] Starting reasoning items extraction...`);
    if (response.output_reasoning?.items && Array.isArray(response.output_reasoning.items)) {
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] Found reasoning items array with ${response.output_reasoning.items.length} items`);
      reasoningItems = response.output_reasoning.items.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return JSON.stringify(item);
      });
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] Processed reasoning items: ${reasoningItems.length} final items`);
      if (reasoningItems.length > 0) {
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] First reasoning item preview: ${reasoningItems[0]?.substring(0, 100)}...`);
      }
    } else {
      reasoningItems = [];
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] No reasoning items found`);
    }

    // Validate reasoning data types and fix corruption
    if (reasoningLog && typeof reasoningLog !== 'string') {
      console.error(`[${this.provider}] WARNING: reasoningLog is not a string! Type: ${typeof reasoningLog}`, reasoningLog);
      // Use JSON.stringify instead of String() to avoid "[object Object]" corruption
      try {
        reasoningLog = JSON.stringify(reasoningLog, null, 2);
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Converted reasoningLog object to JSON string: ${reasoningLog.length} chars`);
      } catch (error) {
        console.error(`[${this.provider}] Failed to stringify reasoningLog object:`, error);
        reasoningLog = null;
      }
    }
    
    if (reasoningItems && !Array.isArray(reasoningItems)) {
      console.error(`[${this.provider}] WARNING: reasoningItems is not an array! Type: ${typeof reasoningItems}`, reasoningItems);
      reasoningItems = [];
    }

    // Fallback: If reasoningLog is empty but we have reasoningItems, create a readable log
    if (!reasoningLog && reasoningItems && reasoningItems.length > 0) {
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] Creating fallback reasoningLog from ${reasoningItems.length} reasoning items`);
      reasoningLog = reasoningItems
        .filter(item => item && typeof item === 'string' && item.trim().length > 0)
        .map((item, index) => `Step ${index + 1}: ${item}`)
        .join('\n\n');
      
      if (reasoningLog && reasoningLog.length > 0) {
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Generated fallback reasoningLog: ${reasoningLog.length} chars`);
      } else {
        reasoningLog = null;
        console.log(`🔍 [${this.provider}-PARSE-DEBUG] Failed to generate fallback reasoningLog - no valid string items`);
      }
    }

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.tokenUsage?.input || 0,
      output: response.tokenUsage?.output || 0,
      reasoning: response.tokenUsage?.reasoning
    };

    // Check for incomplete responses
    const status = response.status;
    const incomplete = status === 'incomplete';
    const incompleteReason = response.incomplete_details?.reason;

    // ===== DEBUG LOGGING PHASE 7: FINAL PARSE RESULT =====
    console.log(`\n🔍 [${this.provider}-PARSE-DEBUG] ===== PARSE RESULT SUMMARY =====`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] Final parsing results:`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   result keys: [${Object.keys(result).join(', ')}]`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   tokenUsage:`, JSON.stringify(tokenUsage, null, 2));
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   reasoningLog: ${reasoningLog ? `${reasoningLog.length} chars` : 'null'}`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   reasoningItems: ${reasoningItems.length} items`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   status: ${status}`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   incomplete: ${incomplete}`);
    console.log(`🔍 [${this.provider}-PARSE-DEBUG]   incompleteReason: ${incompleteReason}`);
    
    if (reasoningLog) {
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] Reasoning log preview: ${reasoningLog.substring(0, 200)}...`);
    }
    
    if (reasoningItems.length > 0) {
      console.log(`🔍 [${this.provider}-PARSE-DEBUG] Reasoning items preview:`, reasoningItems.slice(0, 3));
    }
    console.log(`🔍 [${this.provider}-PARSE-DEBUG] ===== PARSE COMPLETE =====\n`);

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status,
      incomplete,
      incompleteReason
    };
  }

  private async callResponsesAPI(request: any, modelKey: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // ===== DEBUG LOGGING PHASE 4: API CALL =====
    console.log(`\n🔍 [${this.provider}-RESPONSES-DEBUG] ===== API CALL START =====`);
    console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Making Responses API call:`, {
      model: request.model,
      maxSteps: request.max_steps,
      hasPreviousId: !!request.previous_response_id,
      maxOutputTokens: request.max_output_tokens ?? 'default'
    });
    console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Request has reasoning config:`, !!request.reasoning);
    console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Reasoning config:`, JSON.stringify(request.reasoning, null, 2));
    console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Request has text config:`, !!request.text);
    console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Text config:`, JSON.stringify(request.text, null, 2));

    try {
      // Check if model supports structured JSON schema
      const supportsStructuredOutput = !request.model.includes('gpt-5-chat-latest') && 
                                       !request.model.includes('gpt-5-nano');
      
      // Prepare the request for OpenAI's Responses API
      const body = {
        model: request.model,
        input: Array.isArray(request.input) ? request.input : [{ role: "user", content: request.input }],
        ...(supportsStructuredOutput && {
          text: {
            format: {
              type: "json_schema",
              name: ARC_JSON_SCHEMA.name,
              strict: ARC_JSON_SCHEMA.strict,
              schema: ARC_JSON_SCHEMA.schema
            }
          }
        }),
        reasoning: request.reasoning,
        temperature: modelSupportsTemperature(modelKey) ? request.temperature : undefined,
        top_p: modelSupportsTemperature(modelKey) ? 1 : undefined,
        parallel_tool_calls: false,
        truncation: "auto",
        previous_response_id: request.previous_response_id,
        max_output_tokens: Math.max(256, request.max_output_tokens ?? getModelConfig(modelKey)?.maxOutputTokens ?? 128000),
        store: request.store !== false // Default to true unless explicitly set to false
      };

      // Make the API call with 45-minute timeout
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2700000) // 45 minutes timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${this.provider}-RESPONSES-DEBUG] API Error:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      // ===== DEBUG LOGGING PHASE 5: API RESPONSE =====
      console.log(`\n🔍 [${this.provider}-RESPONSES-DEBUG] ===== API RESPONSE RECEIVED =====`);
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Raw API response keys:`, Object.keys(result));
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Response ID: ${result.id}`);
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Response status: ${result.status}`);
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Has output_reasoning: ${!!result.output_reasoning}`);
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Has output_text: ${!!result.output_text}`);
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Has output array: ${!!result.output}`);
      
      if (result.output_reasoning) {
        console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] output_reasoning structure:`, JSON.stringify(result.output_reasoning, null, 2));
        console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] output_reasoning.items count: ${result.output_reasoning.items?.length || 0}`);
        console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] output_reasoning.summary exists: ${!!result.output_reasoning.summary}`);
      }
      
      if (result.usage) {
        console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Token usage:`, JSON.stringify(result.usage, null, 2));
      }
      
      // Extract token usage from OpenAI Responses API response
      let tokenUsage: TokenUsage = { input: 0, output: 0 };
      let cost: any = undefined;
      
      if (result.usage) {
        const inputTokens = result.usage.input_tokens ?? 0;
        const outputTokens = result.usage.output_tokens ?? 0;
        const reasoningTokens = result.usage.output_tokens_details?.reasoning_tokens ?? 0;
        
        tokenUsage = {
          input: inputTokens,
          output: outputTokens,
          reasoning: reasoningTokens > 0 ? reasoningTokens : undefined
        };

        console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Extracted token usage:`, JSON.stringify(tokenUsage, null, 2));

        // Calculate cost using inherited method
        cost = this.calculateResponseCost(modelKey, tokenUsage);
        console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Calculated cost:`, cost);
      }
      
      console.log(`🔍 [${this.provider}-RESPONSES-DEBUG] Summary - API Response analysis:`, {
        id: result.id,
        status: result.status,
        hasOutputReasoning: !!result.output_reasoning,
        hasOutputText: !!result.output_text,
        hasOutput: !!result.output,
        reasoningItemsCount: result.output_reasoning?.items?.length || 0,
        incompleteDetails: result.incomplete_details
      });

      // Enhanced response parsing with incomplete status handling
      const parsedResponse = {
        id: result.id,
        status: result.status, // Include status for incomplete response handling
        incomplete_details: result.incomplete_details, // Include incomplete details
        output_text: result.output_text || this.extractTextFromOutputBlocks(result.output),
        output_parsed: result.output_parsed,
        output_reasoning: {
          summary: result.output_reasoning?.summary || this.extractReasoningFromOutputBlocks(result.output),
          items: result.output_reasoning?.items || []
        },
        raw_response: result,
        usage: result.usage,
        tokenUsage,
        cost
      };

      return parsedResponse;

    } catch (error) {
      console.error(`[${this.provider}-RESPONSES-DEBUG] Error calling Responses API:`, error);
      throw error;
    }
  }

  // Helper methods extracted from original implementation
  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) {
      return '';
    }
    
    // Look for Assistant blocks first
    const assistantBlock = output.find(block => 
      block.type === 'Assistant' || block.role === 'assistant'
    );
    
    if (assistantBlock) {
      if (Array.isArray(assistantBlock.content)) {
        const textContent = assistantBlock.content.find((c: any) => 
          c.type === 'text' || c.type === 'output_text'
        );
        if (textContent?.text) return textContent.text;
      }
      if (typeof assistantBlock.content === 'string') return assistantBlock.content;
      if (assistantBlock.text) return assistantBlock.text;
    }
    
    // Look for other message blocks
    for (const block of output) {
      if (block.type === 'message' && block.content) {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => 
            c.type === 'text' || c.type === 'output_text'
          );
          if (textContent?.text) return textContent.text;
        }
        if (typeof block.content === 'string') return block.content;
      }
      
      if (block.type === 'text' && block.text) return block.text;
    }
    
    // Fallback: join all text-like content
    return output
      .filter(block => block.content || block.text)
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => 
            c.type === 'text' || c.type === 'output_text'
          );
          return textContent?.text || '';
        }
        
        // CRITICAL FIX: Properly handle object values instead of returning them directly
        const candidates = [block.content, block.text];
        for (const candidate of candidates) {
          if (typeof candidate === 'string') {
            return candidate;
          } else if (candidate && typeof candidate === 'object') {
            // Extract text from common object patterns
            if (candidate.text) return candidate.text;
            if (candidate.content) return candidate.content;
            if (candidate.message) return candidate.message;
            // Last resort: JSON stringify instead of allowing [object Object]
            return JSON.stringify(candidate);
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  private extractReasoningFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) return '';
    
    const reasoningBlocks = output.filter(block => 
      block.type === 'reasoning' || 
      block.type === 'Reasoning' ||
      (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
    );
    
    const reasoningText = reasoningBlocks
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || '';
        }
        
        // CRITICAL FIX: Properly handle object values instead of returning them directly
        const candidates = [block.content, block.text, block.summary];
        for (const candidate of candidates) {
          if (typeof candidate === 'string') {
            return candidate;
          } else if (candidate && typeof candidate === 'object') {
            // Extract text from common object patterns
            if (candidate.text) return candidate.text;
            if (candidate.content) return candidate.content;
            if (candidate.message) return candidate.message;
            // Last resort: JSON stringify instead of allowing [object Object]
            return JSON.stringify(candidate);
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    
    if (!reasoningText || 
        reasoningText.toLowerCase().includes('empty reasoning') ||
        reasoningText.trim() === '') {
      return '';
    }
    
    return reasoningText;
  }
}

export const openaiService = new OpenAIService();