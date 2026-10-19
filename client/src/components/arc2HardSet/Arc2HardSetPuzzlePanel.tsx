/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: The open panel under a hard-set table row: the puzzle's training and test grids, Dr. Fable's
 *          plain-language solve note, and the browser over every recorded attempt. Loads the task on
 *          open only, so the table stays light until a row is picked.
 * SRP/DRY check: Pass — grids via the existing CompactPuzzleDisplay and usePuzzle; note and attempts
 *                via the sibling components; no data shaping here.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Arc2HardSetNoteCard } from './Arc2HardSetNoteCard';
import { Arc2HardSetReasoningBrowser } from './Arc2HardSetReasoningBrowser';

export function Arc2HardSetPuzzlePanel({ puzzleId }: { puzzleId: string }) {
  const { task, isLoadingTask, taskError } = usePuzzle(puzzleId);

  if (isLoadingTask) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading puzzle {puzzleId}…
      </div>
    );
  }
  if (taskError || !task) {
    return <p className="py-2 text-sm text-destructive">Could not load puzzle {puzzleId}.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CompactPuzzleDisplay
          trainExamples={task.train}
          testCases={task.test}
          title={`Puzzle ${puzzleId}`}
          maxTrainingExamples={task.train.length}
          defaultTrainingCollapsed={false}
        />
        <Arc2HardSetNoteCard puzzleId={puzzleId} />
      </div>
      <Arc2HardSetReasoningBrowser puzzleId={puzzleId} testCases={task.test} />
    </div>
  );
}
