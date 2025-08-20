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
  // Cascade: console controls
  const [consoleExpanded, setConsoleExpanded] = React.useState(true);
  const [autoscroll, setAutoscroll] = React.useState(true);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll log to bottom when new lines arrive
  React.useEffect(() => {
    if (!autoscroll) return;
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.logLines, autoscroll]);

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

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Saturn Visual Solver</h1>
            <p className="text-gray-600">Task {taskId} • Real-time visual reasoning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaturnModelSelect value={model} onChange={setModel} disabled={isRunning} />
          {/* Cascade: subtle running indicator to clarify active state */}
          {isRunning && (
            <span title="Saturn is running" className="text-amber-700 text-sm select-none">🪐 Running</span>
          )}
          <Button onClick={onStart} disabled={isRunning} className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {isRunning ? 'Running…' : 'Start Analysis'}
          </Button>
        </div>
      </div>

      {/* Cascade: UI attribution banner for Saturn ARC with GitHub link */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertDescription>
          This visual solver is powered by the open-source Saturn ARC project by Zoe Carver.{' '}
          <a
            href="https://github.com/zoecarver/saturn-arc"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium text-amber-800 hover:text-amber-900"
          >
            View on GitHub
          </a>
          .
        </AlertDescription>
      </Alert>

      {/* Redesign layout: Two-column grid with sticky sidebar to avoid overlap. */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left Sidebar - Compact Puzzle Overview (sticky on desktop) */}
        <aside className="order-2 lg:order-1 lg:sticky lg:top-24">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Puzzle Overview</CardTitle>
            </CardHeader>
            {/* Make sidebar content scroll independently to prevent layout push/overlap */}
            <CardContent className="space-y-4 max-h-[70vh] overflow-auto pr-1">
              {/* Training */}
              <div>
                <h4 className="text-sm font-medium mb-2">Training ({task.train.length})</h4>
                <div className="space-y-3">
                  {task.train.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CompactGrid grid={ex.input} title="In" size="tiny" />
                      <span className="text-gray-400">→</span>
                      <CompactGrid grid={ex.output} title="Out" size="tiny" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Test */}
              {Array.isArray(task.test) && task.test.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Test</h4>
                  <div className="flex items-center gap-2">
                    <CompactGrid grid={task.test[0].input} title="In" size="tiny" />
                    <span className="text-gray-400">→</span>
                    {task.test[0].output ? (
                      <CompactGrid grid={task.test[0].output} title="Out" size="tiny" />
                    ) : (
                      <span className="text-xs text-gray-500">?</span>
                    )}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  {typeof state.step === 'number' && typeof state.totalSteps === 'number' && (
                    <span>Step {state.step}/{state.totalSteps}</span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, (state.progress ?? 0) * 100)).toFixed(0)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {state.phase ? `Phase: ${state.phase}` : 'Waiting…'}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content - Live Console */}
        <div className="order-1 lg:order-2 space-y-6">
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Live Console Output
                  {autoscroll && <Badge variant="outline" className="text-xs">Auto-scroll</Badge>}
                  {/* Cascade: inline run status summary to avoid duplicate Live Progress card */}
                  <span className="hidden sm:flex items-center gap-2 text-xs text-gray-600 ml-2">
                    <span className="whitespace-nowrap">Status: <span className="font-medium">{state.status}</span></span>
                    {typeof state.step === 'number' && typeof state.totalSteps === 'number' && (
                      <span className="whitespace-nowrap">Step {state.step}/{state.totalSteps}</span>
                    )}
                    {typeof state.progress === 'number' && (
                      <span className="whitespace-nowrap">{(state.progress * 100).toFixed(0)}%</span>
                    )}
                  </span>
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAutoscroll(!autoscroll)}>
                    {autoscroll ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConsoleExpanded(!consoleExpanded)}>
                    {consoleExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Cascade: subtle progress track under header */}
              {typeof state.progress === 'number' && (
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, (state.progress ?? 0) * 100)).toFixed(0)}%` }}
                    />
                  </div>
                </div>
              )}
              <div
                ref={logRef}
                className={`bg-black text-green-200 font-mono text-sm p-4 rounded border overflow-auto ${consoleExpanded ? 'h-96' : 'h-48'}`}
              >
                {Array.isArray(state.logLines) && state.logLines.length > 0 ? (
                  state.logLines.map((line, i) => (
                    <div key={i} className={`${(line || '').trim() === '' ? 'h-2' : ''}`}>{line}</div>
                  ))
                ) : (
                  <div>No logs yet…</div>
                )}
                <div className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
              </div>
            </CardContent>
          </Card>
          {/* Image Gallery (kept in main column so it sits with the console) */}
          {Array.isArray(state.galleryImages) && state.galleryImages.length > 0 && (
            <SaturnImageGallery
              images={state.galleryImages}
              title={`Generated Images (${state.galleryImages.length})${isRunning ? ' • Streaming…' : ''}`}
            />
          )}
        </div>
      </div>

      {/* Final Result */}
      {isDone && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-96">{JSON.stringify(state.result, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
