/**
 * client/src/pages/GroverSolver.tsx
 * 
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Grover Iterative Solver page - shows real-time iteration progress,
 * code generation, execution results, and grading scores. Displays quantum-inspired
 * amplitude amplification process with best/worst program tracking.
 * 
 * SRP/DRY check: Pass - UI only, delegates to useGroverProgress hook
 * shadcn/ui: Pass - Uses shadcn components throughout
 */

import React from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Rocket, Terminal, Code, TrendingUp } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useGroverProgress } from '@/hooks/useGroverProgress';
import GroverModelSelect, { type GroverModelKey } from '@/components/grover/GroverModelSelect';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';

export default function GroverSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, sessionId } = useGroverProgress(taskId);
  const [model, setModel] = React.useState<GroverModelKey>('grover-gpt-5-nano');
  const [startTime, setStartTime] = React.useState<Date | null>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  // Set page title
  React.useEffect(() => {
    document.title = taskId ? `Grover Solver - ${taskId}` : 'Grover Iterative Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  // Auto-scroll log
  React.useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.logLines]);

  // Track start time
  React.useEffect(() => {
    if (state.status === 'running' && !startTime) {
      setStartTime(new Date());
    } else if (state.status !== 'running') {
      setStartTime(null);
    }
  }, [state.status, startTime]);

  // Force re-render for timer
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setTick(tick => tick + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>Invalid puzzle ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle…</span>
          </div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const onStart = () => start({ 
    modelKey: model,
    temperature: 0.2,
    maxIterations: 5
  });

  const getElapsedTime = () => {
    if (!startTime) return null;
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-3 max-w-6xl">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link href={`/puzzle/${taskId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Grover Solver</h1>
            <p className="text-xs text-gray-600">{taskId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GroverModelSelect value={model} onChange={setModel} disabled={isRunning} />
          <Button onClick={onStart} disabled={isRunning} size="sm" className="flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            {isRunning ? 'Running…' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Compact Status Bar */}
      <div className="mb-2 p-2 bg-gray-50 rounded border flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
            <Badge variant={isDone ? 'default' : hasError ? 'destructive' : 'secondary'} className="text-xs py-0">
              {state.status}
            </Badge>
          </div>
          {state.iteration !== undefined && (
            <span className="text-gray-600 text-xs">
              Iter: <strong>{state.iteration}/{state.totalIterations || 5}</strong>
            </span>
          )}
          {state.bestScore !== undefined && (
            <Badge variant="default" className="bg-green-600 text-xs py-0">
              {state.bestScore.toFixed(1)}/10
            </Badge>
          )}
          {startTime && (
            <Badge variant="outline" className="text-xs py-0">{getElapsedTime()}</Badge>
          )}
        </div>
        {state.message && (
          <span className="text-gray-600 text-xs max-w-md truncate">{state.message}</span>
        )}
      </div>

      {/* Iteration Results - Compact */}
      {state.iterations && state.iterations.length > 0 && (
        <Card className="mb-3">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
              <TrendingUp className="h-3 w-3" />
              Iterations ({state.iterations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-1">
            <div className="space-y-2">
              {state.iterations.map((iter) => (
                <div key={iter.iteration} className="border rounded p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">#{iter.iteration + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{iter.programs.length} programs</span>
                      <Badge variant="default" className="text-xs py-0">
                        {iter.best.score.toFixed(1)}/10
                      </Badge>
                    </div>
                  </div>
                  {iter.best.code && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                        Code
                      </summary>
                      <pre className="mt-1 p-1.5 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto leading-tight">
                        <code>{iter.best.code}</code>
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Program - Compact */}
      {state.bestProgram && isDone && (
        <Card className="mb-3">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
              <Code className="h-3 w-3" />
              Best Program
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-1">
            <pre className="p-2 bg-gray-900 text-gray-100 rounded overflow-x-auto text-xs leading-tight">
              <code>{state.bestProgram}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Console Log - Compact */}
      <Card className="mb-3">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
            <Terminal className="h-3 w-3" />
            Console
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            ref={logRef}
            className="bg-black text-green-400 p-2 font-mono text-xs leading-tight h-[200px] overflow-y-auto whitespace-pre-wrap"
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          >
            {state.logLines && state.logLines.length > 0 ? (
              state.logLines.map((line, idx) => (
                <div key={idx} className="hover:bg-gray-900">{line}</div>
              ))
            ) : (
              <div className="text-gray-600">Waiting...</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="text-xs text-gray-500 text-center py-2">
        Grover: Iterative code generation with execution feedback. <Link href={`/puzzle/${taskId}`} className="underline">View puzzle details</Link>
      </div>
    </div>
  );
}
