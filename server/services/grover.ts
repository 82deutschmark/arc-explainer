/**
 * Author: Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Grover iterative ARC solver - orchestrates LLM code generation via existing
 * Responses API services (grok.ts/openai.ts) with Python execution sandbox for validation.
 * Uses quantum-inspired amplitude amplification through iterative grading and context saturation.
 * SRP/DRY check: Pass - Extends BaseAIService, delegates LLM to providers, execution to Python
 * shadcn/ui: Pass - Backend service, no UI components
 */

import { ARCTask } from "../../shared/types.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import type { PromptOptions } from "./promptBuilder.js";
import { aiServiceFactory } from "./aiServiceFactory.js";
import { pythonBridge } from "./pythonBridge.js";
import { logger, type LogLevel } from "../utils/logger.js";
import { broadcast } from "./wsService.js";
import { getApiModelName, getModelConfig } from "../config/models/index.js";

export class GroverService extends BaseAIService {
  protected provider = "Grover";
  // RESPONSES API compatible models ONLY (for iterative solving)
  protected models: Record<string, string> = {
    "grover-grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "grover-gpt-5-nano": "gpt-5-nano-2025-08-07",
    "grover-gpt-5-mini": "gpt-5-mini-2025-08-07"
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId: string = "grover", // NOTE: Ignored - Grover builds custom iteration-specific prompts
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const maxIterations = serviceOpts.maxSteps || 5;
    const underlyingModel = this.models[modelKey];
    const sessionId = serviceOpts.sessionId;

    // Validate model key FIRST (before log wrapper exists)
    if (!this.models[modelKey]) {
      const error = `Invalid Grover model key: ${modelKey}. Available: ${Object.keys(this.models).join(', ')}`;
      logger.service(this.provider, `❌ ${error}`, 'error');
      throw new Error(error);
    }

    // Get underlying service (grok, openai, etc.)
    const underlyingService = aiServiceFactory.getService(underlyingModel);

    const iterations: any[] = [];
    let previousResponseId: string | undefined = undefined;
    let bestProgram: string | null = null;
    let bestScore = 0;

    // Build initial context
    let context = this.buildInitialContext(task);

    // LOG WRAPPER: Broadcasts ALL logs to browser WebSocket
    const log = (message: string, level: LogLevel = 'info') => {
      // Always log to terminal
      logger.service(this.provider, message, level);
      // ALSO broadcast to browser if session exists
      if (sessionId) {
        try {
          broadcast(sessionId, {
            status: 'running',
            phase: 'log',
            message,
            level,
            timestamp: new Date().toISOString()
          });
        } catch {}
      }
    };

    const sendProgress = (payload: Record<string, any>) => {
      if (!sessionId) return;
      try {
        broadcast(sessionId, {
          status: payload.status ?? 'running',
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
        // Use console.error to avoid recursion
        console.error(`[Grover] Failed to broadcast: ${err}`);
      }
    };

    log(`🚀 Starting Grover analysis - Puzzle: ${taskId}, Model: ${underlyingModel}, Iterations: ${maxIterations}`);
    
    sendProgress({
      phase: 'initializing',
      iteration: 0,
      message: `🔄 Initializing Grover solver with ${underlyingModel} for ${maxIterations} iterations`
    });

    try {
      for (let i = 0; i < maxIterations; i++) {
        log(`🔁 Iteration ${i + 1}/${maxIterations}`);
        sendProgress({
          phase: 'iteration_start',
          iteration: i + 1,
          message: `🔁 Starting iteration ${i + 1}/${maxIterations} - Generating candidate programs...`
        });

      // 1. Generate programs via underlying service (Responses API!)
      const codeGenPrompt = this.buildCodeGenPrompt(context, i);
      
      // IMMEDIATE FEEDBACK: Show prompt before LLM call
      sendProgress({
        phase: 'prompt_ready',
        iteration: i + 1,
        message: `📤 Sending prompt to ${underlyingModel} (${codeGenPrompt.length} chars)...`
      });
      sendProgress({
        phase: 'prompt_content',
        iteration: i + 1,
        message: `\n--- PROMPT START ---\n${codeGenPrompt.substring(0, 800)}${codeGenPrompt.length > 800 ? '\n... [truncated ' + (codeGenPrompt.length - 800) + ' chars]' : ''}\n--- PROMPT END ---\n`
      });
      sendProgress({
        phase: 'waiting_llm',
        iteration: i + 1,
        message: `⏳ Waiting for ${underlyingModel} response...`
      });

      const llmResponse: AIResponse = await underlyingService.analyzePuzzleWithModel(
        task,
        underlyingModel,
        taskId,
        temperature,
        promptId,
        codeGenPrompt,
        options,
        {
          ...serviceOpts,
          previousResponseId // Conversation chaining across iterations!
        }
      );

      // Store response ID for next iteration
      previousResponseId = llmResponse.providerResponseId || undefined;

      sendProgress({
        phase: 'code_generation',
        iteration: i + 1,
        message: `✅ Code generation complete - Extracting programs...`
      });

      // 2. Extract programs from LLM response
      const programs = this.extractPrograms(llmResponse);

      if (programs.length === 0) {
        const warning = `⚠️ Iteration ${i + 1}: No programs extracted from LLM response. Trying next iteration...`;
        log(warning, 'warn');
        sendProgress({
          phase: 'extraction_failed',
          iteration: i + 1,
          message: warning,
          details: 'The LLM response did not contain properly formatted Python code blocks.'
        });
        continue;
      }

      log(`📝 Found ${programs.length} program(s) to execute`);
      sendProgress({
        phase: 'programs_extracted',
        iteration: i + 1,
        message: `📝 Extracted ${programs.length} program(s) - Executing on training data...`
      });

      // 3. Execute programs in Python sandbox
      let executionResults;
      try {
        executionResults = await this.executeProgramsSandbox(programs, task.train);
        sendProgress({
          phase: 'execution',
          iteration: i + 1,
          message: `🐍 Executed ${programs.length} program(s) on ${task.train.length} training examples`
        });
      } catch (execError) {
        const errorMsg = execError instanceof Error ? execError.message : String(execError);
        log(`❌ Python execution failed: ${errorMsg}`, 'error');
        sendProgress({
          phase: 'execution_error',
          iteration: i + 1,
          message: `❌ Execution failed: ${errorMsg}`,
          details: 'Python sandbox rejected the code or encountered a runtime error.'
        });
        throw new Error(`Python execution failed in iteration ${i + 1}: ${errorMsg}`);
      }

      // 4. Grade results
      const graded = this.gradeExecutions(executionResults, task.train);

      // 5. Track best program
      const iterationBest = graded[0]; // Already sorted by score
      const previousBest = bestScore;
      if (iterationBest && iterationBest.score > bestScore) {
        bestScore = iterationBest.score;
        bestProgram = iterationBest.code;
        log(`🎯 New best score: ${bestScore.toFixed(1)}/10 (improved from ${previousBest.toFixed(1)})`);
      } else if (iterationBest) {
        log(`📊 Iteration best: ${iterationBest.score.toFixed(1)}/10 (current best: ${bestScore.toFixed(1)})`);
      }

      // 6. Track iteration
      iterations.push({
        iteration: i,
        programs,
        executionResults: graded,
        best: iterationBest || { programIdx: -1, score: 0, code: "" },
        timestamp: Date.now()
      });

      const currentBest = iterationBest?.score ?? 0;
      const emoji = currentBest >= 10 ? '🎉' : currentBest >= 7 ? '🎯' : currentBest >= 5 ? '📈' : '📊';
      sendProgress({
        phase: 'iteration_complete',
        iteration: i + 1,
        message: `${emoji} Iteration ${i + 1} complete - Best: ${currentBest.toFixed(1)}/10 | Overall best: ${bestScore.toFixed(1)}/10`,
        iterationBest: currentBest,
        overallBest: bestScore
      });

      // 7. Build amplified context for next iteration
      context = this.amplifyContext(graded, context, i);

        // Early stopping if perfect score
        if (bestScore >= 10) {
          log(`🎉 Perfect score achieved at iteration ${i + 1}!`);
          sendProgress({
            phase: 'complete',
            iteration: i + 1,
            message: `🎉 Perfect score achieved! Stopping early at iteration ${i + 1}/${maxIterations}`,
            finalScore: bestScore
          });
          break;
        }
      }

      // Final summary
      log(`✅ Grover analysis complete - Best score: ${bestScore.toFixed(1)}/10 after ${iterations.length} iterations`);
      sendProgress({
        phase: 'finalizing',
        message: `✅ Analysis complete - Best score: ${bestScore.toFixed(1)}/10`,
        finalScore: bestScore,
        totalIterations: iterations.length
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`❌ Analysis failed: ${errorMsg}`, 'error');
      sendProgress({
        phase: 'error',
        message: `❌ Analysis failed: ${errorMsg}`,
        error: errorMsg
      });
      throw error;
    }

    // Build final response
    return this.buildGroverResponse(
      modelKey,
      temperature,
      iterations,
      bestProgram,
      task.test[0]?.input || [],
      serviceOpts
    );
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

  protected async callProviderAPI(): Promise<any> {
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

  private async executeProgramsSandbox(programs: string[], trainingData: any[]): Promise<any[]> {
    const trainingInputs = trainingData.map(ex => ex.input);
    const result = await pythonBridge.runGroverExecution(programs, trainingInputs);
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

  private buildGroverResponse(
    modelKey: string,
    temperature: number,
    iterations: any[],
    bestProgram: string | null,
    testInput: number[][],
    serviceOpts: any
  ): AIResponse {
    // Execute best program on test input
    let predictedOutput = null;
    if (bestProgram) {
      try {
        const namespace: any = {};
        // Note: In production, this would go through Python sandbox too
        // For now, just store the program
      } catch (e) {
        logger.service(this.provider, `Failed to execute best program: ${e}`, 'warn');
      }
    }

    const lastIteration = iterations[iterations.length - 1];
    const finalScore = lastIteration?.best?.score || 0;

    // Build final response with all required fields
    const finalResponse: AIResponse = {
      model: modelKey,
      // Grover-specific fields (stored in database)
      groverIterations: iterations,
      groverBestProgram: bestProgram,
      iterationCount: iterations.length,
      // Standard explanation fields
      patternDescription: `Grover iterative solver completed ${iterations.length} iterations`,
      solvingStrategy: bestProgram || "No successful program found",
      hints: [`Final score: ${finalScore.toFixed(1)}/10`, `Iterations: ${iterations.length}`],
      confidence: Math.round((finalScore / 10) * 100),
      // Prediction fields
      predictedOutput: predictedOutput,
      predictedOutputGrid: predictedOutput,
      // Reasoning fields
      reasoningLog: null,
      hasReasoningLog: true,
      reasoningItems: iterations.map(iter => ({
        title: `Iteration ${iter.iteration + 1}`,
        detail: `Best score: ${iter.best.score.toFixed(1)}/10`,
        step: iter.iteration
      })),
      // Token/cost fields
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      totalTokens: null,
      estimatedCost: null, // TODO: Sum iteration costs
      temperature,
      ...serviceOpts
    };

    return finalResponse;
  }
}

export const groverService = new GroverService();
