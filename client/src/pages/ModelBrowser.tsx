/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Batch analysis UI for running models against puzzle datasets with pause/resume.
 *          Provides model selection, dataset selection, and real-time progress tracking.
 *          MODERNIZED UI: Now uses ClickablePuzzleBadge grid, ToggleGroup filtering, and card-based
 *          results display (like AnalyticsOverview). Reuses proven components for consistency.
 *
 * SRP and DRY check: Pass - Reuses ClickablePuzzleBadge, ToggleGroup, BatchActivityLog
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Database, Sparkles, AlertCircle, Filter, CheckCircle, XCircle } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ExaminerControls from '@/components/model-examiner/ExaminerControls';
import ExaminerProgress from '@/components/model-examiner/ExaminerProgress';
import { BatchActivityLog } from '@/components/batch/BatchActivityLog';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';

// Model configurations for batch analysis
const BATCH_MODELS = [
  { value: 'grok-4-fast-reasoning', label: 'Grok-4-Fast-Reasoning (Moderate Speed)' },
  { value: 'grok-4-fast-non-reasoning', label: 'Grok-4-Fast-Non-Reasoning (Fast)' },
  { value: 'grok-4', label: 'Grok-4 (Slow, High Quality)' },
  { value: 'o4', label: 'OpenAI o4 (Experimental)' },
  { value: 'o3', label: 'OpenAI o3' },
  { value: 'o1', label: 'OpenAI o1' },
  { value: 'gpt-5', label: 'GPT-5' }
];

const DATASETS = [
  { value: 'arc1', label: 'ARC-1 Eval (400 puzzles)', description: 'Original ARC evaluation set' },
  { value: 'arc2', label: 'ARC-2 Eval (120 puzzles)', description: 'ARC-AGI-2 evaluation set' }
];

export default function ModelBrowser() {
  const [selectedModel, setSelectedModel] = useState<string>('grok-4-fast-reasoning');
  const [selectedDataset, setSelectedDataset] = useState<'arc1' | 'arc2'>('arc2');
  const [correctnessFilter, setCorrectnessFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  const {
    sessionId,
    status,
    results,
    isLoading,
    isPaused,
    isRunning,
    handleStart,
    handlePause,
    handleResume,
    handleCancel
  } = useBatchAnalysis();

  const handleStartBatch = async () => {
    try {
      await handleStart({
        modelName: selectedModel,
        dataset: selectedDataset,
        resume: true, // Always use resume mode
        promptId: 'solver',
        temperature: 0.2,
        systemPromptMode: 'ARC'
      });
    } catch (error) {
      console.error('Failed to start batch:', error);
    }
  };

  // Transform status for ExaminerProgress component
  const progressData = status ? {
    progress: status.progress,
    status: status.status,
    stats: {
      overallAccuracy: status.progress.total > 0
        ? Math.round((status.progress.successful / status.progress.total) * 100)
        : 0,
      averageProcessingTime: 0, // Could calculate from results if needed
      eta: 0 // Could calculate from current progress if needed
    }
  } : null;

  // Get completed results for display
  const completedResults = React.useMemo(() =>
    status?.results.filter(r => r.status === 'success' || r.status === 'failed') || []
  , [status?.results]);

  // Filter completed results by correctness
  const filteredResults = React.useMemo(() => {
    if (correctnessFilter === 'all') {
      return completedResults;
    }
    return completedResults.filter(r => {
      if (correctnessFilter === 'correct') {
        return r.correct === true;
      } else {
        return r.correct === false || r.correct === null || r.correct === undefined;
      }
    });
  }, [completedResults, correctnessFilter]);

  // Calculate stats
  const correctCount = React.useMemo(() =>
    completedResults.filter(r => r.correct === true).length
  , [completedResults]);

  const incorrectCount = React.useMemo(() =>
    completedResults.filter(r => r.correct === false).length
  , [completedResults]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8 text-blue-600" />
            Batch Analysis Runner
          </h1>
          <p className="text-gray-600 mt-1">
            Run AI models against puzzle datasets with automatic resume and progress tracking
          </p>
        </div>
      </div>

      <Separator />

      {/* Configuration Panel */}
      {!isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Configuration
            </CardTitle>
            <CardDescription>
              Select a model and dataset to begin batch analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model-select">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dataset Selection */}
            <div className="space-y-2">
              <Label>Dataset</Label>
              <RadioGroup value={selectedDataset} onValueChange={(value) => setSelectedDataset(value as 'arc1' | 'arc2')}>
                {DATASETS.map((dataset) => (
                  <div key={dataset.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={dataset.value} id={dataset.value} />
                    <Label htmlFor={dataset.value} className="cursor-pointer">
                      <div>
                        <div className="font-medium">{dataset.label}</div>
                        <div className="text-sm text-gray-500">{dataset.description}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Resume Mode:</strong> Puzzles already analyzed by this model will be automatically skipped.
                Only new puzzles will be processed.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <ExaminerControls
        isPaused={isPaused}
        isRunning={isRunning}
        isLoading={isLoading}
        progress={progressData}
        handleStart={handleStartBatch}
        handlePause={handlePause}
        handleResume={handleResume}
        handleCancel={handleCancel}
      />

      {/* Progress Display */}
      {isRunning && progressData && (
        <ExaminerProgress
          progress={progressData}
          currentModel={null}
          selectedModel={selectedModel}
          dataset={selectedDataset}
        />
      )}

      {/* Current Puzzle Indicator */}
      {isRunning && status && status.results.find(r => r.status === 'analyzing') && (
        <Alert className="bg-blue-50 border-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
          <AlertDescription className="flex items-center gap-2">
            <strong>Now analyzing:</strong>
            <code className="font-mono text-sm bg-blue-100 px-2 py-1 rounded">
              {status.results.find(r => r.status === 'analyzing')?.puzzleId}
            </code>
          </AlertDescription>
        </Alert>
      )}

      {/* Activity Log */}
      {isRunning && status && status.activityLog && (
        <Card>
          <CardHeader>
            <CardTitle>Live Activity Log</CardTitle>
            <CardDescription>
              Real-time updates showing puzzle analysis progress and validation results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BatchActivityLog
              activityLog={status.activityLog}
              currentPuzzle={status.results.find(r => r.status === 'analyzing')?.puzzleId}
            />
          </CardContent>
        </Card>
      )}

      {/* Results Section - Modern UI with badges and cards */}
      {completedResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Click any puzzle badge to view full analysis, or expand cards for details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-green-50 rounded border border-green-200">
                <div className="text-3xl font-bold text-green-700">{correctCount}</div>
                <div className="text-sm text-green-600">Correct</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded border border-red-200">
                <div className="text-3xl font-bold text-red-700">{incorrectCount}</div>
                <div className="text-sm text-red-600">Incorrect</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded border border-blue-200">
                <div className="text-3xl font-bold text-blue-700">{completedResults.length}</div>
                <div className="text-sm text-blue-600">Total</div>
              </div>
            </div>

            {/* Clickable Puzzle Badge Grid */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Completed Puzzles (Click to View)</Label>
              <div className="grid grid-cols-6 gap-2">
                {completedResults.map(r => (
                  <ClickablePuzzleBadge
                    key={r.puzzleId}
                    puzzleId={r.puzzleId}
                    variant={r.correct ? 'success' : 'error'}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results with Filtering */}
      {completedResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detailed Results</CardTitle>
                <CardDescription>
                  Filter and browse completed analyses
                </CardDescription>
              </div>

              {/* Correctness Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <ToggleGroup
                  type="single"
                  value={correctnessFilter}
                  onValueChange={(value) => setCorrectnessFilter(value as 'all' | 'correct' | 'incorrect' || 'all')}
                  className="bg-white border border-gray-200 rounded-md"
                >
                  <ToggleGroupItem value="all" className="text-xs px-3 py-1">
                    All ({completedResults.length})
                  </ToggleGroupItem>
                  <ToggleGroupItem value="correct" className="text-xs px-3 py-1 text-green-700 data-[state=on]:bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Correct ({correctCount})
                  </ToggleGroupItem>
                  <ToggleGroupItem value="incorrect" className="text-xs px-3 py-1 text-red-700 data-[state=on]:bg-red-100">
                    <XCircle className="h-3 w-3 mr-1" />
                    Incorrect ({incorrectCount})
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredResults.map((result) => (
                <Card key={result.puzzleId} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ClickablePuzzleBadge
                          puzzleId={result.puzzleId}
                          variant={result.correct ? 'success' : 'error'}
                          className="font-mono"
                        />
                        {result.correct ? (
                          <div className="flex items-center gap-1 text-green-700">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Correct</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-700">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Incorrect</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {result.processingTimeMs && (
                          <span>{(result.processingTimeMs / 1000).toFixed(1)}s</span>
                        )}
                        {result.analysisId && (
                          <Badge variant="outline" className="text-xs">
                            Analysis #{result.analysisId}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {result.error && (
                      <div className="mt-2 text-xs text-red-600">
                        Error: {result.error}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredResults.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>
                  No {correctnessFilter === 'correct' ? 'correct' : 'incorrect'} results found.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setCorrectnessFilter('all')}
                >
                  Show All Results
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Session Info */}
      {sessionId && (
        <Alert>
          <AlertDescription>
            <span className="font-mono text-sm">Session ID: {sessionId}</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
