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
import { Loader2, ArrowLeft, Rocket } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useGroverProgress } from '@/hooks/useGroverProgress';
import GroverModelSelect, { type GroverModelKey } from '@/components/grover/GroverModelSelect';
import { IterationCard } from '@/components/grover/IterationCard';
import { LiveActivityStream } from '@/components/grover/LiveActivityStream';
import { SearchVisualization } from '@/components/grover/SearchVisualization';
import { ConversationChainViewer } from '@/components/grover/ConversationChainViewer';

export default function GroverSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, sessionId } = useGroverProgress(taskId);
  const [model, setModel] = React.useState<GroverModelKey>('grover-gpt-5-nano');
  const [startTime, setStartTime] = React.useState<Date | null>(null);

  // Set page title
  React.useEffect(() => {
    document.title = taskId ? `Grover Solver - ${taskId}` : 'Grover Iterative Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

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

      {/* Iteration Timeline */}
      <div className="mb-3 space-y-0">
        {/* Render all iterations (completed, active, and queued) */}
        {Array.from({ length: state.totalIterations || 5 }).map((_, idx) => {
          const iterNum = idx + 1;
          const iterData = state.iterations?.find(it => it.iteration === idx);
          const isActive = isRunning && state.iteration === iterNum;
          
          // Calculate best overall score up to this point
          const bestOverall = state.iterations
            ?.filter(it => it.iteration < idx)
            .reduce((max, it) => Math.max(max, it.best?.score || 0), 0) || 0;
          
          return (
            <IterationCard
              key={iterNum}
              iteration={iterNum}
              data={iterData}
              isActive={isActive}
              phase={isActive ? state.phase : undefined}
              message={isActive ? state.message : undefined}
              bestOverall={bestOverall > 0 ? bestOverall : undefined}
              promptPreview={isActive ? state.promptPreview : undefined}
              conversationChain={isActive ? state.conversationChain : undefined}
              tokenUsage={isActive ? state.tokenUsage : undefined}
            />
          );
        })}
      </div>

      {/* Search Visualization */}
      {state.iterations && state.iterations.length > 0 && (
        <div className="mb-3">
          <SearchVisualization 
            iterations={state.iterations}
            currentIteration={state.iteration}
          />
        </div>
      )}

      {/* Conversation Chain */}
      <div className="mb-3">
        <ConversationChainViewer
          hasChain={isRunning || isDone}
          iterationCount={state.iterations?.length || 0}
        />
      </div>

      {/* Live Activity Stream */}
      <div className="mb-3">
        <LiveActivityStream
          logs={state.logLines || []}
          maxHeight="200px"
        />
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 text-center py-2">
        Grover: Iterative code generation with execution feedback. <Link href={`/puzzle/${taskId}`} className="underline">View puzzle details</Link>
      </div>
    </div>
  );
}
