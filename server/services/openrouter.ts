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
import { getModelConfig } from '../config/models.ts';

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
  /**
   * Attempts to recover from JSON parsing failures using multiple strategies
   */
  private attemptResponseRecovery(responseText: string, modelName: string, originalError: any): any {
    console.log(`[OpenRouter] Attempting response recovery for model: ${modelName}`);
    
    // Strategy 1: Sanitize non-UTF8 characters and retry JSON parse
    try {
      const sanitized = this.sanitizeResponse(responseText);
      if (sanitized !== responseText) {
        console.log(`[OpenRouter] Attempting parse after sanitization`);
        const parsed = JSON.parse(sanitized);
        console.log(`[OpenRouter] Successfully parsed after sanitization`);
        return parsed;
      }
    } catch (sanitizeError) {
      console.log(`[OpenRouter] Sanitization strategy failed:`, sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError));
    }
    
    // Strategy 2: Extract JSON from markdown code blocks
    try {
      const extracted = this.extractJSONFromMarkdown(responseText);
      if (extracted) {
        console.log(`[OpenRouter] Attempting parse after markdown extraction`);
        const parsed = JSON.parse(extracted);
        console.log(`[OpenRouter] Successfully parsed after markdown extraction`);
        return parsed;
      }
    } catch (extractError) {
      console.log(`[OpenRouter] Markdown extraction strategy failed:`, extractError instanceof Error ? extractError.message : String(extractError));
    }
    
    // Strategy 3: Generate validation-compliant fallback response
    const fallback = this.generateValidationCompliantFallback(responseText, modelName, originalError);
    console.log(`[OpenRouter] Using validation-compliant fallback response`);
    return fallback;
  }

  /**
   * Sanitizes response text by removing/replacing problematic characters
   */
  private sanitizeResponse(text: string): string {
    return text
      // Remove non-printable control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace common problematic Unicode characters with safe alternatives
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, '?')
      // Fix common JSON formatting issues
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
      // Fix bracket type mismatches - array brackets containing object syntax
      .replace(/\[\s*("[^"]+"\s*:\s*[^,\]]+(?:\s*,\s*"[^"]+"\s*:\s*[^,\]]+)*)\s*\]/g, '{$1}')
      // Fix unquoted object keys that use colons
      .replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*/g, '{"$1": ')
      .trim();
  }

  /**
   * Extracts JSON from markdown code blocks
   */
  private extractJSONFromMarkdown(text: string): string | null {
    // Look for JSON in markdown code blocks
    const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i;
    const match = text.match(jsonBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Look for JSON-like structure at start of response
    const jsonStartRegex = /^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/;
    const startMatch = text.match(jsonStartRegex);
    
    if (startMatch && startMatch[1]) {
      return startMatch[1].trim();
    }
    
    return null;
  }

  /**
   * Generates a validation-compliant fallback response
   */
  private generateValidationCompliantFallback(originalResponse: string, modelName: string, error: any): any {
    const truncatedResponse = originalResponse.substring(0, 500);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    return {
      patternDescription: `Model ${modelName} response parsing failed. The model provided a response but it contained formatting issues or non-standard characters that prevented JSON parsing. Original error: ${errorMsg}.`,
      solvingStrategy: `Unable to extract structured strategy from ${modelName} due to response format issues. The model may have provided insights in natural language that couldn't be parsed into the expected JSON structure.`,
      hints: [
        "Try using a different model that supports structured output better",
        "Check if the model requires specific prompt formatting",
        "Consider using OpenAI or Anthropic models for more reliable JSON responses"
      ],
      confidence: 0,
      multiplePredictedOutputs: false,
      predictedOutput: null,
      rawResponse: truncatedResponse,
      parsingError: errorMsg,
      modelUsed: modelName,
      recoveryMethod: "validation-compliant-fallback"
    };
  }

  /**
   * Normalizes response to ensure type consistency across providers
   */
  private normalizeResponse(result: any): any {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Ensure multiplePredictedOutputs is consistently a boolean
    if ('multiplePredictedOutputs' in result) {
      result.multiplePredictedOutputs = Boolean(result.multiplePredictedOutputs);
    }

    // Ensure confidence is a number
    if ('confidence' in result && typeof result.confidence !== 'number') {
      const conf = parseFloat(result.confidence);
      result.confidence = isNaN(conf) ? 0 : Math.max(0, Math.min(100, conf));
    }

    // Ensure hints is always an array
    if ('hints' in result && !Array.isArray(result.hints)) {
      result.hints = result.hints ? [String(result.hints)] : [];
    }

    // Normalize prediction fields
    if ('predictedOutput' in result && result.predictedOutput === null) {
      result.predictedOutput = undefined;
    }
    
    if ('predictedOutputs' in result && result.predictedOutputs === null) {
      result.predictedOutputs = undefined;
    }

    return result;
  }

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
    // Record start time for accurate processing duration measurement
    const startTime = Date.now();
    
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
      
      // Parse JSON response with progressive fallback strategies
      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`[OpenRouter] Successfully parsed structured JSON response`);
      } catch (parseError) {
        console.error(`[OpenRouter] JSON parse failed, attempting recovery:`, {
          model: openRouterModelName,
          responseLength: responseText.length,
          responseSample: responseText.substring(0, 200),
          parseError: parseError instanceof Error ? parseError.message : String(parseError)
        });
        
        // Progressive recovery strategies
        result = this.attemptResponseRecovery(responseText, openRouterModelName, parseError);
      }

      // Normalize result to ensure type consistency
      result = this.normalizeResponse(result);

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
        processingTimeMs: Date.now() - startTime,
        modelName: openRouterModelName, // Fixed: use modelName to match repository expectations
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
        processingTimeMs: Date.now() - startTime,
        modelName: openRouterModelName // Fixed: use modelName to match repository expectations
      };
    }
  }
}

// Export singleton instance
export const openrouterService = new OpenRouterService();