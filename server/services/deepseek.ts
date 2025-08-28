/**
 * DeepSeek Service Integration for ARC-AGI Puzzle Analysis
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
  return modelConfig?.supportsTemperature ?? true; // Most DeepSeek models support temperature
}

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export class DeepSeekService extends BaseAIService {
  protected provider = "DeepSeek";
  protected models = {
    "deepseek-chat": "deepseek-chat",
    "deepseek-reasoner": "deepseek-reasoner",
    "deepseek-v3": "deepseek-v3",
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
    
    // Check if it's a reasoning model (DeepSeek Reasoner has reasoning capabilities)
    const isReasoning = modelName.includes('reasoner');
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.maxTokens || 64000, // DeepSeek models typically have 64k context
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false, // DeepSeek doesn't support structured output format
      supportsVision: false // Most DeepSeek models don't support vision currently
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

    // Create message array for DeepSeek API (same as OpenAI format)
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    // Build message format for DeepSeek API
    const messageFormat: any = {
      model: modelName,
      messages,
      max_tokens: 8000,
      ...(modelSupportsTemperature(modelKey) && { temperature })
    };

    const providerSpecificNotes = [
      "Uses DeepSeek API with OpenAI SDK compatibility",
      "Base URL: https://api.deepseek.com",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using system message role"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing",
      modelName.includes('reasoner') 
        ? "Reasoning model - provides step-by-step reasoning" 
        : "Standard chat model"
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

    // Build message array for DeepSeek API
    const messages: any[] = [];
    if (systemMessage && systemPromptMode === 'ARC') {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ 
      role: "user", 
      content: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`
    });

    const response = await deepseek.chat.completions.create({
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
    // Extract text content from DeepSeek response (OpenAI format)
    const choice = response.choices[0];
    const textContent = choice?.message?.content || '';
    
    // Extract JSON using inherited method
    const result = this.extractJsonFromResponse(textContent, modelKey);

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      // DeepSeek may provide reasoning tokens for reasoning models
      reasoning: response.usage?.reasoning_tokens
    };

    // For reasoning models, try to extract reasoning from response
    let reasoningLog = null;
    if (captureReasoning && modelKey.includes('reasoner')) {
      // Check if DeepSeek provides reasoning in the message
      if (choice?.message?.reasoning_content) {
        reasoningLog = choice.message.reasoning_content;
      } else if (textContent.includes('<think>') && textContent.includes('</think>')) {
        // Extract reasoning from <think> tags
        const thinkMatch = textContent.match(/<think>(.*?)<\/think>/s);
        if (thinkMatch) {
          reasoningLog = thinkMatch[1].trim();
        }
      } else if (textContent.includes('Let me think') || textContent.includes('I need to analyze')) {
        // Extract reasoning sections from response text
        const reasoningParts = textContent.split(/Let me think|I need to analyze|First, let me|Looking at this/);
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

export const deepseekService = new DeepSeekService();