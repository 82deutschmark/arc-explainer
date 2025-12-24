/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Beetree Ensemble Solver - Multi-model consensus ARC solver.
 * Testing: 3 models (Claude Sonnet, GPT-5.1, Gemini-3), ~$0.50-$2, 2-6 min
 * Production: 8 models with extended thinking, ~$15-$50, 20-45 min
 *
 * SRP/DRY check: Pass - Uses shadcn/ui and existing patterns
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { ArrowLeft, Play, Square, Trees, AlertTriangle, Clock, DollarSign, Zap, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { usePuzzle } from '@/hooks/usePuzzle';
import { useBeetreeRun } from '@/hooks/useBeetreeRun';
import { PuzzleGridDisplay } from '@/components/puzzle/PuzzleGridDisplay';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';

// Model configurations for each mode (must match solver_engine.py)
const TESTING_MODELS = {
  step1: ['gpt-5.1-codex-mini', 'gpt-5.1-codex-mini', 'gpt-5.1-codex-mini'],
  step3: ['gpt-5.1-codex-mini', 'gpt-5.1-codex-mini'],
  step5: ['gpt-5.1-codex-mini', 'gpt-5.1-codex-mini'],
  hintModel: 'gpt-5.1-codex-mini'
};

const PRODUCTION_MODELS = {
  step1: [
    'gemini-3-high', 'gemini-3-high', 'gemini-3-high', 'gemini-3-high',
    'gemini-3-high', 'gemini-3-high', 'gemini-3-high', 'gemini-3-high'
  ],
  step3: [
    'gemini-3-high', 'gemini-3-high', 'gemini-3-high',
    'gemini-3-high', 'gemini-3-high', 'gemini-3-high'
  ],
  step5: [
    'gemini-3-high', 'gemini-3-high', 'gemini-3-high',
    'gemini-3-high', 'gemini-3-high', 'gemini-3-high'
  ],
  hintModel: 'gemini-3-high'
};


export default function BeetreeSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { status, progress, results, cost, error, startAnalysis, cancelAnalysis, clearResults } = useBeetreeRun();

  // Settings
  const [mode, setMode] = useState<'testing' | 'production'>('testing');
  const [showConfirm, setShowConfirm] = useState(false);

  const isRunning = status === 'running';
  const isDone = status === 'completed';
  const hasError = status === 'error';
  const isIdle = !isRunning && !isDone && !hasError;

  // Auto-scroll for progress log
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [progress.length]);

  // Get models for selected mode
  const modelConfig = useMemo(() => mode === 'testing' ? TESTING_MODELS : PRODUCTION_MODELS, [mode]);
  const uniqueModels = useMemo(() => {
    const all = [...modelConfig.step1, ...modelConfig.step3, ...modelConfig.step5];
    return [...new Set(all)];
  }, [modelConfig]);

  const totalRuns = useMemo(() => {
    return modelConfig.step1.length + modelConfig.step3.length + modelConfig.step5.length;
  }, [modelConfig]);

  const totalModelCallsFromCost = useMemo(() => {
    if (!cost) return 0;
    return cost.by_model.reduce((sum, model) => sum + (model.calls ?? 0), 0);
  }, [cost]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!isRunning) return isDone ? 100 : 0;
    const stepProgress = progress.filter(p => p.stage?.includes('Step')).length;
    return Math.min((stepProgress / 5) * 100, 95); // 5 steps total
  }, [progress, isRunning, isDone]);

  // Format cost
  const formatCost = (val: number) => `$${val.toFixed(2)}`;

  // Loading state
  if (isLoadingTask) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="ml-2 text-muted-foreground">Loading puzzle...</span>
      </div>
    );
  }

  const expectedGrid = task?.test?.[0]?.output;

  // Error states
  if (!taskId || taskError || !task) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {!taskId ? 'No puzzle ID provided' : taskError?.message || 'Failed to load puzzle'}
          </AlertDescription>
        </Alert>
        <Link href="/">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  const handleStart = () => {
    if (mode === 'production') {
      setShowConfirm(true);
      return;
    }
    doStart();
  };

  const doStart = () => {
    setShowConfirm(false);
    startAnalysis({
      taskId: taskId!,
      testIndex: 0,
      mode,
      runTimestamp: `beetree_${Date.now()}`
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/task/${taskId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Puzzle
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Trees className="w-5 h-5 text-emerald-600" />
                Beetree Ensemble Solver
              </h1>
              <p className="text-sm text-muted-foreground">Task: {taskId}</p>
            </div>
          </div>

          {isRunning && (
            <Button variant="destructive" size="sm" onClick={cancelAnalysis}>
              <Square className="w-4 h-4 mr-2" />
              Stop Analysis
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Configuration (Idle State) */}
        {isIdle && (
          <div className="space-y-6">
            {/* Mode Selection Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Beetree Ensemble Mode
                </CardTitle>
                <CardDescription>
                  Beetree is a <strong>pre-configured ensemble solver</strong> - you cannot select individual models.
                  Choose between Testing (faster/cheaper) or Production (comprehensive/expensive) mode.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mode Selector */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ensemble Mode</label>
                    <Select value={mode} onValueChange={(v: 'testing' | 'production') => setMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="testing">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-700">Testing</Badge>
                            <span className="text-sm">3 models, quick & cheap</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="production">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">Production</Badge>
                            <span className="text-sm">8 models with extended thinking</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cost/Time Summary */}
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> Estimated Cost
                      </span>
                      <span className={`font-bold ${mode === 'testing' ? 'text-green-600' : 'text-amber-600'}`}>
                        {mode === 'testing' ? '$0.10 - $0.50' : '$5 - $20'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Duration
                      </span>
                      <span className="font-medium">
                        {mode === 'testing' ? '1-3 minutes' : '10-30 minutes'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Model Runs (all calls)</span>
                      <span className="font-medium">
                        {mode === 'testing' ? '7 runs (3+2+2)' : '20 runs (8+6+6)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pre-configured Models - Always Visible */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Pre-configured Models ({uniqueModels.length} unique types, {totalRuns} total runs)</h3>
                    <Badge variant={mode === 'testing' ? 'secondary' : 'default'} className={mode === 'production' ? 'bg-amber-100 text-amber-800' : ''}>
                      {mode === 'testing' ? 'Testing Mode' : 'Production Mode'}
                    </Badge>
                  </div>
                  
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Fixed Ensemble</AlertTitle>
                    <AlertDescription>
                      These models are hard-coded in the Beetree solver. You cannot change them - only switch between Testing and Production mode.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    {/* Step 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Step 1</Badge>
                        <span className="text-sm text-muted-foreground">Shallow Search - Initial parallel runs</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4">
                        {modelConfig.step1.map((m, i) => (
                          <Badge key={`s1-${i}`} variant="secondary" className="text-xs font-mono">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Step 2</Badge>
                        <span className="text-sm text-muted-foreground">Evaluation - Check against training examples</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4 italic">
                        (Validation step - no model calls)
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Step 3</Badge>
                        <span className="text-sm text-muted-foreground">Extended Search - Additional models on unsolved</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4">
                        {modelConfig.step3.map((m, i) => (
                          <Badge key={`s3-${i}`} variant="secondary" className="text-xs font-mono">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Step 4</Badge>
                        <span className="text-sm text-muted-foreground">Evaluation - Re-check with hints</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4 italic">
                        (Validation step - no model calls)
                      </p>
                    </div>

                    {/* Step 5 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Step 5</Badge>
                        <span className="text-sm text-muted-foreground">Full Search - Final comprehensive attempt</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4">
                        {modelConfig.step5.map((m, i) => (
                          <Badge key={`s5-${i}`} variant="secondary" className="text-xs font-mono">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Hint Model */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50">Hint Generation</Badge>
                        <span className="text-sm text-muted-foreground">Model used to generate hints between steps</span>
                      </div>
                      <div className="ml-4">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {modelConfig.hintModel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Start Button */}
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleStart} 
                    size="lg" 
                    className={mode === 'production' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start {mode === 'testing' ? 'Testing' : 'Production'} Analysis
                  </Button>
                  {mode === 'production' && (
                    <p className="text-sm text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      High cost mode - confirmation required
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Puzzle Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Puzzle Preview</CardTitle>
                <CardDescription>
                  Training examples: {task.train.length} • Test cases: {task.test.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PuzzleGridDisplay
                  task={task}
                  showEmojis={false}
                  showColorOnly={false}
                  emojiSet={DEFAULT_EMOJI_SET}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Running/Done State */}
        {(isRunning || isDone || hasError) && (
          <div className="space-y-6">
            {/* Progress Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {isRunning ? 'Running ensemble...' : isDone ? 'Complete!' : 'Error'}
                    </span>
                    <span className="text-muted-foreground">{progressPercent.toFixed(0)}%</span>
                  </div>
                  <Progress value={progressPercent} className={hasError ? 'bg-red-100' : ''} />
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left: Progress & Logs */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Progress Log</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {progress.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Waiting for events...</p>
                      ) : (
                        progress.map((p, i) => {
                          const isLog = p.stage === 'Log';
                          return (
                            <div
                              key={i}
                              className={
                                isLog
                                  ? 'text-xs border-l-2 border-muted-foreground/40 pl-3 py-1 font-mono'
                                  : 'text-sm border-l-2 border-emerald-500 pl-3 py-1'
                              }
                            >
                              {isLog ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={
                                      p.status === 'error'
                                        ? 'px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] uppercase tracking-wide'
                                        : 'px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wide'
                                    }
                                  >
                                    {p.status || 'info'}
                                  </span>
                                  <span className="truncate max-w-[220px]">
                                    {p.event}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium">{p.stage}</div>
                                  <div className="text-muted-foreground text-xs">
                                    {p.status} {p.event && `• ${p.event}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Center: Results */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {isDone ? 'Result' : isRunning ? 'Processing...' : 'Error'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isRunning && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Running {mode === 'testing' ? '3' : '8'} models in parallel...
                      </p>
                    </div>
                  )}
                  {isDone && results && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start justify-center">
                        <div className="text-center">
                          <p className="text-xs font-medium text-muted-foreground mb-2">GROUND TRUTH</p>
                          {expectedGrid && (
                            <div className="inline-block">
                              <PuzzleGrid
                                grid={expectedGrid}
                                title=""
                                showEmojis={false}
                                emojiSet={DEFAULT_EMOJI_SET}
                                compact
                                maxWidth={180}
                                maxHeight={180}
                              />
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-muted-foreground mb-2">CONSENSUS PREDICTION</p>
                          {results.predictions?.[0] && (
                            <div className="inline-block">
                              <PuzzleGrid
                                grid={results.predictions[0]}
                                title=""
                                showEmojis={false}
                                emojiSet={DEFAULT_EMOJI_SET}
                                compact
                                maxWidth={180}
                                maxHeight={180}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-muted rounded p-2 text-center">
                          <div className="text-xs text-muted-foreground">Consensus</div>
                          <div className="font-bold text-lg">
                            {((results.consensus?.strength ?? 0) * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="bg-muted rounded p-2 text-center">
                          <div className="text-xs text-muted-foreground">Agreement</div>
                          <div className="font-bold text-lg">
                            {results.consensus?.agreement_count ?? 0} models
                          </div>
                        </div>
                      </div>
                      <Button onClick={clearResults} variant="outline" className="w-full">
                        Run Again
                      </Button>
                    </div>
                  )}
                  {hasError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Analysis Failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Right: Cost Breakdown */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {cost ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-emerald-50 rounded p-3 text-center">
                          <div className="text-xs text-emerald-600">Total Cost</div>
                          <div className="font-bold text-xl text-emerald-700">
                            {formatCost(cost.total_cost)}
                          </div>
                        </div>
                        <div className="bg-muted rounded p-3 text-center">
                          <div className="text-xs text-muted-foreground">Unique Model Types</div>
                          <div className="font-bold text-xl">{cost.by_model.length}</div>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center">
                        {totalModelCallsFromCost > 0 ? (
                          <>
                            Total cost comes from{' '}
                            <span className="font-semibold">{totalModelCallsFromCost} model run{totalModelCallsFromCost === 1 ? '' : 's'}</span>
                            {cost.by_model.length === 1 && (
                              <>
                                {' '}of{' '}
                                <span className="font-semibold">{cost.by_model[0].model_name}</span>
                              </>
                            )}
                            . The tile above shows the number of{' '}
                            <span className="font-semibold">distinct model types</span>, not calls.
                          </>
                        ) : (
                          <>
                            Total cost includes{' '}
                            <span className="font-semibold">all BeeTree model runs</span> across steps 1, 3, and 5. The tile above shows the number of{' '}
                            <span className="font-semibold">distinct model types</span>, not calls.
                          </>
                        )}
                      </p>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">TOKEN USAGE</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-muted-foreground">Input</div>
                            <div className="font-mono font-medium">{cost.total_tokens.input.toLocaleString()}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground">Output</div>
                            <div className="font-mono font-medium">{cost.total_tokens.output.toLocaleString()}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground">Reasoning</div>
                            <div className="font-mono font-medium">{cost.total_tokens.reasoning.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-2">BY MODEL</p>
                          {cost.by_model.map((m, i) => {
                            const calls = m.calls ?? 0;
                            return (
                              <div key={i} className="flex justify-between text-xs py-1">
                                <div className="flex flex-col">
                                  <span className="truncate max-w-[160px] font-mono">{m.model_name}</span>
                                  {calls > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {calls} run{calls === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium">{formatCost(m.cost)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Cost data will appear here...
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* Production Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Production Mode
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Production mode runs <strong>Gemini 3 Pro (High)</strong> with 20 parallel calls:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Step 1: 8x Gemini 3 Pro High</li>
                  <li>Step 3: 6x Gemini 3 Pro High</li>
                  <li>Step 5: 6x Gemini 3 Pro High (with deep thinking, images, hints)</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                  <p className="font-semibold">Estimated Cost: $5 - $20</p>
                  <p className="text-sm">Duration: 10 - 30 minutes</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doStart} className="bg-amber-600 hover:bg-amber-700">
              <DollarSign className="w-4 h-4 mr-2" />
              Start Production Analysis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
