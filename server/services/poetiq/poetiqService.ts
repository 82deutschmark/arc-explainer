/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-27 - Migrated to direct SDK calls (NO LiteLLM)
 *                       Added support for all 5 providers: OpenAI, Anthropic, Gemini, OpenRouter, xAI
 *                       BYO API key handling now supports all providers
 * PURPOSE: TypeScript service wrapping the Poetiq ARC-AGI solver.
 *          Executes Python subprocess, captures iteration data, maps results to standard
 *          explanation format for database storage.
 * 
 * SRP and DRY check: Pass - Single responsibility is Poetiq integration.
 *                    Delegates Python execution to pythonBridge pattern.
 *                    Does not duplicate other solver logic.
 * 
 * Architecture Notes:
 * - Poetiq uses iterative code generation (NOT direct prediction)
 * - Each iteration generates Python transform() functions
 * - Code is executed in sandbox to validate against training examples
 * - Multiple "experts" can run in parallel with voting
 * - Results need special handling for database storage
 * - Python solver uses direct SDK calls for: OpenAI (Responses API), Anthropic, Gemini, OpenRouter, xAI
 */

import { spawn, SpawnOptions } from 'child_process';
import * as readline from 'node:readline';
import * as path from 'path';
import { ARCTask, PoetiqPromptData } from '../../../shared/types.js';
import { broadcast } from '../wsService.js';
import {
  validateSolverResponse,
  validateSolverResponseMulti,
  type ValidationResult,
  type MultiValidationResult,
} from '../responseValidator.js';

/**
 * Event types emitted by the Poetiq Python wrapper
 */
export type PoetiqBridgeEvent =
  | { type: 'start'; metadata: PoetiqStartMetadata }
  | { 
      type: 'progress'; 
      phase: string; 
      iteration: number; 
      message: string;
      expert?: number;
      code?: string;
      reasoning?: string;
      reasoningSummary?: string;  // Responses API reasoning summary (GPT-5.x)
      trainResults?: any[];
      promptData?: PoetiqPromptData;  // Added for prompt visibility
      tokenUsage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
      cost?: {
        input?: number;
        output?: number;
        total?: number;
      };
      expertCumulativeTokens?: Record<string, any>;
      expertCumulativeCost?: Record<string, any>;
      globalTokens?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
      globalCost?: {
        input?: number;
        output?: number;
        total?: number;
      };
    }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'final'; success: boolean; result: PoetiqResult }
  | { type: 'error'; message: string; traceback?: string };

export interface PoetiqStartMetadata {
  puzzleId: string;
  trainCount: number;
  testCount: number;
  options: PoetiqOptions;
}

export interface PoetiqOptions {
  // BYO (Bring Your Own) API key - used for this run only, never stored
  apiKey?: string;          // User's API key for the selected provider
  provider?: 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'xai';  // All 5 supported providers
  
  // Model configuration
  model?: string;           // Model identifier (e.g., "gemini-3-pro-preview", "gpt-5.1-codex-mini")
  numExperts?: number;      // Number of parallel experts: 1, 2, 4, or 8 (default: 2)
  maxIterations?: number;   // Max iterations per expert (default: 10)
  temperature?: number;     // LLM temperature (default: 1.0)
  reasoningEffort?: 'low' | 'medium' | 'high';  // Reasoning effort for GPT-5.x models
  
  // Internal
  sessionId?: string;       // WebSocket session for progress updates
}

export interface PoetiqIterationData {
  index: number;
  iteration: number;
  trainScore: number;
  trainResults: Array<{
    success: boolean;
    softScore: number;
    error?: string;
  }>;
  code?: string;
}

export interface PoetiqResult {
  success: boolean;
  puzzleId: string;
  predictions?: number[][][];      // Predicted output grids
  kagglePreds?: any[];              // Kaggle submission format
  isPredictionCorrect?: boolean;
  accuracy?: number;
  iterationCount?: number;
  iterations?: PoetiqIterationData[];
  generatedCode?: string;           // Best transform() function
  bestTrainScore?: number;
  elapsedMs?: number;
  config?: {
    model?: string;
    maxIterations?: number;
    temperature?: number;
    numExperts?: number;
    provider?: 'gemini' | 'openrouter' | 'openai';
  };
  error?: string;
  traceback?: string;
}

/**
 * Standardized result format for database storage
 */
export interface PoetiqExplanationData {
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number | null;  // Poetiq does NOT return confidence - always null
  predictedOutputGrid: number[][] | null;
  isPredictionCorrect: boolean;
  trustworthinessScore: number | null;  // Only set if test accuracy is known
  hasMultiplePredictions: boolean;
  multiplePredictedOutputs: (number[][] | null)[] | null;
  multiTestResults: any | null;
  multiTestAllCorrect: boolean | null;
  multiTestAverageAccuracy: number | null;
  reasoningLog: string;
  apiProcessingTimeMs: number;
  // Poetiq-specific fields stored in providerRawResponse
  providerRawResponse: {
    solver: 'poetiq';
    iterationCount: number;
    iterations: PoetiqIterationData[];
    generatedCode: string | null;
    bestTrainScore: number;
    config: any;
    validation?: {
      single?: ValidationResult | null;
      multi?: MultiValidationResult | null;
    };
    rawPredictions?: (number[][] | null)[];
  };
}

/**
 * PoetiqService - Wrapper for the Poetiq ARC-AGI solver
 */
export class PoetiqService {
  private pythonBin: string;
  private wrapperPath: string;

  constructor() {
    this.pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    this.wrapperPath = path.join(process.cwd(), 'server', 'python', 'poetiq_wrapper.py');
  }

  private getDefaultModelForProvider(provider?: 'gemini' | 'openrouter' | 'openai'): string {
    if (provider === 'gemini') {
      return 'gemini/gemini-3-pro-preview';
    }
    if (provider === 'openai') {
      return 'gpt-5.1-codex-mini';  // Default OpenAI model
    }
    return 'openrouter/google/gemini-3-pro-preview';
  }

  private resolveProvider(options: PoetiqOptions, existing?: PoetiqResult['config']): 'gemini' | 'openrouter' | 'openai' | undefined {
    if (existing?.provider === 'gemini' || existing?.provider === 'openrouter' || existing?.provider === 'openai') {
      return existing.provider as 'gemini' | 'openrouter' | 'openai';
    }
    if (options.provider === 'gemini' || options.provider === 'openrouter' || options.provider === 'openai') {
      return options.provider;
    }
    const candidate = existing?.model || options.model;
    if (candidate?.startsWith('gemini/')) {
      return 'gemini';
    }
    if (candidate?.startsWith('openrouter/')) {
      return 'openrouter';
    }
    // Check for direct OpenAI models
    if (this.isDirectOpenAIModel(candidate)) {
      return 'openai';
    }
    return undefined;
  }

  /**
   * Check if a model should use direct OpenAI Responses API
   */
  private isDirectOpenAIModel(model?: string): boolean {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    
    // Don't use direct API if routed through OpenRouter
    if (modelLower.includes('openrouter')) return false;
    
    // Direct OpenAI models that should use Responses API
    const directModels = [
      'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-',
      'o3-mini', 'o4-mini', 'o3-2025', 'gpt-4.1'
    ];
    
    return directModels.some(dm => modelLower.includes(dm));
  }

  /**
   * Infer provider from model ID
   * Matches the provider detection in solver/poetiq/llm.py get_provider()
   */
  private inferProviderFromModel(model?: string): 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'xai' {
    if (!model) return 'gemini';  // Default
    
    const modelLower = model.toLowerCase();
    
    // OpenRouter first (can proxy any model)
    if (modelLower.includes('openrouter/') || modelLower.includes('openrouter')) return 'openrouter';
    
    // Direct OpenAI (GPT-5.x, o3, o4, gpt-4.1)
    if (this.isDirectOpenAIModel(model)) return 'openai';
    
    // Anthropic (Claude models)
    if (modelLower.includes('claude') || modelLower.includes('anthropic')) return 'anthropic';
    
    // Google Gemini
    if (modelLower.includes('gemini')) return 'gemini';
    
    // xAI (Grok models)
    if (modelLower.includes('grok') || modelLower.includes('xai')) return 'xai';
    
    return 'openrouter';  // Default for unknown models
  }

  private enrichResultWithConfig(result: PoetiqResult, options: PoetiqOptions): PoetiqResult {
    const providerGuess = this.resolveProvider(options, result.config);
    const resolvedModel = result.config?.model || options.model || this.getDefaultModelForProvider(providerGuess);
    const normalizedProvider =
      providerGuess ??
      (resolvedModel.startsWith('gemini/')
        ? 'gemini'
        : resolvedModel.startsWith('openrouter/')
          ? 'openrouter'
          : undefined);

    return {
      ...result,
      config: {
        ...result.config,
        model: resolvedModel,
        maxIterations: result.config?.maxIterations ?? options.maxIterations ?? 10,
        numExperts: result.config?.numExperts ?? options.numExperts ?? 2,
        temperature: result.config?.temperature ?? options.temperature ?? 1.0,
        provider: normalizedProvider,
      },
    };
  }

  /**
   * Run Poetiq solver on a puzzle
   * 
   * Supports BYO (Bring Your Own) API key - the key is passed only to
   * the Python child process environment and is NOT stored anywhere.
   */
  async solvePuzzle(
    puzzleId: string,
    task: ARCTask,
    options: PoetiqOptions = {},
    onEvent?: (event: PoetiqBridgeEvent) => void
  ): Promise<PoetiqResult> {
    return new Promise((resolve, reject) => {
      // Build environment with optional BYO API key
      // Key is passed ONLY to this child process, never stored
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      };

      // Handle BYO API key based on provider
      // All 5 providers are supported: openai, anthropic, gemini, openrouter, xai
      const provider = options.provider || this.inferProviderFromModel(options.model);
      if (options.apiKey) {
        switch (provider) {
          case 'openrouter':
            childEnv.OPENROUTER_API_KEY = options.apiKey;
            break;
          case 'openai':
            childEnv.OPENAI_API_KEY = options.apiKey;
            break;
          case 'anthropic':
            childEnv.ANTHROPIC_API_KEY = options.apiKey;
            break;
          case 'xai':
            childEnv.XAI_API_KEY = options.apiKey;
            break;
          case 'gemini':
          default:
            childEnv.GEMINI_API_KEY = options.apiKey;
            break;
        }
      } else if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
        // Use server OpenRouter key for free/proxy models when BYO not supplied
        childEnv.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      }
      
      // For other providers, the BYO key should already be set above (still no fallback)

      // Debug: Log environment keys (not values) to verify they're present
      const envKeys = Object.keys(childEnv).filter(k => k.includes('API_KEY'));
      console.log('[Poetiq] Environment API keys available:', envKeys.length > 0 ? envKeys : 'NONE');

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(this.wrapperPath),
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(this.pythonBin, [this.wrapperPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        const err = new Error('Python process streams not available');
        onEvent?.({ type: 'error', message: err.message });
        return reject(err);
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let finalResult: PoetiqResult | null = null;
      const logBuffer: string[] = [];

      // Track event trace for debugging (capped like Saturn)
      const eventTrace: any[] = [];
      const pushEvent = (evt: any) => {
        if (eventTrace.length < 500) eventTrace.push(evt);
      };

      // Process stdout as NDJSON
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Always buffer stdout for verbose log
        logBuffer.push(trimmed);

        try {
          const event = JSON.parse(trimmed) as PoetiqBridgeEvent;
          pushEvent(event);
          
          // Forward to callback if provided
          onEvent?.(event);

          // Broadcast ALL event types to WebSocket if session provided (Saturn pattern)
          if (options.sessionId) {
            if (event.type === 'start') {
              broadcast(options.sessionId, {
                type: 'start',
                status: 'running',
                phase: 'starting',
                message: `Poetiq solver starting for ${puzzleId}...`,
                metadata: (event as any).metadata,
              });
            } else if (event.type === 'progress') {
              broadcast(options.sessionId, {
                type: 'progress',
                status: 'running',
                phase: event.phase,
                iteration: event.iteration,
                message: event.message,
                expert: event.expert,
                code: event.code,
                reasoning: event.reasoning,
                reasoningSummary: event.reasoningSummary,  // Responses API reasoning summary
                trainResults: event.trainResults,
                promptData: event.promptData,  // Forward prompt data to frontend
                tokenUsage: (event as any).tokenUsage,
                cost: (event as any).cost,
                expertCumulativeTokens: (event as any).expertCumulativeTokens,
                expertCumulativeCost: (event as any).expertCumulativeCost,
                globalTokens: (event as any).globalTokens,
                globalCost: (event as any).globalCost,
              });
            } else if (event.type === 'log') {
              // Forward log events so UI can display them
              // Include phase: 'log' so frontend state doesn't get corrupted
              broadcast(options.sessionId, {
                type: 'log',
                status: 'running',
                phase: 'log',  // Prevent undefined phase issues
                level: event.level,
                message: event.message,
              });
            } else if (event.type === 'error') {
              broadcast(options.sessionId, {
                type: 'error',
                status: 'error',
                phase: 'error',
                message: event.message,
                traceback: event.traceback,
              });
            }
          }

          // Capture final result with sanitized config metadata
          if (event.type === 'final') {
            finalResult = this.enrichResultWithConfig(event.result, options);
          }

          // Log errors to console
          if (event.type === 'error') {
            console.error(`[Poetiq] Error: ${event.message}`);
            if (event.traceback) {
              console.error(`[Poetiq] Traceback:\n${event.traceback}`);
            }
          }

        } catch {
          // Non-JSON output - still forward as log event
          console.log(`[Poetiq] ${trimmed}`);
          // Broadcast as log so UI can see it
          if (options.sessionId) {
            broadcast(options.sessionId, {
              type: 'log',
              status: 'running',
              phase: 'log',  // Prevent undefined phase issues
              level: 'info',
              message: trimmed,
            });
          }
        }
      });

      // Forward stderr as error logs
      const rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on('line', (line) => {
        logBuffer.push(`[stderr] ${line}`);
        console.error(`[Poetiq stderr] ${line}`);
        // Also broadcast stderr to UI
        if (options.sessionId) {
          broadcast(options.sessionId, {
            type: 'log',
            status: 'running',
            phase: 'log',  // Prevent undefined phase issues
            level: 'error',
            message: `[stderr] ${line}`,
          });
        }
      });

      // Send payload to Python
      const payload = JSON.stringify({
        puzzleId,
        task,
        options,
      });
      child.stdin.write(payload);
      child.stdin.end();

      child.on('close', (code) => {
        if (code !== 0 && !finalResult) {
          const err = new Error(`Poetiq solver exited with code ${code}`);
          onEvent?.({ type: 'error', message: err.message });
          return reject(err);
        }

        if (finalResult) {
          resolve(finalResult);
        } else {
          reject(new Error('No result received from Poetiq solver'));
        }
      });

      child.on('error', (err) => {
        onEvent?.({ type: 'error', message: err.message });
        reject(err);
      });
    });
  }

  private slugifyModelId(modelId?: string | null): string {
    if (!modelId || typeof modelId !== 'string') {
      return 'unknown';
    }

    const cleaned = modelId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\/_.-]/g, '-')
      .replace(/[\/\.]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return cleaned || 'unknown';
  }

  /**
   * Transform Poetiq result to standard explanation format for database storage
   */
  transformToExplanationData(result: PoetiqResult, task?: ARCTask): PoetiqExplanationData {
    const rawPredictions = Array.isArray(result.predictions) ? result.predictions : [];
    const normalizedPredictions: (number[][] | null)[] = rawPredictions.map(pred => this.normalizePredictionGrid(pred));
    const hasMultiple = normalizedPredictions.filter(Boolean).length > 1;
    
    // Build pattern description from generated code
    const patternDescription = result.generatedCode
      ? `Poetiq iterative code-generation solver produced a transform() function after ${result.iterationCount || 0} iterations.`
      : `Poetiq solver completed ${result.iterationCount || 0} iterations but did not produce valid code.`;

    // Build solving strategy from iteration data
    let solvingStrategy = 'Poetiq Iterative Code Generation:\n';
    if (result.iterations && result.iterations.length > 0) {
      for (const iter of result.iterations) {
        const passed = iter.trainResults.filter(r => r.success).length;
        const total = iter.trainResults.length;
        solvingStrategy += `- Iteration ${iter.iteration}: ${passed}/${total} training examples passed (score: ${(iter.trainScore * 100).toFixed(1)}%)\n`;
      }
    }
    if (result.generatedCode) {
      solvingStrategy += `\nFinal transform() function:\n\`\`\`python\n${result.generatedCode}\n\`\`\``;
    }

    // Build hints
    const hints: string[] = [];
    if (result.generatedCode) {
      hints.push('The solver generated executable Python code that transforms input grids.');
    }
    if (result.bestTrainScore && result.bestTrainScore > 0) {
      hints.push(`Best training accuracy: ${(result.bestTrainScore * 100).toFixed(1)}%`);
    }
    if (result.config?.model) {
      hints.push(`Model used: ${result.config.model}`);
    }

    // Explicitly suppress confidence/trustworthiness for Poetiq entries
    const confidence = 0;
    const trustworthiness = null;

    const resolvedModelId = result.config?.model || 'unknown';
    const modelSlug = this.slugifyModelId(resolvedModelId);

    const validatorPayload: any = {
      result: {
        predictedOutput: normalizedPredictions[0] ?? null,
        predictedOutputs: normalizedPredictions,
        hasMultiplePredictions: hasMultiple,
        solvingStrategy,
        patternDescription,
      },
      _rawResponse: result.generatedCode ? `Generated transform():\n${result.generatedCode}` : null,
    };

    const correctAnswers = this.collectGroundTruth(task);
    let singleValidation: ValidationResult | null = null;
    let multiValidation: MultiValidationResult | null = null;

    if (correctAnswers && correctAnswers.length > 1) {
      try {
        multiValidation = validateSolverResponseMulti(
          validatorPayload,
          correctAnswers,
          'solver',
          null
        );
      } catch (err) {
        console.error('[Poetiq] Multi-test validation failed:', err);
      }
    } else if (correctAnswers && correctAnswers.length === 1) {
      try {
        singleValidation = validateSolverResponse(
          validatorPayload,
          correctAnswers[0],
          'solver',
          null
        );
      } catch (err) {
        console.error('[Poetiq] Single-test validation failed:', err);
      }
    }

    const hasValidatedMulti = Boolean(multiValidation && multiValidation.hasMultiplePredictions);
    const predictedOutputGrid =
      singleValidation?.predictedGrid ??
      normalizedPredictions.find(grid => grid !== null) ??
      null;
    const isPredictionCorrect =
      singleValidation?.isPredictionCorrect ?? (result.isPredictionCorrect || false);

    const multiplePredictedOutputs: (number[][] | null)[] | null = hasValidatedMulti
      ? (multiValidation?.multiplePredictedOutputs ?? [])
      : hasMultiple
        ? normalizedPredictions
        : null;
    const multiTestResults = hasValidatedMulti ? multiValidation?.multiTestResults ?? [] : null;
    const multiTestAllCorrect = hasValidatedMulti
      ? multiValidation?.multiTestAllCorrect ?? false
      : hasMultiple
        ? result.isPredictionCorrect || false
        : null;
    const multiTestAverageAccuracy = hasValidatedMulti
      ? multiValidation?.multiTestAverageAccuracy ?? null
      : hasMultiple
        ? (typeof result.accuracy === 'number' ? result.accuracy : null)
        : null;

    return {
      puzzleId: result.puzzleId,
      // Preserve entire routing path so OpenRouter vs direct runs stay distinct
      modelName: `poetiq-${modelSlug}`,
      patternDescription,
      solvingStrategy,
      hints,
      confidence,
      predictedOutputGrid,
      isPredictionCorrect,
      trustworthinessScore: trustworthiness,
      hasMultiplePredictions: hasMultiple || hasValidatedMulti,
      multiplePredictedOutputs,
      multiTestResults,
      multiTestAllCorrect,
      multiTestAverageAccuracy,
      reasoningLog: JSON.stringify({
        iterations: result.iterations,
        config: result.config,
      }, null, 2),
      apiProcessingTimeMs: result.elapsedMs || 0,
      providerRawResponse: {
        solver: 'poetiq',
        iterationCount: result.iterationCount || 0,
        iterations: result.iterations || [],
        generatedCode: result.generatedCode || null,
        bestTrainScore: result.bestTrainScore || 0,
        config: result.config || {},
        validation: {
          single: singleValidation,
          multi: multiValidation,
        },
        rawPredictions: normalizedPredictions,
      },
    };
  }

  private collectGroundTruth(task?: ARCTask): number[][][] | null {
    if (!task?.test || task.test.length === 0) {
      return null;
    }

    const outputs: number[][][] = [];
    for (const example of task.test) {
      if (!example.output || !this.isGrid(example.output)) {
        return null;
      }
      outputs.push(example.output);
    }
    return outputs;
  }

  private normalizePredictionGrid(grid: any): number[][] | null {
    if (!this.isGrid(grid)) {
      return null;
    }
    return grid.map(row => row.map(cell => (typeof cell === 'number' ? cell : Number(cell)))) as number[][];
  }

  private isGrid(value: any): value is number[][] {
    if (!Array.isArray(value)) return false;
    return value.every(
      row => Array.isArray(row) && row.every(cell => typeof cell === 'number' || typeof cell === 'string')
    );
  }
}

// Export singleton instance
export const poetiqService = new PoetiqService();
