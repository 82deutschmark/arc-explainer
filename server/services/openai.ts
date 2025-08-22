/**
 * OpenAI service for analyzing ARC puzzles using OpenAI models
 * Supports reasoning log capture for OpenAI reasoning models (o3-mini, o4-mini, o3-2025-04-16)
 * These models automatically provide reasoning logs in response.choices[0].message.reasoning
 * 
 * @author Cascade
 */

import OpenAI from "openai";
import { ARCTask } from "../../shared/types";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder";
import type { PromptOptions } from "./promptBuilder"; // Cascade: modular prompt options

const MODELS = {
  "gpt-4.1-nano-2025-04-14": "gpt-4.1-nano-2025-04-14",
  "gpt-4.1-mini-2025-04-14": "gpt-4.1-mini-2025-04-14",
  "gpt-4o-mini-2024-07-18": "gpt-4o-mini-2024-07-18",
  "o3-mini-2025-01-31": "o3-mini-2025-01-31",
  "o4-mini-2025-04-16": "o4-mini-2025-04-16",
  "o3-2025-04-16": "o3-2025-04-16",
  "gpt-4.1-2025-04-14": "gpt-4.1-2025-04-14",
  "gpt-5-2025-08-07": "gpt-5-2025-08-07",
  "gpt-5-chat-latest": "gpt-5-chat-latest",
  "gpt-5-mini-2025-08-07": "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07": "gpt-5-nano-2025-08-07",
} as const;

// Models that do NOT support temperature parameter
const MODELS_WITHOUT_TEMPERATURE = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16",
  "o3-2025-04-16",
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
]);

// Older models that support reasoning logs (o3/o4 series)
const O3_O4_REASONING_MODELS = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16", 
  "o3-2025-04-16",
]);

// Newest GPT-5 models that support advanced reasoning parameters
const GPT5_REASONING_MODELS = new Set([
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
]);

// GPT-5 Chat models (support temperature, no reasoning)
const GPT5_CHAT_MODELS = new Set([
  "gpt-5-chat-latest",
]);

// All models that support reasoning
const MODELS_WITH_REASONING = new Set([
  ...O3_O4_REASONING_MODELS,
  ...GPT5_REASONING_MODELS,
]);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// JSON-structure-enforcing system prompts (extracted from user prompts)
const SOLVER_SYSTEM_PROMPT = `You are a puzzle solver. Respond with ONLY valid JSON in this exact format:

{
  "predictedOutput": [[0,1,2],[3,4,5],[6,7,8]],
  "patternDescription": "Clear description of what you learned from the training examples",
  "solvingStrategy": "Step-by-step reasoning used to predict the answer, including the predicted output grid as a 2D array",
  "hints": ["Key reasoning insight 1", "Key reasoning insight 2", "Key reasoning insight 3"],
  "confidence": 85
}

CRITICAL: The "predictedOutput" field MUST be first and contain a 2D array of integers matching the expected output grid dimensions. No other format accepted.`;

const MULTI_SOLVER_SYSTEM_PROMPT = `You are a puzzle solver. Respond with ONLY valid JSON in this exact format:

{
  "predictedOutputs": [[[0,1],[2,3]], [[4,5],[6,7]]],
  "patternDescription": "Clear description of what you learned from the training examples", 
  "solvingStrategy": "Step-by-step reasoning used to predict the answer, including the predicted output grids as 2D arrays",
  "hints": ["Key reasoning insight 1", "Key reasoning insight 2", "Key reasoning insight 3"],
  "confidence": 85
}

CRITICAL: The "predictedOutputs" field MUST be first and contain an array of 2D integer arrays, one for each test case in order. No other format accepted.`;

const EXPLANATION_SYSTEM_PROMPT = `You are a puzzle analysis expert. Respond with ONLY valid JSON in this exact format:

{
  "patternDescription": "Clear description of the rules learned from the training examples",
  "solvingStrategy": "Explain the thinking and reasoning required to solve this puzzle, not specific steps", 
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "confidence": 85
}

CRITICAL: Return ONLY valid JSON with these exact field names and types. No additional text.`;

const ALIEN_EXPLANATION_SYSTEM_PROMPT = `You are a puzzle analysis expert. Respond with ONLY valid JSON in this exact format:

{
  "patternDescription": "What the aliens are trying to communicate to us through this puzzle, based on the ARC-AGI transformation types",
  "solvingStrategy": "Step-by-step explain the thinking and reasoning required to solve this puzzle, for novices. If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"], 
  "confidence": 85,
  "alienMeaning": "The aliens' message",
  "alienMeaningConfidence": 85
}

CRITICAL: Return ONLY valid JSON with these exact field names and types. No additional text.`;

export class OpenAIService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { 
      previousResponseId?: string; 
      maxSteps?: number; 
      reasoningSummary?: 'auto' | 'none'; 
      maxRetries?: number; 
      maxOutputTokens?: number;
      // GPT-5 reasoning parameters
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
      // System prompt mode
      systemPromptMode?: 'ARC' | 'None';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);
    
    // Prepare system and user messages based on mode
    let systemMessage: string | undefined;
    let userMessage: string;
    
    if (systemPromptMode === 'ARC') {
      // ARC Mode: Select appropriate system prompt based on context
      const isSolverMode = promptId === "solver";
      const isAlienMode = selectedTemplate?.emojiMapIncluded || false;
      const hasMultipleTests = task.test.length > 1;
      
      if (isSolverMode && hasMultipleTests) {
        systemMessage = MULTI_SOLVER_SYSTEM_PROMPT;
        console.log(`[OpenAI] Using multi-test solver system prompt (${task.test.length} tests)`);
      } else if (isSolverMode) {
        systemMessage = SOLVER_SYSTEM_PROMPT;
        console.log(`[OpenAI] Using single-test solver system prompt`);
      } else if (isAlienMode) {
        systemMessage = ALIEN_EXPLANATION_SYSTEM_PROMPT;
        console.log(`[OpenAI] Using alien explanation system prompt`);
      } else {
        systemMessage = EXPLANATION_SYSTEM_PROMPT;
        console.log(`[OpenAI] Using standard explanation system prompt`);
      }
      
      userMessage = prompt; // For now, use full prompt as user message (TODO: separate later)
    } else {
      // None Mode: Current behavior - everything as user message
      systemMessage = undefined;
      userMessage = prompt;
      console.log(`[OpenAI] Using None mode (current behavior) with model ${modelKey}`);
    }

    try {
      let reasoningLog = null;
      let hasReasoningLog = false;
      let result: any = {};

      const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
      const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
      const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
      const isGPT5ChatModel = GPT5_CHAT_MODELS.has(modelKey);
      console.log(`[OpenAI] Using Responses API for model ${modelKey} (reasoning=${isReasoningModel}, gpt5=${isGPT5Model}, o3o4=${isO3O4Model}, gpt5chat=${isGPT5ChatModel})`);

      // Build reasoning config based on model type
      let reasoningConfig = undefined;
      let textConfig = undefined;
      if (captureReasoning && isReasoningModel) {
        if (isGPT5Model) {
          // GPT-5 models support advanced reasoning parameters
          reasoningConfig = {
            effort: serviceOpts?.reasoningEffort || 'medium',
            summary: serviceOpts?.reasoningSummaryType || serviceOpts?.reasoningSummary || 'auto'
          };
          // Text config is separate for GPT-5 models
          textConfig = {
            verbosity: serviceOpts?.reasoningVerbosity || 'medium'
          };
        } else if (isO3O4Model) {
          // o3/o4 models use simpler reasoning config
          reasoningConfig = {
            summary: serviceOpts?.reasoningSummary || 'auto'
          };
        }
      }

      // Build request to Responses API via helper for consistent parsing
      // Create message array based on system prompt mode
      const messages: any[] = [];
      if (systemMessage) {
        messages.push({ role: "system", content: systemMessage });
      }
      messages.push({ role: "user", content: userMessage });
      
      const request = {
        model: modelName,
        input: messages,
        reasoning: reasoningConfig,
        ...(textConfig && { text: textConfig }),
        max_steps: serviceOpts?.maxSteps,
        previous_response_id: serviceOpts?.previousResponseId,
        // Apply temperature for models that support it (non-reasoning models: GPT-4.1 series and GPT-5 Chat)
        ...(!isReasoningModel && {
          temperature: temperature || 0.2,
          ...(isGPT5ChatModel && { top_p: 1.00 })
        }),
        // pass through visible output token cap to avoid starvation - using high limits from models.yml
        max_output_tokens: serviceOpts?.maxOutputTokens || (isGPT5ChatModel ? 100000 : undefined),
      } as const;

      const maxRetries = Math.max(0, serviceOpts?.maxRetries ?? 2);
      let lastErr: any = null;
      let parsedResponse: any = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          parsedResponse = await this.callResponsesAPI(request as any);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(`[OpenAI] Responses call failed (attempt ${attempt + 1}/${maxRetries + 1}). Backing off ${backoffMs}ms`);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
        }
      }
      if (!parsedResponse) throw lastErr || new Error('Responses call failed');

      // Parse output_text JSON with markdown code block handling
      const rawJson = parsedResponse.output_text || '';
      try {
        result = rawJson ? JSON.parse(rawJson) : {};
      } catch (e) {
        console.warn('[OpenAI] Failed direct JSON parse, attempting markdown extraction...');
        
        // Try to extract JSON from markdown code blocks (fixes gpt-5-chat-latest and gpt-4.1-2025-04-14)
        const codeBlockMatch = rawJson.match(/```(?:json\s*)?([^`]*?)```/s);
        if (codeBlockMatch) {
          try {
            const cleanedJson = codeBlockMatch[1].trim();
            console.log(`[OpenAI] Found JSON in markdown code block: ${cleanedJson.substring(0, 200)}...`);
            result = JSON.parse(cleanedJson);
          } catch (markdownError) {
            console.warn('[OpenAI] Failed to parse JSON from markdown code block, trying regex fallback...');
            
            // Fallback: Look for JSON anywhere in the text (similar to Anthropic service)
            const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                result = JSON.parse(jsonMatch[0]);
              } catch (regexError) {
                console.warn('[OpenAI] All JSON parsing attempts failed; returning empty result.');
                result = {};
              }
            } else {
              console.warn('[OpenAI] No JSON structure found in response.');
              result = {};
            }
          }
        } else {
          // Fallback: Look for JSON anywhere in the text (similar to Anthropic service)
          const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              result = JSON.parse(jsonMatch[0]);
            } catch (regexError) {
              console.warn('[OpenAI] All JSON parsing attempts failed; returning empty result.');
              result = {};
            }
          } else {
            console.warn('[OpenAI] No JSON structure found in response.');
            result = {};
          }
        }
      }

      // Extract reasoning summary/items
      const providerResponseId = parsedResponse.id ?? null;
      const reasoningItems = parsedResponse.output_reasoning?.items ?? [];
      const providerRawResponse = parsedResponse.raw_response;

      if (captureReasoning) {
        const summary = parsedResponse.output_reasoning?.summary;
        if (summary) {
          if (Array.isArray(summary)) {
            // Extract text from objects in the summary array
            reasoningLog = summary.map((s: any) => {
              // Handle different summary object structures
              if (typeof s === 'string') return s;
              if (s && typeof s === 'object' && s.text) return s.text;
              if (s && typeof s === 'object' && s.content) return s.content;
              // Fallback to JSON stringify if the object structure is unknown
              return typeof s === 'object' ? JSON.stringify(s) : String(s);
            }).filter(Boolean).join('\n\n');
          } else if (typeof summary === 'string') {
            reasoningLog = summary;
          }
          hasReasoningLog = !!reasoningLog;
        }
      }

      // Debug logging to catch reasoning data type issues
      if (reasoningLog && typeof reasoningLog !== 'string') {
        console.error(`[OpenAI] WARNING: reasoningLog is not a string! Type: ${typeof reasoningLog}`, reasoningLog);
        reasoningLog = String(reasoningLog); // Force to string
      }
      
      if (reasoningItems && !Array.isArray(reasoningItems)) {
        console.error(`[OpenAI] WARNING: reasoningItems is not an array! Type: ${typeof reasoningItems}`, reasoningItems);
      }
      
      console.log(`[OpenAI] Returning reasoning data - reasoningLog type: ${typeof reasoningLog}, length: ${reasoningLog?.length || 0}`);

      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
        providerResponseId,
        providerRawResponse,
        reasoningItems,
        // Include analysis parameters for database storage
        temperature,
        reasoningEffort: serviceOpts?.reasoningEffort || null,
        reasoningVerbosity: serviceOpts?.reasoningVerbosity || null,
        reasoningSummaryType: serviceOpts?.reasoningSummaryType || null,
        ...result,
      };
    } catch (error) {
      console.error(`Error with model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a preview of the exact prompt that will be sent to OpenAI
   * Shows the provider-specific message format and structure
   */
  async generatePromptPreview(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: { 
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
      systemPromptMode?: 'ARC' | 'None';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';

    // Build prompt using shared prompt builder
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // Prepare system and user messages based on mode
    let systemMessage: string | undefined;
    let userMessage: string;
    
    if (systemPromptMode === 'ARC') {
      // ARC Mode: Select appropriate system prompt based on context
      const isSolverMode = promptId === "solver";
      const isAlienMode = selectedTemplate?.emojiMapIncluded || false;
      const hasMultipleTests = task.test.length > 1;
      
      if (isSolverMode && hasMultipleTests) {
        systemMessage = MULTI_SOLVER_SYSTEM_PROMPT;
      } else if (isSolverMode) {
        systemMessage = SOLVER_SYSTEM_PROMPT;
      } else if (isAlienMode) {
        systemMessage = ALIEN_EXPLANATION_SYSTEM_PROMPT;
      } else {
        systemMessage = EXPLANATION_SYSTEM_PROMPT;
      }
      
      userMessage = prompt; // For now, use full prompt as user message (TODO: separate later)
    } else {
      systemMessage = undefined;
      userMessage = prompt;
    }

    // Create message array for preview
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    // Responses API format for all models
    let messageFormat: any;
    let providerSpecificNotes: string[] = [];

    const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
    const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
    const isO3O4Model = O3_O4_REASONING_MODELS.has(modelKey);
    
    messageFormat = {
      model: modelName,
      input: messages,
      max_output_tokens: 100000, // Near maximum capacity for comprehensive analysis
      ...(isReasoningModel
        ? { 
            reasoning: isGPT5Model 
              ? { 
                  effort: serviceOpts?.reasoningEffort || "medium",
                  summary: serviceOpts?.reasoningSummaryType || "detailed" 
                }
              : { summary: "detailed" },
            ...(isGPT5Model && {
              text: { verbosity: serviceOpts?.reasoningVerbosity || "medium" }
            })
          }
        : {})
    };
    providerSpecificNotes.push("Uses OpenAI Responses API");
    providerSpecificNotes.push("Temperature/JSON response_format not used; JSON enforced via prompt");
    
    // Add system prompt mode notes
    if (systemPromptMode === 'ARC') {
      providerSpecificNotes.push("System Prompt Mode: {ARC} - Using structured system prompt for better parsing");
      providerSpecificNotes.push(`System Message: "${systemMessage}"`);
    } else {
      providerSpecificNotes.push("System Prompt Mode: {None} - Old behavior (all content as user message)");
    }

    return {
      provider: "OpenAI",
      modelName,
      promptText: systemPromptMode === 'ARC' ? userMessage : prompt,
      systemPrompt: systemMessage,
      messageFormat,
      templateInfo: {
        id: selectedTemplate?.id || "custom",
        name: selectedTemplate?.name || "Custom Prompt",
        usesEmojis: selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: prompt.length,
        wordCount: prompt.split(/\s+/).length,
        lineCount: prompt.split('\n').length
      },
      providerSpecificNotes,
      captureReasoning,
      temperature: MODELS_WITH_REASONING.has(modelKey) ? "Not supported" : temperature
    };
  }

  async callResponsesAPI(request: {
    model: string;
    input: string | Array<{role: string, content: string}>;
    reasoning?: { summary: 'auto' | 'none' };
    max_steps?: number;
    temperature?: number;
    previous_response_id?: string;
    max_output_tokens?: number;
  }): Promise<any> {
    // Call OpenAI Responses API for structured reasoning
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log('[OPENAI-RESPONSES-DEBUG] Making Responses API call:', {
      model: request.model,
      maxSteps: request.max_steps,
      hasPreviousId: !!request.previous_response_id,
      maxOutputTokens: request.max_output_tokens ?? 'default'
    });

    try {
      // Prepare the request for OpenAI's Responses API
      const responsesRequest: any = {
        model: request.model,
        input: Array.isArray(request.input) ? request.input : [{ role: "user", content: request.input }], // Support both message array and string
        max_output_tokens: Math.max(256, request.max_output_tokens ?? 128000),
        store: true,
        ...(request.reasoning && { reasoning: request.reasoning }),
        // REMOVED: max_steps - not supported in Responses API
        ...(request.previous_response_id && { previous_response_id: request.previous_response_id })
        // REMOVED: temperature - not supported in Responses API
      };

      // Make the API call to OpenAI's Responses endpoint
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responsesRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OPENAI-RESPONSES-DEBUG] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('[OPENAI-RESPONSES-DEBUG] API Response:', {
        id: result.id,
        hasOutputReasoning: !!result.output_reasoning,
        hasOutputText: !!result.output_text,
        hasOutput: !!result.output,
        reasoningItemsCount: result.output_reasoning?.items?.length || 0,
        reasoningSummary: result.output_reasoning?.summary?.substring(0, 100)
      });

      // Enhanced response parsing - extract from output blocks if needed
      const parsedResponse = {
        id: result.id,
        output_text: result.output_text || this.extractTextFromOutputBlocks(result.output),
        output_reasoning: {
          summary: result.output_reasoning?.summary || this.extractReasoningFromOutputBlocks(result.output),
          items: result.output_reasoning?.items || []
        },
        raw_response: result // For debugging
      };

      return parsedResponse;

    } catch (error) {
      console.error('[OPENAI-RESPONSES-DEBUG] Error calling Responses API:', error);
      throw error;
    }
  }

  // Helper method for parsing Responses API output blocks
  private extractTextFromOutputBlocks(output: any[]): string {
    if (!Array.isArray(output)) {
      console.log('[OPENAI-EXTRACT] Output is not an array:', typeof output);
      return '';
    }
    
    console.log('[OPENAI-EXTRACT] Processing', output.length, 'blocks:', output.map(b => ({
      type: b.type,
      role: b.role,
      hasContent: !!b.content,
      hasText: !!b.text
    })));
    
    // Look for Assistant blocks first
    const assistantBlock = output.find(block => 
      block.type === 'Assistant' || block.role === 'assistant'
    );
    
    if (assistantBlock) {
      console.log('[OPENAI-EXTRACT] Found Assistant block');
      if (Array.isArray(assistantBlock.content)) {
        // Look for text or output_text content types
        const textContent = assistantBlock.content.find((c: any) => 
          c.type === 'text' || c.type === 'output_text'
        );
        if (textContent?.text) {
          console.log('[OPENAI-EXTRACT] Extracted from Assistant array:', textContent.text.substring(0, 200));
          return textContent.text;
        }
      }
      if (typeof assistantBlock.content === 'string') {
        console.log('[OPENAI-EXTRACT] Extracted from Assistant string:', assistantBlock.content.substring(0, 200));
        return assistantBlock.content;
      }
      if (assistantBlock.text) {
        console.log('[OPENAI-EXTRACT] Extracted from Assistant text:', assistantBlock.text.substring(0, 200));
        return assistantBlock.text;
      }
    }
    
    // Look for other message blocks
    for (const block of output) {
      if (block.type === 'message' && block.content) {
        console.log('[OPENAI-EXTRACT] Processing message block');
        if (Array.isArray(block.content)) {
          // Look for both text and output_text content types
          const textContent = block.content.find((c: any) => 
            c.type === 'text' || c.type === 'output_text'
          );
          if (textContent?.text) {
            console.log('[OPENAI-EXTRACT] Extracted from message array:', textContent.text.substring(0, 200));
            return textContent.text;
          }
        }
        if (typeof block.content === 'string') {
          console.log('[OPENAI-EXTRACT] Extracted from message string:', block.content.substring(0, 200));
          return block.content;
        }
      }
      
      if (block.type === 'text' && block.text) {
        console.log('[OPENAI-EXTRACT] Extracted from text block:', block.text.substring(0, 200));
        return block.text;
      }
    }
    
    // Fallback: join all text-like content
    return output
      .filter(block => block.content || block.text)
      .map(block => {
        if (Array.isArray(block.content)) {
          // Look for both text and output_text content types
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
    
    // Look for reasoning blocks
    const reasoningBlocks = output.filter(block => 
      block.type === 'reasoning' || 
      block.type === 'Reasoning' ||
      (block.type === 'message' && (block.role === 'reasoning' || block.role === 'Reasoning'))
    );
    
    return reasoningBlocks
      .map(block => {
        if (Array.isArray(block.content)) {
          const textContent = block.content.find((c: any) => c.type === 'text');
          return textContent?.text || '';
        }
        return block.content || block.text || block.summary || '';
      })
      .filter(Boolean)
      .join('\n');
  }
}

export const openaiService = new OpenAIService();
