/**
 * AnalysisContext.tsx
 * 
 * React context provider for shared analysis state management.
 * Provides centralized state for puzzle analysis across the application.
 * Integrates with useAnalysisResult and useBatchSession hooks.
 * 
 * @author Claude Code (Phase 4 refactor)
 */

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { useAnalysisResults } from '../hooks/useAnalysisResults';
import { useBatchSession, type BatchSessionConfig } from '../hooks/useBatchSession';

export interface AnalysisConfig {

  temperature: number;

  topP: number;

  candidateCount: number;

  thinkingBudget: number;

  promptId: string;

  customPrompt: string;

  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';

  reasoningVerbosity: 'low' | 'medium' | 'high';

  reasoningSummaryType: 'auto' | 'detailed';

}



// Combined analysis context state
export interface AnalysisContextState {
  // Single analysis state
  singleAnalysis: {
    config: AnalysisConfig;
    currentModelKey: string | null;
    processingModels: Set<string>;
    analysisStartTime: Record<string, number>;
    analysisTimes: Record<string, number>;
    isAnalyzing: boolean;
    error: Error | null;
  };
  
  // Batch analysis state
  batchAnalysis: {
    sessionId: string | null;
    isRunning: boolean;
    isCompleted: boolean;
    isPaused: boolean;
    progressPercentage: number;
    hasActiveSession: boolean;
  };
}

// Context actions interface
export interface AnalysisContextActions {
  // Single analysis actions
  analyzeWithModel: (modelKey: string, supportsTemperature?: boolean) => void;
  updateAnalysisConfig: (updates: Partial<AnalysisConfig>) => void;
  isGPT5ReasoningModel: (modelKey: string) => boolean;
  
  // Batch analysis actions
  createBatchSession: (config: BatchSessionConfig) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  pauseBatchSession: () => Promise<{ success: boolean; error?: string }>;
  resumeBatchSession: () => Promise<{ success: boolean; error?: string }>;
  cancelBatchSession: () => Promise<{ success: boolean; error?: string }>;
  clearBatchSession: () => void;
}

// Combined context interface
export interface AnalysisContextValue extends AnalysisContextState, AnalysisContextActions {}

// Create context
const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// Context provider props
export interface AnalysisProviderProps {
  children: ReactNode;
  taskId?: string; // For single analysis
  onAnalysisComplete?: (result: any) => void;
  refetchExplanations?: (options?: any) => void;
}

// Context provider component
export function AnalysisProvider({ 
  children, 
  taskId, 
  onAnalysisComplete, 
  refetchExplanations 
}: AnalysisProviderProps) {
  const safeRefetch = refetchExplanations ?? (() => {});

  const singleAnalysis = useAnalysisResults({
    taskId: taskId ?? '',
    refetchExplanations: safeRefetch,
  });
  const batchSession = useBatchSession();

  const aggregatedError = singleAnalysis.analyzerErrors.size > 0
    ? singleAnalysis.analyzerErrors.values().next().value ?? null
    : null;

  const analysisConfig: AnalysisConfig = {
    temperature: singleAnalysis.temperature,
    topP: singleAnalysis.topP,
    candidateCount: singleAnalysis.candidateCount,
    thinkingBudget: singleAnalysis.thinkingBudget,
    promptId: singleAnalysis.promptId,
    customPrompt: singleAnalysis.customPrompt,
    reasoningEffort: singleAnalysis.reasoningEffort,
    reasoningVerbosity: singleAnalysis.reasoningVerbosity,
    reasoningSummaryType: singleAnalysis.reasoningSummaryType,
  };

  const state: AnalysisContextState = {
    singleAnalysis: {
      config: analysisConfig,
      currentModelKey: singleAnalysis.currentModelKey || null,
      processingModels: singleAnalysis.processingModels,
      analysisStartTime: singleAnalysis.analysisStartTime,
      analysisTimes: singleAnalysis.analysisTimes,
      isAnalyzing: singleAnalysis.isAnalyzing,
      error: aggregatedError,
    },
    batchAnalysis: {
      sessionId: batchSession.sessionId,
      isRunning: batchSession.isRunning,
      isCompleted: batchSession.isCompleted,
      isPaused: batchSession.isPaused,
      progressPercentage: batchSession.progressPercentage,
      hasActiveSession: batchSession.hasActiveSession,
    },
  };

  // Combined actions
  const actions: AnalysisContextActions = {
    // Single analysis actions
    analyzeWithModel: useCallback((modelKey: string, supportsTemperature = true) => {
      if (!taskId) {
        return;
      }
      singleAnalysis.analyzeWithModel(modelKey, supportsTemperature);
    }, [singleAnalysis, taskId]),

    updateAnalysisConfig: useCallback((updates: Partial<AnalysisConfig>) => {
      if (updates.temperature !== undefined) {
        singleAnalysis.setTemperature(updates.temperature);
      }
      if (updates.topP !== undefined) {
        singleAnalysis.setTopP(updates.topP);
      }
      if (updates.candidateCount !== undefined) {
        singleAnalysis.setCandidateCount(updates.candidateCount);
      }
      if (updates.thinkingBudget !== undefined) {
        singleAnalysis.setThinkingBudget(updates.thinkingBudget);
      }
      if (updates.promptId !== undefined) {
        singleAnalysis.setPromptId(updates.promptId);
      }
      if (updates.customPrompt !== undefined) {
        singleAnalysis.setCustomPrompt(updates.customPrompt);
      }
      if (updates.reasoningEffort !== undefined) {
        singleAnalysis.setReasoningEffort(updates.reasoningEffort);
      }
      if (updates.reasoningVerbosity !== undefined) {
        singleAnalysis.setReasoningVerbosity(updates.reasoningVerbosity);
      }
      if (updates.reasoningSummaryType !== undefined) {
        singleAnalysis.setReasoningSummaryType(updates.reasoningSummaryType);
      }
    }, [singleAnalysis]),

    isGPT5ReasoningModel: useCallback((modelKey: string) => {
      return singleAnalysis.isGPT5ReasoningModel(modelKey);
    }, [singleAnalysis]),

    // Batch analysis actions
    createBatchSession: useCallback(async (config: BatchSessionConfig) => {
      return await batchSession.createSession(config);
    }, [batchSession]),

    pauseBatchSession: useCallback(async () => {
      return await batchSession.pauseSession();
    }, [batchSession]),

    resumeBatchSession: useCallback(async () => {
      return await batchSession.resumeSession();
    }, [batchSession]),

    cancelBatchSession: useCallback(async () => {
      return await batchSession.cancelSession();
    }, [batchSession]),

    clearBatchSession: useCallback(() => {
      batchSession.clearSession();
    }, [batchSession]),
  };

  // Combined context value
  const contextValue: AnalysisContextValue = {
    ...state,
    ...actions
  };

  return (
    <AnalysisContext.Provider value={contextValue}>
      {children}
    </AnalysisContext.Provider>
  );
}

// Context hook
export function useAnalysisContext(): AnalysisContextValue {
  const context = useContext(AnalysisContext);
  
  if (!context) {
    throw new Error('useAnalysisContext must be used within an AnalysisProvider');
  }
  
  return context;
}

// Specialized hooks for specific parts of the context
export function useSingleAnalysisContext() {
  const { singleAnalysis, analyzeWithModel, updateAnalysisConfig, isGPT5ReasoningModel } = useAnalysisContext();
  
  return {
    ...singleAnalysis,
    analyzeWithModel,
    updateAnalysisConfig,
    isGPT5ReasoningModel
  };
}

export function useBatchAnalysisContext() {
  const { 
    batchAnalysis, 
    createBatchSession, 
    pauseBatchSession, 
    resumeBatchSession, 
    cancelBatchSession, 
    clearBatchSession 
  } = useAnalysisContext();
  
  return {
    ...batchAnalysis,
    createBatchSession,
    pauseBatchSession,
    resumeBatchSession,
    cancelBatchSession,
    clearBatchSession
  };
}

// Default export for convenience
export default AnalysisProvider;
