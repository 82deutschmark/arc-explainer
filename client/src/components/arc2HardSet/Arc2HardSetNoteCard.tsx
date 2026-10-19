/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Shows Dr. Fable 5.1's plain-language solve note for one hard-set puzzle: the nickname, the
 *          confidence level (coded and checked, read by eye, or could not pin down), the bullets, and
 *          what the recorded reasoning shows going wrong. Always carries the disclosure that the note
 *          was written with the answers in hand, so nobody mistakes it for a blind solve.
 * SRP/DRY check: Pass — reads shared/arc2HardSet.ts; presentational only.
 * shadcn/ui: Pass — Badge.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ARC2_HARD_SET_CONFIDENCE_LABELS, getArc2HardSetNote } from '@shared/arc2HardSet';

const CONFIDENCE_STYLES: Record<string, string> = {
  checked: 'border-emerald-400 text-emerald-800 bg-emerald-50',
  read: 'border-amber-400 text-amber-800 bg-amber-50',
  partial: 'border-rose-400 text-rose-800 bg-rose-50',
};

export function Arc2HardSetNoteCard({ puzzleId }: { puzzleId: string }) {
  const note = getArc2HardSetNote(puzzleId);

  if (!note) {
    return (
      <section className="space-y-1 text-sm">
        <h3 className="font-semibold">How to solve it, in plain words</h3>
        <p className="text-muted-foreground">
          No note yet. This puzzle joined the hard set after the notes were written; the recorded attempts below are still here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-semibold">How to solve it, in plain words: “{note.nickname}”</h3>
        <Badge variant="outline" className={CONFIDENCE_STYLES[note.confidence]}>
          {ARC2_HARD_SET_CONFIDENCE_LABELS[note.confidence]}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Written by Dr. Fable 5.1 with the answer grids open. A model that can see the answer still may not be able to say why; treat the confidence tag as the honest part.
      </p>
      <ol className="list-decimal space-y-1 pl-5 leading-relaxed">
        {note.bullets.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
      {note.whereModelsBreak && (
        <p className="border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground">
          <span className="font-semibold text-foreground">Where the models break: </span>
          {note.whereModelsBreak}
        </p>
      )}
    </section>
  );
}
