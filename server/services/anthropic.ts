/**
 * Anthropic Claude service for analyzing ARC puzzles using Claude models
 * Refactored to extend BaseAIService for code consolidation
 * 
 * @author Cascade / Gemini Pro 2.5 (original), Claude (refactor)
 */

import Anthropic from "@anthropic-ai/sdk";
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { MODELS as MODEL_CONFIGS, getApiModelName, getModelConfig } from "../config/models/index.js";
import { logger } from "../utils/logger.js";

// Helper function to check if model supports temperature using centralized config
function modelSupportsTemperature(modelKey: string): boolean {
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
  return modelConfig?.supportsTemperature ?? false;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class AnthropicService extends BaseAIService {
  protected provider = "Anthropic";
  protected models = {}; // Required by BaseAIService, but we use centralized getApiModelName

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
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      const { result, tokenUsage, reasoningLog, reasoningItems, status, incomplete, incompleteReason } = 
        this.parseProviderResponse(response, modelKey, true);

      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        !!reasoningLog,
        reasoningItems,
        status,
        incomplete,
        incompleteReason,
        promptPackage,
        promptId,
        customPrompt
      );
    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  /**
   * Get intelligent default max_tokens based on model capabilities
   */
  private getDefaultMaxTokens(modelKey: string): number {
    const modelName = getApiModelName(modelKey) || modelKey;
    
    // Claude 4 series - 64k generation limit
    if (modelName.includes('claude-4') || modelName.includes('sonnet-4')) {
      return 64000;
    }
    
    // Claude 3.5 Sonnet (new) and Haiku - 8192 hard cap
    if (modelName.includes('3.5') || modelName.includes('35')) {
      return 8192;
    }
    
    // Claude 3 series (Opus, older Sonnet, Haiku) - 4096 cap
    if (modelName.includes('claude-3') || modelName.includes('opus') || modelName.includes('sonnet') || modelName.includes('haiku')) {
      return 4096;
    }
    
    // Default fallback for unknown models
    return 4096;
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelName = getApiModelName(modelKey) || modelKey;
    const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);
    
    return {
      name: modelName,
      isReasoning: false, // Anthropic models don't have built-in reasoning mode
      supportsTemperature: modelSupportsTemperature(modelKey),
      contextWindow: modelConfig?.contextWindow || 200000,
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false, // Anthropic doesn't support structured output yet
      supportsVision: modelName.includes('claude-3') // Bad logic and irrelevant!!!
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
    const temperature = options?.temperature ?? 0.2; // Use passed temp or default
    const apiModelName = getApiModelName(modelName);

    const messageFormat: any = {
      model: apiModelName,
      max_tokens: getModelConfig(modelKey)?.maxOutputTokens || this.getDefaultMaxTokens(modelKey),
      messages: [{ role: "user", content: userMessage }],
      ...(systemMessage && { system: systemMessage }),
      ...(modelSupportsTemperature(modelKey) && { temperature })
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Supports dedicated system parameter",
      serviceOpts.systemPromptMode === 'ARC' 
        ? "System Prompt Mode: {ARC} - Using dedicated system parameter"
        : "System Prompt Mode: {None} - All content in user message",
      "JSON extraction via regex parsing (no structured output support)"
    ];

    const { systemPromptMode } = serviceOpts;
    const previewText = systemPromptMode === 'ARC' ? userMessage : `${systemMessage}\n\n${userMessage}`;

    return {
      provider: this.provider,
      modelName,
      messageFormat,
      promptText: previewText,
      systemPromptMode: serviceOpts.systemPromptMode,
      providerSpecificNotes: providerSpecificNotes.join('; '),
      templateInfo: {
        id: promptPackage.selectedTemplate?.id || "custom",
        name: promptPackage.selectedTemplate?.name || "Custom Prompt",
        usesEmojis: promptPackage.selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: previewText.length,
        wordCount: previewText.split(/\s+/).length,
        lineCount: previewText.split('\n').length
      }
    };
  }

  protected async callProviderAPI(
    promptPackage: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const { systemPrompt, userPrompt } = promptPackage;
    const modelConfig = getModelConfig(modelKey);
    const apiModelName = getApiModelName(modelKey);
    const supportsTemp = modelConfig?.supportsTemperature ?? false;

    // Define analysis tool for structured output - enforces reasoningItems
    const analysisTools = [{
      name: "provide_puzzle_analysis",
      description: "Analyze the ARC puzzle and provide structured analysis including reasoning steps",
      input_schema: {
        type: "object" as const,
        properties: {
          patternDescription: {
            type: "string",
            description: "Description of transformations identified. One or two short sentences even a small child could understand."
          },
          solvingStrategy: {
            type: "string", 
            description: "Clear explanation of the solving approach, written as a few logical easy steps to follow.  Use as few words as possible."
          },
          reasoningItems: {
            type: "array",
            items: { type: "string" },
            description: "REQUIRED: Step-by-step analysis progression and insights, including incorrect approaches and insights"
          },
          hints: {
            type: "array",
            items: { type: "string" },
            description: "Three approaches to solving the puzzle: one algorithm, one description, one as a domain specific language"
          },
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Confidence level in the solution (0-100)"
          },
          // Include prediction fields based on task structure
          multiplePredictedOutputs: {
            type: "boolean",
            description: "Whether multiple test outputs are predicted"
          },
          predictedOutput: {
            type: "array",
            items: {
              type: "array", 
              items: { type: "integer" }
            },
            description: "Predicted output grid for single test"
          },
          predictedOutput1: {
            type: "array",
            items: {
              type: "array",
              items: { type: "integer" }
            },
            description: "First predicted output for multiple tests"
          },
          predictedOutput2: {
            type: "array", 
            items: {
              type: "array",
              items: { type: "integer" }
            },
            description: "Second predicted output for multiple tests"
          },
          predictedOutput3: {
            type: "array",
            items: {
              type: "array", 
              items: { type: "integer" }
            },
            description: "Third predicted output for multiple tests"
          }
        },
        required: ["patternDescription", "solvingStrategy", "reasoningItems", "hints", "confidence", "multiplePredictedOutputs", "predictedOutput", "predictedOutput1", "predictedOutput2", "predictedOutput3"]
      }
    }];

    // Default request body; we'll enable streaming selectively below
    const requestBody: any = {
      stream: false,
      model: apiModelName,
      max_tokens: serviceOpts.maxOutputTokens || this.getDefaultMaxTokens(modelKey),
      system: systemPrompt,
      messages: [{ 
        role: 'user', 
        content: `${userPrompt}\n\nIMPORTANT: You must use the provide_puzzle_analysis tool to respond with structured analysis. Include detailed reasoningItems showing your step-by-step analysis.`
      }],
      tools: analysisTools,
      tool_choice: { type: "tool", name: "provide_puzzle_analysis" },
      ...(supportsTemp && { temperature }),
    };

    this.logAnalysisStart(modelKey, temperature, userPrompt.length, serviceOpts);
    console.log(`[${this.provider}] Using Tool Use API to enforce structured output with required reasoningItems`);

    const startTime = Date.now();
    
    // Claude Sonnet 4 uses streaming for better performance on long operations
    // Fixed: streaming now properly preserves tool use blocks via finalMessage()
    const needsStreaming = /sonnet-4/i.test(modelKey) || /claude-sonnet-4/i.test(apiModelName);
    let response: any;
    
    if (needsStreaming) {
      try {
        console.log(`[${this.provider}] Using streaming for model ${modelKey}`);

        // Create a streaming request
        const stream = anthropic.messages.stream({
          ...requestBody,
          stream: true
        });

        // Let the stream process and get the final message directly
        // This preserves tool use blocks and proper content structure
        const message = await stream.finalMessage();

        // Use the final message directly without reconstruction
        response = message;

        console.log(`[${this.provider}] Streaming completed with ${message.usage?.output_tokens || 0} output tokens`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during streaming';
        console.error(`[${this.provider}] Streaming error:`, errorMessage);
        throw new Error(`Streaming request failed: ${errorMessage}`);
      }
    } else {
      // Standard non-streaming request
      console.log(`[${this.provider}] Using standard request for model ${modelKey}`);
      response = await anthropic.messages.create({
        ...requestBody,
        stream: false
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[${this.provider}] Analysis for ${modelKey} completed in ${processingTime}ms`);

    return { ...response, processingTime };
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string } {
    // Handle both streaming and non-streaming responses
    const isStreamingResponse = !response.content && response.choices?.[0]?.delta;
    
    let content, usage, stop_reason;
    
    if (isStreamingResponse) {
      // Handle streaming response format
      const delta = response.choices[0].delta;
      content = delta.content ? [{ type: 'text', text: delta.content }] : [];
      usage = { input_tokens: 0, output_tokens: 0 }; // Will be updated by the stream handler
      stop_reason = response.choices[0].finish_reason;
    } else {
      // Handle non-streaming response format
      content = response.content || [];
      usage = response.usage || { input_tokens: 0, output_tokens: 0 };
      stop_reason = response.stop_reason;
    }

    const tokenUsage: TokenUsage = {
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
    };

    const isComplete = stop_reason === 'end_turn' || stop_reason === 'stop';
    const incompleteReason = isComplete ? undefined : stop_reason;

    let result: any = {};
    let reasoningLog = null;
    let reasoningItems: any[] = [];

    logger.service('Anthropic', `Parsing response with ${content?.length || 0} content blocks`, 'debug');

    // Check for tool use response (structured output)
    const toolUseContent = content?.find((block: any) => block.type === 'tool_use');
    if (toolUseContent && toolUseContent.name === 'provide_puzzle_analysis') {
      logger.service('Anthropic', 'Found tool use response with structured data', 'debug');
      result = toolUseContent.input || {};
      
      // Extract reasoningItems from tool use input (guaranteed by schema)
      if (result.reasoningItems && Array.isArray(result.reasoningItems)) {
        reasoningItems = result.reasoningItems;
        console.log(`[Anthropic] ✅ Extracted ${reasoningItems.length} reasoning items from tool use (schema enforced)`);
      }

      // Create reasoning log from reasoningItems for compatibility
      if (captureReasoning && reasoningItems.length > 0) {
        reasoningLog = reasoningItems.join('\n\n');
        console.log(`[Anthropic] Created reasoning log from tool reasoning items: ${reasoningLog.length} chars`);
      }
    } else {
      // Fallback to text parsing for models that don't use tool use
      console.log(`[Anthropic] No tool use found, falling back to text parsing`);
      const responseText = content[0]?.text || '';
      
      // Extract JSON from the response text
      result = this.extractJsonFromResponse(responseText, modelKey);

      // Extract reasoning log from text patterns
      if (captureReasoning) {
        const jsonStartPattern = /```json|```\s*{|\s*{/;
        const jsonStartMatch = responseText.search(jsonStartPattern);
        
        if (jsonStartMatch > 50) {
          const preJsonText = responseText.substring(0, jsonStartMatch).trim();
          if (preJsonText.length > 20) {
            reasoningLog = preJsonText;
            console.log(`[Anthropic] Extracted pre-JSON reasoning: ${preJsonText.length} chars`);
          }
        }
      }

      // Extract reasoningItems from JSON response (fallback)
      if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
        reasoningItems = result.reasoningItems;
        console.log(`[Anthropic] Extracted ${reasoningItems.length} reasoning items from JSON fallback`);
      }
    }

    // Additional text content logging
    const textContent = content?.find((block: any) => block.type === 'text');
    if (textContent?.text) {
      console.log(`[Anthropic] Additional text content: ${textContent.text.substring(0, 200)}...`);
    }

    logger.service('Anthropic', `Parse complete - reasoningItems: ${reasoningItems.length}, result keys: ${Object.keys(result).join(', ')}`, 'debug');

    return {
      result,
      tokenUsage,
      reasoningLog,
      status: isComplete ? 'completed' : 'incomplete',
      incomplete: !isComplete,
      incompleteReason,
      reasoningItems
    };
  }
}

export const anthropicService = new AnthropicService();