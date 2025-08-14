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

      // Use Responses API for reasoning models, ChatCompletions for others
      if (MODELS_WITH_REASONING.has(modelKey)) {
        console.log(`[OpenAI] Using Responses API for reasoning model ${modelKey}`);
        
        const responsesOptions: any = {
          model: modelName,
          input: [{ role: "user", content: prompt }],
          reasoning: {
            effort: "medium",
            summary: "detailed"
          }
        };

        // Note: Responses API doesn't support temperature or text.format
        // JSON output is requested via prompt instructions instead

        response = await openai.responses.create(responsesOptions);

        // Extract JSON result from Responses API output_text
        const rawJson = (response as any).output_text || "";
        
        try {
          result = rawJson ? JSON.parse(rawJson) : {};
        } catch (e) {
          console.warn("[OpenAI] Failed to parse JSON output:", rawJson.substring(0, 200), e);
          result = {};
        }

        // Extract reasoning logs from Responses API output array
        if (captureReasoning) {
          const reasoningParts: string[] = [];
          
          // The Responses API returns reasoning in the output array with type: "reasoning"
          for (const outputItem of (response as any).output ?? []) {
            if (outputItem.type === "reasoning") {
              // Handle both summary array and direct text formats
              if (Array.isArray(outputItem.summary)) {
                reasoningParts.push(outputItem.summary.map((s: any) => s.text).join("\n"));
              } else if (typeof outputItem.summary === 'string') {
                reasoningParts.push(outputItem.summary);
              } else if (outputItem.reasoning) {
                // Some formats might have direct reasoning text
                reasoningParts.push(outputItem.reasoning);
              }
            }
          }

          if (reasoningParts.length) {
            reasoningLog = reasoningParts.join("\n\n");
            hasReasoningLog = true;
            console.log(`[OpenAI] Successfully captured reasoning log for model ${modelKey} (${reasoningLog.length} characters)`);
          } else {
            console.log(`[OpenAI] No reasoning log found in Responses API output for model ${modelKey}`);
            
            // Debug: log the full response structure for troubleshooting
            console.log(`[OpenAI] Debug - Response structure:`, JSON.stringify((response as any).output?.slice(0, 3), null, 2));
          }
        }
      } else {
        console.log(`[OpenAI] Using ChatCompletions API for standard model ${modelKey}`);
        
        const chatOptions: any = {
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        };

        // Only add temperature for models that support it
        if (!MODELS_WITHOUT_TEMPERATURE.has(modelKey)) {
          chatOptions.temperature = temperature;
        }

        response = await openai.chat.completions.create(chatOptions);
        result = JSON.parse(response.choices[0].message.content || "{}");
        
        console.log(`[OpenAI] Standard model ${modelKey} - no reasoning logs available`);
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

    // Determine message format based on model type
    let messageFormat: any;
    let providerSpecificNotes: string[] = [];

    if (MODELS_WITH_REASONING.has(modelKey)) {
      // Responses API format for reasoning models
      messageFormat = {
        model: modelName,
        input: [{ role: "user", content: prompt }],
        reasoning: {
          effort: "medium",
          summary: "detailed"
        }
      };
      providerSpecificNotes.push("Uses OpenAI Responses API for reasoning capture");
      providerSpecificNotes.push("Temperature and JSON format not supported in Responses API");
    } else {
      // Standard ChatCompletions API format
      messageFormat = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: temperature,
        response_format: { type: "json_object" }
      };
      providerSpecificNotes.push("Uses OpenAI ChatCompletions API");
      providerSpecificNotes.push("JSON response format enforced");
    }

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
}

export const openaiService = new OpenAIService();
