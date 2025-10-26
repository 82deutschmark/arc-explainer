/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-10-22T00:00:00Z
 * PURPOSE: Compact, info-focused multi-model comparison dashboard. Displays performance metrics in dense tables,
 *          reuses ModelPerformancePanel and NewModelComparisonResults components. Inline model add/remove with
 *          minimal whitespace and clear controls. No bloated summary cards or unnecessary badges.
 * SRP/DRY check: Pass - Reuses metrics endpoint, shared hooks, and visualization components without duplicating logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, AlertCircle } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-base-200 p-3">
      <div className="container mx-auto max-w-7xl space-y-3">
        <div className="flex items-center gap-3 bg-base-100 rounded-lg p-2 shadow">
          <button
            onClick={() => navigate('/analytics')}
            className="btn btn-xs btn-ghost gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              Model Comparison: {summary.dataset.toUpperCase()}
            </h1>
            <p className="text-xs opacity-70">
              {summary.totalPuzzles} puzzles • {selectedModels.length} models
            </p>
          </div>
        </div>

        <div className="bg-base-100 rounded-lg shadow p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide opacity-70">
              Active Models
            </h2>
            {inlineError && (
              <span className="text-xs text-error">{inlineError}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedModels.map((modelName) => (
              <div
                key={modelName}
                className="badge badge-sm gap-1 bg-primary/10 text-primary border-primary/20"
              >
                <span className="text-xs">{modelName}</span>
                <button
                  type="button"
                  className="hover:text-error text-xs px-1"
                  onClick={() => handleRemoveModel(modelName)}
                  disabled={isUpdating || selectedModels.length <= 1}
                  title="Remove model"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2 pt-1">
            <select
              className="select select-xs select-bordered flex-1 max-w-xs"
              value={modelToAdd}
              onChange={(event) => setModelToAdd(event.target.value)}
              disabled={
                loadingModels ||
                !dataset ||
                addableModels.length === 0 ||
                selectedModels.length >= MAX_MODELS
              }
            >
              <option value="">+ Add model...</option>
              {addableModels.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={handleAddModel}
              disabled={
                !dataset ||
                !modelToAdd ||
                isUpdating ||
                selectedModels.length >= MAX_MODELS
              }
            >
              {isUpdating ? 'Updating...' : 'Add'}
            </button>

            {isUpdating && (
              <span className="loading loading-spinner loading-xs ml-2" />
            )}
          </div>
        </div>

        {uniqueSolveByModel.length > 0 && totalUniqueSolves > 0 && (
          <div className="bg-base-100 rounded-lg shadow p-2">
            <h3 className="text-xs font-bold uppercase tracking-wide opacity-70 mb-2">
              Unique Solves: {totalUniqueSolves}
            </h3>
            <div className="flex gap-2 flex-wrap">
              {uniqueSolveByModel.map((entry) => (
                <div key={entry.name} className="text-xs">
                  <span className="font-semibold">{entry.name}:</span>{' '}
                  <span className="text-primary font-bold">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-base-100 rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="table table-xs table-zebra">
              <thead>
                <tr className="bg-base-300">
                  <th className="font-bold">Model</th>
                  <th className="text-center font-bold">Accuracy</th>
                  <th className="text-center font-bold">Correct</th>
                  <th className="text-center font-bold">Incorrect</th>
                  <th className="text-center font-bold">Not Attempted</th>
                  <th className="text-center font-bold">Coverage</th>
                  <th className="text-center font-bold">Avg Speed</th>
                  <th className="text-center font-bold">Total Cost</th>
                  <th className="text-center font-bold">Cost/Correct</th>
                  <th className="text-center font-bold">Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map((model) => (
                  <tr key={model.modelName} className="hover">
                    <td className="font-semibold">
                      {model.modelName}
                    </td>
                    <td className="text-center font-bold">
                      <span
                        className={
                          model.accuracyPercentage >= 50
                            ? 'text-success'
                            : 'text-error'
                        }
                      >
                        {model.accuracyPercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-center text-success font-semibold">
                      {model.correctCount}
                    </td>
                    <td className="text-center text-error font-semibold">
                      {model.incorrectCount}
                    </td>
                    <td className="text-center opacity-60">
                      {model.notAttemptedCount}
                    </td>
                    <td className="text-center text-xs">
                      {model.attempts}/{model.totalPuzzlesInDataset} ({model.coveragePercentage.toFixed(0)}%)
                    </td>
                    <td className="text-center text-xs">
                      {formatTime(model.avgProcessingTime)}
                    </td>
                    <td className="text-center text-xs font-semibold">
                      {formatCost(model.totalCost)}
                    </td>
                    <td className="text-center text-xs font-semibold text-info">
                      {model.costPerCorrectAnswer !== null
                        ? formatCost(model.costPerCorrectAnswer)
                        : 'N/A'}
                    </td>
                    <td className="text-center text-xs">
                      {model.avgConfidence.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-base-100 rounded-lg shadow p-3">
          <NewModelComparisonResults result={comparisonData} />
        </div>

        {dataset && selectedModels.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide opacity-70 px-1">
              Dataset Drilldown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
      </div>
    </div>
  );
}
