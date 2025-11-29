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
import type { PoetiqPromptData } from '@shared/types';

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

export interface PoetiqTokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface PoetiqCostBreakdown {
  input: number;
  output: number;
  total: number;
}

export interface PromptTimelineEntry {
  prompt: PoetiqPromptData;
  iteration?: number;
  expert?: number;
  timestamp: string;
}

export interface PhaseHistoryEntry {
  phase: string;
  iteration?: number;
  expert?: number;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  message?: string;
}

export type PoetiqExpertStatus =
  | 'idle'
  | 'initializing'
  | 'prompting'
  | 'evaluating'
  | 'feedback'
  | 'completed'
  | 'error';

export interface PoetiqExpertState {
  expertId: number;
  iteration: number;
  status: PoetiqExpertStatus;
  lastUpdated: string;
  lastMessage?: string;
  passCount?: number;
  failCount?: number;
  trainAccuracy?: number;
  tokens?: PoetiqTokenUsage | null;
  cost?: PoetiqCostBreakdown | null;
}

export interface IterationHistoryEntry {
  iteration: number;
  expert?: number;
  accuracy?: number;
  passCount?: number;
  failCount?: number;
  message?: string;
  timestamp: string;
}

export interface PoetiqRawEvent {
  type: string;
  phase?: string;
  payload: unknown;
  timestamp: string;
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
    tokenUsage?: PoetiqTokenUsage;
    cost?: PoetiqCostBreakdown;
    expertBreakdown?: Record<string, { tokens: PoetiqTokenUsage; cost: PoetiqCostBreakdown }>;
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
  phaseStartedAt?: string;
  phaseHistory?: PhaseHistoryEntry[];
  iterationHistory?: IterationHistoryEntry[];
  expertStates?: Record<string, PoetiqExpertState>;
  
  // Fallback indicator
  usingFallback?: boolean;
  
  // Prompt visibility - shows what's being sent to the AI
  currentPromptData?: PoetiqPromptData;
  promptHistory?: PoetiqPromptData[];  // All prompts sent during this run
  promptTimeline?: PromptTimelineEntry[];

  // Token/cost visibility
  tokenUsage?: PoetiqTokenUsage | null;
  cost?: PoetiqCostBreakdown | null;
  expertTokenUsage?: Record<string, PoetiqTokenUsage>;
  expertCost?: Record<string, PoetiqCostBreakdown>;

  // Raw event stream (for debugging)
  rawEvents?: PoetiqRawEvent[];
}

const initialState: PoetiqProgressState = {
  status: 'idle',
  logLines: [],
  reasoningHistory: [],
  reasoningSummaryHistory: [],
  pythonLogLines: [],
  phaseStartedAt: undefined,
  phaseHistory: [],
  iterationHistory: [],
  expertStates: {},
  streamingReasoning: '',
  streamingCode: '',
  streamingText: '',
  currentPromptData: undefined,
  promptHistory: [],
  promptTimeline: [],
  tokenUsage: null,
  cost: null,
  expertTokenUsage: {},
  expertCost: {},
  rawEvents: [],
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
          const now = new Date();
          const timestamp = now.toLocaleTimeString();
          const isoTimestamp = now.toISOString();
          const eventLabel = eventType || data.type || 'unknown';
          const trainResultsArray = Array.isArray(data.trainResults) ? data.trainResults : null;
          
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

          // Phase timing + history tracking
          const incomingPhase = typeof data.phase === 'string' ? data.phase : undefined;
          const isPhaseEvent = incomingPhase && incomingPhase !== 'log';
          let nextPhaseHistory = prev.phaseHistory ? [...prev.phaseHistory] : [];
          let nextPhaseStartedAt = prev.phaseStartedAt;

          if (isPhaseEvent && incomingPhase !== prev.phase) {
            // Close previous phase entry
            if (prev.phase && prev.phase !== 'log' && prev.phaseStartedAt && nextPhaseHistory.length > 0) {
              const lastIdx = nextPhaseHistory.length - 1;
              const prevStartMs = new Date(prev.phaseStartedAt).getTime();
              nextPhaseHistory[lastIdx] = {
                ...nextPhaseHistory[lastIdx],
                endedAt: isoTimestamp,
                durationMs: Math.max(0, now.getTime() - prevStartMs),
              };
            }

            nextPhaseStartedAt = isoTimestamp;
            nextPhaseHistory.push({
              phase: incomingPhase,
              iteration: data.iteration ?? prev.iteration,
              expert: data.expert ?? prev.expert,
              startedAt: isoTimestamp,
              message: data.message,
            });
            if (nextPhaseHistory.length > 200) {
              nextPhaseHistory = nextPhaseHistory.slice(-200);
            }
          } else if (!nextPhaseStartedAt && isPhaseEvent) {
            nextPhaseStartedAt = isoTimestamp;
            nextPhaseHistory.push({
              phase: incomingPhase,
              iteration: data.iteration ?? prev.iteration,
              expert: data.expert ?? prev.expert,
              startedAt: isoTimestamp,
              message: data.message,
            });
          }

          if ((data.status === 'completed' || data.status === 'error') && nextPhaseHistory.length > 0) {
            const lastIdx = nextPhaseHistory.length - 1;
            if (!nextPhaseHistory[lastIdx].endedAt) {
              const currentStart = new Date(nextPhaseHistory[lastIdx].startedAt).getTime();
              nextPhaseHistory[lastIdx] = {
                ...nextPhaseHistory[lastIdx],
                endedAt: isoTimestamp,
                durationMs: Math.max(0, now.getTime() - currentStart),
              };
            }
          }

          // Raw event timeline
          let nextRawEvents = prev.rawEvents ? [...prev.rawEvents] : [];
          nextRawEvents.push({
            type: eventLabel,
            phase: data.phase,
            payload: data,
            timestamp: isoTimestamp,
          });
          if (nextRawEvents.length > 200) {
            nextRawEvents = nextRawEvents.slice(-200);
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
          let nextPromptTimeline = prev.promptTimeline ? [...prev.promptTimeline] : [];
          if (data.promptData) {
            const promptPayload: PoetiqPromptData = {
              ...(data.promptData as PoetiqPromptData),
              iteration: data.iteration,
              expert: data.expert,
              timestamp: isoTimestamp,
            };
            nextCurrentPromptData = promptPayload;
            nextPromptHistory.push(promptPayload);
            // Cap history to 50 entries
            if (nextPromptHistory.length > 50) {
              nextPromptHistory = nextPromptHistory.slice(-50);
            }
            nextPromptTimeline.push({
              prompt: promptPayload,
              iteration: data.iteration,
              expert: data.expert,
              timestamp: isoTimestamp,
            });
            if (nextPromptTimeline.length > 50) {
              nextPromptTimeline = nextPromptTimeline.slice(-50);
            }
          }

          // Token / cost tracking
          const nextTokenUsage =
            data.globalTokens || data.tokenUsage || prev.tokenUsage || null;
          const nextCost = data.globalCost || data.cost || prev.cost || null;
          const nextExpertTokenUsage = prev.expertTokenUsage ? { ...prev.expertTokenUsage } : {};
          const nextExpertCost = prev.expertCost ? { ...prev.expertCost } : {};
          if (data.expertCumulativeTokens) {
            Object.entries(data.expertCumulativeTokens).forEach(([key, value]) => {
              nextExpertTokenUsage[key] = value as PoetiqTokenUsage;
            });
          }
          if (data.expertCumulativeCost) {
            Object.entries(data.expertCumulativeCost).forEach(([key, value]) => {
              nextExpertCost[key] = value as PoetiqCostBreakdown;
            });
          }
          
          // Track latest iteration result details if available
          const currentResult = prev.result || {
            success: false,
            isPredictionCorrect: false
          };
          if (data.trainResults) {
            currentResult.trainResults = data.trainResults;
          }
          
          const passCount = trainResultsArray ? trainResultsArray.filter((r: any) => r.success).length : undefined;
          const failCount = typeof passCount === 'number' && trainResultsArray ? trainResultsArray.length - passCount : undefined;
          const trainAccuracy = typeof passCount === 'number' && trainResultsArray && trainResultsArray.length > 0
            ? passCount / trainResultsArray.length
            : undefined;

          let nextIterationHistory = prev.iterationHistory ? [...prev.iterationHistory] : [];
          if (trainResultsArray && typeof data.iteration === 'number') {
            const historyEntry: IterationHistoryEntry = {
              iteration: data.iteration,
              expert: data.expert,
              accuracy: trainAccuracy,
              passCount: passCount ?? undefined,
              failCount: failCount ?? undefined,
              message: data.message,
              timestamp: isoTimestamp,
            };
            const existingIdx = nextIterationHistory.findIndex(
              (entry) => entry.iteration === historyEntry.iteration && entry.expert === historyEntry.expert
            );
            if (existingIdx >= 0) {
              nextIterationHistory[existingIdx] = historyEntry;
            } else {
              nextIterationHistory.push(historyEntry);
            }
            if (nextIterationHistory.length > 100) {
              nextIterationHistory = nextIterationHistory.slice(-100);
            }
          }

          let nextExpertStates = prev.expertStates ? { ...prev.expertStates } : {};
          if (typeof data.expert === 'number') {
            const expertKey = String(data.expert);
            const prevExpert = nextExpertStates[expertKey] || {
              expertId: data.expert,
              iteration: 0,
              status: 'idle',
              lastUpdated: isoTimestamp,
            };
            nextExpertStates[expertKey] = {
              expertId: data.expert,
              iteration: data.iteration ?? prevExpert.iteration,
              status: deriveExpertStatus(incomingPhase, data.status) || prevExpert.status,
              lastUpdated: isoTimestamp,
              lastMessage: data.message || prevExpert.lastMessage,
              passCount: typeof passCount === 'number' ? passCount : prevExpert.passCount,
              failCount: typeof failCount === 'number' ? failCount : prevExpert.failCount,
              trainAccuracy: typeof trainAccuracy === 'number' ? trainAccuracy : prevExpert.trainAccuracy,
              tokens: nextExpertTokenUsage[expertKey] || prevExpert.tokens || null,
              cost: nextExpertCost[expertKey] || prevExpert.cost || null,
            };
          } else if ((data.status === 'completed' || data.status === 'error') && Object.keys(nextExpertStates).length > 0) {
            nextExpertStates = Object.fromEntries(
              Object.entries(nextExpertStates).map(([key, expert]) => {
                if (expert.status === 'prompting' || expert.status === 'evaluating' || expert.status === 'feedback') {
                  return [
                    key,
                    {
                      ...expert,
                      status: data.status === 'error' ? 'error' : 'completed',
                      lastUpdated: isoTimestamp,
                    },
                  ];
                }
                return [key, expert];
              })
            );
          }
          
          return {
            ...prev,
            phase: data.phase || prev.phase,
            iteration: data.iteration ?? prev.iteration,
            totalIterations: data.totalIterations ?? prev.totalIterations,
            message: data.message || prev.message,
            expert: data.expert ?? prev.expert,
            phaseStartedAt: nextPhaseStartedAt,
            phaseHistory: nextPhaseHistory,
            iterationHistory: nextIterationHistory,
            expertStates: nextExpertStates,
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
            promptTimeline: nextPromptTimeline,
            tokenUsage: nextTokenUsage,
            cost: nextCost,
            expertTokenUsage: nextExpertTokenUsage,
            expertCost: nextExpertCost,
            rawEvents: nextRawEvents,
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

    const startTimestamp = new Date().toISOString();

    // IMMEDIATE UI FEEDBACK - Set state synchronously FIRST (Saturn pattern)
    // This ensures UI shows "starting" immediately before any network call
    console.log('[Poetiq] Setting initial state to running...');
    setState({
      ...initialState,
      status: 'running',
      phase: 'initializing',
      iteration: 0,
      totalIterations: maxIterations,
      message: `Initializing Poetiq solver with ${numExperts} expert(s)...`,
      phaseStartedAt: startTimestamp,
      phaseHistory: [
        {
          phase: 'initializing',
          iteration: 0,
          startedAt: startTimestamp,
          message: `Initializing Poetiq solver with ${numExperts} expert(s)...`,
        },
      ],
      iterationHistory: [],
      expertStates: {},
      config: {
        model,
        maxIterations,
        numExperts,
        temperature,
      },
      // Initialize all buffers synchronously so UI has something to display
      logLines: [`🚀 Poetiq Meta-System Solver starting...`, `📋 Task: ${taskId}`, `🤖 Model: ${model}`, `👥 Experts: ${numExperts}`, '---'],
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
          ...initialState,
          status: 'error',
          message: response.message || 'Failed to start solver',
        });
      }
    } catch (err) {
      setState({
        ...initialState,
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
      ...initialState,
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

function deriveExpertStatus(phase?: string, status?: string): PoetiqExpertStatus {
  if (status === 'error') {
    return 'error';
  }
  if (status === 'completed') {
    return 'completed';
  }
  if (!phase) {
    return 'idle';
  }

  const normalized = phase.toLowerCase();
  if (normalized.includes('init') || normalized.includes('solver_start')) {
    return 'initializing';
  }
  if (normalized.includes('prompt')) {
    return 'prompting';
  }
  if (normalized.includes('reason')) {
    return 'prompting';
  }
  if (normalized.includes('evaluate')) {
    return 'evaluating';
  }
  if (normalized.includes('feedback')) {
    return 'feedback';
  }

  return 'idle';
}
