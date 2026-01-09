/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Regression coverage for BaseAIService truncation detection, JSON extraction,
 *          response shaping, and model capability helpers.
 * SRP/DRY check: Pass - Focused BaseAIService behavior only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAIService, type AIResponse, type TokenUsage, type ModelInfo, type PromptPreview } from '../../../server/services/base/BaseAIService.js';
import type { ARCTask } from '../../../shared/types.js';
import { createMockPuzzle, createMockTokenUsage } from '../../helpers/fixtures.js';

// Create a concrete test class extending BaseAIService
class TestAIService extends BaseAIService {
  protected provider = 'test';
  protected models = {
    'test-model': 'test-model-id',
    'test-reasoning-model': 'test-reasoning-model-id'
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature?: number,
    promptId?: string,
    customPrompt?: string,
    options?: any,
    serviceOpts?: any
  ): Promise<AIResponse> {
    return this.buildStandardResponse(
      modelKey,
      temperature || 0.2,
      { patternDescription: 'Test pattern' },
      { input: 100, output: 50 },
      serviceOpts || {}
    );
  }

  getModelInfo(modelKey: string): ModelInfo {
    return {
      name: modelKey,
      isReasoning: modelKey.includes('reasoning'),
      supportsTemperature: true,
      supportsFunctionCalling: false,
      supportsSystemPrompts: true,
      supportsStructuredOutput: modelKey === 'test-structured-model',
      supportsVision: false
    };
  }

  generatePromptPreview(): PromptPreview {
    throw new Error('Not implemented');
  }

  protected async callProviderAPI(): Promise<any> {
    throw new Error('Not implemented');
  }

  protected parseProviderResponse(): any {
    throw new Error('Not implemented');
  }

  // Expose protected methods for testing
  public testDetectResponseTruncation(text: string, finishReason?: string): boolean {
    return this.detectResponseTruncation(text, finishReason);
  }

  public testCalculateResponseCost(modelKey: string, tokenUsage: TokenUsage) {
    return this.calculateResponseCost(modelKey, tokenUsage);
  }

  public testBuildStandardResponse(
    modelKey: string,
    temperature: number,
    result: any,
    tokenUsage: TokenUsage,
    serviceOpts: any,
    reasoningLog?: any,
    hasReasoningLog: boolean = false,
    reasoningItems?: any[],
    status?: string,
    incomplete?: boolean,
    incompleteReason?: string,
    promptPackage?: any,
    promptTemplateId?: string,
    customPromptText?: string,
    responseId?: string
  ): AIResponse {
    return this.buildStandardResponse(
      modelKey,
      temperature,
      result,
      tokenUsage,
      serviceOpts,
      reasoningLog,
      hasReasoningLog,
      reasoningItems,
      status,
      incomplete,
      incompleteReason,
      promptPackage,
      promptTemplateId,
      customPromptText,
      responseId
    );
  }

  public testExtractJsonFromResponse(text: string, modelKey: string): any {
    return this.extractJsonFromResponse(text, modelKey);
  }

  public testSupportsStructuredOutput(modelKey: string): boolean {
    return this.supportsStructuredOutput(modelKey);
  }
}

describe('BaseAIService', () => {
  let service: TestAIService;

  beforeEach(() => {
    service = new TestAIService();
  });

  describe('detectResponseTruncation', () => {
    it('should detect truncation via finish_reason=length', () => {
      const result = service.testDetectResponseTruncation('some text', 'length');
      expect(result).toBe(true);
    });

    it('should not detect truncation for finish_reason=stop', () => {
      const result = service.testDetectResponseTruncation('complete response', 'stop');
      expect(result).toBe(false);
    });

    it('should not detect truncation for complete JSON', () => {
      const json = JSON.stringify({ key: 'value', nested: { prop: 'data' } });
      const result = service.testDetectResponseTruncation(json, 'stop');
      expect(result).toBe(false);
    });

    it('should detect truncation for incomplete JSON - missing closing brace', () => {
      const incomplete = '{"key": "value", "nested": {"prop": "data"';
      const result = service.testDetectResponseTruncation(incomplete);
      expect(result).toBe(true);
    });

    it('should detect truncation for incomplete JSON - unmatched brackets', () => {
      const unmatched = '{"key": ["value1", "value2"}';
      const result = service.testDetectResponseTruncation(unmatched);
      expect(result).toBe(true);
    });

    it('should detect truncation for abrupt ending without punctuation', () => {
      const abrupt = 'This is a sentence that ends abrupty without proper punctu';
      const result = service.testDetectResponseTruncation(abrupt, 'unknown');
      expect(result).toBe(false);
    });

    it('should not detect truncation for properly ended sentences', () => {
      const complete = 'This is a complete sentence.';
      const result = service.testDetectResponseTruncation(complete, 'stop');
      expect(result).toBe(false);
    });

    it('should not detect truncation for ellipsis ending', () => {
      const ellipsis = 'This sentence trails off...';
      const result = service.testDetectResponseTruncation(ellipsis, 'stop');
      expect(result).toBe(false);
    });

    it('should detect empty content with non-stop finish reason', () => {
      const result = service.testDetectResponseTruncation('', 'unknown');
      expect(result).toBe(true);
    });

    it('should not detect empty content with stop finish reason', () => {
      const result = service.testDetectResponseTruncation('', 'stop');
      expect(result).toBe(false);
    });

    it('should handle multiple levels of nested braces', () => {
      const nested = '{"a": {"b": {"c": {"d": "value"}}}}';
      const result = service.testDetectResponseTruncation(nested, 'stop');
      expect(result).toBe(false);
    });

    it('should detect missing closing brace in deeply nested JSON', () => {
      const incomplete = '{"a": {"b": {"c": {"d": "value"}}';
      const result = service.testDetectResponseTruncation(incomplete);
      expect(result).toBe(true);
    });
  });

  describe('buildStandardResponse', () => {
    it('should build response with all required fields', () => {
      const result = { patternDescription: 'Test', confidence: 0.9 };
      const tokenUsage = createMockTokenUsage();

      const response = service.testBuildStandardResponse(
        'test-model',
        0.2,
        result,
        tokenUsage,
        {}
      );

      expect(response.model).toBe('test-model');
      expect(response.temperature).toBe(0.2);
      expect(response.inputTokens).toBe(1000);
      expect(response.outputTokens).toBe(500);
      expect(response.reasoningTokens).toBe(2000);
      expect(response.totalTokens).toBe(3500);
      expect(response.patternDescription).toBe('Test');
      expect(response.confidence).toBe(0.9);
    });

    it('should preserve individual prediction fields (predictedOutput1, predictedOutput2)', () => {
      const result = {
        predictedOutput: [[1, 2]],
        predictedOutput1: [[3, 4]],
        predictedOutput2: [[5, 6]],
        predictedOutput3: [[7, 8]]
      };

      const response = service.testBuildStandardResponse(
        'test-model',
        0.2,
        result,
        createMockTokenUsage(),
        {}
      );

      expect(response.predictedOutput).toEqual([[1, 2]]);
      expect(response.predictedOutput1).toEqual([[3, 4]]);
      expect(response.predictedOutput2).toEqual([[5, 6]]);
      expect(response.predictedOutput3).toEqual([[7, 8]]);
    });

    it('should include reasoning parameters when provided', () => {
      const serviceOpts = {
        reasoningEffort: 'high',
        reasoningVerbosity: 'high',
        reasoningSummaryType: 'detailed'
      };

      const response = service.testBuildStandardResponse(
        'test-model',
        0.2,
        {},
        createMockTokenUsage(),
        serviceOpts
      );

      expect(response.reasoningEffort).toBe('high');
      expect(response.reasoningVerbosity).toBe('high');
      expect(response.reasoningSummaryType).toBe('detailed');
    });

    it('should include provider response ID when provided', () => {
      const response = service.testBuildStandardResponse(
        'test-model',
        0.2,
        {},
        createMockTokenUsage(),
        {},
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'response-id-123'
      );

      expect(response.providerResponseId).toBe('response-id-123');
    });

    it('should preserve raw response and parse metadata', () => {
      const result = {
        _rawResponse: 'original response text',
        _parseError: 'parse error message',
        _parsingFailed: true,
        _parseMethod: 'fallback'
      };

      const response = service.testBuildStandardResponse(
        'test-model',
        0.2,
        result,
        createMockTokenUsage(),
        {}
      );

      expect(response._rawResponse).toBe('original response text');
      expect(response._parseError).toBe('parse error message');
      expect(response._parsingFailed).toBe(true);
      expect(response._parseMethod).toBe('fallback');
    });

    it('should handle incomplete responses', () => {
      const response = service.testBuildStandardResponse(
        'test-model',
        0.2,
        {},
        createMockTokenUsage(),
        {},
        undefined,
        false,
        undefined,
        'incomplete',
        true,
        'max_tokens_reached'
      );

      expect(response.status).toBe('incomplete');
      expect(response.incomplete).toBe(true);
      expect(response.incompleteReason).toBe('max_tokens_reached');
    });
  });

  describe('extractJsonFromResponse', () => {
    it('should extract valid JSON from text', () => {
      const text = '{"key": "value", "number": 42}';
      const result = service.testExtractJsonFromResponse(text, 'test-model');

      expect(result.key).toBe('value');
      expect(result.number).toBe(42);
    });

    it('should extract JSON from text with surrounding content', () => {
      const text = 'Here is the JSON: {"key": "value"} and some more text';
      const result = service.testExtractJsonFromResponse(text, 'test-model');

      expect(result.key).toBe('value');
    });

    it('should preserve raw response on parse success', () => {
      const text = '{"key": "value"}';
      const result = service.testExtractJsonFromResponse(text, 'test-model');

      expect(result._rawResponse).toBe(text);
    });

    it('should handle parse failure gracefully', () => {
      const text = 'this is not valid json at all';
      const result = service.testExtractJsonFromResponse(text, 'test-model');

      expect(result._rawResponse).toBe(text);
      expect(result._parsingFailed).toBe(true);
      expect(result._parseError).toBeDefined();
    });

    it('should extract nested JSON structures', () => {
      const text = '{"user": {"name": "Test", "age": 30}, "items": [1, 2, 3]}';
      const result = service.testExtractJsonFromResponse(text, 'test-model');

      expect(result.user.name).toBe('Test');
      expect(result.user.age).toBe(30);
      expect(result.items).toEqual([1, 2, 3]);
    });
  });

  describe('supportsStructuredOutput', () => {
    it('should return true for model with structured output support', () => {
      const result = service.testSupportsStructuredOutput('test-structured-model');
      expect(result).toBe(true);
    });

    it('should return false for model without structured output support', () => {
      const result = service.testSupportsStructuredOutput('test-model');
      expect(result).toBe(false);
    });

    it('should handle unknown model gracefully', () => {
      const result = service.testSupportsStructuredOutput('unknown-model');
      expect(result).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    it('should return correct info for standard model', () => {
      const info = service.getModelInfo('test-model');

      expect(info.name).toBe('test-model');
      expect(info.isReasoning).toBe(false);
      expect(info.supportsTemperature).toBe(true);
      expect(info.supportsStructuredOutput).toBe(false);
    });

    it('should detect reasoning models', () => {
      const info = service.getModelInfo('test-reasoning-model');

      expect(info.isReasoning).toBe(true);
    });

    it('should detect structured output support', () => {
      const info = service.getModelInfo('test-structured-model');

      expect(info.supportsStructuredOutput).toBe(true);
    });
  });

  describe('supportsStreaming', () => {
    it('should return false by default', () => {
      const result = service.supportsStreaming('test-model');
      expect(result).toBe(false);
    });
  });

  describe('analyzePuzzleWithModel', () => {
    it('should return standard response structure', async () => {
      const task = createMockPuzzle();
      const response = await service.analyzePuzzleWithModel(
        task,
        'test-model',
        'task-123',
        0.2
      );

      expect(response.model).toBe('test-model');
      expect(response.temperature).toBe(0.2);
      expect(response).toHaveProperty('inputTokens');
      expect(response).toHaveProperty('outputTokens');
    });
  });
});
