/**
 * client/src/pages/SaturnVisualSolver.tsx
 *
 * Saturn Visual Solver page.
 * Allows starting a Saturn analysis for a given ARC task and shows
 * real-time progress streamed over WebSockets. Reuses existing UI
 * components and follows app patterns.
 *
 * Includes:
 * - Model selector (GPT-5, Claude 4, Grok 4)
 * - Live image gallery rendering streamed images from the backend
 *
 * Used by route `/puzzle/saturn/:taskId` configured in `client/src/App.tsx`.
 * Author: Cascade (model: Cascade)
 */

import React from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Rocket } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { useSaturnProgress } from '@/hooks/useSaturnProgress';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import SaturnModelSelect, { type SaturnModelKey } from '@/components/saturn/SaturnModelSelect';
import SaturnImageGallery from '@/components/saturn/SaturnImageGallery';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, sessionId } = useSaturnProgress(taskId);
  const [model, setModel] = React.useState<SaturnModelKey>('GPT-5');

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
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
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

      {/* Puzzle Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Puzzle Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Training Examples</h3>
              <div className="space-y-6">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-8">
                      <PuzzleGrid grid={example.input} title="Input" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid grid={example.output} title="Output" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Test Case & Correct Answer</h3>
              {task.test.map((testCase, index) => (
                <div key={index} className="flex items-center justify-center gap-8">
                  <PuzzleGrid grid={testCase.input} title="Test Question" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} />
                  <div className="text-3xl text-green-600">→</div>
                  <PuzzleGrid grid={testCase.output} title="Correct Answer" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Live Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Status:</span> {state.status}</div>
            {sessionId && (
              <div><span className="font-medium">Session:</span> {sessionId}</div>
            )}
            {state.phase && (
              <div><span className="font-medium">Phase:</span> {state.phase}</div>
            )}
            {typeof state.step === 'number' && typeof state.totalSteps === 'number' && (
              <div><span className="font-medium">Step:</span> {state.step} / {state.totalSteps}</div>
            )}
            {typeof state.progress === 'number' && (
              <div><span className="font-medium">Progress:</span> {(state.progress * 100).toFixed(0)}%</div>
            )}
            {state.message && (
              <div><span className="font-medium">Message:</span> {state.message}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Gallery */}
      {Array.isArray(state.galleryImages) && state.galleryImages.length > 0 && (
        <SaturnImageGallery images={state.galleryImages} />
      )}

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
