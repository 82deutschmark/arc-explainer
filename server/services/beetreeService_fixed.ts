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

import { BaseAIService, ServiceOptions, AIResponse, TokenUsage } from './base/BaseAIService.js';
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

      // Validate predictions against task
      const validationResult = this.validatePredictions(task, finalResult.predictions);
      
      // Build AIResponse from beetree result
      const response = this.buildAIResponse(
        modelKey,
        temperature || 0.2,
        finalResult,
        validationResult,
        serviceOpts
      );

      // Save to database if store option is enabled
      if (serviceOpts?.store !== false) {
        await this.saveBeetreeResult(taskId, modelKey, finalResult, response);
      }

      return response;

    } catch (error) {
      logger.logError('Beetree analysis failed', { error, context: this.provider });
      throw error;
    }
  }

  /**
   * Get model information for beetree ensemble
   */
  getModelInfo(modelKey: string) {
    const mode = this.extractModeFromModelKey(modelKey);
    
    return {
      name: modelKey,
      isReasoning: false, // beetree orchestrates reasoning models internally
      supportsTemperature: false, // Temperature handled by beetree internally
      contextWindow: 128000, // Large context for ensemble
      supportsFunctionCalling: false,
      supportsSystemPrompts: false,
      supportsStructuredOutput: false,
      supportsVision: false
    };
  }

  /**
   * Generate prompt preview (not applicable for beetree)
   */
  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId?: string,
    customPrompt?: string,
    options?: any,
    serviceOpts?: ServiceOptions
  ) {
    const mode = this.extractModeFromModelKey(modelKey);
    
    return {
      provider: this.provider,
      modelName: modelKey,
      promptText: `[Beetree ${mode} mode] Multi-model ensemble execution`,
      messageFormat: null,
      systemPromptMode: 'None',
      templateInfo: {
        id: 'beetree-ensemble',
        name: 'BeeTree Ensemble',
        usesEmojis: false
      },
      promptStats: {
        characterCount: 0,
        wordCount: 0,
        lineCount: 0
      },
      providerSpecificNotes: `Beetree runs ${mode === 'testing' ? '3' : '8'} models in parallel across 5 stages`
    };
  }

  /**
   * Beetree doesn't use the standard provider API pattern
   */
  protected async callProviderAPI(
    prompt: any,
    modelKey: string,
    temperature: number,
    serviceOpts: ServiceOptions,
    testCount: number,
    taskId?: string
  ): Promise<any> {
    throw new Error('Beetree uses Python bridge instead of direct provider API');
  }

  /**
   * Beetree doesn't use standard response parsing
   */
  protected parseProviderResponse(
    response: any,
    modelKey: string,
    captureReasoning: boolean,
    puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string; } {
    throw new Error('Beetree uses custom result processing instead of standard parsing');
  }

  /**
   * Extract mode from model key
   */
  private extractModeFromModelKey(modelKey: string): 'testing' | 'production' {
    if (modelKey.includes('testing')) {
      return 'testing';
    }
    return 'production';
  }

  /**
   * Validate beetree predictions against task
   */
  private validatePredictions(task: ARCTask, predictions: number[][][]): any {
    if (!task.test || task.test.length === 0) {
      return { isValid: true, message: 'No test cases to validate against' };
    }

    const testOutputs = task.test.map(t => t.output);
    
    if (predictions.length === 1 && testOutputs.length === 1) {
      // Single test case
      return validateSolverResponse(
        { predictedOutput: predictions[0] },
        testOutputs[0],
        'external-beetree',
        null
      );
    } else if (predictions.length === testOutputs.length) {
      // Multiple test cases - use single validation for each
      const results = [];
      for (let i = 0; i < predictions.length; i++) {
        const result = validateSolverResponse(
          { predictedOutput: predictions[i] },
          testOutputs[i],
          'external-beetree',
          null
        );
        results.push(result);
      }
      
      const allCorrect = results.every(r => r.isValid);
      const correctCount = results.filter(r => r.isValid).length;
      
      return {
        isValid: allCorrect,
        message: allCorrect ? 'All predictions correct' : `${correctCount}/${predictions.length} predictions correct`,
        multiTestResults: results,
        multiTestAllCorrect: allCorrect,
        multiTestAverageAccuracy: correctCount / predictions.length
      };
    } else {
      return {
        isValid: false,
        message: `Prediction count (${predictions.length}) doesn't match test case count (${testOutputs.length})`
      };
    }
  }

  /**
   * Build AIResponse from beetree result
   */
  private buildAIResponse(
    modelKey: string,
    temperature: number,
    beetreeResult: BeetreeResult,
    validationResult: any,
    serviceOpts?: ServiceOptions
  ): AIResponse {
    const costBreakdown = beetreeResult.costBreakdown;
    const isMultiTest = beetreeResult.predictions.length > 1;
    
    // Aggregate token usage
    const totalTokens: TokenUsage = {
      input: costBreakdown.total_tokens.input,
      output: costBreakdown.total_tokens.output,
      reasoning: costBreakdown.total_tokens.reasoning
    };

    // Build explanation from beetree results
    const patternDescription = `Beetree ensemble solution using ${beetreeResult.mode} mode with ${costBreakdown.by_model.length} models`;
    const solvingStrategy = `Multi-model consensus across 5 stages. Total cost: $${costBreakdown.total_cost.toFixed(4)}`;
    
    return {
      model: modelKey,
      reasoningLog: beetreeResult.verboseLog,
      hasReasoningLog: !!beetreeResult.verboseLog,
      temperature,
      reasoningEffort: serviceOpts?.reasoningEffort || null,
      reasoningVerbosity: serviceOpts?.reasoningVerbosity || null,
      reasoningSummaryType: serviceOpts?.reasoningSummaryType || null,
      inputTokens: totalTokens.input,
      outputTokens: totalTokens.output,
      reasoningTokens: totalTokens.reasoning,
      totalTokens: totalTokens.input + totalTokens.output + (totalTokens.reasoning || 0),
      estimatedCost: costBreakdown.total_cost,
      status: 'completed',
      incomplete: false,
      incompleteReason: undefined,
      reasoningItems: undefined,
      systemPromptUsed: null,
      userPromptUsed: null,
      promptTemplateId: 'external-beetree',
      customPromptText: null,
      providerResponseId: beetreeResult.runTimestamp,
      // Prediction fields
      patternDescription,
      solvingStrategy,
      hints: [],
      confidence: null,
      predictedOutput: beetreeResult.predictions[0],
      predictedOutputGrid: beetreeResult.predictions[0],
      multiplePredictedOutputs: isMultiTest ? beetreeResult.predictions : undefined,
      multiTestResults: validationResult.multiTestResults,
      isPredictionCorrect: validationResult.isPredictionCorrect,
      trustworthinessScore: null,
      // Multi-test specific fields
      ...(isMultiTest && {
        hasMultiplePredictions: true,
        multiTestPredictionGrids: beetreeResult.predictions,
        multiTestAllCorrect: validationResult.multiTestAllCorrect,
        multiTestAverageAccuracy: validationResult.multiTestAverageAccuracy
      }),
      // Store cost breakdown in provider response
      providerRawResponse: {
        beetree_metadata: {
          mode: beetreeResult.mode,
          runTimestamp: beetreeResult.runTimestamp,
          costBreakdown,
          stageResults: costBreakdown.by_stage,
          modelResults: costBreakdown.by_model
        }
      }
    };
  }

  /**
   * Save beetree result to database
   */
  private async saveBeetreeResult(
    taskId: string,
    modelKey: string,
    beetreeResult: BeetreeResult,
    response: AIResponse
  ): Promise<void> {
    try {
      const explanationData = {
        puzzleId: taskId,
        modelName: modelKey,
        patternDescription: response.patternDescription,
        solvingStrategy: response.solvingStrategy,
        reasoningLog: response.reasoningLog,
        hints: response.hints || [],
        confidence: response.confidence,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        reasoningTokens: response.reasoningTokens,
        totalTokens: response.totalTokens,
        estimatedCost: response.estimatedCost,
        temperature: response.temperature,
        reasoningEffort: response.reasoningEffort,
        reasoningVerbosity: response.reasoningVerbosity,
        reasoningSummaryType: response.reasoningSummaryType,
        predictedOutputGrid: response.predictedOutputGrid,
        multiplePredictedOutputs: response.multiplePredictedOutputs,
        multiTestResults: response.multiTestResults,
        isPredictionCorrect: response.isPredictionCorrect,
        trustworthinessScore: response.trustworthinessScore,
        hasMultiplePredictions: response.hasMultiplePredictions,
        multiTestPredictionGrids: response.multiTestPredictionGrids,
        multiTestAllCorrect: response.multiTestAllCorrect,
        multiTestAverageAccuracy: response.multiTestAverageAccuracy,
        systemPromptUsed: response.systemPromptUsed,
        userPromptUsed: response.userPromptUsed,
        promptTemplateId: response.promptTemplateId,
        customPromptText: response.customPromptText,
        providerResponseId: response.providerResponseId,
        providerRawResponse: response.providerRawResponse
      };

      await this.explanationRepository.saveExplanation(explanationData);
      logger.service(this.provider, `Saved beetree result for ${taskId} to database`);
    } catch (error) {
      logger.logError('Failed to save beetree result', { error, context: this.provider });
      // Don't throw - the analysis was successful even if DB save failed
    }
  }

  /**
   * Estimate cost for a beetree run
   */
  async estimateCost(taskId: string, mode: 'testing' | 'production'): Promise<{
    estimatedCost: number;
    estimatedDuration: number;
    modelCount: number;
    description: string;
  }> {
    if (mode === 'testing') {
      return {
        estimatedCost: 1.5, // $0.50-$2.00 range
        estimatedDuration: 4 * 60, // 2-6 minutes
        modelCount: 3,
        description: 'Testing mode: 3 models, 5-10 minutes, $0.50-$2.00 estimated'
      };
    } else {
      return {
        estimatedCost: 32.5, // $15-$50 range
        estimatedDuration: 32 * 60, // 20-45 minutes
        modelCount: 8,
        description: 'Production mode: 8 models, 20-45 minutes, $15-$50 estimated'
      };
    }
  }
}

const beetreeService = new BeetreeService();

export { beetreeService };
