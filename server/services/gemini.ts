/**
 * Google Gemini Service Integration for ARC-AGI Puzzle Analysis
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade / Gemini Pro 2.5 (original), Claude (refactor)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS, getApiModelName } from "../config/models/index.js";

// Helper function to check if model supports temperature
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? true; // Most Gemini models support temperature
}

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export class GeminiService extends BaseAIService {
  protected provider = "Gemini";
  protected models = {
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
    "gemini-1.5-pro": "gemini-1.5-pro",
    "gemini-1.5-flash": "gemini-1.5-flash",
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
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, options);
      
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
    const apiModelName = getApiModelName(modelKey);
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    const modelName = apiModelName || modelKey;
    
    // Check if it's a thinking model (Gemini 2.5 Pro/Flash have thinking capabilities)
    const isThinking = modelName.includes('2.5');
    
    return {
      name: modelName,
      isReasoning: isThinking, // Gemini 2.5+ models have thinking capabilities
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.maxOutputTokens || 8192, // Gemini typically has large context windows
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false, // Gemini doesn't support structured output format
      supportsVision: true // Most Gemini models support vision
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
    const modelName = getApiModelName(modelKey) || modelKey;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';
    const temperature = options?.temperature ?? 0.2; // Default for Gemini

    // Get model configuration for max tokens
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    const maxTokens = modelConfig?.maxOutputTokens || 65536;

    // Build generation config with thinking support for 2.5+ models
    const generationConfig: any = {
      maxOutputTokens: maxTokens,
      ...(modelSupportsTemperature(modelKey) && { temperature }),
      ...(options?.topP && { topP: options.topP }),
      ...(options?.candidateCount && { candidateCount: options.candidateCount })
    };

    // Add thinking config for Gemini 2.5+ models if thinkingBudget is specified
    if (modelName.includes('2.5') && options?.thinkingBudget !== undefined) {
      generationConfig.thinking_config = {
        thinking_budget: options.thinkingBudget
      };
    } else if (modelName.includes('2.5') && options?.thinkingBudget === undefined) {
      // Default to dynamic thinking (-1) for 2.5+ models when not specified
      generationConfig.thinking_config = {
        thinking_budget: -1
      };
    }

    // Build request format for Gemini API
    const messageFormat: any = {
      model: modelName,
      generationConfig,
      contents: [
        {
          role: "user",
          parts: [{ text: systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}` }]
        }
      ],
      ...(systemMessage && systemPromptMode === 'ARC' && {
        systemInstruction: { parts: [{ text: systemMessage }] }
      })
    };

    const providerSpecificNotes = [
      "Uses Google GenAI SDK",
      "Supports system instructions (separate from user content)",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using systemInstruction parameter"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing (no structured output support)",
      modelName.includes('2.5') ? "Thinking model - supports internal reasoning" : "Standard model",
      modelName.includes('2.5') && generationConfig.thinking_config 
        ? `Thinking Budget: ${generationConfig.thinking_config.thinking_budget === -1 ? 'Dynamic' : generationConfig.thinking_config.thinking_budget}`
        : ""
    ].filter(note => note); // Remove empty strings

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
    serviceOpts: ServiceOptions,
    options: PromptOptions = {}
  ): Promise<any> {
    const apiModelName = getApiModelName(modelKey);
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Get model configuration for max tokens
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    const maxTokens = modelConfig?.maxOutputTokens || 65536;

    // Build generation config with thinking support for 2.5+ models
    const generationConfig: any = {
      maxOutputTokens: maxTokens,
      ...(modelSupportsTemperature(modelKey) && { temperature }),
      ...(options?.topP && { topP: options.topP }),
      ...(options?.candidateCount && { candidateCount: options.candidateCount })
    };

    // Add thinking config for Gemini 2.5+ models if thinkingBudget is specified
    if (modelKey.includes('2.5') && options?.thinkingBudget !== undefined) {
      generationConfig.thinking_config = {
        thinking_budget: options.thinkingBudget
      };
      console.log(`[Gemini] Setting thinking_budget to ${options.thinkingBudget} for model ${modelKey}`);
    } else if (modelKey.includes('2.5') && options?.thinkingBudget === undefined) {
      // Default to dynamic thinking (-1) for 2.5+ models when not specified
      generationConfig.thinking_config = {
        thinking_budget: -1
      };
      console.log(`[Gemini] Defaulting to dynamic thinking (budget: -1) for model ${modelKey}`);
    }

    const model = genai.getGenerativeModel({ 
      model: apiModelName,
      generationConfig,
      ...(systemMessage && systemPromptMode === 'ARC' && {
        systemInstruction: { role: "system", parts: [{ text: systemMessage }] }
      })
    });

    // Combine system and user messages if not using ARC mode
    const finalPrompt = systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`;

    const result = await model.generateContent(finalPrompt);
    return result.response;
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
    // Extract text content from Gemini response with better error handling
    let textContent = '';
    try {
      textContent = response.text() || '';
      console.log(`[Gemini] Raw response length: ${textContent.length} chars`);
      console.log(`[Gemini] Response preview: "${textContent.substring(0, 100)}..."`);
    } catch (error) {
      console.error(`[Gemini] Error extracting text from response:`, error);
      throw new Error(`Failed to extract text content from Gemini response: ${error}`);
    }
    
    // Extract JSON using inherited method (now with improved sanitization)
    const result = this.extractJsonFromResponse(textContent, modelKey);

    // Extract token usage (Gemini provides usage info)
    const tokenUsage: TokenUsage = {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
      // Gemini doesn't provide separate reasoning tokens
    };

    // For thinking models, try to extract reasoning from response
    let reasoningLog = null;
    if (captureReasoning && modelKey.includes('2.5')) {
      console.log(`[Gemini] Attempting to extract reasoning for thinking model: ${modelKey}`);
      
      // Look for <thinking> tags or similar patterns
      const thinkingMatch = textContent.match(/<thinking>(.*?)<\/thinking>/s);
      if (thinkingMatch) {
        reasoningLog = thinkingMatch[1].trim();
        console.log(`[Gemini] Found <thinking> tags, extracted ${reasoningLog.length} chars of reasoning`);
      } else if (textContent.includes('Let me think') || textContent.includes('I need to') || 
                 textContent.includes('First,') || textContent.includes('Looking at')) {
        // Extract reasoning sections that contain thinking patterns
        const reasoningParts = textContent.split(/Let me think|I need to|First,|Looking at/);
        if (reasoningParts.length > 1) {
          reasoningLog = reasoningParts.slice(0, -1).join('\n\n').trim();
          console.log(`[Gemini] Found reasoning patterns, extracted ${reasoningLog.length} chars`);
        }
      } else {
        console.log(`[Gemini] No explicit reasoning patterns found for thinking model`);
      }
    }

    console.log(`[Gemini] Parse complete - result keys: ${Object.keys(result).join(', ')}`);
    
    // Extract reasoningItems from the JSON response
    let reasoningItems: any[] = [];
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      console.log(`[Gemini] Extracted ${reasoningItems.length} reasoning items from JSON response`);
    }
    
    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems
    };
  }
}

export const geminiService = new GeminiService();