/**
 * client/src/pages/SaturnVisualSolver.tsx
 *
 * Saturn Visual Solver page - redesigned for clarity and better UX.
 * Features a streamlined single-column layout with clear sections for:
 * - Puzzle overview and controls
 * - Live progress and reasoning
 * - Console output and image gallery
 *
 * Author: Cascade (model: Cascade)
 */

import React from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Rocket, Terminal, Brain, Eye, RotateCcw } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useSaturnProgress } from '@/hooks/useSaturnProgress';
import SaturnModelSelect, { type SaturnModelKey } from '@/components/saturn/SaturnModelSelect';
import SaturnImageGallery from '@/components/saturn/SaturnImageGallery';
import CompactGrid from '@/components/saturn/CompactGrid';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, sessionId } = useSaturnProgress(taskId);
  const [model, setModel] = React.useState<SaturnModelKey>('GPT-5');
  const [showPuzzleDetails, setShowPuzzleDetails] = React.useState(false);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll log to bottom when new lines arrive
  React.useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.logLines]);

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

  const onStart = () => start({ model, temperature: 0.2, cellSize: 24, maxSteps: 8, captureReasoning: true });
  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  // Helper to get phase explanation
  const getPhaseExplanation = (phase: string | undefined) => {
    switch (phase) {
      case 'init':
      case 'initializing':
        return 'Setting up the analysis environment and loading puzzle data';
      case 'analyzing':
        return 'Examining training examples to identify patterns';
      case 'reasoning':
        return 'Applying visual reasoning and pattern matching';
      case 'generating':
        return 'Creating solution predictions and visualizations';
      case 'done':
        return 'Analysis complete';
      case 'error':
        return 'An error occurred during processing';
      default:
        return phase || 'Waiting to start';
    }
  };

  const progressPercent = typeof state.progress === 'number' ? 
    Math.min(100, Math.max(0, state.progress * 100)) : 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Saturn Visual Solver</h1>
            <p className="text-gray-600">Task {taskId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaturnModelSelect value={model} onChange={setModel} disabled={isRunning} />
          <Button onClick={onStart} disabled={isRunning} className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {isRunning ? 'Running…' : 'Start Analysis'}
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-yellow-500 animate-pulse' : 
                isDone ? 'bg-green-500' : 
                hasError ? 'bg-red-500' : 'bg-gray-300'
              }`} />
              <div>
                <div className="font-medium">
                  {isRunning && '🪐 Running'} 
                  {isDone && '✓ Complete'}
                  {hasError && '⚠ Error'}
                  {!isRunning && !isDone && !hasError && 'Ready'}
                </div>
                <div className="text-sm text-gray-600">
                  {getPhaseExplanation(state.phase)}
                </div>
              </div>
            </div>
            <div className="text-right">
              {typeof state.step === 'number' && typeof state.totalSteps === 'number' && (
                <div className="text-sm font-medium">Step {state.step}/{state.totalSteps}</div>
              )}
              <div className="text-sm text-gray-600">{progressPercent.toFixed(0)}%</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                hasError ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Puzzle Overview Toggle */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPuzzleDetails(!showPuzzleDetails)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPuzzleDetails ? 'Hide' : 'Show'} Puzzle Details
            </Button>
            <span className="text-sm text-gray-600">
              {task.train.length} training examples • {task.test?.length || 0} test cases
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Puzzle Details (Collapsible) */}
      {showPuzzleDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Puzzle Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Training Examples */}
            <div>
              <h4 className="font-medium mb-3">Training Examples ({task.train.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {task.train.map((ex, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="text-xs font-medium mb-2">Example {i + 1}</div>
                    <div className="flex items-center gap-2 justify-center">
                      <CompactGrid grid={ex.input} title="Input" size="small" />
                      <span className="text-gray-400">→</span>
                      <CompactGrid grid={ex.output} title="Output" size="small" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case */}
            {Array.isArray(task.test) && task.test.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Test Case</h4>
                <div className="border rounded-lg p-3 max-w-md">
                  <div className="flex items-center gap-2 justify-center">
                    <CompactGrid grid={task.test[0].input} title="Input" size="small" />
                    <span className="text-gray-400">→</span>
                    {task.test[0].output ? (
                      <CompactGrid grid={task.test[0].output} title="Output" size="small" />
                    ) : (
                      <div className="text-center text-gray-500 text-sm">
                        Solution needed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live Output */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Live Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={logRef}
            className="bg-gray-900 text-green-300 font-mono text-sm p-4 rounded-lg border h-64 overflow-auto"
          >
            {Array.isArray(state.logLines) && state.logLines.length > 0 ? (
              state.logLines.map((line, i) => (
                <div key={i} className="leading-relaxed">
                  {line || ''}
                </div>
              ))
            ) : (
              <div className="text-gray-500">Waiting for analysis to start...</div>
            )}
            {isRunning && <div className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />}
          </div>
        </CardContent>
      </Card>

      {/* Image Gallery */}
      {Array.isArray(state.galleryImages) && state.galleryImages.length > 0 && (
        <SaturnImageGallery
          images={state.galleryImages}
          title={`Generated Images (${state.galleryImages.length})`}
        />
      )}

      {/* Results */}
      {isDone && state.result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(state.result, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attribution */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertDescription className="text-center">
          Powered by the open-source{' '}
          <a
            href="https://github.com/zoecarver/saturn-arc"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium text-amber-800 hover:text-amber-900"
          >
            Saturn ARC project
          </a>
          {' '}by Zoe Carver
        </AlertDescription>
      </Alert>
    </div>
  );
}
