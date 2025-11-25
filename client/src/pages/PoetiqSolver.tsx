/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * PURPOSE: Poetiq Iterative Code-Generation Solver page.
 *          Shows puzzle, model selection, and real-time solver progress.
 *          Uses OpenRouter to avoid direct API rate limits.
 * 
 * SRP/DRY check: Pass - UI only, delegates to usePoetiqProgress hook
 * shadcn/ui: Pass - Uses shadcn components
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { 
  Loader2, ArrowLeft, Play, Square, CheckCircle, XCircle, 
  Code, Settings, Zap, Clock 
} from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

// Available models
const MODELS = [
  { id: 'openrouter/google/gemini-3-pro-preview', name: 'Gemini 3 Pro (OpenRouter)', recommended: true },
  { id: 'openrouter/google/gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash (OpenRouter)', recommended: true },
  { id: 'openrouter/anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (OpenRouter)', recommended: false },
  { id: 'gemini/gemini-3-pro-preview', name: 'Gemini 3 Pro (Direct - may rate limit)', recommended: false },
];

export default function PoetiqSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel, sessionId } = usePoetiqProgress(taskId);
  
  const [model, setModel] = useState(MODELS[0].id);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Set page title
  useEffect(() => {
    document.title = taskId ? `Poetiq Solver - ${taskId}` : 'Poetiq Code-Generation Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  // Track elapsed time
  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(new Date());
    } else if (!isRunning) {
      setStartTime(null);
    }
  }, [isRunning, startTime]);

  useEffect(() => {
    if (isRunning && startTime) {
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, startTime]);

  const handleStart = () => {
    start({ model });
  };

  if (!taskId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-red-600">Invalid puzzle ID</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading puzzle...</span>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-red-600">Failed to load puzzle: {taskError?.message || 'Not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/puzzle/${taskId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Puzzle
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Poetiq Solver</h1>
            <p className="text-sm text-gray-500">Puzzle: {taskId}</p>
          </div>
        </div>

        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Select model and start the iterative code-generation solver
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.recommended && (
                        <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                OpenRouter models avoid direct API rate limits
              </p>
            </div>

            <div className="flex gap-2">
              {!isRunning ? (
                <Button onClick={handleStart} disabled={isRunning}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Solver
                </Button>
              ) : (
                <Button onClick={cancel} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Card */}
        {state.status !== 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isRunning && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                {isDone && state.result?.isPredictionCorrect && <CheckCircle className="h-5 w-5 text-green-500" />}
                {isDone && !state.result?.isPredictionCorrect && <XCircle className="h-5 w-5 text-red-500" />}
                {hasError && <XCircle className="h-5 w-5 text-red-500" />}
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-4">
                <Badge variant={
                  isRunning ? 'default' :
                  isDone && state.result?.isPredictionCorrect ? 'default' :
                  'destructive'
                }>
                  {state.status.toUpperCase()}
                </Badge>
                {state.phase && (
                  <span className="text-sm text-gray-600">{state.phase}</span>
                )}
                {isRunning && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>

              {/* Message */}
              {state.message && (
                <p className="text-sm text-gray-700">{state.message}</p>
              )}

              {/* Iteration progress */}
              {state.iteration !== undefined && state.totalIterations && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Iteration</span>
                    <span>{state.iteration} / {state.totalIterations}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(state.iteration / state.totalIterations) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Result */}
              {isDone && state.result && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {state.result.isPredictionCorrect ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="font-semibold text-green-700">CORRECT</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="font-semibold text-red-700">INCORRECT</span>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Iterations:</span>
                        <span className="ml-2">{state.result.iterationCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>
                        <span className="ml-2">{Math.round((state.result.elapsedMs || 0) / 1000)}s</span>
                      </div>
                      {state.result.bestTrainScore !== undefined && (
                        <div>
                          <span className="text-gray-500">Train Accuracy:</span>
                          <span className="ml-2">{(state.result.bestTrainScore * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Generated Code */}
              {state.result?.generatedCode && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      <span className="font-medium">Generated Code</span>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                      {state.result.generatedCode}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">About Poetiq Solver</p>
                <p className="mt-1">
                  Poetiq uses iterative code generation to solve ARC puzzles. It generates Python 
                  <code className="mx-1 bg-blue-100 px-1 rounded">transform()</code>
                  functions, tests them on training examples, and refines until successful.
                </p>
                <p className="mt-2">
                  <strong>94 puzzles</strong> from the ARC-AGI 2025 evaluation set remain untested.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
