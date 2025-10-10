/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-04T22:37:28-04:00
 * PURPOSE: Analytics dashboard showing ACCURATE model performance statistics.
 * Removed flawed leaderboard sections that were producing inaccurate data.
 * Retains only the reliable database query tool for examining individual model performance on ARC datasets.
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

// Import hooks that follow proper repository pattern
import { useModelDatasetPerformance, useAvailableModels, useAvailableDatasets, DatasetInfo } from '@/hooks/useModelDatasetPerformance';

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
  const [selectedDataset, setSelectedDataset] = useState<string>('');

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


  // Set page title and scroll to top
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
                <label htmlFor="model-select" className="text-sm font-medium mb-2 block">Model:</label>
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
            </div>

            {loadingPerformance && selectedModelForDataset && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading {selectedModelForDataset} performance data...</p>
              </div>
            )}

            {modelDatasetPerformance && !loadingPerformance && (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-700">{modelDatasetPerformance.summary.solved}</div>
                      <div className="text-sm text-green-600">Puzzles CORRECT</div>
                      <div className="text-xs text-green-500 mt-1">
                        {Math.round((modelDatasetPerformance.summary.solved / modelDatasetPerformance.summary.totalPuzzles) * 100)}% success rate
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-700">{modelDatasetPerformance.summary.failed}</div>
                      <div className="text-sm text-red-600">Puzzles Incorrect</div>
                      <div className="text-xs text-red-500 mt-1">Attempted but got wrong answer</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-gray-700">{modelDatasetPerformance.summary.notAttempted}</div>
                      <div className="text-sm text-gray-600">Not Attempted</div>
                      <div className="text-xs text-gray-500 mt-1">No prediction attempts in database</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-700">{modelDatasetPerformance.summary.totalPuzzles}</div>
                      <div className="text-sm text-blue-600">Total Puzzles</div>
                      <div className="text-xs text-blue-500 mt-1">ARC Evaluation Set</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Puzzle Lists */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-700 flex items-center gap-2">
                        ✅ Correct ({modelDatasetPerformance.solved.length})
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        is_prediction_correct = true OR multi_test_all_correct = true
                      </p>
                    </CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {modelDatasetPerformance.solved.map((puzzleId) => (
                          <ClickablePuzzleBadge key={puzzleId} puzzleId={puzzleId} variant="success" />
                        ))}
                      </div>
                      {modelDatasetPerformance.solved.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No puzzles solved yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-700 flex items-center gap-2">
                        ❌ Incorrect ({modelDatasetPerformance.failed.length})
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Attempted but failed (false OR null values count as incorrect)
                      </p>
                    </CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {modelDatasetPerformance.failed.map((puzzleId) => (
                          <ClickablePuzzleBadge key={puzzleId} puzzleId={puzzleId} variant="error" />
                        ))}
                      </div>
                      {modelDatasetPerformance.failed.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No incorrect attempts</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-gray-700 flex items-center gap-2">
                        ⚠️ Not Attempted ({modelDatasetPerformance.notAttempted.length})
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        No entries in explanations table for this model
                      </p>
                    </CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1 text-xs">
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







