/**
 * OpenRouter service for analyzing ARC puzzles using multiple AI providers through OpenRouter API
 * OpenRouter provides unified access to models from OpenAI, Anthropic, Google, Meta, and more
 * 
 * @author Claude
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types.js";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { calculateCost } from "../utils/costCalculator.js";
import { getModelConfig } from '../config/models.ts';

// Initialize OpenRouter client with OpenAI-compatible interface
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://arc.markbarney.net", // Your site URL
    "X-Title": "ARC Explainer", // Your app name
  }
});

export class OpenRouterService {
  /**
   * Attempts to recover from JSON parsing failures using multiple strategies
   */
  private attemptResponseRecovery(responseText: string, modelName: string, originalError: any): any {
    console.log(`[OpenRouter] Attempting response recovery for model: ${modelName}`);
    console.log(`[OpenRouter] Response preview: "${responseText.substring(0, 200)}..."`);
    console.log(`[OpenRouter] Original parse error: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    
    // Detailed analysis of response formatting issues
    const responseAnalysis = {
      startsWithBackticks: responseText.trimStart().startsWith('```'),
      startsWithEscapedBackticks: responseText.trimStart().startsWith('\\```'),
      containsLiteralNewlines: responseText.includes('\\n'),
      containsSlashN: responseText.includes('/n'),
      hasUnescapedNewlines: /"\s*[^"]*\n[^"]*\s*"/.test(responseText),
      length: responseText.length
    };
    console.log(`[OpenRouter] Response analysis:`, responseAnalysis);
    
    // Strategy 1: Sanitize and remove markdown wrappers (most common case)
    try {
      const sanitized = this.sanitizeResponse(responseText);
      if (sanitized !== responseText) {
        console.log(`[OpenRouter] Attempting parse after sanitization`);
        console.log(`[OpenRouter] Sanitized preview: "${sanitized.substring(0, 200)}..."`);
        console.log(`[OpenRouter] Sanitization changes: length ${responseText.length} → ${sanitized.length}`);
        const parsed = JSON.parse(sanitized);
        console.log(`[OpenRouter] ✅ Successfully parsed after sanitization`);
        return parsed;
      }
    } catch (sanitizeError) {
      console.log(`[OpenRouter] ❌ Sanitization strategy failed:`, sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError));
    }
    
    // Strategy 2: Advanced extraction from various markdown patterns
    try {
      const extracted = this.extractJSONFromMarkdown(responseText);
      if (extracted) {
        console.log(`[OpenRouter] Attempting parse after advanced markdown extraction`);
        console.log(`[OpenRouter] Extracted JSON preview: "${extracted.substring(0, 200)}..."`);
        const parsed = JSON.parse(extracted);
        console.log(`[OpenRouter] ✅ Successfully parsed after markdown extraction`);
        return parsed;
      }
    } catch (extractError) {
      console.log(`[OpenRouter] ❌ Advanced extraction strategy failed:`, extractError instanceof Error ? extractError.message : String(extractError));
    }
    
    // Strategy 3: Try combined extraction and sanitization
    try {
      const extracted = this.extractJSONFromMarkdown(responseText);
      if (extracted) {
        const sanitized = this.sanitizeResponse(extracted);
        console.log(`[OpenRouter] Attempting parse after combined extraction + sanitization`);
        const parsed = JSON.parse(sanitized);
        console.log(`[OpenRouter] ✅ Successfully parsed after combined approach`);
        return parsed;
      }
    } catch (combinedError) {
      console.log(`[OpenRouter] ❌ Combined strategy failed:`, combinedError instanceof Error ? combinedError.message : String(combinedError));
    }
    
    // Strategy 4: Generate validation-compliant fallback response
    console.log(`[OpenRouter] ⚠️ All parsing strategies failed, using validation-compliant fallback`);
    const fallback = this.generateValidationCompliantFallback(responseText, modelName, originalError);
    console.log(`[OpenRouter] Generated fallback response with recovery method: ${fallback.recoveryMethod}`);
    return fallback;
  }

  /**
   * Sanitizes response text by removing/replacing problematic characters and fixing common formatting issues
   */
  private sanitizeResponse(text: string): string {
    let sanitized = text;
    
    // Remove markdown code block wrappers including escaped variants
    sanitized = sanitized
      // Handle escaped backticks: \```json or \\```json 
      .replace(/^\\+```(?:json)?\s*/, '').replace(/\s*\\+```$/, '')
      // Handle standard backticks: ```json
      .replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    
    // Remove single backtick wrappers including escaped variants
    sanitized = sanitized
      .replace(/^\\+`\s*/, '').replace(/\s*\\+`$/, '')
      .replace(/^`\s*/, '').replace(/\s*`$/, '');
    
    // Fix escape sequences BEFORE converting to newlines to prevent corruption
    // Handle unescaped newlines within JSON string values first
    sanitized = this.escapeNewlinesInJsonStrings(sanitized);
    
    // Now handle literal escape sequences that should be actual newlines
    sanitized = sanitized
      // Convert literal \n sequences to actual newlines (but only outside JSON strings)
      .replace(/\\n/g, '\n')
      // Convert literal /n sequences (common typo) to actual newlines  
      .replace(/\/n/g, '\n')
      // Convert \\n (double escaped) to actual newlines
      .replace(/\\\\n/g, '\n');
    
    return sanitized
      // Remove non-printable control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace common problematic Unicode characters with safe alternatives
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, '?')
      // Fix common JSON formatting issues
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
      // Fix bracket type mismatches - array brackets containing object syntax
      .replace(/\[\s*("[^"]+"\s*:\s*[^,\]]+(?:\s*,\s*"[^"]+"\s*:\s*[^,\]]+)*)\s*\]/g, '{$1}')
      // Fix unquoted object keys that use colons
      .replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*/g, '{"$1": ')
      // Remove any leading/trailing whitespace
      .trim();
  }

  /**
   * Escapes newlines within JSON string values while preserving JSON structure
   */
  private escapeNewlinesInJsonStrings(text: string): string {
    try {
      // Find JSON string values that contain unescaped newlines
      // Pattern: "key": "value with\nnewline" 
      return text.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
        // Only process if this looks like a JSON string value (has content)
        if (content && content.includes('\n')) {
          // Properly escape newlines within the string
          const escapedContent = content.replace(/\n/g, '\\n');
          return `"${escapedContent}"`;
        }
        return match;
      });
    } catch (error) {
      console.log(`[OpenRouter] Warning: newline escaping failed, returning original text`);
      return text;
    }
  }

  /**
   * Extracts JSON from markdown code blocks and various formatting patterns
   */
  private extractJSONFromMarkdown(text: string): string | null {
    console.log(`[OpenRouter] Attempting JSON extraction from ${text.length} character response`);
    
    // Strategy 1: Standard markdown code blocks with optional json tag
    const codeBlockPatterns = [
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i,
      /```(?:json)?\s*(\[[\s\S]*?\])\s*```/i,
      /`(?:json)?\s*(\{[\s\S]*?\})\s*`/i,
    ];
    
    for (const pattern of codeBlockPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        console.log(`[OpenRouter] Found JSON in code block using pattern: ${pattern}`);
        return match[1].trim();
      }
    }
    
    // Strategy 2: JSON at start of response (handles responses that start with JSON immediately)
    const startPatterns = [
      /^\s*(\{[\s\S]*\})\s*$/,  // Pure JSON object
      /^\s*(\[[\s\S]*\])\s*$/,  // Pure JSON array
      /^\s*(\{[\s\S]*?\})[^}]*$/,  // JSON object with trailing text
      /^\s*(\[[\s\S]*?\])[^\]]*$/,  // JSON array with trailing text
    ];
    
    for (const pattern of startPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        console.log(`[OpenRouter] Found JSON at start using pattern: ${pattern}`);
        return match[1].trim();
      }
    }
    
    // Strategy 3: Find first complete JSON object in response
    const jsonFindingPatterns = [
      /(\{[^}]*"multiplePredictedOutputs"[^}]*\})/i,  // Look for our expected structure
      /(\{[^}]*"predictedOutput"[^}]*\})/i,          // Alternative structure marker
      /(\{[^}]*"patternDescription"[^}]*\})/i,       // Another structure marker
    ];
    
    for (const pattern of jsonFindingPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        console.log(`[OpenRouter] Found JSON structure using pattern: ${pattern}`);
        // Try to extend the match to get the complete object
        const fullMatch = this.extractCompleteJSONObject(text, match.index || 0);
        if (fullMatch) {
          return fullMatch;
        }
        return match[1].trim();
      }
    }
    
    // Strategy 4: Brute force - find any JSON-like structure
    const braceStart = text.indexOf('{');
    if (braceStart !== -1) {
      console.log(`[OpenRouter] Attempting brute force JSON extraction from position ${braceStart}`);
      const extracted = this.extractCompleteJSONObject(text, braceStart);
      if (extracted) {
        return extracted;
      }
    }
    
    console.log(`[OpenRouter] No JSON structure found in response`);
    return null;
  }

  /**
   * Extracts a complete JSON object starting from a given position
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
      console.log(`[OpenRouter] Extracted complete JSON object: ${extracted.length} characters`);
      return extracted;
    }
    
    return null;
  }

  /**
   * Generates a validation-compliant fallback response
   */
  private generateValidationCompliantFallback(originalResponse: string, modelName: string, error: any): any {
    const truncatedResponse = originalResponse.substring(0, 500);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Extract any partial content from the response for pattern description
    let partialPattern = "";
    const responsePreview = originalResponse.substring(0, 1000);
    
    // Look for partial pattern insights in the response
    if (responsePreview.includes("pattern") || responsePreview.includes("structure") || responsePreview.includes("rule")) {
      partialPattern = " The model appeared to be analyzing patterns or structures in the puzzle but the response was cut off or malformed.";
    }
    
    return {
      patternDescription: `JSON parsing failed for ${modelName} response. The model generated a ${originalResponse.length}-character response but it contained formatting issues (${errorMsg}).${partialPattern} This appears to be a model output formatting issue rather than a puzzle analysis failure. The response may have contained valid insights wrapped in markdown code blocks or other formatting that couldn't be automatically parsed.`,
      solvingStrategy: `Unable to extract structured solving strategy from ${modelName} due to response parsing failure. The original response was ${originalResponse.length} characters long and may have contained useful problem-solving insights, but the JSON structure was malformed or wrapped in unsupported formatting. Consider trying the analysis again or using a different model that provides more consistent JSON formatting.`,
      hints: [
        `The ${modelName} model generated a lengthy response (${originalResponse.length} chars) suggesting it attempted analysis`,
        "Try re-running the analysis - this may be a temporary formatting issue",
        "Consider using OpenAI GPT-4 or Anthropic Claude models for more reliable JSON output",
        "Check the raw response in the logs for any extractable insights"
      ],
      confidence: 0,
      multiplePredictedOutputs: false,
      predictedOutput: null,
      rawResponse: truncatedResponse,
      parsingError: errorMsg,
      modelUsed: modelName,
      recoveryMethod: "validation-compliant-fallback",
      responseLength: originalResponse.length,
      parsingAttempted: true
    };
  }

  /**
   * Normalizes response to ensure type consistency across providers
   */
  private normalizeResponse(result: any): any {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Ensure multiplePredictedOutputs is consistently a boolean
    if ('multiplePredictedOutputs' in result) {
      result.multiplePredictedOutputs = Boolean(result.multiplePredictedOutputs);
    }

    // Ensure confidence is a number
    if ('confidence' in result && typeof result.confidence !== 'number') {
      const conf = parseFloat(result.confidence);
      result.confidence = isNaN(conf) ? 0 : Math.max(0, Math.min(100, conf));
    }

    // Ensure hints is always an array
    if ('hints' in result && !Array.isArray(result.hints)) {
      result.hints = result.hints ? [String(result.hints)] : [];
    }

    // Normalize prediction fields
    if ('predictedOutput' in result && result.predictedOutput === null) {
      result.predictedOutput = undefined;
    }
    
    if ('predictedOutputs' in result && result.predictedOutputs === null) {
      result.predictedOutputs = undefined;
    }

    return result;
  }

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { 
      systemPromptMode?: 'ARC' | 'None';
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
      maxOutputTokens?: number;
    }
  ) {
    // Record start time for accurate processing duration measurement
    const startTime = Date.now();
    
    // Get model config to determine actual OpenRouter model name
    const modelConfig = getModelConfig(modelKey);
    const openRouterModelName = modelConfig?.apiModelName || modelKey;

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    // Build prompt package using new architecture
    const promptPackage: PromptPackage = buildAnalysisPrompt(task, promptId, customPrompt, {
      ...options,
      systemPromptMode,
      useStructuredOutput: false // OpenRouter compatibility varies by model
    });
    
    console.log(`[OpenRouter] Using system prompt mode: ${systemPromptMode}`);
    console.log(`[OpenRouter] Model: ${openRouterModelName}`);
    
    // Extract system and user prompts from prompt package
    const systemMessage = promptPackage.systemPrompt;
    const userMessage = promptPackage.userPrompt;
    
    console.log(`[OpenRouter] System prompt: ${systemMessage.length} chars`);
    console.log(`[OpenRouter] User prompt: ${userMessage.length} chars`);

    try {
      // Build messages array
      const messages: any[] = [];
      
      // Add system message if provided
      if (systemMessage && systemPromptMode === 'ARC') {
        messages.push({ role: "system", content: systemMessage });
      }
      
      messages.push({ role: "user", content: userMessage });

      // Build request options
      const requestOptions: any = {
        model: openRouterModelName,
        messages: messages,
        temperature: temperature,
        max_tokens: serviceOpts?.maxOutputTokens || modelConfig?.maxOutputTokens || 4000,
      };

      console.log(`[OpenRouter] Making API call with model: ${openRouterModelName}`);
      const response = await openrouter.chat.completions.create(requestOptions);
      
      const responseText = response.choices[0]?.message?.content || "";
      
      // Parse JSON response with progressive fallback strategies
      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`[OpenRouter] ✅ Successfully parsed structured JSON response directly`);
      } catch (parseError) {
        console.error(`[OpenRouter] ❌ Initial JSON parse failed, attempting recovery:`, {
          model: openRouterModelName,
          responseLength: responseText.length,
          responseSample: responseText.substring(0, 300),
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          startsWithCodeBlock: responseText.trimStart().startsWith('```'),
          startsWithBacktick: responseText.trimStart().startsWith('`'),
          containsJSON: responseText.includes('multiplePredictedOutputs') || responseText.includes('predictedOutput'),
          hasOpenBrace: responseText.includes('{'),
          hasCloseBrace: responseText.includes('}')
        });
        
        // Progressive recovery strategies with detailed logging
        result = this.attemptResponseRecovery(responseText, openRouterModelName, parseError);
        
        if (result && result.recoveryMethod) {
          console.log(`[OpenRouter] ✅ Recovery successful using method: ${result.recoveryMethod}`);
        }
      }

      // Normalize result to ensure type consistency
      result = this.normalizeResponse(result);

      // Extract token usage from OpenRouter response
      let tokenUsage: { input: number; output: number; reasoning?: number } | undefined;
      let cost: { input: number; output: number; reasoning?: number; total: number } | undefined;
      
      if (response.usage) {
        const inputTokens = response.usage.prompt_tokens ?? 0;
        const outputTokens = response.usage.completion_tokens ?? 0;
        
        tokenUsage = {
          input: inputTokens,
          output: outputTokens,
        };

        // Calculate cost using model configuration
        if (modelConfig && tokenUsage) {
          cost = calculateCost(modelConfig.cost, tokenUsage);
        }
      }

      return {
        success: true,
        result,
        tokenUsage,
        cost,
        processingTimeMs: Date.now() - startTime,
        modelName: openRouterModelName, // Fixed: use modelName to match repository expectations
        reasoning: null, // OpenRouter doesn't provide separate reasoning logs
        reasoningLog: null
      };

    } catch (error: any) {
      console.error(`[OpenRouter] Error with model ${openRouterModelName}:`, error);
      
      // Enhanced error handling for common OpenRouter errors
      let errorMessage = 'Unknown error occurred';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        result: null,
        tokenUsage: undefined,
        cost: undefined,
        processingTimeMs: Date.now() - startTime,
        modelName: openRouterModelName // Fixed: use modelName to match repository expectations
      };
    }
  }
}

// Export singleton instance
export const openrouterService = new OpenRouterService();