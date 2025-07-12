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
import { AnalysisResult } from '@/types/puzzle';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface UseAnalysisResultsProps {
  taskId: string;
  refetchExplanations: (options?: any) => void;
}

export function useAnalysisResults({
  taskId,
  refetchExplanations
}: UseAnalysisResultsProps) {
  const [temperature, setTemperature] = useState(0.7);

  // Mutation to analyze the puzzle and save the explanation in one step
  const analyzeAndSaveMutation = useMutation({
    mutationFn: async (payload: { modelKey: string; temperature?: number }) => {
      const { modelKey, temperature: temp } = payload;
      
      // 1. Analyze the puzzle
      const analysisResponse = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${modelKey}`, { temperature: temp });
      if (!analysisResponse.ok) {
        throw new Error(`Analysis request failed: ${analysisResponse.statusText}`);
      }
      const analysisData = (await analysisResponse.json()).data;

      // 2. Save the new explanation to the database
      const explanationToSave = {
        [modelKey]: { ...analysisData, modelKey }
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

  // Expose a single function to the UI to trigger the process
  const analyzeWithModel = (modelKey: string, supportsTemperature: boolean = true) => {
    const payload = {
      modelKey,
      ...(supportsTemperature ? { temperature } : {})
    };
    analyzeAndSaveMutation.mutate(payload);
  };

  return {
    temperature,
    setTemperature,
    analyzeWithModel,
    isAnalyzing: analyzeAndSaveMutation.isPending,
    analyzerError: analyzeAndSaveMutation.error,
  };
}
