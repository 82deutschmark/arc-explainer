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

  /**
   * Execute Grover-generated programs in Python sandbox
   * @param programs - Array of Python code strings
   * @param trainingInputs - Training input grids
   * @returns Execution results with scores
   */
  async runGroverExecution(
    programs: string[],
    trainingInputs: number[][][]
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
          return reject(new Error(`Grover executor failed: ${stderrData}`));
        }

        try {
          const lines = stdoutData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);

          if (result.type === 'execution_results') {
            resolve({ results: result.results });
          } else if (result.type === 'error') {
            reject(new Error(result.message));
          } else {
            reject(new Error(`Unexpected response: ${lastLine}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Grover executor output: ${err}`));
        }
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
}

export const pythonBridge = new PythonBridge();
