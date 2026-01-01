/**
 * GenerationSection.tsx
 *
 * Author: Claude Code using Sonnet 4.5 (updated by Claude Opus 4.5)
 * Date: 2025-12-27 (updated 2025-12-31 for terminal layout)
 * PURPOSE: Dataset generation section for RE-ARC page.
 *          Handles generation, progress tracking, and file download.
 *          Supports compact mode for dense layouts.
 * SRP/DRY check: Pass - Single responsibility: dataset generation UI
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ProgressDisplay } from './ProgressDisplay';

interface GenerationSectionProps {
  numTasks: number;
  /** When true, renders without Card wrapper for dense layouts */
  compact?: boolean;
}

// Generation phase machine using discriminated union
type GenerationPhase =
  | { phase: 'idle' }
  | { phase: 'generating'; progress: number }
  | { phase: 'completed' }
  | { phase: 'error'; message: string };

export function GenerationSection({ numTasks, compact = false }: GenerationSectionProps) {
  const [phase, setPhase] = useState<GenerationPhase>({ phase: 'idle' });

  const handleGenerate = useCallback(async () => {
    setPhase({ phase: 'generating', progress: 0 });

    try {
      const response = await fetch('/api/rearc/generate', {
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many generation requests. Please wait a moment before trying again.');
        }
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

      // Validate JSON completeness - server streams JSON that ends with '\n}\n'
      const fullText = await blob.text();
      if (!fullText.endsWith('\n}\n')) {
        throw new Error(
          'Incomplete dataset received from server. The generation may have timed out or been interrupted. Please try again.'
        );
      }

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

  const content = (
    <>
      {phase.phase === 'error' && (
        <Alert variant="destructive" className={compact ? "mb-3" : "mb-4"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className={compact ? "text-xs" : ""}>{phase.message}</AlertDescription>
        </Alert>
      )}

      {phase.phase === 'generating' && (
        <div className={compact ? "mb-3" : "mb-4"}>
          <ProgressDisplay
            label="Generating dataset..."
            current={phase.progress}
            total={numTasks}
          />
        </div>
      )}

      {phase.phase === 'completed' && (
        <Alert className={compact ? "mb-3 border-emerald-500/50 bg-emerald-500/5" : "mb-4 border-green-500/50 bg-green-500/5"}>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertDescription className={compact ? "text-xs" : ""}>
            Dataset downloaded. Run your solver on the challenges, then upload the results below.
          </AlertDescription>
        </Alert>
      )}

      <div className={compact ? "flex gap-2" : ""}>
        <Button
          onClick={handleGenerate}
          disabled={phase.phase === 'generating'}
          size={compact ? "sm" : "default"}
          className={compact ? "font-mono text-xs" : "w-full sm:w-auto"}
        >
          {phase.phase === 'generating' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : phase.phase === 'completed' ? (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate Again
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>

        {phase.phase === 'error' && (
          <Button onClick={handleGenerate} variant="outline" size={compact ? "sm" : "default"} className={compact ? "font-mono text-xs" : "ml-2"}>
            Retry
          </Button>
        )}
      </div>

    </>
  );

  if (compact) {
    return content;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Generate New Dataset</CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
