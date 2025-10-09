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
  const [showPuzzleDetails, setShowPuzzleDetails] = React.useState(true);
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
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/puzzle/${taskId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Grover Iterative Solver</h1>
            <p className="text-gray-600">Task {taskId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <GroverModelSelect value={model} onChange={setModel} disabled={isRunning} />
          <Button onClick={onStart} disabled={isRunning} className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {isRunning ? 'Running…' : 'Start Analysis'}
          </Button>
        </div>
      </div>

      {/* Compact Status Bar */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
            <Badge variant={isDone ? 'default' : hasError ? 'destructive' : 'secondary'}>
              {state.status}
            </Badge>
          </div>
          {state.iteration !== undefined && (
            <span className="text-gray-600">
              Iteration: <strong>{state.iteration}/{state.totalIterations || 5}</strong>
            </span>
          )}
          {state.bestScore !== undefined && (
            <Badge variant="default" className="bg-green-600">
              Best: {state.bestScore.toFixed(1)}/10
            </Badge>
          )}
          {startTime && (
            <Badge variant="outline">{getElapsedTime()}</Badge>
          )}
        </div>
        {state.message && (
          <span className="text-gray-600 text-xs max-w-md truncate">{state.message}</span>
        )}
      </div>

      {/* Iteration Results */}
      {state.iterations && state.iterations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Iteration History ({state.iterations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {state.iterations.map((iter) => (
                <div key={iter.iteration} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">Iteration {iter.iteration + 1}</h3>
                    <Badge variant="default">
                      Best: {iter.best.score.toFixed(1)}/10
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Generated {iter.programs.length} programs
                  </div>
                  {iter.best.code && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                        View Best Program
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
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

      {/* Best Program */}
      {state.bestProgram && isDone && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Final Best Program
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-gray-900 text-gray-100 rounded overflow-x-auto">
              <code>{state.bestProgram}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Console Log - Prominent */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Terminal className="h-4 w-4" />
            Live Console Output
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            ref={logRef}
            className="bg-black text-green-400 p-3 font-mono text-xs leading-relaxed h-[400px] overflow-y-auto whitespace-pre-wrap"
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          >
            {state.logLines && state.logLines.length > 0 ? (
              state.logLines.map((line, idx) => (
                <div key={idx} className="hover:bg-gray-900">{line}</div>
              ))
            ) : (
              <div className="text-gray-600">Waiting for analysis to start...</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Puzzle Details */}
      {showPuzzleDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Puzzle Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Training Examples ({task.train.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {task.train.map((example, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-sm font-medium">Example {idx + 1}</p>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Input</p>
                          <PuzzleGrid grid={example.input} title="Input" showEmojis={false} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Output</p>
                          <PuzzleGrid grid={example.output} title="Output" showEmojis={false} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Test Input</h3>
                <PuzzleGrid grid={task.test[0]?.input || []} title="Test" showEmojis={false} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert className="mt-6">
        <AlertDescription>
          Grover uses quantum-inspired amplitude amplification: generates Python code, executes on training examples, grades results (0-10), and amplifies successful patterns over multiple iterations.
          {' '}
          <a 
            href="https://github.com/zoecarver/grover-arc" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline font-medium text-blue-800 hover:text-blue-900"
          >
            Learn more
          </a>
        </AlertDescription>
      </Alert>
    </div>
  );
}
