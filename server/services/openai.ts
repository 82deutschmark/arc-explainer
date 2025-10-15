/**
 * @file server/services/openai.ts
 * @description OpenAI Service for ARC Puzzle Analysis
 *
 * This service interfaces with the OpenAI API, specifically using the 'Responses API' endpoint
 * for advanced, multi-step reasoning tasks. It is responsible for:
 *  - Constructing prompts tailored for OpenAI models.
 *  - Invoking the API with appropriate parameters for standard and reasoning models (e.g., GPT-5, o4-mini).
 *  - Parsing the structured response, including the primary JSON output and any accompanying reasoning logs.
 *  - Extending the BaseAIService to standardize the analysis workflow.
 *
 * @assessed_by Gemini 2.5 Pro
 * @assessed_on 2025-09-09
 */

import OpenAI, { APIUserAbortError } from "openai";
import { Agent, request as undiciRequest } from "undici";
import { ARCTask } from "../../shared/types.js";
// Default prompt ID to use when none is specified
const DEFAULT_PROMPT_ID = 'solver';
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { getOpenAISchema } from "./schemas/providers/openai.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo, StreamingHarness } from "./base/BaseAIService.js";
import type {
  ResponseStreamEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseReasoningSummaryPartAddedEvent,
  ResponseContentPartAddedEvent
} from "openai/resources/responses/responses";

type OpenAIStreamAggregates = {
  text: string;
  parsed: string;  // Structured JSON output (output_parsed.delta)
  reasoning: string;
  summary: string;
  refusal: string;
  reasoningSummary?: string;  // Added for reasoning summary accumulation
};

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

/**
 * Model name normalization mapping
 * Maps short/alias names to full versioned model names
 */
const MODEL_ALIASES: Record<string, string> = {
  "gpt-5": "gpt-5-2025-08-07",
  "gpt-5-mini": "gpt-5-mini-2025-08-07",
  "gpt-5-nano": "gpt-5-nano-2025-08-07",
};

/**
 * Normalize model key to full versioned name
 * Falls back to getApiModelName() for non-aliased models
 */
function normalizeModelKey(modelKey: string): string {
  return MODEL_ALIASES[modelKey] || getApiModelName(modelKey);
}

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

  /**
   * Override to provide OpenAI-specific schema for structured output
   * Returns dynamic schema based on test count
   */
  protected getSchemaForModel(modelKey: string, testCount: number): any | null {
    if (this.supportsStructuredOutput(modelKey)) {
      return getOpenAISchema(testCount);
    }
    return null;
  }

  supportsStreaming(modelKey: string): boolean {
    // Support both full versioned names and shortened aliases
    const streamingModels = [
      "gpt-5-2025-08-07",
      "gpt-5-mini-2025-08-07",
      "gpt-5-nano-2025-08-07",
      "gpt-5-chat-latest"
    ];

    // Check exact match first
    if (streamingModels.includes(modelKey)) {
      return true;
    }

    // Check if modelKey is a shortened version (without date suffix)
    // e.g., "gpt-5-mini" should match "gpt-5-mini-2025-08-07"
    return streamingModels.some(fullKey => fullKey.startsWith(modelKey + "-"));
  }

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId: string = DEFAULT_PROMPT_ID,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const modelName = getApiModelName(modelKey);


    // Build prompt package using inherited method
    // PHASE 12: Pass modelKey for structured output detection
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    // Extract test count for dynamic schema generation
    const testCount = task.test.length;

    try {
      // Call provider-specific API
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, testCount, taskId);
      
      // Parse response using provider-specific method
      // CRITICAL FIX: Pass captureReasoning=true to enable reasoning extraction
      const { result, tokenUsage, reasoningLog, reasoningItems, status, incomplete, incompleteReason, responseId } = 
        this.parseProviderResponse(response, modelKey, true, taskId);

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
        incompleteReason || completeness.suggestion,
        promptPackage,
        promptId,
        customPrompt,
        responseId
      );


      return finalResponse;

    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }


  async analyzePuzzleWithStreaming(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId: string = DEFAULT_PROMPT_ID,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    if (!this.supportsStreaming(modelKey)) {
      return super.analyzePuzzleWithStreaming(
        task,
        modelKey,
        taskId,
        temperature,
        promptId,
        customPrompt,
        options,
        serviceOpts
      );
    }

    // PHASE 12: Pass modelKey for structured output detection
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    const harness = serviceOpts.stream;
    const controller = this.registerStream(harness);
    const startedAt = Date.now();

    try {
      const testCount = task.test.length;
      const { body } = this.buildResponsesAPIPayload(
        promptPackage,
        modelKey,
        temperature,
        serviceOpts,
        testCount,
        taskId
      );

      this.emitStreamEvent(harness, "stream.status", { state: "requested" });

      const stream = openai.responses.stream(
        { ...body, stream: true },
        { signal: controller?.signal }
      );

      const aggregates: OpenAIStreamAggregates = {
        text: "",
        parsed: "",  // Accumulates structured JSON output
        reasoning: "",
        summary: "",
        refusal: ""
      };

      for await (const event of stream as AsyncIterable<ResponseStreamEvent>) {
        this.handleStreamingEvent(event, harness, aggregates);
      }

      const finalResponse = await stream.finalResponse();
      const parsedResponse = this.normalizeOpenAIResponse(finalResponse, modelKey);

      const captureReasoning = serviceOpts.captureReasoning !== false;
      const {
        result,
        tokenUsage,
        reasoningLog,
        reasoningItems,
        status,
        incomplete,
        incompleteReason,
        responseId
      } = this.parseProviderResponse(parsedResponse, modelKey, captureReasoning, taskId);

      const completeness = this.validateResponseCompleteness(parsedResponse, modelKey);

      const finalModelResponse = this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems,
        status || (completeness.isComplete ? "complete" : "incomplete"),
        incomplete ?? !completeness.isComplete,
        incompleteReason || completeness.suggestion,
        promptPackage,
        promptId,
        customPrompt,
        responseId
      );

      this.finalizeStream(harness, {
        status: "success",
        durationMs: Date.now() - startedAt,
        metadata: {
          responseId,
          tokenUsage
        },
        responseSummary: {
          outputText: parsedResponse.output_text,
          reasoningLog,
          accumulatedText: aggregates.text,
          accumulatedReasoning: aggregates.reasoning,
          refusal: aggregates.refusal,
          analysis: finalModelResponse
        }
      });

      return finalModelResponse;
    } catch (error) {
      if (harness?.sessionId) {
        this.cleanupStream(harness.sessionId);
      }

      if (error instanceof APIUserAbortError) {
        throw error;
      }

      this.handleAnalysisError(error, modelKey, task);
    }
  }  getModelInfo(modelKey: string): ModelInfo {
    const modelName = getApiModelName(modelKey);
    // Normalize for Set lookups
    const normalizedKey = normalizeModelKey(modelKey);
    const isReasoning = MODELS_WITH_REASONING.has(normalizedKey);
    const modelConfig = getModelConfig(modelKey);
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: !modelName.includes('gpt-5-chat-latest'),
      supportsVision: false // Update based on actual capabilities
    };
  }

  /**
   * SRP Helper: Normalize OpenAI response for consistent processing
   *
   * OpenAI Responses API returns:
   * - output_text OR output[] array with mixed types (reasoning, message, etc.)
   * - output_parsed for JSON schema-enforced output
   * - output_reasoning.summary and output_reasoning.items for reasoning
   *
   * This method ensures consistent structure for parseProviderResponse()
   */
  private normalizeOpenAIResponse(response: any, modelKey: string): any {
    // Extract token usage first
    const usage = response?.usage ?? {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;

    const tokenUsage: TokenUsage = {
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens > 0 ? reasoningTokens : undefined
    };

    // Calculate cost using inherited method
    const cost = this.calculateResponseCost(modelKey, tokenUsage);

    // Build normalized structure with fallbacks
    return {
      id: response.id,
      status: response.status,
      incomplete_details: response.incomplete_details,
      // output_text: use SDK field or fallback to extracting from output[] array
      output_text: response.output_text ?? this.extractTextFromOutputBlocks(response.output ?? []),
      // output_parsed: structured JSON from schema enforcement
      output_parsed: response.output_parsed,
      // output_reasoning: normalize reasoning structure with fallbacks
      output_reasoning: {
        summary: response.output_reasoning?.summary ?? this.extractReasoningFromOutputBlocks(response.output ?? []),
        items: response.output_reasoning?.items ?? []
      },
      // output: keep raw output array for fallback extraction
      output: response.output,
      // Preserve raw response for debugging
      raw_response: response,
      usage: response.usage,
      tokenUsage,
      cost
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
    // PHASE 12: Pass modelKey for structured output detection
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Create message array for preview
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    // Normalize modelKey for Set lookups (e.g., "gpt-5-mini" → "gpt-5-mini-2025-08-07")
    const normalizedKey = normalizeModelKey(modelKey);
    const isReasoningModel = MODELS_WITH_REASONING.has(normalizedKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey);

    // Build message format for Responses API  
    const messageFormat: any = {
      model: modelName,
      input: messages,
      ...(isReasoningModel && {
        reasoning: isGPT5Model 
          ? { 
              effort: serviceOpts.reasoningEffort || "high",
              summary: serviceOpts.reasoningSummaryType || "detailed" 
            }
          : { summary: "detailed" },
        ...(isGPT5Model && {
          text: { verbosity: serviceOpts.reasoningVerbosity || "high" }
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

  // ========================================
  // Phase 2: DRY Helper Methods
  // ========================================

  /**
   * DRY Helper: Build message array for API request
   * Handles initial vs continuation conversation modes
   */
  private buildMessageArray(
    promptPackage: PromptPackage,
    isContinuation: boolean
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    
    if (isContinuation) {
      console.log('[OpenAI-Messages] Continuation mode - sending ONLY new user message');
      messages.push({ role: "user", content: promptPackage.userPrompt });
    } else {
      console.log('[OpenAI-Messages] Initial mode - sending system + user messages');
      if (promptPackage.systemPrompt) {
        messages.push({ role: "system", content: promptPackage.systemPrompt });
      }
      messages.push({ role: "user", content: promptPackage.userPrompt });
    }
    
    return messages;
  }

  /**
   * DRY Helper: Build reasoning configuration based on model type
   * FIXED: Normalize modelKey to handle both shortened and full versions
   */
  private buildReasoningConfig(
    modelKey: string,
    serviceOpts: ServiceOptions
  ): Record<string, unknown> | undefined {
    // Normalize modelKey to full versioned name for Set lookups
    // e.g., "gpt-5-mini" → "gpt-5-mini-2025-08-07"
    const normalizedKey = normalizeModelKey(modelKey);

    const isReasoningModel = MODELS_WITH_REASONING.has(normalizedKey);
    if (!isReasoningModel) return undefined;

    const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(normalizedKey);

    if (isGPT5Model) {
      return {
        effort: serviceOpts.reasoningEffort || "high",
        summary: serviceOpts.reasoningSummaryType || serviceOpts.reasoningSummary || "detailed"
      };
    } else if (isO3O4Model) {
      return {
        summary: serviceOpts.reasoningSummary || "auto"
      };
    }

    return undefined;
  }

  /**
   * DRY Helper: Build text configuration including verbosity + JSON schema format
   * This is CRITICAL - must merge both fields into single text object
   * FIXED: Normalize modelKey for Set lookups
   */
  private buildTextConfig(
    modelKey: string,
    testCount: number,
    serviceOpts: ServiceOptions
  ): Record<string, any> | undefined {
    const modelName = getApiModelName(modelKey);
    // Normalize for Set lookups (e.g., "gpt-5-mini" → "gpt-5-mini-2025-08-07")
    const normalizedKey = normalizeModelKey(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey);
    
    // Build verbosity config for GPT-5 models
    let textConfig: Record<string, unknown> | undefined;
    if (isGPT5Model) {
      textConfig = {
        verbosity: serviceOpts.reasoningVerbosity || "high"
      };
    }

    // Build JSON schema format if supported
    const supportsStructuredOutput =
      !modelName.includes("gpt-5-chat-latest") && 
      !modelName.includes("gpt-5-nano");

    let structuredFormat = undefined;
    if (supportsStructuredOutput) {
      const schema = getOpenAISchema(testCount);
      structuredFormat = {
        type: "json_schema",
        name: schema.name,
        strict: schema.strict,
        schema: schema.schema
      };
    }

    // CRITICAL: Merge verbosity + schema format into single text object
    const baseText = textConfig ? { ...textConfig } : undefined;
    const textPayload =
      structuredFormat || baseText
        ? {
            ...(baseText ?? {}),
            ...(structuredFormat ? { format: structuredFormat } : {})
          }
        : undefined;

    return textPayload;
  }

  /**
   * DRY Helper: Extract token usage from API response
   */
  private extractTokenUsage(result: any): TokenUsage {
    if (!result.usage) {
      return { input: 0, output: 0 };
    }

    const inputTokens = result.usage.input_tokens ?? 0;
    const outputTokens = result.usage.output_tokens ?? 0;
    const reasoningTokens = result.usage.output_tokens_details?.reasoning_tokens ?? 0;

    return {
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens > 0 ? reasoningTokens : undefined
    };
  }

  // ========================================
  // Main Payload Builder
  // ========================================

  /**
   * CANONICAL REQUEST BUILDER - Single source of truth for Responses API payloads
   * 
   * This method is the ONLY place that builds OpenAI Responses API request payloads.
   * It properly merges text config (verbosity) + JSON schema format to ensure both are sent.
   * 
   * Used by:
   * - Non-streaming flow (callProviderAPI)
   * - Streaming flow (analyzePuzzleWithStreaming)
   * 
   * DRY/SRP: PASS - Uses extracted helper methods
   * 
   * @returns { body: payload, isContinuation: boolean }
   */
  private buildResponsesAPIPayload(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string
  ) {
    const modelName = getApiModelName(modelKey);
    const isContinuation = !!serviceOpts.previousResponseId;
    // Normalize for Set lookups
    const normalizedKey = normalizeModelKey(modelKey);
    const isGPT5ChatModel = GPT5_CHAT_MODELS.has(normalizedKey);

    // Use DRY helpers to build components
    const messages = this.buildMessageArray(promptPackage, isContinuation);
    const reasoningConfig = this.buildReasoningConfig(modelKey, serviceOpts);
    const textPayload = this.buildTextConfig(modelKey, testCount, serviceOpts);

    const payload: Record<string, any> = {
      model: modelName,
      input: messages,
      reasoning: reasoningConfig,
      ...(textPayload ? { text: textPayload } : {}),
      temperature: modelSupportsTemperature(modelKey) ? (temperature ?? 0.2) : undefined,
      top_p:
        modelSupportsTemperature(modelKey) && isGPT5ChatModel
          ? 1
          : undefined,
      previous_response_id: serviceOpts.previousResponseId,
      store: serviceOpts.store !== false,
      parallel_tool_calls: false,
      truncation: "auto",
      max_steps: serviceOpts.maxSteps,
      // CRITICAL: GPT-5 models support 272K input + 128K output/reasoning = 400K total
      // Internal reasoning consumes tokens from max_output_tokens allocation
      // Default 128K ensures reasoning doesn't starve visible output
      max_output_tokens: serviceOpts.maxOutputTokens || 128000,
      metadata: taskId ? { taskId } : undefined
    };

    // DEBUG: Log payload construction
    console.log(`[OpenAI-PayloadBuilder] Model: ${modelName}`);
    console.log(`[OpenAI-PayloadBuilder] Test count: ${testCount}`);
    console.log(`[OpenAI-PayloadBuilder] Has reasoning: ${!!reasoningConfig}`);
    console.log(`[OpenAI-PayloadBuilder] Has text config: ${!!textPayload}`);
    if (textPayload) {
      console.log(`[OpenAI-PayloadBuilder] - verbosity: ${textPayload.verbosity || 'none'}`);
      console.log(`[OpenAI-PayloadBuilder] - format: ${textPayload.format?.type || 'none'}`);
    }
    console.log(`[OpenAI-PayloadBuilder] max_output_tokens: ${payload.max_output_tokens}`);

    return { body: payload, isContinuation };
  }
  /**
   * REFACTORED: DRY compliance - delegates to canonical payload builder
   * 
   * This method's ONLY responsibility is calling the HTTP layer.
   * All request construction logic moved to buildResponsesAPIPayload().
   */
  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string
  ): Promise<any> {
    // Use canonical payload builder (single source of truth)
    const { body } = this.buildResponsesAPIPayload(
      promptPackage,
      modelKey,
      temperature,
      serviceOpts,
      testCount,
      taskId
    );

    // Make the HTTP call
    return await this.callResponsesAPI(body, modelKey);
  }

  // ========================================
  // Phase 3: SRP Helper Methods
  // ========================================

  /**
   * SRP Helper: Extract result from API response
   * Handles multiple response formats: output_parsed, output_text, output[] array
   */
  private extractResultFromResponse(
    response: any,
    modelKey: string,
    supportsStructuredOutput: boolean
  ): any {
    const rawResponse = response.raw_response || response;
    let result: any = {};

    // Priority 1: output_parsed (structured JSON schema-enforced output)
    if (response.output_parsed) {
      result = response.output_parsed;
      console.log(`[${this.provider}] ✅ Structured output received via output_parsed`);
      result._providerRawResponse = rawResponse;
      return result;
    }

    // Priority 2: output_text (fallback when schema fails)
    if (response.output_text) {
      if (supportsStructuredOutput) {
        console.warn(`[${this.provider}] ⚠️ Schema requested for ${modelKey} but received output_text instead of output_parsed`);
        console.warn(`[${this.provider}] ⚠️ JSON schema enforcement may have failed - model ignored format directive`);
      }

      const parseResult = this.extractJsonFromResponse(response.output_text, modelKey);
      if (parseResult._parsingFailed) {
        console.error(`[${this.provider}] JSON parsing failed for ${modelKey}, preserving raw response`);
        result = {
          _rawResponse: response.output_text,
          _parseError: parseResult._parseError,
          _parsingFailed: true,
          _parseMethod: parseResult._parseMethod || 'jsonParser'
        };
      } else {
        result = parseResult;
        delete result._rawResponse;
        delete result._parseError;
        delete result._parsingFailed;
        delete result._parseMethod;
      }
      result._providerRawResponse = rawResponse;
      return result;
    }

    // Priority 3: output[] array (GPT-5-nano format)
    if (response.output && Array.isArray(response.output) && response.output.length > 0) {
      const outputBlock = response.output[0];
      if (outputBlock && outputBlock.type === 'text' && outputBlock.text) {
        const parseResult = this.extractJsonFromResponse(outputBlock.text, modelKey);
        if (parseResult._parsingFailed) {
          console.error(`[${this.provider}] JSON parsing failed for output block text, preserving raw response`);
          result = {
            _rawResponse: outputBlock.text,
            _parseError: parseResult._parseError,
            _parsingFailed: true,
            _parseMethod: parseResult._parseMethod || 'jsonParser'
          };
        } else {
          result = parseResult;
          delete result._rawResponse;
          delete result._parseError;
          delete result._parsingFailed;
          delete result._parseMethod;
        }
      } else {
        console.error(`[${this.provider}] Unexpected output format:`, outputBlock);
        result = {
          _rawResponse: JSON.stringify(outputBlock),
          _parseError: 'Unexpected output block format',
          _parsingFailed: true,
          _parseMethod: 'fallback'
        };
      }
      result._providerRawResponse = rawResponse;
      return result;
    }

    // No valid output found
    console.error(`[${this.provider}] No structured output found in response`);
    result = {
      _rawResponse: JSON.stringify(rawResponse),
      _parseError: 'No structured output found',
      _parsingFailed: true,
      _parseMethod: 'fallback',
      _providerRawResponse: rawResponse
    };
    return result;
  }

  /**
   * SRP Helper: Extract reasoning from API response
   * Handles output_reasoning.summary and output[] array scanning
   */
  private extractReasoningFromResponse(
    response: any,
    captureReasoning: boolean
  ): { reasoningLog: any; reasoningItems: any[] } {
    if (!captureReasoning) {
      return { reasoningLog: null, reasoningItems: [] };
    }

    let reasoningLog = null;
    let reasoningItems: any[] = [];

    // Extract reasoning log from output_reasoning.summary
    if (response.output_reasoning?.summary) {
      const summary = response.output_reasoning.summary;

      if (Array.isArray(summary)) {
        reasoningLog = summary.map((s: any) => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object' && s.text) return s.text;
          if (s && typeof s === 'object' && s.content) return s.content;
          return typeof s === 'object' ? JSON.stringify(s) : String(s);
        }).filter(Boolean).join('\n\n');
      } else if (typeof summary === 'string') {
        reasoningLog = summary;
      } else if (summary && typeof summary === 'object') {
        if (summary.text) {
          reasoningLog = summary.text;
        } else if (summary.content) {
          reasoningLog = summary.content;
        } else {
          reasoningLog = JSON.stringify(summary, null, 2);
        }
      }
    }

    // Fallback: Scan output[] for reasoning blocks
    if (!reasoningLog && response.output && Array.isArray(response.output)) {
      reasoningLog = this.extractReasoningFromOutputBlocks(response.output);
    }

    // Extract reasoning items
    if (response.output_reasoning?.items && Array.isArray(response.output_reasoning.items)) {
      reasoningItems = response.output_reasoning.items.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return JSON.stringify(item);
      });
    }

    // Fallback: Scan output[] array for reasoning items
    if ((!reasoningItems || reasoningItems.length === 0) && response.output && Array.isArray(response.output)) {
      const reasoningBlocks = response.output.filter((block: any) =>
        block && (
          block.type === 'reasoning' ||
          block.type === 'Reasoning' ||
          (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
        )
      );

      reasoningItems = reasoningBlocks.map((block: any) => {
        if (typeof block.content === 'string') return block.content;
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || JSON.stringify(block.content);
        }
        return JSON.stringify(block);
      }).filter(Boolean);
    }

    // Validate types and fix corruption
    if (reasoningLog && typeof reasoningLog !== 'string') {
      console.error(`[${this.provider}] WARNING: reasoningLog is not a string! Type: ${typeof reasoningLog}`, reasoningLog);
      try {
        reasoningLog = JSON.stringify(reasoningLog, null, 2);
        console.log(`[${this.provider}] Converted reasoningLog object to JSON string: ${reasoningLog.length} chars`);
      } catch (error) {
        console.error(`[${this.provider}] Failed to stringify reasoningLog object:`, error);
        reasoningLog = null;
      }
    }

    if (reasoningItems && !Array.isArray(reasoningItems)) {
      console.error(`[${this.provider}] WARNING: reasoningItems is not an array! Type: ${typeof reasoningItems}`, reasoningItems);
      reasoningItems = [];
    }

    // Fallback: Create log from items if log is empty
    if (!reasoningLog && reasoningItems && reasoningItems.length > 0) {
      reasoningLog = reasoningItems
        .filter(item => item && typeof item === 'string' && item.trim().length > 0)
        .map((item, index) => `Step ${index + 1}: ${item}`)
        .join('\n\n');
      if (!reasoningLog || reasoningLog.length === 0) {
        reasoningLog = null;
      }
    }

    return { reasoningLog, reasoningItems };
  }

  /**
   * SRP Helper: Handle streaming events for real-time updates
   */
  private handleStreamingEvent(
    event: ResponseStreamEvent,
    harness: StreamingHarness | undefined,
    aggregates: OpenAIStreamAggregates
  ): void {
    const eventType = event.type;

    switch (eventType) {
      case "response.created": {
        // Response creation event - can be ignored for streaming
        break;
      }
      case "response.output_item.added": {
        // Output item added - can be ignored for streaming
        break;
      }
      case "response.reasoning_summary_text.delta": {
        // SDK Type: ResponseReasoningSummaryTextDeltaEvent has 'delta: string' field
        const typedEvent = event as ResponseReasoningSummaryTextDeltaEvent;
        const delta = typedEvent.delta || '';
        aggregates.reasoningSummary = (aggregates.reasoningSummary || '') + delta;
        this.emitStreamChunk(harness, {
          type: "reasoning",
          delta,
          content: aggregates.reasoningSummary,
          metadata: { type: 'reasoning_summary' }
        });
        break;
      }
      case "response.reasoning_summary_part.done": {
        // Reasoning part completed - finalize the summary
        aggregates.reasoningSummary = aggregates.reasoningSummary || '';
        break;
      }
      case "response.reasoning_summary_part.added": {
        // SDK Type: ResponseReasoningSummaryPartAddedEvent has 'part: { text: string }' field
        const typedEvent = event as ResponseReasoningSummaryPartAddedEvent;
        const delta = typedEvent.part?.text || '';
        aggregates.reasoningSummary = (aggregates.reasoningSummary || '') + delta;
        this.emitStreamChunk(harness, {
          type: "reasoning",
          delta,
          content: aggregates.reasoningSummary,
          metadata: { type: 'reasoning_summary' }
        });
        break;
      }
      case "response.reasoning_summary_text.done": {
        aggregates.reasoningSummary = aggregates.reasoningSummary || '';
        break;
      }
      case "response.content_part.added": {
        // SDK Type: ResponseContentPartAddedEvent has 'part: ResponseOutputText' with 'text: string' field
        const typedEvent = event as ResponseContentPartAddedEvent;
        const partText = typedEvent.part && 'text' in typedEvent.part ? typedEvent.part.text : '';
        aggregates.text += partText;
        this.emitStreamChunk(harness, {
          type: "text",
          delta: partText,
          content: aggregates.text,
          metadata: { type: 'content' }
        });
        break;
      }
      case "response.in_progress": {
        this.emitStreamEvent(harness, "stream.status", {
          state: "in_progress",
          step: (event as any).step
        });
        break;
      }
      case "response.completed": {
        this.emitStreamEvent(harness, "stream.status", { state: "completed" });
        break;
      }
      case "response.failed":
      case "error": {
        const message = (event as any).error?.message ?? "Streaming failed";
        this.emitStreamEvent(harness, "stream.status", {
          state: "failed",
          message
        });
        break;
      }
      default:
        // Only log truly unexpected event types, not the expected ones we handle above
        if (!eventType.startsWith('response.')) {
          console.log(`[OpenAI-Streaming] Unhandled event type: ${eventType}`);
        }
        break;
    }
  }

  /**
   * SRP Helper: Make HTTP call to OpenAI Responses API
   *
   * Returns normalized response structure for consistent processing
   */
  private async callResponsesAPI(body: any, modelKey: string): Promise<any> {
    const startTime = Date.now();
    try {
      const response = await openai.responses.create(body);

      // Add processing time tracking
      (response as any).processingTime = Date.now() - startTime;

      // Normalize response structure for consistent processing
      return this.normalizeOpenAIResponse(response, modelKey);
    } catch (error) {
      console.error(`[OpenAI] API call failed for ${modelKey}:`, error);
      throw error;
    }
  }

  /**
   * Parse provider response - must be implemented by each provider
   */
  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string; responseId?: string } {
    // Extract result using provider-specific method
    const result = this.extractResultFromResponse(response, modelKey, this.supportsStructuredOutput(modelKey));

    // Extract token usage
    const tokenUsage = this.extractTokenUsage(response);

    // Extract reasoning if requested
    const { reasoningLog, reasoningItems } = this.extractReasoningFromResponse(response, captureReasoning);

    // Determine status and completeness
    const status = response.status || 'complete';
    const incomplete = response.incomplete || false;
    const incompleteReason = response.incompleteReason || undefined;

    // Extract response ID if available
    const responseId = response.id || response.responseId || undefined;

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status,
      incomplete,
      incompleteReason,
      responseId
    };
  }
  // Helper methods extracted from original implementation
  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) {
      return '';
    }
    
    // Look for Assistant blocks first
    const assistantBlock = output.find(block => 
      block && (block.type === 'Assistant' || block.role === 'assistant')
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
      if (!block) continue;
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
      .filter(block => block && (block.content || block.text))
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
      block && (
        block.type === 'reasoning' || 
        block.type === 'Reasoning' ||
        (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
      )
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
