/**
 *
 * Author: Codex using GPT-5-high
 * Date: 2025-10-07T14:21:27-04:00
 * PURPOSE: Production Grok service integrating xAI Responses API for ARC analysis; handles prompt construction, transport, JSON parsing, retry/fallbacks, and conversation chaining while deferring reasoning capture because Grok-4 variants do not expose it. Touches BaseAIService utilities, model config, and schema helpers.
 * SRP/DRY check: Pass - Single-responsibility provider wrapper; reuses BaseAIService and shared schema utilities after reviewing server/services.
 * shadcn/ui: Pass - Backend provider integration with no UI components.
 */
import { Agent, request as undiciRequest } from "undici";
import { ARCTask } from "../../shared/types.js";
import { GROK_JSON_SCHEMA } from "./schemas/grokJsonSchema.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { getDefaultPromptId, PromptOptions, PromptPackage } from "./promptBuilder.js";
import { getApiModelName, getModelConfig, modelSupportsTemperature } from "../config/models/index.js";
import { logger } from "../utils/logger.js";

const GROK_RESPONSES_ENDPOINT = "https://api.x.ai/v1/responses";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 2000;
const RESPONSE_TIMEOUT_MS = 45 * 60 * 1000;

const XAI_SHARED_AGENT = new Agent({
  headersTimeout: RESPONSE_TIMEOUT_MS,
  bodyTimeout: RESPONSE_TIMEOUT_MS,
  keepAliveTimeout: RESPONSE_TIMEOUT_MS + 5 * 60 * 1000
});

export class GrokService extends BaseAIService {
  protected provider = "xAI";

  protected models: Record<string, string> = {
    "grok-4": "grok-4",
    "grok-4-fast": "grok-4-fast",
    "grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "grok-4-fast-non-reasoning": "grok-4-fast-non-reasoning"
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = DEFAULT_TEMPERATURE,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    const appliedTemperature = typeof temperature === "number" ? temperature : DEFAULT_TEMPERATURE;

    this.logAnalysisStart(modelKey, appliedTemperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      const providerResponse = await this.callProviderAPI(
        promptPackage,
        modelKey,
        appliedTemperature,
        serviceOpts,
        taskId
      );

      const {
        result,
        tokenUsage,
        reasoningLog,
        reasoningItems,
        status,
        incomplete,
        incompleteReason,
        responseId
      } = this.parseProviderResponse(providerResponse, modelKey, false, taskId);

      return this.buildStandardResponse(
        modelKey,
        appliedTemperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        false,
        reasoningItems,
        status,
        incomplete,
        incompleteReason,
        promptPackage,
        promptId,
        customPrompt,
        responseId
      );
    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
      throw error;
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelConfig = getModelConfig(modelKey);
    const modelName = getApiModelName(modelKey);

    return {
      name: modelName,
      isReasoning: false,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow,
      supportsFunctionCalling: false,
      supportsSystemPrompts: true,
      supportsStructuredOutput: this.supportsStructuredOutput(modelKey),
      supportsVision: modelConfig?.supportsVision ?? false
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
    const modelName = getApiModelName(modelKey);
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    const systemPromptMode = serviceOpts.systemPromptMode || "ARC";
    const structuredPreview = this.supportsStructuredOutput(modelKey);
    const previewTemperature = modelSupportsTemperature(modelKey) ? DEFAULT_TEMPERATURE : undefined;

    const messages = this.buildMessages(promptPackage);

    const messageFormat: Record<string, unknown> = {
      model: modelName,
      input: messages,
      previous_response_id: serviceOpts.previousResponseId,
      store: serviceOpts.store ?? true,
      ...(structuredPreview && {
        response_format: {
          type: "json_schema",
          json_schema: GROK_JSON_SCHEMA.schema
        }
      }),
      ...(previewTemperature !== undefined && { temperature: previewTemperature })
    };

    const previewText = promptPackage.systemPrompt
      ? `${promptPackage.systemPrompt}\n\n${promptPackage.userPrompt}`
      : promptPackage.userPrompt;

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
        wordCount: previewText.split(/\s+/).filter(Boolean).length,
        lineCount: previewText.split("\n").length
      }
    };
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    _captureReasoning: boolean,
    _puzzleId?: string
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
    let resultPayload: any = {};

    if (response.output_parsed && typeof response.output_parsed === "object") {
      resultPayload = { ...response.output_parsed };
    } else if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
      resultPayload = this.extractJsonFromResponse(response.output_text, modelKey);
    } else if (Array.isArray(response.output) && response.output.length > 0) {
      const fallbackText = this.extractTextFromOutputBlocks(response.output);
      if (fallbackText) {
        resultPayload = this.extractJsonFromResponse(fallbackText, modelKey);
      } else {
        resultPayload = {
          _rawResponse: JSON.stringify(response.output),
          _parseError: "No text content found in output blocks",
          _parsingFailed: true,
          _parseMethod: "fallback"
        };
      }
    } else {
      resultPayload = {
        _rawResponse: JSON.stringify(response.raw_response ?? response),
        _parseError: "No structured output provided",
        _parsingFailed: true,
        _parseMethod: "fallback"
      };
    }

    if (typeof resultPayload === "object" && resultPayload !== null) {
      resultPayload._providerRawResponse = response.raw_response;
    }

    const tokenUsage: TokenUsage = response.tokenUsage ?? { input: 0, output: 0 };

    return {
      result: resultPayload,
      tokenUsage,
      reasoningLog: null,
      reasoningItems: [],
      status: response.status,
      incomplete: response.status === "incomplete" || Boolean(response.incomplete_details?.reason),
      incompleteReason: response.incomplete_details?.reason,
      responseId: response.id ?? null
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    taskId?: string
  ): Promise<any> {
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      throw new Error("GROK_API_KEY is not configured");
    }

    const messages = this.buildMessages(promptPackage);

    const requestPayload: Record<string, unknown> = {
      model: getApiModelName(modelKey),
      input: messages,
      store: serviceOpts.store ?? true,
      parallel_tool_calls: false,
      truncation: "auto",
      previous_response_id: serviceOpts.previousResponseId,
      ...(modelSupportsTemperature(modelKey) && { temperature }),
      ...(typeof serviceOpts.maxOutputTokens === "number" && serviceOpts.maxOutputTokens > 0
        ? { max_output_tokens: serviceOpts.maxOutputTokens }
        : {})
    };

    if (this.supportsStructuredOutput(modelKey)) {
      requestPayload.response_format = {
        type: "json_schema",
        json_schema: GROK_JSON_SCHEMA.schema
      };
    }

    return this.callResponsesApiWithRetry(requestPayload, apiKey, modelKey, taskId);
  }

  private buildMessages(promptPackage: PromptPackage): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (promptPackage.systemPrompt) {
      messages.push({ role: "system", content: promptPackage.systemPrompt });
    }
    messages.push({ role: "user", content: promptPackage.userPrompt });
    return messages;
  }

  private supportsStructuredOutput(modelKey: string): boolean {
    const modelName = getApiModelName(modelKey);
    return modelName.startsWith("grok-4");
  }

  private async callResponsesApiWithRetry(
    payload: Record<string, unknown>,
    apiKey: string,
    modelKey: string,
    taskId?: string
  ): Promise<any> {
    const maxRetries = Math.max(0, Number(process.env.XAI_MAX_RETRIES ?? DEFAULT_MAX_RETRIES));
    const baseDelayMs = Math.max(200, Number(process.env.XAI_RETRY_BASE_DELAY_MS ?? DEFAULT_RETRY_BASE_DELAY_MS));

    let attempt = 0;
    let lastError: unknown = null;
    let bodyForRetry: any = { ...payload };

    while (attempt <= maxRetries) {
      attempt += 1;
      try {
        const response = await undiciRequest(GROK_RESPONSES_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyForRetry),
          dispatcher: XAI_SHARED_AGENT,
          signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS)
        });

        const responseText = await response.body.text();

        if (response.statusCode >= 200 && response.statusCode < 300) {
          const parsed = JSON.parse(responseText);
          return this.enhanceProviderResponse(parsed, modelKey, taskId);
        }

        const shouldRetry = this.shouldRetryStatus(response.statusCode);
        const grammarError = this.isGrammarError(responseText);

        if (grammarError && bodyForRetry.response_format) {
          logger.service(this.provider, `Disabling structured output for ${modelKey} after grammar error (attempt ${attempt})`);
          const { response_format, ...rest } = bodyForRetry;
          bodyForRetry = rest;
          await this.delayWithJitter(baseDelayMs);
          continue;
        }

        if (shouldRetry && attempt <= maxRetries) {
          logger.service(this.provider, `Retrying Grok request (status ${response.statusCode}) for ${modelKey}, attempt ${attempt}/${maxRetries + 1}`);
          await this.delayWithJitter(baseDelayMs);
          continue;
        }

        throw new Error(`xAI Responses API error: ${response.statusCode} - ${responseText}`);
      } catch (error) {
        lastError = error;
        if (this.isTransientNetworkError(error) && attempt <= maxRetries) {
          logger.service(this.provider, `Transient Grok error (attempt ${attempt}/${maxRetries + 1}) - retrying`, "warn");
          await this.delayWithJitter(baseDelayMs);
          continue;
        }
        throw error;
      }
    }

    throw (lastError instanceof Error ? lastError : new Error("xAI Responses API failed after retries"));
  }

  private enhanceProviderResponse(raw: any, modelKey: string, taskId?: string) {
    const tokenUsage = this.extractTokenUsage(raw, modelKey, taskId);

    return {
      id: raw.id,
      status: raw.status,
      incomplete_details: raw.incomplete_details,
      output_text: raw.output_text ?? this.extractTextFromOutputBlocks(raw.output),
      output_parsed: raw.output_parsed,
      output: raw.output,
      raw_response: raw,
      tokenUsage
    };
  }

  private extractTokenUsage(raw: any, modelKey: string, taskId?: string): TokenUsage {
    const usage = raw?.usage ?? {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const reasoningTokens = usage.output_tokens_details?.reasoning_tokens;

    if ((!inputTokens && !outputTokens) && taskId) {
      logger.service(this.provider, `Token usage missing for ${modelKey} (task ${taskId})`, "warn");
    }

    return {
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens && reasoningTokens > 0 ? reasoningTokens : undefined
    };
  }

  private shouldRetryStatus(statusCode: number): boolean {
    if (statusCode === 429) {
      return true;
    }
    return statusCode >= 500 && statusCode < 600;
  }

  private isGrammarError(responseText: string): boolean {
    return /grammar|schema/i.test(responseText);
  }

  private isTransientNetworkError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /(ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|ECONNREFUSED)/i.test(message);
  }

  private async delayWithJitter(baseDelayMs: number): Promise<void> {
    const jitter = Math.floor(Math.random() * 300);
    await new Promise(resolve => setTimeout(resolve, baseDelayMs + jitter));
  }

  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) {
      return "";
    }

    for (const block of output) {
      if (typeof block?.text === "string" && block.text.trim().length > 0) {
        return block.text;
      }

      if (Array.isArray(block?.content)) {
        const textEntry = block.content.find((c: any) => typeof c?.text === "string");
        if (textEntry?.text) {
          return textEntry.text;
        }
      }

      if (typeof block?.content === "string" && block.content.trim().length > 0) {
        return block.content;
      }
    }

    return "";
  }
}

export const grokService = new GrokService();

