/**
 * GenerationSection.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: Dataset generation section for RE-ARC page.
 *          Handles generation, progress tracking, and file download.
 * SRP/DRY check: Pass - Single responsibility: dataset generation UI
 *
 * Guidelines for writing copy in client/src/pages/ReArc.tsx
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ProgressDisplay } from './ProgressDisplay';

interface GenerationSectionProps {
  numTasks: number;
}

// Generation phase machine using discriminated union
type GenerationPhase =
  | { phase: 'idle' }
  | { phase: 'generating'; progress: number }
  | { phase: 'completed' }
  | { phase: 'error'; message: string };

export function GenerationSection({ numTasks }: GenerationSectionProps) {
  const [phase, setPhase] = useState<GenerationPhase>({ phase: 'idle' });

  const handleGenerate = useCallback(async () => {
    setPhase({ phase: 'generating', progress: 0 });

    try {
      const response = await fetch('/api/rearc/generate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Unable to generate dataset. The server returned an error: ${response.statusText}`);
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || 're-arc_test_challenges.json';

      // Stream the response and track progress by counting newlines
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Dataset generation failed. The server response was incomplete. Please try again.');
      }

      const decoder = new TextDecoder();
      const chunks: Uint8Array[] = [];

      // ignore first line
      let lineCount = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);

        // Count newlines in this chunk
        const text = decoder.decode(value, { stream: true });
        const newlines = (text.match(/\n/g) || []).length;
        lineCount += newlines;
        setPhase({ phase: 'generating', progress: lineCount });
      }

      // Reconstruct blob from chunks
      const blob = new Blob(chunks as BlobPart[], { type: 'application/json' });

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Transition to completed phase
      setPhase({ phase: 'completed' });
    } catch (err) {
      let errorMessage = 'Unknown error occurred';

      if (err instanceof Error) {
        // Handle common network/fetch errors with user-friendly messages
        if (err.message === 'Failed to fetch' || err.message.toLowerCase().includes('network')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else {
          errorMessage = err.message;
        }
      }

      setPhase({
        phase: 'error',
        message: errorMessage,
      });
    }
  }, []);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Generate New Dataset</CardTitle>
      </CardHeader>
      <CardContent>
        {phase.phase === 'error' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{phase.message}</AlertDescription>
          </Alert>
        )}

        {phase.phase === 'generating' && (
          <div className="mb-4">
            <ProgressDisplay
              label="Generating dataset..."
              current={phase.progress}
              total={numTasks}
            />
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={phase.phase === 'generating' || phase.phase === 'completed'}
          className="w-full sm:w-auto"
        >
          {phase.phase === 'generating' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : phase.phase === 'completed' ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Dataset Generated
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>

        {phase.phase === 'error' && (
          <Button onClick={handleGenerate} variant="outline" className="ml-2">
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
