/**
 * Base abstract class for all AI service implementations
 * Eliminates 90%+ code duplication across AI providers
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { ARCTask } from "../../../shared/types.js";
import { buildAnalysisPrompt, getDefaultPromptId } from "../promptBuilder.js";
import type { PromptOptions, PromptPackage } from "../promptBuilder.js";
import { calculateCost } from "../../utils/costCalculator.js";
import { getModelConfig } from "../../config/models.js";

// Common types for all AI services
export interface ServiceOptions {
  previousResponseId?: string;
  maxSteps?: number;
  reasoningSummary?: 'auto' | 'none' | 'detailed';
  maxRetries?: number;
  maxOutputTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  reasoningVerbosity?: 'low' | 'medium' | 'high';
  reasoningSummaryType?: 'auto' | 'detailed';
  systemPromptMode?: 'ARC' | 'None';
  store?: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
  reasoning?: number;
}

export interface AIResponse {
  model: string;
  reasoningLog: any;
  hasReasoningLog: boolean;
  temperature: number;
  reasoningEffort?: string | null;
  reasoningVerbosity?: string | null;
  reasoningSummaryType?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  status?: string;
  incomplete?: boolean;
  incompleteReason?: string;
  reasoningItems?: any[];
  [key: string]: any; // Allow additional provider-specific fields
}

export interface PromptPreview {
  provider: string;
  modelName: string;
  promptText: string;
  messageFormat: any;
  systemPromptMode?: string;
  templateInfo: {
    id: string;
    name: string;
    usesEmojis: boolean;
  };
  promptStats: {
    characterCount: number;
    wordCount: number;
    lineCount: number;
  };
  providerSpecificNotes?: string;
}

export interface ModelInfo {
  name: string;
  isReasoning: boolean;
  supportsTemperature: boolean;
  contextWindow: number;
  supportsFunctionCalling: boolean;
  supportsSystemPrompts: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
}

/**
 * Abstract base class for all AI service implementations
 * Provides common functionality and enforces consistent interface
 */
export abstract class BaseAIService {
  protected abstract provider: string;
  protected abstract models: Record<string, string>;

  /**
   * Main analysis method - must be implemented by each provider
   */
  abstract analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature?: number,
    captureReasoning?: boolean,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): Promise<AIResponse>;

  /**
   * Get model information - must be implemented by each provider
   */
  abstract getModelInfo(modelKey: string): ModelInfo;

  /**
   * Generate prompt preview - must be implemented by each provider
   */
  abstract generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): PromptPreview;

  /**
   * Provider-specific API call - must be implemented by each provider
   */
  protected abstract callProviderAPI(
    prompt: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any>;

  /**
   * Parse provider response - must be implemented by each provider
   */
  protected abstract parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string };

  /**
   * Build prompt package using centralized prompt builder
   */
  protected buildPromptPackage(
    task: ARCTask,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): PromptPackage {
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    return buildAnalysisPrompt(task, promptId, customPrompt, {
      ...options,
      systemPromptMode,
      useStructuredOutput: true
    });
  }

  /**
   * Calculate cost from token usage
   */
  protected calculateResponseCost(
    modelKey: string,
    tokenUsage: TokenUsage
  ): { total: number; input: number; output: number; reasoning?: number } | null {
    try {
      const modelConfig = getModelConfig(modelKey);
      if (!modelConfig?.cost) {
        console.warn(`[${this.provider}] No cost configuration found for model: ${modelKey}`);
        return null;
      }
      
      const costBreakdown = calculateCost(modelConfig.cost, tokenUsage);
      return {
        total: costBreakdown.total,
        input: costBreakdown.input,
        output: costBreakdown.output,
        reasoning: costBreakdown.reasoning
      };
    } catch (error) {
      console.warn(`[${this.provider}] Cost calculation failed:`, error);
      return null;
    }
  }

  /**
   * Build standard response object
   */
  protected buildStandardResponse(
    modelKey: string,
    temperature: number,
    result: any,
    tokenUsage: TokenUsage,
    serviceOpts: ServiceOptions,
    reasoningLog?: any,
    hasReasoningLog: boolean = false,
    reasoningItems?: any[],
    status?: string,
    incomplete?: boolean,
    incompleteReason?: string
  ): AIResponse {
    const cost = this.calculateResponseCost(modelKey, tokenUsage);
    
    return {
      model: modelKey,
      reasoningLog: reasoningLog || null,
      hasReasoningLog,
      temperature,
      reasoningEffort: serviceOpts.reasoningEffort || null,
      reasoningVerbosity: serviceOpts.reasoningVerbosity || null,
      reasoningSummaryType: serviceOpts.reasoningSummaryType || null,
      inputTokens: tokenUsage.input || null,
      outputTokens: tokenUsage.output || null,
      reasoningTokens: tokenUsage.reasoning || null,
      totalTokens: tokenUsage.input + tokenUsage.output + (tokenUsage.reasoning || 0),
      estimatedCost: cost?.total || null,
      status,
      incomplete,
      incompleteReason,
      reasoningItems,
      ...result
    };
  }

  /**
   * Simple JSON extraction for non-OpenAI providers
   */
  protected extractJsonFromResponse(text: string, modelKey: string): any {
    try {
      return JSON.parse(text);
    } catch {
      // Try to find JSON within the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          console.warn(`[${this.provider}] JSON extraction failed for ${modelKey}`);
        }
      }
      
      console.error(`[${this.provider}] All JSON extraction methods failed for ${modelKey}`);
      throw new Error(`Failed to extract valid JSON response from ${this.provider} ${modelKey}`);
    }
  }

  /**
   * Validate response completeness and handle incomplete responses
   */
  protected validateResponseCompleteness(
    response: any,
    modelKey: string
  ): { isComplete: boolean; partialContent?: string; suggestion?: string } {
    // Check for common indicators of incomplete responses
    if (response.status === 'incomplete' || response.incomplete === true) {
      return {
        isComplete: false,
        partialContent: response.output_text || response.content || "Partial response received",
        suggestion: response.incomplete_details?.reason === 'max_output_tokens' 
          ? "Try increasing max_output_tokens setting"
          : "Response was incomplete - try again"
      };
    }

    // Check for truncated content indicators
    const content = response.content || response.output_text || '';
    if (content.endsWith('...') || content.includes('[truncated]')) {
      return {
        isComplete: false,
        partialContent: content,
        suggestion: "Response appears truncated - try increasing max_output_tokens"
      };
    }

    return { isComplete: true };
  }

  /**
   * Log analysis parameters for debugging
   */
  protected logAnalysisStart(
    modelKey: string,
    temperature: number,
    promptLength: number,
    serviceOpts: ServiceOptions
  ): void {
    console.log(`[${this.provider}] Starting analysis with model ${modelKey}`);
    console.log(`[${this.provider}] Temperature: ${temperature}`);
    console.log(`[${this.provider}] Prompt length: ${promptLength} chars`);
    
    if (serviceOpts.reasoningEffort) {
      console.log(`[${this.provider}] Reasoning effort: ${serviceOpts.reasoningEffort}`);
    }
    if (serviceOpts.reasoningVerbosity) {
      console.log(`[${this.provider}] Reasoning verbosity: ${serviceOpts.reasoningVerbosity}`);
    }
    if (serviceOpts.maxOutputTokens) {
      console.log(`[${this.provider}] Max output tokens: ${serviceOpts.maxOutputTokens}`);
    }
  }

  /**
   * Handle and log errors consistently across providers
   */
  protected handleAnalysisError(error: any, modelKey: string, task?: ARCTask): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${this.provider}] Analysis failed for model ${modelKey}:`, errorMessage);
    
    // Enhance error with context
    const contextualError = new Error(
      `${this.provider} ${modelKey} analysis failed: ${errorMessage}`
    );
    
    // Preserve original error details
    if (error instanceof Error) {
      contextualError.stack = error.stack;
      (contextualError as any).originalError = error;
    }
    
    throw contextualError;
  }
}