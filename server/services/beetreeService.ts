/**
 * server/services/beetreeService.ts
 * 
 * Service layer for beetreeARC multi-model ensemble solver
 * Extends BaseAIService but uses Python bridge for actual execution
 * 
 * Author: Cascade (model: Cascade GPT-5 medium reasoning)
 * Date: 2025-12-01
 * PURPOSE: Orchestrate beetreeARC single-puzzle execution with cost tracking and result persistence
 * SRP/DRY check: Pass - Reuses pythonBridge, costTracker, and database patterns
 */

import { BaseAIService, ServiceOptions, AIResponse, TokenUsage, ModelInfo, PromptPreview } from './base/BaseAIService.js';
import { PromptPackage, PromptOptions } from './promptBuilder.js';
import { pythonBridge, BeetreeBridgeOptions, BeetreeBridgeEvent } from './pythonBridge.js';
import { ARCTask } from '../../shared/types.js';
import { logger } from '../utils/logger.js';
import { ExplanationRepository } from '../repositories/ExplanationRepository.js';
import { validateSolverResponse } from '../services/schemas/solver.js';

// Beetree-specific types will be added after creating shared/types.ts
interface BeetreeRunConfig {
  taskId: string;
  testIndex: number;
  mode: 'testing' | 'production';
  runTimestamp?: string;
}

interface BeetreeCostBreakdown {
  total_cost: number;
  by_model: Array<{
    model_name: string;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cost: number;
  }>;
  by_stage: Array<{
    stage: string;
    cost: number;
    duration_ms: number;
  }>;
  total_tokens: {
    input: number;
    output: number;
    reasoning: number;
  };
}

interface BeetreeResult {
  taskId: string;
  testIndex: number;
  mode: string;
  runTimestamp: string;
  predictions: number[][][];
  costBreakdown: BeetreeCostBreakdown;
  verboseLog: string;
}

export class BeetreeService extends BaseAIService {
  protected provider = 'beetree';
  protected models = {
    'beetree-testing': 'beetree-testing',
    'beetree-production': 'beetree-production',
    'beetree-ensemble-gpt5': 'beetree-ensemble-gpt5',
    'beetree-ensemble-claude': 'beetree-ensemble-claude',
    'beetree-ensemble-gemini': 'beetree-ensemble-gemini',
    'beetree-full': 'beetree-full'
  };

  private explanationRepository: ExplanationRepository;

  constructor() {
    super();
    this.explanationRepository = new ExplanationRepository();
  }

  /**
   * Main analysis method - orchestrates beetreeARC execution
   */
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature?: number,
    promptId?: string,
    customPrompt?: string,
    options?: any,
    serviceOpts?: ServiceOptions
  ): Promise<AIResponse> {
    try {
      // Extract mode from model key
      const mode = this.extractModeFromModelKey(modelKey);
      const testIndex = 1; // Default to first test case
      
      // Generate run timestamp
      const runTimestamp = `beetree_${Date.now()}`;
      
      // Build configuration for Python bridge
      const config: BeetreeBridgeOptions = {
        taskId,
        testIndex,
        mode,
        runTimestamp
      };

      logger.service(this.provider, `Starting beetree analysis for ${taskId} in ${mode} mode`);

      // Track cost and progress
      let finalResult: BeetreeResult | null = null;
      let currentCost = 0.0;
      let currentStage = 'Initializing';

      // Execute beetree via Python bridge
      const { code } = await pythonBridge.runBeetreeAnalysis(config, (event: BeetreeBridgeEvent) => {
        switch (event.type) {
          case 'start':
            logger.service(this.provider, `Beetree started for ${taskId}`);
            break;
            
          case 'progress':
            currentStage = event.stage;
            if (event.costSoFar !== undefined) {
              currentCost = event.costSoFar;
            }
            
            // Emit progress to streaming harness if available
            if (serviceOpts?.stream) {
              serviceOpts.stream.emit({
                type: 'progress',
                content: `Stage: ${event.stage}`,
                metadata: {
                  stage: event.stage,
                  costSoFar: currentCost,
                  status: event.status,
                  outcome: event.outcome
                }
              });
            }
            break;
            
          case 'log':
            logger.service(this.provider, `[${event.level.toUpperCase()}] ${event.message}`);
            break;
            
          case 'final':
            if (event.success && event.result) {
              finalResult = event.result;
              logger.service(this.provider, `Beetree completed for ${taskId} with cost: $${finalResult.costBreakdown.total_cost.toFixed(4)}`);
            } else {
              logger.service(this.provider, `Beetree failed for ${taskId}`, 'error');
            }
            break;
            
          case 'error':
            logger.service(this.provider, `Beetree error: ${event.message}`, 'error');
            break;
        }
      });

      if (code !== 0 || !finalResult) {
        throw new Error(`Beetree execution failed with exit code ${code}`);
      }

      // TypeScript narrowing - finalResult is guaranteed non-null here
      const beetreeResult = finalResult as BeetreeResult;

      // Validate predictions against task
      const validationResult = this.validatePredictions(task, beetreeResult.predictions);
      
      // Build AIResponse from beetree result
      const response = this.buildAIResponse(
        modelKey,
        temperature || 0.2,
        beetreeResult,
        validationResult,
        serviceOpts
      );

      // Save to database if store option is enabled
      if (serviceOpts?.store !== false) {
        await this.saveBeetreeResult(taskId, modelKey, beetreeResult, response);
      }

      return response;

    } catch (error) {
      logger.logError('Beetree analysis failed', { error, context: this.provider });
      throw error;
    }
  }

  /**
   * Get model info - required by BaseAIService
   */
  getModelInfo(modelKey: string): ModelInfo {
    return {
      name: modelKey,
      isReasoning: true,
      supportsTemperature: false,
      contextWindow: 128000,
      supportsFunctionCalling: false,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false,
      supportsVision: false
    };
  }

  /**
   * Generate prompt preview - required by BaseAIService
   * Beetree uses Python bridge so this returns a stub
   */
  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): PromptPreview {
    return {
      provider: this.provider,
      modelName: modelKey,
      promptText: 'Beetree uses Python bridge - prompt generated internally',
      messageFormat: null,
      systemPromptMode: 'ARC',
      templateInfo: {
        id: 'beetree-internal',
        name: 'Beetree Internal',
        usesEmojis: false
      },
      promptStats: {
        characterCount: 0,
        wordCount: 0,
        lineCount: 0
      },
      providerSpecificNotes: 'Beetree ensemble uses Python bridge for multi-model orchestration'
    };
  }

  /**
   * Call provider API - required by BaseAIService
   * Beetree uses Python bridge exclusively
   */
  protected async callProviderAPI(
    prompt: PromptPackage,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string
  ): Promise<any> {
    throw new Error('Beetree uses Python bridge - callProviderAPI not applicable');
  }

  /**
   * Parse provider response - required by BaseAIService
   * Beetree uses Python bridge exclusively
   */
  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string } {
    throw new Error('Beetree uses Python bridge - parseProviderResponse not applicable');
  }

  /**
   * Extract mode from model key string
   */
  private extractModeFromModelKey(modelKey: string): 'testing' | 'production' {
    if (modelKey.includes('production') || modelKey.includes('full')) {
      return 'production';
    }
    return 'testing';
  }

  /**
   * Validate predictions against task test cases
   */
  private validatePredictions(task: ARCTask, predictions: number[][][]): {
    isValid: boolean;
    isPredictionCorrect: boolean;
    multiTestResults?: Array<{ testIndex: number; isPredictionCorrect: boolean }>;
    multiTestAllCorrect?: boolean;
    multiTestAverageAccuracy?: number;
  } {
    if (!predictions || predictions.length === 0) {
      return { isValid: false, isPredictionCorrect: false };
    }

    const testCases = task.test || [];
    const results: Array<{ testIndex: number; isPredictionCorrect: boolean }> = [];
    
    for (let i = 0; i < Math.min(predictions.length, testCases.length); i++) {
      const predicted = predictions[i];
      const expected = testCases[i]?.output;
      
      const isCorrect = this.gridsMatch(predicted, expected);
      results.push({ testIndex: i, isPredictionCorrect: isCorrect });
    }

    const correctCount = results.filter(r => r.isPredictionCorrect).length;
    const allCorrect = results.length > 0 && correctCount === results.length;
    const avgAccuracy = results.length > 0 ? (correctCount / results.length) * 100 : 0;

    return {
      isValid: true,
      isPredictionCorrect: results[0]?.isPredictionCorrect ?? false,
      multiTestResults: results,
      multiTestAllCorrect: allCorrect,
      multiTestAverageAccuracy: avgAccuracy
    };
  }

  /**
   * Check if two grids match exactly
   */
  private gridsMatch(a: number[][] | undefined, b: number[][] | undefined): boolean {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (!a[i] || !b[i] || a[i].length !== b[i].length) return false;
      for (let j = 0; j < a[i].length; j++) {
        if (a[i][j] !== b[i][j]) return false;
      }
    }
    return true;
  }

  /**
   * Build AIResponse from beetree result
   */
  private buildAIResponse(
    modelKey: string,
    temperature: number,
    result: BeetreeResult,
    validationResult: ReturnType<BeetreeService['validatePredictions']>,
    serviceOpts?: ServiceOptions
  ): AIResponse {
    const costBreakdown = result.costBreakdown;
    
    return {
      model: modelKey,
      reasoningLog: result.verboseLog,
      hasReasoningLog: !!result.verboseLog,
      temperature,
      reasoningEffort: null,
      reasoningVerbosity: null,
      reasoningSummaryType: null,
      inputTokens: costBreakdown.total_tokens.input,
      outputTokens: costBreakdown.total_tokens.output,
      reasoningTokens: costBreakdown.total_tokens.reasoning,
      totalTokens: costBreakdown.total_tokens.input + costBreakdown.total_tokens.output + costBreakdown.total_tokens.reasoning,
      estimatedCost: costBreakdown.total_cost,
      status: 'completed',
      incomplete: false,
      // Beetree-specific fields
      predictedOutput: result.predictions[0],
      predictedOutputs: result.predictions,
      isPredictionCorrect: validationResult.isPredictionCorrect,
      multiTestResults: validationResult.multiTestResults,
      multiTestAllCorrect: validationResult.multiTestAllCorrect,
      multiTestAverageAccuracy: validationResult.multiTestAverageAccuracy,
      // Provider metadata
      providerResponseId: null,
      beetreeCostBreakdown: costBreakdown,
      beetreeMode: result.mode,
      beetreeRunTimestamp: result.runTimestamp
    };
  }

  /**
   * Save beetree result to database
   */
  private async saveBeetreeResult(
    taskId: string,
    modelKey: string,
    result: BeetreeResult,
    response: AIResponse
  ): Promise<void> {
    try {
      const explanationData = {
        puzzleId: taskId,
        modelName: modelKey,
        patternDescription: `Beetree ensemble analysis in ${result.mode} mode`,
        solvingStrategy: `Multi-model consensus with ${result.costBreakdown.by_model.length} models`,
        hints: [],
        confidence: 50, // Default confidence for ensemble
        predictedOutputGrid: result.predictions[0] || null,
        isPredictionCorrect: response.isPredictionCorrect,
        hasMultiplePredictions: result.predictions.length > 1,
        multiplePredictedOutputs: result.predictions.length > 1 ? result.predictions : null,
        multiTestPredictionGrids: result.predictions.length > 1 ? result.predictions : null,
        multiTestResults: response.multiTestResults || null,
        multiTestAllCorrect: response.multiTestAllCorrect || null,
        multiTestAverageAccuracy: response.multiTestAverageAccuracy || null,
        reasoningLog: result.verboseLog,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        reasoningTokens: response.reasoningTokens,
        totalTokens: response.totalTokens,
        estimatedCost: response.estimatedCost,
        // Beetree-specific metadata
        beetreeMode: result.mode,
        beetreeRunTimestamp: result.runTimestamp,
        beetreeCostBreakdown: result.costBreakdown,
        beetreeTokenUsage: result.costBreakdown.total_tokens,
        beetreeModelResults: result.costBreakdown.by_model
      };

      await this.explanationRepository.saveExplanation(explanationData);
      logger.service(this.provider, `Saved beetree result for ${taskId}`);
    } catch (error) {
      logger.logError('Failed to save beetree result', { error, context: `taskId: ${taskId}` });
      // Don't throw - saving is optional
    }
  }

  /**
   * Estimate cost before running analysis (used by controller)
   */
  async estimateCost(taskId: string, testIndex: number, mode: 'testing' | 'production'): Promise<{
    estimatedTotalCost: number;
    costBreakdown: BeetreeCostBreakdown;
    estimatedDuration: { min: number; max: number; average: number };
    recommendedStages: number;
  }> {
    // Testing mode: 3 models, quick consensus
    const testingEstimate: BeetreeCostBreakdown = {
      total_cost: 1.25,
      by_model: [
        { model_name: 'gpt-5.1-none', input_tokens: 15000, output_tokens: 3000, reasoning_tokens: 0, cost: 0.30 },
        { model_name: 'claude-sonnet-4.5-no-thinking', input_tokens: 18000, output_tokens: 4000, reasoning_tokens: 0, cost: 0.45 },
        { model_name: 'gemini-3-low', input_tokens: 20000, output_tokens: 5000, reasoning_tokens: 0, cost: 0.50 }
      ],
      by_stage: [
        { stage: 'Step 1 (Shallow search)', cost: 0.50, duration_ms: 60000 },
        { stage: 'Step 2 (Evaluation)', cost: 0.25, duration_ms: 30000 },
        { stage: 'Step 3 (Extended search)', cost: 0.30, duration_ms: 90000 },
        { stage: 'Step 4 (Evaluation)', cost: 0.10, duration_ms: 30000 },
        { stage: 'Step 5 (Full search)', cost: 0.10, duration_ms: 30000 }
      ],
      total_tokens: { input: 53000, output: 12000, reasoning: 0 }
    };

    // Production mode: 8 frontier models, comprehensive analysis
    const productionEstimate: BeetreeCostBreakdown = {
      total_cost: 32.50,
      by_model: [
        { model_name: 'gpt-5.1-high', input_tokens: 40000, output_tokens: 8000, reasoning_tokens: 12000, cost: 8.00 },
        { model_name: 'gpt-5.1-high', input_tokens: 40000, output_tokens: 8000, reasoning_tokens: 12000, cost: 8.00 },
        { model_name: 'claude-opus-4.5-thinking-60000', input_tokens: 35000, output_tokens: 7000, reasoning_tokens: 10000, cost: 6.50 },
        { model_name: 'claude-sonnet-4.5-thinking-60000', input_tokens: 30000, output_tokens: 6000, reasoning_tokens: 8000, cost: 3.50 },
        { model_name: 'gemini-3-high', input_tokens: 30000, output_tokens: 6000, reasoning_tokens: 0, cost: 2.50 },
        { model_name: 'gemini-3-high', input_tokens: 30000, output_tokens: 6000, reasoning_tokens: 0, cost: 2.00 },
        { model_name: 'deepseek-coder', input_tokens: 20000, output_tokens: 4000, reasoning_tokens: 0, cost: 1.50 },
        { model_name: 'grok-mini', input_tokens: 15000, output_tokens: 3000, reasoning_tokens: 0, cost: 0.50 }
      ],
      by_stage: [
        { stage: 'Step 1 (Shallow search)', cost: 8.00, duration_ms: 300000 },
        { stage: 'Step 2 (Evaluation)', cost: 2.00, duration_ms: 120000 },
        { stage: 'Step 3 (Extended search)', cost: 10.00, duration_ms: 600000 },
        { stage: 'Step 4 (Evaluation)', cost: 2.50, duration_ms: 180000 },
        { stage: 'Step 5 (Full search)', cost: 10.00, duration_ms: 900000 }
      ],
      total_tokens: { input: 240000, output: 48000, reasoning: 42000 }
    };

    const estimate = mode === 'testing' ? testingEstimate : productionEstimate;
    const duration = mode === 'testing' 
      ? { min: 120, max: 360, average: 240 }  // 2-6 minutes in seconds
      : { min: 1200, max: 2700, average: 1920 }; // 20-45 minutes in seconds

    return {
      estimatedTotalCost: estimate.total_cost,
      costBreakdown: estimate,
      estimatedDuration: duration,
      recommendedStages: 5
    };
  }
}

const beetreeService = new BeetreeService();

export { beetreeService };
