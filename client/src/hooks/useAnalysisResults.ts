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
  originalExplanation?: any; // For debate mode
  customChallenge?: string; // For debate mode
  previousResponseId?: string; // For conversation chaining
}

// Removed PendingAnalysis type - no longer using optimistic UI

export function useAnalysisResults({
  taskId,
  refetchExplanations,
  emojiSetKey,
  omitAnswer,
  retryMode,
  originalExplanation,
  customChallenge,
  previousResponseId,
}: UseAnalysisResultsProps) {
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.95);
  const [candidateCount, setCandidateCount] = useState(1);
  const [thinkingBudget, setThinkingBudget] = useState(-1); // Default to dynamic thinking
  const [promptId, setPromptId] = useState('solver'); // Default to solver prompt
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null);
  const [processingModels, setProcessingModels] = useState<Set<string>>(new Set());
  const [analyzerErrors, setAnalyzerErrors] = useState<Map<string, Error>>(new Map());
  const [analysisStartTime, setAnalysisStartTime] = useState<Record<string, number>>({});
  const [analysisTimes, setAnalysisTimes] = useState<Record<string, number>>({});
  
  // GPT-5 reasoning parameters
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('high');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('detailed');

  // Removed createOptimisticAnalysis function - no longer using optimistic UI

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
      
      // Record start time for tracking and set processing state
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
          // Debate mode context
          ...(originalExplanation ? { originalExplanation } : {}),
          ...(customChallenge ? { customChallenge } : {}),
          // Conversation chaining support
          ...(previousResponseId ? { previousResponseId } : {}),
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
          // Parse error response to provide clear user feedback
          let errorMessage = 'Analysis request failed';

          try {
            const errorData = await analysisResponse.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }

            // Add helpful context for specific error types
            if (analysisResponse.status === 429) {
              errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (analysisResponse.status === 401 || analysisResponse.status === 403) {
              errorMessage = 'Authentication error. Please check your API key configuration.';
            } else if (analysisResponse.status === 404) {
              errorMessage = 'Model or endpoint not available. Please try a different model.';
            } else if (analysisResponse.status >= 500) {
              errorMessage = 'Server error occurred. Please try again in a few moments.';
            }

            // Add retry suggestion for recoverable errors
            if (errorData.retryable || [429, 503, 504].includes(analysisResponse.status)) {
              errorMessage += ' Please try again in a few moments.';
            }
          } catch (parseError) {
            // Use status-based fallback messages if JSON parsing fails
            if (analysisResponse.status === 429) {
              errorMessage = 'Rate limit exceeded. Please wait and try again.';
            } else if (analysisResponse.status >= 500) {
              errorMessage = 'Server error. Please try again later.';
            } else {
              errorMessage = `Request failed (${analysisResponse.status}). Please try again.`;
            }
          }

          throw new Error(errorMessage);
        }
        const analysisData = (await analysisResponse.json()).data;

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

        // Remove from processing set
        setProcessingModels(prev => {
          const newSet = new Set(prev);
          newSet.delete(modelKey);
          return newSet;
        });

        return savedData;
        
      } catch (error) {
        // Extract user-friendly error message
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

        // Remove from processing set on error
        setProcessingModels(prev => {
          const newSet = new Set(prev);
          newSet.delete(modelKey);
          return newSet;
        });
        

        // Parse and clean up error message for better user experience
        let cleanErrorMessage = 'Analysis failed. Please try again.';

        if (error instanceof Error) {
          // Check for common error patterns and provide user-friendly messages
          const message = error.message.toLowerCase();

          if (message.includes('rate limit') || message.includes('rate-limit')) {
            cleanErrorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          } else if (message.includes('quota') || message.includes('billing')) {
            cleanErrorMessage = 'API quota exceeded. Please check your billing settings.';
          } else if (message.includes('timeout') || message.includes('network')) {
            cleanErrorMessage = 'Request timed out. Please check your connection and try again.';
          } else if (message.includes('unauthorized') || message.includes('forbidden')) {
            cleanErrorMessage = 'Authentication error. Please check your API key configuration.';
          } else if (message.includes('not found') || message.includes('404')) {
            cleanErrorMessage = 'Model or endpoint not found. Please contact support.';
          } else if (message.includes('server error') || message.includes('500')) {
            cleanErrorMessage = 'Server error occurred. Please try again later.';
          } else {
            // Try to extract a clean message from JSON errors or use original
            try {
              const jsonMatch = error.message.match(/{\s*.*\s*}/);
              if (jsonMatch) {
                const errorJson = JSON.parse(jsonMatch[0]);
                cleanErrorMessage = errorJson.message || errorJson.error || error.message;
              } else {
                // Clean up technical prefixes and use original message
                cleanErrorMessage = error.message.split(':').pop()?.trim() || error.message;
              }
            } catch (parseError) {
              cleanErrorMessage = error.message;
            }
          }
        }

        const errorToSet = new Error(cleanErrorMessage);
        setAnalyzerErrors(prev => new Map(prev).set(modelKey, errorToSet));
        
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // On success, refetch all explanations from the database
      refetchExplanations();
    },
    onError: (error, variables) => {
      // Error handling and user feedback are already handled in the mutation function
      // Errors are stored in analyzerErrors state for display in the UI
    }
  });

  // Helper to check if model is GPT-5 reasoning model
  const isGPT5ReasoningModel = (modelKey: string): boolean => {
    return ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(modelKey);
  };

  // Expose a single function to the UI to trigger the process
  const analyzeWithModel = (modelKey: string, supportsTemperature: boolean = true) => {
    // Clear any previous errors for this model on a new attempt
    setAnalyzerErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(modelKey);
      return newMap;
    });

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
    analyzeAndSaveMutation, // Expose mutation for advanced use cases (e.g., debate page needs mutateAsync)
    currentModelKey,
    processingModels,
    isAnalyzing: analyzeAndSaveMutation.isPending,
    analyzerErrors,
    analysisStartTime,
    analysisTimes,
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
