/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: One note from play -- what a human saw, did, expected and what happened, with what
 *          the code says underneath -- as a yellow box. Used under a level's rules for notes
 *          about that level, and in the "whole game" card for notes not tied to one level.
 *          Replaces the old single "Notes From Play" card in Arc3GameSpoiler.tsx.
 * SRP/DRY check: Pass -- presentation of one PlayerObservation; which level a note belongs to
 *          is decided in shared/arc3Games/gameLevels.ts.
 */

import type { PlayerObservation } from '@shared/arc3Games';

const ROWS: { label: string; key: keyof PlayerObservation }[] = [
  { label: 'Saw', key: 'saw' },
  { label: 'Did', key: 'did' },
  { label: 'Expected', key: 'expected' },
  { label: 'Happened', key: 'happened' },
  { label: 'In the code', key: 'inCode' },
];

function formatNoteDay(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return day;
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function PlayNote({ note, showLevel = false }: { note: PlayerObservation; showLevel?: boolean }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3.5 py-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="mb-2 text-xs font-semibold">
        Notes from play
        <span className="ml-2 font-normal text-muted-foreground">
          {note.player} · {formatNoteDay(note.date)}
          {showLevel && typeof note.level === 'number' ? ` · level ${note.level}` : ''}
        </span>
      </p>
      <dl className="space-y-1">
        {ROWS.filter(({ key }) => typeof note[key] === 'string' && note[key]).map(({ label, key }) => (
          <div key={key} className="grid grid-cols-[5.5rem_1fr] gap-2 text-sm">
            <dt className="font-semibold text-muted-foreground">{label}</dt>
            <dd className={key === 'inCode' ? 'text-muted-foreground' : ''}>{note[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
