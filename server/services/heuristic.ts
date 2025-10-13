/**
 * Author: Max Power
 * Date: 2025-10-12
 * PURPOSE: Heuristic ARC solver service - integrates internal Python heuristic solver
 * with JSON contract interface. Executes Python CLI and parses JSON output for ARC puzzle solving.
 *
 * Integration Pattern:
 * - Calls python solver/heuristic_solver.py --task <path/to/task.json>
 * - Expects JSON response: { "program": "<name>", "predicted_output_grid": [[...]] }
 * - Handles both single and multiple prediction formats
 * - SRP/DRY check: Pass - Single responsibility (internal solver integration)
 */

import { ARCTask } from "../../shared/types.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import type { PromptOptions } from "./promptBuilder.js";
import { logger } from '../utils/logger.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class HeuristicService extends BaseAIService {
  protected provider = "heuristic";
  protected models: Record<string, string> = {
    "heuristic-solver": "heuristic"
  };

  /**
   * Execute internal heuristic ARC solver
   */
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Write task to temporary file for Python CLI
      const tempTaskPath = await this.writeTaskToTempFile(task, taskId);

      // Execute Python solver
      const result = await this.executePythonSolver(tempTaskPath);

      // Clean up temp file
      await fs.unlink(tempTaskPath).catch(() => {}); // Ignore cleanup errors

      // Parse and validate result
      const parsedResult = JSON.parse(result);

      if (parsedResult.error) {
        throw new Error(`Python solver error: ${parsedResult.error}`);
      }

      // Build response in expected format
      const response: AIResponse = {
        model: modelKey,
        taskId,
        confidence: 60, // Lower confidence for heuristic solver
        patternDescription: `Heuristic solver program: ${parsedResult.program}`,
        solvingStrategy: `Applied heuristic transformation: ${parsedResult.program}`,
        hints: [
          "Heuristic solver found transformation pattern",
          `Program: ${parsedResult.program}`,
          "Learned from training examples using primitive operations"
        ],
        temperature,
        apiProcessingTimeMs: Date.now() - startTime,
        reasoningLog: `Heuristic solver executed successfully. Program: ${parsedResult.program}`,
        hasReasoningLog: true,
        providerRawResponse: JSON.stringify(parsedResult)
      };

      // Handle both single and multiple prediction formats
      if (parsedResult.multiple_predicted_outputs) {
        response.multiplePredictedOutputs = parsedResult.multiple_predicted_outputs;
        response.hasMultiplePredictions = true;
        response.predictedOutputGrid = parsedResult.multiple_predicted_outputs[0]; // For backward compatibility
      } else {
        response.predictedOutputGrid = parsedResult.predicted_output_grid;
        response.hasMultiplePredictions = false;
      }

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[heuristic-service] Error analyzing puzzle ${taskId}: ${errorMessage}`);

      throw new Error(`heuristic solver failed: ${errorMessage}`);
    }
  }

  /**
   * Write ARC task to temporary JSON file for Python CLI
   */
  private async writeTaskToTempFile(task: ARCTask, taskId: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const tempPath = path.join(tempDir, `task-${taskId}-${Date.now()}.json`);
    await fs.writeFile(tempPath, JSON.stringify(task, null, 2));

    return tempPath;
  }

  /**
   * Execute Python heuristic solver CLI and capture JSON output
   */
  private async executePythonSolver(taskPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
      const solverPath = path.join(process.cwd(), 'solver', 'heuristic_solver.py');

      const child = spawn(pythonBin, [solverPath, taskPath], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python heuristic solver exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to start Python heuristic solver: ${error.message}`));
      });
    });
  }

  /**
   * Generate prompt preview (not applicable for heuristic solver)
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
      modelName: this.models[modelKey],
      promptText: "Heuristic ARC solver - uses primitive operations and composition",
      messageFormat: {},
      templateInfo: {
        id: "heuristic-solver",
        name: "Heuristic Solver",
        usesEmojis: false
      },
      promptStats: {
        characterCount: 0,
        wordCount: 0,
        lineCount: 0
      },
      providerSpecificNotes: "Internal solver uses primitive operations and composition, no LLM prompts"
    };
  }

  /**
   * Get model information
   */
  getModelInfo(modelKey: string): ModelInfo {
    return {
      name: this.models[modelKey],
      isReasoning: false,
      supportsTemperature: false,
      supportsFunctionCalling: false,
      supportsSystemPrompts: false,
      supportsStructuredOutput: false,
      supportsVision: false
    };
  }

  /**
   * Provider-specific API call - not applicable for heuristic solver
   */
  protected async callProviderAPI(
    _prompt: any,
    _modelKey: string,
    _temperature: number,
    _serviceOpts: ServiceOptions,
    _testCount: number,
    _taskId?: string
  ): Promise<any> {
    throw new Error("Heuristic solver uses direct Python execution - this should not be called");
  }

  /**
   * Parse provider response - not applicable for heuristic solver
   */
  protected parseProviderResponse(
    _response: any,
    _modelKey: string,
    _captureReasoning: boolean,
    _puzzleId?: string
  ): { result: any; tokenUsage: TokenUsage; reasoningLog?: any; reasoningItems?: any[]; status?: string; incomplete?: boolean; incompleteReason?: string } {
    throw new Error("Heuristic solver uses direct Python execution - this should not be called");
  }

  /**
   * Streaming not supported for heuristic solver
   */
  async analyzePuzzleWithStreaming(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: ServiceOptions
  ): Promise<AIResponse> {
    throw new Error("Streaming not supported for heuristic solver");
  }
}

export const heuristicService = new HeuristicService();
