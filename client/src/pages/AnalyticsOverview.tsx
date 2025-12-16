/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T19:00:00-04:00 (Updated for MAXIMUM density)
 * PURPOSE: Analytics dashboard showing ACCURATE model performance statistics with MAXIMUM information density.
 * 
 * MAJOR UI/UX IMPROVEMENTS (2025-10-10):
 * - CRITICAL FIX: Now prominently displays MODEL NAME (was completely missing!)
 * - Added visual progress bar showing correct/incorrect/not-attempted proportions
 * - EXTREME PADDING REDUCTION: p-4→p-3→p-2, gap-4→gap-3→gap-2 for maximum density
 * - Changed from 4 cards to 3 + prominent header card with model/dataset info
 * - Added "Success Rate of Attempted" metric (correct / attempted puzzles)
 * - Increased puzzle badge grid from 2 to 3 columns for denser layout
 * - Added percentage of total on each stat card
 * - Improved visual hierarchy with gradient header card
 * - Reduced header/content padding to pt-2 px-2 pb-1 for maximum space utilization
 * - Font size reductions: text-base→text-sm for titles
 * - Added TODO comments for future metric badges (cost, time, tokens)
 * 
 * Uses proper shadcn/ui components and follows established patterns.
 * SRP and DRY check: Pass - Single responsibility of displaying analytics, reuses existing components
 * shadcn/ui: Pass - Uses proper shadcn/ui components throughout (Card, Badge, Button, Select, etc.)
 */

import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Database,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Import existing components
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { DifficultPuzzlesSection } from '@/components/analytics/DifficultPuzzlesSection';

// Import hooks that follow proper repository pattern
import { useModelDatasetPerformance, useAvailableModels, useAvailableDatasets, useModelDatasetMetrics, DatasetInfo } from '@/hooks/useModelDatasetPerformance';
import { usePageMeta } from '@/hooks/usePageMeta';
import { detectModelOrigin } from '@/utils/modelOriginDetection';

// Types for the new Model Comparison feature
export interface PuzzleComparisonDetail {
  puzzleId: string;
  model1Result: 'correct' | 'incorrect' | 'not_attempted';
  model2Result: 'correct' | 'incorrect' | 'not_attempted';
  model3Result?: 'correct' | 'incorrect' | 'not_attempted';
  model4Result?: 'correct' | 'incorrect' | 'not_attempted';
}

export interface ModelPerformanceOnDataset {
  modelName: string;
  totalPuzzlesInDataset: number;
  attempts: number;
  coveragePercentage: number;
  correctCount: number;
  incorrectCount: number;
  notAttemptedCount: number;
  accuracyPercentage: number;
  avgProcessingTime: number;
  totalCost: number;
  avgCostPerAttempt: number;
  costPerCorrectAnswer: number | null;
  avgConfidence: number;
  confidenceWhenCorrect: number | null;
}

export interface AttemptUnionStats {
  baseModelName: string;
  attemptModelNames: string[];
  totalPuzzles: number;
  totalTestPairs: number;
  unionCorrectCount: number;
  unionAccuracyPercentage: number;
}

export interface ModelComparisonSummary {
  totalPuzzles: number;
  model1Name: string;
  model2Name: string;
  model3Name?: string;
  model4Name?: string;
  dataset: string;
  // Agreement counts
  allCorrect: number;
  allIncorrect: number;
  allNotAttempted: number;
  // Partial agreement counts
  threeCorrect?: number;
  twoCorrect?: number;
  oneCorrect?: number;
  // Model-specific counts
  model1OnlyCorrect: number;
  model2OnlyCorrect: number;
  model3OnlyCorrect?: number;
  model4OnlyCorrect?: number;
  // NEW: Per-model performance metrics
  modelPerformance: ModelPerformanceOnDataset[];
  // NEW: Head-to-head insights
  fullySolvedCount: number;
  unsolvedCount: number;
  winnerModel: string | null;
  mostEfficientModel: string | null;
  fastestModel: string | null;
  accuracyLeaderModel: string | null;
  // NEW: Attempt union stats for comparing attempts of the same base model
  attemptUnionStats: AttemptUnionStats[];
}

export interface ModelComparisonResult {
  summary: ModelComparisonSummary;
  details: PuzzleComparisonDetail[];
}

const DATASET_DISPLAY_NAME_MAP: Record<string, string> = {
  evaluation: 'ARC1-Eval',
  training: 'ARC1-Train',
  evaluation2: 'ARC2-Eval',
  training2: 'ARC2-Train',
  'arc-heavy': 'ARC-Heavy',
  'concept-arc': 'ConceptARC'
};

type DatasetOption = DatasetInfo & { displayName: string };

export default function AnalyticsOverview() {

  usePageMeta({
    title: 'ARC Explainer – Analytics Dashboard',
    description:
      'Analyze model accuracy, coverage, cost, and reliability across ARC1, ARC2, ARC-Heavy, and ConceptARC datasets.',
    canonicalPath: '/analytics',
  });

  // Model dataset performance state
  const [selectedModelForDataset, setSelectedModelForDataset] = useState<string>('');
  const [selectedModelForComparison, setSelectedModelForComparison] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');

  // Model comparison state
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);
  const [, navigate] = useLocation();

  // Collapsible sections state
  const [isDifficultPuzzlesCollapsed, setIsDifficultPuzzlesCollapsed] = useState<boolean>(true);

  // Fetch available models, datasets, and model dataset performance
  const { models: availableModels, loading: loadingModels, error: modelsError } = useAvailableModels();
  const { datasets: availableDatasets, loading: loadingDatasets, error: datasetsError } = useAvailableDatasets();
  const { performance: modelDatasetPerformance, loading: loadingPerformance, error: performanceError } = useModelDatasetPerformance(selectedModelForDataset || null, selectedDataset || null);
  const { metrics: modelDatasetMetrics, loading: loadingMetrics } = useModelDatasetMetrics(selectedModelForDataset || null, selectedDataset || null);
  const datasetOptions: DatasetOption[] = useMemo(() => {
    return availableDatasets.map((dataset) => ({
      ...dataset,
      displayName: DATASET_DISPLAY_NAME_MAP[dataset.name] ?? dataset.name
    }));
  }, [availableDatasets]);

  const { officialModels, communityModels } = useMemo(() => {
    const official = availableModels.filter((model) => {
      const origin = detectModelOrigin(model);
      return origin.origin === 'hf_official' || origin.origin === 'community_solver';
    });
    const community = availableModels.filter((model) => {
      const origin = detectModelOrigin(model);
      return origin.origin === 'arc_explainer';
    });
    return { officialModels: official, communityModels: community };
  }, [availableModels]);

  const selectedModelOrigin = modelDatasetPerformance
    ? detectModelOrigin(modelDatasetPerformance.modelName)
    : null;

  // Prefer ARC2 evaluation dataset by default; fall back to first available directory
  React.useEffect(() => {
    if (datasetOptions.length > 0 && !selectedDataset) {
      const arc2EvalDataset = datasetOptions.find(option => option.name === 'evaluation2');
      setSelectedDataset((arc2EvalDataset ?? datasetOptions[0]).name);
    }
  }, [datasetOptions, selectedDataset]);

  // Auto-select gpt-5-2-pro-2025-12-11-high-attempt1 as the model if available, fallback through preferred models
  React.useEffect(() => {
    if (availableModels.length > 0 && !selectedModelForDataset) {
      const gpt52 = availableModels.find(m => m === 'gpt-5-2-pro-2025-12-11-high-attempt1');
      const geminiPro = availableModels.find(m => m === 'gemini-3-pro-preview-attempt1');
      const geminiDeepThink = availableModels.find(m => m === 'gemini-3-deep-think-preview-attempt1');
      const gpt5 = availableModels.find(m => m === 'gpt-5-1-2025-11-13-thinking-high-attempt2');
      setSelectedModelForDataset(gpt52 || geminiPro || geminiDeepThink || gpt5 || availableModels[0]);
    }
  }, [availableModels, selectedModelForDataset]);

  // Auto-select claude-haiku-4-5-20251001-thinking-32k-attempt2 for comparison if available, fallback to first different model
  React.useEffect(() => {
    if (availableModels.length > 0 && !selectedModelForComparison && selectedModelForDataset) {
      const availableForComparison = availableModels.filter(m => m !== selectedModelForDataset);
      const preferredOrder = [
        'gemini-3-deep-think-preview-attempt1',
        'gemini-3-pro-preview-attempt1',
        'claude-haiku-4-5-20251001-thinking-32k-attempt2',
      ];

      const preferredModel = preferredOrder
        .map(name => availableForComparison.find(m => m === name))
        .find(Boolean);

      const modelToUse = preferredModel || availableForComparison[0];

      if (modelToUse) {
        // Use a small delay to ensure the state update doesn't conflict
        setTimeout(() => {
          setSelectedModelForComparison(modelToUse);
        }, 100);
      }
    }
  }, [availableModels, selectedModelForDataset, selectedModelForComparison]);


  // Navigate to comparison page with data
  const handleCompare = async () => {
    if (!selectedModelForDataset || !selectedDataset) return;

    setLoadingComparison(true);

    try {
      const models = [
        selectedModelForDataset,
        selectedModelForComparison
      ].filter(Boolean);

      console.log('Starting comparison with models:', models, 'dataset:', selectedDataset);

      const queryParams = new URLSearchParams({
        model1: models[0] || '',
        ...(models[1] && { model2: models[1] }),
        dataset: selectedDataset
      });

      console.log('Making API call to:', `/api/metrics/compare?${queryParams.toString()}`);

      const response = await fetch(`/api/metrics/compare?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch comparison data');
      }
      const result = await response.json();

      console.log('API response received:', result);

      if (!result.data) {
        throw new Error('No data in API response');
      }

      // Navigate to dedicated comparison page with data and URL params
      navigate(`/model-comparison?model1=${encodeURIComponent(models[0])}&model2=${encodeURIComponent(models[1] || '')}&dataset=${encodeURIComponent(selectedDataset)}`, { state: { comparisonData: result.data } });

      console.log('Navigation completed');
    } catch (error) {
      console.error('Comparison error:', error);
      // You could show a toast here if needed
    } finally {
      setLoadingComparison(false);
    }
  };

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                Analytics Dashboard
              </h1>
              <p className="text-lg text-gray-600">
                We ingest the ARC Prize team's official results which are posted at https://huggingface.co/arcprize and try to make them more visually appealing and interactive.
              </p>
            </div>
          </div>
        </header>

        {/* Evaluation harness explanation */}
        <Card className="border-blue-200 bg-blue-50/70">
          <CardContent className="p-3 text-sm text-left text-gray-700 space-y-1">
            <p className="font-semibold text-gray-900">
              How it works:
            </p>
            <p>
              For each puzzle in those datasets, the harness feeds the same input grids and prompt scaffolding into
              each LLM, then parses the model's output and scores it with the same rules before storing the
              results, costs, and timings.
            </p>
            <p>
              The ARC Prize team uses this scaffolding to test all LLMs on the public HuggingFace ARC datasets.
              You can inspect or reuse the exact evaluation code in the open-source harness here:
              {" "}
              <a
                href="https://github.com/arcprize/arc-agi-benchmarking"
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline font-medium"
              >
                arc-agi-benchmarking on GitHub

              </a>
              .
            </p>
          </CardContent>
        </Card>

        {/* REAL Model Dataset Performance - Database Query Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Examine a Model's Performance on ARC Datasets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select a model to see which ARC puzzles it got right, got incorrect, or did not attempt.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Dataset:</label>
                <Select
                  value={selectedDataset}
                  onValueChange={setSelectedDataset}
                  disabled={loadingDatasets}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDatasets ? "Loading..." : "Choose dataset"} />
                  </SelectTrigger>
                  <SelectContent>
                    {datasetOptions.map((dataset) => (
                      <SelectItem key={dataset.name} value={dataset.name}>
                        {dataset.displayName} ({dataset.puzzleCount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Primary Model:</label>
                <Select
                  value={selectedModelForDataset}
                  onValueChange={setSelectedModelForDataset}
                  disabled={loadingModels || !selectedDataset}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingModels ? "Loading..." : "Choose model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {officialModels.map((model) => {
                      const origin = getModelOriginInfo(model);
                      return (
                        <SelectItem key={model} value={model}>
                          {model} {origin.shortLabel && `(${origin.shortLabel})`}
                        </SelectItem>
                      );
                    })}
                    {communityModels.map((model) => {
                      const origin = getModelOriginInfo(model);
                      return (
                        <SelectItem key={model} value={model}>
                          {model} {origin.shortLabel && `(${origin.shortLabel})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Compare With:</label>
                <Select
                  value={selectedModelForComparison}
                  onValueChange={setSelectedModelForComparison}
                  disabled={loadingModels || !selectedDataset}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Compare model" />
                  </SelectTrigger>
                  <SelectContent>
                    {officialModels
                      .filter((model) => model !== selectedModelForDataset)
                      .map((model) => {
                        const origin = getModelOriginInfo(model);
                        return (
                          <SelectItem key={model} value={model}>
                            {model} {origin.shortLabel && `(${origin.shortLabel})`}
                          </SelectItem>
                        );
                      })}
                    {communityModels
                      .filter((model) => model !== selectedModelForDataset)
                      .map((model) => {
                        const origin = getModelOriginInfo(model);
                        return (
                          <SelectItem key={model} value={model}>
                            {model} {origin.shortLabel && `(${origin.shortLabel})`}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              {selectedModelForDataset && (
                <p>
                  <span className="font-semibold">Primary model:</span>{' '}
                  {getModelOriginInfo(selectedModelForDataset).description}
                </p>
              )}
              {selectedModelForComparison && (
                <p>
                  <span className="font-semibold">Compare model:</span>{' '}
                  {getModelOriginInfo(selectedModelForComparison).description}
                </p>
              )}
            </div>

            <div className="flex justify-center">
              <div className="space-y-2">
                <Button
                  onClick={handleCompare}
                  disabled={!selectedModelForDataset || !selectedDataset || loadingComparison || !selectedModelForComparison}
                >
                  {loadingComparison ? 'Comparing...' : 'Compare Models'}
                </Button>

                {!selectedModelForComparison && selectedModelForDataset && selectedDataset && (
                  <p className="text-xs text-muted-foreground text-center">
                    Note: Only comparing one model. Select a second model for full comparison.
                  </p>
                )}

                {selectedModelForComparison && selectedModelForDataset === selectedModelForComparison && (
                  <p className="text-xs text-amber-600 text-center">
                    Warning: Comparing the same model against itself may show limited results.
                  </p>
                )}
              </div>
            </div>

            {loadingPerformance && selectedModelForDataset && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading {selectedModelForDataset} performance data...</p>
              </div>
            )}

            {modelDatasetPerformance && !loadingPerformance && (
              <div className="space-y-3">
                {/* Model & Dataset Header - CRITICAL INFO */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-2xl font-bold text-gray-900">{modelDatasetPerformance.modelName}</h2>
                          <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium">
                            {DATASET_DISPLAY_NAME_MAP[modelDatasetPerformance.dataset] || modelDatasetPerformance.dataset}
                          </span>
                          {selectedModelOrigin && (
                            <Badge
                              variant={selectedModelOrigin.badgeVariant}
                              className="text-[11px]"
                            >
                              {selectedModelOrigin.shortLabel}
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500">({modelDatasetPerformance.summary.totalPuzzles} puzzles)</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Attempted: <strong>{modelDatasetPerformance.summary.correct + modelDatasetPerformance.summary.incorrect}</strong> / {modelDatasetPerformance.summary.totalPuzzles}</span>
                          <span className="text-gray-400">•</span>
                          <span>Success Rate of Attempted: <strong className="text-green-700">
                            {modelDatasetPerformance.summary.correct + modelDatasetPerformance.summary.incorrect > 0
                              ? ((modelDatasetPerformance.summary.correct / (modelDatasetPerformance.summary.correct + modelDatasetPerformance.summary.incorrect)) * 100).toFixed(2)
                              : '0.00'}%
                          </strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-green-700">
                          {((modelDatasetPerformance.summary.correct / modelDatasetPerformance.summary.totalPuzzles) * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Overall Success</div>
                        <div className="text-xs text-gray-500">{modelDatasetPerformance.summary.correct}/{modelDatasetPerformance.summary.totalPuzzles} correct</div>
                      </div>
                    </div>
                    
                    {/* Visual Progress Bar */}
                    <div className="mt-3 space-y-1">
                      <div className="flex h-6 rounded-md overflow-hidden shadow-sm">
                        {modelDatasetPerformance.summary.correct > 0 && (
                          <div 
                            className="bg-green-500 flex items-center justify-center text-xs font-semibold text-white"
                            style={{ width: `${(modelDatasetPerformance.summary.correct / modelDatasetPerformance.summary.totalPuzzles) * 100}%` }}
                          >
                            {modelDatasetPerformance.summary.correct > 0 && `${modelDatasetPerformance.summary.correct}`}
                          </div>
                        )}
                        {modelDatasetPerformance.summary.incorrect > 0 && (
                          <div 
                            className="bg-red-500 flex items-center justify-center text-xs font-semibold text-white"
                            style={{ width: `${(modelDatasetPerformance.summary.incorrect / modelDatasetPerformance.summary.totalPuzzles) * 100}%` }}
                          >
                            {modelDatasetPerformance.summary.incorrect > 0 && `${modelDatasetPerformance.summary.incorrect}`}
                          </div>
                        )}
                        {modelDatasetPerformance.summary.notAttempted > 0 && (
                          <div 
                            className="bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700"
                            style={{ width: `${(modelDatasetPerformance.summary.notAttempted / modelDatasetPerformance.summary.totalPuzzles) * 100}%` }}
                          >
                            {modelDatasetPerformance.summary.notAttempted > 0 && `${modelDatasetPerformance.summary.notAttempted}`}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm"></span>Correct</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span>Incorrect</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded-sm"></span>Not Attempted</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Compact Summary Stats with Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-3xl font-bold text-green-700">{modelDatasetPerformance.summary.correct}</div>
                          <div className="text-sm font-medium text-green-600">Correct</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {((modelDatasetPerformance.summary.correct / modelDatasetPerformance.summary.totalPuzzles) * 100).toFixed(2)}%
                          </div>
                          <div className="text-xs text-green-500">of total</div>
                        </div>
                      </div>
                      {modelDatasetMetrics && modelDatasetMetrics.correct.count > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {modelDatasetMetrics.correct.avgCost > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              💰 ${modelDatasetMetrics.correct.avgCost.toFixed(4)} avg
                            </Badge>
                          )}
                          {modelDatasetMetrics.correct.avgTime > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              ⏱️ {(modelDatasetMetrics.correct.avgTime / 1000).toFixed(2)}s avg
                            </Badge>
                          )}
                          {modelDatasetMetrics.correct.avgTokens > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              🔤 {Math.round(modelDatasetMetrics.correct.avgTokens).toLocaleString()} tok
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-3xl font-bold text-red-700">{modelDatasetPerformance.summary.incorrect}</div>
                          <div className="text-sm font-medium text-red-600">Incorrect</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-600">
                            {((modelDatasetPerformance.summary.incorrect / modelDatasetPerformance.summary.totalPuzzles) * 100).toFixed(2)}%
                          </div>
                          <div className="text-xs text-red-500">of total</div>
                        </div>
                      </div>
                      {modelDatasetMetrics && modelDatasetMetrics.incorrect.count > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {modelDatasetMetrics.incorrect.avgCost > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                              💰 ${modelDatasetMetrics.incorrect.avgCost.toFixed(4)} avg
                            </Badge>
                          )}
                          {modelDatasetMetrics.incorrect.avgTime > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                              ⏱️ {(modelDatasetMetrics.incorrect.avgTime / 1000).toFixed(2)}s avg
                            </Badge>
                          )}
                          {modelDatasetMetrics.incorrect.avgTokens > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                              🔤 {Math.round(modelDatasetMetrics.incorrect.avgTokens).toLocaleString()} tok
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-3xl font-bold text-gray-700">{modelDatasetPerformance.summary.notAttempted}</div>
                          <div className="text-sm font-medium text-gray-600">Not Attempted</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-600">
                            {((modelDatasetPerformance.summary.notAttempted / modelDatasetPerformance.summary.totalPuzzles) * 100).toFixed(2)}%
                          </div>
                          <div className="text-xs text-gray-500">of total</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Puzzle Lists - Maximum Density */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                  <Card>
                    <CardHeader className="pb-1 pt-2 px-2">
                      <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                        ✅ Correct ({modelDatasetPerformance.correct.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto pt-1 px-2 pb-2">
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        {modelDatasetPerformance.correct.map((puzzleId: string) => (
                          <ClickablePuzzleBadge key={puzzleId} puzzleId={puzzleId} variant="success" />
                        ))}
                      </div>
                      {modelDatasetPerformance.correct.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No puzzles solved yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-1 pt-2 px-2">
                      <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                        ❌ Incorrect ({modelDatasetPerformance.incorrect.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto pt-1 px-2 pb-2">
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        {modelDatasetPerformance.incorrect.map((puzzleId: string) => (
                          <ClickablePuzzleBadge key={puzzleId} puzzleId={puzzleId} variant="error" />
                        ))}
                      </div>
                      {modelDatasetPerformance.incorrect.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No incorrect attempts</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-1 pt-2 px-2">
                      <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                        ⚠️ Not Attempted ({modelDatasetPerformance.notAttempted.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto pt-1 px-2 pb-2">
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        {modelDatasetPerformance.notAttempted.map((puzzleId) => (
                          <ClickablePuzzleBadge key={puzzleId} puzzleId={puzzleId} variant="neutral" />
                        ))}
                      </div>
                      {modelDatasetPerformance.notAttempted.length === 0 && (
                        <p className="text-sm text-gray-500 italic">All puzzles attempted</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {!selectedModelForDataset && !loadingModels && (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a model above to see its performance on the ARC evaluation dataset</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Real database queries using is_prediction_correct and multi_test_all_correct fields
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most Difficult Puzzles Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Most Difficult Puzzles
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDifficultPuzzlesCollapsed(!isDifficultPuzzlesCollapsed)}
                className="h-8 w-8 p-0"
              >
                {isDifficultPuzzlesCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Puzzles with the lowest LLM accuracy rates - these are the hardest challenges for AI models
            </p>
          </CardHeader>
          {!isDifficultPuzzlesCollapsed && (
            <CardContent>
              <DifficultPuzzlesSection />
            </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}






