/**
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-11-06
 * PURPOSE: React hook that orchestrates ARC3 agent streaming, bridging SSE connections with the backend
 * to provide real-time updates of agent gameplay, frame changes, and reasoning.
 * SRP/DRY check: Pass — follows established streaming patterns from useSaturnProgress while adapting for ARC3-specific events.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { isStreamingEnabled } from '@shared/config/streaming';

export interface Arc3AgentOptions {
  gameId?: string;
  agentName?: string;
  instructions: string;
  model?: string;
  maxTurns?: number;
}

export interface Arc3AgentStreamState {
  status: 'idle' | 'running' | 'completed' | 'error';
  gameId?: string;
  agentName?: string;
  message?: string;
  finalOutput?: string;
  frames: Array<{
    frame: number[][];
    score: number;
    state: string;
    action_counter: number;
    max_actions: number;
    full_reset: boolean;
  }>;
  currentFrameIndex: number;
  timeline: Array<{
    index: number;
    type: 'assistant_message' | 'tool_call' | 'tool_result' | 'reasoning';
    label: string;
    content: string;
  }>;
  summary?: {
    state: string;
    score: number;
    stepsTaken: number;
    simpleActionsUsed: string[];
    coordinateGuesses: number;
    scenarioId: string;
    scenarioName: string;
  };
  usage?: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  runId?: string;
  streamingStatus: 'idle' | 'starting' | 'in_progress' | 'completed' | 'failed';
  streamingMessage?: string;
  error?: string;
}

export function useArc3AgentStream() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<Arc3AgentStreamState>({
    status: 'idle',
    frames: [],
    currentFrameIndex: 0,
    timeline: [],
    streamingStatus: 'idle',
  });
  const sseRef = useRef<EventSource | null>(null);
  const streamingEnabled = isStreamingEnabled();

  const closeEventSource = useCallback(() => {
    if (sseRef.current) {
      try {
        sseRef.current.close();
      } catch {
        // Ignore errors during cleanup
      } finally {
        sseRef.current = null;
      }
    }
  }, []);

  const start = useCallback(
    async (options: Arc3AgentOptions) => {
      console.log('[ARC3 Stream] START CALLED with options:', options);

      try {
        closeEventSource();

        // Set initial state
        setState({
          status: 'running',
          gameId: options.gameId || 'ls20',
          agentName: options.agentName || 'ARC3 Agent',
          frames: [],
          currentFrameIndex: 0,
          timeline: [],
          streamingStatus: streamingEnabled ? 'starting' : 'idle',
          streamingMessage: 'Preparing to start agent...',
        });

        if (streamingEnabled) {
          // Step 1: Prepare streaming session
          const prepareResponse = await apiRequest('POST', '/api/arc3/stream/prepare', {
            gameId: options.gameId || 'ls20',
            agentName: options.agentName,
            instructions: options.instructions,
            model: options.model,
            maxTurns: options.maxTurns,
          });

          const prepareData = await prepareResponse.json();
          const newSessionId = prepareData.data?.sessionId;

          if (!newSessionId) {
            throw new Error('Failed to prepare streaming session');
          }

          setSessionId(newSessionId);

          // Step 2: Start SSE connection
          const streamUrl = `/api/arc3/stream/${newSessionId}`;
          console.log('[ARC3 Stream] Starting SSE connection:', streamUrl);

          const eventSource = new EventSource(streamUrl);
          sseRef.current = eventSource;

          eventSource.addEventListener('stream.init', (evt) => {
            try {
              const payload = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Received init:', payload);
              
              setState((prev) => ({
                ...prev,
                streamingStatus: 'starting',
                streamingMessage: 'Agent initialized, starting gameplay...',
                gameId: payload.gameId,
                agentName: payload.agentName,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse init payload:', error);
            }
          });

          eventSource.addEventListener('stream.status', (evt) => {
            try {
              const status = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Received status:', status);

              setState((prev) => ({
                ...prev,
                streamingStatus: status.state || prev.streamingStatus,
                streamingMessage: status.message || prev.streamingMessage,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse status payload:', error);
            }
          });

          eventSource.addEventListener('agent.starting', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent starting:', data);

              setState((prev) => ({
                ...prev,
                streamingStatus: 'in_progress',
                streamingMessage: 'Agent is analyzing the game...',
                gameId: data.gameId,
                agentName: data.agentName,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.starting payload:', error);
            }
          });

          eventSource.addEventListener('agent.ready', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent ready:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: 'Agent ready, beginning gameplay...',
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.ready payload:', error);
            }
          });

          eventSource.addEventListener('agent.tool_call', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent tool call:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: `Agent called ${data.tool}...`,
                timeline: [...prev.timeline, {
                  index: prev.timeline.length,
                  type: 'tool_call' as const,
                  label: `Agent called ${data.tool}`,
                  content: JSON.stringify(data.arguments, null, 2),
                }],
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.tool_call payload:', error);
            }
          });

          eventSource.addEventListener('agent.tool_result', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent tool result:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: `Received result from ${data.tool}...`,
                timeline: [...prev.timeline, {
                  index: prev.timeline.length,
                  type: 'tool_result' as const,
                  label: `Result from ${data.tool}`,
                  content: JSON.stringify(data.result, null, 2),
                }],
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.tool_result payload:', error);
            }
          });

          eventSource.addEventListener('agent.reasoning', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent reasoning:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: 'Agent is reasoning...',
                timeline: [...prev.timeline, {
                  index: prev.timeline.length,
                  type: 'reasoning' as const,
                  label: 'Agent reasoning',
                  content: JSON.stringify(data.reasoning, null, 2),
                }],
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.reasoning payload:', error);
            }
          });

          eventSource.addEventListener('agent.message', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent message:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: 'Agent shared insights...',
                timeline: [...prev.timeline, {
                  index: prev.timeline.length,
                  type: 'assistant_message' as const,
                  label: `${data.agentName} → user`,
                  content: data.content,
                }],
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.message payload:', error);
            }
          });

          eventSource.addEventListener('game.started', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Game started:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: 'Game session started...',
                frames: [...prev.frames, data.initialFrame],
                currentFrameIndex: prev.frames.length,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse game.started payload:', error);
            }
          });

          eventSource.addEventListener('game.action_executed', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Action executed:', data);

              setState((prev) => ({
                ...prev,
                streamingMessage: `Executed ${data.action}...`,
                frames: [...prev.frames, data.newFrame],
                currentFrameIndex: prev.frames.length,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse game.action_executed payload:', error);
            }
          });

          eventSource.addEventListener('game.frame_update', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Frame update:', data);

              setState((prev) => ({
                ...prev,
                frames: data.frameIndex === prev.frames.length 
                  ? [...prev.frames, data.frameData]
                  : prev.frames.map((frame, index) => 
                      index === data.frameIndex ? data.frameData : frame
                    ),
                currentFrameIndex: data.frameIndex,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse game.frame_update payload:', error);
            }
          });

          eventSource.addEventListener('agent.completed', (evt) => {
            try {
              const data = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Agent completed:', data);

              setState((prev) => ({
                ...prev,
                status: 'completed',
                streamingStatus: 'completed',
                streamingMessage: 'Agent completed successfully!',
                runId: data.runId,
                finalOutput: data.finalOutput,
                summary: data.summary,
                usage: data.usage,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse agent.completed payload:', error);
            } finally {
              closeEventSource();
            }
          });

          eventSource.addEventListener('stream.complete', (evt) => {
            try {
              const summary = JSON.parse((evt as MessageEvent<string>).data);
              console.log('[ARC3 Stream] Stream completed:', summary);

              setState((prev) => ({
                ...prev,
                status: 'completed',
                streamingStatus: 'completed',
                streamingMessage: 'Game session completed!',
                runId: summary.runId,
                finalOutput: summary.finalOutput,
                summary: summary.summary,
                usage: summary.usage,
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse completion payload:', error);
            } finally {
              closeEventSource();
            }
          });

          eventSource.addEventListener('stream.error', (evt) => {
            try {
              const payload = JSON.parse((evt as MessageEvent<string>).data);
              console.error('[ARC3 Stream] Stream error:', payload);

              setState((prev) => ({
                ...prev,
                status: 'error',
                streamingStatus: 'failed',
                streamingMessage: payload.message || 'Streaming error',
                error: payload.message || 'Unknown streaming error',
              }));
            } catch (error) {
              console.error('[ARC3 Stream] Failed to parse error payload:', error);
            } finally {
              closeEventSource();
            }
          });

          eventSource.onerror = (err) => {
            console.error('[ARC3 Stream] EventSource error:', err);
            setState((prev) => ({
              ...prev,
              status: 'error',
              streamingStatus: 'failed',
              streamingMessage: 'Streaming connection lost',
              error: 'Streaming connection lost',
            }));
            closeEventSource();
          };

        } else {
          // Non-streaming fallback
          const response = await apiRequest('POST', '/api/arc3/real-game/run', {
            gameId: options.gameId || 'ls20',
            agentName: options.agentName,
            instructions: options.instructions,
            model: options.model,
            maxTurns: options.maxTurns,
          });

          const result = await response.json();
          const data = result.data;

          setState({
            status: 'completed',
            gameId: data.summary?.scenarioId,
            agentName: options.agentName,
            finalOutput: data.finalOutput,
            frames: data.frames || [],
            currentFrameIndex: 0,
            timeline: data.timeline || [],
            summary: data.summary,
            usage: data.usage,
            runId: data.runId,
            streamingStatus: 'completed',
          });
        }
      } catch (error) {
        console.error('[ARC3 Stream] Error in start function:', error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          streamingStatus: 'failed',
          streamingMessage: error instanceof Error ? error.message : 'Failed to start agent',
          error: error instanceof Error ? error.message : 'Failed to start agent',
        }));
      }
    },
    [closeEventSource, streamingEnabled]
  );

  const cancel = useCallback(async () => {
    if (!sessionId) {
      console.warn('[ARC3 Stream] Cannot cancel: no active session');
      return;
    }

    try {
      await apiRequest('POST', `/api/arc3/stream/cancel/${sessionId}`);
      closeEventSource();

      setState(prev => ({
        ...prev,
        status: 'error',
        streamingStatus: 'failed',
        streamingMessage: 'Cancelled by user',
        error: 'Cancelled by user',
      }));
    } catch (error) {
      console.error('[ARC3 Stream] Cancel failed:', error);
    }
  }, [sessionId, closeEventSource]);

  const setCurrentFrame = useCallback((frameIndex: number) => {
    setState((prev) => ({
      ...prev,
      currentFrameIndex: Math.max(0, Math.min(frameIndex, prev.frames.length - 1)),
    }));
  }, []);

  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  return { 
    sessionId, 
    state, 
    start, 
    cancel, 
    setCurrentFrame,
    currentFrame: state.frames[state.currentFrameIndex] || null,
    isPlaying: state.status === 'running' && state.streamingStatus === 'in_progress',
  };
}
