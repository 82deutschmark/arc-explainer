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
  explanations: any[];
  hasExplanation: boolean;
  refetchExplanations: () => void;
}

export function useAnalysisResults({
  taskId,
  explanations,
  hasExplanation,
  refetchExplanations
}: UseAnalysisResultsProps) {
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [temperature, setTemperature] = useState(0.7);

  // Initialize analysis results from existing explanations
  useEffect(() => {
    if (hasExplanation && explanations.length > 0) {
      const initialResults: Record<string, AnalysisResult> = {};
      explanations.forEach(exp => {
        // Use a unique key for each explanation, e.g., model name or a generated ID
        const key = exp.modelName || `explanation-${exp.id}`;
        initialResults[key] = {
          id: exp.id,
          modelKey: exp.modelName,
          patternDescription: exp.patternDescription,
          solvingStrategy: exp.solvingStrategy,
          hints: exp.hints,
          alienMeaning: exp.alienMeaning,
          confidence: exp.confidence,
          explanationId: exp.id,
          helpfulVotes: exp.helpful_votes,
          notHelpfulVotes: exp.not_helpful_votes,
        };
      });
      setAnalysisResults(initialResults);
    }
  }, [explanations, hasExplanation]);

  // Save explained puzzle mutation
  const saveExplainedMutation = useMutation({
    mutationFn: async (explanations: Record<string, AnalysisResult>) => {
      const response = await apiRequest('POST', `/api/puzzle/save-explained/${taskId}`, { explanations });
      const json = await response.json();
      return json.data;
    },
    onSuccess: (saveResponse) => {
      // Backend returns: { success: true, explanationId: number }
      if (saveResponse && saveResponse.explanationId) {
        setAnalysisResults(prev => {
          const updated = { ...prev };
          
          // Update the most recently added explanation with the real ID
          const modelKeys = Object.keys(updated);
          const lastModelKey = modelKeys[modelKeys.length - 1];
          
          if (lastModelKey && updated[lastModelKey]) {
            updated[lastModelKey] = {
              ...updated[lastModelKey],
              explanationId: saveResponse.explanationId,
              id: saveResponse.explanationId
            };
            console.log(`Updated explanation ID for ${lastModelKey} to ${saveResponse.explanationId}`);
          }
          
          return updated;
        });
      } else {
        console.warn('Save response did not contain an explanationId', saveResponse);
      }
      
      refetchExplanations(); // Refetch explanations after saving
    }
  });

  // Test specific model
  const testModelMutation = useMutation({
    mutationFn: async (payload: { modelKey: string; temperature?: number }) => {
      const { modelKey, temperature: temp } = payload;
      const requestPayload = temp !== undefined ? { temperature: temp } : {};
      
      const response = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${modelKey}`, requestPayload);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const json = await response.json();
      return json.data;
    },
    onSuccess: (data: AnalysisResult, variables: { modelKey: string }) => {
      const { modelKey } = variables;
      
      // Add the model key to the result data
      const resultWithModel = { 
        ...data, 
        modelKey,
        explanationId: data.id || 0 // Use the ID from the response data
      };
      
      const newResults = { ...analysisResults, [modelKey]: resultWithModel };
      setAnalysisResults(newResults);
      
      // Auto-save when we have explanations
      if (Object.keys(newResults).length >= 1) {
        saveExplainedMutation.mutate(newResults);
      }
    }
  });

  // Handle analyzing with a specific model
  const analyzeWithModel = (modelKey: string, supportsTemperature: boolean = true) => {
    const payload = {
      modelKey,
      ...(supportsTemperature ? { temperature } : {})
    };
    
    testModelMutation.mutate(payload);
  };

  return {
    analysisResults,
    temperature,
    setTemperature,
    analyzeWithModel,
    isAnalyzing: testModelMutation.isPending,
    analyzerError: testModelMutation.error,
    isSaving: saveExplainedMutation.isPending,
    saveSuccess: saveExplainedMutation.isSuccess,
    saveError: saveExplainedMutation.error
  };
}
