/**
 * useAnalysisResults.ts
 * 
 * Author: Cascade
 * PURPOSE: Central hook that orchestrates puzzle analysis requests, manages model-specific state,
 * and coordinates persistence. Streaming integration augments the legacy POST flow so UI consumers
 * can transparently render incremental output while preserving the database-first contract.
 * SRP/DRY check: Pass — single hook responsible for analysis lifecycle; no duplication across pages.
 * shadcn/ui: Pass — logic only.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ExplanationData } from '@/types/puzzle';
import { useAnalysisStreaming } from '@/hooks/useAnalysisStreaming';
import type { AnalysisStreamParams } from '@/lib/streaming/analysisStream';
import type { ModelConfig } from '@shared/types';
import { isFeatureFlagEnabled } from '@shared/utils/featureFlags';

interface UseAnalysisResultsProps {
  taskId: string;
  refetchExplanations: (options?: any) => void;
  emojiSetKey?: string;
  omitAnswer?: boolean;
  retryMode?: boolean;
  originalExplanation?: ExplanationData | null;
  customChallenge?: string;
  previousResponseId?: string;
  models?: ModelConfig[];
}

type StreamingPanelStatus = 'idle' | 'starting' | 'in_progress' | 'completed' | 'failed';

export function useAnalysisResults({
  taskId,
  refetchExplanations,
  emojiSetKey,
  omitAnswer,
  retryMode,
  originalExplanation,
  customChallenge,
  previousResponseId,
  models,
}: UseAnalysisResultsProps) {
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.95);
  const [candidateCount, setCandidateCount] = useState(1);
  const [thinkingBudget, setThinkingBudget] = useState(-1);
  const [promptId, setPromptId] = useState('solver');
  const [customPrompt, setCustomPrompt] = useState('');
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null);
  const [processingModels, setProcessingModels] = useState<Set<string>>(new Set());
  const [analyzerErrors, setAnalyzerErrors] = useState<Map<string, Error>>(new Map());
  const [analysisStartTime, setAnalysisStartTime] = useState<Record<string, number>>({});
  const [analysisTimes, setAnalysisTimes] = useState<Record<string, number>>({});

  // GPT-5 reasoning parameters
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('high');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('detailed');

  // Streaming integration
  const streamingEnabled = isFeatureFlagEnabled(import.meta.env.VITE_ENABLE_SSE_STREAMING as string | undefined);
  const {
    startStream,
    closeStream,
    status: streamStatus,
    visibleText: streamingVisibleText,
    reasoningText: streamingReasoningText,
    summary: streamSummary,
    error: streamError,
  } = useAnalysisStreaming();
  const streamingContextRef = useRef<{ modelKey: string; startTime: number } | null>(null);
  const [streamingModelKey, setStreamingModelKey] = useState<string | null>(null);
  const [streamingPhase, setStreamingPhase] = useState<string | undefined>();
  const [streamingMessage, setStreamingMessage] = useState<string | undefined>();
  const [streamingTokenUsage, setStreamingTokenUsage] = useState<{ input?: number; output?: number; reasoning?: number }>({});

  const streamSupportedModels = useMemo(() => {
    if (!models || models.length === 0) {
      return new Set<string>();
    }
    return new Set(models.filter(model => model.supportsStreaming).map(model => model.key));
  }, [models]);

  const removeProcessingModel = useCallback((modelKey: string) => {
    setProcessingModels(prev => {
      const next = new Set(prev);
      next.delete(modelKey);
      return next;
    });
  }, []);

  const resetStreamingState = useCallback(() => {
    streamingContextRef.current = null;
    setStreamingModelKey(null);
    setStreamingPhase(undefined);
    setStreamingMessage(undefined);
    setStreamingTokenUsage({});
  }, []);

  const canStreamModel = useCallback(
    (modelKey: string) => streamingEnabled && streamSupportedModels.has(modelKey),
    [streamingEnabled, streamSupportedModels]
  );

  const handleStreamingError = useCallback(
    (error: { code: string; message: string } | null, modelKey: string) => {
      closeStream();
      removeProcessingModel(modelKey);
      resetStreamingState();
      const message = error?.message || 'Streaming failed. Please try again.';
      setAnalyzerErrors(prev => new Map(prev).set(modelKey, new Error(message)));
    },
    [closeStream, removeProcessingModel, resetStreamingState]
  );

  const handleStreamingComplete = useCallback(
    async (summary: any, modelKey: string) => {
      try {
        const tokenUsage = summary?.metadata?.tokenUsage as { input?: number; output?: number; reasoning?: number } | undefined;
        if (tokenUsage) {
          setStreamingTokenUsage(tokenUsage);
        }

        const context = streamingContextRef.current;
        const startedAt = context && context.modelKey === modelKey ? context.startTime : analysisStartTime[modelKey];
        const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;
        if (durationSeconds !== undefined) {
          setAnalysisTimes(prev => ({ ...prev, [modelKey]: durationSeconds }));
        }

        const analysis = summary?.responseSummary?.analysis as Record<string, unknown> | undefined;
        if (!analysis) {
          throw new Error('Streaming summary missing analysis payload');
        }

        const explanationToSave = {
          [modelKey]: {
            ...analysis,
            modelKey,
            ...(durationSeconds !== undefined ? { actualProcessingTime: durationSeconds } : {}),
          },
        };

        const saveResponse = await apiRequest('POST', `/api/puzzle/save-explained/${taskId}`, { explanations: explanationToSave });
        if (!saveResponse.ok) {
          throw new Error(`Save request failed: ${saveResponse.statusText}`);
        }
        const saveJson = await saveResponse.json();
        if (saveJson?.success === false) {
          throw new Error(saveJson.message || 'Save request failed');
        }

        removeProcessingModel(modelKey);
        setAnalyzerErrors(prev => {
          const next = new Map(prev);
          next.delete(modelKey);
          return next;
        });
        // Don't reset streaming state immediately - let user see final result
        // resetStreamingState() will be called when user closes modal manually
        closeStream();
        await refetchExplanations();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Streaming completion failed';
        handleStreamingError({ code: 'STREAM_SAVE_FAILED', message }, modelKey);
      }
    },
    [analysisStartTime, closeStream, handleStreamingError, refetchExplanations, removeProcessingModel, resetStreamingState, taskId]
  );

  const startStreamingAnalysis = useCallback(
    (modelKey: string, supportsTemperature: boolean) => {
      const startTime = Date.now();
      setAnalysisStartTime(prev => ({ ...prev, [modelKey]: startTime }));
      streamingContextRef.current = { modelKey, startTime };
      setProcessingModels(prev => new Set(prev).add(modelKey));
      setCurrentModelKey(modelKey);
      setStreamingModelKey(modelKey);
      setStreamingPhase(undefined);
      setStreamingMessage(undefined);
      setStreamingTokenUsage({});
      setAnalyzerErrors(prev => {
        const next = new Map(prev);
        next.delete(modelKey);
        return next;
      });

      const params: AnalysisStreamParams = {
        taskId,
        modelKey,
        temperature: supportsTemperature ? temperature : undefined,
        promptId,
        customPrompt: promptId === 'custom' && customPrompt.trim() ? customPrompt.trim() : undefined,
        emojiSetKey,
        omitAnswer,
        topP: supportsTemperature ? topP : undefined,
        candidateCount: supportsTemperature ? candidateCount : undefined,
        thinkingBudget,
        reasoningEffort: isGPT5ReasoningModel(modelKey) ? reasoningEffort : undefined,
        reasoningVerbosity: isGPT5ReasoningModel(modelKey) ? reasoningVerbosity : undefined,
        reasoningSummaryType: isGPT5ReasoningModel(modelKey) ? reasoningSummaryType : undefined,
        systemPromptMode: 'ARC',
        previousResponseId,
        captureReasoning: true,
        retryMode,
        customChallenge,
        originalExplanationId: originalExplanation?.id,
      };

      void startStream(params, {
        onStatus: status => {
          if (status && typeof status === 'object') {
            if ('phase' in status && typeof (status as any).phase === 'string') {
              setStreamingPhase((status as any).phase);
            }
            if ('message' in status && typeof (status as any).message === 'string') {
              setStreamingMessage((status as any).message);
            }
          }
        },
        onComplete: summary => handleStreamingComplete(summary, modelKey),
        onError: error => handleStreamingError(error, modelKey),
      });
    },
    [
      candidateCount,
      customChallenge,
      customPrompt,
      emojiSetKey,
      handleStreamingComplete,
      handleStreamingError,
      omitAnswer,
      originalExplanation,
      previousResponseId,
      promptId,
      reasoningEffort,
      reasoningSummaryType,
      reasoningVerbosity,
      retryMode,
      startStream,
      taskId,
      temperature,
      thinkingBudget,
      topP,
    ]
  );

  const cancelStreamingAnalysis = useCallback(() => {
    const context = streamingContextRef.current;
    if (!context) {
      return;
    }
    closeStream();
    removeProcessingModel(context.modelKey);
    resetStreamingState();
    setAnalyzerErrors(prev => new Map(prev).set(context.modelKey, new Error('Analysis cancelled')));
  }, [closeStream, removeProcessingModel, resetStreamingState]);

  const closeStreamingModal = useCallback(() => {
    closeStream();
    resetStreamingState();
  }, [closeStream, resetStreamingState]);

  // Legacy mutation path (non-streaming)
  const analyzeAndSaveMutation = useMutation({
    mutationFn: async (payload: {
      modelKey: string;
      temperature?: number;
      topP?: number;
      candidateCount?: number;
      thinkingBudget?: number;
      reasoningEffort?: string;
      reasoningVerbosity?: string;
      reasoningSummaryType?: string;
    }) => {
      const {
        modelKey,
        temperature: temp,
        topP: p,
        candidateCount: c,
        thinkingBudget: tb,
        reasoningEffort: effort,
        reasoningVerbosity: verbosity,
        reasoningSummaryType: summaryType,
      } = payload;

      const startTime = Date.now();
      setAnalysisStartTime(prev => ({ ...prev, [modelKey]: startTime }));
      setProcessingModels(prev => new Set(prev).add(modelKey));

      try {
        const requestBody: Record<string, unknown> = {
          temperature: temp,
          promptId,
          ...(p ? { topP: p } : {}),
          ...(c ? { candidateCount: c } : {}),
          ...(typeof tb === 'number' ? { thinkingBudget: tb } : {}),
          ...(emojiSetKey ? { emojiSetKey } : {}),
          ...(typeof omitAnswer === 'boolean' ? { omitAnswer } : {}),
          ...(retryMode ? { retryMode } : {}),
          ...(originalExplanation ? { originalExplanation } : {}),
          ...(customChallenge ? { customChallenge } : {}),
          ...(previousResponseId ? { previousResponseId } : {}),
          systemPromptMode: 'ARC',
          ...(effort ? { reasoningEffort: effort } : {}),
          ...(verbosity ? { reasoningVerbosity: verbosity } : {}),
          ...(summaryType ? { reasoningSummaryType: summaryType } : {}),
        };

        if (promptId === 'custom' && customPrompt.trim()) {
          requestBody.customPrompt = customPrompt.trim();
        }

        const encodedModelKey = encodeURIComponent(modelKey);
        const analysisResponse = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${encodedModelKey}`, requestBody);
        if (!analysisResponse.ok) {
          throw await buildAnalysisError(analysisResponse);
        }
        const analysisData = (await analysisResponse.json()).data;

        const endTime = Date.now();
        const actualTime = Math.round((endTime - startTime) / 1000);
        setAnalysisTimes(prev => ({
          ...prev,
          [modelKey]: actualTime,
        }));

        const explanationToSave = {
          [modelKey]: {
            ...analysisData,
            modelKey,
            actualProcessingTime: actualTime,
          },
        };

        const saveResponse = await apiRequest('POST', `/api/puzzle/save-explained/${taskId}`, { explanations: explanationToSave });
        if (!saveResponse.ok) {
          throw new Error(`Save request failed: ${saveResponse.statusText}`);
        }

        const savedData = (await saveResponse.json()).data;

        removeProcessingModel(modelKey);
        return savedData;
      } catch (error: any) {
        removeProcessingModel(modelKey);
        const cleanMessage = normalizeAnalysisError(error);
        const errorToSet = new Error(cleanMessage);
        setAnalyzerErrors(prev => new Map(prev).set(modelKey, errorToSet));
        throw error;
      }
    },
    onSuccess: () => {
      refetchExplanations();
    },
  });

  const isGPT5ReasoningModel = useCallback(
    (modelKey: string) =>
      ['gpt-5-2025-08-07', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07'].includes(modelKey),
    []
  );

  const analyzeWithModel = useCallback(
    (modelKey: string, supportsTemperature: boolean = true) => {
      setAnalyzerErrors(prev => {
        const next = new Map(prev);
        next.delete(modelKey);
        return next;
      });

      if (canStreamModel(modelKey)) {
        startStreamingAnalysis(modelKey, supportsTemperature);
        return;
      }

      setCurrentModelKey(modelKey);

      const payload = {
        modelKey,
        ...(supportsTemperature ? { temperature, topP, candidateCount } : {}),
        thinkingBudget,
        ...(isGPT5ReasoningModel(modelKey)
          ? {
              reasoningEffort,
              reasoningVerbosity,
              reasoningSummaryType,
            }
          : {}),
      };

      analyzeAndSaveMutation.mutate(payload);
    },
    [
      analyzeAndSaveMutation,
      candidateCount,
      canStreamModel,
      isGPT5ReasoningModel,
      reasoningEffort,
      reasoningSummaryType,
      reasoningVerbosity,
      startStreamingAnalysis,
      thinkingBudget,
      topP,
      temperature,
    ]
  );

  useEffect(() => {
    if (!analyzeAndSaveMutation.isPending && !streamingModelKey && currentModelKey) {
      setCurrentModelKey(null);
    }
  }, [analyzeAndSaveMutation.isPending, streamingModelKey, currentModelKey]);

  return {
    temperature,
    setTemperature,
    topP,
    setTopP,
    candidateCount,
    setCandidateCount,
    thinkingBudget,
    setThinkingBudget,
    promptId,
    setPromptId,
    customPrompt,
    setCustomPrompt,
    analyzeWithModel,
    analyzeAndSaveMutation,
    startStreamingAnalysis,
    currentModelKey,
    processingModels,
    isAnalyzing: analyzeAndSaveMutation.isPending || !!streamingModelKey,
    analyzerErrors,
    analysisStartTime,
    analysisTimes,
    streamingEnabled,
    streamingModelKey,
    streamStatus,
    streamingText: streamingVisibleText,
    streamingReasoning: streamingReasoningText,
    streamingPhase,
    streamingMessage,
    streamingTokenUsage,
    streamError,
    cancelStreamingAnalysis,
    closeStreamingModal,
    canStreamModel,
    reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    isGPT5ReasoningModel,
  };
}

async function buildAnalysisError(response: Response): Promise<Error> {
  try {
    const data = await response.json();
    const message =
      data?.message ||
      data?.error ||
      (response.status === 429
        ? 'Rate limit exceeded. Please wait and try again.'
        : response.status >= 500
          ? 'Server error. Please try again later.'
          : `Request failed (${response.status}). Please try again.`);
    return new Error(message);
  } catch {
    if (response.status === 429) {
      return new Error('Rate limit exceeded. Please wait and try again.');
    }
    if (response.status >= 500) {
      return new Error('Server error. Please try again later.');
    }
    return new Error(`Request failed (${response.status}). Please try again.`);
  }
}

function normalizeAnalysisError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Analysis failed. Please try again.';
  }

  const message = error.message.toLowerCase();
  if (message.includes('rate limit')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }
  if (message.includes('quota') || message.includes('billing')) {
    return 'API quota exceeded. Please check your billing settings.';
  }
  if (message.includes('timeout') || message.includes('network')) {
    return 'Request timed out. Please check your connection and try again.';
  }
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'Authentication error. Please check your API key configuration.';
  }
  if (message.includes('not found') || message.includes('404')) {
    return 'Model or endpoint not found. Please contact support.';
  }
  if (message.includes('server error') || message.includes('500')) {
    return 'Server error occurred. Please try again later.';
  }

  try {
    const jsonMatch = error.message.match(/{\s*.*\s*}/);
    if (jsonMatch) {
      const errorJson = JSON.parse(jsonMatch[0]);
      return errorJson.message || errorJson.error || error.message;
    }
    return error.message.split(':').pop()?.trim() || error.message;
  } catch {
    return error.message;
  }
}
