/**
 * OpenRouter service for analyzing ARC puzzles using multiple AI providers through OpenRouter API
 * OpenRouter provides unified access to models from OpenAI, Anthropic, Google, Meta, and more
 * Refactored to extend BaseAIService for code consolidation and consistency
 * 
 * @author Claude (original), Claude Code (refactor)
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { getModelConfig, getApiModelName, MODELS } from '../config/models/index.js';

// Initialize OpenRouter client with OpenAI-compatible interface
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://arc.markbarney.net", // Your site URL
    "X-Title": "ARC Explainer", // Your app name
  }
});

export class OpenRouterService extends BaseAIService {
  protected provider = "OpenRouter";
  protected models = {}; // We use centralized getApiModelName instead

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    // For OpenRouter, reasoning is always included in the prompt.
    const usePromptReasoning = true;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, usePromptReasoning);
    
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      // For OpenRouter, reasoning is always included in the prompt.
      const captureReasoning = true;
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        Boolean(reasoningLog),
        reasoningItems
      );
    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  protected async callProviderAPI(
    prompt: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const modelName = getApiModelName(modelKey);
    
    console.log(`[OpenRouter] Making API call to model: ${modelName}`);

    const chatCompletion = await openrouter.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: prompt.systemPrompt
        },
        {
          role: "user", 
          content: prompt.userPrompt
        }
      ],
      temperature: temperature,
      max_tokens: serviceOpts.maxOutputTokens || 4000,
      response_format: { type: "json_object" }
    });

    return chatCompletion;
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error(`No response choices returned from OpenRouter ${modelKey}`);
    }

    const responseText = choice.message?.content;
    if (!responseText) {
      throw new Error(`Empty response content from OpenRouter ${modelKey}`);
    }

    console.log(`[OpenRouter] Raw response length: ${responseText.length} chars`);
    console.log(`[OpenRouter] Response preview: "${responseText.substring(0, 100)}..."`);

    const result = this.extractJsonFromResponse(responseText, modelKey);

    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      reasoning: 0 // OpenRouter doesn't separate reasoning tokens
    };

    console.log(`[OpenRouter] Token usage - Input: ${tokenUsage.input}, Output: ${tokenUsage.output}`);

    // Standardized reasoning extraction with captureReasoning parameter
    let reasoningLog = null;
    if (captureReasoning) {
      console.log(`[OpenRouter] Reasoning extraction enabled for model: ${modelKey}`);
      
      if (result.reasoning) {
        reasoningLog = typeof result.reasoning === 'string' ? result.reasoning : JSON.stringify(result.reasoning);
        console.log(`[OpenRouter] Extracted reasoning from JSON 'reasoning' field: ${reasoningLog.length} chars`);
      } else {
        // Fallback to pre-JSON text extraction
        const jsonStartPattern = /```json|```\s*{|\s*{/;
        const jsonStartMatch = responseText.search(jsonStartPattern);
        if (jsonStartMatch > 20) { // If there's meaningful text before JSON
          const preJsonText = responseText.substring(0, jsonStartMatch).trim();
          if (preJsonText.length > 20) {
            reasoningLog = preJsonText;
            console.log(`[OpenRouter] Extracted pre-JSON reasoning: ${preJsonText.length} chars`);
          }
        }
      }

      if (!reasoningLog) {
        console.log(`[OpenRouter] No reasoning log found despite captureReasoning=true`);
      }
    } else {
      console.log(`[OpenRouter] Reasoning extraction disabled (captureReasoning=false)`);
    }

    console.log(`[OpenRouter] Parse complete - result keys: ${Object.keys(result).join(', ')}`);

    // Extract reasoningItems from the JSON response
    let reasoningItems: any[] = [];
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      console.log(`[OpenRouter] Extracted ${reasoningItems.length} reasoning items from JSON response`);
    }

    return { 
      result, 
      tokenUsage, 
      reasoningLog,
      reasoningItems
    };
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelConfig = getModelConfig(modelKey);
    
    if (!modelConfig) {
      console.warn(`[OpenRouter] No configuration found for model: ${modelKey}`);
      // Return sensible defaults for unknown OpenRouter models
      return {
        name: modelKey,
        isReasoning: false,
        supportsTemperature: true,
        contextWindow: 32000, // Reasonable default
        supportsFunctionCalling: false,
        supportsSystemPrompts: true,
        supportsStructuredOutput: true,
        supportsVision: false
      };
    }

    return {
      name: modelConfig.name,
      isReasoning: modelConfig.isReasoning || false,
      supportsTemperature: modelConfig.supportsTemperature || true,
      contextWindow: modelConfig.contextWindow || 32000,
      supportsFunctionCalling: modelConfig.supportsFunctionCalling || false,
      supportsSystemPrompts: modelConfig.supportsSystemPrompts !== false,
      supportsStructuredOutput: modelConfig.supportsStructuredOutput !== false,
      supportsVision: modelConfig.supportsVision || false
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): PromptPreview {
    const promptPackage = this.buildPromptPackage(task, promptId || getDefaultPromptId(), customPrompt, options, serviceOpts);
    const modelName = getApiModelName(modelKey);
    
    const messages = [
      {
        role: "system",
        content: promptPackage.systemPrompt
      },
      {
        role: "user", 
        content: promptPackage.userPrompt
      }
    ];

    const fullPromptText = `System: ${promptPackage.systemPrompt}\n\nUser: ${promptPackage.userPrompt}`;

    return {
      provider: this.provider,
      modelName: modelName,
      promptText: fullPromptText,
      messageFormat: messages,
      systemPromptMode: serviceOpts?.systemPromptMode || 'ARC',
      templateInfo: {
        id: promptId || getDefaultPromptId(),
        name: promptPackage.templateName || 'Default',
        usesEmojis: promptPackage.templateName?.includes('emoji') || false
      },
      promptStats: {
        characterCount: fullPromptText.length,
        wordCount: fullPromptText.split(/\s+/).length,
        lineCount: fullPromptText.split('\n').length
      },
      providerSpecificNotes: "OpenRouter provides unified access to multiple AI providers. Response format and capabilities may vary by underlying model."
    };
  }
}

// Export singleton instance
export const openrouterService = new OpenRouterService();