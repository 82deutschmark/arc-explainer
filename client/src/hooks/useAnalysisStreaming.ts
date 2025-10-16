/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: React hook wrapper around the analysis SSE utility, exposing convenient state for UI components to render incremental output and final summaries.
 * SRP/DRY check: Pass — single responsibility to manage stream lifecycle; no duplicate logic in other hooks.
 * shadcn/ui: Pass — logic only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnalysisStreamParams,
  AnalysisStreamHandlers,
  createAnalysisStream,
  StreamChunkPayload,
  StreamSummary,
} from '@/lib/streaming/analysisStream';

type StreamState =
  | { state: 'idle' }
  | { state: 'requested' | 'in_progress' | 'completed' }
  | { state: 'failed'; message?: string }
  | { state: string; [key: string]: unknown };

interface UseAnalysisStreamingState {
  sessionId?: string;
  status: StreamState;
  chunks: StreamChunkPayload[];
  summary?: StreamSummary;
  error?: { code: string; message: string };
}

const INITIAL_STATE: UseAnalysisStreamingState = {
  status: { state: 'idle' },
  chunks: [],
};

export function useAnalysisStreaming() {
  const [state, setState] = useState<UseAnalysisStreamingState>(INITIAL_STATE);
  const streamHandleRef = useRef<{ close: () => void } | null>(null);

  const aggregatedContent = useMemo(() => {
    return state.chunks.reduce(
      (acc, chunk) => {
        if (chunk.delta) {
          if (chunk.type === 'text') {
            acc.text += chunk.delta;
          } else if (chunk.type === 'reasoning') {
            acc.reasoning += chunk.delta;
          } else if (chunk.type === 'json') {
            acc.json += chunk.delta;
          }
        }
        return acc;
      },
      { text: '', reasoning: '', json: '' }
    );
  }, [state.chunks]);

  const aggregatedText = aggregatedContent.text;
  const aggregatedReasoning = aggregatedContent.reasoning;
  const aggregatedJson = aggregatedContent.json;

  const parsedStructuredJson = useMemo(() => {
    if (!aggregatedJson) {
      return undefined;
    }

    try {
      return JSON.parse(aggregatedJson);
    } catch {
      return undefined;
    }
  }, [aggregatedJson]);

  const startStream = useCallback(
    (params: AnalysisStreamParams, extraHandlers: Partial<AnalysisStreamHandlers> = {}) => {
      if (streamHandleRef.current) {
        streamHandleRef.current.close();
      }

      setState({
        status: { state: 'requested' },
        chunks: [],
        summary: undefined,
        error: undefined,
      });

      const handle = createAnalysisStream(params, {
        onInit: payload => {
          setState(prev => ({
            ...prev,
            sessionId: payload.sessionId,
          }));
          extraHandlers.onInit?.(payload);
        },
        onStatus: status => {
          setState(prev => ({
            ...prev,
            status,
          }));
          extraHandlers.onStatus?.(status);
        },
        onChunk: chunk => {
          setState(prev => ({
            ...prev,
            chunks: [...prev.chunks, chunk],
          }));
          extraHandlers.onChunk?.(chunk);
        },
        onComplete: summary => {
          setState(prev => ({
            ...prev,
            status: { state: 'completed' },
            summary,
          }));
          extraHandlers.onComplete?.(summary);
        },
        onError: error => {
          setState(prev => ({
            ...prev,
            status: { state: 'failed', message: error.message },
            error,
          }));
          extraHandlers.onError?.(error);
        },
      });

      streamHandleRef.current = handle;
    },
    []
  );

  const closeStream = useCallback(() => {
    if (streamHandleRef.current) {
      streamHandleRef.current.close();
      streamHandleRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    return () => {
      if (streamHandleRef.current) {
        streamHandleRef.current.close();
        streamHandleRef.current = null;
      }
    };
  }, []);

  return {
    sessionId: state.sessionId,
    status: state.status,
    chunks: state.chunks,
    summary: state.summary,
    error: state.error,
    visibleText: aggregatedText,
    reasoningText: aggregatedReasoning,
    structuredJsonText: aggregatedJson,
    structuredJson: parsedStructuredJson,
    startStream,
    closeStream,
  };
}

