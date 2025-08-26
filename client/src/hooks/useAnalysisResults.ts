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
  // Analysis options passed from UI state
  // emojiSetKey selects which emoji palette server-side prompt builder uses
  // omitAnswer tells prompt builder to omit the "Correct Answer" portion in the test case section
  emojiSetKey?: string;
  omitAnswer?: boolean;
  // systemPromptMode removed - now using modular architecture (hardcoded to 'ARC')
}

export function useAnalysisResults({
  taskId,
  refetchExplanations,
  emojiSetKey,
  omitAnswer,
}: UseAnalysisResultsProps) {
  const [temperature, setTemperature] = useState(0.2);
  const [promptId, setPromptId] = useState('solver'); // Default to solver prompt
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null);
  const [processingModels, setProcessingModels] = useState<Set<string>>(new Set());
  const [analysisStartTime, setAnalysisStartTime] = useState<Record<string, number>>({});
  const [analysisTimes, setAnalysisTimes] = useState<Record<string, number>>({});
  
  // GPT-5 reasoning parameters
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('detailed');

  // Mutation to analyze the puzzle and save the explanation in one step
  const analyzeAndSaveMutation = useMutation({
    mutationFn: async (payload: { 
      modelKey: string; 
      temperature?: number; 
      reasoningEffort?: string; 
      reasoningVerbosity?: string; 
      reasoningSummaryType?: string; 
    }) => {
      const { modelKey, temperature: temp, reasoningEffort: effort, reasoningVerbosity: verbosity, reasoningSummaryType: summaryType } = payload;
      
      // Record start time for tracking
      const startTime = Date.now();
      setAnalysisStartTime(prev => ({ ...prev, [modelKey]: startTime }));
      setProcessingModels(prev => new Set(prev).add(modelKey));
      
      // 1. Analyze the puzzle
      const requestBody: any = { 
        temperature: temp,
        promptId,
        // Analysis options forwarded end-to-end
        ...(emojiSetKey ? { emojiSetKey } : {}),
        ...(typeof omitAnswer === 'boolean' ? { omitAnswer } : {}),
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
      
      const analysisResponse = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${modelKey}`, requestBody);
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
      ...(supportsTemperature ? { temperature } : {}),
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
