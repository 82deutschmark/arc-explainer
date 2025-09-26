/**
 * 
 * Author: Cascade using Claude 4 Sonnet
 * Date: 2025-09-26T15:35:26-04:00
 * PURPOSE: React hook for fetching REAL model dataset performance data from database.
 * Shows which ARC evaluation puzzles each model solved, failed, or hasn't attempted.
 * Based on is_prediction_correct and multi_test_all_correct database fields.
 * SRP and DRY check: Pass - Single responsibility for model dataset API calls, reuses existing fetch patterns.
 */

import { useState, useEffect } from 'react';

interface ModelDatasetPerformance {
  modelName: string;
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

interface UseModelDatasetPerformanceReturn {
  performance: ModelDatasetPerformance | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useModelDatasetPerformance(modelName: string | null): UseModelDatasetPerformanceReturn {
  const [performance, setPerformance] = useState<ModelDatasetPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async () => {
    if (!modelName) {
      setPerformance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/model-dataset/performance/${encodeURIComponent(modelName)}`);
      
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
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPerformance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [modelName]);

  return {
    performance,
    loading,
    error,
    refetch: fetchPerformance
  };
}

interface UseAvailableModelsReturn {
  models: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAvailableModels(): UseAvailableModelsReturn {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
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
      setError(err instanceof Error ? err.message : 'An error occurred');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    loading,
    error,
    refetch: fetchModels
  };
}
