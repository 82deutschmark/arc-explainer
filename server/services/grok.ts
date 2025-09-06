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
import { MODELS as MODEL_CONFIGS } from "../config/models/index.js";

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
    "grok-code-fast-1": "grok-code-fast-1",
    "grok-2-1212": "grok-2-1212",
    "grok-3-mini-fast": "grok-3-mini-fast",
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
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
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
    const modelName = this.models[modelKey as keyof typeof this.models] || modelKey;
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    
    // Check if it's a reasoning model (Grok 4+ models have reasoning capabilities)
    const isReasoning = modelName.includes('grok-4') || modelName.includes('grok-3');
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow || 128000, // Most Grok models have 128k context
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
    const modelName = this.models[modelKey as keyof typeof this.models] || modelKey;
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
      ...(MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens && { max_tokens: MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens })
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

  /**
   * Extracts a complete JSON object from a markdown string.
   * @param markdown The markdown string to parse.
   * @returns The parsed JSON object or null if not found.
   */
  private extractCompleteJSONObject(text: string, startPos: number): string | null {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let endPos = startPos;
    
    for (let i = startPos; i < text.length; i++) {
      const char = text[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endPos = i;
            break;
          }
        }
      }
    }
    
    if (braceCount === 0 && endPos > startPos) {
      const extracted = text.substring(startPos, endPos + 1);
      console.log(`[Grok] Extracted complete JSON object: ${extracted.length} characters`);
      return extracted;
    }
    
    return null;
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string } {
    const content = response.choices[0]?.message?.content || '';
    let result: any;

    try {
      // First, try to parse the whole content as JSON
      result = JSON.parse(content);
    } catch {
      // If that fails, find the start of a JSON object and extract it
      const braceStart = content.indexOf('{');
      if (braceStart !== -1) {
        const extractedString = this.extractCompleteJSONObject(content, braceStart);
        if (extractedString) {
          try {
            result = JSON.parse(extractedString);
          } catch (e) {
            console.error("[Grok] Failed to parse extracted JSON string.", e);
            result = null;
          }
        } else {
          result = null;
        }
      } else {
        result = null;
      }
    }

    if (!result) {
      throw new Error("Failed to extract valid JSON from Grok response");
    }

    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
    };

    const status = response.choices[0]?.finish_reason;
    const incomplete = status !== 'stop';
    const incompleteReason = incomplete ? status : undefined;

    // Extract reasoning log if requested
    let reasoningLog = null;
    if (captureReasoning) {
      console.log(`[Grok] Attempting to extract reasoning for model: ${modelKey}`);
      
      // For Grok models, look for reasoning patterns in the text before JSON
      // Grok often includes reasoning before the JSON response
      
      // Try to find text that appears before the JSON block
      const jsonStartPattern = /```json|```\s*{|\s*{/;
      const jsonStartMatch = content.search(jsonStartPattern);
      
      if (jsonStartMatch > 50) { // If there's substantial text before JSON
        const preJsonText = content.substring(0, jsonStartMatch).trim();
        if (preJsonText.length > 20) { // Meaningful reasoning content
          reasoningLog = preJsonText;
          console.log(`[Grok] Extracted pre-JSON reasoning: ${preJsonText.length} chars`);
        }
      }
  
      
      if (!reasoningLog) {
        console.log(`[Grok] No explicit reasoning patterns found - model may not provide reasoning`);
      }
    }

    // Extract reasoningItems from the JSON response
    let reasoningItems: any[] = [];
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      console.log(`[Grok] Extracted ${reasoningItems.length} reasoning items from JSON response`);
    }

    return { 
      result, 
      tokenUsage, 
      reasoningLog, 
      reasoningItems, 
      status, 
      incomplete, 
      incompleteReason 
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const modelName = this.models[modelKey as keyof typeof this.models] || modelKey;
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

    // Make the API call to Grok
    const response = await grok.chat.completions.create({
      model: modelName,
      messages,
      ...(MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens && { max_tokens: MODEL_CONFIGS.find(m => m.key === modelKey)?.maxOutputTokens }),
      ...(modelSupportsTemperature(modelKey) && { temperature })
    });

    return response;
  }

}

export const grokService = new GrokService();