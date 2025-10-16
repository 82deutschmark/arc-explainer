/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Normalizes and parses OpenAI Responses API payloads so service orchestration
 *          can focus on control flow rather than response shape quirks.
 * SRP/DRY check: Pass — consolidates text/reasoning extraction shared by streaming and batch paths.
 */

import type { TokenUsage } from "../base/BaseAIService.js";

export interface NormalizedOpenAIResponse {
  id?: string;
  status?: string;
  output_text?: string;
  output_parsed?: any;
  output_reasoning?: {
    summary?: any;
    items?: any[];
  };
  output?: any[];
  raw_response?: any;
  error?: any;
  usage?: any;
  tokenUsage: TokenUsage;
  cost?: { total: number; input: number; output: number; reasoning?: number } | null;
  incomplete?: boolean;
  incompleteReason?: string;
  incomplete_details?: any;
}

export interface NormalizeResponseOptions {
  modelKey: string;
  calculateCost?: (
    modelKey: string,
    usage: TokenUsage
  ) => { total: number; input: number; output: number; reasoning?: number } | null;
}

export interface ParseResponseDependencies {
  supportsStructuredOutput: boolean;
  extractJson: (text: string, modelKey: string) => any;
}

export interface ParseResponseOptions {
  response: NormalizedOpenAIResponse;
  modelKey: string;
  captureReasoning: boolean;
  deps: ParseResponseDependencies;
}

export interface ParsedOpenAIResponse {
  result: any;
  tokenUsage: TokenUsage;
  reasoningLog?: any;
  reasoningItems?: any[];
  status?: string;
  incomplete?: boolean;
  incompleteReason?: string;
  responseId?: string;
}

export function normalizeResponse(
  response: any,
  options: NormalizeResponseOptions
): NormalizedOpenAIResponse {
  const usage = response?.usage ?? {};
  const tokenUsage: TokenUsage = {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    reasoning: usage.output_tokens_details?.reasoning_tokens || undefined
  };

  const cost = options.calculateCost
    ? options.calculateCost(options.modelKey, tokenUsage)
    : null;

  return {
    id: response.id,
    status: response.status,
    incomplete: response.incomplete ?? response.status === 'incomplete',
    incompleteReason: response.incomplete_reason || response.incompleteReason,
    incomplete_details: response.incomplete_details,
    output_text: response.output_text ?? extractTextFromOutputBlocks(response.output ?? []),
    output_parsed: response.output_parsed,
    output_reasoning: {
      summary: response.output_reasoning?.summary ?? extractReasoningFromOutputBlocks(response.output ?? []),
      items: response.output_reasoning?.items ?? []
    },
    output: response.output,
    raw_response: response,
    error: response.error,
    usage: response.usage,
    tokenUsage,
    cost
  };
}

export function parseResponse({
  response,
  modelKey,
  captureReasoning,
  deps
}: ParseResponseOptions): ParsedOpenAIResponse {
  const result = extractResult(response, modelKey, deps);
  const tokenUsage = response.tokenUsage;
  const { reasoningLog, reasoningItems } = extractReasoning(response, captureReasoning);

  return {
    result,
    tokenUsage,
    reasoningLog,
    reasoningItems,
    status: response.status || 'complete',
    incomplete: response.incomplete,
    incompleteReason: response.incompleteReason,
    responseId: response.id
  };
}

function extractResult(
  response: NormalizedOpenAIResponse,
  modelKey: string,
  deps: ParseResponseDependencies
): any {
  const rawResponse = response.raw_response || response;

  if (response.output_parsed) {
    const structured = {
      ...response.output_parsed,
      _providerRawResponse: rawResponse
    };
    console.log(`[OpenAI] ✅ Structured output received for ${modelKey}`);
    return structured;
  }

  if (response.output_text) {
    if (deps.supportsStructuredOutput) {
      console.warn(`[OpenAI] ⚠️ Schema requested for ${modelKey} but received output_text instead of output_parsed`);
      console.warn(`[OpenAI] ⚠️ JSON schema enforcement may have failed - model ignored format directive`);
    }
    const parsed = deps.extractJson(response.output_text, modelKey);
    if (parsed._parsingFailed) {
      console.error(`[OpenAI] JSON parsing failed for ${modelKey}, preserving raw response`);
      return {
        _rawResponse: response.output_text,
        _parseError: parsed._parseError,
        _parsingFailed: true,
        _parseMethod: parsed._parseMethod || 'jsonParser',
        _providerRawResponse: rawResponse
      };
    }

    const cleaned = { ...parsed };
    delete cleaned._rawResponse;
    delete cleaned._parseError;
    delete cleaned._parsingFailed;
    delete cleaned._parseMethod;
    return {
      ...cleaned,
      _providerRawResponse: rawResponse
    };
  }

  if (response.output && Array.isArray(response.output) && response.output.length > 0) {
    const outputBlock = response.output[0];
    if (outputBlock?.type === 'text' && outputBlock.text) {
      const parsed = deps.extractJson(outputBlock.text, modelKey);
      if (parsed._parsingFailed) {
        console.error(`[OpenAI] JSON parsing failed for output block text, preserving raw response`);
        return {
          _rawResponse: outputBlock.text,
          _parseError: parsed._parseError,
          _parsingFailed: true,
          _parseMethod: parsed._parseMethod || 'jsonParser',
          _providerRawResponse: rawResponse
        };
      }

      const cleaned = { ...parsed };
      delete cleaned._rawResponse;
      delete cleaned._parseError;
      delete cleaned._parsingFailed;
      delete cleaned._parseMethod;
      return {
        ...cleaned,
        _providerRawResponse: rawResponse
      };
    }

    console.error(`[OpenAI] Unexpected output format for ${modelKey}:`, outputBlock);
    return {
      _rawResponse: JSON.stringify(outputBlock),
      _parseError: 'Unexpected output block format',
      _parsingFailed: true,
      _parseMethod: 'fallback',
      _providerRawResponse: rawResponse
    };
  }

  console.error(`[OpenAI] No structured output found for ${modelKey}`);
  return {
    _rawResponse: JSON.stringify(rawResponse),
    _parseError: 'No structured output found',
    _parsingFailed: true,
    _parseMethod: 'fallback',
    _providerRawResponse: rawResponse
  };
}

function extractReasoning(
  response: NormalizedOpenAIResponse,
  captureReasoning: boolean
): { reasoningLog: any; reasoningItems: any[] } {
  if (!captureReasoning) {
    return { reasoningLog: null, reasoningItems: [] };
  }

  let reasoningLog: any = null;
  let reasoningItems: any[] = [];

  const summary = response.output_reasoning?.summary;
  if (Array.isArray(summary)) {
    reasoningLog = summary
      .map((s: any) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object' && 'text' in s) return s.text;
        if (s && typeof s === 'object' && 'content' in s) return (s as any).content;
        return typeof s === 'object' ? JSON.stringify(s) : String(s);
      })
      .filter(Boolean)
      .join('\n\n');
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

  if (!reasoningLog && response.output) {
    reasoningLog = extractReasoningFromOutputBlocks(response.output);
  }

  if (response.output_reasoning?.items && Array.isArray(response.output_reasoning.items)) {
    reasoningItems = response.output_reasoning.items.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && item.text) return item.text;
      return JSON.stringify(item);
    });
  }

  if ((!reasoningItems || reasoningItems.length === 0) && response.output) {
    const reasoningBlocks = response.output.filter((block: any) =>
      block && (
        block.type === 'reasoning' ||
        block.type === 'Reasoning' ||
        (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
      )
    );

    reasoningItems = reasoningBlocks
      .map((block: any) => {
        if (typeof block.content === 'string') return block.content;
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || JSON.stringify(block.content);
        }
        return JSON.stringify(block);
      })
      .filter(Boolean);
  }

  if (reasoningLog && typeof reasoningLog !== 'string') {
    try {
      reasoningLog = JSON.stringify(reasoningLog, null, 2);
    } catch (error) {
      console.error('[OpenAI] Failed to stringify reasoning log', error);
      reasoningLog = null;
    }
  }

  if (reasoningItems && !Array.isArray(reasoningItems)) {
    reasoningItems = [];
  }

  if (!reasoningLog && reasoningItems && reasoningItems.length > 0) {
    const fallback = reasoningItems
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map((item, index) => `Step ${index + 1}: ${item}`)
      .join('\n\n');
    reasoningLog = fallback || null;
  }

  return { reasoningLog, reasoningItems };
}

function extractTextFromOutputBlocks(output: any[]): string {
  if (!Array.isArray(output)) {
    return '';
  }

  const assistantBlock = output.find(block => block && (block.type === 'Assistant' || block.role === 'assistant'));
  if (assistantBlock) {
    if (Array.isArray(assistantBlock.content)) {
      const textContent = assistantBlock.content.find((c: any) => c.type === 'text' || c.type === 'output_text');
      if (textContent?.text) return textContent.text;
    }

    if (typeof assistantBlock.content === 'string') return assistantBlock.content;
    if (assistantBlock.text) return assistantBlock.text;
  }

  for (const block of output) {
    if (!block) continue;
    if (block.type === 'message' && block.content) {
      if (Array.isArray(block.content)) {
        const textContent = block.content.find((c: any) => c.type === 'text' || c.type === 'output_text');
        if (textContent?.text) return textContent.text;
      }
      if (typeof block.content === 'string') return block.content;
    }

    if (block.type === 'text' && block.text) return block.text;
  }

  return output
    .filter(block => block && (block.content || block.text))
    .map(block => {
      if (Array.isArray(block.content)) {
        const textContent = block.content.find((c: any) => c.type === 'text' || c.type === 'output_text');
        return textContent?.text || '';
      }

      const candidates = [block.content, block.text];
      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          return candidate;
        }
        if (candidate && typeof candidate === 'object') {
          if (candidate.text) return candidate.text;
          if (candidate.content) return candidate.content;
          if ((candidate as any).message) return (candidate as any).message;
          return JSON.stringify(candidate);
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function extractReasoningFromOutputBlocks(output: any[]): string {
  if (!Array.isArray(output)) {
    return '';
  }

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

      const candidates = [block.content, block.text, block.summary];
      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          return candidate;
        }
        if (candidate && typeof candidate === 'object') {
          if (candidate.text) return candidate.text;
          if (candidate.content) return candidate.content;
          if ((candidate as any).message) return (candidate as any).message;
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
