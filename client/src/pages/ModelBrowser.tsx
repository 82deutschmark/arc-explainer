/**
 * Author: Buffy the Base Agent
 * Date: 2025-10-08T00:12:00Z
 * PURPOSE: Model Browser showing one model's results across all puzzles in a dataset (mirrors AnalyticsOverview UI).
 * Adds: Clicking a PuzzleID in Not Attempted triggers analyze+save with the selected model using the standard solver prompt.
 * SRP/DRY check: Pass - Single responsibility page, reuses existing hooks/components (shadcn/ui, ClickablePuzzleBadge, performance hooks).
 * shadcn/ui: Pass - Uses Card, Select and related shadcn/ui components.
 */

import React, { useMemo, useState } from 'react';
import { Database, BarChart3 } from 'lucide-react';

import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { useModelDatasetPerformance, useAvailableModels, useAvailableDatasets, DatasetInfo } from '@/hooks/useModelDatasetPerformance';
import { useToast } from '@/hooks/use-toast';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { apiRequest } from '@/lib/queryClient';
import { useAnalysisStreaming } from '@/hooks/useAnalysisStreaming';
import { isStreamingEnabled } from '@shared/config/streaming';

const DATASET_DISPLAY_NAME_MAP: Record<string, string> = {
  evaluation: 'ARC1-Eval',
  training: 'ARC1-Train',
  evaluation2: 'ARC2-Eval',
  training2: 'ARC2-Train',
  'arc-heavy': 'ARC-Heavy',
  'concept-arc': 'ConceptARC'
};

type DatasetOption = DatasetInfo & { displayName: string };

export default function ModelBrowser() {
  const { toast } = useToast();

  // Selections (same defaults behavior as AnalyticsOverview)
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const streamingEnabled = isStreamingEnabled();
  const {
    startStream,
    closeStream,
    visibleText,
    reasoningText,
    status: streamStatus,
    summary: streamSummary,
  } = useAnalysisStreaming();
  const [currentStreamingPuzzle, setCurrentStreamingPuzzle] = useState<string | null>(null);

  const { models: availableModels, loading: loadingModels, error: modelsError } = useAvailableModels();
  const { datasets: availableDatasets, loading: loadingDatasets, error: datasetsError } = useAvailableDatasets();
  const { performance, loading: loadingPerformance } = useModelDatasetPerformance(selectedModel || null, selectedDataset || null, refreshKey);

  const datasetOptions: DatasetOption[] = useMemo(() => (
    availableDatasets.map(d => ({ ...d, displayName: DATASET_DISPLAY_NAME_MAP[d.name] ?? d.name }))
  ), [availableDatasets]);

  // Prefer ARC2-Eval then first dataset
  React.useEffect(() => {
    if (datasetOptions.length > 0 && !selectedDataset) {
      const arc2Eval = datasetOptions.find(d => d.name === 'evaluation2');
      setSelectedDataset((arc2Eval ?? datasetOptions[0]).name);
    }
  }, [datasetOptions, selectedDataset]);

  // Prefer grok-4-fast-reasoning or first model
  React.useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      const target = 'grok-4-fast-reasoning';
      const found = availableModels.includes(target) ? target : availableModels.find(m => m.includes('grok-4-fast-reasoning'));
      setSelectedModel(found || availableModels[0]);
    }
  }, [availableModels, selectedModel]);

  React.useEffect(() => {
    document.title = 'Model Browser - ARC Explainer';
    window.scrollTo(0, 0);
  }, []);

  async function analyzePuzzleNow(puzzleId: string) {
    if (!selectedModel || !selectedDataset) return;

    setAnalyzingIds(prev => new Set(prev).add(puzzleId));
    toast({ title: 'Analyzing...', description: `Running ${selectedModel} on ${getPuzzleName(puzzleId) ? `${puzzleId} - ${getPuzzleName(puzzleId)}` : puzzleId}` });

    const encodedModel = encodeURIComponent(selectedModel);

    if (streamingEnabled) {
      try {
        setCurrentStreamingPuzzle(puzzleId);
        void startStream(
          {
            taskId: puzzleId,
            modelKey: selectedModel,
            temperature: 0.2,
            promptId: 'solver',
            systemPromptMode: 'ARC',
            omitAnswer: true,
          },
          {
            onStatus: status => {
              if ((status as any).state === 'failed') {
                const message = (status as any).message || 'Streaming failed';
                toast({ title: 'Error', description: message, variant: 'destructive' });
              }
            },
            onComplete: async summary => {
              try {
                const analysis = summary.responseSummary?.analysis as Record<string, unknown> | undefined;
                if (!analysis) {
                  throw new Error('Streaming summary missing analysis payload');
                }
                const save = await apiRequest('POST', `/api/puzzle/save-explained/${puzzleId}`, {
                  explanations: {
                    [selectedModel]: {
                      ...analysis,
                      modelKey: selectedModel,
                    },
                  },
                });
                const saveJson = await save.json();
                if (!saveJson.success) {
                  throw new Error(saveJson.message || 'Save failed');
                }

                toast({ title: 'Completed', description: `Saved analysis for ${getPuzzleName(puzzleId) ? `${puzzleId} - ${getPuzzleName(puzzleId)}` : puzzleId}` });
                setRefreshKey(k => k + 1);
              } catch (error: any) {
                const msg = error?.message || 'Streaming analysis failed';
                toast({ title: 'Error', description: msg, variant: 'destructive' });
              } finally {
                closeStream();
                setCurrentStreamingPuzzle(null);
                setAnalyzingIds(prev => { const n = new Set(prev); n.delete(puzzleId); return n; });
              }
            },
            onError: error => {
              toast({ title: 'Error', description: error.message, variant: 'destructive' });
              closeStream();
              setCurrentStreamingPuzzle(null);
              setAnalyzingIds(prev => { const n = new Set(prev); n.delete(puzzleId); return n; });
            },
          }
        );
      } catch (error: any) {
        const msg = error?.message || 'Failed to start streaming analysis';
        toast({ title: 'Error', description: msg, variant: 'destructive' });
        closeStream();
        setCurrentStreamingPuzzle(null);
        setAnalyzingIds(prev => { const n = new Set(prev); n.delete(puzzleId); return n; });
      }
      return;
    }

    try {
      const body: any = {
        temperature: 0.2,
        promptId: 'solver',
        systemPromptMode: 'ARC',
        omitAnswer: true,
        retryMode: false,
      };

      const res = await apiRequest('POST', `/api/puzzle/analyze/${puzzleId}/${encodedModel}`, body);
      const resJson = await res.json();
      if (!resJson.success) throw new Error(resJson.message || 'Analysis failed');
      const analysisData = resJson.data;

      const save = await apiRequest('POST', `/api/puzzle/save-explained/${puzzleId}`, {
        explanations: {
          [selectedModel]: {
            ...analysisData,
            modelKey: selectedModel,
          },
        },
      });
      const saveJson = await save.json();
      if (!saveJson.success) throw new Error(saveJson.message || 'Save failed');

      toast({ title: 'Completed', description: `Saved analysis for ${getPuzzleName(puzzleId) ? `${puzzleId} - ${getPuzzleName(puzzleId)}` : puzzleId}` });
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      const msg = err?.message || 'Analysis failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setAnalyzingIds(prev => { const n = new Set(prev); n.delete(puzzleId); return n; });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                Model Browser
              </h1>
              <p className="text-lg text-gray-600">View one model's results across an ARC dataset. Click Not Attempted to run it now.</p>
            </div>
          </div>
        </header>

        {/* Model Dataset Performance UI (mirrored) */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <Database className="h-5 w-5" />
              Examine a Model's Performance on ARC Datasets
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a model and dataset. Not Attempted badges trigger analysis with the solver prompt.
            </p>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dataset-select" className="text-sm font-medium mb-2 block">Dataset:</label>
                <select className="select select-bordered w-full" value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)} disabled={loadingDatasets}>
                  <option value="" disabled>{loadingDatasets ? 'Loading datasets...' : datasetsError ? 'Error loading datasets' : 'Choose dataset'}</option>
                  {datasetOptions.map(ds => (
                    <option key={ds.name} value={ds.name}>
                      {ds.displayName} ({ds.puzzleCount} puzzles)
                    </option>
                  ))}
                </select>
                {datasetsError && (<p className="text-sm text-red-500 mt-1">Error: {datasetsError}</p>)}
                {!loadingDatasets && availableDatasets.length === 0 && !datasetsError && (
                  <p className="text-sm text-yellow-600 mt-1">No datasets found in data/ directory</p>
                )}
              </div>

              <div>
                <label htmlFor="model-select" className="text-sm font-medium mb-2 block">Model:</label>
                <select className="select select-bordered w-full" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={loadingModels || !selectedDataset}>
                  <option value="" disabled>{loadingModels ? 'Loading models...' : modelsError ? 'Error loading models' : selectedDataset ? 'Choose a model to analyze' : 'Select dataset first'}</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                {modelsError && (<p className="text-sm text-red-500 mt-1">Error: {modelsError}</p>)}
                {!loadingModels && availableModels.length === 0 && !modelsError && (
                  <p className="text-sm text-yellow-600 mt-1">No models found with database entries</p>
                )}
              </div>
            </div>

            {loadingPerformance && selectedModel && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading {selectedModel} performance data...</p>
              </div>
            )}

            {performance && !loadingPerformance && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card bg-green-50 border-green-200">
                    <div className="card-body p-4">
                      <div className="text-2xl font-bold text-green-700">{performance.summary.correct}</div>
                      <div className="text-sm text-green-600">Puzzles CORRECT</div>
                      <div className="text-xs text-green-500 mt-1">{Math.round((performance.summary.correct / performance.summary.totalPuzzles) * 100)}% success rate</div>
                    </div>
                  </div>
                  <div className="card bg-red-50 border-red-200">
                    <div className="card-body p-4">
                      <div className="text-2xl font-bold text-red-700">{performance.summary.incorrect}</div>
                      <div className="text-sm text-red-600">Puzzles Incorrect</div>
                      <div className="text-xs text-red-500 mt-1">Attempted but got wrong answer</div>
                    </div>
                  </div>
                  <div className="card bg-gray-50 border-gray-200">
                    <div className="card-body p-4">
                      <div className="text-2xl font-bold text-gray-700">{performance.summary.notAttempted}</div>
                      <div className="text-sm text-gray-600">Not Attempted</div>
                      <div className="text-xs text-gray-500 mt-1">No prediction attempts in database</div>
                    </div>
                  </div>
                  <div className="card bg-blue-50 border-blue-200">
                    <div className="card-body p-4">
                      <div className="text-2xl font-bold text-blue-700">{performance.summary.totalPuzzles}</div>
                      <div className="text-sm text-blue-600">Total Puzzles</div>
                      <div className="text-xs text-blue-500 mt-1">ARC Evaluation Set</div>
                    </div>
                  </div>
                </div>

                {/* Detailed Lists */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="card bg-base-100 shadow">
                    <div className="card-body">
                      <h2 className="card-title text-green-700 flex items-center gap-2">✅ Correct ({performance.correct.length})</h2>
                      <p className="text-xs text-muted-foreground">is_prediction_correct = true OR multi_test_all_correct = true</p>
                    </div>
                    <div className="card-body max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {performance.correct.map((pid: string) => (
                          <ClickablePuzzleBadge key={pid} puzzleId={pid} variant="success" />
                        ))}
                      </div>
                      {performance.correct.length === 0 && (<p className="text-sm text-gray-500 italic">No puzzles solved yet</p>)}
                    </div>
                  </div>

                  <div className="card bg-base-100 shadow">
                    <div className="card-body">
                      <h2 className="card-title text-red-700 flex items-center gap-2">❌ Incorrect ({performance.incorrect.length})</h2>
                      <p className="text-xs text-muted-foreground">Attempted but failed (false OR null values count as incorrect)</p>
                    </div>
                    <div className="card-body max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {performance.incorrect.map((pid: string) => (
                          <ClickablePuzzleBadge key={pid} puzzleId={pid} variant="error" />
                        ))}
                      </div>
                      {performance.incorrect.length === 0 && (<p className="text-sm text-gray-500 italic">No incorrect attempts</p>)}
                    </div>
                  </div>

                  <div className="card bg-base-100 shadow">
                    <div className="card-body">
                      <h2 className="card-title text-gray-700 flex items-center gap-2">⚠️ Not Attempted ({performance.notAttempted.length})</h2>
                      <p className="text-xs text-muted-foreground">No entries in explanations table for this model. Click to run now.</p>
                    </div>
                    <div className="card-body max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {performance.notAttempted.map(pid => {
                          const isLoading = analyzingIds.has(pid);
                          return (
                            <div
                              key={pid}
                              role="button"
                              onClick={() => !isLoading && analyzePuzzleNow(pid)}
                              className={`inline-flex items-center ${isLoading ? 'opacity-80 cursor-wait' : 'cursor-pointer'} group`}
                              title={isLoading ? 'Analyzing...' : `Analyze ${pid} with ${selectedModel}`}
                            >
                              <ClickablePuzzleBadge
                                puzzleId={pid}
                                variant="neutral"
                                clickable={false}
                                className={`${isLoading ? 'animate-pulse' : 'hover:ring-1 hover:ring-gray-300'} w-full justify-center`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {performance.notAttempted.length === 0 && (<p className="text-sm text-gray-500 italic">All puzzles attempted</p>)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedModel && !loadingModels && (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a model above to see its performance on the ARC evaluation dataset</p>
                <p className="text-xs text-muted-foreground mt-2">Real database queries using is_prediction_correct and multi_test_all_correct fields</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

