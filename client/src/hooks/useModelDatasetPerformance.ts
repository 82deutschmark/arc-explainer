/**
 * 
 * Author: Cascade
 * Date: 2025-10-10 (Fixed critical terminology error)
 * PURPOSE: React hooks for fetching REAL model dataset performance data from database.
 * Shows which puzzles each model got correct, incorrect, or hasn't attempted on ANY dataset.
 * Dynamic dataset selection - no hardcoded evaluation dataset!
 * TERMINOLOGY FIX: Now correctly uses 'correct/incorrect' matching backend (not 'solved/failed')
 * Uses proper error handling, loading states, and data fetching patterns.
 * SRP and DRY check: Pass - Single responsibility for model dataset performance data fetching
 */

import { useState, useEffect } from 'react';

export interface ModelDatasetPerformance {
  modelName: string;
  dataset: string;
  correct: string[];     // Puzzles with correct predictions
  incorrect: string[];   // Puzzles with incorrect predictions
  notAttempted: string[];
  summary: {
    correct: number;     // Count of correct predictions
    incorrect: number;   // Count of incorrect predictions
    notAttempted: number;
    totalPuzzles: number;
  };
}

export interface DatasetInfo {
  name: string;
  puzzleCount: number;
  path: string;
}

interface UseModelDatasetPerformanceResult {
  performance: ModelDatasetPerformance | null;
  loading: boolean;
  error: string | null;
}

interface UseAvailableModelsResult {
  models: string[];
  loading: boolean;
  error: string | null;
}

interface UseAvailableDatasetsResult {
  datasets: DatasetInfo[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for fetching model performance on ANY dataset - completely dynamic!
 */
// Update: add optional refreshKey so callers can force a refetch without changing model/dataset
export function useModelDatasetPerformance(modelName: string | null, datasetName: string | null, refreshKey: number = 0): UseModelDatasetPerformanceResult {
  const [performance, setPerformance] = useState<ModelDatasetPerformance | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelName || !datasetName) {
      setPerformance(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchPerformance() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/model-dataset/performance/${encodeURIComponent(modelName || '')}/${encodeURIComponent(datasetName || '')}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Backend already returns correct/incorrect - no mapping needed
          setPerformance(data.data);
        } else {
          throw new Error(data.message || 'Failed to fetch model performance');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setPerformance(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPerformance();
    // Add refreshKey to dependencies so callers can refetch on demand
  }, [modelName, datasetName, refreshKey]);

  return { performance, loading, error };
}

/**
 * Hook for fetching available models list from database
 */
export function useAvailableModels(): UseAvailableModelsResult {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModels() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/model-dataset/models');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setModels(data.data);
        } else {
          throw new Error(data.message || 'Failed to fetch available models');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setModels([]);
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, []);

  return { models, loading, error };
}

/**
 * Hook for fetching available datasets (dynamic discovery from data/ directory)
 */
export function useAvailableDatasets(): UseAvailableDatasetsResult {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDatasets() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/model-dataset/datasets');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setDatasets(data.data);
        } else {
          throw new Error(data.message || 'Failed to fetch available datasets');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setDatasets([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDatasets();
  }, []);

  return { datasets, loading, error };
}
