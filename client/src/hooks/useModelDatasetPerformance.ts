/**
 * 
 * Author: Claude 4 Sonnet
 * Date: 2025-09-26T16:12:25-04:00
 * PURPOSE: React hooks for fetching REAL model dataset performance data from database.
 * Shows which puzzles each model solved, failed, or hasn't attempted on ANY dataset.
 * Dynamic dataset selection - no hardcoded evaluation dataset!
 * Uses proper error handling, loading states, and data fetching patterns.
 * SRP and DRY check: Pass - Single responsibility for model dataset performance data fetching
 */

import { useState, useEffect } from 'react';

export interface ModelDatasetPerformance {
  modelName: string;
  dataset: string;
  solved: string[];
  failed: string[];
  notAttempted: string[];
  summary: {
    solved: number;
    failed: number;
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
export function useModelDatasetPerformance(modelName: string | null, datasetName: string | null): UseModelDatasetPerformanceResult {
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
  }, [modelName, datasetName]);

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
