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
        this.parseProviderResponse(response, modelKey, true);

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
      contextWindow: modelConfig?.maxOutputTokens || 118192, // Gemini typically has large context windows
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

    // Build generation config with thinking support for 2.5+ models
    const generationConfig: any = {
      ...(MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens && { maxOutputTokens: MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens }),
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

    // Build generation config with thinking support for 2.5+ models
    const generationConfig: any = {
      ...(MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens && { maxOutputTokens: MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens }),
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
    console.log(`[Gemini] Parsing response structure for model: ${modelKey}`);
    
    // Parse candidates[].content.parts[] structure instead of regex textContent
    let textContent = '';
    let thoughtSignature = null;
    
    try {
      // Access the structured response
      const candidates = response.candidates || [];
      if (candidates.length > 0) {
        const candidate = candidates[0];
        const content = candidate.content;
        
        // Extract thoughtSignature if available (Gemini 2.5+ thinking models)
        if (candidate.thoughtSignature && modelKey.includes('2.5')) {
          thoughtSignature = candidate.thoughtSignature;
          console.log(`[Gemini] Found thoughtSignature: ${thoughtSignature}`);
        }
        
        // Extract reasoning and answer parts using proper Gemini structure
        if (content && content.parts) {
          const parts = content.parts;
          
          // Extract reasoning parts (thought: true) and answer parts (thought !== true)
          const reasoningParts = parts.filter((p: any) => p.thought === true);
          const answerParts = parts.filter((p: any) => p.thought !== true);
          
          console.log(`[Gemini] Found ${reasoningParts.length} reasoning parts and ${answerParts.length} answer parts`);
          
          // Extract text content from answer parts only
          textContent = answerParts
            .filter((part: any) => part.text)
            .map((part: any) => part.text)
            .join('');
            
          // Store reasoning parts for later extraction
          (response as any)._reasoningParts = reasoningParts;
          
          console.log(`[Gemini] Reasoning parts preview:`, reasoningParts.slice(0, 2));
        }
      }
      
      if (!textContent) {
        // Fallback to legacy text() method if structured parsing fails
        textContent = response.text() || '';
        console.log(`[Gemini] Fallback to legacy text() method`);
      }
      
      console.log(`[Gemini] Extracted text content: ${textContent.length} chars`);
      console.log(`[Gemini] Preview: "${textContent.substring(0, 100)}..."`);
      
    } catch (error) {
      console.error(`[Gemini] Error parsing structured response:`, error);
      throw new Error(`Failed to parse Gemini response structure: ${error}`);
    }
    
    // Extract JSON using inherited method
    const result = this.extractJsonFromResponse(textContent, modelKey);

    // Extract token usage (Gemini provides usage info)
    const tokenUsage: TokenUsage = {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
      reasoning: response.usageMetadata?.reasoningTokenCount || 0, // May be available for thinking models
    };

    // Extract reasoning log from reasoning parts (thought: true)
    let reasoningLog = null;
    if (captureReasoning) {
      const reasoningParts = (response as any)._reasoningParts || [];
      
      if (reasoningParts.length > 0) {
        // Extract text from reasoning parts and combine
        const reasoningTexts = reasoningParts
          .filter((part: any) => part.text)
          .map((part: any) => part.text)
          .filter(Boolean);
          
        if (reasoningTexts.length > 0) {
          reasoningLog = reasoningTexts.join('\n\n');
          console.log(`[Gemini] Extracted reasoning from ${reasoningTexts.length} thought parts: ${reasoningLog.length} chars`);
        }
      }
      
      // Store thoughtSignatures for potential continuation (but don't use as reasoning log)
      if (thoughtSignature && modelKey.includes('2.5')) {
        (response as any)._thoughtSignatures = [thoughtSignature];
        console.log(`[Gemini] Stored thoughtSignature for continuation: ${thoughtSignature.substring(0, 50)}...`);
      }
    }

    console.log(`[Gemini] Parse complete - result keys: ${Object.keys(result).join(', ')}`);
    
    // Extract reasoningItems from both JSON response and reasoning parts
    let reasoningItems: any[] = [];
    
    // Priority 1: Extract from JSON response if available
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      console.log(`[Gemini] Extracted ${reasoningItems.length} reasoning items from JSON response`);
    }
    // Priority 2: If no JSON reasoning items, create from reasoning parts
    else if (captureReasoning) {
      const reasoningParts = (response as any)._reasoningParts || [];
      if (reasoningParts.length > 0) {
        reasoningItems = reasoningParts
          .filter((part: any) => part.text && part.text.trim().length > 10)
          .map((part: any, index: number) => `Reasoning step ${index + 1}: ${part.text.trim()}`)
          .slice(0, 10); // Limit to prevent overflow
          
        console.log(`[Gemini] Created ${reasoningItems.length} reasoning items from thought parts`);
      }
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