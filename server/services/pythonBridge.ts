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
 *   Python wrapper will validate provider and enforce base64 PNG image delivery.
 */

import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'node:readline';

export type SaturnBridgeOptions = {
  taskPath: string;
  options: {
    /** Provider to use; Python wrapper enforces supported providers (OpenAI only). */
    provider?: string;
    model: string;
    temperature?: number;
    cellSize?: number;
    maxSteps?: number;
    captureReasoning?: boolean;
  };
};

export type SaturnBridgeEvent =
  | { type: 'start'; metadata?: any }
  | {
      type: 'progress';
      phase: string;
      step: number;
      totalSteps: number;
      message?: string;
      images?: { path: string; base64?: string }[];
    }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | {
      type: 'final';
      success: boolean;
      prediction?: number[][] | null;
      result: any;
      timingMs: number;
      images?: { path: string; base64?: string }[];
    }
  | { type: 'error'; message: string };

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
        try {
          const evt = JSON.parse(trimmed) as any;
          pushEvent(evt);
          // Attach verbose log on final. Prefer Python-provided result.verboseLog if present,
          // otherwise fall back to our buffered stdout/stderr.
          if (evt.type === 'final') {
            const verboseFromPy: string | undefined = evt?.result?.verboseLog;
            // Always include any buffered logs (stderr and non-JSON stdout),
            // even when Python provided a captured stdout log, to avoid losing stderr.
            const buffered = logBuffer.join('\n');
            const saturnLog = [verboseFromPy || '', buffered].filter(Boolean).join('\n');
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
          // Forward as log so caller can surface or ignore
          logBuffer.push(trimmed);
          onEvent({ type: 'log', level: 'info', message: trimmed });
        }
      });

      // Forward stderr as logs
      const rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on('line', (line) => {
        logBuffer.push(`[stderr] ${line}`);
        onEvent({ type: 'log', level: 'error', message: line });
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
}

export const pythonBridge = new PythonBridge();
