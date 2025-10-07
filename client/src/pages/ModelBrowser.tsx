/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Batch analysis UI for running models against puzzle datasets with pause/resume.
 *          Provides model selection, dataset selection, and real-time progress tracking.
 *          Uses existing ExaminerControls and ExaminerProgress components.
 *
 * SRP and DRY check: Pass - Single responsibility: batch analysis UI orchestration
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Database, Sparkles, AlertCircle } from 'lucide-react';
import ExaminerControls from '@/components/model-examiner/ExaminerControls';
import ExaminerProgress from '@/components/model-examiner/ExaminerProgress';
import { BatchResultsTable } from '@/components/batch/BatchResultsTable';
import { BatchActivityLog } from '@/components/batch/BatchActivityLog';
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

      {/* Results Table */}
      {status && status.results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Detailed results showing correct/incorrect predictions for each puzzle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BatchResultsTable results={status.results} />
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
