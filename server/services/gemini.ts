/**
 * @file server/services/gemini.ts
 * @description Google Gemini Service for ARC Puzzle Analysis

 *

 * This service integrates with the Google Generative AI SDK to analyze ARC puzzles using Gemini models.

 * It is responsible for:

  *  - Building prompts compatible with the Gemini API, including system instructions.

 *  - Handling model-specific features; thinking config is currently disabled pending SDK support.

 *  - Parsing the Gemini response structure, which separates `thought` parts from the main answer.

 *  - Using the centralized `jsonParser` for robust JSON extraction from the response text.

 *  - Extending the BaseAIService for a consistent analysis workflow.

 * @assessed_by Gemini 2.5 Pro

 * @assessed_on 2025-09-09

 * Author: Codex (GPT-5)

 * Date: 2025-12-18

 * PURPOSE: Direct Gemini provider integration that aligns prompts, generation config, and parsing with ARC pipeline expectations while adding Gemini 3 Flash Preview support and keeping thinking config gated until SDK updates stabilize.

 * SRP/DRY check: Pass - reuses BaseAIService and shared prompt builder; no duplicate provider logic.

 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS, getApiModelName } from "../config/models/index.js";
import { jsonParser } from '../utils/JsonParser.js';

// Helper functions scoped to Gemini models
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? true; // Most Gemini models support temperature
}

function isAdvancedGeminiModel(modelIdentifier?: string): boolean {
  if (!modelIdentifier) return false;
  const normalized = modelIdentifier.toLowerCase();
  return normalized.includes('gemini-2.5') || normalized.includes('gemini-3');
}

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export class GeminiService extends BaseAIService {
  protected provider = "Gemini";
  protected models = {
    "gemini-3-pro-preview": "gemini-3-pro-preview",
    // Expose the new Gemini 3 Flash preview so the service can request the faster reasoning tier.
    "gemini-3-flash-preview": "gemini-3-flash-preview",
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
    taskId: string,
    temperature: number = 0.2,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    // Build prompt package using inherited method
    // PHASE 12: Pass modelKey for structured output detection
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API
      if (options?.candidateCount) {
        (serviceOpts as any).candidateCount = options.candidateCount;
      }
      const testCount = task.test.length;
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts, testCount, taskId, options);
      
      // Parse response using provider-specific method
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, true, taskId);

      // Build standard response using inherited method
      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems,
        undefined, // status
        undefined, // incomplete
        undefined, // incompleteReason
        promptPackage,
        promptId,
        customPrompt
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
    const isThinking = isAdvancedGeminiModel(`${modelKey} ${modelName}`);
    
    return {
      name: modelName,
      isReasoning: modelConfig?.isReasoning ?? isThinking, // Gemini 2.5+/3 models have thinking capabilities
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow, // Use actual model context window, no artificial limit
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: modelConfig?.supportsStructuredOutput ?? true,
      supportsVision: modelConfig?.supportsVision ?? true
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
    // PHASE 12: Pass modelKey for structured output detection
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, modelKey);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';
    const temperature = options?.temperature ?? 0.2; // Default for Gemini

    const generationConfig = this._buildGenerationConfig(modelKey, temperature, options);

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
      isAdvancedGeminiModel(modelName)
        ? "Thinking config omitted: current SDK rejects thinking_config; enable after @google/genai migration."
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

  private _buildGenerationConfig(
    modelKey: string,
    temperature: number,
    options?: PromptOptions
  ): any {
    const generationConfig: any = {
      response_mime_type: 'application/json',
      ...(modelSupportsTemperature(modelKey) && { temperature }),
      ...(options?.topP !== undefined && { topP: options.topP }),
      ...(options?.candidateCount !== undefined && { candidateCount: options.candidateCount })
    };

    // Thinking config is intentionally disabled because the current Google Generative AI SDK
    // rejects `thinking_config` (e.g., gemini-3-pro-preview). Re-enable after migrating to
    // a SDK/version that supports thinkingConfig.
    return generationConfig;
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string,
    options?: PromptOptions
  ): Promise<any> {
    const apiModelName = getApiModelName(modelKey);
    const { systemPrompt: systemMessage, userPrompt: userMessage } = promptPackage;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    const generationConfig = this._buildGenerationConfig(modelKey, temperature, options);
    const model = genai.getGenerativeModel({ model: apiModelName });

    const contents = [
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ];

    const request: any = {
      contents,
      generationConfig,
    };

    if (systemMessage && systemPromptMode === 'ARC') {
      request.systemInstruction = { parts: [{ text: systemMessage }] };
    } else if (systemMessage) {
      // Prepend system message to user message if not in 'ARC' mode
      request.contents[0].parts[0].text = `${systemMessage}\n\n${userMessage}`;
    }

    const result = await model.generateContent(request);
    return result.response;
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    
    const { textContent, reasoningParts, thoughtSignature } = this._extractTextAndReasoning(response);

    // Extract JSON using the centralized parser
    const parseResult = jsonParser.parse(textContent, { fieldName: 'geminiResponse' });

    if (!parseResult.success || !parseResult.data) {
      throw new Error(`Failed to extract valid JSON from Gemini response: ${parseResult.error}`);
    }
    const result = parseResult.data;

    const tokenUsage = this._extractTokenUsage(response);

    const { reasoningLog, reasoningItems } = this._parseReasoning(
      result,
      reasoningParts,
      captureReasoning && isAdvancedGeminiModel(modelKey)
    );

    // Store thoughtSignatures for potential continuation
    if (thoughtSignature && isAdvancedGeminiModel(modelKey)) {
      (response as any)._thoughtSignatures = [thoughtSignature];
    }

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems
    };
  }

  private _extractTextAndReasoning(response: any): { textContent: string; reasoningParts: any[]; thoughtSignature: any | null } {
    let textContent = '';
    let reasoningParts: any[] = [];
    let thoughtSignature: any | null = null;

    try {
        const candidate = response.candidates?.[0];
        if (!candidate) {
            textContent = response.text?.() || '';
            return { textContent, reasoningParts, thoughtSignature };
        }

        if (candidate.thoughtSignature) {
            thoughtSignature = candidate.thoughtSignature;
        }

        if (candidate.content?.parts) {
            const allParts = candidate.content.parts;
            
            // Handle native JSON response from response_mime_type: 'application/json'
            if (allParts.length === 1 && allParts[0].text && allParts[0].text.trim().startsWith('{')) {
                textContent = allParts[0].text;
                // In native JSON mode, reasoning is expected inside the JSON itself.
                reasoningParts = []; 
            } else {
                // Fallback to multi-part parsing for streaming or non-JSON responses
                reasoningParts = allParts.filter((p: any) => p.thought === true);
                const answerParts = allParts.filter((p: any) => p.thought !== true);
                
                textContent = answerParts
                    .filter((part: any) => part.text)
                    .map((part: any) => part.text)
                    .join('');
            }
        }

        if (!textContent) {
            textContent = response.text?.() || '';
        }

    } catch (error) {
        console.error(`[Gemini] Error parsing structured response:`, error);
        // Fallback to legacy text() method if structured parsing fails
        textContent = response.text?.() || '';
    }

    return { textContent, reasoningParts, thoughtSignature };
}

  private _extractTokenUsage(response: any): TokenUsage {
    return {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
      reasoning: response.usageMetadata?.reasoningTokenCount || 0,
    };
  }

  private _parseReasoning(result: any, reasoningParts: any[], shouldParse: boolean): { reasoningLog: string | null; reasoningItems: any[] } {
    let reasoningLog: string | null = null;
    let reasoningItems: any[] = [];

    if (!shouldParse) {
      return { reasoningLog, reasoningItems };
    }

    // Priority 1: Extract from JSON response if available
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
    } 
    // Priority 2: If no JSON reasoning items, create from reasoning parts
    else if (reasoningParts.length > 0) {
      reasoningItems = reasoningParts
        .filter((part: any) => part.text && part.text.trim().length > 10)
        .map((part: any, index: number) => `Reasoning step ${index + 1}: ${part.text.trim()}`)
        .slice(0, 10); // Limit to prevent overflow
    }

    // Extract reasoning log from reasoning parts
    if (reasoningParts.length > 0) {
      const reasoningTexts = reasoningParts
        .filter((part: any) => part.text)
        .map((part: any) => part.text)
        .filter(Boolean);
        
      if (reasoningTexts.length > 0) {
        reasoningLog = reasoningTexts.join('\n\n');
      }
    }

    return { reasoningLog, reasoningItems };
  }
}

export const geminiService = new GeminiService();
