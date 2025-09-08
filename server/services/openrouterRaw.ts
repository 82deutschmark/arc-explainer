/**
 * Raw HTTPS OpenRouter service - bypasses OpenAI SDK to avoid JSON parsing issues
 * Uses same approach as diagnostic script that worked perfectly
 * 
 * @author Cascade
 */

import https from 'https';
import { ARCTask } from "../../shared/types.js";
import { getDefaultPromptId } from "./promptBuilder.js";
import type { PromptOptions, PromptPackage } from "./promptBuilder.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { getModelConfig, getApiModelName } from '../config/models/index.js';

export class OpenRouterRawService extends BaseAIService {
  protected provider = "OpenRouter-Raw";
  protected models = {};

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    temperature: number = 0.2,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const usePromptReasoning = true;
    const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts, usePromptReasoning);
    
    this.logAnalysisStart(modelKey, temperature, promptPackage.userPrompt.length, serviceOpts);

    try {
      const response = await this.callProviderAPI(promptPackage, modelKey, temperature, serviceOpts);
      
      const captureReasoning = true;
      const { result, tokenUsage, reasoningLog, reasoningItems } = 
        this.parseProviderResponse(response, modelKey, captureReasoning);

      return this.buildStandardResponse(
        modelKey,
        temperature,
        result,
        tokenUsage,
        serviceOpts,
        reasoningLog,
        Boolean(reasoningLog),
        reasoningItems
      );
    } catch (error) {
      this.handleAnalysisError(error, modelKey, task);
    }
  }

  protected async callProviderAPI(
    prompt: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions
  ): Promise<any> {
    const modelName = getApiModelName(modelKey);
    
    console.log(`[OpenRouter-Raw] Making raw HTTPS call to model: ${modelName}`);

    const requestBody = JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt }
      ],
      temperature: temperature,
      response_format: { type: "json_object" },
      stream: false
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'openrouter.ai',
        port: 443,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'HTTP-Referer': 'https://arc.markbarney.net',
          'X-Title': 'ARC Explainer'
        }
      };

      const startTime = Date.now();
      let responseBody = '';

      const req = https.request(options, (res) => {
        console.log(`[OpenRouter-Raw] HTTP ${res.statusCode} - Content-Type: ${res.headers['content-type']}`);
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          const duration = Date.now() - startTime;
          console.log(`[OpenRouter-Raw] Response received: ${responseBody.length} chars in ${duration}ms`);
          
          // SAVE RAW RESPONSE BEFORE PARSING - capture truncated responses too
          this.saveRawResponse(modelName, responseBody, res.statusCode || 0).catch((err: Error) => 
            console.warn(`[OpenRouter-Raw] Failed to save raw response: ${err.message}`)
          );
          
          try {
            const response = JSON.parse(responseBody);
            resolve(response);
          } catch (parseError) {
            console.error(`[OpenRouter-Raw] JSON PARSE ERROR for ${modelName}:`);
            console.error(`[OpenRouter-Raw] HTTP Status: ${res.statusCode}`);
            console.error(`[OpenRouter-Raw] Response length: ${responseBody.length} chars`);
            console.error(`[OpenRouter-Raw] Headers:`, JSON.stringify(res.headers, null, 2));
            console.error(`[OpenRouter-Raw] FULL RESPONSE BODY:\n${responseBody}`);
            console.error(`[OpenRouter-Raw] First 1000 chars: ${responseBody.substring(0, 1000)}`);
            console.error(`[OpenRouter-Raw] Last 1000 chars: ${responseBody.slice(-1000)}`);
            
            // Try to identify where JSON breaks
            const lastBrace = responseBody.lastIndexOf('}');
            const lastBracket = responseBody.lastIndexOf(']');
            const lastValidJson = Math.max(lastBrace, lastBracket);
            
            console.error(`[OpenRouter-Raw] Last valid JSON char position: ${lastValidJson}`);
            console.error(`[OpenRouter-Raw] Chars after last valid JSON: "${responseBody.slice(lastValidJson + 1)}"`);
            
            reject(new Error(`Raw HTTPS JSON parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[OpenRouter-Raw] HTTPS request error:`, error);
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });
  }

  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[] } {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error(`No response choices returned from OpenRouter-Raw ${modelKey}`);
    }

    const responseText = choice.message?.content;
    if (!responseText) {
      throw new Error(`Empty response content from OpenRouter-Raw ${modelKey}`);
    }

    const finishReason = choice.finish_reason || choice.native_finish_reason;
    console.log(`[OpenRouter-Raw] Response length: ${responseText.length} chars`);
    console.log(`[OpenRouter-Raw] Finish reason: ${finishReason}`);
    console.log(`[OpenRouter-Raw] Response preview: "${responseText.substring(0, 100)}..."`);

    // Parse JSON response
    const result = this.extractJsonFromResponse(responseText, modelKey);

    const tokenUsage: TokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      reasoning: response.usage?.reasoning_tokens || 0
    };

    console.log(`[OpenRouter-Raw] Token usage - Input: ${tokenUsage.input}, Output: ${tokenUsage.output}, Reasoning: ${tokenUsage.reasoning}`);

    // Extract reasoning
    let reasoningLog = null;
    if (captureReasoning && result.reasoning) {
      reasoningLog = typeof result.reasoning === 'string' ? result.reasoning : JSON.stringify(result.reasoning);
      console.log(`[OpenRouter-Raw] Extracted reasoning: ${reasoningLog.length} chars`);
    }

    // Extract reasoning items
    let reasoningItems: any[] = [];
    if (result?.reasoningItems && Array.isArray(result.reasoningItems)) {
      reasoningItems = result.reasoningItems;
      console.log(`[OpenRouter-Raw] Extracted ${reasoningItems.length} reasoning items`);
    }

    return { result, tokenUsage, reasoningLog, reasoningItems };
  }

  /**
   * Save raw HTTP response body before JSON parsing to capture truncated responses
   */
  private async saveRawResponse(modelName: string, responseBody: string, statusCode: number): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedModelName = modelName.replace(/[\/\\:*?"<>|]/g, '-');
      const filename = `raw-response-${sanitizedModelName}-${timestamp}-status${statusCode}.txt`;
      const filepath = path.join('data', 'explained', filename);
      
      const content = `HTTP Status: ${statusCode}\nTimestamp: ${new Date().toISOString()}\nModel: ${modelName}\nResponse Length: ${responseBody.length} chars\n\n${responseBody}`;
      
      await fs.writeFile(filepath, content);
      console.log(`[OpenRouter-Raw] Raw response saved to ${filename}`);
    } catch (error) {
      console.error(`[OpenRouter-Raw] Failed to save raw response:`, error);
    }
  }

  getModelInfo(modelKey: string): ModelInfo {
    const modelConfig = getModelConfig(modelKey);
    
    if (!modelConfig) {
      return {
        name: modelKey,
        isReasoning: false,
        supportsTemperature: true,
        contextWindow: undefined,
        supportsFunctionCalling: false,
        supportsSystemPrompts: true,
        supportsStructuredOutput: true,
        supportsVision: false
      };
    }

    return {
      name: modelConfig.name,
      isReasoning: modelConfig.isReasoning || false,
      supportsTemperature: modelConfig.supportsTemperature || true,
      contextWindow: modelConfig.contextWindow,
      supportsFunctionCalling: false,
      supportsSystemPrompts: true,
      supportsStructuredOutput: true,
      supportsVision: false
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): PromptPreview {
    const promptPackage = this.buildPromptPackage(task, promptId || getDefaultPromptId(), customPrompt, options, serviceOpts);
    const modelName = getApiModelName(modelKey);
    
    const messages = [
      { role: "system", content: promptPackage.systemPrompt },
      { role: "user", content: promptPackage.userPrompt }
    ];

    const fullPromptText = `System: ${promptPackage.systemPrompt}\n\nUser: ${promptPackage.userPrompt}`;

    return {
      provider: this.provider,
      modelName: modelName,
      promptText: fullPromptText,
      messageFormat: messages,
      systemPromptMode: serviceOpts?.systemPromptMode || 'ARC',
      templateInfo: {
        id: promptId || getDefaultPromptId(),
        name: promptPackage.templateName || 'Default',
        usesEmojis: false
      },
      promptStats: {
        characterCount: fullPromptText.length,
        wordCount: fullPromptText.split(/\s+/).length,
        lineCount: fullPromptText.split('\n').length
      },
      providerSpecificNotes: "Raw HTTPS OpenRouter implementation - bypasses OpenAI SDK to avoid JSON parsing issues."
    };
  }
}

export const openrouterRawService = new OpenRouterRawService();
