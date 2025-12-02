/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Builds canonical payloads for the OpenAI Responses API so streaming and
 *          non-streaming flows share the same request construction logic.
 * SRP/DRY check: Pass — isolates payload composition and model capability checks from the service orchestration class.
 */

import type { PromptPackage } from "../promptBuilder.js";
import { getOpenAISchema } from "../schemas/providers/openai.js";
import {
  GPT5_CHAT_MODELS,
  GPT5_REASONING_MODELS,
  MODELS_WITH_REASONING,
  O3_O4_REASONING_MODELS,
  GPT5_CODEX_MODELS,
  getApiModelName,
  modelSupportsTemperature
} from "../../config/models/index.js";
import type { ServiceOptions } from "../base/BaseAIService.js";
import { normalizeModelKey } from "./modelRegistry.js";

export interface BuildResponsesPayloadParams {
  promptPackage: PromptPackage;
  modelKey: string;
  temperature: number;
  serviceOpts: ServiceOptions;
  testCount: number;
  taskId?: string;
}

export interface ResponsesPayloadResult {
  body: Record<string, any>;
  isContinuation: boolean;
  expectingJsonSchema: boolean;
}

type ResponseMessage = {
  id: string;
  role: "user" | "system" | "developer" | "assistant";
  type: "message";
  content: Array<{ type: "input_text"; text: string }>;
};

let messageCounter = 0;

function createMessage(role: ResponseMessage["role"], text: string): ResponseMessage {
  const id = `msg_${Date.now()}_${messageCounter++}`;
  return {
    id,
    role,
    type: "message",
    content: [
      {
        type: "input_text",
        text
      }
    ]
  };
}

function buildMessageArray(
  promptPackage: PromptPackage,
  isContinuation: boolean
): ResponseMessage[] {
  const userMessage = createMessage("user", promptPackage.userPrompt);

  if (isContinuation) {
    console.log("[OpenAI-Messages] Continuation mode - sending ONLY new user message with instructions field");
    return [userMessage];
  }

  console.log("[OpenAI-Messages] Initial mode - sending user input; system prompt emitted via instructions");
  return [userMessage];
}

function buildReasoningConfig(
  modelKey: string,
  serviceOpts: ServiceOptions
): Record<string, unknown> | undefined {
  const normalizedKey = normalizeModelKey(modelKey);
  if (!MODELS_WITH_REASONING.has(normalizedKey)) {
    return undefined;
  }

  if (GPT5_REASONING_MODELS.has(normalizedKey)) {
    return {
      effort: serviceOpts.reasoningEffort || "high",
      summary: serviceOpts.reasoningSummaryType || serviceOpts.reasoningSummary || "detailed"
    };
  }

  if (O3_O4_REASONING_MODELS.has(normalizedKey)) {
    return {
      summary: serviceOpts.reasoningSummary || "auto"
    };
  }

  return undefined;
}

function buildTextConfig(
  modelKey: string,
  testCount: number,
  serviceOpts: ServiceOptions
): Record<string, any> | undefined {
  const modelName = getApiModelName(modelKey);
  const normalizedKey = normalizeModelKey(modelKey);
  const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey);

  let textConfig: Record<string, unknown> | undefined;
  if (isGPT5Model) {
    const isGPT5CodexModel = GPT5_CODEX_MODELS.has(normalizedKey);
    const requestedVerbosity = serviceOpts.reasoningVerbosity;
    let effectiveVerbosity: "low" | "medium" | "high" | undefined;

    if (isGPT5CodexModel) {
      // GPT-5.1 Codex models only support medium verbosity; clamp all values to medium
      effectiveVerbosity = "medium";
    } else {
      effectiveVerbosity = requestedVerbosity || "high";
    }

    textConfig = {
      verbosity: effectiveVerbosity
    };
  }

  const supportsStructuredOutput =
    !modelName.includes("gpt-5-chat-latest") &&
    !modelName.includes("gpt-5-nano");

  let structuredFormat: Record<string, unknown> | undefined;
  if (supportsStructuredOutput) {
    const schema = getOpenAISchema(testCount);
    structuredFormat = {
      type: "json_schema",
      name: schema.name,
      strict: schema.strict,
      schema: schema.schema
    };
  }

  if (!textConfig && !structuredFormat) {
    return undefined;
  }

  return {
    ...(textConfig ?? {}),
    ...(structuredFormat ? { format: structuredFormat } : {})
  };
}

function removeUndefined(payload: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

export function buildResponsesPayload({
  promptPackage,
  modelKey,
  temperature,
  serviceOpts,
  testCount,
  taskId
}: BuildResponsesPayloadParams): ResponsesPayloadResult {
  const modelName = getApiModelName(modelKey);
  const isContinuation = Boolean(serviceOpts.previousResponseId);
  const normalizedKey = normalizeModelKey(modelKey);
  const messages = buildMessageArray(promptPackage, isContinuation);
  const reasoningConfig = buildReasoningConfig(modelKey, serviceOpts);
  const textPayload = buildTextConfig(modelKey, testCount, serviceOpts);
  const isGPT5ChatModel = GPT5_CHAT_MODELS.has(normalizedKey);
  const isGPT5Family = normalizedKey.startsWith("gpt-5");
  const supportsTemperature = !isGPT5Family && modelSupportsTemperature(normalizedKey);

  const includeInstructions = !(isContinuation && serviceOpts.suppressInstructionsOnContinuation);
  const instructions = includeInstructions ? promptPackage.systemPrompt || undefined : undefined;

  const payload = removeUndefined({
    model: modelName,
    input: messages,
    instructions,
    reasoning: reasoningConfig,
    text: textPayload,
    temperature: supportsTemperature ? (temperature ?? 0.2) : undefined,
    top_p: supportsTemperature && isGPT5ChatModel ? 1 : undefined,
    previous_response_id: serviceOpts.previousResponseId,
    store: serviceOpts.store !== false,
    parallel_tool_calls: false,
    truncation: "auto",
    // max_steps is internal to Grover/Saturn services; NOT a valid Responses API parameter
    max_output_tokens: serviceOpts.maxOutputTokens || 128000,
    metadata: taskId ? { taskId } : undefined
  });

  console.log(`[OpenAI-PayloadBuilder] Model: ${modelName}`);
  console.log(`[OpenAI-PayloadBuilder] Test count: ${testCount}`);
  console.log(`[OpenAI-PayloadBuilder] Has reasoning: ${!!reasoningConfig}`);
  console.log(`[OpenAI-PayloadBuilder] Has text config: ${!!textPayload}`);
  if (textPayload) {
    console.log(`[OpenAI-PayloadBuilder] - verbosity: ${textPayload.verbosity || 'none'}`);
    console.log(`[OpenAI-PayloadBuilder] - format: ${textPayload.format?.type || 'none'}`);
  }
  console.log(`[OpenAI-PayloadBuilder] max_output_tokens: ${payload.max_output_tokens}`);

  // ✅ VERIFICATION: Log conversation chaining configuration
  console.log(`[OpenAI-PayloadBuilder] Store: ${payload.store} (${isContinuation ? 'CONTINUATION' : 'INITIAL'})`);
  if (isContinuation) {
    if (serviceOpts.previousResponseId) {
      console.log(`[OpenAI-PayloadBuilder] ✅ Previous response ID: ${serviceOpts.previousResponseId.substring(0, 24)}...`);
    } else {
      console.warn(`[OpenAI-PayloadBuilder] ⚠️ WARNING: Continuation mode but no previousResponseId provided!`);
    }
  }

  return {
    body: payload,
    isContinuation,
    expectingJsonSchema: Boolean(textPayload?.format)
  };
}
