/**
 * Author: Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Grover iterative ARC solver - orchestrates LLM code generation via existing
 * Responses API services (grok.ts/openai.ts) with Python execution sandbox for validation.
 * Uses quantum-inspired amplitude amplification through iterative grading and context saturation.
 * SRP/DRY check: Pass - Extends BaseAIService, delegates LLM to providers, execution to Python
 * shadcn/ui: Pass - Backend service, no UI components
 */

import { ARCTask, ARCExample } from "../../shared/types.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import type { PromptOptions } from "./promptBuilder.js";
import { aiServiceFactory } from "./aiServiceFactory.js";
import { pythonBridge } from "./pythonBridge.js";
import { logger, type LogLevel } from "../utils/broadcastLogger.js";
import { broadcast } from "./wsService.js";
import { getApiModelName, getModelConfig } from "../config/models/index.js";
import { validateSolverResponse, validateSolverResponseMulti } from "./responseValidator.js";

export class GroverService extends BaseAIService {
  protected provider = "Grover";
  // RESPONSES API compatible models ONLY (for iterative solving)
  protected models: Record<string, string> = {
    "grover-grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "grover-gpt-5-nano": "gpt-5-nano-2025-08-07",
    "grover-gpt-5-mini": "gpt-5-mini-2025-08-07"
  };

  /**
   * Override streaming method to route to analyzePuzzleWithModel which already handles streaming harness
   */
  async analyzePuzzleWithStreaming(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    // analyzePuzzleWithModel already handles streaming via serviceOpts.stream
    return this.analyzePuzzleWithModel(
      task,
      modelKey,
      taskId,
      temperature,
      promptId || "grover",
      customPrompt,
      options,
      serviceOpts
    );
  }

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId: string = "grover",
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const harness = serviceOpts.stream;
    const controller = this.registerStream(harness);
    const maxIterations = serviceOpts.maxSteps || 5;
    const underlyingModel = this.models[modelKey];
    const sessionId = serviceOpts.sessionId;

    if (!underlyingModel) {
      const error = `Invalid Grover model key: ${modelKey}. Available: ${Object.keys(this.models).join(', ')}`;
      logger.service(this.provider, error, 'error');
      // No stream to finalize, just throw
      throw new Error(error);
    }

    const underlyingService = aiServiceFactory.getService(underlyingModel);

    // Centralized state for the entire run
    const iterations: any[] = [];
    let previousResponseId: string | undefined = undefined;
    let bestProgram: string | null = null;
    let bestScore = 0;
    let context = this.buildInitialContext(task);
    let finalResponse: AIResponse | null = null;
    let status: 'success' | 'error' | 'aborted' = 'error'; // Default to error
    let finalError: Error | null = null;

    // Aggregated token and cost tracking
    const aggregatedTokenUsage: TokenUsage = { input: 0, output: 0 };
    let aggregatedCost = 0;

    const log = (message: string, level: LogLevel = 'info') => {
      logger.service(this.provider, message, level);
    };

    const sendProgress = (payload: Record<string, any>) => {
      if (sessionId) {
        try {
          broadcast(sessionId, {
            status: 'running',
            phase: payload.phase ?? 'iteration',
            iteration: payload.iteration ?? 0,
            totalIterations: maxIterations,
            progress: payload.progress ?? (payload.iteration !== undefined && maxIterations > 0
              ? Math.min(1, payload.iteration / maxIterations)
              : undefined),
            message: payload.message,
            bestScore,
            bestProgram,
            iterations,
            ...payload
          });
        } catch (err) {
          console.error(`[Grover] Failed to broadcast: ${err}`);
        }
      }

      if (harness) {
        this.emitStreamEvent(harness, "stream.status", {
          state: "in_progress",
          phase: payload.phase,
          message: payload.message,
          iteration: payload.iteration,
          totalIterations: maxIterations,
          progress: payload.progress ?? (payload.iteration !== undefined && maxIterations > 0
            ? Math.min(1, payload.iteration / maxIterations)
            : undefined),
        });
        if (payload.message) {
          this.emitStreamChunk(harness, {
            type: "text",
            delta: `${payload.message}\n`,
            metadata: {
              iteration: payload.iteration,
              phase: payload.phase,
            },
          });
        }
      }
    };

    try {
      log(`Starting Grover analysis - Puzzle: ${taskId}, Model: ${underlyingModel}, Iterations: ${maxIterations}`);
      sendProgress({
        phase: 'initializing',
        iteration: 0,
        message: `Initializing Grover solver with ${underlyingModel} for ${maxIterations} iterations`
      });

      for (let i = 0; i < maxIterations; i++) {
        if (controller?.signal.aborted) {
          log('Analysis aborted by user.', 'warn');
          status = 'aborted';
          throw new Error('Grover analysis aborted by user.');
        }

        log(`Iteration ${i + 1}/${maxIterations}`);
        sendProgress({
          phase: 'iteration_start',
          iteration: i + 1,
          message: `Starting iteration ${i + 1}/${maxIterations} - Generating candidate programs...`
        });

        const codeGenPrompt = this.buildCodeGenPrompt(context, i);
        sendProgress({
          phase: 'prompt_ready',
          iteration: i + 1,
          message: `Sending prompt to ${underlyingModel} (${codeGenPrompt.length} chars)...`,
          promptPreview: codeGenPrompt.substring(0, 1500),
          promptLength: codeGenPrompt.length,
          conversationChain: previousResponseId || null
        });

        sendProgress({
          phase: 'waiting_llm',
          iteration: i + 1,
          message: `Waiting for ${underlyingModel} response...`,
          waitingStart: Date.now()
        });

        const underlyingServiceOpts: ServiceOptions = {
          ...serviceOpts,
          stream: undefined, // CRITICAL: Prevent child service from streaming
          previousResponseId,
        };

        const llmResponse: AIResponse = await underlyingService.analyzePuzzleWithModel(
          task,
          underlyingModel,
          taskId,
          temperature,
          promptId,
          codeGenPrompt,
          options,
          underlyingServiceOpts
        );

        // Aggregate tokens and cost
        aggregatedTokenUsage.input += llmResponse.inputTokens || 0;
        aggregatedTokenUsage.output += llmResponse.outputTokens || 0;
        aggregatedCost += llmResponse.estimatedCost || 0;
        previousResponseId = llmResponse.providerResponseId || undefined;

        sendProgress({
          phase: 'response_received',
          iteration: i + 1,
          message: `Response received (${llmResponse.totalTokens || 0} tokens)`,
          responseId: previousResponseId,
          tokenUsage: { input: llmResponse.inputTokens, output: llmResponse.outputTokens }
        });

        const programs = this.extractPrograms(llmResponse);
        if (programs.length === 0) {
          const warning = `Iteration ${i + 1}: No programs extracted from LLM response. Trying next iteration...`;
          log(warning, 'warn');
          sendProgress({ phase: 'extraction_failed', iteration: i + 1, message: warning, details: 'The LLM response did not contain properly formatted Python code blocks.' });
          continue;
        }

        log(`Found ${programs.length} program(s) to execute`);
        sendProgress({
          phase: 'programs_extracted',
          iteration: i + 1,
          message: `Extracted ${programs.length} program(s) - Executing on training data...`,
          programsExtracted: programs.map((p, idx) => ({ index: idx, code: p, lines: p.split('\n').length }))
        });

        // Show the actual generated code to the user
        for (let progIdx = 0; progIdx < programs.length; progIdx++) {
          const code = programs[progIdx];
          sendProgress({
            phase: 'code_display',
            iteration: i + 1,
            message: `\n━━━ Program ${progIdx + 1}/${programs.length} (${code.split('\n').length} lines) ━━━\n${code}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          });
        }

        const executionResults = await this.executeProgramsSandbox(
          programs,
          task.train,
          (logMessage: string) => {
            // Forward Python execution logs to UI in real-time
            sendProgress({
              phase: 'python_execution',
              iteration: i + 1,
              message: logMessage
            });
          }
        );
        sendProgress({ phase: 'execution', iteration: i + 1, message: `Executed ${programs.length} program(s) on ${task.train.length} training examples` });

        const graded = this.gradeExecutions(executionResults, task.train);

        // Show execution results for each program
        sendProgress({ phase: 'execution_results', iteration: i + 1, message: `\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃  EXECUTION RESULTS - Iteration ${i + 1}  ┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛` });

        for (let resultIdx = 0; resultIdx < graded.length; resultIdx++) {
          const result = graded[resultIdx];
          const status = result.error ? '❌ FAILED' : '✅ SUCCESS';
          const scoreDisplay = result.error ? `Error: ${result.error}` : `Score: ${result.score.toFixed(1)}/10`;
          sendProgress({
            phase: 'program_result',
            iteration: i + 1,
            message: `  Program ${result.programIdx + 1}: ${status} - ${scoreDisplay}`
          });
        }

        const iterationBest = graded[0];
        if (iterationBest && iterationBest.score > bestScore) {
          bestScore = iterationBest.score;
          bestProgram = iterationBest.code;
          log(`New best score: ${bestScore.toFixed(1)}/10`);
          sendProgress({
            phase: 'new_best',
            iteration: i + 1,
            message: `\n🏆 NEW BEST PROGRAM! Score: ${bestScore.toFixed(1)}/10\n━━━ Best Code ━━━\n${bestProgram}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          });
        } else if (iterationBest) {
          log(`Iteration best: ${iterationBest.score.toFixed(1)}/10 (current best: ${bestScore.toFixed(1)})`);
          sendProgress({
            phase: 'iteration_best',
            iteration: i + 1,
            message: `\n📊 Iteration ${i + 1} best: ${iterationBest.score.toFixed(1)}/10 (Overall best remains: ${bestScore.toFixed(1)}/10)\n`
          });
        }

        iterations.push({ iteration: i, programs, executionResults: graded, best: iterationBest || { programIdx: -1, score: 0, code: "" }, timestamp: Date.now() });

        const currentBest = iterationBest?.score ?? 0;
        sendProgress({
          phase: 'iteration_complete',
          iteration: i + 1,
          message: `Iteration ${i + 1} complete. Iteration best: ${currentBest.toFixed(1)}/10. Overall best: ${bestScore.toFixed(1)}/10`,
          iterationBest: currentBest,
          overallBest: bestScore,
          iterations,
        });

        context = this.amplifyContext(graded, context, i);

        if (bestScore >= 10) {
          log(`Perfect score achieved at iteration ${i + 1}!`);
          sendProgress({ phase: 'complete', iteration: i + 1, message: `Perfect score achieved! Stopping early at iteration ${i + 1}/${maxIterations}`, finalScore: bestScore });
          break;
        }
      }

      log(`Grover analysis complete - Best score: ${bestScore.toFixed(1)}/10 after ${iterations.length} iterations`);
      sendProgress({ phase: 'finalizing', message: `Analysis complete - Best score: ${bestScore.toFixed(1)}/10`, finalScore: bestScore, totalIterations: iterations.length });

      // Build final response with test predictions
      finalResponse = await this.buildGroverResponse(
        modelKey,
        temperature,
        iterations,
        bestProgram,
        task.test,
        {
          ...serviceOpts,
          inputTokens: aggregatedTokenUsage.input,
          outputTokens: aggregatedTokenUsage.output,
          totalTokens: aggregatedTokenUsage.input + aggregatedTokenUsage.output,
          estimatedCost: aggregatedCost,
        }
      );

      // Validate predictions against test outputs
      const confidence = finalResponse.confidence || 50;
      if (task.test.length === 1) {
        const validation = validateSolverResponse(finalResponse, task.test[0].output, 'solver', confidence);
        Object.assign(finalResponse, validation, { hasMultiplePredictions: false });
        log(`Validation: ${validation.isPredictionCorrect ? 'CORRECT' : 'INCORRECT'} (score: ${validation.trustworthinessScore.toFixed(2)})`);
      } else {
        const multiValidation = validateSolverResponseMulti(finalResponse, task.test.map(t => t.output), 'solver', confidence);
        Object.assign(finalResponse, multiValidation);
        const correctCount = multiValidation.multiTestResults?.filter((r: any) => r.isCorrect).length || 0;
        log(`Validation: ${correctCount}/${task.test.length} correct (avg accuracy: ${multiValidation.multiTestAverageAccuracy.toFixed(2)})`);
      }

      status = 'success';
      return finalResponse;

    } catch (error) {
      finalError = error instanceof Error ? error : new Error(String(error));
      if (status !== 'aborted') status = 'error';
      log(`Analysis failed: ${finalError.message}`, 'error');
      sendProgress({ phase: 'error', message: `Analysis failed: ${finalError.message}`, error: finalError.message });
      // Re-throw to be caught by the caller, but finalizeStream will still run
      throw finalError;
    } finally {
      // This block runs ALWAYS, ensuring the stream is closed.
      this.finalizeStream(harness, {
        status,
        metadata: {
          bestScore,
          iterations,
          bestProgram,
          tokenUsage: aggregatedTokenUsage,
          estimatedCost: aggregatedCost,
        },
        responseSummary: {
          analysis: finalResponse,
        },
        error: finalError?.message
      });
    }

  }

  getModelInfo(modelKey: string): ModelInfo {
    const underlyingModel = this.models[modelKey];
    const underlyingService = aiServiceFactory.getService(underlyingModel);
    const underlyingInfo = underlyingService.getModelInfo(underlyingModel);

    return {
      ...underlyingInfo,
      name: `Grover (${underlyingInfo.name})`,
      isReasoning: true
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId: string = "grover", // NOTE: Ignored - Grover builds custom iteration-specific prompts
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): PromptPreview {
    const context = this.buildInitialContext(task);
    const codeGenPrompt = this.buildCodeGenPrompt(context, 0);

    return {
      provider: this.provider,
      modelName: this.models[modelKey],
      promptText: codeGenPrompt,
      messageFormat: {},
      templateInfo: {
        id: "grover-code-gen",
        name: "Grover Code Generation",
        usesEmojis: false
      },
      promptStats: {
        characterCount: codeGenPrompt.length,
        wordCount: codeGenPrompt.split(/\s+/).length,
        lineCount: codeGenPrompt.split('\n').length
      },
      providerSpecificNotes: "Grover uses iterative code generation with execution feedback"
    };
  }

  protected async callProviderAPI(
    _prompt: any,
    _modelKey: string,
    _temperature: number,
    _serviceOpts: any,
    _testCount: number,
    _taskId?: string
  ): Promise<any> {
    throw new Error("Grover uses underlying services - this should not be called directly");
  }

  protected parseProviderResponse(): any {
    throw new Error("Grover uses underlying services - this should not be called directly");
  }

  // ========== Grover-Specific Implementation ==========

  private buildInitialContext(task: ARCTask): string {
    const examples = task.train.map((ex, i) => `
Example ${i + 1}:
Input: ${JSON.stringify(ex.input)}
Output: ${JSON.stringify(ex.output)}
`).join('\n');

    return `You are solving an ARC-AGI puzzle. Generate Python code that transforms input grids to output grids.

Training Examples:
${examples}

Your code must define: def transform(grid: List[List[int]]) -> List[List[int]]

Think step-by-step about the transformation rules and generate diverse program candidates.`;
  }

  private buildCodeGenPrompt(context: string, iteration: number): string {
    return `${context}

Iteration ${iteration + 1}: Generate 3-5 Python programs that solve this puzzle.

Each program should:
1. Define transform(grid) function
2. Use only standard Python (no imports)
3. Return the transformed grid

Format your response with code blocks:
\`\`\`python
def transform(grid):
    # Your code here
    return result
\`\`\``;
  }

  private extractPrograms(response: AIResponse): string[] {
    const programs: string[] = [];
    
    // CRITICAL: When JSON parsing fails, OpenAI stores raw text in _rawResponse
    const rawText = (response as any)._rawResponse || response.rawResponse || '';
    
    // Build a combined text from all possible response fields
    const textSources = [
      rawText,  // Try raw response first (markdown code)
      response.solvingStrategy,
      response.patternDescription,
      JSON.stringify(response)
    ].filter(Boolean).join('\n\n');
    
    if (!textSources) {
      logger.service(this.provider, '⚠️ No text content in LLM response for program extraction', 'warn');
      return programs;
    }
    
    logger.service(this.provider, `📖 Parsing ${textSources.length} characters of response text...`);
    
    // Extract all Python code blocks (with or without language tag)
    // Handle both ```python and ``` formats
    const patterns = [
      /```python\s+([\s\S]*?)```/g,  // ```python with whitespace
      /```\s+(def transform[\s\S]*?)```/g,  // ``` with whitespace before def
      /```(def transform[\s\S]*?)```/g,  // ``` with def immediately
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(textSources)) !== null) {
        const code = match[1].trim();
        if (code.includes('def transform') && !programs.includes(code)) {
          programs.push(code);
          logger.service(this.provider, `✅ Found program #${programs.length} (${code.length} chars, ${code.split('\n').length} lines)`);
        }
      }
    }
    
    logger.service(this.provider, `📊 Extraction complete: ${programs.length} program(s) found`);
    
    if (programs.length === 0) {
      logger.service(this.provider, '⚠️ No Python code blocks with "def transform" found in response', 'warn');
      logger.service(this.provider, `📄 Response preview (first 500 chars):\n${textSources.substring(0, 500)}`, 'warn');
      
      // Check if code exists but lacks transform function
      const hasCodeBlocks = /```[\s\S]*?```/.test(textSources);
      if (hasCodeBlocks) {
        logger.service(this.provider, '⚠️ Code blocks found but missing "def transform(grid)" function', 'warn');
      }
    }
    
    return programs;
  }

  private async executeProgramsSandbox(programs: string[], trainingData: any[], onLog?: (message: string) => void): Promise<any[]> {
    const trainingInputs = trainingData.map(ex => ex.input);
    const result = await pythonBridge.runGroverExecution(programs, trainingInputs, onLog);
    return result.results || [];
  }

  private gradeExecutions(executionResults: any[], trainingData: any[]): any[] {
    return executionResults
      .map(result => {
        if (result.error) {
          return { ...result, score: 0 };
        }

        // Calculate match score (0-10)
        let totalScore = 0;
        for (let i = 0; i < trainingData.length; i++) {
          const expected = trainingData[i].output;
          const actual = result.outputs[i];

          if (this.gridsMatch(expected, actual)) {
            totalScore += 10;
          }
        }

        const avgScore = totalScore / trainingData.length;
        return { ...result, score: avgScore };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending
  }

  private gridsMatch(grid1: number[][], grid2: number[][]): boolean {
    if (!grid1 || !grid2) return false;
    if (grid1.length !== grid2.length) return false;

    for (let i = 0; i < grid1.length; i++) {
      if (grid1[i].length !== grid2[i].length) return false;
      for (let j = 0; j < grid1[i].length; j++) {
        if (grid1[i][j] !== grid2[i][j]) return false;
      }
    }

    return true;
  }

  private amplifyContext(gradedResults: any[], oldContext: string, iteration: number): string {
    if (gradedResults.length === 0) return oldContext;

    const best = gradedResults.slice(0, Math.min(3, gradedResults.length));
    const worst = gradedResults.slice(-2);

    return `${oldContext}

## Iteration ${iteration + 1} Results:

### Best Performers:
${best.map((r, i) => `
**Program ${i + 1} (score: ${r.score.toFixed(1)}/10):**
\`\`\`python
${r.code}
\`\`\`
`).join('\n')}

### Failed Approaches (avoid these):
${worst.map((r) => `
Error: ${r.error || "Incorrect output"}
`).join('\n')}

Generate new programs that build on successful patterns and avoid failures.`;
  }

  private async buildGroverResponse(
    modelKey: string,
    temperature: number,
    iterations: any[],
    bestProgram: string | null,
    testExamples: ARCExample[],
    serviceOpts: any
  ): Promise<AIResponse> {
    const lastIteration = iterations[iterations.length - 1];
    const finalScore = lastIteration?.best?.score || 0;

    let predictedOutput = null;
    let multiplePredictedOutputs: (number[][] | null)[] | null = null;
    let hasMultiplePredictions = false;

    if (bestProgram && testExamples.length > 0) {
      try {
        const testInputs = testExamples.map(ex => ex.input);
        logger.service(this.provider, `Executing best program on ${testExamples.length} test input(s)...`);
        const executionResult = await pythonBridge.runGroverTestExecution(
          bestProgram,
          testInputs,
          (logMessage: string) => {
            // Forward test execution logs (no sendProgress here since we're in buildGroverResponse)
            logger.service(this.provider, logMessage);
          }
        );

        if (executionResult.error) {
          logger.service(this.provider, `Test execution error: ${executionResult.error}`, 'warn');
        } else if (executionResult.outputs && executionResult.outputs.length > 0) {
          if (testInputs.length === 1) {
            predictedOutput = executionResult.outputs[0];
            logger.service(this.provider, `Generated prediction for single test`);
          } else {
            hasMultiplePredictions = true;
            multiplePredictedOutputs = executionResult.outputs;
            (executionResult.outputs as (number[][] | null)[]).forEach((output, idx) => {
              (serviceOpts as any)[`predictedOutput${idx + 1}`] = output;
            });
            logger.service(this.provider, `Generated ${multiplePredictedOutputs.length} predictions for multi-test puzzle`);
          }
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        logger.service(this.provider, `Failed to execute best program on test inputs: ${errorMsg}`, 'warn');
      }
    }

    const finalResponse: AIResponse = {
      model: modelKey,
      groverIterations: iterations,
      groverBestProgram: bestProgram,
      iterationCount: iterations.length,
      patternDescription: `Grover iterative solver completed ${iterations.length} iterations`,
      solvingStrategy: bestProgram || "No successful program found",
      hints: [`Final score: ${finalScore.toFixed(1)}/10`, `Iterations: ${iterations.length}`],
      confidence: Math.round((finalScore / 10) * 100),
      predictedOutput: predictedOutput,
      predictedOutputGrid: predictedOutput,
      hasMultiplePredictions,
      multiplePredictedOutputs,
      reasoningLog: null,
      hasReasoningLog: true,
      reasoningItems: iterations.map(iter => ({
        title: `Iteration ${iter.iteration + 1}`,
        detail: `Best score: ${iter.best.score.toFixed(1)}/10`,
        step: iter.iteration
      })),
      temperature,
      ...serviceOpts,
    };

    return finalResponse;
  }
}

export const groverService = new GroverService();
