/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * PURPOSE: Poetiq Iterative Code-Generation Solver page with BYO API key support.
 *          Users can bring their own Gemini or OpenRouter key to run the solver.
 *          Supports configurable expert count (1, 2, 4, 8).
 * 
 * SRP/DRY check: Pass - UI only, delegates to usePoetiqProgress hook
 * shadcn/ui: Pass - Uses shadcn components
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { 
  Loader2, ArrowLeft, Play, Square, CheckCircle, XCircle, 
  Code, Settings, Zap, Clock, Key, Users, AlertTriangle, 
  BarChart3, RefreshCw, Target
} from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { useArc2EvalProgress } from '@/hooks/useArc2EvalProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Expert configuration presets (from Poetiq docs)
const EXPERT_OPTIONS = [
  { value: '1', label: '1 Expert (Gemini-3-a)', description: 'Fastest, lowest cost' },
  { value: '2', label: '2 Experts (Gemini-3-b)', description: 'Default, good balance' },
  { value: '4', label: '4 Experts', description: 'Better accuracy' },
  { value: '8', label: '8 Experts (Gemini-3-c)', description: 'Best accuracy, slowest' },
];

// Provider options
const PROVIDERS = [
  { value: 'gemini', label: 'Gemini Direct', description: 'Use your Google AI Studio API key' },
  { value: 'openrouter', label: 'OpenRouter', description: 'Use your OpenRouter API key' },
];

export default function PoetiqSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = usePoetiqProgress(taskId);
  const arc2EvalProgress = useArc2EvalProgress();
  
  // Configuration state
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [numExperts, setNumExperts] = useState('2'); // Default: 2 experts (Gemini-3-b)
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Set page title
  useEffect(() => {
    document.title = taskId ? `Poetiq Solver - ${taskId}` : 'Poetiq Code-Generation Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';
  const canStart = apiKey.trim().length > 10 && !isRunning;

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
    start({
      apiKey,
      provider,
      numExperts: parseInt(numExperts, 10),
    });
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

        {/* BYO API Key Card */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-600" />
              Bring Your Own API Key
            </CardTitle>
            <CardDescription>
              Your API key is used only for this run and is <strong>never stored</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Provider
              </Label>
              <Select 
                value={provider} 
                onValueChange={(v) => setProvider(v as 'gemini' | 'openrouter')} 
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-xs text-gray-500">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {provider === 'gemini' ? 'Gemini API Key' : 'OpenRouter API Key'}
              </Label>
              <Input
                type="password"
                placeholder={provider === 'gemini' 
                  ? 'AIza... (from Google AI Studio)' 
                  : 'sk-or-... (from OpenRouter)'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isRunning}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                {provider === 'gemini' 
                  ? 'Get your key from Google AI Studio → aistudio.google.com' 
                  : 'Get your key from OpenRouter → openrouter.ai/keys'}
              </p>
            </div>

            <Separator />

            {/* Expert Count Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Number of Experts
              </Label>
              <Select 
                value={numExperts} 
                onValueChange={setNumExperts}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-gray-500">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                More experts = better accuracy but longer runtime and higher cost.
              </p>
            </div>

            {/* Warning for 8 experts */}
            {numExperts === '8' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  8 experts will make many parallel API calls. This may take 15-30+ minutes per puzzle
                  and consume significant API quota.
                </p>
              </div>
            )}

            <Separator />

            {/* Start/Cancel Button */}
            <div className="flex gap-3">
              {!isRunning ? (
                <Button 
                  onClick={handleStart} 
                  disabled={!canStart}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start Poetiq Solver
                </Button>
              ) : (
                <Button onClick={cancel} variant="destructive" className="flex-1" size="lg">
                  <Square className="h-5 w-5 mr-2" />
                  Cancel
                </Button>
              )}
            </div>

            {!canStart && !isRunning && (
              <p className="text-center text-sm text-gray-500">
                Enter your API key to start the solver.
              </p>
            )}
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
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">How Poetiq Works</p>
                <p className="mt-1">
                  Poetiq uses iterative code generation to solve ARC puzzles. It generates Python 
                  <code className="mx-1 bg-blue-100 px-1 rounded">transform()</code>
                  functions, tests them on training examples, and refines until successful.
                </p>
              </div>
            </div>

            <Separator className="bg-blue-200" />

            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Expert Configurations</p>
                <ul className="mt-1 space-y-1">
                  <li><strong>Gemini-3-a (1 expert):</strong> Fast, ~5-15 min per puzzle</li>
                  <li><strong>Gemini-3-b (2 experts):</strong> Default, balanced accuracy</li>
                  <li><strong>Gemini-3-c (8 experts):</strong> Best accuracy, 15-30+ min</li>
                </ul>
              </div>
            </div>

            <Separator className="bg-blue-200" />

            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Your API Key is Safe</p>
                <p className="mt-1">
                  Your key is passed directly to the solver process and is <strong>never logged, 
                  stored, or transmitted</strong> anywhere else. Each run is isolated.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
