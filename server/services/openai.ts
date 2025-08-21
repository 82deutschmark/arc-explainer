/**
 * OpenAI service for analyzing ARC puzzles using OpenAI models
 * Supports reasoning log capture for OpenAI reasoning models (o3-mini, o4-mini, o3-2025-04-16)
 * These models automatically provide reasoning logs in response.choices[0].message.reasoning
 * 
 * @author Cascade
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder";
import type { PromptOptions } from "./promptBuilder"; // Cascade: modular prompt options

const MODELS = {
  "gpt-4.1-nano-2025-04-14": "gpt-4.1-nano-2025-04-14",
  "gpt-4.1-mini-2025-04-14": "gpt-4.1-mini-2025-04-14",
  "gpt-4o-mini-2024-07-18": "gpt-4o-mini-2024-07-18",
  "o3-mini-2025-01-31": "o3-mini-2025-01-31",
  "o4-mini-2025-04-16": "o4-mini-2025-04-16",
  "o3-2025-04-16": "o3-2025-04-16",
  "gpt-4.1-2025-04-14": "gpt-4.1-2025-04-14",
  "gpt-5-2025-08-07": "gpt-5",
  "gpt-5-chat-latest": "gpt-5-chat-latest",
  "gpt-5-mini-2025-08-07": "gpt-5-mini",
  "gpt-5-nano-2025-08-07": "gpt-5-nano",
} as const;

// Models that do NOT support temperature parameter
const MODELS_WITHOUT_TEMPERATURE = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16",
  "o3-2025-04-16",
]);

// Models that support reasoning logs (OpenAI reasoning models)
const MODELS_WITH_REASONING = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16", 
  "o3-2025-04-16",
  "gpt-5-2025-08-07",
  "gpt-5-chat-latest",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
]);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { previousResponseId?: string; maxSteps?: number; reasoningSummary?: 'auto' | 'none'; maxRetries?: number; maxOutputTokens?: number }
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    try {
      let reasoningLog = null;
      let hasReasoningLog = false;
      let result: any = {};

      const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
      console.log(`[OpenAI] Using Responses API for model ${modelKey} (reasoning=${isReasoningModel})`);

      // Build request to Responses API via helper for consistent parsing
      const request = {
        model: modelName,
        input: prompt,
        reasoning: captureReasoning && isReasoningModel
          ? { summary: serviceOpts?.reasoningSummary || 'auto' }
          : undefined,
        max_steps: serviceOpts?.maxSteps,
        previous_response_id: serviceOpts?.previousResponseId,
        temperature: undefined,
        // pass through visible output token cap to avoid starvation
        max_output_tokens: serviceOpts?.maxOutputTokens,
      } as const;

      const maxRetries = Math.max(0, serviceOpts?.maxRetries ?? 2);
      let lastErr: any = null;
      let parsedResponse: any = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          parsedResponse = await this.callResponsesAPI(request as any);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(`[OpenAI] Responses call failed (attempt ${attempt + 1}/${maxRetries + 1}). Backing off ${backoffMs}ms`);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
        }
      }
      if (!parsedResponse) throw lastErr || new Error('Responses call failed');

      // Parse output_text JSON
      const rawJson = parsedResponse.output_text || '';
      try {
        result = rawJson ? JSON.parse(rawJson) : {};
      } catch (e) {
        console.warn('[OpenAI] Failed to parse JSON output_text; returning empty result.');
        result = {};
      }

      // Extract reasoning summary/items
      const providerResponseId = parsedResponse.id ?? null;
      const reasoningItems = parsedResponse.output_reasoning?.items ?? [];
      const providerRawResponse = parsedResponse.raw_response;

      if (captureReasoning) {
        const summary = parsedResponse.output_reasoning?.summary;
        if (summary) {
          if (Array.isArray(summary)) {
            reasoningLog = summary.map((s: any) => s?.text ?? '').join('\n');
          } else if (typeof summary === 'string') {
            reasoningLog = summary;
          }
          hasReasoningLog = !!reasoningLog;
        }
      }

      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
        providerResponseId,
        providerRawResponse,
        reasoningItems,
        ...result,
      };
    } catch (error) {
      console.error(`Error with model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a preview of the exact prompt that will be sent to OpenAI
   * Shows the provider-specific message format and structure
   */
  async generatePromptPreview(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // Responses API format for all models
    let messageFormat: any;
    let providerSpecificNotes: string[] = [];

    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    messageFormat = {
      model: modelName,
      input: [{ role: "user", content: prompt }],
      max_output_tokens: 100000, // Near maximum capacity for comprehensive analysis
      ...(isReasoningModel
        ? { reasoning: { effort: "high", summary: "detailed" } }
        : {})
    };
    providerSpecificNotes.push("Uses OpenAI Responses API");
    providerSpecificNotes.push("Temperature/JSON response_format not used; JSON enforced via prompt");

    return {
      provider: "OpenAI",
      modelName,
      promptText: prompt,
      messageFormat,
      templateInfo: {
        id: selectedTemplate?.id || "custom",
        name: selectedTemplate?.name || "Custom Prompt",
        usesEmojis: selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: prompt.length,
        wordCount: prompt.split(/\s+/).length,
        lineCount: prompt.split('\n').length
      },
      providerSpecificNotes,
      captureReasoning,
      temperature: MODELS_WITH_REASONING.has(modelKey) ? "Not supported" : temperature
    };
  }

  async callResponsesAPI(request: {
    model: string;
    input: string;
    reasoning?: { summary: 'auto' | 'none' };
    max_steps?: number;
    temperature?: number;
    previous_response_id?: string;
    max_output_tokens?: number;
  }): Promise<any> {
    // Call OpenAI Responses API for structured reasoning
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log('[OPENAI-RESPONSES-DEBUG] Making Responses API call:', {
      model: request.model,
      maxSteps: request.max_steps,
      hasPreviousId: !!request.previous_response_id,
      maxOutputTokens: request.max_output_tokens ?? 'default'
    });

    try {
      // Prepare the request for OpenAI's Responses API
      const responsesRequest: any = {
        model: request.model,
        input: [{ role: "user", content: request.input }], // FIXED: Must be array format
        max_output_tokens: Math.max(256, request.max_output_tokens ?? 2048),
        ...(request.reasoning && { reasoning: { 
          summary: request.reasoning.summary, 
          effort: "high" // CORRECTED: Use high reasoning effort
        }}),
        // REMOVED: max_steps - not supported in Responses API
        ...(request.previous_response_id && { previous_response_id: request.previous_response_id })
        // REMOVED: temperature - not supported in Responses API
      };

      // Make the API call to OpenAI's Responses endpoint
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responsesRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OPENAI-RESPONSES-DEBUG] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('[OPENAI-RESPONSES-DEBUG] API Response:', {
        id: result.id,
        hasOutputReasoning: !!result.output_reasoning,
        hasOutputText: !!result.output_text,
        hasOutput: !!result.output,
        reasoningItemsCount: result.output_reasoning?.items?.length || 0,
        reasoningSummary: result.output_reasoning?.summary?.substring(0, 100)
      });

      // Enhanced response parsing according to migration plan
      const parsedResponse = {
        id: result.id,
        output_text: result.output_text || this.extractTextFromOutputBlocks(result.output),
        output_reasoning: {
          summary: result.output_reasoning?.summary || this.extractReasoningFromOutputBlocks(result.output),
          items: result.output_reasoning?.items || []
        },
        raw_response: result // For debugging
      };

      console.log('[OPENAI-RESPONSES-DEBUG] Parsed Response:', {
        hasOutputText: !!parsedResponse.output_text,
        reasoningSummaryLength: parsedResponse.output_reasoning.summary?.length || 0,
        reasoningItemsCount: parsedResponse.output_reasoning.items.length
      });

      return parsedResponse;

    } catch (error) {
      console.error('[OPENAI-RESPONSES-DEBUG] Error calling Responses API:', error);
      throw error;
    }
  }

  // Helper methods for parsing Responses API output blocks
  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) return '';
    
    // Look for message/content blocks
    for (const block of output) {
      if (block.type === 'message' && block.content) {
        return block.content;
      }
      if (block.type === 'text' && block.text) {
        return block.text;
      }
    }
    
    // Fallback: join all text-like content
    return output
      .filter(block => block.content || block.text)
      .map(block => block.content || block.text)
      .join('\n');
  }

  private extractReasoningFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) return '';
    
    // Look for reasoning blocks
    const reasoningBlocks = output.filter(block => 
      block.type === 'reasoning' || 
      (block.type === 'message' && block.role === 'reasoning')
    );
    
    return reasoningBlocks
      .map(block => block.content || block.text || block.summary)
      .filter(Boolean)
      .join('\n');
  }
}

export const openaiService = new OpenAIService();
