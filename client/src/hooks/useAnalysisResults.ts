/**
 * useAnalysisResults.ts
 * 
 * @author Cascade
 * @description This hook manages the logic for analyzing a puzzle with a selected AI model.
 * It follows a database-first approach: when a user requests an analysis,
 * the hook calls the backend to get the explanation, immediately saves it to the database,
 * and then triggers a refetch of all explanations for the puzzle.
 * This ensures the UI is always in sync with the database, which acts as the single source of truth.
 */

/**
 * useAnalysisResults Hook
 * Custom hook for managing AI model analysis results
 * Handles state management and API interaction for puzzle analysis
 * Author: Cascade
 */

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Explanation } from '@shared/types';
import type { ExplanationData } from '@/types/puzzle';

interface UseAnalysisResultsProps {
  taskId: string;
  refetchExplanations: (options?: any) => void;
  // Analysis options passed from UI state
  // emojiSetKey selects which emoji palette server-side prompt builder uses
  // omitAnswer tells prompt builder to omit the "Correct Answer" portion in the test case section
  emojiSetKey?: string;
  omitAnswer?: boolean;
  // systemPromptMode removed - now using modular architecture (hardcoded to 'ARC')
  retryMode?: boolean; // Enhanced prompting for retry analysis
}

// Type for pending analysis results (ExplanationData with optimistic fields)
type PendingAnalysis = ExplanationData & {
  isOptimistic: true; // Always true for pending results
  status: 'analyzing' | 'saving' | 'completed' | 'error'; // Required for pending results
};

export function useAnalysisResults({
  taskId,
  refetchExplanations,
  emojiSetKey,
  omitAnswer,
  retryMode,
}: UseAnalysisResultsProps) {
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.95);
  const [candidateCount, setCandidateCount] = useState(1);
  const [thinkingBudget, setThinkingBudget] = useState(-1); // Default to dynamic thinking
  const [promptId, setPromptId] = useState('solver'); // Default to solver prompt
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null);
  const [processingModels, setProcessingModels] = useState<Set<string>>(new Set());
  const [analysisStartTime, setAnalysisStartTime] = useState<Record<string, number>>({});
  const [analysisTimes, setAnalysisTimes] = useState<Record<string, number>>({});
  
  // Optimistic UI state
  const [pendingAnalyses, setPendingAnalyses] = useState<Map<string, PendingAnalysis>>(new Map());
  
  // GPT-5 reasoning parameters
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('detailed');

  // Helper function to create optimistic analysis result
  const createOptimisticAnalysis = (modelKey: string): PendingAnalysis => ({
    id: Date.now(), // Temporary numeric ID
    modelName: modelKey,
    puzzleId: taskId,
    status: 'analyzing',
    startTime: Date.now(),
    isOptimistic: true,
    // Initialize empty values that will be populated during analysis
    patternDescription: '',
    solvingStrategy: '',
    hints: [],
    alienMeaning: '',
    confidence: 0,
    helpfulVotes: 0,
    notHelpfulVotes: 0,
    apiProcessingTimeMs: 0,
    createdAt: new Date().toISOString(),
  });

  // Mutation to analyze the puzzle and save the explanation in one step
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
      const { modelKey, temperature: temp, topP: p, candidateCount: c, thinkingBudget: tb, reasoningEffort: effort, reasoningVerbosity: verbosity, reasoningSummaryType: summaryType } = payload;
      
      // Create optimistic analysis result immediately
      const optimisticAnalysis = createOptimisticAnalysis(modelKey);
      setPendingAnalyses(prev => new Map(prev).set(modelKey, optimisticAnalysis));
      
      // Record start time for tracking
      const startTime = Date.now();
      setAnalysisStartTime(prev => ({ ...prev, [modelKey]: startTime }));
      setProcessingModels(prev => new Set(prev).add(modelKey));
      
      try {
        // 1. Analyze the puzzle
        const requestBody: any = { 
          temperature: temp,
          promptId,
          ...(p ? { topP: p } : {}),
          ...(c ? { candidateCount: c } : {}),
          ...(typeof tb === 'number' ? { thinkingBudget: tb } : {}),
          // Analysis options forwarded end-to-end
          ...(emojiSetKey ? { emojiSetKey } : {}),
          ...(typeof omitAnswer === 'boolean' ? { omitAnswer } : {}),
          ...(retryMode ? { retryMode } : {}),
          systemPromptMode: 'ARC', // Hardcoded to use new modular architecture
          // GPT-5 reasoning parameters
          ...(effort ? { reasoningEffort: effort } : {}),
          ...(verbosity ? { reasoningVerbosity: verbosity } : {}),
          ...(summaryType ? { reasoningSummaryType: summaryType } : {}),
        };
        
        // Include custom prompt if "custom" is selected and customPrompt is provided
        if (promptId === "custom" && customPrompt.trim()) {
          requestBody.customPrompt = customPrompt.trim();
        }
        
        // URL-encode model key to handle OpenRouter provider/model format (e.g., qwen/qwen-2.5-coder-32b-instruct)
        const encodedModelKey = encodeURIComponent(modelKey);
        const analysisResponse = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${encodedModelKey}`, requestBody);
        if (!analysisResponse.ok) {
          // Parse error response to get user-friendly message
          let errorMessage = `Analysis request failed: ${analysisResponse.statusText}`;
          try {
            const errorData = await analysisResponse.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            }
            // Add retry suggestion for rate-limited or service unavailable errors
            if (errorData.retryable) {
              errorMessage += ' Please try again in a few moments.';
            }
          } catch (e) {
            // Keep default error message if JSON parsing fails
          }
          throw new Error(errorMessage);
        }
        const analysisData = (await analysisResponse.json()).data;

        // Update optimistic result with analysis data
        setPendingAnalyses(prev => {
          const current = prev.get(modelKey);
          if (current) {
            return new Map(prev).set(modelKey, {
              ...current,
              ...analysisData,
              status: 'saving',
              apiProcessingTimeMs: Date.now() - startTime,
            });
          }
          return prev;
        });

        // Calculate actual processing time
        const endTime = Date.now();
        const actualTime = Math.round((endTime - startTime) / 1000); // Convert to seconds
        
        // Store actual processing time and remove from processing set
        setAnalysisTimes(prev => ({
          ...prev,
          [modelKey]: actualTime
        }));

        // 2. Save the new explanation to the database
        const explanationToSave = {
          [modelKey]: { 
            ...analysisData, 
            modelKey,
            actualProcessingTime: actualTime // Include timing data with explanation
          }
        };
        
        const saveResponse = await apiRequest('POST', `/api/puzzle/save-explained/${taskId}`, { explanations: explanationToSave });
        if (!saveResponse.ok) {
          throw new Error(`Save request failed: ${saveResponse.statusText}`);
        }
        
        const savedData = (await saveResponse.json()).data;
        
        // Mark optimistic result as completed
        setPendingAnalyses(prev => {
          const current = prev.get(modelKey);
          if (current) {
            return new Map(prev).set(modelKey, {
              ...current,
              status: 'completed',
            });
          }
          return prev;
        });
        
        setProcessingModels(prev => {
          const newSet = new Set(prev);
          newSet.delete(modelKey);
          return newSet;
        });
        
        return savedData;
        
      } catch (error) {
        // Extract user-friendly error message
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
        
        // Update optimistic result with error
        setPendingAnalyses(prev => {
          const current = prev.get(modelKey);
          if (current) {
            return new Map(prev).set(modelKey, {
              ...current,
              status: 'error',
              error: errorMessage,
              isRetryable: errorMessage.includes('rate-limited') || 
                          errorMessage.includes('unavailable') ||
                          errorMessage.includes('try again')
            });
          }
          return prev;
        });
        
        setProcessingModels(prev => {
          const newSet = new Set(prev);
          newSet.delete(modelKey);
          return newSet;
        });
        
        // Log error details for debugging while showing user-friendly message to user
        console.error('Analysis failed:', {
          modelKey,
          error: error instanceof Error ? error.message : String(error),
          taskId
        });
        
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // 3. On success, refetch all explanations from the database
      console.log('Analysis and save successful. Refetching explanations...');
      refetchExplanations();
      
      // Remove the optimistic result after a delay to allow for smooth transition
      setTimeout(() => {
        setPendingAnalyses(prev => {
          const newMap = new Map(prev);
          newMap.delete(variables.modelKey);
          return newMap;
        });
      }, 1000); // 1 second delay for smooth UX
    },
    onError: (error, variables) => {
      console.error('Failed to analyze and save explanation:', error);
      // Error handling is already done in the mutation function
      // The optimistic result will show error state
    }
  });

  // Helper to check if model is GPT-5 reasoning model
  const isGPT5ReasoningModel = (modelKey: string): boolean => {
    return ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(modelKey);
  };

  // Expose a single function to the UI to trigger the process
  const analyzeWithModel = (modelKey: string, supportsTemperature: boolean = true) => {
    // Removed provider restriction - now allows concurrent requests to same provider
    
    // Set current model key to show reasoning controls for GPT-5 models
    setCurrentModelKey(modelKey);
    
    const payload: any = {
      modelKey,
      ...(supportsTemperature ? { temperature, topP, candidateCount } : {}),
      thinkingBudget, // Always include for Gemini models
      // Include reasoning parameters only for GPT-5 models
      ...(isGPT5ReasoningModel(modelKey) ? {
        reasoningEffort,
        reasoningVerbosity,
        reasoningSummaryType
      } : {})
    };
    
    analyzeAndSaveMutation.mutate(payload);
  };

  // Reset current model when analysis completes or errors
  useEffect(() => {
    if (!analyzeAndSaveMutation.isPending && currentModelKey) {
      setCurrentModelKey(null);
    }
  }, [analyzeAndSaveMutation.isPending]);

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
    currentModelKey,
    processingModels,
    isAnalyzing: analyzeAndSaveMutation.isPending,
    analyzerError: analyzeAndSaveMutation.error,
    analysisStartTime,
    analysisTimes,
    // Optimistic UI state
    pendingAnalyses: Array.from(pendingAnalyses.values()),
    // GPT-5 reasoning parameters
    reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    isGPT5ReasoningModel,
  };
}
