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
import { ArrowLeft, AlertCircle, Zap } from 'lucide-react';
import { NewModelComparisonResults } from '@/components/analytics/NewModelComparisonResults';
import { ModelPerformancePanel } from '@/components/analytics/ModelPerformancePanel';
import { ModelComparisonDialog } from '@/components/analytics/ModelComparisonDialog';
import { useAvailableModels } from '@/hooks/useModelDatasetPerformance';
import { ModelComparisonResult } from './AnalyticsOverview';
import { usePageMeta } from '@/hooks/usePageMeta';
import { computeAttemptUnionAccuracy, parseAttemptModelName } from '@/utils/modelComparison';

const MAX_MODELS = 4;
const COMPARISON_CACHE_KEY = 'arc-comparison-data';
const COMPARISON_CACHE_VERSION = '2025-11-02-model-comparison-refresh';

interface CachedComparisonEnvelope {
  version: string;
  data: ModelComparisonResult;
}

export default function ModelComparisonPage() {
  usePageMeta({
    title: 'ARC Explainer – Model Comparison',
    description:
      'Compare ARC solver models head-to-head on accuracy, coverage, cost, and latency across ARC datasets.',
    canonicalPath: '/model-comparison',
  });
  const [, navigate] = useLocation();
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelToAdd, setModelToAdd] = useState('');
  const [hasRefreshedFromCache, setHasRefreshedFromCache] = useState(false);
  const [showUnionDialog, setShowUnionDialog] = useState(false);

  const [comparisonData, setComparisonData] = useState<ModelComparisonResult | null>(() => {
    const envelopeFromHistory = window.history.state?.comparisonData as CachedComparisonEnvelope | null;
    if (envelopeFromHistory?.version === COMPARISON_CACHE_VERSION) {
      const stateData = envelopeFromHistory.data;
      if (stateData?.summary && Array.isArray(stateData.details)) {
        try {
          localStorage.setItem(
            COMPARISON_CACHE_KEY,
            JSON.stringify({ version: COMPARISON_CACHE_VERSION, data: stateData })
          );
        } catch (error) {
          console.warn('Failed to persist comparison data from history state.', error);
        }
        return stateData;
      }
    }

    try {
      const stored = localStorage.getItem(COMPARISON_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CachedComparisonEnvelope | null;
        if (
          parsed?.version === COMPARISON_CACHE_VERSION &&
          parsed.data?.summary &&
          Array.isArray(parsed.data.details)
        ) {
          return parsed.data;
        }

        // Version mismatch – clear stale cache
        localStorage.removeItem(COMPARISON_CACHE_KEY);
      }
    } catch (error) {
      console.warn('Failed to read comparison data from localStorage.', error);
      localStorage.removeItem(COMPARISON_CACHE_KEY);
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
          const envelope: CachedComparisonEnvelope = {
            version: COMPARISON_CACHE_VERSION,
            data: result.data,
          };
          localStorage.setItem(COMPARISON_CACHE_KEY, JSON.stringify(envelope));
          window.history.replaceState(
            { ...window.history.state, comparisonData: envelope },
            document.title
          );
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
        try {
          localStorage.removeItem(COMPARISON_CACHE_KEY);
          window.history.replaceState(
            { ...window.history.state, comparisonData: null },
            document.title
          );
        } catch (cleanupError) {
          console.warn('Failed to clear cached comparison data after error.', cleanupError);
        }
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
    const urlParams = new URLSearchParams(window.location.search);
    const datasetFromUrl = urlParams.get('dataset');
    const modelsFromUrl = ['model1', 'model2', 'model3', 'model4']
      .map((key) => urlParams.get(key))
      .filter((name): name is string => Boolean(name && name.trim()));

    // If no URL params but we already have comparison data, keep showing cached results.
    if (!datasetFromUrl || modelsFromUrl.length === 0) {
      if (!comparisonData) {
        setFatalError(
          'Missing required parameters. Please run a comparison from the Analytics page.',
        );
      }
      return;
    }

    const currentDataset = comparisonData?.summary?.dataset ?? null;
    const currentModels =
      comparisonData?.summary?.modelPerformance?.map((item) => item.modelName) ?? [];

    const setsDiffer = () => {
      if (currentModels.length !== modelsFromUrl.length) {
        return true;
      }
      const currentSet = new Set(currentModels);
      for (const name of modelsFromUrl) {
        if (!currentSet.has(name)) {
          return true;
        }
      }
      return false;
    };

    const datasetChanged = !currentDataset || currentDataset !== datasetFromUrl;
    const modelsChanged = setsDiffer();

    if (!datasetChanged && !modelsChanged) {
      return;
    }

    void requestComparisonData(
      modelsFromUrl,
      datasetFromUrl,
      comparisonData ? 'update' : 'initial',
    );
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasDatasetParam = Boolean(urlParams.get('dataset'));

    // When a dataset is specified in the URL, we let the URL drive the data
    // and skip the cache refresh behavior.
    if (!comparisonData || hasRefreshedFromCache || hasDatasetParam) {
      return;
    }

    const datasetName = comparisonData.summary?.dataset;
    const modelsToRefresh = comparisonData.summary?.modelPerformance
      ?.map((item) => item.modelName)
      .filter((name): name is string => Boolean(name && name.trim())) ?? [];

    if (!datasetName || modelsToRefresh.length === 0) {
      setHasRefreshedFromCache(true);
      return;
    }

    setHasRefreshedFromCache(true);
    void requestComparisonData(modelsToRefresh, datasetName, 'update');
  }, [comparisonData, hasRefreshedFromCache, requestComparisonData]);

  const addableModels = useMemo(() => {
    const filtered = availableModels.filter(
      (modelName) => !selectedModels.includes(modelName),
    );
    // Prefer newest models first based on the order returned from the backend.
    return [...filtered].reverse();
  }, [availableModels, selectedModels]);

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

  // Attempt union detection and metrics computation
  const attemptUnionMetrics = useMemo(() => {
    const summary = comparisonData?.summary;
    const attemptUnionStats = summary?.attemptUnionStats;

    // Prefer backend-provided attempt union stats if available
    if (summary && Array.isArray(attemptUnionStats) && attemptUnionStats.length > 0) {
      return attemptUnionStats[0];
    }

    // Fallback to frontend computation for backward compatibility
    if (!summary || selectedModels.length < 2) {
      return null;
    }

    // Parse model names to identify attempt groups
    const attemptGroups = new Map<string, { modelName: string; attemptNumber: number; index: number }[]>();
    
    selectedModels.forEach((modelName, index) => {
      const parsed = parseAttemptModelName(modelName);
      if (parsed) {
        if (!attemptGroups.has(parsed.baseModelName)) {
          attemptGroups.set(parsed.baseModelName, []);
        }
        attemptGroups.get(parsed.baseModelName)!.push({
          modelName,
          attemptNumber: parsed.attemptNumber,
          index,
        });
      }
    });

    // Find the first base model group with at least 2 attempts
    for (const [baseModelName, attempts] of attemptGroups) {
      if (attempts.length >= 2) {
        // Sort by attempt number to ensure consistent ordering
        attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
        
        // Use the first two attempts for union calculation
        const modelIndices = attempts.slice(0, 2).map(a => a.index);
        const unionMetrics = computeAttemptUnionAccuracy(comparisonData, modelIndices);
        
        return {
          baseModelName,
          attemptModelNames: attempts.slice(0, 2).map(a => a.modelName),
          ...unionMetrics,
        };
      }
    }

    return null;
  }, [comparisonData, selectedModels]);

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

        {attemptUnionMetrics && attemptUnionMetrics.totalPuzzles > 0 && (
          <div className="bg-base-100 rounded-lg shadow p-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide opacity-70">
                Attempt Union Accuracy
              </h3>
              <button
                onClick={() => setShowUnionDialog(true)}
                className="btn btn-xs btn-primary gap-1"
                title="View detailed union accuracy analysis"
              >
                <Zap className="h-3 w-3" />
                Details
              </button>
            </div>
            <div className="space-y-1">
              <div className="text-xs">
                <span className="font-semibold">Base Model:</span>{' '}
                <span className="text-primary">{attemptUnionMetrics.baseModelName}</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold">Attempts:</span>{' '}
                <span className="opacity-80">
                  {attemptUnionMetrics.attemptModelNames.join(' + ')}
                </span>
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="text-xs">
                  <span className="font-semibold">Union Correct:</span>{' '}
                  <span className="text-success font-bold">
                    {attemptUnionMetrics.unionCorrectCount}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="font-semibold">Total:</span>{' '}
                  <span className="opacity-80">{attemptUnionMetrics.totalPuzzles}</span>
                </div>
                <div className="text-xs">
                  <span className="font-semibold">Union Accuracy:</span>{' '}
                  <span
                    className={
                      attemptUnionMetrics.unionAccuracyPercentage >= 50
                        ? 'text-success font-bold'
                        : 'text-error font-bold'
                    }
                  >
                    {attemptUnionMetrics.unionAccuracyPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
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

        <ModelComparisonDialog
          open={showUnionDialog}
          onOpenChange={setShowUnionDialog}
          comparisonResult={comparisonData}
          loading={false}
          error={null}
        />
      </div>
    </div>
  );
}
