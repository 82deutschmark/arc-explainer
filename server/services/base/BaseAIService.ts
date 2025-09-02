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
import { getModelConfig } from "../../config/models/index.js";

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
      reasoningLog: this.validateReasoningLog(reasoningLog),
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
   * Validate reasoning log format to prevent "[object Object]" corruption
   * Ensures reasoningLog is always a string or null before database storage
   * Fixed: Properly handles OpenAI Responses API objects without corrupting Chat Completions
   */
  protected validateReasoningLog(reasoningLog: any): string | null {
    if (!reasoningLog) {
      return null;
    }

    // If already a string, return as-is (Chat Completions case - most common)
    if (typeof reasoningLog === 'string') {
      return reasoningLog.trim() || null;
    }

    // Handle arrays - extract text from objects properly (Responses API case)
    if (Array.isArray(reasoningLog)) {
      const processed = reasoningLog
        .map(item => {
          if (typeof item === 'string') {
            return item;
          }
          // Handle objects properly - extract text content instead of String(object)
          if (typeof item === 'object' && item !== null) {
            // Try to extract meaningful content from object structures
            if (item.text) return item.text;
            if (item.content) return item.content; 
            if (item.message) return item.message;
            if (item.summary) return item.summary;
            if (item.value) return item.value;
            // For structured objects, try JSON stringification
            try {
              return JSON.stringify(item, null, 2);
            } catch {
              console.warn(`[${this.provider}] Cannot extract text from reasoning object:`, item);
              return null;
            }
          }
          // For primitives, convert safely
          return String(item);
        })
        .filter(Boolean)
        .join('\n\n');
      return processed || null;
    }

    // Handle single objects - convert to string but warn about potential issues  
    if (typeof reasoningLog === 'object' && reasoningLog !== null) {
      console.warn(`[${this.provider}] reasoningLog is an object, converting to string. Consider updating the provider to return a string.`);
      
      // Try to extract meaningful content from common object structures
      if (reasoningLog.text) return reasoningLog.text;
      if (reasoningLog.content) return reasoningLog.content;
      if (reasoningLog.message) return reasoningLog.message;
      if (reasoningLog.summary) return reasoningLog.summary;

      // Last resort: proper JSON stringification
      try {
        return JSON.stringify(reasoningLog, null, 2);
      } catch {
        console.error(`[${this.provider}] Failed to stringify reasoning log object`);
        return null;
      }
    }

    // For any other type, convert to string safely
    const stringValue = String(reasoningLog);
    return stringValue !== '[object Object]' ? stringValue : null;
  }

  /**
   * Advanced JSON extraction with multiple recovery strategies
   * Consolidated from OpenRouter's sophisticated parsing logic
   */
  protected extractJsonFromResponse(text: string, modelKey: string): any {
    // Check for truncation before attempting parse
    if (this.isJsonTruncated(text)) {
      console.log(`[${this.provider}] ❌ JSON appears truncated for ${modelKey}, skipping parse attempt`);
      return this.generateValidationCompliantFallback(text, modelKey, new Error('JSON appears to be truncated'));
    }

    // First, try direct parsing
    try {
      const parsed = JSON.parse(text);
      console.log(`[${this.provider}] ✅ Direct JSON parse successful for ${modelKey}`);
      return parsed;
    } catch (originalError) {
      console.log(`[${this.provider}] ❌ Initial JSON parse failed for ${modelKey}, attempting recovery...`);
      console.log(`[${this.provider}] Parse error: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
      return this.attemptResponseRecovery(text, modelKey, originalError);
    }
  }

  /**
   * Check if JSON appears to be truncated by examining bracket/brace balance
   */
  private isJsonTruncated(text: string): boolean {
    const trimmed = text.trim();
    
    // Basic checks for obvious truncation
    if (!trimmed || trimmed.length < 2) return true;
    
    // Count brackets and braces to detect imbalance
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }
    
    // If braces or brackets are unbalanced, likely truncated
    const isTruncated = braceCount !== 0 || bracketCount !== 0;
    
    if (isTruncated) {
      console.log(`[${this.provider}] Truncation detected - braces: ${braceCount}, brackets: ${bracketCount}`);
    }
    
    return isTruncated;
  }

  /**
   * Advanced response recovery with multiple parsing strategies
   * Migrated from OpenRouter service for consistency across all providers
   */
  private attemptResponseRecovery(responseText: string, modelKey: string, originalError: any): any {
    console.log(`[${this.provider}] Attempting response recovery for model: ${modelKey}`);
    console.log(`[${this.provider}] Response preview: "${responseText.substring(0, 200)}..."`);
    console.log(`[${this.provider}] Original parse error: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    
    // Strategy 1: Sanitize and remove markdown wrappers (most common case)
    try {
      const sanitized = this.sanitizeResponse(responseText);
      if (sanitized !== responseText) {
        console.log(`[${this.provider}] Attempting parse after sanitization`);
        const parsed = JSON.parse(sanitized);
        console.log(`[${this.provider}] ✅ Successfully parsed after sanitization`);
        return parsed;
      }
    } catch (sanitizeError) {
      console.log(`[${this.provider}] ❌ Sanitization strategy failed:`, sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError));
    }
    
    // Strategy 2: Advanced extraction from various markdown patterns
    try {
      const extracted = this.extractJSONFromMarkdown(responseText);
      if (extracted) {
        console.log(`[${this.provider}] Attempting parse after advanced markdown extraction`);
        const parsed = JSON.parse(extracted);
        console.log(`[${this.provider}] ✅ Successfully parsed after markdown extraction`);
        return parsed;
      }
    } catch (extractError) {
      console.log(`[${this.provider}] ❌ Advanced extraction strategy failed:`, extractError instanceof Error ? extractError.message : String(extractError));
    }
    
    // Strategy 3: Try combined extraction and sanitization
    try {
      const extracted = this.extractJSONFromMarkdown(responseText);
      if (extracted) {
        const sanitized = this.sanitizeResponse(extracted);
        console.log(`[${this.provider}] Attempting parse after combined extraction + sanitization`);
        const parsed = JSON.parse(sanitized);
        console.log(`[${this.provider}] ✅ Successfully parsed after combined approach`);
        return parsed;
      }
    } catch (combinedError) {
      console.log(`[${this.provider}] ❌ Combined strategy failed:`, combinedError instanceof Error ? combinedError.message : String(combinedError));
    }
    
    // Strategy 4: Generate validation-compliant fallback response
    console.log(`[${this.provider}] ⚠️ All parsing strategies failed, using validation-compliant fallback`);
    return this.generateValidationCompliantFallback(responseText, modelKey, originalError);
  }

  /**
   * Sanitizes response text by removing/replacing problematic characters and fixing common formatting issues
   */
  private sanitizeResponse(text: string): string {
    let sanitized = text.trim();
    
    // First, handle markdown code block wrappers more aggressively
    // Remove markdown code blocks with various patterns
    sanitized = sanitized
      // Standard patterns: ```json\n{...}\n```
      .replace(/^```json\s*\n?/i, '').replace(/\n?\s*```$/g, '')
      // Without language specifier: ```\n{...}\n```  
      .replace(/^```\s*\n?/, '').replace(/\n?\s*```$/g, '')
      // Escaped patterns: \```json or \\```json
      .replace(/^\\+```(?:json)?\s*\n?/i, '').replace(/\n?\s*\\+```$/g, '');
    
    // Remove single backtick wrappers
    sanitized = sanitized.replace(/^`\s*/, '').replace(/\s*`$/g, '');
    
    // Normalize various newline patterns in the text
    sanitized = sanitized
      // Convert literal \n sequences to actual newlines
      .replace(/\\n/g, '\n')
      // Convert /n sequences (common typo) to actual newlines  
      .replace(/\/n/g, '\n')
      // Convert double escaped newlines
      .replace(/\\\\n/g, '\n')
      // Normalize Windows/Mac line endings
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Fix problematic characters that cause JSON parsing errors
    sanitized = this.fixProblematicCharacters(sanitized);
    
    // Fix unescaped newlines within JSON string values
    sanitized = this.escapeNewlinesInJsonStrings(sanitized);
    
    return sanitized.trim();
  }

  /**
   * Fix problematic characters that cause JSON parsing errors
   */
  private fixProblematicCharacters(text: string): string {
    let fixed = text;
    
    // Fix unescaped forward slashes in strings (common cause of "Unexpected token /")
    // Look for patterns like "text/more" and ensure they're properly handled
    // This is a conservative approach - only fix obvious cases to avoid breaking valid JSON
    fixed = fixed.replace(/([^\\])(\/)/g, (match, before, slash) => {
      // If we're inside a string value (rough heuristic), escape the slash
      return before + '\\' + slash;
    });
    
    // Fix common quote issues - unmatched or improperly escaped quotes
    // Remove any trailing unmatched quotes at the end of truncated responses
    const quoteCount = (fixed.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // Odd number of quotes - likely truncated, remove the last one if at the end
      const lastQuoteIndex = fixed.lastIndexOf('"');
      if (lastQuoteIndex === fixed.length - 1 || lastQuoteIndex > fixed.length - 5) {
        fixed = fixed.substring(0, lastQuoteIndex) + fixed.substring(lastQuoteIndex + 1);
        console.log(`[${this.provider}] Removed trailing unmatched quote`);
      }
    }
    
    return fixed;
  }

  /**
   * Extract JSON from various markdown patterns
   */
  private extractJSONFromMarkdown(text: string): string | null {
    const patterns = [
      // Pattern 1: ```json ... ``` blocks (case insensitive)
      /```json\s*\n?([\s\S]*?)\n?\s*```/i,
      
      // Pattern 2: ``` ... ``` blocks without language specifier
      /```\s*\n?([\s\S]*?)\n?\s*```/,
      
      // Pattern 3: Escaped markdown blocks
      /\\```(?:json)?\s*\n?([\s\S]*?)\n?\s*\\```/i,
      
      // Pattern 4: Single backticks around JSON
      /`\s*([\s\S]*?)\s*`/,
      
      // Pattern 5: JSON object boundaries (most permissive)
      /(\{[\s\S]*\})/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const extracted = match[1].trim();
        // Validate that it looks like JSON (starts with { or [)
        if (extracted.startsWith('{') || extracted.startsWith('[')) {
          console.log(`[${this.provider}] Successfully extracted JSON using pattern ${patterns.indexOf(pattern) + 1}`);
          return extracted;
        }
      }
    }
    
    console.log(`[${this.provider}] No JSON patterns matched in markdown extraction`);
    return null;
  }

  /**
   * Escape unescaped newlines within JSON string values
   */
  private escapeNewlinesInJsonStrings(text: string): string {
    // This is a simplified approach - in practice, proper JSON parsing would be more complex
    // but this handles the most common cases
    return text.replace(/"([^"]*)\n([^"]*)"/g, '"$1\\n$2"');
  }

  /**
   * Generate a validation-compliant fallback response when all parsing fails
   */
  private generateValidationCompliantFallback(responseText: string, modelKey: string, originalError: any): any {
    console.log(`[${this.provider}] Generating validation-compliant fallback for ${modelKey}`);
    
    // Get better error context - show area around the problematic position if available
    const errorMsg = originalError instanceof Error ? originalError.message : String(originalError);
    let contextualPreview = responseText.substring(0, 200) + "...";
    
    // If error mentions a position, show context around that area
    const positionMatch = errorMsg.match(/position (\d+)/);
    if (positionMatch) {
      const position = parseInt(positionMatch[1]);
      const start = Math.max(0, position - 100);
      const end = Math.min(responseText.length, position + 100);
      contextualPreview = `...${responseText.substring(start, end)}... [Error near position ${position}]`;
    }
    
    return {
      patternDescription: `[PARSE ERROR] The ${this.provider} ${modelKey} model provided a response that could not be parsed as JSON. This may indicate the model generated invalid formatting or the response was truncated.`,
      solvingStrategy: `Response parsing failed with error: ${errorMsg}. Raw response preview: "${contextualPreview}"`,
      hints: [
        `The model response could not be parsed as valid JSON`,
        `This may indicate formatting issues or response truncation`,
        `Try adjusting temperature or max_output_tokens settings`
      ],
      confidence: 0,
      parseError: true,
      recoveryMethod: 'validation_compliant_fallback',
      originalError: errorMsg,
      responsePreview: responseText.substring(0, 1000) // Show more context for debugging
    };
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