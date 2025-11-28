/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-27 - Fixed synchronous state seeding and buffer accumulation for visibility parity with Saturn
 * PURPOSE: React hook for Poetiq solver progress tracking via WebSocket.
 *          Manages solver state, progress updates, and result handling.
 *          Uses same WebSocket connection pattern as Saturn and Grover solvers.
 *          Supports fallback to server API key when user key is missing/invalid.
 *          Now seeds UI state synchronously BEFORE network calls (Saturn pattern).
 * 
 * SRP/DRY check: Pass - Single responsibility for Poetiq progress orchestration.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface PoetiqOptions {
  // BYO (Bring Your Own) API key - optional, falls back to server env vars
  apiKey?: string;
  provider?: 'gemini' | 'openrouter';
  
  // Model configuration
  model?: string;
  numExperts?: number;      // 1, 2, 4, or 8 (default: 2)
  maxIterations?: number;   // default: 10
  temperature?: number;     // default: 1.0
  reasoningEffort?: 'low' | 'medium' | 'high'; // Optional reasoning effort
}

// Prompt data from the Python wrapper - shows what's being sent to the AI
export interface PromptData {
  systemPrompt?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  provider?: string;        // "OpenAI", "OpenRouter", "Google Gemini", etc.
  apiStyle?: string;        // "Responses API" or "ChatCompletions API"
  reasoningParams?: {
    effort?: string;        // "low", "medium", "high", or "default"
    verbosity?: string;     // "high" or "default"
    summary?: string;       // "detailed", "auto", or "default"
  } | null;
}

export interface PoetiqProgressState {
  status: 'idle' | 'running' | 'completed' | 'error';
  phase?: string;
  iteration?: number;
  totalIterations?: number;
  message?: string;
  expert?: number;  // Current expert ID
  
  // Result fields
  result?: {
    success: boolean;
    isPredictionCorrect: boolean;
    accuracy?: number;
    iterationCount?: number;
    bestTrainScore?: number;
    generatedCode?: string;
    elapsedMs?: number;
    trainResults?: any[];
  };
  
  // Config
  config?: {
    model: string;
    maxIterations: number;
    numExperts: number;
    temperature: number;
  };
  
  // Streaming fields (like Saturn)
  streamingText?: string;
  streamingReasoning?: string;
  streamingCode?: string;
  logLines?: string[];
  reasoningHistory?: string[];  // Accumulated reasoning blocks per iteration
  reasoningSummaryHistory?: string[];  // Responses API reasoning summaries (GPT-5.x)
  pythonLogLines?: string[];    // Python execution output (sandbox/stdout/stderr)
  
  // Fallback indicator
  usingFallback?: boolean;
  
  // Prompt visibility - shows what's being sent to the AI
  currentPromptData?: PromptData;
  promptHistory?: PromptData[];  // All prompts sent during this run
}

const initialState: PoetiqProgressState = {
  status: 'idle',
  logLines: [],
  reasoningHistory: [],
  reasoningSummaryHistory: [],
  pythonLogLines: [],
  streamingReasoning: '',
  streamingCode: '',
  streamingText: '',
  currentPromptData: undefined,
  promptHistory: [],
};

/**
 * Hook for managing Poetiq solver progress
 */
export function usePoetiqProgress(taskId: string | undefined) {
  const [state, setState] = useState<PoetiqProgressState>(initialState);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Connect to WebSocket for progress updates
  // Uses same URL pattern as Saturn/Grover: /api/poetiq/progress?sessionId=...
  const connectWebSocket = useCallback((sid: string) => {
    // Close any existing connection first
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore cleanup errors
      }
      wsRef.current = null;
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const isDev = import.meta.env.DEV;
    const wsHost = isDev ? 'localhost:5000' : location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/api/poetiq/progress?sessionId=${encodeURIComponent(sid)}`;
    
    console.log('[Poetiq WS] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Poetiq WS] Connected successfully');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Server sends { type: 'progress' | 'log' | 'snapshot', data: {...} }
        const data = payload?.data;
        const eventType = payload?.type;  // 'progress', 'log', 'snapshot'
        
        if (!data) return;
        
        console.log('[Poetiq WS] Received event:', eventType, 'dataType:', data.type, 'phase:', data.phase, 'status:', data.status);
        
        setState(prev => {
          const timestamp = new Date().toLocaleTimeString();
          
          // Accumulate log lines - ALWAYS add if message exists (don't skip duplicates)
          let nextLogLines = prev.logLines ? [...prev.logLines] : [];
          
          // Handle different event types
          if (eventType === 'log' || data.type === 'log') {
            // Log events always get added
            const logMsg = data.message || data.data?.message;
            if (logMsg) {
              const level = data.level || 'info';
              const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
              nextLogLines.push(`[${timestamp}] ${prefix} ${logMsg}`);
            }
          } else if (data.message) {
            // Progress events with messages
            nextLogLines.push(`[${timestamp}] ${data.message}`);
          }
          
          // Cap log lines to prevent memory bloat (Saturn uses 500)
          if (nextLogLines.length > 500) {
            nextLogLines = nextLogLines.slice(-500);
          }
          
          // Accumulate reasoning history per iteration
          let nextReasoningHistory = prev.reasoningHistory ? [...prev.reasoningHistory] : [];
          if (data.reasoning && typeof data.reasoning === 'string') {
            // Add iteration marker if we have iteration info
            const iterMarker = data.iteration ? `[Iteration ${data.iteration}] ` : '';
            const expertMarker = data.expert ? `[Expert ${data.expert}] ` : '';
            nextReasoningHistory.push(`${iterMarker}${expertMarker}${data.reasoning}`);
            // Cap to 100 entries
            if (nextReasoningHistory.length > 100) {
              nextReasoningHistory = nextReasoningHistory.slice(-100);
            }
          }
          
          // Accumulate reasoning SUMMARIES from Responses API (GPT-5.x)
          // These are the human-readable chain-of-thought summaries
          let nextReasoningSummaryHistory = prev.reasoningSummaryHistory ? [...prev.reasoningSummaryHistory] : [];
          if (data.reasoningSummary && typeof data.reasoningSummary === 'string') {
            const iterMarker = data.iteration ? `[Iteration ${data.iteration}] ` : '';
            const expertMarker = data.expert ? `[Expert ${data.expert}] ` : '';
            nextReasoningSummaryHistory.push(`${iterMarker}${expertMarker}${data.reasoningSummary}`);
            // Cap to 50 entries
            if (nextReasoningSummaryHistory.length > 50) {
              nextReasoningSummaryHistory = nextReasoningSummaryHistory.slice(-50);
            }
          }
          
          // Python execution logs (for terminal panel)
          let nextPythonLogLines = prev.pythonLogLines ? [...prev.pythonLogLines] : [];
          if (data.trainResults && Array.isArray(data.trainResults)) {
            // Log train results as Python execution output
            data.trainResults.forEach((r: any, idx: number) => {
              const status = r.success ? '✅' : '❌';
              const err = r.error ? ` (${r.error.substring(0, 50)}...)` : '';
              nextPythonLogLines.push(`Train ${idx + 1}: ${status}${err}`);
            });
          }
          
          // Streaming reasoning - accumulate or replace based on phase
          // During 'reasoning' phase, this is the AI thinking
          // During 'evaluating' phase, we might get code
          let nextStreamingReasoning = prev.streamingReasoning || '';
          if (data.reasoning && data.phase === 'reasoning') {
            // Append new reasoning (may be delta or full block)
            nextStreamingReasoning = data.reasoning;
          }
          
          // Streaming code - replace with latest
          const nextStreamingCode = data.code || prev.streamingCode;
          
          // Prompt data - track current and accumulate history
          let nextCurrentPromptData = prev.currentPromptData;
          let nextPromptHistory = prev.promptHistory ? [...prev.promptHistory] : [];
          if (data.promptData) {
            nextCurrentPromptData = data.promptData as PromptData;
            // Add to history if it's a new prompt (different iteration or expert)
            const isDuplicate = nextPromptHistory.some(p => 
              p.userPrompt === data.promptData.userPrompt && 
              p.model === data.promptData.model
            );
            if (!isDuplicate) {
              nextPromptHistory.push(data.promptData as PromptData);
            }
            // Cap history to 50 entries
            if (nextPromptHistory.length > 50) {
              nextPromptHistory = nextPromptHistory.slice(-50);
            }
          }
          
          // Track latest iteration result details if available
          const currentResult = prev.result || {
            success: false,
            isPredictionCorrect: false
          };
          if (data.trainResults) {
            currentResult.trainResults = data.trainResults;
          }
          
          return {
            ...prev,
            phase: data.phase || prev.phase,
            iteration: data.iteration ?? prev.iteration,
            totalIterations: data.totalIterations ?? prev.totalIterations,
            message: data.message || prev.message,
            expert: data.expert ?? prev.expert,
            status: data.status === 'completed' ? 'completed' 
                  : data.status === 'error' ? 'error' 
                  : 'running',
            result: data.result || currentResult,
            config: data.config || prev.config,
            usingFallback: data.usingFallback ?? prev.usingFallback,
            logLines: nextLogLines,
            reasoningHistory: nextReasoningHistory,
            reasoningSummaryHistory: nextReasoningSummaryHistory,
            pythonLogLines: nextPythonLogLines,
            streamingReasoning: nextStreamingReasoning,
            streamingCode: nextStreamingCode,
            streamingText: data.message || prev.streamingText,
            currentPromptData: nextCurrentPromptData,
            promptHistory: nextPromptHistory,
          };
        });

        if (data.status === 'completed' || data.status === 'error') {
          if (data.status === 'error') {
            console.error('[Poetiq WS] Error received:', data);
          }
          ws.close();
        }
      } catch (err) {
        console.error('[Poetiq WS] Parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[Poetiq WS] Error:', err);
    };

    ws.onclose = (evt) => {
      console.log('[Poetiq WS] Connection closed:', evt.reason || 'No reason provided', 'Code:', evt.code, 'Current state:', state.status);
      wsRef.current = null;
    };
  }, []);

  // Start the solver
  const start = useCallback(async (options: PoetiqOptions = {}) => {
    if (!taskId) return;

    // Defaults: OpenRouter Gemini proxy, 2 experts (Gemini-3-b config)
    const provider = options.provider || 'openrouter';
    const model = options.model || (provider === 'openrouter'
      ? 'openrouter/google/gemini-3-pro-preview'
      : 'gemini/gemini-3-pro-preview');
    const numExperts = options.numExperts || 2;
    const maxIterations = options.maxIterations || 10;
    const temperature = options.temperature || 1.0;

    // IMMEDIATE UI FEEDBACK - Set state synchronously FIRST (Saturn pattern)
    // This ensures UI shows "starting" immediately before any network call
    console.log('[Poetiq] Setting initial state to running...');
    setState({
      status: 'running',
      phase: 'initializing',
      iteration: 0,
      totalIterations: maxIterations,
      message: `Initializing Poetiq solver with ${numExperts} expert(s)...`,
      config: {
        model,
        maxIterations,
        numExperts,
        temperature,
      },
      // Initialize all buffers synchronously so UI has something to display
      logLines: [`🚀 Poetiq Meta-System Solver starting...`, `📋 Task: ${taskId}`, `🤖 Model: ${model}`, `👥 Experts: ${numExperts}`, '---'],
      reasoningHistory: [],
      pythonLogLines: [],
      streamingReasoning: '',
      streamingCode: '',
      streamingText: '',
      usingFallback: !options.apiKey,
    });

    try {
      // Build request payload; only send provider for OpenRouter models.
      const isOpenRouterModel = model.toLowerCase().startsWith('openrouter/');
      const payload: any = {
        apiKey: options.apiKey,
        model,
        numExperts,
        maxIterations,
        temperature,
        reasoningEffort: options.reasoningEffort || 'high',  // Default to high for best results
      };

      if (isOpenRouterModel) {
        payload.provider = provider;
      }

      const res = await apiRequest('POST', `/api/poetiq/solve/${taskId}`, payload);
      const response = await res.json();

      if (response.success && response.data?.sessionId) {
        const sid = response.data.sessionId;
        setSessionId(sid);
        connectWebSocket(sid);
        
        // Also start polling as backup
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await apiRequest('GET', `/api/poetiq/status/${sid}`);
            const status = await statusRes.json();
            if (status.success && status.data?.snapshot) {
              const snap = status.data.snapshot;
              if (snap.status === 'completed' || snap.status === 'error') {
                setState(prev => ({
                  ...prev,
                  status: snap.status,
                  result: snap.result,
                  message: snap.message,
                }));
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
              }
            }
          } catch (err) {
            console.error('[Poetiq] Polling error:', err);
          }
        }, 5000);
      } else {
        setState({
          status: 'error',
          message: response.message || 'Failed to start solver',
        });
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [taskId, connectWebSocket]);

  // Cancel the solver (not implemented yet)
  const cancel = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setState({
      status: 'idle',
      message: 'Cancelled',
    });
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
    setSessionId(null);
  }, []);

  return {
    state,
    sessionId,
    start,
    cancel,
    reset,
  };
}
