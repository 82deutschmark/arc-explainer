/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T18:43:00-04:00 (Updated for high-density UI)
 * PURPOSE: Analytics dashboard showing ACCURATE model performance statistics with improved information density.
 * 
 * MAJOR UI/UX IMPROVEMENTS (2025-10-10):
 * - CRITICAL FIX: Now prominently displays MODEL NAME (was completely missing!)
 * - Added visual progress bar showing correct/incorrect/not-attempted proportions
 * - Reduced padding from p-4 to p-3 for higher information density
 * - Changed from 4 cards to 3 + prominent header card with model/dataset info
 * - Added "Success Rate of Attempted" metric (correct / attempted puzzles)
 * - Increased puzzle badge grid from 2 to 3 columns for denser layout
 * - Added percentage of total on each stat card
 * - Improved visual hierarchy with gradient header card
 * 
 * Uses proper shadcn/ui components and follows established patterns.
 * SRP and DRY check: Pass - Single responsibility of displaying analytics, reuses existing components
 * shadcn/ui: Pass - Uses proper shadcn/ui components throughout (Card, Badge, Button, Select, etc.)
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Database,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Import existing components
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { DifficultPuzzlesSection } from '@/components/analytics/DifficultPuzzlesSection';
import { ModelComparisonDialog } from '@/components/analytics/ModelComparisonDialog';

// Import hooks that follow proper repository pattern
import { useModelDatasetPerformance, useAvailableModels, useAvailableDatasets, DatasetInfo } from '@/hooks/useModelDatasetPerformance';

// Types for the new Model Comparison feature
export interface PuzzleComparisonDetail {
  puzzleId: string;
  model1Result: 'correct' | 'incorrect' | 'not_attempted';
  model2Result: 'correct' | 'incorrect' | 'not_attempted';
  model3Result?: 'correct' | 'incorrect' | 'not_attempted';
  model4Result?: 'correct' | 'incorrect' | 'not_attempted';
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

  // Model dataset performance state
  const [selectedModelForDataset, setSelectedModelForDataset] = useState<string>('');
  const [selectedModelForComparison, setSelectedModelForComparison] = useState<string>('');
  const [selectedModel3, setSelectedModel3] = useState<string>('');
  const [selectedModel4, setSelectedModel4] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');

  // Model comparison state
  const [comparisonResult, setComparisonResult] = useState<ModelComparisonResult | null>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState<boolean>(false);

  // Collapsible sections state
  const [isDifficultPuzzlesCollapsed, setIsDifficultPuzzlesCollapsed] = useState<boolean>(true);

  // Fetch available models, datasets, and model dataset performance
  const { models: availableModels, loading: loadingModels, error: modelsError } = useAvailableModels();
  const { datasets: availableDatasets, loading: loadingDatasets, error: datasetsError } = useAvailableDatasets();
  const { performance: modelDatasetPerformance, loading: loadingPerformance, error: performanceError } = useModelDatasetPerformance(selectedModelForDataset || null, selectedDataset || null);
  const datasetOptions: DatasetOption[] = useMemo(() => {
    return availableDatasets.map((dataset) => ({
      ...dataset,
      displayName: DATASET_DISPLAY_NAME_MAP[dataset.name] ?? dataset.name
    }));
  }, [availableDatasets]);

  // Prefer ARC2 evaluation dataset by default; fall back to first available directory
  React.useEffect(() => {
    if (datasetOptions.length > 0 && !selectedDataset) {
      const arc2EvalDataset = datasetOptions.find(option => option.name === 'evaluation2');
      setSelectedDataset((arc2EvalDataset ?? datasetOptions[0]).name);
    }
  }, [datasetOptions, selectedDataset]);

  // Auto-select gpt-5-pro-2025-10-06-attempt1 model if available, fallback to first model
  React.useEffect(() => {
    if (availableModels.length > 0 && !selectedModelForDataset) {
      const targetModel = 'gpt-5-pro-2025-10-06-attempt1';
      const gpt5Pro = availableModels.includes(targetModel)
        ? targetModel
        : availableModels.find(m => m.includes('gpt-5-pro-2025-10-06-attempt1'));
      setSelectedModelForDataset(gpt5Pro || availableModels[0]);
    }
  }, [availableModels, selectedModelForDataset]);

  // Auto-select Grok-4 as 2nd model if available
  React.useEffect(() => {
    if (availableModels.length > 0 && !selectedModelForComparison) {
      const grok4 = availableModels.find(m => m.includes('grok-4')) || availableModels[1];
      if (grok4 && grok4 !== selectedModelForDataset) {
        setSelectedModelForComparison(grok4);
      }
    }
  }, [availableModels, selectedModelForDataset, selectedModelForComparison]);

  // Auto-select Claude Sonnet 4.5 as 3rd model if available
  React.useEffect(() => {
    if (availableModels.length > 0 && !selectedModel3) {
      const claudeSonnet = availableModels.find(m => m.includes('claude') && m.includes('sonnet') && m.includes('4.5'));
      if (claudeSonnet && claudeSonnet !== selectedModelForDataset && claudeSonnet !== selectedModelForComparison) {
        setSelectedModel3(claudeSonnet);
      }
    }
  }, [availableModels, selectedModelForDataset, selectedModelForComparison, selectedModel3]);


  // Set page title and scroll to top
  const handleCompare = async () => {
    if (!selectedModelForDataset || !selectedDataset) return;

    // Open dialog immediately to show loading state
    setIsComparisonDialogOpen(true);
    setLoadingComparison(true);
    setComparisonError(null);
    setComparisonResult(null);

    try {
      const models = [
        selectedModelForDataset, 
        selectedModelForComparison, 
        selectedModel3 === '__none__' ? '' : selectedModel3, 
        selectedModel4 === '__none__' ? '' : selectedModel4
      ].filter(Boolean);
      const queryParams = new URLSearchParams({
        model1: models[0] || '',
        ...(models[1] && { model2: models[1] }),
        ...(models[2] && { model3: models[2] }),
        ...(models[3] && { model4: models[3] }),
        dataset: selectedDataset
      });
      
      const response = await fetch(`/api/metrics/compare?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch comparison data');
      }
      const result = await response.json();
      setComparisonResult(result.data);
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoadingComparison(false);
    }
  };

  React.useEffect(() => {
    document.title = 'Analytics Dashboard - ARC Explainer';
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
                Model performance analysis on ARC datasets
              </p>
            </div>
          </div>
        </header>

        {/* REAL Model Dataset Performance - Database Query Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Examine a Model's Performance on ARC Datasets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select a model to see which ARC puzzles it got right, got incorrect, or hasn't attempted yet. Uses real database queries.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dataset-select" className="text-sm font-medium mb-2 block">Dataset:</label>
                <Select 
                  value={selectedDataset} 
                  onValueChange={setSelectedDataset}
                  disabled={loadingDatasets}
                >
                  <SelectTrigger id="dataset-select">
                    <SelectValue placeholder={loadingDatasets ? "Loading datasets..." : datasetsError ? "Error loading datasets" : "Choose dataset"} />
                  </SelectTrigger>
                  <SelectContent>
                    {datasetOptions.map((dataset) => (
                      <SelectItem key={dataset.name} value={dataset.name}>
                        {dataset.displayName} ({dataset.puzzleCount} puzzles)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {datasetsError && (
                  <p className="text-sm text-red-500 mt-1">Error: {datasetsError}</p>
                )}
                {!loadingDatasets && availableDatasets.length === 0 && !datasetsError && (
                  <p className="text-sm text-yellow-600 mt-1">No datasets found in data/ directory</p>
                )}
              </div>

              <div>
                <label htmlFor="model-select" className="text-sm font-medium mb-2 block">Model 1 (Primary):</label>
                <Select 
                  value={selectedModelForDataset} 
                  onValueChange={setSelectedModelForDataset}
                  disabled={loadingModels || !selectedDataset}
                >
                  <SelectTrigger id="model-select">
                    <SelectValue placeholder={loadingModels ? "Loading models..." : modelsError ? "Error loading models" : selectedDataset ? "Choose a model to analyze" : "Select dataset first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modelsError && (
                  <p className="text-sm text-red-500 mt-1">Error: {modelsError}</p>
                )}
                {!loadingModels && availableModels.length === 0 && !modelsError && (
                  <p className="text-sm text-yellow-600 mt-1">No models found with database entries</p>
                )}
              </div>

              <div>
                <label htmlFor="model-compare-select" className="text-sm font-medium mb-2 block">Model 2 (Grok-4):</label>
                <Select 
                  value={selectedModelForComparison} 
                  onValueChange={setSelectedModelForComparison}
                  disabled={loadingModels || !selectedDataset}
                >
                  <SelectTrigger id="model-compare-select">
                    <SelectValue placeholder={loadingModels ? "Loading..." : selectedDataset ? "Choose a model to compare" : "Select dataset first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.filter(m => m !== selectedModelForDataset).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="model3-select" className="text-sm font-medium mb-2 block">Model 3 (Optional):</label>
                <Select 
                  value={selectedModel3} 
                  onValueChange={setSelectedModel3}
                  disabled={loadingModels || !selectedDataset}
                >
                  <SelectTrigger id="model3-select">
                    <SelectValue placeholder={loadingModels ? "Loading..." : selectedDataset ? "Choose third model (optional)" : "Select dataset first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {availableModels.filter(m => m !== selectedModelForDataset && m !== selectedModelForComparison).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="model4-select" className="text-sm font-medium mb-2 block">Model 4 (Optional):</label>
                <Select 
                  value={selectedModel4} 
                  onValueChange={setSelectedModel4}
                  disabled={loadingModels || !selectedDataset}
                >
                  <SelectTrigger id="model4-select">
                    <SelectValue placeholder={loadingModels ? "Loading..." : selectedDataset ? "Choose fourth model (optional)" : "Select dataset first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {availableModels.filter(m => m !== selectedModelForDataset && m !== selectedModelForComparison && m !== selectedModel3).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-center pt-4">
                <Button 
                    onClick={handleCompare}
                    disabled={!selectedModelForDataset || !selectedDataset || loadingComparison}
                    size="lg"
                >
                    {loadingComparison ? 'Comparing...' : 'Compare Models'}
                </Button>
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
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-2xl font-bold text-gray-900">{modelDatasetPerformance.modelName}</h2>
                          <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium">
                            {DATASET_DISPLAY_NAME_MAP[modelDatasetPerformance.dataset] || modelDatasetPerformance.dataset}
                          </span>
                          <span className="text-sm text-gray-500">({modelDatasetPerformance.summary.totalPuzzles} puzzles)</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Attempted: <strong>{modelDatasetPerformance.summary.correct + modelDatasetPerformance.summary.incorrect}</strong> / {modelDatasetPerformance.summary.totalPuzzles}</span>
                          <span className="text-gray-400">•</span>
                          <span>Success Rate of Attempted: <strong className="text-green-700">
                            {modelDatasetPerformance.summary.correct + modelDatasetPerformance.summary.incorrect > 0
                              ? Math.round((modelDatasetPerformance.summary.correct / (modelDatasetPerformance.summary.correct + modelDatasetPerformance.summary.incorrect)) * 100)
                              : 0}%
                          </strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-green-700">
                          {Math.round((modelDatasetPerformance.summary.correct / modelDatasetPerformance.summary.totalPuzzles) * 100)}%
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

                {/* Compact Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-3xl font-bold text-green-700">{modelDatasetPerformance.summary.correct}</div>
                          <div className="text-sm font-medium text-green-600">Correct</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {Math.round((modelDatasetPerformance.summary.correct / modelDatasetPerformance.summary.totalPuzzles) * 100)}%
                          </div>
                          <div className="text-xs text-green-500">of total</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-3xl font-bold text-red-700">{modelDatasetPerformance.summary.incorrect}</div>
                          <div className="text-sm font-medium text-red-600">Incorrect</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-600">
                            {Math.round((modelDatasetPerformance.summary.incorrect / modelDatasetPerformance.summary.totalPuzzles) * 100)}%
                          </div>
                          <div className="text-xs text-red-500">of total</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-3xl font-bold text-gray-700">{modelDatasetPerformance.summary.notAttempted}</div>
                          <div className="text-sm font-medium text-gray-600">Not Attempted</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-600">
                            {Math.round((modelDatasetPerformance.summary.notAttempted / modelDatasetPerformance.summary.totalPuzzles) * 100)}%
                          </div>
                          <div className="text-xs text-gray-500">of total</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Puzzle Lists - More Compact */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-green-700 flex items-center gap-2">
                        ✅ Correct ({modelDatasetPerformance.correct.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto pt-2">
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
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-red-700 flex items-center gap-2">
                        ❌ Incorrect ({modelDatasetPerformance.incorrect.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto pt-2">
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
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-gray-700 flex items-center gap-2">
                        ⚠️ Not Attempted ({modelDatasetPerformance.notAttempted.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-80 overflow-y-auto pt-2">
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

        {/* Model Comparison Dialog - Replaces inline rendering at bottom */}
        <ModelComparisonDialog
          open={isComparisonDialogOpen}
          onOpenChange={setIsComparisonDialogOpen}
          comparisonResult={comparisonResult}
          loading={loadingComparison}
          error={comparisonError}
        />

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







