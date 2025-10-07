/**
 * @file server/services/grok.ts
 * @description xAI Grok Service for ARC Puzzle Analysis using Responses API
 *
 * This service provides direct integration with the xAI Grok API using the Responses API
 * endpoint (/v1/responses), following the same pattern as OpenAI's implementation.
 *
 * UPDATED: Now uses Responses API for advanced reasoning capabilities and structured output.
 * Supports ONLY Grok 4 models including grok-4, grok-4-fast, grok-4-fast-reasoning, grok-4-fast-non-reasoning
 * 
 * Other Grok models are routed through OpenRouter!
 * 
 * https://docs.x.ai/docs/models
 * https://docs.x.ai/docs/guides/responses-api#returning-encrypted-thinking-content
 * 
 * 
 * 
 * 
 *
 * @author Claude Code using Sonnet 4.5
 * @date 2025-10-05
 * @assessed_by Gemini 2.5 Pro
 * @assessed_on 2025-09-09
 */

import OpenAI from "openai";
import { Agent, request as undiciRequest } from "undici";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS, getApiModelName, getModelConfig, modelSupportsTemperature } from "../config/models/index.js";
import { jsonParser } from '../utils/JsonParser.js';
import { GROK_JSON_SCHEMA } from "./schemas/grokJsonSchema.js";

const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Add shared undici Agent singleton for xAI requests (prevents per-request socket churn)
const XAI_SHARED_AGENT = new Agent({
  headersTimeout: 2700000,  // 45 minutes - wait for response headers
  bodyTimeout: 2700000,      // 45 minutes - wait for response body
  keepAliveTimeout: 3000000  // 50 minutes - keep connection alive
});

export class GrokService extends BaseAIService {
  protected provider = "xAI";
  // Only Grok-4 variants support Responses API
  // Grok-3 models use Chat Completions and are routed through OpenRouter
  protected models = {
    "grok-4": "grok-4",
    "grok-4-fast": "grok-4-fast",
    "grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "grok-4-fast-non-reasoning": "grok-4-fast-non-reasoning",
  };

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
    const modelName = getApiModelName(modelKey);

    // Build prompt package using inherited method
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);

    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API (now using Responses API)
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, taskId);

      // Parse response using provider-specific method
      // CRITICAL: Pass captureReasoning=true to enable reasoning extraction
      const { result, tokenUsage, reasoningLog, reasoningItems, status, incomplete, incompleteReason } =
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
        customPrompt
      );

      return finalResponse;

    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = this.models[modelKey as keyof typeof this.models] || modelKey;
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);

    // Check if it's a reasoning model using modelConfig (respects grok-4-fast-non-reasoning)
    const isReasoning = modelConfig?.isReasoning ?? false;

    // Grok-4 supports structured output via Responses API (response_format.json_schema)
    const supportsStructuredOutput = modelName.includes('grok-4');
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput,
      supportsVision: modelName.includes('vision') || modelName.includes('beta') // Vision models
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
    const modelName = this.models[modelKey as keyof typeof this.models] || modelKey;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Create message array for Grok API (same as OpenAI format)
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    // Build message format for Grok API
    const messageFormat: any = {
      model: modelName,
      messages
    };

    const providerSpecificNotes = [
      "Uses xAI API with OpenAI SDK compatibility",
      "Base URL: https://api.x.ai/v1",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using system message role"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing",
      modelName.includes('grok-4') || modelName.includes('grok-3') 
        ? "Reasoning model - may provide built-in reasoning logs" 
        : "Standard model"
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
  } {

    let result: any = {};
    let reasoningLog = null;
    let reasoningItems: any[] = [];

    // CRITICAL: Always preserve raw response FIRST, then attempt parsing
    const rawResponse = response.raw_response || response;

    // Parse response from Responses API format (similar to OpenAI)
    if (response.output_parsed) {
      result = response.output_parsed;
    } else if (response.output_text) {
      // Use jsonParser to handle markdown-wrapped JSON
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
      // Parse structured data from output array
      const outputBlock = response.output[0];
      if (outputBlock.type === 'text' && outputBlock.text) {
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

    // ALWAYS preserve raw response for debugging
    result._providerRawResponse = rawResponse;

    // IMPORTANT: grok-4 does NOT return reasoning_content per xAI documentation
    // Only attempt reasoning extraction for future models that support it
    // For now, grok-4 and grok-4-fast don't expose reasoning in the response
    const supportsReasoning = false; // Set to true only when xAI adds reasoning support

    if (captureReasoning && supportsReasoning && response.output_reasoning?.summary) {
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

    // Extract reasoning items (also skipped for grok-4)
    if (supportsReasoning && response.output_reasoning?.items && Array.isArray(response.output_reasoning.items)) {
      reasoningItems = response.output_reasoning.items.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return JSON.stringify(item);
      });
    } else {
      reasoningItems = [];
    }

    // Validate reasoning data types
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
      incompleteReason
    };
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

    // Build message array
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    // IMPORTANT: grok-4 does NOT support reasoning config per xAI docs
    // Don't send ANY reasoning configuration to grok-4 models
    const requestData = {
      model: modelName,
      input: messages,
      // NO reasoning config - grok-4 doesn't support it
      previous_response_id: serviceOpts.previousResponseId,
      ...(modelSupportsTemperature(modelKey) && {
        temperature: temperature || 0.2
      }),
    };

    return await this.callResponsesAPI(requestData, modelKey);
  }

  private async callResponsesAPI(requestData: any, modelKey: string): Promise<any> {
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      throw new Error("GROK_API_KEY not configured");
    }

    try {
      // Check if model supports structured JSON schema
      // Disable for ALL grok-4 models due to "Grammar is too complex" errors
      // Enable structured outputs for Grok-4 variants; we'll gracefully fallback on grammar errors
      const supportsStructuredOutput = requestData.model.startsWith('grok-4');

      // Prepare the request for xAI's Responses API
      let body: any = {
        model: requestData.model,
        input: Array.isArray(requestData.input) ? requestData.input : [{ role: "user", content: requestData.input }],
        ...(supportsStructuredOutput && {
          response_format: {
            type: "json_schema",
            json_schema: {
              schema: GROK_JSON_SCHEMA.schema
            }
          }
        }),
        // NO reasoning config for grok-4 (not supported per xAI docs)
        temperature: modelSupportsTemperature(modelKey) ? requestData.temperature : undefined,
        parallel_tool_calls: false,
        truncation: "auto",
        previous_response_id: requestData.previous_response_id,
        store: requestData.store !== false // Default to true unless explicitly set to false
      };

      // Minimal retry/backoff with jitter for transient errors
      const maxRetries = Math.max(0, Number(process.env.XAI_MAX_RETRIES || 2));
      const baseDelayMs = Math.max(200, Number(process.env.XAI_RETRY_BASE_DELAY_MS || 2000));

      let attempt = 0;
      let lastError: any = null;

      while (attempt <= maxRetries) {
        attempt++;
        try {
          const { statusCode, headers: responseHeaders, body: responseBody } = await undiciRequest('https://api.x.ai/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(2700000), // 45 minutes - overall request timeout
            dispatcher: XAI_SHARED_AGENT  // Use shared agent with extended undici timeouts
          });

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
            // One-shot graceful fallback: disable schema if grammar/schema error is reported (400/422/503)
            const grammarError = /grammar|schema/i.test(errorText);
            if (body && body.response_format && (statusCode === 400 || statusCode === 422 || statusCode === 503) && grammarError) {
              console.warn(`[${this.provider}] Disabling structured output due to grammar/schema error and retrying without schema (attempt ${attempt}/${maxRetries + 1})`);
              delete (body as any).response_format;
              const jitter1 = Math.floor(Math.random() * 300);
              await new Promise(r => setTimeout(r, baseDelayMs + jitter1));
              // Retry immediately without consuming a retry slot beyond this attempt
              continue;
            }

            const shouldRetry = (statusCode === 429) || (statusCode >= 500 && statusCode <= 599);
            console.error(`[${this.provider}] API Error (attempt ${attempt}/${maxRetries + 1}):`, {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            if (shouldRetry && attempt <= maxRetries) {
              const jitter2 = Math.floor(Math.random() * 300);
              await new Promise(r => setTimeout(r, baseDelayMs + jitter2));
              continue;
            }
            throw new Error(`xAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
          }

          const result = await response.json();

          // Extract token usage from xAI Responses API response
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
            status: result.status,
            incomplete_details: result.incomplete_details,
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
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || err);
          const transient = /ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN/i.test(msg);
          if (transient && attempt <= maxRetries) {
            const jitter = Math.floor(Math.random() * 300);
            await new Promise(r => setTimeout(r, baseDelayMs + jitter));
            continue;
          }
          // Non-retryable or out of retries
          throw err;
        }
      }

      // Exhausted retries
      throw lastError || new Error('xAI Responses API failed after retries');

    } catch (error) {
      console.error(`[${this.provider}] Error calling Responses API:`, error);
      throw error;
    }
  }

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

        const candidates = [block.content, block.text];
        for (const candidate of candidates) {
          if (typeof candidate === 'string') {
            return candidate;
          } else if (candidate && typeof candidate === 'object') {
            if (candidate.text) return candidate.text;
            if (candidate.content) return candidate.content;
            if (candidate.message) return candidate.message;
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

        const candidates = [block.content, block.text, block.summary];
        for (const candidate of candidates) {
          if (typeof candidate === 'string') {
            return candidate;
          } else if (candidate && typeof candidate === 'object') {
            if (candidate.text) return candidate.text;
            if (candidate.content) return candidate.content;
            if (candidate.message) return candidate.message;
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

export const grokService = new GrokService();