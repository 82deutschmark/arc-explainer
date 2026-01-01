/**
 * Author: Cascade (ChatGPT)
 * Date: 2025-12-31
 * PURPOSE: Read-only card for displaying RE-ARC task previews (train/test counts and grid thumbnails)
 *          inside the dataset viewer. Emphasizes quick visual scan and deep-linking to /task/:taskId.
 * SRP/DRY check: Pass — card only renders dataset metadata; fetching/search handled elsewhere.
 */

import { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import type { ARCTask } from '@shared/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TinyGrid } from '@/components/puzzle/TinyGrid';

interface ReArcTaskCardProps {
  taskId: string;
  task: ARCTask;
  showTests?: boolean;
}

export function ReArcTaskCard({ taskId, task, showTests = false }: ReArcTaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useMemo(() => {
    if (!cardRef.current) return;
    if (isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  const firstTrain = task.train?.[0];
  const testExamples = showTests ? task.test : [];

  const gridPreviews = useMemo(() => {
    if (!isVisible) return null;

    const previews = [];
    if (firstTrain) {
      previews.push({
        label: 'Train Input',
        grid: firstTrain.input,
      });
      previews.push({
        label: 'Train Output',
        grid: firstTrain.output,
      });
    }

    if (testExamples && testExamples.length > 0) {
      previews.push({
        label: testExamples.length > 1 ? 'Test Inputs' : 'Test Input',
        grid: testExamples[0].input,
      });
    }

    return previews;
  }, [firstTrain, testExamples, isVisible]);

  const trainCount = task.train?.length ?? 0;
  const testCount = task.test?.length ?? 0;
  const maxTrainGrid = firstTrain?.input?.length ?? 0;
  const maxTrainGridCols = firstTrain?.input?.[0]?.length ?? 0;
  const gridLabel = maxTrainGrid && maxTrainGridCols ? `${maxTrainGridCols}×${maxTrainGrid}` : 'n/a';

  return (
    <Link href={`/task/${taskId}`}>
      <Card
        ref={cardRef}
        className="group h-full cursor-pointer transition hover:shadow-md focus-within:ring-2 focus-within:ring-ring"
        role="button"
        tabIndex={0}
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <code className="text-xs md:text-sm font-mono truncate">{taskId}</code>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              train {trainCount}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              test {testCount}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              grid {gridLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {gridPreviews ? (
            <div className="grid gap-2">
              {gridPreviews.map((preview) => (
                <div key={preview.label}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {preview.label}
                  </p>
                  <div className="w-full border rounded bg-muted/30 p-2">
                    <TinyGrid grid={preview.grid} className="max-h-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-24 rounded bg-muted animate-pulse" />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
