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
  game_id?: string;  // Match API property name
  agentName?: string;
  systemPrompt?: string;  // Base system instructions (overrides default)
  instructions: string;   // User/operator guidance
  model?: string;
  maxTurns?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  systemPromptPresetId?: 'twitch' | 'playbook' | 'none';
  skipDefaultSystemPrompt?: boolean;
}

export interface Arc3AgentStreamState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  gameId?: string;
  agentName?: string;
  gameGuid?: string;  // Current game session identifier for continuation
  message?: string;
  finalOutput?: string;
  streamingReasoning?: string;  // Accumulates reasoning content during streaming
  frames: Array<{
    guid?: string;
    game_id?: string;
    frame: number[][][];
    score: number;
    state: string;
    action_counter: number;
    max_actions: number;
    full_reset: boolean;
    win_score?: number;
    available_actions?: Array<string | number>;  // List of available action identifiers from API
    action?: {
      type: string;
      coordinates?: [number, number];
    };
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
  lastResponseId?: string;  // For message chaining with Responses API
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
  const latestGuidRef = useRef<string | null>(null);  // Track latest guid synchronously to prevent race conditions
  const latestGameIdRef = useRef<string | null>(null);  // CRITICAL: Track gameId in sync with guid to prevent mismatch
  const isPendingActionRef = useRef(false);  // CRITICAL: Ref-based lock for synchronous check (state has stale closure issue)
  const [isPendingManualAction, setIsPendingManualAction] = useState(false);  // State for UI updates (disable buttons)
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
          gameId: options.game_id || 'ls20',
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
            game_id: options.game_id || 'ls20',  // Match API property name
            agentName: options.agentName,
            systemPrompt: options.systemPrompt,
            instructions: options.instructions,
            model: options.model,
            maxTurns: options.maxTurns,
            reasoningEffort: options.reasoningEffort || 'low',
            systemPromptPresetId: options.systemPromptPresetId,
            skipDefaultSystemPrompt: options.skipDefaultSystemPrompt,
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

          // Attach all event listeners
          attachEventListeners(eventSource);

        } else {
          // Non-streaming fallback
          const response = await apiRequest('POST', '/api/arc3/real-game/run', {
            game_id: options.game_id || 'ls20',  // Match API property name
            agentName: options.agentName,
            systemPrompt: options.systemPrompt,
            instructions: options.instructions,
            model: options.model,
            maxTurns: options.maxTurns,
            reasoningEffort: options.reasoningEffort || 'low',
            systemPromptPresetId: options.systemPromptPresetId,
            skipDefaultSystemPrompt: options.skipDefaultSystemPrompt,
          });

          const result = await response.json();
          const data = result.data;

          setState({
            status: 'completed',
            gameId: data.summary?.scenarioId,
            agentName: options.agentName,
            finalOutput: data.finalOutput,
            frames: (data.frames as Arc3AgentStreamState['frames']) || [],
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

  // Helper function to attach all SSE event listeners to an EventSource
  const attachEventListeners = useCallback((eventSource: EventSource) => {
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

    eventSource.addEventListener('agent.loop_hint', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent<string>).data);
        console.log('[ARC3 Stream] Loop hint:', data);

        setState((prev) => ({
          ...prev,
          streamingMessage: data.message || 'Agent is rethinking strategy...',
          timeline: [...prev.timeline, {
            index: prev.timeline.length,
            type: 'assistant_message' as const,
            label: 'Loop hint',
            content: data.message || 'No score change detected; trying alternate strategy.',
          }],
        }));
      } catch (error) {
        console.error('[ARC3 Stream] Failed to parse agent.loop_hint payload:', error);
      }
    });

    eventSource.addEventListener('agent.reasoning', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent<string>).data);
        console.log('[ARC3 Stream] Agent reasoning delta:', data);

        // Only update the accumulating reasoning, don't add to timeline yet
        // Timeline entry will be added when reasoning completes
        const reasoningContent = data.content || "";

        setState((prev) => ({
          ...prev,
          streamingMessage: 'Agent is reasoning...',
          streamingReasoning: reasoningContent,
        }));
      } catch (error) {
        console.error('[ARC3 Stream] Failed to parse agent.reasoning payload:', error);
      }
    });

    eventSource.addEventListener('agent.reasoning_complete', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent<string>).data);
        console.log('[ARC3 Stream] Agent reasoning complete:', data);

        // Now add the final reasoning to timeline
        const finalContent = data.finalContent || "";

        setState((prev) => ({
          ...prev,
          streamingReasoning: finalContent,
          timeline: [...prev.timeline, {
            index: prev.timeline.length,
            type: 'reasoning' as const,
            label: 'Agent Reasoning',
            content: finalContent,
          }],
        }));
      } catch (error) {
        console.error('[ARC3 Stream] Failed to parse agent.reasoning_complete payload:', error);
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

        // Merge action data into frameData
        const frameWithAction = {
          ...data.frameData,
          action: data.action // Add action metadata from event
        };

        // NOTE: Do NOT update latestGuidRef here - guid is set ONCE during initializeGameSession
        // and must remain constant throughout the session (per ARC3 API spec)
        // Only update gameId ref for tracking purposes
        if (frameWithAction.game_id) {
          latestGameIdRef.current = frameWithAction.game_id;
        }

        setState((prev) => ({
          ...prev,
          frames: data.frameIndex === prev.frames.length
            ? [...prev.frames, frameWithAction]
            : prev.frames.map((frame, index) =>
                index === data.frameIndex ? frameWithAction : frame
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

        // Update refs with final guid AND gameId for potential manual actions after agent completes
        if (data.gameGuid) {
          latestGuidRef.current = data.gameGuid;
        }
        if (data.gameId) {
          latestGameIdRef.current = data.gameId;
        }

        setState((prev) => ({
          ...prev,
          status: 'completed',
          streamingStatus: 'completed',
          streamingMessage: 'Agent completed successfully!',
          runId: data.runId,
          gameGuid: data.gameGuid,  // Store the game session guid for continuation
          lastResponseId: data.providerResponseId,  // CRITICAL FIX: Backend sends providerResponseId, not lastResponseId
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
  }, [closeEventSource]);

  const continueWithMessage = useCallback(
    async (userMessage: string) => {
      if (!sessionId) {
        console.warn('[ARC3 Stream] Cannot continue: no active session');
        return;
      }

      try {
        closeEventSource();

        setState((prev) => ({
          ...prev,
          status: 'running',
          streamingStatus: 'starting',
          streamingMessage: 'Preparing to continue...',
        }));

        const latestFrame = state.frames[state.frames.length - 1];
        const seedFrame = latestFrame && state.gameGuid && state.gameId
          ? {
              guid: latestFrame.guid ?? state.gameGuid,
              game_id: latestFrame.game_id ?? state.gameId,
              frame: latestFrame.frame,
              score: latestFrame.score,
              state: latestFrame.state,
              action_counter: latestFrame.action_counter,
              max_actions: latestFrame.max_actions,
              win_score: latestFrame.win_score,
              full_reset: latestFrame.full_reset ?? false,
              available_actions: latestFrame.available_actions,
            }
          : undefined;

        // Step 1: POST to /continue to prepare the continuation payload
        const continueResponse = await apiRequest('POST', `/api/arc3/stream/${sessionId}/continue`, {
          userMessage,
          previousResponseId: state.lastResponseId,
          existingGameGuid: state.gameGuid,
          lastFrame: seedFrame,
        });

        const continueData = await continueResponse.json();
        if (!continueData.success) {
          throw new Error(continueData.error?.message || 'Failed to prepare continuation');
        }

        // Step 2: Open SSE connection to the continue-stream endpoint
        const streamUrl = `/api/arc3/stream/${sessionId}/continue-stream`;
        console.log('[ARC3 Stream] Starting continuation SSE:', streamUrl);

        const eventSource = new EventSource(streamUrl);
        sseRef.current = eventSource;

        // Attach all event listeners to the new connection
        attachEventListeners(eventSource);

      } catch (error) {
        console.error('[ARC3 Stream] Error in continueWithMessage:', error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          streamingStatus: 'failed',
          streamingMessage: error instanceof Error ? error.message : 'Failed to continue',
          error: error instanceof Error ? error.message : 'Failed to continue',
        }));
      }
    },
    [sessionId, state.lastResponseId, state.gameGuid, state.frames, state.gameId, closeEventSource]
  );

  const executeManualAction = useCallback(
    async (action: string, coordinates?: [number, number]) => {
      // CRITICAL: Check ref FIRST for synchronous lock (state check has stale closure issue)
      // If user clicks rapidly, the state-based check might not have updated yet
      if (isPendingActionRef.current) {
        console.warn('[ARC3 Manual Action] Blocked by ref lock - action already in progress');
        throw new Error('Another action is in progress. Please wait.');
      }

      // CRITICAL: Set ref lock IMMEDIATELY before any async work
      isPendingActionRef.current = true;

      // CRITICAL: Use BOTH refs (not state) to avoid guid/gameId mismatch when user rapidly switches games
      // The refs are updated synchronously in initializeGameSession, while state updates are async
      const currentGuid = latestGuidRef.current || state.gameGuid;
      const currentGameId = latestGameIdRef.current || state.gameId;

      if (!currentGuid || !currentGameId) {
        isPendingActionRef.current = false;  // Release lock on early exit
        throw new Error('No active game session. Start a game first.');
      }

      try {
        setIsPendingManualAction(true);  // Also set state for UI updates (disable buttons after re-render)

        console.log('[ARC3 Manual Action] Executing:', {
          action,
          coordinates,
          currentGuid,
          gameId: currentGameId,
          usingRefGuid: latestGuidRef.current !== null,
          usingRefGameId: latestGameIdRef.current !== null,
          stateGuid: state.gameGuid,
          stateGameId: state.gameId,
        });

        setState(prev => ({
          ...prev,
          streamingMessage: `Executing ${action}...`,
        }));

        const response = await apiRequest('POST', '/api/arc3/manual-action', {
          game_id: currentGameId,
          guid: currentGuid,  // Use latest guid from ref
          action,
          coordinates,
        });

        const result = await response.json();
        console.log('[ARC3 Manual Action] API Response:', result);

        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to execute action');
        }

        const frameData = result.data;
        console.log('[ARC3 Manual Action] Frame data received:', {
          guid: frameData.guid,
          state: frameData.state,
          score: frameData.score,
          frameShape: frameData.frame ? `[${frameData.frame.length}][${frameData.frame[0]?.length}][${frameData.frame[0]?.[0]?.length}]` : 'null',
          available_actions: frameData.available_actions,
        });

        // NOTE: Do NOT update latestGuidRef here - guid is set ONCE during initializeGameSession
        // and must remain constant throughout the session (per ARC3 API spec)
        // Only update gameId ref for tracking purposes
        latestGameIdRef.current = frameData.game_id;

        // Add action metadata to frame
        const frameWithAction = {
          ...frameData,
          action: {
            type: action,
            coordinates,
          },
        };

        // Update state with new frame (guid stays constant per ARC3 API spec)
        setState(prev => {
          const newFrameIndex = prev.frames.length;
          console.log('[ARC3 Manual Action] Updating state:', {
            newFrameIndex,
            sessionGuid: prev.gameGuid,
            responseGuid: frameData.guid,
            guidsMatch: frameData.guid === prev.gameGuid,
          });

          return {
            ...prev,
            // NOTE: Do NOT update gameGuid here - it's set once during initializeGameSession
            frames: [...prev.frames, frameWithAction],
            currentFrameIndex: newFrameIndex,
            streamingMessage: `${action} completed`,
            error: undefined,  // Clear any previous errors
            timeline: [...prev.timeline, {
              index: prev.timeline.length,
              type: 'tool_call' as const,
              label: `Manual ${action}${coordinates ? ` at (${coordinates[0]}, ${coordinates[1]})` : ''}`,
              content: JSON.stringify({ action, coordinates, manual: true, newState: frameData.state, newScore: frameData.score }, null, 2),
            }],
          };
        });

        return frameData;
      } catch (error) {
        console.error('[ARC3 Manual Action] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to execute action';
        setState(prev => ({
          ...prev,
          streamingMessage: errorMessage,
          error: errorMessage,
        }));
        throw error;
      } finally {
        // CRITICAL: Release BOTH locks - ref first (synchronous), then state (async UI update)
        isPendingActionRef.current = false;
        setIsPendingManualAction(false);
      }
    },
    [state.gameGuid, state.gameId]  // Removed isPendingManualAction - now using ref for lock check
  );

  const initializeGameSession = useCallback((frameData: any) => {
    console.log('[ARC3] initializeGameSession called with frameData:', frameData);
    console.log('[ARC3] frameData.frame structure:', {
      type: typeof frameData.frame,
      isArray: Array.isArray(frameData.frame),
      length: frameData.frame?.length,
      firstElement: frameData.frame?.[0] ? {
        type: typeof frameData.frame[0],
        isArray: Array.isArray(frameData.frame[0]),
        length: frameData.frame[0]?.length,
      } : null,
    });

    // CRITICAL: Set BOTH refs immediately so manual actions work right away
    // State updates are async, but refs are synchronous - prevents guid/gameId mismatch
    latestGuidRef.current = frameData.guid;
    latestGameIdRef.current = frameData.game_id;

    setState(prev => ({
      ...prev,
      gameGuid: frameData.guid,
      gameId: frameData.game_id,
      frames: [{
        guid: frameData.guid,
        game_id: frameData.game_id,
        frame: frameData.frame,
        score: frameData.score,
        state: frameData.state,
        action_counter: frameData.action_counter,
        max_actions: frameData.max_actions,
        full_reset: frameData.full_reset || false,
        win_score: frameData.win_score,
        available_actions: frameData.available_actions,
      }],
      currentFrameIndex: 0,
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
    continueWithMessage,
    executeManualAction,
    initializeGameSession,
    setCurrentFrame,
    currentFrame: state.frames[state.currentFrameIndex] || null,
    isPlaying: state.status === 'running' && state.streamingStatus === 'in_progress',
    isPendingManualAction,  // Lock state for disabling action buttons during execution
  };
}
