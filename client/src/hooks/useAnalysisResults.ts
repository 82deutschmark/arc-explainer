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
import { AnalysisResult, ModelConfig } from '@/types/puzzle';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';

interface UseAnalysisResultsProps {
  taskId: string;
  refetchExplanations: (options?: any) => void;
}

export function useAnalysisResults({
  taskId,
  refetchExplanations
}: UseAnalysisResultsProps) {
  const [temperature, setTemperature] = useState(0.7);
  const [promptId, setPromptId] = useState('alienCommunication'); // Default to alien communication prompt
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null);
  const [processingModels, setProcessingModels] = useState<Set<string>>(new Set());
  const [analysisStartTime, setAnalysisStartTime] = useState<Record<string, number>>({});
  const [analysisTimes, setAnalysisTimes] = useState<Record<string, number>>({});

  // Mutation to analyze the puzzle and save the explanation in one step
  const analyzeAndSaveMutation = useMutation({
    mutationFn: async (payload: { modelKey: string; temperature?: number }) => {
      const { modelKey, temperature: temp } = payload;
      
      // Record start time for tracking
      const startTime = Date.now();
      setAnalysisStartTime(prev => ({ ...prev, [modelKey]: startTime }));
      setProcessingModels(prev => new Set(prev).add(modelKey));
      
      // 1. Analyze the puzzle
      const analysisResponse = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${modelKey}`, { 
        temperature: temp,
        promptId
      });
      if (!analysisResponse.ok) {
        throw new Error(`Analysis request failed: ${analysisResponse.statusText}`);
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
      setProcessingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelKey);
        return newSet;
      });

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
      return (await saveResponse.json()).data;
    },
    onSuccess: () => {
      // 3. On success, refetch all explanations from the database
      console.log('Analysis and save successful. Refetching explanations...');
      refetchExplanations();
    },
    onError: (error) => {
      console.error('Failed to analyze and save explanation:', error);
      // Optionally, show a toast notification to the user here
    }
  });

  // Helper function to get provider from model key
  const getProviderFromKey = (modelKey: string): string => {
    const model = MODELS.find(m => m.key === modelKey);
    return model?.provider || 'Unknown';
  };

  // Check if any model from the same provider is currently processing
  const isProviderProcessing = (modelKey: string): boolean => {
    const targetProvider = getProviderFromKey(modelKey);
    return Array.from(processingModels).some(key => 
      getProviderFromKey(key) === targetProvider
    );
  };

  // Expose a single function to the UI to trigger the process
  const analyzeWithModel = (modelKey: string, supportsTemperature: boolean = true) => {
    // Check if this provider is already processing
    if (isProviderProcessing(modelKey)) {
      throw new Error(`A ${getProviderFromKey(modelKey)} model is already processing. Please wait for it to complete.`);
    }
    
    const payload = {
      modelKey,
      ...(supportsTemperature ? { temperature } : {})
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
    promptId,
    setPromptId,
    analyzeWithModel,
    currentModelKey,
    processingModels,
    isAnalyzing: analyzeAndSaveMutation.isPending,
    analyzerError: analyzeAndSaveMutation.error,
    analysisStartTime,
    analysisTimes,
    isProviderProcessing,
  };
}
