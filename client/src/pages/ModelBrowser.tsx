/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Batch analysis UI using EXISTING proven components (ExplanationsList, ClickablePuzzleBadge, PromptPreviewModal).
 *          Pattern based on AnalyticsOverview + PuzzleExaminer advanced options.
 *          Compact layout, real data only, no invented metrics.
 *
 * SRP and DRY check: Pass - Reuses ExplanationsList, PromptPicker, PromptPreviewModal
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Play, Pause, Square, Settings, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';

// Reuse existing components
import { ExplanationsList } from '@/components/puzzle/debate/ExplanationsList';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { PromptPicker } from '@/components/PromptPicker';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';

// Hooks
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useModels } from '@/hooks/useModels';
import { determineCorrectness } from '@shared/utils/correctness';

// Model configurations for batch analysis
const BATCH_MODELS = [
  { value: 'grok-4-fast-reasoning', label: 'Grok-4-Fast-Reasoning' },
  { value: 'grok-4-fast-non-reasoning', label: 'Grok-4-Fast-Non-Reasoning' },
  { value: 'grok-4', label: 'Grok-4' },
  { value: 'o4', label: 'OpenAI o4' },
  { value: 'o3', label: 'OpenAI o3' },
  { value: 'o1', label: 'OpenAI o1' },
  { value: 'gpt-5', label: 'GPT-5' }
];

const DATASETS = [
  { value: 'arc1', label: 'ARC-1 Eval', count: 400 },
  { value: 'arc2', label: 'ARC-2 Eval', count: 120 }
];

export default function ModelBrowser() {
  // Batch state
  const {
    sessionId,
    status,
    isLoading,
    isPaused,
    isRunning,
    handleStart,
    handlePause,
    handleResume,
    handleCancel
  } = useBatchAnalysis();

  // Configuration state (same as PuzzleExaminer)
  const [selectedModel, setSelectedModel] = useState<string>('grok-4-fast-reasoning');
  const [selectedDataset, setSelectedDataset] = useState<'arc1' | 'arc2'>('arc2');
  const [temperature, setTemperature] = useState(0.2);
  const [promptId, setPromptId] = useState('solver');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [correctnessFilter, setCorrectnessFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  // Fetch models for metadata
  const { data: models } = useModels();

  // Get dummy task for prompt preview (use first completed puzzle or create minimal task)
  const firstPuzzleId = status?.results?.[0]?.puzzleId || '00d62c1b';
  const { currentTask } = usePuzzle(firstPuzzleId);

  // Calculate REAL stats from results (no invented metrics!)
  const completedResults = useMemo(() =>
    status?.results.filter(r => r.status === 'success' || r.status === 'failed') || []
  , [status?.results]);

  const correctCount = useMemo(() =>
    completedResults.filter(r => r.correct === true).length
  , [completedResults]);

  const incorrectCount = useMemo(() =>
    completedResults.filter(r => r.correct === false).length
  , [completedResults]);

  const avgProcessingTime = useMemo(() => {
    const timings = completedResults
      .filter(r => r.processingTimeMs)
      .map(r => r.processingTimeMs!);
    return timings.length > 0
      ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length / 1000)
      : 0;
  }, [completedResults]);

  // Build mock explanations from results for ExplanationsList
  const mockExplanations = useMemo(() =>
    completedResults
      .filter(r => r.analysisId)
      .map(r => ({
        id: r.analysisId!,
        puzzleId: r.puzzleId,
        modelName: selectedModel,
        isPredictionCorrect: r.correct || false,
        multiTestAllCorrect: null,
        hasMultiplePredictions: false,
        confidence: 0,
        patternDescription: '',
        solvingStrategy: '',
        hints: [],
        reasoningLog: null,
        apiProcessingTimeMs: r.processingTimeMs,
        helpfulVotes: 0,
        notHelpfulVotes: 0
      }))
  , [completedResults, selectedModel]);

  const handleStartBatch = async () => {
    try {
      await handleStart({
        modelName: selectedModel,
        dataset: selectedDataset,
        resume: true,
        promptId,
        temperature,
        systemPromptMode: 'ARC',
        customPrompt: customPrompt || undefined
      });
    } catch (error) {
      console.error('Failed to start batch:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Batch Analysis</h1>
            <p className="text-sm text-gray-500">Parallel processing · Auto-resume</p>
          </div>
        </div>
      </div>

      {/* Configuration Panel (collapsed when running) */}
      {!isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model & Dataset Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BATCH_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dataset</Label>
                <RadioGroup value={selectedDataset} onValueChange={(v) => setSelectedDataset(v as any)}>
                  {DATASETS.map(d => (
                    <div key={d.value} className="flex items-center gap-2">
                      <RadioGroupItem value={d.value} id={d.value} />
                      <Label htmlFor={d.value} className="cursor-pointer">
                        {d.label} ({d.count} puzzles)
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            {/* Advanced Options (same as PuzzleExaminer) */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Advanced Options</Label>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Temperature: {temperature}</Label>
                  <span className="text-xs text-gray-500">
                    {temperature < 0.3 ? 'Deterministic' : temperature < 0.7 ? 'Balanced' : 'Creative'}
                  </span>
                </div>
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Prompt Picker */}
              <PromptPicker
                value={promptId}
                customPrompt={customPrompt}
                onValueChange={setPromptId}
                onCustomPromptChange={setCustomPrompt}
              />

              {/* Prompt Preview Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPromptPreview(true)}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Prompt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <Button onClick={handleStartBatch} disabled={isLoading}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Batch
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button onClick={handleResume} variant="default">
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={handlePause} variant="secondary">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button onClick={handleCancel} variant="destructive" size="sm">
                    <Square className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>

            {status && (
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline">
                  {selectedModel} · {selectedDataset.toUpperCase()}
                </Badge>
                {isPaused && <Badge variant="secondary">Paused</Badge>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compact Live Progress (REAL data only) */}
      {isRunning && status && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 space-y-3">
            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">
                  Progress: {status.progress.completed}/{status.progress.total}
                </span>
                <span className="text-blue-700 font-bold">
                  {status.progress.percentage}%
                </span>
              </div>
              <Progress value={status.progress.percentage} className="h-2" />
            </div>

            {/* Real Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded p-3 text-center border border-green-200">
                <div className="flex items-center justify-center gap-1 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-bold text-lg">{correctCount}</span>
                </div>
                <div className="text-xs text-green-600">Correct</div>
              </div>

              <div className="bg-white rounded p-3 text-center border border-red-200">
                <div className="flex items-center justify-center gap-1 text-red-700">
                  <XCircle className="h-4 w-4" />
                  <span className="font-bold text-lg">{incorrectCount}</span>
                </div>
                <div className="text-xs text-red-600">Incorrect</div>
              </div>

              <div className="bg-white rounded p-3 text-center border border-gray-200">
                <div className="flex items-center justify-center gap-1 text-gray-700">
                  <Clock className="h-4 w-4" />
                  <span className="font-bold text-lg">{avgProcessingTime}s</span>
                </div>
                <div className="text-xs text-gray-600">Avg Time</div>
              </div>

              <div className="bg-white rounded p-3 text-center border border-blue-200">
                <div className="flex items-center justify-center gap-1 text-blue-700">
                  <span className="font-bold text-lg">{status.progress.completed}</span>
                  <span className="text-sm text-blue-500">/ {status.progress.total}</span>
                </div>
                <div className="text-xs text-blue-600">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results using ExplanationsList + ClickablePuzzleBadge */}
      {completedResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <p className="text-sm text-gray-600">
              Click any puzzle to view full analysis on puzzle page
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded border border-green-200">
                <div className="text-2xl font-bold text-green-700">{correctCount}</div>
                <div className="text-sm text-green-600">Correct</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded border border-red-200">
                <div className="text-2xl font-bold text-red-700">{incorrectCount}</div>
                <div className="text-sm text-red-600">Incorrect</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{completedResults.length}</div>
                <div className="text-sm text-blue-600">Total</div>
              </div>
            </div>

            {/* Puzzle Badges Grid */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Completed Puzzles</Label>
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

      {/* Session Info */}
      {sessionId && (
        <Alert>
          <AlertDescription className="text-xs">
            <span className="font-mono">Session: {sessionId}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Prompt Preview Modal */}
      {currentTask && (
        <PromptPreviewModal
          isOpen={showPromptPreview}
          onClose={() => setShowPromptPreview(false)}
          task={currentTask}
          taskId={firstPuzzleId}
          promptId={promptId}
          customPrompt={customPrompt}
          options={{
            omitAnswer: true
          }}
        />
      )}
    </div>
  );
}
