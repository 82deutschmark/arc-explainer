/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Simple direct API batch analysis hook - NO batch controller complexity!
 *          Works exactly like grok-4-fast-reasoning.ts script:
 *          1. Get puzzle IDs from dataset
 *          2. Fire off direct API calls to /api/puzzle/analyze
 *          3. Track progress in local state
 *          4. Update UI in real-time
 *
 * SRP and DRY check: Pass - Single responsibility: coordinate direct API calls
 * shadcn/ui: N/A - React hook
 */

import { useState, useCallback } from 'react';
import axios from 'axios';

interface PuzzleResult {
  puzzleId: string;
  status: 'pending' | 'analyzing' | 'success' | 'failed';
  correct?: boolean;
  error?: string;
  processingTimeMs?: number;
  analysisId?: number;
}

interface BatchProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  percentage: number;
}

interface BatchAnalysisState {
  isRunning: boolean;
  isPaused: boolean;
  progress: BatchProgress;
  results: PuzzleResult[];
}

interface StartAnalysisParams {
  modelName: string;
  dataset: 'arc1' | 'arc2';
  promptId?: string;
  temperature?: number;
  concurrency?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Get puzzle IDs from dataset directory via API
 */
async function getPuzzleIds(dataset: 'arc1' | 'arc2'): Promise<string[]> {
  const response = await axios.get(`${API_BASE_URL}/api/puzzle/list`);
  if (!response.data.success) {
    throw new Error('Failed to fetch puzzle list');
  }

  const allPuzzles = response.data.data;
  const datasetKey = dataset === 'arc1' ? 'ARC1-Eval' : 'ARC2-Eval';

  return allPuzzles
    .filter((p: any) => p.source === datasetKey)
    .map((p: any) => p.taskId);
}

/**
 * Analyze single puzzle (like script's analyzePuzzle function)
 */
async function analyzeSinglePuzzle(
  puzzleId: string,
  modelName: string,
  options: { promptId?: string; temperature?: number }
): Promise<{ success: boolean; correct?: boolean; error?: string; analysisId?: number; processingTimeMs?: number }> {
  const startTime = Date.now();

  try {
    const requestBody = {
      temperature: options.temperature ?? 0.2,
      promptId: options.promptId ?? 'solver',
      systemPromptMode: 'ARC',
      omitAnswer: true,
      retryMode: false
    };

    const encodedModelKey = encodeURIComponent(modelName);

    // Step 1: Analyze
    const analysisResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`,
      requestBody,
      { timeout: 60 * 60 * 1000 } // 60 minute timeout
    );

    if (!analysisResponse.data.success) {
      throw new Error(analysisResponse.data.message || 'Analysis failed');
    }

    const analysisData = analysisResponse.data.data;

    // Step 2: Save
    const saveResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`,
      {
        explanations: {
          [modelName]: {
            ...analysisData,
            modelKey: modelName
          }
        }
      },
      { timeout: 30000 }
    );

    if (!saveResponse.data.success) {
      throw new Error('Save failed');
    }

    const correct = analysisData.isPredictionCorrect ||
                   analysisData.multiTestAllCorrect ||
                   false;

    return {
      success: true,
      correct,
      analysisId: saveResponse.data.data?.id,
      processingTimeMs: Date.now() - startTime
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Unknown error',
      processingTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Hook for direct batch analysis (no batch controller!)
 */
export function useDirectBatchAnalysis() {
  const [state, setState] = useState<BatchAnalysisState>({
    isRunning: false,
    isPaused: false,
    progress: {
      total: 0,
      completed: 0,
      successful: 0,
      failed: 0,
      percentage: 0
    },
    results: []
  });

  const handleStart = useCallback(async (params: StartAnalysisParams) => {
    const { modelName, dataset, promptId, temperature, concurrency = 2 } = params;

    // Get puzzle IDs
    const puzzleIds = await getPuzzleIds(dataset);

    // Initialize state
    setState({
      isRunning: true,
      isPaused: false,
      progress: {
        total: puzzleIds.length,
        completed: 0,
        successful: 0,
        failed: 0,
        percentage: 0
      },
      results: puzzleIds.map(id => ({ puzzleId: id, status: 'pending' }))
    });

    // Worker pool pattern (like script)
    let index = 0;
    const results: PuzzleResult[] = new Array(puzzleIds.length);

    async function worker() {
      while (true) {
        const current = index++;
        if (current >= puzzleIds.length) break;

        const puzzleId = puzzleIds[current];

        // Update status to analyzing
        setState(prev => ({
          ...prev,
          results: prev.results.map((r, i) =>
            i === current ? { ...r, status: 'analyzing' } : r
          )
        }));

        // Analyze puzzle
        const result = await analyzeSinglePuzzle(puzzleId, modelName, {
          promptId,
          temperature
        });

        // Update result
        const newResult: PuzzleResult = {
          puzzleId,
          status: result.success ? 'success' : 'failed',
          correct: result.correct,
          error: result.error,
          processingTimeMs: result.processingTimeMs,
          analysisId: result.analysisId
        };

        results[current] = newResult;

        // Update state
        setState(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            completed: prev.progress.completed + 1,
            successful: prev.progress.successful + (result.success ? 1 : 0),
            failed: prev.progress.failed + (result.success ? 0 : 1),
            percentage: Math.round(((prev.progress.completed + 1) / prev.progress.total) * 100)
          },
          results: prev.results.map((r, i) => i === current ? newResult : r)
        }));

        // Small delay to avoid bursts
        if (current < puzzleIds.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // Start worker pool
    const workers = Array.from(
      { length: Math.min(concurrency, puzzleIds.length) },
      () => worker()
    );

    await Promise.all(workers);

    // Mark as complete
    setState(prev => ({
      ...prev,
      isRunning: false
    }));

  }, []);

  const handlePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const handleResume = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const handleCancel = useCallback(() => {
    setState({
      isRunning: false,
      isPaused: false,
      progress: {
        total: 0,
        completed: 0,
        successful: 0,
        failed: 0,
        percentage: 0
      },
      results: []
    });
  }, []);

  return {
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    progress: state.progress,
    results: state.results,
    handleStart,
    handlePause,
    handleResume,
    handleCancel
  };
}
