/**
 * Author: GPT-5 Codex
 * Date: 2025-10-19T00:00:00Z
 * PURPOSE: Multi-model comparison dashboard that lets analysts add or remove up to four models in place while reusing shared analytics components.
 * SRP/DRY check: Pass - Reuses metrics endpoint, shared hooks, and visualization components without duplicating logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  Brain,
  AlertCircle,
} from 'lucide-react';
import { NewModelComparisonResults } from '@/components/analytics/NewModelComparisonResults';
import { ModelPerformancePanel } from '@/components/analytics/ModelPerformancePanel';
import { useAvailableModels } from '@/hooks/useModelDatasetPerformance';
import { ModelComparisonResult } from './AnalyticsOverview';

const MAX_MODELS = 4;

export default function ModelComparisonPage() {
  const [, navigate] = useLocation();
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelToAdd, setModelToAdd] = useState('');

  const [comparisonData, setComparisonData] = useState<ModelComparisonResult | null>(() => {
    const stateData = window.history.state?.comparisonData as ModelComparisonResult | null;
    if (stateData?.summary && Array.isArray(stateData.details)) {
      try {
        localStorage.setItem('arc-comparison-data', JSON.stringify(stateData));
      } catch (error) {
        console.warn('Failed to persist comparison data from history state.', error);
      }
      return stateData;
    }

    try {
      const stored = localStorage.getItem('arc-comparison-data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.summary && Array.isArray(parsed.details)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to read comparison data from localStorage.', error);
    }

    return null;
  });

  const {
    models: availableModels,
    loading: loadingModels,
    error: availableModelsError,
  } = useAvailableModels();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const requestComparisonData = useCallback(
    async (
      models: string[],
      dataset: string,
      mode: 'initial' | 'update' = 'update',
    ): Promise<boolean> => {
      const trimmed = Array.from(
        new Set(models.filter((name) => Boolean(name && name.trim()))),
      );

      if (trimmed.length === 0) {
        const message = 'Select at least one model to compare.';
        if (mode === 'initial') {
          setFatalError(message);
        } else {
          setInlineError(message);
        }
        return false;
      }

      if (mode === 'initial') {
        setFatalError(null);
        setLoadingInitial(true);
      } else {
        setInlineError(null);
        setIsUpdating(true);
      }

      let succeeded = false;

      try {
        const params = new URLSearchParams({ dataset });
        trimmed.slice(0, MAX_MODELS).forEach((modelName, index) => {
          params.set(`model${index + 1}`, modelName);
        });

        const response = await fetch(`/api/metrics/compare?${params.toString()}`);
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(errorPayload?.message || 'Failed to fetch comparison data');
        }

        const result = await response.json();
        if (!result.data) {
          throw new Error('No data received from server');
        }

        setComparisonData(result.data);
        succeeded = true;

        try {
          localStorage.setItem('arc-comparison-data', JSON.stringify(result.data));
        } catch (storageError) {
          console.warn('Failed to persist comparison data.', storageError);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Comparison request failed';
        if (mode === 'initial') {
          setFatalError(message);
        } else {
          setInlineError(message);
        }
        console.error('Comparison error:', error);
      } finally {
        if (mode === 'initial') {
          setLoadingInitial(false);
        } else {
          setIsUpdating(false);
        }
      }

      return succeeded;
    },
    [],
  );

  useEffect(() => {
    if (comparisonData) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const dataset = urlParams.get('dataset');
    const models = ['model1', 'model2', 'model3', 'model4']
      .map((key) => urlParams.get(key))
      .filter((name): name is string => Boolean(name && name.trim()));

    if (!dataset || models.length === 0) {
      setFatalError(
        'Missing required parameters. Please run a comparison from the Analytics page.',
      );
      return;
    }

    void requestComparisonData(models, dataset, 'initial');
  }, [comparisonData, requestComparisonData]);

  useEffect(() => {
    if (!comparisonData?.summary?.modelPerformance) {
      return;
    }
    const nextSelected = comparisonData.summary.modelPerformance.map(
      (item) => item.modelName,
    );
    setSelectedModels(nextSelected);
  }, [comparisonData]);

  const dataset = comparisonData?.summary?.dataset ?? null;

  const addableModels = useMemo(
    () =>
      availableModels.filter(
        (modelName) => !selectedModels.includes(modelName),
      ),
    [availableModels, selectedModels],
  );

  const uniqueSolveByModel = useMemo(() => {
    if (!comparisonData?.summary) {
      return [];
    }

    const { summary } = comparisonData;
    const mapping = new Map<string, number>([
      [summary.model1Name, summary.model1OnlyCorrect ?? 0],
      [summary.model2Name, summary.model2OnlyCorrect ?? 0],
      [summary.model3Name ?? '', summary.model3OnlyCorrect ?? 0],
      [summary.model4Name ?? '', summary.model4OnlyCorrect ?? 0],
    ]);

    return selectedModels.map((name) => ({
      name,
      count: mapping.get(name) ?? 0,
    }));
  }, [comparisonData, selectedModels]);

  const totalUniqueSolves = useMemo(
    () => uniqueSolveByModel.reduce((sum, entry) => sum + entry.count, 0),
    [uniqueSolveByModel],
  );

  const handleAddModel = async () => {
    if (!dataset || !modelToAdd || selectedModels.includes(modelToAdd) || isUpdating) {
      return;
    }

    const nextModels = [...selectedModels, modelToAdd].slice(0, MAX_MODELS);
    const success = await requestComparisonData(nextModels, dataset, 'update');
    if (success) {
      setModelToAdd('');
    }
  };

  const handleRemoveModel = async (modelName: string) => {
    if (!dataset || isUpdating) {
      return;
    }

    const nextModels = selectedModels.filter((name) => name !== modelName);
    if (nextModels.length === 0) {
      setInlineError('At least one model must remain in the comparison.');
      return;
    }

    await requestComparisonData(nextModels, dataset, 'update');
  };

  const formatCost = (cost: number | null | undefined) => {
    if (cost === null || cost === undefined || cost === 0) {
      return 'Free';
    }
    if (cost < 0.01) {
      return `${(cost * 1000).toFixed(2)} m`;
    }
    if (cost < 1) {
      return `${(cost * 100).toFixed(2)} c`;
    }
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (ms: number | undefined) => {
    if (!ms || ms === 0) {
      return 'N/A';
    }
    if (ms < 1000) {
      return `${Math.round(ms)} ms`;
    }
    return `${(ms / 1000).toFixed(2)} s`;
  };

  if (loadingInitial && !comparisonData) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="mt-4 text-base-content/70">
              Loading comparison data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div role="alert" className="alert alert-error shadow-lg">
          <AlertCircle className="h-6 w-6" />
          <span>{fatalError}</span>
        </div>
        <button
          onClick={() => navigate('/analytics')}
          className="btn btn-primary mt-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Analytics
        </button>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div role="alert" className="alert alert-warning shadow-lg">
          <AlertCircle className="h-6 w-6" />
          <span>No comparison data found. Please run a comparison from the Analytics page.</span>
        </div>
        <button
          onClick={() => navigate('/analytics')}
          className="btn btn-primary mt-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Analytics
        </button>
      </div>
    );
  }

  const { summary } = comparisonData;
  const modelPerformance = summary.modelPerformance ?? [];
  const globalStats = [
    {
      label: 'All Correct',
      value: summary.allCorrect,
      description: 'All models solved correctly',
      tone: 'text-green-600',
    },
    {
      label: 'All Incorrect',
      value: summary.allIncorrect,
      description: 'Every model missed the puzzle',
      tone: 'text-red-600',
    },
    {
      label: 'All Not Attempted',
      value: summary.allNotAttempted,
      description: 'Coverage gap across all models',
      tone: 'text-gray-600',
    },
    {
      label: 'Unique Solves',
      value: totalUniqueSolves,
      description: 'Solved by exactly one model',
      tone: 'text-blue-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/analytics')}
            className="btn btn-sm btn-ghost gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Analytics
          </button>
        </div>

        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Model Performance Comparison
                </h1>
                <p className="text-sm text-gray-600">
                  Dataset: {summary.dataset.toUpperCase()} - {summary.totalPuzzles} total puzzles -{' '}
                  {selectedModels.length} active models
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                {summary.winnerModel && (
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <span>Highest Accuracy: {summary.winnerModel}</span>
                  </div>
                )}
                {summary.mostEfficientModel && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span>Most Efficient: {summary.mostEfficientModel}</span>
                  </div>
                )}
                {summary.fastestModel && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span>Fastest: {summary.fastestModel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4 space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Active models
              </h2>
              <p className="text-sm text-gray-600">
                Add or remove models to refresh this comparison. Up to four models are supported.
              </p>
            </div>

            {inlineError && (
              <div role="alert" className="alert alert-warning">
                <AlertCircle className="h-5 w-5" />
                <span>{inlineError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {selectedModels.map((modelName) => (
                <div
                  key={modelName}
                  className="badge badge-lg gap-2 bg-blue-50 text-blue-700 border border-blue-200"
                >
                  <span>{modelName}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-blue-600"
                    onClick={() => handleRemoveModel(modelName)}
                    disabled={isUpdating || selectedModels.length <= 1}
                  >
                    remove
                  </button>
                </div>
              ))}
              {selectedModels.length === 0 && (
                <span className="text-sm text-gray-500">
                  No models selected.
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end sm:gap-3 gap-2">
              <label className="form-control w-full sm:max-w-xs">
                <span className="label">
                  <span className="label-text text-sm font-medium">
                    Add a model
                  </span>
                  {loadingModels && (
                    <span className="label-text-alt text-xs text-gray-500">
                      Loading...
                    </span>
                  )}
                </span>
                <select
                  className="select select-bordered"
                  value={modelToAdd}
                  onChange={(event) => setModelToAdd(event.target.value)}
                  disabled={
                    loadingModels ||
                    !dataset ||
                    addableModels.length === 0 ||
                    selectedModels.length >= MAX_MODELS
                  }
                >
                  <option value="">Select model</option>
                  {addableModels.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddModel}
                disabled={
                  !dataset ||
                  !modelToAdd ||
                  isUpdating ||
                  selectedModels.length >= MAX_MODELS
                }
              >
                {isUpdating ? 'Updating...' : 'Add model'}
              </button>

              {isUpdating && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="loading loading-spinner loading-xs" />
                  Refreshing comparison
                </div>
              )}
            </div>

            {availableModelsError && (
              <p className="text-sm text-amber-600">
                Unable to load full model list: {availableModelsError}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {globalStats.map((stat) => (
            <div
              key={stat.label}
              className="card bg-white shadow-sm border border-gray-200"
            >
              <div className="card-body p-3">
                <div className={`text-2xl font-bold ${stat.tone}`}>
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {stat.label}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stat.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {uniqueSolveByModel.length > 0 && (
          <div className="card bg-white shadow-sm border border-gray-200">
            <div className="card-body p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Unique solves per model
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {uniqueSolveByModel.map((entry) => (
                  <div
                    key={entry.name}
                    className="border border-purple-200 rounded-lg p-3 bg-purple-50"
                  >
                    <div className="text-sm font-semibold text-purple-700">
                      {entry.name}
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      {entry.count}
                    </div>
                    <div className="text-xs text-purple-600">
                      Unique correct solutions
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {dataset && selectedModels.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Dataset drilldown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedModels.map((modelName) => (
                <ModelPerformancePanel
                  key={`${dataset}-${modelName}`}
                  modelName={modelName}
                  dataset={dataset}
                />
              ))}
            </div>
          </div>
        )}

        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Model performance metrics
            </h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="font-semibold text-gray-700">Model</th>
                    <th className="font-semibold text-gray-700 text-center">
                      Accuracy
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Correct
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Incorrect
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Not attempted
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Coverage
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Avg speed
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Total cost
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Cost per correct
                    </th>
                    <th className="font-semibold text-gray-700 text-center">
                      Avg confidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modelPerformance.map((model) => (
                    <tr key={model.modelName} className="hover:bg-gray-50">
                      <td className="font-medium text-gray-900">
                        {model.modelName}
                        {summary.winnerModel === model.modelName && (
                          <span className="ml-2 text-xs font-semibold text-green-600">
                            Highest accuracy
                          </span>
                        )}
                      </td>
                      <td className="text-center font-semibold text-lg">
                        <span
                          className={
                            model.accuracyPercentage >= 50
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {model.accuracyPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center text-green-600 font-medium">
                        {model.correctCount}
                      </td>
                      <td className="text-center text-red-600 font-medium">
                        {model.incorrectCount}
                      </td>
                      <td className="text-center text-gray-600 font-medium">
                        {model.notAttemptedCount}
                      </td>
                      <td className="text-center">
                        {model.attempts}/{model.totalPuzzlesInDataset} (
                        {model.coveragePercentage.toFixed(0)}%)
                      </td>
                      <td className="text-center text-sm">
                        {formatTime(model.avgProcessingTime)}
                      </td>
                      <td className="text-center text-sm font-medium">
                        {formatCost(model.totalCost)}
                      </td>
                      <td className="text-center text-sm font-medium text-blue-600">
                        {model.costPerCorrectAnswer !== null
                          ? formatCost(model.costPerCorrectAnswer)
                          : 'N/A'}
                      </td>
                      <td className="text-center text-sm">
                        {model.avgConfidence.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4 space-y-4">
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span>
                  Fully solved puzzles: {summary.fullySolvedCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4 text-rose-600" />
                <span>
                  Unsolved puzzles: {summary.unsolvedCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Brain className="h-4 w-4 text-indigo-600" />
                <span>Total models in comparison: {selectedModels.length}</span>
              </div>
            </div>
            <NewModelComparisonResults result={comparisonData} />
          </div>
        </div>
      </div>
    </div>
  );
}
