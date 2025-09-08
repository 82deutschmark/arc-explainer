/**
 * ResponseProcessor.ts
 * 
 * Single Responsibility: Process AI provider responses with unified logic
 * Eliminates duplicate response processing across provider services
 * Handles token usage extraction, reasoning parsing, and status validation
 * 
 * @author Claude Code (SRP refactor)
 */

import { jsonParser } from '../utils/JsonParser.js';

export interface TokenUsage {
  input: number;
  output: number;
  reasoning?: number;
}

export interface ProcessedResponse {
  result: any;
  tokenUsage: TokenUsage;
  reasoningLog?: string;
  reasoningItems?: any[];
  status?: string;
  incomplete?: boolean;
  incompleteReason?: string;
}

export interface ResponseProcessorOptions {
  captureReasoning?: boolean;
  modelKey: string;
  provider: string;
  isReasoningModel?: boolean;
}

export class ResponseProcessor {
  private static instance: ResponseProcessor;
  
  private constructor() {}
  
  static getInstance(): ResponseProcessor {
    if (!ResponseProcessor.instance) {
      ResponseProcessor.instance = new ResponseProcessor();
    }
    return ResponseProcessor.instance;
  }

  /**
   * Process standard chat completion response (OpenAI-compatible format)
   */
  processChatCompletion(response: any, options: ResponseProcessorOptions): ProcessedResponse {
    const { captureReasoning, modelKey, provider } = options;
    
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error(`No response choices returned from ${provider} ${modelKey}`);
    }

    const responseText = choice.message?.content;
    if (!responseText) {
      throw new Error(`Empty response content from ${provider} ${modelKey}`);
    }

    const finishReason = choice.finish_reason || choice.native_finish_reason;
    
    // Extract JSON from response
    const jsonResult = jsonParser.parse(responseText, {
      preserveRawInput: true,
      allowPartialExtraction: true,
      logErrors: true,
      fieldName: `${provider}-${modelKey}`
    });

    if (!jsonResult.success) {
      throw new Error(`JSON extraction failed for ${provider} ${modelKey}: ${jsonResult.error}`);
    }

    const result = jsonResult.data;
    const tokenUsage = this.extractTokenUsage(response);
    const { reasoningLog, reasoningItems } = this.extractReasoning(result, responseText, captureReasoning, provider);

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status: finishReason,
      incomplete: finishReason !== 'stop',
      incompleteReason: finishReason !== 'stop' ? finishReason : undefined
    };
  }

  /**
   * Process OpenAI Responses API format (o3, o4, GPT-5 models)
   */
  processResponsesAPI(response: any, options: ResponseProcessorOptions): ProcessedResponse {
    const { captureReasoning, modelKey, provider } = options;

    let result: any;
    let reasoningLog: string | undefined;

    // Extract response based on format
    if (response.output_text) {
      const textResult = jsonParser.parse(response.output_text, {
        preserveRawInput: true,
        allowPartialExtraction: true,
        logErrors: true,
        fieldName: `${provider}-${modelKey}-output_text`
      });

      if (!textResult.success) {
        throw new Error(`Failed to parse output_text: ${textResult.error}`);
      }
      
      result = textResult.data;
    } else if (response.output && Array.isArray(response.output) && response.output.length > 0) {
      // Handle structured output format
      const outputBlock = response.output[0];
      if (outputBlock.type === 'text' && outputBlock.text) {
        const textResult = jsonParser.parse(outputBlock.text, {
          preserveRawInput: true,
          allowPartialExtraction: true,
          logErrors: true,
          fieldName: `${provider}-${modelKey}-output_block`
        });

        if (!textResult.success) {
          throw new Error(`Failed to parse output block: ${textResult.error}`);
        }
        
        result = textResult.data;
      } else {
        throw new Error(`Unexpected output format: ${JSON.stringify(outputBlock)}`);
      }
    } else {
      throw new Error('No valid output found in Responses API response');
    }

    // Extract reasoning from Responses API
    if (captureReasoning && response.output_reasoning) {
      reasoningLog = response.output_reasoning.summary || 
                    (Array.isArray(response.output_reasoning.items) ? 
                     response.output_reasoning.items.map((item: any) => item.content || item.text).join('\n\n') : 
                     undefined);
    }

    const tokenUsage = this.extractTokenUsage(response);
    const { reasoningItems } = this.extractReasoning(result, '', captureReasoning, provider);

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status: 'completed', // Responses API doesn't have finish_reason
      incomplete: false
    };
  }

  /**
   * Process DeepSeek reasoning model response (special format)
   */
  processDeepSeekReasoning(response: any, options: ResponseProcessorOptions): ProcessedResponse {
    const { captureReasoning, modelKey, provider } = options;
    
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error(`No response choices returned from ${provider} ${modelKey}`);
    }

    // For reasoning models, content field IS the JSON response
    const contentField = choice.message?.content || '';
    
    let result: any;
    
    // Try parsing content directly as JSON first
    const directResult = jsonParser.parse(contentField, {
      preserveRawInput: true,
      allowPartialExtraction: false, // Try direct first
      logErrors: false,
      fieldName: `${provider}-${modelKey}-direct`
    });

    if (directResult.success) {
      result = directResult.data;
    } else {
      // Fallback to text extraction
      const textResult = jsonParser.parse(contentField, {
        preserveRawInput: true,
        allowPartialExtraction: true,
        logErrors: true,
        fieldName: `${provider}-${modelKey}-text`
      });

      if (!textResult.success) {
        throw new Error(`Failed to extract JSON from DeepSeek response: ${textResult.error}`);
      }
      
      result = textResult.data;
    }

    // Extract reasoning from reasoning_content field
    let reasoningLog: string | undefined;
    if (captureReasoning && choice.message?.reasoning_content) {
      reasoningLog = choice.message.reasoning_content;
    }

    const tokenUsage = this.extractTokenUsage(response);
    const { reasoningItems } = this.extractReasoning(result, '', captureReasoning, provider);

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status: response.choices[0].finish_reason,
      incomplete: response.choices[0].finish_reason !== 'stop',
      incompleteReason: response.choices[0].finish_reason !== 'stop' ? response.choices[0].finish_reason : undefined
    };
  }

  /**
   * Process Anthropic tool use response (special format)
   */
  processAnthropicToolUse(response: any, options: ResponseProcessorOptions): ProcessedResponse {
    const { captureReasoning, modelKey, provider } = options;
    
    const content = response.content;
    if (!content || !Array.isArray(content)) {
      throw new Error(`Invalid Anthropic response format for ${modelKey}`);
    }

    let result: any;
    let reasoningLog: string | undefined;
    let reasoningItems: any[] = [];

    // Look for tool use blocks
    const toolUseBlocks = content.filter((block: any) => block.type === 'tool_use');
    
    if (toolUseBlocks.length > 0) {
      const toolUse = toolUseBlocks[0];
      result = toolUse.input;

      // Create reasoning log from tool reasoning items
      if (captureReasoning && result.reasoningItems && Array.isArray(result.reasoningItems)) {
        reasoningItems = result.reasoningItems;
        reasoningLog = reasoningItems.join('\n\n');
      }
    } else {
      // Fallback to text parsing
      const responseText = content[0]?.text || '';
      
      const textResult = jsonParser.parse(responseText, {
        preserveRawInput: true,
        allowPartialExtraction: true,
        logErrors: true,
        fieldName: `${provider}-${modelKey}-fallback`
      });

      if (!textResult.success) {
        throw new Error(`Failed to extract JSON from Anthropic response: ${textResult.error}`);
      }
      
      result = textResult.data;

      // Extract reasoning from pre-JSON text
      if (captureReasoning) {
        const jsonStartPattern = /```json|```\s*{|\s*{/;
        const jsonStartMatch = responseText.search(jsonStartPattern);
        
        if (jsonStartMatch > 50) {
          const preJsonText = responseText.substring(0, jsonStartMatch).trim();
          if (preJsonText.length > 20) {
            reasoningLog = preJsonText;
          }
        }
      }

      // Extract reasoningItems from JSON response
      const { reasoningItems: extractedItems } = this.extractReasoning(result, '', captureReasoning, provider);
      reasoningItems = extractedItems || [];
    }

    const tokenUsage = this.extractTokenUsage(response);
    const isComplete = response.stop_reason === 'end_turn';

    return {
      result,
      tokenUsage,
      reasoningLog,
      reasoningItems,
      status: isComplete ? 'completed' : 'incomplete',
      incomplete: !isComplete,
      incompleteReason: isComplete ? undefined : response.stop_reason
    };
  }

  /**
   * Extract token usage from various response formats
   */
  private extractTokenUsage(response: any): TokenUsage {
    if (response.usage) {
      return {
        input: response.usage.prompt_tokens || response.usage.input_tokens || 0,
        output: response.usage.completion_tokens || response.usage.output_tokens || 0,
        reasoning: response.usage.reasoning_tokens || 0
      };
    }
    
    return { input: 0, output: 0, reasoning: 0 };
  }

  /**
   * Extract reasoning information from parsed result and response text
   */
  private extractReasoning(
    result: any, 
    responseText: string, 
    captureReasoning?: boolean, 
    provider?: string
  ): { reasoningLog?: string; reasoningItems?: any[] } {
    if (!captureReasoning) {
      return {};
    }

    let reasoningLog: string | undefined;
    let reasoningItems: any[] = [];

    // Extract structured reasoning items from JSON
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
    }

    // Extract reasoning log from various sources
    if (result?.reasoning) {
      reasoningLog = typeof result.reasoning === 'string' ? result.reasoning : JSON.stringify(result.reasoning);
    } else if (responseText) {
      // Look for pre-JSON reasoning text
      const jsonStartPattern = /```json|```\s*{|\s*{/;
      const jsonStartMatch = responseText.search(jsonStartPattern);
      
      if (jsonStartMatch > 20) {
        const preJsonText = responseText.substring(0, jsonStartMatch).trim();
        if (preJsonText.length > 20) {
          reasoningLog = preJsonText;
        }
      }
    }

    return { reasoningLog, reasoningItems };
  }
}

// Export singleton instance
export const responseProcessor = ResponseProcessor.getInstance();