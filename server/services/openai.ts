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
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    try {
      let response: any;
      let reasoningLog = null;
      let hasReasoningLog = false;
      let result: any;

      // Unified: Use Responses API for all models
      const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
      console.log(`[OpenAI] Using Responses API for model ${modelKey} (reasoning=${isReasoningModel})`);

      const responsesOptions: any = {
        model: modelName,
        input: [{ role: "user", content: prompt }],
        // Use most of GPT-5's 128k output token capacity for detailed reasoning
        max_output_tokens: 100000, // Near maximum capacity for comprehensive analysis
      };

      if (isReasoningModel && captureReasoning) {
        responsesOptions.reasoning = {
          effort: "high",
          summary: "detailed",
        };
      }

      // Note: Responses API doesn't support temperature/response_format; enforce JSON via prompt
      console.log(`[OpenAI] Sending request to Responses API with model: ${modelName}`);

      try {
        response = await openai.responses.create(responsesOptions);
        console.log(`[OpenAI] Received response from Responses API for model: ${modelName}`);
        console.log(`[OpenAI] Response type: ${typeof response}, keys: ${Object.keys(response || {}).join(', ')}`);
      } catch (apiError) {
        console.error(`[OpenAI] Responses API error for model ${modelName}:`, apiError);
        throw apiError;
      }

      // Debug: Log the full response structure to understand format
      console.log(`[OpenAI] Full ResponsesAPI response structure:`, JSON.stringify(response, null, 2));

      // Extract JSON result from Responses API output_text
      const rawJson = (response as any).output_text || "";
      console.log(`[OpenAI] Raw JSON from output_text (${rawJson.length} chars):`, rawJson.substring(0, 500));

      // Also check if content is in output array
      if ((response as any).output && Array.isArray((response as any).output)) {
        console.log(`[OpenAI] Output array length: ${(response as any).output.length}`);
        (response as any).output.forEach((item: any, index: number) => {
          console.log(`[OpenAI] Output item ${index}:`, { type: item.type, hasContent: !!item.content, hasText: !!item.text });
        });
      }

      try {
        result = rawJson ? JSON.parse(rawJson) : {};
        console.log(`[OpenAI] Successfully parsed JSON result:`, Object.keys(result || {}).join(', '));
      } catch (e) {
        console.warn("[OpenAI] Failed to parse JSON output:", rawJson.substring(0, 200), e);

        // Try to extract JSON from output array if output_text failed
        if ((response as any).output && Array.isArray((response as any).output)) {
          for (const outputItem of (response as any).output) {
            if (outputItem.type === "message" && outputItem.content) {
              console.log(`[OpenAI] Trying to parse JSON from message content:`, outputItem.content.substring(0, 200));
              try {
                result = JSON.parse(outputItem.content);
                console.log(`[OpenAI] Successfully parsed JSON from message content`);
                break;
              } catch (msgError) {
                console.warn(`[OpenAI] Failed to parse JSON from message content:`, msgError);
              }
            }
          }
        }

        if (!result || Object.keys(result).length === 0) {
          result = {};
        }
      }

      // Extract reasoning logs from Responses API
      if (captureReasoning) {
        const reasoningParts: string[] = [];

        // Prefer structured reasoning summary if available
        const outputReasoning = (response as any).output_reasoning;
        if (outputReasoning?.summary) {
          if (Array.isArray(outputReasoning.summary)) {
            reasoningParts.push(outputReasoning.summary.map((s: any) => (s?.text ?? "")).join("\n"));
          } else if (typeof outputReasoning.summary === 'string') {
            reasoningParts.push(outputReasoning.summary);
          }
        }

        // Fallback: scan output array entries of type "reasoning"
        if (reasoningParts.length === 0) {
          for (const outputItem of (response as any).output ?? []) {
            if (outputItem.type === "reasoning") {
              if (Array.isArray(outputItem.summary)) {
                reasoningParts.push(outputItem.summary.map((s: any) => s.text).join("\n"));
              } else if (typeof outputItem.summary === 'string') {
                reasoningParts.push(outputItem.summary);
              } else if (outputItem.reasoning) {
                reasoningParts.push(outputItem.reasoning);
              }
            }
          }
        }

        if (reasoningParts.length) {
          reasoningLog = reasoningParts.join("\n\n");
          hasReasoningLog = true;
          console.log(`[OpenAI] Successfully captured reasoning log for model ${modelKey} (${reasoningLog.length} characters)`);
        } else {
          console.log(`[OpenAI] No reasoning log found in Responses API output for model ${modelKey}`);
          console.log(`[OpenAI] Debug - Response structure:`, JSON.stringify((response as any).output?.slice(0, 3), null, 2));
        }
      }
      
      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
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
  }): Promise<any> {
    // Call OpenAI Responses API for structured reasoning
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log('[OPENAI-RESPONSES-DEBUG] Making Responses API call:', {
      model: request.model,
      maxSteps: request.max_steps,
      hasPreviousId: !!request.previous_response_id
    });

    try {
      // Prepare the request for OpenAI's Responses API
      const responsesRequest: any = {
        model: request.model,
        input: [{ role: "user", content: request.input }], // FIXED: Must be array format
        max_output_tokens: 100000, // Near maximum capacity for comprehensive reasoning (GPT-5 supports 128k)
        ...(request.reasoning && { reasoning: { 
          summary: request.reasoning.summary, 
          effort: "high" // CORRECTED: Use high reasoning effort
        }}),
        ...(request.max_steps && { max_steps: request.max_steps }),
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
