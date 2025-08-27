/**
 * xAI Grok Service Integration for ARC-AGI Puzzle Analysis
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade / Gemini Pro 2.5 (original), Claude (refactor)
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS } from "../../client/src/constants/models.js";

// Helper function to check if model supports temperature
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? false;
}

const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export class GrokService extends BaseAIService {
  protected provider = "Grok";
  protected models = {
    "grok-4-0709": "grok-4-0709",
    "grok-3": "grok-3",
    "grok-3-mini": "grok-3-mini",
    "grok-beta": "grok-beta",
    "grok-2-1212": "grok-2-1212",
    "grok-2-vision-1212": "grok-2-vision-1212",
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    // Build prompt package using inherited method
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      // Parse response using provider-specific method
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

      // Build standard response using inherited method
      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems
      );

    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = this.models[modelKey] || modelKey;
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    
    // Check if it's a reasoning model (Grok 4+ models have reasoning capabilities)
    const isReasoning = modelName.includes('grok-4') || modelName.includes('grok-3');
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.maxTokens || 128000, // Most Grok models have 128k context
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false, // Grok doesn't support structured output format
      supportsVision: modelName.includes('vision') || modelName.includes('beta') // Vision models
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): PromptPreview {
    const modelName = this.models[modelKey] || modelKey;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Create message array for Grok API (same as OpenAI format)
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    // Build message format for Grok API
    const messageFormat: any = {
      model: modelName,
      messages,
      max_tokens: 8000,
      ...(modelSupportsTemperature(modelKey) && { temperature })
    };

    const providerSpecificNotes = [
      "Uses xAI API with OpenAI SDK compatibility",
      "Base URL: https://api.x.ai/v1",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using system message role"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing",
      modelName.includes('grok-4') || modelName.includes('grok-3') 
        ? "Reasoning model - may provide built-in reasoning logs" 
        : "Standard model"
    ];

    const previewText = systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`;

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
        lineCount: previewText.split('\n').length
      },
      providerSpecificNotes: providerSpecificNotes.join('; ')
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const modelName = this.models[modelKey] || modelKey;
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Build message array for Grok API
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    const response = await grok.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 8000,
      ...(modelSupportsTemperature(modelKey) && { temperature })
    });

    return response;
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): {
    result: any;
    tokenUsage: TokenUsage;
    reasoningLog?: any;
    reasoningItems?: any[];
  } {
    // Extract text content from Grok response (OpenAI format)
    const choice = response.choices[0];
    const textContent = choice?.message?.content || '';
    
    // Extract JSON using inherited method
    const result = this.extractJsonFromResponse(textContent, modelKey);

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      // Grok doesn't provide separate reasoning tokens currently
    };

    // For reasoning models, try to extract reasoning from response
    let reasoningLog = null;
    if (captureReasoning && (modelKey.includes('grok-4') || modelKey.includes('grok-3'))) {
      // Check if Grok provides reasoning in the message (similar to OpenAI)
      if (choice?.message?.reasoning) {
        reasoningLog = choice.message.reasoning;
      } else if (textContent.includes('Let me analyze') || textContent.includes('First, I need to')) {
        // Extract reasoning sections from response text
        const reasoningParts = textContent.split(/Let me analyze|First, I need to|Looking at this|I can see that/);
        if (reasoningParts.length > 1) {
          reasoningLog = reasoningParts[0].trim();
        }
      }
    }

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems: []
    };
  }
}

export const grokService = new GrokService();