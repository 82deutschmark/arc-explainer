/**
 * OpenAI service for analyzing ARC puzzles using OpenAI models
 * Supports reasoning log capture for OpenAI reasoning models (o3-mini, o4-mini, o3-2025-04-16)
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade (original), Claude (refactor)
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { ARC_JSON_SCHEMA } from "./schemas/arcJsonSchema.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";

// Import centralized model configuration
import { 
  getModelConfig, 
  modelSupportsTemperature, 
  getApiModelName,
  O3_O4_REASONING_MODELS,
  GPT5_REASONING_MODELS,
  GPT5_CHAT_MODELS,
  MODELS_WITH_REASONING
} from '../config/models.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService extends BaseAIService {
  protected provider = "OpenAI";
  protected models = {
    "gpt-4": "gpt-4",
    "gpt-4-turbo": "gpt-4-turbo",
    "o3-mini": "o3-mini",
    "o3-2025-04-16": "o3-2025-04-16",
    "gpt-5-chat-latest": "gpt-5-chat-latest",
    // Add other models as needed
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
    const modelName = getApiModelName(modelKey);

    // Build prompt package using inherited method
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    // Log analysis start using inherited method
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      // Call provider-specific API
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      // Parse response using provider-specific method
      const { result, tokenUsage, reasoningLog, reasoningItems, status, incomplete, incompleteReason } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

      // Validate response completeness
      const completeness = this.validateResponseCompleteness(response, modelKey);
      if (!completeness.isComplete) {
        console.warn(`[${this.provider}] Incomplete response detected for ${modelKey}:`, completeness.suggestion);
      }

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
        status || (completeness.isComplete ? 'complete' : 'incomplete'),
        !completeness.isComplete,
        incompleteReason || completeness.suggestion
      );

    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = getApiModelName(modelKey);
    const isReasoning = MODELS_WITH_REASONING.has(modelKey);
    const modelConfig = getModelConfig(modelKey);
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.maxTokens || 128000,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: !modelName.includes('gpt-5-chat-latest'),
      supportsVision: false // Update based on actual capabilities
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
    const modelName = getApiModelName(modelKey);
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
    
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    const systemPromptMode = serviceOpts.systemPromptMode || 'ARC';

    // Create message array for preview
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);

    // Build message format for Responses API
    const messageFormat: any = {
      model: modelName,
      input: messages,
      max_output_tokens: 100000,
      ...(isReasoningModel && {
        reasoning: isGPT5Model 
          ? { 
              effort: serviceOpts.reasoningEffort || "medium",
              summary: serviceOpts.reasoningSummaryType || "detailed" 
            }
          : { summary: "detailed" },
        ...(isGPT5Model && {
          text: { verbosity: serviceOpts.reasoningVerbosity || "medium" }
        })
      })
    };

    const providerSpecificNotes = [
      "Uses OpenAI Responses API",
      "Temperature/JSON response_format not used; JSON enforced via prompt",
      systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using structured system prompt for better parsing"
        : "System Prompt Mode: {None} - Old behavior (all content as user message)"
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
    const modelName = getApiModelName(modelKey);
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;

    // Build message array
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    // Build reasoning config based on model type
    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
    const isGPT5ChatModel = GPT5_CHAT_MODELS.has(modelKey);

    let reasoningConfig = undefined;
    let textConfig = undefined;
    
    if (isReasoningModel) {
      if (isGPT5Model) {
        reasoningConfig = {
          effort: serviceOpts.reasoningEffort || 'low',
          summary: serviceOpts.reasoningSummaryType || serviceOpts.reasoningSummary || 'detailed'
        };
        textConfig = {
          verbosity: serviceOpts.reasoningVerbosity || 'high'
        };
      } else if (isO3O4Model) {
        reasoningConfig = {
          summary: serviceOpts.reasoningSummary || 'auto'
        };
      }
    }

    const request = {
      model: modelName,
      input: messages,
      reasoning: reasoningConfig,
      ...(textConfig && { text: textConfig }),
      max_steps: serviceOpts.maxSteps,
      previous_response_id: serviceOpts.previousResponseId,
      ...(modelSupportsTemperature(modelKey) && {
        temperature: temperature || 0.2,
        ...(isGPT5ChatModel && { top_p: 1.00 })
      }),
      max_output_tokens: serviceOpts.maxOutputTokens || (isGPT5ChatModel ? 100000 : undefined),
    };

    // Retry logic with exponential backoff
    const maxRetries = Math.max(0, serviceOpts.maxRetries ?? 2);
    let lastErr: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.callResponsesAPI(request, modelKey);
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(`[${this.provider}] API call failed (attempt ${attempt + 1}/${maxRetries + 1}). Backing off ${backoffMs}ms`);
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }
    
    throw lastErr || new Error('API call failed after retries');
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
    status?: string;
    incomplete?: boolean;
    incompleteReason?: string;
  } {
    let result: any = {};
    let reasoningLog = null;
    let reasoningItems: any[] = [];

    // Parse JSON response - prefer structured output_parsed over regex scraping
    if (response.output_parsed) {
      console.log(`[${this.provider}] Using structured output_parsed from JSON schema`);
      result = response.output_parsed;
    } else {
      console.log(`[${this.provider}] Falling back to JSON extraction from output_text`);
      const rawJson = response.output_text || '';
      result = this.extractJsonFromResponse(rawJson, modelKey);
    }

    // Extract reasoning log from API response
    if (captureReasoning && response.output_reasoning?.summary) {
      const summary = response.output_reasoning.summary;
      if (Array.isArray(summary)) {
        reasoningLog = summary.map((s: any) => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object' && s.text) return s.text;
          if (s && typeof s === 'object' && s.content) return s.content;
          return typeof s === 'object' ? JSON.stringify(s) : String(s);
        }).filter(Boolean).join('\n\n');
      } else if (typeof summary === 'string') {
        reasoningLog = summary;
      }
    }

    // Extract reasoning items
    reasoningItems = response.output_reasoning?.items ?? [];

    // Validate reasoning data types and fix corruption
    if (reasoningLog && typeof reasoningLog !== 'string') {
      console.error(`[${this.provider}] WARNING: reasoningLog is not a string! Type: ${typeof reasoningLog}`, reasoningLog);
      reasoningLog = String(reasoningLog);
    }
    
    if (reasoningItems && !Array.isArray(reasoningItems)) {
      console.error(`[${this.provider}] WARNING: reasoningItems is not an array! Type: ${typeof reasoningItems}`, reasoningItems);
      reasoningItems = [];
    }

    // Extract token usage
    const tokenUsage: TokenUsage = {
      input: response.tokenUsage?.input || 0,
      output: response.tokenUsage?.output || 0,
      reasoning: response.tokenUsage?.reasoning
    };

    // Check for incomplete responses
    const status = response.status;
    const incomplete = status === 'incomplete';
    const incompleteReason = response.incomplete_details?.reason;

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

  private async callResponsesAPI(request: any, modelKey: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log(`[${this.provider}-RESPONSES-DEBUG] Making Responses API call:`, {
      model: request.model,
      maxSteps: request.max_steps,
      hasPreviousId: !!request.previous_response_id,
      maxOutputTokens: request.max_output_tokens ?? 'default'
    });

    try {
      // Check if model supports structured JSON schema
      const supportsStructuredOutput = !request.model.includes('gpt-5-chat-latest');
      
      // Prepare the request for OpenAI's Responses API
      const body = {
        model: request.model,
        input: Array.isArray(request.input) ? request.input : [{ role: "user", content: request.input }],
        ...(supportsStructuredOutput && {
          text: {
            format: {
              type: "json_schema",
              name: ARC_JSON_SCHEMA.name,
              strict: ARC_JSON_SCHEMA.strict,
              schema: ARC_JSON_SCHEMA.schema
            }
          }
        }),
        reasoning: request.reasoning,
        temperature: modelSupportsTemperature(modelKey) ? request.temperature : undefined,
        top_p: modelSupportsTemperature(modelKey) ? 1 : undefined,
        parallel_tool_calls: false,
        truncation: "auto",
        previous_response_id: request.previous_response_id,
        max_output_tokens: Math.max(256, request.max_output_tokens ?? 128000),
        store: request.store !== false // Default to true unless explicitly set to false
      };

      // Make the API call with 45-minute timeout
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2700000) // 45 minutes timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${this.provider}-RESPONSES-DEBUG] API Error:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      // Extract token usage from OpenAI Responses API response
      let tokenUsage: TokenUsage = { input: 0, output: 0 };
      let cost: any = undefined;
      
      if (result.usage) {
        const inputTokens = result.usage.input_tokens ?? 0;
        const outputTokens = result.usage.output_tokens ?? 0;
        const reasoningTokens = result.usage.output_tokens_details?.reasoning_tokens ?? 0;
        
        tokenUsage = {
          input: inputTokens,
          output: outputTokens,
          reasoning: reasoningTokens > 0 ? reasoningTokens : undefined
        };

        // Calculate cost using inherited method
        cost = this.calculateResponseCost(modelKey, tokenUsage);
      }
      
      console.log(`[${this.provider}-RESPONSES-DEBUG] API Response:`, {
        id: result.id,
        status: result.status,
        hasOutputReasoning: !!result.output_reasoning,
        hasOutputText: !!result.output_text,
        hasOutput: !!result.output,
        reasoningItemsCount: result.output_reasoning?.items?.length || 0,
        incompleteDetails: result.incomplete_details
      });

      // Enhanced response parsing with incomplete status handling
      const parsedResponse = {
        id: result.id,
        status: result.status, // Include status for incomplete response handling
        incomplete_details: result.incomplete_details, // Include incomplete details
        output_text: result.output_text || this.extractTextFromOutputBlocks(result.output),
        output_parsed: result.output_parsed,
        output_reasoning: {
          summary: result.output_reasoning?.summary || this.extractReasoningFromOutputBlocks(result.output),
          items: result.output_reasoning?.items || []
        },
        raw_response: result,
        usage: result.usage,
        tokenUsage,
        cost
      };

      return parsedResponse;

    } catch (error) {
      console.error(`[${this.provider}-RESPONSES-DEBUG] Error calling Responses API:`, error);
      throw error;
    }
  }

  // Helper methods extracted from original implementation
  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) {
      return '';
    }
    
    // Look for Assistant blocks first
    const assistantBlock = output.find(block => 
      block.type === 'Assistant' || block.role === 'assistant'
    );
    
    if (assistantBlock) {
      if (Array.isArray(assistantBlock.content)) {
        const textContent = assistantBlock.content.find((c: any) => 
          c.type === 'text' || c.type === 'output_text'
        );
        if (textContent?.text) return textContent.text;
      }
      if (typeof assistantBlock.content === 'string') return assistantBlock.content;
      if (assistantBlock.text) return assistantBlock.text;
    }
    
    // Look for other message blocks
    for (const block of output) {
      if (block.type === 'message' && block.content) {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => 
            c.type === 'text' || c.type === 'output_text'
          );
          if (textContent?.text) return textContent.text;
        }
        if (typeof block.content === 'string') return block.content;
      }
      
      if (block.type === 'text' && block.text) return block.text;
    }
    
    // Fallback: join all text-like content
    return output
      .filter(block => block.content || block.text)
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => 
            c.type === 'text' || c.type === 'output_text'
          );
          return textContent?.text || '';
        }
        return block.content || block.text;
      })
      .filter(Boolean)
      .join('\n');
  }

  private extractReasoningFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) return '';
    
    const reasoningBlocks = output.filter(block => 
      block.type === 'reasoning' || 
      block.type === 'Reasoning' ||
      (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
    );
    
    const reasoningText = reasoningBlocks
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || '';
        }
        return block.content || block.text || block.summary || '';
      })
      .filter(Boolean)
      .join('\n');
    
    if (!reasoningText || 
        reasoningText.toLowerCase().includes('empty reasoning') ||
        reasoningText.trim() === '') {
      return '';
    }
    
    return reasoningText;
  }
}

export const openaiService = new OpenAIService();