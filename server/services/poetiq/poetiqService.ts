/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
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
 */

import { spawn, SpawnOptions } from 'child_process';
import * as readline from 'node:readline';
import * as path from 'path';
import { ARCTask } from '../../../shared/types.js';
import { broadcast } from '../wsService.js';

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
      trainResults?: any[];
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
  apiKey?: string;          // User's API key (Gemini or OpenRouter)
  provider?: 'gemini' | 'openrouter';  // Which provider the key is for (default: gemini)
  
  // Model configuration
  model?: string;           // LiteLLM model identifier (e.g., "gemini/gemini-3-pro-preview")
  numExperts?: number;      // Number of parallel experts: 1, 2, 4, or 8 (default: 2)
  maxIterations?: number;   // Max iterations per expert (default: 10)
  temperature?: number;     // LLM temperature (default: 1.0)
  
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
  multiplePredictedOutputs: number[][][] | null;
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
      if (options.apiKey) {
        const provider = options.provider || 'gemini';
        if (provider === 'openrouter') {
          childEnv.OPENROUTER_API_KEY = options.apiKey;
        } else {
          // Default to Gemini direct
          childEnv.GEMINI_API_KEY = options.apiKey;
        }
      }

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

      // Process stdout as NDJSON
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        logBuffer.push(trimmed);

        try {
          const event = JSON.parse(trimmed) as PoetiqBridgeEvent;
          
          // Forward to callback if provided
          onEvent?.(event);

          // Broadcast progress to WebSocket if session provided
          if (options.sessionId && event.type === 'progress') {
            broadcast(options.sessionId, {
              status: 'running',
              phase: event.phase,
              iteration: event.iteration,
              message: event.message,
              expert: event.expert,
              code: event.code,
              reasoning: event.reasoning,
              trainResults: event.trainResults,
            });
          }

          // Capture final result
          if (event.type === 'final') {
            finalResult = event.result;
          }

          // Log errors
          if (event.type === 'error') {
            console.error(`[Poetiq] Error: ${event.message}`);
            if (event.traceback) {
              console.error(`[Poetiq] Traceback:\n${event.traceback}`);
            }
          }

        } catch {
          // Non-JSON output - log it
          console.log(`[Poetiq] ${trimmed}`);
        }
      });

      // Forward stderr
      const rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on('line', (line) => {
        logBuffer.push(`[stderr] ${line}`);
        console.error(`[Poetiq stderr] ${line}`);
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

  /**
   * Transform Poetiq result to standard explanation format for database storage
   */
  transformToExplanationData(result: PoetiqResult): PoetiqExplanationData {
    const predictions = result.predictions || [];
    const hasMultiple = predictions.length > 1;
    
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

    // NOTE: Poetiq does NOT return a confidence value.
    // We set confidence to null to avoid misleading data.
    // The bestTrainScore is training accuracy, NOT prediction confidence.
    const confidence = null;

    // Trustworthiness based on actual test accuracy if available
    const trustworthiness = result.accuracy !== undefined ? result.accuracy * 100 : null;

    return {
      puzzleId: result.puzzleId,
      // Extract clean model name: "gemini/gemini-3-pro-preview" -> "poetiq-gemini-3-pro-preview"
      modelName: `poetiq-${(result.config?.model || 'gemini-3-pro').split('/').pop()?.replace(/\//g, '-') || 'unknown'}`,
      patternDescription,
      solvingStrategy,
      hints,
      confidence,
      predictedOutputGrid: predictions.length > 0 ? predictions[0] : null,
      isPredictionCorrect: result.isPredictionCorrect || false,
      trustworthinessScore: trustworthiness,
      hasMultiplePredictions: hasMultiple,
      multiplePredictedOutputs: hasMultiple ? predictions : null,
      multiTestResults: hasMultiple ? result.kagglePreds : null,
      multiTestAllCorrect: hasMultiple ? result.isPredictionCorrect || false : null,
      multiTestAverageAccuracy: hasMultiple ? (result.accuracy || 0) * 100 : null,
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
      },
    };
  }
}

// Export singleton instance
export const poetiqService = new PoetiqService();
