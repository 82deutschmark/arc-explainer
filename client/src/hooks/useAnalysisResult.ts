/**
 * useAnalysisResult.ts
 * 
 * Consolidated custom hook for single analysis state management.
 * Replaces and improves upon useAnalysisResults with better separation of concerns.
 * Focuses on single puzzle analysis with enhanced state management.
 * 
 * @author Claude Code (Phase 4 refactor)
 */

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface AnalysisConfig {
  temperature: number;
  topP: number;
  candidateCount: number;
  promptId: string;
  customPrompt: string;
  emojiSetKey?: string;
  omitAnswer?: boolean;
  retryMode?: boolean;
  // GPT-5 reasoning parameters
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  reasoningVerbosity: 'low' | 'medium' | 'high';
  reasoningSummaryType: 'auto' | 'detailed';
}

export interface AnalysisState {
  currentModelKey: string | null;
  processingModels: Set<string>;
  analysisStartTime: Record<string, number>;
  analysisTimes: Record<string, number>;
  isAnalyzing: boolean;
  error: Error | null;
}

export interface UseAnalysisResultProps {
  taskId: string;
  onAnalysisComplete?: (result: any) => void;
  refetchExplanations?: (options?: any) => void;
}

export function useAnalysisResult({ taskId, onAnalysisComplete, refetchExplanations }: UseAnalysisResultProps) {
  // Analysis configuration state
  const [config, setConfig] = useState<AnalysisConfig>({
    temperature: 0.2,
    topP: 0.95,
    candidateCount: 1,
    promptId: 'solver',
    customPrompt: '',
    reasoningEffort: 'low',
    reasoningVerbosity: 'high',
    reasoningSummaryType: 'detailed'
  });

  // Analysis execution state
  const [state, setState] = useState<AnalysisState>({
    currentModelKey: null,
    processingModels: new Set(),
    analysisStartTime: {},
    analysisTimes: {},
    isAnalyzing: false,
    error: null
  });

  // Mutation for analysis and save operation
  const analysisMutation = useMutation({
    mutationFn: async (payload: { 
      modelKey: string; 
      supportsTemperature: boolean;
    }) => {
      const { modelKey, supportsTemperature } = payload;
      
      // Record start time
      const startTime = Date.now();
      setState(prev => ({
        ...prev,
        analysisStartTime: { ...prev.analysisStartTime, [modelKey]: startTime },
        processingModels: new Set(prev.processingModels).add(modelKey),
        currentModelKey: modelKey,
        isAnalyzing: true,
        error: null
      }));
      
      // Build request body
      const requestBody: any = { 
        promptId: config.promptId,
        systemPromptMode: config.promptId === 'custom' ? 'None' : 'ARC', // Use 'None' for custom prompts to respect NO system prompt requirement
        ...(config.emojiSetKey ? { emojiSetKey: config.emojiSetKey } : {}),
        ...(typeof config.omitAnswer === 'boolean' ? { omitAnswer: config.omitAnswer } : {}),
        ...(config.retryMode ? { retryMode: config.retryMode } : {}),
      };

      // Include temperature settings if supported
      if (supportsTemperature) {
        requestBody.temperature = config.temperature;
        requestBody.topP = config.topP;
        requestBody.candidateCount = config.candidateCount;
      }
      
      // Include custom prompt if selected
      if (config.promptId === "custom" && config.customPrompt.trim()) {
        requestBody.customPrompt = config.customPrompt.trim();
      }
      
      // Include reasoning parameters for GPT-5 models
      if (isGPT5ReasoningModel(modelKey)) {
        requestBody.reasoningEffort = config.reasoningEffort;
        requestBody.reasoningVerbosity = config.reasoningVerbosity;
        requestBody.reasoningSummaryType = config.reasoningSummaryType;
      }
      
      // 1. Analyze the puzzle
      const encodedModelKey = encodeURIComponent(modelKey);
      const analysisResponse = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${encodedModelKey}`, requestBody);
      
      if (!analysisResponse.ok) {
        throw new Error(`Analysis request failed: ${analysisResponse.statusText}`);
      }
      
      const analysisData = (await analysisResponse.json()).data;

      // Calculate processing time
      const endTime = Date.now();
      const actualTime = Math.round((endTime - startTime) / 1000);
      
      // 2. Save explanation to database
      const explanationToSave = {
        [modelKey]: { 
          ...analysisData, 
          modelKey,
          actualProcessingTime: actualTime
        }
      };
      
      const saveResponse = await apiRequest('POST', `/api/puzzle/save-explained/${taskId}`, { 
        explanations: explanationToSave 
      });
      
      if (!saveResponse.ok) {
        throw new Error(`Save request failed: ${saveResponse.statusText}`);
      }
      
      const saveData = (await saveResponse.json()).data;
      
      return { analysisData, saveData, actualTime, modelKey };
    },
    onSuccess: (result) => {
      const { actualTime, modelKey } = result;
      
      // Update state with completion data
      setState(prev => ({
        ...prev,
        analysisTimes: { ...prev.analysisTimes, [modelKey]: actualTime },
        processingModels: new Set([...prev.processingModels].filter(m => m !== modelKey)),
        isAnalyzing: false,
        currentModelKey: null
      }));
      
      // Trigger callbacks
      onAnalysisComplete?.(result);
      refetchExplanations?.();
    },
    onError: (error) => {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error as Error,
        currentModelKey: null
      }));
      console.error('Analysis failed:', error);
    }
  });

  // Helper to check if model is GPT-5 reasoning model
  const isGPT5ReasoningModel = useCallback((modelKey: string): boolean => {
    return ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(modelKey);
  }, []);

  // Main analysis function
  const analyzeWithModel = useCallback((modelKey: string, supportsTemperature: boolean = true) => {
    analysisMutation.mutate({ modelKey, supportsTemperature });
  }, [analysisMutation]);

  // Configuration update functions
  const updateConfig = useCallback((updates: Partial<AnalysisConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const setTemperature = useCallback((temperature: number) => {
    updateConfig({ temperature });
  }, [updateConfig]);

  const setTopP = useCallback((topP: number) => {
    updateConfig({ topP });
  }, [updateConfig]);

  const setCandidateCount = useCallback((candidateCount: number) => {
    updateConfig({ candidateCount });
  }, [updateConfig]);

  const setPromptId = useCallback((promptId: string) => {
    updateConfig({ promptId });
  }, [updateConfig]);

  const setCustomPrompt = useCallback((customPrompt: string) => {
    updateConfig({ customPrompt });
  }, [updateConfig]);

  const setReasoningEffort = useCallback((reasoningEffort: AnalysisConfig['reasoningEffort']) => {
    updateConfig({ reasoningEffort });
  }, [updateConfig]);

  const setReasoningVerbosity = useCallback((reasoningVerbosity: AnalysisConfig['reasoningVerbosity']) => {
    updateConfig({ reasoningVerbosity });
  }, [updateConfig]);

  const setReasoningSummaryType = useCallback((reasoningSummaryType: AnalysisConfig['reasoningSummaryType']) => {
    updateConfig({ reasoningSummaryType });
  }, [updateConfig]);

  // Reset processing models on unmount or when analysis completes
  useEffect(() => {
    if (!analysisMutation.isPending && state.currentModelKey) {
      setState(prev => ({ ...prev, currentModelKey: null }));
    }
  }, [analysisMutation.isPending]);

  return {
    // Configuration
    config,
    updateConfig,
    temperature: config.temperature,
    setTemperature,
    topP: config.topP,
    setTopP,
    candidateCount: config.candidateCount,
    setCandidateCount,
    promptId: config.promptId,
    setPromptId,
    customPrompt: config.customPrompt,
    setCustomPrompt,
    reasoningEffort: config.reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity: config.reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType: config.reasoningSummaryType,
    setReasoningSummaryType,
    
    // State
    currentModelKey: state.currentModelKey,
    processingModels: state.processingModels,
    analysisStartTime: state.analysisStartTime,
    analysisTimes: state.analysisTimes,
    isAnalyzing: state.isAnalyzing,
    analyzerError: state.error,
    
    // Actions
    analyzeWithModel,
    isGPT5ReasoningModel,
    
    // Legacy compatibility (for gradual migration)
    error: analysisMutation.error
  };
}