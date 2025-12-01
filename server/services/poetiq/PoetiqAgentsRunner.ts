/*
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-30
 * PURPOSE: OpenAI Agents SDK runner for Poetiq solver (OpenAI-only path).
 *          Uses an Agent as the reasoning brain and a Python tool-runner
 *          (poetiq_tool_runner.py) as the sandbox evaluator for candidate
 *          transform() implementations.
 *
 * SRP and DRY check: Pass — agent orchestration only. Delegates sandbox
 *                    execution to Python, reuses existing Poetiq result
 *                    shapes and WebSocket telemetry pipeline via
 *                    PoetiqBridgeEvent.
 */

import path from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';

import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

import type { ARCTask } from '@shared/types';
import {
  poetiqService,
  type PoetiqBridgeEvent,
  type PoetiqOptions,
  type PoetiqResult,
  type PoetiqIterationData,
} from './poetiqService.ts';
import type { PoetiqAgentTimelineItem, PoetiqPromptData } from '../../../shared/types.js';

interface PoetiqToolRunnerResult {
  success: boolean;
  puzzleId: string;
  iteration: number;
  timeout_s: number;
  trainResults: any[];
  testResults: any[];
  trainScore: number;
  feedback: string;
  error?: string;
  traceback?: string;
}

interface ToolOutputWithMeta {
  output: PoetiqToolRunnerResult;
  itemIndex: number;
}

interface PoetiqAgentsRunnerInput {
  puzzleId: string;
  task: ARCTask;
  options: PoetiqOptions;
  onEvent?: (event: PoetiqBridgeEvent) => void;
}

interface PoetiqAgentsRunner {
  supportsModel?: (modelId?: string) => boolean;
  run(input: PoetiqAgentsRunnerInput): Promise<PoetiqResult>;
}

class PoetiqAgentsSdkRunner implements PoetiqAgentsRunner {
  supportsModel(modelId?: string): boolean {
    if (!modelId) return false;
    const lower = modelId.toLowerCase();
    const directModels = [
      'gpt-5.1-codex',
      'gpt-5.1-codex-mini',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-5-',
      'o3-mini',
      'o4-mini',
      'o3-2025',
      'gpt-4.1',
    ];
    return directModels.some((dm) => lower.includes(dm));
  }

  private extractToolOutputs(runItems: any[]): ToolOutputWithMeta[] {
    const outputs: ToolOutputWithMeta[] = [];

    for (const [index, item] of runItems.entries()) {
      if (!item || item.type !== 'tool_call_output_item') continue;

      const raw = item.rawItem ?? {};
      const name = (raw.name ?? raw.type ?? '').toString();
      if (!name.includes('submit_python_candidate')) continue;

      const output = (item.output ?? raw.output) as PoetiqToolRunnerResult | undefined;
      if (!output || typeof output !== 'object') continue;

      outputs.push({ output, itemIndex: index });
    }

    return outputs;
  }

  async run(input: PoetiqAgentsRunnerInput): Promise<PoetiqResult> {
    const { puzzleId, task, options, onEvent } = input;
    const startTime = Date.now();

    const modelId = options.model || 'gpt-5.1-codex-mini';
    const reasoningEffort = options.reasoningEffort || 'high';
    const maxTurns = options.maxIterations ?? 8;
    const agentName = `Poetiq Agents Solver (${modelId})`;

    const problemText = this.formatProblem(task);
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(puzzleId, problemText);

    const promptData: PoetiqPromptData = {
      systemPrompt,
      userPrompt,
      model: modelId,
      temperature: options.temperature ?? 1.0,
      provider: 'openai',
      apiStyle: 'openai_agents',
      reasoningParams: {
        effort: reasoningEffort,
        verbosity: 'high',
        summary: 'detailed',
      },
      iteration: 0,
      expert: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    onEvent?.({
      type: 'start',
      metadata: {
        puzzleId,
        trainCount: task.train.length,
        testCount: task.test.length,
        options,
        runtimeMode: 'openai-agents',
        agentModel: modelId,
      },
    } as PoetiqBridgeEvent);

    onEvent?.({
      type: 'progress',
      phase: 'prompt_prepared',
      iteration: 0,
      message: 'Prepared Poetiq Agents prompt and sandbox tool.',
      promptData,
      agentModel: modelId,
    } as PoetiqBridgeEvent);

    let callCounter = 0;
    const toolRunnerPath = path.join(process.cwd(), 'server', 'python', 'poetiq_tool_runner.py');

    // GPT-5.1 Codex variants only support text.verbosity = 'medium'
    const lowerModelId = modelId.toLowerCase();
    const textVerbosity: 'low' | 'medium' | 'high' =
      lowerModelId.includes('gpt-5.1-codex') ? 'medium' : 'high';

    const submitPythonCandidate = tool({
      name: 'submit_python_candidate',
      description:
        'Evaluate a candidate Python transform() implementation in the Poetiq ARC-AGI sandbox on all training and test examples. Use this to check correctness and receive detailed feedback.',
      parameters: z.object({
        code: z
          .string()
          .min(10, 'Code must contain a complete transform() implementation.'),
        iteration: z
          .number()
          .int()
          .min(1)
          .optional()
          .nullable()
          .describe('1-based iteration counter for bookkeeping.'),
        timeout_s: z
          .number()
          .min(0.2)
          .max(10)
          .optional()
          .nullable()
          .describe('Sandbox timeout in seconds (default ~1.5).'),
      }),
      execute: async ({ code, iteration, timeout_s }) => {
        callCounter += 1;
        const effectiveIteration =
          typeof iteration === 'number' && Number.isFinite(iteration) && iteration > 0
            ? iteration
            : callCounter;

        const payload = {
          mode: 'eval_candidate',
          puzzleId,
          task,
          code,
          iteration: effectiveIteration,
          timeout_s: timeout_s ?? 1.5,
        };

        const result = await this.runPoetiqToolRunner(toolRunnerPath, payload);
        return result;
      },
    });

    const agent = new Agent({
      name: agentName,
      instructions: systemPrompt,
      model: modelId,
      modelSettings: {
        reasoning: {
          effort: reasoningEffort as 'minimal' | 'low' | 'medium' | 'high',
          summary: 'detailed',
        },
        text: { verbosity: textVerbosity },
        store: true,
      },
      tools: [submitPythonCandidate],
    });

    const result = await run(agent, userPrompt, {
      maxTurns,
      previousResponseId: (options as any).previousResponseId ?? undefined,
    });

    const elapsedMs = Date.now() - startTime;
    const providerResponseId = (result as any).lastResponseId ?? null;
    const usage = (result as any).state?._context?.usage;

    const toolOutputs = this.extractToolOutputs(result.newItems ?? []);
    const poetiqResult = this.buildPoetiqResultFromToolOutputs(
      puzzleId,
      task,
      toolOutputs,
      elapsedMs,
      modelId,
    );

    const timelineItems = this.buildTimelineFromRunItems(
      result.newItems ?? [],
      providerResponseId ?? undefined,
      modelId,
    );

    for (const item of timelineItems) {
      onEvent?.({
        type: 'progress',
        phase: 'agents',
        iteration: item.iteration ?? 0,
        message: item.label ?? item.message ?? '',
        agentRunId: providerResponseId ?? undefined,
        agentModel: modelId,
        agentTimelineItem: item,
      } as PoetiqBridgeEvent);
    }

    if (usage && typeof usage === 'object') {
      onEvent?.({
        type: 'progress',
        phase: 'agents_usage',
        iteration: poetiqResult.iterationCount ?? toolOutputs.length,
        message: 'OpenAI Agents SDK usage summary.',
        agentRunId: providerResponseId ?? undefined,
        agentModel: modelId,
        tokenUsage: {
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens,
        },
      } as PoetiqBridgeEvent);
    }

    onEvent?.({
      type: 'final',
      success: poetiqResult.success,
      result: poetiqResult,
    } as PoetiqBridgeEvent);

    return poetiqResult;
  }

  private resolvePythonBin(): string {
    if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private async runPoetiqToolRunner(
    scriptPath: string,
    payload: Record<string, unknown>,
  ): Promise<PoetiqToolRunnerResult> {
    return new Promise<PoetiqToolRunnerResult>((resolve, reject) => {
      const pythonBin = this.resolvePythonBin();

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(scriptPath),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(pythonBin, [scriptPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Poetiq tool runner streams not available'));
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      child.on('close', (code) => {
        const trimmed = stdout.trim();
        if (code !== 0) {
          // Try to parse a structured error payload first
          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                return reject(new Error(String((parsed as any).error)));
              }
            } catch {
              // fall through to generic error
            }
          }

          const detail = stderr.trim() || trimmed || `exit code ${code}`;
          return reject(new Error(`poetiq_tool_runner failed: ${detail}`));
        }

        if (!trimmed) {
          return reject(new Error('poetiq_tool_runner produced no output'));
        }

        try {
          const parsed = JSON.parse(trimmed) as PoetiqToolRunnerResult;
          resolve(parsed);
        } catch (err) {
          reject(
            new Error(
              `Failed to parse poetiq_tool_runner output: ${err instanceof Error ? err.message : String(
                err,
              )}. Output: ${trimmed.substring(0, 200)}`,
            ),
          );
        }
      });

      child.stdin.setDefaultEncoding('utf8');
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }

  private buildPoetiqResultFromToolOutputs(
    puzzleId: string,
    task: ARCTask,
    outputs: ToolOutputWithMeta[],
    elapsedMs: number,
    modelId: string,
  ): PoetiqResult {
    if (!outputs.length) {
      return {
        success: false,
        puzzleId,
        iterationCount: 0,
        iterations: [],
        generatedCode: undefined,
        bestTrainScore: 0,
        elapsedMs,
        config: {
          model: modelId,
          maxIterations: 0,
          temperature: undefined,
          numExperts: 1,
          provider: 'openai',
        },
        error: 'Agent completed without calling submit_python_candidate tool.',
      };
    }

    const iterations: PoetiqIterationData[] = [];
    let best = outputs[0];

    outputs.forEach((entry, index) => {
      const { output } = entry;
      const trainResults = Array.isArray(output.trainResults) ? output.trainResults : [];
      const trainScore = typeof output.trainScore === 'number' ? output.trainScore : 0;

      if (trainScore > (best.output.trainScore ?? 0)) {
        best = entry;
      }

      const simplifiedTrainResults = trainResults.map((r: any) => ({
        success: !!r.success,
        softScore: typeof r.soft_score === 'number' ? r.soft_score : 0,
        error: r.error ? String(r.error) : undefined,
      }));

      const codeSample =
        trainResults.find((r: any) => typeof r.code === 'string' && r.code.trim().length > 0)?.code ||
        (output as any).code ||
        undefined;

      iterations.push({
        index,
        iteration: typeof output.iteration === 'number' ? output.iteration : index + 1,
        trainScore,
        trainResults: simplifiedTrainResults,
        code: codeSample,
      });
    });

    const bestResult = best.output;
    const bestTrainResults = Array.isArray(bestResult.trainResults)
      ? bestResult.trainResults
      : [];
    const bestCode =
      bestTrainResults.find((r: any) => typeof r.code === 'string' && r.code.trim().length > 0)?.code ||
      (bestResult as any).code ||
      undefined;

    const predictions = this.buildPredictionsFromBestOutput(bestResult, task);

    return {
      success: true,
      puzzleId,
      predictions,
      iterationCount: iterations.length,
      iterations,
      generatedCode: bestCode,
      bestTrainScore: typeof bestResult.trainScore === 'number' ? bestResult.trainScore : 0,
      elapsedMs,
      config: {
        model: modelId,
        maxIterations: iterations.length,
        temperature: undefined,
        numExperts: 1,
        provider: 'openai',
      },
    };
  }

  private buildPredictionsFromBestOutput(best: PoetiqToolRunnerResult, task: ARCTask): number[][][] {
    const testResults = Array.isArray(best.testResults) ? best.testResults : [];
    const preds: (number[][] | null)[] = [];

    for (const tr of testResults) {
      const raw = typeof tr.output === 'string' ? tr.output : '';
      if (!raw.trim()) {
        preds.push(null);
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        if (this.isGrid(parsed)) {
          preds.push(parsed);
        } else {
          preds.push(null);
        }
      } catch {
        preds.push(null);
      }
    }

    // Fallback: if we have no testResults, but task.test has outputs, leave predictions empty
    // and let downstream validators handle it.
    const concrete = preds.filter((g): g is number[][] => Array.isArray(g));
    return concrete.length > 0 ? (preds as (number[][] | null)[]).filter(Boolean) as number[][][] : [];
  }

  private buildTimelineFromRunItems(
    runItems: any[],
    runId: string | undefined,
    modelId: string,
  ): PoetiqAgentTimelineItem[] {
    const timeline: PoetiqAgentTimelineItem[] = [];

    const nowIso = () => new Date().toISOString();

    for (const [index, item] of runItems.entries()) {
      switch (item.type) {
        case 'message_output_item': {
          timeline.push({
            id: `msg-${index}`,
            type: 'output',
            runId,
            label: `${item.agent?.name ?? 'agent'} → user`,
            message: typeof item.content === 'string' ? item.content : String(item.content),
            payload: { model: modelId },
            timestamp: nowIso(),
          });
          break;
        }
        case 'tool_call_item': {
          const raw = item.rawItem;
          const toolName = 'name' in raw ? raw.name : raw.type;
          const args = 'arguments' in raw ? raw.arguments : undefined;

          let parsedArgs: unknown = args;
          if (typeof args === 'string') {
            try {
              parsedArgs = JSON.parse(args);
            } catch {
              parsedArgs = args;
            }
          }

          timeline.push({
            id: `tool-call-${index}`,
            type: 'tool_call',
            runId,
            toolName,
            status: 'started',
            label: `${item.agent?.name ?? 'agent'} called ${toolName}`,
            payload: { arguments: parsedArgs },
            timestamp: nowIso(),
          });
          break;
        }
        case 'tool_call_output_item': {
          const raw = item.rawItem;
          const toolName = 'type' in raw ? raw.type : 'tool';
          const output = item.output ?? raw.output ?? raw;

          timeline.push({
            id: `tool-result-${index}`,
            type: 'tool_result',
            runId,
            toolName,
            status: 'completed',
            label: `${item.agent?.name ?? 'agent'} received ${toolName}`,
            payload: { output },
            timestamp: nowIso(),
          });
          break;
        }
        case 'reasoning_item': {
          timeline.push({
            id: `reasoning-${index}`,
            type: 'reasoning',
            runId,
            label: `${item.agent?.name ?? 'agent'} reasoning`,
            message: JSON.stringify(item.rawItem ?? item, null, 2),
            timestamp: nowIso(),
          });
          break;
        }
        default: {
          timeline.push({
            id: `status-${index}`,
            type: 'status',
            runId,
            label: 'Agent run item',
            message: item.type ?? 'unknown',
            payload: item,
            timestamp: nowIso(),
          });
        }
      }
    }

    return timeline;
  }

  private formatProblem(task: ARCTask): string {
    const lines: string[] = [];

    task.train.forEach((example, idx) => {
      lines.push(`Example #${idx + 1}`);
      lines.push('Input:');
      lines.push('<Diagram>');
      lines.push(this.gridToDiagram(example.input));
      lines.push('</Diagram>');
      lines.push('');
      lines.push('Output:');
      lines.push('<Diagram>');
      lines.push(this.gridToDiagram(example.output));
      lines.push('</Diagram>');
      lines.push('');
    });

    task.test.forEach((example, idx) => {
      lines.push(`Challenge #${idx + 1}`);
      lines.push('Input:');
      lines.push('<Diagram>');
      lines.push(this.gridToDiagram(example.input));
      lines.push('</Diagram>');
      lines.push('');
    });

    return lines.join('\n');
  }

  private gridToDiagram(grid: number[][]): string {
    return grid.map((row) => row.map((cell) => String(cell)).join(' ')).join('\n');
  }

  private buildSystemPrompt(): string {
    return [
      'You are the Poetiq ARC-AGI code-generation solver, running inside an OpenAI Agent.',
      'You solve ARC puzzles by writing Python code that implements a function:',
      '',
      '    def transform(input_grid: list[list[int]]) -> list[list[int]]:',
      '',
      'The function must transform the input grid into the correct output grid.',
      '',
      'You will be given a set of training examples (input/output pairs) and test inputs.',
      'Your job is to propose candidate implementations of transform(), then call the',
      '`submit_python_candidate` tool to execute your code in the official Poetiq sandbox.',
      '',
      'Important rules:',
      '- Always define a top-level `transform(input_grid)` function.',
      '- Do NOT read or write files, use network, or import external packages.',
      '- You may use standard Python and simple helper functions inside the file.',
      '- After each tool call, carefully read the feedback and adjust your code.',
      '- Repeat until you are confident your transform() matches all training outputs.',
      '',
      'When you are satisfied, clearly explain the final transformation logic in natural',
      'language and rely on the last tool invocation as your final code candidate.',
    ].join('\n');
  }

  private buildUserPrompt(puzzleId: string, problemText: string): string {
    return [
      `You are solving ARC puzzle ${puzzleId}.`,
      '',
      'The task is defined by the following training and test grids:',
      '',
      problemText,
      '',
      'Strategy:',
      '- First, reason about the pattern and describe it in your own words.',
      '- Then write a Python transform() implementation and call submit_python_candidate',
      '  to test it on all training and test examples.',
      '- Use the feedback to refine your code and call the tool again as needed.',
      '- Stop once you have a robust transform() that passes all training examples.',
    ].join('\n');
  }

  private isGrid(value: any): value is number[][] {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (row) => Array.isArray(row) && row.every((cell) => typeof cell === 'number' || typeof cell === 'string'),
      )
    );
  }
}

// Instantiate and register the runner with PoetiqService as a side-effect so that
// OpenAI Agents routing is available as soon as the server starts and this module
// is imported.
const poetiqAgentsRunnerInstance = new PoetiqAgentsSdkRunner();
(poetiqService as any).registerAgentsRunner?.(poetiqAgentsRunnerInstance as any);

export { PoetiqAgentsSdkRunner };
