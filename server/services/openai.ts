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
  "gpt-5-2025-08-07": "gpt-5-2025-08-07",
  "gpt-5-chat-latest": "gpt-5-chat-latest",
  "gpt-5-mini-2025-08-07": "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07": "gpt-5-nano-2025-08-07",
} as const;

// Models that do NOT support temperature parameter
const MODELS_WITHOUT_TEMPERATURE = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16",
  "o3-2025-04-16",
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
]);

// Older models that support reasoning logs (o3/o4 series)
const O3_O4_REASONING_MODELS = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16", 
  "o3-2025-04-16",
]);

// Newest GPT-5 models that support advanced reasoning parameters
const GPT5_REASONING_MODELS = new Set([
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
]);

// GPT-5 Chat models (support temperature, no reasoning)
const GPT5_CHAT_MODELS = new Set([
  "gpt-5-chat-latest",
]);

// All models that support reasoning
const MODELS_WITH_REASONING = new Set([
  ...O3_O4_REASONING_MODELS,
  ...GPT5_REASONING_MODELS,
]);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { 
      previousResponseId?: string; 
      maxSteps?: number; 
      reasoningSummary?: 'auto' | 'none'; 
      maxRetries?: number; 
      maxOutputTokens?: number;
      // GPT-5 reasoning parameters
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    try {
      let reasoningLog = null;
      let hasReasoningLog = false;
      let result: any = {};

      const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
      const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
      const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
      const isGPT5ChatModel = GPT5_CHAT_MODELS.has(modelKey);
      console.log(`[OpenAI] Using Responses API for model ${modelKey} (reasoning=${isReasoningModel}, gpt5=${isGPT5Model}, o3o4=${isO3O4Model}, gpt5chat=${isGPT5ChatModel})`);

      // Build reasoning config based on model type
      let reasoningConfig = undefined;
      let textConfig = undefined;
      if (captureReasoning && isReasoningModel) {
        if (isGPT5Model) {
          // GPT-5 models support advanced reasoning parameters
          reasoningConfig = {
            effort: serviceOpts?.reasoningEffort || 'medium',
            summary: serviceOpts?.reasoningSummaryType || serviceOpts?.reasoningSummary || 'auto'
          };
          // Text config is separate for GPT-5 models
          textConfig = {
            verbosity: serviceOpts?.reasoningVerbosity || 'medium'
          };
        } else if (isO3O4Model) {
          // o3/o4 models use simpler reasoning config
          reasoningConfig = {
            summary: serviceOpts?.reasoningSummary || 'auto'
          };
        }
      }

      // Build request to Responses API via helper for consistent parsing
      const request = {
        model: modelName,
        input: prompt,
        reasoning: reasoningConfig,
        ...(textConfig && { text: textConfig }),
        max_steps: serviceOpts?.maxSteps,
        previous_response_id: serviceOpts?.previousResponseId,
        // ONLY the GPT-5 Chat model supports temperature and top_p
        ...(isGPT5ChatModel && {
          temperature: temperature || 0.2,
          top_p: 1.00
        }),
        // pass through visible output token cap to avoid starvation
        max_output_tokens: serviceOpts?.maxOutputTokens || (isGPT5ChatModel ? 16384 : undefined),
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

      // Parse output_text JSON with fallback to extracting from output blocks
      let rawJson = parsedResponse.output_text || '';
      
      // If no output_text but we have output blocks, extract text from them
      if (!rawJson && parsedResponse.raw_response?.output) {
        rawJson = this.extractTextFromOutputBlocks(parsedResponse.raw_response.output);
      }
      
      try {
        result = rawJson ? JSON.parse(rawJson) : {};
      } catch (e) {
        console.warn('[OpenAI] Failed to parse JSON, trying to extract JSON from text');
        const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.warn('[OpenAI] All JSON parsing failed, returning empty result');
            result = {};
          }
        } else {
          result = {};
        }
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
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { 
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // Responses API format for all models
    let messageFormat: any;
    let providerSpecificNotes: string[] = [];

    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
    
    messageFormat = {
      model: modelName,
      input: [{ role: "user", content: prompt }],
      max_output_tokens: 100000, // Near maximum capacity for comprehensive analysis
      ...(isReasoningModel
        ? { 
            reasoning: isGPT5Model 
              ? { 
                  effort: serviceOpts?.reasoningEffort || "medium",
                  summary: serviceOpts?.reasoningSummaryType || "detailed" 
                }
              : { summary: "detailed" },
            ...(isGPT5Model && {
              text: { verbosity: serviceOpts?.reasoningVerbosity || "medium" }
            })
          }
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
        max_output_tokens: Math.max(256, request.max_output_tokens ?? 128000),
        store: true,
        ...(request.reasoning && { reasoning: request.reasoning }),
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

  // Helper method for parsing Responses API output blocks
  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) return '';
    
    // Look for Assistant blocks first
    const assistantBlock = output.find(block => 
      block.type === 'Assistant' || block.role === 'assistant'
    );
    
    if (assistantBlock) {
      if (Array.isArray(assistantBlock.content)) {
        const textContent = assistantBlock.content.find((c: any) => c.type === 'text');
        if (textContent?.text) return textContent.text;
      }
      if (typeof assistantBlock.content === 'string') return assistantBlock.content;
      if (assistantBlock.text) return assistantBlock.text;
    }
    
    // Look for other message blocks
    for (const block of output) {
      if (block.type === 'message' && block.content) {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          if (textContent?.text) return textContent.text;
        }
        if (typeof block.content === 'string') return block.content;
      }
      
      if (block.type === 'text' && block.text) {
        return block.text;
      }
    }
    
    // Fallback: join all text-like content
    return output
      .filter(block => block.content || block.text)
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || '';
        }
        return block.content || block.text;
      })
      .filter(Boolean)
      .join('\n');
  }

  private extractReasoningFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) return '';
    
    // Look for reasoning blocks
    const reasoningBlocks = output.filter(block => 
      block.type === 'reasoning' || 
      block.type === 'Reasoning' ||
      (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
    );
    
    return reasoningBlocks
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || '';
        }
        return block.content || block.text || block.summary || '';
      })
      .filter(Boolean)
      .join('\n');
  }
}

export const openaiService = new OpenAIService();
