/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Orchestrates OpenAI Responses API calls using modular helpers for payload
 *          construction, streaming aggregation, and response parsing.
 * SRP/DRY check: Pass — delegates payload building, streaming, and parsing to dedicated modules.
 * DaisyUI: Pass — backend service with no UI responsibilities.
 * @file server/services/openai.ts
 * @description OpenAI Service for ARC Puzzle Analysis
 */

import { APIUserAbortError } from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { ARCTask } from "../../shared/types.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { getOpenAISchema } from "./schemas/providers/openai.js";
import {
  BaseAIService,
  ServiceOptions,
  AIResponse,
  PromptPreview,
  ModelInfo
} from "./base/BaseAIService.js";
import {
  getApiModelName,
  getModelConfig,
  modelSupportsTemperature,
  GPT5_REASONING_MODELS,
  MODELS_WITH_REASONING,
  GPT5_CODEX_MODELS
} from "../config/models/index.js";
import { openAIClient } from "./openai/client.js";
import { buildResponsesPayload } from "./openai/payloadBuilder.js";
import {
  normalizeResponse,
  parseResponse,
  NormalizedOpenAIResponse,
  ParsedOpenAIResponse
} from "./openai/responseParser.js";
import {
  createStreamAggregates,
  handleStreamEvent,
  OpenAIStreamAggregates
} from "./openai/streaming.js";
import { normalizeModelKey } from "./openai/modelRegistry.js";

const DEFAULT_PROMPT_ID = "solver";
const STREAMING_MODEL_KEYS = [
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
  "gpt-5.1-2025-11-13",
  "gpt-5.1-codex",
  "gpt-5.1-codex-mini",
  "gpt-5-chat-latest",
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16",
  "o3-2025-04-16"
];

export class OpenAIService extends BaseAIService {
  protected provider = "OpenAI";
  protected models = {
    "gpt-4": "gpt-4",
    "gpt-4-turbo": "gpt-4-turbo",
    "o3-mini": "o3-mini",
    "o3-2025-04-16": "o3-2025-04-16",
    "gpt-5-chat-latest": "gpt-5-chat-latest",
    "gpt-5.1-codex-mini": "gpt-5.1-codex-mini"
  };

  protected getSchemaForModel(modelKey: string, testCount: number): any | null {
    if (this.supportsStructuredOutput(modelKey)) {
      return getOpenAISchema(testCount);
    }
    return null;
  }

  supportsStreaming(modelKey: string): boolean {
    const normalized = normalizeModelKey(modelKey);
    const comparisonKeys = new Set<string>();
    if (normalized) {
      comparisonKeys.add(normalized);
    }
    if (modelKey) {
      comparisonKeys.add(modelKey);
    }

    for (const key of comparisonKeys) {
      if (STREAMING_MODEL_KEYS.includes(key)) {
        return true;
      }
    }

    return STREAMING_MODEL_KEYS.some(candidate =>
      Array.from(comparisonKeys).some(key => candidate.startsWith(`${key}-`))
    );
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
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    const testCount = task.test.length;
    const captureReasoning = serviceOpts.captureReasoning !== false;

    try {
      const response = await this.callProviderAPI(
        promptPackage,
        modelKey,
        temperature,
        serviceOpts,
        testCount,
        taskId
      );

      const parsed = this.parseProviderResponse(response, modelKey, captureReasoning, taskId);
      const completeness = this.validateResponseCompleteness(response, modelKey);
      if (!completeness.isComplete) {
        console.warn(`[${this.provider}] Incomplete response detected for ${modelKey}:`, completeness.suggestion);
      }

      return this.buildStandardResponse(
        modelKey,
        temperature,
        parsed.result,
        parsed.tokenUsage,
        serviceOpts,
        parsed.reasoningLog,
        !!parsed.reasoningLog,
        parsed.reasoningItems,
        parsed.status || (completeness.isComplete ? "complete" : "incomplete"),
        parsed.incomplete ?? !completeness.isComplete,
        parsed.incompleteReason || completeness.suggestion,
        promptPackage,
        promptId,
        customPrompt,
        parsed.responseId
      );
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

    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    const harness = serviceOpts.stream;
    const controller = this.registerStream(harness);
    const startedAt = Date.now();
    const testCount = task.test.length;
    const captureReasoning = serviceOpts.captureReasoning !== false;

    try {
      const { body, expectingJsonSchema } = buildResponsesPayload({
        promptPackage,
        modelKey,
        temperature,
        serviceOpts,
        testCount,
        taskId
      });

      this.emitStreamEvent(harness, "stream.status", { state: "requested" });

      const stream = openAIClient.responses.stream(
        { ...body, stream: true },
        { signal: controller?.signal }
      );

      const aggregates: OpenAIStreamAggregates = createStreamAggregates(expectingJsonSchema);

      for await (const event of stream as AsyncIterable<ResponseStreamEvent>) {
        const eventType = (event as any)?.type;
        console.log(`[OpenAI-Stream] Received event: ${eventType}`);
        
        // Log first few reasoning/text events to verify they're coming
        if (eventType?.includes('reasoning') || eventType?.includes('text') || eventType?.includes('content')) {
          console.log(`[OpenAI-Stream] ${eventType} data:`, JSON.stringify(event).substring(0, 200));
        }
        
        handleStreamEvent(event, aggregates, {
          emitChunk: chunk => {
            console.log(`[OpenAI-Stream] Emitting chunk: type=${chunk.type}, delta length=${chunk.delta?.length || 0}`);
            this.emitStreamChunk(harness, chunk);
          },
          emitEvent: (eventName, payload) => this.emitStreamEvent(harness, eventName, payload)
        });
      }

      if ((stream as any)?.completed) {
        await (stream as any).completed;
      }

      const finalResponse = await stream.finalResponse();
      const normalized = normalizeResponse(finalResponse, {
        modelKey,
        calculateCost: (key, usage) => this.calculateResponseCost(key, usage)
      });

      const parsed = this.parseProviderResponse(normalized, modelKey, captureReasoning, taskId);
      const completeness = this.validateResponseCompleteness(normalized, modelKey);

      const finalModelResponse = this.buildStandardResponse(
        modelKey,
        temperature,
        parsed.result,
        parsed.tokenUsage,
        serviceOpts,
        parsed.reasoningLog,
        !!parsed.reasoningLog,
        parsed.reasoningItems,
        parsed.status || (completeness.isComplete ? "complete" : "incomplete"),
        parsed.incomplete ?? !completeness.isComplete,
        parsed.incompleteReason || completeness.suggestion,
        promptPackage,
        promptId,
        customPrompt,
        parsed.responseId
      );

      this.finalizeStream(harness, {
        status: "success",
        durationMs: Date.now() - startedAt,
        metadata: {
          responseId: parsed.responseId,
          tokenUsage: parsed.tokenUsage
        },
        responseSummary: {
          outputText: normalized.output_text,
          reasoningLog: parsed.reasoningLog,
          accumulatedText: aggregates.text,
          accumulatedReasoning: aggregates.reasoning,
          accumulatedReasoningSummary: aggregates.reasoningSummary,
          accumulatedSummary: aggregates.summary,
          accumulatedParsed: aggregates.parsed,
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
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = getApiModelName(modelKey);
    const normalizedKey = normalizeModelKey(modelKey);
    const isReasoning = MODELS_WITH_REASONING.has(normalizedKey);
    const modelConfig = getModelConfig(modelKey);
    const supportsTemperature = !normalizedKey.startsWith("gpt-5") && modelSupportsTemperature(normalizedKey);

    return {
      name: modelName,
      isReasoning,
      supportsTemperature,
      contextWindow: modelConfig?.contextWindow,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: !modelName.includes("gpt-5-chat-latest"),
      supportsVision: Boolean(modelConfig?.supportsVision)
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
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);

    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || "ARC";

    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    const normalizedKey = normalizeModelKey(modelKey);
    const isReasoningModel = MODELS_WITH_REASONING.has(normalizedKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey);
    const isGPT5CodexModel = GPT5_CODEX_MODELS.has(normalizedKey);

    let previewVerbosity: "low" | "medium" | "high" | undefined;
    if (isGPT5Model) {
      const requestedVerbosity = serviceOpts.reasoningVerbosity;
      if (isGPT5CodexModel) {
        // GPT-5.1 Codex models only support medium verbosity; clamp all values to medium
        previewVerbosity = "medium";
      } else {
        previewVerbosity = requestedVerbosity || "high";
      }
    }

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
          text: { verbosity: previewVerbosity }
        })
      })
    };

    const providerSpecificNotes = [
      "Uses OpenAI Responses API",
      "Temperature/JSON response_format not used; JSON enforced via prompt",
      systemPromptMode === "ARC"
        ? "System Prompt Mode: {ARC} - Using structured system prompt for better parsing"
        : "System Prompt Mode: {None} - Old behavior (all content as user message)"
    ];

    const previewText = systemPromptMode === "ARC" ? userMessage : `${systemMessage}\n\n${userMessage}`;

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
        lineCount: previewText.split("\n").length
      },
      providerSpecificNotes: providerSpecificNotes.join("; ")
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string
  ): Promise<NormalizedOpenAIResponse> {
    const { body } = buildResponsesPayload({
      promptPackage,
      modelKey,
      temperature,
      serviceOpts,
      testCount,
      taskId
    });

    return await this.callResponsesAPI(body, modelKey);
  }

  protected parseProviderResponse(
    response: NormalizedOpenAIResponse,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): ParsedOpenAIResponse {
    return parseResponse({
      response,
      modelKey,
      captureReasoning,
      deps: {
        supportsStructuredOutput: this.supportsStructuredOutput(modelKey),
        extractJson: (text: string, key: string) => this.extractJsonFromResponse(text, key)
      }
    });
  }

  private async callResponsesAPI(body: any, modelKey: string): Promise<NormalizedOpenAIResponse> {
    const startTime = Date.now();
    try {
      const response = await openAIClient.responses.create(body);
      (response as any).processingTime = Date.now() - startTime;

      return normalizeResponse(response, {
        modelKey,
        calculateCost: (key, usage) => this.calculateResponseCost(key, usage)
      });
    } catch (error) {
      console.error(`[OpenAI] API call failed for ${modelKey}:`, error);
      throw error;
    }
  }
}

export const openaiService = new OpenAIService();
