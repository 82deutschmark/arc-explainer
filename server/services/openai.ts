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
import { ARC_JSON_SCHEMA } from "./schemas/arcJsonSchema.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo, StreamingHarness } from "./base/BaseAIService.js";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

type OpenAIStreamAggregates = {
  text: string;
  reasoning: string;
  summary: string;
  refusal: string;
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

  supportsStreaming(modelKey: string): boolean {
    return [
      "gpt-5-mini-2025-08-07",
      "gpt-5-nano-2025-08-07",
      "gpt-5-2025-08-07"
    ].includes(modelKey);
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
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, taskId);
      
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

    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    const harness = serviceOpts.stream;
    const controller = this.registerStream(harness);
    const startedAt = Date.now();

    try {
      const { body } = this.buildResponsesRequestBody(
        promptPackage,
        modelKey,
        temperature,
        serviceOpts,
        taskId
      );

      this.emitStreamEvent(harness, "stream.status", { state: "requested" });

      const stream = openai.responses.stream(
        { ...body, stream: true },
        { signal: controller?.signal }
      );

      const aggregates: OpenAIStreamAggregates = {
        text: "",
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
    const isReasoning = MODELS_WITH_REASONING.has(modelKey);
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

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId: string = DEFAULT_PROMPT_ID,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): PromptPreview {
    const modelName = getApiModelName(modelKey);
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
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

  private buildResponsesRequestBody(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    taskId?: string
  ) {
    const modelName = getApiModelName(modelKey);
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;

    const isContinuation = !!serviceOpts.previousResponseId;
    const messages: Array<{ role: string; content: string }> = [];

    if (isContinuation) {
      console.log('[OpenAI] >> Continuation mode - sending ONLY new user message');
      messages.push({ role: "user", content: userMessage });
    } else {
      console.log('[OpenAI] >> Initial mode - sending system + user messages');
      if (systemMessage) {
        messages.push({ role: "system", content: systemMessage });
      }
      messages.push({ role: "user", content: userMessage });
    }

    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
    const isGPT5ChatModel = GPT5_CHAT_MODELS.has(modelKey);

    let reasoningConfig: Record<string, unknown> | undefined;
    let textConfig: Record<string, unknown> | undefined;

    if (isReasoningModel) {
      if (isGPT5Model) {
        reasoningConfig = {
          effort: serviceOpts.reasoningEffort || "high",
          summary: serviceOpts.reasoningSummaryType || serviceOpts.reasoningSummary || "detailed"
        };
        textConfig = {
          verbosity: serviceOpts.reasoningVerbosity || "high"
        };
      } else if (isO3O4Model) {
        reasoningConfig = {
          summary: serviceOpts.reasoningSummary || "auto"
        };
      }
    }

    const supportsStructuredOutput =
      !modelName.includes("gpt-5-chat-latest") && !modelName.includes("gpt-5-nano");

    const baseText = textConfig ? { ...textConfig } : undefined;
    const structuredFormat = supportsStructuredOutput
      ? {
          type: "json_schema",
          name: ARC_JSON_SCHEMA.name,
          strict: ARC_JSON_SCHEMA.strict,
          schema: ARC_JSON_SCHEMA.schema
        }
      : undefined;

    const textPayload =
      structuredFormat || baseText
        ? {
            ...(baseText ?? {}),
            ...(structuredFormat ? { format: structuredFormat } : {})
          }
        : undefined;

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
      max_output_tokens: serviceOpts.maxOutputTokens,
      metadata: taskId ? { taskId } : undefined
    };

    return { body: payload, isContinuation };
  }
  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    taskId?: string
  ): Promise<any> {
    const modelName = getApiModelName(modelKey);
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;

    // CRITICAL FIX: If continuing conversation, ONLY send new message
    // API retrieves full context from previous_response_id
    const isContinuation = !!serviceOpts.previousResponseId;
    const messages: any[] = [];
    
    if (isContinuation) {
      // Continuation: API loads context from previous_response_id
      // ONLY send the new message
      console.log('[OpenAI] =ƒöä Continuation mode - sending ONLY new user message');
      messages.push({ role: "user", content: userMessage });
    } else {
      // Initial: Send full conversation
      console.log('[OpenAI] =ƒôä Initial mode - sending system + user messages');
      if (systemMessage) {
        messages.push({ role: "system", content: systemMessage });
      }
      messages.push({ role: "user", content: userMessage });
    }

    // Build reasoning config based on model type
    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
    const isGPT5ChatModel = GPT5_CHAT_MODELS.has(modelKey);
    const modelConfig = getModelConfig(modelKey);


    let reasoningConfig = undefined;
    let textConfig = undefined;
    
    if (isReasoningModel) {
      if (isGPT5Model) {
        reasoningConfig = {
          effort: serviceOpts.reasoningEffort || 'high',
          summary: serviceOpts.reasoningSummaryType || serviceOpts.reasoningSummary || 'detailed'
        };
        textConfig = {
          verbosity: serviceOpts.reasoningVerbosity || 'high'
        };
      } else if (isO3O4Model) {
        reasoningConfig = {
          summary: serviceOpts.reasoningSummary || 'auto'
        };
      }
    } else {
    }

    const requestData = {
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
    };


    return await this.callResponsesAPI(requestData, modelKey);
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): {
    result: any;
    tokenUsage: TokenUsage;
    reasoningLog?: any;
    reasoningItems?: any[];
    status?: string;
    incomplete?: boolean;
    incompleteReason?: string;
    responseId?: string;
  } {

    let result: any = {};
    let reasoningLog = null;
    let reasoningItems: any[] = [];

    // CRITICAL FIX: Always preserve raw response FIRST, then attempt parsing
    const rawResponse = response.raw_response || response;

    // GPT-5-nano returns clean structured data in different fields
    if (response.output_parsed) {
      result = response.output_parsed;
    } else if (response.output_text) {
      // CRITICAL FIX: Use jsonParser instead of direct JSON.parse to handle markdown-wrapped JSON
      // GPT-5-chat-latest returns ```json\n{...}\n``` which breaks JSON.parse()
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
        // Remove internal parsing flags from successful parse
        delete result._rawResponse;
        delete result._parseError;
        delete result._parsingFailed;
        delete result._parseMethod;
      }
    } else if (response.output && Array.isArray(response.output) && response.output.length > 0) {
      // GPT-5-nano returns structured data in output array
      const outputBlock = response.output[0];
      if (outputBlock.type === 'text' && outputBlock.text) {
        // CRITICAL FIX: Use jsonParser for output array text as well
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
    } else {
      console.error(`[${this.provider}] No structured output found in response`);
      result = {
        _rawResponse: JSON.stringify(rawResponse),
        _parseError: 'No structured output found',
        _parsingFailed: true,
        _parseMethod: 'fallback'
      };
    }

    // ALWAYS preserve raw response for debugging, regardless of parsing success/failure
    result._providerRawResponse = rawResponse;

    // Extract reasoning log from API response
    if (captureReasoning && response.output_reasoning?.summary) {
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
        // Handle object summary (this was the missing case causing [object Object])
        if (summary.text) {
          reasoningLog = summary.text;
        } else if (summary.content) {
          reasoningLog = summary.content;
        } else {
          reasoningLog = JSON.stringify(summary, null, 2);
        }
      }
    }

    // Extract reasoning items and convert them to an array of strings
    if (response.output_reasoning?.items && Array.isArray(response.output_reasoning.items)) {
      reasoningItems = response.output_reasoning.items.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return JSON.stringify(item);
      });
    } else {
      reasoningItems = [];
    }

    // Validate reasoning data types and fix corruption
    if (reasoningLog && typeof reasoningLog !== 'string') {
      console.error(`[${this.provider}] WARNING: reasoningLog is not a string! Type: ${typeof reasoningLog}`, reasoningLog);
      // Use JSON.stringify instead of String() to avoid "[object Object]" corruption
      try {
        reasoningLog = JSON.stringify(reasoningLog, null, 2);
        console.log(`=ƒöì [${this.provider}-PARSE-DEBUG] Converted reasoningLog object to JSON string: ${reasoningLog.length} chars`);
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
      reasoningLog = reasoningItems
        .filter(item => item && typeof item === 'string' && item.trim().length > 0)
        .map((item, index) => `Step ${index + 1}: ${item}`)
        .join('\n\n');
      
      if (!reasoningLog || reasoningLog.length === 0) {
        reasoningLog = null;
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


    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status,
      incomplete,
      incompleteReason,
      responseId: response.id || null
    };
  }

  private async callResponsesAPI(requestData: any, modelKey: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }


    try {
      // Check if model supports structured JSON schema
      const supportsStructuredOutput = !requestData.model.includes('gpt-5-chat-latest') &&
                                       !requestData.model.includes('gpt-5-nano');

      // Prepare the request for OpenAI's Responses API
      const body = {
        model: requestData.model,
        input: Array.isArray(requestData.input) ? requestData.input : [{ role: "user", content: requestData.input }],
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
        reasoning: requestData.reasoning,
        temperature: modelSupportsTemperature(modelKey) ? requestData.temperature : undefined,
        top_p: modelSupportsTemperature(modelKey) ? 1 : undefined,
        parallel_tool_calls: false,
        truncation: "auto",
        previous_response_id: requestData.previous_response_id,
        store: requestData.store !== false // Default to true unless explicitly set to false
      };

      // Create custom agent with extended timeouts for long reasoning model responses
      // CRITICAL: Node's undici has separate headers/body timeouts independent of AbortSignal
      const agent = new Agent({
        headersTimeout: 2700000,  // 45 minutes - wait for response headers
        bodyTimeout: 2700000,      // 45 minutes - wait for response body
        keepAliveTimeout: 3000000  // 50 minutes - keep connection alive
      });

      // Make the API call using undici's request directly (supports dispatcher option)
      const { statusCode, headers: responseHeaders, body: responseBody } = await undiciRequest('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2700000), // 45 minutes - overall request timeout
        dispatcher: agent  // Use custom agent with extended undici timeouts
      });

      // Convert undici response to standard Response-like object
      const responseText = await responseBody.text();
      const response = {
        ok: statusCode >= 200 && statusCode < 300,
        status: statusCode,
        statusText: statusCode === 200 ? 'OK' : statusCode === 503 ? 'Service Unavailable' : 'Error',
        text: async () => responseText,
        json: async () => JSON.parse(responseText)
      };

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${this.provider}] API Error:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
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

        // Calculate cost using inherited method
        cost = this.calculateResponseCost(modelKey, tokenUsage);
      }

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
      console.error(`[${this.provider}] Error calling Responses API:`, error);
      throw error;
    }
  }

  private normalizeOpenAIResponse(result: any, modelKey: string) {
    const usage = result?.usage ?? {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;

    const tokenUsage: TokenUsage = {
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens > 0 ? reasoningTokens : undefined
    };

    const cost = this.calculateResponseCost(modelKey, tokenUsage);

    return {
      id: result.id,
      status: result.status,
      incomplete_details: result.incomplete_details,
      output_text: result.output_text ?? this.extractTextFromOutputBlocks(result.output ?? []),
      output_parsed: result.output_parsed,
      output_reasoning: {
        summary: result.output_reasoning?.summary ?? this.extractReasoningFromOutputBlocks(result.output ?? []),
        items: result.output_reasoning?.items ?? []
      },
      raw_response: result,
      usage: result.usage,
      tokenUsage,
      cost
    };
  }
  private handleStreamingEvent(
    event: ResponseStreamEvent,
    harness: StreamingHarness | undefined,
    aggregates: OpenAIStreamAggregates
  ): void {
    switch (event.type) {
      case "response.output_text.delta": {
        const delta = (event as any).delta ?? "";
        if (delta) {
          aggregates.text += delta;
          this.emitStreamChunk(harness, {
            type: "text",
            delta,
            content: (event as any).snapshot ?? aggregates.text,
            metadata: {
              sequence: event.sequence_number,
              outputIndex: (event as any).output_index
            }
          });
        }
        break;
      }
      case "response.reasoning_text.delta": {
        const delta = (event as any).delta ?? "";
        if (delta) {
          aggregates.reasoning += delta;
          this.emitStreamChunk(harness, {
            type: "reasoning",
            delta,
            content: aggregates.reasoning,
            metadata: {
              sequence: event.sequence_number
            }
          });
        }
        break;
      }
      case "response.reasoning_summary_text.delta": {
        const delta = (event as any).delta ?? "";
        if (delta) {
          aggregates.summary += delta;
          this.emitStreamChunk(harness, {
            type: "reasoning_summary",
            delta,
            content: aggregates.summary,
            metadata: {
              sequence: event.sequence_number
            }
          });
        }
        break;
      }
      case "response.refusal.delta": {
        const delta = (event as any).delta ?? "";
        if (delta) {
          aggregates.refusal += delta;
          this.emitStreamChunk(harness, {
            type: "refusal",
            delta,
            content: aggregates.refusal,
            metadata: {
              sequence: event.sequence_number
            }
          });
        }
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
        break;
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




















