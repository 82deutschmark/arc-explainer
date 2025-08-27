/**
 * OpenRouter service for analyzing ARC puzzles using multiple AI providers through OpenRouter API
 * OpenRouter provides unified access to models from OpenAI, Anthropic, Google, Meta, and more
 * 
 * @author Claude
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { calculateCost } from "../utils/costCalculator.js";
import { getModelConfig } from '../config/models.js';

// Initialize OpenRouter client with OpenAI-compatible interface
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://arc.markbarney.net", // Your site URL
    "X-Title": "ARC Explainer", // Your app name
  }
});

export class OpenRouterService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { 
      systemPromptMode?: 'ARC' | 'None';
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
      maxOutputTokens?: number;
    }
  ) {
    // Get model config to determine actual OpenRouter model name
    const modelConfig = getModelConfig(modelKey);
    const openRouterModelName = modelConfig?.apiModelName || modelKey;

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    // Build prompt package using new architecture
    const promptPackage: PromptPackage = buildAnalysisPrompt(task, promptId, customPrompt, {
      ...options,
      systemPromptMode,
      useStructuredOutput: false // OpenRouter compatibility varies by model
    });
    
    console.log(`[OpenRouter] Using system prompt mode: ${systemPromptMode}`);
    console.log(`[OpenRouter] Model: ${openRouterModelName}`);
    
    // Extract system and user prompts from prompt package
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    
    console.log(`[OpenRouter] System prompt: ${systemMessage.length} chars`);
    console.log(`[OpenRouter] User prompt: ${userMessage.length} chars`);

    try {
      // Build messages array
      const messages: any[] = [];
      
      // Add system message if provided
      if (systemMessage && systemPromptMode === 'ARC') {
        messages.push({ role: "system", content: systemMessage });
      }
      
      messages.push({ role: "user", content: userMessage });

      // Build request options
      const requestOptions: any = {
        model: openRouterModelName,
        messages: messages,
        temperature: temperature,
        max_tokens: serviceOpts?.maxOutputTokens || modelConfig?.maxOutputTokens || 4000,
      };

      console.log(`[OpenRouter] Making API call with model: ${openRouterModelName}`);
      const response = await openrouter.chat.completions.create(requestOptions);
      
      const responseText = response.choices[0]?.message?.content || "";
      
      // Parse JSON response - we request structured format so should be clean JSON
      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`[OpenRouter] Successfully parsed structured JSON response`);
      } catch (parseError) {
        console.error(`[OpenRouter] JSON parse failed, preserving raw response for debugging:`, {
          model: openRouterModelName,
          responseLength: responseText.length,
          responseSample: responseText.substring(0, 200),
          parseError: parseError instanceof Error ? parseError.message : String(parseError)
        });
        
        // Simple fallback - preserve original response as text
        result = {
          patternDescription: `Raw response (parse failed): ${responseText}`,
          solvingStrategy: "JSON parsing failed - raw response preserved",
          hints: ["Check response format", "Verify model supports structured output"],
          confidence: 0,
          rawResponse: responseText // Preserve for debugging
        };
      }

      // Extract token usage from OpenRouter response
      let tokenUsage: { input: number; output: number; reasoning?: number } | undefined;
      let cost: { input: number; output: number; reasoning?: number; total: number } | undefined;
      
      if (response.usage) {
        const inputTokens = response.usage.prompt_tokens ?? 0;
        const outputTokens = response.usage.completion_tokens ?? 0;
        
        tokenUsage = {
          input: inputTokens,
          output: outputTokens,
        };

        // Calculate cost using model configuration
        if (modelConfig && tokenUsage) {
          cost = calculateCost(modelConfig.cost, tokenUsage);
        }
      }

      return {
        success: true,
        result,
        tokenUsage,
        cost,
        processingTimeMs: Date.now(),
        modelUsed: openRouterModelName,
        reasoning: null, // OpenRouter doesn't provide separate reasoning logs
        reasoningLog: null
      };

    } catch (error: any) {
      console.error(`[OpenRouter] Error with model ${openRouterModelName}:`, error);
      
      // Enhanced error handling for common OpenRouter errors
      let errorMessage = 'Unknown error occurred';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        result: null,
        tokenUsage: undefined,
        cost: undefined,
        processingTimeMs: Date.now(),
        modelUsed: openRouterModelName
      };
    }
  }
}

// Export singleton instance
export const openrouterService = new OpenRouterService();