/**
 *
 * Author: Gemini 2.5 Pro using `Gemini 2.5 Pro`
 * Date: 2025-09-24T11:58:30-04:00
 * PURPOSE: Ensure Saturn Python subprocess inherits required OpenAI credentials while preserving UTF-8 configuration and document bridge responsibilities.
 * SRP and DRY check: Pass - Verified existing bridge uniquely manages Python spawning; no duplicated credential forwarding logic elsewhere.
 */
/**
 * server/services/pythonBridge.ts
 *
 * PythonBridge manages spawning the Saturn Python wrapper and streaming
 * NDJSON progress events back to Node for broadcasting and persistence.
 *
 * Protocol:
 * - Node -> Python (stdin): single JSON object { taskPath, options }
 * - Python -> Node (stdout): one JSON object per line (NDJSON). Shapes:
 *   { type: 'start', metadata: {...} }
 *   { type: 'progress', phase, step, totalSteps, message?, images?: [{ path, base64 }] }
 *   { type: 'log', level, message }
 *   { type: 'final', success, prediction?, result, timingMs, images?: [...] }
 *   { type: 'error', message }
 *
 * Author: Cascade (model: Cascade)
 *
 * Change log (Cascade):
 * - 2025-08-15: Buffer non-JSON stdout and all stderr lines into a verbose log.
 *   Attach `saturnLog` to the `final` event. Also collect a capped `eventTrace`
 *   array of NDJSON events to optionally persist as `saturn_events`.
 * - 2025-08-15: Add provider pass-through in `options` (default handled upstream).
 *   Python wrapper logs provider selection and always base64-encodes images.
 */

import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'node:readline';

export type SaturnBridgeOptions = {
  taskPath: string;
  options: {
    /** Provider to use; Python wrapper now passes through providers without blocking. */
    provider?: string;
    model: string;
    temperature?: number;
    cellSize?: number;
    maxSteps?: number;
    captureReasoning?: boolean;
  };
};

export type BeetreeBridgeOptions = {
  taskId: string;
  testIndex: number;
  mode: 'testing' | 'production';
  runTimestamp?: string;
};

export type SaturnBridgeEvent =
  | { type: 'start'; metadata?: any; source?: 'python' }
  | {
      type: 'progress';
      phase: string;
      step: number;
      totalSteps: number;
      message?: string;
      images?: { path: string; base64?: string }[];
      source?: 'python';
    }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string; source?: 'python' }
  | {
      type: 'final';
      success: boolean;
      prediction?: number[][] | null;
      result: any;
      timingMs: number;
      images?: { path: string; base64?: string }[];
      source?: 'python';
    }
  | { type: 'error'; message: string; source?: 'python' }
  // Pass-through for new API logging events from Python runtime
  | {
      type: 'api_call_start';
      ts?: string | number;
      phase?: string;
      provider?: string;
      model?: string;
      endpoint?: string;
      requestId?: string;
      attempt?: number;
      params?: any;
      images?: any[];
      source?: 'python';
    }
  | {
      type: 'api_call_end';
      ts?: string | number;
      requestId?: string;
      status?: 'success' | 'error';
      latencyMs?: number;
      providerResponseId?: string;
      httpStatus?: number;
      reasoningSummary?: string;
      tokenUsage?: any;
      error?: string;
      source?: 'python';
    };

export type BeetreeBridgeEvent =
  | { type: 'start'; metadata?: any; source?: 'python' }
  | {
      type: 'progress';
      status: string;
      stage: string;
      outcome?: string;
      event?: string;
      predictions?: number[][][];
      costSoFar?: number;
      tokensUsed?: { input: number; output: number; reasoning: number };
      timestamp: number;
      source?: 'python';
    }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string; source?: 'python' }
  | {
      type: 'final';
      success: boolean;
      predictions?: number[][][];
      result: {
        taskId: string;
        testIndex: number;
        mode: string;
        runTimestamp: string;
        predictions: number[][][];
        costBreakdown: {
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
          total_tokens: { input: number; output: number; reasoning: number };
        };
        verboseLog: string;
      };
      timingMs: number;
      source?: 'python';
    }
  | { type: 'error'; message: string; source?: 'python' };

export class PythonBridge {
  private resolvePythonBin(): string {
    // Allow override via env
    if (process.env.PYTHON_BIN) {
      return process.env.PYTHON_BIN;
    }
    
    // Auto-detect: Windows uses 'python', Linux containers use 'python3'
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private resolveWrapperPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'saturn_wrapper.py');
  }

  private resolveBeetreeWrapperPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'beetree_wrapper.py');
  }

  async runSaturnAnalysis(
    payload: SaturnBridgeOptions,
    onEvent: (evt: SaturnBridgeEvent) => void
  ): Promise<{ code: number | null }> {
    return new Promise((resolve) => {
      const pythonBin = this.resolvePythonBin();
      const wrapper = this.resolveWrapperPath();

      // Cascade: Force UTF-8 for Python stdio to prevent Windows 'charmap' codec errors
      // When Saturn emits logs/messages with emojis (e.g., 📡), Windows default codepage
      // may not encode them. PYTHONIOENCODING/PYTHONUTF8 ensure UTF-8 I/O.
      const envUtf8 = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      } as NodeJS.ProcessEnv;

      const saturnSensitiveEnv = [
        'OPENAI_API_KEY',
        'OPENAI_BASE_URL',
        'OPENAI_ORG_ID',
      ] as const;

      for (const key of saturnSensitiveEnv) {
        if (process.env[key]) {
          envUtf8[key] = process.env[key];
        }
      }

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(wrapper),
        env: envUtf8,
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(pythonBin, [wrapper], spawnOpts);

      // Ensure stdio streams are available
      if (!child.stdout || !child.stderr || !child.stdin) {
        onEvent({ type: 'error', message: 'Python process streams not available (stdout/stderr/stdin null)' });
        return resolve({ code: -1 });
      }

      // Ensure Node reads UTF-8 from Python
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      // Buffers for verbose log and optional event trace
      const logBuffer: string[] = [];
      const eventTrace: any[] = [];
      const pushEvent = (evt: any) => {
        // Cap the trace to avoid unbounded memory
        if (eventTrace.length < 500) eventTrace.push(evt);
      };

      // Stream stdout as NDJSON
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // [SATURN-DEBUG] Log all stdout lines for debugging
        console.log(`[SATURN-DEBUG] Python stdout: ${trimmed.substring(0, 200)}${trimmed.length > 200 ? '...' : ''}`);
        
        // Always capture ALL stdout in logBuffer first
        logBuffer.push(trimmed);
        
        try {
          const evt = JSON.parse(trimmed) as any;
          // Tag source for downstream consumers
          if (evt && typeof evt === 'object' && !evt.source) {
            evt.source = 'python';
          }
          pushEvent(evt);
          console.log(`[SATURN-DEBUG] Valid JSON event type: ${evt.type}`);
          
          // Attach verbose log on final. Prefer Python-provided result.verboseLog if present,
          // otherwise fall back to our buffered stdout/stderr.
          if (evt.type === 'final') {
            const verboseFromPy: string | undefined = evt?.result?.verboseLog;
            // Always include any buffered logs (stderr and non-JSON stdout),
            // even when Python provided a captured stdout log, to avoid losing stderr.
            const buffered = logBuffer.join('\n');
            const saturnLog = [verboseFromPy || '', buffered].filter(Boolean).join('\n');
            console.log(`[SATURN-DEBUG] Final saturnLog length: ${saturnLog.length} chars`);
            const augmented = {
              ...evt,
              saturnLog,
              eventTrace,
            } as any;
            onEvent(augmented as SaturnBridgeEvent);
          } else {
            onEvent(evt as SaturnBridgeEvent);
          }
        } catch (err) {
          // Non-JSON output (likely AI model responses) - forward as log event
          console.log(`[SATURN-DEBUG] Non-JSON stdout (AI response): ${trimmed.substring(0, 100)}...`);
          onEvent({ type: 'log', level: 'info', message: trimmed, source: 'python' });
        }
      });

      // Forward stderr as logs
      const rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on('line', (line) => {
        logBuffer.push(`[stderr] ${line}`);
        onEvent({ type: 'log', level: 'error', message: line, source: 'python' });
      });

      // Send payload
      child.stdin.setDefaultEncoding('utf8');
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();

      child.on('close', (code) => {
        resolve({ code });
      });

      child.on('error', (err) => {
        onEvent({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        resolve({ code: -1 });
      });
    });
  }

  async runBeetreeAnalysis(
    payload: BeetreeBridgeOptions,
    onEvent: (evt: BeetreeBridgeEvent) => void
  ): Promise<{ code: number | null }> {
    return new Promise((resolve) => {
      const pythonBin = this.resolvePythonBin();
      const wrapper = this.resolveBeetreeWrapperPath();

      // Force UTF-8 for Python stdio to prevent Windows 'charmap' codec errors
      const envUtf8 = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      } as NodeJS.ProcessEnv;

      // Beetree requires all three provider API keys
      const beetreeSensitiveEnv = [
        'OPENAI_API_KEY',
        'OPENAI_BASE_URL',
        'OPENAI_ORG_ID',
        'ANTHROPIC_API_KEY',
        'GOOGLE_AI_API_KEY',
      ] as const;

      for (const key of beetreeSensitiveEnv) {
        if (process.env[key]) {
          envUtf8[key] = process.env[key];
        }
      }

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(wrapper),
        env: envUtf8,
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(pythonBin, [wrapper], spawnOpts);

      // Ensure stdio streams are available
      if (!child.stdout || !child.stderr || !child.stdin) {
        onEvent({ type: 'error', message: 'Python process streams not available (stdout/stderr/stdin null)' });
        return resolve({ code: -1 });
      }

      // Ensure Node reads UTF-8 from Python
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      // Buffers for verbose log
      const logBuffer: string[] = [];

      // Stream stdout as NDJSON
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Always capture ALL stdout in logBuffer first
        logBuffer.push(trimmed);

        try {
          const evt = JSON.parse(trimmed) as any;
          // Tag source for downstream consumers
          if (evt && typeof evt === 'object' && !evt.source) {
            evt.source = 'python';
          }

          // Debug: Log successful event parse
          if (evt.type) {
            logger.debug(`[pythonBridge] Parsed event: type=${evt.type}, timestamp=${evt.timestamp}, sessionId=${opts.sessionId}`);
          }

          // Attach verbose log on final
          if (evt.type === 'final') {
            const verboseFromPy: string | undefined = evt?.result?.verboseLog;
            const buffered = logBuffer.join('\n');
            const beetreeLog = [verboseFromPy || '', buffered].filter(Boolean).join('\n');
            const augmented = {
              ...evt,
              result: {
                ...evt.result,
                verboseLog: beetreeLog
              }
            } as any;
            onEvent(augmented as BeetreeBridgeEvent);
          } else {
            onEvent(evt as BeetreeBridgeEvent);
          }
        } catch (err) {
          // Non-JSON output - forward as log event
          logger.debug(`[pythonBridge] Non-JSON stdout, converting to log event: "${trimmed.substring(0, 80)}..."`);
          onEvent({ type: 'log', level: 'info', message: trimmed, source: 'python' });
        }
      });

      // Forward stderr as logs
      const rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on('line', (line) => {
        logBuffer.push(`[stderr] ${line}`);
        onEvent({ type: 'log', level: 'error', message: line, source: 'python' });
      });

      // Send payload
      child.stdin.setDefaultEncoding('utf8');
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();

      child.on('close', (code) => {
        resolve({ code });
      });

      child.on('error', (err) => {
        onEvent({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        resolve({ code: -1 });
      });
    });
  }

  /**
   * Execute Grover-generated programs in Python sandbox
   * @param programs - Array of Python code strings
   * @param trainingInputs - Training input grids
   * @param onLog - Optional callback to stream Python log messages in real-time
   * @returns Execution results with scores
   */
  async runGroverExecution(
    programs: string[],
    trainingInputs: number[][][],
    onLog?: (message: string) => void
  ): Promise<{ results: any[] }> {
    return new Promise((resolve, reject) => {
      const pythonBin = this.resolvePythonBin();
      const executorPath = path.join(process.cwd(), 'server', 'python', 'grover_executor.py');

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(executorPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(pythonBin, [executorPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available'));
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let finalResults: any = null;
      let stderrData = '';

      // STREAM LIKE SATURN - process line by line
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const evt = JSON.parse(trimmed);

          if (evt.type === 'log' && onLog) {
            // Forward Python log messages to callback
            onLog(evt.message);
          } else if (evt.type === 'execution_results') {
            // Save final results
            finalResults = evt;
          }
        } catch {
          // Non-JSON output - forward as-is
          if (onLog) onLog(trimmed);
        }
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk;
        if (onLog) onLog(`[stderr] ${chunk}`);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          let errorDetail = stderrData.trim();
          try {
            const errorJson = JSON.parse(stderrData);
            if (errorJson.message) {
              errorDetail = errorJson.message;
            }
          } catch {
            // Not JSON, use raw stderr
          }

          return reject(new Error(`Python executor failed (exit code ${code}): ${errorDetail}`));
        }

        if (!finalResults) {
          return reject(new Error('Python executor did not return execution_results'));
        }

        resolve({ results: finalResults.results });
      });

      child.on('error', (err) => {
        reject(err);
      });

      // Send payload
      const payload = JSON.stringify({ programs, training_inputs: trainingInputs });
      child.stdin.write(payload);
      child.stdin.end();
    });
  }

  /**
   * Execute a single Grover program on test inputs to generate predictions
   * @param program - Python code string defining transform() function
   * @param testInputs - Test input grids to generate predictions for
   * @param onLog - Optional callback to stream Python log messages in real-time
   * @returns Array of predicted output grids (or null for errors)
   */
  async runGroverTestExecution(
    program: string,
    testInputs: number[][][],
    onLog?: (message: string) => void
  ): Promise<{ outputs: (number[][] | null)[]; error: string | null }> {
    return new Promise((resolve, reject) => {
      const pythonBin = this.resolvePythonBin();
      const executorPath = path.join(process.cwd(), 'server', 'python', 'grover_executor.py');

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(executorPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(pythonBin, [executorPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available'));
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let finalResult: any = null;
      let stderrData = '';

      // STREAM LIKE SATURN - process line by line
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const evt = JSON.parse(trimmed);

          if (evt.type === 'log' && onLog) {
            // Forward Python log messages to callback
            onLog(evt.message);
          } else if (evt.type === 'test_execution_result') {
            // Save final result
            finalResult = evt;
          }
        } catch {
          // Non-JSON output - forward as-is
          if (onLog) onLog(trimmed);
        }
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk;
        if (onLog) onLog(`[stderr] ${chunk}`);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          let errorDetail = stderrData.trim();
          try {
            const errorJson = JSON.parse(stderrData);
            if (errorJson.message) {
              errorDetail = errorJson.message;
            }
          } catch {
            // Not JSON, use raw stderr
          }

          return reject(new Error(`Python test executor failed (exit code ${code}): ${errorDetail}`));
        }

        if (!finalResult) {
          return reject(new Error('Python test executor did not return test_execution_result'));
        }

        resolve({ outputs: finalResult.outputs, error: finalResult.error });
      });

      child.on('error', (err) => {
        reject(err);
      });

      // Send test execution payload (different structure than training)
      const payload = JSON.stringify({
        mode: 'test',
        program,
        test_inputs: testInputs
      });
      child.stdin.write(payload);
      child.stdin.end();
    });
  }

  /**
   * Generate grid visualizations via Python subprocess
   * @param grids - Array of 2D grids to visualize
   * @param taskId - Task identifier for file naming
   * @param cellSize - Size of each cell in pixels (default: 30)
   * @param label - Optional descriptive label to prefix generated filenames
   * @returns Object with imagePaths and base64Images arrays
   */
  async runGridVisualization(
    grids: number[][][],
    taskId: string,
    cellSize: number = 30,
    label?: string
  ): Promise<{ imagePaths: string[]; base64Images: string[] }> {
    return new Promise((resolve, reject) => {
      const pythonBin = this.resolvePythonBin();
      const visualizerPath = path.join(process.cwd(), 'server', 'python', 'grid_visualizer.py');

      const spawnOpts: SpawnOptions = {
        cwd: path.dirname(visualizerPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(pythonBin, [visualizerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available for grid visualization'));
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk;
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk;
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Grid visualization failed (exit code ${code}): ${stderrData}`));
        }

        try {
          const trimmed = stdoutData.trim();
          if (!trimmed) {
            return reject(new Error('No output from grid visualizer'));
          }

          const result = JSON.parse(trimmed);

          if (result.type === 'visualization_complete') {
            resolve({
              imagePaths: result.imagePaths || [],
              base64Images: result.base64Images || []
            });
          } else if (result.type === 'error') {
            reject(new Error(`Visualization error: ${result.message}`));
          } else {
            reject(new Error(`Unexpected response type: ${result.type}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse visualizer output: ${err}. Output: ${stdoutData.substring(0, 200)}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn grid visualizer: ${err.message}`));
      });

      // Send payload
      const payload = JSON.stringify({ grids, taskId, cellSize, label });
      child.stdin.write(payload);
      child.stdin.end();
    });
  }
}

export const pythonBridge = new PythonBridge();
